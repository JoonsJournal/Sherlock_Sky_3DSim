/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Coordinator)
 * 
 * @version 5.2.0
 * @description
 * - 🆕 v5.2.0: EventBus 구독 추가 (2026-01-18)
 *   - 'equipment:detail:show' 이벤트 구독으로 Ranking View 카드 클릭 지원
 *   - dispose()에서 EventBus 구독 해제
 *   - ⚠️ 호환성: 기존 모든 기능/로직 100% 유지
 * - v5.1.0: PanelManager 연동 (2026-01-18)
 *   - constructor에서 PanelManager 인스턴스 등록
 *   - show()에서 panelManager.registerOpen() 호출
 *   - hide()에서 PanelManager 상태 해제
 *   - 현재 모드에서 허용되지 않으면 Panel 표시 차단
 *   - dispose()에서 인스턴스 해제
 *   - ⚠️ 호환성: 기존 모든 기능/로직 100% 유지
 * - v5.0.0: Equipment Drawer Integration
 *   - Drawer CSS 클래스 상수 추가
 *   - Hybrid 애니메이션 (열림: width→transform, 닫힘: transform→width)
 *   - _triggerResize() 메서드로 3D Viewer 리사이즈 트리거
 *   - drawer-toggle 커스텀 이벤트 발생
 * - v4.0.0: Phase 4 CSS Integration
 *   - CSS 클래스명 static 상수 정의
 *   - classList.add/remove/toggle 방식 통일
 *   - BEM 네이밍 규칙 적용
 * - v3.6.0: 최종 슬림화 (~280줄)
 *   - DataCache 분리: 캐시 관리 위임
 *   - panelTemplate 분리: HTML 템플릿 분리
 *   - 조율자(Coordinator) 역할에 집중
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/EquipmentInfoPanel.js
 * 작성일: 2026-01-06
 * 수정일: 2026-01-18
 */

import { debugLog } from '../core/utils/Config.js';
import { equipmentDetailApi } from '../api/equipmentDetailApi.js';
import { mergeEquipmentData } from './equipment-info/utils/DataMerger.js';
import { DataCache } from './equipment-info/utils/DataCache.js';
import { HeaderStatus } from './equipment-info/components/HeaderStatus.js';
import { GeneralTab } from './equipment-info/tabs/GeneralTab.js';
import { PCInfoTab } from './equipment-info/tabs/PCInfoTab.js';
import { DOM_IDS, TAB_NAMES, getPanelTemplate, getDOMReferences } from './equipment-info/panelTemplate.js';

// 🆕 v5.1.0: PanelManager 연동
import { panelManager, PANEL_TYPE } from '../core/navigation/index.js';

// 🆕 v5.2.0: EventBus 구독
import { eventBus } from '../core/managers/EventBus.js';

export class EquipmentInfoPanel {
    // =========================================================================
    // CSS 클래스 상수 (Phase 4 + v5.0.0 Drawer)
    // =========================================================================
    
    /**
     * BEM 클래스명 상수
     * @static
     */
    static CSS = {
        // Block - Legacy Panel (하위 호환)
        BLOCK: 'equipment-panel',
        
        // Block Modifiers - Legacy
        ACTIVE: 'equipment-panel--active',
        LOADING: 'equipment-panel--loading',
        HIDDEN: 'equipment-panel--hidden',
        
        // 🆕 v5.0.0: Drawer Block
        DRAWER: 'equipment-drawer',
        
        // 🆕 v5.0.0: Drawer Modifiers (Hybrid Animation)
        DRAWER_OPEN: 'equipment-drawer--open',
        DRAWER_OPENING: 'equipment-drawer--opening',
        DRAWER_CLOSING: 'equipment-drawer--closing',
        DRAWER_LOADING: 'equipment-drawer--loading',
        
        // Elements
        HEADER: 'equipment-panel__header',
        TITLE: 'equipment-panel__title',
        TITLE_MULTI: 'equipment-panel__title--multi',
        CLOSE_BTN: 'equipment-panel__close-btn',
        
        TAB_NAV: 'equipment-panel__tab-nav',
        TAB_BTN: 'equipment-panel__tab-btn',
        TAB_BTN_ACTIVE: 'equipment-panel__tab-btn--active',
        TAB_CONTENT: 'equipment-panel__tab-content',
        TAB_CONTENT_ACTIVE: 'equipment-panel__tab-content--active',
        
        BODY: 'equipment-panel__body',
        SECTION: 'equipment-panel__section',
        
        // Legacy alias (하위 호환)
        LEGACY_ACTIVE: 'active'
    };
    
