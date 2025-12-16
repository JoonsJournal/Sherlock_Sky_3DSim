/**
 * Config.js
 * 전역 설정 및 상수 관리
 */

/**
 * 제외 위치 범위 생성 헬퍼 함수
 * @param {number} col - 열 번호
 * @param {number} startRow - 시작 행 번호
 * @param {number} endRow - 끝 행 번호
 * @returns {Array<{col: number, row: number}>} 제외 위치 배열
 */
const createExcludedRange = (col, startRow, endRow) => {
    const positions = [];
    for (let row = startRow; row <= endRow; row++) {
        positions.push({ col, row });
    }
    return positions;
};

export const CONFIG = {
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
        INITIAL_POSITION: { x: 0, y: 40, z: 40 }  // 더 넓은 배열을 위해 조정
    },
    
    // 설비 배열 설정
    EQUIPMENT: {
        ROWS: 26,  // 26개 행
        COLS: 6,   // 6개 열
        SIZE: {
            WIDTH: 1.5,   // 설비 폭 (X축)
            HEIGHT: 2.2,  // 설비 높이
            DEPTH: 2.0    // 설비 깊이 (Z축)
        },
        // 간격 설정 (미터 단위)
        SPACING: {
            DEFAULT: 0.1,                    // 기본 간격 10cm
            CORRIDOR_COLS: [1, 3, 5],        // 열 방향 복도 위치 (1, 3, 5열 뒤)
            CORRIDOR_COL_WIDTH: 1.2,         // 열 방향 복도 폭 1.2m
            CORRIDOR_ROWS: [13],             // 행 방향 복도 위치 (13행 뒤)
            CORRIDOR_ROW_WIDTH: 2.0          // 행 방향 복도 폭 2.0m
        },
        // 설비가 없는 위치 (제외할 설비)
        // createExcludedRange(col, startRow, endRow)를 사용하여 범위 지정 가능
        EXCLUDED_POSITIONS: [
            // col:4, row 4~13 (10개)
            ...createExcludedRange(4, 4, 13),
            
            // col:5, row 1~13 (13개)
            ...createExcludedRange(5, 1, 13),
            
            // col:6, row 1~13 (13개)
            ...createExcludedRange(6, 1, 13),
            
            // col:5, row 15~16 (2개)
            ...createExcludedRange(5, 15, 16),
            
            // col:5, row 22 (1개)
            { col: 5, row: 22 }
            
            // 총 39개 제외 위치
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
            POSITION: { x: 30, y: 50, z: 30 }  // 더 높은 위치
        },
        POINT: {
            COLOR: 0xffffff,
            INTENSITY: 0.5,
            POSITION: { x: -30, y: 30, z: -30 }
        }
    },
    
    // 씬 설정
    SCENE: {
        BACKGROUND_COLOR: 0xf5f5f5,  // 밝은 회색-흰색 배경 (클린룸)
        FLOOR_SIZE: 70,              // 바닥 크기를 더 크게 (26행 × 6열에 맞춤)
        FLOOR_COLOR: 0xf0f0f0,
        GRID_DIVISIONS: 100,         // 더 촘촘한 그리드
        GRID_COLOR1: 0xdcdcdc,
        GRID_COLOR2: 0xe8e8e8
    },
    
    // 컨트롤 설정
    CONTROLS: {
        ENABLE_DAMPING: true,
        DAMPING_FACTOR: 0.05
    },
    
    // UI 설정
    UI: {
        LOADING_TIMEOUT: 3000,  // 로딩 메시지 표시 시간 (ms)
        FPS_LOG_INTERVAL: 300   // FPS 로그 출력 간격 (프레임)
    }
};

/**
 * 디버그 로그 함수
 * @param  {...any} args - 로그 메시지
 */
export function debugLog(...args) {
    if (CONFIG.DEBUG_MODE) {
        console.log(...args);
    }
}

/**
 * 특정 위치가 제외 위치인지 확인
 * @param {number} row - 행 번호
 * @param {number} col - 열 번호
 * @returns {boolean} 제외 위치 여부
 */
export function isExcludedPosition(row, col) {
    return CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.some(
        pos => pos.row === row && pos.col === col
    );
}

/**
 * 제외 위치 통계 반환
 * @returns {Object} 제외 위치 통계
 */
export function getExcludedStatistics() {
    const byCol = {};
    const byRow = {};
    
    CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.forEach(pos => {
        // 열별 통계
        if (!byCol[pos.col]) byCol[pos.col] = [];
        byCol[pos.col].push(pos.row);
        
        // 행별 통계
        if (!byRow[pos.row]) byRow[pos.row] = [];
        byRow[pos.row].push(pos.col);
    });
    
    return {
        total: CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length,
        byColumn: byCol,
        byRow: byRow
    };
}

/**
 * 제외 위치 범위 생성 (외부에서도 사용 가능하도록 export)
 */
export { createExcludedRange };