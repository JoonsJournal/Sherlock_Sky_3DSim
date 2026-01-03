/**
 * SnapManager.js
 * ================
 * 
 * 스냅 시스템 통합 관리자
 * 
 * @version 1.0.0 - Phase 1.5
 * @module SnapManager
 * 
 * 역할:
 * 1. 그리드 스냅, 객체 스냅, 가이드 스냅 통합
 * 2. 스냅 우선순위 관리
 * 3. 동적 스냅 threshold (Zoom 레벨 연동)
 * 4. 스냅 시각화 (스냅 포인트 표시)
 * 5. 스냅 모드 전환 (Grid, Object, Guide, MICE)
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/snap/SnapManager.js
 */

class SnapManager {
    /**
     * @param {Object} options - 옵션
     */
    constructor(options = {}) {
        // 스냅 모듈 참조
        this.gridSnap = options.gridSnap || null;
        this.miceSnapPoints = options.miceSnapPoints || null;
        
        // 설정
        this.config = {
            // 전역 활성화
            enabled: options.enabled !== false,
            
            // 스냅 모드
            gridSnapEnabled: options.gridSnapEnabled !== false,
            objectSnapEnabled: options.objectSnapEnabled !== false,
            guideSnapEnabled: options.guideSnapEnabled !== false,
            miceSnapEnabled: options.miceSnapEnabled || false,
            
            // 스냅 threshold
            threshold: options.threshold || 10,
            
            // 동적 threshold (Zoom 레벨 연동)
            dynamicThreshold: options.dynamicThreshold !== false,
            minThreshold: options.minThreshold || 5,
            maxThreshold: options.maxThreshold || 20,
            
            // 우선순위 (숫자가 낮을수록 높은 우선순위)
            priority: options.priority || {
                mice: 1,
                object: 2,
                guide: 3,
                grid: 4
            },
            
            // 시각화
            showSnapIndicator: options.showSnapIndicator !== false,
            indicatorColor: options.indicatorColor || '#667eea',
            indicatorSize: options.indicatorSize || 8
        };
        
        // 현재 Zoom 레벨
        this.currentZoom = 1;
        
        // 현재 스냅 결과
        this.lastSnapResult = null;
        
        // 스냅 인디케이터
        this.snapIndicators = [];
        
        // UI 레이어 참조
        this.uiLayer = options.uiLayer || null;
        
        // 콜백
        this.callbacks = {
            onSnap: options.onSnap || null,
            onSnapModeChange: options.onSnapModeChange || null
        };
        
        console.log('[SnapManager] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // 스냅 모듈 설정
    // =====================================================
    
    /**
     * GridSnap 모듈 설정
     * @param {GridSnap} gridSnap
     */
    setGridSnap(gridSnap) {
        this.gridSnap = gridSnap;
    }
    
    /**
     * MICESnapPoints 모듈 설정
     * @param {MICESnapPoints} miceSnapPoints
     */
    setMICESnapPoints(miceSnapPoints) {
        this.miceSnapPoints = miceSnapPoints;
    }
    
    /**
     * UI 레이어 설정 (인디케이터 표시용)
     * @param {Konva.Layer} uiLayer
     */
    setUILayer(uiLayer) {
        this.uiLayer = uiLayer;
    }
    
    // =====================================================
    // 스냅 활성화/비활성화
    // =====================================================
    
    /**
     * 전역 스냅 활성화
     */
    enable() {
        this.config.enabled = true;
    }
    
    /**
     * 전역 스냅 비활성화
     */
    disable() {
        this.config.enabled = false;
        this.clearIndicators();
    }
    
    /**
     * 스냅 모드 설정
     * @param {string} mode - 'grid', 'object', 'guide', 'mice', 'all'
     * @param {boolean} enabled
     */
    setSnapMode(mode, enabled) {
        switch (mode) {
            case 'grid':
                this.config.gridSnapEnabled = enabled;
                break;
            case 'object':
                this.config.objectSnapEnabled = enabled;
                break;
            case 'guide':
                this.config.guideSnapEnabled = enabled;
                break;
            case 'mice':
                this.config.miceSnapEnabled = enabled;
                break;
            case 'all':
                this.config.gridSnapEnabled = enabled;
                this.config.objectSnapEnabled = enabled;
                this.config.guideSnapEnabled = enabled;
                this.config.miceSnapEnabled = enabled;
                break;
        }
        
        if (this.callbacks.onSnapModeChange) {
            this.callbacks.onSnapModeChange(mode, enabled);
        }
    }
    
    /**
     * 그리드 스냅만 활성화
     */
    setGridSnapOnly() {
        this.config.gridSnapEnabled = true;
        this.config.objectSnapEnabled = false;
        this.config.guideSnapEnabled = false;
        this.config.miceSnapEnabled = false;
    }
    
    /**
     * 객체 스냅만 활성화
     */
    setObjectSnapOnly() {
        this.config.gridSnapEnabled = false;
        this.config.objectSnapEnabled = true;
        this.config.guideSnapEnabled = false;
        this.config.miceSnapEnabled = false;
    }
    
    /**
     * MICE 스냅만 활성화
     */
    setMICESnapOnly() {
        this.config.gridSnapEnabled = false;
        this.config.objectSnapEnabled = false;
        this.config.guideSnapEnabled = false;
        this.config.miceSnapEnabled = true;
    }
    
    // =====================================================
    // Zoom 레벨 연동
    // =====================================================
    
    /**
     * Zoom 레벨 설정 (동적 threshold 계산용)
     * @param {number} zoom
     */
    setZoomLevel(zoom) {
        this.currentZoom = zoom;
        
        // GridSnap에도 전달
        if (this.gridSnap) {
            this.gridSnap.setZoomLevel(zoom);
        }
    }
    
    /**
     * 현재 threshold 계산 (Zoom 레벨 고려)
     * @returns {number}
     */
    getCurrentThreshold() {
        if (!this.config.dynamicThreshold) {
            return this.config.threshold;
        }
        
        // Zoom이 작을수록 threshold 증가
        const adjustedThreshold = this.config.threshold / this.currentZoom;
        
        return Math.max(
            this.config.minThreshold,
            Math.min(this.config.maxThreshold, adjustedThreshold)
        );
    }
    
    // =====================================================
    // 통합 스냅 (메인 메서드)
    // =====================================================
    
    /**
     * 포인트에 대한 스냅 계산
     * @param {number} x - 원본 X
     * @param {number} y - 원본 Y
     * @param {Object} options - 추가 옵션
     * @returns {Object} { x, y, snapped, snapType, snapInfo }
     */
    snap(x, y, options = {}) {
        if (!this.config.enabled) {
            return { x, y, snapped: false, snapType: null, snapInfo: null };
        }
        
        const threshold = this.getCurrentThreshold();
        const candidates = [];
        
        // 1. MICE 스냅 포인트 체크 (최고 우선순위)
        if (this.config.miceSnapEnabled && this.miceSnapPoints) {
            const miceResult = this.miceSnapPoints.findNearestSnapPoint(x, y, threshold);
            if (miceResult) {
                candidates.push({
                    x: miceResult.x,
                    y: miceResult.y,
                    distance: miceResult.distance,
                    priority: this.config.priority.mice,
                    type: 'mice',
                    info: miceResult
                });
            }
        }
        
        // 2. 객체 스냅 체크
        if (this.config.objectSnapEnabled && options.referenceObjects) {
            const objectResult = this._checkObjectSnap(x, y, options.referenceObjects, threshold);
            if (objectResult) {
                candidates.push({
                    ...objectResult,
                    priority: this.config.priority.object,
                    type: 'object'
                });
            }
        }
        
        // 3. 가이드 스냅 체크
        if (this.config.guideSnapEnabled && options.guides) {
            const guideResult = this._checkGuideSnap(x, y, options.guides, threshold);
            if (guideResult) {
                candidates.push({
                    ...guideResult,
                    priority: this.config.priority.guide,
                    type: 'guide'
                });
            }
        }
        
        // 4. 그리드 스냅 체크 (최저 우선순위)
        if (this.config.gridSnapEnabled && this.gridSnap) {
            const gridResult = this.gridSnap.snapPoint(x, y);
            const gridDistance = Math.hypot(gridResult.x - x, gridResult.y - y);
            
            if (gridDistance <= threshold) {
                candidates.push({
                    x: gridResult.x,
                    y: gridResult.y,
                    distance: gridDistance,
                    priority: this.config.priority.grid,
                    type: 'grid',
                    info: gridResult
                });
            }
        }
        
        // 우선순위 및 거리로 정렬
        candidates.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.distance - b.distance;
        });
        
        // 최적 스냅 선택
        if (candidates.length > 0) {
            const best = candidates[0];
            
            this.lastSnapResult = {
                x: best.x,
                y: best.y,
                snapped: true,
                snapType: best.type,
                snapInfo: best.info
            };
            
            // 인디케이터 표시
            if (this.config.showSnapIndicator && this.uiLayer) {
                this._showSnapIndicator(best.x, best.y, best.type);
            }
            
            // 콜백 호출
            if (this.callbacks.onSnap) {
                this.callbacks.onSnap(this.lastSnapResult);
            }
            
            return this.lastSnapResult;
        }
        
        // 스냅 없음
        this.lastSnapResult = { x, y, snapped: false, snapType: null, snapInfo: null };
        this.clearIndicators();
        
        return this.lastSnapResult;
    }
    
