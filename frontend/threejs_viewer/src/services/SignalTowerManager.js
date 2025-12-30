/**
 * SignalTowerManager.js
 * Signal Tower (경광등) 제어 관리자
 * 
 * ⭐ Phase 2 (수정):
 * - equipment1.js에 이미 존재하는 3색 경광등 램프를 제어
 * - 새로운 Tower를 생성하지 않고, 기존 램프의 상태를 변경
 * - 상태별로 해당 색상의 램프만 활성화 및 깜빡임
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';

export class SignalTowerManager {
    constructor(scene, equipmentLoader) {
        this.scene = scene;
        this.equipmentLoader = equipmentLoader;
        
        // 설비별 램프 맵 (Frontend ID -> { green, yellow, red } 램프 객체들)
        this.lampMap = new Map();
        
        // 상태별 램프 타입 매핑
        this.statusToLightType = {
            'RUN': 'green',
            'IDLE': 'yellow',
            'STOP': 'red',
            'OFF': null  // 모든 램프 꺼짐
        };
        
        // 애니메이션 관련
        this.animationTime = 0;
        this.blinkSpeed = 2.0; // 깜빡임 속도
        
        debugLog('SignalTowerManager initialized');
    }
    
    /**
     * ⭐ Phase 2: 모든 설비의 경광등 램프 초기화
     * equipment1.js에 이미 존재하는 램프들을 찾아서 맵에 저장
     */
    initializeAllLights() {
        debugLog('🚨 Initializing signal lights for all equipment...');
        
        const equipmentArray = this.equipmentLoader.getAllEquipment();
        let foundCount = 0;
        
        equipmentArray.forEach(equipment => {
            const frontendId = equipment.userData.id;
            
            // 이 설비에서 경광등 램프 3개 찾기
            const lights = this.findLightsInEquipment(equipment);
            
            if (lights) {
                this.lampMap.set(frontendId, lights);
                
                // 모든 램프 초기 상태: 어둡게 (OFF)
                this.deactivateAllLamps(lights);
                
                foundCount++;
            } else {
                console.warn(`⚠️ No signal lights found in equipment: ${frontendId}`);
            }
        });
        
        debugLog(`✅ Signal lights initialized: ${foundCount} equipment`);
        
        return foundCount;
    }
    
    /**
     * ⭐ Phase 2: 설비 모델에서 경광등 램프 찾기
     * userData.isSignalLight === true인 객체들 반환
     */
    findLightsInEquipment(equipment) {
        const lights = {
            green: null,
            yellow: null,
            red: null
        };
        
        // equipment 그룹을 순회하며 경광등 램프 찾기
        equipment.traverse((child) => {
            if (child.userData && child.userData.isSignalLight === true) {
                const lightType = child.userData.lightType;
                
                if (lightType in lights) {
                    lights[lightType] = child;
                }
            }
        });
        
        // 3개 모두 찾았는지 확인
        if (lights.green && lights.yellow && lights.red) {
            return lights;
        }
        
        return null;
    }
    
    /**
     * ⭐ Phase 2: 특정 색상의 램프만 활성화
     */
    activateLamp(lamp, active) {
        if (!lamp || !lamp.userData) return;
        
        const material = lamp.material;
        
        if (active) {
            // 활성화: 원래 색상 및 발광 복원
            material.emissive.setHex(lamp.userData.baseEmissive);
            material.emissiveIntensity = lamp.userData.baseIntensity;
            lamp.userData.isActive = true;
        } else {
            // 비활성화: 발광 제거 (어둡게)
            material.emissiveIntensity = 0.0;
            lamp.userData.isActive = false;
        }
    }
    
    /**
     * ⭐ Phase 2: 모든 램프 비활성화
     */
    deactivateAllLamps(lights) {
        this.activateLamp(lights.green, false);
        this.activateLamp(lights.yellow, false);
        this.activateLamp(lights.red, false);
    }
    
    /**
     * Frontend ID로 상태 업데이트
     * @param {string} frontendId - 설비 Frontend ID (예: 'EQ-01-01')
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP', 'OFF')
     */
    updateStatus(frontendId, status) {
        const lights = this.lampMap.get(frontendId);
        
        if (!lights) {
            console.warn(`⚠️ Signal lights not found: ${frontendId}`);
            return;
        }
        
        // 상태에 해당하는 램프 타입 찾기
        const activeLightType = this.statusToLightType[status];
        
        // 모든 램프 비활성화
        this.deactivateAllLamps(lights);
        
        // 해당 상태의 램프만 활성화
        if (activeLightType && lights[activeLightType]) {
            this.activateLamp(lights[activeLightType], true);
            debugLog(`🚨 ${frontendId} -> ${status} (${activeLightType} lamp activated)`);
        } else {
            debugLog(`🚨 ${frontendId} -> OFF (all lamps deactivated)`);
        }
    }
    
    /**
     * 모든 설비 상태 일괄 업데이트
     * @param {Object} statusMap - { 'EQ-01-01': 'RUN', 'EQ-02-01': 'IDLE', ... }
     */
    updateAllStatus(statusMap) {
        let updateCount = 0;
        
        Object.entries(statusMap).forEach(([frontendId, status]) => {
            this.updateStatus(frontendId, status);
            updateCount++;
        });
        
        debugLog(`🚨 Batch status update: ${updateCount} equipment`);
    }
    
    /**
     * 깜빡임 애니메이션 업데이트
     * @param {number} deltaTime - 프레임 간 경과 시간
     */
    animate(deltaTime) {
        this.animationTime += deltaTime * this.blinkSpeed;
        
        // 사인파로 깜빡임 구현 (0~1 범위)
        const blinkFactor = (Math.sin(this.animationTime) + 1) / 2;
        
        // 모든 설비의 램프 순회
        this.lampMap.forEach((lights) => {
            // 활성화된 램프만 깜빡임
            ['green', 'yellow', 'red'].forEach(lightType => {
                const lamp = lights[lightType];
                
                if (lamp && lamp.userData.isActive) {
                    const baseIntensity = lamp.userData.baseIntensity || 0.5;
                    
                    // 깜빡임 효과 (0.2 ~ baseIntensity 범위)
                    const minIntensity = 0.2;
                    const maxIntensity = baseIntensity;
                    const currentIntensity = minIntensity + (maxIntensity - minIntensity) * blinkFactor;
                    
                    lamp.material.emissiveIntensity = currentIntensity;
                }
            });
        });
    }
    
    /**
     * 특정 상태의 설비 개수 조회
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP')
     * @returns {number}
     */
    getStatusCount(status) {
        let count = 0;
        const activeLightType = this.statusToLightType[status];
        
        if (!activeLightType) return 0;
        
        this.lampMap.forEach((lights) => {
            const lamp = lights[activeLightType];
            if (lamp && lamp.userData.isActive) {
                count++;
            }
        });
        
        return count;
    }
    
    /**
     * 전체 상태 통계
     * @returns {Object} { RUN: 10, IDLE: 5, STOP: 2, OFF: 102 }
     */
    getStatusStatistics() {
        const stats = {
            RUN: 0,
            IDLE: 0,
            STOP: 0,
            OFF: 0
        };
        
        this.lampMap.forEach((lights) => {
            let hasActiveLamp = false;
            
            if (lights.green && lights.green.userData.isActive) {
                stats.RUN++;
                hasActiveLamp = true;
            } else if (lights.yellow && lights.yellow.userData.isActive) {
                stats.IDLE++;
                hasActiveLamp = true;
            } else if (lights.red && lights.red.userData.isActive) {
                stats.STOP++;
                hasActiveLamp = true;
            }
            
            if (!hasActiveLamp) {
                stats.OFF++;
            }
        });
        
        return stats;
    }
    
    /**
     * 모든 경광등 표시/숨김
     * @param {boolean} visible - 표시 여부
     */
    setAllVisible(visible) {
        this.lampMap.forEach((lights) => {
            ['green', 'yellow', 'red'].forEach(lightType => {
                const lamp = lights[lightType];
                if (lamp) {
                    lamp.visible = visible;
                }
            });
        });
        
        debugLog(`🚨 All signal lights ${visible ? 'shown' : 'hidden'}`);
    }
    
    /**
     * 테스트용: 랜덤 상태 설정
     */
    testRandomStatus() {
        const statuses = ['RUN', 'IDLE', 'STOP'];
        let updateCount = 0;
        
        this.lampMap.forEach((lights, frontendId) => {
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            this.updateStatus(frontendId, randomStatus);
            updateCount++;
        });
        
        debugLog(`🧪 Random status set for ${updateCount} equipment`);
    }
    
    /**
     * 메모리 정리
     */
    dispose() {
        debugLog('SignalTowerManager 메모리 정리 시작...');
        
        // 램프는 equipment의 일부이므로 별도 정리 불필요
        // 맵만 초기화
        this.lampMap.clear();
        
        debugLog('✓ SignalTowerManager 메모리 정리 완료');
    }
}