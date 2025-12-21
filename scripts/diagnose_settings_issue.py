#!/usr/bin/env python3
# diagnose_settings_issue.py
"""
Pydantic 설정 문제 진단 스크립트
"""

import sys
import os
from pathlib import Path

print("="*70)
print("🔍 Pydantic 설정 문제 진단")
print("="*70)
print()

# 1. Pydantic 버전 확인
print("📦 Step 1: Pydantic 버전 확인")
print("-" * 50)
try:
    import pydantic
    print(f"✓ pydantic 버전: {pydantic.__version__}")
    
    if pydantic.__version__.startswith('2.'):
        print("  → Pydantic v2 확인됨")
    elif pydantic.__version__.startswith('1.'):
        print("  ⚠️  Pydantic v1이 설치되어 있습니다!")
        print("  → pip install pydantic==2.5.3 pydantic-settings==2.1.0 실행 필요")
except ImportError:
    print("✗ pydantic이 설치되지 않았습니다")
    sys.exit(1)

try:
    import pydantic_settings
    print(f"✓ pydantic-settings 설치 확인")
except ImportError:
    print("✗ pydantic-settings이 설치되지 않았습니다")
    print("  → pip install pydantic-settings==2.1.0 실행 필요")
    sys.exit(1)

print()

# 2. __pycache__ 확인
print("📁 Step 2: 캐시 파일 확인")
print("-" * 50)

PROJECT_ROOT = Path(__file__).parent
backend_config = PROJECT_ROOT / 'backend' / 'config'

if backend_config.exists():
    pycache_dirs = list(backend_config.rglob('__pycache__'))
    pyc_files = list(backend_config.rglob('*.pyc'))
    
    if pycache_dirs:
        print(f"⚠️  {len(pycache_dirs)}개의 __pycache__ 폴더 발견:")
        for cache_dir in pycache_dirs:
            print(f"   • {cache_dir}")
    
    if pyc_files:
        print(f"⚠️  {len(pyc_files)}개의 .pyc 파일 발견:")
        for pyc in pyc_files[:5]:  # 처음 5개만 표시
            print(f"   • {pyc}")
        if len(pyc_files) > 5:
            print(f"   ... 그 외 {len(pyc_files) - 5}개")
    
    if not pycache_dirs and not pyc_files:
        print("✓ 캐시 파일 없음")
else:
    print("✗ backend/config 폴더를 찾을 수 없습니다")

print()

# 3. settings 파일 확인
print("📄 Step 3: Settings 파일 확인")
print("-" * 50)

settings_files = [
    'backend/config/settings.py',
    'backend/config/multi_site_settings.py',
    'backend/settings.py',
    'config/settings.py'
]

for filepath in settings_files:
    full_path = PROJECT_ROOT / filepath
    if full_path.exists():
        print(f"✓ 발견: {filepath}")
        
        # BaseSettings import 방식 확인
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
            if 'from pydantic import BaseSettings' in content:
                print(f"  ⚠️  Pydantic v1 스타일 import 사용 중!")
                print(f"     → 'from pydantic import BaseSettings'")
            elif 'from pydantic_settings import BaseSettings' in content:
                print(f"  ✓ Pydantic v2 스타일 import 사용")
            
            if 'class Config:' in content:
                print(f"  ⚠️  Pydantic v1 스타일 Config 클래스 사용 중!")
            elif 'model_config = SettingsConfigDict' in content:
                print(f"  ✓ Pydantic v2 스타일 model_config 사용")
            
            # 필드 확인
            if 'REMOTE_DB_HOST' in content:
                print(f"  ⚠️  REMOTE_DB_HOST 필드 발견 (오래된 설정)")
            
            if 'DEFAULT_SITE' in content:
                print(f"  ✓ DEFAULT_SITE 필드 발견")
    else:
        print(f"  (없음) {filepath}")

print()

# 4. Import 테스트
print("🧪 Step 4: Import 테스트")
print("-" * 50)

# 먼저 sys.path에 프로젝트 루트 추가
sys.path.insert(0, str(PROJECT_ROOT))

