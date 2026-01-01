/**
 * LayoutSerializer.js
 * 
 * Layout 데이터 직렬화/역직렬화 서비스
 * JSON 형식으로 Layout을 저장하고 로드
 * 
 * @module LayoutSerializer
 * @version 1.2.0 - Phase 3.3: 버전 관리 및 Change Log 통합
 * 
 * 위치: frontend/threejs_viewer/src/services/layout/LayoutSerializer.js
 * 
 * ✨ v1.2.0 신규 기능:
 * - 버전 관리 (layout_version 증가)
 * - Change Log 기록
 * - 백업 메타데이터 추가
 */

class LayoutSerializer {
    constructor() {
        this.version = '1.2.0';
        console.log(`[LayoutSerializer] Initialized v${this.version}`);
    }

    /**
     * ✨ v1.2.0: Canvas2DEditor의 현재 상태를 JSON으로 직렬화 (확장)
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2DEditor 인스턴스
     * @param {string} siteId - Site ID
     * @param {Object} options - 옵션 (✨ NEW)
     * @param {number} options.layoutVersion - 레이아웃 버전 (optional)
     * @param {Array} options.changeLog - 변경 이력 배열 (optional)
     * @param {string} options.changeDescription - 이번 변경 설명 (optional)
     * @param {Object} options.previousLayout - 이전 레이아웃 (변경 감지용, optional)
     * @returns {Object} Layout JSON 객체
     */
    serialize(canvas2DEditor, siteId, options = {}) {
        console.log('[LayoutSerializer] Serializing layout for site:', siteId);
        console.log('[LayoutSerializer] Options:', options);

        // ✨ v1.2.0: 버전 관리
        const layoutVersion = options.layoutVersion || 1;
        const existingChangeLog = options.changeLog || [];
        const changeDescription = options.changeDescription || null;

        const layout = {
            version: this.version,
            site_id: siteId,
            created_at: options.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            
            // ✨ v1.2.0: 버전 정보
            layout_version: layoutVersion,
            
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
            
            // Components
            components: this.serializeComponents(canvas2DEditor),
            
            // ✨ v1.2.0: Change Log
            change_log: this.buildChangeLog(existingChangeLog, layoutVersion, changeDescription)
        };

        // ✨ v1.2.0: 설비 통계 추가
        layout.statistics = this.calculateStatistics(layout);

        console.log('[LayoutSerializer] Serialization complete:', layout);
        console.log(`[LayoutSerializer] Version: ${layoutVersion}, Equipment count: ${layout.statistics.totalEquipment}`);
        
        return layout;
    }

    /**
     * ✨ v1.2.0: Change Log 빌드
     * @param {Array} existingLog - 기존 Change Log
     * @param {number} version - 현재 버전
     * @param {string} description - 변경 설명
     * @returns {Array} 업데이트된 Change Log
     */
    buildChangeLog(existingLog, version, description) {
        const changeLog = [...existingLog];
        
        // 새 변경 항목 추가
        if (description || version > 1) {
            changeLog.unshift({
                version: version,
                timestamp: new Date().toISOString(),
                changes: description || (version === 1 ? '초기 생성' : `버전 ${version} 저장`)
            });
        }
        
        // 최대 20개 유지
        if (changeLog.length > 20) {
            changeLog.splice(20);
        }
        
        return changeLog;
    }

    /**
     * ✨ v1.2.0: 통계 계산
     * @param {Object} layout - Layout 데이터
     * @returns {Object} 통계 정보
     */
    calculateStatistics(layout) {
        let totalEquipment = 0;
        
        // Equipment Arrays에서 설비 수 계산
        if (layout.equipmentArrays) {
            layout.equipmentArrays.forEach(array => {
                totalEquipment += array.count || (array.equipments?.length || 0);
            });
        }
        
        // Components에서 equipment 타입 계산
        if (layout.components) {
            totalEquipment += layout.components.filter(c => c.type === 'equipment').length;
        }
        
        return {
            totalEquipment: totalEquipment,
            totalWalls: layout.walls?.length || 0,
            totalPartitions: layout.partitions?.length || 0,
            totalComponents: layout.components?.length || 0,
            roomArea: (layout.room?.width || 0) * (layout.room?.depth || 0)
        };
    }

