/**
 * AppModeManager.js
 * 애플리케이션 모드 관리
 * 
 * @version 1.1.0
 * @description 6가지 앱 모드 전환 및 상태 관리
 *              🆕 v1.1.0: Backend 연결 상태 체크 및 Monitoring 모드 진입 조건 추가
 */

import { APP_MODE, EVENT_NAME } from '../config/constants.js';
import { eventBus } from './EventBus.js';
import { logger } from './Logger.js';

// 🆕 Connection Status 관련 import
import ConnectionStatusService, { ConnectionEvents } from '../../services/ConnectionStatusService.js';

/**
 * 🆕 모드별 연결 요구사항 정의
 * true = Backend 연결 필요, false = 연결 불필요
 */
const MODE_CONNECTION_REQUIREMENTS = {
    [APP_MODE.MAIN_VIEWER]: false,      // 연결 불필요
    [APP_MODE.MONITORING]: true,        // ⚠️ 연결 필수
    [APP_MODE.LAYOUT_EDITOR]: false,    // 연결 불필요 (로컬 편집 가능)
    [APP_MODE.PLAYBACK]: true,          // 연결 필요 (데이터 재생)
    [APP_MODE.ANALYTICS]: true,         // 연결 필요 (분석 데이터)
    [APP_MODE.SETTINGS]: false          // 연결 불필요
};

/**
 * 🆕 모드별 오프라인 시 동작 정의
 * 'block' = 진입 차단, 'warn' = 경고 후 진입, 'allow' = 허용
 */
const MODE_OFFLINE_BEHAVIOR = {
    [APP_MODE.MAIN_VIEWER]: 'allow',
    [APP_MODE.MONITORING]: 'block',     // ⚠️ 진입 차단
    [APP_MODE.LAYOUT_EDITOR]: 'allow',
    [APP_MODE.PLAYBACK]: 'block',
    [APP_MODE.ANALYTICS]: 'warn',
    [APP_MODE.SETTINGS]: 'allow'
};

class AppModeManagerClass {
    constructor() {
        this._currentMode = APP_MODE.MAIN_VIEWER;
        this._previousMode = null;
        this._modeStack = [];
        this._modeHandlers = new Map();
        this._transitions = new Map();
        this._locked = false;
        
        // 🆕 Connection Status 서비스 참조
        this._connectionStatusService = null;
        this._connectionEventUnsubscribers = [];
        
        // 로거 설정
        this._logger = logger.child('ModeManager');
        
        this._logger.info('초기화 완료');
    }
    
    // =========================================================================
    // 🆕 Connection Status 연동
    // =========================================================================
    
    /**
     * 🆕 ConnectionStatusService 설정
     * UIBootstrap에서 초기화 후 호출
     * @param {ConnectionStatusService} service
     */
    setConnectionStatusService(service) {
        this._connectionStatusService = service;
        this._setupConnectionListeners();
        this._logger.info('ConnectionStatusService 연결됨');
    }
    
    /**
     * 🆕 Connection 이벤트 리스너 설정
     * @private
     */
    _setupConnectionListeners() {
        if (!this._connectionStatusService) return;
        
        // 기존 리스너 정리
        this._cleanupConnectionListeners();
        
        // 오프라인 전환 시 처리
        const unsubOffline = this._connectionStatusService.onOffline(() => {
            this._handleConnectionOffline();
        });
        this._connectionEventUnsubscribers.push(unsubOffline);
        
        // 온라인 복구 시 처리
        const unsubOnline = this._connectionStatusService.onOnline((data) => {
            this._handleConnectionOnline(data);
        });
        this._connectionEventUnsubscribers.push(unsubOnline);
        
        this._logger.debug('Connection 이벤트 리스너 설정 완료');
    }
    
    /**
     * 🆕 Connection 이벤트 리스너 정리
     * @private
     */
    _cleanupConnectionListeners() {
        this._connectionEventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._connectionEventUnsubscribers = [];
    }
    
    /**
     * 🆕 오프라인 전환 시 처리
     * @private
     */
    _handleConnectionOffline() {
        this._logger.warn('Backend 연결 끊김 감지');
        
        // 현재 모드가 연결 필수 모드인 경우
        const behavior = MODE_OFFLINE_BEHAVIOR[this._currentMode];
        
        if (behavior === 'block') {
            this._logger.warn(`${this._currentMode} 모드는 연결이 필요합니다. 기본 모드로 복귀합니다.`);
            
            // 이벤트 발생 (UI에서 Toast 표시용)
            eventBus.emit('connection:mode-exit-required', {
                mode: this._currentMode,
                reason: 'offline'
            });
            
            // 기본 모드로 자동 복귀
            this.goToDefault();
        }
    }
    
