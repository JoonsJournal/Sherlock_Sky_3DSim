/**
 * Sidebar.js
 * ==========
 * Cleanroom Sidebar UI 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * 
 * @description
 * - 기존 floating-btn 시스템 대체
 * - AppModeManager와 연동하여 모드 전환
 * - ConnectionStatusService와 연동하여 상태 관리
 * - 기존 main.js 함수들 호출
 * 
 * 의존성:
 * - AppModeManager (core/managers)
 * - EventBus (core/managers)
 * - ConnectionStatusService (services)
 * - IconRegistry (ui/sidebar)
 * 
 * [MIGRATION NOTE]
 * - 기존 #connectionBtn, #editBtn, #monitoringBtn 대체
 * - 기존 keyboard shortcuts 유지 (Ctrl+K, E, M 등)
 * - appModeManager.toggleMode() 호출로 모드 전환
 */

import { ICONS, getIcon } from './IconRegistry.js';

// ============================================
// Constants
// ============================================

/**
 * 사이드바 버튼 설정
 * test_sidebar_standalone.html 기준
 */
const SIDEBAR_BUTTONS = {
    connection: {
        id: 'btn-connection',
        icon: 'connection',
        tooltip: 'Database Connection (Ctrl+K)',
        mode: 'connection',
        alwaysEnabled: true,
        selectable: false  // 선택 상태 없음 (항상 normal)
    },
    monitoring: {
        id: 'btn-monitoring',
        icon: 'monitoring',
        tooltip: 'Monitoring Mode (M)',
        mode: 'monitoring',
        requiresConnection: true,
        hasSubmenu: true,
        submenuId: 'monitoring-submenu'
    },
    analysis: {
        id: 'btn-analysis',
        icon: 'analysis',
        tooltip: 'Analysis (Coming Soon)',
        mode: 'analysis',
        requiresConnection: true,
        disabled: true  // 미구현
    },
    simulation: {
        id: 'btn-simulation',
        icon: 'simulation',
        tooltip: 'Simulation (Coming Soon)',
        mode: 'simulation',
        requiresConnection: true,
        disabled: true  // 미구현
    },
    layout: {
        id: 'btn-layout',
        icon: 'layout',
        tooltip: 'Layout Tools',
        mode: 'layout',
        requiresConnection: true,
        requiresDevMode: true,
        hasSubmenu: true,
        submenuId: 'layout-submenu',
        hidden: true  // Dev Mode에서만 표시
    },
    debug: {
        id: 'btn-debug',
        icon: 'debug',
        tooltip: 'Debug Tools (D)',
        mode: 'debug',
        hasSubmenu: true,
        submenuId: 'debug-submenu',
        requiresDevModeOrConnection: true
    },
    settings: {
        id: 'btn-settings',
        icon: 'settings',
        tooltip: 'Settings',
        mode: 'settings',
        alwaysEnabled: true,
        selectable: false,
        hasSubmenu: true,
        submenuId: 'settings-submenu'
    }
};

/**
 * 서브메뉴 설정
 */
const SUBMENUS = {
    'monitoring-submenu': {
        header: 'Monitoring Views',
        items: [
            { id: 'sub-3d-view', label: '3D View', icon: '3d-view', submode: '3d-view' },
            { id: 'sub-ranking-view', label: 'Ranking View (Coming Soon)', icon: 'ranking-view', submode: 'ranking-view', disabled: true }
        ]
    },
    'layout-submenu': {
        header: 'Layout Tools',
        items: [
            { id: 'sub-layout-editor', label: 'Layout Editor', icon: 'layout-editor', submode: 'layout-editor' },
            { id: 'sub-mapping', label: 'Equipment Mapping', icon: 'mapping', submode: 'mapping', action: 'openEquipmentEditModal' }
        ]
    },
    'debug-submenu': {
        header: 'Debug Tools',
        items: [
            { id: 'sub-app-state', label: '📊 Application State', action: 'setDebugView', params: ['app-state'] },
            { id: 'sub-performance', label: '⚡ Performance', action: 'setDebugView', params: ['performance'] },
            { id: 'sub-event-log', label: '📝 Event Log', action: 'setDebugView', params: ['event-log'] },
            { id: 'sub-console', label: '💻 Command Console', action: 'setDebugView', params: ['console'] },
            { type: 'divider' },
            { id: 'sub-full-debug', label: '📋 Full Debug Panel', action: 'toggleDebugPanel' }
        ]
    },
    'settings-submenu': {
        header: 'Settings',
        items: [
            { id: 'theme-toggle', type: 'theme-toggle' },
            { type: 'divider' },
            { id: 'dev-mode-toggle', label: 'Dev Mode: OFF', icon: 'code', action: 'toggleDevMode' },
            { id: 'mock-test-section', type: 'mock-tests', requiresDevMode: true }
        ]
    }
};

