/**
 * SmartGuideManager.js
 * =====================
 * 
 * 스마트 가이드 시스템 통합 관리자
 * 
 * @version 1.0.0 - Phase 1.5
 * @module SmartGuideManager
 * 
 * 역할:
 * 1. 드래그/리사이즈 중 정렬 가이드라인 표시
 * 2. 객체 간 정렬 감지 (좌/우/상/하/중앙)
 * 3. 거리 표시 (Distance Indicator)
 * 4. 스마트 스냅 (자동 정렬)
 * 5. 가이드라인 스타일 관리
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/guides/SmartGuideManager.js
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
        
        // 가이드라인 설정
        this.config = {
            // 활성화
            enabled: options.enabled !== false,
            
            // 스냅 설정
            snapEnabled: options.snapEnabled !== false,
            snapThreshold: options.snapThreshold || 5, // 스냅 거리 (px)
            
            // 가이드라인 스타일
            lineColor: options.lineColor || '#667eea',
            lineWidth: options.lineWidth || 1,
            lineDash: options.lineDash || [4, 4],
            
            // 거리 표시
            showDistance: options.showDistance !== false,
            distanceColor: options.distanceColor || '#667eea',
            distanceFontSize: options.distanceFontSize || 10,
            
            // 정렬 타입 활성화
            alignEdges: options.alignEdges !== false,    // 모서리 정렬
            alignCenters: options.alignCenters !== false, // 중앙 정렬
            alignSpacing: options.alignSpacing || false,  // 간격 정렬
            
            // 확장 범위 (Stage 밖으로 가이드라인 연장)
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
        
        // 참조 객체들 (다른 객체들)
        this.referenceObjects = [];
        
        // 콜백
        this.callbacks = {
            onSnap: options.onSnap || null,
            onGuideShow: options.onGuideShow || null,
            onGuideHide: options.onGuideHide || null
        };
        
        console.log('[SmartGuideManager] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // 활성화 / 비활성화
    // =====================================================
    
    /**
     * 스마트 가이드 활성화
     */
    enable() {
        this.config.enabled = true;
    }
    
    /**
     * 스마트 가이드 비활성화
     */
    disable() {
        this.config.enabled = false;
        this.clearGuides();
    }
    
    /**
     * 활성화 상태 확인
     * @returns {boolean}
     */
    isEnabled() {
        return this.config.enabled;
    }
    
    /**
     * 스냅 활성화/비활성화
     * @param {boolean} enabled
     */
    setSnapEnabled(enabled) {
        this.config.snapEnabled = enabled;
    }
    
    // =====================================================
    // 참조 객체 관리
    // =====================================================
    
    /**
     * 참조 객체 설정 (드래그 중인 객체 제외한 다른 객체들)
     * @param {Array<Konva.Shape>} objects - 참조 객체 배열
     * @param {Array<Konva.Shape>} exclude - 제외할 객체 배열
     */
    setReferenceObjects(objects, exclude = []) {
        this.referenceObjects = objects.filter(obj => !exclude.includes(obj));
    }
    
    /**
     * 참조 객체 추가
     * @param {Konva.Shape} object
     */
    addReferenceObject(object) {
        if (!this.referenceObjects.includes(object)) {
            this.referenceObjects.push(object);
        }
    }
    
    /**
     * 참조 객체 제거
     * @param {Konva.Shape} object
     */
    removeReferenceObject(object) {
        const index = this.referenceObjects.indexOf(object);
        if (index !== -1) {
            this.referenceObjects.splice(index, 1);
        }
    }
    
    /**
     * 참조 객체 초기화
     */
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
        
        // 기존 가이드라인 제거
        this.clearGuides();
        
        // 드래그 객체의 경계 상자
        const dragRect = draggedObject.getClientRect();
        const dragPoints = this._getAlignmentPoints(dragRect);
        
        // 스냅 결과
        let snapX = null;
        let snapY = null;
        let snapDeltaX = 0;
        let snapDeltaY = 0;
        
        // 각 참조 객체와 비교
        this.referenceObjects.forEach(refObject => {
            const refRect = refObject.getClientRect();
            const refPoints = this._getAlignmentPoints(refRect);
            
            // 수직 정렬선 체크 (X축)
            if (this.config.alignEdges) {
                // 좌측 모서리
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
                
                // 우측 모서리
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
                // 상단 모서리
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
                
                // 하단 모서리
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
        
        // 현재 스냅 상태 저장
        this.currentSnaps = {
            horizontal: snapY,
            vertical: snapX
        };
        
        // 레이어 갱신
        this.uiLayer.batchDraw();
        
        // 스냅 콜백
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
        const threshold = this.config.snapThreshold * 2; // 표시용 threshold
        
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
            // 수직선 (X 고정)
            line = new Konva.Line({
                points: [position, -extension, position, refRect.y + refRect.height + extension],
                stroke: this.config.lineColor,
                strokeWidth: this.config.lineWidth,
                dash: this.config.lineDash,
                listening: false,
                name: 'smart-guide-line'
            });
        } else {
            // 수평선 (Y 고정)
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
        
        // 가이드 표시 콜백
        if (this.callbacks.onGuideShow) {
            this.callbacks.onGuideShow({ position, direction });
        }
    }
    
    /**
     * 거리 라벨 추가
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} distance - 거리
     * @param {string} direction - 'horizontal' | 'vertical'
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
    
    /**
     * 모든 가이드라인 제거
     */
    clearGuides() {
        // 가이드라인 제거
        this.guideLines.forEach(line => line.destroy());
        this.guideLines = [];
        
        // 거리 라벨 제거
        this.distanceLabels.forEach(label => label.destroy());
        this.distanceLabels = [];
        
        // 현재 스냅 상태 초기화
        this.currentSnaps = {
            horizontal: null,
            vertical: null
        };
        
        this.uiLayer.batchDraw();
        
        // 가이드 숨김 콜백
        if (this.callbacks.onGuideHide) {
            this.callbacks.onGuideHide();
        }
    }
    
    // =====================================================
    // Room/Canvas 가이드라인
    // =====================================================
    
    /**
     * Room 경계 가이드라인 추가
     * @param {Object} roomRect - { x, y, width, height }
     */
    addRoomGuides(roomRect) {
        if (!this.config.enabled) return;
        
        const guides = [
            // 좌측 경계
            { points: [roomRect.x, 0, roomRect.x, roomRect.y + roomRect.height], name: 'room-left' },
            // 우측 경계
            { points: [roomRect.x + roomRect.width, 0, roomRect.x + roomRect.width, roomRect.y + roomRect.height], name: 'room-right' },
            // 상단 경계
            { points: [0, roomRect.y, roomRect.x + roomRect.width, roomRect.y], name: 'room-top' },
            // 하단 경계
            { points: [0, roomRect.y + roomRect.height, roomRect.x + roomRect.width, roomRect.y + roomRect.height], name: 'room-bottom' },
            // 수평 중앙
            { points: [0, roomRect.y + roomRect.height / 2, roomRect.x + roomRect.width, roomRect.y + roomRect.height / 2], name: 'room-center-h' },
            // 수직 중앙
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
    
    /**
     * 가이드라인 색상 설정
     * @param {string} color
     */
    setLineColor(color) {
        this.config.lineColor = color;
    }
    
    /**
     * 가이드라인 스타일 설정
     * @param {Object} style - { color, width, dash }
     */
    setLineStyle(style) {
        if (style.color) this.config.lineColor = style.color;
        if (style.width) this.config.lineWidth = style.width;
        if (style.dash) this.config.lineDash = style.dash;
    }
    
    /**
     * 스냅 threshold 설정
     * @param {number} threshold
     */
    setSnapThreshold(threshold) {
        this.config.snapThreshold = threshold;
    }
    
    // =====================================================
    // 정렬 타입 설정
    // =====================================================
    
    /**
     * 모서리 정렬 활성화/비활성화
     * @param {boolean} enabled
     */
    setAlignEdges(enabled) {
        this.config.alignEdges = enabled;
    }
    
    /**
     * 중앙 정렬 활성화/비활성화
     * @param {boolean} enabled
     */
    setAlignCenters(enabled) {
        this.config.alignCenters = enabled;
    }
    
    /**
     * 간격 정렬 활성화/비활성화
     * @param {boolean} enabled
     */
    setAlignSpacing(enabled) {
        this.config.alignSpacing = enabled;
    }
    
    /**
     * 거리 표시 활성화/비활성화
     * @param {boolean} enabled
     */
    setShowDistance(enabled) {
        this.config.showDistance = enabled;
    }
    
    // =====================================================
    // 콜백 설정
    // =====================================================
    
    /**
     * 콜백 설정
     * @param {string} name
     * @param {Function} callback
     */
    setCallback(name, callback) {
        if (this.callbacks.hasOwnProperty(name)) {
            this.callbacks[name] = callback;
        }
    }
    
    // =====================================================
    // 상태 조회
    // =====================================================
    
    /**
     * 현재 스냅 상태 반환
     * @returns {Object}
     */
    getCurrentSnaps() {
        return { ...this.currentSnaps };
    }
    
    /**
     * 가이드라인 표시 중인지 확인
     * @returns {boolean}
     */
    hasActiveGuides() {
        return this.guideLines.length > 0;
    }
    
    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 정리
     */
    clear() {
        this.clearGuides();
        this.clearReferenceObjects();
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.uiLayer = null;
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

