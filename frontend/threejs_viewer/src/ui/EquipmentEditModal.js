/**
 * EquipmentEditModal.js
 * 설비 편집 모달
 * 
 * @version 2.1.0
 * @description 
 *   - BaseModal 상속 적용
 *   - EquipmentMappingService 연동
 *   - 서버 저장/검증 기능 추가
 */

import { BaseModal } from '../core/base/BaseModal.js';
import { toast } from './common/Toast.js';
import { debugLog } from '../core/utils/Config.js';
import { EquipmentMappingService } from '../services/mapping/EquipmentMappingService.js';

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
            closeOnEsc: true
        });
        
        this.editState = options.editState;
        this.apiClient = options.apiClient;
        
        // ⭐ MappingService 초기화
        this.mappingService = new EquipmentMappingService({
            apiClient: this.apiClient,
            editState: this.editState
        });
        
        this.currentEquipment = null;
        this.availableEquipments = [];
        this.filteredEquipments = [];
        this.selectedEquipmentId = null;
        this.selectedEquipmentName = null;
        
        // 검증 상태
        this.validationResult = null;
        this.isValidating = false;
        this.isSaving = false;
    }
    
    /**
     * Modal Body 렌더링
     */
    renderBody() {
        return `
            <div class="equipment-edit-content">
                <!-- Selected Equipment Info -->
                <div class="edit-section">
                    <h3>Selected Equipment</h3>
                    <div class="info-box" style="
                        background: #1a1a1a;
                        border: 1px solid #333;
                        border-radius: 4px;
                        padding: 12px;
                    ">
                        <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span class="label" style="color: #888;">Frontend ID:</span>
                            <span id="edit-frontend-id" class="value" style="color: #fff;">-</span>
                        </div>
                        <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span class="label" style="color: #888;">Position:</span>
                            <span id="edit-position" class="value" style="color: #fff;">-</span>
                        </div>
                        <div class="info-row" style="display: flex; justify-content: space-between;">
                            <span class="label" style="color: #888;">Current Mapping:</span>
                            <span id="edit-current-mapping" class="value" style="color: #fff;">Not Assigned</span>
                        </div>
                    </div>
                </div>
                
                <!-- Equipment Name Selection -->
                <div class="edit-section" style="margin-top: 16px;">
                    <h3>Equipment Name</h3>
                    <div class="search-box" style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input 
                            type="text" 
                            id="equipment-search" 
                            placeholder="Search equipment name..."
                            autocomplete="off"
                            style="
                                flex: 1;
                                padding: 8px 12px;
                                background: #1a1a1a;
                                border: 1px solid #444;
                                border-radius: 4px;
                                color: #fff;
                                font-size: 14px;
                            "
                        >
                        <button id="clear-search-btn" class="btn-icon" title="Clear" style="
                            background: #333;
                            border: 1px solid #444;
                            color: #888;
                            padding: 8px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                        ">✕</button>
                    </div>
                    
                    <!-- Equipment List -->
                    <div class="equipment-list" id="equipment-list" style="
                        max-height: 300px;
                        overflow-y: auto;
                        border: 1px solid #333;
                        border-radius: 4px;
                    ">
                        <div class="loading" style="padding: 20px; text-align: center; color: #888;">
                            Loading equipment list...
                        </div>
                    </div>
                </div>
                
                <!-- Validation Status -->
                <div class="edit-section" style="margin-top: 16px;">
                    <div id="validation-status" style="display: none;">
                        <!-- 검증 결과가 여기에 표시됨 -->
                    </div>
                </div>
                
                <!-- Progress -->
                <div class="edit-section" style="margin-top: 16px;">
                    <div class="progress-info" style="display: flex; justify-content: space-between; align-items: center;">
                        <span id="mapping-progress" style="color: #888;">0 / 0 Mapped</span>
                        <span id="sync-status" style="color: #666; font-size: 12px;"></span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Modal Footer 렌더링
     */
    renderFooter() {
        return `
            <div style="display: flex; justify-content: space-between; width: 100%;">
                <div class="footer-left" style="display: flex; gap: 8px;">
                    <button id="btn-validate" class="btn-outline" title="Validate all mappings">
                        🔍 Validate
                    </button>
                    <button id="btn-sync-server" class="btn-outline" title="Load from server">
                        🔄 Sync
                    </button>
                </div>
                <div class="footer-right" style="display: flex; gap: 8px;">
                    <button class="btn-secondary modal-cancel-btn">Cancel</button>
                    <button id="btn-save-server" class="btn-success" title="Save to server">
                        💾 Save All
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
        
        // ⭐ 검증 버튼
        const validateBtn = this.$('#btn-validate');
        if (validateBtn) {
            this.addDomListener(validateBtn, 'click', () => {
                this._handleValidate();
            });
        }
        
        // ⭐ 서버 동기화 버튼
        const syncBtn = this.$('#btn-sync-server');
        if (syncBtn) {
            this.addDomListener(syncBtn, 'click', () => {
                this._handleSyncFromServer();
            });
        }
        
        // ⭐ 서버 저장 버튼
        const saveBtn = this.$('#btn-save-server');
        if (saveBtn) {
            this.addDomListener(saveBtn, 'click', () => {
                this._handleSaveToServer();
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
        
        // 매핑 저장
        this.editState.setMapping(this.currentEquipment.userData.id, {
            equipment_id: this.selectedEquipmentId,
            equipment_name: this.selectedEquipmentName
        });
        
        toast.success(`Mapped: ${this.currentEquipment.userData.id} → ${this.selectedEquipmentName}`);
        
        // 모달 닫기
        this.close();
    }
    
    // ==========================================
    // ⭐ 서버 연동 메서드 (신규)
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
     * 서버에서 매핑 로드
     */
    async _handleSyncFromServer() {
        const syncBtn = this.$('#btn-sync-server');
        
        try {
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '🔄 Loading...';
            }
            
            // 충돌 감지
            const conflicts = await this.mappingService.detectConflicts();
            
            if (conflicts.needsSync && conflicts.conflicts.length > 0) {
                // 충돌이 있으면 사용자에게 확인
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
     * 서버에 매핑 저장
     */
    async _handleSaveToServer() {
        if (this.isSaving) return;
        
        const saveBtn = this.$('#btn-save-server');
        const mappingCount = this.editState?.getMappingCount() || 0;
        
        if (mappingCount === 0) {
            toast.warning('No mappings to save');
            return;
        }
        
        // 저장 확인
        const confirmed = confirm(
            `💾 Save ${mappingCount} mappings to server?\n\n` +
            `This will overwrite existing server data.`
        );
        
        if (!confirmed) return;
        
        try {
            this.isSaving = true;
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '💾 Saving...';
            }
            
            const result = await this.mappingService.saveMappings(true); // 검증 후 저장
            
            if (result.success) {
                toast.success(`✅ Saved ${result.total || mappingCount} mappings to server`);
                this._updateSyncStatus();
            } else {
                // 검증 실패
                if (result.validation) {
                    this._displayValidationResult(result.validation, 'server');
                }
                toast.error('Save failed: Validation errors');
            }
            
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Save failed: ' + error.message);
        } finally {
            this.isSaving = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '💾 Save All';
            }
        }
    }
    
    /**
     * 검증 결과 표시
     * @param {Object} result - 검증 결과
     * @param {string} source - 'local' | 'server'
     */
    _displayValidationResult(result, source) {
        const validationStatus = this.$('#validation-status');
        if (!validationStatus) return;
        
        validationStatus.style.display = 'block';
        
        const statusColor = result.valid ? '#4CAF50' : '#f44336';
        const statusIcon = result.valid ? '✅' : '❌';
        
        let html = `
            <div style="
                background: ${result.valid ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'};
                border: 1px solid ${statusColor};
                border-radius: 4px;
                padding: 12px;
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 18px;">${statusIcon}</span>
                    <span style="color: ${statusColor}; font-weight: bold;">
                        ${result.valid ? 'Validation Passed' : 'Validation Failed'}
                    </span>
                    <span style="color: #666; font-size: 12px;">(${source})</span>
                </div>
        `;
        
        // 에러 표시
        if (result.errors && result.errors.length > 0) {
            html += `
                <div style="margin-top: 8px;">
                    <div style="color: #f44336; font-weight: 500; margin-bottom: 4px;">Errors:</div>
                    <ul style="margin: 0; padding-left: 20px; color: #ff6b6b; font-size: 12px;">
                        ${result.errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
                        ${result.errors.length > 5 ? `<li>... and ${result.errors.length - 5} more</li>` : ''}
                    </ul>
                </div>
            `;
        }
        
        // 경고 표시
        if (result.warnings && result.warnings.length > 0) {
            html += `
                <div style="margin-top: 8px;">
                    <div style="color: #FFC107; font-weight: 500; margin-bottom: 4px;">Warnings:</div>
                    <ul style="margin: 0; padding-left: 20px; color: #ffd54f; font-size: 12px;">
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
            syncStatus.innerHTML = `
                <span style="color: ${status.isDirty ? '#FFC107' : '#4CAF50'};">
                    ${status.isDirty ? '⚠️ Unsaved changes' : '✅ Synced'} • Last sync: ${timeAgo}
                </span>
            `;
        } else {
            syncStatus.innerHTML = `
                <span style="color: #888;">Not synced with server</span>
            `;
        }
    }
    
    /**
     * 시간 포맷팅
     * @param {Date} date
     * @returns {string}
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
            const pos = this.currentEquipment.position;
            positionEl.textContent = `Row ${userData.row || '-'}, Col ${userData.col || '-'}`;
        }
        
        if (currentMappingEl) {
            const mapping = this.editState?.getMapping(userData.id);
            if (mapping) {
                currentMappingEl.innerHTML = `
                    <span style="color: #4CAF50;">${mapping.equipment_name}</span>
                    <span style="color: #666; font-size: 12px;">(ID: ${mapping.equipment_id})</span>
                `;
            } else {
                currentMappingEl.textContent = 'Not Assigned';
                currentMappingEl.style.color = '#888';
            }
        }
    }
    
    /**
     * Available Equipments 로드
     */
    async _loadAvailableEquipments() {
        const listContainer = this.$('#equipment-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #888;">Loading equipment list...</div>';
        
        try {
            // ⭐ MappingService 통해 로드 (캐싱 적용)
            const equipments = await this.mappingService.loadEquipmentNames();
            
            this.availableEquipments = equipments;
            this.filteredEquipments = equipments;
            
            this._renderEquipmentList();
            
        } catch (error) {
            console.error('Failed to load equipment list:', error);
            listContainer.innerHTML = '<div class="error" style="padding: 20px; text-align: center; color: #f44336;">Failed to load equipment list</div>';
            toast.error('Failed to load equipment list');
        }
    }
    
    /**
     * Equipment 목록 렌더링
     */
    _renderEquipmentList() {
        const listContainer = this.$('#equipment-list');
        if (!listContainer) return;
        
        if (this.filteredEquipments.length === 0) {
            listContainer.innerHTML = '<div class="no-results" style="padding: 20px; text-align: center; color: #888;">No equipment found</div>';
            return;
        }
        
        listContainer.innerHTML = '';
        
        this.filteredEquipments.forEach(equipment => {
            const item = document.createElement('div');
            item.className = 'equipment-item';
            
            // 이미 할당되었는지 확인
            const assignedTo = this.editState.findDuplicate(equipment.equipment_id);
            const isAssigned = assignedTo !== null;
            const isCurrent = assignedTo === this.currentEquipment?.userData.id;
            
            item.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                border-bottom: 1px solid #333;
                background: ${isAssigned && !isCurrent ? '#2a2020' : 'transparent'};
                cursor: pointer;
            `;
            
            item.innerHTML = `
                <div class="equipment-item-content" style="flex: 1;">
                    <div class="equipment-item-header" style="display: flex; align-items: center; gap: 8px;">
                        <span class="equipment-name" style="color: #fff; font-weight: 500;">${equipment.equipment_name}</span>
                        ${isAssigned ? `<span class="badge badge-info" style="
                            background: #2196F3;
                            color: #fff;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 10px;
                        ">Assigned</span>` : ''}
                    </div>
                    <div class="equipment-item-details" style="display: flex; gap: 12px; margin-top: 4px; font-size: 12px; color: #888;">
                        <span class="equipment-code">Code: ${equipment.equipment_code || 'N/A'}</span>
                        <span class="equipment-line">Line: ${equipment.line_name || 'N/A'}</span>
                        ${isAssigned && !isCurrent ? `<span class="assigned-to" style="color: #f44336;">→ ${assignedTo}</span>` : ''}
                    </div>
                </div>
                <button class="btn-select" data-equipment-id="${equipment.equipment_id}" 
                    ${isAssigned && !isCurrent ? 'disabled' : ''}
                    style="
                        padding: 6px 12px;
                        background: ${isCurrent ? '#4CAF50' : '#2196F3'};
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        cursor: ${isAssigned && !isCurrent ? 'not-allowed' : 'pointer'};
                        opacity: ${isAssigned && !isCurrent ? '0.5' : '1'};
                        font-size: 12px;
                    ">
                    ${isCurrent ? '✓ Current' : 'Select'}
                </button>
            `;
            
            // Select 버튼 이벤트
            const selectBtn = item.querySelector('.btn-select');
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isAssigned || isCurrent) {
                    this._selectEquipment(equipment);
                } else {
                    this._confirmDuplicateOverride(equipment, assignedTo);
                }
            });
            
            // 호버 효과
            item.addEventListener('mouseenter', () => {
                if (!isAssigned || isCurrent) {
                    item.style.background = '#333';
                }
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = isAssigned && !isCurrent ? '#2a2020' : 'transparent';
            });
            
            listContainer.appendChild(item);
        });
    }
    
    /**
     * Equipment 필터링
     * @param {string} searchTerm - 검색어
     */
    filterEquipments(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            this.filteredEquipments = this.availableEquipments;
        } else {
            this.filteredEquipments = this.availableEquipments.filter(eq => 
                eq.equipment_name.toLowerCase().includes(term) ||
                (eq.equipment_code && eq.equipment_code.toLowerCase().includes(term)) ||
                (eq.line_name && eq.line_name.toLowerCase().includes(term))
            );
        }
        
        this._renderEquipmentList();
    }
    
    /**
     * Equipment 선택
     * @param {Object} equipment - 선택된 설비
     */
    _selectEquipment(equipment) {
        this.selectedEquipmentId = equipment.equipment_id;
        this.selectedEquipmentName = equipment.equipment_name;
        
        // Confirm 버튼 활성화
        this.setConfirmEnabled(true);
        this.setConfirmText(`Confirm: ${equipment.equipment_name}`);
        
        // 목록에서 선택 표시
        const listContainer = this.$('#equipment-list');
        if (listContainer) {
            listContainer.querySelectorAll('.equipment-item').forEach(item => {
                item.classList.remove('selected');
                item.style.borderLeft = 'none';
            });
            
            const selectedItem = listContainer.querySelector(`[data-equipment-id="${equipment.equipment_id}"]`)?.closest('.equipment-item');
            if (selectedItem) {
                selectedItem.classList.add('selected');
                selectedItem.style.borderLeft = '3px solid #2196F3';
            }
        }
        
        debugLog(`✅ Selected: ${equipment.equipment_name}`);
    }
    
    /**
     * 중복 할당 확인
     * @param {Object} equipment - 선택하려는 설비
     * @param {string} assignedTo - 이미 할당된 Frontend ID
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
        
        progressEl.textContent = `${completion.mapped} / ${completion.total} Mapped (${completion.percentage}%)`;
        
        if (completion.isComplete) {
            progressEl.innerHTML = `
                <span class="badge badge-success" style="
                    background: #4CAF50;
                    color: #fff;
                    padding: 4px 12px;
                    border-radius: 4px;
                ">
                    ✓ All Equipment Mapped (${completion.total} / ${completion.total})
                </span>
            `;
        }
    }
}

export default EquipmentEditModal;