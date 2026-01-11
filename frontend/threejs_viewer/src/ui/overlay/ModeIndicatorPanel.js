/**
 * ModeIndicatorPanel.js
 * =====================
 * 통합 모드 표시 패널 (CURRENT MODE + DEV MODE)
 * 
 * @version 1.3.0
 * @created 2026-01-11
 * @updated 2026-01-11
 * 
 * @changelog
 * - v1.3.0: 🔧 position override 확실히 적용 (2026-01-11)
 *           - dev-mode-badge에 인라인 스타일로 position: static 강제
 *           - 가로 배치 (CURRENT MODE 왼쪽, DEV MODE 오른쪽)
 * - v1.2.0: 가로 배치 시도
 * - v1.1.0: 기존 스타일 유지 시도
 * - v1.0.0: 초기 버전
 * 
 * @layout
 * ┌───────────────────────────────────────────────────┐
 * │ ┌─────────────────┐  ┌─────────────────────────┐  │
 * │ │ CURRENT MODE    │  │ ⚡ DEV MODE (pill)      │  │
 * │ │ Monitoring      │  └─────────────────────────┘  │
 * │ │ → 3D View       │                               │
 * │ └─────────────────┘                               │
 * │      (왼쪽)              (오른쪽)                  │
 * └───────────────────────────────────────────────────┘
 * 
 * 위치: frontend/threejs_viewer/src/ui/overlay/ModeIndicatorPanel.js
 */

export class ModeIndicatorPanel {
    /**
     * @param {Object} options
     * @param {string} options.position - 위치 ('top-left', 'top-right' 등)
     * @param {number} options.offsetX - X 오프셋 (기본: 100)
     * @param {number} options.offsetY - Y 오프셋 (기본: 12)
     * @param {Object} options.eventBus - EventBus 인스턴스 (선택)
     */
    constructor(options = {}) {
        // 설정
        this.position = options.position || 'top-left';
        this.offsetX = options.offsetX ?? 100;  // 사이드바(80px) + 여백(20px)
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
        
        console.log('[ModeIndicatorPanel] 초기화 완료 v1.3.0');
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
        
        // 🔑 인라인 스타일로 가로 배치 강제
        Object.assign(this.container.style, {
            position: 'fixed',
            zIndex: '100',
            display: 'flex',
            flexDirection: 'row',      // 🔑 가로 배치
            alignItems: 'flex-start',
            gap: '10px'
        });
        
        // 위치 설정
        this._applyPosition();
        
        // ============================================
        // 🔑 순서: CURRENT MODE 먼저 (왼쪽), DEV MODE 뒤 (오른쪽)
        // ============================================
        
        // 1. CURRENT MODE 박스
        this.modeIndicator = this._createModeIndicator();
        this.container.appendChild(this.modeIndicator);
        
        // 2. DEV MODE 뱃지
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
        
        // 🔑 body에 직접 붙은 기존 dev-mode-badge 제거
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
     * CURRENT MODE 박스 생성 (기존 스타일 적용)
     */
    _createModeIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'mode-indicator';
        indicator.innerHTML = `
            <div class="mode-label">CURRENT MODE</div>
            <div class="mode-value" id="current-mode">—</div>
            <div class="submode-value" id="current-submode"></div>
        `;
        return indicator;
    }
    
    /**
     * DEV MODE 뱃지 생성 (기존 스타일 + position override)
     */
    _createDevBadge() {
        const badge = document.createElement('div');
        badge.className = 'dev-mode-badge';
        badge.id = 'dev-mode-badge';
        badge.textContent = '⚡ DEV MODE';
        
        // ============================================
        // 🔑🔑🔑 핵심: position을 인라인으로 강제 override
        // index.html의 position: fixed를 무시하고 static 적용
        // ============================================
        Object.assign(badge.style, {
            position: 'static',    // 🔑 fixed → static
            top: 'auto',
            left: 'auto',
            marginTop: '4px'       // 세로 정렬 미세 조정
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
    
    _updateModeDisplay() {
        const modeEl = document.getElementById('current-mode');
        const submodeEl = document.getElementById('current-submode');
        
        if (modeEl) {
            modeEl.textContent = this.currentMode 
                ? this._formatModeName(this.currentMode)
                : '—';
        }
        
        if (submodeEl) {
            submodeEl.textContent = this.currentSubMode 
                ? `→ ${this._formatSubModeName(this.currentSubMode)}`
                : '';
        }
    }
    
    _formatModeName(mode) {
        if (!mode) return '—';
        return mode.charAt(0).toUpperCase() + mode.slice(1);
    }
    
    _formatSubModeName(submode) {
        if (!submode) return '';
        if (submode === '3d-view') return '3D View';
        return submode;
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