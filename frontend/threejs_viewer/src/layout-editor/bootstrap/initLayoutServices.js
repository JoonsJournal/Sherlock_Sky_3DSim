/**
 * initLayoutServices.js
 * =====================
 * Layout Editor 서비스 초기화
 * 
 * main.js bootstrap 패턴 적용
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/bootstrap/initLayoutServices.js
 */

/**
 * Canvas2DEditor 초기화
 */
function initCanvas(containerId = 'canvas-container') {
    if (typeof Canvas2DEditor === 'undefined') {
        throw new Error('Canvas2DEditor가 로드되지 않았습니다.');
    }
    
    const size = calculateCanvasSize();
    const canvas = new Canvas2DEditor(containerId, {
        width: size.width,
        height: size.height,
        showGrid: true,
        snapToGrid: true,
        gridSize: 10
    });
    
    console.log('  ✓ Canvas2DEditor');
    return canvas;
}

/**
 * Canvas 크기 계산
 */
function calculateCanvasSize() {
    const dims = window.LayoutEditorConfig?.getLayoutDimensions?.() || {
        TOOLBAR_WIDTH: 60,
        TOOLBAR_EXPANDED_WIDTH: 270,
        PROPERTY_PANEL_WIDTH: 260,
        HEADER_HEIGHT: 48,
        STATUS_HEIGHT: 30
    };
    
    const state = window.layoutEditorState;
    const toolbarWidth = state?.componentSubmenuVisible 
        ? dims.TOOLBAR_EXPANDED_WIDTH 
        : dims.TOOLBAR_WIDTH;
        
    return {
        width: window.innerWidth - toolbarWidth - dims.PROPERTY_PANEL_WIDTH,
        height: window.innerHeight - dims.HEADER_HEIGHT - dims.STATUS_HEIGHT
    };
}

/**
 * CommandManager 초기화
 */
function initCommandManager() {
    if (typeof CommandManager === 'undefined') {
        console.warn('⚠️ CommandManager 미로드 - Undo/Redo 비활성화');
        return null;
    }
    
    const maxHistory = window.LayoutEditorConfig?.COMMAND_CONFIG?.maxHistory || 50;
    const state = window.layoutEditorState;
    
    const commandManager = new CommandManager({
        maxHistory,
        onHistoryChange: (historyState) => {
            // State 업데이트
            if (state?.updateHistory) {
                state.updateHistory(historyState);
            }
            // DOM 직접 업데이트
            const undoBtn = document.getElementById('btn-undo');
            const redoBtn = document.getElementById('btn-redo');
            if (undoBtn) undoBtn.disabled = !historyState.canUndo;
            if (redoBtn) redoBtn.disabled = !historyState.canRedo;
            
            const undoStatus = document.getElementById('status-undo');
            const redoStatus = document.getElementById('status-redo');
            if (undoStatus) undoStatus.textContent = historyState.undoCount;
            if (redoStatus) redoStatus.textContent = historyState.redoCount;
        }
    });
    
    console.log('  ✓ CommandManager');
    return commandManager;
}

/**
 * ToolService 초기화
 */
function initToolService(canvas, options = {}) {
    if (typeof ToolService === 'undefined') {
        console.warn('⚠️ ToolService 미로드');
        return null;
    }
    
    const toolService = new ToolService(canvas, {
        state: window.layoutEditorState,
        onToolChanged: options.onToolChanged || ((tool) => console.log(`🔧 Tool: ${tool}`)),
        onToast: options.onToast || (() => {})
    });
    
    toolService.initAllTools();
    console.log('  ✓ ToolService');
    return toolService;
}

/**
 * ComponentService 초기화
 */
function initComponentService(canvas, commandManager, options = {}) {
    if (typeof ComponentService === 'undefined') {
        console.warn('⚠️ ComponentService 미로드');
        return null;
    }
    
    const componentService = new ComponentService(canvas, commandManager, {
        selectionTool: options.selectionTool,
        onComponentCreated: options.onComponentCreated || (() => {}),
        onStatusUpdate: options.onStatusUpdate || (() => {})
    });
    
    console.log('  ✓ ComponentService');
    return componentService;
}

/**
 * KeyboardService 초기화
 */
function initKeyboardService(canvas, commandManager) {
    if (typeof KeyboardService === 'undefined') {
        console.warn('⚠️ KeyboardService 미로드');
        return null;
    }
    
    const keyboardService = new KeyboardService({
        canvas,
        commandManager,
        state: window.layoutEditorState
    });
    
    console.log('  ✓ KeyboardService');
    return keyboardService;
}

/**
 * 모든 서비스 초기화 (통합)
 */
function initLayoutServices(options = {}) {
    console.log('🔧 Layout Services 초기화 시작...');
    
    // 1. Canvas 초기화
    const canvas = initCanvas(options.containerId);
    
    // 2. CommandManager 초기화
    const commandManager = initCommandManager();
    canvas.commandManager = commandManager;
    
    // 3. ToolService 초기화
    const toolService = initToolService(canvas, {
        onToolChanged: options.onToolChanged,
        onToast: options.onToast
    });
    
    // 4. ComponentService 초기화
    const componentService = initComponentService(canvas, commandManager, {
        selectionTool: toolService?.getTool('selection'),
        onComponentCreated: options.onComponentCreated,
        onStatusUpdate: options.onStatusUpdate
    });
    
    // 5. KeyboardService 초기화
    const keyboardService = initKeyboardService(canvas, commandManager);
    
    console.log('✅ Layout Services 초기화 완료');
    
    return {
        canvas,
        commandManager,
        toolService,
        componentService,
        keyboardService
    };
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.initLayoutServices = initLayoutServices;
    window.initCanvas = initCanvas;
    window.initCommandManager = initCommandManager;
    window.initToolService = initToolService;
    window.initComponentService = initComponentService;
    window.initKeyboardService = initKeyboardService;
    window.calculateCanvasSize = calculateCanvasSize;
}

console.log('✅ initLayoutServices.js 로드 완료');