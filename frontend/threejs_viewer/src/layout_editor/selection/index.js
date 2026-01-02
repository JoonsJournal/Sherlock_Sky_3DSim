/**
 * selection/index.js
 * ===================
 * 
 * Selection 모듈 export 정리
 * 
 * @version 1.0.0 - Phase 1.5
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/selection/index.js
 */

// ES Module exports
export { Selection2DManager } from './Selection2DManager.js';
export { SelectionRenderer } from './SelectionRenderer.js';
export { FenceSelection } from './FenceSelection.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    // 개별 클래스 접근용
    window.SelectionModules = {
        Selection2DManager: window.Selection2DManager,
        SelectionRenderer: window.SelectionRenderer,
        FenceSelection: window.FenceSelection
    };
    
    console.log('[selection/index.js] Selection 모듈 export 완료');
}