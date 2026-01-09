/**
 * Sidebar.js
 * ==========
 * SHERLOCK SKY 3DSim - Cleanroom Sidebar 컴포넌트
 * 
 * 메인 네비게이션 사이드바 UI 컴포넌트
 * 기존 floating-btn 시스템을 대체
 * 
 * @version 1.0.0
 * @created 2026-01-10
 */

import { iconRegistry } from '../icons/IconRegistry.js';
import SidebarButton from './SidebarButton.js';

/**
 * 사이드바 설정 기본값
 */
const DEFAULT_CONFIG = {
    position: 'left',
    width: 80,
    expandedWidth: 200,
    expandable: false,
    showTooltips: true,
    showShortcuts: true,
    animateSelection: true
};

/**
 * 기본 버튼 구성
 */
const DEFAULT_BUTTONS = [
    { id: 'connection', icon: 'connection', mode: 'connection', group: 'main' },
    { id: 'mapping', icon: 'mapping', mode: 'mapping', group: 'main' },
    { id: 'monitoring', icon: 'monitoring', mode: 'monitoring', group: 'main' },
    { id: 'divider-1', type: 'divider' },
    { id: 'edit', icon: 'edit', mode: 'edit', group: 'tools' },
    { id: 'layout', icon: 'layout', mode: 'layout', group: 'tools' },
    { id: 'viewer', icon: 'viewer', mode: 'viewer', group: 'tools' },
    { id: 'spacer', type: 'spacer' },
    { id: 'settings', icon: 'settings', mode: 'settings', group: 'utility' }
];

/**
 * Sidebar 클래스
 */
export class Sidebar {
    /**
     * @param {HTMLElement} container - 사이드바를 렌더링할 컨테이너
     * @param {Object} config - 설정 옵션
     */
    constructor(container, config = {}) {
        this.container = container;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.buttons = new Map();
        this.currentMode = null;
        this.element = null;
        this.eventHandlers = new Map();
        
        this._init();
    }
    
    /**
     * 초기화
     * @private
     */
    _init() {
        this._createElement();
        this._renderButtons(this.config.buttons || DEFAULT_BUTTONS);
        this._bindEvents();
        
        // 초기 모드 설정
        if (this.config.initialMode) {
            this.selectMode(this.config.initialMode);
        }
    }
    
    /**
     * 사이드바 요소 생성
     * @private
     */
    _createElement() {
        this.element = document.createElement('aside');
        this.element.className = 'cleanroom-sidebar';
        this.element.setAttribute('role', 'navigation');
        this.element.setAttribute('aria-label', 'Main Navigation');
        
        if (this.config.position === 'right') {
            this.element.classList.add('right');
        }
        
        this.container.appendChild(this.element);
    }
    
    /**
     * 버튼 렌더링
     * @private
     * @param {Array} buttonConfigs - 버튼 설정 배열
     */
    _renderButtons(buttonConfigs) {
        buttonConfigs.forEach(config => {
            if (config.type === 'divider') {
                this._renderDivider();
            } else if (config.type === 'spacer') {
                this._renderSpacer();
            } else {
                this._renderButton(config);
            }
        });
    }
    
    /**
     * 개별 버튼 렌더링
     * @private
     * @param {Object} config - 버튼 설정
     */
    _renderButton(config) {
        const iconInfo = iconRegistry.getIconInfo(config.icon);
        
        const button = new SidebarButton({
            id: config.id,
            icon: config.icon,
            mode: config.mode,
            tooltip: iconInfo?.name || config.tooltip,
            shortcut: iconInfo?.shortcut || config.shortcut,
            disabled: config.disabled || false,
            badge: config.badge || null
        });
        
        button.render(this.element);
        this.buttons.set(config.id, button);
        
        // 클릭 이벤트 연결
        button.onClick((id, mode) => {
            this._handleButtonClick(id, mode);
        });
    }
    
