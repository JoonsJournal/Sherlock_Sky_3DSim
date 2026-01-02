/**
 * Command.js
 * ============
 * 
 * Command Pattern 기본 클래스 및 구체적인 Command 구현
 * 
 * @version 1.0.0 - Phase 1.5
 * @module Command
 * 
 * 역할:
 * 1. 기본 Command 인터페이스 정의
 * 2. 이동, 크기 조절, 회전 등 구체적 Command
 * 3. 그룹 Command (여러 Command 묶음)
 * 4. Command 병합 (같은 타입 연속 실행)
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/commands/Command.js
 */

// =====================================================
// 기본 Command 클래스
// =====================================================

/**
 * 모든 Command의 기본 클래스
 * @abstract
 */
class Command {
    /**
     * @param {string} type - Command 타입
     * @param {string} description - 설명 (Undo/Redo UI 표시용)
     */
    constructor(type, description = '') {
        this.type = type;
        this.description = description;
        this.timestamp = Date.now();
        this.executed = false;
    }
    
    /**
     * Command 실행
     * @abstract
     */
    execute() {
        throw new Error('execute() must be implemented');
    }
    
    /**
     * Command 취소 (Undo)
     * @abstract
     */
    undo() {
        throw new Error('undo() must be implemented');
    }
    
    /**
     * Command 다시 실행 (Redo) - 기본적으로 execute와 동일
     */
    redo() {
        this.execute();
    }
    
    /**
     * 다른 Command와 병합 가능 여부
     * @param {Command} other
     * @returns {boolean}
     */
    canMergeWith(other) {
        return false;
    }
    
    /**
     * 다른 Command와 병합
     * @param {Command} other
     * @returns {Command} 병합된 Command
     */
    mergeWith(other) {
        return this;
    }
    
    /**
     * Command 정보 반환
     * @returns {Object}
     */
    toJSON() {
        return {
            type: this.type,
            description: this.description,
            timestamp: this.timestamp,
            executed: this.executed
        };
    }
}

// =====================================================
// MoveCommand - 이동 명령
// =====================================================

/**
 * 객체 이동 Command
 */
class MoveCommand extends Command {
    /**
     * @param {Konva.Shape|Array<Konva.Shape>} targets - 대상 객체(들)
     * @param {number} deltaX - X 이동량
     * @param {number} deltaY - Y 이동량
     */
    constructor(targets, deltaX, deltaY) {
        const targetArray = Array.isArray(targets) ? targets : [targets];
        const desc = targetArray.length === 1 
            ? `Move ${targetArray[0].id() || 'object'}`
            : `Move ${targetArray.length} objects`;
        
        super('move', desc);
        
        this.targets = targetArray;
        this.deltaX = deltaX;
        this.deltaY = deltaY;
        
        // 원래 위치 저장
        this.originalPositions = this.targets.map(t => ({
            id: t.id(),
            x: t.x(),
            y: t.y()
        }));
    }
    
    execute() {
        this.targets.forEach(target => {
            target.x(target.x() + this.deltaX);
            target.y(target.y() + this.deltaY);
        });
        
        this._redraw();
        this.executed = true;
    }
    
    undo() {
        this.targets.forEach((target, index) => {
            const original = this.originalPositions[index];
            target.x(original.x);
            target.y(original.y);
        });
        
        this._redraw();
        this.executed = false;
    }
    
    canMergeWith(other) {
        if (!(other instanceof MoveCommand)) return false;
        if (other.targets.length !== this.targets.length) return false;
        
        // 같은 대상들인지 확인
        const sameTargets = this.targets.every((t, i) => 
            t.id() === other.targets[i].id()
        );
        
        // 300ms 이내의 연속 이동만 병합
        const timeDiff = other.timestamp - this.timestamp;
        
        return sameTargets && timeDiff < 300;
    }
    
    mergeWith(other) {
        return new MoveCommand(
            this.targets,
            this.deltaX + other.deltaX,
            this.deltaY + other.deltaY
        );
    }
    
