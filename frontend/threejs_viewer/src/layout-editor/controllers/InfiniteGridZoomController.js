/**
 * InfiniteGridZoomController.js v1.2.0
 * =====================================
 * 
 * 무한 그리드 지원 ZoomController 확장
 * 
 * ✨ v1.2.0 수정:
 * - ✅ getGridSize() 메서드 추가 - 현재 Grid 크기 반환
 * - ✅ getGridInfo() 메서드 추가 - Grid 전체 정보 반환
 * - ✅ 전역 참조로 Grid 크기 공유 (window.currentGridSize)
 * 
 * ✨ v1.1.0 수정:
 * - ✅ Zoom 변경 시 SnapManager.setZoomLevel() 호출
 * - ✅ GridSnap과 Zoom 레벨 동기화
 * 
 * 기능:
 * - 뷰포트 기반 동적 그리드 렌더링
 * - Pan/Zoom 시 자동 그리드 갱신
 * - 무한 캔버스 효과
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/controllers/InfiniteGridZoomController.js
 */

class InfiniteGridZoomController extends ZoomController {
    /**
     * @param {Canvas2DEditor} editor - 캔버스 에디터
     * @param {Object} options - 설정
     */
    constructor(editor, options = {}) {
        super(editor, options);
        
        // 무한 그리드 설정
        this.padding = options.padding || 2000;
        this.gridSize = options.gridSize || 10;  // ✨ 항상 10px (Stage 좌표계 기준)
        this.majorInterval = options.majorInterval || 100;
        
        // 그리드 색상
        this.colors = {
            background: options.backgroundColor || '#f0f0f0',
            minorGrid: options.minorGridColor || '#d8d8d8',
            majorGrid: options.majorGridColor || '#b0b0b0',
            label: options.labelColor || '#888888'
        };
        
        // ✨ v1.2.0: 전역 참조로 Grid 크기 공유
        if (typeof window !== 'undefined') {
            window.currentGridSize = this.gridSize;
            window.infiniteGridController = this;
        }
        
        console.log('[InfiniteGridZoomController] 초기화 완료 v1.2.0');
        console.log(`  ├─ gridSize: ${this.gridSize}px (고정)`);
        console.log(`  └─ majorInterval: ${this.majorInterval}px`);
    }
    
    // =====================================================
    // ✨ v1.2.0: Grid 크기 정보 제공
    // =====================================================
    
    /**
     * ✨ v1.2.0: 현재 Grid 크기 반환 (항상 고정값)
     * @returns {number}
     */
    getGridSize() {
        return this.gridSize;
    }
    
    /**
     * ✨ v1.2.0: Major Grid 간격 반환
     * @returns {number}
     */
    getMajorInterval() {
        return this.majorInterval;
    }
    
    /**
     * ✨ v1.2.0: Grid 전체 정보 반환
     * @returns {Object}
     */
    getGridInfo() {
        return {
            gridSize: this.gridSize,
            majorInterval: this.majorInterval,
            currentZoom: this.currentZoom,
            screenGridSize: this.gridSize * this.currentZoom,
            screenMajorInterval: this.majorInterval * this.currentZoom
        };
    }
    
    /**
     * ✨ v1.1.0: SnapManager에 Zoom 레벨 전달
     * ✨ v1.2.0: Grid 크기 정보도 함께 전달
     * @private
     */
    _syncZoomToSnapManager() {
        if (this.editor.snapManager) {
            this.editor.snapManager.setZoomLevel(this.currentZoom);
        }
        
        if (this.editor.snapManager?.gridSnap) {
            this.editor.snapManager.gridSnap.setZoomLevel(this.currentZoom);
            this.editor.snapManager.gridSnap.setGridSize(this.gridSize);
        }
        
        if (typeof window !== 'undefined') {
            window.currentGridSize = this.gridSize;
            window.currentZoomLevel = this.currentZoom;
        }
    }
    
    /**
     * 무한 그리드 렌더링 (오버라이드)
     */
    updateGrid() {
        if (!this.editor.layers?.background) return;
        
        this.editor.layers.background.destroyChildren();
        
        const stage = this.editor.stage;
        const stagePos = stage.position();
        const zoom = this.currentZoom;
        
        const padding = this.padding / zoom;
        const viewWidth = (this.editor.config.width / zoom) + padding * 2;
        const viewHeight = (this.editor.config.height / zoom) + padding * 2;
        const startX = (-stagePos.x / zoom) - padding;
        const startY = (-stagePos.y / zoom) - padding;
        
        this._renderBackground(startX, startY, viewWidth, viewHeight);
        
        if (this.editor.config.showGrid) {
            this._renderGridLines(startX, startY, viewWidth, viewHeight);
            
            if (zoom >= 0.3) {
                this._renderLabels(startX, startY, viewWidth, viewHeight, zoom);
            }
        }
        
        this.editor.layers.background.batchDraw();
    }
    
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
    
    _renderGridLines(startX, startY, viewWidth, viewHeight) {
        const gridSize = this.gridSize;
        const majorInterval = this.majorInterval;
        
        const gridStartX = Math.floor(startX / gridSize) * gridSize;
        const gridStartY = Math.floor(startY / gridSize) * gridSize;
        const gridEndX = startX + viewWidth;
        const gridEndY = startY + viewHeight;
        
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
    
    _renderLabels(startX, startY, viewWidth, viewHeight, zoom) {
        const majorInterval = this.majorInterval;
        
        const gridStartX = Math.floor(startX / majorInterval) * majorInterval;
        const gridStartY = Math.floor(startY / majorInterval) * majorInterval;
        const gridEndX = startX + viewWidth;
        const gridEndY = startY + viewHeight;
        
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
    
    handleWheel(e) {
        super.handleWheel(e);
        this.updateGrid();
        this._syncZoomToSnapManager();
    }
    
    setZoom(newZoom) {
        super.setZoom(newZoom);
        this.updateGrid();
        this._syncZoomToSnapManager();
    }
    
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
        this._syncZoomToSnapManager();
    }
    
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
        this._syncZoomToSnapManager();
    }
    
    resetZoom() {
        super.resetZoom();
        this.updateGrid();
        this._syncZoomToSnapManager();
    }
    
    get options() {
        return this.config;
    }
}

if (typeof window !== 'undefined') {
    window.InfiniteGridZoomController = InfiniteGridZoomController;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InfiniteGridZoomController;
}