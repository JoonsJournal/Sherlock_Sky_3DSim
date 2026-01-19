/**
 * UIBootstrap.js
 * ==============
 * 
 * UI 컴포넌트 초기화 담당
 * 
 * @version 1.4.0
 * @module UIBootstrap
 * 
 * @changelog
 * - v1.4.0: 🔧 Health Check 타이밍 수정 (2026-01-13)
 *   - autoStart: false로 기본값 변경
 *   - startConnectionServiceForMode() 함수 추가
 *   - startConnectionServiceDelayed() 함수 추가
 *   - Monitoring 초기화 완료 후 시작 지원
 *   - ConnectionMode import 추가
 * - v1.3.0: 🔧 ConnectionIndicator 비활성화 (오른쪽 상단 패널 제거)
 * - v1.2.1: 🐛 isActive 버그 수정 - 함수 호출() → 속성 접근으로 변경
 * - v1.2.0: EquipmentInfoPanel 초기화 위치 수정 (initConnectionStatus → initUIComponents)
 * - v1.1.0: EquipmentEditButton 초기화 - 기존 #editBtn 인계 방식
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/UIBootstrap.js
 */

import { ConnectionModal } from '../ui/ConnectionModal.js';
import { EquipmentEditModal } from '../ui/EquipmentEditModal.js';
import { EquipmentEditButton } from '../ui/EquipmentEditButton.js';
import { toast } from '../ui/common/Toast.js';
import { DebugPanel } from '../ui/debug/DebugPanel.js';
import { PerformanceMonitorUI } from '../ui/debug/PerformanceMonitorUI.js';

import { EquipmentEditState } from '../services/EquipmentEditState.js';
import { ApiClient } from '../api/ApiClient.js';

import { MonitoringService, MonitoringServiceEvents } from '../services/MonitoringService.js';
import { SignalTowerManager } from '../services/SignalTowerManager.js';

// Connection Status 관련 import
// 🆕 v1.4.0: ConnectionMode 추가
import ConnectionStatusService, { 
    ConnectionEvents, 
    ConnectionState,
    ConnectionMode 
} from '../services/ConnectionStatusService.js';
// 🔧 v1.3.0: ConnectionIndicator import 유지하되 사용하지 않음
// import ConnectionIndicator from '../ui/ConnectionIndicator.js';

// EventBus import
import { eventBus } from '../core/managers/EventBus.js';

// 🆕 v1.2.0: EquipmentInfoPanel import
import { EquipmentInfoPanel } from '../ui/EquipmentInfoPanel.js';

/**
 * Connection Status 서비스 및 UI 초기화
 * 
 * 🔧 v1.3.0: ConnectionIndicator 생성 비활성화
 * 🔧 v1.4.0: autoStart 기본값 false로 변경
 * 
 * @param {Object} options - 초기화 옵션
 * @param {boolean} [options.mockMode=false] - Mock 모드 활성화
 * @param {boolean} [options.mockOnline=true] - Mock 온라인 상태
 * @param {boolean} [options.showMockControls=false] - Mock 컨트롤 표시
 * @param {string} [options.indicatorPosition='top-right'] - 인디케이터 위치
 * @param {number} [options.indicatorOffsetX=20] - X 오프셋
 * @param {number} [options.indicatorOffsetY=20] - Y 오프셋
 * @param {boolean} [options.autoStart=false] - 🆕 v1.4.0: 자동 시작 여부 (기본값 false로 변경)
 * @param {boolean} [options.debug=false] - 디버그 모드
 * @returns {Object} { connectionStatusService, connectionIndicator }
 */
