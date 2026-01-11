/**
 * Sidebar.js
 * ==========
 * Cleanroom Sidebar UI 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.5.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * 
 * @changelog
 * - v1.5.0: 🔧 버튼/서브메뉴 컴포넌트 분리 (Phase 4 리팩토링)
 *           - SidebarButtonFactory.js로 버튼 생성 함수 분리
 *           - SidebarSubmenuFactory.js로 서브메뉴 생성 함수 분리
 *           - 약 150줄 감소
 * - v1.4.0: 🔧 Connection Modal 분리 (Phase 3 리팩토링)
 * - v1.3.0: 🔧 상수/설정 분리 (Phase 2 리팩토링)
 * - v1.2.0: 🔧 Connection Modal v2.9 Full Version 복원
 * - v1.1.0: Connection Modal 동적 생성 추가
 * - v1.0.0: 초기 버전
 * 
 * @description
 * - 기존 floating-btn 시스템 대체
 * - AppModeManager와 연동하여 모드 전환
 * - ConnectionStatusService와 연동하여 상태 관리
 * - 모듈화된 Factory 함수 사용
 * 
 * 의존성:
 * - AppModeManager (core/managers)
 * - EventBus (core/managers)
 * - ConnectionStatusService (services)
 * - IconRegistry (ui/sidebar)
 * - SidebarConfig (ui/sidebar)
 * - ConnectionModalManager (ui/sidebar)
 * - SidebarButtonFactory (ui/sidebar) 🆕 v1.5.0
 * - SidebarSubmenuFactory (ui/sidebar) 🆕 v1.5.0
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/Sidebar.js
 */

import { ICONS, getIcon } from './IconRegistry.js';

// 상수/설정 import
import { 
    SIDEBAR_BUTTONS, 
    SUBMENUS, 
    SITE_LIST, 
    MODE_MAP,
    getSiteById 
} from './SidebarConfig.js';

// Connection Modal Manager import
import { ConnectionModalManager } from './ConnectionModalManager.js';

// 🆕 v1.5.0: Factory 함수 import
import {
    createButton,
    createButtonWithSubmenu,
    createDivider,
    createSpacer,
    createDevModeBadge,
    createBottomPadding,
    calculateButtonState,
    applyButtonState,
    setButtonSelected
} from './SidebarButtonFactory.js';

