# backend/api/database/remote_connection.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
import os

class RemoteDatabaseManager:
    def __init__(self):
        # 원격 DB 연결 정보 (환경 변수에서 로드)
        self.db_config = {
            'host': os.getenv('REMOTE_DB_HOST', '123.45.67.89'),
            'port': os.getenv('REMOTE_DB_PORT', '5432'),
            'database': os.getenv('REMOTE_DB_NAME', 'factory_db'),
            'user': os.getenv('REMOTE_DB_USER', 'admin'),
            'password': os.getenv('REMOTE_DB_PASSWORD', 'password')
        }
        
        # 연결 문자열 생성
        self.connection_string = (
            f"postgresql://{self.db_config['user']}:"
            f"{self.db_config['password']}@"
            f"{self.db_config['host']}:{self.db_config['port']}/"
            f"{self.db_config['database']}"
        )
        
        # 엔진 생성 (연결 풀링)
        self.engine = create_engine(
            self.connection_string,
            poolclass=QueuePool,
            pool_size=5,           # 최대 5개 연결 유지
            max_overflow=10,       # 추가 10개 연결 가능
            pool_timeout=30,       # 연결 대기 시간
            pool_recycle=3600,     # 1시간마다 연결 재생성
            echo=False
        )
        
        self.SessionLocal = sessionmaker(bind=self.engine)
    
    def get_session(self):
        """데이터베이스 세션 반환"""
        return self.SessionLocal()
    
    def test_connection(self):
        """연결 테스트"""
        try:
            with self.engine.connect() as conn:
                conn.execute("SELECT 1")
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False

# 전역 인스턴스
db_manager = RemoteDatabaseManager()

def get_db():
    """FastAPI dependency"""
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()