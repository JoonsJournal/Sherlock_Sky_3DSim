/**
 * AppInitializer.js
 * ==================
 * 애플리케이션 초기화 orchestrator
 * 
 * @version 1.0.0
 * @description
 * - 초기화 단계별 관리 (7단계 초기화 프로세스)
 * - 의존성 주입
 * - 에러 처리
 * - main.js의 init() 함수 로직 분리
 * 
 * @changelog
 * - v1.0.0: Phase 10 - init() 함수 분리 (2026-01-26)
 *           - 7단계 초기화 프로세스 구현
 *           - 단계별 에러 처리 및 롤백
 *           - ⚠️ 호환성: 기존 init() 동작 100% 유지
 * 
 * @dependencies
 * - ./AppConfig.js: SITE_ID, USE_DEPRECATION_WARNINGS, RECOVERY_STRATEGIES
 * - ./AppState.js: services, sidebarState, initSidebarState
 * - ./AppUtils.js: registerUtilsToNamespace, registerPlaceholdersToNamespace
 * - ../bootstrap/index.js: Core, UI, Scene, View 부트스트랩
 * - ../core/AppNamespace.js: 네임스페이스 관리
 * - ../scene/index.js: sceneController
 * - ../modes/index.js: 모드 토글 함수들
 * - ../connection/index.js: Connection 이벤트 핸들러
 * - ../mapping/index.js: Mapping 초기화
 * - ../autosave/index.js: AutoSave 초기화
 * 
 * @exports
 * - AppInitializer (클래스)
 * - appInitializer (싱글톤 인스턴스)
 * - initApp (편의 함수)
 * 
 * 📁 위치: frontend/threejs_viewer/src/app/AppInitializer.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

// ============================================
// AppConfig Import
// ============================================
import {
    SITE_ID,
    RECOVERY_STRATEGIES,
    USE_DEPRECATION_WARNINGS,
    RECOVERY_ACTIONS,
    getRecoveryStrategy,
    hasRecoveryStrategy
} from './AppConfig.js';

// ============================================
// AppState Import
// ============================================
import {
    services,
    sidebarState,
    initSidebarState,
    updateSidebarState,
    getSidebarState,
    exposeServicesToWindow,
    getService,
    setService,
    hasService,
    clearService
} from './AppState.js';

// ============================================
// AppUtils Import
// ============================================
import {
    showToast,
    toggleTheme,
    closeConnectionModal,
    canAccessFeatures,
    exposeUtilsToWindow,
    registerUtilsToNamespace,
    registerPlaceholdersToNamespace
} from './AppUtils.js';

// ============================================
// Bootstrap Import
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
    
    // Connection
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

    // View
    bootstrapViewManager,
    initViewManager,
    getView,
    showView,
    hideView,
    toggleView,
    destroyView,
    VIEW_REGISTRY
} from '../bootstrap/index.js';

// ============================================
// AppNamespace Import
// ============================================
import { 
    initNamespace, 
    register,
    get as getFromNamespace,
    has as hasInNamespace,
    registerFn,
    registerDebugFn,
    migrateGlobalToNamespace,
    getMigrationStatus,
    LEGACY_MIGRATION_MAP
} from '../core/AppNamespace.js';

// ============================================
// Utils Import
// ============================================
import { CONFIG } from '../core/utils/Config.js';
import { memoryManager } from '../core/utils/MemoryManager.js';
import { 
    setupGlobalDebugFunctions, 
    exposeGlobalObjects, 
    LEGACY_TO_NEW_PATH
} from '../core/utils/GlobalDebugFunctions.js';

// ============================================
// Services Import
// ============================================
import { layout2DTo3DConverter } from '../services/converter/Layout2DTo3DConverter.js';
import { roomParamsAdapter } from '../services/converter/RoomParamsAdapter.js';
import { storageService } from '../core/storage/index.js';
import { EquipmentMappingService } from '../services/mapping/EquipmentMappingService.js';

// ============================================
// UI Import
// ============================================
import { createSidebarUI } from '../ui/sidebar/index.js';
import { RankingView } from '../ui/ranking-view/index.js';

// ============================================
// Connection Import
// ============================================
import { ConnectionMode, ConnectionEvents } from '../services/ConnectionStatusService.js';

// ============================================
// Modes Import
// ============================================
import {
    updateModeIndicator,
    updateButtonState,
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
} from '../modes/index.js';

// ============================================
// Navigation Import
// ============================================
import { 
    navigationController, 
    NAV_MODE,
    goTo3DView,
    goToRankingView,
    goHome,
    panelManager
} from '../core/navigation/index.js';

// ============================================
// Scene Import
// ============================================
import {
    sceneController,
    animate,
    startAnimationLoop,
    stopAnimationLoop,
    setPerformanceMonitorUI,
    isAnimationRunning
} from '../scene/index.js';

// ============================================
// Streaming Import (Context-Aware Streaming)
// ============================================
import {
    getSubscriptionLevelManager,
    resetSubscriptionLevelManager,
    DATA_SUBSCRIPTION_LEVEL,
    UI_CONTEXT_SUBSCRIPTION_MAP
} from '../services/streaming/index.js';

// ============================================
// UDS Import
// ============================================
import { unifiedDataStore, UnifiedDataStore } from '../services/uds/index.js';

// ============================================
// Connection Module Import
// ============================================
import {
    setupReconnectionHandler,
    executeRecoveryStrategy,
    setupConnectionEvents,
    setupNavigationControllerEvents,
    setupScreenManagerEvents
} from '../connection/index.js';

// ============================================
// UDS Module Import
// ============================================
import {
    initializeUDSAfterConnection,
    setupUDSEventListeners,
    convertUDSStatsToStatusBar
} from '../uds/index.js';

// ============================================
// Mapping & AutoSave Import
// ============================================
import {
    initMappingServices,
    getMappingServiceStatus,
    cleanupMappingServices,
    loadEquipmentMappingsAfterConnection,
    fallbackToLocalMappings,
    forceRefreshMappings
} from '../mapping/index.js';

import {
    initEquipmentAutoSave,
    stopEquipmentAutoSave,
    getAutoSaveStatus,
    showEquipmentRecoveryDialog,
    closeEquipmentRecoveryDialog
} from '../autosave/index.js';


// ============================================
// 클래스 정의
// ============================================

/**
 * AppInitializer 클래스
 * 애플리케이션 초기화를 7단계로 관리하는 Orchestrator
 */