    _redraw() {
        if (this.targets.length > 0 && this.targets[0].getLayer()) {
            this.targets[0].getLayer().batchDraw();
        }
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            targetIds: this.targets.map(t => t.id()),
            deltaX: this.deltaX,
            deltaY: this.deltaY,
            originalPositions: this.originalPositions
        };
    }
}

// =====================================================
// ResizeCommand - 크기 조절 명령
// =====================================================

/**
 * 객체 크기 조절 Command
 */
class ResizeCommand extends Command {
    /**
     * @param {Konva.Shape} target - 대상 객체
     * @param {Object} oldSize - { width, height, x, y, scaleX, scaleY }
     * @param {Object} newSize - { width, height, x, y, scaleX, scaleY }
     */
    constructor(target, oldSize, newSize) {
        super('resize', `Resize ${target.id() || 'object'}`);
        
        this.target = target;
        this.oldSize = { ...oldSize };
        this.newSize = { ...newSize };
    }
    
    execute() {
        this._applySize(this.newSize);
        this.executed = true;
    }
    
    undo() {
        this._applySize(this.oldSize);
        this.executed = false;
    }
    
    _applySize(size) {
        if (size.x !== undefined) this.target.x(size.x);
        if (size.y !== undefined) this.target.y(size.y);
        if (size.width !== undefined) this.target.width(size.width);
        if (size.height !== undefined) this.target.height(size.height);
        if (size.scaleX !== undefined) this.target.scaleX(size.scaleX);
        if (size.scaleY !== undefined) this.target.scaleY(size.scaleY);
        
        this._redraw();
    }
    
    _redraw() {
        if (this.target.getLayer()) {
            this.target.getLayer().batchDraw();
        }
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            targetId: this.target.id(),
            oldSize: this.oldSize,
            newSize: this.newSize
        };
    }
}

// =====================================================
// RotateCommand - 회전 명령
// =====================================================

/**
 * 객체 회전 Command
 */
class RotateCommand extends Command {
    /**
     * @param {Konva.Shape|Array<Konva.Shape>} targets - 대상 객체(들)
     * @param {number} oldRotation - 이전 각도
     * @param {number} newRotation - 새 각도
     */
    constructor(targets, oldRotation, newRotation) {
        const targetArray = Array.isArray(targets) ? targets : [targets];
        const desc = targetArray.length === 1 
            ? `Rotate ${targetArray[0].id() || 'object'}`
            : `Rotate ${targetArray.length} objects`;
        
        super('rotate', desc);
        
        this.targets = targetArray;
        this.oldRotation = oldRotation;
        this.newRotation = newRotation;
        
        // 개별 원래 회전값 저장
        this.originalRotations = this.targets.map(t => ({
            id: t.id(),
            rotation: t.rotation()
        }));
    }
    
    execute() {
        const delta = this.newRotation - this.oldRotation;
        
        this.targets.forEach(target => {
            target.rotation(target.rotation() + delta);
        });
        
        this._redraw();
        this.executed = true;
    }
    
    undo() {
        this.targets.forEach((target, index) => {
            target.rotation(this.originalRotations[index].rotation);
        });
        
        this._redraw();
        this.executed = false;
    }
    
    _redraw() {
        if (this.targets.length > 0 && this.targets[0].getLayer()) {
            this.targets[0].getLayer().batchDraw();
        }
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            targetIds: this.targets.map(t => t.id()),
            oldRotation: this.oldRotation,
            newRotation: this.newRotation
        };
    }
}

// =====================================================
// CreateCommand - 객체 생성 명령
// =====================================================

/**
 * 객체 생성 Command
 */
class CreateCommand extends Command {
    /**
     * @param {Konva.Shape} shape - 생성할 객체
     * @param {Konva.Layer} layer - 추가할 레이어
     */
    constructor(shape, layer) {
        super('create', `Create ${shape.className || 'object'}`);
        
        this.shape = shape;
        this.layer = layer;
        this.shapeId = shape.id();
    }
    
    execute() {
        this.layer.add(this.shape);
        this.layer.batchDraw();
        this.executed = true;
    }
    
