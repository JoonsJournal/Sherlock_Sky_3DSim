#!/usr/bin/env python3
"""
=============================================================================
SHERLOCK_SKY_3DSIM - 가상 공장 데이터베이스 초기화 스크립트
=============================================================================
3개 공장 DB에 스키마, 테이블, 설비 마스터 데이터를 생성합니다.

사용법:
    python init_databases.py

요구사항:
    pip install pymssql
=============================================================================
"""

import pymssql
import time
from datetime import datetime, timezone

# =============================================================================
# 데이터베이스 연결 설정
# =============================================================================
FACTORIES = {
    "china": {
        "name": "🇨🇳 중국 공장",
        "host": "localhost",
        "port": 1433,
        "equipment_count": 118,
        "line_prefix": "CN-LINE",
        "equipment_prefix": "CN-EQ"
    },
    "vietnam": {
        "name": "🇻🇳 베트남 공장",
        "host": "localhost",
        "port": 1434,
        "equipment_count": 100,
        "line_prefix": "VN-LINE",
        "equipment_prefix": "VN-EQ"
    },
    "korea": {
        "name": "🇰🇷 한국 공장",
        "host": "localhost",
        "port": 1435,
        "equipment_count": 150,
        "line_prefix": "KR-LINE",
        "equipment_prefix": "KR-EQ"
    }
}

DB_USER = "sa"
DB_PASSWORD = "DockerTest123!"
DB_NAME = "SherlockSky"

# =============================================================================
# SQL 스크립트
# =============================================================================

SQL_CREATE_DATABASE = """
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SherlockSky')
BEGIN
    CREATE DATABASE SherlockSky;
END
"""

SQL_CREATE_SCHEMAS = """
USE SherlockSky;

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'core')
    EXEC('CREATE SCHEMA core');

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'log')
    EXEC('CREATE SCHEMA log');

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'ref')
    EXEC('CREATE SCHEMA ref');
"""

