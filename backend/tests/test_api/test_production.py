"""
생산 API 테스트
"""

import pytest
from unittest.mock import patch


@pytest.mark.unit
class TestProductionAPI:
    """생산 API 단위 테스트"""
    
    def test_get_production_summary(self, test_client, mock_db_connection):
        """생산 요약 조회"""
        mock_db_connection.cursor().fetchone.return_value = (
            10,    # active_equipment
            1000,  # total_produced
            50     # total_defects
        )
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/production/summary")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_produced"] == 1000
        assert data["total_defects"] == 50
        assert "yield_rate_percent" in data
    
    def test_get_production_by_equipment(self, test_client, mock_db_connection):
        """설비별 생산량 조회"""
        mock_db_connection.cursor().fetchall.return_value = [
            ("EQ-01-01", 100, 5),
            ("EQ-01-02", 95, 3)
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/production/by-equipment")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["equipment_production"]) == 2
    
    def test_record_production_data(self, test_client, mock_db_connection):
        """생산 데이터 기록"""
        production_data = {
            "equipment_id": "EQ-01-01",
            "batch_id": "BATCH-001",
            "quantity_produced": 100,
            "defect_count": 2
        }
        
        # Mock 설비 존재 확인
        mock_db_connection.cursor().fetchone.return_value = (1,)
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.post(
                "/api/production/record",
                json=production_data
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True