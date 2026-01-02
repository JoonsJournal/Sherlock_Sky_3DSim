/**
 * BaseTool.js
 * ============
 * 
 * 모든 Layout Editor 도구의 기본 클래스
 * 도구의 공통 인터페이스와 기본 동작 정의
 * 
 * @version 1.0.0 - Phase 1.5
 * @module BaseTool
 * 
 * 상속 도구:
 * - ObjectSelectionTool
 * - WallDrawTool
 * - EquipmentArrayTool
 * - AlignmentTool
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/tools/base/BaseTool.js
 */

class BaseTool {
    /**
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2DEditor 인스턴스
     * @param {Object} options - 도구 옵션
     */
    constructor(canvas2DEditor, options = {}) {
        if (!canvas2DEditor) {
            throw new Error('[BaseTool] Canvas2DEditor 인스턴스가 필요합니다');
        }
        
        this.canvas = canvas2DEditor;
        this.options = options;
        
        // 도구 상태
        this.isActive = false;
        this.name = options.name || 'BaseTool';
        
        // 이벤트 핸들러 저장 (제거 시 필요)
        this.boundHandlers = {};
        
        // 커서 타입
        this.cursor = options.cursor || 'default';
        this.activeCursor = options.activeCursor || 'crosshair';
        
        console.log(`[${this.name}] 초기화 완료`);
    }
    
    // =====================================================
    // 필수 인터페이스 (하위 클래스에서 구현)
    // =====================================================
    
    /**
     * 도구 활성화
     * @abstract
     */
    activate() {
        if (this.isActive) {
            console.log(`[${this.name}] 이미 활성화됨`);
            return;
        }
        
        this.isActive = true;
        
        // 커서 변경
        this.setCursor(this.activeCursor);
        
        // 이벤트 리스너 등록 (하위 클래스에서 구현)
        this.setupEventListeners();
        
        console.log(`[${this.name}] 활성화`);
    }
    
    /**
     * 도구 비활성화
     * @abstract
     */
    deactivate() {
        if (!this.isActive) {
            console.log(`[${this.name}] 이미 비활성화됨`);
            return;
        }
        
        this.isActive = false;
        
        // 커서 복원
        this.setCursor(this.cursor);
        
        // 이벤트 리스너 제거 (하위 클래스에서 구현)
        this.removeEventListeners();
        
        // 임시 객체 정리
        this.cleanup();
        
        console.log(`[${this.name}] 비활성화`);
    }
    
    /**
     * 이벤트 리스너 설정
     * @abstract - 하위 클래스에서 구현
     */
    setupEventListeners() {
        // 하위 클래스에서 구현
    }
    
    /**
     * 이벤트 리스너 제거
     * @abstract - 하위 클래스에서 구현
     */
    removeEventListeners() {
        // 하위 클래스에서 구현
    }
    
    /**
     * 임시 객체 정리
     * @abstract - 하위 클래스에서 구현
     */
    cleanup() {
        // 하위 클래스에서 구현
    }
    
    // =====================================================
    // 공통 유틸리티 메서드
    // =====================================================
    
    /**
     * 도구 활성 상태 확인
     * @returns {boolean}
     */
    isToolActive() {
        return this.isActive;
    }
    
    /**
     * 도구 이름 반환
     * @returns {string}
     */
    getName() {
        return this.name;
    }
    
    /**
     * 커서 설정
     * @param {string} cursor - 커서 타입
     */
    setCursor(cursor) {
        if (this.canvas && this.canvas.stage) {
            this.canvas.stage.container().style.cursor = cursor;
        }
    }
    
    /**
     * 마우스 포인터 위치 가져오기
     * @returns {Object} { x, y }
     */
    getPointerPosition() {
        if (this.canvas && this.canvas.stage) {
            return this.canvas.stage.getPointerPosition() || { x: 0, y: 0 };
        }
        return { x: 0, y: 0 };
    }
    
    /**
     * Zoom/Pan을 고려한 변환된 포인터 위치
     * @returns {Object} { x, y }
     */
    getTransformedPointerPosition() {
        if (!this.canvas || !this.canvas.stage) {
            return { x: 0, y: 0 };
        }
        
        const pointer = this.canvas.stage.getPointerPosition();
        if (!pointer) {
            return { x: 0, y: 0 };
        }
        
        const transform = this.canvas.stage.getAbsoluteTransform().copy();
        transform.invert();
        
        return transform.point(pointer);
    }
    
