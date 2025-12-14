/**
 * Lighting.js
 * 씬 조명 설정 및 관리
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class Lighting {
    /**
     * 씬에 조명 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addLights(scene) {
        // 주변광 (Ambient Light)
        const ambientLight = new THREE.AmbientLight(
            CONFIG.LIGHTING.AMBIENT.COLOR,
            CONFIG.LIGHTING.AMBIENT.INTENSITY
        );
        scene.add(ambientLight);
        
        // 방향광 (Directional Light) - 그림자 생성
        const directionalLight = new THREE.DirectionalLight(
            CONFIG.LIGHTING.DIRECTIONAL.COLOR,
            CONFIG.LIGHTING.DIRECTIONAL.INTENSITY
        );
        directionalLight.position.set(
            CONFIG.LIGHTING.DIRECTIONAL.POSITION.x,
            CONFIG.LIGHTING.DIRECTIONAL.POSITION.y,
            CONFIG.LIGHTING.DIRECTIONAL.POSITION.z
        );
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = CONFIG.RENDERER.SHADOW_MAP_SIZE;
        directionalLight.shadow.mapSize.height = CONFIG.RENDERER.SHADOW_MAP_SIZE;
        scene.add(directionalLight);
        
        // 포인트 라이트 (Point Light)
        const pointLight = new THREE.PointLight(
            CONFIG.LIGHTING.POINT.COLOR,
            CONFIG.LIGHTING.POINT.INTENSITY
        );
        pointLight.position.set(
            CONFIG.LIGHTING.POINT.POSITION.x,
            CONFIG.LIGHTING.POINT.POSITION.y,
            CONFIG.LIGHTING.POINT.POSITION.z
        );
        scene.add(pointLight);
        
        debugLog('💡 조명 추가 완료');
        debugLog('   - Ambient Light:', CONFIG.LIGHTING.AMBIENT.INTENSITY);
        debugLog('   - Directional Light:', CONFIG.LIGHTING.DIRECTIONAL.INTENSITY);
        debugLog('   - Point Light:', CONFIG.LIGHTING.POINT.INTENSITY);
    }
    
    /**
     * 동적 조명 효과 (선택적)
     * @param {THREE.PointLight} pointLight - 포인트 라이트
     */
    static animateLight(pointLight) {
        // 시간에 따라 조명 강도 변화 (예시)
        const time = Date.now() * 0.001;
        pointLight.intensity = 0.5 + Math.sin(time) * 0.2;
    }
}