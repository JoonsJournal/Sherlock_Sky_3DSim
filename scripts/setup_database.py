"""
데이터베이스 초기화 스크립트
- 테이블 생성
- 초기 데이터 삽입
- TimescaleDB 설정
"""

import psycopg2
from psycopg2 import sql
from datetime import datetime, timedelta
import sys
import os
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / 'backend'))

from utils.logging_config import get_script_logger
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# 로거 초기화
logger = get_script_logger(name="database_setup", level="INFO")


# ============================================================================
# 데이터베이스 연결
# ============================================================================

def get_db_config():
    """환경 변수에서 DB 설정 로드"""
    config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432'),
        'database': os.getenv('DB_NAME', 'sherlock_sky'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', 'your_password')
    }
    
    # 비밀번호 마스킹
    masked_config = config.copy()
    if masked_config['password']:
        masked_config['password'] = '*' * len(masked_config['password'])
    
    logger.info(f"DB 설정: {masked_config}")
    
    return config


def connect_database():
    """데이터베이스 연결"""
    config = get_db_config()
    
    try:
        conn = psycopg2.connect(**config)
        logger.info("✓ 데이터베이스 연결 성공")
        return conn
    except Exception as e:
        logger.error(f"데이터베이스 연결 실패: {e}", exc_info=True)
        raise


# ============================================================================
# 제외 위치 생성 (Config.js와 동일)
# ============================================================================

def get_excluded_positions():
    """제외 위치 생성"""
    excluded = set()
    
    # col:4, row 4~13 (10개)
    for row in range(4, 14):
        excluded.add((row, 4))
    
    # col:5, row 1~13 (13개)
    for row in range(1, 14):
        excluded.add((row, 5))
    
    # col:6, row 1~13 (13개)
    for row in range(1, 14):
        excluded.add((row, 6))
    
    # col:5, row 15~16 (2개)
    excluded.add((15, 5))
    excluded.add((16, 5))
    
    # col:5, row 22 (1개)
    excluded.add((22, 5))
    
    logger.debug(f"제외 위치 생성 완료: {len(excluded)}개")
    
    return excluded


# ============================================================================
# 테이블 생성
# ============================================================================

def create_tables(cursor):
    """테이블 생성"""
    logger.info("\n=== Step 1: 테이블 생성 중... ===")
    
    tables = [
        # Equipment 테이블
        """
        CREATE TABLE IF NOT EXISTS equipment (
            id VARCHAR(10) PRIMARY KEY,
            row_position INTEGER NOT NULL,
            col_position INTEGER NOT NULL,
            equipment_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) DEFAULT 'IDLE',
            installation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_maintenance TIMESTAMP,
            UNIQUE(row_position, col_position)
        );
        """,
        
        # Equipment Status 시계열 테이블
        """
        CREATE TABLE IF NOT EXISTS equipment_status_ts (
            time TIMESTAMPTZ NOT NULL,
            equipment_id VARCHAR(10) NOT NULL,
            status VARCHAR(20) NOT NULL,
            temperature REAL,
            vibration REAL,
            power_consumption REAL,
            FOREIGN KEY (equipment_id) REFERENCES equipment(id)
        );
        """,
        
        # Production 시계열 테이블
        """
        CREATE TABLE IF NOT EXISTS production_ts (
            time TIMESTAMPTZ NOT NULL,
            equipment_id VARCHAR(10) NOT NULL,
            batch_id VARCHAR(50),
            product_id VARCHAR(50),
            quantity_produced INTEGER DEFAULT 0,
            defect_count INTEGER DEFAULT 0,
            cycle_time REAL,
            throughput REAL,
            FOREIGN KEY (equipment_id) REFERENCES equipment(id)
        );
        """,
        
        # Alarms 시계열 테이블
        """
        CREATE TABLE IF NOT EXISTS alarms_ts (
            time TIMESTAMPTZ NOT NULL,
            equipment_id VARCHAR(10) NOT NULL,
            code VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            message TEXT,
            acknowledged BOOLEAN DEFAULT FALSE,
            cleared_at TIMESTAMPTZ,
            FOREIGN KEY (equipment_id) REFERENCES equipment(id)
        );
        """
    ]
    
    for i, table_sql in enumerate(tables, 1):
        try:
            cursor.execute(table_sql)
            table_name = table_sql.split('IF NOT EXISTS')[1].split('(')[0].strip()
            logger.info(f"  [{i}/{len(tables)}] ✓ 테이블 생성/확인: {table_name}")
        except Exception as e:
            logger.error(f"  [{i}/{len(tables)}] ✗ 테이블 생성 실패: {e}", exc_info=True)
            raise


