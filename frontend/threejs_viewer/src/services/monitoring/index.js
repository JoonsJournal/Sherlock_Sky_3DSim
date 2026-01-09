/**
 * Monitoring Modules Index - v5.0.0
 * 
 * MonitoringService 모듈화 프로젝트 통합 export
 * 
 * Phase 3: StatusAPIClient 추출 (v1.0.0)
 * Phase 4: WebSocketManager 추출 (v2.0.0)
 * Phase 5: MonitoringStatsPanel 추출 (v3.0.0)
 * Phase 6: SignalTowerIntegration 추출 (v4.0.0)
 * Phase 7: MappingEventHandler 추출 (v5.0.0) ⭐ NEW
 * 
 * @version 5.0.0
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

// ⭐ Phase 7: MappingEventHandler
export {
    MappingEventHandler,
    mappingEventHandler,
    MappingEventType
} from './MappingEventHandler.js';

/**
 * 모듈 버전 정보
 */
export const MONITORING_MODULES_VERSION = '5.0.0';

/**
 * 모듈 상세 버전
 */
export const MODULE_VERSIONS = {
    StatusAPIClient: '1.0.0',       // Phase 3
    WebSocketManager: '1.0.0',      // Phase 4
    MonitoringStatsPanel: '1.0.0',  // Phase 5
    SignalTowerIntegration: '1.0.0', // Phase 6
    MappingEventHandler: '1.0.0'    // Phase 7
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
 *     MappingEventHandler,
 *     MappingEventType,
 *     ConnectionState 
 * } from './monitoring/index.js';
 * 
 * // 개별 import
 * import { StatusAPIClient } from './monitoring/StatusAPIClient.js';
 * import { WebSocketManager } from './monitoring/WebSocketManager.js';
 * import { MonitoringStatsPanel } from './monitoring/MonitoringStatsPanel.js';
 * import { SignalTowerIntegration } from './monitoring/SignalTowerIntegration.js';
 * import { MappingEventHandler, MappingEventType } from './monitoring/MappingEventHandler.js';
 * 
 * // 사용 예시 - MappingEventHandler
 * const eventHandler = new MappingEventHandler({
 *     signalIntegration: signalIntegration,
 *     apiClient: apiClient,
 *     wsManager: wsManager,
 *     onUpdate: () => this.updateStatusPanel(),
 *     showToast: (msg, type) => this.showToast(msg, type),
 *     cacheStatus: (id, status) => this.statusCache.set(id, status)
 * });
 * 
 * // 이벤트 리스너 등록
 * eventHandler.register(eventBus);
 * 
 * // 이벤트 리스너 해제
 * eventHandler.unregister();
 * 
 * // 수동 이벤트 발생
 * eventHandler.triggerMappingEvent('EQ-01-01', 123);
 * ```
 */