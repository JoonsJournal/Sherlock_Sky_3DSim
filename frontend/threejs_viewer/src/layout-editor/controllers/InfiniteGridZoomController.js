/**
 * InfiniteGridZoomController.js v1.0.0
 * =====================================
 * 
 * 무한 그리드 지원 ZoomController 확장
 * 
 * 기능:
 * - 뷰포트 기반 동적 그리드 렌더링
 * - Pan/Zoom 시 자동 그리드 갱신
 * - 무한 캔버스 효과
 * 
 * 사용법:
 * const zoomCtrl = new InfiniteGridZoomController(editor, { 
 *     minZoom: 0.1, 
 *     maxZoom: 5.0 
 * });
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/controllers/InfiniteGridZoomController.js
 */

class InfiniteGridZoomController extends ZoomController {
    /**
     * @param {Canvas2DEditor} editor - 캔버스 에디터
     * @param {Object} options - 설정
     * @param {number} options.padding - 뷰포트 여유 공간 (기본: 2000)
     * @param {number} options.minZoom - 최소 줌 (기본: 0.1)
     * @param {number} options.maxZoom - 최대 줌 (기본: 5.0)
     */
    constructor(editor, options = {}) {
        super(editor, options);
        
        // 무한 그리드 설정
        this.padding = options.padding || 2000;
        this.gridSize = options.gridSize || 10;
        this.majorInterval = options.majorInterval || 100;
        
        // 그리드 색상
        this.colors = {
            background: options.backgroundColor || '#f0f0f0',
            minorGrid: options.minorGridColor || '#d8d8d8',
            majorGrid: options.majorGridColor || '#b0b0b0',
            label: options.labelColor || '#888888'
        };
        
        console.log('[InfiniteGridZoomController] 초기화 완료 v1.0.0');
    }
    
    /**
     * 무한 그리드 렌더링 (오버라이드)
     * 뷰포트 영역만 그리드를 렌더링하여 성능 최적화
     */
    updateGrid() {
        if (!this.editor.layers?.background) return;
        
        this.editor.layers.background.destroyChildren();
        
        const stage = this.editor.stage;
        const stagePos = stage.position();
        const zoom = this.currentZoom;
        
        // 뷰포트 크기 계산 (여유 공간 추가)
        const padding = this.padding / zoom;
        const viewWidth = (this.editor.config.width / zoom) + padding * 2;
        const viewHeight = (this.editor.config.height / zoom) + padding * 2;
        const startX = (-stagePos.x / zoom) - padding;
        const startY = (-stagePos.y / zoom) - padding;
        
        // 배경 렌더링
        this._renderBackground(startX, startY, viewWidth, viewHeight);
        
        // 그리드 렌더링
        if (this.editor.config.showGrid) {
            this._renderGridLines(startX, startY, viewWidth, viewHeight);
            
            // 줌 레벨이 0.3 이상일 때만 라벨 표시
            if (zoom >= 0.3) {
                this._renderLabels(startX, startY, viewWidth, viewHeight, zoom);
            }
        }
        
        this.editor.layers.background.batchDraw();
    }
    
    /**
     * 배경 렌더링
     * @private
     */
    _renderBackground(startX, startY, viewWidth, viewHeight) {
        const background = new Konva.Rect({
            x: startX,
            y: startY,
            width: viewWidth,
            height: viewHeight,
            fill: this.colors.background,
            listening: false
        });
        this.editor.layers.background.add(background);
    }
    
    /**
     * 그리드 라인 렌더링
     * @private
     */
    _renderGridLines(startX, startY, viewWidth, viewHeight) {
        const gridSize = this.gridSize;
        const majorInterval = this.majorInterval;
        
        // 시작점을 그리드에 맞춤
        const gridStartX = Math.floor(startX / gridSize) * gridSize;
        const gridStartY = Math.floor(startY / gridSize) * gridSize;
        const gridEndX = startX + viewWidth;
        const gridEndY = startY + viewHeight;
        
        // 세로선 (X축)
        for (let x = gridStartX; x <= gridEndX; x += gridSize) {
            const isMajor = Math.abs(x % majorInterval) < 0.1;
            const line = new Konva.Line({
                points: [x, startY, x, startY + viewHeight],
                stroke: isMajor ? this.colors.majorGrid : this.colors.minorGrid,
                strokeWidth: isMajor ? 1 : 0.5,
                listening: false
            });
            this.editor.layers.background.add(line);
        }
        
        // 가로선 (Y축)
        for (let y = gridStartY; y <= gridEndY; y += gridSize) {
            const isMajor = Math.abs(y % majorInterval) < 0.1;
            const line = new Konva.Line({
                points: [startX, y, startX + viewWidth, y],
                stroke: isMajor ? this.colors.majorGrid : this.colors.minorGrid,
                strokeWidth: isMajor ? 1 : 0.5,
                listening: false
            });
            this.editor.layers.background.add(line);
        }
    }
    
