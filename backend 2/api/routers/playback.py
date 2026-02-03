"""
재생 모드 API
- 과거 데이터 재생
- 타임라인 컨트롤
- 배속 재생
- 재생 범위 검증
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
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
# 설정 상수
# ============================================================================

# 재생 관련 제한
MAX_PLAYBACK_DAYS = 7  # 최대 재생 기간 (일)
MAX_PLAYBACK_SPEED = 100  # 최대 재생 속도
MIN_PLAYBACK_SPEED = 1  # 최소 재생 속도
MAX_SNAPSHOT_TOLERANCE = 300  # 최대 스냅샷 허용 오차 (초)


# ============================================================================
# 헬퍼 함수
# ============================================================================

def validate_playback_range(start_time: str, end_time: str):
    """
    재생 범위 검증
    
    Args:
        start_time: 시작 시간
        end_time: 종료 시간
    
    Raises:
        ValidationError: 재생 범위가 유효하지 않음
    """
    start, end = validate_date_range(start_time, end_time)
    
    # 미래 시간 체크
    now = datetime.now()
    if start > now:
        raise ValidationError(
            "재생 시작 시간이 미래입니다",
            field="start_time"
        )
    
    if end > now:
        logger.warning(f"재생 종료 시간이 미래: {end_time}")
        end = now
        end_time = now.isoformat()
    
    # 재생 기간 체크
    duration = end - start
    duration_days = duration.days + (duration.seconds / 86400)
    
    if duration_days > MAX_PLAYBACK_DAYS:
        raise ValidationError(
            f"재생 기간이 너무 깁니다 (최대 {MAX_PLAYBACK_DAYS}일): {duration_days:.1f}일",
            field="playback_range"
        )
    
    if duration.total_seconds() < 60:
        raise ValidationError(
            "재생 기간은 최소 1분 이상이어야 합니다",
            field="playback_range"
        )
    
    logger.debug(f"재생 범위 검증 완료: {duration_days:.1f}일")
    return start, end


def calculate_data_points(start: datetime, end: datetime, interval: str) -> int:
    """
    예상 데이터 포인트 수 계산
    
    Returns:
        예상 데이터 포인트 수
    """
    duration_seconds = (end - start).total_seconds()
    
    interval_seconds = {
        "1min": 60,
        "5min": 300,
        "10min": 600,
        "1hour": 3600
    }
    
    return int(duration_seconds / interval_seconds.get(interval, 3600))


# ============================================================================
# 재생 타임라인
# ============================================================================

@router.get("/timeline")
@handle_errors
async def get_playback_timeline(
    start_time: str = Query(..., description="재생 시작 시간 (ISO 8601)"),
    end_time: str = Query(..., description="재생 종료 시간 (ISO 8601)"),
    equipment_id: Optional[str] = Query(
        None,
        description="특정 설비 ID (없으면 전체)"
    ),
    interval: str = Query(
        default="1min",
        regex="^(1min|5min|10min|1hour)$",
        description="시간 간격"
    )
):
    """
    재생 타임라인 데이터
    
    지정된 시간 범위의 설비 상태를 시계열로 조회합니다.
    """
    logger.info(
        f"재생 타임라인 요청: {start_time} ~ {end_time}, "
        f"equipment={equipment_id}, interval={interval}"
    )
    
    # 재생 범위 검증
    start_dt, end_dt = validate_playback_range(start_time, end_time)
    
    # 설비 ID 검증
    if equipment_id:
        validate_equipment_id(equipment_id)
    
    # 예상 데이터 포인트 수
    estimated_points = calculate_data_points(start_dt, end_dt, interval)
    logger.debug(f"예상 데이터 포인트: {estimated_points}개")
    
    if estimated_points > 10000:
        logger.warning(f"데이터 포인트 수가 많음: {estimated_points}개")
        raise ValidationError(
            f"조회할 데이터 포인트가 너무 많습니다 ({estimated_points}개). "
            f"더 긴 간격을 선택하거나 기간을 줄여주세요.",
            field="data_size"
        )
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 간격 매핑
        interval_map = {
            "1min": "1 minute",
            "5min": "5 minutes",
            "10min": "10 minutes",
            "1hour": "1 hour"
        }
        bucket_interval = interval_map[interval]
        
        # 쿼리 구성 (parameterized query 사용)
        if equipment_id:
            # 특정 설비
            query = """
                SELECT 
                    time_bucket(%s, time) as bucket,
                    equipment_id,
                    AVG(temperature) as avg_temp,
                    AVG(vibration) as avg_vibration,
                    mode() WITHIN GROUP (ORDER BY status) as common_status
                FROM equipment_status_ts
                WHERE equipment_id = %s
                    AND time BETWEEN %s AND %s
                GROUP BY bucket, equipment_id
                ORDER BY bucket
            """
            params = (bucket_interval, equipment_id, start_time, end_time)
        else:
            # 전체 설비
            query = """
                SELECT 
                    time_bucket(%s, time) as bucket,
                    equipment_id,
                    AVG(temperature) as avg_temp,
                    AVG(vibration) as avg_vibration,
                    mode() WITHIN GROUP (ORDER BY status) as common_status
                FROM equipment_status_ts
                WHERE time BETWEEN %s AND %s
                GROUP BY bucket, equipment_id
                ORDER BY bucket, equipment_id
            """
            params = (bucket_interval, start_time, end_time)
        
        cursor.execute(query, params)
        
        timeline_data = []
        for row in cursor.fetchall():
            timeline_data.append({
                "timestamp": row[0].isoformat(),
                "equipment_id": row[1],
                "temperature": round(float(row[2]), 2) if row[2] else None,
                "vibration": round(float(row[3]), 2) if row[3] else None,
                "status": row[4]
            })
        
        cursor.close()
        
        if not timeline_data:
            logger.warning(f"재생 데이터 없음: {start_time} ~ {end_time}")
            return {
                "timeline": [],
                "count": 0,
                "period": {"start": start_time, "end": end_time},
                "interval": interval,
                "message": "해당 기간에 재생할 데이터가 없습니다"
            }
        
        logger.info(f"재생 타임라인 조회 완료: {len(timeline_data)}개 데이터 포인트")
        
        return {
            "timeline": timeline_data,
            "count": len(timeline_data),
            "period": {
                "start": start_time,
                "end": end_time,
                "duration_seconds": (end_dt - start_dt).total_seconds()
            },
            "interval": interval,
            "equipment_filter": equipment_id
        }
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        # TimescaleDB 함수 에러 처리
        error_msg = str(e).lower()
        if "time_bucket" in error_msg or "mode()" in error_msg:
            logger.error(f"TimescaleDB 함수 에러: {e}")
            raise DatabaseError(
                "시계열 집계 함수 오류 (TimescaleDB 확장이 필요할 수 있습니다)",
                details={"error": str(e)}
            )
        handle_db_error(e, "재생 타임라인 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 특정 시점 스냅샷
# ============================================================================

@router.get("/snapshot")
@handle_errors
async def get_snapshot_at_time(
    timestamp: str = Query(..., description="스냅샷 시간 (ISO 8601)"),
    tolerance_seconds: int = Query(
        default=60,
        ge=1,
        le=MAX_SNAPSHOT_TOLERANCE,
        description="허용 오차 (초)"
    ),
    equipment_ids: Optional[str] = Query(
        None,
        description="특정 설비 ID 목록 (쉼표 구분)"
    )
):
    """
    특정 시점 스냅샷 (전체 또는 특정 설비 상태)
    
    지정된 시간에 가장 가까운 설비 상태를 조회합니다.
    """
    logger.info(f"스냅샷 요청: {timestamp}, tolerance={tolerance_seconds}초")
    
    # 날짜 형식 검증
    try:
        snapshot_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except ValueError as e:
        raise ValidationError(
            f"잘못된 날짜 형식: {timestamp}",
            field="timestamp"
        )
    
    # 미래 시간 체크
    if snapshot_time > datetime.now():
        raise ValidationError(
            "미래 시간의 스냅샷은 조회할 수 없습니다",
            field="timestamp"
        )
    
    # 설비 ID 목록 파싱 및 검증
    equipment_filter = None
    if equipment_ids:
        equipment_filter = [eq_id.strip() for eq_id in equipment_ids.split(',')]
        for eq_id in equipment_filter:
            validate_equipment_id(eq_id)
        logger.debug(f"설비 필터: {len(equipment_filter)}개")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 쿼리 구성
        if equipment_filter:
            placeholders = ','.join(['%s'] * len(equipment_filter))
            query = f"""
                SELECT DISTINCT ON (equipment_id)
                    equipment_id,
                    status,
                    temperature,
                    vibration,
                    time
                FROM equipment_status_ts
                WHERE equipment_id IN ({placeholders})
                    AND time BETWEEN 
                        %s::timestamp - INTERVAL '%s seconds' AND
                        %s::timestamp + INTERVAL '%s seconds'
                ORDER BY equipment_id, ABS(EXTRACT(EPOCH FROM (time - %s::timestamp)))
            """
            params = equipment_filter + [timestamp, tolerance_seconds, timestamp, tolerance_seconds, timestamp]
        else:
            query = """
                SELECT DISTINCT ON (equipment_id)
                    equipment_id,
                    status,
                    temperature,
                    vibration,
                    time
                FROM equipment_status_ts
                WHERE time BETWEEN 
                    %s::timestamp - INTERVAL '%s seconds' AND
                    %s::timestamp + INTERVAL '%s seconds'
                ORDER BY equipment_id, ABS(EXTRACT(EPOCH FROM (time - %s::timestamp)))
            """
            params = [timestamp, tolerance_seconds, timestamp, tolerance_seconds, timestamp]
        
        cursor.execute(query, params)
        
        snapshot = []
        for row in cursor.fetchall():
            time_diff = abs((row[4] - snapshot_time).total_seconds())
            
            snapshot.append({
                "equipment_id": row[0],
                "status": row[1],
                "temperature": round(float(row[2]), 2) if row[2] else None,
                "vibration": round(float(row[3]), 2) if row[3] else None,
                "actual_timestamp": row[4].isoformat(),
                "time_difference_seconds": round(time_diff, 2)
            })
        
        cursor.close()
        
        if not snapshot:
            logger.warning(f"스냅샷 데이터 없음: {timestamp}")
            return {
                "requested_timestamp": timestamp,
                "snapshot": [],
                "count": 0,
                "message": "해당 시간의 데이터가 없습니다"
            }
        
        logger.info(f"스냅샷 조회 완료: {len(snapshot)}개 설비")
        
        return {
            "requested_timestamp": timestamp,
            "tolerance_seconds": tolerance_seconds,
            "snapshot": snapshot,
            "count": len(snapshot),
            "equipment_filter": equipment_ids
        }
        
    except ValidationError:
        raise
    except Exception as e:
        handle_db_error(e, "스냅샷 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 이벤트 조회
# ============================================================================

@router.get("/events")
@handle_errors
async def get_events_in_range(
    start_time: str = Query(..., description="시작 시간"),
    end_time: str = Query(..., description="종료 시간"),
    event_types: Optional[str] = Query(
        None,
        description="이벤트 유형 (쉼표 구분): alarm,status_change,production"
    ),
    equipment_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(
        None,
        regex="^(CRITICAL|WARNING|INFO)$",
        description="알람 심각도 필터"
    ),
    limit: int = Query(default=500, ge=1, le=5000)
):
    """
    기간 내 주요 이벤트 조회
    
    알람, 상태 변경, 생산 이벤트 등을 시계열로 조회합니다.
    """
    logger.info(
        f"이벤트 조회: {start_time} ~ {end_time}, "
        f"types={event_types}, equipment={equipment_id}"
    )
    
    # 재생 범위 검증
    start_dt, end_dt = validate_playback_range(start_time, end_time)
    
    # 설비 ID 검증
    if equipment_id:
        validate_equipment_id(equipment_id)
    
    # 이벤트 유형 파싱
    selected_types = []
    if event_types:
        selected_types = [t.strip() for t in event_types.split(',')]
        valid_types = ['alarm', 'status_change', 'production']
        invalid = [t for t in selected_types if t not in valid_types]
        if invalid:
            raise ValidationError(
                f"유효하지 않은 이벤트 유형: {invalid}",
                field="event_types"
            )
    else:
        selected_types = ['alarm']  # 기본값
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        events = []
        
        # 1. 알람 이벤트
        if 'alarm' in selected_types:
            alarm_query = """
                SELECT 
                    equipment_id,
                    'alarm' as type,
                    code as detail,
                    severity,
                    time,
                    message
                FROM alarms_ts
                WHERE time BETWEEN %s AND %s
            """
            params = [start_time, end_time]
            
            if equipment_id:
                alarm_query += " AND equipment_id = %s"
                params.append(equipment_id)
            
            if severity:
                alarm_query += " AND severity = %s"
                params.append(severity)
            
            alarm_query += " ORDER BY time LIMIT %s"
            params.append(limit)
            
            cursor.execute(alarm_query, params)
            
            for row in cursor.fetchall():
                events.append({
                    "equipment_id": row[0],
                    "type": row[1],
                    "detail": row[2],
                    "severity": row[3],
                    "timestamp": row[4].isoformat(),
                    "message": row[5]
                })
        
        # 2. 상태 변경 이벤트 (상태가 변경된 시점만)
        if 'status_change' in selected_types:
            # 이전 상태와 다른 경우만 조회 (LAG 함수 사용)
            status_query = """
                WITH status_changes AS (
                    SELECT 
                        equipment_id,
                        status,
                        time,
                        LAG(status) OVER (PARTITION BY equipment_id ORDER BY time) as prev_status
                    FROM equipment_status_ts
                    WHERE time BETWEEN %s AND %s
            """
            params = [start_time, end_time]
            
            if equipment_id:
                status_query += " AND equipment_id = %s"
                params.append(equipment_id)
            
            status_query += """
                )
                SELECT 
                    equipment_id,
                    'status_change' as type,
                    status as detail,
                    'INFO' as severity,
                    time
                FROM status_changes
                WHERE prev_status IS NOT NULL 
                    AND status != prev_status
                ORDER BY time
                LIMIT %s
            """
            params.append(limit)
            
            cursor.execute(status_query, params)
            
            for row in cursor.fetchall():
                events.append({
                    "equipment_id": row[0],
                    "type": row[1],
                    "detail": f"Status changed to {row[2]}",
                    "severity": row[3],
                    "timestamp": row[4].isoformat(),
                    "message": None
                })
        
        # 3. 생산 이벤트 (대량 생산 완료)
        if 'production' in selected_types:
            prod_query = """
                SELECT 
                    equipment_id,
                    'production' as type,
                    CAST(SUM(quantity_produced) AS TEXT) as detail,
                    'INFO' as severity,
                    time_bucket('1 hour', time) as time
                FROM production_ts
                WHERE time BETWEEN %s AND %s
            """
            params = [start_time, end_time]
            
            if equipment_id:
                prod_query += " AND equipment_id = %s"
                params.append(equipment_id)
            
            prod_query += """
                GROUP BY equipment_id, time_bucket('1 hour', time)
                HAVING SUM(quantity_produced) > 100
                ORDER BY time
                LIMIT %s
            """
            params.append(limit)
            
            cursor.execute(prod_query, params)
            
            for row in cursor.fetchall():
                events.append({
                    "equipment_id": row[0],
                    "type": row[1],
                    "detail": f"Produced {row[2]} units",
                    "severity": row[3],
                    "timestamp": row[4].isoformat(),
                    "message": None
                })
        
        cursor.close()
        
        # 시간 순 정렬
        events.sort(key=lambda x: x["timestamp"])
        
        # limit 적용 (모든 이벤트 합쳐서)
        events = events[:limit]
        
        logger.info(f"이벤트 조회 완료: {len(events)}개")
        
        return {
            "events": events,
            "count": len(events),
            "period": {
                "start": start_time,
                "end": end_time
            },
            "filters": {
                "event_types": selected_types,
                "equipment_id": equipment_id,
                "severity": severity
            }
        }
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        handle_db_error(e, "이벤트 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 재생 속도 계산
# ============================================================================

@router.get("/speed-calculator")
@handle_errors
async def calculate_playback_speed(
    start_time: str = Query(..., description="재생 시작 시간"),
    end_time: str = Query(..., description="재생 종료 시간"),
    target_duration_seconds: Optional[int] = Query(
        None,
        ge=60,
        le=3600,
        description="목표 재생 시간 (초)"
    ),
    speed: Optional[int] = Query(
        None,
        ge=MIN_PLAYBACK_SPEED,
        le=MAX_PLAYBACK_SPEED,
        description="재생 속도 (배)"
    )
):
    """
    재생 속도 계산기
    
    실제 데이터 기간과 목표 재생 시간을 기반으로 필요한 재생 속도를 계산합니다.
    """
    logger.info(f"재생 속도 계산: {start_time} ~ {end_time}")
    
    # 재생 범위 검증
    start_dt, end_dt = validate_playback_range(start_time, end_time)
    
    duration_seconds = (end_dt - start_dt).total_seconds()
    duration_minutes = duration_seconds / 60
    duration_hours = duration_seconds / 3600
    
    result = {
        "period": {
            "start": start_time,
            "end": end_time,
            "duration_seconds": int(duration_seconds),
            "duration_minutes": round(duration_minutes, 2),
            "duration_hours": round(duration_hours, 2)
        }
    }
    
    # 속도 -> 재생 시간 계산
    if speed:
        if speed < MIN_PLAYBACK_SPEED or speed > MAX_PLAYBACK_SPEED:
            raise ValidationError(
                f"재생 속도는 {MIN_PLAYBACK_SPEED}x ~ {MAX_PLAYBACK_SPEED}x 사이여야 합니다",
                field="speed"
            )
        
        playback_seconds = duration_seconds / speed
        
        result["playback_config"] = {
            "speed": f"{speed}x",
            "playback_duration_seconds": int(playback_seconds),
            "playback_duration_minutes": round(playback_seconds / 60, 2)
        }
        
        logger.info(f"재생 시간 계산: {speed}x 속도로 {playback_seconds:.1f}초")
    
    # 목표 시간 -> 속도 계산
    elif target_duration_seconds:
        required_speed = duration_seconds / target_duration_seconds
        
        if required_speed > MAX_PLAYBACK_SPEED:
            logger.warning(f"계산된 속도가 최대치 초과: {required_speed:.1f}x")
            required_speed = MAX_PLAYBACK_SPEED
        elif required_speed < MIN_PLAYBACK_SPEED:
            required_speed = MIN_PLAYBACK_SPEED
        
        result["recommended_config"] = {
            "target_duration_seconds": target_duration_seconds,
            "required_speed": f"{required_speed:.1f}x",
            "actual_speed": f"{int(required_speed)}x",
            "actual_duration_seconds": int(duration_seconds / int(required_speed))
        }
        
        logger.info(f"필요 속도 계산: {required_speed:.1f}x")
    
    else:
        # 권장 속도 제안
        recommendations = []
        for spd in [1, 5, 10, 20, 50, 100]:
            if spd > MAX_PLAYBACK_SPEED:
                break
            playback_sec = duration_seconds / spd
            recommendations.append({
                "speed": f"{spd}x",
                "duration_seconds": int(playback_sec),
                "duration_minutes": round(playback_sec / 60, 2)
            })
        
        result["recommendations"] = recommendations
        logger.info(f"{len(recommendations)}가지 속도 옵션 제안")
    
    return result