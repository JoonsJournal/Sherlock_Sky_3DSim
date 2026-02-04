/**
 * WebSocketPoolManager.js
 * =======================
 * Multi-Site WebSocket 연결 풀 관리자
 * 
 * @version 1.1.0
 * @description
 * - Site별 독립적 WebSocket 인스턴스 관리
 * - Mode별 연결 상태 전환 (Dashboard/Monitoring/Analysis)
 * - 자동 재연결 로직 (Exponential Backoff)
 * - 연결 효율 최적화
 * - 🆕 Analysis Mode WebSocket 완전 중단 (대역폭 100% 절감)
 * 
 * @changelog
 * - v1.1.0 (2026-02-04): Analysis Mode WebSocket PAUSE 완성
 *           - _pauseConnection(): 실제 WebSocket 연결 종료
 *           - _handleMessage(): PAUSED 상태 체크 추가
 *           - _previousModeState: Mode 복귀 시 자동 재연결
 *           - SubscriptionLevelManager 이벤트 연동
 * - v1.0.0 (2026-02-04): Phase 3 - WebSocket Pool Manager 구현
 *           - Site별 WebSocket Map 관리
 *           - Mode별 switchMode() 구현
 *           - Exponential Backoff 재연결
 * 
 * @dependencies
 * - ./ConnectionState.js (ConnectionState, ConnectionStateMachine)
 * - ./SiteConnectionTracker.js (SiteConnectionTracker, getConnectionTracker)
 * - ./ReconnectionHandler.js (setupReconnectionHandler)
 * - ../core/managers/EventBus.js (eventBus)
 * 
 * @exports
 * - WebSocketPoolManager (Class)
 * - AppMode (Enum)
 * - getWebSocketPoolManager (Singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/WebSocketPoolManager.js
 * 작성일: 2026-02-04
 * 수정일: 2026-02-04
 */

import { ConnectionState, ConnectionStateMachine } from './ConnectionState.js';
import { SiteConnectionTracker, getConnectionTracker } from './SiteConnectionTracker.js';
import { eventBus } from '../core/managers/EventBus.js';

// ============================================
// App Mode 정의
// ============================================

/**
 * 애플리케이션 Mode 정의
 * @readonly
 * @enum {string}
 */
export const AppMode = Object.freeze({
    /** Site Dashboard - 모든 Site Summary */
    DASHBOARD: 'DASHBOARD',
    
    /** Monitoring - 선택 Site Full, 나머지 Summary */
    MONITORING: 'MONITORING',
    
    /** Analysis - 모든 Site Paused (WebSocket 완전 중단) */
    ANALYSIS: 'ANALYSIS'
});

// ============================================
// 설정 상수
// ============================================

const CONFIG = Object.freeze({
    /** WebSocket 기본 설정 */
    WS: {
        /** Summary 메시지 간격 - Dashboard (ms) */
        SUMMARY_INTERVAL_DASHBOARD: 30000,
        
        /** Summary 메시지 간격 - Monitoring 비선택 Site (ms) */
        SUMMARY_INTERVAL_MONITORING: 60000,
        
        /** Full 메시지 간격 (ms) */
        FULL_INTERVAL: 10000,
        
        /** 연결 타임아웃 (ms) */
        CONNECT_TIMEOUT: 10000,
        
        /** Ping 간격 (ms) */
        PING_INTERVAL: 30000
    },
    
    /** 재연결 설정 */
    RECONNECT: {
        /** 초기 재연결 딜레이 (ms) */
        INITIAL_DELAY: 1000,
        
        /** 최대 재연결 딜레이 (ms) */
        MAX_DELAY: 30000,
        
        /** 최대 재연결 시도 횟수 */
        MAX_ATTEMPTS: 10,
        
        /** 딜레이 배수 */
        BACKOFF_MULTIPLIER: 2
    },
    
    /** API 엔드포인트 */
    ENDPOINTS: {
        /** 전체 Site Summary */
        ALL_SUMMARY: '/ws/sites/summary',
        
        /** 단일 Site Summary */
        SITE_SUMMARY: (siteId) => `/ws/sites/${siteId}/summary`,
        
        /** 단일 Site Full */
        SITE_FULL: (siteId) => `/ws/sites/${siteId}/full`,
        
        /** Health Check */
        HEALTH: '/ws/sites/health'
    }
});

// ============================================
// WebSocket 연결 정보
// ============================================

/**
 * 단일 WebSocket 연결 정보
 */
