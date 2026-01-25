/**
 * app/index.js
 * =============
 * App 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - app/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * - main.js 리팩토링 Phase 1~11까지 점진적 확장 예정
 * 
 * @changelog
 * - v1.0.0: Phase 1 - AppConfig 모듈 추가 (2026-01-25)
 *           - SITE_ID, RECOVERY_STRATEGIES, USE_DEPRECATION_WARNINGS export
 *           - ⚠️ 호환성: main.js 기존 import 패턴 지원
 * 
 * @exports
 * - AppConfig.js: 전역 설정 및 상수
 * 
 * 📁 위치: frontend/threejs_viewer/src/app/index.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// AppConfig - 전역 설정 및 상수
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
// 🔮 향후 추가 예정 (Phase 2~11)
// ============================================

// Phase 2: AppState - 전역 상태 관리
// export { ... } from './AppState.js';

// Phase 3: AppEventBus - 이벤트 버스
// export { ... } from './AppEventBus.js';

// Phase 10: AppInitializer - 초기화 오케스트레이터
// export { ... } from './AppInitializer.js';