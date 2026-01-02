/**
 * AppModeManager.js
 * 애플리케이션 모드 관리
 * 
 * @version 1.0.0
 * @description 6가지 앱 모드 전환 및 상태 관리
 */

import { APP_MODE, EVENT_NAME } from '../config/constants.js';
import { eventBus } from './EventBus.js';
import { logger } from './Logger.js';

class AppModeManagerClass {
    constructor() {
        this._currentMode = APP_MODE.MAIN_VIEWER;
        this._previousMode = null;
        this._modeStack = [];
        this._modeHandlers = new Map();
        this._transitions = new Map();
        this._locked = false;
        
        // 로거 설정
        this._logger = logger.child('ModeManager');
        
        this._logger.info('초기화 완료');
    }
    
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
    
    /**
     * 모드 전환
     * @param {string} newMode - 새로운 모드
     * @param {Object} options - 전환 옵션
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
        return this.switchMode(APP_MODE.MAIN_VIEWER);
    }
    
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
     * 디버그 정보 출력
     */
    debug() {
        this._logger.group('AppModeManager Debug');
        this._logger.info('현재 모드:', this._currentMode);
        this._logger.info('이전 모드:', this._previousMode);
        this._logger.info('모드 스택:', this._modeStack);
        this._logger.info('잠금 상태:', this._locked);
        this._logger.info('등록된 핸들러:', Array.from(this._modeHandlers.keys()));
        this._logger.groupEnd();
    }
}

// 싱글톤 인스턴스
export const appModeManager = new AppModeManagerClass();

// 클래스 export
export { AppModeManagerClass };

// 전역 노출
if (typeof window !== 'undefined') {
    window.appModeManager = appModeManager;
}