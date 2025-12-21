# backend/config/settings.py
"""
환경 설정 관리 모듈 - Pydantic v2

이 모듈은 .env 파일에서 환경 변수를 로드하고 검증합니다.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# 프로젝트 루트 경로
PROJECT_ROOT = Path(__file__).parent.parent.parent

# 환경 변수 파일 로드 우선순위
# 1. .env.{ENVIRONMENT} (예: .env.production)
# 2. .env
# 3. 시스템 환경 변수

def load_environment():
    """환경 변수 로드"""
    # 기본 .env 파일 로드
    env_file = PROJECT_ROOT / '.env'
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✓ .env 파일 로드됨: {env_file}")
    
    # 환경별 .env 파일 로드 (우선순위 높음)
    environment = os.getenv('ENVIRONMENT', 'development')
    env_specific_file = PROJECT_ROOT / f'.env.{environment}'
    
    if env_specific_file.exists():
        load_dotenv(env_specific_file, override=True)
        print(f"✓ .env.{environment} 파일 로드됨: {env_specific_file}")
    
    return environment


class Settings(BaseSettings):
    """애플리케이션 설정 - Pydantic v2"""
    
    # Pydantic v2 설정
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='ignore'  # 추가 필드 무시 (다른 설정 파일과 충돌 방지)
    )
    
    @staticmethod
    def get_mssql_driver():
        """
        설치된 MSSQL ODBC 드라이버 자동 감지
        
        Returns:
            str: 드라이버 이름
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
            
            return 'ODBC Driver 17 for SQL Server'
            
        except ImportError:
            return 'ODBC Driver 17 for SQL Server'
    
    # =============================================================================
    # DATABASE CONFIGURATION
    # =============================================================================
    
    REMOTE_DB_HOST: Optional[str] = Field(default=None)
    REMOTE_DB_PORT: int = Field(default=5432)
    REMOTE_DB_NAME: Optional[str] = Field(default=None)
    REMOTE_DB_USER: Optional[str] = Field(default=None)
    REMOTE_DB_PASSWORD: Optional[str] = Field(default=None)
    DATABASE_TYPE: str = Field(default='postgresql')
    
    # =============================================================================
    # CONNECTION POOL SETTINGS
    # =============================================================================
    
    DB_POOL_SIZE: int = Field(default=5)
    DB_MAX_OVERFLOW: int = Field(default=10)
    DB_POOL_TIMEOUT: int = Field(default=30)
    DB_POOL_RECYCLE: int = Field(default=3600)
    DB_ECHO: bool = Field(default=False)
    
    # =============================================================================
    # APPLICATION SETTINGS
    # =============================================================================
    
    ENVIRONMENT: str = Field(default='development')
    APP_PORT: int = Field(default=8000)
    LOG_LEVEL: str = Field(default='INFO')
    
    # =============================================================================
    # SECURITY SETTINGS
    # =============================================================================
    
    API_KEY: Optional[str] = Field(default=None)
    JWT_SECRET: Optional[str] = Field(default=None)
    CORS_ORIGINS: str = Field(default='*')
    
    # =============================================================================
    # CACHE SETTINGS
    # =============================================================================
    
    REDIS_HOST: str = Field(default='localhost')
    REDIS_PORT: int = Field(default=6379)
    REDIS_PASSWORD: Optional[str] = Field(default=None)
    
    # =============================================================================
    # MONITORING SETTINGS
    # =============================================================================
    
    DATA_COLLECTION_INTERVAL: int = Field(default=5)
    WEBSOCKET_INTERVAL: int = Field(default=1)
    
    # =============================================================================
    # VALIDATORS (Pydantic v2 스타일)
    # =============================================================================
    
    @field_validator('DATABASE_TYPE')
    @classmethod
    def validate_database_type(cls, v: str) -> str:
        """데이터베이스 타입 검증"""
        allowed_types = ['postgresql', 'mysql', 'mssql']
        if v.lower() not in allowed_types:
            raise ValueError(f"DATABASE_TYPE must be one of {allowed_types}")
        return v.lower()
    
    @field_validator('LOG_LEVEL')
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """로그 레벨 검증"""
        allowed_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in allowed_levels:
            raise ValueError(f"LOG_LEVEL must be one of {allowed_levels}")
        return v.upper()
    
    @field_validator('ENVIRONMENT')
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """환경 검증"""
        allowed_envs = ['development', 'production', 'test']
        if v.lower() not in allowed_envs:
            raise ValueError(f"ENVIRONMENT must be one of {allowed_envs}")
        return v.lower()
    
    # =============================================================================
    # COMPUTED PROPERTIES
    # =============================================================================
    
    @property
    def database_url(self) -> Optional[str]:
        """데이터베이스 연결 URL 생성"""
        # 필수 필드가 없으면 None 반환
        if not all([self.REMOTE_DB_HOST, self.REMOTE_DB_USER, 
                   self.REMOTE_DB_PASSWORD, self.REMOTE_DB_NAME]):
            return None
        
        if self.DATABASE_TYPE == 'postgresql':
            return (
                f"postgresql://{self.REMOTE_DB_USER}:"
                f"{self.REMOTE_DB_PASSWORD}@"
                f"{self.REMOTE_DB_HOST}:{self.REMOTE_DB_PORT}/"
                f"{self.REMOTE_DB_NAME}"
            )
        elif self.DATABASE_TYPE == 'mysql':
            return (
                f"mysql+pymysql://{self.REMOTE_DB_USER}:"
                f"{self.REMOTE_DB_PASSWORD}@"
                f"{self.REMOTE_DB_HOST}:{self.REMOTE_DB_PORT}/"
                f"{self.REMOTE_DB_NAME}"
            )
        elif self.DATABASE_TYPE == 'mssql':
            from urllib.parse import quote_plus
            driver = quote_plus(self.get_mssql_driver())
            
            return (
                f"mssql+pyodbc://{self.REMOTE_DB_USER}:"
                f"{self.REMOTE_DB_PASSWORD}@"
                f"{self.REMOTE_DB_HOST}:{self.REMOTE_DB_PORT}/"
                f"{self.REMOTE_DB_NAME}?driver={driver}"
                f"&TrustServerCertificate=yes"
                f"&Encrypt=yes"
            )
        else:
            raise ValueError(f"Unsupported database type: {self.DATABASE_TYPE}")
    
    @property
    def cors_origins_list(self) -> list:
        """CORS 허용 도메인 리스트 반환"""
        if self.CORS_ORIGINS == '*':
            return ['*']
        return [origin.strip() for origin in self.CORS_ORIGINS.split(',')]
    
    @property
    def is_development(self) -> bool:
        """개발 환경 여부"""
        return self.ENVIRONMENT == 'development'
    
    @property
    def is_production(self) -> bool:
        """프로덕션 환경 여부"""
        return self.ENVIRONMENT == 'production'


# 환경 변수 로드
current_environment = load_environment()

# 전역 설정 인스턴스
try:
    settings = Settings()
    
    # REMOTE_DB_* 필드 확인 (경고만 출력)
    if not settings.database_url:
        print(f"⚠ REMOTE_DB_* 설정이 없습니다 (multi_site_settings 사용 시 무시됨)")
    else:
        print(f"✓ 설정 로드 완료 (환경: {settings.ENVIRONMENT})")
        
except Exception as e:
    print(f"✗ 설정 로드 실패: {e}")
    print(f"  .env 파일이 존재하는지 확인하세요: {PROJECT_ROOT / '.env'}")
    print(f"  multi_site_settings를 사용하는 경우 이 에러는 무시할 수 있습니다")
    # 에러를 발생시키지 않고 None으로 설정
    settings = None


def get_settings() -> Optional[Settings]:
    """
    설정 인스턴스 반환
    
    Note: multi_site_settings를 사용하는 경우 
          REMOTE_DB_* 설정이 없어도 None을 반환할 수 있습니다.
    """
    return settings
