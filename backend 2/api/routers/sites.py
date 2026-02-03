# backend/api/routers/sites.py
"""
sites.py
Site 관리 전용 API Router - Phase 1 Multi-Site Connection 기반 확장

@version 1.0.0
@changelog
- v1.0.0: 초기 버전 (2026-02-02)
          - Site Health Check API (단일/전체)
          - Graceful Degradation 지원
          - 자동 재연결 (Exponential Backoff)
          - ⚠️ 호환성: 신규 Router로 기존 코드 영향 없음

@dependencies
- fastapi
- pydantic
- backend.api.database.connection_test
- backend.api.services.site_health_service

📁 위치: backend/api/routers/sites.py
작성일: 2026-02-02
수정일: 2026-02-02
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from enum import Enum
import asyncio
import logging
import time
import os
import json

# 상대 경로 import
from ..database.connection_test import get_connection_manager
from ..services.site_health_service import SiteHealthService

router = APIRouter(prefix="/api/sites", tags=["sites"])
logger = logging.getLogger(__name__)


# ============================================
# Enums
# ============================================

class SiteStatus(str, Enum):
    """Site 연결 상태"""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    CONNECTING = "connecting"
    UNKNOWN = "unknown"
    DISCONNECTED = "disconnected"


class ReadinessStatus(str, Enum):
    """Site 준비 상태"""
    READY = "ready"
    SETUP_REQUIRED = "setup_required"
    ERROR = "error"


# ============================================
# Request/Response Models
# ============================================

class SiteHealthStatus(BaseModel):
    """Site 상태 정보"""
    site_id: str = Field(..., description="Site 고유 ID")
    display_name: str = Field(..., description="표시 이름")
    status: SiteStatus = Field(..., description="연결 상태")
    readiness: ReadinessStatus = Field(default=ReadinessStatus.SETUP_REQUIRED)
    db_connected: bool = False
    last_check: str = Field(..., description="마지막 체크 시간 (ISO)")
    response_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    has_layout: bool = False
    has_mapping: bool = False
    equipment_count: int = 0
    process: Optional[str] = None
    region: Optional[str] = None


class SiteStats(BaseModel):
    """Site 설비 통계 (Dashboard용)"""
    total: int = 0
    run: int = 0
    idle: int = 0
    stop: int = 0
    disc: int = 0
    production: int = 0
    alarms: int = 0


class SiteDetailResponse(BaseModel):
    """Site 상세 정보"""
    site_id: str
    display_name: str
    status: SiteStatus
    readiness: ReadinessStatus
    health: SiteHealthStatus
    stats: Optional[SiteStats] = None
    config: Dict[str, Any] = {}


class AllSitesHealthResponse(BaseModel):
    """전체 Site 상태 응답"""
    total_sites: int
    healthy_count: int
    unhealthy_count: int
    connecting_count: int
    sites: List[SiteHealthStatus]
    last_updated: str


class ReconnectRequest(BaseModel):
    """재연결 요청"""
    max_retries: int = Field(default=5, ge=1, le=20, description="최대 재시도 횟수")
    force: bool = Field(default=False, description="강제 재연결 여부")


class ReconnectResponse(BaseModel):
    """재연결 응답"""
    success: bool
    site_id: str
    message: str
    attempts: int = 0
    final_status: SiteStatus


class SiteSummaryResponse(BaseModel):
    """Site 요약 정보 (Dashboard 카드용)"""
    site_id: str
    display_name: str
    flag_emoji: str
    process: str
    status: SiteStatus
    readiness: ReadinessStatus
    stats: SiteStats
    has_layout: bool
    has_mapping: bool
    last_updated: str


# ============================================
# Constants
# ============================================

MAPPING_CONFIG_DIR = "config/site_mappings"
LAYOUT_CONFIG_DIR = "config/layouts"

REGION_MAP = {
    "CN": ("China", "🇨🇳"),
    "KR": ("Korea", "🇰🇷"),
    "VN": ("Vietnam", "🇻🇳"),
    "US": ("USA", "🇺🇸"),
    "JP": ("Japan", "🇯🇵"),
}


# ============================================
# Helper Functions
# ============================================

def parse_site_id(site_id: str) -> Dict[str, str]:
    """
    Site ID 파싱
    
    예: CN_AAAA_Cutting_Sherlock_SherlockSky
    → {region: CN, factory: AAAA, process: Cutting, ...}
    """
    parts = site_id.split("_")
    
    if len(parts) >= 4:
        region = parts[0]
        factory = parts[1]
        process = parts[2] if len(parts) > 2 else "Unknown"
        system = parts[3] if len(parts) > 3 else "Unknown"
        database = parts[4] if len(parts) > 4 else "SherlockSky"
    else:
        region, factory, process, system, database = "Unknown", site_id, "Unknown", "Unknown", "SherlockSky"
    
    region_name, flag = REGION_MAP.get(region, ("Unknown", "🌍"))
    
    return {
        "region_code": region, "region_name": region_name, "flag_emoji": flag,
        "factory": factory, "process": process, "system": system, "database": database,
        "display_name": f"{flag} {region}_{factory} - {process}"
    }


def get_mapping_status(site_name: str, db_name: str) -> Dict[str, Any]:
    """Site의 매핑 파일 상태 확인"""
    mapping_file = f"equipment_mapping_{site_name}_{db_name}.json"
    file_path = os.path.join(MAPPING_CONFIG_DIR, mapping_file)
    
    if not os.path.exists(file_path):
        return {"exists": False, "equipment_count": 0, "file_name": mapping_file, "last_updated": None, "error": None}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        mappings = data.get("mappings", {})
        mtime = os.path.getmtime(file_path)
        return {
            "exists": True, "equipment_count": len(mappings), "file_name": mapping_file,
            "last_updated": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(), "error": None
        }
    except Exception as e:
        logger.error(f"❌ 매핑 파일 읽기 실패: {file_path} - {e}")
        return {"exists": False, "equipment_count": 0, "file_name": mapping_file, "last_updated": None, "error": str(e)}


def get_layout_status(site_name: str, db_name: str) -> Dict[str, Any]:
    """Site의 Layout 파일 상태 확인"""
    layout_file = f"{site_name}_{db_name}_layout.json"
    file_path = os.path.join(LAYOUT_CONFIG_DIR, layout_file)
    
    if not os.path.exists(file_path):
        return {"exists": False, "file_name": layout_file}
    
    return {
        "exists": True, "file_name": layout_file,
        "last_updated": datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc).isoformat()
    }


# ============================================
# Health Check Service Instance
# ============================================

_health_service: Optional[SiteHealthService] = None

def get_health_service() -> SiteHealthService:
    """Health Service 싱글톤"""
    global _health_service
    if _health_service is None:
        _health_service = SiteHealthService()
        logger.info("✅ SiteHealthService 인스턴스 생성")
    return _health_service


# ============================================
# API Endpoints
# ============================================

@router.get("", summary="전체 Site 목록 조회", response_model=Dict[str, Any])
async def get_all_sites():
    """
    등록된 모든 Site 목록 반환
    
    databases.json 기반으로 Site 목록과 기본 정보 반환
    """
    try:
        manager = get_connection_manager()
        sites_data = manager.get_all_sites()
        
        enhanced_sites = []
        for site in sites_data.get('sites', []):
            site_name = site.get('name', '')
            parsed = parse_site_id(site_name)
            
            databases_info = []
            for db_name in site.get('databases', []):
                mapping_status = get_mapping_status(site_name, db_name)
                layout_status = get_layout_status(site_name, db_name)
                databases_info.append({
                    "name": db_name, "site_id": f"{site_name}_{db_name}",
                    "has_mapping": mapping_status["exists"], "has_layout": layout_status["exists"],
                    "equipment_count": mapping_status.get("equipment_count", 0),
                    "mapping_status": mapping_status, "layout_status": layout_status
                })
            
            enhanced_sites.append({**site, **parsed, "databases_info": databases_info})
        
        logger.info(f"📊 Site 목록 조회: {len(enhanced_sites)}개")
        return {"sites": enhanced_sites, "total_count": len(enhanced_sites)}
        
    except Exception as e:
        logger.error(f"❌ Site 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", summary="전체 Site Health Check", response_model=AllSitesHealthResponse)
async def get_all_sites_health():
    """전체 Site Health Check (Graceful Degradation 적용)"""
    try:
        health_service = get_health_service()
        result = await health_service.check_all_sites_health()
        
        logger.info(f"📡 전체 Health Check: {result['healthy_count']}/{result['total_sites']} healthy")
        return AllSitesHealthResponse(
            total_sites=result["total_sites"], healthy_count=result["healthy_count"],
            unhealthy_count=result["unhealthy_count"], connecting_count=result.get("connecting_count", 0),
            sites=[SiteHealthStatus(**site) for site in result["sites"]], last_updated=result["last_updated"]
        )
    except Exception as e:
        logger.error(f"❌ 전체 Health Check 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{site_id}/health", summary="단일 Site Health Check", response_model=SiteHealthStatus)
async def get_site_health(site_id: str):
    """단일 Site Health Check"""
    try:
        health_service = get_health_service()
        result = await health_service.check_single_site_health(site_id)
        
        if result is None:
            logger.warning(f"⚠️ Site not found: {site_id}")
            raise HTTPException(status_code=404, detail=f"Site not found: {site_id}")
        
        logger.info(f"📡 Site Health: {site_id} → {result['status']}")
        return SiteHealthStatus(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Site Health Check 실패: {site_id} - {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{site_id}", summary="Site 상세 정보 조회", response_model=SiteDetailResponse)
async def get_site_detail(site_id: str):
    """Site 상세 정보 조회"""
    try:
        health_service = get_health_service()
        health = await health_service.check_single_site_health(site_id)
        
        if health is None:
            raise HTTPException(status_code=404, detail=f"Site not found: {site_id}")
        
        parsed = parse_site_id(site_id)
        
        # Readiness 판단
        readiness = ReadinessStatus.SETUP_REQUIRED
        if health.get("has_layout") and health.get("has_mapping"):
            readiness = ReadinessStatus.READY if health.get("status") == "healthy" else ReadinessStatus.ERROR
        
        return SiteDetailResponse(
            site_id=site_id, display_name=parsed["display_name"],
            status=SiteStatus(health.get("status", "unknown")), readiness=readiness,
            health=SiteHealthStatus(**health), stats=None,
            config={"region": parsed["region_code"], "process": parsed["process"], "system": parsed["system"]}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Site 상세 조회 실패: {site_id} - {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{site_id}/reconnect", summary="Site 재연결", response_model=ReconnectResponse)
async def reconnect_site(site_id: str, request: ReconnectRequest = ReconnectRequest()):
    """Site 재연결 (Exponential Backoff)"""
    try:
        health_service = get_health_service()
        current_health = await health_service.check_single_site_health(site_id)
        
        if current_health is None:
            raise HTTPException(status_code=404, detail=f"Site not found: {site_id}")
        
        # 이미 연결되어 있고 force가 아니면 스킵
        if current_health.get("status") == "healthy" and not request.force:
            logger.info(f"📡 Site 이미 연결됨: {site_id}")
            return ReconnectResponse(
                success=True, site_id=site_id, message="Site is already connected",
                attempts=0, final_status=SiteStatus.HEALTHY
            )
        
        logger.info(f"🔄 Site 재연결 시도: {site_id} (max_retries={request.max_retries})")
        result = await health_service.reconnect_with_backoff(site_id, max_retries=request.max_retries)
        
        return ReconnectResponse(
            success=result["success"], site_id=site_id, message=result["message"],
            attempts=result["attempts"], final_status=SiteStatus(result["final_status"])
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Site 재연결 실패: {site_id} - {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary", summary="Dashboard용 Site 요약", response_model=List[SiteSummaryResponse])
async def get_sites_summary():
    """Dashboard용 Site 요약 정보"""
    try:
        health_service = get_health_service()
        all_health = await health_service.check_all_sites_health()
        
        summaries = []
        for site_health in all_health["sites"]:
            site_id = site_health["site_id"]
            parsed = parse_site_id(site_id)
            
            has_layout = site_health.get("has_layout", False)
            has_mapping = site_health.get("has_mapping", False)
            status = SiteStatus(site_health.get("status", "unknown"))
            
            # Readiness 판단
            if has_layout and has_mapping and status == SiteStatus.HEALTHY:
                readiness = ReadinessStatus.READY
            elif status in [SiteStatus.UNHEALTHY, SiteStatus.DISCONNECTED]:
                readiness = ReadinessStatus.ERROR
            else:
                readiness = ReadinessStatus.SETUP_REQUIRED
            
            summaries.append(SiteSummaryResponse(
                site_id=site_id, display_name=parsed["display_name"], flag_emoji=parsed["flag_emoji"],
                process=parsed["process"], status=status, readiness=readiness,
                stats=SiteStats(total=site_health.get("equipment_count", 0)),
                has_layout=has_layout, has_mapping=has_mapping,
                last_updated=site_health.get("last_check", datetime.now(timezone.utc).isoformat())
            ))
        
        logger.info(f"📊 Site Summary 조회: {len(summaries)}개")
        return summaries
        
    except Exception as e:
        logger.error(f"❌ Site 요약 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))