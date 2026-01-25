/**
 * DrawerAnimationManager.js
 * =========================
 * Drawer Hybrid 애니메이션 관리 모듈
 * 
 * @version 1.0.0
 * @description
 * - Drawer 열기/닫기 Hybrid 애니메이션 관리
 * - Legacy 패널 모드 지원
 * - 3D Viewer 리사이즈 트리거
 * - 애니메이션 상태 관리
 * 
 * @changelog
 * - v1.0.0: EquipmentInfoPanel.js에서 분리
 *           - _showDrawerHybrid, _hideDrawerHybrid 이동
 *           - _showLegacy, _hideLegacy 이동
 *           - _triggerResize 이동
 *           - ⚠️ 호환성: 기존 애니메이션 동작 100% 유지
 * 
 * @dependencies
 * - ./constants/PanelCSSConstants.js
 * - ../../../core/utils/Config.js (debugLog)
 * 
 * @exports
 * - DrawerAnimationManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/managers/DrawerAnimationManager.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

import { debugLog } from '../../../core/utils/Config.js';
import { PANEL_CSS, PANEL_ANIMATION } from '../constants/PanelCSSConstants.js';

/**
 * Drawer 애니메이션 매니저 클래스
 * 
 * @example
 * const animator = new DrawerAnimationManager(panelEl);
 * animator.show();  // Drawer 열기
 * animator.hide();  // Drawer 닫기
 */
