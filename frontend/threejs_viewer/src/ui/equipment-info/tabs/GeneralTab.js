/**
 * GeneralTab.js
 * =============
 * General 탭 컴포넌트
 * 
 * @version 2.1.0
 * @changelog
 * - v2.1.0: Production Count, Tact Time 표시 추가
 *           - _renderLotActive(): production_count, tact_time_seconds 필드 추가
 *           - _renderLotInactive(): tact_time_seconds 필드 추가 (Lot 상태와 무관)
 *           - renderMulti(): production_total, tact_time_avg 집계 표시 추가
 *           - 기존 기능 100% 호환 유지
 * - v1.0.0: 초기 버전
 * 
 * @description
 * - Line, Product, Lot, Duration 정보 표시
 * - 🆕 Production Count 표시 (Lot Active 시)
 * - 🆕 Tact Time 표시 (항상, Lot 상태 무관)
 * - Lot Active/Inactive 분기 처리
 * - Duration Timer 관리
 * - Single/Multi Selection 지원
 * 
 * @example
 * const generalTab = new GeneralTab(containerEl);
 * generalTab.render(data);           // Single Selection
 * generalTab.renderMulti(data, 5);   // Multi Selection
 * generalTab.showUnmapped(frontendId, equipmentData);
 * generalTab.dispose();
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/tabs/GeneralTab.js
 * 작성일: 2026-01-09
 * 수정일: 2026-01-16
 */

import { debugLog } from '../../../core/utils/Config.js';
import { DurationTimer } from '../utils/DurationTimer.js';
import { DataFormatter } from '../utils/DataFormatter.js';
import { HeaderStatus } from '../components/HeaderStatus.js';

/**
 * General Tab 컴포넌트
 */
export class GeneralTab {
    /**
     * @param {HTMLElement} container - 탭 컨텐츠 컨테이너 (generalTabContent)
     */
    constructor(container) {
        /**
         * 탭 컨텐츠 컨테이너
         * @type {HTMLElement}
         */
        this.container = container;
        
        /**
         * Duration Timer 인스턴스
         * @type {DurationTimer}
         */
        this.durationTimer = new DurationTimer();
        
        /**
         * 현재 렌더링 모드 ('single' | 'multi' | 'unmapped' | 'error' | 'loading')
         * @type {string}
         */
        this.currentMode = null;
        
        debugLog('📑 GeneralTab initialized (v2.1.0)');
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
        
        const isLotActive = data.is_lot_active === true;
        
        let lotInfoHTML = '';
        
        if (isLotActive) {
            lotInfoHTML = this._renderLotActive(data);
        } else {
            lotInfoHTML = this._renderLotInactive(data);
        }
        
        this.container.innerHTML = `
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">${data.line_name || '-'}</span>
            </div>
            
            <div class="info-row-divider"></div>
            
            ${lotInfoHTML}
            
            ${data.last_updated ? `
            <div class="info-row info-row-meta">
                <span class="info-label">Updated:</span>
                <span class="info-value info-value-meta">${DataFormatter.formatDateTime(data.last_updated)}</span>
            </div>
            ` : ''}
        `;
        
        debugLog(`✅ GeneralTab rendered: is_lot_active=${isLotActive}, production_count=${data.production_count}, tact_time=${data.tact_time_seconds}`);
    }
    
    /**
     * Lot Active 상태 렌더링
     * @private
     * @param {Object} data - 설비 데이터
     * @returns {string} HTML 문자열
     */
    _renderLotActive(data) {
        const durationDisplay = DurationTimer.format(data.lot_start_time);
        this._startDurationTimer(data.lot_start_time);
        
        return `
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">${data.product_model || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">${data.lot_id || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot Start:</span>
                <span class="info-value">${DataFormatter.formatDateTime(data.lot_start_time) || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot Duration:</span>
                <span class="info-value" id="durationDisplay">${durationDisplay}</span>
            </div>
            
            <!-- 🆕 v2.1.0: Production & Tact Time Section -->
            <div class="info-row-divider"></div>
            <div class="info-row">
                <span class="info-label">Production:</span>
                <span class="info-value">${DataFormatter.formatProductionCount(data.production_count)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tact Time:</span>
                <span class="info-value">${DataFormatter.formatTactTime(data.tact_time_seconds)}</span>
            </div>
        `;
    }
    
