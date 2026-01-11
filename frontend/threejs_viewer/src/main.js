/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (Cleanroom Sidebar Theme 통합)
 * 
 * @version 5.1.0
 * @description createSidebarUI() 활성화, 중복 코드 제거
 * 
 * @changelog
 * - v5.1.0: 🔧 createSidebarUI() 활성화
 *           - Sidebar.js, StatusBar.js, CoverScreen.js 동적 렌더링
 *           - 기존 setupSidebarEvents() 제거 (중복 이벤트 해결)
 *           - index.html 인라인 스크립트와 충돌 해결
 * - v5.0.1: Settings 항상 활성화, Dev Mode 시 Connect 없이 사용 가능
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

// 🆕 v5.1.0: Sidebar UI 컴포넌트 import
import { createSidebarUI } from './ui/sidebar/index.js';

// ============================================
// 전역 상태
// ============================================
let animationFrameId;
let performanceMonitorUI;
let previewGenerator;

// 🆕 v5.1.0: Sidebar UI 인스턴스
let sidebarUI = null;

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
// View Manager (Cover/3D 전환)
// ============================================
const viewManager = {
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
            
            // 13. 로딩 상태 숨김
            hideLoadingStatus(1000);
            
            console.log('✅ Three.js 지연 초기화 완료');
            
        } catch (error) {
            console.error('❌ Three.js 초기화 실패:', error);
            toast?.show('3D View 초기화 실패', 'error');
        }
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
window.viewManager = viewManager;

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
// 접근 권한 체크 헬퍼
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
        toast?.show('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    appModeManager.toggleMode(APP_MODE.EQUIPMENT_EDIT);
    
    const currentMode = appModeManager.getCurrentMode();
    if (currentMode === APP_MODE.EQUIPMENT_EDIT) {
        if (!viewManager.threejsInitialized) {
            viewManager.show3DView();
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
        toast?.show('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    const prevMode = appModeManager.getCurrentMode();
    
    if (prevMode === APP_MODE.MONITORING && window.sidebarState?.currentSubMode === submode) {
        appModeManager.setMode(APP_MODE.VIEWER);
        viewManager.showCoverScreen();
        updateModeIndicator(null, null);
        return;
    }
    
    appModeManager.setMode(APP_MODE.MONITORING);
    
    if (submode === '3d-view') {
        viewManager.show3DView();
    } else {
        viewManager.showCoverScreen();
    }
    
    updateModeIndicator('Monitoring', submode);
    toast?.show(`Monitoring: ${submode}`, 'info');
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

/**
 * Debug Panel 토글
 */
function toggleDebugPanel() {
    if (!canAccessFeatures()) {
        toast?.show('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    bootstrapToggleDebugPanel();
    
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
        debugPanel.classList.toggle('active');
        window.sidebarState.debugPanelVisible = debugPanel.classList.contains('active');
    }
}

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
            toast?.show('⚡ Dev Mode ON', 'warning');
        } else {
            if (!window.sidebarState.isConnected) {
                _disableSidebarIcons();
            }
            toast?.show('Dev Mode OFF', 'info');
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
    } else {
        toast?.show('🛑 AdaptivePerformance OFF', 'info');
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
            if (!viewManager.threejsInitialized) {
                viewManager.show3DView();
            }
        });
        
        // Three.js 정지 요청 이벤트
        eventBus.on('threejs:stop-requested', () => {
            viewManager.stopAnimation();
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
// Connection 이벤트 설정
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
                toast?.show('Backend 연결 복구', 'success');
            }
        });
        
        connectionStatusService.onOffline(() => {
            console.log('[Connection] API Offline');
            
            // 🆕 v5.1.0: Sidebar.js가 자동으로 처리
            
            window.sidebarState.isConnected = false;
            toast?.show('Backend 연결 끊김', 'warning');
        });
    }
    
    // Site 연결 이벤트
    eventBus.on('site:connected', ({ siteId, siteName }) => {
        console.log(`[Connection] Site Connected: ${siteId}`);
        window.sidebarState.isConnected = true;
    });
    
    eventBus.on('site:disconnected', () => {
        console.log('[Connection] Site Disconnected');
        window.sidebarState.isConnected = false;
    });
    
    console.log('✅ Connection 이벤트 설정 완료');
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
            toast?.show('⚠️ Equipment AutoSave 실패', 'warning');
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
        
        // View Manager
        viewManager,
        
        // 🆕 v5.1.0: Sidebar UI
        sidebarUI,
        
        // 함수 노출
        toggleAdaptivePerformance,
        toggleEditMode,
        toggleMonitoringMode,
        toggleConnectionModal,
        toggleDebugPanel,
        toggleDevMode  // 🆕 v5.1.0: 하위 호환
    });
}

// ============================================
// 메인 초기화
// ============================================

function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화 (v5.1.0 - Sidebar UI 컴포넌트 활성화)...');
    console.log(`📍 Site ID: ${SITE_ID}`);
    
    try {
        // 1. Core 매니저 초기화
        initCoreManagers({ registerHandlers: true });
        console.log('  ✅ Core Managers 초기화 완료');
        
        // 2. UI 컴포넌트 초기화 (기존)
        services.ui = initUIComponents();
        console.log('  ✅ UI Components 초기화 완료');
        
        // 3. 🆕 v5.1.0: Sidebar UI 초기화 (동적 렌더링)
        initSidebarUI();
        
        // 4. EquipmentEditButton 연동
        if (services.ui?.equipmentEditButton) {
            connectEquipmentEditButton(services.ui.equipmentEditButton, toggleEditMode);
            console.log('  ✅ EquipmentEditButton 연동 완료');
        }
        
        // 5. Equipment AutoSave 초기화
        initEquipmentAutoSave(services.ui?.equipmentEditState);
        
        // 6. Connection 이벤트 설정
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
        exposeGlobalObjects({
            appModeManager,
            keyboardManager,
            debugManager,
            eventBus,
            logger,
            connectionModal: services.ui?.connectionModal,
            toast,
            equipmentInfoPanel: services.ui?.equipmentInfoPanel,
            connectionStatusService: services.ui?.connectionStatusService,
            storageService,
            viewManager,
            sidebarUI,
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel,
            toggleDevMode  // 🆕 v5.1.0: 하위 호환
        });
        
        // 10. 초기화 완료 이벤트
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode(),
            siteId: SITE_ID,
            version: '5.1.0'
        });
        
        // 11. 성능 업데이트 인터벌 (StatusBar.js가 자체 처리하므로 간소화)
        setInterval(() => {
            if (window.sidebarState?.debugPanelVisible) {
                _updateDebugPanelContent();
            }
        }, 2000);
        
        console.log('');
        console.log('✅ 모든 초기화 완료! (v5.1.0 - Sidebar UI 컴포넌트 활성화)');
        console.log('');
        console.log('📺 Cover Screen 표시 중 (CoverScreen.js)');
        console.log('🎨 Sidebar 렌더링 완료 (Sidebar.js)');
        console.log('📊 StatusBar 렌더링 완료 (StatusBar.js)');
        console.log('');
        console.log('💡 키보드 단축키:');
        console.log('   Ctrl+K - Connection Modal');
        console.log('   D - Debug Panel');
        console.log('   E - Equipment Edit Mode');
        console.log('   M - Monitoring Mode (3D View)');
        console.log('');
        
    } catch (error) {
        console.error('❌ 초기화 중 오류 발생:', error);
        console.error('스택:', error.stack);
        showInitError(error);
    }
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