/**
 * EquipmentEditModal.js
 * 설비 편집 모달
 * 
 * @version 2.0.0
 * @description BaseModal 상속 적용
 */

import { BaseModal } from '../core/base/BaseModal.js';
import { toast } from './common/Toast.js';
import { debugLog } from '../core/utils/Config.js';

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
        
        this.currentEquipment = null;
        this.availableEquipments = [];
        this.filteredEquipments = [];
        this.selectedEquipmentId = null;
        this.selectedEquipmentName = null;
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
                
                <!-- Progress -->
                <div class="edit-section" style="margin-top: 16px;">
                    <div class="progress-info" style="text-align: center;">
                        <span id="mapping-progress" style="color: #888;">0 / 0 Mapped</span>
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
            <button class="btn-secondary modal-cancel-btn">Cancel</button>
            <button class="btn-primary modal-confirm-btn" disabled>Confirm</button>
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
    }
    
    /**
     * Modal 열기 (equipment 데이터와 함께)
     * @param {THREE.Group} equipment - 선택된 설비
     */
    async open(equipment) {
        this.currentEquipment = equipment;
        this.selectedEquipmentId = null;
        this.selectedEquipmentName = null;
        
        // BaseModal의 open 호출
        super.open();
        
        // 설비 정보 표시
        this._displayEquipmentInfo();
        
        // 진행 상황 업데이트
        this._updateProgress();
        
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
        
        // 검색 초기화
        const searchInput = this.$('#equipment-search');
        if (searchInput) {
            searchInput.value = '';
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
        
        // 진행 상황 업데이트
        this._updateProgress();
        
        // 모달 닫기
        this.close();
    }
    
    /**
     * Cancel 버튼 클릭
     */
    onCancel() {
        this.close();
    }
    
    /**
     * 설비 정보 표시
     */
    _displayEquipmentInfo() {
        if (!this.currentEquipment) return;
        
        const userData = this.currentEquipment.userData;
        
        const frontendIdEl = this.$('#edit-frontend-id');
        const positionEl = this.$('#edit-position');
        const currentMappingEl = this.$('#edit-current-mapping');
        
        if (frontendIdEl) {
            frontendIdEl.textContent = userData.id;
        }
        
        if (positionEl) {
            positionEl.textContent = `Row ${userData.position.row}, Col ${userData.position.col}`;
        }
        
        // 현재 매핑 확인
        const mapping = this.editState.getMapping(userData.id);
        
        if (currentMappingEl) {
            if (mapping) {
                currentMappingEl.innerHTML = `<span class="badge badge-success" style="
                    background: #4CAF50;
                    color: #fff;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                ">${mapping.equipment_name}</span>`;
            } else {
                currentMappingEl.innerHTML = `<span class="badge badge-warning" style="
                    background: #FFC107;
                    color: #000;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                ">Not Assigned</span>`;
            }
        }
    }
    
    /**
     * Available Equipment 목록 로드
     */
    async _loadAvailableEquipments() {
        const listContainer = this.$('#equipment-list');
        if (!listContainer) return;
        
        try {
            listContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #888;">Loading equipment list...</div>';
            
            // API 호출
            const equipments = await this.apiClient.get('/equipment/names');
            
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
        const totalEquipments = 117; // CONFIG.EQUIPMENT.ROWS * CONFIG.EQUIPMENT.COLS - excluded
        const mappedCount = this.editState ? this.editState.getMappingCount() : 0;
        
        const progressEl = this.$('#mapping-progress');
        if (!progressEl) return;
        
        progressEl.textContent = `${mappedCount} / ${totalEquipments} Mapped`;
        
        if (mappedCount === totalEquipments) {
            progressEl.innerHTML = `
                <span class="badge badge-success" style="
                    background: #4CAF50;
                    color: #fff;
                    padding: 4px 12px;
                    border-radius: 4px;
                ">
                    ✓ All Equipment Mapped (${totalEquipments} / ${totalEquipments})
                </span>
            `;
        }
    }
}

export default EquipmentEditModal;