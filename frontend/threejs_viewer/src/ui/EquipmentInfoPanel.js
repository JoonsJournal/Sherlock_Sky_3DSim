/**
 * EquipmentInfoPanel.js
 * =====================
 * 설비 상세 정보 패널 (Tab UI + Backend API 연동)
 * 
 * @version 3.3.0
 * @description
 * - Tab Interface: General / PC Info.
 * - Single Selection: Backend API에서 상세 정보 조회
 * - Multi Selection: Backend API에서 집계 정보 조회
 * - 🆕 v3.3.0: 유틸리티 모듈 분리 통합
 *   - DurationTimer.js: Duration 타이머 로직
 *   - DataFormatter.js: 데이터 포맷팅 유틸리티
 *   - DataMerger.js: WebSocket 데이터 병합
 * - v3.2.0: equipmentDetailApi.js 통합
 * - v3.1.0: PC Info Tab 레이아웃 개선
 * - v3.0.0: Memory, Disk Gauge 추가 (PC Info Tab 확장)
 * - v2.1.0: Status를 헤더로 이동 + Lot Active/Inactive 분기
 * 
 * @changelog
 * - v3.3.0: 유틸리티 모듈 분리 통합
 *           - 🆕 DurationTimer 클래스 사용 (콜백 패턴)
 *           - 🆕 DataFormatter 유틸리티 사용
 *           - 🆕 mergeEquipmentData 함수 사용
 *           - ⚠️ 호환성: 기존 모든 기능/메서드 100% 유지
 *           - 코드량 약 150줄 감소
 * - v3.2.0: equipmentDetailApi.js 통합
 * - v3.1.0: PC Info Tab 레이아웃 개선
 * - v3.0.0: PC Info Tab 확장 - Memory, Disk Gauge 추가
 * - v2.1.0: Status 헤더 이동 + Lot Active/Inactive 분기
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/EquipmentInfoPanel.js
 * 작성일: 2026-01-06
 * 수정일: 2026-01-09
 */

import { debugLog } from '../core/utils/Config.js';
// v3.2.0: API 클라이언트 import
import { equipmentDetailApi } from '../api/equipmentDetailApi.js';
// 🆕 v3.3.0: 유틸리티 모듈 import
import { DurationTimer } from './equipment-info/utils/DurationTimer.js';
import { DataFormatter } from './equipment-info/utils/DataFormatter.js';
import { mergeEquipmentData } from './equipment-info/utils/DataMerger.js';

export class EquipmentInfoPanel {
    constructor(options = {}) {
        // DOM 요소
        this.panelEl = document.getElementById('equipmentInfo');
        this.equipNameEl = null;
        this.equipDetailsEl = null;
        
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
        this.multiSelectionCache = null;  // 집계 결과 캐시
        
        // 캐시
        this.dataCache = new Map();
        this.cacheExpiry = 30000;  // 30초
        
        // 의존성 (나중에 주입)
        this.equipmentEditState = null;
        
        // 로딩 상태
        this.isLoading = false;
        
        // 🆕 v3.3.0: Duration Timer 인스턴스
        this.durationTimer = new DurationTimer();
        
        // 초기화
        this._init();
        
        debugLog('📊 EquipmentInfoPanel initialized (v3.3.0 - Utils Integration)');
    }
    
    // =========================================================================
    // 초기화
    // =========================================================================
    
    _init() {
        // 패널 구조 재생성 (Tab UI + Header Status 추가)
        this._rebuildPanelStructure();
        
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
        this.headerStatusEl = document.getElementById('headerStatus');
        this.headerStatusIndicator = document.getElementById('headerStatusIndicator');
        this.headerStatusText = document.getElementById('headerStatusText');
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
            // ✅ Multi Selection: Backend API 집계 호출
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
        this.currentData = null;
        
        // Multi Selection 상태 초기화
        this.selectedFrontendIds = [];
        this.selectedEquipmentIds = [];
        this.multiSelectionCache = null;
        
        // 🆕 v3.3.0: Duration Timer 정리 (인스턴스 메서드 호출)
        this.durationTimer.stop();
        
        debugLog('📊 Equipment Info Panel hidden');
    }
    
