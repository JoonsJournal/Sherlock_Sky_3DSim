/**
 * WebSocketManager.js - v1.0.0
 * WebSocket 연결 관리 모듈
 * 
 * Phase 4: MonitoringService에서 추출
 * - WebSocket 연결/재연결 관리
 * - Subscribe/Unsubscribe 메시지 전송
 * - 메시지 수신 콜백 패턴
 * - Heartbeat (ping/pong) 지원
 * - 연결 상태 관리
 * 
 * @version 1.0.0
 * @since 2026-01-10
 * 
 * Backend Protocol (v3.0.0):
 * - Client → Server:
 *   - { action: 'subscribe', equipment_ids: [...] }
 *   - { action: 'unsubscribe', equipment_ids: [...] }
 *   - { action: 'ping' }
 *   - { action: 'get_status', equipment_ids: [...] }
 * 
 * - Server → Client:
 *   - { type: 'connected', message, version, timestamp }
 *   - { type: 'subscribed', equipment_ids, message, timestamp }
 *   - { type: 'unsubscribed', equipment_ids, timestamp }
 *   - { type: 'equipment_status', equipment_id, status, ... }
 *   - { type: 'pong', timestamp }
 *   - { type: 'error', message, timestamp }
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/WebSocketManager.js
 */

/**
 * WebSocket 연결 상태 상수
 */
export const ConnectionState = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING',
    CLOSED: 'CLOSED'
};

/**
 * WebSocket 메시지 타입 상수
 */
export const MessageType = {
    CONNECTED: 'connected',
    SUBSCRIBED: 'subscribed',
    UNSUBSCRIBED: 'unsubscribed',
    EQUIPMENT_STATUS: 'equipment_status',
    PONG: 'pong',
    ERROR: 'error'
};

/**
 * WebSocket 액션 타입 상수
 */
export const ActionType = {
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    PING: 'ping',
    GET_STATUS: 'get_status'
};

/**
 * WebSocket 연결 관리 클래스
 */
export class WebSocketManager {
    /**
     * @param {string} wsUrl - WebSocket URL (예: 'ws://localhost:8008/api/monitoring/stream')
     * @param {Object} options - 옵션
     * @param {number} options.maxReconnectAttempts - 최대 재연결 시도 횟수 (기본: 5)
     * @param {number} options.reconnectDelay - 재연결 딜레이 ms (기본: 3000)
     * @param {number} options.heartbeatInterval - Heartbeat 간격 ms (기본: 30000, 0이면 비활성화)
     * @param {boolean} options.autoReconnect - 자동 재연결 활성화 (기본: true)
     * @param {boolean} options.debug - 디버그 로그 출력 (기본: false)
     * @param {Function} options.onStatusUpdate - 상태 업데이트 콜백 (frontendId, data) => void
     * @param {Function} options.onConnected - 연결 완료 콜백 (message) => void
     * @param {Function} options.onSubscribed - 구독 완료 콜백 (message) => void
     * @param {Function} options.onDisconnected - 연결 해제 콜백 () => void
     * @param {Function} options.onError - 에러 콜백 (error) => void
     * @param {Function} options.onReconnecting - 재연결 시도 콜백 (attempt, max) => void
     * @param {Function} options.getEquipmentIds - 매핑된 equipment_id 목록 조회 함수
     * @param {Function} options.getFrontendId - equipment_id → frontend_id 변환 함수
     */
    constructor(wsUrl, options = {}) {
        // WebSocket URL
        this.wsUrl = wsUrl;
        
        // 옵션 (기본값 병합)
        this.options = {
            maxReconnectAttempts: 5,
            reconnectDelay: 3000,
            heartbeatInterval: 30000,
            autoReconnect: true,
            debug: false,
            onStatusUpdate: null,
            onConnected: null,
            onSubscribed: null,
            onDisconnected: null,
            onError: null,
            onReconnecting: null,
            getEquipmentIds: null,
            getFrontendId: null,
            ...options
        };
        
        // WebSocket 인스턴스
        this.ws = null;
        
        // 연결 상태
        this.connectionState = ConnectionState.DISCONNECTED;
        
        // 재연결 관련
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        
        // Heartbeat 관련
        this.heartbeatTimer = null;
        this.lastPongTime = null;
        
        // 구독 목록
        this.subscribedIds = new Set();
        
        // 메시지 카운터
        this.messageCount = 0;
        this.statusUpdateCount = 0;
        
        // 서버 정보
        this.serverVersion = null;
        
        this._log('📡 WebSocketManager 초기화', { wsUrl, options: this.options });
    }
    
    /**
     * 디버그 로그 출력
     * @private
     */
    _log(...args) {
        if (this.options.debug) {
            console.log('[WebSocketManager]', ...args);
        }
    }
    
