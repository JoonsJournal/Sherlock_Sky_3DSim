/**
 * ModeIndicatorPanel.js
 * =====================
 * 통합 모드 표시 패널 (CURRENT MODE + DEV MODE)
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * 
 * @description
 * - CURRENT MODE 박스와 DEV MODE 뱃지를 통합 관리
 * - 가로 배치로 툴팁 가림 방지
 * - 동일한 스타일, 색상만 다름
 * - 확장 가능한 구조 (Analysis Mode, Simulation Mode 등 추가 용이)
 * 
 * @features
 * - setMode(mode, submode): 현재 모드 업데이트
 * - setDevMode(enabled): Dev Mode 표시/숨김
 * - show() / hide(): 전체 패널 표시/숨김
 * - destroy(): 정리
 * 
 * @compatibility
 * - 기존 ID 유지: #current-mode, #current-submode, #dev-mode-badge
 * - Sidebar._updateOverlayUI() 호환
 * - SidebarSubmenuFactory.updateDevModeBadge() 호환
 * - index.html 폴백 함수 호환
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
        this.modeBox = null;
        this.devBadge = null;
        
        // 초기화
        this._create();
        
        console.log('[ModeIndicatorPanel] 초기화 완료 v1.0.0');
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    /**
     * DOM 생성
     */
    _create() {
        // 기존 요소 제거
        this._removeExisting();
        
        // 컨테이너 생성
        this.container = document.createElement('div');
        this.container.id = 'mode-indicator-panel';
        this.container.className = 'mode-indicator-panel';
        
        // 위치 설정
        this._applyPosition();
        
        // Mode Box 생성 (항상 표시)
        this.modeBox = this._createModeBox();
        this.container.appendChild(this.modeBox);
        
        // Dev Badge 생성 (숨김 상태)
        this.devBadge = this._createDevBadge();
        this.container.appendChild(this.devBadge);
        
        // body에 추가
        document.body.appendChild(this.container);
        
        // 초기 상태: 숨김
        this.hide();
    }
    
    /**
     * 기존 요소 제거 (중복 방지)
     */
    _removeExisting() {
        // 기존 패널 제거
        const existingPanel = document.getElementById('mode-indicator-panel');
        if (existingPanel) existingPanel.remove();
        
        // 기존 overlay-ui 내 mode-indicator 제거 (정적 HTML)
        const existingOverlay = document.querySelector('#overlay-ui .mode-indicator');
        if (existingOverlay) existingOverlay.remove();
        
        // 기존 dev-mode-badge 제거
        const existingBadge = document.getElementById('dev-mode-badge');
        if (existingBadge) existingBadge.remove();
    }
    
    /**
     * 위치 적용
     */
    _applyPosition() {
        if (!this.container) return;
        
        // 기본 위치 스타일
        this.container.style.position = 'fixed';
        this.container.style.zIndex = '100';
        
        // position에 따른 위치 설정
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
     * Mode Box 생성
     * @returns {HTMLElement}
     */
    _createModeBox() {
        const box = document.createElement('div');
        box.className = 'mode-indicator-box';
        box.innerHTML = `
            <div class="mode-indicator-label">CURRENT MODE</div>
            <div class="mode-indicator-content">
                <span class="mode-indicator-value" id="current-mode">—</span>
                <span class="mode-indicator-subvalue" id="current-submode"></span>
            </div>
        `;
        return box;
    }
    
    /**
     * Dev Badge 생성
     * @returns {HTMLElement}
     */
    _createDevBadge() {
        const badge = document.createElement('div');
        badge.className = 'mode-indicator-box mode-indicator-box--dev';
        badge.id = 'dev-mode-badge';  // 🔑 기존 ID 유지 (호환성)
        badge.innerHTML = `
            <div class="mode-indicator-label">DEV MODE</div>
            <div class="mode-indicator-content">
                <span class="mode-indicator-icon">⚡</span>
            </div>
        `;
        // 초기 상태: 숨김
        badge.style.display = 'none';
        return badge;
    }
    
    // ========================================
    // Public API - Mode Control
    // ========================================
    
    /**
     * 현재 모드 설정
     * @param {string|null} mode - 모드 이름 (null이면 '—')
     * @param {string|null} submode - 서브모드 이름 (선택)
     */
    setMode(mode, submode = null) {
        this.currentMode = mode;
        this.currentSubMode = submode;
        
        this._updateModeDisplay();
    }
    
    /**
     * 서브모드만 설정
     * @param {string|null} submode
     */
    setSubMode(submode) {
        this.currentSubMode = submode;
        this._updateModeDisplay();
    }
    
    /**
     * Mode 표시 업데이트
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
            submodeEl.textContent = this.currentSubMode 
                ? `→ ${this._formatSubModeName(this.currentSubMode)}`
                : '';
        }
    }
    
    /**
     * 모드 이름 포맷팅
     */
    _formatModeName(mode) {
        if (!mode) return '—';
        return mode.charAt(0).toUpperCase() + mode.slice(1);
    }
    
    /**
     * 서브모드 이름 포맷팅
     */
    _formatSubModeName(submode) {
        if (!submode) return '';
        if (submode === '3d-view') return '3D View';
        return submode;
    }
    
    // ========================================
    // Public API - Dev Mode Control
    // ========================================
    
    /**
     * Dev Mode 설정
     * @param {boolean} enabled
     */
    setDevMode(enabled) {
        this.devModeEnabled = enabled;
        
        if (this.devBadge) {
            this.devBadge.style.display = enabled ? 'flex' : 'none';
            
            // 🔑 호환성: active 클래스 토글 (기존 코드 호환)
            this.devBadge.classList.toggle('active', enabled);
        }
        
        // 이벤트 발생 (선택)
        if (this.eventBus) {
            this.eventBus.emit('modeIndicator:devModeChanged', { enabled });
        }
    }
    
    /**
     * Dev Mode 상태 반환
     * @returns {boolean}
     */
    isDevModeEnabled() {
        return this.devModeEnabled;
    }
    
    // ========================================
    // Public API - Visibility Control
    // ========================================
    
    /**
     * 패널 표시
     */
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
            this.isVisible = true;
        }
    }
    
    /**
     * 패널 숨김
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }
    
    /**
     * 패널 토글
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * 표시 상태 반환
     * @returns {boolean}
     */
    isShown() {
        return this.isVisible;
    }
    
    // ========================================
    // Public API - Configuration
    // ========================================
    
    /**
     * 위치 변경
     * @param {number} x - X 오프셋
     * @param {number} y - Y 오프셋
     */
    setPosition(x, y) {
        this.offsetX = x;
        this.offsetY = y;
        this._applyPosition();
    }
    
    /**
     * DOM 요소 반환 (직접 접근용)
     * @returns {HTMLElement|null}
     */
    getElement() {
        return this.container;
    }
    
    /**
     * Mode Box 요소 반환
     * @returns {HTMLElement|null}
     */
    getModeBox() {
        return this.modeBox;
    }
    
    /**
     * Dev Badge 요소 반환
     * @returns {HTMLElement|null}
     */
    getDevBadge() {
        return this.devBadge;
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 정리
     */
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        
        this.modeBox = null;
        this.devBadge = null;
        this.currentMode = null;
        this.currentSubMode = null;
        this.devModeEnabled = false;
        
        console.log('[ModeIndicatorPanel] 정리 완료');
    }
}

export default ModeIndicatorPanel;