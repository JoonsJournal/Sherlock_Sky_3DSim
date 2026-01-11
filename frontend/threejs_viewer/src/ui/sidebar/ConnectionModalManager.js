/**
 * ConnectionModalManager.js
 * =========================
 * Sidebar에서 분리된 Connection Modal 관리 클래스
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * @source Sidebar.js v1.3.0 (Connection Modal 섹션)
 * 
 * @description
 * Sidebar.js 리팩토링 Phase 3
 * - Connection Modal 생성 및 관리
 * - Site 연결/해제 기능
 * - Internet/API 상태 체크
 * - Database 정보 표시
 * 
 * @usage
 * import { ConnectionModalManager } from './ConnectionModalManager.js';
 * 
 * const modal = new ConnectionModalManager({
 *     toast: toastInstance,
 *     eventBus: eventBusInstance,
 *     connectionStatusService: connectionStatusService,
 *     siteList: SITE_LIST,
 *     onConnect: (siteId, siteName) => { ... },
 *     onDisconnect: () => { ... }
 * });
 * 
 * modal.open();
 * modal.toggle();
 * modal.close();
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/ConnectionModalManager.js
 */

import { SITE_LIST, getSiteById } from './SidebarConfig.js';

// ============================================
// ConnectionModalManager Class
// ============================================

export class ConnectionModalManager {
    /**
     * @param {Object} options
     * @param {Object} options.toast - Toast 인스턴스
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
     * @param {Array} options.siteList - 사이트 목록 (기본값: SITE_LIST)
     * @param {Function} options.onConnect - 연결 성공 콜백 (siteId, siteName)
     * @param {Function} options.onDisconnect - 연결 해제 콜백
     * @param {boolean} options.devModeEnabled - Dev Mode 상태 getter
     */
    constructor(options = {}) {
        // 의존성
        this.toast = options.toast || null;
        this.eventBus = options.eventBus || null;
        this.connectionStatusService = options.connectionStatusService || null;
        
        // 사이트 목록 (외부 주입 가능)
        this.siteList = options.siteList || SITE_LIST;
        
        // 콜백
        this.onConnect = options.onConnect || (() => {});
        this.onDisconnect = options.onDisconnect || (() => {});
        
        // Dev Mode 상태 getter (Sidebar에서 전달)
        this._getDevModeEnabled = options.getDevModeEnabled || (() => false);
        
        // 상태
        this.isOpen = false;
        this.selectedSite = null;
        this.siteStatus = {};
        
        // 사이트 상태 초기화
        this.siteList.forEach(site => {
            this.siteStatus[site.id] = { status: 'disconnected' };
        });
        
        // DOM 참조
        this.element = null;
        
        // 초기화
        this._create();
    }
    
    // ========================================
    // Getters
    // ========================================
    
    /**
     * Dev Mode 상태 반환
     */
    get devModeEnabled() {
        return this._getDevModeEnabled();
    }
    
    /**
     * 현재 선택된 사이트 반환
     */
    getSelectedSite() {
        return this.selectedSite;
    }
    
    /**
     * 사이트 연결 상태 반환
     */
    getSiteStatus(siteId) {
        return this.siteStatus[siteId] || { status: 'disconnected' };
    }
    
    /**
     * 연결된 사이트가 있는지 확인
     */
    hasConnectedSite() {
        return Object.values(this.siteStatus).some(s => s.status === 'connected');
    }
    
    // ========================================
    // Modal Creation
    // ========================================
    
