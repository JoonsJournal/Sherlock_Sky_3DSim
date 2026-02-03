"""
모니터링 API 테스트
"""

import pytest
from unittest.mock import patch, AsyncMock
import json


@pytest.mark.unit
class TestMonitoringAPI:
    """모니터링 API 단위 테스트"""
    
    def test_get_current_status_all_equipment(self, test_client, mock_redis):
        """전체 설비 현재 상태 조회"""
        # Mock Redis 키 목록
        mock_redis.keys.return_value = [
            b"equipment:status:EQ-01-01",
            b"equipment:status:EQ-01-02"
        ]
        
        # Mock Redis 값
        status_data_1 = json.dumps({
            "equipment_id": "EQ-01-01",
            "status": "RUNNING",
            "temperature": 72.5
        })
        status_data_2 = json.dumps({
            "equipment_id": "EQ-01-02",
            "status": "IDLE",
            "temperature": 68.0
        })
        
        mock_redis.get.side_effect = [
            status_data_1.encode(),
            status_data_2.encode()
        ]
        
        with patch('api.routers.monitoring.redis_client', mock_redis):
            response = test_client.get("/api/monitoring/current-status")
        
        assert response.status_code == 200
        data = response.json()
        assert "equipment_status" in data
        assert len(data["equipment_status"]) == 2
    
    def test_get_current_status_specific_equipment(self, test_client, mock_redis):
        """특정 설비 현재 상태 조회"""
        status_data = json.dumps({
            "equipment_id": "EQ-01-01",
            "status": "RUNNING",
            "temperature": 72.5
        })
        mock_redis.get.return_value = status_data.encode()
        
        with patch('api.routers.monitoring.redis_client', mock_redis):
            response = test_client.get(
                "/api/monitoring/current-status",
                params={"equipment_ids": "EQ-01-01"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["equipment_status"]) == 1
        assert data["equipment_status"][0]["equipment_id"] == "EQ-01-01"
    
    def test_get_alarms_success(self, test_client, mock_db_connection):
        """알람 조회 성공"""
        mock_db_connection.cursor().fetchall.return_value = [
            ("EQ-01-01", "TEMP_HIGH", "WARNING", "High temperature", "2024-01-01 10:00:00"),
            ("EQ-01-02", "EQUIPMENT_DOWN", "CRITICAL", "Equipment failure", "2024-01-01 11:00:00")
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/monitoring/alarms")
        
        assert response.status_code == 200
        data = response.json()
        assert "alarms" in data
        assert len(data["alarms"]) == 2
    
    def test_get_statistics_success(self, test_client, mock_db_connection, mock_redis):
        """실시간 통계 조회 성공"""
        # Mock DB 데이터
        mock_db_connection.cursor().fetchall.return_value = [
            (2, 0, 1),  # CRITICAL=2, WARNING=0, INFO=1
        ]
        
        # Mock Redis 키
        mock_redis.keys.return_value = [
            b"equipment:status:EQ-01-01",
            b"equipment:status:EQ-01-02"
        ]
        
        # Mock Redis 값
        status_data_1 = json.dumps({"status": "RUNNING"})
        status_data_2 = json.dumps({"status": "IDLE"})
        mock_redis.get.side_effect = [
            status_data_1.encode(),
            status_data_2.encode()
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            with patch('api.routers.monitoring.redis_client', mock_redis):
                response = test_client.get("/api/monitoring/statistics")
        
        assert response.status_code == 200
        data = response.json()
        assert "equipment" in data
        assert "alarms" in data
    
    def test_health_check_success(self, test_client, mock_db_connection, mock_redis):
        """헬스체크 성공"""
        # Mock 성공 응답
        mock_db_connection.cursor().fetchone.return_value = (1,)
        mock_redis.ping = AsyncMock(return_value=True)
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            with patch('api.routers.monitoring.redis_client', mock_redis):
                response = test_client.get("/api/monitoring/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"