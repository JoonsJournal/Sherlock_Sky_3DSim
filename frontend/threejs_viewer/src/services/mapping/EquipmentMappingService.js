/**
 * EquipmentMappingService.js
 * 설비 매핑 서비스 - API와 State 사이의 중재자
 * 
 * @version 1.0.0
 * @description 
 *   - 서버 ↔ 로컬 매핑 데이터 동기화
 *   - 유효성 검증 관리
 *   - 매핑 테스트 기능
 */

import { debugLog } from '../../core/utils/Config.js';

export class EquipmentMappingService {
    /**
     * @param {Object} options
     * @param {Object} options.apiClient - ApiClient 인스턴스
     * @param {Object} options.editState - EquipmentEditState 인스턴스
     */
    constructor(options = {}) {
        this.apiClient = options.apiClient;
        this.editState = options.editState;
        
        // 캐시된 설비 목록
        this.equipmentNamesCache = null;
        this.cacheTimestamp = null;
        this.cacheDuration = 5 * 60 * 1000; // 5분
        
        // 상태
        this.isLoading = false;
        this.lastSyncTime = null;
        this.lastError = null;
        
        debugLog('🔧 EquipmentMappingService initialized');
    }
    
    // ==========================================
    // 설비 목록 관리
    // ==========================================
    
