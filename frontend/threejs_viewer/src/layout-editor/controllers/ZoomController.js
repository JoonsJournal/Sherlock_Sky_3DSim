/**
 * ZoomController.js v1.0.0
 * ========================
 * 
 * 기능:
 * - 마우스 휠 줌 in/out
 * - 줌 버튼 UI 컨트롤
 * - 동적 Grid 크기 계산
 * - 줌 레벨에 따른 pixel-to-meter 스케일 조정
 * 
 * 스케일 규칙:
 * - 최대 줌인 (5.0x): 10 pixel = 10cm → 1 pixel = 1cm → scale = 100 (pixel per meter)
 * - 기본 (1.0x):      10 pixel = 10cm → 1 pixel = 1cm → scale = 100
 * - 최대 줌아웃 (0.2x): 10 pixel = 50cm → 1 pixel = 5cm → scale = 20 (pixel per meter)
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/controllers/ZoomController.js
 */

class ZoomController {
    constructor(canvas2DEditor, options = {}) {
        this.editor = canvas2DEditor;
        
        // 줌 설정
        this.config = {
            minZoom: options.minZoom || 0.2,    // 최소 줌 (20%)
            maxZoom: options.maxZoom || 5.0,    // 최대 줌 (500%)
            zoomStep: options.zoomStep || 0.1,  // 줌 스텝
            wheelSensitivity: options.wheelSensitivity || 0.001
        };
        
        // 현재 줌 레벨
        this.currentZoom = 1.0;
        
        // 기본 스케일 (1x 줌에서의 pixel per meter)
        // 10 pixel = 10cm → 1 pixel = 1cm → 100 pixel = 1m
        this.baseScale = 100;
        
        // Grid 크기 설정
        this.gridConfig = {
            baseGridSize: 10,        // 1x 줌에서 10px = 10cm
            minorInterval: 1,        // Minor grid: 10cm 간격
            majorInterval: 10        // Major grid: 1m 간격 (10 * 10cm)
        };
        
        this.isActive = false;
        
        // 이벤트 핸들러 바인딩
        this.handleWheel = this.onWheel.bind(this);
        
        console.log('[ZoomController] Initialized');
        console.log('  ├─ minZoom:', this.config.minZoom);
        console.log('  ├─ maxZoom:', this.config.maxZoom);
        console.log('  └─ baseScale:', this.baseScale, 'px/m');
    }
    
    /**
     * 활성화
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        
        // 마우스 휠 이벤트
        const container = this.editor.stage.container();
        container.addEventListener('wheel', this.handleWheel, { passive: false });
        
        console.log('✅ ZoomController activated');
    }
    
    /**
     * 비활성화
     */
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        const container = this.editor.stage.container();
        container.removeEventListener('wheel', this.handleWheel);
        
