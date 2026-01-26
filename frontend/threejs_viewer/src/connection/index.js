/**
 * connection/index.js
 * ===================
 * Connection 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - connection/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * - 재연결 복구 로직 중앙 관리
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 6 - 재연결 복구 분리 (2026-01-26)
 *           - ReconnectionHandler export
 *           - RecoveryActions export
 *           - ⚠️ 호환성: main.js 기존 패턴 100% 유지
 * 
 * @exports
 * - ReconnectionHandler.js: 재연결 핸들러
 * - RecoveryActions.js: 복구 액션 구현
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/index.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

// ============================================
// ReconnectionHandler - 재연결 핸들러
// ============================================
export {
    setupReconnectionHandler,
    executeRecoveryStrategy
} from './ReconnectionHandler.js';

// ============================================
// RecoveryActions - 복구 액션 구현
// ============================================
export {
    // 개별 액션 함수
    actionRestartMonitoringService,
    actionResubscribeWebSocket,
    actionRefreshStatus,
    actionReloadAnalysisData,
    actionReconnectDatabase,
    actionRefreshDashboard,
    actionReconnectCache,
    actionReconnectMappingApi,
    
    // 액션 실행 라우터
    executeRecoveryAction
} from './RecoveryActions.js';

// ============================================
// 디버그 유틸리티
// ============================================

/**
 * Connection 모듈 디버그 정보 출력
 * 
 * @example
 * import { debugConnection } from './connection/index.js';
 * debugConnection();
 */
export function debugConnection() {
    console.group('🔌 Connection Module Debug (v1.0.0)');
    console.log('ReconnectionHandler: setupReconnectionHandler, executeRecoveryStrategy');
    console.log('RecoveryActions: 8개 복구 액션 함수');
    console.log('');
    console.log('💡 사용 예시:');
    console.log('  import { setupReconnectionHandler } from "./connection/index.js";');
    console.log('  const cleanup = setupReconnectionHandler({ appModeManager });');
    console.groupEnd();
}