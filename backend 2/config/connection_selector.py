# backend/config/connection_selector.py
"""
선택적 연결 관리 시스템
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Set
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent.parent


class ConnectionSelector:
    """연결 선택 관리자"""
    
    def __init__(
        self,
        active_config_path: Optional[Path] = None,
        profiles_path: Optional[Path] = None
    ):
        # 설정 파일 경로
        self.active_config_path = active_config_path or (
            PROJECT_ROOT / 'config' / 'active_connections.json'
        )
        self.profiles_path = profiles_path or (
            PROJECT_ROOT / 'config' / 'connection_profiles.json'
        )
        
        # 활성 연결 설정
        self.active_connections = {}
        self.profiles = {}
        self.current_profile = None
        
        # 설정 로드
        self._load_configurations()
    
    def _load_configurations(self):
        """설정 파일 로드"""
        # 활성 연결 로드
        if self.active_config_path.exists():
            with open(self.active_config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.active_connections = data.get('enabled_connections', {})
                self.current_profile = data.get('active_profile')
            logger.info(f"활성 연결 설정 로드: {self.active_config_path}")
        else:
            logger.warning(f"활성 연결 설정 파일 없음: {self.active_config_path}")
            self._create_default_active_config()
        
        # 프로필 로드
        if self.profiles_path.exists():
            with open(self.profiles_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.profiles = data.get('profiles', {})
            logger.info(f"연결 프로필 로드: {len(self.profiles)}개")
        else:
            logger.warning(f"프로필 파일 없음: {self.profiles_path}")
            self._create_default_profiles()
    
    def _create_default_active_config(self):
        """기본 활성 연결 설정 생성"""
        default_config = {
            "active_profile": "korea_only",
            "enabled_connections": {
                "korea_site1": {
                    "enabled": True,
                    "databases": {
                        "line1": True,
                        "line2": False,
                        "quality": False
                    }
                }
            },
            "last_updated": datetime.now().isoformat(),
            "updated_by": "system"
        }
        
        self.active_config_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.active_config_path, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)
        
        self.active_connections = default_config['enabled_connections']
        self.current_profile = default_config['active_profile']
        
        logger.info("기본 활성 연결 설정 생성")
    
    def _create_default_profiles(self):
        """기본 프로필 생성"""
        default_profiles = {
            "profiles": {
                "korea_only": {
                    "name": "한국 사이트만",
                    "description": "한국 공장 라인1만 연결",
                    "connections": {
                        "korea_site1": ["line1"]
                    }
                }
            },
            "default_profile": "korea_only"
        }
        
        self.profiles_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.profiles_path, 'w', encoding='utf-8') as f:
            json.dump(default_profiles, f, indent=2, ensure_ascii=False)
        
        self.profiles = default_profiles['profiles']
        
        logger.info("기본 프로필 생성")
    
    def is_site_enabled(self, site_id: str) -> bool:
        """사이트 활성화 여부"""
        if site_id not in self.active_connections:
            return False
        return self.active_connections[site_id].get('enabled', False)
    
    def is_database_enabled(self, site_id: str, db_name: str) -> bool:
        """데이터베이스 활성화 여부"""
        if not self.is_site_enabled(site_id):
            return False
        
        databases = self.active_connections[site_id].get('databases', {})
        return databases.get(db_name, False)
    
    def get_enabled_sites(self) -> List[str]:
        """활성화된 사이트 목록"""
        return [
            site_id 
            for site_id, config in self.active_connections.items()
            if config.get('enabled', False)
        ]
    
    def get_enabled_databases(self, site_id: str) -> List[str]:
        """특정 사이트에서 활성화된 데이터베이스 목록"""
        if not self.is_site_enabled(site_id):
            return []
        
        databases = self.active_connections[site_id].get('databases', {})
        return [
            db_name 
            for db_name, enabled in databases.items()
            if enabled
        ]
    
    def get_all_enabled_connections(self) -> Dict[str, List[str]]:
        """
        모든 활성 연결 반환
        
        Returns:
            {site_id: [db_name1, db_name2, ...]}
        """
        result = {}
        
        for site_id in self.get_enabled_sites():
            enabled_dbs = self.get_enabled_databases(site_id)
            if enabled_dbs:
                result[site_id] = enabled_dbs
        
        return result
    
    def enable_site(self, site_id: str, enable: bool = True):
        """사이트 활성화/비활성화"""
        if site_id not in self.active_connections:
            self.active_connections[site_id] = {
                'enabled': False,
                'databases': {}
            }
        
        self.active_connections[site_id]['enabled'] = enable
        logger.info(f"사이트 {'활성화' if enable else '비활성화'}: {site_id}")
    
    def enable_database(self, site_id: str, db_name: str, enable: bool = True):
        """데이터베이스 활성화/비활성화"""
        if site_id not in self.active_connections:
            self.active_connections[site_id] = {
                'enabled': True,
                'databases': {}
            }
        
        if 'databases' not in self.active_connections[site_id]:
            self.active_connections[site_id]['databases'] = {}
        
        self.active_connections[site_id]['databases'][db_name] = enable
        logger.info(f"데이터베이스 {'활성화' if enable else '비활성화'}: {site_id}/{db_name}")
    
    def enable_multiple(
        self, 
        connections: Dict[str, List[str]], 
        exclusive: bool = True
    ):
        """
        여러 연결 동시 활성화
        
        Args:
            connections: {site_id: [db_name1, db_name2, ...]}
            exclusive: True면 지정된 것만 활성화, False면 추가로 활성화
        """
        if exclusive:
            # 모두 비활성화
            for site_id in self.active_connections:
                self.enable_site(site_id, False)
                for db_name in self.active_connections[site_id].get('databases', {}):
                    self.enable_database(site_id, db_name, False)
        
        # 지정된 연결 활성화
        for site_id, db_list in connections.items():
            self.enable_site(site_id, True)
            
            for db_name in db_list:
                self.enable_database(site_id, db_name, True)
        
        logger.info(f"다중 연결 설정: {connections}")
    
    def load_profile(self, profile_name: str):
        """프로필 로드"""
        if profile_name not in self.profiles:
            raise ValueError(f"프로필을 찾을 수 없음: {profile_name}")
        
        profile = self.profiles[profile_name]
        connections = profile.get('connections', {})
        
        self.enable_multiple(connections, exclusive=True)
        self.current_profile = profile_name
        
        logger.info(f"프로필 로드: {profile_name} - {profile.get('name')}")
    
    def save_active_config(self, updated_by: str = "system"):
        """활성 연결 설정 저장"""
        config = {
            "active_profile": self.current_profile,
            "enabled_connections": self.active_connections,
            "last_updated": datetime.now().isoformat(),
            "updated_by": updated_by
        }
        
        with open(self.active_config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        logger.info(f"활성 연결 설정 저장: {self.active_config_path}")
    
    def create_profile(
        self, 
        profile_name: str, 
        name: str,
        description: str,
        connections: Dict[str, List[str]]
    ):
        """새 프로필 생성"""
        self.profiles[profile_name] = {
            "name": name,
            "description": description,
            "connections": connections
        }
        
        self._save_profiles()
        logger.info(f"프로필 생성: {profile_name}")
    
    def _save_profiles(self):
        """프로필 저장"""
        data = {
            "profiles": self.profiles,
            "default_profile": self.current_profile or "korea_only"
        }
        
        with open(self.profiles_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def get_profile_list(self) -> List[Dict]:
        """프로필 목록 반환"""
        return [
            {
                'profile_id': profile_id,
                'name': profile.get('name'),
                'description': profile.get('description'),
                'connections': profile.get('connections'),
                'is_active': profile_id == self.current_profile
            }
            for profile_id, profile in self.profiles.items()
        ]
    
    def get_connection_summary(self) -> Dict:
        """연결 상태 요약"""
        enabled = self.get_all_enabled_connections()
        
        total_sites = len(self.active_connections)
        enabled_sites = len(enabled)
        
        total_dbs = sum(
            len(config.get('databases', {}))
            for config in self.active_connections.values()
        )
        enabled_dbs = sum(len(dbs) for dbs in enabled.values())
        
        return {
            'current_profile': self.current_profile,
            'enabled_connections': enabled,
            'statistics': {
                'total_sites': total_sites,
                'enabled_sites': enabled_sites,
                'total_databases': total_dbs,
                'enabled_databases': enabled_dbs
            }
        }


# 전역 인스턴스
connection_selector = ConnectionSelector()


def get_connection_selector() -> ConnectionSelector:
    """연결 선택 관리자 반환"""
    return connection_selector