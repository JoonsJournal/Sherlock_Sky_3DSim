/**
 * MonitoringService.js - v6.0.0
 * ==============================
 * 실시간 설비 모니터링 서비스 (Orchestrator Pattern)
 * 
 * @version 6.0.0
 * @changelog
 * ⭐ v6.0.0: 가이드라인 준수 리팩토링 (2026-01-25)
 *   - UDSIntegration.js, MonitoringLifecycle.js, MonitoringEventEmitter.js 분리
 *   - ⚠️ 호환성: 기존 API 100% 유지
 * ⭐ v5.1.0: UDS 통합 연동 (2026-01-20)
 * ⭐ v5.0.0: MonitoringDataLoader 통합 (2026-01-13)
 * 
 * @exports MonitoringService, MonitoringServiceEvents
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/MonitoringService.js
 */

import { debugLog } from '../core/utils/Config.js';
import { StatusAPIClient } from './monitoring/StatusAPIClient.js';
import { WebSocketManager } from './monitoring/WebSocketManager.js';
import { SignalTowerIntegration } from './monitoring/SignalTowerIntegration.js';
import { MappingEventHandler } from './monitoring/MappingEventHandler.js';
import { MonitoringDataLoader } from './loaders/MonitoringDataLoader.js';

// 🆕 v6.0.0: 분리된 모듈
import { UDSIntegration, UDS_EVENTS } from './monitoring/UDSIntegration.js';
import { MonitoringLifecycle, LifecycleState } from './monitoring/MonitoringLifecycle.js';
import { MonitoringEventEmitter, MonitoringServiceEvents } from './monitoring/MonitoringEventEmitter.js';

export { MonitoringServiceEvents };

export class MonitoringService {
    constructor(signalTowerManager, equipmentLoader = null, equipmentEditState = null) {
        this.signalTowerManager = signalTowerManager;
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        
        // URL 생성
        const host = window.location.hostname;
        const port = 8008;
        this.apiBaseUrl = `http://${host}:${port}/api/monitoring`;
        this.wsUrl = `ws://${host}:${port}/api/monitoring/stream`;
        
        // 기존 모듈 인스턴스
        this.apiClient = new StatusAPIClient(this.apiBaseUrl);
        this.wsManager = new WebSocketManager(this.wsUrl, {
            maxReconnectAttempts: 5, reconnectDelay: 3000, debug: false,
            onStatusUpdate: (fid, data) => this._handleStatusUpdate(fid, data),
            onConnected: (msg) => debugLog(`📡 WS connected: ${msg}`),
            onSubscribed: (msg) => debugLog(`📡 WS subscribed: ${msg}`),
            onReconnecting: (a, m) => debugLog(`🔄 Reconnecting (${a}/${m})`),
            onDisconnected: () => debugLog('🔌 WS disconnected'),
            onError: (e) => console.error('❌ WS error:', e),
            getEquipmentIds: () => this.getMappedEquipmentIds(),
            getFrontendId: (eqId) => this.equipmentEditState?.getFrontendIdByEquipmentId(eqId)
        });
        
        this._dataLoader = new MonitoringDataLoader({
            equipmentEditState, signalTowerManager,
            apiBaseUrl: this.apiBaseUrl, wsUrl: this.wsUrl,
            staleThresholdHours: 24, autoSubscribe: true, debug: false,
            onStatusUpdate: (fid, data) => this._handleDataLoaderStatusUpdate(fid, data)
        });
        
        this.signalIntegration = new SignalTowerIntegration(signalTowerManager, equipmentLoader, equipmentEditState, { debug: false });
        this.statsPanel = null; // v5.0.2: 제거됨
        
        this.eventHandler = new MappingEventHandler({
            signalIntegration: this.signalIntegration,
            apiClient: this.apiClient, wsManager: this.wsManager,
            onUpdate: () => this.updateStatusPanel(),
            showToast: (msg, type) => this.showToast(msg, type),
            cacheStatus: (fid, status) => status === null ? this.statusCache.delete(fid) : this.statusCache.set(fid, status)
        }, { debug: false });
        
        // 🆕 v6.0.0: 분리된 모듈
        this.udsIntegration = new UDSIntegration({
            onStatusUpdate: (fid, data) => this._handleStatusUpdate(fid, data),
            onStatsUpdate: () => this._emitStatsUpdate()
        });
        this.lifecycle = new MonitoringLifecycle(this);
        this.eventEmitter = new MonitoringEventEmitter();
        this.eventEmitter.setContext(this);
        
        // 레거시 호환 속성
        this._ws = null;
        this.isActive = false;
        this._isStarting = false;
        this._startSequence = null;
        this._isStopping = false;
        this._udsEnabled = false;
        this._udsInitialized = false;
        this._udsEventSubscribed = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.statusCache = new Map();
        this.updateQueue = [];
        this.batchInterval = 1000;
        this.batchTimer = null;
        this.staleThresholdHours = 24;
        this.disabledOptions = { grayColor: 0x444444 };
        this.statusPanelElement = null;
        this.currentStats = { total: 0, mapped: 0, unmapped: 0, rate: 0, connected: 0, disconnected: 0 };
        this.eventBus = null;
        this.equipmentInfoPanel = null;
        this._boundHandleMappingChanged = (e) => this.eventHandler._handleMappingEvent(e);
        
        this._setupDataLoaderEvents();
        debugLog('📡 MonitoringService v6.0.0 initialized');
    }
    
