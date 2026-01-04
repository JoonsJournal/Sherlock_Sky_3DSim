/**
 * UIBootstrap.js
 * ==============
 * 
 * UI 컴포넌트 초기화 담당
 * - ConnectionModal
 * - EquipmentEditModal
 * - ApiClient
 * - EquipmentEditState
 * - MonitoringService
 * - SignalTowerManager
 * - ConnectionStatusService (🆕 추가)
 * - ConnectionIndicator (🆕 추가)
 * 
 * @version 1.1.0
 * @module UIBootstrap
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/UIBootstrap.js
 */

import { ConnectionModal } from '../ui/ConnectionModal.js';
import { EquipmentEditModal } from '../ui/EquipmentEditModal.js';
import { toast } from '../ui/common/Toast.js';
import { DebugPanel } from '../ui/debug/DebugPanel.js';
import { PerformanceMonitorUI } from '../ui/debug/PerformanceMonitorUI.js';

import { EquipmentEditState } from '../services/EquipmentEditState.js';
import { ApiClient } from '../api/ApiClient.js';

import { MonitoringService } from '../services/MonitoringService.js';
import { SignalTowerManager } from '../services/SignalTowerManager.js';

// 🆕 Connection Status 관련 import
import ConnectionStatusService, { ConnectionEvents } from '../services/ConnectionStatusService.js';
import ConnectionIndicator from '../ui/ConnectionIndicator.js';

/**
 * 🆕 Connection Status 서비스 및 UI 초기화
 * @param {Object} options - 초기화 옵션
 * @param {boolean} options.mockMode - Mock 모드 활성화 여부 (개발용)
 * @param {boolean} options.showMockControls - Mock 컨트롤 표시 여부
 * @param {string} options.indicatorPosition - 인디케이터 위치
 * @param {boolean} options.autoStart - 자동 시작 여부
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
    
    // ConnectionStatusService 인스턴스 가져오기
    const connectionStatusService = ConnectionStatusService.getInstance();
    
    // 서비스 설정
    connectionStatusService.configure({
        debug: debug,
        checkInterval: 5000,      // 5초마다 체크
        requestTimeout: 3000,     // 3초 타임아웃
        failureThreshold: 2       // 2회 실패 시 오프라인 판정
    });
    
    // Mock 모드 설정 (개발/테스트용)
    if (mockMode) {
        connectionStatusService.enableMockMode({
            isOnline: mockOnline,
            responseDelay: 100
        });
        console.log('  ⚠️ Mock 모드 활성화됨');
    }
    
    // ConnectionIndicator UI 생성
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
    
    // 서비스 자동 시작
    if (autoStart) {
        connectionStatusService.start();
        console.log('  ✅ ConnectionStatusService 시작됨');
    }
    
    // 상태 변경 로깅 (디버그용)
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
 * UI 컴포넌트 초기화
 * @param {Object} options - 초기화 옵션
 * @param {Object} options.connectionOptions - Connection Status 옵션
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
    
    // 🆕 Connection Status 초기화
    const connectionOptions = options.connectionOptions || {};
    const { connectionStatusService, connectionIndicator } = initConnectionStatus(connectionOptions);
    
    console.log('✅ UI 컴포넌트 초기화 완료');
    
    return {
        connectionModal,
        apiClient,
        equipmentEditState,
        equipmentEditModal,
        toast,
        // 🆕 Connection Status 관련
        connectionStatusService,
        connectionIndicator
    };
}

/**
 * Monitoring 서비스 초기화
 * @param {Object} scene - THREE.Scene
 * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
 * @param {Object} equipmentEditState - EquipmentEditState 인스턴스 (⭐ 추가)
 * @param {Object} connectionStatusService - ConnectionStatusService 인스턴스 (🆕 추가)
 * @returns {Object} 초기화된 모니터링 서비스들
 */
export function initMonitoringServices(scene, equipmentLoader, equipmentEditState = null, connectionStatusService = null) {
    console.log('📡 Monitoring 서비스 초기화 시작...');
    
    // Signal Tower Manager 초기화
    const signalTowerManager = new SignalTowerManager(scene, equipmentLoader);
    
    // 기존 equipment1.js의 경광등 램프들을 찾아서 초기화
    const lightCount = signalTowerManager.initializeAllLights();
    console.log(`  ✅ SignalTowerManager 초기화 완료: ${lightCount}개 설비의 경광등 연결`);
    
    // ⭐ Monitoring Service 초기화 - equipmentLoader, equipmentEditState 전달
    const monitoringService = new MonitoringService(
        signalTowerManager,
        equipmentLoader,        // ⭐ 추가
        equipmentEditState      // ⭐ 추가
    );
    console.log('  ✅ MonitoringService 초기화 완료');
    
    // 🆕 Connection Status와 Monitoring Service 연동
    if (connectionStatusService) {
        _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService);
        console.log('  ✅ MonitoringService ↔ ConnectionStatus 연동 완료');
    }
    
    // ⭐ 매핑 통계 출력
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
 * 🆕 Monitoring Service와 Connection Status 연동 설정
 * @private
 * @param {MonitoringService} monitoringService 
 * @param {ConnectionStatusService} connectionStatusService 
 */
function _setupMonitoringConnectionIntegration(monitoringService, connectionStatusService) {
    // 오프라인 시 Monitoring 모드 자동 종료
    connectionStatusService.onOffline(() => {
        if (monitoringService.isActive && monitoringService.isActive()) {
            console.warn('[Monitoring] Backend 연결 끊김 - Monitoring 모드 종료');
            
            // Toast 알림
            if (typeof toast !== 'undefined' && toast.show) {
                toast.show('Backend 연결이 끊겼습니다. Monitoring 모드를 종료합니다.', 'warning');
            }
            
            // Monitoring 모드 종료 (해당 메서드가 있는 경우)
            if (typeof monitoringService.stop === 'function') {
                monitoringService.stop();
            }
        }
    });
    
    // 온라인 복구 시 알림
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
 * 🆕 Connection Status 단독 초기화 (필요 시 별도 호출용)
 * main.js에서 initUIComponents 없이 Connection만 초기화할 때 사용
 * @param {Object} options - 옵션
 * @returns {Object} { connectionStatusService, connectionIndicator }
 */
export function initConnectionStatusStandalone(options = {}) {
    return initConnectionStatus(options);
}

/**
 * 🆕 Connection Indicator 토글
 * @param {ConnectionIndicator} indicator - ConnectionIndicator 인스턴스
 */
export function toggleConnectionIndicator(indicator) {
    if (indicator) {
        indicator.toggle();
    }
}

/**
 * 성능 모니터 UI 생성/토글
 * @param {Object} performanceMonitorUI - 기존 인스턴스 (있으면)
 * @returns {Object} PerformanceMonitorUI 인스턴스
 */
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

/**
 * 디버그 패널 토글
 */
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

// 🆕 Connection 관련 export 추가
export { 
    toast, 
    DebugPanel, 
    PerformanceMonitorUI,
    ConnectionStatusService,
    ConnectionIndicator,
    ConnectionEvents
};