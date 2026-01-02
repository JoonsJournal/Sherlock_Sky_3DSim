/**
 * settings.js
 * 애플리케이션 설정 (기존 Config.js 마이그레이션)
 * 
 * @version 1.0.0
 * @description 렌더러, 카메라, 장비, 씬 등 설정
 */

// =====================================================
// 헬퍼 함수
// =====================================================

/**
 * 제외 위치 범위 생성
 * @param {number} col - 열 번호
 * @param {number} startRow - 시작 행 번호
 * @param {number} endRow - 끝 행 번호
 * @returns {Array<{col: number, row: number}>}
 */
export const createExcludedRange = (col, startRow, endRow) => {
    const positions = [];
    for (let row = startRow; row <= endRow; row++) {
        positions.push({ col, row });
    }
    return positions;
};

// =====================================================
// 메인 설정 객체
// =====================================================

export const SETTINGS = {
    // 디버그 모드
    DEBUG_MODE: false,
    
    // 렌더링 설정
    RENDERER: {
        ANTIALIAS: true,
        SHADOW_MAP_ENABLED: true,
        SHADOW_MAP_SIZE: 2048
    },
    
    // 카메라 설정
    CAMERA: {
        FOV: 75,
        NEAR: 0.1,
        FAR: 1000,
        INITIAL_POSITION: { x: 0, y: 40, z: 40 }
    },
    
    // 설비 배열 설정
    EQUIPMENT: {
        ROWS: 26,
        COLS: 6,
        SIZE: {
            WIDTH: 1.5,
            HEIGHT: 2.2,
            DEPTH: 2.0
        },
        SPACING: {
            DEFAULT: 0.1,
            CORRIDOR_COLS: [1, 3, 5],
            CORRIDOR_COL_WIDTH: 1.2,
            CORRIDOR_ROWS: [13],
            CORRIDOR_ROW_WIDTH: 2.0
        },
        EXCLUDED_POSITIONS: [
            ...createExcludedRange(4, 4, 13),
            ...createExcludedRange(5, 1, 13),
            ...createExcludedRange(6, 1, 13),
            ...createExcludedRange(5, 15, 16),
            { col: 5, row: 22 }
        ]
    },
    
    // 조명 설정
    LIGHTING: {
        AMBIENT: {
            COLOR: 0xffffff,
            INTENSITY: 0.6
        },
        DIRECTIONAL: {
            COLOR: 0xffffff,
            INTENSITY: 0.8,
            POSITION: { x: 30, y: 50, z: 30 }
        },
        POINT: {
            COLOR: 0xffffff,
            INTENSITY: 0.5,
            POSITION: { x: -30, y: 30, z: -30 }
        }
    },
    
    // 씬 설정
    SCENE: {
        BACKGROUND_COLOR: 0xf8f8f8,
        FLOOR_SIZE: 70,
        FLOOR_COLOR: 0xf5f5f5,
        GRID_DIVISIONS: 100,
        GRID_COLOR1: 0xe5e5e5,
        GRID_COLOR2: 0xf0f0f0
    },
    
    // 컨트롤 설정
    CONTROLS: {
        ENABLE_DAMPING: true,
        DAMPING_FACTOR: 0.05
    },
    
    // UI 설정
    UI: {
        LOADING_TIMEOUT: 3000,
        FPS_LOG_INTERVAL: 300
    }
};

// =====================================================
// 기존 CONFIG 호환 객체 (레거시 지원)
// =====================================================

export const CONFIG = SETTINGS;

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 디버그 로그 함수
 * @param {...any} args - 로그 메시지
 */
