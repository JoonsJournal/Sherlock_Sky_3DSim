/**
 * LayoutSerializer.js
 * 
 * Layout 데이터 직렬화/역직렬화 서비스
 * JSON 형식으로 Layout을 저장하고 로드
 * 
 * @module LayoutSerializer
 * @version 1.1.0 - Phase 3.1: rotation 정보 추가
 * 
 * 위치: frontend/threejs_viewer/src/services/layout/LayoutSerializer.js
 */

class LayoutSerializer {
    constructor() {
        console.log('[LayoutSerializer] Initialized v1.1.0');
    }

    /**
     * Canvas2DEditor의 현재 상태를 JSON으로 직렬화
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2DEditor 인스턴스
     * @param {string} siteId - Site ID
     * @returns {Object} Layout JSON 객체
     */
    serialize(canvas2DEditor, siteId) {
        console.log('[LayoutSerializer] Serializing layout for site:', siteId);

        const layout = {
            version: "1.1.0",
            site_id: siteId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            layout_version: 1,
            
            // Canvas 설정
            canvas: {
                width: canvas2DEditor.config.width,
                height: canvas2DEditor.config.height,
                scale: canvas2DEditor.config.scale,
                gridSize: canvas2DEditor.config.gridSize,
                showGrid: canvas2DEditor.config.showGrid,
                snapToGrid: canvas2DEditor.config.snapToGrid
            },

            // Room 정보
            room: this.serializeRoom(canvas2DEditor),

            // Walls
            walls: this.serializeWalls(canvas2DEditor),

            // Office
            office: this.serializeOffice(canvas2DEditor),

            // Partitions
            partitions: this.serializePartitions(canvas2DEditor),

            // Equipment Arrays
            equipmentArrays: this.serializeEquipmentArrays(canvas2DEditor),
            
            // ✨ Phase 3.1: Components
            components: this.serializeComponents(canvas2DEditor)
        };

        console.log('[LayoutSerializer] Serialization complete:', layout);
        return layout;
    }

    /**
     * Room 직렬화
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Object}
     */
    serializeRoom(canvas2DEditor) {
        const currentLayout = canvas2DEditor.currentLayout;
        
        if (!currentLayout || !currentLayout.room) {
            return {
                width: 40,
                depth: 60,
                wallHeight: 3.5,
                wallThickness: 0.2
            };
        }

        return {
            width: currentLayout.room.width || 40,
            depth: currentLayout.room.depth || 60,
            wallHeight: currentLayout.room.wallHeight || 3.5,
            wallThickness: currentLayout.room.wallThickness || 0.2
        };
    }

    /**
     * ✨ Phase 3.1: Walls 직렬화 (rotation 추가)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializeWalls(canvas2DEditor) {
        const walls = [];
        
        canvas2DEditor.wallShapes.forEach((wall, wallId) => {
            const points = wall.points();
            const rotation = wall.rotation ? wall.rotation() : 0;
            
            walls.push({
                id: wallId,
                points: points,
                thickness: wall.strokeWidth() || 3,
                height: wall.getAttr('wallHeight') || 3.5,
                rotation: rotation,  // ✨ rotation 추가
                wallType: wall.getAttr('wallType') || 'partition'
            });
        });

        console.log(`[LayoutSerializer] Serialized ${walls.length} walls`);
        return walls;
    }

    /**
     * ✨ Phase 3.1: Office 직렬화 (rotation 추가)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Object|null}
     */
    serializeOffice(canvas2DEditor) {
        // Office 객체 찾기
        const officeShapes = canvas2DEditor.layers.room.find('.office');
        
        if (!officeShapes || officeShapes.length === 0) {
            return null;
        }
        
        const officeGroup = officeShapes[0];
        const rect = officeGroup.findOne('.officeRect');
        const rotation = officeGroup.rotation ? officeGroup.rotation() : 0;
        
        return {
            x: officeGroup.x(),
            y: officeGroup.y(),
            width: rect ? rect.width() : 0,
            height: rect ? rect.height() : 0,
            rotation: rotation,  // ✨ rotation 추가
            label: officeGroup.getAttr('officeLabel') || 'Office'
        };
    }

