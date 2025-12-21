# backend/config/multi_site_settings.py
"""
다중 사이트 데이터베이스 설정 관리
Pydantic v2 호환 버전
"""

import os
import json
from pathlib import Path
from typing import Dict, Optional, List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent.parent


def load_environment():
    """환경 변수 로드"""
    env_file = PROJECT_ROOT / '.env'
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✓ .env 파일 로드: {env_file}")
        return True
    else:
        print(f"✗ .env 파일 없음: {env_file}")
        return False


class DatabaseConfig:
    """개별 데이터베이스 설정"""
    
    @staticmethod
    def get_mssql_driver():
        """
        설치된 MSSQL ODBC 드라이버 자동 감지
        
        Returns:
            str: 드라이버 이름 (예: 'ODBC Driver 18 for SQL Server')
        """
        try:
            import pyodbc
            drivers = pyodbc.drivers()
            
            # 우선순위: Driver 18 > Driver 17 > 기타
            preferred_drivers = [
                'ODBC Driver 18 for SQL Server',
                'ODBC Driver 17 for SQL Server',
                'ODBC Driver 13 for SQL Server',
                'SQL Server Native Client 11.0',
                'SQL Server'
            ]
            
            for driver in preferred_drivers:
                if driver in drivers:
                    return driver
            
            # SQL Server 관련 드라이버 찾기
            for driver in drivers:
                if 'SQL Server' in driver:
                    return driver
            
            # 기본값
            return 'ODBC Driver 17 for SQL Server'
            
        except ImportError:
            print("⚠ pyodbc를 찾을 수 없습니다. 기본 드라이버를 사용합니다.")
            return 'ODBC Driver 17 for SQL Server'
    
    def __init__(self, site_id: str, db_key: str, config: dict):
        self.site_id = site_id
        self.db_key = db_key
        self.host = config['host']
        self.port = config['port']
        self.db_type = config['type'].lower()  # 대소문자 통일
        self.user = config['user']
        self.password = config['password']
        self.database = config['databases'][db_key]
        
        # MSSQL용 드라이버 자동 감지
        if self.db_type == 'mssql':
            self.odbc_driver = self.get_mssql_driver()
        else:
            self.odbc_driver = None
    
    @property
    def connection_url(self) -> str:
        """연결 URL 생성"""
        if self.db_type == 'postgresql':
            return (
                f"postgresql://{self.user}:{self.password}@"
                f"{self.host}:{self.port}/{self.database}"
            )
        elif self.db_type == 'mysql':
            return (
                f"mysql+pymysql://{self.user}:{self.password}@"
                f"{self.host}:{self.port}/{self.database}"
            )
        elif self.db_type == 'mssql':
            # URL 인코딩을 위한 import
            from urllib.parse import quote_plus
            
            # 드라이버 이름 URL 인코딩
            driver = quote_plus(self.odbc_driver)
            
            return (
                f"mssql+pyodbc://{self.user}:{self.password}@"
                f"{self.host}:{self.port}/{self.database}"
                f"?driver={driver}"
                f"&TrustServerCertificate=yes"
                f"&Encrypt=yes"
            )
        else:
            raise ValueError(f"Unsupported database type: {self.db_type}")
    
    def __repr__(self):
        return f"<DatabaseConfig {self.site_id}:{self.db_key} @ {self.host}>"


