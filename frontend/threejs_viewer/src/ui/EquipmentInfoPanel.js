/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Tab UI + Backend API 연동)
 * 
 * @version 1.3.0
 * @description
 * - Tab Interface: General / PC Info.
 * - Single Selection: Backend API에서 상세 정보 조회
 * - Multi Selection: Backend API에서 집계 정보 조회
 * 
 * @changelog
 * - v1.3.0: WebSocket 실시간 업데이트 개선 (Phase 4 완성)
 *           - 헤더에 EquipmentName 표시 (Frontend ID 대신)
 *           - LineName은 초기 값 유지 (불변)
 *           - WebSocket 메시지와 기존 데이터 병합
 *           - Lot/Product 실시간 업데이트 지원
 *           - currentData 멤버 변수 추가 (초기 데이터 저장)
 * - v1.2.0: Multi Selection 집계 기능 구현 (Phase 3)
 * - v1.1.0: API 호출 시 equipment_id 쿼리 파라미터 전달 추가
 * - v1.0.0: 초기 버전 - Tab UI, Backend API 연동
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/EquipmentInfoPanel.js
 * 작성일: 2026-01-06
 * 수정일: 2026-01-08
 */

import { debugLog } from '../core/utils/Config.js';

export class EquipmentInfoPanel {
    constructor(options = {}) {
        // DOM 요소
        this.panelEl = document.getElementById('equipmentInfo');
        this.equipNameEl = document.getElementById('equipName');
        this.equipDetailsEl = document.getElementById('equipDetails');
        
        // API 설정
        this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:8000/api/equipment/detail';
        
        // 상태
        this.isVisible = false;
        this.currentTab = 'general';  // 'general' | 'pcinfo'
        this.currentFrontendId = null;
        this.currentEquipmentId = null;
        this.selectedCount = 0;
        
        // 🆕 v1.3.0: 현재 표시 중인 전체 데이터 (WebSocket 병합용)
        this.currentData = null;
        
        // 🆕 v1.2.0: Multi Selection 상태
        this.selectedFrontendIds = [];
        this.selectedEquipmentIds = [];
        this.multiSelectionCache = null;  // 집계 결과 캐시
        
        // 캐시
        this.dataCache = new Map();
        this.cacheExpiry = 30000;  // 30초
        
        // 의존성 (나중에 주입)
        this.equipmentEditState = null;
        
        // 로딩 상태
        this.isLoading = false;
        
        // 초기화
        this._init();
        
        debugLog('📊 EquipmentInfoPanel initialized (v1.3.0)');
    }
    
    // =========================================================================
    // 초기화
    // =========================================================================
    
    _init() {
        // 패널 구조 재생성 (Tab UI 추가)
        this._rebuildPanelStructure();
        
        // 전역 함수 노출
        this._exposeGlobalFunctions();
    }
    
