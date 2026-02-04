/**
 * SiteSummaryService.js
 * ===========
 * Site Summary API 및 WebSocket 서비스
 * 
 * @version 1.0.2
 * @description
 * - Site 목록 및 Summary 데이터 조회 (REST API)
 * - WebSocket 실시간 업데이트 연결
 * - 재연결 로직 (Exponential Backoff)
 * - Mock 데이터 지원 (개발용)
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 * - v1.0.1 (2026-02-04): DashboardManager API 호환성 수정
 * - v1.0.2 (2026-02-04): env-config 연동 및 Mock 모드 자동 활성화
 *   - window.ENV_CONFIG에서 API/WS URL 읽기
 *   - Backend 연결 실패 시 자동 Mock 모드 전환
 *   - ⚠️ 호환성: 기존 기능 100% 유지
 * 
 * @dependencies
 * - DashboardState.js: 상태 관리
 * - env-config.js: 환경 설정 (window.ENV_CONFIG)
 * 
 * @exports
 * - SiteSummaryService: API 서비스 클래스
 * - getSiteSummaryService: 싱글톤 인스턴스 getter
 * 
 * 📁 위치: frontend/threejs_viewer/src/dashboard/services/SiteSummaryService.js
 * 작성일: 2026-02-03
 * 수정일: 2026-02-04
 */

import { getDashboardState, SiteStatus } from '../DashboardState.js';

// =========================================================
// Constants
// =========================================================

/** 재연결 딜레이 범위 (ms) */
const RECONNECT_DELAY = {
    MIN: 1000,
    MAX: 30000
};

// =========================================================
// Helper Functions
// =========================================================

/**
 * env-config에서 API Base URL 가져오기
 * @returns {string}
 */
function getApiBaseUrl() {
    // 1순위: window.ENV_CONFIG (env-config.js)
    if (window.ENV_CONFIG?.API_BASE_URL) {
        return window.ENV_CONFIG.API_BASE_URL;
    }
    
    // 2순위: window.runtimeConfig (legacy)
    if (window.runtimeConfig?.API_URL) {
        return window.runtimeConfig.API_URL;
    }
    
    // 기본값
    return '/api/v1';
}

/**
 * env-config에서 WebSocket Base URL 가져오기
 * @returns {string}
 */
function getWsBaseUrl() {
    // 1순위: window.ENV_CONFIG (env-config.js)
    if (window.ENV_CONFIG?.WS_URL) {
        return window.ENV_CONFIG.WS_URL;
    }
    
    // 2순위: window.runtimeConfig (legacy)
    if (window.runtimeConfig?.WS_URL) {
        return window.runtimeConfig.WS_URL;
    }
    
    // 기본값
    return 'ws://localhost:8000/ws';
}

// =========================================================
// SiteSummaryService Class
// =========================================================

/**
 * SiteSummaryService 클래스
 * Site Summary 데이터 관리 서비스
 */
export class SiteSummaryService {
    // =========================================================
    // Constructor
    // =========================================================
    
    /**
     * @param {Object} options - 옵션
     * @param {string} options.apiBase - API 기본 URL (기본: env-config)
     * @param {string} options.wsBase - WebSocket 기본 URL (기본: env-config)
     * @param {boolean} options.useMock - Mock 데이터 사용 여부 (기본: true for dev)
     * @param {number} options.pollingInterval - 폴링 간격 (ms)
     */
    constructor(options = {}) {
        // env-config에서 URL 가져오기
        const envApiBase = getApiBaseUrl();
        const envWsBase = getWsBaseUrl();
        
        this.options = {
            apiBase: options.apiBase ?? envApiBase,
            wsBase: options.wsBase ?? envWsBase,
            // ⚠️ 개발 중 Mock 모드 기본 활성화 (Backend API 미구현 상태)
            useMock: options.useMock ?? true,
            pollingInterval: options.pollingInterval ?? 10000
        };
        
        this.state = getDashboardState();
        
        this._ws = null;
        this._wsReconnectAttempts = 0;
        this._wsReconnectTimer = null;
        this._pollingTimer = null;
        this._isConnecting = false;
        
        console.log('📡 [SiteSummaryService] Initialized', {
            apiBase: this.options.apiBase,
            wsBase: this.options.wsBase,
            useMock: this.options.useMock,
            pollingInterval: this.options.pollingInterval
        });
    }
    
