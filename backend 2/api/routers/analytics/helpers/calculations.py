"""
analytics/helpers/calculations.py
분석 계산 헬퍼 함수

@version 1.0.0
@changelog
- v1.0.0: analytics.py에서 분리
  - safe_divide, safe_percentage 이동
  - validate_calculation_period 이동
  - ⚠️ 호환성: 기존 로직 100% 유지

@dependencies
- datetime: 날짜 처리
- ..utils.errors: ValidationError

작성일: 2026-02-02
수정일: 2026-02-02
"""

from typing import Tuple
from datetime import datetime, timedelta
import logging

# 로거 설정
logger = logging.getLogger(__name__)


# ============================================================================
# 수치 계산 헬퍼
# ============================================================================

def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """
    안전한 나눗셈 (0으로 나누기 방지)
    
    Args:
        numerator: 분자
        denominator: 분모
        default: 분모가 0일 때 반환할 기본값
    
    Returns:
        나눗셈 결과 또는 기본값
    """
    try:
        if denominator == 0:
            logger.debug(f"Division by zero avoided: {numerator}/{denominator}")
            return default
        return numerator / denominator
    except (TypeError, ValueError) as e:
        logger.warning(f"⚠️ Division error: {e}")
        return default


def safe_percentage(value: float, total: float, decimals: int = 2) -> float:
    """
    안전한 퍼센트 계산
    
    Args:
        value: 값
        total: 전체
        decimals: 소수점 자리수
    
    Returns:
        퍼센트 값 (0-100)
    """
    percentage = safe_divide(value, total, 0.0) * 100
    return round(percentage, decimals)


def round_decimal(value: float, decimals: int = 2) -> float:
    """
    안전한 소수점 반올림
    
    Args:
        value: 반올림할 값
        decimals: 소수점 자리수
    
    Returns:
        반올림된 값
    """
    try:
        if value is None:
            return 0.0
        return round(float(value), decimals)
    except (TypeError, ValueError):
        return 0.0


# ============================================================================
# 날짜 처리 헬퍼
# ============================================================================

def get_default_date_range(days: int = 7) -> Tuple[str, str]:
    """
    기본 날짜 범위 생성
    
    Args:
        days: 과거 일수
    
    Returns:
        (start_date_str, end_date_str) ISO 형식
    """
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.isoformat(), end.isoformat()


def parse_datetime(date_str: str) -> datetime:
    """
    ISO 형식 날짜 문자열 파싱
    
    Args:
        date_str: ISO 8601 형식 날짜 문자열
    
    Returns:
        datetime 객체
    """
    # Z suffix 처리
    if date_str.endswith('Z'):
        date_str = date_str[:-1] + '+00:00'
    
    return datetime.fromisoformat(date_str)


def calculate_period_hours(start_date: str, end_date: str) -> float:
    """
    두 날짜 사이의 시간(hour) 계산
    
    Args:
        start_date: 시작 날짜 (ISO 형식)
        end_date: 종료 날짜 (ISO 형식)
    
    Returns:
        시간 차이 (hours)
    """
    start_dt = parse_datetime(start_date)
    end_dt = parse_datetime(end_date)
    return (end_dt - start_dt).total_seconds() / 3600


# ============================================================================
# Tact Time 계산
# ============================================================================

def calculate_tact_time(timestamps: list) -> dict:
    """
    Tact Time 계산 (연속된 시간 간격)
    
    Args:
        timestamps: datetime 객체 리스트 (정렬된 상태)
    
    Returns:
        {
            "average_seconds": float,
            "min_seconds": float,
            "max_seconds": float,
            "count": int
        }
    """
    if not timestamps or len(timestamps) < 2:
        return {
            "average_seconds": 0.0,
            "min_seconds": 0.0,
            "max_seconds": 0.0,
            "count": 0
        }
    
    # 간격 계산
    intervals = []
    for i in range(1, len(timestamps)):
        delta = (timestamps[i] - timestamps[i-1]).total_seconds()
        if delta > 0:  # 양수 간격만
            intervals.append(delta)
    
    if not intervals:
        return {
            "average_seconds": 0.0,
            "min_seconds": 0.0,
            "max_seconds": 0.0,
            "count": 0
        }
    
    return {
        "average_seconds": round(sum(intervals) / len(intervals), 2),
        "min_seconds": round(min(intervals), 2),
        "max_seconds": round(max(intervals), 2),
        "count": len(intervals)
    }
