/**
 * equipment-info/index.js
 * =======================
 * Equipment Info 모듈 통합 Export
 * 
 * @version 1.2.0
 * @changelog
 * - v1.2.0: 탭 컴포넌트 export 추가 (GeneralTab, PCInfoTab)
 * - v1.1.0: 컴포넌트 export 추가 (GaugeRenderer, HeaderStatus)
 * - v1.0.0: 유틸리티 export
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/index.js
 * 작성일: 2026-01-09
 */

// =========================================================================
// Utils
// =========================================================================
export { DurationTimer, default as DurationTimerClass } from './utils/DurationTimer.js';
export { DataFormatter, default as DataFormatterObj } from './utils/DataFormatter.js';
export { 
    mergeEquipmentData, 
    mergePartial, 
    updateCacheEntry,
    hasFieldsChanged,
    default as DataMerger 
} from './utils/DataMerger.js';

// =========================================================================
// Components
// =========================================================================
export { GaugeRenderer, default as GaugeRendererClass } from './components/GaugeRenderer.js';
export { 
    HeaderStatus, 
    STATUS_CONFIG, 
    DEFAULT_STATUS,
    default as HeaderStatusClass 
} from './components/HeaderStatus.js';

// =========================================================================
// 🆕 v1.2.0: Tabs
// =========================================================================
export { GeneralTab, default as GeneralTabClass } from './tabs/GeneralTab.js';
export { PCInfoTab, default as PCInfoTabClass } from './tabs/PCInfoTab.js';