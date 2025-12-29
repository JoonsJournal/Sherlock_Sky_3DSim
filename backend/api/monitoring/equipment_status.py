"""
Equipment Status API
설비 상태 조회 REST API

Phase 1: 신규 추가
기존 시스템에 영향 없는 독립 API
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Optional
from datetime import datetime
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

@router.get("/status")
async def get_all_equipment_status():
    """
    전체 설비 현재 상태 조회
    
    Phase 1: 신규 추가 엔드포인트
    
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