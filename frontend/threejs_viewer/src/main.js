/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (리팩토링 버전)
 * 
 * @version 3.3.0
 * @description Phase 4-1 + Equipment Edit Button 연동
 * 
 * @changelog
 * - v3.3.0: EquipmentEditButton 연동, ConnectionStatus 체크 추가
 * 
 * 위치: frontend/threejs_viewer/src/main.js
 */

// ============================================
// Bootstrap 모듈 import
// ============================================
import {
    // Core
    initCoreManagers,
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
    toggleDebugPanel,
    toast,
    connectEquipmentEditButton,  // 🆕 추가
    
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

// ============================================
// 모드 토글 함수
// ============================================

function toggleEditMode() {
    const currentMode = appModeManager.getCurrentMode();
    
    if (currentMode === APP_MODE.EQUIPMENT_EDIT) {
        appModeManager.switchMode(APP_MODE.MAIN_VIEWER);
        if (services.ui?.equipmentEditState) {
            services.ui.equipmentEditState.disableEditMode();
        }
        updateButtonState('editBtn', false);
        
        // 🆕 EquipmentEditButton 상태 동기화
        if (services.ui?.equipmentEditButton) {
            services.ui.equipmentEditButton.setEditModeActive(false);
        }
    } else {
        appModeManager.switchMode(APP_MODE.EQUIPMENT_EDIT);
        if (services.ui?.equipmentEditState) {
            services.ui.equipmentEditState.enableEditMode();
        }
        updateButtonState('editBtn', true);
        
        // 🆕 EquipmentEditButton 상태 동기화
        if (services.ui?.equipmentEditButton) {
            services.ui.equipmentEditButton.setEditModeActive(true);
        }
    }
}

function toggleMonitoringMode() {
    const currentMode = appModeManager.getCurrentMode();
    
    if (currentMode === APP_MODE.MONITORING) {
        appModeManager.switchMode(APP_MODE.MAIN_VIEWER);
        updateButtonState('monitoringBtn', false);
    } else {
        appModeManager.switchMode(APP_MODE.MONITORING);
        updateButtonState('monitoringBtn', true);
    }
}

function toggleConnectionModal() {
    if (services.ui?.connectionModal) {
        services.ui.connectionModal.toggle();
        updateButtonState('connectionBtn', services.ui.connectionModal.isOpen);
    }
}

function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.toggle('active', isActive);
    }
}

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
// 메인 초기화
// ============================================

function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화...');
    
    try {
        // 1. Core 매니저 초기화
        initCoreManagers({ monitoringService: null });
        
        // 2. 3D 씬 초기화
        services.scene = initScene();
        
        // 3. UI 컴포넌트 초기화 (🔄 toggleEditMode 전달하지 않음 - 나중에 연결)
        services.ui = initUIComponents();
        
        // 4. Monitoring 서비스 초기화
        services.monitoring = initMonitoringServices(
            services.scene.sceneManager.scene,
            services.scene.equipmentLoader,
            services.ui.equipmentEditState,
            services.ui.connectionStatusService  // 🆕 ConnectionStatusService 전달
        );
        
        // Core 매니저에 monitoringService 재등록
        initCoreManagers({ monitoringService: services.monitoring.monitoringService });
        
        // 5. InteractionHandler 연결
        const { interactionHandler, sceneManager, equipmentLoader } = services.scene;
        const { equipmentEditState, equipmentEditModal, equipmentEditButton } = services.ui;
        
        interactionHandler.setEditMode(equipmentEditState);
        interactionHandler.setEditModal(equipmentEditModal);
        interactionHandler.setMonitoringService(services.monitoring.monitoringService);
        
        // 🆕 6. EquipmentEditButton 연동
        connectEquipmentEditButton(equipmentEditButton, toggleEditMode);
        
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
            sceneManager,
            connectionModal: services.ui.connectionModal,
            updateConnectionButtonState: () => updateButtonState('connectionBtn', services.ui.connectionModal?.isOpen)
        };
        
        setupUIEventListeners(eventHandlers);
        setupKeyboardShortcuts(eventHandlers);
        setupEditModeEventListeners({
            interactionHandler,
            equipmentLoader,
            equipmentEditState
        });
        setupLayoutEventListeners({
            sceneManager,
            equipmentLoader,
            interactionHandler,
            statusVisualizer: services.scene.statusVisualizer,
            signalTowerManager: services.monitoring.signalTowerManager
        });
        
        // 8. LayoutEditorMain 연결
        setupLayoutEditorMainConnection(sceneManager);
        
        // 9. PreviewGenerator 초기화
        previewGenerator = initPreviewGenerator();
        
        // 10. 전역 디버그 함수 설정
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
        
        // 11. 애니메이션 시작
        animate();
        
        // 12. 전역 객체 노출
        exposeGlobalObjects({
            // Scene
            sceneManager,
            equipmentLoader,
            cameraControls: services.scene.cameraControls,
            cameraNavigator: services.scene.cameraNavigator,
            interactionHandler,
            dataOverlay: services.scene.dataOverlay,
            statusVisualizer: services.scene.statusVisualizer,
            performanceMonitor: services.scene.performanceMonitor,
            adaptivePerformance: services.scene.adaptivePerformance,
            
            // UI
            connectionModal: services.ui.connectionModal,
            equipmentEditState,
            equipmentEditModal,
            equipmentEditButton,  // 🆕 추가
            apiClient: services.ui.apiClient,
            toast,
            
            // Connection Status 🆕
            connectionStatusService: services.ui.connectionStatusService,
            connectionIndicator: services.ui.connectionIndicator,
            
            // Monitoring
            monitoringService: services.monitoring.monitoringService,
            signalTowerManager: services.monitoring.signalTowerManager,
            
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
            
            // 함수 노출
            toggleAdaptivePerformance,
            toggleEditMode  // 🆕 추가
        });
        
        // 13. 초기화 완료
        hideLoadingStatus(3000);
        
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode()
        });
        
        if (CONFIG.DEBUG_MODE) {
            setTimeout(() => {
                memoryManager.logMemoryInfo(sceneManager.renderer);
            }, 1000);
        }
        
        console.log('✅ 모든 초기화 완료!');
        console.log('💡 콘솔에서 debugHelp() 입력으로 사용 가능한 명령어 확인');
        console.log('💡 키보드 단축키: D=디버그, P=성능, H=헬퍼, G=그리드, M=모니터링, E=편집');
        console.log('💡 AdaptivePerformance: toggleAdaptivePerformance() 또는 A키로 ON/OFF');
        console.log('💡 Equipment Edit: Backend 연결 시에만 E키 또는 버튼 사용 가능');
        
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
        equipmentEditButton: services.ui?.equipmentEditButton,  // 🆕 추가
        connectionModal: services.ui?.connectionModal,
        equipmentEditModal: services.ui?.equipmentEditModal
    });
}

window.addEventListener('beforeunload', handleCleanup);

// ============================================
// 초기화 실행
// ============================================
init();