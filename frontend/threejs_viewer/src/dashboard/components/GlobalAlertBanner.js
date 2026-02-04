/**
 * GlobalAlertBanner.js
 * ===========
 * Dashboard 상단 전역 알림 배너 컴포넌트
 * 
 * @version 1.0.1
 * @description
 * - Critical 알림 배너 표시
 * - 다중 Site 알림 큐 관리
 * - 자동 숨김 및 수동 닫기 지원
 * - 알림 레벨별 스타일 (info, warning, error, critical)
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 * - v1.0.1 (2026-02-04): DashboardManager API 호환성 수정
 *   - 옵션 객체로 생성자 변경 ({ container })
 *   - mount() 메서드 추가
 *   - show() 메서드 추가 (DashboardManager 호출용)
 *   - 생성자에서 자동 초기화 제거
 *   - ⚠️ 호환성: DashboardManager 호출 방식에 맞춤
 * 
 * @dependencies
 * - DashboardState.js: 상태 관리
 * - _dashboard.css: 스타일
 * 
 * @exports
 * - GlobalAlertBanner: Alert Banner 컴포넌트 클래스
 * - AlertLevel: 알림 레벨 상수
 * 
 * 📁 위치: frontend/threejs_viewer/src/dashboard/components/GlobalAlertBanner.js
 * 작성일: 2026-02-03
 * 수정일: 2026-02-04
 */

import { getDashboardState, StateEvents, SiteStatus } from '../DashboardState.js';

// =========================================================
// Constants
// =========================================================

/**
 * 알림 레벨
 * @readonly
 * @enum {string}
 */
export const AlertLevel = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

// =========================================================
// GlobalAlertBanner Class
// =========================================================

/**
 * GlobalAlertBanner 클래스
 * 전역 알림 배너 관리
 */
export class GlobalAlertBanner {
    // =========================================================
    // CSS Class Constants (가이드라인 준수)
    // =========================================================
    
    /** @type {Object} CSS 클래스 상수 - BEM 규칙 적용 */
    static CSS = {
        // Block
        BLOCK: 'global-alert-banner',
        
        // Elements
        CONTENT: 'global-alert-banner__content',
        ICON: 'global-alert-banner__icon',
        MESSAGE: 'global-alert-banner__message',
        SITE: 'global-alert-banner__site',
        CLOSE: 'global-alert-banner__close',
        
        // Modifiers (Level)
        MOD_INFO: 'global-alert-banner--info',
        MOD_WARNING: 'global-alert-banner--warning',
        MOD_ERROR: 'global-alert-banner--error',
        MOD_CRITICAL: 'global-alert-banner--critical',
        
        // State Modifiers
        MOD_VISIBLE: 'global-alert-banner--visible',
        MOD_HIDDEN: 'global-alert-banner--hidden',
        
        // Legacy alias (하위 호환)
        LEGACY_VISIBLE: 'visible',
        LEGACY_HIDDEN: 'hidden'
    };
    
    /** @type {Object} 레벨별 아이콘 */
    static ICONS = {
        [AlertLevel.INFO]: 'ℹ️',
        [AlertLevel.WARNING]: '⚠️',
        [AlertLevel.ERROR]: '❌',
        [AlertLevel.CRITICAL]: '🚨'
    };
    
    /** @type {Object} 레벨별 CSS Modifier */
    static LEVEL_CLASSES = {
        [AlertLevel.INFO]: 'global-alert-banner--info',
        [AlertLevel.WARNING]: 'global-alert-banner--warning',
        [AlertLevel.ERROR]: 'global-alert-banner--error',
        [AlertLevel.CRITICAL]: 'global-alert-banner--critical'
    };

    // =========================================================
    // Constructor
    // =========================================================
    
    /**
     * @param {Object|HTMLElement} options - 옵션 객체 또는 컨테이너 요소
     * @param {HTMLElement} options.container - Banner를 삽입할 컨테이너
     * @param {number} options.autoHideDelay - 자동 숨김 딜레이 (ms), 0이면 자동 숨김 안함
     * @param {number} options.maxAlerts - 최대 알림 큐 크기
     */
    constructor(options = {}) {
        // 하위 호환: HTMLElement가 직접 전달된 경우
        if (options instanceof HTMLElement) {
            this.container = options;
            this.options = {
                autoHideDelay: 10000,
                maxAlerts: 10
            };
        } else {
            // 옵션 객체로 전달된 경우 (DashboardManager 방식)
            this.container = options?.container || null;
            this.options = {
                autoHideDelay: options?.autoHideDelay ?? 10000,
                maxAlerts: options?.maxAlerts ?? 10
            };
        }
        
        this.element = null;
        this.state = getDashboardState();
        
        this._alertQueue = [];
        this._currentAlert = null;
        this._autoHideTimer = null;
        this._unsubscribers = [];
        this._mounted = false;
        
        // 참고: mount() 호출 전까지 초기화하지 않음 (DashboardManager 호환)
    }
    