class WebSocketConnection {
    /**
     * @param {string} siteId - Site ID
     * @param {string} type - 'summary' | 'full'
     * @param {WebSocket} ws - WebSocket 인스턴스
     */
    constructor(siteId, type, ws) {
        this.siteId = siteId;
        this.type = type;
        this.ws = ws;
        this.createdAt = Date.now();
        this.lastMessageAt = null;
        this.messageCount = 0;
        this.reconnectAttempts = 0;
        this.interval = null;
    }
    
    /**
     * 메시지 수신 기록
     */
    recordMessage() {
        this.lastMessageAt = Date.now();
        this.messageCount++;
    }
    
    /**
     * 재연결 시도 기록
     */
    recordReconnectAttempt() {
        this.reconnectAttempts++;
    }
    
    /**
     * 재연결 카운터 초기화
     */
    resetReconnectAttempts() {
        this.reconnectAttempts = 0;
    }
}

// ============================================
// WebSocketPoolManager 클래스
// ============================================

/**
 * Multi-Site WebSocket 연결 풀 관리자
 * 
 * @example
 * const pool = new WebSocketPoolManager({
 *     baseUrl: 'ws://localhost:8000',
 *     sites: ['CN_AAAA', 'KR_BBBB', 'VN_CCCC']
 * });
 * 
 * // Dashboard Mode로 시작
 * await pool.switchMode(AppMode.DASHBOARD);
 * 
 * // Monitoring Mode로 전환
 * await pool.switchMode(AppMode.MONITORING, 'CN_AAAA');
 * 
 * // Analysis Mode로 전환 (모든 WebSocket 중단!)
 * await pool.switchMode(AppMode.ANALYSIS);
 */
export class WebSocketPoolManager {
    /**
     * @param {Object} options - 옵션
     * @param {string} options.baseUrl - WebSocket 서버 기본 URL
     * @param {string[]} [options.sites=[]] - 관리할 Site ID 목록
     * @param {boolean} [options.autoConnect=false] - 자동 연결 여부
     */
    constructor(options = {}) {
        const { baseUrl, sites = [], autoConnect = false } = options;
        
        if (!baseUrl) {
            throw new Error('baseUrl is required');
        }
        
        /** @type {string} WebSocket 서버 기본 URL */
        this._baseUrl = baseUrl.replace(/\/$/, ''); // 후행 슬래시 제거
        
        /** @type {Map<string, WebSocketConnection>} Site별 WebSocket 연결 */
        this._connections = new Map();
        
        /** @type {SiteConnectionTracker} 연결 상태 추적기 */
        this._tracker = getConnectionTracker();
        
        /** @type {AppMode} 현재 Mode */
        this._currentMode = null;
        
        /** @type {string|null} 현재 선택된 Site (Monitoring Mode) */
        this._selectedSiteId = null;
        
        /** @type {Map<string, number>} 재연결 타이머 */
        this._reconnectTimers = new Map();
        
        /** @type {boolean} 초기화 완료 여부 */
        this._initialized = false;
        
        /** @type {Function[]} 이벤트 리스너 */
        this._listeners = [];
        
        /**
         * 🆕 v1.1.0: Analysis Mode 복귀를 위한 이전 Mode 상태 저장
         * @type {Object|null}
         */
        this._previousModeState = null;
        
        /**
         * 🆕 v1.1.0: 메시지 처리 활성화 여부
         * @type {boolean}
         */
        this._messageProcessingEnabled = true;
        
        // Site 등록
        for (const siteId of sites) {
            this._tracker.register(siteId);
        }
        
        // 🆕 v1.1.0: SubscriptionLevelManager 이벤트 구독
        this._setupSubscriptionEvents();
        
        // 자동 연결
        if (autoConnect && sites.length > 0) {
            this.switchMode(AppMode.DASHBOARD);
        }
        
        console.log('🔌 [WebSocketPoolManager] 생성됨 (v1.1.0)', {
            baseUrl: this._baseUrl,
            sites: sites.length
        });
    }
    
    // ============================================
    // Getters
    // ============================================
    
    /**
     * 현재 Mode
     * @type {AppMode|null}
     */
    get currentMode() {
        return this._currentMode;
    }
    
    /**
     * 현재 선택된 Site ID
     * @type {string|null}
     */
    get selectedSiteId() {
        return this._selectedSiteId;
    }
    
    /**
     * 연결된 Site 수
     * @type {number}
     */
    get connectedCount() {
        return this._tracker.getConnectedSites().length;
    }
    
    /**
     * 전체 Site 수
     * @type {number}
     */
    get totalSites() {
        return this._tracker.getAllSiteIds().length;
    }
    
