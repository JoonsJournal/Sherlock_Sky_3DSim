/**
 * ModeToggler.js
 * ===============
 * 모드 토글 함수 모음
 * 
 * @version 1.0.0
 * @description
 * - 7개 토글 함수 포함
 * - NavigationController 연동
 * - AppModeManager 상태 관리
 * - window.* 전역 노출 지원
 * 
 * @changelog
 * - v1.0.0: Phase 5 - main.js에서 분리 (2026-01-25)
 *           - toggleEditMode() 이동
 *           - toggleMonitoringMode() 이동
 *           - toggleConnectionModal() 이동
 *           - toggleDebugPanel() 이동
 *           - openEquipmentEditModal() 이동
 *           - toggleDevMode() 이동
 *           - toggleFullscreen() 이동
 *           - toggleAdaptivePerformance() 이동
 *           - ⚠️ 호환성: window.* 전역 노출 100% 유지
 * 
 * @dependencies
 * - bootstrap/index.js (appModeManager, APP_MODE, toggleDebugPanel)
 * - core/navigation/index.js (navigationController, NAV_MODE, panelManager)
 * - app/index.js (services, canAccessFeatures)
 * - ./ModeIndicator.js (updateModeIndicator, updateButtonState)
 * 
 * @exports
 * - toggleEditMode, toggleMonitoringMode, toggleConnectionModal
 * - toggleDebugPanel, openEquipmentEditModal, toggleDevMode
 * - toggleFullscreen, toggleAdaptivePerformance
 * - setSidebarUIRef, exposeTogglersToWindow
 * 
 * 📁 위치: frontend/threejs_viewer/src/modes/ModeToggler.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// Imports
// ============================================

// Bootstrap
import {
    appModeManager,
    APP_MODE,
    toggleDebugPanel as bootstrapToggleDebugPanel
} from '../bootstrap/index.js';

// Navigation
import { 
    navigationController, 
    NAV_MODE,
    panelManager
} from '../core/navigation/index.js';

// App State & Utils
import { 
    services,
    canAccessFeatures 
} from '../app/index.js';

// Local
import { updateModeIndicator, updateButtonState } from './ModeIndicator.js';

// ============================================
// 모듈 내부 상태 (sidebarUI 참조)
// ============================================

/**
 * sidebarUI 참조 (main.js에서 설정)
 * @type {Object|null}
 */
let _sidebarUIRef = null;

/**
 * screenManager 참조 (main.js에서 설정)
 * @type {Object|null}
 */
let _screenManagerRef = null;

/**
 * sidebarUI 참조 설정
 * main.js의 initSidebarUI() 이후 호출 필요
 * 
 * @param {Object} sidebarUI - createSidebarUI() 반환값
 */
export function setSidebarUIRef(sidebarUI) {
    _sidebarUIRef = sidebarUI;
    console.log('[ModeToggler] ✅ sidebarUI 참조 설정됨');
}

/**
 * screenManager 참조 설정
 * 
 * @param {Object} screenManager - sceneController 인스턴스
 */
export function setScreenManagerRef(screenManager) {
    _screenManagerRef = screenManager;
    console.log('[ModeToggler] ✅ screenManager 참조 설정됨');
}

// ============================================
// 토글 함수들
// ============================================

/**
 * Equipment Edit 모드 토글
 * 
 * @version 7.0.0
 * @description NavigationController 연동 (Edit 모드는 3D View 위에서 동작)
 */
