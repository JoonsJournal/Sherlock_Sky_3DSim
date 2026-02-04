/**
 * SiteConnectionTracker.js
 * ========================
 * Site별 WebSocket 연결 상태 추적 및 통계 관리
 * 
 * @version 1.0.0
 * @description
 * - Site별 연결 상태 모니터링
 * - 연결 성공/실패 통계 추적
 * - 연결 품질 지표 계산 (Latency, Uptime)
 * - 재연결 이력 관리
 * 
 * @changelog
 * - v1.0.0: Phase 3 - WebSocket Pool Manager 구현 (2026-02-04)
 *           - SiteConnectionInfo 클래스 구현
 *           - SiteConnectionTracker 클래스 구현
 *           - 연결 통계 및 품질 지표
 * 
 * @dependencies
 * - ./ConnectionState.js (ConnectionState, ConnectionStateMachine)
 * - ../core/managers/EventBus.js (eventBus)
 * 
 * @exports
 * - SiteConnectionInfo (Class)
 * - SiteConnectionTracker (Class)
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/SiteConnectionTracker.js
 * 작성일: 2026-02-04
 * 수정일: 2026-02-04
 */

import { ConnectionState, ConnectionStateMachine } from './ConnectionState.js';

// ============================================
// 설정 상수
// ============================================

const CONFIG = Object.freeze({
    /** 최대 재연결 이력 수 */
    MAX_RECONNECT_HISTORY: 100,
    
    /** 최대 Latency 샘플 수 */
    MAX_LATENCY_SAMPLES: 50,
    
    /** Latency 측정 타임아웃 (ms) */
    LATENCY_TIMEOUT: 5000,
    
    /** 연결 품질 임계값 */
    QUALITY_THRESHOLDS: {
        EXCELLENT: { latency: 100, uptime: 99 },
        GOOD: { latency: 300, uptime: 95 },
        FAIR: { latency: 500, uptime: 90 },
        POOR: { latency: 1000, uptime: 80 }
    }
});

// ============================================
// SiteConnectionInfo 클래스
// ============================================

/**
 * 단일 Site 연결 정보
 * 
 * @example
 * const info = new SiteConnectionInfo('CN_AAAA');
 * info.recordConnectionAttempt(true, 150);
 * console.log(info.getQuality()); // 'excellent'
 */
export class SiteConnectionInfo {
    /**
     * @param {string} siteId - Site ID
     */
    constructor(siteId) {
        this._siteId = siteId;
        this._stateMachine = new ConnectionStateMachine(siteId);
        
        // 연결 통계
        this._stats = {
            totalAttempts: 0,
            successfulConnections: 0,
            failedConnections: 0,
            totalDisconnects: 0,
            lastConnectedAt: null,
            lastDisconnectedAt: null,
            currentSessionStart: null
        };
        
        // Latency 샘플
        this._latencySamples = [];
        
        // 재연결 이력
        this._reconnectHistory = [];
        
        // WebSocket 관련
        this._websocket = null;
        this._messageInterval = null;
        this._lastMessageAt = null;
        
        // 상태 변경 리스너 등록
        this._setupStateListener();
    }
    
    // ============================================
    // Getters
    // ============================================
    
    /**
     * Site ID
     * @type {string}
     */
    get siteId() {
        return this._siteId;
    }
    
    /**
     * 현재 연결 상태
     * @type {ConnectionState}
     */
    get currentState() {
        return this._stateMachine.currentState;
    }
    
    /**
     * 상태 머신 인스턴스
     * @type {ConnectionStateMachine}
     */
    get stateMachine() {
        return this._stateMachine;
    }
    
    /**
     * WebSocket 인스턴스
     * @type {WebSocket|null}
     */
    get websocket() {
        return this._websocket;
    }
    
    /**
     * 메시지 수신 간격 (ms)
     * @type {number|null}
     */
    get messageInterval() {
        return this._messageInterval;
    }
    
    /**
     * 연결 성공률 (%)
     * @type {number}
     */
    get successRate() {
        if (this._stats.totalAttempts === 0) return 0;
        return (this._stats.successfulConnections / this._stats.totalAttempts) * 100;
    }
    
    /**
     * 평균 Latency (ms)
     * @type {number}
     */
    get averageLatency() {
        if (this._latencySamples.length === 0) return 0;
        const sum = this._latencySamples.reduce((a, b) => a + b, 0);
        return sum / this._latencySamples.length;
    }
    
    /**
     * 현재 세션 업타임 (ms)
     * @type {number}
     */
    get currentSessionUptime() {
        if (!this._stats.currentSessionStart) return 0;
        return Date.now() - this._stats.currentSessionStart;
    }
    
