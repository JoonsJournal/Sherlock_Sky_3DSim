/**
 * Canvas2DEditor.js v4.1.0 (v4.0.2 기반)
 * ==============================================
 * 
 * ✨ v4.1.0 신규 기능 (Phase 3.2):
 * - ✅ highlightValidationErrors() - 검증 에러 하이라이트
 * - ✅ clearValidationHighlights() - 하이라이트 제거
 * - ✅ scrollToError() - 에러 위치로 스크롤
 * - ✅ selectErrorShape() - 에러 객체 선택
 * 
 * 📝 v4.0.2 기능 유지:
 * - ✅ ZoomController 통합 (setZoomController)
 * - ✅ 동적 Snap to Grid (Zoom 레벨에 따라 조정)
 * - ✅ 오른쪽 마우스 Pan 기능 (setupRightClickPan)
 * 
 * 📝 v3.2.9 기능 유지:
 * - ✅ macOS Escape 키 작동 (tabindex)
 * - ✅ Wall hover 문제 해결
 * - ✅ Box Selection (Shift + Drag)
 * - ✅ Multi-select (Ctrl + Click)
 * - ✅ 모든 기존 기능 100% 호환
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/components/Canvas2DEditor.js
 */

class Canvas2DEditor {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }

        // ✅ CSS 변수 로드 (try-catch로 안전 처리)
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

        this.stage = null;

        this.layers = {
            background: null,
            room: null,
            equipment: null,
            ui: null
        };

        this.backgroundLayer = null;
        this.roomLayer = null;
        this.equipmentLayer = null;
        this.uiLayer = null;

        this.currentLayout = null;

        this.equipmentShapes = new Map();
        this.wallShapes = new Map();
        this.componentShapes = new Map();  // ✨ Phase 2.6: ComponentPalette 객체용
        
        this.selectedObjects = [];
        this.transformer = null;

        // ✨ v4.0.2: ZoomController 참조
        this.zoomController = null;

        // ✨ Layout Editor: PropertyPanel 참조
        this.propertyPanel = null;

        // ✨ v4.1.0: 검증 하이라이트 저장
        this.validationHighlights = new Map();

        this.init();
    }

    /**
     * ✅ CSS 변수에서 색상 로드 (에러 처리 강화)
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
                
                // ✨ v4.1.0: 검증 에러 색상
                validationError: styles.getPropertyValue('--canvas-validation-error').trim() || '#e74c3c',
                validationWarning: styles.getPropertyValue('--canvas-validation-warning').trim() || '#f39c12'
            };
            
            document.body.removeChild(dummy);
            console.log('[Canvas2DEditor] CSS colors loaded:', this.cssColors);
            
        } catch (error) {
            console.warn('[Canvas2DEditor] CSS 색상 로드 실패, 기본값 사용:', error);
            this.cssColors = this.getDefaultColors();
        }
    }

    /**
     * ✅ 기본 색상 (CSS 로드 실패 시)
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
            // ✨ v4.1.0: 검증 에러 색상
            validationError: '#e74c3c',
            validationWarning: '#f39c12'
        };
    }

    init() {
        console.log('[Canvas2DEditor] Initializing v4.1.0...');
        
        this.stage = new Konva.Stage({
            container: this.containerId,
            width: this.config.width,
            height: this.config.height
        });

        // ✅ macOS에서 키보드 이벤트를 받기 위해 tabindex 추가
        const container = this.stage.container();
        container.tabIndex = 1;  // 포커스를 받을 수 있도록 설정
        container.style.outline = 'none';  // 포커스 아웃라인 제거
        console.log('[Canvas2DEditor] tabIndex set for keyboard focus (macOS fix)');

        // ✨ v4.0.2: 오른쪽 마우스 Pan 기능
        this.setupRightClickPan();

        this.createLayers();

        if (this.config.showGrid) {
            this.drawGrid();
        }

        this.setupEventListeners();

        console.log('[Canvas2DEditor] Initialized successfully v4.1.0');
    }

    /**
     * ✨ v4.0.2: 오른쪽 마우스 버튼으로 Pan 기능 설정
     */
    setupRightClickPan() {
        let isPanning = false;
        let lastPos = { x: 0, y: 0 };
        
        // 오른쪽 클릭 시작
        this.stage.on('mousedown', (e) => {
            // 오른쪽 마우스 버튼 (button: 2)
            if (e.evt.button === 2) {
                isPanning = true;
                lastPos = {
                    x: e.evt.clientX,
                    y: e.evt.clientY
                };
                this.stage.container().style.cursor = 'grabbing';
                e.evt.preventDefault();
            }
        });
        
        // 마우스 이동 중
        this.stage.on('mousemove', (e) => {
            if (!isPanning) return;
            
            const dx = e.evt.clientX - lastPos.x;
            const dy = e.evt.clientY - lastPos.y;
            
            const currentPos = this.stage.position();
            this.stage.position({
                x: currentPos.x + dx,
                y: currentPos.y + dy
            });
            
            lastPos = {
                x: e.evt.clientX,
                y: e.evt.clientY
            };
            
            e.evt.preventDefault();
        });
        
        // 마우스 버튼 놓음
        this.stage.on('mouseup', (e) => {
            if (e.evt.button === 2) {
                isPanning = false;
                this.stage.container().style.cursor = 'default';
                e.evt.preventDefault();
            }
        });
        
        // 캔버스 밖에서 버튼을 놓았을 때
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 && isPanning) {
                isPanning = false;
                this.stage.container().style.cursor = 'default';
            }
        });
        
        // 오른쪽 클릭 컨텍스트 메뉴 방지
        this.stage.container().addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        console.log('[Canvas2DEditor] Right-click pan enabled');
    }

    /**
     * ✨ v4.0.2: ZoomController 주입
     * @param {ZoomController} zoomController - ZoomController 인스턴스
     */
    setZoomController(zoomController) {
        this.zoomController = zoomController;
        console.log('[Canvas2DEditor] ZoomController set');
    }

    createLayers() {
        this.layers.background = new Konva.Layer({ listening: false });
        this.layers.room = new Konva.Layer();
        this.layers.equipment = new Konva.Layer();
        this.layers.ui = new Konva.Layer();

        this.backgroundLayer = this.layers.background;
        this.roomLayer = this.layers.room;
        this.equipmentLayer = this.layers.equipment;
        this.uiLayer = this.layers.ui;

        this.stage.add(this.layers.background);
        this.stage.add(this.layers.room);
        this.stage.add(this.layers.equipment);
        this.stage.add(this.layers.ui);

        console.log('[Canvas2DEditor] 4 Layers created');
    }

    drawGrid() {
        const width = this.config.width;
        const height = this.config.height;
        const gridSize = this.config.gridSize;
        const majorInterval = this.config.gridMajorInterval;

        const background = new Konva.Rect({
            x: 0, y: 0,
            width: width,
            height: height,
            fill: this.config.backgroundColor
        });
        this.layers.background.add(background);

        // 세로선
        for (let i = 0; i <= width; i += gridSize) {
            const isMajor = (i % (gridSize * majorInterval)) === 0;
            const line = new Konva.Line({
                points: [i, 0, i, height],
                stroke: isMajor ? this.config.gridMajorColor : this.config.gridColor,
                strokeWidth: isMajor ? 1 : 0.5
            });
            this.layers.background.add(line);

            if (isMajor && i > 0) {
                this.layers.background.add(new Konva.Text({
                    x: i - 15, y: 5,
                    text: `${i / this.config.scale}m`,
                    fontSize: 10,
                    fill: this.cssColors.gridLabel
                }));
            }
        }

        // 가로선
        for (let i = 0; i <= height; i += gridSize) {
            const isMajor = (i % (gridSize * majorInterval)) === 0;
            const line = new Konva.Line({
                points: [0, i, width, i],
                stroke: isMajor ? this.config.gridMajorColor : this.config.gridColor,
                strokeWidth: isMajor ? 1 : 0.5
            });
            this.layers.background.add(line);

            if (isMajor && i > 0) {
                this.layers.background.add(new Konva.Text({
                    x: 5, y: i - 15,
                    text: `${i / this.config.scale}m`,
                    fontSize: 10,
                    fill: this.cssColors.gridLabel
                }));
            }
        }

        this.layers.background.batchDraw();
        console.log('[Canvas2DEditor] Grid drawn');
    }

    loadLayout(layoutData) {
        console.log('[Canvas2DEditor] Loading layout:', layoutData);
        
        this.currentLayout = layoutData;

        this.layers.room.destroyChildren();
        this.layers.equipment.destroyChildren();
        this.layers.ui.destroyChildren();
        
        this.equipmentShapes.clear();
        this.wallShapes.clear();
        this.componentShapes.clear();  // ✨ Phase 2.6
        this.selectedObjects = [];

        if (layoutData.room) {
            this.drawRoom(layoutData.room);
            
            // ✨ v4.0.2: room 내부의 walls와 offices도 처리 (test_zoom_snap.html 호환)
            if (layoutData.room.walls && layoutData.room.walls.length > 0) {
                layoutData.room.walls.forEach(wall => this.drawWall(wall));
            }
            
            if (layoutData.room.offices && layoutData.room.offices.length > 0) {
                layoutData.room.offices.forEach(office => this.drawOffice(office));
            }
        }

        if (layoutData.walls && layoutData.walls.length > 0) {
            layoutData.walls.forEach(wall => this.drawWall(wall));
        }

        if (layoutData.office && layoutData.office.enabled) {
            this.drawOffice(layoutData.office);
        }

        if (layoutData.partitions && layoutData.partitions.length > 0) {
            layoutData.partitions.forEach(partition => this.drawPartition(partition));
        }

        if (layoutData.equipmentArrays && layoutData.equipmentArrays.length > 0) {
            layoutData.equipmentArrays.forEach(array => this.drawEquipmentArray(array));
        }

        // ✨ v4.0.2: 간단한 equipment 배열 지원 (test_zoom_snap.html 호환)
        if (layoutData.equipment && layoutData.equipment.length > 0) {
            layoutData.equipment.forEach(eq => this.drawSingleEquipment(eq));
        }

        this.layers.room.batchDraw();
        this.layers.equipment.batchDraw();

        console.log('[Canvas2DEditor] Layout loaded successfully');
    }

    drawRoom(room) {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const scale = this.config.scale;

        // ✨ v4.0.2: room.depth와 room.height 모두 지원
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
     * ✨ v4.0.2: 단일 Equipment 그리기 (test_zoom_snap.html 호환)
     * @param {Object} eq - Equipment 객체 { id, x, y, width, depth, name, rotation }
     */
    drawSingleEquipment(eq) {
        const scale = this.config.scale;

        // Equipment Rect 생성
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

        // Equipment 이름 Label 추가
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

        // Map에 저장
        this.equipmentShapes.set(eq.id, rect);

        // Layer에 추가
        this.layers.equipment.add(rect);
        this.layers.equipment.add(label);

        console.log(`[Canvas2DEditor] Equipment drawn: ${eq.id} at (${eq.x}, ${eq.y})`);
    }

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

        // ✅ Group으로 묶어서 rect와 label이 함께 움직이도록 수정
        const group = new Konva.Group({
            x: x,
            y: y,
            name: 'office',
            id: 'office',
            draggable: true
        });

        const rect = new Konva.Rect({
            x: 0,  // Group 기준 상대 좌표
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
            x: 5,  // Group 기준 상대 좌표
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

        console.log('[Canvas2DEditor] Office drawn as Group (rect + label together)');
    }

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

    drawEquipmentArray(array) {
        console.log('=== drawEquipmentArray 시작 ===');
        
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

                const equipmentId = `EQ-${String(row + 1).padStart(2, '0')}-${String(col + 1).padStart(2, '0')}`;
                
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

        console.log(`[Canvas2DEditor] Drew ${equipmentCount} equipment units`);
    }

    setupEventListeners() {
        this.stage.on('click tap', (e) => {
            // ✅ 박스 선택 중이면 무시
            if (this._isBoxSelecting) {
                console.log('🚫 박스 선택 중 - stage click 무시');
                return;
            }
            
            if (e.target === this.stage) {
                this.deselectAll();
            }
        });

        console.log('[Canvas2DEditor] Event listeners setup complete');
    }

    /**
     * ✅ 선택 (타입 안전 처리 + Line 객체 지원 + 디버깅)
     */
    selectObject(shape, multiSelect = false) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🟢 selectObject 호출됨!');
        console.log('  ├─ shape.id():', shape.id());
        console.log('  ├─ shape.name():', shape.name());
        console.log('  ├─ shape.className:', shape.className);
        console.log('  └─ multiSelect:', multiSelect);
        
        if (!multiSelect) {
            console.log('  ├─ multiSelect=false, deselectAll 호출...');
            this.deselectAll();
        }

        if (this.selectedObjects.includes(shape)) {
            console.log('  └─ 이미 선택된 객체, 종료');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
        }

        console.log('  ├─ selectedObjects에 추가...');
        this.selectedObjects.push(shape);
        console.log('  └─ 현재 선택된 객체 수:', this.selectedObjects.length);
        
        // ✅ Line 객체 (wall, partition) 처리
        if (shape.className === 'Line') {
            console.log('  ├─ Line 객체 감지! (wall/partition)');
            
            const currentStroke = shape.stroke();
            const currentStrokeWidth = shape.strokeWidth();
            
            console.log('  │   ├─ 현재 stroke:', currentStroke);
            console.log('  │   ├─ 현재 strokeWidth:', currentStrokeWidth);
            
            shape.setAttr('originalStroke', currentStroke);
            shape.setAttr('originalStrokeWidth', currentStrokeWidth);
            console.log('  │   ├─ originalStroke 저장:', currentStroke);
            console.log('  │   └─ originalStrokeWidth 저장:', currentStrokeWidth);
            
            const newStroke = this.cssColors.equipmentSelected;
            const newStrokeWidth = (currentStrokeWidth || 3) + 2;
            
            console.log('  │   ├─ 새 stroke 적용:', newStroke);
            console.log('  │   ├─ 새 strokeWidth 적용:', newStrokeWidth);
            
            shape.stroke(newStroke);
            shape.strokeWidth(newStrokeWidth);
            shape.dash([8, 4]);
            
            console.log('  │   └─ dash [8, 4] 적용 (점선)');
            console.log('  └─ ✅ Line 선택 완료!');
        } 
        // ✅ Group 또는 Rect 객체 처리
        else {
            console.log('  ├─ Group/Rect 객체 처리...');
            const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
            
            console.log('  │   └─ rect.id():', rect.id());
            
            if (rect.fill) {
                const currentFill = rect.fill();
                console.log('  │   ├─ 현재 fill:', currentFill);
                
                rect.setAttr('originalFill', currentFill);
                rect.fill(this.cssColors.equipmentSelected);
                rect.strokeWidth(3);
                
                console.log('  │   ├─ originalFill 저장:', currentFill);
                console.log('  │   ├─ 새 fill 적용:', this.cssColors.equipmentSelected);
                console.log('  │   └─ strokeWidth 3 적용');
            }
        }
        
        console.log('  ├─ updateTransformer 호출...');
        this.updateTransformer();
        console.log('  └─ updateTransformer 완료');

        // ✨ Layout Editor: PropertyPanel 업데이트
        this.updatePropertyPanel();

        console.log('✅ Selected:', shape.id(), 'Total:', this.selectedObjects.length);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    /**
     * ✅ 선택 해제 (타입 안전 처리)
     */
    deselectObject(shape) {
        const index = this.selectedObjects.indexOf(shape);
        if (index > -1) {
            this.selectedObjects.splice(index, 1);
            
            // ✅ Line 객체 (wall, partition) 복원
            if (shape.className === 'Line') {
                const originalStroke = shape.getAttr('originalStroke');
                const originalStrokeWidth = shape.getAttr('originalStrokeWidth');
                
                if (originalStroke) {
                    shape.stroke(originalStroke);
                }
                if (originalStrokeWidth) {
                    shape.strokeWidth(originalStrokeWidth);
                }
                shape.dash([]);  // 점선 제거 (실선으로 복원)
                console.log('Deselected Line (wall/partition):', shape.id());
            }
            // ✅ Group 또는 Rect 객체 복원
            else {
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
     * ✅ 전체 선택 해제 (타입 안전 처리 + Line 객체 지원 + 디버깅)
     */
    deselectAll() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔵 deselectAll 호출됨!');
        console.log('  └─ 선택된 객체 수:', this.selectedObjects.length);
        
        if (this.selectedObjects.length === 0) {
            console.log('  └─ 선택된 객체가 없음, 종료');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
        }
        
        this.selectedObjects.forEach((shape, index) => {
            console.log(`  ├─ [${index + 1}/${this.selectedObjects.length}] 처리 중...`);
            console.log(`  │   ├─ shape.id(): ${shape.id()}`);
            console.log(`  │   ├─ shape.className: ${shape.className}`);
            
            // ✅ Line 객체 (wall, partition) 복원
            if (shape.className === 'Line') {
                console.log(`  │   └─ Line 객체 복원 시작...`);
                const originalStroke = shape.getAttr('originalStroke');
                const originalStrokeWidth = shape.getAttr('originalStrokeWidth');
                
                console.log(`  │       ├─ originalStroke: ${originalStroke}`);
                console.log(`  │       └─ originalStrokeWidth: ${originalStrokeWidth}`);
                
                if (originalStroke) {
                    shape.stroke(originalStroke);
                    console.log(`  │       └─ stroke 복원됨: ${originalStroke}`);
                }
                if (originalStrokeWidth) {
                    shape.strokeWidth(originalStrokeWidth);
                    console.log(`  │       └─ strokeWidth 복원됨: ${originalStrokeWidth}`);
                }
                shape.dash([]);
                console.log(`  │       └─ dash 제거됨 (실선 복원)`);
            }
            // ✅ Group 또는 Rect 객체 복원
            else {
                console.log(`  │   └─ Group/Rect 객체 복원 시작...`);
                const rect = (shape.findOne && shape.findOne('.equipmentRect, .officeRect')) || shape;
                const originalFill = rect.getAttr('originalFill');
                
                console.log(`  │       ├─ rect found: ${rect.id()}`);
                console.log(`  │       └─ originalFill: ${originalFill}`);
                
                if (originalFill) {
                    rect.fill(originalFill);
                    rect.strokeWidth(1);
                    console.log(`  │       └─ fill 복원됨: ${originalFill}`);
                }
            }
        });
        
        console.log('  ├─ selectedObjects 배열 초기화...');
        this.selectedObjects = [];
        console.log('  └─ selectedObjects.length:', this.selectedObjects.length);
        
        if (this.transformer) {
            console.log('  ├─ Transformer 제거...');
            this.transformer.destroy();
            this.transformer = null;
            console.log('  └─ Transformer 제거 완료');
        }
        
        console.log('  ├─ layers.ui.batchDraw() 호출...');
        this.layers.ui.batchDraw();
        console.log('  └─ batchDraw 완료');
        
        // ✨ Layout Editor: PropertyPanel 업데이트
        this.updatePropertyPanel();
        
        console.log('✅ Deselected all - 완료!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    updateTransformer() {
        if (this.transformer) {
            this.transformer.destroy();
        }

        if (this.selectedObjects.length === 0) {
            this.layers.ui.batchDraw();
            return;
        }

        this.transformer = new Konva.Transformer({
            nodes: this.selectedObjects,
            rotateEnabled: false,
            keepRatio: false,
            enabledAnchors: [
                'top-left',
                'top-center',
                'top-right',
                'middle-right',
                'middle-left',
                'bottom-left',
                'bottom-center',
                'bottom-right'
            ],
            borderStroke: this.cssColors.transformerBorder,
            borderStrokeWidth: 2,
            anchorStroke: this.cssColors.transformerAnchorStroke,
            anchorFill: this.cssColors.transformerAnchorFill,
            anchorSize: 10
        });

        this.layers.ui.add(this.transformer);
        this.layers.ui.batchDraw();
    }

    /**
     * ✨ v4.0.2: 동적 Snap to Grid (Zoom 레벨 고려)
     * Grid에 맞춰 Shape 위치 조정
     * @param {Konva.Shape} shape - 정렬할 Shape
     */
    snapToGrid(shape) {
        if (!this.config.snapToGrid) {
            return;
        }

        // ✨ v4.0.2: ZoomController가 있으면 동적 gridSize 사용
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

    toggleGrid() {
        this.config.showGrid = !this.config.showGrid;
        this.layers.background.visible(this.config.showGrid);
        this.layers.background.batchDraw();
        console.log('Grid:', this.config.showGrid ? 'ON' : 'OFF');
    }

    toggleSnapToGrid() {
        this.config.snapToGrid = !this.config.snapToGrid;
        console.log('Snap to Grid:', this.config.snapToGrid);
        return this.config.snapToGrid;
    }

    deleteSelected() {
        this.selectedObjects.forEach(shape => {
            const id = shape.id();
            
            // ✨ Phase 2.6: 각 Map에서 삭제 시도
            if (shape.name() === 'equipment') {
                this.equipmentShapes.delete(id);
            } else if (shape.name() === 'wall') {
                this.wallShapes.delete(id);
            } else {
                // ComponentPalette로 생성된 객체들
                this.componentShapes.delete(id);
            }
            
            shape.destroy();
        });

        this.deselectAll();
        this.stage.batchDraw();
        console.log('Deleted selected objects');
    }

    clear() {
        this.layers.room.destroyChildren();
        this.layers.equipment.destroyChildren();
        this.layers.ui.destroyChildren();
        
        this.layers.room.batchDraw();
        this.layers.equipment.batchDraw();
        this.layers.ui.batchDraw();
        
        this.equipmentShapes.clear();
        this.wallShapes.clear();
        this.componentShapes.clear();  // ✨ Phase 2.6
        this.selectedObjects = [];
        
        this.currentLayout = null;
        
        console.log('[Canvas2DEditor] Cleared');
    }

    destroy() {
        if (this.stage) {
            this.stage.destroy();
            this.stage = null;
        }
        
        console.log('[Canvas2DEditor] Destroyed');
    }

    getCurrentLayout() {
        return this.currentLayout;
    }

    resize(width, height) {
        this.stage.width(width);
        this.stage.height(height);
        this.config.width = width;
        this.config.height = height;

        this.layers.background.destroyChildren();
        if (this.config.showGrid) {
            this.drawGrid();
        }

        console.log(`[Canvas2DEditor] Resized to ${width}x${height}`);
    }
    
    reloadCSSColors() {
        this.loadCSSColors();
        console.log('[Canvas2DEditor] CSS colors reloaded');
        
        if (this.currentLayout) {
            this.loadLayout(this.currentLayout);
        }
    }

    // =====================================================
    // ✨ Layout Editor 확장 메서드들
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
     * Room 데이터 업데이트 (RoomSizeManager 통합용)
     * @param {Object} roomData - Room 데이터 {width, depth, wallHeight}
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

    /**
     * Wall 추가 (WallDrawTool 통합용)
     * @param {Konva.Line} wall - 생성된 벽 객체
     */
    addWall(wall) {
        const wallId = wall.id();
        this.wallShapes.set(wallId, wall);
        
        if (!this.currentLayout) {
            this.currentLayout = { walls: [] };
        }
        if (!this.currentLayout.walls) {
            this.currentLayout.walls = [];
        }
        
        console.log('[Canvas2DEditor] Wall 추가:', wallId);
    }

    /**
     * 객체 개수 가져오기
     * @returns {Object} {walls, equipments, total}
     */
    getObjectCount() {
        return {
            walls: this.wallShapes.size,
            equipments: this.equipmentShapes.size,
            components: this.componentShapes.size,  // ✨ Phase 2.6
            total: this.wallShapes.size + this.equipmentShapes.size + this.componentShapes.size
        };
    }

    /**
     * 다중 선택 (Ctrl+Click 지원)
     * @param {Konva.Shape} shape - 추가 선택할 객체
     */
    selectMultiple(shape) {
        if (!this.selectedObjects.includes(shape)) {
            console.log('[Canvas2DEditor] 다중 선택 추가:', shape.id());
            
            this.selectedObjects.push(shape);
            
            // 선택 표시 (Line 객체)
            if (shape.className === 'Line') {
                const currentStroke = shape.stroke();
                const currentStrokeWidth = shape.strokeWidth();
                
                shape.setAttr('originalStroke', currentStroke);
                shape.setAttr('originalStrokeWidth', currentStrokeWidth);
                
                shape.stroke(this.cssColors.equipmentSelected);
                shape.strokeWidth((currentStrokeWidth || 3) + 2);
                shape.dash([8, 4]);
            } 
            // 선택 표시 (Group/Rect 객체)
            else {
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
     * selectShape 별칭 (하위 호환성)
     * WallDrawTool과 RoomSizeManager에서 호출
     */
    selectShape(shape) {
        this.selectObject(shape, false);
    }

    // =====================================================
    // ✨ v1.1.0: EquipmentArrayTool 통합 메서드들
    // =====================================================

    /**
     * ✨ v1.1.0: EquipmentArrayTool 초기화
     * @param {EquipmentArrayTool} equipmentArrayTool - EquipmentArrayTool 인스턴스
     */
    initEquipmentArrayTool(equipmentArrayTool) {
        this.equipmentArrayTool = equipmentArrayTool;
        console.log('[Canvas2DEditor] EquipmentArrayTool 초기화 완료');
    }

    /**
     * ✨ v1.1.0: EquipmentArrayTool 활성화
     * @param {Object} config - 배열 설정
     */
    activateEquipmentArrayTool(config) {
        if (!this.equipmentArrayTool) {
            console.error('[Canvas2DEditor] EquipmentArrayTool이 초기화되지 않았습니다');
            return;
        }

        // 다른 도구 비활성화
        this.deactivateAllTools();

        // EquipmentArrayTool 활성화
        this.equipmentArrayTool.activate(config);
        
        console.log('[Canvas2DEditor] EquipmentArrayTool 활성화');
    }

    /**
     * ✨ v1.1.0: 모든 도구 비활성화 (기존 메서드 확장)
     */
    deactivateAllTools() {
        // EquipmentArrayTool 비활성화
        if (this.equipmentArrayTool && this.equipmentArrayTool.isToolActive()) {
            this.equipmentArrayTool.deactivate();
        }

        // 기존 도구 비활성화 로직 (WallDrawTool 등)
        // 이 부분은 기존 코드에 있다면 유지, 없다면 추가
        
        console.log('[Canvas2DEditor] 모든 도구 비활성화');
    }

    /**
     * ✨ v1.1.0: Equipment Array 데이터 가져오기
     * @returns {Array} Equipment Array 목록
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
     * ✨ v1.1.0: 전체 Equipment 개수 가져오기 (배열 + 개별)
     * @returns {number}
     */
    getTotalEquipmentCount() {
        const allEquipment = this.layers.equipment.find('.equipment');
        return allEquipment.length;
    }

    // =====================================================
    // ✨ Phase 2.6: ComponentPalette 통합 메서드들
    // =====================================================

    /**
     * ✨ Phase 2.6: Canvas를 Drop Zone으로 설정
     */
    enableDropZone() {
        const container = this.stage.container();
        
        // dragover 이벤트: Drop을 허용하기 위해 preventDefault
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            container.classList.add('drag-over');
        });
        
        // dragleave 이벤트: 시각적 피드백 제거
        container.addEventListener('dragleave', (e) => {
            container.classList.remove('drag-over');
        });
        
        // drop 이벤트: 실제 객체 생성
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            this.handleDrop(e);
        });
        
        // Drop Zone 클래스 추가 (CSS용)
        container.classList.add('canvas-drop-zone');
        
        console.log('[Canvas2DEditor] Drop Zone 활성화');
    }

    /**
     * ✨ Phase 2.6: Drop 이벤트 처리
     * @param {DragEvent} event - Drop 이벤트
     */
    handleDrop(event) {
        try {
            // 드래그 데이터 가져오기
            const data = event.dataTransfer.getData('text/plain');
            if (!data) {
                console.warn('[Canvas2DEditor] Drop 데이터가 없습니다');
                return;
            }
            
            const component = JSON.parse(data);
            console.log('[Canvas2DEditor] Drop 감지:', component.name);
            
            // Canvas 좌표 계산
            const rect = this.stage.container().getBoundingClientRect();
            const stagePos = this.stage.position();
            const scale = this.stage.scaleX();
            
            const x = (event.clientX - rect.left - stagePos.x) / scale;
            const y = (event.clientY - rect.top - stagePos.y) / scale;
            
            console.log('[Canvas2DEditor] Drop 위치:', { x, y });
            
            // 컴포넌트 타입에 따라 객체 생성
            this.createComponentFromType(component.id, x, y, component);
            
        } catch (error) {
            console.error('[Canvas2DEditor] Drop 처리 중 오류:', error);
        }
    }

    /**
     * ✨ Phase 2.6: 타입별 컴포넌트 생성
     * @param {string} type - 컴포넌트 타입
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} componentData - 컴포넌트 데이터
     */
    createComponentFromType(type, x, y, componentData) {
        let shape = null;
        
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
        
        if (shape) {
            // 자동 선택
            this.selectObject(shape, false);
            console.log('[Canvas2DEditor] 컴포넌트 생성 완료:', type);
        }
    }

    /**
     * ✨ Phase 2.6: Partition 생성 (3×2.5m)
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @returns {Konva.Rect}
     */
    createPartition(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;   // 30px
        const height = data.depth * scale;  // 25px
        
        // 고유 ID 생성
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
        
        // ✅ 클릭 이벤트 추가
        partition.on('click tap', () => {
            this.selectObject(partition, false);
        });
        
        // Snap to Grid
        if (this.config.snapToGrid) {
            this.snapShapeToGrid(partition);
        }
        
        // ✅ Map에 추가 (카운트를 위해)
        this.componentShapes.set(id, partition);
        
        this.layers.room.add(partition);
        this.layers.room.batchDraw();
        
        return partition;
    }

    /**
     * ✨ Phase 2.6: Desk 생성 (1.6×0.8m)
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @returns {Konva.Rect}
     */
    createDesk(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;   // 16px
        const height = data.depth * scale;  // 8px
        
        // 고유 ID 생성
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
        
        // ✅ 클릭 이벤트 추가
        desk.on('click tap', () => {
            this.selectObject(desk, false);
        });
        
        // Snap to Grid
        if (this.config.snapToGrid) {
            this.snapShapeToGrid(desk);
        }
        
        // ✅ Map에 추가 (카운트를 위해)
        this.componentShapes.set(id, desk);
        
        this.layers.room.add(desk);
        this.layers.room.batchDraw();
        
        return desk;
    }

    /**
     * ✨ Phase 2.6: Pillar 생성 (0.3×0.3m)
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @returns {Konva.Rect}
     */
    createPillar(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;   // 3px
        const height = data.depth * scale;  // 3px
        
        // 고유 ID 생성
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
        
        // ✅ 클릭 이벤트 추가
        pillar.on('click tap', () => {
            this.selectObject(pillar, false);
        });
        
        // Snap to Grid
        if (this.config.snapToGrid) {
            this.snapShapeToGrid(pillar);
        }
        
        // ✅ Map에 추가 (카운트를 위해)
        this.componentShapes.set(id, pillar);
        
        this.layers.room.add(pillar);
        this.layers.room.batchDraw();
        
        return pillar;
    }

    /**
     * ✨ Phase 2.6: Office 생성 (12×20m)
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @returns {Konva.Rect}
     */
    createOffice(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;   // 120px
        const height = data.depth * scale;  // 200px
        
        // 고유 ID 생성
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
        
        // ✅ 클릭 이벤트 추가
        office.on('click tap', () => {
            this.selectObject(office, false);
        });
        
        // Snap to Grid
        if (this.config.snapToGrid) {
            this.snapShapeToGrid(office);
        }
        
        // ✅ Map에 추가 (카운트를 위해)
        this.componentShapes.set(id, office);
        
        this.layers.room.add(office);
        this.layers.room.batchDraw();
        
        return office;
    }

    /**
     * ✨ Phase 2.6: Equipment 생성 (1.5×3.0m)
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @returns {Konva.Rect}
     */
    createEquipment(x, y, data) {
        const scale = this.config.scale;
        const width = data.width * scale;   // 15px
        const height = data.depth * scale;  // 30px
        
        // Equipment ID 생성
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
        
        // ✅ 클릭 이벤트 추가
        equipment.on('click tap', () => {
            this.selectObject(equipment, false);
        });
        
        // Snap to Grid
        if (this.config.snapToGrid) {
            this.snapShapeToGrid(equipment);
        }
        
        // ✅ Map에 추가
        this.equipmentShapes.set(equipmentId, equipment);
        
        this.layers.equipment.add(equipment);
        this.layers.equipment.batchDraw();
        
        return equipment;
    }

    /**
     * ✨ Phase 2.6: Shape를 Grid에 정렬
     * @param {Konva.Shape} shape - 정렬할 Shape
     */
    snapShapeToGrid(shape) {
        const gridSize = this.config.gridSize;
        const pos = shape.position();
        
        const snappedX = Math.round(pos.x / gridSize) * gridSize;
        const snappedY = Math.round(pos.y / gridSize) * gridSize;
        
        shape.position({ x: snappedX, y: snappedY });
    }

    /**
     * ✨ Phase 3.1: 직렬화 가능한 데이터 반환
     * LayoutSerializer가 사용할 수 있는 형태로 데이터 제공
     * 
     * @returns {Object} 직렬화 가능한 데이터
     */
    getSerializableData() {
        console.log('[Canvas2DEditor] Getting serializable data...');
        
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
     * ✨ Phase 3.1: JSON 데이터로부터 Layout 로드
     * @param {Object} layoutData - Layout JSON
     */
    loadFromJSON(layoutData) {
        console.log('[Canvas2DEditor] Loading from JSON...', layoutData);
        
        // LayoutSerializer.deserialize() 호출
        const serializer = window.layoutSerializer || new LayoutSerializer();
        serializer.deserialize(layoutData, this);
        
        console.log('[Canvas2DEditor] Layout loaded from JSON');
    }

    // =====================================================
    // ✨ v4.1.0 Phase 3.2: 검증 하이라이트 메서드들 (NEW)
    // =====================================================

    /**
     * ✨ v4.1.0: 검증 에러 하이라이트 표시
     * @param {Array} errors - 에러 배열
     */
    highlightValidationErrors(errors) {
        console.log('[Canvas2DEditor] 🔴 Highlighting validation errors:', errors.length);
        
        // 기존 하이라이트 제거
        this.clearValidationHighlights();
        
        errors.forEach(error => {
            if (!error) return;
            
            // 에러 심각도에 따른 색상
            const color = error.severity === 'error' 
                ? this.cssColors.validationError 
                : this.cssColors.validationWarning;
            
            // 1. Equipment ID로 하이라이트
            if (error.equipmentId) {
                this.highlightShapeById(error.equipmentId, color, 'equipment');
            }
            
            // 2. Equipment ID1, ID2 (충돌)
            if (error.equipmentId1) {
                this.highlightShapeById(error.equipmentId1, color, 'equipment');
            }
            if (error.equipmentId2) {
                this.highlightShapeById(error.equipmentId2, color, 'equipment');
            }
            
            // 3. Wall ID로 하이라이트
            if (error.wallId) {
                this.highlightShapeById(error.wallId, color, 'wall');
            }
            
            // 4. 위치 기반 하이라이트 (position이 있고 ID가 없는 경우)
            if (error.position && !error.equipmentId && !error.wallId) {
                this.highlightPosition(error.position, color, error.id);
            }
        });
        
        // 레이어 다시 그리기
        this.layers.equipment.batchDraw();
        this.layers.room.batchDraw();
        this.layers.ui.batchDraw();
        
        console.log('[Canvas2DEditor] Validation highlights applied');
    }

    /**
     * ✨ v4.1.0: ID로 Shape 하이라이트
     * @param {string} id - Shape ID
     * @param {string} color - 하이라이트 색상
     * @param {string} type - 'equipment' | 'wall' | 'component'
     */
    highlightShapeById(id, color, type) {
        let shape = null;
        
        if (type === 'equipment') {
            shape = this.equipmentShapes.get(id);
        } else if (type === 'wall') {
            shape = this.wallShapes.get(id);
        } else {
            shape = this.componentShapes.get(id);
        }
        
        if (!shape) {
            console.warn(`[Canvas2DEditor] Shape not found for highlight: ${id}`);
            return;
        }
        
        // Group인 경우 내부 Rect 찾기
        let targetShape = shape;
        if (shape.findOne) {
            const rect = shape.findOne('.equipmentRect, .officeRect');
            if (rect) {
                targetShape = rect;
            }
        }
        
        // 원래 스타일 저장
        const originalStroke = targetShape.stroke();
        const originalStrokeWidth = targetShape.strokeWidth();
        const originalShadowColor = targetShape.shadowColor();
        const originalShadowBlur = targetShape.shadowBlur();
        
        this.validationHighlights.set(id, {
            shape: targetShape,
            originalStroke: originalStroke,
            originalStrokeWidth: originalStrokeWidth,
            originalShadowColor: originalShadowColor,
            originalShadowBlur: originalShadowBlur
        });
        
        // 하이라이트 스타일 적용
        targetShape.stroke(color);
        targetShape.strokeWidth(4);
        targetShape.shadowColor(color);
        targetShape.shadowBlur(10);
        targetShape.shadowOpacity(0.5);
        
        console.log(`[Canvas2DEditor] Highlighted: ${id} with color ${color}`);
    }

    /**
     * ✨ v4.1.0: 위치 기반 하이라이트 (마커 생성)
     * @param {Object} position - { x, y }
     * @param {string} color - 하이라이트 색상
     * @param {string} errorId - 에러 ID
     */
    highlightPosition(position, color, errorId) {
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        // position이 미터 단위인 경우 픽셀로 변환
        const x = centerX + (position.x || 0) * scale;
        const y = centerY + (position.y || position.z || 0) * scale;
        
        // 에러 마커 생성 (원형)
        const marker = new Konva.Circle({
            id: `validation-marker-${errorId}`,
            x: x,
            y: y,
            radius: 15,
            stroke: color,
            strokeWidth: 3,
            fill: 'transparent',
            dash: [5, 5],
            name: 'validation-marker'
        });
        
        // 펄스 애니메이션
        const anim = new Konva.Animation((frame) => {
            const scaleVal = 1 + Math.sin(frame.time * 0.005) * 0.2;
            marker.scale({ x: scaleVal, y: scaleVal });
        }, this.layers.ui);
        
        anim.start();
        
        this.validationHighlights.set(`marker-${errorId}`, {
            shape: marker,
            animation: anim
        });
        
        this.layers.ui.add(marker);
        
        console.log(`[Canvas2DEditor] Position marker created at (${x}, ${y})`);
    }

    /**
     * ✨ v4.1.0: 모든 검증 하이라이트 제거
     */
    clearValidationHighlights() {
        console.log('[Canvas2DEditor] Clearing validation highlights...');
        
        this.validationHighlights.forEach((highlight, id) => {
            if (highlight.animation) {
                highlight.animation.stop();
            }
            
            if (highlight.shape) {
                // 마커인 경우 삭제
                if (id.startsWith('marker-')) {
                    highlight.shape.destroy();
                } else {
                    // 원래 스타일 복원
                    highlight.shape.stroke(highlight.originalStroke);
                    highlight.shape.strokeWidth(highlight.originalStrokeWidth);
                    highlight.shape.shadowColor(highlight.originalShadowColor || 'transparent');
                    highlight.shape.shadowBlur(highlight.originalShadowBlur || 0);
                    highlight.shape.shadowOpacity(0);
                }
            }
        });
        
        this.validationHighlights.clear();
        
        // 레이어 다시 그리기
        this.layers.equipment.batchDraw();
        this.layers.room.batchDraw();
        this.layers.ui.batchDraw();
        
        console.log('[Canvas2DEditor] Validation highlights cleared');
    }

    /**
     * ✨ v4.1.0: 특정 에러 위치로 스크롤/이동
     * @param {Object} error - 에러 객체
     */
    scrollToError(error) {
        if (!error) return;
        
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        let targetX, targetY;
        
        // 1. 설비 ID로 위치 찾기
        if (error.equipmentId) {
            const shape = this.equipmentShapes.get(error.equipmentId);
            if (shape) {
                if (shape.findOne) {
                    // Group인 경우
                    targetX = shape.x();
                    targetY = shape.y();
                } else {
                    targetX = shape.x() + shape.width() / 2;
                    targetY = shape.y() + shape.height() / 2;
                }
            }
        }
        
        // 2. 벽 ID로 위치 찾기
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
        
        // 3. position 객체 사용 (미터 → 픽셀 변환)
        if (error.position && targetX === undefined) {
            targetX = centerX + (error.position.x || 0) * scale;
            targetY = centerY + (error.position.y || error.position.z || 0) * scale;
        }
        
        if (targetX !== undefined && targetY !== undefined) {
            // Stage 중앙으로 이동
            const stageWidth = this.stage.width();
            const stageHeight = this.stage.height();
            
            const newX = stageWidth / 2 - targetX;
            const newY = stageHeight / 2 - targetY;
            
            // 부드러운 애니메이션
            new Konva.Tween({
                node: this.stage,
                duration: 0.5,
                x: newX,
                y: newY,
                easing: Konva.Easings.EaseInOut
            }).play();
            
            console.log(`[Canvas2DEditor] Scrolling to error at (${targetX}, ${targetY})`);
        }
    }

    /**
     * ✨ v4.1.0: 특정 에러의 Shape 선택
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
            console.log('[Canvas2DEditor] Error shape selected:', shape.id());
        }
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