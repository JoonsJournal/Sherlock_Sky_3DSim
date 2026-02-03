"""
production_tact.py
Production Count & Tact Time 조회 쿼리

@version 1.0.0
@changelog
- v1.0.0: equipment_detail.py에서 분리
  - fetch_production_count()
  - fetch_tact_time()
  - fetch_production_and_tact_batch()
  - ⚠️ 호환성: 기존 함수 시그니처/로직 100% 유지

작성일: 2026-02-01
"""

from typing import Optional, List, Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def fetch_production_count(conn, equipment_id: int, lot_start_time: datetime) -> Optional[int]:
    """
    Lot 시작 이후 생산 개수 조회
    
    🆕 v2.1.0: CycleTime COUNT 쿼리
    🔴 v2.2.0: WITH (NOLOCK) 추가
    
    Args:
        conn: DB Connection
        equipment_id: Equipment ID
        lot_start_time: Lot 시작 시간 (이 시점 이후의 CycleTime COUNT)
    
    Returns:
        int or None: 생산 개수
    """
    if lot_start_time is None:
        return None
    
    cursor = None
    try:
        cursor = conn.cursor()
        
        # 🔴 v2.2.0: WITH (NOLOCK) 추가
        query = """
            SELECT COUNT(*) AS production_count
            FROM log.CycleTime WITH (NOLOCK)
            WHERE EquipmentId = %d
              AND Time >= %s
        """
        
        cursor.execute(query, (equipment_id, lot_start_time))
        row = cursor.fetchone()
        
        if row:
            return int(row[0])
        return None
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch production count for equipment {equipment_id}: {e}")
        return None
    finally:
        if cursor:
            cursor.close()


def fetch_tact_time(conn, equipment_id: int) -> Optional[float]:
    """
    최근 2개 CycleTime 간격으로 Tact Time 계산
    
    🆕 v2.1.0: 최근 2개 CycleTime 조회 후 간격 계산
    🔴 v2.2.0: WITH (NOLOCK) 추가
    
    Args:
        conn: DB Connection
        equipment_id: Equipment ID
    
    Returns:
        float or None: Tact Time (초)
    """
    cursor = None
    try:
        cursor = conn.cursor()
        
        # 🔴 v2.2.0: WITH (NOLOCK) 추가
        # 최근 2개 CycleTime 조회
        query = """
            SELECT TOP 2 Time
            FROM log.CycleTime WITH (NOLOCK)
            WHERE EquipmentId = %d
            ORDER BY Time DESC
        """
        
        cursor.execute(query, (equipment_id,))
        rows = cursor.fetchall()
        
        # 2개 미만이면 Tact Time 계산 불가
        if len(rows) < 2:
            return None
        
        # 최신 시간과 이전 시간의 간격 (초 단위)
        newer_time = rows[0][0]
        older_time = rows[1][0]
        
        if newer_time and older_time:
            delta = newer_time - older_time
            tact_time_seconds = delta.total_seconds()
            return round(tact_time_seconds, 1)
        
        return None
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch tact time for equipment {equipment_id}: {e}")
        return None
    finally:
        if cursor:
            cursor.close()


