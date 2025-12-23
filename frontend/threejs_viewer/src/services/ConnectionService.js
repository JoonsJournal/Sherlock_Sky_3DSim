/**
 * Connection Service
 * 데이터베이스 연결 관리 서비스
 */

export class ConnectionService {
    constructor(apiBaseUrl = 'http://localhost:8000') {
        this.apiBaseUrl = apiBaseUrl;
        this.healthCheckInterval = null;
        this.healthCheckCallbacks = [];
    }

    /**
     * API 헬스체크
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connections/health`);
            if (!response.ok) throw new Error('Health check failed');
            return await response.json();
        } catch (error) {
            console.error('Health check error:', error);
            return {
                status: 'unhealthy',
                api_url: this.apiBaseUrl,
                response_time_ms: 0,
                last_check: new Date().toISOString(),
                version: 'unknown',
                websocket_enabled: false
            };
        }
    }

    /**
     * 자동 헬스체크 시작 (5초마다)
     */
    startAutoHealthCheck(callback) {
        if (this.healthCheckInterval) {
            this.stopAutoHealthCheck();
        }

        this.healthCheckCallbacks.push(callback);

        // 즉시 한 번 실행
        this.checkHealth().then(result => {
            this.healthCheckCallbacks.forEach(cb => cb(result));
        });

        // 5초마다 실행
        this.healthCheckInterval = setInterval(async () => {
            const result = await this.checkHealth();
            this.healthCheckCallbacks.forEach(cb => cb(result));
        }, 5000);
    }

    /**
     * 자동 헬스체크 중지
     */
    stopAutoHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.healthCheckCallbacks = [];
    }

    /**
     * 연결 프로필 목록 가져오기
     */
    async getProfiles() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connections/profiles`);
            if (!response.ok) throw new Error('Failed to fetch profiles');
            return await response.json();
        } catch (error) {
            console.error('Get profiles error:', error);
            throw error;
        }
    }

    /**
     * 연결 상태 조회
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connections/status`);
            if (!response.ok) throw new Error('Failed to fetch status');
            return await response.json();
        } catch (error) {
            console.error('Get status error:', error);
            throw error;
        }
    }

    /**
     * 사이트 연결 (Single site only)
     */
    async connectToSite(siteId, timeoutSeconds = 30) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connections/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    site_ids: [siteId],
                    timeout_seconds: timeoutSeconds
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Connection failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Connect error:', error);
            throw error;
        }
    }

    /**
     * 사이트 연결 해제
     */
    async disconnectFromSite(siteId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connections/disconnect/${siteId}`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Disconnect failed');
            return await response.json();
        } catch (error) {
            console.error('Disconnect error:', error);
            throw error;
        }
    }

    /**
     * 데이터베이스 정보 조회
     */
    async getDatabaseInfo(siteId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connections/databases/${siteId}`);
            if (!response.ok) throw new Error('Failed to fetch database info');
            return await response.json();
        } catch (error) {
            console.error('Get database info error:', error);
            throw error;
        }
    }

    /**
     * 특정 사이트 상태 조회
     */
    async getSiteStatus(siteId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connections/status/${siteId}`);
            if (!response.ok) throw new Error('Failed to fetch site status');
            return await response.json();
        } catch (error) {
            console.error('Get site status error:', error);
            throw error;
        }
    }
}