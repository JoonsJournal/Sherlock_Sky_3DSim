/**
 * DataMerger.js
 * =============
 * WebSocket 실시간 데이터 병합 유틸리티
 * 
 * @version 1.0.0
 * @description
 * - 현재 데이터와 WebSocket 업데이트 데이터 병합
 * - 필드별 업데이트 규칙 적용
 * - 불변 필드 보호 (line_name 등)
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/utils/DataMerger.js
 * 작성일: 2026-01-09
 */

import { debugLog } from '../../../core/utils/Config.js';

/**
 * 현재 데이터와 WebSocket 업데이트 데이터 병합
 * 
 * @param {Object} currentData - 현재 표시 중인 데이터
 * @param {Object} updateData - WebSocket에서 수신한 업데이트 데이터
 * @returns {Object} 병합된 데이터
 * 
 * @description
 * 병합 규칙:
 * - status: 항상 새 값으로 업데이트
 * - line_name: 초기 값 유지 (불변)
 * - is_lot_active: 새 값이 있으면 업데이트
 * - Product/Lot 관련: 새 값이 있으면 업데이트
 * - Memory/Disk 관련: 새 값이 있으면 업데이트
 * - Timestamp: 항상 새 값으로 업데이트
 * 
 * @example
 * const merged = mergeEquipmentData(currentData, wsUpdate);
 */
export function mergeEquipmentData(currentData, updateData) {
    // 현재 데이터가 없으면 업데이트 데이터 그대로 반환
    if (!currentData) {
        return updateData;
    }
    
    // 업데이트 데이터가 없으면 현재 데이터 반환
    if (!updateData) {
        return currentData;
    }
    
    const mergedData = {
        // =====================================================================
        // 기존 데이터 복사 (기본값)
        // =====================================================================
        ...currentData,
        
        // =====================================================================
        // 항상 업데이트되는 필드
        // =====================================================================
        
        // Status는 항상 새 값으로
        status: updateData.status ?? currentData.status,
        
        // Timestamp 업데이트
        last_updated: updateData.last_updated 
            || updateData.timestamp 
            || new Date().toISOString(),
        
        // =====================================================================
        // 불변 필드 (초기 값 유지)
        // =====================================================================
        
        // LineName은 초기 값 유지
        line_name: currentData.line_name,
        
        // =====================================================================
        // 조건부 업데이트 필드 (새 값이 있으면 업데이트)
        // =====================================================================
        
        // Lot 활성 상태
        is_lot_active: updateData.is_lot_active !== undefined 
            ? updateData.is_lot_active 
            : currentData.is_lot_active,
        
        // Product/Lot 정보
        product_model: updateData.product_model !== undefined 
            ? updateData.product_model 
            : currentData.product_model,
        lot_id: updateData.lot_id !== undefined 
            ? updateData.lot_id 
            : currentData.lot_id,
        
        // 시간 정보
        lot_start_time: updateData.lot_start_time || currentData.lot_start_time,
        since_time: updateData.since_time || currentData.since_time,
        
        // 장비 이름
        equipment_name: updateData.equipment_name || currentData.equipment_name,
        
        // =====================================================================
        // CPU 정보
        // =====================================================================
        cpu_usage_percent: updateData.cpu_usage_percent !== undefined 
            ? updateData.cpu_usage_percent 
            : currentData.cpu_usage_percent,
        
        // =====================================================================
        // Memory 정보
        // =====================================================================
        memory_total_gb: updateData.memory_total_gb !== undefined
            ? updateData.memory_total_gb
            : currentData.memory_total_gb,
        memory_used_gb: updateData.memory_used_gb !== undefined
            ? updateData.memory_used_gb
            : currentData.memory_used_gb,
        
        // =====================================================================
        // Disk C 정보
        // =====================================================================
        disk_c_total_gb: updateData.disk_c_total_gb !== undefined
            ? updateData.disk_c_total_gb
            : currentData.disk_c_total_gb,
        disk_c_used_gb: updateData.disk_c_used_gb !== undefined
            ? updateData.disk_c_used_gb
            : currentData.disk_c_used_gb,
        
        // =====================================================================
        // Disk D 정보
        // =====================================================================
        disk_d_total_gb: updateData.disk_d_total_gb !== undefined
            ? updateData.disk_d_total_gb
            : currentData.disk_d_total_gb,
        disk_d_used_gb: updateData.disk_d_used_gb !== undefined
            ? updateData.disk_d_used_gb
            : currentData.disk_d_used_gb
    };
    
    debugLog(`📊 Data merged: status=${mergedData.status}, is_lot_active=${mergedData.is_lot_active}`);
    
    return mergedData;
}

/**
 * 특정 필드만 업데이트 (부분 병합)
 * 
 * @param {Object} currentData - 현재 데이터
 * @param {Object} partialUpdate - 업데이트할 필드들
 * @param {Array<string>} [protectedFields=['line_name']] - 보호할 필드들
 * @returns {Object} 병합된 데이터
 * 
 * @example
 * const merged = mergePartial(current, { status: 'RUN', cpu_usage_percent: 45 });
 */
export function mergePartial(currentData, partialUpdate, protectedFields = ['line_name']) {
    if (!currentData) return partialUpdate || {};
    if (!partialUpdate) return currentData;
    
    const merged = { ...currentData };
    
    for (const [key, value] of Object.entries(partialUpdate)) {
        // 보호된 필드는 스킵
        if (protectedFields.includes(key)) {
            continue;
        }
        
        // undefined가 아닌 경우에만 업데이트
        if (value !== undefined) {
            merged[key] = value;
        }
    }
    
    return merged;
}

/**
 * 다중 선택 데이터 병합 (캐시 업데이트용)
 * 
 * @param {Map} cacheMap - 캐시 Map
 * @param {string} frontendId - Frontend ID
 * @param {Object} updateData - 업데이트 데이터
 * @returns {Object|null} 업데이트된 데이터 또는 null
 */
export function updateCacheEntry(cacheMap, frontendId, updateData) {
    if (!cacheMap || !frontendId || !updateData) {
        return null;
    }
    
    const cached = cacheMap.get(frontendId);
    if (!cached) {
        return null;
    }
    
    const merged = mergeEquipmentData(cached.data, updateData);
    
    cacheMap.set(frontendId, {
        data: merged,
        timestamp: Date.now()
    });
    
    return merged;
}

/**
 * 필드 변경 여부 확인
 * 
 * @param {Object} oldData - 이전 데이터
 * @param {Object} newData - 새 데이터
 * @param {Array<string>} fields - 확인할 필드들
 * @returns {boolean} 변경 여부
 * 
 * @example
 * if (hasFieldsChanged(old, new, ['status', 'cpu_usage_percent'])) {
 *     // UI 업데이트
 * }
 */
export function hasFieldsChanged(oldData, newData, fields) {
    if (!oldData || !newData) return true;
    
    for (const field of fields) {
        if (oldData[field] !== newData[field]) {
            return true;
        }
    }
    
    return false;
}

// 기본 내보내기 (하위 호환성)
export default {
    mergeEquipmentData,
    mergePartial,
    updateCacheEntry,
    hasFieldsChanged
};