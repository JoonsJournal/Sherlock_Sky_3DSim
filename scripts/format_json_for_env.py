#!/usr/bin/env python3
# scripts/format_json_for_env.py
"""
JSON을 .env 파일용 한 줄 형식으로 변환하는 도구

사용법:
    python scripts/format_json_for_env.py config/databases.json
"""

import sys
import json
from pathlib import Path


def format_json_for_env(json_file: Path):
    """JSON 파일을 한 줄로 변환"""
    
    if not json_file.exists():
        print(f"❌ 파일을 찾을 수 없습니다: {json_file}")
        sys.exit(1)
    
    try:
        # JSON 파일 읽기
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 한 줄로 변환 (공백 제거)
        one_line = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
        
        print("="*70)
        print("✅ JSON 변환 완료!")
        print("="*70)
        print("\n.env 파일에 다음 내용을 복사하세요:\n")
        print(f"DATABASE_SITES={one_line}")
        print("\n" + "="*70)
        
        # 파일로도 저장
        output_file = json_file.parent / f"{json_file.stem}_oneline.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"DATABASE_SITES={one_line}\n")
        
        print(f"\n💾 결과가 다음 파일에도 저장되었습니다:")
        print(f"   {output_file}")
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 오류: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("사용법: python scripts/format_json_for_env.py <json_file>")
        print("예시: python scripts/format_json_for_env.py config/databases.json")
        sys.exit(1)
    
    json_file = Path(sys.argv[1])
    format_json_for_env(json_file)


if __name__ == '__main__':
    main()