SQL_CREATE_TABLES = """
USE SherlockSky;

-- core.Equipment
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Equipment' AND schema_id = SCHEMA_ID('core'))
BEGIN
    CREATE TABLE core.Equipment (
        EquipmentId INT PRIMARY KEY NOT NULL,
        EquipmentName NVARCHAR(100) NOT NULL,
        LineName NVARCHAR(100) NULL
    );
END

-- core.EquipmentPCInfo
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EquipmentPCInfo' AND schema_id = SCHEMA_ID('core'))
BEGIN
    CREATE TABLE core.EquipmentPCInfo (
        EquipmentId INT PRIMARY KEY NOT NULL,
        OS NVARCHAR(50) NOT NULL,
        Architecture NVARCHAR(1000) NULL,
        LastBootTime DATETIME2(3) NOT NULL,
        CPUName NVARCHAR(1000) NULL,
        CPULogicalCount INT NULL,
        GPUName NVARCHAR(1000) NULL,
        UpdateAtUtc DATETIME2(3) NOT NULL,
        CONSTRAINT FK_EquipmentPCInfo_Equipment FOREIGN KEY (EquipmentId) 
            REFERENCES core.Equipment(EquipmentId)
    );
END

-- log.EquipmentState
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EquipmentState' AND schema_id = SCHEMA_ID('log'))
BEGIN
    CREATE TABLE log.EquipmentState (
        StateLogId BIGINT PRIMARY KEY IDENTITY(1,1) NOT NULL,
        EquipmentId INT NOT NULL,
        Status NVARCHAR(50) NULL,
        OccurredAtUtc DATETIME2(3) NOT NULL,
        CONSTRAINT FK_EquipmentState_Equipment FOREIGN KEY (EquipmentId) 
            REFERENCES core.Equipment(EquipmentId)
    );
    CREATE INDEX IX_EquipmentState_EquipmentId ON log.EquipmentState(EquipmentId);
    CREATE INDEX IX_EquipmentState_OccurredAtUtc ON log.EquipmentState(OccurredAtUtc DESC);
END

-- log.Lotinfo
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Lotinfo' AND schema_id = SCHEMA_ID('log'))
BEGIN
    CREATE TABLE log.Lotinfo (
        LotInfoId BIGINT PRIMARY KEY IDENTITY(1,1) NOT NULL,
        EquipmentId INT NOT NULL,
        LotId NVARCHAR(1000) NOT NULL,
        LotQty INT NOT NULL,
        ProductModel NVARCHAR(1000) NOT NULL,
        RecipeId NVARCHAR(1000) NOT NULL,
        IsStart BIT NOT NULL,
        OccurredAtUtc DATETIME2(3) NOT NULL,
        CONSTRAINT FK_Lotinfo_Equipment FOREIGN KEY (EquipmentId) 
            REFERENCES core.Equipment(EquipmentId)
    );
    CREATE INDEX IX_Lotinfo_EquipmentId ON log.Lotinfo(EquipmentId);
END

-- log.EquipmentPCInfo
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EquipmentPCInfo' AND schema_id = SCHEMA_ID('log'))
BEGIN
    CREATE TABLE log.EquipmentPCInfo (
        id BIGINT PRIMARY KEY IDENTITY(1,1) NOT NULL,
        EquipmentId INT NOT NULL,
        EquipmentName NVARCHAR(50) NOT NULL,
        CPUUsagePercent DECIMAL(5,2) NULL,
        MemoryTotalMb DECIMAL(9,3) NULL,
        MemoryUsedMb DECIMAL(9,3) NULL,
        DisksDrive NVARCHAR(1000) NULL,
        DisksTotalGb DECIMAL(9,3) NULL,
        DisksUsedGb DECIMAL(9,3) NULL,
        DisksUsedPercent DECIMAL(5,2) NULL,
        DisksDrive2 NVARCHAR(1000) NULL,
        DisksTotalGb2 DECIMAL(9,3) NULL,
        DisksUsedGb2 DECIMAL(9,3) NULL,
        DisksUsedPercent2 DECIMAL(5,2) NULL,
        OccurredAtUtc DATETIME2(3) NOT NULL,
        CONSTRAINT FK_LogEquipmentPCInfo_Equipment FOREIGN KEY (EquipmentId) 
            REFERENCES core.Equipment(EquipmentId)
    );
    CREATE INDEX IX_LogEquipmentPCInfo_EquipmentId ON log.EquipmentPCInfo(EquipmentId);
END

-- ref.EquipmentDataCategory
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EquipmentDataCategory' AND schema_id = SCHEMA_ID('ref'))
BEGIN
    CREATE TABLE ref.EquipmentDataCategory (
        DataCategoryId INT PRIMARY KEY NOT NULL,
        DataCategoryValue NVARCHAR(100) NOT NULL
    );
END

-- log.EquipmentDataLog
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EquipmentDataLog' AND schema_id = SCHEMA_ID('log'))
BEGIN
    CREATE TABLE log.EquipmentDataLog (
        EquipmentDataId BIGINT PRIMARY KEY IDENTITY(1,1) NOT NULL,
        EquipmentId INT NOT NULL,
        DataCategoryId INT NOT NULL,
        DataValue NVARCHAR(100) NOT NULL,
        OccurredAtUtc DATETIME2(3) NOT NULL,
        CONSTRAINT FK_EquipmentDataLog_Equipment FOREIGN KEY (EquipmentId) 
            REFERENCES core.Equipment(EquipmentId),
        CONSTRAINT FK_EquipmentDataLog_Category FOREIGN KEY (DataCategoryId) 
            REFERENCES ref.EquipmentDataCategory(DataCategoryId)
    );
    CREATE INDEX IX_EquipmentDataLog_EquipmentId ON log.EquipmentDataLog(EquipmentId);
END

-- log.CycleTime
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CycleTime' AND schema_id = SCHEMA_ID('log'))
BEGIN
    CREATE TABLE log.CycleTime (
        EquipmentId INT NOT NULL,
        Time DATETIME2(3) NOT NULL,
        PickUp DECIMAL(9,3) NULL,
        ThicknessMeasure DECIMAL(9,3) NULL,
        PreAlign DECIMAL(9,3) NULL,
        Loading DECIMAL(9,3) NULL,
        Align_Pos_Move DECIMAL(9,3) NULL,
        Align_XCh DECIMAL(9,3) NULL,
        Cutting_XCh DECIMAL(9,3) NULL,
        Cut_CT_XCh DECIMAL(9,3) NULL,
        Align_Ych DECIMAL(9,3) NULL,
        Cutting_Ych DECIMAL(9,3) NULL,
        Cut_CT_Uch DECIMAL(9,3) NULL,
        Unloading_Pick DECIMAL(9,3) NULL,
        Unloading_Place DECIMAL(9,3) NULL,
        CONSTRAINT PK_CycleTime PRIMARY KEY (EquipmentId, Time),
        CONSTRAINT FK_CycleTime_Equipment FOREIGN KEY (EquipmentId) 
            REFERENCES core.Equipment(EquipmentId)
    );
END

-- ref.RemoteAlarmList
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RemoteAlarmList' AND schema_id = SCHEMA_ID('ref'))
BEGIN
    CREATE TABLE ref.RemoteAlarmList (
        RemoteAlarmId INT PRIMARY KEY IDENTITY(1,1) NOT NULL,
        RemoteAlarmCode INT NOT NULL,
        RemoteAlarmMessage NVARCHAR(1000) NOT NULL,
        OccurredAtUtc DATETIME2(3) NOT NULL
    );
END

-- log.AlarmEvent
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AlarmEvent' AND schema_id = SCHEMA_ID('log'))
BEGIN
    CREATE TABLE log.AlarmEvent (
        AlarmEventId BIGINT PRIMARY KEY IDENTITY(1,1) NOT NULL,
        EquipmentId INT NOT NULL,
        AlarmCode INT NOT NULL,
        AlarmMessage NVARCHAR(100) NOT NULL,
        IsSet BIT NOT NULL,
        OccurredAtUtc DATETIME2(3) NOT NULL,
        CONSTRAINT FK_AlarmEvent_Equipment FOREIGN KEY (EquipmentId) 
            REFERENCES core.Equipment(EquipmentId)
    );
    CREATE INDEX IX_AlarmEvent_EquipmentId ON log.AlarmEvent(EquipmentId);
END
"""

