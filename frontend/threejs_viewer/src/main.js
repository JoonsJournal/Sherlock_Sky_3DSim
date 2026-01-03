/**
 * main.js
 * 메인 애플리케이션 진입점
 * 
 * @version 2.0.0
 * @description Phase 1.6 - Core 매니저 통합 및 UI 컴포넌트 리팩토링
 * 
 * SceneManager, EquipmentLoader, CameraControls, InteractionHandler, DataOverlay, StatusVisualizer, PerformanceMonitor 통합
 * ⭐ Phase 1.6 추가: AppModeManager, KeyboardManager, DebugManager 초기화
 * ⭐ Phase 2 추가: ConnectionModal 통합
 * ⭐ Phase 4.2 추가: RoomParamsAdapter 및 Layout 적용 연동
 * ⭐ Phase 4.4 추가: SceneManager-EquipmentLoader 연결, LayoutEditorMain 연동
 * ⭐ Phase 4.5 추가: PreviewGenerator 통합
 */

// ⭐⭐⭐ 1. THREE import (가장 먼저!)
import * as THREE from 'three';

// ============================================
// ⭐ Phase 1.6: Core 매니저 import
// ============================================
import { appModeManager } from './core/managers/AppModeManager.js';
import { keyboardManager } from './core/managers/KeyboardManager.js';
import { debugManager } from './core/managers/DebugManager.js';
import { eventBus } from './core/managers/EventBus.js';
import { logger } from './core/managers/Logger.js';

// ============================================
// ⭐ Phase 1.6: Config import
// ============================================
import { 
    APP_MODE,
    KEYBOARD_CONTEXT,
    EVENT_NAME
} from './core/config/constants.js';

// Scene 관련 import
import { SceneManager } from './viewer3d/scene/SceneManager.js';
import { EquipmentLoader } from './viewer3d/scene/EquipmentLoader.js';
import { Lighting } from './viewer3d/scene/Lighting.js';

// Controls import
import { CameraControls } from './viewer3d/controls/CameraControls.js';
import { CameraNavigator } from './viewer3d/controls/CameraNavigator.js';
import { InteractionHandler } from './viewer3d/controls/InteractionHandler.js';

// Visualization import
import { DataOverlay } from './viewer3d/visualization/DataOverlay.js';
import { StatusVisualizer } from './viewer3d/visualization/StatusVisualizer.js';

// Utils import
import { memoryManager } from './core/utils/MemoryManager.js';
import { PerformanceMonitor } from './core/utils/PerformanceMonitor.js';
import { CONFIG, debugLog } from './core/utils/Config.js';

// ============================================
// ⭐ Phase 1.6: UI 컴포넌트 import (수정된 경로)
// ============================================
import { ConnectionModal } from './ui/ConnectionModal.js';
import { EquipmentEditModal } from './ui/EquipmentEditModal.js';
import { toast } from './ui/common/Toast.js';
import { DebugPanel } from './ui/debug/DebugPanel.js';
import { PerformanceMonitorUI } from './ui/debug/PerformanceMonitorUI.js';

// Services import
import { EquipmentEditState } from './services/EquipmentEditState.js';
import { ApiClient } from './api/ApiClient.js';

// ============================================
// ⭐ Phase 2: Monitoring Service import
// ============================================
import { MonitoringService } from './services/MonitoringService.js';
import { SignalTowerManager } from './services/SignalTowerManager.js';

// ============================================
// ⭐ Phase 4.2: Layout 변환 및 적용 import
// ============================================
import { Layout2DTo3DConverter, layout2DTo3DConverter } from './services/converter/Layout2DTo3DConverter.js';
import { RoomParamsAdapter, roomParamsAdapter } from './services/converter/RoomParamsAdapter.js';

// ============================================
// 전역 객체
// ============================================
let sceneManager;
let equipmentLoader;
let cameraControls;
let cameraNavigator;
let interactionHandler;
let dataOverlay;
let statusVisualizer;
let performanceMonitor;
let animationFrameId;

// UI 관련
let connectionModal;
let equipmentEditState;
let equipmentEditModal;
let apiClient;

// ⭐ Phase 1.6: 디버그 UI
let debugPanel;
let performanceMonitorUI;

// ⭐ Phase 2: Monitoring
let monitoringService;
let signalTowerManager;

// ⭐ Phase 4.5: Preview
let previewGenerator;

// ============================================
// ⭐ Phase 1.6: Core 시스템 초기화
// ============================================

/**
 * Core 매니저 초기화
 */
