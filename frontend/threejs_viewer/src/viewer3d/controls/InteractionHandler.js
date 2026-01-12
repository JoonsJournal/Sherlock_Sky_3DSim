/**
 * InteractionHandler.js
 * 마우스 및 키보드 상호작용 처리
 * 
 * @version 3.2.0
 * @description 호버/선택 기능, AppModeManager 기반 모드별 동작 분기
 * 
 * 🆕 v3.2.0:
 * - 🔧 _handleMonitoringClick() 수정: 미매핑 설비도 패널 표시
 * - early return 제거 → 알림 표시 후 선택 + 패널 표시 계속 진행
 * - 미매핑 설비 클릭 시에도 기본 정보 패널 표시 (UX 개선)
 * 
 * 🆕 v3.1.0:
 * - 🔧 마우스 좌표 계산 수정 (Sidebar offset 고려)
 * - _getMousePosition() 헬퍼 메서드 추가
 * - getBoundingClientRect() 사용으로 정확한 캔버스 기준 좌표 계산
 * 
 * 🆕 v3.0.0: 
 * - AppModeManager 참조로 모드 판단 (중앙 집중식)
 * - 모드별 클릭 동작 분리 (main_viewer, equipment_edit, monitoring)
 * - 기존 editState.editModeEnabled 직접 참조 제거
 * 
 * 📁 위치: frontend/threejs_viewer/src/viewer3d/controls/InteractionHandler.js
 */

