/**
 * env-config.js
 * 런타임 환경 설정 (프로덕션 배포 시 사용)
 * 
 * 이 파일은 배포 시 실제 환경 값으로 치환됩니다.
 * Docker, Kubernetes 등에서 환경 변수를 주입할 수 있습니다.
 */

window.ENV = {
    // API 서버 주소
    API_BASE_URL: '${API_BASE_URL}' || 'http://localhost:8000/api',
    
    // WebSocket 서버 주소
    WS_URL: '${WS_URL}' || 'ws://localhost:8000/ws',
    
    // 디버그 모드
    DEBUG_MODE: '${DEBUG_MODE}' === 'true' || false,
    
    // 환경 이름
    ENVIRONMENT: '${ENVIRONMENT}' || 'production',
    
    // 추가 설정
    MAX_RECONNECT_ATTEMPTS: parseInt('${MAX_RECONNECT_ATTEMPTS}') || 10,
    RECONNECT_INTERVAL: parseInt('${RECONNECT_INTERVAL}') || 5000
};

// 템플릿 변수가 치환되지 않은 경우 기본값 사용
Object.keys(window.ENV).forEach(key => {
    const value = window.ENV[key];
    if (typeof value === 'string' && value.startsWith('${')) {
        // 템플릿 변수가 그대로 남아있으면 undefined로 설정
        delete window.ENV[key];
    }
});

console.log('✓ 런타임 환경 설정 로드됨');