/**
 * PCInfoTab.js
 * ============
 * PC Info 탭 컴포넌트
 * 
 * @version 1.0.0
 * @description
 * - CPU, GPU, OS, Boot 정보 표시
 * - Resource Usage Gauge (CPU, Memory, Disk)
 * - Single/Multi Selection 지원
 * - GaugeRenderer 컴포넌트 활용
 * 
 * @example
 * const pcInfoTab = new PCInfoTab(containerEl);
 * pcInfoTab.render(data);           // Single Selection
 * pcInfoTab.renderMulti(data, 5);   // Multi Selection
 * pcInfoTab.showUnmapped();
 * pcInfoTab.dispose();
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/tabs/PCInfoTab.js
 * 작성일: 2026-01-09
 */

import { debugLog } from '../../../core/utils/Config.js';
import { DataFormatter } from '../utils/DataFormatter.js';
import { GaugeRenderer } from '../components/GaugeRenderer.js';

/**
 * PC Info Tab 컴포넌트
 */
export class PCInfoTab {
    /**
     * @param {HTMLElement} container - 탭 컨텐츠 컨테이너 (pcinfoTabContent)
     */
    constructor(container) {
        /**
         * 탭 컨텐츠 컨테이너
         * @type {HTMLElement}
         */
        this.container = container;
        
        /**
         * 현재 렌더링 모드 ('single' | 'multi' | 'unmapped' | 'error' | 'loading')
         * @type {string}
         */
        this.currentMode = null;
        
        debugLog('💻 PCInfoTab initialized');
    }
    
    // =========================================================================
    // Single Selection 렌더링
    // =========================================================================
    
    /**
     * Single Selection 렌더링
     * @param {Object} data - 설비 상세 데이터
     */
    render(data) {
        if (!this.container) return;
        
        this.currentMode = 'single';
        
        // System Info 렌더링
        const systemInfoHTML = this._renderSystemInfo(data);
        
        // Gauge Section 렌더링 (GaugeRenderer 사용)
        const gaugeSection = GaugeRenderer.renderSection(data);
        
        // Updated 시간
        const updatedHTML = data.pc_last_update_time ? `
            <div class="info-row info-row-meta">
                <span class="info-label">Updated:</span>
                <span class="info-value info-value-meta">${DataFormatter.formatDateTime(data.pc_last_update_time)}</span>
            </div>
        ` : '';
        
        this.container.innerHTML = `
            ${systemInfoHTML}
            ${gaugeSection}
            ${updatedHTML}
        `;
        
        debugLog(`✅ PCInfoTab rendered`);
    }
    
    /**
     * System Info 섹션 렌더링
     * @private
     * @param {Object} data - 설비 데이터
     * @returns {string} HTML 문자열
     */
    _renderSystemInfo(data) {
        const cpuShortName = DataFormatter.shortenCpuName(data.cpu_name);
        const bootDuration = DataFormatter.formatBootDuration(data.last_boot_time);
        const bootDurationClass = DataFormatter.getBootDurationClass(data.last_boot_time);
        
        return `
            <!-- System Info -->
            <div class="pcinfo-system-row">
                <span class="info-label">CPU</span>
                <span class="info-value">${cpuShortName || '-'}<span class="value-separator">,</span>${data.cpu_logical_count || '-'} Cores</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">GPU</span>
                <span class="info-value info-value-small">${data.gpu_name || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">OS</span>
                <span class="info-value">${data.os_name || '-'}<span class="value-separator">,</span>${data.os_architecture || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">Boot</span>
                <span class="info-value">
                    <span class="boot-duration ${bootDurationClass}">
                        <span class="boot-duration-value">${bootDuration}</span>
                    </span>
                </span>
            </div>
        `;
    }
    
    // =========================================================================
    // Multi Selection 렌더링
    // =========================================================================
    
