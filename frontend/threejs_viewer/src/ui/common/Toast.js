/**
 * Toast.js
 * Toast 알림 컴포넌트
 * 
 * @version 3.1.0
 * @description 
 *   - BaseComponent 상속
 *   - 인라인 스타일 제거 → CSS 클래스 기반
 *   - 라이트 테마 적용 (_toast.css 연동)
 * 
 * @changelog
 * - v3.1.0: 🐛 Toast 자동 사라짐 버그 수정 (2026-01-11)
 *           - remove() 메서드에서 강제 DOM 제거 로직 추가
 *           - transitionend 이벤트 의존성 제거
 *           - 디버깅 로그 추가
 * - v3.0.0: 인라인 스타일 완전 제거, CSS 클래스 기반으로 전환 (2026-01-06)
 * - v2.1.0: mount() 오버라이드 - innerHTML 대신 appendChild 사용 (DOM 파괴 방지)
 * - v2.0.0: BaseComponent 상속, 통합 Toast 시스템
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';

/**
 * Toast 타입별 설정
 * 색상은 CSS에서 처리, 여기서는 아이콘과 기본 duration만 정의
 */
const TOAST_CONFIG = {
    success: {
        icon: '✅',
        defaultDuration: 3000
    },
    error: {
        icon: '❌',
        defaultDuration: 5000
    },
    warning: {
        icon: '⚠️',
        defaultDuration: 4000
    },
    info: {
        icon: 'ℹ️',
        defaultDuration: 3000
    }
};

/**
 * Toast 컴포넌트
 */
export class Toast extends BaseComponent {
    constructor(options = {}) {
        super({
            ...options,
            id: options.id || 'toast-container',
            className: 'toast-container'
        });
        
        // Toast 큐
        this._toasts = new Map();
        this._toastIdCounter = 0;
        
        // 설정
        this._maxToasts = options.maxToasts || 5;
        this._showProgress = options.showProgress ?? true;
        
        // 컨테이너가 없으면 body에 마운트
        if (!this.container) {
            this.container = document.body;
        }
    }
    
    /**
     * 렌더링
     */
    render() {
        return `<div class="toast-container" id="${this.id}"></div>`;
    }
    
    /**
     * 마운트 오버라이드 - innerHTML 대신 appendChild 사용
     * @param {HTMLElement} container - 마운트할 컨테이너 (선택)
     * @returns {Toast} this
     */
    mount(container = null) {
        if (this._mounted) {
            return this;
        }
        
        if (container) {
            this.container = container;
        }
        
        if (!this.container) {
            console.error('[Toast] 컨테이너가 지정되지 않음');
            return this;
        }
        
        // 기존 요소 확인 또는 새로 생성
        let existingElement = document.getElementById(this.id);
        
        if (existingElement) {
            // 기존 요소가 있으면 재사용
            this.element = existingElement;
        } else {
            // 새 요소 생성 (innerHTML 대신 createElement 사용)
            this.element = document.createElement('div');
            this.element.id = this.id;
            this.element.className = 'toast-container';
            
            // appendChild 사용 - 기존 DOM 보존
            this.container.appendChild(this.element);
        }
        
        this._mounted = true;
        
        // 마운트 콜백
        this.onMount();
        
        return this;
    }
    
    /**
     * 마운트 후 처리
     * 스타일은 CSS에서 처리하므로 여기서는 아무것도 안 함
     */
    onMount() {
        // CSS에서 모든 스타일 처리
        // this.element에 추가 설정 필요 없음
    }
    
