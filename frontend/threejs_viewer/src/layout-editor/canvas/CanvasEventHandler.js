/**
 * CanvasEventHandler.js
 * ======================
 * 
 * Canvas2DEditor에서 분리된 이벤트 처리 모듈
 * 마우스, 키보드, Drag & Drop 이벤트 처리
 * 
 * @version 1.1.0 - Phase 5.2: CoordinateTransformer 통합
 * @module CanvasEventHandler
 * 
 * ✨ v1.1.0 수정:
 * - ✅ CoordinateTransformer 사용으로 좌표 변환 통일
 * - ✅ getTransformedPointerPosition() → coordinateTransformer.getCanvasPosition() 교체
 * - ✅ _initCoordinateTransformer() 메서드 추가
 * - ✅ Drop 이벤트에서 clientToCanvas() 사용
 * 
 * 역할:
 * 1. Stage 기본 이벤트 리스너 설정
 * 2. 오른쪽 마우스 Pan 기능
 * 3. Drag & Drop 처리 (ComponentPalette 연동)
 * 4. 컨텍스트 메뉴 방지
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/canvas/CanvasEventHandler.js
 */

class CanvasEventHandler {
    /**
     * @param {Konva.Stage} stage - Konva Stage 인스턴스
     * @param {Object} editor - Canvas2DEditor 참조 (콜백용)
     */
    constructor(stage, editor) {
        if (!stage) {
            throw new Error('[CanvasEventHandler] Konva.Stage 인스턴스가 필요합니다');
        }
        
        this.stage = stage;
        this.editor = editor;
        
        // Pan 상태
        this.isPanning = false;
        this.lastPanPos = { x: 0, y: 0 };
        
        // ✨ v1.1.0: CoordinateTransformer 초기화
        this.coordinateTransformer = null;
        this._initCoordinateTransformer();
        
        // 이벤트 핸들러 바인딩 (제거 시 필요)
        this.boundHandlers = {
            onMouseDown: this.onMouseDown.bind(this),
            onMouseMove: this.onMouseMove.bind(this),
            onMouseUp: this.onMouseUp.bind(this),
            onWindowMouseUp: this.onWindowMouseUp.bind(this),
            onContextMenu: this.onContextMenu.bind(this),
            onStageClick: this.onStageClick.bind(this),
            onDragOver: this.onDragOver.bind(this),
            onDragLeave: this.onDragLeave.bind(this),
            onDrop: this.onDrop.bind(this)
        };
        
        // Drop Zone 활성화 여부
        this.dropZoneEnabled = false;
        
        console.log('[CanvasEventHandler] 초기화 완료 v1.1.0 (CoordinateTransformer 통합)');
    }
    
    // =====================================================
    // ✨ v1.1.0: CoordinateTransformer 초기화
    // =====================================================
    
    /**
     * CoordinateTransformer 초기화
     * @private
     */
    _initCoordinateTransformer() {
        const TransformerClass = window.CoordinateTransformer || 
            (typeof CoordinateTransformer !== 'undefined' ? CoordinateTransformer : null);
        
        if (TransformerClass && this.stage) {
            this.coordinateTransformer = new TransformerClass(this.stage);
            console.log('[CanvasEventHandler] CoordinateTransformer 초기화 완료');
        } else {
            console.warn('[CanvasEventHandler] CoordinateTransformer를 찾을 수 없습니다. 기본 좌표 변환 사용.');
        }
    }
    
    // =====================================================
    // 기본 이벤트 리스너 설정
    // =====================================================
    
    /**
     * 기본 Stage 이벤트 리스너 설정
     */
    setupEventListeners() {
        // Stage 클릭 이벤트 (빈 공간 클릭 시 선택 해제)
        this.stage.on('click tap', this.boundHandlers.onStageClick);
        
        console.log('[CanvasEventHandler] 기본 이벤트 리스너 설정 완료');
    }
    
    /**
     * Stage 클릭 핸들러
     * @param {Konva.KonvaEventObject} e - 이벤트 객체
     */
    onStageClick(e) {
        // 박스 선택 중이면 무시
        if (this.editor && this.editor._isBoxSelecting) {
            console.log('[CanvasEventHandler] 박스 선택 중 - stage click 무시');
            return;
        }
        
        // Stage 자체를 클릭한 경우 (빈 공간)
        if (e.target === this.stage) {
            if (this.editor && typeof this.editor.deselectAll === 'function') {
                this.editor.deselectAll();
            }
        }
    }
    
    /**
     * 기본 이벤트 리스너 제거
     */
    removeEventListeners() {
        this.stage.off('click tap', this.boundHandlers.onStageClick);
        console.log('[CanvasEventHandler] 기본 이벤트 리스너 제거 완료');
    }
    
    // =====================================================
    // 오른쪽 마우스 Pan 기능
    // =====================================================
    