    /**
     * Modal DOM 생성
     */
    _create() {
        // 기존 모달이 있으면 제거
        const existing = document.getElementById('connection-modal');
        if (existing) existing.remove();
        
        this.element = document.createElement('div');
        this.element.id = 'connection-modal';
        this.element.className = 'modal-overlay';
        
        this.element.innerHTML = `
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
        
        document.body.appendChild(this.element);
        
        // Site List 렌더링
        this._renderSiteList();
        
        // 이벤트 설정
        this._setupEvents();
        
        console.log('[ConnectionModalManager] 생성 완료');
    }
    
    // ========================================
    // Event Setup
    // ========================================
    
    /**
     * 이벤트 리스너 설정
     */
    _setupEvents() {
        if (!this.element) return;
        
        // 오버레이 클릭으로 닫기
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });
        
        // 닫기 버튼 (헤더)
        const closeBtn = this.element.querySelector('.modal-close');
        closeBtn?.addEventListener('click', () => this.close());
        
        // 닫기 버튼 (푸터)
        const closeModalBtn = this.element.querySelector('.btn-close-modal');
        closeModalBtn?.addEventListener('click', () => this.close());
        
        // API Check 버튼
        const checkBtn = this.element.querySelector('.btn-check');
        checkBtn?.addEventListener('click', () => this.refreshAPIStatus());
        
        // Select All / Deselect All 버튼
        const selectAllBtn = this.element.querySelector('.btn-select-all');
        selectAllBtn?.addEventListener('click', () => this.selectAllSites());
        
        const deselectAllBtn = this.element.querySelector('.btn-deselect-all');
        deselectAllBtn?.addEventListener('click', () => this.deselectAllSites());
        
        // Connect 버튼
        const connectBtn = this.element.querySelector('#connect-btn');
        connectBtn?.addEventListener('click', () => this.connectToSelectedSite());
        
        // Refresh Database 버튼
        const refreshDbBtn = this.element.querySelector('.btn-refresh-db');
        refreshDbBtn?.addEventListener('click', () => this._refreshDatabaseInfo());
    }
    
    // ========================================
    // Site List Management
    // ========================================
    
    /**
     * Site List 렌더링
     */
    _renderSiteList() {
        const siteList = this.element?.querySelector('#site-list');
        if (!siteList) return;
        
        siteList.innerHTML = this.siteList.map(site => {
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
                this.toggleSiteSelection(siteId);
            });
        });
        
        // Checkbox 클릭 이벤트
        siteList.querySelectorAll('[data-site-checkbox]').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = checkbox.dataset.siteCheckbox;
                this.toggleSiteSelection(siteId);
            });
        });
        
        // Disconnect 버튼 이벤트
        siteList.querySelectorAll('.btn-disconnect').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = btn.dataset.disconnect;
                this.disconnectFromSite(siteId);
            });
        });
        
        this._updateSelectionUI();
    }
    
    /**
     * Site 선택 토글
     */
    toggleSiteSelection(siteId) {
        this.selectedSite = this.selectedSite === siteId ? null : siteId;
        this._renderSiteList();
    }
    
    /**
     * 전체 선택 (첫 번째 사이트)
     */
    selectAllSites() {
        if (this.siteList.length > 0) {
            this.selectedSite = this.siteList[0].id;
        }
        this._renderSiteList();
        if (this.toast) {
            this.toast.info('Select All', 'First site selected (single selection mode)');
        }
    }
    
    /**
     * 전체 해제
     */
    deselectAllSites() {
        this.selectedSite = null;
        this._renderSiteList();
        if (this.toast) {
            this.toast.info('Deselect All', 'Selection cleared');
        }
    }
    
    /**
     * Selection UI 업데이트
     */
    _updateSelectionUI() {
        const selectionCount = this.element?.querySelector('#selection-count');
        const connectBtn = this.element?.querySelector('#connect-btn');
        
        if (selectionCount) {
            selectionCount.textContent = `Selected: ${this.selectedSite ? 1 : 0}`;
        }
        if (connectBtn) {
            connectBtn.disabled = !this.selectedSite;
        }
    }
    
    // ========================================
    // Status Check
    // ========================================
    
    /**
     * Internet 상태 체크
     */
    checkInternetStatus() {
        const dot = this.element?.querySelector('#internet-dot');
        const text = this.element?.querySelector('#internet-text');
        const detail = this.element?.querySelector('#internet-detail');
        
        // 시뮬레이션 (실제 구현 시 navigator.onLine 또는 fetch 사용)
        const ping = Math.floor(Math.random() * 50 + 10);
        
        if (dot) dot.className = 'status-dot connected';
        if (text) text.textContent = 'Internet Connected';
        if (detail) detail.textContent = `Ping: ${ping}ms`;
    }
    
    /**
     * API 상태 체크
     */
    refreshAPIStatus() {
        const dot = this.element?.querySelector('#api-status-dot');
        const text = this.element?.querySelector('#api-status-text');
        const responseTime = this.element?.querySelector('#response-time');
        
        if (dot) dot.className = 'status-dot status-dot--checking';
        if (text) text.textContent = 'Checking...';
        if (responseTime) responseTime.textContent = '-';
        
        setTimeout(() => {
            // ConnectionStatusService 또는 Dev Mode 체크
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
    
    // ========================================
    // Connection Management
    // ========================================
    
    /**
     * 선택된 사이트에 연결
     */
    async connectToSelectedSite() {
        if (!this.selectedSite) return;
        
        const connectBtn = this.element?.querySelector('#connect-btn');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = '⏳ Connecting...';
        }
        
        if (this.toast) {
            this.toast.info('Connecting', `Connecting to ${this.selectedSite}...`);
        }
        
        try {
            // 시뮬레이션 (실제 구현 시 API 호출)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 연결 성공
            this.siteStatus[this.selectedSite] = { status: 'connected' };
            
            this._renderSiteList();
            this._updateDatabaseList(this.selectedSite);
            
            if (connectBtn) {
                connectBtn.textContent = '🔌 Connect';
            }
            
            const site = getSiteById(this.selectedSite);
            if (this.toast) {
                this.toast.success('Connected', `Successfully connected to ${site?.name || this.selectedSite}`);
            }
            
            // EventBus 이벤트 발생
            if (this.eventBus) {
                this.eventBus.emit('site:connected', { 
                    siteId: this.selectedSite, 
                    siteName: site?.name || this.selectedSite 
                });
            }
            
            // 연결 콜백 호출
            this.onConnect(this.selectedSite, site?.name || this.selectedSite);
            
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
     * 사이트 연결 해제
     */
    disconnectFromSite(siteId) {
        this.siteStatus[siteId] = { status: 'disconnected' };
        this.selectedSite = null;
        
        this._renderSiteList();
        this._updateDatabaseList(null);
        
        if (this.toast) {
            this.toast.info('Disconnected', 'Database connection closed');
        }
        
        // EventBus 이벤트 발생
        if (this.eventBus) {
            this.eventBus.emit('site:disconnected', { siteId });
        }
        
        // 연결 해제 콜백 호출
        this.onDisconnect(siteId);
    }
    
    // ========================================
    // Database List
    // ========================================
    
    /**
     * Database 목록 업데이트
     */
    _updateDatabaseList(siteId) {
        const dbList = this.element?.querySelector('#database-list');
        if (!dbList) return;
        
        if (siteId) {
            const site = getSiteById(siteId);
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
    
    /**
     * Database 정보 새로고침
     */
    _refreshDatabaseInfo() {
        if (this.toast) {
            this.toast.success('Refreshed', 'Database information updated');
        }
    }
    
    // ========================================
    // Modal Control (Public API)
    // ========================================
    
    /**
     * Modal 열기
     */
    open() {
        if (this.element) {
            this.element.classList.add('active');
            this.isOpen = true;
            
            // 상태 체크
            this.checkInternetStatus();
            this.refreshAPIStatus();
            
            if (this.eventBus) {
                this.eventBus.emit('connectionModal:opened');
            }
        }
    }
    
    /**
     * Modal 닫기
     */
    close() {
        if (this.element) {
            this.element.classList.remove('active');
            this.isOpen = false;
            
            if (this.eventBus) {
                this.eventBus.emit('connectionModal:closed');
            }
        }
    }
    
    /**
     * Modal 토글
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    // ========================================
    // External State Sync
    // ========================================
    
    /**
     * 외부에서 사이트 상태 설정
     */
    setSiteStatus(siteId, status) {
        this.siteStatus[siteId] = { status };
        this._renderSiteList();
    }
    
    /**
     * 외부에서 선택된 사이트 설정
     */
    setSelectedSite(siteId) {
        this.selectedSite = siteId;
        this._renderSiteList();
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        this.selectedSite = null;
        this.siteStatus = {};
        
        console.log('[ConnectionModalManager] 정리 완료');
    }
}

export default ConnectionModalManager;