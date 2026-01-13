/**
 * DataLoaderFactory.js
 * ====================
 * 
 * DataLoader 싱글톤 팩토리
 * 
 * 모든 DataLoader 인스턴스를 중앙에서 관리하고,
 * 공통 의존성을 주입하여 일관된 방식으로 로더를 생성/관리합니다.
 * 
 * @version 1.0.0
 * @since 2026-01-13
 * 
 * @description
 * - 싱글톤 패턴으로 전역 팩토리 인스턴스 관리
 * - 모드별 DataLoader 생성 및 캐싱
 * - 공통 의존성 주입 (apiClient, eventBus, wsManager 등)
 * - 로더 생명주기 관리 (생성, 초기화, 정리)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/loaders/DataLoaderFactory.js
 * 
 * @example
 * // 설정 및 사용
 * import { dataLoaderFactory, getDataLoader, configureDataLoaders } from './loaders/index.js';
 * 
 * // 1. 공통 의존성 설정
 * configureDataLoaders({
 *     apiClient: myApiClient,
 *     eventBus: myEventBus,
 *     wsManager: myWsManager
 * });
 * 
 * // 2. 로더 가져오기 (자동 생성 및 캐싱)
 * const monitoringLoader = getDataLoader('monitoring');
 * const mappingLoader = getDataLoader('mapping');
 * 
 * // 3. 로더 초기화 및 사용
 * await monitoringLoader.initialize();
 * await monitoringLoader.load();
 * 
 * // 4. 정리
 * disposeAllDataLoaders();
 * 
 * @changelog
 * - v1.0.0: 초기 구현
 *   - 싱글톤 팩토리 패턴
 *   - monitoring, analysis, dashboard, mapping 로더 지원
 *   - 공통 의존성 주입
 *   - 로더 캐싱 및 생명주기 관리
 */

import { LoaderType, LoaderState } from './IDataLoader.js';

// ============================================================================
// 상수 정의
// ============================================================================

/**
 * 로더 모드 열거형
 * @readonly
 * @enum {string}
 */
export const LoaderMode = Object.freeze({
    /** Monitoring 모드 - 실시간 WebSocket */
    MONITORING: 'monitoring',
    
    /** Analysis 모드 - 대용량 데이터 분석 */
    ANALYSIS: 'analysis',
    
    /** Dashboard 모드 - Redis 캐시 기반 */
    DASHBOARD: 'dashboard',
    
    /** Edit 모드 - CRUD 작업 */
    EDIT: 'edit',
    
    /** Mapping 모드 - 설비 매핑 관리 */
    MAPPING: 'mapping'
});

/**
 * 팩토리 이벤트 타입
 * @readonly
 * @enum {string}
 */
export const FactoryEvents = Object.freeze({
    /** 로더 생성됨 */
    LOADER_CREATED: 'factory:loader-created',
    
    /** 로더 정리됨 */
    LOADER_DISPOSED: 'factory:loader-disposed',
    
    /** 설정 변경됨 */
    CONFIGURED: 'factory:configured',
    
    /** 모든 로더 정리됨 */
    ALL_DISPOSED: 'factory:all-disposed'
});

// ============================================================================
// DataLoaderFactory 클래스
// ============================================================================

/**
 * DataLoader 팩토리 클래스 (싱글톤)
 * 
 * @class DataLoaderFactory
 */
export class DataLoaderFactory {
    /** @private @type {DataLoaderFactory|null} */
    static _instance = null;
    
    /**
     * 싱글톤 인스턴스 반환
     * 
     * @static
     * @returns {DataLoaderFactory}
     */
    static getInstance() {
        if (!DataLoaderFactory._instance) {
            DataLoaderFactory._instance = new DataLoaderFactory();
        }
        return DataLoaderFactory._instance;
    }
    
