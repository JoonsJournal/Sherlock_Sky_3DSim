/**
 * IconRegistry.js
 * ================
 * SHERLOCK SKY 3DSim - 통합 SVG 아이콘 관리 시스템
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 2.0.0
 * @created 2026-01-11
 * 
 * @description
 * - 모든 UI 컴포넌트에서 사용하는 SVG 아이콘 중앙 관리
 * - 클래스 기반 API + 함수형 API 동시 지원
 * - 커스텀 아이콘 등록 지원
 * - 카테고리별 아이콘 그룹화
 * 
 * 사용법:
 *   // 함수형 API (기존 sidebar/IconRegistry 호환)
 *   import { ICONS, getIcon } from '../icons/IconRegistry.js';
 *   element.innerHTML = getIcon('connection');
 * 
 *   // 클래스 기반 API
 *   import { iconRegistry } from '../icons/IconRegistry.js';
 *   const svg = iconRegistry.createIcon('monitoring', { size: 32 });
 * 
 * 파일 위치: frontend/threejs_viewer/src/ui/icons/IconRegistry.js
 */

// ============================================
// SVG 아이콘 정의 (viewBox: 0 0 24 24, stroke 기반)
// ============================================

export const ICONS = {
    // =============================================
    // 메인 네비게이션 아이콘 (Sidebar)
    // =============================================
    
    /** Connection (Database) - 데이터베이스 연결 */
    connection: `<svg viewBox="0 0 24 24">
        <ellipse cx="7" cy="5" rx="5" ry="2"/>
        <path d="M2 5v4c0 1.1 2.24 2 5 2s5-.9 5-2V5"/>
        <path d="M2 9v4c0 1.1 2.24 2 5 2s5-.9 5-2V9"/>
        <ellipse cx="17" cy="11" rx="5" ry="2"/>
        <path d="M12 11v4c0 1.1 2.24 2 5 2s5-.9 5-2v-4"/>
        <path d="M12 15v4c0 1.1 2.24 2 5 2s5-.9 5-2v-4"/>
    </svg>`,
    
    /** Monitoring - 시스템 모니터링 */
    monitoring: `<svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="12" rx="2"/>
        <polyline points="6 10 9 10 11 7 13 13 15 10 18 10"/>
        <path d="M12 16v4"/>
        <path d="M8 20h8"/>
    </svg>`,
    
    /** Analysis - 분석 / 차트 */
    analysis: `<svg viewBox="0 0 24 24">
        <path d="M21 21H4.6c-.6 0-1.1-.5-1.1-1.1V3"/>
        <path d="M7 14l4-4 4 4 6-6"/>
        <circle cx="21" cy="8" r="2"/>
    </svg>`,
    
    /** Simulation - 시뮬레이션 */
    simulation: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v4"/>
        <path d="M12 18v4"/>
        <path d="M4.93 4.93l2.83 2.83"/>
        <path d="M16.24 16.24l2.83 2.83"/>
        <path d="M2 12h4"/>
        <path d="M18 12h4"/>
    </svg>`,
    
    /** Layout - 레이아웃 편집기 */
    layout: `<svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
    </svg>`,
    
    /** Settings - 설정 */
    settings: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
    
    /** Debug - 디버그 도구 */
    debug: `<svg viewBox="0 0 24 24">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>`,
    
    // =============================================
    // 서브메뉴 아이콘
    // =============================================
    
    /** 3D View - 3D 뷰어 (Monitoring 서브메뉴) */
    '3d-view': `<svg viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>`,
    
    /** Ranking View - 랭킹 뷰 (Monitoring 서브메뉴) */
    'ranking-view': `<svg viewBox="0 0 24 24">
        <path d="M18 20V10"/>
        <path d="M12 20V4"/>
        <path d="M6 20v-6"/>
    </svg>`,
    
    /** Layout Editor - 레이아웃 에디터 (Layout 서브메뉴) */
    'layout-editor': `<svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
    </svg>`,
    
    /** Mapping - 장비 매핑 (Layout 서브메뉴) */
    mapping: `<svg viewBox="0 0 24 24">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>`,
    
    /** Code - 개발자 모드 (Settings 서브메뉴) */
    code: `<svg viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
    </svg>`,
    
    /** Edit - 편집 모드 */
    edit: `<svg viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
    </svg>`,
    
    /** Viewer - 3D 뷰어 (네비게이션) */
    viewer: `<svg viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>`,
    
    // =============================================
    // 테마 & UI 아이콘
    // =============================================
    
    /** Sun - 라이트 테마 */
    sun: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`,
    
    /** Moon - 다크 테마 */
    moon: `<svg viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,
    
    // =============================================
    // 상태 아이콘
    // =============================================
    
    /** Success - 성공 */
    success: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9 12l2 2 4-4"/>
    </svg>`,
    
    /** Error - 에러 */
    error: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`,
    
    /** Warning - 경고 */
    warning: `<svg viewBox="0 0 24 24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
    
    /** Info - 정보 */
    info: `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`,
    
    // =============================================
    // 유틸리티 아이콘
    // =============================================
    
    /** Close - 닫기 */
    close: `<svg viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,
    
    /** Check - 체크 */
    check: `<svg viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"/>
    </svg>`,
    
    /** Refresh - 새로고침 */
    refresh: `<svg viewBox="0 0 24 24">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>`,
    
    /** Save - 저장 */
    save: `<svg viewBox="0 0 24 24">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
    </svg>`,
    
    /** Menu - 메뉴 */
    menu: `<svg viewBox="0 0 24 24">
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>`,
    
    /** Arrow Right - 서브메뉴 인디케이터 */
    arrowRight: `<svg viewBox="0 0 24 24">
        <polyline points="9 18 15 12 9 6"/>
    </svg>`,
    
    /** Preview - 미리보기 */
    preview: `<svg viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>`,
    
    // =============================================
    // 컨트롤 아이콘
    // =============================================
    
    /** Play - 재생 */
    play: `<svg viewBox="0 0 24 24">
        <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>`,
    
    /** Pause - 일시정지 */
    pause: `<svg viewBox="0 0 24 24">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
    </svg>`,
    
    /** Stop - 정지 */
    stop: `<svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    </svg>`,
    
    // =============================================
    // 시스템 / 하드웨어 아이콘
    // =============================================
    
    /** Database - 데이터베이스 */
    database: `<svg viewBox="0 0 24 24">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`,
    
    /** Server - 서버 */
    server: `<svg viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/>
        <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>`,
    
    /** Wifi - 네트워크 연결됨 */
    wifi: `<svg viewBox="0 0 24 24">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
        <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>`,
    
    /** Wifi Off - 네트워크 끊김 */
    wifiOff: `<svg viewBox="0 0 24 24">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>`,
    
    /** CPU - 프로세서 */
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
    
    /** Memory - 메모리 / 하드드라이브 */
    memory: `<svg viewBox="0 0 24 24">
        <line x1="22" y1="12" x2="2" y2="12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        <line x1="6" y1="16" x2="6.01" y2="16"/>
        <line x1="10" y1="16" x2="10.01" y2="16"/>
    </svg>`,
    
    /** Equipment - 설비 / 박스 */
    equipment: `<svg viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>`,
    
    // =============================================
    // 추가 유틸리티 아이콘
    // =============================================
    
    /** Plus - 추가 */
    plus: `<svg viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,
    
    /** Minus - 제거 */
    minus: `<svg viewBox="0 0 24 24">
        <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,
    
    /** Trash - 삭제 */
    trash: `<svg viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`,
    
    /** Download - 다운로드 */
    download: `<svg viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`,
    
    /** Upload - 업로드 */
    upload: `<svg viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>`,
    
    /** Search - 검색 */
    search: `<svg viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>`,
    
    /** Filter - 필터 */
    filter: `<svg viewBox="0 0 24 24">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>`,
    
    /** Sort - 정렬 */
    sort: `<svg viewBox="0 0 24 24">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="15" y2="12"/>
        <line x1="3" y1="18" x2="9" y2="18"/>
    </svg>`,
    
    /** Expand - 확장 */
    expand: `<svg viewBox="0 0 24 24">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>`,
    
    /** Collapse - 축소 */
    collapse: `<svg viewBox="0 0 24 24">
        <polyline points="4 14 10 14 10 20"/>
        <polyline points="20 10 14 10 14 4"/>
        <line x1="14" y1="10" x2="21" y2="3"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>`
};

// ============================================
// 아이콘 메타데이터
// ============================================

export const ICON_META = {
    connection:     { name: 'Connection',       shortcut: 'Ctrl+K', category: 'navigation' },
    monitoring:     { name: 'Monitoring',       shortcut: 'M',      category: 'navigation' },
    analysis:       { name: 'Analysis',         shortcut: null,     category: 'navigation' },
    simulation:     { name: 'Simulation',       shortcut: null,     category: 'navigation' },
    layout:         { name: 'Layout',           shortcut: null,     category: 'navigation' },
    settings:       { name: 'Settings',         shortcut: null,     category: 'navigation' },
    debug:          { name: 'Debug',            shortcut: 'D',      category: 'navigation' },
    '3d-view':      { name: '3D View',          shortcut: null,     category: 'submenu' },
    'ranking-view': { name: 'Ranking View',     shortcut: null,     category: 'submenu' },
    'layout-editor':{ name: 'Layout Editor',    shortcut: null,     category: 'submenu' },
    mapping:        { name: 'Equipment Mapping',shortcut: null,     category: 'submenu' },
    code:           { name: 'Code / Dev Mode',  shortcut: null,     category: 'submenu' },
    edit:           { name: 'Edit Mode',        shortcut: 'E',      category: 'submenu' },
    viewer:         { name: '3D Viewer',        shortcut: null,     category: 'submenu' },
    sun:            { name: 'Light Theme',      shortcut: null,     category: 'theme' },
    moon:           { name: 'Dark Theme',       shortcut: null,     category: 'theme' },
    success:        { name: 'Success',          shortcut: null,     category: 'status' },
    error:          { name: 'Error',            shortcut: null,     category: 'status' },
    warning:        { name: 'Warning',          shortcut: null,     category: 'status' },
    info:           { name: 'Info',             shortcut: null,     category: 'status' },
    close:          { name: 'Close',            shortcut: 'Esc',    category: 'utility' },
    check:          { name: 'Check',            shortcut: null,     category: 'utility' },
    refresh:        { name: 'Refresh',          shortcut: null,     category: 'utility' },
    save:           { name: 'Save',             shortcut: 'Ctrl+S', category: 'utility' },
    menu:           { name: 'Menu',             shortcut: null,     category: 'utility' },
    arrowRight:     { name: 'Arrow Right',      shortcut: null,     category: 'utility' },
    preview:        { name: 'Preview',          shortcut: 'P',      category: 'utility' },
    play:           { name: 'Play',             shortcut: null,     category: 'control' },
    pause:          { name: 'Pause',            shortcut: null,     category: 'control' },
    stop:           { name: 'Stop',             shortcut: null,     category: 'control' },
    database:       { name: 'Database',         shortcut: null,     category: 'system' },
    server:         { name: 'Server',           shortcut: null,     category: 'system' },
    wifi:           { name: 'Wifi',             shortcut: null,     category: 'system' },
    wifiOff:        { name: 'Wifi Off',         shortcut: null,     category: 'system' },
    cpu:            { name: 'CPU',              shortcut: null,     category: 'system' },
    memory:         { name: 'Memory',           shortcut: null,     category: 'system' },
    equipment:      { name: 'Equipment',        shortcut: null,     category: 'system' },
    plus:           { name: 'Plus',             shortcut: null,     category: 'utility' },
    minus:          { name: 'Minus',            shortcut: null,     category: 'utility' },
    trash:          { name: 'Trash',            shortcut: null,     category: 'utility' },
    download:       { name: 'Download',         shortcut: null,     category: 'utility' },
    upload:         { name: 'Upload',           shortcut: null,     category: 'utility' },
    search:         { name: 'Search',           shortcut: null,     category: 'utility' },
    filter:         { name: 'Filter',           shortcut: null,     category: 'utility' },
    sort:           { name: 'Sort',             shortcut: null,     category: 'utility' },
    expand:         { name: 'Expand',           shortcut: null,     category: 'utility' },
    collapse:       { name: 'Collapse',         shortcut: null,     category: 'utility' }
};

// ============================================
// IconRegistry 클래스
// ============================================

/**
 * IconRegistry 클래스
 * SVG 아이콘 생성 및 관리
 */
export class IconRegistry {
    constructor(options = {}) {
        this.icons = { ...ICONS };
        this.meta = { ...ICON_META };
        this.defaultSize = options.defaultSize || 36;
        this.defaultStrokeWidth = options.defaultStrokeWidth || 1;
        this.defaultColor = options.defaultColor || 'currentColor';
    }
    
    /**
     * SVG 아이콘 생성 (DOM Element)
     * @param {string} iconName - 아이콘 이름 (ICONS 키)
     * @param {Object} options - 옵션
     * @returns {SVGElement}
     */
    createIcon(iconName, options = {}) {
        const svgString = this.icons[iconName];
        if (!svgString) {
            console.warn(`IconRegistry: Unknown icon "${iconName}"`);
            return this._createPlaceholder(options);
        }
        
        const { size = this.defaultSize, strokeWidth = this.defaultStrokeWidth, className = '', color = this.defaultColor } = options;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        
        if (!svg) return this._createPlaceholder(options);
        
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', color);
        svg.setAttribute('stroke-width', strokeWidth);
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        if (className) svg.setAttribute('class', className);
        
        return svg;
    }
    
    /**
     * HTML 문자열로 아이콘 반환 (옵션 적용)
     */
    getIconHTML(iconName, options = {}) {
        const svgString = this.icons[iconName];
        if (!svgString) return this._getPlaceholderHTML(options);
        
        const { size = this.defaultSize, strokeWidth = this.defaultStrokeWidth, className = '', color = this.defaultColor } = options;
        const match = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
        const innerContent = match ? match[1] : '';
        
        return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${className ? ` class="${className}"` : ''}>${innerContent}</svg>`;
    }
    
    getIconInfo(iconName) { return this.meta[iconName] || null; }
    hasIcon(iconName) { return iconName in this.icons; }
    listIcons() { return Object.keys(this.icons); }
    
    getIconsByCategory() {
        const categories = {};
        Object.entries(this.meta).forEach(([name, info]) => {
            const category = info.category || 'other';
            if (!categories[category]) categories[category] = [];
            categories[category].push(name);
        });
        return categories;
    }
    
    registerIcon(name, svgString, meta = {}) {
        if (this.icons[name]) console.warn(`IconRegistry: Overwriting existing icon "${name}"`);
        this.icons[name] = svgString;
        this.meta[name] = { name: meta.name || name, shortcut: meta.shortcut || null, category: meta.category || 'custom' };
    }
    
    unregisterIcon(name) { delete this.icons[name]; delete this.meta[name]; }
    
    _createPlaceholder(options = {}) {
        const size = options.size || this.defaultSize;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.innerHTML = `<rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none"/><text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor">?</text>`;
        return svg;
    }
    
    _getPlaceholderHTML(options = {}) {
        const size = options.size || this.defaultSize;
        return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none"/><text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor">?</text></svg>`;
    }
}

// ============================================
// 싱글톤 및 함수형 API
// ============================================

/** 싱글톤 인스턴스 */
export const iconRegistry = new IconRegistry();

/**
 * 아이콘 SVG 문자열 가져오기 (함수형 API)
 * 기존 sidebar/IconRegistry와 100% 호환
 */
export function getIcon(name, options = {}) {
    const svg = ICONS[name];
    if (!svg) {
        console.warn(`[IconRegistry] 아이콘을 찾을 수 없음: ${name}`);
        return ICONS.info;
    }
    
    if (options.className || options.size) {
        let modifiedSvg = svg;
        if (options.className) modifiedSvg = modifiedSvg.replace('<svg', `<svg class="${options.className}"`);
        if (options.size) modifiedSvg = modifiedSvg.replace('<svg', `<svg width="${options.size}" height="${options.size}"`);
        return modifiedSvg;
    }
    
    return svg;
}

export function getIconHTML(name, options = {}) { return iconRegistry.getIconHTML(name, options); }
export function getIconList() { return Object.keys(ICONS); }
export function hasIcon(name) { return name in ICONS; }

export default { ICONS, ICON_META, IconRegistry, iconRegistry, getIcon, getIconHTML, getIconList, hasIcon };