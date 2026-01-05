/**
 * DatabaseListPanel.js
 * 연결된 데이터베이스 테이블 목록 표시 패널
 * 
 * @version 2.1.0
 * @description BasePanel 상속 적용, 인라인 스타일 제거
 * @modified 2026-01-06 (Phase 5 - CSS 클래스 기반으로 전환)
 */

import { BasePanel } from '../core/base/BasePanel.js';
import { toast } from './common/Toast.js';

/**
 * DatabaseListPanel
 * 데이터베이스 테이블 목록 패널
 */
export class DatabaseListPanel extends BasePanel {
    /**
     * @param {Object} options
     * @param {Object} options.connectionService - 연결 서비스
     */
    constructor(options = {}) {
        super({
            ...options,
            title: '📊 Connected Databases',
            collapsible: false,
            className: 'connection-panel database-list-panel'
        });
        
        this.connectionService = options.connectionService;
        this.connectedSites = [];
        this.expandedTables = new Set();
    }
    
    /**
     * 헤더 렌더링 오버라이드
     */
    renderHeader() {
        return `
            <div class="panel-header">
                <h3>📊 Connected Databases</h3>
                <div class="panel-actions">
                    <button class="btn-icon" id="refresh-db-btn" title="Refresh">🔄</button>
                    <button class="btn-icon" id="export-status-btn" title="Export Status">📤</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 패널 내용 렌더링
     */
    renderContent() {
        return `
            <div class="database-list" id="database-list">
                <div class="no-connection">
                    <span class="no-connection-icon">📂</span>
                    <p>No database connected</p>
                    <small>Connect to a site to view tables</small>
                </div>
            </div>
        `;
    }
    
    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        const refreshBtn = this.$('#refresh-db-btn');
        if (refreshBtn) {
            this.addDomListener(refreshBtn, 'click', () => this.refresh());
        }

        const exportBtn = this.$('#export-status-btn');
        if (exportBtn) {
            this.addDomListener(exportBtn, 'click', () => this._exportStatus());
        }
    }
    
    /**
     * 데이터베이스 정보 로드
     * @param {string} siteId - 사이트 ID
     */
    async loadDatabaseInfo(siteId) {
        try {
            const dbInfo = await this.connectionService.getDatabaseInfo(siteId);
            this.connectedSites = [dbInfo];
            this._renderDatabases();
        } catch (error) {
            console.error('Failed to load database info:', error);
            toast.error('Failed to load database information');
        }
    }
    
    /**
     * 데이터베이스 목록 렌더링
     */
    _renderDatabases() {
        const dbList = this.$('#database-list');
        if (!dbList) return;

        if (this.connectedSites.length === 0) {
            dbList.innerHTML = `
                <div class="no-connection">
                    <span class="no-connection-icon">📂</span>
                    <p>No database connected</p>
                    <small>Connect to a site to view tables</small>
                </div>
            `;
            return;
        }

        dbList.innerHTML = this.connectedSites.map(dbInfo => {
            const displayName = `${dbInfo.site_name} - ${dbInfo.db_name}`;
            const totalTables = dbInfo.total_tables || dbInfo.tables?.length || 0;
            const dbType = dbInfo.db_type || 'unknown';
            
            return `
                <div class="database-item">
                    <div class="database-header">
                        <h4>🗄️ ${displayName}</h4>
                        <div class="database-stats">
                            <span class="stat-item">
                                <span class="stat-label">Tables:</span>
                                <span class="stat-value">${totalTables}</span>
                            </span>
                            <span class="stat-item">
                                <span class="stat-label">Type:</span>
                                <span class="stat-value">${dbType.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="connection-info">
                        <span class="info-label">Site ID:</span>
                        <span class="info-value">${dbInfo.site_id}</span>
                    </div>

                    <div class="table-list">
                        ${this._renderTables(dbInfo.tables || [], dbInfo.site_id)}
                    </div>
                </div>
            `;
        }).join('');

        // 테이블 클릭 이벤트 등록
        this._attachTableClickEvents();
    }
    
    /**
     * 테이블 목록 렌더링
     */
    _renderTables(tables, siteId) {
        if (!tables || tables.length === 0) {
            return '<div class="no-tables">No tables found</div>';
        }

        return tables.map(table => {
            const isExpanded = this.expandedTables.has(`${siteId}-${table.name}`);
            const expandedClass = isExpanded ? 'table-item--expanded' : '';
            
            return `
                <div class="table-item ${expandedClass}" 
                     data-site-id="${siteId}" 
                     data-table-name="${table.name}">
                    <div class="table-header">
                        <div class="table-info-main">
                            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                            <span class="table-name">${table.name}</span>
                            ${table.row_count !== null && table.row_count !== undefined ? `
                                <span class="table-rows">${this._formatNumber(table.row_count)} rows</span>
                            ` : ''}
                        </div>
                        <div class="table-actions">
                            ${table.size_mb !== null && table.size_mb !== undefined ? `
                                <span class="table-size">${table.size_mb.toFixed(2)} MB</span>
                            ` : ''}
                            ${table.schema ? `
                                <span class="table-schema">${table.schema}</span>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${isExpanded ? `
                        <div class="table-details">
                            <div class="table-detail-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Schema:</span>
                                    <span class="detail-value">${table.schema || 'N/A'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Type:</span>
                                    <span class="detail-value">${table.type || 'N/A'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Row Count:</span>
                                    <span class="detail-value">${table.row_count !== null && table.row_count !== undefined ? this._formatNumber(table.row_count) : 'N/A'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Size:</span>
                                    <span class="detail-value">${table.size_mb !== null && table.size_mb !== undefined ? `${table.size_mb.toFixed(2)} MB` : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    /**
     * 테이블 클릭 이벤트 등록
     */
    _attachTableClickEvents() {
        const tableItems = this.element?.querySelectorAll('.table-item');
        
        tableItems?.forEach(item => {
            const header = item.querySelector('.table-header');
            if (header) {
                header.addEventListener('click', () => {
                    const siteId = item.dataset.siteId;
                    const tableName = item.dataset.tableName;
                    this._toggleTable(siteId, tableName);
                });
            }
        });
    }
    
    /**
     * 테이블 확장/축소
     */
    _toggleTable(siteId, tableName) {
        const key = `${siteId}-${tableName}`;
        
        if (this.expandedTables.has(key)) {
            this.expandedTables.delete(key);
        } else {
            this.expandedTables.add(key);
        }
        
        this._renderDatabases();
    }
    
    /**
     * 숫자 포맷팅 (천단위 콤마)
     */
    _formatNumber(num) {
        if (num === null || num === undefined) return 'N/A';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    /**
     * 새로고침
     */
    async refresh() {
        if (this.connectedSites.length === 0) {
            toast.info('No connected database to refresh');
            return;
        }

        const refreshBtn = this.$('#refresh-db-btn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳';
        }

        try {
            const siteId = this.connectedSites[0].site_id;
            await this.loadDatabaseInfo(siteId);
            toast.success('Database information refreshed');
        } catch (error) {
            toast.error('Failed to refresh database info');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄';
            }
        }
    }
    
    /**
     * 상태 내보내기 (JSON)
     */
    _exportStatus() {
        if (this.connectedSites.length === 0) {
            toast.warning('No database connected');
            return;
        }

        const exportData = {
            exported_at: new Date().toISOString(),
            databases: this.connectedSites
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `database_status_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Status exported successfully');
    }
    
    /**
     * 연결 해제 시 초기화
     */
    clear() {
        this.connectedSites = [];
        this.expandedTables.clear();
        this._renderDatabases();
    }
}

export default DatabaseListPanel;