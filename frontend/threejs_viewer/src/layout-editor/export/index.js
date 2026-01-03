/**
 * export/index.js
 * ================
 * 
 * Export 모듈 통합 Export
 * 
 * @version 1.0.0 - Phase 4
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/export/index.js
 */

// 브라우저 환경에서 전역 객체 확인 및 export
if (typeof window !== 'undefined') {
    // LayoutExporter가 로드되었는지 확인
    if (typeof LayoutExporter !== 'undefined') {
        window.LayoutExporter = LayoutExporter;
    }
}

// ES6 Module export (빌드 환경용)
// export { LayoutExporter } from './LayoutExporter.js';