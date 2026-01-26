/**
 * LegacyGlobals.js
 * =================
 * 전역 객체 노출 (하위 호환)
 * 
 * @version 1.0.0
 * @description
 * - Scene 초기화 후 window.* 전역 객체 노출
 * - APP 네임스페이스 등록
 * - Deprecation 래퍼 적용 (USE_DEPRECATION_WARNINGS 활성화 시)
 * - Phase 4 migrateGlobalToNamespace() 사용
 * 
 * @changelog
 * - v1.0.0: Phase 9 - main.js에서 분리 (2026-01-26)
 *           - _exposeGlobalObjectsAfterSceneInit() 이동
 *           - services, sidebarUI, sceneController 참조 외부 설정
 *           - 약 140줄 코드 분리
 *           - ⚠️ 호환성: main.js 기존 동작 100% 유지
 * 
 * @dependencies
 * - services (from '../app/AppState.js')
 * - USE_DEPRECATION_WARNINGS (from '../app/AppConfig.js')
 * - register, migrateGlobalToNamespace, LEGACY_MIGRATION_MAP (from '../core/AppNamespace.js')
 * - storageService (from '../core/storage/index.js')
 * 
 * @exports
 * - exposeGlobalObjectsAfterSceneInit
 * - setGlobalsContext
 * - debugLegacyGlobals
 * 
 * 📁 위치: frontend/threejs_viewer/src/compat/LegacyGlobals.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { services } from '../app/AppState.js';
import { USE_DEPRECATION_WARNINGS } from '../app/AppConfig.js';
import { 
    register, 
    migrateGlobalToNamespace, 
    LEGACY_MIGRATION_MAP 
} from '../core/AppNamespace.js';
import { storageService } from '../core/storage/index.js';

// ============================================
// 외부 참조 (main.js에서 설정)
// ============================================
let _context = {
    // Bootstrap
    toast: null,
    appModeManager: null,
    keyboardManager: null,
    debugManager: null,
    eventBus: null,
    logger: null,
    
    // ViewManager
    bootstrapViewManager: null,
    VIEW_REGISTRY: null,
    getView: null,
    showView: null,
    hideView: null,
    toggleView: null,
    destroyView: null,
    
    // Layout
    layout2DTo3DConverter: null,
    roomParamsAdapter: null,
    previewGenerator: null,
    
    // Mode Togglers
    toggleAdaptivePerformance: null,
    toggleEditMode: null,
    toggleMonitoringMode: null,
    toggleConnectionModal: null,
    toggleDebugPanel: null,
    toggleDevMode: null,
    
    // Sidebar UI
    sidebarUI: null,
    
    // Scene Controller
    sceneController: null
};

/**
 * 전역 노출에 필요한 컨텍스트 설정
 * 
 * @param {Object} context - 컨텍스트 객체
 * @description
 * - main.js에서 초기화 시점에 필요한 참조들 전달
 * - exposeGlobalObjectsAfterSceneInit() 호출 전에 설정 필요
 * 
 * @example
 * setGlobalsContext({
 *     toast,
 *     appModeManager,
 *     bootstrapViewManager,
 *     toggleEditMode,
 *     sidebarUI,
 *     sceneController
 * });
 */
export function setGlobalsContext(context) {
    _context = { ..._context, ...context };
    console.log('[LegacyGlobals] ✅ 컨텍스트 설정 완료:', Object.keys(context).length + '개 항목');
}

/**
 * 전역 객체 노출 (Scene 초기화 후)
 * 
 * @description
 * Phase 4 방식: migrateGlobalToNamespace() 사용
 * - APP 네임스페이스에 등록 (항상 수행)
 * - window.* 전역 노출 (Deprecation 래퍼 적용)
 * - USE_DEPRECATION_WARNINGS가 true면 Deprecation 경고 활성화
 * 
 * @example
 * // Scene 초기화 완료 후 호출
 * exposeGlobalObjectsAfterSceneInit();
 */
