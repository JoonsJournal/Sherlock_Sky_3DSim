/**
 * CoordinateTransformer.js
 * ========================
 * 
 * Zoom/Pan을 고려한 좌표 변환 공통 유틸리티
 * 모든 Layout Editor 도구들이 이 모듈을 사용하여 좌표 변환
 * 
 * @module CoordinateTransformer
 * @version 1.0.0 - Phase 5.2: 좌표 변환 통합
 * 
 * 사용하는 파일들:
 * - EquipmentArrayTool.js
 * - WallDrawTool.js
 * - FenceSelection.js
 * - CanvasEventHandler.js
 * - SmartGuideManager.js
 * - HandleManager.js
 * - 기타 모든 좌표 변환이 필요한 도구들
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/utils/CoordinateTransformer.js
 */

class CoordinateTransformer {
    /**
     * @param {Konva.Stage} stage - Konva Stage 인스턴스
     */
    constructor(stage) {
        if (!stage) {
            throw new Error('[CoordinateTransformer] Konva.Stage 인스턴스가 필요합니다');
        }
        this.stage = stage;
        console.log('[CoordinateTransformer] 초기화 완료 v1.0.0');
    }

    // =====================================================
    // Stage 설정
    // =====================================================

    /**
     * Stage 설정/변경
     * @param {Konva.Stage} stage
     */
    setStage(stage) {
        this.stage = stage;
    }

    /**
     * Stage 가져오기
     * @returns {Konva.Stage}
     */
    getStage() {
        return this.stage;
    }

    // =====================================================
    // 핵심 좌표 변환 메서드
    // =====================================================

    /**
     * ✨ Screen 좌표 → Canvas(Stage) 좌표 변환
     * Zoom/Pan이 적용된 상태에서 실제 캔버스 좌표를 얻음
     * 
     * @returns {Object} { x, y } 캔버스 좌표
     */
    getCanvasPosition() {
        const pointer = this.stage.getPointerPosition();
        
        if (!pointer) {
            console.warn('[CoordinateTransformer] 포인터 위치를 가져올 수 없습니다');
            return { x: 0, y: 0 };
        }

        return this.screenToCanvas(pointer.x, pointer.y);
    }

    /**
     * Screen 좌표 → Canvas 좌표 변환 (직접 값 전달)
     * 
     * @param {number} screenX - 화면 X 좌표
     * @param {number} screenY - 화면 Y 좌표
     * @returns {Object} { x, y } 캔버스 좌표
     */
    screenToCanvas(screenX, screenY) {
        // Stage의 현재 transform 가져오기
        const transform = this.stage.getAbsoluteTransform().copy();
        
        // 역변환
        transform.invert();
        
        // 변환된 좌표 반환
        return transform.point({ x: screenX, y: screenY });
    }

    /**
     * Canvas 좌표 → Screen 좌표 변환
     * 
     * @param {number} canvasX - 캔버스 X 좌표
     * @param {number} canvasY - 캔버스 Y 좌표
     * @returns {Object} { x, y } 화면 좌표
     */
    canvasToScreen(canvasX, canvasY) {
        const transform = this.stage.getAbsoluteTransform();
        return transform.point({ x: canvasX, y: canvasY });
    }

    /**
     * 클라이언트 좌표 (MouseEvent clientX/Y) → Canvas 좌표 변환
     * Drop 이벤트 등에서 사용
     * 
     * @param {number} clientX - MouseEvent.clientX
     * @param {number} clientY - MouseEvent.clientY
     * @returns {Object} { x, y } 캔버스 좌표
     */
    clientToCanvas(clientX, clientY) {
        const rect = this.stage.container().getBoundingClientRect();
        const stagePos = this.stage.position();
        const scale = this.stage.scaleX();

        return {
            x: (clientX - rect.left - stagePos.x) / scale,
            y: (clientY - rect.top - stagePos.y) / scale
        };
    }

    // =====================================================
    // 줌 관련 유틸리티
    // =====================================================

    /**
     * 현재 Zoom 레벨 가져오기
     * @returns {number} 현재 scale (1.0 = 100%)
     */
    getZoomLevel() {
        return this.stage.scaleX() || 1;
    }

    /**
     * Stage 위치(Pan offset) 가져오기
     * @returns {Object} { x, y }
     */
    getStagePosition() {
        return this.stage.position() || { x: 0, y: 0 };
    }

    /**
     * Zoom 레벨에 따른 값 스케일링
     * (예: 그리드 크기를 Zoom에 맞게 조정)
     * 
     * @param {number} value - 원본 값
     * @returns {number} 스케일된 값
     */
    scaleValue(value) {
        return value / this.getZoomLevel();
    }

    /**
     * 역스케일링 (Canvas → Screen 크기)
     * 
     * @param {number} value - 캔버스 값
     * @returns {number} 화면 값
     */
    unscaleValue(value) {
        return value * this.getZoomLevel();
    }

