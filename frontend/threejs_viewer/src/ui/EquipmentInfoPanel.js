/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Coordinator)
 * 
 * @version 6.1.0
 * @description
 * - 🆕 v6.1.0: SubscriptionLevelManager 연동 (2026-02-04)
 *   - Panel 열림/닫힘 시 EventBus 이벤트 발행
 *   - 'panel:opened', 'panel:closed' 이벤트로 구독 레벨 자동 전환
 *   - 선택 설비만 DETAILED 레벨로 구독 (대역폭 94% 절감)
 * - v6.0.0: 대규모 리팩토링 (2026-01-25)
 *   - PanelCSSConstants.js로 CSS 상수 분리
 *   - DrawerAnimationManager.js로 애니메이션 로직 분리
 *   - SelectionHandler.js로 Selection 처리 로직 분리
 *   - Coordinator 역할에 집중 (~200줄)
 *   - ⚠️ 호환성: 기존 모든 공개 API 100% 유지
 * - v5.2.0: EventBus 구독 추가 (2026-01-18)
 * - v5.1.0: PanelManager 연동 (2026-01-18)
 * - v5.0.0: Equipment Drawer Integration
 * - v4.0.0: Phase 4 CSS Integration
 * - v3.6.0: 최종 슬림화 (~280줄)
 * 
 * @dependencies
 * - ./equipment-info/constants/PanelCSSConstants.js
 * - ./equipment-info/managers/DrawerAnimationManager.js
 * - ./equipment-info/managers/SelectionHandler.js
 * - ./equipment-info/panelTemplate.js
 * - ./equipment-info/components/HeaderStatus.js
 * - ./equipment-info/tabs/GeneralTab.js
 * - ./equipment-info/tabs/PCInfoTab.js
 * - ./equipment-info/utils/DataCache.js
 * - ../core/navigation/index.js (PanelManager)
 * - ../core/managers/EventBus.js
 * 
 * @exports
 * - EquipmentInfoPanel
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/EquipmentInfoPanel.js
 * 작성일: 2026-01-06
 * 수정일: 2026-02-04
 */

import { debugLog } from '../core/utils/Config.js';
import { equipmentDetailApi } from '../api/equipmentDetailApi.js';

// 분리된 모듈 Import
import { PANEL_CSS, PANEL_UTIL, PANEL_ANIMATION } from './equipment-info/constants/PanelCSSConstants.js';
import { DrawerAnimationManager } from './equipment-info/managers/DrawerAnimationManager.js';
import { SelectionHandler } from './equipment-info/managers/SelectionHandler.js';

// 기존 컴포넌트 Import
import { DataCache } from './equipment-info/utils/DataCache.js';
import { HeaderStatus } from './equipment-info/components/HeaderStatus.js';
import { GeneralTab } from './equipment-info/tabs/GeneralTab.js';
import { PCInfoTab } from './equipment-info/tabs/PCInfoTab.js';
import { DOM_IDS, TAB_NAMES, getPanelTemplate, getDOMReferences } from './equipment-info/panelTemplate.js';

// PanelManager 연동
import { panelManager, PANEL_TYPE } from '../core/navigation/index.js';

// EventBus 구독
import { eventBus } from '../core/managers/EventBus.js';

// ============================================
// 🆕 v6.1.0: Panel EventBus 이벤트 상수
// ============================================

/**
 * Panel 관련 EventBus 이벤트 상수
 * @readonly
 */
const PANEL_EVENTS = Object.freeze({
    /** Panel 열림 이벤트 - SubscriptionLevelManager가 수신 */
    OPENED: 'panel:opened',
    
    /** Panel 닫힘 이벤트 - SubscriptionLevelManager가 수신 */
    CLOSED: 'panel:closed',
    
    /** Selection 변경 이벤트 - SubscriptionLevelManager가 수신 */
    SELECTION_CHANGED: 'equipment:selection-changed'
});

