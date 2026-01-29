/**
 * SidebarStateManager.js
 * ======================
 * Sidebar 상태 관리 모듈 (Connection, Theme, DevMode, Mapping)
 * 
 * @version 1.1.0
 * @created 2026-01-25
 * @modified 2026-01-29
 * 
 * @description
 * Sidebar.js에서 분리된 State 관리 전용 클래스
 * - Connection 상태 관리 (연결/해제)
 * - Theme 관리 (Dark/Light 토글)
 * - DevMode 관리 (Mock 모드 활성화)
 * - Cover Screen 상태 업데이트
 * - 🆕 Mapping 상태 관리 (매핑 준비 여부)
 * 
 * @changelog
 * - v1.1.0: 🆕 Mapping Status 기능 추가 (2026-01-29)
 *           - isMappingReady, connectedSiteId 상태 추가
 *           - _setupMappingListeners() 메서드 추가
 *           - _updateModeButtons() 메서드 추가
 *           - getMappingReady(), getConnectedSiteId() 공개 메서드 추가
 *           - setMappingStatus() 메서드 추가
 *           - onSiteConnected()에 mapping 정보 처리 추가
 *           - ⚠️ 호환성: 기존 모든 API/메서드 100% 유지
 * - v1.0.0: 초기 버전 (Sidebar.js v1.13.0에서 분리)
 *           - enableAfterConnection, disableBeforeConnection 이동
 *           - _onSiteConnected, _onSiteDisconnected 이동
 *           - _updateCoverStatus 이동
 *           - toggleTheme 이동
 *           - toggleDevMode, _loadMockTest, setDebugView 이동
 * 
 * @dependencies
 * - updateThemeSwitchState from './SidebarSubmenuFactory.js'
 * - updateDevModeLabel, updateDevModeBadge from './SidebarSubmenuFactory.js'
 * - setMockTestSectionVisible from './SidebarSubmenuFactory.js'
 * - getSiteById from './SidebarConfig.js'
 * 
 * @exports
 * - SidebarStateManager
 * - COVER_CSS
 * - MAPPING_STATE_CSS (🆕 v1.1.0)
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/managers/SidebarStateManager.js
 */

// ============================================
// CSS 클래스 상수
// ============================================

/**
 * Cover Screen 관련 CSS 클래스 상수
 * @constant
 */
export const COVER_CSS = {
    STATUS_DOT: 'cover-status-dot',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected'
};

/**
 * 🆕 v1.1.0: Mapping State 관련 CSS 클래스 상수
 * @constant
 */
export const MAPPING_STATE_CSS = {
    // 버튼 상태
    BTN_DISABLED: 'sidebar-btn--disabled',
    BTN_MAPPING_REQUIRED: 'sidebar-btn--mapping-required',
    
    // 배지
    MAPPING_BADGE: 'mapping-status-badge',
    BADGE_READY: 'mapping-status-badge--ready',
    BADGE_MISSING: 'mapping-status-badge--missing',
    
    // Legacy (하위 호환)
    LEGACY_DISABLED: 'disabled'
};

// ============================================
// SidebarStateManager Class
// ============================================

/**
 * Sidebar State Manager 클래스
 * 
 * @class SidebarStateManager
 * @description Connection, Theme, DevMode, Mapping 상태 관리
 * 
 * @example
 * const stateManager = new SidebarStateManager({
 *     eventBus: this.eventBus,
 *     toast: this.toast,
 *     connectionModalManager: this.connectionModalManager,
 *     modeIndicatorPanel: this.modeIndicatorPanel,
 *     getSiteById: getSiteById,
 *     submenuFactoryFns: {
 *         updateThemeSwitchState,
 *         updateDevModeLabel,
 *         updateDevModeBadge,
 *         setMockTestSectionVisible
 *     }
 * });
 */
