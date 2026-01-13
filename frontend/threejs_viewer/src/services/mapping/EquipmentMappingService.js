/**
 * EquipmentMappingService.js
 * ==========================
 * 설비 매핑 통합 서비스 - API와 State 사이의 중재자
 * 
 * @version 2.0.0
 * @since 2026-01-13
 * 
 * @description 
 *   - 서버 ↔ 로컬 매핑 데이터 동기화
 *   - 유효성 검증 관리
 *   - 매핑 테스트 기능
 *   - 🆕 v2.0.0: MappingConfigService 기능 통합
 *     - Site 기반 매핑 로드 (loadMappingsForSite)
 *     - 현재 연결 매핑 로드 (loadCurrentMappings)
 *     - 내부 상태 관리 (Map 기반)
 *     - EventBus 이벤트 발행
 *     - Site 정보 관리
 * 
 * @changelog
 * - v2.0.0 (2026-01-13): MappingConfigService 기능 통합
 *   - loadCurrentMappings() 추가 → /api/mapping/current
 *   - loadMappingsForSite(siteId) 추가 → /api/mapping/config/{siteId}
 *   - 내부 mappings Map 관리 추가
 *   - EventBus 연동 추가
 *   - Site 정보 관리 추가
 *   - 기존 loadMappings() API 변경 (getMappingConfig 사용)
 * - v1.0.0: 초기 버전
 */

import { debugLog } from '../../core/utils/Config.js';

export class EquipmentMappingService {
    /**
     * @param {Object} options
     * @param {Object} options.apiClient - ApiClient 인스턴스
     * @param {Object} [options.editState] - EquipmentEditState 인스턴스
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     * @param {string} [options.apiBaseUrl] - API 기본 URL (폴백용)
     * @param {string} [options.siteId] - 초기 사이트 ID
     */
    constructor(options = {}) {
        // ===== 의존성 =====
        this.apiClient = options.apiClient;
        this.editState = options.editState;
        this.eventBus = options.eventBus || null;
        this.apiBaseUrl = options.apiBaseUrl || this._detectApiBaseUrl();
        
        // ===== 🆕 v2.0.0: 내부 매핑 상태 관리 =====
        /** @type {Map<string, Object>} frontend_id → 상세 정보 */
        this.mappings = new Map();
        
        /** @type {Map<number, string>} equipment_id → frontend_id */
        this.reverseMap = new Map();
        
        // ===== 🆕 v2.0.0: Site 정보 =====
        this.siteId = options.siteId || null;
        this.siteInfo = null;
        this.cachedConfig = null;
        
        // ===== 캐시 관련 =====
        this.equipmentNamesCache = null;
        this.cacheTimestamp = null;
        this.cacheDuration = 5 * 60 * 1000; // 5분
        
        // ===== 🆕 v2.0.0: 매핑 캐시 =====
        this.mappingCacheTimestamp = null;
        this.mappingCacheDuration = 10 * 60 * 1000; // 10분
        
        // ===== 상태 =====
        this.isLoading = false;
        this.isInitialized = false;
        this.lastSyncTime = null;
        this.lastError = null;
        
        // ===== 버전 =====
        this.version = '2.0.0';
        
        debugLog(`🔧 EquipmentMappingService initialized (v${this.version})`);
    }
    
    // ==========================================
    // 🆕 v2.0.0: EventBus 설정
    // ==========================================
    
    /**
     * EventBus 설정
     * @param {Object} eventBus - EventBus 인스턴스
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
        debugLog('[EquipmentMappingService] EventBus 연결됨');
    }
    
    /**
     * EditState 설정
     * @param {Object} editState - EquipmentEditState 인스턴스
     */
    setEditState(editState) {
        this.editState = editState;
        debugLog('[EquipmentMappingService] EditState 연결됨');
    }
    
    /**
     * 이벤트 발행 (EventBus가 있을 때만)
     * @private
     * @param {string} eventName - 이벤트 이름
     * @param {Object} data - 이벤트 데이터
     */
    _emit(eventName, data = {}) {
        if (this.eventBus) {
            this.eventBus.emit(eventName, {
                ...data,
                timestamp: new Date().toISOString(),
                source: 'EquipmentMappingService'
            });
            debugLog(`📡 [EquipmentMappingService] Event emitted: ${eventName}`);
        }
    }
    
    // ==========================================
    // 🆕 v2.0.0: API Base URL 감지
    // ==========================================
    
