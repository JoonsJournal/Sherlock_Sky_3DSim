"""
Equipment Mapping API
Frontend 설비 ID와 DB Equipment 매핑 관리
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Optional
from pydantic import BaseModel
import logging
import json
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/equipment", tags=["Equipment Mapping"])


# ============================================
# Pydantic Models
# ============================================

class EquipmentName(BaseModel):
    """core.equipment의 설비 정보"""
    equipment_id: int
    equipment_name: str
    equipment_code: Optional[str] = None
    line_name: Optional[str] = None


class MappingItem(BaseModel):
    """Frontend 설비 → DB Equipment 매핑"""
    frontend_id: str  # 'EQ-01-01'
    equipment_id: int
    equipment_name: str


class MappingRequest(BaseModel):
    """매핑 저장 요청"""
    mappings: List[MappingItem]


class ValidationResult(BaseModel):
    """유효성 검증 결과"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    duplicates: Dict[int, List[str]] = {}  # equipment_id -> [frontend_ids]
    missing: List[str] = []  # DB에 있지만 매핑되지 않은 설비


# ============================================
# Helper Functions
# ============================================
def get_active_connection():
    """
    현재 활성화된 사이트의 DB 연결 가져오기
    
    Returns:
        tuple: (connection, site_id)
    
    Raises:
        HTTPException: 활성 연결이 없거나 연결 실패 시
    """
    try:
        from ..database import connection_manager
        
        logger.info("📡 Attempting to get active database connection...")
        
        # 활성 연결 확인
        active_sites = connection_manager.get_active_connections()
        
        logger.info(f"Active sites: {active_sites}")
        
        # 활성 연결이 없으면 에러
        if not active_sites or len(active_sites) == 0:
            logger.warning("⚠️ No active database connections found")
            raise HTTPException(
                status_code=400,
                detail="No active database connection. Please connect to a site first."
            )
        
        # 첫 번째 활성 사이트 사용
        site_id = active_sites[0]
        
        logger.info(f"Using site: {site_id}")
        
        # 활성 연결 정보 조회 (DB 이름 가져오기)
        conn_info = connection_manager.get_active_connection_info(site_id)
        db_name = conn_info.get('db_name', 'SherlockSky') if conn_info else 'SherlockSky'
        
        logger.info(f"🔌 Requesting connection: {site_id}/{db_name}")
        
        # 연결 가져오기
        conn = connection_manager.get_connection(site_id, db_name)
        
        if not conn:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get connection for {site_id}/{db_name}"
            )
        
        logger.info(f"✅ Database connection acquired: {site_id}/{db_name}")
        
        return conn, site_id
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get database connection: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to database: {str(e)}"
        )


def load_mapping_from_file():
    """로컬 매핑 파일에서 데이터 로드"""
    mapping_file = 'config/equipment_mapping.json'
    
    if os.path.exists(mapping_file):
        with open(mapping_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    return {}


def save_mapping_to_file(mappings: Dict):
    """로컬 매핑 파일에 저장"""
    mapping_file = 'config/equipment_mapping.json'
    
    os.makedirs('config', exist_ok=True)
    
    with open(mapping_file, 'w', encoding='utf-8') as f:
        json.dump(mappings, f, indent=2, ensure_ascii=False)


# ============================================
# API Endpoints
# ============================================

@router.get("/names", response_model=List[EquipmentName])
async def get_equipment_names():
    """
    core.equipment 테이블의 모든 EquipmentName 목록 조회
    
    Returns:
        List[EquipmentName]: 설비 목록
    """
    logger.info("📋 GET /equipment/names - Equipment names 조회 요청")
    
    conn = None
    cursor = None
    
    try:
        # DB 연결 가져오기
        conn, site_id = get_active_connection()
        
        logger.info(f"📊 Querying equipment from {site_id}")
        
        # 커서 생성
        cursor = conn.cursor()
        
        # SQL 쿼리 실행
        query = """
            SELECT EquipmentID, EquipmentName, NULL AS EquipmentCode, LineName
            FROM core.equipment WITH (NOLOCK)
            ORDER BY EquipmentName
        """
        
        logger.debug(f"🔍 Executing query: {query.strip()}")
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        logger.info(f"📦 Fetched {len(rows)} rows from database")
        
        # Pydantic 모델로 변환
        equipment_list = [
            EquipmentName(
                equipment_id=row[0],
                equipment_name=row[1],
                equipment_code=row[2],
                line_name=row[3]
            )
            for row in rows
        ]
        
        logger.info(f"✅ Equipment names 조회 성공: {len(equipment_list)}개")
        
        return equipment_list
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Equipment names 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch equipment names: {str(e)}"
        )
        
    finally:
        if cursor:
            cursor.close()
            logger.debug("🔒 Cursor closed")