function initCoreManagers() {
    console.log('🔧 Core 매니저 초기화...');
    
    // 1. 모드 등록
    appModeManager.registerMode(APP_MODE.MAIN_VIEWER, {
        name: 'Main Viewer',
        keyboardContext: KEYBOARD_CONTEXT.VIEWER_3D,
        onEnter: () => {
            logger.info('Main Viewer 모드 진입');
            keyboardManager.setContext(KEYBOARD_CONTEXT.VIEWER_3D);
        },
        onExit: () => {
            logger.info('Main Viewer 모드 종료');
        }
    });
    
    appModeManager.registerMode(APP_MODE.EQUIPMENT_EDIT, {
        name: 'Equipment Edit',
        keyboardContext: KEYBOARD_CONTEXT.EDITOR_2D,
        onEnter: () => {
            logger.info('Equipment Edit 모드 진입');
            document.body.classList.add('edit-mode-active');
        },
        onExit: () => {
            logger.info('Equipment Edit 모드 종료');
            document.body.classList.remove('edit-mode-active');
        }
    });
    
    appModeManager.registerMode(APP_MODE.MONITORING, {
        name: 'Monitoring',
        keyboardContext: KEYBOARD_CONTEXT.VIEWER_3D,
        onEnter: () => {
            logger.info('Monitoring 모드 진입');
            if (monitoringService && !monitoringService.isActive) {
                monitoringService.start();
            }
        },
        onExit: () => {
            logger.info('Monitoring 모드 종료');
            if (monitoringService && monitoringService.isActive) {
                monitoringService.stop();
            }
        }
    });
    
    console.log('  ✅ 모드 등록 완료');
    
    // 2. 단축키 등록
    // initKeyboardShortcuts();
    console.log('  ✅ 단축키 등록 완료');
    
    // 3. 이벤트 버스 히스토리 활성화 (디버그 모드일 때)
    if (CONFIG.DEBUG_MODE) {
        eventBus.enableHistory(true);
    }
    
    // 4. 기본 모드 설정
    appModeManager.switchMode(APP_MODE.MAIN_VIEWER);
    
    console.log('✅ Core 매니저 초기화 완료');
}

/**
 * 키보드 단축키 초기화
 */
function initKeyboardShortcuts() {
    // Global 컨텍스트 단축키
    keyboardManager.setContext(KEYBOARD_CONTEXT.GLOBAL);
    
    // Ctrl+K: Connection Modal 토글
    keyboardManager.registerShortcut('ctrl+k', () => {
        if (connectionModal) {
            connectionModal.toggle();
            updateConnectionButtonState();
        }
    }, '연결 모달 토글');
    
    // Ctrl+S: 저장 (전역)
    keyboardManager.registerShortcut('ctrl+s', (e) => {
        e.preventDefault();
        eventBus.emit(EVENT_NAME.SAVE_REQUESTED);
        toast.info('저장 요청됨');
    }, '저장');
    
    // F11: 전체 화면
    keyboardManager.registerShortcut('f11', (e) => {
        e.preventDefault();
        toggleFullscreen();
    }, '전체 화면');
    
    // 3D Viewer 컨텍스트 단축키
    keyboardManager.setContext(KEYBOARD_CONTEXT.VIEWER_3D);
    
    // H: 헬퍼 토글
    keyboardManager.registerShortcut('h', () => {
        if (sceneManager) {
            sceneManager.toggleHelpers();
            toast.info('헬퍼 토글됨');
        }
    }, '헬퍼 토글');
    
    // G: 그리드 토글
    keyboardManager.registerShortcut('g', () => {
        if (sceneManager) {
            sceneManager.toggleGrid();
            toast.info('그리드 토글됨');
        }
    }, '그리드 토글');
    
    // D: 디버그 패널 토글
    keyboardManager.registerShortcut('d', () => {
        toggleDebugPanel();
    }, '디버그 패널');
    
    // Home: 카메라 리셋
    keyboardManager.registerShortcut('home', () => {
        if (cameraNavigator) {
            cameraNavigator.reset();
            toast.info('카메라 리셋');
        }
    }, '카메라 리셋');
    
    // F: 전체 보기 (Fit All)
    keyboardManager.registerShortcut('f', () => {
        if (cameraNavigator) {
            cameraNavigator.fitAll();
        }
    }, '전체 보기');
    
    // 숫자 키: 뷰 프리셋
    keyboardManager.registerShortcut('ctrl+1', () => {
        if (cameraNavigator) cameraNavigator.setView('front');
    }, '정면 뷰');
    
    keyboardManager.registerShortcut('ctrl+2', () => {
        if (cameraNavigator) cameraNavigator.setView('top');
    }, '상단 뷰');
    
    keyboardManager.registerShortcut('ctrl+3', () => {
        if (cameraNavigator) cameraNavigator.setView('right');
    }, '우측 뷰');
    
    keyboardManager.registerShortcut('ctrl+4', () => {
        if (cameraNavigator) cameraNavigator.setView('isometric');
    }, '등각 뷰');
    
    // M: 모니터링 모드 토글
    keyboardManager.registerShortcut('m', () => {
        toggleMonitoringMode();
    }, '모니터링 모드');
    
    // E: Edit 모드 토글
    keyboardManager.registerShortcut('e', () => {
        toggleEditMode();
    }, '편집 모드');
    
    // P: 성능 모니터 토글
    keyboardManager.registerShortcut('p', () => {
        togglePerformanceMonitor();
    }, '성능 모니터');
    
    // 기본 컨텍스트로 복원
    keyboardManager.setContext(KEYBOARD_CONTEXT.GLOBAL);
}

/**
 * 디버그 패널 토글
 * index.html의 기존 debugControls 패널 사용
 */
function toggleDebugPanel() {
    // index.html의 기존 디버그 컨트롤 패널 사용
    const panel = document.getElementById('debugControls');
    const button = document.getElementById('debugToggle');
    
    if (panel && button) {
        panel.classList.toggle('active');
        button.classList.toggle('active');
        
        const isActive = panel.classList.contains('active');
        console.log(`🔧 디버그 패널: ${isActive ? '열림' : '닫힘'}`);
        
        if (isActive) {
            debugManager.enable();
        }
    } else {
        console.warn('debugControls 또는 debugToggle 요소를 찾을 수 없음');
    }
}

