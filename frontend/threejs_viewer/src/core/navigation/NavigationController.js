/**
 * NavigationController.js
 * =======================
 * 애플리케이션 네비게이션 중앙 조율자
 * 
 * @version 1.0.0
 * @description
 * - 모든 화면 전환의 단일 진입점
 * - Mode + Submode + Layer 통합 관리
 * - AppModeManager, ViewManager, DOM Layer 조율
 * - 상태 일관성 보장
 * 
 * @changelog
 * - v1.0.0: 🆕 초기 버전 (2026-01-18)
 *           - navigate() 핵심 메서드
 *           - 레이어 전환 로직
 *           - ViewManager 통합
 *           - 서비스 활성화/비활성화
 * 
 * @dependencies
 * - NavigationRules.js
 * - EventBus.js
 * - AppModeManager.js
 * - ViewBootstrap.js (viewManager)
 * 
 * @exports
 * - NavigationController (class)
 * - navigationController (singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/navigation/NavigationController.js
 * 작성일: 2026-01-18
 */

import {
    NAVIGATION_RULES,
    LAYER_CONFIG,
    NAV_MODE,
    getModeRules,
    getSubmodeRules,
    computeFinalLayers,
    navModeToAppMode,
    findParentMode
} from './NavigationRules.js';

import { eventBus } from '../managers/EventBus.js';
import { appModeManager } from '../managers/AppModeManager.js';
import { APP_MODE } from '../config/constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ViewManager는 동적 import (순환 의존성 방지)
// ═══════════════════════════════════════════════════════════════════════════════

let viewManager = null;

/**
 * ViewManager 동적 로드
 * @returns {Promise<Object>}
 */
async function getViewManager() {
    if (!viewManager) {
        try {
            const module = await import('../../bootstrap/ViewBootstrap.js');
            viewManager = module.viewManager;
        } catch (error) {
            console.warn('[NavigationController] ViewManager 로드 실패:', error);
            viewManager = null;
        }
    }
    return viewManager;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} NavigationState
 * @property {string} mode - 현재 모드 (NAV_MODE)
 * @property {string|null} submode - 현재 서브모드
 * @property {Object.<string, boolean>} activeLayers - 활성화된 레이어 맵
 * @property {string|null} activeView - ViewManager가 관리하는 활성 View ID
 * @property {number} timestamp - 상태 변경 시간
 */

/**
 * @typedef {Object} NavigationOptions
 * @property {boolean} [force=false] - 강제 전환 (동일 상태여도 실행)
 * @property {boolean} [skipAnimation=false] - 애니메이션 스킵
 * @property {boolean} [skipHistory=false] - 히스토리 기록 스킵
 * @property {boolean} [silent=false] - 이벤트 발행 스킵
 * @property {Object} [data={}] - 추가 데이터
 */

// ═══════════════════════════════════════════════════════════════════════════════
// NavigationController 클래스
// ═══════════════════════════════════════════════════════════════════════════════

class NavigationController {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════
    
