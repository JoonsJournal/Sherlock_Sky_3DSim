/**
 * AnimationManager.js
 * ===================
 * Ranking View 애니메이션 관리자
 * 
 * @version 1.0.0
 * @description
 * - 레인 간 이동 애니메이션 (대각선 이동)
 * - 밀림 효과 (Push Down) 처리
 * - 다중 카드 동시 애니메이션
 * - 상태 변경 감지 및 처리
 * 
 * @changelog
 * - v1.0.0: 초기 구현
 *   - 상태 변경 처리 로직
 *   - 애니메이션 타입 결정
 *   - 일괄 애니메이션 실행
 *   - ⚠️ 호환성: 신규 파일
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

import { EventBus } from '../../../core/managers/EventBus.js';
import { PositionCalculator } from '../utils/PositionCalculator.js';
import { BatchAnimator } from '../utils/BatchAnimator.js';

/**
 * AnimationManager - Ranking View 애니메이션 관리자
 * 
 * 주요 기능:
 * 1. 상태 변경 감지 및 변경 목록 추출
 * 2. 애니메이션 타입 결정 (lane-change, push-down, rank-change)
 * 3. 모든 카드 위치 계산 후 일괄 애니메이션 실행
 * 4. 스크롤 위치 고려한 정확한 좌표 계산
 */
export class AnimationManager {
    // ─────────────────────────────────────────────────────────────
    // Static Constants
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 애니메이션 타이밍 설정 (밀리초)
     */
    static TIMING = {
        LANE_CHANGE: 400,      // 레인 간 이동 (대각선)
        PUSH_DOWN: 300,        // 밀림 효과
        RANK_CHANGE: 300,      // 순위 변경 (수직 이동)
        ENTER: 250,            // 카드 진입
        LEAVE: 200,            // 카드 퇴장
        STAGGER_DELAY: 30      // 연속 애니메이션 딜레이
    };
    
    /**
     * 애니메이션 Easing 함수
     */
    static EASING = {
        LANE_CHANGE: 'cubic-bezier(0.4, 0, 0.2, 1)',    // ease-out-quart
        PUSH_DOWN: 'cubic-bezier(0.25, 0.1, 0.25, 1)',  // ease
        RANK_CHANGE: 'ease-out',
        ENTER: 'cubic-bezier(0.0, 0, 0.2, 1)',          // ease-out
        LEAVE: 'cubic-bezier(0.4, 0, 1, 1)'             // ease-in
    };
    
    /**
     * 애니메이션 타입
     */
    static ANIMATION_TYPE = {
        LANE_CHANGE: 'lane-change',    // 레인 간 이동
        PUSH_DOWN: 'push-down',        // 밀림 효과
        RANK_CHANGE: 'rank-change',    // 순위 변경
        ENTER: 'enter',                // 진입
        LEAVE: 'leave',                // 퇴장
        NONE: 'none'                   // 애니메이션 없음
    };
    
    /**
     * CSS 클래스 상수
     */
    static CSS = {
        ANIMATING: 'equipment-card--animating',
        ENTERING: 'equipment-card--entering',
        LEAVING: 'equipment-card--leaving',
        PUSHED: 'equipment-card--pushed'
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
        console.log('[AnimationManager] 🎬 Initializing...');
        this._setupEventListeners();
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // EventBus 구독
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
        
        // 1. 변경 감지
        const changes = this._detectChanges(previousState, currentState);
        
        if (changes.length === 0) {
            console.log('[AnimationManager] ℹ️ No changes detected');
            return;
        }
        
        console.log(`[AnimationManager] 📊 Detected ${changes.length} change(s)`);
        
        // 2. 모든 위치 계산
        const positionMap = this._calculateAllPositions(currentState, changes);
        
        // 3. 일괄 애니메이션
        this._animateBatch(positionMap, changes);
        
        // 4. 이전 상태 저장
        this._previousState = currentState;
    }
    
