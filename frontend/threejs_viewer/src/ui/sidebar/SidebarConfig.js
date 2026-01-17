/**
 * SidebarConfig.js
 * =================
 * Sidebar UI 컴포넌트의 설정 및 상수 정의
 * 
 * @version 1.2.0
 * @created 2026-01-11
 * @updated 2026-01-17
 * 
 * @changelog
 * - v1.2.0: 🆕 Ranking View 메뉴 활성화 (2026-01-17) - Phase 5
 *           - 'sub-ranking-view' disabled: false로 변경
 *           - 라벨에서 "(Coming Soon)" 제거
 *           - MODE_MAP에 'ranking-view' 추가
 *           - ⚠️ 호환성: 기존 모든 설정 100% 유지
 * - v1.1.0: 🆕 Analysis 버튼 활성화 (2026-01-13)
 *           - disabled: true 제거
 *           - selectable: true 추가
 *           - hasSubmenu: true 추가 (향후 서브메뉴 지원)
 * - v1.0.0: 초기 버전
 * 
 * @description
 * Sidebar.js에서 분리된 설정 파일
 * - 버튼 구성 (SIDEBAR_BUTTONS)
 * - 서브메뉴 구성 (SUBMENUS)
 * - 사이트 목록 (SITE_LIST)
 * - 모드 매핑 (MODE_MAP)
 * 
 * @usage
 * import { 
 *     SIDEBAR_BUTTONS, 
 *     SUBMENUS, 
 *     SITE_LIST, 
 *     MODE_MAP 
 * } from './SidebarConfig.js';
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/SidebarConfig.js
 */

// ============================================
// Sidebar Button Configuration
// ============================================

/**
 * 사이드바 버튼 설정
 * 
 * @property {string} id - 버튼 DOM ID
 * @property {string} icon - IconRegistry 아이콘 키
 * @property {string} tooltip - 툴팁 텍스트
 * @property {string} mode - 연결된 앱 모드
 * @property {boolean} alwaysEnabled - 항상 활성화 여부
 * @property {boolean} selectable - 선택 가능 여부 (selected 클래스 적용)
 * @property {boolean} requiresConnection - 연결 필요 여부
 * @property {boolean} requiresDevMode - Dev Mode 필요 여부
 * @property {boolean} requiresDevModeOrConnection - Dev Mode 또는 연결 필요
 * @property {boolean} hasSubmenu - 서브메뉴 존재 여부
 * @property {string} submenuId - 서브메뉴 ID
 * @property {boolean} disabled - 비활성화 여부
 * @property {boolean} hidden - 숨김 여부
 */
export const SIDEBAR_BUTTONS = {
    connection: {
        id: 'btn-connection',
        icon: 'connection',
        tooltip: 'Database Connection (Ctrl+K)',
        mode: 'connection',
        alwaysEnabled: true,
        selectable: false
    },
    monitoring: {
        id: 'btn-monitoring',
        icon: 'monitoring',
        tooltip: 'Monitoring Mode (M)',
        mode: 'monitoring',
        requiresConnection: true,
        selectable: true,
        hasSubmenu: true,
        submenuId: 'monitoring-submenu'
    },
    // 🆕 v1.1.0: Analysis 버튼 활성화
    analysis: {
        id: 'btn-analysis',
        icon: 'analysis',
        tooltip: 'Analysis Mode (A)',
        mode: 'analysis',
        requiresConnection: true,
        selectable: true,
        hasSubmenu: true,
        submenuId: 'analysis-submenu'
        // disabled: true 제거!
    },
    simulation: {
        id: 'btn-simulation',
        icon: 'simulation',
        tooltip: 'Simulation (Coming Soon)',
        mode: 'simulation',
        requiresConnection: true,
        disabled: true
    },
    layout: {
        id: 'btn-layout',
        icon: 'layout',
        tooltip: 'Layout Tools',
        mode: 'layout',
        requiresConnection: true,
        requiresDevMode: true,
        hasSubmenu: true,
        submenuId: 'layout-submenu',
        hidden: true
    },
    debug: {
        id: 'btn-debug',
        icon: 'debug',
        tooltip: 'Debug Tools (D)',
        mode: 'debug',
        hasSubmenu: true,
        submenuId: 'debug-submenu',
        requiresDevModeOrConnection: true
    },
    settings: {
        id: 'btn-settings',
        icon: 'settings',
        tooltip: 'Settings',
        mode: 'settings',
        alwaysEnabled: true,
        selectable: false,
        hasSubmenu: true,
        submenuId: 'settings-submenu'
    }
};

// ============================================
// Submenu Configuration
// ============================================

