/**
 * Sidebar.js
 * ==========
 * Cleanroom Sidebar UI 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.4.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * 
 * @changelog
 * - v1.4.0: 🔧 Connection Modal 분리 (Phase 3 리팩토링)
 *           - ConnectionModalManager.js로 Modal 코드 분리
 *           - 약 440줄 감소
 *           - Sidebar는 Modal 컨트롤만 담당
 * - v1.3.0: 🔧 상수/설정 분리 (Phase 2 리팩토링)
 *           - SIDEBAR_BUTTONS → SidebarConfig.js
 *           - SUBMENUS → SidebarConfig.js
 *           - SITE_LIST → SidebarConfig.js
 *           - MODE_MAP → SidebarConfig.js
 * - v1.2.0: 🔧 Connection Modal v2.9 Full Version 복원
 * - v1.1.0: Connection Modal 동적 생성 추가
 * - v1.0.0: 초기 버전
 * 
 * @description
 * - 기존 floating-btn 시스템 대체
 * - AppModeManager와 연동하여 모드 전환
 * - ConnectionStatusService와 연동하여 상태 관리
 * - ConnectionModalManager를 통한 연결 관리
 * 
 * 의존성:
 * - AppModeManager (core/managers)
 * - EventBus (core/managers)
 * - ConnectionStatusService (services)
 * - IconRegistry (ui/sidebar)
 * - SidebarConfig (ui/sidebar)
 * - ConnectionModalManager (ui/sidebar) 🆕 v1.4.0
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/Sidebar.js
 */

import { ICONS, getIcon } from './IconRegistry.js';

// 🆕 v1.3.0: 상수/설정 import
import { 
    SIDEBAR_BUTTONS, 
    SUBMENUS, 
    SITE_LIST, 
    MODE_MAP,
    getSiteById 
} from './SidebarConfig.js';

// 🆕 v1.4.0: Connection Modal Manager import
import { ConnectionModalManager } from './ConnectionModalManager.js';

// ============================================
// Sidebar Class
// ============================================

export class Sidebar {
    /**
     * @param {Object} options
     * @param {Object} options.appModeManager - AppModeManager 인스턴스
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
     * @param {Object} options.toast - Toast 인스턴스
     * @param {Object} options.APP_MODE - APP_MODE 상수
     * @param {Object} options.callbacks - 콜백 함수들
     */
    constructor(options = {}) {
        // 의존성 주입
        this.appModeManager = options.appModeManager || null;
        this.eventBus = options.eventBus || null;
        this.connectionStatusService = options.connectionStatusService || null;
        this.toast = options.toast || null;
        this.APP_MODE = options.APP_MODE || {};
        
        // 콜백 함수들
        this.callbacks = {
            toggleConnectionModal: options.callbacks?.toggleConnectionModal || null,
            toggleDebugPanel: options.callbacks?.toggleDebugPanel || (() => {}),
            openEquipmentEditModal: options.callbacks?.openEquipmentEditModal || (() => {}),
            ...options.callbacks
        };
        
        // 상태
        this.isConnected = false;
        this.devModeEnabled = false;
        this.currentMode = null;
        this.currentSubMode = null;
        this.currentTheme = 'dark';
        
        // 🆕 v1.4.0: selectedSite는 ConnectionModalManager에서 관리
        // Sidebar는 isConnected 상태만 추적
        
        // DOM 참조
        this.element = null;
        this.buttons = new Map();
        this.submenus = new Map();
        
        // 🆕 v1.4.0: Connection Modal Manager
        this.connectionModalManager = null;
        
        // 이벤트 리스너 정리용
        this._eventUnsubscribers = [];
        
        // 초기화
        this._init();
    }
    
    // ========================================
    // Initialization
    // ========================================
    
    _init() {
        this._loadTheme();
        this._createDOM();
        this._createConnectionModalManager();  // 🆕 v1.4.0
        this._setupEventListeners();
        this._setupAppModeListeners();
        this._setupConnectionListeners();
        this._updateButtonStates();
        
        console.log('[Sidebar] 초기화 완료 v1.4.0');
    }
    