export class AppInitializer {
    // ═══════════════════════════════════════════
    // 초기화 상태
    // ═══════════════════════════════════════════
    
    /** @type {boolean} 초기화 완료 여부 */
    initialized = false;
    
    /** @type {string|null} 현재 초기화 단계 */
    currentPhase = null;
    
    /** @type {Object|null} Sidebar UI 인스턴스 */
    sidebarUI = null;
    
    /** @type {Function|null} 재연결 정리 함수 */
    reconnectionCleanup = null;
    
    /** @type {Object|null} 성능 모니터 UI */
    performanceMonitorUI = null;
    
    /** @type {Object|null} 프리뷰 생성기 */
    previewGenerator = null;

    // ═══════════════════════════════════════════
    // 생성자
    // ═══════════════════════════════════════════
    
    constructor() {
        this.initialized = false;
        this.currentPhase = null;
        this._boundHandlers = {};
    }

    // ═══════════════════════════════════════════
    // 메인 초기화 함수
    // ═══════════════════════════════════════════
    
    /**
     * 애플리케이션 초기화 실행
     * 7단계 초기화 프로세스를 순차적으로 실행
     * 
     * @returns {Promise<boolean>} 초기화 성공 여부
     */
    async init() {
        console.log('🚀 Sherlock Sky 3DSim 초기화 (v8.4.0 - Phase 10 AppInitializer)...');
        console.log(`📍 Site ID: ${SITE_ID}`);
        
        try {
            // Phase 1: 네임스페이스 초기화
            await this._initPhase1_Namespace();
            
            // Phase 2: Core Managers 초기화
            await this._initPhase2_CoreManagers();
            
            // Phase 3: UI Components 초기화
            await this._initPhase3_UIComponents();
            
            // Phase 4: Sidebar UI 초기화
            await this._initPhase4_SidebarUI();
            
            // Phase 5: SceneController 설정
            await this._initPhase5_SceneController();
            
            // Phase 6: 서비스 및 이벤트 설정
            await this._initPhase6_ServicesAndEvents();
            
            // Phase 7: 전역 노출 및 완료
            await this._initPhase7_GlobalExposeAndFinish();
            
            this.initialized = true;
            this._showInitComplete();
            
            return true;
            
        } catch (error) {
            console.error('❌ 초기화 중 오류 발생:', error);
            console.error('스택:', error.stack);
            this._showInitError(error);
            return false;
        }
    }

