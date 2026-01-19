/**
 * MappingDataLoader.js
 * =====================
 * 매핑 데이터 로더 (IDataLoader 구현)
 * 
 * EquipmentMappingService를 IDataLoader 인터페이스로 래핑하여
 * 다른 모드(Monitoring, Analysis, Dashboard)와 동일한 방식으로
 * 매핑 데이터를 로드/관리할 수 있도록 합니다.
 * 
 * @version 2.0.0
 * @since 2026-01-13
 * 
 * @description
 * - 🆕 v2.0.0: EquipmentMappingService 사용 (MappingConfigService 대체)
 * - IDataLoader 표준 인터페이스 구현
 * - EquipmentEditState와 자동 동기화
 * - Site 연결 시 자동 매핑 로드
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/loaders/MappingDataLoader.js
 * 
 * @example
 * // 사용 예시 1: 새 인스턴스 생성
 * const loader = new MappingDataLoader({
 *     apiClient: apiClient,
 *     equipmentEditState: editState,
 *     eventBus: eventBus,
 *     debug: true
 * });
 * 
 * await loader.initialize();
 * await loader.load();
 * 
 * // 사용 예시 2: 기존 EquipmentMappingService 재사용
 * const loader = new MappingDataLoader({
 *     mappingService: existingMappingService,
 *     debug: true
 * });
 * 
 * @changelog
 * - v2.0.0 (2026-01-13): EquipmentMappingService로 의존성 변경
 *   - MappingConfigService → EquipmentMappingService
 *   - 신규 API 메서드 활용 (loadCurrentMappings, loadMappingsForSite)
 *   - EventBus 연동 개선
 *   - getEquipmentId() 추가
 *   - loadEquipmentNames(), saveMappings(), validateMapping() 등 추가
 * - v1.0.0: 초기 버전 - IDataLoader 구현
 */

import { IDataLoader, LoaderState, LoaderEvents, LoaderType } from './IDataLoader.js';
// 🆕 v2.0.0: MappingConfigService → EquipmentMappingService
import { EquipmentMappingService } from '../mapping/EquipmentMappingService.js';
import { debugLog } from '../../core/utils/Config.js';

/**
 * MappingDataLoader 클래스
 * 
 * @extends IDataLoader
 */
export class MappingDataLoader extends IDataLoader {
    /**
     * MappingDataLoader 생성자
     * 
     * @param {Object} options - 설정 옵션
     * @param {Object} [options.apiClient] - ApiClient 인스턴스 (선택)
     * @param {Object} [options.equipmentEditState] - EquipmentEditState 인스턴스
     * @param {Object} [options.mappingService] - 🆕 v2.0.0: 기존 EquipmentMappingService 인스턴스 (선택)
     * @param {string} [options.apiBaseUrl] - API 기본 URL
     * @param {string} [options.siteId] - 초기 사이트 ID
     * @param {boolean} [options.autoApplyToEditState=true] - 로드 후 자동 적용 여부
     * @param {boolean} [options.debug=false] - 디버그 모드
     * @param {number} [options.timeout=30000] - 타임아웃 (ms)
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     */
    constructor(options = {}) {
        super(LoaderType.MAPPING, options);
        
        // ===== 의존성 =====
        /** @private @type {Object|null} */
        this._apiClient = options.apiClient ?? null;
        
        /** @private @type {Object|null} */
        this._equipmentEditState = options.equipmentEditState ?? null;
        
        // ===== 🆕 v2.0.0: EquipmentMappingService 인스턴스 =====
        // 기존 인스턴스가 제공되면 사용, 아니면 새로 생성
        /** @private @type {EquipmentMappingService} */
        this._mappingService = options.mappingService ?? new EquipmentMappingService({
            apiClient: this._apiClient,
            editState: this._equipmentEditState,
            eventBus: this._eventBus,
            siteId: options.siteId ?? null,
            apiBaseUrl: options.apiBaseUrl ?? this._detectApiBaseUrl()
        });
        
        // ===== 설정 =====
        /** @private @type {boolean} */
        this._autoApplyToEditState = options.autoApplyToEditState ?? true;
        
        // ===== 로드된 데이터 캐시 =====
        /** @private @type {Object|null} */
        this._loadedConfig = null;
        
        /** @private @type {Map} */
        this._mappingsCache = new Map();
        
        // ===== 버전 =====
        /** @private @type {string} */
        this._version = '2.0.0';
        
        this._log(`🔧 MappingDataLoader 생성됨 (v${this._version})`);
    }
    
