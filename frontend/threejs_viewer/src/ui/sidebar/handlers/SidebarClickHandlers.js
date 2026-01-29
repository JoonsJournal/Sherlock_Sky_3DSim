/**
 * SidebarClickHandlers.js
 * =======================
 * Sidebar 버튼/서브메뉴 클릭 핸들러 모듈
 * 
 * @version 1.1.0
 * @created 2026-01-25
 * @modified 2026-01-29
 * 
 * @description
 * Sidebar.js에서 분리된 Click Handler 전용 클래스
 * - 버튼 클릭 처리 (_handleButtonClick)
 * - 서브메뉴 클릭 처리 (_handleSubmenuClick)
 * - NavigationController 통합
 * - 모드 매핑 유틸리티
 * - 🆕 Monitoring 모드 진입 시 매핑 체크
 * 
 * @changelog
 * - v1.1.0: 🆕 Mapping Check 로직 추가 (2026-01-29)
 *           - _checkMappingBeforeModeSwitch() 메서드 추가
 *           - _handleModeClick()에 매핑 체크 로직 적용
 *           - 매핑 미완료 시 경고 Toast 표시
 *           - ⚠️ 호환성: 기존 모든 API/메서드 100% 유지
 * - v1.0.0: 초기 버전 (Sidebar.js v1.13.0에서 분리)
 *           - _handleButtonClick 이동
 *           - _handleSubmenuClick 이동
 *           - _getParentModeForSubmode 이동 (static)
 *           - _mapToNavMode, _navModeToSidebarMode 이동 (static)
 * 
 * @dependencies
 * - navigationController from '../../core/navigation/index.js'
 * - NAV_MODE from '../../core/navigation/index.js'
 * - SIDEBAR_BUTTONS from './SidebarConfig.js'
 * 
 * @exports
 * - SidebarClickHandlers
 * - getParentModeForSubmode (static)
 * - mapToNavMode (static)
 * - navModeToSidebarMode (static)
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/handlers/SidebarClickHandlers.js
 */

// ============================================
// Mode Mapping Constants
// ============================================

/**
 * 서브모드 → 부모 모드 매핑
 * @constant
 */
export const SUBMODE_TO_PARENT = {
    // Monitoring 서브모드
    '3d-view': 'monitoring',
    'ranking-view': 'monitoring',
    
    // Layout 서브모드
    'layout-editor': 'layout',
    'mapping': 'layout',
    
    // Analysis 서브모드
    'dashboard': 'analysis',
    'heatmap': 'analysis',
    'trend': 'analysis'
};

/**
 * Sidebar 모드 → NAV_MODE 매핑
 * @constant
 */
export const SIDEBAR_TO_NAV_MODE = {
    'monitoring': 'monitoring',     // NAV_MODE.MONITORING
    'analysis': 'analysis',         // NAV_MODE.ANALYSIS
    'layout': 'layout',             // NAV_MODE.LAYOUT
    'simulation': 'simulation',     // NAV_MODE.SIMULATION
    'settings': 'settings'          // NAV_MODE.SETTINGS
};

/**
 * NAV_MODE → Sidebar 모드 역매핑
 * @constant
 */
export const NAV_TO_SIDEBAR_MODE = {
    'main_viewer': null,
    'monitoring': 'monitoring',
    'analysis': 'analysis',
    'layout': 'layout',
    'simulation': 'simulation',
    'settings': 'settings'
};

/**
 * 🆕 v1.1.0: 매핑 필수 모드 목록
 * @constant
 */
export const MAPPING_REQUIRED_MODES = ['monitoring'];

// ============================================
// Static Mapping Functions
// ============================================

/**
 * 서브모드 → 부모 모드 매핑
 * 
 * @param {string} submode - 서브모드 ID
 * @returns {string|null} 부모 모드 ID
 * 
 * @example
 * getParentModeForSubmode('3d-view');  // 'monitoring'
 * getParentModeForSubmode('dashboard'); // 'analysis'
 */
export function getParentModeForSubmode(submode) {
    return SUBMODE_TO_PARENT[submode] || null;
}

/**
 * Sidebar 모드 → NAV_MODE 매핑
 * 
 * @param {string} sidebarMode - Sidebar 내부 모드 이름
 * @returns {string} NAV_MODE 값
 * 
 * @example
 * mapToNavMode('monitoring'); // NAV_MODE.MONITORING
 */
