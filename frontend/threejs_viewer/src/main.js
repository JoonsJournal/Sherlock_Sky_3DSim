/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (Cleanroom Sidebar Theme 통합)
 * 
 * @version 8.4.0                      // ← 버전 업데이트!
 * @changelog
 * - v8.4.0: 🔧 Phase 9 - 하위 호환 및 전역 노출 분리 (2026-01-26)
 *           - _updateSidebarButtonState() → compat/LegacyHelpers.js
 *           - _updateSubmenuActiveState() → compat/LegacyHelpers.js
 *           - _enableSidebarIcons() → compat/LegacyHelpers.js
 *           - _disableSidebarIcons() → compat/LegacyHelpers.js
 *           - _updateCoverStatus() → compat/LegacyHelpers.js
 *           - _updateStatusBarConnection() → compat/LegacyHelpers.js
 *           - 7개 액션 헬퍼 함수 → compat/LegacyHelpers.js
 *           - _exposeGlobalObjectsAfterSceneInit() → compat/LegacyGlobals.js
 *           - 약 220줄 코드 감소
 *           - ⚠️ 호환성: 기존 동작 100% 유지
 * - v8.3.0: 🔧 Phase 8 - Mapping 및 AutoSave 분리 (2026-01-26)
 *           - initMappingServices() → mapping/MappingInitializer.js
 *           - _loadEquipmentMappingsAfterConnection() → mapping/MappingLoader.js
 *           - _fallbackToLocalMappings() → mapping/MappingLoader.js
 *           - initEquipmentAutoSave() → autosave/EquipmentAutoSave.js
 *           - showEquipmentRecoveryDialog() → autosave/RecoveryDialog.js
 *           - 약 280줄 코드 감소
 *           - ⚠️ 호환성: 기존 Mapping/AutoSave 동작 100% 유지
 * - v8.2.0: 🔧 Phase 7 - UDS 및 Connection 이벤트 분리 (2026-01-26)
 *           - setupConnectionEvents() → connection/ConnectionEventHandler.js
 *           - setupNavigationControllerEvents() → connection/ConnectionEventHandler.js
 *           - setupScreenManagerEvents() → connection/ConnectionEventHandler.js
 *           - _initializeUDSAfterConnection() → uds/UDSInitializer.js
 *           - _setupUDSEventListeners() → uds/UDSEventHandlers.js
 *           - _convertUDSStatsToStatusBar() → uds/UDSEventHandlers.js
 *           - 약 200줄 코드 감소
 *           - ⚠️ 호환성: 기존 Connection/UDS 동작 100% 유지
 * - v8.1.0: 🔧 Phase 6 - 재연결 복구 분리 (2026-01-26)
 *           - setupReconnectionHandler() → connection/ReconnectionHandler.js
 *           - _executeRecoveryStrategy() → connection/ReconnectionHandler.js
 *           - 8개 복구 액션 함수 → connection/RecoveryActions.js
 *           - 약 350줄 코드 감소
 *           - ⚠️ 호환성: 기존 재연결 복구 동작 100% 유지
 * - v8.0.0: 🔧 Phase 4 - Scene 관리 분리 (2026-01-25)
 *           - initThreeJSScene() → SceneController로 위임
 *           - animate(), startAnimationLoop(), stopAnimationLoop() 제거
 *           - setupScreenManagerEvents() → SceneController 위임
 *           - 약 250줄 코드 감소
 *           - ⚠️ 호환성: window.screenManager, window.viewManager 100% 유지
 * - v7.4.0: 🔧 Phase 3 - 유틸리티 함수 분리 (2026-01-25)
 *           - _showToast, _toggleTheme → AppUtils.js
 *           - _closeConnectionModal, _canAccessFeatures → AppUtils.js
 *           - _createPlaceholder, _createDebugPlaceholder → AppUtils.js
 *           - registerUtilsToNamespace(), registerPlaceholdersToNamespace() 사용
 *           - 약 150줄 코드 감소
 *           - ⚠️ 호환성: window.* 함수 100% 유지
 * - v7.3.0: 🔧 Phase 2 - 전역 상태 관리 분리 (2026-01-25)
 *           - services 객체 → AppState.js에서 import
 *           - sidebarState 초기화 → initSidebarState() 사용
 *           - screenManager → AppState.js에서 import
 *           - window.services 노출 → exposeServicesToWindow() 사용
 *           - ⚠️ 호환성: 기존 모든 참조 100% 유지
 * - v7.2.0: 🔧 Phase 1 - AppConfig 모듈 분리 (2026-01-25)
 *           - SITE_ID, RECOVERY_STRATEGIES, USE_DEPRECATION_WARNINGS 외부화
 *           - app/AppConfig.js에서 import
 *           - ⚠️ 호환성: 기존 모든 참조 100% 유지
 * - v7.1.2: 🔧 StatusBar Stats 형식 수정 (2026-01-22)
 *           - _convertUDSStatsToStatusBar() statusCounts 객체 형식 적용
 *           - StatusBar가 기대하는 소문자 키 사용 (run, idle, stop 등)
 * - v7.1.0: 🆕 UDS (Unified Data Store) 통합 (2026-01-22)
 *           - UnifiedDataStore import 추가
 *           - Site 연결 후 UDS 자동 초기화
 *           - _initializeUDSAfterConnection() 함수 추가
 *           - SignalTower UDS Delta 연동
 *           - StatusBar 실시간 Stats 업데이트
 * - v7.0.0: 🆕 NavigationController 통합 (2026-01-18)
 *           - NavigationController import 추가
 *           - toggleMonitoringMode() 단순화 (60줄 → 10줄)
 *           - setupNavigationControllerEvents() 추가
 *           - screenManager deprecated 메서드 추가
 * - v6.4.0: 🔧 View 전환 조율 로직 추가 (2026-01-18)
 *           - toggleMonitoringMode()에서 screenManager ↔ ViewManager 조율
 *           - screenManager.show3DView()에 ViewManager View 자동 숨김 추가
 *           - screenManager.showCoverScreen()에 ViewManager View 자동 숨김 추가
 *           - 🐛 Bug Fix: Ranking View → 3D View 빈 화면 문제 해결
 *           - ⚠️ 호환성: 기존 모든 기능 100% 유지
 * - v6.3.0: 🆕 Phase 4 - Legacy 전역 변수 마이그레이션 (2026-01-18)
 *           - USE_DEPRECATION_WARNINGS = true 활성화
 *           - migrateGlobalToNamespace() 사용
 *           - exposeGlobalObjects() → migrateGlobalToNamespace() 교체
 * - v6.2.0: 🆕 Phase 3 - Deprecation 경고 시스템 (2026-01-18)
 *           - USE_DEPRECATION_WARNINGS 플래그 추가
 *           - LEGACY_TO_NEW_PATH import
 *           - exposeGlobalObjects() 옵션 적용
 * - v6.1.1: 🔧 Placeholder 패턴 적용 (2026-01-18)
 *           - Three.js 의존 함수 placeholder 등록
 *           - 3D View 초기화 전 호출 시 경고 메시지
 *           - fn.camera, fn.mapping, fn.layout, debugFn
 * - v6.1.0: 🆕 Phase 2 전역 함수 마이그레이션 (2026-01-18)
 *           - 전역 함수 → APP.fn 이동
 *           - registerFn() 사용
 *           - APP.state ↔ sidebarState 동기화
 * - v6.0.0: 🆕 AppNamespace 통합 (2026-01-18)
 *           - 전역 네임스페이스 통합 (window.APP)
 *           - viewManager → screenManager 이름 변경 (충돌 방지)
 *           - 모든 서비스 네임스페이스 등록
 *           - 계층적 서비스 관리 도입
 * - v5.7.0: 🆕 ViewManager 패턴 도입 (2026-01-18)
 *           - ViewBootstrap.js 통합 (VIEW_REGISTRY, ViewManager 클래스)
 *           - initViewManager() 호출 추가 (서비스 주입)
 *           - View 생명주기 중앙 관리 (Lazy 초기화, 싱글톤)
 *           - viewManager 전역 노출 (디버깅용)
 *           - Facade 함수: getView, showView, hideView, toggleView, destroyView
 * - v5.6.0: 🔧 매핑 로드 "API 우선" 전략 적용 (2026-01-14)
 *           - _loadEquipmentMappingsAfterConnection() 로직 변경
 *           - 기존: 로컬 데이터 있으면 API 스킵 (Origin 격리 문제 발생)
 *           - 변경: 항상 API에서 로드, 실패 시 로컬 폴백
 *           - _fallbackToLocalMappings() 헬퍼 함수 추가
 *           - forceRefresh: true로 변경하여 항상 최신 데이터 로드
 * - v5.5.0: 🆕 EquipmentMappingService 통합 (2026-01-13)
 *           - services.mapping.equipmentMappingService 추가
 *           - initMappingServices() 함수 추가
 *           - _loadEquipmentMappingsAfterConnection() 리팩토링
 *           - window.equipmentMappingService 전역 노출
 *           - 재연결 시 매핑 자동 새로고침
 * - v5.4.0: 🆕 재연결 복구 로직 추가 (2026-01-13)
 *           - setupReconnectionHandler() 추가
 *           - connection:reconnected 이벤트 핸들링
 *           - 모드별 복구 전략 (_executeRecoveryStrategy)
 *           - MonitoringService.restart() 연동
 *           - RECOVERY_STRATEGIES 설정 객체
 * - v5.3.1: 🔧 Monitoring 모드 서비스 타이밍 보정 (2026-01-12)
 *           - _initThreeJS() 후 Monitoring 모드면 MonitoringService 수동 시작
 *           - SignalTower Lamp 안 켜지는 버그 수정
 * - v5.3.0: 🆕 Site 연결 후 매핑 데이터 자동 로드 추가
 * - v5.2.1: 🔧 window.services 전역 노출 (H/G 키 동적 SceneManager 조회 지원)
 * - v5.2.0: 🔧 전역 유틸리티 함수 추가 (2026-01-11)
 *           - window.showToast() 추가 (HTML onclick 호환)
 *           - window.closeConnectionModal() 추가
 *           - window.toggleTheme() 추가
 *           - window.canAccessFeatures() 전역 노출
 *           - window.toggleConnectionModal() 전역 노출
 *           - window.toggleDebugPanel() 전역 노출
 *           - index.html 인라인 JS 79% 삭제 지원
 * - v5.1.0: createSidebarUI() 활성화
 * - v5.0.1: Settings 항상 활성화
 * - v5.0.0: Cleanroom Sidebar Theme 통합
 * 
 * 위치: frontend/threejs_viewer/src/main.js
 */

