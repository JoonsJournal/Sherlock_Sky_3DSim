/**
 * CanvasRenderer.js
 * ==================
 * 
 * Canvas2DEditor에서 분리된 렌더링 모듈
 * 모든 시각적 요소의 렌더링을 담당
 * 
 * @version 1.0.0 - Phase 1.5
 * @module CanvasRenderer
 * 
 * 역할:
 * 1. Grid 렌더링
 * 2. Room, Wall, Office, Partition 렌더링
 * 3. Equipment, EquipmentArray 렌더링
 * 4. 검증 하이라이트 렌더링
 * 5. Component (Desk, Pillar 등) 렌더링
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/canvas/CanvasRenderer.js
 */

class CanvasRenderer {
    /**
     * @param {LayerManager} layerManager - LayerManager 인스턴스
     * @param {Object} config - 캔버스 설정
     * @param {Object} cssColors - CSS 색상 객체
     */
    constructor(layerManager, config, cssColors) {
        if (!layerManager) {
            throw new Error('[CanvasRenderer] LayerManager 인스턴스가 필요합니다');
        }
        
        this.layerManager = layerManager;
        this.config = config;
        this.cssColors = cssColors;
        
        // 검증 하이라이트 저장소
        this.validationHighlights = new Map();
        
        console.log('[CanvasRenderer] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // Grid 렌더링
    // =====================================================
    
    /**
     * 그리드 그리기
     */
    drawGrid() {
        const layer = this.layerManager.getLayer('background');
        if (!layer) return;
        
        const width = this.config.width;
        const height = this.config.height;
        const gridSize = this.config.gridSize;
        const majorInterval = this.config.gridMajorInterval;
        
        // 배경 사각형
        const background = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: this.config.backgroundColor
        });
        layer.add(background);
        
        // 세로선
        for (let i = 0; i <= width; i += gridSize) {
            const isMajor = (i % (gridSize * majorInterval)) === 0;
            const line = new Konva.Line({
                points: [i, 0, i, height],
                stroke: isMajor ? this.config.gridMajorColor : this.config.gridColor,
                strokeWidth: isMajor ? 1 : 0.5
            });
            layer.add(line);
            
            // Major 라인에 라벨 추가
            if (isMajor && i > 0) {
                layer.add(new Konva.Text({
                    x: i - 15,
                    y: 5,
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
            layer.add(line);
            
            // Major 라인에 라벨 추가
            if (isMajor && i > 0) {
                layer.add(new Konva.Text({
                    x: 5,
                    y: i - 15,
                    text: `${i / this.config.scale}m`,
                    fontSize: 10,
                    fill: this.cssColors.gridLabel
                }));
            }
        }
        
        layer.batchDraw();
        console.log('[CanvasRenderer] Grid 렌더링 완료');
    }
    
    /**
     * 그리드 다시 그리기
     */
    redrawGrid() {
        const layer = this.layerManager.getLayer('background');
        if (layer) {
            layer.destroyChildren();
            this.drawGrid();
        }
    }
    
    // =====================================================
    // Room 렌더링
    // =====================================================
    
    /**
     * Room 경계 그리기
     * @param {Object} room - Room 데이터 { width, depth/height, wallHeight }
     */
    drawRoom(room) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return;
        
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const scale = this.config.scale;
        
        // room.depth와 room.height 모두 지원
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
        
        layer.add(rect);
        
        // Room 라벨
        const label = new Konva.Text({
            x: rect.x() + 10,
            y: rect.y() + 10,
            text: `Room: ${room.width}m x ${roomDepth}m`,
            fontSize: 14,
            fontFamily: 'Arial',
            fill: this.cssColors.textSecondary,
            listening: false
        });
        
        layer.add(label);
        
        console.log('[CanvasRenderer] Room 렌더링 완료');
    }
    
    /**
     * Wall 그리기
     * @param {Object} wall - Wall 데이터
     * @param {Function} onClickCallback - 클릭 콜백
     */
    drawWall(wall, onClickCallback = null) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return null;
        
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
        
        // Map에 저장
        this.layerManager.addWall(wall.id, line);
        
        // 레이어에 추가
        layer.add(line);
        
        // 클릭 이벤트 (외부에서 처리)
        if (onClickCallback) {
            line.on('click tap', (e) => {
                e.cancelBubble = true;
                onClickCallback(line, e);
            });
        }
        
        return line;
    }
    
    /**
     * Office 그리기
     * @param {Object} office - Office 데이터
     * @param {Function} onClickCallback - 클릭 콜백
     */
    drawOffice(office, onClickCallback = null) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return null;
        
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
        
        // Group으로 rect와 label 묶기
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
        layer.add(group);
        
        // 클릭 이벤트
        if (onClickCallback) {
            group.on('click tap', (e) => {
                e.cancelBubble = true;
                onClickCallback(group, e);
            });
        }
        
        console.log('[CanvasRenderer] Office 렌더링 완료');
        return group;
    }
    
    /**
     * Partition 그리기
     * @param {Object} partition - Partition 데이터
     */
    drawPartition(partition) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return null;
        
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
        
        layer.add(line);
        return line;
    }
    
