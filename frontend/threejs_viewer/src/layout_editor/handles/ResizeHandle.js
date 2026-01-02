/**
 * ResizeHandle.js
 * =================
 * 
 * 리사이즈 핸들 커스터마이징 및 관리
 * 
 * @version 1.0.0 - Phase 1.5
 * @module ResizeHandle
 * 
 * 역할:
 * 1. 커스텀 리사이즈 핸들 생성
 * 2. 핸들별 스타일 설정
 * 3. 리사이즈 제약 조건 (최소/최대 크기)
 * 4. 비율 유지 옵션
 * 5. 방향별 리사이즈 잠금
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/handles/ResizeHandle.js
 */

class ResizeHandle {
    /**
     * @param {Object} options - 옵션
     */
    constructor(options = {}) {
        // CSS 색상
        this.cssColors = options.cssColors || {
            anchorStroke: '#667eea',
            anchorFill: '#ffffff',
            anchorHoverFill: '#e6eaff',
            anchorActiveFill: '#667eea'
        };
        
        // 핸들 설정
        this.config = {
            size: options.size || 10,
            cornerRadius: options.cornerRadius || 2,
            strokeWidth: options.strokeWidth || 1,
            hoverScale: options.hoverScale || 1.2,
            
            // 크기 제한
            minWidth: options.minWidth || 10,
            minHeight: options.minHeight || 10,
            maxWidth: options.maxWidth || Infinity,
            maxHeight: options.maxHeight || Infinity,
            
            // 비율 유지
            keepRatio: options.keepRatio || false,
            
            // 방향별 잠금
            lockHorizontal: options.lockHorizontal || false,
            lockVertical: options.lockVertical || false,
            
            // 스냅
            snapToGrid: options.snapToGrid || false,
            gridSize: options.gridSize || 10
        };
        
        // 앵커 위치 정의
        this.anchorPositions = {
            'top-left': { x: 0, y: 0, cursor: 'nwse-resize' },
            'top-center': { x: 0.5, y: 0, cursor: 'ns-resize' },
            'top-right': { x: 1, y: 0, cursor: 'nesw-resize' },
            'middle-left': { x: 0, y: 0.5, cursor: 'ew-resize' },
            'middle-right': { x: 1, y: 0.5, cursor: 'ew-resize' },
            'bottom-left': { x: 0, y: 1, cursor: 'nesw-resize' },
            'bottom-center': { x: 0.5, y: 1, cursor: 'ns-resize' },
            'bottom-right': { x: 1, y: 1, cursor: 'nwse-resize' }
        };
        
        // 활성화된 앵커
        this.enabledAnchors = options.enabledAnchors || Object.keys(this.anchorPositions);
        
        // 콜백
        this.callbacks = {
            onResizeStart: options.onResizeStart || null,
            onResize: options.onResize || null,
            onResizeEnd: options.onResizeEnd || null
        };
        
        console.log('[ResizeHandle] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // Transformer 설정 생성
    // =====================================================
    
    /**
     * Konva.Transformer용 설정 객체 생성
     * @returns {Object}
     */
    getTransformerConfig() {
        return {
            // 앵커 스타일
            anchorStroke: this.cssColors.anchorStroke,
            anchorFill: this.cssColors.anchorFill,
            anchorSize: this.config.size,
            anchorCornerRadius: this.config.cornerRadius,
            anchorStrokeWidth: this.config.strokeWidth,
            
            // 활성화된 앵커
            enabledAnchors: this.enabledAnchors,
            
            // 비율 유지
            keepRatio: this.config.keepRatio,
            
            // 크기 제한
            boundBoxFunc: this.createBoundBoxFunc()
        };
    }
    
    /**
     * BoundBox 함수 생성 (크기 제한)
     * @returns {Function}
     */
    createBoundBoxFunc() {
        const config = this.config;
        
        return (oldBox, newBox) => {
            // 방향 잠금
            if (config.lockHorizontal) {
                newBox.width = oldBox.width;
                newBox.x = oldBox.x;
            }
            
            if (config.lockVertical) {
                newBox.height = oldBox.height;
                newBox.y = oldBox.y;
            }
            
            // 최소 크기 제한
            if (newBox.width < config.minWidth) {
                if (newBox.x !== oldBox.x) {
                    newBox.x = oldBox.x + oldBox.width - config.minWidth;
                }
                newBox.width = config.minWidth;
            }
            
            if (newBox.height < config.minHeight) {
                if (newBox.y !== oldBox.y) {
                    newBox.y = oldBox.y + oldBox.height - config.minHeight;
                }
                newBox.height = config.minHeight;
            }
            
            // 최대 크기 제한
            if (newBox.width > config.maxWidth) {
                if (newBox.x !== oldBox.x) {
                    newBox.x = oldBox.x + oldBox.width - config.maxWidth;
                }
                newBox.width = config.maxWidth;
            }
            
            if (newBox.height > config.maxHeight) {
                if (newBox.y !== oldBox.y) {
                    newBox.y = oldBox.y + oldBox.height - config.maxHeight;
                }
                newBox.height = config.maxHeight;
            }
            
            // 그리드 스냅
            if (config.snapToGrid) {
                newBox.x = Math.round(newBox.x / config.gridSize) * config.gridSize;
                newBox.y = Math.round(newBox.y / config.gridSize) * config.gridSize;
                newBox.width = Math.round(newBox.width / config.gridSize) * config.gridSize;
                newBox.height = Math.round(newBox.height / config.gridSize) * config.gridSize;
            }
            
            return newBox;
        };
    }
    
    // =====================================================
    // 앵커 관리
    // =====================================================
    
    /**
     * 활성화된 앵커 설정
     * @param {Array<string>} anchors - 앵커 이름 배열
     */
    setEnabledAnchors(anchors) {
        this.enabledAnchors = anchors.filter(a => this.anchorPositions.hasOwnProperty(a));
    }
    
    /**
     * 모든 앵커 활성화
     */
    enableAllAnchors() {
        this.enabledAnchors = Object.keys(this.anchorPositions);
    }
    
    /**
     * 모서리 앵커만 활성화
     */
    enableCornerAnchorsOnly() {
        this.enabledAnchors = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    }
    
    /**
     * 중앙 앵커만 활성화
     */
    enableCenterAnchorsOnly() {
        this.enabledAnchors = ['top-center', 'middle-left', 'middle-right', 'bottom-center'];
    }
    
    /**
     * 수평 앵커만 활성화
     */
    enableHorizontalAnchorsOnly() {
        this.enabledAnchors = ['middle-left', 'middle-right'];
    }
    
    /**
     * 수직 앵커만 활성화
     */
    enableVerticalAnchorsOnly() {
        this.enabledAnchors = ['top-center', 'bottom-center'];
    }
    
    /**
     * 특정 앵커 비활성화
     * @param {string} anchor - 앵커 이름
     */
    disableAnchor(anchor) {
        const index = this.enabledAnchors.indexOf(anchor);
        if (index !== -1) {
            this.enabledAnchors.splice(index, 1);
        }
    }
    
    /**
     * 앵커 위치 정보 반환
     * @param {string} anchor - 앵커 이름
     * @returns {Object|null}
     */
    getAnchorPosition(anchor) {
        return this.anchorPositions[anchor] || null;
    }
    
    /**
     * 앵커별 커서 반환
     * @param {string} anchor - 앵커 이름
     * @returns {string}
     */
    getAnchorCursor(anchor) {
        const pos = this.anchorPositions[anchor];
        return pos ? pos.cursor : 'default';
    }
    
    // =====================================================
    // 제약 조건 설정
    // =====================================================
    
    /**
     * 크기 제한 설정
     * @param {Object} limits - { minWidth, minHeight, maxWidth, maxHeight }
     */
    setSizeLimits(limits) {
        if (limits.minWidth !== undefined) this.config.minWidth = limits.minWidth;
        if (limits.minHeight !== undefined) this.config.minHeight = limits.minHeight;
        if (limits.maxWidth !== undefined) this.config.maxWidth = limits.maxWidth;
        if (limits.maxHeight !== undefined) this.config.maxHeight = limits.maxHeight;
    }
    
    /**
     * 비율 유지 설정
     * @param {boolean} enabled
     */
    setKeepRatio(enabled) {
        this.config.keepRatio = enabled;
    }
    
    /**
     * 수평 방향 잠금
     * @param {boolean} locked
     */
    setLockHorizontal(locked) {
        this.config.lockHorizontal = locked;
        
        if (locked) {
            // 수평 앵커 비활성화
            this.enabledAnchors = this.enabledAnchors.filter(a => 
                !['middle-left', 'middle-right'].includes(a)
            );
        }
    }
    
    /**
     * 수직 방향 잠금
     * @param {boolean} locked
     */
    setLockVertical(locked) {
        this.config.lockVertical = locked;
        
        if (locked) {
            // 수직 앵커 비활성화
            this.enabledAnchors = this.enabledAnchors.filter(a => 
                !['top-center', 'bottom-center'].includes(a)
            );
        }
    }
    
    /**
     * 그리드 스냅 설정
     * @param {boolean} enabled
     * @param {number} gridSize
     */
    setSnapToGrid(enabled, gridSize = 10) {
        this.config.snapToGrid = enabled;
        this.config.gridSize = gridSize;
    }
    
    // =====================================================
    // 스타일 설정
    // =====================================================
    
    /**
     * 핸들 크기 설정
     * @param {number} size
     */
    setSize(size) {
        this.config.size = size;
    }
    
    /**
     * 핸들 색상 설정
     * @param {Object} colors
     */
    setColors(colors) {
        this.cssColors = { ...this.cssColors, ...colors };
    }
    
    /**
     * 호버 스케일 설정
     * @param {number} scale
     */
    setHoverScale(scale) {
        this.config.hoverScale = scale;
    }
    
    // =====================================================
    // 프리셋
    // =====================================================
    
    /**
     * Equipment 프리셋 (자유 크기)
     */
    setEquipmentPreset() {
        this.enableAllAnchors();
        this.setKeepRatio(false);
        this.setLockHorizontal(false);
        this.setLockVertical(false);
    }
    
    /**
     * Wall 프리셋 (수평만)
     */
    setWallPreset() {
        this.enableHorizontalAnchorsOnly();
        this.setKeepRatio(false);
        this.setLockVertical(true);
    }
    
    /**
     * Image 프리셋 (비율 유지)
     */
    setImagePreset() {
        this.enableCornerAnchorsOnly();
        this.setKeepRatio(true);
    }
    
    /**
     * Room 프리셋 (모서리만)
     */
    setRoomPreset() {
        this.enableCornerAnchorsOnly();
        this.setKeepRatio(false);
    }
    
    // =====================================================
    // 콜백
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
    
    /**
     * 리사이즈 시작 콜백 호출
     * @param {Object} info
     */
    onResizeStart(info) {
        if (this.callbacks.onResizeStart) {
            this.callbacks.onResizeStart(info);
        }
    }
    
    /**
     * 리사이즈 중 콜백 호출
     * @param {Object} info
     */
    onResize(info) {
        if (this.callbacks.onResize) {
            this.callbacks.onResize(info);
        }
    }
    
    /**
     * 리사이즈 종료 콜백 호출
     * @param {Object} info
     */
    onResizeEnd(info) {
        if (this.callbacks.onResizeEnd) {
            this.callbacks.onResizeEnd(info);
        }
    }
    
    // =====================================================
    // 유틸리티
    // =====================================================
    
    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * 현재 활성화된 앵커 반환
     * @returns {Array<string>}
     */
    getEnabledAnchors() {
        return [...this.enabledAnchors];
    }
    
    /**
     * 설정 복제
     * @returns {ResizeHandle}
     */
    clone() {
        return new ResizeHandle({
            cssColors: { ...this.cssColors },
            ...this.config,
            enabledAnchors: [...this.enabledAnchors]
        });
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 초기화
     */
    reset() {
        this.enableAllAnchors();
        this.config.keepRatio = false;
        this.config.lockHorizontal = false;
        this.config.lockVertical = false;
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.callbacks = {};
        console.log('[ResizeHandle] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined') {
    window.ResizeHandle = ResizeHandle;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResizeHandle;
}

export { ResizeHandle };