/**
 * Selection2DManager.js
 * ======================
 * 
 * 2D Canvas의 선택 상태를 관리하는 핵심 모듈
 * 
 * @version 1.0.0 - Phase 1.5
 * @module Selection2DManager
 * 
 * 역할:
 * 1. 선택된 객체 배열 관리
 * 2. 단일/다중 선택 로직
 * 3. 선택 상태 변경 이벤트 발행
 * 4. 선택 필터링 (타입별, 레이어별)
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/selection/Selection2DManager.js
 */

class Selection2DManager {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Function} options.onSelectionChange - 선택 변경 콜백
     * @param {Function} options.onSelect - 객체 선택 콜백
     * @param {Function} options.onDeselect - 객체 선택 해제 콜백
     */
    constructor(options = {}) {
        // 선택된 객체 배열
        this.selectedObjects = [];
        
        // 콜백 함수
        this.callbacks = {
            onSelectionChange: options.onSelectionChange || null,
            onSelect: options.onSelect || null,
            onDeselect: options.onDeselect || null
        };
        
        // 선택 히스토리 (Undo/Redo용)
        this.selectionHistory = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // 선택 잠금 (특정 작업 중 선택 방지)
        this.isLocked = false;
        
        console.log('[Selection2DManager] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // 기본 선택 작업
    // =====================================================
    
    /**
     * 객체 선택
     * @param {Konva.Shape|Konva.Group} shape - 선택할 Shape
     * @param {boolean} multiSelect - 다중 선택 여부 (true: 추가, false: 대체)
     * @returns {boolean} 선택 성공 여부
     */
    selectObject(shape, multiSelect = false) {
        if (this.isLocked) {
            console.log('[Selection2DManager] 선택 잠금 상태');
            return false;
        }
        
        if (!shape) {
            console.warn('[Selection2DManager] shape가 null입니다');
            return false;
        }
        
        // 이미 선택된 경우
        if (this.isSelected(shape)) {
            console.log('[Selection2DManager] 이미 선택됨:', shape.id());
            return false;
        }
        
        // 다중 선택이 아니면 기존 선택 해제
        if (!multiSelect) {
            this.deselectAll(false); // 이벤트 발행 안함
        }
        
        // 선택 배열에 추가
        this.selectedObjects.push(shape);
        
        // 콜백 호출
        if (this.callbacks.onSelect) {
            this.callbacks.onSelect(shape);
        }
        
        // 선택 변경 이벤트
        this._emitSelectionChange();
        
        // 히스토리 저장
        this._saveToHistory();
        
        console.log(`[Selection2DManager] 선택: ${shape.id()}, 총 ${this.selectedObjects.length}개`);
        return true;
    }
    
    /**
     * 다중 객체 선택 (배열)
     * @param {Array<Konva.Shape>} shapes - 선택할 Shape 배열
     * @param {boolean} addToExisting - 기존 선택에 추가 여부
     * @returns {number} 선택된 객체 수
     */
    selectObjects(shapes, addToExisting = false) {
        if (this.isLocked) return 0;
        
        if (!addToExisting) {
            this.deselectAll(false);
        }
        
        let count = 0;
        shapes.forEach(shape => {
            if (shape && !this.isSelected(shape)) {
                this.selectedObjects.push(shape);
                
                if (this.callbacks.onSelect) {
                    this.callbacks.onSelect(shape);
                }
                count++;
            }
        });
        
        if (count > 0) {
            this._emitSelectionChange();
            this._saveToHistory();
        }
        
        console.log(`[Selection2DManager] ${count}개 선택, 총 ${this.selectedObjects.length}개`);
        return count;
    }
    
    /**
     * 객체 선택 해제
     * @param {Konva.Shape|Konva.Group} shape - 선택 해제할 Shape
     * @returns {boolean} 해제 성공 여부
     */
    deselectObject(shape) {
        if (this.isLocked) return false;
        
        const index = this.selectedObjects.indexOf(shape);
        if (index === -1) {
            return false;
        }
        
        // 배열에서 제거
        this.selectedObjects.splice(index, 1);
        
        // 콜백 호출
        if (this.callbacks.onDeselect) {
            this.callbacks.onDeselect(shape);
        }
        
        // 선택 변경 이벤트
        this._emitSelectionChange();
        
        // 히스토리 저장
        this._saveToHistory();
        
        console.log(`[Selection2DManager] 선택 해제: ${shape.id()}, 남은 ${this.selectedObjects.length}개`);
        return true;
    }
    
    /**
     * 전체 선택 해제
     * @param {boolean} emitEvent - 이벤트 발행 여부
     * @returns {number} 해제된 객체 수
     */
    deselectAll(emitEvent = true) {
        if (this.isLocked) return 0;
        
        const count = this.selectedObjects.length;
        
        if (count === 0) {
            return 0;
        }
        
        // 각 객체에 대해 해제 콜백 호출
        if (this.callbacks.onDeselect) {
            this.selectedObjects.forEach(shape => {
                this.callbacks.onDeselect(shape);
            });
        }
        
        // 배열 초기화
        this.selectedObjects = [];
        
        // 이벤트 발행
        if (emitEvent) {
            this._emitSelectionChange();
            this._saveToHistory();
        }
        
        console.log(`[Selection2DManager] 전체 선택 해제: ${count}개`);
        return count;
    }
    
    /**
     * 선택 토글 (선택 ↔ 해제)
     * @param {Konva.Shape} shape - 토글할 Shape
     * @returns {boolean} 토글 후 선택 상태 (true: 선택됨)
     */
    toggleSelection(shape) {
        if (this.isSelected(shape)) {
            this.deselectObject(shape);
            return false;
        } else {
            this.selectObject(shape, true);
            return true;
        }
    }
    
    // =====================================================
    // 전체 선택
    // =====================================================
    
    /**
     * 레이어의 모든 객체 선택
     * @param {Konva.Layer} layer - 대상 레이어
     * @param {string} nameFilter - Shape name 필터 (예: 'equipment')
     * @returns {number} 선택된 객체 수
     */
    selectAllInLayer(layer, nameFilter = null) {
        if (this.isLocked || !layer) return 0;
        
        this.deselectAll(false);
        
        let shapes;
        if (nameFilter) {
            shapes = layer.find(`.${nameFilter}`);
        } else {
            shapes = layer.getChildren();
        }
        
        let count = 0;
        shapes.forEach(shape => {
            if (shape.draggable && shape.draggable()) {
                this.selectedObjects.push(shape);
                
                if (this.callbacks.onSelect) {
                    this.callbacks.onSelect(shape);
                }
                count++;
            }
        });
        
        if (count > 0) {
            this._emitSelectionChange();
            this._saveToHistory();
        }
        
        console.log(`[Selection2DManager] 레이어 전체 선택: ${count}개`);
        return count;
    }
    
    /**
     * 여러 레이어에서 모든 객체 선택
     * @param {Array<Konva.Layer>} layers - 레이어 배열
     * @param {Array<string>} nameFilters - name 필터 배열
     * @returns {number} 선택된 객체 수
     */
    selectAllInLayers(layers, nameFilters = []) {
        if (this.isLocked) return 0;
        
        this.deselectAll(false);
        
        let count = 0;
        
        layers.forEach(layer => {
            if (!layer) return;
            
            let selector = nameFilters.length > 0 
                ? nameFilters.map(n => `.${n}`).join(', ')
                : null;
            
            const shapes = selector ? layer.find(selector) : layer.getChildren();
            
            shapes.forEach(shape => {
                if (shape.draggable && shape.draggable()) {
                    this.selectedObjects.push(shape);
                    
                    if (this.callbacks.onSelect) {
                        this.callbacks.onSelect(shape);
                    }
                    count++;
                }
            });
        });
        
        if (count > 0) {
            this._emitSelectionChange();
            this._saveToHistory();
        }
        
        console.log(`[Selection2DManager] 전체 선택: ${count}개`);
        return count;
    }
    
    // =====================================================
    // 선택 상태 조회
    // =====================================================
    
    /**
     * 객체가 선택되었는지 확인
     * @param {Konva.Shape} shape - 확인할 Shape
     * @returns {boolean}
     */
    isSelected(shape) {
        return this.selectedObjects.includes(shape);
    }
    
    /**
     * 선택된 객체 배열 반환
     * @returns {Array<Konva.Shape>}
     */
    getSelectedObjects() {
        return [...this.selectedObjects];
    }
    
    /**
     * 선택된 객체 수
     * @returns {number}
     */
    getSelectedCount() {
        return this.selectedObjects.length;
    }
    
    /**
     * 선택된 객체가 있는지 확인
     * @returns {boolean}
     */
    hasSelection() {
        return this.selectedObjects.length > 0;
    }
    
    /**
     * 단일 선택인지 확인
     * @returns {boolean}
     */
    isSingleSelection() {
        return this.selectedObjects.length === 1;
    }
    
    /**
     * 다중 선택인지 확인
     * @returns {boolean}
     */
    isMultiSelection() {
        return this.selectedObjects.length > 1;
    }
    
    /**
     * 첫 번째 선택된 객체 반환
     * @returns {Konva.Shape|null}
     */
    getFirstSelected() {
        return this.selectedObjects[0] || null;
    }
    
    /**
     * 마지막 선택된 객체 반환
     * @returns {Konva.Shape|null}
     */
    getLastSelected() {
        return this.selectedObjects[this.selectedObjects.length - 1] || null;
    }
    
    // =====================================================
    // 선택 필터링
    // =====================================================
    
    /**
     * 타입별 선택된 객체 필터
     * @param {string} typeName - Shape name (예: 'equipment', 'wall')
     * @returns {Array<Konva.Shape>}
     */
    getSelectedByType(typeName) {
        return this.selectedObjects.filter(shape => {
            const name = shape.name();
            return name && name.includes(typeName);
        });
    }
    
    /**
     * 클래스별 선택된 객체 필터
     * @param {string} className - Konva 클래스명 (예: 'Group', 'Rect', 'Line')
     * @returns {Array<Konva.Shape>}
     */
    getSelectedByClass(className) {
        return this.selectedObjects.filter(shape => shape.className === className);
    }
    
    /**
     * 선택된 Equipment만 반환
     * @returns {Array<Konva.Shape>}
     */
    getSelectedEquipments() {
        return this.getSelectedByType('equipment');
    }
    
    /**
     * 선택된 Wall만 반환
     * @returns {Array<Konva.Shape>}
     */
    getSelectedWalls() {
        return this.getSelectedByType('wall');
    }
    
    /**
     * 선택된 객체의 ID 배열 반환
     * @returns {Array<string>}
     */
    getSelectedIds() {
        return this.selectedObjects.map(shape => shape.id()).filter(id => id);
    }
    
    /**
     * 선택된 객체의 Bounding Box 계산
     * @returns {Object|null} { x, y, width, height, minX, maxX, minY, maxY }
     */
    getSelectionBounds() {
        if (this.selectedObjects.length === 0) {
            return null;
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        this.selectedObjects.forEach(shape => {
            const rect = shape.getClientRect();
            minX = Math.min(minX, rect.x);
            maxX = Math.max(maxX, rect.x + rect.width);
            minY = Math.min(minY, rect.y);
            maxY = Math.max(maxY, rect.y + rect.height);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            minX, maxX, minY, maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    // =====================================================
    // 선택 잠금
    // =====================================================
    
    /**
     * 선택 잠금
     */
    lock() {
        this.isLocked = true;
        console.log('[Selection2DManager] 선택 잠금');
    }
    
    /**
     * 선택 잠금 해제
     */
    unlock() {
        this.isLocked = false;
        console.log('[Selection2DManager] 선택 잠금 해제');
    }
    
    /**
     * 잠금 상태 확인
     * @returns {boolean}
     */
    isSelectionLocked() {
        return this.isLocked;
    }
    
    // =====================================================
    // 히스토리 (Undo/Redo)
    // =====================================================
    
    /**
     * 현재 선택 상태를 히스토리에 저장
     * @private
     */
    _saveToHistory() {
        // 현재 위치 이후의 히스토리 삭제
        this.selectionHistory = this.selectionHistory.slice(0, this.historyIndex + 1);
        
        // 현재 선택 상태 저장 (ID 배열로)
        const snapshot = this.selectedObjects.map(shape => shape.id()).filter(id => id);
        this.selectionHistory.push(snapshot);
        
        // 최대 크기 제한
        if (this.selectionHistory.length > this.maxHistorySize) {
            this.selectionHistory.shift();
        } else {
            this.historyIndex++;
        }
    }
    
    /**
     * 선택 히스토리 Undo
     * @param {Function} findShapeById - ID로 Shape 찾는 함수
     * @returns {boolean}
     */
    undoSelection(findShapeById) {
        if (this.historyIndex <= 0) {
            return false;
        }
        
        this.historyIndex--;
        const snapshot = this.selectionHistory[this.historyIndex];
        
        this._restoreFromSnapshot(snapshot, findShapeById);
        return true;
    }
    
    /**
     * 선택 히스토리 Redo
     * @param {Function} findShapeById - ID로 Shape 찾는 함수
     * @returns {boolean}
     */
    redoSelection(findShapeById) {
        if (this.historyIndex >= this.selectionHistory.length - 1) {
            return false;
        }
        
        this.historyIndex++;
        const snapshot = this.selectionHistory[this.historyIndex];
        
        this._restoreFromSnapshot(snapshot, findShapeById);
        return true;
    }
    
    /**
     * 스냅샷에서 선택 복원
     * @private
     */
    _restoreFromSnapshot(snapshot, findShapeById) {
        this.deselectAll(false);
        
        snapshot.forEach(id => {
            const shape = findShapeById(id);
            if (shape) {
                this.selectedObjects.push(shape);
                if (this.callbacks.onSelect) {
                    this.callbacks.onSelect(shape);
                }
            }
        });
        
        this._emitSelectionChange();
    }
    
    // =====================================================
    // 이벤트 & 콜백
    // =====================================================
    
    /**
     * 선택 변경 이벤트 발행
     * @private
     */
    _emitSelectionChange() {
        if (this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange(this.selectedObjects, {
                count: this.selectedObjects.length,
                bounds: this.getSelectionBounds(),
                ids: this.getSelectedIds()
            });
        }
    }
    
    /**
     * 콜백 설정
     * @param {string} name - 콜백 이름
     * @param {Function} callback - 콜백 함수
     */
    setCallback(name, callback) {
        if (this.callbacks.hasOwnProperty(name)) {
            this.callbacks[name] = callback;
        }
    }
    
    /**
     * 콜백 제거
     * @param {string} name - 콜백 이름
     */
    removeCallback(name) {
        if (this.callbacks.hasOwnProperty(name)) {
            this.callbacks[name] = null;
        }
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 초기화
     */
    clear() {
        this.deselectAll(false);
        this.selectionHistory = [];
        this.historyIndex = -1;
        this.isLocked = false;
        console.log('[Selection2DManager] 초기화');
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.callbacks = {
            onSelectionChange: null,
            onSelect: null,
            onDeselect: null
        };
        console.log('[Selection2DManager] 파괴 완료');
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.Selection2DManager = Selection2DManager;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Selection2DManager;
}