    // === UDS Feature Flag (원본 호환) ===
    isUDSEnabled() {
        const config = window.APP_CONFIG || window.ENV_CONFIG || {};
        return config.UDS_ENABLED === true;
    }
    isUDSInitialized() { return this._udsInitialized || this.udsIntegration.isInitialized(); }
    
    // === UDS 초기화 (원본 호환) ===
    async initializeWithUDS(params = {}) {
        const { siteId = 1, lineId = 1 } = params;
        const result = await this.udsIntegration.initialize({
            siteId, lineId,
            signalIntegration: this.signalIntegration,
            statusCache: this.statusCache,
            eventBus: this.eventBus
        });
        if (result) {
            this._udsEnabled = true;
            this._udsInitialized = true;
        }
        return result;
    }
    
    _syncSignalTowersFromUDS(equipments) {
        this.udsIntegration._syncSignalTowers(equipments);
    }
    
    _subscribeToUDSEvents() { this.udsIntegration._subscribeToEvents(); this._udsEventSubscribed = true; }
    _unsubscribeFromUDSEvents() { this.udsIntegration.unsubscribeFromEvents(); this._udsEventSubscribed = false; }
    _handleUDSEquipmentUpdated(event) { this.udsIntegration._handleEquipmentUpdated(event); }
    _handleUDSBatchUpdated(event) { this.udsIntegration._handleBatchUpdated(event); }
    _handleUDSStatsUpdated(event) { this.udsIntegration._handleStatsUpdated(event); }
    getEquipmentFromUDS(frontendId) { return this.udsIntegration.getEquipment(frontendId); }
    
    async getEquipmentDetail(frontendId) {
        const uds = this.getEquipmentFromUDS(frontendId);
        if (uds) return uds;
        return await this._fetchEquipmentDetailLegacy(frontendId);
    }
    
    async _fetchEquipmentDetailLegacy(frontendId) {
        try {
            if (this._dataLoader) return await this._dataLoader.fetchLiveStatus(frontendId);
            return await this.apiClient.fetchEquipmentLiveStatus?.(frontendId) || null;
        } catch (e) { return null; }
    }
    
    _setupDataLoaderEvents() {
        this._dataLoader.on?.('initial-status-loaded', (d) => { this.currentStats.connected = d.connected; this.currentStats.disconnected = d.disconnected; });
    }
    
    get ws() { return this.wsManager?.ws || this._ws; }
    set ws(v) { this._ws = v; }
    getDataLoader() { return this._dataLoader; }
    isDataLoaderInitialized() { return this._dataLoader?.isInitialized?.() ?? false; }
    