export function debugLog(...args) {
    if (SETTINGS.DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * 특정 위치가 제외 위치인지 확인
 * @param {number} row - 행 번호
 * @param {number} col - 열 번호
 * @returns {boolean}
 */
export function isExcludedPosition(row, col) {
    return SETTINGS.EQUIPMENT.EXCLUDED_POSITIONS.some(
        pos => pos.row === row && pos.col === col
    );
}

/**
 * 제외 위치 통계 반환
 * @returns {Object}
 */
export function getExcludedStatistics() {
    const byCol = {};
    const byRow = {};
    
    SETTINGS.EQUIPMENT.EXCLUDED_POSITIONS.forEach(pos => {
        if (!byCol[pos.col]) byCol[pos.col] = [];
        byCol[pos.col].push(pos.row);
        
        if (!byRow[pos.row]) byRow[pos.row] = [];
        byRow[pos.row].push(pos.col);
    });
    
    return {
        total: SETTINGS.EQUIPMENT.EXCLUDED_POSITIONS.length,
        byColumn: byCol,
        byRow: byRow
    };
}

// =====================================================
// 동적 설정 업데이트 함수
// =====================================================

/**
 * Equipment 설정 동적 업데이트
 * @param {Object} newConfig - 새로운 설정
 * @returns {Object} 업데이트된 EQUIPMENT 설정
 */
export function updateEquipmentSettings(newConfig) {
    if (!newConfig) {
        console.warn('[Settings] updateEquipmentSettings: 새 설정이 없습니다');
        return SETTINGS.EQUIPMENT;
    }
    
    console.log('[Settings] Equipment 설정 업데이트 시작...');
    
    const previousConfig = { ...SETTINGS.EQUIPMENT };
    
    if (newConfig.ROWS !== undefined) {
        SETTINGS.EQUIPMENT.ROWS = newConfig.ROWS;
    }
    if (newConfig.COLS !== undefined) {
        SETTINGS.EQUIPMENT.COLS = newConfig.COLS;
    }
    if (newConfig.SIZE) {
        SETTINGS.EQUIPMENT.SIZE = { ...SETTINGS.EQUIPMENT.SIZE, ...newConfig.SIZE };
    }
    if (newConfig.SPACING) {
        SETTINGS.EQUIPMENT.SPACING = { ...SETTINGS.EQUIPMENT.SPACING, ...newConfig.SPACING };
    }
    if (newConfig.EXCLUDED_POSITIONS) {
        SETTINGS.EQUIPMENT.EXCLUDED_POSITIONS = newConfig.EXCLUDED_POSITIONS;
    }
    
    console.log('[Settings] Equipment 설정 업데이트 완료:', {
        before: `${previousConfig.ROWS}×${previousConfig.COLS}`,
        after: `${SETTINGS.EQUIPMENT.ROWS}×${SETTINGS.EQUIPMENT.COLS}`
    });
    
    return SETTINGS.EQUIPMENT;
}

/**
 * Scene 설정 동적 업데이트
 * @param {Object} newConfig - 새로운 설정
 * @returns {Object} 업데이트된 SCENE 설정
 */
export function updateSceneSettings(newConfig) {
    if (!newConfig) {
        console.warn('[Settings] updateSceneSettings: 새 설정이 없습니다');
        return SETTINGS.SCENE;
    }
    
    console.log('[Settings] Scene 설정 업데이트 시작...');
    
    Object.keys(newConfig).forEach(key => {
        if (key in SETTINGS.SCENE) {
            SETTINGS.SCENE[key] = newConfig[key];
        }
    });
    
    console.log('[Settings] Scene 설정 업데이트 완료');
    
    return SETTINGS.SCENE;
}

/**
 * 설정 초기화 (기본값 복원)
 */
export function resetSettings() {
    console.log('[Settings] 설정 초기화...');
    
    SETTINGS.EQUIPMENT.ROWS = 26;
    SETTINGS.EQUIPMENT.COLS = 6;
    SETTINGS.EQUIPMENT.SIZE = { WIDTH: 1.5, HEIGHT: 2.2, DEPTH: 2.0 };
    SETTINGS.EQUIPMENT.SPACING = {
        DEFAULT: 0.1,
        CORRIDOR_COLS: [1, 3, 5],
        CORRIDOR_COL_WIDTH: 1.2,
        CORRIDOR_ROWS: [13],
        CORRIDOR_ROW_WIDTH: 2.0
    };
    SETTINGS.EQUIPMENT.EXCLUDED_POSITIONS = [
        ...createExcludedRange(4, 4, 13),
        ...createExcludedRange(5, 1, 13),
        ...createExcludedRange(6, 1, 13),
        ...createExcludedRange(5, 15, 16),
        { col: 5, row: 22 }
    ];
    
    SETTINGS.SCENE.FLOOR_SIZE = 70;
    
    console.log('[Settings] 설정 초기화 완료');
}

/**
 * 현재 설정 상태 출력 (디버깅용)
 */
export function debugSettings() {
    console.group('[Settings] 현재 설정 상태');
    console.log('EQUIPMENT.ROWS:', SETTINGS.EQUIPMENT.ROWS);
    console.log('EQUIPMENT.COLS:', SETTINGS.EQUIPMENT.COLS);
    console.log('EQUIPMENT.SIZE:', SETTINGS.EQUIPMENT.SIZE);
    console.log('EQUIPMENT.SPACING:', SETTINGS.EQUIPMENT.SPACING);
    console.log('EQUIPMENT.EXCLUDED_POSITIONS 개수:', SETTINGS.EQUIPMENT.EXCLUDED_POSITIONS.length);
    console.log('SCENE.FLOOR_SIZE:', SETTINGS.SCENE.FLOOR_SIZE);
    console.groupEnd();
}

// =====================================================
// 전역 노출 (브라우저 환경, 레거시 호환)
// =====================================================

if (typeof window !== 'undefined') {
    window.SETTINGS = SETTINGS;
    window.CONFIG = CONFIG;
    window.updateEquipmentConfig = updateEquipmentSettings;
    window.updateSceneConfig = updateSceneSettings;
    window.resetConfig = resetSettings;
    window.debugConfig = debugSettings;
    window.debugLog = debugLog;
}