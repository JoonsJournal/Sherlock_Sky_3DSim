/**
 * MonitoringDataLoader.js
 * ========================
 * 모니터링 데이터 로더 (IDataLoader 구현)
 * 
 * StatusAPIClient와 WebSocketManager를 통합하여
 * IDataLoader 인터페이스로 표준화된 데이터 로드 제공
 * 
 * @version 1.0.0
 * @since 2026-01-13
 * 
 * @description
 * - StatusAPIClient: REST API로 초기 상태 로드
 * - WebSocketManager: 실시간 상태 업데이트 구독
 * - IDataLoader 표준 인터페이스 구현
 * - 기존 MonitoringService와 호환
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/loaders/MonitoringDataLoader.js
 * 
 * @example
 * const loader = new MonitoringDataLoader({
 *     equipmentEditState: editState,
 *     signalTowerManager: signalTowerManager,
 *     eventBus: eventBus,
 *     onStatusUpdate: (frontendId, data) => { ... }
 * });
 * 
 * await loader.initialize();  // API Client + WebSocket 초기화
 * await loader.load();        // 초기 상태 로드 + WebSocket 구독
 * loader.dispose();           // 리소스 정리
 * 
 * @changelog
 * - v1.0.0: 초기 버전 - IDataLoader 구현, StatusAPIClient + WebSocketManager 통합
 */

import { IDataLoader, LoaderState, LoaderEvents, LoaderType } from './IDataLoader.js';
import { StatusAPIClient } from '../monitoring/StatusAPIClient.js';
import { WebSocketManager, ConnectionState as WsConnectionState } from '../monitoring/WebSocketManager.js';
import { debugLog } from '../../core/utils/Config.js';

// ============================================================================
// MonitoringDataLoader 이벤트 타입
// ============================================================================

/**
 * MonitoringDataLoader 전용 이벤트
 */
export const MonitoringLoaderEvents = Object.freeze({
    // WebSocket 관련
    WS_CONNECTED: 'monitoring:ws-connected',
    WS_DISCONNECTED: 'monitoring:ws-disconnected',
    WS_SUBSCRIBED: 'monitoring:ws-subscribed',
    WS_RECONNECTING: 'monitoring:ws-reconnecting',
    WS_ERROR: 'monitoring:ws-error',
    
    // 상태 업데이트
    STATUS_UPDATE: 'monitoring:status-update',
    STATUS_BATCH_UPDATE: 'monitoring:status-batch-update',
    
    // 초기화
    INITIAL_STATUS_LOADED: 'monitoring:initial-status-loaded',
    READY_FOR_MONITORING: 'monitoring:ready-for-monitoring'
});

// ============================================================================
// MonitoringDataLoader 클래스
// ============================================================================

/**
 * MonitoringDataLoader 클래스
 * 
 * @extends IDataLoader
 */
