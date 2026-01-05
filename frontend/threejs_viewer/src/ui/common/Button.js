/**
 * Button.js
 * 공통 버튼 컴포넌트
 * 
 * @version 2.0.0
 * @description 재사용 가능한 버튼 컴포넌트
 * @modified 2026-01-06 (Phase 6 - 인라인 스타일 제거, CSS 클래스 기반)
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';

/**
 * Button 컴포넌트
 */
export class Button extends BaseComponent {
    /**
     * @param {Object} options
     * @param {string} options.text - 버튼 텍스트
     * @param {string} options.type - 버튼 타입 ('primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'icon')
     * @param {string} options.size - 버튼 크기 ('sm' | 'md' | 'lg')
     * @param {string} options.icon - 아이콘 (선택)
     * @param {boolean} options.disabled - 비활성화 여부
     * @param {boolean} options.loading - 로딩 상태
     * @param {boolean} options.overlay - 오버레이 테마 사용 여부 (3D 씬 위)
     * @param {Function} options.onClick - 클릭 핸들러
     */
    constructor(options = {}) {
        super(options);
        
        this.text = options.text || '';
        this.type = options.type || 'primary';
        this.size = options.size || 'md';
        this.icon = options.icon || '';
        this.disabled = options.disabled || false;
        this.loading = options.loading || false;
        this.overlay = options.overlay || false;
        this.onClick = options.onClick || null;
        this.title = options.title || '';
        this.className = options.className || '';
    }
    
    /**
     * 클래스명 생성
     */
    _getClassNames() {
        const classes = ['btn'];
        
        // 타입 클래스
        if (this.type === 'icon') {
            classes.push('btn-icon');
            if (this.overlay) {
                classes.push('btn-icon--overlay');
            }
        } else {
            const typeClass = `btn-${this.type}`;
            classes.push(this.overlay ? `${typeClass}--overlay` : typeClass);
        }
        
        // 크기 클래스 (icon 타입이 아닌 경우)
        if (this.type !== 'icon') {
            classes.push(`btn--${this.size}`);
        } else if (this.size !== 'md') {
            classes.push(`btn-icon--${this.size}`);
        }
        
        // 상태 클래스
        if (this.disabled) {
            classes.push('btn--disabled');
        }
        
        if (this.loading) {
            classes.push('btn--loading');
        }
        
        // 추가 클래스
        if (this.className) {
            classes.push(this.className);
        }
        
        return classes.join(' ');
    }
    
    /**
     * 렌더링
     */
    render() {
        const classNames = this._getClassNames();
        
        const content = this.loading 
            ? '<span class="btn__spinner">⏳</span>' 
            : `${this.icon ? `<span class="btn__icon">${this.icon}</span>` : ''}${this.text ? `<span class="btn__text">${this.text}</span>` : ''}`;
        
        return `
            <button 
                class="${classNames}" 
                ${this.disabled || this.loading ? 'disabled' : ''}
                ${this.title ? `title="${this.title}"` : ''}
            >
                ${content}
            </button>
        `;
    }
    
    /**
     * 마운트 후 처리
     */
    onMount() {
        if (!this.element) return;
        
        // 클릭 이벤트
        if (this.onClick) {
            this.addDomListener(this.element, 'click', (e) => {
                if (!this.disabled && !this.loading) {
                    this.onClick(e);
                }
            });
        }
    }
    
    /**
     * 비활성화 상태 설정
     */
    setDisabled(disabled) {
        this.disabled = disabled;
        if (this.element) {
            this.element.disabled = disabled;
            this.element.classList.toggle('btn--disabled', disabled);
        }
    }
    
    /**
     * 로딩 상태 설정
     */
    setLoading(loading) {
        this.loading = loading;
        if (this.element) {
            this.element.classList.toggle('btn--loading', loading);
            this.element.disabled = loading || this.disabled;
            
            // 컨텐츠 업데이트
            if (loading) {
                this.element.innerHTML = '<span class="btn__spinner">⏳</span>';
            } else {
                const content = `${this.icon ? `<span class="btn__icon">${this.icon}</span>` : ''}${this.text ? `<span class="btn__text">${this.text}</span>` : ''}`;
                this.element.innerHTML = content;
            }
        }
    }
    
    /**
     * 텍스트 변경
     */
    setText(text) {
        this.text = text;
        const textEl = this.element?.querySelector('.btn__text');
        if (textEl) {
            textEl.textContent = text;
        }
    }
    
    /**
     * 아이콘 변경
     */
    setIcon(icon) {
        this.icon = icon;
        const iconEl = this.element?.querySelector('.btn__icon');
        if (iconEl) {
            iconEl.textContent = icon;
        }
    }
    
    /**
     * 타입 변경
     */
    setType(type) {
        if (this.element) {
            // 기존 타입 클래스 제거
            const oldTypeClass = this.overlay ? `btn-${this.type}--overlay` : `btn-${this.type}`;
            this.element.classList.remove(oldTypeClass);
            
            // 새 타입 클래스 추가
            this.type = type;
            const newTypeClass = this.overlay ? `btn-${type}--overlay` : `btn-${type}`;
            this.element.classList.add(newTypeClass);
        }
    }
}

/**
 * 버튼 생성 헬퍼 함수
 */
export function createButton(options) {
    const button = new Button(options);
    return button;
}

export default Button;