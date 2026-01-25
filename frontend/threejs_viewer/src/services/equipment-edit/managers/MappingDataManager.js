/**
 * MappingDataManager.js - 매핑 데이터 CRUD + 역방향 인덱스
 * @version 1.1.0
 * @changelog
 * - v1.1.0: JSDoc 간소화, 400줄 이하로 축소 (2026-01-25)
 * 📁 위치: frontend/threejs_viewer/src/services/equipment-edit/managers/MappingDataManager.js
 */

import { debugLog } from '../../../core/utils/Config.js';

export class MappingDataManager {
    constructor(options = {}) {
        this._mappings = {};
        this._equipmentIdIndex = {};
        this._isDirty = false;
        this._changeCount = 0;
        
        // 콜백
        this._onMappingChanged = options.onMappingChanged || null;
        this._onMappingRemoved = options.onMappingRemoved || null;
        this._onDuplicate = options.onDuplicate || null;
        this._onBatchComplete = options.onBatchComplete || null;
        
        debugLog('📦 MappingDataManager initialized');
    }

    // ==================== Getter ====================
    get mappings() { return { ...this._mappings }; }
    get equipmentIdIndex() { return { ...this._equipmentIdIndex }; }
    get isDirty() { return this._isDirty; }
    get changeCount() { return this._changeCount; }

    // ==================== 매핑 CRUD ====================
    setMapping(frontendId, dbEquipment) {
        if (!frontendId || typeof frontendId !== 'string') {
            console.error('Invalid frontendId:', frontendId);
            return false;
        }
        if (!dbEquipment || !dbEquipment.equipment_id || !dbEquipment.equipment_name) {
            console.error('Invalid dbEquipment:', dbEquipment);
            return false;
        }
        
        // 중복 검사
        const duplicate = this.findDuplicate(dbEquipment.equipment_id);
        if (duplicate && duplicate !== frontendId) {
            console.warn(`Equipment ${dbEquipment.equipment_id} already mapped to ${duplicate}`);
            if (this._onDuplicate) {
                this._onDuplicate({ frontendId, existingFrontendId: duplicate, equipmentId: dbEquipment.equipment_id });
            }
            return false;
        }
        
        // 기존 매핑 제거 (역방향 인덱스)
        const existing = this._mappings[frontendId];
        if (existing?.equipment_id) {
            delete this._equipmentIdIndex[existing.equipment_id];
        }
        
        // 새 매핑 저장
        this._mappings[frontendId] = {
            frontend_id: frontendId,
            equipment_id: dbEquipment.equipment_id,
            equipment_name: dbEquipment.equipment_name,
            line_name: dbEquipment.line_name || null,
            mapped_at: new Date().toISOString()
        };
        
        // 역방향 인덱스 업데이트
        this._equipmentIdIndex[dbEquipment.equipment_id] = frontendId;
        
        debugLog(`🔗 Mapping set: ${frontendId} → ${dbEquipment.equipment_name}`);
        
        if (this._onMappingChanged) {
            this._onMappingChanged({
                frontendId, equipmentId: dbEquipment.equipment_id,
                equipmentName: dbEquipment.equipment_name, lineName: dbEquipment.line_name
            });
        }
        return true;
    }

    removeMapping(frontendId) {
        if (!(frontendId in this._mappings)) return false;
        
        const removed = this._mappings[frontendId];
        if (removed.equipment_id) {
            delete this._equipmentIdIndex[removed.equipment_id];
        }
        delete this._mappings[frontendId];
        
        debugLog(`🗑️ Mapping removed: ${frontendId}`);
        
        if (this._onMappingRemoved) {
            this._onMappingRemoved({ frontendId, equipmentId: removed.equipment_id, equipmentName: removed.equipment_name });
        }
        return true;
    }

    getMapping(frontendId) { return this._mappings[frontendId] || null; }
    getAllMappings() { return { ...this._mappings }; }
    isComplete(frontendId) { return frontendId in this._mappings; }
    getMappingCount() { return Object.keys(this._mappings).length; }
    isEmpty() { return this.getMappingCount() === 0; }

    // ==================== 중복/인덱스 ====================
    findDuplicate(equipmentId) { return this._equipmentIdIndex[equipmentId] || null; }
    getFrontendIdByEquipmentId(equipmentId) { return this._equipmentIdIndex[equipmentId] || null; }
    getEquipmentIdIndex() { return { ...this._equipmentIdIndex }; }
    getAllEquipmentIds() { return Object.keys(this._equipmentIdIndex).map(id => parseInt(id, 10)); }
    
    rebuildEquipmentIdIndex() {
        this._equipmentIdIndex = {};
        for (const [frontendId, mapping] of Object.entries(this._mappings)) {
            if (mapping.equipment_id) {
                this._equipmentIdIndex[mapping.equipment_id] = frontendId;
            }
        }
        debugLog(`🔄 Equipment ID Index rebuilt: ${Object.keys(this._equipmentIdIndex).length} entries`);
    }

    // ==================== 배치 작업 ====================
    setBatchMappings(mappingArray) {
        const results = { success: 0, failed: 0, errors: [] };
        mappingArray.forEach(({ frontendId, dbEquipment }) => {
            try {
                if (this.setMapping(frontendId, dbEquipment)) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push({ frontendId, reason: 'Validation failed' });
                }
            } catch (error) {
                results.failed++;
                results.errors.push({ frontendId, error: error.message });
            }
        });
        debugLog(`📦 Batch mapping: ${results.success} success, ${results.failed} failed`);
        if (this._onBatchComplete) this._onBatchComplete(results);
        return results;
    }

    removeBatchMappings(frontendIds) {
        let removed = 0;
        frontendIds.forEach(id => { if (this.removeMapping(id)) removed++; });
        debugLog(`📦 Batch remove: ${removed} mappings deleted`);
        return removed;
    }

    // ==================== 데이터 설정/검증 ====================
    setMappings(mappings) {
        this._mappings = { ...mappings };
        this.rebuildEquipmentIdIndex();
    }

    loadFromServer(serverMappings, mergeStrategy = 'replace') {
        switch (mergeStrategy) {
            case 'replace': this._mappings = { ...serverMappings }; break;
            case 'merge': this._mappings = { ...this._mappings, ...serverMappings }; break;
            case 'keep-local': this._mappings = { ...serverMappings, ...this._mappings }; break;
            default: console.error('Invalid merge strategy:', mergeStrategy); return;
        }
        this.rebuildEquipmentIdIndex();
        debugLog(`📥 Mappings loaded from server (${mergeStrategy}): ${this.getMappingCount()}개`);
    }

    validateMappingData(data) {
        if (!data || typeof data !== 'object') return false;
        for (const [key, value] of Object.entries(data)) {
            if (!value.frontend_id || !value.equipment_id || !value.equipment_name) {
                console.warn(`Invalid mapping entry: ${key}`, value);
                return false;
            }
        }
        return true;
    }

    reset() {
        this._mappings = {};
        this._equipmentIdIndex = {};
        this._isDirty = false;
        this._changeCount = 0;
        debugLog('🗑️ MappingDataManager reset');
    }

    // ==================== Dirty Flag ====================
    markDirty() {
        this._isDirty = true;
        this._changeCount++;
    }
    
    clearDirty() {
        this._isDirty = false;
    }
}