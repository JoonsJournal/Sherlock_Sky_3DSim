/**
 * performance-icons.js
 * ====================
 * Performance 섹션용 SVG 아이콘
 * 
 * @version 1.0.0
 * @created 2026-01-21
 * @updated 2026-01-21
 * 
 * @description
 * StatusBarPerformanceCompact 컴포넌트에서 사용하는 아이콘 세트
 * - Feather Icons 기반 (14x14, stroke 스타일)
 * - 4개 카테고리: Rendering, Network, Cache, Alerts
 * 
 * @usage
 * import { PERFORMANCE_ICONS, getPerformanceIcon } from './performance-icons.js';
 * 
 * // 직접 사용
 * element.innerHTML = PERFORMANCE_ICONS.monitor;
 * 
 * // Helper 함수 사용 (옵션 지정)
 * element.innerHTML = getPerformanceIcon('monitor', { size: 16, color: '#ff0000' });
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/icons/performance-icons.js
 */

// =============================================================================
// SVG Icon Definitions (14x14, stroke-based)
// =============================================================================

export const PERFORMANCE_ICONS = {
    // =========================================================================
    // Rendering Category
    // =========================================================================
    
    /**
     * FPS (monitor icon)
     * 모니터 형태 아이콘 - FPS 표시용
     */
    monitor: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
    
    /**
     * Memory (cpu icon)
     * CPU/칩 형태 아이콘 - Memory 사용량 표시용
     */
    cpu: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`,
    
    /**
     * Draw Calls (layers icon)
     * 레이어 형태 아이콘 - Draw Calls 표시용
     */
    layers: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
    
    /**
     * Frame Time (clock icon)
     * 시계 형태 아이콘 - Frame Time 표시용
     */
    clock: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    
    // =========================================================================
    // Network Category
    // =========================================================================
    
    /**
     * Latency (wifi icon)
     * 와이파이 형태 아이콘 - Network Latency 표시용
     */
    wifi: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`,
    
    /**
     * Messages In (arrow-down icon)
     * 하향 화살표 아이콘 - 수신 메시지 표시용
     */
    arrowDown: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`,
    
    /**
     * Messages Out (arrow-up icon)
     * 상향 화살표 아이콘 - 발신 메시지 표시용
     */
    arrowUp: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
    
    // =========================================================================
    // Cache Category
    // =========================================================================
    
    /**
     * Cache Hit Rate (database icon)
     * 데이터베이스 형태 아이콘 - Cache Hit Rate 표시용
     */
    database: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
    
    /**
     * Delta Updates (refresh-cw icon)
     * 새로고침 형태 아이콘 - Delta Update 표시용
     */
    refreshCw: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
    
    // =========================================================================
    // Alerts Category
    // =========================================================================
    
    /**
     * Warning (alert-triangle icon)
     * 삼각형 경고 아이콘 - Warning 상태 표시용
     */
    alertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    
    /**
     * Error (x-circle icon)
     * X 원형 아이콘 - Error 상태 표시용
     */
    xCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    
    // =========================================================================
    // Utility Icons (추가)
    // =========================================================================
    
    /**
     * Activity (activity icon)
     * 활동 그래프 형태 아이콘 - 일반 활동 표시용
     */
    activity: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
    
    /**
     * Zap (lightning bolt icon)
     * 번개 형태 아이콘 - 빠른 처리 표시용
     */
    zap: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    
    /**
     * Gauge (speedometer icon)
     * 게이지 형태 아이콘 - 성능 지표 표시용
     */
    gauge: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12L19.3 4.7"></path></svg>`,
    
    /**
     * Check Circle (success icon)
     * 체크 원형 아이콘 - 성공 상태 표시용
     */
    checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
};

// =============================================================================
// Icon Name Mapping (한글 및 대체 이름 지원)
// =============================================================================

