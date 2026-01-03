/**
 * WebSocketClient.js
 * 실시간 데이터 통신을 위한 WebSocket 클라이언트
 */

import { debugLog } from '../core/utils/Config.js';
import { ENV, buildWsUrl, isDevelopment } from '../config/environment.js';

export class WebSocketClient {
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
        
        if (isDevelopment()) {
            console.log('🔌 WebSocketClient 초기화:', this.url);
            console.log('  재연결 간격:', this.reconnectInterval + 'ms');
            console.log('  최대 재연결 시도:', this.maxReconnectAttempts + '회');
        }
    }
    
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
                this.emit('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    debugLog('📨 WebSocket 메시지 수신:', data);
                    
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
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            debugLog('🔌 WebSocket 수동 연결 종료');
        }
    }
    
    /**
     * 메시지 전송
     * @param {Object} data - 전송할 데이터
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            debugLog('📤 WebSocket 메시지 전송:', data);
        } else {
            console.error('❌ WebSocket이 연결되어 있지 않습니다.');
        }
    }
    
    /**
     * 연결 상태 확인
     * @returns {boolean}
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
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
    
    // ============================================
    // 편의 메서드
    // ============================================
    
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
}