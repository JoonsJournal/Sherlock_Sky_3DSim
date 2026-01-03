/**
 * CoreBootstrap.js
 * ================
 * 
 * Core 매니저 초기화 담당
 * - AppModeManager 모드 등록
 * - KeyboardManager 컨텍스트 설정
 * - EventBus 설정
 * 
 * @version 1.0.0
 * @module CoreBootstrap
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

/**
 * Core 매니저 초기화
 * @param {Object} services - 서비스 객체들 (monitoringService 등)
 */
export function initCoreManagers(services = {}) {
    console.log('🔧 Core 매니저 초기화...');
    
    const { monitoringService } = services;
    
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
    
    // 2. 이벤트 버스 히스토리 활성화 (디버그 모드일 때)
    if (CONFIG.DEBUG_MODE) {
        eventBus.enableHistory(true);
    }
    
    // 3. 기본 모드 설정
    appModeManager.switchMode(APP_MODE.MAIN_VIEWER);
    
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
 * 모드 관련 유틸리티 함수들
 */
export const modeUtils = {
    getCurrentMode: () => appModeManager.getCurrentMode(),
    switchMode: (mode) => appModeManager.switchMode(mode),
    isEditMode: () => appModeManager.getCurrentMode() === APP_MODE.EQUIPMENT_EDIT,
    isMonitoringMode: () => appModeManager.getCurrentMode() === APP_MODE.MONITORING,
    isMainViewerMode: () => appModeManager.getCurrentMode() === APP_MODE.MAIN_VIEWER
};

export {
    appModeManager,
    keyboardManager,
    debugManager,
    eventBus,
    logger,
    APP_MODE,
    KEYBOARD_CONTEXT,
    EVENT_NAME
};