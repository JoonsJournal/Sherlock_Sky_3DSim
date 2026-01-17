/**
 * RankingView.js
 * ==============
 * Ranking View 메인 컨트롤러 (Orchestrator)
 * 
 * @version 1.0.0
 * @description
 * - 6개 레인 레이아웃 관리 (Remote, Sudden Stop, Stop, Run, Idle, Wait)
 * - 레인 컴포넌트 생성 및 조율
 * - EventBus 이벤트 구독/라우팅
 * - show()/hide()/dispose() 라이프사이클 관리
 * 
 * @changelog
 * - v1.0.0: Phase 1 초기 버전
 *   - 기본 레이아웃 및 6개 레인 구조 구현
 *   - CSS 기반 스타일링
 *   - show()/hide() 라이프사이클 관리
 *   - ⚠️ 호환성: 신규 모듈
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * - RankingLane (./components/RankingLane.js) - Phase 2에서 구현
 * 
 * @exports
 * - RankingView
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/RankingView.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { eventBus } from '../../core/managers/EventBus.js';
// Phase 2에서 import 추가 예정:
// import { RankingLane } from './components/RankingLane.js';

/**
 * 레인 설정 정의
 */
const LANE_CONFIG = [
    {
        id: 'remote',
        name: 'Remote',
        icon: '🔴',
        description: 'Remote 알람 발생 설비',
        sortKey: 'duration',
        sortOrder: 'desc'
    },
    {
        id: 'sudden-stop',
        name: 'Sudden Stop',
        icon: '⚠️',
        description: '급정지 상태 설비',
        sortKey: 'duration',
        sortOrder: 'desc'
    },
    {
        id: 'stop',
        name: 'Stop',
        icon: '🛑',
        description: '정지 상태 설비',
        sortKey: 'duration',
        sortOrder: 'desc'
    },
    {
        id: 'run',
        name: 'Run',
        icon: '🟢',
        description: '가동 중 설비',
        sortKey: 'production',
        sortOrder: 'desc'
    },
    {
        id: 'idle',
        name: 'Idle',
        icon: '🟡',
        description: '대기 상태 설비',
        sortKey: 'duration',
        sortOrder: 'desc'
    },
    {
        id: 'wait',
        name: 'Wait',
        icon: '⏸️',
        description: 'Lot 없음 (비생산 대기)',
        sortKey: 'duration',
        sortOrder: 'desc'
    }
];

export class RankingView {
    /**
     * CSS 클래스 상수 정의
     */
    static CSS = {
        // Block
        BLOCK: 'ranking-view',
        
        // Elements
        LANES_CONTAINER: 'ranking-view__lanes-container',
        LOADING: 'ranking-view__loading',
        LOADING_SPINNER: 'ranking-view__loading-spinner',
        LOADING_TEXT: 'ranking-view__loading-text',
        EMPTY: 'ranking-view__empty',
        EMPTY_ICON: 'ranking-view__empty-icon',
        EMPTY_TITLE: 'ranking-view__empty-title',
        EMPTY_MESSAGE: 'ranking-view__empty-message',
        
        // Modifiers
        HIDDEN: 'ranking-view--hidden',
        LOADING_STATE: 'ranking-view--loading',
        EMPTY_STATE: 'ranking-view--empty',
        ACTIVE: 'ranking-view--active',
        
        // Legacy alias (하위 호환)
        LEGACY_HIDDEN: 'hidden',
        LEGACY_ACTIVE: 'active',
        LEGACY_LOADING: 'loading'
    };
    
    /**
     * Utility 클래스 상수
     */
    static UTIL = {
        FLEX: 'u-flex',
        FLEX_COL: 'u-flex-col',
        GAP_2: 'u-gap-2'
    };
    
