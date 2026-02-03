"""
분석 API
- OEE (Overall Equipment Effectiveness) 계산
- MTBF/MTTR (평균 고장 간격/수리 시간)
- Pareto 분석 (80/20 법칙)
- 트렌드 분석 (시계열)
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
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
# 계산 헬퍼 함수
# ============================================================================

def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """
    안전한 나눗셈 (0으로 나누기 방지)
    
    Args:
        numerator: 분자
        denominator: 분모
        default: 분모가 0일 때 반환할 기본값
    
    Returns:
        나눗셈 결과 또는 기본값
    """
    try:
        if denominator == 0:
            logger.debug(f"Division by zero avoided: {numerator}/{denominator}")
            return default
        return numerator / denominator
    except (TypeError, ValueError) as e:
        logger.warning(f"Division error: {e}")
        return default


def safe_percentage(value: float, total: float, decimals: int = 2) -> float:
    """
    안전한 퍼센트 계산
    
    Args:
        value: 값
        total: 전체
        decimals: 소수점 자리수
    
    Returns:
        퍼센트 값 (0-100)
    """
    percentage = safe_divide(value, total, 0.0) * 100
    return round(percentage, decimals)


def validate_calculation_period(start_date: str, end_date: str, max_days: int = 365):
    """
    계산 기간 검증
    
    Args:
        start_date: 시작 날짜
        end_date: 종료 날짜
        max_days: 최대 허용 기간 (일)
    
    Raises:
        ValidationError: 날짜 범위가 유효하지 않음
    """
    start, end = validate_date_range(start_date, end_date)
    
    period_days = (end - start).days
    if period_days > max_days:
        raise ValidationError(
            f"조회 기간이 너무 깁니다 (최대 {max_days}일): {period_days}일",
            field="date_range"
        )
    
    if period_days < 1:
        raise ValidationError(
            "조회 기간은 최소 1일 이상이어야 합니다",
            field="date_range"
        )
    
    return start, end


def get_default_date_range(days: int = 7) -> tuple:
    """
    기본 날짜 범위 생성
    
    Args:
        days: 과거 일수
    
    Returns:
        (start_date_str, end_date_str)
    """
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.isoformat(), end.isoformat()


# ============================================================================
# OEE 계산
# ============================================================================

@router.get("/oee")
@handle_errors
async def calculate_oee(
    equipment_id: Optional[str] = Query(
        None,
        description="특정 설비 ID (없으면 전체 평균)"
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
        description="OEE 구성 요소 포함 여부"
    )
):
    """
    OEE (Overall Equipment Effectiveness) 계산
    
    OEE = Availability × Performance × Quality
    
    - Availability: 가동률 (실제 가동 시간 / 계획 가동 시간)
    - Performance: 성능 효율 (실제 생산량 / 이론 생산량)
    - Quality: 품질률 (양품 수 / 총 생산량)
    """
    logger.info(
        f"OEE 계산 요청: equipment_id={equipment_id}, "
        f"start={start_date}, end={end_date}"
    )
    
    # 설비 ID 검증
    if equipment_id:
        validate_equipment_id(equipment_id)
    
    # 날짜 범위 설정 및 검증
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range(days=7)
        logger.debug(f"기본 날짜 범위 사용: {start_date} ~ {end_date}")
    else:
        validate_calculation_period(start_date, end_date, max_days=90)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if equipment_id:
            # 특정 설비 OEE 계산
            logger.debug(f"특정 설비 OEE 계산: {equipment_id}")
            
            # 생산 데이터 조회
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(quantity_produced), 0) as total_produced,
                    COALESCE(SUM(defect_count), 0) as total_defects,
                    COUNT(*) as data_points
                FROM production_ts
                WHERE equipment_id = %s
                    AND time BETWEEN %s AND %s
            """, (equipment_id, start_date, end_date))
            
            row = cursor.fetchone()
            
            if not row or row[2] == 0:
                logger.warning(f"생산 데이터 없음: {equipment_id}")
                return {
                    "equipment_id": equipment_id,
                    "oee": 0.0,
                    "message": "해당 기간에 생산 데이터가 없습니다",
                    "period": {"start": start_date, "end": end_date}
                }
            
            total_produced = row[0]
            total_defects = row[1]
            good_count = total_produced - total_defects
            
            # 상태 데이터 조회 (가동 시간 계산용)
            cursor.execute("""
                SELECT 
                    COUNT(CASE WHEN status = 'RUNNING' THEN 1 END) as running_count,
                    COUNT(*) as total_count
                FROM equipment_status_ts
                WHERE equipment_id = %s
                    AND time BETWEEN %s AND %s
            """, (equipment_id, start_date, end_date))
            
            status_row = cursor.fetchone()
            running_count = status_row[0] if status_row else 0
            total_count = status_row[1] if status_row else 1
            
            # OEE 구성 요소 계산
            availability = safe_divide(running_count, total_count, 0.0)
            
            # Performance는 실제로는 사이클 타임 기반으로 계산해야 하지만
            # 여기서는 간단하게 가정값 사용
            performance = 0.90  # 90% (실제 구현 시 사이클 타임 데이터 필요)
            
            quality = safe_divide(good_count, total_produced, 0.0)
            
            # OEE 계산
            oee = availability * performance * quality
            
            logger.info(
                f"OEE 계산 완료: {equipment_id} = {oee*100:.2f}% "
                f"(A:{availability*100:.2f}%, P:{performance*100:.2f}%, Q:{quality*100:.2f}%)"
            )
            
            result = {
                "equipment_id": equipment_id,
                "oee": round(oee * 100, 2),
                "good_count": int(good_count),
                "defect_count": int(total_defects),
                "total_produced": int(total_produced),
                "data_points": row[2]
            }
            
            if include_components:
                result["components"] = {
                    "availability": round(availability * 100, 2),
                    "performance": round(performance * 100, 2),
                    "quality": round(quality * 100, 2)
                }
        
        else:
            # 전체 설비 평균 OEE 계산
            logger.debug("전체 설비 평균 OEE 계산")
            
            cursor.execute("""
                SELECT 
                    equipment_id,
                    COALESCE(SUM(quantity_produced), 0) as total_produced,
                    COALESCE(SUM(defect_count), 0) as total_defects
                FROM production_ts
                WHERE time BETWEEN %s AND %s
                GROUP BY equipment_id
                HAVING SUM(quantity_produced) > 0
            """, (start_date, end_date))
            
            equipment_oees = []
            total_good = 0
            total_defects = 0
            
            for row in cursor.fetchall():
                eq_id = row[0]
                produced = row[1]
                defects = row[2]
                good = produced - defects
                
                quality = safe_divide(good, produced, 0.0)
                availability = 0.85  # 가정값
                performance = 0.90   # 가정값
                oee = availability * performance * quality
                
                equipment_oees.append({
                    "equipment_id": eq_id,
                    "oee": round(oee * 100, 2),
                    "quality": round(quality * 100, 2)
                })
                
                total_good += good
                total_defects += defects
            
            if not equipment_oees:
                logger.warning("전체 설비 생산 데이터 없음")
                return {
                    "average_oee": 0.0,
                    "equipment_count": 0,
                    "message": "해당 기간에 생산 데이터가 없습니다",
                    "period": {"start": start_date, "end": end_date}
                }
            
            # 평균 계산
            avg_oee = sum(e["oee"] for e in equipment_oees) / len(equipment_oees)
            
            logger.info(
                f"전체 OEE 계산 완료: {avg_oee:.2f}% "
                f"({len(equipment_oees)}개 설비)"
            )
            
            result = {
                "average_oee": round(avg_oee, 2),
                "equipment_count": len(equipment_oees),
                "total_good": int(total_good),
                "total_defects": int(total_defects),
                "equipment_oees": equipment_oees[:10]  # 상위 10개만
            }
        
        cursor.close()
        
        result["period"] = {"start": start_date, "end": end_date}
        return result
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        handle_db_error(e, "OEE 계산")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# MTBF/MTTR 계산
# ============================================================================

