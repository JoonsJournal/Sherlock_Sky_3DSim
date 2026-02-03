/**
 * ModeTransition.js
 * ===========
 * Dashboard Mode 전환 서비스
 * 
 * @version 1.0.0
 * @description
 * - Dashboard에서 다른 Mode로 전환 관리
 * - Mode별 URL 라우팅 처리
 * - 전환 전 검증 로직
 * - 전환 애니메이션 및 상태 저장
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 *   - Mode 전환 로직
 *   - 시나리오별 전환 검증
 *   - ⚠️ 호환성: 신규 서비스
 * 
 * @dependencies
 * - DashboardState.js: 상태 관리
 * 
 * @exports
 * - ModeType: Mode 타입 상수
 * - ActionType: Action 타입 상수
 * - ModeTransition: Mode 전환 서비스 클래스
 * - getModeTransition: 싱글톤 인스턴스 getter
 * 
 * 📁 위치: frontend/threejs_viewer/src/dashboard/services/ModeTransition.js
 * 작성일: 2026-02-03
 * 수정일: 2026-02-03
 */

import { getDashboardState, SiteReadiness, SiteStatus } from '../DashboardState.js';

// =========================================================
// Constants
// =========================================================

/**
 * Mode 타입
 * @readonly
 * @enum {string}
 */
export const ModeType = {
    /** 3D 모니터링 View */
    MONITORING: 'monitoring',
    /** 2D Ranking View */
    RANKING: 'ranking',
    /** 분석 Mode */
    ANALYSIS: 'analysis',
    /** 설정 Mode (Layout Editor, Mapping Tool) */
    SETUP: 'setup',
    /** Dashboard로 돌아가기 */
    DASHBOARD: 'dashboard'
};

/**
 * Action 타입 (상세 액션)
 * @readonly
 * @enum {string}
 */
export const ActionType = {
    /** 3D View */
    VIEW_3D: '3d',
    /** Ranking View */
    RANKING: 'ranking',
    /** Analysis Mode */
    ANALYSIS: 'analysis',
    /** Layout Editor */
    LAYOUT_EDITOR: 'layout-editor',
    /** Mapping Tool */
    MAPPING_TOOL: 'mapping-tool',
    /** 재연결 */
    RETRY: 'retry'
};

/**
 * Mode별 URL 매핑
 */
const MODE_URLS = {
    [ModeType.MONITORING]: '/index.html',
    [ModeType.RANKING]: '/ranking-view-test.html',
    [ModeType.ANALYSIS]: '/analysis.html',
    [ModeType.SETUP]: '/test_layout_manager.html',
    [ModeType.DASHBOARD]: '/dashboard.html'
};

// =========================================================
// ModeTransition Class
// =========================================================

/**
 * ModeTransition 클래스
 * Dashboard Mode 전환 관리
 */
export class ModeTransition {
    // =========================================================
    // CSS Class Constants (가이드라인 준수)
    // =========================================================
    
    /** @type {Object} CSS 클래스 상수 - BEM 규칙 적용 */
    static CSS = {
        // Block
        OVERLAY: 'transition-overlay',
        
        // Modifiers
        MOD_ACTIVE: 'transition-overlay--active',
        MOD_FADE: 'transition-overlay--fade',
        
        // Legacy alias (하위 호환)
        LEGACY_ACTIVE: 'active'
    };
    
    // =========================================================
    // Constructor
    // =========================================================
    
    /**
     * @param {Object} options - 옵션
     * @param {boolean} options.useAnimation - 전환 애니메이션 사용
     * @param {Function} options.onBeforeTransition - 전환 전 콜백
     * @param {Function} options.onAfterTransition - 전환 후 콜백
     */
    constructor(options = {}) {
        this.options = {
            useAnimation: options.useAnimation ?? true,
            onBeforeTransition: options.onBeforeTransition ?? null,
            onAfterTransition: options.onAfterTransition ?? null
        };
        
        this.state = getDashboardState();
        
        this._transitionHistory = [];
        this._isTransitioning = false;
        
        console.log('🔄 [ModeTransition] Initialized');
    }
    
    // =========================================================
    // Public Methods
    // =========================================================
    
