/**
 * PositionCalculator.js
 * =====================
 * 카드 위치 계산 유틸리티
 * 
 * @version 1.2.0
 * @description
 * - 레인 내 카드 목표 위치 계산
 * - 스크롤 오프셋 고려
 * - 뷰포트 기준 좌표 변환
 * - 위치 캐싱 및 무효화
 * - 🆕 v1.1.0: 이동 벡터 계산, 밀림 위치 계산, 가시 범위 계산
 * 
 * @changelog
 * - v1.2.0 (2026-01-23): Phase 1 - 레인 이동 개선
 *   - 🆕 calculateSortedInsertIndex(): 정렬 기준 삽입 위치 계산
 *   - 🆕 calculateBatchInsertIndices(): 복수 카드 일괄 계산
 *   - ⚠️ 호환성: v1.1.0의 모든 기능/메서드/필드 100% 유지
 * - v1.1.0 (2026-01-19): 가이드라인 준수 + 추가 기능 통합
 *   - 🆕 static UTIL 추가 (가이드라인 준수)
 *   - 🆕 calculateMoveVector() - 이동 벡터 계산 (startX, startY 포함)
 *   - 🆕 calculatePushPositions() - 밀림 대상 카드들 배열
 *   - 🆕 calculateLaneX() - 레인 인덱스로 X 위치 계산
 *   - 🆕 calculateCardY() - 카드 인덱스로 Y 위치 계산
 *   - 🆕 calculateVisibleRange() - 뷰포트 내 보이는 카드 범위
 *   - 🆕 getConfig() - 설정 조회
 *   - ⚠️ 호환성: v1.0.0의 모든 기능/메서드/필드 100% 유지
 * - v1.0.0: 초기 구현
 *   - 위치 계산 로직
 *   - 스크롤 처리
 *   - 캐시 시스템
 *   - ⚠️ 호환성: 신규 파일
 * 
 * @dependencies
 * - 없음 (Pure utility)
 * 
 * @exports
 * - PositionCalculator
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/utils/PositionCalculator.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-23
 */

/**
 * PositionCalculator - 카드 위치 계산 유틸리티
 * 
 * 주요 기능:
 * 1. 레인 내 목표 위치 계산
 * 2. 스크롤 오프셋 보정
 * 3. 뷰포트 좌표 ↔ 문서 좌표 변환
 * 4. 레인/카드 경계 계산
 * 5. 🆕 v1.1.0: 이동 벡터, 밀림 위치, 가시 범위 계산
 */
export class PositionCalculator {
    // ─────────────────────────────────────────────────────────────
    // Static Constants
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 기본 설정
     */
    static DEFAULTS = {
        CARD_HEIGHT: 120,      // 카드 높이 (px)
        CARD_GAP: 8,           // 카드 간 간격 (px)
        LANE_PADDING: 12,      // 레인 패딩 (px)
        LANE_WIDTH: 220,       // 레인 너비 (px)
        LANE_GAP: 12,          // 레인 간격 (px)
        HEADER_HEIGHT: 80,     // 레인 헤더 높이 (px)
        CACHE_TTL: 1000        // 캐시 유효 시간 (ms)
    };
    
