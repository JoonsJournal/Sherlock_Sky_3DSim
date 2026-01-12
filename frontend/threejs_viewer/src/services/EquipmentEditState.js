/**
 * EquipmentEditState.js (Enhanced Version + AutoSave Integration)
 * 설비 편집 상태 관리 - AutoSave 연동 버전
 * 
 * Features:
 * - 편집 모드 ON/OFF 상태 관리
 * - 매핑 데이터 저장 및 관리
 * - 변경사항 추적 (dirty flag)
 * - localStorage 영구 저장
 * - 다중 탭 동기화
 * - 배치 작업 지원
 * - 서버 동기화 및 충돌 해결
 * - 강화된 에러 처리
 * - 디버깅 유틸리티
 * @version 1.4.1
 * 
 * 🆕 v1.4.1: StatusBar 연동을 위한 EventBus 이벤트 발행 (2026-01-12)
 * - setEventBus() 메서드 추가
 * - 매핑 변경 시 equipment:mapping-changed 이벤트 발행
 * - StatusBar Monitoring Stats Panel 실시간 업데이트 지원
 * 
 * 🆕 v1.4.0: API에서 매핑 데이터 로드
 * Site 연결 후 서버에서 매핑 데이터를 가져와 상태에 적용
 * @param {Object} apiClient - ApiClient 인스턴스
 * @param {Object} options - 옵션
 * @param {string} options.mergeStrategy - 'replace' | 'merge' | 'keep-local' (기본: 'replace')
 * @param {boolean} options.silent - 로그 출력 여부 (기본: false)
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 * 
 * @example
 * // Site 연결 성공 후 호출
 * const result = await equipmentEditState.loadMappingsFromApi(apiClient);
 * if (result.success) {
 *     console.log(`${result.count}개 매핑 로드 완료`); 
 * } 
 * - 🆕 StorageService AutoSave 연동
 * - 🆕 v1.3.0: equipment_id 역방향 인덱스, line_name 저장
 * 
 */

import { debugLog } from '../core/utils/Config.js';

export class EquipmentEditState {
    constructor(options = {}) {
        // 편집 모드 여부
        this.editModeEnabled = false;
        
        // 매핑 데이터: { 'EQ-01-01': { frontend_id, equipment_id, equipment_name, line_name, mapped_at }, ... }
        this.mappings = {};
        
        // 🆕 v1.3.0: equipment_id → frontend_id 역방향 인덱스
        // { 75: 'EQ-01-01', 76: 'EQ-02-01', ... }
        this.equipmentIdIndex = {};
        
        // 변경 여부 (dirty flag)
        this.isDirty = false;
        
        // localStorage 키
        this.storageKey = 'sherlock_equipment_mappings';
        
        // 버전 정보
        this.version = '1.4.1';
        
        // 🆕 v1.4.1: EventBus 참조
        this.eventBus = options.eventBus || null;
        
        // 🆕 v1.4.1: 총 장비 수 (StatusBar 연동용)
        this.totalEquipment = options.totalEquipment || 117;
        
        // 🆕 AutoSave 관련
        this._autoSaveInstance = null;
        this._siteId = options.siteId || 'default_site';
        this._autoSaveEnabled = options.autoSaveEnabled ?? true;
        this._autoSaveIntervalMs = options.autoSaveIntervalMs || 30000;  // 30초
        this._autoSaveChangeThreshold = options.autoSaveChangeThreshold || 5;  // 5회 변경
        
        // 🆕 변경 카운트 (AutoSave 트리거용)
        this._changeCount = 0;
        
        // 초기 로드
        this.load();
        
        // 다른 탭의 localStorage 변경 감지
        this.handleStorageChange = this.handleStorageChange.bind(this);
        window.addEventListener('storage', this.handleStorageChange);
        
        debugLog(`✨ EquipmentEditState initialized (v${this.version}) - AutoSave: ${this._autoSaveEnabled ? 'ON' : 'OFF'}`);
    }
    
    // ==========================================
    // 🆕 v1.4.1: EventBus 설정
    // ==========================================
    
    /**
     * 🆕 v1.4.1: EventBus 설정
     * @param {Object} eventBus - EventBus 인스턴스
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
        debugLog('[EquipmentEditState] EventBus 연결됨');
    }
    
    /**
     * 🆕 v1.4.1: 총 장비 수 설정
     * @param {number} total - 총 장비 수
     */
    setTotalEquipment(total) {
        this.totalEquipment = total;
    }
    