    // =====================================================
    // Shape 관련 좌표 변환
    // =====================================================

    /**
     * Shape의 Stage 좌표계 Rect 반환
     * Zoom이 적용된 상태에서 실제 캔버스 상의 위치/크기
     * 
     * @param {Konva.Shape|Konva.Group} shape - 대상 Shape
     * @returns {Object} { x, y, width, height }
     */
    getShapeStageRect(shape) {
        if (!shape) return null;

        const absPos = shape.getAbsolutePosition();
        const size = shape.size ? shape.size() : { 
            width: shape.width?.() || 0, 
            height: shape.height?.() || 0 
        };

        // Group이거나 size가 없는 경우 getClientRect 사용
        if (shape.nodeType === 'Group' || !size.width) {
            const clientRect = shape.getClientRect({ skipTransform: false });
            const zoom = this.getZoomLevel();
            const stagePos = this.getStagePosition();

            return {
                x: (clientRect.x - stagePos.x) / zoom,
                y: (clientRect.y - stagePos.y) / zoom,
                width: clientRect.width / zoom,
                height: clientRect.height / zoom
            };
        }

        return {
            x: shape.x(),
            y: shape.y(),
            width: size.width,
            height: size.height
        };
    }

    /**
     * Shape의 중심점 (Canvas 좌표)
     * 
     * @param {Konva.Shape|Konva.Group} shape - 대상 Shape
     * @returns {Object} { x, y }
     */
    getShapeCenter(shape) {
        const rect = this.getShapeStageRect(shape);
        if (!rect) return null;

        return {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2
        };
    }

    // =====================================================
    // 그리드 스냅 (좌표 변환 포함)
    // =====================================================

    /**
     * 값을 그리드에 스냅
     * 
     * @param {number} value - 원본 값
     * @param {number} gridSize - 그리드 크기 (기본 10)
     * @returns {number} 스냅된 값
     */
    snapToGrid(value, gridSize = 10) {
        return Math.round(value / gridSize) * gridSize;
    }

    /**
     * 좌표를 그리드에 스냅
     * 
     * @param {Object} pos - { x, y }
     * @param {number} gridSize - 그리드 크기
     * @returns {Object} { x, y } 스냅된 좌표
     */
    snapPositionToGrid(pos, gridSize = 10) {
        return {
            x: this.snapToGrid(pos.x, gridSize),
            y: this.snapToGrid(pos.y, gridSize)
        };
    }

    /**
     * 현재 포인터 위치를 그리드에 스냅하여 반환
     * 
     * @param {number} gridSize - 그리드 크기
     * @returns {Object} { x, y } 스냅된 캔버스 좌표
     */
    getSnappedCanvasPosition(gridSize = 10) {
        const pos = this.getCanvasPosition();
        return this.snapPositionToGrid(pos, gridSize);
    }

    // =====================================================
    // 디버그 유틸리티
    // =====================================================

    /**
     * 현재 상태 로깅
     */
    debugLog() {
        const pointer = this.stage.getPointerPosition();
        const canvasPos = pointer ? this.screenToCanvas(pointer.x, pointer.y) : null;
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📍 [CoordinateTransformer] Debug Info');
        console.log('  ├─ Zoom Level:', this.getZoomLevel().toFixed(2));
        console.log('  ├─ Stage Position:', this.getStagePosition());
        console.log('  ├─ Screen Pointer:', pointer);
        console.log('  └─ Canvas Position:', canvasPos);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // =====================================================
    // 정리
    // =====================================================

    /**
     * 파괴
     */
    destroy() {
        this.stage = null;
        console.log('[CoordinateTransformer] 파괴 완료');
    }
}

// =====================================================
// Static Factory Methods (편의용)
// =====================================================

/**
 * Stage에서 바로 변환된 포인터 위치 가져오기 (일회성 사용)
 * @param {Konva.Stage} stage
 * @returns {Object} { x, y }
 */
CoordinateTransformer.getPointerPosition = function(stage) {
    if (!stage) return { x: 0, y: 0 };
    
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    
    return transform.point(pointer);
};

/**
 * Screen 좌표를 Canvas 좌표로 변환 (일회성 사용)
 * @param {Konva.Stage} stage
 * @param {number} screenX
 * @param {number} screenY
 * @returns {Object} { x, y }
 */
CoordinateTransformer.screenToCanvas = function(stage, screenX, screenY) {
    if (!stage) return { x: screenX, y: screenY };
    
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    
    return transform.point({ x: screenX, y: screenY });
};

// =====================================================
// Exports
// =====================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoordinateTransformer;
}

if (typeof window !== 'undefined') {
    window.CoordinateTransformer = CoordinateTransformer;
}

console.log('✅ CoordinateTransformer.js v1.0.0 로드 완료');