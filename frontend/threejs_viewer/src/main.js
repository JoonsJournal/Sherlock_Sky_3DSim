/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (Cleanroom Sidebar Theme 통합)
 * 
 * @version 8.5.0                      // ← 버전 업데이트!
 * @changelog
 * - v8.5.0: 🔧 Phase 10 - AppInitializer 분리 (2026-01-26)
 *           - init() 함수 → AppInitializer.js로 이동
 *           - 7단계 초기화 프로세스 모듈화
 *           - main.js 약 250줄 코드 감소
 *           - _exposeGlobalObjectsAfterSceneInit() → AppInitializer로 이동
 *           - _updateDebugPanelContent() → AppInitializer로 이동
 *           - showInitError() → AppInitializer로 이동
 *           - initSidebarUI() → AppInitializer로 이동
 *           - initThreeJSScene() → AppInitializer로 이동
 *           - handleCleanup() 간소화
 *           - ⚠️ 호환성: 기존 초기화 동작 100% 유지
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
    registerPlaceholdersToNamespace,

    // 🆕 Phase 10: AppInitializer
    appInitializer,
    initApp
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
// 정리
// ============================================

// ============================================
// 정리 (Phase 10: AppInitializer 사용)
// ============================================

function handleCleanup() {
    appInitializer.cleanup();
}

window.addEventListener('beforeunload', handleCleanup);

// ============================================
// 초기화 실행 (Phase 10: AppInitializer 사용)
// ============================================
appInitializer.init();