    // =========================================================================
    // IDataLoader 구현 - 필수 메서드
    // =========================================================================
    
    /**
     * 초기화
     * 
     * @override
     * @async
     * @returns {Promise<boolean>} 성공 여부
     */
    async initialize() {
        if (this._isInitialized) {
            this._log('⚠️ 이미 초기화됨');
            return true;
        }
        
        this._setState(LoaderState.INITIALIZING);
        this._emit(LoaderEvents.INITIALIZE_START, {});
        
        try {
            this._initTime = new Date();
            
            // 🆕 v2.0.0: EquipmentMappingService에 의존성 설정
            if (this._apiClient && !this._mappingService.apiClient) {
                this._mappingService.apiClient = this._apiClient;
            }
            
            if (this._equipmentEditState && !this._mappingService.editState) {
                this._mappingService.setEditState(this._equipmentEditState);
            }
            
            if (this._eventBus && !this._mappingService.eventBus) {
                this._mappingService.setEventBus(this._eventBus);
            }
            
            this._isInitialized = true;
            this._setState(LoaderState.READY);
            
            this._emit(LoaderEvents.INITIALIZE_COMPLETE, {
                initTime: this._initTime.toISOString(),
                version: this._version
            });
            
            this._log('✅ MappingDataLoader 초기화 완료');
            return true;
            
        } catch (error) {
            this._handleError(error);
            this._emit(LoaderEvents.INITIALIZE_ERROR, { error: error.message });
            return false;
        }
    }
    
    /**
     * 매핑 데이터 로드
     * 
     * @override
     * @async
     * @param {Object} [params] - 로드 파라미터
     * @param {string} [params.siteId] - 특정 사이트 ID (없으면 현재 연결된 사이트)
     * @param {boolean} [params.forceRefresh=false] - 강제 새로고침
     * @param {string} [params.mergeStrategy='replace'] - 병합 전략 (하위 호환성 유지)
     * @returns {Promise<Object>} 로드된 매핑 데이터
     */
    async load(params = {}) {
        const { siteId, forceRefresh = false, mergeStrategy = 'replace' } = params;
        
        if (!this._isInitialized) {
            throw new Error('초기화되지 않음. initialize()를 먼저 호출하세요.');
        }
        
        if (this._isLoading) {
            this._log('⚠️ 이미 로딩 중');
            return this._loadedConfig;
        }
        
        this._isLoading = true;
        this._setState(LoaderState.LOADING);
        this._loadStartTime = new Date();
        
        this._emit(LoaderEvents.LOAD_START, { siteId, forceRefresh });
        
        try {
            let result;
            
            // 🆕 v2.0.0: EquipmentMappingService의 신규 메서드 사용
            // Before: initializeFromCurrentConnection() / loadSiteMapping()
            // After:  loadCurrentMappings() / loadMappingsForSite()
            if (siteId) {
                // 특정 사이트 매핑 로드
                result = await this._mappingService.loadMappingsForSite(siteId, {
                    forceRefresh,
                    applyToEditState: this._autoApplyToEditState && !!this._equipmentEditState
                });
            } else {
                // 현재 연결된 사이트 매핑 로드
                result = await this._mappingService.loadCurrentMappings({
                    forceRefresh,
                    applyToEditState: this._autoApplyToEditState && !!this._equipmentEditState
                });
            }
            
            if (!result.connected) {
                this._log('⚠️ 매핑 로드 실패 또는 연결 없음');
                this._setState(LoaderState.READY);
                this._isLoading = false;
                
                return {
                    connected: false,
                    siteId: null,
                    mappings: {},
                    count: 0,
                    message: result.message || 'Not connected'
                };
            }
            
            // 로드된 데이터 캐시
            this._loadedConfig = {
                connected: true,
                siteId: result.siteId,
                mappings: result.mappings,
                count: result.count,
                siteInfo: result.siteInfo || this._mappingService.getSiteInfo(),
                fromCache: result.fromCache || false
            };
            
            // 캐시 업데이트
            this._mappingsCache = this._mappingService.getAllMappings();
            
            // 진행률 업데이트
            this._updateProgress(100, this._loadedConfig.count, this._loadedConfig.count);
            
            this._setState(LoaderState.LOADED);
            this._loadEndTime = new Date();
            this._loadCount++;
            this._isLoading = false;
            
            this._emit(LoaderEvents.LOAD_COMPLETE, {
                count: this._loadedConfig.count,
                siteId: this._loadedConfig.siteId,
                loadTime: this._loadEndTime - this._loadStartTime,
                fromCache: this._loadedConfig.fromCache
            });
            
            this._log(`✅ 매핑 로드 완료: ${this._loadedConfig.count}개 (${this._loadedConfig.siteId})`);
            
            return this._loadedConfig;
            
        } catch (error) {
            this._handleError(error);
            this._isLoading = false;
            
            this._emit(LoaderEvents.LOAD_ERROR, { error: error.message });
            
            throw error;
        }
    }
    
