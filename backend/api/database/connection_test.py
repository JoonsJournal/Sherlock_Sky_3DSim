"""
통합 데이터베이스 연결 테스트 모듈
- databases.json, connection_profiles.json, active_connections.json 통합
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseConnectionManager:
    """데이터베이스 연결 관리자"""
    
    def __init__(self, config_dir: str = "config"):
        self.config_dir = Path(config_dir)
        self.databases_config = {}
        self.profiles_config = {}
        self.active_config = {}
        
        self.load_all_configs()
    
    def load_all_configs(self):
        """모든 설정 파일 로드"""
        try:
            # databases.json
            db_file = self.config_dir / "databases.json"
            if db_file.exists():
                with open(db_file, 'r', encoding='utf-8') as f:
                    self.databases_config = json.load(f)
                logger.info(f"✓ databases.json 로드: {len(self.databases_config)} 사이트")
            
            # connection_profiles.json
            profile_file = self.config_dir / "connection_profiles.json"
            if profile_file.exists():
                with open(profile_file, 'r', encoding='utf-8') as f:
                    self.profiles_config = json.load(f)
                logger.info(f"✓ connection_profiles.json 로드: {len(self.profiles_config.get('profiles', {}))} 프로필")
            
            # active_connections.json
            active_file = self.config_dir / "active_connections.json"
            if active_file.exists():
                with open(active_file, 'r', encoding='utf-8') as f:
                    self.active_config = json.load(f)
                logger.info(f"✓ active_connections.json 로드")
        
        except Exception as e:
            logger.error(f"설정 파일 로드 실패: {e}")
    
    def get_all_sites(self) -> Dict[str, Any]:
        """모든 사이트 정보 조회"""
        sites = []
        for site_name, site_config in self.databases_config.items():
            site_info = {
                'name': site_name,
                'host': site_config.get('host', 'N/A'),
                'port': site_config.get('port', 'N/A'),
                'type': site_config.get('type', 'unknown'),
                'description': site_config.get('description', ''),
                'databases': list(site_config.get('databases', {}).keys())
            }
            sites.append(site_info)
        
        return {'sites': sites}
    
    def get_all_profiles(self) -> Dict[str, Any]:
        """모든 프로필 정보 조회"""
        profiles = []
        profiles_data = self.profiles_config.get('profiles', {})
        
        for profile_name, profile_config in profiles_data.items():
            profile_info = {
                'name': profile_name,
                'display_name': profile_config.get('name', profile_name),
                'description': profile_config.get('description', ''),
                'connections': profile_config.get('connections', {})
            }
            profiles.append(profile_info)
        
        return {
            'profiles': profiles,
            'default_profile': self.profiles_config.get('default_profile', '')
        }
    
    def test_single_connection(self, site_name: str, db_name: str) -> Dict[str, Any]:
        """
        단일 데이터베이스 연결 테스트
        
        Args:
            site_name: 사이트 이름 (예: korea_site1)
            db_name: 데이터베이스 이름 (예: line1)
        """
        # 사이트 설정 확인
        if site_name not in self.databases_config:
            return {
                'success': False,
                'site_name': site_name,
                'db_name': db_name,
                'message': f'사이트를 찾을 수 없음: {site_name}',
                'error': 'SITE_NOT_FOUND'
            }
        
        site_config = self.databases_config[site_name]
        databases = site_config.get('databases', {})
        
        # 데이터베이스 확인
        if db_name not in databases:
            return {
                'success': False,
                'site_name': site_name,
                'db_name': db_name,
                'message': f'데이터베이스를 찾을 수 없음: {db_name}',
                'error': 'DATABASE_NOT_FOUND',
                'available_databases': list(databases.keys())
            }
        
        # 실제 연결 정보 구성
        db_type = site_config.get('type', 'mssql').lower()
        connection_config = {
            'host': site_config.get('host'),
            'port': site_config.get('port'),
            'user': site_config.get('user'),
            'password': site_config.get('password'),
            'database': databases[db_name],
            'type': db_type
        }
        
        # 필수 필드 검증
        required_fields = ['host', 'user', 'password', 'database']
        missing_fields = [f for f in required_fields if not connection_config.get(f)]
        
        if missing_fields:
            return {
                'success': False,
                'site_name': site_name,
                'db_name': db_name,
                'message': f'필수 설정 누락: {", ".join(missing_fields)}',
                'error': 'MISSING_CONFIGURATION',
                'missing_fields': missing_fields
            }
        
        # DB 타입별 연결 테스트
        try:
            if db_type in ['mssql', 'sqlserver']:
                result = self._test_mssql(connection_config)
            elif db_type == 'mysql':
                result = self._test_mysql(connection_config)
            elif db_type in ['postgresql', 'postgres']:
                result = self._test_postgresql(connection_config)
            else:
                return {
                    'success': False,
                    'site_name': site_name,
                    'db_name': db_name,
                    'message': f'지원하지 않는 DB 타입: {db_type}',
                    'error': 'UNSUPPORTED_DB_TYPE'
                }
            
            # 결과에 사이트/DB 정보 추가
            result['site_name'] = site_name
            result['db_name'] = db_name
            result['db_type'] = db_type
            
            return result
        
        except Exception as e:
            logger.error(f"연결 테스트 오류: {e}")
            return {
                'success': False,
                'site_name': site_name,
                'db_name': db_name,
                'message': f'연결 테스트 오류: {str(e)}',
                'error': 'TEST_ERROR'
            }
    
    def _test_mssql(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """MSSQL 연결 테스트"""
        try:
            import pymssql
            
            conn = pymssql.connect(
                server=config['host'],
                port=config['port'],
                user=config['user'],
                password=config['password'],
                database=config['database'],
                timeout=10,
                login_timeout=10
            )
            
            cursor = conn.cursor()
            cursor.execute("SELECT @@VERSION, DB_NAME()")
            version, db_name = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'message': '연결 성공',
                'details': {
                    'database': db_name,
                    'version': version[:100],
                    'host': config['host'],
                    'port': config['port']
                }
            }
        
        except ImportError:
            return {
                'success': False,
                'message': 'pymssql 라이브러리 미설치',
                'error': 'LIBRARY_NOT_INSTALLED',
                'install_command': 'pip install pymssql'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'MSSQL 연결 실패: {str(e)}',
                'error': 'CONNECTION_FAILED',
                'details': {
                    'host': config['host'],
                    'port': config['port'],
                    'database': config['database']
                }
            }
    
    def _test_mysql(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """MySQL 연결 테스트"""
        try:
            import pymysql
            
            conn = pymysql.connect(
                host=config['host'],
                port=config['port'],
                user=config['user'],
                password=config['password'],
                database=config['database'],
                connect_timeout=10
            )
            
            cursor = conn.cursor()
            cursor.execute("SELECT VERSION(), DATABASE()")
            version, db_name = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'message': '연결 성공',
                'details': {
                    'database': db_name,
                    'version': version,
                    'host': config['host'],
                    'port': config['port']
                }
            }
        
        except ImportError:
            return {
                'success': False,
                'message': 'pymysql 라이브러리 미설치',
                'error': 'LIBRARY_NOT_INSTALLED',
                'install_command': 'pip install pymysql'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'MySQL 연결 실패: {str(e)}',
                'error': 'CONNECTION_FAILED',
                'details': {
                    'host': config['host'],
                    'port': config['port'],
                    'database': config['database']
                }
            }
    
    def _test_postgresql(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """PostgreSQL 연결 테스트"""
        try:
            import psycopg2
            
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                user=config['user'],
                password=config['password'],
                database=config['database'],
                connect_timeout=10
            )
            
            cursor = conn.cursor()
            cursor.execute("SELECT version(), current_database()")
            version, db_name = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'message': '연결 성공',
                'details': {
                    'database': db_name,
                    'version': version[:100],
                    'host': config['host'],
                    'port': config['port']
                }
            }
        
        except ImportError:
            return {
                'success': False,
                'message': 'psycopg2 라이브러리 미설치',
                'error': 'LIBRARY_NOT_INSTALLED',
                'install_command': 'pip install psycopg2-binary'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'PostgreSQL 연결 실패: {str(e)}',
                'error': 'CONNECTION_FAILED',
                'details': {
                    'host': config['host'],
                    'port': config['port'],
                    'database': config['database']
                }
            }
    
    def test_profile(self, profile_name: str) -> Dict[str, Any]:
        """
        프로필의 모든 연결 테스트
        
        Args:
            profile_name: 프로필 이름 (예: korea_only)
        """
        profiles = self.profiles_config.get('profiles', {})
        
        if profile_name not in profiles:
            return {
                'success': False,
                'profile_name': profile_name,
                'message': f'프로필을 찾을 수 없음: {profile_name}',
                'error': 'PROFILE_NOT_FOUND',
                'available_profiles': list(profiles.keys())
            }
        
        profile = profiles[profile_name]
        connections = profile.get('connections', {})
        
        results = {}
        success_count = 0
        total_count = 0
        
        for site_name, db_names in connections.items():
            results[site_name] = {}
            
            for db_name in db_names:
                result = self.test_single_connection(site_name, db_name)
                results[site_name][db_name] = result
                
                total_count += 1
                if result.get('success'):
                    success_count += 1
        
        return {
            'success': success_count == total_count,
            'profile_name': profile_name,
            'display_name': profile.get('name', profile_name),
            'message': f'{success_count}/{total_count} 연결 성공',
            'statistics': {
                'total': total_count,
                'success': success_count,
                'failed': total_count - success_count,
                'success_rate': (success_count / total_count * 100) if total_count > 0 else 0
            },
            'results': results
        }
    
    def test_all_sites(self) -> Dict[str, Any]:
        """모든 사이트의 모든 데이터베이스 테스트"""
        results = {}
        success_count = 0
        total_count = 0
        
        for site_name, site_config in self.databases_config.items():
            results[site_name] = {}
            databases = site_config.get('databases', {})
            
            for db_name in databases.keys():
                result = self.test_single_connection(site_name, db_name)
                results[site_name][db_name] = result
                
                total_count += 1
                if result.get('success'):
                    success_count += 1
        
        return {
            'success': success_count == total_count,
            'message': f'{success_count}/{total_count} 연결 성공',
            'statistics': {
                'total': total_count,
                'success': success_count,
                'failed': total_count - success_count,
                'success_rate': (success_count / total_count * 100) if total_count > 0 else 0
            },
            'results': results
        }

		
		# 기존 DatabaseConnectionManager 클래스에 다음 메서드들을 추가

    def get_table_list(self, site_name: str, db_name: str) -> Dict[str, Any]:
        """
        특정 데이터베이스의 테이블 목록 조회
        
        Args:
            site_name: 사이트 이름
            db_name: 데이터베이스 이름
        
        Returns:
            테이블 목록과 정보
        """
        # 사이트 설정 확인
        if site_name not in self.databases_config:
            return {
                'success': False,
                'site_name': site_name,
                'db_name': db_name,
                'message': f'사이트를 찾을 수 없음: {site_name}',
                'error': 'SITE_NOT_FOUND'
            }
        
        site_config = self.databases_config[site_name]
        databases = site_config.get('databases', {})
        
        # 데이터베이스 확인
        if db_name not in databases:
            return {
                'success': False,
                'site_name': site_name,
                'db_name': db_name,
                'message': f'데이터베이스를 찾을 수 없음: {db_name}',
                'error': 'DATABASE_NOT_FOUND'
            }
        
        # 연결 정보 구성
        db_type = site_config.get('type', 'mssql').lower()
        connection_config = {
            'host': site_config.get('host'),
            'port': site_config.get('port'),
            'user': site_config.get('user'),
            'password': site_config.get('password'),
            'database': databases[db_name],
            'type': db_type
        }
        
        # DB 타입별 테이블 조회
        try:
            if db_type in ['mssql', 'sqlserver']:
                result = self._get_mssql_tables(connection_config)
            elif db_type == 'mysql':
                result = self._get_mysql_tables(connection_config)
            elif db_type in ['postgresql', 'postgres']:
                result = self._get_postgresql_tables(connection_config)
            else:
                return {
                    'success': False,
                    'site_name': site_name,
                    'db_name': db_name,
                    'message': f'지원하지 않는 DB 타입: {db_type}',
                    'error': 'UNSUPPORTED_DB_TYPE'
                }
            
            # 결과에 사이트/DB 정보 추가
            result['site_name'] = site_name
            result['db_name'] = db_name
            result['db_type'] = db_type
            
            return result
        
        except Exception as e:
            logger.error(f"테이블 조회 오류: {e}")
            return {
                'success': False,
                'site_name': site_name,
                'db_name': db_name,
                'message': f'테이블 조회 오류: {str(e)}',
                'error': 'QUERY_ERROR'
            }
    
    def _get_mssql_tables(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """MSSQL 테이블 목록 조회"""
        try:
            import pymssql
            
            conn = pymssql.connect(
                server=config['host'],
                port=config['port'],
                user=config['user'],
                password=config['password'],
                database=config['database'],
                timeout=10,
                login_timeout=10
            )
            
            cursor = conn.cursor()
            
            # 테이블 목록 조회
            cursor.execute("""
                SELECT 
                    TABLE_SCHEMA,
                    TABLE_NAME,
                    TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            """)
            
            tables = []
            for row in cursor.fetchall():
                tables.append({
                    'schema': row[0],
                    'name': row[1],
                    'type': row[2],
                    'full_name': f"{row[0]}.{row[1]}"
                })
            
            # 테이블 개수 조회
            cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
            total_tables = cursor.fetchone()[0]
            
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'message': f'{total_tables}개 테이블 조회 성공',
                'total_tables': total_tables,
                'tables': tables,
                'database': config['database']
            }
        
        except ImportError:
            return {
                'success': False,
                'message': 'pymssql 라이브러리 미설치',
                'error': 'LIBRARY_NOT_INSTALLED'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'MSSQL 테이블 조회 실패: {str(e)}',
                'error': 'QUERY_FAILED'
            }
    
    def _get_mysql_tables(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """MySQL 테이블 목록 조회"""
        try:
            import pymysql
            
            conn = pymysql.connect(
                host=config['host'],
                port=config['port'],
                user=config['user'],
                password=config['password'],
                database=config['database'],
                connect_timeout=10
            )
            
            cursor = conn.cursor()
            
            # 테이블 목록 조회
            cursor.execute("SHOW TABLES")
            
            tables = []
            for row in cursor.fetchall():
                table_name = row[0]
                tables.append({
                    'schema': config['database'],
                    'name': table_name,
                    'type': 'BASE TABLE',
                    'full_name': table_name
                })
            
            total_tables = len(tables)
            
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'message': f'{total_tables}개 테이블 조회 성공',
                'total_tables': total_tables,
                'tables': tables,
                'database': config['database']
            }
        
        except ImportError:
            return {
                'success': False,
                'message': 'pymysql 라이브러리 미설치',
                'error': 'LIBRARY_NOT_INSTALLED'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'MySQL 테이블 조회 실패: {str(e)}',
                'error': 'QUERY_FAILED'
            }
    
    def _get_postgresql_tables(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """PostgreSQL 테이블 목록 조회"""
        try:
            import psycopg2
            
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                user=config['user'],
                password=config['password'],
                database=config['database'],
                connect_timeout=10
            )
            
            cursor = conn.cursor()
            
            # 테이블 목록 조회
            cursor.execute("""
                SELECT 
                    schemaname,
                    tablename
                FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY schemaname, tablename
            """)
            
            tables = []
            for row in cursor.fetchall():
                tables.append({
                    'schema': row[0],
                    'name': row[1],
                    'type': 'BASE TABLE',
                    'full_name': f"{row[0]}.{row[1]}"
                })
            
            total_tables = len(tables)
            
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'message': f'{total_tables}개 테이블 조회 성공',
                'total_tables': total_tables,
                'tables': tables,
                'database': config['database']
            }
        
        except ImportError:
            return {
                'success': False,
                'message': 'psycopg2 라이브러리 미설치',
                'error': 'LIBRARY_NOT_INSTALLED'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'PostgreSQL 테이블 조회 실패: {str(e)}',
                'error': 'QUERY_FAILED'
            }

# 전역 인스턴스
_connection_manager = None


def get_connection_manager() -> DatabaseConnectionManager:
    """연결 관리자 싱글톤 인스턴스 반환"""
    global _connection_manager
    
    if _connection_manager is None:
        _connection_manager = DatabaseConnectionManager()
    
    return _connection_manager