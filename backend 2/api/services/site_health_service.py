# backend/api/services/site_health_service.py
"""
site_health_service.py
Site Health Check 서비스 - Phase 1 Multi-Site Connection 기반 확장

이 서비스는 모든 Site의 연결 상태를 관리하고 모니터링합니다.
Graceful Degradation과 Exponential Backoff 재연결을 지원합니다.

@version 1.0.0
@changelog
- v1.0.0: 초기 버전 (2026-02-02)
          - 단일/전체 Site Health Check
          - Graceful Degradation (일부 실패해도 나머지 반환)
          - Exponential Backoff 재연결 (1s → 2s → 4s → ... 최대 30s)
          - ⚠️ 호환성: 신규 서비스로 기존 코드 영향 없음

@dependencies
- asyncio
- backend.api.database.connection_test

📁 위치: backend/api/services/site_health_service.py
작성일: 2026-02-02
수정일: 2026-02-02
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import asyncio
import logging
import time
import os
import json

logger = logging.getLogger(__name__)


# ============================================
# Constants
# ============================================

MAPPING_CONFIG_DIR = "config/site_mappings"
LAYOUT_CONFIG_DIR = "config/layouts"
DATABASES_CONFIG_FILE = "config/databases.json"

# 재연결 설정
DEFAULT_MAX_RETRIES = 10
BASE_DELAY_SECONDS = 1
MAX_DELAY_SECONDS = 30

# Health Check 설정
HEALTH_CHECK_TIMEOUT = 5  # seconds

# Region 매핑
REGION_MAP = {
    "CN": ("China", "🇨🇳"),
    "KR": ("Korea", "🇰🇷"),
    "VN": ("Vietnam", "🇻🇳"),
    "US": ("USA", "🇺🇸"),
    "JP": ("Japan", "🇯🇵"),
}


class SiteHealthService:
    """
    Site Health Check 서비스
    
    모든 Site의 연결 상태를 관리하고 모니터링합니다.
    """
    
    def __init__(self):
        self._connection_manager = None
        self._cached_sites: Dict[str, Dict] = {}
        self._health_cache: Dict[str, Dict] = {}
        self._cache_ttl = 10  # seconds
        self._last_cache_update: Optional[datetime] = None
        
        logger.info("✅ SiteHealthService 초기화")
    
    @property
    def connection_manager(self):
        """ConnectionManager lazy loading"""
        if self._connection_manager is None:
            from ..database.connection_test import get_connection_manager
            self._connection_manager = get_connection_manager()
            logger.info("🔗 ConnectionManager 로드 완료")
        return self._connection_manager
    
    def _load_databases_config(self) -> Dict[str, Any]:
        """databases.json 로드"""
        try:
            if os.path.exists(DATABASES_CONFIG_FILE):
                with open(DATABASES_CONFIG_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            logger.warning(f"⚠️ databases.json 파일 없음: {DATABASES_CONFIG_FILE}")
            return {}
        except Exception as e:
            logger.error(f"❌ databases.json 로드 실패: {e}")
            return {}
    
    def _parse_site_id(self, site_id: str) -> Dict[str, str]:
        """Site ID 파싱"""
        parts = site_id.split("_")
        
        if len(parts) >= 2:
            region = parts[0]
            factory = parts[1]
            process = parts[2] if len(parts) > 2 else "Unknown"
            system = parts[3] if len(parts) > 3 else "Sherlock"
            database = parts[4] if len(parts) > 4 else "SherlockSky"
        else:
            region, factory, process, system, database = "Unknown", site_id, "Unknown", "Unknown", "SherlockSky"
        
        region_name, flag = REGION_MAP.get(region, ("Unknown", "🌍"))
        
        return {
            "region_code": region, "region_name": region_name, "flag_emoji": flag,
            "factory": factory, "process": process, "system": system, "database": database,
            "display_name": f"{flag} {region}_{factory} - {process}"
        }
    
    def _get_mapping_status(self, site_name: str, db_name: str = "SherlockSky") -> Dict[str, Any]:
        """매핑 파일 상태 확인"""
        mapping_file = f"equipment_mapping_{site_name}_{db_name}.json"
        file_path = os.path.join(MAPPING_CONFIG_DIR, mapping_file)
        
        if not os.path.exists(file_path):
            return {"exists": False, "equipment_count": 0, "file_name": mapping_file, "last_updated": None}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            mappings = data.get("mappings", {})
            mtime = os.path.getmtime(file_path)
            return {
                "exists": True, "equipment_count": len(mappings), "file_name": mapping_file,
                "last_updated": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"❌ 매핑 파일 읽기 실패: {file_path} - {e}")
            return {"exists": False, "equipment_count": 0, "file_name": mapping_file, "last_updated": None, "error": str(e)}
    
    def _get_layout_status(self, site_name: str, db_name: str = "SherlockSky") -> Dict[str, Any]:
        """Layout 파일 상태 확인"""
        layout_file = f"{site_name}_{db_name}_layout.json"
        file_path = os.path.join(LAYOUT_CONFIG_DIR, layout_file)
        
        if not os.path.exists(file_path):
            # 대안 파일명 시도
            alt_layout_file = f"{site_name}_layout.json"
            alt_file_path = os.path.join(LAYOUT_CONFIG_DIR, alt_layout_file)
            
            if os.path.exists(alt_file_path):
                return {
                    "exists": True, "file_name": alt_layout_file,
                    "last_updated": datetime.fromtimestamp(os.path.getmtime(alt_file_path), tz=timezone.utc).isoformat()
                }
            return {"exists": False, "file_name": layout_file}
        
        return {
            "exists": True, "file_name": layout_file,
            "last_updated": datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc).isoformat()
        }
    
    def get_all_configured_sites(self) -> List[str]:
        """설정된 모든 Site ID 목록 반환"""
        databases = self._load_databases_config()
        return list(databases.keys())
    
    async def _test_db_connection(self, site_name: str, db_name: str) -> Dict[str, Any]:
        """
        DB 연결 테스트 (비동기)
        
        Args:
            site_name: Site 이름 (예: CN_AAAA_Cutting_Sherlock)
            db_name: DB 이름 (예: SherlockSky)
        
        Returns:
            {success: bool, response_time_ms: int, error: str|None}
        """
        start_time = time.time()
        
        try:
            result = self.connection_manager.test_single_connection(site_name, db_name)
            end_time = time.time()
            response_time = int((end_time - start_time) * 1000)
            
            return {
                "success": result.get("success", False),
                "response_time_ms": response_time,
                "error": result.get("error") if not result.get("success") else None
            }
        except asyncio.TimeoutError:
            logger.warning(f"⚠️ 연결 타임아웃: {site_name}/{db_name}")
            return {"success": False, "response_time_ms": HEALTH_CHECK_TIMEOUT * 1000, "error": "Connection timeout"}
        except Exception as e:
            end_time = time.time()
            logger.error(f"❌ 연결 테스트 실패: {site_name}/{db_name} - {e}")
            return {"success": False, "response_time_ms": int((end_time - start_time) * 1000), "error": str(e)}
    
    async def check_single_site_health(self, site_id: str) -> Optional[Dict[str, Any]]:
        """
        단일 Site Health Check
        
        Args:
            site_id: Site ID (예: CN_AAAA_Cutting_Sherlock_SherlockSky)
        
        Returns:
            {site_id, display_name, status, db_connected, last_check, ...}
        """
        databases = self._load_databases_config()
        
        # Site 찾기
        matched_site = None
        matched_db = None
        
        for site_name in databases.keys():
            if site_id == site_name:
                matched_site = site_name
                matched_db = "SherlockSky"
                break
            elif site_id.startswith(site_name):
                matched_site = site_name
                remainder = site_id[len(site_name):].strip("_")
                matched_db = remainder if remainder else "SherlockSky"
                break
        
        if matched_site is None:
            logger.warning(f"⚠️ Site not found in config: {site_id}")
            return None
        
        # Site 정보 파싱
        parsed = self._parse_site_id(matched_site)
        
        # DB 연결 테스트
        db_result = await self._test_db_connection(matched_site, matched_db)
        
        # 매핑/Layout 상태 확인
        mapping_status = self._get_mapping_status(matched_site, matched_db)
        layout_status = self._get_layout_status(matched_site, matched_db)
        
        # 상태 결정
        status = "healthy" if db_result["success"] else "unhealthy"
        
        logger.info(f"📡 Health Check: {site_id} → {status} ({db_result['response_time_ms']}ms)")
        
        return {
            "site_id": site_id,
            "display_name": parsed["display_name"],
            "status": status,
            "db_connected": db_result["success"],
            "last_check": datetime.now(timezone.utc).isoformat(),
            "response_time_ms": db_result["response_time_ms"],
            "error_message": db_result["error"],
            "has_layout": layout_status["exists"],
            "has_mapping": mapping_status["exists"],
            "equipment_count": mapping_status.get("equipment_count", 0),
            "process": parsed["process"],
            "region": parsed["region_code"]
        }
    
    async def check_all_sites_health(self) -> Dict[str, Any]:
        """
        전체 Site Health Check (Graceful Degradation)
        
        모든 Site에 대해 병렬로 Health Check를 수행합니다.
        일부 Site가 실패해도 나머지 결과는 정상 반환됩니다.
        """
        databases = self._load_databases_config()
        site_ids = list(databases.keys())
        
        results = {
            "total_sites": len(site_ids),
            "healthy_count": 0,
            "unhealthy_count": 0,
            "connecting_count": 0,
            "sites": [],
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        # 병렬로 Health Check 수행
        tasks = [self.check_single_site_health(site_id) for site_id in site_ids]
        site_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for site_id, result in zip(site_ids, site_results):
            if isinstance(result, Exception):
                # 예외 발생한 경우
                parsed = self._parse_site_id(site_id)
                results["sites"].append({
                    "site_id": site_id, "display_name": parsed["display_name"],
                    "status": "unhealthy", "db_connected": False,
                    "last_check": datetime.now(timezone.utc).isoformat(),
                    "response_time_ms": None, "error_message": str(result),
                    "has_layout": False, "has_mapping": False, "equipment_count": 0,
                    "process": parsed["process"], "region": parsed["region_code"]
                })
                results["unhealthy_count"] += 1
                logger.error(f"❌ Health Check 예외: {site_id} - {result}")
            elif result is None:
                logger.warning(f"⚠️ Site not found: {site_id}")
                continue
            else:
                results["sites"].append(result)
                if result.get("status") == "healthy":
                    results["healthy_count"] += 1
                elif result.get("status") == "connecting":
                    results["connecting_count"] += 1
                else:
                    results["unhealthy_count"] += 1
        
        logger.info(f"📊 전체 Health Check 완료: Total={results['total_sites']}, Healthy={results['healthy_count']}, Unhealthy={results['unhealthy_count']}")
        return results
    
    async def reconnect_with_backoff(self, site_id: str, max_retries: int = DEFAULT_MAX_RETRIES) -> Dict[str, Any]:
        """
        Exponential Backoff으로 재연결
        
        재시도 간격: 1초 → 2초 → 4초 → ... → 최대 30초
        
        Args:
            site_id: Site ID
            max_retries: 최대 재시도 횟수 (기본 10회)
        """
        databases = self._load_databases_config()
        
        # Site 찾기
        matched_site = None
        matched_db = "SherlockSky"
        
        for site_name in databases.keys():
            if site_id == site_name or site_id.startswith(site_name):
                matched_site = site_name
                break
        
        if matched_site is None:
            logger.warning(f"⚠️ Site not found: {site_id}")
            return {"success": False, "message": f"Site not found: {site_id}", "attempts": 0, "final_status": "unknown"}
        
        logger.info(f"🔄 재연결 시작: {site_id} (최대 {max_retries}회)")
        
        for attempt in range(1, max_retries + 1):
            try:
                result = await self._test_db_connection(matched_site, matched_db)
                
                if result["success"]:
                    logger.info(f"✅ 재연결 성공: {site_id} (시도 {attempt}/{max_retries})")
                    return {"success": True, "message": f"Reconnected after {attempt} attempt(s)", "attempts": attempt, "final_status": "healthy"}
                    
            except Exception as e:
                logger.warning(f"⚠️ 재연결 시도 {attempt} 실패: {e}")
            
            # Exponential Backoff 대기
            if attempt < max_retries:
                delay = min(BASE_DELAY_SECONDS * (2 ** (attempt - 1)), MAX_DELAY_SECONDS)
                logger.info(f"⏳ {delay}초 후 재시도... ({attempt}/{max_retries})")
                await asyncio.sleep(delay)
        
        logger.error(f"❌ 재연결 실패: {site_id} ({max_retries}회 시도)")
        return {"success": False, "message": f"Failed to reconnect after {max_retries} attempts", "attempts": max_retries, "final_status": "unhealthy"}
    
    async def start_background_health_check(self, interval: int = 30):
        """백그라운드 Health Check 시작"""
        logger.info(f"🔄 백그라운드 Health Check 시작 ({interval}초 간격)")
        
        while True:
            try:
                results = await self.check_all_sites_health()
                self._health_cache = {site["site_id"]: site for site in results["sites"]}
                self._last_cache_update = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"❌ 백그라운드 Health Check 실패: {e}")
            
            await asyncio.sleep(interval)
    
    def get_cached_health(self, site_id: str) -> Optional[Dict[str, Any]]:
        """캐시된 Health 정보 반환"""
        return self._health_cache.get(site_id)


# ============================================
# Singleton Instance
# ============================================

_service_instance: Optional[SiteHealthService] = None


def get_site_health_service() -> SiteHealthService:
    """SiteHealthService 싱글톤 반환"""
    global _service_instance
    if _service_instance is None:
        _service_instance = SiteHealthService()
    return _service_instance