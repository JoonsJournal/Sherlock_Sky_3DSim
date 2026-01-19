/**
 * AnimationManager.js
 * ===================
 * Ranking View 애니메이션 관리자
 * 
 * @version 1.1.0
 * @description
 * - 레인 간 이동 애니메이션 (4-Phase 시퀀스)
 * - 밀림 효과 (Push Down) 처리
 * - 다중 카드 동시 애니메이션
 * - 상태 변경 감지 및 처리
 * 
 * @changelog
 * - v1.1.0 (2026-01-17): 4-Phase 애니메이션 시퀀스 구현
 *   - Phase 1: 카드 떠오름 (Lift)
 *   - Phase 2: 목표 레인 카드 밀림 (Push Down)
 *   - Phase 3: 대각선 이동 (Move)
 *   - Phase 4: 안착 (Settle)
 *   - Clone 패턴 적용 (원본 ghost 유지)
 *   - 목표 레인 하이라이트 추가
 * - v1.0.0: 초기 구현
 * 
 * @dependencies
 * - PositionCalculator.js
 * - BatchAnimator.js
 * - EventBus.js
 * 
 * @exports
 * - AnimationManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/AnimationManager.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { eventBus } from '../../../core/managers/EventBus.js';
import { PositionCalculator } from '../utils/PositionCalculator.js';
import { BatchAnimator } from '../utils/BatchAnimator.js';

/**
 * AnimationManager - Ranking View 애니메이션 관리자
 * 
 * 주요 기능:
 * 1. 상태 변경 감지 및 변경 목록 추출
 * 2. 애니메이션 타입 결정 (lane-change, push-down, rank-change)
 * 3. 4-Phase 레인 이동 애니메이션 (떠오름 → 밀림 → 이동 → 안착)
 * 4. 스크롤 위치 고려한 정확한 좌표 계산
 */
export class AnimationManager {
    // ─────────────────────────────────────────────────────────────
    // Static Constants
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 애니메이션 타이밍 설정 (밀리초)
     * @version 1.1.0 - LIFT, PUSH_DOWN_STAGGER, LANE_CHANGE 업데이트
     */
    static TIMING = {
        // Phase 1: 떠오름
        LIFT: 150,
        
        // Phase 2: 밀림
        PUSH_DOWN: 250,
        PUSH_DOWN_STAGGER: 20,      // 밀림 wave 딜레이
        
        // Phase 3: 레인 이동
        LANE_CHANGE: 450,
        
        // Phase 4: 안착
        SETTLE: 200,
        
        // 기타
        RANK_CHANGE: 300,
        ENTER: 250,
        LEAVE: 200,
        STAGGER_DELAY: 30
    };
    
    /**
     * 애니메이션 Easing 함수
     */
    static EASING = {
        LIFT: 'ease-out',
        LANE_CHANGE: 'cubic-bezier(0.4, 0, 0.2, 1)',
        PUSH_DOWN: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        RANK_CHANGE: 'ease-out',
        ENTER: 'cubic-bezier(0.0, 0, 0.2, 1)',
        LEAVE: 'cubic-bezier(0.4, 0, 1, 1)'
    };
    
    /**
     * 애니메이션 타입
     */
    static ANIMATION_TYPE = {
        LANE_CHANGE: 'lane-change',
        PUSH_DOWN: 'push-down',
        RANK_CHANGE: 'rank-change',
        ENTER: 'enter',
        LEAVE: 'leave',
        NONE: 'none'
    };
    
