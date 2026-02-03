"""
데이터베이스 연결 관리 (성능 최적화 버전)
"""

import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv
import logging
from contextlib import contextmanager
import time

# 환경 변수 로드
load_dotenv()

logger = logging.getLogger(__name__)

# ============================================================================
# 데이터베이스 설정
# ============================================================================

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'sherlock_sky'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', ''),
    # 성능 최적화 설정
    'connect_timeout': 10,
    'options': '-c statement_timeout=30000'  # 30초 타임아웃
}

# ============================================================================
# 연결 풀 설정 (최적화)
# ============================================================================

# 연결 풀 전역 변수
_connection_pool = None
_pool_stats = {
    'total_connections': 0,
    'active_connections': 0,
    'waiting_connections': 0,
    'pool_hits': 0,
    'pool_misses': 0
}


def validate_config(config):
    """설정 검증"""
    required_keys = ['host', 'port', 'database', 'user', 'password']
    
    for key in required_keys:
        if key not in config or not config[key]:
            raise ValueError(f"필수 설정 누락: {key}")


def create_connection_pool():
    """
    연결 풀 생성 (최적화된 설정)
    
    성능 최적화:
    - minconn: 5 (기본 연결 유지)
    - maxconn: 20 (최대 동시 연결)
    - ThreadedConnectionPool 사용 (멀티스레드 안전)
    """
    global _connection_pool
    
    if _connection_pool is not None:
        logger.warning("연결 풀이 이미 존재합니다")
        return _connection_pool
    
    try:
        validate_config(DB_CONFIG)
        
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=5,      # 최소 연결 수 (증가)
            maxconn=20,     # 최대 연결 수 (증가)
            **DB_CONFIG
        )
        
        logger.info(f"✓ 데이터베이스 연결 풀 생성 완료 (min=5, max=20)")
        
        # 초기 연결 테스트
        test_conn = _connection_pool.getconn()
        cursor = test_conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        _connection_pool.putconn(test_conn)
        
        logger.info("✓ 연결 풀 테스트 성공")
        
        return _connection_pool
        
    except Exception as e:
        logger.error(f"연결 풀 생성 실패: {e}", exc_info=True)
        raise


def get_connection_pool():
    """연결 풀 가져오기"""
    global _connection_pool
    
    if _connection_pool is None:
        _connection_pool = create_connection_pool()
    
    return _connection_pool


def get_db_connection():
    """
    연결 풀에서 연결 가져오기
    
    Returns:
        psycopg2.connection: 데이터베이스 연결
    """
    try:
        pool = get_connection_pool()
        conn = pool.getconn()
        
        # 통계 업데이트
        _pool_stats['pool_hits'] += 1
        _pool_stats['active_connections'] += 1
        
        return conn
        
    except pool.PoolError as e:
        _pool_stats['pool_misses'] += 1
        logger.error(f"연결 풀에서 연결 가져오기 실패: {e}")
        raise
    except Exception as e:
        logger.error(f"데이터베이스 연결 실패: {e}", exc_info=True)
        raise


def return_db_connection(conn):
    """
    연결 풀에 연결 반환
    
    Args:
        conn: 데이터베이스 연결
    """
    if conn:
        try:
            pool = get_connection_pool()
            pool.putconn(conn)
            _pool_stats['active_connections'] -= 1
            
        except Exception as e:
            logger.error(f"연결 반환 실패: {e}")


@contextmanager
def get_db_cursor(commit=False):
    """
    Context manager for database cursor
    
    Usage:
        with get_db_cursor(commit=True) as cursor:
            cursor.execute("INSERT ...")
    
    Args:
        commit: 자동 커밋 여부
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        yield cursor
        
        if commit:
            conn.commit()
            
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"데이터베이스 작업 실패: {e}", exc_info=True)
        raise
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            return_db_connection(conn)


def close_connection_pool():
    """연결 풀 종료"""
    global _connection_pool
    
    if _connection_pool:
        try:
            _connection_pool.closeall()
            _connection_pool = None
            logger.info("✓ 연결 풀 종료 완료")
        except Exception as e:
            logger.error(f"연결 풀 종료 실패: {e}")


def get_pool_stats():
    """
    연결 풀 통계 조회
    
    Returns:
        dict: 연결 풀 통계
    """
    return {
        **_pool_stats,
        'pool_size': len(_connection_pool._pool) if _connection_pool else 0,
        'available': len(_connection_pool._pool) if _connection_pool else 0
    }


# ============================================================================
# 쿼리 성능 측정 데코레이터
# ============================================================================

def measure_query_time(func):
    """쿼리 실행 시간 측정 데코레이터"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        elapsed_time = time.time() - start_time
        
        if elapsed_time > 1.0:  # 1초 이상 걸린 쿼리 로깅
            logger.warning(f"느린 쿼리 감지: {func.__name__} ({elapsed_time:.2f}초)")
        
        return result
    
    return wrapper


# ============================================================================
# 배치 처리 헬퍼
# ============================================================================

def execute_batch(query, data_list, batch_size=1000):
    """
    배치 처리로 대량 데이터 삽입
    
    Args:
        query: SQL 쿼리
        data_list: 데이터 리스트
        batch_size: 배치 크기
    
    Returns:
        int: 삽입된 행 수
    """
    total_inserted = 0
    
    with get_db_cursor(commit=True) as cursor:
        from psycopg2.extras import execute_batch
        
        for i in range(0, len(data_list), batch_size):
            batch = data_list[i:i + batch_size]
            execute_batch(cursor, query, batch)
            total_inserted += len(batch)
            
            if (i + batch_size) % 10000 == 0:
                logger.info(f"배치 처리 진행: {total_inserted}/{len(data_list)}")
    
    logger.info(f"✓ 배치 처리 완료: {total_inserted}건")
    return total_inserted


# ============================================================================
# 초기화
# ============================================================================

# 앱 시작 시 연결 풀 생성
try:
    create_connection_pool()
except Exception as e:
    logger.error(f"연결 풀 초기화 실패: {e}")