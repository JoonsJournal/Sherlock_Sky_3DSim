/**
 * equipmentDetailApi.js
 * =====================
 * Equipment Detail Backend API 클라이언트
 * 
 * @version 2.0.0
 * @changelog
 * - v2.0.0: EquipmentInfoPanel.js 통합을 위한 파라미터 확장
 *           - getDetail(): equipmentId 파라미터 추가
 *           - getMultiDetail(): equipmentIds 파라미터 추가
 *           - setBaseUrl() 메서드 추가
 *           - 기존 siteId 파라미터 100% 유지 (하위 호환성)
 * - v1.0.0: 초기 버전
 * 
 * 📁 위치: frontend/threejs_viewer/src/api/equipmentDetailApi.js
 * 작성일: 2026-01-06
 * 수정일: 2026-01-09
 */

import { debugLog } from '../core/utils/Config.js';

/**
 * Equipment Detail API 클라이언트
 */
// ⭐ 동적 URL 생성 함수
function getDefaultDetailApiUrl() {
    const host = window.location.hostname;
    const port = 8000;
    return `http://${host}:${port}/api/equipment/detail`;
}

export class EquipmentDetailApi {
    constructor(baseUrl = null) {
        this.baseUrl = baseUrl || getDefaultDetailApiUrl();
        this.timeout = 10000;  // 10초
        
        debugLog('📡 EquipmentDetailApi initialized (v2.0.0)');
    }
    
    // =========================================================================
    // API 메서드
    // =========================================================================
    
    /**
     * 단일 설비 상세 정보 조회
     * @param {string} frontendId - Frontend ID (예: 'EQ-17-03')
     * @param {Object} [options] - 옵션 파라미터
     * @param {string} [options.equipmentId] - Equipment ID (DB 매핑 ID)
     * @param {string} [options.siteId] - Site ID (옵션)
     * @returns {Promise<Object>} 설비 상세 정보
     * 
     * @example
     * // 기존 방식 (하위 호환)
     * await api.getDetail('EQ-17-03');
     * await api.getDetail('EQ-17-03', { siteId: 'SITE_001' });
     * 
     * // 새로운 방식 (EquipmentInfoPanel 통합)
     * await api.getDetail('EQ-17-03', { equipmentId: 123 });
     * await api.getDetail('EQ-17-03', { equipmentId: 123, siteId: 'SITE_001' });
     */
    async getDetail(frontendId, options = {}) {
        // 🆕 v2.0.0: 하위 호환성 - 두 번째 파라미터가 문자열이면 siteId로 처리
        let equipmentId = null;
        let siteId = null;
        
        if (typeof options === 'string') {
            // 기존 방식: getDetail(frontendId, siteId)
            siteId = options;
        } else if (typeof options === 'object' && options !== null) {
            // 새로운 방식: getDetail(frontendId, { equipmentId, siteId })
            equipmentId = options.equipmentId || null;
            siteId = options.siteId || null;
        }
        
        // URL 구성
        let url = `${this.baseUrl}/${frontendId}`;
        const queryParams = [];
        
        // 🆕 v2.0.0: equipment_id 쿼리 파라미터 (EquipmentInfoPanel 호환)
        if (equipmentId) {
            queryParams.push(`equipment_id=${encodeURIComponent(equipmentId)}`);
        }
        
        // 기존: site_id 쿼리 파라미터
        if (siteId) {
            queryParams.push(`site_id=${encodeURIComponent(siteId)}`);
        }
        
        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
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
     * @param {Object} [options] - 옵션 파라미터
     * @param {string[]} [options.equipmentIds] - Equipment ID 배열 (DB 매핑 ID들)
     * @param {string} [options.siteId] - Site ID (옵션)
     * @returns {Promise<Object>} 집계된 설비 정보
     * 
     * @example
     * // 기존 방식 (하위 호환)
     * await api.getMultiDetail(['EQ-17-03', 'EQ-17-04']);
     * await api.getMultiDetail(['EQ-17-03', 'EQ-17-04'], { siteId: 'SITE_001' });
     * 
     * // 새로운 방식 (EquipmentInfoPanel 통합)
     * await api.getMultiDetail(['EQ-17-03', 'EQ-17-04'], { equipmentIds: [123, 124] });
     */
    async getMultiDetail(frontendIds, options = {}) {
        // 🆕 v2.0.0: 하위 호환성 - 두 번째 파라미터가 문자열이면 siteId로 처리
        let equipmentIds = null;
        let siteId = null;
        
        if (typeof options === 'string') {
            // 기존 방식: getMultiDetail(frontendIds, siteId)
            siteId = options;
        } else if (typeof options === 'object' && options !== null) {
            // 새로운 방식: getMultiDetail(frontendIds, { equipmentIds, siteId })
            equipmentIds = options.equipmentIds || null;
            siteId = options.siteId || null;
        }
        
        // URL 구성
        let url = `${this.baseUrl}/multi`;
        
        if (siteId) {
            url += `?site_id=${encodeURIComponent(siteId)}`;
        }
        
        // 🆕 v2.0.0: Request Body 확장 (equipment_ids 포함)
        const requestBody = {
            frontend_ids: frontendIds
        };
        
        // equipment_ids가 있으면 추가 (EquipmentInfoPanel 호환)
        if (equipmentIds && Array.isArray(equipmentIds) && equipmentIds.length > 0) {
            requestBody.equipment_ids = equipmentIds;
        }
        
        debugLog(`📡 POST ${url} - ${frontendIds.length} items`, requestBody);
        
        try {
            const response = await this._fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
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
    
    // =========================================================================
    // 설정 메서드
    // =========================================================================
    
    /**
     * Base URL 변경
     * @param {string} baseUrl - 새로운 Base URL
     */
    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
        debugLog(`📡 API base URL changed to: ${baseUrl}`);
    }
    
    /**
     * 🆕 v2.0.0: Timeout 설정
     * @param {number} timeout - 타임아웃 (ms)
     */
    setTimeout(timeout) {
        this.timeout = timeout;
        debugLog(`📡 API timeout changed to: ${timeout}ms`);
    }
    
    /**
     * 🆕 v2.0.0: 현재 Base URL 반환
     * @returns {string}
     */
    getBaseUrl() {
        return this.baseUrl;
    }
}

// 싱글톤 인스턴스
export const equipmentDetailApi = new EquipmentDetailApi();