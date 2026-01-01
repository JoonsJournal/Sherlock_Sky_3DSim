/**
 * LayoutFileFormat.js
 * 
 * Layout JSON 파일 형식 스키마 정의 및 버전 관리
 * 
 * @module LayoutFileFormat
 * @version 1.1.0 - Phase 3.1: rotation 필드 추가
 * 
 * 위치: frontend/threejs_viewer/src/services/layout/LayoutFileFormat.js
 */

class LayoutFileFormat {
    constructor() {
        this.currentVersion = '1.1.0';
        console.log('[LayoutFileFormat] Initialized v' + this.currentVersion);
    }

    /**
     * Layout JSON 스키마 정의 (v1.1.0)
     */
    getSchema() {
        return {
            version: '1.1.0',
            required: [
                'version',
                'site_id',
                'canvas',
                'room',
                'equipmentArrays'
            ],
            properties: {
                version: {
                    type: 'string',
                    description: 'Layout 파일 형식 버전'
                },
                site_id: {
                    type: 'string',
                    description: 'Site 식별자 (예: korea_site1_line1)'
                },
                created_at: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Layout 생성 시각 (ISO 8601)'
                },
                updated_at: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Layout 수정 시각 (ISO 8601)'
                },
                layout_version: {
                    type: 'integer',
                    description: 'Layout 수정 버전 (증가형)'
                },
                canvas: {
                    type: 'object',
                    required: ['width', 'height', 'scale'],
                    properties: {
                        width: { type: 'number' },
                        height: { type: 'number' },
                        scale: { type: 'number' },
                        gridSize: { type: 'number' },
                        showGrid: { type: 'boolean' },
                        snapToGrid: { type: 'boolean' }
                    }
                },
                room: {
                    type: 'object',
                    required: ['width', 'depth'],
                    properties: {
                        width: { type: 'number', description: '미터 단위' },
                        depth: { type: 'number', description: '미터 단위' },
                        wallHeight: { type: 'number', description: '미터 단위' },
                        wallThickness: { type: 'number', description: '미터 단위' }
                    }
                },
                walls: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'points'],
                        properties: {
                            id: { type: 'string' },
                            points: { 
                                type: 'array',
                                items: { type: 'number' },
                                description: '[x1, y1, x2, y2, ...]'
                            },
                            thickness: { type: 'number' },
                            height: { type: 'number' },
                            rotation: { type: 'number', default: 0 },  // ✨ v1.1.0
                            wallType: { type: 'string' }
                        }
                    }
                },
                office: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' },
                        rotation: { type: 'number', default: 0 },  // ✨ v1.1.0
                        label: { type: 'string' }
                    }
                },
                partitions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            points: { type: 'array', items: { type: 'number' } },
                            thickness: { type: 'number' },
                            height: { type: 'number' },
                            rotation: { type: 'number', default: 0 }  // ✨ v1.1.0
                        }
                    }
                },
                equipmentArrays: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'position', 'equipments'],
                        properties: {
                            id: { type: 'string' },
                            position: {
                                type: 'object',
                                properties: {
                                    x: { type: 'number' },
                                    y: { type: 'number' }
                                }
                            },
                            rotation: { type: 'number', default: 0 },  // ✨ v1.1.0
                            config: { type: 'object', nullable: true },
                            equipments: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        row: { type: 'integer' },
                                        col: { type: 'integer' },
                                        x: { type: 'number' },
                                        y: { type: 'number' },
                                        rotation: { type: 'number', default: 0 },  // ✨ v1.1.0
                                        size: {
                                            type: 'object',
                                            properties: {
                                                width: { type: 'number' },
                                                depth: { type: 'number' }
                                            }
                                        }
                                    }
                                }
                            },
                            count: { type: 'integer' }
                        }
                    }
                },
                components: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            type: { type: 'string' },
                            x: { type: 'number' },
                            y: { type: 'number' },
                            rotation: { type: 'number', default: 0 },  // ✨ v1.1.0
                            width: { type: 'number' },
                            height: { type: 'number' },
                            data: { type: 'object' }
                        }
                    }
                }
            }
        };
    }

    /**
     * Layout JSON 유효성 검증
     * @param {Object} layoutData - 검증할 Layout JSON
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validate(layoutData) {
        const errors = [];
        
        try {
            const schema = this.getSchema();
            
            // 필수 필드 체크
            schema.required.forEach(field => {
                if (!(field in layoutData)) {
                    errors.push({
                        field: field,
                        message: `Required field '${field}' is missing`
                    });
                }
            });
            
            // 버전 체크
            if (layoutData.version && layoutData.version !== this.currentVersion) {
                console.warn(`[LayoutFileFormat] Version mismatch: ${layoutData.version} vs ${this.currentVersion}`);
            }
            
            // Room 유효성 체크
            if (layoutData.room) {
                if (!layoutData.room.width || layoutData.room.width <= 0) {
                    errors.push({
                        field: 'room.width',
                        message: 'Room width must be greater than 0'
                    });
                }
                if (!layoutData.room.depth || layoutData.room.depth <= 0) {
                    errors.push({
                        field: 'room.depth',
                        message: 'Room depth must be greater than 0'
                    });
                }
            }
            
            // Equipment Arrays 유효성 체크
            if (layoutData.equipmentArrays) {
                if (!Array.isArray(layoutData.equipmentArrays)) {
                    errors.push({
                        field: 'equipmentArrays',
                        message: 'equipmentArrays must be an array'
                    });
                } else if (layoutData.equipmentArrays.length === 0) {
                    console.warn('[LayoutFileFormat] No equipment arrays defined');
                }
            }
            
            console.log(`[LayoutFileFormat] Validation complete: ${errors.length} errors found`);
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
            
        } catch (error) {
            console.error('[LayoutFileFormat] Validation error:', error);
            return {
                valid: false,
                errors: [{
                    field: 'unknown',
                    message: error.message
                }]
            };
        }
    }

    /**
     * 버전 마이그레이션 (v1.0.0 → v1.1.0)
     * @param {Object} layoutData - 구버전 Layout JSON
     * @returns {Object} 신버전 Layout JSON
     */
    migrate(layoutData) {
        const fromVersion = layoutData.version || '1.0.0';
        
        console.log(`[LayoutFileFormat] Migrating from ${fromVersion} to ${this.currentVersion}`);
        
        if (fromVersion === '1.0.0' || fromVersion === '1.0') {
            // v1.0.0 → v1.1.0: rotation 필드 추가
            layoutData = this.migrateV1_0_to_V1_1(layoutData);
        }
        
        // 버전 업데이트
        layoutData.version = this.currentVersion;
        
        console.log('[LayoutFileFormat] Migration complete');
        return layoutData;
    }

    /**
     * v1.0.0 → v1.1.0 마이그레이션
     * @private
     */
    migrateV1_0_to_V1_1(layoutData) {
        console.log('[LayoutFileFormat] Applying v1.0.0 → v1.1.0 migration');
        
        // Walls에 rotation 추가
        if (layoutData.walls) {
            layoutData.walls.forEach(wall => {
                if (!('rotation' in wall)) {
                    wall.rotation = 0;
                }
            });
        }
        
        // Office에 rotation 추가
        if (layoutData.office && !('rotation' in layoutData.office)) {
            layoutData.office.rotation = 0;
        }
        
        // Partitions에 rotation 추가
        if (layoutData.partitions) {
            layoutData.partitions.forEach(partition => {
                if (!('rotation' in partition)) {
                    partition.rotation = 0;
                }
            });
        }
        
        // Equipment Arrays에 rotation 추가
        if (layoutData.equipmentArrays) {
            layoutData.equipmentArrays.forEach(array => {
                if (!('rotation' in array)) {
                    array.rotation = 0;
                }
                
                if (array.equipments) {
                    array.equipments.forEach(equip => {
                        if (!('rotation' in equip)) {
                            equip.rotation = 0;
                        }
                    });
                }
            });
        }
        
        // Components에 rotation 추가
        if (layoutData.components) {
            layoutData.components.forEach(comp => {
                if (!('rotation' in comp)) {
                    comp.rotation = 0;
                }
            });
        }
        
        console.log('[LayoutFileFormat] v1.0.0 → v1.1.0 migration applied');
        return layoutData;
    }

    /**
     * 샘플 Layout JSON 생성
     * @returns {Object} 샘플 Layout
     */
    createSample() {
        return {
            version: this.currentVersion,
            site_id: "sample_site",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            layout_version: 1,
            
            canvas: {
                width: 1200,
                height: 800,
                scale: 10,
                gridSize: 10,
                showGrid: true,
                snapToGrid: true
            },
            
            room: {
                width: 40,
                depth: 60,
                wallHeight: 3.5,
                wallThickness: 0.2
            },
            
            walls: [],
            office: null,
            partitions: [],
            
            equipmentArrays: [{
                id: "array-1",
                position: { x: 100, y: 100 },
                rotation: 0,
                config: {
                    rows: 26,
                    cols: 6,
                    equipmentSize: { width: 1.5, depth: 3.0 },
                    spacing: 0.5,
                    corridorCols: [2, 4],
                    corridorColWidth: 1.2,
                    corridorRows: [13],
                    corridorRowWidth: 2.0
                },
                equipments: [],
                count: 0
            }],
            
            components: []
        };
    }
}

// Singleton 인스턴스 생성
const layoutFileFormat = new LayoutFileFormat();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.layoutFileFormat = layoutFileFormat;
}

// ES Module export
export default layoutFileFormat;
export { LayoutFileFormat };