/**
 * ApiClient.js
 * REST API 통신 클라이언트
 */

import { debugLog } from '../utils/Config.js';
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