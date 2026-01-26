/**
 * AppNamespace.js
 * ===============
 * 
 * 애플리케이션 전역 네임스페이스 정의
 * 
 * 모든 모듈은 이 네임스페이스를 통해 등록/조회
 * 이름 충돌 방지 및 의존성 관리 중앙화
 * 
 * @version 1.3.0
 * @module AppNamespace
 * 
 * @description
 * - 전역 네임스페이스 오염 방지
 * - 모듈 간 이름 충돌 해결 (viewManager 충돌 등)
 * - 계층적 서비스 관리
 * - 의존성 파악 용이
 * 
 * @changelog
 * - v1.3.0: 🆕 Phase 4 - Legacy 전역 변수 마이그레이션 (2026-01-18)
 *   - migrateGlobalToNamespace() 배치 마이그레이션 함수 추가
 *   - exposeWithDeprecation() 개별 노출 함수 추가
 *   - LEGACY_MIGRATION_MAP 매핑 테이블 추가
 *   - getMigrationStatus() 마이그레이션 진행률 추적
 *   - _meta.migration 상태 추적 추가
 * - v1.2.0: 🆕 Phase 3 - Deprecation 경고 시스템 (2026-01-18)
 *   - createDeprecatedAlias() 함수 추가
 *   - Proxy 기반 레거시 접근 경고
 *   - 경고 횟수 제한 (기본 3회)
 *   - resetDeprecationWarnings() 추가
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
 * - register, get, has, unregister
 * - debug
 * - registerFn, registerDebugFn (v1.1.0)
 * - createDeprecatedAlias, resetDeprecationWarnings (v1.2.0)
 * - setDeprecationConfig, getDeprecationStatus (v1.2.0)
 * - migrateGlobalToNamespace, exposeWithDeprecation (v1.3.0)
 * - getMigrationStatus, LEGACY_MIGRATION_MAP (v1.3.0)
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
        version: '6.3.0',  // ← Phase 4
        initialized: false,
        initTimestamp: null,
        // 🆕 v1.3.0: 마이그레이션 상태 추적
        migration: {
            phase: 4,
            deprecationEnabled: false,
            migratedCount: 0,
            pendingCount: 0,
            startTime: null
        }
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
        view: null,      // ViewBootstrap.js의 ViewManager
        screen: null,    // Cover/3D 화면 전환
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
        memoryManager: null,
        storageService: null
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
    // 전역 함수 계층 (Phase 2)
    // ═══════════════════════════════════════════════════════════════════════
    fn: {
        ui: {},      // showToast, toggleTheme, toggleConnectionModal 등
        mode: {},    // toggleEditMode, toggleMonitoringMode 등
        camera: {},  // moveTo, focusEquipment, reset
        mapping: {}, // getStatus, clearAll, export
        layout: {}   // applyTest, testRoomResize
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // 디버그 함수 계층 (Phase 2)
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

function register(path, instance, options = {}) {
    const { override = false, alias = null } = options;
    
    const parts = path.split('.');
    let current = APP_NAMESPACE;
    
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    
    const key = parts[parts.length - 1];
    
    if (current[key] && !override) {
        console.warn(`[APP] ⚠️ 이미 등록됨: ${path} (override: false)`);
        return false;
    }
    
    current[key] = instance;
    console.log(`[APP] ✅ 등록: ${path}`);
    
    if (alias && typeof window !== 'undefined') {
        window[alias] = instance;
        console.log(`[APP]    ↳ 별칭: window.${alias}`);
    }
    
    return true;
}

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

function has(path) {
    const value = get(path);
    return value !== undefined && value !== null;
}

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
// 함수 등록 헬퍼 (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

function registerFn(category, name, fn, windowAlias = null) {
    if (!APP_NAMESPACE.fn[category]) {
        APP_NAMESPACE.fn[category] = {};
    }
    
    APP_NAMESPACE.fn[category][name] = fn;
    console.log(`[APP] ✅ 함수 등록: fn.${category}.${name}`);
    
    if (windowAlias && typeof window !== 'undefined') {
        window[windowAlias] = fn;
        console.log(`[APP]    ↳ 별칭: window.${windowAlias}`);
    }
    
    return true;
}

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
// Deprecation 경고 시스템 (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════

const _deprecationWarnings = new Map();

const DEPRECATION_CONFIG = {
    warnLimit: 3,
    enabled: true,
    style: 'color: #f39c12; font-weight: bold;'
};

function createDeprecatedAlias(target, legacyName, newPath) {
    if (target === null || target === undefined) {
        return target;
    }
    
    if (typeof target === 'function') {
        const wrappedFn = function(...args) {
            _warnDeprecation(legacyName, newPath);
            return target.apply(this, args);
        };
        Object.assign(wrappedFn, target);
        wrappedFn._isDeprecatedAlias = true;
        wrappedFn._originalTarget = target;
        return wrappedFn;
    }
    
    if (typeof target !== 'object') {
        return target;
    }
    
    return new Proxy(target, {
        get(obj, prop) {
            if (
                prop === Symbol.toPrimitive || 
                prop === Symbol.toStringTag ||
                prop === 'toString' || 
                prop === 'valueOf' ||
                prop === 'constructor' ||
                prop === '_isDeprecatedAlias' ||
                prop === '_originalTarget'
            ) {
                return obj[prop];
            }
            
            _warnDeprecation(legacyName, newPath);
            
            const value = obj[prop];
            if (typeof value === 'function') {
                return value.bind(obj);
            }
            return value;
        },
        set(obj, prop, value) {
            _warnDeprecation(legacyName, newPath);
            obj[prop] = value;
            return true;
        },
        apply(target, thisArg, args) {
            _warnDeprecation(legacyName, newPath);
            return target.apply(thisArg, args);
        }
    });
}

function _warnDeprecation(legacyName, newPath) {
    if (!DEPRECATION_CONFIG.enabled) {
        return;
    }
    
    const key = legacyName;
    const count = _deprecationWarnings.get(key) || 0;
    
    if (count < DEPRECATION_CONFIG.warnLimit) {
        const remaining = DEPRECATION_CONFIG.warnLimit - count - 1;
        
        console.warn(
            `%c⚠️ [DEPRECATED] window.${legacyName}`,
            DEPRECATION_CONFIG.style,
            `\n   이 접근 방식은 더 이상 권장되지 않습니다.` +
            `\n   → 대신 ${newPath} 를 사용하세요.` +
            (remaining > 0 ? `\n   (이 경고는 ${remaining}회 더 표시됩니다)` : `\n   (마지막 경고)`)
        );
        
        _deprecationWarnings.set(key, count + 1);
    }
}

function resetDeprecationWarnings() {
    _deprecationWarnings.clear();
    console.log('[APP] ✅ Deprecation 경고 카운터 리셋됨');
}

function setDeprecationConfig(config) {
    if (typeof config.warnLimit === 'number') {
        DEPRECATION_CONFIG.warnLimit = config.warnLimit;
    }
    if (typeof config.enabled === 'boolean') {
        DEPRECATION_CONFIG.enabled = config.enabled;
    }
    console.log('[APP] Deprecation 설정 변경:', DEPRECATION_CONFIG);
}

function getDeprecationStatus() {
    return {
        config: { ...DEPRECATION_CONFIG },
        warnings: Object.fromEntries(_deprecationWarnings),
        totalWarnings: _deprecationWarnings.size
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 v1.3.0: Phase 4 - Legacy 마이그레이션 시스템
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 레거시 window.* 변수 → APP 네임스페이스 경로 매핑
 * 
 * 형식: { legacyWindowName: 'services.scene.sceneManager' }
 * (APP. 접두사 없이 내부 경로만 저장)
 */
