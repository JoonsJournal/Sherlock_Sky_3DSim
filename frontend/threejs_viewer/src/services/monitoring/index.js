/**
 * Monitoring Modules Index - v4.0.0
 * 
 * MonitoringService 모듈화 프로젝트 통합 export
 * 
 * Phase 3: StatusAPIClient 추출 (v1.0.0)
 * Phase 4: WebSocketManager 추출 (v2.0.0)
 * Phase 5: MonitoringStatsPanel 추출 (v3.0.0)
 * Phase 6: SignalTowerIntegration 추출 (v4.0.0) ⭐ NEW
 * 
 * @version 4.0.0
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

// ⭐ Phase 6: SignalTowerIntegration
export {
    SignalTowerIntegration,
    signalTowerIntegration
} from './SignalTowerIntegration.js';

/**
 * 모듈 버전 정보
 */
export const MONITORING_MODULES_VERSION = '4.0.0';

/**
 * 모듈 상세 버전
 */
export const MODULE_VERSIONS = {
    StatusAPIClient: '1.0.0',       // Phase 3
    WebSocketManager: '1.0.0',      // Phase 4
    MonitoringStatsPanel: '1.0.0',  // Phase 5
    SignalTowerIntegration: '1.0.0' // Phase 6
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
 *     SignalTowerIntegration,
 *     ConnectionState 
 * } from './monitoring/index.js';
 * 
 * // 개별 import
 * import { StatusAPIClient } from './monitoring/StatusAPIClient.js';
 * import { WebSocketManager, ConnectionState } from './monitoring/WebSocketManager.js';
 * import { MonitoringStatsPanel } from './monitoring/MonitoringStatsPanel.js';
 * import { SignalTowerIntegration } from './monitoring/SignalTowerIntegration.js';
 * 
 * // 사용 예시 - SignalTowerIntegration
 * const signalIntegration = new SignalTowerIntegration(
 *     signalTowerManager,
 *     equipmentLoader,
 *     equipmentEditState
 * );
 * 
 * // 모든 램프 초기화
 * signalIntegration.initializeAllLights();
 * 
 * // 미매핑 설비 스타일 적용
 * const result = signalIntegration.applyUnmappedStyle();
 * console.log(`Mapped: ${result.mapped}, Unmapped: ${result.unmapped}`);
 * 
 * // 상태 업데이트
 * signalIntegration.updateStatus('EQ-01-01', 'RUN');
 * 
 * // 통계 조회
 * const stats = signalIntegration.getStatusStatistics();
 * ```
 */