/**
 * 서브메뉴 설정
 * 
 * @property {string} header - 서브메뉴 헤더 텍스트
 * @property {Array} items - 서브메뉴 아이템 배열
 * 
 * Item 속성:
 * @property {string} id - 아이템 DOM ID
 * @property {string} label - 표시 텍스트
 * @property {string} icon - IconRegistry 아이콘 키
 * @property {string} submode - 연결된 서브모드
 * @property {string} action - 실행할 액션 이름
 * @property {Array} params - 액션 파라미터
 * @property {string} type - 특수 타입 ('divider', 'theme-toggle', 'mock-tests')
 * @property {boolean} disabled - 비활성화 여부
 * @property {boolean} requiresDevMode - Dev Mode 필요 여부
 */
export const SUBMENUS = {
    'monitoring-submenu': {
        header: 'Monitoring Views',
        items: [
            { 
                id: 'sub-3d-view', 
                label: '3D View', 
                icon: '3d-view', 
                submode: '3d-view' 
            },
            // 🔧 v1.2.0: Ranking View 활성화! (Phase 5)
            { 
                id: 'sub-ranking-view', 
                label: 'Ranking View',   // "(Coming Soon)" 제거
                icon: 'ranking-view', 
                submode: 'ranking-view'
                // disabled: true 제거!
            }
        ]
    },
    // 🆕 v1.1.0: Analysis 서브메뉴 추가
    'analysis-submenu': {
        header: 'Analysis Tools',
        items: [
            { 
                id: 'sub-analysis-dashboard', 
                label: 'Dashboard', 
                icon: 'analysis', 
                submode: 'dashboard' 
            },
            { 
                id: 'sub-analysis-heatmap', 
                label: 'Calendar Heatmap (Coming Soon)', 
                icon: 'layout', 
                submode: 'heatmap',
                disabled: true
            },
            { 
                id: 'sub-analysis-trend', 
                label: 'Trend Analysis (Coming Soon)', 
                icon: 'ranking-view', 
                submode: 'trend',
                disabled: true
            }
        ]
    },
    'layout-submenu': {
        header: 'Layout Tools',
        items: [
            { 
                id: 'sub-layout-editor', 
                label: 'Layout Editor', 
                icon: 'layout-editor', 
                submode: 'layout-editor' 
            },
            { 
                id: 'sub-mapping', 
                label: 'Equipment Mapping', 
                icon: 'mapping', 
                submode: 'mapping', 
                action: 'openEquipmentEditModal' 
            }
        ]
    },
    'debug-submenu': {
        header: 'Debug Tools',
        items: [
            { 
                id: 'sub-app-state', 
                label: '📊 Application State', 
                action: 'setDebugView', 
                params: ['app-state'] 
            },
            { 
                id: 'sub-performance', 
                label: '⚡ Performance', 
                action: 'setDebugView', 
                params: ['performance'] 
            },
            { 
                id: 'sub-event-log', 
                label: '📝 Event Log', 
                action: 'setDebugView', 
                params: ['event-log'] 
            },
            { 
                id: 'sub-console', 
                label: '💻 Command Console', 
                action: 'setDebugView', 
                params: ['console'] 
            },
            { type: 'divider' },
            { 
                id: 'sub-full-debug', 
                label: '📋 Full Debug Panel', 
                action: 'toggleDebugPanel' 
            }
        ]
    },
    'settings-submenu': {
        header: 'Settings',
        items: [
            { id: 'theme-toggle', type: 'theme-toggle' },
            { type: 'divider' },
            { 
                id: 'dev-mode-toggle', 
                label: 'Dev Mode: OFF', 
                icon: 'code', 
                action: 'toggleDevMode' 
            },
            { 
                id: 'mock-test-section', 
                type: 'mock-tests', 
                requiresDevMode: true 
            }
        ]
    }
};

// ============================================
// Site List Configuration
// ============================================

/**
 * Connection Modal 사이트 목록 (v2.9 Full Version)
 * 
 * @property {string} id - 사이트 고유 ID
 * @property {string} flag - 국기 이모지
 * @property {string} name - 표시 이름
 * @property {string} region - 타임존/지역
 * @property {number} priority - 우선순위 (높을수록 상단)
 */
export const SITE_LIST = [
    { 
        id: 'kr_b_01', 
        flag: '🇰🇷', 
        name: 'Korea Site B-01', 
        region: 'Asia/Seoul', 
        priority: 10 
    },
    { 
        id: 'kr_b_02', 
        flag: '🇰🇷', 
        name: 'Korea Site B-02', 
        region: 'Asia/Seoul', 
        priority: 8 
    },
    { 
        id: 'vn_a_01', 
        flag: '🇻🇳', 
        name: 'Vietnam Site A-01', 
        region: 'Asia/Ho_Chi_Minh', 
        priority: 5 
    }
];

