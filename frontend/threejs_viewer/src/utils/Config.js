/**
 * Config.js
 * 전역 설정 및 상수 관리
 */

export const CONFIG = {
    // 디버그 모드
    DEBUG_MODE: true,
    
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
        INITIAL_POSITION: { x: 20, y: 20, z: 25 }
    },
    
    // 설비 배열 설정
    EQUIPMENT: {
        ROWS: 11,
        COLS: 7,
        SIZE: {
            WIDTH: 1.5,
            HEIGHT: 2.2,
            DEPTH: 2.0
        },
        // 간격 설정 (미터 단위)
        SPACING: {
            DEFAULT: 0.3,      // 기본 간격 30cm
            CORRIDOR_COLS: [2, 4],  // 복도가 있는 열 위치
            CORRIDOR_WIDTH: 1.2     // 복도 폭 1.2m
        }
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
            POSITION: { x: 20, y: 30, z: 20 }
        },
        POINT: {
            COLOR: 0xffffff,
            INTENSITY: 0.5,
            POSITION: { x: -20, y: 20, z: -20 }
        }
    },
    
    // 씬 설정
    SCENE: {
        BACKGROUND_COLOR: 0x1a1a2e,
        FLOOR_SIZE: 50,
        FLOOR_COLOR: 0x2d3436,
        GRID_DIVISIONS: 50,
        GRID_COLOR1: 0x444444,
        GRID_COLOR2: 0x222222
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