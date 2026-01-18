/**
 * NavigationRules.js
 * ==================
 * 애플리케이션 네비게이션 규칙 정의
 * 
 * @version 1.0.0
 * @description
 * - Mode/Submode별 레이어 표시 규칙 정의
 * - View 전환 시 필요한 서비스 명시
 * - 단일 진실 공급원 (Single Source of Truth)
 * 
 * @changelog
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
 * - getModeRules
 * - getSubmodeRules
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/navigation/NavigationRules.js
 * 작성일: 2026-01-18
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
// 레이어 설정
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
// 네비게이션 규칙 (핵심!)
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
// 유틸리티 함수
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

// 전역 디버그 함수 등록
if (typeof window !== 'undefined') {
    window.debugNavigationRules = debugNavigationRules;
}