// ============================================
// Bootstrap 모듈 import (기존 유지)
// ============================================
import {
    // Core
    initCoreManagers,
    connectServicesToModeHandlers,
    appModeManager,
    keyboardManager,
    debugManager,
    eventBus,
    logger,
    APP_MODE,
    EVENT_NAME,
    
    // Scene
    initScene,
    hideLoadingStatus,
    
    // UI
    initUIComponents,
    initMonitoringServices,
    togglePerformanceMonitorUI,
    toggleDebugPanel as bootstrapToggleDebugPanel,
    toast,
    connectEquipmentEditButton,
    
    // 🆕 v5.4.0: Connection 관련 추가 import
    startConnectionServiceForMode,
    
    // Events
    setupUIEventListeners,
    setupKeyboardShortcuts,
    setupEditModeEventListeners,
    setupLayoutEventListeners,
    setupLayoutEditorMainConnection,
    initPreviewGenerator,
    
    // Cleanup
    cleanup,

        // 🆕 v5.7.0: ViewBootstrap - ViewManager 패턴
    bootstrapViewManager,  // ViewManager 싱글톤 (bootstrap/index.js에서 이름 변경됨)
    initViewManager,
    getView,
    showView,
    hideView,
    toggleView,
    destroyView,
    VIEW_REGISTRY

} from './bootstrap/index.js';

