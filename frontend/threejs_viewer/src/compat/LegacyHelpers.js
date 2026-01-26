/**
 * LegacyHelpers.js
 * =================
 * 하위 호환 헬퍼 함수들
 * 
 * @version 1.0.0
 * @description
 * - Sidebar 버튼 상태 업데이트 (하위 호환)
 * - Submenu 활성 상태 업데이트 (하위 호환)
 * - Sidebar 아이콘 활성화/비활성화 (하위 호환)
 * - Cover Screen 상태 업데이트 (하위 호환)
 * - Status Bar 연결 상태 업데이트 (하위 호환)
 * - 액션 헬퍼 함수들 (Recovery Actions 보조)
 * 
 * @changelog
 * - v1.0.0: Phase 9 - main.js에서 분리 (2026-01-26)
 *           - _updateSidebarButtonState() 이동
 *           - _updateSubmenuActiveState() 이동
 *           - _enableSidebarIcons() 이동
 *           - _disableSidebarIcons() 이동
 *           - _updateCoverStatus() 이동
 *           - _updateStatusBarConnection() 이동
 *           - 6개 액션 헬퍼 함수 이동
 *           - ⚠️ 호환성: main.js 기존 동작 100% 유지
 * 
 * @dependencies
 * - services (from '../app/AppState.js')
 * - eventBus (from '../core/managers/EventBus.js')
 * 
 * @exports
 * - _updateSidebarButtonState
 * - _updateSubmenuActiveState
 * - _enableSidebarIcons
 * - _disableSidebarIcons
 * - _updateCoverStatus
 * - _updateStatusBarConnection
 * - _delay
 * - Action Helpers (6개)
 * 
 * 📁 위치: frontend/threejs_viewer/src/compat/LegacyHelpers.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { services } from '../app/AppState.js';
import { eventBus } from '../core/managers/EventBus.js';

// ============================================
// 전역 참조 (외부에서 설정)
// ============================================
let _sidebarUI = null;

/**
 * sidebarUI 참조 설정
 * @param {Object} sidebarUI - Sidebar UI 인스턴스
 */
export function setSidebarUIRef(sidebarUI) {
    _sidebarUI = sidebarUI;
    console.log('[LegacyHelpers] ✅ sidebarUI 참조 설정 완료');
}

/**
 * sidebarUI 참조 조회
 * @returns {Object|null}
 */
export function getSidebarUIRef() {
    return _sidebarUI;
}

// ============================================
// Sidebar UI 하위 호환 함수들
// ============================================

/**
 * Sidebar 버튼 선택 상태 업데이트 (하위 호환)
 * 
 * @param {string|null} mode - 활성화할 모드 (null이면 모두 비활성)
 * @description
 * - Sidebar.js가 있으면 자동 처리됨
 * - 없으면 직접 DOM 조작으로 폴백
 * 
 * @example
 * _updateSidebarButtonState('monitoring'); // monitoring 버튼 활성화
 * _updateSidebarButtonState(null);         // 모든 버튼 비활성화
 */
export function _updateSidebarButtonState(mode) {
    // Sidebar.js가 자동 처리하지만, 직접 호출 시 DOM 조작
    document.querySelectorAll('#sidebar .icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    if (mode) {
        const btn = document.getElementById(`btn-${mode}`);
        if (btn) btn.classList.add('selected');
    }
}

/**
 * Submenu 활성 상태 업데이트 (하위 호환)
 * 
 * @param {string} mode - 모드 이름
 * @param {string} submode - 활성화할 서브모드
 * @description
 * - 해당 모드의 submenu 내 아이템 활성화 상태 토글
 * 
 * @example
 * _updateSubmenuActiveState('analysis', 'heatmap');
 */
export function _updateSubmenuActiveState(mode, submode) {
    const submenu = document.getElementById(`${mode}-submenu`);
    if (!submenu) return;
    
    submenu.querySelectorAll('.submenu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.submode === submode);
    });
}

/**
 * Sidebar 아이콘 활성화 (하위 호환)
 * 
 * @description
 * - Site 연결 성공 후 Sidebar 버튼들 활성화
 * - Sidebar.js가 있으면 위임, 없으면 직접 DOM 조작
 * 
 * @example
 * // Site 연결 성공 시
 * _enableSidebarIcons();
 */