    /**
     * 단일 카드 애니메이션
     * @param {string} equipmentId - 설비 ID
     * @param {string} fromLaneId - 출발 레인 ID
     * @param {string} toLaneId - 도착 레인 ID
     * @param {Object} options - 추가 옵션
     */
    animateCard(equipmentId, fromLaneId, toLaneId, options = {}) {
        const card = this.cardsMap.get(equipmentId);
        if (!card) {
            console.warn(`[AnimationManager] ⚠️ Card not found: ${equipmentId}`);
            return Promise.resolve();
        }
        
        const fromLane = this.lanesMap.get(fromLaneId);
        const toLane = this.lanesMap.get(toLaneId);
        
        if (!fromLane || !toLane) {
            console.warn(`[AnimationManager] ⚠️ Lane not found: ${fromLaneId} or ${toLaneId}`);
            return Promise.resolve();
        }
        
        // 위치 계산
        const fromRect = card.element.getBoundingClientRect();
        const toPosition = this._positionCalculator.calculateTargetPosition(
            equipmentId,
            toLaneId,
            options.targetIndex || 0
        );
        
        // 델타 계산
        const deltaX = toPosition.x - fromRect.left;
        const deltaY = toPosition.y - fromRect.top;
        
        // 애니메이션 타입 결정
        const animationType = this._determineAnimationType({
            isMoving: fromLaneId !== toLaneId,
            isPushed: false
        }, deltaX, deltaY);
        
        // 애니메이션 실행
        return this._animateSingleCard(card, {
            deltaX,
            deltaY,
            type: animationType,
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
     * 밀림 효과 애니메이션
     * @param {Array<EquipmentCard>} cards - 밀려날 카드들
     * @param {number} distance - 밀림 거리 (px)
     */
    animatePushDown(cards, distance) {
        if (!cards || cards.length === 0) return Promise.resolve();
        
        const animations = cards.map((card, index) => {
            if (!card || !card.element) return Promise.resolve();
            
            const element = card.element;
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
    }
    
    /**
     * 애니메이션 중인지 확인
     * @returns {boolean}
     */
    isAnimating() {
        return this._isAnimating || this._activeAnimations.size > 0;
    }
    
    // ─────────────────────────────────────────────────────────────
    // Change Detection
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 상태 변경 감지
     * @private
     * @param {Object} previousState - 이전 상태
     * @param {Object} currentState - 현재 상태
     * @returns {Array} 변경 목록
     */
    _detectChanges(previousState, currentState) {
        const changes = [];
        
        if (!previousState || !currentState) {
            return changes;
        }
        
        const prevLanes = previousState.lanes || {};
        const currLanes = currentState.lanes || {};
        
        // 각 레인별 변경 감지
        const allLaneIds = new Set([
            ...Object.keys(prevLanes),
            ...Object.keys(currLanes)
        ]);
        
        for (const laneId of allLaneIds) {
            const prevEquipments = prevLanes[laneId] || [];
            const currEquipments = currLanes[laneId] || [];
            
            // 이전에는 없고 현재에 있는 설비 (진입)
            for (const equip of currEquipments) {
                const wasInLane = prevEquipments.some(e => e.equipmentId === equip.equipmentId);
                if (!wasInLane) {
                    // 다른 레인에서 왔는지 확인
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
            
            // 이전에는 있고 현재에 없는 설비 (퇴장)
            for (const equip of prevEquipments) {
                const stillInLane = currEquipments.some(e => e.equipmentId === equip.equipmentId);
                if (!stillInLane) {
                    // 다른 레인으로 갔는지 확인
                    const toLaneId = this._findCurrentLane(equip.equipmentId, currLanes);
                    
                    if (!toLaneId) {
                        // 완전히 퇴장
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
            
            // 순위 변경 감지
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
     * @param {Object} currentState - 현재 상태
     * @param {Array} changes - 변경 목록
     * @returns {Map} 위치 맵
     */
    _calculateAllPositions(currentState, changes) {
        const positionMap = new Map();
        
        // 변경된 카드들의 목표 위치 계산
        for (const change of changes) {
            if (change.type === 'leave') continue;
            
            const card = this.cardsMap.get(change.equipmentId);
            if (!card) continue;
            
            const targetLane = this.lanesMap.get(change.toLaneId);
            if (!targetLane) continue;
            
            // 현재 위치
            const currentRect = card.element.getBoundingClientRect();
            
            // 목표 위치 계산
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
        
        // 밀려날 카드들의 위치 계산
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
        // 각 레인에서 삽입되는 카드가 있는 경우, 아래 카드들의 밀림 계산
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
        
        // 각 레인별로 밀림 계산
        for (const [laneId, insertions] of laneInsertions) {
            const laneEquipments = currentState.lanes?.[laneId] || [];
            const lane = this.lanesMap.get(laneId);
            
            if (!lane) continue;
            
            // 삽입 위치 이후의 카드들
            for (const insertion of insertions) {
                const insertIndex = this._getTargetIndex(insertion, currentState);
                
                // 삽입 위치 이후 카드들에게 밀림 적용
                for (let i = insertIndex + 1; i < laneEquipments.length; i++) {
                    const equipmentId = laneEquipments[i].equipmentId;
                    
                    // 이미 이동 중인 카드는 제외
                    if (positionMap.has(equipmentId)) continue;
                    
                    const card = this.cardsMap.get(equipmentId);
                    if (!card) continue;
                    
                    const cardHeight = card.element.offsetHeight + 8; // gap 포함
                    
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
     * @param {Map} positionMap - 위치 맵
     * @param {Array} changes - 변경 목록
     */
    async _animateBatch(positionMap, changes) {
        if (positionMap.size === 0) return;
        
        this._isAnimating = true;
        
        console.log(`[AnimationManager] 🎬 Starting batch animation for ${positionMap.size} card(s)`);
        
        // 퇴장 애니메이션 먼저 실행
        const leaveChanges = changes.filter(c => c.type === 'leave');
        if (leaveChanges.length > 0) {
            await this._animateLeaveCards(leaveChanges);
        }
        
        // 이동/밀림/순위변경 애니메이션
        const moveAnimations = [];
        
        for (const [equipmentId, posData] of positionMap) {
            const animationType = this._determineAnimationType(
                {
                    isMoving: posData.change.fromLaneId !== posData.change.toLaneId,
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
            
            moveAnimations.push(animation);
        }
        
        await Promise.all(moveAnimations);
        
        // 진입 애니메이션
        const enterChanges = changes.filter(c => c.type === 'enter');
        if (enterChanges.length > 0) {
            await this._animateEnterCards(enterChanges);
        }
        
        this._isAnimating = false;
        
        console.log('[AnimationManager] ✅ Batch animation complete');
        
        // 완료 이벤트 발행
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
     * 단일 카드 애니메이션 실행
     * @private
     */
    async _animateSingleCard(card, options) {
        if (!card || !card.element) return;
        
        const { deltaX, deltaY, type, fromLaneId, toLaneId } = options;
        const element = card.element;
        
        // 애니메이션 설정
        const timing = this._getTimingForType(type);
        const easing = this._getEasingForType(type);
        
        element.classList.add(AnimationManager.CSS.ANIMATING);
        
        // FLIP 애니메이션 (First, Last, Invert, Play)
        const keyframes = this._generateKeyframes(deltaX, deltaY, type);
        
        try {
            await this._batchAnimator.animate(element, {
                keyframes,
                duration: timing,
                easing,
                fill: 'forwards'
            });
            
            // 실제 DOM 위치 업데이트 (레인 변경 시)
            if (fromLaneId !== toLaneId) {
                this._moveCardToLane(card, toLaneId);
            }
            
        } finally {
            element.classList.remove(AnimationManager.CSS.ANIMATING);
            
            // transform 초기화
            element.style.transform = '';
        }
    }
    
    /**
     * 카드를 새 레인으로 이동
     * @private
     */
    _moveCardToLane(card, toLaneId) {
        const targetLane = this.lanesMap.get(toLaneId);
        if (!targetLane) return;
        
        // DOM에서 카드 이동
        const cardsContainer = targetLane.element.querySelector('.ranking-lane__cards-container');
        if (cardsContainer) {
            cardsContainer.appendChild(card.element);
        }
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
                // 대각선 이동 (살짝 위로 올라갔다가 내려오는 곡선)
                return [
                    { transform: `translate(0, 0)` },
                    { transform: `translate(${deltaX * 0.3}px, ${-20}px)`, offset: 0.3 },
                    { transform: `translate(${deltaX * 0.7}px, ${deltaY * 0.5 - 10}px)`, offset: 0.7 },
                    { transform: `translate(${deltaX}px, ${deltaY}px)` }
                ];
                
            case AnimationManager.ANIMATION_TYPE.PUSH_DOWN:
                // 부드러운 수직 이동
                return [
                    { transform: 'translateY(0)' },
                    { transform: `translateY(${deltaY}px)` }
                ];
                
            case AnimationManager.ANIMATION_TYPE.RANK_CHANGE:
                // 순위 변경 (수직 이동)
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
     * 타입별 타이밍 가져오기
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
     * 타입별 Easing 가져오기
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
        // 레인 업데이트 시 포지션 캐시 무효화
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
     * @param {HTMLElement} container
     */
    setContainer(container) {
        this.container = container;
        this._positionCalculator.setContainer(container);
    }
    
    /**
     * 레인 맵 설정
     * @param {Map} lanesMap
     */
    setLanesMap(lanesMap) {
        this.lanesMap = lanesMap;
        this._positionCalculator.setLanesMap(lanesMap);
    }
    
    /**
     * 카드 맵 설정
     * @param {Map} cardsMap
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
        
        // 모든 애니메이션 취소
        this.cancelAll();
        
        // 이벤트 리스너 제거
        EventBus.off('ranking:status:change', this._boundHandlers.onStatusChange);
        EventBus.off('ranking:lane:update', this._boundHandlers.onLaneUpdate);
        
        // 참조 해제
        this._boundHandlers = {};
        this._animationQueue = [];
        this._previousState = null;
        this.container = null;
        this.lanesMap = null;
        this.cardsMap = null;
        
        // 하위 모듈 정리
        this._positionCalculator?.dispose?.();
        this._batchAnimator?.dispose?.();
        
        this._positionCalculator = null;
        this._batchAnimator = null;
        
        console.log('[AnimationManager] ✅ Disposed');
    }
}