    /**
     * 연결 품질 등급
     * @type {'excellent'|'good'|'fair'|'poor'|'disconnected'}
     */
    get quality() {
        return this.getQuality();
    }
    
    // ============================================
    // WebSocket 관리
    // ============================================
    
    /**
     * WebSocket 인스턴스 설정
     * @param {WebSocket|null} ws - WebSocket 인스턴스
     */
    setWebSocket(ws) {
        this._websocket = ws;
        
        if (ws) {
            this._setupWebSocketListeners(ws);
        }
    }
    
    /**
     * 메시지 수신 간격 설정
     * @param {number} interval - 간격 (ms)
     */
    setMessageInterval(interval) {
        this._messageInterval = interval;
    }
    
    /**
     * WebSocket 리스너 설정
     * @private
     * @param {WebSocket} ws
     */
    _setupWebSocketListeners(ws) {
        ws.addEventListener('message', () => {
            this._lastMessageAt = Date.now();
        });
    }
    
    // ============================================
    // 연결 기록
    // ============================================
    
    /**
     * 연결 시도 기록
     * @param {boolean} success - 성공 여부
     * @param {number} [latency] - Latency (ms)
     */
    recordConnectionAttempt(success, latency = null) {
        this._stats.totalAttempts++;
        
        if (success) {
            this._stats.successfulConnections++;
            this._stats.lastConnectedAt = Date.now();
            this._stats.currentSessionStart = Date.now();
            
            if (latency !== null) {
                this.recordLatency(latency);
            }
        } else {
            this._stats.failedConnections++;
        }
    }
    
    /**
     * 연결 해제 기록
     * @param {string} [reason='unknown'] - 해제 사유
     */
    recordDisconnect(reason = 'unknown') {
        this._stats.totalDisconnects++;
        this._stats.lastDisconnectedAt = Date.now();
        this._stats.currentSessionStart = null;
        
        this._reconnectHistory.push({
            timestamp: Date.now(),
            reason,
            previousState: this._stateMachine.previousState
        });
        
        // 이력 길이 제한
        if (this._reconnectHistory.length > CONFIG.MAX_RECONNECT_HISTORY) {
            this._reconnectHistory.shift();
        }
    }
    
    /**
     * Latency 샘플 기록
     * @param {number} latency - Latency (ms)
     */
    recordLatency(latency) {
        this._latencySamples.push(latency);
        
        // 샘플 수 제한
        if (this._latencySamples.length > CONFIG.MAX_LATENCY_SAMPLES) {
            this._latencySamples.shift();
        }
    }
    
    // ============================================
    // 상태 전환
    // ============================================
    
    /**
     * 상태 전환
     * @param {ConnectionState} newState - 새 상태
     * @param {Object} [metadata={}] - 메타데이터
     * @returns {boolean}
     */
    transitionTo(newState, metadata = {}) {
        return this._stateMachine.transitionTo(newState, metadata);
    }
    
    /**
     * 상태 리스너 설정
     * @private
     */
    _setupStateListener() {
        this._stateMachine.onStateChange((oldState, newState, metadata) => {
            // 연결 해제 감지
            if (this._isDisconnectedState(newState) && this._isConnectedState(oldState)) {
                this.recordDisconnect(metadata.reason || 'state_change');
            }
            
            // 연결 성공 감지
            if (this._isConnectedState(newState) && !this._isConnectedState(oldState)) {
                this.recordConnectionAttempt(true, metadata.latency);
            }
        });
    }
    
    /**
     * 연결 상태인지 확인
     * @private
     * @param {ConnectionState} state
     * @returns {boolean}
     */
    _isConnectedState(state) {
        return [
            ConnectionState.CONNECTED_SUMMARY,
            ConnectionState.CONNECTED_FULL,
            ConnectionState.PAUSED
        ].includes(state);
    }
    
    /**
     * 연결 해제 상태인지 확인
     * @private
     * @param {ConnectionState} state
     * @returns {boolean}
     */
    _isDisconnectedState(state) {
        return [
            ConnectionState.DISCONNECTED,
            ConnectionState.ERROR
        ].includes(state);
    }
    
    // ============================================
    // 품질 평가
    // ============================================
    
