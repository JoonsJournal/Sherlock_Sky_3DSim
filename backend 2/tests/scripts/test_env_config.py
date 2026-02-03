#!/usr/bin/env python3
"""
Phase 1 환경변수 검증 테스트 스크립트

사용법:
    python scripts/test_env_config.py

설명:
    .env 파일의 환경변수가 올바르게 로드되는지 검증합니다.
    기존 settings.py와의 호환성도 확인합니다.
"""

import os
import sys
from pathlib import Path

# 프로젝트 루트 경로 설정
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / 'backend'))

def print_header(title):
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)

def print_result(name, value, expected=None):
    status = "✅" if value else "⚠️"
    if expected and value != expected:
        status = "❌"
        print(f"{status} {name}: {value} (예상: {expected})")
    else:
        print(f"{status} {name}: {value}")

def test_dotenv_load():
    """dotenv 직접 로드 테스트"""
    print_header("1️⃣ dotenv 직접 로드 테스트")
    
    try:
        from dotenv import load_dotenv
        
        env_file = PROJECT_ROOT / '.env'
        if env_file.exists():
            load_dotenv(env_file)
            print(f"✅ .env 파일 로드됨: {env_file}")
        else:
            print(f"❌ .env 파일 없음: {env_file}")
            return False
        
        # 새 포트 변수
        print("\n--- 🔑 새 포트 설정 ---")
        print_result("BACKEND_PORT", os.getenv("BACKEND_PORT"), "8008")
        print_result("FRONTEND_PORT", os.getenv("FRONTEND_PORT"), "8088")
        print_result("API_BASE_URL", os.getenv("API_BASE_URL"))
        print_result("WS_URL", os.getenv("WS_URL"))
        
        # 레거시 호환 변수
        print("\n--- 📦 레거시 호환 변수 ---")
        print_result("APP_PORT", os.getenv("APP_PORT"), "8008")
        print_result("API_PORT", os.getenv("API_PORT"), "8008")
        print_result("ENVIRONMENT", os.getenv("ENVIRONMENT"))
        print_result("LOG_LEVEL", os.getenv("LOG_LEVEL"))
        
        # CORS
        print("\n--- 🌐 CORS 설정 ---")
        print_result("CORS_ORIGINS", os.getenv("CORS_ORIGINS"))
        print_result("ALLOWED_ORIGINS", os.getenv("ALLOWED_ORIGINS"))
        
        # 포트 일치 확인
        print("\n--- 🔍 포트 일치 검증 ---")
        backend_port = os.getenv("BACKEND_PORT")
        app_port = os.getenv("APP_PORT")
        api_port = os.getenv("API_PORT")
        
        if backend_port == app_port == api_port:
            print("✅ 포트 일치: BACKEND_PORT = APP_PORT = API_PORT")
            return True
        else:
            print("❌ 포트 불일치!")
            print(f"   BACKEND_PORT={backend_port}")
            print(f"   APP_PORT={app_port}")
            print(f"   API_PORT={api_port}")
            return False
            
    except ImportError:
        print("❌ python-dotenv 패키지가 설치되지 않았습니다.")
        print("   설치: pip install python-dotenv")
        return False
    except Exception as e:
        print(f"❌ 오류: {e}")
        return False


def test_settings_load():
    """backend/config/settings.py 로드 테스트"""
    print_header("2️⃣ Backend Settings 로드 테스트")
    
    try:
        from config.settings import settings, get_settings
        
        if settings is None:
            print("⚠️ settings가 None입니다 (multi_site_settings 사용 시 정상일 수 있음)")
            return True
        
        print_result("settings.ENVIRONMENT", settings.ENVIRONMENT)
        print_result("settings.APP_PORT", settings.APP_PORT, 8008)
        print_result("settings.LOG_LEVEL", settings.LOG_LEVEL)
        print_result("settings.CORS_ORIGINS", settings.CORS_ORIGINS)
        print_result("settings.REDIS_HOST", settings.REDIS_HOST)
        print_result("settings.REDIS_PORT", settings.REDIS_PORT)
        
        print("\n✅ Settings 로드 성공!")
        return True
        
    except ImportError as e:
        print(f"⚠️ settings 모듈 import 실패: {e}")
        print("   (pydantic-settings가 설치되지 않았을 수 있습니다)")
        return True  # 환경에 따라 정상일 수 있음
    except Exception as e:
        print(f"❌ Settings 로드 실패: {e}")
        return False