/**
 * 성능 모니터 토글
 */
function togglePerformanceMonitor() {
    if (!performanceMonitorUI) {
        const container = document.createElement('div');
        container.id = 'perf-monitor-container';
        document.body.appendChild(container);
        
        performanceMonitorUI = new PerformanceMonitorUI({ 
            container,
            position: 'top-left'
        });
        performanceMonitorUI.mount();
    }
    
    performanceMonitorUI.toggle();
}

/**
 * 전체 화면 토글
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

/**
 * 모니터링 모드 토글
 */
function toggleMonitoringMode() {
    const currentMode = appModeManager.getCurrentMode();
    
    if (currentMode === APP_MODE.MONITORING) {
        appModeManager.switchMode(APP_MODE.MAIN_VIEWER);
        updateMonitoringButtonState(false);
    } else {
        appModeManager.switchMode(APP_MODE.MONITORING);
        updateMonitoringButtonState(true);
    }
}

function toggleEditMode() {
    const currentMode = appModeManager.getCurrentMode();
    
    if (currentMode === APP_MODE.EQUIPMENT_EDIT) {
        appModeManager.switchMode(APP_MODE.MAIN_VIEWER);
        if (equipmentEditState) {
            equipmentEditState.disableEditMode();  // ✅ 올바른 메서드
        }
        updateEditButtonState(false);
    } else {
        appModeManager.switchMode(APP_MODE.EQUIPMENT_EDIT);
        if (equipmentEditState) {
            equipmentEditState.enableEditMode();   // ✅ 올바른 메서드
        }
        updateEditButtonState(true);
    }
}

/**
 * 버튼 상태 업데이트 헬퍼
 */
function updateConnectionButtonState() {
    const btn = document.getElementById('connectionBtn');
    if (btn && connectionModal) {
        btn.classList.toggle('active', connectionModal.isOpen);
    }
}

function updateMonitoringButtonState(isActive) {
    const btn = document.getElementById('monitoringBtn');
    if (btn) {
        btn.classList.toggle('active', isActive);
    }
}

function updateEditButtonState(isActive) {
    const btn = document.getElementById('editBtn');
    if (btn) {
        btn.classList.toggle('active', isActive);
    }
}

// ============================================
// 초기화 함수
// ============================================

/**
 * 메인 초기화
 */
