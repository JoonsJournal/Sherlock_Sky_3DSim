/**
 * errorTypes.js
 * 에러 타입 상수 정의
 * 
 * @version 1.0.0
 * @description 애플리케이션 전역 에러 타입
 */

/**
 * 에러 카테고리
 */
export const ERROR_CATEGORY = Object.freeze({
    NETWORK: 'NETWORK',
    VALIDATION: 'VALIDATION',
    AUTH: 'AUTH',
    DATABASE: 'DATABASE',
    FILE: 'FILE',
    RENDER: 'RENDER',
    CONFIG: 'CONFIG',
    UNKNOWN: 'UNKNOWN'
});

/**
 * 에러 코드
 */
export const ERROR_CODE = Object.freeze({
    // Network 에러 (1000번대)
    NETWORK_ERROR: 1000,
    NETWORK_TIMEOUT: 1001,
    NETWORK_OFFLINE: 1002,
    API_ERROR: 1010,
    API_NOT_FOUND: 1011,
    API_SERVER_ERROR: 1012,
    WEBSOCKET_ERROR: 1020,
    WEBSOCKET_CLOSED: 1021,
    
    // Validation 에러 (2000번대)
    VALIDATION_ERROR: 2000,
    VALIDATION_REQUIRED: 2001,
    VALIDATION_TYPE: 2002,
    VALIDATION_RANGE: 2003,
    VALIDATION_FORMAT: 2004,
    LAYOUT_INVALID: 2010,
    LAYOUT_MISSING_FIELD: 2011,
    
    // Auth 에러 (3000번대)
    AUTH_ERROR: 3000,
    AUTH_UNAUTHORIZED: 3001,
    AUTH_FORBIDDEN: 3002,
    AUTH_TOKEN_EXPIRED: 3003,
    
    // Database 에러 (4000번대)
    DATABASE_ERROR: 4000,
    DATABASE_CONNECTION: 4001,
    DATABASE_QUERY: 4002,
    DATABASE_TIMEOUT: 4003,
    
    // File 에러 (5000번대)
    FILE_ERROR: 5000,
    FILE_NOT_FOUND: 5001,
    FILE_READ_ERROR: 5002,
    FILE_WRITE_ERROR: 5003,
    FILE_PARSE_ERROR: 5004,
    
    // Render 에러 (6000번대)
    RENDER_ERROR: 6000,
    RENDER_WEBGL: 6001,
    RENDER_TEXTURE: 6002,
    RENDER_MODEL: 6003,
    
    // Config 에러 (7000번대)
    CONFIG_ERROR: 7000,
    CONFIG_MISSING: 7001,
    CONFIG_INVALID: 7002,
    
    // Unknown (9000번대)
    UNKNOWN_ERROR: 9000
});

/**
 * 에러 심각도
 */
export const ERROR_SEVERITY = Object.freeze({
    LOW: 'low',           // 로깅만, 사용자 알림 없음
    MEDIUM: 'medium',     // Toast 알림
    HIGH: 'high',         // Modal 알림
    CRITICAL: 'critical'  // 앱 중단 필요
});

/**
 * HTTP 상태 코드 → 에러 코드 매핑
 */
export const HTTP_TO_ERROR_CODE = Object.freeze({
    400: ERROR_CODE.VALIDATION_ERROR,
    401: ERROR_CODE.AUTH_UNAUTHORIZED,
    403: ERROR_CODE.AUTH_FORBIDDEN,
    404: ERROR_CODE.API_NOT_FOUND,
    408: ERROR_CODE.NETWORK_TIMEOUT,
    500: ERROR_CODE.API_SERVER_ERROR,
    502: ERROR_CODE.API_SERVER_ERROR,
    503: ERROR_CODE.API_SERVER_ERROR
});

/**
 * 에러 코드 → 카테고리 매핑
 * @param {number} code - 에러 코드
 * @returns {string} 카테고리
 */
