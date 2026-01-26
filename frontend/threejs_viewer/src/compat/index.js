/**
 * compat/index.js
 * ================
 * Compat 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - compat/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * - 하위 호환 함수 및 전역 노출 기능 제공
 * 
 * @changelog
 * - v1.0.0: Phase 9 - 초기 생성 (2026-01-26)
 *           - LegacyHelpers.js export
 *           - LegacyGlobals.js export
 *           - ⚠️ 호환성: main.js 기존 동작 100% 유지
 * 
 * @exports
 * - LegacyHelpers.js: 하위 호환 헬퍼 함수들
 * - LegacyGlobals.js: 전역 객체 노출 함수들
 * 
 * 📁 위치: frontend/threejs_viewer/src/compat/index.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

// ============================================
// LegacyHelpers - 하위 호환 헬퍼 함수들
// ============================================
export {
    // 참조 설정
    setSidebarUIRef,
    getSidebarUIRef,
    
    // Sidebar UI 하위 호환 함수들
    _updateSidebarButtonState,
    _updateSubmenuActiveState,
    _enableSidebarIcons,
    _disableSidebarIcons,
    _updateCoverStatus,
    _updateStatusBarConnection,
    
    // 유틸리티
    _delay,
    
    // 액션 헬퍼 함수들
    _actionResubscribeWebSocket,
    _actionRefreshStatus,
    _actionReloadAnalysisData,
    _actionReconnectDatabase,
    _actionRefreshDashboard,
    _actionReconnectCache,
    _actionReconnectMappingApi,
    
    // 디버그
    debugLegacyHelpers
} from './LegacyHelpers.js';

// ============================================
// LegacyGlobals - 전역 객체 노출
// ============================================
export {
    // 컨텍스트 설정
    setGlobalsContext,
    
    // 전역 노출 함수
    exposeGlobalObjectsAfterSceneInit,
    
    // 디버그
    debugLegacyGlobals
} from './LegacyGlobals.js';

// ============================================
// 통합 디버그 함수
// ============================================

// 직접 import (동기)
import { debugLegacyHelpers } from './LegacyHelpers.js';
import { debugLegacyGlobals } from './LegacyGlobals.js';

/**
 * 모든 Compat 모듈 디버그 정보 출력
 * 
 * @example
 * import { debugCompat } from './compat/index.js';
 * debugCompat();
 */
export function debugCompat() {
    console.group('🚀 Compat Module Debug (v1.0.0)');
    
    // LegacyHelpers
    debugLegacyHelpers();
    
    // LegacyGlobals
    debugLegacyGlobals();
    
    console.groupEnd();
}