    /**
     * CSS 클래스 상수
     * @version 1.1.0 - GHOST, LIFTING, LANE_TARGET 추가
     */
    static CSS = {
        ANIMATING: 'equipment-card--animating',
        ENTERING: 'equipment-card--entering',
        LEAVING: 'equipment-card--leaving',
        PUSHED: 'equipment-card--pushed',
        GHOST: 'equipment-card--ghost',
        LIFTING: 'equipment-card--lifting',
        STATUS_CHANGED: 'equipment-card--status-changed',
        LANE_TARGET: 'ranking-lane--target'
    };
    
    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    
    /**
     * AnimationManager 생성자
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement} options.container - 레인 컨테이너
     * @param {Map} options.lanesMap - 레인 맵 (laneId → RankingLane)
     * @param {Map} options.cardsMap - 카드 맵 (equipmentId → EquipmentCard)
     */
    constructor(options = {}) {
        this.container = options.container || null;
        this.lanesMap = options.lanesMap || new Map();
        this.cardsMap = options.cardsMap || new Map();
        
        // 내부 상태
        this._isAnimating = false;
        this._animationQueue = [];
        this._activeAnimations = new Set();
        this._previousState = null;
        
        // Position Calculator
        this._positionCalculator = new PositionCalculator({
            container: this.container,
            lanesMap: this.lanesMap
        });
        
        // Batch Animator
        this._batchAnimator = new BatchAnimator({
            onAnimationStart: this._handleAnimationStart.bind(this),
            onAnimationComplete: this._handleAnimationComplete.bind(this)
        });
        
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
        console.log('[AnimationManager] 🎬 Initializing v1.1.0...');
        this._setupEventListeners();
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        this._boundHandlers.onStatusChange = this._handleStatusChange.bind(this);
        this._boundHandlers.onLaneUpdate = this._handleLaneUpdate.bind(this);
        
        EventBus.on('ranking:status:change', this._boundHandlers.onStatusChange);
        EventBus.on('ranking:lane:update', this._boundHandlers.onLaneUpdate);
    }
    
    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 상태 변경 처리 (메인 진입점)
     * @param {Object} previousState - 이전 상태
     * @param {Object} currentState - 현재 상태
     */
    processStateChange(previousState, currentState) {
        console.log('[AnimationManager] 🔄 Processing state change...');
        
        const changes = this._detectChanges(previousState, currentState);
        
        if (changes.length === 0) {
            console.log('[AnimationManager] ℹ️ No changes detected');
            return;
        }
        
        console.log(`[AnimationManager] 📊 Detected ${changes.length} change(s)`);
        
        const positionMap = this._calculateAllPositions(currentState, changes);
        this._animateBatch(positionMap, changes);
        this._previousState = currentState;
    }
    
    /**
     * [v1.1.0] 레인 간 이동 애니메이션 (4-Phase 시퀀스)
     * 
     * Phase 1: 카드 떠오름 (Lift)
     * Phase 2: 목표 레인 카드 밀림 (Push Down for Space)
     * Phase 3: 대각선 이동 (Move)
     * Phase 4: 안착 (Settle)
     * 
     * @param {string} equipmentId - 설비 ID
     * @param {string} fromLaneId - 출발 레인 ID
     * @param {string} toLaneId - 도착 레인 ID
     * @param {Object} options - 추가 옵션
     * @param {number} options.targetIndex - 목표 인덱스 (기본: 0)
     */
    async animateLaneChange(equipmentId, fromLaneId, toLaneId, options = {}) {
        const card = this.cardsMap.get(equipmentId);
        if (!card || !card.element) {
            console.warn(`[AnimationManager] ⚠️ Card not found: ${equipmentId}`);
            return;
        }
        
        const fromLane = this.lanesMap.get(fromLaneId);
        const toLane = this.lanesMap.get(toLaneId);
        
        if (!fromLane || !toLane) {
            console.warn(`[AnimationManager] ⚠️ Lane not found: ${fromLaneId} or ${toLaneId}`);
            return;
        }
        
        const element = card.element;
        const toContainer = toLane.element.querySelector('.ranking-lane__cards-container');
        
        if (!toContainer) {
            console.warn(`[AnimationManager] ⚠️ Target container not found`);
            return;
        }
        
        console.log(`[AnimationManager] 🚀 Starting 4-Phase lane change: ${fromLaneId} → ${toLaneId}`);
        
        this._isAnimating = true;
        
        try {
            // 현재 위치 저장
            const fromRect = element.getBoundingClientRect();
            const cardWidth = fromRect.width;
            const cardHeight = fromRect.height;
            const targetIndex = options.targetIndex || 0;
            
            // ─── Phase 1: Ghost + Clone 생성 ───
            console.log('[AnimationManager] 📍 Phase 1: Preparing lift-off');
            
            element.classList.add(AnimationManager.CSS.GHOST);
            
            const clone = element.cloneNode(true);
            clone.classList.remove(
                AnimationManager.CSS.GHOST,
                'equipment-card--selected'
            );
            clone.classList.add(AnimationManager.CSS.ANIMATING);
            clone.style.cssText = `
                position: fixed;
                left: ${fromRect.left}px;
                top: ${fromRect.top}px;
                width: ${cardWidth}px;
                height: ${cardHeight}px;
                margin: 0;
                z-index: 100;
            `;
            document.body.appendChild(clone);
            
            // 목표 레인 하이라이트
            toLane.element.classList.add(AnimationManager.CSS.LANE_TARGET);
            
            // Lift animation
            await this._animateLift(clone);
            
            // ─── Phase 2: 목표 레인 카드들 밀림 ───
            console.log('[AnimationManager] 📦 Phase 2: Making space');
            
            const cardsToPush = this._getCardsToPush(toContainer, targetIndex);
            const pushDistance = cardHeight + 8; // card height + gap
            
            if (cardsToPush.length > 0) {
                await this._animatePushDownForSpace(cardsToPush, pushDistance);
            }
            
            // ─── Phase 3: 대각선 이동 ───
            console.log('[AnimationManager] ✈️ Phase 3: Moving to target');
            
            const targetPosition = this._calculateTargetPositionForLaneChange(
                toContainer,
                targetIndex,
                cardsToPush,
                pushDistance
            );
            
            await this._animateMoveTo(clone, fromRect, targetPosition);
            
            // ─── Phase 4: 정리 및 안착 ───
            console.log('[AnimationManager] 🎯 Phase 4: Settling');
            
            clone.remove();
            toLane.element.classList.remove(AnimationManager.CSS.LANE_TARGET);
            
            // 밀린 카드들 원위치 (실제 DOM 위치는 변경되지 않았으므로 transform만 제거)
            this._settlePushedCards(cardsToPush);
            
            // 원본 카드 표시 및 목표 레인으로 이동
            element.classList.remove(AnimationManager.CSS.GHOST);
            this._insertCardAtIndex(element, toContainer, targetIndex);
            
            // 안착 효과
            element.classList.add(AnimationManager.CSS.STATUS_CHANGED);
            setTimeout(() => {
                element.classList.remove(AnimationManager.CSS.STATUS_CHANGED);
            }, 400);
            
            console.log(`[AnimationManager] ✅ Lane change complete: ${fromLaneId} → ${toLaneId}`);
            
            // 완료 이벤트 발행
            EventBus.emit('ranking:animation:lane-change:complete', {
                equipmentId,
                fromLaneId,
                toLaneId
            });
            
        } catch (error) {
            console.error('[AnimationManager] ❌ Lane change animation error:', error);
            
            // 에러 시 복구
            element.classList.remove(AnimationManager.CSS.GHOST);
            toLane.element.classList.remove(AnimationManager.CSS.LANE_TARGET);
            
            // 혹시 clone이 남아있다면 제거
            const orphanClone = document.body.querySelector(`.${AnimationManager.CSS.ANIMATING}`);
            if (orphanClone) orphanClone.remove();
            
        } finally {
            this._isAnimating = false;
        }
    }
    
