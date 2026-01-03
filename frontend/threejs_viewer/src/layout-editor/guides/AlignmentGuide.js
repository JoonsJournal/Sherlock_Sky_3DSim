/**
 * AlignmentGuide.js v1.1.0
 * =========================
 * 
 * 객체 정렬 및 분배 기능을 제공하는 모듈
 * 
 * ✨ v1.1.0 수정:
 * - ✅ Stage 좌표계 사용으로 변경 (_getStageRect)
 * - ✅ Zoom 레벨 고려한 좌표 계산
 * - ✅ 정렬/분배 시 올바른 좌표계 사용
 * 
 * @version 1.1.0 - Phase 5.1
 * @module AlignmentGuide
 * 
 * 역할:
 * 1. 다중 선택 객체 정렬 (좌/우/상/하/중앙)
 * 2. 균등 분배 (수평/수직)
 * 3. 정렬 미리보기
 * 4. 정렬 애니메이션
 * 5. 회전 정렬
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/guides/AlignmentGuide.js
 */

class AlignmentGuide {
    /**
     * @param {Konva.Stage} stage - Konva Stage
     * @param {Konva.Layer} uiLayer - UI 레이어 (미리보기용)
     * @param {Object} options - 옵션
     */
    constructor(stage, uiLayer, options = {}) {
        this.stage = stage;
        this.uiLayer = uiLayer;
        
        // 설정
        this.config = {
            // 애니메이션
            animationEnabled: options.animationEnabled !== false,
            animationDuration: options.animationDuration || 200,
            
            // 미리보기
            previewEnabled: options.previewEnabled || false,
            previewColor: options.previewColor || 'rgba(102, 126, 234, 0.3)',
            previewStroke: options.previewStroke || '#667eea',
            
            // 스냅
            snapAfterAlign: options.snapAfterAlign || false,
            gridSize: options.gridSize || 10
        };
        
        // 미리보기 요소
        this.previewShapes = [];
        
        // 콜백
        this.callbacks = {
            onAlignStart: options.onAlignStart || null,
            onAlignEnd: options.onAlignEnd || null,
            onDistributeStart: options.onDistributeStart || null,
            onDistributeEnd: options.onDistributeEnd || null
        };
        
        console.log('[AlignmentGuide] 초기화 완료 v1.1.0');
    }
    
    // =====================================================
    // ✨ v1.1.0: Stage 좌표계 변환
    // =====================================================
    
    /**
     * ✨ v1.1.0: Shape의 Stage 좌표계 Rect 반환
     * @param {Konva.Shape} shape
     * @returns {Object} { x, y, width, height }
     */
    _getStageRect(shape) {
        if (!shape) return null;
        
        // Group인 경우
        if (shape.nodeType === 'Group') {
            const clientRect = shape.getClientRect({ skipTransform: false });
            const zoom = this.stage?.scaleX() || 1;
            const stagePos = this.stage?.position() || { x: 0, y: 0 };
            
            return {
                x: (clientRect.x - stagePos.x) / zoom,
                y: (clientRect.y - stagePos.y) / zoom,
                width: clientRect.width / zoom,
                height: clientRect.height / zoom
            };
        }
        
        // 단일 Shape
        const size = shape.size ? shape.size() : { width: shape.width?.() || 0, height: shape.height?.() || 0 };
        return {
            x: shape.x(),
            y: shape.y(),
            width: size.width,
            height: size.height
        };
    }
    
    // =====================================================
    // Bounding Box 계산
    // =====================================================
    
