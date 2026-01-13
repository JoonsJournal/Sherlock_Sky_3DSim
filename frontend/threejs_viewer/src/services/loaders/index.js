/**
 * loaders/index.js
 * ================
 * 
 * DataLoader 모듈 통합 export
 * 
 * @version 1.1.0
 * @module loaders
 * 
 * @changelog
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
// Monitoring DataLoader
// ============================================

export {
    MonitoringDataLoader,
    default as MonitoringDataLoaderDefault
} from './MonitoringDataLoader.js';

// ============================================
// Analysis DataLoader (스켈레톤)
// ============================================

export {
    AnalysisDataLoader,
    AnalysisDataType,
    default as AnalysisDataLoaderDefault
} from './AnalysisDataLoader.js';

// ============================================
// Dashboard DataLoader (미래 확장)
// ============================================

// TODO: DashboardDataLoader 구현 후 export
// export {
//     DashboardDataLoader,
//     DashboardDataType
// } from './DashboardDataLoader.js';

// ============================================
// 팩토리 함수
// ============================================

/**
 * 모드에 따른 DataLoader 생성
 * 
 * @param {string} mode - 모드 ('monitoring', 'analysis', 'dashboard')
 * @param {Object} options - DataLoader 옵션
 * @returns {IDataLoader}
 */
export function createDataLoader(mode, options = {}) {
    switch (mode) {
        case 'monitoring':
            const { MonitoringDataLoader } = require('./MonitoringDataLoader.js');
            return new MonitoringDataLoader(options);
            
        case 'analysis':
            const { AnalysisDataLoader } = require('./AnalysisDataLoader.js');
            return new AnalysisDataLoader(options);
            
        // case 'dashboard':
        //     const { DashboardDataLoader } = require('./DashboardDataLoader.js');
        //     return new DashboardDataLoader(options);
            
        default:
            throw new Error(`Unknown loader mode: ${mode}`);
    }
}

/**
 * 모든 DataLoader 클래스 조회
 * 
 * @returns {Object}
 */
export function getAvailableLoaders() {
    return {
        monitoring: {
            class: 'MonitoringDataLoader',
            status: 'implemented',
            description: 'Real-time equipment monitoring with WebSocket'
        },
        analysis: {
            class: 'AnalysisDataLoader',
            status: 'skeleton',
            description: 'Large-scale data analysis with pagination/streaming'
        },
        dashboard: {
            class: 'DashboardDataLoader',
            status: 'planned',
            description: 'Dashboard widgets data loading'
        }
    };
}