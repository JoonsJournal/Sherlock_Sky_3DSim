/**
 * SceneBootstrap.js
 * =================
 * 
 * 3D 씬 관련 초기화 담당
 * - SceneManager
 * - EquipmentLoader
 * - CameraControls / CameraNavigator
 * - Lighting
 * - PerformanceMonitor
 * 
 * @version 1.0.0
 * @module SceneBootstrap
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/SceneBootstrap.js
 */

import * as THREE from 'three';

import { SceneManager } from '../viewer3d/scene/SceneManager.js';
import { EquipmentLoader } from '../viewer3d/scene/EquipmentLoader.js';
import { Lighting } from '../viewer3d/scene/Lighting.js';

import { CameraControls } from '../viewer3d/controls/CameraControls.js';
import { CameraNavigator } from '../viewer3d/controls/CameraNavigator.js';
import { InteractionHandler } from '../viewer3d/controls/InteractionHandler.js';

import { DataOverlay } from '../viewer3d/visualization/DataOverlay.js';
import { StatusVisualizer } from '../viewer3d/visualization/StatusVisualizer.js';

import { PerformanceMonitor } from '../core/utils/PerformanceMonitor.js';
import { debugLog } from '../core/utils/Config.js';

/**
 * 3D 씬 초기화
 * @returns {Object} 초기화된 씬 관련 객체들
 */
export function initScene() {
    console.log('🎬 3D 씬 초기화 시작...');
    
    // 1. Scene Manager 생성 및 초기화
    const sceneManager = new SceneManager();
    const initSuccess = sceneManager.init();
    
    if (!initSuccess) {
        throw new Error('SceneManager 초기화 실패');
    }
    
    if (!sceneManager.renderer || !sceneManager.renderer.domElement) {
        throw new Error('Renderer 초기화 실패');
    }
    
    console.log('  ✅ SceneManager 초기화 완료');
    
    // 2. 조명 추가
    Lighting.addLights(sceneManager.scene);
    console.log('  ✅ Lighting 초기화 완료');
    
    // 3. Equipment Loader
    const equipmentLoader = new EquipmentLoader(sceneManager.scene);
    
    // 로딩 상태 콜백 함수
    const updateLoadingStatus = (message, isError) => {
        const statusDiv = document.getElementById('loadingStatus');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = isError ? '#e74c3c' : '#2ecc71';
        }
        debugLog(isError ? '❌' : '✅', message);
    };
    
    // 설비 배열 로드
    equipmentLoader.loadEquipmentArray(updateLoadingStatus);
    console.log('  ✅ EquipmentLoader 초기화 완료');
    
    // SceneManager-EquipmentLoader 연결
    if (sceneManager.setEquipmentLoader) {
        sceneManager.setEquipmentLoader(equipmentLoader);
        console.log('  ✅ SceneManager-EquipmentLoader 연결 완료');
    }
    
    // 4. Camera Controls
    const cameraControls = new CameraControls(
        sceneManager.camera,
        sceneManager.renderer.domElement
    );
    console.log('  ✅ CameraControls 초기화 완료');

    // 5. Camera Navigator
    const cameraNavigator = new CameraNavigator(
        sceneManager.camera,
        cameraControls.controls,
        new THREE.Vector3(0, 0, 0)
    );
    console.log('  ✅ CameraNavigator 초기화 완료');
    
    // 6. DataOverlay 초기화
    const dataOverlay = new DataOverlay();
    dataOverlay.exposeGlobalFunctions();
    console.log('  ✅ DataOverlay 초기화 완료');
    
    // 7. StatusVisualizer 초기화
    const statusVisualizer = new StatusVisualizer(equipmentLoader.getEquipmentArray());
    statusVisualizer.updateAllStatus();
    console.log('  ✅ StatusVisualizer 초기화 완료');
    
    // 8. PerformanceMonitor 초기화
    const performanceMonitor = new PerformanceMonitor(sceneManager.renderer);
    console.log('  ✅ PerformanceMonitor 초기화 완료');
    
    // 9. Interaction Handler
    const interactionHandler = new InteractionHandler(
        sceneManager.camera,
        sceneManager.scene,
        sceneManager.renderer.domElement,
        equipmentLoader.getEquipmentArray(),
        dataOverlay
    );
    console.log('  ✅ InteractionHandler 초기화 완료');
    
    // InteractionHandler 연결
    interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
    interactionHandler.setDataOverlay(dataOverlay);
    interactionHandler.setStatusVisualizer(statusVisualizer);
    
    // 설비 클릭 콜백 설정
    interactionHandler.setOnEquipmentClick((selectedData) => {
        debugLog('📊 설비 선택됨:', selectedData.map(d => d.id));
    });
    
    // 설비 선택 해제 콜백 설정
    interactionHandler.setOnEquipmentDeselect(() => {
        debugLog('📊 설비 선택 해제됨');
    });
    
    console.log('✅ 3D 씬 초기화 완료');
    
    return {
        sceneManager,
        equipmentLoader,
        cameraControls,
        cameraNavigator,
        dataOverlay,
        statusVisualizer,
        performanceMonitor,
        interactionHandler
    };
}

/**
 * 로딩 상태 UI 숨김
 * @param {number} delay - 지연 시간 (ms)
 */
export function hideLoadingStatus(delay = 3000) {
    setTimeout(() => {
        const loadingStatus = document.getElementById('loadingStatus');
        if (loadingStatus) {
            loadingStatus.style.transition = 'opacity 0.5s';
            loadingStatus.style.opacity = '0';
            setTimeout(() => {
                loadingStatus.style.display = 'none';
            }, 500);
        }
    }, delay);
}

export { THREE };