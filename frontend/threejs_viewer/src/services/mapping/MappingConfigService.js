/**
 * MappingConfigService.js
 * 서버 중앙화된 매핑 Config 로드 서비스
 * 
 * @deprecated v2.1.0부터 deprecated.
 * EquipmentMappingService를 대신 사용하세요.
 * 이 클래스는 하위 호환성을 위해 유지되며, 내부적으로 EquipmentMappingService로 위임합니다.
 * 
 * @see EquipmentMappingService
 * 
 * Migration Guide:
 * ```javascript
 * // Old way (deprecated):
 * import { MappingConfigService } from './mapping/MappingConfigService.js';
 * const configService = new MappingConfigService({ apiClient, siteId });
 * await configService.loadSiteMapping('korea_site1_line1');
 * 
 * // New way (recommended):
 * import { EquipmentMappingService } from './mapping/EquipmentMappingService.js';
 * const mappingService = new EquipmentMappingService({ apiClient, editState });
 * await mappingService.loadMappingsForSite('korea_site1_line1');
 * ```
 * 
 * Connection Manager와 연동하여:
 * - 연결된 사이트의 매핑 자동 로드
 * - Site ID 형식: {site_name}_{db_name} (예: korea_site1_line1)
 * - Multi-Site 전환 지원
 * 
 * @version 2.1.0
 * 
 * Changelog:
 * - v2.1.0 (2026-01-13): DEPRECATED - EquipmentMappingService 위임 래퍼 추가
 * - v2.0.0: 초기 버전
 */

import { debugLog } from '../../core/utils/Config.js';

/**
 * @deprecated v2.1.0부터 deprecated. EquipmentMappingService를 사용하세요.
 */
export class MappingConfigService {
    /**
     * @deprecated Use EquipmentMappingService instead.
     * 
     * @param {Object} options
     * @param {Object} options.apiClient - ApiClient 인스턴스 (선택)
     * @param {string} options.siteId - 사이트 ID (예: 'korea_site1_line1')
     * @param {string} options.apiBaseUrl - API 기본 URL
     * @param {Object} options.equipmentMappingService - 🆕 EquipmentMappingService 인스턴스 (위임용)
     * @param {Object} options.editState - 🆕 EquipmentEditState 인스턴스 (위임용)
     */
    constructor(options = {}) {
        // 🆕 v2.1.0: Deprecation 경고 (한 번만 표시)
        if (!MappingConfigService._deprecationWarningShown) {
            console.warn(
                '⚠️ [DEPRECATED] MappingConfigService is deprecated.\n' +
                '   Use EquipmentMappingService instead.\n' +
                '   This class will be removed in a future version.\n' +
                '\n' +
                '   Migration example:\n' +
                '   // Old way (deprecated):\n' +
                '   // const configService = new MappingConfigService({ apiClient, siteId });\n' +
                '\n' +
                '   // New way (recommended):\n' +
                '   // import { EquipmentMappingService } from \'./mapping/EquipmentMappingService.js\';\n' +
                '   // const mappingService = new EquipmentMappingService({ apiClient, editState });'
            );
            MappingConfigService._deprecationWarningShown = true;
        }
        
        this.apiClient = options.apiClient;
        this.siteId = options.siteId || null;  // 연결 시 설정됨
        this.apiBaseUrl = options.apiBaseUrl || this._detectApiBaseUrl();
        
        // 🆕 v2.1.0: EquipmentMappingService 위임 지원
        this._delegateService = options.equipmentMappingService || null;
        this._editState = options.editState || null;
        
        // 캐시
        this.cachedConfig = null;
        this.cacheTimestamp = null;
        this.cacheDuration = 10 * 60 * 1000; // 10분
        
        // 상태
        this.isLoading = false;
        this.isInitialized = false;
        this.lastError = null;
        
        // 매핑 데이터
        this.mappings = new Map();      // frontend_id → 상세 정보
        this.reverseMap = new Map();    // equipment_id → frontend_id
        
        debugLog('🔧 MappingConfigService initialized (DEPRECATED - use EquipmentMappingService)');
    }
    
