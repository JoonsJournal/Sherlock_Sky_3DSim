"""
analytics/queries/alarm_queries.py
알람/MTBF/MTTR 관련 SQL 쿼리

@version 1.0.0
@changelog
- v1.0.0: 실제 DB 스키마 기반 쿼리 작성
  - log.AlarmEvent 테이블 사용
  - ref.RemoteAlarmList 테이블 사용
  - ⚠️ MSSQL 문법 적용

@dependencies
- log.AlarmEvent: 알람 이벤트 이력
- ref.RemoteAlarmList: 원격 알람 코드 참조

작성일: 2026-02-02
수정일: 2026-02-02
"""


def get_alarm_count_query(single_equipment: bool = True) -> str:
    """
    알람 발생 횟수 조회
    
    Args:
        single_equipment: 단일 설비 여부
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID (single_equipment=True 일 때)
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns (single):
        - 0: alarm_count (int) - 알람 발생 횟수
        - 1: cleared_count (int) - 해제된 알람 횟수
    
    Result Columns (all):
        - 0: EquipmentId (int)
        - 1: alarm_count (int)
        - 2: cleared_count (int)
    """
    if single_equipment:
        return """
            SELECT 
                COUNT(CASE WHEN ae.IsSet = 1 THEN 1 END) as alarm_count,
                COUNT(CASE WHEN ae.IsSet = 0 THEN 1 END) as cleared_count
            FROM [log].[AlarmEvent] ae
            WHERE ae.EquipmentId = ?
              AND ae.OccurredAtUtc BETWEEN ? AND ?
        """
    else:
        return """
            SELECT 
                ae.EquipmentId,
                COUNT(CASE WHEN ae.IsSet = 1 THEN 1 END) as alarm_count,
                COUNT(CASE WHEN ae.IsSet = 0 THEN 1 END) as cleared_count
            FROM [log].[AlarmEvent] ae
            WHERE ae.OccurredAtUtc BETWEEN ? AND ?
            GROUP BY ae.EquipmentId
        """


def get_alarm_by_code_query() -> str:
    """
    알람 코드별 발생 횟수 조회 (Pareto 분석용)
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
        - top_n (int): 상위 N개
    
    Result Columns:
        - 0: AlarmCode (int)
        - 1: AlarmMessage (str)
        - 2: occurrence_count (int)
        - 3: equipment_count (int) - 발생 설비 수
    """
    return """
        SELECT TOP (?)
            ae.AlarmCode,
            MAX(ae.AlarmMessage) as AlarmMessage,
            COUNT(*) as occurrence_count,
            COUNT(DISTINCT ae.EquipmentId) as equipment_count
        FROM [log].[AlarmEvent] ae
        WHERE ae.IsSet = 1
          AND ae.OccurredAtUtc BETWEEN ? AND ?
        GROUP BY ae.AlarmCode
        ORDER BY occurrence_count DESC
    """


def get_alarm_duration_query() -> str:
    """
    알람 지속 시간 조회 (MTTR 계산용)
    
    알람 발생(IsSet=1)부터 해제(IsSet=0)까지의 시간 계산
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: AlarmEventId (bigint) - SET 알람 ID
        - 1: AlarmCode (int)
        - 2: AlarmMessage (str)
        - 3: set_time (datetime) - 알람 발생 시간
        - 4: clear_time (datetime) - 알람 해제 시간 (NULL 가능)
        - 5: duration_seconds (float) - 지속 시간 (초)
    """
    return """
        WITH AlarmPairs AS (
            SELECT 
                ae_set.AlarmEventId,
                ae_set.EquipmentId,
                ae_set.AlarmCode,
                ae_set.AlarmMessage,
                ae_set.OccurredAtUtc as set_time,
                (
                    SELECT MIN(ae_clear.OccurredAtUtc)
                    FROM [log].[AlarmEvent] ae_clear
                    WHERE ae_clear.EquipmentId = ae_set.EquipmentId
                      AND ae_clear.AlarmCode = ae_set.AlarmCode
                      AND ae_clear.IsSet = 0
                      AND ae_clear.OccurredAtUtc > ae_set.OccurredAtUtc
                ) as clear_time
            FROM [log].[AlarmEvent] ae_set
            WHERE ae_set.EquipmentId = ?
              AND ae_set.IsSet = 1
              AND ae_set.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT 
            AlarmEventId,
            AlarmCode,
            AlarmMessage,
            set_time,
            clear_time,
            CASE 
                WHEN clear_time IS NOT NULL 
                THEN DATEDIFF(SECOND, set_time, clear_time)
                ELSE NULL
            END as duration_seconds
        FROM AlarmPairs
        ORDER BY set_time DESC
    """


