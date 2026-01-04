/**
 * LayoutExporter.js
 * ==================
 * 
 * Canvas2DEditor에서 분리된 Layout Export 모듈
 * Layout 데이터 추출 및 직렬화 담당
 * 
 * @version 1.0.0 - Phase 4 리팩토링
 * @module LayoutExporter
 * 
 * 역할:
 * 1. Layout 데이터 Export
 * 2. Room, Wall, Equipment, Office 데이터 추출
 * 3. Component 데이터 추출
 * 4. EquipmentArray 정보 추출
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/export/LayoutExporter.js
 */

class LayoutExporter {
    /**
     * @param {LayerManager} layerManager - LayerManager 인스턴스
     * @param {Object} config - 캔버스 설정
     */
    constructor(layerManager, config) {
        if (!layerManager) {
            throw new Error('[LayoutExporter] LayerManager 인스턴스가 필요합니다');
        }
        
        this.layerManager = layerManager;
        this.config = config;
        
        // Shape Maps 참조
        this.equipmentShapes = layerManager.getEquipmentMap();
        this.wallShapes = layerManager.getWallMap();
        this.componentShapes = layerManager.getComponentMap();
        
        // layers 참조
        this.layers = layerManager.getAllLayers();
        
        console.log('[LayoutExporter] 초기화 완료 v1.0.0');
    }

    // =====================================================
    // 메인 Export
    // =====================================================

    /**
     * Layout 데이터 Export
     * @param {Object} currentLayout - 현재 Layout 기본 데이터
     * @returns {Object} - 완전한 Layout 데이터
     */
    exportLayoutData(currentLayout = {}) {
        console.log('[LayoutExporter] Layout 데이터 Export 시작...');
        
        const baseLayout = currentLayout || {};
        
        // Canvas 정보
        const canvas = {
            width: this.config.width,
            height: this.config.height,
            scale: this.config.scale,
            gridSize: this.config.gridSize
        };
        
        // 각 요소 추출
        const room = this.extractRoomData();
        const equipmentArrays = this.extractEquipmentArrays();
        const equipments = this.extractEquipments();
        const walls = this.extractWalls();
        const office = this.extractOffice();
        const components = this.extractComponents();
        
        // 최종 Layout 데이터 조합
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
        
        console.log('[LayoutExporter] Layout Export 완료:', {
            equipments: equipments.length,
            walls: walls.length,
            components: components.length
        });
        
        return layoutData;
    }

    /**
     * 직렬화 가능한 데이터 반환
     * @param {Object} currentLayout - 현재 Layout
     * @returns {Object}
     */
    getSerializableData(currentLayout = {}) {
        return {
            config: this.config,
            currentLayout: currentLayout,
            objectCount: this.getObjectCount()
        };
    }

    /**
     * 객체 개수 반환
     * @returns {Object}
     */
    getObjectCount() {
        return {
            walls: this.wallShapes.size,
            equipments: this.equipmentShapes.size,
            components: this.componentShapes.size,
            total: this.wallShapes.size + this.equipmentShapes.size + this.componentShapes.size
        };
    }

    // =====================================================
    // Room 데이터 추출
    // =====================================================

    /**
     * Room 데이터 추출
     * @returns {Object|null}
     */
    extractRoomData() {
        const roomLayer = this.layers.room;
        if (!roomLayer) return null;
        
        // Room 경계 Rect 찾기
        const roomRects = roomLayer.find('Rect').filter(rect => {
            const name = rect.name() || '';
            return !name.includes('equipment') && 
                   !name.includes('office') && 
                   !name.includes('partition') &&
                   !name.includes('pillar') &&
                   !name.includes('desk');
        });
        
        if (roomRects.length === 0) {
            return null;
        }
        
        const roomRect = roomRects[0];
        const scale = this.config.scale;
        
        return {
            width: Math.round(roomRect.width() / scale),
            depth: Math.round(roomRect.height() / scale),
            wallHeight: 5,
            wallThickness: 0.2
        };
    }

    // =====================================================
    // Equipment 데이터 추출
    // =====================================================

