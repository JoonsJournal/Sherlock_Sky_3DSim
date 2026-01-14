/**
 * IDataLoader.js
 * ===============
 * 데이터 로더 공통 인터페이스 (추상 클래스)
 * 
 * 모든 모드(Monitoring, Analysis, Dashboard, Edit)가 동일한 방식으로
 * 데이터를 로드할 수 있도록 공통 인터페이스를 정의합니다.
 * 
 * @version 1.1.0
 * @since 2026-01-13
 * 
 * @description
 * - Monitoring: WebSocket + REST API (실시간, 경량)
 * - Analysis: Direct DB Query (대용량, 배치) - 🔜 예정
 * - Dashboard: Redis Cache (집계/통계, 초고속) - 🔜 예정
 * - Edit: REST API + Static JSON (CRUD, 파일 기반)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/loaders/IDataLoader.js
 * 
 * @example
 * // 구현 클래스 예시
 * class MonitoringDataLoader extends IDataLoader {
 *     async initialize() { ... }
 *     async load() { ... }
 *     async dispose() { ... }
 *     getStatus() { ... }
 * }
 * 
 * // 🆕 v1.1.0: EventEmitter 패턴 사용
 * const loader = new MonitoringDataLoader(options);
 * loader.on('monitoring:status-update', (data) => {
 *     console.log('Status:', data);
 * });
 * 
 * @changelog
 * - v1.1.0: 🆕 EventEmitter 패턴 추가 (on, off, once, hasListeners, listenerCount, removeAllListeners)
 * - v1.0.0: 초기 버전 - 공통 인터페이스 정의
 */

// ============================================================================
// 상수 정의
// ============================================================================

/**
 * DataLoader 상태 열거형
 * @readonly
 * @enum {string}
 */
export const LoaderState = Object.freeze({
    /** 초기 상태 (초기화 전) */
    IDLE: 'idle',
    
    /** 초기화 진행 중 */
    INITIALIZING: 'initializing',
    
    /** 초기화 완료, 대기 중 */
    READY: 'ready',
    
    /** 데이터 로딩 중 */
    LOADING: 'loading',
    
    /** 로딩 완료 */
    LOADED: 'loaded',
    
    /** 에러 발생 */
    ERROR: 'error',
    
    /** 리소스 정리 중 */
    DISPOSING: 'disposing',
    
    /** 리소스 정리 완료 */
    DISPOSED: 'disposed'
});

/**
 * DataLoader 이벤트 타입
 * @readonly
 * @enum {string}
 */
export const LoaderEvents = Object.freeze({
    /** 초기화 시작 */
    INITIALIZE_START: 'loader:initialize-start',
    
    /** 초기화 완료 */
    INITIALIZE_COMPLETE: 'loader:initialize-complete',
    
    /** 초기화 실패 */
    INITIALIZE_ERROR: 'loader:initialize-error',
    
    /** 로드 시작 */
    LOAD_START: 'loader:load-start',
    
    /** 로드 진행 상황 업데이트 */
    LOAD_PROGRESS: 'loader:load-progress',
    
    /** 로드 완료 */
    LOAD_COMPLETE: 'loader:load-complete',
    
    /** 로드 실패 */
    LOAD_ERROR: 'loader:load-error',
    
    /** 상태 변경 */
    STATE_CHANGED: 'loader:state-changed',
    
    /** 리소스 정리 시작 */
    DISPOSE_START: 'loader:dispose-start',
    
    /** 리소스 정리 완료 */
    DISPOSE_COMPLETE: 'loader:dispose-complete'
});

/**
 * DataLoader 타입 열거형
 * @readonly
 * @enum {string}
 */
export const LoaderType = Object.freeze({
    /** Monitoring 모드 - WebSocket + REST API */
    MONITORING: 'monitoring',
    
    /** Analysis 모드 - Direct DB Query (대용량) */
    ANALYSIS: 'analysis',
    
    /** Dashboard 모드 - Redis Cache */
    DASHBOARD: 'dashboard',
    
    /** Edit 모드 - REST API + JSON File */
    EDIT: 'edit',
    
    /** Mapping 로드 - REST API */
    MAPPING: 'mapping'
});

// ============================================================================
// IDataLoader 추상 클래스
// ============================================================================

