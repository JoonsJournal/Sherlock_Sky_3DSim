"""
analytics/queries/__init__.py
분석 SQL 쿼리 모듈 Barrel Export

@version 1.0.0
@description
실제 DB 테이블 스키마 기반 쿼리:
- log.CycleTime: 사이클 시간 기록
- log.AlarmEvent: 알람 이벤트
- log.EquipmentState: 설비 상태
- log.Lotinfo: Lot 정보
- core.Equipment: 설비 마스터

작성일: 2026-02-02
"""

from .production_queries import (
    get_cycle_count_query,
    get_lot_production_query,
    get_tact_time_query
)

from .alarm_queries import (
    get_alarm_count_query,
    get_alarm_by_code_query,
    get_alarm_duration_query
)

from .status_queries import (
    get_equipment_status_query,
    get_running_ratio_query
)

__all__ = [
    # production
    'get_cycle_count_query',
    'get_lot_production_query',
    'get_tact_time_query',
    # alarm
    'get_alarm_count_query',
    'get_alarm_by_code_query',
    'get_alarm_duration_query',
    # status
    'get_equipment_status_query',
    'get_running_ratio_query',
]