export function mapToNavMode(sidebarMode) {
    return SIDEBAR_TO_NAV_MODE[sidebarMode] || 'main_viewer';
}

/**
 * NAV_MODE → Sidebar 모드 역매핑
 * 
 * @param {string} navMode - NAV_MODE 값
 * @returns {string|null} Sidebar 내부 모드 이름
 * 
 * @example
 * navModeToSidebarMode('monitoring'); // 'monitoring'
 * navModeToSidebarMode('main_viewer'); // null
 */
export function navModeToSidebarMode(navMode) {
    return NAV_TO_SIDEBAR_MODE[navMode] || null;
}

// ============================================
// SidebarClickHandlers Class
// ============================================

/**
 * Sidebar Click Handler 클래스
 * 
 * @class SidebarClickHandlers
 * @description 버튼/서브메뉴 클릭 이벤트 처리
 * 
 * @example
 * const handlers = new SidebarClickHandlers({
 *     sidebar: this,
 *     navigationController: navigationController,
 *     NAV_MODE: NAV_MODE,
 *     callbacks: this.callbacks,
 *     toast: this.toast,
 *     stateManager: this.stateManager  // 🆕 v1.1.0
 * });
 * 
 * handlers.handleButtonClick('monitoring', event);
 */
export class SidebarClickHandlers {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.sidebar - Sidebar 인스턴스 참조
     * @param {Object} options.navigationController - NavigationController 인스턴스
     * @param {Object} options.NAV_MODE - NAV_MODE 상수 객체
     * @param {Object} options.callbacks - 콜백 함수 객체
     * @param {Object} options.toast - Toast 알림 인스턴스
     * @param {Object} options.buttonsConfig - SIDEBAR_BUTTONS 설정
     * @param {Object} options.stateManager - SidebarStateManager 인스턴스 (🆕 v1.1.0)
     */
    constructor(options = {}) {
        this.sidebar = options.sidebar || null;
        this.navigationController = options.navigationController || null;
        this.NAV_MODE = options.NAV_MODE || {};
        this.callbacks = options.callbacks || {};
        this.toast = options.toast || null;
        this.buttonsConfig = options.buttonsConfig || {};
        
        // 🆕 v1.1.0: SidebarStateManager 참조
        this.stateManager = options.stateManager || null;
        
        // Sidebar 메서드 참조 (위임 패턴)
        this._selectButton = options.selectButton || (() => {});
        this._toggleConnectionModal = options.toggleConnectionModal || (() => {});
        
        console.log('[SidebarClickHandlers] 초기화 완료 v1.1.0 (Mapping Check 지원)');
    }
    
    // ========================================
    // Button Click Handler
    // ========================================
    
    /**
     * 버튼 클릭 핸들러
     * 
     * @param {string} key - 버튼 키 (connection, monitoring, analysis, etc.)
     * @param {Event} event - 클릭 이벤트
     * @param {HTMLElement} button - 클릭된 버튼 요소
     * 
     * @example
     * handleButtonClick('monitoring', event, btnElement);
     */
    handleButtonClick(key, event, button) {
        const config = this.buttonsConfig[key];
        if (!config) {
            console.warn(`[SidebarClickHandlers] ⚠️ Unknown button key: ${key}`);
            return;
        }
        
        // 비활성화 버튼 무시
        if (button?.classList.contains('disabled')) {
            return;
        }
        
        switch (key) {
            case 'connection':
                this._handleConnectionClick();
                break;
                
            case 'monitoring':
                this._handleModeClick(key, this.NAV_MODE?.MONITORING || 'monitoring');
                break;
            
            case 'analysis':
                this._handleModeClick(key, this.NAV_MODE?.ANALYSIS || 'analysis');
                break;
                
            case 'layout':
                this._handleModeClick(key, this.NAV_MODE?.LAYOUT || 'layout');
                break;
                
            case 'simulation':
                this._handleSimulationClick(config);
                break;
                
            case 'debug':
            case 'settings':
                // 서브메뉴가 있는 버튼 - 클릭 시 별도 처리 없음 (hover로 서브메뉴 표시)
                break;
                
            default:
                console.log(`[SidebarClickHandlers] 📌 Button clicked: ${key}`);
        }
    }
    