    /**
     * Multi Selection 렌더링 (집계)
     * @param {Object} data - 집계 데이터
     * @param {number} totalCount - 선택된 총 설비 수
     */
    renderMulti(data, totalCount) {
        if (!this.container) return;
        
        this.currentMode = 'multi';
        
        // System Info 요약
        const systemInfoHTML = this._renderSystemInfoMulti(data);
        
        // Gauge Section 렌더링 (GaugeRenderer 사용)
        const gaugeSection = GaugeRenderer.renderSectionMulti(data);
        
        this.container.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">💻</span>
                <span class="info-text">${totalCount}개 설비 PC 정보</span>
            </div>
            
            ${systemInfoHTML}
            ${gaugeSection}
        `;
        
        debugLog(`✅ PCInfoTab Multi rendered: ${totalCount} items`);
    }
    
    /**
     * System Info 요약 렌더링 (Multi Selection)
     * @private
     * @param {Object} data - 집계 데이터
     * @returns {string} HTML 문자열
     */
    _renderSystemInfoMulti(data) {
        const cpuNamesDisplay = DataFormatter.formatListWithMore(data.cpu_names, data.cpu_names_more);
        const gpuNamesDisplay = DataFormatter.formatListWithMore(data.gpu_names, data.gpu_names_more);
        const osNamesDisplay = DataFormatter.formatListWithMore(data.os_names, data.os_names_more);
        
        return `
            <!-- System Info 요약 -->
            <div class="pcinfo-system-row">
                <span class="info-label">CPU</span>
                <span class="info-value info-value-small">${cpuNamesDisplay || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">GPU</span>
                <span class="info-value info-value-small">${gpuNamesDisplay || '-'}</span>
            </div>
            <div class="pcinfo-system-row">
                <span class="info-label">OS</span>
                <span class="info-value">${osNamesDisplay || '-'}</span>
            </div>
        `;
    }
    
    // =========================================================================
    // 상태 표시
    // =========================================================================
    
    /**
     * 매핑되지 않은 설비 상태 표시 (Single)
     */
    showUnmapped() {
        if (!this.container) return;
        
        this.currentMode = 'unmapped';
        
        this.container.innerHTML = `
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">DB에 연결되지 않은 설비입니다</span>
            </div>
            ${this._renderEmptyFields()}
        `;
        
        debugLog(`⚠️ PCInfoTab showUnmapped`);
    }
    
    /**
     * Multi Selection 매핑 없음 상태 표시
     * @param {number} count - 선택된 설비 수
     */
    showMultiUnmapped(count) {
        if (!this.container) return;
        
        this.currentMode = 'unmapped';
        
        this.container.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">💻</span>
                <span class="info-text">${count}개 설비 PC 정보</span>
            </div>
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">DB에 연결되지 않은 설비입니다</span>
            </div>
            ${this._renderEmptyFieldsMulti()}
        `;
        
        debugLog(`⚠️ PCInfoTab showMultiUnmapped: ${count} items`);
    }
    
    /**
     * 에러 상태 표시 (Single)
     */
    showError() {
        if (!this.container) return;
        
        this.currentMode = 'error';
        
        this.container.innerHTML = `
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">PC 정보를 불러올 수 없습니다</span>
            </div>
            ${this._renderEmptyFields()}
        `;
        
        debugLog(`❌ PCInfoTab showError`);
    }
    
    /**
     * Multi Selection 에러 상태 표시
     * @param {number} count - 선택된 설비 수
     */
    showMultiError(count) {
        if (!this.container) return;
        
        this.currentMode = 'error';
        
        this.container.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">💻</span>
                <span class="info-text">${count}개 설비 PC 정보</span>
            </div>
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">PC 정보를 불러올 수 없습니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Memory:</span>
                <span class="info-value">-</span>
            </div>
        `;
        
        debugLog(`❌ PCInfoTab showMultiError: ${count} items`);
    }
    
    /**
     * 로딩 상태 표시
     */
    showLoading() {
        if (!this.container) return;
        
        this.currentMode = 'loading';
        
        this.container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner-small"></div>
                <span class="loading-text">Loading...</span>
            </div>
        `;
    }
    
    // =========================================================================
    // 내부 헬퍼
    // =========================================================================
    
    /**
     * 빈 필드 렌더링 (Single)
     * @private
     * @returns {string} HTML 문자열
     */
    _renderEmptyFields() {
        return `
            <div class="info-row">
                <span class="info-label">CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Memory:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Disk C:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Disk D:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">GPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">OS:</span>
                <span class="info-value">-</span>
            </div>
        `;
    }
    
    /**
     * 빈 필드 렌더링 (Multi)
     * @private
     * @returns {string} HTML 문자열
     */
    _renderEmptyFieldsMulti() {
        return `
            <div class="info-row">
                <span class="info-label">Avg CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Memory:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Disk C:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Disk D:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">CPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">GPU:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">OS:</span>
                <span class="info-value">-</span>
            </div>
        `;
    }
    
    // =========================================================================
    // 유틸리티
    // =========================================================================
    
    /**
     * 현재 렌더링 모드 반환
     * @returns {string|null}
     */
    getMode() {
        return this.currentMode;
    }
    
    /**
     * 컨테이너 재연결 (DOM 재생성 후)
     * @param {HTMLElement} container - 새 컨테이너
     */
    reconnect(container) {
        this.container = container;
        debugLog('💻 PCInfoTab reconnected');
    }
    
    // =========================================================================
    // 정리
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.container = null;
        this.currentMode = null;
        
        debugLog('💻 PCInfoTab disposed');
    }
}

// 기본 내보내기
export default PCInfoTab;