    /**
     * Utility 클래스 상수
     * @static
     */
    static UTIL = {
        FLEX: 'u-flex',
        FLEX_CENTER: 'u-flex-center',
        GLASS: 'u-glass',
        GLASS_DARK: 'u-glass-dark',
        GLOW: 'u-glow',
        HIDDEN: 'u-hidden',
        SR_ONLY: 'u-sr-only'
    };
    
    /**
     * 🆕 v5.0.0: 애니메이션 설정
     * CSS의 --drawer-transition-duration과 일치해야 함
     * @static
     */
    static ANIMATION = {
        DURATION: 300,  // ms (CSS와 동기화)
        RESIZE_DELAY: 50  // ms (CSS 전환 후 리사이즈 지연)
    };
    
    constructor(options = {}) {
        // DOM
        this.panelEl = document.getElementById(DOM_IDS.PANEL);
        this.dom = null;
        
        // API - 동적 URL
        const defaultApiUrl = `http://${window.location.hostname}:8008/api/equipment/detail`;
        this.apiBaseUrl = options.apiBaseUrl || defaultApiUrl;
        if (options.apiBaseUrl) {
            equipmentDetailApi.setBaseUrl(options.apiBaseUrl);
        }
        
        // 상태
        this.state = {
            isVisible: false,
            isLoading: false,
            isAnimating: false,  // 🆕 v5.0.0: 애니메이션 진행 중 플래그
            currentTab: TAB_NAMES.GENERAL,
            currentFrontendId: null,
            currentEquipmentId: null,
            currentData: null,
            selectedCount: 0,
            selectedFrontendIds: [],
            selectedEquipmentIds: []
        };
        
        // 의존성
        this.equipmentEditState = null;
        
        // 자식 컴포넌트
        this.cache = new DataCache({ expiry: options.cacheExpiry || 30000 });
        this.headerStatus = null;
        this.generalTab = null;
        this.pcInfoTab = null;
        
        // Debounce / Timeout
        this._refreshTimeout = null;
        this._animationTimeout = null;  // 🆕 v5.0.0
        
        // 🆕 v5.0.0: Drawer 모드 활성화 여부 (CSS 클래스 확인)
        this._isDrawerMode = false;
        
        // 🆕 v5.2.0: EventBus 구독 저장 (cleanup용)
        this._eventSubscriptions = [];
        
        this._init();
        debugLog('📊 EquipmentInfoPanel initialized (v5.2.0 - EventBus Integration)');
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
        this.panelEl.classList.add(EquipmentInfoPanel.CSS.BLOCK);
        
        // 🆕 v5.0.0: Drawer 모드 감지
        this._isDrawerMode = this.panelEl.classList.contains(EquipmentInfoPanel.CSS.DRAWER);
        if (this._isDrawerMode) {
            debugLog('📊 Drawer 모드 활성화됨');
        }
        
        // 자식 컴포넌트 초기화
        this.headerStatus = new HeaderStatus(this.panelEl);
        this.generalTab = new GeneralTab(this.dom.generalTabContent);
        this.pcInfoTab = new PCInfoTab(this.dom.pcinfoTabContent);
        
        // 이벤트 리스너
        this._setupEventListeners();
        
        // 🆕 v5.2.0: EventBus 구독 설정
        this._setupEventBusSubscriptions();
        
        // 전역 함수
        window.closeEquipmentInfo = () => this.hide();
        
        // 🆕 v5.1.0: PanelManager에 인스턴스 등록
        panelManager.registerInstance(PANEL_TYPE.EQUIPMENT_INFO, this);
        debugLog('📊 EquipmentInfoPanel registered with PanelManager');
    }
    
