/**
 * Connection Service
 * 데이터베이스 연결 관리 서비스
 */

// ⭐ 동적 API URL 생성 함수
function getDefaultApiBaseUrl() {
    const host = window.location.hostname;
    const port = 8000;
    return `http://${host}:${port}`;
}

export class ConnectionService {
    constructor(apiBaseUrl = null) {
        this.apiBaseUrl = apiBaseUrl || getDefaultApiBaseUrl();
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
     * ✅ 수정: /profiles → /site-profiles
     */
    async getProfiles() {
        try {
            // ✅ 올바른 엔드포인트 사용
            const response = await fetch(`${this.apiBaseUrl}/api/connections/site-profiles`);
            if (!response.ok) throw new Error('Failed to fetch profiles');
            
            const data = await response.json();
            
            // 방어 코드: 배열 확인
            if (!Array.isArray(data)) {
                console.warn('Profiles response is not an array:', data);
                return [];
            }
            
            return data;
        } catch (error) {
            console.error('Get profiles error:', error);
            return []; // 에러 시 빈 배열 반환
        }
    }

    /**
     * 연결 상태 조회
     * ✅ 수정: /status → /connection-status
     */
    async getStatus() {
        try {
            // ✅ 올바른 엔드포인트 사용
            const response = await fetch(`${this.apiBaseUrl}/api/connections/connection-status`);
            if (!response.ok) throw new Error('Failed to fetch status');
            
            const data = await response.json();
            
            // 방어 코드: 배열 확인
            if (!Array.isArray(data)) {
                console.warn('Status response is not an array:', data);
                return [];
            }
            
            return data;
        } catch (error) {
            console.error('Get status error:', error);
            return []; // 에러 시 빈 배열 반환
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
                    site_id: siteId,  // ✅ site_ids → site_id (단일)
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
     * ✅ 수정: /databases/{siteId} → /database-info/{siteId}
     */
    async getDatabaseInfo(siteId) {
        try {
            // ✅ 올바른 엔드포인트 사용
            const response = await fetch(`${this.apiBaseUrl}/api/connections/database-info/${siteId}`);
            if (!response.ok) throw new Error('Failed to fetch database info');
            
            const data = await response.json();
            
            // 방어 코드: tables가 배열인지 확인
            if (data && !Array.isArray(data.tables)) {
                console.warn('Database tables is not an array:', data);
                data.tables = [];
            }
            
            return data;
        } catch (error) {
            console.error('Get database info error:', error);
            // 기본 구조 반환
            return {
                site_id: siteId,
                site_name: 'Unknown',
                db_name: 'Unknown',
                tables: [],
                total_tables: 0,
                db_type: 'unknown'
            };
        }
    }

    /**
     * 특정 사이트 상태 조회
     * ✅ 새로 추가: 단일 사이트 상태
     */
    async getSiteStatus(siteId) {
        try {
            // 전체 상태를 가져와서 해당 사이트만 필터링
            const allStatus = await this.getStatus();
            const siteStatus = allStatus.find(s => s.site_id === siteId);
            
            if (!siteStatus) {
                throw new Error(`Site ${siteId} not found`);
            }
            
            return siteStatus;
        } catch (error) {
            console.error('Get site status error:', error);
            throw error;
        }
    }
}