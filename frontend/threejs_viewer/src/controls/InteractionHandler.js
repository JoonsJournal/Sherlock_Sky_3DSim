/**
 * InteractionHandler.js
 * 마우스 및 키보드 상호작용 처리 (다중 선택 기능 포함)
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';

export class InteractionHandler {
    constructor(camera, scene, equipmentArray) {
        this.camera = camera;
        this.scene = scene;
        this.equipmentArray = equipmentArray;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // 다중 선택을 위해 배열로 변경
        this.selectedEquipments = [];
        this.onEquipmentClickCallback = null;
        
        this.init();
    }
    
    /**
     * 이벤트 리스너 초기화
     */
    init() {
        // 마우스 클릭 이벤트
        window.addEventListener('click', (event) => this.onMouseClick(event), false);
        
        debugLog('🖱️ 상호작용 핸들러 초기화 완료 (다중 선택 지원)');
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
            
            // Ctrl 키가 눌렸는지 확인 (Mac의 경우 Cmd 키도 지원)
            const isMultiSelectMode = event.ctrlKey || event.metaKey;
            
            if (isMultiSelectMode) {
                // 다중 선택 모드
                this.handleMultiSelect(targetEquipment);
            } else {
                // 단일 선택 모드
                this.handleSingleSelect(targetEquipment);
            }
            
            // 콜백 호출 - 선택된 모든 설비의 데이터 전달
            if (this.onEquipmentClickCallback) {
                const selectedData = this.selectedEquipments.map(eq => eq.userData);
                this.onEquipmentClickCallback(selectedData);
            }
            
            debugLog('👆 설비 클릭:', targetEquipment.userData.id, 
                     `(선택된 설비: ${this.selectedEquipments.length}개)`);
            
        } else {
            // 빈 공간 클릭 시
            if (!event.ctrlKey && !event.metaKey) {
                // Ctrl 키가 안 눌렸으면 모든 선택 해제
                this.clearAllSelections();
                
                // 정보 패널 닫기
                if (window.closeEquipmentInfo) {
                    window.closeEquipmentInfo();
                }
            }
        }
    }
    
    /**
     * 단일 선택 처리
     * @param {THREE.Group} equipment - 설비 객체
     */
    handleSingleSelect(equipment) {
        // 이전 선택 모두 해제
        this.clearAllSelections();
        
        // 새 설비 선택
        this.selectedEquipments = [equipment];
        this.selectEquipment(equipment);
    }
    
    /**
     * 다중 선택 처리
     * @param {THREE.Group} equipment - 설비 객체
     */
    handleMultiSelect(equipment) {
        const index = this.selectedEquipments.indexOf(equipment);
        
        if (index > -1) {
            // 이미 선택된 설비 → 선택 취소
            this.selectedEquipments.splice(index, 1);
            this.deselectEquipment(equipment);
            debugLog('✖️ 설비 선택 취소:', equipment.userData.id);
        } else {
            // 새로운 설비 추가 선택
            this.selectedEquipments.push(equipment);
            this.selectEquipment(equipment);
            debugLog('✅ 설비 추가 선택:', equipment.userData.id);
        }
    }
    
    /**
     * 모든 선택 해제
     */
    clearAllSelections() {
        this.selectedEquipments.forEach(equipment => {
            this.deselectEquipment(equipment);
        });
        this.selectedEquipments = [];
    }
    
    /**
     * 설비 선택 시각 효과
     * @param {THREE.Group} equipment - 설비 객체
     */
    selectEquipment(equipment) {
        equipment.traverse((child) => {
            if (child.isMesh && child.material) {
                // 하이라이트 효과
                if (child.material.emissive) {
                    child.material.emissive.setHex(0x4444ff);
                }
            }
        });
    }
    
    /**
     * 설비 선택 해제
     * @param {THREE.Group} equipment - 설비 객체
     */
    deselectEquipment(equipment) {
        equipment.traverse((child) => {
            if (child.isMesh && child.material) {
                // 원래 색상으로 복원
                if (child.material.emissive) {
                    child.material.emissive.setHex(0x000000);
                }
            }
        });
    }
    
    /**
     * 설비 클릭 콜백 설정
     * @param {Function} callback - 콜백 함수 (배열 형태의 설비 데이터 받음)
     */
    setOnEquipmentClick(callback) {
        this.onEquipmentClickCallback = callback;
    }
    
    /**
     * 현재 선택된 설비들 반환
     * @returns {Array<THREE.Group>}
     */
    getSelectedEquipments() {
        return this.selectedEquipments;
    }
    
    /**
     * 선택된 설비 개수 반환
     * @returns {number}
     */
    getSelectedCount() {
        return this.selectedEquipments.length;
    }
    
    /**
     * 특정 설비가 선택되었는지 확인
     * @param {THREE.Group} equipment - 설비 객체
     * @returns {boolean}
     */
    isSelected(equipment) {
        return this.selectedEquipments.includes(equipment);
    }
    
    /**
     * 설비 배열 업데이트 (동적 변경 시)
     * @param {Array<THREE.Group>} equipmentArray - 새로운 설비 배열
     */
    updateEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
    }
}