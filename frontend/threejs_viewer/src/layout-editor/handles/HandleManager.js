/**
 * HandleManager.js
 * ==================
 * 
 * 선택된 객체의 Transform 핸들을 총괄 관리하는 모듈
 * 
 * @version 1.0.0 - Phase 1.5
 * @module HandleManager
 * 
 * 역할:
 * 1. Konva.Transformer 래핑 및 관리
 * 2. ResizeHandle, RotateHandle 통합
 * 3. 커스텀 핸들 스타일링
 * 4. Transform 이벤트 처리
 * 5. 비율 유지, 회전 잠금 등 옵션 관리
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/handles/HandleManager.js
 */

class HandleManager {
    /**
     * @param {Konva.Layer} uiLayer - UI 레이어
     * @param {Object} options - 옵션
     */
    constructor(uiLayer, options = {}) {
        if (!uiLayer) {
            throw new Error('[HandleManager] UI Layer가 필요합니다');
        }
        
        this.uiLayer = uiLayer;
        
        // Konva Transformer
        this.transformer = null;
        
        // 현재 노드들
        this.nodes = [];
        
        // 핸들 모듈
        this.resizeHandle = null;
        this.rotateHandle = null;
        
        // CSS 색상
        this.cssColors = options.cssColors || this.getDefaultColors();
        
        // 기본 설정
        this.config = {
            // 회전 관련
            rotateEnabled: options.rotateEnabled !== false,
            rotationSnaps: options.rotationSnaps || [0, 45, 90, 135, 180, 225, 270, 315],
            rotationSnapTolerance: options.rotationSnapTolerance || 5,
            
            // 리사이즈 관련
            keepRatio: options.keepRatio || false,
            centeredScaling: options.centeredScaling || false,
            
            // 앵커 설정
            enabledAnchors: options.enabledAnchors || [
                'top-left', 'top-center', 'top-right',
                'middle-left', 'middle-right',
                'bottom-left', 'bottom-center', 'bottom-right'
            ],
            
            // 크기 제한
            boundBoxFunc: options.boundBoxFunc || null,
            minWidth: options.minWidth || 10,
            minHeight: options.minHeight || 10,
            maxWidth: options.maxWidth || Infinity,
            maxHeight: options.maxHeight || Infinity,
            
            // 스타일
            borderStrokeWidth: options.borderStrokeWidth || 2,
            anchorSize: options.anchorSize || 10,
            anchorCornerRadius: options.anchorCornerRadius || 2,
            
            // 패딩
            padding: options.padding || 0,
            
            // 플립 방지
            flipEnabled: options.flipEnabled !== false
        };
        
        // 콜백
        this.callbacks = {
            onTransformStart: options.onTransformStart || null,
            onTransform: options.onTransform || null,
            onTransformEnd: options.onTransformEnd || null,
            onDragStart: options.onDragStart || null,
            onDragMove: options.onDragMove || null,
            onDragEnd: options.onDragEnd || null
        };
        
        // 상태
        this.isTransforming = false;
        this.isDragging = false;
        
        console.log('[HandleManager] 초기화 완료 v1.0.0');
    }
    
    /**
     * 기본 색상 설정
     */
    getDefaultColors() {
        return {
            borderStroke: '#667eea',
            anchorStroke: '#667eea',
            anchorFill: '#ffffff',
            rotateAnchorFill: '#667eea',
            rotateLineStroke: '#667eea'
        };
    }
    
    // =====================================================
    // Transformer 생성 및 관리
    // =====================================================
    
    /**
     * Transformer 생성 또는 업데이트
     * @param {Array<Konva.Shape>} nodes - 노드 배열
     */
    attachTo(nodes) {
        // 이전 Transformer 제거
        this.detach();
        
        if (!nodes || nodes.length === 0) {
            return;
        }
        
        this.nodes = nodes;
        
        // Transformer 생성
        this.transformer = new Konva.Transformer({
            nodes: nodes,
            
            // 회전 설정
            rotateEnabled: this.config.rotateEnabled,
            rotationSnaps: this.config.rotationSnaps,
            rotationSnapTolerance: this.config.rotationSnapTolerance,
            
            // 리사이즈 설정
            keepRatio: this.config.keepRatio,
            centeredScaling: this.config.centeredScaling,
            enabledAnchors: this.config.enabledAnchors,
            flipEnabled: this.config.flipEnabled,
            
            // 크기 제한
            boundBoxFunc: this._createBoundBoxFunc(),
            
            // 스타일
            borderStroke: this.cssColors.borderStroke,
            borderStrokeWidth: this.config.borderStrokeWidth,
            anchorStroke: this.cssColors.anchorStroke,
            anchorFill: this.cssColors.anchorFill,
            anchorSize: this.config.anchorSize,
            anchorCornerRadius: this.config.anchorCornerRadius,
            
            // 회전 앵커 스타일
            rotateAnchorOffset: 40,
            rotateLineVisible: true,
            
            // 패딩
            padding: this.config.padding
        });
        
        // 이벤트 바인딩
        this._setupEvents();
        
        // 레이어에 추가
        this.uiLayer.add(this.transformer);
        this.uiLayer.batchDraw();
        
        console.log(`[HandleManager] Transformer 연결: ${nodes.length}개 노드`);
    }
    
