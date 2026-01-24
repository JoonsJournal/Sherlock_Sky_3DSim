/**
 * RankingLane.js
 * ==============
 * 개별 레인 컨테이너 컴포넌트
 * 
 * @version 1.1.1                             // ← 변경
 * @description
 * - 레인 DOM 생성 (헤더 + 스크롤 영역)
 * - EquipmentCard 인스턴스 관리
 * - 독립 스크롤 처리
 * - 레인 통계 (평균/최대 지속시간, 생산개수)
 * - Custom 레인 지원 (Phase 6)
 * 
 * @changelog
 * - v1.1.1: 🐛 BugFix - _findInsertIndex() DOM 순서 기반 정렬  // ← 추가
 *   - Map 순서가 아닌 DOM children 순서로 정렬 위치 계산
 *   - _getCardsInDOMOrder() 헬퍼 메서드 추가
 *   - 카드 이동 후 정렬 불일치 문제 해결
 *   - ⚠️ 호환성: 기존 모든 기능 100% 유지
 * - v1.1.0: 🆕 Phase 6 - Custom 레인 지원
 *   - isCustom 플래그 추가
 *   - 삭제 버튼 (Custom 레인 전용)
 *   - filterType, filterConfig 저장
 *   - ⚠️ 호환성: v1.0.0의 모든 기능 100% 유지
 * - v1.0.0: 초기 버전
 *   - 레인 기본 구조
 *   - 카드 추가/제거/업데이트
 *   - 헤더 통계 표시
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * - EquipmentCard (./EquipmentCard.js)
 * - LaneHeader (./LaneHeader.js)
 * 
 * @exports
 * - RankingLane
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/components/RankingLane.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-23
 */

import { eventBus } from '../../../core/managers/EventBus.js';
import { EquipmentCard } from './EquipmentCard.js';
import { LaneHeader } from './LaneHeader.js';

export class RankingLane {
    /**
     * CSS 클래스 상수
     */
    static CSS = {
        // Block
        BLOCK: 'ranking-lane',
        
        // Elements
        HEADER: 'ranking-lane__header',
        SCROLL_CONTAINER: 'ranking-lane__scroll-container',
        CARDS_CONTAINER: 'ranking-lane__cards-container',
        DELETE_BTN: 'ranking-lane__delete-btn',
        
        // Status Modifiers
        LANE_REMOTE: 'ranking-lane--remote',
        LANE_SUDDEN_STOP: 'ranking-lane--sudden-stop',
        LANE_STOP: 'ranking-lane--stop',
        LANE_RUN: 'ranking-lane--run',
        LANE_IDLE: 'ranking-lane--idle',
        LANE_WAIT: 'ranking-lane--wait',
        LANE_CUSTOM: 'ranking-lane--custom',
        
        // State Modifiers
        FOCUSED: 'ranking-lane--focused',
        EMPTY: 'ranking-lane--empty',
        
        // Legacy alias
        LEGACY_FOCUSED: 'focused'
    };
    
    /**
     * @param {Object} config - 레인 설정
     * @param {string} config.id - 레인 ID
     * @param {string} config.name - 레인 이름
     * @param {string} config.icon - 레인 아이콘
     * @param {string} [config.description] - 레인 설명
     * @param {string} [config.sortKey] - 정렬 기준 ('duration' | 'production')
     * @param {string} [config.sortOrder] - 정렬 순서 ('asc' | 'desc')
     * @param {boolean} [config.isCustom] - Custom 레인 여부
     * @param {string} [config.filterType] - Custom 필터 타입
     * @param {Object} [config.filterConfig] - Custom 필터 설정
     */
    constructor(config) {
        // Config
        this._id = config.id;
        this._name = config.name;
        this._icon = config.icon;
        this._description = config.description || '';
        this._sortKey = config.sortKey || 'duration';
        this._sortOrder = config.sortOrder || 'desc';
        
        // 🆕 v1.1.0: Custom 레인 설정
        this._isCustom = config.isCustom || false;
        this._filterType = config.filterType || null;
        this._filterConfig = config.filterConfig || {};
        
        // State
        this._isFocused = false;
        
        // DOM References
        this.element = null;
        this._headerComponent = null;
        this._scrollContainer = null;
        this._cardsContainer = null;
        this._deleteBtn = null;
        
        // Cards Map<equipmentId, EquipmentCard>
        this._cards = new Map();
        
        // Event handlers
        this._boundHandlers = {};
        
        // Initialize
        this._createDOM();
        this._setupEventListeners();
    }
    
