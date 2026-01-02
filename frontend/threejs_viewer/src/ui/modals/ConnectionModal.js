/**
 * Connection Modal
 * 데이터베이스 연결 관리 모달
 */

import { ConnectionService } from '../services/ConnectionService.js';
import { ToastNotification } from './ToastNotification.js';
import { ConnectionStatusPanel } from './ConnectionStatusPanel.js';
import { SiteSelectionPanel } from './SiteSelectionPanel.js';
import { DatabaseListPanel } from './DatabaseListPanel.js';

export class ConnectionModal {
    constructor() {
        this.isOpen = false;
        this.connectionService = new ConnectionService('http://localhost:8000');
        this.toast = new ToastNotification();
        
        this.modalElement = null;
        this.statusPanel = null;
        this.sitePanel = null;
        this.dbPanel = null;
        
        this.createModal();
        this.attachEventListeners();
    }

    /**
     * 모달 HTML 생성
     */
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'connection-modal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🔌 Database Connection Manager</h2>
                    <button class="modal-close" title="Close (Esc)">&times;</button>
                </div>
                
                <div class="modal-body">
                    <!-- API Status Panel -->
                    <div id="api-status-container"></div>
                    
                    <!-- Site Selection Panel -->
                    <div id="site-selection-container"></div>
                    
                    <!-- Database List Panel -->
                    <div id="database-list-container"></div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-secondary" id="close-modal-btn">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.modalElement = modal;
        
        // 패널 초기화
        this.initializePanels();
    }

    /**
     * 패널 초기화
     */
    initializePanels() {
        // API Status Panel
        const apiStatusContainer = document.getElementById('api-status-container');
        this.statusPanel = new ConnectionStatusPanel(apiStatusContainer, this.connectionService);
        
        // Site Selection Panel
        const siteContainer = document.getElementById('site-selection-container');
        this.sitePanel = new SiteSelectionPanel(siteContainer, this.connectionService, this.toast);
        
        // Database List Panel
        const dbContainer = document.getElementById('database-list-container');
        this.dbPanel = new DatabaseListPanel(dbContainer, this.connectionService, this.toast);
        
        // 사이트 연결 이벤트 리스너
        siteContainer.addEventListener('site-connected', async (e) => {
            await this.dbPanel.loadDatabaseInfo(e.detail.siteId);
        });
        
        siteContainer.addEventListener('site-disconnected', () => {
            this.dbPanel.clear();
        });
    }

    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        // 모달 닫기 버튼
        const closeBtn = this.modalElement.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.close());
        
        const closeModalBtn = this.modalElement.querySelector('#close-modal-btn');
        closeModalBtn.addEventListener('click', () => this.close());
        
        // 오버레이 클릭 시 닫기
        const overlay = this.modalElement.querySelector('.modal-overlay');
        overlay.addEventListener('click', () => this.close());
        
        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Ctrl/Cmd + K로 열기
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (this.isOpen) {
                    this.close();
                } else {
                    this.open();
                }
            }
        });
    }

    /**
     * 모달 열기
     */
    async open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.modalElement.classList.add('modal-show');
        document.body.style.overflow = 'hidden';
        
        // 데이터 로드
        await this.loadInitialData();
        
        // 자동 헬스체크 시작
        this.connectionService.startAutoHealthCheck((healthData) => {
            this.statusPanel.updateStatus(healthData);
        });
    }

    /**
     * 모달 닫기
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.modalElement.classList.remove('modal-show');
        document.body.style.overflow = '';
        
        // 자동 헬스체크 중지
        this.connectionService.stopAutoHealthCheck();
    }

    /**
     * 초기 데이터 로드
     */
    async loadInitialData() {
        try {
            // 프로필 로드
            await this.sitePanel.loadProfiles();
            
            // 현재 연결 상태 확인 및 DB 정보 로드
            const statusList = await this.connectionService.getStatus();
            const connectedSite = statusList.find(s => s.status === 'connected');
            
            if (connectedSite) {
                await this.dbPanel.loadDatabaseInfo(connectedSite.site_id);
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.toast.error('Failed to load connection data');
        }
    }

    /**
     * 모달 토글
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}