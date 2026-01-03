/**
 * canvas/index.js
 * ================
 * 
 * Canvas 모듈 export 정리
 * 
 * @version 1.0.0 - Phase 1.5
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/canvas/index.js
 */

// ES Module exports
export { LayerManager } from './LayerManager.js';
export { CanvasRenderer } from './CanvasRenderer.js';
export { CanvasEventHandler } from './CanvasEventHandler.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    // 개별 클래스 접근용
    window.CanvasModules = {
        LayerManager: window.LayerManager,
        CanvasRenderer: window.CanvasRenderer,
        CanvasEventHandler: window.CanvasEventHandler
    };
    
    console.log('[canvas/index.js] Canvas 모듈 export 완료');
}