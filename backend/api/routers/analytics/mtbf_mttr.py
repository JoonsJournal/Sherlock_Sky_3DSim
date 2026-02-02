"""
analytics/mtbf_mttr.py
MTBF/MTTR (Mean Time Between/To Repair) 계산 라우터

@version 1.0.0
@changelog
- v1.0.0: analytics.py에서 분리
  - 실제 DB 스키마 (log.AlarmEvent) 사용
  - IsSet 필드로 알람 ON/OFF 구분
  - ⚠️ 호환성: 기존 API 엔드포인트 /mtbf-mttr 유지

@description
- MTBF (Mean Time Between Failures): 평균 고장 간격
- MTTR (Mean Time To Repair): 평균 수리 시간
- Availability = MTBF / (MTBF + MTTR)

@dependencies
- helpers: safe_divide, safe_percentage, get_default_date_range
- queries.alarm_queries: get_mtbf_data_query, get_mttr_summary_query

작성일: 2026-02-02
수정일: 2026-02-02
"""

from fastapi import APIRouter, Query
from typing import Optional, List
import logging

from .helpers import (
    safe_divide,
    safe_percentage,
    get_default_date_range,
    calculate_period_hours,
    validate_calculation_period
)
from .queries.alarm_queries import (
    get_mtbf_data_query,
    get_mttr_summary_query,
    get_alarm_duration_query
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
# MTBF/MTTR 계산 엔드포인트
# ============================================================================

@router.get(
    "/mtbf-mttr",
    summary="MTBF/MTTR 계산",
    description="평균 고장 간격(MTBF)과 평균 수리 시간(MTTR) 계산"
)
@handle_errors
async def calculate_mtbf_mttr(
    equipment_id: Optional[int] = Query(
        None,
        description="설비 ID (DB PK)"
    ),
    frontend_id: Optional[str] = Query(
        None,
        description="Frontend ID (예: EQ-17-03)"
    ),
    start_date: Optional[str] = Query(
        None,
        description="시작 날짜 (ISO 8601)"
    ),
    end_date: Optional[str] = Query(
        None,
        description="종료 날짜 (ISO 8601)"
    ),
    include_details: bool = Query(
        default=False,
        description="개별 알람 상세 정보 포함 여부"
    )
):
    """
    MTBF/MTTR 계산
    
    🆕 v1.0.0: 실제 log.AlarmEvent 테이블 기반 계산
    
    **계산 방식:**
    - MTBF = 전체 가동 시간 / 고장 횟수
    - MTTR = 총 수리 시간 / 수리된 고장 횟수
    - Availability = MTBF / (MTBF + MTTR)
    
    **고장 정의:**
    - log.AlarmEvent에서 IsSet=1 (알람 발생) 레코드
    - 수리 완료 = 동일 AlarmCode의 IsSet=0 레코드
    
    **Parameters:**
    - equipment_id: 설비 DB ID
    - start_date: 조회 시작 일시
    - end_date: 조회 종료 일시
    - include_details: 개별 알람 상세 포함 여부
    """
    logger.info(
        f"🚀 MTBF/MTTR 계산 시작: equipment_id={equipment_id}, "
        f"frontend_id={frontend_id}"
    )
    
    # 날짜 범위 설정
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range(days=30)
    else:
        validate_calculation_period(start_date, end_date, max_days=365)
    
    # 기간 계산 (시간)
    period_hours = calculate_period_hours(start_date, end_date)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if equipment_id or frontend_id:
            # 특정 설비 MTBF/MTTR
            result = await _calculate_single_equipment_mtbf_mttr(
                cursor=cursor,
                equipment_id=equipment_id,
                frontend_id=frontend_id,
                start_date=start_date,
                end_date=end_date,
                period_hours=period_hours,
                include_details=include_details
            )
        else:
            # 전체 설비 평균
            result = await _calculate_all_equipment_mtbf_mttr(
                cursor=cursor,
                start_date=start_date,
                end_date=end_date,
                period_hours=period_hours
            )
        
        cursor.close()
        
        result["period"] = {
            "start": start_date,
            "end": end_date,
            "hours": round(period_hours, 2)
        }
        
        logger.info(f"✅ MTBF/MTTR 계산 완료")
        return result
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        handle_db_error(e, "MTBF/MTTR 계산")
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 내부 계산 함수
# ============================================================================

async def _calculate_single_equipment_mtbf_mttr(
    cursor,
    equipment_id: Optional[int],
    frontend_id: Optional[str],
    start_date: str,
    end_date: str,
    period_hours: float,
    include_details: bool
) -> dict:
    """
    단일 설비 MTBF/MTTR 계산
    
    SELECT 컬럼 인덱스 (get_mttr_summary_query):
    - 0: failure_count
    - 1: avg_repair_seconds
    - 2: total_downtime_seconds
    """
    # TODO: frontend_id → equipment_id 변환
    if frontend_id and not equipment_id:
        raise ValidationError(
            "frontend_id 사용 시 MappingService 연동 필요",
            field="frontend_id"
        )
    
    logger.debug(f"📊 단일 설비 MTBF/MTTR: equipment_id={equipment_id}")
    
    # MTTR 요약 데이터 조회
    cursor.execute(
        get_mttr_summary_query(single_equipment=True),
        (equipment_id, start_date, end_date)
    )
    mttr_row = cursor.fetchone()
    
    failure_count = mttr_row[0] if mttr_row and mttr_row[0] else 0
    avg_repair_seconds = mttr_row[1] if mttr_row and mttr_row[1] else 0
    total_downtime_seconds = mttr_row[2] if mttr_row and mttr_row[2] else 0
    
    # MTBF 계산
    if failure_count > 0:
        mtbf_hours = period_hours / failure_count
    else:
        mtbf_hours = period_hours  # 고장 없음 = 전체 기간
        logger.debug(f"📌 고장 없음: MTBF = {mtbf_hours:.2f}시간")
    
    # MTTR 계산 (초 → 시간)
    mttr_hours = avg_repair_seconds / 3600 if avg_repair_seconds else 0
    
    # Availability 계산
    if mtbf_hours + mttr_hours > 0:
        availability = safe_percentage(mtbf_hours, mtbf_hours + mttr_hours)
    else:
        availability = 100.0
    
    logger.info(
        f"📈 MTBF/MTTR: {equipment_id} - "
        f"MTBF={mtbf_hours:.2f}h, MTTR={mttr_hours:.2f}h, "
        f"Availability={availability:.2f}%"
    )
    
    result = {
        "equipment_id": equipment_id,
        "mtbf_hours": round(mtbf_hours, 2),
        "mttr_hours": round(mttr_hours, 2),
        "failure_count": failure_count,
        "total_downtime_hours": round(total_downtime_seconds / 3600, 2),
        "availability_percent": availability
    }
    
    # 상세 정보 포함
    if include_details and failure_count > 0:
        cursor.execute(
            get_alarm_duration_query(),
            (equipment_id, start_date, end_date)
        )
        
        alarm_details = []
        for row in cursor.fetchall():
            alarm_details.append({
                "alarm_event_id": row[0],
                "alarm_code": row[1],
                "alarm_message": row[2],
                "set_time": row[3].isoformat() if row[3] else None,
                "clear_time": row[4].isoformat() if row[4] else None,
                "duration_seconds": row[5]
            })
        
        result["alarm_details"] = alarm_details[:20]  # 최대 20개
    
    return result


async def _calculate_all_equipment_mtbf_mttr(
    cursor,
    start_date: str,
    end_date: str,
    period_hours: float
) -> dict:
    """
    전체 설비 평균 MTBF/MTTR 계산
    
    SELECT 컬럼 인덱스 (get_mttr_summary_query - all):
    - 0: EquipmentId
    - 1: failure_count
    - 2: avg_repair_seconds
    - 3: total_downtime_seconds
    """
    logger.debug("📊 전체 설비 MTBF/MTTR 계산")
    
    cursor.execute(
        get_mttr_summary_query(single_equipment=False),
        (start_date, end_date)
    )
    
    equipment_stats = []
    total_failures = 0
    
    for row in cursor.fetchall():
        eq_id = row[0]
        failures = row[1] or 0
        avg_repair_seconds = row[2] or 0
        total_downtime_seconds = row[3] or 0
        
        # MTBF/MTTR 계산
        mtbf_hours = safe_divide(period_hours, failures, period_hours)
        mttr_hours = avg_repair_seconds / 3600 if avg_repair_seconds else 0
        
        availability = safe_percentage(mtbf_hours, mtbf_hours + mttr_hours)
        
        equipment_stats.append({
            "equipment_id": eq_id,
            "mtbf_hours": round(mtbf_hours, 2),
            "mttr_hours": round(mttr_hours, 2),
            "failure_count": failures,
            "availability_percent": availability
        })
        
        total_failures += failures
    
    if not equipment_stats:
        logger.warning("⚠️ MTBF/MTTR 데이터 없음")
        return {
            "average_mtbf_hours": round(period_hours, 2),
            "average_mttr_hours": 0.0,
            "equipment_count": 0,
            "total_failures": 0,
            "message": "해당 기간에 고장 데이터가 없습니다"
        }
    
    # 평균 계산
    avg_mtbf = sum(e["mtbf_hours"] for e in equipment_stats) / len(equipment_stats)
    avg_mttr = sum(e["mttr_hours"] for e in equipment_stats) / len(equipment_stats)
    avg_availability = sum(e["availability_percent"] for e in equipment_stats) / len(equipment_stats)
    
    logger.info(
        f"📈 전체 MTBF/MTTR: MTBF={avg_mtbf:.2f}h, MTTR={avg_mttr:.2f}h, "
        f"설비={len(equipment_stats)}개"
    )
    
    return {
        "average_mtbf_hours": round(avg_mtbf, 2),
        "average_mttr_hours": round(avg_mttr, 2),
        "average_availability_percent": round(avg_availability, 2),
        "equipment_count": len(equipment_stats),
        "total_failures": total_failures,
        "equipment_stats": sorted(
            equipment_stats,
            key=lambda x: x["failure_count"],
            reverse=True
        )[:10]  # 상위 10개
    }