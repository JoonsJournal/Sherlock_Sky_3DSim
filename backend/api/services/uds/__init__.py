"""
backend/api/services/uds/__init__.py
UDS 서비스 패키지 초기화

@version 1.2.0
@changelog
- v1.2.0: StatusWatcher 추가
          - status_watcher.py에서 StatusWatcher, status_watcher 싱글톤 export
          - get_watcher_stats, is_watcher_running 헬퍼 함수 export
          - ⚠️ 호환성: 기존 모든 export 100% 유지
- v1.1.0: UDSService 추가
- v1.0.0: 초기 버전 (uds_queries만 export)

작성일: 2026-01-20
수정일: 2026-01-20
"""

# =============================================================================
# Status Watcher (Day 3 추가)
# =============================================================================
from .status_watcher import (
    StatusWatcher,
    status_watcher,
    get_watcher_stats,
    is_watcher_running,
)

# =============================================================================
# UDS Service (Day 2 추가)
# =============================================================================
from .uds_service import (
    UDSService,
    uds_service,
)

# =============================================================================
# UDS Queries (Day 1 - 기존 유지)
# =============================================================================
from .uds_queries import (
    # Batch Queries
    BATCH_EQUIPMENT_QUERY,
    BATCH_TACT_TIME_QUERY,
    
    # Single Queries
    SINGLE_EQUIPMENT_QUERY,
    TACT_TIME_QUERY,
    
    # Production Queries
    PRODUCTION_COUNT_QUERY,
    PRODUCTION_SNAPSHOT_QUERY,
    
    # Snapshot Queries
    STATUS_SNAPSHOT_QUERY,
    
    # Mapping Queries
    EQUIPMENT_MAPPING_QUERY,
    
    # Helper Functions
    build_in_clause_params,
    calculate_memory_usage_percent,
    calculate_disk_usage_percent,
)


__all__ = [
    # ===================
    # Status Watcher (Day 3 추가)
    # ===================
    'StatusWatcher',
    'status_watcher',
    'get_watcher_stats',
    'is_watcher_running',
    
    # ===================
    # Service (Day 2)
    # ===================
    'UDSService',
    'uds_service',
    
    # ===================
    # Queries (Day 1)
    # ===================
    # Batch Queries
    'BATCH_EQUIPMENT_QUERY',
    'BATCH_TACT_TIME_QUERY',
    
    # Single Queries
    'SINGLE_EQUIPMENT_QUERY',
    'TACT_TIME_QUERY',
    
    # Production Queries
    'PRODUCTION_COUNT_QUERY',
    'PRODUCTION_SNAPSHOT_QUERY',
    
    # Snapshot Queries
    'STATUS_SNAPSHOT_QUERY',
    
    # Mapping Queries
    'EQUIPMENT_MAPPING_QUERY',
    
    # Helper Functions
    'build_in_clause_params',
    'calculate_memory_usage_percent',
    'calculate_disk_usage_percent',
]