    // ═══════════════════════════════════════════
    // Phase 1: 네임스페이스 초기화
    // ═══════════════════════════════════════════
    
    async _initPhase1_Namespace() {
        this.currentPhase = 'Phase1_Namespace';
        console.log('[AppInitializer] Phase 1: 네임스페이스 초기화...');
        
        // AppNamespace 초기화
        initNamespace();
        console.log('  ✅ AppNamespace 초기화 완료');
        
        // APP.config 등록
        window.APP.config = {
            SITE_ID,
            USE_DEPRECATION_WARNINGS,
            RECOVERY_STRATEGIES,
            RECOVERY_ACTIONS,
            getRecoveryStrategy,
            hasRecoveryStrategy
        };
        console.log('  ✅ APP.config 등록 완료');
        
        // sidebarState 동기화
        if (window.APP && sidebarState) {
            Object.assign(window.APP.state, sidebarState);
            console.log('  ✅ APP.state ↔ sidebarState 동기화 완료');
        }
    }

    // ═══════════════════════════════════════════
    // Phase 2: Core Managers 초기화
    // ═══════════════════════════════════════════
    
    async _initPhase2_CoreManagers() {
        this.currentPhase = 'Phase2_CoreManagers';
        console.log('[AppInitializer] Phase 2: Core Managers 초기화...');
        
        // 전역 함수 APP.fn.ui 등록
        registerUtilsToNamespace(registerFn);
        console.log('  ✅ 전역 함수 APP.fn.ui 등록 완료 (AppUtils)');
        
        // Core Managers 초기화
        initCoreManagers({ registerHandlers: true });
        console.log('  ✅ Core Managers 초기화 완료');
        
        // 네임스페이스에 등록
        register('managers.mode', appModeManager, { alias: 'appModeManager' });
        register('managers.keyboard', keyboardManager, { alias: 'keyboardManager' });
        register('managers.debug', debugManager, { alias: 'debugManager' });
        register('utils.eventBus', eventBus, { alias: 'eventBus' });
        register('utils.logger', logger, { alias: 'logger' });
        register('registry.APP_MODE', APP_MODE);
        register('registry.EVENT_NAME', EVENT_NAME);
        console.log('  ✅ Core Managers 네임스페이스 등록 완료');
    }

    // ═══════════════════════════════════════════
    // Phase 3: UI Components 초기화
    // ═══════════════════════════════════════════
    
    async _initPhase3_UIComponents() {
        this.currentPhase = 'Phase3_UIComponents';
        console.log('[AppInitializer] Phase 3: UI Components 초기화...');
        
        // UI Components 초기화
        setService('ui', initUIComponents({
            connectionOptions: {
                autoStart: false,
                debug: false
            }
        }));
        console.log('  ✅ UI Components 초기화 완료');
    }

    // ═══════════════════════════════════════════
    // Phase 4: Sidebar UI 초기화
    // ═══════════════════════════════════════════
    
    async _initPhase4_SidebarUI() {
        this.currentPhase = 'Phase4_SidebarUI';
        console.log('[AppInitializer] Phase 4: Sidebar UI 초기화...');
        
        // Sidebar UI 생성
        this.sidebarUI = createSidebarUI({
            appModeManager,
            eventBus,
            connectionStatusService: services.ui?.connectionStatusService,
            performanceMonitor: null,
            toast,
            APP_MODE,
            
            callbacks: {
                toggleConnectionModal,
                toggleDebugPanel,
                openEquipmentEditModal,
                toggleEditMode,
                toggleMonitoringMode
            },
            
            siteId: SITE_ID,
            countryCode: 'KR',
            createStatusBar: true,
            createCoverScreen: true
        });
        
        // ModeToggler에 참조 설정
        setSidebarUIRef(this.sidebarUI);
        
        // Sidebar 이벤트 연결
        if (this.sidebarUI?.sidebar) {
            eventBus.on('threejs:show-requested', () => {
                if (!sceneController.threejsInitialized) {
                    sceneController.show3DView();
                }
            });
            
            eventBus.on('threejs:stop-requested', () => {
                sceneController.stopAnimation();
            });
        }
        
        console.log('  ✅ Sidebar UI 초기화 완료:', {
            sidebar: !!this.sidebarUI?.sidebar,
            statusBar: !!this.sidebarUI?.statusBar,
            coverScreen: !!this.sidebarUI?.coverScreen
        });
    }

