/**
 * ObjectSelectionTool.js v4.0.2 (3.2.9 기반)
 * ====================================================
 * 
 * ✨ v4.0.2 신규 기능:
 * - ✅ 동적 좌표 표시 (Zoom 레벨 고려)
 * - ✅ ZoomController 통합
 * 
 * 📝 v3.2.9 기능 유지:
 * - ✅ macOS Escape 키 작동 (tabindex)
 * - ✅ Wall hover 시 점선 문제 해결
 * - ✅ Box Selection (Shift + Drag)
 * - ✅ Multi-select (Ctrl + Click)
 * - ✅ 모든 기존 기능 100% 호환
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/tools/ObjectSelectionTool.js
 */

class ObjectSelectionTool {
    constructor(canvas2DEditor) {
        this.editor = canvas2DEditor;
        this.isActive = false;
        
        // 키 상태
        this.ctrlKeyPressed = false;
        this.shiftKeyPressed = false;

        // 드래그 박스 선택
        this.selectionBox = null;
        this.selectionCountLabel = null;
        this.selectionStartX = 0;
        this.selectionStartY = 0;
        this.isSelecting = false;
        this.justFinishedBoxSelect = false;  // ✅ 박스 선택 방금 완료 플래그

        // CSS 색상 참조 (안전 처리)
        this.cssColors = this.editor.cssColors || this.getDefaultColors();

        // 이벤트 핸들러 바인딩
        this.handleKeyDown = this.onKeyDown.bind(this);
        this.handleKeyUp = this.onKeyUp.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseUp = this.onMouseUp.bind(this);
    }

    /**
     * CSS 색상 로드 실패 시 기본값
     */
    getDefaultColors() {
        return {
            selectionStroke: '#667eea',
            selectionFill: 'rgba(102, 126, 234, 0.1)',
            coordBg: '#667eea',
            coordText: '#ffffff'
        };
    }

    /**
     * ✨ v4.0.2: Zoom/Pan을 고려한 마우스 좌표 변환
     * Stage의 scale과 position을 고려하여 실제 Canvas 좌표로 변환
     * @returns {Object} { x, y } - 변환된 좌표
     */
    getTransformedPointerPosition() {
        const stage = this.editor.stage;
        const pointer = stage.getPointerPosition();
        
        if (!pointer) {
            return { x: 0, y: 0 };
        }

        // Stage의 transform 정보
        const transform = stage.getAbsoluteTransform().copy();
        
        // Transform 역변환
        transform.invert();
        
        // 마우스 좌표를 Stage 좌표로 변환
        const transformedPoint = transform.point(pointer);
        
        return transformedPoint;
    }

    activate() {
        if (this.isActive) return;

        this.isActive = true;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        console.log('⌨️ 키보드 이벤트 리스너 등록 완료 (window.addEventListener)');

        this.editor.stage.on('mousedown touchstart', this.handleMouseDown);
        this.editor.stage.on('mousemove touchmove', this.handleMouseMove);
        this.editor.stage.on('mouseup touchend', this.handleMouseUp);

        // ✅ stage의 기본 click 이벤트 오버라이드
        this.originalStageClickHandler = this.handleStageClick.bind(this);
        this.editor.stage.off('click tap');  // 기존 핸들러 제거
        this.editor.stage.on('click tap', this.originalStageClickHandler);

        this.attachEventListeners();

        console.log('✅ ObjectSelectionTool activated (Shift+Drag mode)');
    }

    deactivate() {
        if (!this.isActive) return;

        this.isActive = false;

        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);

        this.editor.stage.off('mousedown touchstart', this.handleMouseDown);
        this.editor.stage.off('mousemove touchmove', this.handleMouseMove);
        this.editor.stage.off('mouseup touchend', this.handleMouseUp);

        this.detachEventListeners();
        this.editor.deselectAll();