@router.get("/mtbf-mttr")
@handle_errors
async def calculate_mtbf_mttr(
    equipment_id: Optional[str] = Query(
        None,
        description="특정 설비 ID"
    ),
    start_date: Optional[str] = Query(
        None,
        description="시작 날짜"
    ),
    end_date: Optional[str] = Query(
        None,
        description="종료 날짜"
    ),
    failure_severity: str = Query(
        default="CRITICAL",
        regex="^(CRITICAL|WARNING|ALL)$",
        description="고장으로 간주할 알람 심각도"
    )
):
    """
    MTBF/MTTR 계산
    
    - MTBF (Mean Time Between Failures): 평균 고장 간격
    - MTTR (Mean Time To Repair): 평균 수리 시간
    - Availability = MTBF / (MTBF + MTTR)
    """
    logger.info(
        f"MTBF/MTTR 계산: equipment_id={equipment_id}, "
        f"severity={failure_severity}"
    )
    
    # 설비 ID 검증
    if equipment_id:
        validate_equipment_id(equipment_id)
    
    # 날짜 범위 설정
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range(days=30)
    else:
        validate_calculation_period(start_date, end_date, max_days=365)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if equipment_id:
            # 특정 설비 MTBF/MTTR
            logger.debug(f"특정 설비 MTBF/MTTR: {equipment_id}")
            
            # 고장 횟수 조회
            severity_filter = (
                "severity = 'CRITICAL'" if failure_severity == "CRITICAL"
                else "severity IN ('CRITICAL', 'WARNING')" if failure_severity == "WARNING"
                else "1=1"  # ALL
            )
            
            query = f"""
                SELECT 
                    COUNT(*) as failure_count,
                    COALESCE(AVG(
                        EXTRACT(EPOCH FROM (cleared_at - time)) / 3600
                    ), 0) as avg_repair_hours
                FROM alarms_ts
                WHERE equipment_id = %s
                    AND time BETWEEN %s AND %s
                    AND {severity_filter}
                    AND cleared_at IS NOT NULL
            """
            
            cursor.execute(query, (equipment_id, start_date, end_date))
            row = cursor.fetchone()
            
            failure_count = row[0] if row else 0
            avg_repair_hours = row[1] if row and row[1] else 0
            
            # 기간 계산 (시간)
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            period_hours = (end_dt - start_dt).total_seconds() / 3600
            
            # MTBF 계산
            if failure_count > 0:
                mtbf = period_hours / failure_count
            else:
                mtbf = period_hours  # 고장 없음 = 전체 기간
                logger.debug(f"고장 없음: MTBF = {mtbf:.2f}시간")
            
            # MTTR 계산
            mttr = avg_repair_hours
            
            # Availability 계산
            availability = safe_percentage(mtbf, mtbf + mttr, decimals=2)
            
            logger.info(
                f"MTBF/MTTR 계산 완료: {equipment_id} - "
                f"MTBF={mtbf:.2f}h, MTTR={mttr:.2f}h, "
                f"Availability={availability:.2f}%"
            )
            
            result = {
                "equipment_id": equipment_id,
                "mtbf_hours": round(mtbf, 2),
                "mttr_hours": round(mttr, 2),
                "failure_count": failure_count,
                "availability_percent": availability,
                "period_hours": round(period_hours, 2)
            }
        
        else:
            # 전체 설비 평균
            logger.debug("전체 설비 MTBF/MTTR")
            
            severity_filter = (
                "severity = 'CRITICAL'" if failure_severity == "CRITICAL"
                else "severity IN ('CRITICAL', 'WARNING')" if failure_severity == "WARNING"
                else "1=1"
            )
            
            query = f"""
                SELECT 
                    equipment_id,
                    COUNT(*) as failure_count,
                    COALESCE(AVG(
                        EXTRACT(EPOCH FROM (cleared_at - time)) / 3600
                    ), 0) as avg_repair_hours
                FROM alarms_ts
                WHERE time BETWEEN %s AND %s
                    AND {severity_filter}
                    AND cleared_at IS NOT NULL
                GROUP BY equipment_id
            """
            
            cursor.execute(query, (start_date, end_date))
            
            equipment_stats = []
            total_failures = 0
            
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            period_hours = (end_dt - start_dt).total_seconds() / 3600
            
            for row in cursor.fetchall():
                eq_id = row[0]
                failures = row[1]
                avg_repair = row[2]
                
                mtbf = safe_divide(period_hours, failures, period_hours)
                mttr = avg_repair
                
                equipment_stats.append({
                    "equipment_id": eq_id,
                    "mtbf_hours": round(mtbf, 2),
                    "mttr_hours": round(mttr, 2),
                    "failure_count": failures,
                    "availability_percent": safe_percentage(mtbf, mtbf + mttr)
                })
                
                total_failures += failures
            
            if not equipment_stats:
                logger.warning("MTBF/MTTR 계산: 고장 데이터 없음")
                return {
                    "average_mtbf_hours": round(period_hours, 2),
                    "average_mttr_hours": 0.0,
                    "equipment_count": 0,
                    "total_failures": 0,
                    "message": "해당 기간에 고장 데이터가 없습니다",
                    "period": {"start": start_date, "end": end_date}
                }
            
            avg_mtbf = sum(e["mtbf_hours"] for e in equipment_stats) / len(equipment_stats)
            avg_mttr = sum(e["mttr_hours"] for e in equipment_stats) / len(equipment_stats)
            avg_availability = sum(e["availability_percent"] for e in equipment_stats) / len(equipment_stats)
            
            logger.info(
                f"전체 MTBF/MTTR: MTBF={avg_mtbf:.2f}h, MTTR={avg_mttr:.2f}h, "
                f"설비={len(equipment_stats)}개"
            )
            
            result = {
                "average_mtbf_hours": round(avg_mtbf, 2),
                "average_mttr_hours": round(avg_mttr, 2),
                "average_availability_percent": round(avg_availability, 2),
                "equipment_count": len(equipment_stats),
                "total_failures": total_failures,
                "equipment_stats": equipment_stats[:10]  # 상위 10개
            }
        
        cursor.close()
        
        result["period"] = {"start": start_date, "end": end_date}
        result["failure_severity_filter"] = failure_severity
        
        return result
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        handle_db_error(e, "MTBF/MTTR 계산")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# Pareto 분석
# ============================================================================

