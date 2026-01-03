/**
 * ObjectSelectionTool.js v5.1.0
 * ====================================================
 * 
 * ✨ v5.1.0 수정:
 * - ✅ dragmove에서 config.snapToGrid 체크 추가
 * - ✅ SmartGuide snap 적용 조건 수정
 * - ✅ dragend에서 이중 Snap 방지
 * 
 * ✨ v5.0.1 수정:
 * - ✅ dragend에서 동적 Grid 크기 사용 (Zoom 레벨 연동)
 * - ✅ SnapManager.gridSnap.getCurrentGridSize() 활용
 * 
 * ✨ v5.0.0 수정 (Phase 5.1 - Tool-Command 통합):
 * - ✅ CommandManager 연동으로 Undo/Redo 지원
 * - ✅ 드래그 시작 시 원래 위치 저장 (_dragStartPositions)
 * - ✅ 드래그 완료 시 MoveCommand 생성 및 실행
 * - ✅ 다중 선택 드래그도 Command 기록
 * - ✅ 삭제 시 DeleteCommand 사용
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/tools/ObjectSelectionTool.js
 */

class ObjectSelectionTool {
    constructor(canvas2DEditor) {
        this.editor = canvas2DEditor;
        this.isActive = false;
        
        // ✨ v5.0.0: CommandManager 참조
        this.commandManager = null;
        
        // 키 상태
        this.ctrlKeyPressed = false;
        this.shiftKeyPressed = false;

        // 드래그 박스 선택
        this.selectionBox = null;
        this.selectionCountLabel = null;
        this.selectionStartX = 0;
        this.selectionStartY = 0;
        this.isSelecting = false;
        this.justFinishedBoxSelect = false;

        // ✨ v5.0.0: 드래그 시작 위치 저장 (Undo용)
        this._dragStartPositions = new Map();
        this._isDragging = false;

        // CSS 색상 참조 (안전 처리)
        this.cssColors = this.editor.cssColors || this.getDefaultColors();

        // 이벤트 핸들러 바인딩
        this.handleKeyDown = this.onKeyDown.bind(this);
        this.handleKeyUp = this.onKeyUp.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseUp = this.onMouseUp.bind(this);
        
        console.log('[ObjectSelectionTool] 초기화 완료 v5.1.0 (Snap 수정)');
    }

    /**
     * ✨ v5.0.0: CommandManager 설정
     * @param {CommandManager} commandManager
     */
    setCommandManager(commandManager) {
        this.commandManager = commandManager;
        console.log('[ObjectSelectionTool] CommandManager 설정 완료');
    }

