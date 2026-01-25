/**
 * SidebarViewManager.js
 * =====================
 * Sidebar View 전환 및 관리 모듈
 * 
 * @version 1.0.0
 * @created 2026-01-25
 * @modified 2026-01-25
 * 
 * @description
 * Sidebar.js에서 분리된 View 관리 전용 클래스
 * - 3D View, Analysis View, Cover Screen 전환
 * - ModeIndicator 업데이트
 * - ViewManager 연동
 * 
 * @changelog
 * - v1.0.0: 초기 버전 (Sidebar.js v1.13.0에서 분리)
 *           - _show3DView, _showAnalysisView, _hideAnalysisView 이동
 *           - _hideAllViews, showCoverScreen 이동
 *           - _prepareViewSwitch, _handleLegacySubmode 이동
 *           - _updateModeIndicator, _updateOverlayUI 이동
 * 
 * @dependencies
 * - viewManager from '../../bootstrap/ViewBootstrap.js'
 * 
 * @exports
 * - SidebarViewManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/sidebar/managers/SidebarViewManager.js
 */

// ============================================
// CSS 클래스 상수
// ============================================

/**
 * View 관련 CSS 클래스 상수
 * @constant
 */
export const VIEW_CSS = {
    // Container Classes
    THREEJS_CONTAINER: 'threejs-container',
    ANALYSIS_CONTAINER: 'analysis-container',
    COVER_SCREEN: 'cover-screen',
    OVERLAY_UI: 'overlay-ui',
    CAMERA_NAVIGATOR: 'camera-navigator',
    
    // State Classes
    ACTIVE: 'active',
    HIDDEN: 'hidden',
    
    // Legacy aliases (하위 호환)
    LEGACY_ACTIVE: 'active',
    LEGACY_HIDDEN: 'hidden'
};

// ============================================
// SidebarViewManager Class
// ============================================

/**
 * Sidebar View 관리 클래스
 * 
 * @class SidebarViewManager
 * @description View 전환, ModeIndicator 업데이트 등 View 관련 로직 담당
 * 
 * @example
 * const viewManager = new SidebarViewManager({
 *     modeIndicatorPanel: this.modeIndicatorPanel,
 *     eventBus: this.eventBus,
 *     viewManagerInstance: viewManager
 * });
 * 
 * viewManager.show3DView();
 * viewManager.showAnalysisView();
 */
export class SidebarViewManager {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.modeIndicatorPanel - ModeIndicatorPanel 인스턴스
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {Object} options.viewManagerInstance - ViewBootstrap의 viewManager
     */
    constructor(options = {}) {
        this.modeIndicatorPanel = options.modeIndicatorPanel || null;
        this.eventBus = options.eventBus || null;
        this.viewManagerInstance = options.viewManagerInstance || null;
        
        // 현재 모드 상태 참조 (Sidebar에서 주입)
        this._getCurrentMode = options.getCurrentMode || (() => null);
        this._getCurrentSubMode = options.getCurrentSubMode || (() => null);
        
        console.log('[SidebarViewManager] 초기화 완료 v1.0.0');
    }
    
    // ========================================
    // DOM Element Getters
    // ========================================
    
    /**
     * @private
     * @returns {HTMLElement|null}
     */
    _getThreejsContainer() {
        return document.getElementById('threejs-container');
    }
    
    /**
     * @private
     * @returns {HTMLElement|null}
     */
    _getAnalysisContainer() {
        return document.getElementById('analysis-container');
    }
    
    /**
     * @private
     * @returns {HTMLElement|null}
     */
    _getCoverScreen() {
        return document.getElementById('cover-screen');
    }
    
    /**
     * @private
     * @returns {HTMLElement|null}
     */
    _getOverlayUI() {
        return document.getElementById('overlay-ui');
    }
    
    /**
     * @private
     * @returns {HTMLElement|null}
     */
    _getCameraNavigator() {
        return document.getElementById('camera-navigator');
    }
    
    // ========================================
    // View Display Methods
    // ========================================
    