/**
 * 데이터 로더 추상 클래스 (인터페이스)
 * 
 * @abstract
 * @class IDataLoader
 * 
 * @description
 * 모든 DataLoader 구현체가 상속해야 하는 추상 클래스입니다.
 * JavaScript에는 인터페이스가 없으므로 추상 클래스로 구현합니다.
 * 
 * 구현 시 반드시 오버라이드해야 하는 메서드:
 * - initialize(): 초기화 (연결, 설정 등)
 * - load(): 데이터 로드
 * - dispose(): 리소스 정리
 * - getStatus(): 현재 상태 반환
 * 
 * @example
 * class MonitoringDataLoader extends IDataLoader {
 *     constructor(options) {
 *         super(LoaderType.MONITORING, options);
 *     }
 *     
 *     async initialize() {
 *         // WebSocket 연결, API 클라이언트 초기화 등
 *     }
 *     
 *     async load() {
 *         // 초기 상태 로드
 *     }
 *     
 *     dispose() {
 *         // WebSocket 종료, 리소스 정리
 *     }
 *     
 *     getStatus() {
 *         return { state: this._state, ... };
 *     }
 * }
 */
export class IDataLoader {
    /**
     * IDataLoader 생성자
     * 
     * @param {string} type - LoaderType 값 (예: LoaderType.MONITORING)
     * @param {Object} options - 설정 옵션
     * @param {boolean} [options.debug=false] - 디버그 로깅 활성화
     * @param {number} [options.timeout=30000] - 기본 타임아웃 (ms)
     * @param {number} [options.retryCount=3] - 재시도 횟수
     * @param {number} [options.retryDelay=1000] - 재시도 간격 (ms)
     * @param {Function} [options.onStateChange] - 상태 변경 콜백
     * @param {Function} [options.onProgress] - 진행 상황 콜백
     * @param {Function} [options.onError] - 에러 콜백
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     */
    constructor(type, options = {}) {
        // 추상 클래스 직접 인스턴스화 방지
        if (new.target === IDataLoader) {
            throw new Error('IDataLoader는 추상 클래스입니다. 직접 인스턴스화할 수 없습니다.');
        }
        
        // ===== 기본 속성 =====
        /** @protected @type {string} */
        this._type = type;
        
        /** @protected @type {LoaderState} */
        this._state = LoaderState.IDLE;
        
        /** @protected @type {LoaderState} */
        this._previousState = LoaderState.IDLE;
        
        /** @protected @type {boolean} */
        this._isInitialized = false;
        
        /** @protected @type {boolean} */
        this._isLoading = false;
        
        /** @protected @type {boolean} */
        this._isDisposed = false;
        
        // ===== 설정 =====
        /** @protected @type {Object} */
        this._config = {
            debug: options.debug ?? false,
            timeout: options.timeout ?? 30000,
            retryCount: options.retryCount ?? 3,
            retryDelay: options.retryDelay ?? 1000
        };
        
        // ===== 콜백 =====
        /** @protected @type {Function|null} */
        this._onStateChange = options.onStateChange ?? null;
        
        /** @protected @type {Function|null} */
        this._onProgress = options.onProgress ?? null;
        
        /** @protected @type {Function|null} */
        this._onError = options.onError ?? null;
        
        // ===== EventBus (선택적) =====
        /** @protected @type {Object|null} */
        this._eventBus = options.eventBus ?? null;
        
        // ===== 메타 정보 =====
        /** @protected @type {Date|null} */
        this._initTime = null;
        
        /** @protected @type {Date|null} */
        this._loadStartTime = null;
        
        /** @protected @type {Date|null} */
        this._loadEndTime = null;
        
        /** @protected @type {number} */
        this._loadCount = 0;
        
        /** @protected @type {Error|null} */
        this._lastError = null;
        
        // ===== AbortController (요청 취소용) =====
        /** @protected @type {AbortController|null} */
        this._abortController = null;
        
        // ===== 🆕 v1.1.0: 내부 이벤트 리스너 =====
        /** @protected @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
        
        /** @protected @type {Map<string, Set<Function>>} */
        this._onceListeners = new Map();
        
        this._log(`🔧 ${this.constructor.name} 생성됨 (type: ${type})`);
    }
    
    // =========================================================================
    // 추상 메서드 (반드시 구현해야 함)
    // =========================================================================
    