export function getErrorCategory(code) {
    if (code >= 1000 && code < 2000) return ERROR_CATEGORY.NETWORK;
    if (code >= 2000 && code < 3000) return ERROR_CATEGORY.VALIDATION;
    if (code >= 3000 && code < 4000) return ERROR_CATEGORY.AUTH;
    if (code >= 4000 && code < 5000) return ERROR_CATEGORY.DATABASE;
    if (code >= 5000 && code < 6000) return ERROR_CATEGORY.FILE;
    if (code >= 6000 && code < 7000) return ERROR_CATEGORY.RENDER;
    if (code >= 7000 && code < 8000) return ERROR_CATEGORY.CONFIG;
    return ERROR_CATEGORY.UNKNOWN;
}

/**
 * 에러 코드 → 기본 메시지 매핑
 */
export const ERROR_MESSAGES = Object.freeze({
    // Network
    [ERROR_CODE.NETWORK_ERROR]: 'Network error occurred',
    [ERROR_CODE.NETWORK_TIMEOUT]: 'Request timed out',
    [ERROR_CODE.NETWORK_OFFLINE]: 'No internet connection',
    [ERROR_CODE.API_ERROR]: 'API request failed',
    [ERROR_CODE.API_NOT_FOUND]: 'Resource not found',
    [ERROR_CODE.API_SERVER_ERROR]: 'Server error occurred',
    [ERROR_CODE.WEBSOCKET_ERROR]: 'WebSocket error',
    [ERROR_CODE.WEBSOCKET_CLOSED]: 'WebSocket connection closed',
    
    // Validation
    [ERROR_CODE.VALIDATION_ERROR]: 'Validation failed',
    [ERROR_CODE.VALIDATION_REQUIRED]: 'Required field is missing',
    [ERROR_CODE.VALIDATION_TYPE]: 'Invalid data type',
    [ERROR_CODE.VALIDATION_RANGE]: 'Value out of range',
    [ERROR_CODE.VALIDATION_FORMAT]: 'Invalid format',
    [ERROR_CODE.LAYOUT_INVALID]: 'Invalid layout data',
    [ERROR_CODE.LAYOUT_MISSING_FIELD]: 'Missing required layout field',
    
    // Auth
    [ERROR_CODE.AUTH_ERROR]: 'Authentication error',
    [ERROR_CODE.AUTH_UNAUTHORIZED]: 'Unauthorized access',
    [ERROR_CODE.AUTH_FORBIDDEN]: 'Access forbidden',
    [ERROR_CODE.AUTH_TOKEN_EXPIRED]: 'Session expired',
    
    // Database
    [ERROR_CODE.DATABASE_ERROR]: 'Database error',
    [ERROR_CODE.DATABASE_CONNECTION]: 'Database connection failed',
    [ERROR_CODE.DATABASE_QUERY]: 'Database query failed',
    [ERROR_CODE.DATABASE_TIMEOUT]: 'Database operation timed out',
    
    // File
    [ERROR_CODE.FILE_ERROR]: 'File operation failed',
    [ERROR_CODE.FILE_NOT_FOUND]: 'File not found',
    [ERROR_CODE.FILE_READ_ERROR]: 'Failed to read file',
    [ERROR_CODE.FILE_WRITE_ERROR]: 'Failed to write file',
    [ERROR_CODE.FILE_PARSE_ERROR]: 'Failed to parse file',
    
    // Render
    [ERROR_CODE.RENDER_ERROR]: 'Rendering error',
    [ERROR_CODE.RENDER_WEBGL]: 'WebGL not supported',
    [ERROR_CODE.RENDER_TEXTURE]: 'Failed to load texture',
    [ERROR_CODE.RENDER_MODEL]: 'Failed to load 3D model',
    
    // Config
    [ERROR_CODE.CONFIG_ERROR]: 'Configuration error',
    [ERROR_CODE.CONFIG_MISSING]: 'Missing configuration',
    [ERROR_CODE.CONFIG_INVALID]: 'Invalid configuration',
    
    // Unknown
    [ERROR_CODE.UNKNOWN_ERROR]: 'An unknown error occurred'
});

/**
 * 에러 메시지 가져오기
 * @param {number} code - 에러 코드
 * @returns {string}
 */
export function getErrorMessage(code) {
    return ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODE.UNKNOWN_ERROR];
}