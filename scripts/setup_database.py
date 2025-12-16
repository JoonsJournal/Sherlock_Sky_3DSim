"""
SHERLOCK_SKY_3DSIM Database Setup Script
Windows Native Installation (Without Docker)

Prerequisites:
1. PostgreSQL 16 installed
2. TimescaleDB extension installed
3. Redis/Memurai installed
4. .env 파일 설정 완료

Usage:
    python scripts/setup_database.py
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys
import os
from dotenv import load_dotenv

# 프로젝트 루트의 .env 파일 로드
# scripts 폴더에서 실행되므로 상위 디렉토리의 .env를 찾음
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dotenv_path = os.path.join(project_root, '.env')

if not os.path.exists(dotenv_path):
    print("❌ .env 파일을 찾을 수 없습니다!")
    print(f"   예상 위치: {dotenv_path}")
    print("   .env.example 파일을 복사하여 .env 파일을 생성하세요.")
    sys.exit(1)

load_dotenv(dotenv_path)

# 환경 변수에서 데이터베이스 설정 읽기
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD'),
    'database': 'postgres'  # Initial connection
}

TARGET_DB = os.getenv('DB_NAME', 'sherlock_sky')

# 비밀번호 검증
if not DB_CONFIG['password']:
    print("❌ DB_PASSWORD 환경 변수가 설정되지 않았습니다!")
    print("   .env 파일에서 DB_PASSWORD를 설정하세요.")
    sys.exit(1)

print(f"📁 .env 파일 로드 완료: {dotenv_path}")
print(f"🔌 연결 대상: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
print(f"👤 사용자: {DB_CONFIG['user']}")
print(f"🗄️  데이터베이스: {TARGET_DB}\n")


def create_database():
    """Create sherlock_sky database"""
    print("Step 1: Creating database...")
    
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(**DB_CONFIG)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (TARGET_DB,)
        )
        
        if cursor.fetchone():
            print(f"  ✓ Database '{TARGET_DB}' already exists")
        else:
            # Create database
            cursor.execute(f'CREATE DATABASE {TARGET_DB}')
            print(f"  ✓ Database '{TARGET_DB}' created")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"  ✗ Error creating database: {e}")
        sys.exit(1)


def enable_timescaledb():
    """Enable TimescaleDB extension"""
    print("\nStep 2: Enabling TimescaleDB extension...")
    
    try:
        # Connect to target database
        conn = psycopg2.connect(
            **{**DB_CONFIG, 'database': TARGET_DB}
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Enable TimescaleDB extension
        cursor.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
        print("  ✓ TimescaleDB extension enabled")
        
        # Verify
        cursor.execute(
            "SELECT extname FROM pg_extension WHERE extname = 'timescaledb'"
        )
        if cursor.fetchone():
            print("  ✓ TimescaleDB verified")
        else:
            print("  ⚠ TimescaleDB extension not found")
            print("    Please install TimescaleDB:")
            print("    https://docs.timescale.com/self-hosted/latest/install/")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"  ✗ Error enabling TimescaleDB: {e}")
        print("  ℹ If TimescaleDB is not installed, download from:")
        print("    https://github.com/timescale/timescaledb/releases")


def create_tables():
    """Create database tables"""
    print("\nStep 3: Creating tables...")
    
    try:
        conn = psycopg2.connect(
            **{**DB_CONFIG, 'database': TARGET_DB}
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Equipment master table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS equipment (
                id VARCHAR(20) PRIMARY KEY,
                row_position INT NOT NULL,
                col_position INT NOT NULL,
                equipment_type VARCHAR(50),
                manufacturer VARCHAR(100),
                model VARCHAR(100),
                installation_date DATE,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(row_position, col_position)
            );
        """)
        print("  ✓ Table 'equipment' created")
        
        # Equipment status time-series table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS equipment_status_ts (
                time TIMESTAMPTZ NOT NULL,
                equipment_id VARCHAR(20) NOT NULL,
                status VARCHAR(20),
                temperature FLOAT,
                vibration FLOAT,
                current FLOAT,
                voltage FLOAT,
                speed FLOAT,
                runtime_hours FLOAT,
                cycle_count BIGINT,
                oee FLOAT
            );
        """)
        print("  ✓ Table 'equipment_status_ts' created")
        
        # Create hypertable (TimescaleDB)
        try:
            cursor.execute("""
                SELECT create_hypertable(
                    'equipment_status_ts', 
                    'time',
                    if_not_exists => TRUE
                );
            """)
            print("  ✓ Hypertable 'equipment_status_ts' created")
        except Exception as e:
            if "already a hypertable" in str(e):
                print("  ✓ Hypertable 'equipment_status_ts' already exists")
            else:
                raise
        
        # Production time-series table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS production_ts (
                time TIMESTAMPTZ NOT NULL,
                equipment_id VARCHAR(20) NOT NULL,
                batch_id VARCHAR(50),
                product_id VARCHAR(50),
                quantity_produced INT,
                defect_count INT,
                yield_rate FLOAT,
                cycle_time FLOAT,
                throughput FLOAT
            );
        """)
        print("  ✓ Table 'production_ts' created")
        
        # Create hypertable
        try:
            cursor.execute("""
                SELECT create_hypertable(
                    'production_ts',
                    'time',
                    if_not_exists => TRUE
                );
            """)
            print("  ✓ Hypertable 'production_ts' created")
        except Exception as e:
            if "already a hypertable" in str(e):
                print("  ✓ Hypertable 'production_ts' already exists")
            else:
                raise
        
        # Alarms time-series table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alarms_ts (
                time TIMESTAMPTZ NOT NULL,
                equipment_id VARCHAR(20) NOT NULL,
                alarm_id VARCHAR(50),
                severity VARCHAR(20),
                category VARCHAR(50),
                code VARCHAR(50),
                message TEXT,
                value FLOAT,
                threshold FLOAT,
                acknowledged BOOLEAN DEFAULT FALSE,
                acknowledged_at TIMESTAMPTZ,
                acknowledged_by VARCHAR(100),
                cleared_at TIMESTAMPTZ,
                auto_cleared BOOLEAN
            );
        """)
        print("  ✓ Table 'alarms_ts' created")
        
        # Create hypertable
        try:
            cursor.execute("""
                SELECT create_hypertable(
                    'alarms_ts',
                    'time',
                    if_not_exists => TRUE
                );
            """)
            print("  ✓ Hypertable 'alarms_ts' created")
        except Exception as e:
            if "already a hypertable" in str(e):
                print("  ✓ Hypertable 'alarms_ts' already exists")
            else:
                raise
        
        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_equipment_status_equipment_time 
                ON equipment_status_ts (equipment_id, time DESC);
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_production_equipment_time 
                ON production_ts (equipment_id, time DESC);
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_alarms_equipment_time 
                ON alarms_ts (equipment_id, time DESC);
        """)
        print("  ✓ Indexes created")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"  ✗ Error creating tables: {e}")
        sys.exit(1)


