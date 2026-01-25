/**
 * EquipmentEditState.js (Legacy Alias)
 * 기존 import 경로 하위 호환성 유지
 * 
 * @version 1.0.0
 * @deprecated 새 경로를 사용하세요:
 * import { EquipmentEditState } from './equipment-edit/index.js';
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/EquipmentEditState.js
 */

// Deprecation 경고 (한 번만)
let warned = false;
if (!warned && typeof console !== 'undefined') {
    console.warn(
        '⚠️ [DEPRECATED] Import path "services/EquipmentEditState.js" is deprecated.\n' +
        '   Use "services/equipment-edit/index.js" instead.\n' +
        '   This alias will be removed in a future version.'
    );
    warned = true;
}

export { EquipmentEditState } from './equipment-edit/index.js';