    /**
     * 객체 배열의 Bounding Box 계산
     * ✨ v1.1.0: Stage 좌표계 사용
     * @param {Array<Konva.Shape>} objects
     * @returns {Object|null}
     */
    getBoundingBox(objects) {
        if (!objects || objects.length === 0) return null;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        objects.forEach(shape => {
            // ✨ v1.1.0: Stage 좌표계 사용
            const rect = this._getStageRect(shape);
            if (!rect) return;
            
            minX = Math.min(minX, rect.x);
            maxX = Math.max(maxX, rect.x + rect.width);
            minY = Math.min(minY, rect.y);
            maxY = Math.max(maxY, rect.y + rect.height);
        });
        
        return {
            x: minX,
            y: minY,
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    /**
     * 단일 객체의 정렬 포인트 계산
     * ✨ v1.1.0: Stage 좌표계 사용
     * @param {Konva.Shape} shape
     * @returns {Object}
     */
    getAlignmentPoints(shape) {
        const rect = this._getStageRect(shape);
        if (!rect) return null;
        
        return {
            left: rect.x,
            right: rect.x + rect.width,
            top: rect.y,
            bottom: rect.y + rect.height,
            centerX: rect.x + rect.width / 2,
            centerY: rect.y + rect.height / 2,
            width: rect.width,
            height: rect.height
        };
    }
    
    // =====================================================
    // 정렬 기능
    // =====================================================
    
    /**
     * 좌측 정렬
     */
    alignLeft(objects) {
        if (!this._validateObjects(objects, 2)) return false;
        
        this._triggerCallback('onAlignStart', { type: 'left', objects });
        
        const bbox = this.getBoundingBox(objects);
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const offsetX = shapeRect.x - shape.x();
            const newX = bbox.minX - offsetX;
            
            this._moveShape(shape, newX, shape.y());
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onAlignEnd', { type: 'left', objects });
        
        console.log('[AlignmentGuide] 좌측 정렬 완료');
        return true;
    }
    
    /**
     * 우측 정렬
     */
    alignRight(objects) {
        if (!this._validateObjects(objects, 2)) return false;
        
        this._triggerCallback('onAlignStart', { type: 'right', objects });
        
        const bbox = this.getBoundingBox(objects);
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const newX = bbox.maxX - shapeRect.width - (shapeRect.x - shape.x());
            
            this._moveShape(shape, newX, shape.y());
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onAlignEnd', { type: 'right', objects });
        
        console.log('[AlignmentGuide] 우측 정렬 완료');
        return true;
    }
    
    /**
     * 상단 정렬
     */
    alignTop(objects) {
        if (!this._validateObjects(objects, 2)) return false;
        
        this._triggerCallback('onAlignStart', { type: 'top', objects });
        
        const bbox = this.getBoundingBox(objects);
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const offsetY = shapeRect.y - shape.y();
            const newY = bbox.minY - offsetY;
            
            this._moveShape(shape, shape.x(), newY);
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onAlignEnd', { type: 'top', objects });
        
        console.log('[AlignmentGuide] 상단 정렬 완료');
        return true;
    }
    
    /**
     * 하단 정렬
     */
    alignBottom(objects) {
        if (!this._validateObjects(objects, 2)) return false;
        
        this._triggerCallback('onAlignStart', { type: 'bottom', objects });
        
        const bbox = this.getBoundingBox(objects);
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const newY = bbox.maxY - shapeRect.height - (shapeRect.y - shape.y());
            
            this._moveShape(shape, shape.x(), newY);
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onAlignEnd', { type: 'bottom', objects });
        
        console.log('[AlignmentGuide] 하단 정렬 완료');
        return true;
    }
    
    /**
     * 수평 중앙 정렬
     */
    alignCenterHorizontal(objects) {
        if (!this._validateObjects(objects, 2)) return false;
        
        this._triggerCallback('onAlignStart', { type: 'centerH', objects });
        
        const bbox = this.getBoundingBox(objects);
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const shapeCenterX = shapeRect.x + shapeRect.width / 2;
            const offsetX = shapeCenterX - shape.x();
            const newX = bbox.centerX - offsetX;
            
            this._moveShape(shape, newX, shape.y());
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onAlignEnd', { type: 'centerH', objects });
        
        console.log('[AlignmentGuide] 수평 중앙 정렬 완료');
        return true;
    }
    
    /**
     * 수직 중앙 정렬
     */
    alignCenterVertical(objects) {
        if (!this._validateObjects(objects, 2)) return false;
        
        this._triggerCallback('onAlignStart', { type: 'centerV', objects });
        
        const bbox = this.getBoundingBox(objects);
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const shapeCenterY = shapeRect.y + shapeRect.height / 2;
            const offsetY = shapeCenterY - shape.y();
            const newY = bbox.centerY - offsetY;
            
            this._moveShape(shape, shape.x(), newY);
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onAlignEnd', { type: 'centerV', objects });
        
        console.log('[AlignmentGuide] 수직 중앙 정렬 완료');
        return true;
    }
    
    // =====================================================
    // 균등 분배
    // =====================================================
    
    /**
     * 수평 균등 분배
     */
    distributeHorizontal(objects) {
        if (!this._validateObjects(objects, 3)) return false;
        
        this._triggerCallback('onDistributeStart', { type: 'horizontal', objects });
        
        // X 좌표 기준 정렬
        const sorted = [...objects].sort((a, b) => {
            const rectA = this._getStageRect(a);
            const rectB = this._getStageRect(b);
            return (rectA?.x || 0) - (rectB?.x || 0);
        });
        
        const firstRect = this._getStageRect(sorted[0]);
        const lastRect = this._getStageRect(sorted[sorted.length - 1]);
        
        if (!firstRect || !lastRect) return false;
        
        // 총 객체 너비 계산
        let totalWidth = 0;
        sorted.forEach(shape => {
            const rect = this._getStageRect(shape);
            if (rect) totalWidth += rect.width;
        });
        
        // 간격 계산
        const totalSpace = (lastRect.x + lastRect.width) - firstRect.x;
        const gap = (totalSpace - totalWidth) / (sorted.length - 1);
        
        // 분배 적용
        let currentX = firstRect.x;
        sorted.forEach((shape, index) => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            if (index === 0) {
                currentX += shapeRect.width + gap;
                return;
            }
            
            const offsetX = shapeRect.x - shape.x();
            const newX = currentX - offsetX;
            
            this._moveShape(shape, newX, shape.y());
            currentX += shapeRect.width + gap;
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onDistributeEnd', { type: 'horizontal', objects });
        
        console.log('[AlignmentGuide] 수평 균등 분배 완료');
        return true;
    }
    
    /**
     * 수직 균등 분배
     */
    distributeVertical(objects) {
        if (!this._validateObjects(objects, 3)) return false;
        
        this._triggerCallback('onDistributeStart', { type: 'vertical', objects });
        
        // Y 좌표 기준 정렬
        const sorted = [...objects].sort((a, b) => {
            const rectA = this._getStageRect(a);
            const rectB = this._getStageRect(b);
            return (rectA?.y || 0) - (rectB?.y || 0);
        });
        
        const firstRect = this._getStageRect(sorted[0]);
        const lastRect = this._getStageRect(sorted[sorted.length - 1]);
        
        if (!firstRect || !lastRect) return false;
        
        // 총 객체 높이 계산
        let totalHeight = 0;
        sorted.forEach(shape => {
            const rect = this._getStageRect(shape);
            if (rect) totalHeight += rect.height;
        });
        
        // 간격 계산
        const totalSpace = (lastRect.y + lastRect.height) - firstRect.y;
        const gap = (totalSpace - totalHeight) / (sorted.length - 1);
        
        // 분배 적용
        let currentY = firstRect.y;
        sorted.forEach((shape, index) => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            if (index === 0) {
                currentY += shapeRect.height + gap;
                return;
            }
            
            const offsetY = shapeRect.y - shape.y();
            const newY = currentY - offsetY;
            
            this._moveShape(shape, shape.x(), newY);
            currentY += shapeRect.height + gap;
        });
        
        this._finishAlign(objects);
        this._triggerCallback('onDistributeEnd', { type: 'vertical', objects });
        
        console.log('[AlignmentGuide] 수직 균등 분배 완료');
        return true;
    }
    
    // =====================================================
    // Room 기준 정렬
    // =====================================================
    
    alignToRoomCenter(objects, roomRect) {
        if (!objects || objects.length === 0 || !roomRect) return false;
        
        const bbox = this.getBoundingBox(objects);
        if (!bbox) return false;
        
        const roomCenterX = roomRect.x + roomRect.width / 2;
        const roomCenterY = roomRect.y + roomRect.height / 2;
        
        const deltaX = roomCenterX - bbox.centerX;
        const deltaY = roomCenterY - bbox.centerY;
        
        objects.forEach(shape => {
            this._moveShape(shape, shape.x() + deltaX, shape.y() + deltaY);
        });
        
        this._finishAlign(objects);
        
        console.log('[AlignmentGuide] Room 중앙 정렬 완료');
        return true;
    }
    
    alignToRoomLeft(objects, roomRect, padding = 0) {
        if (!objects || objects.length === 0 || !roomRect) return false;
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const offsetX = shapeRect.x - shape.x();
            const newX = roomRect.x + padding - offsetX;
            
            this._moveShape(shape, newX, shape.y());
        });
        
        this._finishAlign(objects);
        
        console.log('[AlignmentGuide] Room 좌측 정렬 완료');
        return true;
    }
    