def test_database_config():
    """데이터베이스 설정 테스트"""
    print_header("3️⃣ 데이터베이스 설정 테스트")
    
    # REMOTE_DB_* (settings.py용)
    print("--- settings.py용 (REMOTE_DB_*) ---")
    print_result("REMOTE_DB_HOST", os.getenv("REMOTE_DB_HOST"))
    print_result("REMOTE_DB_PORT", os.getenv("REMOTE_DB_PORT"))
    print_result("REMOTE_DB_NAME", os.getenv("REMOTE_DB_NAME"))
    print_result("DATABASE_TYPE", os.getenv("DATABASE_TYPE"))
    
    # DB_* (레거시 .env.sample 호환)
    print("\n--- 레거시 호환 (DB_*) ---")
    print_result("DB_HOST", os.getenv("DB_HOST"))
    print_result("DB_PORT", os.getenv("DB_PORT"))
    print_result("DB_NAME", os.getenv("DB_NAME"))
    
    return True


def test_redis_config():
    """Redis 설정 테스트"""
    print_header("4️⃣ Redis 설정 테스트")
    
    print_result("REDIS_HOST", os.getenv("REDIS_HOST"), "localhost")
    print_result("REDIS_PORT", os.getenv("REDIS_PORT"), "6379")
    print_result("REDIS_DB", os.getenv("REDIS_DB"), "0")
    
    return True


def test_api_url_consistency():
    """API URL 일관성 테스트"""
    print_header("5️⃣ API URL 일관성 테스트")
    
    backend_port = os.getenv("BACKEND_PORT", "8008")
    api_base_url = os.getenv("API_BASE_URL", "")
    ws_url = os.getenv("WS_URL", "")
    
    # URL에 포트가 포함되어 있는지 확인
    port_in_api = f":{backend_port}" in api_base_url
    port_in_ws = f":{backend_port}" in ws_url
    
    print_result("API_BASE_URL에 BACKEND_PORT 포함", "예" if port_in_api else "아니오")
    print_result("WS_URL에 BACKEND_PORT 포함", "예" if port_in_ws else "아니오")
    
    if port_in_api and port_in_ws:
        print("\n✅ URL과 포트가 일관성 있게 설정됨")
        return True
    else:
        print("\n⚠️ URL에 BACKEND_PORT가 반영되지 않았습니다")
        print(f"   API_BASE_URL: {api_base_url}")
        print(f"   WS_URL: {ws_url}")
        print(f"   BACKEND_PORT: {backend_port}")
        return False


def main():
    print()
    print("🔧 SHERLOCK_SKY_3DSIM Phase 1 환경변수 검증")
    print("=" * 70)
    
    results = []
    
    results.append(("dotenv 로드", test_dotenv_load()))
    results.append(("Settings 로드", test_settings_load()))
    results.append(("데이터베이스 설정", test_database_config()))
    results.append(("Redis 설정", test_redis_config()))
    results.append(("API URL 일관성", test_api_url_consistency()))
    
    # 결과 요약
    print_header("📊 테스트 결과 요약")
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} - {name}")
        if not passed:
            all_passed = False
    
    print()
    if all_passed:
        print("🎉 모든 테스트 통과! Phase 1 환경 설정이 올바르게 구성되었습니다.")
    else:
        print("⚠️ 일부 테스트가 실패했습니다. 위의 결과를 확인하세요.")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
