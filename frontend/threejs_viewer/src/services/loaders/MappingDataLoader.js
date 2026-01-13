/**
 * MappingDataLoader.js
 * =====================
 * 매핑 데이터 로더 (IDataLoader 구현)
 * 
 * MappingConfigService를 IDataLoader 인터페이스로 래핑하여
 * 다른 모드(Monitoring, Analysis, Dashboard)와 동일한 방식으로
 * 매핑 데이터를 로드/관리할 수 있도록 합니다.
 * 
 * @version 1.0.0
 * @since 2026-01-13
 * 
 * @description
 * - MappingConfigService를 내부적으로 사용
 * - IDataLoader 표준 인터페이스 구현
 * - EquipmentEditState와 자동 동기화
 * - Site 연결 시 자동 매핑 로드
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/loaders/MappingDataLoader.js
 * 
 * @example
 * // 사용 예시
 * const loader = new MappingDataLoader({
 *     equipmentEditState: editState,
 *     eventBus: eventBus,
 *     debug: true
 * });
 * 
 * await loader.initialize();  // MappingConfigService 초기화
 * await loader.load();        // /api/mapping/current에서 매핑 로드
 * loader.dispose();           // 리소스 정리
 * 
 * @changelog
 * - v1.0.0: 초기 버전 - IDataLoader 구현
 */

import { IDataLoader, LoaderState, LoaderEvents, LoaderType } from './IDataLoader.js';
import { MappingConfigService } from '../mapping/MappingConfigService.js';
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
        
        // ===== MappingConfigService 인스턴스 =====
        /** @private @type {MappingConfigService} */
        this._mappingService = new MappingConfigService({
            apiClient: this._apiClient,
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
        
        this._log(`🔧 MappingDataLoader 생성됨 (v1.0.0)`);
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
            
            // MappingConfigService는 별도 초기화 불필요
            // (초기화 시점에 연결 확인만)
            
            this._isInitialized = true;
            this._setState(LoaderState.READY);
            
            this._emit(LoaderEvents.INITIALIZE_COMPLETE, {
                initTime: this._initTime.toISOString()
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
     * @param {string} [params.mergeStrategy='replace'] - 병합 전략
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
            let success = false;
            
            if (siteId) {
                // 특정 사이트 매핑 로드
                success = await this._mappingService.loadSiteMapping(siteId, forceRefresh);
            } else {
                // 현재 연결된 사이트 매핑 로드
                success = await this._mappingService.initializeFromCurrentConnection();
            }
            
            if (!success) {
                this._log('⚠️ 매핑 로드 실패 또는 연결 없음');
                this._setState(LoaderState.READY);
                this._isLoading = false;
                
                return {
                    connected: false,
                    siteId: null,
                    mappings: {},
                    count: 0
                };
            }
            
            // 로드된 데이터 캐시
            this._loadedConfig = {
                connected: true,
                siteId: this._mappingService.siteId,
                mappings: this._mappingService.getAllMappings(),
                count: this._mappingService.getMappingCount(),
                siteInfo: this._mappingService.getSiteInfo()
            };
            
            // 캐시 업데이트
            this._mappingsCache = this._mappingService.getAllMappings();
            
            // EquipmentEditState에 자동 적용
            if (this._autoApplyToEditState && this._equipmentEditState) {
                const applied = this._mappingService.applyToEditState(this._equipmentEditState);
                this._log(`📋 EditState 적용: ${applied ? '성공' : '실패'}`);
            }
            
            // 진행률 업데이트
            this._updateProgress(100, this._loadedConfig.count, this._loadedConfig.count);
            
            this._setState(LoaderState.LOADED);
            this._loadEndTime = new Date();
            this._loadCount++;
            this._isLoading = false;
            
            this._emit(LoaderEvents.LOAD_COMPLETE, {
                count: this._loadedConfig.count,
                siteId: this._loadedConfig.siteId,
                loadTime: this._loadEndTime - this._loadStartTime
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
        
        // MappingConfigService 캐시 정리
        if (this._mappingService) {
            this._mappingService.clearCache();
        }
        
        // 내부 캐시 정리
        this._loadedConfig = null;
        this._mappingsCache.clear();
        
        // 참조 해제
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
            cacheValid: this._mappingService?._isCacheValid() ?? false,
            serviceStatus: this._mappingService?.getStatus() ?? null,
            
            // 메타 정보
            initTime: this._initTime?.toISOString() ?? null,
            loadStartTime: this._loadStartTime?.toISOString() ?? null,
            loadEndTime: this._loadEndTime?.toISOString() ?? null,
            
            // 설정
            autoApplyToEditState: this._autoApplyToEditState,
            hasEquipmentEditState: !!this._equipmentEditState
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
        
        // MappingConfigService가 초기화되었는지 확인
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
            // 캐시 정리 후 다시 로드
            this._mappingService?.clearCache();
            
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
    // MappingDataLoader 특화 메서드
    // =========================================================================
    
    /**
     * 의존성 설정
     * 
     * @param {Object} options
     * @param {Object} [options.apiClient] - ApiClient 인스턴스
     * @param {Object} [options.equipmentEditState] - EquipmentEditState 인스턴스
     */
    setDependencies(options = {}) {
        if (options.apiClient) {
            this._apiClient = options.apiClient;
            this._log('📌 ApiClient 설정됨');
        }
        
        if (options.equipmentEditState) {
            this._equipmentEditState = options.equipmentEditState;
            this._log('📌 EquipmentEditState 설정됨');
        }
    }
    
    /**
     * EquipmentEditState 설정
     * 
     * @param {Object} editState - EquipmentEditState 인스턴스
     */
    setEquipmentEditState(editState) {
        this._equipmentEditState = editState;
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
    
    /**
     * MappingConfigService 인스턴스 반환
     * 
     * @returns {MappingConfigService}
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
     * 모든 매핑 반환
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
     * 매핑 여부 확인
     * 
     * @param {string} frontendId
     * @returns {boolean}
     */
    isMapped(frontendId) {
        return this._mappingService?.isMapped(frontendId) ?? false;
    }
    
    /**
     * 사이트 변경
     * 
     * @param {string} newSiteId
     * @returns {Promise<boolean>}
     */
    async changeSite(newSiteId) {
        this._log(`🔄 사이트 변경: ${this.getSiteId()} → ${newSiteId}`);
        
        const success = await this._mappingService?.changeSite(newSiteId);
        
        if (success && this._autoApplyToEditState && this._equipmentEditState) {
            this._mappingService.applyToEditState(this._equipmentEditState);
        }
        
        // 이벤트 발행
        this._emit('loader:site-changed', {
            previousSiteId: this.getSiteId(),
            newSiteId: newSiteId,
            success: success
        });
        
        return success ?? false;
    }
    
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
            isInitialized: false
        };
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
    // Private 헬퍼 메서드
    // =========================================================================
    
    /**
     * API Base URL 감지
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
    
    // =========================================================================
    // Static 메서드
    // =========================================================================
    
    /**
     * 버전 정보
     * @static
     * @returns {string}
     */
    static get VERSION() {
        return '1.0.0';
    }
}

// ============================================================================
// 기본 내보내기
// ============================================================================

export default MappingDataLoader;