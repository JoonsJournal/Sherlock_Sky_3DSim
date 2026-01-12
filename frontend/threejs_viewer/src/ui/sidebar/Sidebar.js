/**
 * Sidebar.js
 * ==========
 * Cleanroom Sidebar UI 컴포넌트
 * 
 * @version 1.10.0
 * @created 2026-01-11
 * @updated 2026-01-13
 * 
 * @changelog
 * - v1.10.0: 🆕 Analysis 모드 활성화 (2026-01-13)
 *           - _handleButtonClick()에 analysis 케이스 추가
 *           - _getParentModeForSubmode()에 analysis 서브모드 매핑 추가
 *           - _showAnalysisView(), _hideAnalysisView() 메서드 추가
 * - v1.9.1: submode:change 이벤트 발행 추가
 * - v1.9.0: 서브메뉴 직접 클릭 시 AppModeManager 모드 전환 추가
 * - v1.8.0: ModeIndicatorPanel pill 스타일 + 위치 조정
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/Sidebar.js
 */

import { ICONS, getIcon } from './IconRegistry.js';

import { 
    SIDEBAR_BUTTONS, 
    SUBMENUS, 
    SITE_LIST, 
    MODE_MAP,
    getSiteById 
} from './SidebarConfig.js';

import { ConnectionModalManager } from './ConnectionModalManager.js';

// ModeIndicatorPanel import
import { ModeIndicatorPanel } from '../overlay/ModeIndicatorPanel.js';