    alignToRoomRight(objects, roomRect, padding = 0) {
        if (!objects || objects.length === 0 || !roomRect) return false;
        
        objects.forEach(shape => {
            const shapeRect = this._getStageRect(shape);
            if (!shapeRect) return;
            
            const newX = roomRect.x + roomRect.width - shapeRect.width - padding - (shapeRect.x - shape.x());
            
            this._moveShape(shape, newX, shape.y());
        });
        
        this._finishAlign(objects);
        
        console.log('[AlignmentGuide] Room 우측 정렬 완료');
        return true;
    }
    
    // =====================================================
    // 미리보기
    // =====================================================
    
    showPreview(objects, alignType) {
        if (!this.config.previewEnabled) return;
        
        this.clearPreview();
        
        const positions = this._calculateAlignPositions(objects, alignType);
        
        objects.forEach((shape, index) => {
            const pos = positions[index];
            const rect = this._getStageRect(shape);
            if (!rect) return;
            
            const preview = new Konva.Rect({
                x: pos.x,
                y: pos.y,
                width: rect.width,
                height: rect.height,
                fill: this.config.previewColor,
                stroke: this.config.previewStroke,
                strokeWidth: 1,
                dash: [4, 4],
                listening: false,
                name: 'alignment-preview'
            });
            
            this.previewShapes.push(preview);
            this.uiLayer.add(preview);
        });
        
        this.uiLayer.batchDraw();
    }
    