/**
 * 설비 상세 정보 패널 클래스 (Coordinator)
 */
export class EquipmentInfoPanel {
    // =========================================================================
    // Static 상수 (하위 호환 - 분리된 모듈에서 재export)
    // =========================================================================
    
    /** @deprecated PANEL_CSS 사용 권장 */
    static CSS = PANEL_CSS;
    
    /** @deprecated PANEL_UTIL 사용 권장 */
    static UTIL = PANEL_UTIL;
    
    /** @deprecated PANEL_ANIMATION 사용 권장 */
    static ANIMATION = PANEL_ANIMATION;
    
    /** 🆕 v6.1.0: Panel 이벤트 상수 */
    static EVENTS = PANEL_EVENTS;
    
    // =========================================================================
    // 생성자
    // =========================================================================
    
    /**
     * @param {Object} [options={}] - 옵션
     * @param {string} [options.apiBaseUrl] - API Base URL
     * @param {number} [options.cacheExpiry=30000] - 캐시 만료 시간 (ms)
     */
    constructor(options = {}) {
        // DOM
        this.panelEl = document.getElementById(DOM_IDS.PANEL);
        this.dom = null;
        
        // API 설정
        const defaultApiUrl = `http://${window.location.hostname}:8008/api/equipment/detail`;
        this.apiBaseUrl = options.apiBaseUrl || defaultApiUrl;
        if (options.apiBaseUrl) {
            equipmentDetailApi.setBaseUrl(options.apiBaseUrl);
        }
        
        // 상태 (최소화)
        this.state = {
            currentTab: TAB_NAMES.GENERAL
        };
        
        /**
         * 🆕 v6.1.0: 현재 선택된 설비 ID 목록 (SubscriptionLevelManager 연동용)
         * @type {string[]}
         */
        this._selectedFrontendIds = [];
        
        // 자식 컴포넌트
        this.cache = new DataCache({ expiry: options.cacheExpiry || 30000 });
        this.headerStatus = null;
        this.generalTab = null;
        this.pcInfoTab = null;
        
        // 분리된 매니저
        this.animator = null;
        this.selectionHandler = null;
        
        // 의존성
        this.equipmentEditState = null;
        
        // EventBus 구독 저장
        this._eventSubscriptions = [];
        
        this._init();
        debugLog('📊 [EquipmentInfoPanel] initialized (v6.1.0 - SubscriptionLevelManager 연동)');
    }
    
    // =========================================================================
    // 초기화
    // =========================================================================
    
    _init() {
        if (!this.panelEl) {
            console.warn('⚠️ Equipment Info Panel element not found');
            return;
        }
        
        // DOM 구조 생성
        this.panelEl.innerHTML = getPanelTemplate();
        this.dom = getDOMReferences(this.panelEl);
        
        // BEM 클래스 적용
        this.panelEl.classList.add(PANEL_CSS.BLOCK);
        
        // 자식 컴포넌트 초기화
        this.headerStatus = new HeaderStatus(this.panelEl);
        this.generalTab = new GeneralTab(this.dom.generalTabContent);
        this.pcInfoTab = new PCInfoTab(this.dom.pcinfoTabContent);
        
        // 분리된 매니저 초기화
        this.animator = new DrawerAnimationManager(this.panelEl, {
            onShowComplete: () => this._onShowComplete(),  // 🆕 v6.1.0
            onHideComplete: () => this._onHideComplete()
        });
        
        this.selectionHandler = new SelectionHandler();
        this.selectionHandler.setDependencies({
            cache: this.cache,
            headerStatus: this.headerStatus,
            generalTab: this.generalTab,
            pcInfoTab: this.pcInfoTab
        });
        
        // 이벤트 리스너
        this._setupEventListeners();
        
        // EventBus 구독 설정
        this._setupEventBusSubscriptions();
        
        // 전역 함수
        window.closeEquipmentInfo = () => this.hide();
        
        // PanelManager에 인스턴스 등록
        panelManager.registerInstance(PANEL_TYPE.EQUIPMENT_INFO, this);
        debugLog('📊 [EquipmentInfoPanel] registered with PanelManager');
    }
    
