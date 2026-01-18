/**
 * BaseView.js
 * ===========
 * View 공통 인터페이스 및 생명주기 관리 추상 클래스
 * 
 * @version 1.0.0
 * @description
 * - View 공통 인터페이스 정의 (show, hide, toggle, dispose)
 * - 중복 코드 제거 (상태 관리, 이벤트 처리)
 * - 일관된 생명주기 관리 (초기화 → 활성화 → 비활성화 → 정리)
 * - BEM CSS 클래스 패턴 표준화
 * - 의존성 주입 (DI) 지원
 * 
 * @changelog
 * - v1.0.0: 초기 구현
 *   - BaseView 추상 클래스 정의
 *   - 공통 CSS 클래스 상수 (BASE_CSS)
 *   - 생명주기 메서드 (show, hide, toggle, dispose)
 *   - 훅 메서드 (_onInit, _onShow, _onHide, _beforeDestroy)
 *   - 상태 관리 (setLoading, setEmpty, setError)
 *   - 이벤트 구독 관리 (_eventSubscriptions)
 *   - 디버그 유틸리티 (debug, getStatus)
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * 
 * @exports
 * - BaseView
 * - VIEW_STATE (상태 상수)
 * 
 * @usage
 * ```javascript
 * import { BaseView } from './common/BaseView.js';
 * 
 * class MyView extends BaseView {
 *     static CSS = {
 *         ...BaseView.BASE_CSS,
 *         BLOCK: 'my-view',
 *         CUSTOM_ELEMENT: 'my-view__custom'
 *     };
 * 
 *     constructor(options) {
 *         super({
 *             id: 'my-view',
 *             cssPrefix: 'my-view',
 *             ...options
 *         });
 *     }
 * 
 *     _createDOM() {
 *         // 필수: DOM 생성 로직 구현
 *         this.element = document.createElement('div');
 *         this.element.classList.add(MyView.CSS.BLOCK);
 *         this._container.appendChild(this.element);
 *     }
 * }
 * ```
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/common/BaseView.js
 * 작성일: 2026-01-18
 * 수정일: 2026-01-18
 */

import { eventBus as globalEventBus } from '../../core/managers/EventBus.js';

// ═══════════════════════════════════════════════════════════════════════════
// 상수 정의
// ═══════════════════════════════════════════════════════════════════════════

/**
 * View 상태 상수
 * @readonly
 * @enum {string}
 */
export const VIEW_STATE = Object.freeze({
    /** 초기화되지 않음 */
    UNINITIALIZED: 'uninitialized',
    /** 초기화됨 (숨김 상태) */
    INITIALIZED: 'initialized',
    /** 표시 중 */
    VISIBLE: 'visible',
    /** 숨김 */
    HIDDEN: 'hidden',
    /** 로딩 중 */
    LOADING: 'loading',
    /** 빈 상태 */
    EMPTY: 'empty',
    /** 에러 상태 */
    ERROR: 'error',
    /** 정리됨 */
    DISPOSED: 'disposed'
});

// ═══════════════════════════════════════════════════════════════════════════
// BaseView 추상 클래스
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BaseView 추상 클래스
 * 
 * 모든 View 컴포넌트의 기본 클래스로, 공통 인터페이스와 
 * 생명주기 관리를 제공합니다.
 * 
 * @abstract
 * @class BaseView
 */
export class BaseView {
    
    // ═══════════════════════════════════════════════════════════════════
    // 정적 상수
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 버전 정보
     * @static
     * @readonly
     */
    static VERSION = '1.0.0';
    
    /**
     * 기본 CSS 클래스 상수 (자식 클래스에서 확장)
     * @static
     * @readonly
     */
    static BASE_CSS = Object.freeze({
        // Modifiers (공통)
        HIDDEN: '--hidden',
        VISIBLE: '--visible',
        ACTIVE: '--active',
        LOADING: '--loading',
        EMPTY: '--empty',
        ERROR: '--error',
        FOCUSED: '--focused',
        DISABLED: '--disabled',
        
        // Legacy alias (하위 호환)
        LEGACY_HIDDEN: 'hidden',
        LEGACY_ACTIVE: 'active',
        LEGACY_LOADING: 'loading',
        LEGACY_EMPTY: 'empty',
        LEGACY_ERROR: 'error'
    });
    
    /**
     * 기본 Utility 클래스 상수
     * @static
     * @readonly
     */
    static UTIL = Object.freeze({
        FLEX: 'u-flex',
        FLEX_COL: 'u-flex-col',
        FLEX_CENTER: 'u-flex-center',
        GAP_1: 'u-gap-1',
        GAP_2: 'u-gap-2',
        GAP_4: 'u-gap-4',
        HIDDEN: 'u-hidden',
        GLASS: 'u-glass'
    });
    
