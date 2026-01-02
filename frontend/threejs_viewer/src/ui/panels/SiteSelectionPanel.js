/**
 * Site Selection Panel
 * 사이트 선택 및 연결 관리
 */

import { connectionStore } from '../../services/ConnectionStore.js';

export class SiteSelectionPanel {
    constructor(container, connectionService, toast) {
        this.container = container;
        this.connectionService = connectionService;
        this.toast = toast;
        this.profiles = [];
        this.selectedSites = [];
        this.siteStatus = {};
        this.isConnecting = false;
        this.render();
    }

    /**
     * 패널 렌더링
     */
    render() {
        this.container.innerHTML = `
            <div class="connection-panel site-selection-panel">
                <div class="panel-header">
                    <h3>📍 Site Connection</h3>
                    <div class="panel-actions">
                        <label class="auto-connect-label">
                            <input type="checkbox" id="auto-connect-checkbox" ${connectionStore.getState().autoConnect ? 'checked' : ''}>
                            <span>Auto Connect</span>
                        </label>
                        <button class="btn-icon" id="select-all-btn" title="Select All">☑️</button>
                        <button class="btn-icon" id="deselect-all-btn" title="Deselect All">☐</button>
                    </div>
                </div>
                <div class="site-list" id="site-list">
                    <div class="loading-spinner">Loading sites...</div>
                </div>
                <div class="panel-footer">
                    <div class="selection-info">
                        <span id="selection-count">Selected: 0</span>
                    </div>
                    <button class="btn-primary" id="connect-btn" disabled>
                        🔌 Connect
                    </button>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        // 전체 선택
        const selectAllBtn = this.container.querySelector('#select-all-btn');
        selectAllBtn.addEventListener('click', () => this.selectAll());

        // 전체 해제
        const deselectAllBtn = this.container.querySelector('#deselect-all-btn');
        deselectAllBtn.addEventListener('click', () => this.deselectAll());

        // 연결 버튼
        const connectBtn = this.container.querySelector('#connect-btn');
        connectBtn.addEventListener('click', () => this.connectSelected());

        // 자동 연결 체크박스
        const autoConnectCheckbox = this.container.querySelector('#auto-connect-checkbox');
        autoConnectCheckbox.addEventListener('change', (e) => {
            connectionStore.setAutoConnect(e.target.checked);
            if (e.target.checked) {
                this.toast.info('Auto-connect enabled');
            }
        });
    }

    /**
     * 프로필 로드
     */
    async loadProfiles() {
        try {
            this.profiles = await this.connectionService.getProfiles();
            await this.loadStatus();
            this.renderSites();
            
            // 마지막 연결 사이트 자동 선택
            const lastConnected = connectionStore.getState().lastConnectedSites;
            if (lastConnected.length > 0) {
                this.selectedSites = [lastConnected[0]]; // Single site만
                this.updateSelectionUI();
            }
        } catch (error) {
            console.error('Failed to load profiles:', error);
            this.toast.error('Failed to load site profiles');
        }
    }

    /**
     * 상태 로드
     */
    async loadStatus() {
        try {
            const statusList = await this.connectionService.getStatus();
            this.siteStatus = {};
            statusList.forEach(status => {
                this.siteStatus[status.site_id] = status;
            });
        } catch (error) {
            console.error('Failed to load status:', error);
        }
    }

    /**
     * 사이트 목록 렌더링
     */
    renderSites() {
        const siteList = this.container.querySelector('#site-list');
        
        if (this.profiles.length === 0) {
            siteList.innerHTML = '<div class="no-sites">No sites available</div>';
            return;
        }

        // 우선순위 순으로 정렬
        const sortedProfiles = [...this.profiles].sort((a, b) => b.priority - a.priority);

        siteList.innerHTML = sortedProfiles.map(profile => {
            const status = this.siteStatus[profile.id] || {};
            const isConnected = status.status === 'connected';
            const isConnecting = status.status === 'connecting';
            const isFailed = status.status === 'failed';
            const isSelected = this.selectedSites.includes(profile.id);

            return `
                <div class="site-item ${isSelected ? 'selected' : ''} ${isConnected ? 'connected' : ''}" data-site-id="${profile.id}">
                    <div class="site-checkbox">
                        <input type="checkbox" 
                               id="site-${profile.id}" 
                               ${isSelected ? 'checked' : ''}
                               ${isConnecting ? 'disabled' : ''}>
                    </div>
                    <div class="site-info">
                        <div class="site-main">
                            <span class="site-name">${profile.display_name}</span>
                            <span class="site-region">${profile.region}</span>
                        </div>
                        <div class="site-meta">
                            ${status.last_connected ? `
                                <span class="last-connected">Last: ${new Date(status.last_connected).toLocaleString()}</span>
                            ` : ''}
                            ${status.response_time_ms ? `
                                <span class="response-time">${status.response_time_ms}ms</span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="site-status">
                        ${isConnecting ? `
                            <div class="loading-spinner-small"></div>
                        ` : isConnected ? `
                            <span class="status-icon">✅</span>
                            <button class="btn-disconnect" data-site-id="${profile.id}">Disconnect</button>
                        ` : isFailed ? `
                            <span class="status-icon">❌</span>
                            <button class="btn-retry" data-site-id="${profile.id}">Retry</button>
                        ` : `
                            <span class="status-icon">⚪</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        // 체크박스 이벤트 등록
        siteList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const siteId = e.target.id.replace('site-', '');
                this.toggleSite(siteId);
            });
        });

        // 연결 해제 버튼 이벤트
        siteList.querySelectorAll('.btn-disconnect').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = btn.dataset.siteId;
                this.disconnectSite(siteId);
            });
        });

        // 재시도 버튼 이벤트
        siteList.querySelectorAll('.btn-retry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = btn.dataset.siteId;
                this.retrySite(siteId);
            });
        });
    }

    /**
     * 사이트 선택 토글
     */
    toggleSite(siteId) {
        // Single site만 허용
        if (this.selectedSites.includes(siteId)) {
            this.selectedSites = [];
        } else {
            this.selectedSites = [siteId];
            // 다른 체크박스 해제
            this.container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.id !== `site-${siteId}`) {
                    cb.checked = false;
                }
            });
        }
        
        connectionStore.setSelectedSites(this.selectedSites);
        this.updateSelectionUI();
    }

    /**
     * 전체 선택
     */
    selectAll() {
        // Single site만 허용하므로 첫 번째만 선택
        if (this.profiles.length > 0) {
            this.toast.info('Only single site connection is supported');
            this.selectedSites = [this.profiles[0].id];
            this.updateSelectionUI();
            this.renderSites();
        }
    }

    /**
     * 전체 해제
     */
    deselectAll() {
        this.selectedSites = [];
        connectionStore.setSelectedSites(this.selectedSites);
        this.updateSelectionUI();
        this.renderSites();
    }

    /**
     * 선택 UI 업데이트
     */
    updateSelectionUI() {
        const countEl = this.container.querySelector('#selection-count');
        const connectBtn = this.container.querySelector('#connect-btn');
        
        countEl.textContent = `Selected: ${this.selectedSites.length}`;
        connectBtn.disabled = this.selectedSites.length === 0 || this.isConnecting;
    }

    /**
     * 선택된 사이트 연결
     */
    async connectSelected() {
        if (this.selectedSites.length === 0 || this.isConnecting) return;

        this.isConnecting = true;
        const connectBtn = this.container.querySelector('#connect-btn');
        connectBtn.disabled = true;
        connectBtn.textContent = '⏳ Connecting...';

        const siteId = this.selectedSites[0];

        try {
            // 상태 업데이트: connecting
            this.siteStatus[siteId] = { ...this.siteStatus[siteId], status: 'connecting' };
            this.renderSites();

            // 연결 시도
            const result = await this.connectionService.connectToSite(siteId, 30);

            if (result.success) {
                // 성공
                this.toast.success(`Connected to ${siteId.replace('_', ' ')}`);
                await this.loadStatus();
                this.renderSites();
                
                // 이벤트 발생 (DatabaseListPanel 업데이트용)
                this.container.dispatchEvent(new CustomEvent('site-connected', {
                    detail: { siteId }
                }));
            } else {
                // 실패
                this.toast.error(`Failed to connect to ${siteId}`);
                await this.loadStatus();
                this.renderSites();
            }
        } catch (error) {
            console.error('Connection error:', error);
            this.toast.error(`Error: ${error.message}`);
            this.siteStatus[siteId] = { ...this.siteStatus[siteId], status: 'failed' };
            this.renderSites();
        } finally {
            this.isConnecting = false;
            connectBtn.disabled = false;
            connectBtn.textContent = '🔌 Connect';
        }
    }

    /**
     * 사이트 연결 해제
     */
    async disconnectSite(siteId) {
        try {
            await this.connectionService.disconnectFromSite(siteId);
            this.toast.success(`Disconnected from ${siteId.replace('_', ' ')}`);
            connectionStore.removeConnectedSite(siteId);
            await this.loadStatus();
            this.renderSites();
            
            // 이벤트 발생
            this.container.dispatchEvent(new CustomEvent('site-disconnected', {
                detail: { siteId }
            }));
        } catch (error) {
            this.toast.error(`Failed to disconnect: ${error.message}`);
        }
    }

    /**
     * 재시도
     */
    async retrySite(siteId) {
        this.selectedSites = [siteId];
        this.updateSelectionUI();
        this.renderSites();
        await this.connectSelected();
    }
}