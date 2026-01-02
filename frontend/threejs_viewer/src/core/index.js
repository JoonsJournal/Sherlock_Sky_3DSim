/**
 * core/index.js
 * Core 모듈 전체 통합 export
 * 
 * @version 1.0.0
 * @description Sherlock Sky 3D Sim 핵심 모듈
 */

// =====================================================
// Config
// =====================================================
export * from './config/index.js';

// =====================================================
// Managers
// =====================================================
export * from './managers/index.js';

// =====================================================
// Base Classes
// =====================================================
export * from './base/index.js';

// =====================================================
// Errors
// =====================================================
export * from './errors/index.js';

// =====================================================
// 초기화 함수
// =====================================================

import { keyboardManager } from './managers/KeyboardManager.js';
import { errorHandler } from './errors/ErrorHandler.js';
import { debugManager } from './managers/DebugManager.js';
import { SETTINGS } from './config/settings.js';

/**
 * Core 모듈 초기화
 * @param {Object} options - 초기화 옵션
 * @param {boolean} options.debug - 디버그 모드 활성화
 * @param {boolean} options.keyboard - 키보드 매니저 시작
 * @param {boolean} options.errorHandler - 에러 핸들러 초기화
 */
export function initCore(options = {}) {
    const {
        debug = SETTINGS.DEBUG_MODE,
        keyboard = true,
        errorHandler: initErrorHandler = true
    } = options;
    
    console.log('[Core] 초기화 시작...');
    
    // 디버그 모드
    if (debug) {
        debugManager.enable();
    }
    
    // 키보드 매니저
    if (keyboard) {
        keyboardManager.start();
    }
    
    // 에러 핸들러
    if (initErrorHandler) {
        errorHandler.init();
    }
    
    console.log('[Core] 초기화 완료');
    
    return {
        debugManager,
        keyboardManager,
        errorHandler
    };
}

/**
 * Core 모듈 정리
 */
export function destroyCore() {
    console.log('[Core] 정리 시작...');
    
    keyboardManager.stop();
    debugManager.disable();
    
    console.log('[Core] 정리 완료');
}

// 전역 노출 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.SherlockCore = {
        initCore,
        destroyCore
    };
}