@router.get("/mapping", response_model=Dict[str, MappingItem])
async def get_equipment_mapping():
    """
    현재 Frontend 설비 → DB Equipment 매핑 조회
    
    Returns:
        Dict[str, MappingItem]: { 'EQ-01-01': {...}, 'EQ-01-02': {...}, ... }
    """
    logger.info("🔗 Equipment mapping 조회 요청")
    
    try:
        mapping_data = load_mapping_from_file()
        
        logger.info(f"✅ Mapping 조회 성공: {len(mapping_data)}개")
        
        return mapping_data
        
    except Exception as e:
        logger.error(f"❌ Mapping 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mapping")
async def save_equipment_mapping(request: MappingRequest):
    """
    Frontend 설비 → DB Equipment 매핑 저장
    
    Args:
        request: 매핑 데이터
        
    Returns:
        성공 메시지
    """
    logger.info(f"💾 Equipment mapping 저장 요청: {len(request.mappings)}개")
    
    try:
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
            error_msg = "중복된 Equipment ID가 발견되었습니다:\n"
            for eq_id, frontend_ids in duplicates.items():
                error_msg += f"  - Equipment ID {eq_id}: {', '.join(frontend_ids)}\n"
            
            raise HTTPException(status_code=400, detail=error_msg)
        
        # 딕셔너리로 변환
        mapping_dict = {
            mapping.frontend_id: mapping.dict()
            for mapping in request.mappings
        }
        
        # 파일에 저장
        save_mapping_to_file(mapping_dict)
        
        logger.info(f"✅ Mapping 저장 성공: {len(mapping_dict)}개")
        
        return {
            "success": True,
            "message": f"{len(mapping_dict)}개 매핑 저장 완료",
            "total": len(mapping_dict)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Mapping 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mapping/validate", response_model=ValidationResult)
async def validate_equipment_mapping(request: MappingRequest):
    """
    매핑 유효성 검증
    
    Args:
        request: 매핑 데이터
        
    Returns:
        ValidationResult: 검증 결과
    """
    logger.info(f"🔍 Mapping 유효성 검증 요청: {len(request.mappings)}개")
    
    conn, site_id = get_active_connection()
    cursor = None
    
    try:
        cursor = conn.cursor()
        
        # DB의 모든 EquipmentID 조회
        cursor.execute("SELECT EquipmentID, EquipmentName FROM core.equipment")
        db_equipments = {row[0]: row[1] for row in cursor.fetchall()}
        
        errors = []
        warnings = []
        duplicates = {}
        
        # 중복 검사
        equipment_id_count = {}
        for mapping in request.mappings:
            eq_id = mapping.equipment_id
            
            if eq_id not in equipment_id_count:
                equipment_id_count[eq_id] = []
            equipment_id_count[eq_id].append(mapping.frontend_id)
        
        for eq_id, frontend_ids in equipment_id_count.items():
            if len(frontend_ids) > 1:
                duplicates[eq_id] = frontend_ids
                errors.append(
                    f"Equipment ID {eq_id} ({db_equipments.get(eq_id, 'Unknown')}) "
                    f"is assigned to multiple frontend equipments: {', '.join(frontend_ids)}"
                )
        
        # 존재 여부 검사
        for mapping in request.mappings:
            if mapping.equipment_id not in db_equipments:
                errors.append(
                    f"Equipment ID {mapping.equipment_id} does not exist in database"
                )
        
        # 누락 검사
        mapped_eq_ids = {m.equipment_id for m in request.mappings}
        missing = []
        
        for eq_id, eq_name in db_equipments.items():
            if eq_id not in mapped_eq_ids:
                missing.append(f"{eq_id}: {eq_name}")
        
        if missing:
            warnings.append(
                f"{len(missing)}개 설비가 매핑되지 않았습니다"
            )
        
        valid = len(errors) == 0
        
        result = ValidationResult(
            valid=valid,
            errors=errors,
            warnings=warnings,
            duplicates=duplicates,
            missing=missing
        )
        
        logger.info(f"✅ 검증 완료: valid={valid}, errors={len(errors)}, warnings={len(warnings)}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Mapping 검증 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if cursor:
            cursor.close()