/**
 * StatusVisualizer.js
 * 설비 상태 시각화 (색상, 애니메이션 등)
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';

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
    }
    
    /**
     * 특정 설비의 상태 시각화
     * @param {THREE.Group} equipment - 설비 객체
     */
    updateEquipmentStatus(equipment) {
        const status = equipment.userData.status;
        const color = this.statusColors[status] || 0xcccccc;
        
        // 경광등의 색상 변경
        equipment.traverse((child) => {
            if (child.isMesh && child.material) {
                // 경광등 램프 찾기 (CylinderGeometry이고 작은 것)
                if (child.geometry.type === 'CylinderGeometry' && 
                    Math.abs(child.geometry.parameters.radiusTop - 0.06) < 0.01) {
                    
                    // 상태에 따라 적절한 램프만 발광
                    if (status === 'running') {
                        // 녹색 램프만 밝게
                        if (Math.abs(child.position.y - 1.84) < 0.01) {
                            child.material.emissiveIntensity = 1.0;
                        } else {
                            child.material.emissiveIntensity = 0.1;
                        }
                    } else if (status === 'idle') {
                        // 황색 램프만 밝게
                        if (Math.abs(child.position.y - 1.92) < 0.01) {
                            child.material.emissiveIntensity = 1.0;
                        } else {
                            child.material.emissiveIntensity = 0.1;
                        }
                    } else if (status === 'error') {
                        // 빨간색 램프만 밝게
                        if (Math.abs(child.position.y - 2.00) < 0.01) {
                            child.material.emissiveIntensity = 1.0;
                        } else {
                            child.material.emissiveIntensity = 0.1;
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
                        // 빨간 경광등 찾기
                        if (child.geometry.type === 'CylinderGeometry' && 
                            Math.abs(child.position.y - 2.00) < 0.01) {
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
                child.material.emissive.setHex(emissiveColor);
            }
        });
    }
    
    /**
     * 설비 배열 업데이트 (동적 변경 시)
     * @param {Array<THREE.Group>} equipmentArray - 새로운 설비 배열
     */
    updateEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
    }
    
    /**
     * 상태별 설비 개수 반환
     * @returns {Object} 상태별 개수
     */
    getStatusCounts() {
        const counts = {
            running: 0,
            idle: 0,
            error: 0
        };
        
        this.equipmentArray.forEach(equipment => {
            const status = equipment.userData.status;
            if (counts.hasOwnProperty(status)) {
                counts[status]++;
            }
        });
        
        return counts;
    }
}