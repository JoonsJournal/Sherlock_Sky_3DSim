/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (Cleanroom Sidebar Theme 통합)
 * 
 * @version 5.0.0
 * @description Cover Screen 기반 UI, Three.js 지연 초기화, Sidebar 통합
 * 
 * @changelog
 * - v5.0.0: 🆕 Cleanroom Sidebar Theme 통합
 *           - Cover Screen 기본 표시 (연결 전)
 *           - Three.js 지연 초기화 (show3DView() 시점)
 *           - Sidebar 컴포넌트 연동 (동적 또는 정적)
 *           - StatusBar 실시간 FPS/MEM 업데이트
 *           - 기존 기능 100% 보존
 * - v4.2.0: MonitoringService ↔ EquipmentInfoPanel 연결 추가
 * - v4.1.0: EquipmentInfoPanel ↔ DataOverlay 연결 추가
 * - v4.0.0: 중앙 집중식 모드 관리, AppModeManager.toggleMode() 사용
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
    
    // Events
    setupUIEventListeners,
    setupKeyboardShortcuts,
    setupEditModeEventListeners,
    setupLayoutEventListeners,
    setupLayoutEditorMainConnection,
    initPreviewGenerator,
    
    // Cleanup
    cleanup
} from './bootstrap/index.js';

// Utils
import { CONFIG } from './core/utils/Config.js';
import { memoryManager } from './core/utils/MemoryManager.js';
import { setupGlobalDebugFunctions, exposeGlobalObjects } from './core/utils/GlobalDebugFunctions.js';

// Layout 관련
import { layout2DTo3DConverter } from './services/converter/Layout2DTo3DConverter.js';
import { roomParamsAdapter } from './services/converter/RoomParamsAdapter.js';

// Storage Service import
import { storageService } from './core/storage/index.js';

// ============================================
// 전역 상태
// ============================================
let animationFrameId;
let performanceMonitorUI;
let previewGenerator;

// 서비스 객체 저장소
const services = {
    scene: null,
    ui: null,
    monitoring: null
};

// Site ID (URL 파라미터 또는 기본값)
const urlParams = new URLSearchParams(window.location.search);
const SITE_ID = urlParams.get('siteId') || 'default_site';

// ============================================
// 🆕 v5.0.0: 전역 상태 (Sidebar용)
// ============================================
// index.html의 sidebarState와 동기화
window.sidebarState = window.sidebarState || {
    currentMode: null,
    currentSubMode: null,
    isConnected: false,
    devModeEnabled: false,
    debugPanelVisible: false
};