    /**
     * 3D View 표시
     * Three.js 컨테이너 활성화, 기타 컨테이너 숨김
     */
    show3DView() {
        const coverScreen = this._getCoverScreen();
        const threejsContainer = this._getThreejsContainer();
        const overlayUI = this._getOverlayUI();
        const analysisContainer = this._getAnalysisContainer();
        const cameraNav = this._getCameraNavigator();
        
        // Cover Screen 숨김
        if (coverScreen) {
            coverScreen.classList.add(VIEW_CSS.HIDDEN);
        }
        
        // Three.js 컨테이너 활성화
        if (threejsContainer) {
            threejsContainer.classList.add(VIEW_CSS.ACTIVE);
            threejsContainer.style.display = '';
        }
        
        // Overlay UI 숨김
        if (overlayUI) {
            overlayUI.style.display = 'none';
        }
        
        // Analysis 컨테이너 숨김
        if (analysisContainer) {
            analysisContainer.classList.add(VIEW_CSS.HIDDEN);
        }
        
        // CameraNavigator 표시
        if (cameraNav) {
            cameraNav.style.display = '';
        }
        
        // ModeIndicator 표시
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.show();
        }
        
        // Three.js 재개 이벤트
        if (this.eventBus) {
            this.eventBus.emit('threejs:show-requested');
        }
        
