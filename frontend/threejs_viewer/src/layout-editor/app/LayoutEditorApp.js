/**
 * LayoutEditorApp.js
 * ==================
 * Phase 5.1: Config + State 모듈 분리 리팩토링
 * 
 * ✅ 외부 모듈 활용:
 *   - LayoutEditorConfig.js (상수, 설정)
 *   - LayoutEditorState.js (상태 관리)
 *   - Command.js (MoveCommand, DeleteCommand, CreateCommand)
 *   - CommandManager.js
 *   - InfiniteGridZoomController.js
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/app/LayoutEditorApp.js
 */

// =====================================================
// Config & State 로드 확인
// =====================================================
const Config = window.LayoutEditorConfig || {};
const COMPONENTS = Config.COMPONENTS || {
    partition: { id: 'partition', name: 'Partition', width: 3.0, depth: 2.5, color: '#888888', layer: 'room' },
    desk: { id: 'desk', name: 'Desk', width: 1.6, depth: 0.8, color: '#8B4513', layer: 'room' },
    pillar: { id: 'pillar', name: 'Pillar', width: 0.3, depth: 0.3, color: '#333333', layer: 'room' },
    office: { id: 'office', name: 'Office', width: 12.0, depth: 20.0, color: '#87CEEB', layer: 'room' },
    equipment: { id: 'equipment', name: 'Equipment', width: 1.5, depth: 3.0, color: '#FF8C00', layer: 'equipment' }
};

// State 싱글톤 가져오기 (없으면 폴백)
const state = window.layoutEditorState || {
    componentSubmenuVisible: false,
    alignPopupVisible: false,
    shortcutsHelpVisible: false,
    currentTool: 'select',
    on: () => {},
    emit: () => {}
};

// =====================================================
// 레이아웃 치수 (Config에서 가져오기)
// =====================================================
const dimensions = Config.getLayoutDimensions ? Config.getLayoutDimensions() : (() => {
    const rootStyles = getComputedStyle(document.documentElement);
    return {
        TOOLBAR_WIDTH: parseInt(rootStyles.getPropertyValue('--toolbar-width')) || 60,
        TOOLBAR_EXPANDED_WIDTH: parseInt(rootStyles.getPropertyValue('--toolbar-expanded-width')) || 270,
        PROPERTY_PANEL_WIDTH: parseInt(rootStyles.getPropertyValue('--property-panel-width')) || 260,
        HEADER_HEIGHT: parseInt(rootStyles.getPropertyValue('--header-height')) || 48,
        STATUS_HEIGHT: parseInt(rootStyles.getPropertyValue('--status-height')) || 30
    };
})();

const { TOOLBAR_WIDTH, TOOLBAR_EXPANDED_WIDTH, PROPERTY_PANEL_WIDTH, HEADER_HEIGHT, STATUS_HEIGHT } = dimensions;

// =====================================================
// Main App Class
// =====================================================
class LayoutEditorApp {
    constructor() {
        console.log('✅ LayoutEditorApp 초기화 시작 (Phase 5.1 - Config/State 분리)...');
        
        // State 참조 저장
        this.state = state;
        
        const canvasSize = this.calculateCanvasSize();
        
        if (typeof Canvas2DEditor === 'undefined') {
            throw new Error('Canvas2DEditor가 로드되지 않았습니다.');
        }
        
        // Canvas 초기화
        this.canvas = new Canvas2DEditor('canvas-container', { 
            width: canvasSize.width, 
            height: canvasSize.height, 
            showGrid: true, 
            snapToGrid: true, 
            gridSize: 10 
        });
        
        // ZoomController 초기화
        this.initZoomController();
        
        // Tools 초기화
        this.initTools();
        
        // CommandManager 초기화
        this.initCommandManager();
        
        // 이벤트 설정
        this.enableDropZone();
        this.setupComponentSubmenu();
        this.setupEventListeners();
        this.bindToolbarButtons();
        
        // 상태 업데이트 시작
        setInterval(() => this.updateStatus(), 500);
        
        // State 이벤트 구독
        this.subscribeToStateEvents();
        
        // 로딩 완료
        document.getElementById('loading-indicator').style.display = 'none';
        console.log('✅ Layout Editor 초기화 완료 (Phase 5.1)');
        this.showToast('Layout Editor 준비 완료!', 'success');
    }
    
    // =====================================================
    // State 이벤트 구독
    // =====================================================
    subscribeToStateEvents() {
        if (!this.state.on) return;
        
        // 도구 변경 시 UI 업데이트
        this.state.on('tool:changed', ({ current }) => {
            document.getElementById('status-tool').textContent = 
                current === 'select' ? '선택' : current === 'wall' ? '벽 그리기' : current;
        });
        
        // 선택 변경 시 UI 업데이트
        this.state.on('selection:changed', ({ count }) => {
            document.getElementById('status-selected').textContent = count;
        });
        
        // 히스토리 변경 시 UI 업데이트
        this.state.on('history:changed', (history) => {
            document.getElementById('btn-undo').disabled = !history.canUndo;
            document.getElementById('btn-redo').disabled = !history.canRedo;
            document.getElementById('status-undo').textContent = history.undoCount;
            document.getElementById('status-redo').textContent = history.redoCount;
        });
        
        console.log('✅ State 이벤트 구독 완료');
    }
    