    /**
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement} options.container - 부모 컨테이너
     * @param {Object} options.webSocketClient - WebSocket 클라이언트 (선택)
     */
    constructor(options = {}) {
        console.log('[RankingView] 🚀 초기화 시작...');
        
        // Options
        this._container = options.container || document.body;
        this._webSocketClient = options.webSocketClient || null;
        
        // State
        this._isVisible = false;
        this._isInitialized = false;
        this._isLoading = false;
        
        // DOM References
        this.element = null;
        this._lanesContainer = null;
        this._loadingElement = null;
        this._emptyElement = null;
        
        // Components
        this._lanes = new Map(); // Map<laneId, RankingLane>
        
        // Event Handlers (for cleanup)
        this._boundHandlers = {};
        this._eventSubscriptions = [];
        
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
        console.log('[RankingView] 📊 _init()');
        
        this._createDOM();
        this._createLanes();
        this._setupEventListeners();
        
        this._isInitialized = true;
        console.log('[RankingView] ✅ 초기화 완료');
    }
    
    /**
     * DOM 구조 생성
     * @private
     */
    _createDOM() {
        console.log('[RankingView] 🔨 _createDOM()');
        
        // Main container
        this.element = document.createElement('div');
        this.element.classList.add(RankingView.CSS.BLOCK);
        this.element.classList.add(RankingView.CSS.HIDDEN);
        this.element.classList.add(RankingView.CSS.LEGACY_HIDDEN);
        
        // Lanes container
        this._lanesContainer = document.createElement('div');
        this._lanesContainer.classList.add(RankingView.CSS.LANES_CONTAINER);
        
        // Loading state
        this._loadingElement = this._createLoadingElement();
        
        // Empty state
        this._emptyElement = this._createEmptyElement();
        
        // Assemble
        this.element.appendChild(this._lanesContainer);
        this.element.appendChild(this._loadingElement);
        this.element.appendChild(this._emptyElement);
        
        // Append to container
        this._container.appendChild(this.element);
    }
    
    /**
     * 로딩 상태 요소 생성
     * @private
     * @returns {HTMLElement}
     */
    _createLoadingElement() {
        const loading = document.createElement('div');
        loading.classList.add(RankingView.CSS.LOADING);
        
        const spinner = document.createElement('div');
        spinner.classList.add(RankingView.CSS.LOADING_SPINNER);
        
        const text = document.createElement('div');
        text.classList.add(RankingView.CSS.LOADING_TEXT);
        text.textContent = '데이터를 불러오는 중...';
        
        loading.appendChild(spinner);
        loading.appendChild(text);
        
        return loading;
    }
    
    /**
     * 빈 상태 요소 생성
     * @private
     * @returns {HTMLElement}
     */
    _createEmptyElement() {
        const empty = document.createElement('div');
        empty.classList.add(RankingView.CSS.EMPTY);
        
        const icon = document.createElement('div');
        icon.classList.add(RankingView.CSS.EMPTY_ICON);
        icon.textContent = '📭';
        
        const title = document.createElement('div');
        title.classList.add(RankingView.CSS.EMPTY_TITLE);
        title.textContent = '표시할 설비가 없습니다';
        
        const message = document.createElement('div');
        message.classList.add(RankingView.CSS.EMPTY_MESSAGE);
        message.textContent = '모니터링 데이터를 수신하면 설비가 표시됩니다.';
        
        empty.appendChild(icon);
        empty.appendChild(title);
        empty.appendChild(message);
        
        return empty;
    }
    
    /**
     * 6개 레인 생성
     * @private
     */
    _createLanes() {
        console.log('[RankingView] 🏗️ _createLanes() - 6개 레인 생성');
        
        LANE_CONFIG.forEach(config => {
            // Phase 1: 간단한 placeholder 레인 생성
            // Phase 2에서 RankingLane 컴포넌트로 교체
            const laneElement = this._createPlaceholderLane(config);
            this._lanesContainer.appendChild(laneElement);
            
            // 레인 참조 저장 (Phase 2에서 RankingLane 인스턴스로 교체)
            this._lanes.set(config.id, {
                config,
                element: laneElement,
                cards: []
            });
        });
        
        console.log(`[RankingView] ✅ ${this._lanes.size}개 레인 생성 완료`);
    }
    