export class SidebarStateManager {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {Object} options.toast - Toast 알림 인스턴스
     * @param {Object} options.connectionModalManager - ConnectionModalManager 인스턴스
     * @param {Object} options.modeIndicatorPanel - ModeIndicatorPanel 인스턴스
     * @param {Function} options.getSiteById - 사이트 정보 조회 함수
     * @param {Object} options.submenuFactoryFns - SidebarSubmenuFactory 함수들
     * @param {Function} options.onStateChange - 상태 변경 콜백
     */
    constructor(options = {}) {
        // 의존성 주입
        this.eventBus = options.eventBus || null;
        this.toast = options.toast || null;
        this.connectionModalManager = options.connectionModalManager || null;
        this.modeIndicatorPanel = options.modeIndicatorPanel || null;
        this.getSiteById = options.getSiteById || (() => null);
        
        // SidebarSubmenuFactory 함수들
        this.submenuFns = options.submenuFactoryFns || {};
        
        // 상태 변경 콜백 (Sidebar에서 버튼 상태 업데이트 등)
        this._onStateChange = options.onStateChange || (() => {});
        
        // ════════════════════════════════════════════════════════════════
        // State
        // ════════════════════════════════════════════════════════════════
        this.isConnected = false;
        this.devModeEnabled = false;
        this.currentTheme = 'dark';
        
        // ════════════════════════════════════════════════════════════════
        // 🆕 v1.1.0: Mapping State
        // ════════════════════════════════════════════════════════════════
        this.isMappingReady = false;
        this.connectedSiteId = null;
        this.currentMappingInfo = null;  // { status, equipment_count, file_name, ... }
        
        // 테마 초기 로드
        this._loadTheme();
        
        // 🆕 v1.1.0: 매핑 이벤트 리스너 설정
        this._setupMappingListeners();
        
        console.log('[SidebarStateManager] 초기화 완료 v1.1.0 (Mapping Status 지원)');
    }
    
    // ========================================
    // 🆕 v1.1.0: Mapping State Management
    // ========================================
    
    /**
     * 🆕 v1.1.0: 매핑 이벤트 리스너 설정
     * @private
     */
    _setupMappingListeners() {
        if (!this.eventBus) return;
        
        // mapping:statusChanged 이벤트 수신
        this.eventBus.on('mapping:statusChanged', (data) => {
            const { siteId, mappingInfo } = data;
            
            console.log('[SidebarStateManager] 📊 매핑 상태 변경 이벤트 수신:', siteId, mappingInfo);
            
            if (mappingInfo) {
                this.isMappingReady = mappingInfo.status === 'ready';
                this.currentMappingInfo = mappingInfo;
            } else {
                this.isMappingReady = false;
                this.currentMappingInfo = null;
            }
            
            // 모드 버튼 상태 업데이트
            this._updateModeButtons();
            
            // 상태 변경 콜백
            this._onStateChange({
                type: 'mappingChanged',
                isConnected: this.isConnected,
                devModeEnabled: this.devModeEnabled,
                isMappingReady: this.isMappingReady,
                connectedSiteId: this.connectedSiteId,
                mappingInfo: this.currentMappingInfo
            });
        });
        
        console.log('[SidebarStateManager] 📡 매핑 이벤트 리스너 설정 완료');
    }
    
    /**
     * 🆕 v1.1.0: 모드 버튼 활성화/비활성화 업데이트
     * @private
     */
    _updateModeButtons() {
        // Monitoring 버튼 상태 업데이트
        const monitoringBtn = document.querySelector('[data-sidebar-btn="monitoring"]');
        
        if (monitoringBtn) {
            if (this.isConnected && !this.isMappingReady && !this.devModeEnabled) {
                // 연결됨 + 매핑 미완료 + Dev Mode 아님 → 경고 표시
                monitoringBtn.classList.add(MAPPING_STATE_CSS.BTN_MAPPING_REQUIRED);
                monitoringBtn.title = 'Equipment mapping required for full functionality';
            } else {
                monitoringBtn.classList.remove(MAPPING_STATE_CSS.BTN_MAPPING_REQUIRED);
                monitoringBtn.title = '';
            }
        }
        
        console.log(`[SidebarStateManager] 🔄 모드 버튼 상태 업데이트 - Mapping Ready: ${this.isMappingReady}`);
    }
    
    /**
     * 🆕 v1.1.0: 매핑 준비 상태 반환
     * @returns {boolean}
     */
    getMappingReady() {
        return this.isMappingReady;
    }
    
    /**
     * 🆕 v1.1.0: 연결된 사이트 ID 반환
     * @returns {string|null}
     */
    getConnectedSiteId() {
        return this.connectedSiteId;
    }
    
    /**
     * 🆕 v1.1.0: 현재 매핑 정보 반환
     * @returns {Object|null}
     */
    getMappingInfo() {
        return this.currentMappingInfo;
    }
    