    /**
     * Shape에 대한 스냅 적용
     * @param {Konva.Shape} shape
     * @param {Object} options
     * @returns {Object} 스냅 결과
     */
    snapShape(shape, options = {}) {
        if (!shape) return null;
        
        const x = shape.x();
        const y = shape.y();
        
        const result = this.snap(x, y, options);
        
        if (result.snapped) {
            shape.x(result.x);
            shape.y(result.y);
        }
        
        return result;
    }
    
    /**
     * 다중 포인트 스냅 (Shape의 여러 포인트)
     * @param {Array<{x, y}>} points
     * @param {Object} options
     * @returns {Object} { deltaX, deltaY, snapped, snapType }
     */
    snapMultiplePoints(points, options = {}) {
        if (!this.config.enabled || !points || points.length === 0) {
            return { deltaX: 0, deltaY: 0, snapped: false, snapType: null };
        }
        
        const threshold = this.getCurrentThreshold();
        let bestDeltaX = 0;
        let bestDeltaY = 0;
        let bestDistance = Infinity;
        let bestType = null;
        
        // 각 포인트에 대해 스냅 체크
        for (const point of points) {
            const result = this.snap(point.x, point.y, options);
            
            if (result.snapped) {
                const deltaX = result.x - point.x;
                const deltaY = result.y - point.y;
                const distance = Math.hypot(deltaX, deltaY);
                
                if (distance < bestDistance) {
                    bestDeltaX = deltaX;
                    bestDeltaY = deltaY;
                    bestDistance = distance;
                    bestType = result.snapType;
                }
            }
        }
        
        return {
            deltaX: bestDeltaX,
            deltaY: bestDeltaY,
            snapped: bestDistance < threshold,
            snapType: bestType
        };
    }
    
