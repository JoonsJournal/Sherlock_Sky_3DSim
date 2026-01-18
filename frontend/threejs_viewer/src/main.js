/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (Cleanroom Sidebar Theme 통합)
 * 
 * @version 6.3.0
 * @changelog
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
// 전역 상태
// ============================================
let animationFrameId;
let performanceMonitorUI;
let previewGenerator;

// 🆕 v5.1.0: Sidebar UI 인스턴스
let sidebarUI = null;

// 🆕 v5.4.0: 재연결 핸들러 정리 함수
let reconnectionCleanup = null;

// 서비스 객체 저장소
// 서비스 객체 저장소
const services = {
    scene: null,
    ui: null,
    monitoring: null,
    // 🆕 v5.5.0: Mapping 서비스 추가
    mapping: {
        equipmentMappingService: null
    },
    // 🆕 v5.7.0: Views 관리 (ViewManager 참조)
    views: {
        viewManager: null  // initViewManager() 호출 후 할당
    }
};

// 🆕 v5.2.1: services를 window에 노출 (H/G 키 동적 SceneManager 조회 지원)
window.services = services;

// Site ID (URL 파라미터 또는 기본값)
const urlParams = new URLSearchParams(window.location.search);
const SITE_ID = urlParams.get('siteId') || 'default_site';

// ============================================
// 🆕 v5.4.0: 모드별 복구 전략 설정
// ============================================

/**
 * 모드별 복구 전략 설정
 * 각 모드에서 재연결 시 어떤 복구 작업을 수행할지 정의
 */
const RECOVERY_STRATEGIES = {
    [APP_MODE.MONITORING]: {
        name: 'Monitoring',
        connectionMode: ConnectionMode.MONITORING,
        restartDelay: 500,
        actions: ['restartMonitoringService', 'resubscribeWebSocket', 'refreshStatus'],
        showToast: true,
        toastMessage: '🔄 Monitoring 모드 복구 중...'
    },
    [APP_MODE.ANALYSIS]: {
        name: 'Analysis',
        connectionMode: ConnectionMode.ANALYSIS,
        restartDelay: 1000,
        actions: ['reloadAnalysisData', 'reconnectDatabase'],
        showToast: true,
        toastMessage: '🔄 Analysis 데이터 재로드 중...'
    },
    [APP_MODE.DASHBOARD]: {
        name: 'Dashboard',
        connectionMode: ConnectionMode.DASHBOARD,
        restartDelay: 500,
        actions: ['refreshDashboard', 'reconnectCache'],
        showToast: true,
        toastMessage: '🔄 Dashboard 새로고침 중...'
    },
    [APP_MODE.EQUIPMENT_EDIT]: {
        name: 'Edit',
        connectionMode: ConnectionMode.EDIT,
        restartDelay: 300,
        actions: ['reconnectMappingApi'],
        showToast: false,
        toastMessage: null
    },
    [APP_MODE.MAIN_VIEWER]: {
        name: 'MainViewer',
        connectionMode: ConnectionMode.DEFAULT,
        restartDelay: 0,
        actions: [],
        showToast: false,
        toastMessage: null
    }
};

/**
 * 🆕 v6.3.0: Phase 4 - Deprecation 경고 활성화
 * 
 * true로 설정하면:
 * - window.sceneManager 접근 시 경고 출력
 * - "APP.services.scene.sceneManager 사용 권장" 안내
 * - 동일 변수당 최대 3회 경고 (setDeprecationConfig로 변경 가능)
 * 
 * 🔧 개발/테스트 중에는 false로 유지 후
 *    충분한 테스트 후 true로 전환 권장
 */
const USE_DEPRECATION_WARNINGS = true;  // 🆕 Phase 4 활성화!


// ============================================
// 전역 상태 (Sidebar용) - 하위 호환
// ============================================
window.sidebarState = window.sidebarState || {
    currentMode: null,
    currentSubMode: null,
    isConnected: false,
    devModeEnabled: false,
    debugPanelVisible: false
};

// ============================================
// 🆕 v5.2.0: 전역 유틸리티 함수 (HTML onclick 호환)
// ============================================
// index.html 인라인 JS에서 이전된 함수들
// HTML onclick 속성에서 직접 호출 가능

// ============================================
// 🆕 v6.1.0: 전역 함수 정의 (내부 함수)
// Phase 2: APP.fn으로 등록 후 window 별칭 제공
// ============================================

/**
 * Toast 알림 표시 (내부 함수)
 * @private
 */
