/**
 * managers/index.js
 * =================
 * 
 * Layout Editor 매니저 모듈 export
 * 
 * @version 1.0.0 - Phase 4-1
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/managers/index.js
 */

// ES Module exports
export { RoomSizeManager } from './RoomSizeManager.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.LayoutEditorManagers = {
        RoomSizeManager: window.RoomSizeManager
    };
    
    console.log('[managers/index.js] Layout Editor 매니저 모듈 export 완료');
}