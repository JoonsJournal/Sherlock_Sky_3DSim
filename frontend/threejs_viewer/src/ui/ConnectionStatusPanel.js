/**
 * ConnectionStatusPanel.js
 * Backend API 연결 상태 표시 패널
 * 
 * @version 2.0.0
 * @description BasePanel 상속 적용
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
                <div class="status-indicator" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 12px;
                ">
                    <span class="status-dot status-checking" style="
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: #888;
                    "></span>
                    <span class="status-text" style="font-weight: 500; color: #fff;">Checking...</span>
                </div>
                <div class="status-details" style="font-size: 13px;">
                    <div class="status-detail" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span class="detail-label" style="color: #888;">API URL:</span>
                        <span class="detail-value" id="api-url" style="color: #fff;">-</span>
                    </div>
                    <div class="status-detail" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span class="detail-label" style="color: #888;">Response Time:</span>
                        <span class="detail-value" id="response-time" style="color: #fff;">-</span>
                    </div>
                    <div class="status-detail" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span class="detail-label" style="color: #888;">Last Check:</span>
                        <span class="detail-value" id="last-check" style="color: #fff;">-</span>
                    </div>
                    <div class="status-detail" style="display: flex; justify-content: space-between;">
                        <span class="detail-label" style="color: #888;">Retry Count:</span>
                        <span class="detail-value" id="retry-count" style="color: #fff;">0</span>
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

        // 상태에 따라 색상 변경
        statusDot.className = 'status-dot';
        
        if (healthData.status === 'healthy') {
            statusDot.style.background = '#4CAF50';
            statusText.textContent = 'Connected';
            statusText.style.color = '#4CAF50';
            this.retryCount = 0;
        } else if (healthData.status === 'degraded') {
            statusDot.style.background = '#FFC107';
            statusText.textContent = 'Degraded';
            statusText.style.color = '#FFC107';
        } else {
            statusDot.style.background = '#f44336';
            statusText.textContent = 'Disconnected';
            statusText.style.color = '#f44336';
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
            
            // 최대 재시도 초과 시 경고
            if (this.retryCount >= this.maxRetries) {
                statusText.textContent = 'Connection Lost';
                retryCountEl.style.color = '#ff4444';
            } else {
                retryCountEl.style.color = '#fff';
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
            retryCountEl.style.color = '#fff';
        }
    }
}

export default ConnectionStatusPanel;