    /**
     * 실시간 업데이트 (WebSocket에서 호출)
     * @param {Object} updateData - 업데이트 데이터
     */
    updateRealtime(updateData) {
        if (!this.isVisible) return;
        
        const incomingFrontendId = updateData.frontend_id;
        
        if (this.selectedCount === 1) {
            // Single Selection: 현재 표시 중인 설비와 일치하면 업데이트
            if (incomingFrontendId === this.currentFrontendId) {
                
                // 🆕 v3.3.0: DataMerger 사용
                const mergedData = mergeEquipmentData(this.currentData, updateData);
                this.currentData = mergedData;
                
                // Header Status 업데이트
                this._updateHeaderStatus(mergedData.status);
                
                // General Tab 업데이트
                this._updateGeneralTab(mergedData);
                
                // PC Info Tab 업데이트
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
    
    // =========================================================================
    // Header Status 업데이트
    // =========================================================================
    
    /**
     * Header Status 업데이트
     * @private
     */
    _updateHeaderStatus(status) {
        if (!this.headerStatusIndicator || !this.headerStatusText) return;
        
        const statusDisplay = this._getStatusDisplay(status);
        
        // Indicator 클래스 업데이트
        this.headerStatusIndicator.className = `status-indicator ${statusDisplay.class}`;
        
        // Text 업데이트
        this.headerStatusText.textContent = status || '-';
    }
    
    /**
     * Header Status 숨기기 (Multi Selection 시)
     * @private
     */
    _hideHeaderStatus() {
        if (this.headerStatusEl) {
            this.headerStatusEl.style.display = 'none';
        }
    }
    
    /**
     * Header Status 보이기
     * @private
     */
    _showHeaderStatus() {
        if (this.headerStatusEl) {
            this.headerStatusEl.style.display = 'flex';
        }
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
        
        this.currentData = null;
        
        // 🆕 v3.3.0: Duration Timer 정리
        this.durationTimer.stop();
        
        // Header Status 보이기
        this._showHeaderStatus();
        
        // 헤더 업데이트 (임시로 Frontend ID 표시)
        this._updateHeader(frontendId);
        this._updateHeaderStatus(null);  // 로딩 중
        
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
                this._updateHeaderStatus('DISCONNECTED');
                return;
            }
            
            // 2. 캐시 확인
            const cached = this._getFromCache(frontendId);
            if (cached) {
                this.currentData = cached;
                this._updateHeader(cached.equipment_name || frontendId);
                this._updateHeaderStatus(cached.status);
                this._updateGeneralTab(cached);
                this._updatePCInfoTab(cached);
                return;
            }
            
            // 3. Backend API 호출
            const detailData = await this._fetchEquipmentDetail(frontendId, equipmentId);
            
            if (detailData) {
                this.currentData = detailData;
                
                // 캐시에 저장
                this._saveToCache(frontendId, detailData);
                
                // Header 업데이트
                this._updateHeader(detailData.equipment_name || frontendId);
                this._updateHeaderStatus(detailData.status);
                
                // UI 업데이트
                this._updateGeneralTab(detailData);
                this._updatePCInfoTab(detailData);
            } else {
                // API 실패 시 기본 정보만 표시
                this._showBasicInfo(frontendId, equipmentData);
                this._showPCInfoErrorState();
                this._updateHeaderStatus('DISCONNECTED');
            }
            
        } catch (error) {
            console.error('❌ Failed to load equipment detail:', error);
            this._showErrorState(frontendId, error.message);
            this._showPCInfoErrorState();
            this._updateHeaderStatus('DISCONNECTED');
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
     */
    async _fetchEquipmentDetail(frontendId, equipmentId) {
        debugLog(`📡 Fetching equipment detail via API client: ${frontendId}, equipmentId=${equipmentId}`);
        
        return await equipmentDetailApi.getDetail(frontendId, {
            equipmentId: equipmentId
        });
    }
    
    /**
     * General Tab 업데이트 (Lot Active/Inactive 분기)
     * @private
     */
    _updateGeneralTab(data) {
        if (!this.generalTabContent) return;
        
        // currentData 업데이트
        this.currentData = data;
        
        // is_lot_active로 분기
        const isLotActive = data.is_lot_active === true;
        
        let lotInfoHTML = '';
        
        if (isLotActive) {
            // ✅ Lot Active: Product, Lot No, Lot Start, Lot Duration 표시
            // 🆕 v3.3.0: DurationTimer 클래스 사용
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
            // ❌ Lot Inactive: Product="-", Lot No="-", Since, Duration 표시
            const hasSinceTime = data.since_time != null;
            // 🆕 v3.3.0: DurationTimer 클래스 사용
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
    
    /**
     * 🆕 v3.3.0: Duration Timer 시작 (콜백 패턴)
     * @private
     */
    _startDurationTimer(baseTime) {
        this.durationTimer.start(baseTime, (formatted) => {
            const durationEl = document.getElementById('durationDisplay');
            if (durationEl) {
                durationEl.textContent = formatted;
            }
        });
    }
    
    // =========================================================================
    // PC Info Tab
    // =========================================================================
    
    /**
     * PC Info Tab 업데이트 (Single Selection)
     * @private
     */
    _updatePCInfoTab(data) {
        if (!this.pcinfoTabContent) return;
        
        // CPU 사용율 Gauge 계산
        const cpuPercent = data.cpu_usage_percent ?? null;
        const cpuGaugeColor = this._getGaugeColor(cpuPercent);
        
        // Memory 사용율 Gauge 계산
        const memoryTotal = data.memory_total_gb ?? null;
        const memoryUsed = data.memory_used_gb ?? null;
        const memoryPercent = (memoryTotal && memoryUsed) 
            ? Math.round((memoryUsed / memoryTotal) * 100) 
            : null;
        const memoryGaugeColor = this._getGaugeColor(memoryPercent);
        
        // Disk C 사용율 Gauge 계산
        const diskCTotal = data.disk_c_total_gb ?? null;
        const diskCUsed = data.disk_c_used_gb ?? null;
        const diskCPercent = (diskCTotal && diskCUsed) 
            ? Math.round((diskCUsed / diskCTotal) * 100) 
            : null;
        const diskCGaugeColor = this._getGaugeColor(diskCPercent);
        
        // Disk D 사용율 Gauge 계산 (NULL 체크)
        const diskDTotal = data.disk_d_total_gb ?? null;
        const diskDUsed = data.disk_d_used_gb ?? null;
        const hasDiskD = diskDTotal !== null && diskDTotal > 0;
        const diskDPercent = (diskDTotal && diskDUsed) 
            ? Math.round((diskDUsed / diskDTotal) * 100) 
            : null;
        const diskDGaugeColor = this._getGaugeColor(diskDPercent);
        
        // 🆕 v3.3.0: DataFormatter 사용
        const bootDuration = DataFormatter.formatBootDuration(data.last_boot_time);
        const bootDurationClass = DataFormatter.getBootDurationClass(data.last_boot_time);
        const cpuShortName = DataFormatter.shortenCpuName(data.cpu_name);
        
        // 새 레이아웃 - System Info Row + Gauge Section
        this.pcinfoTabContent.innerHTML = `
            <!-- System Info (합쳐진 레이아웃) -->
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
            
            <!-- Gauge Section -->
            <div class="gauge-section">
                <div class="gauge-section-title">Resource Usage</div>
                
                <!-- CPU Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">CPU</span>
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${cpuGaugeColor}" style="width: ${cpuPercent ?? 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${cpuPercent !== null ? cpuPercent.toFixed(1) + '%' : '-'}</span>
                    </div>
                </div>
                
                <!-- Memory Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">Mem</span>
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${memoryGaugeColor}" style="width: ${memoryPercent ?? 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${memoryUsed?.toFixed(1) ?? '-'}/${memoryTotal?.toFixed(0) ?? '-'} GB</span>
                    </div>
                </div>
                
                <!-- Disk C Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">C:</span>
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${diskCGaugeColor}" style="width: ${diskCPercent ?? 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${diskCUsed?.toFixed(0) ?? '-'}/${diskCTotal?.toFixed(0) ?? '-'} GB</span>
                    </div>
                </div>
                
                <!-- Disk D Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">D:</span>
                    ${hasDiskD ? `
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${diskDGaugeColor}" style="width: ${diskDPercent ?? 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${diskDUsed?.toFixed(0) ?? '-'}/${diskDTotal?.toFixed(0) ?? '-'} GB</span>
                    </div>
                    ` : `
                    <span class="unified-gauge-na">N/A</span>
                    `}
                </div>
            </div>
            
            ${data.pc_last_update_time ? `
            <div class="info-row info-row-meta">
                <span class="info-label">Updated:</span>
                <span class="info-value info-value-meta">${DataFormatter.formatDateTime(data.pc_last_update_time)}</span>
            </div>
            ` : ''}
        `;
        
        debugLog(`✅ PC Info tab updated: CPU=${cpuPercent}%, Memory=${memoryPercent}%, DiskC=${diskCPercent}%`);
    }
    
    /**
     * Gauge 색상 결정 (CPU, Memory, Disk 공통)
     * @private
     */
    _getGaugeColor(percent) {
        if (percent === null || percent === undefined) return 'gauge-gray';
        if (percent < 50) return 'gauge-green';
        if (percent < 80) return 'gauge-yellow';
        return 'gauge-red';
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
    // Multi Selection
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
        
        // Multi Selection에서는 Header Status 숨기기
        this._hideHeaderStatus();
        
        // 🆕 v3.3.0: Duration Timer 정리 (Multi Selection에서는 사용 안함)
        this.durationTimer.stop();
        
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
    
    /**
     * Backend API 호출 (Multi Selection)
     * @private
     */
    async _fetchMultiEquipmentDetail() {
        debugLog(`📡 Fetching multi equipment detail via API client: ${this.selectedFrontendIds.length} items`);
        
        return await equipmentDetailApi.getMultiDetail(this.selectedFrontendIds, {
            equipmentIds: this.selectedEquipmentIds
        });
    }
    
    /**
     * General Tab 업데이트 (Multi Selection - 집계)
     * @private
     */
    _updateGeneralTabMulti(data, totalCount) {
        if (!this.generalTabContent) return;
        
        // 🆕 v3.3.0: DataFormatter 사용
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
     * PC Info Tab 업데이트 (Multi Selection - 집계)
     * @private
     */
    _updatePCInfoTabMulti(data, totalCount) {
        if (!this.pcinfoTabContent) return;
        
        // 평균 CPU 사용율
        const avgCpu = data.avg_cpu_usage_percent;
        const cpuGaugeColor = this._getGaugeColor(avgCpu);
        
        // 평균 Memory 사용율
        const avgMemory = data.avg_memory_usage_percent;
        const memoryGaugeColor = this._getGaugeColor(avgMemory);
        
        // 평균 Disk C 사용율
        const avgDiskC = data.avg_disk_c_usage_percent;
        const diskCGaugeColor = this._getGaugeColor(avgDiskC);
        
        // 평균 Disk D 사용율 (NULL 체크)
        const avgDiskD = data.avg_disk_d_usage_percent;
        const hasDiskD = avgDiskD !== null && avgDiskD !== undefined;
        const diskDGaugeColor = this._getGaugeColor(avgDiskD);
        
        // 🆕 v3.3.0: DataFormatter 사용
        const cpuNamesDisplay = DataFormatter.formatListWithMore(data.cpu_names, data.cpu_names_more);
        const gpuNamesDisplay = DataFormatter.formatListWithMore(data.gpu_names, data.gpu_names_more);
        const osNamesDisplay = DataFormatter.formatListWithMore(data.os_names, data.os_names_more);
        
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
            
            <!-- Gauge Section -->
            <div class="gauge-section">
                <div class="gauge-section-title">Avg Resource Usage</div>
                
                <!-- 평균 CPU Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">CPU</span>
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${cpuGaugeColor}" style="width: ${avgCpu || 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${avgCpu !== null && avgCpu !== undefined ? avgCpu.toFixed(1) + '%' : '-'}</span>
                    </div>
                </div>
                
                <!-- 평균 Memory Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">Mem</span>
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${memoryGaugeColor}" style="width: ${avgMemory || 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${avgMemory !== null && avgMemory !== undefined ? avgMemory.toFixed(1) + '%' : '-'}</span>
                    </div>
                </div>
                
                <!-- 평균 Disk C Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">C:</span>
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${diskCGaugeColor}" style="width: ${avgDiskC || 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${avgDiskC !== null && avgDiskC !== undefined ? avgDiskC.toFixed(1) + '%' : '-'}</span>
                    </div>
                </div>
                
                <!-- 평균 Disk D Gauge -->
                <div class="unified-gauge-row">
                    <span class="unified-gauge-label">D:</span>
                    ${hasDiskD ? `
                    <div class="unified-gauge-container">
                        <div class="unified-gauge-bar">
                            <div class="unified-gauge-fill ${diskDGaugeColor}" style="width: ${avgDiskD || 0}%"></div>
                        </div>
                        <span class="unified-gauge-value">${avgDiskD.toFixed(1)}%</span>
                    </div>
                    ` : `
                    <span class="unified-gauge-na">N/A (일부 D: 없음)</span>
                    `}
                </div>
            </div>
        `;
        
        debugLog(`✅ Multi PC Info tab updated: avg_cpu=${avgCpu}%, avg_memory=${avgMemory}%, avg_diskC=${avgDiskC}%`);
    }
    
    /**
     * Multi Selection PC Info 매핑 없음
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
     * Multi Selection PC Info 에러
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
                <span class="info-label">Avg Memory:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Disk C:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">CPU:</span>
                <span class="info-value">-</span>
            </div>
        `;
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
        
        debugLog(`🔄 Multi selection status update needed: ${frontendId} -> ${newStatus}`);
        
        // 집계 다시 로드 (debounce 적용)
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
                        this._updatePCInfoTabMulti(aggregatedData, this.selectedCount);
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
     * Status 표시 정보 반환
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
        this.currentData = null;
        debugLog('🗑️ Equipment info cache cleared');
    }
    
    // =========================================================================
    // API Base URL 변경
    // =========================================================================
    
    /**
     * API Base URL 변경
     * @param {string} baseUrl - 새로운 Base URL
     */
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
        
        // 🆕 v3.3.0: Duration Timer 정리
        this.durationTimer.dispose();
        
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        
        debugLog('📊 EquipmentInfoPanel disposed');
    }
}