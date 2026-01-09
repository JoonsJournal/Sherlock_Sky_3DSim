/**
 * monitoring/index.js
 * ====================
 * Monitoring 모듈 Re-export
 * 
 * MonitoringService 리팩토링 프로젝트의 일부
 * 
 * @version 1.0.0
 * @description
 * 이 파일은 monitoring 폴더 내의 모든 모듈을 re-export합니다.
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/index.js
 * 작성일: 2026-01-10
 * 
 * @usage
 * // 방법 1: 개별 import
 * import { StatusAPIClient } from './monitoring/StatusAPIClient.js';
 * 
 * // 방법 2: index.js를 통한 import
 * import { StatusAPIClient, statusApiClient } from './monitoring/index.js';
 * 
 * // 방법 3: 전체 import
 * import * as Monitoring from './monitoring/index.js';
 * const client = new Monitoring.StatusAPIClient();
 * 
 * @migration_guide
 * 기존 코드:
 *   import { MonitoringService } from './services/MonitoringService.js';
 * 
 * 새 코드 (선택 사항 - 기존 방식도 계속 동작):
 *   import { MonitoringService } from './services/monitoring/index.js';
 * 
 * 개별 모듈 직접 사용:
 *   import { StatusAPIClient } from './services/monitoring/index.js';
 *   const apiClient = new StatusAPIClient();
 */

// =========================================================================
// Phase 3: StatusAPIClient (REST API 호출)
// =========================================================================
export { StatusAPIClient, statusApiClient } from './StatusAPIClient.js';

// =========================================================================
// Phase 4: WebSocketManager (예정)
// =========================================================================
// export { WebSocketManager } from './WebSocketManager.js';

// =========================================================================
// Phase 5: MonitoringStatsPanel (예정)
// =========================================================================
// export { MonitoringStatsPanel } from './MonitoringStatsPanel.js';

// =========================================================================
// Phase 6: SignalTowerIntegration (예정)
// =========================================================================
// export { SignalTowerIntegration } from './SignalTowerIntegration.js';

// =========================================================================
// Phase 7: MappingEventHandler (예정)
// =========================================================================
// export { MappingEventHandler } from './MappingEventHandler.js';

// =========================================================================
// Phase 8: MonitoringService Orchestrator (예정)
// =========================================================================
// export { MonitoringService } from './MonitoringService.js';