/**
 * SignalTowerManager.js
 * Signal Tower (경광등) 제어 관리자
 * 
 * ⭐ v2.0.0 - 시각적 구분 강화
 * - ON/OFF/DISABLED 3가지 상태 명확히 구분
 * - Emissive + 색상 + 투명도 조합
 * - 미매핑 설비 회색 처리
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/SignalTowerManager.js
 */

import * as THREE from 'three';
import { debugLog } from '../core/utils/Config.js';

export class SignalTowerManager {
    constructor(scene, equipmentLoader) {
        this.scene = scene;
        this.equipmentLoader = equipmentLoader;
        
        // 설비별 램프 맵 (Frontend ID -> { green, yellow, red } 램프 객체들)
        this.lampMap = new Map();
        
        // 설비별 현재 상태 (Frontend ID -> 'RUN' | 'IDLE' | 'STOP' | 'OFF' | 'DISABLED')
        this.statusMap = new Map();
        
        // 상태별 램프 타입 매핑
        this.statusToLightType = {
            'RUN': 'green',
            'IDLE': 'yellow',
            'STOP': 'red',
            'OFF': null  // 모든 램프 꺼짐
        };
        
        // ⭐ v2.0.0: 램프 상태별 시각 설정
        this.lampStates = {
            // ON 상태: 밝은 색상 + 강한 발광
            ON: {
                green:  { color: 0x00FF00, emissive: 0x00FF00, emissiveIntensity: 2.0, opacity: 1.0 },
                yellow: { color: 0xFFFF00, emissive: 0xFFFF00, emissiveIntensity: 2.0, opacity: 1.0 },
                red:    { color: 0xFF0000, emissive: 0xFF0000, emissiveIntensity: 2.0, opacity: 1.0 }
            },
            // OFF 상태: 매우 어두운 색상 + 발광 없음
            OFF: {
                green:  { color: 0x001500, emissive: 0x000000, emissiveIntensity: 0, opacity: 0.6 },
                yellow: { color: 0x151500, emissive: 0x000000, emissiveIntensity: 0, opacity: 0.6 },
                red:    { color: 0x150000, emissive: 0x000000, emissiveIntensity: 0, opacity: 0.6 }
            },
            // DISABLED 상태: 회색 + 많이 반투명 (미매핑 설비)
            DISABLED: {
                all: { color: 0x333333, emissive: 0x000000, emissiveIntensity: 0, opacity: 0.3 }
            }
        };
        
        // 애니메이션 관련
        this.animationTime = 0;
        this.blinkSpeed = 2.0; // 깜빡임 속도
        this.blinkEnabled = true; // 깜빡임 활성화 여부
        
        debugLog('SignalTowerManager initialized (v2.0.0)');
    }
    
    /**
     * ⭐ 모든 설비의 경광등 램프 초기화
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
                
                // ⭐ v2.0.0: 모든 램프 OFF 상태로 초기화 (어두운 색상)
                this.setAllLampsOff(frontendId);
                
                // 상태 초기화
                this.statusMap.set(frontendId, 'OFF');
                
                foundCount++;
            } else {
                console.warn(`⚠️ No signal lights found in equipment: ${frontendId}`);
            }
        });
        
        debugLog(`✅ Signal lights initialized: ${foundCount} equipment`);
        
        return foundCount;
    }
    
    /**
     * 설비 모델에서 경광등 램프 찾기
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
    
    // ============================================
    // ⭐ v2.0.0: 램프 상태 제어 (시각적 구분 강화)
    // ============================================
    
    /**
     * ⭐ v2.0.0: 램프를 ON 상태로 설정
     * @param {THREE.Mesh} lamp - 램프 메쉬
     * @param {string} lightType - 'green' | 'yellow' | 'red'
     */
    setLampOn(lamp, lightType) {
        if (!lamp || !lamp.material) return;
        
        const state = this.lampStates.ON[lightType];
        if (!state) return;
        
        lamp.material.color.setHex(state.color);
        lamp.material.emissive.setHex(state.emissive);
        lamp.material.emissiveIntensity = state.emissiveIntensity;
        lamp.material.opacity = state.opacity;
        lamp.material.transparent = true;
        lamp.material.needsUpdate = true;
        
        lamp.userData.isActive = true;
        lamp.userData.currentState = 'ON';
    }
    
    /**
     * ⭐ v2.0.0: 램프를 OFF 상태로 설정
     * @param {THREE.Mesh} lamp - 램프 메쉬
     * @param {string} lightType - 'green' | 'yellow' | 'red'
     */
    setLampOff(lamp, lightType) {
        if (!lamp || !lamp.material) return;
        
        const state = this.lampStates.OFF[lightType];
        if (!state) return;
        
        lamp.material.color.setHex(state.color);
        lamp.material.emissive.setHex(state.emissive);
        lamp.material.emissiveIntensity = state.emissiveIntensity;
        lamp.material.opacity = state.opacity;
        lamp.material.transparent = true;
        lamp.material.needsUpdate = true;
        
        lamp.userData.isActive = false;
        lamp.userData.currentState = 'OFF';
    }
    
