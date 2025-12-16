"""
데이터베이스 연결 관리
- PostgreSQL 연결 풀
- Redis 연결
- 환경 변수 기반 설정
"""

import psycopg2
from psycopg2 import pool
import redis.asyncio as redis
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import logging

# 환경 변수 로드
load_dotenv()

# 로거 설정
logger = logging.getLogger(__name__)

# 데이터베이스 설정 (환경 변수에서 읽기)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'sherlock_sky'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD')
}

REDIS_CONFIG = {
    'host': os.getenv('REDIS_HOST', 'localhost'),
    'port': int(os.getenv('REDIS_PORT', '6379')),
    'db': int(os.getenv('REDIS_DB', '0'))
}

# 전역 연결 풀
pg_pool = None
redis_client = None


def validate_config():
    """환경 변수 검증"""
    required_vars = ['DB_PASSWORD']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        raise ValueError(
            f"필수 환경 변수가 설정되지 않았습니다: {', '.join(missing_vars)}\n"
            f".env 파일을 확인하세요."
        )


async def init_db():
    """데이터베이스 초기화"""
    global pg_pool, redis_client
    
    try:
        # 환경 변수 검증
        validate_config()
        
        # PostgreSQL 연결 풀 생성
        pg_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            **DB_CONFIG
        )
        logger.info("✓ PostgreSQL 연결 풀 생성 완료")
        print("✓ PostgreSQL 연결 풀 생성 완료")
        
        # Redis 연결
        redis_client = redis.Redis(**REDIS_CONFIG)
        await redis_client.ping()
        logger.info("✓ Redis 연결 완료")
        print("✓ Redis 연결 완료")
        
    except ValueError as e:
        logger.error(f"✗ 환경 변수 오류: {e}")
        print(f"✗ 환경 변수 오류: {e}")
        raise
    except Exception as e:
        logger.error(f"✗ 데이터베이스 초기화 실패: {e}")
        print(f"✗ 데이터베이스 초기화 실패: {e}")
        raise


async def close_db():
    """데이터베이스 연결 종료"""
    global pg_pool, redis_client
    
    if pg_pool:
        pg_pool.closeall()
        logger.info("✓ PostgreSQL 연결 풀 종료")
        print("✓ PostgreSQL 연결 풀 종료")
    
    if redis_client:
        await redis_client.close()
        logger.info("✓ Redis 연결 종료")
        print("✓ Redis 연결 종료")


def get_db_connection():
    """PostgreSQL 연결 가져오기"""
    if pg_pool:
        return pg_pool.getconn()
    raise Exception("데이터베이스 연결 풀이 초기화되지 않았습니다")


def return_db_connection(conn):
    """PostgreSQL 연결 반환"""
    if pg_pool:
        pg_pool.putconn(conn)


@asynccontextmanager
async def get_db():
    """데이터베이스 연결 컨텍스트 매니저"""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        return_db_connection(conn)


def get_redis():
    """Redis 클라이언트 가져오기"""
    if redis_client:
        return redis_client
    raise Exception("Redis가 초기화되지 않았습니다")


def get_db_config():
    """현재 데이터베이스 설정 반환 (비밀번호 제외)"""
    safe_config = DB_CONFIG.copy()
    safe_config['password'] = '***'  # 비밀번호 마스킹
    return safe_config