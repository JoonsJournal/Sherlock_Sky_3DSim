/**
 * ConnectionStatusService.js
 * 
 * Backend 연결 상태를 실시간으로 관리하는 서비스
 * - Health Check API를 주기적으로 호출하여 연결 상태 확인
 * - Mock 모드 지원으로 Backend 없이 테스트 가능
 * - EventBus를 통한 상태 변경 이벤트 발행
 * 
 * @location frontend/threejs_viewer/src/services/ConnectionStatusService.js
 */

import { EventBus } from '../core/managers/EventBus.js';
import { environment } from '../config/environment.js';

/**
 * 연결 상태 열거형
 */
export const ConnectionState = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    CHECKING: 'checking',
    UNKNOWN: 'unknown'
};

/**
 * 연결 상태 이벤트 타입
 */
export const ConnectionEvents = {
    ONLINE: 'connection:online',
    OFFLINE: 'connection:offline',
    STATUS_CHANGED: 'connection:status-changed',
    CHECK_STARTED: 'connection:check-started',
    CHECK_COMPLETED: 'connection:check-completed',
    ERROR: 'connection:error'
};

/**
 * ConnectionStatusService
 * 
 * Backend 서버와의 연결 상태를 모니터링하고 관리하는 싱글톤 서비스
 */
class ConnectionStatusService {
    constructor() {
        // 싱글톤 패턴
        if (ConnectionStatusService._instance) {
            return ConnectionStatusService._instance;
        }
        ConnectionStatusService._instance = this;

        // ===== 상태 관리 =====
        this._state = ConnectionState.UNKNOWN;
        this._previousState = ConnectionState.UNKNOWN;
        this._isOnline = false;
        this._lastCheckTime = null;
        this._lastSuccessTime = null;
        this._consecutiveFailures = 0;
        this._totalChecks = 0;
        this._successfulChecks = 0;

        // ===== 설정 =====
        this._config = {
            // Health Check 엔드포인트
            healthEndpoint: '/api/health',
            
            // 체크 주기 (밀리초)
            checkInterval: 5000,  // 5초
            
            // 요청 타임아웃 (밀리초)
            requestTimeout: 3000,  // 3초
            
            // 오프라인 판정까지 연속 실패 횟수
            failureThreshold: 2,
            
            // 자동 시작 여부
            autoStart: true,
            
            // 디버그 로깅
            debug: false
        };

        // ===== Mock 모드 설정 =====
        this._mockConfig = {
            // Mock 모드 활성화 여부
            enabled: false,
            
            // Mock 온라인 상태
            isOnline: true,
            
            // Mock 응답 지연 (밀리초)
            responseDelay: 100,
            
            // Mock 실패 확률 (0-1)
            failureProbability: 0,
            
            // Mock Health 응답 데이터
            healthResponse: {
                status: 'ok',
                timestamp: null,  // 자동 생성
                version: '1.0.0',
                server: 'mock'
            }
        };

        // ===== 내부 상태 =====
        this._intervalId = null;
        this._isRunning = false;
        this._abortController = null;

        // ===== 이벤트 버스 =====
        this._eventBus = EventBus.getInstance ? EventBus.getInstance() : EventBus;

        // ===== 초기화 로그 =====
        this._log('ConnectionStatusService initialized');
    }

    // =========================================================================
    // Public API - 기본 제어
    // =========================================================================

    /**
     * 서비스 시작 - 주기적 Health Check 시작
     * @param {Object} options - 시작 옵션
     * @returns {ConnectionStatusService} this (체이닝용)
     */
    start(options = {}) {
        if (this._isRunning) {
            this._log('Service already running');
            return this;
        }

        // 옵션 병합
        if (options.config) {
            this.configure(options.config);
        }

        this._isRunning = true;
        this._log('Service starting...');

        // 즉시 첫 번째 체크 수행
        this.checkHealth();

        // 주기적 체크 시작
        this._intervalId = setInterval(() => {
            this.checkHealth();
        }, this._config.checkInterval);

        this._log(`Service started (interval: ${this._config.checkInterval}ms)`);
        return this;
    }

