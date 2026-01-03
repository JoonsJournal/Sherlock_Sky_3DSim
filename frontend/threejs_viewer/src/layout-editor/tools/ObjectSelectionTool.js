/**
 * ObjectSelectionTool.js v5.0.0
 * ====================================================
 * 
 * ✨ v5.0.0 수정 (Phase 5.1 - Tool-Command 통합):
 * - ✅ CommandManager 연동으로 Undo/Redo 지원
 * - ✅ 드래그 시작 시 원래 위치 저장 (_dragStartPositions)
 * - ✅ 드래그 완료 시 MoveCommand 생성 및 실행
 * - ✅ 다중 선택 드래그도 Command 기록
 * - ✅ 삭제 시 DeleteCommand 사용
 * 
 * ✨ v4.0.6 기능 유지:
 * - ✅ SmartGuideManager 연동 (드래그 시 정렬 가이드라인)
 * - ✅ 드래그 시작 시 참조 객체 설정
 * - ✅ 드래그 중 스냅 적용
 * - ✅ 드래그 종료 시 가이드라인 정리
 * 
 * ✨ v4.0.5 기능 유지:
 * - ✅ 부분 문자열 매칭으로 선택 로직 변경
 * - ✅ 'equipment component', 'partition component' 등 복합 이름 지원
 * 
 * ✨ v4.0.4 기능 유지:
 * - ✅ 박스 선택에서 Wall, Office, Partition도 선택 가능
 * - ✅ 여러 레이어(equipment, room) 검색
 * 
 * ✨ v4.0.3 기능 유지:
 * - ✅ WallDrawTool 활성화 시 박스 선택 비활성화
 * 
 * ✨ v4.0.2 기능 유지:
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
        this.justFinishedBoxSelect = false;  // ✅ 박스 선택 방금 완료 플래그

        // ✨ v5.0.0: 드래그 시작 위치 저장 (Undo용)
        this._dragStartPositions = new Map();  // shape.id() => { x, y }
        this._isDragging = false;

        // CSS 색상 참조 (안전 처리)
        this.cssColors = this.editor.cssColors || this.getDefaultColors();

        // 이벤트 핸들러 바인딩
        this.handleKeyDown = this.onKeyDown.bind(this);
        this.handleKeyUp = this.onKeyUp.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseUp = this.onMouseUp.bind(this);
        
        console.log('[ObjectSelectionTool] 초기화 완료 v5.0.0 (Command 통합)');
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
        // 1. 직접 설정된 commandManager
        if (this.commandManager) {
            return this.commandManager;
        }
        
        // 2. editor.commandManager
        if (this.editor && this.editor.commandManager) {
            return this.editor.commandManager;
        }
        
        // 3. 전역 commandManager
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

        console.log('✅ ObjectSelectionTool activated (Shift+Drag mode) v5.0.0');
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
        
        // ✨ v5.0.0: 드래그 상태 초기화
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
                    // ✅ v3.2.9: Wall hover 시 점선 문제 해결
                    shape.strokeWidth(6);
                    shape.stroke('#667eea');
                    shape.dash(null);  // 점선 제거
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
                    // ✅ v3.2.9: Wall 원래 스타일로 복구
                    shape.strokeWidth(shape.getAttr('originalStrokeWidth') || 4);
                    shape.stroke(shape.getAttr('originalStroke') || '#888888');
                    shape.dash(null);  // 점선 없이 유지
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
            
            // ✅ 드래그 시작 플래그
            this._isDragging = true;
            
            // ✅ 선택된 모든 객체의 시작 위치 저장 (다중 선택 드래그 지원)
            this._dragStartPositions.clear();
            this.editor.selectedObjects.forEach(obj => {
                this._dragStartPositions.set(obj.id() || obj._id, {
                    x: obj.x(),
                    y: obj.y()
                });
            });
            
            console.log('[ObjectSelectionTool] Drag start - 위치 저장:', 
                this._dragStartPositions.size, '개 객체');
            
            // ✅ v4.0.6: SmartGuideManager 참조 객체 설정
            if (this.editor.smartGuideManager) {
                const allShapes = this.editor.getAllSelectableShapes ? 
                    this.editor.getAllSelectableShapes() : [];
                this.editor.smartGuideManager.setReferenceObjects(
                    allShapes, 
                    this.editor.selectedObjects  // 현재 선택된 객체 제외
                );
            }
        });

        // Drag move
        shape.on('dragmove', () => {
            // ✨ v4.0.2: Zoom/Pan 고려한 좌표 표시
            this.updateCoordinates(shape);
            
            // ✅ v4.0.6: SmartGuideManager 가이드라인 업데이트
            if (this.editor.smartGuideManager) {
                const snapDelta = this.editor.smartGuideManager.updateGuides(shape);
                
                // 스냅 적용
                if (snapDelta.x !== 0 || snapDelta.y !== 0) {
                    shape.x(shape.x() + snapDelta.x);
                    shape.y(shape.y() + snapDelta.y);
                }
            }
        });

        // ✨ v5.0.0: Drag end - MoveCommand 생성 및 실행
        shape.on('dragend', () => {
            // ✅ v4.0.6: SmartGuideManager 가이드라인 제거
            if (this.editor.smartGuideManager) {
                this.editor.smartGuideManager.clearGuides();
            }
            
            // ✅ Snap to Grid 적용
            if (this.editor.config.snapToGrid) {
                const gridSize = this.editor.config.gridSize;
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
            
            // 드래그 상태 초기화
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
        
        // MoveCommand 클래스 확인
        const MoveCommandClass = window.MoveCommand;
        const GroupCommandClass = window.GroupCommand;
        
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
        
        // 이동량 계산 (첫 번째 객체 기준)
        const firstObj = selectedObjects[0];
        const firstId = firstObj.id() || firstObj._id;
        const startPos = this._dragStartPositions.get(firstId);
        
        if (!startPos) {
            console.warn('[ObjectSelectionTool] 시작 위치 정보 없음');
            this._dragStartPositions.clear();
            return;
        }
        
        // 현재 위치 (Snap 적용 후)
        const currentX = firstObj.x();
        const currentY = firstObj.y();
        
        // 이동량
        const deltaX = currentX - startPos.x;
        const deltaY = currentY - startPos.y;
        
        // 이동이 없으면 Command 생성 안함
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
        
        // ✅ 핵심: 원위치로 복원 후 Command 실행
        // (Command.execute()가 실제 이동을 수행하도록)
        selectedObjects.forEach(obj => {
            const objId = obj.id() || obj._id;
            const objStartPos = this._dragStartPositions.get(objId);
            if (objStartPos) {
                obj.x(objStartPos.x);
                obj.y(objStartPos.y);
            }
        });
        
        // MoveCommand 생성 및 실행
        const moveCommand = new MoveCommandClass(selectedObjects, deltaX, deltaY);
        cmdManager.execute(moveCommand);
        
        console.log('[ObjectSelectionTool] ✅ MoveCommand 실행 완료');
        
        // 정리
        this._dragStartPositions.clear();
    }

    // =======================================
    // Shift+드래그 박스 선택
    // =======================================

    onMouseDown(e) {
        if (e.evt.button !== 0) return;
        
        // ✅ v4.0.3: WallDrawTool이 활성화되어 있으면 박스 선택 무시
        if (this.editor.wallDrawTool?.isActive) {
            console.log('🚫 WallDrawTool 활성화됨 - 박스 선택 무시');
            return;
        }
        
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
     * 박스 내 객체 개수 계산 (Equipment + Wall + Office 등)
     */
    countIntersectingShapes(box) {
        let count = 0;
        
        // ✅ v4.0.4: 여러 레이어에서 선택 가능한 객체 검색
        const layers = [
            this.editor.layers.equipment,
            this.editor.layers.room
        ];
        
        // ✅ 부분 문자열 매칭 (equipment component, wall, partition component 등)
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
        
        // Ctrl 키 누르지 않으면 기존 선택 해제
        if (!this.ctrlKeyPressed) {
            this.editor.deselectAll();
            console.log('Deselected all (new selection)');
        } else {
            console.log('✅ Ctrl+Shift+Drag: 기존 선택 유지');
        }

        // ✅ v4.0.4: 여러 레이어에서 박스 내 객체 선택
        const layers = [
            this.editor.layers.equipment,
            this.editor.layers.room
        ];
        
        // ✅ 부분 문자열 매칭 (equipment component, wall, partition component 등)
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
    // 키보드 이벤트
    // =======================================

    onKeyDown(e) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎹 onKeyDown 호출됨!');
        console.log('  ├─ e.key:', e.key);
        console.log('  ├─ e.code:', e.code);
        console.log('  ├─ e.keyCode:', e.keyCode);
        console.log('  └─ selectedObjects.length:', this.editor.selectedObjects.length);

        // Shift 키
        if (e.key === 'Shift') {
            this.shiftKeyPressed = true;
            console.log('🔑 Shift 키 눌림');
        }

        // Ctrl 키 (Windows) / Meta 키 (macOS)
        if (e.ctrlKey || e.metaKey) {
            this.ctrlKeyPressed = true;
            console.log('🔑 Ctrl 키 눌림');
        }

        // Delete / Backspace 키
        if (e.key === 'Delete' || e.key === 'Backspace') {
            console.log('🗑️ Delete/Backspace 감지');
            if (this.editor.selectedObjects.length > 0) {
                // ✨ v5.0.0: DeleteCommand 사용
                this._deleteSelectedWithCommand();
            }
        }

        // Escape 키 처리 (명확한 체크)
        console.log('🔍 Escape 키 체크 시작...');
        console.log('  ├─ e.key === "Escape"?', e.key === 'Escape');
        console.log('  ├─ e.key 정확한 값:', JSON.stringify(e.key));
        console.log('  └─ e.key.length:', e.key.length);

        if (e.key === 'Escape') {
            console.log('🚪 Escape 키 감지됨!');
            console.log('  ├─ selectedObjects.length:', this.editor.selectedObjects.length);

            if (this.editor.selectedObjects.length > 0) {
                console.log('  └─ deselectAll() 호출...');
                this.editor.deselectAll();
                console.log('  └─ deselectAll() 완료');
            } else {
                console.log('  └─ 선택된 객체 없음 - 아무 동작 안함');
            }
        } else {
            console.log('⚠️ Escape 키가 아님!');
        }

        // Ctrl+A (전체 선택)
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
        
        const selectedObjects = [...this.editor.selectedObjects];  // 복사본
        
        if (selectedObjects.length === 0) {
            return;
        }
        
        console.log('[ObjectSelectionTool] DeleteCommand 생성:', selectedObjects.length, '개 객체');
        
        // 선택 해제 먼저
        this.editor.deselectAll();
        
        // DeleteCommand 생성 및 실행
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
        // ✅ 박스 선택 중이면 무시
        if (this.editor._isBoxSelecting || this.justFinishedBoxSelect) {
            console.log('🚫 박스 선택 중 - handleStageClick 무시');
            return;
        }

        // Stage 빈 공간 클릭 → 선택 해제
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

        // ✨ v4.0.2: Zoom 레벨 고려한 좌표 표시
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

        // 위치 계산 (Shape 위)
        const labelX = shape.x();
        const labelY = shape.y() - 30 / zoomLevel;  // Zoom 레벨 고려

        this.coordLabel.position({ x: labelX, y: labelY });

        // 배경 Rect (Zoom 레벨 고려)
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
            fontSize: 12 / zoomLevel,  // Zoom 레벨 고려
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