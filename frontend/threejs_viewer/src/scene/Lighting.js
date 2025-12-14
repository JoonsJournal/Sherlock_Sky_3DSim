/**
 * Lighting.js
 * 씬 조명 설정 및 관리 - 공장 스타일
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class Lighting {
    /**
     * 씬에 조명 추가 - 공장 스타일
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addLights(scene) {
        // 1. 주변광 (Ambient Light) - 기본 밝기
        const ambientLight = new THREE.AmbientLight(
            CONFIG.LIGHTING.AMBIENT.COLOR,
            CONFIG.LIGHTING.AMBIENT.INTENSITY
        );
        scene.add(ambientLight);
        
        // 2. 반구광 (Hemisphere Light) - 하늘과 지면 반사광 (공장 특유의 조명)
        const hemisphereLight = new THREE.HemisphereLight(
            CONFIG.LIGHTING.HEMISPHERE.SKY_COLOR,
            CONFIG.LIGHTING.HEMISPHERE.GROUND_COLOR,
            CONFIG.LIGHTING.HEMISPHERE.INTENSITY
        );
        hemisphereLight.position.set(0, 50, 0);
        scene.add(hemisphereLight);
        
        // 3. 방향광 (Directional Light) - 메인 조명, 그림자 생성
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
        
        // 그림자 설정 개선
        directionalLight.shadow.mapSize.width = CONFIG.RENDERER.SHADOW_MAP_SIZE;
        directionalLight.shadow.mapSize.height = CONFIG.RENDERER.SHADOW_MAP_SIZE;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        
        scene.add(directionalLight);
        
        // 4. 포인트 라이트 (Point Light) - 보조 조명
        const pointLight = new THREE.PointLight(
            CONFIG.LIGHTING.POINT.COLOR,
            CONFIG.LIGHTING.POINT.INTENSITY,
            50  // 거리
        );
        pointLight.position.set(
            CONFIG.LIGHTING.POINT.POSITION.x,
            CONFIG.LIGHTING.POINT.POSITION.y,
            CONFIG.LIGHTING.POINT.POSITION.z
        );
        pointLight.castShadow = true;
        scene.add(pointLight);
        
        // 5. 추가 공장 조명 - 스팟라이트 (천장 조명 시뮬레이션)
        this.addFactoryCeilingLights(scene);
        
        debugLog('💡 공장 조명 추가 완료');
        debugLog('   - Ambient Light:', CONFIG.LIGHTING.AMBIENT.INTENSITY);
        debugLog('   - Hemisphere Light:', CONFIG.LIGHTING.HEMISPHERE.INTENSITY);
        debugLog('   - Directional Light:', CONFIG.LIGHTING.DIRECTIONAL.INTENSITY);
        debugLog('   - Point Light:', CONFIG.LIGHTING.POINT.INTENSITY);
        debugLog('   - Ceiling Lights: 4개');
    }
    
    /**
     * 공장 천장 조명 추가 (스팟라이트)
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addFactoryCeilingLights(scene) {
        const ceilingHeight = 12;
        const lightColor = 0xffffee;  // 따뜻한 흰색
        const intensity = 0.5;
        const distance = 20;
        const angle = Math.PI / 6;  // 30도
        const penumbra = 0.3;  // 부드러운 가장자리
        
        // 4개의 천장 조명 배치
        const positions = [
            { x: -15, z: -15 },
            { x: 15, z: -15 },
            { x: -15, z: 15 },
            { x: 15, z: 15 }
        ];
        
        positions.forEach(pos => {
            const spotLight = new THREE.SpotLight(
                lightColor,
                intensity,
                distance,
                angle,
                penumbra
            );
            spotLight.position.set(pos.x, ceilingHeight, pos.z);
            spotLight.target.position.set(pos.x, 0, pos.z);
            spotLight.castShadow = true;
            
            // 그림자 설정
            spotLight.shadow.mapSize.width = 1024;
            spotLight.shadow.mapSize.height = 1024;
            spotLight.shadow.camera.near = 1;
            spotLight.shadow.camera.far = 25;
            
            scene.add(spotLight);
            scene.add(spotLight.target);
            
            // 조명 시각화 (디버그용) - 작은 구체
            if (CONFIG.DEBUG_MODE) {
                const lightHelper = new THREE.PointLight(0xffff00, 0.1, 1);
                lightHelper.position.copy(spotLight.position);
                scene.add(lightHelper);
            }
        });
    }
    
    /**
     * 동적 조명 효과 (선택적) - 공장 조명 깜빡임 효과
     * @param {THREE.PointLight} pointLight - 포인트 라이트
     */
    static animateLight(pointLight) {
        // 시간에 따라 조명 강도 변화 (미세한 깜빡임)
        const time = Date.now() * 0.001;
        const flicker = 0.95 + Math.random() * 0.1;  // 95~105% 강도
        pointLight.intensity = CONFIG.LIGHTING.POINT.INTENSITY * flicker;
    }
    
    /**
     * 비상등 효과 (옵션)
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addEmergencyLight(scene) {
        const emergencyLight = new THREE.PointLight(0xff0000, 0, 10);
        emergencyLight.position.set(0, 8, 0);
        scene.add(emergencyLight);
        
        // 비상등 깜빡임 애니메이션
        setInterval(() => {
            emergencyLight.intensity = emergencyLight.intensity === 0 ? 0.5 : 0;
        }, 500);
        
        return emergencyLight;
    }
}