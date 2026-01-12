/**
 * MappingConfigService.js
 * 서버 중앙화된 매핑 Config 로드 서비스
 * 
 * Connection Manager와 연동하여:
 * - 연결된 사이트의 매핑 자동 로드
 * - Site ID 형식: {site_name}_{db_name} (예: korea_site1_line1)
 * - Multi-Site 전환 지원
 * 
 * @version 2.0.0
 */

import { debugLog } from '../../core/utils/Config.js';

export class MappingConfigService {
    /**
     * @param {Object} options
     * @param {Object} options.apiClient - ApiClient 인스턴스 (선택)
     * @param {string} options.siteId - 사이트 ID (예: 'korea_site1_line1')
     * @param {string} options.apiBaseUrl - API 기본 URL
     */
    constructor(options = {}) {
        this.apiClient = options.apiClient;
        this.siteId = options.siteId || null;  // 연결 시 설정됨
        this.apiBaseUrl = options.apiBaseUrl || this._detectApiBaseUrl();
        
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
        
        debugLog('🔧 MappingConfigService initialized');
    }
    
    /**
     * API Base URL 자동 감지
     */
    _detectApiBaseUrl() {
        const hostname = window.location.hostname;
        const port = 8000;
        
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
     * @returns {Promise<boolean>} 성공 여부
     */
    async initializeFromCurrentConnection() {
        debugLog('📡 Loading mapping from current connection...');
        
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
     * @param {string} siteId - 예: 'korea_site1_line1'
     * @param {boolean} forceRefresh - 강제 새로고침
     * @returns {Promise<boolean>}
     */
    async loadSiteMapping(siteId, forceRefresh = false) {
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
     * @param {string} frontendId - 'EQ-01-01'
     * @returns {number|null}
     */
    getEquipmentId(frontendId) {
        const mapping = this.mappings.get(frontendId);
        return mapping ? mapping.equipmentId : null;
    }
    
    /**
     * Equipment ID로 Frontend ID 조회
     * @param {number} equipmentId
     * @returns {string|null}
     */
    getFrontendId(equipmentId) {
        return this.reverseMap.get(equipmentId) || null;
    }
    
    /**
     * Frontend ID로 상세 매핑 정보 조회
     * @param {string} frontendId
     * @returns {Object|null}
     */
    getMappingDetails(frontendId) {
        return this.mappings.get(frontendId) || null;
    }
    
    /**
     * 모든 매핑 반환
     * @returns {Map}
     */
    getAllMappings() {
        return new Map(this.mappings);
    }
    
    /**
     * 매핑 개수
     * @returns {number}
     */
    getMappingCount() {
        return this.mappings.size;
    }
    
    /**
     * 매핑 여부 확인
     * @param {string} frontendId
     * @returns {boolean}
     */
    isMapped(frontendId) {
        return this.mappings.has(frontendId);
    }
    
    // ==========================================
    // EquipmentEditState 연동
    // ==========================================
    
    /**
     * EquipmentEditState에 매핑 적용
     * 
     * @param {Object} editState - EquipmentEditState 인스턴스
     * @returns {boolean}
     */
    applyToEditState(editState) {
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
     * @param {Array} mappingsArray - [{frontend_id, equipment_id, equipment_name, ...}, ...]
     * @param {string} createdBy - 작성자
     * @returns {Promise<Object>}
     */
    async saveMappings(mappingsArray, createdBy = 'admin') {
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
        const mapped = this.mappings.size;
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
            mappingCount: this.mappings.size,
            cacheValid: this._isCacheValid(),
            lastError: this.lastError?.message || null
        };
    }
    
    // ==========================================
    // 정리
    // ==========================================
    
    /**
     * 캐시 초기화
     */
    clearCache() {
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
        console.group('🔧 MappingConfigService Debug');
        console.log('Site:', this.getSiteInfo());
        console.log('Status:', this.getStatus());
        console.log('Completion:', this.getCompletionStatus());
        console.log('Sample:', Array.from(this.mappings.entries()).slice(0, 3));
        console.groupEnd();
    }
}

export default MappingConfigService;