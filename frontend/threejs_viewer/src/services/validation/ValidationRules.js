/**
 * ValidationRules.js
 * ==================
 * 
 * Layout 검증에 사용되는 모든 상수와 규칙 정의
 * 
 * 주요 내용:
 * 1. 최소/최대 크기 상수
 * 2. 에러 타입 상수
 * 3. 심각도 레벨 정의
 * 
 * 위치: frontend/threejs_viewer/src/services/validation/ValidationRules.js
 */

/**
 * 검증 규칙 상수
 */
export const ValidationRules = {
    // =====================================================
    // Room 관련 규칙
    // =====================================================
    ROOM: {
        MIN_WIDTH: 10,          // Room 최소 너비 (m)
        MIN_DEPTH: 10,          // Room 최소 깊이 (m)
        MAX_WIDTH: 500,         // Room 최대 너비 (m)
        MAX_DEPTH: 500          // Room 최대 깊이 (m)
    },
    
    // =====================================================
    // Wall 관련 규칙
    // =====================================================
    WALL: {
        MIN_COUNT: 4,           // 최소 외벽 개수
        MIN_THICKNESS: 0.1,     // 벽 최소 두께 (m)
        MAX_THICKNESS: 1.0,     // 벽 최대 두께 (m)
        MIN_HEIGHT: 2.0,        // 벽 최소 높이 (m)
        MAX_HEIGHT: 10.0        // 벽 최대 높이 (m)
    },
    
    // =====================================================
    // Equipment 관련 규칙
    // =====================================================
    EQUIPMENT: {
        MIN_ARRAYS: 1,          // 최소 설비 배열 수
        MIN_WIDTH: 0.1,         // 설비 최소 너비 (m)
        MIN_DEPTH: 0.1,         // 설비 최소 깊이 (m)
        MAX_WIDTH: 20,          // 설비 최대 너비 (m)
        MAX_DEPTH: 20,          // 설비 최대 깊이 (m)
        MIN_SPACING: 0.3        // 설비 간 최소 간격 (m)
    },
    
    // =====================================================
    // Corridor (복도) 관련 규칙
    // =====================================================
    CORRIDOR: {
        MIN_WIDTH: 0.8,         // 복도 최소 폭 (m) - 안전 규정
        RECOMMENDED_WIDTH: 1.2  // 복도 권장 폭 (m)
    },
    
    // =====================================================
    // Boundary (경계) 관련 규칙
    // =====================================================
    BOUNDARY: {
        MIN_MARGIN: 0.5,        // Room 경계에서 최소 마진 (m)
        WALL_COLLISION_MARGIN: 0.1  // 벽 충돌 감지 마진 (m)
    }
};

/**
 * 에러 타입 상수
 */