    /**
     * 초기화
     * 
     * @abstract
     * @async
     * @returns {Promise<boolean>} 성공 여부
     * @throws {Error} 초기화 실패 시
     * 
     * @description
     * 구현 시 다음을 수행해야 합니다:
     * - 연결 설정 (WebSocket, DB, Redis 등)
     * - 클라이언트 초기화
     * - 필요한 설정 로드
     * - 상태를 READY로 변경
     * 
     * @example
     * async initialize() {
     *     this._setState(LoaderState.INITIALIZING);
     *     try {
     *         await this._connectWebSocket();
     *         await this._initApiClient();
     *         this._setState(LoaderState.READY);
     *         this._isInitialized = true;
     *         return true;
     *     } catch (error) {
     *         this._handleError(error);
     *         return false;
     *     }
     * }
     */
    async initialize() {
        throw new Error('initialize() 메서드를 구현해야 합니다.');
    }
    
    /**
     * 데이터 로드
     * 
     * @abstract
     * @async
     * @param {Object} [params] - 로드 파라미터
     * @returns {Promise<Object>} 로드된 데이터
     * @throws {Error} 로드 실패 시
     * 
     * @description
     * 구현 시 다음을 수행해야 합니다:
     * - 상태를 LOADING으로 변경
     * - 데이터 조회 (REST API, DB Query, Cache 등)
     * - 진행 상황 업데이트 (_updateProgress)
     * - 상태를 LOADED로 변경
     * - 로드된 데이터 반환
     * 
     * @example
     * async load(params = {}) {
     *     this._setState(LoaderState.LOADING);
     *     this._loadStartTime = new Date();
     *     
     *     try {
     *         const data = await this._fetchData(params);
     *         this._updateProgress(100, data.length);
     *         this._setState(LoaderState.LOADED);
     *         this._loadEndTime = new Date();
     *         this._loadCount++;
     *         return data;
     *     } catch (error) {
     *         this._handleError(error);
     *         throw error;
     *     }
     * }
     */
    async load(params) {
        throw new Error('load() 메서드를 구현해야 합니다.');
    }
    
    /**
     * 리소스 정리
     * 
     * @abstract
     * @returns {void}
     * 
     * @description
     * 구현 시 다음을 수행해야 합니다:
     * - 진행 중인 요청 취소 (AbortController)
     * - 연결 종료 (WebSocket, DB Connection 등)
     * - 캐시 정리
     * - 이벤트 리스너 해제
     * - 상태를 DISPOSED로 변경
     * 
     * @example
     * dispose() {
     *     this._setState(LoaderState.DISPOSING);
     *     this.abort();
     *     this._disconnectWebSocket();
     *     this._clearCache();
     *     this._disposeBase();  // 🆕 v1.1.0: 공통 정리 호출
     *     this._setState(LoaderState.DISPOSED);
     *     this._isDisposed = true;
     * }
     */
    dispose() {
        throw new Error('dispose() 메서드를 구현해야 합니다.');
    }
    
    /**
     * 🆕 v1.1.0: 공통 리소스 정리 (구현 클래스에서 호출)
     * 
     * @protected
     */
    _disposeBase() {
        // 모든 이벤트 리스너 제거
        this.removeAllListeners();
        
        // AbortController 취소
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        
        this._log('🧹 Base dispose 완료');
    }
    
    /**
     * 현재 상태 반환
     * 
     * @abstract
     * @returns {Object} 상태 객체
     * 
     * @description
     * 반환해야 하는 정보:
     * - type: LoaderType
     * - state: 현재 LoaderState
     * - isInitialized: 초기화 완료 여부
     * - isLoading: 로딩 중 여부
     * - isDisposed: 정리 완료 여부
     * - loadCount: 로드 횟수
     * - lastError: 마지막 에러
     * - 기타 모드별 추가 정보
     * 
     * @example
     * getStatus() {
     *     return {
     *         type: this._type,
     *         state: this._state,
     *         isInitialized: this._isInitialized,
     *         isLoading: this._isLoading,
     *         isDisposed: this._isDisposed,
     *         loadCount: this._loadCount,
     *         lastError: this._lastError?.message || null,
     *         // 모드별 추가 정보
     *         wsConnected: this._wsManager?.isConnected() || false,
     *         cacheSize: this._cache?.size || 0
     *     };
     * }
     */
    getStatus() {
        throw new Error('getStatus() 메서드를 구현해야 합니다.');
    }
    
    // =========================================================================
    // 선택적 오버라이드 메서드
    // =========================================================================
    
