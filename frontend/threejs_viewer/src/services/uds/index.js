/**
 * index.js
 * =========
 * UDS (Unified Data Store) 서비스 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - UnifiedDataStore 및 관련 모듈 통합 export
 * 
 * @exports
 * - UnifiedDataStore (class)
 * - unifiedDataStore (singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/uds/index.js
 * 작성일: 2026-01-20
 * 수정일: 2026-01-20
 */

// =========================================================================
// Core Exports
// =========================================================================

export { 
    UnifiedDataStore, 
    unifiedDataStore 
} from './UnifiedDataStore.js';

// =========================================================================
// Re-export API Client (편의용)
// =========================================================================

export { 
    UDSApiClient, 
    udsApiClient 
} from '../../api/UDSApiClient.js';