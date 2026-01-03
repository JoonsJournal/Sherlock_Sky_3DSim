/**
 * GridSnap.js v1.1.0
 * ===================
 * 
 * 그리드 스냅 기능을 제공하는 모듈
 * 
 * ✨ v1.1.0 수정:
 * - ✅ 동적 Grid 기능 비활성화 (항상 10px 고정)
 * - ✅ InfiniteGridZoomController와 동기화
 * - ✅ getActualGridSize() 메서드 추가 - 실제 Grid 크기 반환
 * - ✅ Zoom 레벨과 무관하게 일관된 Snap
 * 
 * @version 1.1.0 - Phase 5.1
 * @module GridSnap
 * 
 * 역할:
 * 1. 그리드 기반 스냅 계산
 * 2. ✨ 고정 Grid 크기 (10px) - InfiniteGridZoomController와 일치
 * 3. 메이저/마이너 그리드 지원
 * 4. 그리드 렌더링
 * 5. 그리드 원점 오프셋
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/snap/GridSnap.js
 */

class GridSnap {
    /**
     * @param {Object} options - 옵션
     */
    constructor(options = {}) {
        // 설정
        this.config = {
            // ✨ v1.1.0: 기본 그리드 크기 (고정값, InfiniteGridZoomController와 동일)
            gridSize: options.gridSize || 10,
            
            // 메이저 그리드 간격 (gridSize의 배수)
            majorInterval: options.majorInterval || 10,
            
            // ✨ v1.1.0: 동적 그리드 비활성화 (기본값 false로 변경)
            dynamicGrid: options.dynamicGrid || false,
            
            // Zoom 레벨별 그리드 크기 (동적 Grid 비활성화 시 사용 안함)
            zoomLevels: options.zoomLevels || [
                { zoom: 0.25, gridSize: 10 },  // ✨ 모두 10px로 고정
                { zoom: 0.5, gridSize: 10 },
                { zoom: 1, gridSize: 10 },
                { zoom: 2, gridSize: 10 },
                { zoom: 4, gridSize: 10 }
            ],
            
            // 그리드 원점 오프셋
            originX: options.originX || 0,
            originY: options.originY || 0,
            
            // 스냅 threshold
            snapThreshold: options.snapThreshold || 10,
            
            // 메이저 그리드 우선 스냅
            preferMajorGrid: options.preferMajorGrid || false,
            
            // 그리드 표시 설정
            showGrid: options.showGrid !== false,
            showLabels: options.showLabels !== false,
            
            // 색상
            colors: {
                minor: options.minorColor || '#e0e0e0',
                major: options.majorColor || '#c0c0c0',
                label: options.labelColor || '#999999',
                background: options.backgroundColor || '#ffffff'
            }
        };
        
        // 현재 Zoom 레벨
        this.currentZoom = 1;
        
        // ✨ v1.1.0: 현재 적용 중인 그리드 크기 (항상 config.gridSize와 동일)
        this.currentGridSize = this.config.gridSize;
        
        // 레이어 참조
        this.gridLayer = null;
        
        // 그리드 Shape들
        this.gridLines = [];
        this.gridLabels = [];
        
        console.log('[GridSnap] 초기화 완료 v1.1.0 (고정 Grid: 10px)');
    }
    
    // =====================================================
    // 스냅 계산
    // =====================================================
    
