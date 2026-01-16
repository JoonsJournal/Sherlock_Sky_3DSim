"""
Equipment Detail API - Pydantic Schemas
설비 상세 정보 패널용 데이터 모델

@version 2.1.0
@changelog
- v2.1.0: Production Count & Tact Time 추가
          - EquipmentDetailResponse: production_count, tact_time_seconds 추가
          - MultiEquipmentDetailResponse: production_total, tact_time_avg 추가
          - EquipmentDetailData: Production, Tact Time 필드 추가
          - ⚠️ 호환성: 기존 모든 필드 100% 유지
- v2.0.0: PC Info Tab 확장 - Memory, Disk 필드 추가
          - EquipmentDetailResponse: memory_total_gb, memory_used_gb, disk_c_*, disk_d_* 추가
          - MultiEquipmentDetailResponse: avg_memory_usage_percent, avg_disk_c/d_usage_percent 추가
          - EquipmentDetailData: Memory, Disk 필드 추가
          - ⚠️ 호환성: 기존 모든 필드 100% 유지
- v1.4.0: Lot Active/Inactive 분기 지원
          - is_lot_active: 최신 Lotinfo 레코드의 IsStart 값 (1=Active, 0=Inactive)
          - since_time: Lot 종료 시점 (IsStart=0인 경우, Duration 계산용)
          - lot_start_time 유지 (IsStart=1인 경우)
          - PC Info 필드 유지
- v1.3.0: General Tab 확장 (lot_start_time) + PC Info Tab 필드 추가
- v1.2.0: MultiEquipmentDetailRequest에 equipment_ids 필드 추가
- v1.0.0: 초기 버전

작성일: 2026-01-06
수정일: 2026-01-16
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
    
    🆕 v2.1.0: Production Count & Tact Time 추가
    🆕 v2.0.0: PC Info Tab 확장 - Memory, Disk 필드 추가
    
    DB 테이블 매핑:
    - core.Equipment: EquipmentId, EquipmentName, LineName
    - log.EquipmentState: Status, OccurredAtUtc
    - log.Lotinfo: LotId, ProductModel, IsStart, OccurredAtUtc
    - log.CycleTime: Time (Tact Time 계산용)
    - core.EquipmentPCInfo: OS, Architecture, LastBootTime, CPUName, CPULogicalCount, GPUName, UpdateAtUtc
    - log.EquipmentPCInfo: CPUUsagePercent, MemoryTotalMb, MemoryUsedMb, DiskTotalGb, DiskUsedGb, DiskTotalGb2, DiskUsedGb2
    
    Lot Active/Inactive 분기:
    - is_lot_active=True (IsStart=1): Product, Lot No, Lot Start, Lot Duration, Production, Tact Time 표시
    - is_lot_active=False (IsStart=0): Product="-", Lot No="-", Since, Duration 표시
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
    # 🆕 v1.4.0: Lot Active/Inactive 분기 필드
    # ============================================
    is_lot_active: Optional[bool] = Field(
        None,
        description="Lot 진행 중 여부 (True: IsStart=1, False: IsStart=0 또는 레코드 없음)"
    )
    
    # Lot Active 시 사용 (is_lot_active=True)
    lot_start_time: Optional[datetime] = Field(
        None, 
        description="Lot 시작 시간 (log.Lotinfo.OccurredAtUtc, IsStart=1인 경우)"
    )
    
    # Lot Inactive 시 사용 (is_lot_active=False)
    since_time: Optional[datetime] = Field(
        None,
        description="Lot 종료 시점 (log.Lotinfo.OccurredAtUtc, IsStart=0인 경우, Duration 계산용)"
    )
    
    # ============================================
    # 🆕 v2.1.0: Production & Tact Time 필드
    # ============================================
    production_count: Optional[int] = Field(
        None,
        description="현재 Lot 시작 이후 생산 개수 (log.CycleTime COUNT, is_lot_active=True일 때만 유효)"
    )
    
    tact_time_seconds: Optional[float] = Field(
        None,
        description="마지막 Tact Time 초 단위 (log.CycleTime 최근 2개 간격)"
    )
    
    # ============================================
    # PC Info Tab - 고정 정보 (core.EquipmentPCInfo)
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
    # PC Info Tab - 실시간 정보 (log.EquipmentPCInfo)
    # ============================================
    cpu_usage_percent: Optional[float] = Field(
        None, 
        description="CPU 사용율 % (log.EquipmentPCInfo.CPUUsagePercent)"
    )
    
    # 🆕 v2.0.0: Memory (MB → GB 변환)
    memory_total_gb: Optional[float] = Field(
        None,
        description="Memory 전체 용량 GB (log.EquipmentPCInfo.MemoryTotalMb / 1024)"
    )
    memory_used_gb: Optional[float] = Field(
        None,
        description="Memory 사용량 GB (log.EquipmentPCInfo.MemoryUsedMb / 1024)"
    )
    
    # 🆕 v2.0.0: Disk C
    disk_c_total_gb: Optional[float] = Field(
        None,
        description="Disk C 전체 용량 GB (log.EquipmentPCInfo.DiskTotalGb)"
    )
    disk_c_used_gb: Optional[float] = Field(
        None,
        description="Disk C 사용량 GB (log.EquipmentPCInfo.DiskUsedGb)"
    )
    
    # 🆕 v2.0.0: Disk D (NULL 가능 - 없는 설비는 Frontend에서 행 숨김 처리)
    disk_d_total_gb: Optional[float] = Field(
        None,
        description="Disk D 전체 용량 GB (log.EquipmentPCInfo.DiskTotalGb2, NULL 가능)"
    )
    disk_d_used_gb: Optional[float] = Field(
        None,
        description="Disk D 사용량 GB (log.EquipmentPCInfo.DiskUsedGb2, NULL 가능)"
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
                "last_updated": "2026-01-16T21:24:55+08:00",
                # 🆕 v1.4.0: Lot Active/Inactive
                "is_lot_active": True,
                "lot_start_time": "2026-01-16T10:30:00+08:00",
                "since_time": None,
                # 🆕 v2.1.0: Production & Tact Time
                "production_count": 127,
                "tact_time_seconds": 72.5,
                # PC Info Tab - 고정 정보
                "cpu_name": "Intel(R) Core(TM) i7-12700K",
                "cpu_logical_count": 20,
                "gpu_name": "NVIDIA GeForce RTX 3080",
                "os_name": "Windows 11 Pro",
                "os_architecture": "64-bit",
                "last_boot_time": "2026-01-01T08:00:00+08:00",
                "pc_last_update_time": "2026-01-16T10:00:00+08:00",
                # PC Info Tab - 실시간 정보
                "cpu_usage_percent": 45.2,
                # 🆕 v2.0.0: Memory, Disk
                "memory_total_gb": 16.0,
                "memory_used_gb": 12.5,
                "disk_c_total_gb": 500.0,
                "disk_c_used_gb": 120.0,
                "disk_d_total_gb": 1000.0,
                "disk_d_used_gb": 200.0
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
    
    🆕 v2.1.0: Production 합계 & Tact Time 평균 추가
    - production_total: 전체 Production 합계
    - tact_time_avg: 평균 Tact Time (초)
    
    🆕 v2.0.0: Memory, Disk 평균 추가
    - avg_memory_usage_percent: 평균 Memory 사용율 %
    - avg_disk_c_usage_percent: 평균 Disk C 사용율 %
    - avg_disk_d_usage_percent: 평균 Disk D 사용율 % (NULL인 설비는 제외)
    
    기존 집계 방식 유지 (Lot Active/Inactive 개수 집계는 추가하지 않음)
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
    # 🆕 v2.1.0: Production & Tact Time 집계
    # ============================================
    production_total: Optional[int] = Field(
        None,
        description="전체 Production 합계 (모든 선택 설비의 production_count SUM)"
    )
    
    tact_time_avg: Optional[float] = Field(
        None,
        description="평균 Tact Time 초 단위 (유효한 값만 평균 계산)"
    )
    
    # ============================================
    # PC Info Tab 집계 (기존 필드 - 호환성 유지)
    # ============================================
    avg_cpu_usage_percent: Optional[float] = Field(
        None, 
        description="평균 CPU 사용율 % (Multi Selection 시 평균 계산)"
    )
    
    # 🆕 v2.0.0: 평균 Memory 사용율 %
    avg_memory_usage_percent: Optional[float] = Field(
        None,
        description="평균 Memory 사용율 % (UsedMb / TotalMb * 100)"
    )
    
    # 🆕 v2.0.0: 평균 Disk C 사용율 %
    avg_disk_c_usage_percent: Optional[float] = Field(
        None,
        description="평균 Disk C 사용율 % (UsedGb / TotalGb * 100)"
    )
    
    # 🆕 v2.0.0: 평균 Disk D 사용율 % (NULL인 설비는 평균 계산에서 제외)
    avg_disk_d_usage_percent: Optional[float] = Field(
        None,
        description="평균 Disk D 사용율 % (NULL인 설비는 제외하고 계산)"
    )
    
    # CPU 이름 목록 (중복 제거, 최대 3개)
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
                # 🆕 v2.1.0: Production & Tact Time 집계
                "production_total": 1234,
                "tact_time_avg": 68.3,
                # PC Info 집계
                "avg_cpu_usage_percent": 48.5,
                # 🆕 v2.0.0: Memory, Disk 평균
                "avg_memory_usage_percent": 78.2,
                "avg_disk_c_usage_percent": 45.0,
                "avg_disk_d_usage_percent": 32.5,
                # 기존 필드
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
    
    🆕 v2.1.0: Production & Tact Time 필드 추가
    🆕 v2.0.0: Memory, Disk 필드 추가
    🆕 v1.4.0: Lot Active/Inactive 필드 추가
    """
    equipment_id: int
    equipment_name: Optional[str] = None
    line_name: Optional[str] = None
    status: Optional[str] = None
    status_occurred_at: Optional[datetime] = None
    product_model: Optional[str] = None
    lot_id: Optional[str] = None
    lot_occurred_at: Optional[datetime] = None
    
    # 🆕 v1.4.0: Lot Active/Inactive 분기
    is_lot_active: Optional[bool] = None  # IsStart 값 (1=True, 0=False)
    lot_start_time: Optional[datetime] = None  # IsStart=1인 경우
    since_time: Optional[datetime] = None  # IsStart=0인 경우
    
    # 🆕 v2.1.0: Production & Tact Time
    production_count: Optional[int] = None  # Lot 시작 이후 CycleTime COUNT
    tact_time_seconds: Optional[float] = None  # 최근 2개 CycleTime 간격 (초)
    
    # PC Info (고정 정보)
    cpu_name: Optional[str] = None
    cpu_logical_count: Optional[int] = None
    gpu_name: Optional[str] = None
    os_name: Optional[str] = None
    os_architecture: Optional[str] = None
    last_boot_time: Optional[datetime] = None
    pc_last_update_time: Optional[datetime] = None
    
    # PC Info (실시간)
    cpu_usage_percent: Optional[float] = None
    
    # 🆕 v2.0.0: Memory (GB 단위)
    memory_total_gb: Optional[float] = None
    memory_used_gb: Optional[float] = None
    
    # 🆕 v2.0.0: Disk C (GB 단위)
    disk_c_total_gb: Optional[float] = None
    disk_c_used_gb: Optional[float] = None
    
    # 🆕 v2.0.0: Disk D (GB 단위, NULL 가능)
    disk_d_total_gb: Optional[float] = None
    disk_d_used_gb: Optional[float] = None