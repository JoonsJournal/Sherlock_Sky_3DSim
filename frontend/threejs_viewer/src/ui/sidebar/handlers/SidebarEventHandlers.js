/**
 * SidebarEventHandlers.js
 * =======================
 * Sidebar 이벤트 리스너 설정 및 관리 모듈
 * 
 * @version 1.0.0
 * @created 2026-01-25
 * @modified 2026-01-25
 * 
 * @description
 * Sidebar.js에서 분리된 Event Handler 전용 클래스
 * - DOM 이벤트 리스너 설정
 * - AppModeManager 이벤트 구독
 * - ConnectionStatusService 이벤트 구독
 * - NavigationController 이벤트 구독
 * 
 * @changelog
 * - v1.0.0: 초기 버전 (Sidebar.js v1.13.0에서 분리)
 *           - _setupEventListeners 이동
 *           - _setupAppModeListeners 이동
 *           - _setupConnectionListeners 이동
 *           - _onModeChange 이동
 * 
 * @dependencies
 * - EventBus
 * - ConnectionStatusService
 * - NAV_MODE from '../../core/navigation/index.js'
 * 
 * @exports
 * - SidebarEventHandlers
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/handlers/SidebarEventHandlers.js
 */

// ============================================
// SidebarEventHandlers Class
// ============================================

/**
 * Sidebar Event Handler 클래스
 * 
 * @class SidebarEventHandlers
 * @description 이벤트 리스너 설정 및 구독 관리
 * 
 * @example
 * const eventHandlers = new SidebarEventHandlers({
 *     sidebar: this,
 *     eventBus: this.eventBus,
 *     connectionStatusService: this.connectionStatusService,
 *     toast: this.toast,
 *     NAV_MODE: NAV_MODE
 * });
 * 
 * const unsubscribers = eventHandlers.setupAll();
 */
export class SidebarEventHandlers {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.sidebar - Sidebar 인스턴스 참조
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
     * @param {Object} options.toast - Toast 알림 인스턴스
     * @param {Object} options.NAV_MODE - NAV_MODE 상수 객체
     * @param {Object} options.MODE_MAP - MODE_MAP 설정
     * @param {Object} options.APP_MODE - APP_MODE 상수 객체
     */
    constructor(options = {}) {
        this.sidebar = options.sidebar || null;
        this.eventBus = options.eventBus || null;
        this.connectionStatusService = options.connectionStatusService || null;
        this.toast = options.toast || null;
        this.NAV_MODE = options.NAV_MODE || {};
        this.MODE_MAP = options.MODE_MAP || {};
        this.APP_MODE = options.APP_MODE || {};
        
        // 이벤트 구독 해제 함수 목록
        this._eventUnsubscribers = [];
        
        console.log('[SidebarEventHandlers] 초기화 완료 v1.0.0');
    }
    
    // ========================================
    // Setup All Listeners
    // ========================================
    
    /**
     * 모든 이벤트 리스너 설정
     * 
     * @returns {Array<Function>} 구독 해제 함수 배열
     * 
     * @example
     * const unsubscribers = eventHandlers.setupAll();
     * // 나중에 정리
     * unsubscribers.forEach(unsub => unsub());
     */
    setupAll() {
        this._eventUnsubscribers = [];
        
        this._setupDOMEventListeners();
        this._setupAppModeListeners();
        this._setupConnectionListeners();
        this._setupNavigationListeners();
        
        console.log(`[SidebarEventHandlers] ✅ 총 ${this._eventUnsubscribers.length}개 이벤트 구독 완료`);
        
        return this._eventUnsubscribers;
    }
    
    // ========================================
    // DOM Event Listeners
    // ========================================
    
    /**
     * @private
     * DOM 이벤트 리스너 설정
     */
    _setupDOMEventListeners() {
        // ESC 키로 Connection Modal 닫기
        const handleKeydown = (e) => {
            if (e.key === 'Escape' && this.sidebar?.connectionModalOpen) {
                this.sidebar.closeConnectionModal();
            }
        };
        
        document.addEventListener('keydown', handleKeydown);
        
        // 구독 해제 함수 저장
        this._eventUnsubscribers.push(() => {
            document.removeEventListener('keydown', handleKeydown);
        });
        
        console.log('[SidebarEventHandlers] 📎 DOM 이벤트 리스너 설정 완료');
    }
    