    /**
     * 포인트를 그리드에 스냅
     * ✨ v1.1.0: 항상 고정된 gridSize(10px) 사용
     * @param {number} x
     * @param {number} y
     * @returns {Object} { x, y, gridSize, snappedToMajor }
     */
    snapPoint(x, y) {
        // ✨ v1.1.0: 항상 고정된 Grid 크기 사용
        const gridSize = this.config.gridSize;  // 항상 10px
        const majorSize = gridSize * this.config.majorInterval;
        
        // 오프셋 적용
        const offsetX = x - this.config.originX;
        const offsetY = y - this.config.originY;
        
        let snappedX, snappedY;
        let snappedToMajor = false;
        
        if (this.config.preferMajorGrid) {
            // 메이저 그리드 우선
            const majorSnapX = Math.round(offsetX / majorSize) * majorSize;
            const majorSnapY = Math.round(offsetY / majorSize) * majorSize;
            
            const minorSnapX = Math.round(offsetX / gridSize) * gridSize;
            const minorSnapY = Math.round(offsetY / gridSize) * gridSize;
            
            const majorDistX = Math.abs(offsetX - majorSnapX);
            const minorDistX = Math.abs(offsetX - minorSnapX);
            const majorDistY = Math.abs(offsetY - majorSnapY);
            const minorDistY = Math.abs(offsetY - minorSnapY);
            
            if (majorDistX <= this.config.snapThreshold / 2) {
                snappedX = majorSnapX;
                snappedToMajor = true;
            } else {
                snappedX = minorSnapX;
            }
            
            if (majorDistY <= this.config.snapThreshold / 2) {
                snappedY = majorSnapY;
                snappedToMajor = true;
            } else {
                snappedY = minorSnapY;
            }
        } else {
            // 일반 스냅
            snappedX = Math.round(offsetX / gridSize) * gridSize;
            snappedY = Math.round(offsetY / gridSize) * gridSize;
            
            // 메이저 그리드 여부 확인
            snappedToMajor = (snappedX % majorSize === 0) && (snappedY % majorSize === 0);
        }
        
        // 오프셋 복원
        snappedX += this.config.originX;
        snappedY += this.config.originY;
        
        return {
            x: snappedX,
            y: snappedY,
            originalX: x,
            originalY: y,
            gridSize: gridSize,
            snappedToMajor: snappedToMajor,
            deltaX: snappedX - x,
            deltaY: snappedY - y
        };
    }
    
    /**
     * Shape를 그리드에 스냅
     * @param {Konva.Shape} shape
     * @returns {Object} 스냅 결과
     */
    snapShape(shape) {
        if (!shape) return null;
        
        const result = this.snapPoint(shape.x(), shape.y());
        
        shape.x(result.x);
        shape.y(result.y);
        
        return result;
    }
    
    /**
     * 값을 그리드 크기에 맞춤
     * @param {number} value
     * @returns {number}
     */
    snapValue(value) {
        const gridSize = this.config.gridSize;  // ✨ 항상 고정값
        return Math.round(value / gridSize) * gridSize;
    }
    
    /**
     * 크기를 그리드에 맞춤
     * @param {number} width
     * @param {number} height
     * @returns {Object} { width, height }
     */
    snapSize(width, height) {
        const gridSize = this.config.gridSize;  // ✨ 항상 고정값
        return {
            width: Math.round(width / gridSize) * gridSize,
            height: Math.round(height / gridSize) * gridSize
        };
    }
    
    // =====================================================
    // Zoom 레벨 연동 (v1.1.0: 참조용으로만 사용)
    // =====================================================
    
    /**
     * Zoom 레벨 설정
     * ✨ v1.1.0: Zoom 레벨만 저장, Grid 크기는 변경하지 않음
     * @param {number} zoom
     */
    setZoomLevel(zoom) {
        this.currentZoom = zoom;
        
        // ✨ v1.1.0: 동적 Grid 비활성화 - Grid 크기 변경 안함
        // 항상 config.gridSize (10px) 유지
        this.currentGridSize = this.config.gridSize;
        
        console.log(`[GridSnap] Zoom: ${zoom.toFixed(2)}, Grid: ${this.currentGridSize}px (고정)`);
    }
    
    /**
     * Zoom 레벨에 따른 그리드 크기 계산
     * ✨ v1.1.0: 항상 고정값 반환
     * @private
     */
    _calculateGridSize(zoom) {
        // ✨ v1.1.0: 동적 Grid 비활성화로 항상 고정값 반환
        return this.config.gridSize;
    }
    
    /**
     * 현재 그리드 크기 반환
     * ✨ v1.1.0: 항상 고정값 (10px) 반환
     * @returns {number}
     */
    getCurrentGridSize() {
        return this.config.gridSize;  // ✨ 항상 10px
    }
    
    /**
     * ✨ v1.1.0: 실제 Grid 크기 반환 (InfiniteGridZoomController와 동기화)
     * @returns {number}
     */
    getActualGridSize() {
        // 전역 참조에서 가져오기 시도
        if (typeof window !== 'undefined' && window.currentGridSize) {
            return window.currentGridSize;
        }
        return this.config.gridSize;
    }
    
