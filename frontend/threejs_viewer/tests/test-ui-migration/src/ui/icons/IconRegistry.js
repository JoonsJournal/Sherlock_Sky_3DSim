/**
 * IconRegistry.js
 * ===============
 * SHERLOCK SKY 3DSim - SVG 아이콘 관리 시스템
 * 
 * 모든 사이드바 아이콘을 중앙에서 관리하고,
 * 동적 로딩 및 커스터마이징을 지원합니다.
 * 
 * @version 1.0.0
 * @author SHERLOCK SKY Team
 * @created 2026-01-10
 */

/**
 * 아이콘 SVG 정의
 * viewBox는 모두 "0 0 24 24" 기준
 */
export const ICONS = {
    // =============================================
    // 메인 네비게이션 아이콘
    // =============================================
    
    connection: {
        name: 'Connection',
        shortcut: 'Ctrl+K',
        paths: `
            <path d="M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3"/>
            <path d="M20 6v6c0 1.66-3.58 3-8 3s-8-1.34-8-3V6"/>
            <ellipse cx="12" cy="6" rx="8" ry="3"/>
            <path d="M19.5 15.5a2.5 2.5 0 0 0-3.8-2.3 2.5 2.5 0 0 0-1.2 3.8 2.5 2.5 0 0 0 3.5 1.2" stroke-dasharray="2 1"/>
            <circle cx="19" cy="19" r="3"/>
            <path d="M19 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" fill="currentColor" stroke="none"/>
        `
    },
    
    mapping: {
        name: 'Data Mapping',
        shortcut: null,
        paths: `
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="12" x2="5" y2="5"/>
            <circle cx="5" cy="5" r="2"/>
            <line x1="12" y1="12" x2="19" y2="5"/>
            <circle cx="19" cy="5" r="2"/>
            <line x1="12" y1="12" x2="5" y2="19"/>
            <circle cx="5" cy="19" r="2"/>
            <line x1="12" y1="12" x2="19" y2="19"/>
            <circle cx="19" cy="19" r="2"/>
        `
    },
    
    monitoring: {
        name: 'System Monitoring',
        shortcut: 'M',
        paths: `
            <rect x="3" y="4" width="18" height="12" rx="2"/>
            <polyline points="6 10 9 10 11 7 13 13 15 10 18 10"/>
            <path d="M12 16v4"/>
            <path d="M8 20h8"/>
        `
    },
    
    edit: {
        name: 'Edit Mode',
        shortcut: 'E',
        paths: `
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
        `
    },
    
    layout: {
        name: 'Layout Editor',
        shortcut: null,
        paths: `
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
        `
    },
    
    viewer: {
        name: '3D Viewer',
        shortcut: null,
        paths: `
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
        `
    },
    
    settings: {
        name: 'Settings',
        shortcut: null,
        paths: `
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        `
    },
    
    // =============================================
    // 상태 아이콘
    // =============================================
    
    warning: {
        name: 'Warning',
        shortcut: null,
        paths: `
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        `
    },
    
    error: {
        name: 'Error',
        shortcut: null,
        paths: `
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        `
    },
    
    success: {
        name: 'Success',
        shortcut: null,
        paths: `
            <circle cx="12" cy="12" r="10"/>
            <path d="M9 12l2 2 4-4"/>
        `
    },
    
    info: {
        name: 'Info',
        shortcut: null,
        paths: `
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        `
    },
    
    // =============================================
    // 유틸리티 아이콘
    // =============================================
    
    preview: {
        name: 'Preview',
        shortcut: 'P',
        paths: `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        `
    },
    
    save: {
        name: 'Save',
        shortcut: 'Ctrl+S',
        paths: `
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
        `
    },
    
    refresh: {
        name: 'Refresh',
        shortcut: null,
        paths: `
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        `
    },
    
    close: {
        name: 'Close',
        shortcut: 'Esc',
        paths: `
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        `
    },
    
    menu: {
        name: 'Menu',
        shortcut: null,
        paths: `
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
        `
    },
    
    debug: {
        name: 'Debug',
        shortcut: 'D',
        paths: `
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        `
    }
};

