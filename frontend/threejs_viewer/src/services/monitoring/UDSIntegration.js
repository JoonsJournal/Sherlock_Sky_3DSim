/**
 * UDSIntegration.js
 * =================
 * UDS (Unified Data Store) 연동 모듈
 * 
 * @version 1.0.0
 * @changelog
 * - v1.0.0: MonitoringService v5.1.0에서 분리 (2026-01-25)
 *           - ⚠️ 호환성: 기존 API 100% 유지
 * 
 * @dependencies
 * - services/uds/UnifiedDataStore.js (동적 import)
 * 
 * @exports UDSIntegration, UDS_EVENTS, udsIntegration
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/UDSIntegration.js
 */

import { debugLog } from '../../core/utils/Config.js';

// UDS 모듈 동적 로드 변수
let UnifiedDataStoreClass = null;
let unifiedDataStoreInstance = null;
let udsModuleLoaded = false;

async function loadUDSModule() {
    if (udsModuleLoaded) return true;
    try {
        const udsModule = await import('../uds/UnifiedDataStore.js');
        UnifiedDataStoreClass = udsModule.UnifiedDataStore;
        unifiedDataStoreInstance = udsModule.unifiedDataStore;
        udsModuleLoaded = true;
        debugLog('🆕 [UDS] Module loaded');
        return true;
    } catch (error) {
        debugLog(`⚠️ [UDS] Module not available: ${error.message}`);
        return false;
    }
}

/** UDS 이벤트 타입 */
export const UDS_EVENTS = Object.freeze({
    INITIALIZED: 'monitoring:uds-initialized',
    FALLBACK: 'monitoring:uds-fallback',
    EQUIPMENT_UPDATED: 'uds:equipment-updated',
    BATCH_UPDATED: 'uds:batch-updated',
    STATS_UPDATED: 'uds:stats-updated',
    ERROR: 'uds:error'
});

/**
 * UDS 연동 클래스 - MonitoringService에서 분리된 UDS 로직
 */
export class UDSIntegration {
    constructor(options = {}) {
        this._enabled = false;
        this._initialized = false;
        this._eventSubscribed = false;
        this._eventBus = null;
        this._signalIntegration = null;
        this._statusCache = null;
        
        this.callbacks = {
            onStatusUpdate: options.onStatusUpdate || (() => {}),
            onStatsUpdate: options.onStatsUpdate || (() => {}),
            onError: options.onError || ((err) => console.error(err))
        };
        
        this._boundHandlers = {
            equipmentUpdated: null,
            batchUpdated: null,
            statsUpdated: null,
            error: null
        };
    }
    
    // === Feature Flag ===
    isEnabled() {
        const config = window.APP_CONFIG || window.ENV_CONFIG || {};
        return config.UDS_ENABLED === true;
    }
    
    isInitialized() { return this._initialized; }
    
    // === 초기화 ===
    async initialize(params = {}) {
        const { siteId = 1, lineId = 1, signalIntegration, statusCache, eventBus } = params;
        const startTime = Date.now();
        
        debugLog(`🚀 [UDS] Initializing (site=${siteId}, line=${lineId})...`);
        
        this._signalIntegration = signalIntegration;
        this._statusCache = statusCache;
        this._eventBus = eventBus;
        
        try {
            if (!await loadUDSModule() || !unifiedDataStoreInstance) {
                throw new Error('UDS module not available');
            }
            
            const equipments = await unifiedDataStoreInstance.initialize({ siteId, lineId });
            debugLog(`✅ [UDS] Loaded ${equipments.length} equipments`);
            
            this._syncSignalTowers(equipments);
            this._subscribeToEvents();
            
            this._enabled = true;
            this._initialized = true;
            
            this._emitEvent(UDS_EVENTS.INITIALIZED, {
                equipmentCount: equipments.length,
                stats: unifiedDataStoreInstance.getStatusStats(),
                elapsed: Date.now() - startTime
            });
            
            return true;
        } catch (error) {
            console.error('❌ [UDS] Init failed:', error);
            this._emitEvent(UDS_EVENTS.FALLBACK, { error: error.message });
            return false;
        }
    }
    
    // === 캐시 조회 ===
    getEquipment(frontendId) {
        if (!this._initialized || !unifiedDataStoreInstance) return null;
        return unifiedDataStoreInstance.getEquipment(frontendId);
    }
    
    getAllEquipments() {
        if (!this._initialized || !unifiedDataStoreInstance) return [];
        return unifiedDataStoreInstance.getAllEquipments() || [];
    }
    
    getStatusStats() {
        if (!this._initialized || !unifiedDataStoreInstance) {
            return { RUN: 0, IDLE: 0, STOP: 0, SUDDENSTOP: 0, DISCONNECTED: 0, TOTAL: 0 };
        }
        return unifiedDataStoreInstance.getStatusStats() || {};
    }
    
    async getEquipmentDetail(frontendId, legacyFallback) {
        const udsEquipment = this.getEquipment(frontendId);
        if (udsEquipment) return udsEquipment;
        
        debugLog(`⚠️ [UDS] Cache miss: ${frontendId}`);
        if (legacyFallback && typeof legacyFallback === 'function') {
            return await legacyFallback(frontendId);
        }
        return null;
    }
    
