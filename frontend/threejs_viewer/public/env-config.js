/**
 * env-config.js
 * 런타임 환경 설정 - 접속 호스트 기반 자동 설정
 */

(function() {
    // 현재 접속한 호스트를 기반으로 자동 설정
    const currentHost = window.location.hostname;
    const apiPort = 8000;
    
    window.ENV = {
        // 접속한 호스트 기준으로 API URL 자동 생성
        API_BASE_URL: `http://${currentHost}:${apiPort}/api`,
        WS_URL: `ws://${currentHost}:${apiPort}/ws`,
        
        // 디버그 모드
        DEBUG_MODE: true,
        
        // 환경 이름
        ENVIRONMENT: 'development',
        
        // 추가 설정
        MAX_RECONNECT_ATTEMPTS: 10,
        RECONNECT_INTERVAL: 5000
    };
    
    console.log('✓ 런타임 환경 설정 로드됨');
    console.log(`  → Host: ${currentHost}`);
    console.log(`  → API: ${window.ENV.API_BASE_URL}`);
    console.log(`  → WS: ${window.ENV.WS_URL}`);
})();