    /**
     * 오른쪽 마우스 버튼 Pan 기능 설정
     */
    setupRightClickPan() {
        // 마우스 다운
        this.stage.on('mousedown', this.boundHandlers.onMouseDown);
        
        // 마우스 이동
        this.stage.on('mousemove', this.boundHandlers.onMouseMove);
        
        // 마우스 업
        this.stage.on('mouseup', this.boundHandlers.onMouseUp);
        
        // 캔버스 밖에서 마우스 업
        window.addEventListener('mouseup', this.boundHandlers.onWindowMouseUp);
        
        // 컨텍스트 메뉴 방지
        this.stage.container().addEventListener('contextmenu', this.boundHandlers.onContextMenu);
        
        console.log('[CanvasEventHandler] 오른쪽 클릭 Pan 설정 완료');
    }
    
    /**
     * 마우스 다운 핸들러
     * @param {Konva.KonvaEventObject} e - 이벤트 객체
     */
    onMouseDown(e) {
        // 오른쪽 마우스 버튼 (button: 2)
        if (e.evt.button === 2) {
            this.isPanning = true;
            this.lastPanPos = {
                x: e.evt.clientX,
                y: e.evt.clientY
            };
            this.stage.container().style.cursor = 'grabbing';
            e.evt.preventDefault();
        }
    }
    
    /**
     * 마우스 이동 핸들러
     * @param {Konva.KonvaEventObject} e - 이벤트 객체
     */
    onMouseMove(e) {
        if (!this.isPanning) return;
        
        const dx = e.evt.clientX - this.lastPanPos.x;
        const dy = e.evt.clientY - this.lastPanPos.y;
        
        const currentPos = this.stage.position();
        this.stage.position({
            x: currentPos.x + dx,
            y: currentPos.y + dy
        });
        
        this.lastPanPos = {
            x: e.evt.clientX,
            y: e.evt.clientY
        };
        
        e.evt.preventDefault();
    }
    
    /**
     * 마우스 업 핸들러 (Stage)
     * @param {Konva.KonvaEventObject} e - 이벤트 객체
     */
    onMouseUp(e) {
        if (e.evt.button === 2) {
            this.isPanning = false;
            this.stage.container().style.cursor = 'default';
            e.evt.preventDefault();
        }
    }
    
    /**
     * 마우스 업 핸들러 (Window)
     * @param {MouseEvent} e - 이벤트 객체
     */
    onWindowMouseUp(e) {
        if (e.button === 2 && this.isPanning) {
            this.isPanning = false;
            this.stage.container().style.cursor = 'default';
        }
    }
    
    /**
     * 컨텍스트 메뉴 방지
     * @param {MouseEvent} e - 이벤트 객체
     */
    onContextMenu(e) {
        e.preventDefault();
    }
    
    /**
     * 오른쪽 클릭 Pan 제거
     */
    removeRightClickPan() {
        this.stage.off('mousedown', this.boundHandlers.onMouseDown);
        this.stage.off('mousemove', this.boundHandlers.onMouseMove);
        this.stage.off('mouseup', this.boundHandlers.onMouseUp);
        
        window.removeEventListener('mouseup', this.boundHandlers.onWindowMouseUp);
        this.stage.container().removeEventListener('contextmenu', this.boundHandlers.onContextMenu);
        
        console.log('[CanvasEventHandler] 오른쪽 클릭 Pan 제거 완료');
    }
    
    // =====================================================
    // Drag & Drop (ComponentPalette 연동)
    // =====================================================
    
    /**
     * Canvas를 Drop Zone으로 설정
     */
    enableDropZone() {
        if (this.dropZoneEnabled) return;
        
        const container = this.stage.container();
        
        container.addEventListener('dragover', this.boundHandlers.onDragOver);
        container.addEventListener('dragleave', this.boundHandlers.onDragLeave);
        container.addEventListener('drop', this.boundHandlers.onDrop);
        
        // Drop Zone 클래스 추가
        container.classList.add('canvas-drop-zone');
        
        this.dropZoneEnabled = true;
        console.log('[CanvasEventHandler] Drop Zone 활성화');
    }
    
