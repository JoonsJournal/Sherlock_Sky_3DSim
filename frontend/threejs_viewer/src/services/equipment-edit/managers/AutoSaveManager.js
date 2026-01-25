/**
 * AutoSaveManager.js - StorageService AutoSave 연동
 * @version 1.1.0
 * @changelog
 * - v1.1.0: JSDoc 간소화, 400줄 이하로 축소 (2026-01-25)
 * 📁 위치: frontend/threejs_viewer/src/services/equipment-edit/managers/AutoSaveManager.js
 */

import { debugLog } from '../../../core/utils/Config.js';

export class AutoSaveManager {
    constructor(options = {}) {
        this._siteId = options.siteId || 'default_site';
        this._enabled = options.enabled ?? true;
        this._intervalMs = options.intervalMs || 30000;
        this._changeThreshold = options.changeThreshold || 5;
        
        this._getData = options.getData || null;
        this._onSave = options.onSave || null;
        this._onError = options.onError || null;
        
        this._instance = null;
        this._isDirty = false;
        this._changeCount = 0;
        
        debugLog('⏱️ AutoSaveManager initialized');
    }

    // ==================== 초기화/중지 ====================
    init(storageService, siteId = null) {
        if (!storageService) {
            console.warn('[AutoSaveManager] StorageService가 없습니다. AutoSave 비활성화.');
            return;
        }
        if (!this._enabled) {
            console.log('[AutoSaveManager] AutoSave가 비활성화되어 있습니다.');
            return;
        }
        if (siteId) this._siteId = siteId;
        
        this._instance = storageService.autoSave.register('equipment', this._siteId, {
            getData: this._getData,
            intervalMs: this._intervalMs,
            changeThreshold: this._changeThreshold,
            onSave: (data) => {
                console.log('[AutoSaveManager] AutoSave 완료:', data._autoSave);
                if (this._onSave) this._onSave(data);
            },
            onError: (error) => {
                console.error('[AutoSaveManager] AutoSave 실패:', error);
                if (this._onError) this._onError(error);
            }
        });
        
        this._instance.start();
        console.log(`[AutoSaveManager] 초기화 완료 - siteId: ${this._siteId}, interval: ${this._intervalMs}ms`);
    }

    stop() {
        if (this._instance) {
            this._instance.stop();
            console.log('[AutoSaveManager] AutoSave 중지됨');
        }
    }

    restart() {
        if (this._instance) {
            this._instance.start();
            console.log('[AutoSaveManager] AutoSave 재시작됨');
        }
    }

    // ==================== Dirty Flag ====================
    markDirty() {
        this._isDirty = true;
        this._changeCount++;
        if (this._instance) this._instance.markDirty();
        debugLog(`[AutoSaveManager] 변경 감지 - count: ${this._changeCount}`);
    }

    clearDirty() {
        this._isDirty = false;
    }

    // ==================== 복구 ====================
    checkRecovery(storageService) {
        if (!storageService) return null;
        const recoveryData = storageService.autoSave.checkRecovery('equipment', this._siteId);
        if (recoveryData) {
            console.log('[AutoSaveManager] 복구 데이터 발견:', {
                savedAt: recoveryData._autoSave?.savedAt,
                mappingCount: recoveryData.mappingCount
            });
        }
        return recoveryData;
    }

    clearRecovery(storageService) {
        if (storageService) {
            storageService.autoSave.clearRecovery('equipment', this._siteId);
            console.log('[AutoSaveManager] 복구 데이터 삭제됨');
        }
    }

    // ==================== 상태/즉시 저장 ====================
    getStatus() {
        if (this._instance) return this._instance.getStatus();
        return { enabled: this._enabled, running: false, isDirty: this._isDirty, changeCount: this._changeCount };
    }

    async saveNow(reason = 'manual') {
        if (this._instance) return this._instance.saveNow(reason);
        return false;
    }

    // ==================== Getter ====================
    get isDirty() { return this._isDirty; }
    get changeCount() { return this._changeCount; }
    get siteId() { return this._siteId; }
    get enabled() { return this._enabled; }
}