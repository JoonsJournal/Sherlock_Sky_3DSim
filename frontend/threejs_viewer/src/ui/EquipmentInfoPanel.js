/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Tab UI + Backend API 연동)
 * 
 * @version 3.5.0
 * @description
 * - Tab Interface: General / PC Info.
 * - Single Selection: Backend API에서 상세 정보 조회
 * - Multi Selection: Backend API에서 집계 정보 조회
 * - 🆕 v3.5.0: 탭 컴포넌트 분리 통합
 *   - GeneralTab: General 탭 렌더링 위임
 *   - PCInfoTab: PC Info 탭 렌더링 위임
 *   - Panel은 조율자(Coordinator) 역할만 담당
 * - v3.4.0: 컴포넌트 분리 통합 (GaugeRenderer, HeaderStatus)
 * - v3.3.0: 유틸리티 모듈 분리 통합
 * - v3.2.0: equipmentDetailApi.js 통합
 * 
 * @changelog
 * - v3.5.0: 탭 컴포넌트 분리 통합
 *           - 🆕 GeneralTab 클래스 사용
 *           - 🆕 PCInfoTab 클래스 사용
 *           - ⚠️ 호환성: 기존 모든 기능/메서드 100% 유지
 *           - Panel 코드량 약 400줄 감소 (950줄 → 550줄)
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/EquipmentInfoPanel.js
 * 작성일: 2026-01-06
 * 수정일: 2026-01-09
 */

import { debugLog } from '../core/utils/Config.js';
// v3.2.0: API 클라이언트 import
import { equipmentDetailApi } from '../api/equipmentDetailApi.js';
// v3.3.0: 유틸리티 모듈 import
import { mergeEquipmentData } from './equipment-info/utils/DataMerger.js';
// v3.4.0: 컴포넌트 import
import { HeaderStatus } from './equipment-info/components/HeaderStatus.js';
// 🆕 v3.5.0: 탭 컴포넌트 import
import { GeneralTab } from './equipment-info/tabs/GeneralTab.js';
import { PCInfoTab } from './equipment-info/tabs/PCInfoTab.js';

export class EquipmentInfoPanel {
    constructor(options = {}) {
        // DOM 요소
        this.panelEl = document.getElementById('equipmentInfo');
        this.equipNameEl = null;
        
        // API 설정
        this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:8000/api/equipment/detail';
        if (options.apiBaseUrl) {
            equipmentDetailApi.setBaseUrl(options.apiBaseUrl);
        }
        
        // 상태
        this.isVisible = false;
        this.currentTab = 'general';
        this.currentFrontendId = null;
        this.currentEquipmentId = null;
        this.selectedCount = 0;
        this.currentData = null;
        this.isLoading = false;
        
        // Multi Selection 상태
        this.selectedFrontendIds = [];
        this.selectedEquipmentIds = [];
        this.multiSelectionCache = null;
        
        // 캐시
        this.dataCache = new Map();
        this.cacheExpiry = 30000;
        
        // 의존성
        this.equipmentEditState = null;
        
        // 🆕 v3.5.0: 탭 컴포넌트 인스턴스 (초기화 후 생성)
        this.generalTab = null;
        this.pcInfoTab = null;
        
        // v3.4.0: HeaderStatus 인스턴스
        this.headerStatus = null;
        
        // 초기화
        this._init();
        
        debugLog('📊 EquipmentInfoPanel initialized (v3.5.0 - Tab Components)');
    }
    
    // =========================================================================
    // 초기화
    // =========================================================================
    
    _init() {
        this._rebuildPanelStructure();
        
        // 컴포넌트 인스턴스 생성 (DOM 생성 후)
        this.headerStatus = new HeaderStatus(this.panelEl);
        
        // 🆕 v3.5.0: 탭 컴포넌트 인스턴스 생성
        const generalTabContainer = document.getElementById('generalTabContent');
        const pcInfoTabContainer = document.getElementById('pcinfoTabContent');
        
        this.generalTab = new GeneralTab(generalTabContainer);
        this.pcInfoTab = new PCInfoTab(pcInfoTabContainer);
        
        this._exposeGlobalFunctions();
    }
    
