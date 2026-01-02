/**
 * BaseComponent.js
 * 모든 UI 컴포넌트의 기본 클래스
 * 
 * @version 1.0.0
 * @description 공통 라이프사이클 및 유틸리티 제공
 */

import { eventBus } from '../managers/EventBus.js';
import { logger } from '../managers/Logger.js';

/**
 * 고유 ID 생성기
 */
let componentIdCounter = 0;
function generateComponentId(prefix = 'component') {
    return `${prefix}-${++componentIdCounter}`;
}

/**
 * BaseComponent
 * 모든 UI 컴포넌트가 상속받는 기본 클래스
 */
export class BaseComponent {
    /**
     * @param {Object} options - 컴포넌트 옵션
     * @param {HTMLElement} options.container - 컨테이너 요소
     * @param {string} options.id - 컴포넌트 ID (선택)
     * @param {string} options.className - CSS 클래스명 (선택)
     */
    constructor(options = {}) {
        this.id = options.id || generateComponentId(this.constructor.name);
        this.container = options.container || null;
        this.className = options.className || '';
        
        // 상태
        this._mounted = false;
        this._destroyed = false;
        
        // 요소 참조
        this.element = null;
        
        // 이벤트 구독 해제 함수들
        this._subscriptions = [];
        
        // DOM 이벤트 리스너 참조 (cleanup용)
        this._domListeners = [];
        
        // 로거
        this._logger = logger.child(this.constructor.name);
    }
    
    // =========================================================
    // 라이프사이클 메서드 (자식 클래스에서 오버라이드)
    // =========================================================
    
    /**
     * 컴포넌트 렌더링 (필수 오버라이드)
     * @returns {string|HTMLElement} HTML 문자열 또는 요소
     */
    render() {
        throw new Error('render() must be implemented by subclass');
    }
    
    /**
     * 마운트 후 호출 (이벤트 리스너 등록 등)
     */
    onMount() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 언마운트 전 호출 (정리 작업)
     */
    onUnmount() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 업데이트 시 호출
     * @param {Object} prevProps - 이전 속성
     */
    onUpdate(prevProps) {
        // 자식 클래스에서 오버라이드
    }
    
    // =========================================================
    // 핵심 메서드
    // =========================================================
    
    /**
     * 컴포넌트 마운트
     * @param {HTMLElement} container - 마운트할 컨테이너 (선택)
     * @returns {BaseComponent} this
     */
    mount(container = null) {
        if (this._mounted) {
            this._logger.warn('이미 마운트됨');
            return this;
        }
        
        if (container) {
            this.container = container;
        }
        
        if (!this.container) {
            this._logger.error('컨테이너가 지정되지 않음');
            return this;
        }
        
        // 렌더링
        const content = this.render();
        
        if (typeof content === 'string') {
            this.container.innerHTML = content;
            this.element = this.container.firstElementChild;
        } else if (content instanceof HTMLElement) {
            this.container.innerHTML = '';
            this.container.appendChild(content);
            this.element = content;
        }
        
        // ID 및 클래스 적용
        if (this.element) {
            this.element.id = this.id;
            if (this.className) {
                this.element.classList.add(...this.className.split(' '));
            }
        }
        
        this._mounted = true;
        
        // 마운트 콜백
        this.onMount();
        
        this._logger.debug('마운트 완료');
        return this;
    }
    
    /**
     * 컴포넌트 언마운트
     * @returns {BaseComponent} this
     */
    unmount() {
        if (!this._mounted) {
            return this;
        }
        
        // 언마운트 콜백
        this.onUnmount();
        
        // 이벤트 구독 해제
        this._cleanupSubscriptions();
        
        // DOM 이벤트 리스너 제거
        this._cleanupDomListeners();
        
        // DOM에서 제거
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this._mounted = false;
        
        this._logger.debug('언마운트 완료');
        return this;
    }
    
    /**
     * 컴포넌트 파괴
     */
    destroy() {
        if (this._destroyed) {
            return;
        }
        
        this.unmount();
        
        // 참조 정리
        this.container = null;
        this.element = null;
        this._subscriptions = [];
        this._domListeners = [];
        
        this._destroyed = true;
        
        this._logger.debug('파괴 완료');
    }
    
