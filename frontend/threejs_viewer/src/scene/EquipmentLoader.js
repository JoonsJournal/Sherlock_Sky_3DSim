/**
 * EquipmentLoader.js
 * 설비 모델 로딩 및 배열 생성
 */

import * as THREE from 'three';
import { createEquipmentModel } from '../../public/models/equipment1.js';
import { CONFIG, debugLog } from '../utils/Config.js';

export class EquipmentLoader {
    constructor(scene) {
        this.scene = scene;
        this.equipmentArray = [];
    }
    
    /**
     * 설비 배열 생성
     * @param {Function} updateStatusCallback - 상태 업데이트 콜백
     */
    createEquipmentArray(updateStatusCallback) {
        debugLog('🏭 설비 배열 생성 시작...');
        updateStatusCallback('설비 배치 중...', false);
        
        const rows = CONFIG.EQUIPMENT.ROWS;
        const cols = CONFIG.EQUIPMENT.COLS;
        const equipWidth = CONFIG.EQUIPMENT.SIZE.WIDTH;
        const equipDepth = CONFIG.EQUIPMENT.SIZE.DEPTH;
        const spacing = CONFIG.EQUIPMENT.SPACING.DEFAULT;
        const corridorCols = CONFIG.EQUIPMENT.SPACING.CORRIDOR_COLS;
        const corridorWidth = CONFIG.EQUIPMENT.SPACING.CORRIDOR_WIDTH;
        
        debugLog(`📐 설비 크기: ${equipWidth}m × ${equipDepth}m`);
        debugLog(`📏 기본 간격: ${spacing}m`);
        debugLog(`🚶 복도 위치:`, corridorCols, `(폭 ${corridorWidth}m)`);
        
        let totalCreated = 0;
        let totalFailed = 0;
        
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                try {
                    // 모델 생성
                    const equipment = createEquipmentModel();
                    
                    // X 위치 계산 (복도 고려)
                    let xPos = 0;
                    for (let c = 1; c < col; c++) {
                        xPos += equipWidth;
                        if (corridorCols.includes(c)) {
                            xPos += corridorWidth;
                        } else {
                            xPos += spacing;
                        }
                    }
                    
                    // Z 위치 계산
                    let zPos = (row - 1) * (equipDepth + spacing);
                    
                    // 중심점 조정
                    const centerX = ((cols - 1) * equipWidth + (cols - 1) * spacing + 
                                   corridorCols.length * (corridorWidth - spacing)) / 2;
                    const centerZ = ((rows - 1) * (equipDepth + spacing)) / 2;
                    
                    xPos -= centerX;
                    zPos -= centerZ;
                    
                    equipment.position.set(xPos, 0, zPos);
                    
                    // 설비 데이터 추가
                    const equipmentId = `EQ-${String(row).padStart(2, '0')}-${String(col).padStart(2, '0')}`;
                    equipment.userData = {
                        id: equipmentId,
                        position: { row, col },
                        status: this.getRandomStatus(),
                        temperature: `${(20 + Math.random() * 30).toFixed(1)}°C`,
                        runtime: `${(100 + Math.random() * 1000).toFixed(0)}h`,
                        efficiency: `${(85 + Math.random() * 10).toFixed(1)}%`,
                        output: `${(500 + Math.random() * 500).toFixed(0)} units/h`,
                        powerConsumption: `${(10 + Math.random() * 20).toFixed(1)} kW`,
                        lastMaintenance: this.getRandomDate()
                    };
                    
                    this.scene.add(equipment);
                    this.equipmentArray.push(equipment);
                    totalCreated++;
                    
                } catch (error) {
                    console.error(`❌ 설비 생성 실패 (${row}, ${col}):`, error);
                    totalFailed++;
                }
            }
        }
        
        debugLog('═══════════════════════════════════════');
        debugLog(`✅ 설비 배치 완료: ${totalCreated}개 생성`);
        if (totalFailed > 0) {
            debugLog(`⚠️ 실패: ${totalFailed}개`);
        }
        debugLog(`📊 예상 개수: ${rows * cols}개`);
        debugLog('═══════════════════════════════════════');
        
        // 첫 번째 설비 위치 확인
        if (this.equipmentArray.length > 0) {
            const firstEquip = this.equipmentArray[0];
            debugLog('📍 첫 번째 설비 위치:', firstEquip.position);
            debugLog('📋 첫 번째 설비 ID:', firstEquip.userData.id);
        }
        
        updateStatusCallback(`✅ ${totalCreated}개 설비 배치 완료`, false);
    }
    
    /**
     * 랜덤 상태 생성
     * @returns {string} 상태 ('running', 'idle', 'error')
     */
    getRandomStatus() {
        const rand = Math.random();
        if (rand < 0.7) return 'running';
        if (rand < 0.9) return 'idle';
        return 'error';
    }
    
    /**
     * 랜덤 날짜 생성
     * @returns {string} 날짜 문자열
     */
    getRandomDate() {
        const daysAgo = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toLocaleDateString('ko-KR');
    }
    
    /**
     * 설비 배열 반환
     * @returns {Array<THREE.Group>}
     */
    getEquipmentArray() {
        return this.equipmentArray;
    }
    
    /**
     * 특정 위치의 설비 찾기
     * @param {number} row - 행 번호
     * @param {number} col - 열 번호
     * @returns {THREE.Group|null}
     */
    findEquipment(row, col) {
        return this.equipmentArray.find(
            eq => eq.userData.position.row === row && eq.userData.position.col === col
        ) || null;
    }
}