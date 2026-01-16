/**
 * environment.js
 * 환경별 설정 관리 - 중앙 집중식 포트 관리
 * 
 * @version 2.0.0
 * @updated 2026-01-16
 * 
 * @changelog
 * - v2.0.0: 🔧 중앙 집중식 포트 관리 도입 (2026-01-16)
 *           - BACKEND_PORT, FRONTEND_PORT 상수 추가 (상단에서 관리)
 *           - 서버 이전 시 상단 포트 설정만 수정하면 전체 적용
 *           - 기존 기능 100% 유지 (모든 export 함수 동일)
 * - v1.1.0: 🔧 동적 URL fallback 적용 (2026-01-14)
 *           - 기존: localhost:8000 하드코딩 → IP 접속 시 CORS 에러 발생
 *           - 변경: window.location.hostname 기반 동적 URL 생성
 *           - getDefaultApiUrl(), getDefaultWsUrl() 헬퍼 함수 추가
 * - v1.0.0: 초기 버전
 * 
 * 우선순위:
 * 1. window.ENV (런타임 주입 - 프로덕션) ← env-config.js에서 설정
 * 2. import.meta.env (빌드 시점 - Vite 사용 시)
 * 3. 동적 기본값 (상단 상수 사용)
 * 
 * 📌 서버 이전 시 수정할 항목:
 *    - BACKEND_PORT: Backend API 서버 포트 (아래 상수)
 *    - FRONTEND_PORT: Frontend 서버 포트 (참고용)
 *    ⚠️ 주의: env-config.js의 포트도 함께 수정해야 합니다!
 * 
 * 위치: frontend/threejs_viewer/src/config/environment.js
 */

// ============================================
// 🔑 포트 설정 (중앙 관리)
// 서버 이전 시 이 값들만 수정하세요!
// ============================================
const BACKEND_PORT = 8008;   // Backend API 서버 포트
const FRONTEND_PORT = 8088;  // Frontend 서버 포트 (참고용)

// ============================================
// 동적 URL 생성 헬퍼 함수
// ============================================

/**
 * 동적 API Base URL 생성 (v1.1.0 기존 호환)
 * - localhost 접속 → http://localhost:{BACKEND_PORT}/api
 * - IP 접속 → http://{IP}:{BACKEND_PORT}/api
 * 
 * @returns {string} API Base URL
 */
function getDefaultApiUrl() {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:${BACKEND_PORT}/api`;
}

/**
 * 동적 WebSocket URL 생성 (v1.1.0 기존 호환)
 * - localhost 접속 → ws://localhost:{BACKEND_PORT}/ws
 * - IP 접속 → ws://{IP}:{BACKEND_PORT}/ws
 * 
 * @returns {string} WebSocket URL
 */
function getDefaultWsUrl() {
    const hostname = window.location.hostname || 'localhost';
    return `ws://${hostname}:${BACKEND_PORT}/ws`;
}

// ============================================
// 환경 변수 로드
// ============================================

/**
 * 환경 변수 로드 (기존 호환)
 */
function loadEnvironment() {
    // 1. 런타임 환경 변수 (window.ENV) - env-config.js에서 설정
    if (window.ENV) {
        console.log('✓ 런타임 환경 설정 로드됨 (window.ENV)');
        return window.ENV;
    }
    
    // 2. 빌드 시점 환경 변수 (import.meta.env) - Vite 사용 시
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // Vite 환경 변수가 실제로 설정되어 있는지 확인
        const viteApiUrl = import.meta.env.VITE_API_BASE_URL;
        const viteWsUrl = import.meta.env.VITE_WS_URL;
        
        // v1.1.0 기존 호환: Vite 환경변수가 실제로 존재하는 경우에만 사용
        if (viteApiUrl && viteWsUrl) {
            console.log('✓ 빌드 환경 설정 로드됨 (import.meta.env)');
            return {
                // 🆕 v2.0.0: 포트 설정 추가
                BACKEND_PORT: BACKEND_PORT,
                FRONTEND_PORT: FRONTEND_PORT,
                // 기존 호환
                API_BASE_URL: viteApiUrl,
                WS_URL: viteWsUrl,
                DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
                ENVIRONMENT: import.meta.env.MODE || 'development'
            };
        }
    }
    
    // 3. 동적 기본값 (상단 상수 사용) - v1.1.0 기존 호환 + v2.0.0 포트 추가
    const dynamicApiUrl = getDefaultApiUrl();
    const dynamicWsUrl = getDefaultWsUrl();
    
    console.log(`⚠ 동적 환경 설정 사용: ${window.location.hostname}:${BACKEND_PORT}`);
    console.log(`  → API: ${dynamicApiUrl}`);
    console.log(`  → WS: ${dynamicWsUrl}`);
    
    return {
        // 🆕 v2.0.0: 포트 설정 추가
        BACKEND_PORT: BACKEND_PORT,
        FRONTEND_PORT: FRONTEND_PORT,
        // 기존 호환
        API_BASE_URL: dynamicApiUrl,
        WS_URL: dynamicWsUrl,
        DEBUG_MODE: true,
        ENVIRONMENT: 'development'
    };
}

