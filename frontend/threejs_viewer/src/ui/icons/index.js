/**
 * index.js
 * ========
 * SHERLOCK SKY 3DSim - 아이콘 모듈 통합 export
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 2.0.0
 * @created 2026-01-11
 * 
 * 사용법:
 *   import { ICONS, getIcon, iconRegistry } from './ui/icons/index.js';
 *   element.innerHTML = getIcon('connection');
 * 
 * 파일 위치: frontend/threejs_viewer/src/ui/icons/index.js
 */

// 모든 export를 IconRegistry.js에서 가져옴
export { 
    ICONS, 
    ICON_META,
    IconRegistry,
    iconRegistry,
    getIcon, 
    getIconHTML,
    getIconList, 
    hasIcon,
    default as IconRegistryModule
} from './IconRegistry.js';