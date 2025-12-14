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
    
    // 조명 설정 - 공장 스타일
    LIGHTING: {
        AMBIENT: {
            COLOR: 0xffffff,
            INTENSITY: 0.7  // 더 밝게
        },
        DIRECTIONAL: {
            COLOR: 0xffffff,
            INTENSITY: 1.0,  // 더 밝게
            POSITION: { x: 20, y: 40, z: 20 }  // 더 높게
        },
        POINT: {
            COLOR: 0xffffcc,  // 따뜻한 흰색 (공장 조명)
            INTENSITY: 0.6,
            POSITION: { x: -20, y: 20, z: -20 }
        },
        // 추가 공장 조명 (HemisphereLight)
        HEMISPHERE: {
            SKY_COLOR: 0xffffee,     // 밝은 하늘색 톤
            GROUND_COLOR: 0x777777,  // 지면 반사광
            INTENSITY: 0.5
        }
    },
    
    // 씬 설정 - 공장 분위기
    SCENE: {
        BACKGROUND_COLOR: 0xb0c4de,  // 라이트 스틸 블루 (공장 창문으로 보이는 하늘)
        FLOOR_SIZE: 60,
        FLOOR_COLOR: 0x8c8c8c,       // 콘크리트 회색
        FLOOR_ROUGHNESS: 0.9,        // 거친 콘크리트 표면
        GRID_DIVISIONS: 60,
        GRID_COLOR1: 0x666666,       // 더 명확한 그리드
        GRID_COLOR2: 0x444444
    },
    
    // 공장 환경 설정
    FACTORY_ENVIRONMENT: {
        // 벽 설정
        WALLS: {
            ENABLED: true,
            HEIGHT: 8,
            THICKNESS: 0.3,
            COLOR: 0xcccccc,        // 밝은 회색 벽
            ROUGHNESS: 0.8
        },
        // 기둥 설정
        PILLARS: {
            ENABLED: true,
            WIDTH: 0.4,
            HEIGHT: 8,
            COLOR: 0x999999,        // 어두운 회색
            SPACING: 10             // 10m 간격
        },
        // 천장 트러스 (공장 천장 구조물)
        CEILING_TRUSS: {
            ENABLED: true,
            HEIGHT: 7.5,
            COLOR: 0x666666,
            BEAM_SIZE: 0.2
        },
        // 파이프/배관
        PIPES: {
            ENABLED: true,
            COLOR: 0x4a4a4a,
            RADIUS: 0.1,
            HEIGHT: 6
        },
        // 안전 표시 (Safety Signs)
        SAFETY_SIGNS: {
            ENABLED: true,
            COLOR: 0xffff00,        // 노란색
            STRIPE_COLOR: 0x000000  // 검정 줄무늬
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