    /**
     * ✨ Phase 3.1: Partitions 직렬화 (rotation 추가)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializePartitions(canvas2DEditor) {
        const partitions = [];
        
        // Partition 객체 찾기 (name === 'partition')
        const partitionShapes = canvas2DEditor.layers.room.find('.partition');
        
        partitionShapes.forEach(partition => {
            const points = partition.points();
            const rotation = partition.rotation ? partition.rotation() : 0;
            
            partitions.push({
                id: partition.id(),
                points: points,
                thickness: partition.strokeWidth() || 2,
                height: partition.getAttr('partitionHeight') || 2.5,
                rotation: rotation  // ✨ rotation 추가
            });
        });

        console.log(`[LayoutSerializer] Serialized ${partitions.length} partitions`);
        return partitions;
    }

    /**
     * ✨ Phase 3.1: Equipment Arrays 직렬화 (rotation 추가)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializeEquipmentArrays(canvas2DEditor) {
        const arrays = [];
        
        // Equipment Array 그룹 찾기
        const arrayGroups = canvas2DEditor.layers.equipment.find('.equipmentArray');
        
        arrayGroups.forEach(arrayGroup => {
            const config = arrayGroup.getAttr('arrayConfig');
            const position = arrayGroup.position();
            const rotation = arrayGroup.rotation ? arrayGroup.rotation() : 0;  // ✨ rotation
            
            // 개별 설비 정보
            const equipments = [];
            arrayGroup.children.forEach(child => {
                if (child.name() === 'equipment') {
                    const equipData = child.getAttr('equipmentData');
                    const pos = child.position();
                    const equipRotation = child.rotation ? child.rotation() : 0;  // ✨ rotation
                    
                    equipments.push({
                        id: equipData.id,
                        row: equipData.row,
                        col: equipData.col,
                        x: pos.x,
                        y: pos.y,
                        size: equipData.size,
                        rotation: equipRotation  // ✨ rotation 추가
                    });
                }
            });
            
            arrays.push({
                id: arrayGroup._id,
                position: {
                    x: position.x,
                    y: position.y
                },
                rotation: rotation,  // ✨ Array 전체 rotation
                config: config,
                equipments: equipments,
                count: equipments.length
            });
        });

        // 개별 분리된 설비들도 추가
        const individualEquipments = canvas2DEditor.layers.equipment.find('.equipment')
            .filter(eq => {
                const parent = eq.getParent();
                return !parent.name || parent.name() !== 'equipmentArray';
            });
        
        if (individualEquipments.length > 0) {
            const individualArray = {
                id: 'individual',
                position: { x: 0, y: 0 },
                rotation: 0,
                config: null,
                equipments: [],
                count: 0
            };
            
            individualEquipments.forEach(eq => {
                const equipData = eq.getAttr('equipmentData');
                const absPos = eq.getAbsolutePosition();
                const equipRotation = eq.rotation ? eq.rotation() : 0;  // ✨ rotation
                
                individualArray.equipments.push({
                    id: equipData ? equipData.id : eq.id(),
                    row: equipData ? equipData.row : 0,
                    col: equipData ? equipData.col : 0,
                    x: absPos.x,
                    y: absPos.y,
                    size: equipData ? equipData.size : { width: 1.5, depth: 3.0 },
                    rotation: equipRotation  // ✨ rotation 추가
                });
            });
            
            individualArray.count = individualArray.equipments.length;
            arrays.push(individualArray);
        }

        console.log(`[LayoutSerializer] Serialized ${arrays.length} equipment arrays`);
        return arrays;
    }

    /**
     * ✨ Phase 3.1: Components 직렬화 (Desk, Pillar 등)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializeComponents(canvas2DEditor) {
        const components = [];
        
        canvas2DEditor.componentShapes.forEach((component, componentId) => {
            const componentType = component.getAttr('componentType');
            const componentData = component.getAttr('componentData');
            const position = component.position();
            const rotation = component.rotation ? component.rotation() : 0;
            
            components.push({
                id: componentId,
                type: componentType,
                x: position.x,
                y: position.y,
                rotation: rotation,  // ✨ rotation 추가
                width: component.width ? component.width() : componentData?.width,
                height: component.height ? component.height() : componentData?.depth,
                data: componentData
            });
        });
        
        console.log(`[LayoutSerializer] Serialized ${components.length} components`);
        return components;
    }

    /**
     * ✨ Phase 3.1: JSON을 Canvas2DEditor에 역직렬화 (rotation 복원)
     * @param {Object} layoutData - Layout JSON 객체
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2DEditor 인스턴스
     */
    deserialize(layoutData, canvas2DEditor) {
        console.log('[LayoutSerializer] Deserializing layout:', layoutData);

        // Canvas 설정 적용
        if (layoutData.canvas) {
            canvas2DEditor.config = {
                ...canvas2DEditor.config,
                ...layoutData.canvas
            };
        }

        // Canvas 초기화
        canvas2DEditor.clear();

        // Layout 데이터 저장
        canvas2DEditor.currentLayout = layoutData;

        // Room 그리기
        if (layoutData.room) {
            this.deserializeRoom(layoutData.room, canvas2DEditor);
        }

        // Walls 복원
        if (layoutData.walls && layoutData.walls.length > 0) {
            this.deserializeWalls(layoutData.walls, canvas2DEditor);
        }

        // Office 복원
        if (layoutData.office) {
            this.deserializeOffice(layoutData.office, canvas2DEditor);
        }

        // Partitions 복원
        if (layoutData.partitions && layoutData.partitions.length > 0) {
            this.deserializePartitions(layoutData.partitions, canvas2DEditor);
        }

        // Equipment Arrays 복원
        if (layoutData.equipmentArrays && layoutData.equipmentArrays.length > 0) {
            this.deserializeEquipmentArrays(layoutData.equipmentArrays, canvas2DEditor);
        }
        
        // Components 복원
        if (layoutData.components && layoutData.components.length > 0) {
            this.deserializeComponents(layoutData.components, canvas2DEditor);
        }

        // 모든 레이어 재렌더링
        canvas2DEditor.layers.background.batchDraw();
        canvas2DEditor.layers.room.batchDraw();
        canvas2DEditor.layers.equipment.batchDraw();
        canvas2DEditor.layers.ui.batchDraw();

        console.log('[LayoutSerializer] Deserialization complete');
    }

