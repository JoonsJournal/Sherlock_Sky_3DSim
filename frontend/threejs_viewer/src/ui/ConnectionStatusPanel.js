/**
 * Connection Status Panel
 * Backend API 연결 상태 표시
 */

export class ConnectionStatusPanel {
    constructor(container, connectionService) {
        this.container = container;
        this.connectionService = connectionService;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.render();
    }

    /**
     * 패널 렌더링
     */
    render() {
        this.container.innerHTML = `
            <div class="connection-panel api-status-panel">
                <h3>🔌 Backend API Status</h3>
                <div class="api-status-content">
                    <div class="status-indicator">
                        <span class="status-dot status-checking"></span>
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
            </div>
        `;
    }

    /**
     * 상태 업데이트
     */
    updateStatus(healthData) {
        const statusDot = this.container.querySelector('.status-dot');
        const statusText = this.container.querySelector('.status-text');
        const apiUrl = this.container.querySelector('#api-url');
        const responseTime = this.container.querySelector('#response-time');
        const lastCheck = this.container.querySelector('#last-check');
        const retryCountEl = this.container.querySelector('#retry-count');

        // 상태에 따라 색상 변경
        statusDot.className = 'status-dot';
        if (healthData.status === 'healthy') {
            statusDot.classList.add('status-connected');
            statusText.textContent = 'Connected';
            this.retryCount = 0; // 성공 시 재시도 카운트 리셋
        } else if (healthData.status === 'degraded') {
            statusDot.classList.add('status-warning');
            statusText.textContent = 'Degraded';
        } else {
            statusDot.classList.add('status-disconnected');
            statusText.textContent = 'Disconnected';
            this.retryCount++;
        }

        // 상세 정보 업데이트
        apiUrl.textContent = healthData.api_url || '-';
        responseTime.textContent = healthData.response_time_ms 
            ? `${healthData.response_time_ms}ms` 
            : '-';
        
        const lastCheckDate = new Date(healthData.last_check);
        lastCheck.textContent = lastCheckDate.toLocaleTimeString();
        
        retryCountEl.textContent = `${this.retryCount}/${this.maxRetries}`;
        
        // 최대 재시도 초과 시 경고
        if (this.retryCount >= this.maxRetries) {
            statusText.textContent = 'Connection Lost';
            retryCountEl.style.color = '#ff4444';
        }
    }

    /**
     * 재시도 카운트 리셋
     */
    resetRetryCount() {
        this.retryCount = 0;
        const retryCountEl = this.container.querySelector('#retry-count');
        if (retryCountEl) {
            retryCountEl.textContent = `0/${this.maxRetries}`;
            retryCountEl.style.color = '';
        }
    }
}