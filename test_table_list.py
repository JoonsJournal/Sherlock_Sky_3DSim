"""
테이블 목록 조회 테스트
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/connections"


def test_get_tables(site_name, db_name):
    """테이블 목록 조회 테스트"""
    print("\n" + "="*60)
    print(f"📋 테이블 목록 조회: {site_name}.{db_name}")
    print("="*60)
    
    response = requests.post(
        f"{BASE_URL}/get-tables",
        json={"site_name": site_name, "db_name": db_name}
    )
    
    data = response.json()
    
    if data.get('success'):
        print(f"✅ 성공: {data.get('message')}")
        print(f"\n📊 총 테이블 수: {data.get('total_tables')}")
        print(f"🗄️  데이터베이스: {data.get('database')}")
        print(f"💾 DB 타입: {data.get('db_type')}")
        
        if data.get('tables'):
            print(f"\n📋 테이블 목록:")
            print("-" * 60)
            for i, table in enumerate(data['tables'], 1):
                print(f"{i:3d}. {table['full_name']}")
        else:
            print("\n⚠️  테이블이 없습니다.")
    else:
        print(f"❌ 실패: {data.get('message')}")
        print(json.dumps(data, indent=2, ensure_ascii=False))
    
    return data


if __name__ == "__main__":
    try:
        print("🔌 테이블 목록 조회 테스트")
        
        # 테스트할 연결들
        test_connections = [
            ("korea_site1", "line1"),
            ("korea_site1", "line2"),
            ("vietnam_site", "production"),
        ]
        
        for site_name, db_name in test_connections:
            try:
                test_get_tables(site_name, db_name)
            except Exception as e:
                print(f"\n❌ {site_name}.{db_name} 테스트 실패: {e}")
        
        print("\n" + "="*60)
        print("✅ 모든 테스트 완료!")
        print("="*60)
        
    except requests.exceptions.ConnectionError:
        print("\n❌ 오류: 서버가 실행 중이 아닙니다!")
        print("서버 시작: python -m backend.api.main")
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")