// ============================================
// 🆕 v6.1.0: AppNamespace import 확장 (Phase 2)
// ============================================
import { 
    initNamespace, 
    register,
    get as getFromNamespace,
    has as hasInNamespace,
    registerFn,
    registerDebugFn,
    // 🆕 Phase 4
    migrateGlobalToNamespace,
    getMigrationStatus,
    LEGACY_MIGRATION_MAP
} from './core/AppNamespace.js';
// Utils
import { CONFIG } from './core/utils/Config.js';
import { memoryManager } from './core/utils/MemoryManager.js';
import { 
    setupGlobalDebugFunctions, 
    exposeGlobalObjects, 
    LEGACY_TO_NEW_PATH  // 🆕 v6.2.0: Phase 3
} from './core/utils/GlobalDebugFunctions.js';

// Layout 관련
import { layout2DTo3DConverter } from './services/converter/Layout2DTo3DConverter.js';
import { roomParamsAdapter } from './services/converter/RoomParamsAdapter.js';

// Storage Service import
import { storageService } from './core/storage/index.js';

// 🆕 v5.5.0: EquipmentMappingService import
import { EquipmentMappingService } from './services/mapping/EquipmentMappingService.js';

// 🆕 v5.1.0: Sidebar UI 컴포넌트 import
import { createSidebarUI } from './ui/sidebar/index.js';

// 🆕 RankingView import 추가
import { RankingView } from './ui/ranking-view/index.js';

// 🆕 v5.4.0: ConnectionMode import
import { ConnectionMode, ConnectionEvents } from './services/ConnectionStatusService.js';

// ============================================
// 🆕 Phase 5: Modes 모듈 import
// ============================================
import {
    // ModeIndicator
    updateModeIndicator,
    updateButtonState,
    
    // ModeToggler
    setSidebarUIRef,
    setScreenManagerRef,
    toggleEditMode,
    toggleMonitoringMode,
    toggleConnectionModal,
    toggleDebugPanel,
    openEquipmentEditModal,
    toggleDevMode,
    toggleFullscreen,
    toggleAdaptivePerformance,
    exposeTogglersToWindow
} from './modes/index.js';

// ============================================
// 🆕 Phase 1 & 2: App 모듈 import
// ============================================
import {
    // Phase 1: AppConfig
    SITE_ID,
    RECOVERY_STRATEGIES,
    USE_DEPRECATION_WARNINGS,
    RECOVERY_ACTIONS,
    getRecoveryStrategy,
    hasRecoveryStrategy,
    
    // Phase 2: AppState
    services,
    sidebarState,
    initSidebarState,
    updateSidebarState,
    getSidebarState,
    exposeServicesToWindow,
    getService,
    setService,
    hasService,
    clearService,
    debugAppState,
    
    // 🆕 Phase 3: AppUtils
    showToast,
    toggleTheme,
    closeConnectionModal,
    canAccessFeatures,
    createPlaceholder,
    createDebugPlaceholder,
    exposeUtilsToWindow,
    registerUtilsToNamespace,
    registerPlaceholdersToNamespace
} from './app/index.js';


// 🆕 v7.0.0: NavigationController import
import { 
    navigationController, 
    NAV_MODE,
    goTo3DView,
    goToRankingView,
    goHome,
    panelManager  // 🆕 추가!
} from './core/navigation/index.js';

