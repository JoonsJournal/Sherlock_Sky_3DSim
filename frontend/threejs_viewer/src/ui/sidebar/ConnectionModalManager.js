/**
 * ConnectionModalManager.js
 * =========================
 * Sidebar에서 분리된 Connection Modal 관리 클래스
 * 
 * @version 2.1.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * @source Sidebar.js v1.3.0 (Connection Modal 섹션)
 * 
 * @description
 * Sidebar.js 리팩토링 Phase 3
 * - Connection Modal 생성 및 관리
 * - Site 연결/해제 기능 (실제 API 호출)
 * - Internet/API 상태 체크 (실제 API 호출)
 * - Database 정보 표시 (실제 API 호출)
 * - 🆕 Mock 모드 지원 (Dev Mode에서 Backend 없이 테스트)
 * 
 * @changelog
 * - v2.1.0: 🆕 Mock 모드 지원 추가 (2026-01-11)
 *           - enableMockMode() / disableMockMode() API 추가
 *           - Dev Mode에서 Backend 없이 모든 기능 테스트 가능
 *           - 일반 모드는 실제 API 호출 유지 (영향 없음)
 * - v2.0.0: 🐛 실제 API 연동 구현
 *           - ConnectionService import 및 실제 API 호출
 * - v1.0.0: 초기 버전 (시뮬레이션만)
 * 
 * @usage
 * import { ConnectionModalManager } from './ConnectionModalManager.js';
 * 
 * const modal = new ConnectionModalManager({
 *     toast: toastInstance,
 *     eventBus: eventBusInstance,
 *     connectionStatusService: connectionStatusService,
 *     apiBaseUrl: 'http://localhost:8000',
 *     onConnect: (siteId, siteName) => { ... },
 *     onDisconnect: () => { ... }
 * });
 * 
 * // Dev Mode 활성화 시 (Sidebar.toggleDevMode()에서 호출)
 * modal.enableMockMode();
 * 
 * // Dev Mode 비활성화 시
 * modal.disableMockMode();
 * 
 * 위치: frontend/threejs_viewer/src/ui/sidebar/ConnectionModalManager.js
 */

import { SITE_LIST, getSiteById } from './SidebarConfig.js';
// 🆕 v2.0.0: ConnectionService import (실제 API 호출용)
import { ConnectionService } from '../../services/ConnectionService.js';

// ============================================
// 🆕 v2.1.0: Mock 데이터 상수
// ============================================

/**
 * Mock Health Check 응답
 */
const MOCK_HEALTH_RESPONSE = {
    status: 'healthy',
    api_url: 'http://localhost:8000 (Mock)',
    response_time_ms: 25,
    version: '1.0.0-mock',
    server: 'mock-server',
    websocket_enabled: true
};

/**
 * Mock Database 정보
 */
const MOCK_DB_INFO = {
    kr_b_01: {
        site_id: 'kr_b_01',
        site_name: 'Korea Site B-01',
        db_name: 'SHERLOCK_PROD_KR_01',
        db_type: 'MSSQL',
        total_tables: 45,
        tables: [
            'TB_EQUIPMENT_MASTER',
            'TB_EQUIPMENT_STATUS',
            'TB_LOT_HISTORY',
            'TB_ALARM_LOG',
            'TB_PRODUCTION_DATA',
            'TB_RECIPE_INFO',
            'TB_USER_AUTH',
            'TB_SYSTEM_CONFIG'
        ]
    },
    kr_b_02: {
        site_id: 'kr_b_02',
        site_name: 'Korea Site B-02',
        db_name: 'SHERLOCK_PROD_KR_02',
        db_type: 'MSSQL',
        total_tables: 42,
        tables: [
            'TB_EQUIPMENT_MASTER',
            'TB_EQUIPMENT_STATUS',
            'TB_LOT_HISTORY',
            'TB_ALARM_LOG',
            'TB_PRODUCTION_DATA'
        ]
    },
    vn_a_01: {
        site_id: 'vn_a_01',
        site_name: 'Vietnam Site A-01',
        db_name: 'SHERLOCK_PROD_VN_01',
        db_type: 'PostgreSQL',
        total_tables: 38,
        tables: [
            'equipment_master',
            'equipment_status',
            'lot_history',
            'alarm_log',
            'production_data'
        ]
    }
};

// ============================================
// ConnectionModalManager Class
// ============================================

