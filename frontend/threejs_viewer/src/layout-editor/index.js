/**
 * layout-editor/index.js
 * ======================
 * 
 * Layout Editor 모듈 통합 export
 * 
 * @version 1.0.0 - Phase 4-1
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/index.js
 */

// Main Entry
export { LayoutEditorMain } from './LayoutEditorMain.js';

// Sub-modules
export * from './canvas/index.js';
export * from './commands/index.js';
export * from './components/index.js';
export * from './controllers/index.js';
export * from './export/index.js';
export * from './guides/index.js';
export * from './handles/index.js';
export * from './managers/index.js';
export * from './selection/index.js';
export * from './snap/index.js';
export * from './tools/index.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.LayoutEditorModules = {
        LayoutEditorMain: window.LayoutEditorMain
    };
    
    console.log('[layout-editor/index.js] Layout Editor 모듈 export 완료');
}