function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화...');
    
    try {
        // ⭐ Phase 1.6: Core 매니저 먼저 초기화
        initCoreManagers();
        
        // 1. Scene Manager 생성 및 초기화
        sceneManager = new SceneManager();
        const initSuccess = sceneManager.init();
        
        if (!initSuccess) {
            throw new Error('SceneManager 초기화 실패');
        }
        
        if (!sceneManager.renderer || !sceneManager.renderer.domElement) {
            console.error('❌ Renderer 또는 domElement가 없습니다!');
            throw new Error('Renderer 초기화 실패');
        }
        
        console.log('✅ SceneManager 초기화 완료');
        
        // 2. 조명 추가
        Lighting.addLights(sceneManager.scene);
        console.log('✅ Lighting 초기화 완료');
        
        // 3. Equipment Loader
        equipmentLoader = new EquipmentLoader(sceneManager.scene);
        
        // 로딩 상태 콜백 함수
        const updateLoadingStatus = (message, isError) => {
            const statusDiv = document.getElementById('loadingStatus');
            if (statusDiv) {
                statusDiv.textContent = message;
                statusDiv.style.color = isError ? '#e74c3c' : '#2ecc71';
            }
            debugLog(isError ? '❌' : '✅', message);
        };
        
        // 설비 배열 로드
        equipmentLoader.loadEquipmentArray(updateLoadingStatus);
        console.log('✅ EquipmentLoader 초기화 완료');
        
        // Phase 4.4: SceneManager-EquipmentLoader 연결
        if (sceneManager.setEquipmentLoader) {
            sceneManager.setEquipmentLoader(equipmentLoader);
            console.log('✅ SceneManager-EquipmentLoader 연결 완료');
        }
        
        // 4. Camera Controls
        console.log('🎮 CameraControls 생성 중...');
        cameraControls = new CameraControls(
            sceneManager.camera,
            sceneManager.renderer.domElement
        );
        console.log('✅ CameraControls 초기화 완료');

        // 4-1. Camera Navigator 추가
        cameraNavigator = new CameraNavigator(
            sceneManager.camera,
            cameraControls.controls,
            new THREE.Vector3(0, 0, 0)
        );
        console.log('✅ CameraNavigator 초기화 완료');
        
        // 5. DataOverlay 초기화
        dataOverlay = new DataOverlay();
        dataOverlay.exposeGlobalFunctions();
        console.log('✅ DataOverlay 초기화 완료');
        
        // 6. StatusVisualizer 초기화
        statusVisualizer = new StatusVisualizer(equipmentLoader.getEquipmentArray());
        statusVisualizer.updateAllStatus();
        console.log('✅ StatusVisualizer 초기화 완료');
        
        // 7. PerformanceMonitor 초기화
        performanceMonitor = new PerformanceMonitor(sceneManager.renderer);
        console.log('✅ PerformanceMonitor 초기화 완료');
        
        // 8. Interaction Handler
        interactionHandler = new InteractionHandler(
            sceneManager.camera,
            sceneManager.scene,
            sceneManager.renderer.domElement,
            equipmentLoader.getEquipmentArray(),
            dataOverlay
        );
        console.log('✅ InteractionHandler 초기화 완료');
        
        // ============================================
        // ⭐ Phase 1.6: UI 컴포넌트 초기화 (수정된 방식)
        // ============================================
        
        // ConnectionModal 초기화
        connectionModal = new ConnectionModal();
        console.log('✅ ConnectionModal 초기화 완료');
        
        // API Client 초기화
        apiClient = new ApiClient();
        console.log('✅ ApiClient 초기화 완료');
        
        // Equipment Edit State 초기화
        equipmentEditState = new EquipmentEditState();
        console.log('✅ EquipmentEditState 초기화 완료');
        
        // Equipment Edit Modal 초기화 (수정된 생성자)
        equipmentEditModal = new EquipmentEditModal({
            editState: equipmentEditState,
            apiClient: apiClient
        });
        console.log('✅ EquipmentEditModal 초기화 완료');
        
        // ============================================
        // ⭐ Phase 2: Monitoring Service 초기화
        // ============================================
        
        // Signal Tower Manager 초기화
        signalTowerManager = new SignalTowerManager(sceneManager.scene, equipmentLoader);
        
        // 기존 equipment1.js의 경광등 램프들을 찾아서 초기화
        const lightCount = signalTowerManager.initializeAllLights();
        console.log(`✅ SignalTowerManager 초기화 완료: ${lightCount}개 설비의 경광등 연결`);
        
        // Monitoring Service 초기화
        monitoringService = new MonitoringService(signalTowerManager);
        console.log('✅ MonitoringService 초기화 완료');
        
        // 전역 객체로 노출 (테스트용)
        window.monitoringService = monitoringService;
        window.signalTowerManager = signalTowerManager;
        
        // ============================================
        // ⭐ Phase 4.2: Layout 적용 이벤트 리스너
        // ============================================
        setupLayoutEventListeners();
        console.log('✅ Layout 이벤트 리스너 설정 완료');
        
        // ============================================
        // ⭐ Phase 4.4: LayoutEditorMain 연결
        // ============================================
        setupLayoutEditorMainConnection();
        console.log('✅ LayoutEditorMain 연결 설정 완료');
        
        // ============================================
        // ⭐ Phase 4.5: PreviewGenerator 초기화
        // ============================================
        initPreviewGenerator();
        console.log('✅ PreviewGenerator 연결 설정 완료');
        
        // ============================================
        // ⭐ UI Button 이벤트 리스너 설정
        // ============================================
        setupUIEventListeners();
        console.log('✅ UI 이벤트 리스너 설정 완료');
        
        // InteractionHandler 연결
        interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
        interactionHandler.setDataOverlay(dataOverlay);
        interactionHandler.setStatusVisualizer(statusVisualizer);
        
        // 설비 클릭 콜백 설정
        interactionHandler.setOnEquipmentClick((selectedData) => {
            debugLog('📊 설비 선택됨:', selectedData.map(d => d.id));
        });
        
        // 설비 선택 해제 콜백 설정
        interactionHandler.setOnEquipmentDeselect(() => {
            debugLog('📊 설비 선택 해제됨');
        });
        
        // InteractionHandler에 Edit 모드 연결
        interactionHandler.setEditMode(equipmentEditState);
        interactionHandler.setEditModal(equipmentEditModal);
        
        // 애니메이션 시작
        animate();
        
        // 전역 디버그 함수
        setupGlobalDebugFunctions();
        
        console.log('✅ 모든 초기화 완료!');
        console.log('💡 콘솔에서 debugHelp() 입력으로 사용 가능한 명령어 확인');
        console.log('💡 키보드 단축키: D=디버그, P=성능, H=헬퍼, G=그리드, M=모니터링, E=편집');
        
        // 초기 메모리 정보
        if (CONFIG.DEBUG_MODE) {
            setTimeout(() => {
                memoryManager.logMemoryInfo(sceneManager.renderer);
            }, 1000);
        }
        
        // 로딩 상태 숨김 (3초 후)
        setTimeout(() => {
            const loadingStatus = document.getElementById('loadingStatus');
            if (loadingStatus) {
                loadingStatus.style.transition = 'opacity 0.5s';
                loadingStatus.style.opacity = '0';
                setTimeout(() => {
                    loadingStatus.style.display = 'none';
                }, 500);
            }
        }, 3000);
        
        // ⭐ Phase 1.6: 초기화 완료 이벤트
        eventBus.emit(EVENT_NAME.APP_INITIALIZED, {
            timestamp: Date.now(),
            mode: appModeManager.getCurrentMode()
        });
        
    } catch (error) {
        console.error('❌ 초기화 중 오류 발생:', error);
        console.error('스택:', error.stack);
        
        // 오류 정보 화면에 표시
        showInitError(error);
    }
}

/**
 * UI 이벤트 리스너 설정
 */
