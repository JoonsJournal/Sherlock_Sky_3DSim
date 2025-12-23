/**
 * Database List Panel
 * 연결된 데이터베이스의 테이블 목록 표시
 */

export class DatabaseListPanel {
    constructor(container, connectionService, toast) {
        this.container = container;
        this.connectionService = connectionService;
        this.toast = toast;
        this.connectedSites = [];
        this.expandedTables = new Set();
        this.render();
    }

    /**
     * 패널 렌더링
     */
    render() {
        this.container.innerHTML = `
            <div class="connection-panel database-list-panel">
                <div class="panel-header">
                    <h3>📊 Connected Databases</h3>
                    <div class="panel-actions">
                        <button class="btn-icon" id="refresh-db-btn" title="Refresh">🔄</button>
                        <button class="btn-icon" id="export-status-btn" title="Export Status">📤</button>
                    </div>
                </div>
                <div class="database-list" id="database-list">
                    <div class="no-connection">
                        <span class="no-connection-icon">📂</span>
                        <p>No database connected</p>
                        <small>Connect to a site to view tables</small>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        const refreshBtn = this.container.querySelector('#refresh-db-btn');
        refreshBtn.addEventListener('click', () => this.refresh());

        const exportBtn = this.container.querySelector('#export-status-btn');
        exportBtn.addEventListener('click', () => this.exportStatus());
    }

    /**
     * 데이터베이스 정보 로드
     */
    async loadDatabaseInfo(siteId) {
        try {
            const dbInfo = await this.connectionService.getDatabaseInfo(siteId);
            this.connectedSites = [dbInfo]; // Single site
            this.renderDatabases();
        } catch (error) {
            console.error('Failed to load database info:', error);
            this.toast.error('Failed to load database information');
        }
    }

    /**
     * 데이터베이스 목록 렌더링
     */
    renderDatabases() {
        const dbList = this.container.querySelector('#database-list');

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
            return `
                <div class="database-item">
                    <div class="database-header">
                        <h4>🗄️ ${dbInfo.site_name}</h4>
                        <div class="database-stats">
                            <span class="stat-item">
                                <span class="stat-label">Tables:</span>
                                <span class="stat-value">${dbInfo.tables.length}</span>
                            </span>
                            <span class="stat-item">
                                <span class="stat-label">Size:</span>
                                <span class="stat-value">${dbInfo.total_size_mb?.toFixed(2) || '0.00'} MB</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="connection-pool-info">
                        <span class="pool-label">Connection Pool:</span>
                        <div class="pool-stats">
                            <span class="pool-item active">Active: ${dbInfo.connection_pool.active}</span>
                            <span class="pool-item idle">Idle: ${dbInfo.connection_pool.idle}</span>
                            <span class="pool-item max">Max: ${dbInfo.connection_pool.max}</span>
                        </div>
                    </div>

                    <div class="table-list">
                        ${this.renderTables(dbInfo.tables, dbInfo.site_id)}
                    </div>
                </div>
            `;
        }).join('');

        // 테이블 클릭 이벤트 등록
        this.attachTableClickEvents();
    }

    /**
     * 테이블 목록 렌더링
     */
    renderTables(tables, siteId) {
        if (tables.length === 0) {
            return '<div class="no-tables">No tables found</div>';
        }

        return tables.map(table => {
            const isExpanded = this.expandedTables.has(`${siteId}-${table.name}`);
            
            return `
                <div class="table-item ${isExpanded ? 'expanded' : ''}" data-site-id="${siteId}" data-table-name="${table.name}">
                    <div class="table-header">
                        <div class="table-info-main">
                            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                            <span class="table-name">${table.name}</span>
                            ${table.row_count !== null ? `
                                <span class="table-rows">${this.formatNumber(table.row_count)} rows</span>
                            ` : ''}
                        </div>
                        <div class="table-actions">
                            ${table.size_mb !== null ? `
                                <span class="table-size">${table.size_mb.toFixed(2)} MB</span>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${isExpanded ? `
                        <div class="table-details">
                            <div class="table-detail-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Row Count:</span>
                                    <span class="detail-value">${table.row_count !== null ? this.formatNumber(table.row_count) : 'N/A'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Size:</span>
                                    <span class="detail-value">${table.size_mb !== null ? `${table.size_mb.toFixed(2)} MB` : 'N/A'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Last Updated:</span>
                                    <span class="detail-value">${table.last_updated ? new Date(table.last_updated).toLocaleString() : 'N/A'}</span>
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
    attachTableClickEvents() {
        const tableItems = this.container.querySelectorAll('.table-item');
        
        tableItems.forEach(item => {
            const header = item.querySelector('.table-header');
            header.addEventListener('click', () => {
                const siteId = item.dataset.siteId;
                const tableName = item.dataset.tableName;
                this.toggleTable(siteId, tableName);
            });
        });
    }

    /**
     * 테이블 확장/축소
     */
    toggleTable(siteId, tableName) {
        const key = `${siteId}-${tableName}`;
        
        if (this.expandedTables.has(key)) {
            this.expandedTables.delete(key);
        } else {
            this.expandedTables.add(key);
        }
        
        this.renderDatabases();
    }

    /**
     * 숫자 포맷팅 (천단위 콤마)
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * 새로고침
     */
    async refresh() {
        if (this.connectedSites.length === 0) {
            this.toast.info('No connected database to refresh');
            return;
        }

        const refreshBtn = this.container.querySelector('#refresh-db-btn');
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳';

        try {
            const siteId = this.connectedSites[0].site_id;
            await this.loadDatabaseInfo(siteId);
            this.toast.success('Database information refreshed');
        } catch (error) {
            this.toast.error('Failed to refresh database info');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄';
        }
    }

    /**
     * 상태 내보내기 (JSON)
     */
    exportStatus() {
        if (this.connectedSites.length === 0) {
            this.toast.warning('No database connected');
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

        this.toast.success('Status exported successfully');
    }

    /**
     * 연결 해제 시 초기화
     */
    clear() {
        this.connectedSites = [];
        this.expandedTables.clear();
        this.renderDatabases();
    }
}