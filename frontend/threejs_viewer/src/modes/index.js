/**
 * modes/index.js
 * ===============
 * Modes 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - modes/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * 
 * @changelog
 * - v1.0.0: Phase 5 - 모드 토글 함수 분리 (2026-01-25)
 *           - ModeIndicator.js: updateModeIndicator, updateButtonState
 *           - ModeToggler.js: 7개 토글 함수
 *           - ⚠️ 호환성: window.* 전역 노출 유지
 * 
 * @exports
 * - ModeIndicator.js: updateModeIndicator, updateButtonState
 * - ModeToggler.js: toggleEditMode, toggleMonitoringMode, toggleConnectionModal, etc.
 * 
 * 📁 위치: frontend/threejs_viewer/src/modes/index.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// ModeIndicator - 모드 표시 UI 업데이트
// ============================================
export {
    updateModeIndicator,
    updateButtonState,
    debugModeIndicator
} from './ModeIndicator.js';

// ============================================
// ModeToggler - 모드 토글 함수
// ============================================
export {
    // 참조 설정
    setSidebarUIRef,
    setScreenManagerRef,
    
    // 토글 함수
    toggleEditMode,
    toggleMonitoringMode,
    toggleConnectionModal,
    toggleDebugPanel,
    openEquipmentEditModal,
    toggleDevMode,
    toggleFullscreen,
    toggleAdaptivePerformance,
    
    // 전역 노출
    exposeTogglersToWindow,
    
    // 디버그
    debugModeToggler
} from './ModeToggler.js';

// ============================================
// 통합 디버그 함수
// ============================================
import { debugModeIndicator } from './ModeIndicator.js';
import { debugModeToggler } from './ModeToggler.js';

/**
 * 모든 Modes 모듈 디버그 정보 출력
 */
export function debugModes() {
    console.group('🎛️ Modes Module Debug (v1.0.0)');
    debugModeIndicator();
    debugModeToggler();
    console.groupEnd();
}