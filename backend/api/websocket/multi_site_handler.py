"""
multi_site_handler.py
Multi-Site WebSocket 연결 핸들러

@version 1.1.0
@changelog
- v1.1.0: subscription_change 핸들러 추가 (2026-02-05)
          - _handle_subscription_change() 메서드 추가
          - ClientSubscriptionManager 연동 (connect/disconnect 시 등록/해제)
          - subscription_change_ack 응답 전송
          - ⚠️ 호환성: 기존 메시지 핸들러 100% 유지
- v1.0.0: Phase 3 - WebSocket Pool Manager Backend 구현 (2026-02-04)
          - Site별 Room 관리
          - Summary/Full 브로드캐스트
          - Connection Manager 연동
          - ⚠️ 호환성: 기존 stream_handler.py 패턴 유지

@dependencies
- fastapi (WebSocket, WebSocketDisconnect)
- ../database/multi_connection_manager.py (MultiConnectionManager)
- ../services/uds/uds_service.py (UDSService)
- ../services/uds/subscription_field_filter.py (ClientSubscriptionManager)  # 🆕 v1.1.0

작성일: 2026-02-04
수정일: 2026-02-05
"""

import asyncio
import json
import logging
from typing import Dict, List, Set, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass, field
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


# ============================================
# 🆕 v1.1.0: ClientSubscriptionManager Import
# ============================================

_subscription_manager_available = False
try:
    from ..services.uds.subscription_field_filter import (
        get_client_subscription_manager,
        ClientSubscriptionManager
    )
    _subscription_manager_available = True
except ImportError:
    logger.warning(
        "⚠️ subscription_field_filter 임포트 실패 - "
        "구독 필터링 없이 동작합니다"
    )


# ============================================
# Enums & Constants
# ============================================

class SubscriptionType(Enum):
    """WebSocket 구독 타입"""
    SUMMARY = "summary"  # 요약 데이터 (30초/60초)
    FULL = "full"        # 전체 데이터 (10초)