// ============================================
// 🆕 Phase 4: Scene 모듈 import
// ============================================
import {
    sceneController,
    animate,
    startAnimationLoop,
    stopAnimationLoop,
    setPerformanceMonitorUI,
    isAnimationRunning
} from './scene/index.js';

// 🆕 v7.1.0: UDS (Unified Data Store) import
import { unifiedDataStore, UnifiedDataStore } from './services/uds/index.js';

// ============================================
// 🆕 Phase 6 & 7: Connection 모듈 import
// ============================================
import {
    // Phase 6: 재연결 핸들러
    setupReconnectionHandler,
    executeRecoveryStrategy,
    
    // 🆕 Phase 7: Connection 이벤트 핸들러
    setupConnectionEvents,
    setupNavigationControllerEvents,
    setupScreenManagerEvents
} from './connection/index.js';

// ============================================
// 🆕 Phase 7: UDS 모듈 import
// ============================================
import {
    initializeUDSAfterConnection,
    setupUDSEventListeners,
    convertUDSStatsToStatusBar
} from './uds/index.js';

// ============================================
// 🆕 Phase 8: Mapping 및 AutoSave 모듈 import
// ============================================
import {
    // Mapping 초기화
    initMappingServices,
    getMappingServiceStatus,
    cleanupMappingServices,
    
    // Mapping 로드
    loadEquipmentMappingsAfterConnection,
    fallbackToLocalMappings,
    forceRefreshMappings
} from './mapping/index.js';

import {
    // AutoSave 관리
    initEquipmentAutoSave,
    stopEquipmentAutoSave,
    getAutoSaveStatus,
    
    // 복구 다이얼로그
    showEquipmentRecoveryDialog,
    closeEquipmentRecoveryDialog
} from './autosave/index.js';

// ============================================
// 🆕 Phase 9: Compat 모듈 import
// ============================================
import {
    // 참조 설정
    setSidebarUIRef as setCompatSidebarUIRef,
    
    // 하위 호환 헬퍼 함수들
    _updateSidebarButtonState,
    _updateSubmenuActiveState,
    _enableSidebarIcons,
    _disableSidebarIcons,
    _updateCoverStatus,
    _updateStatusBarConnection,
    _delay,
    
    // 액션 헬퍼 함수들
    _actionResubscribeWebSocket,
    _actionRefreshStatus,
    _actionReloadAnalysisData,
    _actionReconnectDatabase,
    _actionRefreshDashboard,
    _actionReconnectCache,
    _actionReconnectMappingApi,
    
    // 전역 노출
    setGlobalsContext,
    exposeGlobalObjectsAfterSceneInit
} from './compat/index.js';

// ============================================
// 전역 상태
// ============================================
let animationFrameId;
let performanceMonitorUI;
let previewGenerator;

// 🆕 v5.1.0: Sidebar UI 인스턴스
let sidebarUI = null;

// 🆕 v5.4.0: 재연결 핸들러 정리 함수
let reconnectionCleanup = null;

/**
 * Three.js 실제 초기화
 * 
 * @version 8.0.0 (Phase 4)
 * @description SceneController.initThreeJSScene()으로 위임
 * 
 * @changelog
 * - v8.0.0: Phase 4 - SceneController로 위임 (2026-01-25)
 */
function initThreeJSScene() {
    // ─────────────────────────────────────────────────────────────
    // SceneController에 Bootstrap 의존성 설정 (최초 1회만)
    // ─────────────────────────────────────────────────────────────
    if (!sceneController._bootstrap) {
        sceneController.setBootstrap({
            initScene,
            initMonitoringServices,
            hideLoadingStatus,
            connectServicesToModeHandlers,
            setupEditModeEventListeners,
            setupLayoutEventListeners,
            setupLayoutEditorMainConnection,
            initPreviewGenerator,
            setupGlobalDebugFunctions: (opts) => setupGlobalDebugFunctions({
                ...opts,
                toggleEditMode,
                toggleMonitoringMode
            }),
            bootstrapViewManager
        });
        
        sceneController.setEventBus(eventBus);
        sceneController.setAppModeManager(appModeManager);
        sceneController.setAppMode(APP_MODE);
        sceneController.setSidebarUI(sidebarUI);
        sceneController.setExposeGlobalObjects(_exposeGlobalObjectsAfterSceneInit);
        
        console.log('[main.js] ✅ SceneController 의존성 설정 완료');
    }
    
    // ─────────────────────────────────────────────────────────────
    // SceneController로 초기화 위임
    // ─────────────────────────────────────────────────────────────
    sceneController.initThreeJSScene();
}

// ============================================
// 🆕 v5.1.0: Sidebar UI 초기화
// ============================================

/**
 * Sidebar UI 컴포넌트 초기화
 * Sidebar.js, StatusBar.js, CoverScreen.js 동적 렌더링
 */