export class ConnectionModalManager {
    /**
     * @param {Object} options
     * @param {Object} options.toast - Toast 인스턴스
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
     * @param {string} options.apiBaseUrl - API 기본 URL (기본: http://localhost:8000)
     * @param {Array} options.siteList - 사이트 목록 (기본: SITE_LIST)
     * @param {Function} options.onConnect - 연결 성공 콜백 (siteId, siteName)
     * @param {Function} options.onDisconnect - 연결 해제 콜백
     * @param {Function} options.getDevModeEnabled - Dev Mode 상태 getter
     */
    constructor(options = {}) {
        // 의존성
        this.toast = options.toast || null;
        this.eventBus = options.eventBus || null;
        this.connectionStatusService = options.connectionStatusService || null;
		        
		// 🆕 v2.0.0: ConnectionService 생성 (실제 API 호출용)
		// ⭐ 동적 API URL: 접속한 호스트 기준
		const defaultApiUrl = `http://${window.location.hostname}:8000`;
		this.apiBaseUrl = options.apiBaseUrl || defaultApiUrl;
		this.connectionService = new ConnectionService(this.apiBaseUrl);
        
        // 사이트 목록 (Sidebar에서 전달받거나 기본값 사용)
        this.siteList = options.siteList ? [...options.siteList] : [...SITE_LIST];
        
        // 콜백
        this.onConnect = options.onConnect || (() => {});
        this.onDisconnect = options.onDisconnect || (() => {});
        
        // Dev Mode 상태 getter (Sidebar에서 전달)
        this._getDevModeEnabled = options.getDevModeEnabled || (() => false);
        
        // 상태
        this.isOpen = false;
        this.selectedSite = null;
        this.siteStatus = {};
        this.isLoading = false;
        
        // 사이트 상태 초기화
        this.siteList.forEach(site => {
            this.siteStatus[site.id] = { status: 'disconnected' };
        });
        
        // DOM 참조
        this.element = null;
        
        // Health Check 타이머
        this._healthCheckInterval = null;
        
        // ============================================
        // 🆕 v2.1.0: Mock 모드 설정
        // ============================================
        this._mockConfig = {
            // Mock 모드 활성화 여부
            enabled: false,
            
            // Mock 응답 지연 (밀리초) - 실제 네트워크 느낌
            responseDelay: 500,
            
            // Mock 연결 상태
            connectedSiteId: null,
            
            // Mock Health 응답
            healthResponse: MOCK_HEALTH_RESPONSE,
            
            // Mock DB 정보
            dbInfo: MOCK_DB_INFO,
            
            // Mock 실패 시뮬레이션 (테스트용)
            simulateFailure: false,
            failureProbability: 0
        };
        
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
     * Mock 모드 활성화 여부
     */
    get isMockMode() {
        return this._mockConfig.enabled;
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
    // 🆕 v2.1.0: Mock Mode Control (Public API)
    // ========================================
    
    /**
     * Mock 모드 활성화 (Dev Mode ON 시 호출)
     * @param {Object} options - Mock 설정 옵션
     * @returns {ConnectionModalManager} this (체이닝용)
     */
    enableMockMode(options = {}) {
        this._mockConfig = {
            ...this._mockConfig,
            ...options,
            enabled: true
        };
        
        console.log('[ConnectionModalManager] 🎭 Mock 모드 활성화');
        console.log('[ConnectionModalManager] Mock 설정:', this._mockConfig);
        
        // Mock Mode UI 업데이트
        this._updateMockModeUI();
        
        if (this.toast) {
            this.toast.info('Mock Mode', 'Connection Modal is now in Mock mode');
        }
        
        return this;
    }
    
    /**
     * Mock 모드 비활성화 (Dev Mode OFF 시 호출)
     * @returns {ConnectionModalManager} this (체이닝용)
     */
    disableMockMode() {
        // Mock 연결 상태 초기화
        if (this._mockConfig.connectedSiteId) {
            this.siteStatus[this._mockConfig.connectedSiteId] = { status: 'disconnected' };
        }
        
        this._mockConfig.enabled = false;
        this._mockConfig.connectedSiteId = null;
        
        console.log('[ConnectionModalManager] 🔌 Mock 모드 비활성화 - 실제 API 모드로 전환');
        
        // Mock Mode UI 업데이트
        this._updateMockModeUI();
        
        if (this.toast) {
            this.toast.info('Real Mode', 'Connection Modal switched to real API mode');
        }
        
        // UI 업데이트
        this._renderSiteList();
        this._clearDatabaseList();
        
        return this;
    }
    
    /**
     * Mock 설정 변경
     * @param {Object} config - 변경할 설정
     */
    configureMock(config) {
        this._mockConfig = { ...this._mockConfig, ...config };
        console.log('[ConnectionModalManager] Mock 설정 업데이트:', this._mockConfig);
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
                    <!-- 🆕 v2.1.0: Mock Mode Indicator -->
                    <div class="mock-mode-indicator" id="mock-mode-indicator" style="display:none;background:linear-gradient(135deg,#92400E,#B45309);padding:8px 12px;border-radius:8px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
                        <span class="mock-badge" style="font-weight:600;color:#FEF3C7;">🎭 MOCK MODE</span>
                        <span class="mock-hint" style="font-size:12px;color:#FDE68A;">Backend is not required</span>
                    </div>
                    
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
                                    <span class="detail-value" id="api-url-value">${this.apiBaseUrl}</span>
                                </div>
                                <div class="status-detail">
                                    <span class="detail-label">Response</span>
                                    <span class="detail-value" id="response-time">-</span>
                                </div>
                                <div class="status-detail" id="mock-status-row" style="display:none;">
                                    <span class="detail-label">Mode</span>
                                    <span class="detail-value" style="color: #FBBF24;">🎭 Mock</span>
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
                        <div class="site-list" id="site-list">
                            <div class="loading-indicator">Loading sites...</div>
                        </div>
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
        
        // 이벤트 설정
        this._setupEvents();
        
        console.log('[ConnectionModalManager] 생성 완료 (v2.1.0 - Mock 모드 지원)');
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
    // 🆕 v2.1.0: Mock Mode UI Updates
    // ========================================
    
    /**
     * Mock Mode UI 업데이트
     */
    _updateMockModeUI() {
        const indicator = this.element?.querySelector('#mock-mode-indicator');
        const mockStatusRow = this.element?.querySelector('#mock-status-row');
        const apiUrlValue = this.element?.querySelector('#api-url-value');
        
        if (this._mockConfig.enabled) {
            if (indicator) indicator.style.display = 'flex';
            if (mockStatusRow) mockStatusRow.style.display = 'flex';
            if (apiUrlValue) apiUrlValue.textContent = `${this.apiBaseUrl} (Mock)`;
        } else {
            if (indicator) indicator.style.display = 'none';
            if (mockStatusRow) mockStatusRow.style.display = 'none';
            if (apiUrlValue) apiUrlValue.textContent = this.apiBaseUrl;
        }
    }
    
    // ========================================
    // Site List Management
    // ========================================
    
    /**
     * 🆕 v2.1.0: 프로필(사이트) 목록 로드 (Mock/Real 분기)
     */
    async loadProfiles() {
        // ========== Mock 모드 ==========
        if (this._mockConfig.enabled) {
            console.log('[ConnectionModalManager] 🎭 Mock: 프로필 로드');
            
            await this._mockDelay();
            
            // SITE_LIST 사용 (이미 설정됨)
            this.siteList.forEach(site => {
                if (!this.siteStatus[site.id]) {
                    this.siteStatus[site.id] = { status: 'disconnected' };
                }
            });
            
            // Mock 연결 상태 복원
            if (this._mockConfig.connectedSiteId) {
                this.siteStatus[this._mockConfig.connectedSiteId] = { status: 'connected' };
            }
            
            this._renderSiteList();
            return;
        }
        
        // ========== 실제 API 호출 ==========
        try {
            const profiles = await this.connectionService.getProfiles();
            
            if (profiles && profiles.length > 0) {
                this.siteList = profiles.map(p => ({
                    id: p.site_id || p.id,
                    flag: this._getCountryFlag(p.site_id || p.id),
                    name: p.name || p.site_name || p.site_id,
                    region: p.region || p.timezone || 'Unknown',
                    priority: p.priority || 5
                }));
                
                this.siteList.forEach(site => {
                    if (!this.siteStatus[site.id]) {
                        this.siteStatus[site.id] = { status: 'disconnected' };
                    }
                });
                
                console.log(`[ConnectionModalManager] ${this.siteList.length}개 프로필 로드 완료`);
            }
        } catch (error) {
            console.error('[ConnectionModalManager] 프로필 로드 실패:', error);
        }
        
        await this._loadConnectionStatus();
        this._renderSiteList();
    }
    
    /**
     * 🆕 v2.1.0: 현재 연결 상태 로드 (Mock/Real 분기)
     */
    async _loadConnectionStatus() {
        // ========== Mock 모드 ==========
        if (this._mockConfig.enabled) {
            // Mock 상태는 이미 siteStatus에 반영됨
            return;
        }
        
        // ========== 실제 API 호출 ==========
        try {
            const statusList = await this.connectionService.getStatus();
            
            if (statusList && Array.isArray(statusList)) {
                statusList.forEach(status => {
                    const siteId = status.site_id;
                    if (siteId) {
                        this.siteStatus[siteId] = {
                            status: status.status === 'connected' ? 'connected' : 'disconnected',
                            details: status
                        };
                        
                        if (status.status === 'connected') {
                            this._updateDatabaseList(siteId);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('[ConnectionModalManager] 연결 상태 로드 실패:', error);
        }
    }
    
    /**
     * 국가 코드에서 국기 이모지 반환
     */
    _getCountryFlag(siteId) {
        if (!siteId) return '🏭';
        const id = siteId.toLowerCase();
        if (id.startsWith('kr')) return '🇰🇷';
        if (id.startsWith('vn')) return '🇻🇳';
        if (id.startsWith('us')) return '🇺🇸';
        if (id.startsWith('cn')) return '🇨🇳';
        if (id.startsWith('jp')) return '🇯🇵';
        return '🏭';
    }
    
    /**
     * Site List 렌더링
     */
    _renderSiteList() {
        const siteList = this.element?.querySelector('#site-list');
        if (!siteList) return;
        
        if (this.siteList.length === 0) {
            siteList.innerHTML = `
                <div class="no-connection">
                    <span class="no-connection-icon">🔍</span>
                    <p>No sites available</p>
                </div>
            `;
            return;
        }
        
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
                            ${this._mockConfig.enabled ? '<span style="color:#FBBF24;margin-left:8px;">🎭</span>' : ''}
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
            this.toast.info('First site selected (single selection mode)');
        }
    }
    
    /**
     * 전체 해제
     */
    deselectAllSites() {
        this.selectedSite = null;
        this._renderSiteList();
        if (this.toast) {
            this.toast.info('Selection cleared');
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
    // Status Check (🆕 v2.1.0: Mock/Real 분기)
    // ========================================
    
    /**
     * Internet 상태 체크
     */
    checkInternetStatus() {
        const dot = this.element?.querySelector('#internet-dot');
        const text = this.element?.querySelector('#internet-text');
        const detail = this.element?.querySelector('#internet-detail');
        
        const isOnline = navigator.onLine;
        
        if (dot) dot.className = `status-dot ${isOnline ? 'connected' : 'disconnected'}`;
        if (text) text.textContent = isOnline ? 'Internet Connected' : 'Internet Disconnected';
        
        // 실제 ping 측정 (Mock이 아닌 경우)
        if (isOnline && !this._mockConfig.enabled) {
            const startTime = Date.now();
            fetch(`${this.apiBaseUrl}/api/health`, { method: 'GET' })
                .then(() => {
                    const ping = Date.now() - startTime;
                    if (detail) detail.textContent = `Ping: ${ping}ms`;
                })
                .catch(() => {
                    if (detail) detail.textContent = 'Ping: --ms';
                });
        } else if (this._mockConfig.enabled) {
            // Mock 모드: 가상 ping
            const mockPing = Math.floor(Math.random() * 30 + 10);
            if (detail) detail.textContent = `Ping: ${mockPing}ms (Mock)`;
        } else {
            if (detail) detail.textContent = 'Ping: --ms';
        }
    }
    
    /**
     * 🆕 v2.1.0: API 상태 체크 (Mock/Real 분기)
     */
    async refreshAPIStatus() {
        const dot = this.element?.querySelector('#api-status-dot');
        const text = this.element?.querySelector('#api-status-text');
        const responseTime = this.element?.querySelector('#response-time');
        
        // 체킹 상태로 변경
        if (dot) dot.className = 'status-dot status-dot--checking';
        if (text) {
            text.textContent = 'Checking...';
            text.className = 'status-text';
        }
        if (responseTime) responseTime.textContent = '-';
        
        // ========== Mock 모드 ==========
        if (this._mockConfig.enabled) {
            console.log('[ConnectionModalManager] 🎭 Mock: API 상태 체크');
            
            await this._mockDelay();
            
            // Mock 실패 시뮬레이션 체크
            if (this._mockConfig.simulateFailure && 
                Math.random() < this._mockConfig.failureProbability) {
                this._showAPIStatusError(dot, text, responseTime);
                return;
            }
            
            // Mock 성공
            const mockResponse = this._mockConfig.healthResponse;
            
            if (dot) dot.className = 'status-dot status-dot--connected';
            if (text) {
                text.textContent = 'Connected (Mock)';
                text.className = 'status-text run';
            }
            if (responseTime) {
                responseTime.textContent = `${mockResponse.response_time_ms}ms`;
            }
            
            this._updateMockModeUI();
            
            if (this.toast) {
                this.toast.success('Mock Backend Online', 'API simulation is active');
            }
            
            // 프로필 로드
            await this.loadProfiles();
            return;
        }
        
        // ========== 실제 API 호출 ==========
        try {
            const startTime = Date.now();
            const healthData = await this.connectionService.checkHealth();
            const elapsed = Date.now() - startTime;
            
            const isHealthy = healthData.status === 'healthy' || healthData.status === 'ok';
            
            if (isHealthy) {
                if (dot) dot.className = 'status-dot status-dot--connected';
                if (text) {
                    text.textContent = 'Connected';
                    text.className = 'status-text run';
                }
                if (responseTime) {
                    responseTime.textContent = healthData.response_time_ms 
                        ? `${healthData.response_time_ms}ms` 
                        : `${elapsed}ms`;
                }
                
                if (this.toast) {
                    this.toast.success('Backend Online', 'API is available');
                }
                
                await this.loadProfiles();
            } else {
                throw new Error('API unhealthy');
            }
            
        } catch (error) {
            console.error('[ConnectionModalManager] API 상태 체크 실패:', error);
            this._showAPIStatusError(dot, text, responseTime);
        }
    }
    
    /**
     * API 상태 에러 표시
     */
    _showAPIStatusError(dot, text, responseTime) {
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
    
    // ========================================
    // Connection Management (🆕 v2.1.0: Mock/Real 분기)
    // ========================================
    
    /**
     * 🆕 v2.1.0: 선택된 사이트에 연결 (Mock/Real 분기)
     */
    async connectToSelectedSite() {
        if (!this.selectedSite) return;
        
        const connectBtn = this.element?.querySelector('#connect-btn');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = '⏳ Connecting...';
        }
        
        const site = getSiteById(this.selectedSite) || 
                     this.siteList.find(s => s.id === this.selectedSite);
        
        if (this.toast) {
            this.toast.info('Connecting', `Connecting to ${site?.name || this.selectedSite}...`);
        }
        
        // ========== Mock 모드 ==========
        if (this._mockConfig.enabled) {
            console.log('[ConnectionModalManager] 🎭 Mock: 사이트 연결', this.selectedSite);
            
            await this._mockDelay();
            
            // Mock 실패 시뮬레이션
            if (this._mockConfig.simulateFailure && 
                Math.random() < this._mockConfig.failureProbability) {
                this._handleConnectionError(connectBtn, new Error('Mock connection failed'));
                return;
            }
            
            // Mock 연결 성공
            this._mockConfig.connectedSiteId = this.selectedSite;
            this.siteStatus[this.selectedSite] = { 
                status: 'connected',
                details: { mock: true }
            };
            
            this._renderSiteList();
            await this._updateDatabaseList(this.selectedSite);
            
            if (connectBtn) {
                connectBtn.textContent = '🔌 Connect';
            }
            
            if (this.toast) {
                this.toast.success('Connected (Mock)', `Successfully connected to ${site?.name || this.selectedSite}`);
            }
            
            this._emitConnectionEvents(this.selectedSite, site?.name);
            this.onConnect(this.selectedSite, site?.name || this.selectedSite);
            return;
        }
        
        // ========== 실제 API 호출 ==========
        try {
            const result = await this.connectionService.connectToSite(this.selectedSite);
            
            console.log('[ConnectionModalManager] 연결 결과:', result);
            
            this.siteStatus[this.selectedSite] = { 
                status: 'connected',
                details: result
            };
            
            this._renderSiteList();
            await this._updateDatabaseList(this.selectedSite);
            
            if (connectBtn) {
                connectBtn.textContent = '🔌 Connect';
            }
            
            if (this.toast) {
                this.toast.success('Connected', `Successfully connected to ${site?.name || this.selectedSite}`);
            }
            
            this._emitConnectionEvents(this.selectedSite, site?.name);
            this.onConnect(this.selectedSite, site?.name || this.selectedSite);
            
        } catch (error) {
            this._handleConnectionError(connectBtn, error);
        }
    }
    
    /**
     * 연결 이벤트 발생
     */
    _emitConnectionEvents(siteId, siteName) {
        if (this.eventBus) {
            this.eventBus.emit('site:connected', { 
                siteId, 
                siteName: siteName || siteId,
                isMock: this._mockConfig.enabled
            });
            this.eventBus.emit('api:connected');
        }
    }
    
    /**
     * 연결 에러 처리
     */
    _handleConnectionError(connectBtn, error) {
        console.error('[ConnectionModalManager] 연결 실패:', error);
        
        if (connectBtn) {
            connectBtn.textContent = '🔌 Connect';
            connectBtn.disabled = false;
        }
        
        if (this.toast) {
            this.toast.error('Connection Failed', error.message || 'Failed to connect');
        }
    }
    
    /**
     * 🆕 v2.1.0: 사이트 연결 해제 (Mock/Real 분기)
     */
    async disconnectFromSite(siteId) {
        // ========== Mock 모드 ==========
        if (this._mockConfig.enabled) {
            console.log('[ConnectionModalManager] 🎭 Mock: 사이트 연결 해제', siteId);
            
            await this._mockDelay(300);
            
            this._mockConfig.connectedSiteId = null;
            this.siteStatus[siteId] = { status: 'disconnected' };
            
            if (this.selectedSite === siteId) {
                this.selectedSite = null;
            }
            
            this._renderSiteList();
            this._clearDatabaseList();
            
            if (this.toast) {
                this.toast.info('Disconnected (Mock)', 'Database connection closed');
            }
            
            this._emitDisconnectionEvents(siteId);
            this.onDisconnect(siteId);
            return;
        }
        
        // ========== 실제 API 호출 ==========
        try {
            await this.connectionService.disconnectFromSite(siteId);
            
            this.siteStatus[siteId] = { status: 'disconnected' };
            
            if (this.selectedSite === siteId) {
                this.selectedSite = null;
            }
            
            this._renderSiteList();
            this._clearDatabaseList();
            
            if (this.toast) {
                this.toast.info('Disconnected', 'Database connection closed');
            }
            
            this._emitDisconnectionEvents(siteId);
            this.onDisconnect(siteId);
            
        } catch (error) {
            console.error('[ConnectionModalManager] 연결 해제 실패:', error);
            
            if (this.toast) {
                this.toast.error('Disconnect Failed', error.message || 'Failed to disconnect');
            }
        }
    }
    
    /**
     * 연결 해제 이벤트 발생
     */
    _emitDisconnectionEvents(siteId) {
        if (this.eventBus) {
            this.eventBus.emit('site:disconnected', { 
                siteId,
                isMock: this._mockConfig.enabled
            });
            this.eventBus.emit('api:disconnected');
        }
    }
    
    // ========================================
    // Database List (🆕 v2.1.0: Mock/Real 분기)
    // ========================================
    
    /**
     * 🆕 v2.1.0: Database 목록 업데이트 (Mock/Real 분기)
     */
    async _updateDatabaseList(siteId) {
        const dbList = this.element?.querySelector('#database-list');
        if (!dbList) return;
        
        // 로딩 표시
        dbList.innerHTML = `
            <div class="loading-indicator">
                <span>📊 Loading database info...</span>
            </div>
        `;
        
        // ========== Mock 모드 ==========
        if (this._mockConfig.enabled) {
            console.log('[ConnectionModalManager] 🎭 Mock: DB 정보 로드', siteId);
            
            await this._mockDelay();
            
            const mockDbInfo = this._mockConfig.dbInfo[siteId] || {
                site_id: siteId,
                site_name: `Mock Site (${siteId})`,
                db_name: 'MOCK_DATABASE',
                db_type: 'Mock',
                total_tables: 10,
                tables: ['mock_table_1', 'mock_table_2', 'mock_table_3']
            };
            
            this._renderDatabaseInfo(dbList, siteId, mockDbInfo, true);
            return;
        }
        
        // ========== 실제 API 호출 ==========
        try {
            const dbInfo = await this.connectionService.getDatabaseInfo(siteId);
            this._renderDatabaseInfo(dbList, siteId, dbInfo, false);
        } catch (error) {
            console.error('[ConnectionModalManager] DB 정보 로드 실패:', error);
            
            const site = getSiteById(siteId) || 
                         this.siteList.find(s => s.id === siteId);
            
            dbList.innerHTML = `
                <div class="database-item">
                    <div class="database-header">
                        <h4>📊 ${site?.name || siteId}</h4>
                    </div>
                    <div class="database-error">
                        <span>⚠️ Failed to load database info</span>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Database 정보 렌더링
     */
    _renderDatabaseInfo(container, siteId, dbInfo, isMock) {
        const site = getSiteById(siteId) || 
                     this.siteList.find(s => s.id === siteId);
        
        container.innerHTML = `
            <div class="database-item">
                <div class="database-header">
                    <h4>📊 ${site?.name || dbInfo.site_name || siteId}</h4>
                    ${isMock ? '<span style="color:#FBBF24;font-size:12px;">🎭 Mock</span>' : ''}
                </div>
                <div class="database-stats">
                    <div class="stat-item">
                        <span class="stat-label">Database:</span>
                        <span class="stat-value">${dbInfo.db_name || 'Unknown'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Type:</span>
                        <span class="stat-value">${dbInfo.db_type || 'Unknown'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Tables:</span>
                        <span class="stat-value">${dbInfo.total_tables || dbInfo.tables?.length || 0}</span>
                    </div>
                </div>
                ${dbInfo.tables && dbInfo.tables.length > 0 ? `
                    <div class="database-tables">
                        <details>
                            <summary>View Tables (${dbInfo.tables.length})</summary>
                            <ul class="table-list" style="max-height:150px;overflow-y:auto;padding-left:20px;margin:8px 0;">
                                ${dbInfo.tables.slice(0, 15).map(t => `<li style="font-size:12px;color:var(--text-secondary);">${t}</li>`).join('')}
                                ${dbInfo.tables.length > 15 ? `<li style="font-size:12px;color:var(--text-muted);">... and ${dbInfo.tables.length - 15} more</li>` : ''}
                            </ul>
                        </details>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Database 목록 클리어
     */
    _clearDatabaseList() {
        const dbList = this.element?.querySelector('#database-list');
        if (!dbList) return;
        
        dbList.innerHTML = `
            <div class="no-connection">
                <span class="no-connection-icon">📂</span>
                <p>No database connected</p>
            </div>
        `;
    }
    
    /**
     * Database 정보 새로고침
     */
    async _refreshDatabaseInfo() {
        const connectedSite = Object.entries(this.siteStatus)
            .find(([_, status]) => status.status === 'connected');
        
        if (connectedSite) {
            await this._updateDatabaseList(connectedSite[0]);
            
            if (this.toast) {
                this.toast.success('Refreshed', 'Database information updated');
            }
        } else {
            if (this.toast) {
                this.toast.info('No Connection', 'Connect to a site first');
            }
        }
    }
    
    // ========================================
    // 🆕 v2.1.0: Mock Utility Methods
    // ========================================
    
    /**
     * Mock 응답 지연 (네트워크 시뮬레이션)
     */
    _mockDelay(ms = null) {
        const delay = ms || this._mockConfig.responseDelay;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // ========================================
    // Modal Control (Public API)
    // ========================================
    
    /**
     * Modal 열기
     */
    async open() {
        if (this.element) {
            this.element.classList.add('active');
            this.isOpen = true;
            
            // Mock Mode UI 업데이트
            this._updateMockModeUI();
            
            // 상태 체크
            this.checkInternetStatus();
            await this.refreshAPIStatus();
            
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
        // Health Check 타이머 정리
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
        }
        
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        this.selectedSite = null;
        this.siteStatus = {};
        this._mockConfig.enabled = false;
        this._mockConfig.connectedSiteId = null;
        
        console.log('[ConnectionModalManager] 정리 완료');
    }
}

export default ConnectionModalManager;