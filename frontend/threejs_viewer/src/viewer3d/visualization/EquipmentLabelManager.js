/**
 * EquipmentLabelManager.js
 * CSS2DRenderer를 이용한 설비 라벨 관리
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { debugLog } from '../../core/utils/Config.js';

export class EquipmentLabelManager {
    constructor(sceneManager, equipmentLoader) {
        this.sceneManager = sceneManager;
        this.equipmentLoader = equipmentLoader;
        
        // CSS2D Renderer 생성
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        document.body.appendChild(this.labelRenderer.domElement);
        
        // 라벨 객체 저장
        this.labels = new Map(); // frontendId -> CSS2DObject
        
        // 라벨 표시 여부
        this.labelsVisible = true;
        
        // LOD 설정
        this.maxLabelDistance = 50; // 50m 이내만 표시
        
        // 창 크기 변경 이벤트
        window.addEventListener('resize', () => this.onWindowResize());
        
        debugLog('🏷️ EquipmentLabelManager 초기화 완료');
    }
    
    /**
     * 라벨 생성
     * @param {THREE.Group} equipment - 설비 객체
     * @param {string} labelText - 라벨 텍스트
     */
    createLabel(equipment, labelText) {
        const frontendId = equipment.userData.id;
        
        // 이미 라벨이 있으면 제거
        if (this.labels.has(frontendId)) {
            this.removeLabel(frontendId);
        }
        
        // HTML 엘리먼트 생성
        const labelDiv = document.createElement('div');
        labelDiv.className = 'equipment-label';
        labelDiv.textContent = labelText;
        
        // CSS2DObject 생성
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 2.5, 0); // 설비 위 2.5m
        
        // 설비에 추가
        equipment.add(label);
        
        // 저장
        this.labels.set(frontendId, label);
        
        debugLog(`🏷️ Label created: ${frontendId} → ${labelText}`);
    }
    
    /**
     * 라벨 제거
     * @param {string} frontendId - Frontend 설비 ID
     */
    removeLabel(frontendId) {
        const label = this.labels.get(frontendId);
        
        if (label) {
            label.element.remove();
            label.parent.remove(label);
            this.labels.delete(frontendId);
            
            debugLog(`🗑️ Label removed: ${frontendId}`);
        }
    }
    
    /**
     * 라벨 업데이트
     * @param {string} frontendId - Frontend 설비 ID
     * @param {string} newText - 새 텍스트
     */
    updateLabel(frontendId, newText) {
        const label = this.labels.get(frontendId);
        
        if (label) {
            label.element.textContent = newText;
            debugLog(`🔄 Label updated: ${frontendId} → ${newText}`);
        }
    }
    
    /**
     * 모든 라벨 업데이트 (매핑 데이터 기반)
     * @param {Object} mappings - { 'EQ-01-01': { equipment_name: '...' }, ... }
     */
    updateAllLabels(mappings) {
        const equipmentArray = this.equipmentLoader.getEquipmentArray();
        
        equipmentArray.forEach(equipment => {
            const frontendId = equipment.userData.id;
            const mapping = mappings[frontendId];
            
            if (mapping) {
                this.createLabel(equipment, mapping.equipment_name);
            } else {
                this.removeLabel(frontendId);
            }
        });
        
        debugLog(`🔄 All labels updated: ${Object.keys(mappings).length}개`);
    }
    
    /**
     * 라벨 표시/숨김
     * @param {boolean} visible - 표시 여부
     */
    setLabelsVisible(visible) {
        this.labelsVisible = visible;
        
        this.labels.forEach((label) => {
            label.element.style.display = visible ? 'block' : 'none';
        });
        
        debugLog(`🏷️ Labels ${visible ? 'shown' : 'hidden'}`);
    }
    
    /**
     * 라벨 토글
     */
    toggleLabels() {
        this.setLabelsVisible(!this.labelsVisible);
    }
    
    /**
     * LOD 업데이트 (거리 기반 표시/숨김)
     * @param {THREE.Camera} camera - 카메라
     */
    updateLOD(camera) {
        if (!this.labelsVisible) return;
        
        this.labels.forEach((label, frontendId) => {
            const equipment = this.equipmentLoader.getEquipment(frontendId);
            
            if (equipment) {
                const distance = camera.position.distanceTo(equipment.position);
                
                if (distance < this.maxLabelDistance) {
                    label.element.style.display = 'block';
                } else {
                    label.element.style.display = 'none';
                }
            }
        });
    }
    
    /**
     * 렌더링
     * @param {THREE.Scene} scene - 씬
     * @param {THREE.Camera} camera - 카메라
     */
    render(scene, camera) {
        this.labelRenderer.render(scene, camera);
    }
    
    /**
     * 창 크기 변경
     */
    onWindowResize() {
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * 정리
     */
    dispose() {
        this.labels.forEach((label, frontendId) => {
            this.removeLabel(frontendId);
        });
        
        this.labelRenderer.domElement.remove();
        
        window.removeEventListener('resize', () => this.onWindowResize());
        
        debugLog('🗑️ EquipmentLabelManager 정리 완료');
    }
}