    constructor() {
        /**
         * 현재 네비게이션 상태
         * @type {NavigationState}
         */
        this._state = {
            mode: NAV_MODE.MAIN_VIEWER,
            submode: null,
            activeLayers: { 'cover-screen': true },
            activeView: null,
            timestamp: Date.now()
        };
        
        /**
         * 이전 네비게이션 상태
         * @type {NavigationState|null}
         */
        this._previousState = null;
        
        /**
         * 네비게이션 히스토리
         * @type {NavigationState[]}
         */
        this._history = [];
        
        /**
         * 최대 히스토리 크기
         * @type {number}
         */
        this._maxHistorySize = 50;
        
        /**
         * 전환 중 플래그
         * @type {boolean}
         */
        this._isTransitioning = false;
        
        /**
         * 초기화 완료 플래그
         * @type {boolean}
         */
        this._initialized = false;
        
        /**
         * DOM 레이어 캐시
         * @type {Map<string, HTMLElement>}
         */
        this._layerCache = new Map();
        
        /**
         * 이벤트 구독 해제 함수들
         * @type {Function[]}
         */
        this._eventUnsubscribers = [];
        
        // 초기화
        this._initialize();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 초기화
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 컨트롤러 초기화
     * @private
     */
    _initialize() {
        // DOM 로드 후 레이어 캐싱
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this._cacheLayerElements();
                this._setupEventListeners();
                this._initialized = true;
                console.log('[NavigationController] 🚀 초기화 완료 (DOMContentLoaded)');
            });
        } else {
            this._cacheLayerElements();
            this._setupEventListeners();
            this._initialized = true;
            console.log('[NavigationController] 🚀 초기화 완료');
        }
    }
    
    /**
     * DOM 레이어 요소 캐싱
     * @private
     */
    _cacheLayerElements() {
        const layerIds = Object.keys(LAYER_CONFIG);
        
        layerIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this._layerCache.set(id, element);
            }
        });
        
        console.log(`[NavigationController] 📦 레이어 캐시: ${this._layerCache.size}개`);
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // AppModeManager 모드 변경 감지 (외부에서 직접 변경 시)
        const unsubModeChange = eventBus.on('mode:change', (data) => {
            this._onExternalModeChange(data);
        });
        this._eventUnsubscribers.push(unsubModeChange);
        
        // 서브모드 변경 감지
        const unsubSubmodeChange = eventBus.on('submode:change', (data) => {
            this._onExternalSubmodeChange(data);
        });
        this._eventUnsubscribers.push(unsubSubmodeChange);
    }
    
    /**
     * 외부 모드 변경 처리
     * @private
     */
    _onExternalModeChange(data) {
        // NavigationController를 통하지 않은 직접 변경 감지
        // 필요 시 상태 동기화
        if (this._isTransitioning) return;
        
        console.log('[NavigationController] 📡 외부 모드 변경 감지:', data);
    }
    
    /**
     * 외부 서브모드 변경 처리
     * @private
     */
    _onExternalSubmodeChange(data) {
        if (this._isTransitioning) return;
        
        console.log('[NavigationController] 📡 외부 서브모드 변경 감지:', data);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public API - 네비게이션
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 🔑 핵심 메서드: 네비게이션 실행
     * 
     * 모든 화면 전환은 이 메서드를 통해서만 수행
     * 
     * @param {string} mode - 목표 모드 (NAV_MODE 값)
     * @param {string|null} [submode=null] - 목표 서브모드
     * @param {NavigationOptions} [options={}] - 옵션
     * @returns {Promise<boolean>} 성공 여부
     * 
     * @example
     * // 3D View로 이동
     * await navigationController.navigate('monitoring', '3d-view');
     * 
     * @example
     * // Ranking View로 이동
     * await navigationController.navigate('monitoring', 'ranking-view');
     * 
     * @example
     * // 홈으로 이동
     * await navigationController.navigate('main_viewer');
     */
    async navigate(mode, submode = null, options = {}) {
        const {
            force = false,
            skipAnimation = false,
            skipHistory = false,
            silent = false,
            data = {}
        } = options;
        
        console.log(`[NavigationController] 🧭 navigate: ${mode}/${submode || 'default'}`);
        
        // ─────────────────────────────────────────────────────────────────────
        // 1. 전환 중 중복 호출 방지
        // ─────────────────────────────────────────────────────────────────────
        if (this._isTransitioning && !force) {
            console.warn('[NavigationController] ⚠️ 전환 중 - 요청 무시');
            return false;
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // 2. 규칙 검증
        // ─────────────────────────────────────────────────────────────────────
        const rules = getModeRules(mode);
        if (!rules) {
            console.error(`[NavigationController] ❌ 알 수 없는 모드: ${mode}`);
            return false;
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // 3. 서브모드 기본값 적용
        // ─────────────────────────────────────────────────────────────────────
        const targetSubmode = submode || rules.defaultSubmode;
        
        // 서브모드 검증
        if (targetSubmode && !rules.submodes?.[targetSubmode]) {
            console.error(`[NavigationController] ❌ 알 수 없는 서브모드: ${mode}/${targetSubmode}`);
            return false;
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // 4. 동일 상태 체크
        // ─────────────────────────────────────────────────────────────────────
        if (!force && 
            this._state.mode === mode && 
            this._state.submode === targetSubmode) {
            console.log('[NavigationController] ℹ️ 이미 해당 상태');
            return true;
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // 5. 연결 요구사항 체크
        // ─────────────────────────────────────────────────────────────────────
        if (rules.requiresConnection) {
            const canEnter = this._checkConnectionRequirement(mode);
            if (!canEnter) {
                console.warn(`[NavigationController] ⚠️ 연결 필요: ${mode}`);
                
                if (!silent) {
                    eventBus.emit('navigation:blocked', {
                        mode,
                        submode: targetSubmode,
                        reason: 'connection_required'
                    });
                }
                
                return false;
            }
        }
        
        try {
            this._isTransitioning = true;
            
            // ─────────────────────────────────────────────────────────────────
            // 6. 이벤트 발행: 전환 시작
            // ─────────────────────────────────────────────────────────────────
            if (!silent) {
                eventBus.emit('navigation:start', {
                    from: { ...this._state },
                    to: { mode, submode: targetSubmode },
                    data
                });
            }
            
            // ─────────────────────────────────────────────────────────────────
            // 7. 🔥 전환 실행 (핵심 로직)
            // ─────────────────────────────────────────────────────────────────
            await this._executeTransition(mode, targetSubmode, rules, {
                skipAnimation,
                data
            });
            
            // ─────────────────────────────────────────────────────────────────
            // 8. 상태 저장
            // ─────────────────────────────────────────────────────────────────
            this._previousState = { ...this._state };
            
            const newState = {
                mode,
                submode: targetSubmode,
                activeLayers: computeFinalLayers(mode, targetSubmode),
                activeView: this._getActiveView(mode, targetSubmode),
                timestamp: Date.now()
            };
            
            this._state = newState;
            
            // ─────────────────────────────────────────────────────────────────
            // 9. 히스토리 기록
            // ─────────────────────────────────────────────────────────────────
            if (!skipHistory) {
                this._addToHistory(newState);
            }
            
            // ─────────────────────────────────────────────────────────────────
            // 10. 이벤트 발행: 전환 완료
            // ─────────────────────────────────────────────────────────────────
            if (!silent) {
                eventBus.emit('navigation:complete', {
                    state: { ...newState },
                    previousState: this._previousState,
                    data
                });
            }
            
            console.log(`[NavigationController] ✅ 전환 완료: ${mode}/${targetSubmode || 'none'}`);
            return true;
            
        } catch (error) {
            console.error('[NavigationController] ❌ 전환 실패:', error);
            
            if (!silent) {
                eventBus.emit('navigation:error', {
                    mode,
                    submode: targetSubmode,
                    error: error.message
                });
            }
            
            return false;
            
        } finally {
            this._isTransitioning = false;
        }
    }
    
    /**
     * 모드만 전환 (서브모드는 기본값 사용)
     * 
     * @param {string} mode - 목표 모드
     * @param {NavigationOptions} [options={}] - 옵션
     * @returns {Promise<boolean>}
     */
    async navigateToMode(mode, options = {}) {
        return this.navigate(mode, null, options);
    }
    
    /**
     * 서브모드 전환 (현재 모드 유지)
     * 
     * @param {string} submode - 목표 서브모드
     * @param {NavigationOptions} [options={}] - 옵션
     * @returns {Promise<boolean>}
     */
    async navigateToSubmode(submode, options = {}) {
        // 서브모드의 부모 모드 찾기
        let parentMode = findParentMode(submode);
        
        // 현재 모드에 해당 서브모드가 있으면 현재 모드 사용
        const currentRules = getModeRules(this._state.mode);
        if (currentRules?.submodes?.[submode]) {
            parentMode = this._state.mode;
        }
        
        if (!parentMode) {
            console.error(`[NavigationController] ❌ 서브모드의 부모 모드를 찾을 수 없음: ${submode}`);
            return false;
        }
        
        return this.navigate(parentMode, submode, options);
    }
    
    /**
     * 토글 네비게이션
     * 현재 상태와 같으면 홈으로, 다르면 해당 상태로
     * 
     * @param {string} mode - 목표 모드
     * @param {string|null} [submode=null] - 목표 서브모드
     * @param {NavigationOptions} [options={}] - 옵션
     * @returns {Promise<boolean>}
     */
    async toggle(mode, submode = null, options = {}) {
        const rules = getModeRules(mode);
        const targetSubmode = submode || rules?.defaultSubmode;
        
        if (this._state.mode === mode && this._state.submode === targetSubmode) {
            return this.goHome(options);
        }
        
        return this.navigate(mode, targetSubmode, options);
    }
    
    /**
     * 이전 상태로 돌아가기
     * 
     * @param {NavigationOptions} [options={}] - 옵션
     * @returns {Promise<boolean>}
     */
    async goBack(options = {}) {
        if (this._previousState) {
            return this.navigate(
                this._previousState.mode,
                this._previousState.submode,
                { ...options, skipHistory: true }
            );
        }
        
        return this.goHome(options);
    }
    
    /**
     * 홈으로 돌아가기 (MAIN_VIEWER)
     * 
     * @param {NavigationOptions} [options={}] - 옵션
     * @returns {Promise<boolean>}
     */
    async goHome(options = {}) {
        return this.navigate(NAV_MODE.MAIN_VIEWER, null, options);
    }
    
    /**
     * 히스토리에서 특정 인덱스로 이동
     * 
     * @param {number} index - 히스토리 인덱스
     * @param {NavigationOptions} [options={}] - 옵션
     * @returns {Promise<boolean>}
     */
    async goToHistory(index, options = {}) {
        if (index < 0 || index >= this._history.length) {
            console.error(`[NavigationController] ❌ 잘못된 히스토리 인덱스: ${index}`);
            return false;
        }
        
        const historyState = this._history[index];
        return this.navigate(
            historyState.mode,
            historyState.submode,
            { ...options, skipHistory: true }
        );
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public API - 상태 조회
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 현재 상태 조회
     * @returns {NavigationState}
     */
    getState() {
        return { ...this._state };
    }
    
    /**
     * 현재 모드 조회
     * @returns {string}
     */
    getCurrentMode() {
        return this._state.mode;
    }
    
    /**
     * 현재 서브모드 조회
     * @returns {string|null}
     */
    getCurrentSubmode() {
        return this._state.submode;
    }
    
    /**
     * 이전 상태 조회
     * @returns {NavigationState|null}
     */
    getPreviousState() {
        return this._previousState ? { ...this._previousState } : null;
    }
    
    /**
     * 히스토리 조회
     * @returns {NavigationState[]}
     */
    getHistory() {
        return [...this._history];
    }
    
    /**
     * 전환 중인지 확인
     * @returns {boolean}
     */
    isTransitioning() {
        return this._isTransitioning;
    }
    
    /**
     * 특정 모드인지 확인
     * @param {string} mode
     * @returns {boolean}
     */
    isMode(mode) {
        return this._state.mode === mode;
    }
    
    /**
     * 특정 서브모드인지 확인
     * @param {string} submode
     * @returns {boolean}
     */
    isSubmode(submode) {
        return this._state.submode === submode;
    }
    
    /**
     * 특정 모드/서브모드 조합인지 확인
     * @param {string} mode
     * @param {string|null} submode
     * @returns {boolean}
     */
    isAt(mode, submode = null) {
        return this._state.mode === mode && this._state.submode === submode;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Private - 전환 실행
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 전환 실행 (핵심 로직)
     * @private
     */
    async _executeTransition(mode, submode, rules, options) {
        console.log(`[NavigationController] 🔄 _executeTransition: ${mode}/${submode || 'none'}`);
        
        const submodeRules = submode ? rules.submodes?.[submode] : null;
        
        // ─────────────────────────────────────────────────────────────────────
        // Step 1: 이전 상태 정리
        // ─────────────────────────────────────────────────────────────────────
        await this._cleanupPreviousState();
        
        // ─────────────────────────────────────────────────────────────────────
        // Step 2: AppModeManager 상태 동기화
        // ─────────────────────────────────────────────────────────────────────
        await this._syncAppModeManager(mode, submode, rules);
        
        // ─────────────────────────────────────────────────────────────────────
        // Step 3: 레이어 전환
        // ─────────────────────────────────────────────────────────────────────
        await this._switchLayers(mode, submode, rules);
        
        // ─────────────────────────────────────────────────────────────────────
        // Step 4: ViewManager View 전환
        // ─────────────────────────────────────────────────────────────────────
        await this._switchView(mode, submode, submodeRules);
        
        // ─────────────────────────────────────────────────────────────────────
        // Step 5: 서비스 활성화
        // ─────────────────────────────────────────────────────────────────────
        await this._activateServices(mode, submode, submodeRules);
        
        // ─────────────────────────────────────────────────────────────────────
        // Step 6: 특수 처리 (옵션 기반)
        // ─────────────────────────────────────────────────────────────────────
        await this._handleSpecialOptions(mode, submode, submodeRules);
        
        // ─────────────────────────────────────────────────────────────────────
        // Step 7: 모드 진입 훅 실행
        // ─────────────────────────────────────────────────────────────────────
        if (rules.hooks?.onEnter) {
            eventBus.emit(rules.hooks.onEnter, { mode, submode });
        }
    }
    
    /**
     * Step 1: 이전 상태 정리
     * @private
     */
    async _cleanupPreviousState() {
        console.log('[NavigationController]    Step 1: 이전 상태 정리');
        
        // 1. 현재 활성 View 숨김 (ViewManager)
        if (this._state.activeView) {
            const vm = await getViewManager();
            if (vm && typeof vm.hide === 'function') {
                console.log(`[NavigationController]       ↳ View 숨김: ${this._state.activeView}`);
                try {
                    vm.hide(this._state.activeView);
                } catch (e) {
                    console.warn(`[NavigationController]       ⚠️ View 숨김 실패: ${e.message}`);
                }
            }
        }
        
        // 2. 3D 애니메이션 중지 (3D View에서 나갈 때)
        if (this._state.submode === '3d-view') {
            console.log('[NavigationController]       ↳ 3D 애니메이션 중지 요청');
            eventBus.emit('threejs:stop-requested');
        }
        
        // 3. 모드 종료 훅
        const prevRules = getModeRules(this._state.mode);
        if (prevRules?.hooks?.onExit) {
            eventBus.emit(prevRules.hooks.onExit, {
                mode: this._state.mode,
                submode: this._state.submode
            });
        }
    }
    
    /**
     * Step 2: AppModeManager 동기화
     * @private
     */
    async _syncAppModeManager(mode, submode, rules) {
        console.log('[NavigationController]    Step 2: AppModeManager 동기화');
        
        const targetAppMode = rules.appMode;
        const currentAppMode = appModeManager.getCurrentMode();
        
        if (currentAppMode !== targetAppMode) {
            console.log(`[NavigationController]       ↳ AppMode 전환: ${currentAppMode} → ${targetAppMode}`);
            
            // 연결 체크 스킵 (이미 NavigationController에서 체크함)
            await appModeManager.switchMode(targetAppMode, { skipConnectionCheck: true });
        }
        
        // 서브모드 설정
        if (submode) {
            console.log(`[NavigationController]       ↳ SubMode 설정: ${submode}`);
            appModeManager.setSubMode(submode);
        }
    }
    
    /**
     * Step 3: 레이어 전환
     * @private
     */
    async _switchLayers(mode, submode, rules) {
        console.log('[NavigationController]    Step 3: 레이어 전환');
        
        // 최종 레이어 설정 계산
        const finalLayers = computeFinalLayers(mode, submode);
        
        // 모든 레이어에 대해 표시/숨김 적용
        for (const [layerId, visible] of Object.entries(finalLayers)) {
            const element = this._layerCache.get(layerId);
            
            if (element) {
                this._setLayerVisibility(element, layerId, visible);
                console.log(`[NavigationController]       ↳ ${layerId}: ${visible ? 'SHOW' : 'HIDE'}`);
            } else {
                // 캐시에 없으면 다시 찾기
                const freshElement = document.getElementById(layerId);
                if (freshElement) {
                    this._layerCache.set(layerId, freshElement);
                    this._setLayerVisibility(freshElement, layerId, visible);
                    console.log(`[NavigationController]       ↳ ${layerId}: ${visible ? 'SHOW' : 'HIDE'} (fresh)`);
                }
            }
        }
    }
    
    /**
     * Step 4: ViewManager View 전환
     * @private
     */
    async _switchView(mode, submode, submodeRules) {
        console.log('[NavigationController]    Step 4: ViewManager View 전환');
        
        const viewId = submodeRules?.viewManager;
        
        if (!viewId) {
            console.log('[NavigationController]       ↳ ViewManager 관리 View 없음');
            return;
        }
        
        const vm = await getViewManager();
        if (!vm) {
            console.warn('[NavigationController]       ⚠️ ViewManager 사용 불가');
            return;
        }
        
        console.log(`[NavigationController]       ↳ View 표시: ${viewId}`);
        
        try {
            if (typeof vm.show === 'function') {
                vm.show(viewId);
            } else {
                console.warn('[NavigationController]       ⚠️ viewManager.show() 없음');
            }
        } catch (error) {
            console.error(`[NavigationController]       ❌ View 표시 실패: ${error.message}`);
        }
    }
    
    /**
     * Step 5: 서비스 활성화
     * @private
     */
    async _activateServices(mode, submode, submodeRules) {
        console.log('[NavigationController]    Step 5: 서비스 활성화');
        
        const services = submodeRules?.services || [];
        
        if (services.length === 0) {
            console.log('[NavigationController]       ↳ 활성화할 서비스 없음');
            return;
        }
        
        for (const serviceName of services) {
            console.log(`[NavigationController]       ↳ 서비스 활성화 이벤트: ${serviceName}`);
            eventBus.emit(`service:activate`, { serviceName, mode, submode });
        }
    }
    
    /**
     * Step 6: 특수 처리
     * @private
     */
    async _handleSpecialOptions(mode, submode, submodeRules) {
        console.log('[NavigationController]    Step 6: 특수 처리');
        
        const options = submodeRules?.options || {};
        
        // Three.js 초기화 요청
        if (options.initThreeJS) {
            console.log('[NavigationController]       ↳ Three.js 초기화 요청');
            eventBus.emit('threejs:init-requested');
        }
        
        // Three.js 표시 요청
        if (options.startAnimation) {
            console.log('[NavigationController]       ↳ Three.js 표시 요청');
            eventBus.emit('threejs:show-requested');
        }
        
        // 애니메이션 중지
        if (options.stopAnimation) {
            console.log('[NavigationController]       ↳ 애니메이션 중지 요청');
            eventBus.emit('threejs:stop-animation-requested');
        }
        
        // Layout Editor 초기화
        if (options.initLayoutEditor) {
            console.log('[NavigationController]       ↳ Layout Editor 초기화 요청');
            eventBus.emit('layout-editor:init-requested');
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Private - 유틸리티
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 레이어 가시성 설정
     * @private
     */
    _setLayerVisibility(element, layerId, visible) {
        const config = LAYER_CONFIG[layerId];
        
        if (!config) {
            // 기본 처리
            element.classList.toggle('hidden', !visible);
            return;
        }
        
        if (visible) {
            // 표시
            if (config.showMethod === 'classList') {
                if (config.hideClass) {
                    element.classList.remove(config.hideClass);
                }
                if (config.showClass) {
                    element.classList.add(config.showClass);
                }
            } else if (config.showMethod === 'style') {
                element.style.display = config.showValue;
            }
            
            // 추가 표시 로직
            if (config.additionalShow) {
                config.additionalShow(element);
            }
            
        } else {
            // 숨김
            if (config.hideMethod === 'classList') {
                if (config.showClass) {
                    element.classList.remove(config.showClass);
                }
                if (config.hideClass) {
                    element.classList.add(config.hideClass);
                }
            } else if (config.hideMethod === 'style') {
                element.style.display = config.hideValue;
            }
            
            // 추가 숨김 로직
            if (config.additionalHide) {
                config.additionalHide(element);
            }
        }
    }
    
    /**
     * 연결 요구사항 체크
     * @private
     */
    _checkConnectionRequirement(mode) {
        // Dev Mode 확인
        const devModeEnabled = window.sidebarState?.devModeEnabled || false;
        if (devModeEnabled) {
            return true;  // Dev Mode에서는 연결 불필요
        }
        
        // 연결 상태 확인
        const isConnected = window.sidebarState?.isConnected || false;
        const isBackendOnline = appModeManager.isBackendOnline?.() ?? true;
        
        return isConnected || isBackendOnline;
    }
    
    /**
     * 활성 View ID 가져오기
     * @private
     */
    _getActiveView(mode, submode) {
        const submodeRules = getSubmodeRules(mode, submode);
        return submodeRules?.viewManager || null;
    }
    
    /**
     * 히스토리에 추가
     * @private
     */
    _addToHistory(state) {
        this._history.push({ ...state });
        
        // 최대 크기 초과 시 오래된 항목 제거
        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public API - 추가 기능
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 레이어 캐시 새로고침
     */
    refreshLayerCache() {
        this._layerCache.clear();
        this._cacheLayerElements();
    }
    
    /**
     * 히스토리 초기화
     */
    clearHistory() {
        this._history = [];
    }
    
    /**
     * 상태 리셋 (초기 상태로)
     */
    async reset() {
        this._previousState = null;
        this._history = [];
        return this.goHome({ skipHistory: true });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Debug
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('🧭 NavigationController Debug');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Current State:');
        console.log('  Mode:', this._state.mode);
        console.log('  Submode:', this._state.submode);
        console.log('  Active View:', this._state.activeView);
        console.log('  Active Layers:', this._state.activeLayers);
        console.log('  Timestamp:', new Date(this._state.timestamp).toISOString());
        console.log('───────────────────────────────────────────────────────────');
        console.log('Previous State:', this._previousState);
        console.log('───────────────────────────────────────────────────────────');
        console.log('Is Transitioning:', this._isTransitioning);
        console.log('Initialized:', this._initialized);
        console.log('───────────────────────────────────────────────────────────');
        console.log('History (last 5):');
        this._history.slice(-5).forEach((h, i) => {
            console.log(`  [${i}] ${h.mode}/${h.submode || 'none'} @ ${new Date(h.timestamp).toLocaleTimeString()}`);
        });
        console.log('───────────────────────────────────────────────────────────');
        console.log('Cached Layers:', [...this._layerCache.keys()]);
        console.log('═══════════════════════════════════════════════════════════');
        console.groupEnd();
    }
    
    /**
     * 레이어 상태 디버그
     */
    debugLayers() {
        console.group('📦 Layer Status');
        
        this._layerCache.forEach((element, layerId) => {
            const isHidden = element.classList.contains('hidden');
            const isActive = element.classList.contains('active');
            const display = element.style.display;
            
            console.log(`${layerId}:`, {
                hidden: isHidden,
                active: isActive,
                display: display || 'auto',
                visible: !isHidden && display !== 'none'
            });
        });
        
        console.groupEnd();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Cleanup
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * 정리
     */
    destroy() {
        // 이벤트 구독 해제
        this._eventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._eventUnsubscribers = [];
        
        // 캐시 정리
        this._layerCache.clear();
        
        // 히스토리 정리
        this._history = [];
        
        console.log('[NavigationController] 🧹 정리 완료');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 싱글톤 인스턴스
// ═══════════════════════════════════════════════════════════════════════════════

export const navigationController = new NavigationController();

// 클래스도 export (테스트/확장용)
export { NavigationController };

// ═══════════════════════════════════════════════════════════════════════════════
// 전역 노출
// ═══════════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
    window.navigationController = navigationController;
    
    // 디버그 함수 전역 등록
    window.debugNavigation = () => navigationController.debug();
    window.debugLayers = () => navigationController.debugLayers();
}