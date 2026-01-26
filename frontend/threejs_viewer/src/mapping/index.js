/**
 * mapping/index.js
 * =================
 * Mapping 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - mapping/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * - main.js 리팩토링 Phase 8
 * 
 * @changelog
 * - v1.0.0: Phase 8 - 초기 생성 (2026-01-26)
 *           - MappingInitializer 모듈 export
 *           - MappingLoader 모듈 export
 *           - ⚠️ 호환성: main.js 기존 기능 100% 유지
 * 
 * @exports
 * - MappingInitializer.js: Mapping 서비스 초기화
 * - MappingLoader.js: 매핑 데이터 로드
 * 
 * 📁 위치: frontend/threejs_viewer/src/mapping/index.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

// ============================================
// MappingInitializer - 서비스 초기화 (Phase 8.1)
// ============================================
export {
    initMappingServices,
    getMappingServiceStatus,
    cleanupMappingServices
} from './MappingInitializer.js';

// ============================================
// MappingLoader - 데이터 로드 (Phase 8.2)
// ============================================
export {
    loadEquipmentMappingsAfterConnection,
    fallbackToLocalMappings,
    forceRefreshMappings,
    getMappingLoadStatus
} from './MappingLoader.js';

// ============================================
// 통합 디버그 함수
// ============================================

import { getMappingServiceStatus } from './MappingInitializer.js';
import { getMappingLoadStatus } from './MappingLoader.js';

/**
 * Mapping 모듈 디버그 정보 출력
 * 
 * @example
 * import { debugMappingModule } from './mapping/index.js';
 * debugMappingModule();
 */
export function debugMappingModule() {
    console.group('📦 Mapping Module Debug (v1.0.0)');
    
    console.log('Service Status:', getMappingServiceStatus());
    console.log('Load Status:', getMappingLoadStatus());
    
    console.groupEnd();
}