const LEGACY_MIGRATION_MAP = {
    // ═══════════════════════════════════════════════════════════════
    // Scene 서비스
    // ═══════════════════════════════════════════════════════════════
    sceneManager: 'services.scene.sceneManager',
    equipmentLoader: 'services.scene.equipmentLoader',
    cameraControls: 'services.scene.cameraControls',
    cameraNavigator: 'services.scene.cameraNavigator',
    interactionHandler: 'services.scene.interactionHandler',
    dataOverlay: 'services.scene.dataOverlay',
    statusVisualizer: 'services.scene.statusVisualizer',
    performanceMonitor: 'services.scene.performanceMonitor',
    adaptivePerformance: 'services.scene.adaptivePerformance',
    
    // ═══════════════════════════════════════════════════════════════
    // Monitoring 서비스
    // ═══════════════════════════════════════════════════════════════
    monitoringService: 'services.monitoring.monitoringService',
    signalTowerManager: 'services.monitoring.signalTowerManager',
    
    // ═══════════════════════════════════════════════════════════════
    // Mapping 서비스
    // ═══════════════════════════════════════════════════════════════
    equipmentMappingService: 'services.mapping.equipmentMappingService',
    
    // ═══════════════════════════════════════════════════════════════
    // Connection 서비스
    // ═══════════════════════════════════════════════════════════════
    connectionStatusService: 'services.connection.connectionStatusService',
    apiClient: 'services.connection.apiClient',
    
    // ═══════════════════════════════════════════════════════════════
    // 매니저
    // ═══════════════════════════════════════════════════════════════
    appModeManager: 'managers.mode',
    keyboardManager: 'managers.keyboard',
    debugManager: 'managers.debug',
    viewManager: 'managers.view',
    screenManager: 'managers.screen',
    bootstrapViewManager: 'managers.view',
    
    // ═══════════════════════════════════════════════════════════════
    // UI 컴포넌트
    // ═══════════════════════════════════════════════════════════════
    connectionModal: 'ui.connectionModal',
    toast: 'ui.toast',
    equipmentInfoPanel: 'ui.equipmentInfoPanel',
    equipmentEditState: 'ui.equipmentEditState',
    equipmentEditModal: 'ui.equipmentEditModal',
    equipmentEditButton: 'ui.equipmentEditButton',
    sidebarUI: 'ui.sidebar',
    
    // ═══════════════════════════════════════════════════════════════
    // Utils
    // ═══════════════════════════════════════════════════════════════
    eventBus: 'utils.eventBus',
    logger: 'utils.logger',
    storageService: 'utils.storageService',
    
    // ═══════════════════════════════════════════════════════════════
    // Layout 관련
    // ═══════════════════════════════════════════════════════════════
    layout2DTo3DConverter: 'services.layout.converter',
    roomParamsAdapter: 'services.layout.roomParamsAdapter',
    previewGenerator: 'services.layout.previewGenerator'
};