    /**
     * 연결 품질 평가
     * @returns {'excellent'|'good'|'fair'|'poor'|'disconnected'}
     */
    getQuality() {
        if (!this._isConnectedState(this.currentState)) {
            return 'disconnected';
        }
        
        const latency = this.averageLatency;
        const uptime = this.successRate;
        const thresholds = CONFIG.QUALITY_THRESHOLDS;
        
        if (latency <= thresholds.EXCELLENT.latency && uptime >= thresholds.EXCELLENT.uptime) {
            return 'excellent';
        }
        if (latency <= thresholds.GOOD.latency && uptime >= thresholds.GOOD.uptime) {
            return 'good';
        }
        if (latency <= thresholds.FAIR.latency && uptime >= thresholds.FAIR.uptime) {
            return 'fair';
        }
        return 'poor';
    }
    
    /**
     * 품질 점수 계산 (0-100)
     * @returns {number}
     */
    getQualityScore() {
        if (!this._isConnectedState(this.currentState)) {
            return 0;
        }
        
        const latency = this.averageLatency;
        const uptime = this.successRate;
        
        // Latency 점수 (0-50): 낮을수록 좋음
        const latencyScore = Math.max(0, 50 - (latency / 20));
        
        // Uptime 점수 (0-50): 높을수록 좋음
        const uptimeScore = uptime / 2;
        
        return Math.round(latencyScore + uptimeScore);
    }
    
    // ============================================
    // 통계 조회
    // ============================================
    
    /**
     * 연결 통계 반환
     * @returns {Object}
     */
    getStats() {
        return {
            ...this._stats,
            successRate: this.successRate,
            averageLatency: this.averageLatency,
            currentSessionUptime: this.currentSessionUptime,
            quality: this.quality,
            qualityScore: this.getQualityScore(),
            reconnectCount: this._reconnectHistory.length
        };
    }
    
    /**
     * 재연결 이력 반환
     * @param {number} [limit=10] - 최대 개수
     * @returns {Array}
     */
    getReconnectHistory(limit = 10) {
        return this._reconnectHistory.slice(-limit);
    }
    
    // ============================================
    // 초기화
    // ============================================
    
    /**
     * 통계 초기화
     */
    resetStats() {
        this._stats = {
            totalAttempts: 0,
            successfulConnections: 0,
            failedConnections: 0,
            totalDisconnects: 0,
            lastConnectedAt: null,
            lastDisconnectedAt: null,
            currentSessionStart: null
        };
        this._latencySamples = [];
        this._reconnectHistory = [];
    }
    
    /**
     * 전체 초기화
     */
    reset() {
        this.resetStats();
        this._stateMachine.reset();
        this._websocket = null;
        this._messageInterval = null;
        this._lastMessageAt = null;
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
            siteId: this._siteId,
            currentState: this.currentState,
            stats: this.getStats(),
            quality: this.quality
        };
    }
}

// ============================================
// SiteConnectionTracker 클래스
// ============================================

/**
 * 전체 Site 연결 상태 추적기
 * 
 * @example
 * const tracker = new SiteConnectionTracker();
 * tracker.register('CN_AAAA');
 * tracker.register('KR_BBBB');
 * 
 * const summary = tracker.getSummary();
 * console.log(summary.totalSites, summary.connectedCount);
 */
export class SiteConnectionTracker {
    constructor() {
        /** @type {Map<string, SiteConnectionInfo>} */
        this._sites = new Map();
        
        /** @type {Function[]} */
        this._listeners = [];
    }
    
    // ============================================
    // Site 관리
    // ============================================
    
    /**
     * Site 등록
     * @param {string} siteId - Site ID
     * @returns {SiteConnectionInfo}
     */
    register(siteId) {
        if (this._sites.has(siteId)) {
            console.warn(`⚠️ Site already registered: ${siteId}`);
            return this._sites.get(siteId);
        }
        
        const info = new SiteConnectionInfo(siteId);
        this._sites.set(siteId, info);
        
        // 상태 변경 리스너 등록
        info.stateMachine.onStateChange((oldState, newState, metadata) => {
            this._notifyListeners({
                type: 'state_change',
                siteId,
                oldState,
                newState,
                metadata
            });
        });
        
        console.log(`✅ Site registered: ${siteId}`);
        return info;
    }
    
    /**
     * Site 등록 해제
     * @param {string} siteId - Site ID
     */
    unregister(siteId) {
        const info = this._sites.get(siteId);
        if (info) {
            info.reset();
            this._sites.delete(siteId);
            console.log(`🗑️ Site unregistered: ${siteId}`);
        }
    }
    
    /**
     * Site 정보 조회
     * @param {string} siteId - Site ID
     * @returns {SiteConnectionInfo|null}
     */
    get(siteId) {
        return this._sites.get(siteId) || null;
    }
    
