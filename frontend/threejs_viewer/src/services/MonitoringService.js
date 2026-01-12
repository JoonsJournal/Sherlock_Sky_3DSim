/**
 * MonitoringService.js - v4.5.1
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ v4.5.1: StatusBar 연동을 위한 monitoring:stats-update 이벤트 발행 (2026-01-12)
 * - _emitStatsUpdate() 메서드 추가
 * - 상태 변경 시 EventBus로 상태별 카운트 발행
 * - StatusBar Monitoring Stats Panel 실시간 업데이트 지원
 * 
 * ⭐ v4.5.0: MappingEventHandler 모듈 분리 (Phase 7 리팩토링)
 * - 이벤트 리스너 관련 로직을 MappingEventHandler로 위임
 * - registerEventListeners() → eventHandler.register() 위임
 * - unregisterEventListeners() → eventHandler.unregister() 위임
 * - handleMappingChanged() → eventHandler._handleMappingChanged() 위임
 * - 기존 모든 기능 100% 호환성 유지
 * 
 * ⭐ v4.4.0: SignalTowerIntegration 모듈 분리 (Phase 6 리팩토링)
 * ⭐ v4.3.0: MonitoringStatsPanel 모듈 분리 (Phase 5 리팩토링)
 * ⭐ v4.2.0: WebSocketManager 모듈 분리 (Phase 4 리팩토링)
 * ⭐ v4.1.0: StatusAPIClient 모듈 분리 (Phase 3 리팩토링)
 * ⭐ v4.0.1: 선택된 설비만 EquipmentInfoPanel 업데이트 (버그 수정)
 * ⭐ v4.0.0: PC Info Tab 확장 - Memory, Disk 필드 추가
 * ⭐ v3.4.0: Lot Active/Inactive 분기 지원
 * ⭐ v3.3.0: EquipmentInfoPanel 실시간 업데이트 연동
 * ⭐ v3.2.0: equipment_id 기반 매핑 조회로 변경
 * ⭐ v3.1.0: 24시간 기준 초기 상태 로드 + DISCONNECTED 처리
 * ⭐ v3.0.0: SignalTower 연동 강화
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/MonitoringService.js
 */

import { debugLog } from '../core/utils/Config.js';

// ⭐ v4.1.0: StatusAPIClient 모듈 import
import { StatusAPIClient } from './monitoring/StatusAPIClient.js';

// ⭐ v4.2.0: WebSocketManager 모듈 import
import { WebSocketManager, ConnectionState } from './monitoring/WebSocketManager.js';

// ⭐ v4.3.0: MonitoringStatsPanel 모듈 import
import { MonitoringStatsPanel } from './monitoring/MonitoringStatsPanel.js';

// ⭐ v4.4.0: SignalTowerIntegration 모듈 import
import { SignalTowerIntegration } from './monitoring/SignalTowerIntegration.js';

// ⭐ v4.5.0: MappingEventHandler 모듈 import
import { MappingEventHandler } from './monitoring/MappingEventHandler.js';

