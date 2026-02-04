"""
uds/__init__.py
===============
UDS 서비스 패키지 초기화

@version 2.4.0
@description
- UDS Service 클래스 및 싱글톤 노출
- UDS 쿼리 상수 노출
- Status Watcher 노출
- 🆕 v2.4.0: 구독 필드 필터링 모듈 추가

@changelog
- v2.4.0 (2026-02-04): SubscriptionFieldFilter 추가
          - SubscriptionLevel Enum
          - ClientSubscriptionManager
          - 필터링 유틸리티 함수
- v2.3.0 (2026-01-29): Graceful Degradation
- v2.2.0 (2026-01-21): 스키마 호환 수정
- v2.1.0 (2026-01-21): 실시간 Delta 업데이트
- v2.0.0 (2026-01-21): JSON 매핑 통합
- v1.0.0: 초기 버전

📁 위치: backend/api/services/uds/__init__.py
작성일: 2026-01-20
수정일: 2026-02-04
"""

# =============================================================================
# UDS Service
# =============================================================================
from .uds_service import (
    UDSService,
    uds_service,  # 싱글톤 인스턴스
)

# =============================================================================
# UDS Queries
# =============================================================================
from .uds_queries import (
    BATCH_EQUIPMENT_QUERY,
    SINGLE_EQUIPMENT_QUERY,
    PRODUCTION_COUNT_QUERY,
    PRODUCTION_SNAPSHOT_QUERY,
    BATCH_TACT_TIME_QUERY,
    STATUS_SNAPSHOT_QUERY,
    ALARM_REPEAT_COUNT_QUERY,
    STATE_HISTORY_QUERY,
    UNIFIED_INITIAL_QUERY,
    UNIFIED_DIFF_QUERY,
    calculate_memory_usage_percent,
    calculate_disk_usage_percent,
    parse_frontend_id,
    generate_frontend_id,
)

# =============================================================================
# Status Watcher
# =============================================================================
from .status_watcher import StatusWatcher

# =============================================================================
# 🆕 v2.4.0: Subscription Field Filter
# =============================================================================
from .subscription_field_filter import (
    # Enum
    SubscriptionLevel,
    
    # 상수
    LEVEL_FIELDS,
    
    # 클래스
    SubscriptionFieldFilter,
    ClientSubscriptionManager,
    ClientSubscription,
    
    # 싱글톤 인스턴스
    subscription_manager,
    
    # 유틸리티 함수
    filter_equipment_data,
    filter_equipment_list,
    get_subscription_fields,
)

# =============================================================================
# Public API
# =============================================================================
__all__ = [
    # UDS Service
    "UDSService",
    "uds_service",
    
    # Status Watcher
    "StatusWatcher",
    
    # Queries
    "BATCH_EQUIPMENT_QUERY",
    "SINGLE_EQUIPMENT_QUERY",
    "PRODUCTION_COUNT_QUERY",
    "PRODUCTION_SNAPSHOT_QUERY",
    "BATCH_TACT_TIME_QUERY",
    "STATUS_SNAPSHOT_QUERY",
    "ALARM_REPEAT_COUNT_QUERY",
    "STATE_HISTORY_QUERY",
    "UNIFIED_INITIAL_QUERY",
    "UNIFIED_DIFF_QUERY",
    
    # Query Utils
    "calculate_memory_usage_percent",
    "calculate_disk_usage_percent",
    "parse_frontend_id",
    "generate_frontend_id",
    
    # 🆕 Subscription Filter
    "SubscriptionLevel",
    "LEVEL_FIELDS",
    "SubscriptionFieldFilter",
    "ClientSubscriptionManager",
    "ClientSubscription",
    "subscription_manager",
    "filter_equipment_data",
    "filter_equipment_list",
    "get_subscription_fields",
]