    /**
     * 🆕 v1.1.0: Utility 클래스 상수 (가이드라인 준수)
     */
    static UTIL = {
        HIDDEN: 'u-hidden',
        FLEX: 'u-flex'
    };
    
    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    
    /**
     * PositionCalculator 생성자
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement} options.container - 레인 컨테이너
     * @param {Map} options.lanesMap - 레인 맵 (laneId → RankingLane)
     */
    constructor(options = {}) {
        this.container = options.container || null;
        this.lanesMap = options.lanesMap || new Map();
        
        // 설정
        this._config = {
            ...PositionCalculator.DEFAULTS,
            ...options.config
        };
        
        // 캐시
        this._positionCache = new Map();
        this._laneRectCache = new Map();
        this._cacheTimestamp = 0;
        
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
        console.log('[PositionCalculator] 📐 Initializing v1.1.0...');
    }
    
    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 목표 위치 계산 (메인 API)
     * @param {string} equipmentId - 설비 ID
     * @param {string} laneId - 레인 ID
     * @param {number} targetIndex - 목표 인덱스
     * @returns {Object} { x, y, width, height }
     */
    calculateTargetPosition(equipmentId, laneId, targetIndex) {
        // 캐시 확인
        const cacheKey = `${laneId}:${targetIndex}`;
        const cached = this._getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        // 레인 정보 가져오기
        const lane = this.lanesMap.get(laneId);
        if (!lane) {
            console.warn(`[PositionCalculator] ⚠️ Lane not found: ${laneId}`);
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        // 레인 위치 정보
        const laneRect = this._getLaneRect(laneId);
        const cardsContainer = this._getCardsContainer(lane);
        
        if (!cardsContainer) {
            return { x: laneRect.x, y: laneRect.y, width: 0, height: 0 };
        }
        
        // 카드 높이 계산 (기존 카드 참조 또는 기본값)
        const cardHeight = this._estimateCardHeight(lane);
        
        // 스크롤 오프셋
        const scrollOffset = this._getScrollOffset(cardsContainer);
        
        // 목표 Y 위치 계산
        const containerRect = cardsContainer.getBoundingClientRect();
        const targetY = containerRect.top + 
                        (targetIndex * (cardHeight + this._config.CARD_GAP)) - 
                        scrollOffset;
        
        const position = {
            x: containerRect.left,
            y: targetY,
            width: containerRect.width,
            height: cardHeight
        };
        
        // 캐시 저장
        this._setToCache(cacheKey, position);
        
        return position;
    }
    
    /**
     * 🆕 v1.1.0: 레인 요소 기반 카드 위치 계산
     * @param {HTMLElement} laneElement - 레인 DOM 요소
     * @param {number} cardIndex - 카드 인덱스
     * @returns {Object} { x, y }
     */
    calculateCardPosition(laneElement, cardIndex) {
        if (!laneElement) {
            return { x: 0, y: 0 };
        }
        
        const laneRect = laneElement.getBoundingClientRect();
        const scrollContainer = laneElement.querySelector('.ranking-lane__scroll-container') ||
                               laneElement.querySelector('.ranking-lane__cards-container');
        const scrollTop = scrollContainer?.scrollTop || 0;
        
        const { CARD_HEIGHT, CARD_GAP, HEADER_HEIGHT, LANE_PADDING } = this._config;
        
        // X 위치: 레인의 왼쪽 + padding
        const x = laneRect.left + LANE_PADDING;
        
        // Y 위치: 헤더 + (카드 높이 + 간격) * 인덱스 - 스크롤
        const y = laneRect.top + HEADER_HEIGHT + 
                  (CARD_HEIGHT + CARD_GAP) * cardIndex - scrollTop;
        
        return { x, y };
    }
    
    /**
     * 카드 현재 위치 가져오기
     * @param {HTMLElement} cardElement - 카드 엘리먼트
     * @returns {Object} { x, y, width, height }
     */
    getCurrentPosition(cardElement) {
        if (!cardElement) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        const rect = cardElement.getBoundingClientRect();
        
        return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };
    }
    
    /**
     * 두 위치 간 델타 계산
     * @param {Object} from - 시작 위치
     * @param {Object} to - 목표 위치
     * @returns {Object} { deltaX, deltaY, distance, angle }
     */
    calculateDelta(from, to) {
        const deltaX = to.x - from.x;
        const deltaY = to.y - from.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        return {
            deltaX,
            deltaY,
            distance,
            angle
        };
    }
    
    /**
     * 🆕 v1.1.0: 레인 간 이동 벡터 계산 (확장)
     * @param {HTMLElement} fromLaneElement - 출발 레인
     * @param {HTMLElement} toLaneElement - 도착 레인
     * @param {number} fromIndex - 출발 인덱스
     * @param {number} toIndex - 도착 인덱스
     * @returns {Object} { deltaX, deltaY, distance, angle, startX, startY, endX, endY }
     */
    calculateMoveVector(fromLaneElement, toLaneElement, fromIndex, toIndex) {
        const fromPos = this.calculateCardPosition(fromLaneElement, fromIndex);
        const toPos = this.calculateCardPosition(toLaneElement, toIndex);
        
        const deltaX = toPos.x - fromPos.x;
        const deltaY = toPos.y - fromPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        return {
            deltaX,
            deltaY,
            distance,
            angle,
            startX: fromPos.x,
            startY: fromPos.y,
            endX: toPos.x,
            endY: toPos.y
        };
    }
    