    /**
     * Site 존재 여부 확인
     * @param {string} siteId - Site ID
     * @returns {boolean}
     */
    has(siteId) {
        return this._sites.has(siteId);
    }
    
    /**
     * 모든 Site ID 목록
     * @returns {string[]}
     */
    getAllSiteIds() {
        return Array.from(this._sites.keys());
    }
    
    /**
     * 모든 Site 정보
     * @returns {SiteConnectionInfo[]}
     */
    getAllSites() {
        return Array.from(this._sites.values());
    }
    
    // ============================================
    // 상태 조회
    // ============================================
    
    /**
     * 연결된 Site 목록
     * @returns {string[]}
     */
    getConnectedSites() {
        return this.getAllSites()
            .filter(info => info.stateMachine.isConnected)
            .map(info => info.siteId);
    }
    
    /**
     * 연결 해제된 Site 목록
     * @returns {string[]}
     */
    getDisconnectedSites() {
        return this.getAllSites()
            .filter(info => !info.stateMachine.isConnected)
            .map(info => info.siteId);
    }
    
    /**
     * 특정 상태의 Site 목록
     * @param {ConnectionState} state - 상태
     * @returns {string[]}
     */
    getSitesByState(state) {
        return this.getAllSites()
            .filter(info => info.currentState === state)
            .map(info => info.siteId);
    }
    
    // ============================================
    // 요약 통계
    // ============================================
    
    /**
     * 전체 요약 통계
     * @returns {Object}
     */
    getSummary() {
        const sites = this.getAllSites();
        const totalSites = sites.length;
        
        const stateCounts = {};
        let totalLatency = 0;
        let latencyCount = 0;
        
        for (const info of sites) {
            const state = info.currentState;
            stateCounts[state] = (stateCounts[state] || 0) + 1;
            
            if (info.averageLatency > 0) {
                totalLatency += info.averageLatency;
                latencyCount++;
            }
        }
        
        return {
            totalSites,
            connectedCount: this.getConnectedSites().length,
            disconnectedCount: this.getDisconnectedSites().length,
            stateCounts,
            averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
            overallQuality: this._calculateOverallQuality()
        };
    }
    
    /**
     * 전체 품질 계산
     * @private
     * @returns {'excellent'|'good'|'fair'|'poor'|'disconnected'}
     */
    _calculateOverallQuality() {
        const sites = this.getAllSites();
        if (sites.length === 0) return 'disconnected';
        
        const connectedSites = sites.filter(info => info.stateMachine.isConnected);
        if (connectedSites.length === 0) return 'disconnected';
        
        const totalScore = connectedSites.reduce((sum, info) => sum + info.getQualityScore(), 0);
        const avgScore = totalScore / connectedSites.length;
        
        if (avgScore >= 80) return 'excellent';
        if (avgScore >= 60) return 'good';
        if (avgScore >= 40) return 'fair';
        return 'poor';
    }
    
    // ============================================
    // 이벤트 리스너
    // ============================================
    
    /**
     * 이벤트 리스너 등록
     * @param {Function} callback - (event) => void
     * @returns {Function} 제거 함수
     */
    onEvent(callback) {
        this._listeners.push(callback);
        
        return () => {
            const index = this._listeners.indexOf(callback);
            if (index > -1) {
                this._listeners.splice(index, 1);
            }
        };
    }
    
    /**
     * 리스너 알림
     * @private
     * @param {Object} event
     */
    _notifyListeners(event) {
        for (const listener of this._listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('❌ Tracker listener error:', error);
            }
        }
    }
    
    // ============================================
    // 초기화
    // ============================================
    
    /**
     * 전체 초기화
     */
    reset() {
        for (const info of this._sites.values()) {
            info.reset();
        }
        this._sites.clear();
        console.log('🗑️ Connection tracker reset');
    }
    
    // ============================================
    // 직렬화
    // ============================================
    
    /**
     * JSON 직렬화
     * @returns {Object}
     */
    toJSON() {
        const sites = {};
        for (const [siteId, info] of this._sites) {
            sites[siteId] = info.toJSON();
        }
        
        return {
            sites,
            summary: this.getSummary()
        };
    }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

/** @type {SiteConnectionTracker} */
let _instance = null;

/**
 * SiteConnectionTracker 싱글톤 인스턴스 반환
 * @returns {SiteConnectionTracker}
 */
export function getConnectionTracker() {
    if (!_instance) {
        _instance = new SiteConnectionTracker();
    }
    return _instance;
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
    window._siteConnectionTracker = {
        SiteConnectionInfo,
        SiteConnectionTracker,
        getConnectionTracker,
        CONFIG
    };
}