class ConnectionState(Enum):
    """연결 상태"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    PAUSED = "paused"


# 기본 간격 설정 (ms)
DEFAULT_INTERVALS = {
    SubscriptionType.SUMMARY: 30000,  # 30초
    SubscriptionType.FULL: 10000,     # 10초
}


# ============================================
# Data Classes
# ============================================

@dataclass
class WebSocketClient:
    """WebSocket 클라이언트 정보"""
    websocket: WebSocket
    site_id: str
    subscription_type: SubscriptionType
    interval_ms: int
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: Optional[datetime] = None
    message_count: int = 0
    client_id: str = field(default_factory=lambda: f"client_{id(object())}")
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        return {
            "client_id": self.client_id,
            "site_id": self.site_id,
            "subscription_type": self.subscription_type.value,
            "interval_ms": self.interval_ms,
            "connected_at": self.connected_at.isoformat(),
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "message_count": self.message_count
        }


@dataclass
class SiteRoom:
    """Site별 Room (연결 그룹)"""
    site_id: str
    summary_clients: Set[WebSocketClient] = field(default_factory=set)
    full_clients: Set[WebSocketClient] = field(default_factory=set)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def total_clients(self) -> int:
        """전체 클라이언트 수"""
        return len(self.summary_clients) + len(self.full_clients)
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        return {
            "site_id": self.site_id,
            "summary_clients": len(self.summary_clients),
            "full_clients": len(self.full_clients),
            "total_clients": self.total_clients,
            "created_at": self.created_at.isoformat()
        }


# ============================================
# MultiSiteWebSocketHandler
# ============================================

class MultiSiteWebSocketHandler:
    """
    Multi-Site WebSocket 연결 핸들러
    
    Site별 Room 관리, 브로드캐스트, 연결 상태 추적
    
    Usage:
        handler = MultiSiteWebSocketHandler()
        
        # WebSocket 연결
        async with handler.connect(websocket, "CN_AAAA", SubscriptionType.SUMMARY) as client:
            # 메시지 수신 루프
            async for message in websocket.iter_text():
                await handler.handle_message(client, message)
    """
    
    def __init__(self):
        # Site별 Room
        self._rooms: Dict[str, SiteRoom] = {}
        
        # 모든 클라이언트
        self._clients: Dict[str, WebSocketClient] = {}
        
        # 브로드캐스트 작업
        self._broadcast_tasks: Dict[str, asyncio.Task] = {}
        
        # Lock
        self._lock = asyncio.Lock()
        
        # =============================================
        # 🆕 v1.1.0: ClientSubscriptionManager 연결
        # =============================================
        self._subscription_manager: Optional[Any] = None
        if _subscription_manager_available:
            try:
                self._subscription_manager = get_client_subscription_manager()
                logger.info("📊 ClientSubscriptionManager 연결됨")
            except Exception as e:
                logger.warning(
                    f"⚠️ ClientSubscriptionManager 초기화 실패 "
                    f"(구독 필터링 없이 동작): {e}"
                )
        
        logger.info("🔌 MultiSiteWebSocketHandler 초기화됨 (v1.1.0)")
    
    # ============================================
    # Room 관리
    # ============================================
    
    def _get_or_create_room(self, site_id: str) -> SiteRoom:
        """Room 조회 또는 생성"""
        if site_id not in self._rooms:
            self._rooms[site_id] = SiteRoom(site_id=site_id)
            logger.info(f"📦 Room 생성: {site_id}")
        return self._rooms[site_id]
    
    def _cleanup_room(self, site_id: str):
        """빈 Room 정리"""
        room = self._rooms.get(site_id)
        if room and room.total_clients == 0:
            del self._rooms[site_id]
            logger.info(f"🗑️ Room 삭제: {site_id}")
    
    # ============================================
    # 연결 관리
    # ============================================
    
    async def connect(
        self,
        websocket: WebSocket,
        site_id: str,
        subscription_type: SubscriptionType,
        interval_ms: Optional[int] = None
    ) -> WebSocketClient:
        """
        WebSocket 연결
        
        Args:
            websocket: WebSocket 인스턴스
            site_id: Site ID
            subscription_type: 구독 타입 (SUMMARY/FULL)
            interval_ms: 메시지 간격 (기본값 사용)
        
        Returns:
            WebSocketClient: 클라이언트 정보
        """
        await websocket.accept()
        
        # 기본 간격 설정
        if interval_ms is None:
            interval_ms = DEFAULT_INTERVALS[subscription_type]
        
        async with self._lock:
            # 클라이언트 생성
            client = WebSocketClient(
                websocket=websocket,
                site_id=site_id,
                subscription_type=subscription_type,
                interval_ms=interval_ms
            )
            
            # Room에 추가
            room = self._get_or_create_room(site_id)
            if subscription_type == SubscriptionType.SUMMARY:
                room.summary_clients.add(client)
            else:
                room.full_clients.add(client)
            
            # 전역 클라이언트 목록에 추가
            self._clients[client.client_id] = client
            
            # =============================================
            # 🆕 v1.1.0: ClientSubscriptionManager에 등록
            # =============================================
            if self._subscription_manager:
                try:
                    self._subscription_manager.register(client.client_id)
                    logger.info(
                        f"📊 구독 관리자에 클라이언트 등록: {client.client_id}"
                    )
                except Exception as e:
                    logger.warning(
                        f"⚠️ 구독 관리자 등록 실패: {e}"
                    )
            
            logger.info(
                f"🔗 클라이언트 연결: {client.client_id} "
                f"({site_id}, {subscription_type.value})"
            )
            
            return client
    
    async def disconnect(self, client: WebSocketClient):
        """
        WebSocket 연결 해제
        
        Args:
            client: 클라이언트 정보
        """
        async with self._lock:
            # Room에서 제거
            room = self._rooms.get(client.site_id)
            if room:
                if client.subscription_type == SubscriptionType.SUMMARY:
                    room.summary_clients.discard(client)
                else:
                    room.full_clients.discard(client)
                
                # 빈 Room 정리
                self._cleanup_room(client.site_id)
            
            # 전역 클라이언트 목록에서 제거
            self._clients.pop(client.client_id, None)
            
            # =============================================
            # 🆕 v1.1.0: ClientSubscriptionManager에서 해제
            # =============================================
            if self._subscription_manager:
                try:
                    self._subscription_manager.unregister(client.client_id)
                    logger.info(
                        f"📊 구독 관리자에서 클라이언트 해제: {client.client_id}"
                    )
                except Exception as e:
                    logger.warning(
                        f"⚠️ 구독 관리자 해제 실패: {e}"
                    )
            
            logger.info(f"🔌 클라이언트 연결 해제: {client.client_id}")
    
    # ============================================
    # 메시지 전송
    # ============================================
    
    async def send_to_client(self, client: WebSocketClient, data: Dict[str, Any]) -> bool:
        """
        단일 클라이언트에 메시지 전송
        
        Args:
            client: 클라이언트 정보
            data: 전송할 데이터
        
        Returns:
            bool: 전송 성공 여부
        """
        try:
            message = json.dumps(data, default=str)
            await client.websocket.send_text(message)
            
            # 통계 업데이트
            client.last_message_at = datetime.now(timezone.utc)
            client.message_count += 1
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 메시지 전송 실패 ({client.client_id}): {e}")
            return False
    
    async def broadcast_to_room(
        self,
        site_id: str,
        data: Dict[str, Any],
        subscription_type: Optional[SubscriptionType] = None
    ) -> int:
        """
        Room 내 클라이언트들에게 브로드캐스트
        
        Args:
            site_id: Site ID
            data: 전송할 데이터
            subscription_type: 특정 타입만 전송 (None이면 전체)
        
        Returns:
            int: 전송 성공 수
        """
        room = self._rooms.get(site_id)
        if not room:
            return 0
        
        # 대상 클라이언트 선택
        clients = []
        if subscription_type is None or subscription_type == SubscriptionType.SUMMARY:
            clients.extend(room.summary_clients)
        if subscription_type is None or subscription_type == SubscriptionType.FULL:
            clients.extend(room.full_clients)
        
        # 병렬 전송
        tasks = [self.send_to_client(client, data) for client in clients]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if r is True)
        
        if success_count < len(clients):
            logger.warning(
                f"⚠️ 브로드캐스트 부분 실패: {site_id} "
                f"({success_count}/{len(clients)} 성공)"
            )
        
        return success_count
    
    async def broadcast_to_all(
        self,
        data: Dict[str, Any],
        subscription_type: Optional[SubscriptionType] = None
    ) -> Dict[str, int]:
        """
        모든 Room에 브로드캐스트
        
        Args:
            data: 전송할 데이터
            subscription_type: 특정 타입만 전송
        
        Returns:
            Dict[str, int]: Site별 전송 성공 수
        """
        results = {}
        
        for site_id in list(self._rooms.keys()):
            # Site ID를 데이터에 추가
            site_data = {**data, "site_id": site_id}
            results[site_id] = await self.broadcast_to_room(
                site_id, site_data, subscription_type
            )
        
        return results
    
    # ============================================
    # 메시지 핸들링
    # ============================================
    
    async def handle_message(self, client: WebSocketClient, message: str):
        """
        클라이언트 메시지 처리
        
        Args:
            client: 클라이언트 정보
            message: 수신된 메시지
        """
        try:
            data = json.loads(message)
            msg_type = data.get("type", "unknown")
            
            if msg_type == "ping":
                await self._handle_ping(client, data)
            elif msg_type == "pause":
                await self._handle_pause(client, data)
            elif msg_type == "resume":
                await self._handle_resume(client, data)
            elif msg_type == "change_interval":
                await self._handle_change_interval(client, data)
            # =============================================
            # 🆕 v1.1.0: subscription_change 핸들러
            # Frontend SubscriptionLevelManager가 전송하는
            # UI Context 기반 구독 레벨 변경 요청 처리
            # =============================================
            elif msg_type == "subscription_change":
                await self._handle_subscription_change(client, data)
            else:
                logger.warning(f"⚠️ 알 수 없는 메시지 타입: {msg_type}")
                
        except json.JSONDecodeError:
            logger.error(f"❌ JSON 파싱 실패: {message[:100]}")
        except Exception as e:
            logger.error(f"❌ 메시지 처리 실패: {e}")
    
    async def _handle_ping(self, client: WebSocketClient, data: Dict):
        """Ping/Pong 처리"""
        await self.send_to_client(client, {
            "type": "pong",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def _handle_pause(self, client: WebSocketClient, data: Dict):
        """일시 정지 처리"""
        # TODO: 브로드캐스트 일시 정지 구현
        logger.info(f"⏸️ 클라이언트 일시 정지: {client.client_id}")
        await self.send_to_client(client, {
            "type": "paused",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def _handle_resume(self, client: WebSocketClient, data: Dict):
        """재개 처리"""
        # TODO: 브로드캐스트 재개 구현
        logger.info(f"▶️ 클라이언트 재개: {client.client_id}")
        await self.send_to_client(client, {
            "type": "resumed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def _handle_change_interval(self, client: WebSocketClient, data: Dict):
        """간격 변경 처리"""
        new_interval = data.get("interval_ms")
        if new_interval and isinstance(new_interval, int) and new_interval >= 1000:
            client.interval_ms = new_interval
            logger.info(f"⏱️ 간격 변경: {client.client_id} → {new_interval}ms")
            await self.send_to_client(client, {
                "type": "interval_changed",
                "interval_ms": new_interval,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    
    # =============================================
    # 🆕 v1.1.0: subscription_change 핸들러
    # =============================================
    
    async def _handle_subscription_change(
        self, client: WebSocketClient, data: Dict
    ):
        """
        구독 레벨 변경 처리
        
        Frontend SubscriptionLevelManager가 UI Context 변경 시 전송하는 메시지.
        ClientSubscriptionManager를 통해 해당 클라이언트의 구독 레벨을 업데이트하고,
        이후 Delta 전송 시 필터링에 반영됨.
        
        수신 메시지 형식:
        {
            "type": "subscription_change",
            "payload": {
                "context": "MONITORING_3D_VIEW_WITH_PANEL",
                "previous_context": "MONITORING_3D_VIEW",
                "all_level": "MINIMAL",
                "selected_ids": ["EQ-17-03"],
                "selected_level": "DETAILED",
                "websocket_state": "ACTIVE"
            }
        }
        
        Args:
            client: WebSocket 클라이언트 정보
            data: 수신 메시지 (type + payload)
        """
        payload = data.get("payload", {})
        context = payload.get("context", "UNKNOWN")
        previous_context = payload.get("previous_context", "UNKNOWN")
        all_level = payload.get("all_level")
        selected_level = payload.get("selected_level")
        selected_ids = payload.get("selected_ids", [])
        websocket_state = payload.get("websocket_state", "ACTIVE")
        
        logger.info(
            f"📊 구독 변경 요청: {client.client_id} | "
            f"{previous_context} → {context}, "
            f"all={all_level}, selected={selected_level} "
            f"({len(selected_ids)}개), ws_state={websocket_state}"
        )
        
        # ClientSubscriptionManager로 구독 변경 위임
        subscription_applied = False
        if self._subscription_manager:
            try:
                subscription_applied = (
                    self._subscription_manager.handle_subscription_change(
                        client_id=client.client_id,
                        message={
                            "context": context,
                            "all_level": all_level,
                            "selected_ids": selected_ids,
                            "selected_level": selected_level
                        }
                    )
                )
                
                if subscription_applied:
                    logger.info(
                        f"✅ 구독 변경 적용됨: {client.client_id} → {context}"
                    )
                else:
                    logger.warning(
                        f"⚠️ 구독 변경 실패: {client.client_id} "
                        f"(handle_subscription_change returned False)"
                    )
                    
            except Exception as e:
                logger.error(
                    f"❌ 구독 변경 처리 오류 ({client.client_id}): {e}",
                    exc_info=True
                )
        else:
            logger.debug(
                f"📊 구독 변경 수신 (SubscriptionManager 미연결): "
                f"{client.client_id} → {context}"
            )
        
        # ACK 응답 전송
        await self.send_to_client(client, {
            "type": "subscription_change_ack",
            "success": subscription_applied or not self._subscription_manager,
            "context": context,
            "previous_context": previous_context,
            "all_level": all_level,
            "selected_level": selected_level,
            "selected_count": len(selected_ids),
            "websocket_state": websocket_state,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    # ============================================
    # 상태 조회
    # ============================================
    
    def get_stats(self) -> Dict[str, Any]:
        """
        전체 통계 조회
        
        Returns:
            Dict: 통계 정보
        """
        room_stats = {site_id: room.to_dict() for site_id, room in self._rooms.items()}
        
        return {
            "total_rooms": len(self._rooms),
            "total_clients": len(self._clients),
            "rooms": room_stats,
            # 🆕 v1.1.0: 구독 관리자 상태
            "subscription_manager_available": self._subscription_manager is not None,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def get_room_stats(self, site_id: str) -> Optional[Dict[str, Any]]:
        """
        특정 Room 통계 조회
        
        Args:
            site_id: Site ID
        
        Returns:
            Dict: Room 통계 (없으면 None)
        """
        room = self._rooms.get(site_id)
        return room.to_dict() if room else None
    
    def get_client_info(self, client_id: str) -> Optional[Dict[str, Any]]:
        """
        클라이언트 정보 조회
        
        Args:
            client_id: 클라이언트 ID
        
        Returns:
            Dict: 클라이언트 정보 (없으면 None)
        """
        client = self._clients.get(client_id)
        return client.to_dict() if client else None
    
    # ============================================
    # 정리
    # ============================================
    
    async def close_all(self):
        """모든 연결 종료"""
        logger.info("🔌 모든 WebSocket 연결 종료 시작")
        
        for client in list(self._clients.values()):
            try:
                await client.websocket.close(1000, "Server shutdown")
            except Exception as e:
                logger.warning(f"⚠️ WebSocket 종료 실패: {e}")
        
        self._rooms.clear()
        self._clients.clear()
        
        logger.info("✅ 모든 WebSocket 연결 종료 완료")


# ============================================
# 싱글톤 인스턴스
# ============================================

_handler_instance: Optional[MultiSiteWebSocketHandler] = None


def get_multi_site_ws_handler() -> MultiSiteWebSocketHandler:
    """MultiSiteWebSocketHandler 싱글톤 반환"""
    global _handler_instance
    
    if _handler_instance is None:
        _handler_instance = MultiSiteWebSocketHandler()
    
    return _handler_instance


# ============================================
# 편의 함수
# ============================================

async def handle_site_websocket(
    websocket: WebSocket,
    site_id: str,
    subscription_type: str,
    interval_ms: Optional[int] = None
):
    """
    Site WebSocket 연결 처리 (엔드포인트용)
    
    Args:
        websocket: WebSocket 인스턴스
        site_id: Site ID
        subscription_type: "summary" 또는 "full"
        interval_ms: 메시지 간격
    """
    handler = get_multi_site_ws_handler()
    
    # 구독 타입 변환
    sub_type = SubscriptionType.SUMMARY if subscription_type == "summary" else SubscriptionType.FULL
    
    client = await handler.connect(websocket, site_id, sub_type, interval_ms)
    
    try:
        # 연결 확인 메시지
        await handler.send_to_client(client, {
            "type": "connected",
            "site_id": site_id,
            "subscription_type": subscription_type,
            "interval_ms": client.interval_ms,
            "client_id": client.client_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # 메시지 수신 루프
        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=300  # 5분 타임아웃
                )
                await handler.handle_message(client, message)
            except asyncio.TimeoutError:
                # Ping 전송
                await handler.send_to_client(client, {
                    "type": "ping",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket 연결 해제됨: {client.client_id}")
    except Exception as e:
        logger.error(f"❌ WebSocket 에러: {e}")
    finally:
        await handler.disconnect(client)