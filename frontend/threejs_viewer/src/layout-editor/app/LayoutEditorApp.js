/**
 * LayoutEditorApp.js
 * ==================
 * Phase 5.2: Services 분리 완료 - 오케스트레이션만 담당
 * 
 * ✅ 외부 서비스 활용:
 *   - LayoutEditorConfig.js (상수, 설정)
 *   - LayoutEditorState.js (상태 관리)
 *   - ComponentService.js (컴포넌트 생성/삭제)
 *   - KeyboardService.js (단축키 처리)
 *   - ToolService.js (도구 관리)
 *   - UIService.js (UI 관련)
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/app/LayoutEditorApp.js
 */

class LayoutEditorApp {
    constructor() {
        console.log('🚀 LayoutEditorApp 초기화 시작 (Phase 5.2 - Services 분리)...');
        
        // =====================================================
        // 1. State 참조
        // =====================================================
        this.state = window.layoutEditorState || this._createFallbackState();
        
        // =====================================================
        // 2. Canvas 초기화
        // =====================================================
        this.canvas = this._initCanvas();
        
        // =====================================================
        // 3. Services 초기화
        // =====================================================
        this.services = this._initServices();
        
        // =====================================================
        // 4. 이벤트 설정
        // =====================================================
        this._setupEvents();
        
        // =====================================================
        // 5. 상태 업데이트 시작
        // =====================================================
        setInterval(() => this.services.ui.updateStatus(), 500);
        
        // =====================================================
        // 6. 완료
        // =====================================================
        this.services.ui.hideLoading();
        console.log('✅ Layout Editor 초기화 완료 (Phase 5.2)');
        this.services.ui.showToast('Layout Editor 준비 완료!', 'success');
    }
    
    // =====================================================
    // Canvas 초기화
    // =====================================================
    _initCanvas() {
        if (typeof Canvas2DEditor === 'undefined') {
            throw new Error('Canvas2DEditor가 로드되지 않았습니다.');
        }
        
        const size = this._calculateCanvasSize();
        const canvas = new Canvas2DEditor('canvas-container', {
            width: size.width,
            height: size.height,
            showGrid: true,
            snapToGrid: true,
            gridSize: 10
        });
        
        console.log('  ✓ Canvas2DEditor');
        return canvas;
    }
    
    // =====================================================
    // Services 초기화
    // =====================================================
    _initServices() {
        // CommandManager
        const commandManager = this._initCommandManager();
        
        // ToolService
        const toolService = new ToolService(this.canvas, {
            state: this.state,
            onToolChanged: (tool) => console.log(`🔧 Tool: ${tool}`),
            onToast: (msg, type) => this.services?.ui?.showToast(msg, type)
        });
        toolService.initAllTools();
        
        // ComponentService
        const componentService = new ComponentService(this.canvas, commandManager, {
            selectionTool: toolService.getTool('selection'),
            onComponentCreated: (comp, shape) => {
                this.services?.ui?.updateStatus();
                this.services?.ui?.showToast(`${comp.name} 생성됨`, 'success');
            },
            onStatusUpdate: () => this.services?.ui?.updateStatus()
        });
        
        // UIService
        const uiService = new UIService({
            canvas: this.canvas,
            state: this.state,
            toolService,
            componentService
        });
        uiService.setCanvasSizeUpdater(() => this._updateCanvasSize());
        
        // KeyboardService
        const keyboardService = new KeyboardService({
            canvas: this.canvas,
            commandManager,
            state: this.state
        });
        
        // 서비스 객체 저장
        const services = {
            command: commandManager,
            tool: toolService,
            component: componentService,
            ui: uiService,
            keyboard: keyboardService
        };
        
        // Canvas에 CommandManager 연결
        this.canvas.commandManager = commandManager;
        
        console.log('  ✓ All Services initialized');
        return services;
    }
    
    // =====================================================
    // CommandManager 초기화
    // =====================================================
    _initCommandManager() {
        if (typeof CommandManager === 'undefined') {
            console.warn('⚠️ CommandManager 미로드 - Undo/Redo 비활성화');
            return null;
        }
        
        const maxHistory = window.LayoutEditorConfig?.COMMAND_CONFIG?.maxHistory || 50;
        
        const commandManager = new CommandManager({
            maxHistory,
            onHistoryChange: (historyState) => {
                if (this.state?.updateHistory) {
                    this.state.updateHistory(historyState);
                }
                // DOM 직접 업데이트 (State 이벤트가 없을 경우)
                document.getElementById('btn-undo').disabled = !historyState.canUndo;
                document.getElementById('btn-redo').disabled = !historyState.canRedo;
                document.getElementById('status-undo').textContent = historyState.undoCount;
                document.getElementById('status-redo').textContent = historyState.redoCount;
            }
        });
        
        console.log('  ✓ CommandManager');
        return commandManager;
    }
    
