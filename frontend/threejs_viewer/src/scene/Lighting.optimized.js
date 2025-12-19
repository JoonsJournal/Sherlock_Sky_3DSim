/**
 * Lighting.optimized.js
 * 고성능 조명 시스템 - 실시간 조명 최소화
 * 
 * 최적화 내용:
 * - PointLight 64개 제거 (FPS 저하의 주요 원인)
 * - 환경광과 방향광만으로 밝은 클린룸 환경 구현
 * - 총 조명 개수: 70개 → 6개
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class Lighting {
    /**
     * 최적화된 조명 시스템 (10,000 Class 클린룸 스타일)
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addLights(scene) {
        // 1. 강력한 주변광 - 클린룸의 균일한 밝기
        const ambientLight = new THREE.AmbientLight(
            0xffffff,  // 순백색
            2.5        // ⭐ 강도 대폭 증가 (PointLight 제거로 인한 보상)
        );
        scene.add(ambientLight);
        
        // 2. 반구광 - 천장과 바닥의 부드러운 그라데이션
        const hemisphereLight = new THREE.HemisphereLight(
            0xffffff,  // 천장 (순백색)
            0xf5f5f5,  // 바닥 (연한 회색)
            1.8        // ⭐ 강도 증가
        );
        hemisphereLight.position.set(0, 50, 0);
        scene.add(hemisphereLight);
        
        // 3. 메인 방향광 - 주 조명 (그림자 포함)
        const mainDirectionalLight = new THREE.DirectionalLight(
            0xffffff,  // 순백색
            1.2        // ⭐ 강도 증가
        );
        mainDirectionalLight.position.set(30, 50, 30);
        mainDirectionalLight.castShadow = true;
        
        // ⭐ 그림자 최적화
        mainDirectionalLight.shadow.mapSize.width = 1024;   // 2048 → 1024
        mainDirectionalLight.shadow.mapSize.height = 1024;  // 2048 → 1024
        mainDirectionalLight.shadow.camera.near = 0.5;
        mainDirectionalLight.shadow.camera.far = 150;
        mainDirectionalLight.shadow.camera.left = -60;
        mainDirectionalLight.shadow.camera.right = 60;
        mainDirectionalLight.shadow.camera.top = 60;
        mainDirectionalLight.shadow.camera.bottom = -60;
        mainDirectionalLight.shadow.bias = -0.0001;
        mainDirectionalLight.shadow.normalBias = 0.02;
        
        scene.add(mainDirectionalLight);
        
        // 4. 보조 방향광 - 그림자 제거용 (그림자 없음)
        const fillLight1 = new THREE.DirectionalLight(0xffffff, 1.0);  // ⭐ 0.6 → 1.0
        fillLight1.position.set(-30, 40, -30);
        scene.add(fillLight1);
        
        const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.8);  // ⭐ 0.5 → 0.8
        fillLight2.position.set(0, 40, -40);
        scene.add(fillLight2);
        
        const fillLight3 = new THREE.DirectionalLight(0xffffff, 0.8);  // ⭐ 0.5 → 0.8
        fillLight3.position.set(-40, 40, 0);
        scene.add(fillLight3);
        
        // ⭐ PointLight 64개 완전 제거
        // → 환경광과 방향광으로 클린룸의 밝고 균일한 조명 구현
        
        debugLog('💡 최적화된 조명 시스템 구축 완료');
        debugLog('   🔹 Ambient Light: 2.5 (강도 증가)');
        debugLog('   🔹 Hemisphere Light: 1.8 (강도 증가)');
        debugLog('   🔹 Directional Lights: 4개 (메인 + 보조 3개)');
        debugLog('   ⭐ PointLight: 0개 (64개 제거 → FPS 대폭 향상)');
        debugLog('   📊 총 조명 개수: 6개 (기존 70개에서 90% 감소)');
        debugLog('   🎯 예상 성능 향상: 3~5배 FPS 증가');
    }
    
    /**
     * 조명 강도 동적 조정
     * @param {THREE.Scene} scene
     * @param {number} intensity - 0.0 ~ 1.0
     */
    static adjustLightingIntensity(scene, intensity) {
        scene.traverse((object) => {
            if (object instanceof THREE.Light) {
                if (object instanceof THREE.AmbientLight) {
                    object.intensity = 2.5 * intensity;
                } else if (object instanceof THREE.HemisphereLight) {
                    object.intensity = 1.8 * intensity;
                } else if (object instanceof THREE.DirectionalLight) {
                    const baseIntensity = object.userData.baseIntensity || object.intensity;
                    object.intensity = baseIntensity * intensity;
                }
            }
        });
        
        debugLog(`💡 조명 강도 조정: ${(intensity * 100).toFixed(0)}%`);
    }
    
    /**
     * 낮/밤 모드 전환
     * @param {THREE.Scene} scene
     * @param {boolean} isDayMode - true: 낮 모드, false: 밤 모드
     */
    static setDayNightMode(scene, isDayMode) {
        const intensity = isDayMode ? 1.0 : 0.3;
        this.adjustLightingIntensity(scene, intensity);
        
        const bgColor = isDayMode ? 0xf8f8f8 : 0x2a2a2a;
        scene.background = new THREE.Color(bgColor);
        
        debugLog(`🌞/🌙 ${isDayMode ? '낮' : '밤'} 모드로 전환`);
    }
}
