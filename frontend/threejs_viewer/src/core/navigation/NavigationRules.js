/**
 * NavigationRules.js
 * ==================
 * 애플리케이션 네비게이션 규칙 정의
 * 
 * @version 1.1.1
 * @description
 * - Mode/Submode별 레이어 표시 규칙 정의
 * - View 전환 시 필요한 서비스 명시
 * - 단일 진실 공급원 (Single Source of Truth)
 * - 🆕 Panel/Modal 관리 규칙 추가
 * 
 * @changelog
 * - v1.1.1: 🔧 Equipment Edit Modal 허용 서브모드 확장 (2026-01-18)
 *           - allowedSubmodes에 'ranking-view' 추가
 *           - ranking-view에서도 Equipment Mapping Modal 열 수 있도록 수정
 * - v1.1.0: 🆕 Panel 관리 시스템 추가 (2026-01-18)
 *           - PANEL_TYPE 상수 추가 (Panel 식별자)
 *           - PANEL_RULES 규칙 추가 (Panel 동작 규칙)
 *           - isPanelAllowedInMode() 헬퍼 함수 추가
 *           - getPanelRules() 헬퍼 함수 추가
 *           - ⚠️ 호환성: 기존 모든 기능/로직 100% 유지
 * - v1.0.0: 🆕 초기 버전 (2026-01-18)
 *           - NAVIGATION_RULES 정의
 *           - LAYER_CONFIG 정의
 *           - Mode/Submode 매핑 규칙
 * 
 * @dependencies
 * - APP_MODE (constants.js)
 * 
 * @exports
 * - NAVIGATION_RULES
 * - LAYER_CONFIG
 * - NAV_MODE
 * - PANEL_TYPE (🆕 v1.1.0)
 * - PANEL_RULES (🆕 v1.1.0)
 * - getModeRules
 * - getSubmodeRules
 * - getPanelRules (🆕 v1.1.0)
 * - isPanelAllowedInMode (🆕 v1.1.0)
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/navigation/NavigationRules.js
 * 작성일: 2026-01-18
 * 수정일: 2026-01-18
 */

import { APP_MODE } from '../config/constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 네비게이션 모드 정의 (내부용)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 네비게이션 모드 상수
 * APP_MODE와 1:1 매핑되지만 네비게이션 컨텍스트에서 사용
 */