    // =========================================================
    // REST API Methods
    // =========================================================
    
    /**
     * Site Summary 조회 (DashboardManager 호환 alias)
     * @returns {Promise<Array>}
     */
    async fetchSitesSummary() {
        return this.fetchAllSummaries();
    }
    
    /**
     * Site 목록 조회
     * @returns {Promise<Array>}
     */
    async fetchSites() {
        console.log('📡 [SiteSummaryService] Fetching sites...');
        
        if (this.options.useMock) {
            return this._getMockSites();
        }
        
        try {
            const response = await fetch(`${this.options.apiBase}/dashboard/sites`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // State 업데이트
            this.state.setSites(data.sites || data);
            
            console.log(`✅ [SiteSummaryService] Fetched ${data.sites?.length || data.length} sites`);
            return data.sites || data;
            
        } catch (error) {
            console.error('❌ [SiteSummaryService] Failed to fetch sites:', error);
            
            // API 실패 시 Mock 모드로 전환
            console.warn('⚠️ [SiteSummaryService] Falling back to mock data...');
            return this._getMockSites();
        }
    }
    
    /**
     * 특정 Site Summary 조회
     * @param {string} siteId - Site ID
     * @returns {Promise<Object>}
     */
    async fetchSiteSummary(siteId) {
        console.log(`📡 [SiteSummaryService] Fetching summary for ${siteId}...`);
        
        if (this.options.useMock) {
            return this._getMockSiteSummary(siteId);
        }
        
        try {
            const response = await fetch(`${this.options.apiBase}/dashboard/sites/${siteId}/summary`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // State 업데이트
            this.state.setSite(data);
            
            console.log(`✅ [SiteSummaryService] Fetched summary for ${siteId}`);
            return data;
            
        } catch (error) {
            console.error(`❌ [SiteSummaryService] Failed to fetch summary for ${siteId}:`, error);
            return this._getMockSiteSummary(siteId);
        }
    }
    
    /**
     * 모든 Site Summary 일괄 조회
     * @returns {Promise<Array>}
     */
    async fetchAllSummaries() {
        console.log('📡 [SiteSummaryService] Fetching all summaries...');
        
        if (this.options.useMock) {
            console.log('🎭 [SiteSummaryService] Using mock data');
            const sites = await this._getMockSites();
            this.state.setSites(sites);
            return sites;
        }
        
        try {
            const response = await fetch(`${this.options.apiBase}/dashboard/summary`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // State 업데이트
            this.state.setSites(data.sites || data);
            
            console.log(`✅ [SiteSummaryService] Fetched all summaries`);
            return data.sites || data;
            
        } catch (error) {
            console.error('❌ [SiteSummaryService] Failed to fetch summaries:', error);
            
            // API 실패 시 Mock 모드로 전환
            console.warn('⚠️ [SiteSummaryService] Falling back to mock data...');
            const sites = await this._getMockSites();
            this.state.setSites(sites);
            return sites;
        }
    }
    
    /**
     * Site 재연결 시도 (DashboardManager 호환)
     * @param {string} siteId - Site ID
     * @returns {Promise<Object>}
     */
    async reconnectSite(siteId) {
        console.log(`🔄 [SiteSummaryService] Reconnecting site: ${siteId}...`);
        
        if (this.options.useMock) {
            // Mock: 연결 성공으로 시뮬레이션
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(`✅ [SiteSummaryService] Mock reconnect for ${siteId}`);
            return { success: true, message: 'Mock reconnect successful' };
        }
        
        try {
            const response = await fetch(`${this.options.apiBase}/sites/${siteId}/reconnect`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            console.log(`✅ [SiteSummaryService] Site ${siteId} reconnect: ${data.success}`);
            return data;
            
        } catch (error) {
            console.error(`❌ [SiteSummaryService] Failed to reconnect site ${siteId}:`, error);
            return { success: false, message: error.message };
        }
    }
    
    // =========================================================
    // WebSocket Methods
    // =========================================================
    
    /**
     * WebSocket URL 가져오기 (DashboardManager 호환)
     * @returns {string}
     */
    getWebSocketUrl() {
        return `${this.options.wsBase}/dashboard/summary`;
    }
    
    /**
     * WebSocket 연결
     */
    connectWebSocket() {
        if (this.options.useMock) {
            console.log('🎭 [SiteSummaryService] Mock mode - skipping WebSocket');
            this.state.setWsConnected(true); // Mock 연결 상태
            return;
        }
        
        if (this._ws || this._isConnecting) {
            console.warn('⚠️ [SiteSummaryService] WebSocket already connected or connecting');
            return;
        }
        
        this._isConnecting = true;
        
        try {
            const wsUrl = this.getWebSocketUrl();
            console.log(`📡 [SiteSummaryService] Connecting to WebSocket: ${wsUrl}`);
            
            this._ws = new WebSocket(wsUrl);
            
            this._ws.onopen = () => this._handleWsOpen();
            this._ws.onmessage = (event) => this._handleWsMessage(event);
            this._ws.onerror = (error) => this._handleWsError(error);
            this._ws.onclose = (event) => this._handleWsClose(event);
            
        } catch (error) {
            console.error('❌ [SiteSummaryService] WebSocket connection error:', error);
            this._isConnecting = false;
            this._scheduleReconnect();
        }
    }
    
    /**
     * WebSocket 연결 해제
     */
    disconnectWebSocket() {
        this._clearReconnectTimer();
        
        if (this._ws) {
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        
        this.state.setWsConnected(false);
        console.log('🔌 [SiteSummaryService] WebSocket disconnected');
    }
    
    /**
     * WebSocket Open 핸들러
     * @private
     */
    _handleWsOpen() {
        this._isConnecting = false;
        this._wsReconnectAttempts = 0;
        
        this.state.setWsConnected(true);
        console.log('✅ [SiteSummaryService] WebSocket connected');
    }
    
    /**
     * WebSocket Message 핸들러
     * @param {MessageEvent} event
     * @private
     */
    _handleWsMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'summary_update') {
                this.state.setSites(data.sites);
            } else if (data.type === 'site_update') {
                this.state.setSite(data.site);
            } else if (data.type === 'stats_update') {
                this.state.updateSiteStats(data.site_id, data.stats);
            }
            
        } catch (error) {
            console.error('❌ [SiteSummaryService] Failed to parse WebSocket message:', error);
        }
    }
    
    /**
     * WebSocket Error 핸들러
     * @param {Event} error
     * @private
     */
    _handleWsError(error) {
        console.error('❌ [SiteSummaryService] WebSocket error:', error);
        this._isConnecting = false;
    }
    
    /**
     * WebSocket Close 핸들러
     * @param {CloseEvent} event
     * @private
     */
    _handleWsClose(event) {
        this._isConnecting = false;
        this._ws = null;
        
        this.state.setWsConnected(false);
        
        console.log(`🔌 [SiteSummaryService] WebSocket closed (code: ${event.code})`);
        
        if (event.code !== 1000) {
            this._scheduleReconnect();
        }
    }
    
    /**
     * 재연결 스케줄링 (Exponential Backoff)
     * @private
     */
    _scheduleReconnect() {
        this._clearReconnectTimer();
        
        const delay = Math.min(
            RECONNECT_DELAY.MIN * Math.pow(2, this._wsReconnectAttempts),
            RECONNECT_DELAY.MAX
        );
        
        this._wsReconnectAttempts++;
        
        console.log(`🔄 [SiteSummaryService] Reconnecting in ${delay}ms (attempt ${this._wsReconnectAttempts})`);
        
        this._wsReconnectTimer = setTimeout(() => {
            this.connectWebSocket();
        }, delay);
    }
    
    /**
     * 재연결 타이머 제거
     * @private
     */
    _clearReconnectTimer() {
        if (this._wsReconnectTimer) {
            clearTimeout(this._wsReconnectTimer);
            this._wsReconnectTimer = null;
        }
    }
    
    // =========================================================
    // Polling Methods
    // =========================================================
    
    /**
     * 폴링 시작
     */
    startPolling() {
        if (this._pollingTimer) {
            console.warn('⚠️ [SiteSummaryService] Polling already running');
            return;
        }
        
        console.log(`📡 [SiteSummaryService] Starting polling (interval: ${this.options.pollingInterval}ms)`);
        
        this.fetchAllSummaries().catch(() => {});
        
        this._pollingTimer = setInterval(() => {
            this.fetchAllSummaries().catch(() => {});
        }, this.options.pollingInterval);
    }
    
    /**
     * 폴링 중지
     */
    stopPolling() {
        if (this._pollingTimer) {
            clearInterval(this._pollingTimer);
            this._pollingTimer = null;
            console.log('⏹️ [SiteSummaryService] Polling stopped');
        }
    }
    
    // =========================================================
    // Mock Data (개발용)
    // =========================================================
    
    /**
     * Mock Site 목록
     * @returns {Promise<Array>}
     * @private
     */
    async _getMockSites() {
        // 시뮬레이션 딜레이
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return [
            {
                site_id: 'CN_AAAA',
                display_name: 'CN_AAAA',
                flag_emoji: '🇨🇳',
                process: 'Cutting_Sherlock',
                has_layout: true,
                has_mapping: true,
                status: SiteStatus.HEALTHY,
                stats: { total: 117, run: 85, idle: 20, stop: 8, disc: 4 },
                production: 12450,
                alarms: 3,
                critical_equipments: [
                    { equipment_id: 15, frontend_id: 'EQ-24-03', status: 'SUDDENSTOP', duration_seconds: 120 },
                    { equipment_id: 23, frontend_id: 'EQ-15-01', status: 'ALARM', duration_seconds: 45 }
                ]
            },
            {
                site_id: 'KR_BBBB',
                display_name: 'KR_BBBB',
                flag_emoji: '🇰🇷',
                process: 'Assembly_Line',
                has_layout: true,
                has_mapping: false,
                status: SiteStatus.HEALTHY,
                stats: { total: 89, run: 70, idle: 15, stop: 4, disc: 0 },
                production: 8920,
                alarms: 1,
                equipment_count: 89
            },
            {
                site_id: 'VN_CCCC',
                display_name: 'VN_CCCC',
                flag_emoji: '🇻🇳',
                process: 'Packaging',
                has_layout: false,
                has_mapping: false,
                status: SiteStatus.HEALTHY,
                stats: { total: 0, run: 0, idle: 0, stop: 0, disc: 0 },
                production: 0,
                alarms: 0
            },
            {
                site_id: 'US_DDDD',
                display_name: 'US_DDDD',
                flag_emoji: '🇺🇸',
                process: 'Quality_Check',
                has_layout: false,
                has_mapping: true,
                status: SiteStatus.HEALTHY,
                stats: { total: 45, run: 30, idle: 10, stop: 5, disc: 0 },
                production: 3200,
                alarms: 0,
                equipment_count: 45
            },
            {
                site_id: 'JP_EEEE',
                display_name: 'JP_EEEE',
                flag_emoji: '🇯🇵',
                process: 'Cutting_Sherlock',
                has_layout: true,
                has_mapping: true,
                status: SiteStatus.DISCONNECTED,
                stats: { total: 0, run: 0, idle: 0, stop: 0, disc: 0 },
                production: 0,
                alarms: 0
            }
        ];
    }
    
    /**
     * Mock Site Summary
     * @param {string} siteId
     * @returns {Promise<Object>}
     * @private
     */
    async _getMockSiteSummary(siteId) {
        const sites = await this._getMockSites();
        return sites.find(s => s.site_id === siteId) || null;
    }
    
    // =========================================================
    // Cleanup
    // =========================================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.stopPolling();
        this.disconnectWebSocket();
        
        console.log('🗑️ [SiteSummaryService] Destroyed');
    }
}

// =========================================================
// Singleton Instance
// =========================================================

let serviceInstance = null;

/**
 * 싱글톤 인스턴스 가져오기
 * @param {Object} options - 옵션 (첫 호출 시에만 적용)
 * @returns {SiteSummaryService}
 */
export function getSiteSummaryService(options) {
    if (!serviceInstance) {
        serviceInstance = new SiteSummaryService(options);
    }
    return serviceInstance;
}

export default SiteSummaryService;