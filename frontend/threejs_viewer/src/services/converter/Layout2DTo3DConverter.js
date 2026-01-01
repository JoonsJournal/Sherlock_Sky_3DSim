/**
 * Layout2DTo3DConverter.js
 * Layout JSON을 Three.js 3D Scene 파라미터로 변환하는 핵심 클래스
 * 
 * @version 1.0.0 - Phase 4.1
 * 
 * 입력: Layout JSON (2D Canvas 기반)
 * 출력: { roomParams, equipmentConfig, wallParams, partitionParams }
 */

import { CoordinateUtils, coordinateUtils } from './CoordinateUtils.js';

export class Layout2DTo3DConverter {
    /**
     * @param {Object} options - 변환 옵션
     */
    constructor(options = {}) {
        // CoordinateUtils 인스턴스
        this.coordUtils = options.coordinateUtils || coordinateUtils;
        
        // 기본값 설정
        this.defaults = {
            wallHeight: 4,
            wallThickness: 0.2,
            equipmentHeight: 2.2,
            scale: 10  // 1m = 10px
        };
        
        // 마지막 변환 결과 캐시
        this.lastResult = null;
        this.lastInput = null;
        
        console.log('[Layout2DTo3DConverter] ✅ 초기화 완료');
    }
    
    // =========================================================
    // 메인 변환 메서드
    // =========================================================
    
    /**
     * 전체 Layout 변환 (메인 진입점)
     * @param {Object} layoutData - Layout JSON 데이터
     * @returns {Object} 3D Scene 파라미터
     */
    convert(layoutData) {
        console.log('[Layout2DTo3DConverter] 변환 시작...');
        
        if (!layoutData) {
            console.error('[Layout2DTo3DConverter] ❌ layoutData가 없습니다');
            return null;
        }
        
        try {
            // 1. Canvas 설정 추출 및 CoordinateUtils 업데이트
            this.updateCoordinateSettings(layoutData);
            
            // 2. 각 섹션 변환
            const roomParams = this.convertRoomParams(layoutData);
            const equipmentConfig = this.convertEquipmentConfig(layoutData);
            const wallParams = this.convertWalls(layoutData);
            const partitionParams = this.convertPartitions(layoutData);
            const officeParams = this.convertOffice(layoutData);
            
            // 3. 결과 조합
            const result = {
                // 메타데이터
                meta: {
                    version: layoutData.version || '1.0',
                    siteId: layoutData.site_id || 'unknown',
                    templateName: layoutData.template_name || 'custom',
                    convertedAt: new Date().toISOString()
                },
                
                // Room 파라미터
                roomParams,
                
                // Equipment CONFIG
                equipmentConfig,
                
                // 벽 파라미터
                wallParams,
                
                // 파티션 파라미터
                partitionParams,
                
                // Office 파라미터
                officeParams,
                
                // 원본 데이터 참조
                _originalLayout: layoutData
            };
            
            // 캐시 저장
            this.lastInput = layoutData;
            this.lastResult = result;
            
            console.log('[Layout2DTo3DConverter] ✅ 변환 완료');
            this.logConversionSummary(result);
            
            return result;
            
        } catch (error) {
            console.error('[Layout2DTo3DConverter] ❌ 변환 실패:', error);
            return null;
        }
    }
    
    /**
     * CoordinateUtils 설정 업데이트
     */
    updateCoordinateSettings(layoutData) {
        const canvas = layoutData.canvas || {};
        const room = layoutData.room || {};
        
        this.coordUtils.updateSettings({
            scale: canvas.scale || this.defaults.scale,
            canvasSize: {
                width: canvas.width || 1200,
                height: canvas.height || 800
            },
            roomSize: {
                width: room.width || 40,
                depth: room.depth || 60
            }
        });
    }
    
    // =========================================================
    // Room 파라미터 변환
    // =========================================================
    
    /**
     * Room 파라미터 변환
     * @param {Object} layoutData - Layout JSON
     * @returns {Object} Room 파라미터
     */
    convertRoomParams(layoutData) {
        const room = layoutData.room || {};
        
        const roomParams = {
            // 기본 치수 (이미 미터 단위)
            roomWidth: room.width || 40,
            roomDepth: room.depth || 60,
            wallHeight: room.wallHeight || this.defaults.wallHeight,
            wallThickness: room.wallThickness || this.defaults.wallThickness,
            
            // Floor 설정
            floorSize: Math.max(room.width || 40, room.depth || 60) + 20,
            
            // 원본 데이터
            _original: room
        };
        
        console.log('[Layout2DTo3DConverter] Room 파라미터:', roomParams);
        return roomParams;
    }
    
    // =========================================================
    // Equipment CONFIG 변환
    // =========================================================
    