    // =========================================================
    // Public Methods
    // =========================================================
    
    /**
     * 컴포넌트 마운트 (DOM에 렌더링)
     * DashboardManager에서 호출
     */
    mount() {
        if (this._mounted) {
            console.warn('⚠️ [GlobalAlertBanner] Already mounted');
            return;
        }
        
        this._render();
        this._subscribeToState();
        this._bindEvents();
        this._mounted = true;
        
        console.log('🚨 [GlobalAlertBanner] Mounted');
    }
    
    /**
     * 알림 표시 (DashboardManager에서 호출)
     * @param {Object} options - 알림 옵션
     * @param {string} options.type - 알림 타입 (info, warning, error, critical)
     * @param {string} options.message - 메시지
     * @param {string} options.siteId - Site ID (옵션)
     */
    show(options) {
        const level = options.type || AlertLevel.INFO;
        this.showAlert({
            level,
            message: options.message,
            siteId: options.siteId
        });
    }
    
    /**
     * 알림 표시
     * @param {Object} alert - 알림 데이터
     * @param {AlertLevel} alert.level - 알림 레벨
     * @param {string} alert.message - 메시지
     * @param {string} alert.siteId - Site ID (옵션)
     */
    showAlert(alert) {
        // 중복 알림 방지
        const isDuplicate = this._alertQueue.some(a => 
            a.message === alert.message && a.siteId === alert.siteId
        );
        
        if (isDuplicate) return;
        
        // 큐에 추가
        this._alertQueue.push({
            ...alert,
            id: Date.now(),
            timestamp: new Date()
        });
        
        // 큐 크기 제한
        while (this._alertQueue.length > this.options.maxAlerts) {
            this._alertQueue.shift();
        }
        
        // 현재 표시 중인 알림이 없으면 표시
        if (!this._currentAlert) {
            this._showNextAlert();
        }
        
        console.log(`🚨 [GlobalAlertBanner] Alert queued: ${alert.message}`);
    }
    
    /**
     * 현재 알림 닫기
     */
    dismiss() {
        this._clearAutoHideTimer();
        this._hide();
        
        // 다음 알림 표시
        if (this._alertQueue.length > 0) {
            setTimeout(() => this._showNextAlert(), 300);
        }
    }
    
    /**
     * 모든 알림 제거
     */
    clearAll() {
        this._alertQueue = [];
        this._clearAutoHideTimer();
        this._hide();
        
        console.log('🗑️ [GlobalAlertBanner] All alerts cleared');
    }
    
    // =========================================================
    // Rendering
    // =========================================================
    
    /**
     * Banner 렌더링
     * @private
     */
    _render() {
        const CSS = GlobalAlertBanner.CSS;
        
        // 기존 컨테이너를 사용하거나 새로 생성
        if (this.container && this.container.classList) {
            // 컨테이너가 이미 banner로 사용되는 경우
            this.element = this.container;
            this.element.innerHTML = `
                <div class="${CSS.CONTENT}">
                    <span class="${CSS.ICON}"></span>
                    <span class="${CSS.MESSAGE}"></span>
                    <span class="${CSS.SITE}"></span>
                    <button class="${CSS.CLOSE}" aria-label="닫기">×</button>
                </div>
            `;
        } else {
            // 새 요소 생성
            this.element = document.createElement('div');
            this.element.className = CSS.BLOCK;
            this.element.innerHTML = `
                <div class="${CSS.CONTENT}">
                    <span class="${CSS.ICON}"></span>
                    <span class="${CSS.MESSAGE}"></span>
                    <span class="${CSS.SITE}"></span>
                    <button class="${CSS.CLOSE}" aria-label="닫기">×</button>
                </div>
            `;
            
            if (this.container && typeof this.container.appendChild === 'function') {
                this.container.appendChild(this.element);
            }
        }
    }
    
    // =========================================================
    // Event Binding
    // =========================================================
    
