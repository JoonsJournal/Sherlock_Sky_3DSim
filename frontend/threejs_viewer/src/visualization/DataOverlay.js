/**
 * DataOverlay.js
 * UI 오버레이 및 데이터 표시 관리
 */

import { debugLog } from '../utils/Config.js';

export class DataOverlay {
    constructor() {
        this.loadingStatusEl = document.getElementById('loadingStatus');
        this.equipmentInfoEl = document.getElementById('equipmentInfo');
        this.equipNameEl = document.getElementById('equipName');
        this.equipDetailsEl = document.getElementById('equipDetails');
    }
    
    /**
     * 로딩 상태 업데이트
     * @param {string} message - 상태 메시지
     * @param {boolean} isError - 에러 여부
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
     * @param {Object} equipmentData - 설비 데이터
     */
    showEquipmentInfo(equipmentData) {
        if (!this.equipmentInfoEl || !equipmentData) return;
        
        // 제목 설정
        this.equipNameEl.textContent = equipmentData.id || '설비 정보';
        
        // 상태 표시
        let statusClass = '';
        let statusText = '';
        
        if (equipmentData.status === 'running') {
            statusClass = 'status-running';
            statusText = '가동 중';
        } else if (equipmentData.status === 'idle') {
            statusClass = 'status-idle';
            statusText = '대기';
        } else if (equipmentData.status === 'error') {
            statusClass = 'status-error';
            statusText = '오류';
        }
        
        // 상세 정보 HTML 생성
        this.equipDetailsEl.innerHTML = `
            <div class="info-row">
                <span class="info-label">설비 ID:</span>
                <span class="info-value">${equipmentData.id}</span>
            </div>
            <div class="info-row">
                <span class="info-label">위치:</span>
                <span class="info-value">${equipmentData.position.row}, ${equipmentData.position.col}</span>
            </div>
            <div class="info-row">
                <span class="info-label">상태:</span>
                <span class="status-indicator ${statusClass}"></span>
                <span class="info-value">${statusText}</span>
            </div>
            <div class="info-row">
                <span class="info-label">온도:</span>
                <span class="info-value">${equipmentData.temperature}</span>
            </div>
            <div class="info-row">
                <span class="info-label">가동 시간:</span>
                <span class="info-value">${equipmentData.runtime}</span>
            </div>
            <div class="info-row">
                <span class="info-label">효율:</span>
                <span class="info-value">${equipmentData.efficiency}</span>
            </div>
            <div class="info-row">
                <span class="info-label">생산량:</span>
                <span class="info-value">${equipmentData.output}</span>
            </div>
            <div class="info-row">
                <span class="info-label">소비 전력:</span>
                <span class="info-value">${equipmentData.powerConsumption}</span>
            </div>
            <div class="info-row">
                <span class="info-label">마지막 점검:</span>
                <span class="info-value">${equipmentData.lastMaintenance}</span>
            </div>
        `;
        
        // 패널 표시
        this.equipmentInfoEl.classList.add('active');
        
        debugLog('📊 설비 정보 표시:', equipmentData.id);
    }
    
    /**
     * 설비 정보 패널 숨기기
     */
    hideEquipmentInfo() {
        if (this.equipmentInfoEl) {
            this.equipmentInfoEl.classList.remove('active');
        }
    }
    
    /**
     * 전역 함수로 노출 (HTML에서 호출용)
     */
    exposeGlobalFunctions() {
        window.closeEquipmentInfo = () => {
            this.hideEquipmentInfo();
        };
    }
    
    /**
     * 통계 정보 업데이트 (선택적)
     * @param {Object} stats - 통계 데이터
     */
    updateStatistics(stats) {
        // 향후 대시보드용 통계 표시
        debugLog('📈 통계 업데이트:', stats);
    }
}