    _setupEventListeners() {
        this.dom.closeBtn?.addEventListener('click', () => this.hide());
        
        this.dom.tabButtons?.forEach(btn => {
            btn.addEventListener('click', (e) => this._switchTab(e.target.dataset.tab));
        });
    }
    
    _setupEventBusSubscriptions() {
        // equipment:detail:show 이벤트 구독
        const detailShowUnsub = eventBus.on('equipment:detail:show', (data) => {
            debugLog('📊 [EquipmentInfoPanel] EventBus: equipment:detail:show 수신', data);
            this._handleDetailShowEvent(data);
        });
        this._eventSubscriptions.push(detailShowUnsub);
        
        // equipment:detail:hide 이벤트 구독
        const detailHideUnsub = eventBus.on('equipment:detail:hide', () => {
            debugLog('📊 [EquipmentInfoPanel] EventBus: equipment:detail:hide 수신');
            this.hide();
        });
        this._eventSubscriptions.push(detailHideUnsub);
        
        debugLog('📊 [EquipmentInfoPanel] EventBus 구독 설정 완료');
    }
    
    _handleDetailShowEvent(data) {
        if (!data) {
            console.warn('[EquipmentInfoPanel] ⚠️ detail:show 이벤트에 데이터 없음');
            return;
        }
        
        const equipmentData = {
            id: data.frontendId || data.id || data.equipmentId,
            frontendId: data.frontendId || data.id,
            equipmentId: data.equipmentId,
            ...data
        };
        
        this.show(equipmentData);
    }
    
