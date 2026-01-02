/**
 * environment.js
 * 환경별 설정 관리
 * 
 * 우선순위:
 * 1. window.ENV (런타임 주입 - 프로덕션)
 * 2. import.meta.env (빌드 시점 - 개발)
 * 3. 기본값 (로컬 개발)
 */

/**
 * 환경 변수 로드
 */
function loadEnvironment() {
    // 1. 런타임 환경 변수 (window.ENV)
    if (window.ENV) {
        console.log('✓ 런타임 환경 설정 로드됨 (window.ENV)');
        return window.ENV;
    }
    
    // 2. 빌드 시점 환경 변수 (import.meta.env)
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        console.log('✓ 빌드 환경 설정 로드됨 (import.meta.env)');
        return {
            API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
            WS_URL: import.meta.env.VITE_WS_URL,
            DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
            ENVIRONMENT: import.meta.env.MODE || 'development'
        };
    }
    
    // 3. 기본값 (로컬 개발)
    console.log('⚠ 기본 환경 설정 사용 (localhost)');
    return {
        API_BASE_URL: 'http://localhost:8000/api',
        WS_URL: 'ws://localhost:8000/ws',
        DEBUG_MODE: true,
        ENVIRONMENT: 'development'
    };
}

// 환경 설정 객체
export const ENV = loadEnvironment();

// 환경 정보 출력
export function printEnvironmentInfo() {
    console.group('🌍 Environment Configuration');
    console.log('Environment:', ENV.ENVIRONMENT || 'development');
    console.log('API Base URL:', ENV.API_BASE_URL);
    console.log('WebSocket URL:', ENV.WS_URL);
    console.log('Debug Mode:', ENV.DEBUG_MODE ? 'Enabled' : 'Disabled');
    console.groupEnd();
}

// 환경별 분기
export function isDevelopment() {
    return ENV.ENVIRONMENT === 'development' || ENV.DEBUG_MODE;
}

export function isProduction() {
    return ENV.ENVIRONMENT === 'production';
}

// API URL 빌더
export function buildApiUrl(endpoint) {
    // 슬래시 중복 제거
    const cleanBase = ENV.API_BASE_URL.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    return `${cleanBase}/${cleanEndpoint}`;
}

// WebSocket URL 빌더
export function buildWsUrl(path = '') {
    const cleanBase = ENV.WS_URL.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
}

// 환경 검증
export function validateEnvironment() {
    const errors = [];
    
    if (!ENV.API_BASE_URL) {
        errors.push('API_BASE_URL이 설정되지 않았습니다');
    }
    
    if (!ENV.WS_URL) {
        errors.push('WS_URL이 설정되지 않았습니다');
    }
    
    // URL 형식 검증
    try {
        new URL(ENV.API_BASE_URL);
    } catch (e) {
        errors.push(`잘못된 API_BASE_URL 형식: ${ENV.API_BASE_URL}`);
    }
    
    if (errors.length > 0) {
        console.error('❌ 환경 설정 오류:');
        errors.forEach(err => console.error('  -', err));
        return false;
    }
    
    console.log('✓ 환경 설정 검증 완료');
    return true;
}

// 개발 모드에서 자동으로 환경 정보 출력
if (isDevelopment()) {
    printEnvironmentInfo();
    validateEnvironment();
}

// 전역 접근 (디버깅용)
if (typeof window !== 'undefined') {
    window.getEnvironment = () => ENV;
    window.printEnvironmentInfo = printEnvironmentInfo;
}