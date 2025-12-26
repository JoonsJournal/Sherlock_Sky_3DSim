"""
FastAPI 메인 애플리케이션 (Connection Test 전용)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
from datetime import datetime

# 환경 변수 로드
load_dotenv()

# 로깅 설정
from .utils.logging_config import setup_logging
import logging

setup_logging(
    log_level=os.getenv('LOG_LEVEL', 'INFO'),
    log_dir='logs',
    app_name='sherlock_sky_api'
)
logger = logging.getLogger(__name__)

# ============================================
# ⭐ Router Import (수정됨)
# ============================================
from .routers.connection_manager import router as connection_router
from .routers import equipment_mapping  # ⭐ 추가

# 라이프사이클 관리
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시
    logger.info("🚀 애플리케이션 시작")
    print("="*60)
    print("🚀 SHERLOCK_SKY_3DSIM API 시작")
    print("="*60)
    
    yield
    
    # 종료 시
    logger.info("🛑 애플리케이션 종료")
    print("🛑 애플리케이션 종료")

# FastAPI 앱 생성
app = FastAPI(
    title="SHERLOCK_SKY_3DSIM Connection Test API",
    description="데이터베이스 연결 테스트 전용 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080')
origins_list = [origin.strip() for origin in ALLOWED_ORIGINS.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"✓ CORS 설정: {origins_list}")

# ============================================
# ⭐ Router 등록 (수정됨)
# ============================================

# Connection Manager Router
app.include_router(
    connection_router,
    prefix="/api/connections",
    tags=["Database Connections"]
)
logger.info("✓ Connection Manager Router 등록 완료")

# ⭐ Equipment Mapping Router (새로 추가)
app.include_router(
    equipment_mapping.router,
    prefix="/api",
    tags=["Equipment Mapping"]
)
logger.info("✓ Equipment Mapping Router 등록 완료")


@app.get("/")
async def root():
    """API 루트"""
    return {
        "name": "SHERLOCK_SKY_3DSIM Connection Test API",
        "version": "1.0.0",
        "description": "데이터베이스 연결 테스트 전용",
        "docs": "/docs",
        "endpoints": {
            # Connection endpoints
            "sites": "/api/connections/sites",
            "profiles": "/api/connections/profiles",
            "test_connection": "/api/connections/test-connection",
            "test_profile": "/api/connections/test-profile",
            "test_all": "/api/connections/test-all",
            "status": "/api/connections/status",
            # ⭐ Equipment Mapping endpoints (새로 추가)
            "equipment_names": "/api/equipment/names",
            "equipment_mapping": "/api/equipment/mapping",
            "equipment_mapping_validate": "/api/equipment/mapping/validate"
        }
    }


@app.get("/health")
async def health():
    """헬스 체크"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "backend.api.main:app",
        host="0.0.0.0",
        port=int(os.getenv('APP_PORT', 8000)),
        reload=True
    )