function initSidebarUI() {
    console.log('🎨 Sidebar UI 초기화 시작...');
    
    sidebarUI = createSidebarUI({
        // 의존성 주입
        appModeManager,
        eventBus,
        connectionStatusService: services.ui?.connectionStatusService,
        performanceMonitor: null, // 나중에 설정
        toast,
        APP_MODE,
        
        // 콜백 함수들
        callbacks: {
            toggleConnectionModal,
            toggleDebugPanel,
            openEquipmentEditModal,
            toggleEditMode,
            toggleMonitoringMode
        },
        
        // 설정
        siteId: SITE_ID,
        countryCode: 'KR',
        createStatusBar: true,
        createCoverScreen: true
    });
    
    // 🆕 Phase 5: ModeToggler에 참조 설정
    setSidebarUIRef(sidebarUI);

    // 🆕 Phase 9: LegacyHelpers에 참조 설정
    setCompatSidebarUIRef(sidebarUI);

    // 🆕 Sidebar 이벤트 연결
    if (sidebarUI?.sidebar) {
        // Three.js 표시 요청 이벤트
        eventBus.on('threejs:show-requested', () => {
            if (!screenManager.threejsInitialized) {
                screenManager.show3DView();
            }
        });
        
        // Three.js 정지 요청 이벤트
        eventBus.on('threejs:stop-requested', () => {
            screenManager.stopAnimation();
        });
    }
    
    console.log('✅ Sidebar UI 초기화 완료:', {
        sidebar: !!sidebarUI?.sidebar,
        statusBar: !!sidebarUI?.statusBar,
        coverScreen: !!sidebarUI?.coverScreen
    });
    
    return sidebarUI;
}

// ============================================
// 메인 초기화
// ============================================

