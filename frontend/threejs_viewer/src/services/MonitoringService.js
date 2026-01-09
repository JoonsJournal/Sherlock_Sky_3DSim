/**
 * MonitoringService.js - v4.2.0
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ v4.2.0: WebSocketManager 모듈 분리 (Phase 4 리팩토링)
 * - WebSocket 연결/재연결 로직을 WebSocketManager로 위임
 * - connectWebSocket() → wsManager.connect() 위임
 * - sendSubscribeMessage() → wsManager.subscribe() 위임
 * - handleWebSocketMessage() → 콜백 기반 처리
 * - sendSubscribeForNewMapping() → wsManager.subscribeEquipment() 위임
 * - 기존 모든 기능 100% 호환성 유지
 * - 레거시 메서드 유지 (후방 호환성)
 * 
 * ⭐ v4.1.0: StatusAPIClient 모듈 분리 (Phase 3 리팩토링)
 * ⭐ v4.0.1: 선택된 설비만 EquipmentInfoPanel 업데이트 (버그 수정)
 * ⭐ v4.0.0: PC Info Tab 확장 - Memory, Disk 필드 추가
 * ⭐ v3.4.0: Lot Active/Inactive 분기 지원
 * ⭐ v3.3.0: EquipmentInfoPanel 실시간 업데이트 연동 (Phase 4)
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
        
        this.staleThresholdHours = 24;
        
        this.disabledOptions = {
            grayColor: 0x444444
        };
        
        this.statusPanelElement = null;
        this.equipmentInfoPanel = null;
        
        // Status 매핑
        this.statusMap = {
            'RUN': 'running',
            'IDLE': 'idle',
            'STOP': 'stop',
            'ALARM': 'alarm',
            'DOWN': 'down',
            'DISCONNECTED': 'disconnected'
        };
        
        debugLog('📡 MonitoringService v4.2.0 initialized (WebSocketManager integrated)');
    }
    
    // ===============================================
    // ⭐ v4.2.0: 레거시 호환성 - ws getter/setter
    // ===============================================
    
    /**
     * ws getter (deprecated - use wsManager instead)
     */
    get ws() {
        return this.wsManager?.ws || this._ws;
    }
    
    /**
     * ws setter (deprecated)
     */
    set ws(value) {
        this._ws = value;
    }
    
    // ===============================================
    // 외부 참조 설정
    // ===============================================
    
    setEquipmentInfoPanel(panel) {
        this.equipmentInfoPanel = panel;
        debugLog('📡 MonitoringService: EquipmentInfoPanel 연결됨');
    }
    
    setSignalTowerManager(manager) {
        this.signalTowerManager = manager;
        debugLog('📡 MonitoringService: SignalTowerManager 연결됨');
    }
    
    setEquipmentEditState(state) {
        this.equipmentEditState = state;
        debugLog('📡 MonitoringService: EquipmentEditState 연결됨');
    }
    
    setEquipmentLoader(loader) {
        this.equipmentLoader = loader;
        debugLog('📡 MonitoringService: EquipmentLoader 연결됨');
    }
    
    // ===============================================
    // ⭐ v4.2.0: WebSocket URL 설정
    // ===============================================
    
    /**
     * WebSocket URL 설정
     * @param {string} wsUrl - 새로운 WebSocket URL
     */
    setWsUrl(wsUrl) {
        this.wsUrl = wsUrl;
        if (this.wsManager && !this.wsManager.isConnected()) {
            this.wsManager.setUrl(wsUrl);
        }
        debugLog(`📡 WebSocket URL updated: ${wsUrl}`);
    }
    
    /**
     * API Base URL 설정
     * @param {string} apiBaseUrl - 새로운 API Base URL
     */
    setApiBaseUrl(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        if (this.apiClient) {
            this.apiClient.setBaseUrl(apiBaseUrl);
        }
        debugLog(`📡 API Base URL updated: ${apiBaseUrl}`);
    }
    
    // ===============================================
    // ⭐ v4.2.0: WebSocketManager 접근
    // ===============================================
    
    /**
     * WebSocketManager 인스턴스 조회
     * @returns {WebSocketManager}
     */
    getWebSocketManager() {
        return this.wsManager;
    }
    
    // ===============================================
    // 모니터링 시작/중지
    // ===============================================
    
    async start() {
        if (this.isActive) {
            debugLog('📡 MonitoringService already active');
            return;
        }
        
        this.isActive = true;
        debugLog('📡 MonitoringService starting...');
        
        try {
            // 1. 초기 상태 로드
            await this.loadInitialStatus();
            
            // 2. WebSocket 연결
            await this.connectWebSocket();
            
            // 3. Batch 처리 시작
            this.startBatchProcessing();
            
            debugLog('📡 MonitoringService started successfully');
        } catch (error) {
            console.error('❌ MonitoringService start failed:', error);
            this.isActive = false;
        }
    }
    
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // ⭐ v4.2.0: WebSocketManager 연결 해제
        if (this.wsManager) {
            this.wsManager.disconnect();
        }
        
        // Batch 타이머 정리
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        
        debugLog('📡 MonitoringService stopped');
    }
    
    // ===============================================
    // ⭐ v4.2.0: WebSocket 연결 (위임)
    // ===============================================
    
    /**
     * WebSocket 연결 (레거시 호환성 유지)
     * @returns {Promise<boolean>}
     */
    async connectWebSocket() {
        debugLog('📡 connectWebSocket() → wsManager.connect()');
        
        try {
            await this.wsManager.connect();
            
            // 연결 성공 후 구독
            setTimeout(() => {
                this.sendSubscribeMessage();
            }, 500);
            
            return true;
        } catch (error) {
            console.error('❌ WebSocket connection failed:', error);
            return false;
        }
    }
    
    /**
     * Subscribe 메시지 전송 (레거시 호환성 유지)
     */
    sendSubscribeMessage() {
        debugLog('📡 sendSubscribeMessage() → wsManager.subscribe()');
        return this.wsManager.subscribe();
    }
    
    /**
     * 신규 매핑된 설비 구독 (레거시 호환성 유지)
     * @param {number} equipmentId - equipment_id
     */
    sendSubscribeForNewMapping(equipmentId) {
        debugLog(`📡 sendSubscribeForNewMapping(${equipmentId}) → wsManager.subscribeEquipment()`);
        return this.wsManager.subscribeEquipment(equipmentId);
    }
    
    // ===============================================
    // ⭐ v4.2.0: 상태 업데이트 처리 (콜백)
    // ===============================================
    
    /**
     * WebSocket 상태 업데이트 핸들러
     * @private
     * @param {string} frontendId - frontend_id
     * @param {Object} data - 상태 데이터
     */
    _handleStatusUpdate(frontendId, data) {
        const status = data.status || 'DISCONNECTED';
        const normalizedStatus = this.normalizeStatus(status);
        
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
    }
    
    // ===============================================
    // ⭐ v4.1.0: 초기 상태 로드 (StatusAPIClient 사용)
    // ===============================================
    
    async loadInitialStatus() {
        debugLog('📡 Loading initial status...');
        
        const equipmentIds = this.getMappedEquipmentIds();
        if (equipmentIds.length === 0) {
            debugLog('⚠️ No mapped equipment found');
            return;
        }
        
        debugLog(`📋 Loading status for ${equipmentIds.length} equipment`);
        
        try {
            // ⭐ v4.1.0: StatusAPIClient 사용
            const response = await this.apiClient.getLatestStatusBatch(
                equipmentIds,
                this.staleThresholdHours
            );
            
            if (response && response.statuses) {
                for (const [eqId, statusData] of Object.entries(response.statuses)) {
                    const frontendId = this.equipmentEditState?.getFrontendIdByEquipmentId(parseInt(eqId));
                    if (frontendId) {
                        const status = statusData?.status || 'DISCONNECTED';
                        const normalizedStatus = this.normalizeStatus(status);
                        
                        this.statusCache.set(frontendId, {
                            status: normalizedStatus,
                            rawStatus: status,
                            timestamp: statusData?.timestamp || new Date().toISOString(),
                            ...statusData
                        });
                        
                        this.updateEquipmentStatus(frontendId, normalizedStatus);
                    }
                }
                
                debugLog(`✅ Initial status loaded: ${Object.keys(response.statuses).length} equipment`);
            }
        } catch (error) {
            console.error('❌ Failed to load initial status:', error);
        }
    }
    
    // ===============================================
    // 설비 상태 업데이트
    // ===============================================
    
    updateEquipmentStatus(frontendId, status) {
        if (!this.signalTowerManager) {
            debugLog('⚠️ SignalTowerManager not available');
            return;
        }
        
        // status 정규화
        const normalizedStatus = this.normalizeStatus(status);
        
        // SignalTower 업데이트
        this.signalTowerManager.updateSignalTower(frontendId, normalizedStatus);
        
        debugLog(`🚦 SignalTower updated: ${frontendId} → ${normalizedStatus}`);
    }
    
    normalizeStatus(status) {
        if (!status) return 'disconnected';
        
        const upperStatus = status.toUpperCase();
        return this.statusMap[upperStatus] || status.toLowerCase();
    }
    
    // ===============================================
    // EquipmentInfoPanel 알림
    // ===============================================
    
    notifyEquipmentInfoPanel(frontendId, data) {
        if (!this.equipmentInfoPanel) return;
        
        // ⭐ v4.0.1: 선택된 설비만 업데이트
        const currentSelectedId = this.equipmentInfoPanel.currentEquipmentId;
        if (currentSelectedId !== frontendId) {
            return;
        }
        
        // 패널 업데이트
        this.equipmentInfoPanel.updateFromMonitoring({
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
        
        const mappings = this.equipmentEditState.getAllEquipmentMappings?.() || {};
        const equipmentIds = [];
        
        for (const [frontendId, mapping] of Object.entries(mappings)) {
            if (mapping?.equipment_id) {
                equipmentIds.push(mapping.equipment_id);
            }
        }
        
        return equipmentIds;
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
    
    /**
     * 연결 상태 조회
     * @returns {Object}
     */
    getConnectionStatus() {
        return {
            isActive: this.isActive,
            // ⭐ v4.2.0: WebSocketManager 상태 포함
            wsManager: this.wsManager?.getStatus() || null,
            wsConnected: this.wsManager?.isConnected() || false,
            reconnectAttempts: this.wsManager?.getReconnectAttempts() || this.reconnectAttempts,
            cacheSize: this.statusCache.size,
            queueSize: this.updateQueue.length
        };
    }
    
    // ===============================================
    // 상태 패널 업데이트 (레거시)
    // ===============================================
    
    setStatusPanelElement(element) {
        this.statusPanelElement = element;
    }
    
    updateStatusPanel(frontendId, status, data = {}) {
        if (!this.statusPanelElement) return;
        
        // 패널 업데이트 로직
        const panel = this.statusPanelElement;
        const statusEl = panel.querySelector('.equipment-status');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = `equipment-status status-${status}`;
        }
    }
}

export default MonitoringService;