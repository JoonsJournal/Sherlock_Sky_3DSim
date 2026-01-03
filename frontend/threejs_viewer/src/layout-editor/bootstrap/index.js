/**
 * bootstrap/index.js
 * ===================
 * Layout Editor Bootstrap 모듈 통합 export
 * 
 * main.js bootstrap 패턴 적용
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/bootstrap/index.js
 */

// =====================================================
// 의존성 확인
// =====================================================
function checkDependencies() {
    const required = {
        'initLayoutServices': window.initLayoutServices,
        'initLayoutUI': window.initLayoutUI,
        'setupLayoutEvents': window.setupLayoutEvents
    };
    
    const missing = Object.entries(required)
        .filter(([name, fn]) => typeof fn !== 'function')
        .map(([name]) => name);
    
    if (missing.length > 0) {
        console.error('❌ Bootstrap 의존성 누락:', missing.join(', '));
        console.error('💡 다음 파일들이 index.js보다 먼저 로드되어야 합니다:');
        console.error('   - initLayoutServices.js');
        console.error('   - initLayoutUI.js');
        console.error('   - setupLayoutEvents.js');
        return false;
    }
    
    return true;
}

// =====================================================
// 통합 초기화 함수
// =====================================================

/**
 * Layout Editor 전체 초기화
 * @param {Object} options - 초기화 옵션
 * @returns {Object} - 초기화된 서비스 및 UI
 */
function initLayoutEditor(options = {}) {
    console.log('🚀 Layout Editor 초기화 시작...');
    
    // 의존성 확인
    if (!checkDependencies()) {
        throw new Error('Bootstrap 의존성이 누락되었습니다. 콘솔을 확인하세요.');
    }
    
    const state = window.layoutEditorState || createFallbackState();
    
    // UI 변수 선언 (콜백에서 참조)
    let ui = null;
    
    // 1. 서비스 초기화
    const services = window.initLayoutServices({
        containerId: options.containerId || 'canvas-container',
        onToolChanged: options.onToolChanged,
        onToast: (msg, type) => ui?.showToast?.(msg, type),
        onComponentCreated: (comp, shape) => {
            ui?.uiService?.updateStatus?.();
            ui?.showToast?.(`${comp.name} 생성됨`, 'success');
        },
        onStatusUpdate: () => ui?.uiService?.updateStatus?.()
    });
    
    // 2. UI 초기화
    ui = window.initLayoutUI(services);
    
    // 3. 이벤트 설정
    const handlers = createDefaultHandlers(services, ui, options);
    const { cleanup } = window.setupLayoutEvents(services, ui, handlers);
    
    // 4. 로딩 완료
    ui.hideLoading();
    ui.showToast('Layout Editor 준비 완료!', 'success');
    
    console.log('✅ Layout Editor 초기화 완료');
    
    return {
        services,
        ui,
        state,
        cleanup,
        
        // 편의 getter
        getCanvas: () => services.canvas,
        getCommandManager: () => services.commandManager,
        getToolService: () => services.toolService,
        getUIService: () => ui.uiService
    };
}

/**
 * 기본 핸들러 생성
 */
