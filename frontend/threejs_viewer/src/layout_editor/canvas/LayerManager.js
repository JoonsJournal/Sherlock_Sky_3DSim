/**
 * LayerManager.js
 * ================
 * 
 * Canvas2DEditor에서 분리된 레이어 관리 모듈
 * Konva.Layer 생성/관리 및 Shape 저장소(Map) 관리
 * 
 * @version 1.0.0 - Phase 1.5
 * @module LayerManager
 * 
 * 역할:
 * 1. 4개 레이어 생성 및 관리 (background, room, equipment, ui)
 * 2. Equipment, Wall, Component Shape 저장소 관리
 * 3. 레이어별 렌더링 제어
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/canvas/LayerManager.js
 */

class LayerManager {
    /**
     * @param {Konva.Stage} stage - Konva Stage 인스턴스
     */
    constructor(stage) {
        if (!stage) {
            throw new Error('[LayerManager] Konva.Stage 인스턴스가 필요합니다');
        }
        
        this.stage = stage;
        
        // 레이어 저장소
        this.layers = {
            background: null,
            room: null,
            equipment: null,
            ui: null
        };
        
        // Shape 저장소 (Map)
        this.equipmentShapes = new Map();
        this.wallShapes = new Map();
        this.componentShapes = new Map();
        
        console.log('[LayerManager] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // 레이어 관리
    // =====================================================
    
    /**
     * 4개 레이어 생성 및 Stage에 추가
     */
    createLayers() {
        // Background 레이어 (그리드, 이벤트 수신 안함)
        this.layers.background = new Konva.Layer({ 
            listening: false,
            name: 'background'
        });
        
        // Room 레이어 (벽, 오피스, 파티션)
        this.layers.room = new Konva.Layer({
            name: 'room'
        });
        
        // Equipment 레이어 (설비)
        this.layers.equipment = new Konva.Layer({
            name: 'equipment'
        });
        
        // UI 레이어 (선택 박스, Transformer, 좌표 표시 등)
        this.layers.ui = new Konva.Layer({
            name: 'ui'
        });
        
        // Stage에 순서대로 추가 (아래 → 위)
        this.stage.add(this.layers.background);
        this.stage.add(this.layers.room);
        this.stage.add(this.layers.equipment);
        this.stage.add(this.layers.ui);
        
        console.log('[LayerManager] 4개 레이어 생성 완료');
        
        return this.layers;
    }
    
    /**
     * 레이어 가져오기
     * @param {string} name - 레이어 이름 ('background' | 'room' | 'equipment' | 'ui')
     * @returns {Konva.Layer|null}
     */
    getLayer(name) {
        return this.layers[name] || null;
    }
    
    /**
     * 모든 레이어 반환
     * @returns {Object}
     */
    getAllLayers() {
        return this.layers;
    }
    
    /**
     * 특정 레이어 내용 지우기
     * @param {string} layerName - 레이어 이름
     */
    clearLayer(layerName) {
        const layer = this.layers[layerName];
        if (layer) {
            layer.destroyChildren();
            layer.batchDraw();
            console.log(`[LayerManager] ${layerName} 레이어 클리어`);
        }
    }
    
    /**
     * 모든 레이어 내용 지우기 (background 제외)
     */
    clearAllLayers() {
        this.layers.room.destroyChildren();
        this.layers.equipment.destroyChildren();
        this.layers.ui.destroyChildren();
        
        this.layers.room.batchDraw();
        this.layers.equipment.batchDraw();
        this.layers.ui.batchDraw();
        
        console.log('[LayerManager] 모든 레이어 클리어 (background 제외)');
    }
    
    /**
     * 모든 레이어 다시 그리기
     */
    batchDrawAll() {
        Object.values(this.layers).forEach(layer => {
            if (layer) {
                layer.batchDraw();
            }
        });
    }
    
    // =====================================================
    // Equipment Shape 관리
    // =====================================================
    
    /**
     * Equipment Shape 추가
     * @param {string} id - Equipment ID
     * @param {Konva.Shape|Konva.Group} shape - Shape 객체
     */
    addEquipment(id, shape) {
        this.equipmentShapes.set(id, shape);
        console.log(`[LayerManager] Equipment 추가: ${id}`);
    }
    
    /**
     * Equipment Shape 가져오기
     * @param {string} id - Equipment ID
     * @returns {Konva.Shape|Konva.Group|undefined}
     */
    getEquipment(id) {
        return this.equipmentShapes.get(id);
    }
    
    /**
     * Equipment Shape 제거
     * @param {string} id - Equipment ID
     * @returns {boolean} 삭제 성공 여부
     */
    removeEquipment(id) {
        const shape = this.equipmentShapes.get(id);
        if (shape) {
            shape.destroy();
            this.equipmentShapes.delete(id);
            console.log(`[LayerManager] Equipment 제거: ${id}`);
            return true;
        }
        return false;
    }
    
    /**
     * 모든 Equipment ID 목록
     * @returns {Array<string>}
     */
    getEquipmentIds() {
        return Array.from(this.equipmentShapes.keys());
    }
    
    /**
     * Equipment Map 반환
     * @returns {Map}
     */
    getEquipmentMap() {
        return this.equipmentShapes;
    }
    
    // =====================================================
    // Wall Shape 관리
    // =====================================================
    
    /**
     * Wall Shape 추가
     * @param {string} id - Wall ID
     * @param {Konva.Line} shape - Line 객체
     */
    addWall(id, shape) {
        this.wallShapes.set(id, shape);
        console.log(`[LayerManager] Wall 추가: ${id}`);
    }
    
    /**
     * Wall Shape 가져오기
     * @param {string} id - Wall ID
     * @returns {Konva.Line|undefined}
     */
    getWall(id) {
        return this.wallShapes.get(id);
    }
    
    /**
     * Wall Shape 제거
     * @param {string} id - Wall ID
     * @returns {boolean} 삭제 성공 여부
     */
    removeWall(id) {
        const shape = this.wallShapes.get(id);
        if (shape) {
            shape.destroy();
            this.wallShapes.delete(id);
            console.log(`[LayerManager] Wall 제거: ${id}`);
            return true;
        }
        return false;
    }
    
    /**
     * 모든 Wall ID 목록
     * @returns {Array<string>}
     */
    getWallIds() {
        return Array.from(this.wallShapes.keys());
    }
    
    /**
     * Wall Map 반환
     * @returns {Map}
     */
    getWallMap() {
        return this.wallShapes;
    }
    
    // =====================================================
    // Component Shape 관리 (Partition, Desk, Pillar 등)
    // =====================================================
    
    /**
     * Component Shape 추가
     * @param {string} id - Component ID
     * @param {Konva.Shape} shape - Shape 객체
     */
    addComponent(id, shape) {
        this.componentShapes.set(id, shape);
        console.log(`[LayerManager] Component 추가: ${id}`);
    }
    
    /**
     * Component Shape 가져오기
     * @param {string} id - Component ID
     * @returns {Konva.Shape|undefined}
     */
    getComponent(id) {
        return this.componentShapes.get(id);
    }
    
    /**
     * Component Shape 제거
     * @param {string} id - Component ID
     * @returns {boolean} 삭제 성공 여부
     */
    removeComponent(id) {
        const shape = this.componentShapes.get(id);
        if (shape) {
            shape.destroy();
            this.componentShapes.delete(id);
            console.log(`[LayerManager] Component 제거: ${id}`);
            return true;
        }
        return false;
    }
    
    /**
     * 모든 Component ID 목록
     * @returns {Array<string>}
     */
    getComponentIds() {
        return Array.from(this.componentShapes.keys());
    }
    
    /**
     * Component Map 반환
     * @returns {Map}
     */
    getComponentMap() {
        return this.componentShapes;
    }
    
    // =====================================================
    // 통합 Shape 관리
    // =====================================================
    
    /**
     * ID로 Shape 찾기 (모든 Map에서 검색)
     * @param {string} id - Shape ID
     * @returns {Object|null} { shape, type }
     */
    findShapeById(id) {
        if (this.equipmentShapes.has(id)) {
            return { shape: this.equipmentShapes.get(id), type: 'equipment' };
        }
        if (this.wallShapes.has(id)) {
            return { shape: this.wallShapes.get(id), type: 'wall' };
        }
        if (this.componentShapes.has(id)) {
            return { shape: this.componentShapes.get(id), type: 'component' };
        }
        return null;
    }
    
    /**
     * Shape 제거 (타입 자동 감지)
     * @param {string} id - Shape ID
     * @returns {boolean}
     */
    removeShape(id) {
        if (this.equipmentShapes.has(id)) {
            return this.removeEquipment(id);
        }
        if (this.wallShapes.has(id)) {
            return this.removeWall(id);
        }
        if (this.componentShapes.has(id)) {
            return this.removeComponent(id);
        }
        return false;
    }
    
    /**
     * 전체 객체 수 가져오기
     * @returns {Object} { equipments, walls, components, total }
     */
    getObjectCount() {
        const equipments = this.equipmentShapes.size;
        const walls = this.wallShapes.size;
        const components = this.componentShapes.size;
        
        return {
            equipments,
            walls,
            components,
            total: equipments + walls + components
        };
    }
    
    /**
     * 모든 Shape Map 초기화
     */
    clearAllShapes() {
        // Shape destroy는 clearAllLayers에서 처리됨
        this.equipmentShapes.clear();
        this.wallShapes.clear();
        this.componentShapes.clear();
        
        console.log('[LayerManager] 모든 Shape Map 초기화');
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 전체 정리 및 파괴
     */
    destroy() {
        // 레이어 정리
        Object.values(this.layers).forEach(layer => {
            if (layer) {
                layer.destroyChildren();
                layer.destroy();
            }
        });
        
        // Map 정리
        this.clearAllShapes();
        
        // 참조 정리
        this.layers = {
            background: null,
            room: null,
            equipment: null,
            ui: null
        };
        
        this.stage = null;
        
        console.log('[LayerManager] 파괴 완료');
    }
}

// ✅ ES6 모듈 export (브라우저 환경)
if (typeof module === 'undefined') {
    window.LayerManager = LayerManager;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayerManager;
}

export { LayerManager };