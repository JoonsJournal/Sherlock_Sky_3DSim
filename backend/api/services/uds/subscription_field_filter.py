"""
subscription_field_filter.py
============================
Backend 구독 레벨별 필드 필터링 모듈

@version 1.0.0
@description
- MINIMAL/STANDARD/DETAILED 레벨별 필드 정의
- 설비 데이터 필터링 유틸리티
- 클라이언트별 구독 상태 관리
- WebSocket broadcast 시 클라이언트별 맞춤 데이터 전송

@changelog
- v1.0.0 (2026-02-04): 초기 구현
          - SubscriptionLevel Enum 정의
          - LEVEL_FIELDS 상수 정의
          - SubscriptionFieldFilter 클래스
          - ClientSubscriptionManager 클래스
          - filter_equipment_data() 유틸리티

@dependencies
- typing (List, Dict, Set, Optional, Any)
- enum (Enum)
- dataclasses (dataclass, field)
- datetime (datetime)
- logging

@exports
- SubscriptionLevel (Enum)
- LEVEL_FIELDS (Dict)
- SubscriptionFieldFilter (Class)
- ClientSubscriptionManager (Class)
- filter_equipment_data (Function)

📁 위치: backend/api/services/uds/subscription_field_filter.py
작성일: 2026-02-04
수정일: 2026-02-04
"""

from typing import List, Dict, Set, Optional, Any, Union
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


# =============================================================================
# 구독 레벨 정의
# =============================================================================

class SubscriptionLevel(str, Enum):
    """
    데이터 구독 레벨 정의
    
    프론트엔드 SubscriptionLevelManager와 동기화됨
    
    [데이터 크기 비교 (117개 설비 기준)]
    - MINIMAL:  ~20 bytes/equipment = ~2.3KB 전체
    - STANDARD: ~50 bytes/equipment = ~5.9KB 전체
    - DETAILED: ~500 bytes/equipment = ~58.5KB 전체
    
    [사용 케이스]
    - MINIMAL:  3D View 기본, Panel 닫힘, Dashboard
    - STANDARD: Ranking View, Multi-Select
    - DETAILED: Equipment Detail Info Panel
    """
    MINIMAL = "MINIMAL"
    STANDARD = "STANDARD"
    DETAILED = "DETAILED"


# =============================================================================
# 레벨별 필드 정의
# =============================================================================

LEVEL_FIELDS: Dict[SubscriptionLevel, Set[str]] = {
    # -------------------------------------------------------------------------
    # MINIMAL: 3D 뷰 기본 상태 표시용 (최소 필드)
    # -------------------------------------------------------------------------
    # - 신호등 색상만 표시하면 되므로 status + 변경 시각만 필요
    # - 예상 크기: ~20 bytes/equipment
    SubscriptionLevel.MINIMAL: {
        "frontend_id",       # 필수: 설비 식별
        "status",            # 필수: RUN/IDLE/STOP 상태
        "status_changed_at", # 변경 시각 (변경 감지용)
    },
    
    # -------------------------------------------------------------------------
    # STANDARD: Ranking View / Dashboard Summary용
    # -------------------------------------------------------------------------
    # - MINIMAL + PC 리소스 (CPU/Memory)
    # - 예상 크기: ~50 bytes/equipment
    SubscriptionLevel.STANDARD: {
        "frontend_id",
        "status",
        "status_changed_at",
        # PC 리소스 (간략)
        "cpu_usage_percent",
        "memory_usage_percent",
        # 생산 요약
        "production_count",
        "tact_time_seconds",
    },
    
    # -------------------------------------------------------------------------
    # DETAILED: Equipment Detail Info Panel용 (전체 필드)
    # -------------------------------------------------------------------------
    # - 모든 필드 포함
    # - 예상 크기: ~500 bytes/equipment
    SubscriptionLevel.DETAILED: {
        # 기본 식별
        "equipment_id",
        "frontend_id",
        "equipment_name",
        "line_name",
        # 상태
        "status",
        "status_changed_at",
        # 알람
        "alarm_code",
        "alarm_message",
        "alarm_repeat_count",
        # 생산 정보
        "product_model",
        "lot_id",
        "lot_start_time",
        "target_count",
        "production_count",
        "tact_time_seconds",
        # PC 리소스
        "cpu_usage_percent",
        "memory_usage_percent",
        "disk_usage_percent",
        # PC 정적 정보
        "cpu_name",
        "cpu_logical_count",
        "gpu_name",
        "os_name",
        "os_architecture",
        "last_boot_time",
        # 그리드 위치
        "grid_row",
        "grid_col",
        # 히스토리
        "state_history",
    },
}