    // =====================================================
    // Equipment 렌더링
    // =====================================================
    
    /**
     * 단일 Equipment 그리기
     * @param {Object} eq - Equipment 데이터 { id, x, y, width, depth, name, rotation }
     * @param {Function} onClickCallback - 클릭 콜백
     */
    drawSingleEquipment(eq, onClickCallback = null) {
        const layer = this.layerManager.getLayer('equipment');
        if (!layer) return null;
        
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
        
        // 라벨
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
        this.layerManager.addEquipment(eq.id, rect);
        
        // 레이어에 추가
        layer.add(rect);
        layer.add(label);
        
        // 클릭 이벤트
        if (onClickCallback) {
            rect.on('click tap', (e) => {
                e.cancelBubble = true;
                onClickCallback(rect, e);
            });
        }
        
        console.log(`[CanvasRenderer] Equipment 렌더링: ${eq.id}`);
        return rect;
    }
    
    /**
     * Equipment Array 그리기
     * @param {Object} array - Array 설정
     * @param {Function} onClickCallback - 클릭 콜백
     */
    drawEquipmentArray(array, onClickCallback = null) {
        const layer = this.layerManager.getLayer('equipment');
        if (!layer) return;
        
        console.log('[CanvasRenderer] EquipmentArray 렌더링 시작');
        
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
        
        // Excluded positions Set
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
                
                // Equipment Group 생성
                const group = new Konva.Group({
                    x: centerX + currentX * scale,
                    y: centerY + currentZ * scale,
                    name: 'equipment',
                    id: equipmentId,
                    draggable: true
                });
                
                // Equipment Rect
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
                
                // Label
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
                
                // Map에 저장
                this.layerManager.addEquipment(equipmentId, group);
                
                // 레이어에 추가
                layer.add(group);
                
                // 클릭 이벤트
                if (onClickCallback) {
                    group.on('click tap', (e) => {
                        e.cancelBubble = true;
                        onClickCallback(group, e);
                    });
                }
                
                equipmentCount++;
                currentX += array.equipmentWidth + array.spacingX;
                
                // 복도 처리
                if (array.corridorAfterCol && array.corridorAfterCol.includes(col + 1)) {
                    currentX += array.corridorWidthX || 0;
                }
            }
            
            currentZ += array.equipmentDepth + array.spacingZ;
            