const ICON_ALIASES = {
    // 한글 별칭
    '모니터': 'monitor',
    '메모리': 'cpu',
    '레이어': 'layers',
    '시계': 'clock',
    '와이파이': 'wifi',
    '수신': 'arrowDown',
    '발신': 'arrowUp',
    '데이터베이스': 'database',
    '새로고침': 'refreshCw',
    '경고': 'alertTriangle',
    '오류': 'xCircle',
    '활동': 'activity',
    '번개': 'zap',
    '게이지': 'gauge',
    '성공': 'checkCircle',
    
    // 영문 별칭 (대소문자 무관)
    'fps': 'monitor',
    'mem': 'cpu',
    'memory': 'cpu',
    'draw_calls': 'layers',
    'drawcalls': 'layers',
    'frame_time': 'clock',
    'frametime': 'clock',
    'latency': 'wifi',
    'ping': 'wifi',
    'messages_in': 'arrowDown',
    'in': 'arrowDown',
    'messages_out': 'arrowUp',
    'out': 'arrowUp',
    'cache': 'database',
    'cachehitrate': 'database',
    'cache_hit_rate': 'database',
    'delta': 'refreshCw',
    'delta_updates': 'refreshCw',
    'warning': 'alertTriangle',
    'warn': 'alertTriangle',
    'error': 'xCircle',
    'critical': 'xCircle',
    'success': 'checkCircle',
    'ok': 'checkCircle'
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 아이콘 이름으로 SVG 문자열 가져오기
 * 
 * @param {string} name - 아이콘 이름 (별칭 지원)
 * @param {Object} [options={}] - 옵션
 * @param {number} [options.size=14] - 아이콘 크기 (width, height)
 * @param {string} [options.color] - 아이콘 색상 (CSS color)
 * @param {string} [options.className] - 추가 CSS 클래스명
 * @returns {string} SVG 문자열 (아이콘 없으면 빈 문자열)
 * 
 * @example
 * // 기본 사용
 * const icon = getPerformanceIcon('monitor');
 * 
 * // 크기 변경
 * const icon = getPerformanceIcon('monitor', { size: 16 });
 * 
 * // 색상 및 클래스 지정
 * const icon = getPerformanceIcon('warning', { color: '#ff0000', className: 'blink' });
 */
export function getPerformanceIcon(name, options = {}) {
    // 이름 정규화 (소문자, 언더스코어 제거)
    const normalizedName = String(name).toLowerCase().replace(/[_-]/g, '');
    
    // 별칭에서 실제 아이콘 이름 찾기
    const iconName = ICON_ALIASES[normalizedName] || ICON_ALIASES[name] || name;
    
    // 아이콘 가져오기
    let svg = PERFORMANCE_ICONS[iconName];
    
    if (!svg) {
        console.warn(`[performance-icons] 알 수 없는 아이콘: ${name}`);
        return '';
    }
    
    // 옵션 적용
    const { size, color, className } = options;
    
    if (size && size !== 14) {
        svg = svg.replace(/width="14"/g, `width="${size}"`);
        svg = svg.replace(/height="14"/g, `height="${size}"`);
    }
    
    if (color) {
        // stroke="currentColor"를 지정된 색상으로 변경
        svg = svg.replace(/stroke="currentColor"/g, `stroke="${color}"`);
    }
    
    if (className) {
        // class 속성 추가
        svg = svg.replace('<svg ', `<svg class="${className}" `);
    }
    
    return svg;
}

/**
 * 사용 가능한 모든 아이콘 이름 목록 반환
 * 
 * @returns {string[]} 아이콘 이름 배열
 */
export function getAvailableIcons() {
    return Object.keys(PERFORMANCE_ICONS);
}

/**
 * 카테고리별 아이콘 목록 반환
 * 
 * @returns {Object} { rendering: [...], network: [...], cache: [...], alerts: [...], utility: [...] }
 */
export function getIconsByCategory() {
    return {
        rendering: ['monitor', 'cpu', 'layers', 'clock'],
        network: ['wifi', 'arrowDown', 'arrowUp'],
        cache: ['database', 'refreshCw'],
        alerts: ['alertTriangle', 'xCircle'],
        utility: ['activity', 'zap', 'gauge', 'checkCircle']
    };
}

// =============================================================================
// Default Export
// =============================================================================

export default PERFORMANCE_ICONS;