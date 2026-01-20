/**
 * UDSApiClient.js
 * ================
 * UDS (Unified Data Store) API 통신 클라이언트
 * 
 * @version 1.0.0
 * @description
 * - 초기 데이터 로드 (/api/uds/initial)
 * - 단일 설비 조회 (/api/uds/equipment/{id})
 * - WebSocket 연결 관리 (Delta Update 수신)
 * - Ping/Pong 지원 (Latency 측정)
 * 
 * @changelog
 * - v1.0.0: 초기 버전 (2026-01-20)
 *   - REST API: fetchInitialData, fetchEquipment
 *   - WebSocket: connectWebSocket, disconnectWebSocket, sendPing
 *   - 자동 재연결 로직 (Exponential Backoff)
 * 
 * @dependencies
 * - config/environment.js (ENV, buildApiUrl)
 * 
 * @exports
 * - UDSApiClient (class)
 * - udsApiClient (singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/api/UDSApiClient.js
 * 작성일: 2026-01-20
 * 수정일: 2026-01-20
 */

import { ENV, buildApiUrl } from '../config/environment.js';

export class UDSApiClient {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * WebSocket 상태 상수
     */
    static WS_STATE = {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
    };
    
    /**
     * 기본 설정
     */
    static DEFAULTS = {
        MAX_RECONNECT_ATTEMPTS: 5,
        PING_INTERVAL: 5000,        // 5초
        RECONNECT_BASE_DELAY: 1000, // 1초
        MAX_RECONNECT_DELAY: 30000  // 30초
    };
    
    // =========================================================================
    // Constructor
    // =========================================================================
    
    constructor() {
        /** @type {string} API Base URL */
        this._baseUrl = ENV.API_BASE_URL || 'http://localhost:8008/api';
        
        /** @type {WebSocket|null} WebSocket 인스턴스 */
        this._ws = null;
        
        /** @type {number} WebSocket 재연결 시도 횟수 */
        this._wsReconnectAttempts = 0;
        
        /** @type {number} 최대 재연결 시도 횟수 */
        this._maxReconnectAttempts = UDSApiClient.DEFAULTS.MAX_RECONNECT_ATTEMPTS;
        
        /** @type {number|null} Ping 타임스탬프 (Latency 측정용) */
        this._pingTimestamp = null;
        
        /** @type {number|null} Ping 인터벌 ID */
        this._pingInterval = null;
        
        /** @type {number} 마지막 측정 Latency (ms) */
        this._lastLatency = 0;
        
        /** @type {Object|null} 재연결 파라미터 (재연결 시 사용) */
        this._reconnectParams = null;
        
        /** @type {Function|null} 메시지 콜백 */
        this._onMessageCallback = null;
        
        /** @type {Function|null} 에러 콜백 */
        this._onErrorCallback = null;
        
        console.log('🚀 [UDSApiClient] 초기화 완료');
        console.log(`   └─ API Base URL: ${this._baseUrl}`);
    }
    
    // =========================================================================
    // REST API Methods
    // =========================================================================
    
