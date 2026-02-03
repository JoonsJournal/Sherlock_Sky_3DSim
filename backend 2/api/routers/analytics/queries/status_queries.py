"""
analytics/queries/status_queries.py
설비 상태/가동률 관련 SQL 쿼리

@version 1.0.0
@changelog
- v1.0.0: 실제 DB 스키마 기반 쿼리 작성
  - log.EquipmentState 테이블 사용
  - core.Equipment 테이블 사용
  - ⚠️ MSSQL 문법 적용

@dependencies
- log.EquipmentState: 설비 상태 변경 이력
- core.Equipment: 설비 마스터

작성일: 2026-02-02
수정일: 2026-02-02
"""


def get_equipment_status_query() -> str:
    """
    설비 최신 상태 조회
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
    
    Result Columns:
        - 0: EquipmentId (int)
        - 1: Status (str)
        - 2: OccurredAtUtc (datetime)
    """
    return """
        SELECT TOP 1
            es.EquipmentId,
            es.Status,
            es.OccurredAtUtc
        FROM [log].[EquipmentState] es
        WHERE es.EquipmentId = ?
        ORDER BY es.OccurredAtUtc DESC
    """


def get_running_ratio_query() -> str:
    """
    가동률 계산용 상태 데이터 조회
    
    RUNNING 상태와 비 RUNNING 상태의 비율 계산
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: total_records (int) - 전체 상태 기록 수
        - 1: running_records (int) - RUNNING 상태 기록 수
    """
    return """
        SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN es.Status = 'RUNNING' THEN 1 END) as running_records
        FROM [log].[EquipmentState] es
        WHERE es.EquipmentId = ?
          AND es.OccurredAtUtc BETWEEN ? AND ?
    """


def get_status_duration_query() -> str:
    """
    상태별 지속 시간 조회 (상세 가동률 분석용)
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: StateLogId (bigint)
        - 1: Status (str)
        - 2: start_time (datetime)
        - 3: end_time (datetime)
        - 4: duration_seconds (int)
    """
    return """
        WITH StatusWithNext AS (
            SELECT 
                es.StateLogId,
                es.EquipmentId,
                es.Status,
                es.OccurredAtUtc as start_time,
                LEAD(es.OccurredAtUtc) OVER (
                    PARTITION BY es.EquipmentId 
                    ORDER BY es.OccurredAtUtc
                ) as end_time
            FROM [log].[EquipmentState] es
            WHERE es.EquipmentId = ?
              AND es.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT 
            StateLogId,
            Status,
            start_time,
            COALESCE(end_time, GETUTCDATE()) as end_time,
            DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE())) as duration_seconds
        FROM StatusWithNext
        ORDER BY start_time
    """