    // ═══════════════════════════════════════════════════════════════════
    // 생성자
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * BaseView 생성자
     * 
     * @param {Object} options - 설정 옵션
     * @param {string} options.id - View 고유 식별자
     * @param {string} [options.cssPrefix] - CSS 클래스 접두사 (기본: id)
     * @param {HTMLElement} [options.container] - 부모 컨테이너 (기본: document.body)
     * @param {Object} [options.eventBus] - EventBus 인스턴스 (기본: 전역 eventBus)
     * @param {boolean} [options.autoInit] - 자동 초기화 여부 (기본: true)
     * @param {boolean} [options.debug] - 디버그 모드 (기본: false)
     */
    constructor(options = {}) {
        // 추상 클래스 직접 인스턴스화 방지
        if (new.target === BaseView) {
            throw new Error('BaseView는 추상 클래스입니다. 직접 인스턴스화할 수 없습니다.');
        }
        
        // 필수 옵션 검증
        if (!options.id) {
            throw new Error('BaseView: options.id는 필수입니다.');
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 기본 속성 초기화
        // ═══════════════════════════════════════════════════════════════
        
        /** @type {string} View 고유 식별자 */
        this.id = options.id;
        
        /** @type {string} CSS 클래스 접두사 */
        this._cssPrefix = options.cssPrefix || options.id;
        
        /** @type {HTMLElement} 부모 컨테이너 */
        this._container = options.container || document.body;
        
        /** @type {Object} EventBus 인스턴스 */
        this._eventBus = options.eventBus || globalEventBus;
        
        /** @type {boolean} 디버그 모드 */
        this._debug = options.debug || false;
        
        // ═══════════════════════════════════════════════════════════════
        // 상태 관리
        // ═══════════════════════════════════════════════════════════════
        
        /** @type {string} 현재 상태 */
        this._state = VIEW_STATE.UNINITIALIZED;
        
        /** @type {boolean} 표시 여부 */
        this._isVisible = false;
        
        /** @type {boolean} 초기화 여부 */
        this._isInitialized = false;
        
        /** @type {boolean} 로딩 중 여부 */
        this._isLoading = false;
        
        /** @type {boolean} 빈 상태 여부 */
        this._isEmpty = false;
        
        /** @type {boolean} 에러 상태 여부 */
        this._hasError = false;
        
        /** @type {string|null} 에러 메시지 */
        this._errorMessage = null;
        
        // ═══════════════════════════════════════════════════════════════
        // DOM 참조
        // ═══════════════════════════════════════════════════════════════
        
        /** @type {HTMLElement|null} 메인 요소 */
        this.element = null;
        
        /** @type {HTMLElement|null} 로딩 요소 */
        this._loadingElement = null;
        
        /** @type {HTMLElement|null} 빈 상태 요소 */
        this._emptyElement = null;
        
        /** @type {HTMLElement|null} 에러 요소 */
        this._errorElement = null;
        
        // ═══════════════════════════════════════════════════════════════
        // 이벤트 관리
        // ═══════════════════════════════════════════════════════════════
        
        /** @type {Object} 바인딩된 이벤트 핸들러 */
        this._boundHandlers = {};
        
        /** @type {Array<Function>} EventBus 구독 해제 함수 배열 */
        this._eventSubscriptions = [];
        
        // ═══════════════════════════════════════════════════════════════
        // 자동 초기화
        // ═══════════════════════════════════════════════════════════════
        
        if (options.autoInit !== false) {
            this._init();
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 생명주기 메서드 (Lifecycle)
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 초기화 (내부용)
     * @protected
     */
    _init() {
        if (this._isInitialized) {
            this._log('⚠️ 이미 초기화됨');
            return;
        }
        
        this._log(`🚀 초기화 시작 (v${BaseView.VERSION})...`);
        
        try {
            // 1. DOM 생성 (추상 메서드)
            this._createDOM();
            
            // 2. 공통 DOM 요소 생성 (선택적)
            this._createCommonElements();
            
            // 3. 이벤트 리스너 설정
            this._setupEventListeners();
            
            // 4. 초기화 훅 호출
            this._onInit();
            
            // 5. 상태 업데이트
            this._isInitialized = true;
            this._state = VIEW_STATE.INITIALIZED;
            
            // 6. 초기화 완료 이벤트
            this._emitEvent('initialized', { id: this.id });
            
            this._log('✅ 초기화 완료');
            
        } catch (error) {
            this._log(`❌ 초기화 실패: ${error.message}`);
            this._state = VIEW_STATE.ERROR;
            this._hasError = true;
            this._errorMessage = error.message;
            throw error;
        }
    }
    
    /**
     * View 표시
     * @param {Object} [options] - 표시 옵션
     * @returns {BaseView} this (체이닝용)
     */
    show(options = {}) {
        if (!this._isInitialized) {
            this._log('⚠️ 초기화되지 않음 - 먼저 초기화 필요');
            return this;
        }
        
        if (this._isVisible) {
            this._log('⚠️ 이미 표시 중');
            return this;
        }
        
        this._log('👁️ show()');
        
        // 1. beforeShow 훅 (취소 가능)
        if (this._beforeShow(options) === false) {
            this._log('⚠️ beforeShow에서 취소됨');
            return this;
        }
        
        // 2. CSS 클래스 변경
        this._applyVisibleState(true);
        
        // 3. 상태 업데이트
        this._isVisible = true;
        this._state = VIEW_STATE.VISIBLE;
        
        // 4. afterShow 훅
        this._onShow(options);
        
        // 5. 이벤트 발행
        this._emitEvent('shown', { id: this.id, options });
        
        this._log('✅ 표시됨');
        
        return this;
    }
    
    /**
     * View 숨김
     * @param {Object} [options] - 숨김 옵션
     * @returns {BaseView} this (체이닝용)
     */
    hide(options = {}) {
        if (!this._isVisible) {
            this._log('⚠️ 이미 숨김 상태');
            return this;
        }
        
        this._log('🙈 hide()');
        
        // 1. beforeHide 훅 (취소 가능)
        if (this._beforeHide(options) === false) {
            this._log('⚠️ beforeHide에서 취소됨');
            return this;
        }
        
        // 2. CSS 클래스 변경
        this._applyVisibleState(false);
        
        // 3. 상태 업데이트
        this._isVisible = false;
        this._state = VIEW_STATE.HIDDEN;
        
        // 4. afterHide 훅
        this._onHide(options);
        
        // 5. 이벤트 발행
        this._emitEvent('hidden', { id: this.id, options });
        
        this._log('✅ 숨겨짐');
        
        return this;
    }
    
    /**
     * View 표시/숨김 토글
     * @param {Object} [options] - 옵션
     * @returns {boolean} 토글 후 표시 상태
     */
    toggle(options = {}) {
        if (this._isVisible) {
            this.hide(options);
            return false;
        } else {
            this.show(options);
            return true;
        }
    }
    
    /**
     * 리소스 정리 및 제거
     */
    dispose() {
        if (this._state === VIEW_STATE.DISPOSED) {
            this._log('⚠️ 이미 정리됨');
            return;
        }
        
        this._log('🗑️ dispose() - 정리 시작...');
        
        // 1. beforeDestroy 훅
        this._beforeDestroy();
        
        // 2. EventBus 구독 해제
        this._eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventSubscriptions = [];
        
        // 3. DOM 이벤트 리스너 제거
        this._removeEventListeners();
        
        // 4. DOM 요소 제거
        this.element?.remove();
        
        // 5. 참조 해제
        this.element = null;
        this._loadingElement = null;
        this._emptyElement = null;
        this._errorElement = null;
        this._boundHandlers = {};
        
        // 6. 상태 업데이트
        this._state = VIEW_STATE.DISPOSED;
        this._isInitialized = false;
        this._isVisible = false;
        
        // 7. 이벤트 발행
        this._emitEvent('disposed', { id: this.id });
        
        this._log('✅ dispose 완료');
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 추상 메서드 (자식 클래스에서 반드시 구현)
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * DOM 구조 생성 (추상 메서드)
     * 
     * 자식 클래스에서 반드시 구현해야 합니다.
     * this.element를 생성하고 this._container에 추가해야 합니다.
     * 
     * @abstract
     * @protected
     * @throws {Error} 구현되지 않은 경우
     * 
     * @example
     * _createDOM() {
     *     this.element = document.createElement('div');
     *     this.element.classList.add(MyView.CSS.BLOCK);
     *     this.element.classList.add(MyView.CSS.HIDDEN);
     *     this._container.appendChild(this.element);
     * }
     */
    _createDOM() {
        throw new Error('_createDOM()은 자식 클래스에서 반드시 구현해야 합니다.');
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 훅 메서드 (자식 클래스에서 선택적 오버라이드)
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 초기화 완료 훅
     * @protected
     */
    _onInit() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 표시 전 훅 (false 반환 시 취소)
     * @protected
     * @param {Object} options - 표시 옵션
     * @returns {boolean|void} false 반환 시 show() 취소
     */
    _beforeShow(options) {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 표시 후 훅
     * @protected
     * @param {Object} options - 표시 옵션
     */
    _onShow(options) {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 숨김 전 훅 (false 반환 시 취소)
     * @protected
     * @param {Object} options - 숨김 옵션
     * @returns {boolean|void} false 반환 시 hide() 취소
     */
    _beforeHide(options) {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 숨김 후 훅
     * @protected
     * @param {Object} options - 숨김 옵션
     */
    _onHide(options) {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 정리 전 훅
     * @protected
     */
    _beforeDestroy() {
        // 자식 클래스에서 오버라이드
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 상태 관리 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 로딩 상태 설정
     * @param {boolean} isLoading - 로딩 여부
     * @param {string} [message] - 로딩 메시지
     * @returns {BaseView} this (체이닝용)
     */
    setLoading(isLoading, message = null) {
        this._log(`⏳ setLoading(${isLoading})`);
        
        this._isLoading = isLoading;
        
        if (this.element) {
            const loadingClass = this._getCSSClass('LOADING');
            const legacyClass = BaseView.BASE_CSS.LEGACY_LOADING;
            
            if (isLoading) {
                this.element.classList.add(loadingClass);
                this.element.classList.add(legacyClass);
                if (this._loadingElement && message) {
                    const textEl = this._loadingElement.querySelector('[data-loading-text]');
                    if (textEl) textEl.textContent = message;
                }
            } else {
                this.element.classList.remove(loadingClass);
                this.element.classList.remove(legacyClass);
            }
        }
        
        if (isLoading) {
            this._state = VIEW_STATE.LOADING;
        } else if (this._isVisible) {
            this._state = VIEW_STATE.VISIBLE;
        }
        
        return this;
    }
    
    /**
     * 빈 상태 설정
     * @param {boolean} isEmpty - 빈 상태 여부
     * @param {string} [message] - 빈 상태 메시지
     * @returns {BaseView} this (체이닝용)
     */
    setEmpty(isEmpty, message = null) {
        this._log(`📭 setEmpty(${isEmpty})`);
        
        this._isEmpty = isEmpty;
        
        if (this.element) {
            const emptyClass = this._getCSSClass('EMPTY');
            const legacyClass = BaseView.BASE_CSS.LEGACY_EMPTY;
            
            if (isEmpty) {
                this.element.classList.add(emptyClass);
                this.element.classList.add(legacyClass);
                if (this._emptyElement && message) {
                    const textEl = this._emptyElement.querySelector('[data-empty-message]');
                    if (textEl) textEl.textContent = message;
                }
            } else {
                this.element.classList.remove(emptyClass);
                this.element.classList.remove(legacyClass);
            }
        }
        
        if (isEmpty) {
            this._state = VIEW_STATE.EMPTY;
        } else if (this._isVisible) {
            this._state = VIEW_STATE.VISIBLE;
        }
        
        return this;
    }
    
    /**
     * 에러 상태 설정
     * @param {boolean} hasError - 에러 여부
     * @param {string} [message] - 에러 메시지
     * @returns {BaseView} this (체이닝용)
     */
    setError(hasError, message = null) {
        this._log(`❌ setError(${hasError}): ${message || ''}`);
        
        this._hasError = hasError;
        this._errorMessage = message;
        
        if (this.element) {
            const errorClass = this._getCSSClass('ERROR');
            const legacyClass = BaseView.BASE_CSS.LEGACY_ERROR;
            
            if (hasError) {
                this.element.classList.add(errorClass);
                this.element.classList.add(legacyClass);
                if (this._errorElement && message) {
                    const textEl = this._errorElement.querySelector('[data-error-message]');
                    if (textEl) textEl.textContent = message;
                }
            } else {
                this.element.classList.remove(errorClass);
                this.element.classList.remove(legacyClass);
            }
        }
        
        if (hasError) {
            this._state = VIEW_STATE.ERROR;
        } else if (this._isVisible) {
            this._state = VIEW_STATE.VISIBLE;
        }
        
        return this;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // Getter 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /** @returns {boolean} 표시 여부 */
    get isVisible() { return this._isVisible; }
    
    /** @returns {boolean} 초기화 여부 */
    get isInitialized() { return this._isInitialized; }
    
    /** @returns {boolean} 로딩 중 여부 */
    get isLoading() { return this._isLoading; }
    
    /** @returns {boolean} 빈 상태 여부 */
    get isEmpty() { return this._isEmpty; }
    
    /** @returns {boolean} 에러 상태 여부 */
    get hasError() { return this._hasError; }
    
    /** @returns {string|null} 에러 메시지 */
    get errorMessage() { return this._errorMessage; }
    
    /** @returns {string} 현재 상태 */
    get state() { return this._state; }
    
    /** @returns {HTMLElement} 컨테이너 */
    get container() { return this._container; }
    
    // ═══════════════════════════════════════════════════════════════════
    // 이벤트 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 이벤트 리스너 설정 (자식 클래스에서 오버라이드)
     * @protected
     */
    _setupEventListeners() {
        // 자식 클래스에서 오버라이드
        // this._boundHandlers 사용 권장
    }
    
    /**
     * 이벤트 리스너 제거
     * @protected
     */
    _removeEventListeners() {
        // 자식 클래스에서 오버라이드
        // this._boundHandlers 정리
        this._boundHandlers = {};
    }
    
    /**
     * EventBus 구독 추가 (자동 정리됨)
     * @protected
     * @param {string} eventName - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    _subscribe(eventName, handler) {
        if (this._eventBus) {
            const unsubscribe = this._eventBus.on(eventName, handler);
            this._eventSubscriptions.push(unsubscribe);
        }
    }
    
    /**
     * 이벤트 발행
     * @protected
     * @param {string} eventName - 이벤트 이름 (view:{id}:{eventName} 형식)
     * @param {Object} data - 이벤트 데이터
     */
    _emitEvent(eventName, data = {}) {
        if (this._eventBus) {
            this._eventBus.emit(`view:${this.id}:${eventName}`, data);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 헬퍼 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 공통 DOM 요소 생성 (Loading, Empty, Error)
     * @protected
     */
    _createCommonElements() {
        // 자식 클래스에서 필요시 호출
        // 기본 구현은 비어있음
    }
    
    /**
     * 가시성 CSS 클래스 적용
     * @protected
     * @param {boolean} visible - 표시 여부
     */
    _applyVisibleState(visible) {
        if (!this.element) return;
        
        const hiddenClass = this._getCSSClass('HIDDEN');
        const activeClass = this._getCSSClass('ACTIVE');
        const legacyHidden = BaseView.BASE_CSS.LEGACY_HIDDEN;
        const legacyActive = BaseView.BASE_CSS.LEGACY_ACTIVE;
        
        if (visible) {
            this.element.classList.remove(hiddenClass);
            this.element.classList.remove(legacyHidden);
            this.element.classList.add(activeClass);
            this.element.classList.add(legacyActive);
        } else {
            this.element.classList.add(hiddenClass);
            this.element.classList.add(legacyHidden);
            this.element.classList.remove(activeClass);
            this.element.classList.remove(legacyActive);
        }
    }
    
    /**
     * CSS 클래스 이름 생성
     * @protected
     * @param {string} modifier - 수정자 이름 (HIDDEN, ACTIVE 등)
     * @returns {string} 완성된 CSS 클래스
     */
    _getCSSClass(modifier) {
        const suffix = BaseView.BASE_CSS[modifier] || `--${modifier.toLowerCase()}`;
        return `${this._cssPrefix}${suffix}`;
    }
    
    /**
     * 로그 출력 (디버그 모드에서만)
     * @protected
     * @param {string} message - 로그 메시지
     */
    _log(message) {
        if (this._debug || this.constructor._DEBUG) {
            console.log(`[${this.constructor.name}] ${message}`);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 디버그 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group(`[${this.constructor.name}] Debug Info (v${BaseView.VERSION})`);
        console.log('id:', this.id);
        console.log('state:', this._state);
        console.log('isVisible:', this._isVisible);
        console.log('isInitialized:', this._isInitialized);
        console.log('isLoading:', this._isLoading);
        console.log('isEmpty:', this._isEmpty);
        console.log('hasError:', this._hasError);
        console.log('errorMessage:', this._errorMessage);
        console.log('element:', this.element);
        console.log('container:', this._container);
        console.log('eventSubscriptions:', this._eventSubscriptions.length);
        console.log('boundHandlers:', Object.keys(this._boundHandlers));
        console.groupEnd();
    }
    
    /**
     * 상태 요약 객체 반환
     * @returns {Object} 상태 요약
     */
    getStatus() {
        return {
            id: this.id,
            version: BaseView.VERSION,
            state: this._state,
            isVisible: this._isVisible,
            isInitialized: this._isInitialized,
            isLoading: this._isLoading,
            isEmpty: this._isEmpty,
            hasError: this._hasError,
            errorMessage: this._errorMessage,
            hasElement: !!this.element,
            subscriptionCount: this._eventSubscriptions.length
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 전역 노출 (디버깅용)
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
    window.BaseView = BaseView;
    window.VIEW_STATE = VIEW_STATE;
}