    /**
     * 🆕 온라인 복구 시 처리
     * @private
     */
    _handleConnectionOnline(data) {
        this._logger.info('Backend 연결 복구됨');
        
        // 이벤트 발생 (UI에서 Toast 표시용)
        eventBus.emit('connection:restored', {
            recoveredAfter: data.recoveredAfter
        });
    }
    
    /**
     * 🆕 Backend 연결 상태 확인
     * @returns {boolean}
     */
    isBackendOnline() {
        if (!this._connectionStatusService) {
            // 서비스가 없으면 true 반환 (backward compatibility)
            return true;
        }
        return this._connectionStatusService.isOnline();
    }
    
    /**
     * 🆕 특정 모드 진입 가능 여부 확인
     * @param {string} mode - 확인할 모드
     * @returns {Object} { canEnter: boolean, reason: string|null }
     */
    canEnterMode(mode) {
        // 모드 유효성 검사
        if (!Object.values(APP_MODE).includes(mode)) {
            return { canEnter: false, reason: 'invalid_mode' };
        }
        
        // 잠금 상태 확인
        if (this._locked) {
            return { canEnter: false, reason: 'locked' };
        }
        
        // 연결 요구사항 확인
        const requiresConnection = MODE_CONNECTION_REQUIREMENTS[mode];
        const offlineBehavior = MODE_OFFLINE_BEHAVIOR[mode];
        
        if (requiresConnection && !this.isBackendOnline()) {
            if (offlineBehavior === 'block') {
                return { canEnter: false, reason: 'offline' };
            }
            // 'warn'인 경우는 진입 가능하지만 경고 필요
            if (offlineBehavior === 'warn') {
                return { canEnter: true, reason: 'offline_warning' };
            }
        }
        
        return { canEnter: true, reason: null };
    }
    
    /**
     * 🆕 Monitoring 모드 진입 가능 여부 확인 (편의 메서드)
     * @returns {Object} { canEnter: boolean, reason: string|null }
     */
    canEnterMonitoringMode() {
        return this.canEnterMode(APP_MODE.MONITORING);
    }
    
    // =========================================================================
    // 기본 모드 조회
    // =========================================================================
    
    /**
     * 현재 모드 조회
     * @returns {string}
     */
    getCurrentMode() {
        return this._currentMode;
    }
    
    /**
     * 이전 모드 조회
     * @returns {string|null}
     */
    getPreviousMode() {
        return this._previousMode;
    }
    
    // =========================================================================
    // 모드 핸들러 관리
    // =========================================================================
    
    /**
     * 모드 핸들러 등록
     * @param {string} mode - APP_MODE 값
     * @param {Object} handler - { onEnter, onExit, onUpdate }
     */
    registerMode(mode, handler) {
        if (!Object.values(APP_MODE).includes(mode)) {
            this._logger.error('유효하지 않은 모드:', mode);
            return;
        }
        
        this._modeHandlers.set(mode, {
            onEnter: handler.onEnter || (() => {}),
            onExit: handler.onExit || (() => {}),
            onUpdate: handler.onUpdate || (() => {})
        });
        
        this._logger.debug(`모드 핸들러 등록: ${mode}`);
    }
    
    /**
     * 모드 핸들러 제거
     * @param {string} mode
     */
    unregisterMode(mode) {
        this._modeHandlers.delete(mode);
        this._logger.debug(`모드 핸들러 제거: ${mode}`);
    }
    
    // =========================================================================
    // 모드 전환 (🆕 연결 상태 체크 추가)
    // =========================================================================
    
