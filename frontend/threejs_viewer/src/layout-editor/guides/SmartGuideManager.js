/**
 * SmartGuideManager.js v1.2.0
 * ============================
 * 
 * ✨ v1.2.0 수정 (Phase 5.2 - CoordinateTransformer 통합):
 * - ✅ CoordinateTransformer 사용으로 좌표 변환 통일
 * - ✅ _screenToStage() → coordinateTransformer.screenToCanvas() 교체
 * - ✅ _getStageRect() → coordinateTransformer.getShapeStageRect() 교체
 * - ✅ _initCoordinateTransformer() 메서드 추가
 * 
 * ✨ v1.1.1 수정:
 * - ✅ setSnapEnabled(boolean) 메서드 추가 (외부 동기화용)
 * - ✅ isSnapEnabled() 메서드 추가
 * 
 * ✨ v1.1.0 수정:
 * - ✅ Stage 좌표계 사용으로 변경 (getClientRect → getStageRect)
 * - ✅ Zoom 레벨 고려한 좌표 계산
 * - ✅ _getStageRect() 헬퍼 메서드 추가
 * - ✅ 가이드라인이 올바른 위치에 표시되도록 수정
 * 
 * @version 1.2.0 - Phase 5.2
 * @module SmartGuideManager
 * 
 * 역할:
 * 1. 드래그/리사이즈 중 정렬 가이드라인 표시
 * 2. 객체 간 정렬 감지 (좌/우/상/하/중앙)
 * 3. 거리 표시 (Distance Indicator)
 * 4. 스마트 스냅 (자동 정렬)
 * 5. 가이드라인 스타일 관리
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/guides/SmartGuideManager.js
 */

class SmartGuideManager {
    /**
     * @param {Konva.Layer} uiLayer - UI 레이어 (가이드라인 표시용)
     * @param {Object} options - 옵션
     */
    constructor(uiLayer, options = {}) {
        if (!uiLayer) {
            throw new Error('[SmartGuideManager] UI Layer가 필요합니다');
        }
        
        this.uiLayer = uiLayer;
        
        // Stage 참조 저장 (좌표 변환용)
        this.stage = options.stage || null;
        
        // ✨ v1.2.0: CoordinateTransformer 초기화
        this.coordinateTransformer = null;
        this._initCoordinateTransformer();
        
        // 가이드라인 설정
        this.config = {
            // 활성화
            enabled: options.enabled !== false,
            
            // 스냅 설정
            snapEnabled: options.snapEnabled !== false,
            snapThreshold: options.snapThreshold || 5,
            
            // 가이드라인 스타일
            lineColor: options.lineColor || '#667eea',
            lineWidth: options.lineWidth || 1,
            lineDash: options.lineDash || [4, 4],
            
            // 거리 표시
            showDistance: options.showDistance !== false,
            distanceColor: options.distanceColor || '#667eea',
            distanceFontSize: options.distanceFontSize || 10,
            
            // 정렬 타입 활성화
            alignEdges: options.alignEdges !== false,
            alignCenters: options.alignCenters !== false,
            alignSpacing: options.alignSpacing || false,
            
            // 확장 범위
            extendLines: options.extendLines !== false,
            lineExtension: options.lineExtension || 1000
        };
        
        // 가이드라인 Shape들
        this.guideLines = [];
        this.distanceLabels = [];
        
        // 현재 스냅 상태
        this.currentSnaps = {
            horizontal: null,
            vertical: null
        };
        
        // 참조 객체들
        this.referenceObjects = [];
        
        // 콜백
        this.callbacks = {
            onSnap: options.onSnap || null,
            onGuideShow: options.onGuideShow || null,
            onGuideHide: options.onGuideHide || null
        };
        
        console.log('[SmartGuideManager] 초기화 완료 v1.2.0 (CoordinateTransformer 통합)');
    }
    
