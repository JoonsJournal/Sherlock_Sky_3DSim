/**
 * uds/index.js
 * =============
 * UDS 모듈 Barrel Export (main.js 리팩토링용)
 * 
 * @version 1.0.0
 * @description
 * - UDS 초기화 및 이벤트 핸들러 통합 export
 * - main.js에서 사용하는 함수들만 export
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 7 - UDS 모듈 생성 (2026-01-26)
 *           - UDSInitializer export
 *           - UDSEventHandlers export
 *           - ⚠️ 호환성: main.js 기존 패턴 100% 유지
 * 
 * @exports
 * - initializeUDSAfterConnection
 * - setupUDSEventListeners
 * - convertUDSStatsToStatusBar
 * 
 * 📁 위치: frontend/threejs_viewer/src/uds/index.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

// ============================================
// UDSInitializer - 초기화 로직
// ============================================
export {
    initializeUDSAfterConnection
} from './UDSInitializer.js';

// ============================================
// UDSEventHandlers - 이벤트 핸들러
// ============================================
export {
    setupUDSEventListeners,
    convertUDSStatsToStatusBar
} from './UDSEventHandlers.js';

// ============================================
// 디버그 유틸리티
// ============================================

/**
 * UDS 모듈 디버그 정보 출력
 * 
 * @example
 * import { debugUDSModule } from './uds/index.js';
 * debugUDSModule();
 */
export function debugUDSModule() {
    console.group('📊 UDS Module Debug (v1.0.0)');
    console.log('UDSInitializer: initializeUDSAfterConnection');
    console.log('UDSEventHandlers: setupUDSEventListeners, convertUDSStatsToStatusBar');
    console.log('');
    console.log('💡 사용 예시:');
    console.log('  import { initializeUDSAfterConnection } from "./uds/index.js";');
    console.log('  await initializeUDSAfterConnection(siteId);');
    console.groupEnd();
}