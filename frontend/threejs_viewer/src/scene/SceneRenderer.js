/**
 * SceneRenderer.js
 * ================
 * Three.js 애니메이션 렌더링 루프 관리
 * 
 * @version 1.0.0
 * @description
 * - main.js에서 분리된 animate() 함수
 * - 렌더 루프 시작/중지 관리
 * - 서비스별 update() 호출 조율
 * 
 * @changelog
 * - v1.0.0: Phase 4 - main.js에서 분리 (2026-01-25)
 *           - animate() 함수 이동
 *           - startAnimationLoop() 이동
 *           - stopAnimationLoop() 이동
 *           - ⚠️ 호환성: 기존 모든 렌더링 로직 100% 유지
 * 
 * @dependencies
 * - ../app/AppState.js (getService)
 * 
 * @exports
 * - animate: 애니메이션 루프 함수
 * - startAnimationLoop: 애니메이션 시작
 * - stopAnimationLoop: 애니메이션 중지
 * - isAnimationRunning: 실행 상태 조회
 * - setPerformanceMonitorUI: UI 설정
 * 
 * 📁 위치: frontend/threejs_viewer/src/scene/SceneRenderer.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

import { getService } from '../app/AppState.js';

// ============================================
// 상태 변수
// ============================================

/** @type {number|null} requestAnimationFrame ID */
let animationFrameId = null;

/** @type {boolean} 애니메이션 실행 중 여부 */
let isRunning = false;

/** @type {Object|null} PerformanceMonitorUI 참조 (main.js에서 설정) */
let performanceMonitorUI = null;

// ============================================
// 애니메이션 루프
// ============================================

/**
 * 메인 애니메이션 루프
 * 
 * @description
 * requestAnimationFrame을 사용한 렌더 루프
 * 각 프레임마다 다음을 수행:
 * 1. 카메라 컨트롤 업데이트
 * 2. 상태 시각화 애니메이션
 * 3. SignalTower 애니메이션
 * 4. Scene 렌더링
 * 5. 성능 모니터링 업데이트
 */
export function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    // 서비스 참조 획득 (매 프레임)
    const cameraControls = getService('scene.cameraControls');
    const statusVisualizer = getService('scene.statusVisualizer');
    const sceneManager = getService('scene.sceneManager');
    const performanceMonitor = getService('scene.performanceMonitor');
    const adaptivePerformance = getService('scene.adaptivePerformance');
    const signalTowerManager = getService('monitoring.signalTowerManager');
    
    // 1. 카메라 컨트롤 업데이트
    if (cameraControls) {
        cameraControls.update();
    }
    
    // 2. 상태 시각화 애니메이션
    if (statusVisualizer) {
        statusVisualizer.animateErrorStatus();
    }
    
    // 3. SignalTower 애니메이션 (16ms = 60fps)
    if (signalTowerManager) {
        signalTowerManager.animate(0.016);
    }
    
    // 4. Scene 렌더링
    if (sceneManager) {
        sceneManager.render();
    }
    
    // 5. 성능 모니터 업데이트
    if (performanceMonitor) {
        performanceMonitor.update();
    }
    
    // 6. 적응형 성능 업데이트
    if (adaptivePerformance) {
        adaptivePerformance.update();
    }
    
    // 7. PerformanceMonitorUI 업데이트 (선택적)
    if (performanceMonitorUI?.isVisible?.()) {
        performanceMonitorUI.recordFrame();
        if (sceneManager?.renderer) {
            performanceMonitorUI.setRenderInfo(sceneManager.renderer.info);
        }
    }
}

// ============================================
// 애니메이션 제어 함수
// ============================================

/**
 * 애니메이션 루프 시작
 * 
 * @returns {boolean} 시작 성공 여부
 * 
 * @example
 * import { startAnimationLoop } from './scene/SceneRenderer.js';
 * 
 * if (startAnimationLoop()) {
 *     console.log('애니메이션 시작됨');
 * }
 */
export function startAnimationLoop() {
    if (isRunning) {
        console.log('[SceneRenderer] ⚠️ 이미 실행 중');
        return false;
    }
    
    if (!getService('scene')) {
        console.warn('[SceneRenderer] ⚠️ scene 서비스 없음 - 시작 불가');
        return false;
    }
    
    isRunning = true;
    animate();
    console.log('[SceneRenderer] ▶️ 애니메이션 시작');
    
    return true;
}

/**
 * 애니메이션 루프 중지
 * 
 * @returns {boolean} 중지 성공 여부
 * 
 * @example
 * import { stopAnimationLoop } from './scene/SceneRenderer.js';
 * stopAnimationLoop();
 */
export function stopAnimationLoop() {
    if (!isRunning) {
        return false;
    }
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    isRunning = false;
    console.log('[SceneRenderer] ⏹️ 애니메이션 중지');
    
    return true;
}

/**
 * 애니메이션 실행 상태 조회
 * 
 * @returns {boolean}
 */
export function isAnimationRunning() {
    return isRunning;
}

/**
 * PerformanceMonitorUI 설정
 * 
 * @param {Object} ui - PerformanceMonitorUI 인스턴스
 * 
 * @description
 * main.js에서 PerformanceMonitorUI를 생성한 후 설정
 */
export function setPerformanceMonitorUI(ui) {
    performanceMonitorUI = ui;
}

/**
 * 애니메이션 프레임 ID 조회 (디버그용)
 * 
 * @returns {number|null}
 */
export function getAnimationFrameId() {
    return animationFrameId;
}

// ============================================
// 디버그 함수
// ============================================

/**
 * SceneRenderer 디버그 정보
 */
export function debugSceneRenderer() {
    console.group('🎬 SceneRenderer Debug');
    console.log('isRunning:', isRunning);
    console.log('animationFrameId:', animationFrameId);
    console.log('performanceMonitorUI:', performanceMonitorUI ? '✅' : '❌');
    console.log('scene service:', getService('scene') ? '✅' : '❌');
    console.groupEnd();
}