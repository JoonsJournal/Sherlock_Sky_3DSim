/**
 * CoverScreen.js
 * ==============
 * Cleanroom Sidebar Theme - 커버 스크린 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * 
 * @description
 * - 앱 시작 시 기본 화면
 * - Backend API / Database 연결 상태 표시
 * - 연결 힌트 메시지 표시
 * - ConnectionStatusService 연동
 * 
 * 의존성:
 * - ConnectionStatusService (services)
 * - EventBus (core/managers)
 */

// ============================================
// CoverScreen Class
// ============================================

export class CoverScreen {
    /**
     * @param {Object} options
     * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {string} options.title - 앱 타이틀
     * @param {string} options.subtitle - 서브타이틀
     * @param {string} options.logo - 로고 이모지/텍스트
     */
    constructor(options = {}) {
        this.connectionStatusService = options.connectionStatusService || null;
        this.eventBus = options.eventBus || null;
        
        // 설정
        this.title = options.title || 'SHERLOCK SKY 3D SIM';
        this.subtitle = options.subtitle || 'Industrial Equipment Monitoring & Simulation Platform';
        this.logo = options.logo || '🏭';
        
        // 상태
        this.isApiConnected = false;
        this.isDbConnected = false;
        this.connectedSiteName = null;
        
        // DOM 참조
        this.element = null;
        this._eventUnsubscribers = [];
        
        // 초기화
        this._init();
    }
    
    // ========================================
    // Initialization
    // ========================================
    
    _init() {
        this._createDOM();
        this._setupEventListeners();
        
        console.log('[CoverScreen] 초기화 완료');
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    _createDOM() {
        // 기존 커버 스크린이 있으면 제거
        const existing = document.getElementById('cover-screen');
        if (existing) existing.remove();
        
        this.element = document.createElement('div');
        this.element.id = 'cover-screen';
        this.element.innerHTML = `
            <div class="cover-logo">${this.logo}</div>
            <div class="cover-title">${this.title}</div>
            <div class="cover-subtitle">${this.subtitle}</div>
            
            <div class="cover-status">
                <div class="cover-status-item">
                    <span class="cover-status-dot disconnected" id="cover-api-dot"></span>
                    <span class="cover-status-text">Backend API</span>
                    <span class="cover-status-value" id="cover-api-status">Disconnected</span>
                </div>
                <div class="cover-status-item">
                    <span class="cover-status-dot disconnected" id="cover-db-dot"></span>
                    <span class="cover-status-text">Database</span>
                    <span class="cover-status-value" id="cover-db-status">Not Connected</span>
                </div>
            </div>
            
            <div class="cover-hint">
                Press <kbd>Ctrl+K</kbd> to connect database, or select <kbd>Monitoring → 3D View</kbd> after connection
            </div>
        `;
        
        // main-content 내부에 삽입
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.insertBefore(this.element, mainContent.firstChild);
        } else {
            document.body.appendChild(this.element);
        }
    }
    
    // ========================================
    // Event Listeners
    // ========================================
    
    _setupEventListeners() {
        // ConnectionStatusService 연동
        if (this.connectionStatusService) {
            const unsubOnline = this.connectionStatusService.onOnline(() => {
                this.setApiConnected(true);
            });
            this._eventUnsubscribers.push(unsubOnline);
            
            const unsubOffline = this.connectionStatusService.onOffline(() => {
                this.setApiConnected(false);
            });
            this._eventUnsubscribers.push(unsubOffline);
            
            // 초기 상태
            this.setApiConnected(this.connectionStatusService.isOnline());
        }
        
        // EventBus 연동
        if (this.eventBus) {
            // 사이트 연결 이벤트
            const unsubSite = this.eventBus.on('site:connected', (data) => {
                this.setDbConnected(true, data.siteName || data.siteId);
            });
            this._eventUnsubscribers.push(unsubSite);
            
            const unsubDisconnect = this.eventBus.on('site:disconnected', () => {
                this.setDbConnected(false, null);
            });
            this._eventUnsubscribers.push(unsubDisconnect);
        }
    }
    
    // ========================================
    // Status Updates
    // ========================================
    