function setupUIEventListeners() {
    // Edit Button
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            toggleEditMode();
        });
    }
    
    // Monitoring Button
    const monitoringBtn = document.getElementById('monitoringBtn');
    if (monitoringBtn) {
        monitoringBtn.addEventListener('click', () => {
            toggleMonitoringMode();
        });
    }
    
    // Connection Button
    const connectionBtn = document.getElementById('connectionBtn');
    if (connectionBtn) {
        connectionBtn.addEventListener('click', () => {
            console.log('🔌 Toggling Connection Modal...');
            connectionModal.toggle();
            updateConnectionButtonState();
        });
    }
    
    // ============================================
    // ⭐ Edit 모드 이벤트 리스너 등록
    // ============================================
    
    // Edit 모드 변경 시 시각 업데이트
    window.addEventListener('edit-mode-changed', (e) => {
        const { enabled } = e.detail;
        debugLog(`✏️ Edit Mode Changed: ${enabled}`);
        
        // 편집 모드에서는 기존 선택 해제
        if (enabled && interactionHandler) {
            interactionHandler.clearAllSelections();
        }
    });
    
    // 매핑 변경 시 시각 업데이트
    window.addEventListener('mapping-changed', (e) => {
        const { frontendId } = e.detail;
        
        if (equipmentLoader) {
            equipmentLoader.highlightMappingStatus(frontendId, true);
        }
        
        debugLog(`✅ 매핑 완료: ${frontendId}`);
    });
    
    // 매핑 삭제 시 시각 업데이트
    window.addEventListener('mapping-removed', (e) => {
        const { frontendId } = e.detail;
        
        if (equipmentLoader) {
            equipmentLoader.highlightMappingStatus(frontendId, false);
        }
        
        debugLog(`🗑️ 매핑 제거: ${frontendId}`);
    });
    
    // 매핑 리셋 시 모든 강조 제거
    window.addEventListener('mappings-reset', () => {
        if (equipmentLoader) {
            equipmentLoader.updateAllMappingStatus({});
        }
        debugLog('🗑️ 모든 매핑 초기화됨');
    });
    
    // 서버에서 매핑 로드 시 시각 업데이트
    window.addEventListener('mappings-loaded', (e) => {
        if (equipmentLoader && equipmentEditState) {
            const mappings = equipmentEditState.getAllMappings();
            equipmentLoader.updateAllMappingStatus(mappings);
        }
        debugLog('📥 서버 매핑 데이터 로드됨');
    });

// ============================================
    // ⭐ 키보드 단축키 직접 등록 (capture 모드로 먼저 받기)
    // ============================================
    document.addEventListener('keydown', (e) => {
        // 디버깅용 로그
        console.log('⌨️ Key pressed:', e.key, 'target:', e.target.tagName);
        
        // 입력 필드에서는 무시
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl+K: Connection Modal
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔌 Ctrl+K detected');
            if (connectionModal) {
                connectionModal.toggle();
                updateConnectionButtonState();
            }
            return;
        }
        
        // 단일 키 단축키
        const key = e.key.toLowerCase();
        console.log('🔑 Processing key:', key);
        
        switch (key) {
            case 'd':
                e.stopPropagation();
                e.preventDefault();
                console.log('📊 D key - toggleDebugPanel');
                toggleDebugPanel();
                break;
            case 'p':
                e.stopPropagation();
                e.preventDefault();
                console.log('📈 P key - togglePerformanceMonitor');
                togglePerformanceMonitor();
                break;
            case 'h':
                e.stopPropagation();
                e.preventDefault();
                console.log('🔧 H key - toggleHelpers');
                if (sceneManager && sceneManager.toggleHelpers) {
                    sceneManager.toggleHelpers();
                    console.log('🔧 헬퍼 토글됨');
                } else {
                    console.warn('sceneManager.toggleHelpers not available');
                }
                break;
            case 'g':
                e.stopPropagation();
                e.preventDefault();
                console.log('🔧 G key - toggleGrid');
                if (sceneManager && sceneManager.toggleGrid) {
                    sceneManager.toggleGrid();
                    console.log('🔧 그리드 토글됨');
                } else {
                    console.warn('sceneManager.toggleGrid not available');
                }
                break;
            case 'm':
                e.stopPropagation();
                e.preventDefault();
                console.log('📡 M key - toggleMonitoringMode');
                toggleMonitoringMode();
                break;
            case 'e':
                e.stopPropagation();
                e.preventDefault();
                console.log('✏️ E key - toggleEditMode');
                toggleEditMode();
                break;
            case 'escape':
                e.stopPropagation();
                e.preventDefault();
                console.log('🚫 ESC key - close modal');
                if (connectionModal && connectionModal.isOpen) {
                    connectionModal.close();
                    updateConnectionButtonState();
                }
                break;
        }
    }, true);  // ← capture: true 추가!
    
    console.log('  ✅ 키보드 단축키 등록 완료 (capture mode)');
}

/**
 * 초기화 에러 표시
 */
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
// ⭐ Phase 4.5: PreviewGenerator 초기화
// ============================================

/**
 * PreviewGenerator 초기화 (지연 로드)
 */
function initPreviewGenerator() {
    const connectPreviewGenerator = () => {
        if (window.PreviewGenerator && !previewGenerator) {
            try {
                const previewCanvas = document.getElementById('preview-canvas');
                
                if (previewCanvas) {
                    previewGenerator = new window.PreviewGenerator({
                        container: previewCanvas,
                        width: previewCanvas.clientWidth || 600,
                        height: previewCanvas.clientHeight || 400
                    });
                    
                    window.previewGenerator = previewGenerator;
                    console.log('[main.js] ✅ PreviewGenerator 초기화 완료');
                } else {
                    console.log('[main.js] Preview canvas not found yet, will try later');
                }
            } catch (error) {
                console.warn('[main.js] PreviewGenerator 초기화 실패:', error);
            }
        }
    };
    
    connectPreviewGenerator();
    setTimeout(connectPreviewGenerator, 500);
    setTimeout(connectPreviewGenerator, 1000);
    setTimeout(connectPreviewGenerator, 2000);
    
    window.addEventListener('preview-modal-opened', () => {
        connectPreviewGenerator();
    });
}