/**
 * IconRegistry 클래스
 * SVG 아이콘 생성 및 관리
 */
export class IconRegistry {
    constructor() {
        this.icons = ICONS;
        this.defaultSize = 24;
        this.defaultStrokeWidth = 2;
    }
    
    /**
     * SVG 아이콘 생성
     * @param {string} iconName - 아이콘 이름 (ICONS 키)
     * @param {Object} options - 옵션
     * @returns {SVGElement}
     */
    createIcon(iconName, options = {}) {
        const icon = this.icons[iconName];
        if (!icon) {
            console.warn(`IconRegistry: Unknown icon "${iconName}"`);
            return this._createPlaceholder();
        }
        
        const {
            size = this.defaultSize,
            strokeWidth = this.defaultStrokeWidth,
            className = '',
            color = 'currentColor'
        } = options;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', color);
        svg.setAttribute('stroke-width', strokeWidth);
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        
        if (className) {
            svg.setAttribute('class', className);
        }
        
        svg.innerHTML = icon.paths;
        
        return svg;
    }
    
    /**
     * HTML 문자열로 아이콘 반환
     * @param {string} iconName - 아이콘 이름
     * @param {Object} options - 옵션
     * @returns {string}
     */
    getIconHTML(iconName, options = {}) {
        const icon = this.icons[iconName];
        if (!icon) {
            return this._getPlaceholderHTML();
        }
        
        const {
            size = this.defaultSize,
            strokeWidth = this.defaultStrokeWidth,
            className = '',
            color = 'currentColor'
        } = options;
        
        return `
            <svg viewBox="0 0 24 24" 
                 width="${size}" 
                 height="${size}" 
                 fill="none" 
                 stroke="${color}" 
                 stroke-width="${strokeWidth}" 
                 stroke-linecap="round" 
                 stroke-linejoin="round"
                 ${className ? `class="${className}"` : ''}>
                ${icon.paths}
            </svg>
        `.trim();
    }
    
    /**
     * 아이콘 정보 조회
     * @param {string} iconName - 아이콘 이름
     * @returns {Object|null}
     */
    getIconInfo(iconName) {
        return this.icons[iconName] || null;
    }
    
    /**
     * 전체 아이콘 목록 반환
     * @returns {string[]}
     */
    listIcons() {
        return Object.keys(this.icons);
    }
    
    /**
     * 카테고리별 아이콘 목록
     * @returns {Object}
     */
    getIconsByCategory() {
        return {
            navigation: ['connection', 'mapping', 'monitoring', 'edit', 'layout', 'viewer', 'settings'],
            status: ['warning', 'error', 'success', 'info'],
            utility: ['preview', 'save', 'refresh', 'close', 'menu', 'debug']
        };
    }
    
    /**
     * 커스텀 아이콘 등록
     * @param {string} name - 아이콘 이름
     * @param {Object} iconDef - 아이콘 정의 { name, shortcut, paths }
     */
    registerIcon(name, iconDef) {
        if (this.icons[name]) {
            console.warn(`IconRegistry: Overwriting existing icon "${name}"`);
        }
        this.icons[name] = iconDef;
    }
    
    /**
     * 플레이스홀더 SVG 생성
     * @private
     */
    _createPlaceholder() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', this.defaultSize);
        svg.setAttribute('height', this.defaultSize);
        svg.innerHTML = `
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none"/>
            <text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor">?</text>
        `;
        return svg;
    }
    
    /**
     * 플레이스홀더 HTML 문자열
     * @private
     */
    _getPlaceholderHTML() {
        return `
            <svg viewBox="0 0 24 24" width="${this.defaultSize}" height="${this.defaultSize}">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none"/>
                <text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor">?</text>
            </svg>
        `;
    }
}

// 싱글톤 인스턴스 export
export const iconRegistry = new IconRegistry();

// 기본 export
export default iconRegistry;
