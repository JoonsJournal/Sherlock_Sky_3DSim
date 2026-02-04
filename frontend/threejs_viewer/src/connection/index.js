/**
 * connection/index.js
 * ===================
 * Connection 모듈 Barrel Export
 * 
 * @version 2.0.0
 * @description
 * - connection/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * - 재연결 복구 로직 중앙 관리
 * - 🆕 Phase 3: WebSocket Pool Manager 추가
 * 
 * @changelog
 * - v2.0.0: Phase 3 - WebSocket Pool Manager 구현 (2026-02-04)
 *           - WebSocketPoolManager export 추가
 *           - ConnectionState, ConnectionStateMachine export 추가
 *           - SiteConnectionTracker export 추가
 *           - AppMode enum export 추가
 *           - ⚠️ 호환성: v1.x 모든 export 100% 유지
 * - v1.1.0: main.js 리팩토링 Phase 7 - Connection 이벤트 분리 (2026-01-26)
 *           - ConnectionEventHandler export 추가
 * - v1.0.0: main.js 리팩토링 Phase 6 - 재연결 복구 분리 (2026-01-26)
 *           - ReconnectionHandler export
 *           - RecoveryActions export
 * 
 * @exports
 * - ReconnectionHandler.js: 재연결 핸들러
 * - RecoveryActions.js: 복구 액션 구현
 * - ConnectionEventHandler.js: Connection 이벤트 (Phase 7)
 * - ConnectionState.js: 연결 상태 FSM (🆕 Phase 3)
 * - SiteConnectionTracker.js: Site별 연결 추적 (🆕 Phase 3)
 * - WebSocketPoolManager.js: WebSocket 풀 관리 (🆕 Phase 3)
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/index.js
 * 작성일: 2026-01-26
 * 수정일: 2026-02-04
 */

// ============================================
// ReconnectionHandler - 재연결 핸들러 (기존)
// ============================================
export {
    setupReconnectionHandler,
    executeRecoveryStrategy
} from './ReconnectionHandler.js';

// ============================================
// RecoveryActions - 복구 액션 구현 (기존)
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
// ConnectionEventHandler - Connection 이벤트 (Phase 7)
// ============================================
export {
    setupConnectionEvents,
    setupNavigationControllerEvents,
    setupScreenManagerEvents
} from './ConnectionEventHandler.js';

// ============================================
// 🆕 Phase 3: ConnectionState - 연결 상태 FSM
// ============================================
export {
    // Enum
    ConnectionState,
    
    // Class
    ConnectionStateMachine,
    
    // Utility functions
    getStateInfo,
    isConnectedState,
    canReceiveDataInState
} from './ConnectionState.js';

// ============================================
// 🆕 Phase 3: SiteConnectionTracker - Site별 연결 추적
// ============================================
export {
    // Classes
    SiteConnectionInfo,
    SiteConnectionTracker,
    
    // Singleton
    getConnectionTracker
} from './SiteConnectionTracker.js';

// ============================================
// 🆕 Phase 3: WebSocketPoolManager - WebSocket 풀 관리
// ============================================
export {
    // Enum
    AppMode,
    
    // Class
    WebSocketPoolManager,
    
    // Singleton
    getWebSocketPoolManager,
    resetWebSocketPoolManager
} from './WebSocketPoolManager.js';

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
    console.group('🔌 Connection Module Debug (v2.0.0)');
    
    console.log('=== 기존 모듈 (v1.x) ===');
    console.log('ReconnectionHandler: setupReconnectionHandler, executeRecoveryStrategy');
    console.log('RecoveryActions: 8개 복구 액션 함수');
    console.log('ConnectionEventHandler: setupConnectionEvents, setupNavigationControllerEvents, setupScreenManagerEvents');
    
    console.log('');
    console.log('=== 🆕 Phase 3 추가 모듈 ===');
    console.log('ConnectionState: ConnectionState enum, ConnectionStateMachine class');
    console.log('SiteConnectionTracker: SiteConnectionInfo, SiteConnectionTracker, getConnectionTracker');
    console.log('WebSocketPoolManager: AppMode enum, WebSocketPoolManager class, getWebSocketPoolManager');
    
    console.log('');
    console.log('💡 사용 예시:');
    console.log('  // WebSocket Pool Manager 초기화');
    console.log('  import { getWebSocketPoolManager, AppMode } from "./connection/index.js";');
    console.log('  const pool = getWebSocketPoolManager({ baseUrl: "ws://localhost:8000", sites: ["CN_AAAA"] });');
    console.log('  await pool.switchMode(AppMode.DASHBOARD);');
    
    console.log('');
    console.log('  // 연결 상태 추적');
    console.log('  import { getConnectionTracker, ConnectionState } from "./connection/index.js";');
    console.log('  const tracker = getConnectionTracker();');
    console.log('  const info = tracker.register("CN_AAAA");');
    console.log('  info.transitionTo(ConnectionState.CONNECTING);');
    
    console.groupEnd();
}

// ============================================
// 타입 정의 (JSDoc)
// ============================================

/**
 * @typedef {Object} ConnectionModuleExports
 * @property {Function} setupReconnectionHandler - 재연결 핸들러 설정
 * @property {Function} executeRecoveryStrategy - 복구 전략 실행
 * @property {Function} setupConnectionEvents - Connection 이벤트 설정
 * @property {Object} ConnectionState - 연결 상태 Enum
 * @property {Class} ConnectionStateMachine - 연결 상태 머신
 * @property {Class} SiteConnectionTracker - Site 연결 추적기
 * @property {Class} WebSocketPoolManager - WebSocket 풀 관리자
 * @property {Object} AppMode - 앱 모드 Enum
 */
