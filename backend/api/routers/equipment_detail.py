"""
Equipment Detail API Router
설비 상세 정보 패널용 API 엔드포인트

API Endpoints:
- GET  /api/equipment/detail/{frontend_id} : 단일 설비 상세 정보
- POST /api/equipment/detail/multi        : 다중 설비 상세 정보 (집계)

@version 2.2.0
@changelog
- v2.2.0: 🔴 CRITICAL Performance 최적화 (Coding Guidelines Part 8 준수)
          - 모든 SQL SELECT 쿼리에 WITH (NOLOCK) 추가 (Part 8.2.1)
            - fetch_equipment_detail_raw(): 5개 테이블 NOLOCK 적용
            - fetch_multi_equipment_detail_raw(): 5개 테이블 NOLOCK 적용
            - fetch_production_count(): log.CycleTime NOLOCK 적용
            - fetch_tact_time(): log.CycleTime NOLOCK 적용
          - N+1 Query 제거 - Batch CTE Query로 변경 (Part 8.8)
            - fetch_production_and_tact_batch(): Loop 234회 → CTE 1회 쿼리
            - 117개 설비 선택 시 99.6% 쿼리 감소 (234 → 1)
          - ⚠️ 호환성: 기존 모든 필드/로직/API 100% 유지
- v2.1.0: Production Count & Tact Time 추가
          - SQL 쿼리에 log.CycleTime 조회 추가 (별도 쿼리로 분리하여 성능 최적화)
          - Single Selection: production_count, tact_time_seconds 추가
          - Multi Selection: production_total (SUM), tact_time_avg (AVG) 추가
          - is_lot_active=True일 때만 Production 표시 (Lot 시작 시점 기준)
          - ⚠️ 호환성: 기존 모든 필드/로직 100% 유지
- v2.0.0: PC Info Tab 확장 - Memory, Disk 필드 추가
          - SQL 쿼리에 MemoryTotalMb, MemoryUsedMb, DisksTotalGb, DisksUsedGb, DisksTotalGb2, DisksUsedGb2 추가
          - Memory MB → GB 변환 (/ 1024)
          - Multi Selection: avg_memory_usage_percent, avg_disk_c/d_usage_percent 추가
          - Disk D: NULL인 설비는 평균 계산에서 제외
          - ⚠️ 호환성: 기존 모든 필드/로직 100% 유지
- v1.5.0: Lot Active/Inactive 분기 지원
          - SQL 쿼리에서 WHERE IsStart=1 조건 제거
          - IsStart 값을 SELECT하여 is_lot_active 계산
          - IsStart=1: lot_start_time 사용 (Lot Duration)
          - IsStart=0: since_time 사용 (Duration)
          - Lot 레코드 없으면 is_lot_active=False, since_time=None
- v1.4.0: General Tab 확장 + PC Info Tab 구현
- v1.3.1: MSSQL 플레이스홀더 수정 (? → %s, %d)
- v1.3.0: Development 모드 호환 - get_connection() 사용
- v1.2.0: Multi Selection에 equipment_ids 파라미터 추가
- v1.1.0: equipment_id 쿼리 파라미터 추가
- v1.0.0: 초기 버전

작성일: 2026-01-06
수정일: 2026-02-01
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict
from datetime import datetime
import logging

# ✅ v1.3.0: database 모듈에서 connection_manager만 import
from ..database import connection_manager
from ..models.equipment_detail import (
    EquipmentDetailResponse,
    MultiEquipmentDetailRequest,
    MultiEquipmentDetailResponse
)
from ..utils.errors import (
    handle_errors,
    DatabaseError
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/equipment/detail",
    tags=["Equipment Detail"]
)


# ============================================================================
# ✅ v1.3.0: 활성 연결 가져오기 헬퍼 (Monitoring과 동일 방식)
# ============================================================================

def get_active_site_connection():
    """
    현재 활성화된 사이트의 DB 연결 가져오기
    
    Returns:
        tuple: (connection, site_id)
    
    Raises:
        HTTPException: 활성 연결이 없거나 연결 실패 시
    """
    try:
        logger.info("📡 Attempting to get active database connection...")
        
        # 활성 연결 확인
        active_sites = connection_manager.get_active_connections()
        
        logger.debug(f"Active sites: {active_sites}")
        
        # 활성 연결이 없으면 에러
        if not active_sites or len(active_sites) == 0:
            logger.warning("⚠️ No active database connections found")
            raise HTTPException(
                status_code=400,
                detail="No active database connection. Please connect to a site first."
            )
        
        # 첫 번째 활성 사이트 사용
        site_id = active_sites[0]
        
        logger.info(f"Using site: {site_id}")
        
        # 활성 연결 정보 조회 (DB 이름 가져오기)
        conn_info = connection_manager.get_active_connection_info(site_id)
        db_name = conn_info.get('db_name', 'SherlockSky') if conn_info else 'SherlockSky'
        
        logger.info(f"📌 Requesting connection: {site_id}/{db_name}")
        
        # 연결 가져오기
        conn = connection_manager.get_connection(site_id, db_name)
        
        if not conn:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get connection for {site_id}/{db_name}"
            )
        
        logger.info(f"✅ Database connection acquired: {site_id}/{db_name}")
        
        return conn, site_id
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get database connection: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to database: {str(e)}"
        )


# ============================================================================
# 🆕 v2.1.0: Production Count & Tact Time 조회 헬퍼 함수
# 🔴 v2.2.0: WITH (NOLOCK) 추가 (Coding Guidelines Part 8.2.1)
# ============================================================================

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


def fetch_production_and_tact_batch(conn, equipment_ids: List[int], lot_start_times: Dict[int, datetime]) -> Dict[int, Dict]:
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
        # 
        # 기존 방식 (v2.1.0): Loop 내 개별 쿼리
        #   for eq_id in equipment_ids:
        #       fetch_production_count(...)  # Query 1
        #       fetch_tact_time(...)         # Query 2
        #   → 117개 설비 = 234회 쿼리!
        #
        # 새 방식 (v2.2.0): CTE Batch Query
        #   → 117개 설비 = 1회 쿼리!
        # ═══════════════════════════════════════════════════════════════════
        
        query = f"""
        WITH 
        -- ═══════════════════════════════════════════════════════════════════
        -- CTE 1: Active Lot 시작 시간 (IsStart=1인 최신 레코드)
        -- ═══════════════════════════════════════════════════════════════════
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
        
        -- ═══════════════════════════════════════════════════════════════════
        -- CTE 2: Production Count (Lot 시작 이후 CycleTime COUNT)
        -- ═══════════════════════════════════════════════════════════════════
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
        
        -- ═══════════════════════════════════════════════════════════════════
        -- CTE 3: Tact Time (최근 2개 CycleTime 간격)
        -- ROW_NUMBER + LAG 조합으로 최신 2개 간격 계산
        -- ═══════════════════════════════════════════════════════════════════
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
        
        -- ═══════════════════════════════════════════════════════════════════
        -- 최종 결과: 모든 설비에 대해 Production Count + Tact Time JOIN
        -- ═══════════════════════════════════════════════════════════════════
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