def insert_sample_equipment():
    """Insert sample equipment data (7x11 grid)"""
    print("\nStep 4: Inserting sample equipment data...")
    
    try:
        conn = psycopg2.connect(
            **{**DB_CONFIG, 'database': TARGET_DB}
        )
        cursor = conn.cursor()
        
        # Check if equipment already exists
        cursor.execute("SELECT COUNT(*) FROM equipment")
        count = cursor.fetchone()[0]
        
        if count >= 77:
            print(f"  ✓ Equipment data already exists ({count} records)")
        else:
            # Insert 7x11 equipment grid
            equipment_data = []
            for row in range(1, 12):  # 1-11
                for col in range(1, 8):  # 1-7
                    eq_id = f"EQ-{row:02d}-{col:02d}"
                    equipment_data.append((
                        eq_id, row, col, 'TYPE-A', 'active'
                    ))
            
            cursor.executemany("""
                INSERT INTO equipment 
                    (id, row_position, col_position, equipment_type, status)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, equipment_data)
            
            conn.commit()
            print(f"  ✓ Inserted {len(equipment_data)} equipment records")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"  ✗ Error inserting equipment data: {e}")
        sys.exit(1)


def test_redis_connection():
    """Test Redis/Memurai connection"""
    print("\nStep 5: Testing Redis connection...")
    
    try:
        import redis
        
        r = redis.Redis(
            host='localhost',
            port=6379,
            decode_responses=True
        )
        
        # Test ping
        r.ping()
        print("  ✓ Redis/Memurai connection successful")
        
        # Test set/get
        r.set('test_key', 'test_value')
        value = r.get('test_key')
        
        if value == 'test_value':
            print("  ✓ Redis read/write test passed")
            r.delete('test_key')
        
    except ImportError:
        print("  ⚠ redis package not installed")
        print("    Install with: pip install redis")
    except Exception as e:
        print(f"  ✗ Redis connection failed: {e}")
        print("  ℹ Make sure Redis or Memurai is running:")
        print("    - Check service: sc query Memurai")
        print("    - Start service: net start Memurai")
        print("    - Download: https://www.memurai.com/")


def print_summary():
    """Print setup summary"""
    print("\n" + "="*60)
    print("  Database Setup Complete!")
    print("="*60)
    print("\nConnection Information:")
    # 비밀번호를 마스킹하여 표시
    masked_password = "***"
    print(f"  Database: postgresql://{DB_CONFIG['user']}:{masked_password}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{TARGET_DB}")
    print(f"  Redis: redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')}")
    print("\n⚠️  중요: .env 파일은 절대 Git에 커밋하지 마세요!")
    print("\nNext Steps:")
    print("  1. Activate conda environment:")
    print("     conda activate sherlockSky3DSimBackend")
    print("\n  2. Start FastAPI server:")
    print("     cd backend")
    print("     uvicorn api.main:app --reload")
    print("\n  3. Start simulator (new terminal):")
    print("     cd backend")
    print("     python -m simulator.main")
    print("\nTroubleshooting:")
    print("  - PostgreSQL: sc query postgresql-x64-16")
    print("  - Redis/Memurai: sc query Memurai")
    print("  - .env 파일 확인: 프로젝트 루트에 .env 파일이 있는지 확인")
    print("="*60)


if __name__ == "__main__":
    print("="*60)
    print("  SHERLOCK_SKY_3DSIM Database Setup")
    print("  Windows Native Installation")
    print("="*60)
    
    try:
        create_database()
        enable_timescaledb()
        create_tables()
        insert_sample_equipment()
        test_redis_connection()
        print_summary()
        
    except KeyboardInterrupt:
        print("\n\n✗ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Unexpected error: {e}")
        sys.exit(1)