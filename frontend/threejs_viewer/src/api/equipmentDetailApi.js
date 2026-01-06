/**
 * equipmentDetailApi.js
 * =====================
 * Equipment Detail Backend API 클라이언트
 * 
 * @version 1.0.0
 * 📁 위치: frontend/threejs_viewer/src/api/equipmentDetailApi.js
 * 작성일: 2026-01-06
 */

import { debugLog } from '../core/utils/Config.js';

/**
 * Equipment Detail API 클라이언트
 */
export class EquipmentDetailApi {
    constructor(baseUrl = 'http://localhost:8000/api/equipment/detail') {
        this.baseUrl = baseUrl;
        this.timeout = 10000;  // 10초
        
        debugLog('📡 EquipmentDetailApi initialized');
    }
    
    // =========================================================================
    // API 메서드
    // =========================================================================
    
    /**
     * 단일 설비 상세 정보 조회
     * @param {string} frontendId - Frontend ID (예: 'EQ-17-03')
     * @param {string} [siteId] - Site ID (옵션)
     * @returns {Promise<Object>} 설비 상세 정보
     */
    async getDetail(frontendId, siteId = null) {
        let url = `${this.baseUrl}/${frontendId}`;
        
        if (siteId) {
            url += `?site_id=${encodeURIComponent(siteId)}`;
        }
        
        debugLog(`📡 GET ${url}`);
        
        try {
            const response = await this._fetch(url);
            return response;
        } catch (error) {
            console.error(`❌ getDetail failed for ${frontendId}:`, error);
            throw error;
        }
    }
    
    /**
     * 다중 설비 상세 정보 조회 (집계)
     * @param {string[]} frontendIds - Frontend ID 배열
     * @param {string} [siteId] - Site ID (옵션)
     * @returns {Promise<Object>} 집계된 설비 정보
     */
    async getMultiDetail(frontendIds, siteId = null) {
        let url = `${this.baseUrl}/multi`;
        
        if (siteId) {
            url += `?site_id=${encodeURIComponent(siteId)}`;
        }
        
        debugLog(`📡 POST ${url} - ${frontendIds.length} items`);
        
        try {
            const response = await this._fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ frontend_ids: frontendIds })
            });
            return response;
        } catch (error) {
            console.error(`❌ getMultiDetail failed:`, error);
            throw error;
        }
    }
    
    /**
     * Health Check
     * @returns {Promise<Object>}
     */
    async healthCheck() {
        const url = `${this.baseUrl}/health`;
        
        try {
            const response = await this._fetch(url);
            return response;
        } catch (error) {
            console.error('❌ Health check failed:', error);
            throw error;
        }
    }
    
    // =========================================================================
    // 내부 메서드
    // =========================================================================
    
    /**
     * Fetch with timeout
     * @private
     */
    async _fetch(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            throw error;
        }
    }
    
    /**
     * Base URL 변경
     */
    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
        debugLog(`📡 API base URL changed to: ${baseUrl}`);
    }
}

// 싱글톤 인스턴스
export const equipmentDetailApi = new EquipmentDetailApi();