    /**
     * 단일 카드 애니메이션 (레인 내 이동용)
     * @param {string} equipmentId - 설비 ID
     * @param {string} fromLaneId - 출발 레인 ID
     * @param {string} toLaneId - 도착 레인 ID
     * @param {Object} options - 추가 옵션
     */
    animateCard(equipmentId, fromLaneId, toLaneId, options = {}) {
        // 레인이 다르면 4-Phase 애니메이션 사용
        if (fromLaneId !== toLaneId) {
            return this.animateLaneChange(equipmentId, fromLaneId, toLaneId, options);
        }
        
        // 같은 레인 내 이동은 기존 로직
        const card = this.cardsMap.get(equipmentId);
        if (!card) {
            console.warn(`[AnimationManager] ⚠️ Card not found: ${equipmentId}`);
            return Promise.resolve();
        }
        
        const fromRect = card.element.getBoundingClientRect();
        const toPosition = this._positionCalculator.calculateTargetPosition(
            equipmentId,
            toLaneId,
            options.targetIndex || 0
        );
        
        const deltaX = toPosition.x - fromRect.left;
        const deltaY = toPosition.y - fromRect.top;
        
        return this._animateSingleCard(card, {
            deltaX,
            deltaY,
            type: AnimationManager.ANIMATION_TYPE.RANK_CHANGE,
            fromLaneId,
            toLaneId,
            ...options
        });
    }
    