    /**
     * 싱글톤 인스턴스 리셋 (테스트용)
     * 
     * @static
     */
    static resetInstance() {
        if (DataLoaderFactory._instance) {
            DataLoaderFactory._instance.disposeAll();
            DataLoaderFactory._instance = null;
        }
    }
    
    /**
     * DataLoaderFactory 생성자 (private)
     * 
     * @private
     */
    constructor() {
        // 싱글톤 패턴 보호
        if (DataLoaderFactory._instance) {
            console.warn('⚠️ DataLoaderFactory는 싱글톤입니다. getInstance()를 사용하세요.');
            return DataLoaderFactory._instance;
        }
        
        // ===== 로더 캐시 =====
        /** @private @type {Map<string, IDataLoader>} */
        this._loaders = new Map();
        
        // ===== 공통 의존성 =====
        /** @private @type {Object} */
        this._dependencies = {
            apiClient: null,
            eventBus: null,
            wsManager: null,
            equipmentEditState: null,
            siteId: null,
            apiBaseUrl: null,
            debug: false
        };
        
        // ===== 설정 상태 =====
        /** @private @type {boolean} */
        this._isConfigured = false;
        
        // ===== 로더 클래스 레지스트리 =====
        /** @private @type {Map<string, Function>} */
        this._loaderClasses = new Map();
        
        // ===== 버전 =====
        /** @private @type {string} */
        this._version = '1.0.0';
        
        this._log(`🏭 DataLoaderFactory 초기화됨 (v${this._version})`);
    }
    
    // =========================================================================
    // 설정 메서드
    // =========================================================================
    
    /**
     * 공통 의존성 설정
     * 
     * @param {Object} config - 설정 객체
     * @param {Object} [config.apiClient] - ApiClient 인스턴스
     * @param {Object} [config.eventBus] - EventBus 인스턴스
     * @param {Object} [config.wsManager] - WebSocketManager 인스턴스
     * @param {Object} [config.equipmentEditState] - EquipmentEditState 인스턴스
     * @param {string} [config.siteId] - 현재 사이트 ID
     * @param {string} [config.apiBaseUrl] - API 기본 URL
     * @param {boolean} [config.debug=false] - 디버그 모드
     * @returns {DataLoaderFactory} this (체이닝)
     */
    configure(config = {}) {
        // 기존 의존성과 병합
        this._dependencies = {
            ...this._dependencies,
            ...config
        };
        
        this._isConfigured = true;
        
        this._log('⚙️ 팩토리 설정됨:', Object.keys(config));
        
        // 기존 로더들에 의존성 업데이트
        this._updateExistingLoaders(config);
        
        // 이벤트 발행
        this._emit(FactoryEvents.CONFIGURED, {
            keys: Object.keys(config)
        });
        
        return this;
    }
    
    /**
     * 로더 클래스 등록
     * 
     * @param {string} mode - 모드명
     * @param {Function} LoaderClass - DataLoader 클래스
     * @returns {DataLoaderFactory} this (체이닝)
     */
    registerLoader(mode, LoaderClass) {
        this._loaderClasses.set(mode, LoaderClass);
        this._log(`📝 로더 등록됨: ${mode}`);
        return this;
    }
    
    /**
     * 여러 로더 클래스 일괄 등록
     * 
     * @param {Object} loaders - { mode: LoaderClass } 객체
     * @returns {DataLoaderFactory} this (체이닝)
     */
    registerLoaders(loaders) {
        for (const [mode, LoaderClass] of Object.entries(loaders)) {
            this.registerLoader(mode, LoaderClass);
        }
        return this;
    }
    
    // =========================================================================
    // 로더 생성/조회 메서드
    // =========================================================================
    
