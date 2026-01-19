/**
 * MonitoringService.js - v5.0.2
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ v5.0.2: MonitoringStatsPanel 제거 (StatusBar로 대체) (2026-01-15)
 * - MonitoringStatsPanel import 및 인스턴스 생성 제거
 * - createStatusPanel(), updateStatusPanel(), removeStatusPanel() 비활성화
 * - updateStats() 간단 버전으로 교체
 * - StatusBar로 이벤트 발행은 유지 (_emitStatsUpdate)
 * 
 * ⭐ v5.0.1: SUDDENSTOP 및 DISCONNECTED 상태 카운트 수정 (2026-01-14)
 * - _calculateStatusCounts() 메서드 수정
 * - 5개 상태 지원: RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED
 * - _emitStatsUpdate() 로그 메시지 업데이트
 *
 * ⭐ v5.0.0: MonitoringDataLoader 통합 리팩토링 (2026-01-13)
 * - MonitoringDataLoader 사용으로 데이터 로드/WebSocket 통합
 * - start() 순차 실행 보장 (Promise 체이닝)
 * - restart() 메서드 추가 (재연결용)
 * - 기존 모든 기능 100% 호환성 유지
 * - _isStarting 플래그로 중복 시작 방지
 * - _startSequence 프로미스로 비동기 처리 개선
 * 
 * ⭐ v4.5.1: StatusBar 연동을 위한 monitoring:stats-update 이벤트 발행 (2026-01-12)
 * ⭐ v4.5.0: MappingEventHandler 모듈 분리 (Phase 7 리팩토링)
 * ⭐ v4.4.0: SignalTowerIntegration 모듈 분리 (Phase 6 리팩토링)
 * ⭐ v4.3.0: MonitoringStatsPanel 모듈 분리 (Phase 5 리팩토링) - ❌ v5.0.2에서 제거됨
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

// ⭐ v4.1.0: StatusAPIClient 모듈 import (레거시 호환성)
import { StatusAPIClient } from './monitoring/StatusAPIClient.js';

// ⭐ v4.2.0: WebSocketManager 모듈 import (레거시 호환성)
import { WebSocketManager, ConnectionState } from './monitoring/WebSocketManager.js';

// ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
// import { MonitoringStatsPanel } from './monitoring/MonitoringStatsPanel.js';

// ⭐ v4.4.0: SignalTowerIntegration 모듈 import
import { SignalTowerIntegration } from './monitoring/SignalTowerIntegration.js';

// ⭐ v4.5.0: MappingEventHandler 모듈 import
import { MappingEventHandler } from './monitoring/MappingEventHandler.js';

// 🆕 v5.0.0: MonitoringDataLoader 모듈 import
import { MonitoringDataLoader, MonitoringLoaderEvents } from './loaders/MonitoringDataLoader.js';
import { LoaderState, LoaderEvents } from './loaders/IDataLoader.js';

/**
 * MonitoringService 이벤트 타입
 * @since v5.0.0
 */
export const MonitoringServiceEvents = Object.freeze({
    START_BEGIN: 'monitoring:start-begin',
    START_COMPLETE: 'monitoring:start-complete',
    START_ERROR: 'monitoring:start-error',
    STOP_BEGIN: 'monitoring:stop-begin',
    STOP_COMPLETE: 'monitoring:stop-complete',
    RESTART_BEGIN: 'monitoring:restart-begin',
    RESTART_COMPLETE: 'monitoring:restart-complete',
    STATUS_UPDATE: 'monitoring:status-update',
    STATS_UPDATE: 'monitoring:stats-update'
});

