/**
 * EquipmentEditState.js (Refactored v2 - Slim Orchestrator)
 * 설비 편집 상태 관리 - 진짜 Facade 패턴
 * 
 * @version 2.1.0
 * @changelog
 * - v2.1.0: Coding Guidelines 준수 (2026-01-25)
 *   - 954줄 → 280줄로 대폭 축소
 *   - JSDoc 간소화, 단순 위임은 한 줄로
 *   - ⚠️ 호환성: 기존 모든 public API 100% 유지
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/equipment-edit/EquipmentEditState.js
 */

import { debugLog } from '../../core/utils/Config.js';
import { MappingDataManager } from './managers/MappingDataManager.js';
import { PersistenceManager } from './managers/PersistenceManager.js';
import { AutoSaveManager } from './managers/AutoSaveManager.js';
import { StatisticsCalculator } from './utils/StatisticsCalculator.js';
import { ImportExportManager } from './utils/ImportExportManager.js';
import { DebugUtils, registerGlobalDebugFunctions } from './utils/DebugUtils.js';

export class EquipmentEditState {
    constructor(options = {}) {
        // 상태
        this.editModeEnabled = false;
        this.version = '2.1.0';
        this.eventBus = options.eventBus || null;
        this.totalEquipment = options.totalEquipment || 117;
        
        // Deprecation 경고 플래그
        this._deprecationWarningShown = { loadMappingsFromApi: false };
        
        // 매니저 초기화
        this._mappingManager = new MappingDataManager({
            onMappingChanged: (info) => {
                this.dispatchEvent('mapping-changed', info);
                this._emitMappingChanged();
            },
            onMappingRemoved: (info) => {
                this.dispatchEvent('mapping-removed', info);
                this._emitMappingChanged();
            },
            onDuplicate: (info) => this.dispatchEvent('mapping-duplicate', info),
            onBatchComplete: (results) => this.dispatchEvent('batch-mapping-complete', results)
        });
        
        this._persistenceManager = new PersistenceManager({
            storageKey: 'sherlock_equipment_mappings',
            validateFn: (data) => this._mappingManager.validateMappingData(data),
            onSave: (result) => this.dispatchEvent('mappings-saved', result),
            onSync: (data) => {
                this._mappingManager.setMappings(data);
                this.dispatchEvent('mappings-synced', { source: 'storage-event', count: Object.keys(data).length });
                this._emitMappingChanged();
            }
        });
        
        this._autoSaveManager = new AutoSaveManager({
            siteId: options.siteId || 'default_site',
            enabled: options.autoSaveEnabled ?? true,
            intervalMs: options.autoSaveIntervalMs || 30000,
            changeThreshold: options.autoSaveChangeThreshold || 5,
            getData: () => this.getAutoSaveData(),
            onSave: (data) => this.dispatchEvent('autosave-complete', { data }),
            onError: (error) => this.dispatchEvent('autosave-error', { error: error.message })
        });
        
        // 초기 로드
        this.load();
        
        // 다중 탭 동기화
        this.handleStorageChange = this.handleStorageChange.bind(this);
        window.addEventListener('storage', this.handleStorageChange);
        
        // 디버그 함수 등록
        registerGlobalDebugFunctions(this);
        
        debugLog(`✨ EquipmentEditState initialized (v${this.version})`);
    }

    // ==================== Getter (하위 호환) ====================
    get mappings() { return this._mappingManager.mappings; }
    get equipmentIdIndex() { return this._mappingManager.equipmentIdIndex; }
    get isDirty() { return this._mappingManager.isDirty; }
    get storageKey() { return this._persistenceManager.getStorageKey(); }

    // ==================== 편집 모드 ====================
    enableEditMode() {
        this.editModeEnabled = true;
        debugLog('✏️ Equipment Edit Mode: ON');
        this.dispatchEvent('edit-mode-changed', { enabled: true });
    }
    
    disableEditMode() {
        this.editModeEnabled = false;
        debugLog('✏️ Equipment Edit Mode: OFF');
        this.dispatchEvent('edit-mode-changed', { enabled: false });
    }
    
    toggleEditMode() {
        this.editModeEnabled ? this.disableEditMode() : this.enableEditMode();
        return this.editModeEnabled;
    }

