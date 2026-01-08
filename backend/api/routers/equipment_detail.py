"""
Equipment Detail API Router
설비 상세 정보 패널용 API 엔드포인트

API Endpoints:
- GET  /api/equipment/detail/{frontend_id} : 단일 설비 상세 정보
- POST /api/equipment/detail/multi        : 다중 설비 상세 정보 (집계)

@version 1.4.0
@changelog
- v1.4.0: General Tab 확장 + PC Info Tab 구현
          - lot_start_time 필드 추가 (기존 lot_occurred_at 활용)
          - core.EquipmentPCInfo JOIN 추가 (1:1 관계)
          - log.EquipmentPCInfo JOIN 추가 (CPU 사용율)
          - Multi Selection: PC Info 집계 추가 (avg_cpu_usage_percent 등)
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
# ✅ v1.4.0: Raw SQL 쿼리 함수 (cursor 기반) - 확장
# ============================================================================

def fetch_equipment_detail_raw(conn, equipment_id: int) -> Optional[Dict]:
    """
    단일 설비 상세 정보 조회 (raw cursor)
    
    🆕 v1.4.0: PC Info 테이블 JOIN 추가
    - core.EquipmentPCInfo (1:1 관계 - 단순 JOIN)
    - log.EquipmentPCInfo (1:N - ROW_NUMBER로 최신 1개)
    
    Args:
        conn: DB Connection
        equipment_id: Equipment ID
    
    Returns:
        dict or None
    """
    cursor = None
    try:
        cursor = conn.cursor()
        
        # 🆕 v1.4.0: 확장된 SQL 쿼리
        query = """
            SELECT 
                -- 기본 정보 (core.Equipment)
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                
                -- 상태 정보 (log.EquipmentState) - 최신 1개
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                
                -- Lot 정보 (log.Lotinfo) - IsStart=1인 최신 1개
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt,
                
                -- 🆕 v1.4.0: PC 고정 정보 (core.EquipmentPCInfo) - 1:1 관계
                pc.CPUName,
                pc.CPULogicalCount,
                pc.GPUName,
                pc.OS AS OSName,
                pc.Architecture AS OSArchitecture,
                pc.LastBootTime,
                pc.UpdateAtUtc AS PCLastUpdateTime,
                
                -- 🆕 v1.4.0: PC 실시간 정보 (log.EquipmentPCInfo) - 최신 1개
                pcLog.CPUUsagePercent
                
            FROM core.Equipment e
            
            -- log.EquipmentState JOIN (최신 1개)
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
            
            -- 🆕 v1.4.0: core.EquipmentPCInfo JOIN (1:1 관계)
            LEFT JOIN core.EquipmentPCInfo pc 
                ON e.EquipmentId = pc.EquipmentId
            
            -- 🆕 v1.4.0: log.EquipmentPCInfo JOIN (최신 1개)
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
            
            WHERE e.EquipmentId = %d
        """
        
        cursor.execute(query, (equipment_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # 🆕 v1.4.0: 결과를 딕셔너리로 변환 (확장된 필드 포함)
        return {
            # 기본 정보
            'equipment_id': row[0],
            'equipment_name': row[1],
            'line_name': row[2],
            
            # 상태 정보
            'status': row[3],
            'status_occurred_at': row[4],
            
            # Lot 정보
            'product_model': row[5],
            'lot_id': row[6],
            'lot_occurred_at': row[7],  # 이것이 lot_start_time으로 사용됨
            
            # 🆕 v1.4.0: PC 고정 정보
            'cpu_name': row[8],
            'cpu_logical_count': row[9],
            'gpu_name': row[10],
            'os_name': row[11],
            'os_architecture': row[12],
            'last_boot_time': row[13],
            'pc_last_update_time': row[14],
            
            # 🆕 v1.4.0: PC 실시간 정보
            'cpu_usage_percent': float(row[15]) if row[15] is not None else None
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
    
    🆕 v1.4.0: PC Info 테이블 JOIN 추가
    
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
        
        # 🆕 v1.4.0: 확장된 SQL 쿼리
        query = f"""
            SELECT 
                -- 기본 정보 (core.Equipment)
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                
                -- 상태 정보 (log.EquipmentState) - 최신 1개
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                
                -- Lot 정보 (log.Lotinfo) - IsStart=1인 최신 1개
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt,
                
                -- 🆕 v1.4.0: PC 고정 정보 (core.EquipmentPCInfo)
                pc.CPUName,
                pc.CPULogicalCount,
                pc.GPUName,
                pc.OS AS OSName,
                pc.Architecture AS OSArchitecture,
                pc.LastBootTime,
                pc.UpdateAtUtc AS PCLastUpdateTime,
                
                -- 🆕 v1.4.0: PC 실시간 정보 (log.EquipmentPCInfo) - 최신 1개
                pcLog.CPUUsagePercent
                
            FROM core.Equipment e
            
            -- log.EquipmentState JOIN (최신 1개)
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
            
            -- 🆕 v1.4.0: core.EquipmentPCInfo JOIN (1:1 관계)
            LEFT JOIN core.EquipmentPCInfo pc 
                ON e.EquipmentId = pc.EquipmentId
            
            -- 🆕 v1.4.0: log.EquipmentPCInfo JOIN (최신 1개)
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
            
            WHERE e.EquipmentId IN ({placeholders})
        """
        
        cursor.execute(query, tuple(equipment_ids))
        rows = cursor.fetchall()
        
        # 🆕 v1.4.0: 결과를 딕셔너리 리스트로 변환 (확장된 필드 포함)
        result = []
        for row in rows:
            result.append({
                # 기본 정보
                'equipment_id': row[0],
                'equipment_name': row[1],
                'line_name': row[2],
                
                # 상태 정보
                'status': row[3],
                'status_occurred_at': row[4],
                
                # Lot 정보
                'product_model': row[5],
                'lot_id': row[6],
                'lot_occurred_at': row[7],
                
                # 🆕 v1.4.0: PC 고정 정보
                'cpu_name': row[8],
                'cpu_logical_count': row[9],
                'gpu_name': row[10],
                'os_name': row[11],
                'os_architecture': row[12],
                'last_boot_time': row[13],
                'pc_last_update_time': row[14],
                
                # 🆕 v1.4.0: PC 실시간 정보
                'cpu_usage_percent': float(row[15]) if row[15] is not None else None
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
    description="Frontend ID로 설비의 Line, Status, Product, Lot, PC Info 정보를 조회합니다."
)
@handle_errors
async def get_equipment_detail(
    frontend_id: str,
    equipment_id: Optional[int] = Query(None, description="Equipment ID (Frontend에서 전달, 우선 사용)")
):
    """
    단일 설비 상세 정보 조회
    
    🆕 v1.4.0: PC Info 필드 추가
    
    - **frontend_id**: Frontend ID (예: EQ-17-03)
    - **equipment_id**: Equipment ID (옵션, Frontend에서 전달 시 우선 사용)
    
    Returns:
        설비 상세 정보 (Line, Status, Product, Lot, PC Info)
    """
    logger.info(f"📡 GET /equipment/detail/{frontend_id}" + 
                (f"?equipment_id={equipment_id}" if equipment_id else ""))
    
    # equipment_id가 없으면 빈 응답 (🆕 v1.4.0: 신규 필드도 None으로)
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
            last_updated=None,
            # 🆕 v1.4.0: 신규 필드
            lot_start_time=None,
            cpu_name=None,
            cpu_logical_count=None,
            gpu_name=None,
            os_name=None,
            os_architecture=None,
            last_boot_time=None,
            pc_last_update_time=None,
            cpu_usage_percent=None
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
                last_updated=None,
                # 🆕 v1.4.0: 신규 필드
                lot_start_time=None,
                cpu_name=None,
                cpu_logical_count=None,
                gpu_name=None,
                os_name=None,
                os_architecture=None,
                last_boot_time=None,
                pc_last_update_time=None,
                cpu_usage_percent=None
            )
        
        # 마지막 업데이트 시간 결정
        last_updated = None
        if data.get('status_occurred_at') and data.get('lot_occurred_at'):
            last_updated = max(data['status_occurred_at'], data['lot_occurred_at'])
        elif data.get('status_occurred_at'):
            last_updated = data['status_occurred_at']
        elif data.get('lot_occurred_at'):
            last_updated = data['lot_occurred_at']
        
        # 🆕 v1.4.0: 확장된 응답 생성
        response = EquipmentDetailResponse(
            # 기본 정보 (기존 필드 - 호환성 유지)
            frontend_id=frontend_id,
            equipment_id=data['equipment_id'],
            equipment_name=data['equipment_name'],
            line_name=data['line_name'],
            status=data['status'],
            product_model=data['product_model'],
            lot_id=data['lot_id'],
            last_updated=last_updated,
            
            # 🆕 v1.4.0: General Tab 확장 - lot_start_time
            # lot_occurred_at이 IsStart=1인 시점이므로 그대로 사용
            lot_start_time=data['lot_occurred_at'],
            
            # 🆕 v1.4.0: PC Info Tab - 고정 정보
            cpu_name=data['cpu_name'],
            cpu_logical_count=data['cpu_logical_count'],
            gpu_name=data['gpu_name'],
            os_name=data['os_name'],
            os_architecture=data['os_architecture'],
            last_boot_time=data['last_boot_time'],
            pc_last_update_time=data['pc_last_update_time'],
            
            # 🆕 v1.4.0: PC Info Tab - 실시간 정보
            cpu_usage_percent=data['cpu_usage_percent']
        )
        
        logger.info(f"✅ Equipment detail fetched: {frontend_id} -> eq_id={equipment_id}, "
                   f"status={response.status}, cpu_usage={response.cpu_usage_percent}%")
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
    description="여러 설비의 Line, Status, Product, Lot, PC Info 정보를 집계하여 조회합니다."
)
@handle_errors
async def get_multi_equipment_detail(
    request: MultiEquipmentDetailRequest
):
    """
    다중 설비 상세 정보 조회 (집계)
    
    🆕 v1.4.0: PC Info 집계 필드 추가
    
    - **frontend_ids**: Frontend ID 목록 (최대 100개)
    - **equipment_ids**: Equipment ID 목록 (Frontend에서 전달)
    
    Returns:
        집계된 설비 정보 (PC Info 포함)
    """
    logger.info(f"📡 POST /equipment/detail/multi - {len(request.frontend_ids)} frontend_ids" +
                (f", {len(request.equipment_ids)} equipment_ids" if request.equipment_ids else ""))
    
    # equipment_ids가 없으면 빈 응답 (🆕 v1.4.0: PC Info 집계 필드도 기본값으로)
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
            lot_ids_more=False,
            # 🆕 v1.4.0: PC Info 집계
            avg_cpu_usage_percent=None,
            cpu_names=[],
            cpu_names_more=False,
            gpu_names=[],
            gpu_names_more=False,
            os_names=[],
            os_names_more=False
        )
    
    # ✅ v1.3.0: get_connection() 사용 (Monitoring과 동일)
    try:
        conn, site_id = get_active_site_connection()
        
        # Raw SQL로 조회
        data_list = fetch_multi_equipment_detail_raw(conn, request.equipment_ids)
        
        # 집계 (기존 필드)
        lines_set = set()
        status_counter: Dict[str, int] = {}
        products_set = set()
        lot_ids_set = set()
        
        # 🆕 v1.4.0: PC Info 집계
        cpu_names_set = set()
        gpu_names_set = set()
        os_names_set = set()
        cpu_usage_values: List[float] = []
        
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
            
            # 🆕 v1.4.0: PC Info 수집
            if data.get('cpu_name'):
                cpu_names_set.add(data['cpu_name'])
            
            if data.get('gpu_name'):
                gpu_names_set.add(data['gpu_name'])
            
            if data.get('os_name'):
                os_names_set.add(data['os_name'])
            
            if data.get('cpu_usage_percent') is not None:
                cpu_usage_values.append(data['cpu_usage_percent'])
        
        # 최대 3개 제한
        MAX_DISPLAY = 3
        lines = sorted(list(lines_set))
        products = sorted(list(products_set))
        lot_ids = sorted(list(lot_ids_set))
        
        # 🆕 v1.4.0: PC Info 정렬
        cpu_names = sorted(list(cpu_names_set))
        gpu_names = sorted(list(gpu_names_set))
        os_names = sorted(list(os_names_set))
        
        # 🆕 v1.4.0: CPU 사용율 평균 계산
        avg_cpu_usage = None
        if cpu_usage_values:
            avg_cpu_usage = round(sum(cpu_usage_values) / len(cpu_usage_values), 2)
        
        # 🆕 v1.4.0: 확장된 응답 생성
        response = MultiEquipmentDetailResponse(
            count=len(request.frontend_ids),
            
            # 기존 필드 (호환성 유지)
            lines=lines[:MAX_DISPLAY],
            lines_more=len(lines) > MAX_DISPLAY,
            status_counts=status_counter,
            products=products[:MAX_DISPLAY],
            products_more=len(products) > MAX_DISPLAY,
            lot_ids=lot_ids[:MAX_DISPLAY],
            lot_ids_more=len(lot_ids) > MAX_DISPLAY,
            
            # 🆕 v1.4.0: PC Info 집계
            avg_cpu_usage_percent=avg_cpu_usage,
            cpu_names=cpu_names[:MAX_DISPLAY],
            cpu_names_more=len(cpu_names) > MAX_DISPLAY,
            gpu_names=gpu_names[:MAX_DISPLAY],
            gpu_names_more=len(gpu_names) > MAX_DISPLAY,
            os_names=os_names[:MAX_DISPLAY],
            os_names_more=len(os_names) > MAX_DISPLAY
        )
        
        logger.info(f"✅ Multi equipment detail fetched: {response.count} items, "
                   f"lines={len(response.lines)}, status_counts={response.status_counts}, "
                   f"avg_cpu={response.avg_cpu_usage_percent}%")
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
        "version": "1.4.0",  # 🆕 버전 업데이트
        "timestamp": datetime.now().isoformat(),
        "features": {
            "general_tab": True,
            "pc_info_tab": True,  # 🆕 v1.4.0
            "lot_start_time": True,  # 🆕 v1.4.0
            "cpu_usage_gauge": True  # 🆕 v1.4.0
        }
    }