export class MonitoringDataLoader extends IDataLoader {
    /**
     * MonitoringDataLoader 생성자
     * 
     * @param {Object} options - 설정 옵션
     * @param {Object} [options.equipmentEditState] - EquipmentEditState 인스턴스
     * @param {Object} [options.signalTowerManager] - SignalTowerManager 인스턴스
     * @param {string} [options.apiBaseUrl] - REST API Base URL
     * @param {string} [options.wsUrl] - WebSocket URL
     * @param {number} [options.staleThresholdHours=24] - DISCONNECTED 판별 기준 (시간)
     * @param {boolean} [options.autoSubscribe=true] - 초기 로드 후 자동 구독
     * @param {Function} [options.onStatusUpdate] - 상태 업데이트 콜백
     * @param {boolean} [options.debug=false] - 디버그 모드
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     */
    constructor(options = {}) {
        super(LoaderType.MONITORING, options);
        
        // ===== URL 설정 =====
        const host = window.location.hostname;
        const port = 8000;
        
        /** @private @type {string} */
        this._apiBaseUrl = options.apiBaseUrl ?? `http://${host}:${port}/api/monitoring`;
        
        /** @private @type {string} */
        this._wsUrl = options.wsUrl ?? `ws://${host}:${port}/api/monitoring/stream`;
        
        // ===== 의존성 =====
        /** @private @type {Object|null} */
        this._equipmentEditState = options.equipmentEditState ?? null;
        
        /** @private @type {Object|null} */
        this._signalTowerManager = options.signalTowerManager ?? null;
        
        // ===== StatusAPIClient 인스턴스 =====
        /** @private @type {StatusAPIClient} */
        this._apiClient = new StatusAPIClient(this._apiBaseUrl);
        
        // ===== WebSocketManager 인스턴스 =====
        /** @private @type {WebSocketManager} */
        this._wsManager = new WebSocketManager(this._wsUrl, {
            maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
            reconnectDelay: options.reconnectDelay ?? 3000,
            heartbeatInterval: options.heartbeatInterval ?? 30000,
            autoReconnect: options.autoReconnect ?? true,
            debug: this._config.debug,
            
            // 콜백 설정
            onStatusUpdate: (frontendId, data) => this._handleStatusUpdate(frontendId, data),
            onConnected: (message) => this._handleWsConnected(message),
            onSubscribed: (message) => this._handleWsSubscribed(message),
            onDisconnected: () => this._handleWsDisconnected(),
            onError: (error) => this._handleWsError(error),
            onReconnecting: (attempt, max) => this._handleWsReconnecting(attempt, max),
            
            // 매핑 조회 콜백
            getEquipmentIds: () => this._getMappedEquipmentIds(),
            getFrontendId: (equipmentId) => this._getFrontendIdByEquipmentId(equipmentId)
        });
        
        // ===== 설정 =====
        /** @private @type {number} */
        this._staleThresholdHours = options.staleThresholdHours ?? 24;
        
        /** @private @type {boolean} */
        this._autoSubscribe = options.autoSubscribe ?? true;
        
        /** @private @type {Function|null} */
        this._onStatusUpdate = options.onStatusUpdate ?? null;
        
        // ===== 상태 캐시 =====
        /** @private @type {Map<string, Object>} */
        this._statusCache = new Map();
        
        // ===== 로드된 데이터 =====
        /** @private @type {Object|null} */
        this._initialData = null;
        
        // ===== 통계 =====
        /** @private @type {Object} */
        this._stats = {
            totalEquipment: 0,
            connectedCount: 0,
            disconnectedCount: 0,
            statusCounts: { RUN: 0, IDLE: 0, STOP: 0, SUDDENSTOP: 0, DISCONNECTED: 0 },
            lastUpdateTime: null,
            updateCount: 0
        };
        
        this._log(`🔧 MonitoringDataLoader 생성됨 (v1.0.0)`);
    }
    
    // =========================================================================
    // IDataLoader 구현 - 필수 메서드
    // =========================================================================
    
    /**
     * 초기화
     * 
     * @override
     * @async
     * @returns {Promise<boolean>} 성공 여부
     */
    async initialize() {
        if (this._isInitialized) {
            this._log('⚠️ 이미 초기화됨');
            return true;
        }
        
        this._setState(LoaderState.INITIALIZING);
        this._emit(LoaderEvents.INITIALIZE_START, {});
        
        try {
            this._initTime = new Date();
            
            // 1. API Client Health Check
            this._log('🔍 API Health Check...');
            const isHealthy = await this._apiClient.isConnected().catch(() => false);
            
            if (!isHealthy) {
                this._log('⚠️ API Server not healthy, will retry during load');
            } else {
                this._log('✅ API Server healthy');
            }
            
            // 2. WebSocket 초기화는 load() 시점에 수행 (연결은 나중에)
            this._log('📡 WebSocket Manager ready (connection deferred)');
            
            this._isInitialized = true;
            this._setState(LoaderState.READY);
            
            this._emit(LoaderEvents.INITIALIZE_COMPLETE, {
                initTime: this._initTime.toISOString(),
                apiBaseUrl: this._apiBaseUrl,
                wsUrl: this._wsUrl,
                apiHealthy: isHealthy
            });
            
            this._log('✅ MonitoringDataLoader 초기화 완료');
            return true;
            
        } catch (error) {
            this._handleError(error);
            this._emit(LoaderEvents.INITIALIZE_ERROR, { error: error.message });
            return false;
        }
    }
    