    /**
     * 연결 상태 추적기
     * @type {SiteConnectionTracker}
     */
    get tracker() {
        return this._tracker;
    }
    
    /**
     * 🆕 v1.1.0: Analysis Mode 여부
     * @type {boolean}
     */
    get isPaused() {
        return this._currentMode === AppMode.ANALYSIS;
    }
    
    /**
     * 🆕 v1.1.0: 메시지 처리 활성화 여부
     * @type {boolean}
     */
    get isMessageProcessingEnabled() {
        return this._messageProcessingEnabled;
    }
    
    // ============================================
    // Site 관리
    // ============================================
    
    /**
     * Site 추가
     * @param {string} siteId - Site ID
     */
    addSite(siteId) {
        if (!this._tracker.has(siteId)) {
            this._tracker.register(siteId);
            console.log(`➕ [WebSocketPoolManager] Site 추가됨: ${siteId}`);
            
            // 현재 Mode에 맞게 연결 (Analysis Mode면 연결하지 않음)
            if (this._currentMode && this._currentMode !== AppMode.ANALYSIS) {
                this._connectSiteForCurrentMode(siteId);
            }
        }
    }
    
    /**
     * Site 제거
     * @param {string} siteId - Site ID
     */
    removeSite(siteId) {
        if (this._tracker.has(siteId)) {
            this._closeConnection(siteId);
            this._tracker.unregister(siteId);
            console.log(`➖ [WebSocketPoolManager] Site 제거됨: ${siteId}`);
        }
    }
    
    /**
     * 모든 Site ID 목록
     * @returns {string[]}
     */
    getSiteIds() {
        return this._tracker.getAllSiteIds();
    }
    
    // ============================================
    // Mode 전환
    // ============================================
    
    /**
     * Mode 전환
     * @param {AppMode} mode - 대상 Mode
     * @param {string} [selectedSiteId=null] - 선택된 Site (Monitoring Mode)
     * @returns {Promise<void>}
     */
    async switchMode(mode, selectedSiteId = null) {
        const previousMode = this._currentMode;
        
        console.log(`🔄 [WebSocketPoolManager] Mode 전환: ${previousMode || 'NONE'} → ${mode}`);
        
        // Monitoring Mode는 selectedSiteId 필수
        if (mode === AppMode.MONITORING && !selectedSiteId) {
            throw new Error('Monitoring mode requires selectedSiteId');
        }
        
        // 🆕 v1.1.0: Analysis Mode 진입 전 현재 상태 저장
        if (mode === AppMode.ANALYSIS && previousMode !== AppMode.ANALYSIS) {
            this._savePreviousModeState();
        }
        
        this._currentMode = mode;
        this._selectedSiteId = selectedSiteId;
        
        // Mode별 WebSocket 전략 적용
        switch (mode) {
            case AppMode.DASHBOARD:
                await this._applyDashboardMode();
                break;
                
            case AppMode.MONITORING:
                await this._applyMonitoringMode(selectedSiteId);
                break;
                
            case AppMode.ANALYSIS:
                await this._applyAnalysisMode();
                break;
                
            default:
                throw new Error(`Unknown mode: ${mode}`);
        }
        
        // 이벤트 발행
        this._emitEvent('mode:changed', {
            previousMode,
            currentMode: mode,
            selectedSiteId
        });
        
        eventBus.emit('websocket:mode-changed', {
            previousMode,
            currentMode: mode,
            selectedSiteId
        });
        
        console.log(`✅ [WebSocketPoolManager] Mode 전환 완료: ${mode}`);
    }
    
    /**
     * Dashboard Mode 적용
     * - 모든 Site: Summary (30초)
     * @private
     */
    async _applyDashboardMode() {
        // 🆕 v1.1.0: 메시지 처리 활성화
        this._messageProcessingEnabled = true;
        
        const sites = this._tracker.getAllSiteIds();
        
        for (const siteId of sites) {
            await this._connectSummary(siteId, CONFIG.WS.SUMMARY_INTERVAL_DASHBOARD);
        }
    }
    
    /**
     * Monitoring Mode 적용
     * - 선택 Site: Full (10초)
     * - 기타 Site: Summary (60초)
     * @private
     * @param {string} selectedSiteId
     */
    async _applyMonitoringMode(selectedSiteId) {
        // 🆕 v1.1.0: 메시지 처리 활성화
        this._messageProcessingEnabled = true;
        
        const sites = this._tracker.getAllSiteIds();
        
        for (const siteId of sites) {
            if (siteId === selectedSiteId) {
                // 선택된 Site: Full 연결
                await this._connectFull(siteId, CONFIG.WS.FULL_INTERVAL);
            } else {
                // 기타 Site: Summary (간격 증가)
                await this._connectSummary(siteId, CONFIG.WS.SUMMARY_INTERVAL_MONITORING);
            }
        }
    }
    