    /**
     * API 연결 상태 설정
     * @param {boolean} connected
     */
    setApiConnected(connected) {
        this.isApiConnected = connected;
        
        const dot = document.getElementById('cover-api-dot');
        const status = document.getElementById('cover-api-status');
        
        if (dot) {
            dot.className = `cover-status-dot ${connected ? 'connected' : 'disconnected'}`;
        }
        if (status) {
            status.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }
    
    /**
     * DB 연결 상태 설정
     * @param {boolean} connected
     * @param {string} siteName - 연결된 사이트 이름
     */
    setDbConnected(connected, siteName = null) {
        this.isDbConnected = connected;
        this.connectedSiteName = siteName;
        
        const dot = document.getElementById('cover-db-dot');
        const status = document.getElementById('cover-db-status');
        
        if (dot) {
            dot.className = `cover-status-dot ${connected ? 'connected' : 'disconnected'}`;
        }
        if (status) {
            status.textContent = connected && siteName ? siteName : 'Not Connected';
        }
    }
    
    /**
     * 연결 중 상태 표시 (애니메이션)
     * @param {string} type - 'api' | 'db'
     */
    setConnecting(type) {
        const dotId = type === 'api' ? 'cover-api-dot' : 'cover-db-dot';
        const statusId = type === 'api' ? 'cover-api-status' : 'cover-db-status';
        
        const dot = document.getElementById(dotId);
        const status = document.getElementById(statusId);
        
        if (dot) {
            dot.className = 'cover-status-dot checking';
        }
        if (status) {
            status.textContent = 'Connecting...';
        }
    }
    
    // ========================================
    // Visibility
    // ========================================
    
    /**
     * 커버 스크린 표시
     */
    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
        }
    }
    
    /**
     * 커버 스크린 숨기기
     */
    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
        }
    }
    
    /**
     * 표시 상태 토글
     */
    toggle() {
        if (this.element) {
            this.element.classList.toggle('hidden');
        }
    }
    
    /**
     * 표시 상태 확인
     * @returns {boolean}
     */
    isVisible() {
        return this.element && !this.element.classList.contains('hidden');
    }
    
    // ========================================
    // Content Updates
    // ========================================
    
    /**
     * 타이틀 변경
     * @param {string} title
     */
    setTitle(title) {
        this.title = title;
        const titleEl = this.element?.querySelector('.cover-title');
        if (titleEl) {
            titleEl.textContent = title;
        }
    }
    
    /**
     * 서브타이틀 변경
     * @param {string} subtitle
     */
    setSubtitle(subtitle) {
        this.subtitle = subtitle;
        const subtitleEl = this.element?.querySelector('.cover-subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = subtitle;
        }
    }
    
    /**
     * 로고 변경
     * @param {string} logo - 이모지 또는 텍스트
     */
    setLogo(logo) {
        this.logo = logo;
        const logoEl = this.element?.querySelector('.cover-logo');
        if (logoEl) {
            logoEl.textContent = logo;
        }
    }
    
    /**
     * 힌트 메시지 변경
     * @param {string} hint - HTML 문자열 가능 (kbd 태그 등)
     */
    setHint(hint) {
        const hintEl = this.element?.querySelector('.cover-hint');
        if (hintEl) {
            hintEl.innerHTML = hint;
        }
    }
    
    /**
     * 추가 상태 아이템 삽입
     * @param {string} id - 고유 ID
     * @param {string} label - 라벨
     * @param {boolean} connected - 연결 상태
     * @param {string} value - 값 텍스트
     */
    addStatusItem(id, label, connected = false, value = '-') {
        const statusContainer = this.element?.querySelector('.cover-status');
        if (!statusContainer) return;
        
        // 중복 체크
        if (document.getElementById(`cover-${id}-dot`)) return;
        
        const item = document.createElement('div');
        item.className = 'cover-status-item';
        item.innerHTML = `
            <span class="cover-status-dot ${connected ? 'connected' : 'disconnected'}" id="cover-${id}-dot"></span>
            <span class="cover-status-text">${label}</span>
            <span class="cover-status-value" id="cover-${id}-status">${value}</span>
        `;
        
        statusContainer.appendChild(item);
    }
    
    /**
     * 상태 아이템 업데이트
     * @param {string} id - 아이템 ID
     * @param {boolean} connected - 연결 상태
     * @param {string} value - 값 텍스트
     */
    updateStatusItem(id, connected, value) {
        const dot = document.getElementById(`cover-${id}-dot`);
        const status = document.getElementById(`cover-${id}-status`);
        
        if (dot) {
            dot.className = `cover-status-dot ${connected ? 'connected' : 'disconnected'}`;
        }
        if (status) {
            status.textContent = value;
        }
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 정리 (destroy)
     */
    destroy() {
        // 이벤트 리스너 정리
        this._eventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._eventUnsubscribers = [];
        
        // DOM 제거
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        console.log('[CoverScreen] 정리 완료');
    }
}

// 기본 내보내기
export default CoverScreen;