    // === 의존성 설정 ===
    setDependencies(equipmentLoader, equipmentEditState, eventBus = null) {
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        this.eventBus = eventBus;
        this.signalIntegration.setDependencies(equipmentLoader, equipmentEditState);
        this._dataLoader?.setDependencies({ equipmentEditState, signalTowerManager: this.signalTowerManager });
        this.udsIntegration.setEventBus(eventBus);
        debugLog('Dependencies set');
    }
    setEquipmentInfoPanel(panel) { this.equipmentInfoPanel = panel; }
    setSignalTowerManager(mgr) { this.signalTowerManager = mgr; this.signalIntegration.setSignalTowerManager(mgr); this._dataLoader?.setSignalTowerManager?.(mgr); }
    setEquipmentEditState(state) { this.equipmentEditState = state; this.signalIntegration.setEquipmentEditState(state); this._dataLoader?.setEquipmentEditState?.(state); }
    setEquipmentLoader(loader) { this.equipmentLoader = loader; this.signalIntegration.setEquipmentLoader(loader); }
    setStaleThreshold(hours) { if (hours >= 1 && hours <= 168) { this.staleThresholdHours = hours; this._dataLoader?.setStaleThreshold?.(hours); } }
    setWsUrl(url) { this.wsUrl = url; if (this.wsManager && !this.wsManager.isConnected()) this.wsManager.setUrl(url); }
    setApiBaseUrl(url) { this.apiBaseUrl = url; this.apiClient?.setBaseUrl?.(url); }
    
    // === 모듈 접근자 ===
    getApiClient() { return this.apiClient; }
    getWebSocketManager() { return this.wsManager; }
    getStatsPanel() { return null; }
    getSignalIntegration() { return this.signalIntegration; }
    getEventHandler() { return this.eventHandler; }
    getUnifiedDataStore() { return this.udsIntegration.getStore(); }
    
    // === 라이프사이클 (위임) ===
    async start(options = {}) { return this.lifecycle.start(options); }
    async stop() { return this.lifecycle.stop(); }
    async restart(options = {}) { return this.lifecycle.restart(options); }
    
    // === 이벤트 리스너 (위임) ===
    registerEventListeners() { this.eventHandler.register(this.eventBus); }
    unregisterEventListeners() { this.eventHandler.unregister(); }
    async handleMappingChanged(e) { return this.eventHandler._handleMappingEvent(e); }
    
    async fetchSingleEquipmentStatus(frontendId) {
        const uds = this.getEquipmentFromUDS(frontendId);
        if (uds) return uds;
        if (this._dataLoader) return await this._dataLoader.fetchLiveStatus(frontendId);
        return this.apiClient.fetchEquipmentLiveStatus?.(frontendId) || null;
    }
    
    // === 통계 패널 (레거시 호환) ===
    createStatusPanel() { this.updateStats(); }
    updateStatusPanel() { this.updateStats(); this._emitStatsUpdate(); }
    removeStatusPanel() {}
    getStats() { this.updateStats(); return { ...this.currentStats }; }
    
    updateStats() {
        if (this._udsInitialized || this.udsIntegration.isInitialized()) {
            const udsStats = this.udsIntegration.getStatusStats() || this.getUnifiedDataStore()?.getStatusStats?.() || {};
            const total = this.equipmentLoader?.equipmentArray?.length || 0;
            const mapped = this.equipmentEditState?.getMappingCount?.() || 0;
            this.currentStats = {
                total, mapped, unmapped: total - mapped,
                rate: total > 0 ? Math.round((mapped / total) * 100) : 0,
                connected: (udsStats.TOTAL || 0) - (udsStats.DISCONNECTED || 0),
                disconnected: udsStats.DISCONNECTED || 0
            };
        } else {
            const total = this.equipmentLoader?.equipmentArray?.length || 0;
            const mapped = this.equipmentEditState?.getMappingCount?.() || 0;
            const stats = this.signalTowerManager?.getStatusStatistics?.() || {};
            this.currentStats = {
                total, mapped, unmapped: total - mapped,
                rate: total > 0 ? Math.round((mapped / total) * 100) : 0,
                connected: Math.max(0, mapped - (stats.DISCONNECTED || 0)),
                disconnected: stats.DISCONNECTED || 0
            };
        }
    }
    
