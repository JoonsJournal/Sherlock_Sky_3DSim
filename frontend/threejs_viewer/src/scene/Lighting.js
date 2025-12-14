/**
 * Lighting.js
 * 씬 조명 설정 및 관리 (공장 스타일)
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class Lighting {
    /**
     * 씬에 조명 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addLights(scene) {
        // 주변광 (Ambient Light) - 공장은 밝게
        const ambientLight = new THREE.AmbientLight(
            CONFIG.LIGHTING.AMBIENT.COLOR,
            CONFIG.LIGHTING.AMBIENT.INTENSITY
        );
        scene.add(ambientLight);
        
        // 방향광 (Directional Light) - 태양광 시뮬레이션
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
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
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
        
        // 공장 형광등 스타일 조명 추가
        this.addFactoryLights(scene);
        
        debugLog('💡 조명 추가 완료 (공장 스타일)');
        debugLog('   - Ambient Light:', CONFIG.LIGHTING.AMBIENT.INTENSITY);
        debugLog('   - Directional Light:', CONFIG.LIGHTING.DIRECTIONAL.INTENSITY);
        debugLog('   - Point Light:', CONFIG.LIGHTING.POINT.INTENSITY);
        debugLog('   - Factory Lights:', CONFIG.LIGHTING.FACTORY_LIGHTS.COUNT, '개');
    }
    
    /**
     * 공장 형광등 스타일 조명 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addFactoryLights(scene) {
        const config = CONFIG.LIGHTING.FACTORY_LIGHTS;
        const spacing = config.SPACING;
        const height = config.HEIGHT;
        const gridSize = 4; // 4x3 그리드
        
        // 조명 그리드 배치
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 3; j++) {
                const x = (i - 1.5) * spacing;
                const z = (j - 1) * spacing;
                
                // 직사각형 형광등 모양 (RectAreaLight 대신 SpotLight 사용)
                const spotLight = new THREE.SpotLight(
                    config.COLOR,
                    config.INTENSITY,
                    50,          // distance
                    Math.PI / 6, // angle
                    0.5,         // penumbra
                    1            // decay
                );
                
                spotLight.position.set(x, height, z);
                spotLight.target.position.set(x, 0, z);
                spotLight.castShadow = true;
                spotLight.shadow.mapSize.width = 512;
                spotLight.shadow.mapSize.height = 512;
                
                scene.add(spotLight);
                scene.add(spotLight.target);
                
                // 형광등 박스 시각화 (선택적)
                if (CONFIG.DEBUG_MODE && i === 0 && j === 0) {
                    const lightBoxGeometry = new THREE.BoxGeometry(2, 0.1, 0.3);
                    const lightBoxMaterial = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        emissive: 0xffffff,
                        emissiveIntensity: 0.5
                    });
                    const lightBox = new THREE.Mesh(lightBoxGeometry, lightBoxMaterial);
                    lightBox.position.set(x, height - 0.1, z);
                    scene.add(lightBox);
                }
            }
        }
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
    
    /**
     * 비상등 효과 추가 (선택적)
     * @param {THREE.Scene} scene - Three.js 씬
     * @param {Object} position - 위치 {x, y, z}
     */
    static addEmergencyLight(scene, position) {
        const emergencyLight = new THREE.PointLight(0xff0000, 0, 10);
        emergencyLight.position.set(position.x, position.y, position.z);
        scene.add(emergencyLight);
        
        // 깜빡임 효과
        setInterval(() => {
            emergencyLight.intensity = emergencyLight.intensity > 0 ? 0 : 1;
        }, 500);
        
        return emergencyLight;
    }
}