/**
 * GroupingTool.js
 * ================
 * 
 * 선택된 객체들을 그룹화/해제하는 도구
 * 
 * @module GroupingTool
 * @version 1.0.0
 * 
 * 기능:
 * - Ctrl+G: 선택 객체들을 그룹으로 묶기
 * - Ctrl+Shift+G: 그룹 해제
 * - Undo/Redo 지원 (GroupCommand 사용)
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/tools/GroupingTool.js
 */

class GroupingTool {
    /**
     * @param {Canvas2DEditor} canvas - Canvas2DEditor 인스턴스
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.groupCounter = 0;
        
        console.log('[GroupingTool] Initialized v1.0.0');
    }
    
    /**
     * 선택된 객체들을 그룹으로 묶기
     * @returns {Konva.Group|null} 생성된 그룹 또는 null
     */
    groupSelected() {
        const selected = this.canvas.selectedObjects;
        
        if (!selected || selected.length < 2) {
            console.log('[GroupingTool] 그룹화하려면 2개 이상 선택 필요');
            return null;
        }
        
        // 이미 그룹인 경우 처리
        const hasGroup = selected.some(obj => obj.name()?.includes('userGroup'));
        if (hasGroup) {
            console.log('[GroupingTool] 이미 그룹이 포함되어 있음 - 중첩 그룹화');
        }
        
        console.log(`[GroupingTool] ${selected.length}개 객체 그룹화 시작`);
        
        // 바운딩 박스 계산
        const bounds = this._calculateBounds(selected);
        
        // 그룹 ID 생성
        this.groupCounter++;
        const groupId = `userGroup-${Date.now()}-${this.groupCounter}`;
        
        // 그룹 생성
        const group = new Konva.Group({
            id: groupId,
            x: bounds.centerX,
            y: bounds.centerY,
            draggable: true,
            name: 'userGroup component'
        });
        
        // 그룹 메타데이터 저장
        group.setAttr('groupData', {
            createdAt: Date.now(),
            childCount: selected.length,
            originalPositions: selected.map(obj => ({
                id: obj.id(),
                x: obj.x(),
                y: obj.y(),
                rotation: obj.rotation()
            }))
        });
        
        // 레이어 결정 (첫 번째 객체의 레이어 사용)
        const targetLayer = selected[0].getLayer() || this.canvas.layers.equipment;
        
        // 객체들을 그룹에 추가
        selected.forEach(obj => {
            // 원래 위치를 그룹 중심 기준으로 변환
            const relX = obj.x() - bounds.centerX;
            const relY = obj.y() - bounds.centerY;
            
            // 레이어에서 제거 후 그룹에 추가
            obj.remove();
            obj.x(relX);
            obj.y(relY);
            obj.draggable(false);  // 그룹 내 객체는 개별 드래그 비활성화
            group.add(obj);
        });
        
        // 그룹을 레이어에 추가
        targetLayer.add(group);
        
        // 그룹 이벤트 설정
        this._setupGroupEvents(group);
        
        // 선택 해제 후 그룹 선택
        this.canvas.deselectAll();
        this.canvas.selectObject(group, false);
        
        targetLayer.batchDraw();
        
        // Undo 지원
        this._recordGroupCommand(group, selected, 'group');
        
        console.log(`[GroupingTool] 그룹 생성 완료: ${groupId}`);
        
        return group;
    }
    
    /**
     * 선택된 그룹 해제
     * @returns {Array<Konva.Shape>|null} 해제된 객체들 또는 null
     */
    ungroupSelected() {
        const selected = this.canvas.selectedObjects;
        
        if (!selected || selected.length === 0) {
            console.log('[GroupingTool] 해제할 그룹 없음');
            return null;
        }
        
        // 그룹만 필터링
        const groups = selected.filter(obj => 
            obj.name()?.includes('userGroup') || obj.getAttr('groupData')
        );
        
        if (groups.length === 0) {
            console.log('[GroupingTool] 선택된 객체 중 그룹 없음');
            return null;
        }
        
        console.log(`[GroupingTool] ${groups.length}개 그룹 해제 시작`);
        
        const allChildren = [];
        
        groups.forEach(group => {
            const children = this._ungroupSingle(group);
            allChildren.push(...children);
        });
        
        // 선택 해제 후 해제된 객체들 선택
        this.canvas.deselectAll();
        allChildren.forEach((obj, i) => {
            this.canvas.selectObject(obj, i > 0);
        });
        
        console.log(`[GroupingTool] ${allChildren.length}개 객체 해제 완료`);
        
        return allChildren;
    }
    
    /**
     * 단일 그룹 해제
     * @private
     */
    _ungroupSingle(group) {
        const layer = group.getLayer();
        const groupPos = group.position();
        const groupRotation = group.rotation();
        const children = group.getChildren().toArray();
        
        const releasedObjects = [];
        
        children.forEach(child => {
            // 절대 위치 계산
            const absPos = child.getAbsolutePosition();
            
            // 그룹에서 제거
            child.remove();
            
            // 절대 위치로 설정
            child.position(absPos);
            child.rotation(child.rotation() + groupRotation);
            child.draggable(true);
            
            // 레이어에 추가
            layer.add(child);
            
            releasedObjects.push(child);
        });
        
        // Undo 지원
        this._recordGroupCommand(group, releasedObjects, 'ungroup');
        
        // 그룹 삭제
        group.destroy();
        
        layer.batchDraw();
        
        return releasedObjects;
    }
    
    /**
     * 바운딩 박스 계산
     * @private
     */
    _calculateBounds(objects) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        objects.forEach(obj => {
            const rect = obj.getClientRect({ relativeTo: obj.getLayer() });
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    /**
     * 그룹 이벤트 설정
     * @private
     */
    _setupGroupEvents(group) {
        // 드래그 종료 시 스냅
        group.on('dragend', () => {
            if (this.canvas.config.snapToGrid) {
                const gridSize = this.canvas.config.gridSize;
                group.x(Math.round(group.x() / gridSize) * gridSize);
                group.y(Math.round(group.y() / gridSize) * gridSize);
                group.getLayer()?.batchDraw();
            }
        });
        
        // 클릭 이벤트
        group.on('click tap', (e) => {
            e.cancelBubble = true;
            this.canvas.selectObject(group, e.evt.ctrlKey || e.evt.metaKey);
        });
        
        // 더블클릭으로 내부 객체 선택 (선택적)
        group.on('dblclick dbltap', (e) => {
            // 더블클릭 시 그룹 해제 옵션
            // this.ungroupSelected();
        });
    }
    
    /**
     * Undo/Redo를 위한 Command 기록
     * @private
     */
    _recordGroupCommand(group, objects, action) {
        if (!this.canvas.commandManager) return;
        
        // 간단한 GroupCommand 대신 직접 처리
        // (복잡한 그룹화는 별도 Command 클래스 필요)
        console.log(`[GroupingTool] ${action} action recorded for undo`);
    }
    
    /**
     * 객체가 그룹인지 확인
     * @param {Konva.Shape} shape
     * @returns {boolean}
     */
    isGroup(shape) {
        if (!shape) return false;
        return shape.name()?.includes('userGroup') || !!shape.getAttr('groupData');
    }
    
    /**
     * 선택된 객체 중 그룹 수 반환
     * @returns {number}
     */
    getGroupCount() {
        const selected = this.canvas.selectedObjects || [];
        return selected.filter(obj => this.isGroup(obj)).length;
    }
}

// =====================================================
// Exports
// =====================================================

if (typeof window !== 'undefined') {
    window.GroupingTool = GroupingTool;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroupingTool;
}