export function toggleEditMode() {
    if (!canAccessFeatures()) {
        window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    // AppModeManager 토글 (Edit 모드는 오버레이 성격)
    appModeManager.toggleMode(APP_MODE.EQUIPMENT_EDIT);
    
    const currentMode = appModeManager.getCurrentMode();
    const screenManager = _screenManagerRef || window.screenManager;
    
    if (currentMode === APP_MODE.EQUIPMENT_EDIT) {
        // 3D View가 필요하면 NavigationController로 전환
        if (screenManager && !screenManager.threejsInitialized) {
            console.log('[toggleEditMode] 3D View 필요 → NavigationController.navigate');
            navigationController.navigate(NAV_MODE.MONITORING, '3d-view');
        }
        updateModeIndicator('Edit', 'Equipment');
    } else {
        updateModeIndicator(null, null);
    }
}

/**
 * Monitoring 모드 토글
 * 
 * @version 7.0.0
 * @description NavigationController 사용으로 단순화
 * 
 * @param {string} [submode='3d-view'] - 서브모드 ('3d-view' | 'ranking-view')
 */
export function toggleMonitoringMode(submode = '3d-view') {
    // 접근 권한 체크
    if (!canAccessFeatures()) {
        window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    console.log(`[toggleMonitoringMode] 🧭 NavigationController.toggle: monitoring/${submode}`);
    
    // ✅ NavigationController가 모든 것을 처리
    navigationController.toggle(NAV_MODE.MONITORING, submode);
}

/**
 * Connection Modal 토글
 */
export function toggleConnectionModal() {
    // 기존 ConnectionModal 사용 (services.ui)
    if (services.ui?.connectionModal) {
        services.ui.connectionModal.toggle();
    }
    
    // 새 Connection Modal (Sidebar.js가 생성)
    const modal = document.getElementById('connection-modal');
    if (modal) {
        modal.classList.toggle('active');
    }
}

/**
 * Debug Panel 토글
 */
export function toggleDebugPanel() {
    if (!canAccessFeatures()) {
        window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    bootstrapToggleDebugPanel();
    
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
        debugPanel.classList.toggle('active');
        if (window.sidebarState) {
            window.sidebarState.debugPanelVisible = debugPanel.classList.contains('active');
        }
    }
}

/**
 * Equipment Edit Modal 열기 (Equipment Mapping 모드 진입)
 */
export async function openEquipmentEditModal() {
    // 접근 권한 체크
    if (!canAccessFeatures()) {
        window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        return;
    }
    
    console.log('[openEquipmentEditModal] 🛠️ Equipment Mapping 모드 진입');
    
    const screenManager = _screenManagerRef || window.screenManager;
    
    // 1. 3D View가 필요하면 먼저 초기화
    if (screenManager && !screenManager.threejsInitialized) {
        console.log('[openEquipmentEditModal] 3D View 초기화 필요');
        navigationController.navigate(NAV_MODE.MONITORING, '3d-view');
    }
    
    // 2. switchMode() 사용 (async)
    const currentMode = appModeManager.getCurrentMode();
    if (currentMode !== APP_MODE.EQUIPMENT_EDIT) {
        await appModeManager.switchMode(APP_MODE.EQUIPMENT_EDIT);
        console.log('[openEquipmentEditModal] ✅ APP_MODE → equipment_edit');
    }
    
    // 3. PanelManager 모드 동기화
    panelManager.setCurrentMode('monitoring', '3d-view');
    
    // 4. ModeIndicator 업데이트
    updateModeIndicator('Edit', 'Equipment Mapping');
    
    // 5. Toast 알림
    window.showToast?.('🛠️ Equipment Mapping Mode - 설비를 클릭하세요', 'info');
    
    console.log('[openEquipmentEditModal] ✅ Equipment Mapping 모드 활성화 완료');
}

/**
 * Dev Mode 토글 (하위 호환용)
 */
export function toggleDevMode() {
    const sidebarUI = _sidebarUIRef;
    
    // Sidebar.js 인스턴스가 있으면 위임
    if (sidebarUI?.sidebar) {
        sidebarUI.sidebar.toggleDevMode();
        // 전역 상태 동기화
        if (window.sidebarState) {
            window.sidebarState.devModeEnabled = sidebarUI.sidebar.getDevModeEnabled();
        }
    } else {
        // 폴백: 직접 처리
        if (window.sidebarState) {
            window.sidebarState.devModeEnabled = !window.sidebarState.devModeEnabled;
        }
        const devModeEnabled = window.sidebarState?.devModeEnabled || false;
        
        const devModeBadge = document.getElementById('dev-mode-badge');
        if (devModeBadge) {
            devModeBadge.classList.toggle('active', devModeEnabled);
        }
        
        const devModeLabel = document.getElementById('dev-mode-label') || document.getElementById('dev-mode-toggle');
        if (devModeLabel) {
            const labelSpan = devModeLabel.querySelector('span') || devModeLabel;
            if (labelSpan.tagName === 'SPAN') {
                labelSpan.textContent = `Dev Mode: ${devModeEnabled ? 'ON' : 'OFF'}`;
            } else {
                devModeLabel.textContent = `Dev Mode: ${devModeEnabled ? 'ON' : 'OFF'}`;
            }
        }
        
        const mockTestSection = document.getElementById('mock-test-section');
        if (mockTestSection) {
            mockTestSection.style.display = devModeEnabled ? 'block' : 'none';
        }
        
        const layoutWrapper = document.getElementById('btn-layout-wrapper');
        if (layoutWrapper) {
            if (devModeEnabled) {
                layoutWrapper.classList.remove('hidden');
                layoutWrapper.classList.remove('disabled');
            } else {
                layoutWrapper.classList.add('hidden');
            }
        }
        
        if (devModeEnabled) {
            _enableSidebarIcons();
            window.showToast?.('⚡ Dev Mode ON', 'warning');
        } else {
            if (!window.sidebarState?.isConnected) {
                _disableSidebarIcons();
            }
            window.showToast?.('Dev Mode OFF', 'info');
        }
    }
    
    console.log(`⚡ Dev Mode: ${window.sidebarState?.devModeEnabled ? 'ON' : 'OFF'}`);
}

/**
 * 전체화면 토글
 */
export function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

/**
 * AdaptivePerformance ON/OFF 토글
 * 
 * @returns {boolean|false} 새 상태 또는 실패 시 false
 */
export function toggleAdaptivePerformance() {
    const adaptivePerformance = services.scene?.adaptivePerformance;
    
    if (!adaptivePerformance) {
        console.warn('⚠️ AdaptivePerformance가 초기화되지 않았습니다');
        window.showToast?.('AdaptivePerformance 미초기화', 'warning');
        return false;
    }
    
    if (!adaptivePerformance.enabled) {
        console.warn('⚠️ AdaptivePerformance가 Feature Flag로 비활성화되어 있습니다');
        window.showToast?.('AdaptivePerformance Feature Flag 비활성화', 'warning');
        return false;
    }
    
    const newState = !adaptivePerformance.adjustmentEnabled;
    adaptivePerformance.setEnabled(newState);
    
    updateButtonState('adaptiveBtn', newState);
    
    if (newState) {
        window.showToast?.('✅ AdaptivePerformance ON', 'success');
    } else {
        window.showToast?.('🛑 AdaptivePerformance OFF', 'info');
    }
    
    return newState;
}

// ============================================
// 내부 헬퍼 함수 (toggleDevMode용)
// ============================================

/**
 * Sidebar 아이콘 활성화
 * @private
 */
function _enableSidebarIcons() {
    const sidebarUI = _sidebarUIRef;
    
    if (sidebarUI?.sidebar) {
        sidebarUI.sidebar._updateButtonStates?.();
        return;
    }
    
    // 폴백
    const icons = ['btn-monitoring', 'btn-analysis', 'btn-simulation'];
    const wrappers = ['btn-monitoring-wrapper', 'btn-debug-wrapper'];
    
    icons.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('disabled');
    });
    
    wrappers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('disabled');
    });
    
    const debugBtn = document.getElementById('btn-debug');
    if (debugBtn) debugBtn.classList.remove('disabled');
    
    if (window.sidebarState?.devModeEnabled) {
        const layoutWrapper = document.getElementById('btn-layout-wrapper');
        const layoutBtn = document.getElementById('btn-layout');
        if (layoutWrapper) {
            layoutWrapper.classList.remove('hidden');
            layoutWrapper.classList.remove('disabled');
        }
        if (layoutBtn) layoutBtn.classList.remove('disabled');
    }
}

