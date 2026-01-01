/**
 * LayoutValidator.js
 * ===================
 * 
 * Layout 데이터의 유효성을 검증하는 메인 클래스
 * 
 * 주요 기능:
 * 1. 필수 항목 검증 (checkRequired)
 * 2. 데이터 타입 검증 (checkTypes)
 * 3. 범위 검증 (checkBounds)
 * 4. 충돌 검증 (checkCollisions)
 * 5. 복도 검증 (checkCorridors)
 * 6. 3D 변환 가능성 검증 (check3DConvertibility)
 * 
 * 위치: frontend/threejs_viewer/src/services/validation/LayoutValidator.js
 */

import { ValidationRules, ERROR_TYPES, SEVERITY } from './ValidationRules.js';
import { ErrorReporter } from './ErrorReporter.js';

export class LayoutValidator {
    constructor() {
        this.reporter = null;
        this.layoutData = null;
        this.scale = 10;  // 기본 scale (1m = 10px)
        
        console.log('[LayoutValidator] 초기화 완료');
    }
    
    /**
     * 전체 검증 실행 (메인 진입점)
     * @param {Object} layoutData - Layout JSON 데이터
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2DEditor 인스턴스 (선택)
     * @returns {Object} { valid: boolean, errors: Array, stats: Object }
     */
    validate(layoutData, canvas2DEditor = null) {
        console.log('[LayoutValidator] 검증 시작...');
        
        // ErrorReporter 초기화
        this.reporter = new ErrorReporter();
        
        // Canvas2DEditor에서 데이터 추출 (있는 경우)
        if (canvas2DEditor) {
            this.layoutData = this.extractFromCanvas(canvas2DEditor);
            this.scale = canvas2DEditor.config?.scale || 10;
        } else if (layoutData) {
            this.layoutData = layoutData;
        } else {
            this.reporter.addError(ERROR_TYPES.ROOM_MISSING, {
                severity: SEVERITY.ERROR
            });
            return this.reporter.toJSON();
        }
        
        console.log('[LayoutValidator] 검증 대상 데이터:', this.layoutData);
        
        // 1. 필수 항목 검증
        this.checkRequired();
        
        // 필수 항목 에러가 있으면 이후 검증 스킵 (데이터 없음)
        if (this.reporter.hasErrors()) {
            console.log('[LayoutValidator] 필수 항목 에러 발견, 추가 검증 스킵');
            this.reporter.printErrors();
            return this.reporter.toJSON();
        }
        
        // 2. 데이터 타입 검증
        this.checkTypes();
        
        // 3. 범위 검증 (설비가 Room 안에 있는지)
        this.checkBounds();
        
        // 4. 충돌 검증 (설비끼리, 벽과 객체)
        this.checkCollisions();
        
        // 5. 복도 검증
        this.checkCorridors();
        
        // 6. 3D 변환 가능성 검증
        this.check3DConvertibility();
        
        // 결과 출력
        this.reporter.printErrors();
        
        const result = this.reporter.toJSON();
        console.log('[LayoutValidator] 검증 완료:', result.valid ? '✅ 통과' : '❌ 실패');
        
        return result;
    }
    
    /**
     * 간단 검증 (3D Preview용)
     * @param {Object} layoutData - Layout 데이터
     * @returns {Object} { valid: boolean, errors: Array }
     */
    quickValidate(layoutData) {
        console.log('[LayoutValidator] Quick 검증 시작...');
        
        this.reporter = new ErrorReporter();
        this.layoutData = layoutData;
        
        // 필수 항목만 검증
        this.checkRequired();
        
        return this.reporter.toJSON();
    }
    
    /**
     * Canvas2DEditor에서 Layout 데이터 추출
     * @param {Canvas2DEditor} canvas - Canvas2DEditor 인스턴스
     * @returns {Object} Layout 데이터
     */
    extractFromCanvas(canvas) {
        console.log('[LayoutValidator] Canvas에서 데이터 추출...');
        
        const scale = canvas.config?.scale || 10;
        const data = {
            site_id: canvas.currentLayout?.site_id || null,
            room: this.extractRoomData(canvas),
            walls: this.extractWallsData(canvas, scale),
            equipmentArrays: this.extractEquipmentData(canvas, scale),
            components: this.extractComponentsData(canvas, scale)
        };
        
        console.log('[LayoutValidator] 추출된 데이터:', data);
        return data;
    }
    
    /**
     * Room 데이터 추출
     */
    extractRoomData(canvas) {
        // currentLayout에서 room 정보 가져오기
        if (canvas.currentLayout?.room) {
            return canvas.currentLayout.room;
        }
        
        // roomLayer에서 Room 경계 찾기
        const roomBoundary = canvas.layers?.room?.findOne('.room_boundary');
        if (roomBoundary) {
            const scale = canvas.config?.scale || 10;
            return {
                width: roomBoundary.width() / scale,
                depth: roomBoundary.height() / scale
            };
        }
        
        return null;
    }
    
