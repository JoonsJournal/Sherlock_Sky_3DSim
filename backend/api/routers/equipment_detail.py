"""
Equipment Detail API Router
설비 상세 정보 패널용 API 엔드포인트

API Endpoints:
- GET  /api/equipment/detail/{frontend_id} : 단일 설비 상세 정보
- POST /api/equipment/detail/multi        : 다중 설비 상세 정보 (집계)

@version 1.3.1
@changelog
- v1.3.1: MSSQL 플레이스홀더 수정 (? → %s, %d)
- v1.3.0: Development 모드 호환 - get_connection() 사용 (Monitoring과 동일 방식)
          SQLAlchemy Session 대신 raw cursor 사용
- v1.2.0: Multi Selection에 equipment_ids 파라미터 추가
- v1.1.0: equipment_id 쿼리 파라미터 추가
- v1.0.0: 초기 버전

작성일: 2026-01-06
수정일: 2026-01-08
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict
from datetime import datetime
import logging

# ✅ v1.3.0: database 모듈에서 connection_manager만 import
from ..database import connection_manager
from ..models.equipment_detail import (
    EquipmentDetailResponse,
    MultiEquipmentDetailRequest,
    MultiEquipmentDetailResponse
)
from ..utils.errors import (
    handle_errors,
    DatabaseError
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/equipment/detail",
    tags=["Equipment Detail"]
)


# ============================================================================
# ✅ v1.3.0: 활성 연결 가져오기 헬퍼 (Monitoring과 동일 방식)
# ============================================================================

def get_active_site_connection():
    """
    현재 활성화된 사이트의 DB 연결 가져오기
    
    Returns:
        tuple: (connection, site_id)
    
    Raises:
        HTTPException: 활성 연결이 없거나 연결 실패 시
    """
    try:
        logger.info("📡 Attempting to get active database connection...")
        
        # 활성 연결 확인
        active_sites = connection_manager.get_active_connections()
        
        logger.debug(f"Active sites: {active_sites}")
        
        # 활성 연결이 없으면 에러
        if not active_sites or len(active_sites) == 0:
            logger.warning("⚠️ No active database connections found")
            raise HTTPException(
                status_code=400,
                detail="No active database connection. Please connect to a site first."
            )
        
        # 첫 번째 활성 사이트 사용
        site_id = active_sites[0]
        
        logger.info(f"Using site: {site_id}")
        
        # 활성 연결 정보 조회 (DB 이름 가져오기)
        conn_info = connection_manager.get_active_connection_info(site_id)
        db_name = conn_info.get('db_name', 'SherlockSky') if conn_info else 'SherlockSky'
        
        logger.info(f"📌 Requesting connection: {site_id}/{db_name}")
        
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


# ============================================================================
# ✅ v1.3.0: Raw SQL 쿼리 함수 (cursor 기반)
# ============================================================================

def fetch_equipment_detail_raw(conn, equipment_id: int) -> Optional[Dict]:
    """
    단일 설비 상세 정보 조회 (raw cursor)
    
    Args:
        conn: DB Connection
        equipment_id: Equipment ID
    
    Returns:
        dict or None
    """
    cursor = None
    try:
        cursor = conn.cursor()
        
        query = """
            SELECT 
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt
            FROM core.Equipment e
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    Status, 
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentState
            ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
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
            WHERE e.EquipmentId = %d
        """
        
        cursor.execute(query, (equipment_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # 결과를 딕셔너리로 변환
        return {
            'equipment_id': row[0],
            'equipment_name': row[1],
            'line_name': row[2],
            'status': row[3],
            'status_occurred_at': row[4],
            'product_model': row[5],
            'lot_id': row[6],
            'lot_occurred_at': row[7]
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to fetch equipment detail: {e}")
        raise
    finally:
        if cursor:
            cursor.close()


def fetch_multi_equipment_detail_raw(conn, equipment_ids: List[int]) -> List[Dict]:
    """
    다중 설비 상세 정보 조회 (raw cursor)
    
    Args:
        conn: DB Connection
        equipment_ids: Equipment ID 목록
    
    Returns:
        List[dict]
    """
    if not equipment_ids:
        return []
    
    cursor = None
    try:
        cursor = conn.cursor()
        
        # IN 절 플레이스홀더 생성 (MSSQL은 %d 사용)
        placeholders = ", ".join(["%d" for _ in equipment_ids])
        
        query = f"""
            SELECT 
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt
            FROM core.Equipment e
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    Status, 
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentState
            ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
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
            WHERE e.EquipmentId IN ({placeholders})
        """
        
        cursor.execute(query, tuple(equipment_ids))
        rows = cursor.fetchall()
        
        # 결과를 딕셔너리 리스트로 변환
        result = []
        for row in rows:
            result.append({
                'equipment_id': row[0],
                'equipment_name': row[1],
                'line_name': row[2],
                'status': row[3],
                'status_occurred_at': row[4],
                'product_model': row[5],
                'lot_id': row[6],
                'lot_occurred_at': row[7]
            })
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Failed to fetch multi equipment detail: {e}")
        raise
    finally:
        if cursor:
            cursor.close()


# ============================================================================
# API Endpoints
# ============================================================================

@router.get(
    "/{frontend_id}",
    response_model=EquipmentDetailResponse,
    summary="단일 설비 상세 정보 조회",
    description="Frontend ID로 설비의 Line, Status, Product, Lot 정보를 조회합니다."
)
@handle_errors
async def get_equipment_detail(
    frontend_id: str,
    equipment_id: Optional[int] = Query(None, description="Equipment ID (Frontend에서 전달, 우선 사용)")
):
    """
    단일 설비 상세 정보 조회
    
    - **frontend_id**: Frontend ID (예: EQ-17-03)
    - **equipment_id**: Equipment ID (옵션, Frontend에서 전달 시 우선 사용)
    
    Returns:
        설비 상세 정보 (Line, Status, Product, Lot)
    """
    logger.info(f"📡 GET /equipment/detail/{frontend_id}" + 
                (f"?equipment_id={equipment_id}" if equipment_id else ""))
    
    # equipment_id가 없으면 빈 응답
    if equipment_id is None:
        logger.warning(f"⚠️ No equipment_id provided for: {frontend_id}")
        return EquipmentDetailResponse(
            frontend_id=frontend_id,
            equipment_id=None,
            equipment_name=None,
            line_name=None,
            status=None,
            product_model=None,
            lot_id=None,
            last_updated=None
        )
    
    # ✅ v1.3.0: get_connection() 사용 (Monitoring과 동일)
    try:
        conn, site_id = get_active_site_connection()
        
        # Raw SQL로 조회
        data = fetch_equipment_detail_raw(conn, equipment_id)
        
        if not data:
            logger.warning(f"⚠️ Equipment not found in DB: {equipment_id}")
            return EquipmentDetailResponse(
                frontend_id=frontend_id,
                equipment_id=equipment_id,
                equipment_name=None,
                line_name=None,
                status=None,
                product_model=None,
                lot_id=None,
                last_updated=None
            )
        
        # 마지막 업데이트 시간 결정
        last_updated = None
        if data.get('status_occurred_at') and data.get('lot_occurred_at'):
            last_updated = max(data['status_occurred_at'], data['lot_occurred_at'])
        elif data.get('status_occurred_at'):
            last_updated = data['status_occurred_at']
        elif data.get('lot_occurred_at'):
            last_updated = data['lot_occurred_at']
        
        response = EquipmentDetailResponse(
            frontend_id=frontend_id,
            equipment_id=data['equipment_id'],
            equipment_name=data['equipment_name'],
            line_name=data['line_name'],
            status=data['status'],
            product_model=data['product_model'],
            lot_id=data['lot_id'],
            last_updated=last_updated
        )
        
        logger.info(f"✅ Equipment detail fetched: {frontend_id} -> eq_id={equipment_id}, status={response.status}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get equipment detail: {e}", exc_info=True)
        raise DatabaseError(
            message=f"설비 상세 정보 조회 실패: {str(e)}",
            details={"frontend_id": frontend_id, "equipment_id": equipment_id}
        )


@router.post(
    "/multi",
    response_model=MultiEquipmentDetailResponse,
    summary="다중 설비 상세 정보 조회 (집계)",
    description="여러 설비의 Line, Status, Product, Lot 정보를 집계하여 조회합니다."
)
@handle_errors
async def get_multi_equipment_detail(
    request: MultiEquipmentDetailRequest
):
    """
    다중 설비 상세 정보 조회 (집계)
    
    - **frontend_ids**: Frontend ID 목록 (최대 100개)
    - **equipment_ids**: Equipment ID 목록 (Frontend에서 전달)
    
    Returns:
        집계된 설비 정보
    """
    logger.info(f"📡 POST /equipment/detail/multi - {len(request.frontend_ids)} frontend_ids" +
                (f", {len(request.equipment_ids)} equipment_ids" if request.equipment_ids else ""))
    
    # equipment_ids가 없으면 빈 응답
    if not request.equipment_ids or len(request.equipment_ids) == 0:
        logger.warning("⚠️ No equipment_ids provided")
        return MultiEquipmentDetailResponse(
            count=len(request.frontend_ids),
            lines=[],
            lines_more=False,
            status_counts={},
            products=[],
            products_more=False,
            lot_ids=[],
            lot_ids_more=False
        )
    
    # ✅ v1.3.0: get_connection() 사용 (Monitoring과 동일)
    try:
        conn, site_id = get_active_site_connection()
        
        # Raw SQL로 조회
        data_list = fetch_multi_equipment_detail_raw(conn, request.equipment_ids)
        
        # 집계
        lines_set = set()
        status_counter: Dict[str, int] = {}
        products_set = set()
        lot_ids_set = set()
        
        for data in data_list:
            # Line 수집
            if data.get('line_name'):
                lines_set.add(data['line_name'])
            
            # Status 카운트
            if data.get('status'):
                status = data['status']
                status_counter[status] = status_counter.get(status, 0) + 1
            
            # Product 수집
            if data.get('product_model'):
                products_set.add(data['product_model'])
            
            # Lot ID 수집
            if data.get('lot_id'):
                lot_ids_set.add(data['lot_id'])
        
        # 최대 3개 제한
        MAX_DISPLAY = 3
        lines = sorted(list(lines_set))
        products = sorted(list(products_set))
        lot_ids = sorted(list(lot_ids_set))
        
        response = MultiEquipmentDetailResponse(
            count=len(request.frontend_ids),
            lines=lines[:MAX_DISPLAY],
            lines_more=len(lines) > MAX_DISPLAY,
            status_counts=status_counter,
            products=products[:MAX_DISPLAY],
            products_more=len(products) > MAX_DISPLAY,
            lot_ids=lot_ids[:MAX_DISPLAY],
            lot_ids_more=len(lot_ids) > MAX_DISPLAY
        )
        
        logger.info(f"✅ Multi equipment detail fetched: {response.count} items, " +
                   f"lines={len(response.lines)}, status_counts={response.status_counts}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get multi equipment detail: {e}", exc_info=True)
        raise DatabaseError(
            message=f"다중 설비 상세 정보 조회 실패: {str(e)}",
            details={"count": len(request.frontend_ids)}
        )


# ============================================================================
# Health Check
# ============================================================================

@router.get(
    "/health",
    summary="Equipment Detail API 헬스체크"
)
async def health_check():
    """Equipment Detail API 헬스체크"""
    return {
        "status": "ok",
        "service": "equipment-detail",
        "version": "1.3.1",
        "timestamp": datetime.now().isoformat()
    }