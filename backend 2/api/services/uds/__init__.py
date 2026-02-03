"""
backend/api/services/uds/__init__.py
UDS 서비스 패키지 초기화

@version 1.3.0
@changelog
- v1.3.0: 🔧 EQUIPMENT_MAPPING_QUERY 제거 및 v2.0.0 헬퍼 추가
          - ❌ EQUIPMENT_MAPPING_QUERY 제거 (uds_queries v2.0.0에서 삭제됨)
          - ✅ parse_frontend_id, generate_frontend_id 헬퍼 추가
          - ⚠️ 호환성: 기존 모든 export 유지 (삭제된 것 제외)
- v1.2.0: StatusWatcher 추가
          - status_watcher.py에서 StatusWatcher, status_watcher 싱글톤 export
          - get_watcher_stats, is_watcher_running 헬퍼 함수 export
- v1.1.0: UDSService 추가
- v1.0.0: 초기 버전 (uds_queries만 export)

작성일: 2026-01-20
수정일: 2026-01-21
"""

# =============================================================================
# Status Watcher (Day 3 추가)
# =============================================================================
from .status_watcher import (
    StatusWatcher,
    status_watcher,
    get_watcher_stats,
    is_watcher_running,
    refresh_watcher_mapping,  # 🆕 v2.0.0
)

# =============================================================================
# UDS Service (Day 2 추가)
# =============================================================================
from .uds_service import (
    UDSService,
    uds_service,
)

# =============================================================================
# UDS Queries (Day 1 - v1.3.0 업데이트)
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
    
    # ❌ EQUIPMENT_MAPPING_QUERY 제거됨 (v2.0.0)
    # 이유: core.EquipmentMapping 테이블이 DB에 존재하지 않음
    # 대안: config/site_mappings/equipment_mapping_{site_id}.json 파일 사용
    
    # Helper Functions
    build_in_clause_params,
    calculate_memory_usage_percent,
    calculate_disk_usage_percent,
    
    # 🆕 v2.0.0: FrontendId 헬퍼
    parse_frontend_id,
    generate_frontend_id,
)


__all__ = [
    # ===================
    # Status Watcher (Day 3 추가)
    # ===================
    'StatusWatcher',
    'status_watcher',
    'get_watcher_stats',
    'is_watcher_running',
    'refresh_watcher_mapping',  # 🆕 v2.0.0
    
    # ===================
    # Service (Day 2)
    # ===================
    'UDSService',
    'uds_service',
    
    # ===================
    # Queries (Day 1 - v1.3.0 업데이트)
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
    
    # ❌ 'EQUIPMENT_MAPPING_QUERY' 제거됨 (v2.0.0)
    
    # Helper Functions
    'build_in_clause_params',
    'calculate_memory_usage_percent',
    'calculate_disk_usage_percent',
    
    # 🆕 v2.0.0: FrontendId 헬퍼
    'parse_frontend_id',
    'generate_frontend_id',
]