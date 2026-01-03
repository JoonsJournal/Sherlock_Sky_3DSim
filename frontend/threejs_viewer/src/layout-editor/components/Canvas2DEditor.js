/**
 * Canvas2DEditor.js v6.1.0 (EditorStateManager 통합)
 * ===================================================
 * 
 * ✨ v6.1.0 수정 (EditorStateManager 통합):
 * - ✅ stateManager 속성 추가
 * - ✅ deselectAll() → stateManager.clearSelection() 위임
 * - ✅ deleteSelected() → stateManager 사용
 * - ✅ clearSelection() 편의 메서드 추가
 * 
 * ✨ v6.0.1 수정:
 * - ✅ toggleSnapToGrid()에서 enable()/disable() 메서드 사용
 * 
 * Phase 4 리팩토링: 모듈 완전 분리 및 통합
 * 
 * 통합된 모듈:
 * - LayerManager.js: 레이어 및 Shape 저장소 관리
 * - CanvasRenderer.js: 모든 렌더링 담당
 * - CanvasEventHandler.js: 이벤트 처리
 * - Selection2DManager.js: 선택 상태 관리
 * - SelectionRenderer.js: 선택 시각화
 * - LayoutExporter.js: Layout Export
 * - EditorStateManager.js: 통합 상태 관리 ✨ NEW
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/components/Canvas2DEditor.js
 */