/**
 * 🆕 v1.3.0: 단일 전역 변수를 Deprecation 래퍼와 함께 노출
 * 
 * @param {string} legacyName - window에 노출할 이름 (예: 'sceneManager')
 * @param {*} instance - 실제 인스턴스
 * @param {string} [namespacePath] - APP 내부 경로 (없으면 LEGACY_MIGRATION_MAP에서 조회)
 * @param {Object} [options] - 옵션
 * @param {boolean} [options.useDeprecation=true] - Deprecation 경고 사용
 * @returns {boolean} 성공 여부
 * 
 * @example
 * // LEGACY_MIGRATION_MAP에 등록된 변수
 * exposeWithDeprecation('sceneManager', sceneManager);
 * // window.sceneManager 접근 시:
 * // "⚠️ [DEPRECATED] window.sceneManager → APP.services.scene.sceneManager 사용"
 * 
 * // 커스텀 경로 지정
 * exposeWithDeprecation('myService', myService, 'services.custom.myService');
 */
function exposeWithDeprecation(legacyName, instance, namespacePath = null, options = {}) {
    const { useDeprecation = true } = options;
    
    if (instance === undefined || instance === null) {
        return false;
    }
    
    // 경로 결정: 파라미터 > LEGACY_MIGRATION_MAP
    const internalPath = namespacePath || LEGACY_MIGRATION_MAP[legacyName];
    const fullNewPath = internalPath ? `APP.${internalPath}` : `APP.${legacyName}`;
    
    if (useDeprecation && DEPRECATION_CONFIG.enabled) {
        window[legacyName] = createDeprecatedAlias(instance, legacyName, fullNewPath);
        APP_NAMESPACE._meta.migration.migratedCount++;
    } else {
        window[legacyName] = instance;
    }
    
    return true;
}