    /**
     * 🆕 v1.1.0: Analysis Mode 적용 (WebSocket 완전 중단!)
     * - 모든 Site: WebSocket 연결 종료
     * - 대역폭 100% 절감
     * @private
     */
    async _applyAnalysisMode() {
        console.log('⏸️ [WebSocketPoolManager] Analysis Mode - 모든 WebSocket 연결 종료');
        
        // 🔴 CRITICAL: 메시지 처리 비활성화
        this._messageProcessingEnabled = false;
        
        const sites = this._tracker.getAllSiteIds();
        let closedCount = 0;
        
        for (const siteId of sites) {
            const closed = await this._pauseConnection(siteId);
            if (closed) closedCount++;
        }
        
        // 이벤트 발행
        eventBus.emit('websocket:all-paused', {
            mode: AppMode.ANALYSIS,
            closedConnections: closedCount,
            totalSites: sites.length
        });
        
        console.log(`⏸️ [WebSocketPoolManager] ${closedCount}/${sites.length} 연결 종료 완료`);
    }
    
    /**
     * 현재 Mode에 맞게 Site 연결
     * @private
     * @param {string} siteId
     */
    async _connectSiteForCurrentMode(siteId) {
        switch (this._currentMode) {
            case AppMode.DASHBOARD:
                await this._connectSummary(siteId, CONFIG.WS.SUMMARY_INTERVAL_DASHBOARD);
                break;
                
            case AppMode.MONITORING:
                if (siteId === this._selectedSiteId) {
                    await this._connectFull(siteId, CONFIG.WS.FULL_INTERVAL);
                } else {
                    await this._connectSummary(siteId, CONFIG.WS.SUMMARY_INTERVAL_MONITORING);
                }
                break;
                
            case AppMode.ANALYSIS:
                // Analysis Mode에서는 연결하지 않음
                await this._pauseConnection(siteId);
                break;
        }
    }
    
    // ============================================
    // 🆕 v1.1.0: 이전 Mode 상태 관리
    // ============================================
    
    /**
     * Analysis Mode 진입 전 현재 상태 저장
     * @private
     */
    _savePreviousModeState() {
        this._previousModeState = {
            mode: this._currentMode,
            selectedSiteId: this._selectedSiteId,
            savedAt: Date.now()
        };
        
        console.log('💾 [WebSocketPoolManager] 이전 Mode 상태 저장:', this._previousModeState);
    }
    
    /**
     * Analysis Mode에서 이전 Mode로 복귀
     * @returns {Promise<boolean>} 복귀 성공 여부
     */
    async restoreFromAnalysis() {
        if (this._currentMode !== AppMode.ANALYSIS) {
            console.warn('⚠️ [WebSocketPoolManager] Analysis Mode가 아닙니다');
            return false;
        }
        
        if (!this._previousModeState) {
            console.warn('⚠️ [WebSocketPoolManager] 이전 Mode 상태가 없습니다. Dashboard로 전환합니다.');
            await this.switchMode(AppMode.DASHBOARD);
            return true;
        }
        
        const { mode, selectedSiteId } = this._previousModeState;
        
        console.log(`🔄 [WebSocketPoolManager] 이전 Mode로 복귀: ${mode}`);
        
        await this.switchMode(mode, selectedSiteId);
        this._previousModeState = null;
        
        return true;
    }
    
    // ============================================
    // WebSocket 연결 관리
    // ============================================
    