export class MonitoringService {
    constructor(signalTowerManager, equipmentLoader = null, equipmentEditState = null) {
        this.signalTowerManager = signalTowerManager;
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        
        // ⭐ v4.1.0: StatusAPIClient 인스턴스 생성
        this.apiBaseUrl = 'http://localhost:8000/api/monitoring';
        this.apiClient = new StatusAPIClient(this.apiBaseUrl);
        
        // ⭐ v4.2.0: WebSocket URL (레거시 호환성)
        this.wsUrl = 'ws://localhost:8000/api/monitoring/stream';
        
        // ⭐ v4.2.0: WebSocketManager 인스턴스 생성
        this.wsManager = new WebSocketManager(this.wsUrl, {
            maxReconnectAttempts: 5,
            reconnectDelay: 3000,
            debug: false,
            onStatusUpdate: (frontendId, data) => this._handleStatusUpdate(frontendId, data),
            onConnected: (message) => debugLog(`📡 WebSocket connected: ${message}`),
            onSubscribed: (message) => debugLog(`📡 WebSocket subscribed: ${message}`),
            onReconnecting: (attempt, max) => debugLog(`🔄 Reconnecting... (${attempt}/${max})`),
            onDisconnected: () => debugLog('🔌 WebSocket disconnected'),
            onError: (error) => console.error('❌ WebSocket error:', error),
            getEquipmentIds: () => this.getMappedEquipmentIds(),
            getFrontendId: (equipmentId) => this.equipmentEditState?.getFrontendIdByEquipmentId(equipmentId)
        });
        
        // ⭐ v4.4.0: SignalTowerIntegration 인스턴스 생성
        this.signalIntegration = new SignalTowerIntegration(
            this.signalTowerManager,
            this.equipmentLoader,
            this.equipmentEditState,
            { debug: false }
        );
        
        // ⭐ v4.3.0: MonitoringStatsPanel 인스턴스 생성
        this.statsPanel = new MonitoringStatsPanel({
            signalTowerManager: this.signalTowerManager,
            debug: false
        });
        
        // ⭐ v4.5.0: MappingEventHandler 인스턴스 생성
        this.eventHandler = new MappingEventHandler({
            signalIntegration: this.signalIntegration,
            apiClient: this.apiClient,
            wsManager: this.wsManager,
            onUpdate: () => this.updateStatusPanel(),
            showToast: (msg, type) => this.showToast(msg, type),
            cacheStatus: (frontendId, status) => {
                if (status === null) {
                    this.statusCache.delete(frontendId);
                } else {
                    this.statusCache.set(frontendId, status);
                }
            }
        }, { debug: false });
        
        // ⭐ v4.2.0: 레거시 호환성 - ws 참조 (deprecated)
        this._ws = null;
        
        this.isActive = false;
        
        // ⭐ v4.2.0: 레거시 호환성
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        this.statusCache = new Map();
        this.updateQueue = [];
        this.batchInterval = 1000;
        this.batchTimer = null;
        
        // ⭐ v3.1.0: DISCONNECTED 판별 기준 시간 (시간 단위)
        this.staleThresholdHours = 24;
        
        // ⭐ v4.4.0: 레거시 호환성 - disabledOptions (deprecated, use signalIntegration)
        this.disabledOptions = {
            grayColor: 0x444444
        };
        
        // ⭐ v4.3.0: 레거시 호환성 - statusPanelElement (deprecated)
        this.statusPanelElement = null;
        
        // ⭐ v4.3.0: 레거시 호환성 - currentStats (deprecated)
        this.currentStats = {
            total: 0,
            mapped: 0,
            unmapped: 0,
            rate: 0,
            connected: 0,
            disconnected: 0
        };
        
        // ⭐ v3.0.0: EventBus 참조 (있으면 사용)
        this.eventBus = null;
        
        // ⭐ v3.3.0: EquipmentInfoPanel 참조
        this.equipmentInfoPanel = null;
        
        // ⭐ v4.5.0: 레거시 호환성 - 이벤트 핸들러 바인딩 (deprecated)
        this._boundHandleMappingChanged = (e) => this.eventHandler._handleMappingEvent(e);
        
        debugLog('📡 MonitoringService v4.5.1 initialized (with StatusBar events)');
    }
    
    // ===============================================
    // ⭐ v4.2.0: 레거시 호환성 - ws getter/setter
    // ===============================================
    
    get ws() {
        return this.wsManager?.ws || this._ws;
    }
    
    set ws(value) {
        this._ws = value;
    }
    
    // ===============================================
    // 의존성 설정
    // ===============================================
    
    setDependencies(equipmentLoader, equipmentEditState, eventBus = null) {
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        this.eventBus = eventBus;
        
        // ⭐ v4.4.0: SignalTowerIntegration에도 전달
        this.signalIntegration.setDependencies(equipmentLoader, equipmentEditState);
        
        debugLog('MonitoringService dependencies set');
    }
    