    // ========================================
    // AppModeManager Event Listeners
    // ========================================
    
    /**
     * @private
     * AppModeManager 이벤트 리스너 설정
     */
    _setupAppModeListeners() {
        if (!this.eventBus) return;
        
        // mode:change 이벤트
        const unsubModeChange = this.eventBus.on('mode:change', (data) => {
            this._onModeChange(data.to, data.from);
        });
        this._eventUnsubscribers.push(unsubModeChange);
        
        // mode:enter-blocked 이벤트
        const unsubBlocked = this.eventBus.on('mode:enter-blocked', (data) => {
            if (this.toast) {
                this.toast.warning('Mode Blocked', `${data.mode} requires backend connection`);
            }
        });
        this._eventUnsubscribers.push(unsubBlocked);
        
        console.log('[SidebarEventHandlers] 📡 AppModeManager 이벤트 구독 완료');
    }
    
    /**
     * 모드 변경 이벤트 핸들러
     * 
     * @param {string} newMode - 새 모드
     * @param {string} oldMode - 이전 모드
     */
    _onModeChange(newMode, oldMode) {
        if (!this.sidebar) return;
        
        // MODE_MAP에서 모드 키 찾기
        const modeKey = Object.entries(this.MODE_MAP).find(
            ([k, v]) => this.APP_MODE[v] === newMode
        )?.[0];
        
        this.sidebar.currentMode = modeKey || null;
        this.sidebar.currentSubMode = null;
        
        // UI 업데이트 위임
        if (typeof this.sidebar._updateButtonSelection === 'function') {
            this.sidebar._updateButtonSelection();
        }
        if (typeof this.sidebar._updateModeIndicator === 'function') {
            this.sidebar._updateModeIndicator();
        }
        
        console.log(`[SidebarEventHandlers] 🔄 Mode changed: ${oldMode} → ${newMode} (key: ${modeKey})`);
    }
    
    // ========================================
    // NavigationController Event Listeners
    // ========================================
    
    /**
     * @private
     * NavigationController 이벤트 리스너 설정
     */
    _setupNavigationListeners() {
        if (!this.eventBus) return;
        
        // navigation:complete 이벤트
        const unsubNavComplete = this.eventBus.on('navigation:complete', ({ state }) => {
            this._onNavigationComplete(state);
        });
        this._eventUnsubscribers.push(unsubNavComplete);
        
        // navigation:blocked 이벤트
        const unsubNavBlocked = this.eventBus.on('navigation:blocked', ({ reason }) => {
            this._onNavigationBlocked(reason);
        });
        this._eventUnsubscribers.push(unsubNavBlocked);
        
        console.log('[SidebarEventHandlers] 🧭 NavigationController 이벤트 구독 완료');
    }
    
    /**
     * Navigation 완료 이벤트 핸들러
     * 
     * @param {Object} state - 네비게이션 상태
     * @param {string} state.mode - 현재 모드
     * @param {string} state.submode - 현재 서브모드
     */
    _onNavigationComplete(state) {
        if (!this.sidebar) return;
        
        console.log(`[SidebarEventHandlers] 📡 navigation:complete 수신: ${state.mode}/${state.submode || 'none'}`);
        
        // Sidebar 상태 동기화
        const sidebarMode = this._navModeToSidebarMode(state.mode);
        this.sidebar.currentMode = sidebarMode;
        this.sidebar.currentSubMode = state.submode;
        
        // UI 업데이트
        if (typeof this.sidebar._updateButtonSelection === 'function') {
            this.sidebar._updateButtonSelection();
        }
        if (typeof this.sidebar._updateModeIndicator === 'function') {
            this.sidebar._updateModeIndicator();
        }
        
        // 서브메뉴 활성 상태 업데이트
        if (typeof this.sidebar._updateSubmenuActiveState === 'function') {
            this.sidebar._updateSubmenuActiveState(state.submode);
        }
        
        // ModeIndicatorPanel 표시/숨김
        const modeIndicator = this.sidebar.modeIndicatorPanel;
        if (modeIndicator) {
            if (state.mode === (this.NAV_MODE?.MAIN_VIEWER || 'main_viewer')) {
                modeIndicator.hide();
            } else {
                modeIndicator.show();
            }
        }
    }
    