    _loadTheme() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    _createDOM() {
        // 기존 사이드바가 있으면 제거
        const existing = document.getElementById('sidebar');
        if (existing) existing.remove();
        
        // 사이드바 컨테이너
        this.element = document.createElement('aside');
        this.element.className = 'sidebar';
        this.element.id = 'sidebar';
        
        // 버튼들 생성
        this._createButton('connection');
        this._createButtonWithSubmenu('monitoring');
        this._createButton('analysis');
        this._createButton('simulation');
        
        // 구분선
        this._createDivider();
        
        // Layout (Dev Mode용)
        this._createButtonWithSubmenu('layout');
        
        // 스페이서
        this._createSpacer();
        
        // 하단 버튼들
        this._createButtonWithSubmenu('debug');
        this._createButtonWithSubmenu('settings');
        
        // 하단 여백
        const bottomPadding = document.createElement('div');
        bottomPadding.style.height = '50px';
        this.element.appendChild(bottomPadding);
        
        // body에 삽입 (맨 앞에)
        document.body.insertBefore(this.element, document.body.firstChild);
        
        // Dev Mode Badge 생성
        this._createDevModeBadge();
    }
    
    _createButton(key) {
        const config = SIDEBAR_BUTTONS[key];
        if (!config) return null;
        
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.id = config.id;
        btn.dataset.mode = config.mode;
        if (config.tooltip) btn.dataset.tooltip = config.tooltip;
        
        btn.innerHTML = getIcon(config.icon);
        
        // 초기 상태
        if (config.disabled) btn.classList.add('disabled');
        if (config.hidden) btn.classList.add('hidden');
        
        // 클릭 이벤트
        btn.addEventListener('click', (e) => this._handleButtonClick(key, e));
        
        this.element.appendChild(btn);
        this.buttons.set(key, btn);
        
        return btn;
    }
    
    _createButtonWithSubmenu(key) {
        const config = SIDEBAR_BUTTONS[key];
        if (!config || !config.hasSubmenu) {
            return this._createButton(key);
        }
        
        // Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'has-submenu';
        wrapper.id = `${config.id}-wrapper`;
        if (config.tooltip) wrapper.dataset.tooltip = config.tooltip;
        if (config.hidden) wrapper.classList.add('hidden');
        if (config.disabled || config.requiresConnection) wrapper.classList.add('disabled');
        
        // Button
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.id = config.id;
        btn.dataset.mode = config.mode;
        if (config.disabled || config.requiresConnection) btn.classList.add('disabled');
        
        btn.innerHTML = getIcon(config.icon);
        
        // Submenu
        const submenu = this._createSubmenu(config.submenuId);
        
        wrapper.appendChild(btn);
        wrapper.appendChild(submenu);
        
        // 클릭 이벤트
        btn.addEventListener('click', (e) => {
            if (!btn.classList.contains('disabled')) {
                this._handleButtonClick(key, e);
            }
        });
        
        this.element.appendChild(wrapper);
        this.buttons.set(key, btn);
        this.submenus.set(config.submenuId, submenu);
        
        return wrapper;
    }
    
    _createSubmenu(submenuId) {
        const config = SUBMENUS[submenuId];
        if (!config) return document.createElement('div');
        
        const submenu = document.createElement('div');
        submenu.className = 'submenu';
        submenu.id = submenuId;
        
        // Header
        if (config.header) {
            const header = document.createElement('div');
            header.className = 'submenu-header';
            header.textContent = config.header;
            submenu.appendChild(header);
        }
        
        // Items
        config.items.forEach(item => {
            if (item.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'submenu-divider';
                submenu.appendChild(divider);
            } else if (item.type === 'theme-toggle') {
                submenu.appendChild(this._createThemeToggle());
            } else if (item.type === 'mock-tests') {
                submenu.appendChild(this._createMockTestSection());
            } else {
                const menuItem = document.createElement('button');
                menuItem.className = 'submenu-item';
                menuItem.id = item.id;
                if (item.disabled) menuItem.classList.add('disabled');
                if (item.requiresDevMode) menuItem.dataset.requiresDevMode = 'true';
                if (item.submode) menuItem.dataset.submode = item.submode;
                
                if (item.icon) {
                    menuItem.innerHTML = `${getIcon(item.icon)}<span>${item.label}</span>`;
                } else {
                    menuItem.textContent = item.label;
                }
                
                // 클릭 이벤트
                menuItem.addEventListener('click', () => {
                    if (menuItem.classList.contains('disabled')) return;
                    this._handleSubmenuClick(item);
                });
                
                submenu.appendChild(menuItem);
            }
        });
        
        return submenu;
    }
    