// ============================================
// ⭐ Phase 4.4: LayoutEditorMain 연결 설정
// ============================================

function setupLayoutEditorMainConnection() {
    const connectLayoutEditorMain = () => {
        if (window.layoutEditorMain && sceneManager) {
            if (typeof window.layoutEditorMain.setSceneManager === 'function') {
                window.layoutEditorMain.setSceneManager(sceneManager);
                console.log('[main.js] LayoutEditorMain-SceneManager 연결 완료');
            }
        }
    };
    
    connectLayoutEditorMain();
    setTimeout(connectLayoutEditorMain, 100);
    setTimeout(connectLayoutEditorMain, 500);
    
    window.addEventListener('layout-editor-main-ready', () => {
        connectLayoutEditorMain();
    });
}

// ============================================
// ⭐ Phase 4.2: Layout 이벤트 리스너 설정
// ============================================

function setupLayoutEventListeners() {
    window.addEventListener('apply-layout-request', (e) => {
        const { layoutData, options } = e.detail || {};
        
        if (!layoutData) {
            console.error('[main.js] apply-layout-request: layoutData가 없습니다');
            return;
        }
        
        console.log('[main.js] Layout 적용 요청 수신...');
        
        try {
            if (sceneManager && typeof sceneManager.applyLayoutFull === 'function') {
                const success = sceneManager.applyLayoutFull(layoutData, options);
                
                if (success) {
                    console.log('[main.js] ✅ Layout 적용 완료 (applyLayoutFull)');
                    
                    window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                        detail: { layoutData, success: true }
                    }));
                    
                    toast.success('Layout 적용 완료');
                } else {
                    throw new Error('applyLayoutFull 실패');
                }
                return;
            }
            
            // Fallback: 기존 방식
            const convertedLayout = layout2DTo3DConverter.convert(layoutData);
            
            if (!convertedLayout) {
                throw new Error('Layout 변환 실패');
            }
            
            const adaptedParams = roomParamsAdapter.adapt(convertedLayout);
            const validation = roomParamsAdapter.validate(adaptedParams);
            
            if (!validation.valid) {
                console.error('[main.js] Layout params 검증 실패:', validation.errors);
                throw new Error(`Layout params 검증 실패: ${validation.errors.join(', ')}`);
            }
            
            const success = sceneManager.applyLayoutWithParams(adaptedParams, options);
            
            if (success) {
                console.log('[main.js] ✅ Layout 적용 완료');
                
                window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                    detail: { layoutData, adaptedParams, success: true }
                }));
                
                toast.success('Layout 적용 완료');
            } else {
                throw new Error('SceneManager.applyLayoutWithParams 실패');
            }
            
        } catch (error) {
            console.error('[main.js] Layout 적용 실패:', error);
            
            window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                detail: { layoutData, error: error.message, success: false }
            }));
            
            toast.error(`Layout 적용 실패: ${error.message}`);
        }
    });
    
    window.addEventListener('layout-applied', (e) => {
        console.log('[main.js] layout-applied 이벤트 수신:', e.detail);
    });
    
    window.addEventListener('layout-params-applied', (e) => {
        console.log('[main.js] layout-params-applied 이벤트 수신:', e.detail);
    });
    
    window.addEventListener('layout-full-applied', (e) => {
        console.log('[main.js] layout-full-applied 이벤트 수신:', e.detail);
        
        if (interactionHandler && equipmentLoader) {
            interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
            console.log('[main.js] InteractionHandler 설비 배열 재연결 완료');
        }
        
        if (statusVisualizer && equipmentLoader) {
            statusVisualizer.setEquipmentArray(equipmentLoader.getEquipmentArray());
            statusVisualizer.updateAllStatus();
            console.log('[main.js] StatusVisualizer 재연결 완료');
        }
        
        if (signalTowerManager) {
            signalTowerManager.initializeAllLights();
            console.log('[main.js] SignalTowerManager 재연결 완료');
        }
    });
    
    window.addEventListener('scene-rebuilt', (e) => {
        console.log('[main.js] scene-rebuilt 이벤트 수신:', e.detail);
        
        if (interactionHandler && equipmentLoader) {
            interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
        }
    });
}

/**
 * 애니메이션 루프
 */
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    // 카메라 컨트롤 업데이트
    if (cameraControls) {
        cameraControls.update();
    }
    
    // 상태 시각화 애니메이션 (에러 상태 깜빡임)
    if (statusVisualizer) {
        statusVisualizer.animateErrorStatus();
    }
    
    // Signal Tower 애니메이션 (경광등 깜빡임)
    if (signalTowerManager) {
        const deltaTime = 0.016;
        signalTowerManager.animate(deltaTime);
    }
    
    // 씬 렌더링
    if (sceneManager) {
        sceneManager.render();
    }
    
    // ⭐ Phase 1.6: 성능 모니터 업데이트
    if (performanceMonitorUI && performanceMonitorUI.isVisible && performanceMonitorUI.isVisible()) {
        performanceMonitorUI.recordFrame();
        if (sceneManager && sceneManager.renderer) {
            performanceMonitorUI.setRenderInfo(sceneManager.renderer.info);
        }
    }
}

