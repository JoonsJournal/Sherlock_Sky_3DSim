"""
pytest 설정 및 공통 픽스처
"""

import pytest
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime, timedelta

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 환경 변수 설정 (테스트용)
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_PORT'] = '5432'
os.environ['DB_NAME'] = 'sherlock_sky_test'
os.environ['DB_USER'] = 'postgres'
os.environ['DB_PASSWORD'] = 'test_password'
os.environ['REDIS_HOST'] = 'localhost'
os.environ['REDIS_PORT'] = '6379'


# ============================================================================
# 데이터베이스 픽스처
# ============================================================================

@pytest.fixture
def mock_db_connection():
    """Mock 데이터베이스 연결"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    cursor.fetchone.return_value = None
    cursor.fetchall.return_value = []
    return conn


@pytest.fixture
def mock_cursor():
    """Mock 커서"""
    cursor = MagicMock()
    cursor.fetchone.return_value = None
    cursor.fetchall.return_value = []
    return cursor


@pytest.fixture
def sample_equipment_data():
    """샘플 설비 데이터"""
    return {
        "id": "EQ-01-01",
        "row_position": 1,
        "col_position": 1,
        "equipment_type": "Type_A",
        "status": "RUNNING",
        "installation_date": datetime.now() - timedelta(days=365)
    }


@pytest.fixture
def sample_equipment_list():
    """샘플 설비 리스트"""
    equipment_list = []
    for row in range(1, 4):
        for col in range(1, 3):
            equipment_list.append({
                "id": f"EQ-{row:02d}-{col:02d}",
                "row_position": row,
                "col_position": col,
                "equipment_type": f"Type_{chr(64 + col)}",
                "status": "RUNNING" if col % 2 == 0 else "IDLE"
            })
    return equipment_list


# ============================================================================
# Redis 픽스처
# ============================================================================

@pytest.fixture
def mock_redis():
    """Mock Redis 클라이언트"""
    redis = MagicMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.keys = AsyncMock(return_value=[])
    redis.delete = AsyncMock(return_value=1)
    return redis


# ============================================================================
# API 클라이언트 픽스처
# ============================================================================

@pytest.fixture
def test_client():
    """FastAPI TestClient"""
    from fastapi.testclient import TestClient
    from api.main import app
    
    return TestClient(app)


@pytest.fixture
def api_headers():
    """API 요청 헤더"""
    return {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }


# ============================================================================
# 시뮬레이터 픽스처
# ============================================================================

@pytest.fixture
def equipment_config():
    """설비 설정"""
    from simulator.main import EquipmentConfig
    
    return EquipmentConfig(
        id="EQ-01-01",
        row=1,
        col=1,
        mtbf=150.0,
        mttr=2.0,
        cycle_time=45.0,
        temperature_baseline=70.0
    )


@pytest.fixture
def simpy_env():
    """SimPy 환경"""
    import simpy
    return simpy.Environment()


# ============================================================================
# 날짜/시간 픽스처
# ============================================================================

@pytest.fixture
def today():
    """오늘 날짜"""
    return datetime.now()


@pytest.fixture
def date_range():
    """날짜 범위 (최근 7일)"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    return (start_date, end_date)


# ============================================================================
# 테스트 데이터 정리
# ============================================================================

@pytest.fixture(autouse=True)
def cleanup():
    """각 테스트 후 정리"""
    yield
    # 테스트 후 정리 작업 (필요 시)
    pass


# ============================================================================
# 마커 기반 스킵
# ============================================================================

def pytest_configure(config):
    """pytest 설정"""
    config.addinivalue_line(
        "markers", "unit: 단위 테스트"
    )
    config.addinivalue_line(
        "markers", "integration: 통합 테스트"
    )


def pytest_collection_modifyitems(config, items):
    """테스트 아이템 수정"""
    # DB 연결 없이 테스트 실행 시 스킵
    skip_db = pytest.mark.skip(reason="데이터베이스 연결 필요")
    
    for item in items:
        if "db" in item.keywords:
            # DB 테스트는 실제 DB 연결 필요 시에만 실행
            if not config.getoption("--run-db"):
                item.add_marker(skip_db)


def pytest_addoption(parser):
    """커스텀 옵션 추가"""
    parser.addoption(
        "--run-db",
        action="store_true",
        default=False,
        help="실제 데이터베이스 테스트 실행"
    )
    parser.addoption(
        "--run-redis",
        action="store_true",
        default=False,
        help="실제 Redis 테스트 실행"
    )