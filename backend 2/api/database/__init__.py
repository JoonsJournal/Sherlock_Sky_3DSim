# backend/api/database/__init__.py
"""
Database connection management module

Unified interface for both development and production:
- connection_test: Development/Testing (databases.json based)
- multi_connection_manager: Production (multi-site settings based)
"""

import os
import logging

logger = logging.getLogger(__name__)

# ============================================
# 환경 변수로 Manager 선택
# ============================================
USE_MULTI_CONNECTION = os.getenv('USE_MULTI_CONNECTION', 'false').lower() == 'true'

if USE_MULTI_CONNECTION:
    # Production: Multi Connection Manager
    logger.info("🔧 Using MultiConnectionManager (Production)")
    
    from .multi_connection_manager import (
        MultiConnectionManager,
        connection_manager,
        get_db
    )
    
    __all__ = [
        'MultiConnectionManager',
        'connection_manager',
        'get_db',
    ]

else:
    # Development/Testing: Connection Test Manager
    logger.info("🔧 Using ConnectionTestManager (Development)")
    
    from .connection_test import (
        DatabaseConnectionManager,  # ✅ 올바른 클래스명
        get_connection_manager,
    )
    
    # Multi Connection Manager와 동일한 인터페이스 제공 (Alias)
    MultiConnectionManager = DatabaseConnectionManager  # ✅ 올바른 Alias
    connection_manager = get_connection_manager()
    
    # get_db는 connection_test에는 없으므로 더미 구현
    def get_db(site_id=None, db_name=None):
        """
        FastAPI dependency (개발 모드)
        
        Note: ConnectionTestManager는 세션 기반이 아니므로
        실제 세션이 필요한 경우 None 반환
        """
        # TODO: 필요시 connection_test.py에 세션 구현 추가
        yield None
    
    __all__ = [
        'MultiConnectionManager',       # Alias
        'DatabaseConnectionManager',    # 원본 클래스명도 export
        'connection_manager',
        'get_db',
        'get_connection_manager',       # 테스트용
    ]