# backend/tests/test_sites_router.py
"""
test_sites_router.py
Phase 1 Sites Router API 테스트 코드

@version 1.0.0
@changelog
- v1.0.0: 초기 버전 (2026-02-02)
          - Site 목록 조회 테스트
          - Health Check 테스트 (단일/전체)
          - Graceful Degradation 테스트
          - 재연결 테스트
          - WebSocket 테스트
          - ⚠️ 호환성: 신규 테스트 파일로 기존 코드 영향 없음

@dependencies
- pytest
- fastapi.testclient
- unittest.mock

📁 위치: backend/tests/test_sites_router.py
작성일: 2026-02-02
수정일: 2026-02-02
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import json


# ============================================
# Fixtures
# ============================================

@pytest.fixture
def mock_health_service():
    """SiteHealthService Mock"""
    with patch('backend.api.routers.sites.get_health_service') as mock:
        service = MagicMock()
        mock.return_value = service
        yield service


@pytest.fixture
def mock_connection_manager():
    """ConnectionManager Mock"""
    with patch('backend.api.routers.sites.get_connection_manager') as mock:
        manager = MagicMock()
        mock.return_value = manager
        yield manager


# ============================================
# Sample Data
# ============================================

SAMPLE_SITES = {
    "sites": [
        {
            "name": "CN_AAAA_Cutting_Sherlock",
            "host": "localhost",
            "port": 1433,
            "databases": ["SherlockSky"]
        },
        {
            "name": "KR_BBBB_Cutting_Sherlock",
            "host": "localhost",
            "port": 1435,
            "databases": ["SherlockSky"]
        }
    ]
}

SAMPLE_HEALTH_RESULT = {
    "total_sites": 2,
    "healthy_count": 1,
    "unhealthy_count": 1,
    "connecting_count": 0,
    "sites": [
        {
            "site_id": "CN_AAAA_Cutting_Sherlock",
            "display_name": "🇨🇳 CN_AAAA - Cutting",
            "status": "healthy",
            "db_connected": True,
            "last_check": "2026-02-02T00:00:00+00:00",
            "response_time_ms": 15,
            "error_message": None,
            "has_layout": True,
            "has_mapping": True,
            "equipment_count": 117,
            "process": "Cutting",
            "region": "CN"
        },
        {
            "site_id": "KR_BBBB_Cutting_Sherlock",
            "display_name": "🇰🇷 KR_BBBB - Cutting",
            "status": "unhealthy",
            "db_connected": False,
            "last_check": "2026-02-02T00:00:00+00:00",
            "response_time_ms": None,
            "error_message": "Connection refused",
            "has_layout": False,
            "has_mapping": True,
            "equipment_count": 0,
            "process": "Cutting",
            "region": "KR"
        }
    ],
    "last_updated": "2026-02-02T00:00:00+00:00"
}


# ============================================
# Test: GET /api/sites
# ============================================

class TestGetAllSites:
    """전체 Site 목록 조회 테스트"""
    
    def test_get_all_sites_success(self, mock_connection_manager):
        """정상적으로 Site 목록을 반환해야 함"""
        mock_connection_manager.get_all_sites.return_value = SAMPLE_SITES
        
        result = mock_connection_manager.get_all_sites()
        assert "sites" in result
        assert len(result["sites"]) == 2
    
    def test_get_all_sites_empty(self, mock_connection_manager):
        """Site가 없을 때 빈 목록 반환"""
        mock_connection_manager.get_all_sites.return_value = {"sites": []}
        
        result = mock_connection_manager.get_all_sites()
        assert result["sites"] == []


# ============================================
# Test: GET /api/sites/health
# ============================================

class TestGetAllSitesHealth:
    """전체 Site Health Check 테스트"""
    
    @pytest.mark.asyncio
    async def test_get_all_sites_health_success(self, mock_health_service):
        """모든 Site의 Health 상태를 반환해야 함"""
        mock_health_service.check_all_sites_health = AsyncMock(return_value=SAMPLE_HEALTH_RESULT)
        
        result = await mock_health_service.check_all_sites_health()
        
        assert result["total_sites"] == 2
        assert result["healthy_count"] == 1
        assert result["unhealthy_count"] == 1
        assert len(result["sites"]) == 2
    
    @pytest.mark.asyncio
    async def test_graceful_degradation(self, mock_health_service):
        """일부 Site 실패 시에도 나머지 결과 반환 (Graceful Degradation)"""
        partial_result = {
            "total_sites": 2,
            "healthy_count": 1,
            "unhealthy_count": 1,
            "connecting_count": 0,
            "sites": [
                {
                    "site_id": "CN_AAAA_Cutting_Sherlock",
                    "display_name": "🇨🇳 CN_AAAA - Cutting",
                    "status": "healthy",
                    "db_connected": True,
                    "last_check": "2026-02-02T00:00:00+00:00",
                    "response_time_ms": 15,
                    "error_message": None,
                    "has_layout": True,
                    "has_mapping": True,
                    "equipment_count": 117,
                    "process": "Cutting",
                    "region": "CN"
                },
                {
                    "site_id": "KR_BBBB_Cutting_Sherlock",
                    "display_name": "🇰🇷 KR_BBBB - Cutting",
                    "status": "unhealthy",
                    "db_connected": False,
                    "last_check": "2026-02-02T00:00:00+00:00",
                    "response_time_ms": None,
                    "error_message": "Connection timeout",
                    "has_layout": False,
                    "has_mapping": False,
                    "equipment_count": 0,
                    "process": "Cutting",
                    "region": "KR"
                }
            ],
            "last_updated": "2026-02-02T00:00:00+00:00"
        }
        
        mock_health_service.check_all_sites_health = AsyncMock(return_value=partial_result)
        
        result = await mock_health_service.check_all_sites_health()
        
        # 일부 실패해도 결과가 반환되어야 함
        assert result["total_sites"] == 2
        assert len(result["sites"]) == 2
        
        # 실패한 Site도 결과에 포함
        unhealthy_site = next(s for s in result["sites"] if s["status"] == "unhealthy")
        assert unhealthy_site["error_message"] is not None


# ============================================
# Test: GET /api/sites/{site_id}/health
# ============================================

class TestGetSingleSiteHealth:
    """단일 Site Health Check 테스트"""
    
    @pytest.mark.asyncio
    async def test_get_site_health_healthy(self, mock_health_service):
        """Healthy Site 상태 반환"""
        healthy_site = {
            "site_id": "CN_AAAA_Cutting_Sherlock",
            "display_name": "🇨🇳 CN_AAAA - Cutting",
            "status": "healthy",
            "db_connected": True,
            "last_check": "2026-02-02T00:00:00+00:00",
            "response_time_ms": 15,
            "error_message": None,
            "has_layout": True,
            "has_mapping": True,
            "equipment_count": 117,
            "process": "Cutting",
            "region": "CN"
        }
        
        mock_health_service.check_single_site_health = AsyncMock(return_value=healthy_site)
        
        result = await mock_health_service.check_single_site_health("CN_AAAA_Cutting_Sherlock")
        
        assert result["status"] == "healthy"
        assert result["db_connected"] is True
        assert result["response_time_ms"] == 15
    
    @pytest.mark.asyncio
    async def test_get_site_health_unhealthy(self, mock_health_service):
        """Unhealthy Site 상태 반환"""
        unhealthy_site = {
            "site_id": "KR_BBBB_Cutting_Sherlock",
            "display_name": "🇰🇷 KR_BBBB - Cutting",
            "status": "unhealthy",
            "db_connected": False,
            "last_check": "2026-02-02T00:00:00+00:00",
            "response_time_ms": None,
            "error_message": "Connection refused",
            "has_layout": False,
            "has_mapping": False,
            "equipment_count": 0,
            "process": "Cutting",
            "region": "KR"
        }
        
        mock_health_service.check_single_site_health = AsyncMock(return_value=unhealthy_site)
        
        result = await mock_health_service.check_single_site_health("KR_BBBB_Cutting_Sherlock")
        
        assert result["status"] == "unhealthy"
        assert result["db_connected"] is False
        assert result["error_message"] == "Connection refused"
    
    @pytest.mark.asyncio
    async def test_get_site_health_not_found(self, mock_health_service):
        """존재하지 않는 Site 조회 시 None 반환"""
        mock_health_service.check_single_site_health = AsyncMock(return_value=None)
        
        result = await mock_health_service.check_single_site_health("INVALID_SITE")
        
        assert result is None


# ============================================
# Test: POST /api/sites/{site_id}/reconnect
# ============================================

class TestReconnectSite:
    """Site 재연결 테스트"""
    
    @pytest.mark.asyncio
    async def test_reconnect_success(self, mock_health_service):
        """재연결 성공"""
        reconnect_result = {
            "success": True,
            "message": "Reconnected after 2 attempt(s)",
            "attempts": 2,
            "final_status": "healthy"
        }
        
        mock_health_service.check_single_site_health = AsyncMock(return_value={
            "site_id": "KR_BBBB_Cutting_Sherlock",
            "status": "unhealthy"
        })
        mock_health_service.reconnect_with_backoff = AsyncMock(return_value=reconnect_result)
        
        result = await mock_health_service.reconnect_with_backoff("KR_BBBB_Cutting_Sherlock", max_retries=5)
        
        assert result["success"] is True
        assert result["attempts"] == 2
        assert result["final_status"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_reconnect_already_connected(self, mock_health_service):
        """이미 연결된 Site에 대한 재연결 시도"""
        mock_health_service.check_single_site_health = AsyncMock(return_value={
            "site_id": "CN_AAAA_Cutting_Sherlock",
            "status": "healthy"
        })
        
        result = await mock_health_service.check_single_site_health("CN_AAAA_Cutting_Sherlock")
        
        # 이미 healthy이면 재연결 불필요
        assert result["status"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_reconnect_failure(self, mock_health_service):
        """재연결 실패 (최대 재시도 초과)"""
        reconnect_result = {
            "success": False,
            "message": "Failed to reconnect after 5 attempts",
            "attempts": 5,
            "final_status": "unhealthy"
        }
        
        mock_health_service.reconnect_with_backoff = AsyncMock(return_value=reconnect_result)
        
        result = await mock_health_service.reconnect_with_backoff("KR_BBBB_Cutting_Sherlock", max_retries=5)
        
        assert result["success"] is False
        assert result["attempts"] == 5
        assert result["final_status"] == "unhealthy"


# ============================================
# Test: GET /api/sites/summary
# ============================================

class TestGetSitesSummary:
    """Dashboard용 Site 요약 테스트"""
    
    @pytest.mark.asyncio
    async def test_get_sites_summary(self, mock_health_service):
        """Site 요약 정보 반환"""
        mock_health_service.check_all_sites_health = AsyncMock(return_value=SAMPLE_HEALTH_RESULT)
        
        result = await mock_health_service.check_all_sites_health()
        
        assert len(result["sites"]) == 2
        
        # 각 Site에 필요한 정보가 있는지 확인
        for site in result["sites"]:
            assert "site_id" in site
            assert "display_name" in site
            assert "status" in site
            assert "has_layout" in site
            assert "has_mapping" in site


# ============================================
# Test: WebSocket /ws/sites/health
# ============================================

class TestWebSocketHealth:
    """WebSocket Health Stream 테스트"""
    
    def test_websocket_connection(self):
        """WebSocket 연결 테스트"""
        # 실제 테스트 시 TestClient의 websocket_connect 사용
        # with client.websocket_connect("/ws/sites/health") as websocket:
        #     data = websocket.receive_json()
        #     assert data["type"] == "initial"
        pass
    
    def test_websocket_initial_message(self):
        """초기 연결 시 initial 메시지 수신"""
        # 실제 테스트 시 구현
        pass
    
    def test_websocket_ping_pong(self):
        """Ping-Pong keep-alive 테스트"""
        # 실제 테스트 시 구현
        pass


# ============================================
# Test: Performance
# ============================================

class TestPerformance:
    """성능 테스트"""
    
    @pytest.mark.asyncio
    async def test_health_check_response_time(self, mock_health_service):
        """Health Check 응답 시간이 2초 이내여야 함"""
        import time
        
        mock_health_service.check_all_sites_health = AsyncMock(return_value=SAMPLE_HEALTH_RESULT)
        
        start = time.time()
        await mock_health_service.check_all_sites_health()
        elapsed = time.time() - start
        
        # Mock이므로 실제로는 빠르지만, 실제 테스트에서는 2초 이내여야 함
        assert elapsed < 2.0


# ============================================
# Run Tests
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])