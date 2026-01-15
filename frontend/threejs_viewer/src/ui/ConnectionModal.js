/**
 * ConnectionModal.js
 * ==================
 * 데이터베이스 연결 관리 모달
 * 
 * @version 3.0.0
 * @description
 * - 🆕 v3.0.0: Phase 4 CSS Integration
 *   - CSS 클래스명 static 상수 정의
 *   - BEM 네이밍 규칙 적용
 * - v2.0.0: BaseModal 상속 적용
 * 
 * @deprecated v2.1.0 - Sidebar.js의 ConnectionModalManager.js로 대체됨
 * 
 * ⚠️ DEPRECATED NOTICE ⚠️
 * ========================
 * 이 파일은 더 이상 사용되지 않습니다.
 * 
 * 대체 방법:
 * - Sidebar.js 사용 시: ConnectionModalManager.js가 자동으로 모달 관리
 * - 독립 사용 시: 아래 마이그레이션 가이드 참조
 * 
 * 마이그레이션 가이드:
 * ------------------
 * // 기존 코드
 * import { ConnectionModal } from './ui/ConnectionModal.js';
 * const modal = new ConnectionModal();
 * modal.open();
 * 
 * // 새 코드 (Sidebar 사용 시)
 * import { Sidebar } from './ui/sidebar/index.js';
 * const sidebar = new Sidebar({ ... });
 * sidebar.openConnectionModal();
 * 
 * 삭제 예정일: 2026-02-01
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ConnectionModal.js
 * 수정일: 2026-01-15
 */

import { BaseModal } from '../core/base/BaseModal.js';
import { ConnectionService } from '../services/ConnectionService.js';
import { toast } from './common/Toast.js';
import { ConnectionStatusPanel } from './ConnectionStatusPanel.js';
import { SiteSelectionPanel } from './SiteSelectionPanel.js';
import { DatabaseListPanel } from './DatabaseListPanel.js';

// ⚠️ Deprecation 경고 출력
console.warn(
    '[DEPRECATED] ConnectionModal.js is deprecated and will be removed in v2.1.0.\n' +
    'Please migrate to Sidebar.js with ConnectionModalManager.js.\n' +
    'See migration guide: https://github.com/JoonsJournal/Sherlock_Sky_3DSim/docs/migration/connection-modal.md'
);

/**
 * @deprecated Use Sidebar.js + ConnectionModalManager.js instead
 */
export class ConnectionModal extends BaseModal {
    // =========================================================================
    // CSS 클래스 상수 (Phase 4)
    // =========================================================================
    
    /**
     * BEM 클래스명 상수
     * @static
     */
    static CSS = {
        // Block
        BLOCK: 'connection-modal',
        
        // Elements
        BODY: 'connection-modal__body',
        FOOTER: 'connection-modal__footer',
        FOOTER_LEFT: 'connection-modal__footer-left',
        HINT: 'connection-modal__hint',
        
        // Panel Containers
        PANEL_CONTAINER: 'connection-modal__panel-container',
        API_STATUS_CONTAINER: 'connection-modal__api-status',
        SITE_SELECTION_CONTAINER: 'connection-modal__site-selection',
        DB_LIST_CONTAINER: 'connection-modal__db-list',
        
        // Buttons
        BTN_CANCEL: 'connection-modal__cancel-btn',
        
        // States
        LOADING: 'connection-modal--loading',
        
        // Legacy aliases
        LEGACY_BODY: 'connection-modal-body',
        LEGACY_PANEL: 'panel-container'
    };
    
    /**
     * Utility 클래스 상수
     * @static
     */
    static UTIL = {
        HIDDEN: 'u-hidden',
        FLEX: 'u-flex',
        GLASS: 'u-glass'
    };
    
    constructor(options = {}) {
        // Deprecation 경고
        console.warn('[ConnectionModal] This class is deprecated. Use Sidebar.openConnectionModal() instead.');
        
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
            <div class="${ConnectionModal.CSS.BODY} ${ConnectionModal.CSS.LEGACY_BODY}">
                <!-- API Status Panel -->
                <div id="api-status-container" class="${ConnectionModal.CSS.PANEL_CONTAINER} ${ConnectionModal.CSS.LEGACY_PANEL}"></div>
                
                <!-- Site Selection Panel -->
                <div id="site-selection-container" class="${ConnectionModal.CSS.PANEL_CONTAINER} ${ConnectionModal.CSS.LEGACY_PANEL}"></div>
                
                <!-- Database List Panel -->
                <div id="database-list-container" class="${ConnectionModal.CSS.PANEL_CONTAINER} ${ConnectionModal.CSS.LEGACY_PANEL}"></div>
            </div>
        `;
    }
    
    /**
     * Modal Footer 렌더링
     */
    renderFooter() {
        return `
            <div class="${ConnectionModal.CSS.FOOTER_LEFT} modal-footer-left">
                <span class="${ConnectionModal.CSS.HINT} footer-hint">Ctrl+K to toggle</span>
            </div>
            <button class="${ConnectionModal.CSS.BTN_CANCEL} btn-secondary modal-cancel-btn">Close</button>
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
