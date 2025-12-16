"""
환경 변수 설정 테스트 스크립트
"""
import os
from dotenv import load_dotenv

# .env 로드
load_dotenv()

print("=" * 60)
print("환경 변수 테스트")
print("=" * 60)

# 필수 변수 체크
required_vars = [
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'REDIS_HOST', 'REDIS_PORT'
]

print("\n필수 환경 변수 확인:")
for var in required_vars:
    value = os.getenv(var)
    if var == 'DB_PASSWORD':
        display_value = '***' if value else 'NOT SET'
    else:
        display_value = value if value else 'NOT SET'
    
    status = '✓' if value else '✗'
    print(f"  {status} {var}: {display_value}")

# 데이터베이스 설정 출력
print("\n데이터베이스 연결 문자열:")
db_user = os.getenv('DB_USER', 'postgres')
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '5432')
db_name = os.getenv('DB_NAME', 'sherlock_sky')
print(f"  postgresql://{db_user}:***@{db_host}:{db_port}/{db_name}")

print("\n" + "=" * 60)