#!/usr/bin/env python3
# scripts/test_remote_connection.py
"""
다중 사이트 데이터베이스 연결 테스트

모든 설정된 사이트와 데이터베이스의 연결을 테스트합니다.

사용법:
    python scripts/test_remote_connection.py              # 활성 연결만 테스트
    python scripts/test_remote_connection.py --all        # 모든 연결 테스트
    python scripts/test_remote_connection.py --site korea_site1  # 특정 사이트만
"""

import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple
import argparse

# 프로젝트 루트를 Python path에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError, SQLAlchemyError


class Colors:
    """터미널 색상 코드"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


class DatabaseTester:
    """데이터베이스 연결 테스트 클래스"""
    
    def __init__(self):
        self.results = []
        self.start_time = None
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.warning_tests = 0
        
    def print_header(self, text: str):
        """헤더 출력"""
        print(f"\n{Colors.HEADER}{'='*70}{Colors.END}")
        print(f"{Colors.HEADER}{text:^70}{Colors.END}")
        print(f"{Colors.HEADER}{'='*70}{Colors.END}\n")
    
    def print_step(self, step_num: str, title: str):
        """단계 제목 출력"""
        print(f"\n{Colors.CYAN}{step_num} {title}{Colors.END}")
    
    def print_test(self, description: str):
        """테스트 시작 출력"""
        print(f"[TEST] {description}...", end=' ')
        sys.stdout.flush()
    
    def print_success(self, message: str = "성공"):
        """성공 메시지"""
        print(f"{Colors.GREEN}✓ {message}{Colors.END}")
        self.passed_tests += 1
    
    def print_failure(self, message: str = "실패"):
        """실패 메시지"""
        print(f"{Colors.RED}✗ {message}{Colors.END}")
        self.failed_tests += 1
    
    def print_warning(self, message: str):
        """경고 메시지"""
        print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")
        self.warning_tests += 1
    
    def print_info(self, key: str, value: str, indent: int = 1):
        """정보 출력"""
        indent_str = "  " * indent
        print(f"{indent_str}• {key}: {value}")
    
    def test_env_file(self) -> bool:
        """환경 변수 파일 확인"""
        self.print_step("📋 Step 0:", "환경 변수 파일 확인")
        
        self.total_tests += 1
        env_file = PROJECT_ROOT / '.env'
        
        self.print_test(".env 파일 존재 확인")
        
        if env_file.exists():
            self.print_success(f".env 파일 발견")
            self.print_info("파일 위치", str(env_file))
            self.print_info("파일 크기", f"{env_file.stat().st_size} bytes")
            return True
        else:
            self.print_failure(f".env 파일 없음: {env_file}")
            return False
    
    def load_settings(self):
        """설정 로드"""
        self.print_step("⚙️ Step 1:", "설정 모듈 로드")
        
        self.total_tests += 1
        self.print_test("backend.config.multi_site_settings 임포트")
        
        try:
            from backend.config.multi_site_settings import get_multi_site_settings
            self.settings = get_multi_site_settings()
            
            self.print_success("설정 모듈 로드 성공")
            self.print_info("환경", self.settings.ENVIRONMENT)
            self.print_info("기본 사이트", self.settings.DEFAULT_SITE)
            self.print_info("기본 DB", self.settings.DEFAULT_DB_NAME)
            
            return True
            
        except Exception as e:
            self.print_failure(f"설정 로드 실패: {e}")
            return False
    
    def load_connection_selector(self):
        """연결 선택자 로드"""
        self.print_step("🔌 Step 2:", "연결 선택자 로드")
        
        self.total_tests += 1
        self.print_test("backend.config.connection_selector 임포트")
        
        try:
            from backend.config.connection_selector import get_connection_selector
            self.selector = get_connection_selector()
            
            self.print_success("연결 선택자 로드 성공")
            
            # 활성 연결 정보
            enabled = self.selector.get_all_enabled_connections()
            total_sites = len(self.settings.get_all_sites())
            enabled_sites = len(enabled)
            total_dbs = sum(len(self.settings.get_site_databases(site)) 
                          for site in self.settings.get_all_sites())
            enabled_dbs = sum(len(dbs) for dbs in enabled.values())
            
            self.print_info("총 사이트", f"{enabled_sites}/{total_sites} 활성화")
            self.print_info("총 데이터베이스", f"{enabled_dbs}/{total_dbs} 활성화")
            self.print_info("현재 프로필", self.selector.current_profile or "None")
            
            return True
            
        except Exception as e:
            self.print_failure(f"연결 선택자 로드 실패: {e}")
            return False
    
    def test_single_connection(
        self, 
        site_id: str, 
        db_name: str,
        detailed: bool = True
    ) -> Tuple[bool, Dict]:
        """단일 연결 테스트"""
        
        result = {
            'site_id': site_id,
            'db_name': db_name,
            'success': False,
            'connection_time': 0,
            'db_version': None,
            'db_type': None,
            'table_count': 0,
            'error': None
        }
        
        try:
            # 데이터베이스 설정 가져오기
            db_config = self.settings.get_database_config(site_id, db_name)
            result['db_type'] = db_config.db_type
            
            # 연결 시작
            start_time = time.time()
            engine = create_engine(
                db_config.connection_url,
                pool_pre_ping=True,
                connect_args={'connect_timeout': 10}
            )
            
            # 연결 테스트
            with engine.connect() as conn:
                # 버전 확인
                if db_config.db_type == 'postgresql':
                    version_result = conn.execute(text("SELECT version()"))
                    version = version_result.scalar()
                    result['db_version'] = version.split(',')[0] if version else 'Unknown'
                
                elif db_config.db_type == 'mysql':
                    version_result = conn.execute(text("SELECT VERSION()"))
                    result['db_version'] = version_result.scalar()
                
                elif db_config.db_type == 'mssql':
                    version_result = conn.execute(text("SELECT @@VERSION"))
                    version = version_result.scalar()
                    result['db_version'] = version.split('\n')[0][:50] if version else 'Unknown'
                
                # 테이블 수 확인 (선택적)
                if detailed:
                    inspector = inspect(engine)
                    tables = inspector.get_table_names()
                    result['table_count'] = len(tables)
            
            result['connection_time'] = time.time() - start_time
            result['success'] = True
            
            engine.dispose()
            
        except OperationalError as e:
            result['error'] = f"연결 오류: {str(e)}"
        except SQLAlchemyError as e:
            result['error'] = f"SQL 오류: {str(e)}"
        except Exception as e:
            result['error'] = f"예외 발생: {str(e)}"
        
        return result['success'], result
    
    def test_active_connections(self, detailed: bool = True):
        """활성 연결 테스트"""
        self.print_step("🌐 Step 3:", "활성 연결 테스트")
        
        enabled = self.selector.get_all_enabled_connections()
        
        if not enabled:
            self.print_warning("활성화된 연결이 없습니다")
            return
        
        print(f"\n{Colors.BOLD}활성 연결 목록:{Colors.END}")
        for site_id, db_list in enabled.items():
            print(f"  • {site_id}: {', '.join(db_list)}")
        
        print(f"\n{Colors.BOLD}연결 테스트 시작...{Colors.END}\n")
        
        for site_id, db_list in enabled.items():
            for db_name in db_list:
                self.total_tests += 1
                
                print(f"\n{Colors.CYAN}[{site_id}/{db_name}]{Colors.END}")
                self.print_test(f"연결 시도")
                
                success, result = self.test_single_connection(
                    site_id, 
                    db_name, 
                    detailed
                )
                
                if success:
                    self.print_success(f"연결 성공 ({result['connection_time']:.3f}초)")
                    
                    if detailed:
                        self.print_info("호스트", 
                            self.settings.get_database_config(site_id, db_name).host)
                        self.print_info("포트", 
                            str(self.settings.get_database_config(site_id, db_name).port))
                        self.print_info("데이터베이스", 
                            self.settings.get_database_config(site_id, db_name).database)
                        
                        if result['db_version']:
                            self.print_info("버전", result['db_version'])
                        
                        if result['table_count'] > 0:
                            self.print_info("테이블 수", str(result['table_count']))
                else:
                    self.print_failure("연결 실패")
                    print(f"    {Colors.RED}오류: {result['error']}{Colors.END}")
                
                self.results.append(result)
    
    def test_all_connections(self, detailed: bool = False):
        """모든 연결 테스트 (활성/비활성 포함)"""
        self.print_step("🌍 Step 3:", "전체 연결 테스트")
        
        all_sites = self.settings.get_all_sites()
        
        print(f"\n{Colors.BOLD}전체 사이트 목록:{Colors.END}")
        for site_id in all_sites:
            dbs = self.settings.get_site_databases(site_id)
            print(f"  • {site_id}: {', '.join(dbs)}")
        
        print(f"\n{Colors.BOLD}연결 테스트 시작...{Colors.END}\n")
        
        for site_id in all_sites:
            db_list = self.settings.get_site_databases(site_id)
            
            for db_name in db_list:
                self.total_tests += 1
                
                # 활성화 여부 확인
                is_enabled = self.selector.is_database_enabled(site_id, db_name)
                status = f"{Colors.GREEN}[활성]{Colors.END}" if is_enabled else f"{Colors.YELLOW}[비활성]{Colors.END}"
                
                print(f"\n{Colors.CYAN}[{site_id}/{db_name}]{Colors.END} {status}")
                self.print_test(f"연결 시도")
                
                success, result = self.test_single_connection(
                    site_id, 
                    db_name, 
                    detailed=False  # 전체 테스트 시에는 간단하게
                )
                
                if success:
                    self.print_success(f"연결 성공 ({result['connection_time']:.3f}초)")
                else:
                    self.print_failure("연결 실패")
                    print(f"    {Colors.RED}오류: {result['error']}{Colors.END}")
                
                self.results.append(result)
    
    def test_specific_site(self, site_id: str, detailed: bool = True):
        """특정 사이트만 테스트"""
        self.print_step("🎯 Step 3:", f"특정 사이트 테스트: {site_id}")
        
        try:
            db_list = self.settings.get_site_databases(site_id)
            
            print(f"\n{Colors.BOLD}테스트할 데이터베이스:{Colors.END}")
            for db_name in db_list:
                is_enabled = self.selector.is_database_enabled(site_id, db_name)
                status = "활성" if is_enabled else "비활성"
                print(f"  • {db_name} ({status})")
            
            print(f"\n{Colors.BOLD}연결 테스트 시작...{Colors.END}\n")
            
            for db_name in db_list:
                self.total_tests += 1
                
                print(f"\n{Colors.CYAN}[{site_id}/{db_name}]{Colors.END}")
                self.print_test(f"연결 시도")
                
                success, result = self.test_single_connection(
                    site_id, 
                    db_name, 
                    detailed
                )
                
                if success:
                    self.print_success(f"연결 성공 ({result['connection_time']:.3f}초)")
                    
                    if detailed:
                        self.print_info("호스트", 
                            self.settings.get_database_config(site_id, db_name).host)
                        self.print_info("데이터베이스", 
                            self.settings.get_database_config(site_id, db_name).database)
                        
                        if result['db_version']:
                            self.print_info("버전", result['db_version'])
                else:
                    self.print_failure("연결 실패")
                    print(f"    {Colors.RED}오류: {result['error']}{Colors.END}")
                
                self.results.append(result)
        
        except ValueError as e:
            self.print_failure(str(e))
    
    def test_connection_pool(self):
        """연결 풀 테스트"""
        self.print_step("🔄 Step 4:", "연결 풀 테스트")
        
        # 기본 사이트/DB로 테스트
        site_id = self.settings.DEFAULT_SITE
        db_name = self.settings.DEFAULT_DB_NAME
        
        # 활성화 확인
        if not self.selector.is_database_enabled(site_id, db_name):
            self.print_warning(f"기본 연결이 비활성화됨: {site_id}/{db_name}")
            return
        
        self.total_tests += 1
        self.print_test("연결 풀 생성 및 테스트")
        
        try:
            db_config = self.settings.get_database_config(site_id, db_name)
            
            engine = create_engine(
                db_config.connection_url,
                pool_size=self.settings.DB_POOL_SIZE,
                max_overflow=self.settings.DB_MAX_OVERFLOW,
                pool_timeout=self.settings.DB_POOL_TIMEOUT,
                pool_recycle=self.settings.DB_POOL_RECYCLE
            )
            
            # 여러 연결 동시 테스트
            connections = []
            for i in range(3):
                conn = engine.connect()
                conn.execute(text("SELECT 1"))
                connections.append(conn)
            
            # 연결 종료
            for conn in connections:
                conn.close()
            
            self.print_success("연결 풀 정상 작동")
            self.print_info("Pool Size", str(self.settings.DB_POOL_SIZE))
            self.print_info("Max Overflow", str(self.settings.DB_MAX_OVERFLOW))
            self.print_info("Pool Timeout", f"{self.settings.DB_POOL_TIMEOUT}초")
            
            engine.dispose()
            
        except Exception as e:
            self.print_failure(f"연결 풀 테스트 실패: {e}")
    
    def print_summary(self):
        """테스트 결과 요약"""
        self.print_header("📊 테스트 결과 요약")
        
        # 통계
        success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        
        print(f"{Colors.BOLD}테스트 결과:{Colors.END}")
        print(f"  • {Colors.GREEN}✓ 성공: {self.passed_tests}{Colors.END}")
        print(f"  • {Colors.RED}✗ 실패: {self.failed_tests}{Colors.END}")
        print(f"  • {Colors.YELLOW}⚠ 경고: {self.warning_tests}{Colors.END}")
        print(f"  • 전체: {self.total_tests}")
        print(f"  • 성공률: {success_rate:.1f}%")
        
        if self.start_time:
            elapsed = time.time() - self.start_time
            print(f"  • 소요 시간: {elapsed:.2f}초")
        
        # 연결 결과 상세
        if self.results:
            print(f"\n{Colors.BOLD}연결 테스트 상세 결과:{Colors.END}")
            
            successful = [r for r in self.results if r['success']]
            failed = [r for r in self.results if not r['success']]
            
            if successful:
                print(f"\n{Colors.GREEN}성공한 연결 ({len(successful)}개):{Colors.END}")
                for result in successful:
                    print(f"  ✓ {result['site_id']}/{result['db_name']} "
                          f"({result['connection_time']:.3f}초)")
            
            if failed:
                print(f"\n{Colors.RED}실패한 연결 ({len(failed)}개):{Colors.END}")
                for result in failed:
                    print(f"  ✗ {result['site_id']}/{result['db_name']}")
                    print(f"    오류: {result['error']}")
        
        # 최종 판정
        print(f"\n{Colors.HEADER}{'='*70}{Colors.END}")
        
        if self.failed_tests == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}🎉 모든 테스트 통과!{Colors.END}")
            print(f"{Colors.HEADER}{'='*70}{Colors.END}\n")
            print(f"다중 사이트 연결이 정상적으로 작동합니다!")
        else:
            print(f"{Colors.RED}{Colors.BOLD}❌ 일부 테스트 실패{Colors.END}")
            print(f"{Colors.HEADER}{'='*70}{Colors.END}\n")
            print(f"실패한 연결을 확인하고 .env 파일 또는 네트워크 설정을 점검하세요.")


def main():
    """메인 실행 함수"""
    
    # 명령줄 인자 파싱
    parser = argparse.ArgumentParser(
        description='다중 사이트 데이터베이스 연결 테스트'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='모든 연결 테스트 (활성/비활성 포함)'
    )
    parser.add_argument(
        '--site',
        type=str,
        help='특정 사이트만 테스트'
    )
    parser.add_argument(
        '--simple',
        action='store_true',
        help='간단한 테스트 (상세 정보 생략)'
    )
    
    args = parser.parse_args()
    
    # 테스터 초기화
    tester = DatabaseTester()
    tester.start_time = time.time()
    
    # 헤더 출력
    tester.print_header("🚀 다중 사이트 데이터베이스 연결 테스트")
    
    # Step 0: .env 파일 확인
    if not tester.test_env_file():
        print(f"\n{Colors.RED}테스트 중단: .env 파일이 필요합니다{Colors.END}")
        sys.exit(1)
    
    # Step 1: 설정 로드
    if not tester.load_settings():
        print(f"\n{Colors.RED}테스트 중단: 설정을 로드할 수 없습니다{Colors.END}")
        sys.exit(1)
    
    # Step 2: 연결 선택자 로드
    if not tester.load_connection_selector():
        print(f"\n{Colors.RED}테스트 중단: 연결 선택자를 로드할 수 없습니다{Colors.END}")
        sys.exit(1)
    
    # Step 3: 연결 테스트
    detailed = not args.simple
    
    if args.site:
        # 특정 사이트만 테스트
        tester.test_specific_site(args.site, detailed=detailed)
    elif args.all:
        # 모든 연결 테스트
        tester.test_all_connections(detailed=False)
    else:
        # 활성 연결만 테스트 (기본)
        tester.test_active_connections(detailed=detailed)
    
    # Step 4: 연결 풀 테스트 (활성 연결이 있는 경우)
    if not args.all and tester.results:
        tester.test_connection_pool()
    
    # 결과 요약
    tester.print_summary()
    
    # 종료 코드
    sys.exit(0 if tester.failed_tests == 0 else 1)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}테스트가 사용자에 의해 중단되었습니다.{Colors.END}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Colors.RED}예상치 못한 오류 발생: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
        sys.exit(1)