/**
 * RoomParamsAdapter.js
 * Layout2DTo3DConverter 결과를 RoomEnvironment constructor params 형식으로 변환
 * 
 * @version 1.0.0 - Phase 4.2
 * 
 * 입력: Layout2DTo3DConverter.convert() 결과
 * 출력: RoomEnvironment constructor에 전달할 params 객체
 */

export class RoomParamsAdapter {
    constructor() {
        console.log('[RoomParamsAdapter] ✅ 초기화 완료');
    }
    
    // =========================================================
    // 메인 변환 메서드
    // =========================================================
    
    /**
     * convertedLayout을 RoomEnvironment params로 변환
     * @param {Object} convertedLayout - Layout2DTo3DConverter.convert() 결과
     * @returns {Object} RoomEnvironment constructor params
     */
    adapt(convertedLayout) {
        if (!convertedLayout) {
            console.warn('[RoomParamsAdapter] convertedLayout이 없습니다. 기본값 사용');
            return null;
        }
        
        console.log('[RoomParamsAdapter] 변환 시작...');
        
        try {
            const params = {
                // Room 기본 치수
                ...this.adaptRoomParams(convertedLayout.roomParams),
                
                // Office 파라미터
                ...this.adaptOfficeParams(convertedLayout.officeParams),
                
                // 동적 벽 배열 (선택적)
                walls: this.adaptWallParams(convertedLayout.wallParams),
                
                // 동적 파티션 배열 (선택적)
                partitions: this.adaptPartitionParams(convertedLayout.partitionParams),
                
                // 메타데이터
                _meta: {
                    siteId: convertedLayout.meta?.siteId || 'unknown',
                    templateName: convertedLayout.meta?.templateName || 'custom',
                    adaptedAt: new Date().toISOString()
                }
            };
            
            console.log('[RoomParamsAdapter] ✅ 변환 완료:', params);
            return params;
            
        } catch (error) {
            console.error('[RoomParamsAdapter] ❌ 변환 실패:', error);
            return null;
        }
    }
    
    // =========================================================
    // Room 파라미터 변환
    // =========================================================
    
    /**
     * Room 파라미터 변환
     * @param {Object} roomParams - convertedLayout.roomParams
     * @returns {Object} RoomEnvironment용 Room 파라미터
     */
    adaptRoomParams(roomParams) {
        if (!roomParams) {
            return {
                roomWidth: 40,
                roomDepth: 60,
                wallHeight: 4,
                wallThickness: 0.2
            };
        }
        
        return {
            roomWidth: roomParams.roomWidth || 40,
            roomDepth: roomParams.roomDepth || 60,
            wallHeight: roomParams.wallHeight || 4,
            wallThickness: roomParams.wallThickness || 0.2
        };
    }
    
    // =========================================================
    // Office 파라미터 변환
    // =========================================================
    
    /**
     * Office 파라미터 변환
     * @param {Object} officeParams - convertedLayout.officeParams
     * @returns {Object} RoomEnvironment용 Office 파라미터
     */
    adaptOfficeParams(officeParams) {
        if (!officeParams) {
            return {
                officeWidth: 12,
                officeDepth: 20,
                officeX: 15,
                officeZ: -20,
                hasOffice: false
            };
        }
        
        return {
            officeWidth: officeParams.size?.width || 12,
            officeDepth: officeParams.size?.depth || 20,
            officeX: officeParams.position?.x || 15,
            officeZ: officeParams.position?.z || -20,
            hasOffice: true,
            officeHasEntrance: officeParams.hasEntrance !== false,
            officeEntranceWidth: officeParams.entranceWidth || 3
        };
    }
    
    // =========================================================
    // 벽 파라미터 변환
    // =========================================================
    
    /**
     * 동적 벽 배열 변환
     * @param {Array} wallParams - convertedLayout.wallParams
     * @returns {Array|null} RoomEnvironment용 벽 배열 (null이면 기본 벽 사용)
     */
    adaptWallParams(wallParams) {
        if (!wallParams || !Array.isArray(wallParams) || wallParams.length === 0) {
            // null 반환 시 RoomEnvironment가 기본 벽 생성
            return null;
        }
        
        return wallParams.map((wall, index) => ({
            id: `wall-${index}`,
            position: {
                x: wall.position?.x || 0,
                y: wall.position?.y || 2,
                z: wall.position?.z || 0
            },
            size: {
                width: wall.size?.width || 1,
                height: wall.size?.height || 4,
                depth: wall.size?.depth || 0.2
            },
            rotation: wall.rotation?.y || 0,
            type: wall.type || 'standard'
        }));
    }
    
