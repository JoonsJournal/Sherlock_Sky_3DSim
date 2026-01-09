/**
 * equipment-info/index.js
 * =======================
 * Equipment Info 모듈 통합 Export
 * 
 * @version 2.0.0
 * @description
 * - 모든 Equipment Info 관련 모듈 통합 export
 * - Named export 방식 사용 (권장)
 * - 카테고리별 그룹화
 * 
 * @example
 * // 개별 import
 * import { GeneralTab } from './equipment-info/index.js';
 * 
 * // 다중 import
 * import { GeneralTab, PCInfoTab, GaugeRenderer } from './equipment-info/index.js';
 * 
 * // 전체 import
 * import * as EquipmentInfo from './equipment-info/index.js';
 * const tab = new EquipmentInfo.GeneralTab(container);
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/index.js
 * 작성일: 2026-01-09
 */

// =========================================================================
// Utils (유틸리티)
// =========================================================================

/**
 * Duration Timer - 경과 시간 타이머
 * @see ./utils/DurationTimer.js
 */
export { DurationTimer } from './utils/DurationTimer.js';

/**
 * Data Formatter - 데이터 포맷팅 유틸리티
 * @see ./utils/DataFormatter.js
 */
export { DataFormatter } from './utils/DataFormatter.js';

/**
 * Data Merger - WebSocket 데이터 병합
 * @see ./utils/DataMerger.js
 */
export { 
    mergeEquipmentData, 
    mergePartial, 
    updateCacheEntry,
    hasFieldsChanged
} from './utils/DataMerger.js';

/**
 * Data Cache - 데이터 캐시 관리
 * @see ./utils/DataCache.js
 */
export { DataCache } from './utils/DataCache.js';

// =========================================================================
// Components (UI 컴포넌트)
// =========================================================================

/**
 * Gauge Renderer - Gauge UI 렌더링
 * @see ./components/GaugeRenderer.js
 */
export { GaugeRenderer } from './components/GaugeRenderer.js';

/**
 * Header Status - 헤더 상태 표시
 * @see ./components/HeaderStatus.js
 */
export { 
    HeaderStatus, 
    STATUS_CONFIG, 
    DEFAULT_STATUS 
} from './components/HeaderStatus.js';

// =========================================================================
// Tabs (탭 컴포넌트)
// =========================================================================

/**
 * General Tab - General 탭 렌더링
 * @see ./tabs/GeneralTab.js
 */
export { GeneralTab } from './tabs/GeneralTab.js';

/**
 * PC Info Tab - PC Info 탭 렌더링
 * @see ./tabs/PCInfoTab.js
 */
export { PCInfoTab } from './tabs/PCInfoTab.js';

// =========================================================================
// Template (HTML 템플릿)
// =========================================================================

/**
 * Panel Template - HTML 템플릿 및 DOM ID
 * @see ./panelTemplate.js
 */
export { 
    DOM_IDS, 
    TAB_NAMES, 
    getPanelTemplate, 
    getPlaceholderContent,
    getDOMReferences
} from './panelTemplate.js';

// =========================================================================
// 버전 정보
// =========================================================================

/**
 * 모듈 버전 정보
 */
export const VERSION = '2.0.0';

/**
 * 모듈 메타데이터
 */
export const META = {
    name: 'equipment-info',
    version: VERSION,
    description: 'Equipment Info Panel 모듈 집합',
    modules: {
        utils: ['DurationTimer', 'DataFormatter', 'DataMerger', 'DataCache'],
        components: ['GaugeRenderer', 'HeaderStatus'],
        tabs: ['GeneralTab', 'PCInfoTab'],
        template: ['panelTemplate']
    }
};