import * as THREE from 'three';
import { debugLog } from '../../core/utils/Config.js';
import { SelectionManager, SelectionVisualizer } from '../selection/index.js';
import { APP_MODE } from '../../core/config/constants.js';

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
        this.editModal = null;
        
        // 🆕 v3.0.0: AppModeManager 참조 (중앙 집중식 모드 관리)
        this.appModeManager = null;
        
        // ⭐ Monitoring 서비스 참조 (미연결 설비 안내용)
        this.monitoringService = null;
        
        // 🆕 v3.0.0: 레거시 호환용 (기존 코드와의 호환성)
        this.editState = null;
        
        this.init();
    }
    
    init() {
        this._boundOnMouseClick = (e) => this.onMouseClick(e);
        this._boundOnMouseMove = (e) => this.onMouseMove(e);
        this._boundOnMouseLeave = () => this.onMouseLeave();
        
        this.domElement.addEventListener('click', this._boundOnMouseClick, false);
        this.domElement.addEventListener('mousemove', this._boundOnMouseMove, false);
        this.domElement.addEventListener('mouseleave', this._boundOnMouseLeave, false);
        
        debugLog('🖱️ InteractionHandler 초기화 완료 (v3.2.0)');
    }
    
    // =========================================================================
    // 🆕 v3.1.0: 마우스 좌표 계산 (캔버스 기준)
    // =========================================================================
    
    /**
     * 🔧 v3.1.0: 캔버스 기준 정규화된 마우스 좌표 계산
     * Sidebar offset을 고려하여 정확한 좌표 반환
     * 
     * @param {MouseEvent} event - 마우스 이벤트
     * @private
     */
    _getMousePosition(event) {
        const rect = this.domElement.getBoundingClientRect();
        
        // 캔버스 기준 상대 좌표 계산 (-1 ~ 1 정규화)
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    // =========================================================================
    // 🆕 v3.0.0: AppModeManager 설정
    // =========================================================================
    
    /**
     * 🆕 v3.0.0: AppModeManager 설정 (중앙 집중식 모드 관리)
     * @param {Object} appModeManager - AppModeManager 인스턴스
     */
    setAppModeManager(appModeManager) {
        this.appModeManager = appModeManager;
        debugLog('🔗 AppModeManager connected to InteractionHandler');
    }
    
    /**
     * 🆕 v3.0.0: 현재 모드 조회 (헬퍼)
     * @returns {string} 현재 모드
     */
    _getCurrentMode() {
        if (this.appModeManager) {
            return this.appModeManager.getCurrentMode();
        }
        
        // 레거시 폴백: editState 사용
        if (this.editState && this.editState.editModeEnabled) {
            return APP_MODE.EQUIPMENT_EDIT;
        }
        if (this.monitoringService && this.monitoringService.isActive) {
            return APP_MODE.MONITORING;
        }
        
        return APP_MODE.MAIN_VIEWER;
    }
    
    // =========================================================================
    // 기존 설정 메서드 (호환성 유지)
    // =========================================================================
    
    setDataOverlay(dataOverlay) {
        this.dataOverlay = dataOverlay;
    }
    
    setStatusVisualizer(statusVisualizer) {
        this.statusVisualizer = statusVisualizer;
    }
    
    setEquipmentArray(equipmentArray) {
        this.equipmentArray = equipmentArray;
    }
    
    /**
     * 🆕 v3.0.0: 레거시 호환용 - EditState 설정
     * @deprecated AppModeManager 사용 권장
     */
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
    
    // =========================================================================
    // 마우스 이벤트 핸들러
    // =========================================================================
    
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
     * 🔧 v3.1.0: _getMousePosition() 사용
     */
    onMouseMove(event) {
        // 🔧 v3.1.0: 캔버스 기준 좌표 계산
        this._getMousePosition(event);
        
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
     * 🆕 v3.0.0: 마우스 클릭 핸들러 (모드별 동작 분기)
     * 🔧 v3.1.0: _getMousePosition() 사용
     */
    onMouseClick(event) {
        // 🔧 v3.1.0: 캔버스 기준 좌표 계산
        this._getMousePosition(event);
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.equipmentArray, true);
        
        if (intersects.length > 0) {
            let targetEquipment = intersects[0].object;
            while (targetEquipment.parent && !this.equipmentArray.includes(targetEquipment)) {
                targetEquipment = targetEquipment.parent;
            }
            
            if (!this.equipmentArray.includes(targetEquipment)) return;
            
            const frontendId = targetEquipment.userData?.id;
            
            // 🆕 v3.0.0: AppModeManager 기반 모드별 동작 분기
            const currentMode = this._getCurrentMode();
            
            switch (currentMode) {
                case APP_MODE.EQUIPMENT_EDIT:
                    // Equipment Edit 모드: Edit Modal 열기
                    this._handleEquipmentEditClick(targetEquipment, frontendId);
                    return;
                    
                case APP_MODE.MONITORING:
                    // Monitoring 모드: DataOverlay 패널 표시 또는 미연결 안내
                    this._handleMonitoringClick(targetEquipment, frontendId, event);
                    return;
                    
                case APP_MODE.MAIN_VIEWER:
                default:
                    // Main Viewer 모드: 선택만 (기존 동작)
                    this._handleMainViewerClick(targetEquipment, frontendId, event);
                    return;
            }
            
        } else {
            // 빈 공간 클릭: 선택 해제
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
    
    // =========================================================================
    // 🆕 v3.0.0: 모드별 클릭 핸들러
    // =========================================================================
    
    /**
     * 🆕 v3.0.0: Equipment Edit 모드 클릭 처리
     * @private
     */
    _handleEquipmentEditClick(targetEquipment, frontendId) {
        debugLog(`✏️ Edit Mode Click: ${frontendId}`);
        
        if (this.editModal) {
            this.editModal.open(targetEquipment);
        }
    }
    
    /**
     * 🆕 v3.0.0: Monitoring 모드 클릭 처리
     * 🔧 v3.2.0: 미매핑 설비도 패널 표시하도록 수정
     * 
     * @private
     */
    _handleMonitoringClick(targetEquipment, frontendId, event) {
        debugLog(`📊 Monitoring Mode Click: ${frontendId}`);
        
        // 🔧 v3.2.0: 미매핑 여부 확인 (알림 표시용)
        let isMapped = true;
        
        if (this.monitoringService?.isActive) {
            // 미연결 설비 확인 및 안내 (알림만 표시, early return 제거!)
            isMapped = this.monitoringService.checkAndNotifyUnmapped(frontendId);
            
            if (!isMapped) {
                // 🔧 v3.2.0: 미연결 설비도 선택 및 패널 표시 (early return 제거!)
                debugLog(`⚠️ Unmapped equipment clicked: ${frontendId} - showing basic info`);
                // return; ← 🔴 기존 코드: 여기서 return 하면 패널이 안 열림!
            }
        }
        
        // 호버 상태 정리
        if (this.currentHoveredEquipment === targetEquipment) {
            this.currentHoveredEquipment = null;
        }
        
        // 선택 처리 (매핑 여부와 관계없이 항상 실행)
        const isMultiSelectMode = event.ctrlKey || event.metaKey;
        
        if (isMultiSelectMode) {
            this.selectionManager.toggle(targetEquipment);
        } else {
            this.selectionManager.select(targetEquipment, false);
        }
        
        // 🔧 v3.2.0: DataOverlay에 설비 정보 표시 (매핑 여부와 관계없이 항상 실행)
        const selectedData = this.selectionManager.getSelectedData();
        
        if (this.dataOverlay && selectedData.length > 0) {
            // 🆕 v3.2.0: 미매핑 정보 추가 (패널에서 표시용)
            const enrichedData = selectedData.map(data => ({
                ...data,
                _isMapped: isMapped,  // 매핑 여부 플래그 추가
                _frontendId: frontendId
            }));
            
            this.dataOverlay.showEquipmentInfo(enrichedData);
        }
        
        // 콜백 호출
        if (this.onEquipmentClickCallback) {
            this.onEquipmentClickCallback(selectedData);
        }
    }
    
    /**
     * 🆕 v3.0.0: Main Viewer 모드 클릭 처리 (선택만)
     * @private
     */
    _handleMainViewerClick(targetEquipment, frontendId, event) {
        debugLog(`👁️ Main Viewer Mode Click: ${frontendId}`);
        
        // 호버 상태 정리
        if (this.currentHoveredEquipment === targetEquipment) {
            this.currentHoveredEquipment = null;
        }
        
        // 선택 처리 (기존 동작 유지)
        const isMultiSelectMode = event.ctrlKey || event.metaKey;
        
        if (isMultiSelectMode) {
            this.selectionManager.toggle(targetEquipment);
        } else {
            this.selectionManager.select(targetEquipment, false);
        }
        
        // 선택 정보 표시 (DataOverlay 표시하지 않음 - 선택 효과만)
        const selectedData = this.selectionManager.getSelectedData();
        
        // 콜백 호출
        if (this.onEquipmentClickCallback) {
            this.onEquipmentClickCallback(selectedData);
        }
    }
    
    // =========================================================================
    // 콜백 설정
    // =========================================================================
    
    setOnEquipmentClick(callback) { 
        this.onEquipmentClickCallback = callback; 
    }
    
    setOnEquipmentDeselect(callback) { 
        this.onEquipmentDeselectCallback = callback; 
    }
    
    // =========================================================================
    // 호환성 메서드
    // =========================================================================
    
    getSelectedEquipments() { 
        return this.selectionManager.getSelected(); 
    }
    
    getSelectedCount() { 
        return this.selectionManager.getSelectedCount(); 
    }
    
    isSelected(equipment) { 
        return this.selectionManager.isSelected(equipment); 
    }
    
    clearAllSelections() { 
        this.selectionManager.clearSelection(); 
        this._clearHover();
    }
    
    getSelectionManager() { 
        return this.selectionManager; 
    }
    
    getSelectionVisualizer() { 
        return this.selectionVisualizer; 
    }
    
    updateEquipmentArray(equipmentArray) { 
        this.equipmentArray = equipmentArray; 
    }
    
    // =========================================================================
    // 정리
    // =========================================================================
    
    dispose() {
        this.domElement.removeEventListener('click', this._boundOnMouseClick);
        this.domElement.removeEventListener('mousemove', this._boundOnMouseMove);
        this.domElement.removeEventListener('mouseleave', this._boundOnMouseLeave);
        this.selectionManager.dispose();
        this.selectionVisualizer.dispose();
    }
}