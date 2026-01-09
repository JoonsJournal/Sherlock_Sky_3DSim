/**
 * icons/index.js
 * ==============
 * SHERLOCK SKY 3DSim - SVG 아이콘 모듈 진입점
 * 
 * 모든 아이콘 관련 기능을 하나의 import로 사용
 * 
 * @version 1.0.0
 * @created 2026-01-10
 * 
 * 사용법:
 * import { iconRegistry, ICONS, IconRegistry } from './icons/index.js';
 * 
 * // 아이콘 SVG 생성
 * const svg = iconRegistry.createIcon('connection', { size: 28 });
 * 
 * // HTML 문자열로 아이콘 얻기
 * const html = iconRegistry.getIconHTML('monitoring');
 * 
 * // 아이콘 목록 조회
 * const iconNames = iconRegistry.listIcons();
 */

export { 
    ICONS,
    IconRegistry, 
    iconRegistry 
} from './IconRegistry.js';

// 기본 export는 싱글톤 인스턴스
export { iconRegistry as default } from './IconRegistry.js';