SQL_INSERT_REFERENCE_DATA = """
USE SherlockSky;

-- EquipmentDataCategory
IF NOT EXISTS (SELECT 1 FROM ref.EquipmentDataCategory WHERE DataCategoryId = 21641)
BEGIN
    INSERT INTO ref.EquipmentDataCategory (DataCategoryId, DataCategoryValue) VALUES
    (21641, 'BLADE'),
    (21751, 'LPV'),
    (21755, 'LSV'),
    (21750, 'MTBI'),
    (21711, 'OCR'),
    (21753, 'RUNRATE'),
    (21754, 'SELFINSP'),
    (21746, 'TEST'),
    (21752, 'TPV'),
    (21756, 'TSV');
END

-- RemoteAlarmList
IF NOT EXISTS (SELECT 1 FROM ref.RemoteAlarmList WHERE RemoteAlarmCode = 61)
BEGIN
    INSERT INTO ref.RemoteAlarmList (RemoteAlarmCode, RemoteAlarmMessage, OccurredAtUtc) VALUES
    (61, 'Emergency Stop Activated', GETUTCDATE()),
    (62, 'Safety Door Open', GETUTCDATE()),
    (86, 'Motor Overload', GETUTCDATE()),
    (10047, 'Vision Inspection Failed', GETUTCDATE()),
    (10048, 'Alignment Error', GETUTCDATE()),
    (10051, 'Blade Wear Detected', GETUTCDATE()),
    (10052, 'Blade Broken', GETUTCDATE()),
    (10055, 'Vacuum Error', GETUTCDATE()),
    (10056, 'Air Pressure Low', GETUTCDATE()),
    (10057, 'Temperature Abnormal', GETUTCDATE()),
    (10058, 'Communication Error', GETUTCDATE()),
    (10077, 'Unknown Error', GETUTCDATE());
END
"""

# =============================================================================
# 유틸리티 함수
# =============================================================================