    /**
     * Transformer 제거
     */
    detach() {
        if (this.transformer) {
            this.transformer.destroy();
            this.transformer = null;
        }
        this.nodes = [];
        this.uiLayer.batchDraw();
    }
    
    /**
     * Transformer 강제 업데이트
     */
    forceUpdate() {
        if (this.transformer) {
            this.transformer.forceUpdate();
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 노드 추가
     * @param {Konva.Shape} node - 추가할 노드
     */
    addNode(node) {
        if (!node || this.nodes.includes(node)) return;
        
        this.nodes.push(node);
        
        if (this.transformer) {
            this.transformer.nodes(this.nodes);
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 노드 제거
     * @param {Konva.Shape} node - 제거할 노드
     */
    removeNode(node) {
        const index = this.nodes.indexOf(node);
        if (index === -1) return;
        
        this.nodes.splice(index, 1);
        
        if (this.transformer) {
            if (this.nodes.length > 0) {
                this.transformer.nodes(this.nodes);
            } else {
                this.detach();
            }
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 노드 배열 설정
     * @param {Array<Konva.Shape>} nodes - 노드 배열
     */
    setNodes(nodes) {
        this.attachTo(nodes);
    }
    
    /**
     * 현재 노드 배열 반환
     * @returns {Array<Konva.Shape>}
     */
    getNodes() {
        return [...this.nodes];
    }
    
    // =====================================================
    // 이벤트 설정
    // =====================================================
    
    /**
     * Transformer 이벤트 설정
     * @private
     */
    _setupEvents() {
        if (!this.transformer) return;
        
        // Transform 시작
        this.transformer.on('transformstart', (e) => {
            this.isTransforming = true;
            
            if (this.callbacks.onTransformStart) {
                this.callbacks.onTransformStart(e, this._getTransformInfo());
            }
            
            console.log('[HandleManager] Transform 시작');
        });
        
        // Transform 중
        this.transformer.on('transform', (e) => {
            if (this.callbacks.onTransform) {
                this.callbacks.onTransform(e, this._getTransformInfo());
            }
        });
        
        // Transform 종료
        this.transformer.on('transformend', (e) => {
            this.isTransforming = false;
            
            if (this.callbacks.onTransformEnd) {
                this.callbacks.onTransformEnd(e, this._getTransformInfo());
            }
            
            console.log('[HandleManager] Transform 종료');
        });
        
        // 드래그 이벤트 (노드별)
        this.nodes.forEach(node => {
            node.on('dragstart', (e) => {
                this.isDragging = true;
                if (this.callbacks.onDragStart) {
                    this.callbacks.onDragStart(e, node);
                }
            });
            
            node.on('dragmove', (e) => {
                if (this.callbacks.onDragMove) {
                    this.callbacks.onDragMove(e, node);
                }
            });
            
            node.on('dragend', (e) => {
                this.isDragging = false;
                if (this.callbacks.onDragEnd) {
                    this.callbacks.onDragEnd(e, node);
                }
            });
        });
    }
    
    /**
     * Transform 정보 반환
     * @private
     */
    _getTransformInfo() {
        if (!this.transformer || this.nodes.length === 0) {
            return null;
        }
        
        const box = this.transformer.getClientRect();
        
        return {
            nodes: this.nodes,
            box: box,
            rotation: this.nodes[0].rotation(),
            scaleX: this.nodes[0].scaleX(),
            scaleY: this.nodes[0].scaleY()
        };
    }
    
    // =====================================================
    // 크기 제한 함수
    // =====================================================
    
    /**
     * BoundBox 함수 생성
     * @private
     */
    _createBoundBoxFunc() {
        const config = this.config;
        const customFunc = config.boundBoxFunc;
        
        return (oldBox, newBox) => {
            // 커스텀 함수가 있으면 먼저 적용
            if (customFunc) {
                newBox = customFunc(oldBox, newBox);
            }
            
            // 최소 크기 제한
            if (newBox.width < config.minWidth) {
                newBox.width = config.minWidth;
            }
            if (newBox.height < config.minHeight) {
                newBox.height = config.minHeight;
            }
            
            // 최대 크기 제한
            if (newBox.width > config.maxWidth) {
                newBox.width = config.maxWidth;
            }
            if (newBox.height > config.maxHeight) {
                newBox.height = config.maxHeight;
            }
            
            return newBox;
        };
    }
    
    // =====================================================
    // 설정 변경
    // =====================================================
    
    /**
     * 회전 활성화/비활성화
     * @param {boolean} enabled
     */
    setRotateEnabled(enabled) {
        this.config.rotateEnabled = enabled;
        if (this.transformer) {
            this.transformer.rotateEnabled(enabled);
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 비율 유지 활성화/비활성화
     * @param {boolean} enabled
     */
    setKeepRatio(enabled) {
        this.config.keepRatio = enabled;
        if (this.transformer) {
            this.transformer.keepRatio(enabled);
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 중심 기준 크기 조절 활성화/비활성화
     * @param {boolean} enabled
     */
    setCenteredScaling(enabled) {
        this.config.centeredScaling = enabled;
        if (this.transformer) {
            this.transformer.centeredScaling(enabled);
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 활성화된 앵커 설정
     * @param {Array<string>} anchors
     */
    setEnabledAnchors(anchors) {
        this.config.enabledAnchors = anchors;
        if (this.transformer) {
            this.transformer.enabledAnchors(anchors);
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 크기 제한 설정
     * @param {Object} limits - { minWidth, minHeight, maxWidth, maxHeight }
     */
    setSizeLimits(limits) {
        if (limits.minWidth !== undefined) this.config.minWidth = limits.minWidth;
        if (limits.minHeight !== undefined) this.config.minHeight = limits.minHeight;
        if (limits.maxWidth !== undefined) this.config.maxWidth = limits.maxWidth;
        if (limits.maxHeight !== undefined) this.config.maxHeight = limits.maxHeight;
        
        if (this.transformer) {
            this.transformer.boundBoxFunc(this._createBoundBoxFunc());
        }
    }
    
    /**
     * 회전 스냅 설정
     * @param {Array<number>} snaps - 스냅 각도 배열
     * @param {number} tolerance - 허용 오차
     */
    setRotationSnaps(snaps, tolerance = 5) {
        this.config.rotationSnaps = snaps;
        this.config.rotationSnapTolerance = tolerance;
        
        if (this.transformer) {
            this.transformer.rotationSnaps(snaps);
            this.transformer.rotationSnapTolerance(tolerance);
        }
    }
    
    /**
     * 색상 업데이트
     * @param {Object} colors
     */
    updateColors(colors) {
        this.cssColors = { ...this.cssColors, ...colors };
        
        if (this.transformer) {
            if (colors.borderStroke) this.transformer.borderStroke(colors.borderStroke);
            if (colors.anchorStroke) this.transformer.anchorStroke(colors.anchorStroke);
            if (colors.anchorFill) this.transformer.anchorFill(colors.anchorFill);
            this.uiLayer.batchDraw();
        }
    }
    
    // =====================================================
    // 프리셋 (자주 쓰는 설정)
    // =====================================================
    
    /**
     * Equipment 모드 (회전 가능, 자유 크기)
     */
    setEquipmentMode() {
        this.setRotateEnabled(true);
        this.setKeepRatio(false);
        this.setEnabledAnchors([
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right'
        ]);
        console.log('[HandleManager] Equipment 모드');
    }
    
    /**
     * Wall 모드 (회전 가능, 양쪽 끝만)
     */
    setWallMode() {
        this.setRotateEnabled(true);
        this.setKeepRatio(false);
        this.setEnabledAnchors(['middle-left', 'middle-right']);
        console.log('[HandleManager] Wall 모드');
    }
    
    /**
     * Room 모드 (회전 불가, 모서리만)
     */
    setRoomMode() {
        this.setRotateEnabled(false);
        this.setKeepRatio(false);
        this.setEnabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
        console.log('[HandleManager] Room 모드');
    }
    
    /**
     * 이미지 모드 (회전 가능, 비율 유지)
     */
    setImageMode() {
        this.setRotateEnabled(true);
        this.setKeepRatio(true);
        this.setEnabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
        console.log('[HandleManager] Image 모드');
    }
    
    // =====================================================
    // 콜백 설정
    // =====================================================
    
    /**
     * 콜백 설정
     * @param {string} name - 콜백 이름
     * @param {Function} callback - 콜백 함수
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
     * Transformer 가져오기
     * @returns {Konva.Transformer|null}
     */
    getTransformer() {
        return this.transformer;
    }
    
    /**
     * Transformer가 있는지 확인
     * @returns {boolean}
     */
    hasTransformer() {
        return this.transformer !== null;
    }
    
    /**
     * Transform 중인지 확인
     * @returns {boolean}
     */
    isTransformingNow() {
        return this.isTransforming;
    }
    
    /**
     * 드래그 중인지 확인
     * @returns {boolean}
     */
    isDraggingNow() {
        return this.isDragging;
    }
    
    /**
     * 현재 Transform 박스 반환
     * @returns {Object|null}
     */
    getTransformBox() {
        if (!this.transformer) return null;
        return this.transformer.getClientRect();
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 정리
     */
    clear() {
        this.detach();
        console.log('[HandleManager] 정리 완료');
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.uiLayer = null;
        this.callbacks = {};
        console.log('[HandleManager] 파괴 완료');
    }
}

// ✅ 전역 객체 등록 (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.HandleManager = HandleManager;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandleManager;
}