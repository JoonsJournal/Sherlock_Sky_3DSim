/**
 * EquipmentEditModal.js
 * 설비 편집 모달
 */

import { ToastNotification } from '../common/Toast.js';
import { debugLog } from '../../core/utils/Config.js';

export class EquipmentEditModal {
    constructor(editState, apiClient) {
        this.editState = editState;
        this.apiClient = apiClient;
        this.toast = new ToastNotification();
        
        this.isOpen = false;
        this.currentEquipment = null;
        this.availableEquipments = [];
        this.filteredEquipments = [];
        
        this.createModal();
        this.attachEventListeners();
    }
    
    /**
     * 모달 HTML 생성
     */
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'equipment-edit-modal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content equipment-edit-modal-content">
                <div class="modal-header">
                    <h2>🛠️ Equipment Mapping Editor</h2>
                    <button class="modal-close" title="Close (Esc)">&times;</button>
                </div>
                
                <div class="modal-body">
                    <!-- Selected Equipment Info -->
                    <div class="edit-section">
                        <h3>Selected Equipment</h3>
                        <div class="info-box">
                            <div class="info-row">
                                <span class="label">Frontend ID:</span>
                                <span id="edit-frontend-id" class="value">-</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Position:</span>
                                <span id="edit-position" class="value">-</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Current Mapping:</span>
                                <span id="edit-current-mapping" class="value">Not Assigned</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Equipment Name Selection -->
                    <div class="edit-section">
                        <h3>Equipment Name</h3>
                        <div class="search-box">
                            <input 
                                type="text" 
                                id="equipment-search" 
                                placeholder="Search equipment name..."
                                autocomplete="off"
                            >
                            <button id="clear-search-btn" class="btn-icon" title="Clear">✕</button>
                        </div>
                        
                        <!-- Equipment List -->
                        <div class="equipment-list" id="equipment-list">
                            <div class="loading">Loading equipment list...</div>
                        </div>
                    </div>
                    
