"""
설비 API 테스트
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime


@pytest.mark.unit
class TestEquipmentAPI:
    """설비 API 단위 테스트"""
    
    def test_get_all_equipment_success(self, test_client, mock_db_connection):
        """전체 설비 조회 성공"""
        # Mock 데이터 설정
        mock_db_connection.cursor().fetchall.return_value = [
            ("EQ-01-01", 1, 1, "Type_A", "RUNNING"),
            ("EQ-01-02", 1, 2, "Type_B", "IDLE"),
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/equipment")
        
        assert response.status_code == 200
        data = response.json()
        assert "equipment" in data
        assert len(data["equipment"]) == 2
        assert data["equipment"][0]["id"] == "EQ-01-01"
    
    def test_get_equipment_by_id_success(self, test_client, mock_db_connection):
        """특정 설비 조회 성공"""
        mock_db_connection.cursor().fetchone.return_value = (
            "EQ-01-01", 1, 1, "Type_A", "RUNNING", datetime.now()
        )
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/equipment/EQ-01-01")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "EQ-01-01"
        assert data["row"] == 1
        assert data["col"] == 1
    
    def test_get_equipment_by_id_not_found(self, test_client, mock_db_connection):
        """존재하지 않는 설비 조회"""
        mock_db_connection.cursor().fetchone.return_value = None
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/equipment/EQ-99-99")
        
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
    
    def test_get_equipment_invalid_id_format(self, test_client):
        """잘못된 설비 ID 형식"""
        response = test_client.get("/api/equipment/INVALID-ID")
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
    
    def test_get_grid_layout_success(self, test_client, mock_db_connection):
        """그리드 레이아웃 조회 성공"""
        # 26행 × 6열 그리드 테스트
        mock_equipment = []
        for row in range(1, 27):
            for col in range(1, 7):
                # 제외 위치가 아닌 경우만 추가
                if not ((row, col) in [(4, 4), (5, 5)]):  # 샘플 제외
                    mock_equipment.append((f"EQ-{row:02d}-{col:02d}", row, col, "RUNNING"))
        
        mock_db_connection.cursor().fetchall.return_value = mock_equipment
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/equipment/grid/layout")
        
        assert response.status_code == 200
        data = response.json()
        assert "grid" in data
        assert "layout" in data
        assert data["layout"]["rows"] == 26
        assert data["layout"]["cols"] == 6
        assert data["layout"]["total_positions"] == 156


@pytest.mark.integration
class TestEquipmentAPIIntegration:
    """설비 API 통합 테스트"""
    
    @pytest.mark.db
    def test_full_equipment_workflow(self, test_client):
        """전체 설비 워크플로우 테스트"""
        # 1. 전체 설비 조회
        response = test_client.get("/api/equipment")
        assert response.status_code == 200
        
        # 2. 첫 번째 설비 ID 가져오기
        equipment_list = response.json()["equipment"]
        if equipment_list:
            equipment_id = equipment_list[0]["id"]
            
            # 3. 특정 설비 조회
            response = test_client.get(f"/api/equipment/{equipment_id}")
            assert response.status_code == 200
            
            # 4. 그리드 레이아웃 확인
            response = test_client.get("/api/equipment/grid/layout")
            assert response.status_code == 200