    /**
     * 전체 설비 초기 데이터 로드
     * GET /api/uds/initial
     * 
     * @param {Object} params - 요청 파라미터
     * @param {number} [params.siteId=1] - Site ID
     * @param {number} [params.lineId=1] - Line ID
     * @returns {Promise<Object>} UDSInitialResponse
     * @throws {Error} API 호출 실패 시
     */
    async fetchInitialData(params = {}) {
        const { siteId = 1, lineId = 1 } = params;
        
        const url = new URL(`${this._baseUrl}/uds/initial`);
        url.searchParams.set('site_id', siteId);
        url.searchParams.set('line_id', lineId);
        
        console.log(`📡 [UDSApiClient] 초기 데이터 요청: ${url}`);
        const startTime = performance.now();
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`초기 데이터 로드 실패 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            const loadTime = performance.now() - startTime;
            
            console.log(`✅ [UDSApiClient] 초기 데이터 로드 완료`);
            console.log(`   └─ 설비 수: ${data.total_count}개`);
            console.log(`   └─ 소요 시간: ${loadTime.toFixed(2)}ms`);
            
            return data;
            
        } catch (error) {
            console.error(`❌ [UDSApiClient] 초기 데이터 로드 실패:`, error);
            throw error;
        }
    }
    
    /**
     * 단일 설비 조회 (캐시 미스 시에만 사용)
     * GET /api/uds/equipment/{frontend_id}
     * 
     * @param {string} frontendId - Frontend ID (예: EQ-01-01)
     * @returns {Promise<Object|null>} EquipmentData or null
     * @throws {Error} API 호출 실패 시 (404 제외)
     */
    async fetchEquipment(frontendId) {
        const url = `${this._baseUrl}/uds/equipment/${frontendId}`;
        
        console.log(`📡 [UDSApiClient] 단일 설비 조회: ${frontendId}`);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`⚠️ [UDSApiClient] 설비 없음: ${frontendId}`);
                    return null;
                }
                const errorText = await response.text();
                throw new Error(`설비 조회 실패 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            console.log(`✅ [UDSApiClient] 설비 조회 완료: ${frontendId}`);
            
            return data;
            
        } catch (error) {
            console.error(`❌ [UDSApiClient] 설비 조회 실패 (${frontendId}):`, error);
            throw error;
        }
    }
    
    /**
     * 헬스체크
     * GET /api/uds/health
     * 
     * @returns {Promise<Object>} 헬스체크 응답
     */
    async healthCheck() {
        const url = `${this._baseUrl}/uds/health`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`헬스체크 실패: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`❌ [UDSApiClient] 헬스체크 실패:`, error);
            throw error;
        }
    }
    
    // =========================================================================
    // WebSocket Methods
    // =========================================================================
    
    /**
     * WebSocket 연결
     * WS /api/uds/stream
     * 
     * @param {Object} params - 연결 파라미터
     * @param {number} [params.siteId=1] - Site ID
     * @param {number} [params.lineId=1] - Line ID
     * @param {Function} onMessage - 메시지 수신 콜백 (data: Object)
     * @param {Function} [onError] - 에러 콜백 (error: Error)
     */
    connectWebSocket(params = {}, onMessage, onError = null) {
        const { siteId = 1, lineId = 1 } = params;
        
        // 기존 연결 정리
        this.disconnectWebSocket();
        
        // 재연결용 파라미터 저장
        this._reconnectParams = params;
        this._onMessageCallback = onMessage;
        this._onErrorCallback = onError;
        
        // WebSocket URL 생성
        const wsBaseUrl = this._baseUrl
            .replace('http://', 'ws://')
            .replace('https://', 'wss://');
        
        const wsUrl = `${wsBaseUrl}/uds/stream?site_id=${siteId}&line_id=${lineId}`;
        
        console.log(`🔗 [UDSApiClient] WebSocket 연결 시도: ${wsUrl}`);
        
        try {
            this._ws = new WebSocket(wsUrl);
            
            this._ws.onopen = this._handleWebSocketOpen.bind(this);
            this._ws.onmessage = this._handleWebSocketMessage.bind(this);
            this._ws.onerror = this._handleWebSocketError.bind(this);
            this._ws.onclose = this._handleWebSocketClose.bind(this);
            
        } catch (error) {
            console.error(`❌ [UDSApiClient] WebSocket 생성 실패:`, error);
            if (onError) {
                onError(error);
            }
        }
    }
    
    /**
     * WebSocket 연결 해제
     */
    disconnectWebSocket() {
        this._stopPingInterval();
        
        if (this._ws) {
            // 이벤트 핸들러 제거 (재연결 방지)
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onerror = null;
            this._ws.onclose = null;
            
            if (this._ws.readyState === UDSApiClient.WS_STATE.OPEN ||
                this._ws.readyState === UDSApiClient.WS_STATE.CONNECTING) {
                this._ws.close();
            }
            
            this._ws = null;
            console.log('🔌 [UDSApiClient] WebSocket 연결 해제');
        }
        
        this._reconnectParams = null;
        this._onMessageCallback = null;
        this._onErrorCallback = null;
    }
    
    /**
     * Ping 전송 (Latency 측정용)
     */
    sendPing() {
        if (this._ws && this._ws.readyState === UDSApiClient.WS_STATE.OPEN) {
            this._pingTimestamp = Date.now();
            this._ws.send(JSON.stringify({ type: 'ping' }));
        }
    }
    
    /**
     * 현재 Latency 반환
     * @returns {number} 마지막 측정 Latency (ms)
     */
    getLatency() {
        return this._lastLatency;
    }
    
    /**
     * WebSocket 연결 상태 확인
     * @returns {boolean}
     */
    isConnected() {
        return this._ws && this._ws.readyState === UDSApiClient.WS_STATE.OPEN;
    }
    
    // =========================================================================
    // Private WebSocket Handlers
    // =========================================================================
    
    /**
     * WebSocket open 이벤트 처리
     * @private
     */
    _handleWebSocketOpen() {
        console.log('✅ [UDSApiClient] WebSocket 연결됨');
        this._wsReconnectAttempts = 0;
        this._startPingInterval();
        
        // 연결 성공 이벤트 발행 (EventBus 사용 시)
        if (window.eventBus) {
            window.eventBus.emit('uds:connected');
        }
    }
    
    /**
     * WebSocket message 이벤트 처리
     * @private
     * @param {MessageEvent} event
     */
    _handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Pong 응답 처리
            if (data.type === 'pong') {
                this._handlePong(data);
                return;
            }
            
            // 메시지 콜백 호출
            if (this._onMessageCallback) {
                this._onMessageCallback(data);
            }
            
        } catch (error) {
            console.error('❌ [UDSApiClient] 메시지 파싱 실패:', error);
        }
    }
    
    /**
     * WebSocket error 이벤트 처리
     * @private
     * @param {Event} error
     */
    _handleWebSocketError(error) {
        console.error('❌ [UDSApiClient] WebSocket 에러:', error);
        
        if (this._onErrorCallback) {
            this._onErrorCallback(error);
        }
        
        // 에러 이벤트 발행 (EventBus 사용 시)
        if (window.eventBus) {
            window.eventBus.emit('uds:error', { error });
        }
    }
    
    /**
     * WebSocket close 이벤트 처리
     * @private
     */
    _handleWebSocketClose() {
        console.log('🔌 [UDSApiClient] WebSocket 연결 종료');
        this._stopPingInterval();
        
        // 연결 종료 이벤트 발행 (EventBus 사용 시)
        if (window.eventBus) {
            window.eventBus.emit('uds:disconnected');
        }
        
        // 자동 재연결 시도
        this._attemptReconnect();
    }
    
    /**
     * Pong 응답 처리 (Latency 계산)
     * @private
     * @param {Object} data
     */
    _handlePong(data) {
        if (this._pingTimestamp) {
            this._lastLatency = Date.now() - this._pingTimestamp;
            this._pingTimestamp = null;
            
            // Latency 이벤트 발행 (EventBus 사용 시)
            if (window.eventBus) {
                window.eventBus.emit('uds:latency', { 
                    latency: this._lastLatency 
                });
            }
        }
    }
    
    // =========================================================================
    // Private Utility Methods
    // =========================================================================
    
    /**
     * Ping 인터벌 시작
     * @private
     */
    _startPingInterval() {
        this._stopPingInterval();
        
        this._pingInterval = setInterval(() => {
            this.sendPing();
        }, UDSApiClient.DEFAULTS.PING_INTERVAL);
    }
    
    /**
     * Ping 인터벌 중지
     * @private
     */
    _stopPingInterval() {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
            this._pingInterval = null;
        }
    }
    
    /**
     * 재연결 시도 (Exponential Backoff)
     * @private
     */
    _attemptReconnect() {
        // 파라미터가 없으면 재연결 불가
        if (!this._reconnectParams || !this._onMessageCallback) {
            return;
        }
        
        // 최대 재연결 횟수 초과
        if (this._wsReconnectAttempts >= this._maxReconnectAttempts) {
            console.error('❌ [UDSApiClient] 최대 재연결 시도 횟수 초과');
            
            if (window.eventBus) {
                window.eventBus.emit('uds:reconnect_failed');
            }
            return;
        }
        
        this._wsReconnectAttempts++;
        
        // Exponential Backoff 계산
        const delay = Math.min(
            UDSApiClient.DEFAULTS.RECONNECT_BASE_DELAY * Math.pow(2, this._wsReconnectAttempts),
            UDSApiClient.DEFAULTS.MAX_RECONNECT_DELAY
        );
        
        console.log(`🔄 [UDSApiClient] 재연결 시도 ${this._wsReconnectAttempts}/${this._maxReconnectAttempts} (${delay}ms 후)`);
        
        setTimeout(() => {
            // 아직 연결 시도가 유효한 경우에만 재연결
            if (this._reconnectParams && this._onMessageCallback) {
                this.connectWebSocket(
                    this._reconnectParams,
                    this._onMessageCallback,
                    this._onErrorCallback
                );
            }
        }, delay);
    }
    
    // =========================================================================
    // Dispose
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.disconnectWebSocket();
        console.log('🗑️ [UDSApiClient] 리소스 정리 완료');
    }
}

// =========================================================================
// Singleton Export
// =========================================================================

/** @type {UDSApiClient} 싱글톤 인스턴스 */
export const udsApiClient = new UDSApiClient();

// 전역 접근 (디버깅용)
if (typeof window !== 'undefined') {
    window.udsApiClient = udsApiClient;
}