"""
FastAPI 메인 애플리케이션
Multi-Site Equipment Mapping V2 API + UDS 통합

@version 1.3.1
@changelog
- v1.3.1: UDS Status Watcher DB 연결 정보 자동 설정 (Phase 1 긴급 수정)
          - DatabaseConnectionManager에서 활성 연결 자동 감지
          - set_connection() 자동 호출로 WebSocket Delta 브로드캐스트 복구
          - ⚠️ 호환성: 기존 v1.3.0 모든 기능 100% 유지
- v1.3.0: UDS (Unified Data Store) 통합
          - UDS 라우터 등록 (/api/uds/*)
          - Status Watcher 백그라운드 서비스 시작/종료
          - ⚠️ 호환성: 기존 모든 API 응답 구조 100% 유지
- v1.2.0: Multi-Site Equipment Mapping V2 추가
- v1.1.0: Monitoring 모듈 추가
- v1.0.0: 초기 버전

📁 위치: backend/api/main.py
작성일: 2026-01-20
수정일: 2026-01-22
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
# Router Import (기존 100% 유지)
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

# ============================================
# 🆕 UDS (Unified Data Store) Import
# ============================================
UDS_ENABLED = os.getenv('UDS_ENABLED', 'true').lower() == 'true'
UDS_LOADED = False
status_watcher = None

if UDS_ENABLED:
    try:
        from .routers.uds.uds import router as uds_router
        from .routers.uds.uds import broadcast_delta
        from .services.uds.status_watcher import status_watcher as _status_watcher
        
        status_watcher = _status_watcher
        
        # Status Watcher에 broadcast 함수 주입 (순환 import 방지)
        status_watcher.set_broadcast_func(broadcast_delta)
        
        UDS_LOADED = True
        logger.info("✅ UDS 모듈 로드 성공")
    except ImportError as e:
        UDS_LOADED = False
        logger.warning(f"⚠️ UDS 모듈 로드 실패: {e}")


# ============================================
# Application Lifespan (기존 로직 100% 유지)
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # === STARTUP (기존과 동일) ===
    logger.info("🚀 애플리케이션 시작")
    print("="*60)
    print("🚀 SHERLOCK_SKY_3DSIM API 시작")
    print("="*60)
    
    # 🆕 UDS Status Watcher 시작 (v1.3.1: DB 연결 정보 자동 설정 추가)
    if UDS_ENABLED and UDS_LOADED and status_watcher:
        try:
            # ✅ v1.3.1 추가: DatabaseConnectionManager에서 연결 정보 가져오기
            from .database.connection_test import get_connection_manager
            
            manager = get_connection_manager()
            active_sites = manager.get_active_connections()
            
            if active_sites:
                site_name = active_sites[0]
                site_info = manager.get_active_connection_info(site_name)
                
                if site_info and 'db_name' in site_info:
                    # Status Watcher에 연결 정보 전달
                    status_watcher.set_connection(site_name, site_info['db_name'])
                    logger.info(f"✅ Status Watcher 연결 설정: {site_name}_{site_info['db_name']}")
                else:
                    logger.warning("⚠️ Site 정보를 가져올 수 없습니다")
            else:
                logger.warning("⚠️ 활성 연결이 없습니다. Status Watcher는 연결 대기 상태로 시작됩니다.")
            
            # 기존 start() 호출
            await status_watcher.start()
            logger.info("✅ Status Watcher 시작됨")
        except Exception as e:
            logger.error(f"❌ Status Watcher 시작 실패: {e}")
    
    yield
    
    # === SHUTDOWN ===
    # 🆕 UDS Status Watcher 정지 (추가)
    if UDS_ENABLED and UDS_LOADED and status_watcher:
        try:
            await status_watcher.stop()
            logger.info("✅ Status Watcher 정지됨")
        except Exception as e:
            logger.error(f"❌ Status Watcher 정지 실패: {e}")
    
    # 기존 종료 로그 (동일하게 유지)
    logger.info("🛑 애플리케이션 종료")


# ============================================
# FastAPI App (기존 설정 유지)
# ============================================
app = FastAPI(
    title="SHERLOCK_SKY_3DSIM API",
    description="Multi-Site Equipment Monitoring & Mapping API",  # 기존과 동일
    version="1.2.0",  # 기존 버전 유지 (호환성)
    lifespan=lifespan
)

# CORS (기존과 100% 동일)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Router 등록 (기존 100% 유지)
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

# ============================================
# 🆕 UDS Router 등록 (추가)
# ============================================
if UDS_ENABLED and UDS_LOADED:
    app.include_router(
        uds_router,
        tags=["UDS - Unified Data Store"]
    )
    logger.info("✅ UDS Router 등록")


# ============================================
# Root Endpoint (기존 응답 구조 유지 + UDS 확장)
# ============================================
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
            "monitoring_stream": "/api/monitoring/stream"
        })
    
    if EQUIPMENT_DETAIL_ENABLED:
        endpoints.update({
            "equipment_detail": "/api/equipment/detail/{frontend_id}"
        })
    
    # 🆕 UDS endpoints (추가)
    if UDS_ENABLED and UDS_LOADED:
        endpoints.update({
            "uds_health": "/api/uds/health",
            "uds_initial": "/api/uds/initial",
            "uds_equipment": "/api/uds/equipment/{frontend_id}",
            "uds_stats": "/api/uds/stats",
            "uds_stream": "/api/uds/stream (WebSocket)",
            "uds_refresh": "/api/uds/refresh (POST)"
        })
    
    # 기존 응답 구조 100% 유지
    response = {
        "name": "SHERLOCK_SKY_3DSIM API",
        "version": "1.2.0",  # 기존 버전 유지
        "docs": "/docs",
        "features": {
            "mapping_v2": MAPPING_V2_ENABLED,
            "monitoring": MONITORING_ENABLED,
            "equipment_detail": EQUIPMENT_DETAIL_ENABLED
        },
        "endpoints": endpoints
    }
    
    # 🆕 UDS 정보 추가 (기존 구조 유지하면서 확장)
    if UDS_ENABLED:
        response["features"]["uds"] = UDS_LOADED
    
    return response


# ============================================
# Health Check (⚠️ 기존 응답 구조 100% 유지)
# ============================================
@app.get("/api/health")
async def health():
    """헬스 체크"""
    # ⚠️ 기존 응답 구조 100% 유지 (Breaking Change 방지)
    response = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "mapping_v2_enabled": MAPPING_V2_ENABLED,
        "monitoring_enabled": MONITORING_ENABLED,
        "equipment_detail_enabled": EQUIPMENT_DETAIL_ENABLED
    }
    
    # 🆕 UDS 정보 추가 (기존 필드 유지하면서 새 필드 추가)
    if UDS_ENABLED:
        response["uds_enabled"] = UDS_ENABLED
        response["uds_loaded"] = UDS_LOADED
        
        if UDS_LOADED and status_watcher:
            response["uds_watcher_running"] = status_watcher.is_running
    
    return response


# ============================================
# 🆕 UDS 관리자 엔드포인트 (추가)
# ============================================

@app.get("/api/admin/watcher/status")
async def get_watcher_status():
    """
    Status Watcher 상태 조회 (관리자용)
    """
    if not UDS_ENABLED:
        return {
            "status": "disabled",
            "message": "UDS is disabled (UDS_ENABLED=false)",
            "timestamp": datetime.now().isoformat()
        }
    
    if not UDS_LOADED or not status_watcher:
        return {
            "status": "error",
            "message": "UDS module failed to load",
            "timestamp": datetime.now().isoformat()
        }
    
    return {
        "status": "ok",
        "watcher": status_watcher.get_stats(),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/admin/watcher/trigger")
async def trigger_watcher():
    """
    Status Watcher 수동 트리거 (관리자용)
    """
    if not UDS_ENABLED:
        return {
            "status": "disabled",
            "message": "UDS is disabled",
            "timestamp": datetime.now().isoformat()
        }
    
    if not UDS_LOADED or not status_watcher:
        return {
            "status": "error",
            "message": "UDS module not loaded",
            "timestamp": datetime.now().isoformat()
        }
    
    try:
        await status_watcher.trigger_check()
        return {
            "status": "ok",
            "message": "Manual check triggered",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().isoformat()
        }


# ============================================
# Main Entry Point (기존 100% 동일)
# ============================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "backend.api.main:app",
        host="0.0.0.0",
        port=int(os.getenv('APP_PORT', 8000)),
        reload=True
    )