    /**
     * ⭐ v2.0.0: 램프를 DISABLED 상태로 설정 (미매핑 설비)
     * @param {THREE.Mesh} lamp - 램프 메쉬
     */
    setLampDisabled(lamp) {
        if (!lamp || !lamp.material) return;
        
        const state = this.lampStates.DISABLED.all;
        
        lamp.material.color.setHex(state.color);
        lamp.material.emissive.setHex(state.emissive);
        lamp.material.emissiveIntensity = state.emissiveIntensity;
        lamp.material.opacity = state.opacity;
        lamp.material.transparent = true;
        lamp.material.needsUpdate = true;
        
        lamp.userData.isActive = false;
        lamp.userData.currentState = 'DISABLED';
    }
    
    /**
     * ⭐ v2.0.0: 특정 설비의 모든 램프를 OFF 상태로
     * @param {string} frontendId - Frontend ID
     */
    setAllLampsOff(frontendId) {
        const lights = this.lampMap.get(frontendId);
        if (!lights) return;
        
        this.setLampOff(lights.green, 'green');
        this.setLampOff(lights.yellow, 'yellow');
        this.setLampOff(lights.red, 'red');
        
        this.statusMap.set(frontendId, 'OFF');
    }
    
    /**
     * ⭐ v2.0.0: 특정 설비의 모든 램프를 DISABLED 상태로 (미매핑)
     * @param {string} frontendId - Frontend ID
     */
    setAllLampsDisabled(frontendId) {
        const lights = this.lampMap.get(frontendId);
        if (!lights) return;
        
        this.setLampDisabled(lights.green);
        this.setLampDisabled(lights.yellow);
        this.setLampDisabled(lights.red);
        
        this.statusMap.set(frontendId, 'DISABLED');
        
        debugLog(`🌫️ ${frontendId} lamps disabled (unmapped)`);
    }
    
    /**
     * ⭐ v2.0.0: DISABLED 상태 해제 (매핑됨)
     * @param {string} frontendId - Frontend ID
     */
    clearDisabledState(frontendId) {
        const lights = this.lampMap.get(frontendId);
        if (!lights) return;
        
        // 모든 램프를 OFF 상태로 전환 (DISABLED → OFF)
        this.setAllLampsOff(frontendId);
        this.statusMap.set(frontendId, 'OFF');
        
        debugLog(`✅ ${frontendId} lamps enabled (mapped)`);
    }
    
    // ============================================
    // 상태 업데이트
    // ============================================
    
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
        
        // 현재 DISABLED 상태면 무시 (매핑 안된 설비)
        const currentStatus = this.statusMap.get(frontendId);
        if (currentStatus === 'DISABLED') {
            debugLog(`⚠️ ${frontendId} is disabled (unmapped), ignoring status update`);
            return;
        }
        
        // 상태에 해당하는 램프 타입 찾기
        const activeLightType = this.statusToLightType[status];
        
        // ⭐ v2.0.0: 모든 램프 OFF 상태로 (어두운 색상)
        this.setLampOff(lights.green, 'green');
        this.setLampOff(lights.yellow, 'yellow');
        this.setLampOff(lights.red, 'red');
        
        // ⭐ v2.0.0: 해당 상태의 램프만 ON (밝은 색상 + 발광)
        if (activeLightType && lights[activeLightType]) {
            this.setLampOn(lights[activeLightType], activeLightType);
            debugLog(`🚨 ${frontendId} -> ${status} (${activeLightType} lamp ON)`);
        } else {
            debugLog(`🚨 ${frontendId} -> OFF (all lamps OFF)`);
        }
        
        // 상태 저장
        this.statusMap.set(frontendId, status);
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
     * ⭐ v2.0.0: 미매핑 설비들 일괄 DISABLED 처리
     * @param {Set|Array} unmappedIds - 미매핑 Frontend ID 목록
     */
    disableUnmappedEquipment(unmappedIds) {
        let count = 0;
        
        unmappedIds.forEach(frontendId => {
            if (this.lampMap.has(frontendId)) {
                this.setAllLampsDisabled(frontendId);
                count++;
            }
        });
        
        debugLog(`🌫️ Disabled ${count} unmapped equipment lamps`);
        return count;
    }
    
    /**
     * ⭐ v2.0.0: 매핑된 설비들 일괄 활성화 (OFF 상태로)
     * @param {Set|Array} mappedIds - 매핑된 Frontend ID 목록
     */
    enableMappedEquipment(mappedIds) {
        let count = 0;
        
        mappedIds.forEach(frontendId => {
            if (this.lampMap.has(frontendId)) {
                const currentStatus = this.statusMap.get(frontendId);
                if (currentStatus === 'DISABLED') {
                    this.clearDisabledState(frontendId);
                    count++;
                }
            }
        });
        
        debugLog(`✅ Enabled ${count} mapped equipment lamps`);
        return count;
    }
    
