"""
FastAPI 메인 애플리케이션
Multi-Site Equipment Mapping V2 API 추가
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

from .utils.logging_config import setup_logging
import logging

setup_logging(
    log_level=os.getenv('LOG_LEVEL', 'INFO'),
    log_dir='logs',
    app_name='sherlock_sky_api'
)
logger = logging.getLogger(__name__)

# ============================================
# Router Import
# ============================================
from .routers.connection_manager import router as connection_router
from .routers import equipment_mapping

# ⭐ NEW: Multi-Site Equipment Mapping V2
try:
    from .routers import equipment_mapping_v2
    MAPPING_V2_ENABLED = True
    logger.info("✅ Equipment Mapping V2 (Multi-Site) 로드 성공")
except ImportError as e:
    MAPPING_V2_ENABLED = False
    logger.warning(f"⚠️ Equipment Mapping V2 로드 실패: {e}")

# Monitoring Router
try:
    from .monitoring import status_router, stream_router
    MONITORING_ENABLED = True
    logger.info("✅ Monitoring 모듈 로드 성공")
except ImportError as e:
    MONITORING_ENABLED = False
    logger.warning(f"⚠️ Monitoring 모듈 로드 실패: {e}")

# Equipment Detail Router
try:
    from .routers.equipment_detail import router as equipment_detail_router
    EQUIPMENT_DETAIL_ENABLED = True
    logger.info("✅ Equipment Detail 모듈 로드 성공")
except ImportError as e:
    EQUIPMENT_DETAIL_ENABLED = False
    logger.warning(f"⚠️ Equipment Detail 모듈 로드 실패: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 애플리케이션 시작")
    print("="*60)
    print("🚀 SHERLOCK_SKY_3DSIM API 시작")
    print("="*60)
    yield
    logger.info("🛑 애플리케이션 종료")


app = FastAPI(
    title="SHERLOCK_SKY_3DSIM API",
    description="Multi-Site Equipment Monitoring & Mapping API",
    version="1.2.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Router 등록
# ============================================

# Connection Manager
app.include_router(
    connection_router,
    prefix="/api/connections",
    tags=["Database Connections"]
)
logger.info("✓ Connection Manager Router 등록")

# Equipment Mapping (기존)
app.include_router(
    equipment_mapping.router,
    prefix="/api",
    tags=["Equipment Mapping"]
)
logger.info("✓ Equipment Mapping Router 등록")

# ⭐ Equipment Mapping V2 (Multi-Site)
if MAPPING_V2_ENABLED:
    app.include_router(
        equipment_mapping_v2.router,
        prefix="/api",
        tags=["Equipment Mapping V2 (Multi-Site)"]
    )
    logger.info("✅ Equipment Mapping V2 Router 등록")

# Monitoring
if MONITORING_ENABLED:
    app.include_router(status_router, tags=["Monitoring"])
    app.include_router(stream_router, tags=["Monitoring WebSocket"])
    logger.info("✅ Monitoring Router 등록")

# Equipment Detail
if EQUIPMENT_DETAIL_ENABLED:
    app.include_router(equipment_detail_router, tags=["Equipment Detail"])
    logger.info("✅ Equipment Detail Router 등록")


@app.get("/")
async def root():
    """API 루트"""
    endpoints = {
        # Connection
        "sites": "/api/connections/sites",
        "connect": "/api/connections/connect",
        "disconnect": "/api/connections/disconnect/{site_id}",
        "connection_status": "/api/connections/connection-status",
        # Equipment Mapping (기존)
        "equipment_names": "/api/equipment/names",
        "equipment_mapping": "/api/equipment/mapping",
    }
    
    # ⭐ Mapping V2 endpoints
    if MAPPING_V2_ENABLED:
        endpoints.update({
            "mapping_sites": "/api/mapping/sites",
            "mapping_config": "/api/mapping/config/{site_id}",
            "mapping_current": "/api/mapping/current",
            "mapping_on_connect": "/api/mapping/on-connect/{site_id}"
        })
    
    if MONITORING_ENABLED:
        endpoints.update({
            "monitoring_health": "/api/monitoring/health",
            "monitoring_status": "/api/monitoring/status",
            "monitoring_stream": "ws://localhost:8000/api/monitoring/stream"
        })
    
    if EQUIPMENT_DETAIL_ENABLED:
        endpoints.update({
            "equipment_detail": "/api/equipment/detail/{frontend_id}"
        })
    
    return {
        "name": "SHERLOCK_SKY_3DSIM API",
        "version": "1.2.0",
        "docs": "/docs",
        "features": {
            "mapping_v2": MAPPING_V2_ENABLED,
            "monitoring": MONITORING_ENABLED,
            "equipment_detail": EQUIPMENT_DETAIL_ENABLED
        },
        "endpoints": endpoints
    }


@app.get("/api/health")
async def health():
    """헬스 체크"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "mapping_v2_enabled": MAPPING_V2_ENABLED,
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