    /**
     * ✨ v1.2.0: 변경사항 감지
     * @param {Object} currentLayout - 현재 Layout
     * @param {Object} previousLayout - 이전 Layout
     * @returns {Array} 변경 사항 목록
     */
    detectChanges(currentLayout, previousLayout) {
        const changes = [];
        
        if (!previousLayout) {
            changes.push('신규 생성');
            return changes;
        }
        
        // Room 크기 변경
        if (currentLayout.room && previousLayout.room) {
            if (currentLayout.room.width !== previousLayout.room.width ||
                currentLayout.room.depth !== previousLayout.room.depth) {
                changes.push(`Room 크기 변경: ${previousLayout.room.width}×${previousLayout.room.depth}m → ${currentLayout.room.width}×${currentLayout.room.depth}m`);
            }
        }
        
        // 설비 수 변경
        const currentCount = currentLayout.statistics?.totalEquipment || 0;
        const previousCount = previousLayout.statistics?.totalEquipment || 0;
        if (currentCount !== previousCount) {
            const diff = currentCount - previousCount;
            changes.push(`설비 ${diff > 0 ? '추가' : '삭제'}: ${Math.abs(diff)}개 (${previousCount} → ${currentCount})`);
        }
        
        // 벽 수 변경
        const currentWalls = currentLayout.walls?.length || 0;
        const previousWalls = previousLayout.walls?.length || 0;
        if (currentWalls !== previousWalls) {
            const diff = currentWalls - previousWalls;
            changes.push(`벽 ${diff > 0 ? '추가' : '삭제'}: ${Math.abs(diff)}개`);
        }
        
        // 파티션 수 변경
        const currentPartitions = currentLayout.partitions?.length || 0;
        const previousPartitions = previousLayout.partitions?.length || 0;
        if (currentPartitions !== previousPartitions) {
            const diff = currentPartitions - previousPartitions;
            changes.push(`파티션 ${diff > 0 ? '추가' : '삭제'}: ${Math.abs(diff)}개`);
        }
        
        // Office 변경
        if (currentLayout.office && previousLayout.office) {
            if (currentLayout.office.width !== previousLayout.office.width ||
                currentLayout.office.height !== previousLayout.office.height) {
                changes.push('Office 크기 변경');
            }
        } else if (currentLayout.office && !previousLayout.office) {
            changes.push('Office 추가');
        } else if (!currentLayout.office && previousLayout.office) {
            changes.push('Office 삭제');
        }
        
        if (changes.length === 0) {
            changes.push('설정 변경');
        }
        
        return changes;
    }

