/**
 * CoordinateUtils.js
 * 2D Canvas 좌표 ↔ 3D World 좌표 변환 유틸리티
 * 
 * @version 1.0.0 - Phase 4.1
 * 
 * 좌표 시스템:
 * - 2D Canvas: 픽셀 단위, 좌상단 원점 (0,0), Y축 아래로 증가
 * - 3D World: 미터 단위, 중앙 원점 (0,0,0), Y축 위로 증가
 * 
 * 기본 스케일: 1m = 10px
 */

export class CoordinateUtils {
    /**
     * @param {number} scale - 스케일 (1m = Npx), 기본값 10
     * @param {Object} canvasSize - Canvas 크기 { width, height }
     * @param {Object} roomSize - Room 크기 { width, depth } (미터)
     */
    constructor(scale = 10, canvasSize = { width: 1200, height: 800 }, roomSize = { width: 40, depth: 60 }) {
        this.scale = scale;
        this.canvasSize = canvasSize;
        this.roomSize = roomSize;
        
        // Canvas 중심점 (픽셀)
        this.canvasCenter = {
            x: canvasSize.width / 2,
            y: canvasSize.height / 2
        };
        
        console.log('[CoordinateUtils] ✅ 초기화 완료', {
            scale: this.scale,
            canvasSize: this.canvasSize,
            roomSize: this.roomSize,
            canvasCenter: this.canvasCenter
        });
    }
    
    /**
     * 설정 업데이트
     * @param {Object} options - { scale, canvasSize, roomSize }
     */
    updateSettings(options = {}) {
        if (options.scale) this.scale = options.scale;
        if (options.canvasSize) {
            this.canvasSize = options.canvasSize;
            this.canvasCenter = {
                x: this.canvasSize.width / 2,
                y: this.canvasSize.height / 2
            };
        }
        if (options.roomSize) this.roomSize = options.roomSize;
        
        console.log('[CoordinateUtils] 설정 업데이트됨');
    }
    
    // =========================================================
    // 2D → 3D 변환
    // =========================================================
    
    /**
     * 2D Canvas 좌표 → 3D World 좌표 변환
     * @param {number} canvasX - Canvas X 좌표 (픽셀)
     * @param {number} canvasY - Canvas Y 좌표 (픽셀)
     * @returns {Object} { x, z } - 3D World 좌표 (미터)
     */
    canvas2DToWorld3D(canvasX, canvasY) {
        // 1. 픽셀 → 미터 변환
        const meterX = canvasX / this.scale;
        const meterY = canvasY / this.scale;
        
        // 2. Canvas 중심을 원점으로 변환
        // Canvas Y축은 아래로 증가, 3D Z축은 "앞으로" 증가
        const worldX = meterX - (this.canvasSize.width / this.scale / 2);
        const worldZ = meterY - (this.canvasSize.height / this.scale / 2);
        
        return { x: worldX, z: worldZ };
    }
    
    /**
     * 2D Canvas 크기 → 3D World 크기 변환 (스케일만 적용)
     * @param {number} canvasWidth - Canvas 너비 (픽셀)
     * @param {number} canvasHeight - Canvas 높이 (픽셀)
     * @returns {Object} { width, depth } - 3D 크기 (미터)
     */
    canvas2DSizeToWorld3D(canvasWidth, canvasHeight) {
        return {
            width: canvasWidth / this.scale,
            depth: canvasHeight / this.scale
        };
    }
    
    /**
     * 2D 사각형 → 3D 사각형 파라미터 변환
     * @param {Object} rect2D - { x, y, width, height } (픽셀)
     * @returns {Object} { x, z, width, depth } (미터)
     */
    canvas2DRectToWorld3D(rect2D) {
        const position = this.canvas2DToWorld3D(
            rect2D.x + rect2D.width / 2,  // 중심점 X
            rect2D.y + rect2D.height / 2  // 중심점 Y
        );
        
        const size = this.canvas2DSizeToWorld3D(rect2D.width, rect2D.height);
        
        return {
            x: position.x,
            z: position.z,
            width: size.width,
            depth: size.depth
        };
    }
    
    // =========================================================
    // 3D → 2D 변환 (역변환)
    // =========================================================
    
    /**
     * 3D World 좌표 → 2D Canvas 좌표 변환
     * @param {number} worldX - 3D World X 좌표 (미터)
     * @param {number} worldZ - 3D World Z 좌표 (미터)
     * @returns {Object} { x, y } - Canvas 좌표 (픽셀)
     */
    world3DToCanvas2D(worldX, worldZ) {
        // 1. 중심 기준 → Canvas 좌상단 기준
        const meterX = worldX + (this.canvasSize.width / this.scale / 2);
        const meterY = worldZ + (this.canvasSize.height / this.scale / 2);
        
        // 2. 미터 → 픽셀 변환
        const canvasX = meterX * this.scale;
        const canvasY = meterY * this.scale;
        
        return { x: canvasX, y: canvasY };
    }
    
    /**
     * 3D World 크기 → 2D Canvas 크기 변환
     * @param {number} worldWidth - 3D 너비 (미터)
     * @param {number} worldDepth - 3D 깊이 (미터)
     * @returns {Object} { width, height } - Canvas 크기 (픽셀)
     */
    world3DSizeToCanvas2D(worldWidth, worldDepth) {
        return {
            width: worldWidth * this.scale,
            height: worldDepth * this.scale
        };
    }
    
