/**
 * ConnectionModal.js
 * 데이터베이스 연결 관리 모달
 * 
 * @version 2.0.0
 * @description BaseModal 상속 적용
 */

import { BaseModal } from '../core/base/BaseModal.js';
import { ConnectionService } from '../services/ConnectionService.js';
import { toast } from './common/Toast.js';
import { ConnectionStatusPanel } from './ConnectionStatusPanel.js';
import { SiteSelectionPanel } from './SiteSelectionPanel.js';
import { DatabaseListPanel } from './DatabaseListPanel.js';

/**
 * ConnectionModal
 * 데이터베이스 연결 관리 모달
 */
export class ConnectionModal extends BaseModal {
    constructor(options = {}) {
        super({
            ...options,
            title: '🔌 Database Connection Manager',
            size: 'lg',
            closeOnOverlay: true,
            closeOnEsc: true
        });
        
        // 서비스
        this.connectionService = new ConnectionService('http://localhost:8000');
        
        // 패널 참조
        this.statusPanel = null;
        this.sitePanel = null;
        this.dbPanel = null;
    }
    
    /**
     * Modal Body 렌더링
     */
    renderBody() {
        return `
            <div class="connection-modal-body">
                <!-- API Status Panel -->
                <div id="api-status-container" class="panel-container"></div>
                
                <!-- Site Selection Panel -->
                <div id="site-selection-container" class="panel-container"></div>
                
                <!-- Database List Panel -->
                <div id="database-list-container" class="panel-container"></div>
            </div>
        `;
    }
    
    /**
     * Modal Footer 렌더링
     */
    renderFooter() {
        return `
            <div class="modal-footer-left">
                <span class="footer-hint">Ctrl+K to toggle</span>
            </div>
            <button class="btn-secondary modal-cancel-btn">Close</button>
        `;
    }
    
    /**
     * Modal 열릴 때
     */
    async onOpen() {
        // 패널 초기화
        this._initializePanels();
        
        // 데이터 로드
        await this._loadInitialData();
        
        // 자동 헬스체크 시작
        this.connectionService.startAutoHealthCheck((healthData) => {
            if (this.statusPanel) {
                this.statusPanel.updateStatus(healthData);
            }
        });
    }
    
    /**
     * Modal 닫힐 때
     */
    onClose() {
        // 자동 헬스체크 중지
        this.connectionService.stopAutoHealthCheck();
    }
    
    /**
     * Cancel 버튼 클릭 시
     */
    onCancel() {
        this.close();
    }
    
    /**
     * 이벤트 리스너 등록 (자식 클래스용)
     */
    attachEventListeners() {
        // Ctrl+K로 토글
        this._keyHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }
    
    /**
     * 패널 초기화
     */
    _initializePanels() {
        // 이미 초기화되었으면 스킵
        if (this.statusPanel) return;
        
        // API Status Panel
        const apiStatusContainer = this.bodyElement.querySelector('#api-status-container');
        if (apiStatusContainer) {
            this.statusPanel = new ConnectionStatusPanel({
                container: apiStatusContainer,
                connectionService: this.connectionService
            });
            this.statusPanel.mount();
        }
        
        // Site Selection Panel
        const siteContainer = this.bodyElement.querySelector('#site-selection-container');
        if (siteContainer) {
            this.sitePanel = new SiteSelectionPanel({
                container: siteContainer,
                connectionService: this.connectionService
            });
            this.sitePanel.mount();
            
            // 사이트 연결 이벤트
            siteContainer.addEventListener('site-connected', async (e) => {
                if (this.dbPanel) {
                    await this.dbPanel.loadDatabaseInfo(e.detail.siteId);
                }
            });
            
            siteContainer.addEventListener('site-disconnected', () => {
                if (this.dbPanel) {
                    this.dbPanel.clear();
                }
            });
        }
        
        // Database List Panel
        const dbContainer = this.bodyElement.querySelector('#database-list-container');
        if (dbContainer) {
            this.dbPanel = new DatabaseListPanel({
                container: dbContainer,
                connectionService: this.connectionService
            });
            this.dbPanel.mount();
        }
    }
    
    /**
     * 초기 데이터 로드
     */
    async _loadInitialData() {
        try {
            // 프로필 로드
            if (this.sitePanel) {
                await this.sitePanel.loadProfiles();
            }
            
            // 현재 연결 상태 확인 및 DB 정보 로드
            const statusList = await this.connectionService.getStatus();
            const connectedSite = statusList.find(s => s.status === 'connected');
            
            if (connectedSite && this.dbPanel) {
                await this.dbPanel.loadDatabaseInfo(connectedSite.site_id);
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
            toast.error('Failed to load connection data');
        }
    }
    
    /**
     * 파괴
     */
    destroy() {
        // 키 핸들러 제거
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        
        // 패널 파괴
        if (this.statusPanel) {
            this.statusPanel.destroy();
            this.statusPanel = null;
        }
        if (this.sitePanel) {
            this.sitePanel.destroy();
            this.sitePanel = null;
        }
        if (this.dbPanel) {
            this.dbPanel.destroy();
            this.dbPanel = null;
        }
        
        super.destroy();
    }
}

export default ConnectionModal;