function createDefaultHandlers(services, ui, options = {}) {
    const { canvas, commandManager, toolService, componentService } = services;
    const { uiService } = ui;
    
    return {
        // Undo/Redo
        undo: () => {
            if (commandManager?.undo()) {
                canvas.transformer?.forceUpdate();
                canvas.stage.batchDraw();
                uiService?.updateStatus();
            }
        },
        redo: () => {
            if (commandManager?.redo()) {
                canvas.transformer?.forceUpdate();
                canvas.stage.batchDraw();
                uiService?.updateStatus();
            }
        },
        
        // 선택
        selectAll: () => {
            const allShapes = [];
            ['room', 'equipment'].forEach(layerName => {
                const layer = canvas.layers[layerName];
                if (layer) {
                    layer.find('Group').forEach(group => {
                        if (group.name()?.includes('component') || group.getAttr('componentType')) {
                            allShapes.push(group);
                        }
                    });
                }
            });
            if (allShapes.length > 0) {
                canvas.selectObjects(allShapes);
                uiService?.showToast(`${allShapes.length}개 선택됨`, 'success');
            }
        },
        deselectAll: () => {
            canvas.deselectAll?.();
            canvas.selectedObjects = [];
            canvas.transformer?.nodes([]);
            canvas.stage.batchDraw();
        },
        
        // 저장/내보내기
        save: options.onSave || (() => {
            const layout = canvas.getCurrentLayout();
            const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `layout_${Date.now()}.json`;
            link.click();
            uiService?.showToast('저장 완료!', 'success');
        }),
        exportPNG: options.onExportPNG || (() => {
            try {
                const dataURL = canvas.stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = `layout_${Date.now()}.png`;
                link.click();
                uiService?.showToast('🖼️ PNG 저장 완료!', 'success');
            } catch (error) {
                console.error('[Export PNG Error]', error);
                uiService?.showToast('PNG 저장 실패: ' + error.message, 'error');
            }
        }),
        
        // 샘플 로드
        loadSampleLayout: options.onLoadSample || (() => {
            canvas.loadLayout({
                room: { width: 30, height: 20, walls: [], offices: [] },
                equipment: [
                    { id: 'eq_1', x: 2, y: 5, width: 2, depth: 1.5, name: 'Equipment 1', rotation: 0 },
                    { id: 'eq_2', x: 5, y: 5, width: 2, depth: 1.5, name: 'Equipment 2', rotation: 0 },
                    { id: 'eq_3', x: 8, y: 5, width: 2, depth: 1.5, name: 'Equipment 3', rotation: 0 }
                ]
            });
            toolService?.getTool('selection')?.attachEventListeners?.();
            uiService?.updateStatus();
            uiService?.showToast('샘플 로드 완료!', 'success');
        }),
        
        // 커스텀 핸들러 병합
        ...options.handlers
    };
}

/**
 * Fallback State 생성
 */
function createFallbackState() {
    return {
        componentSubmenuVisible: false,
        alignPopupVisible: false,
        shortcutsHelpVisible: false,
        currentTool: 'select',
        on: () => {},
        emit: () => {},
        updateHistory: () => {},
        updateStats: () => {}
    };
}

// =====================================================
// 전역 노출
// =====================================================
if (typeof window !== 'undefined') {
    // 안전한 함수 참조 (undefined 방지)
    const safeGet = (fn) => typeof fn === 'function' ? fn : undefined;
    
    window.LayoutEditorBootstrap = {
        // 통합 초기화
        initLayoutEditor,
        createDefaultHandlers,
        createFallbackState,
        checkDependencies,
        
        // 개별 초기화 (initLayoutServices.js) - 안전한 참조
        initLayoutServices: safeGet(window.initLayoutServices),
        initCanvas: safeGet(window.initCanvas),
        initCommandManager: safeGet(window.initCommandManager),
        initToolService: safeGet(window.initToolService),
        initComponentService: safeGet(window.initComponentService),
        initKeyboardService: safeGet(window.initKeyboardService),
        calculateCanvasSize: safeGet(window.calculateCanvasSize),
        
        // UI 초기화 (initLayoutUI.js) - 안전한 참조
        initLayoutUI: safeGet(window.initLayoutUI),
        initUIService: safeGet(window.initUIService),
        setupComponentSubmenu: safeGet(window.setupComponentSubmenu),
        setupDropZone: safeGet(window.setupDropZone),
        hideLoading: safeGet(window.hideLoading),
        showToast: safeGet(window.showToast),
        
        // 이벤트 설정 (setupLayoutEvents.js) - 안전한 참조
        setupLayoutEvents: safeGet(window.setupLayoutEvents),
        registerKeyboardActions: safeGet(window.registerKeyboardActions),
        bindToolbarButtons: safeGet(window.bindToolbarButtons),
        setupResizeHandler: safeGet(window.setupResizeHandler),
        subscribeToStateEvents: safeGet(window.subscribeToStateEvents),
        createCleanup: safeGet(window.createCleanup)
    };
    
    // 편의를 위해 initLayoutEditor도 직접 노출
    window.initLayoutEditor = initLayoutEditor;
    
    // 의존성 상태 출력
    checkDependencies();
}

console.log('✅ bootstrap/index.js 로드 완료');
console.log('💡 사용법: const app = initLayoutEditor() 또는 LayoutEditorBootstrap.initLayoutEditor()');