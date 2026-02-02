# backend/api/websocket/health_stream.py
"""
health_stream.py
Site Health WebSocket Stream - Phase 1 Multi-Site Connection 기반 확장

실시간으로 모든 Site의 상태를 스트리밍합니다.
Dashboard와 Monitoring Mode에서 Site 상태 변경을 감지하는 데 사용됩니다.

@version 1.0.0
@changelog
- v1.0.0: 초기 버전 (2026-02-02)
          - 실시간 Health 상태 스트리밍 (30초 간격)
          - 다중 클라이언트 지원
          - 상태 변경 알림 (site_change)
          - Ping/Pong Keep-alive
          - ⚠️ 호환성: 신규 WebSocket으로 기존 코드 영향 없음

@dependencies
- fastapi
- backend.api.services.site_health_service

📁 위치: backend/api/websocket/health_stream.py
작성일: 2026-02-02
수정일: 2026-02-02
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timezone
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


# ============================================
# Message Types
# ============================================

class HealthMessageType:
    """WebSocket 메시지 타입"""
    INITIAL = "initial"           # 초기 연결 시 전체 상태
    UPDATE = "update"             # 정기 업데이트
    SITE_CHANGE = "site_change"   # 특정 Site 상태 변경
    ERROR = "error"               # 에러 메시지
    PING = "ping"                 # Keep-alive ping
    PONG = "pong"                 # Keep-alive pong


# ============================================
# Health Stream Manager
# ============================================

class HealthStreamManager:
    """
    Health 상태 WebSocket 관리자
    
    다중 클라이언트 연결을 관리하고, 상태 변경을 브로드캐스트합니다.
    """
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.broadcast_interval: int = 30  # 기본 30초
        self._health_service = None
        self._previous_states: Dict[str, str] = {}  # site_id → status
        self._broadcast_task: Optional[asyncio.Task] = None
        self._running: bool = False
        
        logger.info("✅ HealthStreamManager 초기화")
    
    @property
    def health_service(self):
        """SiteHealthService lazy loading"""
        if self._health_service is None:
            from ..services.site_health_service import get_site_health_service
            self._health_service = get_site_health_service()
            logger.info("🔗 SiteHealthService 연결 완료")
        return self._health_service
    
    @property
    def connection_count(self) -> int:
        """현재 연결된 클라이언트 수"""
        return len(self.active_connections)
    
    async def connect(self, websocket: WebSocket):
        """새 클라이언트 연결"""
        await websocket.accept()
        self.active_connections.add(websocket)
        
        logger.info(f"🔗 Health Stream 연결: {self.connection_count} clients")
        
        # 초기 상태 전송
        try:
            initial_health = await self.health_service.check_all_sites_health()
            await self._send_message(websocket, {
                "type": HealthMessageType.INITIAL,
                "data": initial_health,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            logger.info(f"📡 초기 상태 전송 완료")
        except Exception as e:
            logger.error(f"❌ 초기 상태 전송 실패: {e}")
            await self._send_error(websocket, str(e))
    
    def disconnect(self, websocket: WebSocket):
        """클라이언트 연결 해제"""
        self.active_connections.discard(websocket)
        logger.info(f"🔌 Health Stream 해제: {self.connection_count} clients")
        
        # 모든 연결이 끊기면 브로드캐스트 중지
        if self.connection_count == 0 and self._broadcast_task:
            self._running = False
            logger.info("⏹️ 모든 연결 해제 - 브로드캐스트 중지")
    
    async def _send_message(self, websocket: WebSocket, message: Dict[str, Any]):
        """개별 클라이언트에 메시지 전송"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"❌ 메시지 전송 실패: {e}")
            self.disconnect(websocket)
    
    async def _send_error(self, websocket: WebSocket, error: str):
        """에러 메시지 전송"""
        await self._send_message(websocket, {
            "type": HealthMessageType.ERROR,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast(self, message: Dict[str, Any]):
        """모든 클라이언트에 메시지 브로드캐스트"""
        if not self.active_connections:
            return
        
        disconnected = set()
        
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"⚠️ 브로드캐스트 실패, 연결 제거: {e}")
                disconnected.add(connection)
        
        # 실패한 연결 제거
        self.active_connections -= disconnected
    
    async def broadcast_health_update(self):
        """현재 Health 상태 브로드캐스트"""
        try:
            health_data = await self.health_service.check_all_sites_health()
            
            # 상태 변경 감지
            changes = self._detect_changes(health_data["sites"])
            
            if changes:
                # 변경된 Site가 있으면 site_change 타입으로 전송
                for change in changes:
                    await self.broadcast({
                        "type": HealthMessageType.SITE_CHANGE,
                        "data": change,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    logger.info(f"📢 Site 상태 변경 알림: {change['site_id']}")
            
            # 전체 상태 업데이트 전송
            await self.broadcast({
                "type": HealthMessageType.UPDATE,
                "data": health_data,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Health 브로드캐스트 실패: {e}")
            await self.broadcast({
                "type": HealthMessageType.ERROR,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    
    def _detect_changes(self, sites: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """상태 변경 감지"""
        changes = []
        
        for site in sites:
            site_id = site.get("site_id")
            current_status = site.get("status")
            previous_status = self._previous_states.get(site_id)
            
            if previous_status is not None and previous_status != current_status:
                changes.append({
                    "site_id": site_id,
                    "previous_status": previous_status,
                    "current_status": current_status,
                    "display_name": site.get("display_name"),
                    "error_message": site.get("error_message")
                })
                logger.info(f"📢 Site 상태 변경: {site_id} ({previous_status} → {current_status})")
            
            # 상태 캐시 업데이트
            self._previous_states[site_id] = current_status
        
        return changes
    
    async def start_periodic_broadcast(self, interval: int = None):
        """주기적 브로드캐스트 시작"""
        if interval:
            self.broadcast_interval = interval
        
        if self._running:
            logger.warning("⚠️ 이미 브로드캐스트 실행 중")
            return
        
        self._running = True
        logger.info(f"🔄 Health 브로드캐스트 시작 ({self.broadcast_interval}초 간격)")
        
        while self._running and self.connection_count > 0:
            await self.broadcast_health_update()
            await asyncio.sleep(self.broadcast_interval)
        
        self._running = False
        logger.info("⏹️ Health 브로드캐스트 중지")
    
    def stop_periodic_broadcast(self):
        """주기적 브로드캐스트 중지"""
        self._running = False
        logger.info("⏹️ Health 브로드캐스트 중지 요청")
    
    async def handle_client_message(self, websocket: WebSocket, message: str):
        """클라이언트 메시지 처리"""
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            
            if msg_type == HealthMessageType.PING:
                # Ping-Pong keep-alive
                await self._send_message(websocket, {
                    "type": HealthMessageType.PONG,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
            elif msg_type == "request_update":
                # 즉시 업데이트 요청
                health_data = await self.health_service.check_all_sites_health()
                await self._send_message(websocket, {
                    "type": HealthMessageType.UPDATE,
                    "data": health_data,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                logger.info("📡 클라이언트 요청에 의한 즉시 업데이트 전송")
                
            elif msg_type == "set_interval":
                # 브로드캐스트 간격 변경 (5초 ~ 5분)
                new_interval = data.get("interval", 30)
                if 5 <= new_interval <= 300:
                    self.broadcast_interval = new_interval
                    logger.info(f"📝 브로드캐스트 간격 변경: {new_interval}초")
                    await self._send_message(websocket, {
                        "type": "interval_changed",
                        "interval": new_interval,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                else:
                    await self._send_error(websocket, "Invalid interval. Must be between 5 and 300 seconds.")
                    
        except json.JSONDecodeError:
            logger.warning(f"⚠️ 잘못된 JSON 메시지: {message[:100]}")
        except Exception as e:
            logger.error(f"❌ 클라이언트 메시지 처리 실패: {e}")


# ============================================
# Global Manager Instance
# ============================================

health_manager = HealthStreamManager()


# ============================================
# WebSocket Endpoint Handler
# ============================================

async def health_websocket_endpoint(websocket: WebSocket):
    """
    WebSocket /ws/sites/health
    
    실시간 Site Health 상태를 스트리밍합니다.
    
    Message Types (Server → Client):
    - initial: 초기 연결 시 전체 상태
    - update: 정기 업데이트 (30초 간격)
    - site_change: Site 상태 변경 알림
    - error: 에러 메시지
    - pong: Keep-alive pong
    
    Message Types (Client → Server):
    - ping: Keep-alive ping
    - request_update: 즉시 업데이트 요청
    - set_interval: 브로드캐스트 간격 변경 (5-300초)
    """
    await health_manager.connect(websocket)
    
    # 첫 연결이면 브로드캐스트 시작
    if health_manager.connection_count == 1:
        asyncio.create_task(health_manager.start_periodic_broadcast())
    
    try:
        while True:
            # 클라이언트 메시지 수신 대기
            message = await websocket.receive_text()
            await health_manager.handle_client_message(websocket, message)
            
    except WebSocketDisconnect:
        health_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"❌ WebSocket 오류: {e}")
        health_manager.disconnect(websocket)


# ============================================
# Router Registration Helper
# ============================================

def register_health_websocket(app):
    """
    FastAPI 앱에 Health WebSocket 등록
    
    Usage:
        from api.websocket.health_stream import register_health_websocket
        register_health_websocket(app)
    """
    @app.websocket("/ws/sites/health")
    async def ws_health(websocket: WebSocket):
        await health_websocket_endpoint(websocket)
    
    logger.info("✅ Health WebSocket 등록: /ws/sites/health")