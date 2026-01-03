/**
 * SelectionRenderer.js
 * =====================
 * 
 * 선택된 객체의 시각적 표현을 담당하는 모듈
 * 
 * @version 1.0.0 - Phase 1.5
 * @module SelectionRenderer
 * 
 * 역할:
 * 1. Transformer 관리 (리사이즈 핸들)
 * 2. 선택 하이라이트 (색상 변경)
 * 3. Line(Wall) 선택 표시 (stroke, dash)
 * 4. 좌표 표시 라벨
 * 5. 호버 효과
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/selection/SelectionRenderer.js
 */

class SelectionRenderer {
    /**
     * @param {Konva.Layer} uiLayer - UI 레이어 (Transformer, 라벨 등)
     * @param {Object} cssColors - CSS 색상 설정
     * @param {Object} options - 추가 옵션
     */
    constructor(uiLayer, cssColors, options = {}) {
        if (!uiLayer) {
            throw new Error('[SelectionRenderer] UI 레이어가 필요합니다');
        }
        
        this.uiLayer = uiLayer;
        this.cssColors = cssColors || this.getDefaultColors();
        this.options = options;
        
        // Transformer
        this.transformer = null;
        
        // 좌표 표시 라벨
        this.coordLabel = null;
        
        // 원래 스타일 저장 (복원용)
        this.originalStyles = new WeakMap();
        
        // Transformer 설정
        this.transformerConfig = {
            rotateEnabled: options.rotateEnabled !== false,
            keepRatio: options.keepRatio || false,
            enabledAnchors: options.enabledAnchors || [
                'top-left', 'top-center', 'top-right',
                'middle-right', 'middle-left',
                'bottom-left', 'bottom-center', 'bottom-right'
            ],
            borderStroke: this.cssColors.transformerBorder,
            borderStrokeWidth: 2,
            anchorStroke: this.cssColors.transformerAnchorStroke,
            anchorFill: this.cssColors.transformerAnchorFill,
            anchorSize: 10,
            anchorCornerRadius: 2
        };
        
        console.log('[SelectionRenderer] 초기화 완료 v1.0.0');
    }
    
    /**
     * 기본 색상 설정
     */
    getDefaultColors() {
        return {
            equipmentDefault: '#4a90e2',
            equipmentSelected: '#FFD700',
            equipmentHover: '#3498db',
            transformerBorder: '#667eea',
            transformerAnchorStroke: '#667eea',
            transformerAnchorFill: '#ffffff',
            coordBg: '#667eea',
            coordText: '#ffffff',
            wallDefault: '#888888',
            wallSelected: '#FFD700'
        };
    }
    
    // =====================================================
    // Transformer 관리
    // =====================================================
    
    /**
     * Transformer 업데이트 (선택된 객체에 적용)
     * @param {Array<Konva.Shape>} selectedObjects - 선택된 객체 배열
     */
    updateTransformer(selectedObjects) {
        // 기존 Transformer 제거
        this.destroyTransformer();
        
        if (!selectedObjects || selectedObjects.length === 0) {
            this.uiLayer.batchDraw();
            return;
        }
        
        // 새 Transformer 생성
        this.transformer = new Konva.Transformer({
            nodes: selectedObjects,
            ...this.transformerConfig
        });
        
        // Transformer 이벤트
        this.transformer.on('transformend', (e) => {
            console.log('[SelectionRenderer] Transform 완료');
        });
        
        this.uiLayer.add(this.transformer);
        this.uiLayer.batchDraw();
        
        console.log(`[SelectionRenderer] Transformer 적용: ${selectedObjects.length}개`);
    }
    
    /**
     * Transformer 제거
     */
    destroyTransformer() {
        if (this.transformer) {
            this.transformer.destroy();
            this.transformer = null;
        }
    }
    
