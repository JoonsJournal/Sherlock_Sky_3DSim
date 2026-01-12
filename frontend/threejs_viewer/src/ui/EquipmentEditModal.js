/**
 * EquipmentEditModal.js
 * 설비 편집 모달
 * 
 * @version 3.1.0
 * @description 
 *   - BaseModal 상속 적용
 *   - EquipmentMappingService 연동
 *   - 서버 저장/검증 기능 추가
 *   - v2.2.0: line_name 저장 추가
 *   - v3.0.0: 인라인 스타일 완전 제거, CSS 클래스 기반 (2026-01-06)
 *   - v3.1.0: V2 API 서버 저장 기능 추가 (2026-01-13)
 *             - Save All → localStorage + V2 API 서버 저장
 *             - 연결된 site_id 기반 파일 생성
 */

import { BaseModal } from '../core/base/BaseModal.js';
import { toast } from './common/Toast.js';
import { debugLog } from '../core/utils/Config.js';
import { EquipmentMappingService } from '../services/mapping/EquipmentMappingService.js';
import { extendWithServerSave } from '../services/EquipmentEditStateExtension.js';

/**
 * EquipmentEditModal
 * 설비 매핑 편집 모달
 */
export class EquipmentEditModal extends BaseModal {
    /**
     * @param {Object} options
     * @param {Object} options.editState - 편집 상태 관리자
     * @param {Object} options.apiClient - API 클라이언트
     */
    constructor(options = {}) {
        super({
            ...options,
            title: '🛠️ Equipment Mapping Editor',
            size: 'lg',
            closeOnOverlay: true,
            closeOnEsc: true,
            className: 'equipment-edit-modal'
        });
        
        this.editState = options.editState;
        this.apiClient = options.apiClient;
        
        // 🆕 v3.1.0: EditState에 서버 저장 기능 확장
        if (this.editState && !this.editState.saveToServer) {
            extendWithServerSave(this.editState);
            debugLog('🔧 EditState extended with V2 server save capability');
        }
        
        // MappingService 초기화
        this.mappingService = new EquipmentMappingService({
            apiClient: this.apiClient,
            editState: this.editState
        });
        
        this.currentEquipment = null;
        this.availableEquipments = [];
        this.filteredEquipments = [];
        this.selectedEquipmentId = null;
        this.selectedEquipmentName = null;
        this.selectedLineName = null;
        
        // 검증 상태
        this.validationResult = null;
        this.isValidating = false;
        this.isSaving = false;
    }
    