    /**
     * Grid에 스냅
     * @param {number} value - 원래 값
     * @returns {number} 스냅된 값
     */
    snapToGrid(value) {
        if (!this.canvas.config.snapToGrid) {
            return value;
        }
        
        let gridSize = this.canvas.config.gridSize;
        
        // ZoomController가 있으면 동적 gridSize 사용
        if (this.canvas.zoomController && typeof this.canvas.zoomController.getCurrentGridSize === 'function') {
            gridSize = this.canvas.zoomController.getCurrentGridSize();
        }
        
        return Math.round(value / gridSize) * gridSize;
    }
    
    /**
     * 포인트를 Grid에 스냅
     * @param {Object} point - { x, y }
     * @returns {Object} { x, y }
     */
    snapPointToGrid(point) {
        return {
            x: this.snapToGrid(point.x),
            y: this.snapToGrid(point.y)
        };
    }
    
    /**
     * 이벤트 핸들러 바인딩 및 저장
     * @param {string} name - 핸들러 이름
     * @param {Function} handler - 핸들러 함수
     * @returns {Function} 바인딩된 핸들러
     */
    bindHandler(name, handler) {
        const boundHandler = handler.bind(this);
        this.boundHandlers[name] = boundHandler;
        return boundHandler;
    }
    
    /**
     * Stage에 이벤트 등록
     * @param {string} eventName - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    addStageListener(eventName, handler) {
        if (this.canvas && this.canvas.stage) {
            this.canvas.stage.on(eventName, handler);
        }
    }
    
    /**
     * Stage에서 이벤트 제거
     * @param {string} eventName - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    removeStageListener(eventName, handler) {
        if (this.canvas && this.canvas.stage) {
            this.canvas.stage.off(eventName, handler);
        }
    }
    
    /**
     * Window에 이벤트 등록
     * @param {string} eventName - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    addWindowListener(eventName, handler) {
        window.addEventListener(eventName, handler);
    }
    
    /**
     * Window에서 이벤트 제거
     * @param {string} eventName - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    removeWindowListener(eventName, handler) {
        window.removeEventListener(eventName, handler);
    }
    
    /**
     * Document에 이벤트 등록
     * @param {string} eventName - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    addDocumentListener(eventName, handler) {
        document.addEventListener(eventName, handler);
    }
    
    /**
     * Document에서 이벤트 제거
     * @param {string} eventName - 이벤트 이름
     * @param {Function} handler - 핸들러 함수
     */
    removeDocumentListener(eventName, handler) {
        document.removeEventListener(eventName, handler);
    }
    
    /**
     * 레이어 가져오기
     * @param {string} layerName - 레이어 이름
     * @returns {Konva.Layer|null}
     */
    getLayer(layerName) {
        if (this.canvas && this.canvas.layers) {
            return this.canvas.layers[layerName] || null;
        }
        return null;
    }
    
    /**
     * 레이어 다시 그리기
     * @param {string} layerName - 레이어 이름
     */
    batchDraw(layerName) {
        const layer = this.getLayer(layerName);
        if (layer) {
            layer.batchDraw();
        }
    }
    
    /**
     * 모든 레이어 다시 그리기
     */
    batchDrawAll() {
        if (this.canvas && this.canvas.layers) {
            Object.values(this.canvas.layers).forEach(layer => {
                if (layer && layer.batchDraw) {
                    layer.batchDraw();
                }
            });
        }
    }
    
    /**
     * 고유 ID 생성
     * @param {string} prefix - ID 접두사
     * @returns {string}
     */
    generateId(prefix = 'obj') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 선택된 객체 가져오기
     * @returns {Array}
     */
    getSelectedObjects() {
        if (this.canvas && this.canvas.selectedObjects) {
            return this.canvas.selectedObjects;
        }
        return [];
    }
    
    /**
     * 객체 선택
     * @param {Konva.Shape} shape - 선택할 Shape
     * @param {boolean} multiSelect - 다중 선택 여부
     */
    selectObject(shape, multiSelect = false) {
        if (this.canvas && typeof this.canvas.selectObject === 'function') {
            this.canvas.selectObject(shape, multiSelect);
        }
    }
    
    /**
     * 전체 선택 해제
     */
    deselectAll() {
        if (this.canvas && typeof this.canvas.deselectAll === 'function') {
            this.canvas.deselectAll();
        }
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 도구 파괴
     */
    destroy() {
        this.deactivate();
        
        this.canvas = null;
        this.options = null;
        this.boundHandlers = {};
        
        console.log(`[${this.name}] 파괴 완료`);
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined') {
    window.BaseTool = BaseTool;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseTool;
}

export { BaseTool };