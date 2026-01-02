/**
 * InteractionHandler.js
 * 마우스 및 키보드 상호작용 처리
 * 
 * @version 2.0.0 (Phase 1.4 리팩토링)
 * @description Selection 로직을 SelectionManager로 분리
 * 
 * 변경 사항:
 * - selectEquipment(), deselectEquipment() 제거 → SelectionVisualizer 사용
 * - selectedEquipments 배열 제거 → SelectionManager 사용
 * - 호버 효과 추가 (SelectionVisualizer 사용)
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';
import { SelectionManager, SelectionVisualizer } from '../viewer3d/selection/index.js';

export class InteractionHandler {
    constructor(camera, scene, domElement) {
        this.camera = camera;
        this.scene = scene;
        this.domElement = domElement;
        this.equipmentArray = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // ⭐ Selection 시스템 (분리됨)
        this.selectionManager = new SelectionManager();
        this.selectionVisualizer = new SelectionVisualizer();
        this.selectionManager.setVisualizer(this.selectionVisualizer);
        
        // 콜백 함수들
        this.onEquipmentClickCallback = null;
        this.onEquipmentDeselectCallback = null;
        
        // DataOverlay와 StatusVisualizer 참조
        this.dataOverlay = null;
        this.statusVisualizer = null;
        
        // Edit 모드 관련
        this.editState = null;
        this.editModal = null;
        
        // 호버 상태 추적
        this.lastHoveredEquipment = null;
        
        this.init();
    }
    
    /**
     * 이벤트 리스너 초기화
     */
    init() {
        // 마우스 클릭 이벤트
        this.domElement.addEventListener('click', (event) => this.onMouseClick(event), false);
        
        // ⭐ 마우스 이동 이벤트 (호버 효과)
        this.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
        
        debugLog('🖱️ InteractionHandler 초기화 완료 (Selection 분리 적용)');
    }
    
    /**
     * DataOverlay 설정
     * @param {DataOverlay} dataOverlay - DataOverlay 인스턴스
     */
    setDataOverlay(dataOverlay) {
        this.dataOverlay = dataOverlay;
        debugLog('📊 DataOverlay 연결됨');
    }
    
    /**
     * StatusVisualizer 설정
     * @param {StatusVisualizer} statusVisualizer - StatusVisualizer 인스턴스
     */
    setStatusVisualizer(statusVisualizer) {
        this.statusVisualizer = statusVisualizer;
        debugLog('🎨 StatusVisualizer 연결됨');
    }
    
    /**
     * 설비 배열 설정
     * @param {Array<THREE.Group>} equipmentArray - 설비 배열
     */
    setEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
        debugLog(`📦 설비 배열 설정됨: ${equipmentArray.length}개`);
    }
    
    /**
     * Edit State 설정
     * @param {EquipmentEditState} editState - EquipmentEditState 인스턴스
     */
    setEditMode(editState) {
        this.editState = editState;
        debugLog('✏️ EquipmentEditState 연결됨');
    }
    
    /**
     * Edit Modal 설정
     * @param {EquipmentEditModal} editModal - EquipmentEditModal 인스턴스
     */
    setEditModal(editModal) {
        this.editModal = editModal;
        debugLog('📝 EquipmentEditModal 연결됨');
    }
    
    /**
     * ⭐ 마우스 이동 핸들러 (호버 효과)
     * @param {MouseEvent} event 
     */
    onMouseMove(event) {
        // 마우스 좌표 정규화
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Raycaster 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 교차 검사
        const intersects = this.raycaster.intersectObjects(this.equipmentArray, true);
        
        if (intersects.length > 0) {
            // 가장 가까운 객체의 최상위 그룹 찾기
            let targetEquipment = intersects[0].object;
            while (targetEquipment.parent && !this.equipmentArray.includes(targetEquipment)) {
                targetEquipment = targetEquipment.parent;
            }
            
            // 이미 선택된 객체는 호버 효과 제외
            if (!this.selectionManager.isSelected(targetEquipment)) {
                // 새로운 호버 대상
                if (this.lastHoveredEquipment !== targetEquipment) {
                    // 이전 호버 제거 (선택되지 않은 경우에만)
                    if (this.lastHoveredEquipment && 
                        !this.selectionManager.isSelected(this.lastHoveredEquipment)) {
                        this.selectionVisualizer.removeHoverStyle(this.lastHoveredEquipment);
                    }
                    
                    // 새 호버 적용
                    this.selectionVisualizer.applyHoverStyle(targetEquipment);
                    this.lastHoveredEquipment = targetEquipment;
                }
            }
            
            // 커서 변경
            this.domElement.style.cursor = 'pointer';
        } else {
            // 빈 공간 호버
            if (this.lastHoveredEquipment && 
                !this.selectionManager.isSelected(this.lastHoveredEquipment)) {
                this.selectionVisualizer.removeHoverStyle(this.lastHoveredEquipment);
            }
            this.lastHoveredEquipment = null;
            this.domElement.style.cursor = 'default';
        }
    }
    
    /**
     * 마우스 클릭 핸들러
     * @param {MouseEvent} event - 마우스 이벤트
     */
    onMouseClick(event) {
        // 마우스 좌표를 정규화된 장치 좌표로 변환 (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Raycaster 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 교차 검사
        const intersects = this.raycaster.intersectObjects(this.equipmentArray, true);
        
        if (intersects.length > 0) {
            // 가장 가까운 객체의 최상위 그룹 찾기
            let targetEquipment = intersects[0].object;
            while (targetEquipment.parent && !this.equipmentArray.includes(targetEquipment)) {
                targetEquipment = targetEquipment.parent;
            }
            
            // Edit Mode 활성화 시 모달 열기
            if (this.editState && this.editState.editModeEnabled) {
                if (this.editModal) {
                    this.editModal.open(targetEquipment);
                    debugLog(`✏️ Edit Modal 열림: ${targetEquipment.userData.id}`);
                }
                return; // Edit 모드에서는 다른 동작 차단
            }
            
            // ⭐ Ctrl/Cmd 키 확인 (다중 선택)
            const isMultiSelectMode = event.ctrlKey || event.metaKey;
            
            if (isMultiSelectMode) {
                // 다중 선택 모드: 토글
                this.selectionManager.toggle(targetEquipment);
            } else {
                // 단일 선택 모드
                this.selectionManager.select(targetEquipment, false);
            }
            
            // 호버 상태 정리 (선택되면 호버 제거)
            if (this.lastHoveredEquipment === targetEquipment) {
                this.lastHoveredEquipment = null;
            }
            
            // ⭐ 선택된 설비들의 데이터 수집 (SelectionManager 사용)
            const selectedData = this.selectionManager.getSelectedData();
            
            // DataOverlay에 정보 표시
            if (this.dataOverlay && selectedData.length > 0) {
                this.dataOverlay.showEquipmentInfo(selectedData);
            }
            
            // 콜백 호출
            if (this.onEquipmentClickCallback) {
                this.onEquipmentClickCallback(selectedData);
            }
            
            debugLog('👆 설비 클릭:', targetEquipment.userData.id, 
                     `(선택된 설비: ${this.selectionManager.getSelectedCount()}개)`);
            
        } else {
            // 빈 공간 클릭 시
            if (!event.ctrlKey && !event.metaKey) {
                // Ctrl 키가 안 눌렸으면 모든 선택 해제
                this.selectionManager.clearSelection();
                
                // DataOverlay 닫기
                if (this.dataOverlay) {
                    this.dataOverlay.hideEquipmentInfo();
                }
                
                // 콜백 호출
                if (this.onEquipmentDeselectCallback) {
                    this.onEquipmentDeselectCallback();
                }
            }
        }
    }
    
    /**
     * 설비 클릭 콜백 설정
     * @param {Function} callback - 콜백 함수 (배열 형태의 설비 데이터 받음)
     */
    setOnEquipmentClick(callback) {
        this.onEquipmentClickCallback = callback;
    }
    
    /**
     * 설비 선택 해제 콜백 설정
     * @param {Function} callback - 콜백 함수
     */
    setOnEquipmentDeselect(callback) {
        this.onEquipmentDeselectCallback = callback;
    }
    
    // ============================================
    // ⭐ 호환성 유지 메서드들 (기존 코드 지원)
    // ============================================
    
    /**
     * 현재 선택된 설비들 반환 (호환성)
     * @returns {Array<THREE.Group>}
     */
    getSelectedEquipments() {
        return this.selectionManager.getSelected();
    }
    
    /**
     * 선택된 설비 개수 반환 (호환성)
     * @returns {number}
     */
    getSelectedCount() {
        return this.selectionManager.getSelectedCount();
    }
    
    /**
     * 특정 설비가 선택되었는지 확인 (호환성)
     * @param {THREE.Group} equipment - 설비 객체
     * @returns {boolean}
     */
    isSelected(equipment) {
        return this.selectionManager.isSelected(equipment);
    }
    
    /**
     * 모든 선택 해제 (호환성)
     */
    clearAllSelections() {
        this.selectionManager.clearSelection();
    }
    
    /**
     * SelectionManager 직접 접근 (새 코드용)
     * @returns {SelectionManager}
     */
    getSelectionManager() {
        return this.selectionManager;
    }
    
    /**
     * SelectionVisualizer 직접 접근 (새 코드용)
     * @returns {SelectionVisualizer}
     */
    getSelectionVisualizer() {
        return this.selectionVisualizer;
    }
    
    /**
     * 설비 배열 업데이트 (동적 변경 시)
     * @param {Array<THREE.Group>} equipmentArray - 새로운 설비 배열
     */
    updateEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
    }
    
    /**
     * 정리
     */
    dispose() {
        this.domElement.removeEventListener('click', this.onMouseClick);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        
        this.selectionManager.dispose();
        this.selectionVisualizer.dispose();
        
        debugLog('🗑️ InteractionHandler 정리 완료');
    }
}