    /**
     * WebSocket 연결
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    connect() {
        return new Promise((resolve, reject) => {
            // 이미 연결 중이거나 연결됨
            if (this.connectionState === ConnectionState.CONNECTED) {
                this._log('이미 연결됨');
                resolve(true);
                return;
            }
            
            if (this.connectionState === ConnectionState.CONNECTING) {
                this._log('연결 진행 중...');
                resolve(false);
                return;
            }
            
            this.connectionState = ConnectionState.CONNECTING;
            this._log('🔌 WebSocket 연결 시작...', this.wsUrl);
            
            try {
                this.ws = new WebSocket(this.wsUrl);
                
                this.ws.onopen = () => {
                    this.connectionState = ConnectionState.CONNECTED;
                    this.reconnectAttempts = 0;
                    this._log('✅ WebSocket 연결 성공');
                    
                    // Heartbeat 시작
                    this._startHeartbeat();
                    
                    resolve(true);
                };
                
                this.ws.onclose = (event) => {
                    this._log('🔌 WebSocket 연결 종료', { code: event.code, reason: event.reason });
                    this._handleClose(event);
                };
                
                this.ws.onerror = (error) => {
                    this._log('❌ WebSocket 에러', error);
                    if (this.options.onError) {
                        this.options.onError(error);
                    }
                    
                    if (this.connectionState === ConnectionState.CONNECTING) {
                        reject(error);
                    }
                };
                
                this.ws.onmessage = (event) => {
                    this._handleMessage(event);
                };
                
            } catch (error) {
                this._log('❌ WebSocket 생성 실패', error);
                this.connectionState = ConnectionState.DISCONNECTED;
                reject(error);
            }
        });
    }
    
    /**
     * WebSocket 연결 해제
     */
    disconnect() {
        this._log('🔌 WebSocket 연결 해제');
        
        // 타이머 정리
        this._stopHeartbeat();
        this._clearReconnectTimer();
        
        // 상태 초기화
        this.connectionState = ConnectionState.CLOSED;
        this.subscribedIds.clear();
        
        // WebSocket 종료
        if (this.ws) {
            this.ws.onclose = null;  // 자동 재연결 방지
            this.ws.close();
            this.ws = null;
        }
        
        if (this.options.onDisconnected) {
            this.options.onDisconnected();
        }
    }
    
    /**
     * 연결 종료 핸들러
     * @private
     */
    _handleClose(event) {
        this._stopHeartbeat();
        
        const wasConnected = this.connectionState === ConnectionState.CONNECTED;
        this.connectionState = ConnectionState.DISCONNECTED;
        
        if (this.options.onDisconnected) {
            this.options.onDisconnected();
        }
        
        // 자동 재연결
        if (this.options.autoReconnect && wasConnected) {
            this._attemptReconnect();
        }
    }
    