    clearPreview() {
        this.previewShapes.forEach(shape => shape.destroy());
        this.previewShapes = [];
        this.uiLayer.batchDraw();
    }
    
    _calculateAlignPositions(objects, alignType) {
        const bbox = this.getBoundingBox(objects);
        const positions = [];
        
        objects.forEach(shape => {
            const rect = this._getStageRect(shape);
            if (!rect) {
                positions.push({ x: shape.x(), y: shape.y() });
                return;
            }
            
            let newX = shape.x();
            let newY = shape.y();
            
            switch (alignType) {
                case 'left':
                    newX = bbox.minX - (rect.x - shape.x());
                    break;
                case 'right':
                    newX = bbox.maxX - rect.width - (rect.x - shape.x());
                    break;
                case 'top':
                    newY = bbox.minY - (rect.y - shape.y());
                    break;
                case 'bottom':
                    newY = bbox.maxY - rect.height - (rect.y - shape.y());
                    break;
                case 'centerH':
                    newX = bbox.centerX - rect.width / 2 - (rect.x - shape.x());
                    break;
                case 'centerV':
                    newY = bbox.centerY - rect.height / 2 - (rect.y - shape.y());
                    break;
            }
            
            positions.push({ x: newX, y: newY });
        });
        
        return positions;
    }
    
    // =====================================================
    // 헬퍼 메서드
    // =====================================================
    
    _validateObjects(objects, minCount) {
        if (!objects || objects.length < minCount) {
            console.warn(`[AlignmentGuide] ${minCount}개 이상의 객체가 필요합니다`);
            return false;
        }
        return true;
    }
    
    _moveShape(shape, newX, newY) {
        if (this.config.animationEnabled) {
            shape.to({
                x: newX,
                y: newY,
                duration: this.config.animationDuration / 1000,
                easing: Konva.Easings.EaseOut
            });
        } else {
            shape.x(newX);
            shape.y(newY);
        }
    }
    
    _finishAlign(objects) {
        // 그리드 스냅 (항상 10px 고정값 사용)
        if (this.config.snapAfterAlign) {
            const gridSize = window.currentGridSize || this.config.gridSize;
            objects.forEach(shape => {
                const x = Math.round(shape.x() / gridSize) * gridSize;
                const y = Math.round(shape.y() / gridSize) * gridSize;
                shape.x(x);
                shape.y(y);
            });
        }
        
        if (this.stage) {
            this.stage.batchDraw();
        }
    }
    
    _triggerCallback(name, data) {
        if (this.callbacks[name]) {
            this.callbacks[name](data);
        }
    }
    
    // =====================================================
    // 바로가기 메서드
    // =====================================================
    
    align(objects, type) {
        switch (type) {
            case 'left': return this.alignLeft(objects);
            case 'right': return this.alignRight(objects);
            case 'top': return this.alignTop(objects);
            case 'bottom': return this.alignBottom(objects);
            case 'centerH': return this.alignCenterHorizontal(objects);
            case 'centerV': return this.alignCenterVertical(objects);
            default:
                console.warn(`[AlignmentGuide] 알 수 없는 정렬 타입: ${type}`);
                return false;
        }
    }
    
    distribute(objects, type) {
        switch (type) {
            case 'horizontal': return this.distributeHorizontal(objects);
            case 'vertical': return this.distributeVertical(objects);
            default:
                console.warn(`[AlignmentGuide] 알 수 없는 분배 타입: ${type}`);
                return false;
        }
    }
    
    // =====================================================
    // 설정
    // =====================================================
    
    setAnimation(enabled, duration = 200) {
        this.config.animationEnabled = enabled;
        this.config.animationDuration = duration;
    }
    
    setPreviewEnabled(enabled) {
        this.config.previewEnabled = enabled;
    }
    
    setSnapAfterAlign(enabled, gridSize = 10) {
        this.config.snapAfterAlign = enabled;
        this.config.gridSize = gridSize;
    }
    
    setCallback(name, callback) {
        if (this.callbacks.hasOwnProperty(name)) {
            this.callbacks[name] = callback;
        }
    }
    
    // =====================================================
    // 상태 확인
    // =====================================================
    
    canAlign(objects) {
        return objects && objects.length >= 2;
    }
    
    canDistribute(objects) {
        return objects && objects.length >= 3;
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    clear() {
        this.clearPreview();
    }
    
    destroy() {
        this.clear();
        this.stage = null;
        this.uiLayer = null;
        this.callbacks = {};
        console.log('[AlignmentGuide] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.AlignmentGuide = AlignmentGuide;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlignmentGuide;
}