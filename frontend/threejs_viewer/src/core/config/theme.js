/**
 * theme.js
 * 색상 시스템 및 테마 정의
 * 
 * @version 1.1.0
 * @description Solid Edge 표준 + 프로젝트 커스텀 색상
 * 
 * 변경사항 (v1.1.0):
 * - VIEWER_3D_COLORS에 Solid Edge 표준 적용
 */

// =====================================================
// Solid Edge 객체 상태 색상
// =====================================================

export const SOLID_EDGE_COLORS = Object.freeze({
    HIGHLIGHT: '#00BFFF',    // Cyan - 마우스 호버
    SELECTED: '#FF6600',     // Orange - 선택된 객체
    ACTIVE: '#4CAF50',       // Green - 편집 중
    INACTIVE: '#808080',     // Gray - 비활성 (50%)
    CONSTRUCTION: '#FFD700', // Gold - 보조선
    ERROR: '#FF0000',        // Red - 오류
    LOCKED: '#9C27B0'        // Purple - 잠김
});

// Three.js용 (0x 형식)
export const SOLID_EDGE_COLORS_HEX = Object.freeze({
    HIGHLIGHT: 0x00BFFF,
    SELECTED: 0xFF6600,
    ACTIVE: 0x4CAF50,
    INACTIVE: 0x808080,
    CONSTRUCTION: 0xFFD700,
    ERROR: 0xFF0000,
    LOCKED: 0x9C27B0
});

// =====================================================
// 장비 상태 색상 (Monitoring)
// =====================================================

export const EQUIPMENT_STATUS_COLORS = Object.freeze({
    RUNNING: '#4CAF50',      // Green
    IDLE: '#FFC107',         // Amber
    ALARM: '#F44336',        // Red
    MAINTENANCE: '#2196F3',  // Blue
    OFFLINE: '#9E9E9E'       // Gray
});

// Three.js용 (0x 형식)
export const EQUIPMENT_STATUS_COLORS_HEX = Object.freeze({
    RUNNING: 0x4CAF50,
    IDLE: 0xFFC107,
    ALARM: 0xF44336,
    MAINTENANCE: 0x2196F3,
    OFFLINE: 0x9E9E9E
});

// StatusVisualizer 호환 (기존 코드와 호환성)
export const LEGACY_STATUS_COLORS = Object.freeze({
    running: 0x2ecc71,  // 녹색
    idle: 0xf39c12,     // 주황색
    error: 0xe74c3c     // 빨간색
});

// =====================================================
// Signal Tower 색상
// =====================================================

export const SIGNAL_TOWER_COLORS = Object.freeze({
    RED: '#FF0000',
    YELLOW: '#FFFF00',
    GREEN: '#00FF00',
    BLUE: '#0000FF',
    WHITE: '#FFFFFF'
});

export const SIGNAL_TOWER_COLORS_HEX = Object.freeze({
    RED: 0xFF0000,
    YELLOW: 0xFFFF00,
    GREEN: 0x00FF00,
    BLUE: 0x0000FF,
    WHITE: 0xFFFFFF
});

// =====================================================
// 모드별 UI 강조 색상
// =====================================================

export const MODE_COLORS = Object.freeze({
    CONNECTION: '#2196F3',   // Blue
    EDIT: '#FF9800',         // Orange
    MONITORING: '#4CAF50',   // Green
    LAYOUT: '#9C27B0',       // Purple
    VIEWER: '#607D8B'        // Blue Grey
});

// =====================================================
// 2D Editor 색상
// =====================================================

