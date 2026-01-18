/**
 * bootstrap/index.js
 * ==================
 * 
 * Bootstrap 모듈 통합 export
 * 
 * @version 2.6.0
 * @module bootstrap
 * 
 * @changelog
 * - v2.6.0: 🔧 ViewManager export 명칭 명확화 (2026-01-18)
 *   - viewManager → bootstrapViewManager (명확한 이름)
 *   - main.js의 screenManager와 구분
 * - v2.5.0: 🆕 ViewBootstrap 추가 - ViewManager 패턴 도입
 *   - viewManager, getView, showView, hideView, toggleView, destroyView
 *   - VIEW_REGISTRY, initViewManager
 * - v2.3.0: 🔧 IDataLoader v1.1.0 EventEmitter 패턴 연동 확인
 *   - MonitoringService._setupDataLoaderEvents()에서 loader.on() 정상 작동
 * - v2.2.0: 🆕 UIBootstrap v1.4.0 연동 - Connection 관련 함수 추가
 *   - startConnectionServiceForMode, startConnectionServiceDelayed, setupConnectionServiceAfterMonitoring
 *   - ConnectionState, ConnectionMode, EquipmentInfoPanel, MonitoringServiceEvents
 * - v2.1.0: 🔧 ConnectionIndicator export 제거 (UIBootstrap v1.3.0 연동)
 * - v2.0.0: ModeHandlers export 추가, connectServicesToModeHandlers 추가
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/index.js
 */

// Core Bootstrap
export { 
    initCoreManagers,
    connectServicesToModeHandlers,  // 🆕 v2.0.0
    modeUtils,
    appModeManager,
    keyboardManager,
    debugManager,
    eventBus,
    logger,
    APP_MODE,
    KEYBOARD_CONTEXT,
    EVENT_NAME,
    // 🆕 v2.0.0: ModeHandlers export
    registerAllModeHandlers,
    connectModeHandlerServices,
    modeHandlers
} from './CoreBootstrap.js';

// Scene Bootstrap
export { 
    initScene,
    hideLoadingStatus,
    THREE
} from './SceneBootstrap.js';

// UI Bootstrap
// 🔧 v2.2.0: UIBootstrap v1.4.0 연동 - Connection 관련 함수 추가
export {
    initUIComponents,
    initMonitoringServices,
    initConnectionStatus,
    initEquipmentEditButton,
    connectEquipmentEditButton,
    togglePerformanceMonitorUI,
    toggleDebugPanel,
    toggleConnectionIndicator,
    toast,
    ConnectionStatusService,
    // ConnectionIndicator,  // 🔧 v2.1.0: 제거됨
    ConnectionEvents,
    EquipmentEditButton,
    // 🆕 v2.2.0: UIBootstrap v1.4.0 추가 export
    startConnectionServiceForMode,
    startConnectionServiceDelayed,
    setupConnectionServiceAfterMonitoring,
    ConnectionState,
    ConnectionMode,
    EquipmentInfoPanel,
    MonitoringServiceEvents
} from './UIBootstrap.js';

// Event Bootstrap
export { 
    setupUIEventListeners,
    setupKeyboardShortcuts,
    setupEditModeEventListeners,
    setupLayoutEventListeners,
    setupLayoutEditorMainConnection,
    initPreviewGenerator
} from './EventBootstrap.js';

// Cleanup Manager
export { 
    cleanup,
    disposeComponent
} from './CleanupManager.js';

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 v2.5.0: ViewBootstrap - ViewManager 패턴 도입
// 🔧 v2.6.0: viewManager → bootstrapViewManager (명확한 이름)
// ═══════════════════════════════════════════════════════════════════════════

export {
    // 🔧 v2.6.0: ViewManager 싱글톤 인스턴스 (명확한 이름으로 export)
    // - main.js의 screenManager (Cover/3D 전환)와 구분
    // - View 생명주기 관리 담당
    viewManager as bootstrapViewManager,
    
    // VIEW_REGISTRY (모든 View 설정)
    VIEW_REGISTRY,
    
    // Facade 함수들
    getView,
    showView,
    hideView,
    toggleView,
    destroyView,
    
    // 초기화 함수
    initViewManager
} from './ViewBootstrap.js';