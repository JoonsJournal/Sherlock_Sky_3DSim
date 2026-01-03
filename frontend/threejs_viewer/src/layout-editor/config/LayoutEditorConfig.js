/**
 * LayoutEditorConfig.js
 * =====================
 * Layout Editor 설정 및 상수 정의
 * 
 * main.js 통합 대비 - 독립적 설정 모듈
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/config/LayoutEditorConfig.js
 */

// =====================================================
// 컴포넌트 정의
// =====================================================
const COMPONENTS = {
    partition: { 
        id: 'partition', 
        name: 'Partition', 
        icon: '🧱',
        width: 3.0, 
        depth: 2.5, 
        color: '#888888',
        layer: 'room'
    },
    desk: { 
        id: 'desk', 
        name: 'Desk', 
        icon: '🪑',
        width: 1.6, 
        depth: 0.8, 
        color: '#8B4513',
        layer: 'room'
    },
    pillar: { 
        id: 'pillar', 
        name: 'Pillar', 
        icon: '🏛️',
        width: 0.3, 
        depth: 0.3, 
        color: '#333333',
        layer: 'room'
    },
    office: { 
        id: 'office', 
        name: 'Office', 
        icon: '🏢',
        width: 12.0, 
        depth: 20.0, 
        color: '#87CEEB',
        layer: 'room'
    },
    equipment: { 
        id: 'equipment', 
        name: 'Equipment', 
        icon: '⚙️',
        width: 1.5, 
        depth: 3.0, 
        color: '#FF8C00',
        layer: 'equipment'
    }
};

// =====================================================
// 레이아웃 크기 설정 (CSS 변수에서 읽기)
// =====================================================
function getLayoutDimensions() {
    const rootStyles = getComputedStyle(document.documentElement);
    
    return {
        TOOLBAR_WIDTH: parseInt(rootStyles.getPropertyValue('--toolbar-width')) || 60,
        TOOLBAR_EXPANDED_WIDTH: parseInt(rootStyles.getPropertyValue('--toolbar-expanded-width')) || 270,
        SUBMENU_WIDTH: parseInt(rootStyles.getPropertyValue('--submenu-width')) || 210,
        PROPERTY_PANEL_WIDTH: parseInt(rootStyles.getPropertyValue('--property-panel-width')) || 260,
        HEADER_HEIGHT: parseInt(rootStyles.getPropertyValue('--header-height')) || 48,
        STATUS_HEIGHT: parseInt(rootStyles.getPropertyValue('--status-height')) || 30,
        BTN_SIZE: parseInt(rootStyles.getPropertyValue('--btn-size')) || 44
    };
}

// =====================================================
// Canvas 기본 설정
// =====================================================
const CANVAS_CONFIG = {
    showGrid: true,
    snapToGrid: true,
    gridSize: 10,
    scale: 10,  // 1m = 10px
    minZoom: 0.1,
    maxZoom: 5.0,
    zoomStep: 0.1,
    wheelSensitivity: 0.001
};

// =====================================================
// Command 설정
// =====================================================
const COMMAND_CONFIG = {
    maxHistory: 50
};

// =====================================================
// 키보드 단축키 정의
// =====================================================
const KEYBOARD_SHORTCUTS = {
    // Ctrl/Cmd 조합
    ctrlCombinations: {
        'z': 'undo',
        'y': 'redo',
        'a': 'selectAll',
        's': 'save',
        'd': 'duplicate',
        'g': 'group',
        'shift+g': 'ungroup'
    },
    // 일반 키
    single: {
        'v': 'selectTool',
        'w': 'wallTool',
        'c': 'toggleComponentSubmenu',
        'g': 'toggleGrid',
        's': 'toggleSnap',
        'm': 'toggleMICESnap',
        'h': 'toggleSmartGuides',
        'l': 'toggleAlignPopup',
        'r': 'rotateCW',
        'shift+r': 'rotateCCW',
        '=': 'zoomIn',
        '+': 'zoomIn',
        '-': 'zoomOut',
        '_': 'zoomOut',
        '0': 'resetZoom',
        'delete': 'deleteSelected',
        'backspace': 'deleteSelected',
        'a': 'showEquipmentArrayModal',
        '[': 'sendBackward',
        'shift+[': 'sendToBack',
        ']': 'bringForward',
        'shift+]': 'bringToFront',
        'escape': 'escape',
        '?': 'toggleShortcutsHelp'
    },
    // Arrow Keys
    arrows: {
        'arrowleft': { dx: -1, dy: 0 },
        'arrowright': { dx: 1, dy: 0 },
        'arrowup': { dx: 0, dy: -1 },
        'arrowdown': { dx: 0, dy: 1 }
    },
    arrowShiftMultiplier: 10
};

