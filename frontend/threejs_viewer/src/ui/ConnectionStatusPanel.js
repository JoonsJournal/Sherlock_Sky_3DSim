/**
 * ConnectionStatusPanel.js
 * Backend API 연결 상태 표시 패널
 * 
 * @version 2.1.0
 * @description BasePanel 상속 적용, 인라인 스타일 제거
 * @modified 2026-01-06 (Phase 5 - CSS 클래스 기반으로 전환)
 */

import { BasePanel } from '../core/base/BasePanel.js';

/**
 * ConnectionStatusPanel
 * API 연결 상태 표시 패널
 */
export class ConnectionStatusPanel extends BasePanel {
    /**
     * @param {Object} options
     * @param {Object} options.connectionService - 연결 서비스
     */
    constructor(options = {}) {
        super({
            ...options,
            title: '🔌 Backend API Status',
            collapsible: false,
            className: 'connection-panel api-status-panel'
        });
        
        this.connectionService = options.connectionService;
        this.retryCount = 0;
        this.maxRetries = 3;
    }
    
    /**
     * 패널 내용 렌더링
     */
    renderContent() {
        return `
            <div class="api-status-content">
                <div class="status-indicator">
                    <span class="status-dot status-dot--checking"></span>
                    <span class="status-text">Checking...</span>
                </div>
                <div class="status-details">
                    <div class="status-detail">
                        <span class="detail-label">API URL:</span>
                        <span class="detail-value" id="api-url">-</span>
                    </div>
                    <div class="status-detail">
                        <span class="detail-label">Response Time:</span>
                        <span class="detail-value" id="response-time">-</span>
                    </div>
                    <div class="status-detail">
                        <span class="detail-label">Last Check:</span>
                        <span class="detail-value" id="last-check">-</span>
                    </div>
                    <div class="status-detail">
                        <span class="detail-label">Retry Count:</span>
                        <span class="detail-value" id="retry-count">0</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 상태 업데이트
     * @param {Object} healthData - 헬스체크 데이터
     */
    updateStatus(healthData) {
        const statusDot = this.$('.status-dot');
        const statusText = this.$('.status-text');
        const apiUrl = this.$('#api-url');
        const responseTime = this.$('#response-time');
        const lastCheck = this.$('#last-check');
        const retryCountEl = this.$('#retry-count');

        if (!statusDot || !statusText) return;

        // 상태 클래스 초기화
        statusDot.className = 'status-dot';
        statusText.className = 'status-text';
        
        if (healthData.status === 'healthy') {
            statusDot.classList.add('status-dot--connected');
            statusText.classList.add('status-text--connected');
            statusText.textContent = 'Connected';
            this.retryCount = 0;
        } else if (healthData.status === 'degraded') {
            statusDot.classList.add('status-dot--degraded');
            statusText.classList.add('status-text--degraded');
            statusText.textContent = 'Degraded';
        } else {
            statusDot.classList.add('status-dot--disconnected');
            statusText.classList.add('status-text--disconnected');
            statusText.textContent = 'Disconnected';
            this.retryCount++;
        }

        // 상세 정보 업데이트
        if (apiUrl) {
            apiUrl.textContent = healthData.api_url || '-';
        }
        
        if (responseTime) {
            responseTime.textContent = healthData.response_time_ms 
                ? `${healthData.response_time_ms}ms` 
                : '-';
        }
        
        if (lastCheck && healthData.last_check) {
            const lastCheckDate = new Date(healthData.last_check);
            lastCheck.textContent = lastCheckDate.toLocaleTimeString();
        }
        
        if (retryCountEl) {
            retryCountEl.textContent = `${this.retryCount}/${this.maxRetries}`;
            retryCountEl.className = 'detail-value';
            
            // 최대 재시도 초과 시 경고
            if (this.retryCount >= this.maxRetries) {
                statusText.textContent = 'Connection Lost';
                retryCountEl.classList.add('detail-value--error');
            }
        }
    }

    /**
     * 재시도 카운트 리셋
     */
    resetRetryCount() {
        this.retryCount = 0;
        const retryCountEl = this.$('#retry-count');
        if (retryCountEl) {
            retryCountEl.textContent = `0/${this.maxRetries}`;
            retryCountEl.className = 'detail-value';
        }
    }
}

export default ConnectionStatusPanel;