    /**
     * API Base URL 자동 감지 (폴백용)
     * @private
     * @returns {string}
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
    // 설비 목록 관리 (기존 유지)
    // ==========================================
    
    /**
     * DB 설비 이름 목록 로드 (캐싱 적용)
     * @param {boolean} forceRefresh - 강제 새로고침
     * @returns {Promise<Array>} 설비 목록
     */
    async loadEquipmentNames(forceRefresh = false) {
        // 캐시 유효성 확인
        if (!forceRefresh && this._isEquipmentNamesCacheValid()) {
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
     * 설비 이름 캐시 유효성 확인
     * @private
     * @returns {boolean}
     */
    _isEquipmentNamesCacheValid() {
        if (!this.equipmentNamesCache || !this.cacheTimestamp) {
            return false;
        }
        return (Date.now() - this.cacheTimestamp) < this.cacheDuration;
    }
    
    // ==========================================
    // 🆕 v2.0.0: 매핑 로드 (신규 API 사용)
    // ==========================================
    
    /**
     * 🆕 v2.0.0: 현재 연결된 사이트의 매핑 로드
     * GET /api/mapping/current
     * 
     * @param {Object} [options] - 옵션
     * @param {boolean} [options.forceRefresh=false] - 강제 새로고침
     * @param {boolean} [options.applyToEditState=true] - EditState에 자동 적용
     * @returns {Promise<Object>} { connected, siteId, mappings, count }
     * 
     * @example
     * const result = await mappingService.loadCurrentMappings();
     * if (result.connected) {
     *     console.log(`${result.count}개 매핑 로드됨`);
     * }
     */
    async loadCurrentMappings(options = {}) {
        const { forceRefresh = false, applyToEditState = true } = options;
        
        // 캐시 확인
        if (!forceRefresh && this._isMappingCacheValid() && this.isInitialized) {
            debugLog('📋 Using cached mapping data');
            return {
                connected: true,
                siteId: this.siteId,
                mappings: this.getAllMappingsAsObject(),
                count: this.getMappingCount(),
                fromCache: true
            };
        }
        
        try {
            this.isLoading = true;
            debugLog('📡 Loading current mappings from server...');
            
            // 🆕 v2.0.0: 신규 API 사용
            const config = await this.apiClient.getMappingConfig();
            
            if (!config.connected) {
                debugLog('⚠️ No active connection');
                return {
                    connected: false,
                    siteId: null,
                    mappings: {},
                    count: 0,
                    message: config.message || 'No active connection'
                };
            }
            
            // 사이트 정보 저장
            this.siteId = config.site_id;
            this.cachedConfig = config;
            this.mappingCacheTimestamp = Date.now();
            
            // 매핑 적용
            this._applyMappings(config.mappings || {});
            
            this.isInitialized = true;
            this.lastSyncTime = new Date();
            
            // EditState에 적용
            if (applyToEditState && this.editState) {
                this.applyToEditState(this.editState);
            }
            
            // 🆕 이벤트 발행
            this._emit('equipment:mapping-loaded', {
                siteId: this.siteId,
                count: this.getMappingCount(),
                source: 'current'
            });
            
            debugLog(`✅ Loaded ${this.getMappingCount()} mappings from current connection (${this.siteId})`);
            
            return {
                connected: true,
                siteId: this.siteId,
                mappings: this.getAllMappingsAsObject(),
                count: this.getMappingCount(),
                siteInfo: this.getSiteInfo()
            };
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Failed to load current mappings:', error);
            
            this._emit('equipment:mapping-error', {
                error: error.message,
                action: 'loadCurrentMappings'
            });
            
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 🆕 v2.0.0: 특정 사이트의 매핑 로드
     * GET /api/mapping/config/{siteId}
     * 
     * @param {string} siteId - 사이트 ID (예: 'korea_site1_line1')
     * @param {Object} [options] - 옵션
     * @param {boolean} [options.forceRefresh=false] - 강제 새로고침
     * @param {boolean} [options.applyToEditState=true] - EditState에 자동 적용
     * @returns {Promise<Object>} { connected, siteId, mappings, count }
     * 
     * @example
     * const result = await mappingService.loadMappingsForSite('korea_site1_line1');
     */
    async loadMappingsForSite(siteId, options = {}) {
        const { forceRefresh = false, applyToEditState = true } = options;
        
        if (!siteId || typeof siteId !== 'string') {
            throw new Error('Invalid siteId');
        }
        
        // 같은 사이트이고 캐시가 유효하면 반환
        if (!forceRefresh && this.siteId === siteId && this._isMappingCacheValid()) {
            debugLog(`📋 Using cached mapping for ${siteId}`);
            return {
                connected: true,
                siteId: this.siteId,
                mappings: this.getAllMappingsAsObject(),
                count: this.getMappingCount(),
                fromCache: true
            };
        }
        
        try {
            this.isLoading = true;
            debugLog(`📡 Loading mappings for site: ${siteId}...`);
            
            // 🆕 v2.0.0: 신규 API 사용
            const config = await this.apiClient.getMappingConfigBySite(siteId);
            
            if (!config || config.message) {
                debugLog(`⚠️ Failed to load mapping for ${siteId}: ${config?.message}`);
                return {
                    connected: false,
                    siteId: siteId,
                    mappings: {},
                    count: 0,
                    message: config?.message || 'Load failed'
                };
            }
            
            // 사이트 정보 저장
            this.siteId = siteId;
            this.cachedConfig = config;
            this.mappingCacheTimestamp = Date.now();
            
            // 매핑 적용
            this._applyMappings(config.mappings || {});
            
            this.isInitialized = true;
            this.lastSyncTime = new Date();
            
            // EditState에 적용
            if (applyToEditState && this.editState) {
                this.applyToEditState(this.editState);
            }
            
            // 🆕 이벤트 발행
            this._emit('equipment:mapping-loaded', {
                siteId: this.siteId,
                count: this.getMappingCount(),
                source: 'site'
            });
            
            debugLog(`✅ Loaded ${this.getMappingCount()} mappings for site: ${siteId}`);
            
            return {
                connected: true,
                siteId: this.siteId,
                mappings: this.getAllMappingsAsObject(),
                count: this.getMappingCount(),
                siteInfo: this.getSiteInfo()
            };
            
        } catch (error) {
            this.lastError = error;
            console.error(`❌ Failed to load mappings for ${siteId}:`, error);
            
            this._emit('equipment:mapping-error', {
                error: error.message,
                action: 'loadMappingsForSite',
                siteId
            });
            
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 서버에서 매핑 데이터 로드 (기존 메서드 - 호환성 유지)
     * 
     * @deprecated v2.0.0부터 loadCurrentMappings() 또는 loadMappingsForSite() 사용 권장
     * @param {string} [mergeStrategy='replace'] - 'replace' | 'merge' | 'keep-local'
     * @returns {Promise<Object>} 로드된 매핑 데이터
     */
    async loadMappings(mergeStrategy = 'replace') {
        debugLog('⚠️ loadMappings() is deprecated. Use loadCurrentMappings() instead.');
        
        try {
            this.isLoading = true;
            debugLog('📡 Loading mappings from server...');
            
            // 🆕 v2.0.0: 신규 API 사용 (기존 deprecated API 대체)
            const config = await this.apiClient.getMappingConfig();
            
            if (!config.connected) {
                debugLog('⚠️ Not connected or no mappings');
                return {};
            }
            
            // 매핑 데이터 변환 (기존 형식으로)
            const serverMappings = {};
            if (config.mappings) {
                for (const [frontendId, item] of Object.entries(config.mappings)) {
                    serverMappings[frontendId] = {
                        frontend_id: frontendId,
                        equipment_id: item.equipment_id,
                        equipment_name: item.equipment_name,
                        equipment_code: item.equipment_code || null,
                        line_name: item.line_name || null,
                        mapped_at: item.updated_at || new Date().toISOString()
                    };
                }
            }
            
            // 내부 상태 업데이트
            this._applyMappings(config.mappings || {});
            this.siteId = config.site_id;
            
            // EditState에 적용 (기존 로직 유지)
            if (this.editState) {
                this.editState.loadFromServer(serverMappings, mergeStrategy);
            }
            
            this.lastSyncTime = new Date();
            debugLog(`✅ Loaded ${Object.keys(serverMappings).length} mappings (strategy: ${mergeStrategy})`);
            
            // 🆕 이벤트 발행
            this._emit('equipment:mapping-loaded', {
                siteId: this.siteId,
                count: Object.keys(serverMappings).length,
                strategy: mergeStrategy
            });
            
            return serverMappings;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Failed to load mappings:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    // ==========================================
    // 🆕 v2.0.0: 내부 매핑 상태 관리
    // ==========================================
    
    /**
     * 매핑 데이터 적용 (내부 상태 업데이트)
     * @private
     * @param {Object} mappingsData - { frontendId: { equipment_id, equipment_name, ... }, ... }
     */
    _applyMappings(mappingsData) {
        this.mappings.clear();
        this.reverseMap.clear();
        
        for (const [frontendId, item] of Object.entries(mappingsData)) {
            const equipmentId = item.equipment_id;
            
            this.mappings.set(frontendId, {
                equipmentId: equipmentId,
                equipmentName: item.equipment_name,
                equipmentCode: item.equipment_code || null,
                lineName: item.line_name || null,
                updatedAt: item.updated_at || null
            });
            
            this.reverseMap.set(equipmentId, frontendId);
        }
        
        debugLog(`📋 Applied ${this.mappings.size} mappings to internal state`);
    }
    
    /**
     * 매핑 캐시 유효성 확인
     * @private
     * @returns {boolean}
     */
    _isMappingCacheValid() {
        if (!this.mappingCacheTimestamp) {
            return false;
        }
        return (Date.now() - this.mappingCacheTimestamp) < this.mappingCacheDuration;
    }
    
    // ==========================================
    // 🆕 v2.0.0: 매핑 조회 메서드
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
     * 모든 매핑 반환 (Map)
     * @returns {Map}
     */
    getAllMappings() {
        return new Map(this.mappings);
    }
    
    /**
     * 모든 매핑 반환 (Object 형식)
     * @returns {Object}
     */
    getAllMappingsAsObject() {
        const obj = {};
        for (const [frontendId, data] of this.mappings) {
            obj[frontendId] = {
                frontend_id: frontendId,
                equipment_id: data.equipmentId,
                equipment_name: data.equipmentName,
                equipment_code: data.equipmentCode,
                line_name: data.lineName
            };
        }
        return obj;
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
    // 🆕 v2.0.0: EditState 연동
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
        
        if (this.mappings.size === 0) {
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
    // 🆕 v2.0.0: 사이트 관리
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
        
        // 캐시 정리
        this.clearMappingCache();
        
        try {
            const result = await this.loadMappingsForSite(newSiteId);
            
            // 🆕 이벤트 발행
            this._emit('equipment:site-changed', {
                previousSiteId: this.siteId,
                newSiteId: newSiteId,
                success: result.connected
            });
            
            return result.connected;
            
        } catch (error) {
            console.error(`❌ Failed to change site to ${newSiteId}:`, error);
            return false;
        }
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
    // 매핑 저장 (기존 유지)
    // ==========================================
    
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
            
            // 내부 상태 동기화
            this._syncFromEditState();
            
            this.lastSyncTime = new Date();
            debugLog(`✅ Saved ${mappingsArray.length} mappings successfully`);
            
            // 🆕 이벤트 발행
            this._emit('equipment:mapping-saved', {
                siteId: this.siteId,
                count: mappingsArray.length
            });
            
            return result;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ Failed to save mappings:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * EditState에서 내부 상태 동기화
     * @private
     */
    _syncFromEditState() {
        if (!this.editState) return;
        
        const allMappings = this.editState.getAllMappings();
        
        this.mappings.clear();
        this.reverseMap.clear();
        
        for (const [frontendId, mapping] of Object.entries(allMappings)) {
            this.mappings.set(frontendId, {
                equipmentId: mapping.equipment_id,
                equipmentName: mapping.equipment_name,
                equipmentCode: mapping.equipment_code || null,
                lineName: mapping.line_name || null,
                updatedAt: mapping.mapped_at || null
            });
            
            this.reverseMap.set(mapping.equipment_id, frontendId);
        }
        
        debugLog(`📋 Synced ${this.mappings.size} mappings from EditState`);
    }
    
    // ==========================================
    // 유효성 검증 (기존 유지)
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
    // 매핑 테스트 (기존 유지)
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
    // 동기화 (기존 + 수정)
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
            
            // 🆕 v2.0.0: 신규 API 사용
            const config = await this.apiClient.getMappingConfig();
            
            if (!config.connected) {
                return {
                    success: false,
                    action: 'none',
                    message: 'No active connection'
                };
            }
            
            // 서버 매핑 변환
            const serverMappings = {};
            if (config.mappings) {
                for (const [frontendId, item] of Object.entries(config.mappings)) {
                    serverMappings[frontendId] = {
                        frontend_id: frontendId,
                        equipment_id: item.equipment_id,
                        equipment_name: item.equipment_name
                    };
                }
            }
            
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
        // 🆕 v2.0.0: 신규 API 사용
        const config = await this.apiClient.getMappingConfig();
        
        if (!config.connected || !config.mappings) {
            return {
                needsSync: false,
                conflicts: [],
                localOnly: [],
                serverOnly: []
            };
        }
        
        // 서버 매핑 변환
        const serverMappings = {};
        for (const [frontendId, item] of Object.entries(config.mappings)) {
            serverMappings[frontendId] = {
                frontend_id: frontendId,
                equipment_id: item.equipment_id,
                equipment_name: item.equipment_name
            };
        }
        
        return this.editState.compareWithServer(serverMappings);
    }
    
    // ==========================================
    // 캐시 관리
    // ==========================================
    
    /**
     * 설비 이름 캐시 초기화
     */
    clearEquipmentNamesCache() {
        this.equipmentNamesCache = null;
        this.cacheTimestamp = null;
        debugLog('🗑️ Equipment names cache cleared');
    }
    
    /**
     * 매핑 캐시 초기화
     */
    clearMappingCache() {
        this.mappings.clear();
        this.reverseMap.clear();
        this.cachedConfig = null;
        this.mappingCacheTimestamp = null;
        this.siteId = null;
        this.isInitialized = false;
        debugLog('🗑️ Mapping cache cleared');
    }
    
    /**
     * 모든 캐시 초기화
     */
    clearCache() {
        this.clearEquipmentNamesCache();
        this.clearMappingCache();
        debugLog('🗑️ All caches cleared');
    }
    
    // ==========================================
    // 상태 조회 (기존 + 확장)
    // ==========================================
    
    /**
     * 완료 상태 반환
     * @param {number} totalEquipments - 전체 설비 수 (기본 117)
     * @returns {Object} 완료 상태
     */
    getCompletionStatus(totalEquipments = 117) {
        // EditState가 있으면 EditState 기준
        if (this.editState) {
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
        
        // 내부 상태 기준
        const mapped = this.mappings.size;
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
            // 기본 상태
            version: this.version,
            isLoading: this.isLoading,
            isInitialized: this.isInitialized,
            lastSyncTime: this.lastSyncTime,
            lastError: this.lastError?.message || null,
            
            // 🆕 v2.0.0: 매핑 상태
            siteId: this.siteId,
            mappingCount: this.mappings.size,
            mappingCacheValid: this._isMappingCacheValid(),
            
            // 설비 이름 캐시 상태
            equipmentNamesCacheValid: this._isEquipmentNamesCacheValid(),
            equipmentNamesCount: this.equipmentNamesCache?.length || 0,
            
            // EditState 상태
            hasEditState: !!this.editState,
            editStateMappingCount: this.editState?.getMappingCount() || 0,
            isDirty: this.editState?.isDirty || false,
            
            // EventBus 상태
            hasEventBus: !!this.eventBus
        };
    }
    
    // ==========================================
    // 디버깅 (기존 + 확장)
    // ==========================================
    
    /**
     * 디버그 정보 출력
     */
    debugPrint() {
        console.group(`🔧 EquipmentMappingService Debug (v${this.version})`);
        
        console.log('=== 상태 ===');
        console.log('Status:', this.getStatus());
        
        console.log('=== 사이트 정보 ===');
        console.log('Site Info:', this.getSiteInfo());
        
        console.log('=== 완료 상태 ===');
        console.log('Completion:', this.getCompletionStatus());
        
        console.log('=== 설비 이름 캐시 ===');
        console.log('Equipment Names Cache:', {
            valid: this._isEquipmentNamesCacheValid(),
            count: this.equipmentNamesCache?.length || 0,
            age: this.cacheTimestamp ? `${Math.round((Date.now() - this.cacheTimestamp) / 1000)}s` : 'N/A'
        });
        
        console.log('=== 매핑 캐시 ===');
        console.log('Mapping Cache:', {
            valid: this._isMappingCacheValid(),
            count: this.mappings.size,
            age: this.mappingCacheTimestamp ? `${Math.round((Date.now() - this.mappingCacheTimestamp) / 1000)}s` : 'N/A'
        });
        
        console.log('=== 내부 매핑 (처음 10개) ===');
        const sampleMappings = Array.from(this.mappings.entries()).slice(0, 10);
        console.table(sampleMappings.map(([frontendId, data]) => ({
            frontendId,
            equipmentId: data.equipmentId,
            equipmentName: data.equipmentName,
            lineName: data.lineName
        })));
        
        console.groupEnd();
    }
}

export default EquipmentMappingService;