// 환경 설정 객체 (기존 export 유지)
export const ENV = loadEnvironment();

// ============================================
// 환경 정보 유틸리티 (기존 export 100% 유지)
// ============================================

/**
 * 환경 정보 출력 (기존 호환 + v2.0.0 포트 정보 추가)
 */
export function printEnvironmentInfo() {
    console.group('🌍 Environment Configuration (v2.0.0)');
    console.log('Environment:', ENV.ENVIRONMENT || 'development');
    // 🆕 v2.0.0: 포트 정보 추가
    console.log('Backend Port:', ENV.BACKEND_PORT || BACKEND_PORT);
    console.log('Frontend Port:', ENV.FRONTEND_PORT || FRONTEND_PORT);
    // 기존 호환
    console.log('API Base URL:', ENV.API_BASE_URL);
    console.log('WebSocket URL:', ENV.WS_URL);
    console.log('Debug Mode:', ENV.DEBUG_MODE ? 'Enabled' : 'Disabled');
    console.log('Current Hostname:', window.location.hostname);
    console.groupEnd();
}

/**
 * 개발 환경 여부 확인 (기존 호환)
 */
export function isDevelopment() {
    return ENV.ENVIRONMENT === 'development' || ENV.DEBUG_MODE;
}

/**
 * 프로덕션 환경 여부 확인 (기존 호환)
 */
export function isProduction() {
    return ENV.ENVIRONMENT === 'production';
}

/**
 * API URL 빌더 (기존 호환)
 * @param {string} endpoint - API 엔드포인트
 * @returns {string} 전체 API URL
 */
export function buildApiUrl(endpoint) {
    // 슬래시 중복 제거
    const cleanBase = ENV.API_BASE_URL.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    return `${cleanBase}/${cleanEndpoint}`;
}

/**
 * WebSocket URL 빌더 (기존 호환)
 * @param {string} path - WebSocket 경로
 * @returns {string} 전체 WebSocket URL
 */
export function buildWsUrl(path = '') {
    const cleanBase = ENV.WS_URL.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
}

/**
 * 환경 검증 (기존 호환)
 * @returns {boolean} 검증 성공 여부
 */
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

// 개발 모드에서 자동으로 환경 정보 출력 (기존 호환)
if (isDevelopment()) {
    printEnvironmentInfo();
    validateEnvironment();
}

// 전역 접근 (디버깅용) - 기존 호환 + v2.0.0 확장
if (typeof window !== 'undefined') {
    // 기존 호환
    window.getEnvironment = () => ENV;
    window.printEnvironmentInfo = printEnvironmentInfo;
    
    // v1.1.0 기존 호환: 동적 URL 헬퍼 전역 노출
    window.getDefaultApiUrl = getDefaultApiUrl;
    window.getDefaultWsUrl = getDefaultWsUrl;
    
    // 🆕 v2.0.0: 포트 설정 전역 노출 (디버깅용)
    window.SHERLOCK_PORTS = {
        BACKEND: BACKEND_PORT,
        FRONTEND: FRONTEND_PORT
    };
}
