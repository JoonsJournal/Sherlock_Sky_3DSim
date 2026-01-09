/**
 * SignalTowerIntegration.js - v1.0.0
 * SignalTower 및 설비 스타일 관리 모듈
 * 
 * Phase 6: MonitoringService에서 추출
 * - SignalTowerManager 래핑
 * - 미매핑 설비 SignalTower 램프 DISABLED 처리
 * - 미매핑 설비 모델 회색 처리
 * - 설비 상태 업데이트 (램프 제어)
 * - 상태 정규화 유틸리티
 * 
 * @version 1.0.0
 * @since 2026-01-10
 * 
 * 외부 의존성 (외부에서 주입):
 * - SignalTowerManager: updateStatus(), initializeAllLights(), disableUnmappedEquipment(), clearDisabledState(), getStatusStatistics()
 * - EquipmentLoader: getAllEquipment(), applyMonitoringModeVisibility(), restoreEquipmentStyle(), resetAllEquipmentVisibility()
 * - EquipmentEditState: getAllMappings(), isComplete()
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/SignalTowerIntegration.js
 */

import { debugLog } from '../../core/utils/Config.js';

/**
 * 기본 비활성화 옵션
 */
const DEFAULT_DISABLED_OPTIONS = {
    grayColor: 0x444444  // 어두운 회색 (바닥과 구별)
};

/**
 * 상태 정규화 매핑
 */
const STATUS_MAP = {
    'RUN': 'running',
    'RUNNING': 'running',
    'IDLE': 'idle',
    'STOP': 'stop',
    'ALARM': 'alarm',
    'DOWN': 'down',
    'DISCONNECTED': 'disconnected',
    'SUDDENSTOP': 'suddenstop'
};

/**
 * SignalTower 통합 관리 클래스
 */
export class SignalTowerIntegration {
    /**
     * @param {Object} signalTowerManager - SignalTowerManager 인스턴스
     * @param {Object} equipmentLoader - EquipmentLoader 인스턴스 (선택)
     * @param {Object} equipmentEditState - EquipmentEditState 인스턴스 (선택)
     * @param {Object} options - 옵션
     * @param {boolean} options.debug - 디버그 로그 출력 (기본: false)
     */
    constructor(signalTowerManager, equipmentLoader = null, equipmentEditState = null, options = {}) {
        this.signalTowerManager = signalTowerManager;
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        
        this.debug = options.debug || false;
        
        // 비활성화 옵션
        this.disabledOptions = { ...DEFAULT_DISABLED_OPTIONS };
        
        // 마지막 적용 결과 캐시
        this._lastApplyResult = {
            mapped: 0,
            unmapped: 0,
            total: 0,
            rate: 0
        };
        
        this._log('🚨 SignalTowerIntegration 초기화');
    }
    
    /**
     * 디버그 로그 출력
     * @private
     */
    _log(...args) {
        if (this.debug) {
            console.log('[SignalTowerIntegration]', ...args);
        }
        // debugLog도 호출 (Config.js 사용 시)
        if (typeof debugLog === 'function') {
            debugLog('[SignalTowerIntegration]', ...args);
        }
    }
    
    // ===============================================
    // 의존성 설정
    // ===============================================
    
    /**
     * SignalTowerManager 설정 (지연 주입)
     * @param {Object} manager - SignalTowerManager 인스턴스
     */
    setSignalTowerManager(manager) {
        this.signalTowerManager = manager;
        this._log('🔗 SignalTowerManager 연결됨');
    }
    
    /**
     * EquipmentLoader 설정 (지연 주입)
     * @param {Object} loader - EquipmentLoader 인스턴스
     */
    setEquipmentLoader(loader) {
        this.equipmentLoader = loader;
        this._log('🔗 EquipmentLoader 연결됨');
    }
    
    /**
     * EquipmentEditState 설정 (지연 주입)
     * @param {Object} state - EquipmentEditState 인스턴스
     */
    setEquipmentEditState(state) {
        this.equipmentEditState = state;
        this._log('🔗 EquipmentEditState 연결됨');
    }
    
    /**
     * 모든 의존성 설정 (지연 주입)
     * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
     * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
     */
    setDependencies(equipmentLoader, equipmentEditState) {
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        this._log('🔗 Dependencies 연결됨');
    }
    
    /**
     * 비활성화 옵션 설정
     * @param {Object} options - 옵션 { grayColor: 0x444444 }
     */
    setDisabledOptions(options) {
        this.disabledOptions = { ...this.disabledOptions, ...options };
        this._log('⚙️ Disabled options updated:', this.disabledOptions);
    }
    
    // ===============================================
    // 램프 초기화
    // ===============================================
    
    /**
     * 모든 램프 초기화 (OFF 상태)
     * @returns {number} 초기화된 램프 수
     */
    initializeAllLights() {
        if (!this.signalTowerManager) {
            this._log('⚠️ SignalTowerManager not available');
            return 0;
        }
        
        const count = this.signalTowerManager.initializeAllLights?.() || 0;
        this._log(`🚨 SignalTower lights initialized (all OFF): ${count}`);
        return count;
    }
    