# ============================================================================
# TimescaleDB 설정
# ============================================================================

def setup_timescaledb(cursor):
    """TimescaleDB 하이퍼테이블 설정"""
    logger.info("\n=== Step 2: TimescaleDB 하이퍼테이블 설정 중... ===")
    
    hypertables = [
        ("equipment_status_ts", "time"),
        ("production_ts", "time"),
        ("alarms_ts", "time")
    ]
    
    for i, (table, time_column) in enumerate(hypertables, 1):
        try:
            cursor.execute(f"""
                SELECT create_hypertable(
                    '{table}', 
                    '{time_column}',
                    if_not_exists => TRUE
                );
            """)
            logger.info(f"  [{i}/{len(hypertables)}] ✓ 하이퍼테이블 생성: {table}")
        except Exception as e:
            if "already a hypertable" in str(e):
                logger.info(f"  [{i}/{len(hypertables)}] ℹ 이미 하이퍼테이블: {table}")
            else:
                logger.error(
                    f"  [{i}/{len(hypertables)}] ✗ 하이퍼테이블 생성 실패: {table}",
                    exc_info=True
                )
                raise


# ============================================================================
# 인덱스 생성
# ============================================================================

def create_indexes(cursor):
    """인덱스 생성"""
    logger.info("\n=== Step 3: 인덱스 생성 중... ===")
    
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_eq_status_equipment ON equipment_status_ts(equipment_id, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_production_equipment ON production_ts(equipment_id, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_alarms_equipment ON alarms_ts(equipment_id, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms_ts(severity, time DESC);",
        "CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);",
    ]
    
    for i, index_sql in enumerate(indexes, 1):
        try:
            cursor.execute(index_sql)
            index_name = index_sql.split('IF NOT EXISTS')[1].split('ON')[0].strip()
            logger.info(f"  [{i}/{len(indexes)}] ✓ 인덱스 생성: {index_name}")
        except Exception as e:
            logger.error(f"  [{i}/{len(indexes)}] ✗ 인덱스 생성 실패: {e}", exc_info=True)
            raise


# ============================================================================
# 초기 데이터 삽입
# ============================================================================

def create_equipment(cursor):
    """설비 데이터 생성 (117 units in 26x6 grid layout)"""
    logger.info("\n=== Step 4: 설비 데이터 삽입 중... ===")
    
    # 제외 위치
    excluded_positions = get_excluded_positions()
    logger.info(f"  제외 위치: {len(excluded_positions)}개")
    
    # 26행 × 6열 배열
    ROWS = 26
    COLS = 6
    
    equipment_data = []
    equipment_count = 0
    
    for row in range(1, ROWS + 1):
        for col in range(1, COLS + 1):
            # 제외 위치 체크
            if (row, col) in excluded_positions:
                logger.debug(f"  제외: row={row:02d}, col={col}")
                continue
            
            equipment_count += 1
            equipment_id = f"EQ-{row:02d}-{col:02d}"
            
            # 설비 유형 분배
            if equipment_count % 4 == 1:
                equipment_type = "Type_A"
            elif equipment_count % 4 == 2:
                equipment_type = "Type_B"
            elif equipment_count % 4 == 3:
                equipment_type = "Type_C"
            else:
                equipment_type = "Type_D"
            
            equipment_data.append((
                equipment_id,
                row,
                col,
                equipment_type,
                'IDLE'
            ))
    
    # 데이터 삽입
    try:
        cursor.executemany("""
            INSERT INTO equipment (id, row_position, col_position, equipment_type, status)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, equipment_data)
        
        logger.info(f"  ✓ 설비 데이터 삽입 완료: {equipment_count}대")
        logger.info(f"  배열 구조: {ROWS}행 × {COLS}열 = {ROWS * COLS}개 위치")
        logger.info(f"  실제 설비: {equipment_count}대 (제외: {len(excluded_positions)}개)")
    except Exception as e:
        logger.error(f"  ✗ 설비 데이터 삽입 실패: {e}", exc_info=True)
        raise


def create_sample_data(cursor):
    """샘플 데이터 생성"""
    logger.info("\n=== Step 5: 샘플 데이터 생성 중... ===")
    
    try:
        # 설비 목록 조회
        cursor.execute("SELECT id FROM equipment LIMIT 10;")
        equipment_ids = [row[0] for row in cursor.fetchall()]
        
        if not equipment_ids:
            logger.warning("  ⚠ 설비 데이터 없음, 샘플 데이터 생성 건너뜀")
            return
        
        logger.info(f"  샘플 데이터 생성: {len(equipment_ids)}개 설비")
        
        # 최근 24시간 데이터
        now = datetime.now()
        
        for eq_id in equipment_ids:
            # 상태 데이터
            for i in range(24):
                timestamp = now - timedelta(hours=24-i)
                cursor.execute("""
                    INSERT INTO equipment_status_ts 
                        (time, equipment_id, status, temperature, vibration)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    timestamp,
                    eq_id,
                    'RUNNING',
                    70.0 + (i % 5),
                    0.5 + (i % 3) * 0.1
                ))
            
            # 생산 데이터
            for i in range(24):
                timestamp = now - timedelta(hours=24-i)
                cursor.execute("""
                    INSERT INTO production_ts 
                        (time, equipment_id, quantity_produced, defect_count)
                    VALUES (%s, %s, %s, %s)
                """, (
                    timestamp,
                    eq_id,
                    80 + (i % 20),
                    2 + (i % 3)
                ))
        
        logger.info(f"  ✓ 샘플 데이터 생성 완료")
    except Exception as e:
        logger.error(f"  ✗ 샘플 데이터 생성 실패: {e}", exc_info=True)
        raise


# ============================================================================
# 메인 실행
# ============================================================================

def main():
    """메인 실행 함수"""
    logger.info("=" * 70)
    logger.info("SHERLOCK_SKY_3DSIM - 데이터베이스 초기화 스크립트")
    logger.info("=" * 70)
    
    conn = None
    
    try:
        # 1. 데이터베이스 연결
        conn = connect_database()
        cursor = conn.cursor()
        
        # 2. 테이블 생성
        create_tables(cursor)
        conn.commit()
        
        # 3. TimescaleDB 설정
        setup_timescaledb(cursor)
        conn.commit()
        
        # 4. 인덱스 생성
        create_indexes(cursor)
        conn.commit()
        
        # 5. 설비 데이터 삽입
        create_equipment(cursor)
        conn.commit()
        
        # 6. 샘플 데이터 생성
        create_sample_data(cursor)
        conn.commit()
        
        cursor.close()
        
        logger.info("\n" + "=" * 70)
        logger.info("✓ 데이터베이스 초기화 완료!")
        logger.info("=" * 70)
        
    except Exception as e:
        logger.error(f"\n✗ 데이터베이스 초기화 실패: {e}", exc_info=True)
        if conn:
            conn.rollback()
        sys.exit(1)
        
    finally:
        if conn:
            conn.close()
            logger.info("데이터베이스 연결 종료")


if __name__ == "__main__":
    main()