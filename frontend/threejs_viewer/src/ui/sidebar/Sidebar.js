/**
 * Sidebar.js
 * ==========
 * Cleanroom Sidebar UI 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.2.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * 
 * @changelog
 * - v1.2.0: 🔧 Connection Modal v2.9 Full Version 복원
 *           - Internet Status with Ping
 *           - Backend API Panel (API URL, Response Time)
 *           - Site Connection Panel (Priority, Auto-connect, Select/Deselect All)
 *           - Connected Databases Panel (Equipment 수, Lines, Active Lots)
 *           - Modal Footer (단축키 힌트, Close 버튼)
 *           🔧 _handleSubmenuClick 로직 수정 (Dev Mode 문제 해결)
 *           - public 메서드 직접 호출 지원 (언더스코어 없이)
 * - v1.1.0: Connection Modal 동적 생성 추가
 * - v1.0.0: 초기 버전
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
 * 위치: frontend/threejs_viewer/src/ui/sidebar/Sidebar.js
 */

import { ICONS, getIcon } from './IconRegistry.js';

// ============================================
// Constants
// ============================================

/**
 * 사이드바 버튼 설정
 */
const SIDEBAR_BUTTONS = {
    connection: {
        id: 'btn-connection',
        icon: 'connection',
        tooltip: 'Database Connection (Ctrl+K)',
        mode: 'connection',
        alwaysEnabled: true,
        selectable: false
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
        disabled: true
    },
    simulation: {
        id: 'btn-simulation',
        icon: 'simulation',
        tooltip: 'Simulation (Coming Soon)',
        mode: 'simulation',
        requiresConnection: true,
        disabled: true
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
        hidden: true
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
 * 🆕 v1.2.0: Connection Modal 사이트 목록 (v2.9 Full Version)
 * Priority 포함
 */
const SITE_LIST = [
    { id: 'kr_b_01', flag: '🇰🇷', name: 'Korea Site B-01', region: 'Asia/Seoul', priority: 10 },
    { id: 'kr_b_02', flag: '🇰🇷', name: 'Korea Site B-02', region: 'Asia/Seoul', priority: 8 },
    { id: 'vn_a_01', flag: '🇻🇳', name: 'Vietnam Site A-01', region: 'Asia/Ho_Chi_Minh', priority: 5 }
];

/**
 * APP_MODE 매핑
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
        this.connectionModalOpen = false;
        
        // 🆕 v1.2.0: Site 상태 관리
        this.selectedSite = null;
        this.siteStatus = {};
        SITE_LIST.forEach(site => {
            this.siteStatus[site.id] = { status: 'disconnected' };
        });
        
        // DOM 참조
        this.element = null;
        this.connectionModal = null;
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
        this._createConnectionModal();
        this._setupEventListeners();
        this._setupAppModeListeners();
        this._setupConnectionListeners();
        this._updateButtonStates();
        
        console.log('[Sidebar] 초기화 완료 v1.2.0');
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
    // 🆕 v1.2.0: Connection Modal v2.9 Full Version
    // ========================================
    
    _createConnectionModal() {
        // 기존 모달이 있으면 제거
        const existing = document.getElementById('connection-modal');
        if (existing) existing.remove();
        
        this.connectionModal = document.createElement('div');
        this.connectionModal.id = 'connection-modal';
        this.connectionModal.className = 'modal-overlay';
        
        this.connectionModal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <div class="modal-title">🔌 Database Connection Manager</div>
                    <button class="modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <!-- Internet Status with Ping -->
                    <div class="internet-status" id="internet-status">
                        <span class="status-dot connected" id="internet-dot"></span>
                        <span class="internet-status-text" id="internet-text">Internet Connected</span>
                        <span class="internet-status-detail" id="internet-detail">Ping: --ms</span>
                    </div>
                    
                    <!-- Backend API Status Panel -->
                    <div class="connection-panel">
                        <div class="panel-header">
                            <h3>🔌 Backend API Status</h3>
                            <button class="btn-connect btn-check" style="padding:6px 12px;font-size:12px">🔄 Check</button>
                        </div>
                        <div class="api-status-content">
                            <div class="status-indicator-box">
                                <span class="status-dot status-dot--checking" id="api-status-dot"></span>
                                <span class="status-text" id="api-status-text">Checking...</span>
                            </div>
                            <div class="status-details">
                                <div class="status-detail">
                                    <span class="detail-label">API URL</span>
                                    <span class="detail-value" id="api-url-value">http://localhost:8000</span>
                                </div>
                                <div class="status-detail">
                                    <span class="detail-label">Response</span>
                                    <span class="detail-value" id="response-time">-</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Site Connection Panel -->
                    <div class="connection-panel">
                        <div class="panel-header">
                            <h3>🔍 Site Connection</h3>
                            <div class="panel-actions">
                                <label class="auto-connect-label">
                                    <input type="checkbox" id="auto-connect-checkbox">
                                    <span>Auto</span>
                                </label>
                                <button class="btn-icon btn-select-all" title="Select All">☑️</button>
                                <button class="btn-icon btn-deselect-all" title="Deselect All">☐</button>
                            </div>
                        </div>
                        <div class="site-list" id="site-list"></div>
                        <div class="panel-footer">
                            <span class="selection-info" id="selection-count">Selected: 0</span>
                            <button class="btn-connect" id="connect-btn" disabled>🔌 Connect</button>
                        </div>
                    </div>
                    
                    <!-- Connected Databases Panel -->
                    <div class="connection-panel">
                        <div class="panel-header">
                            <h3>📊 Connected Databases</h3>
                            <button class="btn-connect btn-refresh-db" style="padding:6px 12px;font-size:12px">🔄 Refresh</button>
                        </div>
                        <div id="database-list">
                            <div class="no-connection">
                                <span class="no-connection-icon">📂</span>
                                <p>No database connected</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <span class="footer-hint">Ctrl+K to toggle | Escape to close</span>
                    <button class="btn-secondary btn-close-modal">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.connectionModal);
        
        // Site List 렌더링
        this._renderSiteList();
        
        // 이벤트 설정
        this._setupConnectionModalEvents();
        
        // 초기 Ping 체크
        this._checkInternetStatus();
    }
    
    _setupConnectionModalEvents() {
        if (!this.connectionModal) return;
        
        // 오버레이 클릭으로 닫기
        this.connectionModal.addEventListener('click', (e) => {
            if (e.target === this.connectionModal) {
                this.closeConnectionModal();
            }
        });
        
        // 닫기 버튼 (헤더)
        const closeBtn = this.connectionModal.querySelector('.modal-close');
        closeBtn?.addEventListener('click', () => this.closeConnectionModal());
        
        // 닫기 버튼 (푸터)
        const closeModalBtn = this.connectionModal.querySelector('.btn-close-modal');
        closeModalBtn?.addEventListener('click', () => this.closeConnectionModal());
        
        // API Check 버튼
        const checkBtn = this.connectionModal.querySelector('.btn-check');
        checkBtn?.addEventListener('click', () => this._refreshAPIStatus());
        
        // Select All / Deselect All 버튼
        const selectAllBtn = this.connectionModal.querySelector('.btn-select-all');
        selectAllBtn?.addEventListener('click', () => this._selectAllSites());
        
        const deselectAllBtn = this.connectionModal.querySelector('.btn-deselect-all');
        deselectAllBtn?.addEventListener('click', () => this._deselectAllSites());
        
        // Connect 버튼
        const connectBtn = this.connectionModal.querySelector('#connect-btn');
        connectBtn?.addEventListener('click', () => this._connectToSelectedSite());
        
        // Refresh Database 버튼
        const refreshDbBtn = this.connectionModal.querySelector('.btn-refresh-db');
        refreshDbBtn?.addEventListener('click', () => this._refreshDatabaseInfo());
    }
    
    /**
     * 🆕 v1.2.0: Site List 렌더링 (v2.9 스타일)
     */
    _renderSiteList() {
        const siteList = this.connectionModal?.querySelector('#site-list');
        if (!siteList) return;
        
        siteList.innerHTML = SITE_LIST.map(site => {
            const isSelected = this.selectedSite === site.id;
            const status = this.siteStatus[site.id] || {};
            const isConnectedSite = status.status === 'connected';
            
            return `
                <div class="site-item ${isSelected ? 'site-item--selected' : ''} ${isConnectedSite ? 'site-item--connected' : ''}" 
                     data-site-id="${site.id}">
                    <div class="site-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} data-site-checkbox="${site.id}">
                    </div>
                    <div class="site-info">
                        <div class="site-main">
                            <span style="font-size: 20px; margin-right: 8px;">${site.flag}</span>
                            <span class="site-name">${site.name}</span>
                            <span class="site-region">${site.region}</span>
                        </div>
                        <div class="site-meta">
                            <span>Priority: ${site.priority}</span>
                        </div>
                    </div>
                    <div class="site-status">
                        ${isConnectedSite 
                            ? `<span>✅</span><button class="btn-disconnect" data-disconnect="${site.id}">Disconnect</button>` 
                            : '<span>⚪</span>'}
                    </div>
                </div>
            `;
        }).join('');
        
        // Site Item 클릭 이벤트
        siteList.querySelectorAll('.site-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-disconnect')) return;
                if (e.target.tagName === 'INPUT') return;
                const siteId = item.dataset.siteId;
                this._toggleSiteSelection(siteId);
            });
        });
        
        // Checkbox 클릭 이벤트
        siteList.querySelectorAll('[data-site-checkbox]').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = checkbox.dataset.siteCheckbox;
                this._toggleSiteSelection(siteId);
            });
        });
        
        // Disconnect 버튼 이벤트
        siteList.querySelectorAll('.btn-disconnect').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = btn.dataset.disconnect;
                this._disconnectFromSite(siteId);
            });
        });
        
        this._updateSelectionUI();
    }
    
    _toggleSiteSelection(siteId) {
        this.selectedSite = this.selectedSite === siteId ? null : siteId;
        this._renderSiteList();
    }
    
    _selectAllSites() {
        if (SITE_LIST.length > 0) {
            this.selectedSite = SITE_LIST[0].id;
        }
        this._renderSiteList();
        if (this.toast) {
            this.toast.info('Select All', 'First site selected (single selection mode)');
        }
    }
    
    _deselectAllSites() {
        this.selectedSite = null;
        this._renderSiteList();
        if (this.toast) {
            this.toast.info('Deselect All', 'Selection cleared');
        }
    }
    
    _updateSelectionUI() {
        const selectionCount = this.connectionModal?.querySelector('#selection-count');
        const connectBtn = this.connectionModal?.querySelector('#connect-btn');
        
        if (selectionCount) {
            selectionCount.textContent = `Selected: ${this.selectedSite ? 1 : 0}`;
        }
        if (connectBtn) {
            connectBtn.disabled = !this.selectedSite;
        }
    }
    
    /**
     * 🆕 v1.2.0: Internet Status 체크
     */
    _checkInternetStatus() {
        const dot = this.connectionModal?.querySelector('#internet-dot');
        const text = this.connectionModal?.querySelector('#internet-text');
        const detail = this.connectionModal?.querySelector('#internet-detail');
        
        // 시뮬레이션
        const ping = Math.floor(Math.random() * 50 + 10);
        
        if (dot) dot.className = 'status-dot connected';
        if (text) text.textContent = 'Internet Connected';
        if (detail) detail.textContent = `Ping: ${ping}ms`;
    }
    
    /**
     * 🆕 v1.2.0: API Status 체크
     */
    _refreshAPIStatus() {
        const dot = this.connectionModal?.querySelector('#api-status-dot');
        const text = this.connectionModal?.querySelector('#api-status-text');
        const responseTime = this.connectionModal?.querySelector('#response-time');
        
        if (dot) dot.className = 'status-dot status-dot--checking';
        if (text) text.textContent = 'Checking...';
        if (responseTime) responseTime.textContent = '-';
        
        setTimeout(() => {
            // ConnectionStatusService 사용
            const isOnline = this.connectionStatusService?.isOnline?.() || this.devModeEnabled;
            
            if (isOnline || this.devModeEnabled) {
                if (dot) dot.className = 'status-dot status-dot--connected';
                if (text) {
                    text.textContent = 'Connected';
                    text.className = 'status-text run';
                }
                if (responseTime) responseTime.textContent = `${Math.floor(Math.random() * 50 + 20)}ms`;
                
                if (this.toast) {
                    this.toast.success('Backend Online', 'API is available');
                }
            } else {
                if (dot) dot.className = 'status-dot status-dot--disconnected';
                if (text) {
                    text.textContent = 'Disconnected';
                    text.className = 'status-text stop';
                }
                if (responseTime) responseTime.textContent = 'Timeout';
                
                if (this.toast) {
                    this.toast.warning('Backend Offline', 'API is not available');
                }
            }
        }, 1000);
    }
    
    /**
     * 🆕 v1.2.0: 사이트 연결
     */
    async _connectToSelectedSite() {
        if (!this.selectedSite) return;
        
        const connectBtn = this.connectionModal?.querySelector('#connect-btn');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = '⏳ Connecting...';
        }
        
        if (this.toast) {
            this.toast.info('Connecting', `Connecting to ${this.selectedSite}...`);
        }
        
        try {
            // 시뮬레이션
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Dev Mode면 성공으로 처리
            this.siteStatus[this.selectedSite] = { status: 'connected' };
            this.isConnected = true;
            
            this._renderSiteList();
            this._updateButtonStates();
            this._updateCoverStatus(true);
            this._updateDatabaseList(this.selectedSite);
            
            if (connectBtn) {
                connectBtn.textContent = '🔌 Connect';
            }
            
            const site = SITE_LIST.find(s => s.id === this.selectedSite);
            if (this.toast) {
                this.toast.success('Connected', `Successfully connected to ${site?.name || this.selectedSite}`);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('site:connected', { 
                    siteId: this.selectedSite, 
                    siteName: site?.name || this.selectedSite 
                });
            }
            
            // 전역 상태 동기화
            if (window.sidebarState) {
                window.sidebarState.isConnected = true;
            }
            
        } catch (error) {
            console.error('Connection failed:', error);
            if (connectBtn) {
                connectBtn.textContent = '🔌 Connect';
                connectBtn.disabled = false;
            }
            if (this.toast) {
                this.toast.error('Connection Failed', error.message);
            }
        }
    }
    
    /**
     * 🆕 v1.2.0: 사이트 연결 해제
     */
    _disconnectFromSite(siteId) {
        this.siteStatus[siteId] = { status: 'disconnected' };
        this.isConnected = false;
        this.selectedSite = null;
        
        this._renderSiteList();
        this._updateButtonStates();
        this._updateCoverStatus(false);
        this._updateDatabaseList(null);
        
        // Cover Screen 표시
        this.showCoverScreen();
        
        // 모드 초기화
        this.currentMode = null;
        this.currentSubMode = null;
        this._updateButtonSelection();
        this._updateOverlayUI();
        
        if (this.toast) {
            this.toast.info('Disconnected', 'Database connection closed');
        }
        
        if (this.eventBus) {
            this.eventBus.emit('site:disconnected');
        }
        
        // 전역 상태 동기화
        if (window.sidebarState) {
            window.sidebarState.isConnected = false;
        }
    }
    
    /**
     * 🆕 v1.2.0: Database List 업데이트 (v2.9 스타일)
     */
    _updateDatabaseList(siteId) {
        const dbList = this.connectionModal?.querySelector('#database-list');
        if (!dbList) return;
        
        if (siteId) {
            const site = SITE_LIST.find(s => s.id === siteId);
            dbList.innerHTML = `
                <div class="database-item">
                    <div class="database-header">
                        <h4>📊 ${site?.name || siteId}</h4>
                    </div>
                    <div class="database-stats">
                        <div class="stat-item">
                            <span class="stat-label">Equipment:</span>
                            <span class="stat-value">117</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Lines:</span>
                            <span class="stat-value">6</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Active Lots:</span>
                            <span class="stat-value">85</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            dbList.innerHTML = `
                <div class="no-connection">
                    <span class="no-connection-icon">📂</span>
                    <p>No database connected</p>
                </div>
            `;
        }
    }
    
    _refreshDatabaseInfo() {
        if (this.toast) {
            this.toast.success('Refreshed', 'Database information updated');
        }
    }
    
    /**
     * Connection Modal 열기
     */
    openConnectionModal() {
        if (this.connectionModal) {
            this.connectionModal.classList.add('active');
            this.connectionModalOpen = true;
            this._checkInternetStatus();
            this._refreshAPIStatus();
            
            if (this.eventBus) {
                this.eventBus.emit('connectionModal:opened');
            }
        }
    }
    
    /**
     * Connection Modal 닫기
     */
    closeConnectionModal() {
        if (this.connectionModal) {
            this.connectionModal.classList.remove('active');
            this.connectionModalOpen = false;
            
            if (this.eventBus) {
                this.eventBus.emit('connectionModal:closed');
            }
        }
    }
    
    /**
     * Connection Modal 토글
     */
    toggleConnectionModal() {
        if (this.connectionModalOpen) {
            this.closeConnectionModal();
        } else {
            this.openConnectionModal();
        }
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
                // 자체 모달 사용
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
     * 🆕 v1.2.0: _handleSubmenuClick 수정 - public 메서드 직접 호출 지원
     * 
     * 호출 순서:
     * 1. callbacks 객체에서 찾기 (외부 주입된 콜백)
     * 2. this 인스턴스의 public 메서드에서 찾기 (언더스코어 없이)
     * 3. this 인스턴스의 private 메서드에서 찾기 (_prefix)
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
            
            // 2. 🆕 v1.2.0: this 인스턴스에서 찾기 (public 메서드 - 언더스코어 없이)
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
        this._updateCoverStatus(true);
        
        console.log('[Sidebar] Backend 연결됨 - UI 활성화');
    }
    
    disableBeforeConnection() {
        this.isConnected = false;
        this._updateButtonStates();
        this._updateCoverStatus(false);
        
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
        
        if (dbStatus) {
            if (connected && this.selectedSite) {
                const site = SITE_LIST.find(s => s.id === this.selectedSite);
                dbStatus.textContent = site?.name || this.selectedSite;
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
     * 🆕 v1.2.0: Dev Mode 토글 (public 메서드)
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
            // submenu-item 내부의 span 찾기
            const labelSpan = devModeLabel.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = labelText;
            } else {
                // span이 없으면 전체 텍스트 변경 (아이콘 제외)
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
        
        if (this.connectionModal) {
            this.connectionModal.remove();
            this.connectionModal = null;
        }
        
        const badge = document.getElementById('dev-mode-badge');
        if (badge) badge.remove();
        
        this.buttons.clear();
        this.submenus.clear();
        
        console.log('[Sidebar] 정리 완료');
    }
}

export default Sidebar;