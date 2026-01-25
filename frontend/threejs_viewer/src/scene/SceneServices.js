/**
 * SceneServices.js
 * ================
 * Scene 서비스 초기화 및 연결 관리
 * 
 * @version 1.0.0
 * @description
 * - main.js의 initThreeJSScene()에서 서비스 연결 로직 분리
 * - DataOverlay, MonitoringService, InteractionHandler 연결
 * - ViewManager 서비스 업데이트
 * 
 * @changelog
 * - v1.0.0: Phase 4 - main.js에서 분리 (2026-01-25)
 *           - connectSceneServices() 추가
 *           - updateViewManagerServices() 추가
 *           - ensureMonitoringServiceStarted() 추가
 *           - ⚠️ 호환성: 기존 서비스 연결 로직 100% 유지
 * 
 * @dependencies
 * - ../app/AppState.js (getService, setService)
 * 
 * @exports
 * - connectSceneServices: Scene 서비스 연결
 * - updateViewManagerServices: ViewManager 서비스 업데이트
 * - ensureMonitoringServiceStarted: Monitoring 모드 서비스 시작 보정
 * 
 * 📁 위치: frontend/threejs_viewer/src/scene/SceneServices.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

import { getService, setService } from '../app/AppState.js';

// ============================================
// Scene 서비스 연결
// ============================================

/**
 * Scene 초기화 후 서비스 연결
 * 
 * @param {Object} options - 옵션
 * @param {Object} options.appModeManager - AppModeManager 인스턴스
 * @param {Object} options.eventBus - EventBus 인스턴스
 * @param {Function} options.connectServicesToModeHandlers - 모드 핸들러 연결 함수
 * 
 * @description
 * initThreeJSScene() 후에 호출하여 서비스 간 연결 설정
 * 
 * @example
 * connectSceneServices({
 *     appModeManager,
 *     eventBus,
 *     connectServicesToModeHandlers
 * });
 */
export function connectSceneServices({ appModeManager, eventBus, connectServicesToModeHandlers }) {
    console.log('[SceneServices] 🔗 Scene 서비스 연결 시작...');
    
    // 1. DataOverlay ↔ EquipmentInfoPanel 연결
    const dataOverlay = getService('scene.dataOverlay');
    const equipmentInfoPanel = getService('ui.equipmentInfoPanel');
    
    if (dataOverlay && equipmentInfoPanel) {
        dataOverlay.setEquipmentInfoPanel(equipmentInfoPanel);
        console.log('  ✅ DataOverlay ↔ EquipmentInfoPanel 연결');
    }
    
    // 2. MonitoringService ↔ EquipmentInfoPanel 연결
    const monitoringService = getService('monitoring.monitoringService');
    
    if (monitoringService && equipmentInfoPanel) {
        monitoringService.setEquipmentInfoPanel(equipmentInfoPanel);
        console.log('  ✅ MonitoringService ↔ EquipmentInfoPanel 연결');
    }
    
    // 3. MonitoringService에 EventBus 설정
    if (monitoringService && eventBus) {
        monitoringService.eventBus = eventBus;
        console.log('  ✅ MonitoringService EventBus 설정');
    }
    
    // 4. 모드 핸들러에 서비스 연결
    if (connectServicesToModeHandlers) {
        connectServicesToModeHandlers({
            equipmentEditState: getService('ui.equipmentEditState'),
            equipmentEditButton: getService('ui.equipmentEditButton'),
            monitoringService: getService('monitoring.monitoringService'),
            signalTowerManager: getService('monitoring.signalTowerManager')
        });
        console.log('  ✅ Mode Handlers 서비스 연결');
    }
    
    // 5. InteractionHandler 연결
    const interactionHandler = getService('scene.interactionHandler');
    const equipmentEditState = getService('ui.equipmentEditState');
    const equipmentEditModal = getService('ui.equipmentEditModal');
    
    if (interactionHandler) {
        if (appModeManager) {
            interactionHandler.setAppModeManager(appModeManager);
        }
        if (equipmentEditState) {
            interactionHandler.setEditMode(equipmentEditState);
        }
        if (equipmentEditModal) {
            interactionHandler.setEditModal(equipmentEditModal);
        }
        if (monitoringService) {
            interactionHandler.setMonitoringService(monitoringService);
        }
        console.log('  ✅ InteractionHandler 연결');
    }
    
    console.log('[SceneServices] ✅ Scene 서비스 연결 완료');
}