    _setupEventListeners() {
        this.dom.closeBtn?.addEventListener('click', () => this.hide());
        
        this.dom.tabButtons?.forEach(btn => {
            btn.addEventListener('click', (e) => this._switchTab(e.target.dataset.tab));
        });
    }
    
    /**
     * 🆕 v5.2.0: EventBus 구독 설정
     * Ranking View 등 외부 컴포넌트에서 Panel 표시 요청을 수신
     * @private
     */
    _setupEventBusSubscriptions() {
        // equipment:detail:show 이벤트 구독 (Ranking View에서 발행)
        const detailShowUnsub = eventBus.on('equipment:detail:show', (data) => {
            debugLog('📊 EventBus: equipment:detail:show 수신', data);
            this._handleDetailShowEvent(data);
        });
        this._eventSubscriptions.push(detailShowUnsub);
        
        // equipment:detail:hide 이벤트 구독 (선택적)
        const detailHideUnsub = eventBus.on('equipment:detail:hide', () => {
            debugLog('📊 EventBus: equipment:detail:hide 수신');
            this.hide();
        });
        this._eventSubscriptions.push(detailHideUnsub);
        
        debugLog('📊 EventBus 구독 설정 완료 (equipment:detail:show, equipment:detail:hide)');
    }
    
    /**
     * 🆕 v5.2.0: equipment:detail:show 이벤트 핸들러
     * @private
     * @param {Object} data - 설비 데이터
     */
    _handleDetailShowEvent(data) {
        if (!data) {
            console.warn('[EquipmentInfoPanel] ⚠️ detail:show 이벤트에 데이터 없음');
            return;
        }
        
        // 데이터 포맷 정규화
        const equipmentData = {
            id: data.frontendId || data.id || data.equipmentId,
            frontendId: data.frontendId || data.id,
            equipmentId: data.equipmentId,
            ...data
        };
        
        debugLog('📊 Panel 표시 요청:', equipmentData);
        
        // show() 호출
        this.show(equipmentData);
    }
    