def get_availability_summary_query(single_equipment: bool = True) -> str:
    """
    가용성 요약 조회 (OEE Availability 계산용)
    
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
        - 0: total_duration_seconds (bigint)
        - 1: running_duration_seconds (bigint)
        - 2: idle_duration_seconds (bigint)
        - 3: alarm_duration_seconds (bigint)
    
    Result Columns (all):
        - 0: EquipmentId (int)
        - 1-4: same as single
    """
    base_cte = """
        WITH StatusDurations AS (
            SELECT 
                es.EquipmentId,
                es.Status,
                es.OccurredAtUtc as start_time,
                LEAD(es.OccurredAtUtc) OVER (
                    PARTITION BY es.EquipmentId 
                    ORDER BY es.OccurredAtUtc
                ) as end_time
            FROM [log].[EquipmentState] es
            WHERE es.OccurredAtUtc BETWEEN {start_param} AND {end_param}
    """
    
    if single_equipment:
        return """
        WITH StatusDurations AS (
            SELECT 
                es.EquipmentId,
                es.Status,
                es.OccurredAtUtc as start_time,
                LEAD(es.OccurredAtUtc) OVER (
                    PARTITION BY es.EquipmentId 
                    ORDER BY es.OccurredAtUtc
                ) as end_time
            FROM [log].[EquipmentState] es
            WHERE es.EquipmentId = ?
              AND es.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT 
            SUM(DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE()))) as total_duration_seconds,
            SUM(CASE WHEN Status = 'RUNNING' 
                THEN DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE())) 
                ELSE 0 END) as running_duration_seconds,
            SUM(CASE WHEN Status IN ('IDLE', 'STANDBY') 
                THEN DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE())) 
                ELSE 0 END) as idle_duration_seconds,
            SUM(CASE WHEN Status IN ('ALARM', 'ERROR') 
                THEN DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE())) 
                ELSE 0 END) as alarm_duration_seconds
        FROM StatusDurations
        """
    else:
        return """
        WITH StatusDurations AS (
            SELECT 
                es.EquipmentId,
                es.Status,
                es.OccurredAtUtc as start_time,
                LEAD(es.OccurredAtUtc) OVER (
                    PARTITION BY es.EquipmentId 
                    ORDER BY es.OccurredAtUtc
                ) as end_time
            FROM [log].[EquipmentState] es
            WHERE es.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT 
            EquipmentId,
            SUM(DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE()))) as total_duration_seconds,
            SUM(CASE WHEN Status = 'RUNNING' 
                THEN DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE())) 
                ELSE 0 END) as running_duration_seconds,
            SUM(CASE WHEN Status IN ('IDLE', 'STANDBY') 
                THEN DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE())) 
                ELSE 0 END) as idle_duration_seconds,
            SUM(CASE WHEN Status IN ('ALARM', 'ERROR') 
                THEN DATEDIFF(SECOND, start_time, COALESCE(end_time, GETUTCDATE())) 
                ELSE 0 END) as alarm_duration_seconds
        FROM StatusDurations
        GROUP BY EquipmentId
        """


def get_downtime_by_equipment_query() -> str:
    """
    설비별 다운타임 조회 (Pareto 분석용)
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
        - top_n (int): 상위 N개
    
    Result Columns:
        - 0: EquipmentId (int)
        - 1: EquipmentName (str)
        - 2: downtime_count (int) - 다운타임 발생 횟수
        - 3: total_downtime_seconds (int) - 총 다운타임 (초)
    """
    return """
        WITH DowntimeEvents AS (
            SELECT 
                es.EquipmentId,
                es.OccurredAtUtc as start_time,
                LEAD(es.OccurredAtUtc) OVER (
                    PARTITION BY es.EquipmentId 
                    ORDER BY es.OccurredAtUtc
                ) as end_time
            FROM [log].[EquipmentState] es
            WHERE es.Status IN ('ALARM', 'ERROR', 'IDLE')
              AND es.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT TOP (?)
            de.EquipmentId,
            e.EquipmentName,
            COUNT(*) as downtime_count,
            SUM(DATEDIFF(SECOND, de.start_time, COALESCE(de.end_time, GETUTCDATE()))) as total_downtime_seconds
        FROM DowntimeEvents de
        JOIN [core].[Equipment] e ON de.EquipmentId = e.EquipmentId
        GROUP BY de.EquipmentId, e.EquipmentName
        ORDER BY total_downtime_seconds DESC
    """


def get_status_trend_query() -> str:
    """
    상태 트렌드 조회 (시간별/일별 상태 분포)
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: time_bucket (date)
        - 1: running_count (int)
        - 2: idle_count (int)
        - 3: alarm_count (int)
    """
    return """
        SELECT 
            CAST(es.OccurredAtUtc AS DATE) as time_bucket,
            COUNT(CASE WHEN es.Status = 'RUNNING' THEN 1 END) as running_count,
            COUNT(CASE WHEN es.Status IN ('IDLE', 'STANDBY') THEN 1 END) as idle_count,
            COUNT(CASE WHEN es.Status IN ('ALARM', 'ERROR') THEN 1 END) as alarm_count
        FROM [log].[EquipmentState] es
        WHERE es.OccurredAtUtc BETWEEN ? AND ?
        GROUP BY CAST(es.OccurredAtUtc AS DATE)
        ORDER BY time_bucket
    """