    /**
     * 모드 전환
     * @param {string} newMode - 새로운 모드
     * @param {Object} options - 전환 옵션
     * @param {boolean} options.force - 강제 전환
     * @param {boolean} options.overlay - 오버레이 모드
     * @param {boolean} options.skipConnectionCheck - 연결 체크 스킵 (🆕)
     * @returns {boolean} 전환 성공 여부
     */
    async switchMode(newMode, options = {}) {
        // 잠금 확인
        if (this._locked) {
            this._logger.warn('모드 전환 잠금 상태');
            return false;
        }
        
        // 유효성 검사
        if (!Object.values(APP_MODE).includes(newMode)) {
            this._logger.error('유효하지 않은 모드:', newMode);
            return false;
        }
        
        // 동일 모드 전환 방지
        if (this._currentMode === newMode && !options.force) {
            this._logger.debug('이미 해당 모드:', newMode);
            return true;
        }
        
        // 🆕 연결 상태 체크 (skipConnectionCheck가 아닌 경우)
        if (!options.skipConnectionCheck) {
            const { canEnter, reason } = this.canEnterMode(newMode);
            
            if (!canEnter) {
                this._logger.warn(`모드 진입 불가: ${newMode}, 사유: ${reason}`);
                
                // 이벤트 발생 (UI에서 처리)
                eventBus.emit('mode:enter-blocked', {
                    mode: newMode,
                    reason: reason,
                    isOnline: this.isBackendOnline()
                });
                
                return false;
            }
            
            // 경고가 필요한 경우
            if (reason === 'offline_warning') {
                this._logger.warn(`${newMode} 모드: 오프라인 상태에서 일부 기능이 제한됩니다`);
                
                eventBus.emit('mode:enter-warning', {
                    mode: newMode,
                    reason: reason
                });
            }
        }
        
        const oldMode = this._currentMode;
        
        try {
            // beforeChange 이벤트 발생
            eventBus.emit(EVENT_NAME.MODE_BEFORE_CHANGE, {
                from: oldMode,
                to: newMode,
                options
            });
            
            // 현재 모드 종료
            await this._exitMode(oldMode, newMode);
            
            // 모드 상태 업데이트
            this._previousMode = oldMode;
            this._currentMode = newMode;
            
            // 모드 스택 관리 (오버레이 모드인 경우)
            if (options.overlay) {
                this._modeStack.push(oldMode);
            } else {
                this._modeStack = [];
            }
            
            // 새 모드 진입
            await this._enterMode(newMode, oldMode);
            
            // change 이벤트 발생
            eventBus.emit(EVENT_NAME.MODE_CHANGE, {
                from: oldMode,
                to: newMode,
                options
            });
            
            this._logger.info(`모드 전환: ${oldMode} → ${newMode}`);
            return true;
            
        } catch (error) {
            this._logger.error('모드 전환 실패:', error);
            // 롤백
            this._currentMode = oldMode;
            return false;
        }
    }
    
    // =========================================================================
    // 🆕 Monitoring 모드 전용 메서드
    // =========================================================================
    
    /**
     * 🆕 Monitoring 모드 진입 (편의 메서드)
     * @param {Object} options - 옵션
     * @returns {Promise<boolean>} 성공 여부
     */
    async enterMonitoringMode(options = {}) {
        // 진입 가능 여부 먼저 확인
        const { canEnter, reason } = this.canEnterMonitoringMode();
        
        if (!canEnter) {
            this._logger.warn(`Monitoring 모드 진입 불가: ${reason}`);
            
            // 사유별 이벤트/메시지
            if (reason === 'offline') {
                eventBus.emit('monitoring:enter-failed', {
                    reason: 'Backend 서버에 연결할 수 없습니다',
                    code: 'OFFLINE'
                });
            } else if (reason === 'locked') {
                eventBus.emit('monitoring:enter-failed', {
                    reason: '모드 전환이 잠금 상태입니다',
                    code: 'LOCKED'
                });
            }
            
            return false;
        }
        
        // 모드 전환
        return this.switchMode(APP_MODE.MONITORING, options);
    }
    
    /**
     * 🆕 Monitoring 모드 종료 (편의 메서드)
     * @returns {Promise<boolean>} 성공 여부
     */
    async exitMonitoringMode() {
        if (this._currentMode !== APP_MODE.MONITORING) {
            this._logger.debug('현재 Monitoring 모드가 아닙니다');
            return true;
        }
        
        return this.goToDefault();
    }
    
    /**
     * 🆕 현재 Monitoring 모드인지 확인
     * @returns {boolean}
     */
    isMonitoringMode() {
        return this._currentMode === APP_MODE.MONITORING;
    }
    
    // =========================================================================
    // 모드 네비게이션
    // =========================================================================
    
