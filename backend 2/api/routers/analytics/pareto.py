"""
analytics/pareto.py
Pareto 분석 (80/20 법칙) 라우터

@version 1.0.0
@changelog
- v1.0.0: analytics.py에서 분리
  - 실제 DB 스키마 사용
  - alarm: log.AlarmEvent 기반
  - downtime: log.EquipmentState 기반
  - defect: 현재 데이터 없음 (placeholder)
  - ⚠️ 호환성: 기존 API 엔드포인트 /pareto 유지

@description
Pareto 분석 유형:
- alarm: 알람 코드별 발생 빈도
- defect: 설비별 불량 발생 (데이터 없음)
- downtime: 설비별 다운타임

@dependencies
- helpers: safe_percentage, get_default_date_range
- queries.alarm_queries: get_alarm_by_code_query
- queries.status_queries: get_downtime_by_equipment_query

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
    validate_analysis_type
)
from .queries.alarm_queries import get_alarm_by_code_query
from .queries.status_queries import get_downtime_by_equipment_query
from ...database.connection import get_db_connection, return_db_connection
from ...utils.errors import (
    handle_errors,
    handle_db_error,
    ValidationError
)

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Pareto 분석 엔드포인트
# ============================================================================

@router.get(
    "/pareto",
    summary="Pareto 분석",
    description="80/20 법칙 기반 주요 원인 분석"
)
@handle_errors
async def pareto_analysis(
    analysis_type: str = Query(
        default="alarm",
        description="분석 유형: alarm(알람코드별), defect(설비별 불량), downtime(설비별 다운타임)"
    ),
    start_date: Optional[str] = Query(
        None,
        description="시작 날짜 (ISO 8601)"
    ),
    end_date: Optional[str] = Query(
        None,
        description="종료 날짜 (ISO 8601)"
    ),
    top_n: int = Query(
        default=10,
        ge=5,
        le=50,
        description="상위 N개 항목"
    )
):
    """
    Pareto 분석 (80/20 법칙)
    
    🆕 v1.0.0: 실제 DB 스키마 기반 분석
    
    **분석 유형:**
    - alarm: 알람 코드별 발생 빈도 (log.AlarmEvent)
    - defect: 설비별 불량 발생 (현재 데이터 없음)
    - downtime: 설비별 다운타임 (log.EquipmentState)
    
    **Returns:**
    - items: 분석 항목 목록 (누적 퍼센트 포함)
    - pareto_80_index: 80% 달성 지점
    - total_count: 전체 발생 횟수
    """
    logger.info(f"🚀 Pareto 분석 시작: type={analysis_type}, top_n={top_n}")
    
    # 분석 유형 검증
    validate_analysis_type(analysis_type)
    
    # 날짜 범위 설정
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range(days=30)
    else:
        validate_calculation_period(start_date, end_date, max_days=365)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        items = []
        total_count = 0
        
        if analysis_type == "alarm":
            items, total_count = await _analyze_alarm_pareto(
                cursor, start_date, end_date, top_n
            )
        elif analysis_type == "defect":
            items, total_count = await _analyze_defect_pareto(
                cursor, start_date, end_date, top_n
            )
        elif analysis_type == "downtime":
            items, total_count = await _analyze_downtime_pareto(
                cursor, start_date, end_date, top_n
            )
        
        cursor.close()
        
        if not items:
            logger.warning(f"⚠️ Pareto 분석: 데이터 없음 (type={analysis_type})")
            return {
                "analysis_type": analysis_type,
                "items": [],
                "total_count": 0,
                "message": "해당 기간에 분석할 데이터가 없습니다",
                "period": {"start": start_date, "end": end_date}
            }
        
        # 누적 퍼센트 계산
        cumulative = 0
        for item in items:
            item_count = item["count"]
            cumulative += item_count
            
            item["percentage"] = safe_percentage(item_count, total_count)
            item["cumulative_percentage"] = safe_percentage(cumulative, total_count)
        
        # 80% 지점 찾기
        pareto_80_index = next(
            (i for i, item in enumerate(items) 
             if item["cumulative_percentage"] >= 80),
            len(items)
        )
        
        logger.info(
            f"✅ Pareto 분석 완료: {len(items)}개 항목, "
            f"80% 지점: {pareto_80_index + 1}번째"
        )
        
        return {
            "analysis_type": analysis_type,
            "period": {"start": start_date, "end": end_date},
            "items": items,
            "total_count": total_count,
            "pareto_80_index": pareto_80_index,
            "summary": {
                "top_item_contribution": items[0]["percentage"] if items else 0,
                "items_for_80_percent": pareto_80_index + 1
            }
        }
        
    except ValidationError:
        raise
    except Exception as e:
        handle_db_error(e, "Pareto 분석")
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 분석 유형별 함수
# ============================================================================

async def _analyze_alarm_pareto(
    cursor,
    start_date: str,
    end_date: str,
    top_n: int
) -> tuple:
    """
    알람 코드별 Pareto 분석
    
    SELECT 컬럼 인덱스:
    - 0: AlarmCode
    - 1: AlarmMessage
    - 2: occurrence_count
    - 3: equipment_count
    """
    logger.debug("📊 Pareto 분석: 알람 코드별")
    
    cursor.execute(
        get_alarm_by_code_query(),
        (top_n, start_date, end_date)
    )
    
    items = []
    total_count = 0
    
    for row in cursor.fetchall():
        count = row[2]
        total_count += count
        items.append({
            "alarm_code": row[0],
            "alarm_message": row[1],
            "count": count,
            "equipment_count": row[3]
        })
    
    return items, total_count


async def _analyze_defect_pareto(
    cursor,
    start_date: str,
    end_date: str,
    top_n: int
) -> tuple:
    """
    설비별 불량 Pareto 분석
    
    ⚠️ 현재 불량 데이터 테이블이 없음 (placeholder)
    """
    logger.debug("📊 Pareto 분석: 설비별 불량")
    logger.warning("⚠️ 불량 데이터 테이블이 없습니다. 빈 결과 반환")
    
    # TODO: 불량 데이터 테이블이 추가되면 구현
    # 현재는 빈 결과 반환
    return [], 0


async def _analyze_downtime_pareto(
    cursor,
    start_date: str,
    end_date: str,
    top_n: int
) -> tuple:
    """
    설비별 다운타임 Pareto 분석
    
    SELECT 컬럼 인덱스:
    - 0: EquipmentId
    - 1: EquipmentName
    - 2: downtime_count
    - 3: total_downtime_seconds
    """
    logger.debug("📊 Pareto 분석: 설비별 다운타임")
    
    cursor.execute(
        get_downtime_by_equipment_query(),
        (start_date, end_date, top_n)
    )
    
    items = []
    total_count = 0
    
    for row in cursor.fetchall():
        count = row[2]  # 다운타임 발생 횟수
        total_count += count
        items.append({
            "equipment_id": row[0],
            "equipment_name": row[1],
            "count": count,
            "total_downtime_seconds": row[3],
            "total_downtime_hours": round(row[3] / 3600, 2) if row[3] else 0
        })
    
    return items, total_count
