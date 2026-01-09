/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Tab UI + Backend API 연동)
 * 
 * @version 3.4.0
 * @description
 * - Tab Interface: General / PC Info.
 * - Single Selection: Backend API에서 상세 정보 조회
 * - Multi Selection: Backend API에서 집계 정보 조회
 * - 🆕 v3.4.0: 컴포넌트 분리 통합
 *   - GaugeRenderer: Gauge 렌더링 컴포넌트
 *   - HeaderStatus: 헤더 상태 표시 컴포넌트
 * - v3.3.0: 유틸리티 모듈 분리 통합
 * - v3.2.0: equipmentDetailApi.js 통합
 * 
 * @changelog
 * - v3.4.0: 컴포넌트 분리 통합
 *           - 🆕 GaugeRenderer 클래스 사용 (PC Info Tab 간소화)
 *           - 🆕 HeaderStatus 클래스 사용 (상태 관리 위임)
 *           - ⚠️ 호환성: 기존 모든 기능/메서드 100% 유지
 *           - PC Info Tab 코드량 약 100줄 감소
 * - v3.3.0: 유틸리티 모듈 분리 통합
 * - v3.2.0: equipmentDetailApi.js 통합
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/EquipmentInfoPanel.js
 * 작성일: 2026-01-06
 * 수정일: 2026-01-09
 */

import { debugLog } from '../core/utils/Config.js';
// v3.2.0: API 클라이언트 import
import { equipmentDetailApi } from '../api/equipmentDetailApi.js';
// v3.3.0: 유틸리티 모듈 import
import { DurationTimer } from './equipment-info/utils/DurationTimer.js';
import { DataFormatter } from './equipment-info/utils/DataFormatter.js';
import { mergeEquipmentData } from './equipment-info/utils/DataMerger.js';
// 🆕 v3.4.0: 컴포넌트 import
import { GaugeRenderer } from './equipment-info/components/GaugeRenderer.js';
import { HeaderStatus } from './equipment-info/components/HeaderStatus.js';

export class EquipmentInfoPanel {
    constructor(options = {}) {
        // DOM 요소
        this.panelEl = document.getElementById('equipmentInfo');
        this.equipNameEl = null;
        
        // API 설정 - equipmentDetailApi와 연동
        this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:8000/api/equipment/detail';
        
        // equipmentDetailApi의 baseUrl 동기화
        if (options.apiBaseUrl) {
            equipmentDetailApi.setBaseUrl(options.apiBaseUrl);
        }
        
        // 상태
        this.isVisible = false;
        this.currentTab = 'general';  // 'general' | 'pcinfo'
        this.currentFrontendId = null;
        this.currentEquipmentId = null;
        this.selectedCount = 0;
        
        // 현재 표시 중인 전체 데이터 (WebSocket 병합용)
        this.currentData = null;
        
        // Multi Selection 상태
        this.selectedFrontendIds = [];
        this.selectedEquipmentIds = [];
        this.multiSelectionCache = null;
        
        // 캐시
        this.dataCache = new Map();
        this.cacheExpiry = 30000;  // 30초
        
        // 의존성 (나중에 주입)
        this.equipmentEditState = null;
        
        // 로딩 상태
        this.isLoading = false;
        
        // v3.3.0: Duration Timer 인스턴스
        this.durationTimer = new DurationTimer();
        
        // 🆕 v3.4.0: HeaderStatus 인스턴스 (초기화 후 생성)
        this.headerStatus = null;
        
        // 초기화
        this._init();
        
        debugLog('📊 EquipmentInfoPanel initialized (v3.4.0 - Components Integration)');
    }
    
    // =========================================================================
    // 초기화
    // =========================================================================
    
    _init() {
        // 패널 구조 재생성
        this._rebuildPanelStructure();
        
        // 🆕 v3.4.0: HeaderStatus 인스턴스 생성 (DOM 생성 후)
        this.headerStatus = new HeaderStatus(this.panelEl);
        
        // 전역 함수 노출
        this._exposeGlobalFunctions();
    }
    