import {
    createSubmenu,
    updateSubmenuActiveState,
    setMockTestSectionVisible,
    updateThemeSwitchState,
    updateDevModeLabel,
    updateDevModeBadge
} from './SidebarSubmenuFactory.js';

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
        
        // DOM 참조
        this.element = null;
        this.buttons = new Map();
        this.submenus = new Map();
        
        // Connection Modal Manager
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
        this._createConnectionModalManager();
        this._setupEventListeners();
        this._setupAppModeListeners();
        this._setupConnectionListeners();
        this._updateButtonStates();
        
        console.log('[Sidebar] 초기화 완료 v1.5.0');
    }
    
    _loadTheme() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    
    // ========================================
    // DOM Creation (🆕 v1.5.0: Factory 함수 사용)
    // ========================================
    
    _createDOM() {
        // 기존 사이드바가 있으면 제거
        const existing = document.getElementById('sidebar');
        if (existing) existing.remove();
        
        // 사이드바 컨테이너
        this.element = document.createElement('aside');
        this.element.className = 'sidebar';
        this.element.id = 'sidebar';
        
        // 버튼들 생성 (Factory 함수 사용)
        this._addButton('connection');
        this._addButtonWithSubmenu('monitoring');
        this._addButton('analysis');
        this._addButton('simulation');
        
        // 구분선
        this.element.appendChild(createDivider());
        
        // Layout (Dev Mode용)
        this._addButtonWithSubmenu('layout');
        
        // 스페이서
        this.element.appendChild(createSpacer());
        
        // 하단 버튼들
        this._addButtonWithSubmenu('debug');
        this._addButtonWithSubmenu('settings');
        
        // 하단 여백
        this.element.appendChild(createBottomPadding());
        
        // body에 삽입 (맨 앞에)
        document.body.insertBefore(this.element, document.body.firstChild);
        
        // Dev Mode Badge 생성
        createDevModeBadge();
    }
    
    /**
     * 🆕 v1.5.0: 단일 버튼 추가 (Factory 함수 사용)
     */
    _addButton(key) {
        const config = SIDEBAR_BUTTONS[key];
        if (!config) return null;
        
        const btn = createButton(
            config,
            getIcon,
            (e) => this._handleButtonClick(key, e)
        );
        
        if (btn) {
            this.element.appendChild(btn);
            this.buttons.set(key, btn);
        }
        
        return btn;
    }
    
    /**
     * 🆕 v1.5.0: 서브메뉴 포함 버튼 추가 (Factory 함수 사용)
     */
    _addButtonWithSubmenu(key) {
        const config = SIDEBAR_BUTTONS[key];
        if (!config || !config.hasSubmenu) {
            return this._addButton(key);
        }
        
        // 서브메뉴 생성 (컨텍스트 전달)
        const submenu = createSubmenu(
            { ...SUBMENUS[config.submenuId], id: config.submenuId },
            getIcon,
            (item) => this._handleSubmenuClick(item),
            {
                currentTheme: this.currentTheme,
                onThemeToggle: () => this.toggleTheme(),
                onMockTestSelect: (testName) => this._loadMockTest(testName)
            }
        );
        
        // 버튼 + 래퍼 생성
        const { wrapper, button } = createButtonWithSubmenu(
            config,
            getIcon,
            submenu,
            (e) => this._handleButtonClick(key, e)
        );
        
        if (wrapper) {
            this.element.appendChild(wrapper);
            this.buttons.set(key, button);
            this.submenus.set(config.submenuId, submenu);
        }
        
        return wrapper;
    }
    
    // ========================================
    // Connection Modal Manager
    // ========================================
    
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
    
    _onSiteConnected(siteId, siteName) {
        this.isConnected = true;
        this._updateButtonStates();
        this._updateCoverStatus(true, siteId);
        
        if (window.sidebarState) {
            window.sidebarState.isConnected = true;
        }
    }
    
    _onSiteDisconnected(siteId) {
        this.isConnected = false;
        this._updateButtonStates();
        this._updateCoverStatus(false, null);
        
        this.showCoverScreen();
        
        this.currentMode = null;
        this.currentSubMode = null;
        this._updateButtonSelection();
        this._updateOverlayUI();
        
        if (window.sidebarState) {
            window.sidebarState.isConnected = false;
        }
    }
    
    // ========================================
    // Connection Modal Public API
    // ========================================
    
    openConnectionModal() {
        this.connectionModalManager?.open();
    }
    
    closeConnectionModal() {
        this.connectionModalManager?.close();
    }
    
    toggleConnectionModal() {
        this.connectionModalManager?.toggle();
    }
    
    get connectionModalOpen() {
        return this.connectionModalManager?.isOpen || false;
    }
    
    get selectedSite() {
        return this.connectionModalManager?.getSelectedSite() || null;
    }
    
    // ========================================
    // Event Handlers
    // ========================================
    
    _setupEventListeners() {
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
    
    _handleSubmenuClick(item) {
        if (item.action) {
            const callback = this.callbacks[item.action];
            if (callback) {
                if (item.params) {
                    callback(...item.params);
                } else {
                    callback();
                }
                return;
            }
            
            if (typeof this[item.action] === 'function') {
                this[item.action](...(item.params || []));
                return;
            }
            
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
        
        // 🆕 v1.5.0: Factory 함수 사용
        updateSubmenuActiveState(this.currentSubMode);
        
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
    // Button State Management (🆕 v1.5.0: Factory 함수 사용)
    // ========================================
    
    _selectButton(key) {
        this.buttons.forEach((btn, k) => {
            const config = SIDEBAR_BUTTONS[k];
            if (config?.selectable !== false) {
                setButtonSelected(btn, false);
            }
        });
        
        const btn = this.buttons.get(key);
        const config = SIDEBAR_BUTTONS[key];
        if (btn && config?.selectable !== false) {
            setButtonSelected(btn, true);
        }
    }
    
    _updateButtonSelection() {
        this.buttons.forEach((btn, key) => {
            const config = SIDEBAR_BUTTONS[key];
            if (config?.selectable === false) return;
            
            const isSelected = (config.mode === this.currentMode);
            setButtonSelected(btn, isSelected);
        });
    }
    
    _updateButtonStates() {
        const state = {
            isConnected: this.isConnected,
            devModeEnabled: this.devModeEnabled
        };
        
        Object.entries(SIDEBAR_BUTTONS).forEach(([key, config]) => {
            const btn = this.buttons.get(key);
            const wrapper = document.getElementById(`${config.id}-wrapper`);
            
            if (!btn) return;
            
            // 🆕 v1.5.0: Factory 함수 사용
            const stateResult = calculateButtonState(config, state);
            applyButtonState(btn, wrapper, stateResult);
        });
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
        
        if (!this.devModeEnabled) {
            this.showCoverScreen();
        }
        
        console.log('[Sidebar] Backend 연결 해제 - UI 비활성화');
    }
    
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
    // Theme Management (🆕 v1.5.0: Factory 함수 사용)
    // ========================================
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // 🆕 v1.5.0: Factory 함수 사용
        updateThemeSwitchState(this.currentTheme);
        
        localStorage.setItem('theme', this.currentTheme);
        
        if (this.eventBus) {
            this.eventBus.emit('theme:change', { theme: this.currentTheme });
        }
        
        if (this.toast) {
            this.toast.info('Theme Changed', `Switched to ${this.currentTheme} mode`);
        }
    }
    
    // ========================================
    // Dev Mode (🆕 v1.5.0: Factory 함수 사용)
    // ========================================
    
    toggleDevMode() {
        this.devModeEnabled = !this.devModeEnabled;
        
        // 🆕 v1.5.0: Factory 함수 사용
        updateDevModeBadge(this.devModeEnabled);
        updateDevModeLabel(this.devModeEnabled);
        setMockTestSectionVisible(this.devModeEnabled);
        
        this._updateButtonStates();
        
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