    /**
     * Room 역직렬화
     */
    deserializeRoom(roomData, canvas2DEditor) {
        const scale = canvas2DEditor.config.scale;
        const widthPx = roomData.width * scale;
        const depthPx = roomData.depth * scale;

        const roomRect = new Konva.Rect({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            stroke: canvas2DEditor.cssColors.roomStroke,
            strokeWidth: 3,
            listening: false,
            name: 'roomBoundary'
        });

        canvas2DEditor.layers.room.add(roomRect);
        
        console.log('[LayoutSerializer] Room deserialized');
    }

    /**
     * ✨ Phase 3.1: Walls 역직렬화 (rotation 복원)
     */
    deserializeWalls(walls, canvas2DEditor) {
        walls.forEach(wallData => {
            const wall = new Konva.Line({
                points: wallData.points,
                stroke: canvas2DEditor.cssColors.wall || '#888888',
                strokeWidth: wallData.thickness || 3,
                lineCap: 'round',
                lineJoin: 'round',
                name: 'wall',
                draggable: true,
                
                wallType: wallData.wallType || 'partition',
                wallHeight: wallData.height || 3.5,
                wallThickness: wallData.thickness || 0.2,
                
                originalStroke: canvas2DEditor.cssColors.wall || '#888888',
                originalStrokeWidth: wallData.thickness || 3
            });

            // ✨ rotation 복원
            if (wallData.rotation) {
                wall.rotation(wallData.rotation);
            }

            wall.id(wallData.id);

            canvas2DEditor.layers.room.add(wall);
            canvas2DEditor.wallShapes.set(wallData.id, wall);
        });

        console.log(`[LayoutSerializer] ${walls.length} walls deserialized`);
    }

