/**
 * ModeIndicatorPanel.js
 * =====================
 * 통합 모드 표시 패널 (CURRENT MODE + DEV MODE)
 * 
 * @version 1.4.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * 
 * @changelog
 * - v1.4.0: 🎨 CURRENT MODE pill 스타일 통일 + 위치 오른쪽 이동 (2026-01-11)
 *           - CURRENT MODE: pill 형태 (cyan 색상)
 *           - DEV MODE: pill 형태 (amber 색상) - 기존 유지
 *           - offsetX: 100 → 130 (오른쪽으로 이동)
 * - v1.3.0: position override 확실히 적용
 * - v1.2.0: 가로 배치 시도
 * - v1.1.0: 기존 스타일 유지 시도
 * - v1.0.0: 초기 버전
 * 
 * @layout
 * ┌──────────────────────────────────────────────────────────────┐
 * │  ┌──────────────────────────┐  ┌───────────────────────────┐ │
 * │  │ 📍 Monitoring → 3D View  │  │ ⚡ DEV MODE               │ │
 * │  │ (pill, cyan)             │  │ (pill, amber)             │ │
 * │  └──────────────────────────┘  └───────────────────────────┘ │
 * │         (왼쪽)                        (오른쪽)                │
 * └──────────────────────────────────────────────────────────────┘
 * 
 * 위치: frontend/threejs_viewer/src/ui/overlay/ModeIndicatorPanel.js
 */

