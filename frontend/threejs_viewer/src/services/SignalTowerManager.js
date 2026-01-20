/**
 * SignalTowerManager.js
 * =====================
 * Signal Tower (경광등) 제어 관리자
 * 
 * @version 2.2.0
 * @description
 * - 설비 상태에 따른 경광등 색상 제어
 * - RUN/IDLE/STOP/SUDDENSTOP/DISCONNECTED 상태 지원
 * - SUDDENSTOP 빠른 점멸 애니메이션
 * - UDS (Unified Data Store) 통합 연동 지원
 * 
 * @changelog
 * ⭐ v2.2.0: UDS (Unified Data Store) 통합 연동 (2026-01-20)
 *   - initializeFromUDS(equipments) 메서드 추가
 *   - updateFromUDSDelta(frontendId, changes) 메서드 추가
 *   - batchUpdateFromUDS(updates) 배치 업데이트 지원
 *   - getStatusForUDS(frontendId) UDS 호환 상태 반환
 *   - 기존 모든 기능 100% 호환성 유지
 * 
 * ⭐ v2.1.2: 상태값 대소문자 정규화 (2026-01-14)
 *   - updateStatus(): _normalizeStatus() 추가
 *   - SignalTowerIntegration에서 'running' → 'RUN'으로 정규화
 * 
 * ⭐ v2.1.1: turnOffAllLights 메서드 추가
 *   - Monitoring 모드 종료 시 모든 램프 OFF
 * 
 * ⭐ v2.1.0: SUDDENSTOP 점멸 + DISCONNECTED 상태 추가
 *   - STOP: red → yellow로 변경
 *   - SUDDENSTOP: red 빠른 점멸
 *   - DISCONNECTED: 모든 램프 OFF
 * 
 * @dependencies
 * - three (THREE.js)
 * - core/utils/Config.js (debugLog)
 * 
 * @exports
 * - SignalTowerManager (class)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/SignalTowerManager.js
 * 작성일: 2026-01-08
 * 수정일: 2026-01-20
 */

import * as THREE from 'three';
import { debugLog } from '../core/utils/Config.js';

export class SignalTowerManager {
    constructor(scene, equipmentLoader) {
        this.scene = scene;
        this.equipmentLoader = equipmentLoader;
        
        // 설비별 램프 맵 (Frontend ID -> { green, yellow, red } 램프 객체들)
        this.lampMap = new Map();
        
        // 설비별 현재 상태 (Frontend ID -> 상태값)
        // 'RUN' | 'IDLE' | 'STOP' | 'SUDDENSTOP' | 'DISCONNECTED' | 'OFF' | 'DISABLED'
        this.statusMap = new Map();
        
        // ⭐ v2.1.0: 상태별 램프 타입 매핑 (수정됨)
        this.statusToLightType = {
            'RUN': 'green',
            'IDLE': 'yellow',
            'STOP': 'yellow',           // ⭐ v2.1.0: red → yellow로 변경
            'SUDDENSTOP': 'red',        // ⭐ v2.1.0: 신규 추가 (빠른 점멸)
            'DISCONNECTED': null,       // ⭐ v2.1.0: 신규 추가 (모든 램프 OFF)
            'OFF': null                 // 모든 램프 꺼짐
        };
        
        // ⭐ v2.1.0: 램프 상태별 시각 설정
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
        this.blinkSpeed = 2.0;              // 일반 깜빡임 속도
        this.suddenStopBlinkSpeed = 8.0;    // ⭐ v2.1.0: SUDDENSTOP 빠른 점멸 속도
        this.blinkEnabled = true;           // 깜빡임 활성화 여부
        
        // 🆕 v2.2.0: UDS 연동 상태
        this._udsInitialized = false;
        this._lastUDSUpdate = null;
        
        debugLog('SignalTowerManager initialized (v2.2.0 - UDS Integration)');
    }
    
    // ============================================
    // 🆕 v2.2.0: UDS 통합 연동 메서드
    // ============================================
    
