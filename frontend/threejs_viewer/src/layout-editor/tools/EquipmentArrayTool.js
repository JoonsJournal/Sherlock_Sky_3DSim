/**
 * EquipmentArrayTool.js
 * 
 * 설비를 배열 형태로 배치하는 도구
 * 복도를 고려하여 26×6 설비 배열 생성 및 관리
 * 
 * @module EquipmentArrayTool
 * @version 1.1.0 - Phase 3.1: rotation 속성 추가
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/tools/EquipmentArrayTool.js
 */

class EquipmentArrayTool {
    constructor(canvas2DEditor) {
        this.canvas = canvas2DEditor;
        this.isActive = false;
        this.startPoint = null;
        this.config = null;
        
        this.handlers = {
            click: null,
            mousemove: null,
            keydown: null
        };

        this.previewGroup = null;

        console.log('[EquipmentArrayTool] Initialized v1.1.0');
    }

    activate(config) {
        console.log('[EquipmentArrayTool] Activating with config:', config);
        
        this.isActive = true;
        this.config = config;
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
                // 미리보기 (선택사항)
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

        console.log('[EquipmentArrayTool] Activated');
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

    createArray(startPoint) {
        console.log('[EquipmentArrayTool] Creating array at:', startPoint);
        
        const {
            rows,
            cols,
            equipmentSize,
            spacing,
            corridorCols,
            corridorColWidth,
            corridorRows,
            corridorRowWidth,
            excludedPositions
        } = this.config;

        const arrayGroup = new Konva.Group({
            x: startPoint.x,
            y: startPoint.y,
            draggable: true,
            name: 'equipmentArray',
            rotation: 0  // ✨ Phase 3.1: 기본 rotation
        });

        // ✨ Phase 3.1: rotation 포함
        arrayGroup.setAttr('arrayConfig', {
            rows,
            cols,
            equipmentSize,
            spacing,
            corridorCols,
            corridorColWidth,
            corridorRows,
            corridorRowWidth,
            rotation: 0  // ✨ 기본 회전 각도
        });

        let equipmentCount = 0;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (this.isExcluded(row, col, excludedPositions)) {
                    console.log(`[EquipmentArrayTool] Position (${row}, ${col}) excluded`);
                    continue;
                }

                const position = this.calculatePosition(row, col);
                const equipment = this.createEquipment(row, col, position, equipmentSize);
                
                arrayGroup.add(equipment);
                equipmentCount++;
            }
        }

        this.canvas.layers.equipment.add(arrayGroup);
        this.canvas.layers.equipment.batchDraw();

        arrayGroup.on('dragend', () => {
            this.canvas.snapToGrid(arrayGroup);
        });

        this.setupDetachListener(arrayGroup);

        console.log(`[EquipmentArrayTool] Array created with ${equipmentCount} equipment`);

        if (!this.canvas.currentLayout) {
            this.canvas.currentLayout = {};
        }
        if (!this.canvas.currentLayout.equipmentArrays) {
            this.canvas.currentLayout.equipmentArrays = [];
        }
        
        this.canvas.currentLayout.equipmentArrays.push({
            id: arrayGroup._id,
            position: { x: startPoint.x, y: startPoint.y },
            rotation: 0,  // ✨ Phase 3.1
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
            corridorCols,
            corridorColWidth,
            corridorRows,
            corridorRowWidth
        } = this.config;

        const scale = this.canvas.config.scale;

        // 픽셀 단위 변환
        const equipWidthPx = equipmentSize.width * scale;
        const equipDepthPx = equipmentSize.depth * scale;
        const spacingPx = spacing * scale;

        let x = 0;
        let y = 0;

        // X 좌표 계산 (Col)
        for (let c = 0; c < col; c++) {
            x += equipWidthPx + spacingPx;
            
            if (corridorCols.includes(c + 1)) {
                x += corridorColWidth * scale;
            }
        }

        // Y 좌표 계산 (Row)
        for (let r = 0; r < row; r++) {
            y += equipDepthPx + spacingPx;
            
            if (corridorRows.includes(r + 1)) {
                y += corridorRowWidth * scale;
            }
        }

        return { x, y };
    }

    isExcluded(row, col, excludedPositions) {
        return excludedPositions.some(pos => pos.row === row && pos.col === col);
    }

    createEquipment(row, col, position, equipmentSize) {
        const scale = this.canvas.config.scale;
        
        const widthPx = equipmentSize.width * scale;
        const depthPx = equipmentSize.depth * scale;

        const equipGroup = new Konva.Group({
            x: position.x,
            y: position.y,
            draggable: false,
            name: 'equipment',
            rotation: 0  // ✨ Phase 3.1: 기본 rotation
        });

        // ✨ Phase 3.1: rotation 포함
        equipGroup.setAttr('equipmentData', {
            row,
            col,
            id: `EQ-${String(row + 1).padStart(2, '0')}-${String(col + 1).padStart(2, '00')}`,
            size: equipmentSize,
            rotation: 0  // ✨ 기본 회전 각도
        });

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            fill: this.canvas.cssColors.equipmentDefault,
            stroke: this.canvas.cssColors.equipmentStroke,
            strokeWidth: 1,
            name: 'equipmentRect'
        });

        const text = new Konva.Text({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            text: `${row + 1}-${col + 1}`,
            fontSize: 10,
            fontFamily: 'Arial',
            fill: '#ffffff',
            align: 'center',
            verticalAlign: 'middle',
            name: 'equipmentText'
        });

        equipGroup.on('mouseenter', () => {
            if (!this.canvas.selectedObjects.includes(equipGroup)) {
                rect.fill(this.canvas.cssColors.equipmentHover);
                this.canvas.layers.equipment.batchDraw();
            }
            this.canvas.stage.container().style.cursor = 'pointer';
        });

        equipGroup.on('mouseleave', () => {
            if (!this.canvas.selectedObjects.includes(equipGroup)) {
                rect.fill(this.canvas.cssColors.equipmentDefault);
                this.canvas.layers.equipment.batchDraw();
            }
            this.canvas.stage.container().style.cursor = 'default';
        });

        equipGroup.add(rect);
        equipGroup.add(text);

        return equipGroup;
    }

    setupDetachListener(arrayGroup) {
        arrayGroup.on('click', (e) => {
            const target = e.target.getParent();
            
            if (e.evt.shiftKey && target.name() === 'equipment') {
                e.cancelBubble = true;
                
                console.log('[EquipmentArrayTool] Detaching equipment:', target.getAttr('equipmentData'));
                
                this.detachFromGroup(target, arrayGroup);
            }
        });
    }

    detachFromGroup(equipment, arrayGroup) {
        const absPos = equipment.getAbsolutePosition();
        
        equipment.remove();
        this.canvas.layers.equipment.add(equipment);
        equipment.position(absPos);
        equipment.draggable(true);
        
        equipment.on('dragend', () => {
            this.canvas.snapToGrid(equipment);
        });

        equipment.off('click');
        equipment.on('click', (e) => {
            e.cancelBubble = true;
            
            if (e.evt.ctrlKey || e.evt.metaKey) {
                this.canvas.selectMultiple(equipment);
            } else {
                this.canvas.selectObject(equipment, false);
            }
        });

        this.canvas.layers.equipment.batchDraw();
        
        console.log('[EquipmentArrayTool] Equipment detached successfully');
    }

    isToolActive() {
        return this.isActive;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EquipmentArrayTool;
}

if (typeof window !== 'undefined') {
    window.EquipmentArrayTool = EquipmentArrayTool;
}