    /**
     * 패널 구조 재생성
     * @private
     */
    _rebuildPanelStructure() {
        if (!this.panelEl) {
            console.warn('⚠️ Equipment Info Panel element not found');
            return;
        }
        
        this.panelEl.innerHTML = `
            <button class="close-btn" id="equipmentInfoClose">×</button>
            
            <!-- Header (Name + Status) -->
            <div class="equipment-panel-header">
                <h2 id="equipName" class="equipment-panel-title">설비 정보</h2>
                <div class="header-status" id="headerStatus">
                    <span class="status-indicator" id="headerStatusIndicator"></span>
                    <span class="status-text" id="headerStatusText">-</span>
                </div>
            </div>
            
            <!-- Tab Header -->
            <div class="equipment-panel-tabs">
                <button class="equipment-tab active" data-tab="general">General</button>
                <button class="equipment-tab" data-tab="pcinfo">PC Info.</button>
            </div>
            
            <!-- Tab Content -->
            <div class="equipment-panel-content">
                <!-- General Tab -->
                <div id="tab-general" class="equipment-tab-content active">
                    <div id="generalTabContent">
                        <div class="info-row placeholder">
                            <span class="info-label">설비를 선택해주세요</span>
                        </div>
                    </div>
                </div>
                
                <!-- PC Info Tab -->
                <div id="tab-pcinfo" class="equipment-tab-content">
                    <div id="pcinfoTabContent">
                        <div class="info-row placeholder">
                            <span class="info-label">설비를 선택해주세요</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 요소 참조 업데이트
        this.equipNameEl = document.getElementById('equipName');
        this.generalTabContent = document.getElementById('generalTabContent');
        this.pcinfoTabContent = document.getElementById('pcinfoTabContent');
        
        // 🆕 v3.4.0: HeaderStatus 재연결 (DOM 재생성 시)
        if (this.headerStatus) {
            this.headerStatus.reconnect(this.panelEl);
        }
        
        // 이벤트 리스너 설정
        this._setupEventListeners();
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // 닫기 버튼
        const closeBtn = document.getElementById('equipmentInfoClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // Tab 버튼들
        const tabButtons = this.panelEl.querySelectorAll('.equipment-tab');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this._switchTab(tabName);
            });
        });
    }
    
    /**
     * Tab 전환
     * @private
     */
    _switchTab(tabName) {
        this.currentTab = tabName;
        
        // Tab 버튼 활성화 상태 변경
        const tabButtons = this.panelEl.querySelectorAll('.equipment-tab');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Tab 컨텐츠 표시/숨김
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
        
        // Multi Selection 상태 초기화
        this.selectedFrontendIds = [];
        this.selectedEquipmentIds = [];
        this.multiSelectionCache = null;
        
        // Duration Timer 정리
        this.durationTimer.stop();
        
        debugLog('📊 Equipment Info Panel hidden');
    }
    
    updateRealtime(updateData) {
        if (!this.isVisible) return;
        
        const incomingFrontendId = updateData.frontend_id;
        
        if (this.selectedCount === 1) {
            if (incomingFrontendId === this.currentFrontendId) {
                const mergedData = mergeEquipmentData(this.currentData, updateData);
                this.currentData = mergedData;
                
                // 🆕 v3.4.0: HeaderStatus 사용
                this.headerStatus.update(mergedData.status);
                
                this._updateGeneralTab(mergedData);
                this._updatePCInfoTab(mergedData);
                
                this.dataCache.set(this.currentFrontendId, {
                    data: mergedData,
                    timestamp: Date.now()
                });
                
                debugLog(`🔄 Real-time update (single): ${this.currentFrontendId} -> ${updateData.status}`);
            }
        } else if (this.selectedCount > 1) {
            if (this.selectedFrontendIds.includes(incomingFrontendId)) {
                this._updateMultiSelectionStatus(incomingFrontendId, updateData.status);
                debugLog(`🔄 Real-time update (multi): ${incomingFrontendId} -> ${updateData.status}`);
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
        
        this.durationTimer.stop();
        
        // 🆕 v3.4.0: HeaderStatus 사용
        this.headerStatus.show();
        
        this._updateHeader(frontendId);
        this.headerStatus.update(null);  // 로딩 중
        
        this._showLoading();
        
        try {
            const equipmentId = this._getEquipmentId(frontendId);
            this.currentEquipmentId = equipmentId;
            
            if (equipmentId) {
                this.selectedEquipmentIds = [equipmentId];
            }
            
            if (!equipmentId) {
                this._showUnmappedState(frontendId, equipmentData);
                this._showPCInfoUnmappedState();
                this.headerStatus.update('DISCONNECTED');
                return;
            }
            
            const cached = this._getFromCache(frontendId);
            if (cached) {
                this.currentData = cached;
                this._updateHeader(cached.equipment_name || frontendId);
                this.headerStatus.update(cached.status);
                this._updateGeneralTab(cached);
                this._updatePCInfoTab(cached);
                return;
            }
            
            const detailData = await this._fetchEquipmentDetail(frontendId, equipmentId);
            
            if (detailData) {
                this.currentData = detailData;
                this._saveToCache(frontendId, detailData);
                this._updateHeader(detailData.equipment_name || frontendId);
                this.headerStatus.update(detailData.status);
                this._updateGeneralTab(detailData);
                this._updatePCInfoTab(detailData);
            } else {
                this._showBasicInfo(frontendId, equipmentData);
                this._showPCInfoErrorState();
                this.headerStatus.update('DISCONNECTED');
            }
            
        } catch (error) {
            console.error('❌ Failed to load equipment detail:', error);
            this._showErrorState(frontendId, error.message);
            this._showPCInfoErrorState();
            this.headerStatus.update('DISCONNECTED');
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
        debugLog(`📡 Fetching equipment detail via API client: ${frontendId}, equipmentId=${equipmentId}`);
        
        return await equipmentDetailApi.getDetail(frontendId, {
            equipmentId: equipmentId
        });
    }
    
    // =========================================================================
    // General Tab
    // =========================================================================
    
    _updateGeneralTab(data) {
        if (!this.generalTabContent) return;
        
        this.currentData = data;
        const isLotActive = data.is_lot_active === true;
        
        let lotInfoHTML = '';
        
        if (isLotActive) {
            const durationDisplay = DurationTimer.format(data.lot_start_time);
            this._startDurationTimer(data.lot_start_time);
            
            lotInfoHTML = `
                <div class="info-row">
                    <span class="info-label">Product:</span>
                    <span class="info-value">${data.product_model || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Lot No.:</span>
                    <span class="info-value">${data.lot_id || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Lot Start:</span>
                    <span class="info-value">${DataFormatter.formatDateTime(data.lot_start_time) || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Lot Duration:</span>
                    <span class="info-value" id="durationDisplay">${durationDisplay}</span>
                </div>
            `;
        } else {
            const hasSinceTime = data.since_time != null;
            const durationDisplay = hasSinceTime ? DurationTimer.format(data.since_time) : '-';
            
            if (hasSinceTime) {
                this._startDurationTimer(data.since_time);
            } else {
                this.durationTimer.stop();
            }
            
            lotInfoHTML = `
                <div class="info-row">
                    <span class="info-label">Product:</span>
                    <span class="info-value">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Lot No.:</span>
                    <span class="info-value">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Since:</span>
                    <span class="info-value">${hasSinceTime ? DataFormatter.formatDateTime(data.since_time) : '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Duration:</span>
                    <span class="info-value" id="durationDisplay">${durationDisplay}</span>
                </div>
            `;
        }
        
        this.generalTabContent.innerHTML = `
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">${data.line_name || '-'}</span>
            </div>
            
            <div class="info-row-divider"></div>
            
            ${lotInfoHTML}
            
            ${data.last_updated ? `
            <div class="info-row info-row-meta">
                <span class="info-label">Updated:</span>
                <span class="info-value info-value-meta">${DataFormatter.formatDateTime(data.last_updated)}</span>
            </div>
            ` : ''}
        `;
        
        this.isLoading = false;
        debugLog(`✅ General tab updated: is_lot_active=${isLotActive}`);
    }
    
    _startDurationTimer(baseTime) {
        this.durationTimer.start(baseTime, (formatted) => {
            const durationEl = document.getElementById('durationDisplay');
            if (durationEl) {
                durationEl.textContent = formatted;
            }
        });
    }
    
    // =========================================================================
    // 🆕 v3.4.0: PC Info Tab (GaugeRenderer 사용)
    // =========================================================================
    
    /**
     * PC Info Tab 업데이트 (Single Selection)
     * @private
     */
    _updatePCInfoTab(data) {
        if (!this.pcinfoTabContent) return;
        
        // Boot Duration (DataFormatter 사용)
        const bootDuration = DataFormatter.formatBootDuration(data.last_boot_time);
        const bootDurationClass = DataFormatter.getBootDurationClass(data.last_boot_time);
        const cpuShortName = DataFormatter.shortenCpuName(data.cpu_name);
        
        // 🆕 v3.4.0: GaugeRenderer 사용하여 Gauge Section 렌더링
        const gaugeSection = GaugeRenderer.renderSection(data);
        
        this.pcinfoTabContent.innerHTML = `
            <!-- System Info -->
            <div class="pcinfo-system-row">
                <span class="info-label">CPU</span>
                <span class="info-value">${cpuShortName || '-'}<span class="value-separator">,</span>${data.cpu_logical_count || '-'} Cores</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">GPU</span>
                <span class="info-value info-value-small">${data.gpu_name || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">OS</span>
                <span class="info-value">${data.os_name || '-'}<span class="value-separator">,</span>${data.os_architecture || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">Boot</span>
                <span class="info-value">
                    <span class="boot-duration ${bootDurationClass}">
                        <span class="boot-duration-value">${bootDuration}</span>
                    </span>
                </span>
            </div>
            
            <!-- 🆕 v3.4.0: GaugeRenderer로 렌더링 -->
            ${gaugeSection}
            
            ${data.pc_last_update_time ? `
            <div class="info-row info-row-meta">
                <span class="info-label">Updated:</span>
                <span class="info-value info-value-meta">${DataFormatter.formatDateTime(data.pc_last_update_time)}</span>
            </div>
            ` : ''}
        `;
        
        debugLog(`✅ PC Info tab updated (v3.4.0 - GaugeRenderer)`);
    }
    
    /**
     * PC Info Tab 매핑 없음 상태
     * @private
     */
    _showPCInfoUnmappedState() {
        if (!this.pcinfoTabContent) return;
        
        this.pcinfoTabContent.innerHTML = `
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">DB에 연결되지 않은 설비입니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Memory:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Disk C:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Disk D:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">GPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">OS:</span>
                <span class="info-value">-</span>
            </div>
        `;
    }
    
    /**
     * PC Info Tab 에러 상태
     * @private
     */
    _showPCInfoErrorState() {
        if (!this.pcinfoTabContent) return;
        
        this.pcinfoTabContent.innerHTML = `
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">PC 정보를 불러올 수 없습니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Memory:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Disk C:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Disk D:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">GPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">OS:</span>
                <span class="info-value">-</span>
            </div>
        `;
    }
    
    // =========================================================================
    // General Tab 상태 표시
    // =========================================================================
    
    _showUnmappedState(frontendId, equipmentData) {
        if (!this.generalTabContent) return;
        
        this.generalTabContent.innerHTML = `
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">DB에 연결되지 않은 설비입니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">Frontend ID:</span>
                <span class="info-value">${frontendId}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Position:</span>
                <span class="info-value">Row ${equipmentData.position?.row || '-'}, Col ${equipmentData.position?.col || '-'}</span>
            </div>
            <div class="info-row unmapped-action">
                <span class="info-text">Edit Mode (E키)에서 매핑해주세요</span>
            </div>
        `;
        
        this.isLoading = false;
    }
    
    _showBasicInfo(frontendId, equipmentData) {
        if (!this.generalTabContent) return;
        
        this.generalTabContent.innerHTML = `
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row-divider"></div>
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Since:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Duration:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row info-row-warning">
                <span class="info-icon">ℹ️</span>
                <span class="info-text">상세 정보를 불러올 수 없습니다</span>
            </div>
        `;
        
        this.isLoading = false;
    }
    
    _showErrorState(frontendId, errorMessage) {
        if (!this.generalTabContent) return;
        
        this.generalTabContent.innerHTML = `
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">데이터 로드 실패</span>
            </div>
            <div class="info-row">
                <span class="info-label">Frontend ID:</span>
                <span class="info-value">${frontendId}</span>
            </div>
            <div class="info-row error-message">
                <span class="info-text">${errorMessage}</span>
            </div>
        `;
        
        this.isLoading = false;
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
        
        // 🆕 v3.4.0: HeaderStatus 사용
        this.headerStatus.hide();
        
        this.durationTimer.stop();
        this._showLoading();
        
        if (this.selectedEquipmentIds.length === 0) {
            this._showMultiUnmappedState(count);
            this._showMultiPCInfoUnmappedState(count);
            return;
        }
        
        try {
            const aggregatedData = await this._fetchMultiEquipmentDetail();
            
            if (aggregatedData) {
                this.multiSelectionCache = aggregatedData;
                this._updateGeneralTabMulti(aggregatedData, count);
                this._updatePCInfoTabMulti(aggregatedData, count);
            } else {
                this._showMultiErrorState(count);
                this._showMultiPCInfoErrorState(count);
            }
            
        } catch (error) {
            console.error('❌ Failed to load multi equipment detail:', error);
            this._showMultiErrorState(count, error.message);
            this._showMultiPCInfoErrorState(count);
        }
    }
    
    async _fetchMultiEquipmentDetail() {
        debugLog(`📡 Fetching multi equipment detail via API client: ${this.selectedFrontendIds.length} items`);
        
        return await equipmentDetailApi.getMultiDetail(this.selectedFrontendIds, {
            equipmentIds: this.selectedEquipmentIds
        });
    }
    
    _updateGeneralTabMulti(data, totalCount) {
        if (!this.generalTabContent) return;
        
        const linesDisplay = DataFormatter.formatListWithMore(data.lines, data.lines_more);
        const statusDisplay = this._formatStatusCounts(data.status_counts);
        const productsDisplay = DataFormatter.formatListWithMore(data.products, data.products_more);
        const lotIdsDisplay = DataFormatter.formatListWithMore(data.lot_ids, data.lot_ids_more);
        
        this.generalTabContent.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">📊</span>
                <span class="info-text">${totalCount}개 설비 집계 정보</span>
                <span class="info-badge">${data.count || this.selectedEquipmentIds.length}개 조회됨</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">${linesDisplay || '-'}</span>
            </div>
            
            <div class="info-row status-row">
                <span class="info-label">Status:</span>
                <div class="status-counts">
                    ${statusDisplay}
                </div>
            </div>
            
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">${productsDisplay || '-'}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">${lotIdsDisplay || '-'}</span>
            </div>
            
            <div class="info-row-spacer"></div>
        `;
        
        this.isLoading = false;
        debugLog(`✅ Multi selection tab updated: ${totalCount} items`);
    }
    
    /**
     * 🆕 v3.4.0: PC Info Tab 업데이트 (Multi Selection - GaugeRenderer 사용)
     * @private
     */
    _updatePCInfoTabMulti(data, totalCount) {
        if (!this.pcinfoTabContent) return;
        
        const cpuNamesDisplay = DataFormatter.formatListWithMore(data.cpu_names, data.cpu_names_more);
        const gpuNamesDisplay = DataFormatter.formatListWithMore(data.gpu_names, data.gpu_names_more);
        const osNamesDisplay = DataFormatter.formatListWithMore(data.os_names, data.os_names_more);
        
        // 🆕 v3.4.0: GaugeRenderer 사용하여 평균 Gauge Section 렌더링
        const gaugeSection = GaugeRenderer.renderSectionMulti(data);
        
        this.pcinfoTabContent.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">💻</span>
                <span class="info-text">${totalCount}개 설비 PC 정보</span>
            </div>
            
            <!-- System Info 요약 -->
            <div class="pcinfo-system-row">
                <span class="info-label">CPU</span>
                <span class="info-value info-value-small">${cpuNamesDisplay || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">GPU</span>
                <span class="info-value info-value-small">${gpuNamesDisplay || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">OS</span>
                <span class="info-value">${osNamesDisplay || '-'}</span>
            </div>
            
            <!-- 🆕 v3.4.0: GaugeRenderer로 렌더링 -->
            ${gaugeSection}
        `;
        
        debugLog(`✅ Multi PC Info tab updated (v3.4.0 - GaugeRenderer)`);
    }
    
    _showMultiPCInfoUnmappedState(count) {
        if (!this.pcinfoTabContent) return;
        
        this.pcinfoTabContent.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">💻</span>
                <span class="info-text">${count}개 설비 PC 정보</span>
            </div>
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">DB에 연결되지 않은 설비입니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Memory:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Disk C:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Disk D:</span>
                <span class="info-value">-</span>
            </div>
        `;
    }
    
    _showMultiPCInfoErrorState(count) {
        if (!this.pcinfoTabContent) return;
        
        this.pcinfoTabContent.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">💻</span>
                <span class="info-text">${count}개 설비 PC 정보</span>
            </div>
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">PC 정보를 불러올 수 없습니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Memory:</span>
                <span class="info-value">-</span>
            </div>
        `;
    }
    
    /**
     * Status 집계를 아이콘+숫자 형식으로 포맷
     * 🆕 v3.4.0: HeaderStatus.getConfig() 사용
     * @private
     */
    _formatStatusCounts(statusCounts) {
        if (!statusCounts || Object.keys(statusCounts).length === 0) {
            return '<span class="status-count-item">-</span>';
        }
        
        const sortOrder = ['RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED'];
        
        return sortOrder
            .filter(status => statusCounts[status] > 0)
            .map(status => {
                // 🆕 v3.4.0: HeaderStatus 정적 메서드 사용
                const config = HeaderStatus.getConfig(status);
                return `
                    <span class="status-count-item ${config.class}">
                        <span class="status-count-icon">${config.icon}</span>
                        <span class="status-count-number">${statusCounts[status]}</span>
                    </span>
                `;
            })
            .join('');
    }
    
    _showMultiUnmappedState(count) {
        if (!this.generalTabContent) return;
        
        this.generalTabContent.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">📊</span>
                <span class="info-text">${count}개 설비 선택됨</span>
            </div>
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">선택된 설비가 모두 DB에 연결되지 않았습니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row unmapped-action">
                <span class="info-text">Edit Mode (E키)에서 매핑해주세요</span>
            </div>
        `;
        
        this.isLoading = false;
    }
    
    _showMultiErrorState(count, errorMessage = '') {
        if (!this.generalTabContent) return;
        
        this.generalTabContent.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">📊</span>
                <span class="info-text">${count}개 설비 선택됨</span>
            </div>
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">집계 데이터 로드 실패</span>
            </div>
            ${errorMessage ? `
            <div class="info-row error-message">
                <span class="info-text">${errorMessage}</span>
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">-</span>
            </div>
        `;
        
        this.isLoading = false;
    }
    
    _updateMultiSelectionStatus(frontendId, newStatus) {
        if (!this.multiSelectionCache || !this.multiSelectionCache.status_counts) {
            return;
        }
        
        debugLog(`🔄 Multi selection status update needed: ${frontendId} -> ${newStatus}`);
        this._debounceRefreshMulti();
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
                        this._updateGeneralTabMulti(aggregatedData, this.selectedCount);
                        this._updatePCInfoTabMulti(aggregatedData, this.selectedCount);
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
    
    _showLoading() {
        this.isLoading = true;
        
        const loadingHTML = `
            <div class="loading-container">
                <div class="loading-spinner-small"></div>
                <span class="loading-text">Loading...</span>
            </div>
        `;
        
        if (this.generalTabContent) {
            this.generalTabContent.innerHTML = loadingHTML;
        }
        
        if (this.pcinfoTabContent) {
            this.pcinfoTabContent.innerHTML = loadingHTML;
        }
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
        debugLog(`📡 EquipmentInfoPanel API base URL changed to: ${baseUrl}`);
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
        
        this.durationTimer.dispose();
        
        // 🆕 v3.4.0: HeaderStatus 정리
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