    /**
     * 레인 위치 정보 가져오기
     * @param {string} laneId - 레인 ID
     * @returns {Object} { x, y, width, height, scrollTop }
     */
    getLanePosition(laneId) {
        return this._getLaneRect(laneId);
    }
    
    /**
     * 특정 인덱스의 카드가 보이는지 확인
     * @param {string} laneId - 레인 ID
     * @param {number} index - 카드 인덱스
     * @returns {boolean}
     */
    isCardVisible(laneId, index) {
        const lane = this.lanesMap.get(laneId);
        if (!lane) return false;
        
        const cardsContainer = this._getCardsContainer(lane);
        if (!cardsContainer) return false;
        
        const cardHeight = this._estimateCardHeight(lane);
        const scrollTop = cardsContainer.scrollTop;
        const containerHeight = cardsContainer.clientHeight;
        
        const cardTop = index * (cardHeight + this._config.CARD_GAP);
        const cardBottom = cardTop + cardHeight;
        
        return cardBottom > scrollTop && cardTop < scrollTop + containerHeight;
    }
    
    /**
     * 카드가 뷰포트 내에 있는지 확인
     * @param {HTMLElement} cardElement - 카드 엘리먼트
     * @returns {boolean}
     */
    isInViewport(cardElement) {
        if (!cardElement) return false;
        
        const rect = cardElement.getBoundingClientRect();
        
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
    
    /**
     * 인덱스로 스크롤 위치 계산
     * @param {string} laneId - 레인 ID
     * @param {number} index - 카드 인덱스
     * @returns {number} 스크롤 위치 (scrollTop)
     */
    calculateScrollToIndex(laneId, index) {
        const lane = this.lanesMap.get(laneId);
        if (!lane) return 0;
        
        const cardHeight = this._estimateCardHeight(lane);
        const cardsContainer = this._getCardsContainer(lane);
        
        if (!cardsContainer) return 0;
        
        const containerHeight = cardsContainer.clientHeight;
        const targetTop = index * (cardHeight + this._config.CARD_GAP);
        
        // 카드가 중앙에 오도록 스크롤
        return Math.max(0, targetTop - (containerHeight / 2) + (cardHeight / 2));
    }
    
    /**
     * 모든 레인의 카드 위치 계산
     * @returns {Map} laneId → Array<{ index, position }>
     */
    calculateAllPositions() {
        const result = new Map();
        
        for (const [laneId, lane] of this.lanesMap) {
            const positions = [];
            const cardsContainer = this._getCardsContainer(lane);
            
            if (cardsContainer) {
                const cards = cardsContainer.querySelectorAll('.equipment-card');
                cards.forEach((card, index) => {
                    positions.push({
                        index,
                        position: this.getCurrentPosition(card)
                    });
                });
            }
            
            result.set(laneId, positions);
        }
        
        return result;
    }
    
    /**
     * 삽입 위치의 Y 좌표 계산
     * @param {string} laneId - 레인 ID
     * @param {number} insertIndex - 삽입 인덱스
     * @returns {number} Y 좌표
     */
    calculateInsertY(laneId, insertIndex) {
        const position = this.calculateTargetPosition(null, laneId, insertIndex);
        return position.y;
    }
    
    /**
     * 밀림 거리 계산
     * @param {string} laneId - 레인 ID
     * @returns {number} 밀림 거리 (px)
     */
    calculatePushDistance(laneId) {
        const lane = this.lanesMap.get(laneId);
        if (!lane) return 0;
        
        return this._estimateCardHeight(lane) + this._config.CARD_GAP;
    }
    
    /**
     * 🆕 v1.1.0: 밀림 효과 대상 카드들의 위치 계산
     * @param {HTMLElement} laneElement - 레인
     * @param {number} insertIndex - 삽입 위치
     * @param {number} totalCards - 전체 카드 수
     * @returns {Array<Object>} 영향받는 카드들의 이동 정보
     */
    calculatePushPositions(laneElement, insertIndex, totalCards) {
        const positions = [];
        const { CARD_HEIGHT, CARD_GAP } = this._config;
        const pushDistance = CARD_HEIGHT + CARD_GAP;
        
        // insertIndex 이후의 모든 카드가 아래로 밀림
        for (let i = insertIndex; i < totalCards; i++) {
            positions.push({
                cardIndex: i,
                fromY: this.calculateCardPosition(laneElement, i).y,
                toY: this.calculateCardPosition(laneElement, i + 1).y,
                pushDistance
            });
        }
        
        return positions;
    }
    
	 /**
     * 🆕 v1.2.0: 정렬 기준값 비교를 통한 삽입 인덱스 계산
     * 
     * @param {Array<Object>} existingCards - 기존 카드 목록 (sortValue 포함)
     * @param {number} newValue - 새 카드의 정렬 기준값
     * @param {string} [sortOrder='desc'] - 정렬 방향 ('asc' | 'desc')
     * @returns {number} insertIndex (0-based)
     */
    calculateSortedInsertIndex(existingCards, newValue, sortOrder = 'desc') {
        if (!existingCards || existingCards.length === 0) {
            return 0;
        }
        
        let left = 0;
        let right = existingCards.length;
        
        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            const midValue = existingCards[mid].sortValue ?? 0;
            
            if (sortOrder === 'desc') {
                if (midValue > newValue) {
                    left = mid + 1;
                } else {
                    right = mid;
                }
            } else {
                if (midValue < newValue) {
                    left = mid + 1;
                } else {
                    right = mid;
                }
            }
        }
        
        return left;
    }
    
