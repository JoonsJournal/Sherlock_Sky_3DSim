/**
 * index.js
 * ========
 * Sidebar Handlers 모듈 통합 export
 * 
 * @version 1.0.0
 * @created 2026-01-25
 * @modified 2026-01-25
 * 
 * @changelog
 * - v1.0.0: 초기 버전
 *           - SidebarClickHandlers export
 *           - SidebarEventHandlers export
 * 
 * @usage
 * import { SidebarClickHandlers, SidebarEventHandlers } from './handlers/index.js';
 * 
 * // 또는 개별 유틸리티 함수
 * import { getParentModeForSubmode, mapToNavMode } from './handlers/index.js';
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/handlers/index.js
 */

// ============================================
// Click Handlers
// ============================================

export { 
    SidebarClickHandlers,
    default as SidebarClickHandlersDefault,
    
    // Static mapping functions
    getParentModeForSubmode,
    mapToNavMode,
    navModeToSidebarMode,
    
    // Mapping constants
    SUBMODE_TO_PARENT,
    SIDEBAR_TO_NAV_MODE,
    NAV_TO_SIDEBAR_MODE
} from './SidebarClickHandlers.js';

// ============================================
// Event Handlers
// ============================================

export { 
    SidebarEventHandlers,
    default as SidebarEventHandlersDefault
} from './SidebarEventHandlers.js';

// ============================================
// Version Info
// ============================================

export const VERSION = '1.0.0';

// ============================================
// Default Export
// ============================================

import { SidebarClickHandlers } from './SidebarClickHandlers.js';
import { SidebarEventHandlers } from './SidebarEventHandlers.js';

export default {
    SidebarClickHandlers,
    SidebarEventHandlers,
    VERSION
};