    setEquipmentInfoPanel(equipmentInfoPanel) {
        this.equipmentInfoPanel = equipmentInfoPanel;
        debugLog('🔗 EquipmentInfoPanel connected to MonitoringService');
    }
    
    setSignalTowerManager(manager) {
        this.signalTowerManager = manager;
        // ⭐ v4.4.0: SignalTowerIntegration에도 전달
        this.signalIntegration.setSignalTowerManager(manager);
        // ⭐ v4.3.0: StatsPanel에도 전달
        this.statsPanel.setSignalTowerManager(manager);
        debugLog('📡 MonitoringService: SignalTowerManager 연결됨');
    }
    
    setEquipmentEditState(state) {
        this.equipmentEditState = state;
        // ⭐ v4.4.0: SignalTowerIntegration에도 전달
        this.signalIntegration.setEquipmentEditState(state);
        debugLog('📡 MonitoringService: EquipmentEditState 연결됨');
    }
    
    setEquipmentLoader(loader) {
        this.equipmentLoader = loader;
        // ⭐ v4.4.0: SignalTowerIntegration에도 전달
        this.signalIntegration.setEquipmentLoader(loader);
        debugLog('📡 MonitoringService: EquipmentLoader 연결됨');
    }
    
    setStaleThreshold(hours) {
        if (hours >= 1 && hours <= 168) {
            this.staleThresholdHours = hours;
            debugLog(`⏱️ Stale threshold set to ${hours} hours`);
        } else {
            console.warn(`⚠️ Invalid threshold: ${hours}. Must be 1-168 hours.`);
        }
    }
    
    // ===============================================
    // ⭐ v4.2.0: URL 설정
    // ===============================================
    
    setWsUrl(wsUrl) {
        this.wsUrl = wsUrl;
        if (this.wsManager && !this.wsManager.isConnected()) {
            this.wsManager.setUrl(wsUrl);
        }
        debugLog(`📡 WebSocket URL updated: ${wsUrl}`);
    }
    
    setApiBaseUrl(baseUrl) {
        this.apiBaseUrl = baseUrl;
        if (this.apiClient) {
            this.apiClient.setBaseUrl(baseUrl);
        }
        debugLog(`📡 API Base URL updated: ${baseUrl}`);
    }
    
    // ===============================================
    // 모듈 접근자
    // ===============================================
    
    getApiClient() {
        return this.apiClient;
    }
    
    getWebSocketManager() {
        return this.wsManager;
    }
    
    getStatsPanel() {
        return this.statsPanel;
    }
    
    getSignalIntegration() {
        return this.signalIntegration;
    }
    
    /**
     * ⭐ v4.5.0: MappingEventHandler 인스턴스 조회
     * @returns {MappingEventHandler}
     */
    getEventHandler() {
        return this.eventHandler;
    }
    
    // ===============================================
    // 모니터링 시작/중지
    // ===============================================
    