    _switchTab(tabName) {
        this.state.currentTab = tabName;
        
        this.dom.tabButtons?.forEach(btn => {
            const isActive = btn.dataset.tab === tabName;
            btn.classList.toggle(PANEL_CSS.TAB_BTN_ACTIVE, isActive);
            btn.classList.toggle(PANEL_CSS.LEGACY_ACTIVE, isActive);
        });
        
        this.dom.tabContents?.forEach(content => {
            const isActive = content.id === `tab-${tabName}`;
            content.classList.toggle(PANEL_CSS.TAB_CONTENT_ACTIVE, isActive);
            content.classList.toggle(PANEL_CSS.LEGACY_ACTIVE, isActive);
        });
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    /**
     * Equipment Edit State 설정
     * @param {Object} equipmentEditState - Equipment Edit State 인스턴스
     */
    setEquipmentEditState(equipmentEditState) {
        this.equipmentEditState = equipmentEditState;
        this.selectionHandler?.setEquipmentEditState(equipmentEditState);
        debugLog('🔗 [EquipmentInfoPanel] EquipmentEditState connected');
    }
    
    /**
     * 패널 표시
     * @param {Object|Array<Object>} equipmentData - 설비 데이터 또는 배열
     */
    async show(equipmentData) {
        // 애니메이션 중이면 무시
        if (this.animator?.isAnimating()) {
            debugLog('⚠️ [EquipmentInfoPanel] 애니메이션 진행 중 - show() 무시');
            return;
        }
        
        const dataArray = Array.isArray(equipmentData) ? equipmentData : [equipmentData];
        
        if (dataArray.length === 0) {
            this.hide();
            return;
        }
        
        // PanelManager에 열기 등록
        const allowed = panelManager.registerOpen(PANEL_TYPE.EQUIPMENT_INFO);
        if (!allowed) {
            debugLog('⚠️ [EquipmentInfoPanel] 현재 모드에서 허용되지 않음');
            return;
        }
        
        // 🆕 v6.1.1: 이전 선택 ID 보존 (변경 감지용)
        const previousSelectedIds = [...this._selectedFrontendIds];

        // 선택된 설비 ID 목록 저장 (SubscriptionLevelManager 연동용)
        this._selectedFrontendIds = dataArray.map(item => 
            item.frontendId || item.id || item.equipmentId
        ).filter(Boolean);
        
        // 콜백 정의
        const callbacks = {
            onUpdateHeader: (title, isMulti = false) => this._updateHeader(title, isMulti),
            onShowLoading: () => this._showLoading()
        };
        
        // Selection 처리 위임
        if (dataArray.length === 1) {
            await this.selectionHandler.handleSingle(dataArray[0], callbacks);
        } else {
            await this.selectionHandler.handleMulti(dataArray, callbacks);
        }
        
        // 패널 표시
        const animStarted = this.animator?.show();
        
        // 🆕 v6.1.1 Fix: Panel이 이미 열려있는 상태에서 선택 설비가 변경된 경우
        // DrawerAnimationManager.show()가 isVisible=true일 때 onShowComplete를 호출하지 않으므로
        // 여기서 직접 equipment:selection-changed 이벤트를 발행하여
        // SubscriptionLevelManager에 구독 레벨 변경을 알림
        if (!animStarted && this.animator?.isVisible()) {
            const selectionChanged = !this._arraysEqual(previousSelectedIds, this._selectedFrontendIds);
            
            if (selectionChanged) {
                eventBus.emit(PANEL_EVENTS.SELECTION_CHANGED, {
                    selectedIds: this._selectedFrontendIds,
                    previousSelectedIds: previousSelectedIds,
                    panelType: PANEL_TYPE.EQUIPMENT_INFO,
                    timestamp: Date.now()
                });
                
                console.log(
                    `📊 [EquipmentInfoPanel] equipment:selection-changed 발행 → ` +
                    `[${previousSelectedIds.join(', ')}] → [${this._selectedFrontendIds.join(', ')}]`
                );
            }
        }
        
        debugLog(`📊 [EquipmentInfoPanel] shown (${this._selectedFrontendIds.length} 설비 선택)`);
    }
    
    /**
     * 🆕 v6.1.1: 배열 동일성 비교 (순서 무관)
     * @private
     * @param {string[]} arr1
     * @param {string[]} arr2
     * @returns {boolean}
     */
    _arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();
        return sorted1.every((val, idx) => val === sorted2[idx]);
    }

    
    /**
     * 패널 숨기기
     */
    hide() {
        if (!this.animator?.isVisible()) {
            return;
        }
        
        this.animator?.hide();
    }
    
    /**
     * 실시간 데이터 업데이트
     * @param {Object} updateData - 업데이트 데이터
     */
    updateRealtime(updateData) {
        if (!this.animator?.isVisible()) return;
        
        this.selectionHandler?.handleRealtimeUpdate(updateData);
    }
    
    /**
     * API Base URL 설정
     * @param {string} baseUrl - Base URL
     */
    setApiBaseUrl(baseUrl) {
        this.apiBaseUrl = baseUrl;
        equipmentDetailApi.setBaseUrl(baseUrl);
    }
    
    /**
     * 캐시 클리어
     */
    clearCache() {
        this.cache.clear();
        this.selectionHandler?.clearState();
        debugLog('🗑️ [EquipmentInfoPanel] Cache cleared');
    }
    
    /**
     * 🆕 v6.1.0: 현재 선택된 설비 ID 목록 반환
     * @returns {string[]} 선택된 설비 frontend_id 배열
     */
    getSelectedFrontendIds() {
        return [...this._selectedFrontendIds];
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.hide();
        
        // 컴포넌트 정리
        this.cache?.dispose();
        this.generalTab?.dispose();
        this.pcInfoTab?.dispose();
        this.headerStatus?.dispose();
        
        // 매니저 정리
        this.animator?.dispose();
        this.selectionHandler?.dispose();
        
        // EventBus 구독 해제
        this._eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventSubscriptions = [];
        
        // PanelManager에서 인스턴스 해제
        panelManager.unregisterInstance(PANEL_TYPE.EQUIPMENT_INFO);
        
        debugLog('📊 [EquipmentInfoPanel] disposed');
    }
    
