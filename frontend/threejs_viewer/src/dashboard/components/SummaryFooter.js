/**
 * SummaryFooter.js
 * ===========
 * Dashboard 하단 요약 통계 Footer 컴포넌트
 * 
 * @version 1.0.1
 * @description
 * - 전체 Site 통계 요약 표시 (Total, RUN, IDLE, STOP, DISC)
 * - 전체 생산량 및 알람 카운트 표시
 * - 마지막 업데이트 시간 표시
 * - 실시간 업데이트 (DashboardState 구독)
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 * - v1.0.1 (2026-02-04): DashboardManager API 호환성 수정
 *   - 옵션 객체로 생성자 변경 ({ container, state })
 *   - mount() 메서드 추가
 *   - 생성자에서 자동 초기화 제거
 *   - ⚠️ 호환성: DashboardManager 호출 방식에 맞춤
 * 
 * @dependencies
 * - DashboardState.js: 상태 관리
 * - _dashboard.css: 스타일
 * 
 * @exports
 * - SummaryFooter: Footer 컴포넌트 클래스
 * 
 * 📁 위치: frontend/threejs_viewer/src/dashboard/components/SummaryFooter.js
 * 작성일: 2026-02-03
 * 수정일: 2026-02-04
 */

import { getDashboardState, StateEvents } from '../DashboardState.js';

// =========================================================
// SummaryFooter Class
// =========================================================

/**
 * SummaryFooter 클래스
 * Dashboard 하단 요약 통계 표시
 */
export class SummaryFooter {
    // =========================================================
    // CSS Class Constants (가이드라인 준수)
    // =========================================================
    
    /** @type {Object} CSS 클래스 상수 - BEM 규칙 적용 */
    static CSS = {
        // Block
        BLOCK: 'summary-footer',
        
        // Elements
        CONTENT: 'summary-footer__content',
        ITEM: 'summary-footer__item',
        ICON: 'summary-footer__icon',
        LABEL: 'summary-footer__label',
        VALUE: 'summary-footer__value',
        UNIT: 'summary-footer__unit',
        DIVIDER: 'summary-footer__divider',
        SPACER: 'summary-footer__spacer',
        STATUS_GROUP: 'summary-footer__status-group',
        DOT: 'summary-footer__dot',
        TIMESTAMP: 'summary-footer__timestamp',
        
        // Modifiers
        MOD_HIGHLIGHT: 'summary-footer__value--highlight',
        MOD_RUN: 'run',
        MOD_IDLE: 'idle',
        MOD_STOP: 'stop',
        
        // Legacy alias (하위 호환)
        LEGACY_HIGHLIGHT: 'highlight'
    };

    // =========================================================
    // Constructor
    // =========================================================
    
    /**
     * @param {Object|HTMLElement} options - 옵션 객체 또는 컨테이너 요소
     * @param {HTMLElement} options.container - Footer를 삽입할 컨테이너
     * @param {Object} options.state - DashboardState 인스턴스 (옵션)
     */
    constructor(options) {
        // 하위 호환: HTMLElement가 직접 전달된 경우
        if (options instanceof HTMLElement) {
            this.container = options;
            this.state = getDashboardState();
        } else {
            // 옵션 객체로 전달된 경우 (DashboardManager 방식)
            this.container = options?.container || null;
            this.state = options?.state || getDashboardState();
        }
        
        this.element = null;
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
            console.warn('⚠️ [SummaryFooter] Already mounted');
            return;
        }
        
        this._render();
        this._subscribeToState();
        this._mounted = true;
        
