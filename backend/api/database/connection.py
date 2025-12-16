"""
데이터베이스 연결 관리
- PostgreSQL 연결 풀
- Redis 연결
"""

import psycopg2
from psycopg2 import pool
import redis.asyncio as redis
from contextlib import asynccontextmanager
import os

# 데이터베이스 설정
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'sherlock_sky',
    'user': 'postgres',
    'password': 'password'
}

REDIS_CONFIG = {
    'host': 'localhost',
    'port': 6379,
    'db': 0
}

# 전역 연결 풀
pg_pool = None
redis_client = None


async def init_db():
    """데이터베이스 초기화"""
    global pg_pool, redis_client
    
    try:
        # PostgreSQL 연결 풀 생성
        pg_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            **DB_CONFIG
        )
        print("✓ PostgreSQL 연결 풀 생성 완료")
        
        # Redis 연결
        redis_client = redis.Redis(**REDIS_CONFIG)
        await redis_client.ping()
        print("✓ Redis 연결 완료")
        
    except Exception as e:
        print(f"✗ 데이터베이스 초기화 실패: {e}")
        raise


async def close_db():
    """데이터베이스 연결 종료"""
    global pg_pool, redis_client
    
    if pg_pool:
        pg_pool.closeall()
        print("✓ PostgreSQL 연결 풀 종료")
    
    if redis_client:
        await redis_client.close()
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