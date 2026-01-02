/**
 * guides/index.js
 * =================
 * 
 * Guides 모듈 export 정리
 * 
 * @version 1.1.0 - Phase 1.5
 * @updated 2026-01-02 - DistributionGuide 추가
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/guides/index.js
 */

// ES Module exports
export { SmartGuideManager } from './SmartGuideManager.js';
export { AlignmentGuide } from './AlignmentGuide.js';
export { DistributionGuide } from './DistributionGuide.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.GuideModules = {
        SmartGuideManager: window.SmartGuideManager,
        AlignmentGuide: window.AlignmentGuide,
        DistributionGuide: window.DistributionGuide
    };
    
    console.log('[guides/index.js] Guides 모듈 export 완료 (SmartGuideManager, AlignmentGuide, DistributionGuide)');
}