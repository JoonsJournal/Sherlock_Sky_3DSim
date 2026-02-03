"""
analytics/dashboard.py
종합 대시보드 요약 데이터 라우터

@version 1.0.0
@changelog
- v1.0.0: analytics.py에서 분리
  - 실제 DB 스키마 사용
  - 생산, 알람, OEE, 신뢰성 지표 통합
  - ⚠️ 호환성: 기존 API 엔드포인트 /dashboard 유지

@description
종합 대시보드 요약:
- production: 생산량 요약 (Cycle 완료 수)
- alarms: 알람 요약 (발생/해제 건수)
- oee: OEE 지표 요약
- reliability: MTBF/MTTR 요약

@dependencies
- helpers: safe_divide, safe_percentage, get_default_date_range
- 다른 analytics 모듈의 계산 로직 재사용

작성일: 2026-02-02
수정일: 2026-02-02
"""

from fastapi import APIRouter, Query
from datetime import datetime
import logging

from .helpers import (
    safe_divide,
    safe_percentage,
    get_default_date_range,
    calculate_period_hours
)
from ...database.connection import get_db_connection, return_db_connection
from ...utils.errors import handle_errors, handle_db_error

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# 대시보드 엔드포인트
# ============================================================================

@router.get(
    "/dashboard",
    summary="대시보드 요약",
    description="OEE, MTBF, 생산량, 알람 등 주요 지표 통합 조회"
)
@handle_errors
async def get_dashboard_summary(
    period_days: int = Query(
        default=7,
        ge=1,
        le=90,
        description="조회 기간 (일)"
    )
):
    """
    종합 대시보드 요약 데이터
    
    🆕 v1.0.0: 실제 DB 스키마 기반 요약
    
    **포함 지표:**
    - production: 총 Cycle 수, 일평균
    - alarms: 총 알람, 해제된 알람, 미해제 알람
    - oee: 평균 OEE, Availability, Performance
    - reliability: 평균 MTBF, 총 고장 수
    
    **계산 기간:**
    - 오늘부터 period_days일 전까지
    """
    logger.info(f"🚀 대시보드 요약 조회: {period_days}일")
    
    start_date, end_date = get_default_date_range(days=period_days)
    period_hours = calculate_period_hours(start_date, end_date)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        dashboard = {
            "period": {
                "start": start_date,
                "end": end_date,
                "days": period_days
            },
            "timestamp": datetime.now().isoformat()
        }
        
        # 1. 생산 요약 (log.CycleTime)
        dashboard["production"] = await _get_production_summary(
            cursor, start_date, end_date, period_days
        )
        
        # 2. 알람 요약 (log.AlarmEvent)
        dashboard["alarms"] = await _get_alarm_summary(
            cursor, start_date, end_date
        )
        
        # 3. OEE 요약 (계산 기반)
        dashboard["oee"] = await _get_oee_summary(
            cursor, start_date, end_date
        )
        
        # 4. 신뢰성 요약 (MTBF)
        dashboard["reliability"] = await _get_reliability_summary(
            cursor, start_date, end_date, period_hours
        )
        
        # 5. 설비 현황
        dashboard["equipment"] = await _get_equipment_summary(cursor)
        
        cursor.close()
        
        logger.info(f"✅ 대시보드 데이터 생성 완료")
        return dashboard
        
    except Exception as e:
        handle_db_error(e, "대시보드 요약 조회")
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 요약 데이터 함수
# ============================================================================

async def _get_production_summary(
    cursor,
    start_date: str,
    end_date: str,
    period_days: int
) -> dict:
    """
    생산량 요약 조회
    
    SELECT 컬럼 인덱스:
    - 0: total_cycles
    - 1: equipment_count
    """
    query = """
        SELECT 
            COUNT(*) as total_cycles,
            COUNT(DISTINCT ct.EquipmentId) as equipment_count
        FROM [log].[CycleTime] ct
        WHERE ct.[Time] BETWEEN ? AND ?
    """
    cursor.execute(query, (start_date, end_date))
    row = cursor.fetchone()
    
    total_cycles = row[0] if row else 0
    equipment_count = row[1] if row else 0
    daily_average = total_cycles / period_days if period_days > 0 else 0
    
    return {
        "total_cycles": total_cycles,
        "daily_average": round(daily_average, 1),
        "equipment_count": equipment_count
    }