    /**
     * 🆕 v1.1.0: 매핑 상태 설정 (외부에서 호출 가능)
     * @param {string} siteId - 사이트 ID
     * @param {boolean} isMappingReady - 매핑 준비 여부
     * @param {Object} mappingInfo - 상세 매핑 정보 (선택)
     */
    setMappingStatus(siteId, isMappingReady, mappingInfo = null) {
        this.connectedSiteId = siteId;
        this.isMappingReady = isMappingReady;
        this.currentMappingInfo = mappingInfo;
        
        // 모드 버튼 상태 업데이트
        this._updateModeButtons();
        
        // 상태 변경 콜백
        this._onStateChange({
            type: 'mappingSet',
            isConnected: this.isConnected,
            devModeEnabled: this.devModeEnabled,
            isMappingReady: this.isMappingReady,
            connectedSiteId: this.connectedSiteId,
            mappingInfo: this.currentMappingInfo
        });
        
        console.log(`[SidebarStateManager] 📊 매핑 상태 설정: ${siteId}, Ready: ${isMappingReady}`);
    }
    
    // ========================================
    // Theme Management
    // ========================================
    
    /**
     * @private
     * 저장된 테마 로드
     */
    _loadTheme() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    
    /**
     * 테마 토글 (Dark ↔ Light)
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        
        // DOM 업데이트
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // 서브메뉴 스위치 상태 업데이트
        if (this.submenuFns.updateThemeSwitchState) {
            this.submenuFns.updateThemeSwitchState(this.currentTheme);
        }
        
        // LocalStorage 저장
        localStorage.setItem('theme', this.currentTheme);
        
        // 이벤트 발행
        if (this.eventBus) {
            this.eventBus.emit('theme:change', { theme: this.currentTheme });
        }
        
        // Toast 알림
        if (this.toast) {
            this.toast.info('Theme Changed', `Switched to ${this.currentTheme} mode`);
        }
        
        console.log(`[SidebarStateManager] 🎨 Theme: ${this.currentTheme}`);
    }
    
    /**
     * 현재 테마 반환
     * @returns {string} 'dark' | 'light'
     */
    getTheme() {
        return this.currentTheme;
    }
    
    // ========================================
    // Dev Mode Management
    // ========================================
    
    /**
     * Dev Mode 토글
     */
    toggleDevMode() {
        this.devModeEnabled = !this.devModeEnabled;
        
        // 서브메뉴 UI 업데이트
        if (this.submenuFns.updateDevModeBadge) {
            this.submenuFns.updateDevModeBadge(this.devModeEnabled);
        }
        if (this.submenuFns.updateDevModeLabel) {
            this.submenuFns.updateDevModeLabel(this.devModeEnabled);
        }
        if (this.submenuFns.setMockTestSectionVisible) {
            this.submenuFns.setMockTestSectionVisible(this.devModeEnabled);
        }
        
        // ModeIndicatorPanel 업데이트
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.setDevMode(this.devModeEnabled);
        }
        
        // ConnectionModalManager Mock 모드 설정
        if (this.connectionModalManager) {
            if (this.devModeEnabled) {
                this.connectionModalManager.enableMockMode({ responseDelay: 500 });
                console.log('[SidebarStateManager] 🎭 ConnectionModalManager Mock 모드 활성화');
            } else {
                this.connectionModalManager.disableMockMode();
                console.log('[SidebarStateManager] 🔌 ConnectionModalManager 실제 API 모드로 전환');
            }
        }
        
        // 🆕 v1.1.0: Dev Mode 시 모드 버튼 상태 업데이트
        this._updateModeButtons();
        
        // 상태 변경 콜백 (버튼 상태 업데이트)
        this._onStateChange({
            type: 'devMode',
            isConnected: this.isConnected,
            devModeEnabled: this.devModeEnabled,
            isMappingReady: this.isMappingReady  // 🆕 v1.1.0
        });
        
        // Global state 업데이트 (하위 호환)
        if (window.sidebarState) {
            window.sidebarState.devModeEnabled = this.devModeEnabled;
        }
        
        // Toast 알림
        if (this.toast) {
            if (this.devModeEnabled) {
                this.toast.warning('Dev Mode ON', 'All features enabled without backend (Mock mode)');
            } else {
                this.toast.info('Dev Mode OFF', 'Switched to real API mode');
            }
        }
        