    // ═══════════════════════════════════════════
    // Phase 5: SceneController 설정
    // ═══════════════════════════════════════════
    
    async _initPhase5_SceneController() {
        this.currentPhase = 'Phase5_SceneController';
        console.log('[AppInitializer] Phase 5: SceneController 설정...');
        
        // screenManager 참조 설정
        setScreenManagerRef(sceneController);
        
        // 토글 함수 전역 노출
        exposeTogglersToWindow();
        
        // SceneController Bootstrap 사전 설정
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
        sceneController.setSidebarUI(this.sidebarUI);
        sceneController.setExposeGlobalObjects(() => this._exposeGlobalObjectsAfterSceneInit());
        
        console.log('  ✅ SceneController Bootstrap 사전 설정 완료');
        
        // 추가 UI 함수 등록
        registerFn('ui', 'toggleConnectionModal', toggleConnectionModal, 'toggleConnectionModal');
        registerFn('ui', 'toggleDebugPanel', toggleDebugPanel, 'toggleDebugPanel');
        registerFn('ui', 'toggleDevMode', toggleDevMode, 'toggleDevMode');
        
        // 모드 함수 등록
        registerFn('mode', 'toggleEditMode', toggleEditMode, 'toggleEditMode');
        registerFn('mode', 'toggleMonitoringMode', toggleMonitoringMode, 'toggleMonitoringMode');
        registerFn('mode', 'toggleFullscreen', toggleFullscreen);
        registerFn('mode', 'toggleAdaptivePerformance', toggleAdaptivePerformance);
        
        console.log('  ✅ 전역 함수 APP.fn.mode 등록 완료');
        
        // Placeholder 함수 등록
        registerPlaceholdersToNamespace(registerFn, registerDebugFn);
        console.log('  ✅ Placeholder 함수 등록 완료');
    }

    // ═══════════════════════════════════════════
    // Phase 6: 서비스 및 이벤트 설정
    // ═══════════════════════════════════════════
    
    async _initPhase6_ServicesAndEvents() {
        this.currentPhase = 'Phase6_ServicesAndEvents';
        console.log('[AppInitializer] Phase 6: 서비스 및 이벤트 설정...');
        
        // ViewManager 초기화
        setService('views.viewManager', initViewManager({
            webSocketClient: null,
            apiClient: services.ui?.apiClient
        }, {
            initEager: false,
            registerToNamespace: false
        }));
        console.log('  ✅ ViewManager 초기화 완료');
        
        // ViewManager 네임스페이스 등록
        register('managers.view', bootstrapViewManager);
        register('registry.VIEW_REGISTRY', VIEW_REGISTRY);
        register('managers.screen', sceneController);
        
        // EquipmentEditButton 연동
        if (services.ui?.equipmentEditButton) {
            connectEquipmentEditButton(services.ui.equipmentEditButton, toggleEditMode);
            console.log('  ✅ EquipmentEditButton 연동 완료');
        }
        
        // Equipment AutoSave 초기화
        initEquipmentAutoSave(services.ui?.equipmentEditState);
        console.log('  ✅ Equipment AutoSave 초기화 완료');
        
        // Connection 이벤트 설정
        this.reconnectionCleanup = setupConnectionEvents({
            appModeManager,
            loadEquipmentMappings: loadEquipmentMappingsAfterConnection
        });
        console.log('  ✅ Connection 이벤트 설정 완료');
        
        // NavigationController 이벤트 설정
        setupNavigationControllerEvents();
        console.log('  ✅ NavigationController 이벤트 설정 완료');
        
        // screenManager 이벤트 연결
        setupScreenManagerEvents();
        console.log('  ✅ screenManager 이벤트 연결 완료');

        // =====================================================
        // Context-Aware Streaming: SubscriptionLevelManager 초기화
        // =====================================================
        const subscriptionManager = getSubscriptionLevelManager({
            autoConnect: true  // EventBus 자동 리스너 등록
        });
        
        // APP 네임스페이스 등록
        register('services.streaming.subscriptionLevelManager', subscriptionManager);
        register('registry.DATA_SUBSCRIPTION_LEVEL', DATA_SUBSCRIPTION_LEVEL);
        register('registry.UI_CONTEXT_SUBSCRIPTION_MAP', UI_CONTEXT_SUBSCRIPTION_MAP);
        
        console.log('  ✅ SubscriptionLevelManager 초기화 완료 (Context-Aware Streaming)');
        
        // 이벤트 리스너 설정
        const eventHandlers = {
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel,
            toggleAdaptivePerformance,
            togglePerformanceMonitor: () => {
                this.performanceMonitorUI = togglePerformanceMonitorUI(this.performanceMonitorUI);
            },
            sceneManager: null,
            connectionModal: services.ui?.connectionModal,
            updateConnectionButtonState: () => updateButtonState('connectionBtn', services.ui?.connectionModal?.isOpen)
        };
        
        setupUIEventListeners(eventHandlers);
        setupKeyboardShortcuts(eventHandlers);
        console.log('  ✅ UI/Keyboard 이벤트 리스너 설정 완료');
    }