    /**
     * Equipment 배열 데이터 추출
     * @returns {Array}
     */
    extractEquipmentArrays() {
        const arrays = [];
        const equipmentLayer = this.layers.equipment;
        
        if (!equipmentLayer) return arrays;
        
        // EquipmentArray 그룹 찾기
        const arrayGroups = equipmentLayer.find('.equipmentArray');
        
        arrayGroups.forEach(group => {
            const config = group.getAttr('arrayConfig');
            const position = group.position();
            
            if (config) {
                arrays.push({
                    id: group.id(),
                    position: position,
                    config: config,
                    equipmentCount: group.children ? group.children.length : 0
                });
            }
        });

        return arrays;
    }

    /**
     * 개별 Equipment 데이터 추출
     * @returns {Array}
     */
    extractEquipments() {
        const equipments = [];
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        this.equipmentShapes.forEach((shape, id) => {
            let x, y, width, depth, rotation;
            
            // Group인 경우
            if (shape.findOne) {
                const rect = shape.findOne('.equipmentRect');
                x = shape.x();
                y = shape.y();
                width = rect ? rect.width() : shape.width();
                depth = rect ? rect.height() : shape.height();
                rotation = shape.rotation() || 0;
            } 
            // 단일 Rect인 경우
            else {
                x = shape.x();
                y = shape.y();
                width = shape.width();
                depth = shape.height();
                rotation = shape.rotation() || 0;
            }
            
            equipments.push({
                id: id,
                x: Math.round((x - centerX) / scale * 100) / 100,
                z: Math.round((y - centerY) / scale * 100) / 100,
                width: Math.round(width / scale * 100) / 100,
                depth: Math.round(depth / scale * 100) / 100,
                rotation: rotation,
                type: shape.getAttr('componentType') || 'equipment'
            });
        });
        
        return equipments;
    }

    /**
     * 전체 Equipment 개수 반환
     * @returns {number}
     */
    getTotalEquipmentCount() {
        const equipmentLayer = this.layers.equipment;
        if (!equipmentLayer) return 0;
        
        const allEquipment = equipmentLayer.find('.equipment');
        return allEquipment.length;
    }

    // =====================================================
    // Wall 데이터 추출
    // =====================================================

    /**
     * Wall 데이터 추출
     * @returns {Array}
     */
    extractWalls() {
        const walls = [];
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        this.wallShapes.forEach((line, id) => {
            const points = line.points();
            
            if (points && points.length >= 4) {
                walls.push({
                    id: id,
                    start: {
                        x: Math.round((points[0] - centerX) / scale * 100) / 100,
                        z: Math.round((points[1] - centerY) / scale * 100) / 100
                    },
                    end: {
                        x: Math.round((points[2] - centerX) / scale * 100) / 100,
                        z: Math.round((points[3] - centerY) / scale * 100) / 100
                    },
                    thickness: Math.round(line.strokeWidth() / scale * 100) / 100,
                    color: line.stroke(),
                    height: line.getAttr('wallHeight') || 3
                });
            }
        });
        
        return walls;
    }

    // =====================================================
    // Office 데이터 추출
    // =====================================================

    /**
     * Office 데이터 추출
     * @returns {Object|null}
     */
    extractOffice() {
        const roomLayer = this.layers.room;
        if (!roomLayer) return null;
        
        const officeGroup = roomLayer.findOne('.office');
        
        if (!officeGroup) return null;
        
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        let width, depth;
        
        // Group인 경우
        if (officeGroup.findOne) {
            const rect = officeGroup.findOne('.officeRect');
            width = rect ? rect.width() : officeGroup.width();
            depth = rect ? rect.height() : officeGroup.height();
        } else {
            width = officeGroup.width();
            depth = officeGroup.height();
        }
        
        return {
            position: {
                x: Math.round((officeGroup.x() + width / 2 - centerX) / scale * 100) / 100,
                z: Math.round((officeGroup.y() + depth / 2 - centerY) / scale * 100) / 100
            },
            width: Math.round(width / scale * 100) / 100,
            depth: Math.round(depth / scale * 100) / 100,
            hasEntrance: officeGroup.getAttr('hasEntrance') || false,
            entranceWidth: officeGroup.getAttr('entranceWidth') || 4
        };
    }