        console.log('✅ ZoomController deactivated');
    }
    
    /**
     * 마우스 휠 이벤트 핸들러
     */
    onWheel(e) {
        e.preventDefault();
        
        const oldZoom = this.currentZoom;
        const delta = -e.deltaY * this.config.wheelSensitivity;
        
        // 새로운 줌 레벨 계산
        let newZoom = oldZoom + delta;
        newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newZoom));
        
        if (newZoom === oldZoom) return;
        
        // 마우스 포인터 위치 기준으로 줌
        const pointer = this.editor.stage.getPointerPosition();
        const mousePointTo = {
            x: pointer.x / oldZoom - this.editor.stage.x() / oldZoom,
            y: pointer.y / oldZoom - this.editor.stage.y() / oldZoom
        };
        
        // 줌 적용
        this.setZoom(newZoom);
        
        // 마우스 포인터 위치 유지
        const newPos = {
            x: -(mousePointTo.x - pointer.x / newZoom) * newZoom,
            y: -(mousePointTo.y - pointer.y / newZoom) * newZoom
        };
        
        this.editor.stage.position(newPos);
        this.editor.stage.batchDraw();
    }
    
    /**
     * 줌 레벨 설정
     * @param {number} zoom - 줌 레벨 (0.2 ~ 5.0)
     */
    setZoom(zoom) {
        zoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, zoom));
        
        const oldZoom = this.currentZoom;
        this.currentZoom = zoom;
        
        // Stage 스케일 적용
        this.editor.stage.scale({ x: zoom, y: zoom });
        
        // Grid 다시 그리기
        this.updateGrid();
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 Zoom changed:', oldZoom.toFixed(2), '→', zoom.toFixed(2));
        console.log('  ├─ Current scale:', this.getCurrentScale(), 'px/m');
        console.log('  ├─ Grid size:', this.getCurrentGridSize(), 'px');
        console.log('  └─ 1 grid =', this.getGridPhysicalSize(), 'm');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    /**
     * 줌 인
     */
    zoomIn() {
        const newZoom = Math.min(this.config.maxZoom, this.currentZoom + this.config.zoomStep);
        this.setZoom(newZoom);
    }
    
    /**
     * 줌 아웃
     */
    zoomOut() {
        const newZoom = Math.max(this.config.minZoom, this.currentZoom - this.config.zoomStep);
        this.setZoom(newZoom);
    }
    
    /**
     * 줌 리셋 (1.0x)
     */
    resetZoom() {
        this.setZoom(1.0);
        this.editor.stage.position({ x: 0, y: 0 });
        this.editor.stage.batchDraw();
    }
    
    /**
     * 현재 줌 레벨 가져오기
     */
    getZoom() {
        return this.currentZoom;
    }
    
    /**
     * 현재 스케일 계산 (pixel per meter)
     * 
     * 공식: scale = baseScale * zoom
     * 
     * 예시:
     * - 5.0x 줌: 100 * 5.0 = 500 px/m (1px = 0.2cm)
     * - 1.0x 줌: 100 * 1.0 = 100 px/m (1px = 1cm)
     * - 0.2x 줌: 100 * 0.2 = 20 px/m (1px = 5cm)
     */
    getCurrentScale() {
        return this.baseScale * this.currentZoom;
    }
    
    /**
     * 현재 Grid 크기 계산 (pixel)
     * 
     * Grid는 항상 10cm 간격을 유지
     * - 1.0x 줌: 10px = 10cm
     * - 5.0x 줌: 50px = 10cm (1px = 0.2cm이므로)
     * - 0.2x 줌: 2px = 10cm (1px = 5cm이므로)
     */
    getCurrentGridSize() {
        // 10cm를 pixel로 변환
        // 0.1m * (baseScale * zoom) = grid size in pixels
        return 0.1 * this.baseScale * this.currentZoom;
    }
    
    /**
     * Grid의 물리적 크기 (meter)
     * 항상 0.1m (10cm) 반환
     */
    getGridPhysicalSize() {
        return 0.1; // 10cm = 0.1m
    }
    
    /**
     * Major Grid 간격 (pixel)
     * 1m = 10 grid cells
     */
    getMajorGridInterval() {
        return this.gridConfig.majorInterval;
    }
    
    /**
     * Grid 업데이트
     */
    updateGrid() {
        // Background layer 다시 그리기
        this.editor.layers.background.destroyChildren();
        
        const width = this.editor.config.width;
        const height = this.editor.config.height;
        const gridSize = this.getCurrentGridSize();
        const majorInterval = this.gridConfig.majorInterval;
        
        // 배경
        const background = new Konva.Rect({
            x: 0, y: 0,
            width: width,
            height: height,
            fill: this.editor.config.backgroundColor
        });
        this.editor.layers.background.add(background);
        
        // 줌 레벨이 너무 낮으면 Grid 생략
        if (gridSize < 2) {
            console.log('⚠️ Grid size too small, skipping grid rendering');
            this.editor.layers.background.batchDraw();
            return;
        }
        
        // 세로선
        for (let i = 0; i <= width / this.currentZoom; i += gridSize) {
            const isMajor = (Math.round(i / gridSize) % majorInterval) === 0;
            const line = new Konva.Line({
                points: [i, 0, i, height / this.currentZoom],
                stroke: isMajor ? this.editor.config.gridMajorColor : this.editor.config.gridColor,
                strokeWidth: isMajor ? 1 / this.currentZoom : 0.5 / this.currentZoom
            });
            this.editor.layers.background.add(line);
            
            // Major grid 라벨
            if (isMajor && i > 0) {
                const meters = Math.round((i / this.baseScale / this.currentZoom) * 10) / 10;
                this.editor.layers.background.add(new Konva.Text({
                    x: i - 15 / this.currentZoom,
                    y: 5 / this.currentZoom,
                    text: `${meters}m`,
                    fontSize: 10 / this.currentZoom,
                    fill: this.editor.cssColors.gridLabel
                }));
            }
        }
        
        // 가로선
        for (let i = 0; i <= height / this.currentZoom; i += gridSize) {
            const isMajor = (Math.round(i / gridSize) % majorInterval) === 0;
            const line = new Konva.Line({
                points: [0, i, width / this.currentZoom, i],
                stroke: isMajor ? this.editor.config.gridMajorColor : this.editor.config.gridColor,
                strokeWidth: isMajor ? 1 / this.currentZoom : 0.5 / this.currentZoom
            });
            this.editor.layers.background.add(line);
            
            // Major grid 라벨
            if (isMajor && i > 0) {
                const meters = Math.round((i / this.baseScale / this.currentZoom) * 10) / 10;
                this.editor.layers.background.add(new Konva.Text({
                    x: 5 / this.currentZoom,
                    y: i - 15 / this.currentZoom,
                    text: `${meters}m`,
                    fontSize: 10 / this.currentZoom,
                    fill: this.editor.cssColors.gridLabel
                }));
            }
        }
        
        this.editor.layers.background.batchDraw();
    }
    
    /**
     * Pixel을 Meter로 변환
     * @param {number} pixels - 픽셀 값
     * @returns {number} - 미터 값
     */
    pixelsToMeters(pixels) {
        return pixels / this.getCurrentScale();
    }
    
    /**
     * Meter를 Pixel로 변환
     * @param {number} meters - 미터 값
     * @returns {number} - 픽셀 값
     */
    metersToPixels(meters) {
        return meters * this.getCurrentScale();
    }
    
    /**
     * 정리
     */
    destroy() {
        this.deactivate();
        console.log('✅ ZoomController destroyed');
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoomController;
}