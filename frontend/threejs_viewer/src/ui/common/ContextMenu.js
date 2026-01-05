/**
 * ContextMenu.js
 * 컨텍스트 메뉴 (우클릭 메뉴) 컴포넌트
 * 
 * @version 2.0.0
 * @description 재사용 가능한 컨텍스트 메뉴
 * @modified 2026-01-06 (Phase 6 - 인라인 스타일 제거, CSS 클래스 기반)
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';

/**
 * 전역 컨텍스트 메뉴 컨테이너
 */
let contextMenuContainer = null;

function getContextMenuContainer() {
    if (!contextMenuContainer) {
        contextMenuContainer = document.createElement('div');
        contextMenuContainer.id = 'context-menu-container';
        document.body.appendChild(contextMenuContainer);
    }
    return contextMenuContainer;
}

/**
 * ContextMenu 컴포넌트
 */
export class ContextMenu extends BaseComponent {
    /**
     * @param {Object} options
     * @param {Array} options.items - 메뉴 항목 [{label, icon?, action?, disabled?, divider?, submenu?, shortcut?}]
     */
    constructor(options = {}) {
        super({
            ...options,
            container: getContextMenuContainer()
        });
        
        this.items = options.items || [];
        this._visible = false;
        this._position = { x: 0, y: 0 };
        
        // 외부 클릭 핸들러
        this._outsideClickHandler = this._onOutsideClick.bind(this);
    }
    
    /**
     * 렌더링
     */
    render() {
        return `
            <div class="context-menu">
                ${this._renderItems(this.items)}
            </div>
        `;
    }
    
    /**
     * 메뉴 항목 렌더링
     */
    _renderItems(items) {
        return items.map((item, index) => {
            if (item.divider) {
                return '<div class="context-menu__divider"></div>';
            }
            
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const disabledClass = item.disabled ? 'context-menu__item--disabled' : '';
            
            return `
                <div class="context-menu__item ${disabledClass}" data-index="${index}">
                    <span class="context-menu__icon">${item.icon || ''}</span>
                    <span class="context-menu__label">${item.label}</span>
                    ${item.shortcut ? `<span class="context-menu__shortcut">${item.shortcut}</span>` : ''}
                    ${hasSubmenu ? '<span class="context-menu__arrow">▶</span>' : ''}
                </div>
            `;
        }).join('');
    }
    
    /**
     * 마운트 후 처리
     */
    onMount() {
        if (!this.element) return;
        
        // 항목 클릭
        this.addDomListener(this.element, 'click', (e) => {
            const item = e.target.closest('.context-menu__item');
            if (item && !item.classList.contains('context-menu__item--disabled')) {
                const index = parseInt(item.dataset.index);
                this._onItemClick(index);
            }
        });
    }
    
    /**
     * 항목 클릭 핸들러
     */
    _onItemClick(index) {
        const item = this.items[index];
        if (item && item.action) {
            item.action();
        }
        this.hide();
    }
    
    /**
     * 외부 클릭 핸들러
     */
    _onOutsideClick(e) {
        if (this._visible && !this.element.contains(e.target)) {
            this.hide();
        }
    }
    
    /**
     * 메뉴 표시
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    show(x, y) {
        if (!this._mounted) {
            this.mount();
        }
        
        if (!this.element) return;
        
        // 위치 설정
        this._position = { x, y };
        
        // 화면 경계 체크
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let finalX = x;
        let finalY = y;
        
        // 오른쪽 경계
        if (x + 180 > viewportWidth) {
            finalX = viewportWidth - 180;
        }
        
        // 하단 경계
        if (y + 200 > viewportHeight) {
            finalY = viewportHeight - 200;
        }
        
        this.element.style.left = `${finalX}px`;
        this.element.style.top = `${finalY}px`;
        this.element.classList.add('context-menu--visible');
        
        this._visible = true;
        
        // 외부 클릭 감지
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler);
            document.addEventListener('contextmenu', this._outsideClickHandler);
        }, 0);
    }
    
    /**
     * 메뉴 숨김
     */
    hide() {
        if (this.element) {
            this.element.classList.remove('context-menu--visible');
        }
        this._visible = false;
        
        document.removeEventListener('click', this._outsideClickHandler);
        document.removeEventListener('contextmenu', this._outsideClickHandler);
    }
    
    /**
     * 메뉴 항목 업데이트
     */
    setItems(items) {
        this.items = items;
        if (this.element) {
            this.element.innerHTML = this._renderItems(items);
        }
    }
    
    /**
     * 표시 여부
     */
    isVisible() {
        return this._visible;
    }
    
    /**
     * 파괴
     */
    destroy() {
        document.removeEventListener('click', this._outsideClickHandler);
        document.removeEventListener('contextmenu', this._outsideClickHandler);
        super.destroy();
    }
}

/**
 * 요소에 컨텍스트 메뉴 바인딩
 */
export function bindContextMenu(element, items) {
    const menu = new ContextMenu({ items });
    
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        menu.show(e.clientX, e.clientY);
    });
    
    return menu;
}

export default ContextMenu;