    /**
     * ✨ v1.2.0: 변경 설명 자동 생성
     * @param {Object} currentLayout - 현재 Layout
     * @param {Object} previousLayout - 이전 Layout
     * @returns {string} 변경 설명
     */
    generateChangeDescription(currentLayout, previousLayout) {
        const changes = this.detectChanges(currentLayout, previousLayout);
        return changes.join(', ');
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
     * Walls 직렬화 (rotation 포함)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializeWalls(canvas2DEditor) {
        const walls = [];
        
        if (!canvas2DEditor.wallShapes) {
            return walls;
        }
        
        canvas2DEditor.wallShapes.forEach((wall, wallId) => {
            const points = wall.points ? wall.points() : [];
            const rotation = wall.rotation ? wall.rotation() : 0;
            
            walls.push({
                id: wallId,
                points: points,
                thickness: wall.strokeWidth ? wall.strokeWidth() : 3,
                height: wall.getAttr ? (wall.getAttr('wallHeight') || 3.5) : 3.5,
                rotation: rotation,
                wallType: wall.getAttr ? (wall.getAttr('wallType') || 'partition') : 'partition'
            });
        });

        console.log(`[LayoutSerializer] Serialized ${walls.length} walls`);
        return walls;
    }

    /**
     * Office 직렬화 (rotation 포함)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Object|null}
     */
    serializeOffice(canvas2DEditor) {
        if (!canvas2DEditor.layers || !canvas2DEditor.layers.room) {
            return null;
        }
        
        const officeShapes = canvas2DEditor.layers.room.find('.office');
        
        if (!officeShapes || officeShapes.length === 0) {
            return null;
        }
        
        const officeGroup = officeShapes[0];
        const rect = officeGroup.findOne ? officeGroup.findOne('.officeRect') : null;
        const rotation = officeGroup.rotation ? officeGroup.rotation() : 0;
        
        return {
            x: officeGroup.x(),
            y: officeGroup.y(),
            width: rect ? rect.width() : 0,
            height: rect ? rect.height() : 0,
            rotation: rotation,
            label: officeGroup.getAttr ? (officeGroup.getAttr('officeLabel') || 'Office') : 'Office'
        };
    }

    /**
     * Partitions 직렬화 (rotation 포함)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializePartitions(canvas2DEditor) {
        const partitions = [];
        
        if (!canvas2DEditor.layers || !canvas2DEditor.layers.room) {
            return partitions;
        }
        
        const partitionShapes = canvas2DEditor.layers.room.find('.partition');
        
        if (!partitionShapes) {
            return partitions;
        }
        
        partitionShapes.forEach(partition => {
            const points = partition.points ? partition.points() : [];
            const rotation = partition.rotation ? partition.rotation() : 0;
            
            partitions.push({
                id: partition.id(),
                points: points,
                thickness: partition.strokeWidth ? partition.strokeWidth() : 2,
                height: partition.getAttr ? (partition.getAttr('partitionHeight') || 2.5) : 2.5,
                rotation: rotation
            });
        });

        console.log(`[LayoutSerializer] Serialized ${partitions.length} partitions`);
        return partitions;
    }

    /**
     * Equipment Arrays 직렬화 (rotation 포함)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializeEquipmentArrays(canvas2DEditor) {
        const arrays = [];
        
        if (!canvas2DEditor.layers || !canvas2DEditor.layers.equipment) {
            return arrays;
        }
        
        const arrayGroups = canvas2DEditor.layers.equipment.find('.equipmentArray');
        
        if (!arrayGroups) {
            return arrays;
        }
        
        arrayGroups.forEach(arrayGroup => {
            const config = arrayGroup.getAttr ? arrayGroup.getAttr('arrayConfig') : null;
            const position = arrayGroup.position ? arrayGroup.position() : { x: 0, y: 0 };
            const rotation = arrayGroup.rotation ? arrayGroup.rotation() : 0;
            
            // 개별 설비 정보
            const equipments = [];
            if (arrayGroup.children) {
                arrayGroup.children.forEach(child => {
                    if (child.name && child.name() === 'equipment') {
                        const equipData = child.getAttr ? child.getAttr('equipmentData') : {};
                        const pos = child.position ? child.position() : { x: 0, y: 0 };
                        const equipRotation = child.rotation ? child.rotation() : 0;
                        
                        equipments.push({
                            id: equipData.id,
                            row: equipData.row,
                            col: equipData.col,
                            x: pos.x,
                            y: pos.y,
                            size: equipData.size,
                            rotation: equipRotation
                        });
                    }
                });
            }
            
            arrays.push({
                id: arrayGroup._id || `array_${Date.now()}`,
                position: {
                    x: position.x,
                    y: position.y
                },
                rotation: rotation,
                config: config,
                equipments: equipments,
                count: equipments.length
            });
        });

        // 개별 분리된 설비들도 추가
        const individualEquipments = canvas2DEditor.layers.equipment.find('.equipment')
            .filter(eq => {
                const parent = eq.getParent ? eq.getParent() : null;
                return !parent || !parent.name || parent.name() !== 'equipmentArray';
            });
        
        if (individualEquipments && individualEquipments.length > 0) {
            const individualArray = {
                id: 'individual',
                position: { x: 0, y: 0 },
                rotation: 0,
                config: null,
                equipments: [],
                count: 0
            };
            
            individualEquipments.forEach(eq => {
                const equipData = eq.getAttr ? eq.getAttr('equipmentData') : {};
                const pos = eq.position ? eq.position() : { x: 0, y: 0 };
                const rotation = eq.rotation ? eq.rotation() : 0;
                
                if (equipData) {
                    individualArray.equipments.push({
                        id: equipData.id,
                        row: equipData.row,
                        col: equipData.col,
                        x: pos.x,
                        y: pos.y,
                        size: equipData.size,
                        rotation: rotation
                    });
                }
            });
            
            individualArray.count = individualArray.equipments.length;
            
            if (individualArray.count > 0) {
                arrays.push(individualArray);
            }
        }

        console.log(`[LayoutSerializer] Serialized ${arrays.length} equipment arrays`);
        return arrays;
    }

    /**
     * Components 직렬화 (rotation 포함)
     * @param {Canvas2DEditor} canvas2DEditor
     * @returns {Array}
     */
    serializeComponents(canvas2DEditor) {
        const components = [];
        
        if (!canvas2DEditor.layers || !canvas2DEditor.layers.room) {
            return components;
        }
        
        // Desk 컴포넌트
        const desks = canvas2DEditor.layers.room.find('.desk');
        if (desks) {
            desks.forEach(desk => {
                const rotation = desk.rotation ? desk.rotation() : 0;
                components.push({
                    type: 'desk',
                    id: desk.id(),
                    x: desk.x(),
                    y: desk.y(),
                    rotation: rotation,
                    data: desk.getAttr ? desk.getAttr('deskData') : {}
                });
            });
        }
        
        // Pillar 컴포넌트
        const pillars = canvas2DEditor.layers.room.find('.pillar');
        if (pillars) {
            pillars.forEach(pillar => {
                const rotation = pillar.rotation ? pillar.rotation() : 0;
                components.push({
                    type: 'pillar',
                    id: pillar.id(),
                    x: pillar.x(),
                    y: pillar.y(),
                    rotation: rotation,
                    data: pillar.getAttr ? pillar.getAttr('pillarData') : {}
                });
            });
        }
        
        console.log(`[LayoutSerializer] Serialized ${components.length} components`);
        return components;
    }

    /**
     * JSON에서 Layout 역직렬화
     * @param {Object} layoutData - Layout JSON 객체
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2DEditor 인스턴스
     */
    deserialize(layoutData, canvas2DEditor) {
        console.log('[LayoutSerializer] Deserializing layout:', layoutData.site_id);
        console.log('[LayoutSerializer] Version:', layoutData.layout_version || 1);

        // Canvas 설정 복원
        if (layoutData.canvas) {
            canvas2DEditor.config = {
                ...canvas2DEditor.config,
                ...layoutData.canvas
            };
        }

        // Room 복원
        if (layoutData.room) {
            canvas2DEditor.currentLayout = {
                ...canvas2DEditor.currentLayout,
                room: layoutData.room
            };
        }

        // Walls 복원
        if (layoutData.walls) {
            this.deserializeWalls(layoutData.walls, canvas2DEditor);
        }

        // Partitions 복원
        if (layoutData.partitions) {
            this.deserializePartitions(layoutData.partitions, canvas2DEditor);
        }

        // Equipment Arrays 복원
        if (layoutData.equipmentArrays) {
            this.deserializeEquipmentArrays(layoutData.equipmentArrays, canvas2DEditor);
        }

        // Components 복원
        if (layoutData.components) {
            this.deserializeComponents(layoutData.components, canvas2DEditor);
        }

        console.log('[LayoutSerializer] Deserialization complete');
    }

    /**
     * Walls 역직렬화
     */
    deserializeWalls(walls, canvas2DEditor) {
        if (!canvas2DEditor.layers || !canvas2DEditor.layers.room) {
            console.warn('[LayoutSerializer] Cannot deserialize walls: layers not ready');
            return;
        }
        
        walls.forEach(wallData => {
            try {
                const wall = new Konva.Line({
                    points: wallData.points,
                    stroke: '#666',
                    strokeWidth: wallData.thickness || 3,
                    lineCap: 'round',
                    lineJoin: 'round',
                    name: 'wall'
                });
                
                wall.setAttr('wallHeight', wallData.height || 3.5);
                wall.setAttr('wallType', wallData.wallType || 'partition');
                
                if (wallData.rotation) {
                    wall.rotation(wallData.rotation);
                }
                
                canvas2DEditor.layers.room.add(wall);
                canvas2DEditor.wallShapes.set(wallData.id, wall);
            } catch (error) {
                console.error('[LayoutSerializer] Error deserializing wall:', error);
            }
        });
        
        console.log(`[LayoutSerializer] ${walls.length} walls deserialized`);
    }

    /**
     * Partitions 역직렬화
     */
    deserializePartitions(partitions, canvas2DEditor) {
        if (!canvas2DEditor.layers || !canvas2DEditor.layers.room) {
            return;
        }
        
        partitions.forEach(partData => {
            try {
                const partition = new Konva.Line({
                    points: partData.points,
                    stroke: '#888',
                    strokeWidth: partData.thickness || 2,
                    lineCap: 'round',
                    lineJoin: 'round',
                    name: 'partition',
                    id: partData.id
                });
                
                partition.setAttr('partitionHeight', partData.height || 2.5);
                
                if (partData.rotation) {
                    partition.rotation(partData.rotation);
                }
                
                canvas2DEditor.layers.room.add(partition);
            } catch (error) {
                console.error('[LayoutSerializer] Error deserializing partition:', error);
            }
        });
        
        console.log(`[LayoutSerializer] ${partitions.length} partitions deserialized`);
    }

    /**
     * Equipment Arrays 역직렬화
     */
    deserializeEquipmentArrays(arrays, canvas2DEditor) {
        if (!canvas2DEditor.layers || !canvas2DEditor.layers.equipment) {
            return;
        }
        
        const scale = canvas2DEditor.config.scale;
        
        arrays.forEach(arrayData => {
            try {
                if (arrayData.id === 'individual') {
                    // 개별 설비 복원
                    arrayData.equipments.forEach(equipData => {
                        const equipGroup = this.createEquipmentShape(
                            equipData,
                            canvas2DEditor,
                            { x: equipData.x, y: equipData.y },
                            true,
                            equipData.rotation || 0
                        );
                        
                        canvas2DEditor.layers.equipment.add(equipGroup);
                        if (canvas2DEditor.equipmentShapes) {
                            canvas2DEditor.equipmentShapes.set(equipData.id, equipGroup);
                        }
                    });
                } else {
                    // 배열 그룹 복원
                    const arrayGroup = new Konva.Group({
                        x: arrayData.position.x,
                        y: arrayData.position.y,
                        draggable: true,
                        name: 'equipmentArray'
                    });
                    
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
                            false,
                            equipData.rotation || 0
                        );
                        
                        arrayGroup.add(equipGroup);
                    });
                    
                    canvas2DEditor.layers.equipment.add(arrayGroup);
                }
            } catch (error) {
                console.error('[LayoutSerializer] Error deserializing equipment array:', error);
            }
        });
        
        console.log(`[LayoutSerializer] ${arrays.length} equipment arrays deserialized`);
    }

    /**
     * Components 역직렬화
     */
    deserializeComponents(components, canvas2DEditor) {
        components.forEach(compData => {
            try {
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
                    default:
                        console.warn('[LayoutSerializer] Unknown component type:', compData.type);
                }
                
                if (component && compData.rotation) {
                    component.rotation(compData.rotation);
                }
            } catch (error) {
                console.error('[LayoutSerializer] Error deserializing component:', error);
            }
        });
        
        console.log(`[LayoutSerializer] ${components.length} components deserialized`);
    }

    /**
     * 설비 Shape 생성 (rotation 지원)
     */
    createEquipmentShape(equipData, canvas2DEditor, position, draggable, rotation = 0) {
        const scale = canvas2DEditor.config.scale || 10;
        const size = equipData.size || { width: 1.5, depth: 3.0 };
        const widthPx = size.width * scale;
        const depthPx = size.depth * scale;

        const equipGroup = new Konva.Group({
            x: position.x,
            y: position.y,
            draggable: draggable,
            name: 'equipment',
            rotation: rotation
        });

        equipGroup.setAttr('equipmentData', {
            row: equipData.row,
            col: equipData.col,
            id: equipData.id,
            size: size,
            rotation: rotation
        });

        const colors = canvas2DEditor.cssColors || {
            equipmentDefault: '#4a5568',
            equipmentStroke: '#2d3748'
        };

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            fill: colors.equipmentDefault,
            stroke: colors.equipmentStroke,
            strokeWidth: 1,
            name: 'equipmentRect'
        });

        const text = new Konva.Text({
            x: 0,
            y: 0,
            width: widthPx,
            height: depthPx,
            text: equipData.id || '',
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
            const selectedObjects = canvas2DEditor.selectedObjects || [];
            if (!selectedObjects.includes(equipGroup)) {
                rect.fill(colors.equipmentHover || '#5a6578');
                canvas2DEditor.layers.equipment.batchDraw();
            }
            if (canvas2DEditor.stage) {
                canvas2DEditor.stage.container().style.cursor = 'pointer';
            }
        });

        equipGroup.on('mouseleave', () => {
            const selectedObjects = canvas2DEditor.selectedObjects || [];
            if (!selectedObjects.includes(equipGroup)) {
                rect.fill(colors.equipmentDefault);
                canvas2DEditor.layers.equipment.batchDraw();
            }
            if (canvas2DEditor.stage) {
                canvas2DEditor.stage.container().style.cursor = 'default';
            }
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
    window.LayoutSerializer = LayoutSerializer;
}

// ES Module export
export default layoutSerializer;
export { LayoutSerializer };