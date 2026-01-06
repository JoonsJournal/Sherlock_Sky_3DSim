/**
 * CoreBootstrap.js
 * ================
 * 
 * Core 매니저 초기화 담당
 * - AppModeManager 모드 등록
 * - KeyboardManager 컨텍스트 설정
 * - EventBus 설정
 * 
 * @version 2.0.0
 * @module CoreBootstrap
 * 
 * @changelog
 * - v2.0.0: ModeHandlers 분리, 서비스 연결은 main.js에서 처리
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/CoreBootstrap.js
 */

import { appModeManager } from '../core/managers/AppModeManager.js';
import { keyboardManager } from '../core/managers/KeyboardManager.js';
import { debugManager } from '../core/managers/DebugManager.js';
import { eventBus } from '../core/managers/EventBus.js';
import { logger } from '../core/managers/Logger.js';

import { 
    APP_MODE,
    KEYBOARD_CONTEXT,
    EVENT_NAME
} from '../core/config/constants.js';

import { CONFIG } from '../core/utils/Config.js';

// 🆕 v2.0.0: ModeHandlers import
import { 
    registerAllModeHandlers, 
    connectModeHandlerServices,
    modeHandlers,
    syncAllButtonStates
} from '../core/managers/ModeHandlers.js';

/**
 * Core 매니저 초기화
 * @param {Object} options - 초기화 옵션
 * @param {boolean} options.registerHandlers - 모드 핸들러 등록 여부 (기본: true)
 */
export function initCoreManagers(options = {}) {
    console.log('🔧 Core 매니저 초기화...');
    
    const { registerHandlers = true } = options;
    
    // 1. 🆕 v2.0.0: 모드 핸들러 등록 (서비스 연결은 나중에)
    if (registerHandlers) {
        registerAllModeHandlers(appModeManager);
        console.log('  ✅ 모드 핸들러 등록 완료');
    }
    
    // 2. 이벤트 버스 히스토리 활성화 (디버그 모드일 때)
    if (CONFIG.DEBUG_MODE) {
        eventBus.enableHistory(true);
    }
    
    // 3. 기본 모드 설정 (main_viewer)
    appModeManager.switchMode(APP_MODE.MAIN_VIEWER, { skipConnectionCheck: true });
    
    console.log('✅ Core 매니저 초기화 완료');
    
    return {
        appModeManager,
        keyboardManager,
        debugManager,
        eventBus,
        logger
    };
}

/**
 * 🆕 v2.0.0: 모드 핸들러에 서비스 연결
 * main.js에서 모든 서비스 초기화 후 호출
 * 
 * @param {Object} services - 서비스 객체들
 * @param {Object} services.equipmentEditState - EquipmentEditState 인스턴스
 * @param {Object} services.equipmentEditButton - EquipmentEditButton 인스턴스
 * @param {Object} services.monitoringService - MonitoringService 인스턴스
 * @param {Object} services.signalTowerManager - SignalTowerManager 인스턴스
 */
export function connectServicesToModeHandlers(services) {
    connectModeHandlerServices(services);
    console.log('  ✅ 모드 핸들러 서비스 연결 완료');
}

/**
 * 모드 관련 유틸리티 함수들
 */
export const modeUtils = {
    getCurrentMode: () => appModeManager.getCurrentMode(),
    switchMode: (mode) => appModeManager.switchMode(mode),
    toggleMode: (mode) => appModeManager.toggleMode(mode),
    isEditMode: () => appModeManager.getCurrentMode() === APP_MODE.EQUIPMENT_EDIT,
    isMonitoringMode: () => appModeManager.getCurrentMode() === APP_MODE.MONITORING,
    isMainViewerMode: () => appModeManager.getCurrentMode() === APP_MODE.MAIN_VIEWER,
    syncButtonStates: (mode) => syncAllButtonStates(mode)
};

export {
    appModeManager,
    keyboardManager,
    debugManager,
    eventBus,
    logger,
    APP_MODE,
    KEYBOARD_CONTEXT,
    EVENT_NAME,
    // 🆕 v2.0.0: ModeHandlers export
    registerAllModeHandlers,
    connectModeHandlerServices,
    modeHandlers
};