async def _get_alarm_summary(
    cursor,
    start_date: str,
    end_date: str
) -> dict:
    """
    알람 요약 조회
    
    SELECT 컬럼 인덱스:
    - 0: total_set (알람 발생)
    - 1: total_cleared (알람 해제)
    - 2: unique_codes (고유 알람 코드 수)
    """
    query = """
        SELECT 
            COUNT(CASE WHEN ae.IsSet = 1 THEN 1 END) as total_set,
            COUNT(CASE WHEN ae.IsSet = 0 THEN 1 END) as total_cleared,
            COUNT(DISTINCT ae.AlarmCode) as unique_codes
        FROM [log].[AlarmEvent] ae
        WHERE ae.OccurredAtUtc BETWEEN ? AND ?
    """
    cursor.execute(query, (start_date, end_date))
    row = cursor.fetchone()
    
    total_set = row[0] if row else 0
    total_cleared = row[1] if row else 0
    
    return {
        "total": total_set,
        "cleared": total_cleared,
        "active": total_set - total_cleared,  # 미해제 추정
        "unique_codes": row[2] if row else 0
    }


async def _get_oee_summary(
    cursor,
    start_date: str,
    end_date: str
) -> dict:
    """
    OEE 요약 계산
    
    간단한 전체 평균 OEE 계산
    """
    # Availability 계산 (상태 기반)
    status_query = """
        SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN es.Status = 'RUNNING' THEN 1 END) as running_records
        FROM [log].[EquipmentState] es
        WHERE es.OccurredAtUtc BETWEEN ? AND ?
    """
    cursor.execute(status_query, (start_date, end_date))
    status_row = cursor.fetchone()
    
    total_records = status_row[0] if status_row else 0
    running_records = status_row[1] if status_row else 0
    
    availability = safe_divide(running_records, total_records, 0.0)
    
    # Performance는 간단히 90% 가정 (상세 계산은 OEE 모듈에서)
    performance = 0.90
    
    # Quality는 100% 가정 (품질 데이터 없음)
    quality = 1.0
    
    oee = availability * performance * quality
    
    return {
        "average_percent": round(oee * 100, 2),
        "availability_percent": round(availability * 100, 2),
        "performance_percent": round(performance * 100, 2),
        "quality_percent": round(quality * 100, 2)
    }


async def _get_reliability_summary(
    cursor,
    start_date: str,
    end_date: str,
    period_hours: float
) -> dict:
    """
    신뢰성 지표 요약 (MTBF)
    
    SELECT 컬럼 인덱스:
    - 0: equipment_count (알람 발생 설비 수)
    - 1: failure_count (총 알람 발생 수)
    """
    query = """
        SELECT 
            COUNT(DISTINCT ae.EquipmentId) as equipment_count,
            COUNT(*) as failure_count
        FROM [log].[AlarmEvent] ae
        WHERE ae.OccurredAtUtc BETWEEN ? AND ?
          AND ae.IsSet = 1
    """
    cursor.execute(query, (start_date, end_date))
    row = cursor.fetchone()
    
    equipment_count = row[0] if row else 0
    failure_count = row[1] if row else 0
    
    # 평균 MTBF 계산
    if failure_count > 0:
        avg_mtbf = (period_hours * equipment_count) / failure_count if equipment_count > 0 else period_hours
    else:
        avg_mtbf = period_hours
    
    return {
        "average_mtbf_hours": round(avg_mtbf, 2),
        "total_failures": failure_count,
        "affected_equipment_count": equipment_count
    }


async def _get_equipment_summary(cursor) -> dict:
    """
    설비 현황 요약
    
    SELECT 컬럼 인덱스:
    - 0: total_count
    """
    query = """
        SELECT COUNT(*) as total_count
        FROM [core].[Equipment]
    """
    cursor.execute(query)
    row = cursor.fetchone()
    
    total_count = row[0] if row else 0
    
    # 최신 상태별 설비 수
    status_query = """
        WITH LatestStatus AS (
            SELECT 
                es.EquipmentId,
                es.Status,
                ROW_NUMBER() OVER (PARTITION BY es.EquipmentId ORDER BY es.OccurredAtUtc DESC) as rn
            FROM [log].[EquipmentState] es
        )
        SELECT 
            Status,
            COUNT(*) as count
        FROM LatestStatus
        WHERE rn = 1
        GROUP BY Status
    """
    cursor.execute(status_query)
    
    status_counts = {}
    for row in cursor.fetchall():
        status_counts[row[0] or "UNKNOWN"] = row[1]
    
    return {
        "total_count": total_count,
        "by_status": status_counts
    }