    /**
     * Summary WebSocket 연결
     * @private
     * @param {string} siteId
     * @param {number} interval
     */
    async _connectSummary(siteId, interval) {
        const info = this._tracker.get(siteId);
        if (!info) {
            console.warn(`⚠️ [WebSocketPoolManager] Unknown site: ${siteId}`);
            return;
        }
        
        // 이미 Summary 연결 중이면 간격만 변경
        const existing = this._connections.get(siteId);
        if (existing?.type === 'summary' && existing.ws?.readyState === WebSocket.OPEN) {
            existing.interval = interval;
            console.log(`📊 [${siteId}] Summary 간격 변경: ${interval}ms`);
            return;
        }
        
        // 기존 연결 종료
        this._closeConnection(siteId);
        
        // 상태 전환: CONNECTING
        info.transitionTo(ConnectionState.CONNECTING);
        
        const endpoint = CONFIG.ENDPOINTS.SITE_SUMMARY(siteId);
        const url = `${this._baseUrl}${endpoint}?interval=${interval}`;
        
        try {
            const ws = await this._createWebSocket(url, siteId, 'summary');
            
            const conn = new WebSocketConnection(siteId, 'summary', ws);
            conn.interval = interval;
            this._connections.set(siteId, conn);
            
            // 상태 전환: CONNECTED_SUMMARY
            info.transitionTo(ConnectionState.CONNECTED_SUMMARY);
            info.setWebSocket(ws);
            info.setMessageInterval(interval);
            
            console.log(`📊 [${siteId}] Summary 연결 완료 (${interval}ms)`);
            
        } catch (error) {
            console.error(`❌ [${siteId}] Summary 연결 실패:`, error);
            info.transitionTo(ConnectionState.ERROR);
            this._scheduleReconnect(siteId);
        }
    }
    
    /**
     * Full WebSocket 연결
     * @private
     * @param {string} siteId
     * @param {number} interval
     */
    async _connectFull(siteId, interval) {
        const info = this._tracker.get(siteId);
        if (!info) {
            console.warn(`⚠️ [WebSocketPoolManager] Unknown site: ${siteId}`);
            return;
        }
        
        // 기존 연결 종료
        this._closeConnection(siteId);
        
        // 상태 전환: CONNECTING
        info.transitionTo(ConnectionState.CONNECTING);
        
        const endpoint = CONFIG.ENDPOINTS.SITE_FULL(siteId);
        const url = `${this._baseUrl}${endpoint}?interval=${interval}`;
        
        try {
            const ws = await this._createWebSocket(url, siteId, 'full');
            
            const conn = new WebSocketConnection(siteId, 'full', ws);
            conn.interval = interval;
            this._connections.set(siteId, conn);
            
            // 상태 전환: CONNECTED_FULL
            info.transitionTo(ConnectionState.CONNECTED_FULL);
            info.setWebSocket(ws);
            info.setMessageInterval(interval);
            
            console.log(`🟢 [${siteId}] Full 연결 완료 (${interval}ms)`);
            
        } catch (error) {
            console.error(`❌ [${siteId}] Full 연결 실패:`, error);
            info.transitionTo(ConnectionState.ERROR);
            this._scheduleReconnect(siteId);
        }
    }
    
    /**
     * WebSocket 생성 및 연결
     * @private
     * @param {string} url
     * @param {string} siteId
     * @param {string} type
     * @returns {Promise<WebSocket>}
     */
    _createWebSocket(url, siteId, type) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const ws = new WebSocket(url);
            