export const ERROR_TYPES = {
    // =====================================================
    // 필수 항목 에러
    // =====================================================
    ROOM_MISSING: 'ROOM_MISSING',
    ROOM_SIZE_TOO_SMALL: 'ROOM_SIZE_TOO_SMALL',
    ROOM_SIZE_TOO_LARGE: 'ROOM_SIZE_TOO_LARGE',
    ROOM_INVALID_DIMENSIONS: 'ROOM_INVALID_DIMENSIONS',
    
    WALL_COUNT_INSUFFICIENT: 'WALL_COUNT_INSUFFICIENT',
    WALL_MISSING: 'WALL_MISSING',
    
    EQUIPMENT_ARRAY_MISSING: 'EQUIPMENT_ARRAY_MISSING',
    EQUIPMENT_ARRAY_EMPTY: 'EQUIPMENT_ARRAY_EMPTY',
    
    SITE_ID_MISSING: 'SITE_ID_MISSING',
    
    // =====================================================
    // 타입 에러
    // =====================================================
    INVALID_TYPE_ROOM_WIDTH: 'INVALID_TYPE_ROOM_WIDTH',
    INVALID_TYPE_ROOM_DEPTH: 'INVALID_TYPE_ROOM_DEPTH',
    INVALID_TYPE_WALLS: 'INVALID_TYPE_WALLS',
    INVALID_TYPE_EQUIPMENT_ARRAYS: 'INVALID_TYPE_EQUIPMENT_ARRAYS',
    
    // =====================================================
    // 논리적 에러
    // =====================================================
    EQUIPMENT_OUT_OF_BOUNDS: 'EQUIPMENT_OUT_OF_BOUNDS',
    EQUIPMENT_COLLISION: 'EQUIPMENT_COLLISION',
    EQUIPMENT_WALL_COLLISION: 'EQUIPMENT_WALL_COLLISION',
    EQUIPMENT_INVALID_SIZE: 'EQUIPMENT_INVALID_SIZE',
    
    WALL_OUT_OF_BOUNDS: 'WALL_OUT_OF_BOUNDS',
    WALL_INVALID_THICKNESS: 'WALL_INVALID_THICKNESS',
    
    CORRIDOR_TOO_NARROW: 'CORRIDOR_TOO_NARROW',
    
    // =====================================================
    // 3D 변환 에러
    // =====================================================
    EQUIPMENT_WIDTH_INVALID: 'EQUIPMENT_WIDTH_INVALID',
    EQUIPMENT_DEPTH_INVALID: 'EQUIPMENT_DEPTH_INVALID',
    EXCLUDED_POSITION_OUT_OF_RANGE: 'EXCLUDED_POSITION_OUT_OF_RANGE',
    
    // =====================================================
    // 경고
    // =====================================================
    CORRIDOR_BELOW_RECOMMENDED: 'CORRIDOR_BELOW_RECOMMENDED',
    EQUIPMENT_NEAR_BOUNDARY: 'EQUIPMENT_NEAR_BOUNDARY'
};

/**
 * 심각도 레벨
 */
export const SEVERITY = {
    ERROR: 'error',         // 저장 불가 - 반드시 수정 필요
    WARNING: 'warning',     // 저장 가능 - 권장 수정
    INFO: 'info'            // 정보성 메시지
};

/**
 * 에러 메시지 템플릿
 */
