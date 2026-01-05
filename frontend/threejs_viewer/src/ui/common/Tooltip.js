/**
 * Tooltip.js
 * 툴팁 컴포넌트
 * 
 * @version 2.0.0
 * @description 호버 시 표시되는 툴팁
 * @modified 2026-01-06 (Phase 6 - 인라인 스타일 제거, CSS 클래스 기반)
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';

/**
 * 툴팁 위치별 설정
 */
const POSITIONS = {
    top: { transform: 'translateX(-50%) translateY(-100%)', offset: { x: 0, y: -8 } },
    bottom: { transform: 'translateX(-50%)', offset: { x: 0, y: 8 } },
    left: { transform: 'translateX(-100%) translateY(-50%)', offset: { x: -8, y: 0 } },
    right: { transform: 'translateY(-50%)', offset: { x: 8, y: 0 } }
};

/**
 * 전역 툴팁 컨테이너
 */
let tooltipContainer = null;

function getTooltipContainer() {
    if (!tooltipContainer) {
        tooltipContainer = document.createElement('div');
        tooltipContainer.id = 'tooltip-container';
        document.body.appendChild(tooltipContainer);
    }
    return tooltipContainer;
}

/**
 * Tooltip 컴포넌트
 */
export class Tooltip extends BaseComponent {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.target - 툴팁 대상 요소
     * @param {string} options.content - 툴팁 내용
     * @param {string} options.position - 위치 ('top' | 'bottom' | 'left' | 'right')
     * @param {number} options.delay - 표시 지연 (ms)
     * @param {string} options.theme - 테마 ('dark' | 'light')
     */
    constructor(options = {}) {
        super({
            ...options,
            container: getTooltipContainer()
        });
        
        this.target = options.target;
        this.content = options.content || '';
        this.position = options.position || 'top';
        this.delay = options.delay || 300;
        this.theme = options.theme || 'dark';
        
        this._visible = false;
        this._showTimer = null;
        
        // 타겟에 이벤트 바인딩
        if (this.target) {
            this._bindTargetEvents();
        }
    }
    
    /**
     * 클래스명 생성
     */
    _getClassNames() {
        return [
            'tooltip',
            `tooltip--${this.position}`,
            `tooltip--${this.theme}`,
            this._visible ? 'tooltip--visible' : ''
        ].filter(Boolean).join(' ');
    }
    
    /**
     * 렌더링
     */
    render() {
        return `
            <div class="${this._getClassNames()}">
                ${this.content}
            </div>
        `;
    }
    
    /**
     * 타겟 이벤트 바인딩
     */
    _bindTargetEvents() {
        this.target.addEventListener('mouseenter', () => this._scheduleShow());
        this.target.addEventListener('mouseleave', () => this._scheduleHide());
        this.target.addEventListener('focus', () => this._scheduleShow());
        this.target.addEventListener('blur', () => this._scheduleHide());
    }
    
    /**
     * 표시 스케줄
     */
    _scheduleShow() {
        if (this._showTimer) {
            clearTimeout(this._showTimer);
        }
        
        this._showTimer = setTimeout(() => {
            this.show();
        }, this.delay);
    }
    
    /**
     * 숨김 스케줄
     */
    _scheduleHide() {
        if (this._showTimer) {
            clearTimeout(this._showTimer);
            this._showTimer = null;
        }
        this.hide();
    }
    
    /**
     * 툴팁 표시
     */
    show() {
        if (!this._mounted) {
            this.mount();
        }
        
        if (!this.element || !this.target) return;
        
        // 위치 계산
        const targetRect = this.target.getBoundingClientRect();
        const posConfig = POSITIONS[this.position];
        
        let top, left;
        
        switch (this.position) {
            case 'top':
                left = targetRect.left + targetRect.width / 2;
                top = targetRect.top + posConfig.offset.y;
                break;
            case 'bottom':
                left = targetRect.left + targetRect.width / 2;
                top = targetRect.bottom + posConfig.offset.y;
                break;
            case 'left':
                left = targetRect.left + posConfig.offset.x;
                top = targetRect.top + targetRect.height / 2;
                break;
            case 'right':
                left = targetRect.right + posConfig.offset.x;
                top = targetRect.top + targetRect.height / 2;
                break;
        }
        
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
        this.element.style.transform = posConfig.transform;
        this.element.classList.add('tooltip--visible');
        
        this._visible = true;
    }
    
    /**
     * 툴팁 숨김
     */
    hide() {
        if (this.element) {
            this.element.classList.remove('tooltip--visible');
        }
        this._visible = false;
    }
    
    /**
     * 내용 변경
     */
    setContent(content) {
        this.content = content;
        if (this.element) {
            this.element.textContent = content;
        }
    }
    
    /**
     * 위치 변경
     */
    setPosition(position) {
        if (this.element) {
            this.element.classList.remove(`tooltip--${this.position}`);
            this.position = position;
            this.element.classList.add(`tooltip--${position}`);
        }
    }
    
    /**
     * 테마 변경
     */
    setTheme(theme) {
        if (this.element) {
            this.element.classList.remove(`tooltip--${this.theme}`);
            this.theme = theme;
            this.element.classList.add(`tooltip--${theme}`);
        }
    }
    
    /**
     * 파괴
     */
    destroy() {
        if (this._showTimer) {
            clearTimeout(this._showTimer);
        }
        super.destroy();
    }
}

/**
 * 요소에 툴팁 추가
 * @param {HTMLElement} element
 * @param {string} content
 * @param {Object} options
 * @returns {Tooltip}
 */
export function addTooltip(element, content, options = {}) {
    return new Tooltip({
        target: element,
        content,
        ...options
    });
}

export default Tooltip;