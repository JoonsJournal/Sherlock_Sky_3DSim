/**
 * IconRegistry.js
 * ================
 * Cleanroom Sidebar - SVG 아이콘 레지스트리
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * 
 * 사용법:
 *   import { ICONS, getIcon } from './IconRegistry.js';
 *   element.innerHTML = getIcon('connection');
 */

/**
 * SVG 아이콘 정의
 * viewBox="0 0 24 24", stroke 기반
 */
export const ICONS = {
    // Connection (Database)
    connection: `<svg viewBox="0 0 24 24">
        <ellipse cx="7" cy="5" rx="5" ry="2"/>
        <path d="M2 5v4c0 1.1 2.24 2 5 2s5-.9 5-2V5"/>
        <path d="M2 9v4c0 1.1 2.24 2 5 2s5-.9 5-2V9"/>
        <ellipse cx="17" cy="11" rx="5" ry="2"/>
        <path d="M12 11v4c0 1.1 2.24 2 5 2s5-.9 5-2v-4"/>
        <path d="M12 15v4c0 1.1 2.24 2 5 2s5-.9 5-2v-4"/>
    </svg>`,
    
    // Monitoring (Monitor with Graph)
    monitoring: `<svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="12" rx="2"/>
        <polyline points="6 10 9 10 11 7 13 13 15 10 18 10"/>
        <path d="M12 16v4"/>
        <path d="M8 20h8"/>
    </svg>`,
    
    // Analysis (Chart with Trend)
    analysis: `<svg viewBox="0 0 24 24">
        <path d="M21 21H4.6c-.6 0-1.1-.5-1.1-1.1V3"/>
        <path d="M7 14l4-4 4 4 6-6"/>
        <circle cx="21" cy="8" r="2"/>
    </svg>`,
    
    // Simulation (Gear with Rays)
    simulation: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v4"/>
        <path d="M12 18v4"/>
        <path d="M4.93 4.93l2.83 2.83"/>
        <path d="M16.24 16.24l2.83 2.83"/>
        <path d="M2 12h4"/>
        <path d="M18 12h4"/>
    </svg>`,
    
    // Layout (Grid)
    layout: `<svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
    </svg>`,
    
    // Settings (Gear)
    settings: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
    
    // Debug (Wrench)
    debug: `<svg viewBox="0 0 24 24">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>`,
    
    // 3D View (Layers)
    '3d-view': `<svg viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>`,
    
    // Ranking View (Bar Chart)
    'ranking-view': `<svg viewBox="0 0 24 24">
        <path d="M18 20V10"/>
        <path d="M12 20V4"/>
        <path d="M6 20v-6"/>
    </svg>`,
    
    // Layout Editor
    'layout-editor': `<svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
    </svg>`,
    
    // Equipment Mapping (Link)
    mapping: `<svg viewBox="0 0 24 24">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>`,
    
    // Code (Dev Mode)
    code: `<svg viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
    </svg>`,
    
    // Sun (Theme Light)
    sun: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5"/>
    </svg>`,
    
    // Moon (Theme Dark)
    moon: `<svg viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,
    
    // Close (X)
    close: `<svg viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,
    
    // Check
    check: `<svg viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"/>
    </svg>`,
    
    // Info
    info: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`,
    
    // Warning
    warning: `<svg viewBox="0 0 24 24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
    
    // Refresh
    refresh: `<svg viewBox="0 0 24 24">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>`,
    
    // Play
    play: `<svg viewBox="0 0 24 24">
        <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>`,
    
    // Pause
    pause: `<svg viewBox="0 0 24 24">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
    </svg>`,
    
    // Stop
    stop: `<svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    </svg>`,
    
    // Arrow Right (Submenu indicator)
    arrowRight: `<svg viewBox="0 0 24 24">
        <polyline points="9 18 15 12 9 6"/>
    </svg>`,
    
    // Database
    database: `<svg viewBox="0 0 24 24">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`,
    
    // Server
    server: `<svg viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/>
        <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>`,
    
    // Wifi
    wifi: `<svg viewBox="0 0 24 24">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
        <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>`,
    
    // Wifi Off
    wifiOff: `<svg viewBox="0 0 24 24">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>`,
    
    // CPU
    cpu: `<svg viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
        <rect x="9" y="9" width="6" height="6"/>
        <line x1="9" y1="1" x2="9" y2="4"/>
        <line x1="15" y1="1" x2="15" y2="4"/>
        <line x1="9" y1="20" x2="9" y2="23"/>
        <line x1="15" y1="20" x2="15" y2="23"/>
        <line x1="20" y1="9" x2="23" y2="9"/>
        <line x1="20" y1="14" x2="23" y2="14"/>
        <line x1="1" y1="9" x2="4" y2="9"/>
        <line x1="1" y1="14" x2="4" y2="14"/>
    </svg>`,
    
    // Memory (HardDrive)
    memory: `<svg viewBox="0 0 24 24">
        <line x1="22" y1="12" x2="2" y2="12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        <line x1="6" y1="16" x2="6.01" y2="16"/>
        <line x1="10" y1="16" x2="10.01" y2="16"/>
    </svg>`,
    
    // Equipment / Box
    equipment: `<svg viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>`
};

/**
 * 아이콘 가져오기 헬퍼 함수
 * @param {string} name - 아이콘 이름
 * @param {Object} options - 옵션
 * @param {string} options.className - 추가 CSS 클래스
 * @param {number} options.size - 아이콘 크기 (px)
 * @returns {string} SVG 문자열
 */
export function getIcon(name, options = {}) {
    const svg = ICONS[name];
    if (!svg) {
        console.warn(`[IconRegistry] 아이콘을 찾을 수 없음: ${name}`);
        return ICONS.info; // 기본 아이콘 반환
    }
    
    // 옵션 적용
    if (options.className || options.size) {
        let modifiedSvg = svg;
        
        // 클래스 추가
        if (options.className) {
            modifiedSvg = modifiedSvg.replace('<svg', `<svg class="${options.className}"`);
        }
        
        // 크기 설정
        if (options.size) {
            modifiedSvg = modifiedSvg.replace(
                '<svg',
                `<svg width="${options.size}" height="${options.size}"`
            );
        }
        
        return modifiedSvg;
    }
    
    return svg;
}

/**
 * 아이콘 목록 가져오기
 * @returns {string[]} 사용 가능한 아이콘 이름 목록
 */
export function getIconList() {
    return Object.keys(ICONS);
}

/**
 * 아이콘 존재 여부 확인
 * @param {string} name - 아이콘 이름
 * @returns {boolean}
 */
export function hasIcon(name) {
    return name in ICONS;
}

// 기본 내보내기
export default { ICONS, getIcon, getIconList, hasIcon };