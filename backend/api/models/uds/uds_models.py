"""
uds_models.py
UDS (Unified Data Store) Pydantic 모델 정의

@version 1.0.0
@description
- EquipmentData: 단일 설비 전체 데이터 (117개 설비 캐시용)
- UDSInitialResponse: 초기 로드 API 응답 (/api/uds/initial)
- DeltaUpdate: WebSocket Delta 메시지 (변경된 필드만)
- BatchDeltaUpdate: 배치 Delta 메시지
- StatusStats: 상태별 통계

@changelog
- v1.0.0: 초기 버전
          - EquipmentData: 기본/상태/생산/PC/매핑 정보 그룹
          - UDSInitialResponse: 초기 로드 배치 쿼리 응답
          - DeltaUpdate: 개별 설비 변경 메시지
          - BatchDeltaUpdate: 다중 설비 일괄 변경
          - StatusStats: RUN/IDLE/STOP/SUDDENSTOP/DISCONNECTED 카운트
          - ⚠️ 호환성: equipment_detail.py 모델과 독립적 설계

@dependencies
- pydantic
- datetime
- enum
- typing

📁 위치: backend/api/models/uds/uds_models.py
작성일: 2026-01-20
수정일: 2026-01-20
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


# ============================================================================
# Enums
# ============================================================================

class EquipmentStatus(str, Enum):
    """
    설비 상태 Enum
    
    Signal Tower 색상 매핑:
    - RUN: 🟢 Green (정상 가동)
    - IDLE: 🟡 Yellow (대기 중)
    - STOP: 🔴 Red (정지)
    - SUDDENSTOP: 🔴⚡ Red + Flash (비정상 정지)
    - DISCONNECTED: ⚫ Gray (연결 끊김)
    """
    RUN = "RUN"
    IDLE = "IDLE"
    STOP = "STOP"
    SUDDENSTOP = "SUDDENSTOP"
    DISCONNECTED = "DISCONNECTED"


# ============================================================================
# Core Data Models
# ============================================================================

class EquipmentData(BaseModel):
    """
    단일 설비 전체 데이터 모델
    
    UDS의 핵심 데이터 단위. 117개 설비 각각의 전체 정보를 담음.
    Frontend UnifiedDataStore의 Map<frontend_id, EquipmentData>로 캐싱됨.
    
    [필드 그룹]
    ┌──────────────────────────────────────────────────────────────┐
    │ 📌 기본 정보: equipment_id, frontend_id, equipment_name      │
    │              line_name                                       │
    │ 📊 상태 정보: status, status_changed_at                      │
    │ 🏭 생산 정보: product_model, lot_id, lot_start_time,        │
    │              production_count, tact_time_seconds            │
    │ 💻 PC 정보: cpu_usage_percent, memory_usage_percent,        │
    │            disk_usage_percent                               │
    │ 📍 매핑 정보: grid_row, grid_col                             │
    └──────────────────────────────────────────────────────────────┘
    
    DB 테이블 매핑:
    - core.Equipment: EquipmentId, EquipmentName, LineName
    - log.EquipmentState: Status, StatusChangedAt (OccurredAtUtc)
    - log.Lotinfo: LotId, ProductModel, OccurredAtUtc (IsStart=1)
    - log.CycleTime: COUNT → production_count, 간격 계산 → tact_time_seconds
    - log.EquipmentPCInfo: CPUUsagePercent, MemoryTotalMb, MemoryUsedMb, etc.
    - core.EquipmentMapping: GridRow, GridCol, FrontendId
    """
    
    # ========================================
    # 📌 기본 정보 (core.Equipment)
    # ========================================
    equipment_id: int = Field(
        ..., 
        description="DB Equipment ID (core.Equipment.EquipmentId)"
    )
    frontend_id: str = Field(
        ..., 
        description="3D Grid 매핑용 ID (예: EQ-01-01). Frontend 캐시 키로 사용"
    )
    equipment_name: str = Field(
        ..., 
        description="설비명 (core.Equipment.EquipmentName, 예: CUT-075)"
    )
    line_name: str = Field(
        default="", 
        description="라인명 (core.Equipment.LineName, 예: Line-A)"
    )
    
    # ========================================
    # 📊 상태 정보 (log.EquipmentState)
    # ========================================
    status: EquipmentStatus = Field(
        default=EquipmentStatus.DISCONNECTED,
        description="현재 상태 (RUN/IDLE/STOP/SUDDENSTOP/DISCONNECTED)"
    )
    status_changed_at: Optional[datetime] = Field(
        None, 
        description="상태 변경 시간 (log.EquipmentState.OccurredAtUtc)"
    )
    
    # ========================================
    # 🏭 생산 정보 (log.Lotinfo, log.CycleTime)
    # ========================================
    product_model: Optional[str] = Field(
        None, 
        description="제품 모델 (log.Lotinfo.ProductModel)"
    )
    lot_id: Optional[str] = Field(
        None, 
        description="현재 Lot ID (log.Lotinfo.LotId, IsStart=1)"
    )
    lot_start_time: Optional[datetime] = Field(
        None, 
        description="Lot 시작 시간 (log.Lotinfo.OccurredAtUtc, IsStart=1)"
    )
    production_count: int = Field(
        default=0, 
        description="현재 Lot 시작 이후 CycleTime 레코드 수 (생산 개수)"
    )
    tact_time_seconds: Optional[float] = Field(
        None, 
        description="최근 2개 CycleTime 간격 (초). 마지막 Tact Time"
    )
    
    # ========================================
    # 💻 PC 정보 (log.EquipmentPCInfo)
    # ========================================
    cpu_usage_percent: Optional[float] = Field(
        None, 
        description="CPU 사용율 % (log.EquipmentPCInfo.CPUUsagePercent)"
    )
    memory_usage_percent: Optional[float] = Field(
        None, 
        description="Memory 사용율 % (계산: MemoryUsedMb / MemoryTotalMb * 100)"
    )
    disk_usage_percent: Optional[float] = Field(
        None, 
        description="Disk 사용율 % (계산: DisksUsedGb / DisksTotalGb * 100, C 드라이브 기준)"
    )
    
    # ========================================
    # 📍 매핑 정보 (core.EquipmentMapping)
    # ========================================
    grid_row: int = Field(
        default=0, 
        description="3D Grid 행 번호 (core.EquipmentMapping.GridRow)"
    )
    grid_col: int = Field(
        default=0, 
        description="3D Grid 열 번호 (core.EquipmentMapping.GridCol)"
    )
    
    class Config:
        """Pydantic 설정"""
        # datetime을 ISO 포맷 문자열로 직렬화
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
        # Enum을 값으로 직렬화
        use_enum_values = True
        
        # JSON Schema 예시
        json_schema_extra = {
            "example": {
                "equipment_id": 75,
                "frontend_id": "EQ-17-03",
                "equipment_name": "CUT-075",
                "line_name": "Line-A",
                "status": "RUN",
                "status_changed_at": "2026-01-20T10:30:00+08:00",
                "product_model": "MODEL-X123",
                "lot_id": "LOT-2026-001",
                "lot_start_time": "2026-01-20T08:00:00+08:00",
                "production_count": 127,
                "tact_time_seconds": 72.5,
                "cpu_usage_percent": 45.2,
                "memory_usage_percent": 78.5,
                "disk_usage_percent": 35.0,
                "grid_row": 17,
                "grid_col": 3
            }
        }


# ============================================================================
# Statistics Models
# ============================================================================

class StatusStats(BaseModel):
    """
    설비 상태별 통계
    
    StatusBar Equipment Section 표시용.
    Frontend에서 UDS 캐시로부터 실시간 집계 가능하지만,
    초기 로드 시 Backend에서 미리 계산하여 전달.
    """
    RUN: int = Field(default=0, description="🟢 가동 중 설비 수")
    IDLE: int = Field(default=0, description="🟡 대기 중 설비 수")
    STOP: int = Field(default=0, description="🔴 정지 설비 수")
    SUDDENSTOP: int = Field(default=0, description="🔴⚡ 비정상 정지 설비 수")
    DISCONNECTED: int = Field(default=0, description="⚫ 연결 끊김 설비 수")
    TOTAL: int = Field(default=0, description="전체 설비 수")
    
    class Config:
        json_schema_extra = {
            "example": {
                "RUN": 85,
                "IDLE": 20,
                "STOP": 8,
                "SUDDENSTOP": 2,
                "DISCONNECTED": 2,
                "TOTAL": 117
            }
        }


# ============================================================================
# API Response Models
# ============================================================================

class UDSInitialResponse(BaseModel):
    """
    초기 로드 API 응답 모델
    
    GET /api/uds/initial 엔드포인트 응답.
    Frontend 앱 시작 시 1회 호출하여 전체 117개 설비 데이터 수신.
    
    데이터 흐름:
    1. Frontend 앱 시작
    2. GET /api/uds/initial 호출
    3. Backend 배치 쿼리 실행 (WITH NOLOCK)
    4. 전체 설비 데이터 + 통계 응답
    5. Frontend UnifiedDataStore에 캐싱
    
    ⚠️ 주의: 최초 1회만 호출. 이후 Delta Update로 변경분만 수신.
    """
    equipments: List[EquipmentData] = Field(
        ..., 
        description="전체 설비 데이터 목록 (117개)"
    )
    total_count: int = Field(
        ..., 
        description="전체 설비 수 (len(equipments) 검증용)"
    )
    stats: StatusStats = Field(
        ..., 
        description="상태별 통계 (StatusBar 초기화용)"
    )
    timestamp: datetime = Field(
        ..., 
        description="응답 생성 시간 (서버 기준, UTC)"
    )
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
        json_schema_extra = {
            "example": {
                "equipments": [
                    {
                        "equipment_id": 1,
                        "frontend_id": "EQ-01-01",
                        "equipment_name": "CUT-001",
                        "line_name": "Line-A",
                        "status": "RUN",
                        "status_changed_at": "2026-01-20T10:30:00+08:00",
                        "product_model": "MODEL-X",
                        "lot_id": "LOT-001",
                        "lot_start_time": "2026-01-20T08:00:00+08:00",
                        "production_count": 100,
                        "tact_time_seconds": 60.0,
                        "cpu_usage_percent": 45.0,
                        "memory_usage_percent": 70.0,
                        "disk_usage_percent": 30.0,
                        "grid_row": 1,
                        "grid_col": 1
                    }
                ],
                "total_count": 117,
                "stats": {
                    "RUN": 85,
                    "IDLE": 20,
                    "STOP": 8,
                    "SUDDENSTOP": 2,
                    "DISCONNECTED": 2,
                    "TOTAL": 117
                },
                "timestamp": "2026-01-20T10:35:00Z"
            }
        }


# ============================================================================
# WebSocket Delta Models
# ============================================================================

class DeltaUpdate(BaseModel):
    """
    WebSocket Delta Update 메시지
    
    변경된 필드만 포함하여 네트워크 트래픽 최소화.
    
    메시지 구조:
    {
        "type": "delta",
        "frontend_id": "EQ-17-03",
        "changes": {
            "status": "IDLE",          // 변경된 필드만
            "cpu_usage_percent": 52.3
        },
        "timestamp": "2026-01-20T10:35:00Z"
    }
    
    Frontend 처리:
    1. WebSocket 메시지 수신
    2. frontend_id로 UDS 캐시에서 기존 데이터 조회
    3. changes 객체의 필드만 Object.assign으로 병합
    4. 해당 설비 UI만 업데이트 (3D SignalTower, Detail Panel 등)
    """
    type: str = Field(
        default="delta", 
        description="메시지 타입 (항상 'delta')"
    )
    frontend_id: str = Field(
        ..., 
        description="변경된 설비의 Frontend ID"
    )
    changes: Dict[str, Any] = Field(
        ..., 
        description="변경된 필드만 포함 (key: 필드명, value: 새 값)"
    )
    timestamp: datetime = Field(
        ..., 
        description="변경 감지 시간 (서버 기준, UTC)"
    )
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
        json_schema_extra = {
            "example": {
                "type": "delta",
                "frontend_id": "EQ-17-03",
                "changes": {
                    "status": "IDLE",
                    "status_changed_at": "2026-01-20T10:35:00+08:00",
                    "cpu_usage_percent": 52.3
                },
                "timestamp": "2026-01-20T10:35:00Z"
            }
        }


class BatchDeltaUpdate(BaseModel):
    """
    배치 Delta Update 메시지
    
    여러 설비 변경을 한 번에 전송하여 WebSocket 오버헤드 감소.
    Status Watcher가 10초 주기로 Diff 감지 후 변경된 설비들을 일괄 전송.
    
    메시지 구조:
    {
        "type": "batch_delta",
        "updates": [
            {"type": "delta", "frontend_id": "EQ-17-03", "changes": {...}},
            {"type": "delta", "frontend_id": "EQ-18-01", "changes": {...}}
        ],
        "timestamp": "2026-01-20T10:35:00Z"
    }
    
    ⚠️ 최적화: 변경 없으면 메시지 전송하지 않음.
    """
    type: str = Field(
        default="batch_delta", 
        description="메시지 타입 (항상 'batch_delta')"
    )
    updates: List[DeltaUpdate] = Field(
        ..., 
        description="개별 Delta Update 목록"
    )
    timestamp: datetime = Field(
        ..., 
        description="배치 생성 시간 (서버 기준, UTC)"
    )
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
        json_schema_extra = {
            "example": {
                "type": "batch_delta",
                "updates": [
                    {
                        "type": "delta",
                        "frontend_id": "EQ-17-03",
                        "changes": {"status": "IDLE"},
                        "timestamp": "2026-01-20T10:35:00Z"
                    },
                    {
                        "type": "delta",
                        "frontend_id": "EQ-18-01",
                        "changes": {"production_count": 128},
                        "timestamp": "2026-01-20T10:35:00Z"
                    }
                ],
                "timestamp": "2026-01-20T10:35:00Z"
            }
        }


# ============================================================================
# Internal State Models (Backend 내부용)
# ============================================================================

class EquipmentSnapshot(BaseModel):
    """
    설비 상태 스냅샷 (Backend Diff 비교용)
    
    Status Watcher Service가 10초마다 현재 상태를 스냅샷으로 저장.
    이전 스냅샷과 비교하여 변경된 필드만 Delta로 추출.
    
    ⚠️ 내부 전용: Frontend로 직접 전송되지 않음.
    """
    frontend_id: str
    status: Optional[str] = None
    status_changed_at: Optional[datetime] = None
    cpu_usage_percent: Optional[float] = None
    memory_usage_percent: Optional[float] = None
    production_count: Optional[int] = None
    tact_time_seconds: Optional[float] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# ============================================================================
# Utility Functions
# ============================================================================

def compute_status_stats(equipments: List[EquipmentData]) -> StatusStats:
    """
    설비 목록에서 상태별 통계 계산
    
    Args:
        equipments: EquipmentData 목록
        
    Returns:
        StatusStats: 상태별 카운트
    
    Example:
        >>> stats = compute_status_stats(equipments)
        >>> print(stats.RUN)  # 85
    """
    stats = StatusStats(TOTAL=len(equipments))
    
    for eq in equipments:
        status = eq.status if isinstance(eq.status, str) else eq.status.value
        if status == EquipmentStatus.RUN.value:
            stats.RUN += 1
        elif status == EquipmentStatus.IDLE.value:
            stats.IDLE += 1
        elif status == EquipmentStatus.STOP.value:
            stats.STOP += 1
        elif status == EquipmentStatus.SUDDENSTOP.value:
            stats.SUDDENSTOP += 1
        elif status == EquipmentStatus.DISCONNECTED.value:
            stats.DISCONNECTED += 1
    
    return stats


def compute_delta(
    old: EquipmentSnapshot, 
    new: EquipmentSnapshot
) -> Optional[Dict[str, Any]]:
    """
    두 스냅샷 비교하여 변경된 필드만 반환
    
    Args:
        old: 이전 스냅샷
        new: 현재 스냅샷
        
    Returns:
        변경된 필드 딕셔너리 또는 None (변경 없음)
    
    Example:
        >>> changes = compute_delta(old_snapshot, new_snapshot)
        >>> if changes:
        ...     print(changes)  # {"status": "IDLE", "cpu_usage_percent": 52.3}
    """
    changes = {}
    
    # 비교할 필드 목록
    compare_fields = [
        'status', 'status_changed_at',
        'cpu_usage_percent', 'memory_usage_percent',
        'production_count', 'tact_time_seconds'
    ]
    
    for field in compare_fields:
        old_val = getattr(old, field, None)
        new_val = getattr(new, field, None)
        
        # 값이 다르면 변경으로 간주
        if old_val != new_val:
            changes[field] = new_val
    
    return changes if changes else None