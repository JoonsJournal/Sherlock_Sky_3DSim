/**
 * app/index.js
 * =============
 * App 모듈 Barrel Export
 * 
 * @version 2.0.1
 * @description
 * - app/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * - main.js 리팩토링 Phase 1~11까지 점진적 확장 예정
 * 
 * @changelog
 * - v2.0.1: 🐛 debugApp() async 함수 수정 (2026-01-25)
 *           - await 에러 수정 (ts1308)
 * - v2.0.0: Phase 2 - AppState 모듈 추가 (2026-01-25)
 *           - services 객체 export
 *           - sidebarState 관리 함수 export
 *           - screenManager export
 *           - 서비스 헬퍼 함수 export (getService, setService 등)
 *           - ⚠️ 호환성: main.js 기존 패턴 100% 유지
 * - v1.0.0: Phase 1 - AppConfig 모듈 추가 (2026-01-25)
 *           - SITE_ID, RECOVERY_STRATEGIES, USE_DEPRECATION_WARNINGS export
 *           - ⚠️ 호환성: main.js 기존 import 패턴 지원
 * 
 * @exports
 * - AppConfig.js: 전역 설정 및 상수
 * - AppState.js: 전역 상태 관리
 * 
 * 📁 위치: frontend/threejs_viewer/src/app/index.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// AppConfig - 전역 설정 및 상수 (Phase 1)
// ============================================
export {
    // Site ID
    SITE_ID,
    DEFAULT_SITE_ID,
    getSiteId,
    
    // Deprecation 설정
    USE_DEPRECATION_WARNINGS,
    
    // 복구 전략
    RECOVERY_STRATEGIES,
    RECOVERY_ACTIONS,
    getRecoveryStrategy,
    hasRecoveryStrategy,
    
    // 디버그
    debugAppConfig
} from './AppConfig.js';

// ============================================
// AppState - 전역 상태 관리 (Phase 2)
// ============================================
export {
    // 서비스 저장소
    services,
    
    // sidebarState 관리
    sidebarState,
    DEFAULT_SIDEBAR_STATE,
    initSidebarState,
    updateSidebarState,
    getSidebarState,
    
    // Screen Manager
    screenManager,
    
    // window.services 노출
    exposeServicesToWindow,
    
    // 서비스 헬퍼
    getService,
    setService,
    hasService,
    clearService,
    
    // 디버그
    debugAppState
} from './AppState.js';

// ============================================
// 🔮 향후 추가 예정 (Phase 3~11)
// ============================================

// Phase 3: AppEventBus - 이벤트 버스 통합
// export { ... } from './AppEventBus.js';

// Phase 4: AppFunctions - 전역 함수 관리
// export { ... } from './AppFunctions.js';

// Phase 5: AppModeManager - 모드 관리
// export { ... } from './AppModeManager.js';

// Phase 10: AppInitializer - 초기화 오케스트레이터
// export { ... } from './AppInitializer.js';

// ============================================
// 통합 디버그 함수
// ============================================

// 직접 import (동기)
import { debugAppConfig } from './AppConfig.js';
import { debugAppState } from './AppState.js';

/**
 * 모든 App 모듈 디버그 정보 출력 (동기 버전)
 * 
 * @example
 * import { debugApp } from './app/index.js';
 * debugApp();
 */
export function debugApp() {
    console.group('🚀 App Module Debug (v2.0.1)');
    
    // Phase 1: AppConfig
    debugAppConfig();
    
    // Phase 2: AppState
    debugAppState();
    
    console.groupEnd();
}

/**
 * 간단한 상태 요약 출력
 * 
 * @example
 * import { debugAppSync } from './app/index.js';
 * debugAppSync();
 */
export function debugAppSync() {
    console.group('🚀 App Module Debug (v2.0.1)');
    console.log('Phase 1: AppConfig');
    console.log('  - SITE_ID, RECOVERY_STRATEGIES, USE_DEPRECATION_WARNINGS');
    console.log('Phase 2: AppState');
    console.log('  - services, sidebarState, screenManager');
    console.log('\n💡 상세 정보: debugAppConfig(), debugAppState()');
    console.groupEnd();
}