    /**
     * 재로드 (데이터 새로고침)
     * 
     * @async
     * @param {Object} [params] - 로드 파라미터
     * @returns {Promise<Object>} 로드된 데이터
     * 
     * @description
     * 기본 구현은 abort() 후 load() 호출.
     * 필요 시 오버라이드하여 커스텀 로직 구현 가능.
     */
    async reload(params) {
        this._log('🔄 reload() 호출');
        this.abort();
        return await this.load(params);
    }
    
    /**
     * 진행 중인 작업 취소
     * 
     * @returns {boolean} 취소 성공 여부
     * 
     * @description
     * 기본 구현은 AbortController 사용.
     * 필요 시 오버라이드하여 추가 취소 로직 구현 가능.
     */
    abort() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
            this._log('⛔ 작업 취소됨');
            return true;
        }
        return false;
    }
    
    /**
     * 재연결 (네트워크 복구 시)
     * 
     * @async
     * @returns {Promise<boolean>} 성공 여부
     * 
     * @description
     * 연결이 끊어진 후 복구할 때 호출.
     * 기본 구현은 dispose() 후 initialize() + load() 호출.
     * 필요 시 오버라이드하여 상태 보존 로직 구현 가능.
     */
    async reconnect() {
        this._log('🔌 reconnect() 호출');
        
        if (this._isDisposed) {
            this._isDisposed = false;
        }
        
        try {
            await this.initialize();
            await this.load();
            return true;
        } catch (error) {
            this._handleError(error);
            return false;
        }
    }
    
    /**
     * Health Check
     * 
     * @async
     * @returns {Promise<boolean>} 연결 상태
     * 
     * @description
     * 연결 상태를 확인하는 경량 메서드.
     * 기본 구현은 상태 확인만 수행.
     * 필요 시 오버라이드하여 실제 Health Check API 호출 가능.
     */
    async healthCheck() {
        return this._isInitialized && !this._isDisposed && this._state !== LoaderState.ERROR;
    }
    
    // =========================================================================
    // Protected 헬퍼 메서드 (구현 클래스에서 사용)
    // =========================================================================
    
    /**
     * 상태 변경
     * 
     * @protected
     * @param {LoaderState} newState - 새로운 상태
     * @emits LoaderEvents.STATE_CHANGED
     */
    _setState(newState) {
        if (this._state === newState) return;
        
        this._previousState = this._state;
        this._state = newState;
        
        this._log(`📊 상태 변경: ${this._previousState} → ${this._state}`);
        
        // 콜백 호출
        if (this._onStateChange) {
            try {
                this._onStateChange({
                    type: this._type,
                    state: this._state,
                    previousState: this._previousState,
                    timestamp: new Date().toISOString()
                });
            } catch (e) {
                console.error('onStateChange 콜백 에러:', e);
            }
        }
        
        // EventBus 이벤트 발행
        this._emit(LoaderEvents.STATE_CHANGED, {
            state: this._state,
            previousState: this._previousState
        });
    }
    
    /**
     * 진행 상황 업데이트
     * 
     * @protected
     * @param {number} percent - 진행률 (0-100)
     * @param {number} [loaded] - 로드된 항목 수
     * @param {number} [total] - 전체 항목 수
     * @emits LoaderEvents.LOAD_PROGRESS
     */
    _updateProgress(percent, loaded, total) {
        const progressData = {
            type: this._type,
            percent: Math.min(100, Math.max(0, percent)),
            loaded,
            total,
            timestamp: new Date().toISOString()
        };
        
        // 콜백 호출
        if (this._onProgress) {
            try {
                this._onProgress(progressData);
            } catch (e) {
                console.error('onProgress 콜백 에러:', e);
            }
        }
        
        // EventBus 이벤트 발행
        this._emit(LoaderEvents.LOAD_PROGRESS, progressData);
    }
    
    /**
     * 에러 처리
     * 
     * @protected
     * @param {Error} error - 에러 객체
     * @emits LoaderEvents.LOAD_ERROR
     */
    _handleError(error) {
        this._lastError = error;
        this._setState(LoaderState.ERROR);
        
        console.error(`❌ [${this.constructor.name}] 에러:`, error.message);
        
        const errorData = {
            type: this._type,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };
        
        // 콜백 호출
        if (this._onError) {
            try {
                this._onError(errorData);
            } catch (e) {
                console.error('onError 콜백 에러:', e);
            }
        }
        
        // EventBus 이벤트 발행
        this._emit(LoaderEvents.LOAD_ERROR, errorData);
    }
    
    /**
     * 이벤트 발행 (내부 리스너 + EventBus)
     * 
     * @protected
     * @param {string} eventName - 이벤트 이름
     * @param {Object} data - 이벤트 데이터
     */
    _emit(eventName, data) {
        const eventData = {
            ...data,
            source: this.constructor.name,
            loaderType: this._type
        };
        
        // 🆕 v1.1.0: 내부 리스너 호출
        this._notifyListeners(eventName, eventData);
        
        // EventBus 이벤트 발행
        if (this._eventBus) {
            try {
                this._eventBus.emit(eventName, eventData);
            } catch (e) {
                console.error('EventBus emit 에러:', e);
            }
        }
    }
    
    // =========================================================================
    // 🆕 v1.1.0: EventEmitter 패턴 - Public 메서드
    // =========================================================================
    
    /**
     * 이벤트 리스너 등록
     * 
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     * 
     * @example
     * const unsubscribe = loader.on('monitoring:status-update', (data) => {
     *     console.log('Status updated:', data);
     * });
     * 
     * // 나중에 구독 해제
     * unsubscribe();
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            console.error('[IDataLoader] on: callback must be a function');
            return () => {};
        }
        
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        
        this._listeners.get(event).add(callback);
        
        // 구독 해제 함수 반환
        return () => this.off(event, callback);
    }
    
    /**
     * 한 번만 실행되는 이벤트 리스너 등록
     * 
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    once(event, callback) {
        if (typeof callback !== 'function') {
            console.error('[IDataLoader] once: callback must be a function');
            return () => {};
        }
        
        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, new Set());
        }
        
        this._onceListeners.get(event).add(callback);
        
        return () => this._removeOnceListener(event, callback);
    }
    
    /**
     * 이벤트 리스너 제거
     * 
     * @param {string} event - 이벤트 이름
     * @param {Function} [callback] - 제거할 콜백 (없으면 해당 이벤트 전체 제거)
     */
    off(event, callback = null) {
        if (callback === null) {
            // 해당 이벤트의 모든 리스너 제거
            this._listeners.delete(event);
            this._onceListeners.delete(event);
            return;
        }
        
        // 특정 콜백만 제거
        if (this._listeners.has(event)) {
            this._listeners.get(event).delete(callback);
        }
        
        this._removeOnceListener(event, callback);
    }
    
    /**
     * 이벤트 리스너 존재 여부 확인
     * 
     * @param {string} event - 이벤트 이름
     * @returns {boolean}
     */
    hasListeners(event) {
        const hasNormal = this._listeners.has(event) && this._listeners.get(event).size > 0;
        const hasOnce = this._onceListeners.has(event) && this._onceListeners.get(event).size > 0;
        return hasNormal || hasOnce;
    }
    
    /**
     * 특정 이벤트의 리스너 개수
     * 
     * @param {string} event - 이벤트 이름
     * @returns {number}
     */
    listenerCount(event) {
        let count = 0;
        if (this._listeners.has(event)) {
            count += this._listeners.get(event).size;
        }
        if (this._onceListeners.has(event)) {
            count += this._onceListeners.get(event).size;
        }
        return count;
    }
    
    /**
     * 모든 리스너 제거
     */
    removeAllListeners() {
        this._listeners.clear();
        this._onceListeners.clear();
        this._log('🧹 모든 리스너 제거됨');
    }
    
    // =========================================================================
    // 🆕 v1.1.0: EventEmitter 패턴 - Private 헬퍼
    // =========================================================================
    
    /**
     * 내부 리스너들에게 이벤트 알림
     * 
     * @private
     * @param {string} event - 이벤트 이름
     * @param {Object} data - 이벤트 데이터
     */
    _notifyListeners(event, data) {
        // 일반 리스너 호출
        if (this._listeners.has(event)) {
            this._listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[IDataLoader] Listener error for "${event}":`, e);
                }
            });
        }
        
        // once 리스너 호출 후 제거
        if (this._onceListeners.has(event)) {
            const callbacks = this._onceListeners.get(event);
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[IDataLoader] Once listener error for "${event}":`, e);
                }
            });
            this._onceListeners.delete(event);
        }
    }
    
    /**
     * once 리스너 제거 (내부용)
     * 
     * @private
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    _removeOnceListener(event, callback) {
        if (this._onceListeners.has(event)) {
            this._onceListeners.get(event).delete(callback);
        }
    }
    
    /**
     * AbortController 생성
     * 
     * @protected
     * @returns {AbortController} 새로운 AbortController
     */
    _createAbortController() {
        // 기존 컨트롤러 취소
        if (this._abortController) {
            this._abortController.abort();
        }
        
        this._abortController = new AbortController();
        return this._abortController;
    }
    
    /**
     * 타임아웃과 함께 Promise 실행
     * 
     * @protected
     * @param {Promise} promise - 실행할 Promise
     * @param {number} [timeout] - 타임아웃 (ms), 기본값은 config.timeout
     * @returns {Promise} 결과 또는 타임아웃 에러
     */
    async _withTimeout(promise, timeout) {
        const timeoutMs = timeout ?? this._config.timeout;
        
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`타임아웃: ${timeoutMs}ms 초과`));
                }, timeoutMs);
            })
        ]);
    }
    
    /**
     * 재시도와 함께 함수 실행
     * 
     * @protected
     * @param {Function} fn - 실행할 비동기 함수
     * @param {number} [retryCount] - 재시도 횟수, 기본값은 config.retryCount
     * @param {number} [retryDelay] - 재시도 간격, 기본값은 config.retryDelay
     * @returns {Promise} 결과
     */
    async _withRetry(fn, retryCount, retryDelay) {
        const maxRetries = retryCount ?? this._config.retryCount;
        const delay = retryDelay ?? this._config.retryDelay;
        
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                this._log(`⚠️ 시도 ${attempt}/${maxRetries} 실패: ${error.message}`);
                
                if (attempt < maxRetries) {
                    await this._delay(delay);
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * 지연 유틸리티
     * 
     * @protected
     * @param {number} ms - 지연 시간 (ms)
     * @returns {Promise<void>}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 디버그 로깅
     * 
     * @protected
     * @param {...any} args - 로그 인자
     */
    _log(...args) {
        if (this._config.debug) {
            console.log(`[${this.constructor.name}]`, ...args);
        }
    }
    
    // =========================================================================
    // Public Getters
    // =========================================================================
    
    /**
     * 로더 타입 반환
     * @returns {string} LoaderType 값
     */
    get type() {
        return this._type;
    }
    
    /**
     * 현재 상태 반환
     * @returns {LoaderState} 현재 상태
     */
    get state() {
        return this._state;
    }
    
    /**
     * 초기화 완료 여부
     * @returns {boolean}
     */
    get isInitialized() {
        return this._isInitialized;
    }
    
    /**
     * 로딩 중 여부
     * @returns {boolean}
     */
    get isLoading() {
        return this._isLoading || this._state === LoaderState.LOADING;
    }
    
    /**
     * 정리 완료 여부
     * @returns {boolean}
     */
    get isDisposed() {
        return this._isDisposed;
    }
    
    /**
     * 준비 완료 여부
     * @returns {boolean}
     */
    get isReady() {
        return this._isInitialized && !this._isDisposed && this._state !== LoaderState.ERROR;
    }
    
    /**
     * 마지막 에러 반환
     * @returns {Error|null}
     */
    get lastError() {
        return this._lastError;
    }
    
    /**
     * 로드 횟수 반환
     * @returns {number}
     */
    get loadCount() {
        return this._loadCount;
    }
    
    // =========================================================================
    // Public Setters
    // =========================================================================
    
    /**
     * EventBus 설정
     * @param {Object} eventBus - EventBus 인스턴스
     */
    setEventBus(eventBus) {
        this._eventBus = eventBus;
    }
    
    /**
     * 설정 업데이트
     * @param {Object} config - 업데이트할 설정
     */
    configure(config) {
        this._config = { ...this._config, ...config };
        this._log('⚙️ 설정 업데이트:', this._config);
    }
    
    // =========================================================================
    // Static 메서드
    // =========================================================================
    
    /**
     * 버전 정보 반환
     * @static
     * @returns {string}
     */
    static get VERSION() {
        return '1.1.0';
    }
    
    /**
     * LoaderState 상수 반환
     * @static
     * @returns {Object}
     */
    static get LoaderState() {
        return LoaderState;
    }
    
    /**
     * LoaderEvents 상수 반환
     * @static
     * @returns {Object}
     */
    static get LoaderEvents() {
        return LoaderEvents;
    }
    
    /**
     * LoaderType 상수 반환
     * @static
     * @returns {Object}
     */
    static get LoaderType() {
        return LoaderType;
    }
}

// ============================================================================
// 기본 내보내기
// ============================================================================

export default IDataLoader;