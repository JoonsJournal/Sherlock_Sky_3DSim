/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Coordinator)
 * 
 * @version 4.0.0
 * @description
 * - 🆕 v4.0.0: Phase 4 CSS Integration
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
 * 수정일: 2026-01-15
 */

import { debugLog } from '../core/utils/Config.js';
import { equipmentDetailApi } from '../api/equipmentDetailApi.js';
import { mergeEquipmentData } from './equipment-info/utils/DataMerger.js';
import { DataCache } from './equipment-info/utils/DataCache.js';
import { HeaderStatus } from './equipment-info/components/HeaderStatus.js';
import { GeneralTab } from './equipment-info/tabs/GeneralTab.js';
import { PCInfoTab } from './equipment-info/tabs/PCInfoTab.js';
import { DOM_IDS, TAB_NAMES, getPanelTemplate, getDOMReferences } from './equipment-info/panelTemplate.js';

export class EquipmentInfoPanel {
    // =========================================================================
    // CSS 클래스 상수 (Phase 4)
    // =========================================================================
    
    /**
     * BEM 클래스명 상수
     * @static
     */
    static CSS = {
        // Block
        BLOCK: 'equipment-panel',
        
        // Block Modifiers
        ACTIVE: 'equipment-panel--active',
        LOADING: 'equipment-panel--loading',
        HIDDEN: 'equipment-panel--hidden',
        
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
    
    constructor(options = {}) {
        // DOM
        this.panelEl = document.getElementById(DOM_IDS.PANEL);
        this.dom = null;
        
        // API - 동적 URL
        const defaultApiUrl = `http://${window.location.hostname}:8000/api/equipment/detail`;
        this.apiBaseUrl = options.apiBaseUrl || defaultApiUrl;
        if (options.apiBaseUrl) {
            equipmentDetailApi.setBaseUrl(options.apiBaseUrl);
        }
        
        // 상태
        this.state = {
            isVisible: false,
            isLoading: false,
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
        
        // Debounce
        this._refreshTimeout = null;
        
        this._init();
        debugLog('📊 EquipmentInfoPanel initialized (v4.0.0 - CSS Integration)');
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
        
        // 자식 컴포넌트 초기화
        this.headerStatus = new HeaderStatus(this.panelEl);
        this.generalTab = new GeneralTab(this.dom.generalTabContent);
        this.pcInfoTab = new PCInfoTab(this.dom.pcinfoTabContent);
        
        // 이벤트 리스너
        this._setupEventListeners();
        
        // 전역 함수
        window.closeEquipmentInfo = () => this.hide();
    }
    
    _setupEventListeners() {
        this.dom.closeBtn?.addEventListener('click', () => this.hide());
        
        this.dom.tabButtons?.forEach(btn => {
            btn.addEventListener('click', (e) => this._switchTab(e.target.dataset.tab));
        });
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
    
    async show(equipmentData) {
        const dataArray = Array.isArray(equipmentData) ? equipmentData : [equipmentData];
        
        if (dataArray.length === 0) {
            this.hide();
            return;
        }
        
        this.state.selectedCount = dataArray.length;
        
        if (dataArray.length === 1) {
            await this._showSingle(dataArray[0]);
        } else {
            await this._showMulti(dataArray);
        }
        
        this._showPanel();
    }
    
    hide() {
        this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.ACTIVE);
        this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.LEGACY_ACTIVE);
        this.state.isVisible = false;
        this._resetState();
        this.generalTab?.stopTimer();
        debugLog('📊 Panel hidden');
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
    
    dispose() {
        this.hide();
        this.cache.dispose();
        this.generalTab?.dispose();
        this.pcInfoTab?.dispose();
        this.headerStatus?.dispose();
        clearTimeout(this._refreshTimeout);
        debugLog('📊 Panel disposed');
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
        this.generalTab.showLoading();
        this.pcInfoTab.showLoading();
    }
    
    _showPanel() {
        this.panelEl?.classList.add(EquipmentInfoPanel.CSS.ACTIVE);
        this.panelEl?.classList.add(EquipmentInfoPanel.CSS.LEGACY_ACTIVE);
        this.panelEl?.classList.remove(EquipmentInfoPanel.CSS.LOADING);
        this.state.isVisible = true;
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
}