    // =========================================
    // Private Methods
    // =========================================
    
    /**
     * DOM 생성
     * @private
     */
    _createDOM() {
        // Main container
        this.element = document.createElement('div');
        this.element.classList.add(RankingLane.CSS.BLOCK);
        this.element.classList.add(RankingLane.CSS.EMPTY);
        this.element.dataset.laneId = this._id;
        
        // Status modifier 추가
        this._addStatusModifier();
        
        // Header (LaneHeader 컴포넌트)
        this._headerComponent = new LaneHeader({
            id: this._id,
            name: this._name,
            icon: this._icon,
            sortKey: this._sortKey,
            isCustom: this._isCustom
        });
        this.element.appendChild(this._headerComponent.element);
        
        // 🆕 v1.1.0: Custom 레인 삭제 버튼
        if (this._isCustom) {
            this._deleteBtn = document.createElement('button');
            this._deleteBtn.classList.add(RankingLane.CSS.DELETE_BTN);
            this._deleteBtn.innerHTML = '✕';
            this._deleteBtn.title = '레인 삭제';
            this._headerComponent.element.appendChild(this._deleteBtn);
        }
        
        // Scroll Container
        this._scrollContainer = document.createElement('div');
        this._scrollContainer.classList.add(RankingLane.CSS.SCROLL_CONTAINER);
        
        // Cards Container
        this._cardsContainer = document.createElement('div');
        this._cardsContainer.classList.add(RankingLane.CSS.CARDS_CONTAINER);
        
        this._scrollContainer.appendChild(this._cardsContainer);
        this.element.appendChild(this._scrollContainer);
    }
    
    /**
     * Status Modifier 추가
     * @private
     */
    _addStatusModifier() {
        // 🆕 v1.1.0: Custom 레인
        if (this._isCustom) {
            this.element.classList.add(RankingLane.CSS.LANE_CUSTOM);
            return;
        }
        
        // 기본 레인 타입별 modifier
        switch (this._id) {
            case 'remote':
                this.element.classList.add(RankingLane.CSS.LANE_REMOTE);
                break;
            case 'sudden-stop':
                this.element.classList.add(RankingLane.CSS.LANE_SUDDEN_STOP);
                break;
            case 'stop':
                this.element.classList.add(RankingLane.CSS.LANE_STOP);
                break;
            case 'run':
                this.element.classList.add(RankingLane.CSS.LANE_RUN);
                break;
            case 'idle':
                this.element.classList.add(RankingLane.CSS.LANE_IDLE);
                break;
            case 'wait':
                this.element.classList.add(RankingLane.CSS.LANE_WAIT);
                break;
        }
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // 레인 클릭
        this._boundHandlers.onClick = this._handleClick.bind(this);
        this.element.addEventListener('click', this._boundHandlers.onClick);
        
        // 🆕 v1.1.0: 삭제 버튼 클릭
        if (this._deleteBtn) {
            this._boundHandlers.onDeleteClick = this._handleDeleteClick.bind(this);
            this._deleteBtn.addEventListener('click', this._boundHandlers.onDeleteClick);
        }
    }
    
    /**
     * 레인 클릭 이벤트
     * @private
     * @param {MouseEvent} event
     */
    _handleClick(event) {
        // 카드 클릭은 카드에서 처리
        if (event.target.closest(`.${EquipmentCard.CSS.BLOCK}`)) {
            return;
        }
        
        // 삭제 버튼 클릭은 별도 처리
        if (event.target === this._deleteBtn) {
            return;
        }
        
        eventBus.emit('ranking:lane:click', {
            laneId: this._id,
            isCustom: this._isCustom
        });
    }
    
