"""
분석 API 테스트
"""

import pytest
from unittest.mock import patch
from datetime import datetime, timedelta


@pytest.mark.unit
class TestAnalyticsAPI:
    """분석 API 단위 테스트"""
    
    def test_calculate_oee_all_equipment(self, test_client, mock_db_connection):
        """전체 설비 OEE 계산"""
        # Mock 생산 데이터
        mock_db_connection.cursor().fetchone.return_value = (
            1000,  # total_produced
            50,    # total_defects
            0.85   # avg_availability
        )
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/analytics/oee")
        
        assert response.status_code == 200
        data = response.json()
        assert "oee" in data
        assert 0 <= data["oee"] <= 100
    
    def test_calculate_oee_specific_equipment(self, test_client, mock_db_connection):
        """특정 설비 OEE 계산"""
        mock_db_connection.cursor().fetchone.return_value = (
            500,   # total_produced
            10,    # total_defects
            0.90   # avg_availability
        )
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get(
                "/api/analytics/oee",
                params={"equipment_id": "EQ-01-01"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["equipment_id"] == "EQ-01-01"
        assert "oee" in data
    
    def test_calculate_mtbf_mttr(self, test_client, mock_db_connection):
        """MTBF/MTTR 계산"""
        mock_db_connection.cursor().fetchall.return_value = [
            ("EQ-01-01", 150.5, 2.5, 0.984),  # equipment_id, mtbf, mttr, availability
            ("EQ-01-02", 145.0, 3.0, 0.980)
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/analytics/mtbf-mttr")
        
        assert response.status_code == 200
        data = response.json()
        assert "equipment_reliability" in data
        assert len(data["equipment_reliability"]) == 2
        assert data["equipment_reliability"][0]["mtbf_hours"] == 150.5
    
    def test_pareto_analysis_alarm(self, test_client, mock_db_connection):
        """Pareto 분석 - 알람"""
        mock_db_connection.cursor().fetchall.return_value = [
            ("TEMP_HIGH", 50),
            ("EQUIPMENT_DOWN", 30),
            ("PRESSURE_LOW", 15),
            ("VIBRATION_HIGH", 5)
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get(
                "/api/analytics/pareto",
                params={"analysis_type": "alarm"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 4
        assert data["items"][0]["cumulative_percent"] <= 100
    
    def test_trends_analysis(self, test_client, mock_db_connection):
        """트렌드 분석"""
        mock_db_connection.cursor().fetchall.return_value = [
            (datetime.now() - timedelta(hours=i), 100 + i, 5)
            for i in range(24)
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get(
                "/api/analytics/trends",
                params={"metric": "production", "interval": "1hour"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "data_points" in data
        assert len(data["data_points"]) == 24
    
    def test_dashboard_summary(self, test_client, mock_db_connection):
        """대시보드 요약"""
        # Mock 여러 쿼리 결과
        mock_cursor = mock_db_connection.cursor()
        mock_cursor.fetchone.side_effect = [
            (1000, 950, 50, 95.0),  # 생산 요약
            (100, 10, 5),           # 알람 요약
            (85.5,),                # 평균 OEE
            (150.0,)                # 평균 MTBF
        ]
        
        with patch('api.database.connection.get_db_connection', return_value=mock_db_connection):
            response = test_client.get("/api/analytics/dashboard")
        
        assert response.status_code == 200
        data = response.json()
        assert "production_summary" in data
        assert "alarm_summary" in data
        assert "average_oee" in data


@pytest.mark.integration
class TestAnalyticsAPIIntegration:
    """분석 API 통합 테스트"""
    
    @pytest.mark.db
    def test_full_analytics_workflow(self, test_client, date_range):
        """전체 분석 워크플로우"""
        start_date, end_date = date_range
        
        # 1. OEE 계산
        response = test_client.get(
            "/api/analytics/oee",
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        )
        assert response.status_code in [200, 404]  # 데이터 없을 수 있음
        
        # 2. Pareto 분석
        response = test_client.get("/api/analytics/pareto")
        assert response.status_code in [200, 404]
        
        # 3. 대시보드
        response = test_client.get("/api/analytics/dashboard")
        assert response.status_code == 200