    /**
     * Equipment 배열 설정 변환
     * @param {Object} layoutData - Layout JSON
     * @returns {Object} Equipment CONFIG
     */
    convertEquipmentConfig(layoutData) {
        const equipmentArrays = layoutData.equipmentArrays || [];
        
        // 첫 번째 배열을 기본으로 사용 (단일 배열 가정)
        const primaryArray = equipmentArrays[0] || {};
        
        // 기존 CONFIG 형식으로 변환
        const equipmentConfig = {
            ROWS: primaryArray.rows || 26,
            COLS: primaryArray.cols || 6,
            
            SIZE: {
                WIDTH: primaryArray.equipmentSize?.width 
                    ? primaryArray.equipmentSize.width / (layoutData.canvas?.scale || 10)
                    : 1.5,
                HEIGHT: this.defaults.equipmentHeight,
                DEPTH: primaryArray.equipmentSize?.height
                    ? primaryArray.equipmentSize.height / (layoutData.canvas?.scale || 10)
                    : 2.0
            },
            
            SPACING: this.convertSpacingConfig(primaryArray.spacing, layoutData.canvas?.scale),
            
            EXCLUDED_POSITIONS: this.convertExcludedPositions(primaryArray.excludedPositions),
            
            // 추가 메타데이터
            _arrayCount: equipmentArrays.length,
            _original: primaryArray
        };
        
        // 실제 설비 수 계산
        const totalGrid = equipmentConfig.ROWS * equipmentConfig.COLS;
        const excluded = equipmentConfig.EXCLUDED_POSITIONS.length;
        equipmentConfig._actualCount = totalGrid - excluded;
        
        console.log('[Layout2DTo3DConverter] Equipment CONFIG:', equipmentConfig);
        return equipmentConfig;
    }
    
    /**
     * Spacing 설정 변환
     */
    convertSpacingConfig(spacing, scale = 10) {
        if (!spacing) {
            // 기본값 반환
            return {
                DEFAULT: 0.1,
                CORRIDOR_COLS: [1, 3, 5],
                CORRIDOR_COL_WIDTH: 1.2,
                CORRIDOR_ROWS: [13],
                CORRIDOR_ROW_WIDTH: 2.0
            };
        }
        
        return {
            DEFAULT: (spacing.default || 1) / scale,
            CORRIDOR_COLS: spacing.corridorCols || [1, 3, 5],
            CORRIDOR_COL_WIDTH: (spacing.corridorColWidth || 12) / scale,
            CORRIDOR_ROWS: spacing.corridorRows || [13],
            CORRIDOR_ROW_WIDTH: (spacing.corridorRowWidth || 20) / scale
        };
    }
    
    /**
     * 제외 위치 변환
     */
    convertExcludedPositions(excludedPositions) {
        if (!excludedPositions || !Array.isArray(excludedPositions)) {
            // 기본 제외 위치 (Config.js와 동일)
            return this.getDefaultExcludedPositions();
        }
        
        return excludedPositions.map(pos => ({
            col: pos.col,
            row: pos.row
        }));
    }
    
    /**
     * 기본 제외 위치 생성
     */
    getDefaultExcludedPositions() {
        const positions = [];
        
        // col:4, row 4~13
        for (let row = 4; row <= 13; row++) {
            positions.push({ col: 4, row });
        }
        
        // col:5, row 1~13
        for (let row = 1; row <= 13; row++) {
            positions.push({ col: 5, row });
        }
        
        // col:6, row 1~13
        for (let row = 1; row <= 13; row++) {
            positions.push({ col: 6, row });
        }
        
        // col:5, row 15~16
        positions.push({ col: 5, row: 15 });
        positions.push({ col: 5, row: 16 });
        
        // col:5, row 22
        positions.push({ col: 5, row: 22 });
        
        return positions;
    }
    
    // =========================================================
    // 벽 변환
    // =========================================================
    
    /**
     * 벽 배열 변환
     * @param {Object} layoutData - Layout JSON
     * @returns {Array} 3D 벽 파라미터 배열
     */
    convertWalls(layoutData) {
        const walls = layoutData.walls || [];
        const wallHeight = layoutData.room?.wallHeight || this.defaults.wallHeight;
        
        const wallParams = walls.map((wall, index) => {
            // 벽 타입에 따른 변환
            if (wall.type === 'line' || (wall.startX !== undefined)) {
                // 선분 형태 벽
                return this.coordUtils.convertWall2DTo3D(wall, wallHeight);
            } else if (wall.type === 'rect' || (wall.x !== undefined && wall.width !== undefined)) {
                // 사각형 형태 벽
                return this.convertRectWall(wall, wallHeight);
            }
            
            console.warn(`[Layout2DTo3DConverter] 알 수 없는 벽 타입 (index: ${index}):`, wall);
            return null;
        }).filter(w => w !== null);
        
        console.log(`[Layout2DTo3DConverter] 벽 변환 완료: ${wallParams.length}개`);
        return wallParams;
    }
    
    /**
     * 사각형 벽 변환
     */
    convertRectWall(wall, wallHeight) {
        const rect3D = this.coordUtils.canvas2DRectToWorld3D({
            x: wall.x,
            y: wall.y,
            width: wall.width,
            height: wall.height || wall.thickness || 2
        });
        
        return {
            position: { x: rect3D.x, y: wallHeight / 2, z: rect3D.z },
            size: { width: rect3D.width, height: wallHeight, depth: rect3D.depth },
            rotation: { y: wall.rotation || 0 },
            original2D: wall
        };
    }
    
