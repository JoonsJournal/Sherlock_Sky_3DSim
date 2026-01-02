/**
 * Logger.js
 * 로깅 시스템
 * 
 * @version 1.0.0
 * @description 레벨별 로깅 및 필터링 지원
 */

// 로그 레벨 정의
export const LOG_LEVEL = Object.freeze({
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    SILENT: 5
});

// 로그 레벨 이름
const LEVEL_NAMES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'];

// 로그 레벨별 스타일
const LEVEL_STYLES = {
    [LOG_LEVEL.TRACE]: 'color: #999',
    [LOG_LEVEL.DEBUG]: 'color: #666',
    [LOG_LEVEL.INFO]: 'color: #2196F3',
    [LOG_LEVEL.WARN]: 'color: #FF9800; font-weight: bold',
    [LOG_LEVEL.ERROR]: 'color: #F44336; font-weight: bold'
};

// 로그 레벨별 아이콘
const LEVEL_ICONS = {
    [LOG_LEVEL.TRACE]: '🔍',
    [LOG_LEVEL.DEBUG]: '🐛',
    [LOG_LEVEL.INFO]: 'ℹ️',
    [LOG_LEVEL.WARN]: '⚠️',
    [LOG_LEVEL.ERROR]: '❌'
};

class LoggerClass {
    constructor(options = {}) {
        this._level = options.level ?? LOG_LEVEL.DEBUG;
        this._prefix = options.prefix || '';
        this._showTimestamp = options.showTimestamp ?? true;
        this._showLevel = options.showLevel ?? true;
        this._handlers = [];
        
        // 로그 히스토리
        this._history = [];
        this._historyEnabled = false;
        this._maxHistorySize = 500;
    }
    
    /**
     * 로그 레벨 설정
     * @param {number} level - LOG_LEVEL 값
     */
    setLevel(level) {
        if (level >= LOG_LEVEL.TRACE && level <= LOG_LEVEL.SILENT) {
            this._level = level;
            console.log(`[Logger] 로그 레벨 변경: ${LEVEL_NAMES[level]}`);
        }
    }
    
    /**
     * 현재 로그 레벨 조회
     * @returns {number}
     */
    getLevel() {
        return this._level;
    }
    
    /**
     * 로그 레벨 이름 조회
     * @returns {string}
     */
    getLevelName() {
        return LEVEL_NAMES[this._level];
    }
    
    /**
     * 프리픽스 설정
     * @param {string} prefix
     */
    setPrefix(prefix) {
        this._prefix = prefix;
    }
    
    /**
     * 핸들러 추가 (외부 로깅 시스템 연동용)
     * @param {Function} handler - (level, message, data) => void
     */
    addHandler(handler) {
        if (typeof handler === 'function') {
            this._handlers.push(handler);
        }
    }
    
    /**
     * 핸들러 제거
     * @param {Function} handler
     */
    removeHandler(handler) {
        const index = this._handlers.indexOf(handler);
        if (index > -1) {
            this._handlers.splice(index, 1);
        }
    }
    
    /**
     * 내부 로그 함수
     */
    _log(level, ...args) {
        // 레벨 필터링
        if (level < this._level) return;
        
        // 메시지 구성
        const parts = [];
        
        if (this._showTimestamp) {
            parts.push(this._getTimestamp());
        }
        
        if (this._prefix) {
            parts.push(`[${this._prefix}]`);
        }
        
        if (this._showLevel) {
            parts.push(`${LEVEL_ICONS[level]}`);
        }
        
        const prefix = parts.join(' ');
        
        // 콘솔 출력
        const consoleMethods = {
            [LOG_LEVEL.TRACE]: console.debug,
            [LOG_LEVEL.DEBUG]: console.debug,
            [LOG_LEVEL.INFO]: console.info,
            [LOG_LEVEL.WARN]: console.warn,
            [LOG_LEVEL.ERROR]: console.error
        };
        
        const method = consoleMethods[level] || console.log;
        
        if (prefix) {
            method(`%c${prefix}`, LEVEL_STYLES[level], ...args);
        } else {
            method(...args);
        }
        
        // 히스토리 저장
        if (this._historyEnabled) {
            this._addToHistory(level, args);
        }
        
        // 외부 핸들러 호출
        this._handlers.forEach(handler => {
            try {
                handler(level, args);
            } catch (e) {
                console.error('[Logger] Handler error:', e);
            }
        });
    }
    
