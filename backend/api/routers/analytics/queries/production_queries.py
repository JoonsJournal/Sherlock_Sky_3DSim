"""
analytics/queries/production_queries.py
생산량/Cycle Time 관련 SQL 쿼리

@version 1.0.0
@changelog
- v1.0.0: 실제 DB 스키마 기반 쿼리 작성
  - log.CycleTime 테이블 사용
  - log.Lotinfo 테이블 사용
  - ⚠️ MSSQL 문법 적용

@dependencies
- log.CycleTime: 사이클 시간 기록
- log.Lotinfo: Lot 정보

작성일: 2026-02-02
수정일: 2026-02-02
"""


def get_cycle_count_query(single_equipment: bool = True) -> str:
    """
    특정 기간 내 Cycle 완료 개수 조회
    
    Args:
        single_equipment: 단일 설비 여부
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID (single_equipment=True 일 때)
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: cycle_count (int)
    """
    if single_equipment:
        return """
            SELECT COUNT(*) as cycle_count
            FROM [log].[CycleTime] ct
            WHERE ct.EquipmentId = ?
              AND ct.[Time] BETWEEN ? AND ?
        """
    else:
        return """
            SELECT 
                ct.EquipmentId,
                COUNT(*) as cycle_count
            FROM [log].[CycleTime] ct
            WHERE ct.[Time] BETWEEN ? AND ?
            GROUP BY ct.EquipmentId
        """


def get_lot_production_query() -> str:
    """
    Lot별 생산량 조회 (현재 진행 중인 Lot 포함)
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: LotId (str)
        - 1: LotQty (int) - 목표 수량
        - 2: ProductModel (str)
        - 3: RecipeId (str)
        - 4: lot_start_time (datetime)
        - 5: lot_end_time (datetime or None)
        - 6: produced_count (int) - 실제 생산량
    """
    return """
        WITH LotPeriods AS (
            -- Lot 시작/종료 기간 계산
            SELECT 
                li.EquipmentId,
                li.LotId,
                li.LotQty,
                li.ProductModel,
                li.RecipeId,
                li.OccurredAtUtc as lot_start_time,
                (
                    SELECT MIN(li2.OccurredAtUtc)
                    FROM [log].[Lotinfo] li2
                    WHERE li2.EquipmentId = li.EquipmentId
                      AND li2.LotId = li.LotId
                      AND li2.IsStart = 0
                      AND li2.OccurredAtUtc > li.OccurredAtUtc
                ) as lot_end_time
            FROM [log].[Lotinfo] li
            WHERE li.EquipmentId = ?
              AND li.IsStart = 1
              AND li.OccurredAtUtc BETWEEN ? AND ?
        )
        SELECT 
            lp.LotId,
            lp.LotQty,
            lp.ProductModel,
            lp.RecipeId,
            lp.lot_start_time,
            lp.lot_end_time,
            (
                SELECT COUNT(*)
                FROM [log].[CycleTime] ct
                WHERE ct.EquipmentId = lp.EquipmentId
                  AND ct.[Time] >= lp.lot_start_time
                  AND ct.[Time] <= COALESCE(lp.lot_end_time, GETUTCDATE())
            ) as produced_count
        FROM LotPeriods lp
        ORDER BY lp.lot_start_time DESC
    """


def get_tact_time_query() -> str:
    """
    Tact Time 계산용 Cycle Time 목록 조회
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: Time (datetime) - Cycle 완료 시간
    """
    return """
        SELECT ct.[Time]
        FROM [log].[CycleTime] ct
        WHERE ct.EquipmentId = ?
          AND ct.[Time] BETWEEN ? AND ?
        ORDER BY ct.[Time] ASC
    """


def get_cycle_time_details_query() -> str:
    """
    상세 Cycle Time 정보 조회 (공정별 소요 시간)
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - equipment_id (int): 설비 ID
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
        - limit (int): 조회 개수 제한
    
    Result Columns:
        - 0: Time (datetime)
        - 1: PickUp (decimal)
        - 2: ThicknessMeasure (decimal)
        - 3: PreAlign (decimal)
        - 4: Loading (decimal)
        - 5: Align_Pos_Move (decimal)
        - 6: Align_XCh (decimal)
        - 7: Cutting_XCh (decimal)
        - 8: Cut_CT_XCh (decimal)
        - 9: Align_Ych (decimal)
        - 10: Cutting_Ych (decimal)
        - 11: Cut_CT_Uch (decimal)
        - 12: Unloading_Pick (decimal)
        - 13: Unloading_Place (decimal)
    """
    return """
        SELECT TOP (?)
            ct.[Time],
            ct.PickUp,
            ct.ThicknessMeasure,
            ct.PreAlign,
            ct.Loading,
            ct.Align_Pos_Move,
            ct.Align_XCh,
            ct.Cutting_XCh,
            ct.Cut_CT_XCh,
            ct.Align_Ych,
            ct.Cutting_Ych,
            ct.Cut_CT_Uch,
            ct.Unloading_Pick,
            ct.Unloading_Place
        FROM [log].[CycleTime] ct
        WHERE ct.EquipmentId = ?
          AND ct.[Time] BETWEEN ? AND ?
        ORDER BY ct.[Time] DESC
    """


def get_production_summary_query() -> str:
    """
    전체 설비 생산량 요약 조회
    
    Returns:
        SQL 쿼리 문자열
    
    Parameters:
        - start_date (datetime): 시작 일시
        - end_date (datetime): 종료 일시
    
    Result Columns:
        - 0: EquipmentId (int)
        - 1: equipment_name (str)
        - 2: cycle_count (int)
        - 3: lot_count (int)
    """
    return """
        SELECT 
            e.EquipmentId,
            e.EquipmentName,
            (
                SELECT COUNT(*)
                FROM [log].[CycleTime] ct
                WHERE ct.EquipmentId = e.EquipmentId
                  AND ct.[Time] BETWEEN ? AND ?
            ) as cycle_count,
            (
                SELECT COUNT(*)
                FROM [log].[Lotinfo] li
                WHERE li.EquipmentId = e.EquipmentId
                  AND li.IsStart = 1
                  AND li.OccurredAtUtc BETWEEN ? AND ?
            ) as lot_count
        FROM [core].[Equipment] e
        ORDER BY e.EquipmentId
    """
