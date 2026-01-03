/**
 * AlignmentTool.js
 * ================
 * 
 * 다중 객체 정렬(Align) 및 회전(Rotate) 기능 제공
 * 
 * 주요 기능:
 * 1. 다중 선택된 객체 정렬 (좌, 우, 상, 하, 수평중앙, 수직중앙)
 * 2. 균등 분배 (수평, 수직)
 * 3. 90도 회전 (시계방향, 반시계방향)
 * 4. ✅ Command 패턴 통합 - Undo/Redo 지원 (v5.1.0)
 * 
 * @version 5.1.0 - Tool-Command 통합
 * 위치: frontend/threejs_viewer/src/layout_editor/tools/AlignmentTool.js
 */

class AlignmentTool {
    /**
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2D 에디터 인스턴스
     * @param {CommandManager} commandManager - CommandManager 인스턴스 (선택적)
     */
    constructor(canvas2DEditor, commandManager = null) {
        this.canvas = canvas2DEditor;
        this.commandManager = commandManager;
        
        console.log('[AlignmentTool] 초기화 완료 v5.1.0 (Command 통합)');
    }
    
    /**
     * CommandManager 설정
     * @param {CommandManager} commandManager
     */
    setCommandManager(commandManager) {
        this.commandManager = commandManager;
        console.log('[AlignmentTool] CommandManager 연결됨');
    }
    
    // =====================================================
    // 정렬 기능 (Alignment) - Command 통합
    // =====================================================
    
    /**
     * 선택된 객체들의 경계 상자(Bounding Box) 계산
     * @param {Array} objects - Konva.Shape 배열
     * @returns {Object} { minX, maxX, minY, maxY, centerX, centerY }
     */
    getBoundingBox(objects) {
        if (!objects || objects.length === 0) return null;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        objects.forEach(shape => {
            const rect = shape.getClientRect();
            minX = Math.min(minX, rect.x);
            maxX = Math.max(maxX, rect.x + rect.width);
            minY = Math.min(minY, rect.y);
            maxY = Math.max(maxY, rect.y + rect.height);
        });
        
        return {
            minX, maxX, minY, maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    /**
     * 좌측 정렬 (Command 통합)
     */
    alignLeft() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 2) {
            console.warn('[AlignmentTool] 2개 이상의 객체를 선택하세요');
            return;
        }
        
        const bbox = this.getBoundingBox(objects);
        const commands = [];
        
        objects.forEach(shape => {
            const shapeRect = shape.getClientRect();
            const offsetX = shapeRect.x - shape.x();
            const newX = bbox.minX - offsetX;
            const deltaX = newX - shape.x();
            const deltaY = 0;
            
            if (deltaX !== 0) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
        });
        
        this._executeAlignmentCommands(commands, 'Align Left');
        console.log('[AlignmentTool] 좌측 정렬 완료');
    }
    