export class ModeIndicatorPanel {
    /**
     * @param {Object} options
     * @param {string} options.position - 위치 ('top-left', 'top-right' 등)
     * @param {number} options.offsetX - X 오프셋 (기본: 130)
     * @param {number} options.offsetY - Y 오프셋 (기본: 12)
     * @param {Object} options.eventBus - EventBus 인스턴스 (선택)
     */
    constructor(options = {}) {
        // 설정
        this.position = options.position || 'top-left';
        this.offsetX = options.offsetX ?? 130;  // 🔧 v1.4.0: 100 → 130 (오른쪽으로 이동)
        this.offsetY = options.offsetY ?? 12;
        this.eventBus = options.eventBus || null;
        
        // 상태
        this.currentMode = null;
        this.currentSubMode = null;
        this.devModeEnabled = false;
        this.isVisible = false;
        
        // DOM 참조
        this.container = null;
        this.modeIndicator = null;
        this.devBadge = null;
        
        // 초기화
        this._create();
        
        console.log('[ModeIndicatorPanel] 초기화 완료 v1.4.0 (pill 스타일 통일)');
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    _create() {
        // 기존 요소 제거
        this._removeExisting();
        
        // 컨테이너 생성
        this.container = document.createElement('div');
        this.container.id = 'mode-indicator-panel';
        this.container.className = 'mode-indicator-panel';
        
        // 인라인 스타일로 가로 배치 강제
        Object.assign(this.container.style, {
            position: 'fixed',
            zIndex: '100',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',  // 🔧 v1.4.0: flex-start → center (pill 세로 정렬)
            gap: '10px'
        });
        
        // 위치 설정
        this._applyPosition();
        
        // ============================================
        // 🔑 순서: CURRENT MODE 먼저 (왼쪽), DEV MODE 뒤 (오른쪽)
        // ============================================
        
        // 1. CURRENT MODE pill 생성
        this.modeIndicator = this._createModeIndicator();
        this.container.appendChild(this.modeIndicator);
        
        // 2. DEV MODE pill 생성
        this.devBadge = this._createDevBadge();
        this.container.appendChild(this.devBadge);
        
        // body에 추가
        document.body.appendChild(this.container);
        
        // 초기 상태: 표시
        this.show();
    }
    
    _removeExisting() {
        // 기존 패널 제거
        const existingPanel = document.getElementById('mode-indicator-panel');
        if (existingPanel) existingPanel.remove();
        
        // 기존 overlay-ui 내 mode-indicator 제거
        const existingOverlay = document.querySelector('#overlay-ui .mode-indicator');
        if (existingOverlay) existingOverlay.remove();
        
        // body에 직접 붙은 기존 dev-mode-badge 제거
        const existingBadge = document.getElementById('dev-mode-badge');
        if (existingBadge) existingBadge.remove();
    }
    
    _applyPosition() {
        if (!this.container) return;
        
        switch (this.position) {
            case 'top-left':
                this.container.style.top = `${this.offsetY}px`;
                this.container.style.left = `${this.offsetX}px`;
                this.container.style.right = 'auto';
                this.container.style.bottom = 'auto';
                break;
            case 'top-right':
                this.container.style.top = `${this.offsetY}px`;
                this.container.style.right = `${this.offsetX}px`;
                this.container.style.left = 'auto';
                this.container.style.bottom = 'auto';
                break;
            default:
                this.container.style.top = `${this.offsetY}px`;
                this.container.style.left = `${this.offsetX}px`;
        }
    }
    
    /**
     * 🔧 v1.4.0: CURRENT MODE pill 생성 (DEV MODE와 동일한 스타일)
     */
    _createModeIndicator() {
        const indicator = document.createElement('div');
        // 🔧 v1.4.0: 새로운 클래스명 사용 (pill 스타일)
        indicator.className = 'mode-indicator-pill';
        indicator.id = 'mode-indicator-pill';
        
        // 🔧 v1.4.0: pill 형태 - 한 줄에 아이콘 + 모드 + 서브모드
        indicator.innerHTML = `
            <span class="mode-icon">📍</span>
            <span class="mode-text" id="current-mode">—</span>
            <span class="mode-subtext" id="current-submode"></span>
        `;
        
        return indicator;
    }
    
    /**
     * DEV MODE pill 생성 (기존 스타일 유지)
     */
    _createDevBadge() {
        const badge = document.createElement('div');
        badge.className = 'dev-mode-badge';
        badge.id = 'dev-mode-badge';
        badge.textContent = '⚡ DEV MODE';
        
        // 컨테이너 내 배치를 위해 position 변경
        Object.assign(badge.style, {
            position: 'static',
            top: 'auto',
            left: 'auto'
        });
        
        return badge;
    }
    
    // ========================================
    // Public API - Mode Control
    // ========================================
    
    setMode(mode, submode = null) {
        this.currentMode = mode;
        this.currentSubMode = submode;
        this._updateModeDisplay();
    }
    
    setSubMode(submode) {
        this.currentSubMode = submode;
        this._updateModeDisplay();
    }
    
    /**
     * 🔧 v1.4.0: Mode 표시 업데이트 (pill 형태)
     */
    _updateModeDisplay() {
        const modeEl = document.getElementById('current-mode');
        const submodeEl = document.getElementById('current-submode');
        
        if (modeEl) {
            modeEl.textContent = this.currentMode 
                ? this._formatModeName(this.currentMode)
                : '—';
        }
        
        if (submodeEl) {
            // 🔧 v1.4.0: 서브모드가 있으면 "→ 서브모드" 형식으로 표시
            if (this.currentSubMode) {
                submodeEl.textContent = `→ ${this._formatSubModeName(this.currentSubMode)}`;
                submodeEl.style.display = 'inline';
            } else {
                submodeEl.textContent = '';
                submodeEl.style.display = 'none';
            }
        }
    }
    
    _formatModeName(mode) {
        if (!mode) return '—';
        return mode.charAt(0).toUpperCase() + mode.slice(1);
    }
    
    _formatSubModeName(submode) {
        if (!submode) return '';
        if (submode === '3d-view') return '3D View';
        return submode.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    
    // ========================================
    // Public API - Dev Mode Control
    // ========================================
    
    setDevMode(enabled) {
        this.devModeEnabled = enabled;
        
        if (this.devBadge) {
            this.devBadge.classList.toggle('active', enabled);
        }
        
        if (this.eventBus) {
            this.eventBus.emit('modeIndicator:devModeChanged', { enabled });
        }
    }
    
    isDevModeEnabled() {
        return this.devModeEnabled;
    }
    
    // ========================================
    // Public API - Visibility Control
    // ========================================
    
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
            this.isVisible = true;
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }
    
    toggle() {
        this.isVisible ? this.hide() : this.show();
    }
    
    isShown() {
        return this.isVisible;
    }
    
    // ========================================
    // Public API - Configuration
    // ========================================
    
    setPosition(x, y) {
        this.offsetX = x;
        this.offsetY = y;
        this._applyPosition();
    }
    
    getElement() {
        return this.container;
    }
    
    getModeIndicator() {
        return this.modeIndicator;
    }
    
    getDevBadge() {
        return this.devBadge;
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        
        this.modeIndicator = null;
        this.devBadge = null;
        this.currentMode = null;
        this.currentSubMode = null;
        this.devModeEnabled = false;
        
        console.log('[ModeIndicatorPanel] 정리 완료');
    }
}

export default ModeIndicatorPanel;