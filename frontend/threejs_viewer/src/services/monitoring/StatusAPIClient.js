/**
 * StatusAPIClient.js
 * ===================
 * Monitoring REST API 클라이언트
 * 
 * MonitoringService.js에서 추출된 모듈 (Phase 3 리팩토링)
 * 
 * @version 1.0.0
 * @description
 * - 초기 상태 로드 (GET /api/monitoring/status/initial)
 * - 단일 설비 실시간 상태 조회 (GET /api/monitoring/equipment/{frontend_id}/live)
 * - 전체 설비 상태 조회 (GET /api/monitoring/status)
 * - 설비 상태 이력 조회 (GET /api/monitoring/status/{equipment_id})
 * - Health Check (GET /api/monitoring/health)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/StatusAPIClient.js
 * 작성일: 2026-01-10
 * 
 * @changelog
 * - v1.0.0: MonitoringService.js v4.0.1에서 추출
 *   - loadInitialStatus() → fetchInitialStatus()
 *   - fetchSingleEquipmentStatus() → fetchEquipmentLiveStatus()
 *   - 기존 MonitoringService.js와 100% 호환
 * 
 * @backend_api
 * - GET /api/monitoring/status/initial?threshold_hours=24
 *   - 24시간 기준 초기 상태 조회
 *   - DISCONNECTED 판별 포함
 * 
 * - GET /api/monitoring/equipment/{frontend_id}/live
 *   - Redis 캐시에서 단일 설비 실시간 상태 조회
 *   - 404: 캐시에 데이터 없음
 * 
 * - GET /api/monitoring/status
 *   - 전체 설비 현재 상태 (24시간 제한 없음)
 * 
 * - GET /api/monitoring/status/{equipment_id}?limit=10
 *   - 특정 설비 상태 이력
 * 
 * - GET /api/monitoring/health
 *   - API 헬스체크
 */

import { debugLog } from '../../core/utils/Config.js';

/**
 * Monitoring REST API 클라이언트
 * 
 * @example
 * // 싱글톤 사용
 * import { statusApiClient } from './monitoring/StatusAPIClient.js';
 * const data = await statusApiClient.fetchInitialStatus(24);
 * 
 * // 인스턴스 생성
 * import { StatusAPIClient } from './monitoring/StatusAPIClient.js';
 * const client = new StatusAPIClient('http://localhost:8000/api/monitoring');
 * const status = await client.fetchEquipmentLiveStatus('EQ-01-01');
 */
export class StatusAPIClient {
    /**
     * @param {string} baseUrl - API Base URL (기본: 'http://localhost:8000/api/monitoring')
     */
    constructor(baseUrl = 'http://localhost:8000/api/monitoring') {
        this.baseUrl = baseUrl;
        this.timeout = 10000;  // 10초 타임아웃
        
        debugLog('📡 StatusAPIClient initialized (v1.0.0)');
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
        debugLog(`📡 StatusAPIClient base URL changed to: ${baseUrl}`);
    }
    
    /**
     * 현재 Base URL 반환
     * @returns {string}
     */
    getBaseUrl() {
        return this.baseUrl;
    }
    
    /**
     * 타임아웃 설정
     * @param {number} timeout - 타임아웃 (ms)
     */
    setTimeout(timeout) {
        this.timeout = timeout;
        debugLog(`📡 StatusAPIClient timeout changed to: ${timeout}ms`);
    }
    
    /**
     * 현재 타임아웃 반환
     * @returns {number}
     */
    getTimeout() {
        return this.timeout;
    }
    
    // =========================================================================
    // 핵심 API 메서드
    // =========================================================================
    
