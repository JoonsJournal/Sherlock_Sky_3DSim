"""
Status Stream WebSocket
실시간 설비 상태 변경 스트리밍

Phase 1: 신규 추가
기존 시스템에 영향 없는 독립 WebSocket
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring WebSocket"])


# ============================================
# WebSocket Connection Manager
# ============================================

class StatusStreamManager:
    """WebSocket 연결 관리 및 상태 스트리밍"""
    
    def __init__(self):
        # 활성 WebSocket 연결
        self.active_connections: Set[WebSocket] = set()
        
        # 클라이언트별 구독 설비 (WebSocket -> Set[equipment_id])
        self.subscriptions: Dict[WebSocket, Set[int]] = {}
        
        # 폴링 태스크
        self.polling_task = None
        self.polling_interval = 2  # 2초마다 폴링
        
        # 이전 상태 캐시 (equipment_id -> status)
        self.status_cache: Dict[int, str] = {}
        
        logger.info("🔌 StatusStreamManager initialized")
    
    async def connect(self, websocket: WebSocket):
        """클라이언트 연결"""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = set()
        
        logger.info(f"✓ WebSocket connected: {len(self.active_connections)} active")
        
        # 연결 성공 메시지 전송
        await websocket.send_json({
            "type": "connected",
            "message": "Monitoring stream connected",
            "timestamp": datetime.now().isoformat()
        })
    
    def disconnect(self, websocket: WebSocket):
        """클라이언트 연결 해제"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        
        logger.info(f"✓ WebSocket disconnected: {len(self.active_connections)} active")
    
    async def subscribe(self, websocket: WebSocket, equipment_ids: list):
        """특정 설비 구독"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(equipment_ids)
            
            await websocket.send_json({
                "type": "subscribed",
                "equipment_ids": equipment_ids,
                "message": f"{len(equipment_ids)} equipment subscribed",
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info(f"📡 Subscribed to {len(equipment_ids)} equipment")
    
    async def unsubscribe(self, websocket: WebSocket, equipment_ids: list):
        """특정 설비 구독 해제"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].difference_update(equipment_ids)
            
            await websocket.send_json({
                "type": "unsubscribed",
                "equipment_ids": equipment_ids,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info(f"📡 Unsubscribed from {len(equipment_ids)} equipment")
    
    async def broadcast(self, message: dict):
        """모든 연결된 클라이언트에게 메시지 전송"""
        disconnected = []
        
        for websocket in self.active_connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"❌ Broadcast failed: {e}")
                disconnected.append(websocket)
        
        # 연결 끊긴 클라이언트 제거
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def send_to_subscribed(self, equipment_id: int, message: dict):
        """특정 설비를 구독한 클라이언트에게만 전송"""
        disconnected = []
        
        for websocket in self.active_connections:
            # 구독 확인
            if equipment_id in self.subscriptions.get(websocket, set()):
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"❌ Send failed: {e}")
                    disconnected.append(websocket)
        
        # 연결 끊긴 클라이언트 제거
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def start_polling(self):
        """DB 폴링 시작"""
        if self.polling_task is None:
            self.polling_task = asyncio.create_task(self._poll_status_changes())
            logger.info("✓ Status polling started")
    
    async def stop_polling(self):
        """DB 폴링 중지"""
        if self.polling_task:
            self.polling_task.cancel()
            try:
                await self.polling_task
            except asyncio.CancelledError:
                pass
            self.polling_task = None
            logger.info("✓ Status polling stopped")
    
    async def _poll_status_changes(self):
        """
        DB에서 상태 변경 감지 (폴링 방식)
        
        Note: 실제 프로덕션에서는 DB Trigger나 Change Data Capture 사용 권장
        """
        logger.info("🔄 Starting status change polling...")
        
        try:
            while True:
                if len(self.active_connections) == 0:
                    # 연결된 클라이언트가 없으면 대기
                    await asyncio.sleep(self.polling_interval)
                    continue
                
                try:
                    # DB에서 현재 상태 조회
                    current_status = await self._fetch_current_status()
                    
                    # 변경 감지 및 전송
                    for equipment_id, status in current_status.items():
                        previous_status = self.status_cache.get(equipment_id)
                        
                        # 상태 변경 감지
                        if previous_status != status:
                            logger.info(
                                f"🔄 Status changed: Equipment {equipment_id} "
                                f"{previous_status} → {status}"
                            )
                            
                            # 변경 메시지 생성
                            message = {
                                "type": "equipment_status",
                                "equipment_id": equipment_id,
                                "status": status,
                                "previous_status": previous_status,
                                "timestamp": datetime.now().isoformat()
                            }
                            
                            # 구독자에게 전송
                            await self.send_to_subscribed(equipment_id, message)
                            
                            # 캐시 업데이트
                            self.status_cache[equipment_id] = status
                
                except Exception as e:
                    logger.error(f"❌ Polling error: {e}")
                
                # 대기
                await asyncio.sleep(self.polling_interval)
                
        except asyncio.CancelledError:
            logger.info("✓ Status polling cancelled")
        except Exception as e:
            logger.error(f"❌ Polling loop error: {e}")
    
    async def _fetch_current_status(self) -> Dict[int, str]:
        """
        DB에서 현재 설비 상태 조회
        
        Returns:
            dict: {equipment_id: status}
        """
        try:
            # ⭐ 기존 database 모듈 사용
            from ..database import connection_manager
            
            # 활성 연결 확인
            active_sites = connection_manager.get_active_connections()
            if not active_sites:
                return {}
            
            site_id = active_sites[0]
            conn_info = connection_manager.get_active_connection_info(site_id)
            db_name = conn_info.get('db_name', 'SherlockSky') if conn_info else 'SherlockSky'
            
            # 연결 가져오기
            conn = connection_manager.get_connection(site_id, db_name)
            if not conn:
                return {}
            
            # 쿼리 실행
            cursor = conn.cursor()
            
            query = """
                SELECT 
                    es.EquipmentID,
                    es.Status
                FROM log.EquipmentState es
                WHERE es.OccurredAtUtc = (
                    SELECT MAX(OccurredAtUtc)
                    FROM log.EquipmentState
                    WHERE EquipmentID = es.EquipmentID
                )
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            
            # 결과 변환
            status_dict = {row[0]: row[1] for row in rows}
            
            return status_dict
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch current status: {e}")
            return {}


# 싱글톤 인스턴스
stream_manager = StatusStreamManager()


# ============================================
# WebSocket Endpoint
# ============================================

@router.websocket("/stream")
async def equipment_status_stream(websocket: WebSocket):
    """
    실시간 설비 상태 스트림
    
    Phase 1: 신규 추가 WebSocket
    
    Protocol:
        Client -> Server:
            {
                "action": "subscribe",
                "equipment_ids": [1, 2, 3]
            }
            {
                "action": "unsubscribe",
                "equipment_ids": [1, 2]
            }
        
        Server -> Client:
            {
                "type": "equipment_status",
                "equipment_id": 1,
                "status": "RUN",
                "previous_status": "IDLE",
                "timestamp": "2025-12-29T12:00:00Z"
            }
    """
    logger.info("🔌 WebSocket connection attempt: /api/monitoring/stream")
    
    await stream_manager.connect(websocket)
    
    # 폴링 시작 (첫 연결 시)
    if len(stream_manager.active_connections) == 1:
        await stream_manager.start_polling()
    
    try:
        while True:
            # 클라이언트 메시지 수신
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                action = message.get("action")
                
                if action == "subscribe":
                    equipment_ids = message.get("equipment_ids", [])
                    await stream_manager.subscribe(websocket, equipment_ids)
                
                elif action == "unsubscribe":
                    equipment_ids = message.get("equipment_ids", [])
                    await stream_manager.unsubscribe(websocket, equipment_ids)
                
                elif action == "ping":
                    # Heartbeat
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    })
                
                else:
                    logger.warning(f"⚠️ Unknown action: {action}")
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Unknown action: {action}",
                        "timestamp": datetime.now().isoformat()
                    })
            
            except json.JSONDecodeError:
                logger.error(f"❌ Invalid JSON: {data}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format",
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        logger.info("🔌 WebSocket disconnected normally")
        stream_manager.disconnect(websocket)
        
        # 마지막 연결이 끊기면 폴링 중지
        if len(stream_manager.active_connections) == 0:
            await stream_manager.stop_polling()
    
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}", exc_info=True)
        stream_manager.disconnect(websocket)
        
        if len(stream_manager.active_connections) == 0:
            await stream_manager.stop_polling()