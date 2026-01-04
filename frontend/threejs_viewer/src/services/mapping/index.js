/**
 * services/mapping/index.js
 * 매핑 서비스 모듈 통합 export
 * 
 * @version 1.1.0
 * @changelog
 * - v1.1.0: MappingFileManager export 추가
 */

export { EquipmentMappingService } from './EquipmentMappingService.js';
export { 
    MappingFileManager, 
    mappingFileManager, 
    FILE_FORMAT_VERSION, 
    SUPPORTED_VERSIONS 
} from './MappingFileManager.js';