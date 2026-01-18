/**
 * AppNamespace.js
 * ===============
 * 
 * 애플리케이션 전역 네임스페이스 정의
 * 
 * 모든 모듈은 이 네임스페이스를 통해 등록/조회
 * 이름 충돌 방지 및 의존성 관리 중앙화
 * 
 * @version 1.1.0
 * @module AppNamespace
 * 
 * @description
 * - 전역 네임스페이스 오염 방지
 * - 모듈 간 이름 충돌 해결 (viewManager 충돌 등)
 * - 계층적 서비스 관리
 * - 의존성 파악 용이
 * 
 * @changelog
 * - v1.1.0: Phase 2 전역 함수 마이그레이션 (2026-01-18)
 *   - fn 네임스페이스 추가 (ui, mode, camera, mapping, layout)
 *   - debugFn 네임스페이스 추가
 *   - registerFn(), registerDebugFn() 헬퍼 함수 추가
 *   - debug() 출력에 fn, debugFn 포함
 * - v1.0.0: 초기 구현 (2026-01-18)
 * 
 * @dependencies
 * - 없음 (최상위 모듈)
 * 
 * @exports
 * - APP_NAMESPACE
 * - initNamespace
 * - register
 * - get
 * - has
 * - unregister
 * - debug
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/AppNamespace.js
 * 작성일: 2026-01-18
 * 수정일: 2026-01-18
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. 네임스페이스 구조 정의
// ═══════════════════════════════════════════════════════════════════════════

const APP_NAMESPACE = {
    // ═══════════════════════════════════════════════════════════════════════
    // 메타 정보
    // ═══════════════════════════════════════════════════════════════════════
    _meta: {
        name: 'SherlockSky3DSim',
        version: '6.1.0',  // ← Phase 2
        initialized: false,
        initTimestamp: null
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 서비스 계층 (비즈니스 로직)
    // ═══════════════════════════════════════════════════════════════════════
    services: {
        // Scene 관련
        scene: {
            sceneManager: null,
            equipmentLoader: null,
            cameraControls: null,
            cameraNavigator: null,
            interactionHandler: null,
            dataOverlay: null,
            statusVisualizer: null,
            performanceMonitor: null,
            adaptivePerformance: null
        },
        
        // Monitoring 관련
        monitoring: {
            monitoringService: null,
            signalTowerManager: null,
            webSocketClient: null
        },
        
        // Mapping 관련
        mapping: {
            equipmentMappingService: null
        },
        
        // Connection 관련
        connection: {
            connectionStatusService: null,
            apiClient: null
        },
        
        // Storage
        storage: {
            storageService: null
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 매니저 계층 (상태 관리 및 조율)
    // ═══════════════════════════════════════════════════════════════════════
    managers: {
        /**
         * 🆕 명확한 이름 분리
         * 
         * view: ViewBootstrap.js의 ViewManager (View 생명주기 관리)
         *       - getView(), showView(), hideView() 등
         *       - RankingView, DashboardView 등 관리
         * 
         * screen: Cover/3D 화면 전환 (기존 main.js의 viewManager)
         *         - showCoverScreen(), show3DView()
         *         - Three.js 초기화 관리
         */
        view: null,      // ViewBootstrap.js의 ViewManager
        screen: null,    // Cover/3D 화면 전환 (기존 main.js의 viewManager → screenManager)
        mode: null,      // AppModeManager
        keyboard: null,  // KeyboardManager
        debug: null,     // DebugManager
        cleanup: null    // CleanupManager
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // UI 계층 (프레젠테이션)
    // ═══════════════════════════════════════════════════════════════════════
    ui: {
        sidebar: null,
        statusBar: null,
        coverScreen: null,
        toast: null,
        connectionModal: null,
        equipmentInfoPanel: null,
        equipmentEditModal: null,
        equipmentEditButton: null,
        equipmentEditState: null,
        modeIndicatorPanel: null
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // View 계층 (ViewManager가 관리하는 View들)
    // ═══════════════════════════════════════════════════════════════════════
    views: {
        // VIEW_REGISTRY에 등록된 View 인스턴스들
        // ViewManager.get()으로 접근 권장
        ranking: null,
        dashboard: null,
        heatmap: null,
        trend: null,
        simulation: null
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 유틸리티 계층
    // ═══════════════════════════════════════════════════════════════════════
    utils: {
        eventBus: null,
        logger: null,
        config: null,
        memoryManager: null
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 레지스트리 (설정 데이터)
    // ═══════════════════════════════════════════════════════════════════════
    registry: {
        VIEW_REGISTRY: null,
        APP_MODE: null,
        EVENT_NAME: null,
        SIDEBAR_BUTTONS: null,
        SITE_LIST: null
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 상태
    // ═══════════════════════════════════════════════════════════════════════
    state: {
        currentMode: null,
        currentSubMode: null,
        isConnected: false,
        devModeEnabled: false,
        siteId: null,
        theme: 'dark'
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🆕 v1.1.0: 전역 함수 계층 (Phase 2)
    // ═══════════════════════════════════════════════════════════════════════
    fn: {
        ui: {},      // showToast, toggleTheme, toggleConnectionModal 등
        mode: {},    // toggleEditMode, toggleMonitoringMode 등
        camera: {},  // moveTo, focusEquipment, reset
        mapping: {}, // getStatus, clearAll, export
        layout: {}   // applyTest, testRoomResize
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🆕 v1.1.0: 디버그 함수 계층 (Phase 2)
    // ═══════════════════════════════════════════════════════════════════════
    debugFn: {
        help: null,
        scene: null,
        listEquipments: null,
        status: null
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. 서비스 등록/조회 API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 서비스 등록
 * 
 * @param {string} path - 점(.) 구분 경로 (예: 'services.scene.sceneManager')
 * @param {*} instance - 등록할 인스턴스
 * @param {Object} options - 옵션
 * @param {boolean} options.override - 기존 값 덮어쓰기 허용 (기본: false)
 * @param {string} options.alias - window에 노출할 별칭 (하위 호환용)
 * @returns {boolean} 성공 여부
 * 
 * @example
 * // 기본 등록
 * register('managers.screen', screenManager);
 * 
 * // 별칭과 함께 등록 (하위 호환)
 * register('managers.view', viewManager, { alias: 'viewManager' });
 * 
 * // 덮어쓰기 허용
 * register('services.scene.sceneManager', newSceneManager, { override: true });
 */
function register(path, instance, options = {}) {
    const { override = false, alias = null } = options;
    
    const parts = path.split('.');
    let current = APP_NAMESPACE;
    
    // 경로 탐색 (마지막 키 제외)
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    
    const key = parts[parts.length - 1];
    
    // 이미 존재하는지 확인
    if (current[key] && !override) {
        console.warn(`[APP] ⚠️ 이미 등록됨: ${path} (override: false)`);
        return false;
    }
    
    // 등록
    current[key] = instance;
    console.log(`[APP] ✅ 등록: ${path}`);
    
    // 별칭 등록 (하위 호환용)
    if (alias && typeof window !== 'undefined') {
        window[alias] = instance;
        console.log(`[APP]    ↳ 별칭: window.${alias}`);
    }
    
    return true;
}

/**
 * 서비스 조회
 * 
 * @param {string} path - 점(.) 구분 경로
 * @returns {*} 인스턴스 또는 undefined
 * 
 * @example
 * const sceneManager = get('services.scene.sceneManager');
 * const viewManager = get('managers.view');
 */
function get(path) {
    const parts = path.split('.');
    let current = APP_NAMESPACE;
    
    for (const part of parts) {
        if (current === undefined || current === null) {
            return undefined;
        }
        current = current[part];
    }
    
    return current;
}

/**
 * 서비스 존재 여부 확인
 * 
 * @param {string} path - 점(.) 구분 경로
 * @returns {boolean}
 * 
 * @example
 * if (has('managers.view')) {
 *     console.log('ViewManager 초기화됨');
 * }
 */
function has(path) {
    const value = get(path);
    return value !== undefined && value !== null;
}

/**
 * 서비스 제거
 * 
 * @param {string} path - 점(.) 구분 경로
 * @returns {boolean} 성공 여부
 */
function unregister(path) {
    const parts = path.split('.');
    let current = APP_NAMESPACE;
    
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            return false;
        }
        current = current[parts[i]];
    }
    
    const key = parts[parts.length - 1];
    if (current[key]) {
        current[key] = null;
        console.log(`[APP] 🗑️ 제거: ${path}`);
        return true;
    }
    
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 v1.1.0: 함수 등록 헬퍼 (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 전역 함수 등록 (APP.fn에 등록 + window에 하위 호환 별칭)
 * 
 * @param {string} category - 카테고리 (ui, mode, camera, mapping, layout)
 * @param {string} name - 함수 이름
 * @param {Function} fn - 함수
 * @param {string} [windowAlias] - window에 노출할 별칭 (하위 호환)
 * @returns {boolean} 성공 여부
 * 
 * @example
 * registerFn('ui', 'showToast', _showToast, 'showToast');
 * // APP.fn.ui.showToast = _showToast
 * // window.showToast = _showToast (하위 호환)
 */
function registerFn(category, name, fn, windowAlias = null) {
    if (!APP_NAMESPACE.fn[category]) {
        APP_NAMESPACE.fn[category] = {};
    }
    
    APP_NAMESPACE.fn[category][name] = fn;
    console.log(`[APP] ✅ 함수 등록: fn.${category}.${name}`);
    
    // 하위 호환용 window 별칭
    if (windowAlias && typeof window !== 'undefined') {
        window[windowAlias] = fn;
        console.log(`[APP]    ↳ 별칭: window.${windowAlias}`);
    }
    
    return true;
}

/**
 * 디버그 함수 등록
 * 
 * @param {string} name - 함수 이름
 * @param {Function} fn - 함수
 * @param {string} [windowAlias] - window에 노출할 별칭
 * @returns {boolean} 성공 여부
 */
function registerDebugFn(name, fn, windowAlias = null) {
    APP_NAMESPACE.debugFn[name] = fn;
    console.log(`[APP] ✅ 디버그 함수 등록: debugFn.${name}`);
    
    if (windowAlias && typeof window !== 'undefined') {
        window[windowAlias] = fn;
        console.log(`[APP]    ↳ 별칭: window.${windowAlias}`);
    }
    
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. 초기화 함수
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 네임스페이스 초기화
 * main.js에서 가장 먼저 호출
 * 
 * @returns {Object} APP_NAMESPACE
 * 
 * @example
 * // main.js 최상단
 * import { initNamespace, register } from './core/AppNamespace.js';
 * 
 * function init() {
 *     // 1. 네임스페이스 먼저 초기화
 *     initNamespace();
 *     
 *     // 2. 서비스 등록
 *     register('managers.mode', appModeManager);
 *     // ...
 * }
 */
function initNamespace() {
    if (APP_NAMESPACE._meta.initialized) {
        console.warn('[APP] ⚠️ 이미 초기화됨');
        return APP_NAMESPACE;
    }
    
    APP_NAMESPACE._meta.initialized = true;
    APP_NAMESPACE._meta.initTimestamp = Date.now();
    
    // 전역 노출
    if (typeof window !== 'undefined') {
        window.APP = APP_NAMESPACE;
        
        // API 함수 노출
        window.APP.register = register;
        window.APP.get = get;
        window.APP.has = has;
        window.APP.unregister = unregister;
        window.APP.debug = debug;
        // 🆕 v1.1.0: Phase 2 함수
        window.APP.registerFn = registerFn;
        window.APP.registerDebugFn = registerDebugFn;
    }
    
    console.log(`[APP] 🚀 네임스페이스 초기화 완료 (v${APP_NAMESPACE._meta.version})`);
    
    return APP_NAMESPACE;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. 디버그 유틸리티
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 등록된 모든 서비스 출력
 * 
 * @example
 * // 브라우저 콘솔에서
 * APP.debug();
 */
function debug() {
    console.group(`🔧 APP Namespace Debug (v${APP_NAMESPACE._meta.version})`);
    
    console.log('📊 Meta Info:');
    console.log(`   Initialized: ${APP_NAMESPACE._meta.initialized}`);
    console.log(`   Init Time: ${APP_NAMESPACE._meta.initTimestamp ? new Date(APP_NAMESPACE._meta.initTimestamp).toISOString() : 'N/A'}`);
    
    console.log('\n--- Services ---');
    _debugObject(APP_NAMESPACE.services, 'services');
    
    console.log('\n--- Managers ---');
    _debugObject(APP_NAMESPACE.managers, 'managers');
    
    console.log('\n--- UI ---');
    _debugObject(APP_NAMESPACE.ui, 'ui');
    
    console.log('\n--- Views ---');
    _debugObject(APP_NAMESPACE.views, 'views');
    
    console.log('\n--- Utils ---');
    _debugObject(APP_NAMESPACE.utils, 'utils');
    
    console.log('\n--- Registry ---');
    _debugObject(APP_NAMESPACE.registry, 'registry');
    
    console.log('\n--- State ---');
    console.log(APP_NAMESPACE.state);
    
    // 🆕 v1.1.0: Phase 2 추가
    console.log('\n--- Functions (fn) ---');
    _debugFunctions(APP_NAMESPACE.fn);
    
    console.log('\n--- Debug Functions (debugFn) ---');
    _debugObject(APP_NAMESPACE.debugFn, 'debugFn');
    
    console.groupEnd();
}

/**
 * 객체 디버그 출력 헬퍼
 * @private
 */
function _debugObject(obj, prefix) {
    for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Map)) {
            // 중첩 객체 확인
            const hasNestedNull = Object.values(value).every(v => v === null);
            if (!hasNestedNull) {
                // 중첩 객체
                for (const [subKey, subValue] of Object.entries(value)) {
                    const status = subValue ? '✅' : '❌';
                    const type = subValue ? `[${subValue.constructor?.name || typeof subValue}]` : '';
                    console.log(`  ${status} ${prefix}.${key}.${subKey} ${type}`);
                }
            } else {
                console.log(`  ❌ ${prefix}.${key} (모두 null)`);
            }
        } else {
            const status = value ? '✅' : '❌';
            const type = value ? `[${value.constructor?.name || typeof value}]` : '';
            console.log(`  ${status} ${prefix}.${key} ${type}`);
        }
    }
}

/**
 * 함수 객체 디버그 출력 헬퍼 (fn 전용)
 * @private
 */
function _debugFunctions(fnObj) {
    for (const [category, functions] of Object.entries(fnObj)) {
        const funcCount = Object.keys(functions).filter(k => typeof functions[k] === 'function').length;
        if (funcCount > 0) {
            console.log(`  📂 fn.${category}: ${funcCount}개 함수`);
            for (const [name, fn] of Object.entries(functions)) {
                if (typeof fn === 'function') {
                    console.log(`     ✅ ${name}()`);
                }
            }
        } else {
            console.log(`  ❌ fn.${category}: (비어있음)`);
        }
    }
}

// API 노출
APP_NAMESPACE.debug = debug;

// ═══════════════════════════════════════════════════════════════════════════
// 5. 편의 함수 (별칭)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 매니저 가져오기 (축약형)
 * @param {string} name - 매니저 이름
 * @returns {*} 매니저 인스턴스
 * 
 * @example
 * const viewMgr = getManager('view');
 * const screenMgr = getManager('screen');
 */
function getManager(name) {
    return get(`managers.${name}`);
}

/**
 * 서비스 가져오기 (축약형)
 * @param {string} category - 서비스 카테고리
 * @param {string} name - 서비스 이름
 * @returns {*} 서비스 인스턴스
 * 
 * @example
 * const sceneManager = getService('scene', 'sceneManager');
 * const monitoringService = getService('monitoring', 'monitoringService');
 */
function getService(category, name) {
    return get(`services.${category}.${name}`);
}

/**
 * UI 컴포넌트 가져오기 (축약형)
 * @param {string} name - UI 컴포넌트 이름
 * @returns {*} UI 컴포넌트 인스턴스
 * 
 * @example
 * const sidebar = getUI('sidebar');
 * const toast = getUI('toast');
 */
function getUI(name) {
    return get(`ui.${name}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Export
// ═══════════════════════════════════════════════════════════════════════════

export {
    APP_NAMESPACE,
    initNamespace,
    register,
    get,
    has,
    unregister,
    debug,
    // 편의 함수
    getManager,
    getService,
    getUI,
    // 🆕 v1.1.0: Phase 2 함수
    registerFn,
    registerDebugFn
};

export default APP_NAMESPACE;