    // =========================================================
    // 파티션 파라미터 변환
    // =========================================================
    
    /**
     * 동적 파티션 배열 변환
     * @param {Array} partitionParams - convertedLayout.partitionParams
     * @returns {Array|null} RoomEnvironment용 파티션 배열
     */
    adaptPartitionParams(partitionParams) {
        if (!partitionParams || !Array.isArray(partitionParams) || partitionParams.length === 0) {
            return null;
        }
        
        return partitionParams.map((partition, index) => ({
            id: `partition-${index}`,
            position: {
                x: partition.position?.x || 0,
                y: partition.position?.y || 1.25,
                z: partition.position?.z || 0
            },
            size: {
                width: partition.size?.width || 3,
                height: partition.size?.height || 2.5,
                depth: partition.size?.depth || 0.1
            },
            type: partition.type || 'glass',
            hasFrame: partition.hasFrame !== false
        }));
    }
    
    // =========================================================
    // 유틸리티 메서드
    // =========================================================
    
    /**
     * 변환 결과 검증
     * @param {Object} params - adapt() 결과
     * @returns {Object} 검증 결과
     */
    validate(params) {
        const errors = [];
        const warnings = [];
        
        if (!params) {
            errors.push('params가 null입니다');
            return { valid: false, errors, warnings };
        }
        
        // Room 치수 검증
        if (params.roomWidth <= 0) errors.push('roomWidth가 0 이하입니다');
        if (params.roomDepth <= 0) errors.push('roomDepth가 0 이하입니다');
        if (params.wallHeight <= 0) errors.push('wallHeight가 0 이하입니다');
        
        // Office 검증 (hasOffice가 true일 때만)
        if (params.hasOffice) {
            if (params.officeWidth <= 0) warnings.push('officeWidth가 0 이하입니다');
            if (params.officeDepth <= 0) warnings.push('officeDepth가 0 이하입니다');
            
            // Office가 Room 안에 있는지 확인
            const halfRoomWidth = params.roomWidth / 2;
            const halfRoomDepth = params.roomDepth / 2;
            
            if (Math.abs(params.officeX) > halfRoomWidth) {
                warnings.push('Office X 위치가 Room 범위를 벗어납니다');
            }
            if (Math.abs(params.officeZ) > halfRoomDepth) {
                warnings.push('Office Z 위치가 Room 범위를 벗어납니다');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * 기본 파라미터 반환
     * @returns {Object} 기본 RoomEnvironment params
     */
    getDefaultParams() {
        return {
            roomWidth: 40,
            roomDepth: 60,
            wallHeight: 4,
            wallThickness: 0.2,
            officeWidth: 12,
            officeDepth: 20,
            officeX: 15,
            officeZ: -20,
            hasOffice: true,
            officeHasEntrance: true,
            officeEntranceWidth: 3,
            walls: null,
            partitions: null,
            _meta: {
                siteId: 'default',
                templateName: 'default',
                adaptedAt: new Date().toISOString()
            }
        };
    }
    
    /**
     * 디버그 정보 출력
     */
    debug(params) {
        console.group('[RoomParamsAdapter] Debug Info');
        
        if (!params) {
            console.log('params: null');
        } else {
            console.log('Room:', `${params.roomWidth}m × ${params.roomDepth}m × ${params.wallHeight}m`);
            console.log('Office:', params.hasOffice 
                ? `${params.officeWidth}m × ${params.officeDepth}m at (${params.officeX}, ${params.officeZ})`
                : 'None');
            console.log('Dynamic Walls:', params.walls ? `${params.walls.length}개` : 'Default');
            console.log('Dynamic Partitions:', params.partitions ? `${params.partitions.length}개` : 'Default');
            console.log('Meta:', params._meta);
        }
        
        console.groupEnd();
    }
}

// 기본 인스턴스 생성
export const roomParamsAdapter = new RoomParamsAdapter();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.RoomParamsAdapter = RoomParamsAdapter;
    window.roomParamsAdapter = roomParamsAdapter;
}