"""
analytics/oee.py
OEE (Overall Equipment Effectiveness) 계산 라우터

@version 1.0.0
@changelog
- v1.0.0: analytics.py에서 분리
  - 실제 DB 스키마 (log.CycleTime, log.EquipmentState) 사용
  - Production Count는 CycleTime 레코드 개수로 계산
  - Quality는 현재 데이터로 계산 불가 → 100% 가정
  - ⚠️ 호환성: 기존 API 엔드포인트 /oee 유지

@description
OEE = Availability × Performance × Quality
- Availability: 가동 시간 / 계획 가동 시간 (log.EquipmentState 기반)
- Performance: 실제 생산량 / 이론 생산량 (log.CycleTime 기반)
- Quality: 양품 수 / 총 생산량 (데이터 없음 → 100% 가정)

@dependencies
- helpers: safe_divide, safe_percentage, get_default_date_range
- queries.production_queries: get_cycle_count_query, get_tact_time_query
- queries.status_queries: get_availability_summary_query

작성일: 2026-02-02
수정일: 2026-02-02
"""

from fastapi import APIRouter, Query
from typing import Optional
import logging

from .helpers import (
    safe_divide,
    safe_percentage,
    get_default_date_range,
    validate_calculation_period
)
from .queries.production_queries import (
    get_cycle_count_query,
    get_lot_production_query
)
from .queries.status_queries import (
    get_availability_summary_query
)
from ...database.connection import get_db_connection, return_db_connection
from ...utils.errors import (
    handle_errors,
    handle_db_error,
    ValidationError,
    NotFoundError
)

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# OEE 계산 상수
# ============================================================================

# 이론 Tact Time (초) - 설비별로 다르면 config에서 로드해야 함
THEORETICAL_TACT_TIME_SECONDS = 60.0

# Quality Rate 기본값 (품질 데이터 없을 때)
DEFAULT_QUALITY_RATE = 1.0  # 100%


# ============================================================================
# OEE 계산 엔드포인트
# ============================================================================

@router.get(
    "/oee",
    summary="OEE 계산",
    description="설비 종합 효율(OEE) 계산 - Availability × Performance × Quality"
)
@handle_errors
async def calculate_oee(
    equipment_id: Optional[int] = Query(
        None,
        description="설비 ID (DB PK). 없으면 전체 평균"
    ),
    frontend_id: Optional[str] = Query(
        None,
        description="Frontend ID (예: EQ-17-03). equipment_id 대신 사용 가능"
    ),
    start_date: Optional[str] = Query(
        None,
        description="시작 날짜 (ISO 8601 형식)"
    ),
    end_date: Optional[str] = Query(
        None,
        description="종료 날짜 (ISO 8601 형식)"
    ),
    include_components: bool = Query(
        default=True,
        description="OEE 구성 요소 (A, P, Q) 포함 여부"
    )
):
    """
    OEE (Overall Equipment Effectiveness) 계산
    
    🆕 v1.0.0: 실제 DB 스키마 기반 계산
    
    **계산 방식:**
    - Availability: log.EquipmentState의 RUNNING 상태 비율
    - Performance: (실제 Cycle 수 × 이론 Tact Time) / 가동 시간
    - Quality: 양품률 (현재 데이터 없음 → 100%)
    
    **Parameters:**
    - equipment_id: 설비 DB ID (정수)
    - frontend_id: Frontend ID (문자열, equipment_id 대신 사용)
    - start_date: 조회 시작 (ISO 8601)
    - end_date: 조회 종료 (ISO 8601)
    
    **Returns:**
    - oee: OEE 값 (0-100%)
    - components: Availability, Performance, Quality 각각의 값
    """
    logger.info(
        f"🚀 OEE 계산 시작: equipment_id={equipment_id}, "
        f"frontend_id={frontend_id}, start={start_date}, end={end_date}"
    )
    
    # 날짜 범위 설정 및 검증
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range(days=7)
        logger.debug(f"📅 기본 날짜 범위 사용: {start_date} ~ {end_date}")
    else:
        validate_calculation_period(start_date, end_date, max_days=90)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if equipment_id or frontend_id:
            # 특정 설비 OEE 계산
            result = await _calculate_single_equipment_oee(
                cursor=cursor,
                equipment_id=equipment_id,
                frontend_id=frontend_id,
                start_date=start_date,
                end_date=end_date,
                include_components=include_components
            )
        else:
            # 전체 설비 평균 OEE 계산
            result = await _calculate_all_equipment_oee(
                cursor=cursor,
                start_date=start_date,
                end_date=end_date
            )
        
        cursor.close()
        
        result["period"] = {"start": start_date, "end": end_date}
        
        logger.info(f"✅ OEE 계산 완료")
        return result
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        handle_db_error(e, "OEE 계산")
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 내부 계산 함수
# ============================================================================