        console.log(`[SidebarStateManager] ⚡ Dev Mode: ${this.devModeEnabled ? 'ON (Mock)' : 'OFF (Real)'}`);
    }
    
    /**
     * Dev Mode 활성화 여부 반환
     * @returns {boolean}
     */
    isDevModeEnabled() {
        return this.devModeEnabled;
    }
    
    /**
     * Mock 테스트 로드
     * 
     * @param {string} testName - 테스트 이름
     */
    loadMockTest(testName) {
        if (this.toast) {
            this.toast.info('Mock Test', `Loading: ${testName}`);
        }
        
        if (this.eventBus) {
            this.eventBus.emit('mock:load-test', { testName });
        }
        
        console.log(`[SidebarStateManager] 🧪 Mock Test: ${testName}`);
    }
    
    /**
     * Debug View 설정
     * 
     * @param {string} view - View 이름
     */
    setDebugView(view) {
        if (this.toast) {
            this.toast.info('Debug View', view);
        }
        
        if (this.eventBus) {
            this.eventBus.emit('debug:set-view', { view });
        }
        
        console.log(`[SidebarStateManager] 🔍 Debug View: ${view}`);
    }
    
    // ========================================
    // Connection State Management
    // ========================================
    
    /**
     * Backend 연결 후 UI 활성화
     */
    enableAfterConnection() {
        this.isConnected = true;
        
        this._onStateChange({
            type: 'connection',
            isConnected: this.isConnected,
            devModeEnabled: this.devModeEnabled,
            isMappingReady: this.isMappingReady  // 🆕 v1.1.0
        });
        
        // Global state 업데이트
        if (window.sidebarState) {
            window.sidebarState.isConnected = true;
        }
        
        console.log('[SidebarStateManager] ✅ Backend 연결됨 - UI 활성화');
    }
    
    /**
     * Backend 연결 해제 후 UI 비활성화
     * 
     * @param {Function} showCoverScreen - Cover Screen 표시 함수
     */
    disableBeforeConnection(showCoverScreen) {
        this.isConnected = false;
        
        // 🆕 v1.1.0: 매핑 상태 초기화
        this.isMappingReady = false;
        this.connectedSiteId = null;
        this.currentMappingInfo = null;
        
        this._onStateChange({
            type: 'connection',
            isConnected: this.isConnected,
            devModeEnabled: this.devModeEnabled,
            isMappingReady: this.isMappingReady  // 🆕 v1.1.0
        });
        
        // Global state 업데이트
        if (window.sidebarState) {
            window.sidebarState.isConnected = false;
        }
        
        // Dev Mode가 아니면 Cover Screen 표시
        if (!this.devModeEnabled && showCoverScreen) {
            showCoverScreen();
        }
        
        // 🆕 v1.1.0: 모드 버튼 상태 업데이트
        this._updateModeButtons();
        
        console.log('[SidebarStateManager] ⛔ Backend 연결 해제 - UI 비활성화');
    }
    
    /**
     * 연결 상태 반환
     * @returns {boolean}
     */
    getIsConnected() {
        return this.isConnected;
    }
    
    /**
     * 사이트 연결 완료 핸들러
     * 🔧 v1.1.0: mapping 정보 처리 추가
     * 
     * @param {string} siteId - 사이트 ID
     * @param {string} siteName - 사이트 이름
     * @param {Object} mappingInfo - 매핑 정보 (🆕 v1.1.0)
     */
    onSiteConnected(siteId, siteName, mappingInfo = null) {
        this.isConnected = true;
        
        // 🆕 v1.1.0: 매핑 상태 설정
        this.connectedSiteId = siteId;
        if (mappingInfo) {
            this.isMappingReady = mappingInfo.status === 'ready';
            this.currentMappingInfo = mappingInfo;
        } else {
            // mappingInfo가 없으면 ConnectionModalManager에서 가져오기 시도
            if (this.connectionModalManager) {
                const fetchedMapping = this.connectionModalManager.getMappingStatus(siteId);
                if (fetchedMapping) {
                    this.isMappingReady = fetchedMapping.status === 'ready';
                    this.currentMappingInfo = fetchedMapping;
                }
            }
        }
        
        this._onStateChange({
            type: 'siteConnected',
            isConnected: true,
            devModeEnabled: this.devModeEnabled,
            isMappingReady: this.isMappingReady,  // 🆕 v1.1.0
            siteId,
            siteName,
            mappingInfo: this.currentMappingInfo  // 🆕 v1.1.0
        });
        
        this.updateCoverStatus(true, siteId);
        
        // 🆕 v1.1.0: 모드 버튼 상태 업데이트
        this._updateModeButtons();
        
        if (window.sidebarState) {
            window.sidebarState.isConnected = true;
        }
        
        console.log(`[SidebarStateManager] 🔗 Site connected: ${siteName} (${siteId}), Mapping Ready: ${this.isMappingReady}`);
    }
    
    /**
     * 사이트 연결 해제 핸들러
     * 
     * @param {string} siteId - 사이트 ID
     * @param {Function} goHome - NavigationController.goHome 함수
     */
    onSiteDisconnected(siteId, goHome) {
        this.isConnected = false;
        
        // 🆕 v1.1.0: 매핑 상태 초기화
        this.isMappingReady = false;
        this.connectedSiteId = null;
        this.currentMappingInfo = null;
        
        this._onStateChange({
            type: 'siteDisconnected',
            isConnected: false,
            devModeEnabled: this.devModeEnabled,
            isMappingReady: false,  // 🆕 v1.1.0
            siteId
        });
        
        this.updateCoverStatus(false, null);
        
        // NavigationController.goHome() 호출
        if (goHome) {
            goHome();
        }
        
        // 🆕 v1.1.0: 모드 버튼 상태 업데이트
        this._updateModeButtons();
        
        if (window.sidebarState) {
            window.sidebarState.isConnected = false;
        }
        
        console.log(`[SidebarStateManager] 🔌 Site disconnected: ${siteId}`);
    }
    
    // ========================================
    // Cover Screen Status
    // ========================================
    
    /**
     * Cover Screen 연결 상태 표시 업데이트
     * 
     * @param {boolean} connected - 연결 여부
     * @param {string|null} siteId - 사이트 ID
     */
    updateCoverStatus(connected, siteId) {
        const apiDot = document.getElementById('cover-api-dot');
        const apiStatus = document.getElementById('cover-api-status');
        const dbDot = document.getElementById('cover-db-dot');
        const dbStatus = document.getElementById('cover-db-status');
        
        const dotClass = connected ? COVER_CSS.CONNECTED : COVER_CSS.DISCONNECTED;
        const statusText = connected ? 'Connected' : 'Disconnected';
        
        if (apiDot) {
            apiDot.className = `${COVER_CSS.STATUS_DOT} ${dotClass}`;
        }
        if (apiStatus) {
            apiStatus.textContent = statusText;
        }
        if (dbDot) {
            dbDot.className = `${COVER_CSS.STATUS_DOT} ${dotClass}`;
        }
        
        if (dbStatus) {
            if (connected && siteId) {
                const site = this.getSiteById(siteId);
                dbStatus.textContent = site?.name || siteId;
            } else {
                dbStatus.textContent = 'Not Connected';
            }
        }
    }
    
    // ========================================
    // Bulk State Getters
    // ========================================
    
    /**
     * 현재 상태 객체 반환
     * 🔧 v1.1.0: isMappingReady, connectedSiteId 추가
     * 
     * @returns {Object} 상태 객체
     */
    getState() {
        return {
            isConnected: this.isConnected,
            devModeEnabled: this.devModeEnabled,
            currentTheme: this.currentTheme,
            // 🆕 v1.1.0: Mapping 상태 추가
            isMappingReady: this.isMappingReady,
            connectedSiteId: this.connectedSiteId,
            mappingInfo: this.currentMappingInfo
        };
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.eventBus = null;
        this.toast = null;
        this.connectionModalManager = null;
        this.modeIndicatorPanel = null;
        this.getSiteById = null;
        this.submenuFns = {};
        this._onStateChange = null;
        
        // 🆕 v1.1.0: 매핑 상태 초기화
        this.isMappingReady = false;
        this.connectedSiteId = null;
        this.currentMappingInfo = null;
        
        console.log('[SidebarStateManager] 🗑️ 정리 완료');
    }
}

// ============================================
// Default Export
// ============================================

export default SidebarStateManager;