    /**
     * Navigation 차단 이벤트 핸들러
     * 
     * @param {string} reason - 차단 이유
     */
    _onNavigationBlocked(reason) {
        if (reason === 'connection_required' && this.toast) {
            this.toast.warning('Connection Required', 'Connect to backend or enable Dev Mode');
        }
    }
    
    /**
     * @private
     * NAV_MODE → Sidebar 모드 변환
     * 
     * @param {string} navMode - NAV_MODE 값
     * @returns {string|null} Sidebar 모드
     */
    _navModeToSidebarMode(navMode) {
        const mapping = {
            'main_viewer': null,
            'monitoring': 'monitoring',
            'analysis': 'analysis',
            'layout': 'layout',
            'simulation': 'simulation',
            'settings': 'settings'
        };
        
        // NAV_MODE 객체 값으로도 매핑
        if (this.NAV_MODE) {
            mapping[this.NAV_MODE.MAIN_VIEWER] = null;
            mapping[this.NAV_MODE.MONITORING] = 'monitoring';
            mapping[this.NAV_MODE.ANALYSIS] = 'analysis';
            mapping[this.NAV_MODE.LAYOUT] = 'layout';
            mapping[this.NAV_MODE.SIMULATION] = 'simulation';
            mapping[this.NAV_MODE.SETTINGS] = 'settings';
        }
        
        return mapping[navMode] || null;
    }
    
    // ========================================
    // Connection Status Event Listeners
    // ========================================
    
    /**
     * @private
     * ConnectionStatusService 이벤트 리스너 설정
     */
    _setupConnectionListeners() {
        if (!this.connectionStatusService) return;
        
        // Online 이벤트
        const unsubOnline = this.connectionStatusService.onOnline(() => {
            if (this.sidebar && typeof this.sidebar.enableAfterConnection === 'function') {
                this.sidebar.enableAfterConnection();
            }
        });
        this._eventUnsubscribers.push(unsubOnline);
        
        // Offline 이벤트
        const unsubOffline = this.connectionStatusService.onOffline(() => {
            if (this.sidebar && typeof this.sidebar.disableBeforeConnection === 'function') {
                this.sidebar.disableBeforeConnection();
            }
        });
        this._eventUnsubscribers.push(unsubOffline);
        
        // 초기 상태 확인
        if (this.connectionStatusService.isOnline()) {
            if (this.sidebar && typeof this.sidebar.enableAfterConnection === 'function') {
                this.sidebar.enableAfterConnection();
            }
        }
        
        console.log('[SidebarEventHandlers] 🔗 ConnectionStatusService 이벤트 구독 완료');
    }
    
    // ========================================
    // Public Getters
    // ========================================
    
    /**
     * 등록된 구독 해제 함수 목록 반환
     * @returns {Array<Function>}
     */
    getUnsubscribers() {
        return [...this._eventUnsubscribers];
    }
    
    /**
     * 등록된 구독 수 반환
     * @returns {number}
     */
    getSubscriptionCount() {
        return this._eventUnsubscribers.length;
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 모든 이벤트 구독 해제
     */
    unsubscribeAll() {
        this._eventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._eventUnsubscribers = [];
        
        console.log('[SidebarEventHandlers] 🔌 모든 이벤트 구독 해제 완료');
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.unsubscribeAll();
        
        this.sidebar = null;
        this.eventBus = null;
        this.connectionStatusService = null;
        this.toast = null;
        this.NAV_MODE = null;
        this.MODE_MAP = null;
        this.APP_MODE = null;
        
        console.log('[SidebarEventHandlers] 🗑️ 정리 완료');
    }
}

// ============================================
// Default Export
// ============================================

export default SidebarEventHandlers;