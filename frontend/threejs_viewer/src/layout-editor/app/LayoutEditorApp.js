/**
 * LayoutEditorApp.js
 * Phase 5: 기존 test_layout_editor_total.html의 인라인 JS를 외부 파일로 분리
 * 
 * ✅ 외부 모듈 활용:
 *   - Command.js의 MoveCommand, DeleteCommand, CreateCommand
 *   - CommandManager.js
 *   - InfiniteGridZoomController.js (별도 script 태그로 로드)
 * 
 * ✅ 기존 UI 100% 유지
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/app/LayoutEditorApp.js
 */

// =====================================================
// ✅ 컴포넌트 정의
// =====================================================
const COMPONENTS = {
    partition: { id: 'partition', name: 'Partition', width: 3.0, depth: 2.5, color: '#888888' },
    desk: { id: 'desk', name: 'Desk', width: 1.6, depth: 0.8, color: '#8B4513' },
    pillar: { id: 'pillar', name: 'Pillar', width: 0.3, depth: 0.3, color: '#333333' },
    office: { id: 'office', name: 'Office', width: 12.0, depth: 20.0, color: '#87CEEB' },
    equipment: { id: 'equipment', name: 'Equipment', width: 1.5, depth: 3.0, color: '#FF8C00' }
};

// =====================================================
// ✅ CSS 변수 읽기
// =====================================================
const rootStyles = getComputedStyle(document.documentElement);
const TOOLBAR_WIDTH = parseInt(rootStyles.getPropertyValue('--toolbar-width')) || 60;
const TOOLBAR_EXPANDED_WIDTH = parseInt(rootStyles.getPropertyValue('--toolbar-expanded-width')) || 270;
const PROPERTY_PANEL_WIDTH = parseInt(rootStyles.getPropertyValue('--property-panel-width')) || 260;
const HEADER_HEIGHT = parseInt(rootStyles.getPropertyValue('--header-height')) || 48;
const STATUS_HEIGHT = parseInt(rootStyles.getPropertyValue('--status-height')) || 30;

// =====================================================
// Main App - ✅ Phase 5: 외부 Command 모듈 100% 활용
// =====================================================
class LayoutEditorApp {
    constructor() {
        console.log('✅ LayoutEditorApp 초기화 시작...');
        this.componentSubmenuVisible = false;
        this.alignPopupVisible = false;
        this.shortcutsHelpVisible = false;
        
        const canvasSize = this.calculateCanvasSize();
        
        if (typeof Canvas2DEditor === 'undefined') throw new Error('Canvas2DEditor가 로드되지 않았습니다.');
        
        this.canvas = new Canvas2DEditor('canvas-container', { 
            width: canvasSize.width, 
            height: canvasSize.height, 
            showGrid: true, 
            snapToGrid: true, 
            gridSize: 10 
        });
        
        // ✅ 외부 InfiniteGridZoomController 모듈 사용
        if (typeof InfiniteGridZoomController !== 'undefined') {
            this.zoomController = new InfiniteGridZoomController(this.canvas, { 
                minZoom: 0.1, 
                maxZoom: 5.0, 
                zoomStep: 0.1, 
                wheelSensitivity: 0.001 
            });
            this.canvas.setZoomController(this.zoomController);
            this.zoomController.activate();
            this.zoomController.updateGrid();
            console.log('✅ InfiniteGridZoomController 초기화 완료 (외부 모듈)');
        } else {
            console.warn('⚠️ InfiniteGridZoomController가 로드되지 않았습니다');
        }
        
        if (typeof ObjectSelectionTool !== 'undefined') { this.selectionTool = new ObjectSelectionTool(this.canvas); this.selectionTool.activate(); }
        if (typeof RoomSizeManager !== 'undefined') { this.roomSizeManager = new RoomSizeManager(this.canvas); }
        if (typeof WallDrawTool !== 'undefined') { 
            this.wallDrawTool = new WallDrawTool(this.canvas); 
            this.canvas.setWallDrawTool(this.wallDrawTool);
        }
        if (typeof EquipmentArrayTool !== 'undefined') { 
            this.equipmentArrayTool = new EquipmentArrayTool(this.canvas);
            this.canvas.equipmentArrayTool = this.equipmentArrayTool;
        }
        if (typeof PropertyPanel !== 'undefined') { this.propertyPanel = new PropertyPanel('property-panel', this.canvas); this.canvas.setPropertyPanel(this.propertyPanel); }
        if (typeof AlignmentTool !== 'undefined') { this.alignmentTool = new AlignmentTool(this.canvas); }
        
        // ✅ Phase 3: GroupingTool 초기화
        if (typeof GroupingTool !== 'undefined') { 
            this.groupingTool = new GroupingTool(this.canvas); 
        }
        
        // ✅ Phase 5: CommandManager 초기화 (외부 모듈 활용)
        this.initCommandManager();
        
        this.enableDropZone();
        this.setupComponentSubmenu();
        this.setupEventListeners();
        this.bindToolbarButtons();
        this.currentTool = 'select';
        setInterval(() => this.updateStatus(), 500);
        
        document.getElementById('loading-indicator').style.display = 'none';
        console.log('✅ Layout Editor 초기화 완료 (Phase 5)');
        this.showToast('Layout Editor 준비 완료! (Phase 5)', 'success');
    }
    