    /**
     * 로더 가져오기 (없으면 생성)
     * 
     * @param {string} mode - 로더 모드 (LoaderMode 값)
     * @param {Object} [options={}] - 추가 옵션 (의존성 오버라이드)
     * @returns {IDataLoader} 로더 인스턴스
     * @throws {Error} 알 수 없는 모드
     */
    getLoader(mode, options = {}) {
        // 캐시에 있으면 반환
        if (this._loaders.has(mode)) {
            const loader = this._loaders.get(mode);
            
            // 옵션이 제공되면 의존성 업데이트
            if (Object.keys(options).length > 0 && loader.setDependencies) {
                loader.setDependencies(options);
            }
            
            return loader;
        }
        
        // 새 로더 생성
        return this._createLoader(mode, options);
    }
    
    /**
     * 새 로더 생성 (캐싱 없이)
     * 
     * @param {string} mode - 로더 모드
     * @param {Object} [options={}] - 추가 옵션
     * @returns {IDataLoader} 새 로더 인스턴스
     */
    createLoader(mode, options = {}) {
        return this._createLoader(mode, options, false);
    }
    
    /**
     * 로더 존재 여부 확인
     * 
     * @param {string} mode - 로더 모드
     * @returns {boolean}
     */
    hasLoader(mode) {
        return this._loaders.has(mode);
    }
    
    /**
     * 캐시된 로더 제거
     * 
     * @param {string} mode - 로더 모드
     * @param {boolean} [dispose=true] - dispose 호출 여부
     * @returns {boolean} 성공 여부
     */
    removeLoader(mode, dispose = true) {
        if (!this._loaders.has(mode)) {
            return false;
        }
        
        const loader = this._loaders.get(mode);
        
        if (dispose && loader.dispose) {
            loader.dispose();
        }
        
        this._loaders.delete(mode);
        
        this._emit(FactoryEvents.LOADER_DISPOSED, { mode });
        this._log(`🗑️ 로더 제거됨: ${mode}`);
        
        return true;
    }
    
    // =========================================================================
    // 생명주기 관리
    // =========================================================================
    
    /**
     * 모든 로더 정리
     */
    disposeAll() {
        const modes = Array.from(this._loaders.keys());
        
        for (const mode of modes) {
            this.removeLoader(mode, true);
        }
        
        this._emit(FactoryEvents.ALL_DISPOSED, { modes });
        this._log(`🗑️ 모든 로더 정리됨 (${modes.length}개)`);
    }
    
    /**
     * 모든 로더 초기화
     * 
     * @async
     * @returns {Promise<Object>} 결과 { success: boolean, results: Object }
     */
    async initializeAll() {
        const results = {};
        
        for (const [mode, loader] of this._loaders.entries()) {
            try {
                if (loader.initialize) {
                    await loader.initialize();
                    results[mode] = { success: true };
                }
            } catch (error) {
                results[mode] = { success: false, error: error.message };
            }
        }
        
        const allSuccess = Object.values(results).every(r => r.success);
        
        this._log(`🚀 모든 로더 초기화: ${allSuccess ? '성공' : '일부 실패'}`);
        
        return { success: allSuccess, results };
    }
    
    /**
     * 모든 로더 로드
     * 
     * @async
     * @param {Object} [params={}] - 로드 파라미터
     * @returns {Promise<Object>} 결과
     */
    async loadAll(params = {}) {
        const results = {};
        
        for (const [mode, loader] of this._loaders.entries()) {
            try {
                if (loader.load) {
                    const result = await loader.load(params[mode] || {});
                    results[mode] = { success: true, data: result };
                }
            } catch (error) {
                results[mode] = { success: false, error: error.message };
            }
        }
        
        return results;
    }
    
    // =========================================================================
    // 상태 조회
    // =========================================================================
    