    /**
     * Wall 데이터 추출
     */
    extractWallsData(canvas, scale) {
        const walls = [];
        
        canvas.wallShapes?.forEach((wall, id) => {
            const points = wall.points?.() || [];
            walls.push({
                id: id,
                type: wall.getAttr('wallType') || 'unknown',
                points: points,
                thickness: wall.getAttr('wallThickness') || 0.2,
                height: wall.getAttr('wallHeight') || 3,
                // 실제 좌표로 변환
                startX: points[0] / scale,
                startY: points[1] / scale,
                endX: points[2] / scale,
                endY: points[3] / scale
            });
        });
        
        return walls;
    }
    
    /**
     * Equipment 데이터 추출
     */
    extractEquipmentData(canvas, scale) {
        const equipments = [];
        
        canvas.equipmentShapes?.forEach((eq, id) => {
            equipments.push({
                id: id,
                x: eq.x() / scale,
                y: eq.y() / scale,
                width: eq.width() / scale,
                depth: eq.height() / scale,
                name: eq.getAttr('equipmentName') || id
            });
        });
        
        // 배열 형태로 반환 (기존 구조 호환)
        if (equipments.length > 0) {
            return [{
                id: 'main-array',
                equipments: equipments
            }];
        }
        
        return [];
    }
    
    /**
     * Component 데이터 추출
     */
    extractComponentsData(canvas, scale) {
        const components = [];
        
        canvas.componentShapes?.forEach((comp, id) => {
            components.push({
                id: id,
                type: comp.getAttr('componentType') || comp.name(),
                x: comp.x() / scale,
                y: comp.y() / scale,
                width: comp.width() / scale,
                depth: comp.height() / scale
            });
        });
        
        return components;
    }
    
    // =====================================================
    // 검증 메서드들
    // =====================================================
    
    /**
     * 1. 필수 항목 검증
     */
    checkRequired() {
        console.log('[LayoutValidator] 필수 항목 검증...');
        
        const data = this.layoutData;
        
        // Site ID 검증
        if (!data.site_id) {
            this.reporter.addError(ERROR_TYPES.SITE_ID_MISSING, {
                severity: SEVERITY.ERROR
            });
        }
        
        // Room 검증
        if (!data.room) {
            this.reporter.addError(ERROR_TYPES.ROOM_MISSING, {
                severity: SEVERITY.ERROR
            });
        } else {
            // Room 크기 검증
            const { width, depth } = data.room;
            
            if (!width || !depth || width <= 0 || depth <= 0) {
                this.reporter.addError(ERROR_TYPES.ROOM_INVALID_DIMENSIONS, {
                    severity: SEVERITY.ERROR
                });
            } else if (width < ValidationRules.ROOM.MIN_WIDTH || 
                       depth < ValidationRules.ROOM.MIN_DEPTH) {
                this.reporter.addError(ERROR_TYPES.ROOM_SIZE_TOO_SMALL, {
                    severity: SEVERITY.ERROR,
                    params: { width, depth }
                });
            } else if (width > ValidationRules.ROOM.MAX_WIDTH || 
                       depth > ValidationRules.ROOM.MAX_DEPTH) {
                this.reporter.addError(ERROR_TYPES.ROOM_SIZE_TOO_LARGE, {
                    severity: SEVERITY.ERROR,
                    params: { width, depth }
                });
            }
        }
        
        // Walls 검증
        if (!data.walls || !Array.isArray(data.walls)) {
            this.reporter.addError(ERROR_TYPES.WALL_MISSING, {
                severity: SEVERITY.ERROR
            });
        } else if (data.walls.length < ValidationRules.WALL.MIN_COUNT) {
            this.reporter.addError(ERROR_TYPES.WALL_COUNT_INSUFFICIENT, {
                severity: SEVERITY.ERROR,
                params: { count: data.walls.length }
            });
        }
        
        // Equipment Arrays 검증
        if (!data.equipmentArrays || !Array.isArray(data.equipmentArrays)) {
            this.reporter.addError(ERROR_TYPES.EQUIPMENT_ARRAY_MISSING, {
                severity: SEVERITY.ERROR
            });
        } else if (data.equipmentArrays.length < ValidationRules.EQUIPMENT.MIN_ARRAYS) {
            this.reporter.addError(ERROR_TYPES.EQUIPMENT_ARRAY_MISSING, {
                severity: SEVERITY.ERROR
            });
        }
    }
    