    /**
     * 타임스탬프 생성
     */
    _getTimestamp() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }
    
    /**
     * 히스토리에 추가
     */
    _addToHistory(level, args) {
        this._history.push({
            level,
            levelName: LEVEL_NAMES[level],
            message: args,
            timestamp: Date.now()
        });
        
        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }
    }
    
    // =====================================================
    // 로그 메서드들
    // =====================================================
    
    /**
     * TRACE 레벨 로그
     */
    trace(...args) {
        this._log(LOG_LEVEL.TRACE, ...args);
    }
    
    /**
     * DEBUG 레벨 로그
     */
    debug(...args) {
        this._log(LOG_LEVEL.DEBUG, ...args);
    }
    
    /**
     * INFO 레벨 로그
     */
    info(...args) {
        this._log(LOG_LEVEL.INFO, ...args);
    }
    
    /**
     * WARN 레벨 로그
     */
    warn(...args) {
        this._log(LOG_LEVEL.WARN, ...args);
    }
    
    /**
     * ERROR 레벨 로그
     */
    error(...args) {
        this._log(LOG_LEVEL.ERROR, ...args);
    }
    
    /**
     * 그룹 시작
     * @param {string} label - 그룹 라벨
     */
    group(label) {
        if (this._level <= LOG_LEVEL.DEBUG) {
            console.group(label);
        }
    }
    
    /**
     * 축소된 그룹 시작
     * @param {string} label - 그룹 라벨
     */
    groupCollapsed(label) {
        if (this._level <= LOG_LEVEL.DEBUG) {
            console.groupCollapsed(label);
        }
    }
    
    /**
     * 그룹 종료
     */
    groupEnd() {
        if (this._level <= LOG_LEVEL.DEBUG) {
            console.groupEnd();
        }
    }
    
    /**
     * 테이블 출력
     * @param {Array|Object} data
     */
    table(data) {
        if (this._level <= LOG_LEVEL.DEBUG) {
            console.table(data);
        }
    }
    
    /**
     * 시간 측정 시작
     * @param {string} label
     */
    time(label) {
        if (this._level <= LOG_LEVEL.DEBUG) {
            console.time(label);
        }
    }
    
    /**
     * 시간 측정 종료
     * @param {string} label
     */
    timeEnd(label) {
        if (this._level <= LOG_LEVEL.DEBUG) {
            console.timeEnd(label);
        }
    }
    
    // =====================================================
    // 히스토리 관련
    // =====================================================
    
    /**
     * 히스토리 활성화
     * @param {boolean} enabled
     */
    enableHistory(enabled = true) {
        this._historyEnabled = enabled;
        if (!enabled) {
            this._history = [];
        }
    }
    
    /**
     * 히스토리 조회
     * @param {number} level - 특정 레벨만 필터 (선택)
     * @returns {Array}
     */
    getHistory(level = null) {
        if (level !== null) {
            return this._history.filter(h => h.level === level);
        }
        return [...this._history];
    }
    
    /**
     * 히스토리 클리어
     */
    clearHistory() {
        this._history = [];
    }
    
    // =====================================================
    // 자식 로거 생성
    // =====================================================
    
    /**
     * 프리픽스가 붙은 자식 로거 생성
     * @param {string} prefix - 추가 프리픽스
     * @returns {LoggerClass}
     */
    child(prefix) {
        const childLogger = new LoggerClass({
            level: this._level,
            prefix: this._prefix ? `${this._prefix}:${prefix}` : prefix,
            showTimestamp: this._showTimestamp,
            showLevel: this._showLevel
        });
        
        // 핸들러 공유
        this._handlers.forEach(h => childLogger.addHandler(h));
        
        return childLogger;
    }
}

// 기본 로거 인스턴스
export const logger = new LoggerClass({
    prefix: 'App',
    level: LOG_LEVEL.DEBUG
});

// 클래스 export
export { LoggerClass };

// 전역 노출 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.logger = logger;
    window.LOG_LEVEL = LOG_LEVEL;
}