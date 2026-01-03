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
 * 
 * @version 1.0.0
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

/**
 * UI 컴포넌트 초기화
 * @returns {Object} 초기화된 UI 컴포넌트들
 */
export function initUIComponents() {
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
    
    console.log('✅ UI 컴포넌트 초기화 완료');
    
    return {
        connectionModal,
        apiClient,
        equipmentEditState,
        equipmentEditModal,
        toast
    };
}

/**
 * Monitoring 서비스 초기화
 * @param {Object} scene - THREE.Scene
 * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
 * @returns {Object} 초기화된 모니터링 서비스들
 */
export function initMonitoringServices(scene, equipmentLoader) {
    console.log('📡 Monitoring 서비스 초기화 시작...');
    
    // Signal Tower Manager 초기화
    const signalTowerManager = new SignalTowerManager(scene, equipmentLoader);
    
    // 기존 equipment1.js의 경광등 램프들을 찾아서 초기화
    const lightCount = signalTowerManager.initializeAllLights();
    console.log(`  ✅ SignalTowerManager 초기화 완료: ${lightCount}개 설비의 경광등 연결`);
    
    // Monitoring Service 초기화
    const monitoringService = new MonitoringService(signalTowerManager);
    console.log('  ✅ MonitoringService 초기화 완료');
    
    console.log('✅ Monitoring 서비스 초기화 완료');
    
    return {
        signalTowerManager,
        monitoringService
    };
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

export { toast, DebugPanel, PerformanceMonitorUI };