    /**
     * Lot Inactive 상태 렌더링
     * @private
     * @param {Object} data - 설비 데이터
     * @returns {string} HTML 문자열
     */
    _renderLotInactive(data) {
        const hasSinceTime = data.since_time != null;
        const durationDisplay = hasSinceTime ? DurationTimer.format(data.since_time) : '-';
        
        if (hasSinceTime) {
            this._startDurationTimer(data.since_time);
        } else {
            this.durationTimer.stop();
        }
        
        return `
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Since:</span>
                <span class="info-value">${hasSinceTime ? DataFormatter.formatDateTime(data.since_time) : '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Duration:</span>
                <span class="info-value" id="durationDisplay">${durationDisplay}</span>
            </div>
            
            <!-- 🆕 v2.1.0: Tact Time (Lot 비활성 시에도 표시, Production은 - 표시) -->
            <div class="info-row-divider"></div>
            <div class="info-row">
                <span class="info-label">Production:</span>
                <span class="info-value info-value-inactive">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tact Time:</span>
                <span class="info-value">${DataFormatter.formatTactTime(data.tact_time_seconds)}</span>
            </div>
        `;
    }
    
    /**
     * Duration Timer 시작
     * @private
     * @param {string} baseTime - 기준 시간
     */
    _startDurationTimer(baseTime) {
        this.durationTimer.start(baseTime, (formatted) => {
            const durationEl = document.getElementById('durationDisplay');
            if (durationEl) {
                durationEl.textContent = formatted;
            }
        });
    }
    
    // =========================================================================
    // Multi Selection 렌더링
    // =========================================================================
    
