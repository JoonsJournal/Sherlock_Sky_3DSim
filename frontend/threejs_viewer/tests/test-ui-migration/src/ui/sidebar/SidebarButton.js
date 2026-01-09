/**
 * SidebarButton.js
 * ================
 * SHERLOCK SKY 3DSim - 사이드바 아이콘 버튼 컴포넌트
 * 
 * 개별 사이드바 버튼 UI 컴포넌트
 * 호버, 선택, 비활성화 상태 관리
 * 
 * @version 1.0.0
 * @created 2026-01-10
 */

import { iconRegistry } from '../icons/IconRegistry.js';

/**
 * SidebarButton 클래스
 */
export class SidebarButton {
    /**
     * @param {Object} config - 버튼 설정
     * @param {string} config.id - 버튼 고유 ID
     * @param {string} config.icon - 아이콘 이름 (IconRegistry 키)
     * @param {string} config.mode - 연결된 모드
     * @param {string} config.tooltip - 툴팁 텍스트
     * @param {string} config.shortcut - 키보드 단축키
     * @param {boolean} config.disabled - 비활성화 여부
     * @param {string|number|null} config.badge - 뱃지 내용
     */
    constructor(config) {
        this.id = config.id;
        this.icon = config.icon;
        this.mode = config.mode;
        this.tooltip = config.tooltip || '';
        this.shortcut = config.shortcut || null;
        this.disabled = config.disabled || false;
        this.badge = config.badge || null;
        
        this.element = null;
        this.badgeElement = null;
        this.selected = false;
        this.clickHandlers = [];
    }
    
    /**
     * 버튼 렌더링
     * @param {HTMLElement} container - 부모 컨테이너
     */
    render(container) {
        this.element = document.createElement('button');
        this.element.className = 'cleanroom-icon-btn';
        this.element.id = `btn-${this.id}`;
        this.element.setAttribute('data-mode', this.mode);
        this.element.setAttribute('data-tooltip', this.tooltip);
        this.element.setAttribute('type', 'button');
        this.element.setAttribute('role', 'tab');
        this.element.setAttribute('aria-selected', 'false');
        
        if (this.shortcut) {
            this.element.setAttribute('data-shortcut', this.shortcut);
            this.element.setAttribute('title', `${this.tooltip} (${this.shortcut})`);
        } else {
            this.element.setAttribute('title', this.tooltip);
        }
        
        // 아이콘 렌더링
        const iconSvg = iconRegistry.createIcon(this.icon, {
            size: 28,
            strokeWidth: 2
        });
        this.element.appendChild(iconSvg);
        
        // 뱃지 렌더링 (있는 경우)
        if (this.badge !== null) {
            this._renderBadge();
        }
        
        // 비활성화 상태 적용
        if (this.disabled) {
            this.setDisabled(true);
        }
        
        // 이벤트 바인딩
        this._bindEvents();
        
        container.appendChild(this.element);
    }
    
    /**
     * 뱃지 렌더링
     * @private
     */
    _renderBadge() {
        if (!this.badgeElement) {
            this.badgeElement = document.createElement('span');
            this.badgeElement.className = 'badge';
            this.element.appendChild(this.badgeElement);
        }
        
        this.badgeElement.textContent = this.badge;
        this.badgeElement.style.display = 'flex';
    }
    
    /**
     * 이벤트 바인딩
     * @private
     */
    _bindEvents() {
        this.element.addEventListener('click', (e) => {
            if (this.disabled) return;
            
            e.preventDefault();
            this.clickHandlers.forEach(handler => {
                handler(this.id, this.mode);
            });
        });
        
        // 키보드 접근성
        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.element.click();
            }
        });
    }
    
    /**
     * 클릭 핸들러 등록
     * @param {Function} handler - 핸들러 함수 (id, mode) => void
     */
    onClick(handler) {
        this.clickHandlers.push(handler);
    }
    
    /**
     * 선택 상태 설정
     * @param {boolean} selected
     */
    setSelected(selected) {
        this.selected = selected;
        this.element.classList.toggle('selected', selected);
        this.element.setAttribute('aria-selected', selected.toString());
    }
    
    /**
     * 비활성화 상태 설정
     * @param {boolean} disabled
     */
    setDisabled(disabled) {
        this.disabled = disabled;
        this.element.classList.toggle('disabled', disabled);
        this.element.disabled = disabled;
        this.element.setAttribute('aria-disabled', disabled.toString());
    }
    
    /**
     * 뱃지 설정
     * @param {string|number|null} badge - 뱃지 내용 (null이면 제거)
     * @param {string} type - 뱃지 타입 ('error', 'warning', 'info')
     */
    setBadge(badge, type = 'error') {
        this.badge = badge;
        
        if (badge === null) {
            if (this.badgeElement) {
                this.badgeElement.style.display = 'none';
            }
            return;
        }
        
        this._renderBadge();
        
        // 타입별 스타일
        this.badgeElement.classList.remove('warning', 'info');
        if (type !== 'error') {
            this.badgeElement.classList.add(type);
        }
    }
    
    /**
     * 툴팁 업데이트
     * @param {string} tooltip
     */
    setTooltip(tooltip) {
        this.tooltip = tooltip;
        this.element.setAttribute('data-tooltip', tooltip);
        
        if (this.shortcut) {
            this.element.setAttribute('title', `${tooltip} (${this.shortcut})`);
        } else {
            this.element.setAttribute('title', tooltip);
        }
    }
    
    /**
     * 아이콘 변경
     * @param {string} iconName - 새 아이콘 이름
     */
    setIcon(iconName) {
        this.icon = iconName;
        
        // 기존 SVG 제거
        const existingSvg = this.element.querySelector('svg');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // 새 아이콘 추가
        const iconSvg = iconRegistry.createIcon(iconName, {
            size: 28,
            strokeWidth: this.selected ? 3 : 2
        });
        
        // 뱃지 앞에 삽입
        if (this.badgeElement) {
            this.element.insertBefore(iconSvg, this.badgeElement);
        } else {
            this.element.appendChild(iconSvg);
        }
    }
    
    /**
     * 선택 상태 반환
     * @returns {boolean}
     */
    isSelected() {
        return this.selected;
    }
    
    /**
     * 비활성화 상태 반환
     * @returns {boolean}
     */
    isDisabled() {
        return this.disabled;
    }
    
    /**
     * 정리
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.clickHandlers = [];
    }
}

export default SidebarButton;