    /**
     * Drag Over 핸들러
     * @param {DragEvent} e - 이벤트 객체
     */
    onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.stage.container().classList.add('drag-over');
    }
    
    /**
     * Drag Leave 핸들러
     * @param {DragEvent} e - 이벤트 객체
     */
    onDragLeave(e) {
        this.stage.container().classList.remove('drag-over');
    }
    
    /**
     * Drop 핸들러
     * @param {DragEvent} e - 이벤트 객체
     */
    onDrop(e) {
        e.preventDefault();
        this.stage.container().classList.remove('drag-over');
        
        try {
            // 드래그 데이터 가져오기
            const data = e.dataTransfer.getData('text/plain');
            if (!data) {
                console.warn('[CanvasEventHandler] Drop 데이터가 없습니다');
                return;
            }
            
            const component = JSON.parse(data);
            console.log('[CanvasEventHandler] Drop 감지:', component.name);
            
            // ✨ v1.1.0: CoordinateTransformer 사용하여 좌표 변환
            let x, y;
            
            if (this.coordinateTransformer) {
                const canvasPos = this.coordinateTransformer.clientToCanvas(e.clientX, e.clientY);
                x = canvasPos.x;
                y = canvasPos.y;
            } else if (window.CoordinateTransformer) {
                // Static 메서드로 계산 (폴백)
                const rect = this.stage.container().getBoundingClientRect();
                const stagePos = this.stage.position();
                const scale = this.stage.scaleX();
                
                x = (e.clientX - rect.left - stagePos.x) / scale;
                y = (e.clientY - rect.top - stagePos.y) / scale;
            } else {
                // 기존 방식 (최종 폴백)
                const rect = this.stage.container().getBoundingClientRect();
                const stagePos = this.stage.position();
                const scale = this.stage.scaleX();
                
                x = (e.clientX - rect.left - stagePos.x) / scale;
                y = (e.clientY - rect.top - stagePos.y) / scale;
            }
            
            console.log('[CanvasEventHandler] Drop 위치 (변환됨):', { x, y });
            
            // Editor에 컴포넌트 생성 요청
            if (this.editor && typeof this.editor.createComponentFromType === 'function') {
                this.editor.createComponentFromType(component.id, x, y, component);
            }
            
        } catch (error) {
            console.error('[CanvasEventHandler] Drop 처리 중 오류:', error);
        }
    }
    
    /**
     * Drop Zone 비활성화
     */
    disableDropZone() {
        if (!this.dropZoneEnabled) return;
        
        const container = this.stage.container();
        
        container.removeEventListener('dragover', this.boundHandlers.onDragOver);
        container.removeEventListener('dragleave', this.boundHandlers.onDragLeave);
        container.removeEventListener('drop', this.boundHandlers.onDrop);
        
        container.classList.remove('canvas-drop-zone');
        container.classList.remove('drag-over');
        
        this.dropZoneEnabled = false;
        console.log('[CanvasEventHandler] Drop Zone 비활성화');
    }
    
    // =====================================================
    // ✨ v1.1.0: 좌표 변환 (CoordinateTransformer 사용)
    // =====================================================
    
    /**
     * 변환된 포인터 위치 가져오기 (Zoom/Pan 고려)
     * @returns {Object} { x, y }
     */
    getTransformedPointerPosition() {
        // ✨ v1.1.0: CoordinateTransformer 사용
        if (this.coordinateTransformer) {
            return this.coordinateTransformer.getCanvasPosition();
        }
        
        // Static 메서드 사용 (폴백)
        if (window.CoordinateTransformer) {
            return window.CoordinateTransformer.getPointerPosition(this.stage);
        }
        
        // 최종 폴백: 직접 변환
        const pointer = this.stage.getPointerPosition();
        
        if (!pointer) {
            return { x: 0, y: 0 };
        }
        
        // Stage의 transform 역변환
        const transform = this.stage.getAbsoluteTransform().copy();
        transform.invert();
        
        return transform.point(pointer);
    }
    
    /**
     * Client 좌표를 Canvas 좌표로 변환
     * @param {number} clientX - MouseEvent.clientX
     * @param {number} clientY - MouseEvent.clientY
     * @returns {Object} { x, y }
     */
    clientToCanvas(clientX, clientY) {
        if (this.coordinateTransformer) {
            return this.coordinateTransformer.clientToCanvas(clientX, clientY);
        }
        
        // 폴백
        const rect = this.stage.container().getBoundingClientRect();
        const stagePos = this.stage.position();
        const scale = this.stage.scaleX();
        
        return {
            x: (clientX - rect.left - stagePos.x) / scale,
            y: (clientY - rect.top - stagePos.y) / scale
        };
    }
    
    /**
     * 커서 설정
     * @param {string} cursor - 커서 타입
     */
    setCursor(cursor) {
        this.stage.container().style.cursor = cursor;
    }
    
    /**
     * 키보드 포커스를 위한 tabIndex 설정
     */
    setupKeyboardFocus() {
        const container = this.stage.container();
        container.tabIndex = 1;
        container.style.outline = 'none';
        console.log('[CanvasEventHandler] 키보드 포커스 설정 (tabIndex)');
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 모든 이벤트 리스너 제거
     */
    removeAllListeners() {
        this.removeEventListeners();
        this.removeRightClickPan();
        this.disableDropZone();
        console.log('[CanvasEventHandler] 모든 리스너 제거 완료');
    }
    
    /**
     * 전체 정리 및 파괴
     */
    destroy() {
        this.removeAllListeners();
        
        if (this.coordinateTransformer) {
            this.coordinateTransformer.destroy();
            this.coordinateTransformer = null;
        }
        
        this.stage = null;
        this.editor = null;
        this.boundHandlers = null;
        
        console.log('[CanvasEventHandler] 파괴 완료');
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined') {
    window.CanvasEventHandler = CanvasEventHandler;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasEventHandler;
}

// 전역 객체 등록 (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.CanvasEventHandler = CanvasEventHandler;
}

console.log('✅ CanvasEventHandler.js v1.1.0 로드 완료 (CoordinateTransformer 통합)');