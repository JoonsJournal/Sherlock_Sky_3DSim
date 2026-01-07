"""
Equipment Detail API Router
설비 상세 정보 패널용 API 엔드포인트

API Endpoints:
- GET  /api/equipment/detail/{frontend_id} : 단일 설비 상세 정보
- POST /api/equipment/detail/multi        : 다중 설비 상세 정보 (집계)

@version 1.2.0
@changelog
- v1.2.0: Multi Selection에 equipment_ids 파라미터 추가 (Frontend 매핑 우선)
          MultiEquipmentDetailRequest 모델에 equipment_ids 필드 추가
- v1.1.0: equipment_id 쿼리 파라미터 추가 (Frontend 매핑 우선 사용)
- v1.0.0: 초기 버전

작성일: 2026-01-06
수정일: 2026-01-08
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
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
    equipment_id: Optional[int] = Query(None, description="Equipment ID (Frontend에서 전달, 우선 사용)"),
    site_id: Optional[str] = Query(None, description="Site ID (기본값: 현재 활성 사이트)"),
    local_db: Session = Depends(get_db)
):
    """
    단일 설비 상세 정보 조회
    
    - **frontend_id**: Frontend ID (예: EQ-17-03)
    - **equipment_id**: Equipment ID (옵션, Frontend에서 전달 시 우선 사용)
    - **site_id**: Site ID (옵션, 기본값: 현재 활성 사이트)
    
    🆕 v1.1.0: Frontend에서 equipment_id를 전달하면 Local DB 조회 없이 바로 사용
    (Frontend equipmentEditState와 Backend equipment_mapping 테이블 동기화 문제 해결)
    
    Returns:
        설비 상세 정보 (Line, Status, Product, Lot)
    """
    logger.info(f"📡 GET /equipment/detail/{frontend_id}" + 
                (f"?equipment_id={equipment_id}" if equipment_id else ""))
    
    # 🆕 v1.1.0: Frontend에서 equipment_id 전달받으면 그것 우선 사용
    if equipment_id is None:
        # Frontend에서 equipment_id가 없으면 Local DB에서 조회 (기존 방식)
        equipment_id = get_equipment_mapping(local_db, frontend_id)
        logger.debug(f"  📍 equipment_id from Local DB: {equipment_id}")
    else:
        logger.debug(f"  📍 equipment_id from Frontend: {equipment_id}")
    
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
            
            logger.info(f"✅ Equipment detail fetched: {frontend_id} -> eq_id={equipment_id}, status={response.status}")
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
    - **equipment_ids**: Equipment ID 목록 (옵션, Frontend에서 전달 시 우선 사용) 🆕 v1.2.0
    - **site_id**: Site ID (옵션, 기본값: 현재 활성 사이트)
    
    🆕 v1.2.0: Frontend에서 equipment_ids를 전달하면 Local DB 조회 없이 바로 사용
    (Frontend equipmentEditState와 Backend equipment_mapping 테이블 동기화 문제 해결)
    
    Returns:
        집계된 설비 정보:
        - Line 목록 (중복 제거, 최대 3개)
        - Status별 카운트
        - Product 목록 (중복 제거, 최대 3개)
        - Lot ID 목록 (중복 제거, 최대 3개)
    """
    logger.info(f"📡 POST /equipment/detail/multi - {len(request.frontend_ids)} frontend_ids" +
                (f", {len(request.equipment_ids)} equipment_ids" if request.equipment_ids else ""))
    
    # 🆕 v1.2.0: Frontend에서 equipment_ids 전달받으면 그것 우선 사용
    if request.equipment_ids and len(request.equipment_ids) > 0:
        # Frontend에서 equipment_ids가 있으면 직접 사용
        # frontend_id → equipment_id 매핑 생성
        frontend_to_equipment_map = {}
        
        # equipment_ids와 frontend_ids를 순서대로 매핑
        for i, equipment_id in enumerate(request.equipment_ids):
            if i < len(request.frontend_ids):
                frontend_to_equipment_map[request.frontend_ids[i]] = equipment_id
        
        logger.debug(f"  📍 Using equipment_ids from Frontend: {len(frontend_to_equipment_map)} mappings")
    else:
        # Frontend에서 equipment_ids가 없으면 Local DB에서 조회 (기존 방식)
        frontend_to_equipment_map = get_equipment_mappings_batch(
            local_db, 
            request.frontend_ids
        )
        logger.debug(f"  📍 Using equipment_ids from Local DB: {len(frontend_to_equipment_map)} mappings")
    
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
            
            logger.info(f"✅ Multi equipment detail fetched: {response.count} items, " +
                       f"lines={len(response.lines)}, status_counts={response.status_counts}")
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
        "version": "1.2.0",
        "timestamp": datetime.now().isoformat()
    }