    /**
     * 이벤트 바인딩
     * @private
     */
    _bindEvents() {
        if (!this.element) return;
        
        const CSS = GlobalAlertBanner.CSS;
        const closeBtn = this.element.querySelector(`.${CSS.CLOSE}`);
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.dismiss());
        }
        
        // Banner 클릭 시 Site로 이동 (옵션)
        this.element.addEventListener('click', (e) => {
            if (!e.target.closest(`.${CSS.CLOSE}`)) {
                this._handleBannerClick();
            }
        });
    }
    
    /**
     * Banner 클릭 핸들러
     * @private
     */
    _handleBannerClick() {
        if (this._currentAlert?.siteId) {
            this.state.selectSite(this._currentAlert.siteId);
            console.log(`📌 [GlobalAlertBanner] Selected site: ${this._currentAlert.siteId}`);
        }
    }
    
    // =========================================================
    // State Subscription
    // =========================================================
    
    /**
     * 상태 구독
     * @private
     */
    _subscribeToState() {
        // Site 상태 변경 감지 - 에러 발생 시 Alert 표시
        const unsubStatus = this.state.on(StateEvents.SITE_STATUS_CHANGED, ({ siteId, site }) => {
            this._checkSiteForAlert(siteId, site);
        });
        this._unsubscribers.push(unsubStatus);
        
        // 에러 이벤트 감지
        const unsubError = this.state.on(StateEvents.ERROR, ({ message, siteId }) => {
            this.showAlert({
                level: AlertLevel.ERROR,
                message,
                siteId
            });
        });
        this._unsubscribers.push(unsubError);
    }
    
    /**
     * Site 알림 체크
     * @param {string} siteId
     * @param {Object} site
     * @private
     */
    _checkSiteForAlert(siteId, site) {
        // 연결 실패 알림
        if (site.status === SiteStatus.UNHEALTHY || site.status === SiteStatus.DISCONNECTED) {
            this.showAlert({
                level: AlertLevel.ERROR,
                message: `${site.display_name || siteId} 서버 연결 실패`,
                siteId
            });
        }
        
        // Critical Equipment 알림
        if (site.critical_equipments && site.critical_equipments.length > 0) {
            const count = site.critical_equipments.length;
            this.showAlert({
                level: AlertLevel.CRITICAL,
                message: `${site.display_name || siteId}: Critical Equipment ${count}대 감지`,
                siteId
            });
        }
    }
    
    // =========================================================
    // Private Methods
    // =========================================================
    
    /**
     * 다음 알림 표시
     * @private
     */
    _showNextAlert() {
        if (this._alertQueue.length === 0) {
            this._currentAlert = null;
            return;
        }
        
        this._currentAlert = this._alertQueue.shift();
        this._updateBanner(this._currentAlert);
        this._showBanner();
        
        // 자동 숨김 타이머 설정
        if (this.options.autoHideDelay > 0) {
            this._autoHideTimer = setTimeout(() => {
                this.dismiss();
            }, this.options.autoHideDelay);
        }
    }
    
    /**
     * Banner UI 업데이트
     * @param {Object} alert
     * @private
     */
    _updateBanner(alert) {
        if (!this.element) return;
        
        const CSS = GlobalAlertBanner.CSS;
        
        // 레벨 클래스 제거 후 추가
        Object.values(GlobalAlertBanner.LEVEL_CLASSES).forEach(cls => {
            this.element.classList.remove(cls);
        });
        this.element.classList.add(GlobalAlertBanner.LEVEL_CLASSES[alert.level] || '');
        
        // 아이콘
        const iconEl = this.element.querySelector(`.${CSS.ICON}`);
        if (iconEl) {
            iconEl.textContent = GlobalAlertBanner.ICONS[alert.level] || 'ℹ️';
        }
        
        // 메시지
        const messageEl = this.element.querySelector(`.${CSS.MESSAGE}`);
        if (messageEl) {
            messageEl.textContent = alert.message;
        }
        
        // Site 표시
        const siteEl = this.element.querySelector(`.${CSS.SITE}`);
        if (siteEl) {
            if (alert.siteId) {
                const site = this.state.sitesMap.get(alert.siteId);
                siteEl.textContent = site?.display_name || alert.siteId;
                siteEl.style.display = '';
            } else {
                siteEl.style.display = 'none';
            }
        }
    }
    
    /**
     * Banner 표시
     * @private
     */
    _showBanner() {
        if (!this.element) return;
        
        const CSS = GlobalAlertBanner.CSS;
        this.element.classList.remove(CSS.MOD_HIDDEN);
        this.element.classList.remove(CSS.LEGACY_HIDDEN);
        this.element.classList.add(CSS.MOD_VISIBLE);
        this.element.classList.add(CSS.LEGACY_VISIBLE);
    }
    
    /**
     * Banner 숨김
     * @private
     */
    _hide() {
        if (!this.element) return;
        
        const CSS = GlobalAlertBanner.CSS;
        this.element.classList.remove(CSS.MOD_VISIBLE);
        this.element.classList.remove(CSS.LEGACY_VISIBLE);
        this.element.classList.add(CSS.MOD_HIDDEN);
        this.element.classList.add(CSS.LEGACY_HIDDEN);
        this._currentAlert = null;
    }
    
    /**
     * 자동 숨김 타이머 제거
     * @private
     */
    _clearAutoHideTimer() {
        if (this._autoHideTimer) {
            clearTimeout(this._autoHideTimer);
            this._autoHideTimer = null;
        }
    }
    
    // =========================================================
    // Cleanup
    // =========================================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        this._clearAutoHideTimer();
        
        // 구독 해제
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
        
        // DOM 제거 (컨테이너로 사용된 경우는 innerHTML만 정리)
        if (this.element && this.element !== this.container && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        } else if (this.element) {
            this.element.innerHTML = '';
        }
        
        this.element = null;
        this._alertQueue = [];
        this._currentAlert = null;
        this._mounted = false;
        
        console.log('🗑️ [GlobalAlertBanner] Destroyed');
    }
}

export default GlobalAlertBanner;