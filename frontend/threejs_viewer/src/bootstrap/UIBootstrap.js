/**
 * UIBootstrap.js
 * ==============
 * 
 * UI 컴포넌트 초기화 담당
 * 
 * @version 1.1.0
 * @module UIBootstrap
 * 
 * @changelog
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

import { MonitoringService } from '../services/MonitoringService.js';
import { SignalTowerManager } from '../services/SignalTowerManager.js';

// Connection Status 관련 import
import ConnectionStatusService, { ConnectionEvents } from '../services/ConnectionStatusService.js';
import ConnectionIndicator from '../ui/ConnectionIndicator.js';

// EventBus import
import { eventBus } from '../core/managers/EventBus.js';

/**
 * Connection Status 서비스 및 UI 초기화
 * @param {Object} options - 초기화 옵션
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
        autoStart = true,
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
    
    const connectionIndicator = new ConnectionIndicator({
        position: indicatorPosition,
        offsetX: indicatorOffsetX,
        offsetY: indicatorOffsetY,
        showLabel: true,
        showTooltip: true,
        showMockControls: showMockControls,
        animate: true,
        size: 'medium'
    });
    console.log('  ✅ ConnectionIndicator UI 생성 완료');
    
    if (autoStart) {
        connectionStatusService.start();
        console.log('  ✅ ConnectionStatusService 시작됨');
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
    
    // Connection Status 초기화
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
        equipmentEditButton
    };
}

/**
 * Monitoring 서비스 초기화
 */
export function initMonitoringServices(scene, equipmentLoader, equipmentEditState = null, connectionStatusService = null) {
    console.log('📡 Monitoring 서비스 초기화 시작...');
    
    const signalTowerManager = new SignalTowerManager(scene, equipmentLoader);
    const lightCount = signalTowerManager.initializeAllLights();
    console.log(`  ✅ SignalTowerManager 초기화 완료: ${lightCount}개 설비의 경광등 연결`);
    
    const monitoringService = new MonitoringService(
        signalTowerManager,
        equipmentLoader,
        equipmentEditState
    );
    console.log('  ✅ MonitoringService 초기화 완료');
    
    if (connectionStatusService) {
        _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService);
        console.log('  ✅ MonitoringService ↔ ConnectionStatus 연동 완료');
    }
    
    if (equipmentEditState) {
        const mappingCount = equipmentEditState.getMappingCount();
        console.log(`  📊 현재 매핑된 설비: ${mappingCount}개`);
    }
    
    console.log('✅ Monitoring 서비스 초기화 완료');
    
    return {
        signalTowerManager,
        monitoringService
    };
}

/**
 * @private
 */
function _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService) {
    connectionStatusService.onOffline(() => {
        if (monitoringService.isActive && monitoringService.isActive()) {
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
    ConnectionIndicator,
    ConnectionEvents,
    EquipmentEditButton
};