    /**
     * 이전 모드로 복귀
     * @returns {boolean}
     */
    async goBack() {
        if (this._modeStack.length > 0) {
            const previousMode = this._modeStack.pop();
            return this.switchMode(previousMode);
        }
        
        if (this._previousMode) {
            return this.switchMode(this._previousMode);
        }
        
        this._logger.warn('복귀할 모드가 없습니다');
        return false;
    }
    
    /**
     * 기본 모드로 복귀
     * @returns {boolean}
     */
    async goToDefault() {
        // 기본 모드로 갈 때는 연결 체크 스킵
        return this.switchMode(APP_MODE.MAIN_VIEWER, { skipConnectionCheck: true });
    }
    
    // =========================================================================
    // 내부 메서드
    // =========================================================================
    
    /**
     * 모드 종료 처리 (내부)
     */
    async _exitMode(mode, nextMode) {
        const handler = this._modeHandlers.get(mode);
        if (handler && handler.onExit) {
            await handler.onExit({ nextMode });
        }
    }
    
    /**
     * 모드 진입 처리 (내부)
     */
    async _enterMode(mode, prevMode) {
        const handler = this._modeHandlers.get(mode);
        if (handler && handler.onEnter) {
            await handler.onEnter({ prevMode });
        }
    }
    
    /**
     * 현재 모드 업데이트 호출
     * @param {*} data - 업데이트 데이터
     */
    update(data) {
        const handler = this._modeHandlers.get(this._currentMode);
        if (handler && handler.onUpdate) {
            handler.onUpdate(data);
        }
    }
    
    // =========================================================================
    // 잠금 관리
    // =========================================================================
    
    /**
     * 모드 전환 잠금
     */
    lock() {
        this._locked = true;
        this._logger.debug('모드 전환 잠금');
    }
    
    /**
     * 모드 전환 잠금 해제
     */
    unlock() {
        this._locked = false;
        this._logger.debug('모드 전환 잠금 해제');
    }
    
    /**
     * 잠금 상태 확인
     * @returns {boolean}
     */
    isLocked() {
        return this._locked;
    }
    
    // =========================================================================
    // 유틸리티
    // =========================================================================
    
    /**
     * 특정 모드인지 확인
     * @param {string} mode
     * @returns {boolean}
     */
    isMode(mode) {
        return this._currentMode === mode;
    }
    
    /**
     * 모드 변경 리스너 등록 (편의 메서드)
     * @param {Function} callback
     * @returns {Function} 구독 해제 함수
     */
    onModeChange(callback) {
        return eventBus.on(EVENT_NAME.MODE_CHANGE, callback);
    }
    
    /**
     * 🆕 모드 진입 차단 리스너 등록 (편의 메서드)
     * @param {Function} callback
     * @returns {Function} 구독 해제 함수
     */
    onModeBlocked(callback) {
        return eventBus.on('mode:enter-blocked', callback);
    }
    
    /**
     * 🆕 Monitoring 진입 실패 리스너 등록 (편의 메서드)
     * @param {Function} callback
     * @returns {Function} 구독 해제 함수
     */
    onMonitoringFailed(callback) {
        return eventBus.on('monitoring:enter-failed', callback);
    }
    
    // =========================================================================
    // 디버그 및 정리
    // =========================================================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        this._logger.group('AppModeManager Debug');
        this._logger.info('현재 모드:', this._currentMode);
        this._logger.info('이전 모드:', this._previousMode);
        this._logger.info('모드 스택:', this._modeStack);
        this._logger.info('잠금 상태:', this._locked);
        this._logger.info('등록된 핸들러:', Array.from(this._modeHandlers.keys()));
        this._logger.info('Backend 연결:', this.isBackendOnline() ? 'ONLINE' : 'OFFLINE');
        this._logger.info('ConnectionService 연결:', this._connectionStatusService ? 'YES' : 'NO');
        this._logger.groupEnd();
    }
    
    /**
     * 🆕 정리 (destroy)
     */
    destroy() {
        this._cleanupConnectionListeners();
        this._modeHandlers.clear();
        this._modeStack = [];
        this._connectionStatusService = null;
        this._logger.info('AppModeManager 정리 완료');
    }
}

// 싱글톤 인스턴스
export const appModeManager = new AppModeManagerClass();

// 클래스 export
export { AppModeManagerClass, MODE_CONNECTION_REQUIREMENTS, MODE_OFFLINE_BEHAVIOR };

// 전역 노출
if (typeof window !== 'undefined') {
    window.appModeManager = appModeManager;
}