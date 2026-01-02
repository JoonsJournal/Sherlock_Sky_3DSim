/**
 * DebugManager.js
 * 디버그 기능 관리
 * 
 * @version 1.0.0
 * @description 개발/디버깅용 유틸리티
 */

import { logger, LOG_LEVEL } from './Logger.js';
import { eventBus } from './EventBus.js';
import { appModeManager } from './AppModeManager.js';
import { keyboardManager } from './KeyboardManager.js';

class DebugManagerClass {
    constructor() {
        this._enabled = false;
        this._commands = new Map();
        this._watchers = new Map();
        this._performanceMarks = new Map();
        
        // 로거 설정
        this._logger = logger.child('Debug');
        
        // 기본 명령어 등록
        this._registerDefaultCommands();
        
        this._logger.info('초기화 완료');
    }
    
    /**
     * 디버그 모드 활성화
     */
    enable() {
        this._enabled = true;
        logger.setLevel(LOG_LEVEL.TRACE);
        eventBus.enableHistory(true);
        
        // 전역 디버그 객체 노출
        if (typeof window !== 'undefined') {
            window.debug = this._createDebugAPI();
        }
        
        this._logger.info('디버그 모드 활성화');
    }
    
    /**
     * 디버그 모드 비활성화
     */
    disable() {
        this._enabled = false;
        logger.setLevel(LOG_LEVEL.INFO);
        eventBus.enableHistory(false);
        
        if (typeof window !== 'undefined') {
            delete window.debug;
        }
        
        this._logger.info('디버그 모드 비활성화');
    }
    