export function _enableSidebarIcons() {
    // Sidebar.js가 있으면 위임
    if (_sidebarUI?.sidebar) {
        _sidebarUI.sidebar._updateButtonStates?.();
        return;
    }
    
    // 폴백: 직접 DOM 조작
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
    
    // Dev Mode 활성화 시 Layout 버튼도 표시
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
 * Sidebar 아이콘 비활성화 (하위 호환)
 * 
 * @description
 * - Site 연결 끊김 또는 초기 상태에서 Sidebar 버튼들 비활성화
 * - Sidebar.js가 있으면 위임, 없으면 직접 DOM 조작
 * 
 * @example
 * // Site 연결 해제 시
 * _disableSidebarIcons();
 */
export function _disableSidebarIcons() {
    // Sidebar.js가 있으면 위임
    if (_sidebarUI?.sidebar) {
        _sidebarUI.sidebar._updateButtonStates?.();
        return;
    }
    
    // 폴백: 직접 DOM 조작
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
    
    // Dev Mode 비활성화 시 Debug 버튼도 비활성화
    if (!window.sidebarState?.devModeEnabled) {
        const debugWrapper = document.getElementById('btn-debug-wrapper');
        const debugBtn = document.getElementById('btn-debug');
        if (debugWrapper) debugWrapper.classList.add('disabled');
        if (debugBtn) debugBtn.classList.add('disabled');
    }
    
    // 모든 선택 상태 해제
    document.querySelectorAll('#sidebar .icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

/**
 * Cover Screen 상태 업데이트 (하위 호환)
 * 
 * @param {boolean} apiConnected - API 연결 상태
 * @param {boolean} dbConnected - DB 연결 상태
 * @param {string} [dbName] - 연결된 DB 이름
 * @description
 * - CoverScreen.js가 있으면 위임, 없으면 직접 DOM 조작
 * 
 * @example
 * _updateCoverStatus(true, true, 'korea_site1_line1');
 * _updateCoverStatus(true, false, null); // DB만 끊김
 */
export function _updateCoverStatus(apiConnected, dbConnected, dbName) {
    // CoverScreen.js가 있으면 위임
    if (_sidebarUI?.coverScreen) {
        _sidebarUI.coverScreen.setApiConnected(apiConnected);
        _sidebarUI.coverScreen.setDbConnected(dbConnected, dbName);
        return;
    }
    
    // 폴백: 직접 DOM 조작
    const apiDot = document.getElementById('cover-api-dot');
    const apiStatus = document.getElementById('cover-api-status');
    const dbDot = document.getElementById('cover-db-dot');
    const dbStatus = document.getElementById('cover-db-status');
    
    if (apiDot) {
        apiDot.classList.toggle('connected', apiConnected);
        apiDot.classList.toggle('disconnected', !apiConnected);
    }
    if (apiStatus) {
        apiStatus.textContent = apiConnected ? 'Connected' : 'Disconnected';
    }
    
    if (dbDot) {
        dbDot.classList.toggle('connected', dbConnected);
        dbDot.classList.toggle('disconnected', !dbConnected);
    }
    if (dbStatus) {
        dbStatus.textContent = dbConnected ? (dbName || 'Connected') : 'Not Connected';
    }
}

/**
 * Status Bar 연결 상태 업데이트 (하위 호환)
 * 
 * @param {boolean} apiConnected - API 연결 상태
 * @param {boolean} dbConnected - DB 연결 상태
 * @param {string} [siteId] - Site ID
 * @description
 * - StatusBar.js가 있으면 위임, 없으면 직접 DOM 조작
 * 
 * @example
 * _updateStatusBarConnection(true, true, 'korea_site1_line1');
 */
export function _updateStatusBarConnection(apiConnected, dbConnected, siteId) {
    // StatusBar.js가 있으면 위임
    if (_sidebarUI?.statusBar) {
        _sidebarUI.statusBar.setApiConnected(apiConnected);
        _sidebarUI.statusBar.setDbConnected(dbConnected, siteId);
        return;
    }
    
    // 폴백: 직접 DOM 조작
    const apiDot = document.getElementById('api-dot') || document.getElementById('backend-dot');
    const apiValue = document.getElementById('api-value') || document.getElementById('backend-value');
    const dbDot = document.getElementById('db-dot');
    const dbValue = document.getElementById('db-value');
    
    if (apiDot) {
        apiDot.classList.toggle('connected', apiConnected);
        apiDot.classList.toggle('disconnected', !apiConnected);
    }
    if (apiValue) {
        apiValue.textContent = apiConnected ? 'Connected' : 'Disconnected';
    }
    
    if (dbDot) {
        dbDot.classList.toggle('connected', dbConnected);
        dbDot.classList.toggle('disconnected', !dbConnected);
    }
    if (dbValue) {
        dbValue.textContent = siteId 
            ? siteId.replace(/_/g, '-').toUpperCase() 
            : 'None';
    }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 딜레이 유틸리티
 * 
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 * 
 * @example
 * await _delay(1000); // 1초 대기
 */
export function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 액션 헬퍼 함수들 (Recovery Actions 보조)
// ============================================

/**
 * WebSocket 재구독
 * 
 * @description
 * - DataLoader 사용 시 reconnectWebSocket() 호출
 * - 레거시 방식은 wsManager.connect() + subscribe()
 * 
 * @example
 * await _actionResubscribeWebSocket();
 */
export async function _actionResubscribeWebSocket() {
    const monitoringService = services.monitoring?.monitoringService;
    
    // DataLoader 사용 시
    const dataLoader = monitoringService?.getDataLoader?.();
    if (dataLoader) {
        try {
            await dataLoader.reconnectWebSocket();
            console.log('      ✅ DataLoader WebSocket 재연결 완료');
            return;
        } catch (e) {
            console.warn('      ⚠️ DataLoader WebSocket 재연결 실패:', e.message);
        }
    }
    
    // 레거시 방식
    const wsManager = monitoringService?.wsManager;
    if (wsManager) {
        if (!wsManager.isConnected()) {
            await wsManager.connect();
        }
        wsManager.subscribe();
        console.log('      ✅ WebSocket 재구독 완료');
    }
}

/**
 * 상태 새로고침
 * 
 * @description
 * - MonitoringService의 초기 상태 로드 및 패널 업데이트
 * 
 * @example
 * await _actionRefreshStatus();
 */
export async function _actionRefreshStatus() {
    const monitoringService = services.monitoring?.monitoringService;
    
    if (monitoringService) {
        await monitoringService.loadInitialStatus?.();
        monitoringService.updateStatusPanel?.();
        console.log('      ✅ 상태 새로고침 완료');
    }
}

/**
 * Analysis 데이터 재로드
 * 
 * @description
 * - eventBus를 통해 Analysis 모듈에 재로드 요청
 * - TODO: AnalysisDataLoader 구현 후 연동
 * 
 * @example
 * await _actionReloadAnalysisData();
 */
export async function _actionReloadAnalysisData() {
    console.log('      ℹ️ Analysis 데이터 재로드 (미구현)');
    
    // eventBus를 통해 Analysis 모듈에 알림
    eventBus.emit('analysis:reload-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Database 재연결
 * 
 * @description
 * - eventBus를 통해 Database 재연결 요청
 * - 실제 연결은 ConnectionStatusService가 처리
 * 
 * @example
 * await _actionReconnectDatabase();
 */
export async function _actionReconnectDatabase() {
    console.log('      ℹ️ Database 재연결 요청');
    
    eventBus.emit('database:reconnect-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Dashboard 새로고침
 * 
 * @description
 * - eventBus를 통해 Dashboard 새로고침 요청
 * - TODO: DashboardDataLoader 구현 후 연동
 * 
 * @example
 * await _actionRefreshDashboard();
 */
export async function _actionRefreshDashboard() {
    console.log('      ℹ️ Dashboard 새로고침 (미구현)');
    
    eventBus.emit('dashboard:refresh-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Cache 재연결
 * 
 * @description
 * - eventBus를 통해 Redis 캐시 재연결 요청
 * - 실제 처리는 Backend가 담당
 * 
 * @example
 * await _actionReconnectCache();
 */
export async function _actionReconnectCache() {
    console.log('      ℹ️ Cache 재연결 요청');
    
    eventBus.emit('cache:reconnect-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Mapping API 재연결
 * 
 * @description
 * - EquipmentMappingService 우선 사용
 * - 캐시 정리 후 재로드
 * - 실패 시 apiClient.healthCheck() 폴백
 * 
 * @example
 * await _actionReconnectMappingApi();
 */
export async function _actionReconnectMappingApi() {
    // EquipmentMappingService 우선 사용
    const mappingService = services.mapping?.equipmentMappingService;
    
    if (mappingService) {
        try {
            // 캐시 정리 후 재로드
            mappingService.clearMappingCache();
            
            const result = await mappingService.loadCurrentMappings({
                forceRefresh: true,
                applyToEditState: true
            });
            
            console.log(`      ✅ Mapping API 재연결 완료: ${result.count}개 매핑`);
            return;
        } catch (e) {
            console.warn('      ⚠️ Mapping API 재연결 실패:', e.message);
        }
    }
    
    // 폴백: 기존 방식
    const apiClient = services.ui?.apiClient;
    
    if (apiClient) {
        try {
            const isHealthy = await apiClient.healthCheck?.();
            console.log(`      ℹ️ Mapping API 상태: ${isHealthy ? 'OK' : 'Failed'}`);
        } catch (e) {
            console.warn('      ⚠️ Mapping API 헬스체크 실패:', e.message);
        }
    }
}

// ============================================
// 디버그
// ============================================

/**
 * LegacyHelpers 디버그 정보 출력
 */
export function debugLegacyHelpers() {
    console.group('🔧 LegacyHelpers Debug (v1.0.0)');
    console.log('sidebarUI 참조:', _sidebarUI ? '✅ 설정됨' : '❌ 미설정');
    console.log('');
    console.log('📋 사용 가능한 함수:');
    console.log('  - _updateSidebarButtonState(mode)');
    console.log('  - _updateSubmenuActiveState(mode, submode)');
    console.log('  - _enableSidebarIcons()');
    console.log('  - _disableSidebarIcons()');
    console.log('  - _updateCoverStatus(api, db, dbName)');
    console.log('  - _updateStatusBarConnection(api, db, siteId)');
    console.log('  - _delay(ms)');
    console.log('');
    console.log('📋 액션 헬퍼 함수:');
    console.log('  - _actionResubscribeWebSocket()');
    console.log('  - _actionRefreshStatus()');
    console.log('  - _actionReloadAnalysisData()');
    console.log('  - _actionReconnectDatabase()');
    console.log('  - _actionRefreshDashboard()');
    console.log('  - _actionReconnectCache()');
    console.log('  - _actionReconnectMappingApi()');
    console.groupEnd();
}