    /**
     * 🆕 v1.1.0: 삭제 버튼 클릭
     * @private
     * @param {MouseEvent} event
     */
    _handleDeleteClick(event) {
        event.stopPropagation();
        
        // Custom 레인 삭제 이벤트 발행
        eventBus.emit('customLane:remove', {
            laneId: this._id
        });
    }
    
    /**
     * 통계 업데이트
     * @private
     */
    _updateStats() {
        if (!this._headerComponent) return;
        
        const stats = this._calculateStats();
        this._headerComponent.updateStats(stats);
    }
    
    /**
     * 통계 계산
     * @private
     * @returns {Object}
     */
    _calculateStats() {
        const cards = Array.from(this._cards.values());
        
        if (cards.length === 0) {
            return {
                count: 0,
                avgDuration: 0,
                maxDuration: 0,
                avgProduction: 0,
                maxProduction: 0
            };
        }
        
        if (this._sortKey === 'production') {
            // 생산개수 기준
            const counts = cards.map(card => card.getData()?.productionCount || 0);
            const sum = counts.reduce((a, b) => a + b, 0);
            const max = Math.max(...counts);
            
            return {
                count: cards.length,
                avgProduction: Math.round(sum / cards.length),
                maxProduction: max
            };
        } else {
            // 지속시간 기준 (초 단위로 변환 - LaneHeader가 초 단위를 기대함)
            const durations = cards.map(card => {
                const data = card.getData();
                // 🆕 Backend 호환: status_changed_at 필드 추가 지원
                const startTime = data?.occurredAt || data?.statusStartTime || data?.status_changed_at;
                if (!startTime) return 0;
                
                const ms = Date.now() - new Date(startTime).getTime();
                return ms / 1000; // 초 단위로 변환
            });
            
            const sum = durations.reduce((a, b) => a + b, 0);
            const max = Math.max(...durations);
            
            return {
                count: cards.length,
                avgDuration: Math.round(sum / cards.length),
                maxDuration: Math.round(max)
            };
        }
    }
    
    /**
     * 빈 상태 업데이트
     * @private
     */
    _updateEmptyState() {
        if (this._cards.size === 0) {
            this.element.classList.add(RankingLane.CSS.EMPTY);
        } else {
            this.element.classList.remove(RankingLane.CSS.EMPTY);
        }
    }
    
    /**
     * 🆕 v1.1.1: DOM 순서대로 카드 배열 반환
     * Map 순서가 아닌 실제 DOM children 순서 기준
     * @private
     * @returns {EquipmentCard[]}
     */
    _getCardsInDOMOrder() {
        if (!this._cardsContainer) return [];
        
        const result = [];
        const children = this._cardsContainer.children;
        
        for (let i = 0; i < children.length; i++) {
            const element = children[i];
            // Map에서 해당 element를 가진 카드 찾기
            for (const [id, card] of this._cards) {
                if (card.element === element) {
                    result.push(card);
                    break;
                }
            }
        }
        
        return result;
    }

    // =========================================
    // Public Methods
    // =========================================
    
    /**
     * 카드 추가
     * @param {Object} data - 설비 데이터
     * @returns {EquipmentCard}
     */
    addCard(data) {
        const id = data.frontendId || data.equipmentId;
        
        // 이미 존재하면 업데이트
        if (this._cards.has(id)) {
            return this.updateCard(id, data);
        }
        
        // 새 카드 생성
        const card = new EquipmentCard(data);
        this._cards.set(id, card);
        
        // DOM에 추가 (정렬 위치에 삽입)
        const insertIndex = this._findInsertIndex(data);
        if (insertIndex < this._cardsContainer.children.length) {
            this._cardsContainer.insertBefore(
                card.element, 
                this._cardsContainer.children[insertIndex]
            );
        } else {
            this._cardsContainer.appendChild(card.element);
        }
        
        // 상태 업데이트
        this._updateEmptyState();
        this._updateStats();
        
        return card;
    }
    