    /**
     * Mode 전환 실행
     * @param {Object} params - 전환 파라미터
     * @param {string} params.siteId - Site ID
     * @param {ModeType} params.mode - 대상 Mode
     * @param {ActionType} params.action - 상세 액션
     * @returns {Promise<boolean>} 전환 성공 여부
     */
    async transition({ siteId, mode, action }) {
        if (this._isTransitioning) {
            console.warn('⚠️ [ModeTransition] Transition already in progress');
            return false;
        }
        
        console.log(`🔄 [ModeTransition] Transitioning to ${mode} for site ${siteId} (action: ${action})`);
        
        // 1. 전환 가능 여부 검증
        const validation = this._validateTransition(siteId, mode, action);
        if (!validation.valid) {
            console.warn(`⚠️ [ModeTransition] Validation failed: ${validation.reason}`);
            this._showValidationError(validation.reason);
            return false;
        }
        
        this._isTransitioning = true;
        
        try {
            // 2. 전환 전 콜백
            if (this.options.onBeforeTransition) {
                await this.options.onBeforeTransition({ siteId, mode, action });
            }
            
            // 3. 상태 저장
            this._saveTransitionState(siteId, mode, action);
            
            // 4. Site 선택
            if (siteId) {
                this.state.selectSite(siteId);
            }
            
            // 5. 전환 애니메이션
            if (this.options.useAnimation) {
                await this._playTransitionAnimation();
            }
            
            // 6. URL 이동
            this._navigateToMode(siteId, mode, action);
            
            // 7. 전환 후 콜백
            if (this.options.onAfterTransition) {
                await this.options.onAfterTransition({ siteId, mode, action });
            }
            
            console.log(`✅ [ModeTransition] Transition completed to ${mode}`);
            return true;
            
        } catch (error) {
            console.error('❌ [ModeTransition] Transition failed:', error);
            return false;
            
        } finally {
            this._isTransitioning = false;
        }
    }
    
    /**
     * Dashboard로 돌아가기
     * @returns {Promise<boolean>}
     */
    async backToDashboard() {
        return this.transition({
            siteId: null,
            mode: ModeType.DASHBOARD,
            action: null
        });
    }
    
    /**
     * 전환 가능 여부 확인
     * @param {string} siteId
     * @param {ModeType} mode
     * @param {ActionType} action
     * @returns {Object} { valid: boolean, reason?: string }
     */
    canTransition(siteId, mode, action) {
        return this._validateTransition(siteId, mode, action);
    }
    
    /**
     * 전환 히스토리 조회
     * @returns {Array}
     */
    getHistory() {
        return [...this._transitionHistory];
    }
    
    // =========================================================
    // Validation
    // =========================================================
    
    /**
     * 전환 검증
     * @param {string} siteId
     * @param {ModeType} mode
     * @param {ActionType} action
     * @returns {Object}
     * @private
     */
    _validateTransition(siteId, mode, action) {
        // Dashboard 이동은 항상 허용
        if (mode === ModeType.DASHBOARD) {
            return { valid: true };
        }
        
        // Site 존재 확인
        const site = this.state.sitesMap.get(siteId);
        if (!site) {
            return { valid: false, reason: `Site를 찾을 수 없습니다: ${siteId}` };
        }
        
        // 연결 상태 확인
        if (site.status === SiteStatus.DISCONNECTED || site.status === SiteStatus.UNHEALTHY) {
            if (action !== ActionType.RETRY) {
                return { valid: false, reason: '서버 연결이 끊어졌습니다. 재연결을 시도해주세요.' };
            }
        }
        
        // 시나리오별 검증
        const readiness = site.readiness;
        
        switch (mode) {
            case ModeType.MONITORING:
                // 3D View: S2 필요 (Layout ✅, Mapping ✅)
                if (readiness !== SiteReadiness.S2) {
                    return { 
                        valid: false, 
                        reason: '3D View를 사용하려면 Layout과 Mapping이 모두 필요합니다.' 
                    };
                }
                break;
                
            case ModeType.RANKING:
                // Ranking: S2 또는 S3 (Mapping 필요)
                if (readiness !== SiteReadiness.S2 && readiness !== SiteReadiness.S3) {
                    return { 
                        valid: false, 
                        reason: 'Ranking View를 사용하려면 Mapping이 필요합니다.' 
                    };
                }
                break;
                
            case ModeType.ANALYSIS:
                // Analysis: 모든 시나리오 허용 (DB 연결만 필요)
                break;
                
            case ModeType.SETUP:
                // Setup: 모든 시나리오 허용
                break;
        }
        
        return { valid: true };
    }
    