// ============================================
// 🆕 v5.0.0: View Manager (Cover/3D 전환)
// ============================================
const viewManager = {
    threejsInitialized: false,
    animationRunning: false,
    
    /**
     * Cover Screen 표시 (기본 상태)
     */
    showCoverScreen() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        
        if (coverScreen) coverScreen.classList.remove('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'none';
        
        this.stopAnimation();
        
        // 모드 인디케이터 초기화
        updateModeIndicator(null, null);
        
        console.log('📺 Cover Screen 표시');
    },
    
    /**
     * 3D View 표시 + Three.js 초기화
     */
    show3DView() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        
        if (coverScreen) coverScreen.classList.add('hidden');
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
     * 기존 initScene() 재사용
     */
    _initThreeJS() {
        try {
            // 1. 3D 씬 초기화 (기존 함수 사용)
            services.scene = initScene();
            console.log('  ✅ 3D Scene 초기화 완료');
            
            // 2. Monitoring 서비스 초기화
            services.monitoring = initMonitoringServices(
                services.scene.sceneManager.scene,
                services.scene.equipmentLoader,
                services.ui?.equipmentEditState,
                services.ui?.connectionStatusService
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
            
            // AppModeManager 연결
            interactionHandler.setAppModeManager(appModeManager);
            
            // 레거시 호환용 연결
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
            
            // 13. 로딩 상태 숨김
            hideLoadingStatus(1000);
            
            console.log('✅ Three.js 지연 초기화 완료');
            
        } catch (error) {
            console.error('❌ Three.js 초기화 실패:', error);
            toast?.show('3D View 초기화 실패', 'error');
        }
    },
    
    /**
     * 애니메이션 시작
     */
    startAnimation() {
        if (!this.animationRunning && services.scene) {
            this.animationRunning = true;
            animate();
            console.log('▶️ 애니메이션 시작');
        }
    },
    
    /**
     * 애니메이션 중지
     */
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
window.viewManager = viewManager;

// ============================================
// 🆕 v5.0.0: Mode Indicator 업데이트
// ============================================

/**
 * 모드 인디케이터 UI 업데이트
 * @param {string|null} mode - 현재 모드
 * @param {string|null} submode - 현재 서브모드
 */
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
    
    // 전역 상태 업데이트
    window.sidebarState.currentMode = mode;
    window.sidebarState.currentSubMode = submode;
}

// ============================================
// 모드 토글 함수 (기존 유지 + 확장)
// ============================================

/**
 * Equipment Edit 모드 토글
 * AppModeManager.toggleMode() 사용 - 핸들러가 자동 처리
 */
function toggleEditMode() {
    appModeManager.toggleMode(APP_MODE.EQUIPMENT_EDIT);
    
    const currentMode = appModeManager.getCurrentMode();
    if (currentMode === APP_MODE.EQUIPMENT_EDIT) {
        // Edit 모드 진입 시 3D View 표시 필요
        if (!viewManager.threejsInitialized) {
            viewManager.show3DView();
        }
        updateModeIndicator('Edit', 'Equipment');
        _updateSidebarButtonState('edit');
    } else {
        updateModeIndicator(null, null);
        _updateSidebarButtonState(null);
    }
}

/**
 * 🆕 v5.0.0: Monitoring 모드 토글 (확장)
 * @param {string} submode - 서브모드 ('3d-view', 'ranking-view' 등)
 */
function toggleMonitoringMode(submode = '3d-view') {
    const prevMode = appModeManager.getCurrentMode();
    
    // 이미 Monitoring 모드이고 같은 서브모드면 토글 OFF
    if (prevMode === APP_MODE.MONITORING && window.sidebarState?.currentSubMode === submode) {
        appModeManager.setMode(APP_MODE.VIEWER);
        viewManager.showCoverScreen();
        updateModeIndicator(null, null);
        _updateSidebarButtonState(null);
        return;
    }
    
    // Monitoring 모드 진입
    appModeManager.setMode(APP_MODE.MONITORING);
    
    if (submode === '3d-view') {
        viewManager.show3DView();
    } else {
        // 다른 서브모드는 Cover Screen 유지 또는 별도 View
        viewManager.showCoverScreen();
    }
    
    updateModeIndicator('Monitoring', submode);
    _updateSidebarButtonState('monitoring');
    _updateSubmenuActiveState('monitoring', submode);
    
    toast?.show(`Monitoring: ${submode}`, 'info');
}

/**
 * Connection Modal 토글 (기존 유지)
 */
function toggleConnectionModal() {
    if (services.ui?.connectionModal) {
        services.ui.connectionModal.toggle();
        updateButtonState('connectionBtn', services.ui.connectionModal.isOpen);
    }
    
    // 새 Connection Modal도 토글 (index.html v5.0.0)
    const modal = document.getElementById('connection-modal');
    if (modal) {
        modal.classList.toggle('active');
    }
}

/**
 * 🆕 v5.0.0: Debug Panel 토글 (확장)
 */
function toggleDebugPanel() {
    // 기존 bootstrap의 toggleDebugPanel 호출
    bootstrapToggleDebugPanel();
    
    // 새 Debug Panel도 토글
    const newDebugPanel = document.getElementById('debug-panel');
    if (newDebugPanel) {
        newDebugPanel.classList.toggle('active');
        window.sidebarState.debugPanelVisible = newDebugPanel.classList.contains('active');
        
        // Debug Panel 내용 업데이트
        if (window.sidebarState.debugPanelVisible) {
            _updateDebugPanelContent();
        }
    }
}

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
        toast?.show('AdaptivePerformance 미초기화', 'warning');
        return false;
    }
    
    if (!adaptivePerformance.enabled) {
        console.warn('⚠️ AdaptivePerformance가 Feature Flag로 비활성화되어 있습니다');
        toast?.show('AdaptivePerformance Feature Flag 비활성화', 'warning');
        return false;
    }
    
    const newState = !adaptivePerformance.adjustmentEnabled;
    adaptivePerformance.setEnabled(newState);
    
    updateButtonState('adaptiveBtn', newState);
    
    if (newState) {
        toast?.show('✅ AdaptivePerformance ON', 'success');
        console.log('✅ AdaptivePerformance ON - 자동 품질 조정 활성화');
    } else {
        toast?.show('🛑 AdaptivePerformance OFF', 'info');
        console.log('🛑 AdaptivePerformance OFF - 자동 품질 조정 비활성화');
    }
    
    return newState;
}