    /**
     * 카드 제거
     * @param {string} equipmentId
     */
    removeCard(equipmentId) {
        const card = this._cards.get(equipmentId);
        if (!card) return;
        
        card.dispose();
        this._cards.delete(equipmentId);
        
        // 상태 업데이트
        this._updateEmptyState();
        this._updateStats();
    }
    
    /**
     * 카드 업데이트
     * @param {string} equipmentId
     * @param {Object} newData
     * @returns {EquipmentCard|null}
     */
    updateCard(equipmentId, newData) {
        const card = this._cards.get(equipmentId);
        if (!card) return null;
        
        card.update(newData);
        this._updateStats();
        
        return card;
    }
    
    /**
     * 카드 가져오기
     * @param {string} equipmentId
     * @returns {EquipmentCard|undefined}
     */
    getCard(equipmentId) {
        return this._cards.get(equipmentId);
    }
    
    /**
     * 모든 카드 가져오기
     * @returns {EquipmentCard[]}
     */
    getAllCards() {
        return Array.from(this._cards.values());
    }
    
    /**
     * 모든 카드 제거
     */
    clearCards() {
        this._cards.forEach(card => card.dispose());
        this._cards.clear();
        
        this._updateEmptyState();
        this._updateStats();
    }
    
    /**
     * 정렬 위치 찾기
     * @private
     * @param {Object} data
     * @returns {number}
     */
    _findInsertIndex(data) {
        // 🐛 v1.1.1 Fix: DOM 순서 기준으로 비교 (Map 순서 아님)
        const cards = this._getCardsInDOMOrder();
        
        if (cards.length === 0) return 0;
        
        const getValue = (cardData) => {
            if (this._sortKey === 'production') {
                return cardData.productionCount || 0;
            } else {
                const startTime = cardData.occurredAt || cardData.statusStartTime;
                if (!startTime) return 0;
                return Date.now() - new Date(startTime).getTime();
            }
        };
        
        const newValue = getValue(data);
        
        for (let i = 0; i < cards.length; i++) {
            const cardValue = getValue(cards[i].getData());
            
            if (this._sortOrder === 'desc') {
                if (newValue > cardValue) return i;
            } else {
                if (newValue < cardValue) return i;
            }
        }
        
        return cards.length;
    }
    
    /**
     * 포커스 상태 설정
     * @param {boolean} focused
     */
    setFocused(focused) {
        this._isFocused = focused;
        
        if (focused) {
            this.element.classList.add(RankingLane.CSS.FOCUSED);
            this.element.classList.add(RankingLane.CSS.LEGACY_FOCUSED);
        } else {
            this.element.classList.remove(RankingLane.CSS.FOCUSED);
            this.element.classList.remove(RankingLane.CSS.LEGACY_FOCUSED);
        }
    }
    
    /**
     * 스크롤을 맨 위로
     */
    scrollToTop() {
        if (this._scrollContainer) {
            this._scrollContainer.scrollTop = 0;
        }
    }
    
    /**
     * 카드 수
     * @returns {number}
     */
    get count() {
        return this._cards.size;
    }
    
    /**
     * 레인 ID
     * @returns {string}
     */
    get id() {
        return this._id;
    }
    
    /**
     * Custom 레인 여부
     * @returns {boolean}
     */
    get isCustom() {
        return this._isCustom;
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        // 이벤트 리스너 제거
        this.element?.removeEventListener('click', this._boundHandlers.onClick);
        this._deleteBtn?.removeEventListener('click', this._boundHandlers.onDeleteClick);
        
        // 헤더 정리
        if (this._headerComponent) {
            this._headerComponent.dispose();
            this._headerComponent = null;
        }
        
        // 카드 정리
        this._cards.forEach(card => card.dispose());
        this._cards.clear();
        
        // DOM 제거
        this.element?.remove();
        
        // 참조 해제
        this.element = null;
        this._scrollContainer = null;
        this._cardsContainer = null;
        this._deleteBtn = null;
        this._boundHandlers = {};
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.RankingLane = RankingLane;
}