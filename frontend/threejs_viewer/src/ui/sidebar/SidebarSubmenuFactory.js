/**
 * SidebarSubmenuFactory.js
 * ========================
 * Sidebar 서브메뉴 생성 유틸리티 함수 모듈
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * @source Sidebar.js v1.4.0 (서브메뉴 생성 메서드)
 * 
 * @description
 * Sidebar.js 리팩토링 Phase 4
 * - 서브메뉴 생성 함수 분리
 * - 테마 토글 생성 함수 분리
 * - Mock Test 섹션 생성 함수 분리
 * 
 * @usage
 * import { 
 *     createSubmenu, 
 *     createThemeToggle,
 *     createMockTestSection,
 *     updateSubmenuActiveState
 * } from './SidebarSubmenuFactory.js';
 * 
 * const submenu = createSubmenu(config, getIcon, onItemClick);
 * wrapper.appendChild(submenu);
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/SidebarSubmenuFactory.js
 */

// ============================================
// Submenu Creation Functions
// ============================================

/**
 * 서브메뉴 생성
 * 
 * @param {Object} config - SUBMENUS[submenuId] 설정
 * @param {Function} getIcon - IconRegistry.getIcon 함수
 * @param {Function} onItemClick - 아이템 클릭 핸들러 (item) => void
 * @param {Object} context - 추가 컨텍스트 { currentTheme, onThemeToggle, onMockTestSelect }
 * @returns {HTMLDivElement} 서브메뉴 요소
 */
export function createSubmenu(config, getIcon, onItemClick, context = {}) {
    if (!config) {
        return document.createElement('div');
    }
    
    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    
    if (config.id) {
        submenu.id = config.id;
    }
    
    // Header 생성
    if (config.header) {
        const header = document.createElement('div');
        header.className = 'submenu-header';
        header.textContent = config.header;
        submenu.appendChild(header);
    }
    
    // Items 생성
    if (config.items && Array.isArray(config.items)) {
        config.items.forEach(item => {
            const element = createSubmenuItem(item, getIcon, onItemClick, context);
            if (element) {
                submenu.appendChild(element);
            }
        });
    }
    
    return submenu;
}

/**
 * 서브메뉴 아이템 생성
 * 
 * @param {Object} item - 아이템 설정
 * @param {Function} getIcon - IconRegistry.getIcon 함수
 * @param {Function} onItemClick - 아이템 클릭 핸들러
 * @param {Object} context - 추가 컨텍스트
 * @returns {HTMLElement|null} 아이템 요소
 */
export function createSubmenuItem(item, getIcon, onItemClick, context = {}) {
    // 구분선
    if (item.type === 'divider') {
        const divider = document.createElement('div');
        divider.className = 'submenu-divider';
        return divider;
    }
    
    // 테마 토글
    if (item.type === 'theme-toggle') {
        return createThemeToggle(context.currentTheme, context.onThemeToggle, getIcon);
    }
    
    // Mock Test 섹션
    if (item.type === 'mock-tests') {
        return createMockTestSection(context.onMockTestSelect);
    }
    
    // 일반 메뉴 아이템
    const menuItem = document.createElement('button');
    menuItem.className = 'submenu-item';
    
    if (item.id) {
        menuItem.id = item.id;
    }
    if (item.disabled) {
        menuItem.classList.add('disabled');
    }
    if (item.requiresDevMode) {
        menuItem.dataset.requiresDevMode = 'true';
    }
    if (item.submode) {
        menuItem.dataset.submode = item.submode;
    }
    
    // 아이콘 + 라벨 또는 텍스트만
    if (item.icon && getIcon) {
        menuItem.innerHTML = `${getIcon(item.icon)}<span>${item.label}</span>`;
    } else if (item.label) {
        menuItem.textContent = item.label;
    }
    
    // 클릭 이벤트
    menuItem.addEventListener('click', () => {
        if (menuItem.classList.contains('disabled')) return;
        if (onItemClick) {
            onItemClick(item);
        }
    });
    
    return menuItem;
}

/**
 * 테마 토글 생성
 * 
 * @param {string} currentTheme - 현재 테마 ('dark' | 'light')
 * @param {Function} onToggle - 토글 핸들러 () => void
 * @param {Function} getIcon - IconRegistry.getIcon 함수
 * @returns {HTMLDivElement} 테마 토글 컨테이너
 */
export function createThemeToggle(currentTheme, onToggle, getIcon) {
    const container = document.createElement('div');
    container.className = 'theme-toggle-item';
    
    // 아이콘과 라벨
    const iconHtml = getIcon ? getIcon('sun') : '☀️';
    container.innerHTML = `
        <div class="theme-toggle-label">
            ${iconHtml}
            <span>Theme</span>
        </div>
        <div class="theme-switch" id="theme-switch"></div>
    `;
    
    // 현재 테마 반영
    const themeSwitch = container.querySelector('.theme-switch');
    if (currentTheme === 'light' && themeSwitch) {
        themeSwitch.classList.add('active');
    }
    
    // 토글 이벤트
    if (themeSwitch && onToggle) {
        themeSwitch.addEventListener('click', onToggle);
    }
    
    return container;
}

