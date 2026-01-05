/**
 * Dropdown.js
 * 드롭다운 선택 컴포넌트
 * 
 * @version 2.0.0
 * @description 재사용 가능한 드롭다운 컴포넌트
 * @modified 2026-01-06 (Phase 6 - 인라인 스타일 제거, CSS 클래스 기반)
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';

/**
 * Dropdown 컴포넌트
 */
export class Dropdown extends BaseComponent {
    /**
     * @param {Object} options
     * @param {Array} options.items - 드롭다운 항목 [{value, label, icon?, disabled?}]
     * @param {*} options.value - 현재 선택 값
     * @param {string} options.placeholder - 플레이스홀더
     * @param {boolean} options.disabled - 비활성화 여부
     * @param {boolean} options.searchable - 검색 가능 여부
     * @param {boolean} options.light - 라이트 테마 사용 (모달 내부용)
     * @param {Function} options.onChange - 변경 핸들러
     */
    constructor(options = {}) {
        super(options);
        
        this.items = options.items || [];
        this.value = options.value !== undefined ? options.value : null;
        this.placeholder = options.placeholder || 'Select...';
        this.disabled = options.disabled || false;
        this.searchable = options.searchable || false;
        this.light = options.light || false;
        this.onChange = options.onChange || null;
        
        this._isOpen = false;
        this._searchText = '';
        this._highlightedIndex = -1;
    }
    
    /**
     * 클래스명 생성
     */
    _getClassNames() {
        const classes = ['dropdown'];
        
        if (this.disabled) {
            classes.push('dropdown--disabled');
        }
        
        if (this._isOpen) {
            classes.push('dropdown--open');
        }
        
        if (this.light) {
            classes.push('dropdown--light');
        }
        
        return classes.join(' ');
    }
    
