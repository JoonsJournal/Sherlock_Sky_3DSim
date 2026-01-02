/**
 * snap/index.js
 * ===============
 * 
 * Snap 모듈 export 정리
 * 
 * @version 1.0.0 - Phase 1.5
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/snap/index.js
 */

// ES Module exports
export { SnapManager } from './SnapManager.js';
export { GridSnap } from './GridSnap.js';
export { MICESnapPoints } from './MICESnapPoints.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.SnapModules = {
        SnapManager: window.SnapManager,
        GridSnap: window.GridSnap,
        MICESnapPoints: window.MICESnapPoints
    };
    
    console.log('[snap/index.js] Snap 모듈 export 완료');
}