try:
    print("테스트 1: multi_site_settings import...")
    from backend.config.multi_site_settings import MultiSiteSettings
    print("✓ import 성공")
    
    # 클래스 검사
    print("\n클래스 분석:")
    print(f"  • 클래스명: {MultiSiteSettings.__name__}")
    
    # 필드 확인
    if hasattr(MultiSiteSettings, 'model_fields'):
        # Pydantic v2
        print(f"  • Pydantic v2 model_fields 사용")
        fields = MultiSiteSettings.model_fields
        print(f"  • 정의된 필드 수: {len(fields)}")
        print(f"  • 필드 목록:")
        for name in list(fields.keys())[:10]:  # 처음 10개만
            print(f"     - {name}")
    elif hasattr(MultiSiteSettings, '__fields__'):
        # Pydantic v1
        print(f"  ⚠️  Pydantic v1 __fields__ 사용")
        fields = MultiSiteSettings.__fields__
        print(f"  • 정의된 필드 수: {len(fields)}")
    
    # Config 확인
    if hasattr(MultiSiteSettings, 'model_config'):
        print(f"  ✓ model_config 존재 (Pydantic v2)")
    elif hasattr(MultiSiteSettings, 'Config'):
        print(f"  ⚠️  Config 클래스 존재 (Pydantic v1)")
    
except ImportError as e:
    print(f"✗ import 실패: {e}")
except Exception as e:
    print(f"✗ 예외 발생: {e}")
    import traceback
    traceback.print_exc()

print()

# 5. .env 파일 확인
print("⚙️  Step 5: .env 파일 확인")
print("-" * 50)

env_file = PROJECT_ROOT / '.env'
if env_file.exists():
    print(f"✓ .env 파일 존재: {env_file}")
    
    with open(env_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 주요 변수 확인
    important_vars = [
        'DEFAULT_SITE',
        'DEFAULT_DB_NAME',
        'DATABASE_SITES',
        'DATABASE_CONFIG_FILE',
        'REMOTE_DB_HOST',
        'REMOTE_DB_USER'
    ]
    
    found_vars = {}
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#'):
            for var in important_vars:
                if line.startswith(f'{var}='):
                    found_vars[var] = line.split('=', 1)[1]
    
    print("\n발견된 환경 변수:")
    for var in important_vars:
        if var in found_vars:
            value = found_vars[var][:50] + '...' if len(found_vars[var]) > 50 else found_vars[var]
            print(f"  ✓ {var}={value}")
        else:
            print(f"  - {var} (없음)")
    
    # 충돌 확인
    if 'REMOTE_DB_HOST' in found_vars:
        print("\n⚠️  경고: 오래된 REMOTE_DB_* 변수가 .env에 있습니다")
        print("   이 변수들은 더 이상 사용되지 않습니다.")
        print("   DEFAULT_SITE, DATABASE_CONFIG_FILE을 사용하세요.")
else:
    print(f"✗ .env 파일 없음: {env_file}")

print()

# 6. 실제 설정 로드 테스트
print("🚀 Step 6: 실제 설정 로드 테스트")
print("-" * 50)

try:
    from backend.config.multi_site_settings import get_multi_site_settings
    settings = get_multi_site_settings()
    print("✓ 설정 로드 성공!")
    print(f"  • 환경: {settings.ENVIRONMENT}")
    print(f"  • 기본 사이트: {settings.DEFAULT_SITE}")
    print(f"  • 기본 DB: {settings.DEFAULT_DB_NAME}")
except Exception as e:
    print(f"✗ 설정 로드 실패!")
    print(f"\n에러 메시지:")
    print(f"{e}")
    print("\n상세 traceback:")
    import traceback
    traceback.print_exc()

print()
print("="*70)
print("💡 권장 해결 방법")
print("="*70)
print()
print("1. 캐시 삭제:")
print("   find backend/config -type d -name __pycache__ -exec rm -rf {} +")
print("   find backend/config -name '*.pyc' -delete")
print()
print("2. Python 프로세스 완전 종료 후 재시작")
print()
print("3. 설정 파일 재확인:")
print("   cat backend/config/multi_site_settings.py | grep 'from pydantic'")
print()