        console.log('✅ ObjectSelectionTool deactivated');
    }

    attachEventListeners() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔗 attachEventListeners 호출됨!');
        
        const layers = [
            this.editor.layers.equipment,
            this.editor.layers.room
        ];

        let totalShapes = 0;
        let draggableCount = 0;
        let wallCount = 0;
        let equipmentCount = 0;
        let officeCount = 0;

        layers.forEach((layer, layerIndex) => {
            if (!layer) {
                console.warn(`  ├─ Layer ${layerIndex}: undefined`);
                return;
            }
            
            console.log(`  ├─ Layer ${layerIndex}: ${layer.name() || 'unnamed'}`);
            
            const shapes = layer.find('.equipment, .wall, .office, .partition');
            console.log(`  │   └─ 찾은 shapes: ${shapes.length}개`);
            
            shapes.forEach((shape, shapeIndex) => {
                totalShapes++;
                
                const shapeName = shape.name();
                const shapeId = shape.id();
                const shapeClass = shape.className;
                const isDraggable = shape.draggable();
                
                if (shapeName === 'wall') wallCount++;
                if (shapeName === 'equipment') equipmentCount++;
                if (shapeName === 'office') officeCount++;
                
                // Wall에 대해서만 상세 로그
                if (shapeName === 'wall') {
                    console.log(`  │   ├─ [${shapeIndex + 1}] Wall 발견!`);
                    console.log(`  │   │   ├─ id: ${shapeId}`);
                    console.log(`  │   │   ├─ name: ${shapeName}`);
                    console.log(`  │   │   ├─ className: ${shapeClass}`);
                    console.log(`  │   │   └─ draggable: ${isDraggable}`);
                }
                
                if (isDraggable) {
                    draggableCount++;
                    if (shapeName === 'wall') {
                        console.log(`  │   │   └─ ✅ 이벤트 연결됨!`);
                    }
                    this.attachShapeEvents(shape);
                } else {
                    if (shapeName === 'wall') {
                        console.log(`  │   │   └─ ❌ draggable=false, 이벤트 연결 안됨!`);
                    }
                }
            });
        });
        
        console.log('  └─ 이벤트 연결 완료!');
        console.log(`      ├─ 총 shapes: ${totalShapes}개`);
        console.log(`      ├─ draggable shapes: ${draggableCount}개`);
        console.log(`      ├─ Equipment: ${equipmentCount}개`);
        console.log(`      ├─ Wall: ${wallCount}개`);
        console.log(`      └─ Office: ${officeCount}개`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    detachEventListeners() {
        const layers = [
            this.editor.layers.equipment,
            this.editor.layers.room
        ];

        layers.forEach(layer => {
            if (!layer) return;
            
            const shapes = layer.find('.equipment, .wall, .office, .partition');
            shapes.forEach(shape => {
                this.detachShapeEvents(shape);
            });
        });
    }

    attachShapeEvents(shape) {
        shape.on('click tap', (e) => {
            e.cancelBubble = true;
            this.onShapeClick(shape);
        });

        shape.on('dragstart', (e) => {
            this.onDragStart(shape);
        });

        shape.on('dragmove', (e) => {
            this.onDragMove(shape);
        });

        shape.on('dragend', (e) => {
            this.onDragEnd(shape);
        });

        // ✅ 호버 효과 (Line 객체 제외)
        shape.on('mouseenter', () => {
            this.editor.stage.container().style.cursor = 'move';
            
            // ✅ Line 객체(wall, partition)는 hover 효과 건너뜀
            if (shape.className === 'Line') {
                console.log('🖱️ mouseenter on Line (no hover effect):', shape.id());
                return;
            }
            
            if (!this.editor.selectedObjects.includes(shape)) {
                // Group인 경우만 findOne() 호출
                const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
                
                if (rect.strokeWidth) {
                    // 원래 strokeWidth 저장
                    if (!rect.getAttr('hoverOriginalStrokeWidth')) {
                        rect.setAttr('hoverOriginalStrokeWidth', rect.strokeWidth());
                    }
                    rect.strokeWidth(3);
                    shape.getLayer().batchDraw();
                    console.log('🖱️ mouseenter hover:', shape.id(), 'strokeWidth 3');
                }
            }
        });

        shape.on('mouseleave', () => {
            this.editor.stage.container().style.cursor = 'default';
            
            // ✅ Line 객체(wall, partition)는 hover 효과 건너뜀
            if (shape.className === 'Line') {
                console.log('🖱️ mouseleave on Line (no hover effect):', shape.id());
                return;
            }
            
            if (!this.editor.selectedObjects.includes(shape)) {
                // Group인 경우만 findOne() 호출
                const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
                
                if (rect.strokeWidth) {
                    // 저장된 원래 strokeWidth 복원
                    const originalWidth = rect.getAttr('hoverOriginalStrokeWidth') || 1;
                    rect.strokeWidth(originalWidth);
                    shape.getLayer().batchDraw();
                    console.log('🖱️ mouseleave restore:', shape.id(), 'strokeWidth', originalWidth);
                }
            }
        });
    }

    detachShapeEvents(shape) {
        shape.off('click tap');
        shape.off('dragstart');
        shape.off('dragmove');
        shape.off('dragend');
        shape.off('mouseenter');
        shape.off('mouseleave');
    }

    /**
     * ✅ stage click 이벤트 핸들러 (박스 선택과 충돌 방지)
     */
    handleStageClick(e) {
        // ✅ 박스 선택 중이면 무시
        if (this.editor._isBoxSelecting) {
            console.log('🚫 박스 선택 중 - handleStageClick 무시');
            return;
        }
        
        // 박스 선택이 방금 끝났으면 무시
        if (this.justFinishedBoxSelect) {
            console.log('🚫 박스 선택 직후 - stage click 무시');
            return;
        }

        // 빈 공간 클릭 시 선택 해제
        if (e.target === this.editor.stage) {
            this.editor.deselectAll();
        }
    }

    onShapeClick(shape) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🖱️ onShapeClick 호출됨!');
        console.log('  ├─ shape.id():', shape.id());
        console.log('  ├─ shape.name():', shape.name());
        console.log('  ├─ shape.className:', shape.className);
        console.log('  └─ ctrlKeyPressed:', this.ctrlKeyPressed);
        
        const multiSelect = this.ctrlKeyPressed;

        if (multiSelect) {
            console.log('  ├─ multiSelect 모드 (Ctrl 눌림)');
            if (this.editor.selectedObjects.includes(shape)) {
                console.log('  └─ 이미 선택됨 → deselectObject 호출');
                this.editor.deselectObject(shape);
            } else {
                console.log('  └─ 선택 안됨 → selectObject(multiSelect=true) 호출');
                this.editor.selectObject(shape, true);
            }
        } else {
            console.log('  └─ 단일 선택 모드 → selectObject(multiSelect=false) 호출');
            this.editor.selectObject(shape, false);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    onDragStart(shape) {
        if (!this.editor.selectedObjects.includes(shape)) {
            this.editor.selectObject(shape, false);
        }

        this.dragStartPositions = this.editor.selectedObjects.map(obj => ({
            shape: obj,
            startX: obj.x(),
            startY: obj.y()
        }));

        console.log('Drag start:', shape.id());
    }

    onDragMove(shape) {
        const draggedShape = this.dragStartPositions.find(pos => pos.shape === shape);
        if (!draggedShape) return;

        const deltaX = shape.x() - draggedShape.startX;
        const deltaY = shape.y() - draggedShape.startY;

        this.editor.selectedObjects.forEach(obj => {
            if (obj !== shape) {
                const objStart = this.dragStartPositions.find(pos => pos.shape === obj);
                if (objStart) {
                    obj.x(objStart.startX + deltaX);
                    obj.y(objStart.startY + deltaY);
                }
            }
        });

        if (this.editor.transformer) {
            this.editor.transformer.forceUpdate();
        }

        this.showCoordinates(shape);
    }

    onDragEnd(shape) {
        if (this.editor.config.snapToGrid) {
            this.editor.selectedObjects.forEach(obj => {
                this.editor.snapToGrid(obj);
            });

            if (this.editor.transformer) {
                this.editor.transformer.forceUpdate();
            }
        }

        this.savePositions();

        console.log('Drag end:', shape.id(), 'Position:', {
            x: Math.round(shape.x() / this.editor.config.scale * 10) / 10,
            y: Math.round(shape.y() / this.editor.config.scale * 10) / 10
        });

        this.hideCoordinates();
    }

    // =======================================
    // Shift+드래그 박스 선택
    // =======================================

    onMouseDown(e) {
        if (e.evt.button !== 0) return;
        
        const clickedOnEmpty = e.target === this.editor.stage;
        
        // Shift 키를 눌렀을 때만 박스 선택 시작
        if (clickedOnEmpty && this.shiftKeyPressed) {
            // ✅ Canvas2DEditor에게 박스 선택 중임을 알림
            this.editor._isBoxSelecting = true;
            
            this.isSelecting = true;
            
            // ✨ v4.0.2: Zoom/Pan 고려한 좌표 변환
            const pos = this.getTransformedPointerPosition();
            
            this.selectionStartX = pos.x;
            this.selectionStartY = pos.y;

            // 드래그 박스 생성
            this.selectionBox = new Konva.Rect({
                x: this.selectionStartX,
                y: this.selectionStartY,
                width: 0,
                height: 0,
                stroke: this.cssColors.selectionStroke,
                strokeWidth: 3,
                dash: [8, 4],
                fill: this.cssColors.selectionFill,
                listening: false
            });

            this.editor.layers.ui.add(this.selectionBox);
            
            // 선택 개수 라벨 생성
            this.selectionCountLabel = new Konva.Text({
                x: this.selectionStartX + 5,
                y: this.selectionStartY + 5,
                text: '0개 선택됨',
                fontSize: 14,
                fontFamily: 'Arial',
                fill: this.cssColors.selectionStroke,
                fontStyle: 'bold',
                listening: false
            });

            this.editor.layers.ui.add(this.selectionCountLabel);
            this.editor.layers.ui.batchDraw();
            
            console.log('✅ Shift+Drag 박스 선택 시작 (플래그 설정)');
        }
    }

    onMouseMove(e) {
        if (!this.isSelecting) return;

        // ✨ v4.0.2: Zoom/Pan 고려한 좌표 변환
        const pos = this.getTransformedPointerPosition();
        
        const width = pos.x - this.selectionStartX;
        const height = pos.y - this.selectionStartY;

        this.selectionBox.width(Math.abs(width));
        this.selectionBox.height(Math.abs(height));
        this.selectionBox.x(width < 0 ? pos.x : this.selectionStartX);
        this.selectionBox.y(height < 0 ? pos.y : this.selectionStartY);

        // 실시간 선택 개수 업데이트
        const box = this.selectionBox.getClientRect();
        const count = this.countIntersectingShapes(box);
        
        if (this.selectionCountLabel) {
            this.selectionCountLabel.text(`${count}개 선택됨`);
            this.selectionCountLabel.x(this.selectionBox.x() + 5);
            this.selectionCountLabel.y(this.selectionBox.y() + 5);
        }

        this.editor.layers.ui.batchDraw();
    }

    /**
     * 박스 내 객체 개수 계산
     */
    countIntersectingShapes(box) {
        let count = 0;
        const shapes = this.editor.layers.equipment.getChildren();
        
        shapes.forEach(shape => {
            if (shape.name() === 'equipment') {
                const shapeBox = shape.getClientRect();
                if (this.haveIntersection(box, shapeBox)) {
                    count++;
                }
            }
        });
        
        return count;
    }

    onMouseUp(e) {
        if (!this.isSelecting) return;

        this.isSelecting = false;

        const box = this.selectionBox.getClientRect();
        
        // Ctrl 키 누르지 않으면 기존 선택 해제
        if (!this.ctrlKeyPressed) {
            this.editor.deselectAll();
            console.log('Deselected all (new selection)');
        } else {
            console.log('✅ Ctrl+Shift+Drag: 기존 선택 유지');
        }

        // 박스 내 객체 선택
        const shapes = this.editor.layers.equipment.getChildren();
        let selectedCount = 0;
        
        shapes.forEach(shape => {
            if (shape.name() === 'equipment') {
                const shapeBox = shape.getClientRect();
                if (this.haveIntersection(box, shapeBox)) {
                    this.editor.selectObject(shape, true);
                    selectedCount++;
                }
            }
        });

        // 정리
        if (this.selectionBox) {
            this.selectionBox.destroy();
            this.selectionBox = null;
        }
        
        if (this.selectionCountLabel) {
            this.selectionCountLabel.destroy();
            this.selectionCountLabel = null;
        }
        
        this.editor.layers.ui.batchDraw();
        
        const totalSelected = this.editor.selectedObjects.length;
        console.log(`✅ Shift+Drag 완료: ${selectedCount}개 추가 (총 ${totalSelected}개 선택)`);

        // ✅ 박스 선택 방금 완료 플래그 설정
        this.justFinishedBoxSelect = true;
        
        // ✅ Canvas2DEditor 플래그 해제 (약간의 지연)
        setTimeout(() => {
            this.editor._isBoxSelecting = false;
            this.justFinishedBoxSelect = false;
            console.log('🔓 박스 선택 플래그 해제');
        }, 100);
    }

    haveIntersection(r1, r2) {
        return !(
            r2.x > r1.x + r1.width ||
            r2.x + r2.width < r1.x ||
            r2.y > r1.y + r1.height ||
            r2.y + r2.height < r1.y
        );
    }

    // =======================================
    // 키보드 이벤트 (✅ 버그 수정)
    // =======================================

    onKeyDown(e) {
        // ✅ 모든 키 입력 로그
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎹 onKeyDown 호출됨!');
        console.log('  ├─ e.key:', e.key);
        console.log('  ├─ e.code:', e.code);
        console.log('  ├─ e.keyCode:', e.keyCode);
        console.log('  └─ selectedObjects.length:', this.editor.selectedObjects.length);
        
        // Shift 키 감지
        if (e.key === 'Shift') {
            this.shiftKeyPressed = true;
            this.editor.stage.container().style.cursor = 'crosshair';
            console.log('🔑 Shift 키 눌림');
        }
        
        // Ctrl 키 감지 (Mac은 Meta 키)
        if (e.key === 'Control' || e.key === 'Meta') {
            this.ctrlKeyPressed = true;
            console.log('🔑 Ctrl 키 눌림');
        }

        // ✅ Delete 또는 Backspace 키 (노트북 호환)
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.editor.selectedObjects.length > 0) {
            console.log('🗑️ Delete/Backspace 키 감지, 객체 개수:', this.editor.selectedObjects.length);
            e.preventDefault();
            if (confirm(`${this.editor.selectedObjects.length}개의 객체를 삭제하시겠습니까?`)) {
                this.editor.deleteSelected();
            }
        }

        // ✅ Escape 키 - 상세 디버깅
        console.log('🔍 Escape 키 체크 시작...');
        console.log('  ├─ e.key === "Escape"?', e.key === 'Escape');
        console.log('  ├─ e.key 정확한 값:', JSON.stringify(e.key));
        console.log('  └─ e.key.length:', e.key.length);
        
        if (e.key === 'Escape') {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⚠️ Escape 키 감지됨! deselectAll 호출 시작...');
            console.log('  └─ 현재 선택된 객체 수:', this.editor.selectedObjects.length);
            
            try {
                this.editor.deselectAll();
                console.log('✅ deselectAll 호출 완료!');
            } catch (error) {
                console.error('❌ deselectAll 호출 중 에러:', error);
            }
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
            console.log('⚠️ Escape 키가 아님!');
        }

        // Ctrl+A
        if (this.ctrlKeyPressed && e.key === 'a') {
            console.log('📋 Ctrl+A 감지');
            e.preventDefault();
            this.selectAll();
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    /**
     * ✅ Ctrl/Shift 키 해제 로직 수정
     */
    onKeyUp(e) {
        // Shift 키 해제
        if (e.key === 'Shift') {
            this.shiftKeyPressed = false;
            this.editor.stage.container().style.cursor = 'default';
            console.log('🔓 Shift 키 해제');
        }
        
        // ✅ Ctrl/Meta 키만 정확히 해제
        if (e.key === 'Control' || e.key === 'Meta') {
            this.ctrlKeyPressed = false;
            console.log('🔓 Ctrl 키 해제');
        }
    }

    selectAll() {
        this.editor.deselectAll();

        const layers = [
            this.editor.layers.equipment,
            this.editor.layers.room
        ];

        layers.forEach(layer => {
            if (!layer) return;
            
            const shapes = layer.find('.equipment, .wall, .office, .partition');
            shapes.forEach(shape => {
                if (shape.draggable()) {
                    this.editor.selectObject(shape, true);
                }
            });
        });

        console.log('Selected all objects:', this.editor.selectedObjects.length);
    }

    /**
     * 좌표 표시 (타입 안전 처리)
     */
    /**
     * ✨ v4.0.2: 동적 좌표 표시 (Zoom 레벨 고려)
     * @param {Konva.Shape} shape - 좌표를 표시할 Shape
     */
    showCoordinates(shape) {
        this.hideCoordinates();

        // ✨ v4.0.2: ZoomController가 있으면 동적 scale 사용
        let scale = this.editor.config.scale;
        if (this.editor.zoomController && typeof this.editor.zoomController.getCurrentScale === 'function') {
            scale = this.editor.zoomController.getCurrentScale();
        }

        const x = Math.round(shape.x() / scale * 10) / 10;
        const y = Math.round(shape.y() / scale * 10) / 10;

        // width() 메서드가 있는 경우에만 사용
        const shapeWidth = shape.width ? shape.width() : 0;
        const shapeHeight = shape.height ? shape.height() : 0;

        this.coordLabel = new Konva.Label({
            x: shape.x() + shapeWidth / 2,
            y: shape.y() - 30,
            listening: false
        });

        this.coordLabel.add(new Konva.Tag({
            fill: this.cssColors.coordBg,
            cornerRadius: 5,
            shadowColor: 'black',
            shadowBlur: 5,
            shadowOffset: { x: 2, y: 2 },
            shadowOpacity: 0.3
        }));

        this.coordLabel.add(new Konva.Text({
            text: `${x}m, ${y}m`,
            fontSize: 12,
            padding: 5,
            fill: this.cssColors.coordText
        }));

        this.editor.layers.ui.add(this.coordLabel);
        this.editor.layers.ui.batchDraw();
    }

    hideCoordinates() {
        if (this.coordLabel) {
            this.coordLabel.destroy();
            this.coordLabel = null;
            this.editor.layers.ui.batchDraw();
        }
    }

    savePositions() {
        const positions = this.editor.selectedObjects.map(obj => ({
            id: obj.id(),
            x: obj.x(),
            y: obj.y(),
            width: obj.width ? obj.width() : 0,
            height: obj.height ? obj.height() : 0
        }));

        console.log('Positions saved:', positions);
    }

    destroy() {
        this.deactivate();
        console.log('✅ ObjectSelectionTool destroyed');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ObjectSelectionTool;
}