/**
 * 전역 디버그 함수 설정
 */
function setupGlobalDebugFunctions() {
    // 도움말
    window.debugHelp = () => {
        console.group('📖 Debug Commands');
        console.log('=== 기본 명령어 ===');
        console.log('  debugHelp()           - 이 도움말 표시');
        console.log('  debugScene()          - 씬 정보 출력');
        console.log('  listEquipments()      - 설비 목록');
        console.log('');
        console.log('=== 카메라 명령어 ===');
        console.log('  moveCameraTo(x,y,z)   - 카메라 이동');
        console.log('  focusEquipment(r,c)   - 설비 포커스');
        console.log('  resetCamera()         - 카메라 리셋');
        console.log('');
        console.log('=== 모드 제어 ===');
        console.log('  toggleEditMode()      - 편집 모드 토글');
        console.log('  toggleMonitoringMode()- 모니터링 모드 토글');
        console.log('');
        console.log('=== Phase 1.6 추가 ===');
        console.log('  debug.status()        - 전체 상태 출력');
        console.log('  debug.mode(mode)      - 모드 변경');
        console.log('  debug.events()        - 이벤트 히스토리');
        console.log('  debug.help()          - 디버그 명령어 목록');
        console.log('');
        console.log('=== 키보드 단축키 ===');
        console.log('  D: 디버그 패널');
        console.log('  P: 성능 모니터');
        console.log('  H: 헬퍼 토글');
        console.log('  G: 그리드 토글');
        console.log('  M: 모니터링 모드');
        console.log('  E: 편집 모드');
        console.log('  Ctrl+K: 연결 모달');
        console.groupEnd();
    };

    // 씬 정보
    window.debugScene = () => {
        if (!sceneManager) {
            console.error('❌ SceneManager가 없습니다');
            return;
        }
        
        console.group('🎬 Scene Info');
        console.log('Children:', sceneManager.scene.children.length);
        console.log('Camera Position:', sceneManager.camera.position);
        console.log('Renderer Size:', {
            width: sceneManager.renderer.domElement.width,
            height: sceneManager.renderer.domElement.height
        });
        
        if (sceneManager.renderer.info) {
            console.log('Render Info:', {
                calls: sceneManager.renderer.info.render.calls,
                triangles: sceneManager.renderer.info.render.triangles,
                geometries: sceneManager.renderer.info.memory.geometries,
                textures: sceneManager.renderer.info.memory.textures
            });
        }
        console.groupEnd();
    };

    // 설비 목록
    window.listEquipments = () => {
        if (!equipmentLoader) {
            console.error('❌ EquipmentLoader가 없습니다');
            return;
        }
        
        const equipments = equipmentLoader.getEquipmentArray();
        console.log(`📦 설비 목록 (총 ${equipments.length}개):`);
        console.table(equipments.slice(0, 10).map(eq => ({
            id: eq.userData.id,
            row: eq.userData.position.row,
            col: eq.userData.position.col
        })));
        
        if (equipments.length > 10) {
            console.log(`... 외 ${equipments.length - 10}개`);
        }
    };

    // 카메라 이동
    window.moveCameraTo = (x, y, z) => {
        if (cameraNavigator) {
            cameraNavigator.moveTo(new THREE.Vector3(x, y, z));
            console.log(`📷 카메라 이동: (${x}, ${y}, ${z})`);
        }
    };

    // 설비 포커스
    window.focusEquipment = (row, col) => {
        if (cameraNavigator && equipmentLoader) {
            const equipment = equipmentLoader.getEquipmentByPosition(row, col);
            if (equipment) {
                cameraNavigator.focusOn(equipment);
                console.log(`🎯 설비 포커스: row=${row}, col=${col}`);
            } else {
                console.warn(`⚠️ 설비를 찾을 수 없음: row=${row}, col=${col}`);
            }
        }
    };

    // 카메라 리셋
    window.resetCamera = () => {
        if (cameraNavigator) {
            cameraNavigator.reset();
            console.log('📷 카메라 리셋');
        }
    };

    // 전역 토글 함수
    window.toggleEditMode = toggleEditMode;
    window.toggleMonitoringMode = toggleMonitoringMode;

    // 매핑 상태
    window.getMappingStatus = () => {
        if (!equipmentEditState || !equipmentLoader) {
            console.error('❌ EquipmentEditState 또는 EquipmentLoader가 초기화되지 않았습니다');
            return;
        }
        
        const mappings = equipmentEditState.getAllMappings();
        const rate = equipmentLoader.getMappingCompletionRate(mappings);
        
        console.group('📊 Equipment Mapping Status');
        console.log(`완료율: ${rate}%`);
        console.log(`매핑 완료: ${Object.keys(mappings).length}개`);
        console.log(`전체 설비: ${equipmentLoader.getEquipmentArray().length}개`);
        console.table(Object.values(mappings).slice(0, 10));
        console.groupEnd();
        
        return { rate, mappings };
    };

    window.clearAllMappings = () => {
        if (equipmentEditState) {
            equipmentEditState.reset();
        }
    };

    window.exportMappings = () => {
        if (equipmentEditState) {
            equipmentEditState.exportToFile();
            console.log('📁 매핑 데이터가 파일로 내보내졌습니다');
        }
    };

    // Layout 테스트
    window.applyTestLayout = () => {
        console.log('[Test] 테스트 Layout 적용 시작...');
        
        const testLayoutData = {
            version: '1.0',
            site_id: 'test_site',
            template_name: 'test_layout',
            canvas: { width: 1200, height: 800, scale: 10 },
            room: { width: 50, depth: 70, wallHeight: 5, wallThickness: 0.25 },
            office: { x: 350, y: 100, width: 150, height: 250, hasEntrance: true, entranceWidth: 40 },
            equipmentArrays: [{ rows: 26, cols: 6 }]
        };
        
        window.dispatchEvent(new CustomEvent('apply-layout-request', {
            detail: { layoutData: testLayoutData, options: { updateFloor: true, rebuildRoom: true } }
        }));
        
        console.log('[Test] 테스트 Layout 이벤트 발생 완료');
    };

    window.testRoomResize = (width, depth, height) => {
        if (!sceneManager || !sceneManager.getRoomEnvironment) {
            console.error('❌ SceneManager 또는 RoomEnvironment가 초기화되지 않았습니다');
            return;
        }
        
        const params = {
            roomWidth: width || 50,
            roomDepth: depth || 70,
            wallHeight: height || 5,
            wallThickness: 0.2,
            hasOffice: true,
            officeWidth: 15,
            officeDepth: 25,
            officeX: 18,
            officeZ: -25
        };
        
        console.log('[Test] Room 크기 변경 테스트:', params);
        sceneManager.applyLayoutWithParams(params);
    };

    console.log('✅ 전역 디버그 함수 등록 완료');
}

