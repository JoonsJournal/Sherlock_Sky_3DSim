/**
 * ComponentService.js v1.0.1
 * ==========================
 * 
 * ✨ v1.0.1 수정:
 * - ✅ deleteSelected()에서 StateManager/deselectAll() 호출 추가
 * - ✅ 삭제 후 HandleManager 정리 보장
 * 
 * 컴포넌트 생성, 드래그, 드롭 처리 서비스
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/services/ComponentService.js
 */

class ComponentService {
    constructor(canvas, commandManager, options = {}) {
        this.canvas = canvas;
        this.commandManager = commandManager;
        this.selectionTool = options.selectionTool;
        this.onComponentCreated = options.onComponentCreated || (() => {});
        this.onStatusUpdate = options.onStatusUpdate || (() => {});
        
        // Config에서 COMPONENTS 가져오기
        this.COMPONENTS = window.LayoutEditorConfig?.COMPONENTS || {
            partition: { id: 'partition', name: 'Partition', width: 3.0, depth: 2.5, color: '#888888', layer: 'room' },
            desk: { id: 'desk', name: 'Desk', width: 1.6, depth: 0.8, color: '#8B4513', layer: 'room' },
            pillar: { id: 'pillar', name: 'Pillar', width: 0.3, depth: 0.3, color: '#333333', layer: 'room' },
            office: { id: 'office', name: 'Office', width: 12.0, depth: 20.0, color: '#87CEEB', layer: 'room' },
            equipment: { id: 'equipment', name: 'Equipment', width: 1.5, depth: 3.0, color: '#FF8C00', layer: 'equipment' }
        };
        
        console.log('✅ ComponentService 초기화 완료 v1.0.1');
    }
    
