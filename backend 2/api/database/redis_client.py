"""
Redis 클라이언트 (성능 최적화)
"""

import os
import redis
from typing import List, Dict, Optional, Any
import json
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)


# ============================================================================
# Redis 설정
# ============================================================================

REDIS_CONFIG = {
    'host': os.getenv('REDIS_HOST', 'localhost'),
    'port': int(os.getenv('REDIS_PORT', 6379)),
    'db': int(os.getenv('REDIS_DB', 0)),
    'decode_responses': True,
    'socket_timeout': 5,
    'socket_connect_timeout': 5,
    # 연결 풀 설정
    'max_connections': 50,
    'retry_on_timeout': True
}

# Redis 클라이언트 (연결 풀 사용)
_redis_client = None
_redis_pool = None


def get_redis_client():
    """Redis 클라이언트 가져오기 (싱글톤)"""
    global _redis_client, _redis_pool
    
    if _redis_client is None:
        try:
            # 연결 풀 생성
            _redis_pool = redis.ConnectionPool(**REDIS_CONFIG)
            _redis_client = redis.Redis(connection_pool=_redis_pool)
            
            # 연결 테스트
            _redis_client.ping()
            logger.info("✓ Redis 연결 성공")
            
        except redis.ConnectionError as e:
            logger.error(f"Redis 연결 실패: {e}")
            raise
    
    return _redis_client


# ============================================================================
# 파이프라인 헬퍼 함수
# ============================================================================

@contextmanager
def redis_pipeline(transaction=True):
    """
    Redis 파이프라인 Context Manager
    
    Usage:
        with redis_pipeline() as pipe:
            pipe.set('key1', 'value1')
            pipe.set('key2', 'value2')
            # 자동으로 execute()
    
    Args:
        transaction: 트랜잭션 사용 여부
    """
    client = get_redis_client()
    pipe = client.pipeline(transaction=transaction)
    
    try:
        yield pipe
        pipe.execute()
    except redis.RedisError as e:
        logger.error(f"Redis 파이프라인 실행 실패: {e}")
        raise
    finally:
        pipe.reset()


def get_multiple(keys: List[str]) -> Dict[str, Any]:
    """
    여러 키를 한 번에 조회 (파이프라인 사용)
    
    Args:
        keys: 키 리스트
    
    Returns:
        dict: {key: value} 딕셔너리
    """
    if not keys:
        return {}
    
    client = get_redis_client()
    
    try:
        # 파이프라인으로 한 번에 조회
        with redis_pipeline(transaction=False) as pipe:
            for key in keys:
                pipe.get(key)
        
        values = pipe.execute()
        
        # 결과 매핑
        result = {}
        for key, value in zip(keys, values):
            if value:
                try:
                    result[key] = json.loads(value)
                except json.JSONDecodeError:
                    result[key] = value
        
        return result
        
    except Exception as e:
        logger.error(f"다중 키 조회 실패: {e}")
        return {}


def set_multiple(data: Dict[str, Any], expire: Optional[int] = None) -> bool:
    """
    여러 키를 한 번에 설정 (파이프라인 사용)
    
    Args:
        data: {key: value} 딕셔너리
        expire: 만료 시간 (초)
    
    Returns:
        bool: 성공 여부
    """
    if not data:
        return True
    
    try:
        with redis_pipeline() as pipe:
            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    value = json.dumps(value)
                
                if expire:
                    pipe.setex(key, expire, value)
                else:
                    pipe.set(key, value)
        
        logger.debug(f"다중 키 설정 완료: {len(data)}개")
        return True
        
    except Exception as e:
        logger.error(f"다중 키 설정 실패: {e}")
        return False


def delete_multiple(keys: List[str]) -> int:
    """
    여러 키를 한 번에 삭제 (파이프라인 사용)
    
    Args:
        keys: 키 리스트
    
    Returns:
        int: 삭제된 키 개수
    """
    if not keys:
        return 0
    
    client = get_redis_client()
    
    try:
        # 파이프라인으로 한 번에 삭제
        with redis_pipeline() as pipe:
            for key in keys:
                pipe.delete(key)
        
        results = pipe.execute()
        deleted_count = sum(results)
        
        logger.debug(f"다중 키 삭제 완료: {deleted_count}개")
        return deleted_count
        
    except Exception as e:
        logger.error(f"다중 키 삭제 실패: {e}")
        return 0