/**
 * Sidebar 아이콘 비활성화
 * @private
 */
function _disableSidebarIcons() {
    const sidebarUI = _sidebarUIRef;
    
    if (sidebarUI?.sidebar) {
        sidebarUI.sidebar._updateButtonStates?.();
        return;
    }
    
    // 폴백
    const icons = ['btn-monitoring', 'btn-analysis', 'btn-simulation', 'btn-layout'];
    const wrappers = ['btn-monitoring-wrapper', 'btn-layout-wrapper'];
    
    icons.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('disabled');
    });
    
    wrappers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('disabled');
    });
    
    if (!window.sidebarState?.devModeEnabled) {
        const debugWrapper = document.getElementById('btn-debug-wrapper');
        const debugBtn = document.getElementById('btn-debug');
        if (debugWrapper) debugWrapper.classList.add('disabled');
        if (debugBtn) debugBtn.classList.add('disabled');
    }
    
    document.querySelectorAll('#sidebar .icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// ============================================
// 전역 노출 함수
// ============================================

/**
 * 토글 함수들을 window.*에 노출
 * main.js에서 호출
 */
export function exposeTogglersToWindow() {
    window.toggleConnectionModal = toggleConnectionModal;
    window.toggleDebugPanel = toggleDebugPanel;
    window.toggleDevMode = toggleDevMode;
    
    console.log('[ModeToggler] ✅ window.* 전역 노출 완료');
}

// ============================================
// Debug
// ============================================

/**
 * ModeToggler 디버그 정보 출력
 */
export function debugModeToggler() {
    console.group('🔀 ModeToggler Debug (v1.0.0)');
    console.log('sidebarUI ref:', !!_sidebarUIRef);
    console.log('screenManager ref:', !!_screenManagerRef);
    console.log('Current App Mode:', appModeManager?.getCurrentMode() || 'N/A');
    console.log('Exported Functions:', [
        'toggleEditMode',
        'toggleMonitoringMode',
        'toggleConnectionModal',
        'toggleDebugPanel',
        'openEquipmentEditModal',
        'toggleDevMode',
        'toggleFullscreen',
        'toggleAdaptivePerformance'
    ]);
    console.groupEnd();
}