    /**
     * Multi Selection 렌더링 (집계)
     * @param {Object} data - 집계 데이터
     * @param {number} totalCount - 선택된 총 설비 수
     * @param {number} [mappedCount] - 매핑된 설비 수 (조회된 수)
     */
    renderMulti(data, totalCount, mappedCount = null) {
        if (!this.container) return;
        
        this.currentMode = 'multi';
        
        // Duration Timer 정지 (Multi Selection에서는 사용 안함)
        this.durationTimer.stop();
        
        const linesDisplay = DataFormatter.formatListWithMore(data.lines, data.lines_more);
        const statusDisplay = this._formatStatusCounts(data.status_counts);
        const productsDisplay = DataFormatter.formatListWithMore(data.products, data.products_more);
        const lotIdsDisplay = DataFormatter.formatListWithMore(data.lot_ids, data.lot_ids_more);
        
        const displayCount = mappedCount ?? data.count ?? totalCount;
        
        this.container.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">📊</span>
                <span class="info-text">${totalCount}개 설비 집계 정보</span>
                <span class="info-badge">${displayCount}개 조회됨</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">${linesDisplay || '-'}</span>
            </div>
            
            <div class="info-row status-row">
                <span class="info-label">Status:</span>
                <div class="status-counts">
                    ${statusDisplay}
                </div>
            </div>
            
            <!-- 🆕 v2.1.0: Production & Tact Time 집계 -->
            <div class="info-row-divider"></div>
            <div class="info-row">
                <span class="info-label">Production:</span>
                <span class="info-value">${DataFormatter.formatProductionCount(data.production_total, '합계')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tact Time:</span>
                <span class="info-value">${DataFormatter.formatTactTime(data.tact_time_avg, '평균')}</span>
            </div>
            
            <div class="info-row-divider"></div>
            
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">${productsDisplay || '-'}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">${lotIdsDisplay || '-'}</span>
            </div>
            
            <div class="info-row-spacer"></div>
        `;
        
        debugLog(`✅ GeneralTab Multi rendered: ${totalCount} items, production_total=${data.production_total}, tact_time_avg=${data.tact_time_avg}`);
    }
    
    /**
     * Status 집계를 아이콘+숫자 형식으로 포맷
     * @private
     * @param {Object} statusCounts - 상태별 카운트 { RUN: 5, IDLE: 3, ... }
     * @returns {string} HTML 문자열
     */
    _formatStatusCounts(statusCounts) {
        if (!statusCounts || Object.keys(statusCounts).length === 0) {
            return '<span class="status-count-item">-</span>';
        }
        
        const sortOrder = ['RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED'];
        
        return sortOrder
            .filter(status => statusCounts[status] > 0)
            .map(status => {
                const config = HeaderStatus.getConfig(status);
                return `
                    <span class="status-count-item ${config.class}">
                        <span class="status-count-icon">${config.icon}</span>
                        <span class="status-count-number">${statusCounts[status]}</span>
                    </span>
                `;
            })
            .join('');
    }
    
    // =========================================================================
    // 상태 표시
    // =========================================================================
    
    /**
     * 매핑되지 않은 설비 상태 표시
     * @param {string} frontendId - Frontend ID
     * @param {Object} equipmentData - 설비 기본 데이터
     */
    showUnmapped(frontendId, equipmentData) {
        if (!this.container) return;
        
        this.currentMode = 'unmapped';
        this.durationTimer.stop();
        
        this.container.innerHTML = `
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">DB에 연결되지 않은 설비입니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">Frontend ID:</span>
                <span class="info-value">${frontendId}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Position:</span>
                <span class="info-value">Row ${equipmentData?.position?.row || '-'}, Col ${equipmentData?.position?.col || '-'}</span>
            </div>
            <div class="info-row unmapped-action">
                <span class="info-text">Edit Mode (E키)에서 매핑해주세요</span>
            </div>
        `;
        
        debugLog(`⚠️ GeneralTab showUnmapped: ${frontendId}`);
    }
    
    /**
     * Multi Selection 매핑 없음 상태 표시
     * @param {number} count - 선택된 설비 수
     */
    showMultiUnmapped(count) {
        if (!this.container) return;
        
        this.currentMode = 'unmapped';
        this.durationTimer.stop();
        
        this.container.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">📊</span>
                <span class="info-text">${count}개 설비 선택됨</span>
            </div>
            <div class="info-row unmapped-notice">
                <span class="info-icon">⚠️</span>
                <span class="info-text">선택된 설비가 모두 DB에 연결되지 않았습니다</span>
            </div>
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Production:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tact Time:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row unmapped-action">
                <span class="info-text">Edit Mode (E키)에서 매핑해주세요</span>
            </div>
        `;
        
        debugLog(`⚠️ GeneralTab showMultiUnmapped: ${count} items`);
    }
    
    /**
     * 기본 정보만 표시 (API 실패 시)
     * @param {string} frontendId - Frontend ID
     * @param {Object} [equipmentData] - 설비 기본 데이터
     */
    showBasicInfo(frontendId, equipmentData = null) {
        if (!this.container) return;
        
        this.currentMode = 'basic';
        this.durationTimer.stop();
        
        this.container.innerHTML = `
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row-divider"></div>
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Since:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Duration:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row-divider"></div>
            <div class="info-row">
                <span class="info-label">Production:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tact Time:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row info-row-warning">
                <span class="info-icon">ℹ️</span>
                <span class="info-text">상세 정보를 불러올 수 없습니다</span>
            </div>
        `;
        
        debugLog(`ℹ️ GeneralTab showBasicInfo: ${frontendId}`);
    }
    
    /**
     * 에러 상태 표시
     * @param {string} frontendId - Frontend ID
     * @param {string} [errorMessage] - 에러 메시지
     */
    showError(frontendId, errorMessage = '') {
        if (!this.container) return;
        
        this.currentMode = 'error';
        this.durationTimer.stop();
        
        this.container.innerHTML = `
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">데이터 로드 실패</span>
            </div>
            <div class="info-row">
                <span class="info-label">Frontend ID:</span>
                <span class="info-value">${frontendId}</span>
            </div>
            ${errorMessage ? `
            <div class="info-row error-message">
                <span class="info-text">${errorMessage}</span>
            </div>
            ` : ''}
        `;
        
        debugLog(`❌ GeneralTab showError: ${frontendId} - ${errorMessage}`);
    }
    
    /**
     * Multi Selection 에러 상태 표시
     * @param {number} count - 선택된 설비 수
     * @param {string} [errorMessage] - 에러 메시지
     */
    showMultiError(count, errorMessage = '') {
        if (!this.container) return;
        
        this.currentMode = 'error';
        this.durationTimer.stop();
        
        this.container.innerHTML = `
            <div class="info-row multi-select-header">
                <span class="info-icon">📊</span>
                <span class="info-text">${count}개 설비 선택됨</span>
            </div>
            <div class="info-row error-notice">
                <span class="info-icon">❌</span>
                <span class="info-text">집계 데이터 로드 실패</span>
            </div>
            ${errorMessage ? `
            <div class="info-row error-message">
                <span class="info-text">${errorMessage}</span>
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Production:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tact Time:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Product:</span>
                <span class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Lot No.:</span>
                <span class="info-value">-</span>
            </div>
        `;
        
        debugLog(`❌ GeneralTab showMultiError: ${count} items - ${errorMessage}`);
    }
    
    /**
     * 로딩 상태 표시
     */
    showLoading() {
        if (!this.container) return;
        
        this.currentMode = 'loading';
        this.durationTimer.stop();
        
        this.container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner-small"></div>
                <span class="loading-text">Loading...</span>
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
     * Duration Timer 정지
     */
    stopTimer() {
        this.durationTimer.stop();
    }
    
    /**
     * 컨테이너 재연결 (DOM 재생성 후)
     * @param {HTMLElement} container - 새 컨테이너
     */
    reconnect(container) {
        this.container = container;
        debugLog('📑 GeneralTab reconnected');
    }
    
    // =========================================================================
    // 정리
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.durationTimer.dispose();
        this.container = null;
        this.currentMode = null;
        
        debugLog('📑 GeneralTab disposed');
    }
}

// 기본 내보내기
export default GeneralTab;