/**
 * 🆕 v1.3.0: 여러 전역 변수를 한번에 Deprecation 래퍼와 함께 노출
 * 
 * 기존 exposeGlobalObjects() 대체용
 * 
 * @param {Object} objects - { legacyName: instance } 형태
 * @param {Object} [options] - 옵션
 * @param {boolean} [options.useDeprecation=true] - Deprecation 경고 사용
 * @param {Object} [options.pathMapping] - 커스텀 경로 매핑 (없으면 LEGACY_MIGRATION_MAP 사용)
 * @param {boolean} [options.silent=false] - 로그 출력 여부
 * @returns {Object} 결과 { exposed: number, deprecated: number, skipped: number }
 * 
 * @example
 * // 기본 사용 (Deprecation 활성화)
 * const result = migrateGlobalToNamespace({
 *     sceneManager,
 *     equipmentLoader,
 *     eventBus
 * });
 * // result: { exposed: 0, deprecated: 3, skipped: 0 }
 * 
 * // Deprecation 비활성화 (하위 호환 모드)
 * migrateGlobalToNamespace({ sceneManager }, { useDeprecation: false });
 */
function migrateGlobalToNamespace(objects, options = {}) {
    const { 
        useDeprecation = true, 
        pathMapping = LEGACY_MIGRATION_MAP,
        silent = false
    } = options;
    
    const result = { exposed: 0, deprecated: 0, skipped: 0 };
    
    if (!silent) {
        console.group(`[APP] 🚀 Phase 4: Legacy 전역 변수 마이그레이션`);
        console.log(`   Deprecation: ${useDeprecation ? 'ON ⚠️' : 'OFF'}`);
    }
    
    // 마이그레이션 시작 시간 기록
    if (!APP_NAMESPACE._meta.migration.startTime) {
        APP_NAMESPACE._meta.migration.startTime = Date.now();
    }
    
    for (const [legacyName, instance] of Object.entries(objects)) {
        if (instance === undefined || instance === null) {
            result.skipped++;
            continue;
        }
        
        const internalPath = pathMapping[legacyName];
        const fullNewPath = internalPath ? `APP.${internalPath}` : null;
        
        if (useDeprecation && DEPRECATION_CONFIG.enabled && fullNewPath) {
            // Deprecation 래퍼 적용
            window[legacyName] = createDeprecatedAlias(instance, legacyName, fullNewPath);
            result.deprecated++;
        } else {
            // 직접 노출
            window[legacyName] = instance;
            result.exposed++;
        }
    }
    
    // 메타 정보 업데이트
    APP_NAMESPACE._meta.migration.migratedCount += result.deprecated;
    APP_NAMESPACE._meta.migration.deprecationEnabled = useDeprecation;
    
    if (!silent) {
        console.log(`   📊 결과: ${result.deprecated}개 Deprecated, ${result.exposed}개 직접 노출, ${result.skipped}개 스킵`);
        console.groupEnd();
    }
    
    return result;
}

/**
 * 🆕 v1.3.0: 현재 마이그레이션 상태 조회
 * 
 * @returns {Object} 마이그레이션 상태 정보
 * 
 * @example
 * const status = APP.getMigrationStatus();
 * console.log(status.progress); // "65%"
 */
