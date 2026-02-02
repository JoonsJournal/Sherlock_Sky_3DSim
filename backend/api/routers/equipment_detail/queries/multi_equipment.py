"""
multi_equipment.py
다중 설비 상세 정보 조회 쿼리

@version 1.0.0
@changelog
- v1.0.0: equipment_detail.py에서 분리
  - fetch_multi_equipment_detail_raw()
  - ⚠️ 호환성: 기존 함수 시그니처/로직 100% 유지

작성일: 2026-02-01
"""

from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def fetch_multi_equipment_detail_raw(conn, equipment_ids: List[int]) -> List[Dict]:
    """
    다중 설비 상세 정보 조회 (raw cursor)
    
    🆕 v2.1.0: lot_start_time 반환 추가 (Production Count 계산용)
    🆕 v2.0.0: Memory, Disk 필드 추가
    🔴 v2.2.0: WITH (NOLOCK) 전체 적용
    
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
        
        query = f"""
            SELECT 
                -- 기본 정보
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                
                -- 상태 정보
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                
                -- Lot 정보
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt,
                
                -- PC 고정 정보
                pc.CPUName,
                pc.CPULogicalCount,
                pc.GPUName,
                pc.OS AS OSName,
                pc.Architecture AS OSArchitecture,
                pc.LastBootTime,
                pc.UpdateAtUtc AS PCLastUpdateTime,
                
                -- PC 실시간 정보
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
                    EquipmentId, ProductModel, LotId, OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.Lotinfo WITH (NOLOCK)
                WHERE IsStart = 1
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
            
            WHERE e.EquipmentId IN ({placeholders})
        """
        
        cursor.execute(query, tuple(equipment_ids))
        rows = cursor.fetchall()
        
        # 결과를 딕셔너리 리스트로 변환
        result = []
        for row in rows:
            # Memory MB → GB 변환
            memory_total_mb = row[16]
            memory_used_mb = row[17]
            memory_total_gb = round(float(memory_total_mb) / 1024, 2) if memory_total_mb is not None else None
            memory_used_gb = round(float(memory_used_mb) / 1024, 2) if memory_used_mb is not None else None
            
            result.append({
                'equipment_id': row[0],
                'equipment_name': row[1],
                'line_name': row[2],
                'status': row[3],
                'status_occurred_at': row[4],
                'product_model': row[5],
                'lot_id': row[6],
                'lot_occurred_at': row[7],
                'cpu_name': row[8],
                'cpu_logical_count': row[9],
                'gpu_name': row[10],
                'os_name': row[11],
                'os_architecture': row[12],
                'last_boot_time': row[13],
                'pc_last_update_time': row[14],
                'cpu_usage_percent': float(row[15]) if row[15] is not None else None,
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