    /**
     * 우측 정렬 (Command 통합)
     */
    alignRight() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 2) {
            console.warn('[AlignmentTool] 2개 이상의 객체를 선택하세요');
            return;
        }
        
        const bbox = this.getBoundingBox(objects);
        const commands = [];
        
        objects.forEach(shape => {
            const shapeRect = shape.getClientRect();
            const newX = bbox.maxX - shapeRect.width - (shapeRect.x - shape.x());
            const deltaX = newX - shape.x();
            const deltaY = 0;
            
            if (deltaX !== 0) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
        });
        
        this._executeAlignmentCommands(commands, 'Align Right');
        console.log('[AlignmentTool] 우측 정렬 완료');
    }
    
    /**
     * 상단 정렬 (Command 통합)
     */
    alignTop() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 2) {
            console.warn('[AlignmentTool] 2개 이상의 객체를 선택하세요');
            return;
        }
        
        const bbox = this.getBoundingBox(objects);
        const commands = [];
        
        objects.forEach(shape => {
            const shapeRect = shape.getClientRect();
            const offsetY = shapeRect.y - shape.y();
            const newY = bbox.minY - offsetY;
            const deltaX = 0;
            const deltaY = newY - shape.y();
            
            if (deltaY !== 0) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
        });
        
        this._executeAlignmentCommands(commands, 'Align Top');
        console.log('[AlignmentTool] 상단 정렬 완료');
    }
    
    /**
     * 하단 정렬 (Command 통합)
     */
    alignBottom() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 2) {
            console.warn('[AlignmentTool] 2개 이상의 객체를 선택하세요');
            return;
        }
        
        const bbox = this.getBoundingBox(objects);
        const commands = [];
        
        objects.forEach(shape => {
            const shapeRect = shape.getClientRect();
            const newY = bbox.maxY - shapeRect.height - (shapeRect.y - shape.y());
            const deltaX = 0;
            const deltaY = newY - shape.y();
            
            if (deltaY !== 0) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
        });
        
        this._executeAlignmentCommands(commands, 'Align Bottom');
        console.log('[AlignmentTool] 하단 정렬 완료');
    }
    
    /**
     * 수평 중앙 정렬 (Command 통합)
     */
    alignCenterHorizontal() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 2) {
            console.warn('[AlignmentTool] 2개 이상의 객체를 선택하세요');
            return;
        }
        
        const bbox = this.getBoundingBox(objects);
        const commands = [];
        
        objects.forEach(shape => {
            const shapeRect = shape.getClientRect();
            const shapeCenterX = shapeRect.x + shapeRect.width / 2;
            const offsetX = shapeCenterX - shape.x();
            const newX = bbox.centerX - offsetX;
            const deltaX = newX - shape.x();
            const deltaY = 0;
            
            if (deltaX !== 0) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
        });
        
        this._executeAlignmentCommands(commands, 'Align Center Horizontal');
        console.log('[AlignmentTool] 수평 중앙 정렬 완료');
    }
    
    /**
     * 수직 중앙 정렬 (Command 통합)
     */
    alignCenterVertical() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 2) {
            console.warn('[AlignmentTool] 2개 이상의 객체를 선택하세요');
            return;
        }
        
        const bbox = this.getBoundingBox(objects);
        const commands = [];
        
        objects.forEach(shape => {
            const shapeRect = shape.getClientRect();
            const shapeCenterY = shapeRect.y + shapeRect.height / 2;
            const offsetY = shapeCenterY - shape.y();
            const newY = bbox.centerY - offsetY;
            const deltaX = 0;
            const deltaY = newY - shape.y();
            
            if (deltaY !== 0) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
        });
        
        this._executeAlignmentCommands(commands, 'Align Center Vertical');
        console.log('[AlignmentTool] 수직 중앙 정렬 완료');
    }
    
    // =====================================================
    // 균등 분배 (Distribute) - Command 통합
    // =====================================================
    
    /**
     * 수평 균등 분배 (Command 통합)
     */
    distributeHorizontal() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 3) {
            console.warn('[AlignmentTool] 3개 이상의 객체를 선택하세요');
            return;
        }
        
        // X 좌표 기준 정렬
        const sorted = [...objects].sort((a, b) => {
            return a.getClientRect().x - b.getClientRect().x;
        });
        
        const firstRect = sorted[0].getClientRect();
        const lastRect = sorted[sorted.length - 1].getClientRect();
        
        // 총 객체 너비 계산
        let totalWidth = 0;
        sorted.forEach(shape => {
            totalWidth += shape.getClientRect().width;
        });
        
        // 간격 계산
        const totalSpace = (lastRect.x + lastRect.width) - firstRect.x;
        const gap = (totalSpace - totalWidth) / (sorted.length - 1);
        
        const commands = [];
        let currentX = firstRect.x;
        
        sorted.forEach((shape, index) => {
            if (index === 0) {
                currentX += shape.getClientRect().width + gap;
                return;
            }
            
            const shapeRect = shape.getClientRect();
            const offsetX = shapeRect.x - shape.x();
            const newX = currentX - offsetX;
            const deltaX = newX - shape.x();
            const deltaY = 0;
            
            if (Math.abs(deltaX) > 0.01) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
            
            currentX += shapeRect.width + gap;
        });
        
        this._executeAlignmentCommands(commands, 'Distribute Horizontal');
        console.log('[AlignmentTool] 수평 균등 분배 완료');
    }
    
    /**
     * 수직 균등 분배 (Command 통합)
     */
    distributeVertical() {
        const objects = this.canvas.selectedObjects;
        if (objects.length < 3) {
            console.warn('[AlignmentTool] 3개 이상의 객체를 선택하세요');
            return;
        }
        
        // Y 좌표 기준 정렬
        const sorted = [...objects].sort((a, b) => {
            return a.getClientRect().y - b.getClientRect().y;
        });
        
        const firstRect = sorted[0].getClientRect();
        const lastRect = sorted[sorted.length - 1].getClientRect();
        
        // 총 객체 높이 계산
        let totalHeight = 0;
        sorted.forEach(shape => {
            totalHeight += shape.getClientRect().height;
        });
        
        // 간격 계산
        const totalSpace = (lastRect.y + lastRect.height) - firstRect.y;
        const gap = (totalSpace - totalHeight) / (sorted.length - 1);
        
        const commands = [];
        let currentY = firstRect.y;
        
        sorted.forEach((shape, index) => {
            if (index === 0) {
                currentY += shape.getClientRect().height + gap;
                return;
            }
            
            const shapeRect = shape.getClientRect();
            const offsetY = shapeRect.y - shape.y();
            const newY = currentY - offsetY;
            const deltaX = 0;
            const deltaY = newY - shape.y();
            
            if (Math.abs(deltaY) > 0.01) {
                commands.push(new MoveCommand(shape, deltaX, deltaY));
            }
            
            currentY += shapeRect.height + gap;
        });
        
        this._executeAlignmentCommands(commands, 'Distribute Vertical');
        console.log('[AlignmentTool] 수직 균등 분배 완료');
    }
    
    // =====================================================
    // 정렬 Command 실행 헬퍼
    // =====================================================
    
    /**
     * 정렬 작업의 Command들을 GroupCommand로 묶어서 실행
     * @private
     * @param {Array<MoveCommand>} commands - MoveCommand 배열
     * @param {string} description - 그룹 설명
     */
    _executeAlignmentCommands(commands, description) {
        if (commands.length === 0) {
            console.log(`[AlignmentTool] ${description}: 변경 없음`);
            this.canvas.stage.batchDraw();
            return;
        }
        
        // CommandManager가 있으면 GroupCommand로 실행
        if (this.commandManager) {
            this.commandManager.executeGroup(commands, `${description} (${commands.length} objects)`);
        } else {
            // CommandManager가 없으면 직접 실행 (fallback)
            console.warn('[AlignmentTool] CommandManager 없음 - Undo 불가');
            commands.forEach(cmd => cmd.execute());
            this.canvas.stage.batchDraw();
        }
    }
    
    // =====================================================
    // 회전 기능 (Rotation) - Command 통합
    // =====================================================
    
    /**
     * 선택된 객체들을 90도 시계방향 회전 (Command 통합)
     */
    rotateCW() {
        const objects = this.canvas.selectedObjects;
        if (objects.length === 0) {
            console.warn('[AlignmentTool] 회전할 객체를 선택하세요');
            return;
        }
        
        // RotateCommand 사용
        if (this.commandManager && window.RotateCommand) {
            const commands = objects.map(shape => {
                const oldRotation = shape.rotation() || 0;
                const newRotation = (oldRotation + 90) % 360;
                return new RotateCommand(shape, oldRotation, newRotation);
            });
            
            this.commandManager.executeGroup(commands, `Rotate CW (${objects.length} objects)`);
        } else {
            // Fallback: 직접 회전
            objects.forEach(shape => {
                this.rotateShape(shape, 90);
            });
        }
        
        // 🔥 레이어 명시적 갱신
        if (this.canvas.layers && this.canvas.layers.equipment) {
            this.canvas.layers.equipment.batchDraw();
        }
        if (this.canvas.layers && this.canvas.layers.room) {
            this.canvas.layers.room.batchDraw();
        }
        
        this.canvas.updateTransformer();
        this.canvas.stage.batchDraw();
        console.log('[AlignmentTool] 90° 시계방향 회전 완료');
    }
    
    /**
     * 선택된 객체들을 90도 반시계방향 회전 (Command 통합)
     */
    rotateCCW() {
        const objects = this.canvas.selectedObjects;
        if (objects.length === 0) {
            console.warn('[AlignmentTool] 회전할 객체를 선택하세요');
            return;
        }
        
        // RotateCommand 사용
        if (this.commandManager && window.RotateCommand) {
            const commands = objects.map(shape => {
                const oldRotation = shape.rotation() || 0;
                const newRotation = (oldRotation - 90 + 360) % 360;
                return new RotateCommand(shape, oldRotation, newRotation);
            });
            
            this.commandManager.executeGroup(commands, `Rotate CCW (${objects.length} objects)`);
        } else {
            // Fallback: 직접 회전
            objects.forEach(shape => {
                this.rotateShape(shape, -90);
            });
        }
        
        // 🔥 레이어 명시적 갱신
        if (this.canvas.layers && this.canvas.layers.equipment) {
            this.canvas.layers.equipment.batchDraw();
        }
        if (this.canvas.layers && this.canvas.layers.room) {
            this.canvas.layers.room.batchDraw();
        }
        
        this.canvas.updateTransformer();
        this.canvas.stage.batchDraw();
        console.log('[AlignmentTool] 90° 반시계방향 회전 완료');
    }

    /**
     * 개별 Shape 회전 (중심점 기준)
     * @param {Konva.Shape} shape - 회전할 Shape
     * @param {number} angle - 회전 각도 (양수: 시계방향)
     */
    rotateShape(shape, angle) {
        const currentRotation = shape.rotation() || 0;
        const newRotation = (currentRotation + angle) % 360;
        
        // 중심점 기준 회전을 위해 offset 계산
        const rect = shape.getClientRect();
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Group인 경우
        if (shape.className === 'Group') {
            shape.rotation(newRotation);
            
            // 🔥 Group이 속한 레이어 즉시 갱신
            const layer = shape.getLayer();
            if (layer) {
                layer.batchDraw();
            }
            
            // 방향 화살표도 함께 회전
            const arrow = shape.findOne('.directionArrow');
            if (arrow) {
                // 화살표는 부모 회전에 따라 자동으로 회전됨
            }
        } 
        // Rect인 경우
        else if (shape.className === 'Rect') {
            // offset 설정하여 중심점 기준 회전
            if (!shape.offsetX()) {
                const width = shape.width();
                const height = shape.height();
                shape.offsetX(width / 2);
                shape.offsetY(height / 2);
                shape.x(shape.x() + width / 2);
                shape.y(shape.y() + height / 2);
            }
            shape.rotation(newRotation);
        }
        // Line인 경우 (Wall)
        else if (shape.className === 'Line') {
            // Line은 점 좌표를 직접 회전해야 함
            const points = shape.points();
            const cx = (points[0] + points[2]) / 2;
            const cy = (points[1] + points[3]) / 2;
            
            const rad = (angle * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            const newPoints = [];
            for (let i = 0; i < points.length; i += 2) {
                const px = points[i] - cx;
                const py = points[i + 1] - cy;
                newPoints.push(px * cos - py * sin + cx);
                newPoints.push(px * sin + py * cos + cy);
            }
            
            shape.points(newPoints);
        }
        
        // rotation 속성 저장
        shape.setAttr('currentRotation', newRotation);
        
        console.log(`[AlignmentTool] ${shape.id()} 회전: ${currentRotation}° → ${newRotation}°`);
    }
    
    /**
     * 선택된 객체들의 회전 초기화
     */
    resetRotation() {
        const objects = this.canvas.selectedObjects;
        if (objects.length === 0) return;
        
        // RotateCommand 사용
        if (this.commandManager && window.RotateCommand) {
            const commands = objects.map(shape => {
                const oldRotation = shape.rotation() || 0;
                return new RotateCommand(shape, oldRotation, 0);
            });
            
            if (commands.length > 0) {
                this.commandManager.executeGroup(commands, `Reset Rotation (${objects.length} objects)`);
            }
        } else {
            // Fallback: 직접 초기화
            objects.forEach(shape => {
                shape.rotation(0);
                shape.setAttr('currentRotation', 0);
                
                // offset 제거 (Rect의 경우)
                if (shape.className === 'Rect' && shape.offsetX()) {
                    const width = shape.width();
                    const height = shape.height();
                    shape.x(shape.x() - shape.offsetX());
                    shape.y(shape.y() - shape.offsetY());
                    shape.offsetX(0);
                    shape.offsetY(0);
                }
            });
        }
        
        this.canvas.updateTransformer();
        this.canvas.stage.batchDraw();
        console.log('[AlignmentTool] 회전 초기화 완료');
    }
    
    // =====================================================
    // Utility
    // =====================================================
    
    /**
     * 현재 선택된 객체 수 확인
     * @returns {number}
     */
    getSelectedCount() {
        return this.canvas.selectedObjects.length;
    }
    
    /**
     * 정렬/회전 가능 여부 확인
     * @param {string} action - 'align' | 'distribute' | 'rotate'
     * @returns {boolean}
     */
    canPerform(action) {
        const count = this.getSelectedCount();
        
        switch (action) {
            case 'align':
                return count >= 2;
            case 'distribute':
                return count >= 3;
            case 'rotate':
                return count >= 1;
            default:
                return false;
        }
    }
    
    /**
     * 통합 정렬 메서드
     * @param {string} type - 정렬 타입 ('left', 'right', 'top', 'bottom', 'centerH', 'centerV')
     */
    align(type) {
        switch (type) {
            case 'left':
                this.alignLeft();
                break;
            case 'right':
                this.alignRight();
                break;
            case 'top':
                this.alignTop();
                break;
            case 'bottom':
                this.alignBottom();
                break;
            case 'centerH':
            case 'centerHorizontal':
                this.alignCenterHorizontal();
                break;
            case 'centerV':
            case 'centerVertical':
                this.alignCenterVertical();
                break;
            default:
                console.warn(`[AlignmentTool] 알 수 없는 정렬 타입: ${type}`);
        }
    }
    
    /**
     * 통합 분배 메서드
     * @param {string} type - 분배 타입 ('horizontal', 'vertical')
     */
    distribute(type) {
        switch (type) {
            case 'horizontal':
            case 'h':
                this.distributeHorizontal();
                break;
            case 'vertical':
            case 'v':
                this.distributeVertical();
                break;
            default:
                console.warn(`[AlignmentTool] 알 수 없는 분배 타입: ${type}`);
        }
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined') {
    window.AlignmentTool = AlignmentTool;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlignmentTool;
}