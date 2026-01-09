/**
 * MonitoringService.js - v4.4.0
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ v4.4.0: SignalTowerIntegration 모듈 분리 (Phase 6 리팩토링)
 * - SignalTower 및 설비 스타일 관리 로직을 SignalTowerIntegration으로 위임
 * - applyUnmappedSignalTowerStyle() → signalIntegration.applyUnmappedSignalTowerStyle() 위임
 * - applyUnmappedEquipmentStyle() → signalIntegration.applyUnmappedEquipmentStyle() 위임
 * - resetEquipmentStyle() → signalIntegration.resetAllStyles() 위임
 * - updateEquipmentStatus() → signalIntegration.updateStatus() 위임
 * - normalizeStatus() → signalIntegration.normalizeStatus() 위임
 * - 기존 모든 기능 100% 호환성 유지
 * 
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
        
        // ⭐ v3.0.0: 이벤트 핸들러 바인딩 (제거 시 필요)
        this._boundHandleMappingChanged = this.handleMappingChanged.bind(this);
        
        debugLog('📡 MonitoringService v4.4.0 initialized (with SignalTowerIntegration)');
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
    
    /**
     * ⭐ v4.4.0: SignalTowerIntegration 인스턴스 조회
     * @returns {SignalTowerIntegration}
     */
    getSignalIntegration() {
        return this.signalIntegration;
    }
    
    // ===============================================
    // 모니터링 시작/중지
    // ===============================================
    
    async start() {
        if (this.isActive) {
            debugLog('⚠️ Monitoring already active');
            return;
        }
        
        debugLog('🟢 Starting monitoring mode (v4.4.0)...');
        this.isActive = true;
        
        try {
            // 1️⃣ SignalTower 모든 램프 초기화 (OFF 상태)
            // ⭐ v4.4.0: SignalTowerIntegration 사용
            this.signalIntegration.initializeAllLights();
            debugLog('🚨 Step 1: SignalTower lights initialized (all OFF)');
            
            // 2️⃣ 미매핑 설비 처리
            // ⭐ v4.4.0: SignalTowerIntegration 사용
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
            this.registerEventListeners();
            debugLog('📡 Step 7: Event listeners registered');
            
            debugLog('✅ Monitoring mode started successfully (v4.4.0)');
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error);
        }
    }
    
    stop() {
        debugLog('🔴 Stopping monitoring mode...');
        this.isActive = false;
        
        // 1. 이벤트 리스너 해제
        this.unregisterEventListeners();
        
        // 2. 비활성화 표시 해제
        // ⭐ v4.4.0: SignalTowerIntegration 사용
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
        // ⭐ v4.4.0: SignalTowerIntegration 사용
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
        // ⭐ v4.4.0: SignalTowerIntegration 사용
        this.updateEquipmentStatus(frontendId, normalizedStatus);
        
        // EquipmentInfoPanel 알림
        this.notifyEquipmentInfoPanel(frontendId, data);
        
        // 통계 패널 업데이트
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
                // ⭐ v4.4.0: SignalTowerIntegration 사용
                this.signalIntegration.updateStatus(frontendId, 'DISCONNECTED');
                this.statusCache.set(frontendId, 'DISCONNECTED');
                disconnectedCount++;
            } else {
                // ⭐ v4.4.0: SignalTowerIntegration 사용
                this.signalIntegration.updateStatus(frontendId, item.status);
                this.statusCache.set(frontendId, item.status);
                connectedCount++;
            }
        });
        
        // 통계 업데이트
        this.currentStats.connected = connectedCount;
        this.currentStats.disconnected = disconnectedCount;
        
        debugLog(`✅ Initial status applied: ${connectedCount} connected, ${disconnectedCount} disconnected, ${skippedCount} skipped`);
        
        // 패널 업데이트
        this.updateStatusPanel();
    }
    
    // ===============================================
    // ⭐ v4.4.0: 설비 상태 업데이트 (위임)
    // ===============================================
    
    /**
     * 설비 상태 업데이트 (레거시 호환성 유지)
     */
    updateEquipmentStatus(frontendId, status) {
        this.signalIntegration.updateStatus(frontendId, status, false);  // 이미 정규화됨
    }
    
    /**
     * 상태 정규화 (레거시 호환성 유지)
     */
    normalizeStatus(status) {
        return this.signalIntegration.normalizeStatus(status);
    }
    
    // ===============================================
    // ⭐ v4.4.0: SignalTower 미매핑 설비 처리 (위임)
    // ===============================================
    
    /**
     * 미매핑 SignalTower 램프 DISABLED 처리 (레거시 호환성 유지)
     */
    applyUnmappedSignalTowerStyle() {
        this.signalIntegration.applyUnmappedSignalTowerStyle();
    }
    
    /**
     * 미매핑 설비 모델 회색 처리 (레거시 호환성 유지)
     */
    applyUnmappedEquipmentStyle() {
        const result = this.signalIntegration.applyUnmappedEquipmentStyle();
        
        // 레거시 호환성 - currentStats 업데이트
        this.currentStats.mapped = result.mapped;
        this.currentStats.unmapped = result.unmapped;
        this.currentStats.total = result.mapped + result.unmapped;
        this.currentStats.rate = this.currentStats.total > 0
            ? Math.round((result.mapped / this.currentStats.total) * 100)
            : 0;
    }
    
    /**
     * 모든 설비 스타일 초기화 (레거시 호환성 유지)
     */
    resetEquipmentStyle() {
        this.signalIntegration.resetAllStyles();
    }
    
    /**
     * 비활성화 옵션 설정 (레거시 호환성 유지)
     */
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
        // ⭐ v4.4.0: SignalTowerIntegration 사용
        return this.signalIntegration.isEquipmentMapped(frontendId);
    }
    
    // ===============================================
    // 이벤트 리스너
    // ===============================================
    
    registerEventListeners() {
        if (this.eventBus) {
            this.eventBus.on('mapping-changed', this._boundHandleMappingChanged);
            this.eventBus.on('mapping-created', this._boundHandleMappingChanged);
        }
        
        window.addEventListener('mapping-changed', this._boundHandleMappingChanged);
        window.addEventListener('mapping-created', this._boundHandleMappingChanged);
        debugLog('📡 Event listeners registered');
    }
    
    unregisterEventListeners() {
        if (this.eventBus) {
            this.eventBus.off('mapping-changed', this._boundHandleMappingChanged);
            this.eventBus.off('mapping-created', this._boundHandleMappingChanged);
        }
        
        window.removeEventListener('mapping-changed', this._boundHandleMappingChanged);
        window.removeEventListener('mapping-created', this._boundHandleMappingChanged);
        debugLog('📡 Event listeners unregistered');
    }
    
    async handleMappingChanged(eventOrData) {
        const data = eventOrData.detail || eventOrData;
        const { frontendId, equipmentId, equipment_id } = data;
        const eqId = equipmentId || equipment_id;
        
        if (!frontendId) {
            debugLog('⚠️ Invalid mapping-changed event data');
            return;
        }
        
        debugLog(`🆕 New mapping detected: ${frontendId} -> equipment_id: ${eqId}`);
        
        try {
            // ⭐ v4.4.0: SignalTowerIntegration 사용
            this.signalIntegration.restoreEquipmentFullStyle(frontendId);
            
            const status = await this.fetchSingleEquipmentStatus(frontendId);
            
            if (status) {
                // ⭐ v4.4.0: SignalTowerIntegration 사용
                this.signalIntegration.updateStatus(frontendId, status);
                this.statusCache.set(frontendId, status);
            }
            
            if (eqId) {
                this.sendSubscribeForNewMapping(eqId);
            }
            
            this.updateStatusPanel();
            this.showToast(`✅ ${frontendId} 연결됨 (Status: ${status || 'Unknown'})`, 'success');
            
        } catch (error) {
            console.error(`❌ Failed to handle new mapping for ${frontendId}:`, error);
            this.showToast(`⚠️ ${frontendId} 연결 처리 실패`, 'error');
        }
    }
    
    async fetchSingleEquipmentStatus(frontendId) {
        return this.apiClient.fetchEquipmentLiveStatus?.(frontendId) || null;
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
            // ⭐ v4.4.0: SignalTowerIntegration 상태 추가
            signalIntegration: this.signalIntegration?.getStatus() || null
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