    /**
     * ✨ Phase 3.1: Office 역직렬화 (rotation 복원)
     */
    deserializeOffice(officeData, canvas2DEditor) {
        const scale = canvas2DEditor.config.scale;
        
        const officeGroup = new Konva.Group({
            x: officeData.x,
            y: officeData.y,
            draggable: true,
            name: 'office'
        });
        
        // ✨ rotation 복원
        if (officeData.rotation) {
            officeGroup.rotation(officeData.rotation);
        }

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: officeData.width,
            height: officeData.height,
            fill: canvas2DEditor.cssColors.officeFill || '#87CEEB',
            opacity: 0.5,
            stroke: canvas2DEditor.cssColors.officeStroke || '#3498db',
            strokeWidth: 2,
            name: 'officeRect'
        });

        const text = new Konva.Text({
            x: 0,
            y: 0,
            width: officeData.width,
            height: officeData.height,
            text: officeData.label || 'Office',
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#333',
            align: 'center',
            verticalAlign: 'middle'
        });

        officeGroup.add(rect);
        officeGroup.add(text);
        officeGroup.setAttr('officeLabel', officeData.label || 'Office');

        canvas2DEditor.layers.room.add(officeGroup);
        
        console.log('[LayoutSerializer] Office deserialized');
    }

    /**
     * ✨ Phase 3.1: Partitions 역직렬화 (rotation 복원)
     */
    deserializePartitions(partitions, canvas2DEditor) {
        partitions.forEach(partData => {
            const partition = new Konva.Line({
                points: partData.points,
                stroke: canvas2DEditor.cssColors.partition || '#999999',
                strokeWidth: partData.thickness || 2,
                lineCap: 'round',
                lineJoin: 'round',
                dash: [10, 5],
                name: 'partition',
                draggable: true
            });

            // ✨ rotation 복원
            if (partData.rotation) {
                partition.rotation(partData.rotation);
            }

            partition.setAttr('partitionHeight', partData.height || 2.5);
            partition.id(partData.id);

            canvas2DEditor.layers.room.add(partition);
        });

        console.log(`[LayoutSerializer] ${partitions.length} partitions deserialized`);
    }

    /**
     * ✨ Phase 3.1: Equipment Arrays 역직렬화 (rotation 복원)
     */
    deserializeEquipmentArrays(arrays, canvas2DEditor) {
        const scale = canvas2DEditor.config.scale;
        
        arrays.forEach(arrayData => {
            if (arrayData.id === 'individual') {
                // 개별 설비 복원
                arrayData.equipments.forEach(equipData => {
                    const equipGroup = this.createEquipmentShape(
                        equipData,
                        canvas2DEditor,
                        { x: equipData.x, y: equipData.y },
                        true, // draggable
                        equipData.rotation || 0  // ✨ rotation 전달
                    );
                    
                    canvas2DEditor.layers.equipment.add(equipGroup);
                    canvas2DEditor.equipmentShapes.set(equipData.id, equipGroup);
                });
            } else {
                // 배열 그룹 복원
                const arrayGroup = new Konva.Group({
                    x: arrayData.position.x,
                    y: arrayData.position.y,
                    draggable: true,
                    name: 'equipmentArray'
                });
                
                // ✨ Array 전체 rotation 복원
                if (arrayData.rotation) {
                    arrayGroup.rotation(arrayData.rotation);
                }

                arrayGroup.setAttr('arrayConfig', arrayData.config);
                arrayGroup._id = arrayData.id;

                // 배열 내 설비들 복원
                arrayData.equipments.forEach(equipData => {
                    const equipGroup = this.createEquipmentShape(
                        equipData,
                        canvas2DEditor,
                        { x: equipData.x, y: equipData.y },
                        false, // not draggable (part of array)
                        equipData.rotation || 0  // ✨ rotation 전달
                    );
                    
                    arrayGroup.add(equipGroup);
                });

                canvas2DEditor.layers.equipment.add(arrayGroup);
            }
        });

        console.log(`[LayoutSerializer] ${arrays.length} equipment arrays deserialized`);
    }

    /**
     * ✨ Phase 3.1: Components 역직렬화 (rotation 복원)
     */
    deserializeComponents(components, canvas2DEditor) {
        components.forEach(compData => {
            let component = null;
            
            switch (compData.type) {
                case 'desk':
                    if (canvas2DEditor.createDesk) {
                        component = canvas2DEditor.createDesk(compData.x, compData.y, compData.data);
                    }
                    break;
                case 'pillar':
                    if (canvas2DEditor.createPillar) {
                        component = canvas2DEditor.createPillar(compData.x, compData.y, compData.data);
                    }
                    break;
                case 'office':
                    if (canvas2DEditor.createOffice) {
                        component = canvas2DEditor.createOffice(compData.x, compData.y, compData.data);
                    }
                    break;
                case 'equipment':
                    if (canvas2DEditor.createEquipment) {
                        component = canvas2DEditor.createEquipment(compData.x, compData.y, compData.data);
                    }
                    break;
                default:
                    console.warn('[LayoutSerializer] Unknown component type:', compData.type);
            }
            
            if (component && compData.rotation) {
                component.rotation(compData.rotation);
            }
        });
        
        console.log(`[LayoutSerializer] ${components.length} components deserialized`);
    }

    /**
     * ✨ Phase 3.1: 설비 Shape 생성 (rotation 지원)
     */
    createEquipmentShape(equipData, canvas2DEditor, position, draggable, rotation = 0) {
        const scale = canvas2DEditor.config.scale;
        const widthPx = equipData.size.width * scale;
        const depthPx = equipData.size.depth * scale;

        const equipGroup = new Konva.Group({
            x: position.x,
            y: position.y,
            draggable: draggable,
            name: 'equipment',
            rotation: rotation  // ✨ rotation 적용
        });

        equipGroup.setAttr('equipmentData', {
            row: equipData.row,
            col: equipData.col,
            id: equipData.id,
            size: equipData.size,
            rotation: rotation  // ✨ rotation 저장
        });

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            fill: canvas2DEditor.cssColors.equipmentDefault,
            stroke: canvas2DEditor.cssColors.equipmentStroke,
            strokeWidth: 1,
            name: 'equipmentRect'
        });

        const text = new Konva.Text({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            text: equipData.id,
            fontSize: 10,
            fontFamily: 'Arial',
            fill: '#ffffff',
            align: 'center',
            verticalAlign: 'middle',
            name: 'equipmentText'
        });

        equipGroup.add(rect);
        equipGroup.add(text);

        // Hover 효과
        equipGroup.on('mouseenter', () => {
            if (!canvas2DEditor.selectedObjects.includes(equipGroup)) {
                rect.fill(canvas2DEditor.cssColors.equipmentHover);
                canvas2DEditor.layers.equipment.batchDraw();
            }
            canvas2DEditor.stage.container().style.cursor = 'pointer';
        });

        equipGroup.on('mouseleave', () => {
            if (!canvas2DEditor.selectedObjects.includes(equipGroup)) {
                rect.fill(canvas2DEditor.cssColors.equipmentDefault);
                canvas2DEditor.layers.equipment.batchDraw();
            }
            canvas2DEditor.stage.container().style.cursor = 'default';
        });

        return equipGroup;
    }

    /**
     * Layout JSON을 파일로 다운로드
     * @param {Object} layoutData - Layout JSON 객체
     * @param {string} filename - 파일명
     */
    downloadAsFile(layoutData, filename) {
        const jsonString = JSON.stringify(layoutData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`[LayoutSerializer] Downloaded layout as ${filename}`);
    }

    /**
     * 파일에서 Layout JSON 로드
     * @param {File} file - 파일 객체
     * @returns {Promise<Object>} Layout JSON 객체
     */
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const layoutData = JSON.parse(e.target.result);
                    console.log('[LayoutSerializer] Loaded layout from file:', layoutData);
                    resolve(layoutData);
                } catch (error) {
                    console.error('[LayoutSerializer] Error parsing JSON:', error);
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                console.error('[LayoutSerializer] Error reading file:', error);
                reject(error);
            };

            reader.readAsText(file);
        });
    }
}

// Singleton 인스턴스 생성
const layoutSerializer = new LayoutSerializer();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.layoutSerializer = layoutSerializer;
}

// ES Module export
export default layoutSerializer;
export { LayoutSerializer };