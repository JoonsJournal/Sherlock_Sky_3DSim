"""
Equipment Detail API 테스트
pytest backend/tests/test_equipment_detail.py -v

작성일: 2026-01-06
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import sys
import os

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.api.main import app
from backend.api.models.equipment_detail import (
    EquipmentDetailResponse,
    MultiEquipmentDetailRequest,
    MultiEquipmentDetailResponse,
    EquipmentDetailData
)
from backend.api.services.equipment_detail_service import EquipmentDetailService


# ============================================================================
# Test Client
# ============================================================================

client = TestClient(app)


# ============================================================================
# Unit Tests - Pydantic Models
# ============================================================================

class TestEquipmentDetailModels:
    """Pydantic 모델 테스트"""
    
    def test_single_response_model(self):
        """단일 응답 모델 테스트"""
        response = EquipmentDetailResponse(
            frontend_id="EQ-17-03",
            equipment_id=75,
            equipment_name="EQ-17-03",
            line_name="Line-A",
            status="RUN",
            product_model="MODEL-X123",
            lot_id="LOT-2026-001"
        )
        
        assert response.frontend_id == "EQ-17-03"
        assert response.equipment_id == 75
        assert response.status == "RUN"
    
    def test_single_response_model_nullable(self):
        """단일 응답 모델 - Null 필드 테스트"""
        response = EquipmentDetailResponse(
            frontend_id="EQ-17-03",
            equipment_id=None,
            equipment_name=None,
            line_name=None,
            status=None,
            product_model=None,
            lot_id=None
        )
        
        assert response.frontend_id == "EQ-17-03"
        assert response.equipment_id is None
        assert response.status is None
    
    def test_multi_request_model(self):
        """다중 요청 모델 테스트"""
        request = MultiEquipmentDetailRequest(
            frontend_ids=["EQ-17-03", "EQ-17-04", "EQ-18-01"]
        )
        
        assert len(request.frontend_ids) == 3
        assert "EQ-17-03" in request.frontend_ids
    
    def test_multi_request_model_validation(self):
        """다중 요청 모델 검증 테스트"""
        # 빈 리스트는 허용되지 않음
        with pytest.raises(ValueError):
            MultiEquipmentDetailRequest(frontend_ids=[])
    
    def test_multi_response_model(self):
        """다중 응답 모델 테스트"""
        response = MultiEquipmentDetailResponse(
            count=5,
            lines=["Line-A", "Line-B"],
            lines_more=False,
            status_counts={"RUN": 3, "IDLE": 2},
            products=["MODEL-X", "MODEL-Y"],
            products_more=False,
            lot_ids=["LOT-001", "LOT-002", "LOT-003"],
            lot_ids_more=True
        )
        
        assert response.count == 5
        assert len(response.lines) == 2
        assert response.status_counts["RUN"] == 3
        assert response.lot_ids_more is True


# ============================================================================
# Unit Tests - Service Layer
# ============================================================================

class TestEquipmentDetailService:
    """서비스 레이어 테스트"""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock DB 세션"""
        return MagicMock()
    
    def test_get_equipment_detail_not_found(self, mock_db_session):
        """존재하지 않는 설비 조회"""
        mock_db_session.execute.return_value.fetchone.return_value = None
        
        service = EquipmentDetailService(mock_db_session)
        result = service.get_equipment_detail(99999)
        
        assert result is None
    
    def test_get_equipment_detail_found(self, mock_db_session):
        """정상 설비 조회"""
        # Mock 결과 설정
        mock_row = MagicMock()
        mock_row.EquipmentId = 75
        mock_row.EquipmentName = "EQ-17-03"
        mock_row.LineName = "Line-A"
        mock_row.Status = "RUN"
        mock_row.StatusOccurredAt = None
        mock_row.ProductModel = "MODEL-X123"
        mock_row.LotId = "LOT-001"
        mock_row.LotOccurredAt = None
        
        mock_db_session.execute.return_value.fetchone.return_value = mock_row
        
        service = EquipmentDetailService(mock_db_session)
        result = service.get_equipment_detail(75)
        
        assert result is not None
        assert result.equipment_id == 75
        assert result.status == "RUN"
        assert result.line_name == "Line-A"
    
    def test_aggregation_max_items(self):
        """집계 시 최대 항목 수 제한 테스트"""
        assert EquipmentDetailService.MAX_DISPLAY_ITEMS == 3


# ============================================================================
# Integration Tests - API Endpoints
# ============================================================================

class TestEquipmentDetailAPI:
    """API 엔드포인트 통합 테스트"""
    
    def test_health_check(self):
        """헬스체크 테스트"""
        response = client.get("/api/equipment/detail/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "equipment-detail"
    
    @patch('backend.api.routers.equipment_detail.get_equipment_mapping')
    def test_single_equipment_no_mapping(self, mock_get_mapping):
        """매핑 없는 설비 조회"""
        mock_get_mapping.return_value = None
        
        response = client.get("/api/equipment/detail/EQ-99-99")
        
        assert response.status_code == 200
        data = response.json()
        assert data["frontend_id"] == "EQ-99-99"
        assert data["equipment_id"] is None
        assert data["status"] is None
    
    @patch('backend.api.routers.equipment_detail.get_equipment_mappings_batch')
    def test_multi_equipment_no_mappings(self, mock_get_mappings):
        """매핑 없는 다중 설비 조회"""
        mock_get_mappings.return_value = {}
        
        response = client.post(
            "/api/equipment/detail/multi",
            json={"frontend_ids": ["EQ-99-01", "EQ-99-02"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        assert data["lines"] == []
        assert data["status_counts"] == {}
    
    def test_multi_equipment_empty_request(self):
        """빈 요청 검증"""
        response = client.post(
            "/api/equipment/detail/multi",
            json={"frontend_ids": []}
        )
        
        # Pydantic 검증 실패
        assert response.status_code == 422


# ============================================================================
# Mock Data for Manual Testing
# ============================================================================

MOCK_EQUIPMENT_DATA = [
    {
        "equipment_id": 75,
        "equipment_name": "EQ-17-03",
        "line_name": "Line-A",
        "status": "RUN",
        "product_model": "MODEL-X123",
        "lot_id": "LOT-2026-001"
    },
    {
        "equipment_id": 76,
        "equipment_name": "EQ-17-04",
        "line_name": "Line-A",
        "status": "IDLE",
        "product_model": "MODEL-X123",
        "lot_id": "LOT-2026-002"
    },
    {
        "equipment_id": 77,
        "equipment_name": "EQ-18-01",
        "line_name": "Line-B",
        "status": "RUN",
        "product_model": "MODEL-Y456",
        "lot_id": "LOT-2026-003"
    }
]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])