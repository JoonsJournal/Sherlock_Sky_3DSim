/**
 * selection/index.js
 * ===================
 * 
 * Selection 모듈 통합 Export
 * 
 * @version 1.1.0 - Phase 4
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/selection/index.js
 */

// 브라우저 환경에서 전역 객체 확인 및 export
if (typeof window !== 'undefined') {
    // Selection2DManager
    if (typeof Selection2DManager !== 'undefined') {
        window.Selection2DManager = Selection2DManager;
    }
    
    // SelectionRenderer
    if (typeof SelectionRenderer !== 'undefined') {
        window.SelectionRenderer = SelectionRenderer;
    }
    
    // FenceSelection
    if (typeof FenceSelection !== 'undefined') {
        window.FenceSelection = FenceSelection;
    }
}

// ES6 Module export (빌드 환경용)
// export { Selection2DManager } from './Selection2DManager.js';
// export { SelectionRenderer } from './SelectionRenderer.js';
// export { FenceSelection } from './FenceSelection.js';