    /**
     * 초기 상태 조회 (Monitoring Mode 진입 시)
     * 
     * Backend API: GET /api/monitoring/status/initial?threshold_hours=24
     * 
     * ⭐ MonitoringService.loadInitialStatus()에서 사용하던 API 호출 부분
     * 
     * @param {number} thresholdHours - DISCONNECTED 판별 기준 시간 (기본: 24시간, 범위: 1~168)
     * @returns {Promise<Object>} 설비 상태 데이터
     * 
     * @example
     * const data = await apiClient.fetchInitialStatus(24);
     * // 응답 형식:
     * // {
     * //   equipment: [
     * //     { 
     * //       equipment_id: 1, 
     * //       frontend_id: 'EQ-01-01',  // ⚠️ Backend의 frontend_id (CUT-066 등)
     * //       equipment_name: 'Equipment 1',
     * //       status: 'RUN',            // RUN, IDLE, STOP, SUDDENSTOP 또는 null
     * //       last_updated: '2026-01-10T10:00:00Z',
     * //       is_connected: true        // threshold 이내 데이터 존재 여부
     * //     },
     * //     ...
     * //   ],
     * //   summary: {
     * //     total: 117, 
     * //     connected: 100, 
     * //     disconnected: 17,
     * //     by_status: { RUN: 50, IDLE: 30, STOP: 15, SUDDENSTOP: 5, DISCONNECTED: 17 }
     * //   },
     * //   threshold_hours: 24,
     * //   request_time: '2026-01-10T12:00:00Z',
     * //   site_id: 'korea_site'
     * // }
     * 
     * @throws {Error} HTTP 에러 또는 네트워크 에러
     */
    async fetchInitialStatus(thresholdHours = 24) {
        // 파라미터 검증 (Backend와 동일: 1~168)
        if (thresholdHours < 1 || thresholdHours > 168) {
            console.warn(`⚠️ Invalid thresholdHours: ${thresholdHours}. Using default 24.`);
            thresholdHours = 24;
        }
        
        const url = `${this.baseUrl}/status/initial?threshold_hours=${thresholdHours}`;
        
        debugLog(`📡 GET ${url}`);
        
        try {
            const response = await this._fetch(url);
            
            // 응답 검증
            if (!response.equipment || !Array.isArray(response.equipment)) {
                throw new Error('Invalid response format: missing equipment array');
            }
            
            debugLog(`✅ Initial status loaded: ${response.equipment.length} equipment`);
            
            // summary 로깅
            if (response.summary) {
                debugLog(`📊 Summary: Total=${response.summary.total}, Connected=${response.summary.connected}, Disconnected=${response.summary.disconnected}`);
            }
            
            return response;
            
        } catch (error) {
            console.error('❌ fetchInitialStatus failed:', error);
            throw error;
        }
    }
    
    /**
     * 단일 설비 실시간 상태 조회
     * 
     * Backend API: GET /api/monitoring/equipment/{frontend_id}/live
     * 
     * ⭐ MonitoringService.fetchSingleEquipmentStatus()와 동일한 기능
     * 
     * ⚠️ 주의: 이 API는 Redis 캐시에서 조회하므로,
     * 캐시에 데이터가 없으면 404를 반환합니다.
     * 
     * @param {string} frontendId - Frontend ID (예: 'EQ-01-01')
     * @returns {Promise<string|null>} 상태 문자열 ('RUN', 'IDLE', 'STOP', 'SUDDENSTOP') 또는 null
     * 
     * @example
     * const status = await apiClient.fetchEquipmentLiveStatus('EQ-01-01');
     * // status: 'RUN' 또는 null (데이터 없음)
     */
    async fetchEquipmentLiveStatus(frontendId) {
        if (!frontendId || typeof frontendId !== 'string') {
            console.error('❌ Invalid frontendId:', frontendId);
            return null;
        }
        
        const url = `${this.baseUrl}/equipment/${encodeURIComponent(frontendId)}/live`;
        
        debugLog(`📡 GET ${url}`);
        
        try {
            const response = await this._fetch(url);
            
            // 응답에서 status 추출
            // Backend 응답 형식: { equipment_id, status: {...}, production: {...}, timestamp }
            if (response.status) {
                // status가 객체인 경우 (예: { status: 'RUN', temperature: 25.5, ... })
                if (typeof response.status === 'object' && response.status.status) {
                    debugLog(`✅ Equipment live status: ${frontendId} -> ${response.status.status}`);
                    return response.status.status;
                }
                
                // status가 문자열인 경우
                if (typeof response.status === 'string') {
                    debugLog(`✅ Equipment live status: ${frontendId} -> ${response.status}`);
                    return response.status;
                }
            }
            
            debugLog(`⚠️ Could not extract status from response for: ${frontendId}`);
            return null;
            
        } catch (error) {
            // 404는 정상적인 "데이터 없음" 상황
            if (error.message && error.message.includes('404')) {
                debugLog(`⚠️ No live data for: ${frontendId} (404)`);
                return null;
            }
            
            console.error(`❌ fetchEquipmentLiveStatus failed for ${frontendId}:`, error);
            return null;
        }
    }
    
    // =========================================================================
    // 추가 API 메서드 (확장성)
    // =========================================================================
    
    /**
     * 전체 설비 현재 상태 조회
     * 
     * Backend API: GET /api/monitoring/status
     * 
     * ⚠️ 주의: 이 API는 24시간 제한 없이 가장 최근 상태를 반환합니다.
     * Monitoring Mode 초기화에는 fetchInitialStatus() 사용을 권장합니다.
     * 
     * @returns {Promise<Object>} 설비 상태 데이터
     * 
     * @example
     * const data = await apiClient.fetchAllStatus();
     * // 응답 형식:
     * // {
     * //   equipment: [
     * //     { equipment_id, frontend_id, equipment_name, status, occurred_at },
     * //     ...
     * //   ],
     * //   total: 117,
     * //   site_id: 'korea_site',
     * //   timestamp: '2026-01-10T12:00:00Z'
     * // }
     */
    async fetchAllStatus() {
        const url = `${this.baseUrl}/status`;
        
        debugLog(`📡 GET ${url}`);
        
        try {
            const response = await this._fetch(url);
            
            debugLog(`✅ All status loaded: ${response.total || 0} equipment`);
            
            return response;
            
        } catch (error) {
            console.error('❌ fetchAllStatus failed:', error);
            throw error;
        }
    }
    