    /**
     * 데이터 로드 (초기 상태 + WebSocket 연결)
     * 
     * @override
     * @async
     * @param {Object} [params] - 로드 파라미터
     * @param {number} [params.thresholdHours] - DISCONNECTED 판별 기준
     * @param {boolean} [params.skipWebSocket=false] - WebSocket 연결 건너뛰기
     * @param {boolean} [params.forceRefresh=false] - 강제 새로고침
     * @returns {Promise<Object>} 로드된 데이터
     */
    async load(params = {}) {
        const {
            thresholdHours = this._staleThresholdHours,
            skipWebSocket = false,
            forceRefresh = false
        } = params;
        
        if (!this._isInitialized) {
            throw new Error('초기화되지 않음. initialize()를 먼저 호출하세요.');
        }
        
        if (this._isLoading) {
            this._log('⚠️ 이미 로딩 중');
            return this._initialData;
        }
        
        this._isLoading = true;
        this._setState(LoaderState.LOADING);
        this._loadStartTime = new Date();
        
        this._emit(LoaderEvents.LOAD_START, { thresholdHours, skipWebSocket });
        
        try {
            // ===== Step 1: REST API로 초기 상태 로드 =====
            this._log('📡 Step 1: Loading initial status...');
            this._updateProgress(10, 0, 0);
            
            const initialData = await this._withRetry(
                () => this._apiClient.fetchInitialStatus(thresholdHours)
            );
            
            this._initialData = initialData;
            this._processInitialData(initialData);
            
            this._updateProgress(50, this._stats.totalEquipment, this._stats.totalEquipment);
            
            this._emit(MonitoringLoaderEvents.INITIAL_STATUS_LOADED, {
                total: this._stats.totalEquipment,
                connected: this._stats.connectedCount,
                disconnected: this._stats.disconnectedCount,
                statusCounts: { ...this._stats.statusCounts }
            });
            
            this._log(`✅ Initial status loaded: ${this._stats.totalEquipment} equipment`);
            
            // ===== Step 2: WebSocket 연결 + 구독 =====
            if (!skipWebSocket && this._autoSubscribe) {
                this._log('📡 Step 2: Connecting WebSocket...');
                this._updateProgress(60, 0, 0);
                
                try {
                    await this._wsManager.connect();
                    this._updateProgress(80, 0, 0);
                    
                    // 구독 (500ms 딜레이로 연결 안정화)
                    await this._delay(500);
                    this._wsManager.subscribe();
                    
                    this._log('✅ WebSocket connected and subscribed');
                    
                } catch (wsError) {
                    // WebSocket 실패는 치명적이지 않음 (초기 데이터는 로드됨)
                    this._log(`⚠️ WebSocket connection failed: ${wsError.message}`);
                    this._emit(MonitoringLoaderEvents.WS_ERROR, {
                        error: wsError.message,
                        recoverable: true
                    });
                }
            }
            
            // ===== Step 3: 완료 =====
            this._updateProgress(100, this._stats.totalEquipment, this._stats.totalEquipment);
            
            this._setState(LoaderState.LOADED);
            this._loadEndTime = new Date();
            this._loadCount++;
            this._isLoading = false;
            
            const loadTime = this._loadEndTime - this._loadStartTime;
            
            this._emit(LoaderEvents.LOAD_COMPLETE, {
                loadTime,
                totalEquipment: this._stats.totalEquipment,
                connectedCount: this._stats.connectedCount,
                wsConnected: this._wsManager.isConnected()
            });
            
            // 🆕 모니터링 준비 완료 이벤트
            this._emit(MonitoringLoaderEvents.READY_FOR_MONITORING, {
                timestamp: new Date().toISOString(),
                stats: this.getStats(),
                wsConnected: this._wsManager.isConnected()
            });
            
            this._log(`✅ MonitoringDataLoader 로드 완료 (${loadTime}ms)`);
            
            return {
                success: true,
                initialData: this._initialData,
                stats: this.getStats(),
                wsConnected: this._wsManager.isConnected(),
                loadTime
            };
            
        } catch (error) {
            this._handleError(error);
            this._isLoading = false;
            
            this._emit(LoaderEvents.LOAD_ERROR, { error: error.message });
            
            throw error;
        }
    }
    
