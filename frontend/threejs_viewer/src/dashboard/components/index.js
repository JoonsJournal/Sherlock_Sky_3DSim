/**
 * index.js
 * ===========
 * Dashboard Module Entry Point
 * 
 * @version 1.1.0
 * @description
 * Dashboard 모듈의 진입점
 * - 모든 컴포넌트를 초기화하고 export
 * - DOM Ready 시 자동 초기화
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 * - v1.0.1 (2026-02-03): 가이드라인 준수, 에러 표시 CSS 클래스 사용
 * - v1.1.0 (2026-02-03): 누락된 컴포넌트 및 서비스 추가
 *   - SummaryFooter, GlobalAlertBanner 추가
 *   - SiteSummaryService, ModeTransition 추가
 *   - ⚠️ 호환성: 기존 export 100% 유지
 * 
 * @dependencies
 * - DashboardManager.js: Dashboard 관리자
 * - SiteCard.js: Site Card 컴포넌트
 * - SummaryFooter.js: Footer 컴포넌트
 * - GlobalAlertBanner.js: Alert Banner 컴포넌트
 * - SiteSummaryService.js: API 서비스
 * - ModeTransition.js: Mode 전환 서비스
 * - DashboardState.js: 상태 관리
 * 
 * @exports
 * - SiteCard: Site Card 컴포넌트
 * - SummaryFooter: Footer 컴포넌트
 * - GlobalAlertBanner: Alert Banner 컴포넌트
 * - SiteSummaryService: API 서비스
 * - ModeTransition: Mode 전환 서비스
 * - DashboardState: 상태 관리 클래스
 * - DashboardManager: Dashboard 관리자
 * - dashboardInstance: 싱글톤 인스턴스
 * 
 * 📁 위치: frontend/threejs_viewer/src/dashboard/components/index.js
 * 작성일: 2026-02-03
 * 수정일: 2026-02-03
 */

// =========================================================
// Components
// =========================================================

export { SiteCard } from './SiteCard.js';
export { SummaryFooter } from './SummaryFooter.js';
export { GlobalAlertBanner, AlertLevel } from './GlobalAlertBanner.js';

// =========================================================
// Services
// =========================================================

export { 
    SiteSummaryService, 
    getSiteSummaryService 
} from '../services/SiteSummaryService.js';

export { 
    ModeTransition, 
    getModeTransition,
    ModeType,
    ActionType 
} from '../services/ModeTransition.js';

// =========================================================
// State
// =========================================================

export { 
    DashboardState, 
    getDashboardState,
    StateEvents,
    SiteReadiness,
    SiteStatus
} from '../DashboardState.js';

// =========================================================
// Manager
// =========================================================

export { DashboardManager } from './DashboardManager.js';

// =========================================================
// CSS Class Constants (가이드라인 준수)
// =========================================================

/** @type {Object} 공통 CSS 클래스 상수 - BEM 규칙 적용 */
const CSS = {
    // Error State
    ERROR_CONTAINER: 'dashboard-error',
    ERROR_ICON: 'dashboard-error__icon',
    ERROR_TITLE: 'dashboard-error__title',
    ERROR_MESSAGE: 'dashboard-error__message',
    ERROR_BUTTON: 'dashboard-error__button',
    
    // Loading State
    LOADING: 'dashboard-loading',
    LOADING_SPINNER: 'dashboard-loading__spinner',
    LOADING_TEXT: 'dashboard-loading__text',
    
    // Layout
    LAYOUT: 'dashboard-layout',
    HEADER: 'dashboard-header',
    MAIN: 'dashboard-main',
    FOOTER: 'dashboard-footer',
    
    // Toast Container
    TOAST_CONTAINER: 'toast-container',
    
    // Hidden
    HIDDEN: 'hidden'
};

// Export CSS constants
export { CSS as DashboardCSS };

// =========================================================
// Auto Initialization
// =========================================================

import { DashboardManager } from './DashboardManager.js';

let dashboardInstance = null;

/**
 * Dashboard 초기화
 */
async function initDashboard() {
    try {
        console.log('🚀 Dashboard 초기화 시작...');
        
        const cardsContainer = document.getElementById('site-cards-container');
        if (!cardsContainer) {
            console.error('❌ site-cards-container 요소를 찾을 수 없습니다.');
            return;
        }
        
        dashboardInstance = new DashboardManager('site-cards-container');
        await dashboardInstance.init();
        
        // 전역 접근용 (디버깅)
        window.dashboard = dashboardInstance;
        
        console.log('✅ Dashboard 초기화 완료');
        
    } catch (error) {
        console.error('❌ Dashboard 초기화 실패:', error);
        showInitError(error);
    }
}

/**
 * 초기화 에러 표시 (CSS 클래스 사용)
 * @param {Error} error
 */
function showInitError(error) {
    const loading = document.getElementById('dashboard-loading');
    if (loading) {
        loading.innerHTML = `
            <div class="${CSS.ERROR_CONTAINER}">
                <div class="${CSS.ERROR_ICON}">⚠️</div>
                <h3 class="${CSS.ERROR_TITLE}">Dashboard 초기화 실패</h3>
                <p class="${CSS.ERROR_MESSAGE}">
                    ${error.message || '알 수 없는 오류'}
                </p>
                <button class="${CSS.ERROR_BUTTON}" onclick="location.reload()">
                    🔄 새로고침
                </button>
            </div>
        `;
    }
}

// DOM Ready 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

export { dashboardInstance };

// =========================================================
// Default Export
// =========================================================

export default {
    // Components
    SiteCard: () => import('./SiteCard.js').then(m => m.SiteCard),
    SummaryFooter: () => import('./SummaryFooter.js').then(m => m.SummaryFooter),
    GlobalAlertBanner: () => import('./GlobalAlertBanner.js').then(m => m.GlobalAlertBanner),
    DashboardManager: () => import('./DashboardManager.js').then(m => m.DashboardManager),
    
    // Services
    SiteSummaryService: () => import('../services/SiteSummaryService.js').then(m => m.SiteSummaryService),
    ModeTransition: () => import('../services/ModeTransition.js').then(m => m.ModeTransition),
    
    // State
    DashboardState: () => import('../DashboardState.js').then(m => m.DashboardState),
    
    // Utilities
    CSS,
    dashboardInstance
};