def print_header(text):
    """헤더 출력"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)

def print_step(text):
    """단계 출력"""
    print(f"  → {text}")

def execute_sql(cursor, sql, description=""):
    """SQL 실행"""
    try:
        for statement in sql.split("GO"):
            statement = statement.strip()
            if statement:
                cursor.execute(statement)
        if description:
            print_step(f"✅ {description}")
        return True
    except Exception as e:
        print_step(f"❌ {description}: {e}")
        return False

def create_equipment_data(cursor, factory_key, factory_info):
    """설비 마스터 데이터 생성"""
    equipment_count = factory_info["equipment_count"]
    line_prefix = factory_info["line_prefix"]
    eq_prefix = factory_info["equipment_prefix"]
    
    # 기존 데이터 확인
    cursor.execute("SELECT COUNT(*) FROM core.Equipment")
    existing_count = cursor.fetchone()[0]
    
    if existing_count >= equipment_count:
        print_step(f"⏭️  설비 데이터 이미 존재 ({existing_count}대)")
        return
    
    # 라인당 설비 수 계산 (6개 라인으로 분배)
    lines_count = 6
    equipment_per_line = equipment_count // lines_count
    remainder = equipment_count % lines_count
    
    equipment_id = 1
    now_utc = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S.000')
    
    for line_num in range(1, lines_count + 1):
        line_name = f"{line_prefix}-{line_num:02d}"
        
        # 이 라인의 설비 수
        line_equipment_count = equipment_per_line + (1 if line_num <= remainder else 0)
        
        for eq_in_line in range(1, line_equipment_count + 1):
            equipment_name = f"{eq_prefix}-{equipment_id:04d}"
            
            # core.Equipment INSERT
            cursor.execute("""
                INSERT INTO core.Equipment (EquipmentId, EquipmentName, LineName)
                VALUES (%s, %s, %s)
            """, (equipment_id, equipment_name, line_name))
            
            # 초기 상태 INSERT (IDLE)
            cursor.execute("""
                INSERT INTO log.EquipmentState (EquipmentId, Status, OccurredAtUtc)
                VALUES (%s, 'IDLE', %s)
            """, (equipment_id, now_utc))
            
            equipment_id += 1
    
    print_step(f"✅ {equipment_count}대 설비 데이터 생성 완료")

def init_factory_database(factory_key, factory_info):
    """단일 공장 DB 초기화"""
    factory_name = factory_info["name"]
    host = factory_info["host"]
    port = factory_info["port"]
    
    print_header(f"{factory_name} 초기화 중...")
    
    try:
        # master DB 연결 (데이터베이스 생성용)
        print_step(f"DB 서버 연결 중... ({host}:{port})")
        conn = pymssql.connect(
            server=host,
            port=port,
            user=DB_USER,
            password=DB_PASSWORD,
            database="master",
            autocommit=True
        )
        cursor = conn.cursor()
        
        # 1. 데이터베이스 생성
        execute_sql(cursor, SQL_CREATE_DATABASE, "SherlockSky 데이터베이스 생성")
        
        # 2. 스키마 생성
        execute_sql(cursor, SQL_CREATE_SCHEMAS, "스키마 생성 (core, log, ref)")
        
        # 3. 테이블 생성
        execute_sql(cursor, SQL_CREATE_TABLES, "테이블 생성")
        
        # 4. 참조 데이터 INSERT
        execute_sql(cursor, SQL_INSERT_REFERENCE_DATA, "참조 데이터 INSERT")
        
        # SherlockSky DB로 전환
        cursor.execute("USE SherlockSky")
        
        # 5. 설비 마스터 데이터 생성
        create_equipment_data(cursor, factory_key, factory_info)
        
        conn.commit()
        conn.close()
        
        print_step(f"🎉 {factory_name} 초기화 완료!")
        return True
        
    except Exception as e:
        print_step(f"❌ 오류 발생: {e}")
        return False

def verify_databases():
    """데이터베이스 검증"""
    print_header("데이터베이스 검증")
    
    for factory_key, factory_info in FACTORIES.items():
        factory_name = factory_info["name"]
        try:
            conn = pymssql.connect(
                server=factory_info["host"],
                port=factory_info["port"],
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME
            )
            cursor = conn.cursor()
            
            # 설비 수 확인
            cursor.execute("SELECT COUNT(*) FROM core.Equipment")
            eq_count = cursor.fetchone()[0]
            
            # 테이블 수 확인
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA IN ('core', 'log', 'ref')
            """)
            table_count = cursor.fetchone()[0]
            
            # 초기 상태 수 확인
            cursor.execute("SELECT COUNT(*) FROM log.EquipmentState")
            state_count = cursor.fetchone()[0]
            
            conn.close()
            
            print_step(f"{factory_name}: ✅ 테이블 {table_count}개, 설비 {eq_count}대, 상태로그 {state_count}건")
            
        except Exception as e:
            print_step(f"{factory_name}: ❌ 검증 실패 - {e}")

# =============================================================================
# 메인 실행
# =============================================================================

def main():
    print("\n")
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║     SHERLOCK_SKY_3DSIM - 가상 공장 데이터베이스 초기화       ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print("║  🇨🇳 중국 공장: 118대  |  localhost:1433                     ║")
    print("║  🇻🇳 베트남 공장: 100대 |  localhost:1434                     ║")
    print("║  🇰🇷 한국 공장: 150대  |  localhost:1435                     ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    
    start_time = time.time()
    
    # 각 공장 DB 초기화
    results = {}
    for factory_key, factory_info in FACTORIES.items():
        results[factory_key] = init_factory_database(factory_key, factory_info)
    
    # 검증
    verify_databases()
    
    # 결과 요약
    elapsed_time = time.time() - start_time
    print_header("초기화 완료!")
    
    success_count = sum(1 for r in results.values() if r)
    total_count = len(results)
    
    print(f"""
    📊 결과 요약
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    성공: {success_count}/{total_count} 공장
    소요 시간: {elapsed_time:.1f}초
    총 설비 수: 368대 (118 + 100 + 150)
    
    🚀 다음 단계:
    1. config/databases.json을 Docker 버전으로 교체
       → cp docker-virtual-factory/databases.docker.json config/databases.json
    
    2. Backend 실행
       → cd backend && python -m uvicorn api.main:app --reload
    
    3. Frontend 실행
       → cd frontend/threejs_viewer && npx http-server -p 8080
    """)

if __name__ == "__main__":
    main()