    /**
     * @private
     * Connection 버튼 클릭 처리
     */
    _handleConnectionClick() {
        if (this._toggleConnectionModal) {
            this._toggleConnectionModal();
        }
    }
    
    /**
     * @private
     * 모드 버튼 클릭 처리 (NavigationController 통합)
     * 🔧 v1.1.0: 매핑 체크 로직 추가
     * 
     * @param {string} key - 버튼 키
     * @param {string} navMode - NAV_MODE 값
     */
    _handleModeClick(key, navMode) {
        // 🆕 v1.1.0: 매핑 체크 (Monitoring 모드인 경우)
        const mappingCheckResult = this._checkMappingBeforeModeSwitch(key);
        
        // 매핑 미완료 경고 (진입은 허용하되 경고 표시)
        if (mappingCheckResult.showWarning && this.toast) {
            this.toast.warning(
                'Mapping Not Complete',
                'Equipment mapping is not configured. Some features may be limited.'
            );
        }
        
        this._selectButton(key);
        
        console.log(`[SidebarClickHandlers] 🧭 NavigationController.toggle: ${key}${mappingCheckResult.showWarning ? ' (⚠️ Mapping Warning)' : ''}`);
        
        if (this.navigationController) {
            this.navigationController.toggle(navMode);
        }
    }
    
    /**
     * 🆕 v1.1.0: 모드 전환 전 매핑 체크
     * @private
     * 
     * @param {string} key - 버튼 키
     * @returns {Object} { canProceed: boolean, showWarning: boolean }
     */
    _checkMappingBeforeModeSwitch(key) {
        // 매핑 필수 모드가 아니면 통과
        if (!MAPPING_REQUIRED_MODES.includes(key)) {
            return { canProceed: true, showWarning: false };
        }
        
        // StateManager가 없으면 통과 (하위 호환)
        if (!this.stateManager) {
            return { canProceed: true, showWarning: false };
        }
        
        // Dev Mode이면 통과 (Mock 모드에서는 매핑 체크 안 함)
        if (this.stateManager.isDevModeEnabled()) {
            return { canProceed: true, showWarning: false };
        }
        
        // 연결 안 됨 → 진행 (연결 모달에서 처리)
        if (!this.stateManager.getIsConnected()) {
            return { canProceed: true, showWarning: false };
        }
        
        // 매핑 준비 완료 → 통과
        if (this.stateManager.getMappingReady()) {
            return { canProceed: true, showWarning: false };
        }
        
        // 매핑 미완료 → 경고와 함께 진행 허용
        // (차단하지 않고 경고만 표시 - UX 개선)
        console.log(`[SidebarClickHandlers] ⚠️ 매핑 미완료 상태에서 ${key} 모드 진입 시도`);
        
        return { canProceed: true, showWarning: true };
    }
    
    /**
     * @private
     * Simulation 버튼 클릭 처리 (Coming Soon)
     * 
     * @param {Object} config - 버튼 설정
     */
    _handleSimulationClick(config) {
        if (this.toast) {
            this.toast.info('Coming Soon', `${config.mode} mode is under development`);
        }
    }
    
    // ========================================
    // Submenu Click Handler
    // ========================================
    
    /**
     * 서브메뉴 클릭 핸들러
     * 
     * @param {Object} item - 서브메뉴 아이템 설정
     * @param {string} item.action - 실행할 액션 이름
     * @param {Array} item.params - 액션 파라미터
     * @param {string} item.submode - 서브모드 ID
     * 
     * @example
     * handleSubmenuClick({ submode: '3d-view' });
     * handleSubmenuClick({ action: 'toggleDebugPanel' });
     */
    handleSubmenuClick(item) {
        // ════════════════════════════════════════════════════════════════
        // 1. Action 처리 (callback 함수 실행)
        // ════════════════════════════════════════════════════════════════
        if (item.action) {
            const handled = this._handleAction(item);
            if (handled) return;
        }
        
        // ════════════════════════════════════════════════════════════════
        // 2. Submode 처리 → NavigationController 위임
        // ════════════════════════════════════════════════════════════════
        if (item.submode) {
            this._handleSubmodeNavigation(item.submode);
        }
    }
    