    /**
     * 그리드 라벨 렌더링
     * @private
     */
    _renderLabels(startX, startY, viewWidth, viewHeight, zoom) {
        const majorInterval = this.majorInterval;
        
        // 시작점을 Major Grid에 맞춤
        const gridStartX = Math.floor(startX / majorInterval) * majorInterval;
        const gridStartY = Math.floor(startY / majorInterval) * majorInterval;
        const gridEndX = startX + viewWidth;
        const gridEndY = startY + viewHeight;
        
        // X축 라벨
        for (let x = gridStartX; x <= gridEndX; x += majorInterval) {
            if (x === 0) continue;
            const label = new Konva.Text({
                x: x + 2,
                y: startY + 5,
                text: (x / 10).toFixed(0) + 'm',
                fontSize: 10 / zoom,
                fill: this.colors.label,
                listening: false
            });
            this.editor.layers.background.add(label);
        }
        
        // Y축 라벨
        for (let y = gridStartY; y <= gridEndY; y += majorInterval) {
            if (y === 0) continue;
            const label = new Konva.Text({
                x: startX + 5,
                y: y + 2,
                text: (y / 10).toFixed(0) + 'm',
                fontSize: 10 / zoom,
                fill: this.colors.label,
                listening: false
            });
            this.editor.layers.background.add(label);
        }
    }
    
    /**
     * 휠 이벤트 핸들러 (오버라이드)
     * Pan 후 그리드 갱신
     */
    handleWheel(e) {
        super.handleWheel(e);
        this.updateGrid();
    }
    
    /**
     * 줌 레벨 설정 (오버라이드)
     * @param {number} newZoom - 새 줌 레벨
     */
    setZoom(newZoom) {
        super.setZoom(newZoom);
        this.updateGrid();
    }
    
    /**
     * 줌 인 (오버라이드)
     * 마우스 포인터 위치 기준 줌
     */
    zoomIn() {
        const oldZoom = this.currentZoom;
        const newZoom = Math.min(this.options.maxZoom, oldZoom + this.options.zoomStep);
        
        const pointer = this.editor.stage.getPointerPosition();
        if (!pointer) {
            this.setZoom(newZoom);
            return;
        }
        
        const mousePointTo = {
            x: pointer.x / oldZoom - this.editor.stage.x() / oldZoom,
            y: pointer.y / oldZoom - this.editor.stage.y() / oldZoom
        };
        
        this.setZoom(newZoom);
        
        this.editor.stage.position({
            x: -(mousePointTo.x - pointer.x / newZoom) * newZoom,
            y: -(mousePointTo.y - pointer.y / newZoom) * newZoom
        });
        
        this.updateGrid();
        this.editor.stage.batchDraw();
    }
    
    /**
     * 줌 아웃 (오버라이드)
     * 마우스 포인터 위치 기준 줌
     */
    zoomOut() {
        const oldZoom = this.currentZoom;
        const newZoom = Math.max(this.options.minZoom, oldZoom - this.options.zoomStep);
        
        const pointer = this.editor.stage.getPointerPosition();
        if (!pointer) {
            this.setZoom(newZoom);
            return;
        }
        
        const mousePointTo = {
            x: pointer.x / oldZoom - this.editor.stage.x() / oldZoom,
            y: pointer.y / oldZoom - this.editor.stage.y() / oldZoom
        };
        
        this.setZoom(newZoom);
        
        this.editor.stage.position({
            x: -(mousePointTo.x - pointer.x / newZoom) * newZoom,
            y: -(mousePointTo.y - pointer.y / newZoom) * newZoom
        });
        
        this.updateGrid();
        this.editor.stage.batchDraw();
    }
    
    /**
     * 줌 리셋 (오버라이드)
     */
    resetZoom() {
        super.resetZoom();
        this.updateGrid();
    }
    
    /**
     * 옵션 getter
     */
    get options() {
        return this.config;
    }
}

// =====================================================
// Exports - 전역 객체 방식 (script 태그 호환)
// =====================================================

// ✅ 전역 객체로 등록 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.InfiniteGridZoomController = InfiniteGridZoomController;
}

// ✅ CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InfiniteGridZoomController;
}
