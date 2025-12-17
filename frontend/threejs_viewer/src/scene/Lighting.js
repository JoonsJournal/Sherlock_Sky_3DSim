/**
 * Lighting.js
 * 씬 조명 설정 및 관리
 * 10,000 Class 클린룸 스타일 - 최적화된 조명 시스템
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class Lighting {
    /**
     * 씬에 조명 추가 (10,000 Class 클린룸 스타일)
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addLights(scene) {
        // 1. 주변광 (Ambient Light) - 클린룸의 균일하게 산란된 빛
        const ambientLight = new THREE.AmbientLight(
            0xffffff,  // 순백색
            1.5        // 매우 밝은 강도 (조명 수를 줄인 만큼 강도 증가)
        );
        scene.add(ambientLight);
        
        // 2. 반구광 (Hemisphere Light) - 천장과 바닥 간의 부드러운 조명
        const hemisphereLight = new THREE.HemisphereLight(
            0xffffff,  // 천장 (순백색)
            0xf5f5f5,  // 바닥 (연한 회색)
            1.0        // 높은 강도
        );
        hemisphereLight.position.set(0, 50, 0);
        scene.add(hemisphereLight);
        
        // 3. 메인 방향광 (Directional Light) - 주 조명원
        const mainDirectionalLight = new THREE.DirectionalLight(
            0xffffff,  // 순백색
            0.8        // 높은 강도
        );
        mainDirectionalLight.position.set(30, 50, 30);
        mainDirectionalLight.castShadow = true;
        
        // 그림자 설정 - 클린룸은 그림자가 매우 부드럽고 희미함
        mainDirectionalLight.shadow.mapSize.width = 2048;
        mainDirectionalLight.shadow.mapSize.height = 2048;
        mainDirectionalLight.shadow.camera.near = 0.5;
        mainDirectionalLight.shadow.camera.far = 150;
        mainDirectionalLight.shadow.camera.left = -60;
        mainDirectionalLight.shadow.camera.right = 60;
        mainDirectionalLight.shadow.camera.top = 60;
        mainDirectionalLight.shadow.camera.bottom = -60;
        mainDirectionalLight.shadow.bias = -0.0001;
        mainDirectionalLight.shadow.normalBias = 0.02;
        
        scene.add(mainDirectionalLight);
        
        // 4. 보조 방향광들 - 그림자 제거 및 균일한 조명
        const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
        fillLight1.position.set(-30, 40, -30);
        scene.add(fillLight1);
        
        const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight2.position.set(0, 40, -40);
        scene.add(fillLight2);
        
        const fillLight3 = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight3.position.set(-40, 40, 0);
        scene.add(fillLight3);
        
        // 5. 천장 LED 패널 조명 시뮬레이션 (최적화 버전 - 적은 수의 조명)
        const ceilingLights = this.createOptimizedCeilingLights(scene);
        
        debugLog('💡 10,000 Class 클린룸 조명 시스템 구축 완료');
        debugLog('   - Ambient Light: 1.5 (매우 밝음)');
        debugLog('   - Hemisphere Light: 1.0');
        debugLog('   - Directional Lights: 4개 (메인 + 보조 3개)');
        debugLog('   - Ceiling Lights: ' + ceilingLights + '개 (최적화)');
    }
    
    /**
     * 최적화된 천장 조명 생성
     * WebGL uniform 한계를 고려하여 조명 수 최소화
     * @param {THREE.Scene} scene - Three.js 씬
     * @returns {number} 생성된 조명 수
     */
    static createOptimizedCeilingLights(scene) {
        let lightCount = 0;
        const ceilingHeight = 30; // 천장 높이
        
        // ⭐ 조명 간격을 넓혀서 개수 감소 (12m 간격)
        const panelSpacing = 12;
        const coverage = 48; // 조명 범위
        
        // 격자 형태로 LED 패널 배치 (약 8x8 = 64개)
        for (let x = -coverage; x <= coverage; x += panelSpacing) {
            for (let z = -coverage; z <= coverage; z += panelSpacing) {
                // 각 위치에 하나의 포인트 라이트만 생성
                const panelLight = new THREE.PointLight(
                    0xffffff,  // 순백색
                    1.2,       // 강도 증가 (개수가 줄어든 만큼)
                    20,        // 거리 증가
                    1.2        // Decay (빛의 감쇠)
                );
                panelLight.position.set(x, ceilingHeight, z);
                scene.add(panelLight);
                lightCount++;
            }
        }
        
        debugLog(`✨ 최적화된 천장 조명 ${lightCount}개 생성 완료`);
        return lightCount;
    }
    
    /**
     * 조명 강도 동적 조정 (선택사항)
     * @param {THREE.Scene} scene
     * @param {number} intensity - 0.0 ~ 1.0
     */
    static adjustLightingIntensity(scene, intensity) {
        scene.traverse((object) => {
            if (object instanceof THREE.Light) {
                if (object instanceof THREE.AmbientLight) {
                    object.intensity = 1.5 * intensity;
                } else if (object instanceof THREE.HemisphereLight) {
                    object.intensity = 1.0 * intensity;
                } else if (object instanceof THREE.PointLight) {
                    object.intensity = 1.2 * intensity;
                } else if (object instanceof THREE.DirectionalLight) {
                    // 메인 라이트인지 보조 라이트인지 구분
                    const baseIntensity = object.userData.baseIntensity || object.intensity;
                    object.intensity = baseIntensity * intensity;
                }
            }
        });
        
        debugLog(`💡 조명 강도 조정: ${(intensity * 100).toFixed(0)}%`);
    }
    
    /**
     * 낮/밤 모드 전환 (선택사항)
     * @param {THREE.Scene} scene
     * @param {boolean} isDayMode - true: 낮 모드, false: 밤 모드
     */
    static setDayNightMode(scene, isDayMode) {
        const intensity = isDayMode ? 1.0 : 0.3;
        this.adjustLightingIntensity(scene, intensity);
        
        // 배경색도 변경
        const bgColor = isDayMode ? 0xf8f8f8 : 0x2a2a2a;
        scene.background = new THREE.Color(bgColor);
        
        debugLog(`🌞/🌙 ${isDayMode ? '낮' : '밤'} 모드로 전환`);
    }
}