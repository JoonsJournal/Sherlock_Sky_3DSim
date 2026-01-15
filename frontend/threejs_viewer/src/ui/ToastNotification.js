/**
 * Toast Notification
 * 연결 성공/실패 알림 표시
 * 
 * @version 2.0.0
 * @description
 * - 🆕 v2.0.0: Phase 4 CSS Integration
 *   - CSS 클래스명 static 상수 정의
 *   - classList.add/remove 방식 통일
 *   - BEM 네이밍 규칙 적용
 * - v1.0.0: 초기 버전
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ToastNotification.js
 * 수정일: 2026-01-15
 */

export class ToastNotification {
    // =========================================================================
    // CSS 클래스 상수 (Phase 4)
    // =========================================================================
    
    /**
     * BEM 클래스명 상수
     * @static
     */
    static CSS = {
        // Container
        CONTAINER: 'toast-container',
        
        // Block
        BLOCK: 'toast',
        
        // Modifiers (Type)
        SUCCESS: 'toast--success',
        ERROR: 'toast--error',
        WARNING: 'toast--warning',
        INFO: 'toast--info',
        
        // Modifiers (State)
        SHOW: 'toast--show',
        HIDE: 'toast--hide',
        
        // Elements
        ICON: 'toast__icon',
        MESSAGE: 'toast__message',
        CLOSE: 'toast__close',
        
        // Legacy alias (하위 호환)
        LEGACY_SUCCESS: 'toast-success',
        LEGACY_ERROR: 'toast-error',
        LEGACY_WARNING: 'toast-warning',
        LEGACY_INFO: 'toast-info',
        LEGACY_SHOW: 'toast-show',
        LEGACY_HIDE: 'toast-hide'
    };
    
    /**
     * Utility 클래스 상수
     * @static
     */
    static UTIL = {
        FLEX: 'u-flex',
        FLEX_CENTER: 'u-flex-center',
        GLOW: 'u-glow'
    };
    
    constructor() {
        this.container = this.createContainer();
        document.body.appendChild(this.container);
    }

    /**
     * 토스트 컨테이너 생성
     */
    createContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.classList.add(ToastNotification.CSS.CONTAINER);
        return container;
    }

    /**
     * 토스트 표시
     */
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        
        // BEM 클래스 적용
        toast.classList.add(ToastNotification.CSS.BLOCK);
        toast.classList.add(this._getTypeClass(type));
        toast.classList.add(this._getLegacyTypeClass(type)); // Legacy 호환
        
        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <div class="${ToastNotification.CSS.ICON} toast-icon">${icon}</div>
            <div class="${ToastNotification.CSS.MESSAGE} toast-message">${message}</div>
            <button class="${ToastNotification.CSS.CLOSE} toast-close">&times;</button>
        `;

        // 닫기 버튼 이벤트
        const closeBtn = toast.querySelector(`.${ToastNotification.CSS.CLOSE}`);
        closeBtn.addEventListener('click', () => {
            this.remove(toast);
        });

        this.container.appendChild(toast);

        // 애니메이션
        setTimeout(() => {
            toast.classList.add(ToastNotification.CSS.SHOW);
            toast.classList.add(ToastNotification.CSS.LEGACY_SHOW);
        }, 10);

        // 자동 제거
        if (duration > 0) {
            setTimeout(() => {
                this.remove(toast);
            }, duration);
        }

        return toast;
    }

    /**
     * 토스트 제거
     */
    remove(toast) {
        toast.classList.remove(ToastNotification.CSS.SHOW);
        toast.classList.remove(ToastNotification.CSS.LEGACY_SHOW);
        toast.classList.add(ToastNotification.CSS.HIDE);
        toast.classList.add(ToastNotification.CSS.LEGACY_HIDE);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    /**
     * BEM Type 클래스 가져오기
     * @private
     */
    _getTypeClass(type) {
        const typeMap = {
            success: ToastNotification.CSS.SUCCESS,
            error: ToastNotification.CSS.ERROR,
            warning: ToastNotification.CSS.WARNING,
            info: ToastNotification.CSS.INFO
        };
        return typeMap[type] || ToastNotification.CSS.INFO;
    }
    
    /**
     * Legacy Type 클래스 가져오기 (하위 호환)
     * @private
     */
    _getLegacyTypeClass(type) {
        const typeMap = {
            success: ToastNotification.CSS.LEGACY_SUCCESS,
            error: ToastNotification.CSS.LEGACY_ERROR,
            warning: ToastNotification.CSS.LEGACY_WARNING,
            info: ToastNotification.CSS.LEGACY_INFO
        };
        return typeMap[type] || ToastNotification.CSS.LEGACY_INFO;
    }

    /**
     * 아이콘 가져오기
     */
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * 성공 토스트
     */
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }

    /**
     * 에러 토스트
     */
    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    /**
     * 경고 토스트
     */
    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    /**
     * 정보 토스트
     */
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
}