    /**
     * 디버그 모드 토글
     * @returns {boolean} 현재 상태
     */
    toggle() {
        if (this._enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this._enabled;
    }
    
    /**
     * 활성화 상태 확인
     * @returns {boolean}
     */
    isEnabled() {
        return this._enabled;
    }
    
    /**
     * 디버그 명령어 등록
     * @param {string} name - 명령어 이름
     * @param {Function} handler - 핸들러 함수
     * @param {string} description - 설명
     */
    registerCommand(name, handler, description = '') {
        this._commands.set(name, { handler, description });
        this._logger.debug(`명령어 등록: ${name}`);
    }
    
    /**
     * 명령어 실행
     * @param {string} name - 명령어 이름
     * @param  {...any} args - 인자
     * @returns {*}
     */
    executeCommand(name, ...args) {
        const command = this._commands.get(name);
        if (!command) {
            this._logger.error(`명령어를 찾을 수 없음: ${name}`);
            return null;
        }
        
        try {
            return command.handler(...args);
        } catch (error) {
            this._logger.error(`명령어 실행 오류 (${name}):`, error);
            return null;
        }
    }
    
    /**
     * 사용 가능한 명령어 목록
     * @returns {Array}
     */
    listCommands() {
        const commands = [];
        this._commands.forEach((value, key) => {
            commands.push({ name: key, description: value.description });
        });
        return commands;
    }
    
    /**
     * 성능 마크 시작
     * @param {string} label
     */
    markStart(label) {
        if (!this._enabled) return;
        this._performanceMarks.set(label, performance.now());
    }
    
    /**
     * 성능 마크 종료 및 결과 출력
     * @param {string} label
     * @returns {number} 경과 시간 (ms)
     */
    markEnd(label) {
        if (!this._enabled) return 0;
        
        const start = this._performanceMarks.get(label);
        if (start === undefined) {
            this._logger.warn(`마크를 찾을 수 없음: ${label}`);
            return 0;
        }
        
        const duration = performance.now() - start;
        this._performanceMarks.delete(label);
        
        this._logger.debug(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        return duration;
    }
    
    /**
     * 값 감시자 추가
     * @param {string} name - 감시자 이름
     * @param {Function} getter - 값 getter 함수
     * @param {number} interval - 갱신 간격 (ms)
     */
    watch(name, getter, interval = 1000) {
        if (this._watchers.has(name)) {
            this.unwatch(name);
        }
        
        const timer = setInterval(() => {
            try {
                const value = getter();
                console.log(`[Watch:${name}]`, value);
            } catch (e) {
                console.error(`[Watch:${name}] Error:`, e);
            }
        }, interval);
        
        this._watchers.set(name, timer);
        this._logger.debug(`감시자 추가: ${name}`);
    }
    
    /**
     * 값 감시자 제거
     * @param {string} name
     */
    unwatch(name) {
        const timer = this._watchers.get(name);
        if (timer) {
            clearInterval(timer);
            this._watchers.delete(name);
            this._logger.debug(`감시자 제거: ${name}`);
        }
    }
    
    /**
     * 모든 감시자 제거
     */
    unwatchAll() {
        this._watchers.forEach((timer) => clearInterval(timer));
        this._watchers.clear();
        this._logger.debug('모든 감시자 제거');
    }
    
    /**
     * 기본 명령어 등록 (내부)
     */
    _registerDefaultCommands() {
        // 상태 출력
        this.registerCommand('status', () => {
            console.group('📊 Application Status');
            appModeManager.debug();
            keyboardManager.debug();
            eventBus.debug();
            console.groupEnd();
        }, '전체 상태 출력');
        
        // 이벤트 히스토리
        this.registerCommand('events', (event) => {
            const history = eventBus.getHistory(event);
            console.table(history);
            return history;
        }, '이벤트 히스토리 조회');
        
        // 로그 레벨 변경
        this.registerCommand('logLevel', (level) => {
            logger.setLevel(level);
            return logger.getLevelName();
        }, '로그 레벨 변경');
        
        // 모드 변경
        this.registerCommand('mode', (mode) => {
            if (mode) {
                appModeManager.switchMode(mode);
            }
            return appModeManager.getCurrentMode();
        }, '모드 조회/변경');
        
        // 도움말
        this.registerCommand('help', () => {
            console.group('📖 Debug Commands');
            this.listCommands().forEach(cmd => {
                console.log(`  ${cmd.name}: ${cmd.description}`);
            });
            console.groupEnd();
        }, '명령어 목록');
        
        // 메모리 정보
        this.registerCommand('memory', () => {
            if (performance.memory) {
                const memory = performance.memory;
                console.log('Memory:', {
                    usedJSHeapSize: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                    totalJSHeapSize: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                    jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
                });
            } else {
                console.log('Memory API not available');
            }
        }, '메모리 사용량');
    }
    
    /**
     * 디버그 API 객체 생성 (window.debug용)
     */
    _createDebugAPI() {
        return {
            // 명령어 실행
            run: (cmd, ...args) => this.executeCommand(cmd, ...args),
            
            // 명령어 목록
            help: () => this.executeCommand('help'),
            
            // 상태
            status: () => this.executeCommand('status'),
            
            // 이벤트
            events: (event) => this.executeCommand('events', event),
            
            // 로그 레벨
            logLevel: (level) => this.executeCommand('logLevel', level),
            
            // 모드
            mode: (mode) => this.executeCommand('mode', mode),
            
            // 메모리
            memory: () => this.executeCommand('memory'),
            
            // 성능 측정
            mark: (label) => this.markStart(label),
            measure: (label) => this.markEnd(label),
            
            // 감시
            watch: (name, getter, interval) => this.watch(name, getter, interval),
            unwatch: (name) => this.unwatch(name),
            
            // 매니저 직접 접근
            managers: {
                mode: appModeManager,
                keyboard: keyboardManager,
                events: eventBus,
                logger: logger
            }
        };
    }
    
    /**
     * 전체 상태 덤프
     * @returns {Object}
     */
    dump() {
        return {
            enabled: this._enabled,
            commands: this.listCommands(),
            watchers: Array.from(this._watchers.keys()),
            performanceMarks: Array.from(this._performanceMarks.keys()),
            currentMode: appModeManager.getCurrentMode(),
            keyboardContext: keyboardManager.getContext(),
            eventHistory: eventBus.getHistory()
        };
    }
}

// 싱글톤 인스턴스
export const debugManager = new DebugManagerClass();

// 클래스 export
export { DebugManagerClass };

// 전역 노출
if (typeof window !== 'undefined') {
    window.debugManager = debugManager;
}