    // =====================================================
    // ✨ v1.2.0: CoordinateTransformer 초기화
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
            console.log('[SmartGuideManager] CoordinateTransformer 초기화 완료');
        } else {
            console.warn('[SmartGuideManager] CoordinateTransformer를 찾을 수 없거나 Stage가 없습니다. 기본 좌표 변환 사용.');
        }
    }
    
    // =====================================================
    // Stage 설정 및 좌표 변환
    // =====================================================
    
    /**
     * Stage 설정 (좌표 변환용)
     * @param {Konva.Stage} stage
     */
    setStage(stage) {
        this.stage = stage;
        
        // CoordinateTransformer도 업데이트
        if (this.coordinateTransformer) {
            this.coordinateTransformer.setStage(stage);
        } else {
            // Stage가 새로 설정되면 CoordinateTransformer 초기화 시도
            this._initCoordinateTransformer();
        }
    }
    
    /**
     * Shape의 Stage 좌표계 Rect 반환
     * @param {Konva.Shape} shape
     * @returns {Object} { x, y, width, height }
     */
    _getStageRect(shape) {
        if (!shape) return null;
        
        // ✨ v1.2.0: CoordinateTransformer 사용
        if (this.coordinateTransformer) {
            return this.coordinateTransformer.getShapeStageRect(shape);
        }
        
        // 폴백: 직접 계산
        const absPos = shape.getAbsolutePosition();
        const size = shape.size ? shape.size() : { width: shape.width?.() || 0, height: shape.height?.() || 0 };
        
        if (shape.nodeType === 'Group' || !size.width) {
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
        
        return {
            x: shape.x(),
            y: shape.y(),
            width: size.width,
            height: size.height
        };
    }
    
    /**
     * Screen 좌표를 Stage 좌표로 변환
     * @param {number} screenX
     * @param {number} screenY
     * @returns {Object} { x, y }
     */
    _screenToStage(screenX, screenY) {
        // ✨ v1.2.0: CoordinateTransformer 사용
        if (this.coordinateTransformer) {
            return this.coordinateTransformer.screenToCanvas(screenX, screenY);
        }
        
        // 폴백: 직접 계산
        if (!this.stage) {
            return { x: screenX, y: screenY };
        }
        
        const zoom = this.stage.scaleX() || 1;
        const stagePos = this.stage.position() || { x: 0, y: 0 };
        
        return {
            x: (screenX - stagePos.x) / zoom,
            y: (screenY - stagePos.y) / zoom
        };
    }
    
    /**
     * 현재 Zoom 레벨 가져오기
     * @returns {number}
     */
    _getZoomLevel() {
        if (this.coordinateTransformer) {
            return this.coordinateTransformer.getZoomLevel();
        }
        return this.stage?.scaleX() || 1;
    }
    
    // =====================================================
    // 활성화 / 비활성화
    // =====================================================
    
    enable() {
        this.config.enabled = true;
        console.log('[SmartGuideManager] 가이드라인 활성화');
    }
    
    disable() {
        this.config.enabled = false;
        this.clearGuides();
        console.log('[SmartGuideManager] 가이드라인 비활성화');
    }
    
    isEnabled() {
        return this.config.enabled;
    }
    
    /**
     * ✨ v1.1.1: Snap 활성화 설정 (외부 동기화용)
     * @param {boolean} enabled
     */
    setSnapEnabled(enabled) {
        this.config.snapEnabled = enabled;
        console.log(`[SmartGuideManager] snapEnabled: ${enabled}`);
    }
    
    /**
     * ✨ v1.1.1: Snap 활성화 상태 조회
     * @returns {boolean}
     */
    isSnapEnabled() {
        return this.config.snapEnabled;
    }
    
    // =====================================================
    // 참조 객체 관리
    // =====================================================
    
    setReferenceObjects(objects, exclude = []) {
        this.referenceObjects = objects.filter(obj => !exclude.includes(obj));
    }
    
    addReferenceObject(object) {
        if (!this.referenceObjects.includes(object)) {
            this.referenceObjects.push(object);
        }
    }
    
    removeReferenceObject(object) {
        const index = this.referenceObjects.indexOf(object);
        if (index !== -1) {
            this.referenceObjects.splice(index, 1);
        }
    }
    
    clearReferenceObjects() {
        this.referenceObjects = [];
    }
    
    // =====================================================
    // 가이드라인 업데이트 (핵심 메서드)
    // =====================================================
    
    /**
     * 드래그 중인 객체에 대한 가이드라인 업데이트
     * @param {Konva.Shape} draggedObject - 드래그 중인 객체
     * @returns {Object} 스냅 조정값 { x: number, y: number }
     */
    updateGuides(draggedObject) {
        if (!this.config.enabled || !draggedObject) {
            return { x: 0, y: 0 };
        }
        
        this.clearGuides();
        
        const dragRect = this._getStageRect(draggedObject);
        if (!dragRect) {
            return { x: 0, y: 0 };
        }
        
        const dragPoints = this._getAlignmentPoints(dragRect);
        
        let snapX = null;
        let snapY = null;
        let snapDeltaX = 0;
        let snapDeltaY = 0;
        
        this.referenceObjects.forEach(refObject => {
            const refRect = this._getStageRect(refObject);
            if (!refRect) return;
            
            const refPoints = this._getAlignmentPoints(refRect);
            
            // 수직 정렬선 체크 (X축)
            if (this.config.alignEdges) {
                const leftSnap = this._checkAlignment(dragPoints.left, refPoints.left, 'vertical');
                if (leftSnap) {
                    this._addGuideLine(leftSnap.position, 'vertical', refRect);
                    if (this.config.snapEnabled && Math.abs(leftSnap.delta) < this.config.snapThreshold) {
                        if (snapX === null || Math.abs(leftSnap.delta) < Math.abs(snapDeltaX)) {
                            snapX = 'left';
                            snapDeltaX = leftSnap.delta;
                        }
                    }
                }
                
                const rightSnap = this._checkAlignment(dragPoints.right, refPoints.right, 'vertical');
                if (rightSnap) {
                    this._addGuideLine(rightSnap.position, 'vertical', refRect);
                    if (this.config.snapEnabled && Math.abs(rightSnap.delta) < this.config.snapThreshold) {
                        if (snapX === null || Math.abs(rightSnap.delta) < Math.abs(snapDeltaX)) {
                            snapX = 'right';
                            snapDeltaX = rightSnap.delta;
                        }
                    }
                }
            }
            
            // 수직 중앙 정렬
            if (this.config.alignCenters) {
                const centerXSnap = this._checkAlignment(dragPoints.centerX, refPoints.centerX, 'vertical');
                if (centerXSnap) {
                    this._addGuideLine(centerXSnap.position, 'vertical', refRect);
                    if (this.config.snapEnabled && Math.abs(centerXSnap.delta) < this.config.snapThreshold) {
                        if (snapX === null || Math.abs(centerXSnap.delta) < Math.abs(snapDeltaX)) {
                            snapX = 'centerX';
                            snapDeltaX = centerXSnap.delta;
                        }
                    }
                }
            }
            
            // 수평 정렬선 체크 (Y축)
            if (this.config.alignEdges) {
                const topSnap = this._checkAlignment(dragPoints.top, refPoints.top, 'horizontal');
                if (topSnap) {
                    this._addGuideLine(topSnap.position, 'horizontal', refRect);
                    if (this.config.snapEnabled && Math.abs(topSnap.delta) < this.config.snapThreshold) {
                        if (snapY === null || Math.abs(topSnap.delta) < Math.abs(snapDeltaY)) {
                            snapY = 'top';
                            snapDeltaY = topSnap.delta;
                        }
                    }
                }
                
                const bottomSnap = this._checkAlignment(dragPoints.bottom, refPoints.bottom, 'horizontal');
                if (bottomSnap) {
                    this._addGuideLine(bottomSnap.position, 'horizontal', refRect);
                    if (this.config.snapEnabled && Math.abs(bottomSnap.delta) < this.config.snapThreshold) {
                        if (snapY === null || Math.abs(bottomSnap.delta) < Math.abs(snapDeltaY)) {
                            snapY = 'bottom';
                            snapDeltaY = bottomSnap.delta;
                        }
                    }
                }
            }
            
            // 수평 중앙 정렬
            if (this.config.alignCenters) {
                const centerYSnap = this._checkAlignment(dragPoints.centerY, refPoints.centerY, 'horizontal');
                if (centerYSnap) {
                    this._addGuideLine(centerYSnap.position, 'horizontal', refRect);
                    if (this.config.snapEnabled && Math.abs(centerYSnap.delta) < this.config.snapThreshold) {
                        if (snapY === null || Math.abs(centerYSnap.delta) < Math.abs(snapDeltaY)) {
                            snapY = 'centerY';
                            snapDeltaY = centerYSnap.delta;
                        }
                    }
                }
            }
        });
        
        this.currentSnaps = {
            horizontal: snapY,
            vertical: snapX
        };
        
        this.uiLayer.batchDraw();
        
        if (this.callbacks.onSnap && (snapX || snapY)) {
            this.callbacks.onSnap({
                x: snapX,
                y: snapY,
                deltaX: snapDeltaX,
                deltaY: snapDeltaY
            });
        }
        
        return {
            x: this.config.snapEnabled ? snapDeltaX : 0,
            y: this.config.snapEnabled ? snapDeltaY : 0
        };
    }
    
    /**
     * 정렬 포인트 추출
     * @private
     */
    _getAlignmentPoints(rect) {
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
    
    /**
     * 정렬 체크
     * @private
     */
    _checkAlignment(dragValue, refValue, direction) {
        const delta = refValue - dragValue;
        const threshold = this.config.snapThreshold * 2;
        
        if (Math.abs(delta) < threshold) {
            return {
                position: refValue,
                delta: delta,
                direction: direction
            };
        }
        
        return null;
    }
    
    // =====================================================
    // 가이드라인 렌더링
    // =====================================================
    
    /**
     * 가이드라인 추가
     * @private
     */
    _addGuideLine(position, direction, refRect) {
        const extension = this.config.extendLines ? this.config.lineExtension : 0;
        
        let line;
        
        if (direction === 'vertical') {
            line = new Konva.Line({
                points: [position, -extension, position, refRect.y + refRect.height + extension],
                stroke: this.config.lineColor,
                strokeWidth: this.config.lineWidth,
                dash: this.config.lineDash,
                listening: false,
                name: 'smart-guide-line'
            });
        } else {
            line = new Konva.Line({
                points: [-extension, position, refRect.x + refRect.width + extension, position],
                stroke: this.config.lineColor,
                strokeWidth: this.config.lineWidth,
                dash: this.config.lineDash,
                listening: false,
                name: 'smart-guide-line'
            });
        }
        
        this.guideLines.push(line);
        this.uiLayer.add(line);
        
        if (this.callbacks.onGuideShow) {
            this.callbacks.onGuideShow({ position, direction });
        }
    }
    
    /**
     * 거리 라벨 추가
     */
    addDistanceLabel(x, y, distance, direction) {
        if (!this.config.showDistance) return;
        
        const label = new Konva.Label({
            x: x,
            y: y,
            listening: false,
            name: 'distance-label'
        });
        
        label.add(new Konva.Tag({
            fill: 'white',
            cornerRadius: 2,
            shadowColor: 'black',
            shadowBlur: 3,
            shadowOffset: { x: 1, y: 1 },
            shadowOpacity: 0.2
        }));
        
        label.add(new Konva.Text({
            text: `${Math.round(distance)}px`,
            fontSize: this.config.distanceFontSize,
            fontFamily: 'Arial, sans-serif',
            fill: this.config.distanceColor,
            padding: 3
        }));
        
        this.distanceLabels.push(label);
        this.uiLayer.add(label);
    }
    
    // =====================================================
    // 가이드라인 제거
    // =====================================================
    
    clearGuides() {
        this.guideLines.forEach(line => line.destroy());
        this.guideLines = [];
        
        this.distanceLabels.forEach(label => label.destroy());
        this.distanceLabels = [];
        
        this.currentSnaps = {
            horizontal: null,
            vertical: null
        };
        
        this.uiLayer.batchDraw();
        
        if (this.callbacks.onGuideHide) {
            this.callbacks.onGuideHide();
        }
    }
    
    // =====================================================
    // Room/Canvas 가이드라인
    // =====================================================
    
    addRoomGuides(roomRect) {
        if (!this.config.enabled) return;
        
        const guides = [
            { points: [roomRect.x, 0, roomRect.x, roomRect.y + roomRect.height], name: 'room-left' },
            { points: [roomRect.x + roomRect.width, 0, roomRect.x + roomRect.width, roomRect.y + roomRect.height], name: 'room-right' },
            { points: [0, roomRect.y, roomRect.x + roomRect.width, roomRect.y], name: 'room-top' },
            { points: [0, roomRect.y + roomRect.height, roomRect.x + roomRect.width, roomRect.y + roomRect.height], name: 'room-bottom' },
            { points: [0, roomRect.y + roomRect.height / 2, roomRect.x + roomRect.width, roomRect.y + roomRect.height / 2], name: 'room-center-h' },
            { points: [roomRect.x + roomRect.width / 2, 0, roomRect.x + roomRect.width / 2, roomRect.y + roomRect.height], name: 'room-center-v' }
        ];
        
        guides.forEach(guide => {
            const line = new Konva.Line({
                points: guide.points,
                stroke: this.config.lineColor,
                strokeWidth: this.config.lineWidth,
                dash: this.config.lineDash,
                opacity: 0.5,
                listening: false,
                name: guide.name
            });
            
            this.guideLines.push(line);
            this.uiLayer.add(line);
        });
        
        this.uiLayer.batchDraw();
    }
    
    // =====================================================
    // 스타일 설정
    // =====================================================
    
    setLineColor(color) {
        this.config.lineColor = color;
    }
    
    setLineStyle(style) {
        if (style.color) this.config.lineColor = style.color;
        if (style.width) this.config.lineWidth = style.width;
        if (style.dash) this.config.lineDash = style.dash;
    }
    
    setSnapThreshold(threshold) {
        this.config.snapThreshold = threshold;
    }
    
    setAlignEdges(enabled) {
        this.config.alignEdges = enabled;
    }
    
    setAlignCenters(enabled) {
        this.config.alignCenters = enabled;
    }
    
    setAlignSpacing(enabled) {
        this.config.alignSpacing = enabled;
    }
    
    setShowDistance(enabled) {
        this.config.showDistance = enabled;
    }
    
    setCallback(name, callback) {
        if (this.callbacks.hasOwnProperty(name)) {
            this.callbacks[name] = callback;
        }
    }
    
    // =====================================================
    // 상태 조회
    // =====================================================
    
    getCurrentSnaps() {
        return { ...this.currentSnaps };
    }
    
    hasActiveGuides() {
        return this.guideLines.length > 0;
    }
    
    getConfig() {
        return { ...this.config };
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    clear() {
        this.clearGuides();
        this.clearReferenceObjects();
    }
    
    destroy() {
        this.clear();
        
        if (this.coordinateTransformer) {
            this.coordinateTransformer.destroy();
            this.coordinateTransformer = null;
        }
        
        this.uiLayer = null;
        this.stage = null;
        this.callbacks = {};
        
        console.log('[SmartGuideManager] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.SmartGuideManager = SmartGuideManager;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartGuideManager;
}

console.log('✅ SmartGuideManager.js v1.2.0 로드 완료 (CoordinateTransformer 통합)');