/**
 * RankingView.js
 * ==============
 * Ranking View 메인 컨트롤러 (Orchestrator)
 * 
 * @version 1.3.0
 * @description
 * - 6개 레인 레이아웃 관리 (Remote, Sudden Stop, Stop, Run, Idle, Wait)
 * - 레인 컴포넌트 생성 및 조율
 * - EventBus 이벤트 구독/라우팅
 * - show()/hide()/dispose() 라이프사이클 관리
 * - Equipment Info Drawer 연동
 * - CameraNavigator 가시성 제어 (3D View 전용)
 * 
 * @changelog
 * - v1.3.0: 🆕 Phase 5 - LaneManager 통합
 *   - LaneManager 인스턴스 생성 및 관리
 *   - 키보드 네비게이션 개선 (1-6, 방향키)
 *   - EventBus 이벤트 핸들러 확장
 *   - show()/hide()에서 LaneManager activate/deactivate
 *   - ⚠️ 호환성: 기존 모든 기능 100% 유지
 * - v1.2.0: CameraNavigator 가시성 제어 추가
 *   - show() 시 CameraNavigator 숨김
 *   - hide() 시 CameraNavigator 표시 (3D View 활성 시에만)
 *   - _setCameraNavigatorVisible() 헬퍼 메서드 추가
 * - v1.1.0: Phase 2 업데이트
 *   - RankingLane 컴포넌트 사용
 *   - EquipmentCard 연동
 *   - EventBus 'equipment:select' 이벤트 연결
 *   - Equipment Info Drawer 연동
 * - v1.0.0: Phase 1 초기 버전
 *   - 기본 레이아웃 및 6개 레인 구조 구현
 *   - CSS 기반 스타일링
 *   - show()/hide() 라이프사이클 관리
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * - RankingLane (./components/RankingLane.js)
 * - EquipmentCard (./components/EquipmentCard.js)
 * - LaneManager (./managers/LaneManager.js) 🆕 v1.3.0
 * 
 * @exports
 * - RankingView
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/RankingView.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { eventBus } from '../../core/managers/EventBus.js';
import { RankingLane } from './components/RankingLane.js';
import { EquipmentCard } from './components/EquipmentCard.js';
// 🆕 v1.3.0: LaneManager import
import { LaneManager } from './managers/LaneManager.js';

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
        console.log('[RankingView] 🚀 초기화 시작 (v1.3.0 - Phase 5 LaneManager 통합)...');
        
        // Options
        this._container = options.container || document.body;
        this._webSocketClient = options.webSocketClient || null;
        
        // State
        this._isVisible = false;
        this._isInitialized = false;
        this._isLoading = false;
        this._selectedEquipmentId = null;
        this._focusedLaneIndex = 0;
        
        // 🆕 v1.2.0: CameraNavigator 이전 가시성 상태 저장
        this._cameraNavigatorWasVisible = true;
        
        // DOM References
        this.element = null;
        this._lanesContainer = null;
        this._loadingElement = null;
        this._emptyElement = null;
        
        // Components
        this._lanes = new Map(); // Map<laneId, RankingLane>
        
        // 🆕 v1.3.0: LaneManager 인스턴스
        this._laneManager = null;
        
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
        this._createLaneManager();  // 🆕 v1.3.0
        this._setupEventListeners();
        
        this._isInitialized = true;
        console.log('[RankingView] ✅ 초기화 완료 (v1.3.0)');
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
     * 6개 레인 생성 (Phase 2: RankingLane 컴포넌트 사용)
     * @private
     */
    _createLanes() {
        console.log('[RankingView] 🏗️ _createLanes() - 6개 레인 생성 (RankingLane 컴포넌트)');
        
        LANE_CONFIG.forEach(config => {
            // RankingLane 컴포넌트 생성
            const lane = new RankingLane(config);
            
            // DOM에 추가
            this._lanesContainer.appendChild(lane.element);
            
            // 레인 참조 저장
            this._lanes.set(config.id, lane);
        });
        
        console.log(`[RankingView] ✅ ${this._lanes.size}개 레인 생성 완료`);
    }
    
    /**
     * 🆕 v1.3.0: LaneManager 생성
     * @private
     */
    _createLaneManager() {
        console.log('[RankingView] 🎯 _createLaneManager() - LaneManager 생성');
        
        this._laneManager = new LaneManager({
            lanes: this._lanes,
            onCardSelect: (data) => this._handleLaneManagerCardSelect(data)
        });
        
        console.log('[RankingView] ✅ LaneManager 생성 완료');
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
        this._boundHandlers.onEquipmentSelect = this._handleEquipmentSelect.bind(this);
        
        // DOM Events
        document.addEventListener('keydown', this._boundHandlers.onKeyDown);
        window.addEventListener('resize', this._boundHandlers.onResize);
        
        // EventBus Subscriptions
        this._eventSubscriptions.push(
            // Ranking View 토글
            eventBus.on('ranking:show', () => this.show()),
            eventBus.on('ranking:hide', () => this.hide()),
            eventBus.on('submenu:ranking-view:activate', () => this.show()),
            eventBus.on('submenu:ranking-view:deactivate', () => this.hide()),
            
            // 설비 선택 이벤트 (Phase 2: Drawer 연동)
            eventBus.on('equipment:select', this._boundHandlers.onEquipmentSelect),
            
            // WebSocket 데이터 이벤트 (Phase 3에서 확장)
            eventBus.on('websocket:equipment:status', (data) => this._handleStatusChange(data)),
            
            // 🆕 v1.3.0: 레인 포커스 이벤트 (KeyboardManager에서 발행)
            eventBus.on('ranking:lane:focus', (data) => {
                if (this._laneManager && data.laneIndex !== undefined) {
                    this._laneManager.focusLane(data.laneIndex);
                }
            }),
            eventBus.on('ranking:lane:previous', () => {
                if (this._laneManager) this._laneManager.focusPreviousLane();
            }),
            eventBus.on('ranking:lane:next', () => {
                if (this._laneManager) this._laneManager.focusNextLane();
            }),
            eventBus.on('ranking:card:previous', () => {
                if (this._laneManager) this._laneManager.selectPreviousCard();
            }),
            eventBus.on('ranking:card:next', () => {
                if (this._laneManager) this._laneManager.selectNextCard();
            }),
            eventBus.on('ranking:card:detail', () => {
                if (this._laneManager) this._laneManager.showSelectedCardDetail();
            })
        );
        
        console.log('[RankingView] ✅ 이벤트 리스너 설정 완료');
    }
    
    // =========================================
    // 🆕 v1.2.0: CameraNavigator 제어
    // =========================================
    
    /**
     * CameraNavigator 가시성 설정
     * @private
     * @param {boolean} visible - 표시 여부
     */
    _setCameraNavigatorVisible(visible) {
        // 방법 1: 전역 window.cameraNavigator 사용
        if (window.cameraNavigator?.setVisible) {
            window.cameraNavigator.setVisible(visible);
            console.log(`[RankingView] 📐 CameraNavigator ${visible ? '표시' : '숨김'} (window.cameraNavigator)`);
            return;
        }
        
        // 방법 2: window.services.scene.cameraNavigator 사용
        if (window.services?.scene?.cameraNavigator?.setVisible) {
            window.services.scene.cameraNavigator.setVisible(visible);
            console.log(`[RankingView] 📐 CameraNavigator ${visible ? '표시' : '숨김'} (services.scene)`);
            return;
        }
        
        // 방법 3: DOM 직접 접근 (폴백)
        const navigatorEl = document.getElementById('camera-navigator');
        if (navigatorEl) {
            navigatorEl.style.display = visible ? 'block' : 'none';
            console.log(`[RankingView] 📐 CameraNavigator ${visible ? '표시' : '숨김'} (DOM 직접)`);
            return;
        }
        
        console.log('[RankingView] ⚠️ CameraNavigator를 찾을 수 없음');
    }
    
    /**
     * CameraNavigator 현재 가시성 상태 확인
     * @private
     * @returns {boolean}
     */
    _getCameraNavigatorVisible() {
        // 전역 접근
        if (window.cameraNavigator?.navContainer) {
            return window.cameraNavigator.navContainer.style.display !== 'none';
        }
        
        if (window.services?.scene?.cameraNavigator?.navContainer) {
            return window.services.scene.cameraNavigator.navContainer.style.display !== 'none';
        }
        
        // DOM 직접 접근
        const navigatorEl = document.getElementById('camera-navigator');
        if (navigatorEl) {
            return navigatorEl.style.display !== 'none';
        }
        
        return true; // 기본값
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
        
        // 🆕 v1.2.0: CameraNavigator 현재 상태 저장 후 숨김
        this._cameraNavigatorWasVisible = this._getCameraNavigatorVisible();
        this._setCameraNavigatorVisible(false);
        
        this.element.classList.remove(RankingView.CSS.HIDDEN);
        this.element.classList.remove(RankingView.CSS.LEGACY_HIDDEN);
        this.element.classList.add(RankingView.CSS.ACTIVE);
        this.element.classList.add(RankingView.CSS.LEGACY_ACTIVE);
        
        this._isVisible = true;
        
        // 🆕 v1.3.0: LaneManager 활성화
        if (this._laneManager) {
            this._laneManager.activate();
        }
        
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
        
        // 🆕 v1.3.0: LaneManager 비활성화
        if (this._laneManager) {
            this._laneManager.deactivate();
        }
        
        // 🆕 v1.2.0: CameraNavigator 이전 상태로 복원
        // 3D View가 활성화된 경우에만 표시
        if (this._cameraNavigatorWasVisible) {
            const threejsContainer = document.getElementById('threejs-container');
            const is3DViewActive = threejsContainer && threejsContainer.classList.contains('active');
            
            if (is3DViewActive) {
                this._setCameraNavigatorVisible(true);
            }
        }
        
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
     * 설비 카드 추가
     * @param {string} laneId - 레인 ID
     * @param {Object} data - 설비 데이터
     * @returns {EquipmentCard|null}
     */
    addEquipment(laneId, data) {
        const lane = this._lanes.get(laneId);
        if (!lane) {
            console.warn(`[RankingView] ⚠️ 레인을 찾을 수 없음: ${laneId}`);
            return null;
        }
        
        const card = lane.addCard(data);
        this.setEmpty(false);
        
        console.log(`[RankingView] ➕ 설비 추가: ${data.frontendId} → ${laneId}`);
        return card;
    }
    
    /**
     * 설비 카드 제거
     * @param {string} laneId - 레인 ID
     * @param {string} equipmentId - 설비 ID
     */
    removeEquipment(laneId, equipmentId) {
        const lane = this._lanes.get(laneId);
        if (lane) {
            lane.removeCard(equipmentId);
            console.log(`[RankingView] ➖ 설비 제거: ${equipmentId} from ${laneId}`);
            
            // 전체 빈 상태 확인
            this._checkEmpty();
        }
    }
    
    /**
     * 설비 카드 업데이트
     * @param {string} laneId - 레인 ID
     * @param {string} equipmentId - 설비 ID
     * @param {Object} newData - 새 데이터
     */
    updateEquipment(laneId, equipmentId, newData) {
        const lane = this._lanes.get(laneId);
        if (lane) {
            lane.updateCard(equipmentId, newData);
        }
    }
    
    /**
     * 레인 가져오기
     * @param {string} laneId
     * @returns {RankingLane|undefined}
     */
    getLane(laneId) {
        return this._lanes.get(laneId);
    }
    
    /**
     * 모든 레인 가져오기
     * @returns {Map<string, RankingLane>}
     */
    getAllLanes() {
        return new Map(this._lanes);
    }
    
    /**
     * 🆕 v1.3.0: LaneManager 인스턴스 가져오기
     * @returns {LaneManager|null}
     */
    getLaneManager() {
        return this._laneManager;
    }
    
    /**
     * 가시성 상태
     * @returns {boolean}
     */
    get isVisible() {
        return this._isVisible;
    }
    
    /**
     * 선택된 설비 ID
     * @returns {string|null}
     */
    get selectedEquipmentId() {
        return this._selectedEquipmentId;
    }
    
    /**
     * 리소스 정리 및 제거
     */
    dispose() {
        console.log('[RankingView] 🗑️ dispose() - 정리 시작...');
        
        // 1. DOM 이벤트 리스너 제거
        document.removeEventListener('keydown', this._boundHandlers.onKeyDown);
        window.removeEventListener('resize', this._boundHandlers.onResize);
        
        // 2. EventBus 구독 해제
        this._eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventSubscriptions = [];
        
        // 3. 🆕 v1.3.0: LaneManager 정리
        if (this._laneManager) {
            this._laneManager.dispose();
            this._laneManager = null;
        }
        
        // 4. 레인 컴포넌트 정리
        this._lanes.forEach((lane, id) => {
            lane.dispose();
        });
        this._lanes.clear();
        
        // 5. 🆕 v1.2.0: CameraNavigator 가시성 복원
        if (this._cameraNavigatorWasVisible) {
            this._setCameraNavigatorVisible(true);
        }
        
        // 6. DOM 요소 제거
        this.element?.remove();
        
        // 7. 참조 해제
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
     * 설비 선택 이벤트 처리 (Phase 2: Drawer 연동)
     * @private
     */
    _handleEquipmentSelect(data) {
        if (!this._isVisible) return;
        
        const { equipmentId, frontendId, source } = data;
        
        console.log(`[RankingView] 🎯 설비 선택: ${frontendId || equipmentId} (source: ${source})`);
        
        // 이전 선택 해제
        this._clearSelection();
        
        // 새 선택 설정
        this._selectedEquipmentId = equipmentId || frontendId;
        
        // 카드 선택 상태 업데이트
        this._lanes.forEach(lane => {
            const card = lane.getCard(this._selectedEquipmentId);
            if (card) {
                card.setSelected(true);
            }
        });
        
        // Equipment Info Drawer에 데이터 전달 (source가 ranking-view인 경우)
        if (source === 'ranking-view' && data.cardData) {
            // EquipmentInfoPanel.show()에 전달할 데이터 포맷
            const panelData = {
                id: frontendId,
                frontendId: frontendId,
                equipmentId: equipmentId,
                ...data.cardData
            };
            
            // Drawer 표시를 위한 이벤트 발행
            eventBus.emit('equipment:detail:show', panelData);
        }
    }
    
    /**
     * 🆕 v1.3.0: LaneManager에서 카드 선택 시 호출
     * @private
     */
    _handleLaneManagerCardSelect(data) {
        const { equipmentId, frontendId, laneId, cardIndex } = data;
        
        console.log(`[RankingView] 🎯 LaneManager 카드 선택: ${frontendId} (lane: ${laneId}, index: ${cardIndex})`);
        
        // 선택 상태 업데이트
        this._selectedEquipmentId = equipmentId || frontendId;
    }
    
    /**
     * 선택 해제
     * @private
     */
    _clearSelection() {
        this._lanes.forEach(lane => {
            lane.getAllCards().forEach(card => {
                card.setSelected(false);
            });
        });
        this._selectedEquipmentId = null;
    }
    
    /**
     * 키보드 이벤트 처리
     * @private
     */
    _handleKeyDown(event) {
        if (!this._isVisible) return;
        
        // 🆕 v1.3.0: LaneManager가 있으면 대부분의 키 처리를 위임
        // LaneManager가 없는 경우에만 직접 처리
        if (this._laneManager && this._laneManager.isActive) {
            // LaneManager가 활성화되어 있으면 키 이벤트는 
            // KeyboardManager → LaneManager 경로로 처리됨
            // 여기서는 Escape만 추가 처리
            if (event.key === 'Escape') {
                event.preventDefault();
                eventBus.emit('ranking:escape');
                this.hide();
                eventBus.emit('mode:3d-view');
            }
            return;
        }
        
        // LaneManager가 없는 경우 (폴백) - 기존 로직 유지
        const laneIds = Array.from(this._lanes.keys());
        
        switch (event.key) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                // 레인 포커스 이동
                event.preventDefault();
                this._focusLane(parseInt(event.key) - 1);
                break;
                
            case 'ArrowLeft':
                // 이전 레인으로 이동
                event.preventDefault();
                this._focusLane(Math.max(0, this._focusedLaneIndex - 1));
                break;
                
            case 'ArrowRight':
                // 다음 레인으로 이동
                event.preventDefault();
                this._focusLane(Math.min(laneIds.length - 1, this._focusedLaneIndex + 1));
                break;
                
            case 'ArrowUp':
                // 현재 레인에서 이전 카드 선택
                event.preventDefault();
                break;
                
            case 'ArrowDown':
                // 현재 레인에서 다음 카드 선택
                event.preventDefault();
                break;
                
            case 'Enter':
                // 선택된 카드 상세 보기
                event.preventDefault();
                if (this._selectedEquipmentId) {
                    eventBus.emit('equipment:detail:show', {
                        id: this._selectedEquipmentId,
                        frontendId: this._selectedEquipmentId
                    });
                }
                break;
                
            case 'Escape':
                // 3D View로 복귀
                event.preventDefault();
                eventBus.emit('ranking:escape');
                this.hide();
                eventBus.emit('mode:3d-view');
                break;
        }
    }
    
    /**
     * 레인 포커스 (폴백용 - LaneManager가 없는 경우)
     * @private
     * @param {number} index
     */
    _focusLane(index) {
        const laneIds = Array.from(this._lanes.keys());
        if (index < 0 || index >= laneIds.length) return;
        
        // 모든 레인에서 포커스 제거
        this._lanes.forEach(lane => {
            lane.setFocused(false);
        });
        
        // 선택된 레인에 포커스 추가
        const laneId = laneIds[index];
        const lane = this._lanes.get(laneId);
        lane.setFocused(true);
        
        this._focusedLaneIndex = index;
        
        console.log(`[RankingView] 🎯 레인 포커스: ${laneId} (index: ${index})`);
    }
    
    /**
     * 상태 변경 이벤트 처리 (Phase 3에서 확장)
     * @private
     */
    _handleStatusChange(data) {
        // Phase 3에서 구현 예정
        // 레인 간 이동 로직
    }
    
    /**
     * 리사이즈 이벤트 처리
     * @private
     */
    _handleResize() {
        // Phase 7에서 반응형 최적화 구현
    }
    
    /**
     * 전체 빈 상태 확인
     * @private
     */
    _checkEmpty() {
        let totalCount = 0;
        this._lanes.forEach(lane => {
            totalCount += lane.count;
        });
        
        this.setEmpty(totalCount === 0);
    }
    
    // =========================================
    // Debug Methods
    // =========================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('[RankingView] Debug Info (v1.3.0)');
        console.log('isVisible:', this._isVisible);
        console.log('isInitialized:', this._isInitialized);
        console.log('isLoading:', this._isLoading);
        console.log('selectedEquipmentId:', this._selectedEquipmentId);
        console.log('focusedLaneIndex:', this._focusedLaneIndex);
        console.log('cameraNavigatorWasVisible:', this._cameraNavigatorWasVisible);
        console.log('laneManager:', this._laneManager ? 'connected' : 'null');
        console.log('레인 수:', this._lanes.size);
        console.log('레인 목록:');
        this._lanes.forEach((lane, id) => {
            console.log(`  ${id}: ${lane.count} cards`);
        });
        if (this._laneManager) {
            console.log('--- LaneManager Debug ---');
            this._laneManager.debug();
        }
        console.groupEnd();
    }
    
    /**
     * 테스트 데이터 추가 (개발용)
     */
    addTestData() {
        console.log('[RankingView] 🧪 테스트 데이터 추가...');
        
        // Remote 레인 테스트 데이터
        this.addEquipment('remote', {
            equipmentId: 'EQ001',
            frontendId: 'EQ-17-01',
            equipmentName: '설비 17-01',
            status: 'SUDDENSTOP',
            occurredAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20분 전
            alarmCode: 10047,
            alarmMessage: 'BLADE BROKEN',
            alarmRepeatCount: 3,
            productionCount: 45,
            targetCount: 100
        });
        
        // Sudden Stop 레인 테스트 데이터
        this.addEquipment('sudden-stop', {
            equipmentId: 'EQ002',
            frontendId: 'EQ-17-02',
            equipmentName: '설비 17-02',
            status: 'SUDDENSTOP',
            occurredAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8분 전
            alarmCode: 1234,
            alarmMessage: 'SENSOR ERROR',
            productionCount: 72,
            targetCount: 100
        });
        
        // Run 레인 테스트 데이터
        this.addEquipment('run', {
            equipmentId: 'EQ003',
            frontendId: 'EQ-17-03',
            equipmentName: '설비 17-03',
            status: 'RUN',
            occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
            productionCount: 95,
            targetCount: 100,
            lotStartTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        });
        
        this.addEquipment('run', {
            equipmentId: 'EQ004',
            frontendId: 'EQ-17-04',
            equipmentName: '설비 17-04',
            status: 'RUN',
            occurredAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30분 전
            productionCount: 67,
            targetCount: 100,
            lotStartTime: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        });
        
        // Stop 레인 테스트 데이터
        this.addEquipment('stop', {
            equipmentId: 'EQ005',
            frontendId: 'EQ-17-05',
            equipmentName: '설비 17-05',
            status: 'STOP',
            occurredAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12분 전
            productionCount: 33,
            targetCount: 100
        });
        
        // Idle 레인 테스트 데이터
        this.addEquipment('idle', {
            equipmentId: 'EQ006',
            frontendId: 'EQ-17-06',
            equipmentName: '설비 17-06',
            status: 'IDLE',
            occurredAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3분 전
            productionCount: 88,
            targetCount: 100
        });
        
        // Wait 레인 테스트 데이터
        this.addEquipment('wait', {
            equipmentId: 'EQ007',
            frontendId: 'EQ-17-07',
            equipmentName: '설비 17-07',
            status: 'WAIT',
            occurredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25분 전
            productionCount: 0,
            targetCount: 0
        });
        
        console.log('[RankingView] ✅ 테스트 데이터 추가 완료');
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.RankingView = RankingView;
}