    /**
     * 검증 에러 표시
     * @param {string} reason
     * @private
     */
    _showValidationError(reason) {
        // Toast 또는 Alert 표시
        // TODO: Toast 시스템 연동
        alert(reason);
    }
    
    // =========================================================
    // Navigation
    // =========================================================
    
    /**
     * Mode URL로 이동
     * @param {string} siteId
     * @param {ModeType} mode
     * @param {ActionType} action
     * @private
     */
    _navigateToMode(siteId, mode, action) {
        let url = MODE_URLS[mode] || '/dashboard.html';
        
        // Query Parameter 추가
        const params = new URLSearchParams();
        
        if (siteId) {
            params.set('site', siteId);
        }
        
        if (action) {
            params.set('action', action);
        }
        
        // Setup Mode 상세 분기
        if (mode === ModeType.SETUP) {
            if (action === ActionType.MAPPING_TOOL) {
                url = '/test_equipment_mapping_mockup.html';
            } else {
                url = '/test_layout_manager.html';
            }
        }
        
        const queryString = params.toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        
        console.log(`🔗 [ModeTransition] Navigating to: ${fullUrl}`);
        
        // 페이지 이동
        window.location.href = fullUrl;
    }
    
    // =========================================================
    // State Management
    // =========================================================
    
    /**
     * 전환 상태 저장
     * @param {string} siteId
     * @param {ModeType} mode
     * @param {ActionType} action
     * @private
     */
    _saveTransitionState(siteId, mode, action) {
        const entry = {
            siteId,
            mode,
            action,
            timestamp: new Date().toISOString(),
            from: window.location.pathname
        };
        
        this._transitionHistory.push(entry);
        
        // 최대 20개 유지
        if (this._transitionHistory.length > 20) {
            this._transitionHistory.shift();
        }
        
        // SessionStorage에 저장 (페이지 이동 후 복원용)
        try {
            sessionStorage.setItem('dashboardTransition', JSON.stringify(entry));
            sessionStorage.setItem('selectedSiteId', siteId || '');
        } catch (e) {
            console.warn('⚠️ [ModeTransition] Failed to save to sessionStorage:', e);
        }
    }
    
    /**
     * 저장된 상태 복원
     * @returns {Object|null}
     */
    restoreState() {
        try {
            const data = sessionStorage.getItem('dashboardTransition');
            const siteId = sessionStorage.getItem('selectedSiteId');
            
            if (siteId) {
                this.state.selectSite(siteId);
            }
            
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn('⚠️ [ModeTransition] Failed to restore from sessionStorage:', e);
            return null;
        }
    }
    
    // =========================================================
    // Animation
    // =========================================================
    
    /**
     * 전환 애니메이션 실행
     * @returns {Promise<void>}
     * @private
     */
    async _playTransitionAnimation() {
        const CSS = ModeTransition.CSS;
        
        // Fade out 효과
        const overlay = document.createElement('div');
        overlay.className = CSS.OVERLAY;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-primary, #0d1117);
            opacity: 0;
            z-index: 9999;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(overlay);
        
        // Fade in
        await new Promise(resolve => setTimeout(resolve, 50));
        overlay.style.opacity = '1';
        overlay.classList.add(CSS.MOD_ACTIVE);
        overlay.classList.add(CSS.LEGACY_ACTIVE);
        
        // 애니메이션 완료 대기
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // =========================================================
    // Cleanup
    // =========================================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        this._transitionHistory = [];
        this._isTransitioning = false;
        
        console.log('🗑️ [ModeTransition] Destroyed');
    }
}

// =========================================================
// Singleton Instance
// =========================================================

let transitionInstance = null;

/**
 * 싱글톤 인스턴스 가져오기
 * @param {Object} options - 옵션 (첫 호출 시에만 적용)
 * @returns {ModeTransition}
 */
export function getModeTransition(options) {
    if (!transitionInstance) {
        transitionInstance = new ModeTransition(options);
    }
    return transitionInstance;
}

export default ModeTransition;