    /**
     * 리소스 정리
     * 
     * @override
     */
    dispose() {
        if (this._isDisposed) {
            this._log('⚠️ 이미 정리됨');
            return;
        }
        
        this._setState(LoaderState.DISPOSING);
        this._emit(LoaderEvents.DISPOSE_START, {});
        
        // 진행 중인 요청 취소
        this.abort();
        
        // WebSocket 연결 종료
        if (this._wsManager) {
            this._wsManager.disconnect();
        }
        
        // 캐시 정리
        this._statusCache.clear();
        this._initialData = null;
        
        // 참조 해제
        this._equipmentEditState = null;
        this._signalTowerManager = null;
        this._onStatusUpdate = null;
        
        this._isDisposed = true;
        this._isInitialized = false;
        this._setState(LoaderState.DISPOSED);
        
        this._emit(LoaderEvents.DISPOSE_COMPLETE, {});
        
        this._log('🗑️ MonitoringDataLoader 정리 완료');
    }
    
    /**
     * 현재 상태 반환
     * 
     * @override
     * @returns {Object} 상태 객체
     */
    getStatus() {
        return {
            // 기본 IDataLoader 상태
            type: this._type,
            state: this._state,
            isInitialized: this._isInitialized,
            isLoading: this._isLoading,
            isDisposed: this._isDisposed,
            loadCount: this._loadCount,
            lastError: this._lastError?.message ?? null,
            
            // MonitoringDataLoader 특화 상태
            apiBaseUrl: this._apiBaseUrl,
            wsUrl: this._wsUrl,
            wsConnected: this._wsManager?.isConnected() ?? false,
            wsConnectionState: this._wsManager?.getConnectionState() ?? 'UNKNOWN',
            subscribedCount: this._wsManager?.getSubscribedCount() ?? 0,
            
            // 통계
            stats: this.getStats(),
            
            // 캐시
            cacheSize: this._statusCache.size,
            
            // 메타 정보
            initTime: this._initTime?.toISOString() ?? null,
            loadStartTime: this._loadStartTime?.toISOString() ?? null,
            loadEndTime: this._loadEndTime?.toISOString() ?? null,
            
            // 의존성 상태
            hasEquipmentEditState: !!this._equipmentEditState,
            hasSignalTowerManager: !!this._signalTowerManager
        };
    }
    
    // =========================================================================
    // 선택적 오버라이드 메서드
    // =========================================================================
    
    /**
     * Health Check
     * 
     * @override
     * @async
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        if (!this._isInitialized || this._isDisposed) {
            return false;
        }
        
        try {
            const apiHealthy = await this._apiClient.isConnected();
            const wsConnected = this._wsManager?.isConnected() ?? false;
            
            // API가 건강하면 OK (WebSocket은 optional)
            return apiHealthy;
            
        } catch {
            return false;
        }
    }
    
    /**
     * 재연결
     * 
     * @override
     * @async
     * @returns {Promise<boolean>}
     */
    async reconnect() {
        this._log('🔌 reconnect 호출');
        
        if (this._isDisposed) {
            this._isDisposed = false;
        }
        
        try {
            // WebSocket만 재연결 (데이터는 캐시 유지)
            if (this._wsManager && !this._wsManager.isConnected()) {
                await this._wsManager.connect();
                this._wsManager.subscribe();
            }
            
            return true;
            
        } catch (error) {
            this._handleError(error);
            return false;
        }
    }
    