export function initConnectionStatus(options = {}) {
    console.log('🔌 Connection Status 초기화 시작...');
    
    const {
        mockMode = false,
        mockOnline = true,
        showMockControls = false,
        indicatorPosition = 'top-right',
        indicatorOffsetX = 20,
        indicatorOffsetY = 20,
        // 🆕 v1.4.0: autoStart 기본값 false로 변경
        autoStart = false,
        debug = false
    } = options;
    
    const connectionStatusService = ConnectionStatusService.getInstance();
    
    connectionStatusService.configure({
        debug: debug,
        checkInterval: 5000,
        requestTimeout: 3000,
        failureThreshold: 2
    });
    
    if (mockMode) {
        connectionStatusService.enableMockMode({
            isOnline: mockOnline,
            responseDelay: 100
        });
        console.log('  ⚠️ Mock 모드 활성화됨');
    }
    
    // 🔧 v1.3.0: ConnectionIndicator 생성 비활성화 (오른쪽 상단 패널 제거)
    // const connectionIndicator = new ConnectionIndicator({
    //     position: indicatorPosition,
    //     offsetX: indicatorOffsetX,
    //     offsetY: indicatorOffsetY,
    //     showLabel: true,
    //     showTooltip: true,
    //     showMockControls: showMockControls,
    //     animate: true,
    //     size: 'medium'
    // });
    // console.log('  ✅ ConnectionIndicator UI 생성 완료');
    
    console.log('  ⚠️ ConnectionIndicator 비활성화됨 (v1.3.0)');
    const connectionIndicator = null;

    // 🆕 v1.4.0: autoStart 처리 변경 - 기본값이 false이므로 명시적으로 true일 때만 시작
    if (autoStart === true) {
        connectionStatusService.start();
        console.log('  ✅ ConnectionStatusService 즉시 시작됨 (autoStart: true)');
    } else {
        console.log('  ⏸️ ConnectionStatusService 대기 중 (autoStart: false)');
        console.log('    → startConnectionServiceForMode() 또는 startConnectionServiceDelayed() 호출 필요');
    }
    
    if (debug) {
        connectionStatusService.onStatusChanged((data) => {
            console.log(`[ConnectionStatus] 상태 변경: ${data.wasOnline ? 'ONLINE' : 'OFFLINE'} → ${data.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        });
    }
    
    console.log('✅ Connection Status 초기화 완료');
    
    return {
        connectionStatusService,
        connectionIndicator
    };
}

/**
 * 🆕 v1.4.0: 모드별 ConnectionStatusService 시작
 * 
 * Monitoring/Analysis/Dashboard 등 각 모드에 맞는 Health Check 엔드포인트로 시작
 * 
 * @param {ConnectionStatusService} connectionStatusService - ConnectionStatusService 인스턴스
 * @param {string} modeName - 모드 이름 ('monitoring', 'analysis', 'dashboard', 'edit', 'default')
 * @param {Object} [options] - 시작 옵션
 * @param {boolean} [options.immediate=true] - 즉시 시작 여부
 * @param {number} [options.delayMs=0] - 지연 시작 시간 (ms)
 * @param {Object} [options.configOverrides] - 설정 오버라이드
 * @returns {Promise<ConnectionStatusService>|ConnectionStatusService}
 * 
 * @example
 * // Monitoring 모드로 즉시 시작
 * startConnectionServiceForMode(connectionStatusService, 'monitoring');
 * 
 * // Analysis 모드로 2초 후 시작
 * await startConnectionServiceForMode(connectionStatusService, 'analysis', {
 *     immediate: false,
 *     delayMs: 2000
 * });
 */
export function startConnectionServiceForMode(connectionStatusService, modeName, options = {}) {
    if (!connectionStatusService) {
        console.warn('[UIBootstrap] connectionStatusService가 없습니다.');
        return null;
    }
    
    const {
        immediate = true,
        delayMs = 0,
        configOverrides = {}
    } = options;
    
    console.log(`🔌 ConnectionStatusService 시작: 모드=${modeName}, 즉시=${immediate}, 딜레이=${delayMs}ms`);
    
    return connectionStatusService.startForMode(modeName, {
        immediate,
        delayMs,
        configOverrides
    });
}

/**
 * 🆕 v1.4.0: 지연된 ConnectionStatusService 시작
 * 
 * 지정된 시간 후에 ConnectionStatusService 시작
 * 
 * @param {ConnectionStatusService} connectionStatusService - ConnectionStatusService 인스턴스
 * @param {number} delayMs - 지연 시간 (ms)
 * @param {Object} [options] - 시작 옵션
 * @returns {Promise<ConnectionStatusService>}
 * 
 * @example
 * // 2초 후 시작
 * await startConnectionServiceDelayed(connectionStatusService, 2000);
 * 
 * // 3초 후 특정 설정으로 시작
 * await startConnectionServiceDelayed(connectionStatusService, 3000, {
 *     config: { checkInterval: 10000 }
 * });
 */
export function startConnectionServiceDelayed(connectionStatusService, delayMs, options = {}) {
    if (!connectionStatusService) {
        console.warn('[UIBootstrap] connectionStatusService가 없습니다.');
        return Promise.resolve(null);
    }
    
    console.log(`🔌 ConnectionStatusService 지연 시작 예약: ${delayMs}ms 후`);
    
    return connectionStatusService.delayedStart(delayMs, options);
}

/**
 * 🆕 v1.4.0: Monitoring 초기화 완료 후 ConnectionStatusService 시작
 * 
 * MonitoringService.start() 완료 후 ConnectionStatusService를 Monitoring 모드로 시작
 * 
 * @param {ConnectionStatusService} connectionStatusService - ConnectionStatusService 인스턴스
 * @param {MonitoringService} monitoringService - MonitoringService 인스턴스
 * @param {Object} [options] - 옵션
 * @param {number} [options.startDelayMs=500] - 시작 지연 시간 (ms)
 * @returns {Function} 정리 함수 (이벤트 리스너 해제용)
 * 
 * @example
 * const cleanup = setupConnectionServiceAfterMonitoring(
 *     connectionStatusService, 
 *     monitoringService
 * );
 * 
 * // 나중에 정리
 * cleanup();
 */
export function setupConnectionServiceAfterMonitoring(
    connectionStatusService, 
    monitoringService, 
    options = {}
) {
    if (!connectionStatusService || !monitoringService) {
        console.warn('[UIBootstrap] connectionStatusService 또는 monitoringService가 없습니다.');
        return () => {};
    }
    
    const { startDelayMs = 500 } = options;
    
    // MonitoringService 이벤트 구독
    const handleStartComplete = (data) => {
        console.log(`🔌 Monitoring 시작 완료 감지 (${data.elapsed}ms) - ConnectionStatusService 시작`);
        
        // Monitoring 모드로 지연 시작
        startConnectionServiceForMode(connectionStatusService, ConnectionMode.MONITORING, {
            immediate: false,
            delayMs: startDelayMs
        });
    };
    
    // EventBus를 통해 이벤트 구독
    if (monitoringService.eventBus) {
        monitoringService.eventBus.on(MonitoringServiceEvents.START_COMPLETE, handleStartComplete);
        console.log('  ✅ Monitoring 완료 후 ConnectionStatusService 자동 시작 설정됨');
    } else {
        console.warn('  ⚠️ MonitoringService에 eventBus가 없어 자동 시작 설정 불가');
    }
    
    // 정리 함수 반환
    return () => {
        if (monitoringService.eventBus) {
            monitoringService.eventBus.off(MonitoringServiceEvents.START_COMPLETE, handleStartComplete);
        }
    };
}

/**
 * 🆕 Equipment Edit Button 초기화 (기존 버튼 인계 방식)
 * @param {Object} options - 초기화 옵션
 * @param {Object} options.equipmentEditModal - EquipmentEditModal 인스턴스
 * @param {Function} options.onEditRequest - Edit 요청 콜백 (toggleEditMode)
 * @returns {Object} { equipmentEditButton }
 */
export function initEquipmentEditButton(options = {}) {
    console.log('🛠️ Equipment Edit Button 초기화 시작...');
    
    const {
        equipmentEditModal = null,
        onEditRequest = null
    } = options;
    
    // 🔑 핵심: 기존 #editBtn 버튼을 인계받음
    const equipmentEditButton = new EquipmentEditButton({
        createButton: false,           // 새 버튼 생성하지 않음
        buttonId: 'editBtn',          // 기존 버튼 ID
        equipmentEditModal: equipmentEditModal,
        onEditRequest: onEditRequest,  // main.js의 toggleEditMode 연결
        showTooltip: true
    });
    
    console.log('  ✅ EquipmentEditButton 생성 완료 (기존 #editBtn 인계)');
    
    console.log('✅ Equipment Edit Button 초기화 완료');
    
    return {
        equipmentEditButton
    };
}

/**
 * UI 컴포넌트 초기화
 * 
 * 🆕 v1.4.0: connectionOptions.autoStart 기본값이 false로 변경됨
 * 
 * @param {Object} options - 초기화 옵션
 * @param {Object} options.connectionOptions - Connection Status 옵션
 * @param {Function} options.toggleEditMode - Edit 모드 토글 함수 (main.js에서 전달)
 * @returns {Object} 초기화된 UI 컴포넌트들
 */
export function initUIComponents(options = {}) {
    console.log('🖥️ UI 컴포넌트 초기화 시작...');
    
    // ConnectionModal 초기화
    const connectionModal = new ConnectionModal();
    console.log('  ✅ ConnectionModal 초기화 완료');
    
    // API Client 초기화
    const apiClient = new ApiClient();
    console.log('  ✅ ApiClient 초기화 완료');
    
    // Equipment Edit State 초기화
    const equipmentEditState = new EquipmentEditState();
    console.log('  ✅ EquipmentEditState 초기화 완료');
    
    // Equipment Edit Modal 초기화
    const equipmentEditModal = new EquipmentEditModal({
        editState: equipmentEditState,
        apiClient: apiClient
    });
    console.log('  ✅ EquipmentEditModal 초기화 완료');
    
	// 🆕 v1.2.0: EquipmentInfoPanel 초기화 (여기로 이동!)
	// ⭐ 동적 API URL
	const equipmentDetailApiUrl = `http://${window.location.hostname}:8008/api/equipment/detail`;
	const equipmentInfoPanel = new EquipmentInfoPanel({
	    apiBaseUrl: equipmentDetailApiUrl
	});
    
    // EquipmentEditState 연결 (매핑 정보 조회용)
    equipmentInfoPanel.setEquipmentEditState(equipmentEditState);
    console.log('  ✅ EquipmentInfoPanel 초기화 완료');
    
    // Connection Status 초기화
    // 🆕 v1.4.0: autoStart 기본값이 false이므로 명시적으로 전달하지 않으면 시작하지 않음
    const connectionOptions = options.connectionOptions || {};
    const { connectionStatusService, connectionIndicator } = initConnectionStatus(connectionOptions);
    
    // 🆕 Equipment Edit Button 초기화 (toggleEditMode는 나중에 main.js에서 설정)
    const { equipmentEditButton } = initEquipmentEditButton({
        equipmentEditModal: equipmentEditModal,
        onEditRequest: options.toggleEditMode || null
    });
    
    console.log('✅ UI 컴포넌트 초기화 완료');
    
    return {
        connectionModal,
        apiClient,
        equipmentEditState,
        equipmentEditModal,
        toast,
        connectionStatusService,
        connectionIndicator,
        equipmentEditButton,
        equipmentInfoPanel  // 🆕 v1.2.0: 추가
    };
}

/**
 * Monitoring 서비스 초기화
 * 
 * 🆕 v1.4.0: connectionStartTiming 옵션 추가
 * 
 * @param {Object} scene - Three.js Scene
 * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
 * @param {Object} [equipmentEditState] - EquipmentEditState 인스턴스
 * @param {Object} [connectionStatusService] - ConnectionStatusService 인스턴스
 * @param {Object} [options] - 추가 옵션
 * @param {string} [options.connectionStartTiming='after-monitoring'] - 연결 시작 타이밍
 *   - 'immediate': 즉시 시작 (기존 동작)
 *   - 'after-monitoring': Monitoring 초기화 완료 후 시작 (기본값)
 *   - 'manual': 수동 시작 (startConnectionServiceForMode 직접 호출)
 * @param {number} [options.connectionDelayMs=500] - 연결 시작 지연 시간 (ms)
 * @returns {Object} 초기화된 서비스들
 */
export function initMonitoringServices(
    scene, 
    equipmentLoader, 
    equipmentEditState = null, 
    connectionStatusService = null,
    options = {}
) {
    console.log('📡 Monitoring 서비스 초기화 시작...');
    
    const {
        connectionStartTiming = 'after-monitoring',
        connectionDelayMs = 500
    } = options;
    
    const signalTowerManager = new SignalTowerManager(scene, equipmentLoader);
    const lightCount = signalTowerManager.initializeAllLights();
    console.log(`  ✅ SignalTowerManager 초기화 완료: ${lightCount}개 설비의 경광등 연결`);
    
    const monitoringService = new MonitoringService(
        signalTowerManager,
        equipmentLoader,
        equipmentEditState
    );
    console.log('  ✅ MonitoringService 초기화 완료');
    
    // 🆕 v1.4.0: 연결 시작 타이밍 처리
    let connectionCleanup = null;
    
    if (connectionStatusService) {
        switch (connectionStartTiming) {
            case 'immediate':
                // 즉시 시작 (기존 동작)
                _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService);
                connectionStatusService.start();
                console.log('  ✅ ConnectionStatusService 즉시 시작됨');
                break;
                
            case 'after-monitoring':
                // Monitoring 초기화 완료 후 시작
                _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService);
                connectionCleanup = setupConnectionServiceAfterMonitoring(
                    connectionStatusService, 
                    monitoringService,
                    { startDelayMs: connectionDelayMs }
                );
                console.log('  ⏸️ ConnectionStatusService: Monitoring 완료 후 시작 예정');
                break;
                
            case 'manual':
                // 수동 시작
                _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService);
                console.log('  ⏸️ ConnectionStatusService: 수동 시작 모드 (직접 호출 필요)');
                break;
                
            default:
                _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService);
                console.log('  ✅ MonitoringService ↔ ConnectionStatus 연동 완료 (시작 안함)');
        }
    }
    
    if (equipmentEditState) {
        const mappingCount = equipmentEditState.getMappingCount();
        console.log(`  📊 현재 매핑된 설비: ${mappingCount}개`);
    }
    
    console.log('✅ Monitoring 서비스 초기화 완료');
    
    return {
        signalTowerManager,
        monitoringService,
        // 🆕 v1.4.0: 정리 함수 반환
        connectionCleanup
    };
}

