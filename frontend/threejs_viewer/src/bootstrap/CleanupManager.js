/**
 * CleanupManager.js
 * =================
 * 
 * 리소스 정리 담당
 * - 애니메이션 중지
 * - 컴포넌트 dispose
 * - 메모리 해제
 * 
 * @version 1.0.0
 * @module CleanupManager
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/CleanupManager.js
 */

import { memoryManager } from '../core/utils/MemoryManager.js';

/**
 * 전체 정리
 * @param {Object} resources - 정리할 리소스 객체
 */
export function cleanup(resources) {
    console.log('🗑️ 정리 시작...');
    
    const {
        animationFrameId,
        performanceMonitor,
        debugPanel,
        performanceMonitorUI,
        previewGenerator,
        sceneManager,
        equipmentLoader,
        cameraControls,
        interactionHandler,
        cameraNavigator,
        equipmentEditState,
        connectionModal,
        equipmentEditModal
    } = resources;
    
    // 애니메이션 중지
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        console.log('  - 애니메이션 루프 중지');
    }
    
    // 성능 모니터 정리
    if (performanceMonitor) {
        performanceMonitor.dispose();
        console.log('  - PerformanceMonitor 정리');
    }
    
    // 디버그 UI 정리
    if (debugPanel) {
        debugPanel.destroy();
        console.log('  - DebugPanel 정리');
    }
    
    if (performanceMonitorUI) {
        performanceMonitorUI.destroy();
        console.log('  - PerformanceMonitorUI 정리');
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
    
    // Modal 정리
    if (connectionModal) {
        connectionModal.destroy();
        console.log('  - ConnectionModal 정리');
    }
    
    if (equipmentEditModal) {
        equipmentEditModal.destroy();
        console.log('  - EquipmentEditModal 정리');
    }

    console.log('✅ 정리 완료');
}

/**
 * 부분 정리 (특정 컴포넌트만)
 * @param {Object} component - 정리할 컴포넌트
 * @param {string} name - 컴포넌트 이름
 */
export function disposeComponent(component, name) {
    if (!component) return;
    
    try {
        if (typeof component.dispose === 'function') {
            component.dispose();
        } else if (typeof component.destroy === 'function') {
            component.destroy();
        }
        console.log(`  - ${name} 정리 완료`);
    } catch (error) {
        console.warn(`  - ${name} 정리 실패:`, error);
    }
}