/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Tab UI + Backend API 연동)
 * 
 * @version 2.0.0
 * @description
 * - Tab Interface: General / PC Info.
 * - Single Selection: Backend API에서 상세 정보 조회
 * - Multi Selection: Backend API에서 집계 정보 조회
 * 
 * @changelog
 * - v2.0.0: General Tab 확장 + PC Info Tab 구현
 *           - lot_start_time 표시 + Duration Timer (실시간 계산)
 *           - PC Info Tab: CPU Gauge + 고정 정보 표시
 *           - WebSocket 메시지 확장 (lot_start_time, cpu_usage_percent)
 *           - Multi Selection: PC Info 집계 (avg_cpu_usage_percent)
 * - v1.3.0: WebSocket 실시간 업데이트 개선 (Phase 4 완성)
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
        
        // 🆕 v2.0.0: Duration Timer 관련
        this.durationTimerInterval = null;
        this.lotStartTime = null;  // ISO string
        
        // 초기화
        this._init();
        
        debugLog('📊 EquipmentInfoPanel initialized (v2.0.0)');
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
        
        // 🆕 v2.0.0: Duration Timer 정리
        this._stopDurationTimer();
        
        debugLog('📊 Equipment Info Panel hidden');
    }
    
    /**
     * ⭐ v2.0.0: 실시간 업데이트 (WebSocket에서 호출) - 확장된 버전
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
                
                // 🆕 v2.0.0: PC Info Tab도 업데이트 (cpu_usage_percent)
                this._updatePCInfoTab(mergedData);
                
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
     * ⭐ v2.0.0: WebSocket 데이터와 현재 데이터 병합 - 확장
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
        // - 🆕 v2.0.0: lot_start_time, cpu_usage_percent 병합
        
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
            
            // 🆕 v2.0.0: lot_start_time 병합
            lot_start_time: updateData.lot_start_time || this.currentData.lot_start_time,
            
            // 🆕 v2.0.0: CPU 사용율 병합 (실시간 갱신)
            cpu_usage_percent: updateData.cpu_usage_percent !== undefined 
                ? updateData.cpu_usage_percent 
                : this.currentData.cpu_usage_percent,
            
            // Timestamp 업데이트
            last_updated: updateData.last_updated || updateData.timestamp || new Date().toISOString()
        };
        
        debugLog(`📊 Data merged: status=${mergedData.status}, lot=${mergedData.lot_id}, cpu=${mergedData.cpu_usage_percent}%`);
        
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
        
        // 🆕 v2.0.0: Duration Timer 정리
        this._stopDurationTimer();
        
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
                this._showPCInfoUnmappedState();
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
                this._updatePCInfoTab(cached);  // 🆕 v2.0.0
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
                this._updatePCInfoTab(detailData);  // 🆕 v2.0.0
            } else {
                // API 실패 시 기본 정보만 표시
                this._showBasicInfo(frontendId, equipmentData);
                this._showPCInfoErrorState();
            }
            
        } catch (error) {
            console.error('❌ Failed to load equipment detail:', error);
            this._showErrorState(frontendId, error.message);
            this._showPCInfoErrorState();
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
     * ⭐ v2.0.0: General Tab 업데이트 (Single Selection) - 확장
     * @private
     */
    _updateGeneralTab(data) {
        if (!this.generalTabContent) return;
        
        // ⭐ v1.3.0: currentData 업데이트 (실시간 병합에 사용)
        this.currentData = data;
        
        // Status 표시 정보
        const statusDisplay = this._getStatusDisplay(data.status);
        
        // 🆕 v2.0.0: Duration 계산 및 Timer 시작
        const durationDisplay = this._formatDuration(data.lot_start_time);
        this._startDurationTimer(data.lot_start_time);
        
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
            
            <!-- 🆕 v2.0.0: Lot Start Time + Duration -->
            <div class="info-row">
                <span class="info-label">Lot Start:</span>
                <span class="info-value">${this._formatDateTime(data.lot_start_time) || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Duration:</span>
                <span class="info-value" id="durationDisplay">${durationDisplay}</span>
            </div>
            
            ${data.last_updated ? `
            <div class="info-row info-row-meta">
                <span class="info-label">Updated:</span>
                <span class="info-value info-value-meta">${this._formatDateTime(data.last_updated)}</span>
            </div>
            ` : ''}
        `;
        
        this.isLoading = false;
        debugLog(`✅ General tab updated for: ${data.frontend_id || this.currentFrontendId}`);
    }
    
    // =========================================================================
    // 🆕 v2.0.0: PC Info Tab
    // =========================================================================
    
    /**
     * 🆕 v2.0.0: PC Info Tab 업데이트 (Single Selection)
     * @private
     */
    _updatePCInfoTab(data) {
        if (!this.pcinfoTabContent) return;
        
        // CPU 사용율 Gauge 계산
        const cpuPercent = data.cpu_usage_percent ?? 0;
        const cpuGaugeColor = this._getCPUGaugeColor(cpuPercent);
        
        this.pcinfoTabContent.innerHTML = `
            <!-- CPU Usage Gauge -->
            <div class="info-row pc-gauge-row">
                <span class="info-label">CPU Usage:</span>
                <div class="cpu-gauge-container">
                    <div class="cpu-gauge-bar">
                        <div class="cpu-gauge-fill ${cpuGaugeColor}" style="width: ${cpuPercent}%"></div>
                    </div>
                    <span class="cpu-gauge-value" id="cpuGaugeValue">${cpuPercent !== null ? cpuPercent.toFixed(1) + '%' : '-'}</span>
                </div>
            </div>
            
            <div class="info-row-divider"></div>
            
            <!-- CPU Info -->
            <div class="info-row">
                <span class="info-label">CPU:</span>
                <span class="info-value info-value-small">${data.cpu_name || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Cores:</span>
                <span class="info-value">${data.cpu_logical_count || '-'}</span>
            </div>
            
            <div class="info-row-divider"></div>
            
            <!-- GPU Info -->
            <div class="info-row">
                <span class="info-label">GPU:</span>
                <span class="info-value info-value-small">${data.gpu_name || '-'}</span>
            </div>
            
            <div class="info-row-divider"></div>
            
            <!-- OS Info -->
            <div class="info-row">
                <span class="info-label">OS:</span>
                <span class="info-value">${data.os_name || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Arch:</span>
                <span class="info-value">${data.os_architecture || '-'}</span>
            </div>
            
            <div class="info-row-divider"></div>
            
            <!-- Boot Time -->
            <div class="info-row">
                <span class="info-label">Last Boot:</span>
                <span class="info-value info-value-small">${this._formatDateTime(data.last_boot_time) || '-'}</span>
            </div>
            
            ${data.pc_last_update_time ? `
            <div class="info-row info-row-meta">
                <span class="info-label">PC Updated:</span>
                <span class="info-value info-value-meta">${this._formatDateTime(data.pc_last_update_time)}</span>
            </div>
            ` : ''}
        `;
        
        debugLog(`✅ PC Info tab updated: CPU=${cpuPercent}%`);
    }
    
    /**
     * 🆕 v2.0.0: CPU Gauge 색상 결정
     * @private
     */
    _getCPUGaugeColor(percent) {
        if (percent === null || percent === undefined) return 'gauge-gray';
        if (percent < 50) return 'gauge-green';
        if (percent < 80) return 'gauge-yellow';
        return 'gauge-red';
    }
    
    /**
     * 🆕 v2.0.0: PC Info Tab 매핑 없음 상태
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
                <span class="info-label">CPU Usage:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">CPU:</span>
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
     * 🆕 v2.0.0: PC Info Tab 에러 상태
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
                <span class="info-label">CPU Usage:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">CPU:</span>
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
    // 🆕 v2.0.0: Duration Timer
    // =========================================================================
    
    /**
     * 🆕 v2.0.0: Duration Timer 시작
     * @private
     */
    _startDurationTimer(lotStartTime) {
        // 기존 타이머 정리
        this._stopDurationTimer();
        
        if (!lotStartTime) return;
        
        this.lotStartTime = lotStartTime;
        
        // 1초마다 업데이트
        this.durationTimerInterval = setInterval(() => {
            this._updateDurationDisplay();
        }, 1000);
        
        debugLog(`⏱️ Duration timer started: ${lotStartTime}`);
    }
    
    /**
     * 🆕 v2.0.0: Duration Timer 정지
     * @private
     */
    _stopDurationTimer() {
        if (this.durationTimerInterval) {
            clearInterval(this.durationTimerInterval);
            this.durationTimerInterval = null;
        }
        this.lotStartTime = null;
    }
    
    /**
     * 🆕 v2.0.0: Duration 표시 업데이트
     * @private
     */
    _updateDurationDisplay() {
        const durationEl = document.getElementById('durationDisplay');
        if (!durationEl || !this.lotStartTime) return;
        
        durationEl.textContent = this._formatDuration(this.lotStartTime);
    }
    
    /**
     * 🆕 v2.0.0: Duration 포맷 (HH:MM:SS)
     * @private
     */
    _formatDuration(startTimeStr) {
        if (!startTimeStr) return '-';
        
        try {
            const startTime = new Date(startTimeStr);
            const now = new Date();
            
            // 밀리초 차이 계산
            let diffMs = now - startTime;
            
            // 음수면 (미래 시간이면) 0으로
            if (diffMs < 0) diffMs = 0;
            
            // 시, 분, 초 계산
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            // HH:MM:SS 포맷
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
        } catch (e) {
            return '-';
        }
    }
    
    // =========================================================================
    // 기존 메서드 - General Tab 상태 표시
    // =========================================================================
    
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
            <div class="info-row">
                <span class="info-label">Lot Start:</span>
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
    // 🆕 v1.2.0: Multi Selection - v2.0.0 확장
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
        
        // 🆕 v2.0.0: Duration Timer 정리 (Multi Selection에서는 사용 안함)
        this._stopDurationTimer();
        
        // 로딩 표시
        this._showLoading();
        
        // 매핑된 설비가 하나도 없으면
        if (this.selectedEquipmentIds.length === 0) {
            this._showMultiUnmappedState(count);
            this._showMultiPCInfoUnmappedState(count);
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
                this._updatePCInfoTabMulti(aggregatedData, count);  // 🆕 v2.0.0
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
            
            <!-- Multi Selection에서는 Duration 표시 안함 -->
            <div class="info-row-spacer"></div>
        `;
        
        this.isLoading = false;
        debugLog(`✅ Multi selection tab updated: ${totalCount} items`);
    }
    
    /**
     * 🆕 v2.0.0: PC Info Tab 업데이트 (Multi Selection - 집계)
     * @private
     */
    _updatePCInfoTabMulti(data, totalCount) {
        if (!this.pcinfoTabContent) return;
        
        // 평균 CPU 사용율
        const avgCpu = data.avg_cpu_usage_percent;
        const cpuGaugeColor = this._getCPUGaugeColor(avgCpu);
        
        // CPU 이름 목록
        const cpuNamesDisplay = this._formatListWithMore(data.cpu_names, data.cpu_names_more);
        
        // GPU 이름 목록
        const gpuNamesDisplay = this._formatListWithMore(data.gpu_names, data.gpu_names_more);
        
        // OS 이름 목록
        const osNamesDisplay = this._formatListWithMore(data.os_names, data.os_names_more);
        
        this.pcinfoTabContent.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">💻</span>
                <span class="info-text">${totalCount}개 설비 PC 정보</span>
            </div>
            
            <!-- 평균 CPU Usage Gauge -->
            <div class="info-row pc-gauge-row">
                <span class="info-label">Avg CPU:</span>
                <div class="cpu-gauge-container">
                    <div class="cpu-gauge-bar">
                        <div class="cpu-gauge-fill ${cpuGaugeColor}" style="width: ${avgCpu || 0}%"></div>
                    </div>
                    <span class="cpu-gauge-value">${avgCpu !== null && avgCpu !== undefined ? avgCpu.toFixed(1) + '%' : '-'}</span>
                </div>
            </div>
            
            <div class="info-row-divider"></div>
            
            <!-- CPU 이름 목록 -->
            <div class="info-row">
                <span class="info-label">CPU:</span>
                <span class="info-value info-value-small">${cpuNamesDisplay || '-'}</span>
            </div>
            
            <!-- GPU 이름 목록 -->
            <div class="info-row">
                <span class="info-label">GPU:</span>
                <span class="info-value info-value-small">${gpuNamesDisplay || '-'}</span>
            </div>
            
            <!-- OS 이름 목록 -->
            <div class="info-row">
                <span class="info-label">OS:</span>
                <span class="info-value">${osNamesDisplay || '-'}</span>
            </div>
        `;
        
        debugLog(`✅ Multi PC Info tab updated: avg_cpu=${avgCpu}%`);
    }
    
    /**
     * 🆕 v2.0.0: Multi Selection PC Info 매핑 없음
     * @private
     */
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
                <span class="info-label">CPU:</span>
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
     * 🆕 v2.0.0: Multi Selection PC Info 에러
     * @private
     */
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
                <span class="info-label">CPU:</span>
                <span class="info-value">-</span>
            </div>
        `;
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
                        this._updatePCInfoTabMulti(aggregatedData, this.selectedCount);  // 🆕 v2.0.0
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
        
        // 🆕 v2.0.0: PC Info Tab도 로딩 표시
        if (this.pcinfoTabContent) {
            this.pcinfoTabContent.innerHTML = `
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
        
        // 🆕 v2.0.0: Duration Timer 정리
        this._stopDurationTimer();
        
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        
        debugLog('📊 EquipmentInfoPanel disposed');
    }
}