"""
Status Stream WebSocket
실시간 설비 상태 변경 스트리밍

Phase 1: 신규 추가
기존 시스템에 영향 없는 독립 WebSocket

@version 2.0.0
@changelog
- v2.0.0: 메시지 확장 - Equipment Detail Info 지원
          - equipment_name, line_name 추가
          - product_model, lot_id, lot_start_time 추가
          - cpu_usage_percent 추가 (실시간 Gauge용)
          - 캐시 구조 확장 (상태 외 추가 정보 캐싱)
- v1.0.0: 초기 버전 - 기본 상태 변경 감지

작성일: 2026-01-06
수정일: 2026-01-08
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional, Any
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
    """WebSocket 연결 관리 및 상태 스트리밍
    
    🆕 v2.0.0: 확장된 메시지 지원
    - Equipment Detail Info 필드 추가
    - Lot 정보 (product_model, lot_id, lot_start_time)
    - PC Info (cpu_usage_percent)
    """
    
    def __init__(self):
        # 활성 WebSocket 연결
        self.active_connections: Set[WebSocket] = set()
        
        # 클라이언트별 구독 설비 (WebSocket -> Set[equipment_id])
        self.subscriptions: Dict[WebSocket, Set[int]] = {}
        
        # 폴링 태스크
        self.polling_task = None
        self.polling_interval = 2  # 2초마다 폴링
        
        # 🆕 v2.0.0: 확장된 상태 캐시 (equipment_id -> 전체 정보)
        self.status_cache: Dict[int, Dict[str, Any]] = {}
        
        logger.info("🔌 StatusStreamManager initialized (v2.0.0)")
    
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
            "version": "2.0.0",  # 🆕 버전 정보 추가
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
            
            # 🆕 v2.0.0: 구독 즉시 현재 상태 전송
            await self._send_initial_status(websocket, equipment_ids)
    
    async def _send_initial_status(self, websocket: WebSocket, equipment_ids: list):
        """🆕 v2.0.0: 구독 시 현재 상태 즉시 전송"""
        try:
            current_data = await self._fetch_current_status()
            
            for eq_id in equipment_ids:
                if eq_id in current_data:
                    data = current_data[eq_id]
                    message = {
                        "type": "equipment_status",
                        "equipment_id": eq_id,
                        "status": data.get('status'),
                        "previous_status": None,  # 초기 상태
                        
                        # 🆕 v2.0.0: 확장 필드
                        "equipment_name": data.get('equipment_name'),
                        "line_name": data.get('line_name'),
                        "product_model": data.get('product_model'),
                        "lot_id": data.get('lot_id'),
                        "lot_start_time": data.get('lot_start_time'),
                        "cpu_usage_percent": data.get('cpu_usage_percent'),
                        
                        "timestamp": datetime.now().isoformat(),
                        "is_initial": True  # 초기 데이터 표시
                    }
                    
                    await websocket.send_json(message)
                    
        except Exception as e:
            logger.error(f"❌ Failed to send initial status: {e}")
    
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
        
        🆕 v2.0.0: 확장된 변경 감지
        - Status 변경
        - Lot 정보 변경 (product_model, lot_id, lot_start_time)
        - CPU 사용율 변경 (일정 임계값 이상 변경 시)
        
        Note: 실제 프로덕션에서는 DB Trigger나 Change Data Capture 사용 권장
        """
        logger.info("🔄 Starting status change polling (v2.0.0)...")
        
        # CPU 사용율 변경 감지 임계값 (%)
        CPU_CHANGE_THRESHOLD = 5.0
        
        try:
            while True:
                if len(self.active_connections) == 0:
                    # 연결된 클라이언트가 없으면 대기
                    await asyncio.sleep(self.polling_interval)
                    continue
                
                try:
                    # DB에서 현재 상태 조회 (확장된 쿼리)
                    current_data = await self._fetch_current_status()
                    
                    # 변경 감지 및 전송
                    for equipment_id, data in current_data.items():
                        previous_data = self.status_cache.get(equipment_id, {})
                        
                        # 변경 감지 플래그
                        has_change = False
                        change_reasons = []
                        
                        # 1. Status 변경 감지
                        current_status = data.get('status')
                        previous_status = previous_data.get('status')
                        if previous_status != current_status:
                            has_change = True
                            change_reasons.append(f"status: {previous_status} → {current_status}")
                        
                        # 2. Lot 정보 변경 감지
                        current_lot = data.get('lot_id')
                        previous_lot = previous_data.get('lot_id')
                        if previous_lot != current_lot:
                            has_change = True
                            change_reasons.append(f"lot: {previous_lot} → {current_lot}")
                        
                        # 3. CPU 사용율 변경 감지 (임계값 이상)
                        current_cpu = data.get('cpu_usage_percent')
                        previous_cpu = previous_data.get('cpu_usage_percent')
                        if current_cpu is not None and previous_cpu is not None:
                            if abs(current_cpu - previous_cpu) >= CPU_CHANGE_THRESHOLD:
                                has_change = True
                                change_reasons.append(f"cpu: {previous_cpu}% → {current_cpu}%")
                        elif current_cpu is not None and previous_cpu is None:
                            has_change = True
                            change_reasons.append(f"cpu: None → {current_cpu}%")
                        
                        # 변경이 있으면 메시지 전송
                        if has_change:
                            logger.info(
                                f"🔄 Change detected: Equipment {equipment_id} - "
                                f"{', '.join(change_reasons)}"
                            )
                            
                            # 🆕 v2.0.0: 확장된 변경 메시지 생성
                            message = {
                                "type": "equipment_status",
                                "equipment_id": equipment_id,
                                
                                # 기본 상태 (호환성 유지)
                                "status": current_status,
                                "previous_status": previous_status,
                                
                                # 🆕 v2.0.0: 확장 필드 - Equipment Info
                                "equipment_name": data.get('equipment_name'),
                                "line_name": data.get('line_name'),
                                
                                # 🆕 v2.0.0: 확장 필드 - Lot Info
                                "product_model": data.get('product_model'),
                                "lot_id": data.get('lot_id'),
                                "lot_start_time": data.get('lot_start_time'),
                                
                                # 🆕 v2.0.0: 확장 필드 - PC Info
                                "cpu_usage_percent": data.get('cpu_usage_percent'),
                                
                                "timestamp": datetime.now().isoformat(),
                                "is_initial": False
                            }
                            
                            # 구독자에게 전송
                            await self.send_to_subscribed(equipment_id, message)
                            
                            # 캐시 업데이트
                            self.status_cache[equipment_id] = data
                
                except Exception as e:
                    logger.error(f"❌ Polling error: {e}")
                
                # 대기
                await asyncio.sleep(self.polling_interval)
                
        except asyncio.CancelledError:
            logger.info("✓ Status polling cancelled")
        except Exception as e:
            logger.error(f"❌ Polling loop error: {e}")
    
    async def _fetch_current_status(self) -> Dict[int, Dict[str, Any]]:
        """
        DB에서 현재 설비 상태 조회
        
        🆕 v2.0.0: 확장된 쿼리 - 모든 관련 테이블 JOIN
        
        Returns:
            dict: {equipment_id: {status, equipment_name, line_name, ...}}
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
            
            # 🆕 v2.0.0: 확장된 SQL 쿼리
            query = """
                SELECT 
                    -- 기본 정보 (core.Equipment)
                    e.EquipmentId,
                    e.EquipmentName,
                    e.LineName,
                    
                    -- 상태 정보 (log.EquipmentState) - 최신 1개
                    es.Status,
                    
                    -- Lot 정보 (log.Lotinfo) - IsStart=1인 최신 1개
                    li.ProductModel,
                    li.LotId,
                    li.OccurredAtUtc AS LotStartTime,
                    
                    -- PC 실시간 정보 (log.EquipmentPCInfo) - 최신 1개
                    pcLog.CPUUsagePercent
                    
                FROM core.Equipment e
                
                -- log.EquipmentState JOIN (최신 1개)
                LEFT JOIN (
                    SELECT 
                        EquipmentId, 
                        Status,
                        ROW_NUMBER() OVER (
                            PARTITION BY EquipmentId 
                            ORDER BY OccurredAtUtc DESC
                        ) AS rn
                    FROM log.EquipmentState
                ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
                
                -- log.Lotinfo JOIN (IsStart=1인 최신 1개)
                LEFT JOIN (
                    SELECT 
                        EquipmentId, 
                        ProductModel, 
                        LotId,
                        OccurredAtUtc,
                        ROW_NUMBER() OVER (
                            PARTITION BY EquipmentId 
                            ORDER BY OccurredAtUtc DESC
                        ) AS rn
                    FROM log.Lotinfo
                    WHERE IsStart = 1
                ) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
                
                -- log.EquipmentPCInfo JOIN (최신 1개)
                LEFT JOIN (
                    SELECT 
                        EquipmentId,
                        CPUUsagePercent,
                        ROW_NUMBER() OVER (
                            PARTITION BY EquipmentId 
                            ORDER BY OccurredAtUtc DESC
                        ) AS rn
                    FROM log.EquipmentPCInfo
                ) pcLog ON e.EquipmentId = pcLog.EquipmentId AND pcLog.rn = 1
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            
            # 🆕 v2.0.0: 확장된 결과 변환
            result = {}
            for row in rows:
                equipment_id = row[0]
                
                # lot_start_time ISO 형식 변환
                lot_start_time = None
                if row[6] is not None:
                    try:
                        lot_start_time = row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6])
                    except:
                        lot_start_time = str(row[6])
                
                result[equipment_id] = {
                    'status': row[3],
                    'equipment_name': row[1],
                    'line_name': row[2],
                    'product_model': row[4],
                    'lot_id': row[5],
                    'lot_start_time': lot_start_time,
                    'cpu_usage_percent': float(row[7]) if row[7] is not None else None
                }
            
            return result
            
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
    
    🆕 v2.0.0: 확장된 메시지 지원
    
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
        
        Server -> Client (v2.0.0 확장):
            {
                "type": "equipment_status",
                "equipment_id": 1,
                "status": "RUN",
                "previous_status": "IDLE",
                
                // 🆕 v2.0.0: 확장 필드
                "equipment_name": "CUT-001",
                "line_name": "Line-A",
                "product_model": "MODEL-X",
                "lot_id": "LOT-12345",
                "lot_start_time": "2026-01-08T10:30:00+08:00",
                "cpu_usage_percent": 45.2,
                
                "timestamp": "2026-01-08T12:00:00Z",
                "is_initial": false
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
                
                # 🆕 v2.0.0: 현재 상태 요청
                elif action == "get_status":
                    equipment_ids = message.get("equipment_ids", [])
                    await stream_manager._send_initial_status(websocket, equipment_ids)
                
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