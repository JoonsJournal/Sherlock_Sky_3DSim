/**
 * components/index.js
 * ===================
 * 
 * Layout Editor 컴포넌트 모듈 export
 * 
 * @version 1.0.0 - Phase 4-1
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/components/index.js
 */

// ES Module exports
export { Canvas2DEditor } from './Canvas2DEditor.js';
export { ComponentPalette } from './ComponentPalette.js';
export { EquipmentArrayDialog } from './EquipmentArrayDialog.js';
export { PropertyPanel } from './PropertyPanel.js';
export { TemplateDialog } from './TemplateDialog.js';
export { Toolbar } from './Toolbar.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.LayoutEditorComponents = {
        Canvas2DEditor: window.Canvas2DEditor,
        ComponentPalette: window.ComponentPalette,
        EquipmentArrayDialog: window.EquipmentArrayDialog,
        PropertyPanel: window.PropertyPanel,
        TemplateDialog: window.TemplateDialog,
        Toolbar: window.Toolbar
    };
    
    console.log('[components/index.js] Layout Editor 컴포넌트 모듈 export 완료');
}