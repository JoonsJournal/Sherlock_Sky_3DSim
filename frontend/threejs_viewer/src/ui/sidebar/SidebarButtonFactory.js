/**
 * SidebarButtonFactory.js
 * =======================
 * Sidebar 버튼 생성 유틸리티 함수 모듈
 * 
 * @version 2.0.0
 * @created 2026-01-11
 * @modified 2026-01-15
 * 
 * @changelog
 * - 🆕 v2.0.0: Phase 4 CSS Integration
 *   - SIDEBAR_CSS 상수 객체 추가
 *   - BEM 네이밍 규칙 적용
 * - v1.1.0: createDevModeBadge() deprecated (ModeIndicatorPanel로 대체)
 * - v1.0.0: 초기 버전
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/SidebarButtonFactory.js
 */

// ============================================
// CSS 클래스 상수 (Phase 4)
// ============================================

/**
 * Sidebar 버튼 관련 BEM 클래스명 상수
 * @constant
 */
export const SIDEBAR_CSS = {
    // Icon Button
    ICON_BTN: 'sidebar__icon-btn',
    ICON_BTN_DISABLED: 'sidebar__icon-btn--disabled',
    ICON_BTN_SELECTED: 'sidebar__icon-btn--selected',
    ICON_BTN_HIDDEN: 'sidebar__icon-btn--hidden',
    
    // Wrapper
    HAS_SUBMENU: 'sidebar__has-submenu',
    HAS_SUBMENU_DISABLED: 'sidebar__has-submenu--disabled',
    HAS_SUBMENU_HIDDEN: 'sidebar__has-submenu--hidden',
    
    // Divider & Spacer
    DIVIDER: 'sidebar__divider',
    SPACER: 'sidebar__spacer',
    
    // Dev Mode Badge
    DEV_BADGE: 'sidebar__dev-badge',
    DEV_BADGE_ACTIVE: 'sidebar__dev-badge--active',
    
    // Legacy aliases (하위 호환)
    LEGACY_ICON_BTN: 'icon-btn',
    LEGACY_DISABLED: 'disabled',
    LEGACY_SELECTED: 'selected',
    LEGACY_HIDDEN: 'hidden',
    LEGACY_HAS_SUBMENU: 'has-submenu',
    LEGACY_DIVIDER: 'sidebar-divider',
    LEGACY_SPACER: 'sidebar-spacer',
    LEGACY_DEV_BADGE: 'dev-mode-badge'
};

// ============================================
// Button Creation Functions
// ============================================

export function createButton(config, getIcon, onClick) {
    if (!config) return null;
    
    const btn = document.createElement('button');
    // BEM + Legacy 클래스 적용
    btn.classList.add(SIDEBAR_CSS.ICON_BTN, SIDEBAR_CSS.LEGACY_ICON_BTN);
    btn.id = config.id;
    btn.dataset.mode = config.mode;
    
    if (config.tooltip) {
        btn.dataset.tooltip = config.tooltip;
    }
    
    btn.innerHTML = getIcon(config.icon);
    
    if (config.disabled) {
        btn.classList.add(SIDEBAR_CSS.ICON_BTN_DISABLED, SIDEBAR_CSS.LEGACY_DISABLED);
    }
    if (config.hidden) {
        btn.classList.add(SIDEBAR_CSS.ICON_BTN_HIDDEN, SIDEBAR_CSS.LEGACY_HIDDEN);
    }
    
    if (onClick) {
        btn.addEventListener('click', onClick);
    }
    
    return btn;
}

export function createButtonWithSubmenu(config, getIcon, submenu, onClick) {
    if (!config) return null;
    
    const wrapper = document.createElement('div');
    // BEM + Legacy 클래스 적용
    wrapper.classList.add(SIDEBAR_CSS.HAS_SUBMENU, SIDEBAR_CSS.LEGACY_HAS_SUBMENU);
    wrapper.id = `${config.id}-wrapper`;
    
    if (config.tooltip) {
        wrapper.dataset.tooltip = config.tooltip;
    }
    if (config.hidden) {
        wrapper.classList.add(SIDEBAR_CSS.HAS_SUBMENU_HIDDEN, SIDEBAR_CSS.LEGACY_HIDDEN);
    }
    if (config.disabled || config.requiresConnection) {
        wrapper.classList.add(SIDEBAR_CSS.HAS_SUBMENU_DISABLED, SIDEBAR_CSS.LEGACY_DISABLED);
    }
    
    const btn = document.createElement('button');
    btn.classList.add(SIDEBAR_CSS.ICON_BTN, SIDEBAR_CSS.LEGACY_ICON_BTN);
    btn.id = config.id;
    btn.dataset.mode = config.mode;
    
    if (config.disabled || config.requiresConnection) {
        btn.classList.add(SIDEBAR_CSS.ICON_BTN_DISABLED, SIDEBAR_CSS.LEGACY_DISABLED);
    }
    
    btn.innerHTML = getIcon(config.icon);
    
    if (onClick) {
        btn.addEventListener('click', (e) => {
            if (!btn.classList.contains(SIDEBAR_CSS.LEGACY_DISABLED)) {
                onClick(e);
            }
        });
    }
    
    wrapper.appendChild(btn);
    if (submenu) {
        wrapper.appendChild(submenu);
    }
    
    return { wrapper, button: btn };
}