    // =========================================================================
    // 🆕 v6.1.0: SubscriptionLevelManager 연동 메서드
    // =========================================================================
    
    /**
     * Panel 열림 완료 시 호출 (애니메이션 완료 후)
     * → SubscriptionLevelManager에 panel:opened 이벤트 발행
     * → 선택 설비만 DETAILED 레벨로 구독 전환
     * @private
     */
    _onShowComplete() {
        // 🔴 CRITICAL: panel:opened 이벤트 발행
        // SubscriptionLevelManager가 이 이벤트를 수신하여 구독 레벨 변경
        eventBus.emit(PANEL_EVENTS.OPENED, {
            panelType: PANEL_TYPE.EQUIPMENT_INFO,
            selectedIds: this._selectedFrontendIds,
            selectedCount: this._selectedFrontendIds.length,
            timestamp: Date.now()
        });
        
        console.log(
            `📊 [EquipmentInfoPanel] panel:opened 발행 → ` +
            `DETAILED 레벨 구독 요청 [${this._selectedFrontendIds.join(', ')}]`
        );
    }
    
    /**
     * Panel 닫힘 완료 시 호출 (애니메이션 완료 후)
     * → SubscriptionLevelManager에 panel:closed 이벤트 발행
     * → 전체 설비 MINIMAL 레벨로 복귀
     * @private
     */
    _onHideComplete() {
        // 이전에 선택된 ID 보존 (이벤트 전송용)
        const previousSelectedIds = [...this._selectedFrontendIds];
        
        // 상태 정리
        this.selectionHandler?.clearState();
        this.generalTab?.stopTimer();
        this._selectedFrontendIds = [];
        
        // PanelManager에서 열림 상태 해제
        panelManager._openPanels.delete(PANEL_TYPE.EQUIPMENT_INFO);
        
        // 🔴 CRITICAL: panel:closed 이벤트 발행
        // SubscriptionLevelManager가 이 이벤트를 수신하여 구독 레벨 복원
        eventBus.emit(PANEL_EVENTS.CLOSED, {
            panelType: PANEL_TYPE.EQUIPMENT_INFO,
            previousSelectedIds: previousSelectedIds,
            timestamp: Date.now()
        });
        
        console.log(
            `📊 [EquipmentInfoPanel] panel:closed 발행 → ` +
            `MINIMAL 레벨로 복귀`
        );
        
        debugLog('📊 [EquipmentInfoPanel] hidden (state cleared)');
    }
    
    // =========================================================================
    // 헬퍼 메서드
    // =========================================================================
    
    _updateHeader(title, isMulti = false) {
        if (this.dom.equipName) {
            this.dom.equipName.textContent = title;
            this.dom.equipName.classList.toggle(PANEL_CSS.TITLE_MULTI, isMulti);
            this.dom.equipName.classList.toggle('multi-select', isMulti);
        }
    }
    
    _showLoading() {
        this.animator?.showLoading();
        this.generalTab?.showLoading();
        this.pcInfoTab?.showLoading();
    }
    
    // =========================================================================
    // 공개 유틸리티 (하위 호환)
    // =========================================================================
    
    /**
     * Drawer 모드 여부 반환
     * @returns {boolean}
     */
    isDrawerMode() {
        return this.animator?.isDrawerMode() || false;
    }
    
    /**
     * 현재 표시 상태 반환
     * @returns {boolean}
     */
    isVisible() {
        return this.animator?.isVisible() || false;
    }
    
    /**
     * 애니메이션 진행 중 여부 반환
     * @returns {boolean}
     */
    isAnimating() {
        return this.animator?.isAnimating() || false;
    }
}

// 기본 내보내기
export default EquipmentInfoPanel;