/**
 * ViewManager에 추가 서비스 주입
 * 
 * @param {Object} viewManager - ViewManager 인스턴스
 * 
 * @description
 * Scene 초기화 후 ViewManager에 WebSocket, Monitoring 등 서비스 주입
 */
export function updateViewManagerServices(viewManager) {
    if (!viewManager) {
        console.warn('[SceneServices] ⚠️ ViewManager 없음');
        return;
    }
    
    const monitoringService = getService('monitoring.monitoringService');
    const sceneManager = getService('scene.sceneManager');
    const signalTowerManager = getService('monitoring.signalTowerManager');
    
    // WebSocket 클라이언트 추가
    const wsManager = monitoringService?.getDataLoader?.()?.wsManager;
    if (wsManager) {
        viewManager.addService('webSocketClient', wsManager);
    }
    
    // 서비스 추가
    viewManager.addService('monitoringService', monitoringService);
    viewManager.addService('signalTowerManager', signalTowerManager);
    viewManager.addService('sceneManager', sceneManager);
    
    // Eager View 초기화
    viewManager.initEagerViews();
    
    console.log('[SceneServices] ✅ ViewManager 서비스 업데이트 완료');
}

/**
 * Monitoring 모드 서비스 시작 보정
 * 
 * @param {string} currentMode - 현재 앱 모드
 * @param {string} APP_MODE_MONITORING - MONITORING 상수 값
 * 
 * @description
 * Three.js 초기화 후 Monitoring 모드인 경우
 * MonitoringService가 아직 시작되지 않았으면 수동 시작
 * 
 * @example
 * const currentMode = appModeManager.getCurrentMode();
 * ensureMonitoringServiceStarted(currentMode, APP_MODE.MONITORING);
 */
export function ensureMonitoringServiceStarted(currentMode, APP_MODE_MONITORING) {
    if (currentMode !== APP_MODE_MONITORING) {
        return;
    }
    
    const monitoringService = getService('monitoring.monitoringService');
    
    if (monitoringService && !monitoringService.isActive) {
        console.log('[SceneServices] 🔧 MonitoringService 수동 시작 (타이밍 보정)');
        monitoringService.start();
    }
    
    console.log('[SceneServices] ✅ Monitoring 모드 서비스 타이밍 보정 완료');
}

/**
 * Scene 서비스 연결 상태 확인
 * 
 * @returns {Object} 연결 상태 정보
 */
export function getSceneServicesStatus() {
    return {
        dataOverlay: !!getService('scene.dataOverlay'),
        equipmentInfoPanel: !!getService('ui.equipmentInfoPanel'),
        monitoringService: !!getService('monitoring.monitoringService'),
        interactionHandler: !!getService('scene.interactionHandler'),
        sceneManager: !!getService('scene.sceneManager'),
        signalTowerManager: !!getService('monitoring.signalTowerManager')
    };
}

/**
 * Scene 서비스 디버그 정보 출력
 */
export function debugSceneServices() {
    const status = getSceneServicesStatus();
    
    console.group('🔗 SceneServices Debug');
    console.log('dataOverlay:', status.dataOverlay ? '✅' : '❌');
    console.log('equipmentInfoPanel:', status.equipmentInfoPanel ? '✅' : '❌');
    console.log('monitoringService:', status.monitoringService ? '✅' : '❌');
    console.log('interactionHandler:', status.interactionHandler ? '✅' : '❌');
    console.log('sceneManager:', status.sceneManager ? '✅' : '❌');
    console.log('signalTowerManager:', status.signalTowerManager ? '✅' : '❌');
    console.groupEnd();
}