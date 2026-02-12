"""
Equipment Mapping API v2
Connection Manager와 통합된 Multi-Site 매핑 관리

주요 기능:
- Site별 매핑 Config 파일 관리 (config/site_mappings/)
- 연결된 사이트 자동 감지 및 매핑 로드
- Site ID 형식: {site_name}_{db_name} (예: korea_site1_line1)
"""

# @version 1.1.1
# @changelog
# - v1.1.1: 🐛 MappingItem line_name field_validator 추가 (2026-02-05)
#           - line_name: int → str 자동 변환 (Pydantic validation 오류 해결)
#           - DBEquipmentItem에도 동일 validator 적용
#           - equipment_code에도 방어적 validator 추가
#           - ⚠️ 호환성: 기존 모든 API 100% 유지
# - v1.1.0: 🆕 Mapping Status 신규 API 추가 (2026-01-29)
#           - GET /db-equipments/{site_id}/{db_name} - DB 설비 목록 조회
#           - POST /save-mapping/{site_id}/{db_name} - 매핑 저장 (간소화)
#           - mappingSaved 이벤트용 응답 형식 추가
#           - ⚠️ 호환성: 기존 모든 API 100% 유지
# - v1.0.0: 초기 버전 (Multi-Site 매핑 관리)
#
# 📁 위치: backend/api/routers/equipment_mapping_v2.py
# 수정일: 2026-02-05

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, field_validator
import logging
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mapping", tags=["Equipment Mapping V2"])


# ============================================
# Constants
# ============================================

# 매핑 Config 파일 디렉토리
MAPPING_CONFIG_DIR = "config/site_mappings"


# ============================================
# Pydantic Models
# ============================================

class MappingItem(BaseModel):
    """개별 매핑 항목"""
    frontend_id: str       # 'EQ-01-01'
    equipment_id: int      # DB Equipment ID
    equipment_name: str    # DB Equipment Name
    equipment_code: Optional[str] = None
    line_name: Optional[str] = None

    @field_validator('line_name', mode='before')
    @classmethod
    def coerce_line_name(cls, v):
        """line_name: int → str 자동 변환 (DB에서 int로 올 수 있음)"""
        if v is None:
            return None
        return str(v)

    @field_validator('equipment_code', mode='before')
    @classmethod
    def coerce_equipment_code(cls, v):
        """equipment_code: int → str 방어적 변환"""
        if v is None:
            return None
        return str(v)


class SiteMappingConfig(BaseModel):
    """사이트별 매핑 Config"""
    site_id: str               # korea_site1_line1
    site_name: str             # korea_site1
    db_name: str               # line1
    display_name: str          # 🇰🇷 Korea Site1 - LINE1
    version: str = "1.0.0"
    created_at: str
    updated_at: str
    created_by: str = "admin"
    description: Optional[str] = None
    total_equipments: int = 117
    mappings: Dict[str, MappingItem] = {}  # { "EQ-01-01": {...}, ... }


class SiteMappingInfo(BaseModel):
    """사이트 매핑 정보 요약"""
    site_id: str
    site_name: str
    db_name: str
    display_name: str
    has_mapping: bool = False
    mapping_count: int = 0
    last_updated: Optional[str] = None
    is_connected: bool = False


class MappingUpdateRequest(BaseModel):
    """매핑 업데이트 요청"""
    mappings: List[MappingItem]
    created_by: Optional[str] = "admin"
    description: Optional[str] = None


