/**
 * ScrollSyncManager.js
 * ====================
 * 레인 스크롤 동기화 관리자
 * 
 * @version 1.0.0
 * @description
 * - 레인별 독립 스크롤 관리
 * - 스크롤 중 애니메이션 목표 위치 재계산
 * - 스크롤 이벤트 최적화 (throttle/debounce)
 * - 가상 스크롤 지원 준비
 * 
 * @changelog
 * - v1.0.0: 초기 구현
 *   - 스크롤 이벤트 관리
 *   - 애니메이션 연동
 *   - 성능 최적화
 *   - ⚠️ 호환성: 신규 파일
 * 
 * @dependencies
 * - EventBus.js
 * 
 * @exports
 * - ScrollSyncManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/ScrollSyncManager.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { eventBus } from '../../../core/managers/EventBus.js';

/**
 * ScrollSyncManager - 레인 스크롤 동기화 관리자
 * 
 * 주요 기능:
 * 1. 레인별 독립 스크롤 관리
 * 2. 스크롤 중 애니메이션 목표 위치 재계산
 * 3. 부드러운 스크롤 투 기능
 * 4. 스크롤 상태 추적 및 이벤트 발행
 */
export class ScrollSyncManager {
    // ─────────────────────────────────────────────────────────────
    // Static Constants
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 기본 설정
     */
    static DEFAULTS = {
        THROTTLE_MS: 16,              // ~60fps
        DEBOUNCE_MS: 100,             // 스크롤 종료 감지
        SMOOTH_SCROLL_DURATION: 300,  // 부드러운 스크롤 시간
        SCROLL_BUFFER: 50             // 버퍼 영역 (px)
    };
    
    /**
     * 스크롤 방향
     */
    static DIRECTION = {
        UP: 'up',
        DOWN: 'down',
        NONE: 'none'
    };
    
    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    
    /**
     * ScrollSyncManager 생성자
     * @param {Object} options - 설정 옵션
     * @param {Map} options.lanesMap - 레인 맵 (laneId → RankingLane)
     * @param {Function} options.onScrollUpdate - 스크롤 업데이트 콜백
     * @param {Function} options.onScrollEnd - 스크롤 종료 콜백
     */
    constructor(options = {}) {
        this.lanesMap = options.lanesMap || new Map();
        this._onScrollUpdate = options.onScrollUpdate || null;
        this._onScrollEnd = options.onScrollEnd || null;
        
        // 설정
        this._config = {
            ...ScrollSyncManager.DEFAULTS,
            ...options.config
        };
        
        // 스크롤 상태
        this._scrollStates = new Map(); // laneId → { scrollTop, direction, isScrolling }
        this._scrollEndTimers = new Map();
        this._lastScrollTimes = new Map();
        
        // Bound handlers
        this._boundHandlers = {};
        
        this._init();
    }
    
    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 초기화
     * @private
     */
    _init() {
        console.log('[ScrollSyncManager] 📜 Initializing...');
    }
    
    /**
     * 레인 스크롤 이벤트 등록
     * @param {string} laneId - 레인 ID
     * @param {HTMLElement} scrollContainer - 스크롤 컨테이너
     */
    registerLane(laneId, scrollContainer) {
        if (!scrollContainer) {
            console.warn(`[ScrollSyncManager] ⚠️ Invalid scroll container for lane: ${laneId}`);
            return;
        }
        
        // 초기 상태 설정
        this._scrollStates.set(laneId, {
            scrollTop: scrollContainer.scrollTop,
            direction: ScrollSyncManager.DIRECTION.NONE,
            isScrolling: false,
            element: scrollContainer
        });
        
        // 핸들러 생성 및 등록
        const handler = this._createScrollHandler(laneId);
        this._boundHandlers[laneId] = handler;
        
        scrollContainer.addEventListener('scroll', handler, { passive: true });
        
        console.log(`[ScrollSyncManager] ✅ Registered lane: ${laneId}`);
    }
    
    /**
     * 레인 스크롤 이벤트 해제
     * @param {string} laneId - 레인 ID
     */
    unregisterLane(laneId) {
        const state = this._scrollStates.get(laneId);
        const handler = this._boundHandlers[laneId];
        
        if (state && state.element && handler) {
            state.element.removeEventListener('scroll', handler);
        }
        
        this._scrollStates.delete(laneId);
        delete this._boundHandlers[laneId];
        
        // 타이머 정리
        const timer = this._scrollEndTimers.get(laneId);
        if (timer) {
            clearTimeout(timer);
            this._scrollEndTimers.delete(laneId);
        }
        
        console.log(`[ScrollSyncManager] 🗑️ Unregistered lane: ${laneId}`);
    }
    
    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 특정 레인의 스크롤 위치 가져오기
     * @param {string} laneId - 레인 ID
     * @returns {number} scrollTop
     */
    getScrollTop(laneId) {
        const state = this._scrollStates.get(laneId);
        return state ? state.scrollTop : 0;
    }
    