    // =========================================================================
    // MonitoringDataLoader 특화 메서드
    // =========================================================================
    
    /**
     * 의존성 설정
     * 
     * @param {Object} options
     */
    setDependencies(options = {}) {
        if (options.equipmentEditState) {
            this._equipmentEditState = options.equipmentEditState;
            this._log('📌 EquipmentEditState 설정됨');
        }
        
        if (options.signalTowerManager) {
            this._signalTowerManager = options.signalTowerManager;
            this._log('📌 SignalTowerManager 설정됨');
        }
    }
    
    /**
     * EquipmentEditState 설정
     * 
     * @param {Object} editState
     */
    setEquipmentEditState(editState) {
        this._equipmentEditState = editState;
    }
    
    /**
     * SignalTowerManager 설정
     * 
     * @param {Object} manager
     */
    setSignalTowerManager(manager) {
        this._signalTowerManager = manager;
    }
    
    /**
     * 상태 업데이트 콜백 설정
     * 
     * @param {Function} callback
     */
    setOnStatusUpdate(callback) {
        this._onStatusUpdate = callback;
    }
    
    /**
     * StatusAPIClient 인스턴스 반환
     * 
     * @returns {StatusAPIClient}
     */
    getApiClient() {
        return this._apiClient;
    }
    
    /**
     * WebSocketManager 인스턴스 반환
     * 
     * @returns {WebSocketManager}
     */
    getWebSocketManager() {
        return this._wsManager;
    }
    
    /**
     * WebSocket 연결 여부
     * 
     * @returns {boolean}
     */
    isWsConnected() {
        return this._wsManager?.isConnected() ?? false;
    }
    
    /**
     * 통계 반환
     * 
     * @returns {Object}
     */
    getStats() {
        return {
            totalEquipment: this._stats.totalEquipment,
            connectedCount: this._stats.connectedCount,
            disconnectedCount: this._stats.disconnectedCount,
            statusCounts: { ...this._stats.statusCounts },
            lastUpdateTime: this._stats.lastUpdateTime,
            updateCount: this._stats.updateCount,
            cacheSize: this._statusCache.size,
            wsStats: this._wsManager?.getStats() ?? null
        };
    }
    
    /**
     * 장비 상태 캐시 조회
     * 
     * @param {string} frontendId
     * @returns {Object|null}
     */
    getCachedStatus(frontendId) {
        return this._statusCache.get(frontendId) ?? null;
    }
    
    /**
     * 모든 캐시된 상태 반환
     * 
     * @returns {Object}
     */
    getAllCachedStatuses() {
        return Object.fromEntries(this._statusCache);
    }
    
    /**
     * WebSocket 재연결
     * 
     * @returns {Promise<boolean>}
     */
    async reconnectWebSocket() {
        if (this._wsManager?.isConnected()) {
            this._log('⚠️ WebSocket already connected');
            return true;
        }
        
        try {
            await this._wsManager.connect();
            this._wsManager.subscribe();
            return true;
        } catch (error) {
            this._log(`❌ WebSocket reconnect failed: ${error.message}`);
            return false;
        }
    }
    
    /**
     * WebSocket 연결 해제
     */
    disconnectWebSocket() {
        this._wsManager?.disconnect();
    }
    
    /**
     * 특정 장비 구독
     * 
     * @param {number} equipmentId
     * @returns {boolean}
     */
    subscribeEquipment(equipmentId) {
        return this._wsManager?.subscribeEquipment(equipmentId) ?? false;
    }
    
