/**
 * guides/index.js
 * =================
 * 
 * Guides 모듈 export 정리
 * 
 * @version 1.0.0 - Phase 1.5
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/guides/index.js
 */

// ES Module exports
export { SmartGuideManager } from './SmartGuideManager.js';
export { AlignmentGuide } from './AlignmentGuide.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.GuideModules = {
        SmartGuideManager: window.SmartGuideManager,
        AlignmentGuide: window.AlignmentGuide
    };
    
    console.log('[guides/index.js] Guides 모듈 export 완료');
}