function getMigrationStatus() {
    const registeredServices = _countRegistered(APP_NAMESPACE.services);
    const registeredManagers = _countRegistered(APP_NAMESPACE.managers);
    const registeredUI = _countRegistered(APP_NAMESPACE.ui);
    const registeredUtils = _countRegistered(APP_NAMESPACE.utils);
    
    const totalLegacy = Object.keys(LEGACY_MIGRATION_MAP).length;
    const migratedCount = APP_NAMESPACE._meta.migration.migratedCount;
    
    const elapsedMs = APP_NAMESPACE._meta.migration.startTime 
        ? Date.now() - APP_NAMESPACE._meta.migration.startTime 
        : 0;
    
    return {
        phase: APP_NAMESPACE._meta.migration.phase,
        deprecationEnabled: APP_NAMESPACE._meta.migration.deprecationEnabled,
        totalLegacyVariables: totalLegacy,
        migratedCount,
        progress: totalLegacy > 0 ? Math.round((migratedCount / totalLegacy) * 100) : 0,
        elapsedMs,
        registered: {
            services: registeredServices,
            managers: registeredManagers,
            ui: registeredUI,
            utils: registeredUtils,
            total: registeredServices + registeredManagers + registeredUI + registeredUtils
        },
        deprecationStatus: getDeprecationStatus()
    };
}

/**
 * 등록된 항목 수 카운트 헬퍼
 * 
 * @version 1.3.1 - 순환 참조 감지 추가
 * @private
 * @param {Object} obj - 카운트할 객체
 * @param {number} count - 현재 카운트
 * @param {WeakSet} [visited] - 방문한 객체 추적 (순환 참조 방지)
 * @returns {number} 등록된 항목 수
 */