    /**
     * UDS 데이터로 초기화
     * @param {Object[]} equipments - UDS 초기 로드 데이터
     * @returns {Object} - { success, updated, failed }
     * 
     * @description
     * UDS에서 로드된 전체 설비 데이터로 SignalTower 상태 일괄 초기화
     * 
     * @example
     * const result = signalTowerManager.initializeFromUDS(equipments);
     * console.log(`Updated: ${result.updated}, Failed: ${result.failed}`);
     */
    initializeFromUDS(equipments) {
        debugLog(`🚀 [UDS] Initializing SignalTowers from ${equipments.length} equipments...`);
        
        const startTime = performance.now();
        let updated = 0;
        let failed = 0;
        const errors = [];
        
        for (const equipment of equipments) {
            try {
                const frontendId = equipment.frontend_id;
                const status = equipment.status || 'DISCONNECTED';
                
                if (!frontendId) {
                    failed++;
                    continue;
                }
                
                // 상태 업데이트
                this.updateStatus(frontendId, status);
                updated++;
                
            } catch (error) {
                failed++;
                errors.push({
                    equipment: equipment.frontend_id,
                    error: error.message
                });
            }
        }
        
        const elapsed = performance.now() - startTime;
        this._udsInitialized = true;
        this._lastUDSUpdate = new Date().toISOString();
        
        debugLog(`✅ [UDS] SignalTower initialization complete: ${updated} updated, ${failed} failed (${elapsed.toFixed(2)}ms)`);
        
        if (errors.length > 0) {
            console.warn('⚠️ [UDS] Some equipment failed to update:', errors.slice(0, 5));
        }
        
        return {
            success: true,
            updated,
            failed,
            elapsed,
            errors: errors.slice(0, 10)  // 최대 10개만 반환
        };
    }
    
