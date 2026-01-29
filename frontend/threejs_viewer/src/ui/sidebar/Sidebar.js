/**
 * Sidebar.js
 * ==========
 * Cleanroom Sidebar UI 컴포넌트 (조율자)
 * 
 * @version 2.1.0
 * @created 2026-01-11
 * @updated 2026-01-29
 * 
 * @changelog
 * - v2.1.0: 🆕 Mapping Status 통합 (2026-01-29)
 *           - isMappingReady, connectedSiteId 상태 추가
 *           - _initializeManagers()에 stateManager 전달 추가
 *           - _onStateChange()에 mappingChanged, mappingSet 처리 추가
 *           - _updateButtonStates()에 isMappingReady 포함
 *           - getMappingReady(), getMappingInfo(), getConnectedSiteId() 공개 메서드 추가
 *           - ⚠️ 호환성: 기존 모든 Public/Private API 100% 유지
 * - v2.0.0: 🔄 대규모 리팩토링 (2026-01-25)
 *           - 42KB (1,100줄) → 15KB (~400줄) 슬림화
 *           - SidebarViewManager 분리 (View 관련 로직)
 *           - SidebarClickHandlers 분리 (Click 핸들러)
 *           - SidebarEventHandlers 분리 (Event 리스너)
 *           - SidebarStateManager 분리 (Connection/Theme/DevMode)
 *           - ⚠️ 호환성: 기존 모든 Public/Private API 100% 유지 (위임 패턴)
 * - v1.13.0: NavigationController 통합
 * - v1.12.0: ViewManager 연동
 * - v1.10.0: Analysis 모드 활성화
 * 
 * @description
 * Sidebar UI의 조율자(Coordinator) 역할
 * - DOM 생성 및 구조 관리
 * - 하위 모듈 초기화 및 연결
 * - Public API 제공 (하위 호환)
 * 
 * @dependencies
 * - ./IconRegistry.js
 * - ./SidebarConfig.js
 * - ./SidebarButtonFactory.js
 * - ./SidebarSubmenuFactory.js
 * - ./ConnectionModalManager.js
 * - ./handlers/SidebarClickHandlers.js
 * - ./handlers/SidebarEventHandlers.js
 * - ./managers/SidebarViewManager.js
 * - ./managers/SidebarStateManager.js
 * - ../overlay/ModeIndicatorPanel.js
 * - ../../bootstrap/ViewBootstrap.js
 * - ../../core/navigation/index.js
 * 
 * @exports
 * - Sidebar
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/Sidebar.js
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

import { ModeIndicatorPanel } from '../overlay/ModeIndicatorPanel.js';

import { viewManager } from '../../bootstrap/ViewBootstrap.js';

import { navigationController, NAV_MODE } from '../../core/navigation/index.js';

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

// 🆕 v2.0.0: 분리된 모듈 import
import { SidebarViewManager } from './managers/SidebarViewManager.js';
import { SidebarStateManager } from './managers/SidebarStateManager.js';
import { SidebarClickHandlers, getParentModeForSubmode, mapToNavMode, navModeToSidebarMode } from './handlers/SidebarClickHandlers.js';
import { SidebarEventHandlers } from './handlers/SidebarEventHandlers.js';

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
        
        // State (stateManager로 위임되지만 하위 호환을 위해 유지)
        this.isConnected = false;
        this.devModeEnabled = false;
        this.currentMode = null;
        this.currentSubMode = null;
        this.currentTheme = 'dark';
        
        // 🆕 v2.1.0: Mapping 관련 상태 추가
        this.isMappingReady = false;
        this.connectedSiteId = null;
        
        // DOM References
        this.element = null;
        this.buttons = new Map();
        this.submenus = new Map();
        
        // Sub-components
        this.connectionModalManager = null;
        this.modeIndicatorPanel = null;
        
        // 🆕 v2.0.0: 분리된 매니저/핸들러
        this._viewManager = null;
        this._stateManager = null;
        this._clickHandlers = null;
        this._eventHandlers = null;
        
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
        this._initializeManagers();
        this._setupEventListeners();
        this._updateButtonStates();
        
        console.log('[Sidebar] 초기화 완료 v2.1.0 (Mapping Status 통합)');
    }
    
    _loadTheme() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    
    /**
     * 🆕 v2.0.0: 분리된 매니저/핸들러 초기화
     * 🔧 v2.1.0: ClickHandlers에 stateManager 전달 추가
     */
    _initializeManagers() {
        // ViewManager 초기화
        this._viewManager = new SidebarViewManager({
            modeIndicatorPanel: this.modeIndicatorPanel,
            eventBus: this.eventBus,
            viewManagerInstance: viewManager,
            getCurrentMode: () => this.currentMode,
            getCurrentSubMode: () => this.currentSubMode
        });
        
        // StateManager 초기화
        this._stateManager = new SidebarStateManager({
            eventBus: this.eventBus,
            toast: this.toast,
            connectionModalManager: this.connectionModalManager,
            modeIndicatorPanel: this.modeIndicatorPanel,
            getSiteById: getSiteById,
            submenuFactoryFns: {
                updateThemeSwitchState,
                updateDevModeLabel,
                updateDevModeBadge,
                setMockTestSectionVisible
            },
            onStateChange: (state) => this._onStateChange(state)
        });
        
        // ClickHandlers 초기화
        // 🔧 v2.1.0: stateManager 전달 추가
        this._clickHandlers = new SidebarClickHandlers({
            sidebar: this,
            navigationController,
            NAV_MODE,
            callbacks: this.callbacks,
            toast: this.toast,
            buttonsConfig: SIDEBAR_BUTTONS,
            selectButton: (key) => this._selectButton(key),
            toggleConnectionModal: () => this.toggleConnectionModal(),
            // 🆕 v2.1.0: StateManager 전달 (매핑 체크용)
            stateManager: this._stateManager
        });
        
        // EventHandlers 초기화 및 이벤트 구독
        this._eventHandlers = new SidebarEventHandlers({
            sidebar: this,
            eventBus: this.eventBus,
            connectionStatusService: this.connectionStatusService,
            toast: this.toast,
            NAV_MODE,
            MODE_MAP,
            APP_MODE: this.APP_MODE
        });
        
        this._eventUnsubscribers = this._eventHandlers.setupAll();
    }
    
    /**
     * @private
     * StateManager에서 상태 변경 시 호출
     * 🔧 v2.1.0: mappingChanged, mappingSet 타입 처리 추가
     */
    _onStateChange(state) {
        // State 동기화
        if (state.type === 'connection' || state.type === 'siteConnected' || state.type === 'siteDisconnected') {
            this.isConnected = state.isConnected;
            
            // 🆕 v2.1.0: 연결 상태 변경 시 매핑 상태도 동기화
            if (state.isMappingReady !== undefined) {
                this.isMappingReady = state.isMappingReady;
            }
            if (state.type === 'siteConnected') {
                this.connectedSiteId = state.siteId || null;
            }
            if (state.type === 'siteDisconnected') {
                this.connectedSiteId = null;
                this.isMappingReady = false;
            }
        }
        if (state.type === 'devMode') {
            this.devModeEnabled = state.devModeEnabled;
        }
        
        // 🆕 v2.1.0: 매핑 상태 변경 처리
        if (state.type === 'mappingChanged' || state.type === 'mappingSet') {
            this.isMappingReady = state.isMappingReady || false;
            this.connectedSiteId = state.connectedSiteId || this.connectedSiteId;
            
            console.log(`[Sidebar] 📊 Mapping 상태 변경: Ready=${this.isMappingReady}, SiteId=${this.connectedSiteId}`);
        }
        
        // 버튼 상태 업데이트
        this._updateButtonStates();
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
        
        const btn = createButton(config, getIcon, (e) => this._handleButtonClick(key, e));
        
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
            config, getIcon, submenu, (e) => this._handleButtonClick(key, e)
        );
        
        if (wrapper) {
            this.element.appendChild(wrapper);
            this.buttons.set(key, button);
            this.submenus.set(config.submenuId, submenu);
        }
        
        return wrapper;
    }
    
    // ========================================
    // Sub-components Creation
    // ========================================
    
    _createModeIndicatorPanel() {
        this.modeIndicatorPanel = new ModeIndicatorPanel({
            position: 'top-left',
            offsetX: 130,
            offsetY: 12,
            eventBus: this.eventBus
        });
        this.modeIndicatorPanel.show();
    }
    
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
    
    // ========================================
    // Event Handlers (위임)
    // ========================================
    
    _setupEventListeners() {
        // EventHandlers에서 처리 (_initializeManagers에서 setupAll 호출)
    }
    
    // ========================================
    // Click Handlers (위임)
    // ========================================
    
    _handleButtonClick(key, event) {
        const btn = this.buttons.get(key);
        this._clickHandlers?.handleButtonClick(key, event, btn);
    }
    
    _handleSubmenuClick(item) {
        this._clickHandlers?.handleSubmenuClick(item);
    }
    
    // ========================================
    // Mode Management (위임 + 하위 호환)
    // ========================================
    
    /**
     * 모드 설정
     * @version 1.13.0 - NavigationController 통합
     * @param {string} mode - 설정할 모드
     */
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
     * 모드 변경 이벤트 핸들러
     * @param {string} newMode - 새 모드
     * @param {string} oldMode - 이전 모드
     */
    _onModeChange(newMode, oldMode) {
        const modeKey = Object.entries(MODE_MAP).find(
            ([k, v]) => this.APP_MODE[v] === newMode
        )?.[0];
        
        this.currentMode = modeKey || null;
        this.currentSubMode = null;
        
        this._updateButtonSelection();
        this._updateModeIndicator();
    }
    
    _getParentModeForSubmode(submode) {
        return getParentModeForSubmode(submode);
    }
    
    _mapToNavMode(sidebarMode) {
        return mapToNavMode(sidebarMode);
    }
    
    _navModeToSidebarMode(navMode) {
        return navModeToSidebarMode(navMode);
    }
    
    _setSubMode(submode) {
        // 이전 submode View 숨김
        if (this.currentSubMode && this.currentSubMode !== submode) {
            this._viewManager?.hideViewByManager(this.currentSubMode);
        }
        
        this.currentSubMode = submode;
        
        // 부모 모드 확인 및 전환
        const parentMode = getParentModeForSubmode(submode);
        if (parentMode && this.appModeManager) {
            const appMode = this.APP_MODE[MODE_MAP[parentMode]];
            const currentAppMode = this.appModeManager.getCurrentMode();
            if (appMode && currentAppMode !== appMode) {
                this.appModeManager.switchMode(appMode);
            }
        }
        
        // AppModeManager에 서브모드 알림
        this.appModeManager?.setSubMode(submode);
        
        // 서브메뉴 활성 상태 업데이트
        updateSubmenuActiveState(this.currentSubMode);
        
        // ViewManager 또는 Legacy 처리
        this._viewManager?.showViewByManager(submode);
        
        // ModeIndicator 업데이트
        this._updateModeIndicator();
        
        // 이벤트 발행
        this.eventBus?.emit('submode:change', {
            submode,
            mode: this.currentMode,
            parentMode
        });
    }
    
    // ========================================
    // View Management (위임)
    // ========================================
    
    _show3DView() {
        this._viewManager?.show3DView();
    }
    
    _showAnalysisView() {
        this._viewManager?.showAnalysisView();
    }
    
    _hideAnalysisView() {
        this._viewManager?.hideAnalysisView();
    }
    
    _hideAllViews() {
        this._viewManager?.hideAllViews();
    }
    
    showCoverScreen() {
        this._viewManager?.showCoverScreen();
    }
    
    _prepareViewSwitch(targetSubmode) {
        this._viewManager?.prepareViewSwitch(targetSubmode);
    }
    
    _handleLegacySubmode(submode) {
        this._viewManager?.handleLegacySubmode(submode);
    }
    
    _updateModeIndicator() {
        this._viewManager?.updateModeIndicator(this.currentMode, this.currentSubMode);
    }
    
    _updateOverlayUI() {
        this._updateModeIndicator();
    }
    
    // ========================================
    // Connection State (위임)
    // ========================================
    
    _onSiteConnected(siteId, siteName) {
        // 🔧 v2.1.0: StateManager에 위임 (mappingInfo는 StateManager가 ConnectionModalManager에서 가져옴)
        this._stateManager?.onSiteConnected(siteId, siteName);
        this.isConnected = true;
        this.connectedSiteId = siteId;  // 🆕 v2.1.0
        this._updateButtonStates();
        this._updateCoverStatus(true, siteId);
    }
    
    _onSiteDisconnected(siteId) {
        this._stateManager?.onSiteDisconnected(siteId, () => navigationController.goHome());
        this.isConnected = false;
        this.connectedSiteId = null;  // 🆕 v2.1.0
        this.isMappingReady = false;  // 🆕 v2.1.0
        this.currentMode = null;
        this.currentSubMode = null;
        this._updateButtonStates();
        this._updateButtonSelection();
        this._updateModeIndicator();
    }
    
    enableAfterConnection() {
        this._stateManager?.enableAfterConnection();
        this.isConnected = true;
        this._updateButtonStates();
    }
    
    disableBeforeConnection() {
        this._stateManager?.disableBeforeConnection(() => this.showCoverScreen());
        this.isConnected = false;
        this.isMappingReady = false;  // 🆕 v2.1.0
        this.connectedSiteId = null;  // 🆕 v2.1.0
        this.currentMode = null;
        this.currentSubMode = null;
        this._updateButtonStates();
        this._updateButtonSelection();
        this._updateModeIndicator();
    }
    
    _updateCoverStatus(connected, siteId) {
        this._stateManager?.updateCoverStatus(connected, siteId);
    }
    
    // ========================================
    // Theme Management (위임)
    // ========================================
    
    toggleTheme() {
        this._stateManager?.toggleTheme();
        this.currentTheme = this._stateManager?.getTheme() || this.currentTheme;
    }
    
    // ========================================
    // Dev Mode (위임)
    // ========================================
    
    toggleDevMode() {
        this._stateManager?.toggleDevMode();
        this.devModeEnabled = this._stateManager?.isDevModeEnabled() || false;
    }
    
    _loadMockTest(testName) {
        this._stateManager?.loadMockTest(testName);
    }
    
    setDebugView(view) {
        this._stateManager?.setDebugView(view);
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
    
    /**
     * 버튼 상태 업데이트
     * 🔧 v2.1.0: isMappingReady 상태 포함
     */
    _updateButtonStates() {
        const state = {
            isConnected: this.isConnected,
            devModeEnabled: this.devModeEnabled,
            // 🆕 v2.1.0: 매핑 상태 추가
            isMappingReady: this.isMappingReady
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
    
    /**
     * 🆕 v2.1.0: 매핑 준비 상태 반환
     * @returns {boolean}
     */
    getMappingReady() {
        return this.isMappingReady;
    }
    
    /**
     * 🆕 v2.1.0: 현재 매핑 정보 반환
     * @returns {Object|null}
     */
    getMappingInfo() {
        return this._stateManager?.getMappingInfo() || null;
    }
    
    /**
     * 🆕 v2.1.0: 연결된 사이트 ID 반환
     * @returns {string|null}
     */
    getConnectedSiteId() {
        return this.connectedSiteId;
    }
    
    setButtonEnabled(key, enabled) {
        const btn = this.buttons.get(key);
        const wrapper = document.getElementById(`${SIDEBAR_BUTTONS[key]?.id}-wrapper`);
        
        if (btn) btn.classList.toggle('disabled', !enabled);
        if (wrapper) wrapper.classList.toggle('disabled', !enabled);
    }
    
    setButtonVisible(key, visible) {
        const btn = this.buttons.get(key);
        const wrapper = document.getElementById(`${SIDEBAR_BUTTONS[key]?.id}-wrapper`);
        
        if (wrapper) wrapper.classList.toggle('hidden', !visible);
        else if (btn) btn.classList.toggle('hidden', !visible);
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    destroy() {
        // Event 구독 해제
        this._eventHandlers?.destroy();
        this._eventUnsubscribers = [];
        
        // 매니저 정리
        this._viewManager?.destroy();
        this._stateManager?.destroy();
        this._clickHandlers?.destroy();
        
        // DOM 제거
        this.element?.remove();
        this.element = null;
        
        // 서브 컴포넌트 정리
        this.connectionModalManager?.destroy();
        this.connectionModalManager = null;
        
        this.modeIndicatorPanel?.destroy();
        this.modeIndicatorPanel = null;
        
        // Dev Mode Badge 제거
        document.getElementById('dev-mode-badge')?.remove();
        
        // Map 정리
        this.buttons.clear();
        this.submenus.clear();
        
        // 🆕 v2.1.0: 매핑 상태 초기화
        this.isMappingReady = false;
        this.connectedSiteId = null;
        
        console.log('[Sidebar] 정리 완료');
    }
}

export default Sidebar;