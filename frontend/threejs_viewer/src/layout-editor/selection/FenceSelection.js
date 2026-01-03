/**
 * FenceSelection.js
 * ==================
 * 
 * Shift+Drag 박스 선택 (Marquee Selection / Fence Selection) 구현
 * 
 * @version 1.0.0 - Phase 1.5
 * @module FenceSelection
 * 
 * 역할:
 * 1. Shift+Drag로 선택 영역 그리기
 * 2. 영역 내 객체 자동 선택
 * 3. 실시간 선택 개수 표시
 * 4. Ctrl+Shift+Drag로 기존 선택에 추가
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/selection/FenceSelection.js
 */

class FenceSelection {
    /**
     * @param {Konva.Stage} stage - Konva Stage
     * @param {Konva.Layer} uiLayer - UI 레이어
     * @param {Object} options - 옵션
     * @param {Function} options.onSelectionComplete - 선택 완료 콜백(선택된 shapes 배열)
     * @param {Function} options.getSelectableShapes - 선택 가능한 shapes 반환 함수
     */
    constructor(stage, uiLayer, options = {}) {
        if (!stage || !uiLayer) {
            throw new Error('[FenceSelection] Stage와 UI Layer가 필요합니다');
        }
        
        this.stage = stage;
        this.uiLayer = uiLayer;
        
        // 콜백
        this.onSelectionComplete = options.onSelectionComplete || null;
        this.getSelectableShapes = options.getSelectableShapes || null;
        
        // CSS 색상
        this.cssColors = options.cssColors || {
            selectionStroke: '#667eea',
            selectionFill: 'rgba(102, 126, 234, 0.1)'
        };
        
        // 상태
        this.isActive = false;
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        
        // UI 요소
        this.selectionBox = null;
        this.countLabel = null;
        
        // 키 상태
        this.shiftKeyPressed = false;
        this.ctrlKeyPressed = false;
        
        // 이벤트 핸들러 바인딩
        this.boundHandlers = {
            onKeyDown: this.onKeyDown.bind(this),
            onKeyUp: this.onKeyUp.bind(this),
            onMouseDown: this.onMouseDown.bind(this),
            onMouseMove: this.onMouseMove.bind(this),
            onMouseUp: this.onMouseUp.bind(this)
        };
        
        console.log('[FenceSelection] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // 활성화 / 비활성화
    // =====================================================
    
    /**
     * Fence Selection 활성화
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        
        // 키보드 이벤트
        window.addEventListener('keydown', this.boundHandlers.onKeyDown);
        window.addEventListener('keyup', this.boundHandlers.onKeyUp);
        
        // 마우스 이벤트
        this.stage.on('mousedown touchstart', this.boundHandlers.onMouseDown);
        this.stage.on('mousemove touchmove', this.boundHandlers.onMouseMove);
        this.stage.on('mouseup touchend', this.boundHandlers.onMouseUp);
        
        console.log('[FenceSelection] 활성화');
    }
    
    /**
     * Fence Selection 비활성화
     */
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // 이벤트 제거
        window.removeEventListener('keydown', this.boundHandlers.onKeyDown);
        window.removeEventListener('keyup', this.boundHandlers.onKeyUp);
        
        this.stage.off('mousedown touchstart', this.boundHandlers.onMouseDown);
        this.stage.off('mousemove touchmove', this.boundHandlers.onMouseMove);
        this.stage.off('mouseup touchend', this.boundHandlers.onMouseUp);
        
        // 정리
        this.cleanup();
        
        console.log('[FenceSelection] 비활성화');
    }
    
    // =====================================================
    // 키보드 이벤트
    // =====================================================
    
    /**
     * 키 다운 핸들러
     */
    onKeyDown(e) {
        if (e.key === 'Shift') {
            this.shiftKeyPressed = true;
            this.stage.container().style.cursor = 'crosshair';
        }
        
        if (e.key === 'Control' || e.key === 'Meta') {
            this.ctrlKeyPressed = true;
        }
        
        // ESC로 선택 취소
        if (e.key === 'Escape' && this.isSelecting) {
            this.cancelSelection();
        }
    }
    
    /**
     * 키 업 핸들러
     */
    onKeyUp(e) {
        if (e.key === 'Shift') {
            this.shiftKeyPressed = false;
            if (!this.isSelecting) {
                this.stage.container().style.cursor = 'default';
            }
        }
        
        if (e.key === 'Control' || e.key === 'Meta') {
            this.ctrlKeyPressed = false;
        }
    }
    
    // =====================================================
    // 마우스 이벤트
    // =====================================================
    
    /**
     * 마우스 다운 핸들러
     */
    onMouseDown(e) {
        // 왼쪽 버튼만
        if (e.evt && e.evt.button !== 0) return;
        
        // Stage 빈 공간 + Shift 키
        const clickedOnEmpty = e.target === this.stage;
        
        if (clickedOnEmpty && this.shiftKeyPressed) {
            this.startSelection(e);
        }
    }
    
    /**
     * 선택 시작
     */
    startSelection(e) {
        this.isSelecting = true;
        
        // 변환된 좌표 (Zoom/Pan 고려)
        const pos = this.getTransformedPointerPosition();
        
        this.startX = pos.x;
        this.startY = pos.y;
        
        // 선택 박스 생성
        this.selectionBox = new Konva.Rect({
            x: this.startX,
            y: this.startY,
            width: 0,
            height: 0,
            stroke: this.cssColors.selectionStroke,
            strokeWidth: 2,
            dash: [8, 4],
            fill: this.cssColors.selectionFill,
            listening: false,
            name: 'fence-selection-box'
        });
        
        this.uiLayer.add(this.selectionBox);
        
        // 선택 개수 라벨
        this.countLabel = new Konva.Text({
            x: this.startX + 5,
            y: this.startY + 5,
            text: '0개 선택',
            fontSize: 14,
            fontFamily: 'Arial, sans-serif',
            fill: this.cssColors.selectionStroke,
            fontStyle: 'bold',
            listening: false,
            name: 'fence-selection-label'
        });
        
        this.uiLayer.add(this.countLabel);
        this.uiLayer.batchDraw();
        
        console.log('[FenceSelection] 선택 시작:', { x: this.startX, y: this.startY });
    }
    
    /**
     * 마우스 이동 핸들러
     */
    onMouseMove(e) {
        if (!this.isSelecting || !this.selectionBox) return;
        
        const pos = this.getTransformedPointerPosition();
        
        const width = pos.x - this.startX;
        const height = pos.y - this.startY;
        
        // 박스 업데이트 (음수 너비/높이 처리)
        this.selectionBox.width(Math.abs(width));
        this.selectionBox.height(Math.abs(height));
        this.selectionBox.x(width < 0 ? pos.x : this.startX);
        this.selectionBox.y(height < 0 ? pos.y : this.startY);
        
        // 실시간 선택 개수 업데이트
        const box = this.selectionBox.getClientRect();
        const count = this.countIntersectingShapes(box);
        
        if (this.countLabel) {
            this.countLabel.text(`${count}개 선택`);
            this.countLabel.x(this.selectionBox.x() + 5);
            this.countLabel.y(this.selectionBox.y() + 5);
        }
        
        this.uiLayer.batchDraw();
    }
    
    /**
     * 마우스 업 핸들러
     */
    onMouseUp(e) {
        if (!this.isSelecting) return;
        
        this.finishSelection();
    }
    
    /**
     * 선택 완료
     */
    finishSelection() {
        if (!this.selectionBox) {
            this.cleanup();
            return;
        }
        
        const box = this.selectionBox.getClientRect();
        
        // 선택된 shapes 찾기
        const selectedShapes = this.findIntersectingShapes(box);
        
        console.log(`[FenceSelection] 선택 완료: ${selectedShapes.length}개`);
        
        // UI 정리
        this.cleanup();
        
        // 콜백 호출
        if (this.onSelectionComplete) {
            this.onSelectionComplete(selectedShapes, {
                addToExisting: this.ctrlKeyPressed,
                box: box
            });
        }
        
        // 커서 복원
        if (!this.shiftKeyPressed) {
            this.stage.container().style.cursor = 'default';
        }
    }
    
    /**
     * 선택 취소
     */
    cancelSelection() {
        console.log('[FenceSelection] 선택 취소');
        this.cleanup();
    }
    
    // =====================================================
    // 교차 검사
    // =====================================================
    
    /**
     * 박스와 교차하는 shapes 찾기
     * @param {Object} box - { x, y, width, height }
     * @returns {Array<Konva.Shape>}
     */
    findIntersectingShapes(box) {
        const shapes = this.getSelectableShapes 
            ? this.getSelectableShapes() 
            : [];
        
        return shapes.filter(shape => {
            const shapeBox = shape.getClientRect();
            return this.haveIntersection(box, shapeBox);
        });
    }
    
    /**
     * 박스 내 shapes 개수
     * @param {Object} box - { x, y, width, height }
     * @returns {number}
     */
    countIntersectingShapes(box) {
        const shapes = this.getSelectableShapes 
            ? this.getSelectableShapes() 
            : [];
        
        let count = 0;
        shapes.forEach(shape => {
            const shapeBox = shape.getClientRect();
            if (this.haveIntersection(box, shapeBox)) {
                count++;
            }
        });
        
        return count;
    }
    
    /**
     * 두 사각형이 교차하는지 확인
     * @param {Object} r1 - { x, y, width, height }
     * @param {Object} r2 - { x, y, width, height }
     * @returns {boolean}
     */
    haveIntersection(r1, r2) {
        return !(
            r2.x > r1.x + r1.width ||
            r2.x + r2.width < r1.x ||
            r2.y > r1.y + r1.height ||
            r2.y + r2.height < r1.y
        );
    }
    
    /**
     * Shape가 박스 안에 완전히 포함되는지 확인
     * @param {Object} box - 선택 박스
     * @param {Object} shapeBox - Shape 박스
     * @returns {boolean}
     */
    isFullyContained(box, shapeBox) {
        return (
            shapeBox.x >= box.x &&
            shapeBox.y >= box.y &&
            shapeBox.x + shapeBox.width <= box.x + box.width &&
            shapeBox.y + shapeBox.height <= box.y + box.height
        );
    }
    
    // =====================================================
    // 유틸리티
    // =====================================================
    
    /**
     * Zoom/Pan을 고려한 포인터 위치
     */
    getTransformedPointerPosition() {
        const pointer = this.stage.getPointerPosition();
        
        if (!pointer) {
            return { x: 0, y: 0 };
        }
        
        const transform = this.stage.getAbsoluteTransform().copy();
        transform.invert();
        
        return transform.point(pointer);
    }
    
    /**
     * UI 요소 정리
     */
    cleanup() {
        this.isSelecting = false;
        
        if (this.selectionBox) {
            this.selectionBox.destroy();
            this.selectionBox = null;
        }
        
        if (this.countLabel) {
            this.countLabel.destroy();
            this.countLabel = null;
        }
        
        this.uiLayer.batchDraw();
    }
    
    /**
     * CSS 색상 업데이트
     * @param {Object} colors - 새 색상
     */
    updateColors(colors) {
        this.cssColors = { ...this.cssColors, ...colors };
    }
    
    /**
     * 선택 중인지 확인
     * @returns {boolean}
     */
    isSelectingActive() {
        return this.isSelecting;
    }
    
    /**
     * 콜백 설정
     * @param {Function} callback - 선택 완료 콜백
     */
    setSelectionCallback(callback) {
        this.onSelectionComplete = callback;
    }
    
    /**
     * 선택 가능한 shapes 반환 함수 설정
     * @param {Function} fn - shapes 반환 함수
     */
    setGetSelectableShapes(fn) {
        this.getSelectableShapes = fn;
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 정리
     */
    clear() {
        this.cleanup();
        this.shiftKeyPressed = false;
        this.ctrlKeyPressed = false;
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.deactivate();
        this.stage = null;
        this.uiLayer = null;
        this.onSelectionComplete = null;
        this.getSelectableShapes = null;
        console.log('[FenceSelection] 파괴 완료');
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.FenceSelection = FenceSelection;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FenceSelection;
}