    /**
     * 🆕 v1.2.0: 복수 카드 삽입 위치 일괄 계산
     * 
     * @param {Array<Object>} existingCards - 기존 카드 목록
     * @param {Array<Object>} newCards - 삽입할 카드들 (sortValue 포함)
     * @param {string} [sortOrder='desc'] - 정렬 방향
     * @returns {Array<{card: Object, insertIndex: number}>}
     */
    calculateBatchInsertIndices(existingCards, newCards, sortOrder = 'desc') {
        if (!newCards || newCards.length === 0) {
            return [];
        }
        
        const sortedNewCards = [...newCards].sort((a, b) => {
            const valueA = a.sortValue ?? 0;
            const valueB = b.sortValue ?? 0;
            return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
        });
        
        const results = [];
        let offset = 0;
        
        for (const card of sortedNewCards) {
            const baseIndex = this.calculateSortedInsertIndex(
                existingCards, 
                card.sortValue ?? 0, 
                sortOrder
            );
            
            results.push({
                card,
                insertIndex: baseIndex + offset
            });
            
            offset++;
        }
        
        return results;
    }
	
    /**
     * 🆕 v1.1.0: 레인 인덱스로부터 X 위치 계산
     * @param {number} laneIndex - 레인 인덱스
     * @param {HTMLElement} [container] - 컨테이너 요소
     * @returns {number}
     */
    calculateLaneX(laneIndex, container) {
        const { LANE_WIDTH, LANE_GAP } = this._config;
        
        let offsetX = 0;
        if (container) {
            offsetX = container.getBoundingClientRect().left;
        } else if (this.container) {
            offsetX = this.container.getBoundingClientRect().left;
        }
        
        return offsetX + (LANE_WIDTH + LANE_GAP) * laneIndex;
    }
    
    /**
     * 🆕 v1.1.0: 카드 인덱스로부터 Y 위치 계산
     * @param {number} cardIndex - 카드 인덱스
     * @param {number} [scrollTop=0] - 스크롤 오프셋
     * @returns {number}
     */
    calculateCardY(cardIndex, scrollTop = 0) {
        const { CARD_HEIGHT, CARD_GAP, HEADER_HEIGHT } = this._config;
        
        return HEADER_HEIGHT + (CARD_HEIGHT + CARD_GAP) * cardIndex - scrollTop;
    }
    
