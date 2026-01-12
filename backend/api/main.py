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
# ⭐ Router Import
# ============================================
from .routers.connection_manager import router as connection_router
from .routers import equipment_mapping

# ⭐ Phase 1: Monitoring Router 추가
try:
    from .monitoring import status_router, stream_router
    MONITORING_ENABLED = True
    logger.info("✅ Monitoring 모듈 로드 성공")
except ImportError as e:
    MONITORING_ENABLED = False
    logger.warning(f"⚠️ Monitoring 모듈 로드 실패: {e}")
    logger.info("   → Monitoring 기능 없이 실행됩니다")

# ⭐ NEW: Equipment Detail Router 추가
try:
    from .routers.equipment_detail import router as equipment_detail_router
    EQUIPMENT_DETAIL_ENABLED = True
    logger.info("✅ Equipment Detail 모듈 로드 성공")
except ImportError as e:
    EQUIPMENT_DETAIL_ENABLED = False
    logger.warning(f"⚠️ Equipment Detail 모듈 로드 실패: {e}")


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
    version="1.1.0",  # 버전 업데이트
    lifespan=lifespan
)

# CORS 설정 - 모든 origin 허용 (외부 IP 접속 지원)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"✓ CORS 설정: {origins_list}")

# ============================================
# ⭐ Router 등록
# ============================================

# Connection Manager Router (기존)
app.include_router(
    connection_router,
    prefix="/api/connections",
    tags=["Database Connections"]
)
logger.info("✓ Connection Manager Router 등록 완료")

# Equipment Mapping Router (기존)
app.include_router(
    equipment_mapping.router,
    prefix="/api",
    tags=["Equipment Mapping"]
)
logger.info("✓ Equipment Mapping Router 등록 완료")

# ⭐ Phase 1: Monitoring Router 등록 (신규)
if MONITORING_ENABLED:
    app.include_router(
        status_router,
        tags=["Monitoring"]
    )
    app.include_router(
        stream_router,
        tags=["Monitoring WebSocket"]
    )
    logger.info("✅ Monitoring Router 등록 완료")
else:
    logger.warning("⚠️ Monitoring Router 미등록 (모듈 로드 실패)")

# ⭐ NEW: Equipment Detail Router 등록
if EQUIPMENT_DETAIL_ENABLED:
    app.include_router(
        equipment_detail_router,
        tags=["Equipment Detail"]
    )
    logger.info("✅ Equipment Detail Router 등록 완료")
else:
    logger.warning("⚠️ Equipment Detail Router 미등록 (모듈 로드 실패)")


@app.get("/")
async def root():
    """API 루트"""
    endpoints = {
        # Connection endpoints (기존)
        "sites": "/api/connections/sites",
        "profiles": "/api/connections/profiles",
        "test_connection": "/api/connections/test-connection",
        "test_profile": "/api/connections/test-profile",
        "test_all": "/api/connections/test-all",
        "status": "/api/connections/status",
        # Equipment Mapping endpoints (기존)
        "equipment_names": "/api/equipment/names",
        "equipment_mapping": "/api/equipment/mapping",
        "equipment_mapping_validate": "/api/equipment/mapping/validate"
    }
    
    # ⭐ Phase 1: Monitoring endpoints 추가 (조건부)
    if MONITORING_ENABLED:
        endpoints.update({
            "monitoring_health": "/api/monitoring/health",
            "monitoring_status": "/api/monitoring/status",
            "monitoring_status_by_id": "/api/monitoring/status/{equipment_id}",
            "monitoring_stream": "ws://localhost:8000/api/monitoring/stream"
        })
    
    # ⭐ NEW: Equipment Detail endpoints 추가 (조건부)
    if EQUIPMENT_DETAIL_ENABLED:
        endpoints.update({
            "equipment_detail": "/api/equipment/detail/{frontend_id}",
            "equipment_detail_multi": "/api/equipment/detail/multi",
            "equipment_detail_health": "/api/equipment/detail/health"
        })
    
    return {
        "name": "SHERLOCK_SKY_3DSIM Connection Test API",
        "version": "1.1.0",
        "description": "데이터베이스 연결 테스트 전용",
        "docs": "/docs",
        "monitoring_enabled": MONITORING_ENABLED,
        "equipment_detail_enabled": EQUIPMENT_DETAIL_ENABLED,
        "endpoints": endpoints
    }


@app.get("/api/health")
async def health():
    """헬스 체크"""
    return {
        "status": "ok",
        "message": "healthy",
        "timestamp": datetime.now().isoformat(),
        "monitoring_enabled": MONITORING_ENABLED,
        "equipment_detail_enabled": EQUIPMENT_DETAIL_ENABLED
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "backend.api.main:app",
        host="0.0.0.0",
        port=int(os.getenv('APP_PORT', 8000)),
        reload=True
    )