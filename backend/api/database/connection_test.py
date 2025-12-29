"""
통합 데이터베이스 연결 테스트 모듈
- databases.json, connection_profiles.json, active_connections.json 통합
- ⭐ 연결 관리 기능 추가 (Equipment Mapping 지원)
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
        # ⭐ 프로젝트 루트 자동 탐지
        if not Path(config_dir).is_absolute():
            # 현재 파일 위치에서 프로젝트 루트 찾기
            current_file = Path(__file__)  # connection_test.py 위치
            project_root = current_file.parent.parent.parent.parent  # backend/api/database -> backend/api -> backend -> root
            self.config_dir = project_root / config_dir
        else:
            self.config_dir = Path(config_dir)
        
        logger.info(f"📂 Config directory: {self.config_dir.resolve()}")
        
        self.databases_config = {}
        self.profiles_config = {}
        self.active_config = {}
        
        # ⭐ 실제 연결 객체 저장소
        self.connections = {}
        self._active_connections = {}
        
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
                
                # ⭐ active_connections.json에서 활성 연결 복원
                # 두 가지 형식 지원: 1) active_sites 배열, 2) enabled_connections 구조
                
                # 형식 1: active_sites 배열 (신규)
                if 'active_sites' in self.active_config:
                    for site_name in self.active_config['active_sites']:
                        if site_name in self.databases_config:
                            databases = self.databases_config[site_name].get('databases', {})
                            if databases:
                                db_name = list(databases.keys())[0]
                                self._active_connections[site_name] = {
                                    'db_name': db_name,
                                    'timestamp': datetime.now().isoformat()
                                }
                                logger.info(f"  → 활성 연결 복원 (active_sites): {site_name}/{db_name}")
                
                # 형식 2: enabled_connections 구조 (기존)
                elif 'enabled_connections' in self.active_config:
                    enabled_conns = self.active_config['enabled_connections']
                    
                    for site_name, site_info in enabled_conns.items():
                        # enabled가 true인 사이트만 처리
                        if site_info.get('enabled', False):
                            if site_name in self.databases_config:
                                # enabled가 true인 첫 번째 데이터베이스 찾기
                                databases = site_info.get('databases', {})
                                
                                for db_name, db_enabled in databases.items():
                                    if db_enabled:
                                        # 첫 번째 활성 DB를 기본으로 사용
                                        self._active_connections[site_name] = {
                                            'db_name': db_name,
                                            'timestamp': datetime.now().isoformat()
                                        }
                                        logger.info(f"  → 활성 연결 복원 (enabled_connections): {site_name}/{db_name}")
                                        break  # 첫 번째 활성 DB만 사용
        
            # ⭐ 디버깅: 로드 결과 출력
            print("="*60)
            print("🔍 Configuration Loading Debug")
            print("="*60)
            print(f"databases_config: {len(self.databases_config)} sites")
            print(f"profiles_config: {len(self.profiles_config.get('profiles', {}))} profiles")
            print(f"active_config: {self.active_config}")
            print(f"_active_connections: {self._active_connections}")
            print("="*60)
								
								
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
    
    def test_profile_connections(self, profile_name: str) -> Dict[str, Any]:
        """
        프로필의 모든 연결 테스트
        
        Args:
            profile_name: 프로필 이름
        """
        profiles_data = self.profiles_config.get('profiles', {})
        
        if profile_name not in profiles_data:
            return {
                'success': False,
                'profile_name': profile_name,
                'message': f'프로필을 찾을 수 없음: {profile_name}',
                'error': 'PROFILE_NOT_FOUND',
                'available_profiles': list(profiles_data.keys())
            }
        
        profile_config = profiles_data[profile_name]
        connections = profile_config.get('connections', {})
        
        if not connections:
            return {
                'success': False,
                'profile_name': profile_name,
                'message': '프로필에 연결이 정의되지 않음',
                'error': 'NO_CONNECTIONS'
            }
        
        # 모든 연결 테스트
        results = []
        success_count = 0
        failure_count = 0
        
        for site_name, db_list in connections.items():
            for db_name in db_list:
                result = self.test_single_connection(site_name, db_name)
                results.append(result)
                
                if result['success']:
                    success_count += 1
                else:
                    failure_count += 1
        
        overall_success = failure_count == 0
        
        return {
            'success': overall_success,
            'profile_name': profile_name,
            'display_name': profile_config.get('name', profile_name),
            'total': len(results),
            'success_count': success_count,
            'failure_count': failure_count,
            'results': results,
            'message': f'테스트 완료: 성공 {success_count}, 실패 {failure_count}'
        }
    
    def test_all_connections(self) -> Dict[str, Any]:
        """모든 사이트의 모든 데이터베이스 연결 테스트"""
        results = []
        success_count = 0
        failure_count = 0
        
        for site_name, site_config in self.databases_config.items():
            databases = site_config.get('databases', {})
            
            for db_name in databases.keys():
                result = self.test_single_connection(site_name, db_name)
                results.append(result)
                
                if result['success']:
                    success_count += 1
                else:
                    failure_count += 1
        
        overall_success = failure_count == 0
        
        return {
            'success': overall_success,
            'total': len(results),
            'success_count': success_count,
            'failure_count': failure_count,
            'results': results,
            'message': f'테스트 완료: 성공 {success_count}, 실패 {failure_count}'
        }
    
    def get_table_list(self, site_name: str, db_name: str) -> Dict[str, Any]:
        """
        특정 데이터베이스의 테이블 목록 조회
        
        Args:
            site_name: 사이트 이름
            db_name: 데이터베이스 이름
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
    
    # ============================================
    # ⭐ 새로 추가: 연결 관리 기능
    # ============================================
    
    def get_connection(self, site_name: str, db_name: str):
        """
        데이터베이스 연결 반환 (재사용 또는 새로 생성)
        
        Args:
            site_name: 사이트 이름 (예: 'korea_site1')
            db_name: 데이터베이스 이름 (예: 'line1')
        
        Returns:
            connection: 데이터베이스 연결 객체
        
        Raises:
            Exception: 연결 실패 시
        """
        try:
            # 기존 연결 확인
            if site_name in self.connections and db_name in self.connections[site_name]:
                conn = self.connections[site_name][db_name]
                
                # 연결 유효성 검사
                if self._is_connection_alive(conn):
                    logger.info(f"♻️ Reusing existing connection: {site_name}/{db_name}")
                    self.mark_connection_active(site_name, db_name)
                    return conn
                else:
                    logger.warning(f"💀 Existing connection is dead: {site_name}/{db_name}")
                    # 죽은 연결 제거
                    del self.connections[site_name][db_name]
            
            # 새 연결 생성
            logger.info(f"🔌 Creating new connection: {site_name}/{db_name}")
            conn = self._create_connection(site_name, db_name)
            
            # 연결 저장
            if site_name not in self.connections:
                self.connections[site_name] = {}
            self.connections[site_name][db_name] = conn
            
            # 활성 연결로 표시
            self.mark_connection_active(site_name, db_name)
            
            logger.info(f"✅ Connection created and stored: {site_name}/{db_name}")
            
            return conn
            
        except Exception as e:
            logger.error(f"❌ Failed to get connection {site_name}/{db_name}: {e}", exc_info=True)
            raise
    
    def _create_connection(self, site_name: str, db_name: str):
        """
        새 데이터베이스 연결 생성
        
        Args:
            site_name: 사이트 이름
            db_name: 데이터베이스 이름
        
        Returns:
            connection: 데이터베이스 연결 객체
        """
        # 사이트 설정 확인
        if site_name not in self.databases_config:
            raise ValueError(f"Site not found in config: {site_name}")
        
        site_config = self.databases_config[site_name]
        databases = site_config.get('databases', {})
        
        # 데이터베이스 확인
        if db_name not in databases:
            raise ValueError(f"Database not found in config: {db_name}")
        
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
        
        # 필수 필드 검증
        required_fields = ['host', 'user', 'password', 'database']
        missing_fields = [f for f in required_fields if not connection_config.get(f)]
        
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
        
        # DB 타입별 연결 생성
        if db_type in ['mssql', 'sqlserver']:
            conn = self._create_mssql_connection(connection_config)
        elif db_type == 'mysql':
            conn = self._create_mysql_connection(connection_config)
        elif db_type in ['postgresql', 'postgres']:
            conn = self._create_postgresql_connection(connection_config)
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
        
        return conn
    
    def _create_mssql_connection(self, config: Dict[str, Any]):
        """MSSQL 연결 생성"""
        import pymssql
        
        conn = pymssql.connect(
            server=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database'],
            timeout=30,
            login_timeout=30
        )
        
        return conn
    
    def _create_mysql_connection(self, config: Dict[str, Any]):
        """MySQL 연결 생성"""
        import pymysql
        
        conn = pymysql.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database'],
            connect_timeout=30
        )
        
        return conn
    
    def _create_postgresql_connection(self, config: Dict[str, Any]):
        """PostgreSQL 연결 생성"""
        import psycopg2
        
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database'],
            connect_timeout=30
        )
        
        return conn
    
    def _is_connection_alive(self, conn) -> bool:
        """
        연결 유효성 검사
        
        Args:
            conn: 데이터베이스 연결
        
        Returns:
            bool: 연결이 유효하면 True
        """
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return True
        except:
            return False
    
    def get_active_connections(self) -> List[str]:
        """
        현재 활성화된 연결 목록 반환
        
        Returns:
            list: 활성 site_name 리스트
        
        Example:
            ['korea_site1', 'vietnam_site1']
        """
        try:
            active_sites = list(self._active_connections.keys())
            logger.info(f"📋 Active connections: {active_sites}")
            return active_sites
        except Exception as e:
            logger.error(f"❌ Error getting active connections: {e}")
            return []
    
    def mark_connection_active(self, site_name: str, db_name: str):
        """
        연결을 활성으로 표시
        
        Args:
            site_name: 사이트 이름
            db_name: 데이터베이스 이름
        """
        self._active_connections[site_name] = {
            'db_name': db_name,
            'timestamp': datetime.now().isoformat()
        }
        logger.debug(f"✅ Marked connection as active: {site_name}/{db_name}")
        
        # active_connections.json 업데이트
        self._save_active_connections()
    
    def mark_connection_inactive(self, site_name: str):
        """
        연결을 비활성으로 표시
        
        Args:
            site_name: 사이트 이름
        """
        if site_name in self._active_connections:
            del self._active_connections[site_name]
            logger.info(f"🔴 Marked connection as inactive: {site_name}")
            
            # active_connections.json 업데이트
            self._save_active_connections()
    
    def get_active_connection_info(self, site_name: str) -> Optional[Dict[str, Any]]:
        """
        특정 사이트의 활성 연결 정보 반환
        
        Args:
            site_name: 사이트 이름
        
        Returns:
            dict: 연결 정보 또는 None
        """
        return self._active_connections.get(site_name)
    
    def close_connection(self, site_name: str, db_name: str = None):
        """
        특정 연결 닫기
        
        Args:
            site_name: 사이트 이름
            db_name: 데이터베이스 이름 (None이면 해당 사이트의 모든 연결)
        """
        try:
            if site_name in self.connections:
                if db_name:
                    # 특정 DB 연결만 닫기
                    if db_name in self.connections[site_name]:
                        self.connections[site_name][db_name].close()
                        del self.connections[site_name][db_name]
                        logger.info(f"🔒 Closed connection: {site_name}/{db_name}")
                else:
                    # 해당 사이트의 모든 연결 닫기
                    for db in list(self.connections[site_name].keys()):
                        self.connections[site_name][db].close()
                        del self.connections[site_name][db]
                    logger.info(f"🔒 Closed all connections for site: {site_name}")
                
                # 활성 연결에서 제거
                self.mark_connection_inactive(site_name)
                
        except Exception as e:
            logger.error(f"❌ Error closing connection: {e}")
    
    def close_all_connections(self):
        """모든 연결 닫기"""
        for site_name in list(self.connections.keys()):
            self.close_connection(site_name)
        
        self._active_connections = {}
        logger.info("🔒 All connections closed")
        
        # active_connections.json 업데이트
        self._save_active_connections()

    
    def get_equipment_state(self, site_name: str, db_name: str = None, equipment_id: int = None) -> Dict[str, Any]:
        """
        설비 상태 조회 (log.EquipmentState 테이블)
        
        Phase 1: 신규 추가 메서드
        기존 기능에 영향 없음
        
        Args:
            site_name: 사이트 이름
            db_name: 데이터베이스 이름 (None이면 활성 연결의 DB)
            equipment_id: 특정 설비 ID (None이면 전체 조회)
        
        Returns:
            dict: {
                'equipment_states': [
                    {
                        'equipment_id': 1,
                        'status': 'RUN',
                        'occurred_at': '2025-12-29T12:00:00'
                    },
                    ...
                ],
                'total': 117
            }
        """
        try:
            # DB 이름이 없으면 활성 연결에서 가져오기
            if db_name is None:
                conn_info = self.get_active_connection_info(site_name)
                if not conn_info:
                    raise ValueError(f"No active connection for site: {site_name}")
                db_name = conn_info['db_name']
            
            # 연결 가져오기
            conn = self.get_connection(site_name, db_name)
            if not conn:
                raise ConnectionError(f"Failed to get connection: {site_name}/{db_name}")
            
            cursor = conn.cursor()
            
            # 쿼리 생성
            if equipment_id:
                # 특정 설비만 조회
                query = """
                    SELECT 
                        es.EquipmentID,
                        es.Status,
                        es.OccurredAtUtc
                    FROM log.EquipmentState es
                    WHERE es.EquipmentID = ?
                        AND es.OccurredAtUtc = (
                            SELECT MAX(OccurredAtUtc)
                            FROM log.EquipmentState
                            WHERE EquipmentID = es.EquipmentID
                        )
                    ORDER BY es.EquipmentID
                """
                cursor.execute(query, (equipment_id,))
            else:
                # 전체 설비 조회
                query = """
                    SELECT 
                        es.EquipmentID,
                        es.Status,
                        es.OccurredAtUtc
                    FROM log.EquipmentState es
                    WHERE es.OccurredAtUtc = (
                        SELECT MAX(OccurredAtUtc)
                        FROM log.EquipmentState
                        WHERE EquipmentID = es.EquipmentID
                    )
                    ORDER BY es.EquipmentID
                """
                cursor.execute(query)
            
            rows = cursor.fetchall()
            cursor.close()
            
            # 결과 변환
            equipment_states = [
                {
                    'equipment_id': row[0],
                    'status': row[1],
                    'occurred_at': row[2].isoformat() if row[2] else None
                }
                for row in rows
            ]
            
            logger.info(f"✅ Equipment state queried: {len(equipment_states)} records from {site_name}/{db_name}")
            
            return {
                'equipment_states': equipment_states,
                'total': len(equipment_states),
                'site_name': site_name,
                'db_name': db_name,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get equipment state: {e}", exc_info=True)
            return {
                'equipment_states': [],
                'total': 0,
                'error': str(e)
            }
    
    def _save_active_connections(self):
        """active_connections.json 파일 저장"""
        try:
            active_file = self.config_dir / "active_connections.json"
            
            # active_sites 리스트 생성
            active_sites = list(self._active_connections.keys())
            
            # 파일 저장
            with open(active_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'active_sites': active_sites,
                    'last_updated': datetime.now().isoformat()
                }, f, indent=2, ensure_ascii=False)
            
            logger.debug(f"💾 Saved active connections to {active_file}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save active_connections.json: {e}")


# ============================================
# 전역 인스턴스 (싱글톤 패턴)
# ============================================

_connection_manager = None


def get_connection_manager() -> DatabaseConnectionManager:
    """
    연결 관리자 싱글톤 인스턴스 반환
    
    Returns:
        DatabaseConnectionManager: 연결 관리자 인스턴스
    """
    global _connection_manager
    
    if _connection_manager is None:
        _connection_manager = DatabaseConnectionManager()
    
    return _connection_manager


# ============================================
# Alias for compatibility
# ============================================
ConnectionManager = DatabaseConnectionManager  # ✅ Alias 추가


# ============================================
# Export list
# ============================================
__all__ = [
    'DatabaseConnectionManager',
    'ConnectionManager',  # Alias
    'get_connection_manager',
]