    /**
     * 리소스 정리
     * 
     * @override
     */
    dispose() {
        if (this._isDisposed) {
            this._log('⚠️ 이미 정리됨');
            return;
        }
        
        this._setState(LoaderState.DISPOSING);
        this._emit(LoaderEvents.DISPOSE_START, {});
        
        // 진행 중인 요청 취소
        this.abort();
        
        // 🆕 v2.0.0: EquipmentMappingService 캐시 정리
        if (this._mappingService) {
            this._mappingService.clearCache();
        }
        
        // 내부 캐시 정리
        this._loadedConfig = null;
        this._mappingsCache.clear();
        
        // 참조 해제 (MappingService는 유지 - 다른 곳에서 사용할 수 있음)
        this._apiClient = null;
        this._equipmentEditState = null;
        
        this._isDisposed = true;
        this._isInitialized = false;
        this._setState(LoaderState.DISPOSED);
        
        this._emit(LoaderEvents.DISPOSE_COMPLETE, {});
        
        this._log('🗑️ MappingDataLoader 정리 완료');
    }
    
    /**
     * 현재 상태 반환
     * 
     * @override
     * @returns {Object} 상태 객체
     */
    getStatus() {
        // 🆕 v2.0.0: EquipmentMappingService 상태 포함
        const serviceStatus = this._mappingService?.getStatus() ?? null;
        
        return {
            // 기본 IDataLoader 상태
            type: this._type,
            state: this._state,
            isInitialized: this._isInitialized,
            isLoading: this._isLoading,
            isDisposed: this._isDisposed,
            loadCount: this._loadCount,
            lastError: this._lastError?.message ?? null,
            
            // MappingDataLoader 특화 상태
            siteId: this._mappingService?.siteId ?? null,
            mappingCount: this._mappingService?.getMappingCount() ?? 0,
            // 🆕 v2.0.0: _isCacheValid() → _isMappingCacheValid()
            cacheValid: this._mappingService?._isMappingCacheValid?.() ?? false,
            serviceStatus: serviceStatus,
            
            // 메타 정보
            version: this._version,
            initTime: this._initTime?.toISOString() ?? null,
            loadStartTime: this._loadStartTime?.toISOString() ?? null,
            loadEndTime: this._loadEndTime?.toISOString() ?? null,
            
            // 설정
            autoApplyToEditState: this._autoApplyToEditState,
            hasEquipmentEditState: !!this._equipmentEditState,
            hasEventBus: !!this._eventBus
        };
    }
    
