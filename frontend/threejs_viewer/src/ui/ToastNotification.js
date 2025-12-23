/**
 * Toast Notification
 * 연결 성공/실패 알림 표시
 */

export class ToastNotification {
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
        container.className = 'toast-container';
        return container;
    }

    /**
     * 토스트 표시
     */
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">&times;</button>
        `;

        // 닫기 버튼 이벤트
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.remove(toast);
        });

        this.container.appendChild(toast);

        // 애니메이션
        setTimeout(() => toast.classList.add('toast-show'), 10);

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
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
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