// ============================================
// 🆕 v5.0.0: Sidebar UI 헬퍼 함수
// ============================================

/**
 * Sidebar 버튼 선택 상태 업데이트
 */
function _updateSidebarButtonState(mode) {
    document.querySelectorAll('#sidebar .icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    if (mode) {
        const btn = document.getElementById(`btn-${mode}`);
        if (btn) btn.classList.add('selected');
    }
}

/**
 * Submenu 활성 상태 업데이트
 */
function _updateSubmenuActiveState(mode, submode) {
    const submenu = document.getElementById(`${mode}-submenu`);
    if (!submenu) return;
    
    submenu.querySelectorAll('.submenu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.submode === submode);
    });
}

/**
 * Sidebar 아이콘 활성화
 */
function _enableSidebarIcons() {
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
    
    // Debug 버튼 활성화
    const debugBtn = document.getElementById('btn-debug');
    if (debugBtn) debugBtn.classList.remove('disabled');
    
    // Dev Mode인 경우 Layout 버튼도 활성화
    if (window.sidebarState?.devModeEnabled) {
        const layoutWrapper = document.getElementById('btn-layout-wrapper');
        const layoutBtn = document.getElementById('btn-layout');
        if (layoutWrapper) layoutWrapper.classList.remove('disabled');
        if (layoutBtn) layoutBtn.classList.remove('disabled');
    }
}

/**
 * Sidebar 아이콘 비활성화
 */