export const NAV_MODE = Object.freeze({
    MAIN_VIEWER: 'main_viewer',
    MONITORING: 'monitoring',
    ANALYSIS: 'analysis',
    LAYOUT: 'layout',
    SIMULATION: 'simulation',
    SETTINGS: 'settings'
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🆕 v1.1.0: Panel 타입 정의
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Panel 타입 정의
 * 
 * @description
 * 애플리케이션에서 사용되는 모든 Panel/Modal의 식별자
 * PanelManager에서 Panel 상태 관리에 사용
 * 
 * @example
 * import { PANEL_TYPE } from './NavigationRules.js';
 * panelManager.open(PANEL_TYPE.EQUIPMENT_EDIT);
 */
export const PANEL_TYPE = Object.freeze({
    /** Equipment Mapping Editor Modal - 장비 매핑 편집 */
    EQUIPMENT_EDIT: 'equipment-edit-modal',
    
    /** Equipment Info Panel - 장비 상세 정보 (오른쪽 사이드) */
    EQUIPMENT_INFO: 'equipment-info-panel',
    
    /** Debug Panel - 디버그 정보 표시 */
    DEBUG: 'debug-panel',
    
    /** Connection Modal - 연결 설정 */
    CONNECTION: 'connection-modal',
    
    /** Site Selection Panel - 사이트 선택 */
    SITE_SELECTION: 'site-selection-panel'
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🆕 v1.1.0: Panel 동작 규칙
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} PanelRule
 * @property {string[]} allowedModes - Panel이 열릴 수 있는 모드 목록 ('*' = 모든 모드)
 * @property {string[]} allowedSubmodes - Panel이 열릴 수 있는 서브모드 목록 ('*' = 모든 서브모드)
 * @property {boolean} autoCloseOnModeChange - 모드 전환 시 자동 닫힘 여부
 * @property {'modal'|'side-panel'|'floating'} uiType - UI 표시 타입
 * @property {'instance'|'dom'} closeMethod - 닫기 방법
 * @property {string} [instanceName] - closeMethod='instance' 시 window 객체의 인스턴스명
 * @property {string} [domSelector] - closeMethod='dom' 시 DOM 선택자
 * @property {string} [closeEvent] - Panel 닫힐 때 발행할 이벤트명
 */

/**
 * Panel 동작 규칙 정의
 * 
 * @description
 * 각 Panel/Modal이 어떤 모드에서 열릴 수 있는지,
 * 모드 전환 시 어떻게 처리되어야 하는지 정의
 * 
 * @type {Object.<string, PanelRule>}
 * 
 * @example
 * const rules = PANEL_RULES[PANEL_TYPE.EQUIPMENT_EDIT];
 * if (rules.autoCloseOnModeChange) {
 *     // 모드 전환 시 자동 닫기
 * }
 */
export const PANEL_RULES = Object.freeze({
    
    // ─────────────────────────────────────────────────────────────────────────
    // Equipment Mapping Editor Modal
    // ─────────────────────────────────────────────────────────────────────────
    [PANEL_TYPE.EQUIPMENT_EDIT]: {
        /**
         * 허용 모드
         * - MONITORING: 3D View에서 장비 클릭 시 매핑 편집
         * - LAYOUT: Layout Editor에서 매핑 설정
         */
        allowedModes: [NAV_MODE.MONITORING, NAV_MODE.LAYOUT],
        
        /**
         * 🔧 v1.1.1: 허용 서브모드 확장
         * - 3d-view: 3D 모니터링 뷰에서
         * - mapping: 매핑 전용 서브모드에서
         * - ranking-view: 🆕 랭킹 뷰에서도 Equipment Mapping Modal 허용
         */
        allowedSubmodes: ['3d-view', 'mapping', 'ranking-view'],
        
        /** 모드 전환 시 자동 닫힘 (⭐ 핵심!) */
        autoCloseOnModeChange: true,
        
        /** UI 타입: 중앙 Modal */
        uiType: 'modal',
        
        /** 닫기 방법: window 객체의 인스턴스 close() 호출 */
        closeMethod: 'instance',
        instanceName: 'equipmentEditModal',
        
        /** 닫힐 때 발행 이벤트 */
        closeEvent: 'panel:equipment-edit:closed'
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // Equipment Info Panel (오른쪽 사이드)
    // ─────────────────────────────────────────────────────────────────────────
    [PANEL_TYPE.EQUIPMENT_INFO]: {
        /**
         * 허용 모드
         * - MONITORING만: 장비 상세 정보는 모니터링에서만 표시
         */
        allowedModes: [NAV_MODE.MONITORING],
        
        /**
         * 허용 서브모드
         * - 3d-view: 3D 뷰에서 장비 클릭 시
         * - ranking-view: 랭킹 뷰에서 장비 선택 시
         */
        allowedSubmodes: ['3d-view', 'ranking-view'],
        
        /** 모드 전환 시 자동 닫힘 */
        autoCloseOnModeChange: true,
        
        /** UI 타입: 오른쪽 사이드 Panel */
        uiType: 'side-panel',
        
        /** 닫기 방법: DOM classList 조작 */
        closeMethod: 'dom',
        domSelector: '#equipment-info-panel',
        
        closeEvent: 'panel:equipment-info:closed'
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // Debug Panel
    // ─────────────────────────────────────────────────────────────────────────
    [PANEL_TYPE.DEBUG]: {
        /**
         * 허용 모드: 모든 모드에서 사용 가능
         * '*' = 와일드카드 (모든 모드 허용)
         */
        allowedModes: ['*'],
        allowedSubmodes: ['*'],
        
        /** 모드 전환해도 유지됨 (닫지 않음) */
        autoCloseOnModeChange: false,
        
        /** UI 타입: 자유 위치 Floating Panel */
        uiType: 'floating',
        
        closeMethod: 'dom',
        domSelector: '#debug-panel',
        
        closeEvent: 'panel:debug:closed'
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // Connection Modal
    // ─────────────────────────────────────────────────────────────────────────
    [PANEL_TYPE.CONNECTION]: {
        /** 모든 모드에서 연결 설정 가능 */
        allowedModes: ['*'],
        allowedSubmodes: ['*'],
        
        /** 모드 전환해도 유지 (사용자가 명시적으로 닫아야 함) */
        autoCloseOnModeChange: false,
        
        uiType: 'modal',
        
        closeMethod: 'instance',
        instanceName: 'connectionModal',
        
        closeEvent: 'panel:connection:closed'
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // Site Selection Panel
    // ─────────────────────────────────────────────────────────────────────────
    [PANEL_TYPE.SITE_SELECTION]: {
        allowedModes: ['*'],
        allowedSubmodes: ['*'],
        
        autoCloseOnModeChange: false,
        
        uiType: 'side-panel',
        
        closeMethod: 'dom',
        domSelector: '#site-selection-panel',
        
        closeEvent: 'panel:site-selection:closed'
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 레이어 설정 (기존 유지)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DOM 레이어 설정
 * z-index 및 표시 방식 정의
 */
export const LAYER_CONFIG = Object.freeze({
    'cover-screen': {
        zIndex: 1,
        showMethod: 'classList',      // classList.remove('hidden')
        hideMethod: 'classList',      // classList.add('hidden')
        showClass: null,
        hideClass: 'hidden'
    },
    'threejs-container': {
        zIndex: 10,
        showMethod: 'classList',      // classList.add('active')
        hideMethod: 'classList',      // classList.remove('active')
        showClass: 'active',
        hideClass: null,
        additionalShow: (el) => { el.style.display = ''; },
        additionalHide: (el) => { el.style.display = 'none'; }
    },
    'overlay-ui': {
        zIndex: 20,
        showMethod: 'style',          // style.display = 'flex'
        hideMethod: 'style',          // style.display = 'none'
        showValue: 'flex',
        hideValue: 'none'
    },
    'view-container': {
        zIndex: 100,
        showMethod: 'classList',
        hideMethod: 'classList',
        showClass: null,
        hideClass: 'hidden'
    },
    'analysis-container': {
        zIndex: 100,
        showMethod: 'classList',
        hideMethod: 'classList',
        showClass: null,
        hideClass: 'hidden'
    },
    'camera-navigator': {
        zIndex: 50,
        showMethod: 'style',
        hideMethod: 'style',
        showValue: 'block',
        hideValue: 'none'
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 네비게이션 규칙 (핵심!) - 기존 유지
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} LayerVisibility
 * @property {boolean} 'cover-screen' - Cover Screen 표시 여부
 * @property {boolean} 'threejs-container' - Three.js 컨테이너 표시 여부
 * @property {boolean} 'overlay-ui' - Overlay UI 표시 여부
 * @property {boolean} 'view-container' - View 컨테이너 표시 여부
 * @property {boolean} 'camera-navigator' - Camera Navigator 표시 여부
 */

/**
 * @typedef {Object} SubmodeRule
 * @property {LayerVisibility} layers - 레이어 표시 규칙
 * @property {string|null} viewManager - ViewManager가 관리하는 View ID
 * @property {string[]} services - 활성화할 서비스 목록
 * @property {Object} options - 추가 옵션
 */

/**
 * @typedef {Object} ModeRule
 * @property {string|null} defaultSubmode - 기본 서브모드
 * @property {LayerVisibility} layers - 모드 레벨 레이어 규칙
 * @property {string} appMode - APP_MODE 매핑 값
 * @property {boolean} requiresConnection - Backend 연결 필요 여부
 * @property {Object.<string, SubmodeRule>} submodes - 서브모드 규칙들
 */

/**
 * 네비게이션 규칙 정의
 * 
 * 모든 화면 전환은 이 규칙을 기반으로 수행됨
 * 
 * @type {Object.<string, ModeRule>}
 */
export const NAVIGATION_RULES = Object.freeze({
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN_VIEWER 모드 (기본 상태)
    // ═══════════════════════════════════════════════════════════════════════════
    [NAV_MODE.MAIN_VIEWER]: {
        defaultSubmode: null,
        appMode: APP_MODE.MAIN_VIEWER,
        requiresConnection: false,
        
        layers: {
            'cover-screen': true,
            'threejs-container': false,
            'overlay-ui': false,
            'view-container': false,
            'analysis-container': false,
            'camera-navigator': false
        },
        
        submodes: {},
        
        // 모드 진입/종료 훅
        hooks: {
            onEnter: 'navigation:main-viewer:enter',
            onExit: 'navigation:main-viewer:exit'
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MONITORING 모드
    // ═══════════════════════════════════════════════════════════════════════════
    [NAV_MODE.MONITORING]: {
        defaultSubmode: '3d-view',
        appMode: APP_MODE.MONITORING,
        requiresConnection: true,
        
        // 모드 기본 레이어 (서브모드로 오버라이드됨)
        layers: {
            'cover-screen': false,
            'threejs-container': false,
            'overlay-ui': false,
            'view-container': false,
            'analysis-container': false,
            'camera-navigator': false
        },
        
        submodes: {
            // ─────────────────────────────────────────────────────────────────
            // 3D View (실시간 3D 모니터링)
            // ─────────────────────────────────────────────────────────────────
            '3d-view': {
                layers: {
                    'cover-screen': false,
                    'threejs-container': true,
                    'overlay-ui': true,
                    'view-container': false,
                    'analysis-container': false,
                    'camera-navigator': true
                },
                viewManager: null,  // ViewManager가 관리하지 않음 (직접 DOM 조작)
                services: ['MonitoringService'],
                options: {
                    initThreeJS: true,
                    startAnimation: true
                }
            },
            
            // ─────────────────────────────────────────────────────────────────
            // Ranking View (상태별 장비 순위)
            // ─────────────────────────────────────────────────────────────────
            'ranking-view': {
                layers: {
                    'cover-screen': false,
                    'threejs-container': false,
                    'overlay-ui': false,
                    'view-container': true,
                    'analysis-container': false,
                    'camera-navigator': false
                },
                viewManager: 'ranking-view',  // ViewManager가 관리
                services: ['MonitoringService'],
                options: {
                    stopAnimation: true  // 3D 애니메이션 중지 (성능)
                }
            }
        },
        
        hooks: {
            onEnter: 'navigation:monitoring:enter',
            onExit: 'navigation:monitoring:exit'
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYSIS 모드
    // ═══════════════════════════════════════════════════════════════════════════
    [NAV_MODE.ANALYSIS]: {
        defaultSubmode: 'dashboard',
        appMode: APP_MODE.ANALYTICS,
        requiresConnection: true,
        
        layers: {
            'cover-screen': false,
            'threejs-container': false,
            'overlay-ui': false,
            'view-container': false,
            'analysis-container': true,
            'camera-navigator': false
        },
        
        submodes: {
            // ─────────────────────────────────────────────────────────────────
            // Dashboard (종합 대시보드)
            // ─────────────────────────────────────────────────────────────────
            'dashboard': {
                layers: {
                    'analysis-container': true,
                    'view-container': false
                },
                viewManager: 'dashboard-view',
                services: ['AnalyticsService'],
                options: {}
            },
            
            // ─────────────────────────────────────────────────────────────────
            // Heatmap (Calendar Heatmap)
            // ─────────────────────────────────────────────────────────────────
            'heatmap': {
                layers: {
                    'analysis-container': true,
                    'view-container': false
                },
                viewManager: 'heatmap-view',
                services: ['AnalyticsService'],
                options: {}
            },
            
            // ─────────────────────────────────────────────────────────────────
            // Trend (추세 분석)
            // ─────────────────────────────────────────────────────────────────
            'trend': {
                layers: {
                    'analysis-container': true,
                    'view-container': false
                },
                viewManager: 'trend-view',
                services: ['AnalyticsService'],
                options: {}
            }
        },
        
        hooks: {
            onEnter: 'navigation:analysis:enter',
            onExit: 'navigation:analysis:exit'
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // LAYOUT 모드
    // ═══════════════════════════════════════════════════════════════════════════
    [NAV_MODE.LAYOUT]: {
        defaultSubmode: 'layout-editor',
        appMode: APP_MODE.LAYOUT_EDIT_2D,
        requiresConnection: false,
        
        layers: {
            'cover-screen': false,
            'threejs-container': false,
            'overlay-ui': false,
            'view-container': true,
            'analysis-container': false,
            'camera-navigator': false
        },
        
        submodes: {
            // ─────────────────────────────────────────────────────────────────
            // Layout Editor (2D 레이아웃 편집)
            // ─────────────────────────────────────────────────────────────────
            'layout-editor': {
                layers: {
                    'view-container': true
                },
                viewManager: null,  // LayoutEditorApp이 별도 관리
                services: [],
                options: {
                    initLayoutEditor: true
                }
            },
            
            // ─────────────────────────────────────────────────────────────────
            // Mapping (장비 매핑 설정)
            // ─────────────────────────────────────────────────────────────────
            'mapping': {
                layers: {
                    'view-container': true
                },
                viewManager: null,
                services: ['MappingService'],
                options: {}
            }
        },
        
        hooks: {
            onEnter: 'navigation:layout:enter',
            onExit: 'navigation:layout:exit'
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SIMULATION 모드 (향후 구현)
    // ═══════════════════════════════════════════════════════════════════════════
    [NAV_MODE.SIMULATION]: {
        defaultSubmode: 'simulation',
        appMode: APP_MODE.SIMULATION,
        requiresConnection: false,
        
        layers: {
            'cover-screen': false,
            'threejs-container': true,
            'overlay-ui': true,
            'view-container': false,
            'analysis-container': false,
            'camera-navigator': true
        },
        
        submodes: {
            'simulation': {
                layers: {
                    'threejs-container': true,
                    'overlay-ui': true,
                    'camera-navigator': true
                },
                viewManager: null,
                services: ['SimulationService'],
                options: {
                    initThreeJS: true
                }
            }
        },
        
        hooks: {
            onEnter: 'navigation:simulation:enter',
            onExit: 'navigation:simulation:exit'
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SETTINGS 모드
    // ═══════════════════════════════════════════════════════════════════════════
    [NAV_MODE.SETTINGS]: {
        defaultSubmode: null,
        appMode: APP_MODE.SETTINGS,
        requiresConnection: false,
        
        layers: {
            'cover-screen': true,
            'threejs-container': false,
            'overlay-ui': false,
            'view-container': false,
            'analysis-container': false,
            'camera-navigator': false
        },
        
        submodes: {},
        
        hooks: {
            onEnter: 'navigation:settings:enter',
            onExit: 'navigation:settings:exit'
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 유틸리티 함수 (기존 유지)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 모드 규칙 가져오기
 * 
 * @param {string} mode - 모드 이름
 * @returns {ModeRule|null} 모드 규칙 또는 null
 */
export function getModeRules(mode) {
    return NAVIGATION_RULES[mode] || null;
}

/**
 * 서브모드 규칙 가져오기
 * 
 * @param {string} mode - 모드 이름
 * @param {string} submode - 서브모드 이름
 * @returns {SubmodeRule|null} 서브모드 규칙 또는 null
 */
export function getSubmodeRules(mode, submode) {
    const modeRules = NAVIGATION_RULES[mode];
    if (!modeRules || !submode) return null;
    
    return modeRules.submodes?.[submode] || null;
}

/**
 * 최종 레이어 설정 계산
 * 모드 레이어 + 서브모드 레이어 병합
 * 
 * @param {string} mode - 모드 이름
 * @param {string|null} submode - 서브모드 이름
 * @returns {LayerVisibility} 병합된 레이어 설정
 */
export function computeFinalLayers(mode, submode) {
    const modeRules = NAVIGATION_RULES[mode];
    if (!modeRules) {
        console.error(`[NavigationRules] Unknown mode: ${mode}`);
        return {};
    }
    
    // 모드 기본 레이어
    const modeLayers = { ...modeRules.layers };
    
    // 서브모드 레이어 오버라이드
    if (submode && modeRules.submodes?.[submode]) {
        const submodeLayers = modeRules.submodes[submode].layers || {};
        Object.assign(modeLayers, submodeLayers);
    }
    
    return modeLayers;
}

/**
 * APP_MODE에서 NAV_MODE로 변환
 * 
 * @param {string} appMode - APP_MODE 값
 * @returns {string|null} NAV_MODE 값 또는 null
 */
export function appModeToNavMode(appMode) {
    const mapping = {
        [APP_MODE.MAIN_VIEWER]: NAV_MODE.MAIN_VIEWER,
        [APP_MODE.MONITORING]: NAV_MODE.MONITORING,
        [APP_MODE.ANALYTICS]: NAV_MODE.ANALYSIS,
        [APP_MODE.LAYOUT_EDIT_2D]: NAV_MODE.LAYOUT,
        [APP_MODE.LAYOUT_EDIT_3D]: NAV_MODE.LAYOUT,
        [APP_MODE.SIMULATION]: NAV_MODE.SIMULATION,
        [APP_MODE.SETTINGS]: NAV_MODE.SETTINGS
    };
    
    return mapping[appMode] || null;
}

/**
 * NAV_MODE에서 APP_MODE로 변환
 * 
 * @param {string} navMode - NAV_MODE 값
 * @returns {string|null} APP_MODE 값 또는 null
 */
export function navModeToAppMode(navMode) {
    const rules = NAVIGATION_RULES[navMode];
    return rules?.appMode || null;
}

/**
 * 모드에 서브모드가 있는지 확인
 * 
 * @param {string} mode - 모드 이름
 * @returns {boolean}
 */
export function hasSubmodes(mode) {
    const rules = NAVIGATION_RULES[mode];
    return rules && Object.keys(rules.submodes || {}).length > 0;
}

/**
 * 모드의 모든 서브모드 목록 가져오기
 * 
 * @param {string} mode - 모드 이름
 * @returns {string[]} 서브모드 ID 배열
 */
export function getSubmodeList(mode) {
    const rules = NAVIGATION_RULES[mode];
    return rules ? Object.keys(rules.submodes || {}) : [];
}

/**
 * 서브모드의 부모 모드 찾기
 * 
 * @param {string} submode - 서브모드 이름
 * @returns {string|null} 부모 모드 이름 또는 null
 */
export function findParentMode(submode) {
    for (const [mode, rules] of Object.entries(NAVIGATION_RULES)) {
        if (rules.submodes && submode in rules.submodes) {
            return mode;
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🆕 v1.1.0: Panel 관련 유틸리티 함수
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Panel 규칙 가져오기
 * 
 * @param {string} panelType - PANEL_TYPE 값
 * @returns {PanelRule|null} Panel 규칙 또는 null
 * 
 * @example
 * const rules = getPanelRules(PANEL_TYPE.EQUIPMENT_EDIT);
 * console.log(rules.allowedModes); // ['monitoring', 'layout']
 */
export function getPanelRules(panelType) {
    return PANEL_RULES[panelType] || null;
}

/**
 * Panel이 특정 모드에서 허용되는지 확인
 * 
 * @param {string} panelType - PANEL_TYPE 값
 * @param {string} mode - NAV_MODE 값
 * @param {string|null} submode - 서브모드 (선택)
 * @returns {boolean} 허용 여부
 * 
 * @example
 * // Equipment Edit Modal이 Monitoring/3d-view에서 허용되는지?
 * isPanelAllowedInMode(PANEL_TYPE.EQUIPMENT_EDIT, NAV_MODE.MONITORING, '3d-view');
 * // → true
 * 
 * // Equipment Edit Modal이 Analysis에서 허용되는지?
 * isPanelAllowedInMode(PANEL_TYPE.EQUIPMENT_EDIT, NAV_MODE.ANALYSIS);
 * // → false
 */
export function isPanelAllowedInMode(panelType, mode, submode = null) {
    const rules = PANEL_RULES[panelType];
    if (!rules) {
        console.warn(`[NavigationRules] Unknown panel type: ${panelType}`);
        return false;
    }
    
    // 모드 확인
    const modeAllowed = rules.allowedModes.includes('*') || 
                       rules.allowedModes.includes(mode);
    if (!modeAllowed) return false;
    
    // 서브모드 확인 (서브모드가 없거나 '*'이면 통과)
    if (!submode) return true;
    
    const submodeAllowed = rules.allowedSubmodes.includes('*') || 
                           rules.allowedSubmodes.includes(submode);
    
    return submodeAllowed;
}

/**
 * 특정 모드에서 자동으로 닫아야 할 Panel 목록 가져오기
 * 
 * @param {string} newMode - 전환할 모드
 * @param {string|null} newSubmode - 전환할 서브모드
 * @param {string[]} openPanels - 현재 열린 Panel 목록 (PANEL_TYPE 값 배열)
 * @returns {string[]} 닫아야 할 Panel 목록
 * 
 * @example
 * const toClose = getPanelsToCloseOnModeChange(
 *     NAV_MODE.ANALYSIS,
 *     'dashboard',
 *     [PANEL_TYPE.EQUIPMENT_EDIT, PANEL_TYPE.EQUIPMENT_INFO]
 * );
 * // → [PANEL_TYPE.EQUIPMENT_EDIT, PANEL_TYPE.EQUIPMENT_INFO]
 * // (둘 다 Analysis에서 허용 안 됨)
 */
export function getPanelsToCloseOnModeChange(newMode, newSubmode, openPanels) {
    const toClose = [];
    
    for (const panelType of openPanels) {
        const rules = PANEL_RULES[panelType];
        if (!rules) continue;
        
        // autoCloseOnModeChange가 false면 스킵
        if (!rules.autoCloseOnModeChange) continue;
        
        // 새 모드에서 허용되지 않으면 닫기 목록에 추가
        if (!isPanelAllowedInMode(panelType, newMode, newSubmode)) {
            toClose.push(panelType);
        }
    }
    
    return toClose;
}

/**
 * 모든 Panel 타입 목록 가져오기
 * 
 * @returns {string[]} PANEL_TYPE 값 배열
 */
export function getAllPanelTypes() {
    return Object.values(PANEL_TYPE);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 디버그 유틸리티
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 네비게이션 규칙 디버그 출력
 */
export function debugNavigationRules() {
    console.group('📋 NavigationRules Debug');
    
    for (const [mode, rules] of Object.entries(NAVIGATION_RULES)) {
        console.group(`Mode: ${mode}`);
        console.log('Default Submode:', rules.defaultSubmode);
        console.log('APP_MODE:', rules.appMode);
        console.log('Requires Connection:', rules.requiresConnection);
        console.log('Layers:', rules.layers);
        
        if (Object.keys(rules.submodes || {}).length > 0) {
            console.group('Submodes:');
            for (const [submode, submodeRules] of Object.entries(rules.submodes)) {
                console.log(`  ${submode}:`, submodeRules);
            }
            console.groupEnd();
        }
        
        console.groupEnd();
    }
    
    console.groupEnd();
}

/**
 * 🆕 v1.1.0: Panel 규칙 디버그 출력
 */
export function debugPanelRules() {
    console.group('📋 PanelRules Debug');
    
    for (const [panelType, rules] of Object.entries(PANEL_RULES)) {
        console.group(`Panel: ${panelType}`);
        console.log('Allowed Modes:', rules.allowedModes);
        console.log('Allowed Submodes:', rules.allowedSubmodes);
        console.log('Auto Close on Mode Change:', rules.autoCloseOnModeChange);
        console.log('UI Type:', rules.uiType);
        console.log('Close Method:', rules.closeMethod);
        if (rules.instanceName) console.log('Instance Name:', rules.instanceName);
        if (rules.domSelector) console.log('DOM Selector:', rules.domSelector);
        console.groupEnd();
    }
    
    console.groupEnd();
}

// 전역 디버그 함수 등록
if (typeof window !== 'undefined') {
    // 기존 디버그 함수
    window.debugNavigationRules = debugNavigationRules;
    window.debugPanelRules = debugPanelRules;
    
    // 🆕 Panel 헬퍼 함수 (Console 테스트용)
    window.isPanelAllowedInMode = isPanelAllowedInMode;
    window.getPanelRules = getPanelRules;
    window.getPanelsToCloseOnModeChange = getPanelsToCloseOnModeChange;
    window.getAllPanelTypes = getAllPanelTypes;
    
    // 🆕 Panel 상수 (Console 참조용)
    window.PANEL_TYPE = PANEL_TYPE;
    window.PANEL_RULES = PANEL_RULES;
}
