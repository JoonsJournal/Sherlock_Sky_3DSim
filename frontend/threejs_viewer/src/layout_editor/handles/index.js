/**
 * handles/index.js
 * ==================
 * 
 * Handles 모듈 export 정리
 * 
 * @version 1.0.0 - Phase 1.5
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/handles/index.js
 */

// ES Module exports
export { HandleManager } from './HandleManager.js';
export { ResizeHandle } from './ResizeHandle.js';
export { RotateHandle } from './RotateHandle.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.HandleModules = {
        HandleManager: window.HandleManager,
        ResizeHandle: window.ResizeHandle,
        RotateHandle: window.RotateHandle
    };
    
    console.log('[handles/index.js] Handles 모듈 export 완료');
}