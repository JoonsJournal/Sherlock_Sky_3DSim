"""
데이터베이스 최적화 스크립트
- 인덱스 추가
- 쿼리 성능 분석
- VACUUM 실행
"""

import psycopg2
from datetime import datetime
import sys
from pathlib import Path

# 프로젝트 루트 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / 'backend'))

from utils.logging_config import get_script_logger
from api.database.connection import get_db_connection, return_db_connection

logger = get_script_logger("database_optimization")


def create_missing_indexes(cursor):
    """누락된 인덱스 생성"""
    logger.info("=== 인덱스 최적화 시작 ===")
    
    indexes = [
        # equipment 테이블
        "CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);",
        "CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(equipment_type);",
        
        # equipment_status_ts 테이블
        "CREATE INDEX IF NOT EXISTS idx_eq_status_equipment_time ON equipment_status_ts(equipment_id, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_eq_status_time ON equipment_status_ts(time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_eq_status_status ON equipment_status_ts(status);",
        
        # production_ts 테이블
        "CREATE INDEX IF NOT EXISTS idx_production_equipment_time ON production_ts(equipment_id, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_production_time ON production_ts(time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_production_batch ON production_ts(batch_id);",
        
        # alarms_ts 테이블
        "CREATE INDEX IF NOT EXISTS idx_alarms_equipment_time ON alarms_ts(equipment_id, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_alarms_severity_time ON alarms_ts(severity, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_alarms_acknowledged ON alarms_ts(acknowledged, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_alarms_code ON alarms_ts(code);",
        
        # 복합 인덱스 (자주 함께 조회되는 컬럼)
        "CREATE INDEX IF NOT EXISTS idx_eq_status_composite ON equipment_status_ts(equipment_id, status, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_production_composite ON production_ts(equipment_id, batch_id, time DESC);",
    ]
    
    for i, index_sql in enumerate(indexes, 1):
        try:
            cursor.execute(index_sql)
            index_name = index_sql.split('IF NOT EXISTS')[1].split('ON')[0].strip()
            logger.info(f"  [{i}/{len(indexes)}] ✓ 인덱스 생성: {index_name}")
        except Exception as e:
            logger.error(f"  [{i}/{len(indexes)}] ✗ 인덱스 생성 실패: {e}")


def analyze_query_performance(cursor):
    """쿼리 성능 분석"""
    logger.info("\n=== 쿼리 성능 분석 ===")
    
    # 느린 쿼리 분석 활성화
    cursor.execute("SELECT pg_stat_statements_reset();")
    logger.info("  ✓ 쿼리 통계 초기화")
    
    # 테이블 통계 갱신
    tables = ['equipment', 'equipment_status_ts', 'production_ts', 'alarms_ts']
    
    for table in tables:
        cursor.execute(f"ANALYZE {table};")
        logger.info(f"  ✓ {table} 테이블 분석 완료")


def vacuum_database(cursor):
    """VACUUM 실행 (성능 향상)"""
    logger.info("\n=== VACUUM 실행 ===")
    
    try:
        # VACUUM은 트랜잭션 외부에서 실행되어야 함
        cursor.connection.set_isolation_level(0)
        
        cursor.execute("VACUUM ANALYZE;")
        logger.info("  ✓ VACUUM ANALYZE 완료")
        
        cursor.connection.set_isolation_level(1)
        
    except Exception as e:
        logger.error(f"  ✗ VACUUM 실패: {e}")


def check_table_sizes(cursor):
    """테이블 크기 확인"""
    logger.info("\n=== 테이블 크기 ===")
    
    cursor.execute("""
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    """)
    
    for row in cursor.fetchall():
        logger.info(f"  {row[1]}: {row[2]}")


def main():
    """메인 실행"""
    logger.info("=" * 60)
    logger.info("데이터베이스 최적화 시작")
    logger.info("=" * 60)
    
    conn = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. 인덱스 생성
        create_missing_indexes(cursor)
        conn.commit()
        
        # 2. 쿼리 성능 분석
        analyze_query_performance(cursor)
        conn.commit()
        
        # 3. 테이블 크기 확인
        check_table_sizes(cursor)
        
        # 4. VACUUM 실행
        vacuum_database(cursor)
        
        cursor.close()
        
        logger.info("\n" + "=" * 60)
        logger.info("✓ 데이터베이스 최적화 완료")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"\n✗ 최적화 실패: {e}", exc_info=True)
        if conn:
            conn.rollback()
        sys.exit(1)
        
    finally:
        if conn:
            return_db_connection(conn)


if __name__ == "__main__":
    main()