    /**
     * 🆕 v1.4.1: 매핑 변경 이벤트 발행 (StatusBar 연동)
     * @private
     */
    _emitMappingChanged() {
        // CustomEvent 발행 (기존 호환성)
        this.dispatchEvent('mapping-stats-changed', {
            mapped: this.getMappingCount(),
            total: this.totalEquipment
        });
        
        // EventBus 이벤트 발행 (StatusBar 연동)
        if (this.eventBus) {
            this.eventBus.emit('equipment:mapping-changed', {
                mapped: this.getMappingCount(),
                total: this.totalEquipment,
                unmapped: this.totalEquipment - this.getMappingCount(),
                rate: this.getCompletionRate(this.totalEquipment),
                timestamp: new Date().toISOString()
            });
            debugLog(`[EquipmentEditState] 📡 equipment:mapping-changed 발행 - mapped: ${this.getMappingCount()}/${this.totalEquipment}`);
        }
    }
    
    // ==========================================
    // 🆕 v1.3.0: Equipment ID 역방향 인덱스 관리
    // ==========================================
    
    /**
     * 🆕 역방향 인덱스 재구축
     * mappings 데이터로부터 equipmentIdIndex 생성
     */
    rebuildEquipmentIdIndex() {
        this.equipmentIdIndex = {};
        
        for (const [frontendId, mapping] of Object.entries(this.mappings)) {
            if (mapping.equipment_id) {
                this.equipmentIdIndex[mapping.equipment_id] = frontendId;
            }
        }
        
        debugLog(`🔄 Equipment ID Index rebuilt: ${Object.keys(this.equipmentIdIndex).length} entries`);
    }
    
    /**
     * 🆕 Equipment ID로 Frontend ID 조회 (인덱스 사용 - O(1))
     * @param {number} equipmentId - DB Equipment ID
     * @returns {string|null} Frontend ID (예: 'EQ-01-01')
     */
    getFrontendIdByEquipmentId(equipmentId) {
        return this.equipmentIdIndex[equipmentId] || null;
    }
    
    /**
     * 🆕 Equipment ID 인덱스 전체 반환
     * @returns {Object} { equipmentId: frontendId, ... }
     */
    getEquipmentIdIndex() {
        return { ...this.equipmentIdIndex };
    }
    
    /**
     * 🆕 매핑된 모든 Equipment ID 목록 반환
     * @returns {number[]} Equipment ID 배열
     */
    getAllEquipmentIds() {
        return Object.keys(this.equipmentIdIndex).map(id => parseInt(id, 10));
    }
    
    // ==========================================
    // 🆕 AutoSave 관련 메서드
    // ==========================================
    
    /**
     * 🆕 AutoSave 초기화 (StorageService 사용)
     * @param {Object} storageService - StorageService 인스턴스
     * @param {string} siteId - 사이트 ID
     */
    initAutoSave(storageService, siteId = null) {
        if (!storageService) {
            console.warn('[EquipmentEditState] StorageService가 없습니다. AutoSave 비활성화.');
            return;
        }
        
        if (!this._autoSaveEnabled) {
            console.log('[EquipmentEditState] AutoSave가 비활성화되어 있습니다.');
            return;
        }
        
        if (siteId) {
            this._siteId = siteId;
        }
        
        // AutoSave 등록
        this._autoSaveInstance = storageService.autoSave.register('equipment', this._siteId, {
            getData: () => this.getAutoSaveData(),
            intervalMs: this._autoSaveIntervalMs,
            changeThreshold: this._autoSaveChangeThreshold,
            onSave: (data) => {
                console.log('[EquipmentEditState] AutoSave 완료:', data._autoSave);
                this.dispatchEvent('autosave-complete', { data });
            },
            onError: (error) => {
                console.error('[EquipmentEditState] AutoSave 실패:', error);
                this.dispatchEvent('autosave-error', { error: error.message });
            }
        });
        
        // AutoSave 시작
        this._autoSaveInstance.start();
        
        console.log(`[EquipmentEditState] AutoSave 초기화 완료 - siteId: ${this._siteId}, interval: ${this._autoSaveIntervalMs}ms`);
    }
    
    /**
     * 🆕 AutoSave 중지
     */
    stopAutoSave() {
        if (this._autoSaveInstance) {
            this._autoSaveInstance.stop();
            console.log('[EquipmentEditState] AutoSave 중지됨');
        }
    }
    
    /**
     * 🆕 AutoSave 데이터 반환 (getData 콜백용)
     * @returns {Object}
     */
    getAutoSaveData() {
        return {
            mappings: { ...this.mappings },
            editModeEnabled: this.editModeEnabled,
            mappingCount: this.getMappingCount(),
            statistics: this.getStatistics(),
            savedAt: new Date().toISOString()
        };
    }
    