    /**
     * 팩토리 상태 반환
     * 
     * @returns {Object} 상태 객체
     */
    getStatus() {
        const loaderStatuses = {};
        
        for (const [mode, loader] of this._loaders.entries()) {
            loaderStatuses[mode] = loader.getStatus ? loader.getStatus() : { state: 'unknown' };
        }
        
        return {
            version: this._version,
            isConfigured: this._isConfigured,
            activeLoaders: this._loaders.size,
            cachedModes: Array.from(this._loaders.keys()),
            registeredModes: Array.from(this._loaderClasses.keys()),
            availableModes: Object.values(LoaderMode),
            loaders: loaderStatuses,
            dependencies: {
                hasApiClient: !!this._dependencies.apiClient,
                hasEventBus: !!this._dependencies.eventBus,
                hasWsManager: !!this._dependencies.wsManager,
                hasEquipmentEditState: !!this._dependencies.equipmentEditState,
                siteId: this._dependencies.siteId,
                debug: this._dependencies.debug
            }
        };
    }
    
    /**
     * 특정 로더 상태 반환
     * 
     * @param {string} mode - 로더 모드
     * @returns {Object|null}
     */
    getLoaderStatus(mode) {
        const loader = this._loaders.get(mode);
        return loader?.getStatus?.() ?? null;
    }
    
    /**
     * 설정 여부 확인
     * 
     * @returns {boolean}
     */
    get isConfigured() {
        return this._isConfigured;
    }
    
    /**
     * 활성 로더 수
     * 
     * @returns {number}
     */
    get loaderCount() {
        return this._loaders.size;
    }
    
    /**
     * 현재 의존성 반환
     * 
     * @returns {Object}
     */
    get dependencies() {
        return { ...this._dependencies };
    }
    
    // =========================================================================
    // Private 메서드
    // =========================================================================
    
    /**
     * 로더 생성 (내부)
     * 
     * @private
     * @param {string} mode - 로더 모드
     * @param {Object} options - 옵션
     * @param {boolean} [cache=true] - 캐시 여부
     * @returns {IDataLoader}
     */
    _createLoader(mode, options = {}, cache = true) {
        // 옵션 병합 (공통 의존성 + 개별 옵션)
        const mergedOptions = {
            ...this._dependencies,
            ...options
        };
        
        let loader;
        
        // 등록된 로더 클래스 우선 사용
        if (this._loaderClasses.has(mode)) {
            const LoaderClass = this._loaderClasses.get(mode);
            loader = new LoaderClass(mergedOptions);
        } else {
            // 기본 로더 클래스 사용 (동적 import 대신 lazy require)
            loader = this._createDefaultLoader(mode, mergedOptions);
        }
        
        // 캐시에 저장
        if (cache) {
            this._loaders.set(mode, loader);
        }
        
        this._emit(FactoryEvents.LOADER_CREATED, { mode, cached: cache });
        this._log(`✅ 로더 생성됨: ${mode} (cached: ${cache})`);
        
        return loader;
    }
    
    /**
     * 기본 로더 생성 (동적 import)
     * 
     * @private
     * @param {string} mode - 로더 모드
     * @param {Object} options - 옵션
     * @returns {IDataLoader}
     */
    _createDefaultLoader(mode, options) {
        // 참고: 실제 환경에서는 동적 import 사용
        // 여기서는 에러를 던져 registerLoader() 사용을 유도
        throw new Error(
            `로더 클래스가 등록되지 않음: ${mode}. ` +
            `DataLoaderFactory.registerLoader('${mode}', LoaderClass)를 먼저 호출하세요.`
        );
    }
    
    /**
     * 기존 로더들에 의존성 업데이트
     * 
     * @private
     * @param {Object} config - 새 설정
     */
    _updateExistingLoaders(config) {
        for (const [mode, loader] of this._loaders.entries()) {
            if (loader.setDependencies) {
                loader.setDependencies(config);
                this._log(`📌 ${mode} 로더 의존성 업데이트됨`);
            }
        }
    }
    
