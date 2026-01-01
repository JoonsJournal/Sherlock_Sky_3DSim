/**
 * Converter Module Index
 * 2D ↔ 3D 변환 모듈 통합 export
 * 
 * @version 1.0.0 - Phase 4.1
 */

// 클래스 export
export { CoordinateUtils, coordinateUtils } from './CoordinateUtils.js';
export { Layout2DTo3DConverter, layout2DTo3DConverter } from './Layout2DTo3DConverter.js';

// 편의 함수
export function convertLayout(layoutData) {
    const { layout2DTo3DConverter } = require('./Layout2DTo3DConverter.js');
    return layout2DTo3DConverter.convert(layoutData);
}

console.log('[Converter Module] ✅ 로드 완료');