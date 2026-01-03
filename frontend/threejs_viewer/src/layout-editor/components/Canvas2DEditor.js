/**
 * Canvas2DEditor.js v5.0.3 (리팩토링 버전)
 * ==========================================
 * 
 * Phase 1.5 리팩토링: 모듈 분화 적용
 * 
 * 분리된 모듈:
 * - LayerManager.js: 레이어 및 Shape 저장소 관리
 * - CanvasRenderer.js: 모든 렌더링 담당
 * - CanvasEventHandler.js: 이벤트 처리
 * 
 * 이 파일의 역할:
 * - 메인 오케스트레이터
 * - 모듈 초기화 및 조율
 * - 공용 API 제공
 * - 선택 관리 (Transformer)
 * - 도구 연동
 * - 데이터 Export
 * 
 * ✨ v5.0.3 변경사항:
 * - SmartGuideManager 통합 (정렬 가이드라인)
 * - SnapManager 통합 (MICE 스냅 포인트)
 * - FenceSelection 통합 (Window/Crossing 박스 선택)
 * - getAllSelectableShapes() 메서드 추가
 * 
 * ✨ v5.0.2 변경사항:
 * - HandleManager 통합 (PowerPoint 스타일 8개 핸들 + 회전)
 * - 객체 타입별 모드 자동 설정 (Equipment/Wall/Room)
 * - 회전 스냅 (45도 단위) 활성화
 * 
 * ✨ v5.0.1 변경사항:
 * - WallDrawTool 속성 및 setWallDrawTool() 메서드 추가
 * - ObjectSelectionTool과 WallDrawTool 연동 지원
 * 
 * ✨ v5.0.0 변경사항 (Phase 1.5):
 * - LayerManager 통합
 * - CanvasRenderer 통합
 * - CanvasEventHandler 통합
 * - 기존 기능 100% 호환 유지
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/components/Canvas2DEditor.js
 */

// ES Module imports (빌드 환경에서 사용)
// import { LayerManager } from '../canvas/LayerManager.js';
// import { CanvasRenderer } from '../canvas/CanvasRenderer.js';
// import { CanvasEventHandler } from '../canvas/CanvasEventHandler.js';