    /**
     * 2. 데이터 타입 검증
     */
    checkTypes() {
        console.log('[LayoutValidator] 데이터 타입 검증...');
        
        const data = this.layoutData;
        
        // Room 타입 검증
        if (data.room) {
            if (typeof data.room.width !== 'number') {
                this.reporter.addError(ERROR_TYPES.INVALID_TYPE_ROOM_WIDTH, {
                    severity: SEVERITY.ERROR
                });
            }
            if (typeof data.room.depth !== 'number') {
                this.reporter.addError(ERROR_TYPES.INVALID_TYPE_ROOM_DEPTH, {
                    severity: SEVERITY.ERROR
                });
            }
        }
        
        // Walls 타입 검증
        if (data.walls && !Array.isArray(data.walls)) {
            this.reporter.addError(ERROR_TYPES.INVALID_TYPE_WALLS, {
                severity: SEVERITY.ERROR
            });
        }
        
        // Equipment Arrays 타입 검증
        if (data.equipmentArrays && !Array.isArray(data.equipmentArrays)) {
            this.reporter.addError(ERROR_TYPES.INVALID_TYPE_EQUIPMENT_ARRAYS, {
                severity: SEVERITY.ERROR
            });
        }
    }
    
    /**
     * 3. 범위 검증 (설비가 Room 안에 있는지)
     */
    checkBounds() {
        console.log('[LayoutValidator] 범위 검증...');
        
        const data = this.layoutData;
        
        if (!data.room || !data.equipmentArrays) return;
        
        const roomWidth = data.room.width;
        const roomDepth = data.room.depth;
        const margin = ValidationRules.BOUNDARY.MIN_MARGIN;
        
        // 각 설비 배열 검사
        data.equipmentArrays.forEach(array => {
            const equipments = array.equipments || [];
            
            equipments.forEach(eq => {
                const eqRight = eq.x + eq.width;
                const eqBottom = eq.y + eq.depth;
                
                // Room 경계 체크
                if (eq.x < margin || 
                    eq.y < margin || 
                    eqRight > roomWidth - margin || 
                    eqBottom > roomDepth - margin) {
                    
                    this.reporter.addError(ERROR_TYPES.EQUIPMENT_OUT_OF_BOUNDS, {
                        severity: SEVERITY.ERROR,
                        equipmentId: eq.id,
                        position: { x: eq.x, y: eq.y }
                    });
                }
                
                // 경계 근처 경고
                const nearMargin = margin * 2;
                if ((eq.x < nearMargin || eqRight > roomWidth - nearMargin) &&
                    !this.reporter.getByEquipmentId(eq.id).length) {
                    this.reporter.addError(ERROR_TYPES.EQUIPMENT_NEAR_BOUNDARY, {
                        severity: SEVERITY.WARNING,
                        equipmentId: eq.id,
                        position: { x: eq.x, y: eq.y }
                    });
                }
            });
        });
    }
    
    /**
     * 4. 충돌 검증
     */
    checkCollisions() {
        console.log('[LayoutValidator] 충돌 검증...');
        
        const data = this.layoutData;
        
        if (!data.equipmentArrays) return;
        
        // 모든 설비 수집
        const allEquipments = [];
        data.equipmentArrays.forEach(array => {
            const equipments = array.equipments || [];
            allEquipments.push(...equipments);
        });
        
        // 설비 간 충돌 검사
        for (let i = 0; i < allEquipments.length; i++) {
            for (let j = i + 1; j < allEquipments.length; j++) {
                const eq1 = allEquipments[i];
                const eq2 = allEquipments[j];
                
                if (this.checkRectCollision(eq1, eq2)) {
                    this.reporter.addError(ERROR_TYPES.EQUIPMENT_COLLISION, {
                        severity: SEVERITY.ERROR,
                        equipmentId1: eq1.id,
                        equipmentId2: eq2.id,
                        position: { x: eq1.x, y: eq1.y }
                    });
                }
            }
        }
        
        // 벽과 설비 충돌 검사
        if (data.walls) {
            allEquipments.forEach(eq => {
                data.walls.forEach(wall => {
                    if (this.checkWallEquipmentCollision(wall, eq)) {
                        this.reporter.addError(ERROR_TYPES.EQUIPMENT_WALL_COLLISION, {
                            severity: SEVERITY.ERROR,
                            equipmentId: eq.id,
                            wallId: wall.id,
                            position: { x: eq.x, y: eq.y }
                        });
                    }
                });
            });
        }
    }
    
    /**
     * 사각형 충돌 검사
     */
    checkRectCollision(rect1, rect2) {
        const gap = ValidationRules.EQUIPMENT.MIN_SPACING;
        
        return !(rect1.x + rect1.width + gap <= rect2.x ||
                 rect2.x + rect2.width + gap <= rect1.x ||
                 rect1.y + rect1.depth + gap <= rect2.y ||
                 rect2.y + rect2.depth + gap <= rect1.y);
    }
    
