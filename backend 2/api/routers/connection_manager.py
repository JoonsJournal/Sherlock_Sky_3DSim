"""
connection_manager.py
연결 관리 API Router - databases.json 기반 연결 테스트 및 프로필 관리

@version 1.1.0
@changelog
- v1.1.0: 🆕 Mapping Status 기능 추가 (2026-01-29)
          - get_mapping_status() 함수 추가
          - GET /sites 응답에 mapping 필드 추가
          - 각 site/database별 매핑 상태 (ready/missing/invalid) 반환
          - ⚠️ 호환성: 기존 모든 API 100% 유지
- v1.0.0: 초기 버전
          - databases.json 기반 연결 테스트
          - connection_profiles.json 기반 프로필 관리
          - Frontend UI용 신규 엔드포인트 추가

@dependencies
- fastapi
- pydantic
- database/connection_test.py

📁 위치: backend/api/routers/connection_manager.py
작성일: 2026-01-20
수정일: 2026-01-29
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timezone
import time
import os    # 🆕 v1.1.0: Mapping Status용
import json  # 🆕 v1.1.0: Mapping Status용

from ..database.connection_test import get_connection_manager

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================
# 🆕 v1.1.0: Mapping 관련 상수
# ============================================
MAPPING_CONFIG_DIR = "config/site_mappings"


class TestConnectionRequest(BaseModel):
    """단일 연결 테스트 요청"""
    site_name: str
    db_name: str


class TestProfileRequest(BaseModel):
    """프로필 테스트 요청"""
    profile_name: str

# 기존 import 유지하고 다음 엔드포인트 추가

class GetTablesRequest(BaseModel):
    """테이블 목록 조회 요청"""
    site_name: str
    db_name: str

# ========================================
# 새로운 모델 (Frontend UI용)
# ========================================

class HealthCheckResponse(BaseModel):
    """API 헬스체크 응답"""
    status: str = Field(..., description="healthy|unhealthy")
    api_url: str
    response_time_ms: int
    last_check: str
    version: str = "1.1.0"  # 🔧 v1.1.0: 버전 업데이트


class SiteProfile(BaseModel):
    """사이트 프로필 정보 (Frontend용)"""
    id: str = Field(..., description="Site ID (예: korea_site1_line1)")
    display_name: str = Field(..., description="표시 이름")
    site_name: str
    db_name: str
    region: str = "Korea"
    is_active: bool = True
    priority: int = 1


class ConnectionStatusDetail(BaseModel):
    """개별 연결 상태 (Frontend용)"""
    site_id: str
    display_name: str
    site_name: str
    db_name: str
    status: str = Field(..., description="disconnected|connecting|connected|failed")
    last_connected: Optional[str] = None
    error_message: Optional[str] = None
    response_time_ms: Optional[int] = None


class SingleConnectionRequest(BaseModel):
    """단일 연결 요청 (Frontend용)"""
    site_id: str
    timeout_seconds: int = Field(default=30, ge=5, le=120)


class ConnectionResponse(BaseModel):
    """연결 응답"""
    success: bool
    message: str
    site_id: str
    site_name: str
    db_name: str
    connected_at: Optional[str] = None
    error: Optional[str] = None


class TableInfo(BaseModel):
    """테이블 정보"""
    name: str
    schema: Optional[str] = None
    type: Optional[str] = None
    row_count: Optional[int] = None
    size_mb: Optional[float] = None


class DatabaseInfo(BaseModel):
    """데이터베이스 상세 정보"""
    site_id: str
    site_name: str
    db_name: str
    tables: List[TableInfo]
    total_tables: int
    db_type: str


# ============================================
# 🆕 v1.1.0: Mapping Status 모델
# ============================================

class MappingStatus(BaseModel):
    """매핑 상태 정보"""
    status: str = Field(..., description="ready|missing|invalid")
    equipment_count: int = 0
    file_name: Optional[str] = None
    last_updated: Optional[str] = None
    error: Optional[str] = None


# ========================================
# 전역 상태 (연결된 사이트 추적)
# ========================================
_connected_sites: Dict[str, Dict[str, Any]] = {}


# ============================================
# 🆕 v1.1.0: Mapping Status 헬퍼 함수
# ============================================

def get_mapping_status(site_name: str, db_name: str) -> Dict[str, Any]:
    """
    🆕 v1.1.0: 특정 Site/DB의 매핑 상태 조회
    
    Args:
        site_name: 사이트 이름 (예: korea_site1)
        db_name: DB 이름 (예: line1)
        
    Returns:
        {
            "status": "ready|missing|invalid",
            "equipment_count": 117,
            "file_name": "equipment_mapping_korea_site1_line1.json",
            "last_updated": "2026-01-29T...",
            "error": null
        }
        
    Note:
        - ready: 매핑 파일 존재 + 유효
        - missing: 매핑 파일 없음
        - invalid: 매핑 파일 존재하나 파싱 실패
    """
    # Site ID 생성 (equipment_mapping_v2.py와 동일한 형식)
    site_id = f"{site_name}_{db_name}"
    mapping_file = f"equipment_mapping_{site_id}.json"
    file_path = os.path.join(MAPPING_CONFIG_DIR, mapping_file)
    
    # 파일 존재 여부 확인
    if not os.path.exists(file_path):
        logger.debug(f"⚠️ Mapping file not found: {file_path}")
        return {
            "status": "missing",
            "equipment_count": 0,
            "file_name": mapping_file,
            "last_updated": None,
            "error": None
        }
    
    # 파일 파싱 시도
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        mappings = data.get("mappings", {})
        equipment_count = len(mappings)
        
        # 파일 수정 시간
        mtime = os.path.getmtime(file_path)
        last_updated = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        
        logger.debug(f"✅ Mapping ready: {site_id} ({equipment_count} items)")
        
        return {
            "status": "ready",
            "equipment_count": equipment_count,
            "file_name": mapping_file,
            "last_updated": last_updated,
            "error": None
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in mapping file: {file_path} - {e}")
        return {
            "status": "invalid",
            "equipment_count": 0,
            "file_name": mapping_file,
            "last_updated": None,
            "error": f"JSON parse error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"❌ Failed to read mapping file: {file_path} - {e}")
        return {
            "status": "invalid",
            "equipment_count": 0,
            "file_name": mapping_file,
            "last_updated": None,
            "error": str(e)
        }


@router.post("/get-tables")
async def get_table_list(request: GetTablesRequest):
    """
    특정 데이터베이스의 테이블 목록 조회
    
    Body:
        {
            "site_name": "korea_site1",
            "db_name": "line1"
        }
    
    Returns:
        {
            "success": true,
            "message": "15개 테이블 조회 성공",
            "total_tables": 15,
            "tables": [
                {
                    "schema": "dbo",
                    "name": "Equipment",
                    "type": "BASE TABLE",
                    "full_name": "dbo.Equipment"
                },
                ...
            ],
            "site_name": "korea_site1",
            "db_name": "line1",
            "db_type": "mssql"
        }
    """
    try:
        manager = get_connection_manager()
        result = manager.get_table_list(
            request.site_name,
            request.db_name
        )
        return result
    except Exception as e:
        logger.error(f"❌ 테이블 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    


@router.get(
    "/sites",
    summary="모든 사이트 조회",
    description="databases.json 기반 사이트 목록 + 매핑 상태 반환"
)
async def get_all_sites():
    """
    모든 사이트 조회
    
    🆕 v1.1.0: 각 site/database별 mapping 상태 추가
    
    Returns:
        {
            "sites": [
                {
                    "name": "korea_site1",
                    "host": "192.168.1.100",
                    "databases": ["line1", "line2", "quality"],
                    "mapping": {
                        "line1": {
                            "status": "ready",
                            "equipment_count": 117,
                            "file_name": "equipment_mapping_korea_site1_line1.json",
                            "last_updated": "2026-01-29T...",
                            "error": null
                        },
                        "line2": {
                            "status": "missing",
                            "equipment_count": 0,
                            ...
                        }
                    }
                }
            ]
        }
    """
    try:
        manager = get_connection_manager()
        sites_data = manager.get_all_sites()
        
        # ===================================================================
        # 🆕 v1.1.0: 각 site의 각 database에 대해 mapping 상태 추가
        # ===================================================================
        for site in sites_data.get('sites', []):
            site_name = site.get('name', '')
            mapping_status = {}
            
            for db_name in site.get('databases', []):
                mapping_status[db_name] = get_mapping_status(site_name, db_name)
            
            # mapping 필드 추가
            site['mapping'] = mapping_status
        
        return sites_data
        
    except Exception as e:
        logger.error(f"❌ 사이트 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profiles")
async def get_all_profiles():
    """
    모든 프로필 조회
    
    Returns:
        {
            "profiles": [...],
            "default_profile": "korea_only"
        }
    """
    try:
        manager = get_connection_manager()
        return manager.get_all_profiles()
    except Exception as e:
        logger.error(f"❌ 프로필 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-connection")
async def test_connection(request: TestConnectionRequest):
    """
    단일 연결 테스트
    
    Body:
        {
            "site_name": "korea_site1",
            "db_name": "line1"
        }
    """
    try:
        manager = get_connection_manager()
        result = manager.test_single_connection(
            request.site_name,
            request.db_name
        )
        return result
    except Exception as e:
        logger.error(f"❌ 연결 테스트 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-profile")
async def test_profile(request: TestProfileRequest):
    """
    프로필의 모든 연결 테스트
    
    Body:
        {
            "profile_name": "korea_only"
        }
    """
    try:
        manager = get_connection_manager()
        result = manager.test_profile(request.profile_name)
        return result
    except Exception as e:
        logger.error(f"❌ 프로필 테스트 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-all")
async def test_all_connections():
    """
    모든 사이트의 모든 데이터베이스 테스트
    """
    try:
        manager = get_connection_manager()
        result = manager.test_all_sites()
        return result
    except Exception as e:
        logger.error(f"❌ 전체 테스트 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_status():
    """현재 상태 조회"""
    try:
        manager = get_connection_manager()
        sites = manager.get_all_sites()
        profiles = manager.get_all_profiles()
        
        return {
            'total_sites': len(sites['sites']),
            'total_profiles': len(profiles['profiles']),
            'default_profile': profiles.get('default_profile', ''),
            'status': 'ready'
        }
    except Exception as e:
        logger.error(f"❌ 상태 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
# ========================================
# 새로운 엔드포인트 (Frontend UI용)
# 명확히 구분되는 이름 사용!
# ========================================

@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """API 헬스체크"""
    import time
    start_time = time.time()
    
    try:
        manager = get_connection_manager()
        # Manager 타입에 관계없이 동작
        sites = manager.get_all_sites()
        status = "healthy" if sites else "unhealthy"
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        status = "unhealthy"
    
    end_time = time.time()
    response_time = int((end_time - start_time) * 1000)
    
    return HealthCheckResponse(
        status=status,
        api_url="http://localhost:8008",
        response_time_ms=response_time,
        last_check=datetime.now(timezone.utc).isoformat(),
        version="1.1.0"  # 🔧 v1.1.0: 버전 업데이트
    )


@router.get("/site-profiles", response_model=List[SiteProfile])
async def get_site_profiles():
    """
    사이트 기반 프로필 목록 (Frontend용)
    각 site의 각 database를 개별 프로필로 반환
    
    ⚠️ 주의: 기존 /profiles와 다름!
    - /profiles: connection_profiles.json 기반
    - /site-profiles: databases.json의 sites 기반
    
    Returns:
        [
            {
                "id": "korea_site1_line1",
                "display_name": "🇰🇷 Korea Site1 - LINE1",
                "site_name": "korea_site1",
                "db_name": "line1",
                "region": "Korea",
                "is_active": true,
                "priority": 1
            },
            ...
        ]
    """
    try:
        manager = get_connection_manager()
        sites_data = manager.get_all_sites()
        
        profiles = []
        for site in sites_data.get('sites', []):
            site_name = site['name']
            region = "Korea" if "korea" in site_name.lower() else "Unknown"
            emoji = "🇰🇷" if "korea" in site_name.lower() else "🌍"
            
            for db_name in site.get('databases', []):
                profile = SiteProfile(
                    id=f"{site_name}_{db_name}",
                    display_name=f"{emoji} {site_name.replace('_', ' ').title()} - {db_name.upper()}",
                    site_name=site_name,
                    db_name=db_name,
                    region=region,
                    is_active=True,
                    priority=1
                )
                profiles.append(profile)
        
        return profiles
    
    except Exception as e:
        logger.error(f"❌ 사이트 프로필 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connection-status", response_model=List[ConnectionStatusDetail])
async def get_connection_status():
    """
    현재 모든 연결의 상태 조회 (Frontend용)
    
    ⚠️ 주의: 기존 /status와 다름!
    - /status: 전체 시스템 상태 (총 사이트 수, 프로필 수 등)
    - /connection-status: 각 사이트/DB의 연결 상태 상세 정보
    
    Returns:
        [
            {
                "site_id": "korea_site1_line1",
                "display_name": "🇰🇷 Korea Site1 - LINE1",
                "site_name": "korea_site1",
                "db_name": "line1",
                "status": "connected",
                "last_connected": "2024-12-23T...",
                "error_message": null,
                "response_time_ms": 45
            },
            ...
        ]
    """
    try:
        manager = get_connection_manager()
        sites_data = manager.get_all_sites()
        
        status_list = []
        for site in sites_data.get('sites', []):
            site_name = site['name']
            emoji = "🇰🇷" if "korea" in site_name.lower() else "🌍"
            
            for db_name in site.get('databases', []):
                site_id = f"{site_name}_{db_name}"
                
                # 연결된 사이트인지 확인
                is_connected = site_id in _connected_sites
                
                status_detail = ConnectionStatusDetail(
                    site_id=site_id,
                    display_name=f"{emoji} {site_name.replace('_', ' ').title()} - {db_name.upper()}",
                    site_name=site_name,
                    db_name=db_name,
                    status="connected" if is_connected else "disconnected",
                    last_connected=_connected_sites.get(site_id, {}).get('connected_at'),
                    error_message=None,
                    response_time_ms=_connected_sites.get(site_id, {}).get('response_time_ms')
                )
                
                status_list.append(status_detail)
        
        return status_list
    
    except Exception as e:
        logger.error(f"❌ 연결 상태 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/connect", response_model=ConnectionResponse)
async def connect_to_site(request: SingleConnectionRequest):
    """
    단일 사이트/데이터베이스 연결 (Frontend용)
    Single Site만 지원
    
    Body:
        {
            "site_id": "korea_site1_line1",
            "timeout_seconds": 30
        }
    
    Returns:
        {
            "success": true,
            "message": "Connected to korea_site1 - line1",
            "site_id": "korea_site1_line1",
            "site_name": "korea_site1",
            "db_name": "line1",
            "connected_at": "2024-12-23T...",
            "error": null
        }
    """
    import time
    start_time = time.time()
    
    try:
        # site_id에서 site_name과 db_name 추출
        parts = request.site_id.split('_')
        if len(parts) < 3:  # korea_site1_line1 형태
            raise HTTPException(
                status_code=400,
                detail="Invalid site_id format. Expected: {site_name}_{db_name}"
            )
        
        # 마지막 부분이 db_name
        db_name = parts[-1]
        # 나머지가 site_name
        site_name = '_'.join(parts[:-1])
        
        logger.info(f"📡 연결 시도: site={site_name}, db={db_name}")
        
        # ConnectionManager를 통해 연결 테스트
        manager = get_connection_manager()
        result = manager.test_single_connection(site_name, db_name)
        
        end_time = time.time()
        response_time = int((end_time - start_time) * 1000)
        
        if result.get('success'):
            # 연결 성공 - 전역 상태에 저장
            connected_at = datetime.now(timezone.utc).isoformat()
            _connected_sites[request.site_id] = {
                'site_name': site_name,
                'db_name': db_name,
                'connected_at': connected_at,
                'response_time_ms': response_time
            }
            
            logger.info(f"✅ 연결 성공: {request.site_id}")
            
            # ✅ 추가: Status Watcher에 연결 정보 전달
            try:
                from ..services.uds.status_watcher import status_watcher
                status_watcher.set_connection(site_name, db_name)
                logger.info(f"✅ Status Watcher 연결 설정: {site_name}_{db_name}")
            except ImportError:
                logger.debug("UDS 모듈이 비활성화되어 있습니다")
            except Exception as e:
                logger.warning(f"⚠️ Status Watcher 연결 설정 실패: {e}")
            
            return ConnectionResponse(
                success=True,
                message=f"Connected to {site_name} - {db_name}",
                site_id=request.site_id,
                site_name=site_name,
                db_name=db_name,
                connected_at=connected_at,
                error=None
            )
        else:
            # 연결 실패
            error_msg = result.get('error', 'Connection failed')
            logger.error(f"❌ 연결 실패: {request.site_id} - {error_msg}")
            
            return ConnectionResponse(
                success=False,
                message=f"Failed to connect to {site_name} - {db_name}",
                site_id=request.site_id,
                site_name=site_name,
                db_name=db_name,
                connected_at=None,
                error=error_msg
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 연결 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect/{site_id}")
async def disconnect_from_site(site_id: str):
    """
    특정 사이트 연결 해제 (Frontend용)
    
    Path Parameter:
        site_id: 연결 해제할 사이트 ID (예: korea_site1_line1)
    
    Returns:
        {
            "success": true,
            "message": "Disconnected from korea_site1 - line1",
            "site_id": "korea_site1_line1"
        }
    """
    try:
        if site_id in _connected_sites:
            site_info = _connected_sites[site_id]
            del _connected_sites[site_id]
            logger.info(f"🔌 연결 해제: {site_id}")
            
            return {
                "success": True,
                "message": f"Disconnected from {site_info['site_name']} - {site_info['db_name']}",
                "site_id": site_id
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Site {site_id} is not connected"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 연결 해제 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/database-info/{site_id}", response_model=DatabaseInfo)
async def get_database_info(site_id: str):
    """
    연결된 데이터베이스의 상세 정보 조회 (Frontend용)
    
    Path Parameter:
        site_id: 조회할 사이트 ID (예: korea_site1_line1)
    
    Returns:
        {
            "site_id": "korea_site1_line1",
            "site_name": "korea_site1",
            "db_name": "line1",
            "tables": [
                {
                    "name": "Equipment",
                    "schema": "dbo",
                    "type": "BASE TABLE",
                    "row_count": null,
                    "size_mb": null
                },
                ...
            ],
            "total_tables": 15,
            "db_type": "mssql"
        }
    """
    try:
        # 연결되어 있는지 확인
        if site_id not in _connected_sites:
            raise HTTPException(
                status_code=400,
                detail=f"Site {site_id} is not connected. Please connect first."
            )
        
        site_info = _connected_sites[site_id]
        site_name = site_info['site_name']
        db_name = site_info['db_name']
        
        # 테이블 목록 가져오기
        manager = get_connection_manager()
        tables_result = manager.get_table_list(site_name, db_name)
        
        if not tables_result.get('success'):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get table list: {tables_result.get('message')}"
            )
        
        # TableInfo 형식으로 변환
        tables = []
        for table in tables_result.get('tables', []):
            table_info = TableInfo(
                name=table.get('name', ''),
                schema=table.get('schema'),
                type=table.get('type'),
                row_count=None,  # TODO: 향후 구현
                size_mb=None     # TODO: 향후 구현
            )
            tables.append(table_info)
        
        return DatabaseInfo(
            site_id=site_id,
            site_name=site_name,
            db_name=db_name,
            tables=tables,
            total_tables=tables_result.get('total_tables', len(tables)),
            db_type=tables_result.get('db_type', 'unknown')
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 데이터베이스 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))