    /**
     * 단일 장비 실시간 상태 조회
     * 
     * @param {string} frontendId
     * @returns {Promise<string|null>}
     */
    async fetchLiveStatus(frontendId) {
        return await this._apiClient.fetchEquipmentLiveStatus(frontendId);
    }
    
    /**
     * DISCONNECTED 판별 기준 시간 설정
     * 
     * @param {number} hours
     */
    setStaleThreshold(hours) {
        if (hours >= 1 && hours <= 168) {
            this._staleThresholdHours = hours;
            this._log(`⏱️ Stale threshold: ${hours}h`);
        }
    }
    
    // =========================================================================
    // Private - 데이터 처리
    // =========================================================================
    
    /**
     * 초기 데이터 처리
     * @private
     */
    _processInitialData(data) {
        if (!data || !data.equipment) {
            this._log('⚠️ Invalid initial data');
            return;
        }
        
        // 통계 초기화
        this._stats.totalEquipment = data.equipment.length;
        this._stats.connectedCount = 0;
        this._stats.disconnectedCount = 0;
        this._stats.statusCounts = { RUN: 0, IDLE: 0, STOP: 0, SUDDENSTOP: 0, DISCONNECTED: 0 };
        
        // 각 장비 처리
        data.equipment.forEach(item => {
            const frontendId = this._getFrontendIdByEquipmentId(item.equipment_id);
            
            if (!frontendId) {
                // 매핑되지 않은 장비 스킵
                return;
            }
            
            // 상태 결정
            let status = item.status;
            if (item.is_connected === false || status === null) {
                status = 'DISCONNECTED';
                this._stats.disconnectedCount++;
            } else {
                this._stats.connectedCount++;
            }
            
            // 캐시에 저장
            this._statusCache.set(frontendId, {
                status: status,
                equipmentId: item.equipment_id,
                equipmentName: item.equipment_name,
                lastUpdated: item.last_updated,
                isConnected: item.is_connected !== false,
                timestamp: new Date().toISOString()
            });
            
            // 상태별 카운트
            const normalizedStatus = this._normalizeStatus(status);
            if (this._stats.statusCounts.hasOwnProperty(normalizedStatus)) {
                this._stats.statusCounts[normalizedStatus]++;
            }
        });
        
        this._stats.lastUpdateTime = new Date().toISOString();
        
        this._log(`📊 Processed ${this._stats.totalEquipment} equipment:`, this._stats.statusCounts);
    }
    
    /**
     * 상태 정규화
     * @private
     */
    _normalizeStatus(status) {
        if (!status) return 'DISCONNECTED';
        
        const normalized = status.toString().toUpperCase();
        
        switch (normalized) {
            case 'RUN':
            case 'RUNNING':
                return 'RUN';
            case 'IDLE':
            case 'WAIT':
            case 'WAITING':
                return 'IDLE';
            case 'STOP':
            case 'STOPPED':
            case 'DOWN':
                return 'STOP';
            case 'SUDDENSTOP':
            case 'ALARM':
            case 'ERROR':
                return 'SUDDENSTOP';
            case 'DISCONNECTED':
            case 'OFFLINE':
            case 'UNKNOWN':
            default:
                return 'DISCONNECTED';
        }
    }
    
    // =========================================================================
    // Private - WebSocket 콜백 핸들러
    // =========================================================================
    
