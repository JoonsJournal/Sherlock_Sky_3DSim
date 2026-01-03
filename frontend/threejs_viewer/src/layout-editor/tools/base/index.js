/**
 * tools/base/index.js
 * ====================
 * 
 * 도구 기본 클래스 export
 * 
 * @version 1.0.0 - Phase 1.5
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/tools/base/index.js
 */

// ES Module exports
export { BaseTool } from './BaseTool.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    console.log('[tools/base/index.js] BaseTool export 완료');
}