export class MonitoringService {
    constructor(signalTowerManager, equipmentLoader = null, equipmentEditState = null) {
        this.signalTowerManager = signalTowerManager;
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        
        // ⭐ 동적 URL 생성
        const host = window.location.hostname;
        const port = 8008;
        
        // ⭐ v4.1.0: StatusAPIClient 인스턴스 생성
        this.apiBaseUrl = `http://${host}:${port}/api/monitoring`;
        this.apiClient = new StatusAPIClient(this.apiBaseUrl);
        
        // ⭐ v4.2.0: WebSocket URL (레거시 호환성)
        this.wsUrl = `ws://${host}:${port}/api/monitoring/stream`;
        
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
        
        // 🆕 v5.0.0: MonitoringDataLoader 인스턴스 생성
        this._dataLoader = new MonitoringDataLoader({
            equipmentEditState: this.equipmentEditState,
            signalTowerManager: this.signalTowerManager,
            apiBaseUrl: this.apiBaseUrl,
            wsUrl: this.wsUrl,
            staleThresholdHours: 24,
            autoSubscribe: true,
            debug: false,
            onStatusUpdate: (frontendId, data) => this._handleDataLoaderStatusUpdate(frontendId, data)
        });
        
        // ⭐ v4.4.0: SignalTowerIntegration 인스턴스 생성
        this.signalIntegration = new SignalTowerIntegration(
            this.signalTowerManager,
            this.equipmentLoader,
            this.equipmentEditState,
            { debug: false }
        );
        
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
        // this.statsPanel = new MonitoringStatsPanel({
        //     signalTowerManager: this.signalTowerManager,
        //     debug: false
        // });
        this.statsPanel = null;  // 레거시 호환성을 위해 null 유지
        
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
        
        // 🆕 v5.0.0: 시작 상태 관리
        this._isStarting = false;
        this._startSequence = null;
        this._isStopping = false;
        
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
        
        // 🆕 v5.0.0: DataLoader 이벤트 바인딩
        this._setupDataLoaderEvents();
        
        debugLog('📡 MonitoringService v5.0.2 initialized (MonitoringStatsPanel removed)');
    }
    
    // ===============================================
    // 🆕 v5.0.0: DataLoader 이벤트 설정
    // ===============================================
    
