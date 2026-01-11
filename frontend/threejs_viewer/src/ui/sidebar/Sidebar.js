/**
 * Sidebar.js
 * ==========
 * Cleanroom Sidebar UI 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.1.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * 
 * @changelog
 * - v1.1.0: 🔧 Connection Modal 동적 생성 추가
 *           - _createConnectionModal() 메서드 추가
 *           - toggleConnectionModal() 내부 처리
 *           - 버튼 우상단 Dot 상태 표시 제거 (StatusBar와 중복)
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
 * Connection Modal 사이트 목록
 */
const SITE_LIST = [
    { id: 'korea_site1', flag: '🇰🇷', name: 'Korea Site 1', desc: 'Seoul Manufacturing Plant' },
    { id: 'vietnam_site1', flag: '🇻🇳', name: 'Vietnam Site 1', desc: 'Ho Chi Minh Factory' },
    { id: 'usa_site1', flag: '🇺🇸', name: 'USA Site 1', desc: 'Texas Production Center' }
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
        
        console.log('[Sidebar] 초기화 완료 v1.1.0');
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
    // 🆕 v1.1.0: Connection Modal 생성
    // ========================================
    
    _createConnectionModal() {
        // 기존 모달이 있으면 제거
        const existing = document.getElementById('connection-modal');
        if (existing) existing.remove();
        
        this.connectionModal = document.createElement('div');
        this.connectionModal.id = 'connection-modal';
        this.connectionModal.className = 'modal';
        
        this.connectionModal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🔌 Database Connection Manager</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Connection Status -->
                    <div class="connection-status-box" style="
                        background: var(--bg-input);
                        border: 1px solid var(--border-color);
                        border-radius: 10px;
                        padding: 16px;
                        margin-bottom: 20px;
                    ">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <span class="status-dot disconnected" id="modal-api-dot"></span>
                            <span style="color: var(--text-secondary);">Backend API:</span>
                            <span style="color: var(--text-primary); font-weight: 500;" id="modal-api-status">Disconnected</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="status-dot disconnected" id="modal-db-dot"></span>
                            <span style="color: var(--text-secondary);">Database:</span>
                            <span style="color: var(--text-primary); font-weight: 500;" id="modal-db-status">Not Connected</span>
                        </div>
                    </div>
                    
                    <!-- Site Selection -->
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">
                        Select a site to connect to the database:
                    </p>
                    <div class="site-list" style="display: flex; flex-direction: column; gap: 12px;">
                        ${SITE_LIST.map(site => `
                            <button class="site-item submenu-item" data-site-id="${site.id}" style="
                                background: var(--bg-input);
                                border-radius: 10px;
                                padding: 16px;
                                display: flex;
                                align-items: center;
                                gap: 16px;
                            ">
                                <span style="font-size: 28px;">${site.flag}</span>
                                <div style="text-align: left;">
                                    <div style="font-weight: 600; color: var(--text-primary);">${site.name}</div>
                                    <div style="font-size: 12px; color: var(--text-muted);">${site.desc}</div>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                    
                    <!-- Refresh Button -->
                    <button class="btn-refresh" style="
                        margin-top: 20px;
                        width: 100%;
                        padding: 12px;
                        background: var(--bg-hover);
                        border: 1px solid var(--border-color);
                        border-radius: 8px;
                        color: var(--text-secondary);
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.2s;
                    ">
                        🔄 Refresh Connection Status
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.connectionModal);
        
        // 이벤트 설정
        this._setupConnectionModalEvents();
    }
    
    _setupConnectionModalEvents() {
        if (!this.connectionModal) return;
        
        // 오버레이 클릭으로 닫기
        const overlay = this.connectionModal.querySelector('.modal-overlay');
        overlay?.addEventListener('click', () => this.closeConnectionModal());
        
        // 닫기 버튼
        const closeBtn = this.connectionModal.querySelector('.modal-close');
        closeBtn?.addEventListener('click', () => this.closeConnectionModal());
        
        // Site 버튼 클릭
        this.connectionModal.querySelectorAll('.site-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const siteId = btn.dataset.siteId;
                this._connectToSite(siteId);
            });
        });
        
        // Refresh 버튼
        const refreshBtn = this.connectionModal.querySelector('.btn-refresh');
        refreshBtn?.addEventListener('click', () => this._checkBackendHealth());
        
        // Hover 효과
        refreshBtn?.addEventListener('mouseenter', () => {
            refreshBtn.style.background = 'var(--bg-selected)';
            refreshBtn.style.color = 'var(--icon-selected)';
        });
        refreshBtn?.addEventListener('mouseleave', () => {
            refreshBtn.style.background = 'var(--bg-hover)';
            refreshBtn.style.color = 'var(--text-secondary)';
        });
    }
    
    /**
     * Connection Modal 열기
     */
    openConnectionModal() {
        if (this.connectionModal) {
            this.connectionModal.classList.add('active');
            this.connectionModalOpen = true;
            this._updateConnectionModalStatus();
            
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
    
    /**
     * Connection Modal 상태 업데이트
     */
    _updateConnectionModalStatus() {
        const apiDot = document.getElementById('modal-api-dot');
        const apiStatus = document.getElementById('modal-api-status');
        const dbDot = document.getElementById('modal-db-dot');
        const dbStatus = document.getElementById('modal-db-status');
        
        // API 상태
        const isApiOnline = this.connectionStatusService?.isOnline?.() || false;
        if (apiDot) {
            apiDot.className = `status-dot ${isApiOnline ? 'connected' : 'disconnected'}`;
        }
        if (apiStatus) {
            apiStatus.textContent = isApiOnline ? 'Connected' : 'Disconnected';
        }
        
        // DB 상태
        if (dbDot) {
            dbDot.className = `status-dot ${this.isConnected ? 'connected' : 'disconnected'}`;
        }
        if (dbStatus) {
            dbStatus.textContent = this.isConnected ? 'Connected' : 'Not Connected';
        }
    }
    
    /**
     * 사이트 연결 시도
     */
    async _connectToSite(siteId) {
        console.log(`🔗 Connecting to: ${siteId}`);
        
        const dbStatus = document.getElementById('modal-db-status');
        if (dbStatus) {
            dbStatus.textContent = 'Connecting...';
        }
        
        if (this.toast) {
            this.toast.info('Connecting', `Connecting to ${siteId}...`);
        }
        
        try {
            // TODO: 실제 연결 로직 (API 호출)
            // const response = await fetch(`${API_BASE_URL}/api/connection/connect`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ site_id: siteId })
            // });
            
            // 시뮬레이션: Dev Mode면 성공으로 처리
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (this.devModeEnabled) {
                // Dev Mode: 연결 성공 시뮬레이션
                this.isConnected = true;
                this._updateButtonStates();
                this._updateConnectionModalStatus();
                
                if (this.eventBus) {
                    this.eventBus.emit('site:connected', { siteId, siteName: siteId });
                }
                
                if (this.toast) {
                    this.toast.success('Connected', `Connected to ${siteId}`);
                }
                
                this.closeConnectionModal();
            } else {
                // 실제 모드: Backend 필요
                if (dbStatus) {
                    dbStatus.textContent = 'Failed (No Backend)';
                }
                if (this.toast) {
                    this.toast.error('Failed', 'Backend not available');
                }
            }
        } catch (error) {
            console.error('Connection failed:', error);
            if (dbStatus) {
                dbStatus.textContent = 'Failed';
            }
            if (this.toast) {
                this.toast.error('Connection Failed', error.message);
            }
        }
    }
    
    /**
     * Backend Health Check
     */
    async _checkBackendHealth() {
        console.log('🔍 Checking backend health...');
        
        const apiStatus = document.getElementById('modal-api-status');
        if (apiStatus) {
            apiStatus.textContent = 'Checking...';
        }
        
        try {
            // ConnectionStatusService 사용
            if (this.connectionStatusService) {
                const isOnline = await this.connectionStatusService.checkOnline?.() || 
                                 this.connectionStatusService.isOnline?.() || false;
                this._updateConnectionModalStatus();
                
                if (this.toast) {
                    if (isOnline) {
                        this.toast.success('Backend Online', 'API is available');
                    } else {
                        this.toast.warning('Backend Offline', 'API is not available');
                    }
                }
            }
        } catch (error) {
            console.error('Health check failed:', error);
            if (apiStatus) {
                apiStatus.textContent = 'Disconnected';
            }
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
            this._updateConnectionModalStatus();
        });
        this._eventUnsubscribers.push(unsubOnline);
        
        const unsubOffline = this.connectionStatusService.onOffline(() => {
            this.disableBeforeConnection();
            this._updateConnectionModalStatus();
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
                // 🆕 v1.1.0: 자체 모달 사용 (무한 루프 방지)
                // 콜백 호출 시 main.js가 다시 이 메서드를 호출할 수 있으므로
                this.toggleConnectionModal();
                
                // 이벤트 발행 (추가 처리용)
                if (this.eventBus) {
                    const isOpen = this.connectionModal?.classList.contains('active');
                    this.eventBus.emit(isOpen ? 'connectionModal:opened' : 'connectionModal:closed');
                }
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
            } else {
                const method = this[`_${item.action}`];
                if (method) {
                    method.call(this, ...(item.params || []));
                }
            }
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
                ? `→ ${this.currentSubMode}`
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