export function createDivider() {
    const divider = document.createElement('div');
    divider.classList.add(SIDEBAR_CSS.DIVIDER, SIDEBAR_CSS.LEGACY_DIVIDER);
    return divider;
}

export function createSpacer() {
    const spacer = document.createElement('div');
    spacer.classList.add(SIDEBAR_CSS.SPACER, SIDEBAR_CSS.LEGACY_SPACER);
    return spacer;
}

/**
 * @deprecated v1.1.0: ModeIndicatorPanel 사용을 권장합니다.
 */
export function createDevModeBadge() {
    console.warn('[SidebarButtonFactory] createDevModeBadge() is deprecated. Use ModeIndicatorPanel instead.');
    
    let badge = document.getElementById('dev-mode-badge');
    
    if (badge) {
        return badge;
    }
    
    badge = document.createElement('div');
    badge.classList.add(SIDEBAR_CSS.DEV_BADGE, SIDEBAR_CSS.LEGACY_DEV_BADGE);
    badge.id = 'dev-mode-badge';
    badge.textContent = '⚡ DEV MODE';
    document.body.appendChild(badge);
    
    return badge;
}

export function createBottomPadding(height = '50px') {
    const padding = document.createElement('div');
    padding.style.height = height;
    return padding;
}

// ============================================
// Button State Update Functions
// ============================================

export function calculateButtonState(config, state) {
    const { isConnected, devModeEnabled } = state;
    
    let shouldDisable = false;
    let shouldHide = false;
    
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
    
    const tooltip = shouldDisable && !config.alwaysEnabled
        ? `${config.tooltip} (Enable Dev Mode)`
        : config.tooltip;
    
    return { shouldDisable, shouldHide, tooltip };
}

export function applyButtonState(button, wrapper, stateResult) {
    const { shouldDisable, shouldHide, tooltip } = stateResult;
    
    if (!button) return;
    
    // BEM + Legacy 클래스 토글
    button.classList.toggle(SIDEBAR_CSS.ICON_BTN_DISABLED, shouldDisable);
    button.classList.toggle(SIDEBAR_CSS.LEGACY_DISABLED, shouldDisable);
    
    if (wrapper) {
        wrapper.classList.toggle(SIDEBAR_CSS.HAS_SUBMENU_DISABLED, shouldDisable);
        wrapper.classList.toggle(SIDEBAR_CSS.LEGACY_DISABLED, shouldDisable);
        wrapper.classList.toggle(SIDEBAR_CSS.HAS_SUBMENU_HIDDEN, shouldHide);
        wrapper.classList.toggle(SIDEBAR_CSS.LEGACY_HIDDEN, shouldHide);
        wrapper.dataset.tooltip = tooltip;
    } else {
        button.classList.toggle(SIDEBAR_CSS.ICON_BTN_HIDDEN, shouldHide);
        button.classList.toggle(SIDEBAR_CSS.LEGACY_HIDDEN, shouldHide);
        button.dataset.tooltip = tooltip;
    }
}

export function setButtonSelected(button, selected) {
    if (button) {
        button.classList.toggle(SIDEBAR_CSS.ICON_BTN_SELECTED, selected);
        button.classList.toggle(SIDEBAR_CSS.LEGACY_SELECTED, selected);
    }
}

export function setButtonEnabled(button, wrapper, enabled) {
    if (button) {
        button.classList.toggle(SIDEBAR_CSS.ICON_BTN_DISABLED, !enabled);
        button.classList.toggle(SIDEBAR_CSS.LEGACY_DISABLED, !enabled);
    }
    if (wrapper) {
        wrapper.classList.toggle(SIDEBAR_CSS.HAS_SUBMENU_DISABLED, !enabled);
        wrapper.classList.toggle(SIDEBAR_CSS.LEGACY_DISABLED, !enabled);
    }
}

export function setButtonVisible(button, wrapper, visible) {
    if (wrapper) {
        wrapper.classList.toggle(SIDEBAR_CSS.HAS_SUBMENU_HIDDEN, !visible);
        wrapper.classList.toggle(SIDEBAR_CSS.LEGACY_HIDDEN, !visible);
    } else if (button) {
        button.classList.toggle(SIDEBAR_CSS.ICON_BTN_HIDDEN, !visible);
        button.classList.toggle(SIDEBAR_CSS.LEGACY_HIDDEN, !visible);
    }
}

// ============================================
// Default Export
// ============================================

export default {
    // CSS Constants
    SIDEBAR_CSS,
    
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