# ============================================================================
# 설비 상태 관련 최적화 함수
# ============================================================================

def get_all_equipment_status() -> Dict[str, Dict]:
    """
    전체 설비 상태 조회 (최적화)
    
    Returns:
        dict: {equipment_id: status_data}
    """
    client = get_redis_client()
    
    try:
        # 1. 패턴 매칭으로 모든 키 가져오기
        pattern = "equipment:status:*"
        keys = list(client.scan_iter(match=pattern, count=100))
        
        if not keys:
            return {}
        
        # 2. 파이프라인으로 한 번에 조회
        values = get_multiple(keys)
        
        # 3. equipment_id 추출
        result = {}
        for key, value in values.items():
            equipment_id = key.replace("equipment:status:", "")
            result[equipment_id] = value
        
        logger.debug(f"전체 설비 상태 조회: {len(result)}개")
        return result
        
    except Exception as e:
        logger.error(f"전체 설비 상태 조회 실패: {e}")
        return {}


def get_equipment_status_batch(equipment_ids: List[str]) -> Dict[str, Dict]:
    """
    여러 설비 상태 배치 조회
    
    Args:
        equipment_ids: 설비 ID 리스트
    
    Returns:
        dict: {equipment_id: status_data}
    """
    if not equipment_ids:
        return {}
    
    # Redis 키 생성
    keys = [f"equipment:status:{eq_id}" for eq_id in equipment_ids]
    
    # 파이프라인으로 조회
    values = get_multiple(keys)
    
    # equipment_id로 매핑
    result = {}
    for eq_id, key in zip(equipment_ids, keys):
        if key in values:
            result[eq_id] = values[key]
    
    logger.debug(f"배치 설비 상태 조회: {len(result)}/{len(equipment_ids)}개")
    return result


def update_equipment_status_batch(status_data: Dict[str, Dict], expire: int = 3600) -> bool:
    """
    여러 설비 상태 배치 업데이트
    
    Args:
        status_data: {equipment_id: status_dict}
        expire: 만료 시간 (초)
    
    Returns:
        bool: 성공 여부
    """
    if not status_data:
        return True
    
    # Redis 키로 변환
    redis_data = {
        f"equipment:status:{eq_id}": status
        for eq_id, status in status_data.items()
    }
    
    return set_multiple(redis_data, expire=expire)


# ============================================================================
# 캐싱 데코레이터
# ============================================================================

def cache_result(key_prefix: str, expire: int = 300):
    """
    함수 결과 캐싱 데코레이터
    
    Args:
        key_prefix: Redis 키 접두사
        expire: 만료 시간 (초)
    
    Usage:
        @cache_result('equipment_list', expire=60)
        def get_equipment_list():
            # 무거운 DB 쿼리
            return equipment_list
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            # 캐시 키 생성
            cache_key = f"{key_prefix}:{str(args)}:{str(kwargs)}"
            
            client = get_redis_client()
            
            # 캐시 확인
            cached = client.get(cache_key)
            if cached:
                logger.debug(f"캐시 히트: {cache_key}")
                try:
                    return json.loads(cached)
                except json.JSONDecodeError:
                    pass
            
            # 함수 실행
            logger.debug(f"캐시 미스: {cache_key}")
            result = func(*args, **kwargs)
            
            # 캐시 저장
            try:
                client.setex(cache_key, expire, json.dumps(result))
            except Exception as e:
                logger.error(f"캐시 저장 실패: {e}")
            
            return result
        
        return wrapper
    return decorator


# ============================================================================
# 통계
# ============================================================================

def get_redis_stats() -> Dict:
    """Redis 통계 조회"""
    client = get_redis_client()
    
    try:
        info = client.info()
        
        return {
            'used_memory': info.get('used_memory_human'),
            'connected_clients': info.get('connected_clients'),
            'total_commands_processed': info.get('total_commands_processed'),
            'keyspace_hits': info.get('keyspace_hits', 0),
            'keyspace_misses': info.get('keyspace_misses', 0),
            'hit_rate': (
                info.get('keyspace_hits', 0) / 
                (info.get('keyspace_hits', 0) + info.get('keyspace_misses', 1))
            ) * 100
        }
        
    except Exception as e:
        logger.error(f"Redis 통계 조회 실패: {e}")
        return {}


# ============================================================================
# 초기화
# ============================================================================

try:
    get_redis_client()
except Exception as e:
    logger.warning(f"Redis 초기화 실패: {e}")