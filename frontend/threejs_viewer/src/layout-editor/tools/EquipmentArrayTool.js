/**
 * EquipmentArrayTool.js
 * 
 * 설비를 배열 형태로 배치하는 도구
 * 복도를 고려하여 26×6 설비 배열 생성 및 관리
 * 
 * @module EquipmentArrayTool
 * @version 1.2.1 - Phase 3.2: Command Pattern 적용 + API 호환성 수정
 * 
 * 변경사항 (v1.2.1):
 * - startArrayPlacement() 메서드 추가 (UIService 호환)
 * - 간단한 config 형식 지원 ({ rows, cols, spacingX, spacingY })
 * - 설비 배열 생성 시 여러 CreateCommand를 GroupCommand로 묶음
 * - 한 번의 Undo로 전체 배열 삭제 가능
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/tools/EquipmentArrayTool.js
 */

class EquipmentArrayTool {
    /**
     * @param {Canvas2DEditor} canvas2DEditor - 캔버스 에디터 인스턴스
     * @param {CommandManager} commandManager - Command 관리자 (optional)
     */
    constructor(canvas2DEditor, commandManager = null) {
        this.canvas = canvas2DEditor;
        // CommandManager는 직접 전달받거나 canvas에서 참조
        this.commandManager = commandManager || canvas2DEditor?.commandManager || null;
        
        this.isActive = false;
        this.startPoint = null;
        this.config = null;
        
        // 기본 설비 크기 설정
        this.defaultEquipmentSize = {
            width: 1.4,  // 미터
            depth: 1.8,  // 미터
            height: 2.0  // 미터
        };
        
        this.handlers = {
            click: null,
            mousemove: null,
            keydown: null
        };

        this.previewGroup = null;

        console.log('[EquipmentArrayTool] Initialized v1.2.1 (Command Pattern + API 호환)');
        
        if (!this.commandManager) {
            console.warn('[EquipmentArrayTool] CommandManager가 없습니다. Undo/Redo가 작동하지 않습니다.');
        }
    }

    /**
     * CommandManager 설정 (지연 주입용)
     * @param {CommandManager} commandManager
     */
    setCommandManager(commandManager) {
        this.commandManager = commandManager;
        console.log('[EquipmentArrayTool] CommandManager 설정됨');
    }

    /**
     * ✨ v1.2.1: UIService 호환 메서드
     * 배열 배치 시작 (간단한 config 형식 지원)
     * @param {Object} simpleConfig - { rows, cols, spacingX, spacingY }
     */
    startArrayPlacement(simpleConfig) {
        console.log('[EquipmentArrayTool] startArrayPlacement called with:', simpleConfig);
        
        // 간단한 config를 전체 config로 변환
        const fullConfig = this.normalizeConfig(simpleConfig);
        
        // activate 호출
        this.activate(fullConfig);
    }

    /**
     * ✨ v1.2.1: 간단한 config를 전체 config 형식으로 변환
     * @param {Object} simpleConfig - { rows, cols, spacingX, spacingY } 또는 전체 config
     * @returns {Object} 전체 config
     */
    normalizeConfig(simpleConfig) {
        // 이미 전체 config 형식인 경우 그대로 반환
        if (simpleConfig.equipmentSize && simpleConfig.corridorCols) {
            return simpleConfig;
        }

        const {
            rows = 6,
            cols = 26,
            spacingX = 0.5,
            spacingY = 0.5,
            spacing = 0.5,
            equipmentWidth = this.defaultEquipmentSize.width,
            equipmentDepth = this.defaultEquipmentSize.depth,
            equipmentHeight = this.defaultEquipmentSize.height,
            corridorCols = [13],      // 기본: 13열 뒤에 복도
            corridorColWidth = 3.0,   // 복도 폭 (미터)
            corridorRows = [3],       // 기본: 3행 뒤에 복도
            corridorRowWidth = 3.0,
            excludedPositions = []
        } = simpleConfig;

        return {
            rows,
            cols,
            equipmentSize: {
                width: equipmentWidth,
                depth: equipmentDepth,
                height: equipmentHeight
            },
            spacing: spacing || spacingX,  // spacingX를 기본 spacing으로 사용
            spacingX,
            spacingY,
            corridorCols: Array.isArray(corridorCols) ? corridorCols : [corridorCols],
            corridorColWidth,
            corridorRows: Array.isArray(corridorRows) ? corridorRows : [corridorRows],
            corridorRowWidth,
            excludedPositions
        };
    }

