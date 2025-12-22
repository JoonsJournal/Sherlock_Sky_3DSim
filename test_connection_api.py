"""
Connection API 통합 테스트
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/connections"


def print_result(title, data):
    """결과 출력"""
    print("\n" + "="*60)
    print(f"📋 {title}")
    print("="*60)
    print(json.dumps(data, indent=2, ensure_ascii=False))


def test_get_sites():
    """사이트 목록 조회"""
    response = requests.get(f"{BASE_URL}/sites")
    data = response.json()
    print_result("사이트 목록", data)
    return data


def test_get_profiles():
    """프로필 목록 조회"""
    response = requests.get(f"{BASE_URL}/profiles")
    data = response.json()
    print_result("프로필 목록", data)
    return data


def test_single_connection(site_name, db_name):
    """단일 연결 테스트"""
    response = requests.post(
        f"{BASE_URL}/test-connection",
        json={"site_name": site_name, "db_name": db_name}
    )
    data = response.json()
    print_result(f"연결 테스트: {site_name}.{db_name}", data)
    
    if data.get('success'):
        print("✅ 연결 성공!")
    else:
        print(f"❌ 연결 실패: {data.get('message')}")
    
    return data


def test_profile(profile_name):
    """프로필 테스트"""
    response = requests.post(
        f"{BASE_URL}/test-profile",
        json={"profile_name": profile_name}
    )
    data = response.json()
    print_result(f"프로필 테스트: {profile_name}", data)
    return data


def test_all():
    """전체 테스트"""
    response = requests.post(f"{BASE_URL}/test-all")
    data = response.json()
    print_result("전체 연결 테스트", data)
    return data


if __name__ == "__main__":
    try:
        print("🔌 SHERLOCK_SKY_3DSIM Connection Test")
        
        # 1. 사이트 목록
        sites_data = test_get_sites()
        
        # 2. 프로필 목록
        profiles_data = test_get_profiles()
        
        # 3. 단일 연결 테스트 (첫 번째 사이트의 첫 번째 DB)
        if sites_data.get('sites'):
            first_site = sites_data['sites'][0]
            if first_site.get('databases'):
                test_single_connection(
                    first_site['name'],
                    first_site['databases'][0]
                )
        
        # 4. 프로필 테스트 (기본 프로필)
        if profiles_data.get('default_profile'):
            test_profile(profiles_data['default_profile'])
        
        # 5. 전체 테스트
        test_all()
        
        print("\n✅ 모든 테스트 완료!")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ 오류: 서버가 실행 중이 아닙니다!")
        print("서버 시작: python -m backend.api.main")
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")