    // =====================================================
    // ZoomController 초기화
    // =====================================================
    initZoomController() {
        if (typeof InfiniteGridZoomController !== 'undefined') {
            const zoomConfig = Config.CANVAS_CONFIG || { minZoom: 0.1, maxZoom: 5.0, zoomStep: 0.1, wheelSensitivity: 0.001 };
            this.zoomController = new InfiniteGridZoomController(this.canvas, { 
                minZoom: zoomConfig.minZoom, 
                maxZoom: zoomConfig.maxZoom, 
                zoomStep: zoomConfig.zoomStep, 
                wheelSensitivity: zoomConfig.wheelSensitivity 
            });
            this.canvas.setZoomController(this.zoomController);
            this.zoomController.activate();
            this.zoomController.updateGrid();
            console.log('✅ InfiniteGridZoomController 초기화 완료');
        } else {
            console.warn('⚠️ InfiniteGridZoomController가 로드되지 않았습니다');
        }
    }
    
    // =====================================================
    // Tools 초기화
    // =====================================================
    initTools() {
        if (typeof ObjectSelectionTool !== 'undefined') { 
            this.selectionTool = new ObjectSelectionTool(this.canvas); 
            this.selectionTool.activate(); 
        }
        if (typeof RoomSizeManager !== 'undefined') { 
            this.roomSizeManager = new RoomSizeManager(this.canvas); 
        }
        if (typeof WallDrawTool !== 'undefined') { 
            this.wallDrawTool = new WallDrawTool(this.canvas); 
            this.canvas.setWallDrawTool(this.wallDrawTool);
        }
        if (typeof EquipmentArrayTool !== 'undefined') { 
            this.equipmentArrayTool = new EquipmentArrayTool(this.canvas);
            this.canvas.equipmentArrayTool = this.equipmentArrayTool;
        }
        if (typeof PropertyPanel !== 'undefined') { 
            this.propertyPanel = new PropertyPanel('property-panel', this.canvas); 
            this.canvas.setPropertyPanel(this.propertyPanel); 
        }
        if (typeof AlignmentTool !== 'undefined') { 
            this.alignmentTool = new AlignmentTool(this.canvas); 
        }
        if (typeof GroupingTool !== 'undefined') { 
            this.groupingTool = new GroupingTool(this.canvas); 
        }
        
        console.log('✅ Tools 초기화 완료');
    }
    
    // =====================================================
    // CommandManager 초기화
    // =====================================================
    initCommandManager() {
        if (typeof CommandManager !== 'undefined') {
            const maxHistory = Config.COMMAND_CONFIG?.maxHistory || 50;
            
            this.commandManager = new CommandManager({
                maxHistory,
                onHistoryChange: (historyState) => {
                    // State 업데이트 (이벤트 자동 발생)
                    if (this.state.updateHistory) {
                        this.state.updateHistory(historyState);
                    } else {
                        // 폴백: 직접 DOM 업데이트
                        document.getElementById('btn-undo').disabled = !historyState.canUndo;
                        document.getElementById('btn-redo').disabled = !historyState.canRedo;
                        document.getElementById('status-undo').textContent = historyState.undoCount;
                        document.getElementById('status-redo').textContent = historyState.redoCount;
                    }
                }
            });
            
            this.canvas.commandManager = this.commandManager;
            console.log('✅ CommandManager 초기화 완료');
        } else {
            console.warn('⚠️ CommandManager가 로드되지 않았습니다');
        }
    }
    
    // =====================================================
    // Canvas 크기 계산
    // =====================================================
    calculateCanvasSize() {
        const toolbarWidth = this.state.componentSubmenuVisible ? TOOLBAR_EXPANDED_WIDTH : TOOLBAR_WIDTH;
        return { 
            width: window.innerWidth - toolbarWidth - PROPERTY_PANEL_WIDTH, 
            height: window.innerHeight - HEADER_HEIGHT - STATUS_HEIGHT 
        };
    }
    
    updateCanvasSize() { 
        const size = this.calculateCanvasSize(); 
        if (this.canvas.stage) {
            this.canvas.stage.width(size.width);
            this.canvas.stage.height(size.height);
            this.canvas.config.width = size.width;
            this.canvas.config.height = size.height;
        }
        this.zoomController?.updateGrid?.(); 
    }
    
