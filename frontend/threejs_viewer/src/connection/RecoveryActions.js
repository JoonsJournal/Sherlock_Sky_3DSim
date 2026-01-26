/**
 * RecoveryActions.js
 * ==================
 * 재연결 복구 액션 구현
 * 
 * @version 1.0.0
 * @description
 * - main.js에서 분리된 8개 복구 액션 함수
 * - 각 모드별 재연결 시 실행되는 구체적 복구 로직
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 6 - 재연결 복구 분리 (2026-01-26)
 *           - 8개 복구 액션 함수 이동
 *           - services 의존성 주입 패턴 적용
 *           - ⚠️ 호환성: main.js 기존 동작 100% 유지
 * 
 * @dependencies
 * - ../app/AppState.js (services)
 * - ../core/managers/EventBus.js (eventBus)
 * 
 * @exports
 * - actionRestartMonitoringService
 * - actionResubscribeWebSocket
 * - actionRefreshStatus
 * - actionReloadAnalysisData
 * - actionReconnectDatabase
 * - actionRefreshDashboard
 * - actionReconnectCache
 * - actionReconnectMappingApi
 * - executeRecoveryAction
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/RecoveryActions.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { services } from '../app/AppState.js';
import { eventBus } from '../core/managers/EventBus.js';

// ============================================
// 유틸리티
// ============================================

/**
 * 딜레이 유틸리티
 * @private
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 */
function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 복구 액션 구현
// ============================================

/**
 * MonitoringService 재시작
 * 
 * @returns {Promise<void>}
 */
export async function actionRestartMonitoringService() {
    const monitoringService = services.monitoring?.monitoringService;
    
    if (!monitoringService) {
        console.warn('      ⚠️ MonitoringService 없음');
        return;
    }
    
    if (monitoringService.isActive) {
        // restart() 메서드 사용
        if (typeof monitoringService.restart === 'function') {
            await monitoringService.restart({ fullRestart: false });
            console.log('      ✅ MonitoringService 재시작 완료 (restart)');
        } else {
            // 폴백: 기존 방식
            await monitoringService.stop();
            await _delay(300);
            await monitoringService.start();
            console.log('      ✅ MonitoringService 재시작 완료 (stop/start)');
        }
    } else {
        // 비활성 상태면 그냥 시작
        await monitoringService.start();
        console.log('      ✅ MonitoringService 시작됨');
    }
}

/**
 * WebSocket 재구독
 * 
 * @returns {Promise<void>}
 */
export async function actionResubscribeWebSocket() {
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
 * @returns {Promise<void>}
 */
export async function actionRefreshStatus() {
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
 * @returns {Promise<void>}
 */
export async function actionReloadAnalysisData() {
    // TODO: AnalysisDataLoader 구현 후 연동
    console.log('      ℹ️ Analysis 데이터 재로드 (미구현)');
    
    // eventBus를 통해 Analysis 모듈에 알림
    eventBus.emit('analysis:reload-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Database 재연결
 * 
 * @returns {Promise<void>}
 */
export async function actionReconnectDatabase() {
    // Database 연결 확인은 ConnectionStatusService가 처리
    console.log('      ℹ️ Database 재연결 요청');
    
    eventBus.emit('database:reconnect-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Dashboard 새로고침
 * 
 * @returns {Promise<void>}
 */
export async function actionRefreshDashboard() {
    // TODO: DashboardDataLoader 구현 후 연동
    console.log('      ℹ️ Dashboard 새로고침 (미구현)');
    
    eventBus.emit('dashboard:refresh-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Cache 재연결
 * 
 * @returns {Promise<void>}
 */
export async function actionReconnectCache() {
    // Redis 캐시 재연결은 Backend가 처리
    console.log('      ℹ️ Cache 재연결 요청');
    
    eventBus.emit('cache:reconnect-requested', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Mapping API 재연결
 * 
 * @returns {Promise<void>}
 */
export async function actionReconnectMappingApi() {
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
// 복구 액션 라우터
// ============================================

/**
 * 액션 이름 → 함수 매핑
 * @private
 */
const ACTION_MAP = {
    'restartMonitoringService': actionRestartMonitoringService,
    'resubscribeWebSocket': actionResubscribeWebSocket,
    'refreshStatus': actionRefreshStatus,
    'reloadAnalysisData': actionReloadAnalysisData,
    'reconnectDatabase': actionReconnectDatabase,
    'refreshDashboard': actionRefreshDashboard,
    'reconnectCache': actionReconnectCache,
    'reconnectMappingApi': actionReconnectMappingApi
};

/**
 * 개별 복구 액션 실행
 * 
 * @param {string} action - 액션 이름
 * @param {string} mode - 현재 모드 (로깅용)
 * @returns {Promise<void>}
 * 
 * @example
 * await executeRecoveryAction('restartMonitoringService', 'MONITORING');
 */
export async function executeRecoveryAction(action, mode) {
    console.log(`    → 액션 실행: ${action}`);
    
    const actionFn = ACTION_MAP[action];
    
    if (actionFn) {
        await actionFn();
    } else {
        console.warn(`    ⚠️ 알 수 없는 액션: ${action}`);
    }
}

// ============================================
// 전역 노출 (하위 호환)
// ============================================

// 디버깅용 전역 노출
if (typeof window !== 'undefined') {
    window._recoveryActions = {
        actionRestartMonitoringService,
        actionResubscribeWebSocket,
        actionRefreshStatus,
        actionReloadAnalysisData,
        actionReconnectDatabase,
        actionRefreshDashboard,
        actionReconnectCache,
        actionReconnectMappingApi,
        executeRecoveryAction
    };
}