export const EDITOR_2D_COLORS = Object.freeze({
    // 선택 박스
    SELECTION_STROKE: '#667eea',
    SELECTION_FILL: 'rgba(102, 126, 234, 0.1)',
    
    // Window 선택 (좌→우)
    WINDOW_FILL: 'rgba(0, 102, 255, 0.2)',
    WINDOW_STROKE: '#0066FF',
    
    // Crossing 선택 (우→좌)
    CROSSING_FILL: 'rgba(0, 255, 102, 0.2)',
    CROSSING_STROKE: '#00FF66',
    
    // 좌표 표시
    COORD_BACKGROUND: '#667eea',
    COORD_TEXT: '#ffffff',
    
    // 그리드
    GRID_MAJOR: '#cccccc',
    GRID_MINOR: '#eeeeee',
    
    // 스냅 포인트 (MICE)
    SNAP_MIDPOINT: '#00FFFF',    // Cyan
    SNAP_INTERSECTION: '#FFFF00', // Yellow
    SNAP_CENTER: '#FF00FF',       // Magenta
    SNAP_ENDPOINT: '#00FF00'      // Green
});

// =====================================================
// 3D Viewer 색상 (⭐ Solid Edge 표준 적용)
// =====================================================

export const VIEWER_3D_COLORS = Object.freeze({
    // 배경
    BACKGROUND: 0xf8f8f8,
    
    // 바닥
    FLOOR: 0xf5f5f5,
    
    // 그리드
    GRID_PRIMARY: 0xe5e5e5,
    GRID_SECONDARY: 0xf0f0f0,
    
    // ⭐ 선택 (Solid Edge 표준)
    SELECTION_HIGHLIGHT: 0xFF6600,  // Orange - 선택된 객체
    SELECTION_HOVER: 0x00BFFF,      // Cyan - 마우스 호버
    SELECTION_DESELECTED: 0x000000  // Black - 기본 상태
});

// =====================================================
// 컴포넌트 기본 색상 (2D Editor)
// =====================================================

export const COMPONENT_COLORS = Object.freeze({
    PARTITION: '#888888',
    DESK: '#8B4513',
    PILLAR: '#333333',
    OFFICE: '#87CEEB',
    EQUIPMENT: '#FF8C00',
    WALL: '#666666'
});

// =====================================================
// Toast/Alert 색상
// =====================================================

export const TOAST_COLORS = Object.freeze({
    SUCCESS: {
        background: '#d4edda',
        border: '#c3e6cb',
        text: '#155724'
    },
    ERROR: {
        background: '#f8d7da',
        border: '#f5c6cb',
        text: '#721c24'
    },
    WARNING: {
        background: '#fff3cd',
        border: '#ffeeba',
        text: '#856404'
    },
    INFO: {
        background: '#d1ecf1',
        border: '#bee5eb',
        text: '#0c5460'
    }
});

// =====================================================
// 애니메이션 타이밍
// =====================================================

export const ANIMATION = Object.freeze({
    // 전환 시간 (ms)
    HOVER_IN: 150,
    HOVER_OUT: 200,
    SELECT: 200,
    STATUS_CHANGE: 300,
    
    // 깜빡임 (ms)
    ALARM_BLINK: 500,
    EDIT_PULSE: 1000,
    
    // 이징
    EASING_DEFAULT: 'ease-out',
    EASING_SMOOTH: 'ease-in-out'
});

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * HEX to RGB 변환
 * @param {string} hex - HEX 색상 코드
 * @returns {Object} { r, g, b }
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * HEX to RGBA 변환
 * @param {string} hex - HEX 색상 코드
 * @param {number} alpha - 투명도 (0~1)
 * @returns {string} rgba() 문자열
 */
export function hexToRgba(hex, alpha = 1) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * CSS HEX to Three.js HEX 변환
 * @param {string} cssHex - CSS HEX 색상 (예: '#FF6600')
 * @returns {number} Three.js HEX (예: 0xFF6600)
 */
export function cssToThreeHex(cssHex) {
    return parseInt(cssHex.replace('#', ''), 16);
}

/**
 * Three.js HEX to CSS HEX 변환
 * @param {number} threeHex - Three.js HEX (예: 0xFF6600)
 * @returns {string} CSS HEX (예: '#FF6600')
 */
export function threeToCSS(threeHex) {
    return '#' + threeHex.toString(16).padStart(6, '0').toUpperCase();
}