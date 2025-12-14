/**
 * InteractionHandler.js
 * 마우스 및 키보드 상호작용 처리
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
        this.selectedEquipment = null;
        this.onEquipmentClickCallback = null;
        
        this.init();
    }
    
    /**
     * 이벤트 리스너 초기화
     */
    init() {
        // 마우스 클릭 이벤트
        window.addEventListener('click', (event) => this.onMouseClick(event), false);
        
        debugLog('🖱️ 상호작용 핸들러 초기화 완료');
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
            
            // 이전 선택 해제
            if (this.selectedEquipment && this.selectedEquipment !== targetEquipment) {
                this.deselectEquipment(this.selectedEquipment);
            }
            
            // 새 설비 선택
            this.selectedEquipment = targetEquipment;
            this.selectEquipment(targetEquipment);
            
            // 콜백 호출
            if (this.onEquipmentClickCallback) {
                this.onEquipmentClickCallback(targetEquipment.userData);
            }
            
            debugLog('👆 설비 클릭:', targetEquipment.userData.id);
        } else {
            // 빈 공간 클릭 시 선택 해제
            if (this.selectedEquipment) {
                this.deselectEquipment(this.selectedEquipment);
                this.selectedEquipment = null;
                
                // 정보 패널 닫기
                if (window.closeEquipmentInfo) {
                    window.closeEquipmentInfo();
                }
            }
        }
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
     * @param {Function} callback - 콜백 함수
     */
    setOnEquipmentClick(callback) {
        this.onEquipmentClickCallback = callback;
    }
    
    /**
     * 현재 선택된 설비 반환
     * @returns {THREE.Group|null}
     */
    getSelectedEquipment() {
        return this.selectedEquipment;
    }
    
    /**
     * 설비 배열 업데이트 (동적 변경 시)
     * @param {Array<THREE.Group>} equipmentArray - 새로운 설비 배열
     */
    updateEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
    }
}