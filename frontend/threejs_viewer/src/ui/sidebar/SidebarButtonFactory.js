/**
 * SidebarButtonFactory.js
 * =======================
 * Sidebar 버튼 생성 유틸리티 함수 모듈
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * @source Sidebar.js v1.4.0 (버튼 생성 메서드)
 * 
 * @description
 * Sidebar.js 리팩토링 Phase 4
 * - 버튼 생성 함수 분리
 * - 서브메뉴 포함 버튼 생성 함수 분리
 * - 구분선, 스페이서, Dev Mode 뱃지 생성 함수 분리
 * 
 * @usage
 * import { 
 *     createButton, 
 *     createButtonWithSubmenu,
 *     createDivider,
 *     createSpacer,
 *     createDevModeBadge
 * } from './SidebarButtonFactory.js';
 * 
 * const btn = createButton(config, getIcon, onClick);
 * container.appendChild(btn);
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/SidebarButtonFactory.js
 */

// ============================================
// Button Creation Functions
// ============================================

/**
 * 단일 버튼 생성
 * 
 * @param {Object} config - SIDEBAR_BUTTONS[key] 설정
 * @param {Function} getIcon - IconRegistry.getIcon 함수
 * @param {Function} onClick - 클릭 핸들러 (event) => void
 * @returns {HTMLButtonElement} 생성된 버튼 요소
 */
export function createButton(config, getIcon, onClick) {
    if (!config) return null;
    
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = config.id;
    btn.dataset.mode = config.mode;
    
    if (config.tooltip) {
        btn.dataset.tooltip = config.tooltip;
    }
    
    // 아이콘 삽입
    btn.innerHTML = getIcon(config.icon);
    
    // 초기 상태 적용
    if (config.disabled) {
        btn.classList.add('disabled');
    }
    if (config.hidden) {
        btn.classList.add('hidden');
    }
    
    // 클릭 이벤트
    if (onClick) {
        btn.addEventListener('click', onClick);
    }
    
    return btn;
}

/**
 * 서브메뉴 포함 버튼 생성 (wrapper + button + submenu)
 * 
 * @param {Object} config - SIDEBAR_BUTTONS[key] 설정
 * @param {Function} getIcon - IconRegistry.getIcon 함수
 * @param {HTMLElement} submenu - 서브메뉴 요소
 * @param {Function} onClick - 클릭 핸들러 (event) => void
 * @returns {Object} { wrapper: HTMLDivElement, button: HTMLButtonElement }
 */
export function createButtonWithSubmenu(config, getIcon, submenu, onClick) {
    if (!config) return null;
    
    // Wrapper 생성
    const wrapper = document.createElement('div');
    wrapper.className = 'has-submenu';
    wrapper.id = `${config.id}-wrapper`;
    
    if (config.tooltip) {
        wrapper.dataset.tooltip = config.tooltip;
    }
    if (config.hidden) {
        wrapper.classList.add('hidden');
    }
    if (config.disabled || config.requiresConnection) {
        wrapper.classList.add('disabled');
    }
    
    // Button 생성
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = config.id;
    btn.dataset.mode = config.mode;
    
    if (config.disabled || config.requiresConnection) {
        btn.classList.add('disabled');
    }
    
    btn.innerHTML = getIcon(config.icon);
    
    // 클릭 이벤트
    if (onClick) {
        btn.addEventListener('click', (e) => {
            if (!btn.classList.contains('disabled')) {
                onClick(e);
            }
        });
    }
    
    // 조립
    wrapper.appendChild(btn);
    if (submenu) {
        wrapper.appendChild(submenu);
    }
    
    return { wrapper, button: btn };
}

/**
 * 구분선 생성
 * 
 * @returns {HTMLDivElement} 구분선 요소
 */
export function createDivider() {
    const divider = document.createElement('div');
    divider.className = 'sidebar-divider';
    return divider;
}

/**
 * 스페이서 생성 (버튼들을 위/아래로 분리)
 * 
 * @returns {HTMLDivElement} 스페이서 요소
 */
export function createSpacer() {
    const spacer = document.createElement('div');
    spacer.className = 'sidebar-spacer';
    return spacer;
}

/**
 * Dev Mode 뱃지 생성
 * 
 * @returns {HTMLDivElement} Dev Mode 뱃지 요소
 */
