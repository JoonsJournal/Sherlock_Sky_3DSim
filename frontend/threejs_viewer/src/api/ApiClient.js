/**
 * ApiClient.js
 * REST API 통신 클라이언트
 */

import { debugLog } from '../core/utils/Config.js';
import { ENV, buildApiUrl, isDevelopment } from '../config/environment.js';

export class ApiClient {
    constructor(baseURL = null) {
        // 환경 설정에서 baseURL 로드
        this.baseURL = baseURL || ENV.API_BASE_URL;
        
        if (isDevelopment()) {
            console.log('🔌 ApiClient 초기화:', this.baseURL);
        }
    }
    
    /**
     * GET 요청
     * @param {string} endpoint - API 엔드포인트
     * @returns {Promise<any>}
     */
    async get(endpoint) {
        const url = buildApiUrl(endpoint);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            debugLog(`📥 GET ${endpoint}:`, data);
            return data;
        } catch (error) {
            console.error(`❌ GET ${endpoint} 실패:`, error);
            throw error;
        }
    }
    
    /**
     * POST 요청
     * @param {string} endpoint - API 엔드포인트
     * @param {Object} data - 전송할 데이터
     * @returns {Promise<any>}
     */
    async post(endpoint, data) {
        const url = buildApiUrl(endpoint);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            debugLog(`📤 POST ${endpoint}:`, result);
            return result;
        } catch (error) {
            console.error(`❌ POST ${endpoint} 실패:`, error);
            throw error;
        }
    }
    
    /**
     * PUT 요청
     * @param {string} endpoint - API 엔드포인트
     * @param {Object} data - 전송할 데이터
     * @returns {Promise<any>}
     */
    async put(endpoint, data) {
        const url = buildApiUrl(endpoint);
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            debugLog(`🔄 PUT ${endpoint}:`, result);
            return result;
        } catch (error) {
            console.error(`❌ PUT ${endpoint} 실패:`, error);
            throw error;
        }
    }
    
    /**
     * DELETE 요청
     * @param {string} endpoint - API 엔드포인트
     * @returns {Promise<any>}
     */
    async delete(endpoint) {
        const url = buildApiUrl(endpoint);
        
        try {
            const response = await fetch(url, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            debugLog(`🗑️ DELETE ${endpoint}:`, result);
            return result;
        } catch (error) {
            console.error(`❌ DELETE ${endpoint} 실패:`, error);
            throw error;
        }
    }
    
    /**
     * 데이터베이스 테이블 목록 조회
     * @param {string} siteName - 사이트 이름
     * @param {string} dbName - 데이터베이스 이름
     * @returns {Promise<Object>} { success: bool, tables: Array, total_tables: number }
     */
    async getDatabaseTables(siteName, dbName) {
        return await this.post('/connections/get-tables', {
            site_name: siteName,
            db_name: dbName
        });
    }
    
    
    
    // ============================================
    // 설비 관련 API
    // ============================================
    
    /**
     * 모든 설비 정보 가져오기
     * @returns {Promise<Array>}
     */
    async getAllEquipment() {
        return await this.get('/equipment');
    }
    
    /**
     * 특정 설비 정보 가져오기
     * @param {string} equipmentId - 설비 ID
     * @returns {Promise<Object>}
     */
    async getEquipment(equipmentId) {
        return await this.get(`/equipment/${equipmentId}`);
    }
    
    /**
     * 설비 상태 업데이트
     * @param {string} equipmentId - 설비 ID
     * @param {Object} statusData - 상태 데이터
     * @returns {Promise<Object>}
     */
    async updateEquipmentStatus(equipmentId, statusData) {
        return await this.put(`/equipment/${equipmentId}/status`, statusData);
    }
    
    /**
     * 설비 알람 로그 가져오기
     * @param {string} equipmentId - 설비 ID
     * @param {Object} params - 쿼리 파라미터 (startDate, endDate 등)
     * @returns {Promise<Array>}
     */
    async getAlarmLogs(equipmentId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/equipment/${equipmentId}/alarms${queryString ? '?' + queryString : ''}`;
        return await this.get(endpoint);
    }
    
    // ============================================
    // ⭐ 새로 추가: Equipment Mapping API
    // ============================================
    
    /**
     * DB 장비 이름 목록 조회 (Equipment Edit Modal용)
     * @returns {Promise<Array>} [{ equipment_id, equipment_name, equipment_code, line_name }, ...]
     */
    async getEquipmentNames() {
        try {
            const equipments = await this.get('/equipment/names');
            return Array.isArray(equipments) ? equipments : [];
        } catch (error) {
            console.error('Get equipment names error:', error);
            return [];
        }
    }
    
    /**
     * 설비 매핑 데이터 저장
     * @param {Array} mappings - [{ frontend_id, equipment_id, equipment_name }, ...]
     * @returns {Promise<Object>}
     */
    async saveEquipmentMappings(mappings) {
        return await this.post('/equipment/mapping', mappings);
    }
    
    /**
     * 설비 매핑 데이터 조회
     * @returns {Promise<Object>} { 'EQ-01-01': { equipment_id, equipment_name }, ... }
     */
    async getEquipmentMappings() {
        try {
            const mappings = await this.get('/equipment/mapping');
            return mappings || {};
        } catch (error) {
            console.error('Get equipment mappings error:', error);
            return {};
        }
    }
    
    /**
     * 특정 Frontend ID의 매핑 삭제
     * @param {string} frontendId - Frontend 설비 ID (예: 'EQ-01-01')
     * @returns {Promise<Object>}
     */
    async deleteEquipmentMapping(frontendId) {
        return await this.delete(`/equipment/mapping/${frontendId}`);
    }
    
    // ============================================
    // 연결 관리 API - Frontend UI용 (✅ 수정됨)
    // ============================================
    
    /**
     * API 헬스체크 (Frontend UI용)
     * @returns {Promise<Object>}
     */
    async checkHealth() {
        try {
            const result = await this.get('/connections/health');
            return result;
        } catch (error) {
            console.error('Health check error:', error);
            return {
                status: 'unhealthy',
                api_url: this.baseURL,
                response_time_ms: 0,
                last_check: new Date().toISOString(),
                version: 'unknown'
            };
        }
    }
    
    /**
     * 사이트 프로필 목록 가져오기 (Frontend UI용)
     * ✅ 수정: /connections/profiles → /connections/site-profiles
     * @returns {Promise<Array>} 프로필 배열
     */
    async getSiteProfiles() {
        try {
            const profiles = await this.get('/connections/site-profiles');
            // 방어 코드: 배열 확인
            return Array.isArray(profiles) ? profiles : [];
        } catch (error) {
            console.error('Get site profiles error:', error);
            return [];
        }
    }
    
    /**
     * 연결 상태 목록 조회 (Frontend UI용)
     * ✅ 수정: /connections/status → /connections/connection-status
     * @returns {Promise<Array>} 연결 상태 배열
     */
    async getConnectionStatusList() {
        try {
            const status = await this.get('/connections/connection-status');
            // 방어 코드: 배열 확인
            return Array.isArray(status) ? status : [];
        } catch (error) {
            console.error('Get connection status error:', error);
            return [];
        }
    }
    
    /**
     * 단일 사이트 연결 (Frontend UI용)
     * @param {string} siteId - 사이트 ID (예: korea_site1_line1)
     * @param {number} timeoutSeconds - 타임아웃 (기본 30초)
     * @returns {Promise<Object>}
     */
    async connectToSite(siteId, timeoutSeconds = 30) {
        return await this.post('/connections/connect', {
            site_id: siteId,  // 단일 사이트
            timeout_seconds: timeoutSeconds
        });
    }
    
    /**
     * 사이트 연결 해제 (Frontend UI용)
     * @param {string} siteId - 사이트 ID
     * @returns {Promise<Object>}
     */
    async disconnectFromSite(siteId) {
        // DELETE 대신 POST 사용 (백엔드 엔드포인트에 맞춤)
        return await this.post(`/connections/disconnect/${siteId}`);
    }
    
    /**
     * 데이터베이스 정보 조회 (Frontend UI용)
     * ✅ 수정: /connections/databases/{id} → /connections/database-info/{id}
     * @param {string} siteId - 사이트 ID
     * @returns {Promise<Object>}
     */
    async getDatabaseInfo(siteId) {
        try {
            const info = await this.get(`/connections/database-info/${siteId}`);
            // 방어 코드: tables 배열 확인
            if (info && !Array.isArray(info.tables)) {
                info.tables = [];
            }
            return info;
        } catch (error) {
            console.error('Get database info error:', error);
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
    
    // ============================================
    // Legacy 연결 관리 API (CLI/테스트용 - 기존 호환성 유지)
    // ============================================
    
    /**
     * 연결 프로필 목록 가져오기 (Legacy)
     * @returns {Promise<Object>} { profiles: Array, default_profile: string }
     */
    async getConnectionProfiles() {
        return await this.get('/connections/profiles');
    }
    
    /**
     * 선택된 프로필들 연결 시도 (Legacy)
     * @param {Array<string>} profileNames - 연결할 프로필 이름 배열
     * @returns {Promise<Object>} { results: Object, summary: Object }
     */
    async connectToProfiles(profileNames) {
        return await this.post('/connections/connect', {
            profile_names: profileNames
        });
    }
    
    /**
     * 시스템 전체 상태 조회 (Legacy)
     * @returns {Promise<Object>} { total_sites, total_profiles, default_profile, status }
     */
    async getConnectionStatus() {
        return await this.get('/connections/status');
    }
    
    /**
     * 특정 사이트/데이터베이스 활성화 (Legacy)
     * @param {string} siteId - 사이트 ID
     * @param {Array<string>} databases - 데이터베이스 목록 (null이면 전체)
     * @returns {Promise<Object>}
     */
    async enableConnections(siteId, databases = null) {
        return await this.post('/connections/enable', {
            site_id: siteId,
            databases: databases
        });
    }
    
    /**
     * 특정 사이트/데이터베이스 비활성화 (Legacy)
     * @param {string} siteId - 사이트 ID
     * @param {Array<string>} databases - 데이터베이스 목록 (null이면 전체)
     * @returns {Promise<Object>}
     */
    async disableConnections(siteId, databases = null) {
        return await this.post('/connections/disable', {
            site_id: siteId,
            databases: databases
        });
    }
    
    /**
     * 모든 활성 연결 테스트 (Legacy)
     * @returns {Promise<Object>} { results: Object, statistics: Object }
     */
    async testConnections() {
        return await this.post('/connections/test');
    }
    
    /**
     * 연결 설정 리로드 (Legacy)
     * @returns {Promise<Object>}
     */
    async reloadConnections() {
        return await this.post('/connections/reload');
    }
    
    /**
     * API 연결 테스트
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            await this.get('/equipment');
            console.log('✓ API 연결 성공');
            return true;
        } catch (error) {
            console.error('✗ API 연결 실패:', error);
            return false;
        }
    }
}