#!/usr/bin/env python3
# diagnose_mssql_connection.py
"""
MSSQL 데이터베이스 연결 진단 스크립트

MSSQL 연결 문제를 단계별로 진단하고 해결 방법을 제시합니다.
"""

import sys
import json
from pathlib import Path
from typing import Dict, Optional

# 프로젝트 루트
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))


class Colors:
    """터미널 색상"""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(text: str):
    """헤더 출력"""
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}{text:^70}{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")


def print_step(num: str, title: str):
    """단계 출력"""
    print(f"\n{Colors.CYAN}[Step {num}] {title}{Colors.END}")
    print("-" * 70)


def print_success(msg: str):
    """성공 메시지"""
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")


def print_error(msg: str):
    """에러 메시지"""
    print(f"{Colors.RED}✗ {msg}{Colors.END}")


def print_warning(msg: str):
    """경고 메시지"""
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")


def print_info(key: str, value: str):
    """정보 출력"""
    print(f"  • {key}: {value}")


def check_databases_json() -> Optional[Dict]:
    """databases.json 파일 확인"""
    print_step("1", "databases.json 파일 확인")
    
    json_path = PROJECT_ROOT / 'config' / 'databases.json'
    
    if not json_path.exists():
        print_error(f"databases.json 파일을 찾을 수 없습니다: {json_path}")
        print("\n해결 방법:")
        print("  1. config 폴더 생성: mkdir -p config")
        print("  2. databases.json.example 파일을 복사: cp databases.json.example config/databases.json")
        print("  3. 실제 연결 정보로 수정")
        return None
    
    print_success(f"파일 존재: {json_path}")
    
    # JSON 파싱
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print_success("JSON 파싱 성공")
        
        # 사이트별 type 확인
        print("\n사이트별 데이터베이스 타입:")
        for site_id, config in data.items():
            db_type = config.get('type', 'Unknown')
            
            # 대소문자 체크
            if db_type.upper() == 'MSSQL':
                if db_type != 'mssql':
                    print_warning(f"{site_id}: '{db_type}' (대문자 사용 중 - 수정 필요)")
                    print(f"    → 'mssql' (소문자)로 변경하세요")
                else:
                    print_success(f"{site_id}: '{db_type}'")
            else:
                print_info(site_id, db_type)
        
        return data
        
    except json.JSONDecodeError as e:
        print_error(f"JSON 파싱 실패: {e}")
        return None
    except Exception as e:
        print_error(f"파일 읽기 실패: {e}")
        return None


def check_pyodbc():
    """pyodbc 패키지 확인"""
    print_step("2", "pyodbc 패키지 확인")
    
    try:
        import pyodbc
        print_success(f"pyodbc 버전: {pyodbc.version}")
        return True
    except ImportError:
        print_error("pyodbc가 설치되지 않았습니다")
        print("\n해결 방법:")
        print("  pip install pyodbc")
        return False


def check_odbc_drivers():
    """ODBC 드라이버 확인"""
    print_step("3", "ODBC 드라이버 확인")
    
    try:
        import pyodbc
        
        drivers = pyodbc.drivers()
        
        if not drivers:
            print_error("설치된 ODBC 드라이버가 없습니다")
            return False
        
        print_success(f"{len(drivers)}개의 ODBC 드라이버 발견:")
        
        # MSSQL 드라이버 체크
        mssql_drivers = [d for d in drivers if 'SQL Server' in d]
        
        for driver in drivers:
            if 'SQL Server' in driver:
                print_success(f"  • {driver}")
            else:
                print_info("기타", driver)
        
        if not mssql_drivers:
            print_warning("SQL Server 드라이버를 찾을 수 없습니다")
            print("\n해결 방법:")
            print("  Windows: https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server")
            print("  Mac: brew install msodbcsql17")
            print("  Linux: 배포판별 설치 방법 참고")
            return False
        
        # 권장 드라이버 체크
        recommended = [
            'ODBC Driver 17 for SQL Server',
            'ODBC Driver 18 for SQL Server'
        ]
        
        found_recommended = any(d in drivers for d in recommended)
        
        if found_recommended:
            print_success("권장 드라이버 설치됨 (Driver 17 또는 18)")
        else:
            print_warning("Driver 17 또는 18을 권장합니다")
        
        return True
        
    except Exception as e:
        print_error(f"드라이버 확인 실패: {e}")
        return False


def check_connection_string():
    """연결 문자열 생성 확인"""
    print_step("4", "연결 문자열 생성 확인")
    
    try:
        from backend.config.multi_site_settings import get_multi_site_settings
        
        settings = get_multi_site_settings()
        print_success("설정 로드 완료")
        
        # 기본 사이트/DB 정보
        print(f"\n기본 연결 정보:")
        print_info("사이트", settings.DEFAULT_SITE)
        print_info("데이터베이스", settings.DEFAULT_DB_NAME)
        
        # 연결 설정 가져오기
        try:
            db_config = settings.get_database_config()
            
            print(f"\n데이터베이스 설정:")
            print_info("호스트", db_config.host)
            print_info("포트", str(db_config.port))
            print_info("타입", db_config.db_type)
            print_info("데이터베이스", db_config.database)
            print_info("사용자", db_config.user)
            
            # 연결 URL (비밀번호 마스킹)
            url = db_config.connection_url
            # 비밀번호 마스킹
            import re
            masked_url = re.sub(r'://([^:]+):([^@]+)@', r'://\1:***@', url)
            
            print(f"\n연결 문자열:")
            print(f"  {masked_url}")
            
            # 연결 문자열 옵션 체크
            if 'TrustServerCertificate=yes' in url:
                print_success("TrustServerCertificate 옵션 포함")
            else:
                print_warning("TrustServerCertificate 옵션 없음 (암호화 연결 시 필요)")
            
            if 'Encrypt=yes' in url:
                print_success("Encrypt 옵션 포함")
            else:
                print_warning("Encrypt 옵션 없음")
            
            return db_config
            
        except Exception as e:
            print_error(f"설정 가져오기 실패: {e}")
            return None
        
    except Exception as e:
        print_error(f"설정 로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_actual_connection(db_config):
    """실제 연결 테스트"""
    print_step("5", "실제 데이터베이스 연결 테스트")
    
    if not db_config:
        print_warning("연결 설정이 없어 테스트를 건너뜁니다")
        return False
    
    try:
        from sqlalchemy import create_engine, text
        
        print("연결 시도 중...")
        
        engine = create_engine(
            db_config.connection_url,
            pool_pre_ping=True,
            connect_args={
                'connect_timeout': 10,
                'timeout': 10
            }
        )
        
        # 연결 테스트
        with engine.connect() as conn:
            # SQL Server 버전 확인
            result = conn.execute(text("SELECT @@VERSION"))
            version = result.scalar()
            
            print_success("연결 성공!")
            print(f"\nSQL Server 정보:")
            # 첫 줄만 출력
            first_line = version.split('\n')[0] if version else 'Unknown'
            print(f"  {first_line[:100]}")
            
            # 데이터베이스 이름 확인
            result = conn.execute(text("SELECT DB_NAME()"))
            db_name = result.scalar()
            print_info("현재 데이터베이스", db_name)
            
            # 테이블 수 확인
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'"
            ))
            table_count = result.scalar()
            print_info("테이블 수", str(table_count))
        
        engine.dispose()
        return True
        
    except Exception as e:
        print_error("연결 실패!")
        print(f"\n에러 상세:")
        print(f"  {str(e)}")
        
        # 일반적인 에러 패턴 분석
        error_str = str(e).lower()
        
        print(f"\n{Colors.BOLD}가능한 원인:{Colors.END}")
        
        if 'login failed' in error_str or 'authentication failed' in error_str:
            print("  1. 사용자명 또는 비밀번호가 틀렸습니다")
            print("     → databases.json의 user, password 확인")
            
        elif 'cannot open database' in error_str:
            print("  1. 데이터베이스 이름이 틀렸습니다")
            print("     → databases.json의 databases 섹션 확인")
            
        elif 'timeout' in error_str:
            print("  1. 네트워크 연결 문제")
            print("     → 방화벽, VPN 설정 확인")
            print("  2. 서버가 응답하지 않음")
            print("     → 서버 주소, 포트 확인")
            
        elif 'ssl' in error_str or 'certificate' in error_str:
            print("  1. SSL/TLS 인증서 문제")
            print("     → TrustServerCertificate=yes 옵션 필요")
            
        elif 'driver' in error_str:
            print("  1. ODBC 드라이버 문제")
            print("     → ODBC Driver 17 또는 18 설치 확인")
            
        else:
            print("  알 수 없는 에러입니다")
        
        print(f"\n{Colors.BOLD}해결 방법:{Colors.END}")
        print("  1. SSMS로 연결 가능한지 확인")
        print("  2. 연결 정보가 정확한지 확인:")
        print(f"     - 서버: {db_config.host}:{db_config.port}")
        print(f"     - 데이터베이스: {db_config.database}")
        print(f"     - 사용자: {db_config.user}")
        print("  3. 방화벽 설정 확인")
        print("  4. VPN 연결 확인 (필요한 경우)")
        
        return False


