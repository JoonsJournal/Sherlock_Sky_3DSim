"""
router.py
Equipment Detail API 엔드포인트

@version 2.3.0
@changelog
- v2.3.0: 파일 분리 리팩토링
  - queries/: SQL 쿼리 함수 분리
  - helpers/: 헬퍼 함수 분리
  - ⚠️ 호환성: 기존 API 100% 유지

작성일: 2026-02-01
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict
from datetime import datetime
import logging

# 분리된 모듈에서 import
from .helpers.connection_helper import get_active_site_connection
from .queries.single_equipment import fetch_equipment_detail_raw
from .queries.multi_equipment import fetch_multi_equipment_detail_raw
from .queries.production_tact import (
    fetch_production_count,
    fetch_tact_time,
    fetch_production_and_tact_batch
)

# 모델 및 에러 처리
from ...models.equipment_detail import (
    EquipmentDetailResponse,
    MultiEquipmentDetailRequest,
    MultiEquipmentDetailResponse
)
from ...utils.errors import handle_errors, DatabaseError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/equipment/detail",
    tags=["Equipment Detail"]
)


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health", summary="Equipment Detail API 헬스체크")
async def health_check():
    """Equipment Detail API 헬스체크"""
    return {
        "status": "ok",
        "service": "equipment-detail",
        "version": "2.3.0",  # 분리 리팩토링 버전
        "timestamp": datetime.now().isoformat(),
        "features": {
            "general_tab": True,
            "pc_info_tab": True,
            "lot_start_time": True,
            "cpu_usage_gauge": True,
            "lot_active_inactive": True,
            "since_time": True,
            "memory_gauge": True,
            "disk_c_gauge": True,
            "disk_d_gauge": True,
            "production_count": True,
            "tact_time": True,
            "nolock_optimized": True,
            "batch_query_optimized": True,
            "modular_architecture": True  # 🆕 v2.3.0
        }
    }


# ============================================================================
# Single Equipment Detail
# ============================================================================

@router.get(
    "/{frontend_id}",
    response_model=EquipmentDetailResponse,
    summary="단일 설비 상세 정보 조회"
)
@handle_errors
async def get_equipment_detail(
    frontend_id: str,
    equipment_id: Optional[int] = Query(None, description="Equipment ID")
):
    """단일 설비 상세 정보 조회"""
    logger.info(f"📡 GET /equipment/detail/{frontend_id}" + 
                (f"?equipment_id={equipment_id}" if equipment_id else ""))
    
    # equipment_id가 없으면 빈 응답
    if equipment_id is None:
        logger.warning(f"⚠️ No equipment_id provided for: {frontend_id}")
        return _empty_single_response(frontend_id)
    
    try:
        conn, site_id = get_active_site_connection()
        
        # Raw SQL로 조회
        data = fetch_equipment_detail_raw(conn, equipment_id)
        
        if not data:
            logger.warning(f"⚠️ Equipment not found in DB: {equipment_id}")
            return _empty_single_response(frontend_id, equipment_id)
        
        # 마지막 업데이트 시간 결정
        last_updated = _determine_last_updated(data)
        
        # Production Count & Tact Time 조회
        production_count = None
        tact_time_seconds = None
        
        if data['is_lot_active'] and data['lot_start_time']:
            production_count = fetch_production_count(conn, equipment_id, data['lot_start_time'])
        
        tact_time_seconds = fetch_tact_time(conn, equipment_id)
        
        # 응답 생성
        response = EquipmentDetailResponse(
            frontend_id=frontend_id,
            equipment_id=data['equipment_id'],
            equipment_name=data['equipment_name'],
            line_name=data['line_name'],
            status=data['status'],
            product_model=data['product_model'],
            lot_id=data['lot_id'],
            last_updated=last_updated,
            is_lot_active=data['is_lot_active'],
            lot_start_time=data['lot_start_time'],
            since_time=data['since_time'],
            production_count=production_count,
            tact_time_seconds=tact_time_seconds,
            cpu_name=data['cpu_name'],
            cpu_logical_count=data['cpu_logical_count'],
            gpu_name=data['gpu_name'],
            os_name=data['os_name'],
            os_architecture=data['os_architecture'],
            last_boot_time=data['last_boot_time'],
            pc_last_update_time=data['pc_last_update_time'],
            cpu_usage_percent=data['cpu_usage_percent'],
            memory_total_gb=data['memory_total_gb'],
            memory_used_gb=data['memory_used_gb'],
            disk_c_total_gb=data['disk_c_total_gb'],
            disk_c_used_gb=data['disk_c_used_gb'],
            disk_d_total_gb=data['disk_d_total_gb'],
            disk_d_used_gb=data['disk_d_used_gb']
        )
        
        logger.info(f"✅ Equipment detail fetched: {frontend_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get equipment detail: {e}", exc_info=True)
        raise DatabaseError(
            message=f"설비 상세 정보 조회 실패: {str(e)}",
            details={"frontend_id": frontend_id, "equipment_id": equipment_id}
        )


# ============================================================================
# Multi Equipment Detail
# ============================================================================

@router.post(
    "/multi",
    response_model=MultiEquipmentDetailResponse,
    summary="다중 설비 상세 정보 조회 (집계)"
)
@handle_errors
async def get_multi_equipment_detail(request: MultiEquipmentDetailRequest):
    """다중 설비 상세 정보 조회 (집계)"""
    logger.info(f"📡 POST /equipment/detail/multi - {len(request.frontend_ids)} frontend_ids")
    
    if not request.equipment_ids or len(request.equipment_ids) == 0:
        logger.warning("⚠️ No equipment_ids provided")
        return _empty_multi_response(len(request.frontend_ids))
    
    try:
        conn, site_id = get_active_site_connection()
        
        # Raw SQL로 조회
        data_list = fetch_multi_equipment_detail_raw(conn, request.equipment_ids)
        
        # 집계 수행
        aggregated = _aggregate_multi_data(data_list)
        
        # Batch Query로 Production & Tact Time 일괄 조회
        prod_tact_data = fetch_production_and_tact_batch(
            conn, 
            request.equipment_ids, 
            aggregated['lot_start_times']
        )
        
        # Production 합계 & Tact Time 평균 계산
        production_total, tact_time_avg = _calculate_production_tact_summary(prod_tact_data)
        
        # 응답 생성
        response = _build_multi_response(
            count=len(request.frontend_ids),
            aggregated=aggregated,
            production_total=production_total,
            tact_time_avg=tact_time_avg
        )
        
        logger.info(f"✅ Multi equipment detail fetched: {response.count} items")
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
# Helper Functions (router 내부용)
# ============================================================================

def _empty_single_response(frontend_id: str, equipment_id: Optional[int] = None):
    """빈 Single 응답 생성"""
    return EquipmentDetailResponse(
        frontend_id=frontend_id,
        equipment_id=equipment_id,
        equipment_name=None, line_name=None, status=None,
        product_model=None, lot_id=None, last_updated=None,
        is_lot_active=False, lot_start_time=None, since_time=None,
        production_count=None, tact_time_seconds=None,
        cpu_name=None, cpu_logical_count=None, gpu_name=None,
        os_name=None, os_architecture=None, last_boot_time=None,
        pc_last_update_time=None, cpu_usage_percent=None,
        memory_total_gb=None, memory_used_gb=None,
        disk_c_total_gb=None, disk_c_used_gb=None,
        disk_d_total_gb=None, disk_d_used_gb=None
    )


def _empty_multi_response(count: int):
    """빈 Multi 응답 생성"""
    return MultiEquipmentDetailResponse(
        count=count,
        lines=[], lines_more=False,
        status_counts={},
        products=[], products_more=False,
        lot_ids=[], lot_ids_more=False,
        production_total=None, tact_time_avg=None,
        avg_cpu_usage_percent=None,
        avg_memory_usage_percent=None,
        avg_disk_c_usage_percent=None,
        avg_disk_d_usage_percent=None,
        cpu_names=[], cpu_names_more=False,
        gpu_names=[], gpu_names_more=False,
        os_names=[], os_names_more=False
    )


def _determine_last_updated(data: Dict):
    """마지막 업데이트 시간 결정"""
    if data.get('status_occurred_at') and data.get('lot_occurred_at'):
        return max(data['status_occurred_at'], data['lot_occurred_at'])
    elif data.get('status_occurred_at'):
        return data['status_occurred_at']
    elif data.get('lot_occurred_at'):
        return data['lot_occurred_at']
    return None


def _aggregate_multi_data(data_list: List[Dict]) -> Dict:
    """다중 설비 데이터 집계"""
    lines_set = set()
    status_counter: Dict[str, int] = {}
    products_set = set()
    lot_ids_set = set()
    cpu_names_set = set()
    gpu_names_set = set()
    os_names_set = set()
    cpu_usage_values: List[float] = []
    memory_usage_values: List[float] = []
    disk_c_usage_values: List[float] = []
    disk_d_usage_values: List[float] = []
    lot_start_times: Dict[int, datetime] = {}
    
    for data in data_list:
        if data.get('line_name'):
            lines_set.add(data['line_name'])
        
        if data.get('status'):
            status = data['status']
            status_counter[status] = status_counter.get(status, 0) + 1
        
        if data.get('product_model'):
            products_set.add(data['product_model'])
        
        if data.get('lot_id'):
            lot_ids_set.add(data['lot_id'])
        
        if data.get('lot_occurred_at'):
            lot_start_times[data['equipment_id']] = data['lot_occurred_at']
        
        if data.get('cpu_name'):
            cpu_names_set.add(data['cpu_name'])
        
        if data.get('gpu_name'):
            gpu_names_set.add(data['gpu_name'])
        
        if data.get('os_name'):
            os_names_set.add(data['os_name'])
        
        if data.get('cpu_usage_percent') is not None:
            cpu_usage_values.append(data['cpu_usage_percent'])
        
        if data.get('memory_total_gb') and data.get('memory_used_gb') and data['memory_total_gb'] > 0:
            memory_percent = (data['memory_used_gb'] / data['memory_total_gb']) * 100
            memory_usage_values.append(memory_percent)
        
        if data.get('disk_c_total_gb') and data.get('disk_c_used_gb') and data['disk_c_total_gb'] > 0:
            disk_c_percent = (data['disk_c_used_gb'] / data['disk_c_total_gb']) * 100
            disk_c_usage_values.append(disk_c_percent)
        
        if data.get('disk_d_total_gb') and data.get('disk_d_used_gb') and data['disk_d_total_gb'] > 0:
            disk_d_percent = (data['disk_d_used_gb'] / data['disk_d_total_gb']) * 100
            disk_d_usage_values.append(disk_d_percent)
    
    return {
        'lines': sorted(list(lines_set)),
        'status_counter': status_counter,
        'products': sorted(list(products_set)),
        'lot_ids': sorted(list(lot_ids_set)),
        'cpu_names': sorted(list(cpu_names_set)),
        'gpu_names': sorted(list(gpu_names_set)),
        'os_names': sorted(list(os_names_set)),
        'avg_cpu_usage': round(sum(cpu_usage_values) / len(cpu_usage_values), 1) if cpu_usage_values else None,
        'avg_memory_usage': round(sum(memory_usage_values) / len(memory_usage_values), 1) if memory_usage_values else None,
        'avg_disk_c_usage': round(sum(disk_c_usage_values) / len(disk_c_usage_values), 1) if disk_c_usage_values else None,
        'avg_disk_d_usage': round(sum(disk_d_usage_values) / len(disk_d_usage_values), 1) if disk_d_usage_values else None,
        'lot_start_times': lot_start_times
    }


def _calculate_production_tact_summary(prod_tact_data: Dict):
    """Production 합계 & Tact Time 평균 계산"""
    production_total = 0
    tact_time_values: List[float] = []
    
    for eq_id, pt_data in prod_tact_data.items():
        if pt_data.get('production_count') is not None:
            production_total += pt_data['production_count']
        
        if pt_data.get('tact_time_seconds') is not None:
            tact_time_values.append(pt_data['tact_time_seconds'])
    
    production_total = production_total if production_total > 0 else None
    tact_time_avg = round(sum(tact_time_values) / len(tact_time_values), 1) if tact_time_values else None
    
    return production_total, tact_time_avg


def _build_multi_response(count: int, aggregated: Dict, production_total, tact_time_avg):
    """Multi 응답 빌드"""
    MAX_DISPLAY = 3
    
    return MultiEquipmentDetailResponse(
        count=count,
        lines=aggregated['lines'][:MAX_DISPLAY],
        lines_more=len(aggregated['lines']) > MAX_DISPLAY,
        status_counts=aggregated['status_counter'],
        products=aggregated['products'][:MAX_DISPLAY],
        products_more=len(aggregated['products']) > MAX_DISPLAY,
        lot_ids=aggregated['lot_ids'][:MAX_DISPLAY],
        lot_ids_more=len(aggregated['lot_ids']) > MAX_DISPLAY,
        production_total=production_total,
        tact_time_avg=tact_time_avg,
        avg_cpu_usage_percent=aggregated['avg_cpu_usage'],
        avg_memory_usage_percent=aggregated['avg_memory_usage'],
        avg_disk_c_usage_percent=aggregated['avg_disk_c_usage'],
        avg_disk_d_usage_percent=aggregated['avg_disk_d_usage'],
        cpu_names=aggregated['cpu_names'][:MAX_DISPLAY],
        cpu_names_more=len(aggregated['cpu_names']) > MAX_DISPLAY,
        gpu_names=aggregated['gpu_names'][:MAX_DISPLAY],
        gpu_names_more=len(aggregated['gpu_names']) > MAX_DISPLAY,
        os_names=aggregated['os_names'][:MAX_DISPLAY],
        os_names_more=len(aggregated['os_names']) > MAX_DISPLAY
    )