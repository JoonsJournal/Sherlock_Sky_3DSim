/**
 * EquipmentLoader.js
 * 설비 모델 로딩 및 배열 생성
 */

import * as THREE from 'three';
import { createEquipmentModel } from '../../public/models/equipments/equipment1.js';
import { CONFIG, debugLog, isExcludedPosition } from '../utils/Config.js';

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
        const corridorColWidth = CONFIG.EQUIPMENT.SPACING.CORRIDOR_COL_WIDTH;
        const corridorRows = CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROWS;
        const corridorRowWidth = CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROW_WIDTH;
        
        debugLog(`📐 설비 크기: ${equipWidth}m × ${equipDepth}m`);
        debugLog(`📏 기본 간격: ${spacing}m`);
        debugLog(`🚶 열 방향 복도 위치:`, corridorCols, `(폭 ${corridorColWidth}m)`);
        debugLog(`🚶 행 방향 복도 위치:`, corridorRows, `(폭 ${corridorRowWidth}m)`);
        debugLog(`🔄 회전 설정: 홀수 열 +90°, 짝수 열 -90°`);
        debugLog(`❌ 제외 위치 개수: ${CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length}개`);
        
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalFailed = 0;
        
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                // 제외 위치인지 확인
                if (isExcludedPosition(row, col)) {
                    debugLog(`⏭️ 제외 위치 건너뜀: Row ${row}, Col ${col}`);
                    totalSkipped++;
                    continue;
                }
                
                try {
                    // 모델 생성
                    const equipment = createEquipmentModel();
                    
                    // X 위치 계산 (열 방향 복도 고려)
                    let xPos = 0;
                    for (let c = 1; c < col; c++) {
                        xPos += equipWidth;
                        if (corridorCols.includes(c)) {
                            xPos += corridorColWidth;
                        } else {
                            xPos += spacing;
                        }
                    }
                    
                    // Z 위치 계산 (행 방향 복도 고려)
                    let zPos = 0;
                    for (let r = 1; r < row; r++) {
                        zPos += equipDepth;
                        if (corridorRows.includes(r)) {
                            zPos += corridorRowWidth;
                        } else {
                            zPos += spacing;
                        }
                    }
                    
                    // 중심점 조정
                    // X축 중심점 계산
                    let totalXSize = 0;
                    for (let c = 1; c <= cols; c++) {
                        if (c > 1) {
                            if (corridorCols.includes(c - 1)) {
                                totalXSize += corridorColWidth;
                            } else {
                                totalXSize += spacing;
                            }
                        }
                        totalXSize += equipWidth;
                    }
                    const centerX = totalXSize / 2;
                    
                    // Z축 중심점 계산
                    let totalZSize = 0;
                    for (let r = 1; r <= rows; r++) {
                        if (r > 1) {
                            if (corridorRows.includes(r - 1)) {
                                totalZSize += corridorRowWidth;
                            } else {
                                totalZSize += spacing;
                            }
                        }
                        totalZSize += equipDepth;
                    }
                    const centerZ = totalZSize / 2;
                    
                    xPos -= centerX;
                    zPos -= centerZ;
                    
                    equipment.position.set(xPos, 0, zPos);
                    
                    // 🔄 열 번호에 따른 회전 적용
                    // 홀수 열(1, 3, 5): +90도 회전
                    // 짝수 열(2, 4, 6): -90도 회전
                    if (col % 2 === 1) {
                        // 홀수 열: +90도 (시계 반대 방향)
                        equipment.rotation.y = Math.PI / 2;
                    } else {
                        // 짝수 열: -90도 (시계 방향)
                        equipment.rotation.y = -Math.PI / 2;
                    }
                    
                    // 설비 데이터 추가
                    const equipmentId = `EQ-${String(row).padStart(2, '0')}-${String(col).padStart(2, '0')}`;
                    equipment.userData = {
                        id: equipmentId,
                        position: { row, col },
                        rotation: col % 2 === 1 ? 90 : -90,  // 회전 각도 저장
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
                    console.error(`❌ 설비 생성 실패 (Row ${row}, Col ${col}):`, error);
                    totalFailed++;
                }
            }
        }
        
        debugLog('═══════════════════════════════════════');
        debugLog(`✅ 설비 배치 완료: ${totalCreated}개 생성`);
        debugLog(`⏭️ 제외 위치: ${totalSkipped}개`);
        if (totalFailed > 0) {
            debugLog(`⚠️ 실패: ${totalFailed}개`);
        }
        debugLog(`📊 전체 그리드: ${rows} × ${cols} = ${rows * cols}개`);
        debugLog(`📊 실제 설비: ${totalCreated}개 (제외: ${totalSkipped}개)`);
        debugLog('═══════════════════════════════════════');
        
        // 첫 번째 설비 위치 및 회전 확인
        if (this.equipmentArray.length > 0) {
            const firstEquip = this.equipmentArray[0];
            debugLog('📍 첫 번째 설비 위치:', firstEquip.position);
            debugLog('🔄 첫 번째 설비 회전:', `${firstEquip.userData.rotation}°`);
            debugLog('📋 첫 번째 설비 ID:', firstEquip.userData.id);
        }
        
        // 배열 구조 확인 로그
        debugLog('🏭 설비 배열 구조 (26 rows × 6 cols):');
        debugLog('   Col 1 (+90°) ← 복도(1.2m) → Col 2 (-90°)');
        debugLog('   Col 3 (+90°) ← 복도(1.2m) → Col 4 (-90°) [일부 제외]');
        debugLog('   Col 5 (+90°) ← 복도(1.2m) → Col 6 (-90°) [일부 제외]');
        debugLog('   ───────────────────────────────────');
        debugLog('   Row 13 복도 (2.0m)');
        debugLog('   ───────────────────────────────────');
        
        // 제외 위치 요약
        const excludedByCol = {};
        CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.forEach(pos => {
            if (!excludedByCol[pos.col]) {
                excludedByCol[pos.col] = [];
            }
            excludedByCol[pos.col].push(pos.row);
        });
        
        debugLog('❌ 제외된 설비 위치 요약:');
        Object.keys(excludedByCol).sort().forEach(col => {
            const rows = excludedByCol[col].sort((a, b) => a - b);
            debugLog(`   Col ${col}: Row ${rows.join(', ')}`);
        });
        
        updateStatusCallback(`✅ ${totalCreated}개 설비 배치 완료 (${totalSkipped}개 제외)`, false);
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
    
    /**
     * 실제 생성된 설비 통계
     * @returns {Object} 설비 통계 정보
     */
    getStatistics() {
        const totalGrid = CONFIG.EQUIPMENT.ROWS * CONFIG.EQUIPMENT.COLS;
        const excluded = CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length;
        const created = this.equipmentArray.length;
        
        return {
            totalGrid,
            excluded,
            created,
            missing: totalGrid - excluded - created
        };
    }
}