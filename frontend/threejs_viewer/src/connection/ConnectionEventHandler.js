/**
 * ConnectionEventHandler.js
 * ==========================
 * Connection 이벤트 설정 함수들
 * 
 * @version 1.0.0
 * @description
 * - API Online/Offline 이벤트 처리
 * - Site 연결/해제 이벤트 처리
 * - NavigationController 이벤트 처리
 * - SceneController(screenManager) 이벤트 처리
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 7 - Connection 이벤트 분리 (2026-01-26)
 *           - setupConnectionEvents() 이동
 *           - setupNavigationControllerEvents() 이동
 *           - setupScreenManagerEvents() 이동
 *           - ⚠️ 호환성: 기존 Connection 이벤트 동작 100% 유지
 * 
 * @dependencies
 * - core/managers/EventBus.js
 * - app/AppState.js
 * - connection/ReconnectionHandler.js
 * - uds/index.js
 * - modes/ModeIndicator.js
 * - scene/SceneController.js
 * 
 * @exports
 * - setupConnectionEvents
 * - setupNavigationControllerEvents
 * - setupScreenManagerEvents
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/ConnectionEventHandler.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { eventBus } from '../core/managers/EventBus.js';
import { services } from '../app/AppState.js';
import { NAV_MODE } from '../core/navigation/index.js';
import { setupReconnectionHandler } from './ReconnectionHandler.js';
import { 
    initializeUDSAfterConnection, 
    setupUDSEventListeners 
} from '../uds/index.js';
import { updateModeIndicator } from '../modes/ModeIndicator.js';
import { sceneController } from '../scene/index.js';

// ============================================
// Connection 이벤트 설정
// ============================================

/**
 * Connection 이벤트 설정 (메인 함수)
 * 
 * - API Online/Offline
 * - Site 연결/해제
 * - 재연결 복구 핸들러
 * - UDS 이벤트 리스너
 * 
 * @param {Object} options - 설정 옵션
 * @param {Object} options.appModeManager - AppModeManager 인스턴스
 * @param {Function} options.loadEquipmentMappings - 매핑 로드 함수
 * @returns {Object} cleanup 함수들 { reconnection, uds }
 * 
 * @example
 * const cleanups = setupConnectionEvents({ appModeManager, loadEquipmentMappings });
 * // 정리 시
 * cleanups.reconnection();
 * cleanups.uds();
 */
export function setupConnectionEvents(options = {}) {
    const { appModeManager, loadEquipmentMappings } = options;
    
    console.log('🔌 Connection 이벤트 설정 시작...');
    
    const cleanups = {
        reconnection: null,
        uds: null
    };
    
    // ─────────────────────────────────────────────────────────────────────────
    // API Online/Offline 이벤트
    // ─────────────────────────────────────────────────────────────────────────
    const connectionStatusService = services.ui?.connectionStatusService;
    
    if (connectionStatusService) {
        connectionStatusService.onOnline((data) => {
            console.log('[Connection] API Online:', data);
            
            if (data.recoveredAfter > 0) {
                window.showToast?.('Backend 연결 복구', 'success');
            }
        });
        
        connectionStatusService.onOffline(() => {
            console.log('[Connection] API Offline');
            
            window.sidebarState.isConnected = false;
            window.showToast?.('Backend 연결 끊김', 'warning');
        });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Site 연결/해제 이벤트
    // ─────────────────────────────────────────────────────────────────────────
    eventBus.on('site:connected', async ({ siteId, siteName }) => {
        console.log(`[Connection] Site Connected: ${siteId}`);
        window.sidebarState.isConnected = true;
        
        // Site 연결 후 매핑 데이터 자동 로드
        if (loadEquipmentMappings) {
            await loadEquipmentMappings(siteId);
        }
        
        // UDS 초기화 (매핑 로드 후 실행)
        await initializeUDSAfterConnection(siteId);
    });
    
    eventBus.on('site:disconnected', () => {
        console.log('[Connection] Site Disconnected');
        window.sidebarState.isConnected = false;
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // 재연결 복구 핸들러 설정
    // ─────────────────────────────────────────────────────────────────────────
    cleanups.reconnection = setupReconnectionHandler({ appModeManager });
    
    // ─────────────────────────────────────────────────────────────────────────
    // UDS 이벤트 리스너 설정
    // ─────────────────────────────────────────────────────────────────────────
    cleanups.uds = setupUDSEventListeners();
    
    console.log('✅ Connection 이벤트 설정 완료');
    
    return cleanups;
}

// ============================================
// NavigationController 이벤트 설정
// ============================================

/**
 * NavigationController 이벤트 설정
 * 
 * NavigationController의 이벤트를 받아 UI 업데이트 수행
 * 
 * @returns {void}
 * 
 * @example
 * setupNavigationControllerEvents();
 */
export function setupNavigationControllerEvents() {
    console.log('🧭 NavigationController 이벤트 설정 시작...');
    
    // ─────────────────────────────────────────────────────────────────────────
    // navigation:complete → UI 업데이트
    // ─────────────────────────────────────────────────────────────────────────
    eventBus.on('navigation:complete', ({ state, previousState }) => {
        console.log(`[Navigation] ✅ 완료: ${state.mode}/${state.submode || 'none'}`);
        
        // ModeIndicator 업데이트
        const modeLabel = state.mode === NAV_MODE.MAIN_VIEWER ? null : state.mode;
        updateModeIndicator(modeLabel, state.submode);
        
        // Toast 알림 (홈으로 돌아가는 경우 제외)
        if (state.mode !== NAV_MODE.MAIN_VIEWER) {
            const submodeLabel = state.submode || 'default';
            window.showToast?.(`${state.mode}: ${submodeLabel}`, 'info');
        }
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // navigation:blocked → 경고 메시지
    // ─────────────────────────────────────────────────────────────────────────
    eventBus.on('navigation:blocked', ({ mode, reason }) => {
        console.warn(`[Navigation] ⚠️ 차단: ${mode} - ${reason}`);
        
        if (reason === 'connection_required') {
            window.showToast?.('Connect DB or enable Dev Mode first', 'warning');
        }
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // navigation:error → 에러 메시지
    // ─────────────────────────────────────────────────────────────────────────
    eventBus.on('navigation:error', ({ error }) => {
        console.error('[Navigation] ❌ 에러:', error);
        window.showToast?.('Navigation failed', 'error');
    });
    
    console.log('  ✅ NavigationController 이벤트 설정 완료');
}

// ============================================
// SceneController(screenManager) 이벤트 설정
// ============================================

/**
 * SceneController 이벤트 연결
 * 
 * @returns {void}
 * 
 * @example
 * setupScreenManagerEvents();
 */
export function setupScreenManagerEvents() {
    console.log('🖥️ SceneController 이벤트 연결 시작...');
    
    // SceneController가 자체적으로 이벤트 핸들링
    sceneController.setupEventHandlers();
    
    console.log('  ✅ SceneController 이벤트 연결 완료');
}