/**
 * APP_MODE 매핑 (기존 시스템과 연동)
 */
const MODE_MAP = {
    'monitoring': 'MONITORING',
    'analysis': 'ANALYTICS',
    'simulation': 'SIMULATION',
    'layout': 'LAYOUT_EDITOR',
    'equipment_edit': 'EQUIPMENT_EDIT'
};

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
        
        // 콜백 함수들 (main.js에서 주입)
        this.callbacks = {
            toggleConnectionModal: options.callbacks?.toggleConnectionModal || (() => {}),
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
        this._setupEventListeners();
        this._setupAppModeListeners();
        this._setupConnectionListeners();
        this._updateButtonStates();
        
        console.log('[Sidebar] 초기화 완료 v1.0.0');
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
        
        // 클릭 이벤트 (버튼 직접 클릭)
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
        
        // 클릭 이벤트
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
    // Event Handlers
    // ========================================
    
    _setupEventListeners() {
        // 키보드 단축키는 기존 KeyboardManager 사용
        // 여기서는 Sidebar 내부 이벤트만 처리
    }
    
    _setupAppModeListeners() {
        if (!this.eventBus) return;
        
        // 모드 변경 이벤트 수신
        const unsubMode = this.eventBus.on('mode:change', (data) => {
            this._onModeChange(data.to, data.from);
        });
        this._eventUnsubscribers.push(unsubMode);
        
        // 모드 진입 차단 이벤트
        const unsubBlocked = this.eventBus.on('mode:enter-blocked', (data) => {
            if (this.toast) {
                this.toast.warning('Mode Blocked', `${data.mode} requires backend connection`);
            }
        });
        this._eventUnsubscribers.push(unsubBlocked);
    }
    
    _setupConnectionListeners() {
        if (!this.connectionStatusService) return;
        
        // 연결 상태 변경 감지
        const unsubOnline = this.connectionStatusService.onOnline(() => {
            this.enableAfterConnection();
        });
        this._eventUnsubscribers.push(unsubOnline);
        
        const unsubOffline = this.connectionStatusService.onOffline(() => {
            this.disableBeforeConnection();
        });
        this._eventUnsubscribers.push(unsubOffline);
        
        // 초기 상태 확인
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
                this.callbacks.toggleConnectionModal?.();
                break;
                
            case 'monitoring':
                // 서브메뉴가 있는 버튼은 직접 클릭 시 모드 설정만
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
                // 이 버튼들은 서브메뉴만 열림 (선택 상태 없음)
                break;
        }
    }
    
    _handleSubmenuClick(item) {
        if (item.action) {
            // 콜백 함수 호출
            const callback = this.callbacks[item.action];
            if (callback) {
                if (item.params) {
                    callback(...item.params);
                } else {
                    callback();
                }
            } else {
                // 내부 메서드 호출
                const method = this[`_${item.action}`];
                if (method) {
                    method.call(this, ...(item.params || []));
                }
            }
        } else if (item.submode) {
            // SubMode 설정
            this._setSubMode(item.submode);
        }
    }
    
    // ========================================
    // Mode Management (AppModeManager 연동)
    // ========================================
    
    _setMode(mode) {
        if (!this.appModeManager) {
            console.warn('[Sidebar] AppModeManager not connected');
            this.currentMode = mode;
            this._updateOverlayUI();
            return;
        }
        
        // APP_MODE 매핑
        const appMode = this.APP_MODE[MODE_MAP[mode]] || this.APP_MODE.MAIN_VIEWER;
        
        // 토글 방식: 현재 모드면 main_viewer로, 아니면 해당 모드로
        this.appModeManager.toggleMode(appMode);
    }
    
    _setSubMode(submode) {
        this.currentSubMode = submode;
        
        // AppModeManager의 subMode 설정
        if (this.appModeManager) {
            this.appModeManager.setSubMode(submode);
        }
        
        // 서브메뉴 아이템 active 상태 업데이트
        this._updateSubmenuActiveState();
        
        // 특정 submode 처리
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
        // APP_MODE enum을 sidebar mode로 변환
        const modeKey = Object.entries(MODE_MAP).find(
            ([k, v]) => this.APP_MODE[v] === newMode
        )?.[0];
        
        this.currentMode = modeKey || null;
        this.currentSubMode = null;
        
        // 버튼 상태 업데이트
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
        const testControls = document.getElementById('test-controls');
        
        if (coverScreen) coverScreen.classList.add('hidden');
        if (threejsContainer) threejsContainer.classList.add('active');
        if (overlayUI) overlayUI.style.display = 'flex';
        if (testControls) testControls.style.display = 'block';
        
        // Three.js 초기화 이벤트 발행
        if (this.eventBus) {
            this.eventBus.emit('threejs:show-requested');
        }
    }
    
    _hideAllViews() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        const testControls = document.getElementById('test-controls');
        
        if (coverScreen) coverScreen.classList.add('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'flex';
        if (testControls) testControls.style.display = 'none';
    }
    
    showCoverScreen() {
        const coverScreen = document.getElementById('cover-screen');
        const threejsContainer = document.getElementById('threejs-container');
        const overlayUI = document.getElementById('overlay-ui');
        
        if (coverScreen) coverScreen.classList.remove('hidden');
        if (threejsContainer) threejsContainer.classList.remove('active');
        if (overlayUI) overlayUI.style.display = 'none';
        
        // Three.js 정지 이벤트
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
                ? `→ ${this.currentSubMode}`
                : '';
        }
    }
    
    // ========================================
    // Button State Management
    // ========================================
    
    _selectButton(key) {
        // 모든 버튼 선택 해제
        this.buttons.forEach((btn, k) => {
            const config = SIDEBAR_BUTTONS[k];
            if (config?.selectable !== false) {
                btn.classList.remove('selected');
            }
        });
        
        // 선택한 버튼 활성화
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
            
            // 연결 필요 여부
            if (config.requiresConnection && !this.isConnected) {
                shouldDisable = true;
            }
            
            // Dev Mode 필요 여부
            if (config.requiresDevMode && !this.devModeEnabled) {
                shouldHide = true;
            }
            
            // DevMode 또는 Connection 필요
            if (config.requiresDevModeOrConnection) {
                if (!this.devModeEnabled && !this.isConnected) {
                    shouldDisable = true;
                }
            }
            
            // 항상 활성화
            if (config.alwaysEnabled) {
                shouldDisable = false;
            }
            
            // 기본 비활성화 (미구현)
            if (config.disabled) {
                shouldDisable = true;
            }
            
            // 상태 적용
            btn.classList.toggle('disabled', shouldDisable);
            
            if (wrapper) {
                wrapper.classList.toggle('disabled', shouldDisable);
                wrapper.classList.toggle('hidden', shouldHide);
            } else {
                btn.classList.toggle('hidden', shouldHide);
            }
        });
    }
    
    _updateSubmenuActiveState() {
        // 모든 서브메뉴 아이템 비활성화
        document.querySelectorAll('.submenu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 현재 submode에 해당하는 아이템 활성화
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
    
    /**
     * Backend 연결 후 UI 활성화
     */
    enableAfterConnection() {
        this.isConnected = true;
        this._updateButtonStates();
        this._updateCoverStatus(true);
        
        console.log('[Sidebar] Backend 연결됨 - UI 활성화');
    }
    
    /**
     * Backend 연결 전/해제 시 UI 비활성화
     */
    disableBeforeConnection() {
        this.isConnected = false;
        this._updateButtonStates();
        this._updateCoverStatus(false);
        
        // 모드 초기화
        this.currentMode = null;
        this.currentSubMode = null;
        this._updateButtonSelection();
        this._updateOverlayUI();
        
        // Cover Screen 표시
        this.showCoverScreen();
        
        console.log('[Sidebar] Backend 연결 해제 - UI 비활성화');
    }
    
    _updateCoverStatus(connected) {
        const apiDot = document.getElementById('cover-api-dot');
        const apiStatus = document.getElementById('cover-api-status');
        const dbDot = document.getElementById('cover-db-dot');
        const dbStatus = document.getElementById('cover-db-status');
        
        const dotClass = connected ? 'connected' : 'disconnected';
        const statusText = connected ? 'Connected' : 'Disconnected';
        
        if (apiDot) apiDot.className = `cover-status-dot ${dotClass}`;
        if (apiStatus) apiStatus.textContent = statusText;
        if (dbDot) dbDot.className = `cover-status-dot ${dotClass}`;
        if (dbStatus) dbStatus.textContent = connected ? 'Site Connected' : 'Not Connected';
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
        
        // Three.js 씬 배경색 변경 이벤트
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
        
        // UI 업데이트
        const badge = document.getElementById('dev-mode-badge');
        const devModeLabel = document.getElementById('dev-mode-toggle');
        const mockTestSection = document.getElementById('mock-test-section');
        
        if (badge) {
            badge.classList.toggle('active', this.devModeEnabled);
        }
        
        if (devModeLabel) {
            const labelSpan = devModeLabel.querySelector('span') || devModeLabel;
            if (labelSpan.tagName === 'SPAN') {
                labelSpan.textContent = `Dev Mode: ${this.devModeEnabled ? 'ON' : 'OFF'}`;
            } else {
                devModeLabel.textContent = `Dev Mode: ${this.devModeEnabled ? 'ON' : 'OFF'}`;
            }
        }
        
        if (mockTestSection) {
            mockTestSection.style.display = this.devModeEnabled ? 'block' : 'none';
        }
        
        // 버튼 상태 업데이트
        this._updateButtonStates();
        
        if (this.toast) {
            if (this.devModeEnabled) {
                this.toast.warning('Dev Mode ON', 'Mock testing enabled');
            } else {
                this.toast.info('Dev Mode OFF', '');
            }
        }
    }
    
    _loadMockTest(testName) {
        if (this.toast) {
            this.toast.info('Mock Test', `Loading: ${testName}`);
        }
        
        // Mock 테스트 이벤트 발행
        if (this.eventBus) {
            this.eventBus.emit('mock:load-test', { testName });
        }
    }
    
    _setDebugView(view) {
        if (this.toast) {
            this.toast.info('Debug View', view);
        }
        
        if (this.eventBus) {
            this.eventBus.emit('debug:set-view', { view });
        }
    }
    
    _toggleDebugPanel() {
        this.callbacks.toggleDebugPanel?.();
    }
    
    // ========================================
    // Public API
    // ========================================
    
    /**
     * 현재 모드 가져오기
     * @returns {string|null}
     */
    getCurrentMode() {
        return this.currentMode;
    }
    
    /**
     * 현재 서브모드 가져오기
     * @returns {string|null}
     */
    getCurrentSubMode() {
        return this.currentSubMode;
    }
    
    /**
     * 연결 상태 확인
     * @returns {boolean}
     */
    getIsConnected() {
        return this.isConnected;
    }
    
    /**
     * Dev Mode 상태 확인
     * @returns {boolean}
     */
    getDevModeEnabled() {
        return this.devModeEnabled;
    }
    
    /**
     * 특정 버튼 활성화/비활성화
     * @param {string} key - 버튼 키
     * @param {boolean} enabled - 활성화 여부
     */
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
    
    /**
     * 특정 버튼 표시/숨김
     * @param {string} key - 버튼 키
     * @param {boolean} visible - 표시 여부
     */
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
    
    /**
     * 정리 (destroy)
     */
    destroy() {
        // 이벤트 리스너 정리
        this._eventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._eventUnsubscribers = [];
        
        // DOM 제거
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        const badge = document.getElementById('dev-mode-badge');
        if (badge) badge.remove();
        
        // 참조 정리
        this.buttons.clear();
        this.submenus.clear();
        
        console.log('[Sidebar] 정리 완료');
    }
}

// 기본 내보내기
export default Sidebar;