    /**
     * Placeholder 레인 생성 (Phase 1용)
     * Phase 2에서 RankingLane 컴포넌트로 교체됨
     * @private
     * @param {Object} config - 레인 설정
     * @returns {HTMLElement}
     */
    _createPlaceholderLane(config) {
        const lane = document.createElement('div');
        lane.classList.add('ranking-lane');
        lane.classList.add(`ranking-lane--${config.id}`);
        lane.dataset.laneId = config.id;
        
        // Header
        const header = document.createElement('div');
        header.classList.add('lane-header');
        header.classList.add(`lane-header--${config.id}`);
        
        // Title Row
        const titleRow = document.createElement('div');
        titleRow.classList.add('lane-header__title-row');
        
        const icon = document.createElement('span');
        icon.classList.add('lane-header__icon');
        icon.textContent = config.icon;
        
        const title = document.createElement('span');
        title.classList.add('lane-header__title');
        title.textContent = config.name;
        
        const count = document.createElement('span');
        count.classList.add('lane-header__count');
        count.textContent = '0';
        count.dataset.countElement = 'true';
        
        titleRow.appendChild(icon);
        titleRow.appendChild(title);
        titleRow.appendChild(count);
        
        // Stats
        const stats = document.createElement('div');
        stats.classList.add('lane-header__stats');
        
        // Avg Stat
        const avgStat = this._createStatElement(
            config.sortKey === 'production' ? '📦' : '⏱️',
            'Avg',
            config.sortKey === 'production' ? '0' : '00:00'
        );
        avgStat.classList.add('lane-header__stat--avg');
        
        // Max Stat
        const maxStat = this._createStatElement(
            '📊',
            'Max',
            config.sortKey === 'production' ? '0' : '00:00'
        );
        maxStat.classList.add('lane-header__stat--max');
        
        stats.appendChild(avgStat);
        stats.appendChild(maxStat);
        
        header.appendChild(titleRow);
        header.appendChild(stats);
        
        // Scroll Container
        const scrollContainer = document.createElement('div');
        scrollContainer.classList.add('ranking-lane__scroll-container');
        
        // Cards Container
        const cardsContainer = document.createElement('div');
        cardsContainer.classList.add('ranking-lane__cards-container');
        cardsContainer.dataset.cardsContainer = 'true';
        
        // Empty Message
        const emptyMsg = document.createElement('div');
        emptyMsg.classList.add('ranking-lane__empty-message');
        
        const emptyIcon = document.createElement('div');
        emptyIcon.classList.add('ranking-lane__empty-icon');
        emptyIcon.textContent = '✓';
        
        const emptyText = document.createElement('div');
        emptyText.classList.add('ranking-lane__empty-text');
        emptyText.textContent = config.id === 'run' 
            ? '가동 중인 설비 없음' 
            : '해당 상태 설비 없음';
        
        emptyMsg.appendChild(emptyIcon);
        emptyMsg.appendChild(emptyText);
        cardsContainer.appendChild(emptyMsg);
        
        scrollContainer.appendChild(cardsContainer);
        
        lane.appendChild(header);
        lane.appendChild(scrollContainer);
        
        return lane;
    }
    