# =============================================================================
# 클라이언트 구독 상태
# =============================================================================

@dataclass
class ClientSubscription:
    """
    개별 클라이언트의 구독 상태
    
    Attributes:
        client_id: 클라이언트 고유 ID (WebSocket connection_id)
        all_level: 전체 설비에 적용되는 구독 레벨
        selected_level: 선택된 설비에만 적용되는 구독 레벨
        selected_ids: 선택된 설비 frontend_id 목록
        created_at: 구독 생성 시각
        updated_at: 마지막 업데이트 시각
    """
    client_id: str
    all_level: SubscriptionLevel = SubscriptionLevel.MINIMAL
    selected_level: Optional[SubscriptionLevel] = None
    selected_ids: Set[str] = field(default_factory=set)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    def update(
        self,
        all_level: Optional[SubscriptionLevel] = None,
        selected_level: Optional[SubscriptionLevel] = None,
        selected_ids: Optional[Set[str]] = None
    ):
        """구독 상태 업데이트"""
        if all_level is not None:
            self.all_level = all_level
        if selected_level is not None:
            self.selected_level = selected_level
        if selected_ids is not None:
            self.selected_ids = selected_ids
        self.updated_at = datetime.utcnow()
    
    def get_level_for_equipment(self, frontend_id: str) -> SubscriptionLevel:
        """
        특정 설비에 적용할 구독 레벨 반환
        
        Args:
            frontend_id: 설비 ID
            
        Returns:
            적용할 SubscriptionLevel
        """
        # 선택된 설비이고 selected_level이 설정된 경우
        if frontend_id in self.selected_ids and self.selected_level:
            return self.selected_level
        return self.all_level
    
    def to_dict(self) -> Dict[str, Any]:
        """JSON 직렬화용 딕셔너리"""
        return {
            "client_id": self.client_id,
            "all_level": self.all_level.value,
            "selected_level": self.selected_level.value if self.selected_level else None,
            "selected_ids": list(self.selected_ids),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# =============================================================================
# 클라이언트 구독 관리자
# =============================================================================

class ClientSubscriptionManager:
    """
    클라이언트별 구독 상태 관리자
    
    [역할]
    - 클라이언트별 구독 상태 저장/조회
    - subscription_change 메시지 처리
    - 클라이언트별 맞춤 데이터 필터링
    
    [사용 예시]
    ```python
    manager = ClientSubscriptionManager()
    
    # 클라이언트 등록
    manager.register("client_123")
    
    # 구독 변경 처리
    manager.handle_subscription_change("client_123", {
        "all_level": "MINIMAL",
        "selected_level": "DETAILED",
        "selected_ids": ["EQ-17-03"]
    })
    
    # 필터링된 데이터 생성
    filtered = manager.filter_for_client("client_123", equipment_data_list)
    ```
    """
    
    def __init__(self):
        """관리자 초기화"""
        # client_id → ClientSubscription
        self._subscriptions: Dict[str, ClientSubscription] = {}
        
        # 통계
        self._stats = {
            "total_registered": 0,
            "total_unregistered": 0,
            "subscription_changes": 0,
        }
        
        logger.info("🔌 ClientSubscriptionManager initialized")
    
    # =========================================================================
    # 클라이언트 등록/해제
    # =========================================================================
    
    def register(self, client_id: str) -> ClientSubscription:
        """
        새 클라이언트 등록
        
        Args:
            client_id: 클라이언트 고유 ID
            
        Returns:
            생성된 ClientSubscription
        """
        if client_id in self._subscriptions:
            logger.debug(f"🔄 Client already registered: {client_id}")
            return self._subscriptions[client_id]
        
        subscription = ClientSubscription(client_id=client_id)
        self._subscriptions[client_id] = subscription
        self._stats["total_registered"] += 1
        
        logger.info(f"➕ Client registered: {client_id}")
        return subscription
    
    def unregister(self, client_id: str) -> bool:
        """
        클라이언트 등록 해제
        
        Args:
            client_id: 클라이언트 고유 ID
            
        Returns:
            해제 성공 여부
        """
        if client_id not in self._subscriptions:
            logger.debug(f"⚠️ Client not found: {client_id}")
            return False
        
        del self._subscriptions[client_id]
        self._stats["total_unregistered"] += 1
        
        logger.info(f"➖ Client unregistered: {client_id}")
        return True
    
    def get(self, client_id: str) -> Optional[ClientSubscription]:
        """클라이언트 구독 상태 조회"""
        return self._subscriptions.get(client_id)
    
    # =========================================================================
    # 구독 변경 처리
    # =========================================================================
    
    def handle_subscription_change(
        self,
        client_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """
        subscription_change 메시지 처리
        
        [메시지 형식]
        ```json
        {
            "type": "subscription_change",
            "all_level": "MINIMAL",
            "selected_level": "DETAILED",
            "selected_ids": ["EQ-17-03", "EQ-18-04"]
        }
        ```
        
        Args:
            client_id: 클라이언트 ID
            message: 구독 변경 메시지
            
        Returns:
            처리 성공 여부
        """
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            # 미등록 클라이언트면 자동 등록
            subscription = self.register(client_id)
        
        try:
            # all_level 파싱
            all_level = None
            if "all_level" in message:
                all_level_str = message["all_level"]
                if all_level_str:
                    all_level = SubscriptionLevel(all_level_str)
            
            # selected_level 파싱
            selected_level = None
            if "selected_level" in message:
                selected_level_str = message["selected_level"]
                if selected_level_str:
                    selected_level = SubscriptionLevel(selected_level_str)
            
            # selected_ids 파싱
            selected_ids = None
            if "selected_ids" in message:
                selected_ids = set(message["selected_ids"] or [])
            
            # 업데이트
            subscription.update(
                all_level=all_level,
                selected_level=selected_level,
                selected_ids=selected_ids
            )
            
            self._stats["subscription_changes"] += 1
            
            logger.info(
                f"📊 Subscription changed: {client_id} → "
                f"all={subscription.all_level.value}, "
                f"selected={subscription.selected_level.value if subscription.selected_level else None}, "
                f"ids={len(subscription.selected_ids)}"
            )
            
            return True
            
        except (ValueError, KeyError) as e:
            logger.error(f"❌ Invalid subscription message: {e}")
            return False
    
    # =========================================================================
    # 데이터 필터링
    # =========================================================================
    
    def filter_for_client(
        self,
        client_id: str,
        equipments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        클라이언트 구독 상태에 맞게 데이터 필터링
        
        Args:
            client_id: 클라이언트 ID
            equipments: 전체 설비 데이터 리스트
            
        Returns:
            필터링된 설비 데이터 리스트
        """
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            # 구독 없으면 MINIMAL 레벨 적용
            return filter_equipment_list(equipments, SubscriptionLevel.MINIMAL)
        
        result = []
        for eq in equipments:
            frontend_id = eq.get("frontend_id")
            level = subscription.get_level_for_equipment(frontend_id)
            filtered = filter_equipment_data(eq, level)
            result.append(filtered)
        
        return result
    
    def get_filter_summary(self, client_id: str) -> Dict[str, Any]:
        """
        클라이언트별 필터링 요약 정보
        
        Returns:
            {
                "all_level": "MINIMAL",
                "selected_level": "DETAILED",
                "selected_count": 1,
                "estimated_size_bytes": 2800
            }
        """
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            return {
                "all_level": "MINIMAL",
                "selected_level": None,
                "selected_count": 0,
                "estimated_size_bytes": 117 * 20  # MINIMAL: ~20 bytes/eq
            }
        
        # 예상 크기 계산
        all_count = 117 - len(subscription.selected_ids)
        selected_count = len(subscription.selected_ids)
        
        size_per_level = {
            SubscriptionLevel.MINIMAL: 20,
            SubscriptionLevel.STANDARD: 50,
            SubscriptionLevel.DETAILED: 500,
        }
        
        all_size = all_count * size_per_level.get(subscription.all_level, 20)
        selected_size = 0
        if subscription.selected_level:
            selected_size = selected_count * size_per_level.get(subscription.selected_level, 500)
        
        return {
            "all_level": subscription.all_level.value,
            "selected_level": subscription.selected_level.value if subscription.selected_level else None,
            "selected_count": selected_count,
            "estimated_size_bytes": all_size + selected_size,
        }
    
    # =========================================================================
    # 상태 조회
    # =========================================================================
    
    def get_all_clients(self) -> List[str]:
        """등록된 모든 클라이언트 ID 목록"""
        return list(self._subscriptions.keys())
    
    def get_client_count(self) -> int:
        """등록된 클라이언트 수"""
        return len(self._subscriptions)
    
    def get_stats(self) -> Dict[str, Any]:
        """통계 정보"""
        return {
            **self._stats,
            "current_clients": len(self._subscriptions),
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """전체 상태 JSON 직렬화"""
        return {
            "clients": {
                client_id: sub.to_dict()
                for client_id, sub in self._subscriptions.items()
            },
            "stats": self.get_stats(),
        }


# =============================================================================
# 필드 필터링 유틸리티
# =============================================================================

class SubscriptionFieldFilter:
    """
    구독 레벨별 필드 필터링 유틸리티 클래스
    
    [사용 예시]
    ```python
    filter = SubscriptionFieldFilter()
    
    # 단일 데이터 필터링
    minimal = filter.filter(equipment_dict, SubscriptionLevel.MINIMAL)
    
    # 리스트 필터링
    minimal_list = filter.filter_list(equipments, SubscriptionLevel.MINIMAL)
    
    # 레벨별 필드 목록 조회
    fields = filter.get_fields(SubscriptionLevel.STANDARD)
    ```
    """
    
    @staticmethod
    def get_fields(level: SubscriptionLevel) -> Set[str]:
        """
        레벨별 필드 목록 반환
        
        Args:
            level: 구독 레벨
            
        Returns:
            필드 이름 Set
        """
        return LEVEL_FIELDS.get(level, LEVEL_FIELDS[SubscriptionLevel.MINIMAL])
    
    @staticmethod
    def filter(
        data: Dict[str, Any],
        level: SubscriptionLevel
    ) -> Dict[str, Any]:
        """
        단일 설비 데이터 필터링
        
        Args:
            data: 설비 데이터 딕셔너리
            level: 구독 레벨
            
        Returns:
            필터링된 딕셔너리
        """
        fields = LEVEL_FIELDS.get(level, LEVEL_FIELDS[SubscriptionLevel.MINIMAL])
        return {k: v for k, v in data.items() if k in fields}
    
    @staticmethod
    def filter_list(
        data_list: List[Dict[str, Any]],
        level: SubscriptionLevel
    ) -> List[Dict[str, Any]]:
        """
        설비 데이터 리스트 필터링
        
        Args:
            data_list: 설비 데이터 리스트
            level: 구독 레벨
            
        Returns:
            필터링된 리스트
        """
        fields = LEVEL_FIELDS.get(level, LEVEL_FIELDS[SubscriptionLevel.MINIMAL])
        return [{k: v for k, v in data.items() if k in fields} for data in data_list]
    
    @staticmethod
    def estimate_size(level: SubscriptionLevel, equipment_count: int = 117) -> int:
        """
        예상 데이터 크기 계산 (bytes)
        
        Args:
            level: 구독 레벨
            equipment_count: 설비 수
            
        Returns:
            예상 바이트 수
        """
        size_per_equipment = {
            SubscriptionLevel.MINIMAL: 20,
            SubscriptionLevel.STANDARD: 50,
            SubscriptionLevel.DETAILED: 500,
        }
        return equipment_count * size_per_equipment.get(level, 20)


# =============================================================================
# 편의 함수 (모듈 레벨)
# =============================================================================

def filter_equipment_data(
    data: Dict[str, Any],
    level: Union[SubscriptionLevel, str]
) -> Dict[str, Any]:
    """
    단일 설비 데이터 필터링 (모듈 레벨 편의 함수)
    
    Args:
        data: 설비 데이터 딕셔너리
        level: 구독 레벨 (Enum 또는 문자열)
        
    Returns:
        필터링된 딕셔너리
        
    Example:
        >>> from subscription_field_filter import filter_equipment_data
        >>> minimal = filter_equipment_data(equipment, "MINIMAL")
        >>> # {'frontend_id': 'EQ-17-03', 'status': 'RUN', 'status_changed_at': ...}
    """
    if isinstance(level, str):
        level = SubscriptionLevel(level)
    
    return SubscriptionFieldFilter.filter(data, level)


def filter_equipment_list(
    data_list: List[Dict[str, Any]],
    level: Union[SubscriptionLevel, str]
) -> List[Dict[str, Any]]:
    """
    설비 데이터 리스트 필터링 (모듈 레벨 편의 함수)
    
    Args:
        data_list: 설비 데이터 리스트
        level: 구독 레벨 (Enum 또는 문자열)
        
    Returns:
        필터링된 리스트
    """
    if isinstance(level, str):
        level = SubscriptionLevel(level)
    
    return SubscriptionFieldFilter.filter_list(data_list, level)


def get_subscription_fields(level: Union[SubscriptionLevel, str]) -> Set[str]:
    """
    레벨별 필드 목록 조회 (모듈 레벨 편의 함수)
    
    Args:
        level: 구독 레벨 (Enum 또는 문자열)
        
    Returns:
        필드 이름 Set
    """
    if isinstance(level, str):
        level = SubscriptionLevel(level)
    
    return SubscriptionFieldFilter.get_fields(level)


# =============================================================================
# 싱글톤 인스턴스
# =============================================================================

# 앱 전역에서 동일 인스턴스 사용
subscription_manager = ClientSubscriptionManager()


# =============================================================================
# 테스트용 메인
# =============================================================================

if __name__ == "__main__":
    # 테스트 데이터
    test_equipment = {
        "equipment_id": 1,
        "frontend_id": "EQ-17-03",
        "equipment_name": "CVDF-001",
        "line_name": "Line A",
        "status": "RUN",
        "status_changed_at": "2026-02-04T10:00:00Z",
        "alarm_code": None,
        "alarm_message": None,
        "alarm_repeat_count": 0,
        "product_model": "MODEL-A",
        "lot_id": "LOT-001",
        "lot_start_time": "2026-02-04T08:00:00Z",
        "target_count": 1000,
        "production_count": 500,
        "tact_time_seconds": 12.5,
        "cpu_usage_percent": 45.2,
        "memory_usage_percent": 62.8,
        "disk_usage_percent": 35.0,
        "cpu_name": "Intel i7",
        "cpu_logical_count": 8,
        "gpu_name": "NVIDIA GTX 1080",
        "os_name": "Windows 10",
        "os_architecture": "64bit",
        "last_boot_time": "2026-02-01T00:00:00Z",
        "grid_row": 17,
        "grid_col": 3,
        "state_history": [],
    }
    
    print("=" * 60)
    print("구독 레벨별 필드 필터링 테스트")
    print("=" * 60)
    
    for level in SubscriptionLevel:
        filtered = filter_equipment_data(test_equipment, level)
        print(f"\n[{level.value}] 필드 수: {len(filtered)}")
        print(f"  필드: {list(filtered.keys())}")
        print(f"  예상 크기: {SubscriptionFieldFilter.estimate_size(level, 1)} bytes/eq")
    
    print("\n" + "=" * 60)
    print("ClientSubscriptionManager 테스트")
    print("=" * 60)
    
    manager = ClientSubscriptionManager()
    
    # 클라이언트 등록
    manager.register("client_001")
    
    # 구독 변경
    manager.handle_subscription_change("client_001", {
        "type": "subscription_change",
        "all_level": "MINIMAL",
        "selected_level": "DETAILED",
        "selected_ids": ["EQ-17-03"]
    })
    
    # 필터링 요약
    summary = manager.get_filter_summary("client_001")
    print(f"\n필터링 요약: {json.dumps(summary, indent=2)}")
    
    print("\n✅ 테스트 완료")