    _rebuildPanelStructure() {
        if (!this.panelEl) {
            console.warn('⚠️ Equipment Info Panel element not found');
            return;
        }
        
        this.panelEl.innerHTML = `
            <button class="close-btn" id="equipmentInfoClose">×</button>
            
            <div class="equipment-panel-header">
                <h2 id="equipName" class="equipment-panel-title">설비 정보</h2>
                <div class="header-status" id="headerStatus">
                    <span class="status-indicator" id="headerStatusIndicator"></span>
                    <span class="status-text" id="headerStatusText">-</span>
                </div>
            </div>
            
            <div class="equipment-panel-tabs">
                <button class="equipment-tab active" data-tab="general">General</button>
                <button class="equipment-tab" data-tab="pcinfo">PC Info.</button>
            </div>
            
            <div class="equipment-panel-content">
                <div id="tab-general" class="equipment-tab-content active">
                    <div id="generalTabContent">
                        <div class="info-row placeholder">
                            <span class="info-label">설비를 선택해주세요</span>
                        </div>
                    </div>
                </div>
                
                <div id="tab-pcinfo" class="equipment-tab-content">
                    <div id="pcinfoTabContent">
                        <div class="info-row placeholder">
                            <span class="info-label">설비를 선택해주세요</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.equipNameEl = document.getElementById('equipName');
        
        // 🆕 v3.5.0: 탭 컴포넌트 재연결 (DOM 재생성 시)
        if (this.generalTab) {
            this.generalTab.reconnect(document.getElementById('generalTabContent'));
        }
        if (this.pcInfoTab) {
            this.pcInfoTab.reconnect(document.getElementById('pcinfoTabContent'));
        }
        if (this.headerStatus) {
            this.headerStatus.reconnect(this.panelEl);
        }
        
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        const closeBtn = document.getElementById('equipmentInfoClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        const tabButtons = this.panelEl.querySelectorAll('.equipment-tab');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this._switchTab(e.target.dataset.tab);
            });
        });
    }
    
    _switchTab(tabName) {
        this.currentTab = tabName;
        
        const tabButtons = this.panelEl.querySelectorAll('.equipment-tab');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        const tabContents = this.panelEl.querySelectorAll('.equipment-tab-content');
        tabContents.forEach(content => {
            const contentTabName = content.id.replace('tab-', '');
            content.classList.toggle('active', contentTabName === tabName);
        });
        
        debugLog(`📑 Tab switched to: ${tabName}`);
    }
    
    // =========================================================================
    // 의존성 주입
    // =========================================================================
    
    setEquipmentEditState(equipmentEditState) {
        this.equipmentEditState = equipmentEditState;
        debugLog('🔗 EquipmentEditState connected to EquipmentInfoPanel');
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    async show(equipmentData) {
        const dataArray = Array.isArray(equipmentData) ? equipmentData : [equipmentData];
        
        if (dataArray.length === 0) {
            this.hide();
            return;
        }
        
        this.selectedCount = dataArray.length;
        
        if (dataArray.length === 1) {
            await this._showSingleEquipment(dataArray[0]);
        } else {
            await this._showMultipleEquipment(dataArray);
        }
        
        this._showPanel();
    }
    
    hide() {
        if (this.panelEl) {
            this.panelEl.classList.remove('active');
            this.isVisible = false;
        }
        
        // 상태 초기화
        this.currentFrontendId = null;
        this.currentEquipmentId = null;
        this.selectedCount = 0;
        this.currentData = null;
        
        this.selectedFrontendIds = [];
        this.selectedEquipmentIds = [];
        this.multiSelectionCache = null;
        
        // 🆕 v3.5.0: 탭 타이머 정리
        if (this.generalTab) {
            this.generalTab.stopTimer();
        }
        
        debugLog('📊 Equipment Info Panel hidden');
    }
    
    updateRealtime(updateData) {
        if (!this.isVisible) return;
        
        const incomingFrontendId = updateData.frontend_id;
        
        if (this.selectedCount === 1) {
            if (incomingFrontendId === this.currentFrontendId) {
                const mergedData = mergeEquipmentData(this.currentData, updateData);
                this.currentData = mergedData;
                
                this.headerStatus.update(mergedData.status);
                
                // 🆕 v3.5.0: 탭 컴포넌트에 위임
                this.generalTab.render(mergedData);
                this.pcInfoTab.render(mergedData);
                
                this.dataCache.set(this.currentFrontendId, {
                    data: mergedData,
                    timestamp: Date.now()
                });
                
                debugLog(`🔄 Real-time update: ${this.currentFrontendId} -> ${updateData.status}`);
            }
        } else if (this.selectedCount > 1) {
            if (this.selectedFrontendIds.includes(incomingFrontendId)) {
                this._debounceRefreshMulti();
                debugLog(`🔄 Real-time update (multi): ${incomingFrontendId}`);
            }
        }
    }
    
    // =========================================================================
    // Single Selection
    // =========================================================================
    
    async _showSingleEquipment(equipmentData) {
        const frontendId = equipmentData.id || equipmentData.frontendId;
        this.currentFrontendId = frontendId;
        
        this.selectedFrontendIds = [frontendId];
        this.selectedEquipmentIds = [];
        this.currentData = null;
        
        // 🆕 v3.5.0: 탭 타이머 정리
        this.generalTab.stopTimer();
        
        this.headerStatus.show();
        this._updateHeader(frontendId);
        this.headerStatus.update(null);
        
        // 🆕 v3.5.0: 로딩 상태 표시
        this._showLoading();
        
        try {
            const equipmentId = this._getEquipmentId(frontendId);
            this.currentEquipmentId = equipmentId;
            
            if (equipmentId) {
                this.selectedEquipmentIds = [equipmentId];
            }
            
            if (!equipmentId) {
                // 🆕 v3.5.0: 탭 컴포넌트에 위임
                this.generalTab.showUnmapped(frontendId, equipmentData);
                this.pcInfoTab.showUnmapped();
                this.headerStatus.update('DISCONNECTED');
                this.isLoading = false;
                return;
            }
            
            const cached = this._getFromCache(frontendId);
            if (cached) {
                this.currentData = cached;
                this._updateHeader(cached.equipment_name || frontendId);
                this.headerStatus.update(cached.status);
                // 🆕 v3.5.0: 탭 컴포넌트에 위임
                this.generalTab.render(cached);
                this.pcInfoTab.render(cached);
                this.isLoading = false;
                return;
            }
            
            const detailData = await this._fetchEquipmentDetail(frontendId, equipmentId);
            
            if (detailData) {
                this.currentData = detailData;
                this._saveToCache(frontendId, detailData);
                this._updateHeader(detailData.equipment_name || frontendId);
                this.headerStatus.update(detailData.status);
                // 🆕 v3.5.0: 탭 컴포넌트에 위임
                this.generalTab.render(detailData);
                this.pcInfoTab.render(detailData);
            } else {
                // 🆕 v3.5.0: 탭 컴포넌트에 위임
                this.generalTab.showBasicInfo(frontendId, equipmentData);
                this.pcInfoTab.showError();
                this.headerStatus.update('DISCONNECTED');
            }
            
            this.isLoading = false;
            
        } catch (error) {
            console.error('❌ Failed to load equipment detail:', error);
            // 🆕 v3.5.0: 탭 컴포넌트에 위임
            this.generalTab.showError(frontendId, error.message);
            this.pcInfoTab.showError();
            this.headerStatus.update('DISCONNECTED');
            this.isLoading = false;
        }
    }
    
    _getEquipmentId(frontendId) {
        if (!this.equipmentEditState) {
            debugLog('⚠️ EquipmentEditState not connected');
            return null;
        }
        
        const mapping = this.equipmentEditState.getMapping(frontendId);
        return mapping?.equipmentId || mapping?.equipment_id || null;
    }
    
    async _fetchEquipmentDetail(frontendId, equipmentId) {
        debugLog(`📡 Fetching equipment detail: ${frontendId}, equipmentId=${equipmentId}`);
        
        return await equipmentDetailApi.getDetail(frontendId, {
            equipmentId: equipmentId
        });
    }
    
    // =========================================================================
    // Multi Selection
    // =========================================================================
    
    async _showMultipleEquipment(dataArray) {
        const count = dataArray.length;
        
        this.selectedFrontendIds = dataArray.map(item => item.id || item.frontendId);
        this.selectedEquipmentIds = this.selectedFrontendIds
            .map(fid => this._getEquipmentId(fid))
            .filter(eid => eid !== null);
        
        this._updateHeader(`${count}개 설비 선택됨`, true);
        this.headerStatus.hide();
        
        // 🆕 v3.5.0: 탭 타이머 정리
        this.generalTab.stopTimer();
        
        // 🆕 v3.5.0: 로딩 상태 표시
        this._showLoading();
        
        if (this.selectedEquipmentIds.length === 0) {
            // 🆕 v3.5.0: 탭 컴포넌트에 위임
            this.generalTab.showMultiUnmapped(count);
            this.pcInfoTab.showMultiUnmapped(count);
            this.isLoading = false;
            return;
        }
        
        try {
            const aggregatedData = await this._fetchMultiEquipmentDetail();
            
            if (aggregatedData) {
                this.multiSelectionCache = aggregatedData;
                // 🆕 v3.5.0: 탭 컴포넌트에 위임
                this.generalTab.renderMulti(aggregatedData, count, this.selectedEquipmentIds.length);
                this.pcInfoTab.renderMulti(aggregatedData, count);
            } else {
                // 🆕 v3.5.0: 탭 컴포넌트에 위임
                this.generalTab.showMultiError(count);
                this.pcInfoTab.showMultiError(count);
            }
            
            this.isLoading = false;
            
        } catch (error) {
            console.error('❌ Failed to load multi equipment detail:', error);
            // 🆕 v3.5.0: 탭 컴포넌트에 위임
            this.generalTab.showMultiError(count, error.message);
            this.pcInfoTab.showMultiError(count);
            this.isLoading = false;
        }
    }
    
    async _fetchMultiEquipmentDetail() {
        debugLog(`📡 Fetching multi equipment detail: ${this.selectedFrontendIds.length} items`);
        
        return await equipmentDetailApi.getMultiDetail(this.selectedFrontendIds, {
            equipmentIds: this.selectedEquipmentIds
        });
    }
    
    _debounceRefreshMulti() {
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        
        this._refreshTimeout = setTimeout(async () => {
            if (this.selectedCount > 1 && this.selectedEquipmentIds.length > 0) {
                try {
                    const aggregatedData = await this._fetchMultiEquipmentDetail();
                    if (aggregatedData) {
                        this.multiSelectionCache = aggregatedData;
                        // 🆕 v3.5.0: 탭 컴포넌트에 위임
                        this.generalTab.renderMulti(aggregatedData, this.selectedCount, this.selectedEquipmentIds.length);
                        this.pcInfoTab.renderMulti(aggregatedData, this.selectedCount);
                    }
                } catch (error) {
                    console.error('❌ Failed to refresh multi selection:', error);
                }
            }
        }, 500);
    }
    
    // =========================================================================
    // 헬퍼 메서드
    // =========================================================================
    
    _updateHeader(title, isMulti = false) {
        if (this.equipNameEl) {
            this.equipNameEl.textContent = title;
            this.equipNameEl.classList.toggle('multi-select', isMulti);
        }
    }
    
    /**
     * 🆕 v3.5.0: 로딩 상태 표시 (두 탭 모두)
     * @private
     */
    _showLoading() {
        this.isLoading = true;
        this.generalTab.showLoading();
        this.pcInfoTab.showLoading();
    }
    
    _showPanel() {
        if (this.panelEl) {
            this.panelEl.classList.add('active');
            this.isVisible = true;
        }
    }
    
    // =========================================================================
    // 캐시 관리
    // =========================================================================
    
    _getFromCache(frontendId) {
        const cached = this.dataCache.get(frontendId);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.dataCache.delete(frontendId);
            return null;
        }
        
        return cached.data;
    }
    
    _saveToCache(frontendId, data) {
        this.dataCache.set(frontendId, {
            data,
            timestamp: Date.now()
        });
    }
    
    clearCache() {
        this.dataCache.clear();
        this.multiSelectionCache = null;
        this.currentData = null;
        debugLog('🗑️ Equipment info cache cleared');
    }
    
    // =========================================================================
    // API Base URL 변경
    // =========================================================================
    
    setApiBaseUrl(baseUrl) {
        this.apiBaseUrl = baseUrl;
        equipmentDetailApi.setBaseUrl(baseUrl);
        debugLog(`📡 API base URL changed to: ${baseUrl}`);
    }
    
    // =========================================================================
    // 전역 함수 노출
    // =========================================================================
    
    _exposeGlobalFunctions() {
        window.closeEquipmentInfo = () => this.hide();
    }
    
    // =========================================================================
    // 정리
    // =========================================================================
    
    dispose() {
        this.hide();
        this.clearCache();
        this.equipmentEditState = null;
        
        // 🆕 v3.5.0: 탭 컴포넌트 정리
        if (this.generalTab) {
            this.generalTab.dispose();
            this.generalTab = null;
        }
        if (this.pcInfoTab) {
            this.pcInfoTab.dispose();
            this.pcInfoTab = null;
        }
        
        if (this.headerStatus) {
            this.headerStatus.dispose();
            this.headerStatus = null;
        }
        
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        
        debugLog('📊 EquipmentInfoPanel disposed');
    }
}