    /**
     * 특정 레인의 스크롤 상태 가져오기
     * @param {string} laneId - 레인 ID
     * @returns {Object|null} { scrollTop, direction, isScrolling }
     */
    getScrollState(laneId) {
        return this._scrollStates.get(laneId) || null;
    }
    
    /**
     * 모든 레인의 스크롤 상태 가져오기
     * @returns {Map}
     */
    getAllScrollStates() {
        const states = new Map();
        for (const [laneId, state] of this._scrollStates) {
            states.set(laneId, {
                scrollTop: state.scrollTop,
                direction: state.direction,
                isScrolling: state.isScrolling
            });
        }
        return states;
    }
    
    /**
     * 스크롤 중인 레인이 있는지 확인
     * @returns {boolean}
     */
    isAnyScrolling() {
        for (const state of this._scrollStates.values()) {
            if (state.isScrolling) return true;
        }
        return false;
    }
    
    /**
     * 부드러운 스크롤 투
     * @param {string} laneId - 레인 ID
     * @param {number} targetScrollTop - 목표 스크롤 위치
     * @param {Object} options - 옵션
     * @returns {Promise}
     */
    smoothScrollTo(laneId, targetScrollTop, options = {}) {
        const state = this._scrollStates.get(laneId);
        if (!state || !state.element) {
            return Promise.resolve();
        }
        
        const {
            duration = this._config.SMOOTH_SCROLL_DURATION,
            easing = 'ease-out'
        } = options;
        
        return new Promise((resolve) => {
            const startScrollTop = state.element.scrollTop;
            const distance = targetScrollTop - startScrollTop;
            const startTime = performance.now();
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing 적용
                const easedProgress = this._applyEasing(progress, easing);
                
                // 스크롤 위치 설정
                state.element.scrollTop = startScrollTop + (distance * easedProgress);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }
    
    /**
     * 특정 카드로 스크롤
     * @param {string} laneId - 레인 ID
     * @param {number} cardIndex - 카드 인덱스
     * @param {Object} options - 옵션
     * @returns {Promise}
     */
    scrollToCard(laneId, cardIndex, options = {}) {
        const state = this._scrollStates.get(laneId);
        if (!state || !state.element) {
            return Promise.resolve();
        }
        
        const { position = 'center' } = options;
        
        // 카드 높이 추정
        const card = state.element.querySelector('.equipment-card');
        if (!card) return Promise.resolve();
        
        const cardHeight = card.offsetHeight + 8; // gap 포함
        const containerHeight = state.element.clientHeight;
        
        let targetScrollTop;
        
        switch (position) {
            case 'top':
                targetScrollTop = cardIndex * cardHeight;
                break;
            case 'center':
                targetScrollTop = (cardIndex * cardHeight) - (containerHeight / 2) + (cardHeight / 2);
                break;
            case 'bottom':
                targetScrollTop = (cardIndex * cardHeight) - containerHeight + cardHeight;
                break;
            default:
                targetScrollTop = cardIndex * cardHeight;
        }
        
        targetScrollTop = Math.max(0, targetScrollTop);
        
        return this.smoothScrollTo(laneId, targetScrollTop, options);
    }
    
    /**
     * 스크롤 위치 즉시 설정
     * @param {string} laneId - 레인 ID
     * @param {number} scrollTop - 스크롤 위치
     */
    setScrollTop(laneId, scrollTop) {
        const state = this._scrollStates.get(laneId);
        if (state && state.element) {
            state.element.scrollTop = scrollTop;
            state.scrollTop = scrollTop;
        }
    }
    
    /**
     * 모든 레인 스크롤 초기화
     */
    resetAllScroll() {
        for (const [laneId, state] of this._scrollStates) {
            if (state.element) {
                state.element.scrollTop = 0;
                state.scrollTop = 0;
                state.direction = ScrollSyncManager.DIRECTION.NONE;
            }
        }
        console.log('[ScrollSyncManager] 🔄 All scroll positions reset');
    }
    
    /**
     * 스크롤 잠금
     * @param {string} laneId - 레인 ID
     */
    lockScroll(laneId) {
        const state = this._scrollStates.get(laneId);
        if (state && state.element) {
            state.element.style.overflow = 'hidden';
            state.isLocked = true;
        }
    }
    
    /**
     * 스크롤 잠금 해제
     * @param {string} laneId - 레인 ID
     */
    unlockScroll(laneId) {
        const state = this._scrollStates.get(laneId);
        if (state && state.element) {
            state.element.style.overflow = '';
            state.isLocked = false;
        }
    }
    
    /**
     * 모든 스크롤 잠금
     */
    lockAllScroll() {
        for (const laneId of this._scrollStates.keys()) {
            this.lockScroll(laneId);
        }
    }
    
    /**
     * 모든 스크롤 잠금 해제
     */
    unlockAllScroll() {
        for (const laneId of this._scrollStates.keys()) {
            this.unlockScroll(laneId);
        }
    }
    
    // ─────────────────────────────────────────────────────────────
    // Private Methods
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 스크롤 핸들러 생성
     * @private
     */
    _createScrollHandler(laneId) {
        return (event) => {
            const now = Date.now();
            const lastTime = this._lastScrollTimes.get(laneId) || 0;
            
            // Throttle
            if (now - lastTime < this._config.THROTTLE_MS) {
                return;
            }
            this._lastScrollTimes.set(laneId, now);
            
            this._handleScroll(laneId, event);
        };
    }
    
    /**
     * 스크롤 이벤트 처리
     * @private
     */
    _handleScroll(laneId, event) {
        const state = this._scrollStates.get(laneId);
        if (!state) return;
        
        const newScrollTop = event.target.scrollTop;
        const prevScrollTop = state.scrollTop;
        
        // 방향 계산
        let direction = ScrollSyncManager.DIRECTION.NONE;
        if (newScrollTop > prevScrollTop) {
            direction = ScrollSyncManager.DIRECTION.DOWN;
        } else if (newScrollTop < prevScrollTop) {
            direction = ScrollSyncManager.DIRECTION.UP;
        }
        
        // 상태 업데이트
        state.scrollTop = newScrollTop;
        state.direction = direction;
        state.isScrolling = true;
        
        // 콜백 호출
        this._onScrollUpdate?.({
            laneId,
            scrollTop: newScrollTop,
            direction,
            delta: newScrollTop - prevScrollTop
        });
        
        // 이벤트 발행
        EventBus.emit('ranking:scroll:update', {
            laneId,
            scrollTop: newScrollTop,
            direction
        });
        
        // 스크롤 종료 감지 (debounce)
        this._scheduleScrollEnd(laneId);
    }
    
    /**
     * 스크롤 종료 스케줄
     * @private
     */
    _scheduleScrollEnd(laneId) {
        // 기존 타이머 취소
        const existingTimer = this._scrollEndTimers.get(laneId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        
        // 새 타이머 설정
        const timer = setTimeout(() => {
            this._handleScrollEnd(laneId);
        }, this._config.DEBOUNCE_MS);
        
        this._scrollEndTimers.set(laneId, timer);
    }
    
    /**
     * 스크롤 종료 처리
     * @private
     */
    _handleScrollEnd(laneId) {
        const state = this._scrollStates.get(laneId);
        if (!state) return;
        
        state.isScrolling = false;
        state.direction = ScrollSyncManager.DIRECTION.NONE;
        
        // 콜백 호출
        this._onScrollEnd?.({
            laneId,
            scrollTop: state.scrollTop
        });
        
        // 이벤트 발행
        EventBus.emit('ranking:scroll:end', {
            laneId,
            scrollTop: state.scrollTop
        });
        
        // 타이머 정리
        this._scrollEndTimers.delete(laneId);
    }
    
    /**
     * Easing 함수 적용
     * @private
     */
    _applyEasing(progress, easing) {
        switch (easing) {
            case 'linear':
                return progress;
            case 'ease-in':
                return progress * progress;
            case 'ease-out':
                return 1 - Math.pow(1 - progress, 2);
            case 'ease-in-out':
                return progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            default:
                return 1 - Math.pow(1 - progress, 2); // ease-out
        }
    }
    
    // ─────────────────────────────────────────────────────────────
    // Setters
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 레인 맵 설정
     * @param {Map} lanesMap
     */
    setLanesMap(lanesMap) {
        this.lanesMap = lanesMap;
    }
    
    /**
     * 설정 업데이트
     * @param {Object} config
     */
    updateConfig(config) {
        this._config = {
            ...this._config,
            ...config
        };
    }
    
    // ─────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('[ScrollSyncManager] 🗑️ Disposing...');
        
        // 모든 레인 등록 해제
        for (const laneId of [...this._scrollStates.keys()]) {
            this.unregisterLane(laneId);
        }
        
        // 타이머 정리
        for (const timer of this._scrollEndTimers.values()) {
            clearTimeout(timer);
        }
        this._scrollEndTimers.clear();
        
        // 상태 초기화
        this._scrollStates.clear();
        this._lastScrollTimes.clear();
        this._boundHandlers = {};
        
        // 콜백 해제
        this._onScrollUpdate = null;
        this._onScrollEnd = null;
        
        this.lanesMap = null;
        
        console.log('[ScrollSyncManager] ✅ Disposed');
    }
}