/**
 * Button.js
 * 공통 버튼 컴포넌트
 * 
 * @version 1.0.0
 * @description 재사용 가능한 버튼 컴포넌트
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';
import { SOLID_EDGE_COLORS } from '../../core/config/theme.js';

/**
 * 버튼 타입별 스타일
 */
const BUTTON_STYLES = {
    primary: {
        background: '#2196F3',
        color: '#ffffff',
        border: 'none',
        hoverBackground: '#1976D2'
    },
    secondary: {
        background: '#424242',
        color: '#ffffff',
        border: '1px solid #616161',
        hoverBackground: '#616161'
    },
    danger: {
        background: '#f44336',
        color: '#ffffff',
        border: 'none',
        hoverBackground: '#d32f2f'
    },
    success: {
        background: '#4CAF50',
        color: '#ffffff',
        border: 'none',
        hoverBackground: '#388E3C'
    },
    ghost: {
        background: 'transparent',
        color: '#ffffff',
        border: '1px solid #616161',
        hoverBackground: 'rgba(255, 255, 255, 0.1)'
    },
    icon: {
        background: 'transparent',
        color: '#888888',
        border: 'none',
        hoverBackground: 'rgba(255, 255, 255, 0.1)'
    }
};

/**
 * 버튼 크기별 스타일
 */
const BUTTON_SIZES = {
    sm: {
        padding: '4px 8px',
        fontSize: '12px',
        minWidth: '60px'
    },
    md: {
        padding: '8px 16px',
        fontSize: '14px',
        minWidth: '80px'
    },
    lg: {
        padding: '12px 24px',
        fontSize: '16px',
        minWidth: '100px'
    }
};

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
        this.onClick = options.onClick || null;
        this.title = options.title || '';
    }
    
    /**
     * 렌더링
     */
    render() {
        const style = BUTTON_STYLES[this.type] || BUTTON_STYLES.primary;
        const size = BUTTON_SIZES[this.size] || BUTTON_SIZES.md;
        
        const buttonStyle = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: ${size.padding};
            font-size: ${size.fontSize};
            min-width: ${this.type === 'icon' ? 'auto' : size.minWidth};
            background: ${style.background};
            color: ${style.color};
            border: ${style.border};
            border-radius: 4px;
            cursor: ${this.disabled ? 'not-allowed' : 'pointer'};
            opacity: ${this.disabled ? '0.5' : '1'};
            transition: all 0.2s ease;
            font-family: inherit;
            outline: none;
        `;
        
        const content = this.loading 
            ? '<span class="btn-spinner">⏳</span>' 
            : `${this.icon ? `<span class="btn-icon">${this.icon}</span>` : ''}${this.text ? `<span class="btn-text">${this.text}</span>` : ''}`;
        
        return `
            <button 
                class="btn btn-${this.type} btn-${this.size}" 
                style="${buttonStyle}"
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
        
        const style = BUTTON_STYLES[this.type] || BUTTON_STYLES.primary;
        
        // 호버 이벤트
        this.addDomListener(this.element, 'mouseenter', () => {
            if (!this.disabled && !this.loading) {
                this.element.style.background = style.hoverBackground;
            }
        });
        
        this.addDomListener(this.element, 'mouseleave', () => {
            this.element.style.background = style.background;
        });
        
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
            this.element.style.opacity = disabled ? '0.5' : '1';
            this.element.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
    }
    
    /**
     * 로딩 상태 설정
     */
    setLoading(loading) {
        this.loading = loading;
        if (this._mounted) {
            this.update({});
        }
    }
    
    /**
     * 텍스트 변경
     */
    setText(text) {
        this.text = text;
        const textEl = this.element?.querySelector('.btn-text');
        if (textEl) {
            textEl.textContent = text;
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