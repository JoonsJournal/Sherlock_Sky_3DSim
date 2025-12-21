#!/usr/bin/env python3
# check_mssql_connection_string.py
"""
MSSQL 연결 문자열 완전 진단
- ODBC 드라이버 자동 감지
- 포트 번호 확인
- SSMS 연결 정보와 비교
- 실제 연결 테스트
"""

import sys
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))


class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(text: str):
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}{text:^70}{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")


def print_step(title: str):
    print(f"\n{Colors.CYAN}{title}{Colors.END}")
    print("-" * 70)


def print_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")


def print_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")


def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")


def print_info(key: str, value: str):
    print(f"  • {key}: {value}")


def check_odbc_drivers():
    """설치된 ODBC 드라이버 확인"""
    print_step("1️⃣ 설치된 ODBC 드라이버 확인")
    
    try:
        import pyodbc
        drivers = pyodbc.drivers()
        
        print_success(f"{len(drivers)}개의 ODBC 드라이버 발견")
        
        # SQL Server 드라이버 필터링
        sql_drivers = [d for d in drivers if 'SQL Server' in d]
        
        if not sql_drivers:
            print_error("SQL Server ODBC 드라이버가 없습니다!")
            return None
        
        print("\nSQL Server 드라이버:")
        for driver in sql_drivers:
            if 'Driver 18' in driver:
                print_success(f"  {driver} ← 최신 버전!")
            elif 'Driver 17' in driver:
                print_success(f"  {driver}")
            else:
                print_warning(f"  {driver} (구 버전)")
        
        # 자동 선택될 드라이버
        preferred = [
            'ODBC Driver 18 for SQL Server',
            'ODBC Driver 17 for SQL Server',
            'ODBC Driver 13 for SQL Server'
        ]
        
        selected = None
        for driver in preferred:
            if driver in drivers:
                selected = driver
                break
        
        if not selected:
            selected = sql_drivers[0]
        
        print(f"\n{Colors.BOLD}자동 선택될 드라이버:{Colors.END}")
        print_success(f"  {selected}")
        
        return selected
        
    except ImportError:
        print_error("pyodbc가 설치되지 않았습니다")
        print("설치: pip install pyodbc")
        return None


def check_databases_json():
    """databases.json 파일 확인"""
    print_step("2️⃣ databases.json 연결 정보 확인")
    
    json_path = PROJECT_ROOT / 'config' / 'databases.json'
    
    if not json_path.exists():
        print_error(f"파일을 찾을 수 없습니다: {json_path}")
        return None
    
    print_success(f"파일 존재: {json_path}")
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print_success("JSON 파싱 성공")
        
        # 각 사이트 정보 출력
        for site_id, config in data.items():
            print(f"\n{Colors.BOLD}[{site_id}]{Colors.END}")
            
            host = config.get('host', '')
            port = config.get('port', '')
            db_type = config.get('type', '')
            user = config.get('user', '')
            
            print_info("호스트", host)
            print_info("포트", str(port))
            print_info("타입", db_type)
            print_info("사용자", user)
            
            # 포트 번호 분석
            if ',' in host:
                print_warning("호스트에 포트가 포함되어 있습니다!")
                parts = host.split(',')
                actual_host = parts[0]
                port_in_host = parts[1] if len(parts) > 1 else ''
                print(f"    실제 호스트: {actual_host}")
                print(f"    호스트의 포트: {port_in_host}")
                print(f"    설정 파일의 포트: {port}")
                
                if port_in_host and port_in_host != str(port):
                    print_warning("포트 번호가 일치하지 않습니다!")
                    print("    권장: 호스트에서 포트 제거하고 port 필드만 사용")
            
            # 타입 체크
            if db_type.upper() == 'MSSQL':
                if db_type != 'mssql':
                    print_warning(f"타입이 대문자입니다: '{db_type}'")
                    print("    → 'mssql' (소문자)로 변경하세요")
            
            # 데이터베이스 목록
            databases = config.get('databases', {})
            print(f"\n  데이터베이스 ({len(databases)}개):")
            for db_key, db_name in databases.items():
                print(f"    • {db_key}: {db_name}")
        
        return data
        
    except Exception as e:
        print_error(f"파일 읽기 실패: {e}")
        return None


def build_connection_string(selected_driver: str):
    """연결 문자열 생성 및 확인"""
    print_step("3️⃣ 연결 문자열 생성")
    
    try:
        from backend.config.multi_site_settings import get_multi_site_settings
        from urllib.parse import unquote
        
        settings = get_multi_site_settings()
        db_config = settings.get_database_config()
        
        print(f"\n{Colors.BOLD}연결 정보:{Colors.END}")
        print_info("사이트 ID", settings.DEFAULT_SITE)
        print_info("데이터베이스 키", settings.DEFAULT_DB_NAME)
        print_info("호스트", db_config.host)
        print_info("포트", str(db_config.port))
        print_info("데이터베이스", db_config.database)
        print_info("사용자", db_config.user)
        print_info("사용될 드라이버", db_config.odbc_driver)
        
        # 연결 문자열
        conn_str = db_config.connection_url
        
        # 비밀번호 마스킹
        import re
        masked = re.sub(r'://([^:]+):([^@]+)@', r'://\1:***@', conn_str)
        
        print(f"\n{Colors.BOLD}생성된 연결 문자열:{Colors.END}")
        print(f"{masked}")
        
        # 연결 문자열 분석
        print(f"\n{Colors.BOLD}연결 옵션 분석:{Colors.END}")
        
        if 'driver=' in conn_str:
            driver_match = re.search(r'driver=([^&]+)', conn_str)
            if driver_match:
                driver_encoded = driver_match.group(1)
                driver_decoded = unquote(driver_encoded)
                print_info("Driver", driver_decoded)
                
                if driver_decoded == selected_driver:
                    print_success("  → 설치된 드라이버와 일치!")
                else:
                    print_warning(f"  → 설치된 드라이버({selected_driver})와 다릅니다")
        
        if 'TrustServerCertificate=yes' in conn_str:
            print_success("TrustServerCertificate=yes (SSMS의 '서버 인증서 신뢰')")
        else:
            print_warning("TrustServerCertificate 옵션 없음")
        
        if 'Encrypt=yes' in conn_str:
            print_success("Encrypt=yes (SSMS의 '암호화: 필수')")
        else:
            print_warning("Encrypt 옵션 없음")
        
        return db_config, conn_str
        
    except Exception as e:
        print_error(f"연결 문자열 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return None, None


def test_connection(db_config, conn_str):
    """실제 연결 테스트"""
    print_step("4️⃣ 실제 데이터베이스 연결 테스트")
    
    if not db_config or not conn_str:
        print_warning("연결 설정이 없어 테스트를 건너뜁니다")
        return False
    
    print("연결 시도 중...")
    print(f"  호스트: {db_config.host}:{db_config.port}")
    print(f"  데이터베이스: {db_config.database}")
    
    try:
        from sqlalchemy import create_engine, text
        import time
        
        start_time = time.time()
        
        engine = create_engine(
            conn_str,
            pool_pre_ping=True,
            connect_args={
                'connect_timeout': 15,
                'timeout': 15
            }
        )
        
        with engine.connect() as conn:
            # SQL Server 버전
            result = conn.execute(text("SELECT @@VERSION"))
            version = result.scalar()
            
            # 데이터베이스 이름
            result = conn.execute(text("SELECT DB_NAME()"))
            db_name = result.scalar()
            
            # 현재 사용자
            result = conn.execute(text("SELECT SYSTEM_USER"))
            current_user = result.scalar()
            
            # 테이블 수
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'"
            ))
            table_count = result.scalar()
        
        elapsed = time.time() - start_time
        
        print_success(f"연결 성공! (소요 시간: {elapsed:.2f}초)")
        
        print(f"\n{Colors.BOLD}데이터베이스 정보:{Colors.END}")
        version_line = version.split('\n')[0] if version else 'Unknown'
        print_info("SQL Server", version_line[:80])
        print_info("데이터베이스", db_name)
        print_info("현재 사용자", current_user)
        print_info("테이블 수", str(table_count))
        
        engine.dispose()
        return True
        
    except Exception as e:
        print_error("연결 실패!")
        
        error_str = str(e).lower()
        
        print(f"\n{Colors.BOLD}에러 메시지:{Colors.END}")
        print(f"  {str(e)}")
        
        print(f"\n{Colors.BOLD}가능한 원인 및 해결 방법:{Colors.END}")
        
        if 'im002' in error_str or 'data source name' in error_str:
            print_error("1. ODBC 드라이버 이름이 틀렸습니다")
            print("   해결: 설치된 드라이버 이름과 일치하는지 확인")
            print(f"   설치된 드라이버: {db_config.odbc_driver}")
            
        elif 'login failed' in error_str:
            print_error("2. 사용자명 또는 비밀번호가 틀렸습니다")
            print("   해결: databases.json의 user, password 확인")
            print("   SSMS로 동일한 정보로 연결 가능한지 확인")
            
        elif 'cannot open database' in error_str:
            print_error("3. 데이터베이스 이름이 틀렸습니다")
            print("   해결: SSMS에서 실제 데이터베이스 이름 확인")
            print(f"   현재 설정: {db_config.database}")
            
        elif 'timeout' in error_str:
            print_error("4. 네트워크 연결 문제 또는 서버 응답 없음")
            print("   해결:")
            print("   - 방화벽 설정 확인")
            print("   - VPN 연결 확인")
            print("   - 서버 주소/포트 확인")
            print(f"   - 현재: {db_config.host}:{db_config.port}")
            
        elif 'certificate' in error_str or 'ssl' in error_str:
            print_error("5. SSL/TLS 인증서 문제")
            print("   해결: TrustServerCertificate=yes 옵션 확인")
            
        else:
            print_error("6. 알 수 없는 에러")
        
        return False