    /**
     * WebSocket 연결 완료 핸들러
     * @private
     */
    _handleWsConnected(message) {
        this._log(`📡 WebSocket connected: ${message}`);
        
        this._emit(MonitoringLoaderEvents.WS_CONNECTED, {
            message,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * WebSocket 구독 완료 핸들러
     * @private
     */
    _handleWsSubscribed(message) {
        this._log(`📋 WebSocket subscribed: ${message}`);
        
        this._emit(MonitoringLoaderEvents.WS_SUBSCRIBED, {
            message,
            subscribedCount: this._wsManager.getSubscribedCount(),
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * WebSocket 연결 해제 핸들러
     * @private
     */
    _handleWsDisconnected() {
        this._log('🔌 WebSocket disconnected');
        
        this._emit(MonitoringLoaderEvents.WS_DISCONNECTED, {
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * WebSocket 에러 핸들러
     * @private
     */
    _handleWsError(error) {
        this._log(`❌ WebSocket error: ${error.message}`);
        
        this._emit(MonitoringLoaderEvents.WS_ERROR, {
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * WebSocket 재연결 시도 핸들러
     * @private
     */
    _handleWsReconnecting(attempt, max) {
        this._log(`🔄 WebSocket reconnecting... (${attempt}/${max})`);
        
        this._emit(MonitoringLoaderEvents.WS_RECONNECTING, {
            attempt,
            maxAttempts: max,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 상태 업데이트 핸들러
     * @private
     */
    _handleStatusUpdate(frontendId, data) {
        const status = data.status || 'DISCONNECTED';
        const normalizedStatus = this._normalizeStatus(status);
        
        this._log(`📊 Status update: ${frontendId} → ${normalizedStatus}`);
        
        // 이전 상태 가져오기
        const previousData = this._statusCache.get(frontendId);
        const previousStatus = previousData?.status;
        
        // 캐시 업데이트
        this._statusCache.set(frontendId, {
            status: normalizedStatus,
            rawStatus: status,
            equipmentId: data.equipment_id,
            timestamp: new Date().toISOString(),
            ...data
        });
        
        // 상태 카운트 업데이트
        if (previousStatus && previousStatus !== normalizedStatus) {
            const prevNormalized = this._normalizeStatus(previousStatus);
            if (this._stats.statusCounts.hasOwnProperty(prevNormalized)) {
                this._stats.statusCounts[prevNormalized]--;
            }
        }
        if (this._stats.statusCounts.hasOwnProperty(normalizedStatus)) {
            this._stats.statusCounts[normalizedStatus]++;
        }
        
        this._stats.updateCount++;
        this._stats.lastUpdateTime = new Date().toISOString();
        
        // 콜백 호출
        if (this._onStatusUpdate) {
            try {
                this._onStatusUpdate(frontendId, {
                    status: normalizedStatus,
                    rawStatus: status,
                    previousStatus,
                    equipmentId: data.equipment_id,
                    timestamp: new Date().toISOString(),
                    ...data
                });
            } catch (e) {
                console.error('onStatusUpdate callback error:', e);
            }
        }
        
        // 이벤트 발행
        this._emit(MonitoringLoaderEvents.STATUS_UPDATE, {
            frontendId,
            status: normalizedStatus,
            previousStatus,
            equipmentId: data.equipment_id,
            timestamp: new Date().toISOString()
        });
    }
    
    // =========================================================================
    // Private - 매핑 헬퍼
    // =========================================================================
    
    /**
     * 매핑된 Equipment ID 목록 반환
     * @private
     */
    _getMappedEquipmentIds() {
        if (!this._equipmentEditState) {
            return [];
        }
        return this._equipmentEditState.getAllEquipmentIds?.() ?? [];
    }
    
    /**
     * Equipment ID → Frontend ID 변환
     * @private
     */
    _getFrontendIdByEquipmentId(equipmentId) {
        if (!this._equipmentEditState) {
            return null;
        }
        return this._equipmentEditState.getFrontendIdByEquipmentId?.(equipmentId) ?? null;
    }
    
    // =========================================================================
    // Static 메서드
    // =========================================================================
    
    /**
     * 버전 정보
     * @static
     */
    static get VERSION() {
        return '1.0.0';
    }
    
    /**
     * MonitoringLoaderEvents 상수
     * @static
     */
    static get MonitoringLoaderEvents() {
        return MonitoringLoaderEvents;
    }
}

// ============================================================================
// 기본 내보내기
// ============================================================================

export default MonitoringDataLoader;