                    <!-- Progress -->
                    <div class="edit-section">
                        <div class="progress-info">
                            <span id="mapping-progress">0 / 0 Mapped</span>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancel-edit-btn">Cancel</button>
                    <button class="btn-primary" id="confirm-edit-btn" disabled>Confirm</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.modalElement = modal;
    }
    
    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        // 모달 닫기
        const closeBtn = this.modalElement.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.close());
        
        const cancelBtn = this.modalElement.querySelector('#cancel-edit-btn');
        cancelBtn.addEventListener('click', () => this.close());
        
        const overlay = this.modalElement.querySelector('.modal-overlay');
        overlay.addEventListener('click', () => this.close());
        
        // ESC 키
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // 검색
        const searchInput = this.modalElement.querySelector('#equipment-search');
        searchInput.addEventListener('input', (e) => {
            this.filterEquipments(e.target.value);
        });
        
        const clearBtn = this.modalElement.querySelector('#clear-search-btn');
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.filterEquipments('');
        });
        
        // Confirm 버튼
        const confirmBtn = this.modalElement.querySelector('#confirm-edit-btn');
        confirmBtn.addEventListener('click', () => this.confirmSelection());
    }
    
    /**
     * 모달 열기
     * @param {THREE.Group} equipment - 선택된 설비
     */
    async open(equipment) {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.currentEquipment = equipment;
        this.modalElement.classList.add('modal-show');
        document.body.style.overflow = 'hidden';
        
        // 설비 정보 표시
        this.displayEquipmentInfo();
        
        // 진행 상황 업데이트
        this.updateProgress();
        
        // Equipment 목록 로드
        await this.loadAvailableEquipments();
    }
    
    /**
     * 모달 닫기
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.currentEquipment = null;
        this.selectedEquipmentId = null;
        this.modalElement.classList.remove('modal-show');
        document.body.style.overflow = '';
        
        // 검색 초기화
        this.modalElement.querySelector('#equipment-search').value = '';
    }
    
    /**
     * 설비 정보 표시
     */
    displayEquipmentInfo() {
        const userData = this.currentEquipment.userData;
        
        document.getElementById('edit-frontend-id').textContent = userData.id;
        document.getElementById('edit-position').textContent = 
            `Row ${userData.position.row}, Col ${userData.position.col}`;
        
        // 현재 매핑 확인
        const mapping = this.editState.getMapping(userData.id);
        
        if (mapping) {
            document.getElementById('edit-current-mapping').innerHTML = 
                `<span class="badge badge-success">${mapping.equipment_name}</span>`;
        } else {
            document.getElementById('edit-current-mapping').innerHTML = 
                `<span class="badge badge-warning">Not Assigned</span>`;
        }
    }
    
    /**
     * Available Equipment 목록 로드
     */
    async loadAvailableEquipments() {
        const listContainer = this.modalElement.querySelector('#equipment-list');
        
        try {
            listContainer.innerHTML = '<div class="loading">Loading equipment list...</div>';
            
            // API 호출
            const equipments = await this.apiClient.get('/equipment/names');
            
            this.availableEquipments = equipments;
            this.filteredEquipments = equipments;
            
            this.renderEquipmentList();
            
        } catch (error) {
            console.error('Failed to load equipment list:', error);
            listContainer.innerHTML = '<div class="error">Failed to load equipment list</div>';
            this.toast.error('Failed to load equipment list');
        }
    }
    
    /**
     * Equipment 목록 렌더링
     */
    renderEquipmentList() {
        const listContainer = this.modalElement.querySelector('#equipment-list');
        
        if (this.filteredEquipments.length === 0) {
            listContainer.innerHTML = '<div class="no-results">No equipment found</div>';
            return;
        }
        
        listContainer.innerHTML = '';
        
        this.filteredEquipments.forEach(equipment => {
            const item = document.createElement('div');
            item.className = 'equipment-item';
            
            // 이미 할당되었는지 확인
            const assignedTo = this.editState.findDuplicate(equipment.equipment_id);
            const isAssigned = assignedTo !== null;
            const isCurrent = assignedTo === this.currentEquipment.userData.id;
            
            if (isAssigned && !isCurrent) {
                item.classList.add('assigned');
            }
            
            item.innerHTML = `
                <div class="equipment-item-content">
                    <div class="equipment-item-header">
                        <span class="equipment-name">${equipment.equipment_name}</span>
                        ${isAssigned ? `<span class="badge badge-info">Assigned</span>` : ''}
                    </div>
                    <div class="equipment-item-details">
                        <span class="equipment-code">Code: ${equipment.equipment_code || 'N/A'}</span>
                        <span class="equipment-line">Line: ${equipment.line_name || 'N/A'}</span>
                        ${isAssigned && !isCurrent ? `<span class="assigned-to">→ ${assignedTo}</span>` : ''}
                    </div>
                </div>
                <button class="btn-select" data-equipment-id="${equipment.equipment_id}" ${isAssigned && !isCurrent ? 'disabled' : ''}>
                    ${isCurrent ? '✓ Current' : 'Select'}
                </button>
            `;
            
            // Select 버튼 이벤트
            const selectBtn = item.querySelector('.btn-select');
            selectBtn.addEventListener('click', () => {
                if (!isAssigned || isCurrent) {
                    this.selectEquipment(equipment);
                } else {
                    this.confirmDuplicateOverride(equipment, assignedTo);
                }
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
        
        this.renderEquipmentList();
    }
    
    /**
     * Equipment 선택
     * @param {Object} equipment - 선택된 설비
     */
    selectEquipment(equipment) {
        this.selectedEquipmentId = equipment.equipment_id;
        this.selectedEquipmentName = equipment.equipment_name;
        
        // Confirm 버튼 활성화
        const confirmBtn = this.modalElement.querySelector('#confirm-edit-btn');
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm: ${equipment.equipment_name}`;
        
        // 목록에서 선택 표시
        this.modalElement.querySelectorAll('.equipment-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        this.modalElement.querySelectorAll(`[data-equipment-id="${equipment.equipment_id}"]`)
            .forEach(btn => {
                btn.closest('.equipment-item').classList.add('selected');
            });
        
        debugLog(`✅ Selected: ${equipment.equipment_name}`);
    }
    
    /**
     * 중복 할당 확인
     * @param {Object} equipment - 선택하려는 설비
     * @param {string} assignedTo - 이미 할당된 Frontend ID
     */
    confirmDuplicateOverride(equipment, assignedTo) {
        const confirmed = confirm(
            `⚠️ ${equipment.equipment_name} is already assigned to ${assignedTo}.\n\n` +
            `Do you want to remove the existing mapping and assign it to ${this.currentEquipment.userData.id}?`
        );
        
        if (confirmed) {
            // 기존 매핑 제거
            delete this.editState.mappings[assignedTo];
            
            // 새로 선택
            this.selectEquipment(equipment);
            
            // 목록 다시 렌더링
            this.renderEquipmentList();
            
            this.toast.warning(`Removed mapping from ${assignedTo}`);
        }
    }
    
    /**
     * 선택 확인
     */
    confirmSelection() {
        if (!this.selectedEquipmentId) {
            this.toast.warning('Please select an equipment');
            return;
        }
        
        // 매핑 저장
        this.editState.setMapping(this.currentEquipment.userData.id, {
            equipment_id: this.selectedEquipmentId,
            equipment_name: this.selectedEquipmentName
        });
        
        this.toast.success(`Mapped: ${this.currentEquipment.userData.id} → ${this.selectedEquipmentName}`);
        
        // 진행 상황 업데이트
        this.updateProgress();
        
        // 모달 닫기
        this.close();
    }
    
    /**
     * 진행 상황 업데이트
     */
    updateProgress() {
        const totalEquipments = 117; // CONFIG.EQUIPMENT.ROWS * CONFIG.EQUIPMENT.COLS - excluded
        const mappedCount = this.editState.getMappingCount();
        
        const progressEl = this.modalElement.querySelector('#mapping-progress');
        progressEl.textContent = `${mappedCount} / ${totalEquipments} Mapped`;
        
        if (mappedCount === totalEquipments) {
            progressEl.innerHTML = `
                <span class="badge badge-success">
                    ✓ All Equipment Mapped (${totalEquipments} / ${totalEquipments})
                </span>
            `;
        }
    }
}