"""
analytics/trends.py
트렌드 분석 (시계열) 라우터

@version 1.0.0
@changelog
- v1.0.0: analytics.py에서 분리
  - 실제 DB 스키마 사용
  - MSSQL 날짜 집계 함수 사용 (TimescaleDB → MSSQL 전환)
  - production: log.CycleTime 기반
  - alarm: log.AlarmEvent 기반
  - ⚠️ 호환성: 기존 API 엔드포인트 /trends 유지

@description
트렌드 분석 메트릭:
- production: 생산량 트렌드 (Cycle 완료 수)
- alarm: 알람 발생 트렌드
- defect: 불량률 트렌드 (데이터 없음)
- oee: OEE 트렌드 (계산 기반)

@dependencies
- helpers: safe_percentage, get_default_date_range
- queries: 각 분석 유형별 쿼리

작성일: 2026-02-02
수정일: 2026-02-02
"""

from fastapi import APIRouter, Query
from typing import Optional, List, Dict
import logging

from .helpers import (
    safe_percentage,
    get_default_date_range,
    validate_calculation_period,
    validate_metric_type,
    validate_interval
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
# 시간 간격 매핑 (MSSQL용)
# ============================================================================

INTERVAL_SQL_MAP = {
    "1hour": {
        "datepart": "hour",
        "group_format": "DATEADD(HOUR, DATEDIFF(HOUR, 0, {column}), 0)"
    },
    "1day": {
        "datepart": "day",
        "group_format": "CAST({column} AS DATE)"
    },
    "1week": {
        "datepart": "week",
        "group_format": "DATEADD(WEEK, DATEDIFF(WEEK, 0, {column}), 0)"
    }
}


# ============================================================================
# 트렌드 분석 엔드포인트
# ============================================================================

@router.get(
    "/trends",
    summary="트렌드 분석",
    description="시계열 기반 트렌드 분석"
)
@handle_errors
async def get_trends(
    metric: str = Query(
        default="production",
        description="트렌드 메트릭: production, alarm, defect, oee"
    ),
    equipment_id: Optional[int] = Query(
        None,
        description="설비 ID (없으면 전체)"
    ),
    frontend_id: Optional[str] = Query(
        None,
        description="Frontend ID"
    ),
    interval: str = Query(
        default="1day",
        description="시간 간격: 1hour, 1day, 1week"
    ),
    limit: int = Query(
        default=30,
        ge=1,
        le=365,
        description="데이터 포인트 수"
    )
):
    """
    트렌드 분석 (시계열)
    
    🆕 v1.0.0: MSSQL 날짜 집계 함수 사용
    
    **메트릭 유형:**
    - production: Cycle 완료 수 트렌드
    - alarm: 알람 발생 트렌드
    - defect: 불량률 트렌드 (데이터 없음)
    - oee: OEE 트렌드 (계산 기반)
    
    **시간 간격:**
    - 1hour: 시간별 집계
    - 1day: 일별 집계
    - 1week: 주별 집계
    """
    logger.info(
        f"🚀 트렌드 분석 시작: metric={metric}, equipment={equipment_id}, "
        f"interval={interval}, limit={limit}"
    )
    
    # 검증
    validate_metric_type(metric)
    validate_interval(interval)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        trends = []
        
        if metric == "production":
            trends = await _get_production_trends(
                cursor, equipment_id, interval, limit
            )
        elif metric == "alarm":
            trends = await _get_alarm_trends(
                cursor, equipment_id, interval, limit
            )
        elif metric == "defect":
            trends = await _get_defect_trends(
                cursor, equipment_id, interval, limit
            )
        elif metric == "oee":
            trends = await _get_oee_trends(
                cursor, equipment_id, interval, limit
            )
        
        cursor.close()
        
        if not trends:
            logger.warning(f"⚠️ 트렌드 데이터 없음: metric={metric}")
            return {
                "metric": metric,
                "equipment_id": equipment_id,
                "interval": interval,
                "trends": [],
                "count": 0,
                "message": "해당 조건의 트렌드 데이터가 없습니다"
            }
        
        logger.info(f"✅ 트렌드 분석 완료: {len(trends)}개 데이터 포인트")
        
        return {
            "metric": metric,
            "equipment_id": equipment_id,
            "interval": interval,
            "trends": trends,
            "count": len(trends)
        }
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        handle_db_error(e, "트렌드 분석")
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 트렌드 유형별 함수
# ============================================================================

async def _get_production_trends(
    cursor,
    equipment_id: Optional[int],
    interval: str,
    limit: int
) -> List[Dict]:
    """
    생산량 트렌드 (Cycle 완료 수)
    """
    logger.debug(f"📊 생산량 트렌드 (interval={interval})")
    
    interval_info = INTERVAL_SQL_MAP[interval]
    time_bucket = interval_info["group_format"].format(column="ct.[Time]")
    
    if equipment_id:
        query = f"""
            SELECT TOP (?)
                {time_bucket} as bucket,
                COUNT(*) as cycle_count
            FROM [log].[CycleTime] ct
            WHERE ct.EquipmentId = ?
            GROUP BY {time_bucket}
            ORDER BY bucket DESC
        """
        cursor.execute(query, (limit, equipment_id))
    else:
        query = f"""
            SELECT TOP (?)
                {time_bucket} as bucket,
                COUNT(*) as cycle_count
            FROM [log].[CycleTime] ct
            GROUP BY {time_bucket}
            ORDER BY bucket DESC
        """
        cursor.execute(query, (limit,))
    
    trends = []
    for row in cursor.fetchall():
        trends.append({
            "timestamp": row[0].isoformat() if row[0] else None,
            "cycle_count": row[1]
        })
    
    # 시간순 정렬 (오래된 것부터)
    trends.reverse()
    
    return trends


async def _get_alarm_trends(
    cursor,
    equipment_id: Optional[int],
    interval: str,
    limit: int
) -> List[Dict]:
    """
    알람 발생 트렌드
    """
    logger.debug(f"📊 알람 트렌드 (interval={interval})")
    
    interval_info = INTERVAL_SQL_MAP[interval]
    time_bucket = interval_info["group_format"].format(column="ae.OccurredAtUtc")
    
    if equipment_id:
        query = f"""
            SELECT TOP (?)
                {time_bucket} as bucket,
                COUNT(CASE WHEN ae.IsSet = 1 THEN 1 END) as alarm_count,
                COUNT(DISTINCT ae.AlarmCode) as unique_alarm_codes
            FROM [log].[AlarmEvent] ae
            WHERE ae.EquipmentId = ?
            GROUP BY {time_bucket}
            ORDER BY bucket DESC
        """
        cursor.execute(query, (limit, equipment_id))
    else:
        query = f"""
            SELECT TOP (?)
                {time_bucket} as bucket,
                COUNT(CASE WHEN ae.IsSet = 1 THEN 1 END) as alarm_count,
                COUNT(DISTINCT ae.AlarmCode) as unique_alarm_codes
            FROM [log].[AlarmEvent] ae
            GROUP BY {time_bucket}
            ORDER BY bucket DESC
        """
        cursor.execute(query, (limit,))
    
    trends = []
    for row in cursor.fetchall():
        trends.append({
            "timestamp": row[0].isoformat() if row[0] else None,
            "alarm_count": row[1],
            "unique_alarm_codes": row[2]
        })
    
    trends.reverse()
    return trends


async def _get_defect_trends(
    cursor,
    equipment_id: Optional[int],
    interval: str,
    limit: int
) -> List[Dict]:
    """
    불량률 트렌드
    
    ⚠️ 현재 불량 데이터 없음 - placeholder
    """
    logger.debug(f"📊 불량률 트렌드 (interval={interval})")
    logger.warning("⚠️ 불량 데이터 테이블이 없습니다. 빈 결과 반환")
    
    # TODO: 불량 데이터 테이블이 추가되면 구현
    return []


async def _get_oee_trends(
    cursor,
    equipment_id: Optional[int],
    interval: str,
    limit: int
) -> List[Dict]:
    """
    OEE 트렌드 (계산 기반)
    
    일별로 OEE를 계산하여 트렌드 생성
    """
    logger.debug(f"📊 OEE 트렌드 (interval={interval})")
    
    interval_info = INTERVAL_SQL_MAP[interval]
    time_bucket_status = interval_info["group_format"].format(column="es.OccurredAtUtc")
    time_bucket_cycle = interval_info["group_format"].format(column="ct.[Time]")
    
    # 이 쿼리는 복잡하므로 일별 집계만 지원
    if interval != "1day":
        logger.warning("⚠️ OEE 트렌드는 현재 일별(1day) 집계만 지원합니다")
    
    # 상태 데이터 기반 Availability 집계
    if equipment_id:
        status_query = f"""
            SELECT TOP (?)
                CAST(es.OccurredAtUtc AS DATE) as bucket,
                COUNT(*) as total_records,
                COUNT(CASE WHEN es.Status = 'RUNNING' THEN 1 END) as running_records
            FROM [log].[EquipmentState] es
            WHERE es.EquipmentId = ?
            GROUP BY CAST(es.OccurredAtUtc AS DATE)
            ORDER BY bucket DESC
        """
        cursor.execute(status_query, (limit, equipment_id))
    else:
        status_query = f"""
            SELECT TOP (?)
                CAST(es.OccurredAtUtc AS DATE) as bucket,
                COUNT(*) as total_records,
                COUNT(CASE WHEN es.Status = 'RUNNING' THEN 1 END) as running_records
            FROM [log].[EquipmentState] es
            GROUP BY CAST(es.OccurredAtUtc AS DATE)
            ORDER BY bucket DESC
        """
        cursor.execute(status_query, (limit,))
    
    status_data = {}
    for row in cursor.fetchall():
        bucket = row[0]
        total = row[1] or 1
        running = row[2] or 0
        status_data[bucket] = {
            "availability": running / total if total > 0 else 0
        }
    
    # Cycle 데이터 기반 생산량 집계
    if equipment_id:
        cycle_query = f"""
            SELECT 
                CAST(ct.[Time] AS DATE) as bucket,
                COUNT(*) as cycle_count
            FROM [log].[CycleTime] ct
            WHERE ct.EquipmentId = ?
              AND CAST(ct.[Time] AS DATE) IN (SELECT CAST(es.OccurredAtUtc AS DATE) 
                                               FROM [log].[EquipmentState] es 
                                               WHERE es.EquipmentId = ?)
            GROUP BY CAST(ct.[Time] AS DATE)
        """
        cursor.execute(cycle_query, (equipment_id, equipment_id))
    else:
        cycle_query = f"""
            SELECT 
                CAST(ct.[Time] AS DATE) as bucket,
                COUNT(*) as cycle_count
            FROM [log].[CycleTime] ct
            GROUP BY CAST(ct.[Time] AS DATE)
        """
        cursor.execute(cycle_query)
    
    cycle_data = {}
    for row in cursor.fetchall():
        cycle_data[row[0]] = row[1]
    
    # OEE 계산 및 트렌드 생성
    trends = []
    for bucket, status_info in sorted(status_data.items()):
        availability = status_info["availability"]
        cycle_count = cycle_data.get(bucket, 0)
        
        # 간단한 Performance 계산 (기준값 필요)
        # 여기서는 하루 8시간 가동, Tact Time 60초 기준
        theoretical_daily_cycles = 8 * 60  # 480 cycles/day
        performance = min(cycle_count / theoretical_daily_cycles, 1.0) if theoretical_daily_cycles > 0 else 0
        
        quality = 1.0  # 품질 데이터 없음
        
        oee = availability * performance * quality
        
        trends.append({
            "timestamp": bucket.isoformat() if hasattr(bucket, 'isoformat') else str(bucket),
            "oee_percent": round(oee * 100, 2),
            "availability_percent": round(availability * 100, 2),
            "performance_percent": round(performance * 100, 2),
            "quality_percent": round(quality * 100, 2),
            "cycle_count": cycle_count
        })
    
    return trends