    /**
     * 서비스 중지 - 주기적 Health Check 중지
     * @returns {ConnectionStatusService} this (체이닝용)
     */
    stop() {
        if (!this._isRunning) {
            this._log('Service not running');
            return this;
        }

        // 인터벌 정리
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }

        // 진행 중인 요청 취소
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }

        this._isRunning = false;
        this._log('Service stopped');
        return this;
    }

    /**
     * 서비스 재시작
     * @returns {ConnectionStatusService} this (체이닝용)
     */
    restart() {
        this.stop();
        this.start();
        return this;
    }

    /**
     * 설정 변경
     * @param {Object} config - 변경할 설정
     * @returns {ConnectionStatusService} this (체이닝용)
     */
    configure(config) {
        this._config = { ...this._config, ...config };
        this._log('Configuration updated', this._config);
        
        // 실행 중이면 새 간격으로 재시작
        if (this._isRunning && config.checkInterval) {
            this.restart();
        }
        
        return this;
    }

    // =========================================================================
    // Public API - Health Check
    // =========================================================================

    /**
     * 단일 Health Check 수행
     * @returns {Promise<boolean>} 온라인 여부
     */
    async checkHealth() {
        this._log('Checking health...');
        this._totalChecks++;

        // 상태를 CHECKING으로 변경
        this._setState(ConnectionState.CHECKING);
        this._emitEvent(ConnectionEvents.CHECK_STARTED, {
            timestamp: new Date(),
            checkNumber: this._totalChecks
        });

        let isOnline = false;
        let responseData = null;
        let error = null;

        try {
            // Mock 모드 또는 실제 API 호출
            if (this._mockConfig.enabled) {
                const result = await this._mockHealthCheck();
                isOnline = result.success;
                responseData = result.data;
            } else {
                const result = await this._realHealthCheck();
                isOnline = result.success;
                responseData = result.data;
            }
        } catch (err) {
            isOnline = false;
            error = err;
            this._log('Health check error:', err.message);
        }

        // 결과 처리
        this._processHealthCheckResult(isOnline, responseData, error);

        return isOnline;
    }

    /**
     * 강제로 온라인 상태로 설정 (테스트용)
     */
    forceOnline() {
        this._log('Force setting online');
        this._updateOnlineStatus(true);
    }

    /**
     * 강제로 오프라인 상태로 설정 (테스트용)
     */
    forceOffline() {
        this._log('Force setting offline');
        this._updateOnlineStatus(false);
    }

    // =========================================================================
    // Public API - Mock 모드
    // =========================================================================

    /**
     * Mock 모드 활성화
     * @param {Object} options - Mock 설정
     * @returns {ConnectionStatusService} this (체이닝용)
     */
    enableMockMode(options = {}) {
        this._mockConfig = { 
            ...this._mockConfig, 
            ...options,
            enabled: true 
        };
        this._log('Mock mode enabled', this._mockConfig);
        return this;
    }

    /**
     * Mock 모드 비활성화
     * @returns {ConnectionStatusService} this (체이닝용)
     */
    disableMockMode() {
        this._mockConfig.enabled = false;
        this._log('Mock mode disabled');
        return this;
    }

    /**
     * Mock 온라인 상태 설정
     * @param {boolean} isOnline - 온라인 상태
     * @returns {ConnectionStatusService} this (체이닝용)
     */
    setMockOnline(isOnline) {
        this._mockConfig.isOnline = isOnline;
        this._log(`Mock online status set to: ${isOnline}`);
        
        // 즉시 상태 반영 (다음 체크를 기다리지 않음)
        if (this._mockConfig.enabled) {
            this._updateOnlineStatus(isOnline);
        }
        
        return this;
    }

    /**
     * Mock 상태 토글
     * @returns {boolean} 새로운 Mock 온라인 상태
     */
    toggleMockOnline() {
        const newState = !this._mockConfig.isOnline;
        this.setMockOnline(newState);
        return newState;
    }

    /**
     * Mock 모드 여부 확인
     * @returns {boolean}
     */
    isMockMode() {
        return this._mockConfig.enabled;
    }

    // =========================================================================
    // Public API - 상태 조회
    // =========================================================================

    /**
     * 현재 온라인 상태 반환
     * @returns {boolean}
     */
    isOnline() {
        return this._isOnline;
    }

    /**
     * 현재 오프라인 상태 반환
     * @returns {boolean}
     */
    isOffline() {
        return !this._isOnline;
    }

    /**
     * 현재 연결 상태 반환
     * @returns {string} ConnectionState 값
     */
    getState() {
        return this._state;
    }

    /**
     * 서비스 실행 중 여부
     * @returns {boolean}
     */
    isRunning() {
        return this._isRunning;
    }

    /**
     * 마지막 체크 시간 반환
     * @returns {Date|null}
     */
    getLastCheckTime() {
        return this._lastCheckTime;
    }

    /**
     * 마지막 성공 시간 반환
     * @returns {Date|null}
     */
    getLastSuccessTime() {
        return this._lastSuccessTime;
    }

    /**
     * 상태 요약 정보 반환
     * @returns {Object}
     */
    getStatus() {
        return {
            state: this._state,
            isOnline: this._isOnline,
            isRunning: this._isRunning,
            isMockMode: this._mockConfig.enabled,
            lastCheckTime: this._lastCheckTime,
            lastSuccessTime: this._lastSuccessTime,
            consecutiveFailures: this._consecutiveFailures,
            totalChecks: this._totalChecks,
            successfulChecks: this._successfulChecks,
            successRate: this._totalChecks > 0 
                ? Math.round((this._successfulChecks / this._totalChecks) * 100) 
                : 0,
            config: { ...this._config },
            mockConfig: this._mockConfig.enabled ? { ...this._mockConfig } : null
        };
    }

    /**
     * 마지막 체크 이후 경과 시간 (초)
     * @returns {number|null}
     */
    getSecondsSinceLastCheck() {
        if (!this._lastCheckTime) return null;
        return Math.floor((Date.now() - this._lastCheckTime.getTime()) / 1000);
    }

    // =========================================================================
    // Public API - 이벤트 구독
    // =========================================================================

    /**
     * 이벤트 구독
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    on(event, callback) {
        if (this._eventBus.on) {
            this._eventBus.on(event, callback);
        } else if (this._eventBus.subscribe) {
            this._eventBus.subscribe(event, callback);
        }
        
        // 구독 해제 함수 반환
        return () => this.off(event, callback);
    }

    /**
     * 이벤트 구독 해제
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    off(event, callback) {
        if (this._eventBus.off) {
            this._eventBus.off(event, callback);
        } else if (this._eventBus.unsubscribe) {
            this._eventBus.unsubscribe(event, callback);
        }
    }

    /**
     * 온라인 이벤트 구독 (편의 메서드)
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    onOnline(callback) {
        return this.on(ConnectionEvents.ONLINE, callback);
    }

    /**
     * 오프라인 이벤트 구독 (편의 메서드)
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    onOffline(callback) {
        return this.on(ConnectionEvents.OFFLINE, callback);
    }

    /**
     * 상태 변경 이벤트 구독 (편의 메서드)
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    onStatusChanged(callback) {
        return this.on(ConnectionEvents.STATUS_CHANGED, callback);
    }

    // =========================================================================
    // Private Methods - Health Check 구현
    // =========================================================================

    /**
     * 실제 Health Check API 호출
     * @private
     */
    async _realHealthCheck() {
        // 이전 요청 취소
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();

        const baseUrl = environment?.API_BASE_URL || '';
        const url = `${baseUrl}${this._config.healthEndpoint}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                signal: this._abortController.signal,
                // 타임아웃 구현
                ...(this._config.requestTimeout && {
                    signal: AbortSignal.timeout(this._config.requestTimeout)
                })
            });

            if (!response.ok) {
                return { success: false, data: null };
            }

            const data = await response.json();
            return { 
                success: data.status === 'ok', 
                data 
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                this._log('Health check aborted');
            }
            return { success: false, data: null, error };
        }
    }

    /**
     * Mock Health Check
     * @private
     */
    async _mockHealthCheck() {
        // 응답 지연 시뮬레이션
        await this._delay(this._mockConfig.responseDelay);

        // 실패 확률 체크
        if (Math.random() < this._mockConfig.failureProbability) {
            return { success: false, data: null };
        }

        // Mock 온라인 상태에 따른 응답
        if (!this._mockConfig.isOnline) {
            return { success: false, data: null };
        }

        // Mock 성공 응답
        const data = {
            ...this._mockConfig.healthResponse,
            timestamp: new Date().toISOString()
        };

        return { success: true, data };
    }

    /**
     * Health Check 결과 처리
     * @private
     */
    _processHealthCheckResult(isOnline, responseData, error) {
        this._lastCheckTime = new Date();

        if (isOnline) {
            this._consecutiveFailures = 0;
            this._successfulChecks++;
            this._lastSuccessTime = new Date();
        } else {
            this._consecutiveFailures++;
        }

        // 이벤트 발행: 체크 완료
        this._emitEvent(ConnectionEvents.CHECK_COMPLETED, {
            success: isOnline,
            timestamp: this._lastCheckTime,
            responseData,
            error: error?.message,
            consecutiveFailures: this._consecutiveFailures
        });

        // 실패 임계치 확인 후 상태 업데이트
        if (isOnline) {
            this._updateOnlineStatus(true);
        } else if (this._consecutiveFailures >= this._config.failureThreshold) {
            this._updateOnlineStatus(false);
        }

        this._log(`Health check result: ${isOnline ? 'SUCCESS' : 'FAILED'} ` +
            `(failures: ${this._consecutiveFailures})`);
    }

    // =========================================================================
    // Private Methods - 상태 관리
    // =========================================================================

    /**
     * 상태 설정
     * @private
     */
    _setState(newState) {
        if (this._state === newState) return;
        
        this._previousState = this._state;
        this._state = newState;
    }

    /**
     * 온라인 상태 업데이트
     * @private
     */
    _updateOnlineStatus(isOnline) {
        const wasOnline = this._isOnline;
        this._isOnline = isOnline;

        // 상태 업데이트
        const newState = isOnline ? ConnectionState.ONLINE : ConnectionState.OFFLINE;
        this._setState(newState);

        // 상태 변경 시 이벤트 발행
        if (wasOnline !== isOnline) {
            this._log(`Status changed: ${wasOnline ? 'ONLINE' : 'OFFLINE'} → ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

            // 상태 변경 이벤트
            this._emitEvent(ConnectionEvents.STATUS_CHANGED, {
                isOnline,
                wasOnline,
                timestamp: new Date(),
                state: newState,
                previousState: this._previousState
            });

            // 특정 상태 이벤트
            if (isOnline) {
                this._emitEvent(ConnectionEvents.ONLINE, {
                    timestamp: new Date(),
                    recoveredAfter: this._consecutiveFailures
                });
            } else {
                this._emitEvent(ConnectionEvents.OFFLINE, {
                    timestamp: new Date(),
                    consecutiveFailures: this._consecutiveFailures
                });
            }
        }
    }

    // =========================================================================
    // Private Methods - 유틸리티
    // =========================================================================

    /**
     * 이벤트 발행
     * @private
     */
    _emitEvent(eventName, data) {
        const eventData = {
            ...data,
            source: 'ConnectionStatusService'
        };

        if (this._eventBus.emit) {
            this._eventBus.emit(eventName, eventData);
        } else if (this._eventBus.publish) {
            this._eventBus.publish(eventName, eventData);
        }

        this._log(`Event emitted: ${eventName}`, eventData);
    }

    /**
     * 지연 유틸리티
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 디버그 로깅
     * @private
     */
    _log(...args) {
        if (this._config.debug) {
            console.log('[ConnectionStatusService]', ...args);
        }
    }

    // =========================================================================
    // Static Methods
    // =========================================================================

    /**
     * 싱글톤 인스턴스 반환
     * @returns {ConnectionStatusService}
     */
    static getInstance() {
        if (!ConnectionStatusService._instance) {
            ConnectionStatusService._instance = new ConnectionStatusService();
        }
        return ConnectionStatusService._instance;
    }

    /**
     * 인스턴스 초기화 (테스트용)
     */
    static resetInstance() {
        if (ConnectionStatusService._instance) {
            ConnectionStatusService._instance.stop();
            ConnectionStatusService._instance = null;
        }
    }
}

// 싱글톤 인스턴스
ConnectionStatusService._instance = null;

// 기본 내보내기
export default ConnectionStatusService;

// Named export
export { ConnectionStatusService };