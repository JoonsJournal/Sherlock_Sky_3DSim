/**
 * loaders/index.js
 * =================
 * DataLoader 모듈 내보내기
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/loaders/index.js
 * 
 * @version 1.1.0
 * @since 2026-01-13
 * 
 * @changelog
 * - v1.1.0: MonitoringDataLoader 추가 (2026-01-13)
 * - v1.0.0: 초기 버전 - IDataLoader, MappingDataLoader
 * 
 * @example
 * // 개별 import
 * import { IDataLoader, LoaderState, LoaderType } from './loaders/IDataLoader.js';
 * import { MappingDataLoader } from './loaders/MappingDataLoader.js';
 * import { MonitoringDataLoader, MonitoringLoaderEvents } from './loaders/MonitoringDataLoader.js';
 * 
 * // 통합 import
 * import { 
 *     IDataLoader, 
 *     LoaderState, 
 *     LoaderEvents, 
 *     LoaderType,
 *     MappingDataLoader,
 *     MonitoringDataLoader,
 *     MonitoringLoaderEvents
 * } from './loaders';
 */

// ============================================================================
// IDataLoader (추상 클래스 + 상수)
// ============================================================================

export { 
    IDataLoader, 
    LoaderState, 
    LoaderEvents, 
    LoaderType 
} from './IDataLoader.js';

// ============================================================================
// DataLoader 구현체들
// ============================================================================

// 매핑 데이터 로더
export { MappingDataLoader } from './MappingDataLoader.js';

// 모니터링 데이터 로더 (🆕 v1.1.0)
export { MonitoringDataLoader, MonitoringLoaderEvents } from './MonitoringDataLoader.js';

// TODO: 향후 추가 예정
// export { AnalysisDataLoader } from './AnalysisDataLoader.js';
// export { DashboardDataLoader } from './DashboardDataLoader.js';

// ============================================================================
// DataLoaderFactory (향후 추가 예정)
// ============================================================================

// TODO: DataLoaderFactory 추가 시 export
// export { DataLoaderFactory } from './DataLoaderFactory.js';