    /**
     * Modal Body 렌더링 - CSS 클래스 기반
     */
    renderBody() {
        return `
            <div class="equipment-edit-content">
                <!-- Selected Equipment Info -->
                <div class="edit-section">
                    <h3>Selected Equipment</h3>
                    <div class="equip-edit__info-box">
                        <div class="equip-edit__info-row">
                            <span class="equip-edit__info-label">Frontend ID:</span>
                            <span id="edit-frontend-id" class="equip-edit__info-value">-</span>
                        </div>
                        <div class="equip-edit__info-row">
                            <span class="equip-edit__info-label">Position:</span>
                            <span id="edit-position" class="equip-edit__info-value">-</span>
                        </div>
                        <div class="equip-edit__info-row">
                            <span class="equip-edit__info-label">Current Mapping:</span>
                            <span id="edit-current-mapping" class="equip-edit__info-value equip-edit__info-value--muted">Not Assigned</span>
                        </div>
                    </div>
                </div>
                
                <!-- Equipment Name Selection -->
                <div class="edit-section">
                    <h3>Equipment Name</h3>
                    <div class="equip-edit__search-box">
                        <input 
                            type="text" 
                            id="equipment-search" 
                            class="equip-edit__search-input"
                            placeholder="Search equipment name..."
                            autocomplete="off"
                        >
                        <button id="clear-search-btn" class="equip-edit__search-clear" title="Clear">✕</button>
                    </div>
                    
                    <!-- Equipment List -->
                    <div class="equip-edit__list" id="equipment-list">
                        <div class="equip-edit__loading">
                            Loading equipment list...
                        </div>
                    </div>
                </div>
                
                <!-- Validation Status -->
                <div class="edit-section">
                    <div id="validation-status" class="equip-edit__validation-container" style="display: none;">
                        <!-- 검증 결과가 여기에 표시됨 -->
                    </div>
                </div>
                
                <!-- Progress -->
                <div class="edit-section">
                    <div class="equip-edit__progress">
                        <span id="mapping-progress" class="equip-edit__progress-text">0 / 0 Mapped</span>
                        <span id="sync-status" class="equip-edit__sync-status"></span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Modal Footer 렌더링 - CSS 클래스 기반
     * 🆕 v3.1.0: 서버 저장 버튼 추가
     */
    renderFooter() {
        return `
            <div class="equip-edit__footer">
                <div class="equip-edit__footer-left">
                    <button id="btn-validate" class="btn-outline" title="Validate all mappings">
                        🔍 Validate
                    </button>
                    <button id="btn-sync-server" class="btn-outline" title="Load from server">
                        🔄 Sync
                    </button>
                </div>
                <div class="equip-edit__footer-right">
                    <button class="btn-secondary modal-cancel-btn">Cancel</button>
                    <button id="btn-save-server" class="btn-success" title="Save to server (V2 API)">
                        ☁️ Save All
                    </button>
                    <button class="btn-primary modal-confirm-btn" disabled>Confirm</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        // 검색
        const searchInput = this.$('#equipment-search');
        if (searchInput) {
            this.addDomListener(searchInput, 'input', (e) => {
                this.filterEquipments(e.target.value);
            });
        }
        
        // 검색 초기화
        const clearBtn = this.$('#clear-search-btn');
        if (clearBtn) {
            this.addDomListener(clearBtn, 'click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    this.filterEquipments('');
                }
            });
        }
        
        // 검증 버튼
        const validateBtn = this.$('#btn-validate');
        if (validateBtn) {
            this.addDomListener(validateBtn, 'click', () => {
                this._handleValidate();
            });
        }
        
        // 서버 동기화 버튼
        const syncBtn = this.$('#btn-sync-server');
        if (syncBtn) {
            this.addDomListener(syncBtn, 'click', () => {
                this._handleSyncFromServer();
            });
        }
        
        // 🆕 v3.1.0: 서버 저장 버튼 - V2 API 사용
        const saveBtn = this.$('#btn-save-server');
        if (saveBtn) {
            this.addDomListener(saveBtn, 'click', () => {
                this._handleSaveToServerV2();
            });
        }
    }
    
    /**
     * Modal 열기 (equipment 데이터와 함께)
     * @param {THREE.Group} equipment - 선택된 설비
     */
    async open(equipment) {
        this.currentEquipment = equipment;
        this.selectedEquipmentId = null;
        this.selectedEquipmentName = null;
        this.selectedLineName = null;
        this.validationResult = null;
        
        // BaseModal의 open 호출
        super.open();
        
        // 설비 정보 표시
        this._displayEquipmentInfo();
        
        // 진행 상황 업데이트
        this._updateProgress();
        
        // 동기화 상태 표시
        this._updateSyncStatus();
        
        // Equipment 목록 로드
        await this._loadAvailableEquipments();
    }
    
    /**
     * Modal 닫힐 때
     */
    onClose() {
        this.currentEquipment = null;
        this.selectedEquipmentId = null;
        this.selectedEquipmentName = null;
        this.selectedLineName = null;
        this.validationResult = null;
        
        // 검색 초기화
        const searchInput = this.$('#equipment-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // 검증 상태 초기화
        const validationStatus = this.$('#validation-status');
        if (validationStatus) {
            validationStatus.style.display = 'none';
        }
    }
    
    /**
     * Confirm 버튼 클릭
     */
    onConfirm() {
        if (!this.selectedEquipmentId) {
            toast.warning('Please select an equipment');
            return;
        }
        
        // 매핑 저장 (equipment_id, equipment_name, line_name 포함)
        this.editState.setMapping(this.currentEquipment.userData.id, {
            equipment_id: this.selectedEquipmentId,
            equipment_name: this.selectedEquipmentName,
            line_name: this.selectedLineName
        });
        
        // 토스트 메시지
        const lineInfo = this.selectedLineName ? ` (Line: ${this.selectedLineName})` : '';
        toast.success(`Mapped: ${this.currentEquipment.userData.id} → ${this.selectedEquipmentName}${lineInfo}`);
        
        debugLog(`🔗 Mapping saved: ${this.currentEquipment.userData.id} → ID: ${this.selectedEquipmentId}, Name: ${this.selectedEquipmentName}, Line: ${this.selectedLineName || 'N/A'}`);
        
        // 모달 닫기
        this.close();
    }
    
    // ==========================================
    // 서버 연동 메서드
    // ==========================================
    
    /**
     * 검증 실행
     */
    async _handleValidate() {
        if (this.isValidating) return;
        
        const validateBtn = this.$('#btn-validate');
        const validationStatus = this.$('#validation-status');
        
        try {
            this.isValidating = true;
            if (validateBtn) {
                validateBtn.disabled = true;
                validateBtn.innerHTML = '🔄 Validating...';
            }
            
            // 먼저 로컬 검증
            const localResult = this.mappingService.validateLocal();
            
            if (!localResult.valid) {
                this._displayValidationResult(localResult, 'local');
                toast.warning('Local validation found issues');
                return;
            }
            
            // 서버 검증
            const serverResult = await this.mappingService.validateMapping();
            this.validationResult = serverResult;
            
            this._displayValidationResult(serverResult, 'server');
            
            if (serverResult.valid) {
                toast.success('✅ All mappings are valid!');
            } else {
                toast.warning(`⚠️ Found ${serverResult.errors?.length || 0} errors`);
            }
            
        } catch (error) {
            console.error('Validation error:', error);
            toast.error('Validation failed: ' + error.message);
        } finally {
            this.isValidating = false;
            if (validateBtn) {
                validateBtn.disabled = false;
                validateBtn.innerHTML = '🔍 Validate';
            }
        }
    }
    
    /**
     * 서버에서 매핑 로드 (V2 API 사용)
     * 🆕 v3.1.0: V2 API 우선, 실패시 기존 API fallback
     */
    async _handleSyncFromServer() {
        const syncBtn = this.$('#btn-sync-server');
        
        try {
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '🔄 Loading...';
            }
            
            // 🆕 v3.1.0: V2 API로 먼저 시도
            if (this.editState && this.editState.loadFromServerV2) {
                try {
                    const result = await this.editState.loadFromServerV2();
                    
                    if (result.success) {
                        toast.success(`✅ Synced from server: ${result.count} mappings`);
                        this._updateProgress();
                        this._updateSyncStatus();
                        this._renderEquipmentList();
                        return;
                    }
                } catch (v2Error) {
                    debugLog('V2 API sync failed, falling back to legacy API:', v2Error);
                }
            }
            
            // Fallback: 기존 API
            const conflicts = await this.mappingService.detectConflicts();
            
            if (conflicts.needsSync && conflicts.conflicts.length > 0) {
                const choice = confirm(
                    `⚠️ ${conflicts.conflicts.length} conflicts detected.\n\n` +
                    `Local only: ${conflicts.localOnly.length}\n` +
                    `Server only: ${conflicts.serverOnly.length}\n\n` +
                    `Click OK to use server data, Cancel to keep local data.`
                );
                
                const strategy = choice ? 'replace' : 'keep-local';
                await this.mappingService.loadMappings(strategy);
                toast.success(`Synced with server (${strategy})`);
            } else {
                await this.mappingService.loadMappings('merge');
                toast.success('Synced with server');
            }
            
            // UI 업데이트
            this._updateProgress();
            this._updateSyncStatus();
            this._renderEquipmentList();
            
        } catch (error) {
            console.error('Sync error:', error);
            toast.error('Sync failed: ' + error.message);
        } finally {
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '🔄 Sync';
            }
        }
    }
    
    /**
     * 🆕 v3.1.0: 서버에 매핑 저장 (V2 API 사용)
     * equipment_mapping_{site_id}.json 형식으로 저장
     */
    async _handleSaveToServerV2() {
        if (this.isSaving) return;
        
        const saveBtn = this.$('#btn-save-server');
        const mappingCount = this.editState?.getMappingCount() || 0;
        
        if (mappingCount === 0) {
            toast.warning('No mappings to save');
            return;
        }
        
        // 연결된 Site 확인
        let siteId = null;
        try {
            if (this.editState && this.editState.getCurrentSiteId) {
                siteId = await this.editState.getCurrentSiteId();
            }
        } catch (e) {
            debugLog('Failed to get current site ID:', e);
        }
        
        const siteInfo = siteId ? `\nSite: ${siteId}` : '\n⚠️ No site connected (will try to detect)';
        
        const confirmed = confirm(
            `☁️ Save ${mappingCount} mappings to server?\n` +
            `${siteInfo}\n\n` +
            `This will create/update:\n` +
            `config/site_mappings/equipment_mapping_${siteId || '{site_id}'}.json`
        );
        
        if (!confirmed) return;
        
        try {
            this.isSaving = true;
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '☁️ Saving...';
            }
            
            // 🆕 V2 API로 저장
            if (this.editState && this.editState.saveToServer) {
                const result = await this.editState.saveToServer({
                    createdBy: 'Equipment Mapping Editor',
                    description: `Mapping saved from Equipment Mapping Editor at ${new Date().toISOString()}`
                });
                
                if (result.success) {
                    toast.success(`✅ Saved ${result.count} mappings to ${result.siteId}`);
                    this._updateSyncStatus();
                    
                    // 동기화 상태 업데이트
                    const syncStatus = this.$('#sync-status');
                    if (syncStatus) {
                        syncStatus.className = 'equip-edit__sync-status equip-edit__sync-status--synced';
                        syncStatus.textContent = `✅ Saved to server • ${new Date().toLocaleTimeString()}`;
                    }
                } else {
                    toast.error(`❌ Save failed: ${result.error}`);
                }
            } else {
                // Fallback: 기존 API
                const result = await this.mappingService.saveMappings(true);
                
                if (result.success) {
                    toast.success(`✅ Saved ${result.total || mappingCount} mappings to server`);
                    this._updateSyncStatus();
                } else {
                    if (result.validation) {
                        this._displayValidationResult(result.validation, 'server');
                    }
                    toast.error('Save failed: Validation errors');
                }
            }
            
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Save failed: ' + error.message);
        } finally {
            this.isSaving = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '☁️ Save All';
            }
        }
    }
    
    /**
     * 🆕 기존 _handleSaveToServer는 _handleSaveToServerV2로 대체
     * @deprecated Use _handleSaveToServerV2 instead
     */
    async _handleSaveToServer() {
        return this._handleSaveToServerV2();
    }
    
    /**
     * 검증 결과 표시 - CSS 클래스 기반
     * @param {Object} result - 검증 결과
     * @param {string} source - 'local' | 'server'
     */
    _displayValidationResult(result, source) {
        const validationStatus = this.$('#validation-status');
        if (!validationStatus) return;
        
        validationStatus.style.display = 'block';
        
        const validClass = result.valid ? 'equip-edit__validation--valid' : 'equip-edit__validation--invalid';
        const statusIcon = result.valid ? '✅' : '❌';
        const statusText = result.valid ? 'Validation Passed' : 'Validation Failed';
        
        let html = `
            <div class="equip-edit__validation ${validClass}">
                <div class="equip-edit__validation-header">
                    <span class="equip-edit__validation-icon">${statusIcon}</span>
                    <span class="equip-edit__validation-title">${statusText}</span>
                    <span class="equip-edit__validation-source">(${source})</span>
                </div>
        `;
        
        // 에러 표시
        if (result.errors && result.errors.length > 0) {
            html += `
                <div class="equip-edit__validation-errors">
                    <div class="equip-edit__validation-errors-title">Errors:</div>
                    <ul class="equip-edit__validation-list">
                        ${result.errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
                        ${result.errors.length > 5 ? `<li>... and ${result.errors.length - 5} more</li>` : ''}
                    </ul>
                </div>
            `;
        }
        
        // 경고 표시
        if (result.warnings && result.warnings.length > 0) {
            html += `
                <div class="equip-edit__validation-warnings">
                    <div class="equip-edit__validation-warnings-title">Warnings:</div>
                    <ul class="equip-edit__validation-list">
                        ${result.warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        html += '</div>';
        validationStatus.innerHTML = html;
    }
    
    /**
     * 동기화 상태 업데이트
     */
    _updateSyncStatus() {
        const syncStatus = this.$('#sync-status');
        if (!syncStatus) return;
        
        const status = this.mappingService.getStatus();
        
        if (status.lastSyncTime) {
            const timeAgo = this._formatTimeAgo(status.lastSyncTime);
            const statusClass = status.isDirty ? 'equip-edit__sync-status--dirty' : 'equip-edit__sync-status--synced';
            const statusIcon = status.isDirty ? '⚠️' : '✅';
            const statusText = status.isDirty ? 'Unsaved changes' : 'Synced';
            
            syncStatus.className = `equip-edit__sync-status ${statusClass}`;
            syncStatus.textContent = `${statusIcon} ${statusText} • Last sync: ${timeAgo}`;
        } else {
            syncStatus.className = 'equip-edit__sync-status';
            syncStatus.textContent = 'Not synced with server';
        }
    }
    
    /**
     * 시간 포맷팅
     */
    _formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
    
    // ==========================================
    // 기존 Private Methods
    // ==========================================
    
    /**
     * 설비 정보 표시
     */
    _displayEquipmentInfo() {
        const frontendIdEl = this.$('#edit-frontend-id');
        const positionEl = this.$('#edit-position');
        const currentMappingEl = this.$('#edit-current-mapping');
        
        if (!this.currentEquipment) return;
        
        const userData = this.currentEquipment.userData;
        
        if (frontendIdEl) {
            frontendIdEl.textContent = userData.id || '-';
        }
        
        if (positionEl) {
            positionEl.textContent = `Row ${userData.row || '-'}, Col ${userData.col || '-'}`;
        }
        
        if (currentMappingEl) {
            const mapping = this.editState?.getMapping(userData.id);
            if (mapping) {
                const lineInfo = mapping.line_name ? ` | Line: ${mapping.line_name}` : '';
                currentMappingEl.innerHTML = `
                    <span class="equip-edit__info-value--success">${mapping.equipment_name}</span>
                    <span class="equip-edit__info-value--muted"> (ID: ${mapping.equipment_id}${lineInfo})</span>
                `;
                currentMappingEl.classList.remove('equip-edit__info-value--muted');
            } else {
                currentMappingEl.textContent = 'Not Assigned';
                currentMappingEl.classList.add('equip-edit__info-value--muted');
            }
        }
    }
    
    /**
     * Available Equipments 로드
     */
    async _loadAvailableEquipments() {
        const listContainer = this.$('#equipment-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '<div class="equip-edit__loading">Loading equipment list...</div>';
        
        try {
            const equipments = await this.mappingService.loadEquipmentNames();
            
            this.availableEquipments = equipments;
            this.filteredEquipments = equipments;
            
            this._renderEquipmentList();
            
        } catch (error) {
            console.error('Failed to load equipment list:', error);
            listContainer.innerHTML = '<div class="equip-edit__error">Failed to load equipment list</div>';
            toast.error('Failed to load equipment list');
        }
    }
    
    /**
     * Equipment 목록 렌더링 - CSS 클래스 기반
     */
    _renderEquipmentList() {
        const listContainer = this.$('#equipment-list');
        if (!listContainer) return;
        
        if (this.filteredEquipments.length === 0) {
            listContainer.innerHTML = '<div class="equip-edit__empty">No equipment found</div>';
            return;
        }
        
        listContainer.innerHTML = '';
        
        this.filteredEquipments.forEach(equipment => {
            const item = document.createElement('div');
            
            // 이미 할당되었는지 확인
            const assignedTo = this.editState.findDuplicate(equipment.equipment_id);
            const isAssigned = assignedTo !== null;
            const isCurrent = assignedTo === this.currentEquipment?.userData.id;
            
            // CSS 클래스 설정
            let itemClass = 'equip-edit__item';
            if (isCurrent) {
                itemClass += ' equip-edit__item--current';
            } else if (isAssigned) {
                itemClass += ' equip-edit__item--assigned';
            }
            item.className = itemClass;
            
            // 배지 결정
            let badgeHtml = '';
            if (isCurrent) {
                badgeHtml = '<span class="equip-edit__item-badge equip-edit__item-badge--current">Current</span>';
            } else if (isAssigned) {
                badgeHtml = '<span class="equip-edit__item-badge equip-edit__item-badge--assigned">Assigned</span>';
            }
            
            // 버튼 클래스 결정
            const btnClass = isCurrent 
                ? 'equip-edit__item-select-btn equip-edit__item-select-btn--success' 
                : 'equip-edit__item-select-btn equip-edit__item-select-btn--primary';
            const btnText = isCurrent ? '✓ Current' : 'Select';
            const btnDisabled = isAssigned && !isCurrent ? 'disabled' : '';
            
            item.innerHTML = `
                <div class="equip-edit__item-content">
                    <div class="equip-edit__item-header">
                        <span class="equip-edit__item-name">${equipment.equipment_name}</span>
                        ${badgeHtml}
                    </div>
                    <div class="equip-edit__item-details">
                        <span class="equip-edit__item-detail">ID: ${equipment.equipment_id}</span>
                        <span class="equip-edit__item-detail">Line: ${equipment.line_name || 'N/A'}</span>
                        ${isAssigned && !isCurrent ? `<span class="equip-edit__item-assigned-to">→ ${assignedTo}</span>` : ''}
                    </div>
                </div>
                <button class="equip-edit__item-select-btn ${btnClass}" 
                    data-equipment-id="${equipment.equipment_id}"
                    ${btnDisabled}>
                    ${btnText}
                </button>
            `;
            
            // Select 버튼 이벤트
            const selectBtn = item.querySelector('.equip-edit__item-select-btn');
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isAssigned || isCurrent) {
                    this._selectEquipment(equipment);
                } else {
                    this._confirmDuplicateOverride(equipment, assignedTo);
                }
            });
            
            listContainer.appendChild(item);
        });
    }
    
    /**
     * Equipment 필터링
     */
    filterEquipments(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            this.filteredEquipments = this.availableEquipments;
        } else {
            this.filteredEquipments = this.availableEquipments.filter(eq => 
                eq.equipment_name.toLowerCase().includes(term) ||
                (eq.equipment_id && eq.equipment_id.toString().includes(term)) ||
                (eq.line_name && eq.line_name.toLowerCase().includes(term))
            );
        }
        
        this._renderEquipmentList();
    }
    
    /**
     * Equipment 선택
     */
    _selectEquipment(equipment) {
        this.selectedEquipmentId = equipment.equipment_id;
        this.selectedEquipmentName = equipment.equipment_name;
        this.selectedLineName = equipment.line_name || null;
        
        // Confirm 버튼 활성화
        this.setConfirmEnabled(true);
        
        // Confirm 버튼 텍스트 업데이트
        const lineInfo = this.selectedLineName ? ` (${this.selectedLineName})` : '';
        this.setConfirmText(`Confirm: ${equipment.equipment_name}${lineInfo}`);
        
        // 목록에서 선택 표시
        const listContainer = this.$('#equipment-list');
        if (listContainer) {
            listContainer.querySelectorAll('.equip-edit__item').forEach(item => {
                item.classList.remove('equip-edit__item--selected');
            });
            
            const selectedItem = listContainer.querySelector(`[data-equipment-id="${equipment.equipment_id}"]`)?.closest('.equip-edit__item');
            if (selectedItem) {
                selectedItem.classList.add('equip-edit__item--selected');
            }
        }
        
        debugLog(`✅ Selected: ${equipment.equipment_name} (ID: ${equipment.equipment_id}, Line: ${equipment.line_name || 'N/A'})`);
    }
    
    /**
     * 중복 할당 확인
     */
    _confirmDuplicateOverride(equipment, assignedTo) {
        const confirmed = confirm(
            `⚠️ ${equipment.equipment_name} is already assigned to ${assignedTo}.\n\n` +
            `Do you want to remove the existing mapping and assign it to ${this.currentEquipment.userData.id}?`
        );
        
        if (confirmed) {
            // 기존 매핑 제거
            delete this.editState.mappings[assignedTo];
            
            // 새로 선택
            this._selectEquipment(equipment);
            
            // 목록 다시 렌더링
            this._renderEquipmentList();
            
            toast.warning(`Removed mapping from ${assignedTo}`);
        }
    }
    
    /**
     * 진행 상황 업데이트
     */
    _updateProgress() {
        const completion = this.mappingService.getCompletionStatus();
        
        const progressEl = this.$('#mapping-progress');
        if (!progressEl) return;
        
        if (completion.isComplete) {
            progressEl.innerHTML = `
                <span class="equip-edit__progress-badge">
                    ✓ All Equipment Mapped (${completion.total} / ${completion.total})
                </span>
            `;
        } else {
            progressEl.textContent = `${completion.mapped} / ${completion.total} Mapped (${completion.percentage}%)`;
        }
    }
}

export default EquipmentEditModal;
