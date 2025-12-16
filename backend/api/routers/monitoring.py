"""
실시간 모니터링 API
- 현재 장비 상태
- 알람 조회
- 실시간 통계
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import json
import logging

from ..database.connection import (
    get_db_connection, 
    return_db_connection, 
    get_redis
)
from ..utils.errors import (
    DatabaseError,
    NotFoundError,
    RedisError,
    ValidationError,
    handle_errors,
    handle_db_error,
    handle_redis_error,
    validate_equipment_id
)

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Redis 헬퍼 함수
# ============================================================================

async def get_redis_value(key: str, default: Any = None) -> Any:
    """
    Redis에서 값을 안전하게 가져오기
    
    Args:
        key: Redis 키
        default: 값이 없을 때 반환할 기본값
    
    Returns:
        Redis 값 (JSON 파싱됨) 또는 기본값
    
    Raises:
        RedisError: Redis 연결/조회 실패
    """
    try:
        redis_client = get_redis()
        data = await redis_client.get(key)
        
        if data is None:
            logger.debug(f"Redis 키 없음: {key}")
            return default
        
        # JSON 파싱 시도
        try:
            return json.loads(data)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON 파싱 실패 ({key}): {e}")
            return default
            
    except Exception as e:
        logger.error(f"Redis 조회 실패 ({key}): {e}")
        handle_redis_error(e, f"Redis 값 조회: {key}")


async def get_redis_keys_pattern(pattern: str) -> List[str]:
    """
    Redis에서 패턴 매칭 키 목록 가져오기
    
    Args:
        pattern: Redis 키 패턴 (예: "equipment:*:status")
    
    Returns:
        매칭된 키 목록
    
    Raises:
        RedisError: Redis 연결/조회 실패
    """
    try:
        redis_client = get_redis()
        keys = await redis_client.keys(pattern)
        
        # bytes를 string으로 변환 (필요시)
        if keys and isinstance(keys[0], bytes):
            keys = [key.decode('utf-8') for key in keys]
        
        logger.debug(f"Redis 키 패턴 '{pattern}' 매칭 결과: {len(keys)}개")
        return keys
        
    except Exception as e:
        logger.error(f"Redis 키 검색 실패 (패턴: {pattern}): {e}")
        handle_redis_error(e, f"Redis 키 검색: {pattern}")


# ============================================================================
# 현재 상태 조회
# ============================================================================

@router.get("/current-status")
@handle_errors
async def get_current_status(
    equipment_ids: Optional[str] = Query(
        None, 
        description="쉼표로 구분된 설비 ID 목록 (예: EQ-01-01,EQ-01-02)"
    )
):
    """
    전체 장비 현재 상태 조회 (Redis 캐시)
    
    설비 ID를 지정하지 않으면 모든 설비의 상태를 반환합니다.
    """
    logger.info(f"현재 상태 조회 요청 (필터: {equipment_ids})")
    
    try:
        redis_client = get_redis()
        
        # 특정 설비만 조회
        if equipment_ids:
            eq_list = [eq_id.strip() for eq_id in equipment_ids.split(',')]
            logger.info(f"특정 설비 조회: {len(eq_list)}개")
            
            current_status = []
            failed_ids = []
            
            for eq_id in eq_list:
                # ID 형식 검증
                try:
                    validate_equipment_id(eq_id)
                except ValidationError as e:
                    logger.warning(f"잘못된 설비 ID 형식: {eq_id}")
                    failed_ids.append(eq_id)
                    continue
                
                # Redis에서 상태 조회
                status_key = f"equipment:{eq_id}:status"
                status = await get_redis_value(status_key)
                
                if status:
                    current_status.append(status)
                else:
                    logger.debug(f"Redis에 상태 없음: {eq_id}")
            
            if failed_ids:
                logger.warning(f"유효하지 않은 설비 ID: {failed_ids}")
            
            return {
                "equipment_status": current_status,
                "count": len(current_status),
                "requested": len(eq_list),
                "failed_ids": failed_ids if failed_ids else None,
                "timestamp": datetime.now().isoformat()
            }
        
        # 모든 설비 조회
        else:
            logger.info("전체 설비 상태 조회")
            
            # Redis에서 모든 장비 상태 키 가져오기
            equipment_keys = await get_redis_keys_pattern("equipment:*:status")
            
            if not equipment_keys:
                logger.warning("Redis에 설비 상태 데이터 없음")
                return {
                    "equipment_status": [],
                    "count": 0,
                    "message": "현재 캐시된 설비 상태가 없습니다",
                    "timestamp": datetime.now().isoformat()
                }
            
            current_status = []
            parse_errors = 0
            
            for key in equipment_keys:
                try:
                    data = await redis_client.get(key)
                    if data:
                        status = json.loads(data)
                        current_status.append(status)
                except json.JSONDecodeError:
                    parse_errors += 1
                    logger.warning(f"JSON 파싱 실패: {key}")
                except Exception as e:
                    logger.error(f"데이터 조회 실패 ({key}): {e}")
            
            logger.info(
                f"전체 설비 상태 조회 완료: {len(current_status)}개 "
                f"(파싱 실패: {parse_errors})"
            )
            
            return {
                "equipment_status": current_status,
                "count": len(current_status),
                "parse_errors": parse_errors if parse_errors > 0 else None,
                "timestamp": datetime.now().isoformat()
            }
        
    except RedisError:
        # Redis 에러는 그대로 전파
        raise
    except Exception as e:
        logger.error(f"현재 상태 조회 중 예상치 못한 에러: {e}", exc_info=True)
        handle_redis_error(e, "현재 상태 조회")


# ============================================================================
# 알람 조회 (데이터베이스)
# ============================================================================

@router.get("/alarms")
@handle_errors
async def get_active_alarms(
    severity: Optional[str] = Query(
        None, 
        regex="^(CRITICAL|WARNING|INFO)$",
        description="알람 심각도 필터"
    ),
    equipment_id: Optional[str] = Query(
        None,
        description="특정 설비 필터"
    ),
    hours: int = Query(
        default=24,
        ge=1,
        le=168,  # 최대 1주일
        description="조회 기간 (시간)"
    ),
    limit: int = Query(
        default=50, 
        ge=1,
        le=500,
        description="최대 결과 수"
    )
):
    """
    활성 알람 조회
    
    지정된 기간 내의 알람을 조회합니다.
    """
    logger.info(
        f"알람 조회: severity={severity}, equipment={equipment_id}, "
        f"hours={hours}, limit={limit}"
    )
    
    # 설비 ID 검증
    if equipment_id:
        validate_equipment_id(equipment_id)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 동적 쿼리 생성
        query = """
            SELECT equipment_id, alarm_id, severity, code, 
                   message, time, acknowledged
            FROM alarms_ts
            WHERE time > NOW() - INTERVAL '%s hours'
        """
        params = [hours]
        
        # 심각도 필터
        if severity:
            query += " AND severity = %s"
            params.append(severity)
        
        # 설비 필터
        if equipment_id:
            query += " AND equipment_id = %s"
            params.append(equipment_id)
        
        query += " ORDER BY time DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        
        alarms = []
        for row in cursor.fetchall():
            alarms.append({
                "equipment_id": row[0],
                "alarm_id": row[1],
                "severity": row[2],
                "code": row[3],
                "message": row[4],
                "timestamp": row[5].isoformat(),
                "acknowledged": row[6]
            })
        
        cursor.close()
        
        logger.info(f"알람 조회 완료: {len(alarms)}건")
        
        return {
            "alarms": alarms,
            "count": len(alarms),
            "filters": {
                "severity": severity,
                "equipment_id": equipment_id,
                "hours": hours,
                "limit": limit
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except ValidationError:
        raise
    except Exception as e:
        handle_db_error(e, "알람 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 실시간 통계 (데이터베이스)
# ============================================================================

@router.get("/statistics")
@handle_errors
async def get_real_time_statistics():
    """
    실시간 통계 요약
    
    전체 설비 상태, 최근 알람, 생산량 등을 요약하여 반환합니다.
    """
    logger.info("실시간 통계 조회 요청")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. 장비 상태별 카운트
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM equipment
            GROUP BY status
        """)
        
        status_counts = {}
        total_equipment = 0
        for row in cursor.fetchall():
            status_counts[row[0]] = row[1]
            total_equipment += row[1]
        
        logger.debug(f"장비 상태: {status_counts}")
        
        # 2. 최근 1시간 알람 수 (심각도별)
        cursor.execute("""
            SELECT severity, COUNT(*) as count
            FROM alarms_ts
            WHERE time > NOW() - INTERVAL '1 hour'
            GROUP BY severity
        """)
        
        alarm_counts = {}
        total_alarms = 0
        for row in cursor.fetchall():
            alarm_counts[row[0]] = row[1]
            total_alarms += row[1]
        
        logger.debug(f"최근 알람: {alarm_counts}")
        
        # 3. 최근 1시간 생산량
        cursor.execute("""
            SELECT 
                SUM(quantity_produced) as total_produced,
                SUM(defect_count) as total_defects
            FROM production_ts
            WHERE time > NOW() - INTERVAL '1 hour'
        """)
        
        production = cursor.fetchone()
        good_count = production[0] or 0
        defect_count = production[1] or 0
        total_count = good_count + defect_count
        
        yield_rate = (good_count / total_count * 100) if total_count > 0 else 0
        
        logger.debug(f"생산량: 양품={good_count}, 불량={defect_count}")
        
        # 4. 현재 가동률 (간단 계산)
        running_count = status_counts.get('RUNNING', 0)
        availability = (running_count / total_equipment * 100) if total_equipment > 0 else 0
        
        cursor.close()
        
        logger.info("실시간 통계 조회 완료")
        
        return {
            "equipment": {
                "total": total_equipment,
                "by_status": status_counts,
                "availability_percent": round(availability, 2)
            },
            "alarms": {
                "last_hour": total_alarms,
                "by_severity": alarm_counts
            },
            "production": {
                "last_hour": {
                    "total": total_count,
                    "good": good_count,
                    "defect": defect_count,
                    "yield_percent": round(yield_rate, 2)
                }
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        handle_db_error(e, "실시간 통계 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 설비 실시간 데이터 (Redis)
# ============================================================================

@router.get("/equipment/{equipment_id}/live")
@handle_errors
async def get_equipment_live_data(equipment_id: str):
    """
    특정 장비 실시간 데이터 (Redis 캐시)
    
    Redis에 캐시된 최신 상태 및 생산 데이터를 반환합니다.
    """
    logger.info(f"설비 실시간 데이터 조회: {equipment_id}")
    
    # ID 형식 검증
    validate_equipment_id(equipment_id)
    
    try:
        redis_client = get_redis()
        
        # Redis 키 생성
        status_key = f"equipment:{equipment_id}:status"
        production_key = f"equipment:{equipment_id}:production"
        
        logger.debug(f"Redis 키 조회: {status_key}, {production_key}")
        
        # 데이터 조회
        status_data = await get_redis_value(status_key)
        production_data = await get_redis_value(production_key)
        
        # 둘 다 없으면 404
        if not status_data and not production_data:
            logger.warning(f"실시간 데이터 없음: {equipment_id}")
            raise NotFoundError(
                "실시간 데이터", 
                f"{equipment_id} (Redis 캐시에 데이터가 없습니다)"
            )
        
        # 응답 생성
        result = {
            "equipment_id": equipment_id,
            "timestamp": datetime.now().isoformat()
        }
        
        if status_data:
            result["status"] = status_data
            logger.debug(f"상태 데이터 조회 성공: {equipment_id}")
        
        if production_data:
            result["production"] = production_data
            logger.debug(f"생산 데이터 조회 성공: {equipment_id}")
        
        logger.info(f"설비 실시간 데이터 조회 완료: {equipment_id}")
        return result
        
    except (NotFoundError, ValidationError):
        raise
    except Exception as e:
        handle_redis_error(e, f"실시간 데이터 조회: {equipment_id}")


# ============================================================================
# 설비 상태 변경 이력 (Redis + DB 통합)
# ============================================================================

@router.get("/equipment/{equipment_id}/status-changes")
@handle_errors
async def get_equipment_status_changes(
    equipment_id: str,
    hours: int = Query(default=24, ge=1, le=168),
    include_current: bool = Query(default=True, description="현재 상태 포함 여부")
):
    """
    설비 상태 변경 이력 조회
    
    Redis 현재 상태 + DB 이력 데이터를 통합하여 반환합니다.
    """
    logger.info(f"상태 변경 이력 조회: {equipment_id}, hours={hours}")
    
    # ID 형식 검증
    validate_equipment_id(equipment_id)
    
    result = {
        "equipment_id": equipment_id,
        "period_hours": hours,
        "timestamp": datetime.now().isoformat()
    }
    
    # 1. 현재 상태 (Redis)
    if include_current:
        try:
            status_key = f"equipment:{equipment_id}:status"
            current_status = await get_redis_value(status_key)
            
            if current_status:
                result["current_status"] = current_status
                logger.debug(f"현재 상태 조회 성공: {equipment_id}")
            else:
                result["current_status"] = None
                logger.debug(f"Redis에 현재 상태 없음: {equipment_id}")
                
        except RedisError as e:
            logger.warning(f"Redis 조회 실패 (현재 상태는 제외): {e}")
            result["current_status"] = None
    
    # 2. 이력 데이터 (Database)
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT time, status, temperature, vibration
            FROM equipment_status_ts
            WHERE equipment_id = %s
                AND time > NOW() - INTERVAL '%s hours'
            ORDER BY time DESC
        """, (equipment_id, hours))
        
        history = []
        for row in cursor.fetchall():
            history.append({
                "timestamp": row[0].isoformat(),
                "status": row[1],
                "temperature": float(row[2]) if row[2] else None,
                "vibration": float(row[3]) if row[3] else None
            })
        
        cursor.close()
        
        result["history"] = history
        result["history_count"] = len(history)
        
        logger.info(f"상태 변경 이력 조회 완료: {equipment_id}, {len(history)}건")
        
        return result
        
    except Exception as e:
        handle_db_error(e, f"상태 변경 이력 조회: {equipment_id}")
    
    finally:
        if conn:
            return_db_connection(conn)


# ============================================================================
# 헬스체크 (Redis + DB)
# ============================================================================

@router.get("/health")
@handle_errors
async def check_monitoring_health():
    """
    모니터링 시스템 헬스체크
    
    Redis와 Database 연결 상태를 확인합니다.
    """
    logger.debug("모니터링 헬스체크")
    
    health = {
        "timestamp": datetime.now().isoformat(),
        "status": "healthy",
        "services": {}
    }
    
    # Redis 체크
    try:
        redis_client = get_redis()
        await redis_client.ping()
        health["services"]["redis"] = {
            "status": "healthy",
            "message": "연결 정상"
        }
        logger.debug("Redis 연결 정상")
    except Exception as e:
        health["services"]["redis"] = {
            "status": "unhealthy",
            "message": f"연결 실패: {str(e)}"
        }
        health["status"] = "degraded"
        logger.error(f"Redis 연결 실패: {e}")
    
    # Database 체크
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        
        health["services"]["database"] = {
            "status": "healthy",
            "message": "연결 정상"
        }
        logger.debug("Database 연결 정상")
    except Exception as e:
        health["services"]["database"] = {
            "status": "unhealthy",
            "message": f"연결 실패: {str(e)}"
        }
        health["status"] = "degraded"
        logger.error(f"Database 연결 실패: {e}")
    finally:
        if conn:
            return_db_connection(conn)
    
    return health