    /**
     * @private
     */
    _setupDataLoaderEvents() {
        // 상태 업데이트 이벤트
        this._dataLoader.on(MonitoringLoaderEvents.STATUS_UPDATE, (data) => {
            debugLog(`📊 DataLoader status update: ${data.frontendId} → ${data.status}`);
        });
        
        // WebSocket 연결 이벤트
        this._dataLoader.on(MonitoringLoaderEvents.WS_CONNECTED, (data) => {
            debugLog('📡 DataLoader WebSocket connected');
        });
        
        // WebSocket 구독 완료 이벤트
        this._dataLoader.on(MonitoringLoaderEvents.WS_SUBSCRIBED, (data) => {
            debugLog(`📋 DataLoader subscribed: ${data.subscribedCount} equipment`);
        });
        
        // 초기 상태 로드 완료
        this._dataLoader.on(MonitoringLoaderEvents.INITIAL_STATUS_LOADED, (data) => {
            debugLog(`✅ Initial status loaded: ${data.total} equipment`);
            this.currentStats.connected = data.connected;
            this.currentStats.disconnected = data.disconnected;
        });
        
        // 모니터링 준비 완료
        this._dataLoader.on(MonitoringLoaderEvents.READY_FOR_MONITORING, (data) => {
            debugLog('🎉 DataLoader ready for monitoring');
        });
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
    // 🆕 v5.0.0: DataLoader 접근자
    // ===============================================
    
    /**
     * MonitoringDataLoader 인스턴스 반환
     * @returns {MonitoringDataLoader}
     */
    getDataLoader() {
        return this._dataLoader;
    }
    
    /**
     * DataLoader 초기화 상태 확인
     * @returns {boolean}
     */
    isDataLoaderInitialized() {
        return this._dataLoader?.isInitialized?.() ?? false;
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
        
        // 🆕 v5.0.0: DataLoader에도 전달
        this._dataLoader?.setDependencies({
            equipmentEditState,
            signalTowerManager: this.signalTowerManager
        });
        
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
        // ❌ v5.0.2: StatsPanel 제거됨 - 더 이상 설정하지 않음
        // this.statsPanel.setSignalTowerManager(manager);
        // 🆕 v5.0.0: DataLoader에도 전달
        this._dataLoader?.setSignalTowerManager(manager);
        debugLog('📡 MonitoringService: SignalTowerManager 연결됨');
    }
    
    setEquipmentEditState(state) {
        this.equipmentEditState = state;
        // ⭐ v4.4.0: SignalTowerIntegration에도 전달
        this.signalIntegration.setEquipmentEditState(state);
        // 🆕 v5.0.0: DataLoader에도 전달
        this._dataLoader?.setEquipmentEditState(state);
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
            // 🆕 v5.0.0: DataLoader에도 전달
            this._dataLoader?.setStaleThreshold(hours);
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
    
    /**
     * ❌ v5.0.2: MonitoringStatsPanel 제거됨
     * @deprecated 레거시 호환성을 위해 null 반환
     * @returns {null}
     */
    getStatsPanel() {
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
        return null;
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
    // 🆕 v5.0.0: 모니터링 시작 (순차 실행 보장)
    // ===============================================
    
    /**
     * 모니터링 시작 (순차 실행 보장)
     * 
     * @returns {Promise<boolean>} 시작 성공 여부
     * 
     * @description
     * v5.0.0: start() 메서드를 Promise 기반으로 변경하여 순차 실행 보장
     * - 중복 시작 방지 (_isStarting 플래그)
     * - 각 단계 완료 후 다음 단계 진행
     * - 에러 발생 시 적절한 롤백
     * 
     * @example
     * // 순차 실행 보장
     * await monitoringService.start();
     * console.log('모니터링 시작 완료');
     */
    async start() {
        // 이미 시작 중인 경우
        if (this._isStarting) {
            debugLog('⚠️ Monitoring start already in progress, waiting...');
            return this._startSequence || Promise.resolve(false);
        }
        
        // 이미 활성화된 경우
        if (this.isActive) {
            debugLog('⚠️ Monitoring already active');
            return true;
        }
        
        // 시작 플래그 설정
        this._isStarting = true;
        
        // 이벤트 발행
        this._emitServiceEvent(MonitoringServiceEvents.START_BEGIN, {
            timestamp: new Date().toISOString()
        });
        
        debugLog('🟢 Starting monitoring mode (v5.0.2)...');
        
        // 시작 시퀀스 Promise 생성
        this._startSequence = this._executeStartSequence();
        
        try {
            const result = await this._startSequence;
            return result;
        } finally {
            this._isStarting = false;
            this._startSequence = null;
        }
    }
    
    /**
     * 시작 시퀀스 실행 (내부)
     * @private
     * @returns {Promise<boolean>}
     */
    async _executeStartSequence() {
        const startTime = Date.now();
        
        try {
            // ===== Step 1: SignalTower 초기화 =====
            debugLog('🚨 Step 1: Initializing SignalTower lights...');
            await this._step1_initializeSignalTowers();
            
            // ===== Step 2: 미매핑 설비 스타일 적용 =====
            debugLog('🌫️ Step 2: Applying unmapped equipment style...');
            await this._step2_applyUnmappedStyle();
            
            // ===== Step 3: 통계 패널 생성 =====
            // ❌ v5.0.2: MonitoringStatsPanel 제거됨 - 스킵
            debugLog('📊 Step 3: Status panel skipped (StatusBar used instead)...');
            // await this._step3_createStatusPanel();
            
            // ===== Step 4: DataLoader 초기화 =====
            debugLog('📡 Step 4: Initializing DataLoader...');
            await this._step4_initializeDataLoader();
            
            // ===== Step 5: 초기 상태 로드 + WebSocket 연결 =====
            debugLog('📡 Step 5: Loading initial status + WebSocket...');
            await this._step5_loadDataAndConnect();
            
            // ===== Step 6: 배치 처리 시작 =====
            debugLog('⏱️ Step 6: Starting batch processing...');
            await this._step6_startBatchProcessing();
            
            // ===== Step 7: 이벤트 리스너 등록 =====
            debugLog('📡 Step 7: Registering event listeners...');
            await this._step7_registerEventListeners();
            
            // ===== 완료 =====
            this.isActive = true;
            
            const elapsed = Date.now() - startTime;
            
            // 초기 상태 발행
            this._emitStatsUpdate();
            
            // 완료 이벤트 발행
            this._emitServiceEvent(MonitoringServiceEvents.START_COMPLETE, {
                elapsed,
                timestamp: new Date().toISOString(),
                stats: this.getStats(),
                wsConnected: this.wsManager?.isConnected() || this._dataLoader?.isWsConnected()
            });
            
            debugLog(`✅ Monitoring mode started successfully (${elapsed}ms)`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error);
            
            // 에러 이벤트 발행
            this._emitServiceEvent(MonitoringServiceEvents.START_ERROR, {
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            // 롤백
            this._rollbackStart();
            
            return false;
        }
    }
    
    /**
     * Step 1: SignalTower 초기화
     * @private
     */
    async _step1_initializeSignalTowers() {
        this.signalIntegration.initializeAllLights();
    }
    
    /**
     * Step 2: 미매핑 스타일 적용
     * @private
     */
    async _step2_applyUnmappedStyle() {
        const applyResult = this.signalIntegration.applyUnmappedStyle();
        this.currentStats.mapped = applyResult.mapped;
        this.currentStats.unmapped = applyResult.unmapped;
        this.currentStats.total = applyResult.total;
        this.currentStats.rate = applyResult.rate;
    }
    
    /**
     * Step 3: 통계 패널 생성
     * ❌ v5.0.2: MonitoringStatsPanel 제거됨 - 이 단계는 스킵됨
     * @private
     */
    async _step3_createStatusPanel() {
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
        // this.createStatusPanel();
    }
    
    /**
     * Step 4: DataLoader 초기화
     * @private
     */
    async _step4_initializeDataLoader() {
        // DataLoader 의존성 업데이트
        this._dataLoader.setDependencies({
            equipmentEditState: this.equipmentEditState,
            signalTowerManager: this.signalTowerManager
        });
        
        // 초기화
        await this._dataLoader.initialize();
    }
    
    /**
     * Step 5: 데이터 로드 + WebSocket 연결
     * @private
     */
    async _step5_loadDataAndConnect() {
        try {
            // DataLoader를 통한 로드
            const result = await this._dataLoader.load({
                thresholdHours: this.staleThresholdHours,
                skipWebSocket: false
            });
            
            // 캐시 동기화
            if (result.initialData?.equipment) {
                result.initialData.equipment.forEach(item => {
                    const frontendId = this.equipmentEditState?.getFrontendIdByEquipmentId(item.equipment_id);
                    if (frontendId) {
                        const status = item.is_connected === false ? 'DISCONNECTED' : item.status;
                        this.statusCache.set(frontendId, status);
                        
                        // SignalTower 업데이트
                        this.signalIntegration.updateStatus(frontendId, status);
                    }
                });
            }
            
            // 통계 업데이트
            if (result.stats) {
                this.currentStats.connected = result.stats.connectedCount;
                this.currentStats.disconnected = result.stats.disconnectedCount;
            }
            
            debugLog(`✅ Data loaded: ${result.stats?.totalEquipment || 0} equipment, WS: ${result.wsConnected}`);
            
        } catch (error) {
            // DataLoader 실패 시 기존 방식으로 폴백
            debugLog(`⚠️ DataLoader failed, falling back to legacy method: ${error.message}`);
            await this._fallbackLoadInitialStatus();
            await this._fallbackConnectWebSocket();
        }
    }
    
    /**
     * 폴백: 기존 방식 초기 상태 로드
     * @private
     */
    async _fallbackLoadInitialStatus() {
        try {
            await this.loadInitialStatus();
        } catch (err) {
            debugLog(`⚠️ Fallback loadInitialStatus failed: ${err.message}`);
        }
    }
    
    /**
     * 폴백: 기존 방식 WebSocket 연결
     * @private
     */
    async _fallbackConnectWebSocket() {
        try {
            await this.connectWebSocket();
        } catch (err) {
            debugLog(`⚠️ Fallback WebSocket failed: ${err.message}`);
        }
    }
    
    /**
     * Step 6: 배치 처리 시작
     * @private
     */
    async _step6_startBatchProcessing() {
        this.startBatchProcessing();
    }
    
    /**
     * Step 7: 이벤트 리스너 등록
     * @private
     */
    async _step7_registerEventListeners() {
        this.registerEventListeners();
    }
    
    /**
     * 시작 실패 시 롤백
     * @private
     */
    _rollbackStart() {
        debugLog('⚠️ Rolling back start...');
        
        this.isActive = false;
        
        // 배치 타이머 정리
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        
        // 이벤트 리스너 해제
        try {
            this.unregisterEventListeners();
        } catch (e) {
            // ignore
        }
        
        // ❌ v5.0.2: 패널 제거 스킵 (더 이상 패널 없음)
        // try {
        //     this.removeStatusPanel();
        // } catch (e) {
        //     // ignore
        // }
    }
    
    // ===============================================
    // 🆕 v5.0.0: 모니터링 재시작 (재연결용)
    // ===============================================
    
    /**
     * 모니터링 재시작 (재연결용)
     * 
     * @param {Object} options - 재시작 옵션
     * @param {boolean} [options.fullRestart=false] - 전체 재시작 여부 (false면 WebSocket만 재연결)
     * @param {number} [options.delay=500] - 재시작 전 딜레이 (ms)
     * @returns {Promise<boolean>} 재시작 성공 여부
     * 
     * @example
     * // WebSocket만 재연결
     * await monitoringService.restart();
     * 
     * // 전체 재시작 (stop → start)
     * await monitoringService.restart({ fullRestart: true });
     */
    async restart(options = {}) {
        const { fullRestart = false, delay = 500 } = options;
        
        debugLog(`🔄 Restarting monitoring (fullRestart: ${fullRestart})...`);
        
        // 이벤트 발행
        this._emitServiceEvent(MonitoringServiceEvents.RESTART_BEGIN, {
            fullRestart,
            timestamp: new Date().toISOString()
        });
        
        try {
            if (fullRestart) {
                // 전체 재시작: stop → delay → start
                await this.stop();
                
                if (delay > 0) {
                    await this._delay(delay);
                }
                
                const result = await this.start();
                
                // 완료 이벤트
                this._emitServiceEvent(MonitoringServiceEvents.RESTART_COMPLETE, {
                    fullRestart: true,
                    success: result,
                    timestamp: new Date().toISOString()
                });
                
                return result;
                
            } else {
                // 부분 재시작: WebSocket만 재연결
                return await this._restartWebSocketOnly();
            }
            
        } catch (error) {
            console.error('❌ Restart failed:', error);
            return false;
        }
    }
    
    /**
     * WebSocket만 재연결
     * @private
     */
    async _restartWebSocketOnly() {
        debugLog('🔌 Reconnecting WebSocket only...');
        
        // DataLoader WebSocket 재연결 시도
        if (this._dataLoader) {
            try {
                const success = await this._dataLoader.reconnectWebSocket();
                
                if (success) {
                    debugLog('✅ DataLoader WebSocket reconnected');
                    
                    this._emitServiceEvent(MonitoringServiceEvents.RESTART_COMPLETE, {
                        fullRestart: false,
                        success: true,
                        method: 'dataLoader',
                        timestamp: new Date().toISOString()
                    });
                    
                    return true;
                }
            } catch (e) {
                debugLog(`⚠️ DataLoader reconnect failed: ${e.message}`);
            }
        }
        
        // 레거시 WebSocketManager 사용
        if (this.wsManager) {
            try {
                this.wsManager.disconnect();
                await this._delay(300);
                await this.wsManager.connect();
                this.wsManager.subscribe();
                
                debugLog('✅ Legacy WebSocket reconnected');
                
                this._emitServiceEvent(MonitoringServiceEvents.RESTART_COMPLETE, {
                    fullRestart: false,
                    success: true,
                    method: 'wsManager',
                    timestamp: new Date().toISOString()
                });
                
                return true;
                
            } catch (e) {
                debugLog(`❌ Legacy WebSocket reconnect failed: ${e.message}`);
            }
        }
        
        return false;
    }
    
    // ===============================================
    // 모니터링 중지
    // ===============================================
    
    /**
     * 모니터링 중지
     * @returns {Promise<void>}
     */
    async stop() {
        if (this._isStopping) {
            debugLog('⚠️ Already stopping');
            return;
        }
        
        this._isStopping = true;
        
        debugLog('🔴 Stopping monitoring mode...');
        
        // 이벤트 발행
        this._emitServiceEvent(MonitoringServiceEvents.STOP_BEGIN, {
            timestamp: new Date().toISOString()
        });
        
        try {
            this.isActive = false;
            
            // 1. 이벤트 리스너 해제
            // ⭐ v4.5.0: MappingEventHandler 사용
            this.unregisterEventListeners();
            
            // 2. 비활성화 표시 해제
            this.resetEquipmentStyle();
            
            // 3. 통계 패널 제거
            // ❌ v5.0.2: MonitoringStatsPanel 제거됨 - 스킵
            // this.removeStatusPanel();
            
            // 4. WebSocket 연결 종료
            if (this._dataLoader) {
                this._dataLoader.disconnectWebSocket();
            }
            if (this.wsManager) {
                this.wsManager.disconnect();
            }
            
            // 5. 배치 처리 타이머 중지
            if (this.batchTimer) {
                clearInterval(this.batchTimer);
                this.batchTimer = null;
            }
            
            // 완료 이벤트
            this._emitServiceEvent(MonitoringServiceEvents.STOP_COMPLETE, {
                timestamp: new Date().toISOString()
            });
            
            debugLog('✅ Monitoring mode stopped');
            
        } finally {
            this._isStopping = false;
        }
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
        // 🆕 v5.0.0: DataLoader 우선 사용
        if (this._dataLoader) {
            return await this._dataLoader.fetchLiveStatus(frontendId);
        }
        return this.apiClient.fetchEquipmentLiveStatus?.(frontendId) || null;
    }
    
    // ===============================================
    // ⭐ v4.3.0: 통계 패널 관리 (위임)
    // ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
    // ===============================================
    
    /**
     * ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
     * 레거시 호환성을 위해 메서드는 유지하되 내부 동작은 비활성화
     */
    createStatusPanel() {
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
        // this.updateStats();
        // this.statsPanel.create(this.currentStats);
        // this.statusPanelElement = this.statsPanel.element;
        
        // ✅ v5.0.2: updateStats는 유지하여 currentStats 계산
        this.updateStats();
        debugLog('📊 createStatusPanel() skipped - using StatusBar instead');
    }
    
    /**
     * ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
     * 레거시 호환성을 위해 메서드는 유지하되 내부 동작은 비활성화
     */
    updateStatusPanel() {
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨
        // this.statsPanel.refresh(this.equipmentLoader, this.equipmentEditState);
        // this.currentStats = this.statsPanel.getStats();
        
        // ✅ v5.0.2: 간단 버전으로 통계 업데이트
        this.updateStats();
        
        // ✅ StatusBar로 이벤트 발행만 유지
        this._emitStatsUpdate();
    }
    
    /**
     * ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
     * 레거시 호환성을 위해 메서드는 유지하되 내부 동작은 비활성화
     */
    removeStatusPanel() {
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨 (StatusBar로 대체)
        // this.statsPanel.remove();
        // this.statusPanelElement = null;
        debugLog('📊 removeStatusPanel() skipped - using StatusBar instead');
    }
    
    getStats() {
        this.updateStats();
        return { ...this.currentStats };
    }
    
    /**
     * ✅ v5.0.2: 간단 버전으로 교체 - MonitoringStatsPanel 없이 직접 계산
     */
    updateStats() {
        if (!this.equipmentLoader || !this.equipmentEditState) {
            return;
        }
        
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨
        // this.currentStats = this.statsPanel.calculateStats(
        //     this.equipmentLoader,
        //     this.equipmentEditState
        // );
        
        // ✅ v5.0.2: currentStats 직접 계산 (간단 버전)
        const totalEquipment = this.equipmentLoader.equipmentArray?.length || 0;
        const mappedCount = this.equipmentEditState.getMappingCount?.() || 0;
        
        // SignalTower 통계에서 connected/disconnected 계산
        let connectedCount = 0;
        let disconnectedCount = 0;
        
        if (this.signalTowerManager?.getStatusStatistics) {
            const stats = this.signalTowerManager.getStatusStatistics();
            disconnectedCount = stats.DISCONNECTED || 0;
            // Connected = 매핑됨 - DISCONNECTED
            connectedCount = Math.max(0, mappedCount - disconnectedCount);
        }
        
        this.currentStats = {
            total: totalEquipment,
            mapped: mappedCount,
            unmapped: totalEquipment - mappedCount,
            rate: totalEquipment > 0 ? Math.round((mappedCount / totalEquipment) * 100) : 0,
            connected: connectedCount,
            disconnected: disconnectedCount
        };
    }
    
    // ===============================================
    // 🆕 v5.0.0: 서비스 이벤트 발행
    // ===============================================
    
    /**
     * 서비스 이벤트 발행
     * @private
     */
    _emitServiceEvent(eventName, data) {
        if (!this.eventBus) return;
        
        this.eventBus.emit(eventName, {
            ...data,
            source: 'MonitoringService'
        });
    }
    
    // ===============================================
    // 🆕 v4.5.1: StatusBar 이벤트 발행
    // ===============================================
    
	/**
	 * 🔧 v5.0.1: monitoring:stats-update 이벤트 발행 (5개 상태 지원)
	 * StatusBar Monitoring Stats Panel 실시간 업데이트용
	 */
	_emitStatsUpdate() {
	    if (!this.eventBus) return;
	    
	    // 🎯 SignalTowerManager의 getStatusStatistics() 사용 (정확도 보장!)
	    const statusCounts = this._getSignalTowerStats();
	    
	    // 이벤트 발행
	    this.eventBus.emit('monitoring:stats-update', {
	        statusCounts: statusCounts,
	        total: this.currentStats.total,
	        mapped: this.currentStats.mapped,
	        unmapped: this.currentStats.unmapped,
	        mappingRate: this.currentStats.rate,
	        timestamp: new Date().toISOString()
	    });
	    
	    debugLog(`📡 monitoring:stats-update 발행 - RUN:${statusCounts.run}, IDLE:${statusCounts.idle}, STOP:${statusCounts.stop}, SUDDENSTOP:${statusCounts.suddenstop}, DISCONNECTED:${statusCounts.disconnected}`);
	}
    
	/**
	 * 🎯 FINAL: SignalTowerManager에서 정확한 통계 가져오기
	 * 
	 * @returns {{run: number, idle: number, stop: number, suddenstop: number, disconnected: number}}
	 */
	_getSignalTowerStats() {
	    // 기본값
	    const counts = {
	        run: 0,
	        idle: 0,
	        stop: 0,
	        suddenstop: 0,
	        disconnected: 0
	    };
	    
	    // SignalTowerManager의 getStatusStatistics() 사용
	    if (this.signalTowerManager?.getStatusStatistics) {
	        const stats = this.signalTowerManager.getStatusStatistics();
	        
	        // 키 변환: 대문자 → 소문자
	        counts.run = stats.RUN || 0;
	        counts.idle = stats.IDLE || 0;
	        counts.stop = stats.STOP || 0;
	        counts.suddenstop = stats.SUDDENSTOP || 0;
	        counts.disconnected = stats.DISCONNECTED || 0;
	        
	        debugLog(`📊 SignalTower Stats - RUN:${counts.run}, IDLE:${counts.idle}, STOP:${counts.stop}, SUDDENSTOP:${counts.suddenstop}, DISCONNECTED:${counts.disconnected}`);
	    } else {
	        debugLog('⚠️ signalTowerManager.getStatusStatistics() not available');
	    }
	    
	    return counts;
	}
    
    // ===============================================
    // 🆕 v5.0.0: DataLoader 상태 업데이트 핸들러
    // ===============================================
    
    /**
     * DataLoader에서 오는 상태 업데이트 처리
     * @private
     */
    _handleDataLoaderStatusUpdate(frontendId, data) {
        const status = data.status || 'DISCONNECTED';
        const normalizedStatus = this.signalIntegration.normalizeStatus(status);
        
        debugLog(`📊 DataLoader Status update: ${frontendId} → ${normalizedStatus}`);
        
        // 캐시 업데이트
        this.statusCache.set(frontendId, {
            status: normalizedStatus,
            rawStatus: data.rawStatus || status,
            timestamp: new Date().toISOString(),
            ...data
        });
        
        // SignalTower 업데이트
        this.updateEquipmentStatus(frontendId, normalizedStatus);
        
        // EquipmentInfoPanel 알림
        this.notifyEquipmentInfoPanel(frontendId, data);
        
        // 통계 패널 업데이트 (이벤트 발행 포함)
        this.updateStatusPanel();
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
        // 🆕 v5.0.0: DataLoader도 업데이트
        this._dataLoader?.subscribeEquipment(equipmentId);
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
        // 🆕 v5.0.0: DataLoader 캐시 우선
        const loaderStatus = this._dataLoader?.getCachedStatus(frontendId);
        if (loaderStatus) return loaderStatus;
        
        return this.statusCache.get(frontendId);
    }
    
    getAllStatuses() {
        // 🆕 v5.0.0: DataLoader 캐시와 병합
        const loaderStatuses = this._dataLoader?.getAllCachedStatuses() || {};
        const localStatuses = Object.fromEntries(this.statusCache);
        
        return { ...localStatuses, ...loaderStatuses };
    }
    
    getConnectionStatus() {
        return {
            isActive: this.isActive,
            // 🆕 v5.0.0: 시작 상태 추가
            isStarting: this._isStarting,
            isStopping: this._isStopping,
            wsManager: this.wsManager?.getStatus() || null,
            wsConnected: this.wsManager?.isConnected() || false,
            reconnectAttempts: this.wsManager?.getReconnectAttempts() || 0,
            cacheSize: this.statusCache.size,
            queueSize: this.updateQueue.length,
            stats: this.getStats(),
            signalIntegration: this.signalIntegration?.getStatus() || null,
            // ⭐ v4.5.0: MappingEventHandler 상태 추가
            eventHandler: this.eventHandler?.getStatus() || null,
            // 🆕 v5.0.0: DataLoader 상태 추가
            dataLoader: this._dataLoader?.getStatus() || null
        };
    }
    
    // ===============================================
    // 유틸리티
    // ===============================================
    
    /**
     * 딜레이 유틸리티
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
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
        
        // 🆕 v5.0.0: DataLoader 정리
        this._dataLoader?.dispose();
        this._dataLoader = null;
        
        // ⭐ v4.5.0: MappingEventHandler 정리
        this.eventHandler?.dispose();
        
        // ⭐ v4.4.0: SignalTowerIntegration 정리
        this.signalIntegration?.dispose();
        
        // ❌ v5.0.2: MonitoringStatsPanel 제거됨 - 정리 스킵
        // this.statsPanel?.dispose();
        
        this.signalTowerManager = null;
        this.equipmentLoader = null;
        this.equipmentEditState = null;
        this.equipmentInfoPanel = null;
        this.eventBus = null;
        this.statusCache.clear();
        
        debugLog('🗑️ MonitoringService disposed');
    }
    
    // ===============================================
    // 🆕 v5.0.0: Static 메서드
    // ===============================================
    
    /**
     * 버전 정보
     */
    static get VERSION() {
        return '5.0.2';
    }
    
    /**
     * 서비스 이벤트 타입
     */
    static get Events() {
        return MonitoringServiceEvents;
    }
}

export default MonitoringService;