/**
 * Mock Test 섹션 생성
 * 
 * @param {Function} onTestSelect - 테스트 선택 핸들러 (testName) => void
 * @returns {HTMLDivElement} Mock Test 섹션 요소
 */
export function createMockTestSection(onTestSelect) {
    const section = document.createElement('div');
    section.id = 'mock-test-section';
    section.style.display = 'none';  // 기본 숨김 (Dev Mode에서만 표시)
    
    section.innerHTML = `
        <div class="submenu-divider"></div>
        <div class="submenu-header">Mock Test Files</div>
        <div class="mock-test-list">
            <div class="mock-test-item" data-test="equipment-status">📦 Equipment Status Test</div>
            <div class="mock-test-item" data-test="realtime-update">🔄 Realtime Update Test</div>
            <div class="mock-test-item" data-test="multi-site">🌐 Multi-Site Test</div>
        </div>
    `;
    
    // 테스트 선택 이벤트
    section.querySelectorAll('.mock-test-item').forEach(item => {
        item.addEventListener('click', () => {
            const testName = item.dataset.test;
            if (onTestSelect) {
                onTestSelect(testName);
            }
        });
    });
    
    return section;
}

// ============================================
// Submenu State Update Functions
// ============================================

/**
 * 서브메뉴 아이템 활성 상태 업데이트
 * 
 * @param {string|null} activeSubmode - 활성화할 서브모드
 */
export function updateSubmenuActiveState(activeSubmode) {
    // 모든 아이템 비활성화
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 해당 서브모드 활성화
    if (activeSubmode) {
        const activeItem = document.querySelector(
            `.submenu-item[data-submode="${activeSubmode}"]`
        );
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}

/**
 * Mock Test 섹션 가시성 설정
 * 
 * @param {boolean} visible - 가시성 여부
 */
export function setMockTestSectionVisible(visible) {
    const section = document.getElementById('mock-test-section');
    if (section) {
        section.style.display = visible ? 'block' : 'none';
    }
}

/**
 * 테마 스위치 상태 업데이트
 * 
 * @param {string} theme - 현재 테마 ('dark' | 'light')
 */
export function updateThemeSwitchState(theme) {
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        themeSwitch.classList.toggle('active', theme === 'light');
    }
}

/**
 * Dev Mode 레이블 업데이트
 * 
 * @param {boolean} enabled - Dev Mode 활성화 여부
 */
export function updateDevModeLabel(enabled) {
    const devModeLabel = document.getElementById('dev-mode-toggle');
    if (!devModeLabel) return;
    
    const labelText = `Dev Mode: ${enabled ? 'ON' : 'OFF'}`;
    
    // span 요소 찾기
    const labelSpan = devModeLabel.querySelector('span');
    if (labelSpan) {
        labelSpan.textContent = labelText;
    } else {
        // span이 없으면 생성
        const icon = devModeLabel.querySelector('svg');
        if (icon) {
            devModeLabel.innerHTML = '';
            devModeLabel.appendChild(icon);
            const span = document.createElement('span');
            span.textContent = labelText;
            devModeLabel.appendChild(span);
        } else {
            devModeLabel.textContent = labelText;
        }
    }
}

/**
 * Dev Mode 뱃지 상태 업데이트
 * 
 * @param {boolean} enabled - Dev Mode 활성화 여부
 */
export function updateDevModeBadge(enabled) {
    const badge = document.getElementById('dev-mode-badge');
    if (badge) {
        badge.classList.toggle('active', enabled);
    }
}

// ============================================
// Helper Functions
// ============================================

/**
 * 서브메뉴 아이템 찾기
 * 
 * @param {string} submenuId - 서브메뉴 ID
 * @param {string} itemId - 아이템 ID
 * @returns {HTMLElement|null} 아이템 요소
 */
export function findSubmenuItem(submenuId, itemId) {
    const submenu = document.getElementById(submenuId);
    if (!submenu) return null;
    return submenu.querySelector(`#${itemId}`);
}

/**
 * 서브메뉴 아이템 활성화/비활성화
 * 
 * @param {string} itemId - 아이템 ID
 * @param {boolean} enabled - 활성화 여부
 */
export function setSubmenuItemEnabled(itemId, enabled) {
    const item = document.getElementById(itemId);
    if (item) {
        item.classList.toggle('disabled', !enabled);
    }
}

// ============================================
// Default Export
// ============================================

export default {
    // Creation
    createSubmenu,
    createSubmenuItem,
    createThemeToggle,
    createMockTestSection,
    
    // State Management
    updateSubmenuActiveState,
    setMockTestSectionVisible,
    updateThemeSwitchState,
    updateDevModeLabel,
    updateDevModeBadge,
    
    // Helpers
    findSubmenuItem,
    setSubmenuItemEnabled
};