    // ===============================================
    // 미매핑 설비 스타일 적용
    // ===============================================
    
    /**
     * 미매핑 설비 스타일 적용 (모델 + 램프)
     * - 모델: 회색 처리
     * - 램프: DISABLED 처리
     * @returns {{ mapped: number, unmapped: number, total: number, rate: number }}
     */
    applyUnmappedStyle() {
        const result = {
            mapped: 0,
            unmapped: 0,
            total: 0,
            rate: 0
        };
        
        // 1. 설비 모델 회색 처리
        const modelResult = this._applyUnmappedEquipmentModel();
        result.mapped = modelResult.mapped;
        result.unmapped = modelResult.unmapped;
        result.total = modelResult.mapped + modelResult.unmapped;
        result.rate = result.total > 0 
            ? Math.round((result.mapped / result.total) * 100) 
            : 0;
        
        // 2. SignalTower 램프 DISABLED 처리
        const lampResult = this._applyUnmappedSignalTowerLamps();
        
        // 결과 캐시
        this._lastApplyResult = { ...result };
        
        this._log(`✅ Unmapped style applied: ${result.mapped} mapped, ${result.unmapped} unmapped (${result.rate}%)`);
        
        return result;
    }
    
    /**
     * 미매핑 설비 모델 회색 처리 (내부)
     * @private
     * @returns {{ mapped: number, unmapped: number }}
     */
    _applyUnmappedEquipmentModel() {
        if (!this.equipmentLoader || !this.equipmentEditState) {
            this._log('⚠️ Dependencies not ready for model style');
            return { mapped: 0, unmapped: 0 };
        }
        
        const mappings = this.equipmentEditState.getAllMappings?.() || {};
        const result = this.equipmentLoader.applyMonitoringModeVisibility?.(
            mappings,
            this.disabledOptions
        ) || { mapped: 0, unmapped: 0 };
        
        this._log(`🌫️ Unmapped equipment model grayed out: ${result.unmapped}개`);
        
        return result;
    }
    
    /**
     * 미매핑 설비 SignalTower 램프 DISABLED 처리 (내부)
     * @private
     * @returns {{ mappedCount: number, unmappedCount: number, unmappedIds: string[] }}
     */
    _applyUnmappedSignalTowerLamps() {
        if (!this.signalTowerManager || !this.equipmentLoader || !this.equipmentEditState) {
            this._log('⚠️ Dependencies not ready for SignalTower style');
            return { mappedCount: 0, unmappedCount: 0, unmappedIds: [] };
        }
        
        const equipmentArray = this.equipmentLoader.getAllEquipment?.() || [];
        const unmappedIds = [];
        const mappedIds = [];
        
        equipmentArray.forEach(equipment => {
            const frontendId = equipment.userData?.id;
            if (!frontendId) return;
            
            const isMapped = this.equipmentEditState.isComplete?.(frontendId) || false;
            
            if (isMapped) {
                mappedIds.push(frontendId);
            } else {
                unmappedIds.push(frontendId);
            }
        });
        
        // 미매핑 설비 램프 DISABLED
        if (unmappedIds.length > 0 && this.signalTowerManager.disableUnmappedEquipment) {
            this.signalTowerManager.disableUnmappedEquipment(unmappedIds);
        }
        
        this._log(`🚨 SignalTower: ${mappedIds.length} mapped, ${unmappedIds.length} disabled`);
        
        return {
            mappedCount: mappedIds.length,
            unmappedCount: unmappedIds.length,
            unmappedIds: unmappedIds
        };
    }
    
    /**
     * 미매핑 설비 모델만 회색 처리 (레거시 호환)
     * @returns {{ mapped: number, unmapped: number }}
     */
    applyUnmappedEquipmentStyle() {
        return this._applyUnmappedEquipmentModel();
    }
    
    /**
     * 미매핑 SignalTower 램프만 DISABLED 처리 (레거시 호환)
     */
    applyUnmappedSignalTowerStyle() {
        this._applyUnmappedSignalTowerLamps();
    }
    
    // ===============================================
    // 설비 상태 업데이트
    // ===============================================
    
    /**
     * 설비 상태 업데이트 (SignalTower 램프 제어)
     * @param {string} frontendId - Frontend ID (예: 'EQ-01-01')
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED')
     * @param {boolean} normalize - 상태 정규화 여부 (기본: true)
     */
    updateStatus(frontendId, status, normalize = true) {
        if (!this.signalTowerManager) {
            this._log('⚠️ SignalTowerManager not available');
            return;
        }
        
        const finalStatus = normalize ? this.normalizeStatus(status) : status;
        
        // SignalTowerManager의 updateStatus 또는 updateSignalTower 호출
        if (this.signalTowerManager.updateSignalTower) {
            this.signalTowerManager.updateSignalTower(frontendId, finalStatus);
        } else if (this.signalTowerManager.updateStatus) {
            this.signalTowerManager.updateStatus(frontendId, finalStatus);
        }
        
        this._log(`🚦 SignalTower updated: ${frontendId} → ${finalStatus}`);
    }
    