function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화 (v7.3.0 - Phase 2 전역 상태 분리)...');
    console.log(`📍 Site ID: ${SITE_ID}`);
    
    try {
        // ═══════════════════════════════════════════════════════════════
        // 🆕 v6.0.0: 네임스페이스 먼저 초기화 (가장 먼저!)
        // ═══════════════════════════════════════════════════════════════
        initNamespace()
        console.log('  ✅ AppNamespace 초기화 완료');

        // 🆕 v7.2.1: APP.config 등록 (initNamespace 후에 추가)
        // AppConfig.js에서 import한 값들을 APP.config에 등록
        window.APP.config = {
            SITE_ID,
            USE_DEPRECATION_WARNINGS,
            RECOVERY_STRATEGIES,
            RECOVERY_ACTIONS,
            getRecoveryStrategy,
            hasRecoveryStrategy
        };
        console.log('  ✅ APP.config 등록 완료');

        // 🆕 v7.3.0: sidebarState는 AppState.js에서 import됨
        // initSidebarState()는 import 시점에 자동 호출됨
        if (window.APP && sidebarState) {
            Object.assign(window.APP.state, sidebarState);
            console.log('  ✅ APP.state ↔ sidebarState 동기화 완료');
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🆕 v6.1.0: 전역 함수 APP.fn에 등록 (Phase 2)
        // ═══════════════════════════════════════════════════════════════════
        
        // 🆕 Phase 3: UI 유틸리티 함수 등록 (AppUtils.js에서 import)
        registerUtilsToNamespace(registerFn);
        console.log('  ✅ 전역 함수 APP.fn.ui 등록 완료 (Phase 3: AppUtils)');
        
        // 1. Core 매니저 초기화
        initCoreManagers({ registerHandlers: true });
        console.log('  ✅ Core Managers 초기화 완료');
        
        // 🆕 v6.0.0: Core 매니저 네임스페이스에 등록
        register('managers.mode', appModeManager, { alias: 'appModeManager' });
        register('managers.keyboard', keyboardManager, { alias: 'keyboardManager' });
        register('managers.debug', debugManager, { alias: 'debugManager' });
        register('utils.eventBus', eventBus, { alias: 'eventBus' });
        register('utils.logger', logger, { alias: 'logger' });
        register('registry.APP_MODE', APP_MODE);
        register('registry.EVENT_NAME', EVENT_NAME);
        console.log('  ✅ Core Managers 초기화 완료');
        
        // 2. UI 컴포넌트 초기화 (기존)
        setService('ui', initUIComponents({
            connectionOptions: {
                autoStart: false,
                debug: false
            }
        }));
        console.log('  ✅ UI Components 초기화 완료');
        
        // 3. 🆕 v5.1.0: Sidebar UI 초기화 (동적 렌더링)
        initSidebarUI();

        // 🆕 Phase 9: LegacyGlobals 컨텍스트 설정
        setGlobalsContext({
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
            previewGenerator: null,  // 나중에 설정됨
            toggleAdaptivePerformance,
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel,
            toggleDevMode,
            sidebarUI,
            sceneController
        });
        
        // 🆕 Phase 5: screenManager 참조 설정 (Sidebar UI 초기화 후)
        setScreenManagerRef(sceneController);

        // 🆕 Phase 5: 토글 함수 전역 노출
        exposeTogglersToWindow();

        // ═══════════════════════════════════════════════════════════════════
        // 🆕 v8.0.1: SceneController Bootstrap 사전 설정
        // ⚠️ setupScreenManagerEvents() 전에 반드시 설정해야 함!
        // 이유: NavigationController가 'threejs:init-requested' 이벤트 발행 시
        //       SceneController가 Bootstrap 의존성 없으면 초기화 실패
        // ═══════════════════════════════════════════════════════════════════
        sceneController.setBootstrap({
            initScene,
            initMonitoringServices,
            hideLoadingStatus,
            connectServicesToModeHandlers,
            setupEditModeEventListeners,
            setupLayoutEventListeners,
            setupLayoutEditorMainConnection,
            initPreviewGenerator,
            setupGlobalDebugFunctions: (opts) => setupGlobalDebugFunctions({
                ...opts,
                toggleEditMode,
                toggleMonitoringMode
            }),
            bootstrapViewManager
        });
        
        sceneController.setEventBus(eventBus);
        sceneController.setAppModeManager(appModeManager);
        sceneController.setAppMode(APP_MODE);
        sceneController.setSidebarUI(sidebarUI);
        sceneController.setExposeGlobalObjects(exposeGlobalObjectsAfterSceneInit);
        
        console.log('[main.js] ✅ SceneController Bootstrap 사전 설정 완료');

        // 🆕 v6.1.0: 추가 UI 함수 등록 (Sidebar 초기화 후)
        registerFn('ui', 'toggleConnectionModal', toggleConnectionModal, 'toggleConnectionModal');
        registerFn('ui', 'toggleDebugPanel', toggleDebugPanel, 'toggleDebugPanel');
        registerFn('ui', 'toggleDevMode', toggleDevMode, 'toggleDevMode');
        
        // 모드 함수
        registerFn('mode', 'toggleEditMode', toggleEditMode, 'toggleEditMode');
        registerFn('mode', 'toggleMonitoringMode', toggleMonitoringMode, 'toggleMonitoringMode');
        registerFn('mode', 'toggleFullscreen', toggleFullscreen);
        registerFn('mode', 'toggleAdaptivePerformance', toggleAdaptivePerformance);
        
        console.log('  ✅ 전역 함수 APP.fn.mode 등록 완료');

        // ═══════════════════════════════════════════════════════════════════
        // 🆕 v6.1.1: Placeholder 함수 등록 (Three.js 의존 함수)
        // 3D View 초기화 전에 호출 시 경고 메시지 표시
        // setupGlobalDebugFunctions()에서 실제 함수로 교체됨
        // ═══════════════════════════════════════════════════════════════════
        
        // 🆕 Phase 3: Placeholder 함수 등록 (AppUtils.js에서 import)
        registerPlaceholdersToNamespace(registerFn, registerDebugFn);
        
        // 4. 🆕 v5.7.0: ViewManager 초기화
        setService('views.viewManager', initViewManager({
            webSocketClient: null,
            apiClient: services.ui?.apiClient
        }, {
            initEager: false,
            registerToNamespace: false  // main.js에서 직접 등록
        }));
        console.log('  ✅ ViewManager 초기화 완료');
        
        // 🆕 v6.0.0: ViewManager 네임스페이스에 등록
        register('managers.view', bootstrapViewManager);
        register('registry.VIEW_REGISTRY', VIEW_REGISTRY);
        
        // 🆕 v6.0.0: ScreenManager 네임스페이스에 등록
        register('managers.screen', screenManager);
        
        // 5. EquipmentEditButton 연동 (기존 4번)
        if (services.ui?.equipmentEditButton) {
            connectEquipmentEditButton(services.ui.equipmentEditButton, toggleEditMode);
            console.log('  ✅ EquipmentEditButton 연동 완료');
        }
        
        // 5. Equipment AutoSave 초기화
        initEquipmentAutoSave(services.ui?.equipmentEditState);
        
        // 6. Connection 이벤트 설정 (🆕 Phase 7: 모듈화)
        reconnectionCleanup = setupConnectionEvents({
            appModeManager,
            loadEquipmentMappings: loadEquipmentMappingsAfterConnection  // ← 언더스코어 제거!
        });

        // 🆕 v7.0.0: NavigationController 이벤트 설정
        setupNavigationControllerEvents();

        // 🆕 v7.0.0: screenManager 이벤트 연결
        setupScreenManagerEvents();
        
        // ❌ v5.1.0: 제거됨 - Sidebar.js가 처리
        // setupSidebarEvents();
        
        // 7. 이벤트 리스너 설정
        const eventHandlers = {
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel,
            toggleAdaptivePerformance,
            togglePerformanceMonitor: () => {
                performanceMonitorUI = togglePerformanceMonitorUI(performanceMonitorUI);
            },
            sceneManager: null,
            connectionModal: services.ui?.connectionModal,
            updateConnectionButtonState: () => updateButtonState('connectionBtn', services.ui?.connectionModal?.isOpen)
        };
        
        setupUIEventListeners(eventHandlers);
        setupKeyboardShortcuts(eventHandlers);
        
        // 8. Cover Screen 표시 (기본 상태) - Sidebar.js가 처리
        // viewManager.showCoverScreen() 불필요 - CoverScreen.js가 자동 표시
        
        // 9. 초기 전역 객체 노출
        migrateGlobalToNamespace({
            appModeManager,
            keyboardManager,
            debugManager,
            eventBus,
            logger,
            connectionModal: services.ui?.connectionModal,
            toast,
            equipmentInfoPanel: services.ui?.equipmentInfoPanel,
            equipmentMappingService: services.mapping?.equipmentMappingService,
            connectionStatusService: services.ui?.connectionStatusService,
            storageService,
            sidebarUI,
            bootstrapViewManager,
            VIEW_REGISTRY,
            getView,
            showView,
            hideView,
            toggleView,
            destroyView,
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel,
            toggleDevMode,
            // 🆕 v7.0.0: NavigationController
            navigationController,
            NAV_MODE,
            goTo3DView,
            goToRankingView,
            goHome
        }, {
            useDeprecation: USE_DEPRECATION_WARNINGS,
            pathMapping: LEGACY_MIGRATION_MAP
        });

        // 🔧 Phase 4: viewManager는 sceneController 직접 참조 (Proxy 우회)
        window.viewManager = sceneController;
        // 10. 초기화 완료 이벤트
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode(),
            siteId: SITE_ID,
            version: '5.4.0'
        });
        
        // 11. 성능 업데이트 인터벌 (StatusBar.js가 자체 처리하므로 간소화)
        setInterval(() => {
            if (window.sidebarState?.debugPanelVisible) {
                _updateDebugPanelContent();
            }
        }, 2000);
        
        console.log('');
        console.log('✅ 모든 초기화 완료! (v6.2.0 - Phase 3 Deprecation)');
        
        // 🆕 v6.2.0: Deprecation 상태 출력
        if (USE_DEPRECATION_WARNINGS) {
            console.log('');
            console.log('⚠️ Deprecation 경고 활성화됨');
            console.log('   window.* 레거시 접근 시 경고가 표시됩니다.');
            console.log('   새 API: APP.services.*, APP.managers.*, APP.fn.*');
            console.log('   경고 끄기: APP.setDeprecationConfig({ enabled: false })');
        }
        console.log('');
        console.log('📺 Cover Screen 표시 중 (CoverScreen.js)');
        console.log('🎨 Sidebar 렌더링 완료 (Sidebar.js)');
        console.log('📊 StatusBar 렌더링 완료 (StatusBar.js)');
        console.log('');
        console.log('🆕 v5.4.0: 재연결 복구 기능');
        console.log('   - 연결 끊김 후 복구 시 자동 재시작');
        console.log('   - 모드별 복구 전략 적용');
        console.log('   - Monitoring: WebSocket 재연결 + 상태 새로고침');
        console.log('');
        console.log('🆕 전역 함수 (HTML onclick 호환):');
        console.log('   window.showToast(message, type)');
        console.log('   window.toggleTheme()');
        console.log('   window.toggleDevMode()');
        console.log('   window.toggleConnectionModal()');
        console.log('   window.closeConnectionModal()');
        console.log('   window.toggleDebugPanel()');
        console.log('   window.canAccessFeatures()');
        console.log('');
        console.log('💡 키보드 단축키:');
        console.log('   Ctrl+K - Connection Modal');
        console.log('   D - Debug Panel');
        console.log('   E - Equipment Edit Mode');
        console.log('   M - Monitoring Mode (3D View)');
        console.log('   H - Helper 토글 (3D View)');
        console.log('   G - Grid 토글 (3D View)');
        console.log('');
        console.log('✅ 모든 초기화 완료! (v5.7.0 - ViewManager 패턴)');
        console.log('');
        console.log('📺 Cover Screen 표시 중 (CoverScreen.js)');
        console.log('🎨 Sidebar 렌더링 완료 (Sidebar.js)');
        console.log('📊 StatusBar 렌더링 완료 (StatusBar.js)');
        console.log('');
        console.log('🆕 v5.7.0: ViewManager 패턴 도입');
        console.log('   - View 중앙 관리: bootstrapViewManager.debug()');
        console.log('   - View 조회: getView("ranking-view")');
        console.log('   - View 표시: showView("ranking-view")');
        console.log('   - View 숨김: hideView("ranking-view")');
        console.log('   - View 토글: toggleView("ranking-view")');
        console.log('   - 등록된 View: VIEW_REGISTRY');
        console.log('');
        console.log('🆕 v5.4.0: 재연결 복구 기능');
        console.log('');
        console.log('🆕 v6.1.0: Phase 2 전역 함수 마이그레이션');
        console.log('   - APP.fn.ui.showToast(msg, type)');
        console.log('   - APP.fn.ui.toggleTheme()');
        console.log('   - APP.fn.mode.toggleEditMode()');
        console.log('   - APP.fn.mode.toggleMonitoringMode()');
        console.log('   - APP.state (= sidebarState 동기화)');
        console.log('   💡 APP.debug() 로 전체 네임스페이스 확인');

        // 🆕 v6.3.0: Phase 4 마이그레이션 상태 출력
        console.log('');
        console.log('🆕 v6.3.0: Phase 4 Legacy 마이그레이션');
        console.log(`   Deprecation 경고: ${USE_DEPRECATION_WARNINGS ? 'ON ⚠️' : 'OFF'}`);
        
        if (USE_DEPRECATION_WARNINGS) {
            console.log('   ⚠️ window.* 레거시 접근 시 경고가 표시됩니다.');
            console.log('   새 API:');
            console.log('     - APP.services.scene.sceneManager');
            console.log('     - APP.managers.mode (appModeManager)');
            console.log('     - APP.utils.eventBus');
            console.log('     - APP.fn.ui.showToast()');
            console.log('   경고 끄기: APP.setDeprecationConfig({ enabled: false })');
            console.log('   상태 확인: APP.getMigrationStatus()');

        console.log('');
        console.log('🆕 v7.0.0: NavigationController 통합');
        console.log('   - 모든 화면 전환: navigationController.navigate(mode, submode)');
        console.log('   - 홈으로: navigationController.goHome()');
        console.log('   - 토글: navigationController.toggle(mode, submode)');
        console.log('   - 상태 확인: navigationController.debug()');
        console.log('');
        }
        
    } catch (error) {
        console.error('❌ 초기화 중 오류 발생:', error);
        console.error('스택:', error.stack);
        showInitError(error);
    }

    // 🆕 RankingView 전역 노출 (디버깅용)
    window.RankingView = RankingView;
}

