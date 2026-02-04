"""
subscription_field_filter.py
============================
Backend 구독 레벨별 필드 필터링 모듈

@version 2.0.0
@description
- MINIMAL/STANDARD/DETAILED 레벨별 필드 정의
- 설비 데이터 필터링 유틸리티
- 클라이언트별 구독 상태 관리
- WebSocket broadcast 시 클라이언트별 맞춤 데이터 전송
- 🆕 v2.0.0: Multi-Site 개별 구독 관리

@changelog
- v2.0.0 (2026-02-04): Multi-Site 개별 구독 관리
          - SiteSubscription 데이터클래스 추가
          - ClientSubscription에 site_subscriptions 필드 추가
          - Site별 구독 레벨 개별 설정 지원
          - handle_site_subscription_change() 메서드 추가
          - filter_for_site() 메서드 추가
          - 하위 호환성 100% 유지 (기존 API 그대로 사용 가능)
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
- SiteSubscription (Class) 🆕 v2.0.0
- ClientSubscription (Class)
- SubscriptionFieldFilter (Class)
- ClientSubscriptionManager (Class)
- filter_equipment_data (Function)
- filter_equipment_list (Function)

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
    SubscriptionLevel.MINIMAL: {
        "frontend_id",
        "status",
        "status_changed_at",
    },
    
    # -------------------------------------------------------------------------
    # STANDARD: Ranking View / Dashboard Summary용
    # -------------------------------------------------------------------------
    SubscriptionLevel.STANDARD: {
        "frontend_id",
        "status",
        "status_changed_at",
        "cpu_usage_percent",
        "memory_usage_percent",
        "production_count",
        "tact_time_seconds",
    },
    
    # -------------------------------------------------------------------------
    # DETAILED: Equipment Detail Info Panel용 (전체 필드)
    # -------------------------------------------------------------------------
    SubscriptionLevel.DETAILED: {
        "equipment_id",
        "frontend_id",
        "equipment_name",
        "line_name",
        "status",
        "status_changed_at",
        "alarm_code",
        "alarm_message",
        "alarm_repeat_count",
        "product_model",
        "lot_id",
        "lot_start_time",
        "target_count",
        "production_count",
        "tact_time_seconds",
        "cpu_usage_percent",
        "memory_usage_percent",
        "disk_usage_percent",
        "cpu_name",
        "cpu_logical_count",
        "gpu_name",
        "os_name",
        "os_architecture",
        "last_boot_time",
        "grid_row",
        "grid_col",
        "state_history",
    },
}


# =============================================================================
# 🆕 v2.0.0: Site별 구독 상태
# =============================================================================

@dataclass
class SiteSubscription:
    """
    🆕 v2.0.0: 개별 Site의 구독 상태
    
    Multi-Site 환경에서 각 Site별로 다른 구독 레벨 적용
    
    Attributes:
        site_id: Site 고유 ID (예: "korea_site1_line1")
        all_level: 해당 Site 전체 설비에 적용되는 구독 레벨
        selected_level: 해당 Site에서 선택된 설비에만 적용되는 구독 레벨
        selected_ids: 해당 Site에서 선택된 설비 frontend_id 목록
        is_active: 해당 Site 구독 활성화 여부 (False면 데이터 수신 안 함)
        updated_at: 마지막 업데이트 시각
        
    Example:
        ```python
        # Korea Site: DETAILED 레벨로 모든 설비 모니터링
        korea_sub = SiteSubscription(
            site_id="korea_site1_line1",
            all_level=SubscriptionLevel.DETAILED,
            is_active=True
        )
        
        # Vietnam Site: MINIMAL 레벨 (백그라운드 모니터링)
        vietnam_sub = SiteSubscription(
            site_id="vietnam_site1_line1",
            all_level=SubscriptionLevel.MINIMAL,
            is_active=True
        )
        
        # USA Site: 비활성화 (데이터 수신 안 함)
        usa_sub = SiteSubscription(
            site_id="usa_site1_line1",
            is_active=False
        )
        ```
    """
    site_id: str
    all_level: SubscriptionLevel = SubscriptionLevel.MINIMAL
    selected_level: Optional[SubscriptionLevel] = None
    selected_ids: Set[str] = field(default_factory=set)
    is_active: bool = True
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    def update(
        self,
        all_level: Optional[SubscriptionLevel] = None,
        selected_level: Optional[SubscriptionLevel] = None,
        selected_ids: Optional[Set[str]] = None,
        is_active: Optional[bool] = None
    ):
        """Site 구독 상태 업데이트"""
        if all_level is not None:
            self.all_level = all_level
        if selected_level is not None:
            self.selected_level = selected_level
        if selected_ids is not None:
            self.selected_ids = selected_ids
        if is_active is not None:
            self.is_active = is_active
        self.updated_at = datetime.utcnow()
    
    def get_level_for_equipment(self, frontend_id: str) -> SubscriptionLevel:
        """
        해당 Site에서 특정 설비에 적용할 구독 레벨 반환
        
        Args:
            frontend_id: 설비 ID
            
        Returns:
            적용할 SubscriptionLevel
        """
        if frontend_id in self.selected_ids and self.selected_level:
            return self.selected_level
        return self.all_level
    
    def to_dict(self) -> Dict[str, Any]:
        """JSON 직렬화용 딕셔너리"""
        return {
            "site_id": self.site_id,
            "all_level": self.all_level.value,
            "selected_level": self.selected_level.value if self.selected_level else None,
            "selected_ids": list(self.selected_ids),
            "is_active": self.is_active,
            "updated_at": self.updated_at.isoformat(),
        }


# =============================================================================
# 클라이언트 구독 상태 (v2.0.0 확장)
# =============================================================================

@dataclass
class ClientSubscription:
    """
    개별 클라이언트의 구독 상태
    
    🆕 v2.0.0: Multi-Site 지원 추가
    
    Attributes:
        client_id: 클라이언트 고유 ID (WebSocket connection_id)
        all_level: 전체 설비에 적용되는 기본 구독 레벨 (하위 호환)
        selected_level: 선택된 설비에만 적용되는 구독 레벨 (하위 호환)
        selected_ids: 선택된 설비 frontend_id 목록 (하위 호환)
        site_subscriptions: 🆕 v2.0.0 - Site별 개별 구독 설정
        active_site_id: 🆕 v2.0.0 - 현재 활성화된 Site ID
        created_at: 구독 생성 시각
        updated_at: 마지막 업데이트 시각
        
    [하위 호환성]
    - 기존 single-site 방식: all_level, selected_level, selected_ids 사용
    - 새로운 multi-site 방식: site_subscriptions 사용
    - 두 방식 모두 동시에 사용 가능
    """
    client_id: str
    # 하위 호환: 기본 구독 레벨 (single-site 또는 기본값)
    all_level: SubscriptionLevel = SubscriptionLevel.MINIMAL
    selected_level: Optional[SubscriptionLevel] = None
    selected_ids: Set[str] = field(default_factory=set)
    # 🆕 v2.0.0: Multi-Site 구독
    site_subscriptions: Dict[str, SiteSubscription] = field(default_factory=dict)
    active_site_id: Optional[str] = None
    # 메타데이터
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    def update(
        self,
        all_level: Optional[SubscriptionLevel] = None,
        selected_level: Optional[SubscriptionLevel] = None,
        selected_ids: Optional[Set[str]] = None
    ):
        """기본 구독 상태 업데이트 (하위 호환)"""
        if all_level is not None:
            self.all_level = all_level
        if selected_level is not None:
            self.selected_level = selected_level
        if selected_ids is not None:
            self.selected_ids = selected_ids
        self.updated_at = datetime.utcnow()
    
    # =========================================================================
    # 🆕 v2.0.0: Multi-Site 메서드
    # =========================================================================
    
    def set_site_subscription(
        self,
        site_id: str,
        all_level: SubscriptionLevel = SubscriptionLevel.MINIMAL,
        selected_level: Optional[SubscriptionLevel] = None,
        selected_ids: Optional[Set[str]] = None,
        is_active: bool = True
    ) -> SiteSubscription:
        """
        🆕 v2.0.0: Site별 구독 설정
        
        Args:
            site_id: Site ID
            all_level: 해당 Site 기본 구독 레벨
            selected_level: 선택 설비 구독 레벨
            selected_ids: 선택된 설비 ID 목록
            is_active: 활성화 여부
            
        Returns:
            생성/업데이트된 SiteSubscription
        """
        if site_id in self.site_subscriptions:
            # 기존 구독 업데이트
            site_sub = self.site_subscriptions[site_id]
            site_sub.update(
                all_level=all_level,
                selected_level=selected_level,
                selected_ids=selected_ids,
                is_active=is_active
            )
        else:
            # 새 구독 생성
            site_sub = SiteSubscription(
                site_id=site_id,
                all_level=all_level,
                selected_level=selected_level,
                selected_ids=selected_ids or set(),
                is_active=is_active
            )
            self.site_subscriptions[site_id] = site_sub
        
        self.updated_at = datetime.utcnow()
        return site_sub
    
    def get_site_subscription(self, site_id: str) -> Optional[SiteSubscription]:
        """🆕 v2.0.0: Site별 구독 조회"""
        return self.site_subscriptions.get(site_id)
    
    def remove_site_subscription(self, site_id: str) -> bool:
        """🆕 v2.0.0: Site 구독 제거"""
        if site_id in self.site_subscriptions:
            del self.site_subscriptions[site_id]
            self.updated_at = datetime.utcnow()
            return True
        return False
    
    def set_active_site(self, site_id: str) -> bool:
        """
        🆕 v2.0.0: 활성 Site 변경
        
        활성 Site의 구독 설정이 기본 all_level로 동기화됨
        """
        if site_id in self.site_subscriptions:
            self.active_site_id = site_id
            # 활성 Site의 레벨을 기본 레벨로 동기화
            site_sub = self.site_subscriptions[site_id]
            self.all_level = site_sub.all_level
            self.selected_level = site_sub.selected_level
            self.selected_ids = site_sub.selected_ids.copy()
            self.updated_at = datetime.utcnow()
            return True
        return False
    
    def get_active_sites(self) -> List[str]:
        """🆕 v2.0.0: 활성화된 모든 Site ID 목록"""
        return [
            site_id for site_id, sub in self.site_subscriptions.items()
            if sub.is_active
        ]
    
    def deactivate_site(self, site_id: str) -> bool:
        """🆕 v2.0.0: Site 비활성화 (구독은 유지하되 데이터 수신 중단)"""
        if site_id in self.site_subscriptions:
            self.site_subscriptions[site_id].is_active = False
            self.updated_at = datetime.utcnow()
            return True
        return False
    
    def activate_site(self, site_id: str) -> bool:
        """🆕 v2.0.0: Site 활성화 (데이터 수신 재개)"""
        if site_id in self.site_subscriptions:
            self.site_subscriptions[site_id].is_active = True
            self.updated_at = datetime.utcnow()
            return True
        return False
    
    # =========================================================================
    # 레벨 조회
    # =========================================================================
    
    def get_level_for_equipment(
        self, 
        frontend_id: str,
        site_id: Optional[str] = None
    ) -> SubscriptionLevel:
        """
        특정 설비에 적용할 구독 레벨 반환
        
        🆕 v2.0.0: site_id 파라미터 추가
        
        Args:
            frontend_id: 설비 ID
            site_id: Site ID (None이면 기본 구독 사용)
            
        Returns:
            적용할 SubscriptionLevel
        """
        # Site별 구독 확인
        if site_id and site_id in self.site_subscriptions:
            site_sub = self.site_subscriptions[site_id]
            if site_sub.is_active:
                return site_sub.get_level_for_equipment(frontend_id)
        
        # 기본 구독 사용 (하위 호환)
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
            # 🆕 v2.0.0
            "site_subscriptions": {
                site_id: sub.to_dict()
                for site_id, sub in self.site_subscriptions.items()
            },
            "active_site_id": self.active_site_id,
            "active_sites": self.get_active_sites(),
            # 메타
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# =============================================================================
# 클라이언트 구독 관리자 (v2.0.0 확장)
# =============================================================================

class ClientSubscriptionManager:
    """
    클라이언트별 구독 상태 관리자
    
    🆕 v2.0.0: Multi-Site 지원 추가
    
    [역할]
    - 클라이언트별 구독 상태 저장/조회
    - subscription_change 메시지 처리
    - 🆕 site_subscription_change 메시지 처리
    - 클라이언트별 맞춤 데이터 필터링
    - 🆕 Site별 맞춤 데이터 필터링
    
    [사용 예시]
    ```python
    manager = ClientSubscriptionManager()
    
    # 클라이언트 등록
    manager.register("client_123")
    
    # 기존 방식 (single-site, 하위 호환)
    manager.handle_subscription_change("client_123", {
        "all_level": "MINIMAL",
        "selected_level": "DETAILED",
        "selected_ids": ["EQ-17-03"]
    })
    
    # 🆕 v2.0.0: Multi-Site 구독 설정
    manager.handle_site_subscription_change("client_123", {
        "site_id": "korea_site1_line1",
        "all_level": "DETAILED",
        "is_active": True
    })
    
    manager.handle_site_subscription_change("client_123", {
        "site_id": "vietnam_site1_line1",
        "all_level": "MINIMAL",
        "is_active": True
    })
    
    # Site별 필터링
    korea_data = manager.filter_for_site("client_123", "korea_site1_line1", equipments)
    vietnam_data = manager.filter_for_site("client_123", "vietnam_site1_line1", equipments)
    ```
    """
    
    def __init__(self):
        """관리자 초기화"""
        self._subscriptions: Dict[str, ClientSubscription] = {}
        
        self._stats = {
            "total_registered": 0,
            "total_unregistered": 0,
            "subscription_changes": 0,
            "site_subscription_changes": 0,  # 🆕 v2.0.0
        }
        
        logger.info("🔌 ClientSubscriptionManager initialized (v2.0.0 - Multi-Site)")
    
    # =========================================================================
    # 클라이언트 등록/해제
    # =========================================================================
    
    def register(self, client_id: str) -> ClientSubscription:
        """새 클라이언트 등록"""
        if client_id in self._subscriptions:
            logger.debug(f"🔄 Client already registered: {client_id}")
            return self._subscriptions[client_id]
        
        subscription = ClientSubscription(client_id=client_id)
        self._subscriptions[client_id] = subscription
        self._stats["total_registered"] += 1
        
        logger.info(f"➕ Client registered: {client_id}")
        return subscription
    
    def unregister(self, client_id: str) -> bool:
        """클라이언트 등록 해제"""
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
    # 구독 변경 처리 (하위 호환)
    # =========================================================================
    
    def handle_subscription_change(
        self,
        client_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """
        subscription_change 메시지 처리 (하위 호환)
        
        [메시지 형식]
        ```json
        {
            "type": "subscription_change",
            "all_level": "MINIMAL",
            "selected_level": "DETAILED",
            "selected_ids": ["EQ-17-03", "EQ-18-04"]
        }
        ```
        """
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            subscription = self.register(client_id)
        
        try:
            all_level = None
            if "all_level" in message:
                all_level_str = message["all_level"]
                if all_level_str:
                    all_level = SubscriptionLevel(all_level_str)
            
            selected_level = None
            if "selected_level" in message:
                selected_level_str = message["selected_level"]
                if selected_level_str:
                    selected_level = SubscriptionLevel(selected_level_str)
            
            selected_ids = None
            if "selected_ids" in message:
                selected_ids = set(message["selected_ids"] or [])
            
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
    # 🆕 v2.0.0: Site별 구독 변경 처리
    # =========================================================================
    
    def handle_site_subscription_change(
        self,
        client_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """
        🆕 v2.0.0: site_subscription_change 메시지 처리
        
        [메시지 형식]
        ```json
        {
            "type": "site_subscription_change",
            "site_id": "korea_site1_line1",
            "all_level": "DETAILED",
            "selected_level": "DETAILED",
            "selected_ids": ["EQ-17-03"],
            "is_active": true
        }
        ```
        
        Args:
            client_id: 클라이언트 ID
            message: Site 구독 변경 메시지
            
        Returns:
            처리 성공 여부
        """
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            subscription = self.register(client_id)
        
        try:
            site_id = message.get("site_id")
            if not site_id:
                logger.error("❌ site_id is required for site_subscription_change")
                return False
            
            # 레벨 파싱
            all_level = SubscriptionLevel.MINIMAL
            if "all_level" in message and message["all_level"]:
                all_level = SubscriptionLevel(message["all_level"])
            
            selected_level = None
            if "selected_level" in message and message["selected_level"]:
                selected_level = SubscriptionLevel(message["selected_level"])
            
            selected_ids = set(message.get("selected_ids") or [])
            is_active = message.get("is_active", True)
            
            # Site 구독 설정
            site_sub = subscription.set_site_subscription(
                site_id=site_id,
                all_level=all_level,
                selected_level=selected_level,
                selected_ids=selected_ids,
                is_active=is_active
            )
            
            self._stats["site_subscription_changes"] += 1
            
            logger.info(
                f"🌐 Site subscription changed: {client_id}/{site_id} → "
                f"all={site_sub.all_level.value}, "
                f"selected={site_sub.selected_level.value if site_sub.selected_level else None}, "
                f"active={site_sub.is_active}"
            )
            
            return True
            
        except (ValueError, KeyError) as e:
            logger.error(f"❌ Invalid site subscription message: {e}")
            return False
    
    def handle_batch_site_subscription_change(
        self,
        client_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """
        🆕 v2.0.0: 여러 Site 구독을 한 번에 설정
        
        [메시지 형식]
        ```json
        {
            "type": "batch_site_subscription_change",
            "sites": [
                {"site_id": "korea_site1_line1", "all_level": "DETAILED", "is_active": true},
                {"site_id": "vietnam_site1_line1", "all_level": "MINIMAL", "is_active": true},
                {"site_id": "usa_site1_line1", "is_active": false}
            ]
        }
        ```
        """
        sites = message.get("sites", [])
        
        if not sites:
            logger.warning("⚠️ Empty sites array in batch_site_subscription_change")
            return False
        
        success_count = 0
        for site_config in sites:
            if self.handle_site_subscription_change(client_id, site_config):
                success_count += 1
        
        logger.info(
            f"🌐 Batch site subscription: {client_id} → "
            f"{success_count}/{len(sites)} sites configured"
        )
        
        return success_count > 0
    
    def set_active_site(self, client_id: str, site_id: str) -> bool:
        """🆕 v2.0.0: 클라이언트의 활성 Site 변경"""
        subscription = self._subscriptions.get(client_id)
        if not subscription:
            return False
        
        return subscription.set_active_site(site_id)
    
    # =========================================================================
    # 데이터 필터링
    # =========================================================================
    
    def filter_for_client(
        self,
        client_id: str,
        equipments: List[Dict[str, Any]],
        site_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        클라이언트 구독 상태에 맞게 데이터 필터링
        
        🆕 v2.0.0: site_id 파라미터 추가
        
        Args:
            client_id: 클라이언트 ID
            equipments: 전체 설비 데이터 리스트
            site_id: Site ID (None이면 기본 구독 사용)
            
        Returns:
            필터링된 설비 데이터 리스트
        """
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            return filter_equipment_list(equipments, SubscriptionLevel.MINIMAL)
        
        # Site별 구독 확인
        if site_id and site_id in subscription.site_subscriptions:
            site_sub = subscription.site_subscriptions[site_id]
            
            if not site_sub.is_active:
                # 비활성 Site는 빈 리스트 반환
                return []
            
            result = []
            for eq in equipments:
                frontend_id = eq.get("frontend_id")
                level = site_sub.get_level_for_equipment(frontend_id)
                filtered = filter_equipment_data(eq, level)
                result.append(filtered)
            return result
        
        # 기본 구독 사용 (하위 호환)
        result = []
        for eq in equipments:
            frontend_id = eq.get("frontend_id")
            level = subscription.get_level_for_equipment(frontend_id)
            filtered = filter_equipment_data(eq, level)
            result.append(filtered)
        
        return result
    
    def filter_for_site(
        self,
        client_id: str,
        site_id: str,
        equipments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        🆕 v2.0.0: Site별 필터링 편의 메서드
        
        Args:
            client_id: 클라이언트 ID
            site_id: Site ID
            equipments: 설비 데이터 리스트
            
        Returns:
            필터링된 설비 데이터 리스트 (비활성 Site면 빈 리스트)
        """
        return self.filter_for_client(client_id, equipments, site_id)
    
    def filter_all_sites(
        self,
        client_id: str,
        site_equipments: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        🆕 v2.0.0: 모든 Site 데이터 일괄 필터링
        
        Args:
            client_id: 클라이언트 ID
            site_equipments: {site_id: equipments} 형태의 딕셔너리
            
        Returns:
            {site_id: filtered_equipments} 형태의 딕셔너리
        """
        result = {}
        
        subscription = self._subscriptions.get(client_id)
        if not subscription:
            # 구독 없으면 모든 Site를 MINIMAL로 필터링
            for site_id, equipments in site_equipments.items():
                result[site_id] = filter_equipment_list(equipments, SubscriptionLevel.MINIMAL)
            return result
        
        for site_id, equipments in site_equipments.items():
            site_sub = subscription.site_subscriptions.get(site_id)
            
            if site_sub and not site_sub.is_active:
                # 비활성 Site는 빈 리스트
                result[site_id] = []
            else:
                result[site_id] = self.filter_for_client(client_id, equipments, site_id)
        
        return result
    
    # =========================================================================
    # 상태 조회
    # =========================================================================
    
    def get_filter_summary(
        self, 
        client_id: str,
        site_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        클라이언트별 필터링 요약 정보
        
        🆕 v2.0.0: site_id 파라미터 추가
        """
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            return {
                "all_level": "MINIMAL",
                "selected_level": None,
                "selected_count": 0,
                "estimated_size_bytes": 117 * 20,
                "site_id": site_id,
            }
        
        # Site별 요약
        if site_id and site_id in subscription.site_subscriptions:
            site_sub = subscription.site_subscriptions[site_id]
            
            if not site_sub.is_active:
                return {
                    "site_id": site_id,
                    "is_active": False,
                    "estimated_size_bytes": 0,
                }
            
            all_count = 117 - len(site_sub.selected_ids)
            selected_count = len(site_sub.selected_ids)
            
            size_per_level = {
                SubscriptionLevel.MINIMAL: 20,
                SubscriptionLevel.STANDARD: 50,
                SubscriptionLevel.DETAILED: 500,
            }
            
            all_size = all_count * size_per_level.get(site_sub.all_level, 20)
            selected_size = 0
            if site_sub.selected_level:
                selected_size = selected_count * size_per_level.get(site_sub.selected_level, 500)
            
            return {
                "site_id": site_id,
                "is_active": True,
                "all_level": site_sub.all_level.value,
                "selected_level": site_sub.selected_level.value if site_sub.selected_level else None,
                "selected_count": selected_count,
                "estimated_size_bytes": all_size + selected_size,
            }
        
        # 기본 요약 (하위 호환)
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
            "site_subscriptions_count": len(subscription.site_subscriptions),
            "active_sites": subscription.get_active_sites(),
        }
    
    def get_all_site_summaries(self, client_id: str) -> Dict[str, Dict[str, Any]]:
        """🆕 v2.0.0: 클라이언트의 모든 Site 구독 요약"""
        subscription = self._subscriptions.get(client_id)
        
        if not subscription:
            return {}
        
        return {
            site_id: self.get_filter_summary(client_id, site_id)
            for site_id in subscription.site_subscriptions.keys()
        }
    
    def get_all_clients(self) -> List[str]:
        """등록된 모든 클라이언트 ID 목록"""
        return list(self._subscriptions.keys())
    
    def get_client_count(self) -> int:
        """등록된 클라이언트 수"""
        return len(self._subscriptions)
    
    def get_stats(self) -> Dict[str, Any]:
        """통계 정보"""
        total_site_subs = sum(
            len(sub.site_subscriptions)
            for sub in self._subscriptions.values()
        )
        
        return {
            **self._stats,
            "current_clients": len(self._subscriptions),
            "total_site_subscriptions": total_site_subs,
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
    """구독 레벨별 필드 필터링 유틸리티 클래스"""
    
    @staticmethod
    def get_fields(level: SubscriptionLevel) -> Set[str]:
        """레벨별 필드 목록 반환"""
        return LEVEL_FIELDS.get(level, LEVEL_FIELDS[SubscriptionLevel.MINIMAL])
    
    @staticmethod
    def filter(
        data: Dict[str, Any],
        level: SubscriptionLevel
    ) -> Dict[str, Any]:
        """단일 설비 데이터 필터링"""
        fields = LEVEL_FIELDS.get(level, LEVEL_FIELDS[SubscriptionLevel.MINIMAL])
        return {k: v for k, v in data.items() if k in fields}
    
    @staticmethod
    def filter_list(
        data_list: List[Dict[str, Any]],
        level: SubscriptionLevel
    ) -> List[Dict[str, Any]]:
        """설비 데이터 리스트 필터링"""
        fields = LEVEL_FIELDS.get(level, LEVEL_FIELDS[SubscriptionLevel.MINIMAL])
        return [{k: v for k, v in data.items() if k in fields} for data in data_list]
    
    @staticmethod
    def estimate_size(level: SubscriptionLevel, equipment_count: int = 117) -> int:
        """예상 데이터 크기 계산 (bytes)"""
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
    """단일 설비 데이터 필터링"""
    if isinstance(level, str):
        level = SubscriptionLevel(level)
    return SubscriptionFieldFilter.filter(data, level)


def filter_equipment_list(
    data_list: List[Dict[str, Any]],
    level: Union[SubscriptionLevel, str]
) -> List[Dict[str, Any]]:
    """설비 데이터 리스트 필터링"""
    if isinstance(level, str):
        level = SubscriptionLevel(level)
    return SubscriptionFieldFilter.filter_list(data_list, level)


def get_subscription_fields(level: Union[SubscriptionLevel, str]) -> Set[str]:
    """레벨별 필드 목록 조회"""
    if isinstance(level, str):
        level = SubscriptionLevel(level)
    return SubscriptionFieldFilter.get_fields(level)


# =============================================================================
# 싱글톤 인스턴스
# =============================================================================

subscription_manager = ClientSubscriptionManager()


# =============================================================================
# 테스트용 메인
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("🆕 v2.0.0 Multi-Site 구독 관리 테스트")
    print("=" * 70)
    
    # 테스트 데이터
    test_equipment = {
        "equipment_id": 1,
        "frontend_id": "EQ-17-03",
        "equipment_name": "CVDF-001",
        "status": "RUN",
        "status_changed_at": "2026-02-04T10:00:00Z",
        "cpu_usage_percent": 45.2,
        "memory_usage_percent": 62.8,
        "production_count": 500,
        "tact_time_seconds": 12.5,
    }
    
    manager = ClientSubscriptionManager()
    
    # 클라이언트 등록
    print("\n[1] 클라이언트 등록")
    manager.register("client_001")
    
    # Multi-Site 구독 설정
    print("\n[2] Multi-Site 구독 설정")
    
    # Korea Site: DETAILED (주요 모니터링)
    manager.handle_site_subscription_change("client_001", {
        "site_id": "korea_site1_line1",
        "all_level": "DETAILED",
        "is_active": True
    })
    
    # Vietnam Site: STANDARD (보조 모니터링)
    manager.handle_site_subscription_change("client_001", {
        "site_id": "vietnam_site1_line1",
        "all_level": "STANDARD",
        "is_active": True
    })
    
    # USA Site: MINIMAL (백그라운드)
    manager.handle_site_subscription_change("client_001", {
        "site_id": "usa_site1_line1",
        "all_level": "MINIMAL",
        "is_active": False  # 비활성
    })
    
    # Site별 필터링 결과
    print("\n[3] Site별 필터링 결과")
    
    equipments = [test_equipment]
    
    korea_filtered = manager.filter_for_site("client_001", "korea_site1_line1", equipments)
    print(f"  Korea (DETAILED): {len(korea_filtered[0])} 필드")
    
    vietnam_filtered = manager.filter_for_site("client_001", "vietnam_site1_line1", equipments)
    print(f"  Vietnam (STANDARD): {len(vietnam_filtered[0])} 필드")
    
    usa_filtered = manager.filter_for_site("client_001", "usa_site1_line1", equipments)
    print(f"  USA (비활성): {len(usa_filtered)} 설비 (빈 리스트)")
    
    # 전체 Site 요약
    print("\n[4] 전체 Site 요약")
    summaries = manager.get_all_site_summaries("client_001")
    for site_id, summary in summaries.items():
        print(f"  {site_id}: {json.dumps(summary, indent=4)}")
    
    print("\n✅ Multi-Site 구독 관리 테스트 완료")