    // =========================================================================
    // 선택적 오버라이드 메서드
    // =========================================================================
    
    /**
     * Health Check
     * 
     * @override
     * @async
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        if (!this._isInitialized || this._isDisposed) {
            return false;
        }
        
        // 🆕 v2.0.0: EquipmentMappingService 초기화 상태 확인
        return this._mappingService?.isInitialized ?? false;
    }
    
    /**
     * 재연결 (Site 변경 시)
     * 
     * @override
     * @async
     * @param {string} [newSiteId] - 새 사이트 ID
     * @returns {Promise<boolean>}
     */
    async reconnect(newSiteId) {
        this._log(`🔌 reconnect 호출 (siteId: ${newSiteId || 'current'})`);
        
        if (this._isDisposed) {
            this._isDisposed = false;
        }
        
        try {
            // 🆕 v2.0.0: clearCache() → clearMappingCache()
            this._mappingService?.clearMappingCache();
            
            await this.load({
                siteId: newSiteId,
                forceRefresh: true
            });
            
            return true;
            
        } catch (error) {
            this._handleError(error);
            return false;
        }
    }
    
    // =========================================================================
    // MappingDataLoader 특화 메서드 - 의존성 설정
    // =========================================================================
    
    /**
     * 의존성 설정
     * 
     * @param {Object} options
     * @param {Object} [options.apiClient] - ApiClient 인스턴스
     * @param {Object} [options.equipmentEditState] - EquipmentEditState 인스턴스
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     * @param {Object} [options.mappingService] - 🆕 v2.0.0: EquipmentMappingService 인스턴스
     */
    setDependencies(options = {}) {
        if (options.apiClient) {
            this._apiClient = options.apiClient;
            if (this._mappingService) {
                this._mappingService.apiClient = options.apiClient;
            }
            this._log('📌 ApiClient 설정됨');
        }
        
        if (options.equipmentEditState) {
            this._equipmentEditState = options.equipmentEditState;
            if (this._mappingService) {
                this._mappingService.setEditState(options.equipmentEditState);
            }
            this._log('📌 EquipmentEditState 설정됨');
        }
        
        // 🆕 v2.0.0: EventBus 설정 추가
        if (options.eventBus) {
            this._eventBus = options.eventBus;
            if (this._mappingService) {
                this._mappingService.setEventBus(options.eventBus);
            }
            this._log('📌 EventBus 설정됨');
        }
        
        // 🆕 v2.0.0: 외부 MappingService 인스턴스 설정
        if (options.mappingService) {
            this._mappingService = options.mappingService;
            this._log('📌 EquipmentMappingService 설정됨');
        }
    }
    
    /**
     * EquipmentEditState 설정
     * 
     * @param {Object} editState - EquipmentEditState 인스턴스
     */
    setEquipmentEditState(editState) {
        this._equipmentEditState = editState;
        if (this._mappingService) {
            this._mappingService.setEditState(editState);
        }
        this._log('📌 EquipmentEditState 설정됨');
    }
    
    /**
     * 자동 적용 설정
     * 
     * @param {boolean} enabled
     */
    setAutoApplyToEditState(enabled) {
        this._autoApplyToEditState = enabled;
        this._log(`📌 autoApplyToEditState: ${enabled}`);
    }
    
    // =========================================================================
    // MappingDataLoader 특화 메서드 - 서비스 접근
    // =========================================================================
    
    /**
     * 🆕 v2.0.0: EquipmentMappingService 인스턴스 반환
     * (기존: MappingConfigService 반환)
     * 
     * @returns {EquipmentMappingService}
     */
    getMappingService() {
        return this._mappingService;
    }
    