function _disableSidebarIcons() {
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
    
    // Dev Mode가 아니면 Debug도 비활성화
    if (!window.sidebarState?.devModeEnabled) {
        const debugWrapper = document.getElementById('btn-debug-wrapper');
        const debugBtn = document.getElementById('btn-debug');
        if (debugWrapper) debugWrapper.classList.add('disabled');
        if (debugBtn) debugBtn.classList.add('disabled');
    }
    
    // 선택 상태 초기화
    document.querySelectorAll('#sidebar .icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

/**
 * Cover Screen 상태 업데이트
 */
function _updateCoverStatus(apiConnected, dbConnected, dbName) {
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
    
    // index.html의 updateCoverStatus 함수도 호출 (있으면)
    if (typeof window.updateCoverStatus === 'function') {
        window.updateCoverStatus(apiConnected, dbConnected, dbName);
    }
}

/**
 * Status Bar 연결 상태 업데이트
 */
function _updateStatusBarConnection(apiConnected, dbConnected, siteId) {
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
    
    // index.html의 updateStatusBar 함수도 호출 (있으면)
    if (typeof window.updateStatusBar === 'function') {
        window.updateStatusBar(apiConnected, dbConnected, siteId);
    }
}

/**
 * Debug Panel 내용 업데이트
 */
function _updateDebugPanelContent() {
    const currentMode = appModeManager?.getCurrentMode();
    
    const debugMode = document.getElementById('debug-mode');
    const debugSubmode = document.getElementById('debug-submode');
    const debugConnected = document.getElementById('debug-connected');
    const debugDevmode = document.getElementById('debug-devmode');
    const debug3d = document.getElementById('debug-3d');
    const debugTime = document.getElementById('debug-time');
    const debugMemory = document.getElementById('debug-memory');
    
    if (debugMode) debugMode.textContent = currentMode || 'N/A';
    if (debugSubmode) debugSubmode.textContent = window.sidebarState?.currentSubMode || 'N/A';
    
    if (debugConnected) {
        const isConnected = window.sidebarState?.isConnected || false;
        debugConnected.textContent = isConnected ? 'YES' : 'NO';
        debugConnected.className = `debug-state-value ${isConnected ? 'on' : 'off'}`;
    }
    
    if (debugDevmode) {
        const devMode = window.sidebarState?.devModeEnabled || false;
        debugDevmode.textContent = devMode ? 'ON' : 'OFF';
        debugDevmode.className = `debug-state-value ${devMode ? 'on' : 'off'}`;
    }
    
    if (debug3d) {
        const is3dActive = viewManager.threejsInitialized && viewManager.animationRunning;
        debug3d.textContent = is3dActive ? 'YES' : 'NO';
        debug3d.className = `debug-state-value ${is3dActive ? 'on' : 'off'}`;
    }
    
    if (debugTime) debugTime.textContent = new Date().toLocaleTimeString();
    
    if (debugMemory && performance.memory) {
        debugMemory.textContent = `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`;
    }
}

// ============================================
// 🆕 v5.0.0: Connection 이벤트 설정
// ============================================

/**
 * Connection 관련 이벤트 설정
 */
function setupConnectionEvents() {
    console.log('🔌 Connection 이벤트 설정 시작...');
    
    const connectionStatusService = services.ui?.connectionStatusService;
    
    // API 연결 상태 변경
    if (connectionStatusService) {
        connectionStatusService.onOnline((data) => {
            console.log('[Connection] API Online:', data);
            
            _updateCoverStatus(true, false, null);
            _updateStatusBarConnection(true, false, null);
            
            if (data.recoveredAfter > 0) {
                toast?.show('Backend 연결 복구', 'success');
            }
        });
        
        connectionStatusService.onOffline(() => {
            console.log('[Connection] API Offline');
            
            viewManager.showCoverScreen();
            _disableSidebarIcons();
            _updateCoverStatus(false, false, null);
            _updateStatusBarConnection(false, false, null);
            
            window.sidebarState.isConnected = false;
            
            toast?.show('Backend 연결 끊김', 'warning');
        });
    }
    
    // Site 연결 이벤트 (eventBus)
    eventBus.on('site:connected', ({ siteId, siteName }) => {
        console.log(`[Connection] Site Connected: ${siteId}`);
        
        _enableSidebarIcons();
        _updateCoverStatus(true, true, siteName || siteId);
        _updateStatusBarConnection(true, true, siteId);
        
        window.sidebarState.isConnected = true;
    });
    
    eventBus.on('site:disconnected', () => {
        console.log('[Connection] Site Disconnected');
        
        viewManager.showCoverScreen();
        _disableSidebarIcons();
        _updateCoverStatus(true, false, null);
        _updateStatusBarConnection(true, false, null);
        
        window.sidebarState.isConnected = false;
    });
    
    // Connection Modal 이벤트
    eventBus.on('connectionModal:opened', () => {
        const modal = document.getElementById('connection-modal');
        if (modal) modal.classList.add('active');
    });
    
    eventBus.on('connectionModal:closed', () => {
        const modal = document.getElementById('connection-modal');
        if (modal) modal.classList.remove('active');
    });
    
    console.log('✅ Connection 이벤트 설정 완료');
}

// ============================================
// 🆕 v5.0.0: Sidebar 이벤트 설정
// ============================================

/**
 * Sidebar 클릭 이벤트 설정
 */
function setupSidebarEvents() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    // Monitoring 버튼 클릭 (submenu-item)
    sidebar.addEventListener('click', (e) => {
        const submenuItem = e.target.closest('.submenu-item');
        if (submenuItem && !submenuItem.classList.contains('disabled')) {
            const submode = submenuItem.dataset.submode;
            const wrapper = submenuItem.closest('.has-submenu');
            const mode = wrapper?.querySelector('.icon-btn')?.dataset?.mode;
            
            if (mode && submode) {
                handleSidebarModeChange(mode, submode);
            }
            return;
        }
        
        // Connection 버튼 클릭
        if (e.target.closest('#btn-connection')) {
            toggleConnectionModal();
            return;
        }
    });
    
    console.log('✅ Sidebar 이벤트 설정 완료');
}

/**
 * Sidebar 모드 변경 핸들러
 */
function handleSidebarModeChange(mode, submode) {
    console.log(`🔄 Sidebar 모드 변경: ${mode} → ${submode}`);
    
    switch (mode) {
        case 'monitoring':
            toggleMonitoringMode(submode);
            break;
        case 'layout':
            if (submode === 'layout-editor') {
                toast?.show('Layout Editor 열기', 'info');
            } else if (submode === 'mapping') {
                if (services.ui?.equipmentEditModal) {
                    services.ui.equipmentEditModal.open();
                }
            }
            updateModeIndicator('Layout', submode);
            _updateSidebarButtonState('layout');
            break;
        default:
            updateModeIndicator(mode, submode);
    }
}

// ============================================
// Equipment AutoSave 관련 (기존 유지)
// ============================================

function showEquipmentRecoveryDialog(recoveryData) {
    const autoSaveMeta = recoveryData._autoSave;
    const savedAt = autoSaveMeta?.savedAt ? new Date(autoSaveMeta.savedAt) : new Date();
    const mappingCount = recoveryData.mappingCount || Object.keys(recoveryData.mappings || {}).length;
    
    // 시간 경과 계산
    const diffMs = Date.now() - savedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    let timeAgo = '방금 전';
    if (diffMins >= 60) {
        timeAgo = `${diffHours}시간 전`;
    } else if (diffMins >= 1) {
        timeAgo = `${diffMins}분 전`;
    }
    
    // 다이얼로그 생성
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
    
    // 이벤트 핸들러
    document.getElementById('recovery-apply-btn').onclick = () => {
        if (services.ui?.equipmentEditState) {
            services.ui.equipmentEditState.applyAutoSaveRecovery(recoveryData);
            services.ui.equipmentEditState.clearAutoSaveRecovery(storageService);
            toast?.show('✅ Equipment 매핑 복구 완료!', 'success');
        }
        dialog.remove();
    };
    
    document.getElementById('recovery-discard-btn').onclick = () => {
        if (services.ui?.equipmentEditState) {
            services.ui.equipmentEditState.clearAutoSaveRecovery(storageService);
            toast?.show('AutoSave 데이터 삭제됨', 'info');
        }
        dialog.remove();
    };
}

function initEquipmentAutoSave(equipmentEditState) {
    if (!equipmentEditState) {
        console.warn('[main.js] EquipmentEditState가 없습니다. AutoSave 건너뜀.');
        return;
    }
    
    // 1. 복구 데이터 확인
    const recoveryData = equipmentEditState.checkAutoSaveRecovery(storageService);
    
    if (recoveryData) {
        showEquipmentRecoveryDialog(recoveryData);
    }
    
    // 2. AutoSave 초기화
    equipmentEditState.initAutoSave(storageService, SITE_ID);
    
    // 3. AutoSave 이벤트 구독
    eventBus.on('autosave:complete', (data) => {
        if (data.namespace === 'equipment') {
            console.log('[Equipment AutoSave] 저장 완료:', data.timestamp);
        }
    });
    
    eventBus.on('autosave:error', (data) => {
        if (data.namespace === 'equipment') {
            console.error('[Equipment AutoSave] 저장 실패:', data.error);
            toast?.show('⚠️ Equipment AutoSave 실패', 'warning');
        }
    });
    
    console.log(`✅ Equipment AutoSave 초기화 완료 - siteId: ${SITE_ID}`);
}

// ============================================
// 전역 객체 노출 (Scene 초기화 후)
// ============================================

function _exposeGlobalObjectsAfterSceneInit() {
    const { sceneManager, equipmentLoader, cameraControls, cameraNavigator, interactionHandler, dataOverlay, statusVisualizer, performanceMonitor, adaptivePerformance } = services.scene || {};
    const { connectionModal, equipmentEditState, equipmentEditModal, equipmentEditButton, apiClient, equipmentInfoPanel, connectionStatusService, connectionIndicator } = services.ui || {};
    const { monitoringService, signalTowerManager } = services.monitoring || {};
    
    exposeGlobalObjects({
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
        
        // Connection Status
        connectionStatusService,
        connectionIndicator,
        
        // Monitoring
        monitoringService,
        signalTowerManager,
        
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
        
        // 🆕 v5.0.0: View Manager
        viewManager,
        
        // 함수 노출
        toggleAdaptivePerformance,
        toggleEditMode,
        toggleMonitoringMode,
        toggleConnectionModal,
        toggleDebugPanel
    });
}

// ============================================
// 메인 초기화
// ============================================

function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화 (v5.0.0 - Cleanroom Sidebar Theme)...');
    console.log(`📍 Site ID: ${SITE_ID}`);
    
    try {
        // 1. Core 매니저 초기화 (모드 핸들러 등록)
        initCoreManagers({ registerHandlers: true });
        console.log('  ✅ Core Managers 초기화 완료');
        
        // 2. UI 컴포넌트 초기화 (Scene 전에 먼저!)
        services.ui = initUIComponents();
        console.log('  ✅ UI Components 초기화 완료');
        
        // 3. EquipmentEditButton 연동
        if (services.ui?.equipmentEditButton) {
            connectEquipmentEditButton(services.ui.equipmentEditButton, toggleEditMode);
            console.log('  ✅ EquipmentEditButton 연동 완료');
        }
        
        // 4. Equipment AutoSave 초기화
        initEquipmentAutoSave(services.ui?.equipmentEditState);
        
        // 5. 🆕 Connection 이벤트 설정
        setupConnectionEvents();
        
        // 6. 🆕 Sidebar 이벤트 설정
        setupSidebarEvents();
        
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
            sceneManager: null, // Scene 초기화 전
            connectionModal: services.ui?.connectionModal,
            updateConnectionButtonState: () => updateButtonState('connectionBtn', services.ui?.connectionModal?.isOpen)
        };
        
        setupUIEventListeners(eventHandlers);
        setupKeyboardShortcuts(eventHandlers);
        
        // 8. 🆕 Cover Screen 표시 (기본 상태)
        viewManager.showCoverScreen();
        
        // ❌ initScene() 제거 - show3DView()에서 지연 호출
        // ❌ animate() 제거 - show3DView()에서 시작
        
        // 9. 초기 전역 객체 노출 (Scene 없이)
        exposeGlobalObjects({
            // Core
            appModeManager,
            keyboardManager,
            debugManager,
            eventBus,
            logger,
            
            // UI
            connectionModal: services.ui?.connectionModal,
            toast,
            equipmentInfoPanel: services.ui?.equipmentInfoPanel,
            connectionStatusService: services.ui?.connectionStatusService,
            
            // Storage
            storageService,
            
            // 🆕 v5.0.0
            viewManager,
            
            // 함수 노출
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel
        });
        
        // 10. 초기화 완료 이벤트
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode(),
            siteId: SITE_ID,
            version: '5.0.0'
        });
        
        // 11. FPS/Memory 업데이트 인터벌 (StatusBar용)
        setInterval(() => {
            const fpsValue = document.getElementById('fps-value');
            const memValue = document.getElementById('memory-value');
            
            if (fpsValue) {
                // 실제 FPS는 PerformanceMonitor에서 가져옴 (3D View 활성화 시)
                const fps = services.scene?.performanceMonitor?.getFPS?.() || (viewManager.animationRunning ? 60 : 0);
                fpsValue.textContent = Math.round(fps);
            }
            
            if (memValue && performance.memory) {
                memValue.textContent = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            }
            
            // Debug Panel 업데이트
            if (window.sidebarState?.debugPanelVisible) {
                _updateDebugPanelContent();
            }
        }, 2000);
        
        console.log('');
        console.log('✅ 모든 초기화 완료! (v5.0.0 - Cleanroom Sidebar Theme)');
        console.log('');
        console.log('📺 Cover Screen 표시 중 - Database 연결 후 Monitoring → 3D View 선택');
        console.log('');
        console.log('💡 키보드 단축키:');
        console.log('   Ctrl+K - Connection Modal');
        console.log('   D - Debug Panel');
        console.log('   E - Equipment Edit Mode');
        console.log('   M - Monitoring Mode (3D View)');
        console.log('   ESC - 모달/패널 닫기');
        console.log('');
        console.log('💡 콘솔에서 debugHelp() 입력으로 사용 가능한 명령어 확인');
        
    } catch (error) {
        console.error('❌ 초기화 중 오류 발생:', error);
        console.error('스택:', error.stack);
        showInitError(error);
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
    // Equipment AutoSave 중지
    if (services.ui?.equipmentEditState) {
        services.ui.equipmentEditState.stopAutoSave();
    }
    
    // EquipmentInfoPanel 정리
    if (services.ui?.equipmentInfoPanel) {
        services.ui.equipmentInfoPanel.dispose();
    }
    
    // 애니메이션 중지
    viewManager.stopAnimation();
    
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