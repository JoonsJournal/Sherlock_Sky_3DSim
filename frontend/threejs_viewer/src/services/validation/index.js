/**
 * Validation Module Index
 * ========================
 * 
 * Layout 검증 모듈의 통합 Export 파일
 * 
 * 사용법:
 * import { LayoutValidator, ValidationRules, ErrorReporter } from './services/validation/index.js';
 * 
 * 또는 개별 import:
 * import { LayoutValidator } from './services/validation/LayoutValidator.js';
 * 
 * 위치: frontend/threejs_viewer/src/services/validation/index.js
 */

// 메인 Validator
export { LayoutValidator, default as LayoutValidatorDefault } from './LayoutValidator.js';

// 검증 규칙 및 상수
export { 
    ValidationRules, 
    ERROR_TYPES, 
    SEVERITY, 
    ERROR_MESSAGES,
    getErrorMessage 
} from './ValidationRules.js';

// 에러 리포터
export { ErrorReporter, default as ErrorReporterDefault } from './ErrorReporter.js';

/**
 * 편의를 위한 전역 인스턴스 생성 함수
 * @returns {LayoutValidator}
 */
export function createValidator() {
    const { LayoutValidator } = require('./LayoutValidator.js');
    return new LayoutValidator();
}

// 버전 정보
export const VERSION = '1.0.0';

// 모듈 정보
export const MODULE_INFO = {
    name: 'LayoutValidation',
    version: VERSION,
    description: 'Layout Editor Validation Module',
    author: 'SHERLOCK_SKY_3DSIM',
    phase: '3.2'
};

console.log(`[Validation Module] v${VERSION} 로드 완료`);