const _showToast = function(message, type = 'info') {
    // toast 모듈 사용 가능하면 위임
    if (toast?.show) {
        toast.show(message, type);
        return;
    }
    
    // 폴백: 직접 DOM 생성
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content"><div class="toast-message">${message}</div></div>
        <button class="toast-close" onclick="this.parentElement.classList.add('toast-hide'); setTimeout(() => this.parentElement.remove(), 300);">×</button>
    `;
    container.appendChild(toastEl);
    
    requestAnimationFrame(() => toastEl.classList.add('toast-show'));
    setTimeout(() => { 
        toastEl.classList.remove('toast-show');
        toastEl.classList.add('toast-hide');
        setTimeout(() => toastEl.remove(), 300); 
    }, 3000);
};

/**
 * 테마 토글 (내부 함수)
 * @private
 */
const _toggleTheme = function() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) themeSwitch.classList.toggle('active', newTheme === 'light');
    
    if (sidebarUI?.sidebar?.setTheme) {
        sidebarUI.sidebar.setTheme(newTheme);
    }
    
    console.log(`🎨 Theme: ${newTheme}`);
};

/**
 * Connection Modal 닫기 (내부 함수)
 * @private
 */
const _closeConnectionModal = function() {
    if (services.ui?.connectionModal?.close) {
        services.ui.connectionModal.close();
    }
    const modal = document.getElementById('connection-modal');
    if (modal) modal.classList.remove('active');
};

/**
 * 접근 권한 체크 (내부 함수)
 * @private
 */
const _canAccessFeatures = function() {
    if (sidebarUI?.sidebar) {
        return sidebarUI.sidebar.getIsConnected() || sidebarUI.sidebar.getDevModeEnabled();
    }
    return window.sidebarState?.isConnected || window.sidebarState?.devModeEnabled;
};

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 v6.1.1: Placeholder 함수 생성 헬퍼
// Three.js 초기화 전에 호출되면 경고 메시지 표시
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Placeholder 함수 생성
 * Three.js 의존 함수가 초기화 전에 호출되면 경고 표시
 * 
 * @param {string} funcName - 함수 경로 (예: 'fn.camera.moveTo')
 * @returns {Function} placeholder 함수
 */
function _createPlaceholder(funcName) {
    return function(...args) {
        const message = `⚠️ APP.${funcName}(): 3D View를 먼저 활성화하세요 (Monitoring → 3D View)`;
        console.warn(message);
        console.warn(`   호출 인자:`, args);
        window.showToast?.('3D View를 먼저 활성화하세요', 'warning');
        return null;
    };
}

/**
 * Debug용 Placeholder (더 상세한 정보 제공)
 * @param {string} funcName - 함수 이름
 * @returns {Function} placeholder 함수
 */
function _createDebugPlaceholder(funcName) {
    return function(...args) {
        console.group(`⚠️ ${funcName}() - 아직 사용할 수 없음`);
        console.warn('Three.js가 초기화되지 않았습니다.');
        console.warn('해결 방법:');
        console.warn('  1. Dev Mode 활성화 또는 DB 연결');
        console.warn('  2. Monitoring → 3D View 진입');
        console.warn('  3. 다시 이 함수 호출');
        if (args.length > 0) {
            console.warn('전달된 인자:', args);
        }
        console.groupEnd();
        window.showToast?.('3D View를 먼저 활성화하세요', 'warning');
        return null;
    };
}

// 하위 호환용 window 노출 (init() 전에 기본 기능 보장)
window.showToast = _showToast;
window.toggleTheme = _toggleTheme;
window.closeConnectionModal = _closeConnectionModal;
window.canAccessFeatures = _canAccessFeatures;

/**
 * 테마 토글 (전역)
 * HTML onclick에서 사용 가능: onclick="window.toggleTheme()"
 */
window.toggleTheme = function() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Theme Switch 버튼 상태 업데이트
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) themeSwitch.classList.toggle('active', newTheme === 'light');
    
    // Sidebar.js 동기화
    if (sidebarUI?.sidebar?.setTheme) {
        sidebarUI.sidebar.setTheme(newTheme);
    }
    
    console.log(`🎨 Theme: ${newTheme}`);
};

/**
 * Connection Modal 닫기 (전역)
 * HTML onclick에서 사용 가능: onclick="window.closeConnectionModal()"
 */
window.closeConnectionModal = function() {
    // services.ui 사용 가능하면 위임
    if (services.ui?.connectionModal?.close) {
        services.ui.connectionModal.close();
    }
    
    // DOM 직접 조작
    const modal = document.getElementById('connection-modal');
    if (modal) modal.classList.remove('active');
};

/**
 * 접근 권한 체크 (전역)
 * HTML onclick에서 사용 가능: if (window.canAccessFeatures()) { ... }
 * 
 * @returns {boolean} 연결됨 또는 Dev Mode 활성화 여부
 */
window.canAccessFeatures = function() {
    // Sidebar.js 인스턴스 있으면 위임
    if (sidebarUI?.sidebar) {
        return sidebarUI.sidebar.getIsConnected() || sidebarUI.sidebar.getDevModeEnabled();
    }
    // 폴백: 전역 상태 사용
    return window.sidebarState?.isConnected || window.sidebarState?.devModeEnabled;
};

// ============================================
// 🆕 v6.0.0: Screen Manager (Cover/3D 전환)
// 기존 viewManager에서 이름 변경 - ViewManager (View 생명주기)와 구분
// ============================================
const screenManager = {
    threejsInitialized: false,
    animationRunning: false,
    
    /**
     * Cover Screen 표시 (기본 상태)
     */
    showCoverScreen() {
        // 🆕 v5.1.0: CoverScreen.js 사용
        if (sidebarUI?.coverScreen) {
            sidebarUI.coverScreen.show();
        } else {
            // 폴백: 기존 방식
            const coverScreen = document.getElementById('cover-screen');
            const threejsContainer = document.getElementById('threejs-container');
            const overlayUI = document.getElementById('overlay-ui');
            
            if (coverScreen) coverScreen.classList.remove('hidden');
            if (threejsContainer) threejsContainer.classList.remove('active');
            if (overlayUI) overlayUI.style.display = 'none';
        }
        
        this.stopAnimation();
        updateModeIndicator(null, null);
        
        console.log('📺 Cover Screen 표시');
    },
    
    /**
     * 3D View 표시 + Three.js 초기화
     */
    show3DView() {
        // 🆕 v5.1.0: CoverScreen.js 사용
        if (sidebarUI?.coverScreen) {
            sidebarUI.coverScreen.hide();
        } else {
            const coverScreen = document.getElementById('cover-screen');
            if (coverScreen) coverScreen.classList.add('hidden');
        }
        
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        
        if (threejsContainer) threejsContainer.classList.add('active');
        if (overlayUI) overlayUI.style.display = 'flex';
        
        // 최초 1회만 Three.js 초기화
        if (!this.threejsInitialized) {
            console.log('🎬 Three.js 지연 초기화 시작...');
            this._initThreeJS();
            this.threejsInitialized = true;
        }
        
        this.startAnimation();
        
        console.log('🎮 3D View 표시');
    },
    
    /**
     * Three.js 씬 초기화 (내부 함수)
     */
    _initThreeJS() {
        try {
            // 1. 3D 씬 초기화
            services.scene = initScene();
            console.log('  ✅ 3D Scene 초기화 완료');
            
            // 2. Monitoring 서비스 초기화
            // 🆕 v5.4.0: connectionStartTiming 옵션 추가
            services.monitoring = initMonitoringServices(
                services.scene.sceneManager.scene,
                services.scene.equipmentLoader,
                services.ui?.equipmentEditState,
                services.ui?.connectionStatusService,
                {
                    connectionStartTiming: 'after-monitoring',
                    connectionDelayMs: 500
                }
            );
            console.log('  ✅ Monitoring Services 초기화 완료');
            
            // 3. DataOverlay ↔ EquipmentInfoPanel 연결
            if (services.scene?.dataOverlay && services.ui?.equipmentInfoPanel) {
                services.scene.dataOverlay.setEquipmentInfoPanel(services.ui.equipmentInfoPanel);
                console.log('  ✅ DataOverlay ↔ EquipmentInfoPanel 연결 완료');
            }
            
            // 4. MonitoringService ↔ EquipmentInfoPanel 연결
            if (services.monitoring?.monitoringService && services.ui?.equipmentInfoPanel) {
                services.monitoring.monitoringService.setEquipmentInfoPanel(services.ui.equipmentInfoPanel);
                console.log('  ✅ MonitoringService ↔ EquipmentInfoPanel 연결 완료');
            }
            
            // 🆕 v5.4.0: MonitoringService에 EventBus 설정 (재연결 이벤트용)
            if (services.monitoring?.monitoringService) {
                services.monitoring.monitoringService.eventBus = eventBus;
            }
            
            // 5. 모드 핸들러에 서비스 연결
            connectServicesToModeHandlers({
                equipmentEditState: services.ui?.equipmentEditState,
                equipmentEditButton: services.ui?.equipmentEditButton,
                monitoringService: services.monitoring?.monitoringService,
                signalTowerManager: services.monitoring?.signalTowerManager
            });
            console.log('  ✅ Mode Handlers 서비스 연결 완료');
            
            // 6. InteractionHandler 연결
            const { interactionHandler, sceneManager, equipmentLoader } = services.scene;
            const { equipmentEditState, equipmentEditModal } = services.ui || {};
            
            interactionHandler.setAppModeManager(appModeManager);
            interactionHandler.setEditMode(equipmentEditState);
            interactionHandler.setEditModal(equipmentEditModal);
            interactionHandler.setMonitoringService(services.monitoring?.monitoringService);
            
            // 7. Edit Mode 이벤트 설정
            setupEditModeEventListeners({
                interactionHandler,
                equipmentLoader,
                equipmentEditState
            });
            
            // 8. Layout 이벤트 설정
            setupLayoutEventListeners({
                sceneManager,
                equipmentLoader,
                interactionHandler,
                statusVisualizer: services.scene.statusVisualizer,
                signalTowerManager: services.monitoring?.signalTowerManager
            });
            
            // 9. LayoutEditorMain 연결
            setupLayoutEditorMainConnection(sceneManager);
            
            // 10. PreviewGenerator 초기화
            previewGenerator = initPreviewGenerator();
            
            // 11. 전역 디버그 함수 설정
            setupGlobalDebugFunctions({
                sceneManager,
                equipmentLoader,
                cameraNavigator: services.scene.cameraNavigator,
                equipmentEditState,
                toggleEditMode,
                toggleMonitoringMode
            });
            
            if (services.scene.adaptivePerformance) {
                services.scene.adaptivePerformance.setupGlobalCommands();
            }
            
            // 12. 전역 객체 노출 (Scene 초기화 후)
            _exposeGlobalObjectsAfterSceneInit();
            
            // 🆕 v5.1.0: StatusBar에 PerformanceMonitor 연결
            if (sidebarUI?.statusBar && services.scene?.performanceMonitor) {
                sidebarUI.statusBar.setPerformanceMonitor(services.scene.performanceMonitor);
            }
            
            // 🆕 v5.7.0: ViewManager에 추가 서비스 주입 (Scene 초기화 후)
            if (bootstrapViewManager) {
                bootstrapViewManager.addService('webSocketClient', services.monitoring?.monitoringService?.getDataLoader?.()?.wsManager);
                bootstrapViewManager.addService('monitoringService', services.monitoring?.monitoringService);
                bootstrapViewManager.addService('signalTowerManager', services.monitoring?.signalTowerManager);
                bootstrapViewManager.addService('sceneManager', services.scene?.sceneManager);
                bootstrapViewManager.initEagerViews();  // Eager View 초기화
                console.log('  ✅ ViewManager 서비스 업데이트 완료');
            }
            
            // 13. 로딩 상태 숨김
            hideLoadingStatus(1000);

            // 🆕 v5.3.1: 타이밍 보정 - Monitoring 모드면 서비스 수동 시작
            this._ensureMonitoringServiceStarted();
            
            console.log('✅ Three.js 지연 초기화 완료');
            
        } catch (error) {
            console.error('❌ Three.js 초기화 실패:', error);
            window.showToast?.('3D View 초기화 실패', 'error');
        }
    },
    
    /**
     * 🆕 v5.3.1: Monitoring 모드 서비스 시작 보정
     * Three.js 초기화 후 호출하여 타이밍 문제 해결
     */
    _ensureMonitoringServiceStarted() {
        const currentMode = appModeManager.getCurrentMode();
        
        if (currentMode !== APP_MODE.MONITORING) {
            return;
        }
        
        const monitoringService = services.monitoring?.monitoringService;
        
        if (monitoringService && !monitoringService.isActive) {
            console.log('  🔧 [타이밍 보정] MonitoringService 수동 시작');
            monitoringService.start();
        }
        
        console.log('  ✅ Monitoring 모드 서비스 타이밍 보정 완료');
    },
    
    startAnimation() {
        if (!this.animationRunning && services.scene) {
            this.animationRunning = true;
            animate();
            console.log('▶️ 애니메이션 시작');
        }
    },
    
    stopAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        this.animationRunning = false;
        console.log('⏹️ 애니메이션 중지');
    }
};

// viewManager 전역 노출
window.viewManager = screenManager;   // 하위 호환
window.screenManager = screenManager; // 새 이름

// ============================================
// Mode Indicator 업데이트
// ============================================

function updateModeIndicator(mode, submode) {
    const modeValue = document.getElementById('current-mode');
    const submodeValue = document.getElementById('current-submode');
    
    if (modeValue) {
        modeValue.textContent = mode 
            ? (mode.charAt(0).toUpperCase() + mode.slice(1)) 
            : '—';
    }
    
    if (submodeValue) {
        submodeValue.textContent = submode 
            ? `→ ${submode === '3d-view' ? '3D View' : submode}` 
            : '';
    }
    
    window.sidebarState.currentMode = mode;
    window.sidebarState.currentSubMode = submode;
}

// ============================================
// 접근 권한 체크 헬퍼 (내부용)
// ============================================

function canAccessFeatures() {
    // 🆕 v5.1.0: Sidebar 인스턴스에서 상태 가져오기
    if (sidebarUI?.sidebar) {
        return sidebarUI.sidebar.getIsConnected() || sidebarUI.sidebar.getDevModeEnabled();
    }
    return window.sidebarState.isConnected || window.sidebarState.devModeEnabled;
}

// ============================================
// 모드 토글 함수
// ============================================

/**
 * Equipment Edit 모드 토글
 */
function toggleEditMode() {
    if (!canAccessFeatures()) {
        window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    appModeManager.toggleMode(APP_MODE.EQUIPMENT_EDIT);
    
    const currentMode = appModeManager.getCurrentMode();
    if (currentMode === APP_MODE.EQUIPMENT_EDIT) {
        if (!screenManager.threejsInitialized) {
            screenManager.show3DView();
        }
        updateModeIndicator('Edit', 'Equipment');
    } else {
        updateModeIndicator(null, null);
    }
}

/**
 * Monitoring 모드 토글
 */
function toggleMonitoringMode(submode = '3d-view') {
    if (!canAccessFeatures()) {
        window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    const prevMode = appModeManager.getCurrentMode();
    
    if (prevMode === APP_MODE.MONITORING && window.sidebarState?.currentSubMode === submode) {
        appModeManager.switchMode(APP_MODE.MAIN_VIEWER);

        // 🆕 v5.7.0: ViewManager를 통해 현재 View 숨김
        if (submode === 'ranking-view') {
            hideView('ranking-view');
        }

        screenManager.showCoverScreen();
        updateModeIndicator(null, null);
        return;
    }
    
    appModeManager.switchMode(APP_MODE.MONITORING);
    
    if (submode === '3d-view') {
        screenManager.show3DView();
    } else if (submode === 'ranking-view') {
        // 🆕 v5.7.0: ViewManager를 통해 RankingView 표시
        showView('ranking-view');
    } else {
        screenManager.showCoverScreen();
    }
    
    updateModeIndicator('Monitoring', submode);
    window.showToast?.(`Monitoring: ${submode}`, 'info');
}

/**
 * Connection Modal 토글
 * 🆕 v5.1.0: Sidebar.js의 콜백으로 전달됨
 */
function toggleConnectionModal() {
    // 기존 ConnectionModal 사용 (services.ui)
    if (services.ui?.connectionModal) {
        services.ui.connectionModal.toggle();
    }
    
    // 🆕 새 Connection Modal (Sidebar.js가 생성)
    const modal = document.getElementById('connection-modal');
    if (modal) {
        modal.classList.toggle('active');
    }
}

// 🆕 v5.2.0: 전역 노출
window.toggleConnectionModal = toggleConnectionModal;

/**
 * Debug Panel 토글
 */
function toggleDebugPanel() {
    if (!canAccessFeatures()) {
        window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    bootstrapToggleDebugPanel();
    
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
        debugPanel.classList.toggle('active');
        window.sidebarState.debugPanelVisible = debugPanel.classList.contains('active');
    }
}

// 🆕 v5.2.0: 전역 노출
window.toggleDebugPanel = toggleDebugPanel;

/**
 * Equipment Edit Modal 열기
 */
function openEquipmentEditModal() {
    if (services.ui?.equipmentEditModal) {
        services.ui.equipmentEditModal.open();
    }
}

/**
 * 🆕 v5.1.0: Dev Mode 토글 (하위 호환용)
 * Sidebar.js가 실제 처리하지만, 기존 코드 호환을 위해 유지
 */
function toggleDevMode() {
    // Sidebar.js 인스턴스가 있으면 위임
    if (sidebarUI?.sidebar) {
        sidebarUI.sidebar.toggleDevMode();
        // 전역 상태 동기화
        window.sidebarState.devModeEnabled = sidebarUI.sidebar.getDevModeEnabled();
    } else {
        // 폴백: 직접 처리
        window.sidebarState.devModeEnabled = !window.sidebarState.devModeEnabled;
        const devModeEnabled = window.sidebarState.devModeEnabled;
        
        const devModeBadge = document.getElementById('dev-mode-badge');
        if (devModeBadge) {
            devModeBadge.classList.toggle('active', devModeEnabled);
        }
        
        const devModeLabel = document.getElementById('dev-mode-label') || document.getElementById('dev-mode-toggle');
        if (devModeLabel) {
            const labelSpan = devModeLabel.querySelector('span') || devModeLabel;
            if (labelSpan.tagName === 'SPAN') {
                labelSpan.textContent = `Dev Mode: ${devModeEnabled ? 'ON' : 'OFF'}`;
            } else {
                devModeLabel.textContent = `Dev Mode: ${devModeEnabled ? 'ON' : 'OFF'}`;
            }
        }
        
        const mockTestSection = document.getElementById('mock-test-section');
        if (mockTestSection) {
            mockTestSection.style.display = devModeEnabled ? 'block' : 'none';
        }
        
        const layoutWrapper = document.getElementById('btn-layout-wrapper');
        if (layoutWrapper) {
            if (devModeEnabled) {
                layoutWrapper.classList.remove('hidden');
                layoutWrapper.classList.remove('disabled');
            } else {
                layoutWrapper.classList.add('hidden');
            }
        }
        
        if (devModeEnabled) {
            _enableSidebarIcons();
            window.showToast?.('⚡ Dev Mode ON', 'warning');
        } else {
            if (!window.sidebarState.isConnected) {
                _disableSidebarIcons();
            }
            window.showToast?.('Dev Mode OFF', 'info');
        }
    }
    
    _updateDebugPanelContent();
    console.log(`⚡ Dev Mode: ${window.sidebarState.devModeEnabled ? 'ON' : 'OFF'}`);
}

// 전역 노출 (하위 호환)
window.toggleDevMode = toggleDevMode;

/**
 * 버튼 상태 업데이트 헬퍼
 */
function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.toggle('active', isActive);
    }
}

/**
 * 전체화면 토글
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// ============================================
// AdaptivePerformance ON/OFF 토글
// ============================================
function toggleAdaptivePerformance() {
    const adaptivePerformance = services.scene?.adaptivePerformance;
    
    if (!adaptivePerformance) {
        console.warn('⚠️ AdaptivePerformance가 초기화되지 않았습니다');
        window.showToast?.('AdaptivePerformance 미초기화', 'warning');
        return false;
    }
    
    if (!adaptivePerformance.enabled) {
        console.warn('⚠️ AdaptivePerformance가 Feature Flag로 비활성화되어 있습니다');
        window.showToast?.('AdaptivePerformance Feature Flag 비활성화', 'warning');
        return false;
    }
    
    const newState = !adaptivePerformance.adjustmentEnabled;
    adaptivePerformance.setEnabled(newState);
    
    updateButtonState('adaptiveBtn', newState);
    
    if (newState) {
        window.showToast?.('✅ AdaptivePerformance ON', 'success');
    } else {
        window.showToast?.('🛑 AdaptivePerformance OFF', 'info');
    }
    
    return newState;
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
// 🆕 v5.4.0: 재연결 복구 핸들러
// ============================================

/**
 * 재연결 복구 핸들러 설정
 * 
 * connection:reconnected 이벤트를 수신하여
 * 현재 모드에 맞는 복구 전략을 실행
 * 
 * @returns {Function} 정리 함수
 */
function setupReconnectionHandler() {
    console.log('🔄 재연결 복구 핸들러 설정 시작...');
    
    const connectionStatusService = services.ui?.connectionStatusService;
    
    if (!connectionStatusService) {
        console.warn('  ⚠️ ConnectionStatusService 없음 - 재연결 핸들러 설정 건너뜀');
        return () => {};
    }
    
    // 연결 복구 이벤트 핸들러
    const handleReconnected = async (data) => {
        const recoveredAfter = data.recoveredAfter || 0;
        
        // 첫 연결은 무시 (복구만 처리)
        if (recoveredAfter === 0) {
            return;
        }
        
        console.log(`🔄 [Reconnection] 연결 복구 감지 (${recoveredAfter}회 실패 후)`);
        
        // 현재 모드 확인
        const currentMode = appModeManager.getCurrentMode();
        const strategy = RECOVERY_STRATEGIES[currentMode];
        
        if (!strategy) {
            console.log(`  ℹ️ 모드 ${currentMode}에 대한 복구 전략 없음`);
            return;
        }
        
        console.log(`  📋 복구 전략: ${strategy.name}`);
        console.log(`  📋 실행할 액션: ${strategy.actions.join(', ') || '없음'}`);
        
        // Toast 표시
        if (strategy.showToast && strategy.toastMessage) {
            window.showToast?.(strategy.toastMessage, 'info');
        }
        
        // 복구 전략 실행
        try {
            await _executeRecoveryStrategy(currentMode, strategy);
            
            console.log(`  ✅ ${strategy.name} 모드 복구 완료`);
            
            // 복구 완료 이벤트 발행
            eventBus.emit('recovery:complete', {
                mode: currentMode,
                strategy: strategy.name,
                recoveredAfter,
                timestamp: new Date().toISOString()
            });
            
            // 성공 Toast
            if (strategy.showToast) {
                window.showToast?.(`✅ ${strategy.name} 모드 복구 완료`, 'success');
            }
            
        } catch (error) {
            console.error(`  ❌ ${strategy.name} 모드 복구 실패:`, error);
            
            // 실패 이벤트 발행
            eventBus.emit('recovery:failed', {
                mode: currentMode,
                strategy: strategy.name,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            window.showToast?.(`❌ ${strategy.name} 복구 실패`, 'error');
        }
    };
    
    // 이벤트 구독
    connectionStatusService.onOnline(handleReconnected);
    
    // EventBus를 통한 추가 이벤트 구독 (커스텀 재연결 트리거 지원)
    eventBus.on('connection:manual-reconnect', handleReconnected);
    
    console.log('  ✅ 재연결 복구 핸들러 설정 완료');
    
    // 정리 함수 반환
    return () => {
        connectionStatusService.off(ConnectionEvents.ONLINE, handleReconnected);
        eventBus.off('connection:manual-reconnect', handleReconnected);
        console.log('  🗑️ 재연결 복구 핸들러 정리됨');
    };
}

/**
 * 복구 전략 실행
 * @private
 * @param {string} mode - 현재 모드
 * @param {Object} strategy - 복구 전략 설정
 */
async function _executeRecoveryStrategy(mode, strategy) {
    // 딜레이 적용
    if (strategy.restartDelay > 0) {
        await _delay(strategy.restartDelay);
    }
    
    // ConnectionStatusService 모드 변경
    const connectionStatusService = services.ui?.connectionStatusService;
    if (connectionStatusService && strategy.connectionMode) {
        startConnectionServiceForMode(connectionStatusService, strategy.connectionMode);
    }
    
    // 각 액션 실행
    for (const action of strategy.actions) {
        await _executeRecoveryAction(action, mode);
    }
}

/**
 * 개별 복구 액션 실행
 * @private
 * @param {string} action - 액션 이름
 * @param {string} mode - 현재 모드
 */
async function _executeRecoveryAction(action, mode) {
    console.log(`    → 액션 실행: ${action}`);
    
    switch (action) {
        case 'restartMonitoringService':
            await _actionRestartMonitoringService();
            break;
            
        case 'resubscribeWebSocket':
            await _actionResubscribeWebSocket();
            break;
            
        case 'refreshStatus':
            await _actionRefreshStatus();
            break;
            
        case 'reloadAnalysisData':
            await _actionReloadAnalysisData();
            break;
            
        case 'reconnectDatabase':
            await _actionReconnectDatabase();
            break;
            
        case 'refreshDashboard':
            await _actionRefreshDashboard();
            break;
            
        case 'reconnectCache':
            await _actionReconnectCache();
            break;
            
        case 'reconnectMappingApi':
            await _actionReconnectMappingApi();
            break;
            
        default:
            console.warn(`    ⚠️ 알 수 없는 액션: ${action}`);
    }
}

// ============================================
// 🆕 v5.4.0: 복구 액션 구현
// ============================================

/**
 * MonitoringService 재시작
 * @private
 */
async function _actionRestartMonitoringService() {
    const monitoringService = services.monitoring?.monitoringService;
    
    if (!monitoringService) {
        console.warn('      ⚠️ MonitoringService 없음');
        return;
    }
    
    if (monitoringService.isActive) {
        // 🆕 v5.0.0: restart() 메서드 사용
        if (typeof monitoringService.restart === 'function') {
            await monitoringService.restart({ fullRestart: false });
            console.log('      ✅ MonitoringService 재시작 완료 (restart)');
        } else {
            // 폴백: 기존 방식
            await monitoringService.stop();
            await _delay(300);
            await monitoringService.start();
            console.log('      ✅ MonitoringService 재시작 완료 (stop/start)');
        }
    } else {
        // 비활성 상태면 그냥 시작
        await monitoringService.start();
        console.log('      ✅ MonitoringService 시작됨');
    }
}

/**
 * WebSocket 재구독
 * @private
 */
async function _actionResubscribeWebSocket() {
    const monitoringService = services.monitoring?.monitoringService;
    
    // DataLoader 사용 시
    const dataLoader = monitoringService?.getDataLoader?.();
    if (dataLoader) {
        try {
            await dataLoader.reconnectWebSocket();
            console.log('      ✅ DataLoader WebSocket 재연결 완료');
            return;
        } catch (e) {
            console.warn('      ⚠️ DataLoader WebSocket 재연결 실패:', e.message);
        }
    }
    
    // 레거시 방식
    const wsManager = monitoringService?.wsManager;
    if (wsManager) {
        if (!wsManager.isConnected()) {
            await wsManager.connect();
        }
        wsManager.subscribe();
        console.log('      ✅ WebSocket 재구독 완료');
    }
}

/**
 * 상태 새로고침
 * @private
 */
async function _actionRefreshStatus() {
    const monitoringService = services.monitoring?.monitoringService;
    
    if (monitoringService) {
        await monitoringService.loadInitialStatus?.();
        monitoringService.updateStatusPanel?.();
        console.log('      ✅ 상태 새로고침 완료');
    }
}

/**
 * Analysis 데이터 재로드
 * @private
 */
async function _actionReloadAnalysisData() {
    // TODO: AnalysisDataLoader 구현 후 연동
    console.log('      ℹ️ Analysis 데이터 재로드 (미구현)');
    
    // eventBus를 통해 Analysis 모듈에 알림
    eventBus.emit('analysis:reload-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Database 재연결
 * @private
 */
async function _actionReconnectDatabase() {
    // Database 연결 확인은 ConnectionStatusService가 처리
    console.log('      ℹ️ Database 재연결 요청');
    
    eventBus.emit('database:reconnect-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Dashboard 새로고침
 * @private
 */
async function _actionRefreshDashboard() {
    // TODO: DashboardDataLoader 구현 후 연동
    console.log('      ℹ️ Dashboard 새로고침 (미구현)');
    
    eventBus.emit('dashboard:refresh-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Cache 재연결
 * @private
 */
async function _actionReconnectCache() {
    // Redis 캐시 재연결은 Backend가 처리
    console.log('      ℹ️ Cache 재연결 요청');
    
    eventBus.emit('cache:reconnect-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Mapping API 재연결
 * 🆕 v5.5.0: EquipmentMappingService 사용
 * @private
 */
async function _actionReconnectMappingApi() {
    // 🆕 v5.5.0: EquipmentMappingService 우선 사용
    const mappingService = services.mapping?.equipmentMappingService;
    
    if (mappingService) {
        try {
            // 캐시 정리 후 재로드
            mappingService.clearMappingCache();
            
            const result = await mappingService.loadCurrentMappings({
                forceRefresh: true,
                applyToEditState: true
            });
            
            console.log(`      ✅ Mapping API 재연결 완료: ${result.count}개 매핑`);
            return;
        } catch (e) {
            console.warn('      ⚠️ Mapping API 재연결 실패:', e.message);
        }
    }
    
    // 폴백: 기존 방식
    const apiClient = services.ui?.apiClient;
    
    if (apiClient) {
        try {
            const isHealthy = await apiClient.healthCheck?.();
            console.log(`      ℹ️ Mapping API 상태: ${isHealthy ? 'OK' : 'Failed'}`);
        } catch (e) {
            console.warn('      ⚠️ Mapping API 헬스체크 실패:', e.message);
        }
    }
}

// ============================================
// 🔌 Connection 이벤트 설정
// ============================================

function setupConnectionEvents() {
    console.log('🔌 Connection 이벤트 설정 시작...');
    
    const connectionStatusService = services.ui?.connectionStatusService;
    
    if (connectionStatusService) {
        connectionStatusService.onOnline((data) => {
            console.log('[Connection] API Online:', data);
            
            // 🆕 v5.1.0: Sidebar.js가 자동으로 처리
            // sidebarUI?.sidebar?.enableAfterConnection() 호출 불필요
            
            if (data.recoveredAfter > 0) {
                window.showToast?.('Backend 연결 복구', 'success');
            }
        });
        
        connectionStatusService.onOffline(() => {
            console.log('[Connection] API Offline');
            
            // 🆕 v5.1.0: Sidebar.js가 자동으로 처리
            
            window.sidebarState.isConnected = false;
            window.showToast?.('Backend 연결 끊김', 'warning');
        });
    }
    
    // Site 연결 이벤트
    eventBus.on('site:connected', async ({ siteId, siteName }) => {
        console.log(`[Connection] Site Connected: ${siteId}`);
        window.sidebarState.isConnected = true;
        
        // 🆕 v5.3.0: Site 연결 후 매핑 데이터 자동 로드
        await _loadEquipmentMappingsAfterConnection(siteId);
    });
    
    eventBus.on('site:disconnected', () => {
        console.log('[Connection] Site Disconnected');
        window.sidebarState.isConnected = false;
    });
    
    // 🆕 v5.4.0: 재연결 복구 핸들러 설정
    reconnectionCleanup = setupReconnectionHandler();
    
    console.log('✅ Connection 이벤트 설정 완료');
}

/*
// ============================================
// 🆕 v5.5.0: Mapping 서비스 초기화
// ============================================

/**
 * 🆕 v5.5.0: Mapping 서비스 초기화
 * Site 연결 후 또는 Three.js 초기화 시 호출
 * 
 * @param {Object} options - 초기화 옵션
 * @param {Object} options.apiClient - ApiClient 인스턴스
 * @param {Object} options.equipmentEditState - EquipmentEditState 인스턴스
 * @param {Object} options.eventBus - EventBus 인스턴스
 * @param {string} [options.siteId] - 현재 사이트 ID
 * @returns {Promise<EquipmentMappingService>}
 */
async function initMappingServices(options = {}) {
    const { apiClient, equipmentEditState, eventBus: eb, siteId } = options;
    
    console.log('🔧 Mapping 서비스 초기화 시작...');
    
    // 동적 import
    const { EquipmentMappingService } = await import('./services/mapping/EquipmentMappingService.js');
    
    // EquipmentMappingService 인스턴스 생성
    services.mapping.equipmentMappingService = new EquipmentMappingService({
        apiClient: apiClient || services.ui?.apiClient,
        editState: equipmentEditState || services.ui?.equipmentEditState,
        eventBus: eb || eventBus,
        siteId: siteId || null,
        apiBaseUrl: null  // 자동 감지
    });
    
    console.log('  ✅ EquipmentMappingService 생성 완료');
    
    // 전역 노출
    window.equipmentMappingService = services.mapping.equipmentMappingService;
    
    return services.mapping.equipmentMappingService;
}

/*
/**
 * 🆕 v5.6.0: Site 연결 후 매핑 데이터 로드 (API 우선 방식)
 * 
 * ⭐ v5.6.0 변경: "항상 API 우선" 전략 적용
 * - 기존: 로컬 데이터 있으면 스킵 → Origin 격리 문제 발생
 * - 변경: 항상 API에서 로드 시도, 실패 시 로컬 폴백
 * 
 * @private
 * @param {string} siteId - 연결된 Site ID
 */
async function _loadEquipmentMappingsAfterConnection(siteId) {
    const equipmentEditState = services.ui?.equipmentEditState;
    const apiClient = services.ui?.apiClient;
    
    // 의존성 확인
    if (!equipmentEditState) {
        console.warn('[Connection] EquipmentEditState not available - skipping mapping load');
        return;
    }
    
    if (!apiClient) {
        console.warn('[Connection] ApiClient not available - skipping mapping load');
        return;
    }
    
    // 🆕 v5.6.0: 로컬 상태 백업 (폴백용)
    const localStatus = equipmentEditState.getMappingsStatus?.() || { isEmpty: true, count: 0 };
    console.log(`[Connection] Local mappings: ${localStatus.count}개 (폴백용 백업)`);
    
    try {
        console.log(`📡 Loading equipment mappings for site: ${siteId} (API 우선)`);
        
        // EquipmentMappingService 초기화 (없으면)
        if (!services.mapping.equipmentMappingService) {
            await initMappingServices({
                apiClient,
                equipmentEditState,
                eventBus,
                siteId
            });
        }
        
        const mappingService = services.mapping.equipmentMappingService;
        
        // 🆕 v5.6.0: 항상 API에서 로드 시도 (forceRefresh: true)
        const result = await mappingService.loadMappingsForSite(siteId, {
            forceRefresh: true,       // 🔧 항상 서버에서 최신 데이터 로드
            applyToEditState: true    // 자동으로 EditState에 적용
        });
        
        if (result.connected && result.count > 0) {
            console.log(`✅ Equipment mappings loaded from API: ${result.count}개`);
            window.showToast?.(`${result.count}개 설비 매핑 로드됨 (서버)`, 'success');
            
            // MonitoringService에 매핑 갱신 알림 (활성 상태인 경우)
            if (services.monitoring?.monitoringService?.isActive) {
                console.log('[Connection] Notifying MonitoringService of mapping update');
                services.monitoring.monitoringService.refreshMappingState?.();
            }
            
            // 이벤트 발행
            eventBus.emit('mapping:loaded', {
                siteId,
                count: result.count,
                source: 'api',
                timestamp: new Date().toISOString()
            });
            
        } else if (result.connected && result.count === 0) {
            console.log('ℹ️ No equipment mappings on server');
            
            // 🆕 v5.6.0: 서버에 데이터 없으면 로컬 데이터 유지
            if (!localStatus.isEmpty) {
                console.log(`[Connection] 서버에 매핑 없음 - 로컬 데이터 유지 (${localStatus.count}개)`);
                window.showToast?.(`로컬 매핑 데이터 사용 (${localStatus.count}개)`, 'info');
            }
            
        } else {
            // 🆕 v5.6.0: API 연결 실패 시 로컬 폴백
            console.warn(`⚠️ API load failed: ${result.message || 'Unknown error'}`);
            _fallbackToLocalMappings(localStatus, siteId);
        }
        
    } catch (error) {
        console.error('❌ Error loading equipment mappings:', error);
        
        // 🆕 v5.6.0: 예외 발생 시 로컬 폴백
        _fallbackToLocalMappings(localStatus, siteId);
        
        // 이벤트 발행
        eventBus.emit('mapping:load-error', {
            siteId,
            error: error.message,
            fallbackUsed: !localStatus.isEmpty,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 🆕 v5.6.0: 로컬 매핑 데이터로 폴백
 * @private
 * @param {Object} localStatus - 로컬 매핑 상태
 * @param {string} siteId - Site ID
 */
function _fallbackToLocalMappings(localStatus, siteId) {
    if (!localStatus.isEmpty && localStatus.count > 0) {
        console.log(`[Connection] 📂 로컬 폴백 사용: ${localStatus.count}개 매핑`);
        window.showToast?.(`로컬 매핑 데이터 사용 (${localStatus.count}개)`, 'warning');
        
        // 이벤트 발행
        eventBus.emit('mapping:loaded', {
            siteId,
            count: localStatus.count,
            source: 'local-fallback',
            timestamp: new Date().toISOString()
        });
    } else {
        console.warn('[Connection] ⚠️ 로컬 매핑 데이터도 없음 - 매핑 없이 진행');
        window.showToast?.('매핑 데이터를 찾을 수 없습니다', 'error');
        
        // 이벤트 발행
        eventBus.emit('mapping:not-found', {
            siteId,
            timestamp: new Date().toISOString()
        });
    }
}

// ============================================
// Equipment AutoSave 관련 (기존 유지)
// ============================================

function showEquipmentRecoveryDialog(recoveryData) {
    const autoSaveMeta = recoveryData._autoSave;
    const savedAt = autoSaveMeta?.savedAt ? new Date(autoSaveMeta.savedAt) : new Date();
    const mappingCount = recoveryData.mappingCount || Object.keys(recoveryData.mappings || {}).length;
    
    const diffMs = Date.now() - savedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    let timeAgo = '방금 전';
    if (diffMins >= 60) {
        timeAgo = `${diffHours}시간 전`;
    } else if (diffMins >= 1) {
        timeAgo = `${diffMins}분 전`;
    }
    
    const dialog = document.createElement('div');
    dialog.id = 'equipment-recovery-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        ">
            <h3 style="margin: 0 0 16px 0; color: #2c3e50; font-size: 18px;">
                🔄 저장되지 않은 Equipment 매핑 발견
            </h3>
            
            <div style="
                background: #f8f9fa;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
            ">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #6c757d;">저장 시간:</span>
                    <span style="color: #2c3e50; font-weight: 500;">${savedAt.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #6c757d;">경과 시간:</span>
                    <span style="color: #e67e22; font-weight: 500;">${timeAgo}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6c757d;">매핑 수:</span>
                    <span style="color: #27ae60; font-weight: 500;">${mappingCount}개</span>
                </div>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; margin-bottom: 20px;">
                이전 세션에서 자동 저장된 Equipment 매핑 데이터가 있습니다.
                복구하시겠습니까?
            </p>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="recovery-discard-btn" style="
                    padding: 10px 20px;
                    border: 1px solid #dee2e6;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #6c757d;
                ">삭제</button>
                <button id="recovery-apply-btn" style="
                    padding: 10px 20px;
                    border: none;
                    background: #3498db;
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                ">복구</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    document.getElementById('recovery-apply-btn').onclick = () => {
        if (services.ui?.equipmentEditState) {
            services.ui.equipmentEditState.applyAutoSaveRecovery(recoveryData);
            services.ui.equipmentEditState.clearAutoSaveRecovery(storageService);
            window.showToast?.('✅ Equipment 매핑 복구 완료!', 'success');
        }
        dialog.remove();
    };
    
    document.getElementById('recovery-discard-btn').onclick = () => {
        if (services.ui?.equipmentEditState) {
            services.ui.equipmentEditState.clearAutoSaveRecovery(storageService);
            window.showToast?.('AutoSave 데이터 삭제됨', 'info');
        }
        dialog.remove();
    };
}

function initEquipmentAutoSave(equipmentEditState) {
    if (!equipmentEditState) {
        console.warn('[main.js] EquipmentEditState가 없습니다. AutoSave 건너뜀.');
        return;
    }
    
    const recoveryData = equipmentEditState.checkAutoSaveRecovery(storageService);
    
    if (recoveryData) {
        showEquipmentRecoveryDialog(recoveryData);
    }
    
    equipmentEditState.initAutoSave(storageService, SITE_ID);
    
    eventBus.on('autosave:complete', (data) => {
        if (data.namespace === 'equipment') {
            console.log('[Equipment AutoSave] 저장 완료:', data.timestamp);
        }
    });
    
    eventBus.on('autosave:error', (data) => {
        if (data.namespace === 'equipment') {
            console.error('[Equipment AutoSave] 저장 실패:', data.error);
            window.showToast?.('⚠️ Equipment AutoSave 실패', 'warning');
        }
    });
    
    console.log(`✅ Equipment AutoSave 초기화 완료 - siteId: ${SITE_ID}`);
}

// ============================================
// 🆕 v5.1.0: 하위 호환 함수들 (Sidebar.js 위임)
// ============================================

/**
 * Sidebar 버튼 선택 상태 업데이트 (하위 호환)
 */
function _updateSidebarButtonState(mode) {
    // Sidebar.js가 자동 처리하지만, 직접 호출 시 DOM 조작
    document.querySelectorAll('#sidebar .icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    if (mode) {
        const btn = document.getElementById(`btn-${mode}`);
        if (btn) btn.classList.add('selected');
    }
}

/**
 * Submenu 활성 상태 업데이트 (하위 호환)
 */
function _updateSubmenuActiveState(mode, submode) {
    const submenu = document.getElementById(`${mode}-submenu`);
    if (!submenu) return;
    
    submenu.querySelectorAll('.submenu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.submode === submode);
    });
}

/**
 * Sidebar 아이콘 활성화 (하위 호환)
 */
function _enableSidebarIcons() {
    // Sidebar.js가 있으면 위임
    if (sidebarUI?.sidebar) {
        sidebarUI.sidebar._updateButtonStates?.();
        return;
    }
    
    // 폴백
    const icons = ['btn-monitoring', 'btn-analysis', 'btn-simulation'];
    const wrappers = ['btn-monitoring-wrapper', 'btn-debug-wrapper'];
    
    icons.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('disabled');
    });
    
    wrappers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('disabled');
    });
    
    const debugBtn = document.getElementById('btn-debug');
    if (debugBtn) debugBtn.classList.remove('disabled');
    
    if (window.sidebarState?.devModeEnabled) {
        const layoutWrapper = document.getElementById('btn-layout-wrapper');
        const layoutBtn = document.getElementById('btn-layout');
        if (layoutWrapper) {
            layoutWrapper.classList.remove('hidden');
            layoutWrapper.classList.remove('disabled');
        }
        if (layoutBtn) layoutBtn.classList.remove('disabled');
    }
}

/**
 * Sidebar 아이콘 비활성화 (하위 호환)
 */
function _disableSidebarIcons() {
    // Sidebar.js가 있으면 위임
    if (sidebarUI?.sidebar) {
        sidebarUI.sidebar._updateButtonStates?.();
        return;
    }
    
    // 폴백
    const icons = ['btn-monitoring', 'btn-analysis', 'btn-simulation', 'btn-layout'];
    const wrappers = ['btn-monitoring-wrapper', 'btn-layout-wrapper'];
    
    icons.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('disabled');
    });
    
    wrappers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('disabled');
    });
    
    if (!window.sidebarState?.devModeEnabled) {
        const debugWrapper = document.getElementById('btn-debug-wrapper');
        const debugBtn = document.getElementById('btn-debug');
        if (debugWrapper) debugWrapper.classList.add('disabled');
        if (debugBtn) debugBtn.classList.add('disabled');
    }
    
    document.querySelectorAll('#sidebar .icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

/**
 * Cover Screen 상태 업데이트 (하위 호환)
 */
function _updateCoverStatus(apiConnected, dbConnected, dbName) {
    // CoverScreen.js가 있으면 위임
    if (sidebarUI?.coverScreen) {
        sidebarUI.coverScreen.setApiConnected(apiConnected);
        sidebarUI.coverScreen.setDbConnected(dbConnected, dbName);
        return;
    }
    
    // 폴백
    const apiDot = document.getElementById('cover-api-dot');
    const apiStatus = document.getElementById('cover-api-status');
    const dbDot = document.getElementById('cover-db-dot');
    const dbStatus = document.getElementById('cover-db-status');
    
    if (apiDot) {
        apiDot.classList.toggle('connected', apiConnected);
        apiDot.classList.toggle('disconnected', !apiConnected);
    }
    if (apiStatus) {
        apiStatus.textContent = apiConnected ? 'Connected' : 'Disconnected';
    }
    
    if (dbDot) {
        dbDot.classList.toggle('connected', dbConnected);
        dbDot.classList.toggle('disconnected', !dbConnected);
    }
    if (dbStatus) {
        dbStatus.textContent = dbConnected ? (dbName || 'Connected') : 'Not Connected';
    }
}

/**
 * Status Bar 연결 상태 업데이트 (하위 호환)
 */
function _updateStatusBarConnection(apiConnected, dbConnected, siteId) {
    // StatusBar.js가 있으면 위임
    if (sidebarUI?.statusBar) {
        sidebarUI.statusBar.setApiConnected(apiConnected);
        sidebarUI.statusBar.setDbConnected(dbConnected, siteId);
        return;
    }
    
    // 폴백
    const apiDot = document.getElementById('api-dot') || document.getElementById('backend-dot');
    const apiValue = document.getElementById('api-value') || document.getElementById('backend-value');
    const dbDot = document.getElementById('db-dot');
    const dbValue = document.getElementById('db-value');
    
    if (apiDot) {
        apiDot.classList.toggle('connected', apiConnected);
        apiDot.classList.toggle('disconnected', !apiConnected);
    }
    if (apiValue) {
        apiValue.textContent = apiConnected ? 'Connected' : 'Disconnected';
    }
    
    if (dbDot) {
        dbDot.classList.toggle('connected', dbConnected);
        dbDot.classList.toggle('disconnected', !dbConnected);
    }
    if (dbValue) {
        dbValue.textContent = siteId 
            ? siteId.replace(/_/g, '-').toUpperCase() 
            : 'None';
    }
}

// ============================================
// 유틸리티
// ============================================

/**
 * 딜레이 유틸리티
 * @private
 */
function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🆕 v6.3.0: Phase 4 - 전역 객체 노출 (Scene 초기화 후)
 * 
 * migrateGlobalToNamespace() 사용으로 변경
 * USE_DEPRECATION_WARNINGS가 true면 Deprecation 래퍼 적용
 */
function _exposeGlobalObjectsAfterSceneInit() {
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
    
    // ═══════════════════════════════════════════════════════════════════
    // 1. APP 네임스페이스에 등록 (항상 수행)
    // ═══════════════════════════════════════════════════════════════════
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
    register('ui.sidebar', sidebarUI?.sidebar);
    register('ui.statusBar', sidebarUI?.statusBar);
    register('ui.coverScreen', sidebarUI?.coverScreen);
    
    register('utils.storageService', storageService);

    // ═══════════════════════════════════════════════════════════════════
    // 2. 🆕 Phase 4: window.* 전역 노출 (Deprecation 래퍼 적용)
    // ═══════════════════════════════════════════════════════════════════
    const globalObjects = {
        // Scene
        sceneManager,
        equipmentLoader,
        cameraControls,
        cameraNavigator,
        interactionHandler,
        dataOverlay,
        statusVisualizer,
        performanceMonitor,
        adaptivePerformance,
        
        // UI
        connectionModal,
        equipmentEditState,
        equipmentEditModal,
        equipmentEditButton,
        apiClient,
        toast,
        equipmentInfoPanel,
        
        // Connection
        connectionStatusService,
        connectionIndicator,
        
        // Monitoring
        monitoringService,
        signalTowerManager,
        
        // Mapping
        equipmentMappingService,

        // ViewManager
        bootstrapViewManager,
        VIEW_REGISTRY,
        getView,
        showView,
        hideView,
        toggleView,
        destroyView,

        // Core
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
        
        // View Manager
        viewManager,
        
        // Sidebar UI
        sidebarUI,     
        
        // 함수 노출
        toggleAdaptivePerformance,
        toggleEditMode,
        toggleMonitoringMode,
        toggleConnectionModal,
        toggleDebugPanel,
        toggleDevMode
    };
    
    // 🆕 Phase 4: migrateGlobalToNamespace() 사용
    const migrationResult = migrateGlobalToNamespace(globalObjects, {
        useDeprecation: USE_DEPRECATION_WARNINGS,
        pathMapping: LEGACY_MIGRATION_MAP,
        silent: false  // 로그 출력
    });
    
    console.log(`[main.js] Phase 4 Migration: deprecated=${migrationResult.deprecated}, exposed=${migrationResult.exposed}`);
}


// ============================================
// 메인 초기화
// ============================================

function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화 (v6.1.0 - Phase 2 전역 함수 마이그레이션)...');
    console.log(`📍 Site ID: ${SITE_ID}`);
    
    try {
        // ═══════════════════════════════════════════════════════════════
        // 🆕 v6.0.0: 네임스페이스 먼저 초기화 (가장 먼저!)
        // ═══════════════════════════════════════════════════════════════
        initNamespace()
        console.log('  ✅ AppNamespace 초기화 완료');

        // 🆕 v6.1.0: APP.state와 sidebarState 양방향 동기화
        if (window.APP && window.sidebarState) {
            // sidebarState의 기존 값을 APP.state로 복사
            Object.assign(window.APP.state, window.sidebarState);
            // sidebarState가 APP.state를 참조하도록 설정 (양방향 동기화)
            window.sidebarState = window.APP.state;
            console.log('  ✅ APP.state ↔ sidebarState 동기화 완료');
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🆕 v6.1.0: 전역 함수 APP.fn에 등록 (Phase 2)
        // ═══════════════════════════════════════════════════════════════════
        
        // UI 함수
        registerFn('ui', 'showToast', _showToast, 'showToast');
        registerFn('ui', 'toggleTheme', _toggleTheme, 'toggleTheme');
        registerFn('ui', 'closeConnectionModal', _closeConnectionModal, 'closeConnectionModal');
        registerFn('ui', 'canAccessFeatures', _canAccessFeatures, 'canAccessFeatures');
        
        console.log('  ✅ 전역 함수 APP.fn.ui 등록 완료');
        
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
        services.ui = initUIComponents({
            connectionOptions: {
                autoStart: false,
                debug: false
            }
        });
        console.log('  ✅ UI Components 초기화 완료');
        
        // 3. 🆕 v5.1.0: Sidebar UI 초기화 (동적 렌더링)
        initSidebarUI();

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
        
        // Camera 함수 (placeholder)
        registerFn('camera', 'moveTo', _createPlaceholder('fn.camera.moveTo'), 'moveCameraTo');
        registerFn('camera', 'focusEquipment', _createPlaceholder('fn.camera.focusEquipment'), 'focusEquipment');
        registerFn('camera', 'reset', _createPlaceholder('fn.camera.reset'), 'resetCamera');
        
        // Mapping 함수 (placeholder)
        registerFn('mapping', 'getStatus', _createPlaceholder('fn.mapping.getStatus'), 'getMappingStatus');
        registerFn('mapping', 'clearAll', _createPlaceholder('fn.mapping.clearAll'), 'clearAllMappings');
        registerFn('mapping', 'export', _createPlaceholder('fn.mapping.export'), 'exportMappings');
        
        // Layout 함수 (placeholder)
        registerFn('layout', 'applyTest', _createPlaceholder('fn.layout.applyTest'), 'applyTestLayout');
        registerFn('layout', 'testRoomResize', _createPlaceholder('fn.layout.testRoomResize'), 'testRoomResize');
        
        // Debug 함수 (placeholder)
        registerDebugFn('help', _createDebugPlaceholder('debugHelp'), 'debugHelp');
        registerDebugFn('scene', _createDebugPlaceholder('debugScene'), 'debugScene');
        registerDebugFn('listEquipments', _createDebugPlaceholder('listEquipments'), 'listEquipments');
        registerDebugFn('status', _createDebugPlaceholder('debugStatus'), 'debugStatus');
        
        console.log('  ✅ Placeholder 함수 등록 완료 (fn.camera, fn.mapping, fn.layout, debugFn)');
        console.log('     → 3D View 초기화 후 실제 함수로 교체됩니다');
        
        // 4. 🆕 v5.7.0: ViewManager 초기화
        services.views.viewManager = initViewManager({
            webSocketClient: null,
            apiClient: services.ui?.apiClient
        }, {
            initEager: false,
            registerToNamespace: false  // main.js에서 직접 등록
        });
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
        
        // 6. Connection 이벤트 설정 (🆕 v5.4.0: 재연결 핸들러 포함)
        setupConnectionEvents();
        
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
            viewManager,
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
            toggleDevMode
        }, {
            useDeprecation: USE_DEPRECATION_WARNINGS,
            pathMapping: LEGACY_MIGRATION_MAP
        });
        
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
// 애니메이션 루프
// ============================================

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    const { 
        cameraControls, 
        statusVisualizer, 
        sceneManager, 
        performanceMonitor,
        adaptivePerformance
    } = services.scene || {};
    const { signalTowerManager } = services.monitoring || {};
    
    if (cameraControls) {
        cameraControls.update();
    }
    
    if (statusVisualizer) {
        statusVisualizer.animateErrorStatus();
    }
    
    if (signalTowerManager) {
        signalTowerManager.animate(0.016);
    }
    
    if (sceneManager) {
        sceneManager.render();
    }
    
    if (performanceMonitor) {
        performanceMonitor.update();
    }
    
    if (adaptivePerformance) {
        adaptivePerformance.update();
    }
    
    if (performanceMonitorUI?.isVisible?.()) {
        performanceMonitorUI.recordFrame();
        if (sceneManager?.renderer) {
            performanceMonitorUI.setRenderInfo(sceneManager.renderer.info);
        }
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
    // 🆕 v5.4.0: 재연결 핸들러 정리
    if (reconnectionCleanup) {
        reconnectionCleanup();
        reconnectionCleanup = null;
    }
    
    // 🆕 v5.5.0: Mapping 서비스 정리
    if (services.mapping?.equipmentMappingService) {
        services.mapping.equipmentMappingService.clearCache();
        services.mapping.equipmentMappingService = null;
    }

        // 🆕 v5.7.0: ViewManager 정리
    if (bootstrapViewManager) {
        bootstrapViewManager.destroyAll();
        console.log('  🗑️ ViewManager 정리 완료');
    }

    // Equipment AutoSave 중지
    if (services.ui?.equipmentEditState) {
        services.ui.equipmentEditState.stopAutoSave();
    }
    
    // EquipmentInfoPanel 정리
    if (services.ui?.equipmentInfoPanel) {
        services.ui.equipmentInfoPanel.dispose();
    }
    
    // 애니메이션 중지
    screenManager.stopAnimation();
    
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