export function exposeGlobalObjectsAfterSceneInit() {
    // ═══════════════════════════════════════════════════════════════
    // services에서 인스턴스 추출
    // ═══════════════════════════════════════════════════════════════
    const { 
        sceneManager, 
        equipmentLoader, 
        cameraControls, 
        cameraNavigator, 
        interactionHandler, 
        dataOverlay, 
        statusVisualizer, 
        performanceMonitor, 
        adaptivePerformance 
    } = services.scene || {};
    
    const { 
        connectionModal, 
        equipmentEditState, 
        equipmentEditModal, 
        equipmentEditButton, 
        apiClient, 
        equipmentInfoPanel, 
        connectionStatusService, 
        connectionIndicator 
    } = services.ui || {};
    
    const { monitoringService, signalTowerManager } = services.monitoring || {};
    const { equipmentMappingService } = services.mapping || {};
    const { viewManager: servicesViewManager } = services.views || {};
    
    // ═══════════════════════════════════════════════════════════════
    // 컨텍스트에서 참조 추출
    // ═══════════════════════════════════════════════════════════════
    const {
        toast,
        appModeManager,
        keyboardManager,
        debugManager,
        eventBus,
        logger,
        bootstrapViewManager,
        VIEW_REGISTRY,
        getView,
        showView,
        hideView,
        toggleView,
        destroyView,
        layout2DTo3DConverter,
        roomParamsAdapter,
        previewGenerator,
        toggleAdaptivePerformance,
        toggleEditMode,
        toggleMonitoringMode,
        toggleConnectionModal,
        toggleDebugPanel,
        toggleDevMode,
        sidebarUI,
        sceneController
    } = _context;

    // ═══════════════════════════════════════════════════════════════════
    // 1. APP 네임스페이스에 등록 (항상 수행)
    // ═══════════════════════════════════════════════════════════════════
    
    // Scene Services
    register('services.scene.sceneManager', sceneManager);
    register('services.scene.equipmentLoader', equipmentLoader);
    register('services.scene.cameraControls', cameraControls);
    register('services.scene.cameraNavigator', cameraNavigator);
    register('services.scene.interactionHandler', interactionHandler);
    register('services.scene.dataOverlay', dataOverlay);
    register('services.scene.statusVisualizer', statusVisualizer);
    register('services.scene.performanceMonitor', performanceMonitor);
    register('services.scene.adaptivePerformance', adaptivePerformance);
    
    // Monitoring Services
    register('services.monitoring.monitoringService', monitoringService);
    register('services.monitoring.signalTowerManager', signalTowerManager);
    
    // Mapping Services
    register('services.mapping.equipmentMappingService', equipmentMappingService);
    
    // Connection Services
    register('services.connection.connectionStatusService', connectionStatusService);
    register('services.connection.apiClient', apiClient);
    
    // UI Components
    register('ui.connectionModal', connectionModal);
    register('ui.equipmentEditState', equipmentEditState);
    register('ui.equipmentEditModal', equipmentEditModal);
    register('ui.equipmentEditButton', equipmentEditButton);
    register('ui.equipmentInfoPanel', equipmentInfoPanel);
    register('ui.toast', toast);
    register('ui.sidebar', sidebarUI?.sidebar);
    register('ui.statusBar', sidebarUI?.statusBar);
    register('ui.coverScreen', sidebarUI?.coverScreen);
    
    // Utils
    register('utils.storageService', storageService);

    // ═══════════════════════════════════════════════════════════════════
    // 2. Phase 4: window.* 전역 노출 (Deprecation 래퍼 적용)
    // ═══════════════════════════════════════════════════════════════════
    const globalObjects = {
        // Scene Services
        sceneManager,
        equipmentLoader,
        cameraControls,
        cameraNavigator,
        interactionHandler,
        dataOverlay,
        statusVisualizer,
        performanceMonitor,
        adaptivePerformance,
        
        // UI Components
        connectionModal,
        equipmentEditState,
        equipmentEditModal,
        equipmentEditButton,
        apiClient,
        toast,
        equipmentInfoPanel,
        
        // Connection Services
        connectionStatusService,
        connectionIndicator,
        
        // Monitoring Services
        monitoringService,
        signalTowerManager,
        
        // Mapping Services
        equipmentMappingService,

        // ViewManager
        bootstrapViewManager,
        VIEW_REGISTRY,
        getView,
        showView,
        hideView,
        toggleView,
        destroyView,

        // Core Managers
        appModeManager,
        keyboardManager,
        debugManager,
        eventBus,
        logger,
        
        // Layout
        layout2DTo3DConverter,
        roomParamsAdapter,
        previewGenerator,
        
        // Storage
        storageService,
        
        // Sidebar UI
        sidebarUI,     
        
        // Mode Toggle 함수들
        toggleAdaptivePerformance,
        toggleEditMode,
        toggleMonitoringMode,
        toggleConnectionModal,
        toggleDebugPanel,
        toggleDevMode
    };
    
    // Phase 4: migrateGlobalToNamespace() 사용
    const migrationResult = migrateGlobalToNamespace(globalObjects, {
        useDeprecation: USE_DEPRECATION_WARNINGS,
        pathMapping: LEGACY_MIGRATION_MAP,
        silent: false  // 로그 출력
    });
    
    // viewManager는 sceneController 직접 참조 (Proxy 우회)
    // 🔧 중요: Deprecation Proxy가 아닌 실제 인스턴스 직접 할당
    if (sceneController) {
        window.viewManager = sceneController;
    }

    console.log(`[LegacyGlobals] Phase 4 Migration: deprecated=${migrationResult.deprecated}, exposed=${migrationResult.exposed}`);
    
    return migrationResult;
}

// ============================================
// 디버그
// ============================================

/**
 * LegacyGlobals 디버그 정보 출력
 */
export function debugLegacyGlobals() {
    console.group('🔧 LegacyGlobals Debug (v1.0.0)');
    
    // 컨텍스트 상태
    const contextSet = Object.entries(_context)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, _]) => k);
    const contextUnset = Object.entries(_context)
        .filter(([_, v]) => v === null || v === undefined)
        .map(([k, _]) => k);
    
    console.log('📋 컨텍스트 상태:');
    console.log(`  ✅ 설정됨 (${contextSet.length}개):`, contextSet.join(', '));
    if (contextUnset.length > 0) {
        console.log(`  ❌ 미설정 (${contextUnset.length}개):`, contextUnset.join(', '));
    }
    
    // Services 상태
    console.log('');
    console.log('📋 Services 상태:');
    console.log('  scene:', services.scene ? '✅' : '❌');
    console.log('  ui:', services.ui ? '✅' : '❌');
    console.log('  monitoring:', services.monitoring ? '✅' : '❌');
    console.log('  mapping:', services.mapping ? '✅' : '❌');
    
    // Deprecation 상태
    console.log('');
    console.log('📋 Deprecation 상태:');
    console.log(`  USE_DEPRECATION_WARNINGS: ${USE_DEPRECATION_WARNINGS ? 'ON ⚠️' : 'OFF'}`);
    
    console.groupEnd();
}