    // =====================================================
    // Component 데이터 추출
    // =====================================================

    /**
     * Component 데이터 추출 (Partition, Desk, Pillar 등)
     * @returns {Array}
     */
    extractComponents() {
        const components = [];
        const scale = this.config.scale;
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        
        this.componentShapes.forEach((shape, id) => {
            const componentType = shape.getAttr('componentType');
            const componentData = shape.getAttr('componentData') || {};
            
            let x, y, width, height;
            
            // ✅ v1.0.1: shape 타입 안전 확인
            const shapeClassName = shape.className || shape.getClassName?.() || '';
            
            if (shapeClassName === 'Line') {
                // Line 타입 (Partition 등)
                const points = shape.points();
                if (points && points.length >= 4) {
                    components.push({
                        id: id,
                        type: componentType || 'partition',
                        start: {
                            x: Math.round((points[0] - centerX) / scale * 100) / 100,
                            z: Math.round((points[1] - centerY) / scale * 100) / 100
                        },
                        end: {
                            x: Math.round((points[2] - centerX) / scale * 100) / 100,
                            z: Math.round((points[3] - centerY) / scale * 100) / 100
                        },
                        thickness: Math.round((shape.strokeWidth?.() || 5) / scale * 100) / 100,
                        color: shape.stroke?.() || '#888888',
                        ...componentData
                    });
                }
            } else if (shapeClassName === 'Group') {
                // ✅ v1.0.1: Group 타입 처리
                x = shape.x?.() || 0;
                y = shape.y?.() || 0;
                
                // Group 내부의 Rect 찾기
                const innerRect = shape.findOne?.('Rect') || shape.findOne?.('.equipmentRect');
                if (innerRect) {
                    width = innerRect.width?.() || 0;
                    height = innerRect.height?.() || 0;
                } else {
                    // getClientRect로 크기 추정
                    const clientRect = shape.getClientRect?.({ skipTransform: true }) || {};
                    width = clientRect.width || 100;
                    height = clientRect.height || 100;
                }
                
                components.push({
                    id: id,
                    type: componentType || 'component',
                    position: {
                        x: Math.round((x + width / 2 - centerX) / scale * 100) / 100,
                        z: Math.round((y + height / 2 - centerY) / scale * 100) / 100
                    },
                    width: Math.round(width / scale * 100) / 100,
                    depth: Math.round(height / scale * 100) / 100,
                    rotation: shape.rotation?.() || 0,
                    color: shape.getAttr?.('fill') || innerRect?.fill?.() || null,
                    ...componentData
                });
            } else {
                // Rect 타입 (Desk, Pillar 등)
                x = shape.x?.() || 0;
                y = shape.y?.() || 0;
                width = shape.width?.() || 0;
                height = shape.height?.() || 0;
                
                components.push({
                    id: id,
                    type: componentType || 'unknown',
                    position: {
                        x: Math.round((x + width / 2 - centerX) / scale * 100) / 100,
                        z: Math.round((y + height / 2 - centerY) / scale * 100) / 100
                    },
                    width: Math.round(width / scale * 100) / 100,
                    depth: Math.round(height / scale * 100) / 100,
                    rotation: shape.rotation?.() || 0,
                    color: typeof shape.fill === 'function' ? shape.fill() : (shape.getAttr?.('fill') || null),
                    ...componentData
                });
            }
        });
        
        return components;
    }

    // =====================================================
    // 유틸리티
    // =====================================================

    /**
     * Maps 참조 업데이트
     */
    updateMaps() {
        this.equipmentShapes = this.layerManager.getEquipmentMap();
        this.wallShapes = this.layerManager.getWallMap();
        this.componentShapes = this.layerManager.getComponentMap();
        this.layers = this.layerManager.getAllLayers();
    }

    /**
     * Config 업데이트
     * @param {Object} newConfig - 새 설정
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * 정리
     */
    destroy() {
        this.layerManager = null;
        this.config = null;
        this.equipmentShapes = null;
        this.wallShapes = null;
        this.componentShapes = null;
        this.layers = null;
        
        console.log('[LayoutExporter] 파괴 완료');
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.LayoutExporter = LayoutExporter;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutExporter;
}