    // =====================================================
    // 툴바 버튼 바인딩
    // =====================================================
    bindToolbarButtons() {
        // 기본 버튼들
        document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
        document.getElementById('btn-redo')?.addEventListener('click', () => this.redo());
        document.getElementById('btn-help')?.addEventListener('click', () => this.toggleShortcutsHelp());
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveLayout());
        document.getElementById('btn-export-png')?.addEventListener('click', () => this.exportPNG());
        
        // 도구 버튼들
        document.getElementById('tool-select')?.addEventListener('click', () => this.activateTool('select'));
        document.getElementById('tool-room')?.addEventListener('click', () => this.showRoomSizeModal());
        document.getElementById('tool-wall')?.addEventListener('click', () => this.activateTool('wall'));
        document.getElementById('component-btn')?.addEventListener('click', () => this.toggleComponentSubmenu());
        document.getElementById('tool-grid')?.addEventListener('click', () => this.toggleGrid());
        document.getElementById('tool-snap')?.addEventListener('click', () => this.toggleSnap());
        
        // 줌 버튼들
        document.getElementById('tool-zoom-in')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('tool-zoom-out')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('tool-zoom-reset')?.addEventListener('click', () => this.resetZoom());
        
        // 선택/삭제 버튼들
        document.getElementById('tool-select-all')?.addEventListener('click', () => this.selectAll());
        document.getElementById('tool-delete')?.addEventListener('click', () => this.deleteSelected());
        document.getElementById('tool-deselect')?.addEventListener('click', () => this.deselectAll());
        
        // 정렬/회전 버튼들
        document.getElementById('align-btn')?.addEventListener('click', () => this.toggleAlignPopup());
        document.getElementById('tool-rotate')?.addEventListener('click', () => this.rotateCW());
        document.getElementById('tool-sample')?.addEventListener('click', () => this.loadSampleLayout());
        
        // 정렬 팝업 내 버튼들
        document.getElementById('align-left')?.addEventListener('click', () => this.alignLeft());
        document.getElementById('align-right')?.addEventListener('click', () => this.alignRight());
        document.getElementById('align-top')?.addEventListener('click', () => this.alignTop());
        document.getElementById('align-bottom')?.addEventListener('click', () => this.alignBottom());
        document.getElementById('align-center-h')?.addEventListener('click', () => this.alignCenterH());
        document.getElementById('align-center-v')?.addEventListener('click', () => this.alignCenterV());
        document.getElementById('distribute-h')?.addEventListener('click', () => this.distributeH());
        document.getElementById('distribute-v')?.addEventListener('click', () => this.distributeV());
        document.getElementById('rotate-cw')?.addEventListener('click', () => this.rotateCW());
        document.getElementById('rotate-ccw')?.addEventListener('click', () => this.rotateCCW());
        document.getElementById('rotate-reset')?.addEventListener('click', () => this.resetRotation());
        
        // 모달 버튼들
        document.getElementById('room-cancel')?.addEventListener('click', () => this.closeRoomSizeModal());
        document.getElementById('room-apply')?.addEventListener('click', () => this.applyRoomSize());
        
        // Equipment Array + 그룹화 버튼들
        document.getElementById('tool-eq-array')?.addEventListener('click', () => this.showEquipmentArrayModal());
        document.getElementById('tool-group')?.addEventListener('click', () => this.groupSelected());
        document.getElementById('tool-ungroup')?.addEventListener('click', () => this.ungroupSelected());
        document.getElementById('eq-array-cancel')?.addEventListener('click', () => this.closeEquipmentArrayModal());
        document.getElementById('eq-array-apply')?.addEventListener('click', () => this.applyEquipmentArray());
        
