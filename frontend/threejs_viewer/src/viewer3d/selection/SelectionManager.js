/**
 * SelectionManager.js
 * 3D Viewer 객체 선택 관리
 * 
 * @version 1.0.0
 * @description InteractionHandler에서 분리된 Selection 로직
 * 
 * 기능:
 * - 단일/다중 선택 관리
 * - 선택 상태 추적
 * - 이벤트 발행 (EventBus 연동 준비)
 */

import { debugLog } from '../../utils/Config.js';

export class SelectionManager {
    constructor() {
        // 현재 선택된 객체들 (배열)
        this.selectedObjects = [];
        
        // 마지막으로 선택된 객체 (단일)
        this.lastSelected = null;
        
        // 콜백 함수들
        this.onSelectionChangeCallbacks = [];
        
        // SelectionVisualizer 참조 (나중에 설정)
        this.visualizer = null;
        
        debugLog('✅ SelectionManager 초기화 완료');
    }
    
    /**
     * SelectionVisualizer 설정
     * @param {SelectionVisualizer} visualizer 
     */
    setVisualizer(visualizer) {
        this.visualizer = visualizer;
        debugLog('🎨 SelectionVisualizer 연결됨');
    }
    
    /**
     * 객체 선택
     * @param {THREE.Object3D} object - 선택할 객체
     * @param {boolean} addToSelection - true면 기존 선택에 추가, false면 단일 선택
     * @returns {boolean} 선택 성공 여부
     */
    select(object, addToSelection = false) {
        if (!object) {
            debugLog('⚠️ select: 객체가 없습니다');
            return false;
        }
        
        // 이미 선택된 경우
        if (this.isSelected(object)) {
            debugLog('ℹ️ 이미 선택된 객체:', object.userData?.id);
            return false;
        }
        
        // 단일 선택 모드: 기존 선택 모두 해제
        if (!addToSelection) {
            this.clearSelection();
        }
        
        // 선택 목록에 추가
        this.selectedObjects.push(object);
        this.lastSelected = object;
        
        // 시각 효과 적용
        if (this.visualizer) {
            this.visualizer.applySelectionStyle(object);
        }
        
        // 콜백 호출
        this._notifySelectionChange();
        
        debugLog('✅ 객체 선택됨:', object.userData?.id, 
                 `(총 ${this.selectedObjects.length}개)`);
        
        return true;
    }
    
    /**
     * 객체 선택 해제
     * @param {THREE.Object3D} object - 선택 해제할 객체
     * @returns {boolean} 해제 성공 여부
     */
    deselect(object) {
        if (!object) {
            return false;
        }
        
        const index = this.selectedObjects.indexOf(object);
        if (index === -1) {
            debugLog('ℹ️ 선택되지 않은 객체:', object.userData?.id);
            return false;
        }
        
        // 선택 목록에서 제거
        this.selectedObjects.splice(index, 1);
        
        // lastSelected 업데이트
        if (this.lastSelected === object) {
            this.lastSelected = this.selectedObjects.length > 0 
                ? this.selectedObjects[this.selectedObjects.length - 1] 
                : null;
        }
        
        // 시각 효과 제거
        if (this.visualizer) {
            this.visualizer.removeSelectionStyle(object);
        }
        
        // 콜백 호출
        this._notifySelectionChange();
        
        debugLog('✖️ 객체 선택 해제:', object.userData?.id,
                 `(남은 선택: ${this.selectedObjects.length}개)`);
        
        return true;
    }
    
    /**
     * 선택 토글 (선택 ↔ 해제)
     * @param {THREE.Object3D} object 
     * @returns {boolean} 토글 후 선택 상태
     */
    toggle(object) {
        if (this.isSelected(object)) {
            this.deselect(object);
            return false;
        } else {
            this.select(object, true); // 다중 선택 모드
            return true;
        }
    }
    
    /**
     * 모든 선택 해제
     */
    clearSelection() {
        if (this.selectedObjects.length === 0) {
            return;
        }
        
        // 모든 객체의 시각 효과 제거
        if (this.visualizer) {
            this.selectedObjects.forEach(object => {
                this.visualizer.removeSelectionStyle(object);
            });
        }
        
        const count = this.selectedObjects.length;
        this.selectedObjects = [];
        this.lastSelected = null;
        
        // 콜백 호출
        this._notifySelectionChange();
        
        debugLog('🗑️ 모든 선택 해제됨 (이전:', count, '개)');
    }
    
    /**
     * 객체가 선택되었는지 확인
     * @param {THREE.Object3D} object 
     * @returns {boolean}
     */
    isSelected(object) {
        return this.selectedObjects.includes(object);
    }
    
    /**
     * 현재 선택된 객체들 반환
     * @returns {THREE.Object3D[]}
     */
    getSelected() {
        return [...this.selectedObjects]; // 복사본 반환
    }
    
    /**
     * 현재 선택된 객체들의 userData 반환
     * @returns {Object[]}
     */
    getSelectedData() {
        return this.selectedObjects.map(obj => obj.userData);
    }
    
    /**
     * 선택된 객체 개수 반환
     * @returns {number}
     */
    getSelectedCount() {
        return this.selectedObjects.length;
    }
    
    /**
     * 마지막으로 선택된 객체 반환
     * @returns {THREE.Object3D|null}
     */
    getLastSelected() {
        return this.lastSelected;
    }
    
    /**
     * 선택이 있는지 확인
     * @returns {boolean}
     */
    hasSelection() {
        return this.selectedObjects.length > 0;
    }
    
    /**
     * 선택 변경 콜백 등록
     * @param {Function} callback - (selectedObjects, lastSelected) => void
     */
    onSelectionChange(callback) {
        if (typeof callback === 'function') {
            this.onSelectionChangeCallbacks.push(callback);
        }
    }
    
    /**
     * 선택 변경 콜백 제거
     * @param {Function} callback 
     */
    offSelectionChange(callback) {
        const index = this.onSelectionChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this.onSelectionChangeCallbacks.splice(index, 1);
        }
    }
    
    /**
     * 내부: 선택 변경 알림
     * @private
     */
    _notifySelectionChange() {
        this.onSelectionChangeCallbacks.forEach(callback => {
            try {
                callback(this.selectedObjects, this.lastSelected);
            } catch (error) {
                console.error('SelectionManager callback error:', error);
            }
        });
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.clearSelection();
        this.onSelectionChangeCallbacks = [];
        this.visualizer = null;
        debugLog('🗑️ SelectionManager 정리 완료');
    }
}