/**
 * InteractionHandler.js
 * 마우스 및 키보드 상호작용 처리
 * 
 * @version 2.5.0
 * @description 호버/선택 기능, Edit Mode 지원, Monitoring Mode 미연결 설비 안내
 * 
 * 📁 위치: frontend/threejs_viewer/src/viewer3d/controls/InteractionHandler.js
 */

import * as THREE from 'three';
import { debugLog } from '../../core/utils/Config.js';
import { SelectionManager, SelectionVisualizer } from '../selection/index.js';

export class InteractionHandler {
    constructor(camera, scene, domElement) {
        this.camera = camera;
        this.scene = scene;
        this.domElement = domElement;
        this.equipmentArray = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Selection 시스템
        this.selectionManager = new SelectionManager();
        this.selectionVisualizer = new SelectionVisualizer();
        this.selectionManager.setVisualizer(this.selectionVisualizer);
        
        // 호버 상태
        this.currentHoveredEquipment = null;
        
        // 콜백
        this.onEquipmentClickCallback = null;
        this.onEquipmentDeselectCallback = null;
        
        // 참조
        this.dataOverlay = null;
        this.statusVisualizer = null;
        this.editState = null;
        this.editModal = null;
        
        // ⭐ Monitoring 서비스 참조 (미연결 설비 안내용)
        this.monitoringService = null;
        
        this.init();
    }
    
    init() {
        this._boundOnMouseClick = (e) => this.onMouseClick(e);
        this._boundOnMouseMove = (e) => this.onMouseMove(e);
        this._boundOnMouseLeave = () => this.onMouseLeave();
        
        this.domElement.addEventListener('click', this._boundOnMouseClick, false);
        this.domElement.addEventListener('mousemove', this._boundOnMouseMove, false);
        this.domElement.addEventListener('mouseleave', this._boundOnMouseLeave, false);
        
        debugLog('🖱️ InteractionHandler 초기화 완료');
    }
    
    setDataOverlay(dataOverlay) {
        this.dataOverlay = dataOverlay;
    }
    
    setStatusVisualizer(statusVisualizer) {
        this.statusVisualizer = statusVisualizer;
    }
    
    setEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
    }
    
    setEditMode(editState) {
        this.editState = editState;
    }
    
    setEditModal(editModal) {
        this.editModal = editModal;
    }
    
    /**
     * ⭐ MonitoringService 설정 (미연결 설비 안내용)
     */
    setMonitoringService(monitoringService) {
        this.monitoringService = monitoringService;
        debugLog('🔗 MonitoringService connected to InteractionHandler');
    }
    
    /**
     * 마우스가 캔버스를 벗어날 때
     */
    onMouseLeave() {
        this._clearHover();
        this.domElement.style.cursor = 'default';
    }
    
    /**
     * 호버 해제
     * @private
     */
    _clearHover() {
        if (this.currentHoveredEquipment) {
            this.selectionVisualizer.removeHoverStyle(this.currentHoveredEquipment);
            this.currentHoveredEquipment = null;
        }
    }
    
    /**
     * 호버 설정
     * @private
     */
    _setHover(equipment) {
        if (this.currentHoveredEquipment === equipment) return;
        
        if (this.selectionManager.isSelected(equipment)) {
            this._clearHover();
            return;
        }
        
        if (this.currentHoveredEquipment && this.currentHoveredEquipment !== equipment) {
            this.selectionVisualizer.removeHoverStyle(this.currentHoveredEquipment);
        }
        
        this.currentHoveredEquipment = equipment;
        this.selectionVisualizer.applyHoverStyle(equipment);
    }
    
    /**
     * 마우스 이동 핸들러
     */
    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.equipmentArray, true);
        
        if (intersects.length > 0) {
            let targetEquipment = intersects[0].object;
            while (targetEquipment.parent && !this.equipmentArray.includes(targetEquipment)) {
                targetEquipment = targetEquipment.parent;
            }
            
            if (this.equipmentArray.includes(targetEquipment)) {
                this._setHover(targetEquipment);
                this.domElement.style.cursor = 'pointer';
            } else {
                this._clearHover();
                this.domElement.style.cursor = 'default';
            }
        } else {
            this._clearHover();
            this.domElement.style.cursor = 'default';
        }
    }
    
    /**
     * 마우스 클릭 핸들러
     */
    onMouseClick(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.equipmentArray, true);
        
        if (intersects.length > 0) {
            let targetEquipment = intersects[0].object;
            while (targetEquipment.parent && !this.equipmentArray.includes(targetEquipment)) {
                targetEquipment = targetEquipment.parent;
            }
            
            if (!this.equipmentArray.includes(targetEquipment)) return;
            
            const frontendId = targetEquipment.userData?.id;
            
            // Edit Mode
            if (this.editState && this.editState.editModeEnabled) {
                if (this.editModal) {
                    this.editModal.open(targetEquipment);
                }
                return;
            }
            
            // ⭐ Monitoring Mode: 미연결 설비 클릭 시 안내
            if (this.monitoringService?.isActive) {
                const isMapped = this.monitoringService.checkAndNotifyUnmapped(frontendId);
                
                if (!isMapped) {
                    // 미연결 설비는 선택하지 않고 안내만 표시
                    debugLog(`⚠️ Unmapped equipment clicked: ${frontendId}`);
                    return;
                }
            }
            
            if (this.currentHoveredEquipment === targetEquipment) {
                this.currentHoveredEquipment = null;
            }
            
            const isMultiSelectMode = event.ctrlKey || event.metaKey;
            
            if (isMultiSelectMode) {
                this.selectionManager.toggle(targetEquipment);
            } else {
                this.selectionManager.select(targetEquipment, false);
            }
            
            const selectedData = this.selectionManager.getSelectedData();
            
            if (this.dataOverlay && selectedData.length > 0) {
                this.dataOverlay.showEquipmentInfo(selectedData);
            }
            
            if (this.onEquipmentClickCallback) {
                this.onEquipmentClickCallback(selectedData);
            }
            
        } else {
            if (!event.ctrlKey && !event.metaKey) {
                this.selectionManager.clearSelection();
                this._clearHover();
                
                if (this.dataOverlay) {
                    this.dataOverlay.hideEquipmentInfo();
                }
                
                if (this.onEquipmentDeselectCallback) {
                    this.onEquipmentDeselectCallback();
                }
            }
        }
    }
    
    // === 콜백 설정 ===
    setOnEquipmentClick(callback) { this.onEquipmentClickCallback = callback; }
    setOnEquipmentDeselect(callback) { this.onEquipmentDeselectCallback = callback; }
    
    // === 호환성 메서드 ===
    getSelectedEquipments() { return this.selectionManager.getSelected(); }
    getSelectedCount() { return this.selectionManager.getSelectedCount(); }
    isSelected(equipment) { return this.selectionManager.isSelected(equipment); }
    clearAllSelections() { 
        this.selectionManager.clearSelection(); 
        this._clearHover();
    }
    getSelectionManager() { return this.selectionManager; }
    getSelectionVisualizer() { return this.selectionVisualizer; }
    updateEquipmentArray(equipmentArray) { this.equipmentArray = equipmentArray; }
    
    dispose() {
        this.domElement.removeEventListener('click', this._boundOnMouseClick);
        this.domElement.removeEventListener('mousemove', this._boundOnMouseMove);
        this.domElement.removeEventListener('mouseleave', this._boundOnMouseLeave);
        this.selectionManager.dispose();
        this.selectionVisualizer.dispose();
    }
}