    /**
     * ✨ v5.0.0: CommandManager 가져오기 (여러 소스에서 시도)
     * @returns {CommandManager|null}
     */
    getCommandManager() {
        if (this.commandManager) {
            return this.commandManager;
        }
        if (this.editor && this.editor.commandManager) {
            return this.editor.commandManager;
        }
        if (typeof window !== 'undefined' && window.commandManager) {
            return window.commandManager;
        }
        return null;
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
     * Zoom/Pan을 고려한 마우스 좌표 변환
     * @returns {Object} { x, y } - 변환된 좌표
     */
    getTransformedPointerPosition() {
        const stage = this.editor.stage;
        const pointer = stage.getPointerPosition();
        
        if (!pointer) {
            return { x: 0, y: 0 };
        }

        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
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

        this.originalStageClickHandler = this.handleStageClick.bind(this);
        this.editor.stage.off('click tap');
        this.editor.stage.on('click tap', this.originalStageClickHandler);

        this.attachEventListeners();

        console.log('✅ ObjectSelectionTool activated v5.1.0');
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
        
        this._dragStartPositions.clear();
        this._isDragging = false;

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

        layers.forEach((layer, layerIndex) => {
            if (!layer) {
                console.warn(`  ├─ Layer ${layerIndex}: undefined`);
                return;
            }
            
            const shapes = layer.find('.equipment, .wall, .office, .partition');
            
            shapes.forEach((shape) => {
                totalShapes++;
                
                if (shape.draggable()) {
                    draggableCount++;
                    this.attachShapeEvents(shape);
                }
            });
        });
        
        console.log(`  └─ 이벤트 연결 완료: ${draggableCount}/${totalShapes}개`);
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
                shape.off('click');
                shape.off('mouseenter');
                shape.off('mouseleave');
                shape.off('dragstart');
                shape.off('dragmove');
                shape.off('dragend');
            });
        });

        console.log('✅ 이벤트 리스너 해제 완료');
    }

    attachShapeEvents(shape) {
        const shapeName = shape.name();

        // Click - 선택
        shape.on('click', (e) => {
            e.cancelBubble = true;

            if (this.ctrlKeyPressed) {
                const isSelected = this.editor.selectedObjects.includes(shape);
                if (isSelected) {
                    this.editor.deselectObject(shape);
                } else {
                    this.editor.selectObject(shape, true);
                }
            } else {
                this.editor.selectObject(shape, false);
            }
        });

        // Hover enter
        shape.on('mouseenter', () => {
            if (!this.editor.selectedObjects.includes(shape)) {
                if (shapeName === 'wall') {
                    shape.strokeWidth(6);
                    shape.stroke('#667eea');
                    shape.dash(null);
                } else {
                    const rect = shape.findOne('.componentRect');
                    if (rect) {
                        rect.stroke('#667eea');
                        rect.strokeWidth(3);
                    }
                }
                shape.getLayer().batchDraw();
            }
            document.body.style.cursor = 'move';
        });

        // Hover leave
        shape.on('mouseleave', () => {
            if (!this.editor.selectedObjects.includes(shape)) {
                if (shapeName === 'wall') {
                    shape.strokeWidth(shape.getAttr('originalStrokeWidth') || 4);
                    shape.stroke(shape.getAttr('originalStroke') || '#888888');
                    shape.dash(null);
                } else {
                    const rect = shape.findOne('.componentRect');
                    if (rect) {
                        rect.stroke('#333');
                        rect.strokeWidth(2);
                    }
                }
                shape.getLayer().batchDraw();
            }
            document.body.style.cursor = 'default';
        });

        // ✨ v5.0.0: Drag start - 원래 위치 저장
        shape.on('dragstart', (e) => {
            if (!this.editor.selectedObjects.includes(shape)) {
                this.editor.selectObject(shape, false);
            }
            
            this._isDragging = true;
            
            this._dragStartPositions.clear();
            this.editor.selectedObjects.forEach(obj => {
                this._dragStartPositions.set(obj.id() || obj._id, {
                    x: obj.x(),
                    y: obj.y()
                });
            });
            
            console.log('[ObjectSelectionTool] Drag start - 위치 저장:', 
                this._dragStartPositions.size, '개 객체');
            
            // SmartGuideManager 참조 객체 설정
            if (this.editor.smartGuideManager) {
                const allShapes = this.editor.getAllSelectableShapes ? 
                    this.editor.getAllSelectableShapes() : [];
                this.editor.smartGuideManager.setReferenceObjects(
                    allShapes, 
                    this.editor.selectedObjects
                );
            }
        });

        // ✨ v5.1.0: Drag move - SmartGuide Snap 조건부 적용
        shape.on('dragmove', () => {
            this.updateCoordinates(shape);
            
            // ✨ v5.1.0: SmartGuide 처리 (가이드라인 표시 + 조건부 Snap)
            if (this.editor.smartGuideManager) {
                const snapDelta = this.editor.smartGuideManager.updateGuides(shape);
                
                // ✨ v5.1.0: Snap 적용 조건
                // config.snapToGrid AND smartGuideManager.config.snapEnabled 둘 다 true일 때만
                const smartGuideSnapActive = this.editor.config.snapToGrid && 
                                            this.editor.smartGuideManager.config.snapEnabled;
                
                if (smartGuideSnapActive && (snapDelta.x !== 0 || snapDelta.y !== 0)) {
                    shape.x(shape.x() + snapDelta.x);
                    shape.y(shape.y() + snapDelta.y);
                }
            }
        });

        // ✨ v5.1.0: Drag end - Grid Snap (이중 Snap 방지)
        shape.on('dragend', () => {
            // SmartGuide 가이드라인 제거
            if (this.editor.smartGuideManager) {
                this.editor.smartGuideManager.clearGuides();
            }
            
            // ✨ v5.1.0: Grid Snap 적용 조건
            // SmartGuide Snap이 활성화되어 있으면 이미 적용됨 → Grid Snap 스킵
            // SmartGuide Snap이 비활성화면 → Grid Snap 적용
            const smartGuideSnapActive = this.editor.smartGuideManager?.config.snapEnabled && 
                                        this.editor.config.snapToGrid;
            
            // Grid Snap 적용 (smartGuideSnapActive가 false일 때만)
            if (this.editor.config.snapToGrid && !smartGuideSnapActive) {
                let gridSize = this.editor.config.gridSize;
                
                if (this.editor.snapManager?.gridSnap?.getCurrentGridSize) {
                    gridSize = this.editor.snapManager.gridSnap.getCurrentGridSize();
                } else if (this.editor.snapManager?.getCurrentGridSize) {
                    gridSize = this.editor.snapManager.getCurrentGridSize();
                }
                
                console.log(`[ObjectSelectionTool] Grid Snap 적용: ${gridSize}px`);
                
                this.editor.selectedObjects.forEach(obj => {
                    obj.x(Math.round(obj.x() / gridSize) * gridSize);
                    obj.y(Math.round(obj.y() / gridSize) * gridSize);
                });
            }
            
            // ✨ v5.0.0: Command 생성 및 실행
            this._createMoveCommand();
            
            // Transformer 업데이트
            if (this.editor.transformer) {
                this.editor.transformer.forceUpdate();
            }
            
            this.editor.stage.batchDraw();
            this.hideCoordinates();
            
            this._isDragging = false;
        });
    }

    /**
     * ✨ v5.0.0: 드래그 완료 후 MoveCommand 생성
     * @private
     */
    _createMoveCommand() {
        const cmdManager = this.getCommandManager();
        
        if (!cmdManager) {
            console.warn('[ObjectSelectionTool] CommandManager 없음 - Command 기록 생략');
            this._dragStartPositions.clear();
            return;
        }
        
        const MoveCommandClass = window.MoveCommand;
        
        if (!MoveCommandClass) {
            console.warn('[ObjectSelectionTool] MoveCommand 클래스 없음 - Command 기록 생략');
            this._dragStartPositions.clear();
            return;
        }
        
        const selectedObjects = this.editor.selectedObjects;
        
        if (selectedObjects.length === 0) {
            this._dragStartPositions.clear();
            return;
        }
        
        const firstObj = selectedObjects[0];
        const firstId = firstObj.id() || firstObj._id;
        const startPos = this._dragStartPositions.get(firstId);
        
        if (!startPos) {
            console.warn('[ObjectSelectionTool] 시작 위치 정보 없음');
            this._dragStartPositions.clear();
            return;
        }
        
        const currentX = firstObj.x();
        const currentY = firstObj.y();
        
        const deltaX = currentX - startPos.x;
        const deltaY = currentY - startPos.y;
        
        if (Math.abs(deltaX) < 0.1 && Math.abs(deltaY) < 0.1) {
            console.log('[ObjectSelectionTool] 이동 없음 - Command 생략');
            this._dragStartPositions.clear();
            return;
        }
        
        console.log('[ObjectSelectionTool] MoveCommand 생성:', {
            objects: selectedObjects.length,
            deltaX: deltaX.toFixed(1),
            deltaY: deltaY.toFixed(1)
        });
        
        // 원위치로 복원 후 Command 실행
        selectedObjects.forEach(obj => {
            const objId = obj.id() || obj._id;
            const objStartPos = this._dragStartPositions.get(objId);
            if (objStartPos) {
                obj.x(objStartPos.x);
                obj.y(objStartPos.y);
            }
        });
        
        const moveCommand = new MoveCommandClass(selectedObjects, deltaX, deltaY);
        cmdManager.execute(moveCommand);
        
        console.log('[ObjectSelectionTool] ✅ MoveCommand 실행 완료');
        
        this._dragStartPositions.clear();
    }

    // =======================================
    // Shift+드래그 박스 선택
    // =======================================

    onMouseDown(e) {
        if (e.evt.button !== 0) return;
        
        if (this.editor.wallDrawTool?.isActive) {
            console.log('🚫 WallDrawTool 활성화됨 - 박스 선택 무시');
            return;
        }
        
        const clickedOnEmpty = e.target === this.editor.stage;
        
        if (clickedOnEmpty && this.shiftKeyPressed) {
            this.editor._isBoxSelecting = true;
            
            this.isSelecting = true;
            
            const pos = this.getTransformedPointerPosition();
            
            this.selectionStartX = pos.x;
            this.selectionStartY = pos.y;

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
            
            console.log('✅ Shift+Drag 박스 선택 시작');
        }
    }

    onMouseMove(e) {
        if (!this.isSelecting) return;

        const pos = this.getTransformedPointerPosition();
        
        const width = pos.x - this.selectionStartX;
        const height = pos.y - this.selectionStartY;

        this.selectionBox.width(Math.abs(width));
        this.selectionBox.height(Math.abs(height));
        this.selectionBox.x(width < 0 ? pos.x : this.selectionStartX);
        this.selectionBox.y(height < 0 ? pos.y : this.selectionStartY);

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
        
        const layers = [
            this.editor.layers.equipment,
            this.editor.layers.room
        ];
        
        const selectableKeywords = ['equipment', 'wall', 'office', 'partition', 'desk', 'pillar', 'component'];
        
        layers.forEach(layer => {
            if (!layer) return;
            
            layer.getChildren().forEach(shape => {
                const shapeName = shape.name() || '';
                const isSelectable = selectableKeywords.some(keyword => shapeName.includes(keyword));
                
                if (isSelectable && shape.draggable()) {
                    const shapeBox = shape.getClientRect();
                    if (this.haveIntersection(box, shapeBox)) {
                        count++;
                    }
                }
            });
        });
        
        return count;
    }

    onMouseUp(e) {
        if (!this.isSelecting) return;

        this.isSelecting = false;

        const box = this.selectionBox.getClientRect();
        
        if (!this.ctrlKeyPressed) {
            this.editor.deselectAll();
        }

        const layers = [
            this.editor.layers.equipment,
            this.editor.layers.room
        ];
        
        const selectableKeywords = ['equipment', 'wall', 'office', 'partition', 'desk', 'pillar', 'component'];
        let selectedCount = 0;
        
        layers.forEach(layer => {
            if (!layer) return;
            
            layer.getChildren().forEach(shape => {
                const shapeName = shape.name() || '';
                const isSelectable = selectableKeywords.some(keyword => shapeName.includes(keyword));
                
                if (isSelectable && shape.draggable()) {
                    const shapeBox = shape.getClientRect();
                    if (this.haveIntersection(box, shapeBox)) {
                        this.editor.selectObject(shape, true);
                        selectedCount++;
                    }
                }
            });
        });

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

        this.justFinishedBoxSelect = true;
        
        setTimeout(() => {
            this.editor._isBoxSelecting = false;
            this.justFinishedBoxSelect = false;
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
    // 키보드 이벤트
    // =======================================

    onKeyDown(e) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎹 onKeyDown 호출됨!');
        console.log('  ├─ e.key:', e.key);
        console.log('  ├─ e.code:', e.code);
        console.log('  ├─ e.keyCode:', e.keyCode);
        console.log('  └─ selectedObjects.length:', this.editor.selectedObjects.length);

        if (e.key === 'Shift') {
            this.shiftKeyPressed = true;
            console.log('🔑 Shift 키 눌림');
        }

        if (e.ctrlKey || e.metaKey) {
            this.ctrlKeyPressed = true;
            console.log('🔑 Ctrl 키 눌림');
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            console.log('🗑️ Delete/Backspace 감지');
            if (this.editor.selectedObjects.length > 0) {
                this._deleteSelectedWithCommand();
            }
        }

        console.log('🔍 Escape 키 체크 시작...');
        console.log('  ├─ e.key === "Escape"?', e.key === 'Escape');

        if (e.key === 'Escape') {
            console.log('🚪 Escape 키 감지됨!');
            if (this.editor.selectedObjects.length > 0) {
                this.editor.deselectAll();
            }
        } else {
            console.log('⚠️ Escape 키가 아님!');
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.selectAll();
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    onKeyUp(e) {
        if (e.key === 'Shift') {
            this.shiftKeyPressed = false;
            console.log('🔓 Shift 키 해제');
        }
        if (e.key === 'Control' || e.key === 'Meta') {
            this.ctrlKeyPressed = false;
            console.log('🔓 Ctrl 키 해제');
        }
    }

    /**
     * ✨ v5.0.0: DeleteCommand를 사용한 삭제
     * @private
     */
    _deleteSelectedWithCommand() {
        const cmdManager = this.getCommandManager();
        const DeleteCommandClass = window.DeleteCommand;
        
        if (!cmdManager || !DeleteCommandClass) {
            console.warn('[ObjectSelectionTool] CommandManager 또는 DeleteCommand 없음 - 직접 삭제');
            this.editor.deleteSelected();
            return;
        }
        
        const selectedObjects = [...this.editor.selectedObjects];
        
        if (selectedObjects.length === 0) {
            return;
        }
        
        console.log('[ObjectSelectionTool] DeleteCommand 생성:', selectedObjects.length, '개 객체');
        
        this.editor.deselectAll();
        
        const deleteCommand = new DeleteCommandClass(selectedObjects);
        cmdManager.execute(deleteCommand);
        
        console.log('[ObjectSelectionTool] ✅ DeleteCommand 실행 완료');
    }

    // =======================================
    // 전체 선택
    // =======================================

    selectAll() {
        console.log('🔘 전체 선택');

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

        console.log(`✅ ${this.editor.selectedObjects.length}개 전체 선택됨`);
    }

    // =======================================
    // Stage 클릭 핸들러
    // =======================================

    handleStageClick(e) {
        if (this.editor._isBoxSelecting || this.justFinishedBoxSelect) {
            console.log('🚫 박스 선택 중 - handleStageClick 무시');
            return;
        }

        if (e.target === this.editor.stage) {
            if (!this.ctrlKeyPressed) {
                this.editor.deselectAll();
            }
        }
    }

    // =======================================
    // 좌표 표시 (드래그 시)
    // =======================================

    updateCoordinates(shape) {
        const scale = this.editor.config.scale;

        const zoomController = this.editor.zoomController;
        let zoomLevel = 1;
        
        if (zoomController && typeof zoomController.getZoom === 'function') {
            zoomLevel = zoomController.getZoom();
        } else if (this.editor.stage) {
            zoomLevel = this.editor.stage.scaleX() || 1;
        }

        const x = Math.round(shape.x() / scale * 10) / 10;
        const y = Math.round(shape.y() / scale * 10) / 10;

        if (!this.coordLabel) {
            this.coordLabel = new Konva.Group();
        } else {
            this.coordLabel.destroyChildren();
        }

        const labelX = shape.x();
        const labelY = shape.y() - 30 / zoomLevel;

        this.coordLabel.position({ x: labelX, y: labelY });

        this.coordLabel.add(new Konva.Rect({
            x: 0,
            y: 0,
            width: 80 / zoomLevel,
            height: 22 / zoomLevel,
            fill: this.cssColors.coordBg,
            cornerRadius: 5 / zoomLevel,
            shadowColor: 'black',
            shadowBlur: 5 / zoomLevel,
            shadowOffset: { x: 2 / zoomLevel, y: 2 / zoomLevel },
            shadowOpacity: 0.3
        }));

        this.coordLabel.add(new Konva.Text({
            text: `${x}m, ${y}m`,
            fontSize: 12 / zoomLevel,
            padding: 5 / zoomLevel,
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
        this._dragStartPositions.clear();
        console.log('✅ ObjectSelectionTool destroyed');
    }
}

// ✅ 전역 객체 등록 (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.ObjectSelectionTool = ObjectSelectionTool;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ObjectSelectionTool;
}