    // ═══════════════════════════════════════════
    // Phase 7: 전역 노출 및 완료
    // ═══════════════════════════════════════════
    
    async _initPhase7_GlobalExposeAndFinish() {
        this.currentPhase = 'Phase7_GlobalExposeAndFinish';
        console.log('[AppInitializer] Phase 7: 전역 노출 및 완료...');
        
        // 초기 전역 객체 노출
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
            sidebarUI: this.sidebarUI,
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
            navigationController,
            NAV_MODE,
            goTo3DView,
            goToRankingView,
            goHome,
            subscriptionLevelManager: getSubscriptionLevelManager()
        }, {
            useDeprecation: USE_DEPRECATION_WARNINGS,
            pathMapping: LEGACY_MIGRATION_MAP
        });
        
        // viewManager는 sceneController 직접 참조
        window.viewManager = sceneController;
        
        // 초기화 완료 이벤트
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode(),
            siteId: SITE_ID,
            version: '8.4.0'
        });
        
        // 성능 업데이트 인터벌
        setInterval(() => {
            if (window.sidebarState?.debugPanelVisible) {
                this._updateDebugPanelContent();
            }
        }, 2000);
        
        // RankingView 전역 노출
        window.RankingView = RankingView;
        
        console.log('  ✅ 전역 노출 완료');
    }

    // ═══════════════════════════════════════════
    // Scene 초기화 후 전역 객체 노출
    // ═══════════════════════════════════════════
    
    _exposeGlobalObjectsAfterSceneInit() {
        const { 
            sceneManager, equipmentLoader, cameraControls, cameraNavigator, 
            interactionHandler, dataOverlay, statusVisualizer, 
            performanceMonitor, adaptivePerformance 
        } = services.scene || {};
        
        const { 
            connectionModal, equipmentEditState, equipmentEditModal, 
            equipmentEditButton, apiClient, equipmentInfoPanel, 
            connectionStatusService, connectionIndicator 
        } = services.ui || {};
        
        const { monitoringService, signalTowerManager } = services.monitoring || {};
        const { equipmentMappingService } = services.mapping || {};
        const { viewManager: servicesViewManager } = services.views || {};
        
        // APP 네임스페이스에 등록
        register('services.scene.sceneManager', sceneManager);
        register('services.scene.equipmentLoader', equipmentLoader);
        register('services.scene.cameraControls', cameraControls);
        register('services.scene.cameraNavigator', cameraNavigator);
        register('services.scene.interactionHandler', interactionHandler);
        register('services.scene.dataOverlay', dataOverlay);
        register('services.scene.statusVisualizer', statusVisualizer);
        register('services.scene.performanceMonitor', performanceMonitor);
        register('services.scene.adaptivePerformance', adaptivePerformance);
        
        register('services.monitoring.monitoringService', monitoringService);
        register('services.monitoring.signalTowerManager', signalTowerManager);
        
        register('services.mapping.equipmentMappingService', equipmentMappingService);
        
        register('services.connection.connectionStatusService', connectionStatusService);
        register('services.connection.apiClient', apiClient);
        
        register('ui.connectionModal', connectionModal);
        register('ui.equipmentEditState', equipmentEditState);
        register('ui.equipmentEditModal', equipmentEditModal);
        register('ui.equipmentEditButton', equipmentEditButton);
        register('ui.equipmentInfoPanel', equipmentInfoPanel);
        register('ui.toast', toast);
        register('ui.sidebar', this.sidebarUI?.sidebar);
        register('ui.statusBar', this.sidebarUI?.statusBar);
        register('ui.coverScreen', this.sidebarUI?.coverScreen);
        
        register('utils.storageService', storageService);

        // Streaming
        register('services.streaming.subscriptionLevelManager', getSubscriptionLevelManager());
        
        // window.* 전역 노출 (Deprecation 래퍼 적용)
        const globalObjects = {
            sceneManager,
            equipmentLoader,
            cameraControls,
            cameraNavigator,
            interactionHandler,
            dataOverlay,
            statusVisualizer,
            performanceMonitor,
            adaptivePerformance,
            connectionModal,
            equipmentEditState,
            equipmentEditModal,
            equipmentEditButton,
            apiClient,
            toast,
            equipmentInfoPanel,
            connectionStatusService,
            connectionIndicator,
            monitoringService,
            signalTowerManager,
            equipmentMappingService,
            bootstrapViewManager,
            VIEW_REGISTRY,
            getView,
            showView,
            hideView,
            toggleView,
            destroyView,
            appModeManager,
            keyboardManager,
            debugManager,
            eventBus,
            logger,
            layout2DTo3DConverter,
            roomParamsAdapter,
            previewGenerator: this.previewGenerator,
            storageService,
            sidebarUI: this.sidebarUI,
            toggleAdaptivePerformance,
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel,
            toggleDevMode,
            subscriptionLevelManager: getSubscriptionLevelManager()
        };
        
        const migrationResult = migrateGlobalToNamespace(globalObjects, {
            useDeprecation: USE_DEPRECATION_WARNINGS,
            pathMapping: LEGACY_MIGRATION_MAP,
            silent: false
        });
        
        window.viewManager = sceneController;
        
        console.log(`[AppInitializer] Phase 4 Migration: deprecated=${migrationResult.deprecated}, exposed=${migrationResult.exposed}`);
    }

    // ═══════════════════════════════════════════
    // Debug Panel 업데이트
    // ═══════════════════════════════════════════
    
    _updateDebugPanelContent() {
        const currentMode = appModeManager?.getCurrentMode();
        
        const debugMode = document.getElementById('debug-mode');
        const debugSubmode = document.getElementById('debug-submode');
        const debugConnected = document.getElementById('debug-connected');
        const debugDevmode = document.getElementById('debug-devmode');
        
        if (debugMode) debugMode.textContent = currentMode || 'N/A';
        if (debugSubmode) debugSubmode.textContent = window.sidebarState?.currentSubMode || 'N/A';
        
        if (debugConnected) {
            const isConnected = this.sidebarUI?.sidebar?.getIsConnected?.() || window.sidebarState?.isConnected || false;
            debugConnected.textContent = isConnected ? 'YES' : 'NO';
            debugConnected.className = `debug-state-value ${isConnected ? 'on' : 'off'}`;
        }
        
        if (debugDevmode) {
            const devMode = this.sidebarUI?.sidebar?.getDevModeEnabled?.() || window.sidebarState?.devModeEnabled || false;
            debugDevmode.textContent = devMode ? 'ON' : 'OFF';
            debugDevmode.className = `debug-state-value ${devMode ? 'on' : 'off'}`;
        }
    }

    // ═══════════════════════════════════════════
    // 초기화 완료 메시지
    // ═══════════════════════════════════════════
    
    _showInitComplete() {
        console.log('');
        console.log('✅ 모든 초기화 완료! (v8.4.0 - Phase 10 AppInitializer)');
        
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
        console.log('🆕 v8.4.0: Phase 10 AppInitializer');
        console.log('   - 초기화 로직 모듈화');
        console.log('   - 7단계 초기화 프로세스');
        console.log('   - main.js 250줄 → 30줄 감소');
        console.log('');
        console.log('💡 키보드 단축키:');
        console.log('   Ctrl+K - Connection Modal');
        console.log('   D - Debug Panel');
        console.log('   E - Equipment Edit Mode');
        console.log('   M - Monitoring Mode (3D View)');
        console.log('');
    }

    // ═══════════════════════════════════════════
    // 에러 표시
    // ═══════════════════════════════════════════
    
    _showInitError(error) {
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
            <p><strong>단계:</strong> ${this.currentPhase || 'Unknown'}</p>
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

    // ═══════════════════════════════════════════
    // 정리 (Cleanup)
    // ═══════════════════════════════════════════
    
    cleanup() {
        console.log('[AppInitializer] 정리 시작...');
        
        // Connection 모듈 정리
        if (this.reconnectionCleanup) {
            if (typeof this.reconnectionCleanup.reconnection === 'function') {
                this.reconnectionCleanup.reconnection();
            }
            if (typeof this.reconnectionCleanup.uds === 'function') {
                this.reconnectionCleanup.uds();
            }
            this.reconnectionCleanup = null;
        }
        
        // SubscriptionLevelManager 정리
        resetSubscriptionLevelManager();
        console.log('  🗑️ SubscriptionLevelManager 정리 완료');

        // Mapping 서비스 정리
        cleanupMappingServices();
        
        // ViewManager 정리
        if (bootstrapViewManager) {
            bootstrapViewManager.destroyAll();
            console.log('  🗑️ ViewManager 정리 완료');
        }
        
        // Equipment AutoSave 중지
        stopEquipmentAutoSave(services.ui?.equipmentEditState);
        
        // EquipmentInfoPanel 정리
        if (services.ui?.equipmentInfoPanel) {
            services.ui.equipmentInfoPanel.dispose();
        }
        
        // 애니메이션 중지
        sceneController.stopAnimation();
        
        // Sidebar UI 정리
        if (this.sidebarUI) {
            this.sidebarUI.destroy();
            this.sidebarUI = null;
        }
        
        // Bootstrap cleanup 호출
        cleanup({
            animationFrameId: null,
            performanceMonitor: services.scene?.performanceMonitor,
            adaptivePerformance: services.scene?.adaptivePerformance,
            performanceMonitorUI: this.performanceMonitorUI,
            previewGenerator: this.previewGenerator,
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
        
        this.initialized = false;
        console.log('[AppInitializer] ✅ 정리 완료');
    }

    // ═══════════════════════════════════════════
    // Getter
    // ═══════════════════════════════════════════
    
    /** Sidebar UI 인스턴스 반환 */
    getSidebarUI() {
        return this.sidebarUI;
    }
    
    /** 초기화 완료 여부 반환 */
    isInitialized() {
        return this.initialized;
    }
    
    /** 현재 초기화 단계 반환 */
    getCurrentPhase() {
        return this.currentPhase;
    }
}


// ============================================
// 싱글톤 인스턴스
// ============================================

/** @type {AppInitializer} 싱글톤 인스턴스 */
export const appInitializer = new AppInitializer();


// ============================================
// 편의 함수
// ============================================

/**
 * 앱 초기화 편의 함수
 * 
 * @returns {Promise<boolean>} 초기화 성공 여부
 * @example
 * import { initApp } from './app/AppInitializer.js';
 * await initApp();
 */
export async function initApp() {
    return appInitializer.init();
}


// ============================================
// 디버그 함수
// ============================================

/**
 * AppInitializer 디버그 정보 출력
 */
export function debugAppInitializer() {
    console.group('🚀 AppInitializer Debug');
    console.log('initialized:', appInitializer.initialized);
    console.log('currentPhase:', appInitializer.currentPhase);
    console.log('sidebarUI:', !!appInitializer.sidebarUI);
    console.log('reconnectionCleanup:', !!appInitializer.reconnectionCleanup);
    console.groupEnd();
}