    /**
     * 🆕 v1.1.0: 뷰포트 내 보이는 카드 범위 계산
     * @param {number} viewportHeight - 뷰포트 높이
     * @param {number} scrollTop - 스크롤 위치
     * @param {number} totalCards - 전체 카드 수
     * @returns {Object} { startIndex, endIndex }
     */
    calculateVisibleRange(viewportHeight, scrollTop, totalCards) {
        const { CARD_HEIGHT, CARD_GAP, HEADER_HEIGHT } = this._config;
        const cardTotalHeight = CARD_HEIGHT + CARD_GAP;
        
        const startIndex = Math.max(0, 
            Math.floor((scrollTop - HEADER_HEIGHT) / cardTotalHeight)
        );
        
        const visibleCount = Math.ceil(viewportHeight / cardTotalHeight);
        const endIndex = Math.min(totalCards, startIndex + visibleCount + 2); // 버퍼 추가
        
        return { startIndex, endIndex };
    }
    
    // ─────────────────────────────────────────────────────────────
    // Private Methods
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 레인 Rect 가져오기
     * @private
     */
    _getLaneRect(laneId) {
        // 캐시 확인
        if (this._laneRectCache.has(laneId) && this._isCacheValid()) {
            return this._laneRectCache.get(laneId);
        }
        
        const lane = this.lanesMap.get(laneId);
        if (!lane || !lane.element) {
            return { x: 0, y: 0, width: 0, height: 0, scrollTop: 0 };
        }
        
        const rect = lane.element.getBoundingClientRect();
        const cardsContainer = this._getCardsContainer(lane);
        
        const laneRect = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            scrollTop: cardsContainer ? cardsContainer.scrollTop : 0
        };
        
        this._laneRectCache.set(laneId, laneRect);
        return laneRect;
    }
    
    /**
     * 카드 컨테이너 가져오기
     * @private
     */
    _getCardsContainer(lane) {
        if (!lane || !lane.element) return null;
        return lane.element.querySelector('.ranking-lane__cards-container') ||
               lane.element.querySelector('.ranking-lane__scroll-container');
    }
    
    /**
     * 카드 높이 추정
     * @private
     */
    _estimateCardHeight(lane) {
        const cardsContainer = this._getCardsContainer(lane);
        
        if (cardsContainer) {
            const firstCard = cardsContainer.querySelector('.equipment-card');
            if (firstCard) {
                return firstCard.offsetHeight;
            }
        }
        
        // 기본값 (카드 높이 추정)
        return this._config.CARD_HEIGHT || 100;
    }
    
    /**
     * 스크롤 오프셋 가져오기
     * @private
     */
    _getScrollOffset(container) {
        return container ? container.scrollTop : 0;
    }
    
    // ─────────────────────────────────────────────────────────────
    // Cache Methods
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 캐시에서 가져오기
     * @private
     */
    _getFromCache(key) {
        if (!this._isCacheValid()) {
            this._clearCache();
            return null;
        }
        
        return this._positionCache.get(key);
    }
    
    /**
     * 캐시에 저장
     * @private
     */
    _setToCache(key, value) {
        this._positionCache.set(key, value);
        this._cacheTimestamp = Date.now();
    }
    
    /**
     * 캐시 유효성 확인
     * @private
     */
    _isCacheValid() {
        return Date.now() - this._cacheTimestamp < this._config.CACHE_TTL;
    }
    
    /**
     * 캐시 초기화
     * @private
     */
    _clearCache() {
        this._positionCache.clear();
        this._laneRectCache.clear();
        this._cacheTimestamp = 0;
    }
    
    /**
     * 캐시 무효화 (외부 호출용)
     */
    invalidateCache() {
        this._clearCache();
    }
    
    // ─────────────────────────────────────────────────────────────
    // Setters / Getters
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 컨테이너 설정
     * @param {HTMLElement} container
     */
    setContainer(container) {
        this.container = container;
        this.invalidateCache();
    }
    
    /**
     * 레인 맵 설정
     * @param {Map} lanesMap
     */
    setLanesMap(lanesMap) {
        this.lanesMap = lanesMap;
        this.invalidateCache();
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
        this.invalidateCache();
    }
    
    /**
     * 🆕 v1.1.0: 현재 설정 가져오기
     * @returns {Object}
     */
    getConfig() {
        return { ...this._config };
    }
    
    // ─────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('[PositionCalculator] 🗑️ Disposing...');
        
        this._clearCache();
        this.container = null;
        this.lanesMap = null;
        
        console.log('[PositionCalculator] ✅ Disposed');
    }
}

// =========================================================================
// Default Export
// =========================================================================
export default PositionCalculator;

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.PositionCalculator = PositionCalculator;
}