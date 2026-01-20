"""
backend/api/services/uds/__init__.py
UDS 서비스 패키지 초기화

@version 1.1.0
@changelog
- v1.1.0: UDSService 추가
          - uds_service.py에서 UDSService, uds_service 싱글톤 export
          - ⚠️ 호환성: 기존 uds_queries export 100% 유지
- v1.0.0: 초기 버전 (uds_queries만 export)

작성일: 2026-01-20
수정일: 2026-01-20
"""

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
    # Service (Day 2 추가)
    # ===================
    'UDSService',
    'uds_service',
    
    # ===================
    # Queries (기존 유지)
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