export function createDevModeBadge() {
    let badge = document.getElementById('dev-mode-badge');
    
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'dev-mode-badge';
        badge.id = 'dev-mode-badge';
        badge.textContent = '⚡ DEV MODE';
        document.body.appendChild(badge);
    }
    
    return badge;
}

/**
 * 하단 여백 생성 (사이드바 스크롤 여유)
 * 
 * @param {string} height - CSS 높이 값 (기본: '50px')
 * @returns {HTMLDivElement} 여백 요소
 */
export function createBottomPadding(height = '50px') {
    const padding = document.createElement('div');
    padding.style.height = height;
    return padding;
}

// ============================================
// Button State Update Functions
// ============================================

/**
 * 버튼 상태 업데이트
 * 
 * @param {HTMLButtonElement} button - 버튼 요소
 * @param {Object} config - SIDEBAR_BUTTONS[key] 설정
 * @param {Object} state - { isConnected, devModeEnabled }
 * @returns {Object} { shouldDisable, shouldHide, tooltip }
 */
export function calculateButtonState(config, state) {
    const { isConnected, devModeEnabled } = state;
    
    let shouldDisable = false;
    let shouldHide = false;
    
    // 연결 또는 Dev Mode 체크
    if (config.requiresConnection && !isConnected && !devModeEnabled) {
        shouldDisable = true;
    }
    
    if (config.requiresDevMode && !devModeEnabled) {
        shouldHide = true;
    }
    
    if (config.requiresDevModeOrConnection) {
        if (!devModeEnabled && !isConnected) {
            shouldDisable = true;
        }
    }
    
    if (config.alwaysEnabled) {
        shouldDisable = false;
    }
    
    if (config.disabled) {
        shouldDisable = true;
    }
    
    // Tooltip 계산
    const tooltip = shouldDisable && !config.alwaysEnabled
        ? `${config.tooltip} (Enable Dev Mode)`
        : config.tooltip;
    
    return { shouldDisable, shouldHide, tooltip };
}

/**
 * 버튼 DOM 상태 적용
 * 
 * @param {HTMLButtonElement} button - 버튼 요소
 * @param {HTMLDivElement|null} wrapper - 래퍼 요소 (있는 경우)
 * @param {Object} stateResult - calculateButtonState 결과
 */
export function applyButtonState(button, wrapper, stateResult) {
    const { shouldDisable, shouldHide, tooltip } = stateResult;
    
    if (!button) return;
    
    button.classList.toggle('disabled', shouldDisable);
    
    if (wrapper) {
        wrapper.classList.toggle('disabled', shouldDisable);
        wrapper.classList.toggle('hidden', shouldHide);
        wrapper.dataset.tooltip = tooltip;
    } else {
        button.classList.toggle('hidden', shouldHide);
        button.dataset.tooltip = tooltip;
    }
}

/**
 * 버튼 선택 상태 설정
 * 
 * @param {HTMLButtonElement} button - 버튼 요소
 * @param {boolean} selected - 선택 여부
 */
export function setButtonSelected(button, selected) {
    if (button) {
        button.classList.toggle('selected', selected);
    }
}

/**
 * 버튼 활성화 상태 설정
 * 
 * @param {HTMLButtonElement} button - 버튼 요소
 * @param {HTMLDivElement|null} wrapper - 래퍼 요소 (있는 경우)
 * @param {boolean} enabled - 활성화 여부
 */
export function setButtonEnabled(button, wrapper, enabled) {
    if (button) {
        button.classList.toggle('disabled', !enabled);
    }
    if (wrapper) {
        wrapper.classList.toggle('disabled', !enabled);
    }
}

/**
 * 버튼 가시성 설정
 * 
 * @param {HTMLButtonElement} button - 버튼 요소
 * @param {HTMLDivElement|null} wrapper - 래퍼 요소 (있는 경우)
 * @param {boolean} visible - 가시성 여부
 */
export function setButtonVisible(button, wrapper, visible) {
    if (wrapper) {
        wrapper.classList.toggle('hidden', !visible);
    } else if (button) {
        button.classList.toggle('hidden', !visible);
    }
}

// ============================================
// Default Export
// ============================================

export default {
    // Creation
    createButton,
    createButtonWithSubmenu,
    createDivider,
    createSpacer,
    createDevModeBadge,
    createBottomPadding,
    
    // State Management
    calculateButtonState,
    applyButtonState,
    setButtonSelected,
    setButtonEnabled,
    setButtonVisible
};