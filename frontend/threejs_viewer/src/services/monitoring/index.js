/**
 * Monitoring Modules Index - v6.0.0
 * ==================================
 * MonitoringService 모듈화 통합 export
 * 
 * @version 6.0.0
 * @changelog
 * - v6.0.0: UDSIntegration, MonitoringLifecycle, MonitoringEventEmitter 추가 (2026-01-25)
 * - v5.0.0: MappingEventHandler 추가
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/index.js
 */

// Phase 3: StatusAPIClient
export { StatusAPIClient, statusApiClient } from './StatusAPIClient.js';

// Phase 4: WebSocketManager
export { WebSocketManager, webSocketManager, ConnectionState, MessageType, ActionType } from './WebSocketManager.js';

// Phase 5: MonitoringStatsPanel (❌ v5.0.2: 제거됨, 호환성 유지)
export { MonitoringStatsPanel, monitoringStatsPanel } from './MonitoringStatsPanel.js';

// Phase 6: SignalTowerIntegration
export { SignalTowerIntegration, signalTowerIntegration } from './SignalTowerIntegration.js';

// Phase 7: MappingEventHandler
export { MappingEventHandler, mappingEventHandler, MappingEventType } from './MappingEventHandler.js';

// 🆕 v6.0.0: UDSIntegration
export { UDSIntegration, UDS_EVENTS, udsIntegration } from './UDSIntegration.js';

// 🆕 v6.0.0: MonitoringLifecycle
export { MonitoringLifecycle, LifecycleState } from './MonitoringLifecycle.js';

// 🆕 v6.0.0: MonitoringEventEmitter
export { MonitoringEventEmitter, MonitoringServiceEvents } from './MonitoringEventEmitter.js';

/** 모듈 버전 정보 */
export const MONITORING_MODULES_VERSION = '6.0.0';

export const MONITORING_MODULES_INFO = Object.freeze({
    version: '6.0.0',
    releaseDate: '2026-01-25',
    modules: [
        'StatusAPIClient', 'WebSocketManager', 'MonitoringStatsPanel',
        'SignalTowerIntegration', 'MappingEventHandler',
        'UDSIntegration', 'MonitoringLifecycle', 'MonitoringEventEmitter'
    ]
});