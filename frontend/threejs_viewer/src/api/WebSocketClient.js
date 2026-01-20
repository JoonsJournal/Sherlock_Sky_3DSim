/**
 * WebSocketClient.js
 * ==================
 * 실시간 데이터 통신을 위한 WebSocket 클라이언트
 * 
 * @version 1.1.0
 * @description
 * - WebSocket 연결 관리 (connect, disconnect)
 * - 메시지 송수신 처리
 * - 자동 재연결 로직 (Exponential Backoff)
 * - 이벤트 기반 통신 패턴
 * - 🆕 NetworkStatsMonitor 연동 (v1.1.0)
 * 
 * @changelog
 * - v1.1.0: NetworkStatsMonitor 연동 (Phase 4 작업 4-3)
 *   - recordWsMessage(): 메시지 수신 시 크기/카운트 기록
 *   - recordWsSend(): 메시지 발신 시 카운트 기록
 *   - recordLatency(): Pong 응답 시 Latency 기록
 *   - updateConnectionStatus(): 연결 상태 변경 알림
 *   - Ping/Pong 지원 (Latency 측정용)
 *   - ⚠️ 호환성: 기존 모든 메서드/이벤트 100% 유지
 * - v1.0.0: 초기 버전
 *   - WebSocket 연결 관리
 *   - 이벤트 기반 통신
 *   - 자동 재연결
 * 
 * @dependencies
 * - core/utils/Config.js (debugLog)
 * - config/environment.js (ENV, buildWsUrl, isDevelopment)
 * - services/performance/NetworkStatsMonitor.js (🆕 v1.1.0)
 * 
 * @exports
 * - WebSocketClient (class)
 * 
 * 📁 위치: frontend/threejs_viewer/src/api/WebSocketClient.js
 * 작성일: 2026-01-15
 * 수정일: 2026-01-21
 */

import { debugLog } from '../core/utils/Config.js';
import { ENV, buildWsUrl, isDevelopment } from '../config/environment.js';
import { networkStatsMonitor } from '../services/performance/NetworkStatsMonitor.js';

export class WebSocketClient {
    // =========================================================================
    // Constructor
    // =========================================================================
    
    constructor(url = null) {
        // 환경 설정에서 WebSocket URL 로드
        this.url = url || buildWsUrl();
        this.ws = null;
        
        // 환경 설정에서 재연결 설정 로드
        this.reconnectInterval = ENV.RECONNECT_INTERVAL || 5000;
        this.maxReconnectAttempts = ENV.MAX_RECONNECT_ATTEMPTS || 10;
        this.reconnectAttempts = 0;
        
        this.listeners = new Map();
        this.isConnecting = false;
        
        // 🆕 v1.1.0: Ping/Pong Latency 측정용
        this._pingTimestamp = null;
        this._pingInterval = null;
        this._pingIntervalMs = ENV.PING_INTERVAL || 5000;  // 5초
        
        if (isDevelopment()) {
            console.log('🔌 WebSocketClient 초기화:', this.url);
            console.log('  재연결 간격:', this.reconnectInterval + 'ms');
            console.log('  최대 재연결 시도:', this.maxReconnectAttempts + '회');
            console.log('  🆕 Ping 간격:', this._pingIntervalMs + 'ms');
        }
    }
    
    // =========================================================================
    // Connection Management
    // =========================================================================
    