def print_summary(results: dict):
    """결과 요약"""
    print_header("진단 결과 요약")
    
    all_passed = all(results.values())
    
    for key, passed in results.items():
        if passed:
            print_success(key)
        else:
            print_error(key)
    
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}✅ 모든 테스트 통과!{Colors.END}")
        print("\n다음 단계:")
        print("  python scripts/test_remote_connection.py")
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ 일부 테스트 실패{Colors.END}")
        print("\n위의 해결 방법을 따라 문제를 해결하세요.")
    
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")


def main():
    """메인 실행"""
    print_header("🔍 MSSQL 연결 진단")
    
    results = {}
    
    # Step 1: databases.json 확인
    data = check_databases_json()
    results['databases.json 파일'] = data is not None
    
    # Step 2: pyodbc 확인
    has_pyodbc = check_pyodbc()
    results['pyodbc 패키지'] = has_pyodbc
    
    if not has_pyodbc:
        print_summary(results)
        return
    
    # Step 3: ODBC 드라이버 확인
    has_driver = check_odbc_drivers()
    results['ODBC 드라이버'] = has_driver
    
    if not has_driver:
        print_summary(results)
        return
    
    # Step 4: 연결 문자열 확인
    db_config = check_connection_string()
    results['연결 문자열 생성'] = db_config is not None
    
    if not db_config:
        print_summary(results)
        return
    
    # Step 5: 실제 연결 테스트
    connection_ok = test_actual_connection(db_config)
    results['데이터베이스 연결'] = connection_ok
    
    # 결과 요약
    print_summary(results)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}진단이 사용자에 의해 중단되었습니다.{Colors.END}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Colors.RED}예상치 못한 오류: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