    /**
     * 🆕 AutoSave 복구 데이터 확인
     * @param {Object} storageService - StorageService 인스턴스
     * @returns {Object|null}
     */
    checkAutoSaveRecovery(storageService) {
        if (!storageService) return null;
        
        const recoveryData = storageService.autoSave.checkRecovery('equipment', this._siteId);
        
        if (recoveryData) {
            console.log('[EquipmentEditState] AutoSave 복구 데이터 발견:', {
                savedAt: recoveryData._autoSave?.savedAt,
                mappingCount: recoveryData.mappingCount
            });
        }
        
        return recoveryData;
    }
    
    /**
     * 🆕 AutoSave 복구 적용
     * @param {Object} recoveryData - 복구 데이터
     * @returns {boolean}
     */
    applyAutoSaveRecovery(recoveryData) {
        if (!recoveryData || !recoveryData.mappings) {
            console.error('[EquipmentEditState] 유효하지 않은 복구 데이터');
            return false;
        }
        
        try {
            // 매핑 데이터 복구
            this.mappings = { ...recoveryData.mappings };
            
            // 🆕 역방향 인덱스 재구축
            this.rebuildEquipmentIdIndex();
            
            // localStorage에도 저장
            this.save();
            
            console.log(`[EquipmentEditState] AutoSave 복구 적용 완료: ${this.getMappingCount()}개 매핑`);
            
            this.dispatchEvent('mappings-recovered', {
                count: this.getMappingCount(),
                source: 'autosave'
            });
            
            // 🆕 v1.4.1: 매핑 변경 이벤트 발행
            this._emitMappingChanged();
            
            return true;
        } catch (error) {
            console.error('[EquipmentEditState] AutoSave 복구 실패:', error);
            return false;
        }
    }
    
    /**
     * 🆕 AutoSave 복구 데이터 삭제
     * @param {Object} storageService - StorageService 인스턴스
     */
    clearAutoSaveRecovery(storageService) {
        if (storageService) {
            storageService.autoSave.clearRecovery('equipment', this._siteId);
            console.log('[EquipmentEditState] AutoSave 복구 데이터 삭제됨');
        }
    }
    
    /**
     * 🆕 변경 알림 (AutoSave에 dirty 알림)
     * @private
     */
    _notifyChange() {
        this.isDirty = true;
        this._changeCount++;
        
        // AutoSave에 변경 알림
        if (this._autoSaveInstance) {
            this._autoSaveInstance.markDirty();
        }
        
        debugLog(`[EquipmentEditState] 변경 감지 - count: ${this._changeCount}`);
    }
    
    /**
     * 🆕 AutoSave 상태 조회
     * @returns {Object|null}
     */
    getAutoSaveStatus() {
        if (this._autoSaveInstance) {
            return this._autoSaveInstance.getStatus();
        }
        return null;
    }
    
    /**
     * 🆕 즉시 AutoSave 트리거
     * @returns {Promise<boolean>}
     */
    async triggerAutoSave() {
        if (this._autoSaveInstance) {
            return this._autoSaveInstance.saveNow('manual');
        }
        return false;
    }
    
    // ==========================================
    // 편집 모드 관리
    // ==========================================
    
    /**
     * 편집 모드 활성화
     */
    enableEditMode() {
        this.editModeEnabled = true;
        debugLog('✏️ Equipment Edit Mode: ON');
        this.dispatchEvent('edit-mode-changed', { enabled: true });
    }
    
    /**
     * 편집 모드 비활성화
     */
    disableEditMode() {
        this.editModeEnabled = false;
        debugLog('✏️ Equipment Edit Mode: OFF');
        this.dispatchEvent('edit-mode-changed', { enabled: false });
    }
    
    /**
     * 편집 모드 토글
     * @returns {boolean} 현재 상태
     */
    toggleEditMode() {
        if (this.editModeEnabled) {
            this.disableEditMode();
        } else {
            this.enableEditMode();
        }
        return this.editModeEnabled;
    }
    
    // ==========================================
    // 매핑 데이터 관리
    // ==========================================
    