# ============================================================================
# ✅ v2.0.0: Raw SQL 쿼리 함수 (cursor 기반) - Memory, Disk 추가
# 🔴 v2.2.0: WITH (NOLOCK) 전체 적용 (Coding Guidelines Part 8.2.1)
# ============================================================================

def fetch_equipment_detail_raw(conn, equipment_id: int) -> Optional[Dict]:
    """
    단일 설비 상세 정보 조회 (raw cursor)
    
    🆕 v2.1.0: Production Count & Tact Time은 별도 함수로 조회 (성능 최적화)
    
    🆕 v2.0.0: Memory, Disk 필드 추가
    - MemoryTotalMb, MemoryUsedMb → memory_total_gb, memory_used_gb (MB→GB 변환)
    - DisksTotalGb, DisksUsedGb → disk_c_total_gb, disk_c_used_gb
    - DisksTotalGb2, DisksUsedGb2 → disk_d_total_gb, disk_d_used_gb (NULL 가능)
    
    🆕 v1.5.0: Lot Active/Inactive 분기 지원
    - WHERE IsStart=1 조건 제거
    - 최신 Lotinfo 레코드의 IsStart 값으로 분기
    
    🔴 v2.2.0: WITH (NOLOCK) 전체 적용
    - core.Equipment WITH (NOLOCK)
    - log.EquipmentState WITH (NOLOCK)
    - log.Lotinfo WITH (NOLOCK)
    - core.EquipmentPCInfo WITH (NOLOCK)
    - log.EquipmentPCInfo WITH (NOLOCK)
    
    SELECT 컬럼 인덱스 (v2.0.0):
    - 0: EquipmentId
    - 1: EquipmentName
    - 2: LineName
    - 3: Status
    - 4: StatusOccurredAt
    - 5: ProductModel
    - 6: LotId
    - 7: LotOccurredAt
    - 8: IsStart
    - 9: CPUName
    - 10: CPULogicalCount
    - 11: GPUName
    - 12: OSName
    - 13: OSArchitecture
    - 14: LastBootTime
    - 15: PCLastUpdateTime
    - 16: CPUUsagePercent
    - 17: MemoryTotalMb (🆕)
    - 18: MemoryUsedMb (🆕)
    - 19: DisksTotalGb - Disk C (🆕)
    - 20: DisksUsedGb - Disk C (🆕)
    - 21: DisksTotalGb2 - Disk D (🆕)
    - 22: DisksUsedGb2 - Disk D (🆕)
    
    Args:
        conn: DB Connection
        equipment_id: Equipment ID
    
    Returns:
        dict or None
    """
    cursor = None
    try:
        cursor = conn.cursor()
        
        # 🔴 v2.2.0: 모든 테이블에 WITH (NOLOCK) 추가
        query = """
            SELECT 
                -- 기본 정보 (core.Equipment)
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                
                -- 상태 정보 (log.EquipmentState) - 최신 1개
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                
                -- 🆕 v1.5.0: Lot 정보 (log.Lotinfo) - 최신 1개 (IsStart 조건 없음)
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt,
                li.IsStart,
                
                -- PC 고정 정보 (core.EquipmentPCInfo) - 1:1 관계
                pc.CPUName,
                pc.CPULogicalCount,
                pc.GPUName,
                pc.OS AS OSName,
                pc.Architecture AS OSArchitecture,
                pc.LastBootTime,
                pc.UpdateAtUtc AS PCLastUpdateTime,
                
                -- PC 실시간 정보 (log.EquipmentPCInfo) - 최신 1개
                pcLog.CPUUsagePercent,
                pcLog.MemoryTotalMb,
                pcLog.MemoryUsedMb,
                pcLog.DisksTotalGb,
                pcLog.DisksUsedGb,
                pcLog.DisksTotalGb2,
                pcLog.DisksUsedGb2
                
            FROM core.Equipment e WITH (NOLOCK)
            
            -- 🔴 v2.2.0: log.EquipmentState WITH (NOLOCK)
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    Status, 
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentState WITH (NOLOCK)
            ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
            
            -- 🔴 v2.2.0: log.Lotinfo WITH (NOLOCK)
            -- 🆕 v1.5.0: log.Lotinfo JOIN (최신 1개, IsStart 조건 제거)
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    ProductModel, 
                    LotId,
                    OccurredAtUtc,
                    IsStart,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.Lotinfo WITH (NOLOCK)
                -- WHERE IsStart = 1  ← 🆕 v1.5.0: 이 조건 제거
            ) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
            
            -- 🔴 v2.2.0: core.EquipmentPCInfo WITH (NOLOCK)
            LEFT JOIN core.EquipmentPCInfo pc WITH (NOLOCK)
                ON e.EquipmentId = pc.EquipmentId
            
            -- 🔴 v2.2.0: log.EquipmentPCInfo WITH (NOLOCK)
            -- 🆕 v2.0.0: log.EquipmentPCInfo JOIN (최신 1개) - Memory, Disk 추가
            LEFT JOIN (
                SELECT 
                    EquipmentId,
                    CPUUsagePercent,
                    MemoryTotalMb,
                    MemoryUsedMb,
                    DisksTotalGb,
                    DisksUsedGb,
                    DisksTotalGb2,
                    DisksUsedGb2,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentPCInfo WITH (NOLOCK)
            ) pcLog ON e.EquipmentId = pcLog.EquipmentId AND pcLog.rn = 1
            
            WHERE e.EquipmentId = %d
        """
        
        cursor.execute(query, (equipment_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # 🆕 v1.5.0: IsStart 값으로 Lot Active/Inactive 분기
        is_start_value = row[8]  # IsStart 컬럼 (0 또는 1 또는 None)
        lot_occurred_at = row[7]  # LotOccurredAt
        
        # is_lot_active 계산
        # - IsStart=1 → Lot 진행 중 (Active)
        # - IsStart=0 → Lot 종료됨 (Inactive)
        # - None → Lot 레코드 없음 (Inactive)
        is_lot_active = (is_start_value == 1) if is_start_value is not None else False
        
        # lot_start_time / since_time 분기
        lot_start_time = None
        since_time = None
        
        if is_lot_active:
            # Lot Active: lot_start_time 사용
            lot_start_time = lot_occurred_at
        else:
            # Lot Inactive: since_time 사용 (Lot 종료 시점)
            since_time = lot_occurred_at  # None일 수 있음 (Lot 레코드 없는 경우)
        
        # 🆕 v2.0.0: Memory MB → GB 변환
        memory_total_mb = row[17]
        memory_used_mb = row[18]
        memory_total_gb = round(float(memory_total_mb) / 1024, 2) if memory_total_mb is not None else None
        memory_used_gb = round(float(memory_used_mb) / 1024, 2) if memory_used_mb is not None else None
        
        # 🆕 v2.0.0: Disk C (GB 그대로)
        disk_c_total_gb = float(row[19]) if row[19] is not None else None
        disk_c_used_gb = float(row[20]) if row[20] is not None else None
        
        # 🆕 v2.0.0: Disk D (NULL 가능)
        disk_d_total_gb = float(row[21]) if row[21] is not None else None
        disk_d_used_gb = float(row[22]) if row[22] is not None else None
        
        # 🆕 v1.5.0: 결과를 딕셔너리로 변환
        return {
            # 기본 정보
            'equipment_id': row[0],
            'equipment_name': row[1],
            'line_name': row[2],
            
            # 상태 정보
            'status': row[3],
            'status_occurred_at': row[4],
            
            # Lot 정보 (is_lot_active에 따라 다르게 처리)
            'product_model': row[5] if is_lot_active else None,  # Inactive면 표시 안함
            'lot_id': row[6] if is_lot_active else None,  # Inactive면 표시 안함
            'lot_occurred_at': row[7],  # 원본 값 (참고용)
            
            # 🆕 v1.5.0: Lot Active/Inactive 분기 필드
            'is_lot_active': is_lot_active,
            'lot_start_time': lot_start_time,  # Lot Active 시
            'since_time': since_time,  # Lot Inactive 시
            
            # PC 고정 정보
            'cpu_name': row[9],
            'cpu_logical_count': row[10],
            'gpu_name': row[11],
            'os_name': row[12],
            'os_architecture': row[13],
            'last_boot_time': row[14],
            'pc_last_update_time': row[15],
            
            # PC 실시간 정보
            'cpu_usage_percent': float(row[16]) if row[16] is not None else None,
            
            # 🆕 v2.0.0: Memory, Disk
            'memory_total_gb': memory_total_gb,
            'memory_used_gb': memory_used_gb,
            'disk_c_total_gb': disk_c_total_gb,
            'disk_c_used_gb': disk_c_used_gb,
            'disk_d_total_gb': disk_d_total_gb,
            'disk_d_used_gb': disk_d_used_gb
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to fetch equipment detail: {e}")
        raise
    finally:
        if cursor:
            cursor.close()


def fetch_multi_equipment_detail_raw(conn, equipment_ids: List[int]) -> List[Dict]:
    """
    다중 설비 상세 정보 조회 (raw cursor)
    
    🆕 v2.1.0: lot_start_time 반환 추가 (Production Count 계산용)
    🆕 v2.0.0: Memory, Disk 필드 추가
    
    🆕 v1.5.0: Lot Active/Inactive 분기 지원
    - Multi Selection에서는 기존 집계 방식 유지
    - is_lot_active 필드는 개별 조회에만 사용
    
    🔴 v2.2.0: WITH (NOLOCK) 전체 적용
    - core.Equipment WITH (NOLOCK)
    - log.EquipmentState WITH (NOLOCK)
    - log.Lotinfo WITH (NOLOCK)
    - core.EquipmentPCInfo WITH (NOLOCK)
    - log.EquipmentPCInfo WITH (NOLOCK)
    
    SELECT 컬럼 인덱스 (v2.1.0):
    - 0: EquipmentId
    - 1: EquipmentName
    - 2: LineName
    - 3: Status
    - 4: StatusOccurredAt
    - 5: ProductModel
    - 6: LotId
    - 7: LotOccurredAt  ← 🆕 v2.1.0: lot_start_time으로 사용
    - 8: CPUName
    - 9: CPULogicalCount
    - 10: GPUName
    - 11: OSName
    - 12: OSArchitecture
    - 13: LastBootTime
    - 14: PCLastUpdateTime
    - 15: CPUUsagePercent
    - 16: MemoryTotalMb (🆕)
    - 17: MemoryUsedMb (🆕)
    - 18: DisksTotalGb - Disk C (🆕)
    - 19: DisksUsedGb - Disk C (🆕)
    - 20: DisksTotalGb2 - Disk D (🆕)
    - 21: DisksUsedGb2 - Disk D (🆕)
    
    Args:
        conn: DB Connection
        equipment_ids: Equipment ID 목록
    
    Returns:
        List[dict]
    """
    if not equipment_ids:
        return []
    
    cursor = None
    try:
        cursor = conn.cursor()
        
        # IN 절 플레이스홀더 생성 (MSSQL은 %d 사용)
        placeholders = ", ".join(["%d" for _ in equipment_ids])
        
        # 🔴 v2.2.0: 모든 테이블에 WITH (NOLOCK) 추가
        # 🆕 v1.5.0: Multi Selection은 기존 방식 유지 (IsStart=1만 조회)
        # 집계에서는 Active Lot 정보만 표시하는 것이 더 유의미함
        # 🆕 v2.0.0: Memory, Disk 컬럼 추가
        query = f"""
            SELECT 
                -- 기본 정보 (core.Equipment)
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                
                -- 상태 정보 (log.EquipmentState) - 최신 1개
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                
                -- Lot 정보 (log.Lotinfo) - IsStart=1인 최신 1개
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt,
                
                -- PC 고정 정보 (core.EquipmentPCInfo)
                pc.CPUName,
                pc.CPULogicalCount,
                pc.GPUName,
                pc.OS AS OSName,
                pc.Architecture AS OSArchitecture,
                pc.LastBootTime,
                pc.UpdateAtUtc AS PCLastUpdateTime,
                
                -- PC 실시간 정보 (log.EquipmentPCInfo) - 최신 1개
                pcLog.CPUUsagePercent,
                pcLog.MemoryTotalMb,
                pcLog.MemoryUsedMb,
                pcLog.DisksTotalGb,
                pcLog.DisksUsedGb,
                pcLog.DisksTotalGb2,
                pcLog.DisksUsedGb2
                
            FROM core.Equipment e WITH (NOLOCK)
            
            -- 🔴 v2.2.0: log.EquipmentState WITH (NOLOCK)
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    Status, 
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentState WITH (NOLOCK)
            ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
            
            -- 🔴 v2.2.0: log.Lotinfo WITH (NOLOCK)
            -- log.Lotinfo JOIN (IsStart=1인 최신 1개) - Multi Selection은 기존 방식 유지
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    ProductModel, 
                    LotId,
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.Lotinfo WITH (NOLOCK)
                WHERE IsStart = 1
            ) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
            
            -- 🔴 v2.2.0: core.EquipmentPCInfo WITH (NOLOCK)
            LEFT JOIN core.EquipmentPCInfo pc WITH (NOLOCK)
                ON e.EquipmentId = pc.EquipmentId
            
            -- 🔴 v2.2.0: log.EquipmentPCInfo WITH (NOLOCK)
            -- 🆕 v2.0.0: log.EquipmentPCInfo JOIN (최신 1개) - Memory, Disk 추가
            LEFT JOIN (
                SELECT 
                    EquipmentId,
                    CPUUsagePercent,
                    MemoryTotalMb,
                    MemoryUsedMb,
                    DisksTotalGb,
                    DisksUsedGb,
                    DisksTotalGb2,
                    DisksUsedGb2,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentPCInfo WITH (NOLOCK)
            ) pcLog ON e.EquipmentId = pcLog.EquipmentId AND pcLog.rn = 1
            
            WHERE e.EquipmentId IN ({placeholders})
        """
        
        cursor.execute(query, tuple(equipment_ids))
        rows = cursor.fetchall()
        
        # 결과를 딕셔너리 리스트로 변환
        result = []
        for row in rows:
            # 🆕 v2.0.0: Memory MB → GB 변환
            memory_total_mb = row[16]
            memory_used_mb = row[17]
            memory_total_gb = round(float(memory_total_mb) / 1024, 2) if memory_total_mb is not None else None
            memory_used_gb = round(float(memory_used_mb) / 1024, 2) if memory_used_mb is not None else None
            
            result.append({
                # 기본 정보
                'equipment_id': row[0],
                'equipment_name': row[1],
                'line_name': row[2],
                
                # 상태 정보
                'status': row[3],
                'status_occurred_at': row[4],
                
                # Lot 정보
                'product_model': row[5],
                'lot_id': row[6],
                'lot_occurred_at': row[7],  # 🆕 v2.1.0: lot_start_time으로 사용
                
                # PC 고정 정보
                'cpu_name': row[8],
                'cpu_logical_count': row[9],
                'gpu_name': row[10],
                'os_name': row[11],
                'os_architecture': row[12],
                'last_boot_time': row[13],
                'pc_last_update_time': row[14],
                
                # PC 실시간 정보
                'cpu_usage_percent': float(row[15]) if row[15] is not None else None,
                
                # 🆕 v2.0.0: Memory, Disk
                'memory_total_gb': memory_total_gb,
                'memory_used_gb': memory_used_gb,
                'disk_c_total_gb': float(row[18]) if row[18] is not None else None,
                'disk_c_used_gb': float(row[19]) if row[19] is not None else None,
                'disk_d_total_gb': float(row[20]) if row[20] is not None else None,
                'disk_d_used_gb': float(row[21]) if row[21] is not None else None
            })
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Failed to fetch multi equipment detail: {e}")
        raise
    finally:
        if cursor:
            cursor.close()


# ============================================================================
# API Endpoints
# ============================================================================

# ⚠️ 중요: 구체적인 경로를 path parameter보다 먼저 정의해야 함!

# ============================================================================
# Health Check (먼저 정의!)
# ============================================================================

@router.get(
    "/health",
    summary="Equipment Detail API 헬스체크"
)
async def health_check():
    """Equipment Detail API 헬스체크"""
    return {
        "status": "ok",
        "service": "equipment-detail",
        "version": "2.2.0",  # 🔴 v2.2.0 업데이트
        "timestamp": datetime.now().isoformat(),
        "features": {
            "general_tab": True,
            "pc_info_tab": True,
            "lot_start_time": True,
            "cpu_usage_gauge": True,
            # v1.5.0
            "lot_active_inactive": True,
            "since_time": True,
            # v2.0.0
            "memory_gauge": True,
            "disk_c_gauge": True,
            "disk_d_gauge": True,
            # v2.1.0
            "production_count": True,
            "tact_time": True,
            # v2.2.0
            "nolock_optimized": True,
            "batch_query_optimized": True
        }
    }


@router.get(
    "/{frontend_id}",
    response_model=EquipmentDetailResponse,
    summary="단일 설비 상세 정보 조회",
    description="Frontend ID로 설비의 Line, Status, Product, Lot, Production, Tact Time, PC Info 정보를 조회합니다. Lot Active/Inactive 분기를 지원합니다."
)
@handle_errors
async def get_equipment_detail(
    frontend_id: str,
    equipment_id: Optional[int] = Query(None, description="Equipment ID (Frontend에서 전달, 우선 사용)")
):
    """
    단일 설비 상세 정보 조회
    
    🆕 v2.1.0: Production Count & Tact Time 추가
    - production_count: Lot 시작 이후 생산 개수 (log.CycleTime COUNT)
    - tact_time_seconds: 마지막 Tact Time 초 단위 (log.CycleTime 최근 2개 간격)
    
    🆕 v2.0.0: Memory, Disk 정보 추가
    🆕 v1.5.0: Lot Active/Inactive 분기 지원
    - is_lot_active=True: Product, Lot No, Lot Start, Lot Duration, Production, Tact Time 표시
    - is_lot_active=False: Product="-", Lot No="-", Since, Duration 표시
    
    🔴 v2.2.0: WITH (NOLOCK) 적용으로 Factory DB 안정성 향상
    
    - **frontend_id**: Frontend ID (예: EQ-17-03)
    - **equipment_id**: Equipment ID (옵션, Frontend에서 전달 시 우선 사용)
    
    Returns:
        설비 상세 정보 (Lot Active/Inactive 분기, Production, Tact Time, PC Info 포함, Memory/Disk 포함)
    """
    logger.info(f"📡 GET /equipment/detail/{frontend_id}" + 
                (f"?equipment_id={equipment_id}" if equipment_id else ""))
    
    # equipment_id가 없으면 빈 응답
    if equipment_id is None:
        logger.warning(f"⚠️ No equipment_id provided for: {frontend_id}")
        return EquipmentDetailResponse(
            frontend_id=frontend_id,
            equipment_id=None,
            equipment_name=None,
            line_name=None,
            status=None,
            product_model=None,
            lot_id=None,
            last_updated=None,
            # 🆕 v1.5.0: Lot Active/Inactive
            is_lot_active=False,
            lot_start_time=None,
            since_time=None,
            # 🆕 v2.1.0: Production & Tact Time
            production_count=None,
            tact_time_seconds=None,
            # PC Info
            cpu_name=None,
            cpu_logical_count=None,
            gpu_name=None,
            os_name=None,
            os_architecture=None,
            last_boot_time=None,
            pc_last_update_time=None,
            cpu_usage_percent=None,
            # 🆕 v2.0.0: Memory, Disk
            memory_total_gb=None,
            memory_used_gb=None,
            disk_c_total_gb=None,
            disk_c_used_gb=None,
            disk_d_total_gb=None,
            disk_d_used_gb=None
        )
    
    # DB 연결
    try:
        conn, site_id = get_active_site_connection()
        
        # Raw SQL로 조회
        data = fetch_equipment_detail_raw(conn, equipment_id)
        
        if not data:
            logger.warning(f"⚠️ Equipment not found in DB: {equipment_id}")
            return EquipmentDetailResponse(
                frontend_id=frontend_id,
                equipment_id=equipment_id,
                equipment_name=None,
                line_name=None,
                status=None,
                product_model=None,
                lot_id=None,
                last_updated=None,
                # 🆕 v1.5.0: Lot Active/Inactive
                is_lot_active=False,
                lot_start_time=None,
                since_time=None,
                # 🆕 v2.1.0: Production & Tact Time
                production_count=None,
                tact_time_seconds=None,
                # PC Info
                cpu_name=None,
                cpu_logical_count=None,
                gpu_name=None,
                os_name=None,
                os_architecture=None,
                last_boot_time=None,
                pc_last_update_time=None,
                cpu_usage_percent=None,
                # 🆕 v2.0.0: Memory, Disk
                memory_total_gb=None,
                memory_used_gb=None,
                disk_c_total_gb=None,
                disk_c_used_gb=None,
                disk_d_total_gb=None,
                disk_d_used_gb=None
            )
        
        # 마지막 업데이트 시간 결정
        last_updated = None
        if data.get('status_occurred_at') and data.get('lot_occurred_at'):
            last_updated = max(data['status_occurred_at'], data['lot_occurred_at'])
        elif data.get('status_occurred_at'):
            last_updated = data['status_occurred_at']
        elif data.get('lot_occurred_at'):
            last_updated = data['lot_occurred_at']
        
        # 🆕 v2.1.0: Production Count & Tact Time 조회
        production_count = None
        tact_time_seconds = None
        
        # Lot Active일 때만 Production Count 조회
        if data['is_lot_active'] and data['lot_start_time']:
            production_count = fetch_production_count(conn, equipment_id, data['lot_start_time'])
        
        # Tact Time은 Lot Active/Inactive 상관없이 조회
        tact_time_seconds = fetch_tact_time(conn, equipment_id)
        
        # 🆕 v2.1.0: 확장된 응답 생성 (Production, Tact Time, Memory, Disk 포함)
        response = EquipmentDetailResponse(
            # 기본 정보 (기존 필드 - 호환성 유지)
            frontend_id=frontend_id,
            equipment_id=data['equipment_id'],
            equipment_name=data['equipment_name'],
            line_name=data['line_name'],
            status=data['status'],
            product_model=data['product_model'],  # Inactive면 None
            lot_id=data['lot_id'],  # Inactive면 None
            last_updated=last_updated,
            
            # 🆕 v1.5.0: Lot Active/Inactive 분기
            is_lot_active=data['is_lot_active'],
            lot_start_time=data['lot_start_time'],  # Active 시
            since_time=data['since_time'],  # Inactive 시
            
            # 🆕 v2.1.0: Production & Tact Time
            production_count=production_count,
            tact_time_seconds=tact_time_seconds,
            
            # PC Info Tab - 고정 정보
            cpu_name=data['cpu_name'],
            cpu_logical_count=data['cpu_logical_count'],
            gpu_name=data['gpu_name'],
            os_name=data['os_name'],
            os_architecture=data['os_architecture'],
            last_boot_time=data['last_boot_time'],
            pc_last_update_time=data['pc_last_update_time'],
            
            # PC Info Tab - 실시간 정보
            cpu_usage_percent=data['cpu_usage_percent'],
            
            # 🆕 v2.0.0: Memory, Disk
            memory_total_gb=data['memory_total_gb'],
            memory_used_gb=data['memory_used_gb'],
            disk_c_total_gb=data['disk_c_total_gb'],
            disk_c_used_gb=data['disk_c_used_gb'],
            disk_d_total_gb=data['disk_d_total_gb'],
            disk_d_used_gb=data['disk_d_used_gb']
        )
        
        logger.info(f"✅ Equipment detail fetched: {frontend_id} -> eq_id={equipment_id}, "
                   f"status={response.status}, is_lot_active={response.is_lot_active}, "
                   f"production={response.production_count}, tact_time={response.tact_time_seconds}s, "
                   f"cpu={response.cpu_usage_percent}%, "
                   f"memory={response.memory_used_gb}/{response.memory_total_gb}GB")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get equipment detail: {e}", exc_info=True)
        raise DatabaseError(
            message=f"설비 상세 정보 조회 실패: {str(e)}",
            details={"frontend_id": frontend_id, "equipment_id": equipment_id}
        )


@router.post(
    "/multi",
    response_model=MultiEquipmentDetailResponse,
    summary="다중 설비 상세 정보 조회 (집계)",
    description="여러 설비의 Line, Status, Product, Lot, Production, Tact Time, PC Info 정보를 집계하여 조회합니다."
)
@handle_errors
async def get_multi_equipment_detail(
    request: MultiEquipmentDetailRequest
):
    """
    다중 설비 상세 정보 조회 (집계)
    
    🆕 v2.1.0: Production 합계 & Tact Time 평균 추가
    - production_total: 전체 Production 합계 (Active Lot만)
    - tact_time_avg: 평균 Tact Time (초)
    
    🆕 v2.0.0: Memory, Disk 평균 추가
    - avg_memory_usage_percent: 평균 Memory 사용율 %
    - avg_disk_c_usage_percent: 평균 Disk C 사용율 %
    - avg_disk_d_usage_percent: 평균 Disk D 사용율 % (NULL 설비 제외)
    
    🔴 v2.2.0: N+1 Query 제거로 99.6% 쿼리 감소 (117개: 234 → 1)
    
    기존 집계 방식 유지 (Lot Active/Inactive 개수 집계는 추가하지 않음)
    
    - **frontend_ids**: Frontend ID 목록 (최대 100개)
    - **equipment_ids**: Equipment ID 목록 (Frontend에서 전달)
    
    Returns:
        집계된 설비 정보 (Production 합계, Tact Time 평균, PC Info 포함, Memory/Disk 평균 포함)
    """
    logger.info(f"📡 POST /equipment/detail/multi - {len(request.frontend_ids)} frontend_ids" +
                (f", {len(request.equipment_ids)} equipment_ids" if request.equipment_ids else ""))
    
    # equipment_ids가 없으면 빈 응답
    if not request.equipment_ids or len(request.equipment_ids) == 0:
        logger.warning("⚠️ No equipment_ids provided")
        return MultiEquipmentDetailResponse(
            count=len(request.frontend_ids),
            lines=[],
            lines_more=False,
            status_counts={},
            products=[],
            products_more=False,
            lot_ids=[],
            lot_ids_more=False,
            # 🆕 v2.1.0: Production & Tact Time
            production_total=None,
            tact_time_avg=None,
            # PC Info 집계
            avg_cpu_usage_percent=None,
            # 🆕 v2.0.0: Memory, Disk 평균
            avg_memory_usage_percent=None,
            avg_disk_c_usage_percent=None,
            avg_disk_d_usage_percent=None,
            # 기존 필드
            cpu_names=[],
            cpu_names_more=False,
            gpu_names=[],
            gpu_names_more=False,
            os_names=[],
            os_names_more=False
        )
    
    # DB 연결
    try:
        conn, site_id = get_active_site_connection()
        
        # Raw SQL로 조회
        data_list = fetch_multi_equipment_detail_raw(conn, request.equipment_ids)
        
        # 집계 (기존 필드)
        lines_set = set()
        status_counter: Dict[str, int] = {}
        products_set = set()
        lot_ids_set = set()
        
        # PC Info 집계
        cpu_names_set = set()
        gpu_names_set = set()
        os_names_set = set()
        cpu_usage_values: List[float] = []
        
        # 🆕 v2.1.0: Production & Tact Time 집계용
        lot_start_times: Dict[int, datetime] = {}  # {equipment_id: lot_start_time}
        
        # 🆕 v2.0.0: Memory, Disk 집계용 리스트
        memory_usage_values: List[float] = []  # 사용율 %
        disk_c_usage_values: List[float] = []  # 사용율 %
        disk_d_usage_values: List[float] = []  # 사용율 % (NULL 제외)
        
        for data in data_list:
            # Line 수집
            if data.get('line_name'):
                lines_set.add(data['line_name'])
            
            # Status 카운트
            if data.get('status'):
                status = data['status']
                status_counter[status] = status_counter.get(status, 0) + 1
            
            # Product 수집
            if data.get('product_model'):
                products_set.add(data['product_model'])
            
            # Lot ID 수집
            if data.get('lot_id'):
                lot_ids_set.add(data['lot_id'])
            
            # 🆕 v2.1.0: lot_start_time 수집 (Production Count 계산용)
            if data.get('lot_occurred_at'):
                lot_start_times[data['equipment_id']] = data['lot_occurred_at']
            
            # PC Info 수집
            if data.get('cpu_name'):
                cpu_names_set.add(data['cpu_name'])
            
            if data.get('gpu_name'):
                gpu_names_set.add(data['gpu_name'])
            
            if data.get('os_name'):
                os_names_set.add(data['os_name'])
            
            if data.get('cpu_usage_percent') is not None:
                cpu_usage_values.append(data['cpu_usage_percent'])
            
            # 🆕 v2.0.0: Memory 사용율 % 계산
            if data.get('memory_total_gb') and data.get('memory_used_gb') and data['memory_total_gb'] > 0:
                memory_percent = (data['memory_used_gb'] / data['memory_total_gb']) * 100
                memory_usage_values.append(memory_percent)
            
            # 🆕 v2.0.0: Disk C 사용율 % 계산
            if data.get('disk_c_total_gb') and data.get('disk_c_used_gb') and data['disk_c_total_gb'] > 0:
                disk_c_percent = (data['disk_c_used_gb'] / data['disk_c_total_gb']) * 100
                disk_c_usage_values.append(disk_c_percent)
            
            # 🆕 v2.0.0: Disk D 사용율 % 계산 (NULL 제외)
            if data.get('disk_d_total_gb') and data.get('disk_d_used_gb') and data['disk_d_total_gb'] > 0:
                disk_d_percent = (data['disk_d_used_gb'] / data['disk_d_total_gb']) * 100
                disk_d_usage_values.append(disk_d_percent)
        
        # 🔴 v2.2.0: Batch Query로 Production & Tact Time 일괄 조회 (N+1 제거)
        prod_tact_data = fetch_production_and_tact_batch(conn, request.equipment_ids, lot_start_times)
        
        # Production 합계 & Tact Time 평균 계산
        production_total = 0
        tact_time_values: List[float] = []
        
        for eq_id, pt_data in prod_tact_data.items():
            if pt_data.get('production_count') is not None:
                production_total += pt_data['production_count']
            
            if pt_data.get('tact_time_seconds') is not None:
                tact_time_values.append(pt_data['tact_time_seconds'])
        
        # Production 합계 (0이면 None)
        production_total = production_total if production_total > 0 else None
        
        # Tact Time 평균
        tact_time_avg = None
        if tact_time_values:
            tact_time_avg = round(sum(tact_time_values) / len(tact_time_values), 1)
        
        # 최대 3개 제한
        MAX_DISPLAY = 3
        lines = sorted(list(lines_set))
        products = sorted(list(products_set))
        lot_ids = sorted(list(lot_ids_set))
        
        # PC Info 정렬
        cpu_names = sorted(list(cpu_names_set))
        gpu_names = sorted(list(gpu_names_set))
        os_names = sorted(list(os_names_set))
        
        # CPU 사용율 평균 계산
        avg_cpu_usage = None
        if cpu_usage_values:
            avg_cpu_usage = round(sum(cpu_usage_values) / len(cpu_usage_values), 1)
        
        # 🆕 v2.0.0: Memory 사용율 평균 계산
        avg_memory_usage = None
        if memory_usage_values:
            avg_memory_usage = round(sum(memory_usage_values) / len(memory_usage_values), 1)
        
        # 🆕 v2.0.0: Disk C 사용율 평균 계산
        avg_disk_c_usage = None
        if disk_c_usage_values:
            avg_disk_c_usage = round(sum(disk_c_usage_values) / len(disk_c_usage_values), 1)
        
        # 🆕 v2.0.0: Disk D 사용율 평균 계산 (NULL 설비는 이미 제외됨)
        avg_disk_d_usage = None
        if disk_d_usage_values:
            avg_disk_d_usage = round(sum(disk_d_usage_values) / len(disk_d_usage_values), 1)
        
        # 응답 생성
        response = MultiEquipmentDetailResponse(
            count=len(request.frontend_ids),
            
            # 기존 필드 (호환성 유지)
            lines=lines[:MAX_DISPLAY],
            lines_more=len(lines) > MAX_DISPLAY,
            status_counts=status_counter,
            products=products[:MAX_DISPLAY],
            products_more=len(products) > MAX_DISPLAY,
            lot_ids=lot_ids[:MAX_DISPLAY],
            lot_ids_more=len(lot_ids) > MAX_DISPLAY,
            
            # 🆕 v2.1.0: Production & Tact Time
            production_total=production_total,
            tact_time_avg=tact_time_avg,
            
            # PC Info 집계
            avg_cpu_usage_percent=avg_cpu_usage,
            
            # 🆕 v2.0.0: Memory, Disk 평균
            avg_memory_usage_percent=avg_memory_usage,
            avg_disk_c_usage_percent=avg_disk_c_usage,
            avg_disk_d_usage_percent=avg_disk_d_usage,
            
            # 기존 필드 (호환성 유지)
            cpu_names=cpu_names[:MAX_DISPLAY],
            cpu_names_more=len(cpu_names) > MAX_DISPLAY,
            gpu_names=gpu_names[:MAX_DISPLAY],
            gpu_names_more=len(gpu_names) > MAX_DISPLAY,
            os_names=os_names[:MAX_DISPLAY],
            os_names_more=len(os_names) > MAX_DISPLAY
        )
        
        logger.info(f"✅ Multi equipment detail fetched: {response.count} items, "
                   f"lines={len(response.lines)}, status_counts={response.status_counts}, "
                   f"production_total={response.production_total}, tact_time_avg={response.tact_time_avg}s, "
                   f"avg_cpu={response.avg_cpu_usage_percent}%, "
                   f"avg_memory={response.avg_memory_usage_percent}%, "
                   f"avg_disk_c={response.avg_disk_c_usage_percent}%, "
                   f"avg_disk_d={response.avg_disk_d_usage_percent}%")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get multi equipment detail: {e}", exc_info=True)
        raise DatabaseError(
            message=f"다중 설비 상세 정보 조회 실패: {str(e)}",
            details={"count": len(request.frontend_ids)}
        )


# ============================================================================
# End of File
# ============================================================================