        console.log('[SidebarViewManager] 📺 3D View 표시');
    }
    
    /**
     * Analysis View 표시
     * Analysis 컨테이너 활성화, Three.js 숨김
     */
    showAnalysisView() {
        const coverScreen = this._getCoverScreen();
        const threejsContainer = this._getThreejsContainer();
        const overlayUI = this._getOverlayUI();
        const analysisContainer = this._getAnalysisContainer();
        
        // Cover Screen 숨김
        if (coverScreen) {
            coverScreen.classList.add(VIEW_CSS.HIDDEN);
        }
        
        // Three.js 컨테이너 비활성화
        if (threejsContainer) {
            threejsContainer.classList.remove(VIEW_CSS.ACTIVE);
        }
        
        // Overlay UI 숨김
        if (overlayUI) {
            overlayUI.style.display = 'none';
        }
        
        // Analysis 컨테이너 표시
        if (analysisContainer) {
            analysisContainer.classList.remove(VIEW_CSS.HIDDEN);
        }
        
        // ModeIndicator 표시
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.show();
        }
        
        console.log('[SidebarViewManager] 📊 Analysis View 표시');
    }
    
    /**
     * Analysis View 숨김
     */
    hideAnalysisView() {
        const analysisContainer = this._getAnalysisContainer();
        if (analysisContainer) {
            analysisContainer.classList.add(VIEW_CSS.HIDDEN);
        }
        
        console.log('[SidebarViewManager] 📊 Analysis View 숨김');
    }
    
    /**
     * 모든 View 숨김
     */
    hideAllViews() {
        const coverScreen = this._getCoverScreen();
        const threejsContainer = this._getThreejsContainer();
        const overlayUI = this._getOverlayUI();
        const analysisContainer = this._getAnalysisContainer();
        
        if (coverScreen) {
            coverScreen.classList.add(VIEW_CSS.HIDDEN);
        }
        if (threejsContainer) {
            threejsContainer.classList.remove(VIEW_CSS.ACTIVE);
        }
        if (overlayUI) {
            overlayUI.style.display = 'none';
        }
        if (analysisContainer) {
            analysisContainer.classList.add(VIEW_CSS.HIDDEN);
        }
        
        // ModeIndicator는 유지
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.show();
        }
        
        console.log('[SidebarViewManager] 🔲 모든 View 숨김');
    }
    
    /**
     * Cover Screen 표시
     * Three.js 정지, 모든 컨테이너 숨김
     */
    showCoverScreen() {
        const coverScreen = this._getCoverScreen();
        const threejsContainer = this._getThreejsContainer();
        const overlayUI = this._getOverlayUI();
        const analysisContainer = this._getAnalysisContainer();
        
        // Cover Screen 표시
        if (coverScreen) {
            coverScreen.classList.remove(VIEW_CSS.HIDDEN);
        }
        
        // 다른 컨테이너들 숨김
        if (threejsContainer) {
            threejsContainer.classList.remove(VIEW_CSS.ACTIVE);
        }
        if (overlayUI) {
            overlayUI.style.display = 'none';
        }
        if (analysisContainer) {
            analysisContainer.classList.add(VIEW_CSS.HIDDEN);
        }
        
        // ModeIndicator 숨김
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.hide();
        }
        
        // Three.js 정지 이벤트
        if (this.eventBus) {
            this.eventBus.emit('threejs:stop-requested');
        }
        
        console.log('[SidebarViewManager] 🖼️ Cover Screen 표시');
    }
    
    // ========================================
    // View Switch Preparation
    // ========================================
    
    /**
     * View 전환 준비 (ViewManager 연동)
     * 다른 View/컨테이너 숨김 처리
     * 
     * @param {string} targetSubmode - 전환할 submode ID
     */
    prepareViewSwitch(targetSubmode) {
        console.log(`[SidebarViewManager] 🔄 View 전환 준비: ${targetSubmode}`);
        
        const threejsContainer = this._getThreejsContainer();
        const cameraNav = this._getCameraNavigator();
        const analysisContainer = this._getAnalysisContainer();
        const coverScreen = this._getCoverScreen();
        
        // Three.js 컨테이너 숨김
        if (threejsContainer) {
            threejsContainer.classList.remove(VIEW_CSS.ACTIVE);
            threejsContainer.style.display = 'none';
        }
        
        // CameraNavigator 숨김
        if (cameraNav) {
            cameraNav.style.display = 'none';
        }
        
        // Analysis 컨테이너 숨김
        if (analysisContainer) {
            analysisContainer.classList.add(VIEW_CSS.HIDDEN);
        }
        
        // Cover Screen 숨김
        if (coverScreen) {
            coverScreen.classList.add(VIEW_CSS.HIDDEN);
        }
        
        // 3D Rendering 일시 정지 이벤트
        if (this.eventBus) {
            this.eventBus.emit('threejs:pause-requested');
        }
    }
    
    /**
     * 기존 submode 처리 (ViewManager가 관리하지 않는 View)
     * 
     * @param {string} submode - submode ID
     */
    handleLegacySubmode(submode) {
        console.log(`[SidebarViewManager] 📦 Legacy submode 처리: ${submode}`);
        
        switch (submode) {
            case '3d-view':
                this.show3DView();
                break;
                
            case 'layout-editor':
            case 'mapping':
                // Layout 모드 처리 (별도 로직 필요 시 추가)
                break;
                
            default:
                console.warn(`[SidebarViewManager] ⚠️ Unknown legacy submode: ${submode}`);
        }
    }
    
    // ========================================
    // Mode Indicator
    // ========================================
    
    /**
     * ModeIndicator 업데이트
     * 
     * @param {string|null} mode - 현재 모드
     * @param {string|null} subMode - 현재 서브모드
     */
    updateModeIndicator(mode = null, subMode = null) {
        const currentMode = mode ?? this._getCurrentMode();
        const currentSubMode = subMode ?? this._getCurrentSubMode();
        
        if (this.modeIndicatorPanel) {
            this.modeIndicatorPanel.setMode(currentMode, currentSubMode);
        }
        
        // Global state 업데이트 (하위 호환)
        if (window.sidebarState) {
            window.sidebarState.currentMode = currentMode;
            window.sidebarState.currentSubMode = currentSubMode;
        }
    }
    
    /**
     * Overlay UI 업데이트
     * @deprecated ModeIndicator와 통합됨
     */
    updateOverlayUI() {
        this.updateModeIndicator();
    }
    
    // ========================================
    // ViewManager Integration
    // ========================================
    
    /**
     * ViewManager를 통한 View 표시
     * 
     * @param {string} viewId - View ID
     */
    showViewByManager(viewId) {
        if (this.viewManagerInstance && this.viewManagerInstance.has(viewId)) {
            this.prepareViewSwitch(viewId);
            this.viewManagerInstance.show(viewId);
            console.log(`[SidebarViewManager] 🎯 ViewManager.show('${viewId}')`);
        } else {
            this.handleLegacySubmode(viewId);
        }
    }
    
    /**
     * ViewManager를 통한 View 숨김
     * 
     * @param {string} viewId - View ID
     */
    hideViewByManager(viewId) {
        if (this.viewManagerInstance && this.viewManagerInstance.has(viewId)) {
            this.viewManagerInstance.hide(viewId);
            console.log(`[SidebarViewManager] 🎯 ViewManager.hide('${viewId}')`);
        }
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.modeIndicatorPanel = null;
        this.eventBus = null;
        this.viewManagerInstance = null;
        this._getCurrentMode = null;
        this._getCurrentSubMode = null;
        
        console.log('[SidebarViewManager] 🗑️ 정리 완료');
    }
}

// ============================================
// Default Export
// ============================================

export default SidebarViewManager;