    // === 이벤트 발행 ===
    _emitServiceEvent(eventName, data) {
        if (!this.eventBus) return;
        this.eventBus.emit(eventName, { ...data, source: 'MonitoringService' });
    }
    
    _emitStatsUpdate() { this.eventEmitter.emitStatsUpdate(); }
    
    _getSignalTowerStats() {
        const counts = { run: 0, idle: 0, stop: 0, suddenstop: 0, disconnected: 0 };
        if (this.signalTowerManager?.getStatusStatistics) {
            const stats = this.signalTowerManager.getStatusStatistics();
            counts.run = stats.RUN || 0; counts.idle = stats.IDLE || 0;
            counts.stop = stats.STOP || 0; counts.suddenstop = stats.SUDDENSTOP || 0;
            counts.disconnected = stats.DISCONNECTED || 0;
        }
        return counts;
    }
    
    _handleDataLoaderStatusUpdate(fid, data) { this._handleStatusUpdate(fid, data); }
    
    _handleStatusUpdate(frontendId, data) {
        const status = data.status || 'DISCONNECTED';
        const normalized = this.signalIntegration.normalizeStatus(status);
        this.statusCache.set(frontendId, { status: normalized, rawStatus: data.rawStatus || status, timestamp: new Date().toISOString(), ...data });
        this.updateEquipmentStatus(frontendId, normalized);
        this.notifyEquipmentInfoPanel(frontendId, data);
        this.updateStatusPanel();
    }
    
    // === WebSocket ===
    async connectWebSocket() {
        try {
            await this.wsManager.connect();
            setTimeout(() => this.sendSubscribeMessage(), 500);
            return true;
        } catch (e) { console.error('❌ WS failed:', e); return false; }
    }
    sendSubscribeMessage() { return this.wsManager.subscribe(); }
    sendSubscribeForNewMapping(eqId) { this._dataLoader?.subscribeEquipment?.(eqId); return this.wsManager.subscribeEquipment(eqId); }
    
    // === 초기 상태 로드 (레거시) ===
    async loadInitialStatus() {
        const data = await this.apiClient.fetchInitialStatus(this.staleThresholdHours);
        if (!data.equipment?.length) throw new Error('Invalid response');
        let connected = 0, disconnected = 0;
        data.equipment.forEach(item => {
            const fid = this.equipmentEditState?.getFrontendIdByEquipmentId(item.equipment_id);
            if (!fid) return;
            const status = (item.is_connected === false || item.status === null) ? 'DISCONNECTED' : item.status;
            this.signalIntegration.updateStatus(fid, status);
            this.statusCache.set(fid, status);
            status === 'DISCONNECTED' ? disconnected++ : connected++;
        });
        this.currentStats.connected = connected; this.currentStats.disconnected = disconnected;
        this.updateStatusPanel();
    }
    
    // === SignalTower (위임) ===
    updateEquipmentStatus(fid, status) { this.signalIntegration.updateStatus(fid, status, false); }
    normalizeStatus(status) { return this.signalIntegration.normalizeStatus(status); }
    applyUnmappedSignalTowerStyle() { this.signalIntegration.applyUnmappedSignalTowerStyle(); }
    applyUnmappedEquipmentStyle() {
        const r = this.signalIntegration.applyUnmappedEquipmentStyle();
        this.currentStats.mapped = r.mapped; this.currentStats.unmapped = r.unmapped;
        this.currentStats.total = r.mapped + r.unmapped;
        this.currentStats.rate = this.currentStats.total > 0 ? Math.round((r.mapped / this.currentStats.total) * 100) : 0;
    }
    resetEquipmentStyle() { this.signalIntegration.resetAllStyles(); }
    setDisabledOptions(opts) { this.disabledOptions = { ...this.disabledOptions, ...opts }; this.signalIntegration.setDisabledOptions(opts); if (this.isActive) { this.signalIntegration.applyUnmappedStyle(); this.updateStatusPanel(); } }
    