    // =====================================================
    // ✅ Phase 5: CommandManager 초기화 (외부 모듈 활용)
    // =====================================================
    initCommandManager() {
        if (typeof CommandManager !== 'undefined') {
            this.commandManager = new CommandManager({
                maxHistory: 50,
                onHistoryChange: (state) => {
                    // 버튼 활성화/비활성화
                    document.getElementById('btn-undo').disabled = !state.canUndo;
                    document.getElementById('btn-redo').disabled = !state.canRedo;
                    
                    // 상태바 업데이트
                    document.getElementById('status-undo').textContent = state.undoCount;
                    document.getElementById('status-redo').textContent = state.redoCount;
                }
            });
            
            // Canvas2DEditor에 CommandManager 연결
            this.canvas.commandManager = this.commandManager;
            
            console.log('✅ CommandManager 초기화 완료');
            
            // ✅ 외부 Command 클래스 확인
            console.log('✅ 외부 Command 클래스 확인:', {
                MoveCommand: typeof MoveCommand !== 'undefined',
                DeleteCommand: typeof DeleteCommand !== 'undefined',
                CreateCommand: typeof CreateCommand !== 'undefined'
            });
        } else {
            console.warn('⚠️ CommandManager가 로드되지 않았습니다 - Undo/Redo 비활성화');
        }
    }
    
    calculateCanvasSize() {
        const toolbarWidth = this.componentSubmenuVisible ? TOOLBAR_EXPANDED_WIDTH : TOOLBAR_WIDTH;
        return { 
            width: window.innerWidth - toolbarWidth - PROPERTY_PANEL_WIDTH, 
            height: window.innerHeight - HEADER_HEIGHT - STATUS_HEIGHT 
        };
    }
    
    // ✅ Phase 2 버그 수정: resize() → stage 직접 수정
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
    