    /**
     * 현재 사이트 ID 반환
     * 
     * @returns {string|null}
     */
    getSiteId() {
        return this._mappingService?.siteId ?? null;
    }
    
    /**
     * 매핑 개수 반환
     * 
     * @returns {number}
     */
    getMappingCount() {
        return this._mappingService?.getMappingCount() ?? 0;
    }
    
    /**
     * 모든 매핑 반환 (Map)
     * 
     * @returns {Map}
     */
    getAllMappings() {
        return this._mappingService?.getAllMappings() ?? new Map();
    }
    
    /**
     * Frontend ID로 매핑 조회
     * 
     * @param {string} frontendId
     * @returns {Object|null}
     */
    getMapping(frontendId) {
        return this._mappingService?.getMappingDetails(frontendId) ?? null;
    }
    
    /**
     * Equipment ID로 Frontend ID 조회
     * 
     * @param {number} equipmentId
     * @returns {string|null}
     */
    getFrontendId(equipmentId) {
        return this._mappingService?.getFrontendId(equipmentId) ?? null;
    }
    
    /**
     * 🆕 v2.0.0: Frontend ID로 Equipment ID 조회
     * 
     * @param {string} frontendId
     * @returns {number|null}
     */
    getEquipmentId(frontendId) {
        return this._mappingService?.getEquipmentId(frontendId) ?? null;
    }
    
    /**
     * 매핑 여부 확인
     * 
     * @param {string} frontendId
     * @returns {boolean}
     */
    isMapped(frontendId) {
        return this._mappingService?.isMapped(frontendId) ?? false;
    }
    
    // =========================================================================
    // MappingDataLoader 특화 메서드 - 사이트 관리
    // =========================================================================
    
    /**
     * 사이트 변경
     * 
     * @param {string} newSiteId
     * @returns {Promise<boolean>}
     */
    async changeSite(newSiteId) {
        this._log(`🔄 사이트 변경: ${this.getSiteId()} → ${newSiteId}`);
        
        const previousSiteId = this.getSiteId();
        
        // 🆕 v2.0.0: EquipmentMappingService.changeSite() 사용
        const success = await this._mappingService?.changeSite(newSiteId);
        
        // 캐시 업데이트
        if (success) {
            this._loadedConfig = {
                connected: true,
                siteId: newSiteId,
                mappings: this._mappingService.getAllMappingsAsObject(),
                count: this._mappingService.getMappingCount(),
                siteInfo: this._mappingService.getSiteInfo()
            };
            this._mappingsCache = this._mappingService.getAllMappings();
        }
        
        // 이벤트 발행
        this._emit('loader:site-changed', {
            previousSiteId: previousSiteId,
            newSiteId: newSiteId,
            success: success
        });
        
        return success ?? false;
    }
    
    /**
     * 사이트 정보 반환
     * 
     * @returns {Object}
     */
    getSiteInfo() {
        return this._mappingService?.getSiteInfo() ?? {
            siteId: null,
            siteName: '',
            dbName: '',
            displayName: '',
            mappingCount: 0,
            isInitialized: false,
            lastUpdated: null
        };
    }
    
    // =========================================================================
    // MappingDataLoader 특화 메서드 - EditState 연동
    // =========================================================================
    
    /**
     * EquipmentEditState에 매핑 적용
     * 
     * @returns {boolean}
     */
    applyToEditState() {
        if (!this._equipmentEditState) {
            console.warn('⚠️ EquipmentEditState가 설정되지 않음');
            return false;
        }
        
        return this._mappingService?.applyToEditState(this._equipmentEditState) ?? false;
    }
    
    /**
     * 완료 상태 반환
     * 
     * @param {number} [totalEquipments=117]
     * @returns {Object}
     */
    getCompletionStatus(totalEquipments = 117) {
        return this._mappingService?.getCompletionStatus(totalEquipments) ?? {
            total: totalEquipments,
            mapped: 0,
            unmapped: totalEquipments,
            percentage: 0,
            isComplete: false
        };
    }
    