    /**
     * 매핑 설정 (검증 강화)
     * 🆕 v1.3.0: line_name 필드 추가
     * 🆕 v1.4.1: EventBus 이벤트 발행 추가
     * 
     * @param {string} frontendId - Frontend 설비 ID ('EQ-01-01')
     * @param {Object} dbEquipment - DB 설비 정보 { equipment_id, equipment_name, line_name }
     * @returns {boolean} 성공 여부
     */
    setMapping(frontendId, dbEquipment) {
        // 입력 검증
        if (!frontendId || typeof frontendId !== 'string') {
            console.error('Invalid frontendId:', frontendId);
            return false;
        }
        
        if (!dbEquipment || !dbEquipment.equipment_id || !dbEquipment.equipment_name) {
            console.error('Invalid dbEquipment:', dbEquipment);
            return false;
        }
        
        // 중복 검사
        const duplicate = this.findDuplicate(dbEquipment.equipment_id);
        if (duplicate && duplicate !== frontendId) {
            console.warn(`Equipment ${dbEquipment.equipment_id} already mapped to ${duplicate}`);
            this.dispatchEvent('mapping-duplicate', {
                frontendId,
                existingFrontendId: duplicate,
                equipmentId: dbEquipment.equipment_id
            });
            return false;
        }
        
        // 🆕 기존 매핑이 있다면 역방향 인덱스에서 제거
        const existingMapping = this.mappings[frontendId];
        if (existingMapping && existingMapping.equipment_id) {
            delete this.equipmentIdIndex[existingMapping.equipment_id];
        }
        
        // 매핑 저장 (🆕 line_name 추가)
        this.mappings[frontendId] = {
            frontend_id: frontendId,
            equipment_id: dbEquipment.equipment_id,
            equipment_name: dbEquipment.equipment_name,
            line_name: dbEquipment.line_name || null,  // 🆕 line_name 저장
            mapped_at: new Date().toISOString()
        };
        
        // 🆕 역방향 인덱스 업데이트
        this.equipmentIdIndex[dbEquipment.equipment_id] = frontendId;
        
        // 🆕 변경 알림 (AutoSave)
        this._notifyChange();
        this.save();
        
        debugLog(`🔗 Mapping set: ${frontendId} → ${dbEquipment.equipment_name} (ID: ${dbEquipment.equipment_id}, Line: ${dbEquipment.line_name || 'N/A'})`);
        
        this.dispatchEvent('mapping-changed', {
            frontendId,
            equipmentId: dbEquipment.equipment_id,
            equipmentName: dbEquipment.equipment_name,
            lineName: dbEquipment.line_name
        });
        
        // 🆕 v1.4.1: StatusBar 연동 이벤트 발행
        this._emitMappingChanged();
        
        return true;
    }
    
    /**
     * 매핑 삭제
     * 🆕 v1.4.1: EventBus 이벤트 발행 추가
     * @param {string} frontendId - Frontend 설비 ID
     * @returns {boolean} 성공 여부
     */
    removeMapping(frontendId) {
        if (frontendId in this.mappings) {
            const removed = this.mappings[frontendId];
            
            // 🆕 역방향 인덱스에서 제거
            if (removed.equipment_id) {
                delete this.equipmentIdIndex[removed.equipment_id];
            }
            
            delete this.mappings[frontendId];
            
            // 🆕 변경 알림 (AutoSave)
            this._notifyChange();
            this.save();
            
            debugLog(`🗑️ Mapping removed: ${frontendId}`);
            this.dispatchEvent('mapping-removed', {
                frontendId,
                equipmentId: removed.equipment_id,
                equipmentName: removed.equipment_name
            });
            
            // 🆕 v1.4.1: StatusBar 연동 이벤트 발행
            this._emitMappingChanged();
            
            return true;
        }
        return false;
    }
    
    /**
     * 매핑 조회
     * @param {string} frontendId - Frontend 설비 ID
     * @returns {Object|null}
     */
    getMapping(frontendId) {
        return this.mappings[frontendId] || null;
    }
    
    /**
     * 모든 매핑 조회
     * @returns {Object}
     */
    getAllMappings() {
        return { ...this.mappings };
    }
    
    /**
     * 매핑 완료 여부
     * @param {string} frontendId - Frontend 설비 ID
     * @returns {boolean}
     */
    isComplete(frontendId) {
        return frontendId in this.mappings;
    }
    
    /**
     * 매핑 개수
     * @returns {number}
     */
    getMappingCount() {
        return Object.keys(this.mappings).length;
    }
    
    /**
     * 중복 검사
     * @param {number} equipmentId - DB Equipment ID
     * @returns {string|null} 이미 매핑된 Frontend ID (없으면 null)
     */
    findDuplicate(equipmentId) {
        // 🆕 역방향 인덱스 사용 (O(1))
        return this.equipmentIdIndex[equipmentId] || null;
    }
    
