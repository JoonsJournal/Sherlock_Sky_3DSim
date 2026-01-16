/**
 * env-config.js
 * 런타임 환경 설정 - 중앙 집중식 포트 관리
 * 
 * @version 2.0.0
 * @updated 2026-01-16
 * 
 * @changelog
 * - v2.0.0: 🔧 중앙 집중식 포트 관리 도입 (2026-01-16)
 *           - BACKEND_PORT, FRONTEND_PORT 상수 추가
 *           - 서버 이전 시 상단 포트 설정만 수정하면 전체 적용
 *           - 기존 기능 100% 유지 (window.ENV 구조 동일)
 * - v1.0.0: 초기 버전 - 접속 호스트 기반 자동 설정
 * 
 * 📌 서버 이전 시 수정할 항목:
 *    - BACKEND_PORT: Backend API 서버 포트
 *    - FRONTEND_PORT: Frontend 서버 포트 (참고용)
 * 
 * 위치: frontend/threejs_viewer/public/env-config.js
 */

(function() {
    // ============================================
    // 🔑 포트 설정 (중앙 관리)
    // 서버 이전 시 이 값들만 수정하세요!
    // ============================================
    const BACKEND_PORT = 8008;   // Backend API 서버 포트
    const FRONTEND_PORT = 8088;  // Frontend 서버 포트 (참고용)
    
    // ============================================
    // 동적 URL 생성
    // ============================================
    // 현재 접속한 호스트를 기반으로 자동 설정
    const currentHost = window.location.hostname;
    
    window.ENV = {
        // 🆕 v2.0.0: 포트 설정 (전역 참조용)
        BACKEND_PORT: BACKEND_PORT,
        FRONTEND_PORT: FRONTEND_PORT,
        
        // 접속한 호스트 기준으로 API URL 자동 생성 (기존 호환)
        API_BASE_URL: `http://${currentHost}:${BACKEND_PORT}/api`,
        WS_URL: `ws://${currentHost}:${BACKEND_PORT}/ws`,
        
        // 디버그 모드 (기존 호환)
        DEBUG_MODE: true,
        
        // 환경 이름 (기존 호환)
        ENVIRONMENT: 'development',
        
        // 추가 설정 (기존 호환)
        MAX_RECONNECT_ATTEMPTS: 10,
        RECONNECT_INTERVAL: 5000
    };
    
    // ============================================
    // 로그 출력 (기존 호환)
    // ============================================
    console.log('✓ 런타임 환경 설정 로드됨 (v2.0.0)');
    console.log(`  → Host: ${currentHost}`);
    console.log(`  → Backend Port: ${BACKEND_PORT}`);
    console.log(`  → Frontend Port: ${FRONTEND_PORT}`);
    console.log(`  → API: ${window.ENV.API_BASE_URL}`);
    console.log(`  → WS: ${window.ENV.WS_URL}`);
})();
