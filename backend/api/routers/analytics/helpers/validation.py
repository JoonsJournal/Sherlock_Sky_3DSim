"""
analytics/helpers/validation.py
분석 API 입력값 검증 헬퍼

@version 1.0.0
@changelog
- v1.0.0: analytics.py에서 분리
  - validate_calculation_period 이동
  - validate_equipment_id 래핑
  - ⚠️ 호환성: 기존 검증 로직 100% 유지

@dependencies
- datetime: 날짜 처리
- ...utils.errors: ValidationError, validate_equipment_id, validate_date_range

작성일: 2026-02-02
수정일: 2026-02-02
"""

from typing import Tuple, Optional
from datetime import datetime
import logging

from ...utils.errors import ValidationError, validate_date_range

# 로거 설정
logger = logging.getLogger(__name__)


def validate_calculation_period(
    start_date: str, 
    end_date: str, 
    max_days: int = 365
) -> Tuple[datetime, datetime]:
    """
    계산 기간 검증
    
    Args:
        start_date: 시작 날짜 (ISO 형식)
        end_date: 종료 날짜 (ISO 형식)
        max_days: 최대 허용 기간 (일)
    
    Returns:
        (start_datetime, end_datetime)
    
    Raises:
        ValidationError: 날짜 범위가 유효하지 않음
    """
    start, end = validate_date_range(start_date, end_date)
    
    period_days = (end - start).days
    if period_days > max_days:
        logger.warning(f"⚠️ Period too long: {period_days} days (max: {max_days})")
        raise ValidationError(
            f"조회 기간이 너무 깁니다 (최대 {max_days}일): {period_days}일",
            field="date_range"
        )
    
    if period_days < 1:
        raise ValidationError(
            "조회 기간은 최소 1일 이상이어야 합니다",
            field="date_range"
        )
    
    return start, end


def validate_frontend_id(frontend_id: Optional[str]) -> Optional[str]:
    """
    Frontend ID 검증
    
    Args:
        frontend_id: Frontend ID (예: "EQ-17-03")
    
    Returns:
        검증된 frontend_id 또는 None
    
    Raises:
        ValidationError: 형식이 올바르지 않음
    """
    if frontend_id is None:
        return None
    
    frontend_id = frontend_id.strip()
    
    if not frontend_id:
        return None
    
    # 기본 형식 검증 (EQ-XX-XX 패턴)
    if not frontend_id.startswith("EQ-"):
        logger.warning(f"⚠️ Invalid frontend_id format: {frontend_id}")
        raise ValidationError(
            f"Frontend ID 형식이 올바르지 않습니다: {frontend_id}",
            field="frontend_id"
        )
    
    return frontend_id


def validate_equipment_id_int(equipment_id: Optional[int]) -> Optional[int]:
    """
    Equipment ID (정수) 검증
    
    Args:
        equipment_id: DB Equipment ID
    
    Returns:
        검증된 equipment_id 또는 None
    
    Raises:
        ValidationError: 유효하지 않은 ID
    """
    if equipment_id is None:
        return None
    
    if not isinstance(equipment_id, int) or equipment_id <= 0:
        raise ValidationError(
            f"Equipment ID는 양의 정수여야 합니다: {equipment_id}",
            field="equipment_id"
        )
    
    return equipment_id


def validate_analysis_type(analysis_type: str) -> str:
    """
    분석 유형 검증
    
    Args:
        analysis_type: 분석 유형 ("alarm", "defect", "downtime")
    
    Returns:
        검증된 analysis_type
    
    Raises:
        ValidationError: 지원하지 않는 유형
    """
    valid_types = {"alarm", "defect", "downtime"}
    
    if analysis_type not in valid_types:
        raise ValidationError(
            f"지원하지 않는 분석 유형입니다: {analysis_type}. "
            f"가능한 값: {', '.join(valid_types)}",
            field="analysis_type"
        )
    
    return analysis_type


def validate_metric_type(metric: str) -> str:
    """
    트렌드 메트릭 유형 검증
    
    Args:
        metric: 메트릭 유형 ("production", "defect", "alarm", "oee")
    
    Returns:
        검증된 metric
    
    Raises:
        ValidationError: 지원하지 않는 유형
    """
    valid_metrics = {"production", "defect", "alarm", "oee"}
    
    if metric not in valid_metrics:
        raise ValidationError(
            f"지원하지 않는 메트릭입니다: {metric}. "
            f"가능한 값: {', '.join(valid_metrics)}",
            field="metric"
        )
    
    return metric


def validate_interval(interval: str) -> str:
    """
    시간 간격 검증
    
    Args:
        interval: 시간 간격 ("1hour", "1day", "1week")
    
    Returns:
        검증된 interval
    
    Raises:
        ValidationError: 지원하지 않는 간격
    """
    valid_intervals = {"1hour", "1day", "1week"}
    
    if interval not in valid_intervals:
        raise ValidationError(
            f"지원하지 않는 시간 간격입니다: {interval}. "
            f"가능한 값: {', '.join(valid_intervals)}",
            field="interval"
        )
    
    return interval