    /**
     * Toast 표시
     * @param {string} message - 메시지
     * @param {string} type - 타입 ('success' | 'error' | 'warning' | 'info')
     * @param {number|string} duration - 표시 시간 (ms), 0이면 자동 닫기 안함
     *                                   🆕 v3.1.0: 문자열이면 title로 처리 (Sidebar.js 호환)
     * @param {Object} options - 추가 옵션
     * @returns {string} Toast ID
     */
    show(message, type = 'info', duration = null, options = {}) {
        if (!this._mounted) {
            this.mount();
        }
        
        const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
        const toastId = `toast-${++this._toastIdCounter}`;
        
        // 🆕 v3.1.0: duration이 문자열이면 title로 처리 (Sidebar.js 호환)
        // toast.warning('Title', 'Message') 형태 지원
        let finalDuration;
        let finalOptions = options;
        
        if (typeof duration === 'string') {
            // duration 자리에 문자열이 오면 → title로 처리
            finalOptions = { ...options, title: message };
            message = duration;  // 두 번째 인자가 실제 메시지
            finalDuration = config.defaultDuration;
        } else if (typeof duration === 'number') {
            finalDuration = duration;
        } else {
            finalDuration = config.defaultDuration;
        }
        
        // 최대 개수 초과 시 가장 오래된 Toast 제거
        if (this._toasts.size >= this._maxToasts) {
            const oldestId = this._toasts.keys().next().value;
            this.remove(oldestId);
        }
        
        // Toast 요소 생성 - CSS 클래스만 사용
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        // Toast 내용 구성
        toast.innerHTML = this._buildToastHTML(message, config, finalDuration, finalOptions);
        
        // 닫기 버튼 이벤트
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.remove(toastId));
        }
        
        // 액션 버튼 이벤트 (있는 경우)
        if (finalOptions.actions) {
            finalOptions.actions.forEach((action, index) => {
                const btn = toast.querySelector(`[data-action-index="${index}"]`);
                if (btn && action.onClick) {
                    btn.addEventListener('click', () => {
                        action.onClick();
                        if (action.closeOnClick !== false) {
                            this.remove(toastId);
                        }
                    });
                }
            });
        }
        
        // 컨테이너에 추가
        this.element.appendChild(toast);
        
        // 애니메이션 시작 - CSS 클래스 추가
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('toast-show');
            });
        });
        
        // Toast 정보 저장
        const toastInfo = {
            element: toast,
            timer: null,
            duration: finalDuration
        };
        
        // 🆕 v3.1.0: 자동 제거 타이머 (강화된 로직)
        if (finalDuration > 0) {
            toastInfo.timer = setTimeout(() => {
                this.remove(toastId);
            }, finalDuration);
        }
        
        this._toasts.set(toastId, toastInfo);
        
        return toastId;
    }
    
    /**
     * Toast HTML 빌드
     * @private
     */
    _buildToastHTML(message, config, duration, options) {
        const { icon } = config;
        const { title, actions } = options;
        
        let html = `
            <span class="toast-icon">${options.icon || icon}</span>
            <div class="toast-content">
        `;
        
        if (title) {
            html += `<div class="toast-title">${title}</div>`;
        }
        
        html += `<span class="toast-message">${message}</span>`;
        
        // 액션 버튼
        if (actions && actions.length > 0) {
            html += '<div class="toast-actions">';
            actions.forEach((action, index) => {
                const btnClass = action.primary 
                    ? 'toast-action-btn toast-action-btn-primary' 
                    : 'toast-action-btn toast-action-btn-secondary';
                html += `<button class="${btnClass}" data-action-index="${index}">${action.label}</button>`;
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        // 닫기 버튼
        html += '<button class="toast-close" aria-label="닫기">&times;</button>';
        
        // 프로그레스 바
        if (this._showProgress && duration > 0) {
            html += `
                <div class="toast-progress">
                    <div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
                </div>
            `;
        }
        
        return html;
    }
    
    /**
     * Toast 제거
     * 🆕 v3.1.0: 강제 DOM 제거 로직 추가
     * @param {string} toastId - Toast ID
     */
    remove(toastId) {
        const toastInfo = this._toasts.get(toastId);
        if (!toastInfo) {
            return;
        }
        
        const { element, timer } = toastInfo;
        
        // 타이머 제거
        if (timer) {
            clearTimeout(timer);
        }
        
        // Map에서 즉시 제거 (중복 호출 방지)
        this._toasts.delete(toastId);
        
        // 숨김 클래스 추가
        element.classList.remove('toast-show');
        element.classList.add('toast-hide');
        
        // 🆕 v3.1.0: 강제 DOM 제거 함수
        const removeFromDOM = () => {
            try {
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            } catch (e) {
                // 이미 제거된 경우 무시
            }
        };
        
        // 🆕 v3.1.0: 300ms 후 강제 DOM 제거 (CSS transition 완료 대기)
        // transitionend 이벤트에 의존하지 않음!
        setTimeout(removeFromDOM, 300);
    }
    
    /**
     * 모든 Toast 제거
     */
    removeAll() {
        // Map을 복사해서 순회 (제거 중 Map 변경 방지)
        const toastIds = Array.from(this._toasts.keys());
        toastIds.forEach(toastId => {
            this.remove(toastId);
        });
    }
    
    /**
     * Toast 업데이트
     * @param {string} toastId - Toast ID
     * @param {Object} updates - 업데이트할 내용
     */
    update(toastId, updates) {
        const toastInfo = this._toasts.get(toastId);
        if (!toastInfo) return;
        
        const { element } = toastInfo;
        
        if (updates.message) {
            const messageEl = element.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = updates.message;
            }
        }
        
        if (updates.title) {
            const titleEl = element.querySelector('.toast-title');
            if (titleEl) {
                titleEl.textContent = updates.title;
            }
        }
        
        if (updates.type) {
            // 기존 타입 클래스 제거
            Object.keys(TOAST_CONFIG).forEach(type => {
                element.classList.remove(`toast-${type}`);
            });
            // 새 타입 클래스 추가
            element.classList.add(`toast-${updates.type}`);
            
            // 아이콘 업데이트
            const iconEl = element.querySelector('.toast-icon');
            if (iconEl) {
                iconEl.textContent = TOAST_CONFIG[updates.type]?.icon || TOAST_CONFIG.info.icon;
            }
        }
    }
    
    // =========================================================
    // 편의 메서드
    // =========================================================
    
    /**
     * 성공 Toast
     * @param {string} message - 메시지
     * @param {number} duration - 표시 시간
     * @param {Object} options - 추가 옵션
     */
    success(message, duration, options = {}) {
        return this.show(message, 'success', duration, options);
    }
    
    /**
     * 에러 Toast
     * @param {string} message - 메시지
     * @param {number} duration - 표시 시간
     * @param {Object} options - 추가 옵션
     */
    error(message, duration, options = {}) {
        return this.show(message, 'error', duration, options);
    }
    
    /**
     * 경고 Toast
     * @param {string} message - 메시지
     * @param {number} duration - 표시 시간
     * @param {Object} options - 추가 옵션
     */
    warning(message, duration, options = {}) {
        return this.show(message, 'warning', duration, options);
    }
    
    /**
     * 정보 Toast
     * @param {string} message - 메시지
     * @param {number} duration - 표시 시간
     * @param {Object} options - 추가 옵션
     */
    info(message, duration, options = {}) {
        return this.show(message, 'info', duration, options);
    }
    
    /**
     * Promise 기반 Toast (로딩 → 성공/실패)
     * @param {Promise} promise - 추적할 Promise
     * @param {Object} messages - { loading, success, error }
     * @returns {Promise} 원본 Promise
     */
    async promise(promise, messages = {}) {
        const loadingMsg = messages.loading || 'Loading...';
        const successMsg = messages.success || 'Success!';
        const errorMsg = messages.error || 'Error occurred';
        
        const toastId = this.show(loadingMsg, 'info', 0, {
            icon: '⏳'
        });
        
        try {
            const result = await promise;
            this.update(toastId, {
                message: typeof successMsg === 'function' ? successMsg(result) : successMsg,
                type: 'success'
            });
            
            // 성공 후 자동 제거
            setTimeout(() => this.remove(toastId), TOAST_CONFIG.success.defaultDuration);
            
            return result;
        } catch (error) {
            this.update(toastId, {
                message: typeof errorMsg === 'function' ? errorMsg(error) : errorMsg,
                type: 'error'
            });
            
            // 에러 후 자동 제거
            setTimeout(() => this.remove(toastId), TOAST_CONFIG.error.defaultDuration);
            
            throw error;
        }
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.removeAll();
        super.destroy();
    }
}

// =========================================================
// 싱글톤 및 편의 함수
// =========================================================

// 싱글톤 인스턴스
let toastInstance = null;

/**
 * Toast 싱글톤 가져오기
 * @returns {Toast}
 */
export function getToast() {
    if (!toastInstance) {
        toastInstance = new Toast();
        toastInstance.mount();
    }
    return toastInstance;
}

/**
 * Toast 싱글톤 리셋 (테스트용)
 */
export function resetToast() {
    if (toastInstance) {
        toastInstance.destroy();
        toastInstance = null;
    }
}

// 편의 함수들 - 기존 API 호환
export const toast = {
    show: (message, type, duration, options) => getToast().show(message, type, duration, options),
    success: (message, duration, options) => getToast().success(message, duration, options),
    error: (message, duration, options) => getToast().error(message, duration, options),
    warning: (message, duration, options) => getToast().warning(message, duration, options),
    info: (message, duration, options) => getToast().info(message, duration, options),
    remove: (id) => getToast().remove(id),
    removeAll: () => getToast().removeAll(),
    update: (id, updates) => getToast().update(id, updates),
    promise: (promise, messages) => getToast().promise(promise, messages)
};

export default Toast;