// =====================================================
// 툴 정의
// =====================================================
const TOOLS = {
    select: {
        id: 'select',
        name: '선택',
        icon: '🖱️',
        cursor: 'default'
    },
    wall: {
        id: 'wall',
        name: '벽 그리기',
        icon: '📏',
        cursor: 'crosshair'
    }
};

// =====================================================
// 상태바 항목 정의
// =====================================================
const STATUS_ITEMS = {
    tool: { id: 'status-tool', label: 'Tool' },
    objects: { id: 'status-objects', label: 'Objects' },
    selected: { id: 'status-selected', label: 'Selected' },
    grid: { id: 'status-grid', label: 'Grid' },
    snap: { id: 'status-snap', label: 'Snap' },
    miceSnap: { id: 'status-mice-snap', label: 'MICE' },
    smartGuides: { id: 'status-smart-guides', label: 'Guides' },
    groups: { id: 'status-groups', label: 'Groups' },
    zoom: { id: 'status-zoom', label: 'Zoom' },
    undo: { id: 'status-undo', label: 'Undo' },
    redo: { id: 'status-redo', label: 'Redo' }
};

// =====================================================
// DOM Element IDs
// =====================================================
const DOM_IDS = {
    // Containers
    canvasContainer: 'canvas-container',
    toolbarContainer: 'toolbar-container',
    propertyPanel: 'property-panel',
    loadingIndicator: 'loading-indicator',
    
    // Buttons
    btnUndo: 'btn-undo',
    btnRedo: 'btn-redo',
    btnHelp: 'btn-help',
    btnSave: 'btn-save',
    btnExportPng: 'btn-export-png',
    toolSelect: 'tool-select',
    toolRoom: 'tool-room',
    toolWall: 'tool-wall',
    componentBtn: 'component-btn',
    toolGrid: 'tool-grid',
    toolSnap: 'tool-snap',
    toolZoomIn: 'tool-zoom-in',
    toolZoomOut: 'tool-zoom-out',
    toolZoomReset: 'tool-zoom-reset',
    toolSelectAll: 'tool-select-all',
    toolDelete: 'tool-delete',
    toolDeselect: 'tool-deselect',
    alignBtn: 'align-btn',
    toolRotate: 'tool-rotate',
    toolSample: 'tool-sample',
    toolEqArray: 'tool-eq-array',
    toolGroup: 'tool-group',
    toolUngroup: 'tool-ungroup',
    
    // Modals
    roomSizeModal: 'room-size-modal',
    eqArrayModal: 'eq-array-modal',
    
    // Popups
    alignPopup: 'align-popup',
    shortcutsHelp: 'shortcuts-help',
    dropGuide: 'drop-guide'
};

// =====================================================
// 이벤트 이름 정의 (EventBus 통합 대비)
// =====================================================
const LAYOUT_EVENTS = {
    // 초기화
    INITIALIZED: 'layout:initialized',
    
    // 상태 변경
    TOOL_CHANGED: 'layout:tool:changed',
    SELECTION_CHANGED: 'layout:selection:changed',
    ZOOM_CHANGED: 'layout:zoom:changed',
    
    // 컴포넌트
    COMPONENT_CREATED: 'layout:component:created',
    COMPONENT_DELETED: 'layout:component:deleted',
    COMPONENT_MOVED: 'layout:component:moved',
    COMPONENT_ROTATED: 'layout:component:rotated',
    
    // 히스토리
    HISTORY_CHANGED: 'layout:history:changed',
    UNDO: 'layout:undo',
    REDO: 'layout:redo',
    
    // UI
    SUBMENU_TOGGLED: 'layout:submenu:toggled',
    POPUP_TOGGLED: 'layout:popup:toggled',
    
    // 저장/로드
    LAYOUT_SAVED: 'layout:saved',
    LAYOUT_LOADED: 'layout:loaded',
    
    // 그룹
    GROUP_CREATED: 'layout:group:created',
    GROUP_UNGROUPED: 'layout:group:ungrouped'
};

// =====================================================
// Export (전역 + ES6 모듈 호환)
// =====================================================

// 전역 객체로 노출 (script 태그 로드 호환)
if (typeof window !== 'undefined') {
    window.LayoutEditorConfig = {
        COMPONENTS,
        getLayoutDimensions,
        CANVAS_CONFIG,
        COMMAND_CONFIG,
        KEYBOARD_SHORTCUTS,
        TOOLS,
        STATUS_ITEMS,
        DOM_IDS,
        LAYOUT_EVENTS
    };
}

// ES6 모듈 export (번들러 사용 시)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        COMPONENTS,
        getLayoutDimensions,
        CANVAS_CONFIG,
        COMMAND_CONFIG,
        KEYBOARD_SHORTCUTS,
        TOOLS,
        STATUS_ITEMS,
        DOM_IDS,
        LAYOUT_EVENTS
    };
}

console.log('✅ LayoutEditorConfig.js 로드 완료');