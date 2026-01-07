"""
Equipment Status API
설비 상태 조회 REST API

Phase 1: 신규 추가
기존 시스템에 영향 없는 독립 API

Phase 2: Monitoring Mode 초기 상태 API 추가 (2026-01-06)
- GET /api/monitoring/status/initial - 24시간 기준 초기 상태 조회
- threshold_hours 파라미터로 설정 가능
- DISCONNECTED 판별 로직 추가
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import json
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring"])


# ============================================
# Helper Functions
# ============================================

def load_equipment_mapping() -> Dict[int, str]:
    """
    Equipment Mapping 로드
    
    Returns:
        dict: {equipment_id: frontend_id}
    """
    mapping_file = 'config/equipment_mapping.json'
    
    if not os.path.exists(mapping_file):
        logger.warning(f"⚠️ Mapping file not found: {mapping_file}")
        return {}
    
    try:
        with open(mapping_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # frontend_id -> equipment_id 매핑을 equipment_id -> frontend_id로 변환
        mapping = {}
        for frontend_id, item in data.items():
            equipment_id = item.get('equipment_id')
            if equipment_id:
                mapping[equipment_id] = frontend_id
        
        logger.info(f"✓ Equipment mapping loaded: {len(mapping)} items")
        return mapping
        
    except Exception as e:
        logger.error(f"❌ Failed to load equipment mapping: {e}")
        return {}


def get_active_connection():
    """
    현재 활성화된 사이트의 DB 연결 가져오기
    
    Returns:
        tuple: (connection, site_id)
    
    Raises:
        HTTPException: 활성 연결이 없거나 연결 실패 시
    """
    try:
        # ⭐ 기존 database 모듈 사용
        from ..database import connection_manager
        
        logger.info("🔌 Attempting to get active database connection...")
        
        # 활성 연결 확인
        active_sites = connection_manager.get_active_connections()
        
        if not active_sites or len(active_sites) == 0:
            logger.warning("⚠️ No active database connections found")
            raise HTTPException(
                status_code=400,
                detail="No active database connection. Please connect to a site first."
            )
        
        # 첫 번째 활성 사이트 사용
        site_id = active_sites[0]
        
        logger.info(f"📡 Using site: {site_id}")
        
        # 활성 연결 정보 조회
        conn_info = connection_manager.get_active_connection_info(site_id)
        db_name = conn_info.get('db_name', 'SherlockSky') if conn_info else 'SherlockSky'
        
        # 연결 가져오기
        conn = connection_manager.get_connection(site_id, db_name)
        
        if not conn:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get connection for {site_id}/{db_name}"
            )
        
        logger.info(f"✅ Database connection acquired: {site_id}/{db_name}")
        
        return conn, site_id
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get database connection: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to database: {str(e)}"
        )


# ============================================
# API Endpoints
# ============================================

# ⭐ 중요: /status/initial 은 /status/{equipment_id} 보다 위에 배치해야 함
# FastAPI는 정의된 순서대로 경로를 매칭하므로, 
# /status/{equipment_id}가 먼저 있으면 "initial"이 equipment_id로 인식됨

@router.get("/status/initial")
async def get_initial_equipment_status(
    threshold_hours: int = Query(
        default=24, 
        ge=1, 
        le=168,  # 최대 7일
        description="DISCONNECTED 판별 기준 시간 (시간 단위, 기본 24시간)"
    )
):
    """
    🆕 Monitoring Mode 초기 상태 조회
    
    Monitoring Mode 진입 시 호출하여 각 설비의 최신 상태를 가져옴.
    threshold_hours 이내에 데이터가 없는 설비는 DISCONNECTED로 처리.
    
    Args:
        threshold_hours: DISCONNECTED 판별 기준 시간 (기본 24시간)
    
    Returns:
        dict: {
            "equipment": [
                {
                    "equipment_id": 1,
                    "frontend_id": "EQ-01-01",
                    "equipment_name": "Equipment 1",
                    "status": "RUN",           # RUN, IDLE, STOP, SUDDENSTOP 또는 null (DISCONNECTED)
                    "last_updated": "2025-01-06T10:00:00Z",
                    "is_connected": true       # threshold 이내 데이터 존재 여부
                },
                ...
            ],
            "summary": {
                "total": 117,
                "connected": 100,
                "disconnected": 17,
                "by_status": {
                    "RUN": 50,
                    "IDLE": 30,
                    "STOP": 15,
                    "SUDDENSTOP": 5,
                    "DISCONNECTED": 17
                }
            },
            "threshold_hours": 24,
            "request_time": "2025-01-06T12:00:00Z",
            "site_id": "korea_site"
        }
    """
    logger.info(f"📊 GET /api/monitoring/status/initial - 초기 상태 조회 (threshold: {threshold_hours}h)")
    
    conn = None
    cursor = None
    
    try:
        # DB 연결 가져오기
        conn, site_id = get_active_connection()
        
        # Equipment Mapping 로드
        equipment_mapping = load_equipment_mapping()
        
        # 현재 시간 (UTC)
        request_time = datetime.utcnow()
        
        # 커서 생성
        cursor = conn.cursor()
        
        # ============================================
        # 1️⃣ 전체 설비 목록 조회 (core.equipment)
        # ============================================
        all_equipment_query = """
            SELECT EquipmentID, EquipmentName
            FROM core.equipment
            ORDER BY EquipmentID
        """
        
        cursor.execute(all_equipment_query)
        all_equipment_rows = cursor.fetchall()
        
        # 전체 설비 딕셔너리 생성
        all_equipment = {
            row[0]: {
                "equipment_id": row[0],
                "equipment_name": row[1]
            }
            for row in all_equipment_rows
        }
        
        logger.info(f"📦 Total equipment in DB: {len(all_equipment)}")
        
        # ============================================
        # 2️⃣ threshold 시간 내 최신 상태 조회
        # ============================================
        # MSSQL: DATEADD, GETUTCDATE 사용
        # WITH CTE + ROW_NUMBER로 각 설비의 최신 상태만 추출
        
        status_query = f"""
            WITH LatestStatus AS (
                SELECT 
                    EquipmentID,
                    Status,
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentID 
                        ORDER BY OccurredAtUtc DESC
                    ) as rn
                FROM log.EquipmentState
                WHERE OccurredAtUtc >= DATEADD(HOUR, -{threshold_hours}, GETUTCDATE())
            )
            SELECT EquipmentID, Status, OccurredAtUtc
            FROM LatestStatus
            WHERE rn = 1
            ORDER BY EquipmentID
        """
        
        logger.debug(f"🔍 Executing status query with threshold: {threshold_hours} hours")
        
        cursor.execute(status_query)
        status_rows = cursor.fetchall()
        
        # 상태 데이터를 딕셔너리로 변환
        status_data = {
            row[0]: {
                "status": row[1],
                "last_updated": row[2]
            }
            for row in status_rows
        }
        
        logger.info(f"📦 Equipment with recent status: {len(status_data)}")
        
        # ============================================
        # 3️⃣ 결과 조합 (전체 설비 + 상태 정보)
        # ============================================
        equipment_list = []
        
        # 상태별 카운트
        status_counts = {
            "RUN": 0,
            "IDLE": 0,
            "STOP": 0,
            "SUDDENSTOP": 0,
            "DISCONNECTED": 0
        }
        
        connected_count = 0
        disconnected_count = 0
        
        for eq_id, eq_info in all_equipment.items():
            frontend_id = equipment_mapping.get(eq_id, f"EQ-UNKNOWN-{eq_id}")
            
            # 상태 데이터 확인
            if eq_id in status_data:
                # threshold 이내 데이터 있음 → Connected
                status_info = status_data[eq_id]
                status = status_info["status"]
                last_updated = status_info["last_updated"]
                is_connected = True
                
                connected_count += 1
                
                # 상태별 카운트
                if status in status_counts:
                    status_counts[status] += 1
                else:
                    # 알 수 없는 상태는 로깅만
                    logger.warning(f"⚠️ Unknown status '{status}' for equipment {eq_id}")
            else:
                # threshold 이내 데이터 없음 → Disconnected
                status = None
                last_updated = None
                is_connected = False
                
                disconnected_count += 1
                status_counts["DISCONNECTED"] += 1
            
            equipment_list.append({
                "equipment_id": eq_id,
                "frontend_id": frontend_id,
                "equipment_name": eq_info["equipment_name"],
                "status": status,
                "last_updated": last_updated.isoformat() if last_updated else None,
                "is_connected": is_connected
            })
        
        # ============================================
        # 4️⃣ 응답 생성
        # ============================================
        result = {
            "equipment": equipment_list,
            "summary": {
                "total": len(all_equipment),
                "connected": connected_count,
                "disconnected": disconnected_count,
                "by_status": status_counts
            },
            "threshold_hours": threshold_hours,
            "request_time": request_time.isoformat(),
            "site_id": site_id
        }
        
        logger.info(
            f"✅ 초기 상태 조회 성공: "
            f"Total={len(all_equipment)}, "
            f"Connected={connected_count}, "
            f"Disconnected={disconnected_count}"
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 초기 상태 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch initial equipment status: {str(e)}"
        )
        
    finally:
        if cursor:
            cursor.close()
            logger.debug("🔒 Cursor closed")


@router.get("/status")
async def get_all_equipment_status():
    """
    전체 설비 현재 상태 조회
    
    Phase 1: 신규 추가 엔드포인트
    
    ⚠️ 이 API는 24시간 제한 없이 가장 최근 상태를 반환합니다.
    Monitoring Mode 초기화에는 /status/initial 사용을 권장합니다.
    
    Returns:
        dict: {
            "equipment": [
                {
                    "equipment_id": 1,
                    "frontend_id": "EQ-01-01",
                    "equipment_name": "Equipment 1",
                    "status": "RUN",
                    "occurred_at": "2025-12-29T12:00:00Z"
                },
                ...
            ],
            "total": 117,
            "timestamp": "2025-12-29T12:00:05Z"
        }
    """
    logger.info("📊 GET /api/monitoring/status - 전체 설비 상태 조회 요청")
    
    conn = None
    cursor = None
    
    try:
        # DB 연결 가져오기
        conn, site_id = get_active_connection()
        
        # Equipment Mapping 로드
        equipment_mapping = load_equipment_mapping()
        
        # 커서 생성
        cursor = conn.cursor()
        
        # SQL 쿼리: log.EquipmentState의 최신 상태 조회
        query = """
            SELECT 
                es.EquipmentID,
                e.EquipmentName,
                es.Status,
                es.OccurredAtUtc
            FROM log.EquipmentState es
            INNER JOIN core.equipment e ON es.EquipmentID = e.EquipmentID
            WHERE es.OccurredAtUtc = (
                SELECT MAX(OccurredAtUtc)
                FROM log.EquipmentState
                WHERE EquipmentID = es.EquipmentID
            )
            ORDER BY es.EquipmentID
        """
        
        logger.debug(f"🔍 Executing query: {query.strip()}")
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        logger.info(f"📦 Fetched {len(rows)} equipment status records")
        
        # 결과 변환
        equipment_list = []
        for row in rows:
            equipment_id = row[0]
            equipment_name = row[1]
            status = row[2]
            occurred_at = row[3]
            
            # Frontend ID 매핑
            frontend_id = equipment_mapping.get(equipment_id, f"EQ-UNKNOWN-{equipment_id}")
            
            equipment_list.append({
                "equipment_id": equipment_id,
                "frontend_id": frontend_id,
                "equipment_name": equipment_name,
                "status": status,
                "occurred_at": occurred_at.isoformat() if occurred_at else None
            })
        
        result = {
            "equipment": equipment_list,
            "total": len(equipment_list),
            "site_id": site_id,
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"✅ 전체 설비 상태 조회 성공: {len(equipment_list)}개")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 전체 설비 상태 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch equipment status: {str(e)}"
        )
        
    finally:
        if cursor:
            cursor.close()
            logger.debug("🔒 Cursor closed")


@router.get("/status/{equipment_id}")
async def get_equipment_status_by_id(
    equipment_id: int,
    limit: int = Query(default=10, ge=1, le=100, description="조회할 이력 개수")
):
    """
    특정 설비 상태 조회 (최근 이력 포함)
    
    Phase 1: 신규 추가 엔드포인트
    
    Args:
        equipment_id: 설비 ID
        limit: 조회할 이력 개수 (기본 10개)
    
    Returns:
        dict: {
            "equipment_id": 1,
            "frontend_id": "EQ-01-01",
            "equipment_name": "Equipment 1",
            "current_status": "RUN",
            "history": [
                {
                    "status": "RUN",
                    "occurred_at": "2025-12-29T12:00:00Z"
                },
                ...
            ],
            "total_history": 10
        }
    """
    logger.info(f"📊 GET /api/monitoring/status/{equipment_id} - 설비 상태 조회 요청")
    
    conn = None
    cursor = None
    
    try:
        # DB 연결 가져오기
        conn, site_id = get_active_connection()
        
        # Equipment Mapping 로드
        equipment_mapping = load_equipment_mapping()
        
        # 커서 생성
        cursor = conn.cursor()
        
        # 1. 설비 정보 조회
        cursor.execute(
            "SELECT EquipmentName FROM core.equipment WHERE EquipmentID = %s",
            (equipment_id,)
        )
        
        equipment_row = cursor.fetchone()
        
        if not equipment_row:
            raise HTTPException(
                status_code=404,
                detail=f"Equipment {equipment_id} not found"
            )
        
        equipment_name = equipment_row[0]
        
        # 2. 상태 이력 조회
        # ✅ MSSQL용: TOP 사용 (LIMIT 대신)
        # ✅ pymssql용: %s placeholder 사용
        history_query = f"""
            SELECT TOP {limit} Status, OccurredAtUtc
            FROM log.EquipmentState
            WHERE EquipmentID = %s
            ORDER BY OccurredAtUtc DESC
        """
        
        cursor.execute(history_query, (equipment_id,))
        history_rows = cursor.fetchall()
        
        if not history_rows:
            raise HTTPException(
                status_code=404,
                detail=f"No status history found for equipment {equipment_id}"
            )
        
        # 결과 변환
        current_status = history_rows[0][0]
        
        history = [
            {
                "status": row[0],
                "occurred_at": row[1].isoformat() if row[1] else None
            }
            for row in history_rows
        ]
        
        frontend_id = equipment_mapping.get(equipment_id, f"EQ-UNKNOWN-{equipment_id}")
        
        result = {
            "equipment_id": equipment_id,
            "frontend_id": frontend_id,
            "equipment_name": equipment_name,
            "current_status": current_status,
            "history": history,
            "total_history": len(history),
            "site_id": site_id,
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"✅ 설비 {equipment_id} 상태 조회 성공: {len(history)}개 이력")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 설비 상태 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch equipment status: {str(e)}"
        )
        
    finally:
        if cursor:
            cursor.close()
            logger.debug("🔒 Cursor closed")


@router.get("/health")
async def monitoring_health_check():
    """
    Monitoring API 헬스체크
    
    Phase 1: 신규 추가 엔드포인트
    
    Returns:
        dict: {
            "status": "healthy",
            "timestamp": "2025-12-29T12:00:00Z",
            "database_connected": true,
            "mapping_loaded": true
        }
    """
    logger.info("💚 GET /api/monitoring/health - 헬스체크 요청")
    
    try:
        # DB 연결 확인
        conn, site_id = get_active_connection()
        database_connected = True
        
    except:
        database_connected = False
        site_id = None
    
    # Mapping 파일 확인
    mapping = load_equipment_mapping()
    mapping_loaded = len(mapping) > 0
    
    result = {
        "status": "healthy" if (database_connected and mapping_loaded) else "degraded",
        "timestamp": datetime.now().isoformat(),
        "database_connected": database_connected,
        "active_site": site_id,
        "mapping_loaded": mapping_loaded,
        "mapped_equipment_count": len(mapping)
    }
    
    logger.info(f"✅ 헬스체크 완료: {result['status']}")
    
    return result