/**
 * controllers/index.js
 * ====================
 * 
 * Layout Editor 컨트롤러 모듈 export
 * 
 * @version 1.0.0 - Phase 4-1
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/controllers/index.js
 */

// ES Module exports
export { ZoomController } from './ZoomController.js';
export { InfiniteGridZoomController } from './InfiniteGridZoomController.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.LayoutEditorControllers = {
        ZoomController: window.ZoomController,
        InfiniteGridZoomController: window.InfiniteGridZoomController
    };
    
    console.log('[controllers/index.js] Layout Editor 컨트롤러 모듈 export 완료');
}