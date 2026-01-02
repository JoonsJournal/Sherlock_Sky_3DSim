/**
 * ErrorHandler.js
 * 전역 에러 처리기
 * 
 * @version 1.0.0
 * @description 애플리케이션 전역 에러 핸들링
 */

import { AppError } from './AppError.js';
import { ERROR_SEVERITY, ERROR_CATEGORY } from './errorTypes.js';
import { eventBus } from '../managers/EventBus.js';
import { logger } from '../managers/Logger.js';
import { EVENT_NAME } from '../config/constants.js';

class ErrorHandlerClass {
    constructor() {
        this._handlers = new Map();
        this._errorLog = [];
        this._maxLogSize = 100;
        this._initialized = false;
        
        // 로거
        this._logger = logger.child('ErrorHandler');
    }
    
    /**
     * 에러 핸들러 초기화
     */
    init() {
        if (this._initialized) {
            return;
        }
        
        // 전역 에러 핸들러 등록
        window.addEventListener('error', (event) => {
            this.handle(event.error || new Error(event.message), {
                source: 'window.onerror',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Promise 에러 핸들러
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error 
                ? event.reason 
                : new Error(String(event.reason));
            
            this.handle(error, {
                source: 'unhandledrejection'
            });
        });
        
        this._initialized = true;
        this._logger.info('초기화 완료');
    }
    
    /**
     * 에러 처리
     * @param {Error|AppError} error - 에러 객체
     * @param {Object} context - 추가 컨텍스트
     */
    handle(error, context = {}) {
        // AppError로 래핑
        const appError = error instanceof AppError 
            ? error 
            : AppError.wrap(error);
        
        // 컨텍스트 추가
        if (context && appError.details) {
            appError.details = { ...appError.details, ...context };
        } else if (context) {
            appError.details = context;
        }
        
        // 로그 기록
        this._logError(appError);
        
        // 로거 출력
        this._logger.error(`[${appError.code}] ${appError.message}`, appError.details);
        
        // 카테고리별 핸들러 호출
        const categoryHandler = this._handlers.get(appError.category);
        if (categoryHandler) {
            try {
                categoryHandler(appError);
            } catch (e) {
                this._logger.error('카테고리 핸들러 오류:', e);
            }
        }
        
        // 심각도별 핸들러 호출
        const severityHandler = this._handlers.get(appError.severity);
        if (severityHandler) {
            try {
                severityHandler(appError);
            } catch (e) {
                this._logger.error('심각도 핸들러 오류:', e);
            }
        }
        
        // 이벤트 발생
        eventBus.emit(EVENT_NAME.ERROR, appError);
        
        // 심각도에 따른 기본 동작
        this._handleBySeverity(appError);
        
        return appError;
    }
    
    /**
     * 심각도별 기본 처리
     * @param {AppError} error
     */
    _handleBySeverity(error) {
        switch (error.severity) {
            case ERROR_SEVERITY.LOW:
                // 로깅만 (이미 완료)
                break;
                
            case ERROR_SEVERITY.MEDIUM:
                // Toast 알림
                eventBus.emit(EVENT_NAME.TOAST_SHOW, {
                    type: 'error',
                    message: error.getUserMessage()
                });
                break;
                
            case ERROR_SEVERITY.HIGH:
                // Toast + 경고음 (필요시)
                eventBus.emit(EVENT_NAME.TOAST_SHOW, {
                    type: 'error',
                    message: error.getUserMessage(),
                    duration: 5000
                });
                break;
                
            case ERROR_SEVERITY.CRITICAL:
                // 앱 중단 경고
                this._logger.error('🚨 CRITICAL ERROR - 앱 상태 확인 필요');
                eventBus.emit(EVENT_NAME.TOAST_SHOW, {
                    type: 'error',
                    message: error.getUserMessage(),
                    duration: 0 // 자동 닫힘 없음
                });
                break;
        }
    }
    
    /**
     * 카테고리별 핸들러 등록
     * @param {string} category - ERROR_CATEGORY 값
     * @param {Function} handler
     */
    onCategory(category, handler) {
        this._handlers.set(category, handler);
    }
    
    /**
     * 심각도별 핸들러 등록
     * @param {string} severity - ERROR_SEVERITY 값
     * @param {Function} handler
     */
    onSeverity(severity, handler) {
        this._handlers.set(severity, handler);
    }
    
    /**
     * 핸들러 제거
     * @param {string} key - 카테고리 또는 심각도
     */
    removeHandler(key) {
        this._handlers.delete(key);
    }
    
    /**
     * 에러 로그 기록 (내부)
     * @param {AppError} error
     */
    _logError(error) {
        this._errorLog.push({
            error: error.toJSON(),
            timestamp: Date.now()
        });
        
        // 최대 크기 초과 시 오래된 것 제거
        if (this._errorLog.length > this._maxLogSize) {
            this._errorLog.shift();
        }
    }
    
    /**
     * 에러 로그 조회
     * @param {Object} filter - 필터 옵션
     * @returns {Array}
     */
    getErrorLog(filter = {}) {
        let logs = [...this._errorLog];
        
        if (filter.category) {
            logs = logs.filter(l => l.error.category === filter.category);
        }
        
        if (filter.severity) {
            logs = logs.filter(l => l.error.severity === filter.severity);
        }
        
        if (filter.since) {
            logs = logs.filter(l => l.timestamp >= filter.since);
        }
        
        return logs;
    }
    
    /**
     * 에러 로그 클리어
     */
    clearErrorLog() {
        this._errorLog = [];
    }
    
    /**
     * 에러 통계
     * @returns {Object}
     */
    getStatistics() {
        const stats = {
            total: this._errorLog.length,
            byCategory: {},
            bySeverity: {},
            recent: this._errorLog.slice(-10)
        };
        
        this._errorLog.forEach(log => {
            // 카테고리별
            const cat = log.error.category;
            stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
            
            // 심각도별
            const sev = log.error.severity;
            stats.bySeverity[sev] = (stats.bySeverity[sev] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * try-catch 래퍼
     * @param {Function} fn - 실행할 함수
     * @param {Object} context - 에러 컨텍스트
     * @returns {*} 함수 결과 또는 null
     */
    tryCatch(fn, context = {}) {
        try {
            return fn();
        } catch (error) {
            this.handle(error, context);
            return null;
        }
    }
    
    /**
     * async try-catch 래퍼
     * @param {Function} fn - 실행할 async 함수
     * @param {Object} context - 에러 컨텍스트
     * @returns {Promise<*>} 함수 결과 또는 null
     */
    async tryCatchAsync(fn, context = {}) {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context);
            return null;
        }
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        const stats = this.getStatistics();
        
        this._logger.group('ErrorHandler Debug');
        this._logger.info('총 에러 수:', stats.total);
        this._logger.info('카테고리별:', stats.byCategory);
        this._logger.info('심각도별:', stats.bySeverity);
        this._logger.info('최근 에러:', stats.recent);
        this._logger.groupEnd();
    }
}

// 싱글톤 인스턴스
export const errorHandler = new ErrorHandlerClass();

// 클래스 export
export { ErrorHandlerClass };

// 전역 노출
if (typeof window !== 'undefined') {
    window.errorHandler = errorHandler;
}