    // === 알림 ===
    notifyEquipmentInfoPanel(fid, data) {
        if (!this.equipmentInfoPanel || this.equipmentInfoPanel.currentEquipmentId !== fid) return;
        this.equipmentInfoPanel.updateFromMonitoring?.({ frontendId: fid, status: data.status, equipmentId: data.equipment_id, timestamp: data.timestamp, ...data });
    }
    
    // === 유틸리티 ===
    getMappedEquipmentIds() { return this.equipmentEditState?.getAllEquipmentIds?.() || []; }
    isEquipmentMapped(fid) { return this.signalIntegration.isEquipmentMapped(fid); }
    
    startBatchProcessing() {
        if (this.batchTimer) return;
        this.batchTimer = setInterval(() => this.processBatch(), this.batchInterval);
    }
    
    processBatch() {
        if (this.updateQueue.length === 0) return;
        const updates = [...this.updateQueue]; this.updateQueue = [];
        updates.forEach(u => this.updateEquipmentStatus(u.frontendId, u.status));
        if (updates.length > 0) this._emitStatsUpdate();
    }
    
    queueUpdate(fid, status) { this.updateQueue.push({ frontendId: fid, status }); }
    
    getEquipmentStatus(fid) {
        const uds = this.getEquipmentFromUDS(fid);
        if (uds) return uds.status;
        const loader = this._dataLoader?.getCachedStatus?.(fid);
        if (loader) return loader;
        return this.statusCache.get(fid);
    }
    
    getAllStatuses() {
        if (this._udsInitialized || this.udsIntegration.isInitialized()) {
            const statuses = {};
            this.udsIntegration.getAllEquipments().forEach(eq => { if (eq.frontend_id) statuses[eq.frontend_id] = eq.status; });
            return statuses;
        }
        return { ...Object.fromEntries(this.statusCache), ...(this._dataLoader?.getAllCachedStatuses?.() || {}) };
    }
    
    getConnectionStatus() {
        const uds = this.getUnifiedDataStore();
        return {
            isActive: this.isActive, isStarting: this._isStarting, isStopping: this._isStopping,
            udsEnabled: this._udsEnabled, udsInitialized: this._udsInitialized,
            wsConnected: this.wsManager?.isConnected() || false, cacheSize: this.statusCache.size,
            stats: this.getStats(),
            udsCache: this._udsInitialized && uds ? { size: uds.getAllEquipments?.().length || 0 } : null
        };
    }
    
    _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
    checkAndNotifyUnmapped(fid) { if (!this.isActive) return true; if (!this.isEquipmentMapped(fid)) { this.showUnmappedNotification(fid); return false; } return true; }
    showUnmappedNotification(fid) { this.showToast(`⚠️ "${fid}"는 DB에 연결되지 않았습니다.`, 'warning', 5000); }
    
    showToast(message, type = 'info', duration = 5000) {
        if (window.toast?.show) { window.toast.show(message.replace(/\n/g, ' '), type); return; }
        let container = document.getElementById('toast-container');
        if (!container) { container = document.createElement('div'); container.id = 'toast-container'; container.className = 'toast-container'; document.body.appendChild(container); }
        const toast = document.createElement('div'); toast.className = `toast toast-${type}`; toast.innerHTML = message.replace(/\n/g, '<br>');
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)'; setTimeout(() => toast.remove(), 300); }, duration);
    }
    
    // === 정리 ===
    dispose() {
        this.stop();
        this._unsubscribeFromUDSEvents();
        this.udsIntegration?.dispose();
        this.getUnifiedDataStore()?.dispose?.();
        this._dataLoader?.dispose(); this._dataLoader = null;
        this.eventHandler?.dispose();
        this.signalIntegration?.dispose();
        this.eventEmitter?.dispose();
        this.signalTowerManager = null; this.equipmentLoader = null;
        this.equipmentEditState = null; this.equipmentInfoPanel = null;
        this.eventBus = null; this.statusCache.clear();
        debugLog('🗑️ MonitoringService disposed');
    }
    
    static get VERSION() { return '6.0.0'; }
    static get Events() { return MonitoringServiceEvents; }
}

export default MonitoringService;