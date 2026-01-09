/**
 * Monitoring Modules Index - v3.0.0
 * 
 * MonitoringService 모듈화 프로젝트 통합 export
 * 
 * Phase 3: StatusAPIClient 추출 (v1.0.0)
 * Phase 4: WebSocketManager 추출 (v2.0.0)
 * Phase 5: MonitoringStatsPanel 추출 (v3.0.0) ⭐ NEW
 * 
 * @version 3.0.0
 * @since 2026-01-10
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/index.js
 */

// ⭐ Phase 3: StatusAPIClient
export { StatusAPIClient, statusApiClient } from './StatusAPIClient.js';

// ⭐ Phase 4: WebSocketManager
export { 
    WebSocketManager, 
    webSocketManager,
    ConnectionState, 
    MessageType, 
    ActionType 
} from './WebSocketManager.js';

// ⭐ Phase 5: MonitoringStatsPanel
export {
    MonitoringStatsPanel,
    monitoringStatsPanel
} from './MonitoringStatsPanel.js';

/**
 * 모듈 버전 정보
 */
export const MONITORING_MODULES_VERSION = '3.0.0';

/**
 * 모듈 상세 버전
 */
export const MODULE_VERSIONS = {
    StatusAPIClient: '1.0.0',
    WebSocketManager: '1.0.0',
    MonitoringStatsPanel: '1.0.0'
};

/**
 * 사용 예시:
 * 
 * ```javascript
 * // 전체 import
 * import { 
 *     StatusAPIClient, 
 *     WebSocketManager, 
 *     MonitoringStatsPanel,
 *     ConnectionState 
 * } from './monitoring/index.js';
 * 
 * // 개별 import
 * import { StatusAPIClient } from './monitoring/StatusAPIClient.js';
 * import { WebSocketManager, ConnectionState } from './monitoring/WebSocketManager.js';
 * import { MonitoringStatsPanel } from './monitoring/MonitoringStatsPanel.js';
 * ```
 */