// ============================================
// Mode Mapping
// ============================================

/**
 * 내부 모드 키 → APP_MODE 상수 매핑
 * 
 * Sidebar 내부에서 사용하는 모드 키를
 * AppModeManager의 APP_MODE 상수로 변환
 * 
 * 🔧 v1.2.0: 'ranking-view' 추가 (Phase 5)
 */
export const MODE_MAP = {
    'monitoring': 'MONITORING',
    'analysis': 'ANALYTICS',
    'simulation': 'SIMULATION',
    'layout': 'LAYOUT_EDITOR',
    'equipment_edit': 'EQUIPMENT_EDIT',
    // 🆕 v1.2.0: Ranking View 매핑 추가
    'ranking-view': 'ranking_view',
    '3d-view': 'MONITORING'  // 3D View는 Monitoring 모드의 기본 서브모드
};

// ============================================
// 🆕 v1.2.0: Submode 매핑 (Phase 5)
// ============================================

/**
 * 서브모드 매핑
 * 메인 버튼의 서브메뉴 아이템 → 실제 모드 매핑
 */
export const SUBMODE_MAP = {
    // Monitoring 서브메뉴
    '3d-view': {
        parentMode: 'monitoring',
        handler: 'show3DView'
    },
    'ranking-view': {
        parentMode: 'monitoring',
        handler: 'showRankingView'
    },
    // Analysis 서브메뉴
    'dashboard': {
        parentMode: 'analysis',
        handler: 'showDashboard'
    },
    'heatmap': {
        parentMode: 'analysis',
        handler: 'showHeatmap'
    },
    'trend': {
        parentMode: 'analysis',
        handler: 'showTrend'
    }
};

// ============================================
// Helper Functions
// ============================================

/**
 * 버튼 키 목록 반환
 * @returns {string[]} 버튼 키 배열
 */
export function getButtonKeys() {
    return Object.keys(SIDEBAR_BUTTONS);
}

/**
 * 서브메뉴가 있는 버튼 목록 반환
 * @returns {string[]} 서브메뉴가 있는 버튼 키 배열
 */
export function getButtonsWithSubmenu() {
    return Object.entries(SIDEBAR_BUTTONS)
        .filter(([_, config]) => config.hasSubmenu)
        .map(([key]) => key);
}

/**
 * 특정 버튼 설정 반환
 * @param {string} key - 버튼 키
 * @returns {Object|null} 버튼 설정 또는 null
 */
export function getButtonConfig(key) {
    return SIDEBAR_BUTTONS[key] || null;
}

/**
 * 특정 서브메뉴 설정 반환
 * @param {string} submenuId - 서브메뉴 ID
 * @returns {Object|null} 서브메뉴 설정 또는 null
 */
export function getSubmenuConfig(submenuId) {
    return SUBMENUS[submenuId] || null;
}

/**
 * 사이트 ID로 사이트 정보 반환
 * @param {string} siteId - 사이트 ID
 * @returns {Object|null} 사이트 정보 또는 null
 */
export function getSiteById(siteId) {
    return SITE_LIST.find(site => site.id === siteId) || null;
}

/**
 * 우선순위 순으로 정렬된 사이트 목록 반환
 * @returns {Array} 정렬된 사이트 배열
 */
export function getSitesSortedByPriority() {
    return [...SITE_LIST].sort((a, b) => b.priority - a.priority);
}

/**
 * 🆕 v1.2.0: 서브모드 매핑 정보 반환
 * @param {string} submode - 서브모드 키
 * @returns {Object|null} 서브모드 매핑 정보 또는 null
 */
export function getSubmodeMapping(submode) {
    return SUBMODE_MAP[submode] || null;
}

/**
 * 🆕 v1.2.0: Ranking View 활성화 여부 확인
 * @returns {boolean}
 */
export function isRankingViewEnabled() {
    const monitoringSubmenu = SUBMENUS['monitoring-submenu'];
    if (!monitoringSubmenu) return false;
    
    const rankingItem = monitoringSubmenu.items.find(item => item.id === 'sub-ranking-view');
    return rankingItem && !rankingItem.disabled;
}

// ============================================
// Default Export
// ============================================

export default {
    SIDEBAR_BUTTONS,
    SUBMENUS,
    SITE_LIST,
    MODE_MAP,
    SUBMODE_MAP,  // 🆕 v1.2.0
    // Helper functions
    getButtonKeys,
    getButtonsWithSubmenu,
    getButtonConfig,
    getSubmenuConfig,
    getSiteById,
    getSitesSortedByPriority,
    getSubmodeMapping,     // 🆕 v1.2.0
    isRankingViewEnabled   // 🆕 v1.2.0
};