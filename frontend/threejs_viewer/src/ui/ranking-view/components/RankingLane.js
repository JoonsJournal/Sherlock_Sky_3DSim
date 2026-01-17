/**
 * RankingLane.js
 * ==============
 * Ranking View 개별 레인 컴포넌트
 * 
 * @version 1.0.0
 * @description
 * - 레인 컨테이너 관리
 * - EquipmentCard 인스턴스 생성/관리
 * - 독립 스크롤 처리
 * - 레인 헤더 통계 업데이트
 * 
 * @changelog
 * - v1.0.0: Phase 2 초기 버전
 *   - 레인 DOM 구조 생성
 *   - EquipmentCard 관리
 *   - 통계 업데이트
 * 
 * @dependencies
 * - EquipmentCard (./EquipmentCard.js)
 * - LaneHeader (./LaneHeader.js) - Phase 2에서 구현
 * 
 * @exports
 * - RankingLane
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/components/RankingLane.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { EquipmentCard } from './EquipmentCard.js';
import { LaneHeader } from './LaneHeader.js';

export class RankingLane {
    /**
     * CSS 클래스 상수 정의
     */
    static CSS = {
        // Block
        BLOCK: 'ranking-lane',
        
        // Elements
        SCROLL_CONTAINER: 'ranking-lane__scroll-container',
        CARDS_CONTAINER: 'ranking-lane__cards-container',
        EMPTY_MESSAGE: 'ranking-lane__empty-message',
        EMPTY_ICON: 'ranking-lane__empty-icon',
        EMPTY_TEXT: 'ranking-lane__empty-text',
        
        // Modifiers
        LANE_REMOTE: 'ranking-lane--remote',
        LANE_SUDDEN_STOP: 'ranking-lane--sudden-stop',
        LANE_STOP: 'ranking-lane--stop',
        LANE_RUN: 'ranking-lane--run',
        LANE_IDLE: 'ranking-lane--idle',
        LANE_WAIT: 'ranking-lane--wait',
        LANE_CUSTOM: 'ranking-lane--custom',
        FOCUSED: 'ranking-lane--focused',
        EMPTY: 'ranking-lane--empty',
        
        // Legacy alias
        LEGACY_FOCUSED: 'focused'
    };
    
    /**
     * @param {Object} config - 레인 설정
     * @param {string} config.id - 레인 ID
     * @param {string} config.name - 레인명
     * @param {string} config.icon - 레인 아이콘
     * @param {string} config.description - 레인 설명
     * @param {string} config.sortKey - 정렬 기준 (duration/production)
     * @param {string} config.sortOrder - 정렬 방향 (asc/desc)
     * @param {Object} [options] - 추가 옵션
     */
    constructor(config, options = {}) {
        this._config = { ...config };
        this._options = options;
        
        // State
        this._cards = new Map(); // Map<equipmentId, EquipmentCard>
        this._isFocused = false;
        this._isEmpty = true;
        
        // Statistics
        this._stats = {
            count: 0,
            avgDuration: 0,
            maxDuration: 0,
            avgProduction: 0,
            maxProduction: 0
        };
        
        // DOM
        this.element = null;
        this._header = null;
        this._scrollContainer = null;
        this._cardsContainer = null;
        this._emptyMessage = null;
        
        // Initialize
        this._init();
    }
    
    // =========================================
    // Lifecycle Methods
    // =========================================
    
    /**
     * 초기화
     * @private
     */
    _init() {
        this._createDOM();
        this._applyLaneStyle();
        this._updateEmptyState();
    }
    
    /**
     * DOM 구조 생성
     * @private
     */
    _createDOM() {
        // Main container
        this.element = document.createElement('div');
        this.element.classList.add(RankingLane.CSS.BLOCK);
        this.element.dataset.laneId = this._config.id;
        
        // Header (using LaneHeader component)
        this._header = new LaneHeader({
            id: this._config.id,
            name: this._config.name,
            icon: this._config.icon,
            sortKey: this._config.sortKey
        });
        
        // Scroll Container
        this._scrollContainer = document.createElement('div');
        this._scrollContainer.classList.add(RankingLane.CSS.SCROLL_CONTAINER);
        
        // Cards Container
        this._cardsContainer = document.createElement('div');
        this._cardsContainer.classList.add(RankingLane.CSS.CARDS_CONTAINER);
        this._cardsContainer.dataset.cardsContainer = 'true';
        
        // Empty Message
        this._emptyMessage = this._createEmptyMessage();
        this._cardsContainer.appendChild(this._emptyMessage);
        
        // Assemble
        this._scrollContainer.appendChild(this._cardsContainer);
        this.element.appendChild(this._header.element);
        this.element.appendChild(this._scrollContainer);
    }
    
    /**
     * 빈 상태 메시지 생성
     * @private
     * @returns {HTMLElement}
     */
    _createEmptyMessage() {
        const emptyMsg = document.createElement('div');
        emptyMsg.classList.add(RankingLane.CSS.EMPTY_MESSAGE);
        
        const emptyIcon = document.createElement('div');
        emptyIcon.classList.add(RankingLane.CSS.EMPTY_ICON);
        emptyIcon.textContent = '✓';
        
        const emptyText = document.createElement('div');
        emptyText.classList.add(RankingLane.CSS.EMPTY_TEXT);
        emptyText.textContent = this._getEmptyText();
        
        emptyMsg.appendChild(emptyIcon);
        emptyMsg.appendChild(emptyText);
        
        return emptyMsg;
    }
    
    /**
     * 빈 상태 텍스트 가져오기
     * @private
     * @returns {string}
     */
    _getEmptyText() {
        const texts = {
            'remote': 'Remote 알람 없음',
            'sudden-stop': 'Sudden Stop 설비 없음',
            'stop': '정지 설비 없음',
            'run': '가동 중인 설비 없음',
            'idle': '대기 설비 없음',
            'wait': '비생산 대기 설비 없음',
            'custom': '필터 조건에 맞는 설비 없음'
        };
        return texts[this._config.id] || '해당 상태 설비 없음';
    }
    
    /**
     * 레인 스타일 적용
     * @private
     */
    _applyLaneStyle() {
        const styleMap = {
            'remote': RankingLane.CSS.LANE_REMOTE,
            'sudden-stop': RankingLane.CSS.LANE_SUDDEN_STOP,
            'stop': RankingLane.CSS.LANE_STOP,
            'run': RankingLane.CSS.LANE_RUN,
            'idle': RankingLane.CSS.LANE_IDLE,
            'wait': RankingLane.CSS.LANE_WAIT,
            'custom': RankingLane.CSS.LANE_CUSTOM
        };
        
        const styleClass = styleMap[this._config.id];
        if (styleClass) {
            this.element.classList.add(styleClass);
        }
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
        const cardData = { ...data, laneId: this._config.id };
        const card = new EquipmentCard(cardData);
        
        // 카드 저장
        const key = data.equipmentId || data.frontendId;
        this._cards.set(key, card);
        
        // DOM에 추가 (빈 메시지 앞에)
        this._cardsContainer.insertBefore(card.element, this._emptyMessage);
        
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
        if (card) {
            card.dispose();
            this._cards.delete(equipmentId);
            
            // 상태 업데이트
            this._updateEmptyState();
            this._updateStats();
        }
    }
    
    /**
     * 카드 업데이트
     * @param {string} equipmentId
     * @param {Object} newData
     */
    updateCard(equipmentId, newData) {
        const card = this._cards.get(equipmentId);
        if (card) {
            card.update(newData);
            this._updateStats();
        }
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
     * @returns {Map<string, EquipmentCard>}
     */
    getAllCards() {
        return new Map(this._cards);
    }
    
    /**
     * 카드 존재 여부 확인
     * @param {string} equipmentId
     * @returns {boolean}
     */
    hasCard(equipmentId) {
        return this._cards.has(equipmentId);
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
     * 포커스 설정
     * @param {boolean} focused
     */
    setFocused(focused) {
        this._isFocused = focused;
        
        if (focused) {
            this.element.classList.add(RankingLane.CSS.FOCUSED);
            this.element.classList.add(RankingLane.CSS.LEGACY_FOCUSED);
            this.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            this.element.classList.remove(RankingLane.CSS.FOCUSED);
            this.element.classList.remove(RankingLane.CSS.LEGACY_FOCUSED);
        }
    }
    
    /**
     * 포커스 상태 반환
     * @returns {boolean}
     */
    get isFocused() {
        return this._isFocused;
    }
    
    /**
     * 카드 수 반환
     * @returns {number}
     */
    get count() {
        return this._cards.size;
    }
    
    /**
     * 레인 ID 반환
     * @returns {string}
     */
    get id() {
        return this._config.id;
    }
    
    /**
     * 설정 반환
     * @returns {Object}
     */
    get config() {
        return { ...this._config };
    }
    
    /**
     * 통계 반환
     * @returns {Object}
     */
    get stats() {
        return { ...this._stats };
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        // 카드 정리
        this._cards.forEach(card => card.dispose());
        this._cards.clear();
        
        // 헤더 정리
        this._header?.dispose();
        
        // DOM 제거
        this.element?.remove();
        
        // 참조 해제
        this.element = null;
        this._header = null;
        this._scrollContainer = null;
        this._cardsContainer = null;
        this._emptyMessage = null;
    }
    
    // =========================================
    // Private Methods
    // =========================================
    
    /**
     * 빈 상태 업데이트
     * @private
     */
    _updateEmptyState() {
        this._isEmpty = this._cards.size === 0;
        
        if (this._isEmpty) {
            this.element.classList.add(RankingLane.CSS.EMPTY);
            this._emptyMessage.style.display = 'flex';
        } else {
            this.element.classList.remove(RankingLane.CSS.EMPTY);
            this._emptyMessage.style.display = 'none';
        }
    }
    
    /**
     * 통계 업데이트
     * @private
     */
    _updateStats() {
        const cards = Array.from(this._cards.values());
        const count = cards.length;
        
        if (count === 0) {
            this._stats = {
                count: 0,
                avgDuration: 0,
                maxDuration: 0,
                avgProduction: 0,
                maxProduction: 0
            };
        } else {
            // Duration 기반 통계 (Run 외)
            if (this._config.sortKey === 'duration') {
                const durations = cards.map(card => {
                    const data = card.data;
                    if (data.occurredAt) {
                        return Math.floor((Date.now() - new Date(data.occurredAt).getTime()) / 1000);
                    }
                    return 0;
                });
                
                const sum = durations.reduce((a, b) => a + b, 0);
                const max = Math.max(...durations);
                
                this._stats.avgDuration = Math.floor(sum / count);
                this._stats.maxDuration = max;
            }
            
            // Production 기반 통계 (Run)
            if (this._config.sortKey === 'production') {
                const productions = cards.map(card => card.data.productionCount || 0);
                
                const sum = productions.reduce((a, b) => a + b, 0);
                const max = Math.max(...productions);
                
                this._stats.avgProduction = Math.floor(sum / count);
                this._stats.maxProduction = max;
            }
        }
        
        this._stats.count = count;
        
        // 헤더 업데이트
        this._header?.updateStats(this._stats);
    }
    
    // =========================================
    // Debug Methods
    // =========================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group(`[RankingLane] ${this._config.id}`);
        console.log('config:', this._config);
        console.log('cardCount:', this._cards.size);
        console.log('stats:', this._stats);
        console.log('isEmpty:', this._isEmpty);
        console.log('isFocused:', this._isFocused);
        console.groupEnd();
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.RankingLane = RankingLane;
}