    /**
     * 구분선 렌더링
     * @private
     */
    _renderDivider() {
        const divider = document.createElement('div');
        divider.className = 'cleanroom-sidebar-divider';
        this.element.appendChild(divider);
    }
    
    /**
     * 스페이서 렌더링
     * @private
     */
    _renderSpacer() {
        const spacer = document.createElement('div');
        spacer.className = 'cleanroom-sidebar-spacer';
        this.element.appendChild(spacer);
    }
    
    /**
     * 이벤트 바인딩
     * @private
     */
    _bindEvents() {
        // 키보드 단축키
        document.addEventListener('keydown', this._handleKeydown.bind(this));
    }
    
    /**
     * 키보드 단축키 핸들러
     * @private
     * @param {KeyboardEvent} event
     */
    _handleKeydown(event) {
        // 입력 필드에서는 무시
        if (event.target.matches('input, textarea, select')) return;
        
        const key = event.key.toLowerCase();
        
        // Ctrl+K: Connection
        if (event.ctrlKey && key === 'k') {
            event.preventDefault();
            this.selectMode('connection');
            return;
        }
        
        // 단일 키 단축키
        const shortcuts = {
            'm': 'monitoring',
            'e': 'edit',
            'p': 'preview'
        };
        
        if (shortcuts[key]) {
            this.selectMode(shortcuts[key]);
        }
    }
    
    /**
     * 버튼 클릭 핸들러
     * @private
     * @param {string} id - 버튼 ID
     * @param {string} mode - 모드 이름
     */
    _handleButtonClick(id, mode) {
        this.selectMode(mode);
        
        // 외부 이벤트 핸들러 호출
        if (this.eventHandlers.has('modeChange')) {
            this.eventHandlers.get('modeChange').forEach(handler => {
                handler(mode, id);
            });
        }
    }
    
    /**
     * 모드 선택
     * @param {string} mode - 선택할 모드
     */
    selectMode(mode) {
        if (this.currentMode === mode) return;
        
        // 이전 선택 해제
        this.buttons.forEach(button => {
            button.setSelected(false);
        });
        
        // 새 선택
        this.buttons.forEach(button => {
            if (button.mode === mode) {
                button.setSelected(true);
            }
        });
        
        this.currentMode = mode;
    }
    
    /**
     * 버튼 활성화/비활성화
     * @param {string} id - 버튼 ID
     * @param {boolean} disabled - 비활성화 여부
     */
    setButtonDisabled(id, disabled) {
        const button = this.buttons.get(id);
        if (button) {
            button.setDisabled(disabled);
        }
    }
    
    /**
     * 버튼 뱃지 설정
     * @param {string} id - 버튼 ID
     * @param {string|number|null} badge - 뱃지 내용 (null이면 제거)
     * @param {string} type - 뱃지 타입 ('error', 'warning', 'info')
     */
    setButtonBadge(id, badge, type = 'error') {
        const button = this.buttons.get(id);
        if (button) {
            button.setBadge(badge, type);
        }
    }
    
    /**
     * 이벤트 핸들러 등록
     * @param {string} event - 이벤트 이름 ('modeChange')
     * @param {Function} handler - 핸들러 함수
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    /**
     * 이벤트 핸들러 제거
     * @param {string} event - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    /**
     * 현재 모드 반환
     * @returns {string|null}
     */
    getCurrentMode() {
        return this.currentMode;
    }
    
    /**
     * 사이드바 확장/축소 (미래 기능)
     * @param {boolean} expanded
     */
    setExpanded(expanded) {
        if (!this.config.expandable) return;
        
        this.element.classList.toggle('expanded', expanded);
    }
    
    /**
     * 정리
     */
    destroy() {
        document.removeEventListener('keydown', this._handleKeydown);
        
        this.buttons.forEach(button => {
            button.destroy();
        });
        this.buttons.clear();
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.eventHandlers.clear();
    }
}

export default Sidebar;
