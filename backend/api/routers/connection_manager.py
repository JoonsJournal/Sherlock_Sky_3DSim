"""
연결 관리 API Router
- databases.json 기반 연결 테스트
- connection_profiles.json 기반 프로필 관리
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging

from ..database.connection_test import get_connection_manager

router = APIRouter()
logger = logging.getLogger(__name__)


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
        logger.error(f"테이블 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))
	
	

@router.get("/sites")
async def get_all_sites():
    """
    모든 사이트 조회
    
    Returns:
        {
            "sites": [
                {
                    "name": "korea_site1",
                    "host": "192.168.1.100",
                    "databases": ["line1", "line2", "quality"]
                }
            ]
        }
    """
    try:
        manager = get_connection_manager()
        return manager.get_all_sites()
    except Exception as e:
        logger.error(f"사이트 조회 실패: {e}")
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
        logger.error(f"프로필 조회 실패: {e}")
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
        logger.error(f"연결 테스트 실패: {e}")
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
        logger.error(f"프로필 테스트 실패: {e}")
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
        logger.error(f"전체 테스트 실패: {e}")
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
        logger.error(f"상태 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))