    /**
     * Drop Zone 활성화
     */
    enableDropZone(dropGuideId = 'drop-guide') {
        const container = this.canvas.stage.container();
        const dropGuide = document.getElementById(dropGuideId);
        
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
    
    /**
     * 드롭 이벤트 처리
     */
    handleDrop(event) {
        const componentType = event.dataTransfer.getData('text/plain');
        const component = this.COMPONENTS[componentType];
        if (!component) return null;
        
        const stage = this.canvas.stage;
        const rect = stage.container().getBoundingClientRect();
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point({ 
            x: event.clientX - rect.left, 
            y: event.clientY - rect.top 
        });
        
        const shape = this.createComponent(component, pos.x, pos.y);
        if (shape) { 
            this.canvas.selectObject(shape, false); 
            this.selectionTool?.attachShapeEvents?.(shape); 
            this.onComponentCreated(component, shape);
        }
        
        return shape;
    }
    
    /**
     * 컴포넌트 생성
     */
    createComponent(component, x, y) {
        const scale = this.canvas.config.scale || 10;
        const width = component.width * scale;
        const height = component.depth * scale;
        
        // Grid Snap
        if (this.canvas.config.snapToGrid) { 
            const gridSize = this.canvas.config.gridSize; 
            x = Math.round(x / gridSize) * gridSize; 
            y = Math.round(y / gridSize) * gridSize; 
        }
        
        // 고유 ID 생성
        const id = `${component.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Konva Group 생성
        const group = new Konva.Group({ 
            id, 
            x, 
            y, 
            draggable: true, 
            name: component.id + ' component' 
        });
        
        // 사각형 (본체)
        const rect = new Konva.Rect({ 
            x: -width / 2, 
            y: -height / 2, 
            width, 
            height, 
            fill: component.color, 
            stroke: '#333', 
            strokeWidth: 2, 
            name: 'componentRect' 
        });
        
        // 방향 화살표
        const arrowLength = Math.min(width, height) * 0.5;
        const arrow = new Konva.Arrow({ 
            points: [0, height / 2 - 4, 0, height / 2 - 4 - arrowLength], 
            pointerLength: 6, 
            pointerWidth: 6, 
            fill: '#ff4444', 
            stroke: '#ff4444', 
            strokeWidth: 2, 
            name: 'directionArrow' 
        });
        
        // 방향 라벨
        const dirLabel = new Konva.Text({ 
            x: -12, 
            y: height / 2 - arrowLength - 18, 
            text: 'Front', 
            fontSize: 9, 
            fill: '#ff4444', 
            fontStyle: 'bold', 
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
        
        // 레이어에 추가
        const layerName = component.layer || 'equipment';
        const layer = this.canvas.layers[layerName] || this.canvas.layers.equipment;
        
        if (this.commandManager && typeof CreateCommand !== 'undefined') {
            const createCmd = new CreateCommand(group, layer);
            this.commandManager.execute(createCmd);
        } else {
            layer.add(group); 
            layer.batchDraw();
        }
        
        this.canvas.componentShapes?.set(id, group);
        return group;
    }
    
    /**
     * 컴포넌트를 캔버스 중앙에 생성
     */
    createComponentAtCenter(componentType) {
        const component = this.COMPONENTS[componentType];
        if (!component) return null;
        
        const stage = this.canvas.stage;
        const centerX = (this.canvas.config.width / 2 - stage.x()) / stage.scaleX();
        const centerY = (this.canvas.config.height / 2 - stage.y()) / stage.scaleY();
        
        const shape = this.createComponent(component, centerX, centerY);
        if (shape) {
            this.canvas.selectObject(shape, false);
            this.selectionTool?.attachShapeEvents?.(shape);
            this.onComponentCreated(component, shape);
        }
        
        return shape;
    }
    
    /**
     * 드래그 이벤트 설정
     */
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
                    this.onStatusUpdate();
                }
            }
            delete group._dragStartPos;
        });
    }
    
    /**
     * 선택된 객체 복제
     */
    duplicateSelected(offset = 20) {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) return [];
        
        const newShapes = [];
        
        selected.forEach(shape => {
            const componentData = shape.getAttr('componentData');
            if (componentData) {
                const newShape = this.createComponent(
                    componentData, 
                    shape.x() + offset, 
                    shape.y() + offset
                );
                if (newShape) newShapes.push(newShape);
            }
        });
        
        if (newShapes.length > 0) {
            this.canvas.selectObjects(newShapes);
        }
        
        return newShapes;
    }
    
    /**
     * ✨ v1.0.1: 선택된 객체 삭제 (핸들 정리 추가)
     */
    deleteSelected() {
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) return 0;
        
        const count = selected.length;
        const shapesToDelete = [...selected];  // 복사본 생성
        
        console.log('[ComponentService] deleteSelected:', count, '개');
        
        // ✨ v1.0.1: 삭제 전 선택 해제 (핸들 정리!)
        // StateManager가 있으면 사용, 없으면 deselectAll 호출
        if (this.canvas.stateManager) {
            this.canvas.stateManager.prepareForDelete();
        } else {
            // HandleManager 직접 정리
            if (this.canvas.handleManager) {
                this.canvas.handleManager.detach();
            }
            // SelectionRenderer 정리
            if (this.canvas.selectionRenderer) {
                this.canvas.selectionRenderer.destroyTransformer?.();
            }
        }
        
        // 선택 배열 먼저 비우기
        if (this.canvas.selectionManager) {
            this.canvas.selectionManager.deselectAll?.(false);
        }
        this.canvas._selectedObjectsProxy = [];
        
        // DeleteCommand 실행
        if (this.commandManager && typeof DeleteCommand !== 'undefined') {
            const deleteCmd = new DeleteCommand(shapesToDelete);
            this.commandManager.execute(deleteCmd);
        } else {
            shapesToDelete.forEach(shape => shape.destroy());
            this.canvas.stage.batchDraw();
        }
        
        // ✨ v1.0.1: 삭제 후 정리
        if (this.canvas.stateManager) {
            this.canvas.stateManager.cleanupAfterDelete();
        }
        
        // UI 갱신
        this.canvas.layers?.ui?.batchDraw();
        this.onStatusUpdate();
        
        console.log('[ComponentService] ✅ 삭제 완료:', count, '개');
        return count;
    }
    
    /**
     * 컴포넌트 타입 가져오기
     */
    getComponent(type) {
        return this.COMPONENTS[type];
    }
    
    /**
     * 모든 컴포넌트 타입 가져오기
     */
    getAllComponents() {
        return { ...this.COMPONENTS };
    }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.ComponentService = ComponentService;
}

console.log('✅ ComponentService.js 로드 완료 v1.0.1');