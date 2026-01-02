/**
 * AnimationLoop.js
 * 애니메이션 루프 및 정리 로직
 * Phase 1.2: main.js에서 분리
 */

import { memoryManager } from '../utils/MemoryManager.js';

/**
 * AnimationLoop 클래스
 * 렌더링 애니메이션 루프를 관리
 */
export class AnimationLoop {
    constructor(instances) {
        this.instances = instances;
        this.animationFrameId = null;
        this.isRunning = false;
    }
    
    /**
     * 애니메이션 루프 시작
     */
    start() {
        if (this.isRunning) {
            console.warn('[AnimationLoop] 이미 실행 중입니다');
            return;
        }
        
        this.isRunning = true;
        this.animate();
        console.log('[AnimationLoop] ✅ 애니메이션 루프 시작');
    }
    
    /**
     * 애니메이션 루프 중지
     */
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isRunning = false;
        console.log('[AnimationLoop] 🛑 애니메이션 루프 중지');
    }
    
    /**
     * 애니메이션 프레임 실행
     */
    animate = () => {
        if (!this.isRunning) return;
        
        this.animationFrameId = requestAnimationFrame(this.animate);
        
        const { cameraControls, statusVisualizer, signalTowerManager, 
                performanceMonitor, sceneManager } = this.instances;
        
        // 카메라 컨트롤 업데이트
        if (cameraControls) {
            cameraControls.update();
        }
        
        // 상태 시각화 애니메이션 (에러 상태 깜빡임)
        if (statusVisualizer) {
            statusVisualizer.animateErrorStatus();
        }
        
        // Signal Tower 애니메이션 (경광등 깜빡임)
        if (signalTowerManager) {
            const deltaTime = 0.016; // 약 60 FPS 기준
            signalTowerManager.animate(deltaTime);
        }
        
        // 성능 모니터 업데이트 (프레임마다)
        if (performanceMonitor) {
            performanceMonitor.update();
        }
        
        // 렌더링
        if (sceneManager) {
            sceneManager.render();
        }
    }
    
    /**
     * 리소스 정리
     */
    cleanup() {
        console.log('🗑️ 정리 시작...');
        
        // 애니메이션 중지
        this.stop();
        console.log('  - 애니메이션 루프 중지');
        
        const { performanceMonitor, previewGenerator, sceneManager, 
                equipmentLoader, cameraControls, interactionHandler,
                cameraNavigator, equipmentEditState } = this.instances;
        
        // 성능 모니터 정리
        if (performanceMonitor) {
            performanceMonitor.dispose();
            console.log('  - PerformanceMonitor 정리');
        }
        
        // PreviewGenerator 정리
        if (previewGenerator && previewGenerator.dispose) {
            previewGenerator.dispose();
            console.log('  - PreviewGenerator 정리');
        }
        
        // 씬 정리
        if (sceneManager) {
            memoryManager.disposeScene(sceneManager.scene);
            sceneManager.dispose();
            console.log('  - SceneManager 정리');
        }
        
        // 설비 정리
        if (equipmentLoader) {
            equipmentLoader.dispose();
            console.log('  - EquipmentLoader 정리');
        }
        
        // 컨트롤 정리
        if (cameraControls) {
            cameraControls.dispose();
            console.log('  - CameraControls 정리');
        }
        
        // InteractionHandler 정리
        if (interactionHandler) {
            interactionHandler.dispose();
            console.log('  - InteractionHandler 정리');
        }
        
        // CameraNavigator 정리
        if (cameraNavigator) {
            cameraNavigator.dispose();
            console.log('  - CameraNavigator 정리');
        }

        // Equipment Edit 정리
        if (equipmentEditState) {
            equipmentEditState.destroy();
            console.log('  - EquipmentEditState 정리');
        }

        console.log('✅ 정리 완료');
    }
}

// Factory 함수
export function createAnimationLoop(instances) {
    return new AnimationLoop(instances);
}