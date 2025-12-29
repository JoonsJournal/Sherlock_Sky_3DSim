/**
 * Canvas2DEditor.js v4.0.2 (3.2.9 기반)
 * ==============================================
 * 
 * ✨ v4.0.2 신규 기능:
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
        
        this.selectedObjects = [];
        this.transformer = null;

        // ✨ v4.0.2: ZoomController 참조
        this.zoomController = null;

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
                textSecondary: styles.getPropertyValue('--canvas-text-secondary').trim() || '#6c757d'
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
            textSecondary: '#6c757d'
        };
    }

    init() {
        console.log('[Canvas2DEditor] Initializing...');
        
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

        console.log('[Canvas2DEditor] Initialized successfully');
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
            
            if (shape.name() === 'equipment') {
                this.equipmentShapes.delete(id);
            } else if (shape.name() === 'wall') {
                this.wallShapes.delete(id);
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
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Canvas2DEditor;
}