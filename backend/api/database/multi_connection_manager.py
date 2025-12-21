# backend/api/database/multi_connection_manager.py
"""
선택적 다중 연결 관리자
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from typing import Dict, Optional, List
import logging

from ...config.multi_site_settings import get_multi_site_settings
from ...config.connection_selector import get_connection_selector

logger = logging.getLogger(__name__)


class MultiConnectionManager:
    """선택적 다중 데이터베이스 연결 관리자"""
    
    def __init__(self):
        self.settings = get_multi_site_settings()
        self.selector = get_connection_selector()
        
        # 엔진 캐시
        self._engines: Dict[str, Dict[str, any]] = {}
        self._session_factories: Dict[str, Dict[str, sessionmaker]] = {}
        
        # 초기화 시 활성 연결만 생성
        self._initialize_active_connections()
        
        logger.info("다중 연결 관리자 초기화 (선택적 연결)")
    
    def _initialize_active_connections(self):
        """활성화된 연결만 초기화"""
        enabled = self.selector.get_all_enabled_connections()
        
        logger.info(f"활성 연결 초기화: {len(enabled)}개 사이트")
        
        for site_id, db_list in enabled.items():
            logger.info(f"  • {site_id}: {', '.join(db_list)}")
            
            for db_name in db_list:
                try:
                    # 엔진 미리 생성 (연결 풀 초기화)
                    self._get_or_create_engine(site_id, db_name)
                except Exception as e:
                    logger.error(f"연결 초기화 실패: {site_id}/{db_name} - {e}")
    
    def _check_connection_enabled(self, site_id: str, db_name: str):
        """연결 활성화 확인"""
        if not self.selector.is_database_enabled(site_id, db_name):
            raise ConnectionError(
                f"연결이 비활성화됨: {site_id}/{db_name}. "
                f"활성화하려면 connection_selector를 사용하세요."
            )
    
    def _get_or_create_engine(self, site_id: str, db_name: str):
        """엔진 가져오기 또는 생성"""
        # 캐시 확인
        if site_id in self._engines and db_name in self._engines[site_id]:
            return self._engines[site_id][db_name]
        
        # 연결 활성화 확인 (초기화 시에는 건너뜀)
        if self._engines:  # 초기화 후에만 확인
            self._check_connection_enabled(site_id, db_name)
        
        # 데이터베이스 설정
        db_config = self.settings.get_database_config(site_id, db_name)
        
        # 엔진 생성
        engine = create_engine(
            db_config.connection_url,
            poolclass=QueuePool,
            pool_size=self.settings.DB_POOL_SIZE,
            max_overflow=self.settings.DB_MAX_OVERFLOW,
            pool_timeout=self.settings.DB_POOL_TIMEOUT,
            pool_recycle=self.settings.DB_POOL_RECYCLE,
            echo=self.settings.DB_ECHO,
            pool_pre_ping=True
        )
        
        # 캐시에 저장
        if site_id not in self._engines:
            self._engines[site_id] = {}
        
        self._engines[site_id][db_name] = engine
        
        logger.info(f"엔진 생성: {site_id}/{db_name}")
        
        return engine
    
    def _get_or_create_session_factory(
        self, 
        site_id: str, 
        db_name: str
    ) -> sessionmaker:
        """세션 팩토리 가져오기 또는 생성"""
        # 연결 활성화 확인
        self._check_connection_enabled(site_id, db_name)
        
        # 캐시 확인
        if site_id in self._session_factories and db_name in self._session_factories[site_id]:
            return self._session_factories[site_id][db_name]
        
        # 엔진 가져오기
        engine = self._get_or_create_engine(site_id, db_name)
        
        # 세션 팩토리 생성
        factory = sessionmaker(
            bind=engine,
            autocommit=False,
            autoflush=False
        )
        
        # 캐시에 저장
        if site_id not in self._session_factories:
            self._session_factories[site_id] = {}
        
        self._session_factories[site_id][db_name] = factory
        
        return factory
    
    def get_session(
        self, 
        site_id: Optional[str] = None, 
        db_name: Optional[str] = None
    ) -> Session:
        """
        데이터베이스 세션 가져오기
        
        Args:
            site_id: 사이트 ID (None이면 기본값)
            db_name: 데이터베이스 이름 (None이면 기본값)
        
        Raises:
            ConnectionError: 연결이 비활성화된 경우
        
        Returns:
            Session: SQLAlchemy 세션
        """
        site_id = site_id or self.settings.DEFAULT_SITE
        db_name = db_name or self.settings.DEFAULT_DB_NAME
        
        factory = self._get_or_create_session_factory(site_id, db_name)
        return factory()
    
    def get_all_active_sessions(self) -> Dict[str, Dict[str, Session]]:
        """
        모든 활성 연결의 세션 반환
        
        Returns:
            {site_id: {db_name: Session}}
        """
        sessions = {}
        enabled = self.selector.get_all_enabled_connections()
        
        for site_id, db_list in enabled.items():
            sessions[site_id] = {}
            
            for db_name in db_list:
                try:
                    sessions[site_id][db_name] = self.get_session(site_id, db_name)
                except Exception as e:
                    logger.error(f"세션 생성 실패: {site_id}/{db_name} - {e}")
        
        return sessions
    
    def test_connection(
        self, 
        site_id: Optional[str] = None, 
        db_name: Optional[str] = None
    ) -> bool:
        """연결 테스트"""
        try:
            site_id = site_id or self.settings.DEFAULT_SITE
            db_name = db_name or self.settings.DEFAULT_DB_NAME
            
            # 연결 활성화 확인
            self._check_connection_enabled(site_id, db_name)
            
            engine = self._get_or_create_engine(site_id, db_name)
            
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            logger.info(f"연결 테스트 성공: {site_id}/{db_name}")
            return True
            
        except ConnectionError:
            logger.warning(f"연결 비활성화: {site_id}/{db_name}")
            return False
        except Exception as e:
            logger.error(f"연결 테스트 실패: {site_id}/{db_name} - {e}")
            return False
    
    def test_all_active_connections(self) -> Dict[str, Dict[str, bool]]:
        """모든 활성 연결 테스트"""
        results = {}
        enabled = self.selector.get_all_enabled_connections()
        
        for site_id, db_list in enabled.items():
            results[site_id] = {}
            
            for db_name in db_list:
                results[site_id][db_name] = self.test_connection(site_id, db_name)
        
        return results
    
    def reload_connections(self):
        """
        연결 설정 리로드
        
        활성 연결 설정이 변경된 후 호출
        """
        logger.info("연결 리로드 시작")
        
        # 기존 연결 종료
        self.close_all()
        
        # 연결 선택자 리로드
        self.selector._load_configurations()
        
        # 활성 연결 재초기화
        self._initialize_active_connections()
        
        logger.info("연결 리로드 완료")
    
    def get_connection_status(self) -> Dict:
        """연결 상태 정보"""
        enabled = self.selector.get_all_enabled_connections()
        
        status = {
            'active_profile': self.selector.current_profile,
            'enabled_sites': list(enabled.keys()),
            'connections': {}
        }
        
        for site_id, db_list in enabled.items():
            status['connections'][site_id] = {}
            
            for db_name in db_list:
                is_cached = (
                    site_id in self._engines and 
                    db_name in self._engines[site_id]
                )
                
                status['connections'][site_id][db_name] = {
                    'enabled': True,
                    'cached': is_cached,
                    'tested': self.test_connection(site_id, db_name) if is_cached else None
                }
        
        return status
    
    def close_connection(self, site_id: str, db_name: str):
        """특정 연결 종료"""
        if site_id in self._engines and db_name in self._engines[site_id]:
            self._engines[site_id][db_name].dispose()
            del self._engines[site_id][db_name]
            
            if site_id in self._session_factories and db_name in self._session_factories[site_id]:
                del self._session_factories[site_id][db_name]
            
            logger.info(f"연결 종료: {site_id}/{db_name}")
    
    def close_all(self):
        """모든 연결 종료"""
        for site_engines in self._engines.values():
            for engine in site_engines.values():
                engine.dispose()
        
        self._engines.clear()
        self._session_factories.clear()
        
        logger.info("모든 연결 종료")


# 전역 인스턴스
connection_manager = MultiConnectionManager()


def get_db(
    site_id: Optional[str] = None, 
    db_name: Optional[str] = None
):
    """FastAPI dependency"""
    db = connection_manager.get_session(site_id, db_name)
    try:
        yield db
    finally:
        db.close()