        console.log('✅ 툴바 버튼 바인딩 완료');
    }
    
    // =====================================================
    // Drop Zone
    // =====================================================
    enableDropZone() {
        const container = this.canvas.stage.container();
        const dropGuide = document.getElementById('drop-guide');
        
        container.addEventListener('dragover', e => { 
            e.preventDefault(); 
            dropGuide?.classList.add('visible'); 
        });
        container.addEventListener('dragleave', () => {
            dropGuide?.classList.remove('visible');
        });
        container.addEventListener('drop', e => { 
            e.preventDefault(); 
            dropGuide?.classList.remove('visible'); 
            this.handleDrop(e); 
        });
    }
    
    handleDrop(event) {
        const componentType = event.dataTransfer.getData('text/plain');
        const component = COMPONENTS[componentType];
        if (!component) return;
        
        const stage = this.canvas.stage;
        const rect = stage.container().getBoundingClientRect();
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        
        const shape = this.createComponent(component, pos.x, pos.y);
        if (shape) { 
            this.canvas.selectObject(shape, false); 
            this.selectionTool?.attachShapeEvents?.(shape); 
            this.updateObjectCount(); 
            this.showToast(`${component.name} 생성됨`, 'success'); 
        }
    }
    
    // =====================================================
    // 컴포넌트 생성
    // =====================================================
    createComponent(component, x, y) {
        const scale = this.canvas.config.scale || 10;
        const width = component.width * scale;
        const height = component.depth * scale;
        
        if (this.canvas.config.snapToGrid) { 
            const gridSize = this.canvas.config.gridSize; 
            x = Math.round(x / gridSize) * gridSize; 
            y = Math.round(y / gridSize) * gridSize; 
        }
        
        const id = `${component.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const group = new Konva.Group({ id, x, y, draggable: true, name: component.id + ' component' });
        
        const rect = new Konva.Rect({ 
            x: -width / 2, y: -height / 2, 
            width, height, 
            fill: component.color, 
            stroke: '#333', 
            strokeWidth: 2, 
            name: 'componentRect' 
        });
        
        const arrowLength = Math.min(width, height) * 0.5;
        const arrow = new Konva.Arrow({ 
            points: [0, height / 2 - 4, 0, height / 2 - 4 - arrowLength], 
            pointerLength: 6, pointerWidth: 6, 
            fill: '#ff4444', stroke: '#ff4444', strokeWidth: 2, 
            name: 'directionArrow' 
        });
        
        const dirLabel = new Konva.Text({ 
            x: -12, y: height / 2 - arrowLength - 18, 
            text: 'Front', fontSize: 9, fill: '#ff4444', fontStyle: 'bold', 
            name: 'directionLabel' 
        });
        
        group.add(rect, arrow, dirLabel);
        group.setAttr('componentType', component.id);
        group.setAttr('componentData', component);
        group.setAttr('currentRotation', 0);
        
        // 드래그 이벤트 설정
        this.setupDragEvents(group);
        
        // 클릭 이벤트
        group.on('click tap', e => { 
            e.cancelBubble = true; 
            this.canvas.selectObject(group, e.evt.ctrlKey || e.evt.metaKey); 
        });
        
        // 레이어에 추가 (CreateCommand 사용)
        const layerName = component.layer || 'equipment';
        const layer = this.canvas.layers[layerName] || this.canvas.layers.equipment;
        
        if (this.commandManager && typeof CreateCommand !== 'undefined') {
            const createCmd = new CreateCommand(group, layer);
            this.commandManager.execute(createCmd);
            console.log('✅ CreateCommand 등록:', id);
        } else {
            layer.add(group); 
            layer.batchDraw();
        }
        
        this.canvas.componentShapes?.set(id, group);
        return group;
    }
    
    // =====================================================
    // 드래그 이벤트 설정
    // =====================================================
    setupDragEvents(group) {
        group.on('dragstart', () => { 
            group._dragStartPos = { x: group.x(), y: group.y() }; 
        });
        
        group.on('dragend', () => { 
            const startPos = group._dragStartPos;
            
            // Snap to grid
            if (this.canvas.config.snapToGrid) { 
                const gridSize = this.canvas.config.gridSize; 
                group.x(Math.round(group.x() / gridSize) * gridSize); 
                group.y(Math.round(group.y() / gridSize) * gridSize); 
                group.getLayer()?.batchDraw(); 
            }
            
            // MoveCommand 등록
            if (startPos && this.commandManager && typeof MoveCommand !== 'undefined') {
                const dx = group.x() - startPos.x;
                const dy = group.y() - startPos.y;
                if (dx !== 0 || dy !== 0) {
                    group.x(startPos.x);
                    group.y(startPos.y);
                    const moveCommand = new MoveCommand([group], dx, dy);
                    this.commandManager.execute(moveCommand);
                    this.updateStatus();
                }
            }
            delete group._dragStartPos;
        });
    }
    
    // =====================================================
    // 컴포넌트 서브메뉴
    // =====================================================
    setupComponentSubmenu() {
        document.querySelectorAll('.submenu-item').forEach(item => {
            const componentType = item.dataset.component;
            
            item.addEventListener('dragstart', e => { 
                e.dataTransfer.setData('text/plain', componentType); 
                item.style.opacity = '0.5'; 
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
            });
            item.addEventListener('click', () => {
                const component = COMPONENTS[componentType];
                if (component) {
                    const stage = this.canvas.stage;
                    const centerX = (this.canvas.config.width / 2 - stage.x()) / stage.scaleX();
                    const centerY = (this.canvas.config.height / 2 - stage.y()) / stage.scaleY();
                    const shape = this.createComponent(component, centerX, centerY);
                    if (shape) { 
                        this.canvas.selectObject(shape, false); 
                        this.selectionTool?.attachShapeEvents?.(shape); 
                        this.updateObjectCount(); 
                        this.showToast(`${component.name} 생성됨`, 'success'); 
                    }
                }
            });
        });
    }
    
    toggleComponentSubmenu() {
        this.state.componentSubmenuVisible = !this.state.componentSubmenuVisible;
        document.getElementById('toolbar-container').classList.toggle('expanded', this.state.componentSubmenuVisible);
        document.getElementById('component-btn').classList.toggle('active', this.state.componentSubmenuVisible);
        
        if (this.state.componentSubmenuVisible && this.state.alignPopupVisible) {
            this.hideAlignPopup();
        }
        setTimeout(() => this.updateCanvasSize(), 350);
    }
    
    // =====================================================
    // 키보드 이벤트
    // =====================================================
    setupEventListeners() {
        document.addEventListener('keydown', e => this.handleKeyDown(e));
        
        document.addEventListener('click', e => {
            const toolbarContainer = document.getElementById('toolbar-container');
            const alignPopup = document.getElementById('align-popup');
            const alignBtn = document.getElementById('align-btn');
            
            if (this.state.componentSubmenuVisible && !toolbarContainer?.contains(e.target)) {
                this.toggleComponentSubmenu();
            }
            if (this.state.alignPopupVisible && !alignPopup?.contains(e.target) && !alignBtn?.contains(e.target)) {
                this.hideAlignPopup();
            }
        });
        
        window.addEventListener('resize', () => this.updateCanvasSize());
    }
    
    handleKeyDown(e) {
        // Ctrl/Cmd 조합
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': e.preventDefault(); this.undo(); return;
                case 'y': e.preventDefault(); this.redo(); return;
                case 'a': e.preventDefault(); this.selectAll(); return;
                case 's': e.preventDefault(); this.saveLayout(); return;
                case 'd': e.preventDefault(); this.duplicateSelected(); return;
                case 'g': 
                    e.preventDefault(); 
                    e.shiftKey ? this.ungroupSelected() : this.groupSelected(); 
                    return;
            }
            return;
        }
        
        // Arrow Keys
        const arrowKey = e.key.toLowerCase();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(arrowKey)) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            this.moveSelected(arrowKey, step);
            return;
        }
        
        // 일반 단축키
        switch (e.key.toLowerCase()) {
            case 'v': this.activateTool('select'); break;
            case 'w': this.activateTool('wall'); break;
            case 'c': this.toggleComponentSubmenu(); break;
            case 'g': this.toggleGrid(); break;
            case 's': this.toggleSnap(); break;
            case 'm': this.toggleMICESnap(); break;
            case 'h': this.toggleSmartGuides(); break;
            case 'l': this.toggleAlignPopup(); break;
            case 'r': e.preventDefault(); e.shiftKey ? this.rotateCCW() : this.rotateCW(); break;
            case '=': case '+': this.zoomIn(); break;
            case '-': case '_': this.zoomOut(); break;
            case '0': this.resetZoom(); break;
            case 'delete': case 'backspace': this.deleteSelected(); break;
            case 'a': if (!e.ctrlKey && !e.metaKey) this.showEquipmentArrayModal(); break;
            case '[': e.shiftKey ? this.sendToBack() : this.sendBackward(); break;
            case ']': e.shiftKey ? this.bringToFront() : this.bringForward(); break;
            case 'escape': 
                this.deselectAll(); 
                if (this.state.componentSubmenuVisible) this.toggleComponentSubmenu(); 
                if (this.state.alignPopupVisible) this.hideAlignPopup(); 
                if (this.state.shortcutsHelpVisible) this.toggleShortcutsHelp(); 
                break;
            case '?': this.toggleShortcutsHelp(); break;
        }
    }
    
    // =====================================================
    // Arrow Keys로 이동
    // =====================================================
    moveSelected(direction, step) {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) return;
        
        let dx = 0, dy = 0;
        switch (direction) {
            case 'arrowleft':  dx = -step; break;
            case 'arrowright': dx = step; break;
            case 'arrowup':    dy = -step; break;
            case 'arrowdown':  dy = step; break;
        }
        
        if (this.commandManager && typeof MoveCommand !== 'undefined') {
            const moveCommand = new MoveCommand(selected, dx, dy);
            this.commandManager.execute(moveCommand);
            this.canvas.transformer?.forceUpdate();
        } else {
            selected.forEach(shape => {
                shape.x(shape.x() + dx);
                shape.y(shape.y() + dy);
            });
            this.canvas.stage.batchDraw();
            this.canvas.transformer?.forceUpdate();
        }
        
        this.updateStatus();
    }
    
    // =====================================================
    // 도구 활성화
    // =====================================================
    activateTool(toolName) {
        this.state.currentTool = toolName;
        
        if (toolName === 'select') {
            this.wallDrawTool?.deactivate();
        } else if (toolName === 'wall') {
            this.wallDrawTool?.activate();
        }
        
        document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
        
        const toolBtn = document.getElementById(`tool-${toolName}`);
        toolBtn?.classList.add('active');
        
        document.getElementById('status-tool').textContent = 
            toolName === 'select' ? '선택' : toolName === 'wall' ? '벽 그리기' : toolName;
            
        if (toolName === 'wall') {
            this.showToast('벽 그리기 모드', 'info');
        }
    }
    
    // =====================================================
    // Undo/Redo
    // =====================================================
    undo() {
        if (this.commandManager?.undo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.updateStatus();
            console.log('↩️ Undo 실행');
        }
    }
    
    redo() {
        if (this.commandManager?.redo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.updateStatus();
            console.log('↪️ Redo 실행');
        }
    }
    
    // =====================================================
    // 선택/삭제
    // =====================================================
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
            this.showToast(`${allShapes.length}개 선택됨`, 'success');
        }
    }
    
    deselectAll() {
        this.canvas.deselectAll?.();
        this.canvas.selectedObjects = [];
        this.canvas.transformer?.nodes([]);
        this.canvas.stage.batchDraw();
    }
    
    deleteSelected() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) {
            this.showToast('선택된 객체 없음', 'info');
            return;
        }
        
        const count = selected.length;
        
        if (this.commandManager && typeof DeleteCommand !== 'undefined') {
            const deleteCmd = new DeleteCommand(selected);
            this.commandManager.execute(deleteCmd);
            console.log('✅ DeleteCommand 등록:', count);
        } else {
            selected.forEach(shape => shape.destroy());
            this.canvas.stage.batchDraw();
        }
        
        this.canvas.selectedObjects = [];
        this.canvas.transformer?.nodes([]);
        this.updateObjectCount();
        this.showToast(`${count}개 삭제됨`, 'success');
    }
    
    // =====================================================
    // 복제
    // =====================================================
    duplicateSelected() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) {
            this.showToast('선택된 객체 없음', 'info');
            return;
        }
        
        const offset = 20;
        const newShapes = [];
        
        selected.forEach(shape => {
            const componentData = shape.getAttr('componentData');
            if (componentData) {
                const newShape = this.createComponent(componentData, shape.x() + offset, shape.y() + offset);
                if (newShape) newShapes.push(newShape);
            }
        });
        
        if (newShapes.length > 0) {
            this.canvas.selectObjects(newShapes);
            this.showToast(`${newShapes.length}개 복제됨`, 'success');
        }
    }
    
    // =====================================================
    // 줌
    // =====================================================
    zoomIn() {
        if (this.zoomController) {
            this.zoomController.zoomIn();
            this.updateZoomDisplay();
        }
    }
    
    zoomOut() {
        if (this.zoomController) {
            this.zoomController.zoomOut();
            this.updateZoomDisplay();
        }
    }
    
    resetZoom() {
        if (this.zoomController) {
            this.zoomController.resetZoom();
            this.updateZoomDisplay();
        }
    }
    
    updateZoomDisplay() {
        const zoom = this.canvas.stage?.scaleX() || 1;
        document.getElementById('status-zoom').textContent = Math.round(zoom * 100) + '%';
        if (this.state.zoom !== undefined) {
            this.state.zoom = zoom;
        }
    }
    
    // =====================================================
    // Grid/Snap 토글
    // =====================================================
    toggleGrid() { 
        this.canvas.toggleGrid(); 
        const isOn = this.canvas.config.showGrid;
        document.getElementById('status-grid').textContent = isOn ? 'ON' : 'OFF'; 
        this.zoomController?.updateGrid?.();
        if (this.state.showGrid !== undefined) {
            this.state.showGrid = isOn;
        }
    }
    
    toggleSnap() { 
        const isOn = this.canvas.toggleSnapToGrid(); 
        document.getElementById('status-snap').textContent = isOn ? 'ON' : 'OFF'; 
        if (this.state.snapToGrid !== undefined) {
            this.state.snapToGrid = isOn;
        }
    }
    
    toggleMICESnap() {
        if (this.canvas.snapManager?.miceSnapPoints) {
            const miceSnap = this.canvas.snapManager.miceSnapPoints;
            const isEnabled = miceSnap.toggle ? miceSnap.toggle() : !miceSnap.isEnabled;
            if (!miceSnap.toggle) miceSnap.isEnabled = isEnabled;
            document.getElementById('status-mice-snap').textContent = isEnabled ? 'ON' : 'OFF';
            this.showToast(`🎪 MICE Snap: ${isEnabled ? 'ON' : 'OFF'}`, 'info');
            if (this.state.miceSnapEnabled !== undefined) {
                this.state.miceSnapEnabled = isEnabled;
            }
        } else {
            this.showToast('MICESnapPoints 모듈 로드 안됨', 'error');
        }
    }
    
    toggleSmartGuides() {
        const sgm = this.canvas.smartGuideManager;
        if (sgm) {
            const isEnabled = sgm.isEnabled() ? (sgm.disable(), false) : (sgm.enable(), true);
            document.getElementById('status-smart-guides').textContent = isEnabled ? 'ON' : 'OFF';
            this.showToast(`📏 Smart Guides: ${isEnabled ? 'ON' : 'OFF'}`, 'info');
            if (this.state.smartGuidesEnabled !== undefined) {
                this.state.smartGuidesEnabled = isEnabled;
            }
        } else {
            this.showToast('SmartGuideManager 로드 안됨', 'error');
        }
    }
    
    // =====================================================
    // 레이어 순서
    // =====================================================
    bringForward() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) { this.showToast('선택된 객체 없음', 'info'); return; }
        selected.forEach(shape => shape.moveUp());
        this.canvas.stage.batchDraw();
        this.showToast('↑ 앞으로', 'success');
    }
    
    sendBackward() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) { this.showToast('선택된 객체 없음', 'info'); return; }
        selected.forEach(shape => shape.moveDown());
        this.canvas.stage.batchDraw();
        this.showToast('↓ 뒤로', 'success');
    }
    
    bringToFront() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) { this.showToast('선택된 객체 없음', 'info'); return; }
        selected.forEach(shape => shape.moveToTop());
        this.canvas.stage.batchDraw();
        this.showToast('⬆️ 맨 앞으로', 'success');
    }
    
    sendToBack() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) { this.showToast('선택된 객체 없음', 'info'); return; }
        selected.forEach(shape => shape.moveToBottom());
        this.canvas.stage.batchDraw();
        this.showToast('⬇️ 맨 뒤로', 'success');
    }
    
    // =====================================================
    // Export
    // =====================================================
    exportPNG() {
        try {
            const dataURL = this.canvas.stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `layout_${Date.now()}.png`;
            link.click();
            this.showToast('🖼️ PNG 저장 완료!', 'success');
        } catch (error) {
            console.error('[Export PNG Error]', error);
            this.showToast('PNG 저장 실패: ' + error.message, 'error');
        }
    }
    
    // =====================================================
    // 모달
    // =====================================================
    showRoomSizeModal() { 
        document.getElementById('room-size-modal')?.classList.add('active'); 
    }
    
    closeRoomSizeModal() { 
        document.getElementById('room-size-modal')?.classList.remove('active'); 
    }
    
    applyRoomSize() {
        const width = parseFloat(document.getElementById('room-width')?.value);
        const depth = parseFloat(document.getElementById('room-depth')?.value);
        const height = parseFloat(document.getElementById('room-height')?.value);
        
        if (width < 10 || depth < 10) { 
            this.showToast('최소 10m 이상', 'error'); 
            return; 
        }
        
        this.roomSizeManager?.updateRoomSize(width, depth, height);
        this.closeRoomSizeModal();
        this.showToast(`Room: ${width}m × ${depth}m`, 'success');
    }
    
    showEquipmentArrayModal() { 
        document.getElementById('eq-array-modal')?.classList.add('active'); 
    }
    
    closeEquipmentArrayModal() { 
        document.getElementById('eq-array-modal')?.classList.remove('active'); 
    }
    
    applyEquipmentArray() {
        const rows = parseInt(document.getElementById('eq-rows')?.value) || 3;
        const cols = parseInt(document.getElementById('eq-cols')?.value) || 5;
        const spacingX = parseFloat(document.getElementById('eq-spacing-x')?.value) || 2.0;
        const spacingY = parseFloat(document.getElementById('eq-spacing-y')?.value) || 3.5;
        
        this.closeEquipmentArrayModal();
        
        if (this.equipmentArrayTool) {
            this.equipmentArrayTool.startArrayPlacement({ rows, cols, spacingX, spacingY });
            this.showToast(`클릭하여 ${rows}×${cols} 배열 시작점 지정`, 'info');
        } else {
            this.showToast('EquipmentArrayTool 로드 안됨', 'error');
        }
    }
    
    // =====================================================
    // 그룹화
    // =====================================================
    groupSelected() {
        if (!this.groupingTool) { 
            this.showToast('GroupingTool 로드 안됨', 'error'); 
            return; 
        }
        const group = this.groupingTool.groupSelected();
        if (group) {
            this.showToast(`📦 ${group.getChildren().length}개 객체 그룹화됨`, 'success');
            this.updateStatus();
        } else {
            this.showToast('2개 이상 선택 필요', 'info');
        }
    }
    
    ungroupSelected() {
        if (!this.groupingTool) { 
            this.showToast('GroupingTool 로드 안됨', 'error'); 
            return; 
        }
        const objects = this.groupingTool.ungroupSelected();
        if (objects && objects.length > 0) {
            this.showToast(`📤 ${objects.length}개 객체 그룹 해제됨`, 'success');
            this.updateStatus();
        } else {
            this.showToast('그룹을 선택하세요', 'info');
        }
    }
    
    // =====================================================
    // 정렬/회전
    // =====================================================
    toggleAlignPopup() {
        this.state.alignPopupVisible = !this.state.alignPopupVisible;
        const popup = document.getElementById('align-popup');
        const btn = document.getElementById('align-btn');
        
        if (this.state.alignPopupVisible) {
            const btnRect = btn.getBoundingClientRect();
            popup.style.top = `${btnRect.top}px`;
            popup.style.left = `${btnRect.right + 5}px`;
            if (this.state.componentSubmenuVisible) this.toggleComponentSubmenu();
        }
        
        popup?.classList.toggle('show', this.state.alignPopupVisible);
        btn?.classList.toggle('active', this.state.alignPopupVisible);
    }
    
    hideAlignPopup() { 
        if (this.state.alignPopupVisible) { 
            this.state.alignPopupVisible = false; 
            document.getElementById('align-popup')?.classList.remove('show'); 
            document.getElementById('align-btn')?.classList.remove('active'); 
        } 
    }
    
    alignLeft() { this.alignmentTool?.alignLeft(); this.hideAlignPopup(); }
    alignRight() { this.alignmentTool?.alignRight(); this.hideAlignPopup(); }
    alignTop() { this.alignmentTool?.alignTop(); this.hideAlignPopup(); }
    alignBottom() { this.alignmentTool?.alignBottom(); this.hideAlignPopup(); }
    alignCenterH() { this.alignmentTool?.alignCenterHorizontal(); this.hideAlignPopup(); }
    alignCenterV() { this.alignmentTool?.alignCenterVertical(); this.hideAlignPopup(); }
    distributeH() { this.alignmentTool?.distributeHorizontal(); this.hideAlignPopup(); }
    distributeV() { this.alignmentTool?.distributeVertical(); this.hideAlignPopup(); }
    
    rotateCW() { 
        if (!this.alignmentTool) { this.showToast('AlignmentTool 오류', 'error'); return; } 
        this.alignmentTool.rotateCW(); 
    }
    
    rotateCCW() { 
        if (!this.alignmentTool) { this.showToast('AlignmentTool 오류', 'error'); return; } 
        this.alignmentTool.rotateCCW(); 
    }
    
    resetRotation() { 
        this.alignmentTool?.resetRotation(); 
        this.hideAlignPopup(); 
    }
    
    // =====================================================
    // 저장/로드
    // =====================================================
    saveLayout() { 
        const layout = this.canvas.getCurrentLayout(); 
        const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' }); 
        const link = document.createElement('a'); 
        link.href = URL.createObjectURL(blob); 
        link.download = 'layout_' + Date.now() + '.json'; 
        link.click(); 
        this.showToast('저장 완료!', 'success'); 
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
        this.selectionTool?.attachEventListeners?.();
        this.updateObjectCount();
        this.showToast('샘플 로드 완료!', 'success');
    }
    
    // =====================================================
    // 상태 업데이트
    // =====================================================
    updateStatus() {
        this.updateObjectCount();
        this.updateZoomDisplay();
        
        // 그룹 카운트
        let groupCount = 0;
        ['room', 'equipment'].forEach(layerName => {
            const layer = this.canvas.layers[layerName];
            if (layer) {
                layer.find('Group').forEach(group => {
                    if (group.getAttr('isUserGroup')) groupCount++;
                });
            }
        });
        document.getElementById('status-groups').textContent = groupCount;
        
        if (this.state.updateStats) {
            this.state.updateStats({ groupCount });
        }
    }
    
    updateObjectCount() {
        let count = 0;
        ['room', 'equipment'].forEach(layerName => {
            const layer = this.canvas.layers[layerName];
            if (layer) {
                layer.find('Group').forEach(group => {
                    if (group.name()?.includes('component') || group.getAttr('componentType')) {
                        count++;
                    }
                });
            }
        });
        document.getElementById('status-objects').textContent = count;
        document.getElementById('status-selected').textContent = this.canvas.selectedObjects?.length || 0;
        
        if (this.state.totalObjects !== undefined) {
            this.state.totalObjects = count;
        }
    }
    
    // =====================================================
    // 단축키 도움말
    // =====================================================
    toggleShortcutsHelp() { 
        this.state.shortcutsHelpVisible = !this.state.shortcutsHelpVisible; 
        document.getElementById('shortcuts-help')?.classList.toggle('show', this.state.shortcutsHelpVisible); 
    }
    
    // =====================================================
    // Toast
    // =====================================================
    showToast(message, type = 'info') { 
        const toast = document.createElement('div'); 
        toast.className = `toast ${type}`; 
        toast.textContent = message; 
        document.body.appendChild(toast); 
        setTimeout(() => { 
            toast.style.animation = 'slideIn 0.3s reverse'; 
            setTimeout(() => toast.remove(), 300); 
        }, 2000); 
    }
}

// =====================================================
// 전역 노출
// =====================================================
if (typeof window !== 'undefined') {
    window.LayoutEditorApp = LayoutEditorApp;
}

console.log('✅ LayoutEditorApp.js 로드 완료 (Phase 5.1 - Config/State 분리)');