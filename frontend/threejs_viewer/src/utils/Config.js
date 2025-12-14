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
    
    // 조명 설정 (공장 스타일)
    LIGHTING: {
        AMBIENT: {
            COLOR: 0xffffff,
            INTENSITY: 0.9  // 밝게 조정 (공장은 밝음)
        },
        DIRECTIONAL: {
            COLOR: 0xffffff,
            INTENSITY: 1.0,  // 더 밝게
            POSITION: { x: 20, y: 35, z: 20 }  // 높이 증가
        },
        POINT: {
            COLOR: 0xffffff,
            INTENSITY: 0.6,
            POSITION: { x: -20, y: 25, z: -20 }
        },
        // 추가 공장 조명 (형광등 스타일)
        FACTORY_LIGHTS: {
            COLOR: 0xf0f0ff,  // 약간 차가운 백색
            INTENSITY: 0.8,
            COUNT: 12,        // 조명 개수
            HEIGHT: 8,        // 조명 높이
            SPACING: 10       // 조명 간격
        }
    },
    
    // 씬 설정 (공장 스타일)
    SCENE: {
        BACKGROUND_COLOR: 0x87CEEB,  // 하늘색 (공장 분위기)
        FLOOR_SIZE: 50,
        FLOOR_COLOR: 0x2d3436,
        GRID_DIVISIONS: 50,
        GRID_COLOR1: 0x444444,
        GRID_COLOR2: 0x222222
    },
    
    // 공장 환경 설정
    FACTORY: {
        // 바닥
        FLOOR: {
            COLOR: 0xb0b0b0,           // 밝은 회색 (콘크리트)
            ROUGHNESS: 0.9,             // 거친 표면
            METALNESS: 0.1,             // 약간의 금속성
            GRID_COLOR: 0x808080,       // 그리드 색상
            GRID_COLOR_SECONDARY: 0x606060
        },
        // 벽면
        WALL: {
            COLOR: 0xe0e0e0,            // 밝은 회색/흰색
            HEIGHT: 8,                   // 8m 높이
            THICKNESS: 0.3               // 30cm 두께
        },
        // 기둥
        PILLAR: {
            COLOR: 0x708090,            // 회색 (철제)
            WIDTH: 0.4,                  // 40cm x 40cm
            HEIGHT: 8                    // 8m 높이
        },
        // 안전 라인
        SAFETY_LINE: {
            COLOR: 0xFFD700,            // 노란색 (안전색)
            WIDTH: 0.15                  // 15cm 폭
        },
        // 작업 영역
        WORK_ZONE: {
            COLOR: 0x90EE90,            // 연한 녹색
            OPACITY: 0.1                 // 반투명
        },
        // 천장 구조물
        OVERHEAD_BEAM: {
            COLOR: 0x4682B4,            // 강철 파란색
            WIDTH: 0.3,
            HEIGHT: 0.4,
            POSITION_Y: 7.5              // 천장 높이
        }
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