    // =====================================================
    // 개별 스냅 체크
    // =====================================================
    
    /**
     * 객체 스냅 체크
     * @private
     */
    _checkObjectSnap(x, y, referenceObjects, threshold) {
        let bestResult = null;
        let bestDistance = Infinity;
        
        for (const refObj of referenceObjects) {
            const rect = refObj.getClientRect();
            
            // 체크할 포인트들
            const snapPoints = [
                { x: rect.x, y: rect.y },                                    // top-left
                { x: rect.x + rect.width, y: rect.y },                       // top-right
                { x: rect.x, y: rect.y + rect.height },                      // bottom-left
                { x: rect.x + rect.width, y: rect.y + rect.height },         // bottom-right
                { x: rect.x + rect.width / 2, y: rect.y },                   // top-center
                { x: rect.x + rect.width / 2, y: rect.y + rect.height },     // bottom-center
                { x: rect.x, y: rect.y + rect.height / 2 },                  // left-center
                { x: rect.x + rect.width, y: rect.y + rect.height / 2 },     // right-center
                { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }  // center
            ];
            
            for (const snapPoint of snapPoints) {
                const distance = Math.hypot(x - snapPoint.x, y - snapPoint.y);
                
                if (distance < threshold && distance < bestDistance) {
                    bestDistance = distance;
                    bestResult = {
                        x: snapPoint.x,
                        y: snapPoint.y,
                        distance: distance,
                        info: { refObject: refObj, point: snapPoint }
                    };
                }
            }
        }
        
        return bestResult;
    }
    
