# scripts/validate_config.py
"""
설정 파일 검증 스크립트

모든 설정이 올바른지 확인합니다.
"""

import sys
import json
from pathlib import Path
from dotenv import load_dotenv
import os

PROJECT_ROOT = Path(__file__).parent.parent


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'


def validate_env_file():
    """환경 변수 파일 검증"""
    print(f"\n{Colors.BLUE}1. .env 파일 검증{Colors.END}")
    
    env_file = PROJECT_ROOT / '.env'
    
    if not env_file.exists():
        print(f"{Colors.RED}✗ .env 파일이 없습니다{Colors.END}")
        return False
    
    load_dotenv(env_file)
    
    # 필수 환경 변수
    required_vars = [
        'DEFAULT_SITE',
        'DEFAULT_DB_NAME',
        'DB_POOL_SIZE',
    ]
    
    all_present = True
    
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"{Colors.GREEN}✓{Colors.END} {var}")
        else:
            print(f"{Colors.RED}✗{Colors.END} {var} (없음)")
            all_present = False
    
    # DATABASE_SITES 또는 DATABASE_CONFIG_FILE 중 하나는 있어야 함
    database_sites = os.getenv('DATABASE_SITES')
    database_config_file = os.getenv('DATABASE_CONFIG_FILE')
    
    if not database_sites and not database_config_file:
        print(f"{Colors.RED}✗{Colors.END} DATABASE_SITES 또는 DATABASE_CONFIG_FILE 중 하나는 필요합니다")
        return False
    
    # 방법 1: DATABASE_SITES (JSON 문자열)
    if database_sites:
        try:
            sites = json.loads(database_sites)
            print(f"{Colors.GREEN}✓{Colors.END} DATABASE_SITES JSON 파싱 성공")
            print(f"  사이트 수: {len(sites)}")
            
            for site_id, site_config in sites.items():
                db_count = len(site_config.get('databases', {}))
                print(f"    • {site_id}: {db_count}개 DB")
        
        except json.JSONDecodeError as e:
            print(f"{Colors.RED}✗{Colors.END} DATABASE_SITES JSON 파싱 실패: {e}")
            print(f"\n{Colors.YELLOW}💡 해결 방법:{Colors.END}")
            print("  1. DATABASE_SITES를 한 줄로 작성하거나")
            print("  2. 별도 JSON 파일(config/databases.json)을 사용하세요")
            print(f"\n{Colors.BLUE}예시:{Colors.END}")
            print('  DATABASE_SITES={"site1":{"host":"...","databases":{...}}}')
            print("  또는")
            print("  DATABASE_CONFIG_FILE=config/databases.json")
            return False
        except Exception as e:
            print(f"{Colors.RED}✗{Colors.END} 예외 발생: {e}")
            return False
    
    # 방법 2: DATABASE_CONFIG_FILE (JSON 파일)
    if database_config_file:
        config_path = PROJECT_ROOT / database_config_file
        
        if not config_path.exists():
            print(f"{Colors.RED}✗{Colors.END} 설정 파일을 찾을 수 없음: {config_path}")
            return False
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                sites = json.load(f)
            
            print(f"{Colors.GREEN}✓{Colors.END} DATABASE_CONFIG_FILE 파일 로드 성공")
            print(f"  파일: {config_path}")
            print(f"  사이트 수: {len(sites)}")
            
            for site_id, site_config in sites.items():
                db_count = len(site_config.get('databases', {}))
                print(f"    • {site_id}: {db_count}개 DB")
        
        except json.JSONDecodeError as e:
            print(f"{Colors.RED}✗{Colors.END} 설정 파일 JSON 파싱 실패: {e}")
            return False
        except Exception as e:
            print(f"{Colors.RED}✗{Colors.END} 파일 로드 실패: {e}")
            return False
    
    return all_present


def validate_active_connections():
    """활성 연결 파일 검증"""
    print(f"\n{Colors.BLUE}2. active_connections.json 검증{Colors.END}")
    
    config_file = PROJECT_ROOT / 'config' / 'active_connections.json'
    
    if not config_file.exists():
        print(f"{Colors.YELLOW}⚠{Colors.END} active_connections.json 파일이 없습니다")
        return False
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 구조 검증
        required_keys = ['active_profile', 'enabled_connections', 'last_updated']
        
        for key in required_keys:
            if key in data:
                print(f"{Colors.GREEN}✓{Colors.END} {key}")
            else:
                print(f"{Colors.RED}✗{Colors.END} {key} (없음)")
                return False
        
        # 활성 연결 수
        enabled = data['enabled_connections']
        enabled_count = sum(
            1 for site in enabled.values() 
            if site.get('enabled', False)
        )
        
        print(f"  활성 사이트: {enabled_count}")
        
        return True
    
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} 파일 로드 실패: {e}")
        return False


def validate_profiles():
    """프로필 파일 검증"""
    print(f"\n{Colors.BLUE}3. connection_profiles.json 검증{Colors.END}")
    
    config_file = PROJECT_ROOT / 'config' / 'connection_profiles.json'
    
    if not config_file.exists():
        print(f"{Colors.YELLOW}⚠{Colors.END} connection_profiles.json 파일이 없습니다")
        return False
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        profiles = data.get('profiles', {})
        
        print(f"{Colors.GREEN}✓{Colors.END} 프로필 수: {len(profiles)}")
        
        for profile_id, profile in profiles.items():
            conn_count = sum(len(dbs) for dbs in profile.get('connections', {}).values())
            print(f"  • {profile_id}: {conn_count}개 연결")
        
        return True
    
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} 파일 로드 실패: {e}")
        return False


def validate_all():
    """전체 검증"""
    print("="*70)
    print("설정 파일 검증")
    print("="*70)
    
    results = []
    
    results.append(validate_env_file())
    results.append(validate_active_connections())
    results.append(validate_profiles())
    
    print("\n" + "="*70)
    
    if all(results):
        print(f"{Colors.GREEN}✅ 모든 검증 통과!{Colors.END}")
        print("="*70)
        return True
    else:
        print(f"{Colors.RED}❌ 일부 검증 실패{Colors.END}")
        print("="*70)
        return False


if __name__ == '__main__':
    success = validate_all()
    sys.exit(0 if success else 1)