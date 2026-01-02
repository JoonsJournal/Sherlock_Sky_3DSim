/**
 * AppError.js
 * 커스텀 에러 클래스
 * 
 * @version 1.0.0
 * @description 애플리케이션 전용 에러 클래스
 */

import { 
    ERROR_CODE, 
    ERROR_SEVERITY,
    ERROR_CATEGORY,
    getErrorCategory, 
    getErrorMessage 
} from './errorTypes.js';

/**
 * AppError
 * 애플리케이션 커스텀 에러 클래스
 */
export class AppError extends Error {
    /**
     * @param {Object} options - 에러 옵션
     * @param {number} options.code - 에러 코드
     * @param {string} options.message - 에러 메시지 (선택)
     * @param {string} options.severity - 에러 심각도 (선택)
     * @param {Object} options.details - 추가 정보 (선택)
     * @param {Error} options.cause - 원인 에러 (선택)
     */
    constructor(options = {}) {
        const code = options.code || ERROR_CODE.UNKNOWN_ERROR;
        const message = options.message || getErrorMessage(code);
        
        super(message);
        
        this.name = 'AppError';
        this.code = code;
        this.category = getErrorCategory(code);
        this.severity = options.severity || ERROR_SEVERITY.MEDIUM;
        this.details = options.details || null;
        this.cause = options.cause || null;
        this.timestamp = Date.now();
        
        // 스택 트레이스 캡처
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
    
    /**
     * JSON 직렬화
     * @returns {Object}
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            category: this.category,
            severity: this.severity,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
    
    /**
     * 문자열 변환
     * @returns {string}
     */
    toString() {
        return `[${this.code}] ${this.message}`;
    }
    
    /**
     * 사용자 표시용 메시지
     * @returns {string}
     */
    getUserMessage() {
        // 심각도에 따른 prefix
        const prefixes = {
            [ERROR_SEVERITY.LOW]: 'ℹ️',
            [ERROR_SEVERITY.MEDIUM]: '⚠️',
            [ERROR_SEVERITY.HIGH]: '❌',
            [ERROR_SEVERITY.CRITICAL]: '🚨'
        };
        
        return `${prefixes[this.severity] || ''} ${this.message}`;
    }
    
    /**
     * 심각한 에러인지 확인
     * @returns {boolean}
     */
    isCritical() {
        return this.severity === ERROR_SEVERITY.CRITICAL;
    }
    
    /**
     * 특정 카테고리인지 확인
     * @param {string} category
     * @returns {boolean}
     */
    isCategory(category) {
        return this.category === category;
    }
    
    // =========================================================
    // 정적 팩토리 메서드
    // =========================================================
    
    /**
     * 네트워크 에러 생성
     * @param {string} message
     * @param {Object} details
     * @returns {AppError}
     */
    static network(message, details = null) {
        return new AppError({
            code: ERROR_CODE.NETWORK_ERROR,
            message,
            severity: ERROR_SEVERITY.HIGH,
            details
        });
    }
    
    /**
     * API 에러 생성
     * @param {number} statusCode - HTTP 상태 코드
     * @param {string} message
     * @param {Object} details
     * @returns {AppError}
     */
    static api(statusCode, message, details = null) {
        const codeMap = {
            400: ERROR_CODE.VALIDATION_ERROR,
            401: ERROR_CODE.AUTH_UNAUTHORIZED,
            403: ERROR_CODE.AUTH_FORBIDDEN,
            404: ERROR_CODE.API_NOT_FOUND,
            500: ERROR_CODE.API_SERVER_ERROR
        };
        
        return new AppError({
            code: codeMap[statusCode] || ERROR_CODE.API_ERROR,
            message,
            severity: statusCode >= 500 ? ERROR_SEVERITY.HIGH : ERROR_SEVERITY.MEDIUM,
            details: { statusCode, ...details }
        });
    }
    
    /**
     * 유효성 검사 에러 생성
     * @param {string} message
     * @param {Object} details - 검증 실패 필드 정보
     * @returns {AppError}
     */
    static validation(message, details = null) {
        return new AppError({
            code: ERROR_CODE.VALIDATION_ERROR,
            message,
            severity: ERROR_SEVERITY.MEDIUM,
            details
        });
    }
    
    /**
     * 인증 에러 생성
     * @param {string} message
     * @returns {AppError}
     */
    static auth(message = 'Authentication required') {
        return new AppError({
            code: ERROR_CODE.AUTH_UNAUTHORIZED,
            message,
            severity: ERROR_SEVERITY.HIGH
        });
    }
    
    /**
     * 데이터베이스 에러 생성
     * @param {string} message
     * @param {Object} details
     * @returns {AppError}
     */
    static database(message, details = null) {
        return new AppError({
            code: ERROR_CODE.DATABASE_ERROR,
            message,
            severity: ERROR_SEVERITY.HIGH,
            details
        });
    }
    
    /**
     * 파일 에러 생성
     * @param {string} message
     * @param {Object} details
     * @returns {AppError}
     */
    static file(message, details = null) {
        return new AppError({
            code: ERROR_CODE.FILE_ERROR,
            message,
            severity: ERROR_SEVERITY.MEDIUM,
            details
        });
    }
    
    /**
     * 렌더링 에러 생성
     * @param {string} message
     * @param {Object} details
     * @returns {AppError}
     */
    static render(message, details = null) {
        return new AppError({
            code: ERROR_CODE.RENDER_ERROR,
            message,
            severity: ERROR_SEVERITY.HIGH,
            details
        });
    }
    
    /**
     * 일반 에러를 AppError로 래핑
     * @param {Error} error
     * @param {number} code
     * @returns {AppError}
     */
    static wrap(error, code = ERROR_CODE.UNKNOWN_ERROR) {
        if (error instanceof AppError) {
            return error;
        }
        
        return new AppError({
            code,
            message: error.message,
            cause: error,
            details: { originalName: error.name }
        });
    }
}

export default AppError;