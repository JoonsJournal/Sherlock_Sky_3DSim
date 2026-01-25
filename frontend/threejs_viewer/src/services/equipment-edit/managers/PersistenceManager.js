/**
 * PersistenceManager.js - localStorage 저장/로드 + 다중 탭 동기화
 * @version 1.1.0
 * @changelog
 * - v1.1.0: JSDoc 간소화, 400줄 이하로 축소 (2026-01-25)
 * 📁 위치: frontend/threejs_viewer/src/services/equipment-edit/managers/PersistenceManager.js
 */

import { debugLog } from '../../../core/utils/Config.js';

export class PersistenceManager {
    static DEFAULT_STORAGE_KEY = 'sherlock_equipment_mappings';
    static STORAGE_WARNING_THRESHOLD = 4 * 1024 * 1024; // 4MB

    constructor(options = {}) {
        this._storageKey = options.storageKey || PersistenceManager.DEFAULT_STORAGE_KEY;
        this._onSave = options.onSave || null;
        this._onLoad = options.onLoad || null;
        this._onSync = options.onSync || null;
        this._onError = options.onError || null;
        this._validateFn = options.validateFn || null;
        
        debugLog('💾 PersistenceManager initialized');
    }

    // ==================== localStorage ====================
    save(mappings) {
        try {
            const dataStr = JSON.stringify(mappings || {});
            
            // 용량 체크
            if (dataStr.length > PersistenceManager.STORAGE_WARNING_THRESHOLD) {
                console.warn('[PersistenceManager] Data approaching localStorage limit');
                this._notifyEvent('storage-warning', { size: dataStr.length, limit: 5 * 1024 * 1024 });
            }
            
            localStorage.setItem(this._storageKey, dataStr);
            debugLog('💾 Mappings saved to localStorage');
            
            const result = { success: true, size: dataStr.length, count: Object.keys(mappings || {}).length };
            if (this._onSave) this._onSave(result);
            return result;
            
        } catch (error) {
            console.error('[PersistenceManager] Failed to save:', error);
            if (error.name === 'QuotaExceededError') {
                this._notifyEvent('storage-quota-exceeded', { error: error.message });
            } else {
                this._notifyEvent('save-error', { error: error.message });
            }
            if (this._onError) this._onError(error, 'save');
            return { success: false, error: error.message };
        }
    }

    load() {
        try {
            const data = localStorage.getItem(this._storageKey);
            if (!data) {
                debugLog('📂 No saved mappings found');
                return { success: true, data: {} };
            }
            
            const parsed = JSON.parse(data);
            
            if (this._validateFn && !this._validateFn(parsed)) {
                console.warn('[PersistenceManager] Invalid mapping data format');
                return { success: false, error: 'Validation failed', data: {} };
            }
            
            debugLog(`📂 Mappings loaded: ${Object.keys(parsed).length}개`);
            const result = { success: true, data: parsed, count: Object.keys(parsed).length };
            if (this._onLoad) this._onLoad(result);
            return result;
            
        } catch (error) {
            console.error('[PersistenceManager] Failed to load:', error);
            this._notifyEvent('load-error', { error: error.message });
            if (this._onError) this._onError(error, 'load');
            return { success: false, error: error.message, data: {} };
        }
    }

    hasStoredData() {
        try {
            const stored = localStorage.getItem(this._storageKey);
            if (!stored) return false;
            const data = JSON.parse(stored);
            return data && Object.keys(data).length > 0;
        } catch {
            return false;
        }
    }

    clear() {
        localStorage.removeItem(this._storageKey);
        debugLog('🗑️ localStorage cleared');
    }

    // ==================== 다중 탭 동기화 ====================
    handleStorageChange(event) {
        if (event.key !== this._storageKey || !event.newValue) return;
        
        try {
            const newMappings = JSON.parse(event.newValue);
            debugLog('🔄 Mappings synced from another tab');
            if (this._onSync) this._onSync(newMappings);
        } catch (error) {
            console.error('[PersistenceManager] Failed to sync:', error);
        }
    }

    // ==================== 서버 비교 ====================
    compareWithServer(localMappings, serverMappings) {
        const localIds = new Set(Object.keys(localMappings));
        const serverIds = new Set(Object.keys(serverMappings));
        
        const conflicts = [], localOnly = [], serverOnly = [];
        
        localIds.forEach(id => {
            if (!serverIds.has(id)) {
                localOnly.push(id);
            } else if (localMappings[id].equipment_id !== serverMappings[id].equipment_id) {
                conflicts.push({ frontendId: id, local: localMappings[id], server: serverMappings[id] });
            }
        });
        
        serverIds.forEach(id => {
            if (!localIds.has(id)) serverOnly.push(id);
        });
        
        return {
            needsSync: conflicts.length > 0 || localOnly.length > 0 || serverOnly.length > 0,
            conflicts, localOnly, serverOnly
        };
    }

    // ==================== 유틸리티 ====================
    getStorageKey() { return this._storageKey; }
    setStorageKey(newKey) { this._storageKey = newKey; }
    
    _notifyEvent(eventName, detail) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
    }
}