    _createThemeToggle() {
        const container = document.createElement('div');
        container.className = 'theme-toggle-item';
        container.innerHTML = `
            <div class="theme-toggle-label">
                ${getIcon('sun')}
                <span>Theme</span>
            </div>
            <div class="theme-switch" id="theme-switch"></div>
        `;
        
        const themeSwitch = container.querySelector('.theme-switch');
        if (this.currentTheme === 'light') {
            themeSwitch.classList.add('active');
        }
        
        themeSwitch.addEventListener('click', () => this.toggleTheme());
        
        return container;
    }
    
    _createMockTestSection() {
        const section = document.createElement('div');
        section.id = 'mock-test-section';
        section.style.display = 'none';
        section.innerHTML = `
            <div class="submenu-divider"></div>
            <div class="submenu-header">Mock Test Files</div>
            <div class="mock-test-list">
                <div class="mock-test-item" data-test="equipment-status">📦 Equipment Status Test</div>
                <div class="mock-test-item" data-test="realtime-update">🔄 Realtime Update Test</div>
                <div class="mock-test-item" data-test="multi-site">🌐 Multi-Site Test</div>
            </div>
        `;
        
        section.querySelectorAll('.mock-test-item').forEach(item => {
            item.addEventListener('click', () => {
                const testName = item.dataset.test;
                this._loadMockTest(testName);
            });
        });
        
        return section;
    }
    
    _createDivider() {
        const divider = document.createElement('div');
        divider.className = 'sidebar-divider';
        this.element.appendChild(divider);
    }
    
    _createSpacer() {
        const spacer = document.createElement('div');
        spacer.className = 'sidebar-spacer';
        this.element.appendChild(spacer);
    }
    
    _createDevModeBadge() {
        let badge = document.getElementById('dev-mode-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'dev-mode-badge';
            badge.id = 'dev-mode-badge';
            badge.textContent = '⚡ DEV MODE';
            document.body.appendChild(badge);
        }
    }
    
    // ========================================
    // 🆕 v1.4.0: Connection Modal Manager
    // ========================================
    
    /**
     * ConnectionModalManager 생성
     */
    _createConnectionModalManager() {
        this.connectionModalManager = new ConnectionModalManager({
            toast: this.toast,
            eventBus: this.eventBus,
            connectionStatusService: this.connectionStatusService,
            siteList: SITE_LIST,
            getDevModeEnabled: () => this.devModeEnabled,
            onConnect: (siteId, siteName) => this._onSiteConnected(siteId, siteName),
            onDisconnect: (siteId) => this._onSiteDisconnected(siteId)
        });
    }
    
    /**
     * 사이트 연결 성공 콜백
     */
    _onSiteConnected(siteId, siteName) {
        this.isConnected = true;
        this._updateButtonStates();
        this._updateCoverStatus(true, siteId);
        
        // 전역 상태 동기화
        if (window.sidebarState) {
            window.sidebarState.isConnected = true;
        }
    }
    
    /**
     * 사이트 연결 해제 콜백
     */
    _onSiteDisconnected(siteId) {
        this.isConnected = false;
        this._updateButtonStates();
        this._updateCoverStatus(false, null);
        
        // Cover Screen 표시
        this.showCoverScreen();
        
        // 모드 초기화
        this.currentMode = null;
        this.currentSubMode = null;
        this._updateButtonSelection();
        this._updateOverlayUI();
        
        // 전역 상태 동기화
        if (window.sidebarState) {
            window.sidebarState.isConnected = false;
        }
    }
    
    // ========================================
    // Connection Modal Public API (Delegated)
    // ========================================
    
    /**
     * Connection Modal 열기
     */
    openConnectionModal() {
        this.connectionModalManager?.open();
    }
    
    /**
     * Connection Modal 닫기
     */
    closeConnectionModal() {
        this.connectionModalManager?.close();
    }
    
    /**
     * Connection Modal 토글
     */
    toggleConnectionModal() {
        this.connectionModalManager?.toggle();
    }
    
    /**
     * Connection Modal 열림 상태 확인
     */
    get connectionModalOpen() {
        return this.connectionModalManager?.isOpen || false;
    }
    
    /**
     * 선택된 사이트 반환
     */
    get selectedSite() {
        return this.connectionModalManager?.getSelectedSite() || null;
    }
    
    // ========================================
    // Event Handlers
    // ========================================
    