    /**
     * 통계 요소 생성 헬퍼
     * @private
     */
    _createStatElement(iconText, label, value) {
        const stat = document.createElement('div');
        stat.classList.add('lane-header__stat');
        
        const icon = document.createElement('span');
        icon.classList.add('lane-header__stat-icon');
        icon.textContent = iconText;
        
        const labelEl = document.createElement('span');
        labelEl.classList.add('lane-header__stat-label');
        labelEl.textContent = `${label}:`;
        
        const valueEl = document.createElement('span');
        valueEl.classList.add('lane-header__stat-value');
        valueEl.textContent = value;
        valueEl.dataset.statValue = label.toLowerCase();
        
        stat.appendChild(icon);
        stat.appendChild(labelEl);
        stat.appendChild(valueEl);
        
        return stat;
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        console.log('[RankingView] 🔗 _setupEventListeners()');
        
        // Bind handlers for cleanup
        this._boundHandlers.onKeyDown = this._handleKeyDown.bind(this);
        this._boundHandlers.onResize = this._handleResize.bind(this);
        this._boundHandlers.onLaneClick = this._handleLaneClick.bind(this);
        
        // DOM Events
        document.addEventListener('keydown', this._boundHandlers.onKeyDown);
        window.addEventListener('resize', this._boundHandlers.onResize);
        this._lanesContainer.addEventListener('click', this._boundHandlers.onLaneClick);
        
        // EventBus Subscriptions
        // Phase 3에서 WebSocket 이벤트 연결 예정
        this._eventSubscriptions.push(
            eventBus.on('ranking:show', () => this.show()),
            eventBus.on('ranking:hide', () => this.hide()),
            eventBus.on('submenu:ranking-view:activate', () => this.show()),
            eventBus.on('submenu:ranking-view:deactivate', () => this.hide())
        );
        
        console.log('[RankingView] ✅ 이벤트 리스너 설정 완료');
    }
    
    // =========================================
    // Public Methods
    // =========================================
    
    /**
     * Ranking View 표시
     */
    show() {
        if (this._isVisible) {
            console.log('[RankingView] ⚠️ 이미 표시 중');
            return;
        }
        
        console.log('[RankingView] 👁️ show()');
        
        this.element.classList.remove(RankingView.CSS.HIDDEN);
        this.element.classList.remove(RankingView.CSS.LEGACY_HIDDEN);
        this.element.classList.add(RankingView.CSS.ACTIVE);
        this.element.classList.add(RankingView.CSS.LEGACY_ACTIVE);
        
        this._isVisible = true;
        
        // Emit event
        eventBus.emit('ranking:shown');
        
        console.log('[RankingView] ✅ 표시됨');
    }
    
    /**
     * Ranking View 숨김
     */
    hide() {
        if (!this._isVisible) {
            console.log('[RankingView] ⚠️ 이미 숨김 상태');
            return;
        }
        
        console.log('[RankingView] 🙈 hide()');
        
        this.element.classList.add(RankingView.CSS.HIDDEN);
        this.element.classList.add(RankingView.CSS.LEGACY_HIDDEN);
        this.element.classList.remove(RankingView.CSS.ACTIVE);
        this.element.classList.remove(RankingView.CSS.LEGACY_ACTIVE);
        
        this._isVisible = false;
        
        // Emit event
        eventBus.emit('ranking:hidden');
        
        console.log('[RankingView] ✅ 숨겨짐');
    }
    
