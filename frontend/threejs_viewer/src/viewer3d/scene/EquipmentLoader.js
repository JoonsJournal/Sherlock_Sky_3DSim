/**
 * EquipmentLoader.js
 * 설비 모델 로딩 및 배열 생성 (equipment1.js 직접 사용, LOD 제거)
 * 
 * @version 2.2.1-DEBUG
 * @description 디버그 코드 추가 - 문제 원인 파악용
 */

import * as THREE from 'three';
import { createEquipmentModel } from '../../../public/models/equipments/equipment1.js';
import { CONFIG, debugLog, isExcludedPosition } from '../../core/utils/Config.js';

export class EquipmentLoader {
    constructor(scene) {
        this.scene = scene;
        this.equipmentArray = [];
        this.equipmentMap = new Map();
    }
    
    /**
     * 설비 배열 로드
     * @param {Function} updateStatusCallback - 상태 업데이트 콜백 (선택)
     */
    loadEquipmentArray(updateStatusCallback = null) {
        debugLog('🏭 설비 배열 생성 시작...');
        
        if (updateStatusCallback) {
            updateStatusCallback('설비 배치 중...', false);
        }
        
        const startTime = performance.now();
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalFailed = 0;
        
        const rows = CONFIG.EQUIPMENT.ROWS;
        const cols = CONFIG.EQUIPMENT.COLS;
        
        debugLog(`📐 설비 크기: ${CONFIG.EQUIPMENT.SIZE.WIDTH}m × ${CONFIG.EQUIPMENT.SIZE.DEPTH}m`);
        debugLog(`📏 기본 간격: ${CONFIG.EQUIPMENT.SPACING.DEFAULT}m`);
        debugLog(`🚶 열 방향 복도 위치:`, CONFIG.EQUIPMENT.SPACING.CORRIDOR_COLS, 
                 `(폭 ${CONFIG.EQUIPMENT.SPACING.CORRIDOR_COL_WIDTH}m)`);
        debugLog(`🚶 행 방향 복도 위치:`, CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROWS, 
                 `(폭 ${CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROW_WIDTH}m)`);
        debugLog(`🔄 회전 설정: 홀수 열 +90°, 짝수 열 -90°`);
        debugLog(`❌ 제외 위치 개수: ${CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length}개`);
        
        // 26행 × 6열
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                // 제외 위치 체크
                if (isExcludedPosition(row, col)) {
                    debugLog(`⏭️ 제외 위치 건너뜀: Row ${row}, Col ${col}`);
                    totalSkipped++;
                    continue;
                }
                
                try {
                    // equipment1.js의 모델 직접 생성
                    const equipment = createEquipmentModel();
                    
                    // 위치 계산
                    const position = this.calculatePosition(row, col);
                    equipment.position.copy(position);
                    
                    // 🔄 열 번호에 따른 회전 적용
                    // 홀수 열(1, 3, 5): +90도 회전
                    // 짝수 열(2, 4, 6): -90도 회전
                    if (col % 2 === 1) {
                        equipment.rotation.y = Math.PI / 2;
                    } else {
                        equipment.rotation.y = -Math.PI / 2;
                    }
                    
                    // 설비 ID 생성
                    const equipmentId = `EQ-${row.toString().padStart(2, '0')}-${col.toString().padStart(2, '0')}`;
                    
                    // 메타데이터 설정
                    equipment.userData = {
                        id: equipmentId,
                        position: { row, col },
                        rotation: col % 2 === 1 ? 90 : -90,
                        type: 'equipment',
                        status: this.getRandomStatus(),
                        temperature: `${(20 + Math.random() * 30).toFixed(1)}°C`,
                        runtime: `${(100 + Math.random() * 1000).toFixed(0)}h`,
                        efficiency: `${(85 + Math.random() * 10).toFixed(1)}%`,
                        output: `${(500 + Math.random() * 500).toFixed(0)} units/h`,
                        powerConsumption: `${(10 + Math.random() * 20).toFixed(1)} kW`,
                        lastMaintenance: this.getRandomDate()
                    };
                    
                    // 그림자 설정
                    equipment.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    this.scene.add(equipment);
                    this.equipmentArray.push(equipment);
                    this.equipmentMap.set(equipmentId, equipment);
                    totalCreated++;
                    
                } catch (error) {
                    console.error(`❌ 설비 생성 실패 (Row ${row}, Col ${col}):`, error);
                    totalFailed++;
                }
            }
        }
        
        const elapsed = performance.now() - startTime;
        
        // 최종 통계
        debugLog('═══════════════════════════════════════');
        debugLog(`✅ 설비 배치 완료: ${totalCreated}개 생성`);
        debugLog(`⏭️ 제외 위치: ${totalSkipped}개`);
        if (totalFailed > 0) {
            debugLog(`⚠️ 실패: ${totalFailed}개`);
        }
        debugLog(`📊 전체 그리드: ${rows} × ${cols} = ${rows * cols}개`);
        debugLog(`📊 실제 설비: ${totalCreated}개 (제외: ${totalSkipped}개)`);
        debugLog(`⏱️ 로딩 시간: ${elapsed.toFixed(2)}ms`);
        debugLog('═══════════════════════════════════════');
        
        // 첫 번째 설비 정보
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
        this.logExcludedPositions();
        
        if (updateStatusCallback) {
            updateStatusCallback(`✅ ${totalCreated}개 설비 배치 완료 (${totalSkipped}개 제외)`, false);
        }
        
        return this.equipmentArray;
    }
    
    /**
     * 위치 계산 (복도 고려)
     */
    calculatePosition(row, col) {
        const equipWidth = CONFIG.EQUIPMENT.SIZE.WIDTH;
        const equipDepth = CONFIG.EQUIPMENT.SIZE.DEPTH;
        const spacing = CONFIG.EQUIPMENT.SPACING.DEFAULT;
        const corridorCols = CONFIG.EQUIPMENT.SPACING.CORRIDOR_COLS;
        const corridorColWidth = CONFIG.EQUIPMENT.SPACING.CORRIDOR_COL_WIDTH;
        const corridorRows = CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROWS;
        const corridorRowWidth = CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROW_WIDTH;
        const rows = CONFIG.EQUIPMENT.ROWS;
        const cols = CONFIG.EQUIPMENT.COLS;
        
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
        
        return new THREE.Vector3(xPos, 0, zPos);
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
     * 제외 위치 로그
     */
    logExcludedPositions() {
        const excludedByCol = {};
        CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.forEach(pos => {
            if (!excludedByCol[pos.col]) {
                excludedByCol[pos.col] = [];
            }
            excludedByCol[pos.col].push(pos.row);
        });
        
        debugLog('❌ 제외된 설비 위치 요약:');
        Object.keys(excludedByCol).sort((a, b) => a - b).forEach(col => {
            const rows = excludedByCol[col].sort((a, b) => a - b);
            debugLog(`   Col ${col}: Row ${rows.join(', ')}`);
        });
    }
    
    /**
     * 설비 가져오기 (ID로)
     */
    getEquipment(equipmentId) {
        return this.equipmentMap.get(equipmentId);
    }
    
    /**
     * 모든 설비 가져오기
     */
    getAllEquipment() {
        return [...this.equipmentArray];
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
    
    /**
     * 설비 상태 업데이트
     * @param {string} equipmentId - 설비 ID
     * @param {string} status - 상태 ('running', 'idle', 'error')
     */
    updateEquipmentStatus(equipmentId, status) {
        const equipment = this.equipmentMap.get(equipmentId);
        
        if (equipment) {
            equipment.userData.status = status;
            debugLog(`설비 상태 업데이트: ${equipmentId} -> ${status}`);
        }
    }
    
    /**
     * 모든 설비 상태 일괄 업데이트
     * @param {Object} statusMap - {equipmentId: status} 맵
     */
    updateAllEquipmentStatus(statusMap) {
        let updateCount = 0;
        
        Object.entries(statusMap).forEach(([equipmentId, status]) => {
            const equipment = this.equipmentMap.get(equipmentId);
            if (equipment) {
                equipment.userData.status = status;
                updateCount++;
            }
        });
        
        debugLog(`일괄 상태 업데이트 완료: ${updateCount}개 설비`);
    }

    // ============================================
    // ⭐ Equipment Mapping 시각적 강조
    // ============================================
    
    /**
     * 설비 매핑 상태에 따라 시각적 강조
     * @param {string} equipmentId - Frontend ID (예: 'EQ-01-01')
     * @param {boolean} isComplete - 매핑 완료 여부
     */
    highlightMappingStatus(equipmentId, isComplete) {
        const equipment = this.equipmentMap.get(equipmentId);
        if (!equipment) {
            debugLog(`⚠️ Equipment not found: ${equipmentId}`);
            return;
        }
        
        equipment.traverse((child) => {
            if (child.isMesh && child.material) {
                if (isComplete) {
                    // 완료: 파란색 emissive
                    if (child.material.emissive) {
                        child.material.emissive.setHex(0x1e88e5); // 파란색
                        child.material.emissiveIntensity = 0.3;
                    }
                } else {
                    // 미완료: 기본 상태 (emissive 제거)
                    if (child.material.emissive) {
                        child.material.emissive.setHex(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                }
            }
        });
        
        debugLog(`${isComplete ? '✅' : '⭕'} Mapping status highlighted: ${equipmentId}`);
    }
    
    /**
     * 모든 설비 매핑 상태 업데이트
     * @param {Object} mappings - EquipmentEditState.mappings { 'EQ-01-01': {...}, ... }
     */
    updateAllMappingStatus(mappings) {
        let completedCount = 0;
        let incompleteCount = 0;
        
        this.equipmentArray.forEach(equipment => {
            const id = equipment.userData.id;
            const isComplete = id in mappings;
            
            this.highlightMappingStatus(id, isComplete);
            
            if (isComplete) {
                completedCount++;
            } else {
                incompleteCount++;
            }
        });
        
        debugLog(`📊 Mapping status updated: ${completedCount} complete, ${incompleteCount} incomplete`);
    }
    
    /**
     * 매핑 완료율 계산 및 표시
     * @param {Object} mappings - EquipmentEditState.mappings
     * @returns {number} 완료율 (0-100)
     */
    getMappingCompletionRate(mappings) {
        const totalEquipment = this.equipmentArray.length;
        const mappedCount = Object.keys(mappings).length;
        const rate = Math.round((mappedCount / totalEquipment) * 100);
        
        debugLog(`📈 Mapping completion rate: ${rate}% (${mappedCount}/${totalEquipment})`);
        
        return rate;
    }

    // =========================================================
    // ✨ Phase 4: 동적 CONFIG 적용
    // =========================================================
    
    /**
     * ✨ Phase 4: 동적 Equipment CONFIG 적용 및 재로드
     * Layout2DTo3DConverter에서 변환된 CONFIG 적용
     * 
     * @param {Object} newConfig - 새로운 Equipment CONFIG
     * @param {Function} updateStatusCallback - 상태 업데이트 콜백
     * @returns {Array} 새로 생성된 설비 배열
     */
    applyDynamicConfig(newConfig, updateStatusCallback = null) {
        if (!newConfig) {
            console.error('[EquipmentLoader] applyDynamicConfig: newConfig가 없습니다');
            return this.equipmentArray;
        }
        
        console.log('[EquipmentLoader] 동적 CONFIG 적용 시작...');
        
        // 1. 기존 설비 정리
        this.dispose();
        
        // 2. CONFIG 업데이트
        if (window.updateEquipmentConfig) {
            window.updateEquipmentConfig(newConfig);
        } else {
            // 직접 업데이트 (fallback)
            const { CONFIG } = require('../utils/Config.js');
            Object.assign(CONFIG.EQUIPMENT, newConfig);
        }
        
        // 3. 새 설비 로드
        this.loadEquipmentArray(updateStatusCallback);
        
        console.log('[EquipmentLoader] ✅ 동적 CONFIG 적용 완료');
        console.log(`   새 설비 수: ${this.equipmentArray.length}개`);
        
        // 적용 완료 이벤트 발생
        window.dispatchEvent(new CustomEvent('equipment-config-applied', {
            detail: { 
                config: newConfig, 
                equipmentCount: this.equipmentArray.length 
            }
        }));
        
        return this.equipmentArray;
    }
    
    /**
     * ✨ Phase 4: 설비만 재로드 (CONFIG 변경 없이)
     */
    reloadEquipment(updateStatusCallback = null) {
        console.log('[EquipmentLoader] 설비 재로드...');
        
        // 기존 설비 정리
        this.dispose();
        
        // 새로 로드
        return this.loadEquipmentArray(updateStatusCallback);
    }

    // ============================================
    // ⭐ Phase 2.5: Monitoring Mode - 미연결 설비 비활성화 표시
    // ⭐ v2.2.1-DEBUG: 디버그 코드 추가
    // ============================================
    
    /**
     * 설비의 원본 Material 상태 저장
     * @param {THREE.Group} equipment - 설비 객체
     */
    storeOriginalMaterials(equipment) {
        if (equipment.userData._originalMaterials) return; // 이미 저장됨
        
        const originals = [];
        equipment.traverse((child) => {
            if (child.isMesh && child.material) {
                const matData = {
                    mesh: child,
                    color: child.material.color ? child.material.color.clone() : null,
                    emissive: child.material.emissive ? child.material.emissive.clone() : null,
                    emissiveIntensity: child.material.emissiveIntensity || 0
                };
                originals.push(matData);
            }
        });
        
        equipment.userData._originalMaterials = originals;
    }
    
    /**
     * 설비의 원본 Material 상태 복원
     * @param {THREE.Group} equipment - 설비 객체
     */
    restoreOriginalMaterials(equipment) {
        const originals = equipment.userData._originalMaterials;
        if (!originals) return;
        
        originals.forEach((data) => {
            if (data.mesh && data.mesh.material) {
                const mat = data.mesh.material;
                // ⭐ 색상만 복원 (투명도 관련 제거)
                if (data.color && mat.color) {
                    mat.color.copy(data.color);
                }
                if (data.emissive && mat.emissive) {
                    mat.emissive.copy(data.emissive);
                }
                mat.emissiveIntensity = data.emissiveIntensity;
                mat.needsUpdate = true;
            }
        });
        
        equipment.userData._isDisabled = false;
    }
    
    /**
     * 🌫️ 설비를 비활성화 상태로 표시 (회색만 적용 - 투명도 사용 안함!)
     * 
     * ⭐ v2.2.1-DEBUG: 디버그 로그 추가
     * 
     * @param {string} equipmentId - 설비 ID (예: 'EQ-01-01')
     * @param {boolean} disabled - 비활성화 여부
     * @param {Object} options - 옵션 { grayColor: 0x555555 }
     */
    setEquipmentDisabled(equipmentId, disabled, options = {}) {
        const equipment = this.equipmentMap.get(equipmentId);
        if (!equipment) {
            return; // 조용히 무시
        }
        
        const {
            grayColor = 0x555555    // 어두운 회색 (미연결 표시)
        } = options;
        
        // 원본 상태 저장
        this.storeOriginalMaterials(equipment);
        
        // 🔴 DEBUG: 첫 번째 설비만 상세 로그
        const isFirstEquipment = equipmentId === 'EQ-01-01';
        
        if (disabled) {
            // 🌫️ 비활성화 스타일 적용 (색상만 변경!)
            let meshCount = 0;
            equipment.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mat = child.material;
                    
                    // 🔴 DEBUG LOG
                    if (isFirstEquipment && meshCount === 0) {
                        console.log('🔴 DEBUG setEquipmentDisabled:', {
                            equipmentId,
                            disabled,
                            grayColor: grayColor.toString(16),
                            beforeColor: mat.color ? mat.color.getHexString() : 'none',
                            materialType: mat.type,
                            transparent: mat.transparent,
                            opacity: mat.opacity
                        });
                    }
                    
                    // 회색조 처리 (색상만 변경)
                    if (mat.color) {
                        mat.color.setHex(grayColor);
                    }
                    
                    // 발광 제거
                    if (mat.emissive) {
                        mat.emissive.setHex(0x000000);
                        mat.emissiveIntensity = 0;
                    }
                    
                    mat.needsUpdate = true;
                    meshCount++;
                    
                    // 🔴 DEBUG LOG
                    if (isFirstEquipment && meshCount === 1) {
                        console.log('🔴 DEBUG after setHex:', {
                            afterColor: mat.color ? mat.color.getHexString() : 'none',
                            transparent: mat.transparent,
                            opacity: mat.opacity
                        });
                    }
                }
            });
            
            equipment.userData._isDisabled = true;
            
        } else {
            // 원본 상태 복원
            this.restoreOriginalMaterials(equipment);
        }
    }
    
    /**
     * 🎯 Monitoring Mode용: 매핑 상태에 따라 설비 활성화/비활성화
     * @param {Object} mappings - EquipmentEditState.mappings
     * @param {Object} options - 비활성화 옵션 (색상만)
     * @returns {Object} { mapped: number, unmapped: number }
     */
    applyMonitoringModeVisibility(mappings, options = {}) {
        // 🔴 DEBUG: 함수 호출 확인
        console.log('🔴🔴🔴 DEBUG applyMonitoringModeVisibility 호출됨!');
        console.log('🔴 mappings:', mappings);
        console.log('🔴 mappings keys count:', Object.keys(mappings).length);
        console.log('🔴 options:', options);
        console.log('🔴 equipmentArray length:', this.equipmentArray.length);
        
        let mappedCount = 0;
        let unmappedCount = 0;
        
        this.equipmentArray.forEach((equipment, index) => {
            const id = equipment.userData.id;
            const isMapped = id in mappings;
            
            // 🔴 DEBUG: 처음 3개만 로그
            if (index < 3) {
                console.log(`🔴 DEBUG equipment[${index}]:`, {
                    id,
                    isMapped,
                    willDisable: !isMapped
                });
            }
            
            if (isMapped) {
                // 매핑된 설비: 정상 표시
                this.setEquipmentDisabled(id, false);
                mappedCount++;
            } else {
                // 미매핑 설비: 비활성화 표시 (회색만!)
                this.setEquipmentDisabled(id, true, options);
                unmappedCount++;
            }
        });
        
        // 🔴 DEBUG: 결과 로그
        console.log('🔴🔴🔴 DEBUG applyMonitoringModeVisibility 완료!');
        console.log(`🔴 결과: mapped=${mappedCount}, unmapped=${unmappedCount}`);
        
        debugLog(`📊 Monitoring visibility applied: ${mappedCount} mapped, ${unmappedCount} unmapped`);
        
        return { mapped: mappedCount, unmapped: unmappedCount };
    }
    
    /**
     * 🔄 모든 설비 활성화 상태로 복원 (Monitoring Mode 종료 시)
     */
    resetAllEquipmentVisibility() {
        // 🔴 DEBUG
        console.log('🔴🔴🔴 DEBUG resetAllEquipmentVisibility 호출됨!');
        
        this.equipmentArray.forEach(equipment => {
            this.restoreOriginalMaterials(equipment);
        });
        
        debugLog(`✅ All equipment visibility reset`);
    }
    
    /**
     * 특정 설비가 비활성화 상태인지 확인
     * @param {string} equipmentId - 설비 ID
     * @returns {boolean}
     */
    isEquipmentDisabled(equipmentId) {
        const equipment = this.equipmentMap.get(equipmentId);
        return equipment?.userData._isDisabled === true;
    }

    /**
     * 설비 메모리 정리
     */
    dispose() {
        debugLog('EquipmentLoader 메모리 정리 시작...');
        
        this.equipmentArray.forEach(equipment => {
            // Geometry 정리
            equipment.traverse(object => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
            
            // 씬에서 제거
            this.scene.remove(equipment);
        });
        
        this.equipmentArray = [];
        this.equipmentMap.clear();
        
        debugLog('✓ EquipmentLoader 메모리 정리 완료');
    }
}