    /**
     * 가이드 스냅 체크
     * @private
     */
    _checkGuideSnap(x, y, guides, threshold) {
        let bestResult = null;
        let bestDistance = Infinity;
        
        // 수직 가이드
        if (guides.vertical) {
            for (const guideX of guides.vertical) {
                const distance = Math.abs(x - guideX);
                if (distance < threshold && distance < bestDistance) {
                    bestDistance = distance;
                    bestResult = {
                        x: guideX,
                        y: y,
                        distance: distance,
                        info: { type: 'vertical', position: guideX }
                    };
                }
            }
        }
        
        // 수평 가이드
        if (guides.horizontal) {
            for (const guideY of guides.horizontal) {
                const distance = Math.abs(y - guideY);
                if (distance < threshold && distance < bestDistance) {
                    bestDistance = distance;
                    bestResult = {
                        x: x,
                        y: guideY,
                        distance: distance,
                        info: { type: 'horizontal', position: guideY }
                    };
                }
            }
        }
        
        return bestResult;
    }
    
    // =====================================================
    // 스냅 인디케이터
    // =====================================================
    
    /**
     * 스냅 인디케이터 표시
     * @private
     */
    _showSnapIndicator(x, y, snapType) {
        this.clearIndicators();
        
        if (!this.uiLayer) return;
        
        // 타입별 색상
        const colors = {
            mice: '#e74c3c',
            object: '#3498db',
            guide: '#9b59b6',
            grid: '#667eea'
        };
        
        const color = colors[snapType] || this.config.indicatorColor;
        const size = this.config.indicatorSize;
        
        // 십자 인디케이터
        const crossH = new Konva.Line({
            points: [x - size, y, x + size, y],
            stroke: color,
            strokeWidth: 2,
            listening: false,
            name: 'snap-indicator'
        });
        
        const crossV = new Konva.Line({
            points: [x, y - size, x, y + size],
            stroke: color,
            strokeWidth: 2,
            listening: false,
            name: 'snap-indicator'
        });
        
        // 원형 인디케이터
        const circle = new Konva.Circle({
            x: x,
            y: y,
            radius: size / 2,
            stroke: color,
            strokeWidth: 2,
            listening: false,
            name: 'snap-indicator'
        });
        
        this.snapIndicators.push(crossH, crossV, circle);
        this.uiLayer.add(crossH);
        this.uiLayer.add(crossV);
        this.uiLayer.add(circle);
        this.uiLayer.batchDraw();
    }
    
    /**
     * 스냅 인디케이터 제거
     */
    clearIndicators() {
        this.snapIndicators.forEach(indicator => indicator.destroy());
        this.snapIndicators = [];
        
        if (this.uiLayer) {
            this.uiLayer.batchDraw();
        }
    }
    
    // =====================================================
    // 설정
    // =====================================================
    
    /**
     * threshold 설정
     * @param {number} threshold
     */
    setThreshold(threshold) {
        this.config.threshold = threshold;
    }
    
    /**
     * 우선순위 설정
     * @param {Object} priority - { mice, object, guide, grid }
     */
    setPriority(priority) {
        this.config.priority = { ...this.config.priority, ...priority };
    }
    
    /**
     * 인디케이터 표시 설정
     * @param {boolean} show
     */
    setShowIndicator(show) {
        this.config.showSnapIndicator = show;
        if (!show) {
            this.clearIndicators();
        }
    }
    
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
     * 마지막 스냅 결과 반환
     * @returns {Object|null}
     */
    getLastSnapResult() {
        return this.lastSnapResult;
    }
    
    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * 활성화된 스냅 모드 반환
     * @returns {Array<string>}
     */
    getActiveModes() {
        const modes = [];
        if (this.config.gridSnapEnabled) modes.push('grid');
        if (this.config.objectSnapEnabled) modes.push('object');
        if (this.config.guideSnapEnabled) modes.push('guide');
        if (this.config.miceSnapEnabled) modes.push('mice');
        return modes;
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 정리
     */
    clear() {
        this.clearIndicators();
        this.lastSnapResult = null;
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.gridSnap = null;
        this.miceSnapPoints = null;
        this.uiLayer = null;
        this.callbacks = {};
        console.log('[SnapManager] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.SnapManager = SnapManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnapManager;
}