    // =========================================================================
    // 🆕 v2.0.0: EquipmentMappingService 기능 위임
    // =========================================================================
    
    /**
     * 🆕 v2.0.0: 설비 이름 목록 로드
     * 
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<Array>}
     */
    async loadEquipmentNames(forceRefresh = false) {
        return this._mappingService?.loadEquipmentNames(forceRefresh) ?? [];
    }
    
    /**
     * 🆕 v2.0.0: 매핑 저장
     * 
     * @param {boolean} [validateFirst=true]
     * @returns {Promise<Object>}
     */
    async saveMappings(validateFirst = true) {
        return this._mappingService?.saveMappings(validateFirst) ?? { success: false };
    }
    
    /**
     * 🆕 v2.0.0: 매핑 검증 (서버)
     * 
     * @returns {Promise<Object>}
     */
    async validateMapping() {
        return this._mappingService?.validateMapping() ?? { 
            valid: false, 
            errors: ['Service not available'] 
        };
    }
    
    /**
     * 🆕 v2.0.0: 로컬 검증
     * 
     * @returns {Object}
     */
    validateLocal() {
        return this._mappingService?.validateLocal() ?? { 
            valid: false, 
            errors: ['Service not available'] 
        };
    }
    
    /**
     * 🆕 v2.0.0: 서버 동기화
     * 
     * @returns {Promise<Object>}
     */
    async syncWithServer() {
        return this._mappingService?.syncWithServer() ?? {
            success: false,
            action: 'none',
            message: 'Service not available'
        };
    }
    
    /**
     * 🆕 v2.0.0: 충돌 감지
     * 
     * @returns {Promise<Object>}
     */
    async detectConflicts() {
        return this._mappingService?.detectConflicts() ?? {
            needsSync: false,
            conflicts: [],
            localOnly: [],
            serverOnly: []
        };
    }
    
    /**
     * 🆕 v2.0.0: 매핑 테스트 (단일)
     * 
     * @param {string} frontendId
     * @returns {Promise<Object>}
     */
    async testMapping(frontendId) {
        return this._mappingService?.testMapping(frontendId) ?? {
            success: false,
            frontendId,
            error: 'Service not available'
        };
    }
    
    /**
     * 🆕 v2.0.0: 매핑 테스트 (전체)
     * 
     * @returns {Promise<Object>}
     */
    async testAllMappings() {
        return this._mappingService?.testAllMappings() ?? {
            total: 0,
            passed: 0,
            failed: 0,
            details: []
        };
    }
    
    // =========================================================================
    // Private 헬퍼 메서드
    // =========================================================================
    
    /**
     * API Base URL 감지
     * @private
     * @returns {string}
     */
    _detectApiBaseUrl() {
        const hostname = window.location.hostname;
        const port = 8008;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://localhost:${port}`;
        }
        
        return `http://${hostname}:${port}`;
    }
    
    // =========================================================================
    // Static 메서드
    // =========================================================================
    
    /**
     * 버전 정보
     * @static
     * @returns {string}
     */
    static get VERSION() {
        return '2.0.0';
    }
    
    /**
     * 🆕 v2.0.0: 내부 서비스 클래스 참조
     * @static
     * @returns {typeof EquipmentMappingService}
     */
    static get ServiceClass() {
        return EquipmentMappingService;
    }
}

// ============================================================================
// 하위 호환성을 위한 별칭 (v1.0.0 → v2.0.0)
// ============================================================================

// v1.0.0에서 _configService를 직접 접근하던 코드 호환
Object.defineProperty(MappingDataLoader.prototype, '_configService', {
    get() {
        console.warn('⚠️ _configService는 deprecated입니다. _mappingService를 사용하세요.');
        return this._mappingService;
    }
});

// ============================================================================
// 기본 내보내기
// ============================================================================

export default MappingDataLoader;