    // =====================================================
    // 이벤트 설정
    // =====================================================
    _setupEvents() {
        // 키보드 액션 등록
        this._registerKeyboardActions();
        this.services.keyboard.activate();
        
        // 툴바 버튼 바인딩
        this._bindToolbarButtons();
        
        // 컴포넌트 서브메뉴 설정
        this.services.ui.setupComponentSubmenu();
        
        // Drop Zone 활성화
        this.services.component.enableDropZone();
        
        // 외부 클릭 처리
        this.services.ui.setupClickOutsideHandlers();
        
        // 리사이즈 이벤트
        window.addEventListener('resize', () => this._updateCanvasSize());
        
        console.log('  ✓ Events setup complete');
    }
    
    // =====================================================
    // 키보드 액션 등록
    // =====================================================
    _registerKeyboardActions() {
        const { keyboard, tool, component, ui } = this.services;
        
        keyboard.registerActions({
            // Undo/Redo
            undo: () => this.undo(),
            redo: () => this.redo(),
            
            // 선택
            selectAll: () => this.selectAll(),
            deleteSelected: () => {
                const count = component.deleteSelected();
                if (count > 0) ui.showToast(`${count}개 삭제됨`, 'success');
                else ui.showToast('선택된 객체 없음', 'info');
            },
            
            // 도구
            selectTool: () => tool.activateTool('select'),
            wallTool: () => tool.activateTool('wall'),
            
            // 토글
            toggleComponentSubmenu: () => ui.toggleComponentSubmenu(),
            toggleGrid: () => tool.toggleGrid(),
            toggleSnap: () => tool.toggleSnap(),
            toggleMICESnap: () => tool.toggleMICESnap(),
            toggleSmartGuides: () => tool.toggleSmartGuides(),
            toggleAlignPopup: () => ui.toggleAlignPopup(),
            toggleShortcutsHelp: () => ui.toggleShortcutsHelp(),
            
            // 줌
            zoomIn: () => tool.zoomIn(),
            zoomOut: () => tool.zoomOut(),
            resetZoom: () => tool.resetZoom(),
            
            // 회전
            rotateCW: () => tool.rotateCW(),
            rotateCCW: () => tool.rotateCCW(),
            
            // 레이어 순서
            bringForward: () => tool.bringForward(),
            sendBackward: () => tool.sendBackward(),
            bringToFront: () => tool.bringToFront(),
            sendToBack: () => tool.sendToBack(),
            
            // 그룹
            group: () => tool.groupSelected(),
            ungroup: () => tool.ungroupSelected(),
            
            // 복제
            duplicate: () => {
                const shapes = component.duplicateSelected();
                if (shapes.length > 0) ui.showToast(`${shapes.length}개 복제됨`, 'success');
                else ui.showToast('선택된 객체 없음', 'info');
            },
            
            // 저장
            save: () => this.saveLayout(),
            
            // Equipment Array
            showEquipmentArrayModal: () => ui.showEquipmentArrayModal(),
            
            // Escape
            escape: () => ui.handleEscape()
        });
    }
    
    // =====================================================
    // 툴바 버튼 바인딩
    // =====================================================
    _bindToolbarButtons() {
        const { tool, ui, component } = this.services;
        
        // 버튼 매핑
        const buttonActions = {
            // 기본
            'btn-undo': () => this.undo(),
            'btn-redo': () => this.redo(),
            'btn-help': () => ui.toggleShortcutsHelp(),
            'btn-save': () => this.saveLayout(),
            'btn-export-png': () => this.exportPNG(),
            
            // 도구
            'tool-select': () => tool.activateTool('select'),
            'tool-room': () => ui.showRoomSizeModal(),
            'tool-wall': () => tool.activateTool('wall'),
            'component-btn': () => ui.toggleComponentSubmenu(),
            'tool-grid': () => tool.toggleGrid(),
            'tool-snap': () => tool.toggleSnap(),
            
            // 줌
            'tool-zoom-in': () => tool.zoomIn(),
            'tool-zoom-out': () => tool.zoomOut(),
            'tool-zoom-reset': () => tool.resetZoom(),
            
            // 선택/삭제
            'tool-select-all': () => this.selectAll(),
            'tool-delete': () => {
                const count = component.deleteSelected();
                if (count > 0) ui.showToast(`${count}개 삭제됨`, 'success');
                else ui.showToast('선택된 객체 없음', 'info');
            },
            'tool-deselect': () => this.deselectAll(),
            
            // 정렬/회전
            'align-btn': () => ui.toggleAlignPopup(),
            'tool-rotate': () => tool.rotateCW(),
            'tool-sample': () => this.loadSampleLayout(),
            
            // 정렬 팝업 내
            'align-left': () => { tool.alignLeft(); ui.hideAlignPopup(); },
            'align-right': () => { tool.alignRight(); ui.hideAlignPopup(); },
            'align-top': () => { tool.alignTop(); ui.hideAlignPopup(); },
            'align-bottom': () => { tool.alignBottom(); ui.hideAlignPopup(); },
            'align-center-h': () => { tool.alignCenterH(); ui.hideAlignPopup(); },
            'align-center-v': () => { tool.alignCenterV(); ui.hideAlignPopup(); },
            'distribute-h': () => { tool.distributeH(); ui.hideAlignPopup(); },
            'distribute-v': () => { tool.distributeV(); ui.hideAlignPopup(); },
            'rotate-cw': () => tool.rotateCW(),
            'rotate-ccw': () => tool.rotateCCW(),
            'rotate-reset': () => { tool.resetRotation(); ui.hideAlignPopup(); },
            
            // 모달
            'room-cancel': () => ui.closeRoomSizeModal(),
            'room-apply': () => ui.applyRoomSize(),
            
            // Equipment Array + 그룹화
            'tool-eq-array': () => ui.showEquipmentArrayModal(),
            'tool-group': () => tool.groupSelected(),
            'tool-ungroup': () => tool.ungroupSelected(),
            'eq-array-cancel': () => ui.closeEquipmentArrayModal(),
            'eq-array-apply': () => ui.applyEquipmentArray()
        };
        
        // 바인딩
        Object.entries(buttonActions).forEach(([id, action]) => {
            document.getElementById(id)?.addEventListener('click', action);
        });
    }
    
