/**
 * initLayoutServices.js v2.1.0
 * ============================
 * Layout Editor 서비스 초기화
 * 
 * ✨ v2.1.0 수정 (EditorStateManager 통합):
 * - ✅ EditorStateManager 초기화 추가
 * - ✅ cleanupAfterUndoRedo → stateManager.cleanupAfterHistoryChange() 대체
 * - ✅ Header 버튼에서 StateManager 사용
 * - ✅ 전역 참조 window.stateManager 추가
 * 
 * ✨ v2.0.1 수정:
 * - ✅ Undo/Redo 후 HandleManager 업데이트 추가
 * - ✅ canvas.handleManager?.detach() 호출로 조정틀 제거
 * 
 * ✨ v2.0.0 수정 (Phase 5.1 - Tool-Command 통합):
 * - ✅ ToolService에 CommandManager 전달
 * - ✅ initToolService에서 commandManager 옵션 추가
 * - ✅ Tools에 CommandManager 자동 연결
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
 * ✨ v2.1.0: EditorStateManager 초기화
 */
function initStateManager(canvas) {
    if (typeof EditorStateManager === 'undefined') {
        console.warn('⚠️ EditorStateManager 미로드 - 통합 상태 관리 비활성화');
        return null;
    }
    
    const stateManager = new EditorStateManager();
    stateManager.setEditor(canvas);
    
    // Canvas에 참조 저장
    canvas.stateManager = stateManager;
    
    // 전역 참조 (폴백용)
    window.stateManager = stateManager;
    
    console.log('  ✓ EditorStateManager');
    return stateManager;
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
            
            // DOM 업데이트 (Undo/Redo 버튼 + Status Bar)
            updateUndoRedoUI(historyState);
        }
    });
    
    // 전역 참조 저장 (폴백용)
    window.commandManager = commandManager;
    
    console.log('  ✓ CommandManager');
    return commandManager;
}

/**
 * Undo/Redo UI 업데이트 헬퍼
 */
function updateUndoRedoUI(historyState) {
    // Header 버튼 활성화/비활성화
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !historyState.canUndo;
    if (redoBtn) redoBtn.disabled = !historyState.canRedo;
    
    // Status Bar 업데이트
    const undoStatus = document.getElementById('status-undo');
    const redoStatus = document.getElementById('status-redo');
    if (undoStatus) undoStatus.textContent = historyState.undoCount;
    if (redoStatus) redoStatus.textContent = historyState.redoCount;
    
    console.log(`[History] Undo: ${historyState.undoCount}, Redo: ${historyState.redoCount}`);
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
        onToast: options.onToast || (() => {}),
        commandManager: options.commandManager || null
    });
    
    toolService.initAllTools();
    
    // CommandManager가 나중에 전달된 경우 연결
    if (options.commandManager && !toolService.commandManager) {
        toolService.setCommandManager(options.commandManager);
    }
    
    console.log('  ✓ ToolService (with CommandManager)');
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
 * ✨ v2.1.0: Header 버튼 이벤트 설정 (StateManager 사용)
 */
function setupHeaderButtonEvents(commandManager, canvas, stateManager) {
    // Undo 버튼
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (commandManager?.undo()) {
                // ✅ v2.1.0: StateManager로 통합 정리
                if (stateManager) {
                    stateManager.cleanupAfterHistoryChange();
                } else {
                    // 폴백: 기존 방식
                    cleanupAfterUndoRedo(canvas);
                }
                console.log('[Header] Undo 실행 완료');
            }
        });
    }
    
    // Redo 버튼
    const redoBtn = document.getElementById('btn-redo');
    if (redoBtn) {
        redoBtn.addEventListener('click', () => {
            if (commandManager?.redo()) {
                // ✅ v2.1.0: StateManager로 통합 정리
                if (stateManager) {
                    stateManager.cleanupAfterHistoryChange();
                } else {
                    // 폴백: 기존 방식
                    cleanupAfterUndoRedo(canvas);
                }
                console.log('[Header] Redo 실행 완료');
            }
        });
    }
    
    console.log('  ✓ Header Undo/Redo 버튼 이벤트 (v2.1.0)');
}

/**
 * [폴백용] Undo/Redo 후 Canvas 상태 정리
 * StateManager가 없을 때 사용
 */
function cleanupAfterUndoRedo(canvas) {
    // HandleManager 해제
    if (canvas.handleManager) {
        canvas.handleManager.detach();
        console.log('[Undo/Redo] HandleManager detached');
    }
    
    // Transformer 업데이트 (폴백)
    if (canvas.transformer) {
        canvas.transformer.nodes([]);
        canvas.transformer.forceUpdate?.();
    }
    
    // SelectionRenderer 정리
    if (canvas.selectionRenderer) {
        canvas.selectionRenderer.destroyTransformer?.();
    }
    
    // 선택 상태 정리
    if (canvas.selectionManager) {
        canvas.selectionManager.deselectAll?.();
    } else if (canvas._selectedObjectsProxy) {
        canvas._selectedObjectsProxy = [];
    }
    
    // UI 레이어 다시 그리기
    canvas.layers?.ui?.batchDraw();
    canvas.stage?.batchDraw();
}

/**
 * 모든 서비스 초기화 (통합)
 * ✨ v2.1.0: EditorStateManager 추가
 */
function initLayoutServices(options = {}) {
    console.log('🔧 Layout Services 초기화 시작 v2.1.0...');
    
    // 1. Canvas 초기화
    const canvas = initCanvas(options.containerId);
    
    // 2. ✨ v2.1.0: EditorStateManager 초기화 (Canvas 직후!)
    const stateManager = initStateManager(canvas);
    
    // 3. CommandManager 초기화
    const commandManager = initCommandManager();
    canvas.commandManager = commandManager;
    
    // 4. ToolService 초기화 (CommandManager 전달!)
    const toolService = initToolService(canvas, {
        onToolChanged: options.onToolChanged,
        onToast: options.onToast,
        commandManager: commandManager
    });
    
    // 5. ComponentService 초기화
    const componentService = initComponentService(canvas, commandManager, {
        selectionTool: toolService?.getTool('selection'),
        onComponentCreated: options.onComponentCreated,
        onStatusUpdate: options.onStatusUpdate
    });
    
    // 6. KeyboardService 초기화
    const keyboardService = initKeyboardService(canvas, commandManager);
    
    // 7. ✨ v2.1.0: Header 버튼 이벤트 설정 (StateManager 포함)
    setupHeaderButtonEvents(commandManager, canvas, stateManager);
    
    // 8. StateManager에 나중에 추가된 Manager들 재바인딩
    if (stateManager) {
        // 약간의 지연 후 재바인딩 (다른 초기화 완료 후)
        setTimeout(() => {
            stateManager.rebindManagers();
            console.log('[StateManager] Manager 재바인딩 완료');
        }, 100);
    }
    
    console.log('✅ Layout Services 초기화 완료 v2.1.0');
    
    return {
        canvas,
        stateManager,      // ✨ v2.1.0: 추가
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
    window.initStateManager = initStateManager;  // ✨ v2.1.0
    window.initCommandManager = initCommandManager;
    window.initToolService = initToolService;
    window.initComponentService = initComponentService;
    window.initKeyboardService = initKeyboardService;
    window.calculateCanvasSize = calculateCanvasSize;
    window.updateUndoRedoUI = updateUndoRedoUI;
    window.setupHeaderButtonEvents = setupHeaderButtonEvents;
    window.cleanupAfterUndoRedo = cleanupAfterUndoRedo;  // 폴백용 유지
}

console.log('✅ initLayoutServices.js 로드 완료 v2.1.0');