    /**
     * Equipment ID로 Frontend ID 찾기
     * @param {number} equipmentId - DB Equipment ID
     * @returns {string|null}
     * @deprecated Use getFrontendIdByEquipmentId() instead
     */
    findFrontendIdByEquipmentId(equipmentId) {
        // 🆕 역방향 인덱스 사용 (O(1))
        return this.equipmentIdIndex[equipmentId] || null;
    }
    
    // ==========================================
    // 배치 작업
    // ==========================================
    
    /**
     * 여러 매핑 한번에 설정
     * 🆕 v1.4.1: 배치 완료 후 이벤트 발행
     * @param {Array} mappingArray - [{frontendId, dbEquipment}, ...]
     * @returns {Object} {success: number, failed: number, errors: []}
     */
    setBatchMappings(mappingArray) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };
        
        mappingArray.forEach(({frontendId, dbEquipment}) => {
            try {
                if (this.setMapping(frontendId, dbEquipment)) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push({frontendId, reason: 'Validation failed'});
                }
            } catch (error) {
                results.failed++;
                results.errors.push({frontendId, error: error.message});
            }
        });
        
        debugLog(`📦 Batch mapping: ${results.success} success, ${results.failed} failed`);
        this.dispatchEvent('batch-mapping-complete', results);
        
        // 🆕 v1.4.1: 배치 완료 후 한 번만 이벤트 발행 (setMapping에서 발행하므로 중복 방지)
        // 이미 setMapping에서 개별 발행되므로 여기서는 생략
        
        return results;
    }
    
    /**
     * 여러 매핑 한번에 삭제
     * @param {Array} frontendIds - Frontend ID 배열
     * @returns {number} 삭제된 개수
     */
    removeBatchMappings(frontendIds) {
        let removed = 0;
        frontendIds.forEach(id => {
            if (this.removeMapping(id)) removed++;
        });
        
        debugLog(`📦 Batch remove: ${removed} mappings deleted`);
        return removed;
    }
    
    // ==========================================
    // 통계 및 유틸리티
    // ==========================================
    
    /**
     * 완료율 계산
     * @param {number} totalEquipment - 전체 설비 수 (기본 117개)
     * @returns {number} 완료율 (0-100)
     */
    getCompletionRate(totalEquipment = 117) {
        const mapped = this.getMappingCount();
        return Math.round((mapped / totalEquipment) * 100);
    }
    
    /**
     * 미완료 설비 ID 목록
     * @param {Array} allFrontendIds - 전체 Frontend ID 배열
     * @returns {Array} 매핑되지 않은 ID 배열
     */
    getUnmappedIds(allFrontendIds) {
        return allFrontendIds.filter(id => !this.isComplete(id));
    }
    
    /**
     * 매핑 통계
     * @returns {Object}
     */
    getStatistics() {
        const mappings = Object.values(this.mappings);
        
        // 🆕 Line별 통계
        const lineStats = {};
        mappings.forEach(m => {
            const lineName = m.line_name || 'Unknown';
            lineStats[lineName] = (lineStats[lineName] || 0) + 1;
        });
        
        return {
            total: mappings.length,
            hasTimestamp: mappings.filter(m => m.mapped_at).length,
            hasLineName: mappings.filter(m => m.line_name).length,  // 🆕
            lineStats: lineStats,  // 🆕
            oldestMapping: mappings.reduce((oldest, m) => {
                if (!oldest || (m.mapped_at && m.mapped_at < oldest)) {
                    return m.mapped_at;
                }
                return oldest;
            }, null),
            newestMapping: mappings.reduce((newest, m) => {
                if (!newest || (m.mapped_at && m.mapped_at > newest)) {
                    return m.mapped_at;
                }
                return newest;
            }, null)
        };
    }
    
    // ==========================================
    // localStorage 관리
    // ==========================================
    
    /**
     * localStorage에 저장 (에러 핸들링 강화)
     * @returns {boolean} 성공 여부
     */
    save() {
        try {
            const dataStr = JSON.stringify(this.mappings);
            
            // 용량 체크 (localStorage는 보통 5MB 제한)
            if (dataStr.length > 4 * 1024 * 1024) { // 4MB
                console.warn('Mapping data approaching localStorage limit');
                this.dispatchEvent('storage-warning', {
                    size: dataStr.length,
                    limit: 5 * 1024 * 1024
                });
            }
            
            localStorage.setItem(this.storageKey, dataStr);
            this.isDirty = false;
            debugLog('💾 Mappings saved to localStorage');
            
            this.dispatchEvent('mappings-saved', {
                count: Object.keys(this.mappings).length,
                size: dataStr.length
            });
            
            return true;
        } catch (error) {
            console.error('Failed to save mappings:', error);
            
            // QuotaExceededError 처리
            if (error.name === 'QuotaExceededError') {
                this.dispatchEvent('storage-quota-exceeded', {
                    error: error.message
                });
            } else {
                this.dispatchEvent('save-error', {
                    error: error.message
                });
            }
            
            return false;
        }
    }
    
    /**
     * localStorage에서 로드 (에러 핸들링 강화)
     * 🆕 v1.4.1: 로드 후 이벤트 발행
     * @returns {boolean} 성공 여부
     */
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                
                // 데이터 무결성 검증
                if (this.validateMappingData(parsed)) {
                    this.mappings = parsed;
                    
                    // 🆕 역방향 인덱스 재구축
                    this.rebuildEquipmentIdIndex();
                    
                    debugLog(`📂 Mappings loaded: ${Object.keys(this.mappings).length}개`);
                    
                    // 🆕 v1.4.1: 로드 후 이벤트 발행 (초기화 시)
                    setTimeout(() => this._emitMappingChanged(), 100);
                    
                    return true;
                } else {
                    console.warn('Invalid mapping data format, resetting');
                    this.mappings = {};
                    this.equipmentIdIndex = {};
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to load mappings:', error);
            this.mappings = {};
            this.equipmentIdIndex = {};
            
            this.dispatchEvent('load-error', {
                error: error.message
            });
            
            return false;
        }
    }
    
    /**
     * 매핑 데이터 검증
     * @param {Object} data - 검증할 데이터
     * @returns {boolean}
     */
    validateMappingData(data) {
        if (!data || typeof data !== 'object') return false;
        
        for (const [key, value] of Object.entries(data)) {
            if (!value.frontend_id || !value.equipment_id || !value.equipment_name) {
                console.warn(`Invalid mapping entry: ${key}`, value);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 초기화 (모든 매핑 삭제)
     * 🆕 v1.4.1: 초기화 후 이벤트 발행
     * @param {boolean} skipConfirm - 확인 대화상자 건너뛰기
     * @returns {boolean} 성공 여부
     */
    reset(skipConfirm = false) {
        if (!skipConfirm && !confirm('모든 매핑 데이터를 삭제하시겠습니까?')) {
            return false;
        }
        
        this.mappings = {};
        this.equipmentIdIndex = {};  // 🆕 인덱스도 초기화
        this.isDirty = false;
        this._changeCount = 0;
        this.save();
        debugLog('🗑️ All mappings cleared');
        this.dispatchEvent('mappings-reset');
        
        // 🆕 v1.4.1: 초기화 후 이벤트 발행
        this._emitMappingChanged();
        
        return true;
    }
    
    // ==========================================
    // 다중 탭 동기화
    // ==========================================
    
    /**
     * 다른 탭에서 localStorage 변경 시 동기화
     * 🆕 v1.4.1: 동기화 후 이벤트 발행
     * @param {StorageEvent} event - Storage 이벤트
     */
    handleStorageChange(event) {
        if (event.key === this.storageKey && event.newValue) {
            try {
                const newMappings = JSON.parse(event.newValue);
                this.mappings = newMappings;
                
                // 🆕 역방향 인덱스 재구축
                this.rebuildEquipmentIdIndex();
                
                debugLog('🔄 Mappings synced from another tab');
                this.dispatchEvent('mappings-synced', {
                    source: 'storage-event',
                    count: Object.keys(newMappings).length
                });
                
                // 🆕 v1.4.1: 동기화 후 이벤트 발행
                this._emitMappingChanged();
                
            } catch (error) {
                console.error('Failed to sync mappings:', error);
            }
        }
    }
    
    // ==========================================
    // 서버 동기화
    // ==========================================
    
    /**
     * 서버에서 매핑 데이터 로드 (병합 옵션)
     * 🆕 v1.4.1: 로드 후 이벤트 발행
     * @param {Object} serverMappings - 서버에서 받은 매핑 데이터
     * @param {string} mergeStrategy - 'replace' | 'merge' | 'keep-local'
     */
    loadFromServer(serverMappings, mergeStrategy = 'replace') {
        switch (mergeStrategy) {
            case 'replace':
                // 서버 데이터로 완전 대체
                this.mappings = { ...serverMappings };
                break;
                
            case 'merge':
                // 서버 데이터 우선, 로컬 데이터 보존
                this.mappings = { ...this.mappings, ...serverMappings };
                break;
                
            case 'keep-local':
                // 로컬 데이터 우선
                this.mappings = { ...serverMappings, ...this.mappings };
                break;
                
            default:
                console.error('Invalid merge strategy:', mergeStrategy);
                return;
        }
        
        // 🆕 역방향 인덱스 재구축
        this.rebuildEquipmentIdIndex();
        
        // 🆕 변경 알림
        this._notifyChange();
        this.save();
        
        debugLog(`📥 Mappings loaded from server (${mergeStrategy}): ${Object.keys(this.mappings).length}개`);
        this.dispatchEvent('mappings-loaded', { 
            strategy: mergeStrategy,
            count: Object.keys(this.mappings).length 
        });
        
        // 🆕 v1.4.1: 서버 로드 후 이벤트 발행
        this._emitMappingChanged();
    }
    
    async loadMappingsFromApi(apiClient, options = {}) {
        const { mergeStrategy = 'replace', silent = false } = options;
        
        if (!apiClient) {
            const error = 'ApiClient not provided';
            if (!silent) console.error(`❌ [EquipmentEditState] ${error}`);
            return { success: false, count: 0, error };
        }
        
        try {
            if (!silent) debugLog('📡 Loading mappings from API...');
            
            // API 호출: GET /equipment/mapping
            const serverMappings = await apiClient.getEquipmentMappings();
            
            // 응답 검증
            if (!serverMappings || typeof serverMappings !== 'object') {
                if (!silent) debugLog('⚠️ Empty or invalid mappings response from server');
                return { success: true, count: 0 };
            }
            
            const count = Object.keys(serverMappings).length;
            
            if (count === 0) {
                if (!silent) debugLog('ℹ️ No mappings found on server');
                return { success: true, count: 0 };
            }
            
            // 기존 loadFromServer 메서드 활용
            this.loadFromServer(serverMappings, mergeStrategy);
            
            if (!silent) {
                debugLog(`✅ Mappings loaded from API: ${count}개 (${mergeStrategy})`);
            }
            
            // 이벤트 발생
            this.dispatchEvent('mappings-loaded-from-api', {
                count,
                mergeStrategy,
                source: 'api'
            });
            
            return { success: true, count };
            
        } catch (error) {
            const errorMsg = error.message || 'Unknown error';
            if (!silent) {
                console.error(`❌ [EquipmentEditState] Failed to load mappings from API:`, error);
            }
            
            // 에러 이벤트 발생
            this.dispatchEvent('mappings-load-error', {
                error: errorMsg,
                source: 'api'
            });
            
            return { success: false, count: 0, error: errorMsg };
        }
    }
    
    /**
     * 🆕 v1.4.0: 매핑 데이터가 비어있는지 확인
     * @returns {boolean} 매핑이 없으면 true
     */
    isMappingsEmpty() {
        return Object.keys(this.mappings).length === 0;
    }
    
    /**
     * 🆕 v1.4.0: 매핑 로드 상태 확인
     * @returns {{ isEmpty: boolean, count: number, hasLocalData: boolean }}
     */
    getMappingsStatus() {
        const count = Object.keys(this.mappings).length;
        return {
            isEmpty: count === 0,
            count,
            hasLocalData: this._hasLocalStorageData()
        };
    }
    
    /**
     * @private
     * localStorage에 데이터가 있는지 확인
     */
    _hasLocalStorageData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return false;
            const data = JSON.parse(stored);
            return data && data.mappings && Object.keys(data.mappings).length > 0;
        } catch {
            return false;
        }
    }
    
    
    
    /**
     * 서버와 동기화 필요 여부 확인
     * @param {Object} serverMappings - 서버 매핑 데이터
     * @returns {Object} {needsSync, conflicts, localOnly, serverOnly}
     */
    compareWithServer(serverMappings) {
        const localIds = new Set(Object.keys(this.mappings));
        const serverIds = new Set(Object.keys(serverMappings));
        
        const conflicts = [];
        const localOnly = [];
        const serverOnly = [];
        
        // 로컬에만 있는 항목
        localIds.forEach(id => {
            if (!serverIds.has(id)) {
                localOnly.push(id);
            } else if (this.mappings[id].equipment_id !== serverMappings[id].equipment_id) {
                conflicts.push({
                    frontendId: id,
                    local: this.mappings[id],
                    server: serverMappings[id]
                });
            }
        });
        
        // 서버에만 있는 항목
        serverIds.forEach(id => {
            if (!localIds.has(id)) {
                serverOnly.push(id);
            }
        });
        
        return {
            needsSync: conflicts.length > 0 || localOnly.length > 0 || serverOnly.length > 0,
            conflicts,
            localOnly,
            serverOnly
        };
    }
    
    /**
     * 서버로 매핑 데이터 전송 형식으로 변환
     * @returns {Array} [ { frontend_id, equipment_id, equipment_name, line_name }, ... ]
     */
    toServerFormat() {
        return Object.values(this.mappings);
    }
    
    // ==========================================
    // 디버깅 및 유틸리티
    // ==========================================
    
    /**
     * 현재 상태 출력 (디버깅용)
     */
    debugPrintState() {
        console.group('🔧 EquipmentEditState Debug Info');
        console.log('Version:', this.version);
        console.log('Edit Mode:', this.editModeEnabled);
        console.log('Mapping Count:', this.getMappingCount());
        console.log('Equipment ID Index Size:', Object.keys(this.equipmentIdIndex).length);
        console.log('Is Dirty:', this.isDirty);
        console.log('Change Count:', this._changeCount);
        console.log('Completion Rate:', this.getCompletionRate() + '%');
        console.log('AutoSave Status:', this.getAutoSaveStatus());
        console.log('EventBus Connected:', !!this.eventBus);
        console.log('Statistics:', this.getStatistics());
        console.log('Equipment ID Index (first 10):', 
            Object.fromEntries(Object.entries(this.equipmentIdIndex).slice(0, 10))
        );
        console.table(Object.values(this.mappings).slice(0, 20)); // 처음 20개만 표시
        console.groupEnd();
    }
    
    /**
     * JSON 내보내기
     * @returns {string} JSON 문자열
     */
    exportToJson() {
        return JSON.stringify({
            version: this.version,
            exported_at: new Date().toISOString(),
            edit_mode: this.editModeEnabled,
            mapping_count: this.getMappingCount(),
            mappings: this.mappings
        }, null, 2);
    }
    
    /**
     * JSON 가져오기
     * 🆕 v1.4.1: 가져오기 후 이벤트 발행
     * @param {string} jsonStr - JSON 문자열
     * @returns {boolean} 성공 여부
     */
    importFromJson(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.mappings && this.validateMappingData(data.mappings)) {
                this.mappings = data.mappings;
                
                // 🆕 역방향 인덱스 재구축
                this.rebuildEquipmentIdIndex();
                
                // 🆕 변경 알림
                this._notifyChange();
                this.save();
                
                debugLog(`📥 Mappings imported from JSON: ${Object.keys(this.mappings).length}개`);
                this.dispatchEvent('mappings-imported', {
                    count: Object.keys(this.mappings).length,
                    sourceVersion: data.version
                });
                
                // 🆕 v1.4.1: 가져오기 후 이벤트 발행
                this._emitMappingChanged();
                
                return true;
            } else {
                console.error('Invalid JSON data format');
                return false;
            }
        } catch (error) {
            console.error('Failed to import JSON:', error);
            return false;
        }
    }
    
    /**
     * 파일로 내보내기
     */
    exportToFile() {
        const json = this.exportToJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `equipment-mappings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        debugLog('📁 Mappings exported to file');
    }
    
    /**
     * 파일에서 가져오기
     * @param {File} file - JSON 파일
     * @returns {Promise<boolean>}
     */
    async importFromFile(file) {
        try {
            const text = await file.text();
            return this.importFromJson(text);
        } catch (error) {
            console.error('Failed to import from file:', error);
            return false;
        }
    }
    
    // ==========================================
    // 이벤트 관리
    // ==========================================
    
    /**
     * 이벤트 디스패치
     * @param {string} eventName - 이벤트 이름
     * @param {Object} detail - 이벤트 데이터
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
    }
    
    // ==========================================
    // 리소스 정리
    // ==========================================
    
    /**
     * 리소스 정리 (인스턴스 파괴)
     */
    destroy() {
        // AutoSave 중지
        this.stopAutoSave();
        
        window.removeEventListener('storage', this.handleStorageChange);
        
        // EventBus 참조 해제
        this.eventBus = null;
        
        debugLog('🧹 EquipmentEditState destroyed');
    }
}

// ==========================================
// 전역 인스턴스 (선택적)
// ==========================================

// 전역 인스턴스가 필요한 경우 사용
// window.equipmentEditState = new EquipmentEditState();

// 디버깅 콘솔 명령어 등록 (개발 환경에서만)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.debugEquipmentState = () => {
        if (window.equipmentEditState) {
            window.equipmentEditState.debugPrintState();
        } else {
            console.warn('equipmentEditState instance not found');
        }
    };
    
    console.log('💡 Debug command available: debugEquipmentState()');
}