/**
 * tools/index.js
 * ==============
 * 
 * Layout Editor 도구 모듈 export
 * 
 * @version 1.0.0 - Phase 4-1
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/tools/index.js
 */

// Base Tool
export * from './base/index.js';

// Tool implementations
export { AlignmentTool } from './AlignmentTool.js';
export { EquipmentArrayTool } from './EquipmentArrayTool.js';
export { GroupingTool } from './GroupingTool.js';
export { ObjectSelectionTool } from './ObjectSelectionTool.js';
export { WallDrawTool } from './WallDrawTool.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.LayoutEditorTools = {
        AlignmentTool: window.AlignmentTool,
        EquipmentArrayTool: window.EquipmentArrayTool,
        GroupingTool: window.GroupingTool,
        ObjectSelectionTool: window.ObjectSelectionTool,
        WallDrawTool: window.WallDrawTool
    };
    
    console.log('[tools/index.js] Layout Editor 도구 모듈 export 완료');
}