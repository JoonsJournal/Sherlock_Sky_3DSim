"""
uds.py
Unified Data Store Router
통합 데이터 스토어 API 엔드포인트

API Endpoints:
- GET  /api/uds/health                    : 서비스 상태 확인
- GET  /api/uds/initial                   : 전체 설비 초기 데이터 (배치 쿼리)
- GET  /api/uds/equipment/{frontend_id}   : 단일 설비 상세
- GET  /api/uds/stats                     : 현재 캐시 통계
- WS   /api/uds/stream                    : Delta Update 스트림
- POST /api/uds/refresh                   : 강제 갱신 (관리자)

@version 1.2.0
@changelog
- v1.2.0: 🔧 WebSocket 중복 로직 제거 (2026-01-21)
          - WebSocket 엔드포인트의 자체 Diff 루프 제거
          - Status Watcher 브로드캐스트만 사용
          - Ping/Pong은 클라이언트 메시지 수신 시에만 처리
          - ✅ 중복 쿼리 제거: N개 클라이언트 연결해도 1번만 쿼리
- v1.1.0: 🔧 site_id, line_id 파라미터 제거
- v1.0.0: 초기 버전

@dependencies
- FastAPI (APIRouter, WebSocket)
- services/uds/uds_service.py
- models/uds/uds_models.py

📁 위치: backend/api/routers/uds/uds.py
작성일: 2026-01-20
수정일: 2026-01-21
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import Optional, Set
from datetime import datetime
import logging
import asyncio
import os

# UDS 모델 Import
from ...models.uds.uds_models import (
    UDSInitialResponse,
    EquipmentData,
    StatusStats,
    BatchDeltaUpdate,
    DeltaUpdate
)

# UDS 서비스 Import
from ...services.uds.uds_service import uds_service

logger = logging.getLogger(__name__)


# =============================================================================
# Feature Flag
# =============================================================================
UDS_ENABLED = os.getenv('UDS_ENABLED', 'true').lower() == 'true'
UDS_POLL_INTERVAL = int(os.getenv('UDS_POLL_INTERVAL', '10'))  # 초 단위


# =============================================================================
# Router 설정
# =============================================================================
router = APIRouter(
    prefix="/api/uds",
    tags=["UDS - Unified Data Store"]
)


# =============================================================================
# WebSocket 연결 관리
# =============================================================================
class ConnectionManager:
    """
    WebSocket 연결 관리자
    
    [기능]
    - 클라이언트 연결/해제 관리
    - 브로드캐스트 메시지 전송 (Status Watcher에서 호출)
    - 연결 수 추적
    
    🔧 v1.2.0: 자체 Diff 루프 제거
    - WebSocket 엔드포인트는 클라이언트 메시지만 처리
    - Delta 업데이트는 Status Watcher가 broadcast_delta() 호출
    """
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        """새 클라이언트 연결"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"🔗 WebSocket connected (total: {len(self.active_connections)})")
    
    def disconnect(self, websocket: WebSocket):
        """클라이언트 연결 해제"""
        self.active_connections.discard(websocket)
        logger.info(f"🔌 WebSocket disconnected (total: {len(self.active_connections)})")
    
    async def broadcast(self, message: dict):
        """
        모든 연결된 클라이언트에 메시지 전송
        
        Status Watcher의 broadcast_delta()에서 호출됨
        """
        if not self.active_connections:
            logger.debug("No active WebSocket connections to broadcast")
            return
        
        disconnected = set()
        sent_count = 0
        
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.warning(f"⚠️ Failed to send to client: {e}")
                disconnected.add(connection)
        
        # 실패한 연결 제거
        for conn in disconnected:
            self.active_connections.discard(conn)
        
        if sent_count > 0:
            logger.debug(f"📤 Broadcasted to {sent_count} clients")
    
    @property
    def count(self) -> int:
        """현재 연결 수"""
        return len(self.active_connections)


# 전역 연결 관리자
ws_manager = ConnectionManager()


# =============================================================================
# REST API Endpoints
# =============================================================================

