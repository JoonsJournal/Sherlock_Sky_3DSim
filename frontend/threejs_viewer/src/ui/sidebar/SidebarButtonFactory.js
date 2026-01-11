/**
 * SidebarButtonFactory.js
 * =======================
 * Sidebar 버튼 생성 유틸리티 함수 모듈
 * 
 * @version 1.1.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * 
 * @changelog
 * - v1.1.0: 🔧 createDevModeBadge() deprecated (ModeIndicatorPanel로 대체)
 * - v1.0.0: 초기 버전
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/SidebarButtonFactory.js
 */

// ============================================
// Button Creation Functions
// ============================================

export function createButton(config, getIcon, onClick) {
    if (!config) return null;
    
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = config.id;
    btn.dataset.mode = config.mode;
    
    if (config.tooltip) {
        btn.dataset.tooltip = config.tooltip;
    }
    
    btn.innerHTML = getIcon(config.icon);
    
    if (config.disabled) {
        btn.classList.add('disabled');
    }
    if (config.hidden) {
        btn.classList.add('hidden');
    }
    
    if (onClick) {
        btn.addEventListener('click', onClick);
    }
    
    return btn;
}

export function createButtonWithSubmenu(config, getIcon, submenu, onClick) {
    if (!config) return null;
    
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
    
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = config.id;
    btn.dataset.mode = config.mode;
    
    if (config.disabled || config.requiresConnection) {
        btn.classList.add('disabled');
    }
    
    btn.innerHTML = getIcon(config.icon);
    
    if (onClick) {
        btn.addEventListener('click', (e) => {
            if (!btn.classList.contains('disabled')) {
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
    divider.className = 'sidebar-divider';
    return divider;
}

export function createSpacer() {
    const spacer = document.createElement('div');
    spacer.className = 'sidebar-spacer';
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
    badge.className = 'dev-mode-badge';
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

export function setButtonSelected(button, selected) {
    if (button) {
        button.classList.toggle('selected', selected);
    }
}

export function setButtonEnabled(button, wrapper, enabled) {
    if (button) {
        button.classList.toggle('disabled', !enabled);
    }
    if (wrapper) {
        wrapper.classList.toggle('disabled', !enabled);
    }
}

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
    createButton,
    createButtonWithSubmenu,
    createDivider,
    createSpacer,
    createDevModeBadge,
    createBottomPadding,
    calculateButtonState,
    applyButtonState,
    setButtonSelected,
    setButtonEnabled,
    setButtonVisible
};