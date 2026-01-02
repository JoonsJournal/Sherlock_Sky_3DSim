/**
 * DistributionGuide.js
 * =====================
 * 
 * 고급 분배(Distribution) 가이드 시스템
 * 
 * @version 1.0.0 - Phase 1.5
 * @module DistributionGuide
 * 
 * 역할:
 * 1. 간격 균등 분배 (Equal Spacing)
 * 2. 캔버스/선택영역 기준 분배
 * 3. 분배 가이드라인 시각화
 * 4. 스마트 분배 (기존 간격 감지)
 * 5. 분배 미리보기 및 애니메이션
 * 
 * AlignmentGuide.js의 기본 분배 기능을 확장합니다.
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/guides/DistributionGuide.js
 */

class DistributionGuide {
    /**
     * @param {Konva.Stage} stage - Konva Stage
     * @param {Konva.Layer} uiLayer - UI 레이어 (가이드라인 표시용)
     * @param {Object} options - 옵션
     */
    constructor(stage, uiLayer, options = {}) {
        if (!stage) {
            throw new Error('[DistributionGuide] Konva.Stage가 필요합니다');
        }
        
        this.stage = stage;
        this.uiLayer = uiLayer;
        
        // 설정
        this.config = {
            // 활성화
            enabled: options.enabled !== false,
            
            // 가이드라인 스타일
            guideColor: options.guideColor || '#00FF66',  // Green (분배용)
            guideWidth: options.guideWidth || 1,
            guideDash: options.guideDash || [3, 3],
            
            // 간격 표시
            showSpacing: options.showSpacing !== false,
            spacingColor: options.spacingColor || '#00FF66',
            spacingFontSize: options.spacingFontSize || 10,
            spacingArrowSize: options.spacingArrowSize || 6,
            
            // 애니메이션
            animationEnabled: options.animationEnabled !== false,
            animationDuration: options.animationDuration || 200,
            
            // 미리보기
            previewEnabled: options.previewEnabled || false,
            previewColor: options.previewColor || 'rgba(0, 255, 102, 0.2)',
            
            // 분배 기준
            distributeWithin: options.distributeWithin || 'selection', // 'selection', 'canvas', 'custom'
            
            // 최소 객체 수 (분배에 필요)
            minObjectsForDistribute: options.minObjectsForDistribute || 3
        };
        
        // 가이드라인 및 표시 요소들
        this.guideElements = [];
        this.spacingLabels = [];
        this.previewShapes = [];
        
        // 현재 분배 상태
        this.distributionState = {
            active: false,
            type: null,  // 'horizontal', 'vertical'
            objects: [],
            spacing: 0
        };
        
        // 콜백
        this.callbacks = {
            onDistributeStart: options.onDistributeStart || null,
            onDistributeEnd: options.onDistributeEnd || null,
            onPreviewShow: options.onPreviewShow || null,
            onPreviewHide: options.onPreviewHide || null
        };
        
        console.log('[DistributionGuide] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // 활성화 / 비활성화
    // =====================================================
    
    /**
     * 분배 가이드 활성화
     */
    enable() {
        this.config.enabled = true;
    }
    
    /**
     * 분배 가이드 비활성화
     */
    disable() {
        this.config.enabled = false;
        this.clearGuides();
    }
    
    /**
     * 활성화 상태 반환
     * @returns {boolean}
     */
    isEnabled() {
        return this.config.enabled;
    }
    
    // =====================================================
    // 수평 분배 (Horizontal Distribution)
    // =====================================================
    
    /**
     * 객체들을 수평으로 균등 분배
     * @param {Array<Konva.Shape>} objects - 분배할 객체들
     * @param {Object} options - 분배 옵션
     * @returns {Object} 분배 결과
     */
    distributeHorizontal(objects, options = {}) {
        if (!this.config.enabled) return { success: false, reason: 'disabled' };
        if (!objects || objects.length < this.config.minObjectsForDistribute) {
            return { 
                success: false, 
                reason: `최소 ${this.config.minObjectsForDistribute}개 객체가 필요합니다` 
            };
        }
        
        // 콜백 호출
        if (this.callbacks.onDistributeStart) {
            this.callbacks.onDistributeStart('horizontal', objects);
        }
        
        // 분배 영역 계산
        const bounds = this.getDistributionBounds(objects, options);
        
        // 왼쪽에서 오른쪽 순으로 정렬
        const sortedObjects = [...objects].sort((a, b) => {
            const rectA = a.getClientRect();
            const rectB = b.getClientRect();
            return rectA.x - rectB.x;
        });
        
        // 총 객체 폭 계산
        let totalObjectWidth = 0;
        sortedObjects.forEach(obj => {
            totalObjectWidth += obj.getClientRect().width;
        });
        
        // 간격 계산
        const availableSpace = bounds.width - totalObjectWidth;
        const spacing = availableSpace / (sortedObjects.length - 1);
        
        // 분배 상태 저장
        this.distributionState = {
            active: true,
            type: 'horizontal',
            objects: sortedObjects,
            spacing: spacing
        };
        
        // 위치 이동
        const movements = [];
        let currentX = bounds.x;
        
        sortedObjects.forEach((obj, index) => {
            const rect = obj.getClientRect();
            const oldX = obj.x();
            const newX = currentX + (obj.x() - rect.x); // 로컬 좌표 보정
            
            movements.push({
                object: obj,
                from: { x: oldX, y: obj.y() },
                to: { x: newX, y: obj.y() }
            });
            
            if (this.config.animationEnabled && options.animate !== false) {
                this.animateMove(obj, newX, obj.y());
            } else {
                obj.x(newX);
            }
            
            currentX += rect.width + spacing;
        });
        
        // 가이드라인 표시
        if (options.showGuides !== false) {
            this.showSpacingGuides('horizontal', sortedObjects, spacing);
        }
        
        // 레이어 업데이트
        if (sortedObjects[0] && sortedObjects[0].getLayer()) {
            sortedObjects[0].getLayer().batchDraw();
        }
        
        // 콜백 호출
        if (this.callbacks.onDistributeEnd) {
            this.callbacks.onDistributeEnd('horizontal', movements);
        }
        
        return {
            success: true,
            type: 'horizontal',
            spacing: spacing,
            movements: movements
        };
    }
    
    // =====================================================
    // 수직 분배 (Vertical Distribution)
    // =====================================================
    
    /**
     * 객체들을 수직으로 균등 분배
     * @param {Array<Konva.Shape>} objects - 분배할 객체들
     * @param {Object} options - 분배 옵션
     * @returns {Object} 분배 결과
     */
    distributeVertical(objects, options = {}) {
        if (!this.config.enabled) return { success: false, reason: 'disabled' };
        if (!objects || objects.length < this.config.minObjectsForDistribute) {
            return { 
                success: false, 
                reason: `최소 ${this.config.minObjectsForDistribute}개 객체가 필요합니다` 
            };
        }
        
        // 콜백 호출
        if (this.callbacks.onDistributeStart) {
            this.callbacks.onDistributeStart('vertical', objects);
        }
        
        // 분배 영역 계산
        const bounds = this.getDistributionBounds(objects, options);
        
        // 위에서 아래 순으로 정렬
        const sortedObjects = [...objects].sort((a, b) => {
            const rectA = a.getClientRect();
            const rectB = b.getClientRect();
            return rectA.y - rectB.y;
        });
        
        // 총 객체 높이 계산
        let totalObjectHeight = 0;
        sortedObjects.forEach(obj => {
            totalObjectHeight += obj.getClientRect().height;
        });
        
        // 간격 계산
        const availableSpace = bounds.height - totalObjectHeight;
        const spacing = availableSpace / (sortedObjects.length - 1);
        
        // 분배 상태 저장
        this.distributionState = {
            active: true,
            type: 'vertical',
            objects: sortedObjects,
            spacing: spacing
        };
        
        // 위치 이동
        const movements = [];
        let currentY = bounds.y;
        
        sortedObjects.forEach((obj, index) => {
            const rect = obj.getClientRect();
            const oldY = obj.y();
            const newY = currentY + (obj.y() - rect.y); // 로컬 좌표 보정
            
            movements.push({
                object: obj,
                from: { x: obj.x(), y: oldY },
                to: { x: obj.x(), y: newY }
            });
            
            if (this.config.animationEnabled && options.animate !== false) {
                this.animateMove(obj, obj.x(), newY);
            } else {
                obj.y(newY);
            }
            
            currentY += rect.height + spacing;
        });
        
        // 가이드라인 표시
        if (options.showGuides !== false) {
            this.showSpacingGuides('vertical', sortedObjects, spacing);
        }
        
        // 레이어 업데이트
        if (sortedObjects[0] && sortedObjects[0].getLayer()) {
            sortedObjects[0].getLayer().batchDraw();
        }
        
        // 콜백 호출
        if (this.callbacks.onDistributeEnd) {
            this.callbacks.onDistributeEnd('vertical', movements);
        }
        
        return {
            success: true,
            type: 'vertical',
            spacing: spacing,
            movements: movements
        };
    }
    
    // =====================================================
    // 중앙 기준 분배
    // =====================================================
    
    /**
     * 객체 중앙 기준 수평 분배
     * @param {Array<Konva.Shape>} objects
     * @param {Object} options
     * @returns {Object}
     */
    distributeHorizontalCenters(objects, options = {}) {
        if (!objects || objects.length < this.config.minObjectsForDistribute) {
            return { success: false, reason: 'insufficient objects' };
        }
        
        // 중앙점 기준으로 정렬
        const sortedObjects = [...objects].sort((a, b) => {
            const rectA = a.getClientRect();
            const rectB = b.getClientRect();
            return (rectA.x + rectA.width / 2) - (rectB.x + rectB.width / 2);
        });
        
        // 첫 번째와 마지막 객체의 중앙점
        const firstRect = sortedObjects[0].getClientRect();
        const lastRect = sortedObjects[sortedObjects.length - 1].getClientRect();
        
        const firstCenter = firstRect.x + firstRect.width / 2;
        const lastCenter = lastRect.x + lastRect.width / 2;
        
        // 간격 계산
        const totalDistance = lastCenter - firstCenter;
        const spacing = totalDistance / (sortedObjects.length - 1);
        
        // 위치 이동
        const movements = [];
        
        sortedObjects.forEach((obj, index) => {
            if (index === 0 || index === sortedObjects.length - 1) {
                return; // 처음과 마지막은 고정
            }
            
            const rect = obj.getClientRect();
            const currentCenter = rect.x + rect.width / 2;
            const targetCenter = firstCenter + spacing * index;
            const deltaX = targetCenter - currentCenter;
            
            const oldX = obj.x();
            const newX = oldX + deltaX;
            
            movements.push({
                object: obj,
                from: { x: oldX, y: obj.y() },
                to: { x: newX, y: obj.y() }
            });
            
            if (this.config.animationEnabled) {
                this.animateMove(obj, newX, obj.y());
            } else {
                obj.x(newX);
            }
        });
        
        return {
            success: true,
            type: 'horizontal-centers',
            spacing: spacing,
            movements: movements
        };
    }
    
    /**
     * 객체 중앙 기준 수직 분배
     * @param {Array<Konva.Shape>} objects
     * @param {Object} options
     * @returns {Object}
     */
    distributeVerticalCenters(objects, options = {}) {
        if (!objects || objects.length < this.config.minObjectsForDistribute) {
            return { success: false, reason: 'insufficient objects' };
        }
        
        // 중앙점 기준으로 정렬
        const sortedObjects = [...objects].sort((a, b) => {
            const rectA = a.getClientRect();
            const rectB = b.getClientRect();
            return (rectA.y + rectA.height / 2) - (rectB.y + rectB.height / 2);
        });
        
        // 첫 번째와 마지막 객체의 중앙점
        const firstRect = sortedObjects[0].getClientRect();
        const lastRect = sortedObjects[sortedObjects.length - 1].getClientRect();
        
        const firstCenter = firstRect.y + firstRect.height / 2;
        const lastCenter = lastRect.y + lastRect.height / 2;
        
        // 간격 계산
        const totalDistance = lastCenter - firstCenter;
        const spacing = totalDistance / (sortedObjects.length - 1);
        
        // 위치 이동
        const movements = [];
        
        sortedObjects.forEach((obj, index) => {
            if (index === 0 || index === sortedObjects.length - 1) {
                return; // 처음과 마지막은 고정
            }
            
            const rect = obj.getClientRect();
            const currentCenter = rect.y + rect.height / 2;
            const targetCenter = firstCenter + spacing * index;
            const deltaY = targetCenter - currentCenter;
            
            const oldY = obj.y();
            const newY = oldY + deltaY;
            
            movements.push({
                object: obj,
                from: { x: obj.x(), y: oldY },
                to: { x: obj.x(), y: newY }
            });
            
            if (this.config.animationEnabled) {
                this.animateMove(obj, obj.x(), newY);
            } else {
                obj.y(newY);
            }
        });
        
        return {
            success: true,
            type: 'vertical-centers',
            spacing: spacing,
            movements: movements
        };
    }
    
    // =====================================================
    // 특정 간격으로 분배
    // =====================================================
    
    /**
     * 지정된 간격으로 수평 분배
     * @param {Array<Konva.Shape>} objects
     * @param {number} spacing - 원하는 간격 (px)
     * @param {Object} options
     * @returns {Object}
     */
    distributeWithSpacing(objects, spacing, direction = 'horizontal', options = {}) {
        if (!objects || objects.length < 2) {
            return { success: false, reason: 'insufficient objects' };
        }
        
        const sortedObjects = direction === 'horizontal' 
            ? [...objects].sort((a, b) => a.getClientRect().x - b.getClientRect().x)
            : [...objects].sort((a, b) => a.getClientRect().y - b.getClientRect().y);
        
        const movements = [];
        let currentPos = direction === 'horizontal'
            ? sortedObjects[0].getClientRect().x
            : sortedObjects[0].getClientRect().y;
        
        sortedObjects.forEach((obj, index) => {
            const rect = obj.getClientRect();
            
            if (index === 0) {
                currentPos += direction === 'horizontal' ? rect.width : rect.height;
                return;
            }
            
            const oldPos = direction === 'horizontal' ? obj.x() : obj.y();
            const newPos = currentPos + spacing + (direction === 'horizontal' 
                ? (obj.x() - rect.x) 
                : (obj.y() - rect.y));
            
            movements.push({
                object: obj,
                from: direction === 'horizontal' 
                    ? { x: oldPos, y: obj.y() }
                    : { x: obj.x(), y: oldPos },
                to: direction === 'horizontal'
                    ? { x: newPos, y: obj.y() }
                    : { x: obj.x(), y: newPos }
            });
            
            if (direction === 'horizontal') {
                obj.x(newPos);
                currentPos = newPos + (rect.x - obj.x()) + rect.width;
            } else {
                obj.y(newPos);
                currentPos = newPos + (rect.y - obj.y()) + rect.height;
            }
        });
        
        return {
            success: true,
            type: `${direction}-fixed-spacing`,
            spacing: spacing,
            movements: movements
        };
    }
    
    // =====================================================
    // 캔버스/영역 기준 분배
    // =====================================================
    
    /**
     * 캔버스 전체에 균등 분배
     * @param {Array<Konva.Shape>} objects
     * @param {string} direction - 'horizontal' or 'vertical'
     * @param {Object} options
     * @returns {Object}
     */
    distributeInCanvas(objects, direction = 'horizontal', options = {}) {
        const canvasBounds = {
            x: 0,
            y: 0,
            width: this.stage.width(),
            height: this.stage.height()
        };
        
        return direction === 'horizontal'
            ? this.distributeHorizontal(objects, { ...options, bounds: canvasBounds })
            : this.distributeVertical(objects, { ...options, bounds: canvasBounds });
    }
    
    /**
     * 지정 영역 내에 균등 분배
     * @param {Array<Konva.Shape>} objects
     * @param {Object} bounds - { x, y, width, height }
     * @param {string} direction
     * @param {Object} options
     * @returns {Object}
     */
    distributeInBounds(objects, bounds, direction = 'horizontal', options = {}) {
        return direction === 'horizontal'
            ? this.distributeHorizontal(objects, { ...options, bounds })
            : this.distributeVertical(objects, { ...options, bounds });
    }
    
    // =====================================================
    // 분배 영역 계산
    // =====================================================
    
    /**
     * 분배 기준 영역 계산
     * @param {Array<Konva.Shape>} objects
     * @param {Object} options
     * @returns {Object} bounds
     */
    getDistributionBounds(objects, options = {}) {
        // 커스텀 bounds가 제공된 경우
        if (options.bounds) {
            return options.bounds;
        }
        
        // 설정에 따른 분배 기준
        switch (this.config.distributeWithin) {
            case 'canvas':
                return {
                    x: 0,
                    y: 0,
                    width: this.stage.width(),
                    height: this.stage.height()
                };
            
            case 'custom':
                return options.customBounds || this.getSelectionBounds(objects);
            
            case 'selection':
            default:
                return this.getSelectionBounds(objects);
        }
    }
    
    /**
     * 선택된 객체들의 Bounding Box 계산
     * @param {Array<Konva.Shape>} objects
     * @returns {Object}
     */
    getSelectionBounds(objects) {
        if (!objects || objects.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        objects.forEach(obj => {
            const rect = obj.getClientRect();
            minX = Math.min(minX, rect.x);
            maxX = Math.max(maxX, rect.x + rect.width);
            minY = Math.min(minY, rect.y);
            maxY = Math.max(maxY, rect.y + rect.height);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    // =====================================================
    // 간격 가이드라인 표시
    // =====================================================
    
    /**
     * 간격 가이드라인 표시
     * @param {string} direction - 'horizontal' or 'vertical'
     * @param {Array<Konva.Shape>} objects - 정렬된 객체들
     * @param {number} spacing - 간격
     */
    showSpacingGuides(direction, objects, spacing) {
        if (!this.uiLayer || !this.config.showSpacing) return;
        
        this.clearGuides();
        
        const isHorizontal = direction === 'horizontal';
        
        // 인접 객체 간의 간격 표시
        for (let i = 0; i < objects.length - 1; i++) {
            const current = objects[i].getClientRect();
            const next = objects[i + 1].getClientRect();
            
            if (isHorizontal) {
                // 수평 간격 표시
                const startX = current.x + current.width;
                const endX = next.x;
                const midY = (current.y + current.height / 2 + next.y + next.height / 2) / 2;
                
                this.createSpacingIndicator(startX, midY, endX, midY, spacing, 'horizontal');
            } else {
                // 수직 간격 표시
                const midX = (current.x + current.width / 2 + next.x + next.width / 2) / 2;
                const startY = current.y + current.height;
                const endY = next.y;
                
                this.createSpacingIndicator(midX, startY, midX, endY, spacing, 'vertical');
            }
        }
        
        this.uiLayer.batchDraw();
    }
    
    /**
     * 개별 간격 표시기 생성
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @param {number} spacing
     * @param {string} direction
     */
    createSpacingIndicator(x1, y1, x2, y2, spacing, direction) {
        const isHorizontal = direction === 'horizontal';
        const arrowSize = this.config.spacingArrowSize;
        
        // 메인 라인
        const line = new Konva.Line({
            points: [x1, y1, x2, y2],
            stroke: this.config.guideColor,
            strokeWidth: this.config.guideWidth,
            dash: this.config.guideDash
        });
        this.guideElements.push(line);
        this.uiLayer.add(line);
        
        // 양쪽 화살표
        if (isHorizontal) {
            // 왼쪽 화살표
            const leftArrow = new Konva.Line({
                points: [x1, y1 - arrowSize, x1, y1 + arrowSize],
                stroke: this.config.guideColor,
                strokeWidth: this.config.guideWidth
            });
            this.guideElements.push(leftArrow);
            this.uiLayer.add(leftArrow);
            
            // 오른쪽 화살표
            const rightArrow = new Konva.Line({
                points: [x2, y2 - arrowSize, x2, y2 + arrowSize],
                stroke: this.config.guideColor,
                strokeWidth: this.config.guideWidth
            });
            this.guideElements.push(rightArrow);
            this.uiLayer.add(rightArrow);
        } else {
            // 위쪽 화살표
            const topArrow = new Konva.Line({
                points: [x1 - arrowSize, y1, x1 + arrowSize, y1],
                stroke: this.config.guideColor,
                strokeWidth: this.config.guideWidth
            });
            this.guideElements.push(topArrow);
            this.uiLayer.add(topArrow);
            
            // 아래쪽 화살표
            const bottomArrow = new Konva.Line({
                points: [x2 - arrowSize, y2, x2 + arrowSize, y2],
                stroke: this.config.guideColor,
                strokeWidth: this.config.guideWidth
            });
            this.guideElements.push(bottomArrow);
            this.uiLayer.add(bottomArrow);
        }
        
        // 간격 레이블
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const labelOffset = isHorizontal ? -15 : 10;
        
        const label = new Konva.Text({
            x: isHorizontal ? midX : midX + labelOffset,
            y: isHorizontal ? midY + labelOffset : midY,
            text: `${Math.round(spacing)}px`,
            fontSize: this.config.spacingFontSize,
            fill: this.config.spacingColor,
            align: 'center'
        });
        
        // 텍스트 중앙 정렬
        label.offsetX(label.width() / 2);
        
        this.spacingLabels.push(label);
        this.uiLayer.add(label);
    }
    
    /**
     * 가이드라인 제거
     */
    clearGuides() {
        this.guideElements.forEach(el => el.destroy());
        this.guideElements = [];
        
        this.spacingLabels.forEach(el => el.destroy());
        this.spacingLabels = [];
        
        if (this.uiLayer) {
            this.uiLayer.batchDraw();
        }
    }
    
    // =====================================================
    // 미리보기 기능
    // =====================================================
    
    /**
     * 분배 미리보기 표시
     * @param {Array<Konva.Shape>} objects
     * @param {string} direction
     */
    showPreview(objects, direction = 'horizontal') {
        if (!this.config.previewEnabled || !this.uiLayer) return;
        
        this.clearPreview();
        
        // 미리보기 결과 계산 (실제 이동 없이)
        const bounds = this.getSelectionBounds(objects);
        const sortedObjects = direction === 'horizontal'
            ? [...objects].sort((a, b) => a.getClientRect().x - b.getClientRect().x)
            : [...objects].sort((a, b) => a.getClientRect().y - b.getClientRect().y);
        
        // 간격 계산
        let totalSize = 0;
        sortedObjects.forEach(obj => {
            const rect = obj.getClientRect();
            totalSize += direction === 'horizontal' ? rect.width : rect.height;
        });
        
        const availableSpace = direction === 'horizontal' 
            ? bounds.width - totalSize 
            : bounds.height - totalSize;
        const spacing = availableSpace / (sortedObjects.length - 1);
        
        // 미리보기 위치에 고스트 표시
        let currentPos = direction === 'horizontal' ? bounds.x : bounds.y;
        
        sortedObjects.forEach(obj => {
            const rect = obj.getClientRect();
            
            const previewRect = new Konva.Rect({
                x: direction === 'horizontal' ? currentPos : rect.x,
                y: direction === 'horizontal' ? rect.y : currentPos,
                width: rect.width,
                height: rect.height,
                fill: this.config.previewColor,
                stroke: this.config.guideColor,
                strokeWidth: 1,
                dash: [4, 4]
            });
            
            this.previewShapes.push(previewRect);
            this.uiLayer.add(previewRect);
            
            currentPos += (direction === 'horizontal' ? rect.width : rect.height) + spacing;
        });
        
        this.uiLayer.batchDraw();
        
        if (this.callbacks.onPreviewShow) {
            this.callbacks.onPreviewShow(direction, objects);
        }
    }
    
    /**
     * 미리보기 제거
     */
    clearPreview() {
        this.previewShapes.forEach(shape => shape.destroy());
        this.previewShapes = [];
        
        if (this.uiLayer) {
            this.uiLayer.batchDraw();
        }
        
        if (this.callbacks.onPreviewHide) {
            this.callbacks.onPreviewHide();
        }
    }
    
    // =====================================================
    // 애니메이션
    // =====================================================
    
    /**
     * 객체 이동 애니메이션
     * @param {Konva.Shape} obj
     * @param {number} targetX
     * @param {number} targetY
     */
    animateMove(obj, targetX, targetY) {
        if (!obj) return;
        
        new Konva.Tween({
            node: obj,
            duration: this.config.animationDuration / 1000,
            x: targetX,
            y: targetY,
            easing: Konva.Easings.EaseOut
        }).play();
    }
    
    // =====================================================
    // 현재 간격 감지 (Smart Distribution)
    // =====================================================
    
    /**
     * 객체들 간의 현재 간격 분석
     * @param {Array<Konva.Shape>} objects
     * @param {string} direction
     * @returns {Object} 간격 분석 결과
     */
    analyzeSpacing(objects, direction = 'horizontal') {
        if (!objects || objects.length < 2) {
            return { valid: false, reason: 'insufficient objects' };
        }
        
        const sortedObjects = direction === 'horizontal'
            ? [...objects].sort((a, b) => a.getClientRect().x - b.getClientRect().x)
            : [...objects].sort((a, b) => a.getClientRect().y - b.getClientRect().y);
        
        const spacings = [];
        
        for (let i = 0; i < sortedObjects.length - 1; i++) {
            const current = sortedObjects[i].getClientRect();
            const next = sortedObjects[i + 1].getClientRect();
            
            const spacing = direction === 'horizontal'
                ? next.x - (current.x + current.width)
                : next.y - (current.y + current.height);
            
            spacings.push(spacing);
        }
        
        // 통계 계산
        const sum = spacings.reduce((a, b) => a + b, 0);
        const avg = sum / spacings.length;
        const min = Math.min(...spacings);
        const max = Math.max(...spacings);
        const variance = spacings.reduce((acc, s) => acc + Math.pow(s - avg, 2), 0) / spacings.length;
        const stdDev = Math.sqrt(variance);
        
        // 균등 분배 여부 판단 (표준편차가 작으면 균등)
        const isEvenlyDistributed = stdDev < 2;
        
        return {
            valid: true,
            spacings: spacings,
            average: avg,
            min: min,
            max: max,
            standardDeviation: stdDev,
            isEvenlyDistributed: isEvenlyDistributed,
            suggestion: isEvenlyDistributed 
                ? 'Objects are already evenly distributed'
                : `Distribute to ${Math.round(avg)}px spacing`
        };
    }
    
    // =====================================================
    // 편의 메서드
    // =====================================================
    
    /**
     * 통합 분배 메서드
     * @param {Array<Konva.Shape>} objects
     * @param {string} type - 분배 타입
     * @param {Object} options
     * @returns {Object}
     */
    distribute(objects, type, options = {}) {
        switch (type) {
            case 'horizontal':
                return this.distributeHorizontal(objects, options);
            case 'vertical':
                return this.distributeVertical(objects, options);
            case 'horizontal-centers':
                return this.distributeHorizontalCenters(objects, options);
            case 'vertical-centers':
                return this.distributeVerticalCenters(objects, options);
            default:
                return { success: false, reason: `Unknown distribution type: ${type}` };
        }
    }
    
    /**
     * 설정 업데이트
     * @param {Object} newConfig
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * 현재 분배 상태 반환
     * @returns {Object}
     */
    getDistributionState() {
        return { ...this.distributionState };
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 모든 표시 요소 정리
     */
    clear() {
        this.clearGuides();
        this.clearPreview();
        this.distributionState = {
            active: false,
            type: null,
            objects: [],
            spacing: 0
        };
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.stage = null;
        this.uiLayer = null;
        this.callbacks = {};
        console.log('[DistributionGuide] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined') {
    window.DistributionGuide = DistributionGuide;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DistributionGuide;
}

export { DistributionGuide };