    /**
     * 패널 구조 재생성 (Tab UI 포함)
     * @private
     */
    _rebuildPanelStructure() {
        if (!this.panelEl) {
            console.warn('⚠️ Equipment Info Panel element not found');
            return;
        }
        
        // 기존 내용 백업 후 새 구조로 교체
        this.panelEl.innerHTML = `
            <button class="close-btn" id="equipmentInfoClose">×</button>
            <h2 id="equipName" class="equipment-panel-title">설비 정보</h2>
            
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
                            <span class="info-label">PC 정보 (추후 확장 예정)</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 요소 참조 업데이트
        this.equipNameEl = document.getElementById('equipName');
        this.generalTabContent = document.getElementById('generalTabContent');
        this.pcinfoTabContent = document.getElementById('pcinfoTabContent');
        
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
    
    /**
     * EquipmentEditState 설정 (매핑 정보 조회용)
     * @param {Object} equipmentEditState 
     */
    setEquipmentEditState(equipmentEditState) {
        this.equipmentEditState = equipmentEditState;
        debugLog('🔗 EquipmentEditState connected to EquipmentInfoPanel');
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    /**
     * 설비 정보 표시 (단일 또는 다중 선택)
     * @param {Array<Object>|Object} equipmentData - 설비 데이터 (배열 또는 단일 객체)
     */
    async show(equipmentData) {
        // 배열이 아니면 배열로 변환
        const dataArray = Array.isArray(equipmentData) ? equipmentData : [equipmentData];
        
        if (dataArray.length === 0) {
            this.hide();
            return;
        }
        
        this.selectedCount = dataArray.length;
        
        if (dataArray.length === 1) {
            // ✅ Single Selection: Backend API 호출
            await this._showSingleEquipment(dataArray[0]);
        } else {
            // ✅ Multi Selection: Backend API 집계 호출 (v1.2.0)
            await this._showMultipleEquipment(dataArray);
        }
        
        // 패널 표시
        this._showPanel();
    }
    
    /**
     * 패널 숨기기
     */
    hide() {
        if (this.panelEl) {
            this.panelEl.classList.remove('active');
            this.isVisible = false;
        }
        
        // 상태 초기화
        this.currentFrontendId = null;
        this.currentEquipmentId = null;
        this.selectedCount = 0;
        
        // 🆕 v1.3.0: currentData 초기화
        this.currentData = null;
        
        // 🆕 v1.2.0: Multi Selection 상태 초기화
        this.selectedFrontendIds = [];
        this.selectedEquipmentIds = [];
        this.multiSelectionCache = null;
        
        debugLog('📊 Equipment Info Panel hidden');
    }
    
    /**
     * ⭐ v1.3.0: 실시간 업데이트 (WebSocket에서 호출) - 개선된 버전
     * @param {Object} updateData - 업데이트 데이터
     */
    updateRealtime(updateData) {
        if (!this.isVisible) return;
        
        const incomingFrontendId = updateData.frontend_id;
        
        // 🆕 v1.2.0: Single vs Multi Selection 분기
        if (this.selectedCount === 1) {
            // Single Selection: 현재 표시 중인 설비와 일치하면 업데이트
            if (incomingFrontendId === this.currentFrontendId) {
                
                // ⭐ v1.3.0: 기존 데이터와 병합 (LineName은 초기 값 유지)
                const mergedData = this._mergeWithCurrentData(updateData);
                
                // 병합된 데이터로 UI 업데이트
                this._updateGeneralTab(mergedData);
                
                // 캐시 업데이트
                this.dataCache.set(this.currentFrontendId, {
                    data: mergedData,
                    timestamp: Date.now()
                });
                
                debugLog(`🔄 Real-time update (single): ${this.currentFrontendId} -> ${updateData.status}`);
            }
        } else if (this.selectedCount > 1) {
            // Multi Selection: 선택된 설비 중 하나면 집계 재계산
            if (this.selectedFrontendIds.includes(incomingFrontendId)) {
                this._updateMultiSelectionStatus(incomingFrontendId, updateData.status);
                debugLog(`🔄 Real-time update (multi): ${incomingFrontendId} -> ${updateData.status}`);
            }
        }
    }
    
    /**
     * ⭐ v1.3.0: WebSocket 데이터와 현재 데이터 병합
     * @private
     * @param {Object} updateData - WebSocket에서 받은 데이터
     * @returns {Object} 병합된 데이터
     */
    _mergeWithCurrentData(updateData) {
        // 현재 데이터가 없으면 업데이트 데이터 그대로 반환
        if (!this.currentData) {
            return updateData;
        }
        
        // 병합 규칙:
        // - Status: 항상 새 값으로 업데이트
        // - LineName: 초기 값 유지 (불변) ← 요구사항 #2
        // - Product/Lot: 새 값이 있으면 업데이트, 없으면 기존 값 유지
        // - EquipmentName: 새 값이 있으면 업데이트 (헤더에도 반영)
        
        const mergedData = {
            // 기존 데이터 복사
            ...this.currentData,
            
            // Status는 항상 새 값으로 (핵심 업데이트 항목)
            status: updateData.status,
            
            // LineName은 초기 값 유지 (불변)
            line_name: this.currentData.line_name,
            
            // Product/Lot: 새 값이 있으면 업데이트, 없으면 기존 값 유지
            product_model: updateData.product_model || this.currentData.product_model,
            lot_id: updateData.lot_id || this.currentData.lot_id,
            
            // EquipmentName: 새 값이 있으면 업데이트
            equipment_name: updateData.equipment_name || this.currentData.equipment_name,
            
            // Timestamp 업데이트
            last_updated: updateData.last_updated || updateData.timestamp || new Date().toISOString()
        };
        
        debugLog(`📊 Data merged: status=${mergedData.status}, lot=${mergedData.lot_id}, product=${mergedData.product_model}`);
        
        return mergedData;
    }
    
    // =========================================================================
    // 내부 메서드 - Single Selection
    // =========================================================================
    
    /**
     * 단일 설비 정보 표시
     * @private
     */
    async _showSingleEquipment(equipmentData) {
        const frontendId = equipmentData.id || equipmentData.frontendId;
        this.currentFrontendId = frontendId;
        
        // Multi Selection 상태 초기화
        this.selectedFrontendIds = [frontendId];
        this.selectedEquipmentIds = [];
        
        // 🆕 v1.3.0: currentData 초기화
        this.currentData = null;
        
        // 헤더 업데이트 (임시로 Frontend ID 표시, API 응답 후 EquipmentName으로 변경)
        this._updateHeader(frontendId);
        
        // 로딩 표시
        this._showLoading();
        
        try {
            // 1. 매핑 정보 확인 (equipment_id 가져오기)
            const equipmentId = this._getEquipmentId(frontendId);
            this.currentEquipmentId = equipmentId;
            
            if (equipmentId) {
                this.selectedEquipmentIds = [equipmentId];
            }
            
            if (!equipmentId) {
                // 매핑되지 않은 설비
                this._showUnmappedState(frontendId, equipmentData);
                return;
            }
            
            // 2. 캐시 확인
            const cached = this._getFromCache(frontendId);
            if (cached) {
                // ⭐ v1.3.0: currentData 저장
                this.currentData = cached;
                
                // ⭐ v1.3.0: 헤더를 EquipmentName으로 업데이트
                this._updateHeader(cached.equipment_name || frontendId);
                
                this._updateGeneralTab(cached);
                return;
            }
            
            // 3. Backend API 호출 (v1.1.0: equipment_id 전달)
            const detailData = await this._fetchEquipmentDetail(frontendId, equipmentId);
            
            if (detailData) {
                // ⭐ v1.3.0: currentData 저장
                this.currentData = detailData;
                
                // 캐시에 저장
                this._saveToCache(frontendId, detailData);
                
                // ⭐ v1.3.0: 헤더를 EquipmentName으로 업데이트
                this._updateHeader(detailData.equipment_name || frontendId);
                
                // UI 업데이트
                this._updateGeneralTab(detailData);
            } else {
                // API 실패 시 기본 정보만 표시
                this._showBasicInfo(frontendId, equipmentData);
            }
            
        } catch (error) {
            console.error('❌ Failed to load equipment detail:', error);
            this._showErrorState(frontendId, error.message);
        }
    }
    
    /**
     * Equipment ID 조회 (매핑 정보에서)
     * @private
     */
    _getEquipmentId(frontendId) {
        if (!this.equipmentEditState) {
            debugLog('⚠️ EquipmentEditState not connected');
            return null;
        }
        
        const mapping = this.equipmentEditState.getMapping(frontendId);
        return mapping?.equipmentId || mapping?.equipment_id || null;
    }
    
    /**
     * Backend API 호출 (Single Selection)
     * @private
     * @param {string} frontendId - Frontend ID (예: EQ-13-01)
     * @param {number} equipmentId - Equipment ID (DB의 숫자 ID)
     */
    async _fetchEquipmentDetail(frontendId, equipmentId) {
        // v1.1.0: equipment_id를 쿼리 파라미터로 전달
        let url = `${this.apiBaseUrl}/${frontendId}`;
        
        if (equipmentId) {
            url += `?equipment_id=${equipmentId}`;
        }
        
        debugLog(`📡 Fetching equipment detail: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    }
    
