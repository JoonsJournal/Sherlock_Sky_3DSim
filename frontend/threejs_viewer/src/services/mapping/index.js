/**
 * Mapping Services Index
 * 설비 매핑 관련 서비스 모음
 * 
 * @version 2.0.0
 * 
 * Changelog:
 * - v2.0.0 (2026-01-13): EquipmentMappingService를 default export로 변경
 *                        MappingConfigService deprecated 표시
 * - v1.0.0: 초기 버전
 * 
 * Usage:
 * ```javascript
 * // 권장 방식 - default import
 * import MappingService from './services/mapping';
 * // 또는
 * import { EquipmentMappingService } from './services/mapping';
 * 
 * // Deprecated - MappingConfigService 사용 비권장
 * import { MappingConfigService } from './services/mapping';  // ⚠️ deprecated
 * ```
 */

// ==========================================
// Primary Service (Recommended)
// ==========================================

/**
 * EquipmentMappingService - 권장 매핑 서비스
 * 설비 매핑의 모든 기능을 통합 제공
 */
export { EquipmentMappingService } from './EquipmentMappingService.js';

// ==========================================
// File Management
// ==========================================

/**
 * MappingFileManager - 매핑 파일 관리
 * JSON 파일 기반 매핑 데이터 저장/로드
 */
export { MappingFileManager } from './MappingFileManager.js';

// ==========================================
// Deprecated Services (Backward Compatibility)
// ==========================================

/**
 * @deprecated v2.0.0부터 deprecated.
 * EquipmentMappingService를 대신 사용하세요.
 * 
 * MappingConfigService - 서버 중앙화 매핑 Config 서비스
 * 이 서비스는 하위 호환성을 위해 유지되며, 
 * 내부적으로 EquipmentMappingService로 위임합니다.
 * 
 * @see EquipmentMappingService
 * 
 * Migration:
 * ```javascript
 * // Old (deprecated):
 * import { MappingConfigService } from './services/mapping';
 * const configService = new MappingConfigService({ apiClient });
 * await configService.loadSiteMapping(siteId);
 * 
 * // New (recommended):
 * import { EquipmentMappingService } from './services/mapping';
 * const mappingService = new EquipmentMappingService({ apiClient, editState });
 * await mappingService.loadMappingsForSite(siteId);
 * ```
 */
export { MappingConfigService } from './MappingConfigService.js';

// ==========================================
// Default Export
// ==========================================

/**
 * Default export: EquipmentMappingService
 * 
 * 가장 일반적인 사용 케이스를 위한 기본 export
 * 
 * @example
 * import MappingService from './services/mapping';
 * const service = new MappingService({ apiClient, editState });
 */
import { EquipmentMappingService } from './EquipmentMappingService.js';
export default EquipmentMappingService;

// ==========================================
// Type Definitions (for documentation)
// ==========================================

/**
 * @typedef {Object} MappingData
 * @property {string} frontend_id - Frontend 설비 ID (예: 'EQ-01-01')
 * @property {number} equipment_id - DB Equipment ID
 * @property {string} equipment_name - 설비명
 * @property {string} [line_name] - 라인명 (optional)
 * @property {string} [equipment_code] - 설비 코드 (optional)
 * @property {string} [mapped_at] - 매핑 시간 (ISO format)
 */

/**
 * @typedef {Object} MappingServiceOptions
 * @property {Object} apiClient - ApiClient 인스턴스
 * @property {Object} editState - EquipmentEditState 인스턴스
 * @property {string} [siteId] - 초기 사이트 ID
 */

/**
 * @typedef {Object} LoadMappingResult
 * @property {boolean} connected - 연결 성공 여부
 * @property {string} [siteId] - 사이트 ID
 * @property {number} [count] - 로드된 매핑 개수
 * @property {string} [error] - 에러 메시지 (실패 시)
 */