@router.get("/health")
async def health_check():
    """
    UDS 헬스체크
    
    서비스 상태 및 연결 정보 반환.
    
    Returns:
        서비스 상태 정보
    """
    cache_info = uds_service.get_cache_info()
    
    return {
        "status": "ok",
        "service": "uds",
        "version": "1.2.0",
        "enabled": UDS_ENABLED,
        "architecture": "direct_mssql",
        "poll_interval_seconds": UDS_POLL_INTERVAL,
        "cache": {
            "cached_equipments": cache_info["cached_count"],
            "last_fetch": cache_info["last_fetch_time"]
        },
        "websocket": {
            "connected_clients": ws_manager.count
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/initial", response_model=UDSInitialResponse)
async def get_initial_data():
    """
    전체 설비 초기 데이터 조회 (배치 쿼리)
    
    Frontend 앱 시작 시 1회 호출.
    3D View, Ranking View 공통으로 사용.
    
    ⚠️ 사전 조건: /api/connections/connect로 사이트 연결 필요
    
    Returns:
        - equipments: 117개 설비 데이터
        - total_count: 전체 설비 수
        - stats: 상태별 통계
        - timestamp: 응답 생성 시간
        
    Example Response:
    ```json
    {
        "equipments": [...],
        "total_count": 117,
        "stats": {
            "RUN": 85,
            "IDLE": 20,
            "STOP": 8,
            "SUDDENSTOP": 2,
            "DISCONNECTED": 2,
            "TOTAL": 117
        },
        "timestamp": "2026-01-20T10:35:00Z"
    }
    ```
    """
    
    logger.info(f"📡 GET /api/uds/initial")
    
    if not UDS_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="UDS feature is disabled. Set UDS_ENABLED=true in .env"
        )
    
    try:
        # 배치 쿼리 실행 (sync 방식)
        equipments = uds_service.fetch_all_equipments()
        
        # 통계 계산
        stats = uds_service.calculate_stats(equipments)
        
        response = UDSInitialResponse(
            equipments=equipments,
            total_count=len(equipments),
            stats=stats,
            timestamp=datetime.utcnow()
        )
        
        logger.info(f"✅ Initial data loaded: {len(equipments)} equipments")
        return response
        
    except ConnectionError as e:
        logger.error(f"❌ DB Connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {str(e)}"
        )
    except Exception as e:
        logger.error(f"❌ Failed to load initial data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/equipment/{frontend_id}", response_model=EquipmentData)
async def get_equipment_detail(frontend_id: str):
    """
    단일 설비 상세 조회
    
    ⚠️ Note: Frontend에서는 UDS 캐시를 먼저 확인하고,
    캐시 미스 시에만 이 API를 호출해야 함.
    
    - **frontend_id**: Frontend ID (예: EQ-01-01)
    
    Returns:
        설비 상세 정보
        
    Raises:
        404: 설비를 찾을 수 없음
    """
    logger.info(f"📡 GET /api/uds/equipment/{frontend_id}")
    
    if not UDS_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="UDS feature is disabled"
        )
    
    try:
        equipment = uds_service.fetch_equipment_by_frontend_id(frontend_id)
        
        if not equipment:
            raise HTTPException(
                status_code=404,
                detail=f"Equipment not found: {frontend_id}"
            )
        
        return equipment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to fetch equipment {frontend_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/stats")
async def get_cache_stats():
    """
    현재 캐시 통계 조회
    
    디버깅/모니터링용 엔드포인트.
    
    Returns:
        캐시 상태 정보
    """
    cache_info = uds_service.get_cache_info()
    
    return {
        "status": "ok",
        "enabled": UDS_ENABLED,
        "cache": cache_info,
        "websocket_clients": ws_manager.count,
        "poll_interval_seconds": UDS_POLL_INTERVAL,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/remote-alarm-codes")
async def get_remote_alarm_codes():
    """
    Remote Alarm Code 목록 조회
    
    ref.RemoteAlarmList 테이블에서 Remote Alarm Code 목록 반환.
    Frontend에서 Remote 레인 분류에 사용.
    
    Returns:
        - codes: Remote Alarm Code 배열
        - count: 총 개수
        - timestamp: 응답 생성 시간
        
    Example Response:
```json
    {
        "codes": [61, 62, 86, 10047, 10048, 10051, 10052, 10055, 10056, 10057, 10058, 10077],
        "count": 12,
        "timestamp": "2026-01-24T10:35:00Z"
    }
```
    """
    logger.info("📡 GET /api/uds/remote-alarm-codes")
    
    if not UDS_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="UDS feature is disabled"
        )
    
    try:
        codes = uds_service.get_remote_alarm_codes()
        
        return {
            "codes": codes,
            "count": len(codes),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get Remote Alarm Codes: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/refresh")
async def refresh_cache():
    """
    캐시 강제 갱신 (관리자용)
    
    전체 설비 데이터를 다시 로드하고 In-Memory 캐시 갱신.
    일반적으로 사용할 필요 없음 (자동 동기화).
    
    ⚠️ 사전 조건: /api/connections/connect로 사이트 연결 필요
    
    Returns:
        갱신 결과
    """
    
    logger.info(f"🔄 POST /api/uds/refresh")
    
    if not UDS_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="UDS feature is disabled"
        )
    
    try:
        # 기존 캐시 클리어
        uds_service.clear_cache()
        
        # 새로 로드
        equipments = uds_service.fetch_all_equipments()
        
        return {
            "status": "ok",
            "refreshed_count": len(equipments),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Refresh failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Refresh failed: {str(e)}"
        )


# =============================================================================
# WebSocket Endpoint (🔧 v1.2.0: 자체 루프 제거)
# =============================================================================

@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket Delta Update 스트림
    
    🔧 v1.2.0 변경사항:
    - 자체 Diff 루프 제거 (중복 쿼리 방지)
    - Status Watcher의 broadcast_delta()만 사용
    - 클라이언트 메시지 수신 대기만 수행 (Ping/Pong, Manual Refresh)
    
    ⚠️ 사전 조건: /api/connections/connect로 사이트 연결 필요
    
    [연결 프로토콜]
    1. 클라이언트 연결 → accept → Welcome 메시지 전송
    2. Status Watcher가 10초마다 Diff 감지 → broadcast_delta() → 모든 클라이언트에 전송
    3. 클라이언트 Ping → Pong 응답 (Keep-alive)
    
    [메시지 타입]
    - Client → Server:
      - {"type": "ping"} : Keep-alive
      - {"type": "refresh"} : 수동 갱신 요청 (현재 캐시 상태 즉시 전송)
      
    - Server → Client:
      - {"type": "welcome", ...} : 연결 성공
      - {"type": "pong", "timestamp": "..."} : Ping 응답
      - {"type": "batch_delta", "updates": [...]} : 변경 데이터 (Status Watcher가 전송)
      - {"type": "current_state", "count": N} : 수동 갱신 응답
      - {"type": "error", "message": "..."} : 에러 메시지
    """
    
    if not UDS_ENABLED:
        await websocket.close(code=1008, reason="UDS feature is disabled")
        return
    
    await ws_manager.connect(websocket)
    
    try:
        # 연결 환영 메시지
        await websocket.send_json({
            "type": "welcome",
            "message": "Connected to UDS Stream",
            "poll_interval_seconds": UDS_POLL_INTERVAL,
            "architecture": "status_watcher_broadcast",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # 🔧 v1.2.0: 클라이언트 메시지만 대기 (자체 Diff 루프 제거)
        while True:
            # 클라이언트 메시지 수신 대기 (무한 대기)
            data = await websocket.receive_json()
            
            # ============================================================
            # Ping 처리
            # ============================================================
            if data.get('type') == 'ping':
                await websocket.send_json({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                })
                logger.debug("🏓 Pong sent")
            
            # ============================================================
            # 수동 Refresh 요청 처리
            # ============================================================
            elif data.get('type') == 'refresh':
                logger.info("🔄 Manual refresh requested via WebSocket")
                try:
                    # 현재 캐시 정보만 전송 (Diff는 Status Watcher가 담당)
                    cache_info = uds_service.get_cache_info()
                    
                    await websocket.send_json({
                        "type": "current_state",
                        "cached_count": cache_info["cached_count"],
                        "last_fetch": cache_info["last_fetch_time"],
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Refresh failed: {str(e)}",
                        "timestamp": datetime.utcnow().isoformat()
                    })
            
            # ============================================================
            # 알 수 없는 메시지 타입
            # ============================================================
            else:
                logger.warning(f"⚠️ Unknown message type: {data.get('type')}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {data.get('type')}",
                    "timestamp": datetime.utcnow().isoformat()
                })
                    
    except WebSocketDisconnect:
        logger.info("🔌 WebSocket client disconnected normally")
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)


# =============================================================================
# 브로드캐스트 헬퍼 (외부 모듈에서 호출용)
# =============================================================================

async def broadcast_delta(deltas: list):
    """
    Delta Update 브로드캐스트 (Status Watcher에서 호출)
    
    🔧 v1.2.0: 이 함수가 유일한 Delta 전송 경로
    - Status Watcher가 10초마다 Diff 감지
    - 변경 발생 시 이 함수 호출
    - 모든 연결된 WebSocket 클라이언트에 브로드캐스트
    
    Args:
        deltas: DeltaUpdate 목록
    """
    if not deltas:
        logger.debug("No delta updates to broadcast")
        return
    
    batch_update = BatchDeltaUpdate(
        updates=deltas,
        timestamp=datetime.utcnow()
    )
    
    message = {
        "type": "batch_delta",
        **batch_update.model_dump(mode='json')  # ← mode='json' 추가!
    }
    
    await ws_manager.broadcast(message)
    
    logger.info(f"📤 Broadcasted {len(deltas)} delta updates to {ws_manager.count} clients")


def get_connected_clients_count() -> int:
    """현재 연결된 WebSocket 클라이언트 수"""
    return ws_manager.count


# =============================================================================
# 연결된 클라이언트 목록 (Status Watcher용)
# =============================================================================
connected_clients = ws_manager.active_connections