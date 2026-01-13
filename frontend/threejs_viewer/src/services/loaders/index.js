/**
 * loaders/index.js
 * ================
 * 
 * DataLoader 모듈 통합 export
 * 
 * @version 1.3.0
 * @module loaders
 * 
 * @changelog
 * - v1.3.0: DataLoaderFactory 추가 (싱글톤 관리)
 * - v1.2.0: DashboardDataLoader 스켈레톤 추가
 * - v1.1.0: AnalysisDataLoader 스켈레톤 추가
 * - v1.0.0: IDataLoader, MonitoringDataLoader 추가
 * 
 * 위치: frontend/threejs_viewer/src/services/loaders/index.js
 */

// ============================================
// 인터페이스
// ============================================

export {
    IDataLoader,
    DataLoaderState,
    DataLoaderEvents
} from './IDataLoader.js';

// ============================================
// DataLoaderFactory (싱글톤 관리)
// ============================================

export {
    DataLoaderFactory,
    LoaderMode,
    dataLoaderFactory,
    getDataLoader,
    configureDataLoaders,
    disposeAllDataLoaders,
    default as DataLoaderFactoryDefault
} from './DataLoaderFactory.js';

// ============================================
// Monitoring DataLoader (구현됨)
// ============================================

export {
    MonitoringDataLoader
} from './MonitoringDataLoader.js';

// ============================================
// Analysis DataLoader (스켈레톤)
// ============================================

export {
    AnalysisDataLoader,
    AnalysisDataType
} from './AnalysisDataLoader.js';

// ============================================
// Dashboard DataLoader (스켈레톤)
// ============================================

export {
    DashboardDataLoader,
    WidgetType,
    CachePriority,
    RefreshStrategy,
    RedisChannel
} from './DashboardDataLoader.js';

// ============================================
// 팩토리 함수 (레거시 호환)
// ============================================

/**
 * 모드에 따른 DataLoader 생성
 * 
 * @deprecated DataLoaderFactory.getLoader() 사용 권장
 * @param {string} mode - 모드 ('monitoring', 'analysis', 'dashboard')
 * @param {Object} options - DataLoader 옵션
 * @returns {IDataLoader}
 * 
 * @example
 * // 레거시 방식
 * const loader = createDataLoader('monitoring', { apiClient });
 * 
 * // 권장 방식
 * DataLoaderFactory.configure({ apiClient });
 * const loader = DataLoaderFactory.getLoader('monitoring');
 */
export function createDataLoader(mode, options = {}) {
    switch (mode) {
        case 'monitoring':
            return new MonitoringDataLoader(options);
            
        case 'analysis':
            return new AnalysisDataLoader(options);
            
        case 'dashboard':
            return new DashboardDataLoader(options);
            
        default:
            throw new Error(`Unknown loader mode: ${mode}`);
    }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 모든 DataLoader 클래스 조회
 * 
 * @returns {Object}
 */
export function getAvailableLoaders() {
    return {
        monitoring: {
            class: MonitoringDataLoader,
            className: 'MonitoringDataLoader',
            status: 'implemented',
            description: 'Real-time equipment monitoring with WebSocket',
            features: [
                'WebSocket real-time updates',
                'Initial status loading',
                'Reconnection handling',
                'Equipment state management'
            ]
        },
        analysis: {
            class: AnalysisDataLoader,
            className: 'AnalysisDataLoader',
            status: 'skeleton',
            description: 'Large-scale data analysis with pagination/streaming',
            features: [
                'Pagination support',
                'Streaming support',
                'Query-level caching',
                'TimescaleDB optimization',
                'HeatMap/TimeSeries transformation'
            ]
        },
        dashboard: {
            class: DashboardDataLoader,
            className: 'DashboardDataLoader',
            status: 'skeleton',
            description: 'Dashboard widgets data loading with Redis cache',
            features: [
                'Widget-based loading',
                'Redis Pub/Sub integration',
                'TTL-based caching',
                'Priority-based refresh',
                'Batch loading optimization'
            ]
        }
    };
}

/**
 * DataLoader 상태 상수 조회
 * 
 * @returns {Object}
 */
export function getLoaderStates() {
    return DataLoaderState;
}

/**
 * DataLoader 이벤트 상수 조회
 * 
 * @returns {Object}
 */
export function getLoaderEvents() {
    return DataLoaderEvents;
}

/**
 * 로더 모드 상수 조회
 * 
 * @returns {Object}
 */
export function getLoaderModes() {
    return LoaderMode;
}

// ============================================
// 타입 정의 (JSDoc)
// ============================================

/**
 * @typedef {Object} LoadResult
 * @property {boolean} success - 성공 여부
 * @property {Object} [data] - 로드된 데이터
 * @property {string} [error] - 오류 메시지
 * @property {boolean} [fromCache] - 캐시 여부
 */

/**
 * @typedef {Object} WidgetResult
 * @property {boolean} success - 성공 여부
 * @property {string} widgetId - 위젯 ID
 * @property {Object} [data] - 위젯 데이터
 * @property {boolean} [fromCache] - 캐시 여부
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {boolean} success - 성공 여부
 * @property {Array} data - 데이터 배열
 * @property {Object} pagination - 페이지네이션 정보
 * @property {number} pagination.currentPage - 현재 페이지
 * @property {number} pagination.totalPages - 전체 페이지
 * @property {number} pagination.totalRecords - 전체 레코드 수
 * @property {boolean} pagination.hasNext - 다음 페이지 존재 여부
 * @property {boolean} pagination.hasPrev - 이전 페이지 존재 여부
 */

/**
 * @typedef {Object} StreamResult
 * @property {boolean} success - 성공 여부
 * @property {number} chunksReceived - 수신된 청크 수
 * @property {number} totalRecords - 전체 레코드 수
 */

/**
 * @typedef {Object} FactoryStatus
 * @property {boolean} isConfigured - 설정 완료 여부
 * @property {number} activeLoaders - 활성 로더 수
 * @property {string[]} availableModes - 사용 가능한 모드
 * @property {Object} loaders - 로더별 상태
 * @property {Object} dependencies - 의존성 상태
 */