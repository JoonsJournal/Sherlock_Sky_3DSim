"""
연결 테스트 스크립트
- PostgreSQL 연결 확인
- Redis 연결 확인
- API 서버 확인
"""

import sys

def test_postgresql():
    """PostgreSQL 연결 테스트"""
    try:
        import psycopg2
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            database='sherlock_sky',
            user='postgres',
            password='password'
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✓ PostgreSQL 연결 성공")
        print(f"  버전: {version[:50]}...")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"✗ PostgreSQL 연결 실패: {e}")
        return False


def test_redis():
    """Redis/Memurai 연결 테스트"""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379)
        r.ping()
        info = r.info('server')
        print(f"✓ Redis 연결 성공")
        print(f"  버전: {info.get('redis_version', 'unknown')}")
        return True
    except Exception as e:
        print(f"✗ Redis 연결 실패: {e}")
        return False


def test_tables():
    """테이블 존재 확인"""
    try:
        import psycopg2
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            database='sherlock_sky',
            user='postgres',
            password='password'
        )
        cursor = conn.cursor()
        
        tables = ['equipment', 'equipment_status_ts', 'production_ts', 'alarms_ts']
        
        for table in tables:
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_name = '{table}'
            """)
            exists = cursor.fetchone()[0] > 0
            
            if exists:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"✓ 테이블 '{table}' 존재 (레코드: {count}개)")
            else:
                print(f"✗ 테이블 '{table}' 없음")
        
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"✗ 테이블 확인 실패: {e}")
        return False


def test_api_import():
    """API 모듈 import 테스트"""
    try:
        # 현재 디렉토리를 sys.path에 추가
        import os
        sys.path.insert(0, os.getcwd())
        
        from api.database.connection import DB_CONFIG, REDIS_CONFIG
        print(f"✓ API 모듈 import 성공")
        print(f"  DB 호스트: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
        print(f"  Redis 호스트: {REDIS_CONFIG['host']}:{REDIS_CONFIG['port']}")
        return True
    except Exception as e:
        print(f"✗ API 모듈 import 실패: {e}")
        print(f"  현재 경로: {os.getcwd()}")
        print(f"  api 폴더 존재: {os.path.exists('api')}")
        return False


def test_packages():
    """필수 패키지 설치 확인"""
    packages = [
        'fastapi',
        'uvicorn',
        'psycopg2',
        'redis',
        'websockets',
        'pydantic'
    ]
    
    all_installed = True
    for package in packages:
        try:
            __import__(package)
            print(f"✓ {package} 설치됨")
        except ImportError:
            print(f"✗ {package} 미설치")
            all_installed = False
    
    return all_installed


def main():
    print("="*60)
    print("  SHERLOCK_SKY_3DSIM Backend 연결 테스트")
    print("="*60)
    print()
    
    results = []
    
    print("[1] 필수 패키지 확인")
    print("-"*60)
    results.append(("패키지", test_packages()))
    print()
    
    print("[2] PostgreSQL 연결 테스트")
    print("-"*60)
    results.append(("PostgreSQL", test_postgresql()))
    print()
    
    print("[3] Redis 연결 테스트")
    print("-"*60)
    results.append(("Redis", test_redis()))
    print()
    
    print("[4] 데이터베이스 테이블 확인")
    print("-"*60)
    results.append(("테이블", test_tables()))
    print()
    
    print("[5] API 모듈 Import 테스트")
    print("-"*60)
    results.append(("API 모듈", test_api_import()))
    print()
    
    print("="*60)
    print("  테스트 결과 요약")
    print("="*60)
    
    for name, result in results:
        status = "✓ 통과" if result else "✗ 실패"
        print(f"{name:15} : {status}")
    
    all_passed = all(result for _, result in results)
    
    print()
    if all_passed:
        print("🎉 모든 테스트 통과! 시스템 준비 완료!")
        print()
        print("다음 명령어로 서버를 시작하세요:")
        print("  uvicorn api.main:app --reload")
    else:
        print("⚠️  일부 테스트 실패. 위의 오류를 확인하세요.")
        print()
        print("문제 해결:")
        print("  1. PostgreSQL이 실행 중인지 확인")
        print("  2. Memurai가 실행 중인지 확인")
        print("  3. setup_database_native.py를 실행했는지 확인")
        print("  4. 필수 패키지를 설치했는지 확인")
    
    print("="*60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())