/**
 * LaneManager.js
 * ==============
 * Ranking View 레인 관리자
 * 
 * @version 1.0.0
 * @description
 * - 레인별 독립 스크롤 관리
 * - 레인 간 포커스 이동
 * - 카드 네비게이션 (위/아래)
 * - 키보드 네비게이션 상태 관리
 * 
 * @changelog
 * - v1.0.0: Phase 5 초기 버전
 *   - 레인 포커스 시스템
 *   - 카드 선택 네비게이션
 *   - 레인별 독립 스크롤
 *   - EventBus 연동
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * - RankingLane (./components/RankingLane.js)
 * 
 * @exports
 * - LaneManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/LaneManager.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { eventBus } from '../../../core/managers/EventBus.js';

/**
 * 레인 순서 정의 (1-6 키에 매핑)
 */
const LANE_ORDER = [
    'remote',      // 1
    'sudden-stop', // 2
    'stop',        // 3
    'run',         // 4
    'idle',        // 5
    'wait'         // 6
];

export class LaneManager {
    /**
     * CSS 클래스 상수
     */
    static CSS = {
        LANE_FOCUSED: 'ranking-lane--focused',
        CARD_SELECTED: 'equipment-card--selected',
        SCROLL_CONTAINER: 'ranking-lane__cards',
        
        // Legacy alias
        LEGACY_FOCUSED: 'focused',
        LEGACY_SELECTED: 'selected'
    };
    
    /**
     * @param {Object} options
     * @param {Map<string, RankingLane>} options.lanes - 레인 맵
     * @param {Function} options.onCardSelect - 카드 선택 콜백
     */
    constructor(options = {}) {
        console.log('[LaneManager] 🚀 초기화 시작 (v1.0.0)...');
        
        // Dependencies
        this._lanes = options.lanes || new Map();
        this._onCardSelect = options.onCardSelect || null;
        
        // State
        this._focusedLaneIndex = 0;
        this._selectedCardIndex = -1;
        this._isActive = false;
        
        // Event Subscriptions
        this._eventSubscriptions = [];
        
        this._init();
    }
    
    // =========================================
    // Initialization
    // =========================================
    