class ValidationResult(BaseModel):
    """유효성 검증 결과"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    duplicates: Dict[int, List[str]] = {}
    missing: List[str] = []

class DBEquipmentItem(BaseModel):
    """DB에서 조회한 설비 항목"""
    equipment_id: int
    equipment_name: str
    line_name: Optional[str] = None
    equipment_code: Optional[str] = None

    @field_validator('line_name', mode='before')
    @classmethod
    def coerce_line_name(cls, v):
        """line_name: int → str 자동 변환"""
        if v is None:
            return None
        return str(v)

    @field_validator('equipment_code', mode='before')
    @classmethod
    def coerce_equipment_code(cls, v):
        """equipment_code: int → str 방어적 변환"""
        if v is None:
            return None
        return str(v)


class DBEquipmentsResponse(BaseModel):
    """DB 설비 목록 응답"""
    success: bool
    site_id: str
    site_name: str
    db_name: str
    total_count: int
    equipments: List[DBEquipmentItem]
    message: Optional[str] = None


class SimpleMappingRequest(BaseModel):
    """간단한 매핑 저장 요청 (Frontend용)"""
    mappings: Dict[str, Dict[str, Any]]  # { "EQ-01-01": { "equipment_id": 1, ... }, ... }
    created_by: Optional[str] = "admin"
    description: Optional[str] = None


class MappingSavedResponse(BaseModel):
    """매핑 저장 응답 (Frontend mappingSaved 이벤트용)"""
    success: bool
    message: str
    site_id: str
    site_name: str
    db_name: str
    total_mappings: int
    updated_at: str
    # Frontend에서 mappingSaved 이벤트에 필요한 필드
    mapping_status: str = "ready"  # ready|missing|invalid


# ============================================
# Helper Functions
# ============================================

def ensure_config_dir():
    """Config 디렉토리 생성"""
    os.makedirs(MAPPING_CONFIG_DIR, exist_ok=True)


def get_mapping_file_path(site_id: str) -> str:
    """
    사이트별 매핑 파일 경로
    
    Args:
        site_id: korea_site1_line1 형식
    
    Returns:
        config/site_mappings/equipment_mapping_korea_site1_line1.json
    """
    return os.path.join(MAPPING_CONFIG_DIR, f"equipment_mapping_{site_id}.json")


def parse_site_id(site_id: str) -> tuple:
    """
    Site ID에서 site_name과 db_name 추출
    
    Args:
        site_id: korea_site1_line1 형식
    
    Returns:
        (site_name, db_name) = ('korea_site1', 'line1')
    """
    parts = site_id.rsplit('_', 1)  # 마지막 _ 기준으로 분리
    
    if len(parts) < 2:
        raise ValueError(f"Invalid site_id format: {site_id}. Expected: {{site_name}}_{{db_name}}")
    
    return parts[0], parts[1]


def get_display_name(site_name: str, db_name: str) -> str:
    """표시 이름 생성"""
    emoji = "🇰🇷" if "korea" in site_name.lower() else \
            "🇻🇳" if "vietnam" in site_name.lower() else \
            "🇺🇸" if "usa" in site_name.lower() else "🌍"
    
    return f"{emoji} {site_name.replace('_', ' ').title()} - {db_name.upper()}"


def get_connected_sites() -> Dict[str, Any]:
    """
    현재 연결된 사이트 목록 가져오기
    (connection_manager.py의 _connected_sites 참조)
    """
    try:
        from .connection_manager import _connected_sites
        return _connected_sites
    except ImportError:
        logger.warning("⚠️ Could not import _connected_sites from connection_manager")
        return {}


def load_site_mapping(site_id: str) -> Optional[SiteMappingConfig]:
    """사이트별 매핑 Config 로드"""
    file_path = get_mapping_file_path(site_id)
    
    if not os.path.exists(file_path):
        logger.debug(f"Mapping file not found: {file_path}")
        return None
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        mappings = {}
        for frontend_id, item in data.get("mappings", {}).items():
            mappings[frontend_id] = MappingItem(**item)
        
        site_name, db_name = parse_site_id(site_id)
        
        config = SiteMappingConfig(
            site_id=site_id,
            site_name=data.get("site_name", site_name),
            db_name=data.get("db_name", db_name),
            display_name=data.get("display_name", get_display_name(site_name, db_name)),
            version=data.get("version", "1.0.0"),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
            created_by=data.get("created_by", "admin"),
            description=data.get("description"),
            total_equipments=data.get("total_equipments", 117),
            mappings=mappings
        )
        
        logger.info(f"✅ Loaded mapping for {site_id}: {len(mappings)} items")
        return config
        
    except Exception as e:
        logger.error(f"❌ Failed to load mapping for {site_id}: {e}")
        return None


def save_site_mapping(site_id: str, config: SiteMappingConfig) -> bool:
    """사이트별 매핑 Config 저장"""
    ensure_config_dir()
    file_path = get_mapping_file_path(site_id)
    
    try:
        config.updated_at = datetime.now().isoformat()
        
        data = {
            "site_id": config.site_id,
            "site_name": config.site_name,
            "db_name": config.db_name,
            "display_name": config.display_name,
            "version": config.version,
            "created_at": config.created_at,
            "updated_at": config.updated_at,
            "created_by": config.created_by,
            "description": config.description,
            "total_equipments": config.total_equipments,
            "mappings": {
                frontend_id: item.dict()
                for frontend_id, item in config.mappings.items()
            }
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved mapping for {site_id}: {len(config.mappings)} items")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to save mapping for {site_id}: {e}")
        return False


def get_all_site_ids_from_databases() -> List[Dict[str, str]]:
    """databases.json에서 모든 사이트 정보 로드"""
    db_config_path = "config/databases.json"
    site_list = []
    
    try:
        if os.path.exists(db_config_path):
            with open(db_config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for site_name, site_info in data.items():
                databases = site_info.get("databases", {})
                for db_name in databases.keys():
                    site_id = f"{site_name}_{db_name}"
                    site_list.append({
                        "site_id": site_id,
                        "site_name": site_name,
                        "db_name": db_name
                    })
    except Exception as e:
        logger.warning(f"Failed to load databases.json: {e}")
    
    return site_list


# ============================================
# API Endpoints
# ============================================

@router.get("/sites", response_model=List[SiteMappingInfo])
async def get_mapping_sites():
    """
    매핑 가능한 모든 사이트 목록 조회
    databases.json 기반 + 연결 상태 + 매핑 상태
    """
    logger.info("🏭 GET /mapping/sites - 사이트 목록 조회")
    
    connected_sites = get_connected_sites()
    all_sites = get_all_site_ids_from_databases()
    
    result = []
    for site_info in all_sites:
        site_id = site_info["site_id"]
        site_name = site_info["site_name"]
        db_name = site_info["db_name"]
        
        mapping = load_site_mapping(site_id)
        
        info = SiteMappingInfo(
            site_id=site_id,
            site_name=site_name,
            db_name=db_name,
            display_name=get_display_name(site_name, db_name),
            has_mapping=mapping is not None,
            mapping_count=len(mapping.mappings) if mapping else 0,
            last_updated=mapping.updated_at if mapping else None,
            is_connected=site_id in connected_sites
        )
        result.append(info)
    
    return result


@router.get("/config/{site_id}", response_model=SiteMappingConfig)
async def get_site_mapping_config(site_id: str):
    """특정 사이트의 매핑 Config 조회"""
    logger.info(f"📋 GET /mapping/config/{site_id}")
    
    try:
        site_name, db_name = parse_site_id(site_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    config = load_site_mapping(site_id)
    
    if not config:
        now = datetime.now().isoformat()
        config = SiteMappingConfig(
            site_id=site_id,
            site_name=site_name,
            db_name=db_name,
            display_name=get_display_name(site_name, db_name),
            version="1.0.0",
            created_at=now,
            updated_at=now,
            description="No mapping configured yet",
            mappings={}
        )
    
    return config


@router.get("/config/{site_id}/simple")
async def get_site_mapping_simple(site_id: str):
    """간단한 매핑 정보 조회 (frontend_id → equipment_id만)"""
    config = load_site_mapping(site_id)
    
    if not config:
        return {}
    
    return {
        frontend_id: item.equipment_id
        for frontend_id, item in config.mappings.items()
    }


@router.get("/current")
async def get_current_site_mapping():
    """
    현재 연결된 사이트의 매핑 조회
    Connection Manager의 연결 상태를 자동으로 감지
    """
    logger.info("📋 GET /mapping/current")
    
    connected_sites = get_connected_sites()
    
    if not connected_sites:
        return {
            "connected": False,
            "site_id": None,
            "message": "No active database connection. Please connect to a site first.",
            "mappings": {}
        }
    
    site_id = list(connected_sites.keys())[0]
    site_info = connected_sites[site_id]
    
    site_name = site_info.get('site_name', '')
    db_name = site_info.get('db_name', '')
    
    config = load_site_mapping(site_id)
    
    if config:
        return {
            "connected": True,
            "site_id": site_id,
            "site_name": site_name,
            "db_name": db_name,
            "display_name": config.display_name,
            "mapping_count": len(config.mappings),
            "updated_at": config.updated_at,
            "mappings": {
                frontend_id: item.dict()
                for frontend_id, item in config.mappings.items()
            }
        }
    else:
        return {
            "connected": True,
            "site_id": site_id,
            "site_name": site_name,
            "db_name": db_name,
            "display_name": get_display_name(site_name, db_name),
            "mapping_count": 0,
            "message": f"No mapping configured for {site_id}",
            "mappings": {}
        }


@router.post("/config/{site_id}")
async def save_site_mapping_config(site_id: str, request: MappingUpdateRequest):
    """사이트별 매핑 Config 저장 (관리자 전용)"""
    logger.info(f"💾 POST /mapping/config/{site_id} - {len(request.mappings)}개")
    
    try:
        site_name, db_name = parse_site_id(site_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 중복 검사
    equipment_id_map = {}
    duplicates = {}
    
    for mapping in request.mappings:
        eq_id = mapping.equipment_id
        if eq_id in equipment_id_map:
            if eq_id not in duplicates:
                duplicates[eq_id] = [equipment_id_map[eq_id]]
            duplicates[eq_id].append(mapping.frontend_id)
        else:
            equipment_id_map[eq_id] = mapping.frontend_id
    
    if duplicates:
        error_msg = "중복된 Equipment ID:\n"
        for eq_id, frontend_ids in duplicates.items():
            error_msg += f"  - ID {eq_id}: {', '.join(frontend_ids)}\n"
        raise HTTPException(status_code=400, detail=error_msg)
    
    existing_config = load_site_mapping(site_id)
    now = datetime.now().isoformat()
    
    mappings_dict = {m.frontend_id: m for m in request.mappings}
    
    if existing_config:
        existing_config.mappings = mappings_dict
        existing_config.created_by = request.created_by or "admin"
        existing_config.description = request.description or existing_config.description
        config = existing_config
    else:
        config = SiteMappingConfig(
            site_id=site_id,
            site_name=site_name,
            db_name=db_name,
            display_name=get_display_name(site_name, db_name),
            created_at=now,
            updated_at=now,
            created_by=request.created_by or "admin",
            description=request.description,
            mappings=mappings_dict
        )
    
    if not save_site_mapping(site_id, config):
        raise HTTPException(status_code=500, detail="Failed to save")
    
    return {
        "success": True,
        "message": f"{len(mappings_dict)}개 매핑 저장 완료",
        "site_id": site_id,
        "total": len(mappings_dict),
        "updated_at": config.updated_at
    }


@router.post("/config/{site_id}/validate", response_model=ValidationResult)
async def validate_site_mapping(site_id: str, request: MappingUpdateRequest):
    """매핑 유효성 검증"""
    errors = []
    warnings = []
    duplicates = {}
    
    equipment_id_count = {}
    for mapping in request.mappings:
        eq_id = mapping.equipment_id
        if eq_id not in equipment_id_count:
            equipment_id_count[eq_id] = []
        equipment_id_count[eq_id].append(mapping.frontend_id)
    
    for eq_id, frontend_ids in equipment_id_count.items():
        if len(frontend_ids) > 1:
            duplicates[eq_id] = frontend_ids
            errors.append(f"Equipment ID {eq_id}: {', '.join(frontend_ids)}")
    
    if len(request.mappings) < 117:
        warnings.append(f"{117 - len(request.mappings)}개 미매핑")
    
    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        duplicates=duplicates
    )


@router.delete("/config/{site_id}")
async def delete_site_mapping(site_id: str):
    """사이트 매핑 삭제"""
    file_path = get_mapping_file_path(site_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Not found: {site_id}")
    
    os.remove(file_path)
    return {"success": True, "message": f"Deleted: {site_id}"}


@router.post("/on-connect/{site_id}")
async def on_site_connected(site_id: str):
    """사이트 연결 시 매핑 정보 확인"""
    config = load_site_mapping(site_id)
    
    return {
        "has_mapping": config is not None,
        "site_id": site_id,
        "mapping_count": len(config.mappings) if config else 0,
        "last_updated": config.updated_at if config else None
    }

@router.get(
    "/db-equipments/{site_id}/{db_name}",
    response_model=DBEquipmentsResponse,
    summary="DB 설비 목록 조회",
    description="특정 Site/DB의 설비 목록을 DB에서 직접 조회합니다. Mapping Editor에서 사용."
)
async def get_db_equipments(site_id: str, db_name: str):
    """
    🆕 v1.1.0: DB 설비 목록 조회 (Mapping Editor용)
    
    core.Equipment 테이블에서 설비 목록을 직접 조회합니다.
    이 목록을 기반으로 Frontend ID와 매핑할 수 있습니다.
    
    Path Parameters:
        - site_id: 사이트 ID (예: korea_site1)
        - db_name: DB 이름 (예: line1)
        
    Returns:
        {
            "success": true,
            "site_id": "korea_site1",
            "site_name": "korea_site1",
            "db_name": "line1",
            "total_count": 117,
            "equipments": [
                {
                    "equipment_id": 1,
                    "equipment_name": "CVDF-001",
                    "line_name": "LINE1",
                    "equipment_code": "EQ001"
                },
                ...
            ],
            "message": null
        }
    """
    logger.info(f"📡 GET /mapping/db-equipments/{site_id}/{db_name}")
    
    try:
        # connection_manager에서 연결 정보 가져오기
        from ..database.connection_test import get_connection_manager
        
        manager = get_connection_manager()
        
        # Site가 존재하는지 확인
        if site_id not in manager.databases_config:
            raise HTTPException(
                status_code=404,
                detail=f"Site not found: {site_id}"
            )
        
        site_config = manager.databases_config[site_id]
        databases = site_config.get('databases', {})
        
        if db_name not in databases:
            raise HTTPException(
                status_code=404,
                detail=f"Database not found: {site_id}/{db_name}"
            )
        
        # DB 연결 및 쿼리 실행
        conn = manager.get_connection(site_id, db_name)
        if not conn:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to {site_id}/{db_name}"
            )
        
        try:
            cursor = conn.cursor()
            
            # core.Equipment 테이블에서 설비 목록 조회
            query = """
                SELECT 
                    e.EquipmentId,
                    e.EquipmentName,
                    e.LineName,
                    NULL AS EquipmentCode
                FROM core.Equipment e WITH (NOLOCK)
                ORDER BY e.EquipmentId
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            equipments = []
            for row in rows:
                item = DBEquipmentItem(
                    equipment_id=row[0],
                    equipment_name=row[1] or '',
                    line_name=row[2],
                    equipment_code=row[3]
                )
                equipments.append(item)
            
            cursor.close()
            
            logger.info(f"✅ DB equipments loaded: {len(equipments)}개")
            
            return DBEquipmentsResponse(
                success=True,
                site_id=site_id,
                site_name=site_id,
                db_name=db_name,
                total_count=len(equipments),
                equipments=equipments,
                message=None
            )
            
        except Exception as e:
            logger.error(f"❌ Query failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Query failed: {str(e)}"
            )
        finally:
            try:
                conn.close()
            except:
                pass
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get DB equipments: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post(
    "/save-mapping/{site_id}/{db_name}",
    response_model=MappingSavedResponse,
    summary="매핑 저장 (간소화)",
    description="Frontend에서 사용하기 편한 형태의 매핑 저장 API. mappingSaved 이벤트 발생용."
)
async def save_mapping_simple(
    site_id: str, 
    db_name: str, 
    request: SimpleMappingRequest
):
    """
    🆕 v1.1.0: 매핑 저장 (Frontend용 간소화 버전)
    
    기존 POST /config/{site_id}와 동일하지만:
    - site_id와 db_name을 path parameter로 분리
    - 응답에 mapping_status 필드 포함 (Frontend mappingSaved 이벤트용)
    
    Path Parameters:
        - site_id: 사이트 ID (예: korea_site1)
        - db_name: DB 이름 (예: line1)
        
    Body:
        {
            "mappings": {
                "EQ-01-01": {
                    "equipment_id": 1,
                    "equipment_name": "CVDF-001",
                    "line_name": "LINE1"
                },
                ...
            },
            "created_by": "admin",
            "description": "Initial mapping"
        }
        
    Returns:
        {
            "success": true,
            "message": "117개 매핑 저장 완료",
            "site_id": "korea_site1_line1",
            "site_name": "korea_site1",
            "db_name": "line1",
            "total_mappings": 117,
            "updated_at": "2026-01-29T...",
            "mapping_status": "ready"
        }
    """
    logger.info(f"💾 POST /mapping/save-mapping/{site_id}/{db_name} - {len(request.mappings)}개")
    
    # combined site_id 생성
    combined_site_id = f"{site_id}_{db_name}"
    
    try:
        # 중복 검사
        equipment_id_map = {}
        duplicates = {}
        
        for frontend_id, item in request.mappings.items():
            eq_id = item.get('equipment_id')
            if eq_id is None:
                continue
            
            if eq_id in equipment_id_map:
                if eq_id not in duplicates:
                    duplicates[eq_id] = [equipment_id_map[eq_id]]
                duplicates[eq_id].append(frontend_id)
            else:
                equipment_id_map[eq_id] = frontend_id
        
        if duplicates:
            error_msg = "중복된 Equipment ID:\n"
            for eq_id, frontend_ids in duplicates.items():
                error_msg += f"  - ID {eq_id}: {', '.join(frontend_ids)}\n"
            raise HTTPException(status_code=400, detail=error_msg)
        
        # MappingItem 변환
        mappings_dict = {}
        for frontend_id, item in request.mappings.items():
            mappings_dict[frontend_id] = MappingItem(
                frontend_id=frontend_id,
                equipment_id=item.get('equipment_id'),
                equipment_name=item.get('equipment_name', ''),
                equipment_code=item.get('equipment_code'),
                line_name=item.get('line_name')
            )
        
        # 기존 설정 로드 또는 새로 생성
        existing_config = load_site_mapping(combined_site_id)
        now = datetime.now().isoformat()
        
        if existing_config:
            existing_config.mappings = mappings_dict
            existing_config.created_by = request.created_by or "admin"
            existing_config.description = request.description or existing_config.description
            config = existing_config
        else:
            config = SiteMappingConfig(
                site_id=combined_site_id,
                site_name=site_id,
                db_name=db_name,
                display_name=get_display_name(site_id, db_name),
                created_at=now,
                updated_at=now,
                created_by=request.created_by or "admin",
                description=request.description,
                total_equipments=len(mappings_dict),
                mappings=mappings_dict
            )
        
        # 저장
        if not save_site_mapping(combined_site_id, config):
            raise HTTPException(status_code=500, detail="Failed to save mapping")
        
        logger.info(f"✅ Mapping saved: {combined_site_id} - {len(mappings_dict)}개")
        
        return MappingSavedResponse(
            success=True,
            message=f"{len(mappings_dict)}개 매핑 저장 완료",
            site_id=combined_site_id,
            site_name=site_id,
            db_name=db_name,
            total_mappings=len(mappings_dict),
            updated_at=config.updated_at,
            mapping_status="ready"  # 저장 성공 = ready
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to save mapping: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))