    /**
     * 벽과 설비 충돌 검사
     */
    checkWallEquipmentCollision(wall, equipment) {
        if (!wall.startX || !wall.startY || !wall.endX || !wall.endY) {
            return false;
        }
        
        const margin = ValidationRules.BOUNDARY.WALL_COLLISION_MARGIN;
        const thickness = wall.thickness || 0.2;
        
        // 벽을 사각형으로 변환
        const wallRect = {
            x: Math.min(wall.startX, wall.endX) - thickness / 2 - margin,
            y: Math.min(wall.startY, wall.endY) - thickness / 2 - margin,
            width: Math.abs(wall.endX - wall.startX) + thickness + margin * 2,
            depth: Math.abs(wall.endY - wall.startY) + thickness + margin * 2
        };
        
        return this.checkRectCollision(wallRect, equipment);
    }
    
    /**
     * 5. 복도 검증
     */
    checkCorridors() {
        console.log('[LayoutValidator] 복도 검증...');
        
        const data = this.layoutData;
        
        // currentLayout에 corridors 정보가 있는 경우
        if (data.corridors && Array.isArray(data.corridors)) {
            data.corridors.forEach(corridor => {
                if (corridor.width < ValidationRules.CORRIDOR.MIN_WIDTH) {
                    this.reporter.addError(ERROR_TYPES.CORRIDOR_TOO_NARROW, {
                        severity: SEVERITY.ERROR,
                        location: corridor.location || `${corridor.type} corridor`,
                        params: {
                            current: corridor.width,
                            required: ValidationRules.CORRIDOR.MIN_WIDTH
                        }
                    });
                } else if (corridor.width < ValidationRules.CORRIDOR.RECOMMENDED_WIDTH) {
                    this.reporter.addError(ERROR_TYPES.CORRIDOR_BELOW_RECOMMENDED, {
                        severity: SEVERITY.WARNING,
                        location: corridor.location || `${corridor.type} corridor`,
                        params: {
                            current: corridor.width,
                            required: ValidationRules.CORRIDOR.RECOMMENDED_WIDTH
                        }
                    });
                }
            });
        }
        
        // equipmentArrays에서 복도 정보 추출 (있는 경우)
        if (data.equipmentArrays) {
            data.equipmentArrays.forEach(array => {
                if (array.corridorSpacing) {
                    Object.entries(array.corridorSpacing).forEach(([location, width]) => {
                        if (width < ValidationRules.CORRIDOR.MIN_WIDTH) {
                            this.reporter.addError(ERROR_TYPES.CORRIDOR_TOO_NARROW, {
                                severity: SEVERITY.ERROR,
                                location: location,
                                params: {
                                    current: width,
                                    required: ValidationRules.CORRIDOR.MIN_WIDTH
                                }
                            });
                        }
                    });
                }
            });
        }
    }
    
    /**
     * 6. 3D 변환 가능성 검증
     */
    check3DConvertibility() {
        console.log('[LayoutValidator] 3D 변환 가능성 검증...');
        
        const data = this.layoutData;
        
        if (!data.equipmentArrays) return;
        
        data.equipmentArrays.forEach(array => {
            // 설비 크기 검증
            const equipments = array.equipments || [];
            
            equipments.forEach(eq => {
                if (!eq.width || eq.width <= 0) {
                    this.reporter.addError(ERROR_TYPES.EQUIPMENT_WIDTH_INVALID, {
                        severity: SEVERITY.ERROR,
                        equipmentId: eq.id
                    });
                }
                
                if (!eq.depth || eq.depth <= 0) {
                    this.reporter.addError(ERROR_TYPES.EQUIPMENT_DEPTH_INVALID, {
                        severity: SEVERITY.ERROR,
                        equipmentId: eq.id
                    });
                }
            });
            
            // excludedPositions 검증
            if (array.rows && array.cols && array.excludedPositions) {
                const maxRow = array.rows;
                const maxCol = array.cols;
                
                array.excludedPositions.forEach(pos => {
                    if (pos.row < 0 || pos.row >= maxRow ||
                        pos.col < 0 || pos.col >= maxCol) {
                        this.reporter.addError(ERROR_TYPES.EXCLUDED_POSITION_OUT_OF_RANGE, {
                            severity: SEVERITY.WARNING,
                            params: {
                                row: pos.row,
                                col: pos.col,
                                maxRow,
                                maxCol
                            }
                        });
                    }
                });
            }
        });
    }
    
    /**
     * 자동 수정 시도
     * @returns {Object} 수정된 Layout 데이터
     */
    autoFix() {
        console.log('[LayoutValidator] 자동 수정 시도...');
        
        // TODO: Phase 4에서 구현
        // - 겹치는 설비 자동 배치
        // - Room 크기 자동 조정
        // - 복도 폭 자동 조정
        
        return this.layoutData;
    }
}

// Default export
export default LayoutValidator;