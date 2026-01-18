/**
 * PanelManager.js
 * ===============
 * Panel/Modal 상태 중앙 관리
 * 
 * @version 1.0.0
 * @description
 * - 모든 Panel/Modal의 열림/닫힘 상태 추적
 * - 모드 전환 시 자동 Panel 닫기
 * - PANEL_RULES 기반 Panel 동작 제어
 * - NavigationController와 연동
 * 
 * @changelog
 * - v1.0.0: 🆕 초기 버전 (2026-01-18)
 *           - Panel 상태 추적 (openPanels Set)
 *           - handleModeChange() - 모드 전환 시 Panel 자동 닫기
 *           - open/close/closeAll API
 *           - 이벤트 발행 (panel:opened, panel:closed)
 * 
 * @dependencies
 * - NavigationRules.js (PANEL_TYPE, PANEL_RULES)
 * - EventBus.js
 * 
 * @exports
 * - PanelManager (class)
 * - panelManager (singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/navigation/PanelManager.js
 * 작성일: 2026-01-18
 * 수정일: 2026-01-18
 */

import { 
    PANEL_TYPE, 
    PANEL_RULES, 
    isPanelAllowedInMode,
    getPanelsToCloseOnModeChange 
} from './NavigationRules.js';

import { eventBus } from '../managers/EventBus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PanelManager 클래스
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} PanelOpenOptions
 * @property {Object} [data={}] - Panel에 전달할 데이터
 * @property {boolean} [silent=false] - 이벤트 발행 스킵
 */

/**
 * @typedef {Object} PanelCloseOptions
 * @property {boolean} [silent=false] - 이벤트 발행 스킵
 * @property {string} [reason='manual'] - 닫힌 이유 ('manual', 'mode_change', 'api')
 */

class PanelManager {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════
    