    /**
     * 카드 진입 애니메이션
     * @param {EquipmentCard} card - 카드 인스턴스
     * @param {string} laneId - 레인 ID
     * @param {number} index - 삽입 위치
     */
    animateEnter(card, laneId, index = 0) {
        if (!card || !card.element) return Promise.resolve();
        
        const element = card.element;
        element.classList.add(AnimationManager.CSS.ENTERING);
        
        return this._batchAnimator.animate(element, {
            keyframes: [
                { opacity: 0, transform: 'translateY(-20px) scale(0.95)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }
            ],
            duration: AnimationManager.TIMING.ENTER,
            easing: AnimationManager.EASING.ENTER
        }).then(() => {
            element.classList.remove(AnimationManager.CSS.ENTERING);
        });
    }
    
    /**
     * 카드 퇴장 애니메이션
     * @param {EquipmentCard} card - 카드 인스턴스
     */
    animateLeave(card) {
        if (!card || !card.element) return Promise.resolve();
        
        const element = card.element;
        element.classList.add(AnimationManager.CSS.LEAVING);
        
        return this._batchAnimator.animate(element, {
            keyframes: [
                { opacity: 1, transform: 'translateY(0) scale(1)' },
                { opacity: 0, transform: 'translateY(20px) scale(0.95)' }
            ],
            duration: AnimationManager.TIMING.LEAVE,
            easing: AnimationManager.EASING.LEAVE
        }).then(() => {
            element.classList.remove(AnimationManager.CSS.LEAVING);
        });
    }
    
    /**
     * 밀림 효과 애니메이션 (외부 호출용)
     * @param {Array<EquipmentCard>} cards - 밀려날 카드들
     * @param {number} distance - 밀림 거리 (px)
     */
    animatePushDown(cards, distance) {
        if (!cards || cards.length === 0) return Promise.resolve();
        
        const elements = cards
            .filter(card => card && card.element)
            .map(card => card.element);
        
        return this._animatePushDownElements(elements, distance);
    }
    
    /**
     * 애니메이션 일시 중지
     */
    pause() {
        this._batchAnimator.pauseAll();
    }
    
    /**
     * 애니메이션 재개
     */
    resume() {
        this._batchAnimator.resumeAll();
    }
    
    /**
     * 모든 애니메이션 취소
     */
    cancelAll() {
        this._batchAnimator.cancelAll();
        this._activeAnimations.clear();
        this._isAnimating = false;
        
        // 남아있는 ghost/animating 클래스 정리
        document.querySelectorAll(`.${AnimationManager.CSS.GHOST}`).forEach(el => {
            el.classList.remove(AnimationManager.CSS.GHOST);
        });
        document.querySelectorAll(`.${AnimationManager.CSS.ANIMATING}`).forEach(el => {
            el.remove();
        });
        document.querySelectorAll(`.${AnimationManager.CSS.LANE_TARGET}`).forEach(el => {
            el.classList.remove(AnimationManager.CSS.LANE_TARGET);
        });
    }
    
    /**
     * 애니메이션 중인지 확인
     * @returns {boolean}
     */
    isAnimating() {
        return this._isAnimating || this._activeAnimations.size > 0;
    }
    
    // ─────────────────────────────────────────────────────────────
    // Private: 4-Phase Animation Helpers
    // ─────────────────────────────────────────────────────────────
    
    /**
     * [Phase 1] 카드 떠오름 애니메이션
     * @private
     * @param {HTMLElement} clone - 복제본 요소
     */
    async _animateLift(clone) {
        return this._batchAnimator.animate(clone, {
            keyframes: [
                { 
                    transform: 'scale(1)', 
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' 
                },
                { 
                    transform: 'scale(1.05) translateY(-10px)', 
                    boxShadow: '0 20px 30px rgba(0, 0, 0, 0.2)' 
                }
            ],
            duration: AnimationManager.TIMING.LIFT,
            easing: AnimationManager.EASING.LIFT,
            fill: 'forwards'
        });
    }
    
    /**
     * [Phase 2] 공간 확보용 밀림 애니메이션
     * @private
     * @param {HTMLElement[]} cards - 밀어낼 카드 요소들
     * @param {number} distance - 밀림 거리
     */
    async _animatePushDownForSpace(cards, distance) {
        if (cards.length === 0) return;
        
        console.log(`[AnimationManager]   ↓ Pushing down ${cards.length} cards by ${distance}px`);
        
        // 모든 카드에 transition 클래스 추가
        cards.forEach(card => {
            card.classList.add(AnimationManager.CSS.PUSHED);
        });
        
        // Wave effect로 순차 밀림
        return new Promise(resolve => {
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.style.transform = `translateY(${distance}px)`;
                }, index * AnimationManager.TIMING.PUSH_DOWN_STAGGER);
            });
            
