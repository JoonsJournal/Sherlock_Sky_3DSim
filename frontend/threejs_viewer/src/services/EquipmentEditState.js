/**
 * EquipmentEditState.js (Enhanced Version)
 * 설비 편집 상태 관리 - 개선 버전
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
 */

import { debugLog } from '../utils/Config.js';

export class EquipmentEditState {
    constructor() {
        // 편집 모드 여부
        this.editModeEnabled = false;
        
        // 매핑 데이터: { 'EQ-01-01': { frontend_id, equipment_id, equipment_name, mapped_at }, ... }
        this.mappings = {};
        
        // 변경 여부 (dirty flag)
        this.isDirty = false;
        
        // localStorage 키
        this.storageKey = 'sherlock_equipment_mappings';
        
        // 버전 정보
        this.version = '1.1.0';
        
        // 초기 로드
        this.load();
        
        // 다른 탭의 localStorage 변경 감지
        this.handleStorageChange = this.handleStorageChange.bind(this);
        window.addEventListener('storage', this.handleStorageChange);
        
        debugLog(`✨ EquipmentEditState initialized (v${this.version})`);
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
     * @param {string} frontendId - Frontend 설비 ID ('EQ-01-01')
     * @param {Object} dbEquipment - DB 설비 정보 { equipment_id, equipment_name }
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
        
        // 매핑 저장
        this.mappings[frontendId] = {
            frontend_id: frontendId,
            equipment_id: dbEquipment.equipment_id,
            equipment_name: dbEquipment.equipment_name,
            mapped_at: new Date().toISOString() // 매핑 시간 기록
        };
        
        this.isDirty = true;
        this.save();
        
        debugLog(`🔗 Mapping set: ${frontendId} → ${dbEquipment.equipment_name}`);
        
        this.dispatchEvent('mapping-changed', {
            frontendId,
            equipmentId: dbEquipment.equipment_id,
            equipmentName: dbEquipment.equipment_name
        });
        
        return true;
    }
    
    /**
     * 매핑 삭제
     * @param {string} frontendId - Frontend 설비 ID
     * @returns {boolean} 성공 여부
     */
    removeMapping(frontendId) {
        if (frontendId in this.mappings) {
            const removed = this.mappings[frontendId];
            delete this.mappings[frontendId];
            this.isDirty = true;
            this.save();
            
            debugLog(`🗑️ Mapping removed: ${frontendId}`);
            this.dispatchEvent('mapping-removed', {
                frontendId,
                equipmentId: removed.equipment_id,
                equipmentName: removed.equipment_name
            });
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
        for (const [frontendId, mapping] of Object.entries(this.mappings)) {
            if (mapping.equipment_id === equipmentId) {
                return frontendId;
            }
        }
        return null;
    }
    
    /**
     * Equipment ID로 Frontend ID 찾기
     * @param {number} equipmentId - DB Equipment ID
     * @returns {string|null}
     */
    findFrontendIdByEquipmentId(equipmentId) {
        for (const [frontendId, mapping] of Object.entries(this.mappings)) {
            if (mapping.equipment_id === equipmentId) {
                return frontendId;
            }
        }
        return null;
    }
    
    // ==========================================
    // 배치 작업
    // ==========================================
    
    /**
     * 여러 매핑 한번에 설정
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
        
        return {
            total: mappings.length,
            hasTimestamp: mappings.filter(m => m.mapped_at).length,
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
                    debugLog(`📂 Mappings loaded: ${Object.keys(this.mappings).length}개`);
                    return true;
                } else {
                    console.warn('Invalid mapping data format, resetting');
                    this.mappings = {};
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to load mappings:', error);
            this.mappings = {};
            
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
     * @param {boolean} skipConfirm - 확인 대화상자 건너뛰기
     * @returns {boolean} 성공 여부
     */
    reset(skipConfirm = false) {
        if (!skipConfirm && !confirm('모든 매핑 데이터를 삭제하시겠습니까?')) {
            return false;
        }
        
        this.mappings = {};
        this.isDirty = false;
        this.save();
        debugLog('🗑️ All mappings cleared');
        this.dispatchEvent('mappings-reset');
        
        return true;
    }
    
    // ==========================================
    // 다중 탭 동기화
    // ==========================================
    
    /**
     * 다른 탭에서 localStorage 변경 시 동기화
     * @param {StorageEvent} event - Storage 이벤트
     */
    handleStorageChange(event) {
        if (event.key === this.storageKey && event.newValue) {
            try {
                const newMappings = JSON.parse(event.newValue);
                this.mappings = newMappings;
                debugLog('🔄 Mappings synced from another tab');
                this.dispatchEvent('mappings-synced', {
                    source: 'storage-event',
                    count: Object.keys(newMappings).length
                });
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
        
        this.save();
        debugLog(`📥 Mappings loaded from server (${mergeStrategy}): ${Object.keys(this.mappings).length}개`);
        this.dispatchEvent('mappings-loaded', { 
            strategy: mergeStrategy,
            count: Object.keys(this.mappings).length 
        });
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
     * @returns {Array} [ { frontend_id, equipment_id, equipment_name }, ... ]
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
        console.log('Is Dirty:', this.isDirty);
        console.log('Completion Rate:', this.getCompletionRate() + '%');
        console.log('Statistics:', this.getStatistics());
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
     * @param {string} jsonStr - JSON 문자열
     * @returns {boolean} 성공 여부
     */
    importFromJson(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.mappings && this.validateMappingData(data.mappings)) {
                this.mappings = data.mappings;
                this.save();
                debugLog(`📥 Mappings imported from JSON: ${Object.keys(this.mappings).length}개`);
                this.dispatchEvent('mappings-imported', {
                    count: Object.keys(this.mappings).length,
                    sourceVersion: data.version
                });
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
        window.removeEventListener('storage', this.handleStorageChange);
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