    // =====================================================
    // Canvas 크기 계산/업데이트
    // =====================================================
    _calculateCanvasSize() {
        const dims = window.LayoutEditorConfig?.getLayoutDimensions?.() || {
            TOOLBAR_WIDTH: 60,
            TOOLBAR_EXPANDED_WIDTH: 270,
            PROPERTY_PANEL_WIDTH: 260,
            HEADER_HEIGHT: 48,
            STATUS_HEIGHT: 30
        };
        
        const toolbarWidth = this.state?.componentSubmenuVisible 
            ? dims.TOOLBAR_EXPANDED_WIDTH 
            : dims.TOOLBAR_WIDTH;
            
        return {
            width: window.innerWidth - toolbarWidth - dims.PROPERTY_PANEL_WIDTH,
            height: window.innerHeight - dims.HEADER_HEIGHT - dims.STATUS_HEIGHT
        };
    }
    
    _updateCanvasSize() {
        const size = this._calculateCanvasSize();
        if (this.canvas.stage) {
            this.canvas.stage.width(size.width);
            this.canvas.stage.height(size.height);
            this.canvas.config.width = size.width;
            this.canvas.config.height = size.height;
        }
        this.services.tool.getZoomController()?.updateGrid?.();
    }
    
    // =====================================================
    // Fallback State (State 모듈 없을 때)
    // =====================================================
    _createFallbackState() {
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
    // 공개 메서드 (외부 호출용)
    // =====================================================
    
    undo() {
        if (this.services.command?.undo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.services.ui.updateStatus();
            console.log('↩️ Undo');
        }
    }
    
    redo() {
        if (this.services.command?.redo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.services.ui.updateStatus();
            console.log('↪️ Redo');
        }
    }
    
    selectAll() {
        const allShapes = [];
        ['room', 'equipment'].forEach(layerName => {
            const layer = this.canvas.layers[layerName];
            if (layer) {
                layer.find('Group').forEach(group => {
                    if (group.name()?.includes('component') || group.getAttr('componentType')) {
                        allShapes.push(group);
                    }
                });
            }
        });
        
        if (allShapes.length > 0) {
            this.canvas.selectObjects(allShapes);
            this.services.ui.showToast(`${allShapes.length}개 선택됨`, 'success');
        }
    }
    
    deselectAll() {
        this.canvas.deselectAll?.();
        this.canvas.selectedObjects = [];
        this.canvas.transformer?.nodes([]);
        this.canvas.stage.batchDraw();
    }
    
    saveLayout() {
        const layout = this.canvas.getCurrentLayout();
        const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `layout_${Date.now()}.json`;
        link.click();
        this.services.ui.showToast('저장 완료!', 'success');
    }
    
    exportPNG() {
        try {
            const dataURL = this.canvas.stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `layout_${Date.now()}.png`;
            link.click();
            this.services.ui.showToast('🖼️ PNG 저장 완료!', 'success');
        } catch (error) {
            console.error('[Export PNG Error]', error);
            this.services.ui.showToast('PNG 저장 실패: ' + error.message, 'error');
        }
    }
    
    loadSampleLayout() {
        this.canvas.loadLayout({
            room: { width: 30, height: 20, walls: [], offices: [] },
            equipment: [
                { id: 'eq_1', x: 2, y: 5, width: 2, depth: 1.5, name: 'Equipment 1', rotation: 0 },
                { id: 'eq_2', x: 5, y: 5, width: 2, depth: 1.5, name: 'Equipment 2', rotation: 0 },
                { id: 'eq_3', x: 8, y: 5, width: 2, depth: 1.5, name: 'Equipment 3', rotation: 0 }
            ]
        });
        this.services.tool.getTool('selection')?.attachEventListeners?.();
        this.services.ui.updateStatus();
        this.services.ui.showToast('샘플 로드 완료!', 'success');
    }
    
    // =====================================================
    // Getters (외부 접근용)
    // =====================================================
    
    getCanvas() { return this.canvas; }
    getState() { return this.state; }
    getServices() { return this.services; }
    getCommandManager() { return this.services.command; }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.LayoutEditorApp = LayoutEditorApp;
}

console.log('✅ LayoutEditorApp.js 로드 완료 (Phase 5.2 - Services 분리)');