    /**
     * UDS Delta Update 처리
     * @param {string} frontendId - Frontend ID
     * @param {Object} changes - 변경된 필드들
     * @returns {boolean} - 업데이트 성공 여부
     * 
     * @description
     * UDS WebSocket에서 수신한 Delta Update 적용
     * 상태(status) 필드가 변경된 경우에만 SignalTower 업데이트
     * 
     * @example
     * signalTowerManager.updateFromUDSDelta('EQ-01-01', { status: 'RUN' });
     */
    updateFromUDSDelta(frontendId, changes) {
        if (!frontendId) {
            console.warn('⚠️ [UDS] updateFromUDSDelta: Missing frontendId');
            return false;
        }
        
        // 상태 변경이 있는 경우에만 업데이트
        if (changes.status !== undefined) {
            const newStatus = changes.status || 'DISCONNECTED';
            const oldStatus = this.statusMap.get(frontendId);
            
            if (oldStatus !== newStatus) {
                debugLog(`📊 [UDS] Delta update: ${frontendId} ${oldStatus} → ${newStatus}`);
                this.updateStatus(frontendId, newStatus);
                this._lastUDSUpdate = new Date().toISOString();
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * UDS 배치 Delta Update 처리
     * @param {Object[]} updates - Delta Update 배열 [{ frontend_id, changes }]
     * @returns {Object} - { updated, skipped }
     * 
     * @description
     * 여러 설비의 Delta Update를 일괄 처리
     * 
     * @example
     * const result = signalTowerManager.batchUpdateFromUDS([
     *     { frontend_id: 'EQ-01-01', changes: { status: 'RUN' } },
     *     { frontend_id: 'EQ-01-02', changes: { status: 'IDLE' } }
     * ]);
     */
    batchUpdateFromUDS(updates) {
        if (!Array.isArray(updates) || updates.length === 0) {
            return { updated: 0, skipped: 0 };
        }
        
        debugLog(`📦 [UDS] Batch update: ${updates.length} equipments`);
        
        let updated = 0;
        let skipped = 0;
        
        for (const update of updates) {
            const frontendId = update.frontend_id;
            const changes = update.changes || {};
            
            if (this.updateFromUDSDelta(frontendId, changes)) {
                updated++;
            } else {
                skipped++;
            }
        }
        
        debugLog(`✅ [UDS] Batch update complete: ${updated} updated, ${skipped} skipped`);
        
        return { updated, skipped };
    }
    
    /**
     * UDS 호환 상태 반환
     * @param {string} frontendId - Frontend ID
     * @returns {Object|null} - UDS 호환 상태 객체
     * 
     * @description
     * UDS 데이터 형식에 맞게 설비 상태 반환
     * 
     * @example
     * const status = signalTowerManager.getStatusForUDS('EQ-01-01');
     * // { frontend_id: 'EQ-01-01', status: 'RUN', lamp_state: 'green' }
     */
    getStatusForUDS(frontendId) {
        const status = this.statusMap.get(frontendId);
        
        if (!status) {
            return null;
        }
        
        return {
            frontend_id: frontendId,
            status: status,
            lamp_state: this.statusToLightType[status] || null,
            is_disabled: status === 'DISABLED',
            is_disconnected: status === 'DISCONNECTED',
            last_update: this._lastUDSUpdate
        };
    }
    
    /**
     * UDS 초기화 여부 확인
     * @returns {boolean}
     */
    isUDSInitialized() {
        return this._udsInitialized;
    }
    
    /**
     * 전체 상태를 UDS 형식으로 반환
     * @returns {Object[]} - UDS 호환 상태 배열
     */
    getAllStatusesForUDS() {
        const statuses = [];
        
        this.statusMap.forEach((status, frontendId) => {
            statuses.push(this.getStatusForUDS(frontendId));
        });
        
        return statuses;
    }
    
    // ============================================
    // ⭐ 모든 설비의 경광등 램프 초기화
    // ============================================
    
    /**
     * 모든 설비의 경광등 램프 초기화
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
     * ⭐ v2.1.0: 특정 설비를 DISCONNECTED 상태로 설정
     * 24시간 내 데이터가 없는 설비 (모든 램프 OFF, DISABLED와 다름)
     * @param {string} frontendId - Frontend ID
     */
    setDisconnected(frontendId) {
        const lights = this.lampMap.get(frontendId);
        if (!lights) return;
        
        // 모든 램프 OFF (DISABLED와 달리 정상 OFF 상태)
        this.setLampOff(lights.green, 'green');
        this.setLampOff(lights.yellow, 'yellow');
        this.setLampOff(lights.red, 'red');
        
        this.statusMap.set(frontendId, 'DISCONNECTED');
        
        debugLog(`🔌 ${frontendId} set to DISCONNECTED (no recent data)`);
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
     * ⭐ v2.1.2: 상태값 대소문자 정규화 추가
     * ⭐ v2.1.0: SUDDENSTOP, DISCONNECTED 지원 추가
     * 🆕 v2.2.0: UDS 연동 최적화
     * 
     * @param {string} frontendId - 설비 Frontend ID (예: 'EQ-01-01')
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED', 'OFF')
     *                          소문자도 허용 ('running', 'idle', 'stop' 등)
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
        
        // ⭐ v2.1.2: 상태값 정규화 (대소문자 통일)
        const normalizedStatus = this._normalizeStatus(status);
        
        // 🆕 v2.2.0: 동일 상태 스킵 (성능 최적화)
        if (currentStatus === normalizedStatus) {
            return;
        }
        
        // ⭐ v2.1.0: DISCONNECTED 상태 처리
        if (normalizedStatus === 'DISCONNECTED' || normalizedStatus === null) {
            this.setDisconnected(frontendId);
            return;
        }
        
        // 상태에 해당하는 램프 타입 찾기
        const activeLightType = this.statusToLightType[normalizedStatus];
        
        // ⭐ v2.0.0: 모든 램프 OFF 상태로 (어두운 색상)
        this.setLampOff(lights.green, 'green');
        this.setLampOff(lights.yellow, 'yellow');
        this.setLampOff(lights.red, 'red');
        
        // ⭐ v2.1.0: SUDDENSTOP은 빠른 점멸을 위해 ON 상태로 설정
        // (animate()에서 빠른 점멸 처리)
        if (activeLightType && lights[activeLightType]) {
            this.setLampOn(lights[activeLightType], activeLightType);
            
            // ⭐ v2.1.0: SUDDENSTOP은 특별 마킹
            if (normalizedStatus === 'SUDDENSTOP') {
                lights[activeLightType].userData.isSuddenStop = true;
                debugLog(`🚨 ${frontendId} -> SUDDENSTOP (red lamp BLINKING)`);
            } else {
                lights[activeLightType].userData.isSuddenStop = false;
                debugLog(`🚨 ${frontendId} -> ${normalizedStatus} (${activeLightType} lamp ON)`);
            }
        } else {
            debugLog(`🚨 ${frontendId} -> OFF (all lamps OFF)`);
        }
        
        // 상태 저장
        this.statusMap.set(frontendId, normalizedStatus);
    }
    
    /**
     * ⭐ v2.1.2: 상태값 정규화 (대소문자 통일)
     * SignalTowerIntegration에서 'running', 'idle' 등 소문자로 올 수 있음
     * 
     * @private
     * @param {string} status - 원본 상태
     * @returns {string} 정규화된 상태 (대문자)
     */
    _normalizeStatus(status) {
        if (!status) return 'DISCONNECTED';
        
        const upperStatus = status.toString().toUpperCase();
        
        // 소문자 → 대문자 매핑
        const statusMap = {
            'RUNNING': 'RUN',
            'RUN': 'RUN',
            'IDLE': 'IDLE',
            'WAIT': 'IDLE',
            'WAITING': 'IDLE',
            'STOP': 'STOP',
            'STOPPED': 'STOP',
            'DOWN': 'STOP',
            'SUDDENSTOP': 'SUDDENSTOP',
            'ALARM': 'SUDDENSTOP',
            'ERROR': 'SUDDENSTOP',
            'DISCONNECTED': 'DISCONNECTED',
            'OFFLINE': 'DISCONNECTED',
            'UNKNOWN': 'DISCONNECTED',
            'OFF': 'OFF'
        };
        
        return statusMap[upperStatus] || 'DISCONNECTED';
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
    
    /**
     * 🆕 v2.1.1: 모든 설비의 램프를 OFF 상태로 설정
     * Monitoring 모드 종료 시 호출
     * @returns {number} OFF로 설정된 설비 수
     */
    turnOffAllLights() {
        let count = 0;
        
        this.lampMap.forEach((lights, frontendId) => {
            this.setAllLampsOff(frontendId);
            count++;
        });
        
        debugLog(`🚨 All lights turned off: ${count} equipment`);
        return count;
    }
    
    // ============================================
    // 애니메이션
    // ============================================
    
    /**
     * 깜빡임 애니메이션 업데이트
     * ⭐ v2.1.0: SUDDENSTOP 빠른 점멸 추가
     * 
     * @param {number} deltaTime - 프레임 간 경과 시간
     */
    animate(deltaTime) {
        if (!this.blinkEnabled) return;
        
        this.animationTime += deltaTime;
        
        // 일반 깜빡임: 사인파로 구현 (0.5~1.0 범위)
        const normalBlinkFactor = 0.5 + (Math.sin(this.animationTime * this.blinkSpeed) + 1) / 4;
        
        // ⭐ v2.1.0: SUDDENSTOP 빠른 점멸 (ON/OFF 토글, 0 또는 1)
        const suddenStopBlinkOn = Math.sin(this.animationTime * this.suddenStopBlinkSpeed) > 0;
        
        // 모든 설비의 램프 순회
        this.lampMap.forEach((lights, frontendId) => {
            const status = this.statusMap.get(frontendId);
            
            // DISABLED, DISCONNECTED 상태는 깜빡임 없음
            if (status === 'DISABLED' || status === 'DISCONNECTED') return;
            
            // 활성화된 램프 처리
            ['green', 'yellow', 'red'].forEach(lightType => {
                const lamp = lights[lightType];
                
                if (lamp && lamp.userData.isActive && lamp.userData.currentState === 'ON') {
                    const baseIntensity = this.lampStates.ON[lightType].emissiveIntensity;
                    
                    // ⭐ v2.1.0: SUDDENSTOP 빠른 점멸 (ON/OFF 완전 토글)
                    if (lamp.userData.isSuddenStop) {
                        if (suddenStopBlinkOn) {
                            // ON: 최대 밝기
                            lamp.material.emissiveIntensity = baseIntensity * 1.5; // 더 밝게
                            lamp.material.opacity = 1.0;
                        } else {
                            // OFF: 꺼짐 (완전 어둡게)
                            lamp.material.emissiveIntensity = 0;
                            lamp.material.opacity = 0.3;
                        }
                    } else {
                        // 일반 깜빡임: 부드러운 펄스
                        lamp.material.emissiveIntensity = baseIntensity * normalBlinkFactor;
                    }
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
     * @returns {string|null} 상태값 또는 null
     */
    getStatus(frontendId) {
        return this.statusMap.get(frontendId) || null;
    }
    
    /**
     * 특정 상태의 설비 개수 조회
     * @param {string} status - 상태
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
     * ⭐ v2.1.0: SUDDENSTOP, DISCONNECTED 추가
     * 
     * @returns {Object} { RUN: 10, IDLE: 5, STOP: 2, SUDDENSTOP: 1, DISCONNECTED: 3, OFF: 96, DISABLED: 0 }
     */
    getStatusStatistics() {
        const stats = {
            RUN: 0,
            IDLE: 0,
            STOP: 0,
            SUDDENSTOP: 0,      // ⭐ v2.1.0: 추가
            DISCONNECTED: 0,   // ⭐ v2.1.0: 추가
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
     * 🆕 v2.2.0: UDS 호환 통계 반환
     * @returns {Object} { RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED, TOTAL }
     */
    getStatusStatisticsForUDS() {
        const stats = this.getStatusStatistics();
        
        return {
            RUN: stats.RUN,
            IDLE: stats.IDLE,
            STOP: stats.STOP,
            SUDDENSTOP: stats.SUDDENSTOP,
            DISCONNECTED: stats.DISCONNECTED,
            TOTAL: stats.RUN + stats.IDLE + stats.STOP + stats.SUDDENSTOP + stats.DISCONNECTED
        };
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
     * ⭐ v2.1.0: SUDDENSTOP 포함
     */
    testRandomStatus() {
        const statuses = ['RUN', 'IDLE', 'STOP', 'SUDDENSTOP'];
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
     * ⭐ v2.1.0: SUDDENSTOP, DISCONNECTED 포함
     * 
     * @param {string} frontendId - Frontend ID
     */
    testCycleStatus(frontendId) {
        const statuses = ['RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED', 'OFF'];
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
        console.log('Version: 2.2.0 (UDS Integration)');
        console.log('Total equipment with lamps:', this.lampMap.size);
        console.log('Statistics:', this.getStatusStatistics());
        console.log('UDS Statistics:', this.getStatusStatisticsForUDS());
        console.log('Blink enabled:', this.blinkEnabled);
        console.log('Blink speeds:', {
            normal: this.blinkSpeed,
            suddenStop: this.suddenStopBlinkSpeed
        });
        console.log('UDS Initialized:', this._udsInitialized);
        console.log('Last UDS Update:', this._lastUDSUpdate);
        
        // 상태별 설비 목록 (처음 5개씩만)
        const byStatus = { RUN: [], IDLE: [], STOP: [], SUDDENSTOP: [], DISCONNECTED: [], OFF: [], DISABLED: [] };
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
        
        // 🆕 v2.2.0: UDS 상태 초기화
        this._udsInitialized = false;
        this._lastUDSUpdate = null;
        
        debugLog('✓ SignalTowerManager 메모리 정리 완료');
    }
    
    // ============================================
    // 🆕 v2.2.0: Static 메서드
    // ============================================
    
    /**
     * 버전 정보
     */
    static get VERSION() {
        return '2.2.0';
    }
    
    /**
     * 지원 상태 목록
     */
    static get SUPPORTED_STATUSES() {
        return ['RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED', 'OFF', 'DISABLED'];
    }
}

export default SignalTowerManager;