    /**
     * WebSocket 연결
     */
    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            debugLog('⚠️ WebSocket이 이미 연결 중이거나 연결되어 있습니다.');
            return;
        }
        
        this.isConnecting = true;
        debugLog('🔌 WebSocket 연결 시도:', this.url);
        
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                debugLog('✅ WebSocket 연결 성공');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                
                // 🆕 v1.1.0: NetworkStatsMonitor 연결 상태 업데이트
                networkStatsMonitor.updateConnectionStatus(true);
                
                // 🆕 v1.1.0: Ping 인터벌 시작
                this._startPingInterval();
                
                this.emit('connected');
            };
            
            this.ws.onmessage = (event) => {
                // 🆕 v1.1.0: 메시지 수신 기록
                const messageSize = event.data ? event.data.length : 0;
                networkStatsMonitor.recordWsMessage(messageSize);
                
                try {
                    const data = JSON.parse(event.data);
                    debugLog('📨 WebSocket 메시지 수신:', data);
                    
                    // 🆕 v1.1.0: Pong 응답 처리 (Latency 계산)
                    if (data.type === 'pong') {
                        this._handlePong(data);
                        return;
                    }
                    
                    // 메시지 타입에 따라 리스너 호출
                    if (data.type) {
                        this.emit(data.type, data);
                    }
                    
                    // 전역 메시지 리스너
                    this.emit('message', data);
                } catch (error) {
                    console.error('❌ WebSocket 메시지 파싱 실패:', error);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket 오류:', error);
                this.emit('error', error);
            };
            
            this.ws.onclose = () => {
                debugLog('🔌 WebSocket 연결 종료');
                this.isConnecting = false;
                
                // 🆕 v1.1.0: NetworkStatsMonitor 연결 상태 업데이트
                networkStatsMonitor.updateConnectionStatus(false);
                
                // 🆕 v1.1.0: Ping 인터벌 중지
                this._stopPingInterval();
                
                this.emit('disconnected');
                
                // 자동 재연결
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    debugLog(
                        `🔄 ${this.reconnectInterval/1000}초 후 재연결 시도 ` +
                        `(${this.reconnectAttempts}/${this.maxReconnectAttempts})`
                    );
                    setTimeout(() => this.connect(), this.reconnectInterval);
                } else {
                    console.error('❌ 최대 재연결 시도 횟수 초과');
                    this.emit('max_reconnect_failed');
                }
            };
        } catch (error) {
            console.error('❌ WebSocket 연결 실패:', error);
            this.isConnecting = false;
        }
    }
    
    /**
     * WebSocket 연결 종료
     */
    disconnect() {
        // 🆕 v1.1.0: Ping 인터벌 중지
        this._stopPingInterval();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            debugLog('🔌 WebSocket 수동 연결 종료');
            
            // 🆕 v1.1.0: NetworkStatsMonitor 연결 상태 업데이트
            networkStatsMonitor.updateConnectionStatus(false);
        }
    }
    
    // =========================================================================
    // Message Handling
    // =========================================================================
    
    /**
     * 메시지 전송
     * @param {Object} data - 전송할 데이터
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const jsonData = JSON.stringify(data);
            this.ws.send(jsonData);
            
            // 🆕 v1.1.0: 메시지 발신 기록
            networkStatsMonitor.recordWsSend(jsonData.length);
            
            debugLog('📤 WebSocket 메시지 전송:', data);
        } else {
            console.error('❌ WebSocket이 연결되어 있지 않습니다.');
        }
    }
    
    // =========================================================================
    // 🆕 v1.1.0: Ping/Pong (Latency 측정)
    // =========================================================================
    
    /**
     * Ping 전송 (Latency 측정용)
     */
    sendPing() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._pingTimestamp = Date.now();
            this.send({ type: 'ping' });
        }
    }
    
    /**
     * Ping 인터벌 시작
     * @private
     */
    _startPingInterval() {
        this._stopPingInterval();
        
        this._pingInterval = setInterval(() => {
            this.sendPing();
        }, this._pingIntervalMs);
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
     * Pong 응답 처리 (Latency 계산)
     * @private
     * @param {Object} data - Pong 메시지 데이터
     */
    _handlePong(data) {
        if (this._pingTimestamp) {
            const latency = Date.now() - this._pingTimestamp;
            this._pingTimestamp = null;
            
            // NetworkStatsMonitor에 Latency 기록
            networkStatsMonitor.recordLatency(latency);
            
            debugLog(`📊 WebSocket Latency: ${latency}ms`);
            
            // Pong 이벤트 발행 (구독자용)
            this.emit('pong', { latency, timestamp: Date.now() });
        }
    }
    
    // =========================================================================
    // Status Check
    // =========================================================================
    
    /**
     * 연결 상태 확인
     * @returns {boolean}
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    // =========================================================================
    // Event System
    // =========================================================================
    
    /**
     * 이벤트 리스너 등록
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * 이벤트 리스너 제거
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * 이벤트 발생
     * @param {string} event - 이벤트 이름
     * @param {any} data - 데이터
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ 이벤트 리스너 실행 오류 (${event}):`, error);
                }
            });
        }
    }
    
    // =========================================================================
    // 편의 메서드
    // =========================================================================
    
    /**
     * 설비 상태 업데이트 구독
     * @param {Function} callback - 콜백 함수
     */
    onEquipmentStatusUpdate(callback) {
        this.on('equipment_status', callback);
    }
    
    /**
     * 알람 발생 구독
     * @param {Function} callback - 콜백 함수
     */
    onAlarm(callback) {
        this.on('alarm', callback);
    }
    
    /**
     * 설비 상태 요청
     * @param {string} equipmentId - 설비 ID (선택적)
     */
    requestEquipmentStatus(equipmentId = null) {
        this.send({
            type: 'request_status',
            equipmentId: equipmentId
        });
    }
    
    // =========================================================================
    // Cleanup
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this._stopPingInterval();
        this.disconnect();
        this.listeners.clear();
        console.log('🗑️ [WebSocketClient] 리소스 정리 완료');
    }
}