import {
    createButton,
    createButtonWithSubmenu,
    createDivider,
    createSpacer,
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
    constructor(options = {}) {
        this.appModeManager = options.appModeManager || null;
        this.eventBus = options.eventBus || null;
        this.connectionStatusService = options.connectionStatusService || null;
        this.toast = options.toast || null;
        this.APP_MODE = options.APP_MODE || {};
        
        this.callbacks = {
            toggleConnectionModal: options.callbacks?.toggleConnectionModal || null,
            toggleDebugPanel: options.callbacks?.toggleDebugPanel || (() => {}),
            openEquipmentEditModal: options.callbacks?.openEquipmentEditModal || (() => {}),
            ...options.callbacks
        };
        
        this.isConnected = false;
        this.devModeEnabled = false;
        this.currentMode = null;
        this.currentSubMode = null;
        this.currentTheme = 'dark';
        
        this.element = null;
        this.buttons = new Map();
        this.submenus = new Map();
        
        this.connectionModalManager = null;
        this.modeIndicatorPanel = null;
        
        this._eventUnsubscribers = [];
        
        this._init();
    }
    
    // ========================================
    // Initialization
    // ========================================
    
    _init() {
        this._loadTheme();
        this._createDOM();
        this._createConnectionModalManager();
        this._createModeIndicatorPanel();
        this._setupEventListeners();
        this._setupAppModeListeners();
        this._setupConnectionListeners();
        this._updateButtonStates();
        
        console.log('[Sidebar] 초기화 완료 v1.10.0 (Analysis 모드 활성화)');
    }
    
    _loadTheme() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    _createDOM() {
        const existing = document.getElementById('sidebar');
        if (existing) existing.remove();
        
        this.element = document.createElement('aside');
        this.element.className = 'sidebar';
        this.element.id = 'sidebar';
        
        this._addButton('connection');
        this._addButtonWithSubmenu('monitoring');
        // 🆕 v1.10.0: Analysis 버튼 (서브메뉴 있음)
        this._addButtonWithSubmenu('analysis');
        this._addButton('simulation');
        
        this.element.appendChild(createDivider());
        
        this._addButtonWithSubmenu('layout');
        
        this.element.appendChild(createSpacer());
        
        this._addButtonWithSubmenu('debug');
        this._addButtonWithSubmenu('settings');
        
        this.element.appendChild(createBottomPadding());
        
        document.body.insertBefore(this.element, document.body.firstChild);
    }
    
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
    
    _addButtonWithSubmenu(key) {
        const config = SIDEBAR_BUTTONS[key];
        if (!config || !config.hasSubmenu) {
            return this._addButton(key);
        }
        
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
    // ModeIndicatorPanel
    // ========================================
    
    _createModeIndicatorPanel() {
        this.modeIndicatorPanel = new ModeIndicatorPanel({
            position: 'top-left',
            offsetX: 130,
            offsetY: 12,
            eventBus: this.eventBus
        });
        
        this.modeIndicatorPanel.show();
        
        console.log('[Sidebar] ModeIndicatorPanel 생성 완료');
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
        this._updateModeIndicator();
        
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
    
    /**
     * 🔧 v1.10.0: Analysis 케이스 추가
     */
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
            
            // 🆕 v1.10.0: Analysis 모드 추가
            case 'analysis':
                this._selectButton(key);
                this._setMode('analysis');
                break;
                
            case 'layout':
                this._selectButton(key);
                this._setMode('layout');
                break;
                
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
            const parentMode = this._getParentModeForSubmode(item.submode);
            if (parentMode) {
                this.currentMode = parentMode;
                this._selectButton(parentMode);
            }
            this._setSubMode(item.submode);
        }
    }
    
    /**
     * 🔧 v1.10.0: Analysis 서브모드 매핑 추가
     */
    _getParentModeForSubmode(submode) {
        const submodeToParent = {
            '3d-view': 'monitoring',
            'ranking-view': 'monitoring',
            'layout-editor': 'layout',
            'mapping': 'layout',
            // 🆕 v1.10.0: Analysis 서브모드
            'dashboard': 'analysis',
            'heatmap': 'analysis',
            'trend': 'analysis'
        };
        return submodeToParent[submode] || null;
    }
    
    // ========================================
    // Mode Management
    // ========================================
    
    _setMode(mode) {
        if (!this.appModeManager) {
            console.warn('[Sidebar] AppModeManager not connected');
            this.currentMode = mode;
            this._updateModeIndicator();
            return;
        }
        
        const appMode = this.APP_MODE[MODE_MAP[mode]] || this.APP_MODE.MAIN_VIEWER;
        this.appModeManager.toggleMode(appMode);
    }
    
    /**
     * 서브모드 설정
     */
    _setSubMode(submode) {
        this.currentSubMode = submode;
        
        const parentMode = this._getParentModeForSubmode(submode);
        if (parentMode && this.appModeManager) {
            const appMode = this.APP_MODE[MODE_MAP[parentMode]];
            const currentAppMode = this.appModeManager.getCurrentMode();
            
            if (appMode && currentAppMode !== appMode) {
                console.log(`[Sidebar] 🔄 서브메뉴 직접 클릭 감지 - AppModeManager 모드 전환: ${currentAppMode} → ${appMode}`);
                this.appModeManager.switchMode(appMode);
            }
        }
        
        if (this.appModeManager) {
            this.appModeManager.setSubMode(submode);
        }
        
        updateSubmenuActiveState(this.currentSubMode);
        
        // 🔧 v1.10.0: 모드별 View 관리
        if (this.currentMode === 'monitoring' && submode === '3d-view') {
            this._show3DView();
        } else if (this.currentMode === 'analysis') {
            this._showAnalysisView();
        } else {
            this._hideAllViews();
        }
        
        this._updateModeIndicator();
        
        if (this.eventBus) {
            this.eventBus.emit('submode:change', {
                submode: submode,
                mode: this.currentMode,
                parentMode: parentMode
            });
            console.log(`[Sidebar] 📡 submode:change 이벤트 발행: ${submode}`);
        }
        
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
        this._updateModeIndicator();
    }
    
    // ========================================
    // View Management
    // ========================================
    
    _show3DView() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        const analysisContainer = document.getElementById('analysis-container');
        
        if (coverScreen) coverScreen.classList.add('hidden');
        if (threejsContainer) threejsContainer.classList.add('active');
        if (overlayUI) overlayUI.style.display = 'none';
        if (analysisContainer) analysisContainer.classList.add('hidden');
        
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.show();
        }
        
        if (this.eventBus) {
            this.eventBus.emit('threejs:show-requested');
        }
    }
    
    /**
     * 🆕 v1.10.0: Analysis View 표시
     */
    _showAnalysisView() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        const analysisContainer = document.getElementById('analysis-container');
        
        if (coverScreen) coverScreen.classList.add('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'none';
        if (analysisContainer) analysisContainer.classList.remove('hidden');
        
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.show();
        }
        
        console.log('[Sidebar] Analysis View 표시');
    }
    
    /**
     * 🆕 v1.10.0: Analysis View 숨김
     */
    _hideAnalysisView() {
        const analysisContainer = document.getElementById('analysis-container');
        if (analysisContainer) {
            analysisContainer.classList.add('hidden');
        }
    }
    
    _hideAllViews() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        const analysisContainer = document.getElementById('analysis-container');
        
        if (coverScreen) coverScreen.classList.add('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'none';
        if (analysisContainer) analysisContainer.classList.add('hidden');
        
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.show();
        }
    }
    
    showCoverScreen() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        const analysisContainer = document.getElementById('analysis-container');
        
        if (coverScreen) coverScreen.classList.remove('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'none';
        if (analysisContainer) analysisContainer.classList.add('hidden');
        
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.hide();
        }
        
        if (this.eventBus) {
            this.eventBus.emit('threejs:stop-requested');
        }
    }
    
    _updateModeIndicator() {
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.setMode(this.currentMode, this.currentSubMode);
        }
        
        if (window.sidebarState) {
            window.sidebarState.currentMode = this.currentMode;
            window.sidebarState.currentSubMode = this.currentSubMode;
        }
    }
    
    _updateOverlayUI() {
        this._updateModeIndicator();
    }
    
    // ========================================
    // Button State Management
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
        this._updateModeIndicator();
        
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
    // Theme Management
    // ========================================
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
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
    // Dev Mode
    // ========================================
    
    toggleDevMode() {
        this.devModeEnabled = !this.devModeEnabled;
        
        updateDevModeBadge(this.devModeEnabled);
        updateDevModeLabel(this.devModeEnabled);
        setMockTestSectionVisible(this.devModeEnabled);
        
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.setDevMode(this.devModeEnabled);
        }
        
        if (this.connectionModalManager) {
            if (this.devModeEnabled) {
                this.connectionModalManager.enableMockMode({
                    responseDelay: 500
                });
                console.log('[Sidebar] 🎭 ConnectionModalManager Mock 모드 활성화');
            } else {
                this.connectionModalManager.disableMockMode();
                console.log('[Sidebar] 🔌 ConnectionModalManager 실제 API 모드로 전환');
            }
        }
        
        this._updateButtonStates();
        
        if (window.sidebarState) {
            window.sidebarState.devModeEnabled = this.devModeEnabled;
        }
        
        if (this.toast) {
            if (this.devModeEnabled) {
                this.toast.warning('Dev Mode ON', 'All features enabled without backend (Mock mode)');
            } else {
                this.toast.info('Dev Mode OFF', 'Switched to real API mode');
            }
        }
        
        console.log(`⚡ Dev Mode: ${this.devModeEnabled ? 'ON (Mock)' : 'OFF (Real)'}`);
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
    
    getModeIndicatorPanel() {
        return this.modeIndicatorPanel;
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
        
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.destroy();
            this.modeIndicatorPanel = null;
        }
        
        const badge = document.getElementById('dev-mode-badge');
        if (badge) badge.remove();
        
        this.buttons.clear();
        this.submenus.clear();
        
        console.log('[Sidebar] 정리 완료');
    }
}

export default Sidebar;