    /**
     * 표시/숨김 토글
     */
    toggle() {
        if (this._isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * 로딩 상태 설정
     * @param {boolean} isLoading
     */
    setLoading(isLoading) {
        console.log(`[RankingView] ⏳ setLoading(${isLoading})`);
        
        this._isLoading = isLoading;
        
        if (isLoading) {
            this.element.classList.add(RankingView.CSS.LOADING_STATE);
            this.element.classList.add(RankingView.CSS.LEGACY_LOADING);
        } else {
            this.element.classList.remove(RankingView.CSS.LOADING_STATE);
            this.element.classList.remove(RankingView.CSS.LEGACY_LOADING);
        }
    }
    
    /**
     * 빈 상태 설정
     * @param {boolean} isEmpty
     */
    setEmpty(isEmpty) {
        console.log(`[RankingView] 📭 setEmpty(${isEmpty})`);
        
        if (isEmpty) {
            this.element.classList.add(RankingView.CSS.EMPTY_STATE);
        } else {
            this.element.classList.remove(RankingView.CSS.EMPTY_STATE);
        }
    }
    
    /**
     * 레인 수 업데이트 (테스트용)
     * @param {string} laneId
     * @param {number} count
     */
    updateLaneCount(laneId, count) {
        const lane = this._lanes.get(laneId);
        if (!lane) return;
        
        const countEl = lane.element.querySelector('[data-count-element]');
        if (countEl) {
            countEl.textContent = count.toString();
        }
    }
    
    /**
     * 가시성 상태
     * @returns {boolean}
     */
    get isVisible() {
        return this._isVisible;
    }
    
    /**
     * 리소스 정리 및 제거
     */
    dispose() {
        console.log('[RankingView] 🗑️ dispose() - 정리 시작...');
        
        // 1. DOM 이벤트 리스너 제거
        document.removeEventListener('keydown', this._boundHandlers.onKeyDown);
        window.removeEventListener('resize', this._boundHandlers.onResize);
        this._lanesContainer?.removeEventListener('click', this._boundHandlers.onLaneClick);
        
        // 2. EventBus 구독 해제
        this._eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventSubscriptions = [];
        
        // 3. 레인 컴포넌트 정리 (Phase 2에서 확장)
        this._lanes.forEach((lane, id) => {
            // Phase 2: lane.component?.dispose();
        });
        this._lanes.clear();
        
        // 4. DOM 요소 제거
        this.element?.remove();
        
        // 5. 참조 해제
        this.element = null;
        this._lanesContainer = null;
        this._loadingElement = null;
        this._emptyElement = null;
        this._boundHandlers = {};
        this._isInitialized = false;
        
        console.log('[RankingView] ✅ dispose 완료');
    }
    
    // =========================================
    // Event Handlers
    // =========================================
    
    /**
     * 키보드 이벤트 처리
     * @private
     */
    _handleKeyDown(event) {
        if (!this._isVisible) return;
        
        // Phase 5에서 상세 구현 예정
        switch (event.key) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                // 레인 포커스 이동
                this._focusLane(parseInt(event.key) - 1);
                break;
            case 'Escape':
                // 3D View로 복귀
                eventBus.emit('ranking:escape');
                break;
        }
    }
    
    /**
     * 레인 포커스
     * @private
     */
    _focusLane(index) {
        const laneIds = Array.from(this._lanes.keys());
        if (index < 0 || index >= laneIds.length) return;
        
        const laneId = laneIds[index];
        const lane = this._lanes.get(laneId);
        
        // 모든 레인에서 focused 제거
        this._lanes.forEach(l => {
            l.element.classList.remove('ranking-lane--focused');
        });
        
        // 선택된 레인에 focused 추가
        lane.element.classList.add('ranking-lane--focused');
        lane.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        
        console.log(`[RankingView] 🎯 레인 포커스: ${laneId}`);
    }
    
    /**
     * 리사이즈 이벤트 처리
     * @private
     */
    _handleResize() {
        // Phase 7에서 반응형 최적화 구현
    }
    
    /**
     * 레인 클릭 이벤트 처리
     * @private
     */
    _handleLaneClick(event) {
        // Phase 2에서 카드 클릭 처리 구현
        const card = event.target.closest('.equipment-card');
        if (card) {
            const equipmentId = card.dataset.equipmentId;
            console.log(`[RankingView] 🖱️ 카드 클릭: ${equipmentId}`);
            
            // EventBus로 선택 이벤트 발행
            eventBus.emit('equipment:select', {
                equipmentId,
                source: 'ranking-view'
            });
        }
    }
    
    // =========================================
    // Debug Methods
    // =========================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('[RankingView] Debug Info');
        console.log('isVisible:', this._isVisible);
        console.log('isInitialized:', this._isInitialized);
        console.log('isLoading:', this._isLoading);
        console.log('레인 수:', this._lanes.size);
        console.log('레인 목록:', Array.from(this._lanes.keys()));
        console.groupEnd();
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.RankingView = RankingView;
}