    /**
     * DB 설비 이름 목록 로드 (캐싱 적용)
     * @param {boolean} forceRefresh - 강제 새로고침
     * @returns {Promise<Array>} 설비 목록
     */
    async loadEquipmentNames(forceRefresh = false) {
        // 캐시 유효성 확인
        if (!forceRefresh && this._isCacheValid()) {
            debugLog('📋 Using cached equipment names');
            return this.equipmentNamesCache;
        }
        
        try {
            this.isLoading = true;
            debugLog('📡 Loading equipment names from server...');
            
            const equipments = await this.apiClient.getEquipmentNames();
            
            // 캐시 업데이트
            this.equipmentNamesCache = equipments;
            this.cacheTimestamp = Date.now();
            
            debugLog(`✅ Loaded ${equipments.length} equipment names`);
            return equipments;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Failed to load equipment names:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 캐시 유효성 확인
     * @returns {boolean}
     */
    _isCacheValid() {
        if (!this.equipmentNamesCache || !this.cacheTimestamp) {
            return false;
        }
        return (Date.now() - this.cacheTimestamp) < this.cacheDuration;
    }
    
    /**
     * 캐시 초기화
     */
    clearCache() {
        this.equipmentNamesCache = null;
        this.cacheTimestamp = null;
        debugLog('🗑️ Equipment names cache cleared');
    }
    
    // ==========================================
    // 매핑 로드/저장
    // ==========================================
    
    /**
     * 서버에서 매핑 데이터 로드
     * @param {string} mergeStrategy - 'replace' | 'merge' | 'keep-local'
     * @returns {Promise<Object>} 로드된 매핑 데이터
     */
    async loadMappings(mergeStrategy = 'replace') {
        try {
            this.isLoading = true;
            debugLog('📡 Loading mappings from server...');
            
            const serverMappings = await this.apiClient.getEquipmentMappings();
            
            // EditState에 적용
            if (this.editState) {
                this.editState.loadFromServer(serverMappings, mergeStrategy);
            }
            
            this.lastSyncTime = new Date();
            debugLog(`✅ Loaded ${Object.keys(serverMappings).length} mappings (strategy: ${mergeStrategy})`);
            
            return serverMappings;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Failed to load mappings:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 매핑 데이터를 서버에 저장
     * @param {boolean} validateFirst - 저장 전 검증 여부
     * @returns {Promise<Object>} 저장 결과
     */
    async saveMappings(validateFirst = true) {
        if (!this.editState) {
            throw new Error('EditState not initialized');
        }
        
        try {
            this.isLoading = true;
            
            // 서버 전송 형식으로 변환
            const mappingsArray = this.editState.toServerFormat();
            
            if (mappingsArray.length === 0) {
                debugLog('⚠️ No mappings to save');
                return { success: true, message: 'No mappings to save', total: 0 };
            }
            
            // 저장 전 검증 (선택적)
            if (validateFirst) {
                debugLog('🔍 Validating before save...');
                const validation = await this.validateMapping();
                
                if (!validation.valid) {
                    debugLog('❌ Validation failed, aborting save');
                    return {
                        success: false,
                        message: 'Validation failed',
                        validation
                    };
                }
            }
            
            debugLog(`💾 Saving ${mappingsArray.length} mappings to server...`);
            
            // API 호출
            const result = await this.apiClient.saveEquipmentMappings({
                mappings: mappingsArray
            });
            
            // dirty 플래그 초기화
            if (this.editState) {
                this.editState.isDirty = false;
            }
            
            this.lastSyncTime = new Date();
            debugLog(`✅ Saved ${mappingsArray.length} mappings successfully`);
            
            return result;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Failed to save mappings:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    // ==========================================
    // 유효성 검증
    // ==========================================
    
    /**
     * 서버 측 매핑 유효성 검증
     * @returns {Promise<Object>} ValidationResult
     */
    async validateMapping() {
        if (!this.editState) {
            throw new Error('EditState not initialized');
        }
        
        try {
            this.isLoading = true;
            debugLog('🔍 Validating mappings on server...');
            
            const mappingsArray = this.editState.toServerFormat();
            
            if (mappingsArray.length === 0) {
                return {
                    valid: true,
                    errors: [],
                    warnings: ['No mappings to validate'],
                    duplicates: {},
                    missing: []
                };
            }
            
            const result = await this.apiClient.validateEquipmentMapping({
                mappings: mappingsArray
            });
            
            debugLog(`✅ Validation complete: valid=${result.valid}, errors=${result.errors?.length || 0}`);
            
            return result;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Validation failed:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 로컬 유효성 검증 (빠른 검증)
     * @returns {Object} 검증 결과
     */
    validateLocal() {
        if (!this.editState) {
            return { valid: false, errors: ['EditState not initialized'] };
        }
        
        const errors = [];
        const warnings = [];
        const mappings = this.editState.getAllMappings();
        
        // 중복 검사
        const equipmentIdMap = new Map();
        
        for (const [frontendId, mapping] of Object.entries(mappings)) {
            const eqId = mapping.equipment_id;
            
            if (equipmentIdMap.has(eqId)) {
                errors.push(`Equipment ID ${eqId} is mapped to both ${equipmentIdMap.get(eqId)} and ${frontendId}`);
            } else {
                equipmentIdMap.set(eqId, frontendId);
            }
            
            // 필수 필드 검사
            if (!mapping.equipment_name) {
                warnings.push(`${frontendId}: Missing equipment_name`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            mappingCount: Object.keys(mappings).length
        };
    }
    
    // ==========================================
    // 매핑 테스트
    // ==========================================
    
    /**
     * 특정 매핑의 DB 연결 테스트
     * @param {string} frontendId - Frontend 설비 ID
     * @returns {Promise<Object>} 테스트 결과
     */
    async testMapping(frontendId) {
        if (!this.editState) {
            throw new Error('EditState not initialized');
        }
        
        const mapping = this.editState.getMapping(frontendId);
        
        if (!mapping) {
            return {
                success: false,
                frontendId,
                error: 'Mapping not found'
            };
        }
        
        try {
            debugLog(`🧪 Testing mapping: ${frontendId} → ${mapping.equipment_id}`);
            
            // 설비 목록에서 해당 ID 존재 여부 확인
            const equipments = await this.loadEquipmentNames();
            const exists = equipments.some(eq => eq.equipment_id === mapping.equipment_id);
            
            if (!exists) {
                return {
                    success: false,
                    frontendId,
                    equipmentId: mapping.equipment_id,
                    error: 'Equipment ID not found in database'
                };
            }
            
            debugLog(`✅ Mapping test passed: ${frontendId}`);
            
            return {
                success: true,
                frontendId,
                equipmentId: mapping.equipment_id,
                equipmentName: mapping.equipment_name
            };
            
        } catch (error) {
            console.error(`❌ Mapping test failed for ${frontendId}:`, error);
            return {
                success: false,
                frontendId,
                error: error.message
            };
        }
    }
    
    /**
     * 모든 매핑 테스트
     * @returns {Promise<Object>} 전체 테스트 결과
     */
    async testAllMappings() {
        if (!this.editState) {
            throw new Error('EditState not initialized');
        }
        
        const mappings = this.editState.getAllMappings();
        const frontendIds = Object.keys(mappings);
        
        debugLog(`🧪 Testing ${frontendIds.length} mappings...`);
        
        const results = {
            total: frontendIds.length,
            passed: 0,
            failed: 0,
            details: []
        };
        
        // 설비 목록 한 번만 로드
        const equipments = await this.loadEquipmentNames();
        const equipmentIds = new Set(equipments.map(eq => eq.equipment_id));
        
        for (const frontendId of frontendIds) {
            const mapping = mappings[frontendId];
            const exists = equipmentIds.has(mapping.equipment_id);
            
            if (exists) {
                results.passed++;
                results.details.push({
                    frontendId,
                    success: true,
                    equipmentId: mapping.equipment_id
                });
            } else {
                results.failed++;
                results.details.push({
                    frontendId,
                    success: false,
                    equipmentId: mapping.equipment_id,
                    error: 'Equipment ID not found in database'
                });
            }
        }
        
        debugLog(`✅ Test complete: ${results.passed}/${results.total} passed`);
        
        return results;
    }
    
    // ==========================================
    // 동기화
    // ==========================================
    
    /**
     * 서버와 로컬 데이터 동기화
     * @returns {Promise<Object>} 동기화 결과
     */
    async syncWithServer() {
        if (!this.editState) {
            throw new Error('EditState not initialized');
        }
        
        try {
            this.isLoading = true;
            debugLog('🔄 Starting sync with server...');
            
            // 서버 데이터 가져오기
            const serverMappings = await this.apiClient.getEquipmentMappings();
            
            // 충돌 감지
            const comparison = this.editState.compareWithServer(serverMappings);
            
            if (!comparison.needsSync) {
                debugLog('✅ Already in sync');
                return {
                    success: true,
                    action: 'none',
                    message: 'Already in sync'
                };
            }
            
            debugLog('⚠️ Sync needed:', comparison);
            
            return {
                success: true,
                action: 'review-needed',
                comparison
            };
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Sync failed:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 충돌 감지
     * @returns {Promise<Object>} 충돌 정보
     */
    async detectConflicts() {
        const serverMappings = await this.apiClient.getEquipmentMappings();
        return this.editState.compareWithServer(serverMappings);
    }
    
    // ==========================================
    // 상태 조회
    // ==========================================
    
    /**
     * 완료 상태 반환
     * @param {number} totalEquipments - 전체 설비 수 (기본 117)
     * @returns {Object} 완료 상태
     */
    getCompletionStatus(totalEquipments = 117) {
        if (!this.editState) {
            return {
                total: totalEquipments,
                mapped: 0,
                unmapped: totalEquipments,
                percentage: 0,
                isComplete: false
            };
        }
        
        const mapped = this.editState.getMappingCount();
        const unmapped = totalEquipments - mapped;
        const percentage = Math.round((mapped / totalEquipments) * 100);
        
        return {
            total: totalEquipments,
            mapped,
            unmapped,
            percentage,
            isComplete: mapped >= totalEquipments
        };
    }
    
    /**
     * 서비스 상태 조회
     * @returns {Object}
     */
    getStatus() {
        return {
            isLoading: this.isLoading,
            lastSyncTime: this.lastSyncTime,
            lastError: this.lastError,
            cacheValid: this._isCacheValid(),
            mappingCount: this.editState?.getMappingCount() || 0,
            isDirty: this.editState?.isDirty || false
        };
    }
    
    // ==========================================
    // 디버깅
    // ==========================================
    
    /**
     * 디버그 정보 출력
     */
    debugPrint() {
        console.group('🔧 EquipmentMappingService Debug');
        console.log('Status:', this.getStatus());
        console.log('Completion:', this.getCompletionStatus());
        console.log('Cache:', {
            valid: this._isCacheValid(),
            count: this.equipmentNamesCache?.length || 0,
            age: this.cacheTimestamp ? `${Math.round((Date.now() - this.cacheTimestamp) / 1000)}s` : 'N/A'
        });
        console.groupEnd();
    }
}

export default EquipmentMappingService;