export class DrawerAnimationManager {
    /**
     * @param {HTMLElement} panelEl - 패널 DOM 요소
     * @param {Object} [options={}] - 옵션
     * @param {Function} [options.onShowComplete] - 열기 완료 콜백
     * @param {Function} [options.onHideComplete] - 닫기 완료 콜백
     */
    constructor(panelEl, options = {}) {
        /**
         * 패널 DOM 요소
         * @type {HTMLElement}
         */
        this.panelEl = panelEl;
        
        /**
         * 콜백 옵션
         * @type {Object}
         */
        this.callbacks = {
            onShowComplete: options.onShowComplete || null,
            onHideComplete: options.onHideComplete || null
        };
        
        /**
         * 애니메이션 상태
         * @type {Object}
         */
        this.state = {
            isAnimating: false,
            isVisible: false
        };
        
        /**
         * 애니메이션 타임아웃 ID
         * @type {number|null}
         */
        this._animationTimeout = null;
        
        /**
         * Drawer 모드 여부 (CSS 클래스로 판단)
         * @type {boolean}
         */
        this._isDrawerMode = this.panelEl?.classList.contains(PANEL_CSS.DRAWER) || false;
        
        debugLog(`📊 DrawerAnimationManager initialized (drawerMode: ${this._isDrawerMode})`);
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    /**
     * 패널/Drawer 표시
     * @returns {boolean} 애니메이션 시작 여부
     */
    show() {
        // 애니메이션 중이면 무시
        if (this.state.isAnimating) {
            debugLog('⚠️ 애니메이션 진행 중 - show() 무시');
            return false;
        }
        
        // 이미 표시 중이면 클래스만 업데이트
        if (this.state.isVisible) {
            this._removeLoadingState();
            return false;
        }
        
        // 모드에 따라 분기
        if (this._isDrawerMode) {
            this._showDrawerHybrid();
        } else {
            this._showLegacy();
        }
        
        return true;
    }
    
    /**
     * 패널/Drawer 숨기기
     * @returns {boolean} 애니메이션 시작 여부
     */
    hide() {
        // 애니메이션 중이면 무시
        if (this.state.isAnimating) {
            debugLog('⚠️ 애니메이션 진행 중 - hide() 무시');
            return false;
        }
        
        if (!this.state.isVisible) {
            return false;
        }
        
        // 모드에 따라 분기
        if (this._isDrawerMode) {
            this._hideDrawerHybrid();
        } else {
            this._hideLegacy();
        }
        
        return true;
    }
    
    /**
     * 로딩 상태 표시
     */
    showLoading() {
        this.panelEl?.classList.add(PANEL_CSS.LOADING);
        
        if (this._isDrawerMode) {
            this.panelEl?.classList.add(PANEL_CSS.DRAWER_LOADING);
        }
    }
    
    /**
     * 애니메이션 진행 중 여부
     * @returns {boolean}
     */
    isAnimating() {
        return this.state.isAnimating;
    }
    
    /**
     * 현재 표시 상태
     * @returns {boolean}
     */
    isVisible() {
        return this.state.isVisible;
    }
    
    /**
     * Drawer 모드 여부
     * @returns {boolean}
     */
    isDrawerMode() {
        return this._isDrawerMode;
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this._clearTimeout();
        this.panelEl = null;
        this.callbacks = null;
        this.state = { isAnimating: false, isVisible: false };
        
        debugLog('📊 DrawerAnimationManager disposed');
    }
    
    // =========================================================================
    // Drawer Hybrid 애니메이션
    // =========================================================================
    
    /**
     * Drawer Hybrid 열기 애니메이션
     * Phase 1: width (0 → drawer-width)
     * Phase 2: transform 정상화
     * @private
     */
    _showDrawerHybrid() {
        this.state.isAnimating = true;
        
        // Phase 1: 열기 시작 (width 애니메이션)
        this.panelEl.classList.add(PANEL_CSS.DRAWER_OPENING);
        
        debugLog('📊 Drawer 열기 Phase 1: width');
        
        // Phase 2: 애니메이션 완료 후 열림 상태로 전환
        this._clearTimeout();
        this._animationTimeout = setTimeout(() => {
            this.panelEl.classList.remove(PANEL_CSS.DRAWER_OPENING);
            this.panelEl.classList.add(PANEL_CSS.DRAWER_OPEN);
            
            // Legacy 클래스도 추가 (하위 호환)
            this.panelEl.classList.add(PANEL_CSS.ACTIVE);
            this.panelEl.classList.add(PANEL_CSS.LEGACY_ACTIVE);
            
            // 로딩 상태 제거
            this._removeLoadingState();
            
            this.state.isVisible = true;
            this.state.isAnimating = false;
            
            debugLog('📊 Drawer 열기 완료');
            
            // 3D Viewer 리사이즈 트리거
            this._triggerResize(true);
            
            // 콜백 호출
            this.callbacks.onShowComplete?.();
            
        }, PANEL_ANIMATION.DURATION);
    }
    
    /**
     * Drawer Hybrid 닫기 애니메이션
     * Phase 1: transform (오른쪽으로 슬라이드)
     * Phase 2: width (0으로 축소)
     * @private
     */
    _hideDrawerHybrid() {
        this.state.isAnimating = true;
        
        // Phase 1: 닫기 시작 (transform 애니메이션)
        this.panelEl.classList.add(PANEL_CSS.DRAWER_CLOSING);
        this.panelEl.classList.remove(PANEL_CSS.DRAWER_OPEN);
        
        debugLog('📊 Drawer 닫기 Phase 1: transform');
        
        // Phase 2: 애니메이션 완료 후 width 0으로
        this._clearTimeout();
        this._animationTimeout = setTimeout(() => {
            this.panelEl.classList.remove(PANEL_CSS.DRAWER_CLOSING);
            
            // Legacy 클래스도 제거
            this.panelEl.classList.remove(PANEL_CSS.ACTIVE);
            this.panelEl.classList.remove(PANEL_CSS.LEGACY_ACTIVE);
            
            this.state.isVisible = false;
            this.state.isAnimating = false;
            
            debugLog('📊 Drawer 닫기 완료');
            
            // 3D Viewer 리사이즈 트리거
            this._triggerResize(false);
            
            // 콜백 호출
            this.callbacks.onHideComplete?.();
            
        }, PANEL_ANIMATION.DURATION);
    }
    
    // =========================================================================
    // Legacy 모드
    // =========================================================================
    
    /**
     * Legacy 모드 표시 (즉시)
     * @private
     */
    _showLegacy() {
        this.panelEl?.classList.add(PANEL_CSS.ACTIVE);
        this.panelEl?.classList.add(PANEL_CSS.LEGACY_ACTIVE);
        this._removeLoadingState();
        
        this.state.isVisible = true;
        
        debugLog('📊 Panel shown (legacy mode)');
        
        // 콜백 호출
        this.callbacks.onShowComplete?.();
    }
    
    /**
     * Legacy 모드 숨기기 (즉시)
     * @private
     */
    _hideLegacy() {
        this.panelEl?.classList.remove(PANEL_CSS.ACTIVE);
        this.panelEl?.classList.remove(PANEL_CSS.LEGACY_ACTIVE);
        
        this.state.isVisible = false;
        
        debugLog('📊 Panel hidden (legacy mode)');
        
        // 콜백 호출
        this.callbacks.onHideComplete?.();
    }
    
    // =========================================================================
    // 헬퍼 메서드
    // =========================================================================
    
    /**
     * 로딩 상태 제거
     * @private
     */
    _removeLoadingState() {
        this.panelEl?.classList.remove(PANEL_CSS.LOADING);
        
        if (this._isDrawerMode) {
            this.panelEl?.classList.remove(PANEL_CSS.DRAWER_LOADING);
        }
    }
    
    /**
     * 타임아웃 정리
     * @private
     */
    _clearTimeout() {
        if (this._animationTimeout) {
            clearTimeout(this._animationTimeout);
            this._animationTimeout = null;
        }
    }
    
    /**
     * 3D Viewer 리사이즈 트리거
     * SceneManager에서 drawer-toggle 이벤트를 수신하여 리사이즈
     * @private
     * @param {boolean} isOpen - Drawer 열림 여부
     */
    _triggerResize(isOpen) {
        // 약간의 지연 후 리사이즈 이벤트 발생 (CSS 전환 완료 대기)
        setTimeout(() => {
            // Custom Event 발생 (SceneManager에서 수신)
            window.dispatchEvent(new CustomEvent('drawer-toggle', {
                detail: { isOpen }
            }));
            
            // window resize 이벤트도 발생 (폴백)
            window.dispatchEvent(new Event('resize'));
            
            debugLog(`📊 리사이즈 트리거 발생 (isOpen: ${isOpen})`);
        }, PANEL_ANIMATION.RESIZE_DELAY);
    }
}

// 기본 내보내기
export default DrawerAnimationManager;
