"""
equipment_detail 패키지
설비 상세 정보 API

@version 2.3.0
@changelog
- v2.3.0: 모듈 분리 리팩토링
  - router.py: API 엔드포인트
  - queries/: SQL 쿼리 함수
  - helpers/: 헬퍼 함수
  - ⚠️ 하위 호환성: 기존 import 경로 100% 유지

작성일: 2026-02-01
"""

# ============================================================================
# 하위 호환성을 위한 Export
# ============================================================================
# 
# 기존 코드에서 다음과 같이 import 했다면:
#   from backend.api.routers.equipment_detail import router
#   from backend.api.routers.equipment_detail import fetch_equipment_detail_raw
# 
# 분리 후에도 동일하게 작동합니다!
# ============================================================================

# Router (메인 export)
from .router import router

# 쿼리 함수들 (테스트 파일 호환성)
from .queries.single_equipment import fetch_equipment_detail_raw
from .queries.multi_equipment import fetch_multi_equipment_detail_raw
from .queries.production_tact import (
    fetch_production_count,
    fetch_tact_time,
    fetch_production_and_tact_batch
)

# 헬퍼 함수들
from .helpers.connection_helper import get_active_site_connection

# Export 목록
__all__ = [
    # Router
    'router',
    
    # Query Functions
    'fetch_equipment_detail_raw',
    'fetch_multi_equipment_detail_raw',
    'fetch_production_count',
    'fetch_tact_time',
    'fetch_production_and_tact_batch',
    
    # Helper Functions
    'get_active_site_connection'
]

# 버전 정보
__version__ = '2.3.0'