class Canvas2DEditor {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }

        // ✅ CSS 변수 로드
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
        
        // ✨ v5.0.0: 분리된 모듈 참조
        this.layerManager = null;
        this.renderer = null;
        this.eventHandler = null;

        // 하위 호환성을 위한 layers 프록시
        this.layers = null;
        
        // 하위 호환성을 위한 Shape Maps 프록시
        this.equipmentShapes = null;
        this.wallShapes = null;
        this.componentShapes = null;

        // 현재 레이아웃
        this.currentLayout = null;

        // 선택 관리
        this.selectedObjects = [];
        this.transformer = null;
        
        // 박스 선택 플래그 (ObjectSelectionTool 연동)
        this._isBoxSelecting = false;

        // ZoomController 참조
        this.zoomController = null;

        // PropertyPanel 참조
        this.propertyPanel = null;

        // EquipmentArrayTool 참조
        this.equipmentArrayTool = null;

        // ✅ v5.0.1: WallDrawTool 참조 (ObjectSelectionTool 연동용)
        this.wallDrawTool = null;

        // ✅ v5.0.2: HandleManager 참조 (PowerPoint 스타일 핸들)
        this.handleManager = null;

        // ✅ v5.0.3: SmartGuideManager 참조 (정렬 가이드라인)
        this.smartGuideManager = null;

        // ✅ v5.0.3: SnapManager 참조 (MICE 스냅)
        this.snapManager = null;

        // ✅ v5.0.3: FenceSelection 참조 (박스 선택)
        this.fenceSelection = null;

        // 초기화
        this.init();
    }

    // =====================================================
    // CSS 색상 로드
    // =====================================================

    /**
     * CSS 변수에서 색상 로드
     */
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

    /**
     * 기본 색상 (CSS 로드 실패 시)
     */
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
        console.log('[Canvas2DEditor] 초기화 시작 v5.0.3...');
        
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

        // 6. SmartGuideManager 초기화
        this.initSmartGuideManager();

        // 7. SnapManager 초기화
        this.initSnapManager();

        // 8. FenceSelection 초기화
        this.initFenceSelection();

        console.log('[Canvas2DEditor] 초기화 완료 v5.0.3');
    }

    /**
     * LayerManager 초기화
     */
    initLayerManager() {
        // 모듈이 로드되었는지 확인
        const LayerManagerClass = window.LayerManager || LayerManager;
        
        if (!LayerManagerClass) {
            console.error('[Canvas2DEditor] LayerManager 클래스를 찾을 수 없습니다');
            // Fallback: 기존 방식으로 레이어 생성
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

    /**
     * LayerManager 없을 때 Fallback (하위 호환성)
     */
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

    /**
     * CanvasRenderer 초기화
     */
    initRenderer() {
        const CanvasRendererClass = window.CanvasRenderer || CanvasRenderer;
        
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

    /**
     * CanvasEventHandler 초기화
     */
    initEventHandler() {
        const CanvasEventHandlerClass = window.CanvasEventHandler || CanvasEventHandler;
        
        if (!CanvasEventHandlerClass) {
            console.warn('[Canvas2DEditor] CanvasEventHandler 클래스를 찾을 수 없습니다');
            this.setupEventListenersFallback();
            return;
        }
        
        this.eventHandler = new CanvasEventHandlerClass(this.stage, this);
        
        // 키보드 포커스 설정 (macOS 호환)
        this.eventHandler.setupKeyboardFocus();
        
        // 기본 이벤트 리스너 설정
        this.eventHandler.setupEventListeners();
        
        // 오른쪽 클릭 Pan 설정
        this.eventHandler.setupRightClickPan();
        
        console.log('[Canvas2DEditor] CanvasEventHandler 초기화 완료');
    }

    /**
     * EventHandler 없을 때 Fallback (하위 호환성)
     */
    setupEventListenersFallback() {
        console.warn('[Canvas2DEditor] EventHandler Fallback 모드');
        
        // 키보드 포커스
        const container = this.stage.container();
        container.tabIndex = 1;
        container.style.outline = 'none';
        
        // Stage 클릭 이벤트
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage) {
                this.deselectAll();
            }
        });
        
        // 오른쪽 클릭 Pan
        this.setupRightClickPan();
    }

    /**
     * Fallback: 오른쪽 클릭 Pan (하위 호환성)
     */
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

    // =====================================================
    // ✅ v5.0.3: SmartGuideManager 초기화
    // =====================================================

    /**
     * SmartGuideManager 초기화 (정렬 가이드라인)
     */
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
            alignCenters: true
        });

        console.log('[Canvas2DEditor] SmartGuideManager 초기화 완료');
    }

    /**
     * SmartGuideManager 설정
     * @param {SmartGuideManager} smartGuideManager - SmartGuideManager 인스턴스
     */
    setSmartGuideManager(smartGuideManager) {
        this.smartGuideManager = smartGuideManager;
        console.log('[Canvas2DEditor] SmartGuideManager 설정 완료');
    }

    // =====================================================
    // ✅ v5.0.3: SnapManager 초기화
    // =====================================================

    /**
     * SnapManager 초기화 (MICE 스냅)
     */
    initSnapManager() {
        if (typeof SnapManager === 'undefined') {
            console.warn('[Canvas2DEditor] SnapManager 클래스를 찾을 수 없습니다');
            return;
        }

        // GridSnap 생성
        let gridSnap = null;
        if (typeof GridSnap !== 'undefined') {
            gridSnap = new GridSnap({
                gridSize: this.config.gridSize || 10,
                enabled: this.config.snapToGrid !== false
            });
        }

        // MICESnapPoints 생성
        let miceSnapPoints = null;
        if (typeof MICESnapPoints !== 'undefined') {
            miceSnapPoints = new MICESnapPoints(this.layers.ui, {
                enabled: false  // 기본적으로 비활성화
            });
        }

        this.snapManager = new SnapManager({
            gridSnap: gridSnap,
            miceSnapPoints: miceSnapPoints,
            uiLayer: this.layers.ui,
            enabled: true,
            gridSnapEnabled: true,
            objectSnapEnabled: true,
            miceSnapEnabled: false,
            threshold: 10
        });

        console.log('[Canvas2DEditor] SnapManager 초기화 완료');
    }

    /**
     * SnapManager 설정
     * @param {SnapManager} snapManager - SnapManager 인스턴스
     */
    setSnapManager(snapManager) {
        this.snapManager = snapManager;
        console.log('[Canvas2DEditor] SnapManager 설정 완료');
    }

    // =====================================================
    // ✅ v5.0.3: FenceSelection 초기화
    // =====================================================

    /**
     * FenceSelection 초기화 (Window/Crossing 박스 선택)
     */
    initFenceSelection() {
        if (typeof FenceSelection === 'undefined') {
            console.warn('[Canvas2DEditor] FenceSelection 클래스를 찾을 수 없습니다');
            return;
        }

        const self = this;

        this.fenceSelection = new FenceSelection(this.stage, this.layers.ui, {
            cssColors: {
                selectionStroke: this.cssColors.selectionStroke || '#FF6600',
                selectionFill: 'rgba(255, 102, 0, 0.1)'
            },
            // 선택 가능한 shapes 반환
            getSelectableShapes: () => {
                return self.getAllSelectableShapes();
            },
            // 선택 완료 콜백
            onSelectionComplete: (selectedShapes, options) => {
                console.log('[Canvas2DEditor] FenceSelection 완료:', selectedShapes.length);
                
                if (options.addToExisting) {
                    // Ctrl+Shift+Drag: 기존 선택에 추가
                    selectedShapes.forEach(shape => {
                        self.selectMultiple(shape);
                    });
                } else {
                    // Shift+Drag: 새로운 선택
                    self.deselectAll();
                    selectedShapes.forEach(shape => {
                        self.selectMultiple(shape);
                    });
                }
            }
        });

        // FenceSelection은 ObjectSelectionTool에서 관리하므로 여기서는 활성화하지 않음
        // this.fenceSelection.activate();

        console.log('[Canvas2DEditor] FenceSelection 초기화 완료');
    }

    /**
     * 모든 선택 가능한 shapes 반환
     * @returns {Array<Konva.Shape>}
     */
    getAllSelectableShapes() {
        const shapes = [];
        const selectableKeywords = ['equipment', 'wall', 'office', 'partition', 'desk', 'pillar', 'component'];

        // Equipment 레이어
        if (this.layers.equipment) {
            this.layers.equipment.getChildren().forEach(shape => {
                const shapeName = shape.name() || '';
                const isSelectable = selectableKeywords.some(keyword => shapeName.includes(keyword));
                if (isSelectable && shape.draggable()) {
                    shapes.push(shape);
                }
            });
        }

        // Room 레이어 (walls)
        if (this.layers.room) {
            this.layers.room.getChildren().forEach(shape => {
                const shapeName = shape.name() || '';
                const isSelectable = selectableKeywords.some(keyword => shapeName.includes(keyword));
                if (isSelectable && shape.draggable()) {
                    shapes.push(shape);
                }
            });
        }

        return shapes;
    }

    /**
     * FenceSelection 설정
     * @param {FenceSelection} fenceSelection - FenceSelection 인스턴스
     */
    setFenceSelection(fenceSelection) {
        this.fenceSelection = fenceSelection;
        console.log('[Canvas2DEditor] FenceSelection 설정 완료');
    }

    // =====================================================
    // Layout 로드
    // =====================================================

    /**
     * Layout 데이터 로드
     * @param {Object} layoutData - Layout JSON 데이터
     */
    loadLayout(layoutData) {
        console.log('[Canvas2DEditor] Layout 로드:', layoutData);
        
        this.currentLayout = layoutData;

        // 레이어 클리어
        if (this.layerManager) {
            this.layerManager.clearAllLayers();
            this.layerManager.clearAllShapes();
        } else {
            this.layers.room.destroyChildren();
            this.layers.equipment.destroyChildren();
            this.layers.ui.destroyChildren();
            this.equipmentShapes.clear();
            this.wallShapes.clear();
            this.componentShapes.clear();
        }
        
        this.selectedObjects = [];

        // 클릭 콜백
        const onClickCallback = (shape, e) => {
            if (e && (e.evt.ctrlKey || e.evt.metaKey)) {
                this.selectMultiple(shape);
            } else {
                this.selectObject(shape, false);
            }
        };

        // Room 렌더링
        if (layoutData.room) {
            if (this.renderer) {
                this.renderer.drawRoom(layoutData.room);
            } else {
                this.drawRoom(layoutData.room);
            }
            
            // room 내부의 walls
            if (layoutData.room.walls && layoutData.room.walls.length > 0) {
                layoutData.room.walls.forEach(wall => {
                    if (this.renderer) {
                        this.renderer.drawWall(wall, onClickCallback);
                    } else {
                        this.drawWall(wall);
                    }
                });
            }
            
            // room 내부의 offices
            if (layoutData.room.offices && layoutData.room.offices.length > 0) {
                layoutData.room.offices.forEach(office => {
                    if (this.renderer) {
                        this.renderer.drawOffice(office, onClickCallback);
                    } else {
                        this.drawOffice(office);
                    }
                });
            }
        }

        // Walls 렌더링
        if (layoutData.walls && layoutData.walls.length > 0) {
            layoutData.walls.forEach(wall => {
                if (this.renderer) {
                    this.renderer.drawWall(wall, onClickCallback);
                } else {
                    this.drawWall(wall);
                }
            });
        }

        // Office 렌더링
        if (layoutData.office && layoutData.office.enabled) {
            if (this.renderer) {
                this.renderer.drawOffice(layoutData.office, onClickCallback);
            } else {
                this.drawOffice(layoutData.office);
            }
        }

        // Partitions 렌더링
        if (layoutData.partitions && layoutData.partitions.length > 0) {
            layoutData.partitions.forEach(partition => {
                if (this.renderer) {
                    this.renderer.drawPartition(partition);
                } else {
                    this.drawPartition(partition);
                }
            });
        }

        // Equipment Arrays 렌더링
        if (layoutData.equipmentArrays && layoutData.equipmentArrays.length > 0) {
            layoutData.equipmentArrays.forEach(array => {
                if (this.renderer) {
                    this.renderer.drawEquipmentArray(array, onClickCallback);
                } else {
                    this.drawEquipmentArray(array);
                }
            });
        }

        // 단순 equipment 배열 렌더링
        if (layoutData.equipment && layoutData.equipment.length > 0) {
            layoutData.equipment.forEach(eq => {
                if (this.renderer) {
                    this.renderer.drawSingleEquipment(eq, onClickCallback);
                } else {
                    this.drawSingleEquipment(eq);
                }
            });
        }

        // 레이어 다시 그리기
        this.layers.room.batchDraw();
        this.layers.equipment.batchDraw();

        console.log('[Canvas2DEditor] Layout 로드 완료');
    }

    // =====================================================
    // 선택 관리
    // =====================================================

    /**
     * 객체 선택
     * @param {Konva.Shape|Konva.Group} shape - 선택할 Shape
     * @param {boolean} multiSelect - 다중 선택 여부
     */
    selectObject(shape, multiSelect = false) {
        console.log('[Canvas2DEditor] selectObject:', shape.id(), 'multiSelect:', multiSelect);
        
        if (!multiSelect) {
            this.deselectAll();
        }

        if (this.selectedObjects.includes(shape)) {
            return;
        }

        this.selectedObjects.push(shape);
        
        // Line 객체 (wall, partition) 처리
        if (shape.className === 'Line') {
            const currentStroke = shape.stroke();
            const currentStrokeWidth = shape.strokeWidth();
            
            shape.setAttr('originalStroke', currentStroke);
            shape.setAttr('originalStrokeWidth', currentStrokeWidth);
            
            shape.stroke(this.cssColors.equipmentSelected);
            shape.strokeWidth((currentStrokeWidth || 3) + 2);
            shape.dash([8, 4]);
        } 
        // Group 또는 Rect 객체 처리
        else {
            const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
            
            if (rect.fill) {
                const currentFill = rect.fill();
                rect.setAttr('originalFill', currentFill);
                rect.fill(this.cssColors.equipmentSelected);
                rect.strokeWidth(3);
            }
        }
        
        this.updateTransformer();
        this.updatePropertyPanel();

        console.log('[Canvas2DEditor] 선택됨:', shape.id(), '총:', this.selectedObjects.length);
    }

    /**
     * 다중 선택
     * @param {Konva.Shape|Konva.Group} shape - 추가 선택할 Shape
     */
    selectMultiple(shape) {
        if (!this.selectedObjects.includes(shape)) {
            console.log('[Canvas2DEditor] 다중 선택 추가:', shape.id());
            
            this.selectedObjects.push(shape);
            
            if (shape.className === 'Line') {
                const currentStroke = shape.stroke();
                const currentStrokeWidth = shape.strokeWidth();
                
                shape.setAttr('originalStroke', currentStroke);
                shape.setAttr('originalStrokeWidth', currentStrokeWidth);
                
                shape.stroke(this.cssColors.equipmentSelected);
                shape.strokeWidth((currentStrokeWidth || 3) + 2);
                shape.dash([8, 4]);
            } else {
                const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
                
                if (rect.fill) {
                    rect.setAttr('originalFill', rect.fill());
                    rect.fill(this.cssColors.equipmentSelected);
                    rect.strokeWidth(3);
                }
            }
            
            this.updateTransformer();
            this.updatePropertyPanel();
        }
    }

    /**
     * 객체 선택 해제
     * @param {Konva.Shape|Konva.Group} shape - 선택 해제할 Shape
     */
    deselectObject(shape) {
        const index = this.selectedObjects.indexOf(shape);
        if (index > -1) {
            this.selectedObjects.splice(index, 1);
            
            if (shape.className === 'Line') {
                const originalStroke = shape.getAttr('originalStroke');
                const originalStrokeWidth = shape.getAttr('originalStrokeWidth');
                
                if (originalStroke) shape.stroke(originalStroke);
                if (originalStrokeWidth) shape.strokeWidth(originalStrokeWidth);
                shape.dash([]);
            } else {
                const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
                const originalFill = rect.getAttr('originalFill');
                
                if (originalFill) {
                    rect.fill(originalFill);
                    rect.strokeWidth(1);
                }
            }
            
            this.updateTransformer();
        }
    }

    /**
     * 전체 선택 해제
     */
    deselectAll() {
        console.log('[Canvas2DEditor] deselectAll, 선택된 객체:', this.selectedObjects.length);
        
        if (this.selectedObjects.length === 0) return;
        
        this.selectedObjects.forEach((shape) => {
            if (shape.className === 'Line') {
                const originalStroke = shape.getAttr('originalStroke');
                const originalStrokeWidth = shape.getAttr('originalStrokeWidth');
                
                if (originalStroke) shape.stroke(originalStroke);
                if (originalStrokeWidth) shape.strokeWidth(originalStrokeWidth);
                shape.dash([]);
            } else {
                const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
                const originalFill = rect.getAttr('originalFill');
                
                if (originalFill) {
                    rect.fill(originalFill);
                    rect.strokeWidth(1);
                }
            }
        });
        
        this.selectedObjects = [];
        
        if (this.transformer) {
            this.transformer.destroy();
            this.transformer = null;
        }
        
        this.layers.ui.batchDraw();
        this.updatePropertyPanel();
        
        console.log('[Canvas2DEditor] deselectAll 완료');
    }

    /**
     * selectShape 별칭 (하위 호환성)
     * @param {Konva.Shape|Konva.Group} shape - 선택할 Shape
     */
    selectShape(shape) {
        this.selectObject(shape, false);
    }

    /**
     * ✅ v5.0.2: Transformer 업데이트 (HandleManager 사용)
     */
    updateTransformer() {
        // HandleManager 사용 (PowerPoint 스타일 8개 핸들 + 회전)
        if (typeof HandleManager !== 'undefined') {
            // HandleManager가 없으면 생성
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
            
            if (this.selectedObjects.length === 0) {
                this.handleManager.detach();
            } else {
                this.handleManager.attachTo(this.selectedObjects);
                
                // 객체 타입에 따른 모드 설정
                const firstObj = this.selectedObjects[0];
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
        
        // Fallback: HandleManager가 없으면 기존 방식 사용
        if (this.transformer) {
            this.transformer.destroy();
        }

        if (this.selectedObjects.length === 0) {
            this.layers.ui.batchDraw();
            return;
        }

        this.transformer = new Konva.Transformer({
            nodes: this.selectedObjects,
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

    /**
     * PropertyPanel 설정
     * @param {PropertyPanel} propertyPanel - PropertyPanel 인스턴스
     */
    setPropertyPanel(propertyPanel) {
        this.propertyPanel = propertyPanel;
        console.log('[Canvas2DEditor] PropertyPanel 설정 완료');
    }

    /**
     * PropertyPanel 업데이트
     */
    updatePropertyPanel() {
        if (this.propertyPanel && this.selectedObjects.length > 0) {
            this.propertyPanel.show(this.selectedObjects);
        } else if (this.propertyPanel) {
            this.propertyPanel.hide();
        }
    }

    /**
     * ZoomController 설정
     * @param {ZoomController} zoomController - ZoomController 인스턴스
     */
    setZoomController(zoomController) {
        this.zoomController = zoomController;
        console.log('[Canvas2DEditor] ZoomController 설정 완료');
    }

    /**
     * ✅ v5.0.1: WallDrawTool 설정 (ObjectSelectionTool 연동용)
     * @param {WallDrawTool} wallDrawTool - WallDrawTool 인스턴스
     */
    setWallDrawTool(wallDrawTool) {
        this.wallDrawTool = wallDrawTool;
        console.log('[Canvas2DEditor] WallDrawTool 설정 완료');
    }

    // =====================================================
    // Grid / Snap
    // =====================================================

    /**
     * 그리드 그리기 (Fallback 또는 재그리기용)
     */
    drawGrid() {
        if (this.renderer) {
            this.renderer.drawGrid();
        }
    }

    /**
     * 그리드 토글
     */
    toggleGrid() {
        this.config.showGrid = !this.config.showGrid;
        this.layers.background.visible(this.config.showGrid);
        this.layers.background.batchDraw();
        console.log('[Canvas2DEditor] Grid:', this.config.showGrid ? 'ON' : 'OFF');
    }

    /**
     * Snap to Grid 토글
     * @returns {boolean} 새 상태
     */
    toggleSnapToGrid() {
        this.config.snapToGrid = !this.config.snapToGrid;
        console.log('[Canvas2DEditor] Snap to Grid:', this.config.snapToGrid);
        return this.config.snapToGrid;
    }

    /**
     * Snap to Grid 적용
     * @param {Konva.Shape} shape - 정렬할 Shape
     */
    snapToGrid(shape) {
        if (!this.config.snapToGrid) return;

        let gridSize = this.config.gridSize;
        if (this.zoomController && typeof this.zoomController.getCurrentGridSize === 'function') {
            gridSize = this.zoomController.getCurrentGridSize();
        }

        const x = Math.round(shape.x() / gridSize) * gridSize;
        const y = Math.round(shape.y() / gridSize) * gridSize;

        shape.x(x);
        shape.y(y);
        shape.getLayer().batchDraw();
    }

    /**
     * Shape를 Grid에 정렬 (별칭)
     * @param {Konva.Shape} shape - 정렬할 Shape
     */
    snapShapeToGrid(shape) {
        const gridSize = this.config.gridSize;
        const pos = shape.position();
        
        const snappedX = Math.round(pos.x / gridSize) * gridSize;
        const snappedY = Math.round(pos.y / gridSize) * gridSize;
        
        shape.position({ x: snappedX, y: snappedY });
    }

    // =====================================================
    // CRUD 작업
    // =====================================================

    /**
     * 선택된 객체 삭제
     */
    deleteSelected() {
        this.selectedObjects.forEach(shape => {
            const id = shape.id();
            
            if (shape.name() === 'equipment') {
                if (this.layerManager) {
                    this.layerManager.removeEquipment(id);
                } else {
                    this.equipmentShapes.delete(id);
                }
            } else if (shape.name() === 'wall') {
                if (this.layerManager) {
                    this.layerManager.removeWall(id);
                } else {
                    this.wallShapes.delete(id);
                }
            } else {
                if (this.layerManager) {
                    this.layerManager.removeComponent(id);
                } else {
                    this.componentShapes.delete(id);
                }
            }
            
            shape.destroy();
        });

        this.deselectAll();
        this.stage.batchDraw();
        console.log('[Canvas2DEditor] 선택된 객체 삭제 완료');
    }

    /**
     * 전체 클리어
     */
    clear() {
        if (this.layerManager) {
            this.layerManager.clearAllLayers();
            this.layerManager.clearAllShapes();
        } else {
            this.layers.room.destroyChildren();
            this.layers.equipment.destroyChildren();
            this.layers.ui.destroyChildren();
            
            this.layers.room.batchDraw();
            this.layers.equipment.batchDraw();
            this.layers.ui.batchDraw();
            
            this.equipmentShapes.clear();
            this.wallShapes.clear();
            this.componentShapes.clear();
        }
        
        this.selectedObjects = [];
        this.currentLayout = null;
        
        console.log('[Canvas2DEditor] 클리어 완료');
    }

    /**
     * 리사이즈
     * @param {number} width - 새 너비
     * @param {number} height - 새 높이
     */
    resize(width, height) {
        this.stage.width(width);
        this.stage.height(height);
        this.config.width = width;
        this.config.height = height;

        this.layers.background.destroyChildren();
        if (this.config.showGrid) {
            if (this.renderer) {
                this.renderer.drawGrid();
            } else {
                this.drawGrid();
            }
        }

        console.log(`[Canvas2DEditor] 리사이즈: ${width}x${height}`);
    }

    /**
     * 파괴
     */
    destroy() {
        if (this.eventHandler) {
            this.eventHandler.destroy();
        }
        if (this.renderer) {
            this.renderer.destroy();
        }
        if (this.layerManager) {
            this.layerManager.destroy();
        }
        if (this.stage) {
            this.stage.destroy();
            this.stage = null;
        }
        
        console.log('[Canvas2DEditor] 파괴 완료');
    }

    // =====================================================
    // Drop Zone / Component 생성
    // =====================================================

    /**
     * Canvas를 Drop Zone으로 설정
     */
    enableDropZone() {
        if (this.eventHandler) {
            this.eventHandler.enableDropZone();
        } else {
            // Fallback
            const container = this.stage.container();
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                container.classList.add('drag-over');
            });
            container.addEventListener('dragleave', (e) => {
                container.classList.remove('drag-over');
            });
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');
                this.handleDrop(e);
            });
            container.classList.add('canvas-drop-zone');
        }
        console.log('[Canvas2DEditor] Drop Zone 활성화');
    }

    /**
     * Drop 이벤트 처리
     * @param {DragEvent} event - Drop 이벤트
     */
    handleDrop(event) {
        try {
            const data = event.dataTransfer.getData('text/plain');
            if (!data) return;
            
            const component = JSON.parse(data);
            const rect = this.stage.container().getBoundingClientRect();
            const stagePos = this.stage.position();
            const scale = this.stage.scaleX();
            
            const x = (event.clientX - rect.left - stagePos.x) / scale;
            const y = (event.clientY - rect.top - stagePos.y) / scale;
            
            this.createComponentFromType(component.id, x, y, component);
            
        } catch (error) {
            console.error('[Canvas2DEditor] Drop 처리 오류:', error);
        }
    }

    /**
     * 타입별 컴포넌트 생성
     * @param {string} type - 컴포넌트 타입
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} componentData - 컴포넌트 데이터
     */
    createComponentFromType(type, x, y, componentData) {
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
        } else {
            // Fallback: 기존 방식
            switch (type) {
                case 'partition':
                    shape = this.createPartition(x, y, componentData);
                    break;
                case 'desk':
                    shape = this.createDesk(x, y, componentData);
                    break;
                case 'pillar':
                    shape = this.createPillar(x, y, componentData);
                    break;
                case 'office':
                    shape = this.createOffice(x, y, componentData);
                    break;
                case 'equipment':
                    shape = this.createEquipment(x, y, componentData);
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

    /**
     * EquipmentArrayTool 초기화
     * @param {EquipmentArrayTool} equipmentArrayTool - EquipmentArrayTool 인스턴스
     */
    initEquipmentArrayTool(equipmentArrayTool) {
        this.equipmentArrayTool = equipmentArrayTool;
        console.log('[Canvas2DEditor] EquipmentArrayTool 초기화 완료');
    }

    /**
     * EquipmentArrayTool 활성화
     * @param {Object} config - 배열 설정
     */
    activateEquipmentArrayTool(config) {
        if (!this.equipmentArrayTool) {
            console.error('[Canvas2DEditor] EquipmentArrayTool이 초기화되지 않았습니다');
            return;
        }

        this.deactivateAllTools();
        this.equipmentArrayTool.activate(config);
        
        console.log('[Canvas2DEditor] EquipmentArrayTool 활성화');
    }

    /**
     * 모든 도구 비활성화
     */
    deactivateAllTools() {
        if (this.equipmentArrayTool && this.equipmentArrayTool.isToolActive()) {
            this.equipmentArrayTool.deactivate();
        }
        console.log('[Canvas2DEditor] 모든 도구 비활성화');
    }

    /**
     * Wall 추가 (WallDrawTool 연동)
     * @param {Konva.Line} wall - 생성된 벽 객체
     */
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

    /**
     * Room 데이터 업데이트
     * @param {Object} roomData - Room 데이터
     */
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

    /**
     * 검증 에러 하이라이트
     * @param {Array} errors - 에러 배열
     */
    highlightValidationErrors(errors) {
        if (this.renderer) {
            this.renderer.highlightValidationErrors(errors);
        }
    }

    /**
     * 검증 하이라이트 제거
     */
    clearValidationHighlights() {
        if (this.renderer) {
            this.renderer.clearValidationHighlights();
        }
    }

    /**
     * 에러 위치로 스크롤
     * @param {Object} error - 에러 객체
     */
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

    /**
     * 에러 Shape 선택
     * @param {Object} error - 에러 객체
     */
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
    // 데이터 Export / 유틸리티
    // =====================================================

    /**
     * 현재 Layout 반환
     * @returns {Object|null}
     */
    getCurrentLayout() {
        return this.currentLayout;
    }

    /**
     * 객체 개수
     * @returns {Object}
     */
    getObjectCount() {
        if (this.layerManager) {
            return this.layerManager.getObjectCount();
        }
        return {
            walls: this.wallShapes.size,
            equipments: this.equipmentShapes.size,
            components: this.componentShapes.size,
            total: this.wallShapes.size + this.equipmentShapes.size + this.componentShapes.size
        };
    }

    /**
     * 직렬화 가능한 데이터 반환
     * @returns {Object}
     */
    getSerializableData() {
        return {
            config: this.config,
            layers: this.layers,
            currentLayout: this.currentLayout,
            wallShapes: this.wallShapes,
            equipmentShapes: this.equipmentShapes,
            componentShapes: this.componentShapes
        };
    }

    /**
     * Layout 데이터 Export
     * @returns {Object}
     */
    exportLayoutData() {
        console.log('[Canvas2DEditor] Layout 데이터 Export...');
        
        const baseLayout = this.currentLayout || {};
        
        const canvas = {
            width: this.config.width,
            height: this.config.height,
            scale: this.config.scale,
            gridSize: this.config.gridSize
        };
        
        const room = this.extractRoomData();
        const equipmentArrays = this.extractEquipmentArrays();
        const equipments = this.extractEquipments();
        const walls = this.extractWalls();
        const office = this.extractOffice();
        const components = this.extractComponents();
        
        const layoutData = {
            ...baseLayout,
            version: baseLayout.version || '1.0',
            site_id: baseLayout.site_id || 'unknown',
            template_name: baseLayout.template_name || 'custom',
            canvas: canvas,
            room: room,
            equipmentArrays: equipmentArrays,
            equipments: equipments,
            walls: walls,
            office: office,
            components: components,
            exported_at: new Date().toISOString()
        };
        
        console.log('[Canvas2DEditor] Layout exported:', {
            equipmentCount: equipments.length + equipmentArrays.reduce((sum, arr) => sum + (arr.equipments?.length || 0), 0),
            wallCount: walls.length,
            componentCount: components.length
        });
        
        return layoutData;
    }

    /**
     * getCurrentLayoutData 별칭
     * @returns {Object}
     */
    getCurrentLayoutData() {
        return this.exportLayoutData();
    }

    /**
     * Room 데이터 추출
     * @returns {Object}
     */
    extractRoomData() {
        if (this.currentLayout && this.currentLayout.room) {
            return { ...this.currentLayout.room };
        }
        return {
            width: this.config.width / this.config.scale,
            depth: this.config.height / this.config.scale,
            wallHeight: 4,
            wallThickness: 0.2
        };
    }

    /**
     * Equipment 배열 추출
     * @returns {Array}
     */
    extractEquipmentArrays() {
        if (this.currentLayout && this.currentLayout.equipmentArrays) {
            return this.currentLayout.equipmentArrays.map(array => {
                const updatedEquipments = (array.equipments || []).map(eq => {
                    const shape = this.equipmentShapes.get(eq.id);
                    if (shape) {
                        if (shape.findOne) {
                            return {
                                ...eq,
                                x: shape.x(),
                                y: shape.y(),
                                rotation: shape.rotation() || 0
                            };
                        }
                        return {
                            ...eq,
                            x: shape.x() + shape.width() / 2,
                            y: shape.y() + shape.height() / 2,
                            rotation: shape.rotation() || 0
                        };
                    }
                    return eq;
                });
                
                return { ...array, equipments: updatedEquipments };
            });
        }
        return [];
    }

    /**
     * 개별 Equipment 추출
     * @returns {Array}
     */
    extractEquipments() {
        const equipments = [];
        
        this.equipmentShapes.forEach((shape, id) => {
            if (this.currentLayout?.equipmentArrays?.some(arr => 
                arr.equipments?.some(eq => eq.id === id)
            )) {
                return;
            }
            
            let x, y, width, height, rotation;
            
            if (shape.findOne) {
                x = shape.x();
                y = shape.y();
                const rect = shape.findOne('.equipmentRect');
                if (rect) {
                    width = rect.width();
                    height = rect.height();
                }
                rotation = shape.rotation() || 0;
            } else {
                x = shape.x() + shape.width() / 2;
                y = shape.y() + shape.height() / 2;
                width = shape.width();
                height = shape.height();
                rotation = shape.rotation() || 0;
            }
            
            equipments.push({
                id: id,
                x: x,
                y: y,
                width: width,
                height: height,
                rotation: rotation,
                type: shape.getAttr('equipmentType') || 'default'
            });
        });
        
        return equipments;
    }

    /**
     * Walls 추출
     * @returns {Array}
     */
    extractWalls() {
        const walls = [];
        
        this.wallShapes.forEach((shape, id) => {
            const points = shape.points();
            if (points && points.length >= 4) {
                walls.push({
                    id: id,
                    x1: points[0],
                    y1: points[1],
                    x2: points[2],
                    y2: points[3],
                    thickness: shape.strokeWidth() || 4,
                    color: shape.stroke() || '#666666'
                });
            }
        });
        
        return walls;
    }

    /**
     * Office 추출
     * @returns {Object|null}
     */
    extractOffice() {
        let officeData = null;
        
        this.componentShapes.forEach((shape, id) => {
            if (shape.getAttr('componentType') === 'office') {
                officeData = {
                    id: id,
                    x: shape.x(),
                    y: shape.y(),
                    width: shape.width(),
                    height: shape.height(),
                    enabled: true
                };
            }
        });
        
        if (!officeData && this.currentLayout?.office) {
            return this.currentLayout.office;
        }
        
        return officeData;
    }

    /**
     * Components 추출
     * @returns {Array}
     */
    extractComponents() {
        const components = [];
        
        this.componentShapes.forEach((shape, id) => {
            const componentType = shape.getAttr('componentType');
            if (componentType === 'office') return;
            
            components.push({
                id: id,
                type: componentType || 'unknown',
                x: shape.x(),
                y: shape.y(),
                width: shape.width(),
                height: shape.height(),
                rotation: shape.rotation() || 0,
                color: shape.fill(),
                data: shape.getAttr('componentData') || {}
            });
        });
        
        return components;
    }

    /**
     * Equipment Array 데이터 가져오기
     * @returns {Array}
     */
    getEquipmentArrays() {
        const arrays = [];
        const arrayGroups = this.layers.equipment.find('.equipmentArray');
        
        arrayGroups.forEach(group => {
            const config = group.getAttr('arrayConfig');
            const position = group.position();
            
            arrays.push({
                id: group._id,
                position: position,
                config: config,
                equipmentCount: group.children.length
            });
        });

        return arrays;
    }

    /**
     * 전체 Equipment 개수
     * @returns {number}
     */
    getTotalEquipmentCount() {
        const allEquipment = this.layers.equipment.find('.equipment');
        return allEquipment.length;
    }

    /**
     * CSS 색상 다시 로드
     */
    reloadCSSColors() {
        this.loadCSSColors();
        
        if (this.renderer) {
            this.renderer.updateCssColors(this.cssColors);
        }
        
        console.log('[Canvas2DEditor] CSS 색상 다시 로드 완료');
        
        if (this.currentLayout) {
            this.loadLayout(this.currentLayout);
        }
    }

    /**
     * JSON으로부터 Layout 로드
     * @param {Object} layoutData - Layout JSON
     */
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
    // Fallback 렌더링 메서드 (하위 호환성)
    // =====================================================

    /**
     * Room 그리기 (Fallback)
     */
    drawRoom(room) {
        // 기존 코드와 동일 - 하위 호환성 유지
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const scale = this.config.scale;
        const roomDepth = room.depth || room.height || 20;

        const rect = new Konva.Rect({
            x: centerX - (room.width * scale) / 2,
            y: centerY - (roomDepth * scale) / 2,
            width: room.width * scale,
            height: roomDepth * scale,
            stroke: this.cssColors.roomStroke,
            strokeWidth: 2,
            dash: [10, 5],
            listening: false
        });

        this.layers.room.add(rect);

        const label = new Konva.Text({
            x: rect.x() + 10,
            y: rect.y() + 10,
            text: `Room: ${room.width}m x ${roomDepth}m`,
            fontSize: 14,
            fontFamily: 'Arial',
            fill: this.cssColors.textSecondary,
            listening: false
        });

        this.layers.room.add(label);
    }

    /**
     * Wall 그리기 (Fallback)
     */
    drawWall(wall) {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const scale = this.config.scale;

        let startX, startZ, endX, endZ;
        
        if (wall.start && wall.end) {
            startX = wall.start.x;
            startZ = wall.start.z;
            endX = wall.end.x;
            endZ = wall.end.z;
        } else {
            startX = wall.startX;
            startZ = wall.startZ;
            endX = wall.endX;
            endZ = wall.endZ;
        }

        const line = new Konva.Line({
            points: [
                centerX + startX * scale,
                centerY + startZ * scale,
                centerX + endX * scale,
                centerY + endZ * scale
            ],
            stroke: wall.color || this.cssColors.wallDefault,
            strokeWidth: wall.thickness * scale || 3,
            lineCap: 'square',
            lineJoin: 'miter',
            name: 'wall',
            id: wall.id,
            draggable: true
        });

        this.wallShapes.set(wall.id, line);
        this.layers.room.add(line);
    }

    /**
     * Office 그리기 (Fallback)
     */
    drawOffice(office) {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const scale = this.config.scale;

        let posX, posZ;
        
        if (office.position) {
            posX = office.position.x;
            posZ = office.position.z;
        } else {
            posX = office.positionX || 0;
            posZ = office.positionZ || 0;
        }

        const x = centerX + (posX - office.width / 2) * scale;
        const y = centerY + (posZ - office.depth / 2) * scale;
        const width = office.width * scale;
        const height = office.depth * scale;

        const group = new Konva.Group({
            x: x,
            y: y,
            name: 'office',
            id: 'office',
            draggable: true
        });

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: office.floorColor || office.color || this.cssColors.officeFill,
            stroke: this.cssColors.officeStroke,
            strokeWidth: 2,
            opacity: 0.5,
            name: 'officeRect'
        });

        const label = new Konva.Text({
            x: 5,
            y: 5,
            text: 'Office',
            fontSize: 12,
            fontFamily: 'Arial',
            fill: this.cssColors.textPrimary,
            listening: false
        });

        group.add(rect);
        group.add(label);
        this.layers.room.add(group);
    }

    /**
     * Partition 그리기 (Fallback)
     */
    drawPartition(partition) {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const scale = this.config.scale;

        let startX, startZ, endX, endZ;
        
        if (partition.start && partition.end) {
            startX = partition.start.x;
            startZ = partition.start.z;
            endX = partition.end.x;
            endZ = partition.end.z;
        } else {
            startX = partition.startX;
            startZ = partition.startZ;
            endX = partition.endX;
            endZ = partition.endZ;
        }

        const line = new Konva.Line({
            points: [
                centerX + startX * scale,
                centerY + startZ * scale,
                centerX + endX * scale,
                centerY + endZ * scale
            ],
            stroke: partition.color || this.cssColors.partition,
            strokeWidth: partition.thickness * scale || 1,
            opacity: partition.opacity || 0.5,
            lineCap: 'round',
            name: 'partition',
            id: partition.id,
            draggable: true
        });

        this.layers.room.add(line);
    }

    /**
     * Equipment Array 그리기 (Fallback)
     */
    drawEquipmentArray(array) {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const scale = this.config.scale;

        let startX, startZ;
        
        if (array.startPosition) {
            startX = array.startPosition.x;
            startZ = array.startPosition.z;
        } else {
            startX = array.startX || 0;
            startZ = array.startZ || 0;
        }

        const excludedSet = new Set();
        if (array.excludedPositions && Array.isArray(array.excludedPositions)) {
            array.excludedPositions.forEach(pos => {
                excludedSet.add(`${pos.row}-${pos.col}`);
            });
        }

        let currentX = startX;
        let currentZ = startZ;
        let equipmentCount = 0;

        for (let row = 0; row < array.rows; row++) {
            currentX = startX;

            for (let col = 0; col < array.cols; col++) {
                const posKey = `${row}-${col}`;
                if (excludedSet.has(posKey)) {
                    currentX += array.equipmentWidth + array.spacingX;
                    continue;
                }

                const equipmentId = `EQ-${String(row + 1).padStart(2, '0')}-${String(col + 1).padStart(2, '00')}`;
                
                const group = new Konva.Group({
                    x: centerX + currentX * scale,
                    y: centerY + currentZ * scale,
                    name: 'equipment',
                    id: equipmentId,
                    draggable: true
                });

                const equipment = new Konva.Rect({
                    x: 0,
                    y: 0,
                    width: array.equipmentWidth * scale,
                    height: array.equipmentDepth * scale,
                    fill: this.cssColors.equipmentDefault,
                    stroke: this.cssColors.equipmentStroke,
                    strokeWidth: 1,
                    cornerRadius: 2,
                    name: 'equipmentRect'
                });

                const label = new Konva.Text({
                    x: 2,
                    y: 2,
                    text: equipmentId,
                    fontSize: 8,
                    fontFamily: 'Arial',
                    fill: '#ffffff',
                    listening: false
                });

                group.add(equipment);
                group.add(label);

                this.equipmentShapes.set(equipmentId, group);
                this.layers.equipment.add(group);

                equipmentCount++;
                currentX += array.equipmentWidth + array.spacingX;

                if (array.corridorAfterCol && array.corridorAfterCol.includes(col + 1)) {
                    currentX += array.corridorWidthX || 0;
                }
            }

            currentZ += array.equipmentDepth + array.spacingZ;

            if (array.corridorAfterRow && array.corridorAfterRow.includes(row + 1)) {
                currentZ += array.corridorWidthZ || 0;
            }
        }

        console.log(`[Canvas2DEditor] EquipmentArray 렌더링: ${equipmentCount}개`);
    }

    /**
     * Single Equipment 그리기 (Fallback)
     */
    drawSingleEquipment(eq) {
        const scale = this.config.scale;

        const rect = new Konva.Rect({
            x: eq.x * scale,
            y: eq.y * scale,
            width: eq.width * scale,
            height: eq.depth * scale,
            fill: this.cssColors.equipmentDefault,
            stroke: this.cssColors.equipmentStroke,
            strokeWidth: 2,
            rotation: eq.rotation || 0,
            draggable: true,
            name: 'equipment',
            id: eq.id
        });

        const label = new Konva.Text({
            x: eq.x * scale,
            y: eq.y * scale + (eq.depth * scale / 2) - 8,
            text: eq.name || eq.id,
            fontSize: 12,
            fontFamily: 'Arial',
            fill: '#ffffff',
            align: 'center',
            width: eq.width * scale,
            listening: false
        });

        this.equipmentShapes.set(eq.id, rect);

        this.layers.equipment.add(rect);
        this.layers.equipment.add(label);
    }

    // Fallback Component 생성 메서드들
    createPartition(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;
        const height = data.depth * scale;
        const id = `partition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const partition = new Konva.Rect({
            id: id,
            x: x - width / 2,
            y: y - height / 2,
            width: width,
            height: height,
            fill: data.color || '#888888',
            stroke: '#666666',
            strokeWidth: 2,
            draggable: true,
            name: 'partition'
        });
        
        partition.setAttr('componentType', 'partition');
        partition.setAttr('componentData', data);
        partition.on('click tap', () => this.selectObject(partition, false));
        
        this.componentShapes.set(id, partition);
        this.layers.room.add(partition);
        this.layers.room.batchDraw();
        
        return partition;
    }

    createDesk(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;
        const height = data.depth * scale;
        const id = `desk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const desk = new Konva.Rect({
            id: id,
            x: x - width / 2,
            y: y - height / 2,
            width: width,
            height: height,
            fill: data.color || '#8B4513',
            stroke: '#654321',
            strokeWidth: 2,
            draggable: true,
            name: 'desk'
        });
        
        desk.setAttr('componentType', 'desk');
        desk.setAttr('componentData', data);
        desk.on('click tap', () => this.selectObject(desk, false));
        
        this.componentShapes.set(id, desk);
        this.layers.room.add(desk);
        this.layers.room.batchDraw();
        
        return desk;
    }

    createPillar(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;
        const height = data.depth * scale;
        const id = `pillar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const pillar = new Konva.Rect({
            id: id,
            x: x - width / 2,
            y: y - height / 2,
            width: width,
            height: height,
            fill: data.color || '#333333',
            stroke: '#000000',
            strokeWidth: 2,
            draggable: true,
            name: 'pillar'
        });
        
        pillar.setAttr('componentType', 'pillar');
        pillar.setAttr('componentData', data);
        pillar.on('click tap', () => this.selectObject(pillar, false));
        
        this.componentShapes.set(id, pillar);
        this.layers.room.add(pillar);
        this.layers.room.batchDraw();
        
        return pillar;
    }

    createOffice(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;
        const height = data.depth * scale;
        const id = `office-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const office = new Konva.Rect({
            id: id,
            x: x - width / 2,
            y: y - height / 2,
            width: width,
            height: height,
            fill: data.color || '#87CEEB',
            opacity: 0.5,
            stroke: '#3498db',
            strokeWidth: 3,
            draggable: true,
            name: 'office officeRect'
        });
        
        office.setAttr('componentType', 'office');
        office.setAttr('componentData', data);
        office.on('click tap', () => this.selectObject(office, false));
        
        this.componentShapes.set(id, office);
        this.layers.room.add(office);
        this.layers.room.batchDraw();
        
        return office;
    }

    createEquipment(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;
        const height = data.depth * scale;
        const equipmentId = `EQ-CUSTOM-${Date.now()}`;
        
        const equipment = new Konva.Rect({
            id: equipmentId,
            x: x - width / 2,
            y: y - height / 2,
            width: width,
            height: height,
            fill: data.color || '#FF8C00',
            stroke: '#CC6600',
            strokeWidth: 2,
            draggable: true,
            name: 'equipment equipmentRect'
        });
        
        equipment.setAttr('componentType', 'equipment');
        equipment.setAttr('componentData', data);
        equipment.on('click tap', () => this.selectObject(equipment, false));
        
        this.equipmentShapes.set(equipmentId, equipment);
        this.layers.equipment.add(equipment);
        this.layers.equipment.batchDraw();
        
        return equipment;
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined') {
    window.Canvas2DEditor = Canvas2DEditor;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Canvas2DEditor;
}