    // 🆕 v2.1.0: 정적 deprecation 경고 플래그
    static _deprecationWarningShown = false;
    
    /**
     * 🆕 v2.1.0: EquipmentMappingService 설정 (위임용)
     * @param {Object} service - EquipmentMappingService 인스턴스
     */
    setDelegateService(service) {
        this._delegateService = service;
        debugLog('[MappingConfigService] Delegate service set');
    }
    
    /**
     * 🆕 v2.1.0: EquipmentEditState 설정 (위임용)
     * @param {Object} editState - EquipmentEditState 인스턴스
     */
    setEditState(editState) {
        this._editState = editState;
        debugLog('[MappingConfigService] EditState set');
    }
    
    /**
     * 🆕 v2.1.0: 위임 서비스 사용 가능 여부
     * @returns {boolean}
     */
    _canDelegate() {
        return this._delegateService !== null;
    }
    
    /**
     * API Base URL 자동 감지
     */
    _detectApiBaseUrl() {
        const hostname = window.location.hostname;
        const port = 8008;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://localhost:${port}`;
        }
        
        return `http://${hostname}:${port}`;
    }
    
    // ==========================================
    // 초기화 및 로드
    // ==========================================
    
    /**
     * 현재 연결된 사이트의 매핑 자동 로드
     * Connection Manager 연결 후 호출
     * 
     * @deprecated Use EquipmentMappingService.loadCurrentMappings() instead.
     * @returns {Promise<boolean>} 성공 여부
     */
    async initializeFromCurrentConnection() {
        debugLog('📡 Loading mapping from current connection... (DEPRECATED)');
        
        // 🆕 v2.1.0: 위임 서비스 사용 가능하면 위임
        if (this._canDelegate()) {
            try {
                const result = await this._delegateService.loadCurrentMappings({
                    applyToEditState: !!this._editState
                });
                
                if (result.connected) {
                    this.siteId = result.siteId;
                    this.isInitialized = true;
                    this._syncFromDelegateService();
                    return true;
                }
                return false;
            } catch (error) {
                this.lastError = error;
                console.error('❌ Failed to load mapping via delegate:', error);
                return false;
            }
        }
        
        // 기존 로직 (폴백)
        try {
            this.isLoading = true;
            
            // 현재 연결된 사이트 매핑 조회
            const response = await fetch(`${this.apiBaseUrl}/api/mapping/current`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.connected) {
                debugLog('⚠️ No active connection');
                return false;
            }
            
            // 사이트 정보 저장
            this.siteId = data.site_id;
            this.cachedConfig = data;
            this.cacheTimestamp = Date.now();
            
            // 매핑 적용
            this._applyMappings(data.mappings || {});
            
            this.isInitialized = true;
            debugLog(`✅ Mapping loaded: ${this.mappings.size} equipments (${this.siteId})`);
            
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Failed to load mapping:', error);
            return false;
            
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 특정 사이트의 매핑 로드
     * 
     * @deprecated Use EquipmentMappingService.loadMappingsForSite() instead.
     * @param {string} siteId - 예: 'korea_site1_line1'
     * @param {boolean} forceRefresh - 강제 새로고침
     * @returns {Promise<boolean>}
     */
    async loadSiteMapping(siteId, forceRefresh = false) {
        // 🆕 v2.1.0: 위임 서비스 사용 가능하면 위임
        if (this._canDelegate()) {
            try {
                const result = await this._delegateService.loadMappingsForSite(siteId, {
                    forceRefresh,
                    applyToEditState: !!this._editState
                });
                
                if (result.connected) {
                    this.siteId = siteId;
                    this.isInitialized = true;
                    this._syncFromDelegateService();
                    return true;
                }
                return false;
            } catch (error) {
                this.lastError = error;
                console.error(`❌ Failed to load mapping for ${siteId} via delegate:`, error);
                return false;
            }
        }
        
        // 기존 로직 (폴백)
        if (!forceRefresh && this.siteId === siteId && this._isCacheValid()) {
            debugLog(`📋 Using cached mapping for ${siteId}`);
            return true;
        }
        
        try {
            this.isLoading = true;
            debugLog(`📡 Loading mapping for ${siteId}...`);
            
            const response = await fetch(
                `${this.apiBaseUrl}/api/mapping/config/${siteId}`
            );
            
            if (!response.ok) {
                if (response.status === 400) {
                    throw new Error('Invalid site ID format');
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const config = await response.json();
            
            this.siteId = siteId;
            this.cachedConfig = config;
            this.cacheTimestamp = Date.now();
            
            // mappings 변환 (API 응답 형식에 따라)
            const mappingsData = {};
            if (config.mappings) {
                for (const [frontendId, item] of Object.entries(config.mappings)) {
                    mappingsData[frontendId] = item;
                }
            }
            
            this._applyMappings(mappingsData);
            
            this.isInitialized = true;
            debugLog(`✅ Mapping loaded: ${this.mappings.size} equipments`);
            
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error(`❌ Failed to load mapping for ${siteId}:`, error);
            return false;
            
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 🆕 v2.1.0: 위임 서비스에서 데이터 동기화
     * @private
     */
    _syncFromDelegateService() {
        if (!this._delegateService) return;
        
        const allMappings = this._delegateService.getAllMappings();
        this.mappings.clear();
        this.reverseMap.clear();
        
        for (const [frontendId, data] of Object.entries(allMappings)) {
            this.mappings.set(frontendId, {
                equipmentId: data.equipment_id,
                equipmentName: data.equipment_name,
                equipmentCode: data.equipment_code,
                lineName: data.line_name
            });
            
            if (data.equipment_id) {
                this.reverseMap.set(data.equipment_id, frontendId);
            }
        }
        
        this.cacheTimestamp = Date.now();
        debugLog(`[MappingConfigService] Synced ${this.mappings.size} mappings from delegate`);
    }
    
    /**
     * 매핑 데이터 적용
     * @param {Object} mappingsData
     */
    _applyMappings(mappingsData) {
        this.mappings.clear();
        this.reverseMap.clear();
        
        for (const [frontendId, item] of Object.entries(mappingsData)) {
            const equipmentId = item.equipment_id;
            
            this.mappings.set(frontendId, {
                equipmentId: equipmentId,
                equipmentName: item.equipment_name,
                equipmentCode: item.equipment_code,
                lineName: item.line_name
            });
            
            this.reverseMap.set(equipmentId, frontendId);
        }
    }
    
    /**
     * 캐시 유효성 확인
     */
    _isCacheValid() {
        if (!this.cachedConfig || !this.cacheTimestamp) {
            return false;
        }
        return (Date.now() - this.cacheTimestamp) < this.cacheDuration;
    }
    
    // ==========================================
    // 매핑 조회
    // ==========================================
    
    /**
     * Frontend ID로 Equipment ID 조회
     * 
     * @deprecated Use EquipmentMappingService.getEquipmentIdByFrontendId() instead.
     * @param {string} frontendId - 'EQ-01-01'
     * @returns {number|null}
     */
    getEquipmentId(frontendId) {
        // 🆕 v2.1.0: 위임 가능하면 위임
        if (this._canDelegate()) {
            return this._delegateService.getEquipmentIdByFrontendId(frontendId);
        }
        
        const mapping = this.mappings.get(frontendId);
        return mapping ? mapping.equipmentId : null;
    }
    
    /**
     * Equipment ID로 Frontend ID 조회
     * 
     * @deprecated Use EquipmentMappingService.getFrontendIdByEquipmentId() instead.
     * @param {number} equipmentId
     * @returns {string|null}
     */
    getFrontendId(equipmentId) {
        // 🆕 v2.1.0: 위임 가능하면 위임
        if (this._canDelegate()) {
            return this._delegateService.getFrontendIdByEquipmentId(equipmentId);
        }
        
        return this.reverseMap.get(equipmentId) || null;
    }
    
    /**
     * Frontend ID로 상세 매핑 정보 조회
     * 
     * @deprecated Use EquipmentMappingService.getMappingDetails() instead.
     * @param {string} frontendId
     * @returns {Object|null}
     */
    getMappingDetails(frontendId) {
        // 🆕 v2.1.0: 위임 가능하면 위임
        if (this._canDelegate()) {
            return this._delegateService.getMappingDetails(frontendId);
        }
        
        return this.mappings.get(frontendId) || null;
    }
    
    /**
     * 모든 매핑 반환
     * 
     * @deprecated Use EquipmentMappingService.getAllMappings() instead.
     * @returns {Map}
     */
    getAllMappings() {
        // 🆕 v2.1.0: 위임 가능하면 Object → Map 변환
        if (this._canDelegate()) {
            const obj = this._delegateService.getAllMappings();
            return new Map(Object.entries(obj));
        }
        
        return new Map(this.mappings);
    }
    
    /**
     * 매핑 개수
     * 
     * @deprecated Use EquipmentMappingService.getMappingCount() instead.
     * @returns {number}
     */
    getMappingCount() {
        // 🆕 v2.1.0: 위임 가능하면 위임
        if (this._canDelegate()) {
            return this._delegateService.getMappingCount();
        }
        
        return this.mappings.size;
    }
    
    /**
     * 매핑 여부 확인
     * 
     * @deprecated Use EquipmentMappingService.hasMappingFor() instead.
     * @param {string} frontendId
     * @returns {boolean}
     */
    isMapped(frontendId) {
        // 🆕 v2.1.0: 위임 가능하면 위임
        if (this._canDelegate()) {
            return this._delegateService.hasMappingFor(frontendId);
        }
        
        return this.mappings.has(frontendId);
    }
    
    // ==========================================
    // EquipmentEditState 연동
    // ==========================================
    
    /**
     * EquipmentEditState에 매핑 적용
     * 
     * @deprecated Use EquipmentMappingService.applyMappingsToEditState() instead.
     * @param {Object} editState - EquipmentEditState 인스턴스
     * @returns {boolean}
     */
    applyToEditState(editState) {
        // 🆕 v2.1.0: 위임 가능하면 위임
        if (this._canDelegate() && editState) {
            return this._delegateService.applyMappingsToEditState(editState);
        }
        
        if (!editState) {
            console.warn('⚠️ EditState not provided');
            return false;
        }
        
        if (!this.isInitialized || this.mappings.size === 0) {
            debugLog('⚠️ No mappings to apply');
            return false;
        }
        
        try {
            const serverMappings = {};
            
            for (const [frontendId, data] of this.mappings) {
                serverMappings[frontendId] = {
                    frontend_id: frontendId,
                    equipment_id: data.equipmentId,
                    equipment_name: data.equipmentName,
                    equipment_code: data.equipmentCode,
                    line_name: data.lineName
                };
            }
            
            editState.loadFromServer(serverMappings, 'replace');
            
            debugLog(`✅ Applied ${this.mappings.size} mappings to EditState`);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to apply to EditState:', error);
            return false;
        }
    }
    
    // ==========================================
    // 사이트 관리
    // ==========================================
    
    /**
     * 사이트 변경
     * 
     * @deprecated Use EquipmentMappingService.loadMappingsForSite() instead.
     * @param {string} newSiteId - 예: 'korea_site1_line2'
     * @returns {Promise<boolean>}
     */
    async changeSite(newSiteId) {
        if (this.siteId === newSiteId && this.isInitialized) {
            debugLog(`📌 Already on site: ${newSiteId}`);
            return true;
        }
        
        debugLog(`🔄 Changing site: ${this.siteId} → ${newSiteId}`);
        
        this.clearCache();
        return await this.loadSiteMapping(newSiteId);
    }
    
    /**
     * 현재 사이트 정보
     * @returns {Object}
     */
    getSiteInfo() {
        return {
            siteId: this.siteId,
            siteName: this.cachedConfig?.site_name || '',
            dbName: this.cachedConfig?.db_name || '',
            displayName: this.cachedConfig?.display_name || this.siteId,
            mappingCount: this.mappings.size,
            isInitialized: this.isInitialized,
            lastUpdated: this.cachedConfig?.updated_at || null
        };
    }
    
    // ==========================================
    // 매핑 저장 (관리자용)
    // ==========================================
    
    /**
     * 현재 매핑을 서버에 저장
     * 
     * @deprecated Use EquipmentMappingService.saveMappings() instead.
     * @param {Array} mappingsArray - [{frontend_id, equipment_id, equipment_name, ...}, ...]
     * @param {string} createdBy - 작성자
     * @returns {Promise<Object>}
     */
    async saveMappings(mappingsArray, createdBy = 'admin') {
        // 🆕 v2.1.0: 위임 가능하면 위임
        if (this._canDelegate()) {
            return this._delegateService.saveMappings(mappingsArray, { createdBy });
        }
        
        if (!this.siteId) {
            throw new Error('No site selected');
        }
        
        debugLog(`💾 Saving ${mappingsArray.length} mappings to ${this.siteId}...`);
        
        const response = await fetch(
            `${this.apiBaseUrl}/api/mapping/config/${this.siteId}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mappings: mappingsArray,
                    created_by: createdBy
                })
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Save failed');
        }
        
        const result = await response.json();
        
        // 캐시 갱신
        await this.loadSiteMapping(this.siteId, true);
        
        debugLog(`✅ Saved ${result.total} mappings`);
        return result;
    }
    
    // ==========================================
    // 상태 조회
    // ==========================================
    
    /**
     * 완료 상태
     * @param {number} totalEquipments
     * @returns {Object}
     */
    getCompletionStatus(totalEquipments = 117) {
        const mapped = this.getMappingCount();
        return {
            total: totalEquipments,
            mapped,
            unmapped: totalEquipments - mapped,
            percentage: Math.round((mapped / totalEquipments) * 100),
            isComplete: mapped >= totalEquipments
        };
    }
    
    /**
     * 서비스 상태
     * @returns {Object}
     */
    getStatus() {
        return {
            siteId: this.siteId,
            isLoading: this.isLoading,
            isInitialized: this.isInitialized,
            mappingCount: this.getMappingCount(),
            cacheValid: this._isCacheValid(),
            lastError: this.lastError?.message || null,
            // 🆕 v2.1.0: 위임 상태
            delegateEnabled: this._canDelegate(),
            deprecated: true
        };
    }
    
    // ==========================================
    // 정리
    // ==========================================
    
    /**
     * 캐시 초기화
     * 
     * @deprecated Use EquipmentMappingService.clearMappingCache() instead.
     */
    clearCache() {
        // 🆕 v2.1.0: 위임 가능하면 위임도 수행
        if (this._canDelegate()) {
            this._delegateService.clearMappingCache();
        }
        
        this.cachedConfig = null;
        this.cacheTimestamp = null;
        this.mappings.clear();
        this.reverseMap.clear();
        this.siteId = null;
        this.isInitialized = false;
        debugLog('🗑️ Mapping cache cleared');
    }
    
    /**
     * 디버그 출력
     */
    debugPrint() {
        console.group('🔧 MappingConfigService Debug (DEPRECATED)');
        console.warn('⚠️ This class is deprecated. Use EquipmentMappingService instead.');
        console.log('Site:', this.getSiteInfo());
        console.log('Status:', this.getStatus());
        console.log('Completion:', this.getCompletionStatus());
        console.log('Sample:', Array.from(this.mappings.entries()).slice(0, 3));
        console.log('Delegate Service:', this._canDelegate() ? 'Connected' : 'Not connected');
        console.groupEnd();
    }
}

// 🆕 v2.1.0: 하위 호환성을 위한 export 유지
export default MappingConfigService;