def get_mtbf_data_query() -> str:
    """
    MTBF 계산용 알람 간격 데이터 조회
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: alarm_set_time (datetime) - 알람 발생 시간
    """
    return """
        SELECT ae.OccurredAtUtc as alarm_set_time
        FROM [log].[AlarmEvent] ae
        WHERE ae.EquipmentId = ?
          AND ae.IsSet = 1
          AND ae.OccurredAtUtc BETWEEN ? AND ?
        ORDER BY ae.OccurredAtUtc ASC
    """


def get_mttr_summary_query(single_equipment: bool = True) -> str:
    """
    MTTR 요약 데이터 조회
    
    Args:
        single_equipment: 단일 설비 여부
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters (single):
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Parameters (all):
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns (single):
        - 0: failure_count (int)
        - 1: avg_repair_seconds (float)
        - 2: total_downtime_seconds (float)
    
    Result Columns (all):
        - 0: EquipmentId (int)
        - 1: failure_count (int)
        - 2: avg_repair_seconds (float)
        - 3: total_downtime_seconds (float)
    """
    base_cte = """
        WITH AlarmDurations AS (
            SELECT 
                ae_set.EquipmentId,
                ae_set.AlarmCode,
                ae_set.OccurredAtUtc as set_time,
                (
                    SELECT MIN(ae_clear.OccurredAtUtc)
                    FROM [log].[AlarmEvent] ae_clear
                    WHERE ae_clear.EquipmentId = ae_set.EquipmentId
                      AND ae_clear.AlarmCode = ae_set.AlarmCode
                      AND ae_clear.IsSet = 0
                      AND ae_clear.OccurredAtUtc > ae_set.OccurredAtUtc
                ) as clear_time
            FROM [log].[AlarmEvent] ae_set
            WHERE ae_set.IsSet = 1
    """
    
    if single_equipment:
        return base_cte + """
              AND ae_set.EquipmentId = ?
              AND ae_set.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT 
            COUNT(*) as failure_count,
            AVG(
                CASE 
                    WHEN clear_time IS NOT NULL 
                    THEN CAST(DATEDIFF(SECOND, set_time, clear_time) AS FLOAT)
                    ELSE NULL
                END
            ) as avg_repair_seconds,
            SUM(
                CASE 
                    WHEN clear_time IS NOT NULL 
                    THEN DATEDIFF(SECOND, set_time, clear_time)
                    ELSE 0
                END
            ) as total_downtime_seconds
        FROM AlarmDurations
        WHERE clear_time IS NOT NULL
        """
    else:
        return base_cte + """
              AND ae_set.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT 
            EquipmentId,
            COUNT(*) as failure_count,
            AVG(
                CASE 
                    WHEN clear_time IS NOT NULL 
                    THEN CAST(DATEDIFF(SECOND, set_time, clear_time) AS FLOAT)
                    ELSE NULL
                END
            ) as avg_repair_seconds,
            SUM(
                CASE 
                    WHEN clear_time IS NOT NULL 
                    THEN DATEDIFF(SECOND, set_time, clear_time)
                    ELSE 0
                END
            ) as total_downtime_seconds
        FROM AlarmDurations
        WHERE clear_time IS NOT NULL
        GROUP BY EquipmentId
        """


def get_remote_alarm_codes_query() -> str:
    """
    원격 알람 코드 목록 조회 (심각 알람 필터링용)
    
    Returns:
        SQL 쿼리 문자열
    
    Result Columns:
        - 0: RemoteAlarmCode (int)
        - 1: RemoteAlarmMessage (str)
    """
    return """
        SELECT 
            RemoteAlarmCode,
            RemoteAlarmMessage
        FROM [ref].[RemoteAlarmList]
        ORDER BY RemoteAlarmCode
    """


def get_alarm_trend_query() -> str:
    """
    알람 트렌드 조회 (시간별/일별 집계)
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
        - interval_type (str): 'hour' or 'day'
    
    Note: interval_type에 따라 동적으로 쿼리 생성 필요
    
    Result Columns:
        - 0: time_bucket (datetime)
        - 1: alarm_count (int)
    """
    # 기본 일별 집계
    return """
        SELECT 
            CAST(ae.OccurredAtUtc AS DATE) as time_bucket,
            COUNT(CASE WHEN ae.IsSet = 1 THEN 1 END) as alarm_count
        FROM [log].[AlarmEvent] ae
        WHERE ae.OccurredAtUtc BETWEEN ? AND ?
        GROUP BY CAST(ae.OccurredAtUtc AS DATE)
        ORDER BY time_bucket
    """