    bindToolbarButtons() {
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('btn-help').addEventListener('click', () => this.toggleShortcutsHelp());
        document.getElementById('btn-save').addEventListener('click', () => this.saveLayout());
        document.getElementById('btn-export-png').addEventListener('click', () => this.exportPNG());
        document.getElementById('tool-select').addEventListener('click', () => this.activateTool('select'));
        document.getElementById('tool-room').addEventListener('click', () => this.showRoomSizeModal());
        document.getElementById('tool-wall').addEventListener('click', () => this.activateTool('wall'));
        document.getElementById('component-btn').addEventListener('click', () => this.toggleComponentSubmenu());
        document.getElementById('tool-grid').addEventListener('click', () => this.toggleGrid());
        document.getElementById('tool-snap').addEventListener('click', () => this.toggleSnap());
        document.getElementById('tool-zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('tool-zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('tool-zoom-reset').addEventListener('click', () => this.resetZoom());
        document.getElementById('tool-select-all').addEventListener('click', () => this.selectAll());
        document.getElementById('tool-delete').addEventListener('click', () => this.deleteSelected());
        document.getElementById('tool-deselect').addEventListener('click', () => this.deselectAll());
        document.getElementById('align-btn').addEventListener('click', () => this.toggleAlignPopup());
        document.getElementById('tool-rotate').addEventListener('click', () => this.rotateCW());
        document.getElementById('tool-sample').addEventListener('click', () => this.loadSampleLayout());
        document.getElementById('align-left').addEventListener('click', () => this.alignLeft());
        document.getElementById('align-right').addEventListener('click', () => this.alignRight());
        document.getElementById('align-top').addEventListener('click', () => this.alignTop());
        document.getElementById('align-bottom').addEventListener('click', () => this.alignBottom());
        document.getElementById('align-center-h').addEventListener('click', () => this.alignCenterH());
        document.getElementById('align-center-v').addEventListener('click', () => this.alignCenterV());
        document.getElementById('distribute-h').addEventListener('click', () => this.distributeH());
        document.getElementById('distribute-v').addEventListener('click', () => this.distributeV());
        document.getElementById('rotate-cw').addEventListener('click', () => this.rotateCW());
        document.getElementById('rotate-ccw').addEventListener('click', () => this.rotateCCW());
        document.getElementById('rotate-reset').addEventListener('click', () => this.resetRotation());
        document.getElementById('room-cancel').addEventListener('click', () => this.closeRoomSizeModal());
        document.getElementById('room-apply').addEventListener('click', () => this.applyRoomSize());
        
        // ✅ Phase 3: Equipment Array + 그룹화 버튼
        document.getElementById('tool-eq-array').addEventListener('click', () => this.showEquipmentArrayModal());
        document.getElementById('tool-group').addEventListener('click', () => this.groupSelected());
        document.getElementById('tool-ungroup').addEventListener('click', () => this.ungroupSelected());
        document.getElementById('eq-array-cancel').addEventListener('click', () => this.closeEquipmentArrayModal());
        document.getElementById('eq-array-apply').addEventListener('click', () => this.applyEquipmentArray());
    }
    
    enableDropZone() {
        const container = this.canvas.stage.container();
        const dropGuide = document.getElementById('drop-guide');
        container.addEventListener('dragover', e => { e.preventDefault(); dropGuide.classList.add('visible'); });
        container.addEventListener('dragleave', () => dropGuide.classList.remove('visible'));
        container.addEventListener('drop', e => { e.preventDefault(); dropGuide.classList.remove('visible'); this.handleDrop(e); });
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
        if (shape) { this.canvas.selectObject(shape, false); this.selectionTool?.attachShapeEvents?.(shape); this.updateObjectCount(); this.showToast(`${component.name} 생성됨`, 'success'); }
    }
    
    createComponent(component, x, y) {
        const scale = this.canvas.config.scale || 10;
        const width = component.width * scale;
        const height = component.depth * scale;
        if (this.canvas.config.snapToGrid) { const gridSize = this.canvas.config.gridSize; x = Math.round(x / gridSize) * gridSize; y = Math.round(y / gridSize) * gridSize; }
        const id = `${component.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const group = new Konva.Group({ id, x, y, draggable: true, name: component.id + ' component' });
        const rect = new Konva.Rect({ x: -width / 2, y: -height / 2, width, height, fill: component.color, stroke: '#333', strokeWidth: 2, name: 'componentRect' });
        const arrowLength = Math.min(width, height) * 0.5;
        const arrow = new Konva.Arrow({ points: [0, height / 2 - 4, 0, height / 2 - 4 - arrowLength], pointerLength: 6, pointerWidth: 6, fill: '#ff4444', stroke: '#ff4444', strokeWidth: 2, name: 'directionArrow' });
        const dirLabel = new Konva.Text({ x: -12, y: height / 2 - arrowLength - 18, text: 'Front', fontSize: 9, fill: '#ff4444', fontStyle: 'bold', name: 'directionLabel' });
        group.add(rect); group.add(arrow); group.add(dirLabel);
        group.setAttr('componentType', component.id); group.setAttr('componentData', component); group.setAttr('currentRotation', 0);
        
        // ✅ Undo/Redo: 드래그 시작 시 초기 위치 저장
        group.on('dragstart', () => { 
            group._dragStartPos = { x: group.x(), y: group.y() }; 
            console.log('📍 Drag Start:', group._dragStartPos);
        });
        
        // ✅ Undo/Redo: 드래그 종료 시 MoveCommand 등록
        group.on('dragend', () => { 
            const startPos = group._dragStartPos;
            // Snap to grid
            if (this.canvas.config.snapToGrid) { 
                const gridSize = this.canvas.config.gridSize; 
                group.x(Math.round(group.x() / gridSize) * gridSize); 
                group.y(Math.round(group.y() / gridSize) * gridSize); 
                group.getLayer()?.batchDraw(); 
            }
            // ✅ MoveCommand 등록 (외부 Command.js 사용)
            if (startPos && this.commandManager && typeof MoveCommand !== 'undefined') {
                const dx = group.x() - startPos.x;
                const dy = group.y() - startPos.y;
                if (dx !== 0 || dy !== 0) {
                    // 이미 이동된 상태 -> 되돌린 후 Command로 재실행
                    group.x(startPos.x);
                    group.y(startPos.y);
                    const moveCommand = new MoveCommand([group], dx, dy);
                    this.commandManager.execute(moveCommand);
                    console.log('✅ MoveCommand 등록:', { dx, dy });
                    this.updateStatus();
                }
            }
            delete group._dragStartPos;
        });
        
        group.on('click tap', e => { e.cancelBubble = true; this.canvas.selectObject(group, e.evt.ctrlKey || e.evt.metaKey); });
        const layer = component.id === 'equipment' ? this.canvas.layers.equipment : this.canvas.layers.room;
        
        // ✅ CreateCommand를 통해 생성 (외부 Command.js 사용)
        if (this.commandManager && typeof CreateCommand !== 'undefined') {
            const createCmd = new CreateCommand(group, layer);
            this.commandManager.execute(createCmd);
            console.log('✅ CreateCommand 등록:', id);
        } else {
            // CommandManager 없으면 직접 추가
            layer.add(group); 
            layer.batchDraw();
        }
        
        this.canvas.componentShapes?.set(id, group);
        return group;
    }
    
    setupComponentSubmenu() {
        document.querySelectorAll('.submenu-item').forEach(item => {
            const componentType = item.dataset.component;
            item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', componentType); item.style.opacity = '0.5'; });
            item.addEventListener('dragend', () => item.style.opacity = '1');
            item.addEventListener('click', () => {
                const component = COMPONENTS[componentType];
                if (component) {
                    const stage = this.canvas.stage;
                    const centerX = (this.canvas.config.width / 2 - stage.x()) / stage.scaleX();
                    const centerY = (this.canvas.config.height / 2 - stage.y()) / stage.scaleY();
                    const shape = this.createComponent(component, centerX, centerY);
                    if (shape) { this.canvas.selectObject(shape, false); this.selectionTool?.attachShapeEvents?.(shape); this.updateObjectCount(); this.showToast(`${component.name} 생성됨`, 'success'); }
                }
            });
        });
    }
    
    toggleComponentSubmenu() {
        this.componentSubmenuVisible = !this.componentSubmenuVisible;
        document.getElementById('toolbar-container').classList.toggle('expanded', this.componentSubmenuVisible);
        document.getElementById('component-btn').classList.toggle('active', this.componentSubmenuVisible);
        if (this.componentSubmenuVisible && this.alignPopupVisible) this.hideAlignPopup();
        setTimeout(() => this.updateCanvasSize(), 350);
    }
    
    // =====================================================
    // ✅ 키보드 이벤트 - 모든 단축키 통합
    // =====================================================
    setupEventListeners() {
        document.addEventListener('keydown', e => {
            // Ctrl/Cmd 키 조합
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') { e.preventDefault(); this.undo(); }
                else if (e.key === 'y') { e.preventDefault(); this.redo(); }
                else if (e.key === 'a') { e.preventDefault(); this.selectAll(); }
                else if (e.key === 's') { e.preventDefault(); this.saveLayout(); }
                // ✅ Phase 2: 복제 (Ctrl+D)
                else if (e.key === 'd') { e.preventDefault(); this.duplicateSelected(); }
                // ✅ Phase 3: 그룹화 (Ctrl+G / Ctrl+Shift+G)
                else if (e.key === 'g' && e.shiftKey) { e.preventDefault(); this.ungroupSelected(); }
                else if (e.key === 'g') { e.preventDefault(); this.groupSelected(); }
                return;
            }
            
            // ✅ Arrow Keys 처리
            if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;  // Shift = 10px, 기본 = 1px
                this.moveSelected(e.key.toLowerCase(), step);
                return;
            }
            
            // 일반 단축키
            switch (e.key.toLowerCase()) {
                case 'v': this.activateTool('select'); break;
                case 'w': this.activateTool('wall'); break;
                case 'c': this.toggleComponentSubmenu(); break;
                case 'g': this.toggleGrid(); break;
                case 's': this.toggleSnap(); break;
                // ✅ Phase 2: MICE Snap 토글 (M)
                case 'm': this.toggleMICESnap(); break;
                // ✅ Phase 4: Smart Guides 토글 (H)
                case 'h': this.toggleSmartGuides(); break;
                case 'l': this.toggleAlignPopup(); break;
                case 'r': e.preventDefault(); if (e.shiftKey) this.rotateCCW(); else this.rotateCW(); break;
                case '=': case '+': this.zoomIn(); break;
                case '-': case '_': this.zoomOut(); break;
                case '0': this.resetZoom(); break;
                case 'delete': case 'backspace': this.deleteSelected(); break;
                // ✅ Phase 3: Equipment Array 단축키 (A)
                case 'a': if (!e.ctrlKey && !e.metaKey) this.showEquipmentArrayModal(); break;
                // ✅ Phase 4: 레이어 순서 ([ / ])
                case '[': e.shiftKey ? this.sendToBack() : this.sendBackward(); break;
                case ']': e.shiftKey ? this.bringToFront() : this.bringForward(); break;
                case 'escape': 
                    this.deselectAll(); 
                    if (this.componentSubmenuVisible) this.toggleComponentSubmenu(); 
                    if (this.alignPopupVisible) this.hideAlignPopup(); 
                    if (this.shortcutsHelpVisible) this.toggleShortcutsHelp(); 
                    break;
                case '?': this.toggleShortcutsHelp(); break;
            }
        });
        
        document.addEventListener('click', e => {
            const toolbarContainer = document.getElementById('toolbar-container');
            const alignPopup = document.getElementById('align-popup');
            const alignBtn = document.getElementById('align-btn');
            if (this.componentSubmenuVisible && !toolbarContainer.contains(e.target)) this.toggleComponentSubmenu();
            if (this.alignPopupVisible && !alignPopup.contains(e.target) && !alignBtn.contains(e.target)) this.hideAlignPopup();
        });
        
        window.addEventListener('resize', () => this.updateCanvasSize());
    }
    
    // =====================================================
    // ✅ Arrow Keys로 선택 객체 이동
    // =====================================================
    moveSelected(direction, step) {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) {
            return;  // 선택된 객체 없으면 조용히 무시
        }
        
        let dx = 0, dy = 0;
        switch(direction) {
            case 'arrowleft':  dx = -step; break;
            case 'arrowright': dx = step; break;
            case 'arrowup':    dy = -step; break;
            case 'arrowdown':  dy = step; break;
        }
        
        // ✅ MoveCommand 사용 (외부 Command.js)
        if (this.commandManager && typeof MoveCommand !== 'undefined') {
            const moveCommand = new MoveCommand(selected, dx, dy);
            this.commandManager.execute(moveCommand);
            console.log('✅ MoveCommand (Arrow):', { dx, dy });
            
            // Transformer 위치 갱신
            if (this.canvas.transformer) {
                this.canvas.transformer.forceUpdate();
            }
        } else {
            // CommandManager 없으면 직접 이동
            selected.forEach(shape => {
                shape.x(shape.x() + dx);
                shape.y(shape.y() + dy);
            });
            this.canvas.stage.batchDraw();
            
            if (this.canvas.transformer) {
                this.canvas.transformer.forceUpdate();
            }
        }
        
        // 상태 업데이트
        this.updateStatus();
    }
    
    activateTool(toolName) {
        this.currentTool = toolName;
        if (toolName === 'select') this.wallDrawTool?.deactivate();
        else if (toolName === 'wall') this.wallDrawTool?.activate();
        document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
        if (toolName === 'select') document.getElementById('tool-select').classList.add('active');
        else if (toolName === 'wall') document.getElementById('tool-wall').classList.add('active');
        document.getElementById('status-tool').textContent = toolName === 'select' ? '선택' : toolName === 'wall' ? '벽 그리기' : toolName;
        if (toolName === 'wall') this.showToast('벽 그리기 모드', 'info');
    }
    
    showRoomSizeModal() { document.getElementById('room-size-modal').classList.add('active'); }
    closeRoomSizeModal() { document.getElementById('room-size-modal').classList.remove('active'); }
    applyRoomSize() {
        const width = parseFloat(document.getElementById('room-width').value);
        const depth = parseFloat(document.getElementById('room-depth').value);
        const height = parseFloat(document.getElementById('room-height').value);
        if (width < 10 || depth < 10) { this.showToast('최소 10m 이상', 'error'); return; }
        this.roomSizeManager?.updateRoomSize(width, depth, height);
        this.closeRoomSizeModal();
        this.showToast(`Room: ${width}m × ${depth}m`, 'success');
    }
    
    toggleGrid() { 
        this.canvas.toggleGrid(); 
        document.getElementById('status-grid').textContent = this.canvas.config.showGrid ? 'ON' : 'OFF'; 
        this.zoomController?.updateGrid?.();
    }
    toggleSnap() { const isOn = this.canvas.toggleSnapToGrid(); document.getElementById('status-snap').textContent = isOn ? 'ON' : 'OFF'; }
    
    // =====================================================
    // ✅ Phase 2: MICE Snap 토글
    // =====================================================
    toggleMICESnap() {
        if (this.canvas.snapManager?.miceSnapPoints) {
            const miceSnap = this.canvas.snapManager.miceSnapPoints;
            const isEnabled = miceSnap.toggle ? miceSnap.toggle() : !miceSnap.isEnabled;
            if (!miceSnap.toggle) miceSnap.isEnabled = isEnabled;
            document.getElementById('status-mice-snap').textContent = isEnabled ? 'ON' : 'OFF';
            this.showToast(`🎪 MICE Snap: ${isEnabled ? 'ON' : 'OFF'}`, 'info');
        } else {
            this.showToast('MICESnapPoints 모듈 로드 안됨', 'error');
        }
    }
    
    // =====================================================
    // ✅ Phase 4: Smart Guides 토글
    // =====================================================
    toggleSmartGuides() {
        const sgm = this.canvas.smartGuideManager;
        if (sgm) {
            if (sgm.isEnabled()) {
                sgm.disable();
                document.getElementById('status-smart-guides').textContent = 'OFF';
                this.showToast('📏 Smart Guides: OFF', 'info');
            } else {
                sgm.enable();
                document.getElementById('status-smart-guides').textContent = 'ON';
                this.showToast('📏 Smart Guides: ON', 'info');
            }
        } else {
            this.showToast('SmartGuideManager 로드 안됨', 'error');
        }
    }
    
    // =====================================================
    // ✅ Phase 4: 레이어 순서 조절
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
    // ✅ Phase 4: Export PNG/SVG (Konva 내장 기능 활용)
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
    
    exportSVG() {
        try {
            const dataURL = this.canvas.stage.toDataURL({ mimeType: 'image/png' });
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `layout_${Date.now()}.png`;
            link.click();
            this.showToast('📐 이미지 저장 완료 (SVG는 별도 변환 필요)', 'info');
        } catch (error) {
            console.error('[Export SVG Error]', error);
            this.showToast('저장 실패: ' + error.message, 'error');
        }
    }
    
    zoomIn() { 
        this.zoomController?.zoomIn(); 
        this.zoomController?.updateGrid?.();
        this.updateZoomDisplay(); 
    }
    zoomOut() { 
        this.zoomController?.zoomOut(); 
        this.zoomController?.updateGrid?.();
        this.updateZoomDisplay(); 
    }
    resetZoom() { 
        this.zoomController?.resetZoom(); 
        this.zoomController?.updateGrid?.();
        this.updateZoomDisplay(); 
    }
    updateZoomDisplay() { const zoom = this.zoomController?.getZoom?.() || 1; document.getElementById('status-zoom').textContent = (zoom * 100).toFixed(0) + '%'; }
    
    deleteSelected() { 
        if (this.canvas.selectedObjects.length === 0) { 
            this.showToast('선택된 객체 없음', 'info'); 
            return; 
        } 
        const count = this.canvas.selectedObjects.length;
        const shapesToDelete = [...this.canvas.selectedObjects];
        
        // ✅ DeleteCommand를 통해 삭제 (외부 Command.js 사용)
        if (this.commandManager && typeof DeleteCommand !== 'undefined') {
            const deleteCmd = new DeleteCommand(shapesToDelete);
            this.commandManager.execute(deleteCmd);
            // 선택 해제는 App에서 처리
            this.canvas.selectedObjects = [];
            this.canvas.updateTransformer?.();
            console.log('✅ DeleteCommand 등록:', count, '개');
        } else {
            // CommandManager 없으면 직접 삭제
            this.canvas.deleteSelected(); 
        }
        
        this.updateObjectCount();
        this.updateStatus();
        this.showToast(`${count}개 삭제됨`); 
    }
    deselectAll() { this.canvas.deselectAll(); this.propertyPanel?.hide(); this.updateStatus(); }
    selectAll() { this.selectionTool?.selectAll(); this.updateStatus(); this.showToast(`${this.canvas.selectedObjects.length}개 선택됨`, 'success'); }
    updateObjectCount() { setTimeout(() => { document.getElementById('status-objects').textContent = this.canvas.getObjectCount().total; }, 100); }
    
    // =====================================================
    // ✅ 상태 업데이트 (전체 통합)
    // =====================================================
    updateStatus() { 
        const objectCount = this.canvas.getObjectCount();
        document.getElementById('status-objects').textContent = objectCount.total; 
        document.getElementById('status-selected').textContent = this.canvas.selectedObjects.length; 
        this.updateZoomDisplay(); 
        document.getElementById('status-grid').textContent = this.canvas.config.showGrid ? 'ON' : 'OFF'; 
        document.getElementById('status-snap').textContent = this.canvas.config.snapToGrid ? 'ON' : 'OFF';
        
        // ✅ Phase 2: Equipment 카운트
        document.getElementById('status-equipment').textContent = objectCount.equipment || objectCount.equipments || 0;
        
        // ✅ Phase 2: MICE Snap 상태
        if (this.canvas.snapManager?.miceSnapPoints) {
            document.getElementById('status-mice-snap').textContent = this.canvas.snapManager.miceSnapPoints.isEnabled ? 'ON' : 'OFF';
        }
        
        // ✅ Phase 3: 그룹 수 표시
        const groupCount = this.groupingTool?.getGroupCount?.() || 0;
        document.getElementById('status-groups').textContent = groupCount;
        
        // ✅ Phase 4: Smart Guides 상태
        if (this.canvas.smartGuideManager) {
            document.getElementById('status-smart-guides').textContent = this.canvas.smartGuideManager.isEnabled?.() ? 'ON' : 'OFF';
        }
        
        // ✅ Undo/Redo 상태 업데이트
        if (this.commandManager) {
            const historySize = this.commandManager.getHistorySize();
            document.getElementById('status-undo').textContent = historySize.undo;
            document.getElementById('status-redo').textContent = historySize.redo;
            document.getElementById('btn-undo').disabled = !this.commandManager.canUndo();
            document.getElementById('btn-redo').disabled = !this.commandManager.canRedo();
        }
    }
    
    // =====================================================
    // ✅ Undo/Redo 실제 연동
    // =====================================================
    undo() { 
        if (this.commandManager) {
            if (this.commandManager.canUndo()) {
                this.commandManager.undo();
                this.updateStatus();
                this.canvas.stage.batchDraw();
                this.showToast('↶ Undo', 'info');
            } else {
                this.showToast('Undo할 항목 없음', 'info');
            }
        } else {
            this.showToast('CommandManager 로드 안됨', 'error');
        }
    }
    
    redo() { 
        if (this.commandManager) {
            if (this.commandManager.canRedo()) {
                this.commandManager.redo();
                this.updateStatus();
                this.canvas.stage.batchDraw();
                this.showToast('↷ Redo', 'info');
            } else {
                this.showToast('Redo할 항목 없음', 'info');
            }
        } else {
            this.showToast('CommandManager 로드 안됨', 'error');
        }
    }
    
    // =====================================================
    // ✅ Phase 2: 복제 기능 (Ctrl+D)
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
            const rotation = shape.rotation() || 0;
            
            if (componentData) {
                const newShape = this.createComponent(componentData, shape.x() + offset, shape.y() + offset);
                if (newShape) { newShape.rotation(rotation); newShapes.push(newShape); }
            } else {
                const clone = shape.clone({ x: shape.x() + offset, y: shape.y() + offset });
                clone.id(`clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
                const layer = shape.getLayer();
                if (layer) { layer.add(clone); newShapes.push(clone); }
            }
        });
        
        if (newShapes.length > 0) {
            this.canvas.deselectAll();
            newShapes.forEach((shape, i) => {
                this.canvas.selectObject(shape, i > 0);
                this.selectionTool?.attachShapeEvents?.(shape);
            });
            this.canvas.stage.batchDraw();
            this.updateObjectCount();
            this.showToast(`📋 ${newShapes.length}개 복제됨 (+${offset}px)`, 'success');
        }
    }
    
    // =====================================================
    // ✅ Phase 3: Equipment Array 모달
    // =====================================================
    showEquipmentArrayModal() { document.getElementById('eq-array-modal').classList.add('active'); }
    closeEquipmentArrayModal() { document.getElementById('eq-array-modal').classList.remove('active'); }
    
    applyEquipmentArray() {
        const rows = parseInt(document.getElementById('eq-array-rows').value) || 6;
        const cols = parseInt(document.getElementById('eq-array-cols').value) || 26;
        const width = parseFloat(document.getElementById('eq-array-width').value) || 1.5;
        const depth = parseFloat(document.getElementById('eq-array-depth').value) || 3.0;
        const spacing = parseFloat(document.getElementById('eq-array-spacing').value) || 0.3;
        
        const corridorColsStr = document.getElementById('eq-array-corridor-cols').value || '13';
        const corridorCols = corridorColsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const corridorColWidth = parseFloat(document.getElementById('eq-array-corridor-col-width').value) || 3.0;
        
        const corridorRowsStr = document.getElementById('eq-array-corridor-rows').value || '3';
        const corridorRows = corridorRowsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const corridorRowWidth = parseFloat(document.getElementById('eq-array-corridor-row-width').value) || 2.0;
        
        const config = {
            rows, cols, equipmentSize: { width, depth }, spacing,
            corridorCols, corridorColWidth, corridorRows, corridorRowWidth,
            excludedPositions: []
        };
        
        console.log('[Phase 3] Equipment Array Config:', config);
        
        if (this.equipmentArrayTool) {
            this.closeEquipmentArrayModal();
            this.equipmentArrayTool.activate(config);
            this.showToast(`클릭하여 ${rows}×${cols} 배열 시작점 지정`, 'info');
        } else {
            this.showToast('EquipmentArrayTool 로드 안됨', 'error');
        }
    }
    
    // =====================================================
    // ✅ Phase 3: 그룹화 기능
    // =====================================================
    groupSelected() {
        if (!this.groupingTool) { this.showToast('GroupingTool 로드 안됨', 'error'); return; }
        const group = this.groupingTool.groupSelected();
        if (group) {
            this.showToast(`📦 ${group.getChildren().length}개 객체 그룹화됨`, 'success');
            this.updateStatus();
        } else {
            this.showToast('2개 이상 선택 필요', 'info');
        }
    }
    
    ungroupSelected() {
        if (!this.groupingTool) { this.showToast('GroupingTool 로드 안됨', 'error'); return; }
        const objects = this.groupingTool.ungroupSelected();
        if (objects && objects.length > 0) {
            this.showToast(`📤 ${objects.length}개 객체 그룹 해제됨`, 'success');
            this.updateStatus();
        } else {
            this.showToast('그룹을 선택하세요', 'info');
        }
    }
    
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
        this.canvas.loadLayout({ room: { width: 30, height: 20, walls: [], offices: [] }, equipment: [
            { id: 'eq_1', x: 2, y: 5, width: 2, depth: 1.5, name: 'Equipment 1', rotation: 0 },
            { id: 'eq_2', x: 5, y: 5, width: 2, depth: 1.5, name: 'Equipment 2', rotation: 0 },
            { id: 'eq_3', x: 8, y: 5, width: 2, depth: 1.5, name: 'Equipment 3', rotation: 0 }
        ]});
        this.selectionTool?.attachEventListeners?.();
        this.updateObjectCount();
        this.showToast('샘플 로드 완료!', 'success');
    }
    
    toggleAlignPopup() {
        this.alignPopupVisible = !this.alignPopupVisible;
        const popup = document.getElementById('align-popup');
        const btn = document.getElementById('align-btn');
        if (this.alignPopupVisible) {
            const btnRect = btn.getBoundingClientRect();
            popup.style.top = `${btnRect.top}px`;
            popup.style.left = `${btnRect.right + 5}px`;
            if (this.componentSubmenuVisible) this.toggleComponentSubmenu();
        }
        popup.classList.toggle('show', this.alignPopupVisible);
        btn.classList.toggle('active', this.alignPopupVisible);
    }
    hideAlignPopup() { if (this.alignPopupVisible) { this.alignPopupVisible = false; document.getElementById('align-popup').classList.remove('show'); document.getElementById('align-btn').classList.remove('active'); } }
    
    alignLeft() { this.alignmentTool?.alignLeft(); this.hideAlignPopup(); }
    alignRight() { this.alignmentTool?.alignRight(); this.hideAlignPopup(); }
    alignTop() { this.alignmentTool?.alignTop(); this.hideAlignPopup(); }
    alignBottom() { this.alignmentTool?.alignBottom(); this.hideAlignPopup(); }
    alignCenterH() { this.alignmentTool?.alignCenterHorizontal(); this.hideAlignPopup(); }
    alignCenterV() { this.alignmentTool?.alignCenterVertical(); this.hideAlignPopup(); }
    distributeH() { this.alignmentTool?.distributeHorizontal(); this.hideAlignPopup(); }
    distributeV() { this.alignmentTool?.distributeVertical(); this.hideAlignPopup(); }
    rotateCW() { if (!this.alignmentTool) { this.showToast('AlignmentTool 오류', 'error'); return; } this.alignmentTool.rotateCW(); }
    rotateCCW() { if (!this.alignmentTool) { this.showToast('AlignmentTool 오류', 'error'); return; } this.alignmentTool.rotateCCW(); }
    resetRotation() { this.alignmentTool?.resetRotation(); this.hideAlignPopup(); }
    toggleShortcutsHelp() { this.shortcutsHelpVisible = !this.shortcutsHelpVisible; document.getElementById('shortcuts-help').classList.toggle('show', this.shortcutsHelpVisible); }
    showToast(message, type = 'info') { const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => { toast.style.animation = 'slideIn 0.3s reverse'; setTimeout(() => toast.remove(), 300); }, 2000); }
}

console.log('✅ LayoutEditorApp.js 로드 완료 (외부 모듈 활용 버전)');