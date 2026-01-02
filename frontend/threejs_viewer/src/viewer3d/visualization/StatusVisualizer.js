/**
 * StatusVisualizer.js
 * 설비 상태 시각화 (색상, 애니메이션 등)
 * equipment1.js의 모델 구조에 맞춤
 */

import * as THREE from 'three';
import { debugLog } from '../../core/utils/Config.js';

export class StatusVisualizer {
    constructor(equipmentArray) {
        this.equipmentArray = equipmentArray;
        this.statusColors = {
            running: 0x2ecc71,  // 녹색
            idle: 0xf39c12,     // 주황색
            error: 0xe74c3c     // 빨간색
        };
    }
    
    /**
     * 모든 설비의 상태 시각화 업데이트
     */
    updateAllStatus() {
        this.equipmentArray.forEach(equipment => {
            this.updateEquipmentStatus(equipment);
        });
        debugLog('🎨 모든 설비 상태 업데이트 완료');
    }
    
    /**
     * 특정 설비의 상태 시각화
     * @param {THREE.Group} equipment - 설비 객체
     */
    updateEquipmentStatus(equipment) {
        const status = equipment.userData.status;
        
        if (!status) {
            return;
        }
        
        // equipment1.js의 경광등 구조:
        // - 녹색 램프: position.y = 1.84
        // - 황색 램프: position.y = 1.92
        // - 빨간색 램프: position.y = 2.00
        
        equipment.traverse((child) => {
            if (child.isMesh && child.material) {
                // 경광등 램프 찾기 (CylinderGeometry이고 작은 것)
                if (child.geometry.type === 'CylinderGeometry' && 
                    child.geometry.parameters.radiusTop !== undefined &&
                    Math.abs(child.geometry.parameters.radiusTop - 0.06) < 0.01) {
                    
                    // 모든 램프 끄기
                    child.material.emissiveIntensity = 0.1;
                    
                    // 상태에 따라 적절한 램프 켜기
                    if (status === 'running') {
                        // 녹색 램프만 밝게 (y ≈ 1.84)
                        if (Math.abs(child.position.y - 1.84) < 0.05) {
                            child.material.emissiveIntensity = 1.0;
                        }
                    } else if (status === 'idle') {
                        // 황색 램프만 밝게 (y ≈ 1.92)
                        if (Math.abs(child.position.y - 1.92) < 0.05) {
                            child.material.emissiveIntensity = 1.0;
                        }
                    } else if (status === 'error') {
                        // 빨간색 램프만 밝게 (y ≈ 2.00)
                        if (Math.abs(child.position.y - 2.00) < 0.05) {
                            child.material.emissiveIntensity = 1.0;
                        }
                    }
                }
            }
        });
    }
    
    /**
     * 에러 상태 깜빡임 애니메이션
     */
    animateErrorStatus() {
        const time = Date.now() * 0.003;
        const blinkIntensity = (Math.sin(time) + 1) / 2; // 0 to 1
        
        this.equipmentArray.forEach(equipment => {
            if (equipment.userData.status === 'error') {
                equipment.traverse((child) => {
                    if (child.isMesh && child.material) {
                        // 빨간 경광등 찾기 (y ≈ 2.00)
                        if (child.geometry.type === 'CylinderGeometry' && 
                            child.geometry.parameters.radiusTop !== undefined &&
                            Math.abs(child.geometry.parameters.radiusTop - 0.06) < 0.01 &&
                            Math.abs(child.position.y - 2.00) < 0.05) {
                            
                            child.material.emissiveIntensity = 0.5 + blinkIntensity * 0.5;
                        }
                    }
                });
            }
        });
    }
    
    /**
     * 특정 설비 강조 (하이라이트)
     * @param {THREE.Group} equipment - 설비 객체
     * @param {boolean} highlight - 강조 여부
     */
    highlightEquipment(equipment, highlight = true) {
        const emissiveColor = highlight ? 0x4444ff : 0x000000;
        
        equipment.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
                // 경광등이 아닌 부분만 하이라이트
                if (!(child.geometry.type === 'CylinderGeometry' && 
                      child.geometry.parameters.radiusTop !== undefined &&
                      Math.abs(child.geometry.parameters.radiusTop - 0.06) < 0.01)) {
                    child.material.emissive.setHex(emissiveColor);
                }
            }
        });
    }
    
    /**
     * 설비 배열 업데이트 (동적 변경 시)
     * @param {Array<THREE.Group>} equipmentArray - 새로운 설비 배열
     */
    updateEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
        debugLog('🔄 StatusVisualizer 설비 배열 업데이트');
    }
    
    /**
     * 상태별 설비 개수 반환
     * @returns {Object} 상태별 개수
     */
    getStatusCounts() {
        const counts = {
            running: 0,
            idle: 0,
            error: 0,
            unknown: 0
        };
        
        this.equipmentArray.forEach(equipment => {
            const status = equipment.userData.status;
            if (counts.hasOwnProperty(status)) {
                counts[status]++;
            } else {
                counts.unknown++;
            }
        });
        
        return counts;
    }
    
    /**
     * 상태별 설비 목록 반환
     * @param {string} status - 상태 ('running', 'idle', 'error')
     * @returns {Array<THREE.Group>} 해당 상태의 설비 목록
     */
    getEquipmentsByStatus(status) {
        return this.equipmentArray.filter(
            equipment => equipment.userData.status === status
        );
    }
    
    /**
     * 모든 설비를 특정 상태로 변경 (테스트용)
     * @param {string} status - 상태
     */
    setAllEquipmentStatus(status) {
        if (!['running', 'idle', 'error'].includes(status)) {
            console.error('❌ 유효하지 않은 상태:', status);
            return;
        }
        
        this.equipmentArray.forEach(equipment => {
            equipment.userData.status = status;
            this.updateEquipmentStatus(equipment);
        });
        
        debugLog(`🎨 모든 설비를 ${status} 상태로 변경`);
    }
    
    /**
     * 랜덤 상태로 변경 (테스트/데모용)
     */
    randomizeAllStatus() {
        const statuses = ['running', 'idle', 'error'];
        
        this.equipmentArray.forEach(equipment => {
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            equipment.userData.status = randomStatus;
            this.updateEquipmentStatus(equipment);
        });
        
        debugLog('🎲 모든 설비 상태를 랜덤으로 변경');
    }
    
    /**
     * 상태 통계 로그 출력
     */
    logStatusStatistics() {
        const counts = this.getStatusCounts();
        const total = this.equipmentArray.length;
        
        console.group('📊 설비 상태 통계');
        console.log(`총 설비: ${total}개`);
        console.log(`🟢 정상 가동: ${counts.running}개 (${(counts.running / total * 100).toFixed(1)}%)`);
        console.log(`🟡 대기: ${counts.idle}개 (${(counts.idle / total * 100).toFixed(1)}%)`);
        console.log(`🔴 오류: ${counts.error}개 (${(counts.error / total * 100).toFixed(1)}%)`);
        if (counts.unknown > 0) {
            console.log(`⚪ 알 수 없음: ${counts.unknown}개`);
        }
        console.groupEnd();
        
        return counts;
    }
}