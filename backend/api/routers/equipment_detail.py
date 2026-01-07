"""
Equipment Detail API Router
설비 상세 정보 패널용 API 엔드포인트

API Endpoints:
- GET  /api/equipment/detail/{frontend_id} : 단일 설비 상세 정보
- POST /api/equipment/detail/multi        : 다중 설비 상세 정보 (집계)

작성일: 2026-01-06
"""

"""
Equipment Detail API Router
설비 상세 정보 패널용 API 엔드포인트
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
import logging

from sqlalchemy.orm import Session

# ✅ 수정: 패키지 레벨 import
from ..database import get_db, connection_manager
from ..services.equipment_detail_service import EquipmentDetailService
from ..models.equipment_detail import (
    EquipmentDetailResponse,
    MultiEquipmentDetailRequest,
    MultiEquipmentDetailResponse
)
from ..utils.errors import (
    handle_errors,
    NotFoundError,
    ValidationError,
    DatabaseError
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/equipment/detail",
    tags=["Equipment Detail"]
)


# ============================================================================
# 매핑 정보 조회 헬퍼 (equipment_mapping 테이블 사용)
# ============================================================================

def get_equipment_mapping(
    db: Session, 
    frontend_id: str
) -> Optional[int]:
    """
    Frontend ID로 Equipment ID 매핑 조회
    (Local DB의 equipment_mapping 테이블 사용)
    
    Args:
        db: Local DB 세션
        frontend_id: Frontend ID (예: 'EQ-17-03')
    
    Returns:
        equipment_id or None
    """
    from sqlalchemy import text
    
    query = text("""
        SELECT equipment_id 
        FROM equipment_mapping 
        WHERE frontend_id = :frontend_id
    """)
    
    try:
        result = db.execute(query, {"frontend_id": frontend_id})
        row = result.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.error(f"❌ Failed to get mapping for {frontend_id}: {e}")
        return None


def get_equipment_mappings_batch(
    db: Session,
    frontend_ids: list
) -> dict:
    """
    다중 Frontend ID로 Equipment ID 매핑 일괄 조회
    
    Args:
        db: Local DB 세션
        frontend_ids: Frontend ID 목록
    
    Returns:
        {frontend_id: equipment_id} 딕셔너리
    """
    from sqlalchemy import text
    
    if not frontend_ids:
        return {}
    
    placeholders = ", ".join([f":id_{i}" for i in range(len(frontend_ids))])
    query = text(f"""
        SELECT frontend_id, equipment_id 
        FROM equipment_mapping 
        WHERE frontend_id IN ({placeholders})
    """)
    
    params = {f"id_{i}": fid for i, fid in enumerate(frontend_ids)}
    
    try:
        result = db.execute(query, params)
        rows = result.fetchall()
        return {row[0]: row[1] for row in rows}
    except Exception as e:
        logger.error(f"❌ Failed to get batch mappings: {e}")
        return {}


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
    site_id: Optional[str] = Query(None, description="Site ID (기본값: 현재 활성 사이트)"),
    local_db: Session = Depends(get_db)
):
    """
    단일 설비 상세 정보 조회
    
    - **frontend_id**: Frontend ID (예: EQ-17-03)
    - **site_id**: Site ID (옵션, 기본값: 현재 활성 사이트)
    
    Returns:
        설비 상세 정보 (Line, Status, Product, Lot)
    """
    logger.info(f"📡 GET /equipment/detail/{frontend_id}")
    
    # 1. Frontend ID → Equipment ID 매핑 조회 (Local DB)
    equipment_id = get_equipment_mapping(local_db, frontend_id)
    
    if equipment_id is None:
        logger.warning(f"⚠️ No mapping found for: {frontend_id}")
        # 매핑이 없어도 빈 응답 반환 (에러 아님)
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
    
    # 2. Site DB에서 상세 정보 조회
    try:
        # Site DB 세션 가져오기
        site_db = connection_manager.get_session(site_id=site_id, db_name="site")
        
        try:
            service = EquipmentDetailService(site_db)
            response = service.get_equipment_detail_response(frontend_id, equipment_id)
            
            logger.info(f"✅ Equipment detail fetched: {frontend_id} -> {response.status}")
            return response
            
        finally:
            site_db.close()
            
    except ConnectionError as e:
        logger.error(f"❌ Site DB connection error: {e}")
        raise DatabaseError(
            message=f"Site DB 연결 실패: {str(e)}",
            details={"site_id": site_id}
        )


@router.post(
    "/multi",
    response_model=MultiEquipmentDetailResponse,
    summary="다중 설비 상세 정보 조회 (집계)",
    description="여러 설비의 Line, Status, Product, Lot 정보를 집계하여 조회합니다."
)
@handle_errors
async def get_multi_equipment_detail(
    request: MultiEquipmentDetailRequest,
    site_id: Optional[str] = Query(None, description="Site ID (기본값: 현재 활성 사이트)"),
    local_db: Session = Depends(get_db)
):
    """
    다중 설비 상세 정보 조회 (집계)
    
    - **frontend_ids**: Frontend ID 목록 (최대 100개)
    - **site_id**: Site ID (옵션, 기본값: 현재 활성 사이트)
    
    Returns:
        집계된 설비 정보:
        - Line 목록 (중복 제거, 최대 3개)
        - Status별 카운트
        - Product 목록 (중복 제거, 최대 3개)
        - Lot ID 목록 (중복 제거, 최대 3개)
    """
    logger.info(f"📡 POST /equipment/detail/multi - {len(request.frontend_ids)} items")
    
    # 1. Frontend IDs → Equipment IDs 매핑 일괄 조회 (Local DB)
    frontend_to_equipment_map = get_equipment_mappings_batch(
        local_db, 
        request.frontend_ids
    )
    
    if not frontend_to_equipment_map:
        logger.warning("⚠️ No mappings found for any frontend_ids")
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
    
    # 2. Site DB에서 상세 정보 집계
    try:
        site_db = connection_manager.get_session(site_id=site_id, db_name="site")
        
        try:
            service = EquipmentDetailService(site_db)
            response = service.get_multi_equipment_detail_response(frontend_to_equipment_map)
            
            logger.info(f"✅ Multi equipment detail fetched: {response.count} items")
            return response
            
        finally:
            site_db.close()
            
    except ConnectionError as e:
        logger.error(f"❌ Site DB connection error: {e}")
        raise DatabaseError(
            message=f"Site DB 연결 실패: {str(e)}",
            details={"site_id": site_id}
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
        "timestamp": datetime.now().isoformat()
    }