    /**
     * Transformer 강제 업데이트
     */
    forceUpdateTransformer() {
        if (this.transformer) {
            this.transformer.forceUpdate();
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * Transformer 가져오기
     * @returns {Konva.Transformer|null}
     */
    getTransformer() {
        return this.transformer;
    }
    
    /**
     * Transformer 설정 업데이트
     * @param {Object} config - 새 설정
     */
    updateTransformerConfig(config) {
        this.transformerConfig = { ...this.transformerConfig, ...config };
        
        if (this.transformer) {
            Object.keys(config).forEach(key => {
                if (typeof this.transformer[key] === 'function') {
                    this.transformer[key](config[key]);
                }
            });
            this.uiLayer.batchDraw();
        }
    }
    
    // =====================================================
    // 선택 하이라이트
    // =====================================================
    
    /**
     * 객체에 선택 하이라이트 적용
     * @param {Konva.Shape|Konva.Group} shape - 대상 Shape
     */
    applySelectionHighlight(shape) {
        if (!shape) return;
        
        // Line 객체 (Wall, Partition)
        if (shape.className === 'Line') {
            this._highlightLine(shape);
        } 
        // Group 또는 Rect 객체
        else {
            this._highlightRect(shape);
        }
        
        // 레이어 갱신
        const layer = shape.getLayer();
        if (layer) {
            layer.batchDraw();
        }
    }
    
    /**
     * 객체에서 선택 하이라이트 제거
     * @param {Konva.Shape|Konva.Group} shape - 대상 Shape
     */
    removeSelectionHighlight(shape) {
        if (!shape) return;
        
        // Line 객체
        if (shape.className === 'Line') {
            this._restoreLine(shape);
        } 
        // Group 또는 Rect 객체
        else {
            this._restoreRect(shape);
        }
        
        // 레이어 갱신
        const layer = shape.getLayer();
        if (layer) {
            layer.batchDraw();
        }
    }
    
    /**
     * Line(Wall) 하이라이트
     * @private
     */
    _highlightLine(line) {
        // 원래 스타일 저장
        const original = {
            stroke: line.stroke(),
            strokeWidth: line.strokeWidth(),
            dash: line.dash()
        };
        
        // 이미 저장된 원래 스타일이 없으면 저장
        if (!this.originalStyles.has(line)) {
            this.originalStyles.set(line, original);
        }
        
        // 선택 스타일 적용
        line.stroke(this.cssColors.equipmentSelected);
        line.strokeWidth((original.strokeWidth || 3) + 2);
        line.dash([8, 4]);
        
        console.log(`[SelectionRenderer] Line 하이라이트: ${line.id()}`);
    }
    
    /**
     * Line(Wall) 스타일 복원
     * @private
     */
    _restoreLine(line) {
        const original = this.originalStyles.get(line);
        
        if (original) {
            line.stroke(original.stroke);
            line.strokeWidth(original.strokeWidth);
            line.dash(original.dash || []);
            
            this.originalStyles.delete(line);
        } else {
            // 기본값으로 복원
            line.stroke(this.cssColors.wallDefault);
            line.strokeWidth(3);
            line.dash([]);
        }
        
        console.log(`[SelectionRenderer] Line 복원: ${line.id()}`);
    }
    
    /**
     * Rect/Group 하이라이트
     * @private
     */
    _highlightRect(shape) {
        // Group인 경우 내부 Rect 찾기
        let targetRect = shape;
        if (shape.findOne) {
            const innerRect = shape.findOne('.equipmentRect, .officeRect');
            if (innerRect) {
                targetRect = innerRect;
            }
        }
        
        // 원래 스타일 저장
        if (targetRect.fill && !this.originalStyles.has(targetRect)) {
            this.originalStyles.set(targetRect, {
                fill: targetRect.fill(),
                strokeWidth: targetRect.strokeWidth()
            });
        }
        
        // 선택 스타일 적용
        if (targetRect.fill) {
            targetRect.fill(this.cssColors.equipmentSelected);
            targetRect.strokeWidth(3);
        }
        
        console.log(`[SelectionRenderer] Rect 하이라이트: ${shape.id()}`);
    }
    
    /**
     * Rect/Group 스타일 복원
     * @private
     */
    _restoreRect(shape) {
        let targetRect = shape;
        if (shape.findOne) {
            const innerRect = shape.findOne('.equipmentRect, .officeRect');
            if (innerRect) {
                targetRect = innerRect;
            }
        }
        
        const original = this.originalStyles.get(targetRect);
        
        if (original) {
            if (original.fill) targetRect.fill(original.fill);
            if (original.strokeWidth) targetRect.strokeWidth(original.strokeWidth);
            
            this.originalStyles.delete(targetRect);
        } else {
            // 기본값으로 복원
            if (targetRect.fill) {
                targetRect.fill(this.cssColors.equipmentDefault);
                targetRect.strokeWidth(1);
            }
        }
        
        console.log(`[SelectionRenderer] Rect 복원: ${shape.id()}`);
    }
    
    // =====================================================
    // 호버 효과
    // =====================================================
    
    /**
     * 호버 효과 적용
     * @param {Konva.Shape} shape - 대상 Shape
     */
    applyHoverEffect(shape) {
        if (!shape) return;
        
        // Line 객체는 호버 효과 제외
        if (shape.className === 'Line') {
            return;
        }
        
        let targetRect = shape;
        if (shape.findOne) {
            const innerRect = shape.findOne('.equipmentRect, .officeRect');
            if (innerRect) {
                targetRect = innerRect;
            }
        }
        
        // 원래 strokeWidth 저장
        if (!targetRect.getAttr('hoverOriginalStrokeWidth')) {
            targetRect.setAttr('hoverOriginalStrokeWidth', targetRect.strokeWidth());
        }
        
        targetRect.strokeWidth(3);
        
        const layer = shape.getLayer();
        if (layer) {
            layer.batchDraw();
        }
    }
    
    /**
     * 호버 효과 제거
     * @param {Konva.Shape} shape - 대상 Shape
     */
    removeHoverEffect(shape) {
        if (!shape || shape.className === 'Line') return;
        
        let targetRect = shape;
        if (shape.findOne) {
            const innerRect = shape.findOne('.equipmentRect, .officeRect');
            if (innerRect) {
                targetRect = innerRect;
            }
        }
        
        const originalWidth = targetRect.getAttr('hoverOriginalStrokeWidth') || 1;
        targetRect.strokeWidth(originalWidth);
        
        const layer = shape.getLayer();
        if (layer) {
            layer.batchDraw();
        }
    }
    
    // =====================================================
    // 좌표 표시
    // =====================================================
    
    /**
     * 좌표 표시 라벨 표시
     * @param {Konva.Shape} shape - 대상 Shape
     * @param {number} scale - 좌표 변환 스케일
     */
    showCoordinates(shape, scale = 10) {
        this.hideCoordinates();
        
        if (!shape) return;
        
        const x = Math.round(shape.x() / scale * 10) / 10;
        const y = Math.round(shape.y() / scale * 10) / 10;
        
        // Shape 크기 가져오기
        const shapeWidth = shape.width ? shape.width() : 0;
        const shapeHeight = shape.height ? shape.height() : 0;
        
        // 라벨 생성
        this.coordLabel = new Konva.Label({
            x: shape.x() + shapeWidth / 2,
            y: shape.y() - 30,
            listening: false
        });
        
        // 배경 태그
        this.coordLabel.add(new Konva.Tag({
            fill: this.cssColors.coordBg,
            cornerRadius: 5,
            shadowColor: 'black',
            shadowBlur: 5,
            shadowOffset: { x: 2, y: 2 },
            shadowOpacity: 0.3
        }));
        
        // 텍스트
        this.coordLabel.add(new Konva.Text({
            text: `${x}m, ${y}m`,
            fontSize: 12,
            padding: 5,
            fill: this.cssColors.coordText
        }));
        
        this.uiLayer.add(this.coordLabel);
        this.uiLayer.batchDraw();
    }
    
    /**
     * 좌표 표시 라벨 업데이트
     * @param {Konva.Shape} shape - 대상 Shape
     * @param {number} scale - 좌표 변환 스케일
     */
    updateCoordinates(shape, scale = 10) {
        if (!this.coordLabel || !shape) return;
        
        const x = Math.round(shape.x() / scale * 10) / 10;
        const y = Math.round(shape.y() / scale * 10) / 10;
        
        const shapeWidth = shape.width ? shape.width() : 0;
        
        this.coordLabel.x(shape.x() + shapeWidth / 2);
        this.coordLabel.y(shape.y() - 30);
        
        const text = this.coordLabel.findOne('Text');
        if (text) {
            text.text(`${x}m, ${y}m`);
        }
        
        this.uiLayer.batchDraw();
    }
    
    /**
     * 좌표 표시 라벨 숨김
     */
    hideCoordinates() {
        if (this.coordLabel) {
            this.coordLabel.destroy();
            this.coordLabel = null;
            this.uiLayer.batchDraw();
        }
    }
    
    // =====================================================
    // 선택 박스 (일괄 처리용)
    // =====================================================
    
    /**
     * 모든 선택 하이라이트 적용
     * @param {Array<Konva.Shape>} selectedObjects - 선택된 객체 배열
     */
    applyAllHighlights(selectedObjects) {
        selectedObjects.forEach(shape => {
            this.applySelectionHighlight(shape);
        });
    }
    
    /**
     * 모든 선택 하이라이트 제거
     * @param {Array<Konva.Shape>} selectedObjects - 선택된 객체 배열
     */
    removeAllHighlights(selectedObjects) {
        selectedObjects.forEach(shape => {
            this.removeSelectionHighlight(shape);
        });
    }
    
    /**
     * 선택 상태 완전 초기화 (Transformer + 하이라이트)
     * @param {Array<Konva.Shape>} selectedObjects - 선택된 객체 배열
     */
    clearSelection(selectedObjects) {
        this.removeAllHighlights(selectedObjects);
        this.destroyTransformer();
        this.hideCoordinates();
        this.uiLayer.batchDraw();
    }
    
    // =====================================================
    // 유틸리티
    // =====================================================
    
    /**
     * CSS 색상 업데이트
     * @param {Object} newColors - 새 색상 설정
     */
    updateColors(newColors) {
        this.cssColors = { ...this.cssColors, ...newColors };
        
        // Transformer 설정 업데이트
        this.transformerConfig.borderStroke = this.cssColors.transformerBorder;
        this.transformerConfig.anchorStroke = this.cssColors.transformerAnchorStroke;
        this.transformerConfig.anchorFill = this.cssColors.transformerAnchorFill;
    }
    
    /**
     * UI 레이어 다시 그리기
     */
    batchDraw() {
        this.uiLayer.batchDraw();
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 정리
     */
    clear() {
        this.destroyTransformer();
        this.hideCoordinates();
        this.originalStyles = new WeakMap();
        this.uiLayer.batchDraw();
        console.log('[SelectionRenderer] 정리 완료');
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.uiLayer = null;
        this.cssColors = null;
        console.log('[SelectionRenderer] 파괴 완료');
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.SelectionRenderer = SelectionRenderer;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionRenderer;
}