class MultiSiteSettings(BaseSettings):
    """다중 사이트 설정 - Pydantic v2"""
    
    # Pydantic v2 설정
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='ignore'  # 추가 필드 무시 (기존 REMOTE_DB_* 필드와 충돌 방지)
    )
    
    # 기본 설정
    ENVIRONMENT: str = Field(default='development')
    APP_PORT: int = Field(default=8000)
    LOG_LEVEL: str = Field(default='INFO')
    
    # 기본 사이트/DB
    DEFAULT_SITE: str
    DEFAULT_DB_NAME: str
    
    # 방법 1: JSON 문자열 (한 줄)
    DATABASE_SITES: Optional[str] = Field(default=None)
    
    # 방법 2: JSON 파일 경로
    DATABASE_CONFIG_FILE: Optional[str] = Field(default=None)
    
    # 연결 풀 설정
    DB_POOL_SIZE: int = Field(default=5)
    DB_MAX_OVERFLOW: int = Field(default=10)
    DB_POOL_TIMEOUT: int = Field(default=30)
    DB_POOL_RECYCLE: int = Field(default=3600)
    DB_ECHO: bool = Field(default=False)
    
    # 보안 설정
    API_KEY: Optional[str] = Field(default=None)
    CORS_ORIGINS: str = Field(default='*')
    
    # 파싱된 사이트 정보 (pydantic 필드가 아님)
    _sites_config: Optional[dict] = None
    _database_configs: Dict[str, Dict[str, DatabaseConfig]] = {}
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._parse_sites()
    
    def _parse_sites(self):
        """사이트 설정 파싱"""
        
        # 방법 1: DATABASE_SITES (JSON 문자열)
        if self.DATABASE_SITES:
            try:
                self._sites_config = json.loads(self.DATABASE_SITES)
                print("✓ DATABASE_SITES JSON 파싱 성공")
            except json.JSONDecodeError as e:
                print(f"✗ DATABASE_SITES JSON 파싱 실패: {e}")
                raise ValueError(f"DATABASE_SITES JSON 파싱 실패: {e}")
        
        # 방법 2: DATABASE_CONFIG_FILE (JSON 파일)
        elif self.DATABASE_CONFIG_FILE:
            config_path = PROJECT_ROOT / self.DATABASE_CONFIG_FILE
            
            if not config_path.exists():
                raise ValueError(f"데이터베이스 설정 파일을 찾을 수 없음: {config_path}")
            
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    self._sites_config = json.load(f)
                print(f"✓ 설정 파일 로드: {config_path}")
            except json.JSONDecodeError as e:
                raise ValueError(f"설정 파일 JSON 파싱 실패: {e}")
        
        else:
            raise ValueError(
                "DATABASE_SITES 또는 DATABASE_CONFIG_FILE 중 하나를 설정해야 합니다"
            )
        
        # 각 사이트의 데이터베이스 설정 생성
        for site_id, site_config in self._sites_config.items():
            self._database_configs[site_id] = {}
            
            for db_key in site_config['databases'].keys():
                db_config = DatabaseConfig(site_id, db_key, site_config)
                self._database_configs[site_id][db_key] = db_config
        
        print(f"✓ {len(self._sites_config)}개 사이트 로드됨")
        print(f"✓ 총 {sum(len(dbs) for dbs in self._database_configs.values())}개 데이터베이스 설정됨")
    
    def get_database_config(
        self, 
        site_id: Optional[str] = None, 
        db_name: Optional[str] = None
    ) -> DatabaseConfig:
        """
        데이터베이스 설정 가져오기
        
        Args:
            site_id: 사이트 ID (None이면 기본값)
            db_name: 데이터베이스 이름 (None이면 기본값)
        
        Returns:
            DatabaseConfig: 데이터베이스 설정
        """
        site_id = site_id or self.DEFAULT_SITE
        db_name = db_name or self.DEFAULT_DB_NAME
        
        if site_id not in self._database_configs:
            raise ValueError(f"사이트를 찾을 수 없음: {site_id}")
        
        if db_name not in self._database_configs[site_id]:
            raise ValueError(f"데이터베이스를 찾을 수 없음: {site_id}/{db_name}")
        
        return self._database_configs[site_id][db_name]
    
    def get_all_sites(self) -> List[str]:
        """모든 사이트 ID 반환"""
        return list(self._sites_config.keys())
    
    def get_site_databases(self, site_id: str) -> List[str]:
        """특정 사이트의 데이터베이스 목록"""
        if site_id not in self._database_configs:
            raise ValueError(f"사이트를 찾을 수 없음: {site_id}")
        
        return list(self._database_configs[site_id].keys())
    
    def get_site_info(self, site_id: str) -> dict:
        """사이트 정보 반환"""
        if site_id not in self._sites_config:
            raise ValueError(f"사이트를 찾을 수 없음: {site_id}")
        
        config = self._sites_config[site_id]
        return {
            'site_id': site_id,
            'host': config['host'],
            'port': config['port'],
            'type': config['type'],
            'databases': list(config['databases'].keys())
        }


# 환경 변수 로드
load_environment()

# 전역 설정 인스턴스
try:
    multi_site_settings = MultiSiteSettings()
    print(f"✓ 다중 사이트 설정 로드 완료")
except Exception as e:
    print(f"✗ 설정 로드 실패: {e}")
    raise


def get_multi_site_settings() -> MultiSiteSettings:
    """설정 인스턴스 반환"""
    return multi_site_settings