    undo() {
        this.shape.remove();
        this.layer.batchDraw();
        this.executed = false;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            shapeId: this.shapeId,
            shapeType: this.shape.className
        };
    }
}

// =====================================================
// DeleteCommand - 객체 삭제 명령
// =====================================================

/**
 * 객체 삭제 Command
 */
class DeleteCommand extends Command {
    /**
     * @param {Konva.Shape|Array<Konva.Shape>} shapes - 삭제할 객체(들)
     */
    constructor(shapes) {
        const shapeArray = Array.isArray(shapes) ? shapes : [shapes];
        const desc = shapeArray.length === 1 
            ? `Delete ${shapeArray[0].id() || 'object'}`
            : `Delete ${shapeArray.length} objects`;
        
        super('delete', desc);
        
        this.shapes = shapeArray;
        
        // 레이어 및 인덱스 저장
        this.shapeData = this.shapes.map(shape => ({
            shape: shape,
            layer: shape.getLayer(),
            index: shape.getZIndex(),
            parent: shape.getParent()
        }));
    }
    
    execute() {
        this.shapes.forEach(shape => {
            shape.remove();
        });
        
        this._redraw();
        this.executed = true;
    }
    
    undo() {
        this.shapeData.forEach(data => {
            if (data.parent) {
                data.parent.add(data.shape);
                data.shape.setZIndex(data.index);
            }
        });
        
        this._redraw();
        this.executed = false;
    }
    
    _redraw() {
        const layers = new Set(this.shapeData.map(d => d.layer).filter(l => l));
        layers.forEach(layer => layer.batchDraw());
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            shapeIds: this.shapes.map(s => s.id())
        };
    }
}

// =====================================================
// PropertyChangeCommand - 속성 변경 명령
// =====================================================

/**
 * 객체 속성 변경 Command
 */
class PropertyChangeCommand extends Command {
    /**
     * @param {Konva.Shape} target - 대상 객체
     * @param {string} property - 속성 이름
     * @param {*} oldValue - 이전 값
     * @param {*} newValue - 새 값
     */
    constructor(target, property, oldValue, newValue) {
        super('property', `Change ${property} of ${target.id() || 'object'}`);
        
        this.target = target;
        this.property = property;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }
    
    execute() {
        this._setValue(this.newValue);
        this.executed = true;
    }
    
    undo() {
        this._setValue(this.oldValue);
        this.executed = false;
    }
    
    _setValue(value) {
        // Konva 속성 설정
        if (typeof this.target[this.property] === 'function') {
            this.target[this.property](value);
        } else {
            this.target.setAttr(this.property, value);
        }
        
        if (this.target.getLayer()) {
            this.target.getLayer().batchDraw();
        }
    }
    
    canMergeWith(other) {
        if (!(other instanceof PropertyChangeCommand)) return false;
        if (other.target !== this.target) return false;
        if (other.property !== this.property) return false;
        
        const timeDiff = other.timestamp - this.timestamp;
        return timeDiff < 300;
    }
    
    mergeWith(other) {
        return new PropertyChangeCommand(
            this.target,
            this.property,
            this.oldValue,  // 원래 값 유지
            other.newValue  // 최종 값 사용
        );
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            targetId: this.target.id(),
            property: this.property,
            oldValue: this.oldValue,
            newValue: this.newValue
        };
    }
}

// =====================================================
// MultiPropertyChangeCommand - 다중 속성 변경 명령
// =====================================================

/**
 * 여러 속성 동시 변경 Command
 */
class MultiPropertyChangeCommand extends Command {
    /**
     * @param {Konva.Shape} target - 대상 객체
     * @param {Object} oldProps - 이전 속성들 { prop1: value1, ... }
     * @param {Object} newProps - 새 속성들 { prop1: value1, ... }
     */
    constructor(target, oldProps, newProps) {
        super('multiProperty', `Change properties of ${target.id() || 'object'}`);
        
        this.target = target;
        this.oldProps = { ...oldProps };
        this.newProps = { ...newProps };
    }
    
    execute() {
        this._applyProps(this.newProps);
        this.executed = true;
    }
    
    undo() {
        this._applyProps(this.oldProps);
        this.executed = false;
    }
    