    getStore() { return unifiedDataStoreInstance; }
    getCacheHitRate() { return unifiedDataStoreInstance?.getCacheHitRate?.() || 0; }
    getDeltaCount() { return unifiedDataStoreInstance?.getDeltaCount?.() || 0; }
    
    // === 설정 ===
    setCallbacks(callbacks) { Object.assign(this.callbacks, callbacks); }
    setSignalIntegration(si) { this._signalIntegration = si; }
    setStatusCache(cache) { this._statusCache = cache; }
    setEventBus(bus) { this._eventBus = bus; }
    
    // === SignalTower 동기화 ===
    _syncSignalTowers(equipments) {
        let syncCount = 0;
        for (const eq of equipments) {
            const fid = eq.frontend_id;
            const status = eq.status || 'DISCONNECTED';
            if (!fid) continue;
            
            this._signalIntegration?.updateStatus(fid, status);
            this._statusCache?.set(fid, status);
            syncCount++;
        }
        debugLog(`✅ [UDS] Synced ${syncCount} SignalTowers`);
    }
    
    // === 이벤트 구독 ===
    _subscribeToEvents() {
        if (this._eventSubscribed || !UnifiedDataStoreClass || !this._eventBus) return;
        
        this._boundHandlers.equipmentUpdated = (e) => this._handleEquipmentUpdated(e);
        this._boundHandlers.batchUpdated = (e) => this._handleBatchUpdated(e);
        this._boundHandlers.statsUpdated = (e) => this._handleStatsUpdated(e);
        this._boundHandlers.error = (e) => this._handleError(e);
        
        this._eventBus.on(UnifiedDataStoreClass.EVENTS.EQUIPMENT_UPDATED, this._boundHandlers.equipmentUpdated);
        this._eventBus.on(UnifiedDataStoreClass.EVENTS.BATCH_UPDATED, this._boundHandlers.batchUpdated);
        this._eventBus.on(UnifiedDataStoreClass.EVENTS.STATS_UPDATED, this._boundHandlers.statsUpdated);
        this._eventBus.on(UnifiedDataStoreClass.EVENTS.ERROR, this._boundHandlers.error);
        
        this._eventSubscribed = true;
        debugLog('✅ [UDS] Events subscribed');
    }
    
    unsubscribeFromEvents() {
        if (!this._eventSubscribed || !UnifiedDataStoreClass || !this._eventBus) return;
        
        if (this._boundHandlers.equipmentUpdated) {
            this._eventBus.off(UnifiedDataStoreClass.EVENTS.EQUIPMENT_UPDATED, this._boundHandlers.equipmentUpdated);
        }
        if (this._boundHandlers.batchUpdated) {
            this._eventBus.off(UnifiedDataStoreClass.EVENTS.BATCH_UPDATED, this._boundHandlers.batchUpdated);
        }
        if (this._boundHandlers.statsUpdated) {
            this._eventBus.off(UnifiedDataStoreClass.EVENTS.STATS_UPDATED, this._boundHandlers.statsUpdated);
        }
        if (this._boundHandlers.error) {
            this._eventBus.off(UnifiedDataStoreClass.EVENTS.ERROR, this._boundHandlers.error);
        }
        
        this._eventSubscribed = false;
        debugLog('🔌 [UDS] Events unsubscribed');
    }
    
    // === 이벤트 핸들러 ===
    _handleEquipmentUpdated(event) {
        const { frontendId, changes, equipment } = event;
        if (changes.status) {
            this._signalIntegration?.updateStatus(frontendId, changes.status);
            this._statusCache?.set(frontendId, changes.status);
        }
        this.callbacks.onStatusUpdate(frontendId, { status: changes.status || equipment?.status, ...changes, ...equipment });
    }
    
    _handleBatchUpdated(event) {
        debugLog(`📊 [UDS] Batch: ${event.count} equipments`);
        this.callbacks.onStatsUpdate();
    }
    
    _handleStatsUpdated(event) {
        debugLog(`📊 [UDS] Stats updated`);
        this.callbacks.onStatsUpdate();
    }
    
    _handleError(event) {
        console.error('❌ [UDS] Error:', event.error);
        this.callbacks.onError(event.error);
    }
    
    _emitEvent(eventName, data) {
        if (!this._eventBus) return;
        this._eventBus.emit(eventName, { ...data, source: 'UDSIntegration', timestamp: new Date().toISOString() });
    }
    
    // === 상태 조회 ===
    getStatus() {
        return {
            enabled: this._enabled,
            initialized: this._initialized,
            eventSubscribed: this._eventSubscribed,
            moduleLoaded: udsModuleLoaded,
            cacheSize: this._initialized ? this.getAllEquipments().length : 0,
            stats: this.getStatusStats()
        };
    }
    
    // === 정리 ===
    dispose() {
        this.unsubscribeFromEvents();
        unifiedDataStoreInstance?.dispose?.();
        this._enabled = false;
        this._initialized = false;
        this._eventBus = null;
        this._signalIntegration = null;
        this._statusCache = null;
        debugLog('✅ [UDS] Disposed');
    }
    
    static get VERSION() { return '1.0.0'; }
    static get EVENTS() { return UDS_EVENTS; }
}

// 싱글톤 export
export const udsIntegration = new UDSIntegration();
export default UDSIntegration;