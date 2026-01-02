/**
 * Dropdown.js
 * 드롭다운 선택 컴포넌트
 * 
 * @version 1.0.0
 * @description 재사용 가능한 드롭다운 컴포넌트
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
     * @param {Function} options.onChange - 변경 핸들러
     */
    constructor(options = {}) {
        super(options);
        
        this.items = options.items || [];
        this.value = options.value !== undefined ? options.value : null;
        this.placeholder = options.placeholder || 'Select...';
        this.disabled = options.disabled || false;
        this.searchable = options.searchable || false;
        this.onChange = options.onChange || null;
        
        this._isOpen = false;
        this._searchText = '';
        this._highlightedIndex = -1;
    }
    
    /**
     * 렌더링
     */
    render() {
        const selectedItem = this.items.find(item => item.value === this.value);
        const displayText = selectedItem ? selectedItem.label : this.placeholder;
        const displayIcon = selectedItem?.icon || '';
        
        return `
            <div class="dropdown ${this.disabled ? 'disabled' : ''} ${this._isOpen ? 'open' : ''}"
                 style="position: relative; min-width: 150px;">
                <div class="dropdown-trigger" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: #2a2a2a;
                    border: 1px solid #444;
                    border-radius: 4px;
                    cursor: ${this.disabled ? 'not-allowed' : 'pointer'};
                    opacity: ${this.disabled ? '0.5' : '1'};
                ">
                    ${displayIcon ? `<span class="dropdown-icon">${displayIcon}</span>` : ''}
                    <span class="dropdown-text" style="flex: 1; color: ${selectedItem ? '#fff' : '#888'};">
                        ${displayText}
                    </span>
                    <span class="dropdown-arrow" style="color: #888;">
                        ${this._isOpen ? '▲' : '▼'}
                    </span>
                </div>
                <div class="dropdown-menu" style="
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    max-height: 200px;
                    overflow-y: auto;
                    background: #2a2a2a;
                    border: 1px solid #444;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    z-index: 1000;
                    display: ${this._isOpen ? 'block' : 'none'};
                ">
                    ${this.searchable ? `
                        <div class="dropdown-search" style="padding: 8px;">
                            <input type="text" 
                                   class="dropdown-search-input"
                                   placeholder="Search..."
                                   value="${this._searchText}"
                                   style="
                                       width: 100%;
                                       padding: 6px 8px;
                                       background: #1a1a1a;
                                       border: 1px solid #555;
                                       border-radius: 4px;
                                       color: #fff;
                                       font-size: 13px;
                                   ">
                        </div>
                    ` : ''}
                    <div class="dropdown-items">
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
            return `
                <div class="dropdown-empty" style="
                    padding: 12px;
                    text-align: center;
                    color: #888;
                    font-size: 13px;
                ">No items found</div>
            `;
        }
        
        return filteredItems.map((item, index) => {
            const isSelected = item.value === this.value;
            const isHighlighted = index === this._highlightedIndex;
            const isDisabled = item.disabled;
            
            return `
                <div class="dropdown-item ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''} ${isDisabled ? 'disabled' : ''}"
                     data-value="${item.value}"
                     data-index="${index}"
                     style="
                         display: flex;
                         align-items: center;
                         gap: 8px;
                         padding: 8px 12px;
                         cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                         background: ${isHighlighted ? '#3a3a3a' : isSelected ? '#333' : 'transparent'};
                         color: ${isDisabled ? '#666' : '#fff'};
                         border-left: 3px solid ${isSelected ? '#2196F3' : 'transparent'};
                     ">
                    ${item.icon ? `<span class="item-icon">${item.icon}</span>` : ''}
                    <span class="item-label">${item.label}</span>
                    ${isSelected ? '<span class="item-check" style="margin-left: auto;">✓</span>' : ''}
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
        
        const trigger = this.element.querySelector('.dropdown-trigger');
        const searchInput = this.element.querySelector('.dropdown-search-input');
        
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
            const item = e.target.closest('.dropdown-item');
            if (item && !item.classList.contains('disabled')) {
                const value = item.dataset.value;
                this._selectValue(value);
            }
        });
        
        // 항목 호버
        this.addDomListener(this.element, 'mouseover', (e) => {
            const item = e.target.closest('.dropdown-item');
            if (item) {
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
        this.update({});
        
        // 검색 입력에 포커스
        if (this.searchable) {
            setTimeout(() => {
                const input = this.element?.querySelector('.dropdown-search-input');
                input?.focus();
            }, 0);
        }
    }
    
    /**
     * 닫기
     */
    _close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.update({});
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
        
        if (this.onChange) {
            this.onChange(item.value, item);
        }
    }
    
    /**
     * 항목 업데이트
     */
    _updateItems() {
        const itemsContainer = this.element?.querySelector('.dropdown-items');
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
            this.update({});
        }
    }
    
    /**
     * 항목 설정
     */
    setItems(items) {
        this.items = items;
        if (this._mounted) {
            this.update({});
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