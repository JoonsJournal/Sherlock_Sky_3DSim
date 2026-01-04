/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (리팩토링 버전)
 * 
 * @version 3.1.0
 * @description Phase 4-1 - PerformanceMonitor & AdaptivePerformance 연결 완료
 * 
 * 역할: 오케스트레이션만 담당
 * - Bootstrap 모듈들 호출
 * - 애니메이션 루프
 * - 전역 객체 관리
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
    } else {
        appModeManager.switchMode(APP_MODE.EQUIPMENT_EDIT);
        if (services.ui?.equipmentEditState) {
            services.ui.equipmentEditState.enableEditMode();
        }
        updateButtonState('editBtn', true);
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
// ⭐ AdaptivePerformance ON/OFF 토글
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
    
    // ON/OFF 토글
    const newState = !adaptivePerformance.adjustmentEnabled;
    adaptivePerformance.setEnabled(newState);
    
    // 버튼 상태 업데이트
    updateButtonState('adaptiveBtn', newState);
    
    // 토스트 알림
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
        
        // 3. UI 컴포넌트 초기화
        services.ui = initUIComponents();
        
        // 4. Monitoring 서비스 초기화
        services.monitoring = initMonitoringServices(
            services.scene.sceneManager.scene,
            services.scene.equipmentLoader,
            services.ui.equipmentEditState
        );
        
        // Core 매니저에 monitoringService 재등록
        initCoreManagers({ monitoringService: services.monitoring.monitoringService });
        
        // 5. InteractionHandler 연결
        const { interactionHandler, sceneManager, equipmentLoader } = services.scene;
        const { equipmentEditState, equipmentEditModal } = services.ui;
        
        interactionHandler.setEditMode(equipmentEditState);
        interactionHandler.setEditModal(equipmentEditModal);
        
        // 6. 이벤트 리스너 설정
        const eventHandlers = {
            toggleEditMode,
            toggleMonitoringMode,
            toggleConnectionModal,
            toggleDebugPanel,
            toggleAdaptivePerformance,  // ⭐ 추가
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
        
        // 7. LayoutEditorMain 연결
        setupLayoutEditorMainConnection(sceneManager);
        
        // 8. PreviewGenerator 초기화
        previewGenerator = initPreviewGenerator();
        
        // 9. 전역 디버그 함수 설정
        setupGlobalDebugFunctions({
            sceneManager,
            equipmentLoader,
            cameraNavigator: services.scene.cameraNavigator,
            equipmentEditState,
            toggleEditMode,
            toggleMonitoringMode
        });
        
        // ⭐ AdaptivePerformance 전역 명령어 설정
        if (services.scene.adaptivePerformance) {
            services.scene.adaptivePerformance.setupGlobalCommands();
        }
        
        // 10. 애니메이션 시작
        animate();
        
        // 11. 전역 객체 노출
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
            adaptivePerformance: services.scene.adaptivePerformance,  // ⭐ 추가
            
            // UI
            connectionModal: services.ui.connectionModal,
            equipmentEditState,
            equipmentEditModal,
            apiClient: services.ui.apiClient,
            toast,
            
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
            
            // ⭐ 함수 노출
            toggleAdaptivePerformance
        });
        
        // 12. 초기화 완료
        hideLoadingStatus(3000);
        
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode()
        });
        
        // 디버그 모드일 때 메모리 정보
        if (CONFIG.DEBUG_MODE) {
            setTimeout(() => {
                memoryManager.logMemoryInfo(sceneManager.renderer);
            }, 1000);
        }
        
        console.log('✅ 모든 초기화 완료!');
        console.log('💡 콘솔에서 debugHelp() 입력으로 사용 가능한 명령어 확인');
        console.log('💡 키보드 단축키: D=디버그, P=성능, H=헬퍼, G=그리드, M=모니터링, E=편집');
        console.log('💡 AdaptivePerformance: toggleAdaptivePerformance() 또는 A키로 ON/OFF');
        
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
        adaptivePerformance  // ⭐ 추가
    } = services.scene || {};
    const { signalTowerManager } = services.monitoring || {};
    
    // 카메라 컨트롤 업데이트
    if (cameraControls) {
        cameraControls.update();
    }
    
    // 상태 시각화 애니메이션
    if (statusVisualizer) {
        statusVisualizer.animateErrorStatus();
    }
    
    // Signal Tower 애니메이션
    if (signalTowerManager) {
        signalTowerManager.animate(0.016);
    }
    
    // 씬 렌더링
    if (sceneManager) {
        sceneManager.render();
    }
    
    // ⭐ PerformanceMonitor 업데이트 (FPS 계산 - 필수!)
    if (performanceMonitor) {
        performanceMonitor.update();
    }
    
    // ⭐ AdaptivePerformance 업데이트 (자동 품질 조정)
    if (adaptivePerformance) {
        adaptivePerformance.update();
    }
    
    // 성능 모니터 UI 업데이트
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
        adaptivePerformance: services.scene?.adaptivePerformance,  // ⭐ 추가
        performanceMonitorUI,
        previewGenerator,
        sceneManager: services.scene?.sceneManager,
        equipmentLoader: services.scene?.equipmentLoader,
        cameraControls: services.scene?.cameraControls,
        interactionHandler: services.scene?.interactionHandler,
        cameraNavigator: services.scene?.cameraNavigator,
        equipmentEditState: services.ui?.equipmentEditState,
        connectionModal: services.ui?.connectionModal,
        equipmentEditModal: services.ui?.equipmentEditModal
    });
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', handleCleanup);

// ============================================
// 초기화 실행
// ============================================
init();