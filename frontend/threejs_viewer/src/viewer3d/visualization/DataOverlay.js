/**
 * DataOverlay.js
 * UI 오버레이 및 데이터 표시 관리
 * 
 * @version 2.0.0
 * @description EquipmentInfoPanel 연동 추가
 * 
 * 📁 위치: frontend/threejs_viewer/src/viewer3d/visualization/DataOverlay.js
 * 수정일: 2026-01-06
 */

import { debugLog } from '../../core/utils/Config.js';

export class DataOverlay {
    constructor() {
        this.loadingStatusEl = document.getElementById('loadingStatus');
        
        // 🆕 v2.0.0: EquipmentInfoPanel 참조 (외부에서 주입)
        this.equipmentInfoPanel = null;
        
        // 레거시 호환용 (기존 방식)
        this.equipmentInfoEl = document.getElementById('equipmentInfo');
        this.equipNameEl = document.getElementById('equipName');
        this.equipDetailsEl = document.getElementById('equipDetails');
    }
    
    /**
     * 🆕 v2.0.0: EquipmentInfoPanel 연결
     * @param {Object} equipmentInfoPanel - EquipmentInfoPanel 인스턴스
     */
    setEquipmentInfoPanel(equipmentInfoPanel) {
        this.equipmentInfoPanel = equipmentInfoPanel;
        debugLog('🔗 EquipmentInfoPanel connected to DataOverlay');
    }
    
    /**
     * 로딩 상태 업데이트
     */
    updateLoadingStatus(message, isError = false) {
        if (this.loadingStatusEl) {
            this.loadingStatusEl.textContent = message;
            this.loadingStatusEl.style.color = isError ? '#e74c3c' : '#2ecc71';
        }
        debugLog(isError ? '❌' : '✅', message);
    }
    
    /**
     * 설비 정보 패널 표시
     * @param {Array<Object>|Object} equipmentData
     */
    showEquipmentInfo(equipmentData) {
        // 🆕 v2.0.0: 새 패널 사용
        if (this.equipmentInfoPanel) {
            this.equipmentInfoPanel.show(equipmentData);
            return;
        }
        
        // 레거시 폴백 (기존 방식)
        this._showEquipmentInfoLegacy(equipmentData);
    }
    
    /**
     * 설비 정보 패널 숨기기
     */
    hideEquipmentInfo() {
        // 🆕 v2.0.0: 새 패널 사용
        if (this.equipmentInfoPanel) {
            this.equipmentInfoPanel.hide();
            return;
        }
        
        // 레거시 폴백
        if (this.equipmentInfoEl) {
            this.equipmentInfoEl.classList.remove('active');
        }
    }
    
    /**
     * 🆕 v2.0.0: 실시간 업데이트 전달
     * @param {Object} updateData
     */
    updateEquipmentInfoRealtime(updateData) {
        if (this.equipmentInfoPanel) {
            this.equipmentInfoPanel.updateRealtime(updateData);
        }
    }
    
    /**
     * 레거시 설비 정보 표시 (기존 방식)
     * @private
     */
    _showEquipmentInfoLegacy(equipmentData) {
        if (!this.equipmentInfoEl) return;
        
        const dataArray = Array.isArray(equipmentData) ? equipmentData : [equipmentData];
        
        if (dataArray.length === 0) return;
        
        if (dataArray.length === 1) {
            this._showSingleEquipmentInfoLegacy(dataArray[0]);
        } else {
            this._showMultipleEquipmentInfoLegacy(dataArray);
        }
        
        this.equipmentInfoEl.classList.add('active');
    }
    
    /**
     * 레거시 단일 설비 정보 표시
     * @private
     */
    _showSingleEquipmentInfoLegacy(equipmentData) {
        if (!this.equipNameEl || !this.equipDetailsEl) return;
        
        this.equipNameEl.textContent = equipmentData.id || '설비 정보';
        
        const { statusClass, statusText } = this._getStatusDisplay(equipmentData.status);
        
        this.equipDetailsEl.innerHTML = `
            <div class="info-row">
                <span class="info-label">설비 ID:</span>
                <span class="info-value">${equipmentData.id}</span>
            </div>
            <div class="info-row">
                <span class="info-label">위치:</span>
                <span class="info-value">Row ${equipmentData.position?.row}, Col ${equipmentData.position?.col}</span>
            </div>
            <div class="info-row">
                <span class="info-label">상태:</span>
                <span class="status-indicator ${statusClass}"></span>
                <span class="info-value">${statusText}</span>
            </div>
        `;
        
        debugLog('📊 설비 정보 표시 (레거시):', equipmentData.id);
    }
    
    /**
     * 레거시 다중 설비 정보 표시
     * @private
     */
    _showMultipleEquipmentInfoLegacy(dataArray) {
        if (!this.equipNameEl || !this.equipDetailsEl) return;
        
        const count = dataArray.length;
        this.equipNameEl.textContent = `${count}개 설비 선택됨`;
        
        this.equipDetailsEl.innerHTML = `
            <div class="info-row multi-select-header">
                <span>📊 ${count}대 설비 선택됨</span>
            </div>
            <div class="info-row">
                <span class="info-label">Ctrl+클릭으로 설비 추가/제거</span>
            </div>
        `;
        
        debugLog('📊 다중 설비 정보 표시 (레거시):', `${count}대`);
    }
    
    /**
     * 상태 표시 정보
     * @private
     */
    _getStatusDisplay(status) {
        const statusMap = {
            'running': { statusClass: 'status-running', statusText: '가동 중' },
            'idle': { statusClass: 'status-idle', statusText: '대기' },
            'error': { statusClass: 'status-error', statusText: '오류' }
        };
        
        return statusMap[status] || { statusClass: '', statusText: status || '-' };
    }
    
    /**
     * 전역 함수 노출
     */
    exposeGlobalFunctions() {
        window.closeEquipmentInfo = () => this.hideEquipmentInfo();
    }
    
    /**
     * 통계 정보 업데이트
     */
    updateStatistics(stats) {
        debugLog('📈 통계 업데이트:', stats);
    }
}