function _countRegistered(obj, count = 0, visited = new WeakSet()) {
    // 순환 참조 체크
    if (visited.has(obj)) {
        return count;
    }
    
    // 현재 객체를 방문 목록에 추가
    if (typeof obj === 'object' && obj !== null) {
        visited.add(obj);
    }
    
    for (const value of Object.values(obj)) {
        if (value !== null && value !== undefined) {
            // 순환 참조 체크
            if (typeof value === 'object' && visited.has(value)) {
                continue;
            }
            
            // 일반 객체만 재귀 (Array, Map, Set, DOM, Three.js 객체 제외)
            if (
                typeof value === 'object' && 
                !Array.isArray(value) && 
                !(value instanceof Map) && 
                !(value instanceof Set) &&
                !(value instanceof Element) &&           // DOM 요소 제외
                !(value instanceof HTMLElement) &&       // HTML 요소 제외
                !(value.isObject3D === true) &&          // Three.js Object3D 제외
                !(value.isScene === true) &&             // Three.js Scene 제외
                !(value.isCamera === true) &&            // Three.js Camera 제외
                !(value.isRenderer === true) &&          // Three.js Renderer 제외
                !(value.isMesh === true) &&              // Three.js Mesh 제외
                !(value.isGroup === true) &&             // Three.js Group 제외
                !(value.isMaterial === true) &&          // Three.js Material 제외
                !(value.isGeometry === true) &&          // Three.js Geometry 제외
                !(value.isBufferGeometry === true) &&    // Three.js BufferGeometry 제외
                !(value.isTexture === true) &&           // Three.js Texture 제외
                !value.constructor?.name?.includes('THREE') && // Three.js 관련 객체 제외
                value.constructor?.name !== 'WebGLRenderer' && // WebGLRenderer 제외
                Object.getPrototypeOf(value) === Object.prototype // 순수 Object만
            ) {
                count += _countRegistered(value, 0, visited);
            } else {
                count++;
            }
        }
    }
    return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. 초기화 함수
// ═══════════════════════════════════════════════════════════════════════════

function initNamespace() {
    if (APP_NAMESPACE._meta.initialized) {
        console.warn('[APP] ⚠️ 이미 초기화됨');
        return APP_NAMESPACE;
    }
    
    APP_NAMESPACE._meta.initialized = true;
    APP_NAMESPACE._meta.initTimestamp = Date.now();
    
    if (typeof window !== 'undefined') {
        window.APP = APP_NAMESPACE;
        
        // API 함수 노출
        window.APP.register = register;
        window.APP.get = get;
        window.APP.has = has;
        window.APP.unregister = unregister;
        window.APP.debug = debug;
        
        // Phase 2 함수
        window.APP.registerFn = registerFn;
        window.APP.registerDebugFn = registerDebugFn;
        
        // Phase 3 함수
        window.APP.createDeprecatedAlias = createDeprecatedAlias;
        window.APP.resetDeprecationWarnings = resetDeprecationWarnings;
        window.APP.setDeprecationConfig = setDeprecationConfig;
        window.APP.getDeprecationStatus = getDeprecationStatus;
        
        // 🆕 Phase 4 함수
        window.APP.exposeWithDeprecation = exposeWithDeprecation;
        window.APP.migrateGlobalToNamespace = migrateGlobalToNamespace;
        window.APP.getMigrationStatus = getMigrationStatus;
        window.APP.LEGACY_MIGRATION_MAP = LEGACY_MIGRATION_MAP;
    }
    
    console.log(`[APP] 🚀 네임스페이스 초기화 완료 (v${APP_NAMESPACE._meta.version})`);
    
    return APP_NAMESPACE;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. 디버그 유틸리티
// ═══════════════════════════════════════════════════════════════════════════

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
    
    console.log('\n--- Functions (fn) ---');
    _debugFunctions(APP_NAMESPACE.fn);
    
    console.log('\n--- Debug Functions (debugFn) ---');
    _debugObject(APP_NAMESPACE.debugFn, 'debugFn');
    
    console.log('\n--- Deprecation Status ---');
    const depStatus = getDeprecationStatus();
    console.log(`   Enabled: ${depStatus.config.enabled}`);
    console.log(`   Warn Limit: ${depStatus.config.warnLimit}`);
    console.log(`   Tracked Warnings: ${depStatus.totalWarnings}`);
    if (depStatus.totalWarnings > 0) {
        console.log('   Warning Counts:', depStatus.warnings);
    }
    
    // 🆕 v1.3.0: Migration 상태
    console.log('\n--- Migration Status (Phase 4) ---');
    const migStatus = getMigrationStatus();
    console.log(`   Phase: ${migStatus.phase}`);
    console.log(`   Deprecation Enabled: ${migStatus.deprecationEnabled}`);
    console.log(`   Progress: ${migStatus.progress}% (${migStatus.migratedCount}/${migStatus.totalLegacyVariables})`);
    console.log(`   Registered Total: ${migStatus.registered.total}`);
    if (migStatus.elapsedMs > 0) {
        console.log(`   Elapsed: ${migStatus.elapsedMs}ms`);
    }
    
    console.groupEnd();
}

function _debugObject(obj, prefix) {
    for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Map)) {
            const hasNestedNull = Object.values(value).every(v => v === null);
            if (!hasNestedNull) {
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

APP_NAMESPACE.debug = debug;

// ═══════════════════════════════════════════════════════════════════════════
// 5. 편의 함수 (별칭)
// ═══════════════════════════════════════════════════════════════════════════

function getManager(name) {
    return get(`managers.${name}`);
}

function getService(category, name) {
    return get(`services.${category}.${name}`);
}

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
    // Phase 2 함수
    registerFn,
    registerDebugFn,
    // Phase 3 함수
    createDeprecatedAlias,
    resetDeprecationWarnings,
    setDeprecationConfig,
    getDeprecationStatus,
    // 🆕 Phase 4 함수
    exposeWithDeprecation,
    migrateGlobalToNamespace,
    getMigrationStatus,
    LEGACY_MIGRATION_MAP
};

export default APP_NAMESPACE;