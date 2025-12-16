/**
 * Lighting.js
 * 씬 조명 설정 및 관리
 * 클린룸 스타일 - 밝고 균일한 조명
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class Lighting {
    /**
     * 씬에 조명 추가 (클린룸 스타일)
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addLights(scene) {
        // 1. 주변광 (Ambient Light) - 매우 밝게
        const ambientLight = new THREE.AmbientLight(
            0xffffff,  // 순백색
            0.9        // 매우 밝은 강도 (클린룸 특성)
        );
        scene.add(ambientLight);
        
        // 2. 반구광 (Hemisphere Light) - 클린룸의 균일한 조명 효과
        const hemisphereLight = new THREE.HemisphereLight(
            0xffffff,  // 하늘색 (천장)
            0xe8e8e8,  // 땅색 (바닥)
            0.6        // 강도
        );
        hemisphereLight.position.set(0, 50, 0);
        scene.add(hemisphereLight);
        
        // 3. 방향광 (Directional Light) - 부드러운 그림자
        const directionalLight = new THREE.DirectionalLight(
            0xffffff,  // 순백색
            0.4        // 중간 강도
        );
        directionalLight.position.set(20, 40, 20);
        directionalLight.castShadow = true;
        
        // 그림자 설정 - 부드럽게
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.bias = -0.0001;
        
        scene.add(directionalLight);
        
        // 4. 추가 방향광 - 반대편에서 그림자 제거
        const fillLight = new THREE.DirectionalLight(
            0xffffff,  // 순백색
            0.3        // 약한 강도
        );
        fillLight.position.set(-20, 30, -20);
        scene.add(fillLight);
        
        // 5. 포인트 라이트 여러 개 - 천장 조명 시뮬레이션
        const createCeilingLight = (x, z) => {
            const pointLight = new THREE.PointLight(
                0xffffff,  // 순백색
                0.3,       // 약한 강도
                30         // 거리
            );
            pointLight.position.set(x, 25, z);
            scene.add(pointLight);
        };
        
        // 천장 조명을 격자로 배치
        for (let x = -20; x <= 20; x += 10) {
            for (let z = -20; z <= 20; z += 10) {
                createCeilingLight(x, z);
            }
        }
        
        debugLog('💡 클린룸 스타일 조명 추가 완료');
        debugLog('   - Ambient Light: 0.9');
        debugLog('   - Hemisphere Light: 0.6');
        debugLog('   - Directional Lights: 0.4, 0.3');
        debugLog('   - Ceiling Point Lights: 25개');
    }
    
    /**
     * 동적 조명 효과 (선택적)
     * @param {THREE.PointLight} pointLight - 포인트 라이트
     */
    static animateLight(pointLight) {
        // 클린룸에서는 조명이 일정하게 유지되므로 애니메이션 비활성화
        // 필요시 매우 미세한 변화만 적용
        const time = Date.now() * 0.0001;
        pointLight.intensity = 0.3 + Math.sin(time) * 0.02;  // 매우 미세한 변화
    }
}