export const ERROR_MESSAGES = {
    // Room 관련
    [ERROR_TYPES.ROOM_MISSING]: {
        message: 'Room 정보가 없습니다',
        fix: 'Layout에 Room을 추가하세요'
    },
    [ERROR_TYPES.ROOM_SIZE_TOO_SMALL]: {
        message: 'Room 크기가 너무 작습니다 (현재: {width}×{depth}m)',
        fix: `Room 크기를 최소 ${ValidationRules.ROOM.MIN_WIDTH}×${ValidationRules.ROOM.MIN_DEPTH}m로 설정하세요`
    },
    [ERROR_TYPES.ROOM_SIZE_TOO_LARGE]: {
        message: 'Room 크기가 너무 큽니다 (현재: {width}×{depth}m)',
        fix: `Room 크기를 최대 ${ValidationRules.ROOM.MAX_WIDTH}×${ValidationRules.ROOM.MAX_DEPTH}m 이하로 설정하세요`
    },
    [ERROR_TYPES.ROOM_INVALID_DIMENSIONS]: {
        message: 'Room 크기가 올바르지 않습니다',
        fix: 'Room의 width와 depth가 양수인지 확인하세요'
    },
    
    // Wall 관련
    [ERROR_TYPES.WALL_COUNT_INSUFFICIENT]: {
        message: '외벽 개수가 부족합니다 (현재: {count}개)',
        fix: `최소 ${ValidationRules.WALL.MIN_COUNT}개의 외벽이 필요합니다`
    },
    [ERROR_TYPES.WALL_MISSING]: {
        message: '벽 정보가 없습니다',
        fix: 'Layout에 벽을 추가하세요'
    },
    [ERROR_TYPES.WALL_INVALID_THICKNESS]: {
        message: '벽 두께가 올바르지 않습니다 (ID: {wallId})',
        fix: `벽 두께를 ${ValidationRules.WALL.MIN_THICKNESS}~${ValidationRules.WALL.MAX_THICKNESS}m 사이로 설정하세요`
    },
    
    // Equipment 관련
    [ERROR_TYPES.EQUIPMENT_ARRAY_MISSING]: {
        message: '설비 배열이 없습니다',
        fix: '최소 1개의 설비 배열을 추가하세요'
    },
    [ERROR_TYPES.EQUIPMENT_ARRAY_EMPTY]: {
        message: '설비 배열이 비어있습니다',
        fix: '설비 배열에 최소 1개의 설비를 추가하세요'
    },
    [ERROR_TYPES.EQUIPMENT_OUT_OF_BOUNDS]: {
        message: '설비 {equipmentId}가 Room 영역 밖에 있습니다',
        fix: '설비를 Room 내부로 이동하세요'
    },
    [ERROR_TYPES.EQUIPMENT_COLLISION]: {
        message: '설비 {equipmentId1}과 {equipmentId2}이 겹칩니다',
        fix: '설비 위치를 조정하여 겹침을 해소하세요'
    },
    [ERROR_TYPES.EQUIPMENT_WALL_COLLISION]: {
        message: '설비 {equipmentId}가 벽과 겹칩니다',
        fix: '설비를 벽에서 멀리 이동하세요'
    },
    [ERROR_TYPES.EQUIPMENT_INVALID_SIZE]: {
        message: '설비 크기가 올바르지 않습니다 (ID: {equipmentId})',
        fix: '설비의 width와 depth를 확인하세요'
    },
    
    // Corridor 관련
    [ERROR_TYPES.CORRIDOR_TOO_NARROW]: {
        message: '복도 폭이 부족합니다 ({location})',
        fix: `복도 폭을 최소 ${ValidationRules.CORRIDOR.MIN_WIDTH}m로 설정하세요`
    },
    [ERROR_TYPES.CORRIDOR_BELOW_RECOMMENDED]: {
        message: '복도 폭이 권장 값보다 좁습니다 ({location})',
        fix: `복도 폭을 ${ValidationRules.CORRIDOR.RECOMMENDED_WIDTH}m 이상으로 설정하세요`
    },
    
    // Site ID
    [ERROR_TYPES.SITE_ID_MISSING]: {
        message: 'Site ID가 없습니다',
        fix: 'Layout에 site_id를 설정하세요'
    },
    
    // 3D 변환 관련
    [ERROR_TYPES.EQUIPMENT_WIDTH_INVALID]: {
        message: '설비 너비가 0 이하입니다 (ID: {equipmentId})',
        fix: '설비 너비를 양수로 설정하세요'
    },
    [ERROR_TYPES.EQUIPMENT_DEPTH_INVALID]: {
        message: '설비 깊이가 0 이하입니다 (ID: {equipmentId})',
        fix: '설비 깊이를 양수로 설정하세요'
    },
    [ERROR_TYPES.EXCLUDED_POSITION_OUT_OF_RANGE]: {
        message: '제외 위치가 배열 범위를 벗어납니다',
        fix: '제외 위치가 rows×cols 범위 내에 있는지 확인하세요'
    }
};

/**
 * 에러 메시지 생성 헬퍼
 * @param {string} errorType - 에러 타입
 * @param {Object} params - 치환 파라미터
 * @returns {Object} { message, fix }
 */
export function getErrorMessage(errorType, params = {}) {
    const template = ERROR_MESSAGES[errorType];
    
    if (!template) {
        return {
            message: `알 수 없는 에러: ${errorType}`,
            fix: '관리자에게 문의하세요'
        };
    }
    
    let message = template.message;
    let fix = template.fix;
    
    // 파라미터 치환
    Object.keys(params).forEach(key => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        message = message.replace(regex, params[key]);
        fix = fix.replace(regex, params[key]);
    });
    
    return { message, fix };
}

// Default export
export default {
    ValidationRules,
    ERROR_TYPES,
    SEVERITY,
    ERROR_MESSAGES,
    getErrorMessage
};