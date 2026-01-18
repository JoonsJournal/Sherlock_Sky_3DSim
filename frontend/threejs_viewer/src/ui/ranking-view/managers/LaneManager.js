/**
 * LaneManager.js
 * ==============
 * 레인 배치/정렬/네비게이션 관리자
 * 
 * @version 1.1.0
 * @description
 * - 6개 기본 레인 관리 (Remote, Sudden Stop, Stop, Run, Idle, Wait)
 * - 레인 포커스 및 카드 선택 상태 관리
 * - 키보드 네비게이션 지원 (1-6, 방향키)
 * - 레인 간 카드 이동 조율
 * - Custom 레인 관리 (Phase 6)
 * 
 * @changelog
 * - v1.1.0: 🆕 Phase 6 - Custom 레인 지원 + 네비게이션 강화
 *   - addCustomLane(), removeCustomLane() 추가
 *   - getCustomLanes() 추가
 *   - 레인 재정렬 로직 추가
 *   - 네비게이션 시 Custom 레인 포함
 *   - ⚠️ 호환성: v1.0.0의 모든 기능 100% 유지
 * - v1.0.0: 초기 버전
 *   - 레인 배치/정렬 관리
 *   - 키보드 네비게이션
 *   - activate()/deactivate() 라이프사이클
 *   - EventBus 이벤트 연동
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * - RankingLane (../components/RankingLane.js)
 * 
 * @exports
 * - LaneManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/LaneManager.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-19
 */

import { eventBus } from '../../../core/managers/EventBus.js';