async def _calculate_single_equipment_oee(
    cursor,
    equipment_id: Optional[int],
    frontend_id: Optional[str],
    start_date: str,
    end_date: str,
    include_components: bool
) -> dict:
    """
    단일 설비 OEE 계산
    
    SELECT 컬럼 인덱스:
    - Availability Query: 0=total, 1=running, 2=idle, 3=alarm
    - Cycle Count Query: 0=cycle_count
    """
    # TODO: frontend_id → equipment_id 변환 로직 (MappingService 사용)
    # 현재는 equipment_id 직접 사용
    
    if frontend_id and not equipment_id:
        # Mapping Service에서 변환 필요
        logger.warning(f"⚠️ frontend_id → equipment_id 변환 필요: {frontend_id}")
        # 임시로 에러 발생
        raise ValidationError(
            "frontend_id 사용 시 MappingService 연동 필요",
            field="frontend_id"
        )
    
    logger.debug(f"📊 단일 설비 OEE 계산: equipment_id={equipment_id}")
    
    # 1. Availability 계산 (상태 기반)
    cursor.execute(
        get_availability_summary_query(single_equipment=True),
        (equipment_id, start_date, end_date)
    )
    status_row = cursor.fetchone()
    
    if not status_row or status_row[0] is None or status_row[0] == 0:
        logger.warning(f"⚠️ 상태 데이터 없음: equipment_id={equipment_id}")
        return {
            "equipment_id": equipment_id,
            "oee": 0.0,
            "message": "해당 기간에 상태 데이터가 없습니다"
        }
    
    total_seconds = status_row[0] or 0
    running_seconds = status_row[1] or 0
    
    availability = safe_divide(running_seconds, total_seconds, 0.0)
    
    # 2. Cycle Count 조회 (생산량)
    cursor.execute(
        get_cycle_count_query(single_equipment=True),
        (equipment_id, start_date, end_date)
    )
    cycle_row = cursor.fetchone()
    cycle_count = cycle_row[0] if cycle_row else 0
    
    # 3. Performance 계산
    # Performance = (실제 Cycle 수 × 이론 Tact Time) / 가동 시간
    if running_seconds > 0:
        theoretical_cycles = running_seconds / THEORETICAL_TACT_TIME_SECONDS
        performance = safe_divide(cycle_count, theoretical_cycles, 0.0)
        # Performance는 1.0(100%)을 초과할 수 있음 → cap at 1.0
        performance = min(performance, 1.0)
    else:
        performance = 0.0
    
    # 4. Quality 계산 (현재 품질 데이터 없음 → 100%)
    quality = DEFAULT_QUALITY_RATE
    
    # 5. OEE 계산
    oee = availability * performance * quality
    
    logger.info(
        f"📈 OEE: {equipment_id} = {oee*100:.2f}% "
        f"(A:{availability*100:.2f}%, P:{performance*100:.2f}%, Q:{quality*100:.2f}%)"
    )
    
    result = {
        "equipment_id": equipment_id,
        "oee": round(oee * 100, 2),
        "cycle_count": cycle_count,
        "running_seconds": running_seconds,
        "total_seconds": total_seconds
    }
    
    if include_components:
        result["components"] = {
            "availability": round(availability * 100, 2),
            "performance": round(performance * 100, 2),
            "quality": round(quality * 100, 2)
        }
    
    return result


async def _calculate_all_equipment_oee(
    cursor,
    start_date: str,
    end_date: str
) -> dict:
    """
    전체 설비 평균 OEE 계산
    """
    logger.debug("📊 전체 설비 평균 OEE 계산")
    
    # 전체 설비 상태 데이터 조회
    cursor.execute(
        get_availability_summary_query(single_equipment=False),
        (start_date, end_date)
    )
    
    equipment_oees = []
    
    for row in cursor.fetchall():
        eq_id = row[0]
        total_seconds = row[1] or 0
        running_seconds = row[2] or 0
        
        if total_seconds == 0:
            continue
        
        availability = safe_divide(running_seconds, total_seconds, 0.0)
        
        # Cycle count 조회
        cursor.execute(
            get_cycle_count_query(single_equipment=True),
            (eq_id, start_date, end_date)
        )
        cycle_row = cursor.fetchone()
        cycle_count = cycle_row[0] if cycle_row else 0
        
        # Performance 계산
        if running_seconds > 0:
            theoretical_cycles = running_seconds / THEORETICAL_TACT_TIME_SECONDS
            performance = min(safe_divide(cycle_count, theoretical_cycles, 0.0), 1.0)
        else:
            performance = 0.0
        
        quality = DEFAULT_QUALITY_RATE
        oee = availability * performance * quality
        
        equipment_oees.append({
            "equipment_id": eq_id,
            "oee": round(oee * 100, 2),
            "availability": round(availability * 100, 2),
            "performance": round(performance * 100, 2),
            "quality": round(quality * 100, 2)
        })
    
    if not equipment_oees:
        logger.warning("⚠️ 전체 설비 OEE 데이터 없음")
        return {
            "average_oee": 0.0,
            "equipment_count": 0,
            "message": "해당 기간에 데이터가 없습니다"
        }
    
    # 평균 계산
    avg_oee = sum(e["oee"] for e in equipment_oees) / len(equipment_oees)
    
    logger.info(f"📈 전체 평균 OEE: {avg_oee:.2f}% ({len(equipment_oees)}개 설비)")
    
    return {
        "average_oee": round(avg_oee, 2),
        "equipment_count": len(equipment_oees),
        "equipment_oees": sorted(
            equipment_oees, 
            key=lambda x: x["oee"], 
            reverse=True
        )[:10]  # 상위 10개만
    }