    _setupEventListeners() {
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.connectionModalOpen) {
                this.closeConnectionModal();
            }
        });
    }
    
    _setupAppModeListeners() {
        if (!this.eventBus) return;
        
        const unsubMode = this.eventBus.on('mode:change', (data) => {
            this._onModeChange(data.to, data.from);
        });
        this._eventUnsubscribers.push(unsubMode);
        
        const unsubBlocked = this.eventBus.on('mode:enter-blocked', (data) => {
            if (this.toast) {
                this.toast.warning('Mode Blocked', `${data.mode} requires backend connection`);
            }
        });
        this._eventUnsubscribers.push(unsubBlocked);
    }
    
    _setupConnectionListeners() {
        if (!this.connectionStatusService) return;
        
        const unsubOnline = this.connectionStatusService.onOnline(() => {
            this.enableAfterConnection();
        });
        this._eventUnsubscribers.push(unsubOnline);
        
        const unsubOffline = this.connectionStatusService.onOffline(() => {
            this.disableBeforeConnection();
        });
        this._eventUnsubscribers.push(unsubOffline);
        
        if (this.connectionStatusService.isOnline()) {
            this.enableAfterConnection();
        }
    }
    
    _handleButtonClick(key, event) {
        const config = SIDEBAR_BUTTONS[key];
        if (!config) return;
        
        const btn = this.buttons.get(key);
        if (btn?.classList.contains('disabled')) return;
        
        switch (key) {
            case 'connection':
                // 🆕 v1.4.0: ConnectionModalManager 사용
                this.toggleConnectionModal();
                break;
                
            case 'monitoring':
                this._selectButton(key);
                this._setMode('monitoring');
                break;
                
            case 'layout':
                this._selectButton(key);
                this._setMode('layout');
                break;
                
            case 'analysis':
            case 'simulation':
                if (this.toast) {
                    this.toast.info('Coming Soon', `${config.mode} mode is under development`);
                }
                break;
                
            case 'debug':
            case 'settings':
                break;
        }
    }
    
    /**
     * 서브메뉴 클릭 처리
     */
    _handleSubmenuClick(item) {
        if (item.action) {
            // 1. callbacks에서 먼저 찾기
            const callback = this.callbacks[item.action];
            if (callback) {
                if (item.params) {
                    callback(...item.params);
                } else {
                    callback();
                }
                return;
            }
            
            // 2. this 인스턴스에서 찾기 (public 메서드)
            if (typeof this[item.action] === 'function') {
                this[item.action](...(item.params || []));
                return;
            }
            
            // 3. private 메서드 (_prefix)에서 찾기
            if (typeof this[`_${item.action}`] === 'function') {
                this[`_${item.action}`](...(item.params || []));
                return;
            }
            
            console.warn(`[Sidebar] Action not found: ${item.action}`);
        } else if (item.submode) {
            this._setSubMode(item.submode);
        }
    }
    
    // ========================================
    // Mode Management
    // ========================================
    
    _setMode(mode) {
        if (!this.appModeManager) {
            console.warn('[Sidebar] AppModeManager not connected');
            this.currentMode = mode;
            this._updateOverlayUI();
            return;
        }
        
        const appMode = this.APP_MODE[MODE_MAP[mode]] || this.APP_MODE.MAIN_VIEWER;
        this.appModeManager.toggleMode(appMode);
    }
    
    _setSubMode(submode) {
        this.currentSubMode = submode;
        
        if (this.appModeManager) {
            this.appModeManager.setSubMode(submode);
        }
        
        this._updateSubmenuActiveState();
        
        if (this.currentMode === 'monitoring' && submode === '3d-view') {
            this._show3DView();
        } else {
            this._hideAllViews();
        }
        
        this._updateOverlayUI();
        
        if (this.toast) {
            this.toast.info('Mode Changed', `${this.currentMode} → ${submode}`);
        }
    }
    
    _onModeChange(newMode, oldMode) {
        const modeKey = Object.entries(MODE_MAP).find(
            ([k, v]) => this.APP_MODE[v] === newMode
        )?.[0];
        
        this.currentMode = modeKey || null;
        this.currentSubMode = null;
        
        this._updateButtonSelection();
        this._updateOverlayUI();
    }
    
    // ========================================
    // View Management
    // ========================================
    
    _show3DView() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        
        if (coverScreen) coverScreen.classList.add('hidden');
        if (threejsContainer) threejsContainer.classList.add('active');
        if (overlayUI) overlayUI.style.display = 'flex';
        
        if (this.eventBus) {
            this.eventBus.emit('threejs:show-requested');
        }
    }
    
    _hideAllViews() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        
        if (coverScreen) coverScreen.classList.add('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'flex';
    }
    
    showCoverScreen() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        
        if (coverScreen) coverScreen.classList.remove('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'none';
        
        if (this.eventBus) {
            this.eventBus.emit('threejs:stop-requested');
        }
    }
    
    _updateOverlayUI() {
        const modeDisplay = document.getElementById('current-mode');
        const submodeDisplay = document.getElementById('current-submode');
        
        if (modeDisplay) {
            modeDisplay.textContent = this.currentMode 
                ? this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1)
                : '—';
        }
        
        if (submodeDisplay) {
            submodeDisplay.textContent = this.currentSubMode 
                ? `→ ${this.currentSubMode === '3d-view' ? '3D View' : this.currentSubMode}`
                : '';
        }
    }
    
    // ========================================
    // Button State Management
    // ========================================
    
    _selectButton(key) {
        this.buttons.forEach((btn, k) => {
            const config = SIDEBAR_BUTTONS[k];
            if (config?.selectable !== false) {
                btn.classList.remove('selected');
            }
        });
        
        const btn = this.buttons.get(key);
        const config = SIDEBAR_BUTTONS[key];
        if (btn && config?.selectable !== false) {
            btn.classList.add('selected');
        }
    }
    
    _updateButtonSelection() {
        this.buttons.forEach((btn, key) => {
            const config = SIDEBAR_BUTTONS[key];
            if (config?.selectable === false) return;
            
            const isSelected = (config.mode === this.currentMode);
            btn.classList.toggle('selected', isSelected);
        });
    }
    
    _updateButtonStates() {
        Object.entries(SIDEBAR_BUTTONS).forEach(([key, config]) => {
            const btn = this.buttons.get(key);
            const wrapper = document.getElementById(`${config.id}-wrapper`);
            
            if (!btn) return;
            
            let shouldDisable = false;
            let shouldHide = false;
            
            // 연결 또는 Dev Mode 체크
            if (config.requiresConnection && !this.isConnected && !this.devModeEnabled) {
                shouldDisable = true;
            }
            
            if (config.requiresDevMode && !this.devModeEnabled) {
                shouldHide = true;
            }
            
            if (config.requiresDevModeOrConnection) {
                if (!this.devModeEnabled && !this.isConnected) {
                    shouldDisable = true;
                }
            }
            
            if (config.alwaysEnabled) {
                shouldDisable = false;
            }
            
            if (config.disabled) {
                shouldDisable = true;
            }
            
            btn.classList.toggle('disabled', shouldDisable);
            
            // Tooltip 업데이트
            const tooltip = shouldDisable && !config.alwaysEnabled
                ? `${config.tooltip} (Enable Dev Mode)`
                : config.tooltip;
            
            if (wrapper) {
                wrapper.classList.toggle('disabled', shouldDisable);
                wrapper.classList.toggle('hidden', shouldHide);
                wrapper.dataset.tooltip = tooltip;
            } else {
                btn.classList.toggle('hidden', shouldHide);
                btn.dataset.tooltip = tooltip;
            }
        });
    }
    
    _updateSubmenuActiveState() {
        document.querySelectorAll('.submenu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (this.currentSubMode) {
            const activeItem = document.querySelector(
                `.submenu-item[data-submode="${this.currentSubMode}"]`
            );
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
    }
    
    // ========================================
    // Connection State
    // ========================================
    
    enableAfterConnection() {
        this.isConnected = true;
        this._updateButtonStates();
        this._updateCoverStatus(true, this.selectedSite);
        
        console.log('[Sidebar] Backend 연결됨 - UI 활성화');
    }
    
    disableBeforeConnection() {
        this.isConnected = false;
        this._updateButtonStates();
        this._updateCoverStatus(false, null);
        
        this.currentMode = null;
        this.currentSubMode = null;
        this._updateButtonSelection();
        this._updateOverlayUI();
        
        // Dev Mode가 아니면 Cover Screen 표시
        if (!this.devModeEnabled) {
            this.showCoverScreen();
        }
        
        console.log('[Sidebar] Backend 연결 해제 - UI 비활성화');
    }
    
    /**
     * Cover Status 업데이트
     */
    _updateCoverStatus(connected, siteId) {
        const apiDot = document.getElementById('cover-api-dot');
        const apiStatus = document.getElementById('cover-api-status');
        const dbDot = document.getElementById('cover-db-dot');
        const dbStatus = document.getElementById('cover-db-status');
        
        const dotClass = connected ? 'connected' : 'disconnected';
        const statusText = connected ? 'Connected' : 'Disconnected';
        
        if (apiDot) apiDot.className = `cover-status-dot ${dotClass}`;
        if (apiStatus) apiStatus.textContent = statusText;
        if (dbDot) dbDot.className = `cover-status-dot ${dotClass}`;
        
        if (dbStatus) {
            if (connected && siteId) {
                const site = getSiteById(siteId);
                dbStatus.textContent = site?.name || siteId;
            } else {
                dbStatus.textContent = 'Not Connected';
            }
        }
    }
    
    // ========================================
    // Theme Management
    // ========================================
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        const themeSwitch = document.getElementById('theme-switch');
        if (themeSwitch) {
            themeSwitch.classList.toggle('active', this.currentTheme === 'light');
        }
        
        localStorage.setItem('theme', this.currentTheme);
        
        if (this.eventBus) {
            this.eventBus.emit('theme:change', { theme: this.currentTheme });
        }
        
        if (this.toast) {
            this.toast.info('Theme Changed', `Switched to ${this.currentTheme} mode`);
        }
    }
    
    // ========================================
    // Dev Mode
    // ========================================
    
    /**
     * Dev Mode 토글 (public 메서드)
     */
    toggleDevMode() {
        this.devModeEnabled = !this.devModeEnabled;
        
        const badge = document.getElementById('dev-mode-badge');
        const devModeLabel = document.getElementById('dev-mode-toggle');
        const mockTestSection = document.getElementById('mock-test-section');
        
        if (badge) {
            badge.classList.toggle('active', this.devModeEnabled);
        }
        
        // 레이블 업데이트
        const labelText = `Dev Mode: ${this.devModeEnabled ? 'ON' : 'OFF'}`;
        
        if (devModeLabel) {
            const labelSpan = devModeLabel.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = labelText;
            } else {
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
        
        if (mockTestSection) {
            mockTestSection.style.display = this.devModeEnabled ? 'block' : 'none';
        }
        
        this._updateButtonStates();
        
        // 전역 상태 동기화
        if (window.sidebarState) {
            window.sidebarState.devModeEnabled = this.devModeEnabled;
        }
        
        if (this.toast) {
            if (this.devModeEnabled) {
                this.toast.warning('Dev Mode ON', 'All features enabled without backend');
            } else {
                this.toast.info('Dev Mode OFF', '');
            }
        }
        
        console.log(`⚡ Dev Mode: ${this.devModeEnabled ? 'ON' : 'OFF'}`);
    }
    
    _loadMockTest(testName) {
        if (this.toast) {
            this.toast.info('Mock Test', `Loading: ${testName}`);
        }
        
        if (this.eventBus) {
            this.eventBus.emit('mock:load-test', { testName });
        }
    }
    
    setDebugView(view) {
        if (this.toast) {
            this.toast.info('Debug View', view);
        }
        
        if (this.eventBus) {
            this.eventBus.emit('debug:set-view', { view });
        }
    }
    
    // ========================================
    // Public API
    // ========================================
    
    getCurrentMode() {
        return this.currentMode;
    }
    
    getCurrentSubMode() {
        return this.currentSubMode;
    }
    
    getIsConnected() {
        return this.isConnected;
    }
    
    getDevModeEnabled() {
        return this.devModeEnabled;
    }
    
    setButtonEnabled(key, enabled) {
        const btn = this.buttons.get(key);
        const wrapper = document.getElementById(`${SIDEBAR_BUTTONS[key]?.id}-wrapper`);
        
        if (btn) {
            btn.classList.toggle('disabled', !enabled);
        }
        if (wrapper) {
            wrapper.classList.toggle('disabled', !enabled);
        }
    }
    
    setButtonVisible(key, visible) {
        const btn = this.buttons.get(key);
        const wrapper = document.getElementById(`${SIDEBAR_BUTTONS[key]?.id}-wrapper`);
        
        if (wrapper) {
            wrapper.classList.toggle('hidden', !visible);
        } else if (btn) {
            btn.classList.toggle('hidden', !visible);
        }
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    destroy() {
        this._eventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._eventUnsubscribers = [];
        
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        // 🆕 v1.4.0: ConnectionModalManager 정리
        if (this.connectionModalManager) {
            this.connectionModalManager.destroy();
            this.connectionModalManager = null;
        }
        
        const badge = document.getElementById('dev-mode-badge');
        if (badge) badge.remove();
        
        this.buttons.clear();
        this.submenus.clear();
        
        console.log('[Sidebar] 정리 완료');
    }
}

export default Sidebar;