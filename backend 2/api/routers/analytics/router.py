"""
analytics/router.py
분석 API 메인 라우터 (조율자)

@version 2.0.0
@changelog
- v2.0.0: 모듈 분리 리팩토링
  - OEE, MTBF/MTTR, Pareto, Trends, Dashboard 분리
  - 실제 DB 스키마에 맞게 쿼리 수정
  - ⚠️ 호환성: 기존 API 엔드포인트 100% 유지
    - GET /oee
    - GET /mtbf-mttr
    - GET /pareto
    - GET /trends
    - GET /dashboard

@description
분석 모듈 통합 라우터
- 각 분석 기능을 서브 모듈로 분리
- 기존 호환성 유지를 위해 동일한 엔드포인트 제공

@dependencies
- oee.py: OEE 계산
- mtbf_mttr.py: MTBF/MTTR 계산
- pareto.py: Pareto 분석
- trends.py: 트렌드 분석
- dashboard.py: 대시보드 요약

작성일: 2026-02-02
수정일: 2026-02-02
"""

from fastapi import APIRouter
import logging

# 서브 모듈 import
from .oee import router as oee_router
from .mtbf_mttr import router as mtbf_router
from .pareto import router as pareto_router
from .trends import router as trends_router
from .dashboard import router as dashboard_router

# 로거 설정
logger = logging.getLogger(__name__)

# 메인 라우터 생성
router = APIRouter()

# ============================================================================
# 서브 라우터 등록
# ============================================================================

# OEE 라우터 (GET /oee)
router.include_router(
    oee_router,
    tags=["Analytics - OEE"]
)

# MTBF/MTTR 라우터 (GET /mtbf-mttr)
router.include_router(
    mtbf_router,
    tags=["Analytics - Reliability"]
)

# Pareto 라우터 (GET /pareto)
router.include_router(
    pareto_router,
    tags=["Analytics - Pareto"]
)

# Trends 라우터 (GET /trends)
router.include_router(
    trends_router,
    tags=["Analytics - Trends"]
)

# Dashboard 라우터 (GET /dashboard)
router.include_router(
    dashboard_router,
    tags=["Analytics - Dashboard"]
)


# ============================================================================
# 모듈 초기화 로깅
# ============================================================================

logger.info("🚀 Analytics 모듈 초기화 완료")
logger.info("   ├── OEE 라우터 등록")
logger.info("   ├── MTBF/MTTR 라우터 등록")
logger.info("   ├── Pareto 라우터 등록")
logger.info("   ├── Trends 라우터 등록")
logger.info("   └── Dashboard 라우터 등록")
