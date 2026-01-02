/**
 * DataOverlay.js
 * UI 오버레이 및 데이터 표시 관리 (다중 선택 평균값 표시 지원)
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
     * 설비 정보 패널 표시 (단일 또는 다중 선택)
     * @param {Array<Object>|Object} equipmentData - 설비 데이터 (배열 또는 단일 객체)
     */
    showEquipmentInfo(equipmentData) {
        if (!this.equipmentInfoEl) return;
        
        // 배열이 아니면 배열로 변환 (하위 호환성)
        const dataArray = Array.isArray(equipmentData) ? equipmentData : [equipmentData];
        
        if (dataArray.length === 0) return;
        
        if (dataArray.length === 1) {
            // 단일 설비 선택
            this.showSingleEquipmentInfo(dataArray[0]);
        } else {
            // 다중 설비 선택 - 평균값 표시
            this.showMultipleEquipmentInfo(dataArray);
        }
        
        // 패널 표시
        this.equipmentInfoEl.classList.add('active');
    }
    
    /**
     * 단일 설비 정보 표시
     * @param {Object} equipmentData - 설비 데이터
     */
    showSingleEquipmentInfo(equipmentData) {
        // 제목 설정
        this.equipNameEl.textContent = equipmentData.id || '설비 정보';
        
        // 상태 표시
        const { statusClass, statusText } = this.getStatusDisplay(equipmentData.status);
        
        // 상세 정보 HTML 생성
        this.equipDetailsEl.innerHTML = `
            <div class="info-row">
                <span class="info-label">설비 ID:</span>
                <span class="info-value">${equipmentData.id}</span>
            </div>
            <div class="info-row">
                <span class="info-label">위치:</span>
                <span class="info-value">Row ${equipmentData.position.row}, Col ${equipmentData.position.col}</span>
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
        
        debugLog('📊 설비 정보 표시:', equipmentData.id);
    }
    
    /**
     * 다중 설비 정보 표시 (평균값)
     * @param {Array<Object>} equipmentDataArray - 설비 데이터 배열
     */
    showMultipleEquipmentInfo(equipmentDataArray) {
        const count = equipmentDataArray.length;
        
        // 제목 설정
        this.equipNameEl.textContent = `선택된 설비 ${count}대 (평균값)`;
        
        // 평균값 계산
        const avgData = this.calculateAverageData(equipmentDataArray);
        
        // 상태 분포 계산
        const statusCounts = this.calculateStatusCounts(equipmentDataArray);
        const statusDisplay = this.formatStatusDistribution(statusCounts);
        
        // 설비 ID 목록 생성
        const equipmentIds = equipmentDataArray.map(eq => eq.id).join(', ');
        const idDisplay = count <= 5 ? equipmentIds : `${equipmentDataArray.slice(0, 5).map(eq => eq.id).join(', ')} 외 ${count - 5}대`;
        
        // 상세 정보 HTML 생성
        this.equipDetailsEl.innerHTML = `
            <div class="info-row multi-select-header" style="background: #e3f2fd; border-left: 4px solid #2196F3; margin-bottom: 15px;">
                <span style="font-weight: bold; color: #1976D2;">📊 ${count}대 설비 통합 정보</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">선택 설비:</span>
                <span class="info-value" style="font-size: 11px; line-height: 1.4;">${idDisplay}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">상태 분포:</span>
                <span class="info-value">${statusDisplay}</span>
            </div>
            
            <div style="margin: 15px 0; padding-top: 10px; border-top: 1px solid #ddd;">
                <div style="font-weight: bold; color: #555; margin-bottom: 8px;">📈 평균 지표</div>
            </div>
            
            <div class="info-row">
                <span class="info-label">평균 온도:</span>
                <span class="info-value">${avgData.temperature.toFixed(1)}°C</span>
            </div>
            <div class="info-row">
                <span class="info-label">평균 가동 시간:</span>
                <span class="info-value">${avgData.runtime.toFixed(0)}h</span>
            </div>
            <div class="info-row">
                <span class="info-label">평균 효율:</span>
                <span class="info-value">${avgData.efficiency.toFixed(1)}%</span>
            </div>
            <div class="info-row">
                <span class="info-label">평균 생산량:</span>
                <span class="info-value">${avgData.output.toFixed(0)} units/h</span>
            </div>
            <div class="info-row">
                <span class="info-label">평균 소비 전력:</span>
                <span class="info-value">${avgData.powerConsumption.toFixed(1)} kW</span>
            </div>
            
            <div style="margin: 15px 0; padding-top: 10px; border-top: 1px solid #ddd;">
                <div style="font-weight: bold; color: #555; margin-bottom: 8px;">📊 총합 지표</div>
            </div>
            
            <div class="info-row">
                <span class="info-label">총 생산량:</span>
                <span class="info-value">${avgData.totalOutput.toFixed(0)} units/h</span>
            </div>
            <div class="info-row">
                <span class="info-label">총 소비 전력:</span>
                <span class="info-value">${avgData.totalPower.toFixed(1)} kW</span>
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; font-size: 12px; color: #856404;">
                💡 Tip: Ctrl+클릭으로 설비를 추가/제거할 수 있습니다
            </div>
        `;
        
        debugLog('📊 다중 설비 정보 표시:', `${count}대 선택됨`);
    }
    
    /**
     * 평균 데이터 계산
     * @param {Array<Object>} dataArray - 설비 데이터 배열
     * @returns {Object} 평균 데이터
     */
    calculateAverageData(dataArray) {
        const count = dataArray.length;
        
        // 숫자 값 추출 함수
        const extractNumber = (str) => {
            const match = str.match(/[\d.]+/);
            return match ? parseFloat(match[0]) : 0;
        };
        
        // 각 항목의 합계 계산
        const sums = dataArray.reduce((acc, eq) => {
            acc.temperature += extractNumber(eq.temperature);
            acc.runtime += extractNumber(eq.runtime);
            acc.efficiency += extractNumber(eq.efficiency);
            acc.output += extractNumber(eq.output);
            acc.powerConsumption += extractNumber(eq.powerConsumption);
            return acc;
        }, {
            temperature: 0,
            runtime: 0,
            efficiency: 0,
            output: 0,
            powerConsumption: 0
        });
        
        // 평균 계산
        return {
            temperature: sums.temperature / count,
            runtime: sums.runtime / count,
            efficiency: sums.efficiency / count,
            output: sums.output / count,
            powerConsumption: sums.powerConsumption / count,
            totalOutput: sums.output,  // 총합
            totalPower: sums.powerConsumption  // 총합
        };
    }
    
    /**
     * 상태별 개수 계산
     * @param {Array<Object>} dataArray - 설비 데이터 배열
     * @returns {Object} 상태별 개수
     */
    calculateStatusCounts(dataArray) {
        return dataArray.reduce((acc, eq) => {
            acc[eq.status] = (acc[eq.status] || 0) + 1;
            return acc;
        }, {});
    }
    
    /**
     * 상태 분포 포맷팅
     * @param {Object} statusCounts - 상태별 개수
     * @returns {string} 포맷된 문자열
     */
    formatStatusDistribution(statusCounts) {
        const parts = [];
        
        if (statusCounts.running) {
            parts.push(`<span style="color: #2ecc71;">●</span> 가동 ${statusCounts.running}대`);
        }
        if (statusCounts.idle) {
            parts.push(`<span style="color: #f39c12;">●</span> 대기 ${statusCounts.idle}대`);
        }
        if (statusCounts.error) {
            parts.push(`<span style="color: #e74c3c;">●</span> 오류 ${statusCounts.error}대`);
        }
        
        return parts.join(' | ');
    }
    
    /**
     * 상태 표시 정보 가져오기
     * @param {string} status - 상태 값
     * @returns {Object} {statusClass, statusText}
     */
    getStatusDisplay(status) {
        let statusClass = '';
        let statusText = '';
        
        if (status === 'running') {
            statusClass = 'status-running';
            statusText = '가동 중';
        } else if (status === 'idle') {
            statusClass = 'status-idle';
            statusText = '대기';
        } else if (status === 'error') {
            statusClass = 'status-error';
            statusText = '오류';
        }
        
        return { statusClass, statusText };
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