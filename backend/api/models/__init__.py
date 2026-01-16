"""
Equipment Detail Models Package
설비 상세 정보 API 데이터 모델

@version 2.1.0
"""

from .equipment_detail import (
    # Request Models
    MultiEquipmentDetailRequest,
    
    # Response Models - Single
    EquipmentDetailResponse,
    
    # Response Models - Multi
    StatusCount,
    MultiEquipmentDetailResponse,
    
    # Internal Data Models
    EquipmentDetailData
)

__all__ = [
    # Request
    "MultiEquipmentDetailRequest",
    
    # Response - Single
    "EquipmentDetailResponse",
    
    # Response - Multi
    "StatusCount",
    "MultiEquipmentDetailResponse",
    
    # Internal
    "EquipmentDetailData"
]