    /**
     * 상태 정규화 (Backend → Frontend 형식)
     * @param {string} status - 원본 상태
     * @returns {string} 정규화된 상태
     */
    normalizeStatus(status) {
        if (!status) return 'disconnected';
        
        const upperStatus = status.toUpperCase();
        return STATUS_MAP[upperStatus] || status.toLowerCase();
    }
    
    // ===============================================
    // 개별 설비 스타일 복원
    // ===============================================
    
    /**
     * DISABLED 상태 해제 (새 매핑 시)
     * @param {string} frontendId - Frontend ID
     */
    clearDisabledState(frontendId) {
        if (this.signalTowerManager?.clearDisabledState) {
            this.signalTowerManager.clearDisabledState(frontendId);
            this._log(`✅ ${frontendId} SignalTower enabled`);
        }
    }
    
    /**
     * 설비 모델 스타일 복원 (새 매핑 시)
     * @param {string} frontendId - Frontend ID
     */
    restoreEquipmentStyle(frontendId) {
        if (this.equipmentLoader?.restoreEquipmentStyle) {
            this.equipmentLoader.restoreEquipmentStyle(frontendId);
            this._log(`✅ ${frontendId} model style restored`);
        }
    }
    
    /**
     * 개별 설비 전체 스타일 복원 (모델 + 램프)
     * @param {string} frontendId - Frontend ID
     */
    restoreEquipmentFullStyle(frontendId) {
        this.restoreEquipmentStyle(frontendId);
        this.clearDisabledState(frontendId);
    }
    
    // ===============================================
    // 모든 스타일 초기화
    // ===============================================
    
    /**
     * 모든 설비 스타일 초기화 (모니터링 종료 시)
     */
    resetAllStyles() {
        if (this.equipmentLoader?.resetAllEquipmentVisibility) {
            this.equipmentLoader.resetAllEquipmentVisibility();
            this._log('✅ All equipment styles reset');
        }
    }
    
    // ===============================================
    // 통계 조회
    // ===============================================
    
    /**
     * SignalTower 상태 통계 조회
     * @returns {{ RUN: number, IDLE: number, STOP: number, SUDDENSTOP: number, DISCONNECTED: number, OFF: number, DISABLED: number }}
     */
    getStatusStatistics() {
        if (this.signalTowerManager?.getStatusStatistics) {
            return this.signalTowerManager.getStatusStatistics();
        }
        
        return {
            RUN: 0,
            IDLE: 0,
            STOP: 0,
            SUDDENSTOP: 0,
            DISCONNECTED: 0,
            OFF: 0,
            DISABLED: 0
        };
    }
    
    /**
     * 마지막 적용 결과 조회
     * @returns {{ mapped: number, unmapped: number, total: number, rate: number }}
     */
    getLastApplyResult() {
        return { ...this._lastApplyResult };
    }
    
    // ===============================================
    // 상태 확인
    // ===============================================
    
    /**
     * 설비 매핑 여부 확인
     * @param {string} frontendId - Frontend ID
     * @returns {boolean} 매핑 여부
     */
    isEquipmentMapped(frontendId) {
        if (!this.equipmentEditState) return true;  // 없으면 기본 true
        return this.equipmentEditState.isComplete?.(frontendId) || false;
    }
    
    /**
     * SignalTowerManager 가용성 확인
     * @returns {boolean}
     */
    isSignalTowerAvailable() {
        return this.signalTowerManager !== null;
    }
    
    /**
     * 모든 의존성 준비 여부 확인
     * @returns {boolean}
     */
    isReady() {
        return !!(this.signalTowerManager && this.equipmentLoader && this.equipmentEditState);
    }
    
    // ===============================================
    // 통합 상태 조회
    // ===============================================
    
    /**
     * 전체 상태 조회
     * @returns {Object}
     */
    getStatus() {
        return {
            isReady: this.isReady(),
            hasSignalTowerManager: !!this.signalTowerManager,
            hasEquipmentLoader: !!this.equipmentLoader,
            hasEquipmentEditState: !!this.equipmentEditState,
            disabledOptions: { ...this.disabledOptions },
            lastApplyResult: this.getLastApplyResult(),
            statistics: this.getStatusStatistics()
        };
    }
    
    // ===============================================
    // 리소스 정리
    // ===============================================
    
    /**
     * 리소스 정리
     * 참조만 정리 (실제 객체는 외부 소유)
     */
    dispose() {
        this.signalTowerManager = null;
        this.equipmentLoader = null;
        this.equipmentEditState = null;
        this._lastApplyResult = { mapped: 0, unmapped: 0, total: 0, rate: 0 };
        this._log('🗑️ SignalTowerIntegration disposed');
    }
}

/**
 * 싱글톤 인스턴스 (테스트용)
 * MonitoringService에서 직접 생성하므로 이 인스턴스는 테스트용
 */
export const signalTowerIntegration = new SignalTowerIntegration(null, null, null, { debug: true });

export default SignalTowerIntegration;