    /**
     * 컴포넌트 업데이트 (리렌더링)
     * @param {Object} newProps - 새 속성
     */
    update(newProps = {}) {
        if (!this._mounted) {
            this._logger.warn('마운트되지 않은 상태에서 업데이트 시도');
            return;
        }
        
        const prevProps = { ...this.props };
        Object.assign(this, newProps);
        
        // 기존 이벤트 정리
        this._cleanupDomListeners();
        
        // 리렌더링
        const content = this.render();
        
        if (typeof content === 'string') {
            this.container.innerHTML = content;
            this.element = this.container.firstElementChild;
        } else if (content instanceof HTMLElement) {
            this.container.innerHTML = '';
            this.container.appendChild(content);
            this.element = content;
        }
        
        // 업데이트 콜백
        this.onUpdate(prevProps);
        
        // 이벤트 리스너 재등록
        this.onMount();
        
        this._logger.debug('업데이트 완료');
    }
    
    // =========================================================
    // 유틸리티 메서드
    // =========================================================
    
    /**
     * 이벤트 버스 구독 (자동 정리)
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백
     * @returns {Function} 구독 해제 함수
     */
    subscribe(event, callback) {
        const unsubscribe = eventBus.on(event, callback, this);
        this._subscriptions.push(unsubscribe);
        return unsubscribe;
    }
    
    /**
     * 이벤트 발생
     * @param {string} event - 이벤트 이름
     * @param {*} data - 데이터
     */
    emit(event, data) {
        eventBus.emit(event, data);
    }
    
    /**
     * DOM 이벤트 리스너 추가 (자동 정리)
     * @param {HTMLElement} element - 대상 요소
     * @param {string} type - 이벤트 타입
     * @param {Function} handler - 핸들러
     * @param {Object} options - 옵션
     */
    addDomListener(element, type, handler, options = {}) {
        const boundHandler = handler.bind(this);
        element.addEventListener(type, boundHandler, options);
        
        this._domListeners.push({
            element,
            type,
            handler: boundHandler,
            options
        });
    }
    
    /**
     * 요소 쿼리 (this.element 기준)
     * @param {string} selector - CSS 선택자
     * @returns {HTMLElement|null}
     */
    $(selector) {
        return this.element?.querySelector(selector) || null;
    }
    
    /**
     * 요소 쿼리 (다중)
     * @param {string} selector - CSS 선택자
     * @returns {NodeList}
     */
    $$(selector) {
        return this.element?.querySelectorAll(selector) || [];
    }
    
    /**
     * 표시
     */
    show() {
        if (this.element) {
            this.element.style.display = '';
        }
    }
    
    /**
     * 숨기기
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
    
    /**
     * 표시 토글
     * @returns {boolean} 현재 표시 상태
     */
    toggle() {
        if (this.element) {
            const isHidden = this.element.style.display === 'none';
            this.element.style.display = isHidden ? '' : 'none';
            return isHidden;
        }
        return false;
    }
    
    /**
     * CSS 클래스 추가
     * @param {...string} classes
     */
    addClass(...classes) {
        if (this.element) {
            this.element.classList.add(...classes);
        }
    }
    
    /**
     * CSS 클래스 제거
     * @param {...string} classes
     */
    removeClass(...classes) {
        if (this.element) {
            this.element.classList.remove(...classes);
        }
    }
    
    /**
     * CSS 클래스 토글
     * @param {string} className
     * @param {boolean} force
     * @returns {boolean}
     */
    toggleClass(className, force) {
        if (this.element) {
            return this.element.classList.toggle(className, force);
        }
        return false;
    }
    
    // =========================================================
    // 정리 메서드 (내부)
    // =========================================================
    
    /**
     * 이벤트 버스 구독 정리
     */
    _cleanupSubscriptions() {
        this._subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (e) {
                // 무시
            }
        });
        this._subscriptions = [];
    }
    
    /**
     * DOM 이벤트 리스너 정리
     */
    _cleanupDomListeners() {
        this._domListeners.forEach(({ element, type, handler, options }) => {
            try {
                element.removeEventListener(type, handler, options);
            } catch (e) {
                // 무시
            }
        });
        this._domListeners = [];
    }
    
    // =========================================================
    // 상태 확인
    // =========================================================
    
    /**
     * 마운트 여부
     * @returns {boolean}
     */
    isMounted() {
        return this._mounted;
    }
    
    /**
     * 파괴 여부
     * @returns {boolean}
     */
    isDestroyed() {
        return this._destroyed;
    }
}

export default BaseComponent;