// ============================================
// Debug Panel 내용 업데이트
// ============================================

function _updateDebugPanelContent() {
    const currentMode = appModeManager?.getCurrentMode();
    
    const debugMode = document.getElementById('debug-mode');
    const debugSubmode = document.getElementById('debug-submode');
    const debugConnected = document.getElementById('debug-connected');
    const debugDevmode = document.getElementById('debug-devmode');
    
    if (debugMode) debugMode.textContent = currentMode || 'N/A';
    if (debugSubmode) debugSubmode.textContent = window.sidebarState?.currentSubMode || 'N/A';
    
    if (debugConnected) {
        const isConnected = sidebarUI?.sidebar?.getIsConnected?.() || window.sidebarState?.isConnected || false;
        debugConnected.textContent = isConnected ? 'YES' : 'NO';
        debugConnected.className = `debug-state-value ${isConnected ? 'on' : 'off'}`;
    }
    
    if (debugDevmode) {
        const devMode = sidebarUI?.sidebar?.getDevModeEnabled?.() || window.sidebarState?.devModeEnabled || false;
        debugDevmode.textContent = devMode ? 'ON' : 'OFF';
        debugDevmode.className = `debug-state-value ${devMode ? 'on' : 'off'}`;
    }
}

// ============================================
// 에러 표시
// ============================================

