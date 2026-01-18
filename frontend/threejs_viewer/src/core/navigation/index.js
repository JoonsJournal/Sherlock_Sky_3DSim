/**
 * navigation/index.js
 * ====================
 * Navigation 모듈 통합 export
 * 
 * @version 1.1.0
 * @description
 * - NavigationController 및 관련 유틸리티 통합 export
 * - 외부에서 사용할 때 단일 진입점 제공
 * - 🆕 Panel 관련 상수/함수 export 추가
 * 
 * @example
 * import { navigationController, NAV_MODE } from './core/navigation';
 * 
 * // Monitoring 3D View로 이동
 * await navigationController.navigate(NAV_MODE.MONITORING, '3d-view');
 * 
 * @changelog
 * - v1.1.0: 🆕 Panel 관련 export 추가 (2026-01-18)
 *           - PANEL_TYPE, PANEL_RULES export
 *           - getPanelRules, isPanelAllowedInMode 등 헬퍼 함수 export
 *           - ⚠️ 호환성: 기존 모든 export 100% 유지
 * - v1.0.0: 🆕 초기 버전 (2026-01-18)
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/navigation/index.js
 * 작성일: 2026-01-18
 * 수정일: 2026-01-18
 */

// ═══════════════════════════════════════════════════════════════════════════════
// NavigationController
// ═══════════════════════════════════════════════════════════════════════════════

export { 
    NavigationController, 
    navigationController 
} from './NavigationController.js';

// ═══════════════════════════════════════════════════════════════════════════════
// NavigationRules - 기존 export (유지)
// ═══════════════════════════════════════════════════════════════════════════════

export {
    NAVIGATION_RULES,
    LAYER_CONFIG,
    NAV_MODE,
    getModeRules,
    getSubmodeRules,
    computeFinalLayers,
    appModeToNavMode,
    navModeToAppMode,
    hasSubmodes,
    getSubmodeList,
    findParentMode,
    debugNavigationRules
} from './NavigationRules.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 🆕 v1.1.0: Panel 관련 export 추가
// ═══════════════════════════════════════════════════════════════════════════════

export {
    // Panel 상수
    PANEL_TYPE,
    PANEL_RULES,
    
    // Panel 유틸리티 함수
    getPanelRules,
    isPanelAllowedInMode,
    getPanelsToCloseOnModeChange,
    getAllPanelTypes,
    
    // Panel 디버그
    debugPanelRules
} from './NavigationRules.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 편의 함수 (Facade) - 기존 유지
// ═══════════════════════════════════════════════════════════════════════════════

import { navigationController } from './NavigationController.js';
import { NAV_MODE } from './NavigationRules.js';

/**
 * Monitoring 모드로 이동
 * @param {string} [submode='3d-view'] - 서브모드
 * @returns {Promise<boolean>}
 */
export async function goToMonitoring(submode = '3d-view') {
    return navigationController.navigate(NAV_MODE.MONITORING, submode);
}

/**
 * Analysis 모드로 이동
 * @param {string} [submode='dashboard'] - 서브모드
 * @returns {Promise<boolean>}
 */
export async function goToAnalysis(submode = 'dashboard') {
    return navigationController.navigate(NAV_MODE.ANALYSIS, submode);
}

/**
 * Layout 모드로 이동
 * @param {string} [submode='layout-editor'] - 서브모드
 * @returns {Promise<boolean>}
 */
export async function goToLayout(submode = 'layout-editor') {
    return navigationController.navigate(NAV_MODE.LAYOUT, submode);
}

/**
 * 홈으로 이동
 * @returns {Promise<boolean>}
 */
export async function goHome() {
    return navigationController.goHome();
}

/**
 * 3D View로 이동
 * @returns {Promise<boolean>}
 */
export async function goTo3DView() {
    return navigationController.navigate(NAV_MODE.MONITORING, '3d-view');
}

/**
 * Ranking View로 이동
 * @returns {Promise<boolean>}
 */
export async function goToRankingView() {
    return navigationController.navigate(NAV_MODE.MONITORING, 'ranking-view');
}

/**
 * 이전으로 돌아가기
 * @returns {Promise<boolean>}
 */
export async function goBack() {
    return navigationController.goBack();
}