    // ============================================
    // 애니메이션
    // ============================================
    
    /**
     * 깜빡임 애니메이션 업데이트
     * @param {number} deltaTime - 프레임 간 경과 시간
     */
    animate(deltaTime) {
        if (!this.blinkEnabled) return;
        
        this.animationTime += deltaTime * this.blinkSpeed;
        
        // 사인파로 깜빡임 구현 (0.5~1.0 범위)
        const blinkFactor = 0.5 + (Math.sin(this.animationTime) + 1) / 4;
        
        // 모든 설비의 램프 순회
        this.lampMap.forEach((lights, frontendId) => {
            const status = this.statusMap.get(frontendId);
            
            // DISABLED 상태는 깜빡임 없음
            if (status === 'DISABLED') return;
            
            // 활성화된 램프만 깜빡임
            ['green', 'yellow', 'red'].forEach(lightType => {
                const lamp = lights[lightType];
                
                if (lamp && lamp.userData.isActive && lamp.userData.currentState === 'ON') {
                    const baseIntensity = this.lampStates.ON[lightType].emissiveIntensity;
                    
                    // 깜빡임 효과 (baseIntensity * 0.5 ~ baseIntensity 범위)
                    lamp.material.emissiveIntensity = baseIntensity * blinkFactor;
                }
            });
        });
    }
    
    /**
     * 깜빡임 활성화/비활성화
     * @param {boolean} enabled
     */
    setBlinkEnabled(enabled) {
        this.blinkEnabled = enabled;
        debugLog(`🚨 Lamp blinking ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // ============================================
    // 통계 및 조회
    // ============================================
    
    /**
     * 특정 설비의 현재 상태 조회
     * @param {string} frontendId - Frontend ID
     * @returns {string|null} 'RUN' | 'IDLE' | 'STOP' | 'OFF' | 'DISABLED' | null
     */
    getStatus(frontendId) {
        return this.statusMap.get(frontendId) || null;
    }
    
    /**
     * 특정 상태의 설비 개수 조회
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP', 'OFF', 'DISABLED')
     * @returns {number}
     */
    getStatusCount(status) {
        let count = 0;
        
        this.statusMap.forEach((s) => {
            if (s === status) count++;
        });
        
        return count;
    }
    
    /**
     * 전체 상태 통계
     * @returns {Object} { RUN: 10, IDLE: 5, STOP: 2, OFF: 100, DISABLED: 0 }
     */
    getStatusStatistics() {
        const stats = {
            RUN: 0,
            IDLE: 0,
            STOP: 0,
            OFF: 0,
            DISABLED: 0
        };
        
        this.statusMap.forEach((status) => {
            if (status in stats) {
                stats[status]++;
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
            const currentStatus = this.statusMap.get(frontendId);
            
            // DISABLED가 아닌 설비만
            if (currentStatus !== 'DISABLED') {
                const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
                this.updateStatus(frontendId, randomStatus);
                updateCount++;
            }
        });
        
        debugLog(`🧪 Random status set for ${updateCount} equipment`);
    }
    
    /**
     * 테스트용: 특정 설비 상태 순환
     * @param {string} frontendId - Frontend ID
     */
    testCycleStatus(frontendId) {
        const statuses = ['RUN', 'IDLE', 'STOP', 'OFF'];
        const currentStatus = this.statusMap.get(frontendId) || 'OFF';
        const currentIndex = statuses.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % statuses.length;
        const nextStatus = statuses[nextIndex];
        
        this.updateStatus(frontendId, nextStatus);
        debugLog(`🧪 ${frontendId} status cycled: ${currentStatus} → ${nextStatus}`);
    }
    
    /**
     * 디버그 정보 출력
     */
    debugPrintStatus() {
        console.group('🔧 SignalTowerManager Debug Info');
        console.log('Version: 2.0.0');
        console.log('Total equipment with lamps:', this.lampMap.size);
        console.log('Statistics:', this.getStatusStatistics());
        console.log('Blink enabled:', this.blinkEnabled);
        
        // 상태별 설비 목록 (처음 5개씩만)
        const byStatus = { RUN: [], IDLE: [], STOP: [], OFF: [], DISABLED: [] };
        this.statusMap.forEach((status, frontendId) => {
            if (byStatus[status] && byStatus[status].length < 5) {
                byStatus[status].push(frontendId);
            }
        });
        console.log('Sample equipment by status:', byStatus);
        console.groupEnd();
    }
    
    /**
     * 메모리 정리
     */
    dispose() {
        debugLog('SignalTowerManager 메모리 정리 시작...');
        
        // 램프는 equipment의 일부이므로 별도 정리 불필요
        // 맵만 초기화
        this.lampMap.clear();
        this.statusMap.clear();
        
        debugLog('✓ SignalTowerManager 메모리 정리 완료');
    }
}