        console.log('📊 [SummaryFooter] Mounted');
    }
    
    /**
     * 강제 업데이트
     */
    refresh() {
        this._updateStats();
    }
    
    /**
     * 표시/숨김
     * @param {boolean} visible
     */
    setVisible(visible) {
        if (this.element) {
            this.element.style.display = visible ? '' : 'none';
        }
    }
    
    // =========================================================
    // Rendering
    // =========================================================
    
    /**
     * Footer 렌더링
     * @private
     */
    _render() {
        const CSS = SummaryFooter.CSS;
        
        this.element = document.createElement('footer');
        this.element.className = CSS.BLOCK;
        
        this.element.innerHTML = this._generateHTML();
        
        // 컨테이너가 HTMLElement인지 확인
        if (this.container && typeof this.container.appendChild === 'function') {
            this.container.appendChild(this.element);
        } else {
            console.warn('⚠️ [SummaryFooter] Invalid container:', this.container);
        }
    }
    
    /**
     * HTML 생성
     * @returns {string}
     * @private
     */
    _generateHTML() {
        const CSS = SummaryFooter.CSS;
        const stats = this.state.totalStats || { total: 0, run: 0, idle: 0, stop: 0, production: 0, alarms: 0 };
        const sites = this.state.sites || [];
        
        return `
            <div class="${CSS.CONTENT}">
                <!-- Site Count -->
                <div class="${CSS.ITEM}">
                    <span class="${CSS.ICON}">🏭</span>
                    <span class="${CSS.LABEL}">Sites</span>
                    <span class="${CSS.VALUE}" data-stat="sites">${sites.length}</span>
                </div>
                
                <span class="${CSS.DIVIDER}"></span>
                
                <!-- Equipment Total -->
                <div class="${CSS.ITEM}">
                    <span class="${CSS.ICON}">⚙️</span>
                    <span class="${CSS.LABEL}">설비</span>
                    <span class="${CSS.VALUE}" data-stat="total">${stats.total}</span>
                    <span class="${CSS.UNIT}">대</span>
                </div>
                
                <!-- Status Group -->
                <div class="${CSS.STATUS_GROUP}">
                    <div class="${CSS.ITEM}">
                        <span class="${CSS.DOT} ${CSS.MOD_RUN}"></span>
                        <span class="${CSS.VALUE}" data-stat="run">${stats.run}</span>
                    </div>
                    <div class="${CSS.ITEM}">
                        <span class="${CSS.DOT} ${CSS.MOD_IDLE}"></span>
                        <span class="${CSS.VALUE}" data-stat="idle">${stats.idle}</span>
                    </div>
                    <div class="${CSS.ITEM}">
                        <span class="${CSS.DOT} ${CSS.MOD_STOP}"></span>
                        <span class="${CSS.VALUE}" data-stat="stop">${stats.stop}</span>
                    </div>
                </div>
                
                <span class="${CSS.DIVIDER}"></span>
                
                <!-- Production -->
                <div class="${CSS.ITEM}">
                    <span class="${CSS.ICON}">📊</span>
                    <span class="${CSS.LABEL}">생산량</span>
                    <span class="${CSS.VALUE}" data-stat="production">${this._formatNumber(stats.production)}</span>
                </div>
                
                <!-- Alarms -->
                <div class="${CSS.ITEM}">
                    <span class="${CSS.ICON}">⚠️</span>
                    <span class="${CSS.LABEL}">알람</span>
                    <span class="${CSS.VALUE}" data-stat="alarms">${stats.alarms}</span>
                </div>
                
                <span class="${CSS.SPACER}"></span>
                
                <!-- Timestamp -->
                <div class="${CSS.TIMESTAMP}" data-stat="timestamp">
                    ${this._formatTimestamp(this.state.lastUpdated)}
                </div>
            </div>
        `;
    }
    
    // =========================================================
    // State Subscription
    // =========================================================
    
    /**
     * 상태 구독
     * @private
     */
    _subscribeToState() {
        // Sites 업데이트 구독
        const unsubSites = this.state.on(StateEvents.SITES_UPDATED, () => {
            this._updateStats();
        });
        this._unsubscribers.push(unsubSites);
        
        // Site 상태 변경 구독
        const unsubStatus = this.state.on(StateEvents.SITE_STATUS_CHANGED, () => {
            this._updateStats();
        });
        this._unsubscribers.push(unsubStatus);
    }
    
    // =========================================================
    // Update Methods
    // =========================================================
    
    /**
     * 통계 업데이트
     * @private
     */
    _updateStats() {
        if (!this.element) return;
        
        const stats = this.state.totalStats || { total: 0, run: 0, idle: 0, stop: 0, production: 0, alarms: 0 };
        const sites = this.state.sites || [];
        
        // Sites count
        this._updateValue('sites', sites.length);
        
        // Equipment stats
        this._updateValue('total', stats.total);
        this._updateValue('run', stats.run);
        this._updateValue('idle', stats.idle);
        this._updateValue('stop', stats.stop);
        
        // Production & Alarms
        this._updateValue('production', this._formatNumber(stats.production));
        this._updateValue('alarms', stats.alarms, stats.alarms > 0);
        
        // Timestamp
        const timestampEl = this.element.querySelector('[data-stat="timestamp"]');
        if (timestampEl) {
            timestampEl.textContent = this._formatTimestamp(this.state.lastUpdated);
        }
    }
    
    /**
     * 개별 값 업데이트
     * @param {string} stat - stat 이름
     * @param {string|number} value - 값
     * @param {boolean} highlight - 하이라이트 여부
     * @private
     */
    _updateValue(stat, value, highlight = false) {
        const el = this.element?.querySelector(`[data-stat="${stat}"]`);
        if (!el) return;
        
        const CSS = SummaryFooter.CSS;
        const oldValue = el.textContent;
        el.textContent = value;
        
        // 값이 변경되면 하이라이트 효과
        if (oldValue !== String(value) || highlight) {
            el.classList.add(CSS.MOD_HIGHLIGHT);
            el.classList.add(CSS.LEGACY_HIGHLIGHT); // 하위 호환
            setTimeout(() => {
                el.classList.remove(CSS.MOD_HIGHLIGHT);
                el.classList.remove(CSS.LEGACY_HIGHLIGHT);
            }, 1000);
        }
    }
    
    // =========================================================
    // Formatters
    // =========================================================
    
    /**
     * 숫자 포맷팅 (1000 → 1,000)
     * @param {number} num
     * @returns {string}
     * @private
     */
    _formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return num.toLocaleString();
    }
    
    /**
     * 타임스탬프 포맷팅
     * @param {Date|null} date
     * @returns {string}
     * @private
     */
    _formatTimestamp(date) {
        if (!date) return '업데이트 대기중...';
        
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 5) return '방금 업데이트';
        if (diff < 60) return `${diff}초 전 업데이트`;
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전 업데이트`;
        
        return date.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    // =========================================================
    // Cleanup
    // =========================================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        // 구독 해제
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
        
        // DOM 제거
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this._mounted = false;
        
        console.log('🗑️ [SummaryFooter] Destroyed');
    }
}

export default SummaryFooter;