    // =========================================================
    // 벽 변환 (2D Line → 3D Box)
    // =========================================================
    
    /**
     * 2D 벽 선분 → 3D 벽 파라미터 변환
     * @param {Object} wall2D - { startX, startY, endX, endY, thickness } (픽셀)
     * @param {number} height - 벽 높이 (미터), 기본값 4
     * @returns {Object} 3D 벽 파라미터
     */
    convertWall2DTo3D(wall2D, height = 4) {
        const { startX, startY, endX, endY, thickness = 2 } = wall2D;
        
        // 시작점, 끝점 → 3D 좌표
        const start3D = this.canvas2DToWorld3D(startX, startY);
        const end3D = this.canvas2DToWorld3D(endX, endY);
        
        // 벽 방향 벡터
        const dx = end3D.x - start3D.x;
        const dz = end3D.z - start3D.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        
        // 벽 중심점
        const centerX = (start3D.x + end3D.x) / 2;
        const centerZ = (start3D.z + end3D.z) / 2;
        
        // 벽 회전 각도 (Y축 기준)
        // atan2(dx, dz)는 Z축 기준 → X축으로의 각도
        // 수평 벽 (dz=0, dx≠0): atan2(dx, 0) = ±π/2
        // 수직 벽 (dx=0, dz≠0): atan2(0, dz) = 0 또는 π
        // 
        // Three.js에서 BoxGeometry는 기본적으로 X축 방향으로 width를 가짐
        // 따라서 수평 벽(Canvas Y 일정)은 3D에서 X축 방향이므로 rotation.y = 0
        // 수직 벽(Canvas X 일정)은 3D에서 Z축 방향이므로 rotation.y = π/2
        //
        // 수정: atan2(dz, dx)로 변경하여 X축 기준 각도 계산
        const rotationY = Math.atan2(dz, dx);
        
        // 두께 변환
        const thickness3D = thickness / this.scale;
        
        return {
            position: { x: centerX, y: height / 2, z: centerZ },
            size: { width: length, height: height, depth: thickness3D },
            rotation: { y: rotationY },
            // 원본 데이터 보존
            original2D: wall2D
        };
    }
    
    // =========================================================
    // Equipment Array 변환
    // =========================================================
    
    /**
     * 2D Equipment Array → 3D CONFIG 변환
     * @param {Object} array2D - 2D Equipment Array 데이터
     * @returns {Object} 3D Equipment CONFIG
     */
    convertEquipmentArray2DTo3D(array2D) {
        const {
            rows = 26,
            cols = 6,
            equipmentSize = { width: 15, height: 20 },  // 픽셀
            spacing = { default: 1, corridorCols: [], corridorColWidth: 12, corridorRows: [], corridorRowWidth: 20 },
            excludedPositions = [],
            position = { x: 0, y: 0 }  // 배열 시작 위치 (픽셀)
        } = array2D;
        
        // 크기 변환 (픽셀 → 미터)
        const size3D = {
            WIDTH: equipmentSize.width / this.scale,
            HEIGHT: 2.2,  // 높이는 고정 (3D 전용)
            DEPTH: equipmentSize.height / this.scale
        };
        
        // 간격 변환
        const spacing3D = {
            DEFAULT: spacing.default / this.scale,
            CORRIDOR_COLS: spacing.corridorCols || [],
            CORRIDOR_COL_WIDTH: spacing.corridorColWidth / this.scale,
            CORRIDOR_ROWS: spacing.corridorRows || [],
            CORRIDOR_ROW_WIDTH: spacing.corridorRowWidth / this.scale
        };
        
        // 배열 시작 위치 변환
        const startPosition3D = this.canvas2DToWorld3D(position.x, position.y);
        
        return {
            ROWS: rows,
            COLS: cols,
            SIZE: size3D,
            SPACING: spacing3D,
            EXCLUDED_POSITIONS: excludedPositions,
            START_POSITION: startPosition3D
        };
    }
    
    // =========================================================
    // 유틸리티
    // =========================================================
    
    /**
     * 소수점 반올림 (정밀도 조정)
     * @param {number} value - 값
     * @param {number} decimals - 소수점 자릿수
     * @returns {number}
     */
    round(value, decimals = 2) {
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
    
    /**
     * 범위 유효성 검증
     * @param {number} worldX - 3D X 좌표
     * @param {number} worldZ - 3D Z 좌표
     * @returns {boolean} Room 범위 내 여부
     */
    isWithinRoom(worldX, worldZ) {
        const halfWidth = this.roomSize.width / 2;
        const halfDepth = this.roomSize.depth / 2;
        
        return (
            worldX >= -halfWidth && worldX <= halfWidth &&
            worldZ >= -halfDepth && worldZ <= halfDepth
        );
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.log('[CoordinateUtils] Debug Info:', {
            scale: this.scale,
            canvasSize: this.canvasSize,
            roomSize: this.roomSize,
            canvasCenter: this.canvasCenter,
            roomBounds: {
                x: [-this.roomSize.width / 2, this.roomSize.width / 2],
                z: [-this.roomSize.depth / 2, this.roomSize.depth / 2]
            }
        });
    }
}

// 기본 인스턴스 생성
export const coordinateUtils = new CoordinateUtils();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.CoordinateUtils = CoordinateUtils;
    window.coordinateUtils = coordinateUtils;
}