function showInitError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(231, 76, 60, 0.95);
        color: white;
        padding: 30px;
        border-radius: 10px;
        font-family: monospace;
        font-size: 14px;
        z-index: 10000;
        max-width: 80%;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    errorDiv.innerHTML = `
        <h2 style="margin: 0 0 10px 0;">❌ 초기화 실패</h2>
        <p><strong>오류:</strong> ${error.message}</p>
        <p><strong>해결 방법:</strong></p>
        <ul>
            <li>브라우저 콘솔(F12)에서 자세한 오류 확인</li>
            <li>페이지 새로고침 (Ctrl+F5)</li>
            <li>브라우저 캐시 삭제</li>
        </ul>
    `;
    document.body.appendChild(errorDiv);
}

// ============================================
// 정리
// ============================================

function handleCleanup() {
    // 🆕 Phase 7: Connection 모듈 정리
    if (reconnectionCleanup) {
        // reconnection 정리
        if (typeof reconnectionCleanup.reconnection === 'function') {
            reconnectionCleanup.reconnection();
        }
        // UDS 정리
        if (typeof reconnectionCleanup.uds === 'function') {
            reconnectionCleanup.uds();
        }
        reconnectionCleanup = null;
    }
    
    // 🆕 Phase 8: Mapping 서비스 정리 (모듈화)
    cleanupMappingServices();

        // 🆕 v5.7.0: ViewManager 정리
    if (bootstrapViewManager) {
        bootstrapViewManager.destroyAll();
        console.log('  🗑️ ViewManager 정리 완료');
    }

    // 🆕 Phase 8: Equipment AutoSave 중지 (모듈화)
    stopEquipmentAutoSave(services.ui?.equipmentEditState);
    
    // EquipmentInfoPanel 정리
    if (services.ui?.equipmentInfoPanel) {
        services.ui.equipmentInfoPanel.dispose();
    }
    
    // 애니메이션 중지
    sceneController.stopAnimation();  // ← screenManager → sceneController
    
    // 🆕 v5.1.0: Sidebar UI 정리
    if (sidebarUI) {
        sidebarUI.destroy();
        sidebarUI = null;
    }
    
    cleanup({
        animationFrameId,
        performanceMonitor: services.scene?.performanceMonitor,
        adaptivePerformance: services.scene?.adaptivePerformance,
        performanceMonitorUI,
        previewGenerator,
        sceneManager: services.scene?.sceneManager,
        equipmentLoader: services.scene?.equipmentLoader,
        cameraControls: services.scene?.cameraControls,
        interactionHandler: services.scene?.interactionHandler,
        cameraNavigator: services.scene?.cameraNavigator,
        equipmentEditState: services.ui?.equipmentEditState,
        equipmentEditButton: services.ui?.equipmentEditButton,
        connectionModal: services.ui?.connectionModal,
        equipmentEditModal: services.ui?.equipmentEditModal
    });
}

window.addEventListener('beforeunload', handleCleanup);

// ============================================
// 초기화 실행
// ============================================
init();