/**
 * bootstrap/index.js
 * ==================
 * 
 * Bootstrap 모듈 통합 export
 * 
 * @version 2.1.0
 * @module bootstrap
 * 
 * @changelog
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
// 🔧 v2.1.0: ConnectionIndicator 제거
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
    EquipmentEditButton
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