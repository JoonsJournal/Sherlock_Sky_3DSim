/**
 * Toast.js
 * Toast 알림 컴포넌트
 * 
 * @version 2.0.0
 * @description BaseComponent 상속, 통합 Toast 시스템
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';
import { SOLID_EDGE_COLORS, EQUIPMENT_STATUS_COLORS } from '../../core/config/theme.js';

/**
 * Toast 타입별 설정
 */
const TOAST_CONFIG = {
    success: {
        icon: '✅',
        color: EQUIPMENT_STATUS_COLORS.RUNNING,
        duration: 3000
    },
    error: {
        icon: '❌',
        color: EQUIPMENT_STATUS_COLORS.ALARM,
        duration: 5000
    },
    warning: {
        icon: '⚠️',
        color: EQUIPMENT_STATUS_COLORS.IDLE,
        duration: 4000
    },
    info: {
        icon: 'ℹ️',
        color: SOLID_EDGE_COLORS.HIGHLIGHT,
        duration: 3000
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
     * 마운트 후 처리
     */
    onMount() {
        // 스타일 적용
        if (this.element) {
            Object.assign(this.element.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '10000',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                pointerEvents: 'none'
            });
        }
    }
    
    /**
     * Toast 표시
     * @param {string} message - 메시지
     * @param {string} type - 타입 ('success' | 'error' | 'warning' | 'info')
     * @param {number} duration - 표시 시간 (ms), 0이면 자동 닫기 안함
     * @returns {string} Toast ID
     */
    show(message, type = 'info', duration = null) {
        if (!this._mounted) {
            this.mount();
        }
        
        const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
        const toastId = `toast-${++this._toastIdCounter}`;
        const finalDuration = duration !== null ? duration : config.duration;
        
        // Toast 요소 생성
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: #2a2a2a;
            border-left: 4px solid ${config.color};
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            color: #ffffff;
            font-size: 14px;
            pointer-events: auto;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            max-width: 400px;
        `;
        
        toast.innerHTML = `
            <span class="toast-icon" style="font-size: 18px;">${config.icon}</span>
            <span class="toast-message" style="flex: 1;">${message}</span>
            <button class="toast-close" style="
                background: none;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
            ">&times;</button>
        `;
        
        // 닫기 버튼 이벤트
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toastId));
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#fff');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#888');
        
        // 컨테이너에 추가
        this.element.appendChild(toast);
        
        // 애니메이션 시작
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });
        
        // Toast 정보 저장
        const toastInfo = {
            element: toast,
            timer: null
        };
        
        // 자동 제거 타이머
        if (finalDuration > 0) {
            toastInfo.timer = setTimeout(() => {
                this.remove(toastId);
            }, finalDuration);
        }
        
        this._toasts.set(toastId, toastInfo);
        
        return toastId;
    }
    
    /**
     * Toast 제거
     * @param {string} toastId - Toast ID
     */
    remove(toastId) {
        const toastInfo = this._toasts.get(toastId);
        if (!toastInfo) return;
        
        const { element, timer } = toastInfo;
        
        // 타이머 제거
        if (timer) {
            clearTimeout(timer);
        }
        
        // 애니메이션 후 제거
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this._toasts.delete(toastId);
        }, 300);
    }
    
    /**
     * 모든 Toast 제거
     */
    removeAll() {
        this._toasts.forEach((_, toastId) => {
            this.remove(toastId);
        });
    }
    
    // =========================================================
    // 편의 메서드
    // =========================================================
    
    /**
     * 성공 Toast
     */
    success(message, duration) {
        return this.show(message, 'success', duration);
    }
    
    /**
     * 에러 Toast
     */
    error(message, duration) {
        return this.show(message, 'error', duration);
    }
    
    /**
     * 경고 Toast
     */
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
    
    /**
     * 정보 Toast
     */
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.removeAll();
        super.destroy();
    }
}

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

// 편의 함수들
export const toast = {
    show: (message, type, duration) => getToast().show(message, type, duration),
    success: (message, duration) => getToast().success(message, duration),
    error: (message, duration) => getToast().error(message, duration),
    warning: (message, duration) => getToast().warning(message, duration),
    info: (message, duration) => getToast().info(message, duration),
    remove: (id) => getToast().remove(id),
    removeAll: () => getToast().removeAll()
};

export default Toast;