    /**
     * @private
     * Action 콜백 처리
     * 
     * @param {Object} item - 서브메뉴 아이템
     * @returns {boolean} 처리 여부
     */
    _handleAction(item) {
        const { action, params } = item;
        
        // 1. callbacks 객체에서 찾기
        const callback = this.callbacks[action];
        if (callback && typeof callback === 'function') {
            if (params) {
                callback(...params);
            } else {
                callback();
            }
            return true;
        }
        
        // 2. sidebar 인스턴스 메서드에서 찾기
        if (this.sidebar && typeof this.sidebar[action] === 'function') {
            this.sidebar[action](...(params || []));
            return true;
        }
        
        // 3. sidebar 인스턴스 private 메서드에서 찾기
        const privateMethod = `_${action}`;
        if (this.sidebar && typeof this.sidebar[privateMethod] === 'function') {
            this.sidebar[privateMethod](...(params || []));
            return true;
        }
        
        console.warn(`[SidebarClickHandlers] ⚠️ Action not found: ${action}`);
        return false;
    }
    
    /**
     * @private
     * Submode 네비게이션 처리
     * 🔧 v1.1.0: 매핑 체크 로직 추가
     * 
     * @param {string} submode - 서브모드 ID
     */
    _handleSubmodeNavigation(submode) {
        const parentMode = getParentModeForSubmode(submode);
        const navMode = mapToNavMode(parentMode);
        
        // 🆕 v1.1.0: 매핑 체크 (부모 모드 기준)
        if (parentMode) {
            const mappingCheckResult = this._checkMappingBeforeModeSwitch(parentMode);
            
            if (mappingCheckResult.showWarning && this.toast) {
                this.toast.warning(
                    'Mapping Not Complete',
                    'Equipment mapping is not configured. Some features may be limited.'
                );
            }
        }
        
        console.log(`[SidebarClickHandlers] 🧭 NavigationController.navigate: ${navMode}/${submode}`);
        
        // NavigationController가 모든 것을 처리
        if (this.navigationController) {
            this.navigationController.navigate(navMode, submode);
        }
        
        // UI 상태 동기화 (UX 향상을 위해 즉시 반영)
        if (parentMode) {
            this._selectButton(parentMode);
        }
    }
    
    // ========================================
    // 🆕 v1.1.0: Mapping Status Helpers
    // ========================================
    
    /**
     * 🆕 v1.1.0: 매핑 상태 확인 (외부 호출용)
     * @returns {boolean}
     */
    isMappingRequired(mode) {
        return MAPPING_REQUIRED_MODES.includes(mode);
    }
    
    /**
     * 🆕 v1.1.0: StateManager 설정 (지연 초기화 지원)
     * @param {Object} stateManager - SidebarStateManager 인스턴스
     */
    setStateManager(stateManager) {
        this.stateManager = stateManager;
        console.log('[SidebarClickHandlers] 📊 StateManager 연결됨');
    }
    
    // ========================================
    // Static Method Aliases (하위 호환)
    // ========================================
    
    /**
     * 서브모드 → 부모 모드 매핑 (인스턴스 메서드)
     * @param {string} submode
     * @returns {string|null}
     */
    getParentModeForSubmode(submode) {
        return getParentModeForSubmode(submode);
    }
    
    /**
     * Sidebar 모드 → NAV_MODE 매핑 (인스턴스 메서드)
     * @param {string} sidebarMode
     * @returns {string}
     */
    mapToNavMode(sidebarMode) {
        return mapToNavMode(sidebarMode);
    }
    
    /**
     * NAV_MODE → Sidebar 모드 역매핑 (인스턴스 메서드)
     * @param {string} navMode
     * @returns {string|null}
     */
    navModeToSidebarMode(navMode) {
        return navModeToSidebarMode(navMode);
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.sidebar = null;
        this.navigationController = null;
        this.NAV_MODE = null;
        this.callbacks = null;
        this.toast = null;
        this.buttonsConfig = null;
        this.stateManager = null;  // 🆕 v1.1.0
        this._selectButton = null;
        this._toggleConnectionModal = null;
        
        console.log('[SidebarClickHandlers] 🗑️ 정리 완료');
    }
}

// ============================================
// Default Export
// ============================================

export default SidebarClickHandlers;