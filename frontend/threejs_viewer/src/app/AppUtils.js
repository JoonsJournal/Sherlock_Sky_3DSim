/**
 * AppUtils.js
 * ===========
 * 애플리케이션 전역 유틸리티 함수 모듈
 * 
 * @version 1.0.0
 * @description
 * - main.js에서 분리된 전역 유틸리티 함수 모듈
 * - HTML onclick 호환 함수들 중앙 관리
 * - Placeholder 함수 생성 헬퍼
 * - window.* 노출 자동화
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 3 - 유틸리티 함수 분리 (2026-01-25)
 *           - _showToast → showToast export
 *           - _toggleTheme → toggleTheme export
 *           - _closeConnectionModal → closeConnectionModal export
 *           - _canAccessFeatures → canAccessFeatures export
 *           - _createPlaceholder → createPlaceholder export
 *           - _createDebugPlaceholder → createDebugPlaceholder export
 *           - exposeUtilsToWindow() 함수 추가
 *           - ⚠️ 호환성: main.js 기존 window.* 참조 100% 유지
 * 
 * @dependencies
 * - ./AppState.js (services, sidebarState)
 * - ../bootstrap/index.js (toast)
 * 
 * @exports
 * - showToast: Toast 알림 표시
 * - toggleTheme: 테마 토글
 * - closeConnectionModal: Connection Modal 닫기
 * - canAccessFeatures: 접근 권한 체크
 * - createPlaceholder: Placeholder 함수 생성
 * - createDebugPlaceholder: Debug Placeholder 생성
 * - exposeUtilsToWindow: window.* 전역 노출
 * 
 * 📁 위치: frontend/threejs_viewer/src/app/AppUtils.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// 의존성 Import
// ============================================
import { services, sidebarState } from './AppState.js';

// ============================================
// 외부 의존성 지연 로드용 변수
// ============================================
// 🔧 Note: 순환 참조 방지를 위해 지연 참조 사용
// bootstrap의 toast는 런타임에 참조

/**
 * toast 모듈 지연 참조
 * @private
 * @returns {Object|null} toast 모듈
 */
function _getToastModule() {
    // window.APP.ui.toast 또는 전역 toast 참조
    return window.APP?.ui?.toast || window.toast || null;
}

/**
 * sidebarUI 지연 참조
 * @private
 * @returns {Object|null} sidebarUI 인스턴스
 */
function _getSidebarUI() {
    return window.sidebarUI || window.APP?.ui?.sidebar?.parent || null;
}

// ============================================
// 유틸리티 함수 정의
// ============================================

/**
 * Toast 알림 표시
 * 
 * @param {string} message - 표시할 메시지
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - 알림 타입
 * 
 * @description
 * HTML onclick에서 직접 호출 가능:
 * onclick="window.showToast('메시지', 'success')"
 * 
 * @example
 * import { showToast } from './app/AppUtils.js';
 * showToast('저장 완료!', 'success');
 * showToast('연결 실패', 'error');
 */
