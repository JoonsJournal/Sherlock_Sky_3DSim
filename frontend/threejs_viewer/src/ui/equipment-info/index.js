/**
 * equipment-info/index.js
 * =======================
 * Equipment Info Panel 모듈 Barrel Export
 * 
 * @version 2.0.0
 * @description
 * - 🆕 v2.0.0: 리팩토링된 모듈 export 추가 (2026-01-25)
 *   - constants/PanelCSSConstants.js 추가
 *   - managers/DrawerAnimationManager.js 추가
 *   - managers/SelectionHandler.js 추가
 *   - ⚠️ 호환성: 기존 모든 export 100% 유지
 * - v1.0.0: 초기 버전
 * 
 * @exports
 * - Constants: PANEL_CSS, PANEL_UTIL, PANEL_ANIMATION
 * - Managers: DrawerAnimationManager, SelectionHandler
 * - Components: HeaderStatus, GaugeRenderer
 * - Tabs: GeneralTab, PCInfoTab
 * - Utils: DataCache, DataFormatter, DataMerger, DurationTimer
 * - Template: getPanelTemplate, getDOMReferences, DOM_IDS, TAB_NAMES
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/index.js
 * 작성일: 2026-01-09
 * 수정일: 2026-01-25
 */

// =========================================================================
// Constants (🆕 v2.0.0)
// =========================================================================
export {
    PANEL_CSS,
    PANEL_UTIL,
    PANEL_ANIMATION,
    // Legacy aliases
    CSS,
    UTIL,
    ANIMATION
} from './constants/PanelCSSConstants.js';

// =========================================================================
// Managers (🆕 v2.0.0)
// =========================================================================
export { DrawerAnimationManager } from './managers/DrawerAnimationManager.js';
export { SelectionHandler } from './managers/SelectionHandler.js';

// =========================================================================
// Components
// =========================================================================
export { HeaderStatus } from './components/HeaderStatus.js';
export { GaugeRenderer } from './components/GaugeRenderer.js';

// =========================================================================
// Tabs
// =========================================================================
export { GeneralTab } from './tabs/GeneralTab.js';
export { PCInfoTab } from './tabs/PCInfoTab.js';

// =========================================================================
// Utils
// =========================================================================
export { DataCache } from './utils/DataCache.js';
export { DataFormatter } from './utils/DataFormatter.js';
export { mergeEquipmentData } from './utils/DataMerger.js';
export { DurationTimer } from './utils/DurationTimer.js';

// =========================================================================
// Template
// =========================================================================
export {
    getPanelTemplate,
    getDOMReferences,
    DOM_IDS,
    TAB_NAMES
} from './panelTemplate.js';