    // ==================== EventBus ====================
    setEventBus(eventBus) { this.eventBus = eventBus; debugLog('[EquipmentEditState] EventBus 연결됨'); }
    setTotalEquipment(total) { this.totalEquipment = total; }
    
    _emitMappingChanged() {
        this.dispatchEvent('mapping-stats-changed', { mapped: this.getMappingCount(), total: this.totalEquipment });
        if (this.eventBus) {
            this.eventBus.emit('equipment:mapping-changed', {
                mapped: this.getMappingCount(), total: this.totalEquipment,
                unmapped: this.totalEquipment - this.getMappingCount(),
                rate: this.getCompletionRate(), timestamp: new Date().toISOString()
            });
        }
    }

    // ==================== 매핑 CRUD (MappingDataManager 위임) ====================
    setMapping(frontendId, dbEquipment) {
        const result = this._mappingManager.setMapping(frontendId, dbEquipment);
        if (result) { this._notifyChange(); this.save(); }
        return result;
    }
    
    removeMapping(frontendId) {
        const result = this._mappingManager.removeMapping(frontendId);
        if (result) { this._notifyChange(); this.save(); }
        return result;
    }
    
    getMapping(frontendId) { return this._mappingManager.getMapping(frontendId); }
    getAllMappings() { return this._mappingManager.getAllMappings(); }
    isComplete(frontendId) { return this._mappingManager.isComplete(frontendId); }
    getMappingCount() { return this._mappingManager.getMappingCount(); }
    findDuplicate(equipmentId) { return this._mappingManager.findDuplicate(equipmentId); }
    findFrontendIdByEquipmentId(equipmentId) { return this._mappingManager.getFrontendIdByEquipmentId(equipmentId); }
    rebuildEquipmentIdIndex() { this._mappingManager.rebuildEquipmentIdIndex(); }
    getFrontendIdByEquipmentId(equipmentId) { return this._mappingManager.getFrontendIdByEquipmentId(equipmentId); }
    getEquipmentIdIndex() { return this._mappingManager.getEquipmentIdIndex(); }
    getAllEquipmentIds() { return this._mappingManager.getAllEquipmentIds(); }
    validateMappingData(data) { return this._mappingManager.validateMappingData(data); }

    // ==================== 배치 작업 ====================
    setBatchMappings(mappingArray) {
        const results = this._mappingManager.setBatchMappings(mappingArray);
        if (results.success > 0) { this._notifyChange(); this.save(); }
        return results;
    }
    
    removeBatchMappings(frontendIds) {
        const removed = this._mappingManager.removeBatchMappings(frontendIds);
        if (removed > 0) { this._notifyChange(); this.save(); }
        return removed;
    }

    // ==================== 통계 (StatisticsCalculator 위임) ====================
    getCompletionRate(total) { return StatisticsCalculator.getCompletionRate(this.mappings, total || this.totalEquipment); }
    getUnmappedIds(allIds) { return StatisticsCalculator.getUnmappedIds(this.mappings, allIds); }
    getStatistics() { return StatisticsCalculator.getStatistics(this.mappings); }

    // ==================== localStorage (PersistenceManager 위임) ====================
    save() { return this._persistenceManager.save(this.mappings).success; }
    
    load() {
        const result = this._persistenceManager.load();
        if (result.success && result.data) {
            this._mappingManager.setMappings(result.data);
            setTimeout(() => this._emitMappingChanged(), 100);
        }
        return result.success;
    }
    
    reset(skipConfirm = false) {
        if (!skipConfirm && !confirm('모든 매핑 데이터를 삭제하시겠습니까?')) return false;
        this._mappingManager.reset();
        this.save();
        this.dispatchEvent('mappings-reset');
        this._emitMappingChanged();
        return true;
    }
    
    handleStorageChange(event) { this._persistenceManager.handleStorageChange(event); }
    _hasLocalStorageData() { return this._persistenceManager.hasStoredData(); }

    // ==================== 서버 동기화 ====================
    loadFromServer(serverMappings, mergeStrategy = 'replace') {
        this._mappingManager.loadFromServer(serverMappings, mergeStrategy);
        this._notifyChange();
        this.save();
        this.dispatchEvent('mappings-loaded', { strategy: mergeStrategy, count: this.getMappingCount() });
        this._emitMappingChanged();
    }
    