    /**
     * ⭐ v1.3.0: General Tab 업데이트 (Single Selection) - currentData 저장 추가
     * @private
     */
    _updateGeneralTab(data) {
        if (!this.generalTabContent) return;
        
        // ⭐ v1.3.0: currentData 업데이트 (실시간 병합에 사용)
        this.currentData = data;
        
        // Status 표시 정보
        const statusDisplay = this._getStatusDisplay(data.status);
        
        this.generalTabContent.innerHTML = `
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">${data.line_name || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="status-indicator ${statusDisplay.class}"></span>
                <span class="info-value">${statusDisplay.text}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">${data.product_model || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">${data.lot_id || '-'}</span>
            </div>
            ${data.last_updated ? `
            <div class="info-row info-row-meta">
                <span class="info-label">Updated:</span>
                <span class="info-value info-value-meta">${this._formatDateTime(data.last_updated)}</span>
            </div>
            ` : ''}
            
            <!-- 추후 확장 영역 -->
            <div class="info-row-spacer"></div>
        `;
        
        this.isLoading = false;
        debugLog(`✅ General tab updated for: ${data.frontend_id || this.currentFrontendId}`);
    }
    
    /**
     * 매핑되지 않은 설비 상태 표시
     * @private
     */
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
    
    /**
     * 기본 정보만 표시 (API 실패 시)
     * @private
     */
    _showBasicInfo(frontendId, equipmentData) {
        if (!this.generalTabContent) return;
        
        this.generalTabContent.innerHTML = `
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
            <div class="info-row info-row-warning">
                <span class="info-icon">ℹ️</span>
                <span class="info-text">상세 정보를 불러올 수 없습니다</span>
            </div>
        `;
        
        this.isLoading = false;
    }
    