    /**
     * 초기화
     * @private
     */
    _init() {
        this._setupEventListeners();
        console.log('[LaneManager] ✅ 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // 레인 클릭 시 포커스 이동
        this._eventSubscriptions.push(
            eventBus.on('ranking:lane:click', (data) => {
                const { laneId } = data;
                const index = LANE_ORDER.indexOf(laneId);
                if (index !== -1) {
                    this.focusLane(index);
                }
            })
        );
        
        // 카드 클릭 시 선택
        this._eventSubscriptions.push(
            eventBus.on('ranking:card:click', (data) => {
                const { laneId, cardIndex, equipmentId } = data;
                const laneIndex = LANE_ORDER.indexOf(laneId);
                if (laneIndex !== -1) {
                    this._focusedLaneIndex = laneIndex;
                    this._selectedCardIndex = cardIndex;
                    this._updateVisualState();
                }
            })
        );
    }
    
    // =========================================
    // Public Methods
    // =========================================
    
    /**
     * 레인 맵 설정
     * @param {Map<string, RankingLane>} lanes
     */
    setLanes(lanes) {
        this._lanes = lanes;
        console.log(`[LaneManager] 🔗 레인 연결: ${lanes.size}개`);
    }
    
    /**
     * 활성화
     */
    activate() {
        this._isActive = true;
        this._focusedLaneIndex = 0;
        this._selectedCardIndex = -1;
        this._updateVisualState();
        console.log('[LaneManager] ✅ 활성화');
    }
    
    /**
     * 비활성화
     */
    deactivate() {
        this._isActive = false;
        this._clearAllFocus();
        console.log('[LaneManager] 🛑 비활성화');
    }
    
    /**
     * 특정 인덱스의 레인에 포커스
     * @param {number} index - 레인 인덱스 (0-5)
     */
    focusLane(index) {
        if (!this._isActive) return;
        if (index < 0 || index >= LANE_ORDER.length) return;
        
        const previousIndex = this._focusedLaneIndex;
        this._focusedLaneIndex = index;
        this._selectedCardIndex = -1; // 레인 변경 시 카드 선택 초기화
        
        this._updateVisualState();
        
        // 레인 스크롤 맨 위로
        this._scrollLaneToTop(index);
        
        console.log(`[LaneManager] 🎯 레인 포커스: ${LANE_ORDER[previousIndex]} → ${LANE_ORDER[index]}`);
        
        // 이벤트 발행
        eventBus.emit('ranking:lane:focused', {
            laneId: LANE_ORDER[index],
            laneIndex: index
        });
    }
    
    /**
     * 이전 레인으로 포커스 이동
     */
    focusPreviousLane() {
        const newIndex = Math.max(0, this._focusedLaneIndex - 1);
        this.focusLane(newIndex);
    }
    
    /**
     * 다음 레인으로 포커스 이동
     */
    focusNextLane() {
        const newIndex = Math.min(LANE_ORDER.length - 1, this._focusedLaneIndex + 1);
        this.focusLane(newIndex);
    }
    
    /**
     * 현재 레인에서 이전 카드 선택
     */
    selectPreviousCard() {
        if (!this._isActive) return;
        
        const lane = this._getFocusedLane();
        if (!lane) return;
        
        const cardCount = lane.count;
        if (cardCount === 0) return;
        
        if (this._selectedCardIndex <= 0) {
            // 첫 번째 카드거나 선택 없음 → 첫 번째 카드 선택
            this._selectedCardIndex = 0;
        } else {
            this._selectedCardIndex--;
        }
        
        this._updateVisualState();
        this._scrollToSelectedCard();
        this._emitCardSelect();
        
        console.log(`[LaneManager] ⬆️ 카드 선택: ${this._selectedCardIndex}`);
    }
    
    /**
     * 현재 레인에서 다음 카드 선택
     */
    selectNextCard() {
        if (!this._isActive) return;
        
        const lane = this._getFocusedLane();
        if (!lane) return;
        
        const cardCount = lane.count;
        if (cardCount === 0) return;
        
        if (this._selectedCardIndex < 0) {
            // 선택 없음 → 첫 번째 카드 선택
            this._selectedCardIndex = 0;
        } else if (this._selectedCardIndex < cardCount - 1) {
            this._selectedCardIndex++;
        }
        // 마지막 카드면 유지
        
        this._updateVisualState();
        this._scrollToSelectedCard();
        this._emitCardSelect();
        
        console.log(`[LaneManager] ⬇️ 카드 선택: ${this._selectedCardIndex}`);
    }
    
    /**
     * 선택된 카드의 상세 정보 표시
     */
    showSelectedCardDetail() {
        if (!this._isActive) return;
        if (this._selectedCardIndex < 0) return;
        
        const lane = this._getFocusedLane();
        if (!lane) return;
        
        const cards = lane.getAllCards();
        const selectedCard = Array.from(cards.values())[this._selectedCardIndex];
        
        if (selectedCard) {
            console.log(`[LaneManager] 📋 카드 상세 표시: ${selectedCard.frontendId}`);
            
            eventBus.emit('equipment:detail:show', {
                id: selectedCard.frontendId,
                frontendId: selectedCard.frontendId,
                equipmentId: selectedCard.equipmentId
            });
        }
    }
    
    /**
     * 현재 포커스된 레인 ID 반환
     * @returns {string}
     */
    getFocusedLaneId() {
        return LANE_ORDER[this._focusedLaneIndex];
    }
    
    /**
     * 현재 포커스된 레인 인덱스 반환
     * @returns {number}
     */
    getFocusedLaneIndex() {
        return this._focusedLaneIndex;
    }
    
    /**
     * 현재 선택된 카드 인덱스 반환
     * @returns {number}
     */
    getSelectedCardIndex() {
        return this._selectedCardIndex;
    }
    
    /**
     * 활성화 상태 반환
     * @returns {boolean}
     */
    get isActive() {
        return this._isActive;
    }
    
    // =========================================
    // Private Methods
    // =========================================
    
    /**
     * 현재 포커스된 레인 가져오기
     * @private
     * @returns {RankingLane|undefined}
     */
    _getFocusedLane() {
        const laneId = LANE_ORDER[this._focusedLaneIndex];
        return this._lanes.get(laneId);
    }
    
    /**
     * 모든 포커스/선택 해제
     * @private
     */
    _clearAllFocus() {
        this._lanes.forEach((lane, laneId) => {
            lane.setFocused(false);
            lane.getAllCards().forEach(card => {
                card.setSelected(false);
            });
        });
    }
    
    /**
     * 시각적 상태 업데이트
     * @private
     */
    _updateVisualState() {
        // 모든 레인 포커스 해제
        this._lanes.forEach((lane, laneId) => {
            const isFocused = (laneId === LANE_ORDER[this._focusedLaneIndex]);
            lane.setFocused(isFocused);
            
            // 카드 선택 상태 업데이트
            const cards = Array.from(lane.getAllCards().values());
            cards.forEach((card, cardIndex) => {
                const isSelected = isFocused && (cardIndex === this._selectedCardIndex);
                card.setSelected(isSelected);
            });
        });
    }
    
    /**
     * 레인 스크롤 맨 위로
     * @private
     * @param {number} laneIndex
     */
    _scrollLaneToTop(laneIndex) {
        const lane = this._lanes.get(LANE_ORDER[laneIndex]);
        if (lane && lane.element) {
            const scrollContainer = lane.element.querySelector(`.${LaneManager.CSS.SCROLL_CONTAINER}`);
            if (scrollContainer) {
                scrollContainer.scrollTop = 0;
            }
        }
    }
    
    /**
     * 선택된 카드로 스크롤
     * @private
     */
    _scrollToSelectedCard() {
        const lane = this._getFocusedLane();
        if (!lane || !lane.element) return;
        
        const scrollContainer = lane.element.querySelector(`.${LaneManager.CSS.SCROLL_CONTAINER}`);
        if (!scrollContainer) return;
        
        const cards = lane.getAllCards();
        const cardsArray = Array.from(cards.values());
        const selectedCard = cardsArray[this._selectedCardIndex];
        
        if (selectedCard && selectedCard.element) {
            selectedCard.element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }
    
    /**
     * 카드 선택 이벤트 발행
     * @private
     */
    _emitCardSelect() {
        const lane = this._getFocusedLane();
        if (!lane) return;
        
        const cards = Array.from(lane.getAllCards().values());
        const selectedCard = cards[this._selectedCardIndex];
        
        if (selectedCard && this._onCardSelect) {
            this._onCardSelect({
                equipmentId: selectedCard.equipmentId,
                frontendId: selectedCard.frontendId,
                laneId: LANE_ORDER[this._focusedLaneIndex],
                cardIndex: this._selectedCardIndex
            });
        }
        
        // EventBus 이벤트도 발행
        if (selectedCard) {
            eventBus.emit('ranking:card:selected', {
                equipmentId: selectedCard.equipmentId,
                frontendId: selectedCard.frontendId,
                laneId: LANE_ORDER[this._focusedLaneIndex],
                cardIndex: this._selectedCardIndex
            });
        }
    }
    
    // =========================================
    // Cleanup
    // =========================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('[LaneManager] 🗑️ dispose()...');
        
        // EventBus 구독 해제
        this._eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventSubscriptions = [];
        
        // 상태 초기화
        this._lanes = new Map();
        this._isActive = false;
        
        console.log('[LaneManager] ✅ dispose 완료');
    }
    
    // =========================================
    // Debug
    // =========================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('[LaneManager] Debug Info');
        console.log('isActive:', this._isActive);
        console.log('focusedLaneIndex:', this._focusedLaneIndex);
        console.log('focusedLaneId:', LANE_ORDER[this._focusedLaneIndex]);
        console.log('selectedCardIndex:', this._selectedCardIndex);
        console.log('lanes count:', this._lanes.size);
        console.log('LANE_ORDER:', LANE_ORDER);
        console.groupEnd();
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.LaneManager = LaneManager;
}