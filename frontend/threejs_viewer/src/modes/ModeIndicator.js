/**
 * ModeIndicator.js
 * =================
 * 모드 표시 UI 업데이트 함수
 * 
 * @version 1.0.0
 * @description
 * - updateModeIndicator: Mode Indicator 패널 업데이트
 * - updateButtonState: 버튼 active 상태 토글
 * - sidebarState와 동기화
 * 
 * @changelog
 * - v1.0.0: Phase 5 - main.js에서 분리 (2026-01-25)
 *           - updateModeIndicator() 이동
 *           - updateButtonState() 이동
 *           - ⚠️ 호환성: window.sidebarState 동기화 유지
 * 
 * @dependencies
 * - window.sidebarState (전역 상태)
 * 
 * @exports
 * - updateModeIndicator
 * - updateButtonState
 * 
 * 📁 위치: frontend/threejs_viewer/src/modes/ModeIndicator.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// Mode Indicator 업데이트
// ============================================

/**
 * Mode Indicator UI 업데이트
 * 
 * @param {string|null} mode - 현재 모드 (예: 'Edit', 'Monitoring')
 * @param {string|null} submode - 서브모드 (예: '3d-view', 'ranking-view')
 */
export function updateModeIndicator(mode, submode) {
    const modeValue = document.getElementById('current-mode');
    const submodeValue = document.getElementById('current-submode');
    
    if (modeValue) {
        modeValue.textContent = mode 
            ? (mode.charAt(0).toUpperCase() + mode.slice(1)) 
            : '—';
    }
    
    if (submodeValue) {
        submodeValue.textContent = submode 
            ? `→ ${submode === '3d-view' ? '3D View' : submode}` 
            : '';
    }
    
    // sidebarState 동기화
    if (window.sidebarState) {
        window.sidebarState.currentMode = mode;
        window.sidebarState.currentSubMode = submode;
    }
}

/**
 * 버튼 상태 업데이트 헬퍼
 * 
 * @param {string} btnId - 버튼 DOM ID
 * @param {boolean} isActive - 활성 상태 여부
 */
export function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.toggle('active', isActive);
    }
}

// ============================================
// Debug
// ============================================

/**
 * ModeIndicator 디버그 정보 출력
 */
export function debugModeIndicator() {
    console.group('🎯 ModeIndicator Debug (v1.0.0)');
    console.log('Current Mode:', window.sidebarState?.currentMode || 'N/A');
    console.log('Current SubMode:', window.sidebarState?.currentSubMode || 'N/A');
    console.log('DOM Elements:', {
        'current-mode': !!document.getElementById('current-mode'),
        'current-submode': !!document.getElementById('current-submode')
    });
    console.groupEnd();
}