/**
 * @private
 * Monitoring과 ConnectionStatus 연동 설정
 * 
 * 🐛 v1.2.1 수정: monitoringService.isActive() → monitoringService.isActive
 * - isActive는 함수가 아닌 boolean 속성임
 */
function _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService) {
    connectionStatusService.onOffline(() => {
        // 🐛 v1.2.1 수정: isActive는 속성(boolean)이므로 함수 호출() 제거
        if (monitoringService.isActive) {
            console.warn('[Monitoring] Backend 연결 끊김 - Monitoring 모드 종료');
            
            if (typeof toast !== 'undefined' && toast.show) {
                toast.show('Backend 연결이 끊겼습니다. Monitoring 모드를 종료합니다.', 'warning');
            }
            
            if (typeof monitoringService.stop === 'function') {
                monitoringService.stop();
            }
        }
    });
    
    connectionStatusService.onOnline((data) => {
        if (data.recoveredAfter > 0) {
            console.log(`[Monitoring] Backend 연결 복구됨 (${data.recoveredAfter}회 실패 후)`);
            
            if (typeof toast !== 'undefined' && toast.show) {
                toast.show('Backend 연결이 복구되었습니다.', 'success');
            }
        }
    });
    
    // 🆕 v1.4.0: 모드 변경 이벤트 리스닝
    connectionStatusService.onModeChanged((data) => {
        console.log(`[ConnectionStatus] 모드 변경: ${data.previousMode} → ${data.currentMode}`);
    });
}

