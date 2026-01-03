/**
 * utils/index.js
 * ==============
 * 
 * Core 유틸리티 모듈 export
 * 
 * @version 1.0.0 - Phase 4-1
 * 
 * 위치: frontend/threejs_viewer/src/core/utils/index.js
 */

// ES Module exports
export { AdaptivePerformance } from './AdaptivePerformance.js';
export { Config } from './Config.js';
export { GlobalDebugFunctions } from './GlobalDebugFunctions.js';
export { Helpers } from './Helpers.js';
export { MemoryManager } from './MemoryManager.js';
export { PerformanceMonitor } from './PerformanceMonitor.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.CoreUtils = {
        AdaptivePerformance: window.AdaptivePerformance,
        Config: window.Config,
        GlobalDebugFunctions: window.GlobalDebugFunctions,
        Helpers: window.Helpers,
        MemoryManager: window.MemoryManager,
        PerformanceMonitor: window.PerformanceMonitor
    };
    
    console.log('[utils/index.js] Core 유틸리티 모듈 export 완료');
}