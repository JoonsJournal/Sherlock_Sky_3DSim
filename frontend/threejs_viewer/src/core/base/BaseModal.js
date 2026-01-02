/**
 * BaseModal.js
 * 모든 Modal의 기본 클래스
 * 
 * @version 1.0.0
 * @description Modal 공통 패턴 추출 (open, close, ESC, overlay 클릭 등)
 */

import { BaseComponent } from './BaseComponent.js';
import { eventBus } from '../managers/EventBus.js';
import { EVENT_NAME, KEYBOARD_CONTEXT } from '../config/constants.js';
import { keyboardManager } from '../managers/KeyboardManager.js';

/**
 * BaseModal
 * 모든 Modal 컴포넌트의 기본 클래스
 */
export class BaseModal extends BaseComponent {
    /**
     * @param {Object} options - Modal 옵션
     * @param {string} options.title - Modal 제목
     * @param {string} options.size - Modal 크기 ('sm' | 'md' | 'lg' | 'xl')
     * @param {boolean} options.closeOnOverlay - 오버레이 클릭 시 닫기
     * @param {boolean} options.closeOnEsc - ESC 키로 닫기
     * @param {boolean} options.showCloseButton - 닫기 버튼 표시
     */
    constructor(options = {}) {
        super(options);
        
        // Modal 옵션
        this.title = options.title || '';
        this.size = options.size || 'md';
        this.closeOnOverlay = options.closeOnOverlay !== false;
        this.closeOnEsc = options.closeOnEsc !== false;
        this.showCloseButton = options.showCloseButton !== false;
        
        // 상태
        this.isOpen = false;
        
        // Modal 요소
        this.modalElement = null;
        this.overlayElement = null;
        this.contentElement = null;
        this.headerElement = null;
        this.bodyElement = null;
        this.footerElement = null;
        
        // ESC 핸들러 바인딩
        this._boundEscHandler = this._handleEsc.bind(this);
    }
    
    // =========================================================
    // 추상 메서드 (자식 클래스에서 구현)
    // =========================================================
    
    /**
     * Modal Body 렌더링 (필수 오버라이드)
     * @returns {string} HTML 문자열
     */
    renderBody() {
        return '<div class="modal-body-content">Content</div>';
    }
    
    /**
     * Modal Footer 렌더링 (선택 오버라이드)
     * @returns {string|null} HTML 문자열 또는 null
     */
    renderFooter() {
        return `
            <button class="btn-secondary modal-cancel-btn">Cancel</button>
            <button class="btn-primary modal-confirm-btn">Confirm</button>
        `;
    }
    
    /**
     * Modal 열릴 때 호출
     */
    onOpen() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * Modal 닫힐 때 호출
     */
    onClose() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * Confirm 버튼 클릭 시 호출
     */
    onConfirm() {
        // 자식 클래스에서 오버라이드
        this.close();
    }
    
    /**
     * Cancel 버튼 클릭 시 호출
     */
    onCancel() {
        // 자식 클래스에서 오버라이드
        this.close();
    }
    
    // =========================================================
    // 렌더링
    // =========================================================
    
