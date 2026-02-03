"""
생산 관리 API
- 생산량 조회
- 불량률 분석
- 생산 통계
- 생산 데이터 검증
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, validator
import logging

from ..database.connection import get_db_connection, return_db_connection
from ..utils.errors import (
    DatabaseError,
    NotFoundError,
    ValidationError,
    handle_errors,
    handle_db_error,
    validate_equipment_id,
    validate_date_range
)

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Pydantic 모델 (데이터 검증)
# ============================================================================

class ProductionData(BaseModel):
    """생산 데이터 입력 모델"""
    equipment_id: str = Field(..., description="설비 ID")
    batch_id: Optional[str] = Field(None, description="배치 ID")
    product_id: Optional[str] = Field(None, description="제품 ID")
    quantity_produced: int = Field(..., ge=0, description="생산량 (0 이상)")
    defect_count: int = Field(0, ge=0, description="불량 수 (0 이상)")
    cycle_time: Optional[float] = Field(None, gt=0, description="사이클 타임 (초)")
    
    @validator('equipment_id')
    def validate_equipment_id_format(cls, v):
        """설비 ID 형식 검증"""
        validate_equipment_id(v)
        return v
    
    @validator('defect_count')
    def validate_defect_not_exceed_production(cls, v, values):
        """불량 수가 생산량을 초과하지 않도록 검증"""
        if 'quantity_produced' in values and v > values['quantity_produced']:
            raise ValueError('불량 수가 생산량을 초과할 수 없습니다')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "equipment_id": "EQ-01-01",
                "batch_id": "BATCH-2024-001",
                "product_id": "PROD-A",
                "quantity_produced": 100,
                "defect_count": 3,
                "cycle_time": 45.5
            }
        }


# ============================================================================
# 헬퍼 함수
# ============================================================================

def get_default_period(hours: int = 24) -> tuple:
    """기본 조회 기간 생성"""
    end = datetime.now()
    start = end - timedelta(hours=hours)
    return start.isoformat(), end.isoformat()


def validate_production_period(start_date: str, end_date: str, max_days: int = 90):
    """생산 데이터 조회 기간 검증"""
    start, end = validate_date_range(start_date, end_date)
    
    period_days = (end - start).days
    if period_days > max_days:
        raise ValidationError(
            f"조회 기간이 너무 깁니다 (최대 {max_days}일): {period_days}일",
            field="date_range"
        )
    
    if period_days < 0:
        raise ValidationError(
            "시작 날짜가 종료 날짜보다 늦습니다",
            field="date_range"
        )
    
    return start, end


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """안전한 나눗셈"""
    try:
        if denominator == 0:
            return default
        return numerator / denominator
    except (TypeError, ValueError):
        return default


def calculate_rates(good: int, defect: int) -> Dict[str, float]:
    """생산 비율 계산"""
    total = good + defect
    defect_rate = safe_divide(defect, total, 0.0) * 100
    yield_rate = safe_divide(good, total, 0.0) * 100
    
    return {
        "defect_rate": round(defect_rate, 2),
        "yield_rate": round(yield_rate, 2)
    }


# ============================================================================
# 생산 요약
# ============================================================================

@router.get("/summary")
@handle_errors
async def get_production_summary(
    start_date: Optional[str] = Query(
        None,
        description="시작 날짜 (ISO 8601 형식)"
    ),
    end_date: Optional[str] = Query(
        None,
        description="종료 날짜 (ISO 8601 형식)"
    ),
    include_hourly: bool = Query(
        default=False,
        description="시간별 세부 데이터 포함 여부"
    )
):
    """
    생산 요약 정보
    
    전체 생산량, 불량률, 수율 등을 요약하여 제공합니다.
    """
    logger.info(f"생산 요약 조회: start={start_date}, end={end_date}")
    
    # 날짜 범위 설정 및 검증
    if not start_date or not end_date:
        start_date, end_date = get_default_period(hours=24)
        logger.debug(f"기본 기간 사용: {start_date} ~ {end_date}")
    else:
        validate_production_period(start_date, end_date, max_days=90)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 전체 요약
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT equipment_id) as active_equipment,
                COALESCE(SUM(quantity_produced), 0) as total_produced,
                COALESCE(SUM(defect_count), 0) as total_defects
            FROM production_ts
            WHERE time BETWEEN %s AND %s
        """, (start_date, end_date))
        
        row = cursor.fetchone()
        
        if not row:
            logger.warning("생산 데이터 없음")
            return {
                "period": {"start": start_date, "end": end_date},
                "message": "해당 기간에 생산 데이터가 없습니다",
                "active_equipment": 0,
                "total_produced": 0,
                "total_defects": 0,
                "total_good": 0
            }
        
        active_equipment = row[0] or 0
        total_produced = int(row[1])
        total_defects = int(row[2])
        total_good = total_produced - total_defects
        
        rates = calculate_rates(total_good, total_defects)
        
        logger.info(
            f"생산 요약: 생산={total_produced}, 양품={total_good}, "
            f"불량={total_defects}, 수율={rates['yield_rate']}%"
        )
        
        result = {
            "period": {"start": start_date, "end": end_date},
            "active_equipment": active_equipment,
            "total_produced": total_produced,
            "total_good": total_good,
            "total_defects": total_defects,
            "defect_rate_percent": rates["defect_rate"],
            "yield_rate_percent": rates["yield_rate"]
        }
        
        # 시간별 세부 데이터 (선택)
        if include_hourly:
            cursor.execute("""
                SELECT 
                    time_bucket('1 hour', time) as hour,
                    COALESCE(SUM(quantity_produced), 0) as produced,
                    COALESCE(SUM(defect_count), 0) as defects
                FROM production_ts
                WHERE time BETWEEN %s AND %s
                GROUP BY hour
                ORDER BY hour
            """, (start_date, end_date))
            
            hourly_data = []
            for h_row in cursor.fetchall():
                h_produced = int(h_row[1])
                h_defects = int(h_row[2])
                h_good = h_produced - h_defects
                h_rates = calculate_rates(h_good, h_defects)
                
                hourly_data.append({
                    "timestamp": h_row[0].isoformat(),
                    "produced": h_produced,
                    "good": h_good,
                    "defects": h_defects,
                    "yield_rate": h_rates["yield_rate"]
                })
            
            result["hourly_breakdown"] = hourly_data
            logger.debug(f"시간별 데이터 {len(hourly_data)}건 포함")
        
        cursor.close()
        return result
        
    except ValidationError:
        raise
    except Exception as e:
        handle_db_error(e, "생산 요약 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 설비별 생산량
# ============================================================================

@router.get("/by-equipment")
@handle_errors
async def get_production_by_equipment(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: str = Query(
        default="total",
        regex="^(total|defect_rate|good)$",
        description="정렬 기준"
    ),
    min_production: int = Query(
        default=0,
        ge=0,
        description="최소 생산량 필터"
    )
):
    """
    설비별 생산량 조회
    
    각 설비의 생산 실적을 조회하고 정렬합니다.
    """
    logger.info(
        f"설비별 생산량 조회: sort={sort_by}, limit={limit}, "
        f"min={min_production}"
    )
    
    # 날짜 범위
    if not start_date or not end_date:
        start_date, end_date = get_default_period(hours=24)
    else:
        validate_production_period(start_date, end_date)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 정렬 컬럼 매핑
        sort_column_map = {
            "total": "total",
            "defect_rate": "defect_rate",
            "good": "good"
        }
        sort_column = sort_column_map[sort_by]
        
        cursor.execute(f"""
            SELECT 
                equipment_id,
                COALESCE(SUM(quantity_produced), 0) as produced,
                COALESCE(SUM(defect_count), 0) as defects,
                COALESCE(SUM(quantity_produced) - SUM(defect_count), 0) as good,
                COALESCE(SUM(quantity_produced), 0) as total
            FROM production_ts
            WHERE time BETWEEN %s AND %s
            GROUP BY equipment_id
            HAVING SUM(quantity_produced) >= %s
            ORDER BY {sort_column} DESC
            LIMIT %s
        """, (start_date, end_date, min_production, limit))
        
        equipment_production = []
        for row in cursor.fetchall():
            produced = int(row[1])
            defects = int(row[2])
            good = int(row[3])
            
            rates = calculate_rates(good, defects)
            
            equipment_production.append({
                "equipment_id": row[0],
                "total_produced": produced,
                "good_count": good,
                "defect_count": defects,
                "defect_rate_percent": rates["defect_rate"],
                "yield_rate_percent": rates["yield_rate"]
            })
        
        cursor.close()
        
        logger.info(f"설비별 생산량 조회 완료: {len(equipment_production)}개 설비")
        
        return {
            "period": {"start": start_date, "end": end_date},
            "equipment_production": equipment_production,
            "count": len(equipment_production),
            "filters": {
                "sort_by": sort_by,
                "min_production": min_production
            }
        }
        
    except ValidationError:
        raise
    except Exception as e:
        handle_db_error(e, "설비별 생산량 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 생산 타임라인
# ============================================================================

@router.get("/timeline/{equipment_id}")
@handle_errors
async def get_production_timeline(
    equipment_id: str,
    interval: str = Query(
        default="1hour",
        regex="^(1min|5min|1hour|1day)$",
        description="시간 간격"
    ),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(default=100, ge=1, le=1000)
):
    """
    설비별 생산 타임라인
    
    지정된 시간 간격으로 생산 데이터를 집계합니다.
    """
    logger.info(f"생산 타임라인: {equipment_id}, interval={interval}")
    
    # 설비 ID 검증
    validate_equipment_id(equipment_id)
    
    # 날짜 범위
    if not start_date or not end_date:
        start_date, end_date = get_default_period(hours=24)
    else:
        validate_production_period(start_date, end_date)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 간격 매핑
        interval_map = {
            "1min": "1 minute",
            "5min": "5 minutes",
            "1hour": "1 hour",
            "1day": "1 day"
        }
        bucket_interval = interval_map[interval]
        
        # TimescaleDB time_bucket 사용
        query = """
            SELECT 
                time_bucket(%s, time) as bucket,
                COALESCE(SUM(quantity_produced), 0) as produced,
                COALESCE(SUM(defect_count), 0) as defects,
                COUNT(*) as records
            FROM production_ts
            WHERE equipment_id = %s
                AND time BETWEEN %s AND %s
            GROUP BY bucket
            ORDER BY bucket DESC
            LIMIT %s
        """
        
        cursor.execute(query, (bucket_interval, equipment_id, start_date, end_date, limit))
        
        timeline = []
        for row in cursor.fetchall():
            produced = int(row[1])
            defects = int(row[2])
            good = produced - defects
            rates = calculate_rates(good, defects)
            
            timeline.append({
                "timestamp": row[0].isoformat(),
                "total_produced": produced,
                "good_count": good,
                "defect_count": defects,
                "yield_rate_percent": rates["yield_rate"],
                "records": row[3]
            })
        
        cursor.close()
        
        # 시간순 정렬 (오래된 것부터)
        timeline.reverse()
        
        logger.info(f"타임라인 조회 완료: {equipment_id}, {len(timeline)}개 데이터 포인트")
        
        return {
            "equipment_id": equipment_id,
            "interval": interval,
            "period": {"start": start_date, "end": end_date},
            "timeline": timeline,
            "count": len(timeline)
        }
        
    except ValidationError:
        raise
    except Exception as e:
        # TimescaleDB 함수 에러 처리
        error_msg = str(e).lower()
        if "time_bucket" in error_msg:
            logger.error(f"TimescaleDB time_bucket 에러: {e}")
            raise DatabaseError(
                "시계열 집계 함수 오류 (TimescaleDB 확장이 필요할 수 있습니다)",
                details={"error": str(e)}
            )
        handle_db_error(e, "생산 타임라인 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 불량 분석
# ============================================================================

@router.get("/defect-analysis")
@handle_errors
async def get_defect_analysis(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    top_n: int = Query(default=10, ge=1, le=50)
):
    """
    불량 분석
    
    불량률이 높은 설비와 추세를 분석합니다.
    """
    logger.info(f"불량 분석: top_n={top_n}")
    
    # 날짜 범위
    if not start_date or not end_date:
        start_date, end_date = get_default_period(hours=24)
    else:
        validate_production_period(start_date, end_date)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 불량률 높은 설비
        cursor.execute("""
            SELECT 
                equipment_id,
                COALESCE(SUM(quantity_produced), 0) as produced,
                COALESCE(SUM(defect_count), 0) as defects
            FROM production_ts
            WHERE time BETWEEN %s AND %s
            GROUP BY equipment_id
            HAVING SUM(quantity_produced) > 0
            ORDER BY (CAST(SUM(defect_count) AS FLOAT) / SUM(quantity_produced)) DESC
            LIMIT %s
        """, (start_date, end_date, top_n))
        
        top_defect_equipment = []
        for row in cursor.fetchall():
            produced = int(row[1])
            defects = int(row[2])
            good = produced - defects
            rates = calculate_rates(good, defects)
            
            top_defect_equipment.append({
                "equipment_id": row[0],
                "produced": produced,
                "defects": defects,
                "defect_rate_percent": rates["defect_rate"]
            })
        
        # 전체 불량 추세 (일별)
        cursor.execute("""
            SELECT 
                time_bucket('1 day', time) as day,
                COALESCE(SUM(quantity_produced), 0) as produced,
                COALESCE(SUM(defect_count), 0) as defects
            FROM production_ts
            WHERE time BETWEEN %s AND %s
            GROUP BY day
            ORDER BY day
        """, (start_date, end_date))
        
        daily_trend = []
        for row in cursor.fetchall():
            produced = int(row[1])
            defects = int(row[2])
            good = produced - defects
            rates = calculate_rates(good, defects)
            
            daily_trend.append({
                "date": row[0].isoformat(),
                "produced": produced,
                "defects": defects,
                "defect_rate_percent": rates["defect_rate"]
            })
        
        cursor.close()
        
        logger.info(f"불량 분석 완료: {len(top_defect_equipment)}개 설비, {len(daily_trend)}일 추세")
        
        return {
            "period": {"start": start_date, "end": end_date},
            "top_defect_equipment": top_defect_equipment,
            "daily_trend": daily_trend
        }
        
    except ValidationError:
        raise
    except Exception as e:
        handle_db_error(e, "불량 분석")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 생산 데이터 입력 (POST)
# ============================================================================

@router.post("/record")
@handle_errors
async def record_production(data: ProductionData):
    """
    생산 데이터 기록 (수동 입력)
    
    Simulator가 아닌 수동으로 생산 데이터를 입력할 때 사용합니다.
    """
    logger.info(f"생산 데이터 기록 요청: {data.equipment_id}")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 설비 존재 여부 확인
        cursor.execute(
            "SELECT 1 FROM equipment WHERE id = %s",
            (data.equipment_id,)
        )
        
        if not cursor.fetchone():
            raise NotFoundError("설비", data.equipment_id)
        
        # 데이터 삽입
        cursor.execute("""
            INSERT INTO production_ts 
                (time, equipment_id, batch_id, product_id, 
                 quantity_produced, defect_count, cycle_time, throughput)
            VALUES 
                (NOW(), %s, %s, %s, %s, %s, %s, %s)
        """, (
            data.equipment_id,
            data.batch_id,
            data.product_id,
            data.quantity_produced,
            data.defect_count,
            data.cycle_time,
            safe_divide(data.quantity_produced, data.cycle_time) if data.cycle_time else None
        ))
        
        conn.commit()
        cursor.close()
        
        logger.info(f"생산 데이터 기록 완료: {data.equipment_id}")
        
        return {
            "success": True,
            "message": "생산 데이터가 기록되었습니다",
            "data": data.dict(),
            "timestamp": datetime.now().isoformat()
        }
        
    except (NotFoundError, ValidationError):
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        handle_db_error(e, "생산 데이터 기록")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 배치별 생산 추적
# ============================================================================

@router.get("/batch/{batch_id}")
@handle_errors
async def get_batch_production(batch_id: str):
    """
    특정 배치의 생산 이력 조회
    
    배치 ID로 생산 이력을 추적합니다.
    """
    logger.info(f"배치 생산 조회: {batch_id}")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                time,
                equipment_id,
                product_id,
                quantity_produced,
                defect_count,
                cycle_time
            FROM production_ts
            WHERE batch_id = %s
            ORDER BY time
        """, (batch_id,))
        
        records = []
        total_produced = 0
        total_defects = 0
        
        for row in cursor.fetchall():
            produced = int(row[3])
            defects = int(row[4])
            
            total_produced += produced
            total_defects += defects
            
            records.append({
                "timestamp": row[0].isoformat(),
                "equipment_id": row[1],
                "product_id": row[2],
                "quantity_produced": produced,
                "defect_count": defects,
                "cycle_time": float(row[5]) if row[5] else None
            })
        
        cursor.close()
        
        if not records:
            raise NotFoundError("배치", batch_id)
        
        rates = calculate_rates(total_produced - total_defects, total_defects)
        
        logger.info(f"배치 조회 완료: {batch_id}, {len(records)}건")
        
        return {
            "batch_id": batch_id,
            "records": records,
            "summary": {
                "total_produced": total_produced,
                "total_defects": total_defects,
                "yield_rate_percent": rates["yield_rate"]
            },
            "record_count": len(records)
        }
        
    except NotFoundError:
        raise
    except Exception as e:
        handle_db_error(e, "배치 생산 조회")
    
    finally:
        if conn:
            return_db_connection(conn)