    /**
     * 에러 상태 표시
     * @private
     */
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
    // 🆕 v1.2.0: Multi Selection
    // =========================================================================
    
    /**
     * 다중 설비 정보 표시 (집계)
     * @private
     */
    async _showMultipleEquipment(dataArray) {
        const count = dataArray.length;
        
        // Frontend IDs 추출
        this.selectedFrontendIds = dataArray.map(item => item.id || item.frontendId);
        
        // Equipment IDs 조회 (Frontend 매핑에서)
        this.selectedEquipmentIds = this.selectedFrontendIds
            .map(fid => this._getEquipmentId(fid))
            .filter(eid => eid !== null);
        
        // 헤더 업데이트
        this._updateHeader(`${count}개 설비 선택됨`, true);
        
        // 로딩 표시
        this._showLoading();
        
        // 매핑된 설비가 하나도 없으면
        if (this.selectedEquipmentIds.length === 0) {
            this._showMultiUnmappedState(count);
            return;
        }
        
        try {
            // Backend API 호출 (집계)
            const aggregatedData = await this._fetchMultiEquipmentDetail();
            
            if (aggregatedData) {
                // 캐시에 저장
                this.multiSelectionCache = aggregatedData;
                
                // UI 업데이트
                this._updateGeneralTabMulti(aggregatedData, count);
            } else {
                this._showMultiErrorState(count);
            }
            
        } catch (error) {
            console.error('❌ Failed to load multi equipment detail:', error);
            this._showMultiErrorState(count, error.message);
        }
    }
    
    /**
     * Backend API 호출 (Multi Selection)
     * @private
     */
    async _fetchMultiEquipmentDetail() {
        const url = `${this.apiBaseUrl}/multi`;
        
        // 🆕 v1.2.0: equipment_ids를 Body에 포함 (Frontend 매핑 우선)
        const requestBody = {
            frontend_ids: this.selectedFrontendIds,
            equipment_ids: this.selectedEquipmentIds  // ⭐ ID 불일치 문제 해결
        };
        
        debugLog(`📡 Fetching multi equipment detail: ${url}`, requestBody);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    }
    
