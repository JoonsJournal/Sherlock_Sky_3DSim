/**
 * index.js
 * ========
 * Sidebar Managers 모듈 통합 export
 * 
 * @version 1.0.0
 * @created 2026-01-25
 * @modified 2026-01-25
 * 
 * @changelog
 * - v1.0.0: 초기 버전
 *           - SidebarViewManager export
 *           - SidebarStateManager export
 * 
 * @usage
 * import { SidebarViewManager, SidebarStateManager } from './managers/index.js';
 * 
 * // 또는 CSS 상수
 * import { VIEW_CSS, COVER_CSS } from './managers/index.js';
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/managers/index.js
 */

// ============================================
// View Manager
// ============================================

export { 
    SidebarViewManager,
    default as SidebarViewManagerDefault,
    
    // CSS Constants
    VIEW_CSS
} from './SidebarViewManager.js';

// ============================================
// State Manager
// ============================================

export { 
    SidebarStateManager,
    default as SidebarStateManagerDefault,
    
    // CSS Constants
    COVER_CSS
} from './SidebarStateManager.js';

// ============================================
// Version Info
// ============================================

export const VERSION = '1.0.0';

// ============================================
// Default Export
// ============================================

import { SidebarViewManager } from './SidebarViewManager.js';
import { SidebarStateManager } from './SidebarStateManager.js';

export default {
    SidebarViewManager,
    SidebarStateManager,
    VERSION
};