/**
 * IconRegistry.js
 * ================
 * Cleanroom Sidebar - SVG 아이콘 레지스트리 (호환용 Re-export)
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 2.0.0
 * @created 2026-01-11
 * @updated 2026-01-11 - icons/IconRegistry.js로 이동, re-export 처리
 * 
 * [DEPRECATED] 이 파일은 호환성을 위해 유지됩니다.
 * 새 코드에서는 '../icons/IconRegistry.js'를 직접 import 하세요.
 * 
 * 사용법:
 *   // 기존 코드 (호환 유지)
 *   import { ICONS, getIcon } from './IconRegistry.js';
 *   
 *   // 권장 (새 코드)
 *   import { ICONS, getIcon, iconRegistry } from '../icons/IconRegistry.js';
 */

// ============================================
// 새 위치에서 Re-export
// ============================================

export { 
    ICONS, 
    ICON_META,
    IconRegistry,
    iconRegistry,
    getIcon, 
    getIconHTML,
    getIconList, 
    hasIcon,
    default
} from '../icons/IconRegistry.js';