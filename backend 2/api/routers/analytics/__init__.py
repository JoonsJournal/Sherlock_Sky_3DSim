"""
analytics/__init__.py
분석 모듈 패키지

@version 2.0.0
@changelog
- v2.0.0: 모듈 분리 리팩토링
  - 기존 단일 analytics.py → 분리된 구조
  - ⚠️ 호환성: 기존 import 경로 유지

@structure
analytics/
├── __init__.py          # 이 파일
├── router.py            # 메인 라우터 (조율자)
├── oee.py              # OEE 계산
├── mtbf_mttr.py        # MTBF/MTTR 계산
├── pareto.py           # Pareto 분석
├── trends.py           # 트렌드 분석
├── dashboard.py        # 대시보드 요약
├── helpers/            # 헬퍼 함수
│   ├── __init__.py
│   ├── calculations.py
│   └── validation.py
└── queries/            # SQL 쿼리
    ├── __init__.py
    ├── production_queries.py
    ├── alarm_queries.py
    └── status_queries.py

작성일: 2026-02-02
수정일: 2026-02-02
"""

# 메인 라우터 export (기존 호환성)
from .router import router

# 서브 모듈 export (필요 시 개별 import 가능)
from . import oee
from . import mtbf_mttr
from . import pareto
from . import trends
from . import dashboard

# 헬퍼 함수 export
from .helpers import (
    safe_divide,
    safe_percentage,
    get_default_date_range,
    validate_calculation_period
)

__all__ = [
    'router',
    'oee',
    'mtbf_mttr',
    'pareto',
    'trends',
    'dashboard',
    # helpers
    'safe_divide',
    'safe_percentage',
    'get_default_date_range',
    'validate_calculation_period',
]

__version__ = "2.0.0"