    /**
     * 렌더링
     */
    render() {
        const selectedItem = this.items.find(item => item.value === this.value);
        const displayText = selectedItem ? selectedItem.label : this.placeholder;
        const displayIcon = selectedItem?.icon || '';
        const textClass = selectedItem ? 'dropdown__text' : 'dropdown__text dropdown__text--placeholder';
        
        return `
            <div class="${this._getClassNames()}">
                <div class="dropdown__trigger">
                    ${displayIcon ? `<span class="dropdown__icon">${displayIcon}</span>` : ''}
                    <span class="${textClass}">${displayText}</span>
                    <span class="dropdown__arrow">${this._isOpen ? '▲' : '▼'}</span>
                </div>
                <div class="dropdown__menu">
                    ${this.searchable ? `
                        <div class="dropdown__search">
                            <input type="text" 
                                   class="dropdown__search-input"
                                   placeholder="Search..."
                                   value="${this._searchText}">
                        </div>
                    ` : ''}
                    <div class="dropdown__items">
                        ${this._renderItems()}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 항목 렌더링
     */
    _renderItems() {
        const filteredItems = this._getFilteredItems();
        
        if (filteredItems.length === 0) {
            return '<div class="dropdown__empty">No items found</div>';
        }
        
        return filteredItems.map((item, index) => {
            const isSelected = item.value === this.value;
            const isHighlighted = index === this._highlightedIndex;
            const isDisabled = item.disabled;
            
            const classes = [
                'dropdown__item',
                isSelected ? 'dropdown__item--selected' : '',
                isHighlighted ? 'dropdown__item--highlighted' : '',
                isDisabled ? 'dropdown__item--disabled' : ''
            ].filter(Boolean).join(' ');
            
            return `
                <div class="${classes}" data-value="${item.value}" data-index="${index}">
                    ${item.icon ? `<span class="dropdown__item-icon">${item.icon}</span>` : ''}
                    <span class="dropdown__item-label">${item.label}</span>
                    ${isSelected ? '<span class="dropdown__item-check">✓</span>' : ''}
                </div>
            `;
        }).join('');
    }
    
    /**
     * 필터링된 항목
     */
    _getFilteredItems() {
        if (!this._searchText) return this.items;
        
        const searchLower = this._searchText.toLowerCase();
        return this.items.filter(item => 
            item.label.toLowerCase().includes(searchLower)
        );
    }
    
    /**
     * 마운트 후 처리
     */
    onMount() {
        if (!this.element) return;
        
        const trigger = this.element.querySelector('.dropdown__trigger');
        const searchInput = this.element.querySelector('.dropdown__search-input');
        
        // 트리거 클릭
        this.addDomListener(trigger, 'click', () => {
            if (!this.disabled) {
                this._toggle();
            }
        });
        
        // 검색 입력
        if (searchInput) {
            this.addDomListener(searchInput, 'input', (e) => {
                this._searchText = e.target.value;
                this._updateItems();
            });
            
            this.addDomListener(searchInput, 'click', (e) => {
                e.stopPropagation();
            });
        }
        
        // 항목 클릭
        this.addDomListener(this.element, 'click', (e) => {
            const item = e.target.closest('.dropdown__item');
            if (item && !item.classList.contains('dropdown__item--disabled')) {
                const value = item.dataset.value;
                this._selectValue(value);
            }
        });
        
        // 항목 호버
        this.addDomListener(this.element, 'mouseover', (e) => {
            const item = e.target.closest('.dropdown__item');
            if (item && !item.classList.contains('dropdown__item--disabled')) {
                this._highlightedIndex = parseInt(item.dataset.index);
                this._updateItems();
            }
        });
        
        // 외부 클릭 시 닫기
        this._outsideClickHandler = (e) => {
            if (!this.element.contains(e.target)) {
                this._close();
            }
        };
        document.addEventListener('click', this._outsideClickHandler);
        
        // 키보드 네비게이션
        this.addDomListener(this.element, 'keydown', (e) => {
            this._handleKeyDown(e);
        });
    }
    
    /**
     * 토글
     */
    _toggle() {
        if (this._isOpen) {
            this._close();
        } else {
            this._open();
        }
    }
    
    /**
     * 열기
     */
    _open() {
        this._isOpen = true;
        this._highlightedIndex = -1;
        this._searchText = '';
        
        if (this.element) {
            this.element.classList.add('dropdown--open');
            
            // 메뉴 표시
            const menu = this.element.querySelector('.dropdown__menu');
            if (menu) {
                menu.style.display = 'block';
            }
            
            // 검색 입력에 포커스
            if (this.searchable) {
                setTimeout(() => {
                    const input = this.element?.querySelector('.dropdown__search-input');
                    input?.focus();
                }, 0);
            }
        }
    }
    
    /**
     * 닫기
     */
    _close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        
        if (this.element) {
            this.element.classList.remove('dropdown--open');
            
            // 메뉴 숨김
            const menu = this.element.querySelector('.dropdown__menu');
            if (menu) {
                menu.style.display = 'none';
            }
        }
    }
    
    /**
     * 값 선택
     */
    _selectValue(value) {
        // 타입 변환 (숫자 등)
        const item = this.items.find(i => String(i.value) === String(value));
        if (!item) return;
        
        this.value = item.value;
        this._close();
        
        // 표시 텍스트 업데이트
        this._updateTrigger();
        
        if (this.onChange) {
            this.onChange(item.value, item);
        }
    }
    
    /**
     * 트리거 업데이트
     */
    _updateTrigger() {
        const textEl = this.element?.querySelector('.dropdown__text');
        const iconEl = this.element?.querySelector('.dropdown__icon');
        
        const selectedItem = this.items.find(item => item.value === this.value);
        
        if (textEl) {
            textEl.textContent = selectedItem ? selectedItem.label : this.placeholder;
            textEl.classList.toggle('dropdown__text--placeholder', !selectedItem);
        }
        
        if (iconEl && selectedItem?.icon) {
            iconEl.textContent = selectedItem.icon;
        }
    }
    
    /**
     * 항목 업데이트
     */
    _updateItems() {
        const itemsContainer = this.element?.querySelector('.dropdown__items');
        if (itemsContainer) {
            itemsContainer.innerHTML = this._renderItems();
        }
    }
    
    /**
     * 키보드 핸들링
     */
    _handleKeyDown(e) {
        const filteredItems = this._getFilteredItems();
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!this._isOpen) {
                    this._open();
                } else {
                    this._highlightedIndex = Math.min(
                        this._highlightedIndex + 1, 
                        filteredItems.length - 1
                    );
                    this._updateItems();
                }
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this._highlightedIndex = Math.max(this._highlightedIndex - 1, 0);
                this._updateItems();
                break;
                
            case 'Enter':
                if (this._isOpen && this._highlightedIndex >= 0) {
                    const item = filteredItems[this._highlightedIndex];
                    if (item && !item.disabled) {
                        this._selectValue(item.value);
                    }
                }
                break;
                
            case 'Escape':
                this._close();
                break;
        }
    }
    
    /**
     * 값 설정
     */
    setValue(value) {
        this.value = value;
        if (this._mounted) {
            this._updateTrigger();
            this._updateItems();
        }
    }
    
    /**
     * 항목 설정
     */
    setItems(items) {
        this.items = items;
        if (this._mounted) {
            this._updateItems();
        }
    }
    
    /**
     * 파괴
     */
    destroy() {
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
        }
        super.destroy();
    }
}

export default Dropdown;