    /**
     * 재연결 시도
     * @private
     */
    _attemptReconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this._log('❌ 최대 재연결 시도 초과');
            this.connectionState = ConnectionState.CLOSED;
            return;
        }
        
        this.reconnectAttempts++;
        this.connectionState = ConnectionState.RECONNECTING;
        
        this._log(`🔄 재연결 시도 ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);
        
        if (this.options.onReconnecting) {
            this.options.onReconnecting(this.reconnectAttempts, this.options.maxReconnectAttempts);
        }
        
        this.reconnectTimer = setTimeout(() => {
            this.connect().then(() => {
                // 재연결 성공 시 구독 복원
                if (this.subscribedIds.size > 0) {
                    this._log('📋 구독 복원 중...', Array.from(this.subscribedIds));
                    this.subscribe(Array.from(this.subscribedIds));
                }
            }).catch(() => {
                this._attemptReconnect();
            });
        }, this.options.reconnectDelay);
    }
    
    /**
     * 재연결 타이머 정리
     * @private
     */
    _clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    
    /**
     * Heartbeat 시작
     * @private
     */
    _startHeartbeat() {
        if (this.options.heartbeatInterval <= 0) return;
        
        this._stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected()) {
                this._sendPing();
            }
        }, this.options.heartbeatInterval);
        
        this._log('💓 Heartbeat 시작', { interval: this.options.heartbeatInterval });
    }
    
    /**
     * Heartbeat 중지
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    
    /**
     * Ping 전송
     * @private
     */
    _sendPing() {
        this._send({ action: ActionType.PING });
    }
    
    /**
     * 메시지 전송
     * @private
     */
    _send(data) {
        if (!this.isConnected()) {
            this._log('⚠️ 연결되지 않아 메시지 전송 불가', data);
            return false;
        }
        
        try {
            this.ws.send(JSON.stringify(data));
            return true;
        } catch (error) {
            this._log('❌ 메시지 전송 실패', error);
            return false;
        }
    }
    
    /**
     * 메시지 수신 핸들러
     * @private
     */
    _handleMessage(event) {
        this.messageCount++;
        
        try {
            const data = JSON.parse(event.data);
            this._log('📨 메시지 수신', data);
            
            switch (data.type) {
                case MessageType.CONNECTED:
                    this._handleConnected(data);
                    break;
                    
                case MessageType.SUBSCRIBED:
                    this._handleSubscribed(data);
                    break;
                    
                case MessageType.UNSUBSCRIBED:
                    this._handleUnsubscribed(data);
                    break;
                    
                case MessageType.EQUIPMENT_STATUS:
                    this._handleStatusUpdate(data);
                    break;
                    
                case MessageType.PONG:
                    this._handlePong(data);
                    break;
                    
                case MessageType.ERROR:
                    this._handleError(data);
                    break;
                    
                default:
                    this._log('⚠️ 알 수 없는 메시지 타입', data.type);
            }
            
        } catch (error) {
            this._log('❌ 메시지 파싱 실패', error, event.data);
        }
    }
    
    /**
     * connected 메시지 핸들러
     * @private
     */
    _handleConnected(data) {
        this.serverVersion = data.version || 'unknown';
        this._log('✅ 서버 연결 확인', { version: this.serverVersion, message: data.message });
        
        if (this.options.onConnected) {
            this.options.onConnected(data.message || '연결됨');
        }
    }
    
    /**
     * subscribed 메시지 핸들러
     * @private
     */
    _handleSubscribed(data) {
        const ids = data.equipment_ids || [];
        ids.forEach(id => this.subscribedIds.add(id));
        
        this._log('📋 구독 완료', { count: ids.length, ids });
        
        if (this.options.onSubscribed) {
            this.options.onSubscribed(data.message || `${ids.length}개 설비 구독됨`);
        }
    }
    
    /**
     * unsubscribed 메시지 핸들러
     * @private
     */
    _handleUnsubscribed(data) {
        const ids = data.equipment_ids || [];
        ids.forEach(id => this.subscribedIds.delete(id));
        
        this._log('📋 구독 해제', { count: ids.length, ids });
    }
    
    /**
     * equipment_status 메시지 핸들러
     * @private
     */
    _handleStatusUpdate(data) {
        this.statusUpdateCount++;
        
        const equipmentId = data.equipment_id;
        if (!equipmentId) {
            this._log('⚠️ equipment_id 누락', data);
            return;
        }
        
        // equipment_id → frontend_id 변환
        let frontendId = null;
        if (this.options.getFrontendId) {
            frontendId = this.options.getFrontendId(equipmentId);
        }
        
        if (!frontendId) {
            this._log('⚠️ frontend_id 매핑 실패', { equipmentId });
            return;
        }
        
        this._log('📊 상태 업데이트', { equipmentId, frontendId, status: data.status });
        
        if (this.options.onStatusUpdate) {
            this.options.onStatusUpdate(frontendId, data);
        }
    }
    
    /**
     * pong 메시지 핸들러
     * @private
     */
    _handlePong(data) {
        this.lastPongTime = Date.now();
        this._log('💓 Pong 수신', { timestamp: data.timestamp });
    }
    
    /**
     * error 메시지 핸들러
     * @private
     */
    _handleError(data) {
        this._log('❌ 서버 에러', data.message);
        
        if (this.options.onError) {
            this.options.onError(new Error(data.message));
        }
    }
    
    /**
     * 설비 구독
     * @param {Array<number>} equipmentIds - equipment_id 목록
     * @returns {boolean} 전송 성공 여부
     */
    subscribe(equipmentIds = null) {
        // equipmentIds가 없으면 getEquipmentIds 콜백 사용
        let ids = equipmentIds;
        if (!ids && this.options.getEquipmentIds) {
            ids = this.options.getEquipmentIds();
        }
        
        if (!ids || ids.length === 0) {
            this._log('⚠️ 구독할 equipment_id 없음');
            return false;
        }
        
        this._log('📤 구독 요청', { count: ids.length, ids });
        
        return this._send({
            action: ActionType.SUBSCRIBE,
            equipment_ids: ids
        });
    }
    
    /**
     * 단일 설비 구독 (신규 매핑용)
     * @param {number} equipmentId - equipment_id
     * @returns {boolean} 전송 성공 여부
     */
    subscribeEquipment(equipmentId) {
        if (!equipmentId) {
            this._log('⚠️ equipmentId 없음');
            return false;
        }
        
        this._log('📤 단일 설비 구독', { equipmentId });
        
        return this._send({
            action: ActionType.SUBSCRIBE,
            equipment_ids: [equipmentId]
        });
    }
    
    /**
     * 설비 구독 해제
     * @param {Array<number>} equipmentIds - equipment_id 목록
     * @returns {boolean} 전송 성공 여부
     */
    unsubscribe(equipmentIds) {
        if (!equipmentIds || equipmentIds.length === 0) {
            this._log('⚠️ 구독 해제할 equipment_id 없음');
            return false;
        }
        
        this._log('📤 구독 해제 요청', { count: equipmentIds.length, ids: equipmentIds });
        
        return this._send({
            action: ActionType.UNSUBSCRIBE,
            equipment_ids: equipmentIds
        });
    }
    
    /**
     * 단일 설비 구독 해제
     * @param {number} equipmentId - equipment_id
     * @returns {boolean} 전송 성공 여부
     */
    unsubscribeEquipment(equipmentId) {
        if (!equipmentId) return false;
        return this.unsubscribe([equipmentId]);
    }
    
    /**
     * 현재 상태 요청
     * @param {Array<number>} equipmentIds - equipment_id 목록
     * @returns {boolean} 전송 성공 여부
     */
    requestStatus(equipmentIds = null) {
        let ids = equipmentIds;
        if (!ids && this.options.getEquipmentIds) {
            ids = this.options.getEquipmentIds();
        }
        
        if (!ids || ids.length === 0) return false;
        
        return this._send({
            action: ActionType.GET_STATUS,
            equipment_ids: ids
        });
    }
    
    // ===============================================
    // 상태 조회 메서드
    // ===============================================
    
    /**
     * 연결 여부 확인
     * @returns {boolean}
     */
    isConnected() {
        return this.ws && 
               this.ws.readyState === WebSocket.OPEN && 
               this.connectionState === ConnectionState.CONNECTED;
    }
    
    /**
     * 현재 연결 상태 조회
     * @returns {string} ConnectionState 값
     */
    getConnectionState() {
        return this.connectionState;
    }
    
    /**
     * 구독 중인 equipment_id 목록
     * @returns {Array<number>}
     */
    getSubscribedIds() {
        return Array.from(this.subscribedIds);
    }
    
    /**
     * 구독 수 조회
     * @returns {number}
     */
    getSubscribedCount() {
        return this.subscribedIds.size;
    }
    
    /**
     * 재연결 시도 횟수 조회
     * @returns {number}
     */
    getReconnectAttempts() {
        return this.reconnectAttempts;
    }
    
    /**
     * 메시지 통계 조회
     * @returns {Object}
     */
    getStats() {
        return {
            messageCount: this.messageCount,
            statusUpdateCount: this.statusUpdateCount,
            subscribedCount: this.subscribedIds.size,
            reconnectAttempts: this.reconnectAttempts,
            lastPongTime: this.lastPongTime,
            serverVersion: this.serverVersion
        };
    }
    
    /**
     * 전체 상태 조회
     * @returns {Object}
     */
    getStatus() {
        return {
            connectionState: this.connectionState,
            isConnected: this.isConnected(),
            wsUrl: this.wsUrl,
            subscribedIds: this.getSubscribedIds(),
            subscribedCount: this.subscribedIds.size,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.options.maxReconnectAttempts,
            ...this.getStats()
        };
    }
    
    // ===============================================
    // URL 설정
    // ===============================================
    
    /**
     * WebSocket URL 변경
     * @param {string} newUrl - 새로운 WebSocket URL
     */
    setUrl(newUrl) {
        if (this.isConnected()) {
            this._log('⚠️ 연결 중에는 URL 변경 불가. 먼저 disconnect() 호출 필요');
            return false;
        }
        
        this.wsUrl = newUrl;
        this._log('🔧 WebSocket URL 변경', newUrl);
        return true;
    }
    
    /**
     * 옵션 업데이트
     * @param {Object} newOptions - 업데이트할 옵션
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this._log('🔧 옵션 업데이트', newOptions);
    }
    
    /**
     * 디버그 모드 토글
     * @param {boolean} enabled - 활성화 여부
     */
    setDebug(enabled) {
        this.options.debug = enabled;
    }
}

/**
 * 싱글톤 인스턴스 (기본값)
 * MonitoringService에서 직접 생성하므로 이 인스턴스는 테스트용
 */
// ⭐ 동적 WebSocket URL 생성
function getDefaultWsUrl() {
    const host = window.location.hostname;
    const port = 8008;
    return `ws://${host}:${port}/api/monitoring/stream`;
}

export const webSocketManager = new WebSocketManager(getDefaultWsUrl(), { debug: true });

export default WebSocketManager;