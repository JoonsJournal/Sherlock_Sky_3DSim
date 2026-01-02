/**
 * SiteSelectionPanel.js
 * 사이트 선택 및 연결 관리 패널
 * 
 * @version 2.0.0
 * @description BasePanel 상속 적용
 */

import { BasePanel } from '../core/base/BasePanel.js';
import { connectionStore } from '../stores/ConnectionStore.js';
import { toast } from './common/Toast.js';

/**
 * SiteSelectionPanel
 * 사이트 연결 관리 패널
 */
export class SiteSelectionPanel extends BasePanel {
    /**
     * @param {Object} options
     * @param {Object} options.connectionService - 연결 서비스
     */
    constructor(options = {}) {
        super({
            ...options,
            title: '🔍 Site Connection',
            collapsible: false,
            className: 'connection-panel site-selection-panel'
        });
        
        this.connectionService = options.connectionService;
        this.profiles = [];
        this.selectedSites = [];
        this.siteStatus = {};
        this.isConnecting = false;
    }
    
    /**
     * 헤더 렌더링 오버라이드
     */
    renderHeader() {
        const autoConnect = connectionStore.getState().autoConnect;
        
        return `
            <div class="panel-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border-bottom: 1px solid #333;
            ">
                <h3 style="margin: 0; font-size: 14px; color: #fff;">🔍 Site Connection</h3>
                <div class="panel-actions" style="display: flex; align-items: center; gap: 12px;">
                    <label class="auto-connect-label" style="
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 12px;
                        color: #888;
                        cursor: pointer;
                    ">
                        <input type="checkbox" id="auto-connect-checkbox" ${autoConnect ? 'checked' : ''}>
                        <span>Auto Connect</span>
                    </label>
                    <button class="btn-icon" id="select-all-btn" title="Select All" style="
                        background: transparent;
                        border: none;
                        color: #888;
                        cursor: pointer;
                        padding: 4px;
                    ">☑️</button>
                    <button class="btn-icon" id="deselect-all-btn" title="Deselect All" style="
                        background: transparent;
                        border: none;
                        color: #888;
                        cursor: pointer;
                        padding: 4px;
                    ">☐</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 패널 내용 렌더링
     */
    renderContent() {
        return `
            <div class="site-list" id="site-list" style="
                max-height: 300px;
                overflow-y: auto;
                padding: 8px;
            ">
                <div class="loading-spinner" style="padding: 20px; text-align: center; color: #888;">
                    Loading sites...
                </div>
            </div>
            <div class="panel-footer" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border-top: 1px solid #333;
            ">
                <div class="selection-info">
                    <span id="selection-count" style="font-size: 12px; color: #888;">Selected: 0</span>
                </div>
                <button class="btn-primary" id="connect-btn" disabled style="
                    padding: 8px 16px;
                    background: #2196F3;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    opacity: 0.5;
                ">
                    🔌 Connect
                </button>
            </div>
        `;
    }
    
    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        // 전체 선택
        const selectAllBtn = this.$('#select-all-btn');
        if (selectAllBtn) {
            this.addDomListener(selectAllBtn, 'click', () => this._selectAll());
        }

        // 전체 해제
        const deselectAllBtn = this.$('#deselect-all-btn');
        if (deselectAllBtn) {
            this.addDomListener(deselectAllBtn, 'click', () => this._deselectAll());
        }

        // 연결 버튼
        const connectBtn = this.$('#connect-btn');
        if (connectBtn) {
            this.addDomListener(connectBtn, 'click', () => this._connectSelected());
        }

        // 자동 연결 체크박스
        const autoConnectCheckbox = this.$('#auto-connect-checkbox');
        if (autoConnectCheckbox) {
            this.addDomListener(autoConnectCheckbox, 'change', (e) => {
                connectionStore.setAutoConnect(e.target.checked);
                if (e.target.checked) {
                    toast.info('Auto-connect enabled');
                }
            });
        }
    }
    
    /**
     * 프로필 로드
     */
    async loadProfiles() {
        try {
            this.profiles = await this.connectionService.getProfiles();
            await this._loadStatus();
            this._renderSites();
            
            // 마지막 연결 사이트 자동 선택
            const lastConnected = connectionStore.getState().lastConnectedSites;
            if (lastConnected.length > 0) {
                this.selectedSites = [lastConnected[0]];
                this._updateSelectionUI();
            }
        } catch (error) {
            console.error('Failed to load profiles:', error);
            toast.error('Failed to load site profiles');
        }
    }
    
    /**
     * 상태 로드
     */
    async _loadStatus() {
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
    _renderSites() {
        const siteList = this.$('#site-list');
        if (!siteList) return;
        
        if (this.profiles.length === 0) {
            siteList.innerHTML = '<div class="no-sites" style="padding: 20px; text-align: center; color: #888;">No sites available</div>';
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
                <div class="site-item ${isSelected ? 'selected' : ''} ${isConnected ? 'connected' : ''}" 
                     data-site-id="${profile.id}"
                     style="
                         display: flex;
                         align-items: center;
                         gap: 12px;
                         padding: 10px 12px;
                         margin-bottom: 6px;
                         background: ${isSelected ? '#2a3a4a' : '#1a1a1a'};
                         border: 1px solid ${isConnected ? '#4CAF50' : isSelected ? '#2196F3' : '#333'};
                         border-radius: 4px;
                         cursor: pointer;
                     ">
                    <div class="site-checkbox">
                        <input type="checkbox" 
                               id="site-${profile.id}" 
                               ${isSelected ? 'checked' : ''}
                               ${isConnecting ? 'disabled' : ''}
                               style="cursor: pointer;">
                    </div>
                    <div class="site-info" style="flex: 1;">
                        <div class="site-main" style="display: flex; align-items: center; gap: 8px;">
                            <span class="site-name" style="color: #fff; font-weight: 500;">${profile.display_name}</span>
                            <span class="site-region" style="color: #888; font-size: 12px;">${profile.region}</span>
                        </div>
                        <div class="site-meta" style="font-size: 11px; color: #666; margin-top: 4px;">
                            ${status.last_connected ? `
                                <span class="last-connected">Last: ${new Date(status.last_connected).toLocaleString()}</span>
                            ` : ''}
                            ${status.response_time_ms ? `
                                <span class="response-time" style="margin-left: 8px;">${status.response_time_ms}ms</span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="site-status" style="display: flex; align-items: center; gap: 8px;">
                        ${isConnecting ? `
                            <div class="loading-spinner-small" style="
                                width: 16px;
                                height: 16px;
                                border: 2px solid #333;
                                border-top: 2px solid #2196F3;
                                border-radius: 50%;
                                animation: spin 1s linear infinite;
                            "></div>
                        ` : isConnected ? `
                            <span class="status-icon">✅</span>
                            <button class="btn-disconnect" data-site-id="${profile.id}" style="
                                padding: 4px 8px;
                                background: #f44336;
                                color: #fff;
                                border: none;
                                border-radius: 4px;
                                font-size: 11px;
                                cursor: pointer;
                            ">Disconnect</button>
                        ` : isFailed ? `
                            <span class="status-icon">❌</span>
                            <button class="btn-retry" data-site-id="${profile.id}" style="
                                padding: 4px 8px;
                                background: #FFC107;
                                color: #000;
                                border: none;
                                border-radius: 4px;
                                font-size: 11px;
                                cursor: pointer;
                            ">Retry</button>
                        ` : `
                            <span class="status-icon" style="color: #888;">⚪</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        // 체크박스 이벤트 등록
        siteList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const siteId = e.target.id.replace('site-', '');
                this._toggleSite(siteId);
            });
        });

        // 연결 해제 버튼 이벤트
        siteList.querySelectorAll('.btn-disconnect').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = btn.dataset.siteId;
                this._disconnectSite(siteId);
            });
        });

        // 재시도 버튼 이벤트
        siteList.querySelectorAll('.btn-retry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = btn.dataset.siteId;
                this._retrySite(siteId);
            });
        });
    }
    
    /**
     * 사이트 선택 토글
     */
    _toggleSite(siteId) {
        // Single site만 허용
        if (this.selectedSites.includes(siteId)) {
            this.selectedSites = [];
        } else {
            this.selectedSites = [siteId];
            // 다른 체크박스 해제
            this.element?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.id !== `site-${siteId}`) {
                    cb.checked = false;
                }
            });
        }
        
        connectionStore.setSelectedSites(this.selectedSites);
        this._updateSelectionUI();
    }
    
    /**
     * 전체 선택
     */
    _selectAll() {
        // Single site만 허용하므로 첫 번째만 선택
        if (this.profiles.length > 0) {
            toast.info('Only single site connection is supported');
            this.selectedSites = [this.profiles[0].id];
            this._updateSelectionUI();
            this._renderSites();
        }
    }
    
    /**
     * 전체 해제
     */
    _deselectAll() {
        this.selectedSites = [];
        connectionStore.setSelectedSites(this.selectedSites);
        this._updateSelectionUI();
        this._renderSites();
    }
    
    /**
     * 선택 UI 업데이트
     */
    _updateSelectionUI() {
        const countEl = this.$('#selection-count');
        const connectBtn = this.$('#connect-btn');
        
        if (countEl) {
            countEl.textContent = `Selected: ${this.selectedSites.length}`;
        }
        
        if (connectBtn) {
            const isDisabled = this.selectedSites.length === 0 || this.isConnecting;
            connectBtn.disabled = isDisabled;
            connectBtn.style.opacity = isDisabled ? '0.5' : '1';
            connectBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
        }
    }
    
    /**
     * 선택된 사이트 연결
     */
    async _connectSelected() {
        if (this.selectedSites.length === 0 || this.isConnecting) return;

        this.isConnecting = true;
        const connectBtn = this.$('#connect-btn');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = '⏳ Connecting...';
        }

        const siteId = this.selectedSites[0];

        try {
            // 상태 업데이트: connecting
            this.siteStatus[siteId] = { ...this.siteStatus[siteId], status: 'connecting' };
            this._renderSites();

            // 연결 시도
            const result = await this.connectionService.connectToSite(siteId, 30);

            if (result.success) {
                toast.success(`Connected to ${siteId.replace('_', ' ')}`);
                await this._loadStatus();
                this._renderSites();
                
                // 이벤트 발생 (DatabaseListPanel 업데이트용)
                this.container?.dispatchEvent(new CustomEvent('site-connected', {
                    detail: { siteId }
                }));
            } else {
                toast.error(`Failed to connect to ${siteId}`);
                await this._loadStatus();
                this._renderSites();
            }
        } catch (error) {
            console.error('Connection error:', error);
            toast.error(`Error: ${error.message}`);
            this.siteStatus[siteId] = { ...this.siteStatus[siteId], status: 'failed' };
            this._renderSites();
        } finally {
            this.isConnecting = false;
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.textContent = '🔌 Connect';
            }
        }
    }
    
    /**
     * 사이트 연결 해제
     */
    async _disconnectSite(siteId) {
        try {
            await this.connectionService.disconnectFromSite(siteId);
            toast.success(`Disconnected from ${siteId.replace('_', ' ')}`);
            connectionStore.removeConnectedSite(siteId);
            await this._loadStatus();
            this._renderSites();
            
            // 이벤트 발생
            this.container?.dispatchEvent(new CustomEvent('site-disconnected', {
                detail: { siteId }
            }));
        } catch (error) {
            toast.error(`Failed to disconnect: ${error.message}`);
        }
    }
    
    /**
     * 재시도
     */
    async _retrySite(siteId) {
        this.selectedSites = [siteId];
        this._updateSelectionUI();
        this._renderSites();
        await this._connectSelected();
    }
}

export default SiteSelectionPanel;