class Canvas2DEditor {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }

        // CSS 변수 로드
        this.loadCSSColors();

        // 기본 설정
        this.config = {
            width: options.width || 1200,
            height: options.height || 800,
            scale: options.scale || 10,
            gridSize: options.gridSize || 10,
            gridMajorInterval: options.gridMajorInterval || 10,
            backgroundColor: options.backgroundColor || this.cssColors.bg,
            gridColor: options.gridColor || this.cssColors.gridMinor,
            gridMajorColor: options.gridMajorColor || this.cssColors.gridMajor,
            showGrid: options.showGrid !== false,
            snapToGrid: options.snapToGrid !== false
        };

        // Konva Stage
        this.stage = null;
        
        // 분리된 모듈 참조
        this.layerManager = null;
        this.renderer = null;
        this.eventHandler = null;
        this.selectionManager = null;
        this.selectionRenderer = null;
        this.layoutExporter = null;
        
        // ✨ v6.1.0: EditorStateManager 참조
        this.stateManager = null;

        // 하위 호환성을 위한 layers 프록시
        this.layers = null;
        
        // 하위 호환성을 위한 Shape Maps 프록시
        this.equipmentShapes = null;
        this.wallShapes = null;
        this.componentShapes = null;

        // 현재 레이아웃
        this.currentLayout = null;

        // 하위 호환성: selectedObjects 프록시
        this._selectedObjectsProxy = null;

        // Transformer 참조 (하위 호환성)
        this.transformer = null;
        
        // 박스 선택 플래그
        this._isBoxSelecting = false;

        // 외부 도구/매니저 참조
        this.zoomController = null;
        this.propertyPanel = null;
        this.equipmentArrayTool = null;
        this.wallDrawTool = null;
        this.handleManager = null;
        this.smartGuideManager = null;
        this.snapManager = null;
        this.fenceSelection = null;
        this.alignmentGuide = null;  // ✨ v6.1.0: 추가

        // 초기화
        this.init();
    }

    // =====================================================
    // 하위 호환성: selectedObjects getter/setter
    // =====================================================

    get selectedObjects() {
        if (this.selectionManager) {
            return this.selectionManager.getSelectedObjects();
        }
        return this._selectedObjectsProxy || [];
    }

    set selectedObjects(value) {
        this._selectedObjectsProxy = value;
    }

    // =====================================================
    // CSS 색상 로드
    // =====================================================

    loadCSSColors() {
        try {
            const dummy = document.createElement('div');
            dummy.className = 'equipment-default';
            document.body.appendChild(dummy);
            const styles = getComputedStyle(document.documentElement);
            
            this.cssColors = {
                equipmentDefault: styles.getPropertyValue('--canvas-equipment-default').trim() || '#4a90e2',
                equipmentSelected: styles.getPropertyValue('--canvas-equipment-selected').trim() || '#FFD700',
                equipmentHover: styles.getPropertyValue('--canvas-equipment-hover').trim() || '#3498db',
                equipmentStroke: styles.getPropertyValue('--canvas-equipment-stroke').trim() || '#2c3e50',
                
                transformerBorder: styles.getPropertyValue('--canvas-transformer-border').trim() || '#667eea',
                transformerAnchorStroke: styles.getPropertyValue('--canvas-transformer-anchor-stroke').trim() || '#667eea',
                transformerAnchorFill: styles.getPropertyValue('--canvas-transformer-anchor-fill').trim() || '#ffffff',
                
                bg: styles.getPropertyValue('--canvas-bg').trim() || '#f5f5f5',
                gridMinor: styles.getPropertyValue('--canvas-grid-minor').trim() || '#d0d0d0',
                gridMajor: styles.getPropertyValue('--canvas-grid-major').trim() || '#a0a0a0',
                gridLabel: styles.getPropertyValue('--canvas-grid-label').trim() || '#999999',
                
                selectionStroke: styles.getPropertyValue('--canvas-selection-stroke').trim() || '#667eea',
                selectionFill: styles.getPropertyValue('--canvas-selection-fill').trim() || 'rgba(102, 126, 234, 0.1)',
                
                coordBg: styles.getPropertyValue('--canvas-coord-bg').trim() || '#667eea',
                coordText: styles.getPropertyValue('--canvas-coord-text').trim() || '#ffffff',
                
                roomStroke: styles.getPropertyValue('--canvas-room-stroke').trim() || '#666666',
                wallDefault: styles.getPropertyValue('--canvas-wall-default').trim() || '#888888',
                officeFill: styles.getPropertyValue('--canvas-office-fill').trim() || '#d4e6f1',
                officeStroke: styles.getPropertyValue('--canvas-office-stroke').trim() || '#3498db',
                partition: styles.getPropertyValue('--canvas-partition').trim() || '#aaaaaa',
                
                textPrimary: styles.getPropertyValue('--canvas-text-primary').trim() || '#212529',
                textSecondary: styles.getPropertyValue('--canvas-text-secondary').trim() || '#6c757d',
                
                validationError: styles.getPropertyValue('--canvas-validation-error').trim() || '#e74c3c',
                validationWarning: styles.getPropertyValue('--canvas-validation-warning').trim() || '#f39c12'
            };
            
            document.body.removeChild(dummy);
            console.log('[Canvas2DEditor] CSS 색상 로드 완료');
            
        } catch (error) {
            console.warn('[Canvas2DEditor] CSS 색상 로드 실패, 기본값 사용:', error);
            this.cssColors = this.getDefaultColors();
        }
    }

    getDefaultColors() {
        return {
            equipmentDefault: '#4a90e2',
            equipmentSelected: '#FFD700',
            equipmentHover: '#3498db',
            equipmentStroke: '#2c3e50',
            transformerBorder: '#667eea',
            transformerAnchorStroke: '#667eea',
            transformerAnchorFill: '#ffffff',
            bg: '#f5f5f5',
            gridMinor: '#d0d0d0',
            gridMajor: '#a0a0a0',
            gridLabel: '#999999',
            selectionStroke: '#667eea',
            selectionFill: 'rgba(102, 126, 234, 0.1)',
            coordBg: '#667eea',
            coordText: '#ffffff',
            roomStroke: '#666666',
            wallDefault: '#888888',
            officeFill: '#d4e6f1',
            officeStroke: '#3498db',
            partition: '#aaaaaa',
            textPrimary: '#212529',
            textSecondary: '#6c757d',
            validationError: '#e74c3c',
            validationWarning: '#f39c12'
        };
    }

    // =====================================================
    // 초기화
    // =====================================================

    init() {
        console.log('[Canvas2DEditor] 초기화 시작 v6.1.0...');
        
        // 1. Konva Stage 생성
        this.stage = new Konva.Stage({
            container: this.containerId,
            width: this.config.width,
            height: this.config.height
        });

        // 2. LayerManager 초기화
        this.initLayerManager();
        
        // 3. CanvasRenderer 초기화
        this.initRenderer();
        
        // 4. CanvasEventHandler 초기화
        this.initEventHandler();

        // 5. 그리드 렌더링
        if (this.config.showGrid) {
            this.renderer.drawGrid();
        }

        // 6. Selection2DManager 초기화
        this.initSelectionManager();

        // 7. SelectionRenderer 초기화
        this.initSelectionRenderer();

        // 8. LayoutExporter 초기화
        this.initLayoutExporter();

        // 9. SmartGuideManager 초기화
        this.initSmartGuideManager();

        // 10. SnapManager 초기화
        this.initSnapManager();

        // 11. FenceSelection 초기화
        this.initFenceSelection();

        console.log('[Canvas2DEditor] 초기화 완료 v6.1.0');
    }

    // =====================================================
    // 모듈 초기화
    // =====================================================

    initLayerManager() {
        const LayerManagerClass = window.LayerManager || (typeof LayerManager !== 'undefined' ? LayerManager : null);
        
        if (!LayerManagerClass) {
            console.error('[Canvas2DEditor] LayerManager 클래스를 찾을 수 없습니다');
            this.createLayersFallback();
            return;
        }
        
        this.layerManager = new LayerManagerClass(this.stage);
        this.layerManager.createLayers();
        
        // 하위 호환성: layers 프록시
        this.layers = this.layerManager.getAllLayers();
        
        // 하위 호환성: Shape Maps 프록시
        this.equipmentShapes = this.layerManager.getEquipmentMap();
        this.wallShapes = this.layerManager.getWallMap();
        this.componentShapes = this.layerManager.getComponentMap();
        
        // 레이어 별칭 (하위 호환성)
        this.backgroundLayer = this.layers.background;
        this.roomLayer = this.layers.room;
        this.equipmentLayer = this.layers.equipment;
        this.uiLayer = this.layers.ui;
        
        console.log('[Canvas2DEditor] LayerManager 초기화 완료');
    }

    createLayersFallback() {
        console.warn('[Canvas2DEditor] LayerManager Fallback 모드');
        
        this.layers = {
            background: new Konva.Layer({ listening: false }),
            room: new Konva.Layer(),
            equipment: new Konva.Layer(),
            ui: new Konva.Layer()
        };
        
        this.stage.add(this.layers.background);
        this.stage.add(this.layers.room);
        this.stage.add(this.layers.equipment);
        this.stage.add(this.layers.ui);
        
        this.equipmentShapes = new Map();
        this.wallShapes = new Map();
        this.componentShapes = new Map();
        
        this.backgroundLayer = this.layers.background;
        this.roomLayer = this.layers.room;
        this.equipmentLayer = this.layers.equipment;
        this.uiLayer = this.layers.ui;
    }

    initRenderer() {
        const CanvasRendererClass = window.CanvasRenderer || (typeof CanvasRenderer !== 'undefined' ? CanvasRenderer : null);
        
        if (!CanvasRendererClass) {
            console.warn('[Canvas2DEditor] CanvasRenderer 클래스를 찾을 수 없습니다');
            return;
        }
        
        this.renderer = new CanvasRendererClass(
            this.layerManager,
            this.config,
            this.cssColors
        );
        
        console.log('[Canvas2DEditor] CanvasRenderer 초기화 완료');
    }

    initEventHandler() {
        const CanvasEventHandlerClass = window.CanvasEventHandler || (typeof CanvasEventHandler !== 'undefined' ? CanvasEventHandler : null);
        
        if (!CanvasEventHandlerClass) {
            console.warn('[Canvas2DEditor] CanvasEventHandler 클래스를 찾을 수 없습니다');
            this.setupEventListenersFallback();
            return;
        }
        
        this.eventHandler = new CanvasEventHandlerClass(this.stage, this);
        this.eventHandler.setupKeyboardFocus();
        this.eventHandler.setupEventListeners();
        this.eventHandler.setupRightClickPan();
        
        console.log('[Canvas2DEditor] CanvasEventHandler 초기화 완료');
    }

    setupEventListenersFallback() {
        console.warn('[Canvas2DEditor] EventHandler Fallback 모드');
        
        const container = this.stage.container();
        container.tabIndex = 1;
        container.style.outline = 'none';
        
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage) {
                this.deselectAll();
            }
        });
        
        this.setupRightClickPan();
    }

    setupRightClickPan() {
        let isPanning = false;
        let lastPos = { x: 0, y: 0 };
        
        this.stage.on('mousedown', (e) => {
            if (e.evt.button === 2) {
                isPanning = true;
                lastPos = { x: e.evt.clientX, y: e.evt.clientY };
                this.stage.container().style.cursor = 'grabbing';
                e.evt.preventDefault();
            }
        });
        
        this.stage.on('mousemove', (e) => {
            if (!isPanning) return;
            const dx = e.evt.clientX - lastPos.x;
            const dy = e.evt.clientY - lastPos.y;
            const currentPos = this.stage.position();
            this.stage.position({ x: currentPos.x + dx, y: currentPos.y + dy });
            lastPos = { x: e.evt.clientX, y: e.evt.clientY };
            e.evt.preventDefault();
        });
        
        this.stage.on('mouseup', (e) => {
            if (e.evt.button === 2) {
                isPanning = false;
                this.stage.container().style.cursor = 'default';
                e.evt.preventDefault();
            }
        });
        
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 && isPanning) {
                isPanning = false;
                this.stage.container().style.cursor = 'default';
            }
        });
        
        this.stage.container().addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // Selection2DManager 초기화
    initSelectionManager() {
        const Selection2DManagerClass = window.Selection2DManager || (typeof Selection2DManager !== 'undefined' ? Selection2DManager : null);
        
        if (!Selection2DManagerClass) {
            console.warn('[Canvas2DEditor] Selection2DManager 클래스를 찾을 수 없습니다');
            return;
        }

        this.selectionManager = new Selection2DManagerClass({
            onSelect: (shape) => {
                if (this.selectionRenderer) {
                    this.selectionRenderer.applySelectionHighlight(shape);
                }
            },
            onDeselect: (shape) => {
                if (this.selectionRenderer) {
                    this.selectionRenderer.removeSelectionHighlight(shape);
                }
            },
            onSelectionChange: (objects, info) => {
                this.updateTransformer();
                this.updatePropertyPanel();
                console.log(`[Canvas2DEditor] 선택 변경: ${info.count}개`);
            }
        });

        console.log('[Canvas2DEditor] Selection2DManager 초기화 완료');
    }

    // SelectionRenderer 초기화
    initSelectionRenderer() {
        const SelectionRendererClass = window.SelectionRenderer || (typeof SelectionRenderer !== 'undefined' ? SelectionRenderer : null);
        
        if (!SelectionRendererClass) {
            console.warn('[Canvas2DEditor] SelectionRenderer 클래스를 찾을 수 없습니다');
            return;
        }

        this.selectionRenderer = new SelectionRendererClass(
            this.layers.ui,
            this.cssColors,
            { rotateEnabled: true, keepRatio: false }
        );

        console.log('[Canvas2DEditor] SelectionRenderer 초기화 완료');
    }

    // LayoutExporter 초기화
    initLayoutExporter() {
        const LayoutExporterClass = window.LayoutExporter || (typeof LayoutExporter !== 'undefined' ? LayoutExporter : null);
        
        if (!LayoutExporterClass) {
            console.warn('[Canvas2DEditor] LayoutExporter 클래스를 찾을 수 없습니다');
            return;
        }

        this.layoutExporter = new LayoutExporterClass(
            this.layerManager,
            this.config
        );

        console.log('[Canvas2DEditor] LayoutExporter 초기화 완료');
    }

    // 외부 매니저 초기화
    initSmartGuideManager() {
        if (typeof SmartGuideManager === 'undefined') {
            console.warn('[Canvas2DEditor] SmartGuideManager 클래스를 찾을 수 없습니다');
            return;
        }

        this.smartGuideManager = new SmartGuideManager(this.layers.ui, {
            enabled: true,
            snapEnabled: true,
            snapThreshold: 5,
            lineColor: this.cssColors.transformerBorder || '#667eea',
            showDistance: true,
            alignEdges: true,
            alignCenters: true,
            stage: this.stage  // ✨ Stage 전달
        });

        console.log('[Canvas2DEditor] SmartGuideManager 초기화 완료');
    }

    setSmartGuideManager(smartGuideManager) {
        this.smartGuideManager = smartGuideManager;
        console.log('[Canvas2DEditor] SmartGuideManager 설정 완료');
    }

    initSnapManager() {
        if (typeof SnapManager === 'undefined') {
            console.warn('[Canvas2DEditor] SnapManager 클래스를 찾을 수 없습니다');
            return;
        }

        let gridSnap = null;
        if (typeof GridSnap !== 'undefined') {
            gridSnap = new GridSnap({
                gridSize: this.config.gridSize || 10,
                enabled: this.config.snapToGrid !== false
            });
        }

        let miceSnapPoints = null;
        if (typeof MICESnapPoints !== 'undefined') {
            miceSnapPoints = new MICESnapPoints(this.layers.ui, { enabled: false });
        }

        this.snapManager = new SnapManager({
            gridSnap: gridSnap,
            miceSnapPoints: miceSnapPoints,
            enabled: true
        });

        console.log('[Canvas2DEditor] SnapManager 초기화 완료');
    }

    setSnapManager(snapManager) {
        this.snapManager = snapManager;
        console.log('[Canvas2DEditor] SnapManager 설정 완료');
    }

    initFenceSelection() {
        if (typeof FenceSelection === 'undefined') {
            console.warn('[Canvas2DEditor] FenceSelection 클래스를 찾을 수 없습니다');
            return;
        }

        this.fenceSelection = new FenceSelection(this.stage, this.layers.ui, {
            strokeColor: this.cssColors.selectionStroke || '#667eea',
            fillColor: this.cssColors.selectionFill || 'rgba(102, 126, 234, 0.1)',
            strokeWidth: 1,
            dash: [5, 5],
            windowColor: '#667eea',
            crossingColor: '#27ae60'
        });

        console.log('[Canvas2DEditor] FenceSelection 초기화 완료');
    }

    setFenceSelection(fenceSelection) {
        this.fenceSelection = fenceSelection;
        console.log('[Canvas2DEditor] FenceSelection 설정 완료');
    }

    // =====================================================
    // ✨ v6.1.0: EditorStateManager 설정
    // =====================================================

    /**
     * StateManager 설정 (initLayoutServices에서 호출)
     */
    setStateManager(stateManager) {
        this.stateManager = stateManager;
        console.log('[Canvas2DEditor] EditorStateManager 설정 완료');
    }

    // =====================================================
    // 선택 관리 (Selection2DManager 위임)
    // =====================================================

    /**
     * 객체 선택
     */
    selectObject(shape, multiSelect = false) {
        if (!shape) return;
        
        console.log('[Canvas2DEditor] selectObject:', shape.id(), 'multiSelect:', multiSelect);
        
        if (this.selectionManager) {
            this.selectionManager.selectObject(shape, multiSelect);
        } else {
            this._selectObjectFallback(shape, multiSelect);
        }
    }

    /**
     * 다중 선택
     */
    selectMultiple(shape) {
        this.selectObject(shape, true);
    }

    /**
     * 객체 선택 해제
     */
    deselectObject(shape) {
        if (this.selectionManager) {
            this.selectionManager.deselectObject(shape);
        }
        this.updateTransformer();
    }

    /**
     * ✨ v6.1.0: 전체 선택 해제 (StateManager 사용)
     */
    deselectAll() {
        console.log('[Canvas2DEditor] deselectAll');
        
        // ✨ v6.1.0: StateManager가 있으면 사용
        if (this.stateManager) {
            this.stateManager.clearSelection();
            this.updatePropertyPanel();
            return;
        }
        
        // 폴백: 기존 방식
        if (this.selectionManager) {
            this.selectionManager.deselectAll();
        }
        
        if (this.handleManager) {
            this.handleManager.detach();
        }
        
        if (this.transformer) {
            this.transformer.destroy();
            this.transformer = null;
        }
        
        if (this.selectionRenderer) {
            this.selectionRenderer.destroyTransformer();
        }
        
        this.layers.ui.batchDraw();
        this.updatePropertyPanel();
        
        console.log('[Canvas2DEditor] deselectAll 완료');
    }

    /**
     * ✨ v6.1.0: clearSelection 편의 메서드 (StateManager 래퍼)
     */
    clearSelection() {
        this.deselectAll();
    }

    /**
     * selectShape 별칭 (하위 호환성)
     */
    selectShape(shape) {
        this.selectObject(shape, false);
    }

    /**
     * 선택 Fallback
     * @private
     */
    _selectObjectFallback(shape, multiSelect) {
        if (!multiSelect) {
            this.deselectAll();
        }

        if (!this._selectedObjectsProxy) {
            this._selectedObjectsProxy = [];
        }

        if (this._selectedObjectsProxy.includes(shape)) {
            return;
        }

        this._selectedObjectsProxy.push(shape);
        
        if (this.selectionRenderer) {
            this.selectionRenderer.applySelectionHighlight(shape);
        }
        
        this.updateTransformer();
        this.updatePropertyPanel();
    }

    // =====================================================
    // Transformer 업데이트
    // =====================================================

    updateTransformer() {
        const selectedObjects = this.selectedObjects;

        // HandleManager 사용 (PowerPoint 스타일)
        if (typeof HandleManager !== 'undefined') {
            if (!this.handleManager) {
                this.handleManager = new HandleManager(this.layers.ui, {
                    cssColors: {
                        borderStroke: this.cssColors.transformerBorder || '#667eea',
                        anchorStroke: this.cssColors.transformerBorder || '#667eea',
                        anchorFill: '#ffffff',
                        rotateAnchorFill: '#27ae60',
                        rotateLineStroke: '#27ae60'
                    },
                    rotateEnabled: true,
                    rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
                    rotationSnapTolerance: 5,
                    anchorSize: 10,
                    anchorCornerRadius: 2,
                    borderStrokeWidth: 2,
                    minWidth: 10,
                    minHeight: 10,
                    onTransformEnd: (e, info) => {
                        console.log('[Canvas2DEditor] Transform 완료:', info);
                    }
                });
                console.log('[Canvas2DEditor] HandleManager 생성 완료');
            }
            
            if (selectedObjects.length === 0) {
                this.handleManager.detach();
            } else {
                this.handleManager.attachTo(selectedObjects);
                
                const firstObj = selectedObjects[0];
                const objName = firstObj.name() || '';
                
                if (objName.includes('wall') || firstObj.className === 'Line') {
                    this.handleManager.setWallMode();
                } else if (objName.includes('room')) {
                    this.handleManager.setRoomMode();
                } else {
                    this.handleManager.setEquipmentMode();
                }
            }
            
            this.layers.ui.batchDraw();
            return;
        }

        // SelectionRenderer 사용
        if (this.selectionRenderer) {
            this.selectionRenderer.updateTransformer(selectedObjects);
            this.transformer = this.selectionRenderer.getTransformer();
            return;
        }

        // Fallback
        if (this.transformer) {
            this.transformer.destroy();
        }

        if (selectedObjects.length === 0) {
            this.layers.ui.batchDraw();
            return;
        }

        this.transformer = new Konva.Transformer({
            nodes: selectedObjects,
            rotateEnabled: true,
            rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
            keepRatio: false,
            enabledAnchors: [
                'top-left', 'top-center', 'top-right',
                'middle-right', 'middle-left',
                'bottom-left', 'bottom-center', 'bottom-right'
            ],
            borderStroke: this.cssColors.transformerBorder,
            borderStrokeWidth: 2,
            anchorStroke: this.cssColors.transformerAnchorStroke,
            anchorFill: this.cssColors.transformerAnchorFill,
            anchorSize: 10,
            anchorCornerRadius: 2,
            rotateAnchorOffset: 40,
            rotateLineVisible: true
        });

        this.layers.ui.add(this.transformer);
        this.layers.ui.batchDraw();
    }

    // =====================================================
    // PropertyPanel / ZoomController 연동
    // =====================================================

    setPropertyPanel(propertyPanel) {
        this.propertyPanel = propertyPanel;
        console.log('[Canvas2DEditor] PropertyPanel 설정 완료');
    }

    updatePropertyPanel() {
        if (!this.propertyPanel) return;
        
        const selectedObjects = this.selectedObjects;
        
        if (selectedObjects.length === 0) {
            this.propertyPanel.clearProperties();
        } else if (selectedObjects.length === 1) {
            this.propertyPanel.showProperties(selectedObjects[0]);
        } else {
            this.propertyPanel.showMultipleProperties(selectedObjects);
        }
    }

    setZoomController(zoomController) {
        this.zoomController = zoomController;
        console.log('[Canvas2DEditor] ZoomController 설정 완료');
    }

    setWallDrawTool(wallDrawTool) {
        this.wallDrawTool = wallDrawTool;
        console.log('[Canvas2DEditor] WallDrawTool 설정 완료');
    }

    // =====================================================
    // 박스 선택 관련
    // =====================================================

    isBoxSelecting() {
        return this._isBoxSelecting;
    }

    setBoxSelecting(value) {
        this._isBoxSelecting = value;
    }

    getAllSelectableShapes() {
        const shapes = [];
        
        if (this.layers.equipment) {
            const equipments = this.layers.equipment.find('.equipment');
            equipments.forEach(shape => {
                if (shape.draggable && shape.draggable()) {
                    shapes.push(shape);
                }
            });
        }
        
        if (this.layers.room) {
            const roomShapes = this.layers.room.getChildren();
            roomShapes.forEach(shape => {
                if (shape.draggable && shape.draggable()) {
                    shapes.push(shape);
                }
            });
        }
        
        return shapes;
    }

    // =====================================================
    // Layout 로드
    // =====================================================

    loadLayout(layoutData, onClickCallback = null) {
        if (!layoutData) return;
        
        console.log('[Canvas2DEditor] Layout 로드 시작...');
        
        this.currentLayout = layoutData;
        this.clearLayout();

        if (layoutData.room) {
            this.renderer.drawRoom(layoutData.room);
        }

        if (layoutData.walls && layoutData.walls.length > 0) {
            layoutData.walls.forEach(wall => {
                this.renderer.drawWall(wall, onClickCallback);
            });
        }

        if (layoutData.office) {
            this.renderer.drawOffice(layoutData.office, onClickCallback);
        }

        if (layoutData.partitions && layoutData.partitions.length > 0) {
            layoutData.partitions.forEach(partition => {
                this.renderer.drawPartition(partition);
            });
        }

        if (layoutData.equipmentArrays && layoutData.equipmentArrays.length > 0) {
            layoutData.equipmentArrays.forEach(array => {
                this.renderer.drawEquipmentArray(array, onClickCallback);
            });
        }

        if (layoutData.equipment && layoutData.equipment.length > 0) {
            layoutData.equipment.forEach(eq => {
                this.renderer.drawSingleEquipment(eq, onClickCallback);
            });
        }

        this.layers.room.batchDraw();
        this.layers.equipment.batchDraw();

        console.log('[Canvas2DEditor] Layout 로드 완료');
    }

    clearLayout() {
        if (this.layerManager) {
            this.layerManager.clearAll();
        } else {
            this.layers.room.destroyChildren();
            this.layers.equipment.destroyChildren();
            this.equipmentShapes.clear();
            this.wallShapes.clear();
            this.componentShapes.clear();
        }
        
        this.deselectAll();
    }

    // =====================================================
    // 그리드 스냅
    // =====================================================

    snapToGrid(value) {
        const gridSize = this.config.gridSize;
        return Math.round(value / gridSize) * gridSize;
    }

    snapShapeToGrid(shape) {
        if (!shape) return;
        
        shape.x(this.snapToGrid(shape.x()));
        shape.y(this.snapToGrid(shape.y()));
        
        const layer = shape.getLayer();
        if (layer) {
            layer.batchDraw();
        }
    }

    // =====================================================
    // Component 생성
    // =====================================================

    createComponent(type, x, y, componentData) {
        console.log(`[Canvas2DEditor] 컴포넌트 생성: ${type}`);
        
        let shape = null;
        const onClickCallback = (s) => this.selectObject(s, false);
        
        if (this.renderer) {
            switch (type) {
                case 'partition':
                    shape = this.renderer.createPartitionComponent(x, y, componentData, onClickCallback);
                    break;
                case 'desk':
                    shape = this.renderer.createDeskComponent(x, y, componentData, onClickCallback);
                    break;
                case 'pillar':
                    shape = this.renderer.createPillarComponent(x, y, componentData, onClickCallback);
                    break;
                case 'office':
                    shape = this.renderer.createOfficeComponent(x, y, componentData, onClickCallback);
                    break;
                case 'equipment':
                    shape = this.renderer.createEquipmentComponent(x, y, componentData, onClickCallback);
                    break;
                default:
                    console.warn('[Canvas2DEditor] 알 수 없는 컴포넌트 타입:', type);
                    return;
            }
        }
        
        if (shape) {
            if (this.config.snapToGrid) {
                this.snapShapeToGrid(shape);
            }
            this.selectObject(shape, false);
            console.log('[Canvas2DEditor] 컴포넌트 생성 완료:', type);
        }
    }

    // =====================================================
    // 도구 연동
    // =====================================================

    initEquipmentArrayTool(equipmentArrayTool) {
        this.equipmentArrayTool = equipmentArrayTool;
        console.log('[Canvas2DEditor] EquipmentArrayTool 초기화 완료');
    }

    activateEquipmentArrayTool(config) {
        if (!this.equipmentArrayTool) {
            console.error('[Canvas2DEditor] EquipmentArrayTool이 초기화되지 않았습니다');
            return;
        }

        this.deactivateAllTools();
        this.equipmentArrayTool.activate(config);
        
        console.log('[Canvas2DEditor] EquipmentArrayTool 활성화');
    }

    deactivateAllTools() {
        if (this.equipmentArrayTool && this.equipmentArrayTool.isToolActive()) {
            this.equipmentArrayTool.deactivate();
        }
        console.log('[Canvas2DEditor] 모든 도구 비활성화');
    }

    addWall(wall) {
        const wallId = wall.id();
        
        if (this.layerManager) {
            this.layerManager.addWall(wallId, wall);
        } else {
            this.wallShapes.set(wallId, wall);
        }
        
        if (!this.currentLayout) {
            this.currentLayout = { walls: [] };
        }
        if (!this.currentLayout.walls) {
            this.currentLayout.walls = [];
        }
        
        console.log('[Canvas2DEditor] Wall 추가:', wallId);
    }

    updateRoom(roomData) {
        if (!this.currentLayout) {
            this.currentLayout = {};
        }
        
        this.currentLayout.room = {
            ...this.currentLayout.room,
            ...roomData
        };
        
        console.log('[Canvas2DEditor] Room 업데이트:', roomData);
    }

    // =====================================================
    // 검증 하이라이트
    // =====================================================

    highlightValidationErrors(errors) {
        if (this.renderer) {
            this.renderer.highlightValidationErrors(errors);
        }
    }

    clearValidationHighlights() {
        if (this.renderer) {
            this.renderer.clearValidationHighlights();
        }
    }

    scrollToError(error) {
        if (!error) return;
        
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        let targetX, targetY;
        
        if (error.equipmentId) {
            const shape = this.equipmentShapes.get(error.equipmentId);
            if (shape) {
                if (shape.findOne) {
                    targetX = shape.x();
                    targetY = shape.y();
                } else {
                    targetX = shape.x() + shape.width() / 2;
                    targetY = shape.y() + shape.height() / 2;
                }
            }
        }
        
        if (error.wallId && targetX === undefined) {
            const shape = this.wallShapes.get(error.wallId);
            if (shape) {
                const points = shape.points();
                if (points && points.length >= 4) {
                    targetX = (points[0] + points[2]) / 2;
                    targetY = (points[1] + points[3]) / 2;
                }
            }
        }
        
        if (error.position && targetX === undefined) {
            targetX = centerX + (error.position.x || 0) * scale;
            targetY = centerY + (error.position.y || error.position.z || 0) * scale;
        }
        
        if (targetX !== undefined && targetY !== undefined) {
            const stageWidth = this.stage.width();
            const stageHeight = this.stage.height();
            
            const newX = stageWidth / 2 - targetX;
            const newY = stageHeight / 2 - targetY;
            
            new Konva.Tween({
                node: this.stage,
                duration: 0.5,
                x: newX,
                y: newY,
                easing: Konva.Easings.EaseInOut
            }).play();
            
            console.log(`[Canvas2DEditor] 에러 위치로 스크롤: (${targetX}, ${targetY})`);
        }
    }

    selectErrorShape(error) {
        if (!error) return;
        
        let shape = null;
        
        if (error.equipmentId) {
            shape = this.equipmentShapes.get(error.equipmentId);
        } else if (error.equipmentId1) {
            shape = this.equipmentShapes.get(error.equipmentId1);
        } else if (error.wallId) {
            shape = this.wallShapes.get(error.wallId);
        }
        
        if (shape) {
            this.selectObject(shape, false);
            console.log('[Canvas2DEditor] 에러 Shape 선택:', shape.id());
        }
    }

    // =====================================================
    // 데이터 Export (LayoutExporter 위임)
    // =====================================================

    getCurrentLayout() {
        return this.currentLayout;
    }

    getObjectCount() {
        if (this.layoutExporter) {
            return this.layoutExporter.getObjectCount();
        }
        return {
            walls: this.wallShapes.size,
            equipments: this.equipmentShapes.size,
            components: this.componentShapes.size,
            total: this.wallShapes.size + this.equipmentShapes.size + this.componentShapes.size
        };
    }

    getSerializableData() {
        if (this.layoutExporter) {
            return this.layoutExporter.getSerializableData(this.currentLayout);
        }
        return {
            config: this.config,
            layers: this.layers,
            currentLayout: this.currentLayout
        };
    }

    exportLayoutData() {
        if (this.layoutExporter) {
            return this.layoutExporter.exportLayoutData(this.currentLayout);
        }
        
        console.warn('[Canvas2DEditor] LayoutExporter 없음, 기본 데이터 반환');
        return {
            ...this.currentLayout,
            exported_at: new Date().toISOString()
        };
    }

    getTotalEquipmentCount() {
        if (this.layoutExporter) {
            return this.layoutExporter.getTotalEquipmentCount();
        }
        const allEquipment = this.layers.equipment.find('.equipment');
        return allEquipment.length;
    }

    // =====================================================
    // Grid / Snap 토글
    // =====================================================

    toggleGrid() {
        this.config.showGrid = !this.config.showGrid;
        
        if (this.config.showGrid) {
            if (this.renderer) {
                this.renderer.redrawGrid();
            }
        } else {
            if (this.layers.background) {
                this.layers.background.destroyChildren();
                this.layers.background.batchDraw();
            }
        }
        
        console.log('[Canvas2DEditor] 그리드 토글:', this.config.showGrid);
        return this.config.showGrid;
    }

    /**
     * ✨ v6.1.1: Snap 토글 (SmartGuideManager 동기화 추가)
     */
    toggleSnapToGrid() {
        this.config.snapToGrid = !this.config.snapToGrid;
        
        // SnapManager 동기화
        if (this.snapManager) {
            if (this.config.snapToGrid) {
                this.snapManager.enable();
            } else {
                this.snapManager.disable();
            }
        }
        
        // ✨ v6.1.1: SmartGuideManager snapEnabled 동기화
        if (this.smartGuideManager) {
            this.smartGuideManager.setSnapEnabled(this.config.snapToGrid);
            console.log('[Canvas2DEditor] SmartGuideManager snapEnabled:', this.config.snapToGrid);
        }
        
        console.log('[Canvas2DEditor] 스냅 토글:', this.config.snapToGrid);
        return this.config.snapToGrid;
    }

    // =====================================================
    // ✨ v6.1.0: 삭제 (StateManager 사용)
    // =====================================================

    /**
     * 선택된 객체 삭제
     * @returns {number} 삭제된 객체 수
     */
    deleteSelected() {
        const selectedObjects = this.selectedObjects;
        
        if (selectedObjects.length === 0) {
            console.log('[Canvas2DEditor] 삭제할 객체 없음');
            return 0;
        }
        
        const count = selectedObjects.length;
        
        // ✨ v6.1.0: StateManager로 핸들 먼저 정리
        if (this.stateManager) {
            this.stateManager.prepareForDelete();
        }
        
        // 각 객체 삭제
        selectedObjects.forEach(shape => {
            const id = shape.id();
            
            // Map에서 제거
            if (this.equipmentShapes.has(id)) {
                this.equipmentShapes.delete(id);
            }
            if (this.wallShapes.has(id)) {
                this.wallShapes.delete(id);
            }
            if (this.componentShapes.has(id)) {
                this.componentShapes.delete(id);
            }
            
            // LayerManager에서 제거
            if (this.layerManager) {
                this.layerManager.removeShape(id);
            }
            
            // Shape 파괴
            shape.destroy();
        });
        
        // ✨ v6.1.0: StateManager로 삭제 후 정리
        if (this.stateManager) {
            this.stateManager.cleanupAfterDelete();
        } else {
            // 폴백: 기존 방식
            this.deselectAll();
        }
        
        // 레이어 다시 그리기
        this.layers.room.batchDraw();
        this.layers.equipment.batchDraw();
        
        console.log(`[Canvas2DEditor] ${count}개 객체 삭제됨`);
        return count;
    }

    // =====================================================
    // 유틸리티
    // =====================================================

    reloadCSSColors() {
        this.loadCSSColors();
        
        if (this.renderer) {
            this.renderer.updateCssColors(this.cssColors);
        }
        
        if (this.selectionRenderer) {
            this.selectionRenderer.updateColors(this.cssColors);
        }
        
        console.log('[Canvas2DEditor] CSS 색상 다시 로드 완료');
        
        if (this.currentLayout) {
            this.loadLayout(this.currentLayout);
        }
    }

    loadFromJSON(layoutData) {
        console.log('[Canvas2DEditor] JSON에서 Layout 로드...');
        
        const serializer = window.layoutSerializer || (window.LayoutSerializer ? new window.LayoutSerializer() : null);
        if (serializer) {
            serializer.deserialize(layoutData, this);
        } else {
            this.loadLayout(layoutData);
        }
        
        console.log('[Canvas2DEditor] JSON에서 Layout 로드 완료');
    }

    // =====================================================
    // 정리
    // =====================================================

    destroy() {
        console.log('[Canvas2DEditor] 파괴 시작...');
        
        // StateManager 정리
        if (this.stateManager) {
            this.stateManager.destroy();
            this.stateManager = null;
        }
        
        // 모듈 정리
        if (this.selectionManager) {
            this.selectionManager.destroy();
            this.selectionManager = null;
        }
        
        if (this.selectionRenderer) {
            this.selectionRenderer.destroy();
            this.selectionRenderer = null;
        }
        
        if (this.layoutExporter) {
            this.layoutExporter.destroy();
            this.layoutExporter = null;
        }
        
        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }
        
        if (this.eventHandler) {
            this.eventHandler = null;
        }
        
        if (this.layerManager) {
            this.layerManager = null;
        }
        
        // Stage 파괴
        if (this.stage) {
            this.stage.destroy();
            this.stage = null;
        }
        
        console.log('[Canvas2DEditor] 파괴 완료');
    }
}

// ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined') {
    window.Canvas2DEditor = Canvas2DEditor;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Canvas2DEditor;
}