    /**
     * 도구 활성화
     * @param {Object} config - 전체 config 또는 간단한 config
     */
    activate(config) {
        // config 정규화
        this.config = this.normalizeConfig(config);
        
        console.log('[EquipmentArrayTool] Activating with normalized config:', this.config);
        
        this.isActive = true;
        this.startPoint = null;

        this.canvas.stage.container().style.cursor = 'crosshair';

        this.handlers.click = (e) => {
            const pos = this.canvas.stage.getPointerPosition();
            
            if (!this.startPoint) {
                this.startPoint = { x: pos.x, y: pos.y };
                console.log('[EquipmentArrayTool] Start point set:', this.startPoint);
                
                this.createArray(this.startPoint);
                this.deactivate();
            }
        };

        this.handlers.mousemove = (e) => {
            if (!this.startPoint) {
                // 미리보기 표시 (선택사항)
                this.showPreview(e);
            }
        };

        this.handlers.keydown = (e) => {
            if (e.key === 'Escape') {
                console.log('[EquipmentArrayTool] Cancelled by Escape key');
                this.deactivate();
            }
        };

        this.canvas.stage.on('click', this.handlers.click);
        this.canvas.stage.on('mousemove', this.handlers.mousemove);
        window.addEventListener('keydown', this.handlers.keydown);

        console.log('[EquipmentArrayTool] Activated - Click to place array');
    }

    /**
     * 미리보기 표시 (선택사항)
     * @param {Event} e - 마우스 이벤트
     */
    showPreview(e) {
        // 미리보기 구현 (필요시)
        // 현재는 커서만 crosshair로 변경
    }

    deactivate() {
        if (!this.isActive) return;

        console.log('[EquipmentArrayTool] Deactivating...');
        
        this.isActive = false;
        this.startPoint = null;
        
        if (this.previewGroup) {
            this.previewGroup.destroy();
            this.previewGroup = null;
        }

        if (this.handlers.click) {
            this.canvas.stage.off('click', this.handlers.click);
        }
        if (this.handlers.mousemove) {
            this.canvas.stage.off('mousemove', this.handlers.mousemove);
        }
        if (this.handlers.keydown) {
            window.removeEventListener('keydown', this.handlers.keydown);
        }

        this.canvas.stage.container().style.cursor = 'default';

        console.log('[EquipmentArrayTool] Deactivated');
    }