            // 복도 처리
            if (array.corridorAfterRow && array.corridorAfterRow.includes(row + 1)) {
                currentZ += array.corridorWidthZ || 0;
            }
        }
        
        console.log(`[CanvasRenderer] EquipmentArray 렌더링 완료: ${equipmentCount}개`);
    }
    
    // =====================================================
    // Component 렌더링 (Drag & Drop용)
    // =====================================================
    
    /**
     * Partition 컴포넌트 생성
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @param {Function} onClickCallback - 클릭 콜백
     * @returns {Konva.Rect}
     */
    createPartitionComponent(x, y, data, onClickCallback = null) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return null;
        
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
        
        if (onClickCallback) {
            partition.on('click tap', () => onClickCallback(partition));
        }
        
        this.layerManager.addComponent(id, partition);
        layer.add(partition);
        layer.batchDraw();
        
        return partition;
    }
    
    /**
     * Desk 컴포넌트 생성
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @param {Function} onClickCallback - 클릭 콜백
     * @returns {Konva.Rect}
     */
    createDeskComponent(x, y, data, onClickCallback = null) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return null;
        
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
        
        if (onClickCallback) {
            desk.on('click tap', () => onClickCallback(desk));
        }
        
        this.layerManager.addComponent(id, desk);
        layer.add(desk);
        layer.batchDraw();
        
        return desk;
    }
    
    /**
     * Pillar 컴포넌트 생성
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @param {Function} onClickCallback - 클릭 콜백
     * @returns {Konva.Rect}
     */
    createPillarComponent(x, y, data, onClickCallback = null) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return null;
        
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
        
        if (onClickCallback) {
            pillar.on('click tap', () => onClickCallback(pillar));
        }
        
        this.layerManager.addComponent(id, pillar);
        layer.add(pillar);
        layer.batchDraw();
        
        return pillar;
    }
    
    /**
     * Office 컴포넌트 생성 (Drop용)
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @param {Function} onClickCallback - 클릭 콜백
     * @returns {Konva.Rect}
     */
    createOfficeComponent(x, y, data, onClickCallback = null) {
        const layer = this.layerManager.getLayer('room');
        if (!layer) return null;
        
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
        
        if (onClickCallback) {
            office.on('click tap', () => onClickCallback(office));
        }
        
        this.layerManager.addComponent(id, office);
        layer.add(office);
        layer.batchDraw();
        
        return office;
    }
    
    /**
     * Equipment 컴포넌트 생성 (Drop용)
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {Object} data - 컴포넌트 데이터
     * @param {Function} onClickCallback - 클릭 콜백
     * @returns {Konva.Rect}
     */
    createEquipmentComponent(x, y, data, onClickCallback = null) {
        const layer = this.layerManager.getLayer('equipment');
        if (!layer) return null;
        
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
        
        if (onClickCallback) {
            equipment.on('click tap', () => onClickCallback(equipment));
        }
        
        this.layerManager.addEquipment(equipmentId, equipment);
        layer.add(equipment);
        layer.batchDraw();
        
        return equipment;
    }
    
    // =====================================================
    // 검증 하이라이트
    // =====================================================
    
    /**
     * 검증 에러 하이라이트 표시
     * @param {Array} errors - 에러 배열
     */
    highlightValidationErrors(errors) {
        console.log('[CanvasRenderer] 검증 에러 하이라이트:', errors.length);
        
        // 기존 하이라이트 제거
        this.clearValidationHighlights();
        
        errors.forEach(error => {
            if (!error) return;
            
            const color = error.severity === 'error' 
                ? this.cssColors.validationError 
                : this.cssColors.validationWarning;
            
            // Equipment ID로 하이라이트
            if (error.equipmentId) {
                this.highlightShapeById(error.equipmentId, color, 'equipment');
            }
            if (error.equipmentId1) {
                this.highlightShapeById(error.equipmentId1, color, 'equipment');
            }
            if (error.equipmentId2) {
                this.highlightShapeById(error.equipmentId2, color, 'equipment');
            }
            
            // Wall ID로 하이라이트
            if (error.wallId) {
                this.highlightShapeById(error.wallId, color, 'wall');
            }
            
            // 위치 기반 하이라이트
            if (error.position && !error.equipmentId && !error.wallId) {
                this.highlightPosition(error.position, color, error.id);
            }
        });
        
        // 레이어 다시 그리기
        this.layerManager.batchDrawAll();
        
        console.log('[CanvasRenderer] 검증 하이라이트 적용 완료');
    }
    
    /**
     * ID로 Shape 하이라이트
     * @param {string} id - Shape ID
     * @param {string} color - 하이라이트 색상
     * @param {string} type - 'equipment' | 'wall' | 'component'
     */
    highlightShapeById(id, color, type) {
        const result = this.layerManager.findShapeById(id);
        if (!result) {
            console.warn(`[CanvasRenderer] Shape를 찾을 수 없음: ${id}`);
            return;
        }
        
        let targetShape = result.shape;
        
        // Group인 경우 내부 Rect 찾기
        if (targetShape.findOne) {
            const rect = targetShape.findOne('.equipmentRect, .officeRect');
            if (rect) {
                targetShape = rect;
            }
        }
        
        // 원래 스타일 저장
        this.validationHighlights.set(id, {
            shape: targetShape,
            originalStroke: targetShape.stroke(),
            originalStrokeWidth: targetShape.strokeWidth(),
            originalShadowColor: targetShape.shadowColor(),
            originalShadowBlur: targetShape.shadowBlur()
        });
        
        // 하이라이트 스타일 적용
        targetShape.stroke(color);
        targetShape.strokeWidth(4);
        targetShape.shadowColor(color);
        targetShape.shadowBlur(10);
        targetShape.shadowOpacity(0.5);
        
        console.log(`[CanvasRenderer] 하이라이트: ${id}`);
    }
    
    /**
     * 위치 기반 하이라이트 (마커 생성)
     * @param {Object} position - { x, y }
     * @param {string} color - 하이라이트 색상
     * @param {string} errorId - 에러 ID
     */
    highlightPosition(position, color, errorId) {
        const layer = this.layerManager.getLayer('ui');
        if (!layer) return;
        
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        const x = centerX + (position.x || 0) * scale;
        const y = centerY + (position.y || position.z || 0) * scale;
        
        // 에러 마커 생성
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
        }, layer);
        
        anim.start();
        
        this.validationHighlights.set(`marker-${errorId}`, {
            shape: marker,
            animation: anim
        });
        
        layer.add(marker);
        
        console.log(`[CanvasRenderer] 위치 마커 생성: (${x}, ${y})`);
    }
    
    /**
     * 모든 검증 하이라이트 제거
     */
    clearValidationHighlights() {
        console.log('[CanvasRenderer] 검증 하이라이트 제거');
        
        this.validationHighlights.forEach((highlight, id) => {
            if (highlight.animation) {
                highlight.animation.stop();
            }
            
            if (highlight.shape) {
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
        this.layerManager.batchDrawAll();
    }
    
    // =====================================================
    // 유틸리티
    // =====================================================
    
    /**
     * 설정 업데이트
     * @param {Object} newConfig - 새 설정
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * CSS 색상 업데이트
     * @param {Object} newColors - 새 색상
     */
    updateCssColors(newColors) {
        this.cssColors = { ...this.cssColors, ...newColors };
    }
    
    /**
     * 전체 레이어 다시 그리기
     */
    batchDrawAll() {
        this.layerManager.batchDrawAll();
    }
    
    /**
     * 정리
     */
    destroy() {
        this.clearValidationHighlights();
        this.layerManager = null;
        this.config = null;
        this.cssColors = null;
        
        console.log('[CanvasRenderer] 파괴 완료');
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined') {
    window.CanvasRenderer = CanvasRenderer;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasRenderer;
}

// export { CanvasRenderer };
// 전역 객체 등록 (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.CanvasRenderer = CanvasRenderer;
}