/**
 * 정리
 */
function cleanup() {
    console.log('🗑️ 정리 시작...');
    
    // 애니메이션 중지
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        console.log('  - 애니메이션 루프 중지');
    }
    
    // 성능 모니터 정리
    if (performanceMonitor) {
        performanceMonitor.dispose();
        console.log('  - PerformanceMonitor 정리');
    }
    
    // Phase 1.6: 디버그 UI 정리
    if (debugPanel) {
        debugPanel.destroy();
        console.log('  - DebugPanel 정리');
    }
    
    if (performanceMonitorUI) {
        performanceMonitorUI.destroy();
        console.log('  - PerformanceMonitorUI 정리');
    }
    
    // PreviewGenerator 정리
    if (previewGenerator && previewGenerator.dispose) {
        previewGenerator.dispose();
        console.log('  - PreviewGenerator 정리');
    }
    
    // 씬 정리
    if (sceneManager) {
        memoryManager.disposeScene(sceneManager.scene);
        sceneManager.dispose();
        console.log('  - SceneManager 정리');
    }
    
    // 설비 정리
    if (equipmentLoader) {
        equipmentLoader.dispose();
        console.log('  - EquipmentLoader 정리');
    }
    
    // 컨트롤 정리
    if (cameraControls) {
        cameraControls.dispose();
        console.log('  - CameraControls 정리');
    }
    
    // InteractionHandler 정리
    if (interactionHandler) {
        interactionHandler.dispose();
        console.log('  - InteractionHandler 정리');
    }
    
    // CameraNavigator 정리
    if (cameraNavigator) {
        cameraNavigator.dispose();
        console.log('  - CameraNavigator 정리');
    }

    // Equipment Edit 정리
    if (equipmentEditState) {
        equipmentEditState.destroy();
        console.log('  - EquipmentEditState 정리');
    }
    
    // Phase 1.6: Modal 정리
    if (connectionModal) {
        connectionModal.destroy();
        console.log('  - ConnectionModal 정리');
    }
    
    if (equipmentEditModal) {
        equipmentEditModal.destroy();
        console.log('  - EquipmentEditModal 정리');
    }

    console.log('✅ 정리 완료');
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', cleanup);

// 초기화 실행
init();

// ============================================
// ⭐ 전역 객체 노출
// ============================================
window.sceneManager = sceneManager;
window.equipmentLoader = equipmentLoader;
window.cameraControls = cameraControls;
window.cameraNavigator = cameraNavigator;
window.interactionHandler = interactionHandler;
window.dataOverlay = dataOverlay;
window.statusVisualizer = statusVisualizer;
window.performanceMonitor = performanceMonitor;
window.connectionModal = connectionModal;
window.equipmentEditState = equipmentEditState;
window.equipmentEditModal = equipmentEditModal;
window.apiClient = apiClient;

// Phase 1.6: Core 매니저 노출
window.appModeManager = appModeManager;
window.keyboardManager = keyboardManager;
window.debugManager = debugManager;
window.eventBus = eventBus;
window.logger = logger;

// Phase 4.2: Layout 관련 전역 객체 노출
window.layout2DTo3DConverter = layout2DTo3DConverter;
window.roomParamsAdapter = roomParamsAdapter;

// Phase 4.5: Preview 관련 전역 객체 노출
window.previewGenerator = previewGenerator;

console.log('🌐 전역 객체 노출 완료');
console.log('  - Core: appModeManager, keyboardManager, debugManager, eventBus, logger');
console.log('  - UI: connectionModal, equipmentEditModal, toast');
console.log('  - Layout: layout2DTo3DConverter, roomParamsAdapter, previewGenerator');