    /**
     * 현재 메이저 그리드 크기 반환
     * @returns {number}
     */
    getMajorGridSize() {
        return this.config.gridSize * this.config.majorInterval;
    }
    
    // =====================================================
    // 그리드 렌더링
    // =====================================================
    
    /**
     * 그리드 레이어 설정
     * @param {Konva.Layer} layer
     */
    setGridLayer(layer) {
        this.gridLayer = layer;
    }
    
    /**
     * 그리드 그리기
     * @param {number} width - 캔버스 너비
     * @param {number} height - 캔버스 높이
     */
    drawGrid(width, height) {
        if (!this.gridLayer || !this.config.showGrid) return;
        
        this.clearGrid();
        
        const gridSize = this.config.gridSize;  // ✨ 항상 고정값
        const majorInterval = this.config.majorInterval;
        const colors = this.config.colors;
        
        // 배경
        const background = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: colors.background,
            listening: false,
            name: 'grid-background'
        });
        this.gridLayer.add(background);
        
        // 수직선
        for (let x = 0; x <= width; x += gridSize) {
            const isMajor = (x % (gridSize * majorInterval)) === 0;
            
            const line = new Konva.Line({
                points: [x, 0, x, height],
                stroke: isMajor ? colors.major : colors.minor,
                strokeWidth: isMajor ? 1 : 0.5,
                listening: false,
                name: 'grid-line-vertical'
            });
            
            this.gridLines.push(line);
            this.gridLayer.add(line);
            
            // 라벨 (메이저 그리드)
            if (isMajor && this.config.showLabels && x > 0) {
                const label = new Konva.Text({
                    x: x + 2,
                    y: 2,
                    text: `${x}`,
                    fontSize: 10,
                    fill: colors.label,
                    listening: false,
                    name: 'grid-label'
                });
                this.gridLabels.push(label);
                this.gridLayer.add(label);
            }
        }
        
        // 수평선
        for (let y = 0; y <= height; y += gridSize) {
            const isMajor = (y % (gridSize * majorInterval)) === 0;
            
            const line = new Konva.Line({
                points: [0, y, width, y],
                stroke: isMajor ? colors.major : colors.minor,
                strokeWidth: isMajor ? 1 : 0.5,
                listening: false,
                name: 'grid-line-horizontal'
            });
            
            this.gridLines.push(line);
            this.gridLayer.add(line);
            
            // 라벨 (메이저 그리드)
            if (isMajor && this.config.showLabels && y > 0) {
                const label = new Konva.Text({
                    x: 2,
                    y: y + 2,
                    text: `${y}`,
                    fontSize: 10,
                    fill: colors.label,
                    listening: false,
                    name: 'grid-label'
                });
                this.gridLabels.push(label);
                this.gridLayer.add(label);
            }
        }
        
        this.gridLayer.batchDraw();
        console.log(`[GridSnap] 그리드 렌더링 완료 (gridSize: ${gridSize}px - 고정)`);
    }
    
    /**
     * 그리드 지우기
     */
    clearGrid() {
        if (!this.gridLayer) return;
        
        this.gridLines.forEach(line => line.destroy());
        this.gridLabels.forEach(label => label.destroy());
        
        this.gridLines = [];
        this.gridLabels = [];
        
        const background = this.gridLayer.findOne('.grid-background');
        if (background) background.destroy();
    }
    
    /**
     * 그리드 다시 그리기
     * @param {number} width
     * @param {number} height
     */
    redrawGrid(width, height) {
        this.drawGrid(width, height);
    }
    
    // =====================================================
    // 그리드 설정
    // =====================================================
    
    /**
     * 그리드 크기 설정
     * @param {number} size
     */
    setGridSize(size) {
        this.config.gridSize = size;
        this.currentGridSize = size;
        console.log(`[GridSnap] Grid 크기 설정: ${size}px`);
    }
    
    /**
     * 메이저 간격 설정
     * @param {number} interval
     */
    setMajorInterval(interval) {
        this.config.majorInterval = interval;
    }
    
    /**
     * 그리드 원점 설정
     * @param {number} x
     * @param {number} y
     */
    setOrigin(x, y) {
        this.config.originX = x;
        this.config.originY = y;
    }
    
    /**
     * 색상 설정
     * @param {Object} colors - { minor, major, label, background }
     */
    setColors(colors) {
        this.config.colors = { ...this.config.colors, ...colors };
    }
    
    /**
     * 그리드 표시 설정
     * @param {boolean} show
     */
    setShowGrid(show) {
        this.config.showGrid = show;
        
        if (this.gridLayer) {
            this.gridLayer.visible(show);
            this.gridLayer.batchDraw();
        }
    }
    
    /**
     * 라벨 표시 설정
     * @param {boolean} show
     */
    setShowLabels(show) {
        this.config.showLabels = show;
    }
    
    /**
     * 동적 그리드 설정
     * ✨ v1.1.0: 기본적으로 비활성화됨
     * @param {boolean} enabled
     */
    setDynamicGrid(enabled) {
        this.config.dynamicGrid = enabled;
        
        if (!enabled) {
            this.currentGridSize = this.config.gridSize;
        } else {
            this.currentGridSize = this._calculateGridSize(this.currentZoom);
        }
        
        console.log(`[GridSnap] 동적 Grid: ${enabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * Zoom 레벨 설정
     * @param {Array} levels - [{ zoom, gridSize }, ...]
     */
    setZoomLevels(levels) {
        this.config.zoomLevels = levels;
    }
    
    // =====================================================
    // 유틸리티
    // =====================================================
    
    /**
     * 좌표가 그리드 선 위에 있는지 확인
     * @param {number} x
     * @param {number} y
     * @param {number} tolerance
     * @returns {Object} { onVertical, onHorizontal, onMajor }
     */
    isOnGridLine(x, y, tolerance = 1) {
        const gridSize = this.config.gridSize;
        const majorSize = gridSize * this.config.majorInterval;
        
        const offsetX = x - this.config.originX;
        const offsetY = y - this.config.originY;
        
        const onVertical = Math.abs(offsetX % gridSize) < tolerance;
        const onHorizontal = Math.abs(offsetY % gridSize) < tolerance;
        const onMajorV = Math.abs(offsetX % majorSize) < tolerance;
        const onMajorH = Math.abs(offsetY % majorSize) < tolerance;
        
        return {
            onVertical,
            onHorizontal,
            onGrid: onVertical || onHorizontal,
            onMajor: onMajorV || onMajorH
        };
    }
    
    /**
     * 가장 가까운 그리드 교차점 찾기
     * @param {number} x
     * @param {number} y
     * @returns {Object} { x, y }
     */
    getNearestIntersection(x, y) {
        return this.snapPoint(x, y);
    }
    
    /**
     * 그리드 좌표를 픽셀 좌표로 변환
     * @param {number} gridX
     * @param {number} gridY
     * @returns {Object} { x, y }
     */
    gridToPixel(gridX, gridY) {
        const gridSize = this.config.gridSize;
        return {
            x: gridX * gridSize + this.config.originX,
            y: gridY * gridSize + this.config.originY
        };
    }
    
    /**
     * 픽셀 좌표를 그리드 좌표로 변환
     * @param {number} pixelX
     * @param {number} pixelY
     * @returns {Object} { x, y }
     */
    pixelToGrid(pixelX, pixelY) {
        const gridSize = this.config.gridSize;
        return {
            x: Math.floor((pixelX - this.config.originX) / gridSize),
            y: Math.floor((pixelY - this.config.originY) / gridSize)
        };
    }
    
    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }
    
    // =====================================================
    // 토글 메서드
    // =====================================================
    
    /**
     * 그리드 표시 토글
     * @returns {boolean} 새 상태
     */
    toggleGrid() {
        this.config.showGrid = !this.config.showGrid;
        
        if (this.gridLayer) {
            this.gridLayer.visible(this.config.showGrid);
            this.gridLayer.batchDraw();
        }
        
        return this.config.showGrid;
    }
    
    /**
     * 동적 그리드 토글
     * @returns {boolean} 새 상태
     */
    toggleDynamicGrid() {
        this.setDynamicGrid(!this.config.dynamicGrid);
        return this.config.dynamicGrid;
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 정리
     */
    clear() {
        this.clearGrid();
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.gridLayer = null;
        console.log('[GridSnap] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.GridSnap = GridSnap;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridSnap;
}