/**
 * 🆕 Equipment Edit Button과 Selection 연동 설정
 * @param {EquipmentEditButton} equipmentEditButton
 * @param {Function} toggleEditMode - main.js의 toggleEditMode 함수
 */
export function connectEquipmentEditButton(equipmentEditButton, toggleEditMode) {
    if (!equipmentEditButton) {
        console.warn('[UIBootstrap] EquipmentEditButton이 없습니다.');
        return;
    }
    
    // Edit 요청 콜백 설정
    equipmentEditButton.setOnEditRequest(() => {
        toggleEditMode();
    });
    
    // 설비 선택 이벤트 연동
    eventBus.on('equipment:selected', (data) => {
        equipmentEditButton.setCurrentEquipment(data.equipment);
    });
    
    eventBus.on('equipment:deselected', () => {
        equipmentEditButton.setCurrentEquipment(null);
    });
    
    // Edit 모드 상태 동기화
    window.addEventListener('edit-mode-changed', (e) => {
        equipmentEditButton.setEditModeActive(e.detail.enabled);
    });
    
    console.log('[UIBootstrap] EquipmentEditButton 연동 완료');
}

// Legacy 함수들
export function initConnectionStatusStandalone(options = {}) {
    return initConnectionStatus(options);
}

export function toggleConnectionIndicator(indicator) {
    if (indicator) {
        indicator.toggle();
    }
}

export function togglePerformanceMonitorUI(performanceMonitorUI) {
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
    return performanceMonitorUI;
}

export function toggleDebugPanel() {
    const panel = document.getElementById('debugControls');
    const button = document.getElementById('debugToggle');
    
    if (panel && button) {
        panel.classList.toggle('active');
        button.classList.toggle('active');
        
        const isActive = panel.classList.contains('active');
        console.log(`🔧 디버그 패널: ${isActive ? '열림' : '닫힘'}`);
    } else {
        console.warn('debugControls 또는 debugToggle 요소를 찾을 수 없음');
    }
}

export { 
    toast, 
    DebugPanel, 
    PerformanceMonitorUI,
    ConnectionStatusService,
    // 🔧 v1.3.0: ConnectionIndicator export 제거
    // ConnectionIndicator,
    ConnectionEvents,
    // 🆕 v1.4.0: ConnectionState, ConnectionMode export 추가
    ConnectionState,
    ConnectionMode,
    EquipmentEditButton,
    EquipmentInfoPanel,  // 🆕 v1.2.0: export 추가
    // 🆕 v1.4.0: MonitoringServiceEvents export 추가
    MonitoringServiceEvents
};