export function showToast(message, type = 'info') {
    // toast 모듈 사용 가능하면 위임
    const toast = _getToastModule();
    if (toast?.show) {
        toast.show(message, type);
        return;
    }
    
    // 폴백: 직접 DOM 생성
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('[AppUtils] toast-container not found, logging to console:', message);
        console.log(`[Toast ${type}] ${message}`);
        return;
    }
    
    const icons = { 
        success: '✅', 
        error: '❌', 
        warning: '⚠️', 
        info: 'ℹ️' 
    };
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.classList.add('toast-hide'); setTimeout(() => this.parentElement.remove(), 300);">×</button>
    `;
    
    container.appendChild(toastEl);
    
    // 애니메이션으로 표시
    requestAnimationFrame(() => toastEl.classList.add('toast-show'));
    
    // 3초 후 자동 숨김
    setTimeout(() => { 
        toastEl.classList.remove('toast-show');
        toastEl.classList.add('toast-hide');
        setTimeout(() => toastEl.remove(), 300); 
    }, 3000);
}

/**
 * 테마 토글 (Light ↔ Dark)
 * 
 * @description
 * HTML onclick에서 직접 호출 가능:
 * onclick="window.toggleTheme()"
 * 
 * 동작:
 * 1. data-theme 속성 전환 (light ↔ dark)
 * 2. localStorage에 저장
 * 3. Theme Switch 버튼 상태 업데이트
 * 4. Sidebar.js 테마 동기화
 * 
 * @example
 * import { toggleTheme } from './app/AppUtils.js';
 * toggleTheme();
 */
export function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // HTML 속성 변경
    html.setAttribute('data-theme', newTheme);
    
    // localStorage에 저장
    try {
        localStorage.setItem('theme', newTheme);
    } catch (e) {
        console.warn('[AppUtils] localStorage 접근 실패:', e);
    }
    
    // Theme Switch 버튼 상태 업데이트
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        themeSwitch.classList.toggle('active', newTheme === 'light');
    }
    
    // Sidebar.js 동기화
    const sidebarUI = _getSidebarUI();
    if (sidebarUI?.sidebar?.setTheme) {
        sidebarUI.sidebar.setTheme(newTheme);
    }
    
    console.log(`🎨 Theme: ${newTheme}`);
}

/**
 * Connection Modal 닫기
 * 
 * @description
 * HTML onclick에서 직접 호출 가능:
 * onclick="window.closeConnectionModal()"
 * 
 * 동작:
 * 1. services.ui.connectionModal.close() 호출 (있으면)
 * 2. DOM에서 active 클래스 제거
 * 
 * @example
 * import { closeConnectionModal } from './app/AppUtils.js';
 * closeConnectionModal();
 */
export function closeConnectionModal() {
    // services.ui 사용 가능하면 위임
    if (services?.ui?.connectionModal?.close) {
        services.ui.connectionModal.close();
        return;
    }
    
    // 폴백: DOM 직접 조작
    const modal = document.getElementById('connection-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * 접근 권한 체크
 * 
 * @returns {boolean} 연결됨 또는 Dev Mode 활성화 여부
 * 
 * @description
 * HTML 조건부 실행에서 사용 가능:
 * onclick="if (window.canAccessFeatures()) { ... }"
 * 
 * 체크 순서:
 * 1. sidebarUI.sidebar 인스턴스 (있으면)
 * 2. window.sidebarState (폴백)
 * 
 * @example
 * import { canAccessFeatures } from './app/AppUtils.js';
 * if (canAccessFeatures()) {
 *     // 기능 접근 가능
 * }
 */
export function canAccessFeatures() {
    // Sidebar.js 인스턴스에서 상태 가져오기 (우선)
    const sidebarUI = _getSidebarUI();
    if (sidebarUI?.sidebar) {
        return sidebarUI.sidebar.getIsConnected() || sidebarUI.sidebar.getDevModeEnabled();
    }
    
    // 폴백: window.sidebarState 또는 import된 sidebarState 사용
    const state = window.sidebarState || sidebarState;
    return state?.isConnected || state?.devModeEnabled || false;
}

// ============================================
// Placeholder 함수 생성 헬퍼
// ============================================

/**
 * Placeholder 함수 생성
 * 
 * @param {string} funcName - 함수 경로 (예: 'fn.camera.moveTo')
 * @returns {Function} placeholder 함수
 * 
 * @description
 * Three.js 의존 함수가 초기화 전에 호출되면 경고 표시
 * 3D View 활성화 후 실제 함수로 교체됨
 * 
 * @example
 * import { createPlaceholder } from './app/AppUtils.js';
 * 
 * // APP.fn에 placeholder 등록
 * registerFn('camera', 'moveTo', createPlaceholder('fn.camera.moveTo'));
 * 
 * // 초기화 전 호출 시 경고 표시
 * APP.fn.camera.moveTo(0, 10, 0);  // → "⚠️ 3D View를 먼저 활성화하세요"
 */
export function createPlaceholder(funcName) {
    return function(...args) {
        const message = `⚠️ APP.${funcName}(): 3D View를 먼저 활성화하세요 (Monitoring → 3D View)`;
        console.warn(message);
        console.warn(`   호출 인자:`, args);
        
        // Toast 알림
        if (window.showToast) {
            window.showToast('3D View를 먼저 활성화하세요', 'warning');
        } else {
            showToast('3D View를 먼저 활성화하세요', 'warning');
        }
        
        return null;
    };
}

/**
 * Debug용 Placeholder (더 상세한 정보 제공)
 * 
 * @param {string} funcName - 함수 이름
 * @returns {Function} placeholder 함수
 * 
 * @description
 * 개발자 디버깅용으로 더 상세한 정보 제공
 * 해결 방법 안내 포함
 * 
 * @example
 * import { createDebugPlaceholder } from './app/AppUtils.js';
 * 
 * registerDebugFn('scene', createDebugPlaceholder('debugScene'));
 */
export function createDebugPlaceholder(funcName) {
    return function(...args) {
        console.group(`⚠️ ${funcName}() - 아직 사용할 수 없음`);
        console.warn('Three.js가 초기화되지 않았습니다.');
        console.warn('해결 방법:');
        console.warn('  1. Dev Mode 활성화 또는 DB 연결');
        console.warn('  2. Monitoring → 3D View 진입');
        console.warn('  3. 다시 이 함수 호출');
        if (args.length > 0) {
            console.warn('전달된 인자:', args);
        }
        console.groupEnd();
        
        // Toast 알림
        if (window.showToast) {
            window.showToast('3D View를 먼저 활성화하세요', 'warning');
        } else {
            showToast('3D View를 먼저 활성화하세요', 'warning');
        }
        
        return null;
    };
}

// ============================================
// window.* 전역 노출
// ============================================

/**
 * 유틸리티 함수들을 window에 노출
 * 
 * @description
 * HTML onclick 속성에서 직접 호출할 수 있도록
 * 주요 유틸리티 함수들을 window 객체에 노출
 * 
 * 노출되는 함수:
 * - window.showToast(message, type)
 * - window.toggleTheme()
 * - window.closeConnectionModal()
 * - window.canAccessFeatures()
 * 
 * @example
 * import { exposeUtilsToWindow } from './app/AppUtils.js';
 * 
 * // main.js 초기화 시 호출
 * exposeUtilsToWindow();
 * 
 * // HTML에서 사용 가능
 * <button onclick="window.showToast('클릭!', 'success')">Toast</button>
 * <button onclick="window.toggleTheme()">테마 변경</button>
 */
export function exposeUtilsToWindow() {
    if (typeof window === 'undefined') {
        console.warn('[AppUtils] 브라우저 환경이 아닙니다.');
        return;
    }
    
    // 하위 호환용 window 노출
    window.showToast = showToast;
    window.toggleTheme = toggleTheme;
    window.closeConnectionModal = closeConnectionModal;
    window.canAccessFeatures = canAccessFeatures;
    
    console.log('✅ [AppUtils] window.* 유틸리티 노출 완료:', [
        'showToast',
        'toggleTheme', 
        'closeConnectionModal',
        'canAccessFeatures'
    ]);
}

// ============================================
// 즉시 실행: 브라우저 환경에서 자동 노출
// ============================================

/**
 * 모듈 로드 시 자동으로 window.* 노출
 * main.js에서 import만 해도 바로 사용 가능
 */
if (typeof window !== 'undefined') {
    // 즉시 노출 (init() 전에 기본 기능 보장)
    exposeUtilsToWindow();
}

// ============================================
// APP 네임스페이스 등록 헬퍼
// ============================================

/**
 * APP.fn.ui에 유틸리티 함수 등록
 * 
 * @param {Function} registerFn - AppNamespace의 registerFn 함수
 * 
 * @description
 * main.js에서 initNamespace() 후 호출하여
 * APP.fn.ui에 유틸리티 함수들을 등록
 * 
 * 등록되는 함수:
 * - APP.fn.ui.showToast (= window.showToast)
 * - APP.fn.ui.toggleTheme (= window.toggleTheme)
 * - APP.fn.ui.closeConnectionModal (= window.closeConnectionModal)
 * - APP.fn.ui.canAccessFeatures (= window.canAccessFeatures)
 * 
 * @example
 * import { registerUtilsToNamespace } from './app/AppUtils.js';
 * import { registerFn } from './core/AppNamespace.js';
 * 
 * // main.js에서 호출
 * registerUtilsToNamespace(registerFn);
 */
export function registerUtilsToNamespace(registerFn) {
    if (typeof registerFn !== 'function') {
        console.warn('[AppUtils] registerFn이 함수가 아닙니다.');
        return;
    }
    
    // UI 유틸리티 함수 등록
    registerFn('ui', 'showToast', showToast, 'showToast');
    registerFn('ui', 'toggleTheme', toggleTheme, 'toggleTheme');
    registerFn('ui', 'closeConnectionModal', closeConnectionModal, 'closeConnectionModal');
    registerFn('ui', 'canAccessFeatures', canAccessFeatures, 'canAccessFeatures');
    
    console.log('✅ [AppUtils] APP.fn.ui 유틸리티 등록 완료');
}

/**
 * APP.fn에 Placeholder 함수 등록
 * 
 * @param {Function} registerFn - AppNamespace의 registerFn 함수
 * @param {Function} registerDebugFn - AppNamespace의 registerDebugFn 함수
 * 
 * @description
 * Three.js 초기화 전 Placeholder 함수들을 APP.fn에 등록
 * 3D View 초기화 후 실제 함수로 교체됨
 * 
 * 등록되는 Placeholder:
 * - APP.fn.camera.moveTo
 * - APP.fn.camera.focusEquipment
 * - APP.fn.camera.reset
 * - APP.fn.mapping.getStatus
 * - APP.fn.mapping.clearAll
 * - APP.fn.mapping.export
 * - APP.fn.layout.applyTest
 * - APP.fn.layout.testRoomResize
 * - APP.debugFn.help
 * - APP.debugFn.scene
 * - APP.debugFn.listEquipments
 * - APP.debugFn.status
 * 
 * @example
 * import { registerPlaceholdersToNamespace } from './app/AppUtils.js';
 * import { registerFn, registerDebugFn } from './core/AppNamespace.js';
 * 
 * // main.js에서 호출 (initNamespace() 후)
 * registerPlaceholdersToNamespace(registerFn, registerDebugFn);
 */
export function registerPlaceholdersToNamespace(registerFn, registerDebugFn) {
    if (typeof registerFn !== 'function') {
        console.warn('[AppUtils] registerFn이 함수가 아닙니다.');
        return;
    }
    
    // Camera 함수 (placeholder)
    registerFn('camera', 'moveTo', createPlaceholder('fn.camera.moveTo'), 'moveCameraTo');
    registerFn('camera', 'focusEquipment', createPlaceholder('fn.camera.focusEquipment'), 'focusEquipment');
    registerFn('camera', 'reset', createPlaceholder('fn.camera.reset'), 'resetCamera');
    
    // Mapping 함수 (placeholder)
    registerFn('mapping', 'getStatus', createPlaceholder('fn.mapping.getStatus'), 'getMappingStatus');
    registerFn('mapping', 'clearAll', createPlaceholder('fn.mapping.clearAll'), 'clearAllMappings');
    registerFn('mapping', 'export', createPlaceholder('fn.mapping.export'), 'exportMappings');
    
    // Layout 함수 (placeholder)
    registerFn('layout', 'applyTest', createPlaceholder('fn.layout.applyTest'), 'applyTestLayout');
    registerFn('layout', 'testRoomResize', createPlaceholder('fn.layout.testRoomResize'), 'testRoomResize');
    
    console.log('✅ [AppUtils] Placeholder 함수 등록 완료 (fn.camera, fn.mapping, fn.layout)');
    
    // Debug 함수 (placeholder)
    if (typeof registerDebugFn === 'function') {
        registerDebugFn('help', createDebugPlaceholder('debugHelp'), 'debugHelp');
        registerDebugFn('scene', createDebugPlaceholder('debugScene'), 'debugScene');
        registerDebugFn('listEquipments', createDebugPlaceholder('listEquipments'), 'listEquipments');
        registerDebugFn('status', createDebugPlaceholder('debugStatus'), 'debugStatus');
        
        console.log('✅ [AppUtils] Debug Placeholder 함수 등록 완료 (debugFn)');
    }
    
    console.log('     → 3D View 초기화 후 실제 함수로 교체됩니다');
}

// ============================================
// 디버그 함수
// ============================================

/**
 * AppUtils 디버그 정보 출력
 * 
 * @example
 * import { debugAppUtils } from './app/AppUtils.js';
 * debugAppUtils();
 */
export function debugAppUtils() {
    console.group('🔧 AppUtils Debug (v1.0.0)');
    
    console.log('📦 유틸리티 함수:');
    console.log('  showToast:', typeof showToast);
    console.log('  toggleTheme:', typeof toggleTheme);
    console.log('  closeConnectionModal:', typeof closeConnectionModal);
    console.log('  canAccessFeatures:', typeof canAccessFeatures);
    
    console.log('\n📦 Placeholder 생성 함수:');
    console.log('  createPlaceholder:', typeof createPlaceholder);
    console.log('  createDebugPlaceholder:', typeof createDebugPlaceholder);
    
    console.log('\n🌐 window 노출 상태:');
    if (typeof window !== 'undefined') {
        console.log('  window.showToast:', window.showToast === showToast ? '✅' : '❌');
        console.log('  window.toggleTheme:', window.toggleTheme === toggleTheme ? '✅' : '❌');
        console.log('  window.closeConnectionModal:', window.closeConnectionModal === closeConnectionModal ? '✅' : '❌');
        console.log('  window.canAccessFeatures:', window.canAccessFeatures === canAccessFeatures ? '✅' : '❌');
    } else {
        console.log('  (브라우저 환경 아님)');
    }
    
    console.log('\n🔌 의존성 상태:');
    console.log('  services:', services ? '✅' : '❌');
    console.log('  sidebarState:', sidebarState ? '✅' : '❌');
    console.log('  toast module:', _getToastModule() ? '✅' : '❌ (폴백 사용)');
    console.log('  sidebarUI:', _getSidebarUI() ? '✅' : '❌ (폴백 사용)');
    
    console.groupEnd();
}