    _switchTab(tabName) {
        this.state.currentTab = tabName;
        
        this.dom.tabButtons?.forEach(btn => {
            const isActive = btn.dataset.tab === tabName;
            btn.classList.toggle(EquipmentInfoPanel.CSS.TAB_BTN_ACTIVE, isActive);
            btn.classList.toggle(EquipmentInfoPanel.CSS.LEGACY_ACTIVE, isActive);
        });
        
        this.dom.tabContents?.forEach(content => {
            const isActive = content.id === `tab-${tabName}`;
            content.classList.toggle(EquipmentInfoPanel.CSS.TAB_CONTENT_ACTIVE, isActive);
            content.classList.toggle(EquipmentInfoPanel.CSS.LEGACY_ACTIVE, isActive);
        });
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    setEquipmentEditState(equipmentEditState) {
        this.equipmentEditState = equipmentEditState;
        debugLog('🔗 EquipmentEditState connected');
    }
    
    /**
     * 패널 표시
     * 🆕 v5.1.0: PanelManager 연동 추가
     */
    async show(equipmentData) {
        // 🆕 v5.0.0: 애니메이션 중이면 무시
        if (this.state.isAnimating) {
            debugLog('⚠️ 애니메이션 진행 중 - show() 무시');
            return;
        }
        
        const dataArray = Array.isArray(equipmentData) ? equipmentData : [equipmentData];
        
        if (dataArray.length === 0) {
            this.hide();
            return;
        }
        
        // 🆕 v5.1.0: PanelManager에 열기 등록 (모드 체크 포함)
        const allowed = panelManager.registerOpen(PANEL_TYPE.EQUIPMENT_INFO);
        if (!allowed) {
            debugLog('⚠️ EquipmentInfoPanel은 현재 모드에서 허용되지 않음');
            return;
        }
        
        this.state.selectedCount = dataArray.length;
        
        if (dataArray.length === 1) {
            await this._showSingle(dataArray[0]);
        } else {
            await this._showMulti(dataArray);
        }
        
        this._showPanel();
        
        debugLog('📊 EquipmentInfoPanel shown');
    }
    
    /**
     * 🆕 v5.0.0: 패널/Drawer 숨기기 (Hybrid 애니메이션)
     * 🆕 v5.1.0: PanelManager 상태 해제
     */
    hide() {
        // 애니메이션 중이면 무시
        if (this.state.isAnimating) {
            debugLog('⚠️ 애니메이션 진행 중 - hide() 무시');
            return;
        }
        
        if (!this.state.isVisible) {
            return;
        }
        
        // 🆕 v5.0.0: Drawer 모드 - Hybrid 닫기 애니메이션
        if (this._isDrawerMode) {
            this._hideDrawerHybrid();
        } else {
            // Legacy 모드 - 즉시 숨김
            this._hideLegacy();
        }
        
        // 🆕 v5.1.0: PanelManager에서 열림 상태 해제
        panelManager._openPanels.delete(PANEL_TYPE.EQUIPMENT_INFO);
        debugLog('📊 EquipmentInfoPanel hidden (PanelManager state cleared)');
    }
    
    /**
     * 🆕 v5.0.0: Drawer Hybrid 닫기 애니메이션
     * Phase 1: transform (오른쪽으로 슬라이드)
     * Phase 2: width (0으로 축소)
     */
    _hideDrawerHybrid() {
        this.state.isAnimating = true;
        
        // Phase 1: 닫기 시작 (transform 애니메이션)
        this.panelEl.classList.add(EquipmentInfoPanel.CSS.DRAWER_CLOSING);
        this.panelEl.classList.remove(EquipmentInfoPanel.CSS.DRAWER_OPEN);
        
        debugLog('📊 Drawer 닫기 Phase 1: transform');
        
        // Phase 2: 애니메이션 완료 후 width 0으로
        clearTimeout(this._animationTimeout);
        this._animationTimeout = setTimeout(() => {
            this.panelEl.classList.remove(EquipmentInfoPanel.CSS.DRAWER_CLOSING);
            
            // Legacy 클래스도 제거
            this.panelEl.classList.remove(EquipmentInfoPanel.CSS.ACTIVE);
            this.panelEl.classList.remove(EquipmentInfoPanel.CSS.LEGACY_ACTIVE);
            
            this.state.isVisible = false;
            this.state.isAnimating = false;
            
            debugLog('📊 Drawer 닫기 완료');
            
            // 🆕 3D Viewer 리사이즈 트리거
            this._triggerResize(false);
            
            this._resetState();
            this.generalTab?.stopTimer();
            
        }, EquipmentInfoPanel.ANIMATION.DURATION);
    }
    
    /**
     * Legacy 모드 숨기기 (즉시)
     */
    _hideLegacy() {
        this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.ACTIVE);
        this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.LEGACY_ACTIVE);
        this.state.isVisible = false;
        this._resetState();
        this.generalTab?.stopTimer();
        debugLog('📊 Panel hidden (legacy mode)');
    }
    
    updateRealtime(updateData) {
        if (!this.state.isVisible) return;
        
        const { frontend_id } = updateData;
        
        if (this.state.selectedCount === 1 && frontend_id === this.state.currentFrontendId) {
            const merged = mergeEquipmentData(this.state.currentData, updateData);
            this.state.currentData = merged;
            
            this.headerStatus.update(merged.status);
            this.generalTab.render(merged);
            this.pcInfoTab.render(merged);
            
            this.cache.set(this.state.currentFrontendId, merged);
        } else if (this.state.selectedCount > 1 && this.state.selectedFrontendIds.includes(frontend_id)) {
            this._debounceRefreshMulti();
        }
    }
    
    setApiBaseUrl(baseUrl) {
        this.apiBaseUrl = baseUrl;
        equipmentDetailApi.setBaseUrl(baseUrl);
    }
    
    clearCache() {
        this.cache.clear();
        this.state.currentData = null;
        debugLog('🗑️ Cache cleared');
    }
    
    /**
     * 정리
     * 🆕 v5.1.0: PanelManager 인스턴스 해제
     * 🆕 v5.2.0: EventBus 구독 해제
     */
    dispose() {
        this.hide();
        this.cache.dispose();
        this.generalTab?.dispose();
        this.pcInfoTab?.dispose();
        this.headerStatus?.dispose();
        clearTimeout(this._refreshTimeout);
        clearTimeout(this._animationTimeout);
        
        // 🆕 v5.2.0: EventBus 구독 해제
        this._eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventSubscriptions = [];
        debugLog('📊 EventBus 구독 해제 완료');
        
        // 🆕 v5.1.0: PanelManager에서 인스턴스 해제
        panelManager.unregisterInstance(PANEL_TYPE.EQUIPMENT_INFO);
        
        debugLog('📊 Panel disposed (PanelManager instance unregistered)');
    }
    
    // =========================================================================
    // Single Selection
    // =========================================================================
    
    async _showSingle(equipmentData) {
        const frontendId = equipmentData.id || equipmentData.frontendId;
        
        this._updateState({
            currentFrontendId: frontendId,
            selectedFrontendIds: [frontendId],
            selectedEquipmentIds: [],
            currentData: null
        });
        
        this.generalTab.stopTimer();
        this.headerStatus.show();
        this._updateHeader(frontendId);
        this._showLoading();
        
        const equipmentId = this._getEquipmentId(frontendId);
        this.state.currentEquipmentId = equipmentId;
        
        if (equipmentId) {
            this.state.selectedEquipmentIds = [equipmentId];
        }
        
        // 매핑 안됨
        if (!equipmentId) {
            this.generalTab.showUnmapped(frontendId, equipmentData);
            this.pcInfoTab.showUnmapped();
            this.headerStatus.update('DISCONNECTED');
            this.state.isLoading = false;
            return;
        }
        
        // 캐시 확인
        const cached = this.cache.get(frontendId);
        if (cached) {
            this._renderSingle(cached, frontendId);
            return;
        }
        
        // API 호출
        try {
            const data = await equipmentDetailApi.getDetail(frontendId, { equipmentId });
            
            if (data) {
                this.cache.set(frontendId, data);
                this._renderSingle(data, frontendId);
            } else {
                this._renderSingleError(frontendId, equipmentData);
            }
        } catch (error) {
            console.error('❌ Failed to load:', error);
            this.generalTab.showError(frontendId, error.message);
            this.pcInfoTab.showError();
            this.headerStatus.update('DISCONNECTED');
        }
        
        this.state.isLoading = false;
    }
    
    _renderSingle(data, frontendId) {
        this.state.currentData = data;
        this._updateHeader(data.equipment_name || frontendId);
        this.headerStatus.update(data.status);
        this.generalTab.render(data);
        this.pcInfoTab.render(data);
        this.state.isLoading = false;
    }
    
    _renderSingleError(frontendId, equipmentData) {
        this.generalTab.showBasicInfo(frontendId, equipmentData);
        this.pcInfoTab.showError();
        this.headerStatus.update('DISCONNECTED');
        this.state.isLoading = false;
    }
    
    // =========================================================================
    // Multi Selection
    // =========================================================================
    
    async _showMulti(dataArray) {
        const count = dataArray.length;
        const frontendIds = dataArray.map(item => item.id || item.frontendId);
        const equipmentIds = frontendIds
            .map(fid => this._getEquipmentId(fid))
            .filter(Boolean);
        
        this._updateState({
            selectedFrontendIds: frontendIds,
            selectedEquipmentIds: equipmentIds
        });
        
        this._updateHeader(`${count}개 설비 선택됨`, true);
        this.headerStatus.hide();
        this.generalTab.stopTimer();
        this._showLoading();
        
        // 매핑 안됨
        if (equipmentIds.length === 0) {
            this.generalTab.showMultiUnmapped(count);
            this.pcInfoTab.showMultiUnmapped(count);
            this.state.isLoading = false;
            return;
        }
        
        // API 호출
        try {
            const data = await equipmentDetailApi.getMultiDetail(frontendIds, { equipmentIds });
            
            if (data) {
                this.cache.setMulti(frontendIds, data);
                this.generalTab.renderMulti(data, count, equipmentIds.length);
                this.pcInfoTab.renderMulti(data, count);
            } else {
                this.generalTab.showMultiError(count);
                this.pcInfoTab.showMultiError(count);
            }
        } catch (error) {
            console.error('❌ Failed to load multi:', error);
            this.generalTab.showMultiError(count, error.message);
            this.pcInfoTab.showMultiError(count);
        }
        
        this.state.isLoading = false;
    }
    
    _debounceRefreshMulti() {
        clearTimeout(this._refreshTimeout);
        
        this._refreshTimeout = setTimeout(async () => {
            const { selectedCount, selectedFrontendIds, selectedEquipmentIds } = this.state;
            
            if (selectedCount > 1 && selectedEquipmentIds.length > 0) {
                try {
                    const data = await equipmentDetailApi.getMultiDetail(selectedFrontendIds, {
                        equipmentIds: selectedEquipmentIds
                    });
                    
                    if (data) {
                        this.cache.setMulti(selectedFrontendIds, data);
                        this.generalTab.renderMulti(data, selectedCount, selectedEquipmentIds.length);
                        this.pcInfoTab.renderMulti(data, selectedCount);
                    }
                } catch (error) {
                    console.error('❌ Refresh failed:', error);
                }
            }
        }, 500);
    }
    
    // =========================================================================
    // 헬퍼
    // =========================================================================
    
    _getEquipmentId(frontendId) {
        const mapping = this.equipmentEditState?.getMapping(frontendId);
        return mapping?.equipmentId || mapping?.equipment_id || null;
    }
    
    _updateHeader(title, isMulti = false) {
        if (this.dom.equipName) {
            this.dom.equipName.textContent = title;
            this.dom.equipName.classList.toggle(EquipmentInfoPanel.CSS.TITLE_MULTI, isMulti);
            this.dom.equipName.classList.toggle('multi-select', isMulti);
        }
    }
    
    _showLoading() {
        this.state.isLoading = true;
        this.panelEl?.classList.add(EquipmentInfoPanel.CSS.LOADING);
        
        // 🆕 v5.0.0: Drawer 로딩 상태
        if (this._isDrawerMode) {
            this.panelEl?.classList.add(EquipmentInfoPanel.CSS.DRAWER_LOADING);
        }
        
        this.generalTab.showLoading();
        this.pcInfoTab.showLoading();
    }
    
    /**
     * 🆕 v5.0.0: 패널/Drawer 표시 (Hybrid 애니메이션)
     */
    _showPanel() {
        // 이미 표시 중이면 클래스만 업데이트
        if (this.state.isVisible && !this.state.isAnimating) {
            this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.LOADING);
            if (this._isDrawerMode) {
                this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.DRAWER_LOADING);
            }
            return;
        }
        
        // 🆕 v5.0.0: Drawer 모드 - Hybrid 열기 애니메이션
        if (this._isDrawerMode) {
            this._showDrawerHybrid();
        } else {
            // Legacy 모드 - 즉시 표시
            this._showLegacy();
        }
    }
    
    /**
     * 🆕 v5.0.0: Drawer Hybrid 열기 애니메이션
     * Phase 1: width (0 → drawer-width)
     * Phase 2: transform 정상화
     */
    _showDrawerHybrid() {
        this.state.isAnimating = true;
        
        // Phase 1: 열기 시작 (width 애니메이션)
        this.panelEl.classList.add(EquipmentInfoPanel.CSS.DRAWER_OPENING);
        
        debugLog('📊 Drawer 열기 Phase 1: width');
        
        // Phase 2: 애니메이션 완료 후 열림 상태로 전환
        clearTimeout(this._animationTimeout);
        this._animationTimeout = setTimeout(() => {
            this.panelEl.classList.remove(EquipmentInfoPanel.CSS.DRAWER_OPENING);
            this.panelEl.classList.add(EquipmentInfoPanel.CSS.DRAWER_OPEN);
            
            // Legacy 클래스도 추가 (하위 호환)
            this.panelEl.classList.add(EquipmentInfoPanel.CSS.ACTIVE);
            this.panelEl.classList.add(EquipmentInfoPanel.CSS.LEGACY_ACTIVE);
            
            // 로딩 상태 제거
            this.panelEl.classList.remove(EquipmentInfoPanel.CSS.LOADING);
            this.panelEl.classList.remove(EquipmentInfoPanel.CSS.DRAWER_LOADING);
            
            this.state.isVisible = true;
            this.state.isAnimating = false;
            
            debugLog('📊 Drawer 열기 완료');
            
            // 🆕 3D Viewer 리사이즈 트리거
            this._triggerResize(true);
            
        }, EquipmentInfoPanel.ANIMATION.DURATION);
    }
    
    /**
     * Legacy 모드 표시 (즉시)
     */
    _showLegacy() {
        this.panelEl?.classList.add(EquipmentInfoPanel.CSS.ACTIVE);
        this.panelEl?.classList.add(EquipmentInfoPanel.CSS.LEGACY_ACTIVE);
        this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.LOADING);
        this.state.isVisible = true;
        debugLog('📊 Panel shown (legacy mode)');
    }
    
    /**
     * 🆕 v5.0.0: 3D Viewer 리사이즈 트리거
     * SceneManager에서 drawer-toggle 이벤트를 수신하여 리사이즈
     * @param {boolean} isOpen - Drawer 열림 여부
     */
    _triggerResize(isOpen) {
        // 약간의 지연 후 리사이즈 이벤트 발생 (CSS 전환 완료 대기)
        setTimeout(() => {
            // Custom Event 발생 (SceneManager에서 수신)
            window.dispatchEvent(new CustomEvent('drawer-toggle', {
                detail: { isOpen }
            }));
            
            // window resize 이벤트도 발생 (폴백)
            window.dispatchEvent(new Event('resize'));
            
            debugLog(`📊 리사이즈 트리거 발생 (isOpen: ${isOpen})`);
        }, EquipmentInfoPanel.ANIMATION.RESIZE_DELAY);
    }
    
    _updateState(updates) {
        Object.assign(this.state, updates);
    }
    
    _resetState() {
        this._updateState({
            currentFrontendId: null,
            currentEquipmentId: null,
            currentData: null,
            selectedCount: 0,
            selectedFrontendIds: [],
            selectedEquipmentIds: []
        });
        this.cache.clearMulti();
    }
    
    // =========================================================================
    // 🆕 v5.0.0: 공개 유틸리티
    // =========================================================================
    
    /**
     * 🆕 v5.0.0: Drawer 모드 여부 반환
     */
    isDrawerMode() {
        return this._isDrawerMode;
    }
    
    /**
     * 🆕 v5.0.0: 현재 표시 상태 반환
     */
    isVisible() {
        return this.state.isVisible;
    }
    
    /**
     * 🆕 v5.0.0: 애니메이션 진행 중 여부 반환
     */
    isAnimating() {
        return this.state.isAnimating;
    }
}