            // 애니메이션 완료 대기
            const totalDuration = AnimationManager.TIMING.PUSH_DOWN + 
                                  (cards.length * AnimationManager.TIMING.PUSH_DOWN_STAGGER);
            setTimeout(resolve, totalDuration);
        });
    }
    
    /**
     * [Phase 3] 대각선 이동 애니메이션
     * @private
     * @param {HTMLElement} clone - 복제본 요소
     * @param {DOMRect} fromRect - 시작 위치
     * @param {Object} targetPosition - 목표 위치 {x, y}
     */
    async _animateMoveTo(clone, fromRect, targetPosition) {
        const deltaX = targetPosition.x - fromRect.left;
        const deltaY = targetPosition.y - fromRect.top - 10; // lift offset 보정
        
        return this._batchAnimator.animate(clone, {
            keyframes: [
                { 
                    transform: 'scale(1.05) translateY(-10px)',
                    boxShadow: '0 20px 30px rgba(0, 0, 0, 0.2)'
                },
                { 
                    transform: `scale(1.03) translate(${deltaX * 0.4}px, ${deltaY * 0.3 - 20}px)`,
                    boxShadow: '0 25px 35px rgba(0, 0, 0, 0.25)',
                    offset: 0.4 
                },
                { 
                    transform: `scale(1.02) translate(${deltaX * 0.8}px, ${deltaY * 0.7}px)`,
                    boxShadow: '0 15px 25px rgba(0, 0, 0, 0.2)',
                    offset: 0.8 
                },
                { 
                    transform: `scale(1) translate(${deltaX}px, ${deltaY + 10}px)`,
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }
            ],
            duration: AnimationManager.TIMING.LANE_CHANGE,
            easing: AnimationManager.EASING.LANE_CHANGE,
            fill: 'forwards'
        });
    }
    
    /**
     * [Phase 4] 밀린 카드들 원위치
     * @private
     * @param {HTMLElement[]} cards
     */
    _settlePushedCards(cards) {
        cards.forEach(card => {
            card.classList.remove(AnimationManager.CSS.PUSHED);
            card.style.transform = '';
        });
    }
    
    /**
     * 밀어야 할 카드 목록 가져오기
     * @private
     * @param {HTMLElement} container - 카드 컨테이너
     * @param {number} targetIndex - 목표 인덱스
     * @returns {HTMLElement[]}
     */
    _getCardsToPush(container, targetIndex) {
        if (!container) return [];
        
        const cards = Array.from(
            container.querySelectorAll(`.equipment-card:not(.${AnimationManager.CSS.GHOST})`)
        );
        
        return cards.slice(targetIndex);
    }
    
    /**
     * 레인 이동용 목표 위치 계산
     * @private
     * @param {HTMLElement} container - 목표 컨테이너
     * @param {number} targetIndex - 목표 인덱스
     * @param {HTMLElement[]} pushedCards - 밀린 카드들
     * @param {number} pushDistance - 밀린 거리
     * @returns {Object} {x, y}
     */
    _calculateTargetPositionForLaneChange(container, targetIndex, pushedCards, pushDistance) {
        const containerRect = container.getBoundingClientRect();
        const cards = Array.from(
            container.querySelectorAll(`.equipment-card:not(.${AnimationManager.CSS.GHOST})`)
        );
        
        const targetLeft = containerRect.left + 8; // padding
        let targetTop;
        
        if (targetIndex === 0 || cards.length === 0) {
            // 첫 번째 위치
            targetTop = containerRect.top + 8;
        } else if (targetIndex < cards.length) {
            // 밀린 카드의 원래 위치 (transform 전)
            const refCard = cards[targetIndex];
            const refRect = refCard.getBoundingClientRect();
            targetTop = refRect.top - pushDistance;
        } else {
            // 마지막 위치
            const lastCard = cards[cards.length - 1];
            const lastCardRect = lastCard.getBoundingClientRect();
            targetTop = lastCardRect.bottom + 8 - pushDistance;
        }
        
        return { x: targetLeft, y: targetTop };
    }
    
    /**
     * 카드를 특정 인덱스에 삽입
     * @private
     * @param {HTMLElement} element - 삽입할 카드 요소
     * @param {HTMLElement} container - 컨테이너
     * @param {number} targetIndex - 목표 인덱스
     */
    _insertCardAtIndex(element, container, targetIndex) {
        const cards = container.querySelectorAll(
            `.equipment-card:not(.${AnimationManager.CSS.GHOST})`
        );
        
        if (targetIndex < cards.length) {
            container.insertBefore(element, cards[targetIndex]);
        } else {
            container.appendChild(element);
        }
    }
    
    // ─────────────────────────────────────────────────────────────
    // Change Detection
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 상태 변경 감지
     * @private
     */
    _detectChanges(previousState, currentState) {
        const changes = [];
        
        if (!previousState || !currentState) {
            return changes;
        }
        
        const prevLanes = previousState.lanes || {};
        const currLanes = currentState.lanes || {};
        
        const allLaneIds = new Set([
            ...Object.keys(prevLanes),
            ...Object.keys(currLanes)
        ]);
        
        for (const laneId of allLaneIds) {
            const prevEquipments = prevLanes[laneId] || [];
            const currEquipments = currLanes[laneId] || [];
            
            // 진입/이동
            for (const equip of currEquipments) {
                const wasInLane = prevEquipments.some(e => e.equipmentId === equip.equipmentId);
                if (!wasInLane) {
                    const fromLaneId = this._findPreviousLane(equip.equipmentId, prevLanes);
                    
                    changes.push({
                        equipmentId: equip.equipmentId,
                        type: fromLaneId ? 'move' : 'enter',
                        fromLaneId: fromLaneId,
                        toLaneId: laneId,
                        data: equip
                    });
                }
            }
            
            // 퇴장
            for (const equip of prevEquipments) {
                const stillInLane = currEquipments.some(e => e.equipmentId === equip.equipmentId);
                if (!stillInLane) {
                    const toLaneId = this._findCurrentLane(equip.equipmentId, currLanes);
                    
                    if (!toLaneId) {
                        changes.push({
                            equipmentId: equip.equipmentId,
                            type: 'leave',
                            fromLaneId: laneId,
                            toLaneId: null,
                            data: equip
                        });
                    }
                }
            }
            
            // 순위 변경
            this._detectRankChanges(prevEquipments, currEquipments, laneId, changes);
        }
        
        return changes;
    }
    
    /**
     * 이전 레인 찾기
     * @private
     */
    _findPreviousLane(equipmentId, prevLanes) {
        for (const [laneId, equipments] of Object.entries(prevLanes)) {
            if (equipments.some(e => e.equipmentId === equipmentId)) {
                return laneId;
            }
        }
        return null;
    }
    
    /**
     * 현재 레인 찾기
     * @private
     */
    _findCurrentLane(equipmentId, currLanes) {
        for (const [laneId, equipments] of Object.entries(currLanes)) {
            if (equipments.some(e => e.equipmentId === equipmentId)) {
                return laneId;
            }
        }
        return null;
    }
    
    /**
     * 순위 변경 감지
     * @private
     */
    _detectRankChanges(prevEquipments, currEquipments, laneId, changes) {
        for (const currEquip of currEquipments) {
            const prevIndex = prevEquipments.findIndex(e => e.equipmentId === currEquip.equipmentId);
            const currIndex = currEquipments.findIndex(e => e.equipmentId === currEquip.equipmentId);
            
            if (prevIndex !== -1 && prevIndex !== currIndex) {
                changes.push({
                    equipmentId: currEquip.equipmentId,
                    type: 'rank-change',
                    fromLaneId: laneId,
                    toLaneId: laneId,
                    fromIndex: prevIndex,
                    toIndex: currIndex,
                    data: currEquip
                });
            }
        }
    }
    
    // ─────────────────────────────────────────────────────────────
    // Position Calculation
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 모든 위치 계산
     * @private
     */
    _calculateAllPositions(currentState, changes) {
        const positionMap = new Map();
        
        for (const change of changes) {
            if (change.type === 'leave') continue;
            
            const card = this.cardsMap.get(change.equipmentId);
            if (!card) continue;
            
            const targetLane = this.lanesMap.get(change.toLaneId);
            if (!targetLane) continue;
            
            const currentRect = card.element.getBoundingClientRect();
            const targetIndex = this._getTargetIndex(change, currentState);
            const targetPosition = this._positionCalculator.calculateTargetPosition(
                change.equipmentId,
                change.toLaneId,
                targetIndex
            );
            
            positionMap.set(change.equipmentId, {
                change,
                card,
                currentRect,
                targetPosition,
                targetIndex,
                deltaX: targetPosition.x - currentRect.left,
                deltaY: targetPosition.y - currentRect.top
            });
        }
        
        this._calculatePushDownPositions(changes, currentState, positionMap);
        
        return positionMap;
    }
    
    /**
     * 목표 인덱스 계산
     * @private
     */
    _getTargetIndex(change, currentState) {
        const laneEquipments = currentState.lanes?.[change.toLaneId] || [];
        return laneEquipments.findIndex(e => e.equipmentId === change.equipmentId);
    }
    
    /**
     * 밀림 위치 계산
     * @private
     */
    _calculatePushDownPositions(changes, currentState, positionMap) {
        const laneInsertions = new Map();
        
        for (const change of changes) {
            if (change.type === 'move' || change.type === 'enter') {
                const laneId = change.toLaneId;
                if (!laneInsertions.has(laneId)) {
                    laneInsertions.set(laneId, []);
                }
                laneInsertions.get(laneId).push(change);
            }
        }
        
        for (const [laneId, insertions] of laneInsertions) {
            const laneEquipments = currentState.lanes?.[laneId] || [];
            const lane = this.lanesMap.get(laneId);
            
            if (!lane) continue;
            
            for (const insertion of insertions) {
                const insertIndex = this._getTargetIndex(insertion, currentState);
                
                for (let i = insertIndex + 1; i < laneEquipments.length; i++) {
                    const equipmentId = laneEquipments[i].equipmentId;
                    
                    if (positionMap.has(equipmentId)) continue;
                    
                    const card = this.cardsMap.get(equipmentId);
                    if (!card) continue;
                    
                    const cardHeight = card.element.offsetHeight + 8;
                    
                    positionMap.set(equipmentId, {
                        change: {
                            equipmentId,
                            type: 'push-down',
                            fromLaneId: laneId,
                            toLaneId: laneId
                        },
                        card,
                        currentRect: card.element.getBoundingClientRect(),
                        deltaX: 0,
                        deltaY: cardHeight,
                        isPushed: true
                    });
                }
            }
        }
    }
    
    // ─────────────────────────────────────────────────────────────
    // Animation Execution
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 일괄 애니메이션 실행
     * @private
     */
    async _animateBatch(positionMap, changes) {
        if (positionMap.size === 0) return;
        
        this._isAnimating = true;
        
        console.log(`[AnimationManager] 🎬 Starting batch animation for ${positionMap.size} card(s)`);
        
        // 퇴장 애니메이션
        const leaveChanges = changes.filter(c => c.type === 'leave');
        if (leaveChanges.length > 0) {
            await this._animateLeaveCards(leaveChanges);
        }
        
        // 레인 이동 (4-Phase 사용)
        const moveChanges = changes.filter(c => c.type === 'move');
        for (const change of moveChanges) {
            await this.animateLaneChange(
                change.equipmentId,
                change.fromLaneId,
                change.toLaneId,
                { targetIndex: this._getTargetIndex(change, this._previousState) }
            );
        }
        
        // 순위 변경 및 밀림
        const otherAnimations = [];
        for (const [equipmentId, posData] of positionMap) {
            if (posData.change.type === 'move') continue;
            if (posData.change.type === 'leave') continue;
            
            const animationType = this._determineAnimationType(
                {
                    isMoving: false,
                    isPushed: posData.isPushed
                },
                posData.deltaX,
                posData.deltaY
            );
            
            const animation = this._animateSingleCard(posData.card, {
                deltaX: posData.deltaX,
                deltaY: posData.deltaY,
                type: animationType,
                fromLaneId: posData.change.fromLaneId,
                toLaneId: posData.change.toLaneId
            });
            
            otherAnimations.push(animation);
        }
        
        await Promise.all(otherAnimations);
        
        // 진입 애니메이션
        const enterChanges = changes.filter(c => c.type === 'enter');
        if (enterChanges.length > 0) {
            await this._animateEnterCards(enterChanges);
        }
        
        this._isAnimating = false;
        
        console.log('[AnimationManager] ✅ Batch animation complete');
        EventBus.emit('ranking:animation:complete', { changes });
    }
    
    /**
     * 퇴장 카드 애니메이션
     * @private
     */
    async _animateLeaveCards(leaveChanges) {
        const animations = leaveChanges.map(change => {
            const card = this.cardsMap.get(change.equipmentId);
            return this.animateLeave(card);
        });
        
        await Promise.all(animations);
    }
    
    /**
     * 진입 카드 애니메이션
     * @private
     */
    async _animateEnterCards(enterChanges) {
        const animations = enterChanges.map((change, index) => {
            const card = this.cardsMap.get(change.equipmentId);
            return new Promise(resolve => {
                setTimeout(() => {
                    this.animateEnter(card, change.toLaneId).then(resolve);
                }, index * AnimationManager.TIMING.STAGGER_DELAY);
            });
        });
        
        await Promise.all(animations);
    }
    
    /**
     * 단일 카드 애니메이션 (레인 내 이동)
     * @private
     */
    async _animateSingleCard(card, options) {
        if (!card || !card.element) return;
        
        const { deltaX, deltaY, type } = options;
        const element = card.element;
        
        const timing = this._getTimingForType(type);
        const easing = this._getEasingForType(type);
        
        element.classList.add(AnimationManager.CSS.ANIMATING);
        
        const keyframes = this._generateKeyframes(deltaX, deltaY, type);
        
        try {
            await this._batchAnimator.animate(element, {
                keyframes,
                duration: timing,
                easing,
                fill: 'forwards'
            });
            
        } finally {
            element.classList.remove(AnimationManager.CSS.ANIMATING);
            element.style.transform = '';
        }
    }
    
    /**
     * 요소 배열 밀림 애니메이션
     * @private
     */
    async _animatePushDownElements(elements, distance) {
        const animations = elements.map((element, index) => {
            element.classList.add(AnimationManager.CSS.PUSHED);
            
            return this._batchAnimator.animate(element, {
                keyframes: [
                    { transform: 'translateY(0)' },
                    { transform: `translateY(${distance}px)` }
                ],
                duration: AnimationManager.TIMING.PUSH_DOWN,
                easing: AnimationManager.EASING.PUSH_DOWN,
                delay: index * AnimationManager.TIMING.STAGGER_DELAY
            }).then(() => {
                element.classList.remove(AnimationManager.CSS.PUSHED);
            });
        });
        
        return Promise.all(animations);
    }
    
    /**
     * 애니메이션 타입 결정
     * @private
     */
    _determineAnimationType(target, deltaX, deltaY) {
        if (target.isMoving && Math.abs(deltaX) > 10) {
            return AnimationManager.ANIMATION_TYPE.LANE_CHANGE;
        } else if (target.isPushed) {
            return AnimationManager.ANIMATION_TYPE.PUSH_DOWN;
        } else if (Math.abs(deltaY) > 10) {
            return AnimationManager.ANIMATION_TYPE.RANK_CHANGE;
        }
        return AnimationManager.ANIMATION_TYPE.NONE;
    }
    
    /**
     * 키프레임 생성
     * @private
     */
    _generateKeyframes(deltaX, deltaY, type) {
        switch (type) {
            case AnimationManager.ANIMATION_TYPE.LANE_CHANGE:
                return [
                    { transform: `translate(0, 0)` },
                    { transform: `translate(${deltaX * 0.3}px, ${-20}px)`, offset: 0.3 },
                    { transform: `translate(${deltaX * 0.7}px, ${deltaY * 0.5 - 10}px)`, offset: 0.7 },
                    { transform: `translate(${deltaX}px, ${deltaY}px)` }
                ];
                
            case AnimationManager.ANIMATION_TYPE.PUSH_DOWN:
            case AnimationManager.ANIMATION_TYPE.RANK_CHANGE:
                return [
                    { transform: 'translateY(0)' },
                    { transform: `translateY(${deltaY}px)` }
                ];
                
            default:
                return [
                    { transform: `translate(0, 0)` },
                    { transform: `translate(${deltaX}px, ${deltaY}px)` }
                ];
        }
    }
    
    /**
     * 타입별 타이밍
     * @private
     */
    _getTimingForType(type) {
        switch (type) {
            case AnimationManager.ANIMATION_TYPE.LANE_CHANGE:
                return AnimationManager.TIMING.LANE_CHANGE;
            case AnimationManager.ANIMATION_TYPE.PUSH_DOWN:
                return AnimationManager.TIMING.PUSH_DOWN;
            case AnimationManager.ANIMATION_TYPE.RANK_CHANGE:
                return AnimationManager.TIMING.RANK_CHANGE;
            default:
                return AnimationManager.TIMING.RANK_CHANGE;
        }
    }
    
    /**
     * 타입별 Easing
     * @private
     */
    _getEasingForType(type) {
        switch (type) {
            case AnimationManager.ANIMATION_TYPE.LANE_CHANGE:
                return AnimationManager.EASING.LANE_CHANGE;
            case AnimationManager.ANIMATION_TYPE.PUSH_DOWN:
                return AnimationManager.EASING.PUSH_DOWN;
            case AnimationManager.ANIMATION_TYPE.RANK_CHANGE:
                return AnimationManager.EASING.RANK_CHANGE;
            default:
                return 'ease';
        }
    }
    
    // ─────────────────────────────────────────────────────────────
    // Event Handlers
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 상태 변경 이벤트 핸들러
     * @private
     */
    _handleStatusChange(event) {
        const { previousState, currentState } = event;
        this.processStateChange(previousState, currentState);
    }
    
    /**
     * 레인 업데이트 이벤트 핸들러
     * @private
     */
    _handleLaneUpdate(event) {
        this._positionCalculator.invalidateCache();
    }
    
    /**
     * 애니메이션 시작 콜백
     * @private
     */
    _handleAnimationStart(element, id) {
        this._activeAnimations.add(id);
    }
    
    /**
     * 애니메이션 완료 콜백
     * @private
     */
    _handleAnimationComplete(element, id) {
        this._activeAnimations.delete(id);
    }
    
    // ─────────────────────────────────────────────────────────────
    // Setters
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 컨테이너 설정
     */
    setContainer(container) {
        this.container = container;
        this._positionCalculator.setContainer(container);
    }
    
    /**
     * 레인 맵 설정
     */
    setLanesMap(lanesMap) {
        this.lanesMap = lanesMap;
        this._positionCalculator.setLanesMap(lanesMap);
    }
    
    /**
     * 카드 맵 설정
     */
    setCardsMap(cardsMap) {
        this.cardsMap = cardsMap;
    }
    
    // ─────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('[AnimationManager] 🗑️ Disposing...');
        
        this.cancelAll();
        
        EventBus.off('ranking:status:change', this._boundHandlers.onStatusChange);
        EventBus.off('ranking:lane:update', this._boundHandlers.onLaneUpdate);
        
        this._boundHandlers = {};
        this._animationQueue = [];
        this._previousState = null;
        this.container = null;
        this.lanesMap = null;
        this.cardsMap = null;
        
        this._positionCalculator?.dispose?.();
        this._batchAnimator?.dispose?.();
        
        this._positionCalculator = null;
        this._batchAnimator = null;
        
        console.log('[AnimationManager] ✅ Disposed');
    }
}