    /**
     * General Tab 업데이트 (Multi Selection - 집계)
     * @private
     */
    _updateGeneralTabMulti(data, totalCount) {
        if (!this.generalTabContent) return;
        
        // Lines 표시 (최대 3개, "외 N개")
        const linesDisplay = this._formatListWithMore(data.lines, data.lines_more);
        
        // Status 집계 표시
        const statusDisplay = this._formatStatusCounts(data.status_counts);
        
        // Products 표시 (최대 3개, "외 N개")
        const productsDisplay = this._formatListWithMore(data.products, data.products_more);
        
        // Lot IDs 표시 (최대 3개, "외 N개")
        const lotIdsDisplay = this._formatListWithMore(data.lot_ids, data.lot_ids_more);
        
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
            
            <!-- 추후 확장 영역 (여백 확보) -->
            <div class="info-row-spacer"></div>
            <div class="info-row-spacer"></div>
        `;
        
        this.isLoading = false;
        debugLog(`✅ Multi selection tab updated: ${totalCount} items`);
    }
    
    /**
     * 리스트를 "외 N개" 형식으로 포맷
     * @private
     */
    _formatListWithMore(items, hasMore) {
        if (!items || items.length === 0) {
            return '-';
        }
        
        // 최대 3개 표시
        const displayItems = items.slice(0, 3);
        let result = displayItems.join(', ');
        
        // "외 N개" 추가
        if (hasMore || items.length > 3) {
            const moreCount = items.length > 3 ? items.length - 3 : '...';
            result += ` <span class="more-count">외 ${moreCount}개</span>`;
        }
        
        return result;
    }
    
    /**
     * Status 집계를 아이콘+숫자 형식으로 포맷
     * @private
     */
    _formatStatusCounts(statusCounts) {
        if (!statusCounts || Object.keys(statusCounts).length === 0) {
            return '<span class="status-count-item">-</span>';
        }
        
        const statusConfig = {
            'RUN': { icon: '🟢', class: 'status-running', label: 'RUN' },
            'IDLE': { icon: '🟡', class: 'status-idle', label: 'IDLE' },
            'STOP': { icon: '🔴', class: 'status-stop', label: 'STOP' },
            'SUDDENSTOP': { icon: '⚠️', class: 'status-error', label: 'ERROR' },
            'DISCONNECTED': { icon: '⚫', class: 'status-disconnected', label: 'DISC' }
        };
        
        // 정렬 순서: RUN > IDLE > STOP > SUDDENSTOP > DISCONNECTED
        const sortOrder = ['RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED'];
        
        return sortOrder
            .filter(status => statusCounts[status] > 0)
            .map(status => {
                const config = statusConfig[status] || { icon: '❓', class: '', label: status };
                return `
                    <span class="status-count-item ${config.class}">
                        <span class="status-count-icon">${config.icon}</span>
                        <span class="status-count-number">${statusCounts[status]}</span>
                    </span>
                `;
            })
            .join('');
    }
    
    /**
     * Multi Selection 매핑 없음 상태 표시
     * @private
     */
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
    
    /**
     * Multi Selection 에러 상태 표시
     * @private
     */
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
    
    /**
     * Multi Selection 실시간 Status 업데이트
     * @private
     */
    _updateMultiSelectionStatus(frontendId, newStatus) {
        if (!this.multiSelectionCache || !this.multiSelectionCache.status_counts) {
            return;
        }
        
        // TODO: 개별 설비의 이전 상태를 추적하여 집계 재계산
        // 현재는 간단히 다시 API 호출하는 방식으로 구현
        // (성능 최적화 필요 시 로컬 캐시에서 재계산 가능)
        
        debugLog(`🔄 Multi selection status update needed: ${frontendId} -> ${newStatus}`);
        
        // 집계 다시 로드 (debounce 적용 권장)
        this._debounceRefreshMulti();
    }
    
    /**
     * Multi Selection 새로고침 (debounce)
     * @private
     */
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
                    }
                } catch (error) {
                    console.error('❌ Failed to refresh multi selection:', error);
                }
            }
        }, 500);  // 500ms debounce
    }
    
    // =========================================================================
    // 헬퍼 메서드
    // =========================================================================
    
    /**
     * 헤더 업데이트
     * @private
     */
    _updateHeader(title, isMulti = false) {
        if (this.equipNameEl) {
            this.equipNameEl.textContent = title;
            this.equipNameEl.classList.toggle('multi-select', isMulti);
        }
    }
    
    /**
     * 로딩 표시
     * @private
     */
    _showLoading() {
        this.isLoading = true;
        
        if (this.generalTabContent) {
            this.generalTabContent.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner-small"></div>
                    <span class="loading-text">Loading...</span>
                </div>
            `;
        }
    }
    
    /**
     * 패널 표시
     * @private
     */
    _showPanel() {
        if (this.panelEl) {
            this.panelEl.classList.add('active');
            this.isVisible = true;
        }
    }
    
    /**
     * Status 표시 정보 반환 (Single Selection용)
     * @private
     */
    _getStatusDisplay(status) {
        const statusMap = {
            'RUN': { class: 'status-running', text: '가동 중 (RUN)' },
            'IDLE': { class: 'status-idle', text: '대기 (IDLE)' },
            'STOP': { class: 'status-stop', text: '정지 (STOP)' },
            'SUDDENSTOP': { class: 'status-error', text: '긴급 정지 (SUDDENSTOP)' },
            'DISCONNECTED': { class: 'status-disconnected', text: '연결 끊김' }
        };
        
        return statusMap[status] || { class: '', text: status || '-' };
    }
    
    /**
     * 날짜/시간 포맷
     * @private
     */
    _formatDateTime(isoString) {
        if (!isoString) return '-';
        
        try {
            const date = new Date(isoString);
            return date.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    }
    
    // =========================================================================
    // 캐시 관리
    // =========================================================================
    
    _getFromCache(frontendId) {
        const cached = this.dataCache.get(frontendId);
        if (!cached) return null;
        
        // 만료 확인
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
        this.currentData = null;  // 🆕 v1.3.0
        debugLog('🗑️ Equipment info cache cleared');
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
        
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        
        debugLog('📊 EquipmentInfoPanel disposed');
    }
}