def compare_with_ssms():
    """SSMS 연결 정보와 비교"""
    print_step("5️⃣ SSMS 연결 정보와 비교")
    
    print(f"{Colors.BOLD}SSMS 연결 시 사용한 정보를 입력하세요:{Colors.END}")
    print("(엔터만 누르면 건너뜁니다)")
    print()
    
    ssms_server = input("서버 이름: ").strip()
    
    if not ssms_server:
        print_warning("비교를 건너뜁니다")
        return
    
    ssms_user = input("사용자 이름: ").strip()
    ssms_db = input("데이터베이스 (기본값이면 엔터): ").strip() or "<기본값>"
    
    print(f"\n{Colors.BOLD}SSMS 연결 정보:{Colors.END}")
    print_info("서버", ssms_server)
    print_info("사용자", ssms_user)
    print_info("데이터베이스", ssms_db)
    print_info("암호화", "필수")
    print_info("서버 인증서 신뢰", "예")
    
    # databases.json과 비교
    try:
        from backend.config.multi_site_settings import get_multi_site_settings
        
        settings = get_multi_site_settings()
        db_config = settings.get_database_config()
        
        print(f"\n{Colors.BOLD}databases.json 설정:{Colors.END}")
        print_info("호스트:포트", f"{db_config.host}:{db_config.port}")
        print_info("사용자", db_config.user)
        print_info("데이터베이스", db_config.database)
        
        print(f"\n{Colors.BOLD}비교 결과:{Colors.END}")
        
        # 서버 이름 비교
        json_server = f"{db_config.host},{db_config.port}" if db_config.port != 1433 else db_config.host
        
        if ssms_server.lower() == json_server.lower():
            print_success(f"서버 일치: {ssms_server}")
        elif ssms_server.lower() == db_config.host.lower():
            print_success(f"서버 일치: {db_config.host}")
            if db_config.port != 1433:
                print_info("포트", f"{db_config.port} (기본 포트가 아님)")
        else:
            print_warning("서버가 다릅니다!")
            print(f"  SSMS: {ssms_server}")
            print(f"  JSON: {json_server}")
        
        # 사용자 비교
        if ssms_user == db_config.user:
            print_success(f"사용자 일치: {ssms_user}")
        else:
            print_warning("사용자가 다릅니다!")
            print(f"  SSMS: {ssms_user}")
            print(f"  JSON: {db_config.user}")
        
        # 데이터베이스 비교
        if ssms_db == "<기본값>":
            print_warning("SSMS에서 기본 데이터베이스 사용")
            print(f"  JSON의 데이터베이스: {db_config.database}")
        elif ssms_db == db_config.database:
            print_success(f"데이터베이스 일치: {ssms_db}")
        else:
            print_warning("데이터베이스가 다릅니다!")
            print(f"  SSMS: {ssms_db}")
            print(f"  JSON: {db_config.database}")
        
    except Exception as e:
        print_error(f"비교 실패: {e}")


def main():
    """메인 실행"""
    print_header("🔍 MSSQL 연결 완전 진단")
    
    # 1. ODBC 드라이버 확인
    selected_driver = check_odbc_drivers()
    
    if not selected_driver:
        print("\n프로그램을 종료합니다.")
        return
    
    # 2. databases.json 확인
    data = check_databases_json()
    
    if not data:
        print("\n프로그램을 종료합니다.")
        return
    
    # 3. 연결 문자열 생성
    db_config, conn_str = build_connection_string(selected_driver)
    
    # 4. 실제 연결 테스트
    success = test_connection(db_config, conn_str)
    
    # 5. SSMS와 비교
    compare_with_ssms()
    
    # 최종 결과
    print_header("📊 진단 완료")
    
    if success:
        print(f"{Colors.GREEN}{Colors.BOLD}✅ 연결 성공!{Colors.END}")
        print("\n다음 단계:")
        print("  python scripts/test_remote_connection.py")
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ 연결 실패{Colors.END}")
        print("\n위의 해결 방법을 시도하세요.")
    
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}진단이 중단되었습니다.{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}예상치 못한 오류: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