    _applyProps(props) {
        Object.entries(props).forEach(([key, value]) => {
            if (typeof this.target[key] === 'function') {
                this.target[key](value);
            } else {
                this.target.setAttr(key, value);
            }
        });
        
        if (this.target.getLayer()) {
            this.target.getLayer().batchDraw();
        }
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            targetId: this.target.id(),
            oldProps: this.oldProps,
            newProps: this.newProps
        };
    }
}

// =====================================================
// GroupCommand - 여러 Command 묶음
// =====================================================

/**
 * 여러 Command를 하나로 묶는 Group Command
 */
class GroupCommand extends Command {
    /**
     * @param {Array<Command>} commands - Command 배열
     * @param {string} description - 그룹 설명
     */
    constructor(commands, description = 'Group action') {
        super('group', description);
        
        this.commands = commands || [];
    }
    
    /**
     * Command 추가
     * @param {Command} command
     */
    add(command) {
        this.commands.push(command);
    }
    
    execute() {
        this.commands.forEach(cmd => cmd.execute());
        this.executed = true;
    }
    
    undo() {
        // 역순으로 Undo
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
        this.executed = false;
    }
    
    redo() {
        this.commands.forEach(cmd => cmd.redo());
        this.executed = true;
    }
    
    /**
     * 비어있는지 확인
     * @returns {boolean}
     */
    isEmpty() {
        return this.commands.length === 0;
    }
    
    /**
     * Command 개수
     * @returns {number}
     */
    size() {
        return this.commands.length;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            commands: this.commands.map(cmd => cmd.toJSON())
        };
    }
}

// =====================================================
// ZIndexCommand - Z순서 변경 명령
// =====================================================

/**
 * Z 순서 변경 Command
 */
class ZIndexCommand extends Command {
    /**
     * @param {Konva.Shape} target - 대상 객체
     * @param {string} action - 'up', 'down', 'toTop', 'toBottom'
     */
    constructor(target, action) {
        super('zIndex', `${action} ${target.id() || 'object'}`);
        
        this.target = target;
        this.action = action;
        this.oldZIndex = target.getZIndex();
    }
    
    execute() {
        switch (this.action) {
            case 'up':
                this.target.moveUp();
                break;
            case 'down':
                this.target.moveDown();
                break;
            case 'toTop':
                this.target.moveToTop();
                break;
            case 'toBottom':
                this.target.moveToBottom();
                break;
        }
        
        this.newZIndex = this.target.getZIndex();
        this._redraw();
        this.executed = true;
    }
    
    undo() {
        this.target.setZIndex(this.oldZIndex);
        this._redraw();
        this.executed = false;
    }
    
    _redraw() {
        if (this.target.getLayer()) {
            this.target.getLayer().batchDraw();
        }
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            targetId: this.target.id(),
            action: this.action,
            oldZIndex: this.oldZIndex,
            newZIndex: this.newZIndex
        };
    }
}

// =====================================================
// Exports
// =====================================================

// ✅ ES6 모듈 export
if (typeof module === 'undefined') {
    window.Command = Command;
    window.MoveCommand = MoveCommand;
    window.ResizeCommand = ResizeCommand;
    window.RotateCommand = RotateCommand;
    window.CreateCommand = CreateCommand;
    window.DeleteCommand = DeleteCommand;
    window.PropertyChangeCommand = PropertyChangeCommand;
    window.MultiPropertyChangeCommand = MultiPropertyChangeCommand;
    window.GroupCommand = GroupCommand;
    window.ZIndexCommand = ZIndexCommand;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Command,
        MoveCommand,
        ResizeCommand,
        RotateCommand,
        CreateCommand,
        DeleteCommand,
        PropertyChangeCommand,
        MultiPropertyChangeCommand,
        GroupCommand,
        ZIndexCommand
    };
}

export {
    Command,
    MoveCommand,
    ResizeCommand,
    RotateCommand,
    CreateCommand,
    DeleteCommand,
    PropertyChangeCommand,
    MultiPropertyChangeCommand,
    GroupCommand,
    ZIndexCommand
};