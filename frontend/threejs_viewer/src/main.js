/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (리팩토링 버전)
 * 
 * @version 4.1.0
 * @description 중앙 집중식 모드 관리 시스템 적용
 * 
 * @changelog
 * - v4.1.0: EquipmentInfoPanel ↔ DataOverlay 연결 추가 (Phase 2 Equipment Detail)
 * - v4.0.0: 중앙 집중식 모드 관리, AppModeManager.toggleMode() 사용
 *           ModeHandlers 서비스 연결, InteractionHandler에 AppModeManager 연결
 * - v3.4.0: StorageService AutoSave 연동, Equipment 복구 다이얼로그
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
    connectServicesToModeHandlers,  // 🆕 v4.0.0
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

// 🆕 Storage Service import
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

// 🆕 Site ID (URL 파라미터 또는 기본값)
const urlParams = new URLSearchParams(window.location.search);
const SITE_ID = urlParams.get('siteId') || 'default_site';

// ============================================
// 🆕 v4.0.0: 모드 토글 함수 (단순화)
// ============================================

/**
 * 🆕 v4.0.0: Equipment Edit 모드 토글
 * AppModeManager.toggleMode() 사용 - 핸들러가 자동 처리
 */
function toggleEditMode() {
    appModeManager.toggleMode(APP_MODE.EQUIPMENT_EDIT);
}

/**
 * 🆕 v4.0.0: Monitoring 모드 토글
 * AppModeManager.toggleMode() 사용 - 핸들러가 자동 처리
 */
function toggleMonitoringMode() {
    appModeManager.toggleMode(APP_MODE.MONITORING);
}

/**
 * Connection Modal 토글 (기존 유지)
 */
function toggleConnectionModal() {
    if (services.ui?.connectionModal) {
        services.ui.connectionModal.toggle();
        updateButtonState('connectionBtn', services.ui.connectionModal.isOpen);
    }
}

/**
 * 버튼 상태 업데이트 헬퍼 (Connection 버튼용)
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
// 🆕 Equipment AutoSave 복구 다이얼로그
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

// ============================================
// 🆕 Equipment AutoSave 초기화
// ============================================

function initEquipmentAutoSave(equipmentEditState) {
    if (!equipmentEditState) {
        console.warn('[main.js] EquipmentEditState가 없습니다. AutoSave 건너뜀.');
        return;
    }
    
    // 1. 복구 데이터 확인
    const recoveryData = equipmentEditState.checkAutoSaveRecovery(storageService);
    
    if (recoveryData) {
        // 복구 다이얼로그 표시
        showEquipmentRecoveryDialog(recoveryData);
    }
    
    // 2. AutoSave 초기화
    equipmentEditState.initAutoSave(storageService, SITE_ID);
    
    // 3. AutoSave 이벤트 구독 (상태바 등 UI 업데이트용)
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
// 메인 초기화
// ============================================

function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화 (v4.1.0)...');
    console.log(`📍 Site ID: ${SITE_ID}`);
    
    try {
        // 1. Core 매니저 초기화 (모드 핸들러 등록)
        initCoreManagers({ registerHandlers: true });
        
        // 2. 3D 씬 초기화
        services.scene = initScene();
        
        // 3. UI 컴포넌트 초기화
        services.ui = initUIComponents();
        
        // 🆕 v4.1.0: DataOverlay ↔ EquipmentInfoPanel 연결
        if (services.scene?.dataOverlay && services.ui?.equipmentInfoPanel) {
            services.scene.dataOverlay.setEquipmentInfoPanel(services.ui.equipmentInfoPanel);
            console.log('  ✅ DataOverlay ↔ EquipmentInfoPanel 연결 완료');
        }
        
        // 4. Monitoring 서비스 초기화
        services.monitoring = initMonitoringServices(
            services.scene.sceneManager.scene,
            services.scene.equipmentLoader,
            services.ui.equipmentEditState,
            services.ui.connectionStatusService
        );
        
        // 🆕 5. 모드 핸들러에 서비스 연결 (v4.0.0 핵심!)
        connectServicesToModeHandlers({
            equipmentEditState: services.ui.equipmentEditState,
            equipmentEditButton: services.ui.equipmentEditButton,
            monitoringService: services.monitoring.monitoringService,
            signalTowerManager: services.monitoring.signalTowerManager
        });
        
        // 6. InteractionHandler 연결
        const { interactionHandler, sceneManager, equipmentLoader } = services.scene;
        const { equipmentEditState, equipmentEditModal, equipmentEditButton } = services.ui;
        
        // 🆕 v4.0.0: AppModeManager 연결 (중앙 집중식 모드 관리)
        interactionHandler.setAppModeManager(appModeManager);
        
        // 레거시 호환용 연결
        interactionHandler.setEditMode(equipmentEditState);
        interactionHandler.setEditModal(equipmentEditModal);
        interactionHandler.setMonitoringService(services.monitoring.monitoringService);
        
        // 7. EquipmentEditButton 연동
        connectEquipmentEditButton(equipmentEditButton, toggleEditMode);
        
        // 8. Equipment AutoSave 초기화
        initEquipmentAutoSave(equipmentEditState);
        
        // 9. 이벤트 리스너 설정
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
        
        // 10. LayoutEditorMain 연결
        setupLayoutEditorMainConnection(sceneManager);
        
        // 11. PreviewGenerator 초기화
        previewGenerator = initPreviewGenerator();
        
        // 12. 전역 디버그 함수 설정
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
        
        // 13. 애니메이션 시작
        animate();
        
        // 14. 전역 객체 노출
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
            equipmentEditButton,
            apiClient: services.ui.apiClient,
            toast,
            equipmentInfoPanel: services.ui.equipmentInfoPanel,  // 🆕 v4.1.0: 추가
            
            // Connection Status
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
            
            // 🆕 Storage
            storageService,
            
            // 함수 노출
            toggleAdaptivePerformance,
            toggleEditMode,
            toggleMonitoringMode
        });
        
        // 15. 초기화 완료
        hideLoadingStatus(3000);
        
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode(),
            siteId: SITE_ID
        });
        
        if (CONFIG.DEBUG_MODE) {
            setTimeout(() => {
                memoryManager.logMemoryInfo(sceneManager.renderer);
            }, 1000);
        }
        
        console.log('✅ 모든 초기화 완료! (v4.1.0 - EquipmentInfoPanel 연동)');
        console.log('💡 콘솔에서 debugHelp() 입력으로 사용 가능한 명령어 확인');
        console.log('💡 키보드 단축키: D=디버그, P=성능, H=헬퍼, G=그리드, M=모니터링, E=편집');
        console.log('💡 AdaptivePerformance: toggleAdaptivePerformance() 또는 A키로 ON/OFF');
        console.log('💡 Equipment Edit: Backend 연결 시에만 E키 또는 버튼 사용 가능');
        console.log('💡 Equipment AutoSave: 30초마다 자동 저장, 5회 변경 시 즉시 저장');
        console.log('💡 모드 전환: appModeManager.toggleMode(APP_MODE.XXX) 사용');
        console.log('💡 Equipment Info: 설비 클릭 시 상세 정보 표시 (Backend API 연동)');
        
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
    // 🆕 Equipment AutoSave 중지
    if (services.ui?.equipmentEditState) {
        services.ui.equipmentEditState.stopAutoSave();
    }
    
    // 🆕 v4.1.0: EquipmentInfoPanel 정리
    if (services.ui?.equipmentInfoPanel) {
        services.ui.equipmentInfoPanel.dispose();
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