/**
 * BasePanel.js
 * 모든 Panel의 기본 클래스
 * 
 * @version 1.0.0
 * @description Panel 공통 패턴 추출 (show, hide, render, destroy 등)
 */

import { BaseComponent } from './BaseComponent.js';

/**
 * BasePanel
 * 모든 Panel 컴포넌트의 기본 클래스
 */
export class BasePanel extends BaseComponent {
    /**
     * @param {Object} options - Panel 옵션
     * @param {HTMLElement} options.container - 컨테이너 요소
     * @param {string} options.title - Panel 제목
     * @param {boolean} options.collapsible - 접기/펼치기 가능 여부
     * @param {boolean} options.collapsed - 초기 접힘 상태
     * @param {boolean} options.resizable - 크기 조절 가능 여부
     */
    constructor(options = {}) {
        super(options);
        
        // Panel 옵션
        this.title = options.title || '';
        this.collapsible = options.collapsible || false;
        this.collapsed = options.collapsed || false;
        this.resizable = options.resizable || false;
        
        // 상태
        this._visible = true;
        
        // 요소 참조
        this.headerElement = null;
        this.bodyElement = null;
    }
    
    // =========================================================
    // 추상 메서드 (자식 클래스에서 구현)
    // =========================================================
    
    /**
     * Panel 내용 렌더링 (필수 오버라이드)
     * @returns {string} HTML 문자열
     */
    renderContent() {
        return '<div class="panel-content">Content</div>';
    }
    
    /**
     * Panel Header 렌더링 (선택 오버라이드)
     * @returns {string|null}
     */
    renderHeader() {
        if (!this.title) return null;
        
        return `
            <div class="panel-header">
                <h3 class="panel-title">${this.title}</h3>
                ${this.collapsible ? '<button class="panel-toggle-btn">▼</button>' : ''}
            </div>
        `;
    }
    
    // =========================================================
    // 렌더링
    // =========================================================
    
    /**
     * Panel 전체 렌더링
     * @returns {string}
     */
    render() {
        const header = this.renderHeader();
        const collapsedClass = this.collapsed ? 'collapsed' : '';
        const resizableClass = this.resizable ? 'resizable' : '';
        
        return `
            <div class="panel ${collapsedClass} ${resizableClass}" id="${this.id}">
                ${header || ''}
                <div class="panel-body">
                    ${this.renderContent()}
                </div>
            </div>
        `;
    }
    
    // =========================================================
    // 마운트
    // =========================================================
    
    /**
     * 마운트 후 호출
     */
    onMount() {
        // 요소 참조
        this.headerElement = this.element?.querySelector('.panel-header');
        this.bodyElement = this.element?.querySelector('.panel-body');
        
        // 이벤트 등록
        this._attachEventListeners();
        
        // 자식 클래스 콜백
        this.attachEventListeners();
    }
    
    /**
     * 기본 이벤트 리스너 등록
     */
    _attachEventListeners() {
        // 접기/펼치기 버튼
        if (this.collapsible) {
            const toggleBtn = this.element?.querySelector('.panel-toggle-btn');
            if (toggleBtn) {
                this.addDomListener(toggleBtn, 'click', () => this.toggleCollapse());
            }
        }
    }
    
    /**
     * 자식 클래스용 이벤트 등록 (오버라이드 가능)
     */
    attachEventListeners() {
        // 자식 클래스에서 오버라이드
    }
    
    // =========================================================
    // 표시 제어
    // =========================================================
    
    /**
     * Panel 표시
     */
    show() {
        if (this.element) {
            this.element.style.display = '';
            this._visible = true;
            this.onShow();
        }
    }
    
    /**
     * Panel 숨기기
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
            this._visible = false;
            this.onHide();
        }
    }
    
    /**
     * Panel 표시 토글
     * @returns {boolean} 현재 표시 상태
     */
    toggle() {
        if (this._visible) {
            this.hide();
        } else {
            this.show();
        }
        return this._visible;
    }
    
    /**
     * 표시 여부 확인
     * @returns {boolean}
     */
    isVisible() {
        return this._visible;
    }
    
    /**
     * 표시될 때 호출 (오버라이드 가능)
     */
    onShow() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 숨겨질 때 호출 (오버라이드 가능)
     */
    onHide() {
        // 자식 클래스에서 오버라이드
    }
    
    // =========================================================
    // 접기/펼치기
    // =========================================================
    
    /**
     * Panel 접기
     */
    collapse() {
        if (!this.collapsible || this.collapsed) return;
        
        this.collapsed = true;
        this.element?.classList.add('collapsed');
        
        if (this.bodyElement) {
            this.bodyElement.style.display = 'none';
        }
        
        this._updateToggleButton();
        this.onCollapse();
    }
    
    /**
     * Panel 펼치기
     */
    expand() {
        if (!this.collapsible || !this.collapsed) return;
        
        this.collapsed = false;
        this.element?.classList.remove('collapsed');
        
        if (this.bodyElement) {
            this.bodyElement.style.display = '';
        }
        
        this._updateToggleButton();
        this.onExpand();
    }
    
    /**
     * 접기/펼치기 토글
     * @returns {boolean} 접힘 상태
     */
    toggleCollapse() {
        if (this.collapsed) {
            this.expand();
        } else {
            this.collapse();
        }
        return this.collapsed;
    }
    
    /**
     * 토글 버튼 업데이트
     */
    _updateToggleButton() {
        const btn = this.element?.querySelector('.panel-toggle-btn');
        if (btn) {
            btn.textContent = this.collapsed ? '▶' : '▼';
        }
    }
    
    /**
     * 접힐 때 호출 (오버라이드 가능)
     */
    onCollapse() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * 펼쳐질 때 호출 (오버라이드 가능)
     */
    onExpand() {
        // 자식 클래스에서 오버라이드
    }
    
    // =========================================================
    // 유틸리티
    // =========================================================
    
    /**
     * 제목 변경
     * @param {string} title
     */
    setTitle(title) {
        this.title = title;
        const titleEl = this.element?.querySelector('.panel-title');
        if (titleEl) {
            titleEl.textContent = title;
        }
    }
    
    /**
     * 내용 업데이트
     * @param {string} html
     */
    setContent(html) {
        if (this.bodyElement) {
            this.bodyElement.innerHTML = html;
        }
    }
    
    /**
     * 내용 비우기
     */
    clear() {
        if (this.bodyElement) {
            this.bodyElement.innerHTML = '';
        }
    }
    
    /**
     * 로딩 상태 설정
     * @param {boolean} loading
     * @param {string} message - 로딩 메시지
     */
    setLoading(loading, message = 'Loading...') {
        if (loading) {
            this.element?.classList.add('loading');
            if (this.bodyElement) {
                this.bodyElement.innerHTML = `
                    <div class="panel-loading">
                        <div class="spinner"></div>
                        <span>${message}</span>
                    </div>
                `;
            }
        } else {
            this.element?.classList.remove('loading');
        }
    }
    
    /**
     * 에러 상태 표시
     * @param {string} message
     */
    setError(message) {
        this.element?.classList.add('error');
        if (this.bodyElement) {
            this.bodyElement.innerHTML = `
                <div class="panel-error">
                    <span class="error-icon">⚠️</span>
                    <span class="error-message">${message}</span>
                </div>
            `;
        }
    }
    
    /**
     * 에러 상태 해제
     */
    clearError() {
        this.element?.classList.remove('error');
    }
    
    /**
     * 데이터 새로고침 (오버라이드 가능)
     */
    async refresh() {
        // 자식 클래스에서 오버라이드
        this._logger.debug('refresh 호출');
    }
}

export default BasePanel;