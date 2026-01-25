/**
 * PanelCSSConstants.js
 * ====================
 * Equipment Info Panel CSS 클래스 상수 모듈
 * 
 * @version 1.0.0
 * @description
 * - BEM 기반 CSS 클래스명 상수 정의
 * - Drawer 모드 클래스 포함
 * - Utility 클래스 상수
 * - Legacy alias 패턴 지원
 * 
 * @changelog
 * - v1.0.0: EquipmentInfoPanel.js에서 분리
 *           - CSS, UTIL, ANIMATION 상수 모듈화
 *           - ⚠️ 호환성: 기존 클래스명 100% 유지
 * 
 * @exports
 * - PANEL_CSS: Panel CSS 클래스 상수
 * - PANEL_UTIL: Utility 클래스 상수
 * - PANEL_ANIMATION: 애니메이션 설정 상수
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/constants/PanelCSSConstants.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

/**
 * BEM 클래스명 상수
 * @constant {Object}
 */
export const PANEL_CSS = {
    // =========================================================================
    // Block - Legacy Panel (하위 호환)
    // =========================================================================
    BLOCK: 'equipment-panel',
    
    // =========================================================================
    // Block Modifiers - Legacy
    // =========================================================================
    ACTIVE: 'equipment-panel--active',
    LOADING: 'equipment-panel--loading',
    HIDDEN: 'equipment-panel--hidden',
    
    // =========================================================================
    // Drawer Block (v5.0.0+)
    // =========================================================================
    DRAWER: 'equipment-drawer',
    
    // =========================================================================
    // Drawer Modifiers (Hybrid Animation)
    // =========================================================================
    DRAWER_OPEN: 'equipment-drawer--open',
    DRAWER_OPENING: 'equipment-drawer--opening',
    DRAWER_CLOSING: 'equipment-drawer--closing',
    DRAWER_LOADING: 'equipment-drawer--loading',
    
    // =========================================================================
    // Elements
    // =========================================================================
    HEADER: 'equipment-panel__header',
    TITLE: 'equipment-panel__title',
    TITLE_MULTI: 'equipment-panel__title--multi',
    CLOSE_BTN: 'equipment-panel__close-btn',
    
    TAB_NAV: 'equipment-panel__tab-nav',
    TAB_BTN: 'equipment-panel__tab-btn',
    TAB_BTN_ACTIVE: 'equipment-panel__tab-btn--active',
    TAB_CONTENT: 'equipment-panel__tab-content',
    TAB_CONTENT_ACTIVE: 'equipment-panel__tab-content--active',
    
    BODY: 'equipment-panel__body',
    SECTION: 'equipment-panel__section',
    
    // =========================================================================
    // Legacy alias (하위 호환)
    // =========================================================================
    LEGACY_ACTIVE: 'active'
};

/**
 * Utility 클래스 상수
 * @constant {Object}
 */
export const PANEL_UTIL = {
    FLEX: 'u-flex',
    FLEX_CENTER: 'u-flex-center',
    GLASS: 'u-glass',
    GLASS_DARK: 'u-glass-dark',
    GLOW: 'u-glow',
    HIDDEN: 'u-hidden',
    SR_ONLY: 'u-sr-only'
};

/**
 * 애니메이션 설정 상수
 * CSS의 --drawer-transition-duration과 일치해야 함
 * @constant {Object}
 */
export const PANEL_ANIMATION = {
    DURATION: 300,      // ms (CSS와 동기화)
    RESIZE_DELAY: 50    // ms (CSS 전환 후 리사이즈 지연)
};

// =========================================================================
// Legacy Export (하위 호환)
// =========================================================================

/**
 * @deprecated EquipmentInfoPanel.CSS 대신 PANEL_CSS 사용 권장
 */
export const CSS = PANEL_CSS;

/**
 * @deprecated EquipmentInfoPanel.UTIL 대신 PANEL_UTIL 사용 권장
 */
export const UTIL = PANEL_UTIL;

/**
 * @deprecated EquipmentInfoPanel.ANIMATION 대신 PANEL_ANIMATION 사용 권장
 */
export const ANIMATION = PANEL_ANIMATION;
