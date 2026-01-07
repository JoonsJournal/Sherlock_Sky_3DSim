"""
Equipment Detail API - Pydantic Schemas
설비 상세 정보 패널용 데이터 모델

작성일: 2026-01-06
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


# ============================================================================
# Request Models
# ============================================================================

class MultiEquipmentDetailRequest(BaseModel):
    """다중 설비 상세 정보 요청"""
    frontend_ids: List[str] = Field(
        ...,
        description="Frontend ID 목록 (예: ['EQ-17-03', 'EQ-17-04'])",
        min_length=1,
        max_length=100
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "frontend_ids": ["EQ-17-03", "EQ-17-04", "EQ-18-01"]
            }
        }


# ============================================================================
# Response Models - Single Equipment
# ============================================================================

class EquipmentDetailResponse(BaseModel):
    """단일 설비 상세 정보 응답"""
    frontend_id: str = Field(..., description="Frontend ID (예: EQ-17-03)")
    equipment_id: Optional[int] = Field(None, description="DB Equipment ID")
    equipment_name: Optional[str] = Field(None, description="설비명 (core.Equipment.EquipmentName)")
    line_name: Optional[str] = Field(None, description="라인명 (core.Equipment.LineName)")
    status: Optional[str] = Field(None, description="현재 상태 (log.EquipmentState.Status)")
    product_model: Optional[str] = Field(None, description="제품 모델 (log.Lotinfo.ProductModel)")
    lot_id: Optional[str] = Field(None, description="Lot ID (log.Lotinfo.LotId)")
    last_updated: Optional[datetime] = Field(None, description="마지막 업데이트 시간")
    
    class Config:
        json_schema_extra = {
            "example": {
                "frontend_id": "EQ-17-03",
                "equipment_id": 75,
                "equipment_name": "EQ-17-03",
                "line_name": "Line-A",
                "status": "RUN",
                "product_model": "MODEL-X123",
                "lot_id": "LOT-2026-001",
                "last_updated": "2026-01-06T21:24:55Z"
            }
        }


# ============================================================================
# Response Models - Multi Equipment
# ============================================================================

class StatusCount(BaseModel):
    """상태별 카운트"""
    status: str
    count: int


class MultiEquipmentDetailResponse(BaseModel):
    """다중 설비 상세 정보 응답 (집계)"""
    count: int = Field(..., description="선택된 설비 수")
    
    # Line 정보 (중복 제거, 최대 3개)
    lines: List[str] = Field(default_factory=list, description="라인명 목록 (최대 3개)")
    lines_more: bool = Field(False, description="3개 초과 여부")
    
    # Status 집계 (상태별 카운트)
    status_counts: Dict[str, int] = Field(
        default_factory=dict, 
        description="상태별 설비 수 (예: {'RUN': 5, 'IDLE': 2})"
    )
    
    # Product 정보 (중복 제거, 최대 3개)
    products: List[str] = Field(default_factory=list, description="제품 모델 목록 (최대 3개)")
    products_more: bool = Field(False, description="3개 초과 여부")
    
    # Lot ID 정보 (중복 제거, 최대 3개)
    lot_ids: List[str] = Field(default_factory=list, description="Lot ID 목록 (최대 3개)")
    lot_ids_more: bool = Field(False, description="3개 초과 여부")
    
    class Config:
        json_schema_extra = {
            "example": {
                "count": 5,
                "lines": ["Line-A", "Line-B"],
                "lines_more": False,
                "status_counts": {"RUN": 3, "IDLE": 1, "STOP": 1},
                "products": ["MODEL-X123", "MODEL-Y456"],
                "products_more": False,
                "lot_ids": ["LOT-001", "LOT-002", "LOT-003"],
                "lot_ids_more": True
            }
        }


# ============================================================================
# Internal Data Models (Service Layer 용)
# ============================================================================

class EquipmentDetailData(BaseModel):
    """내부용 설비 상세 데이터"""
    equipment_id: int
    equipment_name: Optional[str] = None
    line_name: Optional[str] = None
    status: Optional[str] = None
    status_occurred_at: Optional[datetime] = None
    product_model: Optional[str] = None
    lot_id: Optional[str] = None
    lot_occurred_at: Optional[datetime] = None