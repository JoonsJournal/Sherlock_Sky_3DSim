/**
 * scene/index.js
 * ==============
 * Scene 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - SceneController, SceneRenderer, SceneServices 통합 export
 * - 하위 호환 별칭 제공
 * 
 * @changelog
 * - v1.0.0: Phase 4 - 모듈 생성 (2026-01-25)
 * 
 * @usage
 * // 권장 import 방식
 * import { sceneController, animate, startAnimationLoop } from './scene/index.js';
 * 
 * // 또는 개별 모듈 import
 * import { sceneController } from './scene/SceneController.js';
 * import { animate } from './scene/SceneRenderer.js';
 * 
 * 📁 위치: frontend/threejs_viewer/src/scene/index.js
 * 작성일: 2026-01-25
 */

// ============================================
// SceneController
// ============================================
export { 
    SceneController,
    sceneController,
    screenManager  // 하위 호환 별칭
} from './SceneController.js';

// ============================================
// SceneRenderer
// ============================================
export {
    animate,
    startAnimationLoop,
    stopAnimationLoop,
    isAnimationRunning,
    setPerformanceMonitorUI,
    getAnimationFrameId,
    debugSceneRenderer
} from './SceneRenderer.js';

// ============================================
// SceneServices
// ============================================
export {
    connectSceneServices,
    updateViewManagerServices,
    ensureMonitoringServiceStarted,
    getSceneServicesStatus,
    debugSceneServices
} from './SceneServices.js';