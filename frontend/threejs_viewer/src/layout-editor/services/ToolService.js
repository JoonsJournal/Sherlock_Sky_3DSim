/**
 * ToolService.js
 * ===============
 * 도구 초기화 및 관리 서비스
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/services/ToolService.js
 */

class ToolService {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.state = options.state || window.layoutEditorState;
        this.onToolChanged = options.onToolChanged || (() => {});
        this.onToast = options.onToast || (() => {});
        
        // 도구 인스턴스
        this.tools = {
            selection: null,
            wall: null,
            alignment: null,
            grouping: null,
            equipmentArray: null,
            roomSize: null
        };
        
        // ZoomController
        this.zoomController = null;
        
        // PropertyPanel
        this.propertyPanel = null;
        
        console.log('✅ ToolService 초기화 완료');
    }
    
    /**
     * 모든 도구 초기화
     */
    initAllTools() {
        this.initZoomController();
        this.initSelectionTool();
        this.initWallTool();
        this.initAlignmentTool();
        this.initGroupingTool();
        this.initEquipmentArrayTool();
        this.initRoomSizeManager();
        this.initPropertyPanel();
        
        console.log('✅ 모든 도구 초기화 완료');
        return this.tools;
    }
    
    /**
     * ZoomController 초기화
     */
    initZoomController() {
        if (typeof InfiniteGridZoomController !== 'undefined') {
            const config = window.LayoutEditorConfig?.CANVAS_CONFIG || {};
            
            this.zoomController = new InfiniteGridZoomController(this.canvas, { 
                minZoom: config.minZoom || 0.1, 
                maxZoom: config.maxZoom || 5.0, 
                zoomStep: config.zoomStep || 0.1, 
                wheelSensitivity: config.wheelSensitivity || 0.001 
            });
            
            this.canvas.setZoomController(this.zoomController);
            this.zoomController.activate();
            this.zoomController.updateGrid();
            
            console.log('  ✓ InfiniteGridZoomController');
        } else {
            console.warn('  ⚠ InfiniteGridZoomController 미로드');
        }
        
        return this.zoomController;
    }
    
    /**
     * SelectionTool 초기화
     */
    initSelectionTool() {
        if (typeof ObjectSelectionTool !== 'undefined') {
            this.tools.selection = new ObjectSelectionTool(this.canvas);
            this.tools.selection.activate();
            console.log('  ✓ ObjectSelectionTool');
        }
        return this.tools.selection;
    }
    
    /**
     * WallDrawTool 초기화
     */
    initWallTool() {
        if (typeof WallDrawTool !== 'undefined') {
            this.tools.wall = new WallDrawTool(this.canvas);
            this.canvas.setWallDrawTool(this.tools.wall);
            console.log('  ✓ WallDrawTool');
        }
        return this.tools.wall;
    }
    
    /**
     * AlignmentTool 초기화
     */
    initAlignmentTool() {
        if (typeof AlignmentTool !== 'undefined') {
            this.tools.alignment = new AlignmentTool(this.canvas);
            console.log('  ✓ AlignmentTool');
        }
        return this.tools.alignment;
    }
    
    /**
     * GroupingTool 초기화
     */
    initGroupingTool() {
        if (typeof GroupingTool !== 'undefined') {
            this.tools.grouping = new GroupingTool(this.canvas);
            console.log('  ✓ GroupingTool');
        }
        return this.tools.grouping;
    }
    
    /**
     * EquipmentArrayTool 초기화
     */
    initEquipmentArrayTool() {
        if (typeof EquipmentArrayTool !== 'undefined') {
            this.tools.equipmentArray = new EquipmentArrayTool(this.canvas);
            this.canvas.equipmentArrayTool = this.tools.equipmentArray;
            console.log('  ✓ EquipmentArrayTool');
        }
        return this.tools.equipmentArray;
    }
    
    /**
     * RoomSizeManager 초기화
     */
    initRoomSizeManager() {
        if (typeof RoomSizeManager !== 'undefined') {
            this.tools.roomSize = new RoomSizeManager(this.canvas);
            console.log('  ✓ RoomSizeManager');
        }
        return this.tools.roomSize;
    }
    
    /**
     * PropertyPanel 초기화
     */
    initPropertyPanel(containerId = 'property-panel') {
        if (typeof PropertyPanel !== 'undefined') {
            this.propertyPanel = new PropertyPanel(containerId, this.canvas);
            this.canvas.setPropertyPanel(this.propertyPanel);
            console.log('  ✓ PropertyPanel');
        }
        return this.propertyPanel;
    }
    
    /**
     * 도구 활성화
     */
    activateTool(toolName) {
        const previousTool = this.state?.currentTool || 'select';
        
        // 이전 도구 비활성화
        if (previousTool === 'wall') {
            this.tools.wall?.deactivate();
        }
        
        // 새 도구 활성화
        if (toolName === 'wall') {
            this.tools.wall?.activate();
        }
        
        // State 업데이트
        if (this.state) {
            this.state.currentTool = toolName;
        }
        
        // UI 업데이트
        this.updateToolbarUI(toolName);
        
        // 콜백
        this.onToolChanged(toolName, previousTool);
        
        // Toast (벽 그리기 모드)
        if (toolName === 'wall') {
            this.onToast('벽 그리기 모드', 'info');
        }
        
        return toolName;
    }
    
    /**
     * 툴바 UI 업데이트
     */
    updateToolbarUI(toolName) {
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const toolBtn = document.getElementById(`tool-${toolName}`);
        toolBtn?.classList.add('active');
        
        const statusTool = document.getElementById('status-tool');
        if (statusTool) {
            statusTool.textContent = this.getToolDisplayName(toolName);
        }
    }
    
    /**
     * 도구 표시 이름 가져오기
     */
    getToolDisplayName(toolName) {
        const names = {
            'select': '선택',
            'wall': '벽 그리기',
            'room': '방 크기',
            'component': '컴포넌트'
        };
        return names[toolName] || toolName;
    }
    
    // =====================================================
    // 줌 관련 메서드
    // =====================================================
    
    zoomIn() {
        this.zoomController?.zoomIn();
        this.updateZoomDisplay();
    }
    
    zoomOut() {
        this.zoomController?.zoomOut();
        this.updateZoomDisplay();
    }
    
    resetZoom() {
        this.zoomController?.resetZoom();
        this.updateZoomDisplay();
    }
    
    updateZoomDisplay() {
        const zoom = this.canvas.stage?.scaleX() || 1;
        const statusZoom = document.getElementById('status-zoom');
        if (statusZoom) {
            statusZoom.textContent = Math.round(zoom * 100) + '%';
        }
        if (this.state) {
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
        
        if (this.state) {
            this.state.showGrid = isOn;
        }
        
        return isOn;
    }
    
    toggleSnap() {
        const isOn = this.canvas.toggleSnapToGrid();
        document.getElementById('status-snap').textContent = isOn ? 'ON' : 'OFF';
        
        if (this.state) {
            this.state.snapToGrid = isOn;
        }
        
        return isOn;
    }
    
    toggleMICESnap() {
        if (this.canvas.snapManager?.miceSnapPoints) {
            const miceSnap = this.canvas.snapManager.miceSnapPoints;
            const isEnabled = miceSnap.toggle ? miceSnap.toggle() : !miceSnap.isEnabled;
            if (!miceSnap.toggle) miceSnap.isEnabled = isEnabled;
            
            document.getElementById('status-mice-snap').textContent = isEnabled ? 'ON' : 'OFF';
            this.onToast(`🎪 MICE Snap: ${isEnabled ? 'ON' : 'OFF'}`, 'info');
            
            if (this.state) {
                this.state.miceSnapEnabled = isEnabled;
            }
            
            return isEnabled;
        } else {
            this.onToast('MICESnapPoints 모듈 로드 안됨', 'error');
            return null;
        }
    }
    
    toggleSmartGuides() {
        const sgm = this.canvas.smartGuideManager;
        if (sgm) {
            const isEnabled = sgm.isEnabled() ? (sgm.disable(), false) : (sgm.enable(), true);
            
            document.getElementById('status-smart-guides').textContent = isEnabled ? 'ON' : 'OFF';
            this.onToast(`📏 Smart Guides: ${isEnabled ? 'ON' : 'OFF'}`, 'info');
            
            if (this.state) {
                this.state.smartGuidesEnabled = isEnabled;
            }
            
            return isEnabled;
        } else {
            this.onToast('SmartGuideManager 로드 안됨', 'error');
            return null;
        }
    }
    
    // =====================================================
    // 정렬/회전
    // =====================================================
    
    alignLeft() { this.tools.alignment?.alignLeft(); }
    alignRight() { this.tools.alignment?.alignRight(); }
    alignTop() { this.tools.alignment?.alignTop(); }
    alignBottom() { this.tools.alignment?.alignBottom(); }
    alignCenterH() { this.tools.alignment?.alignCenterHorizontal(); }
    alignCenterV() { this.tools.alignment?.alignCenterVertical(); }
    distributeH() { this.tools.alignment?.distributeHorizontal(); }
    distributeV() { this.tools.alignment?.distributeVertical(); }
    
    rotateCW() {
        if (!this.tools.alignment) {
            this.onToast('AlignmentTool 오류', 'error');
            return;
        }
        this.tools.alignment.rotateCW();
    }
    
    rotateCCW() {
        if (!this.tools.alignment) {
            this.onToast('AlignmentTool 오류', 'error');
            return;
        }
        this.tools.alignment.rotateCCW();
    }
    
    resetRotation() {
        this.tools.alignment?.resetRotation();
    }
    
    // =====================================================
    // 그룹화
    // =====================================================
    
    groupSelected() {
        if (!this.tools.grouping) {
            this.onToast('GroupingTool 로드 안됨', 'error');
            return null;
        }
        
        const group = this.tools.grouping.groupSelected();
        if (group) {
            this.onToast(`📦 ${group.getChildren().length}개 객체 그룹화됨`, 'success');
            return group;
        } else {
            this.onToast('2개 이상 선택 필요', 'info');
            return null;
        }
    }
    
    ungroupSelected() {
        if (!this.tools.grouping) {
            this.onToast('GroupingTool 로드 안됨', 'error');
            return null;
        }
        
        const objects = this.tools.grouping.ungroupSelected();
        if (objects && objects.length > 0) {
            this.onToast(`📤 ${objects.length}개 객체 그룹 해제됨`, 'success');
            return objects;
        } else {
            this.onToast('그룹을 선택하세요', 'info');
            return null;
        }
    }
    
    // =====================================================
    // 레이어 순서
    // =====================================================
    
    bringForward() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) {
            this.onToast('선택된 객체 없음', 'info');
            return;
        }
        selected.forEach(shape => shape.moveUp());
        this.canvas.stage.batchDraw();
        this.onToast('↑ 앞으로', 'success');
    }
    
    sendBackward() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) {
            this.onToast('선택된 객체 없음', 'info');
            return;
        }
        selected.forEach(shape => shape.moveDown());
        this.canvas.stage.batchDraw();
        this.onToast('↓ 뒤로', 'success');
    }
    
    bringToFront() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) {
            this.onToast('선택된 객체 없음', 'info');
            return;
        }
        selected.forEach(shape => shape.moveToTop());
        this.canvas.stage.batchDraw();
        this.onToast('⬆️ 맨 앞으로', 'success');
    }
    
    sendToBack() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) {
            this.onToast('선택된 객체 없음', 'info');
            return;
        }
        selected.forEach(shape => shape.moveToBottom());
        this.canvas.stage.batchDraw();
        this.onToast('⬇️ 맨 뒤로', 'success');
    }
    
    // =====================================================
    // 도구 가져오기
    // =====================================================
    
    getTool(name) {
        return this.tools[name];
    }
    
    getZoomController() {
        return this.zoomController;
    }
    
    getPropertyPanel() {
        return this.propertyPanel;
    }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.ToolService = ToolService;
}

console.log('✅ ToolService.js 로드 완료');