            // 타임아웃 설정
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, CONFIG.WS.CONNECT_TIMEOUT);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                const latency = Date.now() - startTime;
                
                // Latency 기록
                const info = this._tracker.get(siteId);
                info?.recordLatency(latency);
                
                // 재연결 카운터 초기화
                const conn = this._connections.get(siteId);
                conn?.resetReconnectAttempts();
                
                console.log(`🔗 [${siteId}] WebSocket 연결됨 (${type}, ${latency}ms)`);
                resolve(ws);
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                console.error(`❌ [${siteId}] WebSocket 에러:`, error);
                reject(error);
            };
            
            ws.onclose = (event) => {
                clearTimeout(timeout);
                this._handleClose(siteId, event);
            };
            
            ws.onmessage = (event) => {
                this._handleMessage(siteId, event);
            };
        });
    }
    
    /**
     * 🆕 v1.1.0: 연결 일시 정지 (Analysis Mode) - 실제 WebSocket 종료!
     * @private
     * @param {string} siteId
     * @returns {Promise<boolean>} 연결 종료 여부
     */
    async _pauseConnection(siteId) {
        const info = this._tracker.get(siteId);
        if (!info) return false;
        
        const conn = this._connections.get(siteId);
        
        // 🔴 CRITICAL: 재연결 타이머 취소 (Analysis Mode에서 자동 재연결 방지)
        this._cancelReconnect(siteId);
        
        if (!conn || !conn.ws) {
            // 연결이 없으면 PAUSED 상태로
            if (info.currentState !== ConnectionState.PAUSED) {
                info.transitionTo(ConnectionState.PAUSED);
            }
            return false;
        }
        
        // 🔴 CRITICAL: WebSocket 연결 실제 종료
        try {
            // 서버에 pause 메시지 전송 (선택적)
            if (conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify({
                    type: 'pause',
                    reason: 'analysis_mode'
                }));
            }
            
            // WebSocket 종료 (정상 종료 코드 사용)
            conn.ws.close(1000, 'Analysis mode - pausing');
            
        } catch (error) {
            console.warn(`⚠️ [${siteId}] WebSocket 종료 중 에러:`, error);
        }
        
        // 연결 정보 제거
        this._connections.delete(siteId);
        
        // 상태 전환: PAUSED
        info.transitionTo(ConnectionState.PAUSED);
        info.setWebSocket(null);
        
        console.log(`⏸️ [${siteId}] WebSocket 연결 종료 (Analysis Mode)`);
        
        // 이벤트 발행
        eventBus.emit('websocket:paused', { siteId });
        
        return true;
    }
    
    /**
     * 연결 종료
     * @private
     * @param {string} siteId
     */
    _closeConnection(siteId) {
        // 재연결 타이머 취소
        this._cancelReconnect(siteId);
        
        const conn = this._connections.get(siteId);
        if (conn?.ws) {
            try {
                conn.ws.close(1000, 'Normal closure');
            } catch (error) {
                console.warn(`⚠️ [${siteId}] WebSocket 종료 에러:`, error);
            }
        }
        
        this._connections.delete(siteId);
    }
    
    // ============================================
    // 메시지 핸들링
    // ============================================
    
    /**
     * 🆕 v1.1.0: WebSocket 메시지 처리 (PAUSED 상태 체크 추가)
     * @private
     * @param {string} siteId
     * @param {MessageEvent} event
     */
    _handleMessage(siteId, event) {
        // 🔴 CRITICAL: Analysis Mode에서는 메시지 처리하지 않음
        if (!this._messageProcessingEnabled) {
            console.debug(`🚫 [${siteId}] 메시지 무시됨 (Analysis Mode)`);
            return;
        }
        
        // PAUSED 상태 체크
        const info = this._tracker.get(siteId);
        if (info?.currentState === ConnectionState.PAUSED) {
            console.debug(`🚫 [${siteId}] 메시지 무시됨 (PAUSED 상태)`);
            return;
        }
        
        const conn = this._connections.get(siteId);
        if (conn) {
            conn.recordMessage();
        }
        
        try {
            const data = JSON.parse(event.data);
            
            // 이벤트 발행
            this._emitEvent('message', {
                siteId,
                type: data.type,
                data
            });
            
            // EventBus를 통한 글로벌 이벤트
            eventBus.emit(`websocket:message:${siteId}`, data);
            eventBus.emit('websocket:message', { siteId, data });
            
        } catch (error) {
            console.error(`❌ [${siteId}] 메시지 파싱 에러:`, error);
        }
    }
    
    /**
     * WebSocket 종료 처리
     * @private
     * @param {string} siteId
     * @param {CloseEvent} event
     */
    _handleClose(siteId, event) {
        const info = this._tracker.get(siteId);
        
        // 🆕 v1.1.0: Analysis Mode에서는 재연결하지 않음
        if (this._currentMode === AppMode.ANALYSIS) {
            console.log(`🔌 [${siteId}] WebSocket 종료됨 (Analysis Mode - 재연결 안 함)`);
            info?.transitionTo(ConnectionState.PAUSED);
            this._connections.delete(siteId);
            return;
        }
        
        if (event.code === 1000) {
            // 정상 종료
            console.log(`🔌 [${siteId}] WebSocket 정상 종료`);
            info?.transitionTo(ConnectionState.DISCONNECTED);
        } else {
            // 비정상 종료 → 재연결
            console.warn(`⚠️ [${siteId}] WebSocket 비정상 종료 (code: ${event.code})`);
            info?.transitionTo(ConnectionState.RECONNECTING);
            info?.recordDisconnect(`close_code_${event.code}`);
            
            this._scheduleReconnect(siteId);
        }
        
        this._connections.delete(siteId);
        
        // 이벤트 발행
        this._emitEvent('close', {
            siteId,
            code: event.code,
            reason: event.reason
        });
    }
    
    // ============================================
    // 재연결 로직
    // ============================================
    
    /**
     * 재연결 스케줄링
     * @private
     * @param {string} siteId
     */
    _scheduleReconnect(siteId) {
        // 🆕 v1.1.0: Analysis Mode에서는 재연결하지 않음
        if (this._currentMode === AppMode.ANALYSIS) {
            console.log(`🚫 [${siteId}] 재연결 스킵 (Analysis Mode)`);
            return;
        }
        
        // 기존 타이머 취소
        this._cancelReconnect(siteId);
        
        const info = this._tracker.get(siteId);
        const conn = this._connections.get(siteId);
        const attempts = conn?.reconnectAttempts || 0;
        
        if (attempts >= CONFIG.RECONNECT.MAX_ATTEMPTS) {
            console.error(`❌ [${siteId}] 최대 재연결 시도 초과 (${attempts}회)`);
            info?.transitionTo(ConnectionState.ERROR);
            
            this._emitEvent('reconnect:failed', { siteId, attempts });
            return;
        }
        
        // Exponential Backoff 딜레이 계산
        const delay = Math.min(
            CONFIG.RECONNECT.INITIAL_DELAY * Math.pow(CONFIG.RECONNECT.BACKOFF_MULTIPLIER, attempts),
            CONFIG.RECONNECT.MAX_DELAY
        );
        
        console.log(`🔄 [${siteId}] 재연결 예약 (${delay}ms 후, 시도 ${attempts + 1}/${CONFIG.RECONNECT.MAX_ATTEMPTS})`);
        
        const timer = setTimeout(async () => {
            this._reconnectTimers.delete(siteId);
            
            // 🆕 v1.1.0: 재연결 전 Analysis Mode 체크
            if (this._currentMode === AppMode.ANALYSIS) {
                console.log(`🚫 [${siteId}] 재연결 취소됨 (Analysis Mode로 전환됨)`);
                return;
            }
            
            if (conn) {
                conn.recordReconnectAttempt();
            }
            
            // 현재 Mode에 맞게 재연결
            await this._connectSiteForCurrentMode(siteId);
            
        }, delay);
        
        this._reconnectTimers.set(siteId, timer);
    }
    
    /**
     * 재연결 타이머 취소
     * @private
     * @param {string} siteId
     */
    _cancelReconnect(siteId) {
        const timer = this._reconnectTimers.get(siteId);
        if (timer) {
            clearTimeout(timer);
            this._reconnectTimers.delete(siteId);
        }
    }
    
    /**
     * 🆕 v1.1.0: 모든 재연결 타이머 취소
     * @private
     */
    _cancelAllReconnects() {
        for (const [siteId, timer] of this._reconnectTimers) {
            clearTimeout(timer);
        }
        this._reconnectTimers.clear();
        console.log('🚫 [WebSocketPoolManager] 모든 재연결 타이머 취소됨');
    }
    
    /**
     * 수동 재연결
     * @param {string} siteId
     */
    async reconnect(siteId) {
        // 🆕 v1.1.0: Analysis Mode에서는 재연결 불가
        if (this._currentMode === AppMode.ANALYSIS) {
            console.warn(`⚠️ [${siteId}] Analysis Mode에서는 재연결할 수 없습니다`);
            return;
        }
        
        console.log(`🔄 [${siteId}] 수동 재연결 시작`);
        
        // 재연결 카운터 초기화
        const conn = this._connections.get(siteId);
        if (conn) {
            conn.resetReconnectAttempts();
        }
        
        await this._connectSiteForCurrentMode(siteId);
    }
    
    /**
     * 전체 재연결
     */
    async reconnectAll() {
        // 🆕 v1.1.0: Analysis Mode에서는 재연결 불가
        if (this._currentMode === AppMode.ANALYSIS) {
            console.warn('⚠️ [WebSocketPoolManager] Analysis Mode에서는 재연결할 수 없습니다');
            return;
        }
        
        console.log('🔄 [WebSocketPoolManager] 전체 Site 재연결 시작');
        
        const sites = this._tracker.getAllSiteIds();
        for (const siteId of sites) {
            await this.reconnect(siteId);
        }
    }
    
    // ============================================
    // 🆕 v1.1.0: SubscriptionLevelManager 이벤트 연동
    // ============================================
    
    /**
     * SubscriptionLevelManager 이벤트 구독
     * @private
     */
    _setupSubscriptionEvents() {
        // WebSocket 상태 변경 요청 수신
        eventBus.on('subscription:websocket-state-request', async (data) => {
            const { state, context } = data || {};
            
            if (state === 'PAUSED' && this._currentMode !== AppMode.ANALYSIS) {
                console.log('📊 [WebSocketPoolManager] SubscriptionLevelManager 요청: PAUSE');
                await this.switchMode(AppMode.ANALYSIS);
            } else if (state === 'ACTIVE' && this._currentMode === AppMode.ANALYSIS) {
                console.log('📊 [WebSocketPoolManager] SubscriptionLevelManager 요청: RESUME');
                await this.restoreFromAnalysis();
            }
        });
        
        console.log('🔗 [WebSocketPoolManager] SubscriptionLevelManager 이벤트 연동 완료');
    }
    
    // ============================================
    // 이벤트 관리
    // ============================================
    
    /**
     * 이벤트 리스너 등록
     * @param {string} event - 이벤트 이름
     * @param {Function} callback
     * @returns {Function} 제거 함수
     */
    on(event, callback) {
        const listener = { event, callback };
        this._listeners.push(listener);
        
        return () => {
            const index = this._listeners.indexOf(listener);
            if (index > -1) {
                this._listeners.splice(index, 1);
            }
        };
    }
    
    /**
     * 이벤트 발행
     * @private
     * @param {string} event
     * @param {Object} data
     */
    _emitEvent(event, data) {
        for (const listener of this._listeners) {
            if (listener.event === event || listener.event === '*') {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error(`❌ Event listener error (${event}):`, error);
                }
            }
        }
    }
    
    // ============================================
    // 상태 조회
    // ============================================
    
    /**
     * 전체 연결 상태 요약
     * @returns {Object}
     */
    getStatus() {
        return {
            currentMode: this._currentMode,
            selectedSiteId: this._selectedSiteId,
            isPaused: this.isPaused,
            messageProcessingEnabled: this._messageProcessingEnabled,
            previousModeState: this._previousModeState,
            ...this._tracker.getSummary(),
            connections: this._getConnectionsStatus()
        };
    }
    
    /**
     * 연결 상태 상세
     * @private
     * @returns {Object}
     */
    _getConnectionsStatus() {
        const status = {};
        
        for (const [siteId, conn] of this._connections) {
            status[siteId] = {
                type: conn.type,
                interval: conn.interval,
                readyState: conn.ws?.readyState,
                messageCount: conn.messageCount,
                lastMessageAt: conn.lastMessageAt,
                reconnectAttempts: conn.reconnectAttempts
            };
        }
        
        return status;
    }
    
    /**
     * Site별 연결 정보 조회
     * @param {string} siteId
     * @returns {Object|null}
     */
    getSiteStatus(siteId) {
        const info = this._tracker.get(siteId);
        const conn = this._connections.get(siteId);
        
        if (!info) return null;
        
        return {
            siteId,
            ...info.toJSON(),
            connection: conn ? {
                type: conn.type,
                interval: conn.interval,
                readyState: conn.ws?.readyState,
                messageCount: conn.messageCount
            } : null
        };
    }
    
    // ============================================
    // 정리
    // ============================================
    
    /**
     * 모든 연결 종료
     */
    closeAll() {
        console.log('🔌 [WebSocketPoolManager] 모든 WebSocket 연결 종료');
        
        // 모든 재연결 타이머 취소
        this._cancelAllReconnects();
        
        for (const siteId of this._connections.keys()) {
            this._closeConnection(siteId);
        }
        
        this._currentMode = null;
        this._selectedSiteId = null;
        this._previousModeState = null;
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('🗑️ [WebSocketPoolManager] 정리');
        
        this.closeAll();
        this._tracker.reset();
        this._listeners = [];
    }
    
    // ============================================
    // 직렬화
    // ============================================
    
    /**
     * JSON 직렬화
     * @returns {Object}
     */
    toJSON() {
        return {
            baseUrl: this._baseUrl,
            currentMode: this._currentMode,
            selectedSiteId: this._selectedSiteId,
            isPaused: this.isPaused,
            status: this.getStatus()
        };
    }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

/** @type {WebSocketPoolManager|null} */
let _poolInstance = null;

/**
 * WebSocketPoolManager 싱글톤 생성/반환
 * @param {Object} [options] - 초기화 옵션 (최초 호출 시)
 * @returns {WebSocketPoolManager}
 */
export function getWebSocketPoolManager(options = null) {
    if (!_poolInstance && options) {
        _poolInstance = new WebSocketPoolManager(options);
    }
    
    if (!_poolInstance) {
        throw new Error('WebSocketPoolManager not initialized. Call with options first.');
    }
    
    return _poolInstance;
}

/**
 * 싱글톤 인스턴스 초기화 (테스트용)
 */
export function resetWebSocketPoolManager() {
    if (_poolInstance) {
        _poolInstance.dispose();
        _poolInstance = null;
    }
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
    window._webSocketPoolManager = {
        WebSocketPoolManager,
        AppMode,
        getWebSocketPoolManager,
        resetWebSocketPoolManager,
        CONFIG
    };
}