@router.get("/pareto")
@handle_errors
async def pareto_analysis(
    analysis_type: str = Query(
        default="alarm",
        regex="^(alarm|defect|downtime)$",
        description="분석 유형"
    ),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    top_n: int = Query(
        default=10,
        ge=5,
        le=50,
        description="상위 N개 항목"
    )
):
    """
    Pareto 분석 (80/20 법칙)
    
    - alarm: 알람 코드별 발생 빈도
    - defect: 설비별 불량 발생
    - downtime: 설비별 다운타임
    """
    logger.info(f"Pareto 분석: type={analysis_type}, top_n={top_n}")
    
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
            # 알람 코드별 발생 빈도
            logger.debug("Pareto 분석: 알람 코드별")
            
            cursor.execute("""
                SELECT 
                    COALESCE(code, 'UNKNOWN') as alarm_code,
                    COUNT(*) as count,
                    severity
                FROM alarms_ts
                WHERE time BETWEEN %s AND %s
                GROUP BY code, severity
                ORDER BY count DESC
                LIMIT %s
            """, (start_date, end_date, top_n))
            
            for row in cursor.fetchall():
                count = row[1]
                total_count += count
                items.append({
                    "code": row[0],
                    "count": count,
                    "severity": row[2]
                })
        
        elif analysis_type == "defect":
            # 설비별 불량 발생
            logger.debug("Pareto 분석: 설비별 불량")
            
            cursor.execute("""
                SELECT 
                    equipment_id,
                    COALESCE(SUM(defect_count), 0) as total_defects
                FROM production_ts
                WHERE time BETWEEN %s AND %s
                GROUP BY equipment_id
                HAVING SUM(defect_count) > 0
                ORDER BY total_defects DESC
                LIMIT %s
            """, (start_date, end_date, top_n))
            
            for row in cursor.fetchall():
                defects = row[1]
                total_count += defects
                items.append({
                    "equipment_id": row[0],
                    "count": int(defects)
                })
        
        elif analysis_type == "downtime":
            # 설비별 다운타임
            logger.debug("Pareto 분석: 설비별 다운타임")
            
            cursor.execute("""
                SELECT 
                    equipment_id,
                    COUNT(*) as downtime_count
                FROM equipment_status_ts
                WHERE time BETWEEN %s AND %s
                    AND status IN ('ERROR', 'ALARM', 'IDLE')
                GROUP BY equipment_id
                ORDER BY downtime_count DESC
                LIMIT %s
            """, (start_date, end_date, top_n))
            
            for row in cursor.fetchall():
                count = row[1]
                total_count += count
                items.append({
                    "equipment_id": row[0],
                    "count": count
                })
        
        cursor.close()
        
        if not items:
            logger.warning(f"Pareto 분석: 데이터 없음 (type={analysis_type})")
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
            f"Pareto 분석 완료: {len(items)}개 항목, "
            f"80% 지점: {pareto_80_index + 1}번째 항목"
        )
        
        return {
            "analysis_type": analysis_type,
            "period": {"start": start_date, "end": end_date},
            "items": items,
            "total_count": total_count,
            "pareto_80_index": pareto_80_index,
            "summary": {
                "top_items_contribution": items[0]["cumulative_percentage"] if items else 0,
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
# 트렌드 분석
# ============================================================================

@router.get("/trends")
@handle_errors
async def get_trends(
    metric: str = Query(
        default="production",
        regex="^(production|defect|alarm|oee)$",
        description="트렌드 지표"
    ),
    equipment_id: Optional[str] = Query(
        None,
        description="특정 설비 ID"
    ),
    interval: str = Query(
        default="1day",
        regex="^(1hour|1day|1week)$",
        description="시간 간격"
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
    
    TimescaleDB의 time_bucket 함수를 활용하여
    지정된 간격으로 데이터를 집계합니다.
    """
    logger.info(
        f"트렌드 분석: metric={metric}, equipment={equipment_id}, "
        f"interval={interval}, limit={limit}"
    )
    
    # 설비 ID 검증
    if equipment_id:
        validate_equipment_id(equipment_id)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 간격 매핑
        interval_map = {
            "1hour": "1 hour",
            "1day": "1 day",
            "1week": "1 week"
        }
        bucket_interval = interval_map[interval]
        
        trends = []
        
        if metric == "production":
            # 생산량 트렌드
            logger.debug(f"생산량 트렌드 (interval={interval})")
            
            base_query = """
                SELECT 
                    time_bucket(%s, time) as bucket,
                    COALESCE(SUM(quantity_produced), 0) as total_produced,
                    COALESCE(SUM(defect_count), 0) as total_defects
                FROM production_ts
                WHERE 1=1
            """
            params = [bucket_interval]
            
            if equipment_id:
                base_query += " AND equipment_id = %s"
                params.append(equipment_id)
            
            base_query += """
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT %s
            """
            params.append(limit)
            
            cursor.execute(base_query, params)
            
            for row in cursor.fetchall():
                produced = int(row[1])
                defects = int(row[2])
                good = produced - defects
                
                trends.append({
                    "timestamp": row[0].isoformat(),
                    "total": produced,
                    "good": good,
                    "defect": defects,
                    "yield_percent": safe_percentage(good, produced)
                })
        
        elif metric == "defect":
            # 불량률 트렌드
            logger.debug(f"불량률 트렌드 (interval={interval})")
            
            base_query = """
                SELECT 
                    time_bucket(%s, time) as bucket,
                    COALESCE(SUM(quantity_produced), 0) as total,
                    COALESCE(SUM(defect_count), 0) as defects
                FROM production_ts
                WHERE 1=1
            """
            params = [bucket_interval]
            
            if equipment_id:
                base_query += " AND equipment_id = %s"
                params.append(equipment_id)
            
            base_query += """
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT %s
            """
            params.append(limit)
            
            cursor.execute(base_query, params)
            
            for row in cursor.fetchall():
                total = int(row[1])
                defects = int(row[2])
                
                trends.append({
                    "timestamp": row[0].isoformat(),
                    "total_produced": total,
                    "defect_count": defects,
                    "defect_rate_percent": safe_percentage(defects, total)
                })
        
        elif metric == "alarm":
            # 알람 발생 트렌드
            logger.debug(f"알람 트렌드 (interval={interval})")
            
            base_query = """
                SELECT 
                    time_bucket(%s, time) as bucket,
                    COUNT(*) as alarm_count,
                    COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_count,
                    COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) as warning_count
                FROM alarms_ts
                WHERE 1=1
            """
            params = [bucket_interval]
            
            if equipment_id:
                base_query += " AND equipment_id = %s"
                params.append(equipment_id)
            
            base_query += """
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT %s
            """
            params.append(limit)
            
            cursor.execute(base_query, params)
            
            for row in cursor.fetchall():
                trends.append({
                    "timestamp": row[0].isoformat(),
                    "total_alarms": row[1],
                    "critical": row[2],
                    "warning": row[3]
                })
        
        elif metric == "oee":
            # OEE 트렌드
            logger.debug(f"OEE 트렌드 (interval={interval})")
            
            base_query = """
                SELECT 
                    time_bucket(%s, time) as bucket,
                    COALESCE(AVG(oee), 0) as avg_oee
                FROM equipment_status_ts
                WHERE oee IS NOT NULL
            """
            params = [bucket_interval]
            
            if equipment_id:
                base_query += " AND equipment_id = %s"
                params.append(equipment_id)
            
            base_query += """
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT %s
            """
            params.append(limit)
            
            cursor.execute(base_query, params)
            
            for row in cursor.fetchall():
                trends.append({
                    "timestamp": row[0].isoformat(),
                    "oee_percent": round(row[1], 2)
                })
        
        cursor.close()
        
        if not trends:
            logger.warning(f"트렌드 데이터 없음: metric={metric}")
            return {
                "metric": metric,
                "equipment_id": equipment_id,
                "interval": interval,
                "trends": [],
                "count": 0,
                "message": "해당 조건의 트렌드 데이터가 없습니다"
            }
        
        # 시간순 정렬 (오래된 것부터)
        trends.reverse()
        
        logger.info(f"트렌드 분석 완료: {len(trends)}개 데이터 포인트")
        
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
        # TimescaleDB 함수 에러 처리
        error_msg = str(e).lower()
        if "time_bucket" in error_msg:
            logger.error(f"TimescaleDB time_bucket 에러: {e}")
            raise DatabaseError(
                "시계열 집계 함수 오류 (TimescaleDB 확장이 필요할 수 있습니다)",
                details={"error": str(e)}
            )
        handle_db_error(e, "트렌드 분석")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 종합 대시보드 데이터
# ============================================================================

@router.get("/dashboard")
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
    
    OEE, MTBF, 생산량, 알람 등 주요 지표를 한 번에 조회합니다.
    """
    logger.info(f"대시보드 요약 데이터 조회: {period_days}일")
    
    start_date, end_date = get_default_date_range(days=period_days)
    
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
        
        # 1. 생산 요약
        cursor.execute("""
            SELECT 
                COALESCE(SUM(quantity_produced), 0) as total_produced,
                COALESCE(SUM(defect_count), 0) as total_defects
            FROM production_ts
            WHERE time BETWEEN %s AND %s
        """, (start_date, end_date))
        
        prod_row = cursor.fetchone()
        produced = int(prod_row[0])
        defects = int(prod_row[1])
        good = produced - defects
        
        dashboard["production"] = {
            "total": produced,
            "good": good,
            "defect": defects,
            "yield_percent": safe_percentage(good, produced)
        }
        
        # 2. 알람 요약
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical,
                COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) as warning
            FROM alarms_ts
            WHERE time BETWEEN %s AND %s
        """, (start_date, end_date))
        
        alarm_row = cursor.fetchone()
        dashboard["alarms"] = {
            "total": alarm_row[0],
            "critical": alarm_row[1],
            "warning": alarm_row[2]
        }
        
        # 3. 평균 OEE (간단 계산)
        total_quality = safe_divide(good, produced, 0.0)
        avg_oee = 0.85 * 0.90 * total_quality  # A * P * Q
        
        dashboard["oee"] = {
            "average_percent": round(avg_oee * 100, 2),
            "quality_percent": round(total_quality * 100, 2)
        }
        
        # 4. 평균 MTBF (간단 계산)
        cursor.execute("""
            SELECT COUNT(DISTINCT equipment_id) as equipment_count,
                   COUNT(*) as failure_count
            FROM alarms_ts
            WHERE time BETWEEN %s AND %s
                AND severity = 'CRITICAL'
        """, (start_date, end_date))
        
        mtbf_row = cursor.fetchone()
        eq_count = mtbf_row[0]
        failures = mtbf_row[1]
        
        period_hours = period_days * 24
        avg_mtbf = safe_divide(period_hours * eq_count, failures, period_hours)
        
        dashboard["reliability"] = {
            "average_mtbf_hours": round(avg_mtbf, 2),
            "total_failures": failures,
            "equipment_count": eq_count
        }
        
        cursor.close()
        
        logger.info(f"대시보드 데이터 생성 완료")
        return dashboard
        
    except Exception as e:
        handle_db_error(e, "대시보드 요약 조회")
    
    finally:
        if conn:
            return_db_connection(conn)