    async loadMappingsFromApi(apiClient, options = {}) {
        if (!this._deprecationWarningShown.loadMappingsFromApi) {
            console.warn('⚠️ [DEPRECATED] Use EquipmentMappingService.loadMappingsForSite() instead.');
            this._deprecationWarningShown.loadMappingsFromApi = true;
        }
        const { mergeStrategy = 'replace', silent = false } = options;
        if (!apiClient) return { success: false, count: 0, error: 'ApiClient not provided' };
        try {
            const serverMappings = await apiClient.getEquipmentMappings();
            if (!serverMappings || typeof serverMappings !== 'object') return { success: true, count: 0 };
            this.loadFromServer(serverMappings, mergeStrategy);
            this.dispatchEvent('mappings-loaded-from-api', { count: this.getMappingCount(), mergeStrategy, source: 'api' });
            return { success: true, count: this.getMappingCount() };
        } catch (error) {
            this.dispatchEvent('mappings-load-error', { error: error.message, source: 'api' });
            return { success: false, count: 0, error: error.message };
        }
    }
    
    isMappingsEmpty() { return this._mappingManager.isEmpty(); }
    getMappingsStatus() { return { isEmpty: this.isMappingsEmpty(), count: this.getMappingCount(), hasLocalData: this._hasLocalStorageData() }; }
    compareWithServer(serverMappings) { return this._persistenceManager.compareWithServer(this.mappings, serverMappings); }
    toServerFormat() { return ImportExportManager.toServerFormat(this.mappings); }

    // ==================== AutoSave (AutoSaveManager 위임) ====================
    initAutoSave(storageService, siteId) { this._autoSaveManager.init(storageService, siteId); }
    stopAutoSave() { this._autoSaveManager.stop(); }
    getAutoSaveData() { return { mappings: { ...this.mappings }, editModeEnabled: this.editModeEnabled, mappingCount: this.getMappingCount(), statistics: this.getStatistics(), savedAt: new Date().toISOString() }; }
    checkAutoSaveRecovery(storageService) { return this._autoSaveManager.checkRecovery(storageService); }
    
    applyAutoSaveRecovery(recoveryData) {
        if (!recoveryData?.mappings) return false;
        this._mappingManager.setMappings(recoveryData.mappings);
        this.save();
        this.dispatchEvent('mappings-recovered', { count: this.getMappingCount(), source: 'autosave' });
        this._emitMappingChanged();
        return true;
    }
    
    clearAutoSaveRecovery(storageService) { this._autoSaveManager.clearRecovery(storageService); }
    getAutoSaveStatus() { return this._autoSaveManager.getStatus(); }
    async triggerAutoSave() { return this._autoSaveManager.saveNow('manual'); }
    _notifyChange() { this._mappingManager.markDirty(); this._autoSaveManager.markDirty(); }

    // ==================== Import/Export ====================
    exportToJson() { return ImportExportManager.exportToJson(this.mappings, { editModeEnabled: this.editModeEnabled, version: this.version }); }
    
    importFromJson(jsonStr) {
        const result = ImportExportManager.importFromJson(jsonStr, (data) => this._mappingManager.validateMappingData(data));
        if (result.success) {
            this._mappingManager.setMappings(result.data);
            this._notifyChange();
            this.save();
            this.dispatchEvent('mappings-imported', { count: this.getMappingCount(), sourceVersion: result.version });
            this._emitMappingChanged();
        }
        return result.success;
    }
    
    exportToFile() { ImportExportManager.exportToFile(this.mappings, { editModeEnabled: this.editModeEnabled, version: this.version }); }
    async importFromFile(file) { const text = await file.text(); return this.importFromJson(text); }

    // ==================== 이벤트 / 디버깅 ====================
    dispatchEvent(eventName, detail = {}) { window.dispatchEvent(new CustomEvent(eventName, { detail })); }
    debugPrintState() { DebugUtils.printState(this); }

    // ==================== 리소스 정리 ====================
    destroy() {
        this.stopAutoSave();
        window.removeEventListener('storage', this.handleStorageChange);
        this.eventBus = null;
        debugLog('🧹 EquipmentEditState destroyed');
    }
}