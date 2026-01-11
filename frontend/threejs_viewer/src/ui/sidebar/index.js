/**
 * index.js
 * ========
 * Cleanroom Sidebar UI 모듈 통합 export
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * 
 * 사용법:
 *   import { Sidebar, StatusBar, CoverScreen, ICONS, getIcon } from './ui/sidebar/index.js';
 * 
 *   // 또는 createSidebarUI 헬퍼 사용
 *   import { createSidebarUI } from './ui/sidebar/index.js';
 *   const ui = createSidebarUI({ appModeManager, eventBus, ... });
 * 
 * 파일 구조:
 *   src/ui/sidebar/
 *   ├── index.js           # 이 파일
 *   ├── Sidebar.js         # 메인 사이드바 컴포넌트
 *   ├── StatusBar.js       # 하단 상태바 컴포넌트
 *   ├── CoverScreen.js     # 커버 스크린 컴포넌트
 *   └── IconRegistry.js    # SVG 아이콘 레지스트리
 */

// ============================================
// Component Exports
// ============================================

export { Sidebar, default as SidebarDefault } from './Sidebar.js';
export { StatusBar, default as StatusBarDefault } from './StatusBar.js';
export { CoverScreen, default as CoverScreenDefault } from './CoverScreen.js';

// ============================================
// Icon Registry Exports
// ============================================

export { 
    ICONS, 
    getIcon, 
    getIconList, 
    hasIcon 
} from './IconRegistry.js';

// ============================================
// Helper Functions
// ============================================

// Re-import for factory function (ESM compatible)
import { Sidebar } from './Sidebar.js';
import { StatusBar } from './StatusBar.js';
import { CoverScreen } from './CoverScreen.js';

/**
 * Sidebar UI 시스템 통합 생성 헬퍼
 * main.js에서 간편하게 사용 가능
 * 
 * @param {Object} options - 설정 옵션
 * @param {Object} options.appModeManager - AppModeManager 인스턴스
 * @param {Object} options.eventBus - EventBus 인스턴스
 * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
 * @param {Object} options.performanceMonitor - PerformanceMonitor 인스턴스
 * @param {Object} options.toast - Toast 인스턴스
 * @param {Object} options.APP_MODE - APP_MODE 상수
 * @param {Object} options.callbacks - 콜백 함수들
 * @param {string} options.siteId - 현재 사이트 ID
 * @param {string} options.countryCode - 국가 코드 (기본: KR)
 * @param {boolean} options.createStatusBar - StatusBar 생성 여부 (기본: true)
 * @param {boolean} options.createCoverScreen - CoverScreen 생성 여부 (기본: true)
 * 
 * @returns {Object} { sidebar, statusBar, coverScreen, destroy }
 * 
 * @example
 * import { createSidebarUI } from './ui/sidebar/index.js';
 * 
 * const ui = createSidebarUI({
 *     appModeManager,
 *     eventBus,
 *     connectionStatusService,
 *     toast,
 *     APP_MODE,
 *     callbacks: {
 *         toggleConnectionModal,
 *         toggleDebugPanel,
 *         openEquipmentEditModal
 *     }
 * });
 * 
 * // 나중에 정리
 * ui.destroy();
 */
export function createSidebarUI(options = {}) {
    const {
        appModeManager,
        eventBus,
        connectionStatusService,
        performanceMonitor,
        toast,
        APP_MODE,
        callbacks,
        siteId,
        countryCode = 'KR',
        createStatusBar: shouldCreateStatusBar = true,
        createCoverScreen: shouldCreateCoverScreen = true
    } = options;
    
    // 결과 객체
    const result = {
        sidebar: null,
        statusBar: null,
        coverScreen: null
    };
    
    // 1. CoverScreen 생성 (가장 먼저)
    if (shouldCreateCoverScreen) {
        result.coverScreen = new CoverScreen({
            connectionStatusService,
            eventBus
        });
    }
    
    // 2. Sidebar 생성
    result.sidebar = new Sidebar({
        appModeManager,
        eventBus,
        connectionStatusService,
        toast,
        APP_MODE,
        callbacks
    });
    
    // 3. StatusBar 생성
    if (shouldCreateStatusBar) {
        result.statusBar = new StatusBar({
            connectionStatusService,
            performanceMonitor,
            eventBus,
            siteId,
            countryCode
        });
    }
    
    // 4. 정리 함수
    result.destroy = function() {
        if (result.sidebar) {
            result.sidebar.destroy();
            result.sidebar = null;
        }
        if (result.statusBar) {
            result.statusBar.destroy();
            result.statusBar = null;
        }
        if (result.coverScreen) {
            result.coverScreen.destroy();
            result.coverScreen = null;
        }
        console.log('[SidebarUI] 전체 정리 완료');
    };
    
    console.log('[SidebarUI] 초기화 완료:', {
        sidebar: !!result.sidebar,
        statusBar: !!result.statusBar,
        coverScreen: !!result.coverScreen
    });
    
    return result;
}

/**
 * ESM 환경용 async 버전
 * (dynamic import 사용)
 */
export async function createSidebarUIAsync(options = {}) {
    const {
        appModeManager,
        eventBus,
        connectionStatusService,
        performanceMonitor,
        toast,
        APP_MODE,
        callbacks,
        siteId,
        countryCode = 'KR',
        createStatusBar = true,
        createCoverScreen = true
    } = options;
    
    // 동적 import
    const [
        { Sidebar },
        { StatusBar },
        { CoverScreen }
    ] = await Promise.all([
        import('./Sidebar.js'),
        import('./StatusBar.js'),
        import('./CoverScreen.js')
    ]);
    
    const result = {
        sidebar: null,
        statusBar: null,
        coverScreen: null
    };
    
    // 1. CoverScreen 생성
    if (createCoverScreen) {
        result.coverScreen = new CoverScreen({
            connectionStatusService,
            eventBus
        });
    }
    
    // 2. Sidebar 생성
    result.sidebar = new Sidebar({
        appModeManager,
        eventBus,
        connectionStatusService,
        toast,
        APP_MODE,
        callbacks
    });
    
    // 3. StatusBar 생성
    if (createStatusBar) {
        result.statusBar = new StatusBar({
            connectionStatusService,
            performanceMonitor,
            eventBus,
            siteId,
            countryCode
        });
    }
    
    // 4. 정리 함수
    result.destroy = function() {
        if (result.sidebar) {
            result.sidebar.destroy();
            result.sidebar = null;
        }
        if (result.statusBar) {
            result.statusBar.destroy();
            result.statusBar = null;
        }
        if (result.coverScreen) {
            result.coverScreen.destroy();
            result.coverScreen = null;
        }
        console.log('[SidebarUI] 전체 정리 완료');
    };
    
    console.log('[SidebarUI] Async 초기화 완료');
    
    return result;
}

// ============================================
// Version Info
// ============================================

export const VERSION = '1.0.0';
export const SOURCE = 'test_sidebar_standalone.html v2.10';

// ============================================
// Re-export for convenience
// ============================================

// Note: Use named imports for tree-shaking support
// import { Sidebar, StatusBar, CoverScreen, createSidebarUI } from './ui/sidebar/index.js';