    constructor() {
        /**
         * 현재 열린 Panel 목록
         * @type {Set<string>}
         */
        this._openPanels = new Set();
        
        /**
         * 현재 모드
         * @type {string|null}
         */
        this._currentMode = null;
        
        /**
         * 현재 서브모드
         * @type {string|null}
         */
        this._currentSubmode = null;
        
        /**
         * 초기화 완료 플래그
         * @type {boolean}
         */
        this._initialized = false;
        
        /**
         * Panel 인스턴스 레지스트리 (선택적)
         * @type {Map<string, Object>}
         */
        this._panelInstances = new Map();
        
        // 초기화
        this._initialize();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 초기화
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 초기화
     * @private
     */
    _initialize() {
        console.log('[PanelManager] 📋 초기화 시작...');
        
        // DOM 로드 후 Panel DOM 상태 동기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this._syncWithDOM();
                this._initialized = true;
                console.log('[PanelManager] ✅ 초기화 완료 (DOMContentLoaded)');
            });
        } else {
            this._syncWithDOM();
            this._initialized = true;
            console.log('[PanelManager] ✅ 초기화 완료');
        }
    }
    
    /**
     * DOM 상태와 동기화
     * 페이지 로드 시 이미 열려있는 Panel 감지
     * @private
     */
    _syncWithDOM() {
        // 각 Panel 타입에 대해 DOM 상태 확인
        for (const [panelType, rules] of Object.entries(PANEL_RULES)) {
            if (rules.closeMethod === 'dom' && rules.domSelector) {
                const element = document.querySelector(rules.domSelector);
                if (element) {
                    const isVisible = !element.classList.contains('hidden') &&
                                     element.style.display !== 'none' &&
                                     element.classList.contains('modal-show') === false;
                    
                    // modal-show 클래스로 열림 상태 판단
                    if (element.classList.contains('modal-show') || 
                        element.classList.contains('active') ||
                        element.classList.contains('visible')) {
                        this._openPanels.add(panelType);
                        console.log(`[PanelManager] 📦 DOM 동기화: ${panelType} (열림)`);
                    }
                }
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public API - Panel 열기/닫기
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Panel 열기 등록
     * 
     * @description
     * Panel이 실제로 열릴 때 호출하여 상태 등록
     * PanelManager가 Panel을 직접 열지는 않음 (상태 추적만)
     * 
     * @param {string} panelType - PANEL_TYPE 값
     * @param {PanelOpenOptions} [options={}] - 옵션
     * @returns {boolean} 등록 성공 여부
     * 
     * @example
     * // EquipmentEditModal.open() 내에서:
     * panelManager.registerOpen(PANEL_TYPE.EQUIPMENT_EDIT);
     */
    registerOpen(panelType, options = {}) {
        const { data = {}, silent = false } = options;
        
        const rules = PANEL_RULES[panelType];
        if (!rules) {
            console.error(`[PanelManager] ❌ 알 수 없는 Panel 타입: ${panelType}`);
            return false;
        }
        
        // 현재 모드에서 허용되는지 확인
        if (!this._isAllowedInCurrentMode(panelType)) {
            console.warn(`[PanelManager] ⚠️ ${panelType}은 현재 모드(${this._currentMode}/${this._currentSubmode})에서 허용되지 않음`);
            return false;
        }
        
        // 이미 열려있으면 스킵
        if (this._openPanels.has(panelType)) {
            console.log(`[PanelManager] ℹ️ ${panelType} 이미 열림`);
            return true;
        }
        
        // 상태 등록
        this._openPanels.add(panelType);
        console.log(`[PanelManager] 📋 Panel 열림 등록: ${panelType}`);
        
        // 이벤트 발행
        if (!silent) {
            eventBus.emit('panel:opened', { 
                panelType, 
                data,
                mode: this._currentMode,
                submode: this._currentSubmode
            });
            
            // Panel별 이벤트
            if (rules.openEvent) {
                eventBus.emit(rules.openEvent, { panelType, data });
            }
        }
        
        return true;
    }
    
    /**
     * Panel 닫기
     * 
     * @description
     * Panel을 실제로 닫고 상태 해제
     * closeMethod에 따라 적절한 방식으로 닫기 실행
     * 
     * @param {string} panelType - PANEL_TYPE 값
     * @param {PanelCloseOptions} [options={}] - 옵션
     * @returns {boolean} 성공 여부
     * 
     * @example
     * panelManager.close(PANEL_TYPE.EQUIPMENT_EDIT);
     */
    close(panelType, options = {}) {
        const { silent = false, reason = 'manual' } = options;
        
        const rules = PANEL_RULES[panelType];
        if (!rules) {
            console.error(`[PanelManager] ❌ 알 수 없는 Panel 타입: ${panelType}`);
            return false;
        }
        
        // 열려있지 않으면 스킵
        if (!this._openPanels.has(panelType)) {
            console.log(`[PanelManager] ℹ️ ${panelType} 이미 닫혀있음`);
            return true;
        }
        
        // 실제 닫기 실행
        const closed = this._executeClose(panelType, rules);
        
        if (closed) {
            // 상태 해제
            this._openPanels.delete(panelType);
            console.log(`[PanelManager] 📋 Panel 닫힘: ${panelType} (reason: ${reason})`);
            
            // 이벤트 발행
            if (!silent) {
                eventBus.emit('panel:closed', { 
                    panelType, 
                    reason,
                    mode: this._currentMode,
                    submode: this._currentSubmode
                });
                
                // Panel별 이벤트
                if (rules.closeEvent) {
                    eventBus.emit(rules.closeEvent, { panelType, reason });
                }
            }
        }
        
        return closed;
    }
    
    /**
     * 모든 Panel 닫기
     * 
     * @param {PanelCloseOptions} [options={}] - 옵션
     * @returns {number} 닫힌 Panel 수
     */
    closeAll(options = {}) {
        const { silent = false, reason = 'close_all' } = options;
        
        const closedPanels = [];
        
        for (const panelType of [...this._openPanels]) {
            const closed = this.close(panelType, { silent: true, reason });
            if (closed) {
                closedPanels.push(panelType);
            }
        }
        
        console.log(`[PanelManager] 📋 모든 Panel 닫힘: ${closedPanels.length}개`);
        
        // 통합 이벤트 발행
        if (!silent && closedPanels.length > 0) {
            eventBus.emit('panel:all-closed', { 
                closedPanels,
                reason 
            });
        }
        
        return closedPanels.length;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public API - 모드 전환 처리 (핵심!)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 🔥 모드 전환 시 호출 (핵심 메서드)
     * 
     * @description
     * NavigationController.navigate()에서 호출
     * PANEL_RULES에 따라 허용되지 않는 Panel 자동 닫기
     * 
     * @param {string} newMode - 새 모드 (NAV_MODE)
     * @param {string|null} newSubmode - 새 서브모드
     * @returns {string[]} 닫힌 Panel 목록
     * 
     * @example
     * // NavigationController._executeTransition() 내에서:
     * const closedPanels = panelManager.handleModeChange(mode, submode);
     */
    handleModeChange(newMode, newSubmode = null) {
        console.log(`[PanelManager] 🔄 모드 전환: ${this._currentMode}/${this._currentSubmode} → ${newMode}/${newSubmode}`);
        
        const previousMode = this._currentMode;
        const previousSubmode = this._currentSubmode;
        
        // 모드 상태 업데이트
        this._currentMode = newMode;
        this._currentSubmode = newSubmode;
        
        // 닫아야 할 Panel 목록 가져오기
        const panelsToClose = getPanelsToCloseOnModeChange(
            newMode, 
            newSubmode, 
            [...this._openPanels]
        );
        
        if (panelsToClose.length === 0) {
            console.log('[PanelManager] ℹ️ 닫아야 할 Panel 없음');
            return [];
        }
        
        console.log(`[PanelManager] 📋 닫아야 할 Panel: ${panelsToClose.join(', ')}`);
        
        // Panel 닫기 실행
        const closedPanels = [];
        
        for (const panelType of panelsToClose) {
            const closed = this.close(panelType, { 
                silent: false, 
                reason: 'mode_change' 
            });
            
            if (closed) {
                closedPanels.push(panelType);
            }
        }
        
        // 모드 전환 완료 이벤트
        eventBus.emit('panel:mode-change-processed', {
            fromMode: previousMode,
            fromSubmode: previousSubmode,
            toMode: newMode,
            toSubmode: newSubmode,
            closedPanels
        });
        
        console.log(`[PanelManager] ✅ 모드 전환 처리 완료: ${closedPanels.length}개 Panel 닫힘`);
        
        return closedPanels;
    }
    
    /**
     * 현재 모드 설정 (초기화 또는 동기화용)
     * 
     * @param {string} mode - 모드
     * @param {string|null} submode - 서브모드
     */
    setCurrentMode(mode, submode = null) {
        this._currentMode = mode;
        this._currentSubmode = submode;
        console.log(`[PanelManager] 📋 현재 모드 설정: ${mode}/${submode}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public API - 상태 조회
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Panel이 열려있는지 확인
     * 
     * @param {string} panelType - PANEL_TYPE 값
     * @returns {boolean}
     */
    isOpen(panelType) {
        return this._openPanels.has(panelType);
    }
    
    /**
     * 열린 Panel 목록 가져오기
     * 
     * @returns {string[]} Panel 타입 배열
     */
    getOpenPanels() {
        return [...this._openPanels];
    }
    
    /**
     * 열린 Panel 수
     * 
     * @returns {number}
     */
    getOpenCount() {
        return this._openPanels.size;
    }
    
    /**
     * Panel이 없는지 확인
     * 
     * @returns {boolean}
     */
    isEmpty() {
        return this._openPanels.size === 0;
    }
    
    /**
     * 현재 모드 정보 가져오기
     * 
     * @returns {{mode: string|null, submode: string|null}}
     */
    getCurrentModeInfo() {
        return {
            mode: this._currentMode,
            submode: this._currentSubmode
        };
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public API - Panel 인스턴스 관리 (선택적)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Panel 인스턴스 등록
     * 
     * @param {string} panelType - PANEL_TYPE 값
     * @param {Object} instance - Panel 인스턴스
     */
    registerInstance(panelType, instance) {
        this._panelInstances.set(panelType, instance);
        console.log(`[PanelManager] 📦 인스턴스 등록: ${panelType}`);
    }
    
    /**
     * Panel 인스턴스 해제
     * 
     * @param {string} panelType - PANEL_TYPE 값
     */
    unregisterInstance(panelType) {
        this._panelInstances.delete(panelType);
    }
    
    /**
     * Panel 인스턴스 가져오기
     * 
     * @param {string} panelType - PANEL_TYPE 값
     * @returns {Object|null}
     */
    getInstance(panelType) {
        return this._panelInstances.get(panelType) || null;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Private - 닫기 실행
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Panel 닫기 실행
     * @private
     */
    _executeClose(panelType, rules) {
        try {
            switch (rules.closeMethod) {
                case 'instance':
                    return this._closeByInstance(panelType, rules);
                    
                case 'dom':
                    return this._closeByDOM(panelType, rules);
                    
                default:
                    console.warn(`[PanelManager] ⚠️ 알 수 없는 closeMethod: ${rules.closeMethod}`);
                    return false;
            }
        } catch (error) {
            console.error(`[PanelManager] ❌ Panel 닫기 실패 (${panelType}):`, error);
            return false;
        }
    }
    
    /**
     * 인스턴스 방식 닫기
     * @private
     */
    _closeByInstance(panelType, rules) {
        // 1. 등록된 인스턴스 확인
        let instance = this._panelInstances.get(panelType);
        
        // 2. window 객체에서 인스턴스 찾기
        if (!instance && rules.instanceName) {
            instance = window[rules.instanceName];
        }
        
        // 3. close() 메서드 호출
        if (instance && typeof instance.close === 'function') {
            instance.close();
            console.log(`[PanelManager] 📋 인스턴스 닫기: ${panelType} (${rules.instanceName})`);
            return true;
        }
        
        console.warn(`[PanelManager] ⚠️ 인스턴스를 찾을 수 없음: ${panelType}`);
        return false;
    }
    
    /**
     * DOM 방식 닫기
     * @private
     */
    _closeByDOM(panelType, rules) {
        if (!rules.domSelector) {
            console.warn(`[PanelManager] ⚠️ domSelector 없음: ${panelType}`);
            return false;
        }
        
        const element = document.querySelector(rules.domSelector);
        
        if (!element) {
            console.warn(`[PanelManager] ⚠️ DOM 요소를 찾을 수 없음: ${rules.domSelector}`);
            return false;
        }
        
        // 다양한 숨김 클래스 적용
        element.classList.add('hidden');
        element.classList.remove('active', 'modal-show', 'visible', 'open');
        
        console.log(`[PanelManager] 📋 DOM 닫기: ${panelType} (${rules.domSelector})`);
        return true;
    }
    
    /**
     * 현재 모드에서 Panel이 허용되는지 확인
     * @private
     */
    _isAllowedInCurrentMode(panelType) {
        // 모드가 설정되지 않았으면 허용 (초기 상태)
        if (!this._currentMode) {
            return true;
        }
        
        return isPanelAllowedInMode(panelType, this._currentMode, this._currentSubmode);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Debug
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('📋 PanelManager Debug');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Current Mode:', this._currentMode);
        console.log('Current Submode:', this._currentSubmode);
        console.log('───────────────────────────────────────────────────────────');
        console.log('Open Panels:', [...this._openPanels]);
        console.log('Open Count:', this._openPanels.size);
        console.log('───────────────────────────────────────────────────────────');
        console.log('Registered Instances:', [...this._panelInstances.keys()]);
        console.log('───────────────────────────────────────────────────────────');
        console.log('Initialized:', this._initialized);
        console.log('═══════════════════════════════════════════════════════════');
        console.groupEnd();
    }
    
    /**
     * Panel별 상태 상세 출력
     */
    debugPanelStates() {
        console.group('📋 Panel States');
        
        for (const [panelType, rules] of Object.entries(PANEL_RULES)) {
            const isOpen = this._openPanels.has(panelType);
            const isAllowed = this._isAllowedInCurrentMode(panelType);
            
            console.log(`${panelType}:`, {
                open: isOpen,
                allowedInCurrentMode: isAllowed,
                uiType: rules.uiType,
                autoClose: rules.autoCloseOnModeChange
            });
        }
        
        console.groupEnd();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Cleanup
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 정리
     */
    destroy() {
        // 모든 Panel 닫기
        this.closeAll({ silent: true, reason: 'destroy' });
        
        // 상태 초기화
        this._openPanels.clear();
        this._panelInstances.clear();
        this._currentMode = null;
        this._currentSubmode = null;
        
        console.log('[PanelManager] 🧹 정리 완료');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 싱글톤 인스턴스
// ═══════════════════════════════════════════════════════════════════════════════

export const panelManager = new PanelManager();

// 클래스도 export (테스트/확장용)
export { PanelManager };

// ═══════════════════════════════════════════════════════════════════════════════
// 전역 노출
// ═══════════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
    window.panelManager = panelManager;
    
    // 디버그 함수 전역 등록
    window.debugPanelManager = () => panelManager.debug();
    window.debugPanelStates = () => panelManager.debugPanelStates();
}