    /**
     * Modal 전체 렌더링
     * @returns {string}
     */
    render() {
        const sizeClass = `modal-${this.size}`;
        const footer = this.renderFooter();
        
        return `
            <div class="modal" id="${this.id}">
                <div class="modal-overlay"></div>
                <div class="modal-content ${sizeClass}">
                    <div class="modal-header">
                        <h2 class="modal-title">${this.title}</h2>
                        ${this.showCloseButton ? '<button class="modal-close" title="Close (Esc)">&times;</button>' : ''}
                    </div>
                    <div class="modal-body">
                        ${this.renderBody()}
                    </div>
                    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    // =========================================================
    // 마운트/이벤트
    // =========================================================
    
    /**
     * 마운트 (document.body에 추가)
     */
    mount() {
        if (this._mounted) {
            return this;
        }
        
        // Modal은 항상 body에 추가
        const container = document.createElement('div');
        container.id = `${this.id}-container`;
        document.body.appendChild(container);
        
        this.container = container;
        
        // 렌더링
        this.container.innerHTML = this.render();
        this.modalElement = this.container.querySelector('.modal');
        this.element = this.modalElement;
        
        // 요소 참조
        this.overlayElement = this.modalElement.querySelector('.modal-overlay');
        this.contentElement = this.modalElement.querySelector('.modal-content');
        this.headerElement = this.modalElement.querySelector('.modal-header');
        this.bodyElement = this.modalElement.querySelector('.modal-body');
        this.footerElement = this.modalElement.querySelector('.modal-footer');
        
        this._mounted = true;
        
        // 이벤트 등록
        this._attachEventListeners();
        
        this._logger.debug('마운트 완료');
        return this;
    }
    
    /**
     * 이벤트 리스너 등록
     */
    _attachEventListeners() {
        // 닫기 버튼
        const closeBtn = this.modalElement.querySelector('.modal-close');
        if (closeBtn) {
            this.addDomListener(closeBtn, 'click', () => this.close());
        }
        
        // 오버레이 클릭
        if (this.closeOnOverlay && this.overlayElement) {
            this.addDomListener(this.overlayElement, 'click', () => this.close());
        }
        
        // Cancel 버튼
        const cancelBtn = this.modalElement.querySelector('.modal-cancel-btn');
        if (cancelBtn) {
            this.addDomListener(cancelBtn, 'click', () => this.onCancel());
        }
        
        // Confirm 버튼
        const confirmBtn = this.modalElement.querySelector('.modal-confirm-btn');
        if (confirmBtn) {
            this.addDomListener(confirmBtn, 'click', () => this.onConfirm());
        }
        
        // 자식 클래스 이벤트
        this.attachEventListeners();
    }
    
    /**
     * 자식 클래스용 이벤트 등록 (오버라이드 가능)
     */
    attachEventListeners() {
        // 자식 클래스에서 오버라이드
    }
    
    /**
     * ESC 키 핸들러
     */
    _handleEsc(event) {
        if (event.key === 'Escape' && this.isOpen && this.closeOnEsc) {
            event.preventDefault();
            this.close();
        }
    }
    
    // =========================================================
    // Open / Close
    // =========================================================
    
    /**
     * Modal 열기
     * @param {*} data - 전달할 데이터
     * @returns {BaseModal} this
     */
    open(data = null) {
        if (this.isOpen) {
            return this;
        }
        
        // 마운트 확인
        if (!this._mounted) {
            this.mount();
        }
        
        // 상태 업데이트
        this.isOpen = true;
        
        // 클래스 추가
        this.modalElement.classList.add('modal-show');
        
        // 스크롤 방지
        document.body.style.overflow = 'hidden';
        
        // ESC 핸들러 등록
        if (this.closeOnEsc) {
            document.addEventListener('keydown', this._boundEscHandler);
        }
        
        // 키보드 컨텍스트 변경
        keyboardManager.pushContext(KEYBOARD_CONTEXT.MODAL);
        
        // 콜백
        this.onOpen(data);
        
        // 이벤트 발생
        eventBus.emit(EVENT_NAME.MODAL_OPEN, { 
            modal: this, 
            id: this.id,
            data 
        });
        
        this._logger.debug('Modal 열림');
        return this;
    }
    
    /**
     * Modal 닫기
     * @returns {BaseModal} this
     */
    close() {
        if (!this.isOpen) {
            return this;
        }
        
        // 상태 업데이트
        this.isOpen = false;
        
        // 클래스 제거
        this.modalElement.classList.remove('modal-show');
        
        // 스크롤 복원
        document.body.style.overflow = '';
        
        // ESC 핸들러 제거
        document.removeEventListener('keydown', this._boundEscHandler);
        
        // 키보드 컨텍스트 복원
        keyboardManager.popContext();
        
        // 콜백
        this.onClose();
        
        // 이벤트 발생
        eventBus.emit(EVENT_NAME.MODAL_CLOSE, { 
            modal: this, 
            id: this.id 
        });
        
        this._logger.debug('Modal 닫힘');
        return this;
    }
    
    /**
     * Modal 토글
     * @returns {boolean} 현재 열림 상태
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
        return this.isOpen;
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
        const titleEl = this.modalElement?.querySelector('.modal-title');
        if (titleEl) {
            titleEl.textContent = title;
        }
    }
    
    /**
     * Body 내용 업데이트
     * @param {string} html
     */
    setBody(html) {
        if (this.bodyElement) {
            this.bodyElement.innerHTML = html;
        }
    }
    
    /**
     * Footer 내용 업데이트
     * @param {string} html
     */
    setFooter(html) {
        if (this.footerElement) {
            this.footerElement.innerHTML = html;
        }
    }
    
    /**
     * Confirm 버튼 활성화/비활성화
     * @param {boolean} enabled
     */
    setConfirmEnabled(enabled) {
        const btn = this.modalElement?.querySelector('.modal-confirm-btn');
        if (btn) {
            btn.disabled = !enabled;
        }
    }
    
    /**
     * Confirm 버튼 텍스트 변경
     * @param {string} text
     */
    setConfirmText(text) {
        const btn = this.modalElement?.querySelector('.modal-confirm-btn');
        if (btn) {
            btn.textContent = text;
        }
    }
    
    /**
     * 로딩 상태 설정
     * @param {boolean} loading
     */
    setLoading(loading) {
        if (loading) {
            this.contentElement?.classList.add('loading');
        } else {
            this.contentElement?.classList.remove('loading');
        }
    }
    
    // =========================================================
    // 정리
    // =========================================================
    
    /**
     * Modal 파괴
     */
    destroy() {
        // 열려있으면 닫기
        if (this.isOpen) {
            this.close();
        }
        
        // ESC 핸들러 제거
        document.removeEventListener('keydown', this._boundEscHandler);
        
        // 컨테이너 제거
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // 참조 정리
        this.modalElement = null;
        this.overlayElement = null;
        this.contentElement = null;
        this.headerElement = null;
        this.bodyElement = null;
        this.footerElement = null;
        
        super.destroy();
    }
}

export default BaseModal;