    async start() {
        if (this.isActive) {
            debugLog('⚠️ Monitoring already active');
            return;
        }
        
        debugLog('🟢 Starting monitoring mode (v4.5.1)...');
        this.isActive = true;
        
        try {
            // 1️⃣ SignalTower 모든 램프 초기화 (OFF 상태)
            this.signalIntegration.initializeAllLights();
            debugLog('🚨 Step 1: SignalTower lights initialized (all OFF)');
            
            // 2️⃣ 미매핑 설비 처리
            const applyResult = this.signalIntegration.applyUnmappedStyle();
            this.currentStats.mapped = applyResult.mapped;
            this.currentStats.unmapped = applyResult.unmapped;
            this.currentStats.total = applyResult.total;
            this.currentStats.rate = applyResult.rate;
            debugLog('🌫️ Step 2: Unmapped equipment styled');
            
            // 3️⃣ 통계 패널 표시
            this.createStatusPanel();
            debugLog('📊 Step 3: Status panel created');
            
            // 4️⃣ REST API로 초기 상태 로드 (24시간 기준)
            await this.loadInitialStatus().catch(err => {
                debugLog(`⚠️ Step 4: loadInitialStatus failed: ${err.message}`);
            });
            debugLog('📡 Step 4: Initial status loaded');
            
            // 5️⃣ WebSocket 연결 + Subscribe
            await this.connectWebSocket();
            debugLog('🔌 Step 5: WebSocket connecting...');
            
            // 6️⃣ 배치 처리 타이머 시작
            this.startBatchProcessing();
            debugLog('⏱️ Step 6: Batch processing started');
            
            // 7️⃣ 이벤트 리스너 등록 (새 매핑 감지)
            // ⭐ v4.5.0: MappingEventHandler 사용
            this.registerEventListeners();
            debugLog('📡 Step 7: Event listeners registered');
            
            // 🆕 v4.5.1: 초기 상태 발행
            this._emitStatsUpdate();
            
            debugLog('✅ Monitoring mode started successfully (v4.5.1)');
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error);
        }
    }
    
    stop() {
        debugLog('🔴 Stopping monitoring mode...');
        this.isActive = false;
        
        // 1. 이벤트 리스너 해제
        // ⭐ v4.5.0: MappingEventHandler 사용
        this.unregisterEventListeners();
        
        // 2. 비활성화 표시 해제
        this.resetEquipmentStyle();
        
        // 3. 통계 패널 제거
        this.removeStatusPanel();
        
        // 4. WebSocket 연결 종료
        if (this.wsManager) {
            this.wsManager.disconnect();
        }
        
        // 5. 배치 처리 타이머 중지
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        
        debugLog('✅ Monitoring mode stopped');
    }
    
    // ===============================================
    // ⭐ v4.5.0: 이벤트 리스너 관리 (위임)
    // ===============================================
    
    /**
     * 이벤트 리스너 등록 (레거시 호환성 유지)
     */
    registerEventListeners() {
        debugLog('📡 registerEventListeners() → eventHandler.register()');
        this.eventHandler.register(this.eventBus);
    }
    
    /**
     * 이벤트 리스너 해제 (레거시 호환성 유지)
     */
    unregisterEventListeners() {
        debugLog('📡 unregisterEventListeners() → eventHandler.unregister()');
        this.eventHandler.unregister();
    }
    
    /**
     * 매핑 변경 이벤트 핸들러 (레거시 호환성 유지)
     * @deprecated v4.5.0부터 eventHandler._handleMappingEvent() 사용
     */
    async handleMappingChanged(eventOrData) {
        debugLog('⚠️ handleMappingChanged() → eventHandler._handleMappingEvent()');
        return this.eventHandler._handleMappingEvent(eventOrData);
    }
    
    async fetchSingleEquipmentStatus(frontendId) {
        return this.apiClient.fetchEquipmentLiveStatus?.(frontendId) || null;
    }
    
    // ===============================================
    // ⭐ v4.3.0: 통계 패널 관리 (위임)
    // ===============================================
    
    createStatusPanel() {
        this.updateStats();
        this.statsPanel.create(this.currentStats);
        this.statusPanelElement = this.statsPanel.element;
    }
    
    updateStatusPanel() {
        this.statsPanel.refresh(this.equipmentLoader, this.equipmentEditState);
        this.currentStats = this.statsPanel.getStats();
        
        // 🆕 v4.5.1: StatusBar로 이벤트 발행
        this._emitStatsUpdate();
    }
    
    removeStatusPanel() {
        this.statsPanel.remove();
        this.statusPanelElement = null;
    }
    
    getStats() {
        this.updateStats();
        return { ...this.currentStats };
    }
    
    updateStats() {
        if (!this.equipmentLoader || !this.equipmentEditState) {
            return;
        }
        this.currentStats = this.statsPanel.calculateStats(
            this.equipmentLoader,
            this.equipmentEditState
        );
    }
    
    // ===============================================
    // 🆕 v4.5.1: StatusBar 이벤트 발행
    // ===============================================
    
    /**
     * 🆕 v4.5.1: monitoring:stats-update 이벤트 발행
     * StatusBar Monitoring Stats Panel 실시간 업데이트용
     */
    _emitStatsUpdate() {
        if (!this.eventBus) return;
        
        // 상태별 카운트 계산
        const statusCounts = this._calculateStatusCounts();
        
        // 이벤트 발행
        this.eventBus.emit('monitoring:stats-update', {
            statusCounts: statusCounts,
            total: this.currentStats.total,
            mapped: this.currentStats.mapped,
            unmapped: this.currentStats.unmapped,
            mappingRate: this.currentStats.rate,
            timestamp: new Date().toISOString()
        });
        
        debugLog(`📡 monitoring:stats-update 발행 - RUN:${statusCounts.run}, IDLE:${statusCounts.idle}, STOP:${statusCounts.stop}, UNKNOWN:${statusCounts.unknown}`);
    }
    
    /**
     * 🆕 v4.5.1: 상태별 카운트 계산
     * @returns {{run: number, idle: number, stop: number, unknown: number}}
     */
    _calculateStatusCounts() {
        const counts = {
            run: 0,
            idle: 0,
            stop: 0,
            unknown: 0
        };
        
        // SignalTowerManager에서 상태 카운트
        if (this.signalTowerManager?.signalTowers) {
            this.signalTowerManager.signalTowers.forEach((tower, frontendId) => {
                const status = tower.currentStatus || 'UNKNOWN';
                const normalizedStatus = this.normalizeStatus(status);
                
                switch (normalizedStatus) {
                    case 'RUN':
                        counts.run++;
                        break;
                    case 'IDLE':
                        counts.idle++;
                        break;
                    case 'STOP':
                        counts.stop++;
                        break;
                    default:
                        counts.unknown++;
                        break;
                }
            });
        }
        
        // statusCache에서도 확인 (SignalTower가 없는 경우)
        if (counts.run + counts.idle + counts.stop + counts.unknown === 0) {
            this.statusCache.forEach((cachedData, frontendId) => {
                const status = typeof cachedData === 'string' ? cachedData : cachedData?.status;
                const normalizedStatus = this.normalizeStatus(status);
                
                switch (normalizedStatus) {
                    case 'RUN':
                        counts.run++;
                        break;
                    case 'IDLE':
                        counts.idle++;
                        break;
                    case 'STOP':
                        counts.stop++;
                        break;
                    default:
                        counts.unknown++;
                        break;
                }
            });
        }
        
        return counts;
    }
    
    // ===============================================
    // ⭐ v4.2.0: WebSocket 연결 (위임)
    // ===============================================
    
    async connectWebSocket() {
        try {
            await this.wsManager.connect();
            setTimeout(() => {
                this.sendSubscribeMessage();
            }, 500);
            return true;
        } catch (error) {
            console.error('❌ WebSocket connection failed:', error);
            return false;
        }
    }
    
    sendSubscribeMessage() {
        return this.wsManager.subscribe();
    }
    
    sendSubscribeForNewMapping(equipmentId) {
        return this.wsManager.subscribeEquipment(equipmentId);
    }
    
    // ===============================================
    // ⭐ v4.2.0: 상태 업데이트 처리 (콜백)
    // ===============================================
    
    _handleStatusUpdate(frontendId, data) {
        const status = data.status || 'DISCONNECTED';
        const normalizedStatus = this.signalIntegration.normalizeStatus(status);
        
        debugLog(`📊 Status update: ${frontendId} → ${normalizedStatus}`);
        
        // 캐시 업데이트
        this.statusCache.set(frontendId, {
            status: normalizedStatus,
            rawStatus: status,
            timestamp: new Date().toISOString(),
            ...data
        });
        
        // SignalTower 업데이트
        this.updateEquipmentStatus(frontendId, normalizedStatus);
        
        // EquipmentInfoPanel 알림
        this.notifyEquipmentInfoPanel(frontendId, data);
        
        // 통계 패널 업데이트 (🆕 v4.5.1: 이벤트 발행 포함)
        this.updateStatusPanel();
    }
    
    // ===============================================
    // ⭐ v4.1.0: 초기 상태 로드 (StatusAPIClient 사용)
    // ===============================================
    
    async loadInitialStatus() {
        debugLog(`📡 Loading initial equipment status (threshold: ${this.staleThresholdHours}h)...`);
        
        const data = await this.apiClient.fetchInitialStatus(this.staleThresholdHours);
        
        if (!data.equipment || !Array.isArray(data.equipment)) {
            throw new Error('Invalid response format');
        }
        
        debugLog(`✅ Loaded ${data.equipment.length} equipment status from /status/initial`);
        
        let connectedCount = 0;
        let disconnectedCount = 0;
        let skippedCount = 0;
        
        data.equipment.forEach(item => {
            const frontendId = this.equipmentEditState?.getFrontendIdByEquipmentId(item.equipment_id);
            
            if (!frontendId) {
                skippedCount++;
                return;
            }
            
            if (item.is_connected === false || item.status === null) {
                this.signalIntegration.updateStatus(frontendId, 'DISCONNECTED');
                this.statusCache.set(frontendId, 'DISCONNECTED');
                disconnectedCount++;
            } else {
                this.signalIntegration.updateStatus(frontendId, item.status);
                this.statusCache.set(frontendId, item.status);
                connectedCount++;
            }
        });
        
        // 통계 업데이트
        this.currentStats.connected = connectedCount;
        this.currentStats.disconnected = disconnectedCount;
        
        debugLog(`✅ Initial status applied: ${connectedCount} connected, ${disconnectedCount} disconnected, ${skippedCount} skipped`);
        
        // 패널 업데이트 (🆕 v4.5.1: 이벤트 발행 포함)
        this.updateStatusPanel();
    }
    
    // ===============================================
    // ⭐ v4.4.0: 설비 상태 업데이트 (위임)
    // ===============================================
    
    updateEquipmentStatus(frontendId, status) {
        this.signalIntegration.updateStatus(frontendId, status, false);
    }
    
    normalizeStatus(status) {
        return this.signalIntegration.normalizeStatus(status);
    }
    
    // ===============================================
    // ⭐ v4.4.0: SignalTower 미매핑 설비 처리 (위임)
    // ===============================================
    
    applyUnmappedSignalTowerStyle() {
        this.signalIntegration.applyUnmappedSignalTowerStyle();
    }
    
    applyUnmappedEquipmentStyle() {
        const result = this.signalIntegration.applyUnmappedEquipmentStyle();
        
        this.currentStats.mapped = result.mapped;
        this.currentStats.unmapped = result.unmapped;
        this.currentStats.total = result.mapped + result.unmapped;
        this.currentStats.rate = this.currentStats.total > 0
            ? Math.round((result.mapped / this.currentStats.total) * 100)
            : 0;
    }
    
    resetEquipmentStyle() {
        this.signalIntegration.resetAllStyles();
    }
    
    setDisabledOptions(options) {
        this.disabledOptions = { ...this.disabledOptions, ...options };
        this.signalIntegration.setDisabledOptions(options);
        
        if (this.isActive) {
            this.signalIntegration.applyUnmappedStyle();
            this.updateStatusPanel();
        }
    }
    
    // ===============================================
    // EquipmentInfoPanel 알림
    // ===============================================
    
    notifyEquipmentInfoPanel(frontendId, data) {
        if (!this.equipmentInfoPanel) return;
        
        const currentSelectedId = this.equipmentInfoPanel.currentEquipmentId;
        if (currentSelectedId !== frontendId) {
            return;
        }
        
        this.equipmentInfoPanel.updateFromMonitoring?.({
            frontendId,
            status: data.status,
            equipmentId: data.equipment_id,
            timestamp: data.timestamp,
            ...data
        });
    }
    
    // ===============================================
    // 매핑된 설비 ID 조회
    // ===============================================
    
    getMappedEquipmentIds() {
        if (!this.equipmentEditState) {
            return [];
        }
        return this.equipmentEditState.getAllEquipmentIds?.() || [];
    }
    
    isEquipmentMapped(frontendId) {
        return this.signalIntegration.isEquipmentMapped(frontendId);
    }
    
    // ===============================================
    // Batch 처리
    // ===============================================
    
    startBatchProcessing() {
        if (this.batchTimer) return;
        
        this.batchTimer = setInterval(() => {
            this.processBatch();
        }, this.batchInterval);
        
        debugLog(`📡 Batch processing started (interval: ${this.batchInterval}ms)`);
    }
    
    processBatch() {
        if (this.updateQueue.length === 0) return;
        
        const updates = [...this.updateQueue];
        this.updateQueue = [];
        
        for (const update of updates) {
            this.updateEquipmentStatus(update.frontendId, update.status);
        }
        
        debugLog(`📡 Batch processed: ${updates.length} updates`);
        
        // 🆕 v4.5.1: 배치 처리 후 이벤트 발행
        if (updates.length > 0) {
            this._emitStatsUpdate();
        }
    }
    
    queueUpdate(frontendId, status) {
        this.updateQueue.push({ frontendId, status });
    }
    
    // ===============================================
    // 상태 조회
    // ===============================================
    
    getEquipmentStatus(frontendId) {
        return this.statusCache.get(frontendId);
    }
    
    getAllStatuses() {
        return Object.fromEntries(this.statusCache);
    }
    
    getConnectionStatus() {
        return {
            isActive: this.isActive,
            wsManager: this.wsManager?.getStatus() || null,
            wsConnected: this.wsManager?.isConnected() || false,
            reconnectAttempts: this.wsManager?.getReconnectAttempts() || 0,
            cacheSize: this.statusCache.size,
            queueSize: this.updateQueue.length,
            stats: this.getStats(),
            signalIntegration: this.signalIntegration?.getStatus() || null,
            // ⭐ v4.5.0: MappingEventHandler 상태 추가
            eventHandler: this.eventHandler?.getStatus() || null
        };
    }
    
    // ===============================================
    // 유틸리티
    // ===============================================
    
    checkAndNotifyUnmapped(frontendId) {
        if (!this.isActive) return true;
        
        if (!this.isEquipmentMapped(frontendId)) {
            this.showUnmappedNotification(frontendId);
            return false;
        }
        
        return true;
    }
    
    showUnmappedNotification(frontendId) {
        this.showToast(
            `⚠️ "${frontendId}"는 DB에 연결되지 않았습니다. Edit Mode (E키)에서 매핑해주세요.`,
            'warning',
            5000
        );
    }
    
    showToast(message, type = 'info', duration = 5000) {
        if (window.toast?.show) {
            window.toast.show(message.replace(/\n/g, ' '), type);
            return;
        }
        
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = message.replace(/\n/g, '<br>');
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // ===============================================
    // 리소스 정리
    // ===============================================
    
    dispose() {
        this.stop();
        
        // ⭐ v4.5.0: MappingEventHandler 정리
        this.eventHandler?.dispose();
        
        // ⭐ v4.4.0: SignalTowerIntegration 정리
        this.signalIntegration?.dispose();
        
        // ⭐ v4.3.0: StatsPanel 정리
        this.statsPanel?.dispose();
        
        this.signalTowerManager = null;
        this.equipmentLoader = null;
        this.equipmentEditState = null;
        this.equipmentInfoPanel = null;
        this.eventBus = null;
        this.statusCache.clear();
        
        debugLog('🗑️ MonitoringService disposed');
    }
}

export default MonitoringService;