    // =========================================================
    // 파티션 변환
    // =========================================================
    
    /**
     * 파티션 변환
     * @param {Object} layoutData - Layout JSON
     * @returns {Array} 3D 파티션 파라미터 배열
     */
    convertPartitions(layoutData) {
        const partitions = layoutData.partitions || [];
        
        const partitionParams = partitions.map((partition, index) => {
            const position3D = this.coordUtils.canvas2DToWorld3D(
                partition.x + (partition.width || 0) / 2,
                partition.y + (partition.height || 0) / 2
            );
            
            const size3D = this.coordUtils.canvas2DSizeToWorld3D(
                partition.width || 30,
                partition.height || 5
            );
            
            return {
                position: {
                    x: position3D.x,
                    y: (partition.partitionHeight || 2.5) / 2,
                    z: position3D.z
                },
                size: {
                    width: size3D.width,
                    height: partition.partitionHeight || 2.5,
                    depth: size3D.depth
                },
                type: partition.type || 'glass',
                hasFrame: partition.hasFrame !== false,
                original2D: partition
            };
        });
        
        console.log(`[Layout2DTo3DConverter] 파티션 변환 완료: ${partitionParams.length}개`);
        return partitionParams;
    }
    
    // =========================================================
    // Office 변환
    // =========================================================
    
    /**
     * Office 공간 변환
     * @param {Object} layoutData - Layout JSON
     * @returns {Object|null} Office 파라미터
     */
    convertOffice(layoutData) {
        const office = layoutData.office;
        
        if (!office) {
            return null;
        }
        
        const position3D = this.coordUtils.canvas2DToWorld3D(
            office.x + (office.width || 0) / 2,
            office.y + (office.height || 0) / 2
        );
        
        const size3D = this.coordUtils.canvas2DSizeToWorld3D(
            office.width || 120,
            office.height || 200
        );
        
        const officeParams = {
            position: { x: position3D.x, z: position3D.z },
            size: {
                width: size3D.width,
                depth: size3D.depth
            },
            wallHeight: layoutData.room?.wallHeight || this.defaults.wallHeight,
            hasEntrance: office.hasEntrance !== false,
            entranceWidth: (office.entranceWidth || 30) / (layoutData.canvas?.scale || 10),
            original2D: office
        };
        
        console.log('[Layout2DTo3DConverter] Office 파라미터:', officeParams);
        return officeParams;
    }
    
    // =========================================================
    // 유틸리티 메서드
    // =========================================================
    
    /**
     * 변환 결과 요약 로그
     */
    logConversionSummary(result) {
        console.group('[Layout2DTo3DConverter] 변환 결과 요약');
        console.log('Site ID:', result.meta.siteId);
        console.log('Template:', result.meta.templateName);
        console.log('Room:', `${result.roomParams.roomWidth}m × ${result.roomParams.roomDepth}m`);
        console.log('Equipment Grid:', `${result.equipmentConfig.ROWS} × ${result.equipmentConfig.COLS}`);
        console.log('Actual Equipment:', result.equipmentConfig._actualCount);
        console.log('Walls:', result.wallParams.length);
        console.log('Partitions:', result.partitionParams.length);
        console.log('Office:', result.officeParams ? 'Yes' : 'No');
        console.groupEnd();
    }
    
    /**
     * 마지막 변환 결과 반환
     */
    getLastResult() {
        return this.lastResult;
    }
    
    /**
     * 변환 결과 검증
     */
    validate(result) {
        const errors = [];
        
        if (!result) {
            errors.push('결과가 null입니다');
            return { valid: false, errors };
        }
        
        // Room 검증
        if (!result.roomParams) {
            errors.push('roomParams가 없습니다');
        } else {
            if (result.roomParams.roomWidth <= 0) errors.push('roomWidth가 0 이하입니다');
            if (result.roomParams.roomDepth <= 0) errors.push('roomDepth가 0 이하입니다');
        }
        
        // Equipment 검증
        if (!result.equipmentConfig) {
            errors.push('equipmentConfig가 없습니다');
        } else {
            if (result.equipmentConfig.ROWS <= 0) errors.push('ROWS가 0 이하입니다');
            if (result.equipmentConfig.COLS <= 0) errors.push('COLS가 0 이하입니다');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.log('[Layout2DTo3DConverter] Debug Info:', {
            defaults: this.defaults,
            hasLastResult: !!this.lastResult,
            coordUtils: this.coordUtils
        });
        
        if (this.lastResult) {
            this.logConversionSummary(this.lastResult);
        }
    }
}

// 기본 인스턴스 생성
export const layout2DTo3DConverter = new Layout2DTo3DConverter();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.Layout2DTo3DConverter = Layout2DTo3DConverter;
    window.layout2DTo3DConverter = layout2DTo3DConverter;
}