    /**
     * 특정 설비 상태 이력 조회
     * 
     * Backend API: GET /api/monitoring/status/{equipment_id}?limit=10
     * 
     * @param {number} equipmentId - Equipment ID (DB ID)
     * @param {number} limit - 조회할 이력 개수 (기본: 10, 최대: 100)
     * @returns {Promise<Object>} 설비 상태 이력
     * 
     * @example
     * const history = await apiClient.fetchEquipmentStatusHistory(75, 20);
     * // 응답 형식:
     * // {
     * //   equipment_id: 75,
     * //   frontend_id: 'EQ-01-01',
     * //   equipment_name: 'Equipment 1',
     * //   current_status: 'RUN',
     * //   history: [
     * //     { status: 'RUN', occurred_at: '2026-01-10T12:00:00Z' },
     * //     { status: 'IDLE', occurred_at: '2026-01-10T11:30:00Z' },
     * //     ...
     * //   ],
     * //   total_history: 20
     * // }
     */
    async fetchEquipmentStatusHistory(equipmentId, limit = 10) {
        if (!equipmentId || typeof equipmentId !== 'number') {
            console.error('❌ Invalid equipmentId:', equipmentId);
            throw new Error('Invalid equipmentId: must be a number');
        }
        
        // limit 범위 검증 (Backend: 1~100)
        if (limit < 1 || limit > 100) {
            console.warn(`⚠️ Invalid limit: ${limit}. Using default 10.`);
            limit = 10;
        }
        
        const url = `${this.baseUrl}/status/${equipmentId}?limit=${limit}`;
        
        debugLog(`📡 GET ${url}`);
        
        try {
            const response = await this._fetch(url);
            
            debugLog(`✅ Status history loaded: equipment_id=${equipmentId}, ${response.total_history || 0} records`);
            
            return response;
            
        } catch (error) {
            console.error(`❌ fetchEquipmentStatusHistory failed for ${equipmentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Health Check
     * 
     * Backend API: GET /api/monitoring/health
     * 
     * @returns {Promise<Object>} 헬스체크 결과
     * 
     * @example
     * const health = await apiClient.healthCheck();
     * // 응답 형식:
     * // {
     * //   status: 'healthy',  // 'healthy' | 'degraded'
     * //   timestamp: '2026-01-10T12:00:00Z',
     * //   database_connected: true,
     * //   active_site: 'korea_site',
     * //   mapping_loaded: true,
     * //   mapped_equipment_count: 117
     * // }
     */
    async healthCheck() {
        const url = `${this.baseUrl}/health`;
        
        debugLog(`📡 GET ${url}`);
        
        try {
            const response = await this._fetch(url);
            
            debugLog(`✅ Health check: ${response.status}`);
            
            return response;
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
            throw error;
        }
    }
    
    // =========================================================================
    // 유틸리티 메서드
    // =========================================================================
    
    /**
     * 연결 상태 확인
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async isConnected() {
        try {
            const health = await this.healthCheck();
            return health.status === 'healthy';
        } catch {
            return false;
        }
    }
    
    /**
     * 디버그 정보 출력
     */
    debugPrint() {
        console.group('🔧 StatusAPIClient Debug Info');
        console.log('Version: 1.0.0');
        console.log('Base URL:', this.baseUrl);
        console.log('Timeout:', this.timeout, 'ms');
        console.log('Endpoints:');
        console.log('  - GET /status/initial?threshold_hours=N');
        console.log('  - GET /equipment/{frontend_id}/live');
        console.log('  - GET /status');
        console.log('  - GET /status/{equipment_id}?limit=N');
        console.log('  - GET /health');
        console.groupEnd();
    }
    
    // =========================================================================
    // 내부 메서드
    // =========================================================================
    
    /**
     * Fetch with timeout
     * @private
     * @param {string} url - 요청 URL
     * @param {Object} options - fetch 옵션
     * @returns {Promise<Object>} JSON 응답
     */
    async _fetch(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            
            throw error;
        }
    }
}

// =========================================================================
// 싱글톤 인스턴스 (선택적 사용)
// =========================================================================

/**
 * 싱글톤 인스턴스
 * 
 * @example
 * import { statusApiClient } from './monitoring/StatusAPIClient.js';
 * 
 * // 직접 사용
 * const data = await statusApiClient.fetchInitialStatus(24);
 * 
 * // Base URL 변경
 * statusApiClient.setBaseUrl('http://production-server:8000/api/monitoring');
 */
export const statusApiClient = new StatusAPIClient();