def fetch_production_and_tact_batch(
    conn, 
    equipment_ids: List[int], 
    lot_start_times: Dict[int, datetime]
) -> Dict[int, Dict]:
    """
    다중 설비의 Production Count & Tact Time 일괄 조회
    
    🆕 v2.1.0: Multi Selection 최적화
    🔴 v2.2.0: N+1 Query 제거 - Batch CTE Query로 변경 (Part 8.8)
               - Before: Loop 내 234회 쿼리 (117개 × 2)
               - After: CTE 1회 쿼리
               - 성능 개선: 99.6% 쿼리 감소
    
    Args:
        conn: DB Connection
        equipment_ids: Equipment ID 목록
        lot_start_times: {equipment_id: lot_start_time} 딕셔너리
    
    Returns:
        {equipment_id: {'production_count': int, 'tact_time_seconds': float}}
    """
    if not equipment_ids:
        return {}
    
    cursor = None
    try:
        cursor = conn.cursor()
        
        # Equipment ID 목록 문자열 생성
        ids_str = ','.join(str(id) for id in equipment_ids)
        
        # ═══════════════════════════════════════════════════════════════════
        # 🔴 v2.2.0: Batch CTE Query - N+1 Query 제거 (Part 8.8)
        # ═══════════════════════════════════════════════════════════════════
        
        query = f"""
        WITH 
        -- CTE 1: Active Lot 시작 시간 (IsStart=1인 최신 레코드)
        ActiveLotStart AS (
            SELECT 
                EquipmentId,
                OccurredAtUtc AS LotStartTime,
                ROW_NUMBER() OVER (
                    PARTITION BY EquipmentId 
                    ORDER BY OccurredAtUtc DESC
                ) AS rn
            FROM log.Lotinfo WITH (NOLOCK)
            WHERE EquipmentId IN ({ids_str})
              AND IsStart = 1
        ),
        
        -- CTE 2: Production Count (Lot 시작 이후 CycleTime COUNT)
        ProductionCounts AS (
            SELECT 
                ct.EquipmentId,
                COUNT(*) AS production_count
            FROM log.CycleTime ct WITH (NOLOCK)
            INNER JOIN ActiveLotStart als 
                ON ct.EquipmentId = als.EquipmentId 
                AND als.rn = 1
                AND ct.Time >= als.LotStartTime
            WHERE ct.EquipmentId IN ({ids_str})
            GROUP BY ct.EquipmentId
        ),
        
        -- CTE 3: Tact Time (최근 2개 CycleTime 간격)
        CycleTimeRanked AS (
            SELECT 
                EquipmentId,
                Time,
                LAG(Time) OVER (
                    PARTITION BY EquipmentId 
                    ORDER BY Time DESC
                ) AS PrevTime,
                ROW_NUMBER() OVER (
                    PARTITION BY EquipmentId 
                    ORDER BY Time DESC
                ) AS rn
            FROM log.CycleTime WITH (NOLOCK)
            WHERE EquipmentId IN ({ids_str})
        ),
        TactTimes AS (
            SELECT 
                EquipmentId,
                DATEDIFF(SECOND, PrevTime, Time) AS tact_seconds
            FROM CycleTimeRanked
            WHERE rn = 1 AND PrevTime IS NOT NULL
        )
        
        -- 최종 결과
        SELECT 
            e.EquipmentId,
            COALESCE(pc.production_count, 0) AS production_count,
            tt.tact_seconds
        FROM core.Equipment e WITH (NOLOCK)
        LEFT JOIN ProductionCounts pc ON e.EquipmentId = pc.EquipmentId
        LEFT JOIN TactTimes tt ON e.EquipmentId = tt.EquipmentId
        WHERE e.EquipmentId IN ({ids_str})
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # 결과를 Dictionary로 변환
        result = {}
        for row in rows:
            eq_id = row[0]
            prod_count = int(row[1]) if row[1] is not None and row[1] > 0 else None
            tact_time = float(row[2]) if row[2] is not None else None
            
            result[eq_id] = {
                'production_count': prod_count,
                'tact_time_seconds': tact_time
            }
        
        # 결과에 없는 equipment_id는 None으로 채우기 (호환성)
        for eq_id in equipment_ids:
            if eq_id not in result:
                result[eq_id] = {
                    'production_count': None,
                    'tact_time_seconds': None
                }
        
        logger.debug(f"✅ Batch query completed: {len(result)} equipments processed in 1 query")
        
        return result
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch production/tact batch: {e}")
        # 🔴 Fallback: 에러 시 빈 결과 반환 (기존 동작 호환)
        return {eq_id: {'production_count': None, 'tact_time_seconds': None} for eq_id in equipment_ids}
    finally:
        if cursor:
            cursor.close()