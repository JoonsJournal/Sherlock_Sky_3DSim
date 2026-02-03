"""
single_equipment.py
단일 설비 상세 정보 조회 쿼리

@version 1.0.0
@changelog
- v1.0.0: equipment_detail.py에서 분리
  - fetch_equipment_detail_raw()
  - ⚠️ 호환성: 기존 함수 시그니처/로직 100% 유지

작성일: 2026-02-01
"""

from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


def fetch_equipment_detail_raw(conn, equipment_id: int) -> Optional[Dict]:
    """
    단일 설비 상세 정보 조회 (raw cursor)
    
    🆕 v2.1.0: Production Count & Tact Time은 별도 함수로 조회 (성능 최적화)
    🆕 v2.0.0: Memory, Disk 필드 추가
    🆕 v1.5.0: Lot Active/Inactive 분기 지원
    🔴 v2.2.0: WITH (NOLOCK) 전체 적용
    
    SELECT 컬럼 인덱스:
    - 0: EquipmentId
    - 1: EquipmentName
    - 2: LineName
    - 3: Status
    - 4: StatusOccurredAt
    - 5: ProductModel
    - 6: LotId
    - 7: LotOccurredAt
    - 8: IsStart
    - 9-15: PC 고정 정보
    - 16-22: PC 실시간 정보 (CPU, Memory, Disk)
    
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
                
                -- Lot 정보 (log.Lotinfo) - 최신 1개
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt,
                li.IsStart,
                
                -- PC 고정 정보 (core.EquipmentPCInfo)
                pc.CPUName,
                pc.CPULogicalCount,
                pc.GPUName,
                pc.OS AS OSName,
                pc.Architecture AS OSArchitecture,
                pc.LastBootTime,
                pc.UpdateAtUtc AS PCLastUpdateTime,
                
                -- PC 실시간 정보 (log.EquipmentPCInfo)
                pcLog.CPUUsagePercent,
                pcLog.MemoryTotalMb,
                pcLog.MemoryUsedMb,
                pcLog.DisksTotalGb,
                pcLog.DisksUsedGb,
                pcLog.DisksTotalGb2,
                pcLog.DisksUsedGb2
                
            FROM core.Equipment e WITH (NOLOCK)
            
            LEFT JOIN (
                SELECT 
                    EquipmentId, Status, OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentState WITH (NOLOCK)
            ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
            
            LEFT JOIN (
                SELECT 
                    EquipmentId, ProductModel, LotId, OccurredAtUtc, IsStart,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.Lotinfo WITH (NOLOCK)
            ) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
            
            LEFT JOIN core.EquipmentPCInfo pc WITH (NOLOCK)
                ON e.EquipmentId = pc.EquipmentId
            
            LEFT JOIN (
                SELECT 
                    EquipmentId, CPUUsagePercent,
                    MemoryTotalMb, MemoryUsedMb,
                    DisksTotalGb, DisksUsedGb, DisksTotalGb2, DisksUsedGb2,
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
        
        # IsStart 값으로 Lot Active/Inactive 분기
        is_start_value = row[8]
        lot_occurred_at = row[7]
        
        is_lot_active = (is_start_value == 1) if is_start_value is not None else False
        
        # lot_start_time / since_time 분기
        lot_start_time = None
        since_time = None
        
        if is_lot_active:
            lot_start_time = lot_occurred_at
        else:
            since_time = lot_occurred_at
        
        # Memory MB → GB 변환
        memory_total_mb = row[17]
        memory_used_mb = row[18]
        memory_total_gb = round(float(memory_total_mb) / 1024, 2) if memory_total_mb is not None else None
        memory_used_gb = round(float(memory_used_mb) / 1024, 2) if memory_used_mb is not None else None
        
        # Disk C
        disk_c_total_gb = float(row[19]) if row[19] is not None else None
        disk_c_used_gb = float(row[20]) if row[20] is not None else None
        
        # Disk D (NULL 가능)
        disk_d_total_gb = float(row[21]) if row[21] is not None else None
        disk_d_used_gb = float(row[22]) if row[22] is not None else None
        
        return {
            # 기본 정보
            'equipment_id': row[0],
            'equipment_name': row[1],
            'line_name': row[2],
            
            # 상태 정보
            'status': row[3],
            'status_occurred_at': row[4],
            
            # Lot 정보
            'product_model': row[5] if is_lot_active else None,
            'lot_id': row[6] if is_lot_active else None,
            'lot_occurred_at': row[7],
            
            # Lot Active/Inactive 분기 필드
            'is_lot_active': is_lot_active,
            'lot_start_time': lot_start_time,
            'since_time': since_time,
            
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
            
            # Memory, Disk
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