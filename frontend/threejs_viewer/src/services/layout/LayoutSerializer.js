/**
 * LayoutSerializer.js
 * 
 * Layout 데이터 직렬화/역직렬화 서비스
 * JSON 형식으로 Layout을 저장하고 로드
 * 
 * @module LayoutSerializer
 * @version 1.0.0
 * 
 * 위치: frontend/threejs_viewer/src/services/layout/LayoutSerializer.js
 */

class LayoutSerializer {
    constructor() {
        console.log('[LayoutSerializer] Initialized');
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
            version: "1.0",
            site_id: siteId,
            created_at: new Date().toISOString(),
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
            equipmentArrays: this.serializeEquipmentArrays(canvas2DEditor)
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
     * Walls 직렬화
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializeWalls(canvas2DEditor) {
        const walls = [];
        
        canvas2DEditor.wallShapes.forEach((wall, wallId) => {
            const points = wall.points();
            
            walls.push({
                id: wallId,
                points: points,
                thickness: wall.strokeWidth() || 3,
                height: wall.getAttr('wallHeight') || 3.5
            });
        });

        console.log(`[LayoutSerializer] Serialized ${walls.length} walls`);
        return walls;
    }

    /**
     * Office 직렬화
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Object|null}
     */
    serializeOffice(canvas2DEditor) {
        // Office 객체 찾기
        const officeGroup = canvas2DEditor.layers.room.findOne('.office');
        
        if (!officeGroup) {
            return null;
        }

        const rect = officeGroup.findOne('.officeRect');
        
        return {
            x: officeGroup.x(),
            y: officeGroup.y(),
            width: rect ? rect.width() : 0,
            height: rect ? rect.height() : 0,
            label: officeGroup.getAttr('officeLabel') || 'Office'
        };
    }

    /**
     * Partitions 직렬화
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializePartitions(canvas2DEditor) {
        const partitions = [];
        
        // Partition 객체 찾기 (name === 'partition')
        const partitionShapes = canvas2DEditor.layers.room.find('.partition');
        
        partitionShapes.forEach(partition => {
            const points = partition.points();
            
            partitions.push({
                id: partition.id(),
                points: points,
                thickness: partition.strokeWidth() || 2,
                height: partition.getAttr('partitionHeight') || 2.5
            });
        });

        console.log(`[LayoutSerializer] Serialized ${partitions.length} partitions`);
        return partitions;
    }

    /**
     * Equipment Arrays 직렬화
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
            
            // 개별 설비 정보
            const equipments = [];
            arrayGroup.children.forEach(child => {
                if (child.name() === 'equipment') {
                    const equipData = child.getAttr('equipmentData');
                    const pos = child.position();
                    
                    equipments.push({
                        id: equipData.id,
                        row: equipData.row,
                        col: equipData.col,
                        x: pos.x,
                        y: pos.y,
                        size: equipData.size
                    });
                }
            });
            
            arrays.push({
                id: arrayGroup._id,
                position: {
                    x: position.x,
                    y: position.y
                },
                config: config,
                equipments: equipments,
                count: equipments.length
            });
        });

        // 개별 분리된 설비들도 추가
        const individualEquipments = canvas2DEditor.layers.equipment.find('.equipment')
            .filter(eq => !eq.getParent().name || eq.getParent().name() !== 'equipmentArray');
        
        if (individualEquipments.length > 0) {
            const individualArray = {
                id: 'individual',
                position: { x: 0, y: 0 },
                config: null,
                equipments: [],
                count: 0
            };
            
            individualEquipments.forEach(eq => {
                const equipData = eq.getAttr('equipmentData');
                const absPos = eq.getAbsolutePosition();
                
                individualArray.equipments.push({
                    id: equipData ? equipData.id : eq.id(),
                    row: equipData ? equipData.row : 0,
                    col: equipData ? equipData.col : 0,
                    x: absPos.x,
                    y: absPos.y,
                    size: equipData ? equipData.size : { width: 1.5, depth: 3.0 }
                });
            });
            
            individualArray.count = individualArray.equipments.length;
            arrays.push(individualArray);
        }

        console.log(`[LayoutSerializer] Serialized ${arrays.length} equipment arrays`);
        return arrays;
    }

    /**
     * JSON을 Canvas2DEditor에 역직렬화
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

        // Room 복원
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

        // 재렌더링
        canvas2DEditor.stage.batchDraw();

        console.log('[LayoutSerializer] Deserialization complete');
    }

    /**
     * Room 역직렬화
     */
    deserializeRoom(roomData, canvas2DEditor) {
        // Room은 Canvas2DEditor.loadLayout에서 처리되므로 여기서는 데이터만 저장
        canvas2DEditor.currentLayout.room = roomData;
        console.log('[LayoutSerializer] Room deserialized');
    }

    /**
     * Walls 역직렬화
     */
    deserializeWalls(walls, canvas2DEditor) {
        walls.forEach(wallData => {
            const wall = new Konva.Line({
                points: wallData.points,
                stroke: canvas2DEditor.cssColors.wallDefault,
                strokeWidth: wallData.thickness || 3,
                lineCap: 'round',
                lineJoin: 'round',
                name: 'wall',
                draggable: true
            });

            wall.setAttr('wallHeight', wallData.height || 3.5);
            wall.id(wallData.id);

            canvas2DEditor.layers.room.add(wall);
            canvas2DEditor.wallShapes.set(wallData.id, wall);
        });

        console.log(`[LayoutSerializer] ${walls.length} walls deserialized`);
    }

    /**
     * Office 역직렬화
     */
    deserializeOffice(officeData, canvas2DEditor) {
        const scale = canvas2DEditor.config.scale;
        
        const officeGroup = new Konva.Group({
            x: officeData.x,
            y: officeData.y,
            draggable: true,
            name: 'office'
        });

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: officeData.width,
            height: officeData.height,
            fill: canvas2DEditor.cssColors.officeFill,
            stroke: canvas2DEditor.cssColors.officeStroke,
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
     * Partitions 역직렬화
     */
    deserializePartitions(partitions, canvas2DEditor) {
        partitions.forEach(partData => {
            const partition = new Konva.Line({
                points: partData.points,
                stroke: canvas2DEditor.cssColors.partition,
                strokeWidth: partData.thickness || 2,
                lineCap: 'round',
                lineJoin: 'round',
                dash: [10, 5],
                name: 'partition',
                draggable: true
            });

            partition.setAttr('partitionHeight', partData.height || 2.5);
            partition.id(partData.id);

            canvas2DEditor.layers.room.add(partition);
        });

        console.log(`[LayoutSerializer] ${partitions.length} partitions deserialized`);
    }

    /**
     * Equipment Arrays 역직렬화
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
                        true // draggable
                    );
                    
                    canvas2DEditor.layers.equipment.add(equipGroup);
                });
            } else {
                // 배열 그룹 복원
                const arrayGroup = new Konva.Group({
                    x: arrayData.position.x,
                    y: arrayData.position.y,
                    draggable: true,
                    name: 'equipmentArray'
                });

                arrayGroup.setAttr('arrayConfig', arrayData.config);

                // 배열 내 설비들 복원
                arrayData.equipments.forEach(equipData => {
                    const equipGroup = this.createEquipmentShape(
                        equipData,
                        canvas2DEditor,
                        { x: equipData.x, y: equipData.y },
                        false // not draggable (part of array)
                    );
                    
                    arrayGroup.add(equipGroup);
                });

                canvas2DEditor.layers.equipment.add(arrayGroup);
            }
        });

        console.log(`[LayoutSerializer] ${arrays.length} equipment arrays deserialized`);
    }

    /**
     * 설비 Shape 생성 (헬퍼 메서드)
     */
    createEquipmentShape(equipData, canvas2DEditor, position, draggable) {
        const scale = canvas2DEditor.config.scale;
        const widthPx = equipData.size.width * scale;
        const depthPx = equipData.size.depth * scale;

        const equipGroup = new Konva.Group({
            x: position.x,
            y: position.y,
            draggable: draggable,
            name: 'equipment'
        });

        equipGroup.setAttr('equipmentData', {
            row: equipData.row,
            col: equipData.col,
            id: equipData.id,
            size: equipData.size
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
            text: `${equipData.row + 1}-${equipData.col + 1}`,
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
            rect.fill(canvas2DEditor.cssColors.equipmentHover);
            canvas2DEditor.layers.equipment.batchDraw();
            canvas2DEditor.stage.container().style.cursor = 'pointer';
        });

        equipGroup.on('mouseleave', () => {
            rect.fill(canvas2DEditor.cssColors.equipmentDefault);
            canvas2DEditor.layers.equipment.batchDraw();
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