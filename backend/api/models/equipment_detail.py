"""
Equipment Detail API - Pydantic Schemas
설비 상세 정보 패널용 데이터 모델

@version 1.3.0
@changelog
- v1.3.0: General Tab 확장 (lot_start_time) + PC Info Tab 필드 추가
          - lot_start_time: Lot 시작 시간 (log.Lotinfo.OccurredAtUtc, IsStart=1)
          - PC Info: cpu_name, cpu_logical_count, gpu_name, os_name, etc.
          - cpu_usage_percent: 실시간 CPU 사용율
          - Multi Selection: avg_cpu_usage_percent 추가
- v1.2.0: MultiEquipmentDetailRequest에 equipment_ids 필드 추가 (Frontend 매핑 우선)
- v1.0.0: 초기 버전

작성일: 2026-01-06
수정일: 2026-01-08
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


# ============================================================================
# Request Models
# ============================================================================

class MultiEquipmentDetailRequest(BaseModel):
    """다중 설비 상세 정보 요청
    
    🆕 v1.2.0: equipment_ids 필드 추가
    - Frontend에서 equipmentEditState의 매핑 정보를 직접 전달
    - Backend equipment_mapping 테이블과의 동기화 문제 해결
    """
    frontend_ids: List[str] = Field(
        ...,
        description="Frontend ID 목록 (예: ['EQ-17-03', 'EQ-17-04'])",
        min_length=1,
        max_length=100
    )
    
    # 🆕 v1.2.0: Equipment IDs (Frontend 매핑에서 전달, 우선 사용)
    equipment_ids: Optional[List[int]] = Field(
        None,
        description="Equipment ID 목록 (Frontend에서 전달 시 우선 사용)",
        max_length=100
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "frontend_ids": ["EQ-17-03", "EQ-17-04", "EQ-18-01"],
                "equipment_ids": [1, 2, 5]
            }
        }


# ============================================================================
# Response Models - Single Equipment
# ============================================================================

class EquipmentDetailResponse(BaseModel):
    """단일 설비 상세 정보 응답
    
    🆕 v1.3.0: General Tab 확장 + PC Info Tab 필드 추가
    
    DB 테이블 매핑:
    - core.Equipment: EquipmentId, EquipmentName, LineName
    - log.EquipmentState: Status, OccurredAtUtc
    - log.Lotinfo: LotId, ProductModel, OccurredAtUtc (IsStart=1)
    - core.EquipmentPCInfo: OS, Architecture, LastBootTime, CPUName, CPULogicalCount, GPUName, UpdateAtUtc
    - log.EquipmentPCInfo: CPUUsagePercent
    """
    
    # ============================================
    # 기본 정보 (기존 필드 - 호환성 유지)
    # ============================================
    frontend_id: str = Field(..., description="Frontend ID (예: EQ-17-03)")
    equipment_id: Optional[int] = Field(None, description="DB Equipment ID")
    equipment_name: Optional[str] = Field(None, description="설비명 (core.Equipment.EquipmentName)")
    line_name: Optional[str] = Field(None, description="라인명 (core.Equipment.LineName)")
    status: Optional[str] = Field(None, description="현재 상태 (log.EquipmentState.Status)")
    product_model: Optional[str] = Field(None, description="제품 모델 (log.Lotinfo.ProductModel)")
    lot_id: Optional[str] = Field(None, description="Lot ID (log.Lotinfo.LotId)")
    last_updated: Optional[datetime] = Field(None, description="마지막 업데이트 시간")
    
    # ============================================
    # 🆕 v1.3.0: General Tab 확장 - Lot 시작 시간
    # ============================================
    lot_start_time: Optional[datetime] = Field(
        None, 
        description="Lot 시작 시간 (log.Lotinfo.OccurredAtUtc, IsStart=1)"
    )
    
    # ============================================
    # 🆕 v1.3.0: PC Info Tab - 고정 정보 (core.EquipmentPCInfo)
    # ============================================
    cpu_name: Optional[str] = Field(
        None, 
        description="CPU 이름 (core.EquipmentPCInfo.CPUName)"
    )
    cpu_logical_count: Optional[int] = Field(
        None, 
        description="CPU 논리 코어 수 (core.EquipmentPCInfo.CPULogicalCount)"
    )
    gpu_name: Optional[str] = Field(
        None, 
        description="GPU 이름 (core.EquipmentPCInfo.GPUName)"
    )
    os_name: Optional[str] = Field(
        None, 
        description="OS 이름 (core.EquipmentPCInfo.OS)"
    )
    os_architecture: Optional[str] = Field(
        None, 
        description="OS 아키텍처 (core.EquipmentPCInfo.Architecture)"
    )
    last_boot_time: Optional[datetime] = Field(
        None, 
        description="마지막 부팅 시간 (core.EquipmentPCInfo.LastBootTime)"
    )
    pc_last_update_time: Optional[datetime] = Field(
        None, 
        description="PC 정보 마지막 업데이트 (core.EquipmentPCInfo.UpdateAtUtc)"
    )
    
    # ============================================
    # 🆕 v1.3.0: PC Info Tab - 실시간 정보 (log.EquipmentPCInfo)
    # ============================================
    cpu_usage_percent: Optional[float] = Field(
        None, 
        description="CPU 사용율 % (log.EquipmentPCInfo.CPUUsagePercent)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "frontend_id": "EQ-17-03",
                "equipment_id": 75,
                "equipment_name": "CUT-075",
                "line_name": "Line-A",
                "status": "RUN",
                "product_model": "MODEL-X123",
                "lot_id": "LOT-2026-001",
                "last_updated": "2026-01-08T21:24:55+08:00",
                # 🆕 v1.3.0: General Tab 확장
                "lot_start_time": "2026-01-08T10:30:00+08:00",
                # 🆕 v1.3.0: PC Info Tab - 고정 정보
                "cpu_name": "Intel(R) Core(TM) i7-12700K",
                "cpu_logical_count": 20,
                "gpu_name": "NVIDIA GeForce RTX 3080",
                "os_name": "Windows 11 Pro",
                "os_architecture": "64-bit",
                "last_boot_time": "2026-01-01T08:00:00+08:00",
                "pc_last_update_time": "2026-01-08T10:00:00+08:00",
                # 🆕 v1.3.0: PC Info Tab - 실시간 정보
                "cpu_usage_percent": 45.2
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
    """다중 설비 상세 정보 응답 (집계)
    
    🆕 v1.3.0: PC Info 집계 필드 추가 (avg_cpu_usage_percent)
    """
    count: int = Field(..., description="선택된 설비 수")
    
    # ============================================
    # General Tab 집계 (기존 필드 - 호환성 유지)
    # ============================================
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
    
    # ============================================
    # 🆕 v1.3.0: PC Info Tab 집계
    # ============================================
    avg_cpu_usage_percent: Optional[float] = Field(
        None, 
        description="평균 CPU 사용율 % (Multi Selection 시 평균 계산)"
    )
    
    # CPU 이름 목록 (중복 제거, 최대 3개) - 여러 종류의 CPU가 있을 수 있음
    cpu_names: List[str] = Field(
        default_factory=list, 
        description="CPU 이름 목록 (최대 3개, 중복 제거)"
    )
    cpu_names_more: bool = Field(False, description="3개 초과 여부")
    
    # GPU 이름 목록 (중복 제거, 최대 3개)
    gpu_names: List[str] = Field(
        default_factory=list, 
        description="GPU 이름 목록 (최대 3개, 중복 제거)"
    )
    gpu_names_more: bool = Field(False, description="3개 초과 여부")
    
    # OS 이름 목록 (중복 제거, 최대 3개)
    os_names: List[str] = Field(
        default_factory=list, 
        description="OS 이름 목록 (최대 3개, 중복 제거)"
    )
    os_names_more: bool = Field(False, description="3개 초과 여부")
    
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
                "lot_ids_more": True,
                # 🆕 v1.3.0: PC Info 집계
                "avg_cpu_usage_percent": 48.5,
                "cpu_names": ["Intel(R) Core(TM) i7-12700K"],
                "cpu_names_more": False,
                "gpu_names": ["NVIDIA GeForce RTX 3080"],
                "gpu_names_more": False,
                "os_names": ["Windows 11 Pro"],
                "os_names_more": False
            }
        }


# ============================================================================
# Internal Data Models (Service Layer 용)
# ============================================================================

class EquipmentDetailData(BaseModel):
    """내부용 설비 상세 데이터
    
    🆕 v1.3.0: PC Info 필드 추가
    """
    equipment_id: int
    equipment_name: Optional[str] = None
    line_name: Optional[str] = None
    status: Optional[str] = None
    status_occurred_at: Optional[datetime] = None
    product_model: Optional[str] = None
    lot_id: Optional[str] = None
    lot_occurred_at: Optional[datetime] = None
    
    # 🆕 v1.3.0: Lot 시작 시간 (General Tab)
    lot_start_time: Optional[datetime] = None
    
    # 🆕 v1.3.0: PC Info (고정 정보)
    cpu_name: Optional[str] = None
    cpu_logical_count: Optional[int] = None
    gpu_name: Optional[str] = None
    os_name: Optional[str] = None
    os_architecture: Optional[str] = None
    last_boot_time: Optional[datetime] = None
    pc_last_update_time: Optional[datetime] = None
    
    # 🆕 v1.3.0: PC Info (실시간)
    cpu_usage_percent: Optional[float] = None