    /**
     * 설비 배열 생성 (Command Pattern 적용)
     * @param {Object} startPoint - 시작 좌표 {x, y}
     * @returns {Konva.Group} 생성된 배열 그룹
     */
    createArray(startPoint) {
        console.log('[EquipmentArrayTool] Creating array at:', startPoint);
        
        const {
            rows,
            cols,
            equipmentSize,
            spacing,
            spacingX,
            spacingY,
            corridorCols,
            corridorColWidth,
            corridorRows,
            corridorRowWidth,
            excludedPositions
        } = this.config;

        // 배열 그룹 생성
        const arrayGroup = new Konva.Group({
            x: startPoint.x,
            y: startPoint.y,
            draggable: true,
            name: 'equipmentArray',
            rotation: 0
        });

        // 배열 설정 저장
        arrayGroup.setAttr('arrayConfig', {
            rows,
            cols,
            equipmentSize,
            spacing,
            spacingX,
            spacingY,
            corridorCols,
            corridorColWidth,
            corridorRows,
            corridorRowWidth,
            rotation: 0
        });

        let equipmentCount = 0;

        // 개별 설비 생성
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (this.isExcluded(row, col, excludedPositions || [])) {
                    console.log(`[EquipmentArrayTool] Position (${row}, ${col}) excluded`);
                    continue;
                }

                const position = this.calculatePosition(row, col);
                const equipment = this.createEquipment(row, col, position, equipmentSize);
                
                // 설비를 배열 그룹에 추가
                arrayGroup.add(equipment);
                equipmentCount++;
            }
        }

        // ✨ v1.2.0: Command Pattern 적용
        if (this.commandManager && window.CreateCommand && window.GroupCommand) {
            // 배열 그룹 전체를 하나의 CreateCommand로 생성
            const createArrayCommand = new window.CreateCommand(
                arrayGroup,
                this.canvas.layers.equipment
            );
            
            // GroupCommand로 감싸서 설명 추가
            const groupCommand = new window.GroupCommand(
                [createArrayCommand],
                `Create Equipment Array ${rows}×${cols} (${equipmentCount} items)`
            );
            
            // CommandManager를 통해 실행 (Undo/Redo 지원)
            this.commandManager.execute(groupCommand, true);
            
            console.log(`[EquipmentArrayTool] ✅ Array created via Command Pattern (${equipmentCount} equipment)`);
        } else {
            // CommandManager가 없는 경우 직접 추가 (기존 방식)
            this.canvas.layers.equipment.add(arrayGroup);
            this.canvas.layers.equipment.batchDraw();
            
            console.log(`[EquipmentArrayTool] Array created directly (${equipmentCount} equipment) - No Undo support`);
        }

        // 드래그 종료 시 그리드 스냅
        arrayGroup.on('dragend', () => {
            if (this.canvas.snapToGrid) {
                this.canvas.snapToGrid(arrayGroup);
            }
        });

        // 개별 분리 리스너 설정
        this.setupDetachListener(arrayGroup);

        // 레이아웃 데이터 업데이트
        if (!this.canvas.currentLayout) {
            this.canvas.currentLayout = {};
        }
        if (!this.canvas.currentLayout.equipmentArrays) {
            this.canvas.currentLayout.equipmentArrays = [];
        }
        
        this.canvas.currentLayout.equipmentArrays.push({
            id: arrayGroup._id,
            position: { x: startPoint.x, y: startPoint.y },
            rotation: 0,
            config: this.config
        });

        return arrayGroup;
    }

    /**
     * Position 계산
     * @param {number} row - 행 인덱스
     * @param {number} col - 열 인덱스
     * @returns {Object} {x, y} 픽셀 좌표
     */
    calculatePosition(row, col) {
        const {
            equipmentSize,
            spacing,
            spacingX,
            spacingY,
            corridorCols,
            corridorColWidth,
            corridorRows,
            corridorRowWidth
        } = this.config;

        const scale = this.canvas.config?.scale || 20; // 기본 스케일

        // 픽셀 단위 변환
        const equipWidthPx = equipmentSize.width * scale;
        const equipDepthPx = equipmentSize.depth * scale;
        
        // spacingX/spacingY가 있으면 사용, 없으면 spacing 사용
        const spacingXPx = (spacingX || spacing || 0.5) * scale;
        const spacingYPx = (spacingY || spacing || 0.5) * scale;

        let x = 0;
        let y = 0;

        // X 좌표 계산 (Col)
        for (let c = 0; c < col; c++) {
            x += equipWidthPx + spacingXPx;
            
            if (corridorCols && corridorCols.includes(c + 1)) {
                x += corridorColWidth * scale;
            }
        }

        // Y 좌표 계산 (Row)
        for (let r = 0; r < row; r++) {
            y += equipDepthPx + spacingYPx;
            
            if (corridorRows && corridorRows.includes(r + 1)) {
                y += corridorRowWidth * scale;
            }
        }

        return { x, y };
    }

    isExcluded(row, col, excludedPositions) {
        if (!excludedPositions || !Array.isArray(excludedPositions)) {
            return false;
        }
        return excludedPositions.some(pos => pos.row === row && pos.col === col);
    }

    createEquipment(row, col, position, equipmentSize) {
        const scale = this.canvas.config?.scale || 20;
        
        const widthPx = equipmentSize.width * scale;
        const depthPx = equipmentSize.depth * scale;

        const equipGroup = new Konva.Group({
            x: position.x,
            y: position.y,
            draggable: false,
            name: 'equipment',
            rotation: 0
        });

        // 설비 데이터 저장
        equipGroup.setAttr('equipmentData', {
            row,
            col,
            id: `EQ-${String(row + 1).padStart(2, '0')}-${String(col + 1).padStart(2, '00')}`,
            size: equipmentSize,
            rotation: 0
        });

        // 색상 설정 (canvas에서 가져오거나 기본값 사용)
        const fillColor = this.canvas.cssColors?.equipmentDefault || '#4a90d9';
        const strokeColor = this.canvas.cssColors?.equipmentStroke || '#2d5a87';
        const hoverColor = this.canvas.cssColors?.equipmentHover || '#5ba3ec';

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 1,
            name: 'equipmentRect'
        });

        const text = new Konva.Text({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            text: `${row + 1}-${col + 1}`,
            fontSize: Math.min(10, widthPx / 3),
            fontFamily: 'Arial',
            fill: '#ffffff',
            align: 'center',
            verticalAlign: 'middle',
            name: 'equipmentText'
        });

        // 호버 이벤트
        equipGroup.on('mouseenter', () => {
            if (!this.canvas.selectedObjects?.includes(equipGroup)) {
                rect.fill(hoverColor);
                this.canvas.layers.equipment.batchDraw();
            }
            this.canvas.stage.container().style.cursor = 'pointer';
        });

        equipGroup.on('mouseleave', () => {
            if (!this.canvas.selectedObjects?.includes(equipGroup)) {
                rect.fill(fillColor);
                this.canvas.layers.equipment.batchDraw();
            }
            this.canvas.stage.container().style.cursor = 'default';
        });

        equipGroup.add(rect);
        equipGroup.add(text);

        return equipGroup;
    }

    /**
     * 개별 설비 분리 리스너 설정
     * @param {Konva.Group} arrayGroup - 배열 그룹
     */
    setupDetachListener(arrayGroup) {
        arrayGroup.on('click', (e) => {
            const target = e.target.getParent();
            
            if (e.evt.shiftKey && target && target.name() === 'equipment') {
                e.cancelBubble = true;
                
                console.log('[EquipmentArrayTool] Detaching equipment:', target.getAttr('equipmentData'));
                
                this.detachFromGroup(target, arrayGroup);
            }
        });
    }

    /**
     * 설비를 그룹에서 분리 (Command Pattern 적용)
     * @param {Konva.Group} equipment - 분리할 설비
     * @param {Konva.Group} arrayGroup - 원본 배열 그룹
     */
    detachFromGroup(equipment, arrayGroup) {
        const absPos = equipment.getAbsolutePosition();
        const equipmentData = equipment.getAttr('equipmentData');
        
        // ✨ v1.2.0: Command Pattern 적용
        if (this.commandManager && window.GroupCommand) {
            // 트랜잭션으로 처리 (분리 작업을 하나의 Undo 단위로)
            this.commandManager.beginTransaction(`Detach Equipment ${equipmentData?.id || ''}`);
            
            try {
                // 1. 원본 그룹에서 제거
                equipment.remove();
                
                // 2. 메인 레이어에 추가
                this.canvas.layers.equipment.add(equipment);
                equipment.position(absPos);
                equipment.draggable(true);
                
                // 3. 이벤트 재설정
                equipment.on('dragend', () => {
                    if (this.canvas.snapToGrid) {
                        this.canvas.snapToGrid(equipment);
                    }
                });

                equipment.off('click');
                equipment.on('click', (e) => {
                    e.cancelBubble = true;
                    
                    if (e.evt.ctrlKey || e.evt.metaKey) {
                        this.canvas.selectMultiple?.(equipment);
                    } else {
                        this.canvas.selectObject?.(equipment, false);
                    }
                });

                this.canvas.layers.equipment.batchDraw();
                
                // 트랜잭션 커밋
                this.commandManager.commitTransaction();
                
                console.log('[EquipmentArrayTool] ✅ Equipment detached via Command Pattern');
            } catch (error) {
                // 오류 시 롤백
                this.commandManager.rollbackTransaction();
                console.error('[EquipmentArrayTool] Detach failed:', error);
            }
        } else {
            // CommandManager가 없는 경우 직접 처리 (기존 방식)
            equipment.remove();
            this.canvas.layers.equipment.add(equipment);
            equipment.position(absPos);
            equipment.draggable(true);
            
            equipment.on('dragend', () => {
                if (this.canvas.snapToGrid) {
                    this.canvas.snapToGrid(equipment);
                }
            });

            equipment.off('click');
            equipment.on('click', (e) => {
                e.cancelBubble = true;
                
                if (e.evt.ctrlKey || e.evt.metaKey) {
                    this.canvas.selectMultiple?.(equipment);
                } else {
                    this.canvas.selectObject?.(equipment, false);
                }
            });

            this.canvas.layers.equipment.batchDraw();
            
            console.log('[EquipmentArrayTool] Equipment detached directly - No Undo support');
        }
    }

    /**
     * 도구 활성화 상태 확인
     * @returns {boolean}
     */
    isToolActive() {
        return this.isActive;
    }

    /**
     * 배열 전체 삭제 (Command Pattern 적용)
     * @param {Konva.Group} arrayGroup - 삭제할 배열 그룹
     */
    deleteArray(arrayGroup) {
        if (!arrayGroup) return;

        const equipmentCount = arrayGroup.getChildren().length;

        if (this.commandManager && window.DeleteCommand && window.GroupCommand) {
            const deleteCommand = new window.DeleteCommand(arrayGroup);
            const groupCommand = new window.GroupCommand(
                [deleteCommand],
                `Delete Equipment Array (${equipmentCount} items)`
            );
            
            this.commandManager.execute(groupCommand, true);
            console.log(`[EquipmentArrayTool] ✅ Array deleted via Command Pattern (${equipmentCount} equipment)`);
        } else {
            // 직접 삭제
            arrayGroup.destroy();
            this.canvas.layers.equipment.batchDraw();
            console.log(`[EquipmentArrayTool] Array deleted directly (${equipmentCount} equipment) - No Undo support`);
        }

        // 레이아웃 데이터에서 제거
        if (this.canvas.currentLayout?.equipmentArrays) {
            const index = this.canvas.currentLayout.equipmentArrays.findIndex(
                arr => arr.id === arrayGroup._id
            );
            if (index !== -1) {
                this.canvas.currentLayout.equipmentArrays.splice(index, 1);
            }
        }
    }

    /**
     * 선택된 설비들을 새 배열로 그룹화 (Command Pattern 적용)
     * @param {Array<Konva.Group>} equipments - 그룹화할 설비들
     * @param {string} groupName - 그룹 이름
     * @returns {Konva.Group} 생성된 그룹
     */
    groupEquipments(equipments, groupName = 'Custom Group') {
        if (!equipments || equipments.length === 0) return null;

        // 바운딩 박스 계산
        let minX = Infinity, minY = Infinity;
        equipments.forEach(eq => {
            const pos = eq.getAbsolutePosition();
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
        });

        // 새 그룹 생성
        const newGroup = new Konva.Group({
            x: minX,
            y: minY,
            draggable: true,
            name: 'equipmentArray'
        });

        if (this.commandManager && window.GroupCommand) {
            this.commandManager.beginTransaction(`Group ${equipments.length} equipments`);
            
            try {
                equipments.forEach(eq => {
                    const absPos = eq.getAbsolutePosition();
                    eq.remove();
                    newGroup.add(eq);
                    eq.position({
                        x: absPos.x - minX,
                        y: absPos.y - minY
                    });
                    eq.draggable(false);
                });

                this.canvas.layers.equipment.add(newGroup);
                this.canvas.layers.equipment.batchDraw();
                
                this.setupDetachListener(newGroup);
                
                this.commandManager.commitTransaction();
                console.log(`[EquipmentArrayTool] ✅ ${equipments.length} equipments grouped via Command Pattern`);
            } catch (error) {
                this.commandManager.rollbackTransaction();
                console.error('[EquipmentArrayTool] Grouping failed:', error);
                return null;
            }
        } else {
            // 직접 그룹화
            equipments.forEach(eq => {
                const absPos = eq.getAbsolutePosition();
                eq.remove();
                newGroup.add(eq);
                eq.position({
                    x: absPos.x - minX,
                    y: absPos.y - minY
                });
                eq.draggable(false);
            });

            this.canvas.layers.equipment.add(newGroup);
            this.canvas.layers.equipment.batchDraw();
            
            this.setupDetachListener(newGroup);
            console.log(`[EquipmentArrayTool] ${equipments.length} equipments grouped directly - No Undo support`);
        }

        return newGroup;
    }

    /**
     * 기본 설비 크기 설정
     * @param {Object} size - { width, depth, height }
     */
    setDefaultEquipmentSize(size) {
        this.defaultEquipmentSize = { ...this.defaultEquipmentSize, ...size };
        console.log('[EquipmentArrayTool] Default equipment size updated:', this.defaultEquipmentSize);
    }

    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return this.config ? { ...this.config } : null;
    }
}

// =====================================================
// Exports
// =====================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EquipmentArrayTool;
}

if (typeof window !== 'undefined') {
    window.EquipmentArrayTool = EquipmentArrayTool;
}

console.log('✅ EquipmentArrayTool.js v1.2.1 로드 완료');