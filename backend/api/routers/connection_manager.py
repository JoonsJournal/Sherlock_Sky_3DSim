# backend/api/routers/connection_manager.py
"""
연결 관리 API
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional

from ...config.connection_selector import get_connection_selector
from ..database.multi_connection_manager import connection_manager

router = APIRouter()


class EnableConnectionRequest(BaseModel):
    site_id: str
    databases: Optional[List[str]] = None  # None이면 전체


class LoadProfileRequest(BaseModel):
    profile_name: str


@router.get("/status")
async def get_connection_status():
    """
    현재 연결 상태 조회
    
    Returns:
        활성 프로필, 연결 목록, 통계
    """
    selector = get_connection_selector()
    summary = selector.get_connection_summary()
    
    # 실제 연결 상태 추가
    connection_status = connection_manager.get_connection_status()
    
    return {
        **summary,
        'connection_details': connection_status['connections']
    }


@router.get("/profiles")
async def get_profiles():
    """
    프로필 목록 조회
    
    Returns:
        사용 가능한 프로필 목록
    """
    selector = get_connection_selector()
    return {
        'profiles': selector.get_profile_list()
    }


@router.post("/profile/load")
async def load_profile(request: LoadProfileRequest):
    """
    프로필 로드
    
    Body:
        {"profile_name": "korea_only"}
    """
    selector = get_connection_selector()
    
    try:
        selector.load_profile(request.profile_name)
        selector.save_active_config(updated_by="api")
        connection_manager.reload_connections()
        
        return {
            'message': f'프로필 로드 완료: {request.profile_name}',
            'active_connections': selector.get_all_enabled_connections()
        }
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enable")
async def enable_connections(request: EnableConnectionRequest):
    """
    특정 사이트/데이터베이스 활성화
    
    Body:
        {
            "site_id": "korea_site1",
            "databases": ["line1", "line2"]  # null이면 전체
        }
    """
    selector = get_connection_selector()
    settings = get_multi_site_settings()
    
    try:
        # 사이트 활성화
        selector.enable_site(request.site_id, True)
        
        # 데이터베이스 활성화
        if request.databases is None:
            # 전체 활성화
            all_dbs = settings.get_site_databases(request.site_id)
            for db_name in all_dbs:
                selector.enable_database(request.site_id, db_name, True)
        else:
            # 지정된 것만 활성화
            for db_name in request.databases:
                selector.enable_database(request.site_id, db_name, True)
        
        selector.save_active_config(updated_by="api")
        connection_manager.reload_connections()
        
        return {
            'message': '연결 활성화 완료',
            'site_id': request.site_id,
            'databases': request.databases or '전체'
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disable")
async def disable_connections(request: EnableConnectionRequest):
    """특정 사이트/데이터베이스 비활성화"""
    selector = get_connection_selector()
    
    try:
        if request.databases is None:
            # 사이트 전체 비활성화
            selector.enable_site(request.site_id, False)
        else:
            # 지정된 데이터베이스만 비활성화
            for db_name in request.databases:
                selector.enable_database(request.site_id, db_name, False)
        
        selector.save_active_config(updated_by="api")
        connection_manager.reload_connections()
        
        return {
            'message': '연결 비활성화 완료',
            'site_id': request.site_id,
            'databases': request.databases or '전체'
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def test_connections():
    """
    모든 활성 연결 테스트
    
    Returns:
        {site_id: {db_name: bool}}
    """
    results = connection_manager.test_all_active_connections()
    
    # 통계 계산
    total = sum(len(dbs) for dbs in results.values())
    success = sum(
        sum(1 for status in dbs.values() if status)
        for dbs in results.values()
    )
    
    return {
        'results': results,
        'statistics': {
            'total': total,
            'success': success,
            'failed': total - success,
            'success_rate': (success / total * 100) if total > 0 else 0
        }
    }


@router.post("/reload")
async def reload_connections():
    """
    연결 설정 리로드
    
    활성 연결 설정 파일이 외부에서 변경된 경우 사용
    """
    try:
        connection_manager.reload_connections()
        
        return {
            'message': '연결 리로드 완료',
            'active_connections': get_connection_selector().get_all_enabled_connections()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))