    /**
     * 이벤트 발행
     * 
     * @private
     * @param {string} eventName - 이벤트 이름
     * @param {Object} data - 이벤트 데이터
     */
    _emit(eventName, data) {
        if (!this._dependencies.eventBus) return;
        
        try {
            this._dependencies.eventBus.emit(eventName, {
                ...data,
                source: 'DataLoaderFactory',
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error('EventBus emit 에러:', e);
        }
    }
    
    /**
     * 디버그 로깅
     * 
     * @private
     * @param {...any} args
     */
    _log(...args) {
        if (this._dependencies.debug) {
            console.log('[DataLoaderFactory]', ...args);
        }
    }
    
    // =========================================================================
    // Static Convenience 메서드
    // =========================================================================
    
    /**
     * 설정 (static)
     * 
     * @static
     * @param {Object} config
     * @returns {DataLoaderFactory}
     */
    static configure(config) {
        return DataLoaderFactory.getInstance().configure(config);
    }
    
    /**
     * 로더 가져오기 (static)
     * 
     * @static
     * @param {string} mode
     * @param {Object} [options]
     * @returns {IDataLoader}
     */
    static getLoader(mode, options) {
        return DataLoaderFactory.getInstance().getLoader(mode, options);
    }
    
    /**
     * 모든 로더 정리 (static)
     * 
     * @static
     */
    static disposeAll() {
        DataLoaderFactory.getInstance().disposeAll();
    }
    
    /**
     * 상태 조회 (static)
     * 
     * @static
     * @returns {Object}
     */
    static getStatus() {
        return DataLoaderFactory.getInstance().getStatus();
    }
    
    /**
     * 로더 등록 (static)
     * 
     * @static
     * @param {string} mode
     * @param {Function} LoaderClass
     * @returns {DataLoaderFactory}
     */
    static registerLoader(mode, LoaderClass) {
        return DataLoaderFactory.getInstance().registerLoader(mode, LoaderClass);
    }
    
    /**
     * 버전 정보
     * 
     * @static
     * @returns {string}
     */
    static get VERSION() {
        return '1.0.0';
    }
}

// ============================================================================
// 싱글톤 인스턴스 및 헬퍼 함수
// ============================================================================

/**
 * 전역 싱글톤 인스턴스
 * @type {DataLoaderFactory}
 */
export const dataLoaderFactory = DataLoaderFactory.getInstance();

/**
 * 로더 가져오기 헬퍼 함수
 * 
 * @param {string} mode - 로더 모드
 * @param {Object} [options] - 추가 옵션
 * @returns {IDataLoader}
 * 
 * @example
 * const loader = getDataLoader('monitoring');
 * await loader.initialize();
 */
export function getDataLoader(mode, options) {
    return dataLoaderFactory.getLoader(mode, options);
}

/**
 * 팩토리 설정 헬퍼 함수
 * 
 * @param {Object} config - 설정 객체
 * @returns {DataLoaderFactory}
 * 
 * @example
 * configureDataLoaders({
 *     apiClient: myApiClient,
 *     eventBus: myEventBus,
 *     debug: true
 * });
 */
export function configureDataLoaders(config) {
    return dataLoaderFactory.configure(config);
}

/**
 * 모든 로더 정리 헬퍼 함수
 * 
 * @example
 * // 앱 종료 시
 * disposeAllDataLoaders();
 */
export function disposeAllDataLoaders() {
    dataLoaderFactory.disposeAll();
}

/**
 * 로더 등록 헬퍼 함수
 * 
 * @param {string} mode - 모드명
 * @param {Function} LoaderClass - 로더 클래스
 * @returns {DataLoaderFactory}
 * 
 * @example
 * import { MonitoringDataLoader } from './MonitoringDataLoader.js';
 * registerDataLoader('monitoring', MonitoringDataLoader);
 */
export function registerDataLoader(mode, LoaderClass) {
    return dataLoaderFactory.registerLoader(mode, LoaderClass);
}

/**
 * 팩토리 상태 조회 헬퍼 함수
 * 
 * @returns {Object}
 */
export function getFactoryStatus() {
    return dataLoaderFactory.getStatus();
}

// ============================================================================
// 기본 내보내기
// ============================================================================

export default DataLoaderFactory;