export class LaneManager {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Map<string, RankingLane>} options.lanes - 레인 Map
     * @param {Function} [options.onCardSelect] - 카드 선택 콜백
     */
    constructor(options = {}) {
        console.log('[LaneManager] 🚀 초기화 시작 (v1.1.0 - Phase 6)...');
        
        // Options
        this._lanes = options.lanes || new Map();
        this._onCardSelect = options.onCardSelect || null;
        
        // State
        this._isActive = false;
        this._focusedLaneIndex = 0;
        this._selectedCardIndex = -1;
        
        // 🆕 v1.1.0: Custom 레인 관리
        this._customLanes = new Map();
        
        // Lane IDs 캐시 (순서 유지)
        this._laneIds = [];
        this._updateLaneIds();
        
        // Event Handlers
        this._boundHandlers = {};
        this._eventSubscriptions = [];
        
        // Initialize
        this._setupEventListeners();
        
        console.log('[LaneManager] ✅ 초기화 완료');
    }
    
    // =========================================
    // Private Methods
    // =========================================
    
    /**
     * 레인 ID 목록 업데이트 (순서 유지)
     * @private
     */
    _updateLaneIds() {
        this._laneIds = Array.from(this._lanes.keys());
        
        // 🆕 v1.1.0: Custom 레인 추가
        this._customLanes.forEach((_, id) => {
            if (!this._laneIds.includes(id)) {
                this._laneIds.push(id);
            }
        });
        
        console.log(`[LaneManager] 📋 레인 ID 목록 업데이트: ${this._laneIds.length}개`);
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        console.log('[LaneManager] 🔗 _setupEventListeners()');
        
        // EventBus 구독
        this._eventSubscriptions.push(
            // 레인 클릭 이벤트
            eventBus.on('ranking:lane:click', (data) => {
                if (this._isActive && data.laneId) {
                    const index = this._laneIds.indexOf(data.laneId);
                    if (index !== -1) {
                        this.focusLane(index);
                    }
                }
            }),
            
            // 카드 클릭 이벤트
            eventBus.on('ranking:card:click', (data) => {
                if (this._isActive && data.laneId && data.cardIndex !== undefined) {
                    const laneIndex = this._laneIds.indexOf(data.laneId);
                    if (laneIndex !== -1) {
                        this._focusedLaneIndex = laneIndex;
                        this._selectedCardIndex = data.cardIndex;
                        this._updateVisualState();
                        this._emitCardSelect();
                    }
                }
            }),
            
            // 🆕 v1.1.0: Custom 레인 추가/제거 이벤트
            eventBus.on('customLane:added', (data) => {
                if (data.laneId && data.lane) {
                    this._customLanes.set(data.laneId, data.lane);
                    this._updateLaneIds();
                }
            }),
            
            eventBus.on('customLane:removed', (data) => {
                if (data.laneId) {
                    this._customLanes.delete(data.laneId);
                    this._updateLaneIds();
                    
                    // 현재 포커스된 레인이 삭제된 경우 첫 번째 레인으로 이동
                    if (this._focusedLaneIndex >= this._laneIds.length) {
                        this._focusedLaneIndex = Math.max(0, this._laneIds.length - 1);
                        this._selectedCardIndex = -1;
                        this._updateVisualState();
                    }
                }
            })
        );
        
        console.log('[LaneManager] ✅ 이벤트 리스너 설정 완료');
    }
    
    /**
     * 현재 포커스된 레인 가져오기
     * @private
     * @returns {RankingLane|null}
     */
    _getCurrentLane() {
        const laneId = this._laneIds[this._focusedLaneIndex];
        if (!laneId) return null;
        
        // 기본 레인에서 먼저 찾기
        if (this._lanes.has(laneId)) {
            return this._lanes.get(laneId);
        }
        
        // Custom 레인에서 찾기
        if (this._customLanes.has(laneId)) {
            return this._customLanes.get(laneId);
        }
        
        return null;
    }
    
    /**
     * 시각적 상태 업데이트
     * @private
     */
    _updateVisualState() {
        // 모든 레인에서 포커스/선택 해제
        this._clearAllFocus();
        
        // 현재 레인에 포커스 표시
        const currentLane = this._getCurrentLane();
        if (currentLane) {
            currentLane.setFocused(true);
            
            // 선택된 카드가 있으면 선택 표시
            if (this._selectedCardIndex >= 0) {
                const cards = currentLane.getAllCards();
                if (cards[this._selectedCardIndex]) {
                    cards[this._selectedCardIndex].setSelected(true);
                }
            }
        }
    }
    
    /**
     * 모든 포커스/선택 해제
     * @private
     */
    _clearAllFocus() {
        // 기본 레인
        this._lanes.forEach(lane => {
            lane.setFocused(false);
            lane.getAllCards().forEach(card => {
                card.setSelected(false);
            });
        });
        
        // Custom 레인
        this._customLanes.forEach(lane => {
            lane.setFocused(false);
            lane.getAllCards().forEach(card => {
                card.setSelected(false);
            });
        });
    }
    
    /**
     * 레인 스크롤을 맨 위로
     * @private
     * @param {number} laneIndex
     */
    _scrollLaneToTop(laneIndex) {
        const laneId = this._laneIds[laneIndex];
        if (!laneId) return;
        
        const lane = this._lanes.get(laneId) || this._customLanes.get(laneId);
        if (lane?.scrollToTop) {
            lane.scrollToTop();
        }
    }
    
    /**
     * 선택된 카드로 스크롤
     * @private
     */
    _scrollToSelectedCard() {
        const currentLane = this._getCurrentLane();
        if (!currentLane) return;
        
        const cards = currentLane.getAllCards();
        if (cards[this._selectedCardIndex]?.scrollIntoView) {
            cards[this._selectedCardIndex].scrollIntoView();
        }
    }
    
    /**
     * 카드 선택 이벤트 발행
     * @private
     */
    _emitCardSelect() {
        const currentLane = this._getCurrentLane();
        if (!currentLane) return;
        
        const cards = currentLane.getAllCards();
        const selectedCard = cards[this._selectedCardIndex];
        
        if (selectedCard) {
            const cardData = selectedCard.getData ? selectedCard.getData() : {};
            
            const eventData = {
                equipmentId: cardData.equipmentId,
                frontendId: cardData.frontendId,
                laneId: this._laneIds[this._focusedLaneIndex],
                cardIndex: this._selectedCardIndex,
                cardData: cardData
            };
            
            // 콜백 호출
            if (this._onCardSelect) {
                this._onCardSelect(eventData);
            }
            
            // EventBus 이벤트 발행
            eventBus.emit('equipment:select', {
                ...eventData,
                source: 'ranking-view'
            });
        }
    }
    
    // =========================================
    // Public Methods - Lifecycle
    // =========================================
    
    /**
     * LaneManager 활성화
     */
    activate() {
        console.log('[LaneManager] ▶️ activate()');
        
        this._isActive = true;
        
        // 첫 번째 레인에 포커스
        if (this._laneIds.length > 0 && this._focusedLaneIndex === 0) {
            this._updateVisualState();
        }
    }
    
    /**
     * LaneManager 비활성화
     */
    deactivate() {
        console.log('[LaneManager] ⏸️ deactivate()');
        
        this._isActive = false;
        this._clearAllFocus();
    }
    
    /**
     * 활성화 상태 확인
     * @returns {boolean}
     */
    get isActive() {
        return this._isActive;
    }
    
    // =========================================
    // Public Methods - Lane Focus
    // =========================================
    
    /**
     * 특정 레인에 포커스
     * @param {number} index - 레인 인덱스 (0-based)
     */
    focusLane(index) {
        if (index < 0 || index >= this._laneIds.length) {
            console.warn(`[LaneManager] ⚠️ 유효하지 않은 레인 인덱스: ${index}`);
            return;
        }
        
        console.log(`[LaneManager] 🎯 focusLane(${index}) - ${this._laneIds[index]}`);
        
        this._focusedLaneIndex = index;
        this._selectedCardIndex = -1;  // 카드 선택 초기화
        
        this._updateVisualState();
        this._scrollLaneToTop(index);
        
        // 이벤트 발행
        eventBus.emit('ranking:lane:focused', {
            laneId: this._laneIds[index],
            laneIndex: index
        });
    }
    
    /**
     * 이전 레인으로 이동
     */
    focusPreviousLane() {
        if (!this._isActive) return;
        
        const newIndex = Math.max(0, this._focusedLaneIndex - 1);
        if (newIndex !== this._focusedLaneIndex) {
            this.focusLane(newIndex);
        }
    }
    
    /**
     * 다음 레인으로 이동
     */
    focusNextLane() {
        if (!this._isActive) return;
        
        const newIndex = Math.min(this._laneIds.length - 1, this._focusedLaneIndex + 1);
        if (newIndex !== this._focusedLaneIndex) {
            this.focusLane(newIndex);
        }
    }
    
    /**
     * 현재 포커스된 레인 인덱스
     * @returns {number}
     */
    get focusedLaneIndex() {
        return this._focusedLaneIndex;
    }
    
    /**
     * 현재 포커스된 레인 ID
     * @returns {string|null}
     */
    get focusedLaneId() {
        return this._laneIds[this._focusedLaneIndex] || null;
    }
    
    // =========================================
    // Public Methods - Card Selection
    // =========================================
    
    /**
     * 이전 카드 선택
     */
    selectPreviousCard() {
        if (!this._isActive) return;
        
        const currentLane = this._getCurrentLane();
        if (!currentLane) return;
        
        const cardCount = currentLane.count;
        if (cardCount === 0) return;
        
        if (this._selectedCardIndex <= 0) {
            // 첫 번째 카드이거나 선택 없음 → 마지막 카드로
            this._selectedCardIndex = cardCount - 1;
        } else {
            this._selectedCardIndex--;
        }
        
        console.log(`[LaneManager] ⬆️ selectPreviousCard() → index: ${this._selectedCardIndex}`);
        
        this._updateVisualState();
        this._scrollToSelectedCard();
    }
    
    /**
     * 다음 카드 선택
     */
    selectNextCard() {
        if (!this._isActive) return;
        
        const currentLane = this._getCurrentLane();
        if (!currentLane) return;
        
        const cardCount = currentLane.count;
        if (cardCount === 0) return;
        
        if (this._selectedCardIndex >= cardCount - 1) {
            // 마지막 카드 → 첫 번째로
            this._selectedCardIndex = 0;
        } else {
            this._selectedCardIndex++;
        }
        
        console.log(`[LaneManager] ⬇️ selectNextCard() → index: ${this._selectedCardIndex}`);
        
        this._updateVisualState();
        this._scrollToSelectedCard();
    }
    
    /**
     * 선택된 카드 상세 보기
     */
    showSelectedCardDetail() {
        if (!this._isActive) return;
        
        const currentLane = this._getCurrentLane();
        if (!currentLane) return;
        
        const cards = currentLane.getAllCards();
        const selectedCard = cards[this._selectedCardIndex];
        
        if (selectedCard) {
            console.log(`[LaneManager] 📋 showSelectedCardDetail() - ${selectedCard.getData?.()?.frontendId || 'unknown'}`);
            
            const cardData = selectedCard.getData ? selectedCard.getData() : {};
            
            // Equipment Info Drawer 표시 이벤트
            eventBus.emit('equipment:detail:show', {
                id: cardData.frontendId,
                frontendId: cardData.frontendId,
                equipmentId: cardData.equipmentId,
                ...cardData
            });
        }
    }
    
    /**
     * 현재 선택된 카드 인덱스
     * @returns {number}
     */
    get selectedCardIndex() {
        return this._selectedCardIndex;
    }
    
    // =========================================
    // 🆕 v1.1.0: Custom Lane Methods
    // =========================================
    
    /**
     * Custom 레인 추가
     * @param {string} laneId - 레인 ID
     * @param {RankingLane} lane - 레인 인스턴스
     */
    addCustomLane(laneId, lane) {
        if (this._customLanes.has(laneId)) {
            console.warn(`[LaneManager] ⚠️ Custom 레인이 이미 존재: ${laneId}`);
            return;
        }
        
        this._customLanes.set(laneId, lane);
        this._updateLaneIds();
        
        console.log(`[LaneManager] ➕ Custom 레인 추가: ${laneId}`);
    }
    
    /**
     * Custom 레인 제거
     * @param {string} laneId - 레인 ID
     */
    removeCustomLane(laneId) {
        if (!this._customLanes.has(laneId)) {
            console.warn(`[LaneManager] ⚠️ Custom 레인을 찾을 수 없음: ${laneId}`);
            return;
        }
        
        this._customLanes.delete(laneId);
        this._updateLaneIds();
        
        // 현재 포커스된 레인이 삭제된 경우 조정
        if (this._focusedLaneIndex >= this._laneIds.length) {
            this._focusedLaneIndex = Math.max(0, this._laneIds.length - 1);
            this._selectedCardIndex = -1;
            this._updateVisualState();
        }
        
        console.log(`[LaneManager] ➖ Custom 레인 제거: ${laneId}`);
    }
    
    /**
     * Custom 레인 목록 가져오기
     * @returns {Map<string, RankingLane>}
     */
    getCustomLanes() {
        return new Map(this._customLanes);
    }
    
    // =========================================
    // Public Methods - Utilities
    // =========================================
    
    /**
     * 레인 가져오기
     * @param {string} laneId
     * @returns {RankingLane|undefined}
     */
    getLane(laneId) {
        return this._lanes.get(laneId) || this._customLanes.get(laneId);
    }
    
    /**
     * 모든 레인 ID 가져오기
     * @returns {string[]}
     */
    getLaneIds() {
        return [...this._laneIds];
    }
    
    /**
     * 레인 수 가져오기
     * @returns {number}
     */
    get laneCount() {
        return this._laneIds.length;
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('[LaneManager] 🗑️ dispose() - 정리 시작...');
        
        // EventBus 구독 해제
        this._eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventSubscriptions = [];
        
        // 상태 초기화
        this._clearAllFocus();
        this._isActive = false;
        this._focusedLaneIndex = 0;
        this._selectedCardIndex = -1;
        
        // Custom 레인 참조 해제 (dispose는 RankingView에서 처리)
        this._customLanes.clear();
        
        // 참조 해제
        this._lanes = new Map();
        this._laneIds = [];
        this._boundHandlers = {};
        this._onCardSelect = null;
        
        console.log('[LaneManager] ✅ dispose 완료');
    }
    
    // =========================================
    // Debug Methods
    // =========================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('[LaneManager] Debug Info (v1.1.0)');
        console.log('isActive:', this._isActive);
        console.log('focusedLaneIndex:', this._focusedLaneIndex);
        console.log('focusedLaneId:', this.focusedLaneId);
        console.log('selectedCardIndex:', this._selectedCardIndex);
        console.log('laneCount:', this.laneCount);
        console.log('laneIds:', this._laneIds);
        console.log('customLanes:', Array.from(this._customLanes.keys()));
        console.log('eventSubscriptions:', this._eventSubscriptions.length);
        console.groupEnd();
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.LaneManager = LaneManager;
}