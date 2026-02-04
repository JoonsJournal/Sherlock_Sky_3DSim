/**
 * DashboardManager.js - Dashboard 전역 관리자
 * 
 * @version 1.0.2
 * @created 2026-02-03
 * @modified 2026-02-04
 * @phase Phase 2: Site Dashboard 구현
 * 
 * @description
 * Multi-Site Dashboard의 전역 관리자
 * - Site Card 컴포넌트 관리
 * - Summary WebSocket 연결 관리
 * - Mode 전환 로직 통합
 * - 전역 알림 관리
 * 
 * @dependencies
 * - SiteCard.js: Site Card 컴포넌트
 * - SummaryFooter.js: Footer 컴포넌트
 * - GlobalAlertBanner.js: Alert Banner 컴포넌트
 * - SiteSummaryService.js: API 서비스
 * - ModeTransition.js: Mode 전환 서비스
 * - DashboardState.js: 상태 관리
 * - _dashboard.css: Dashboard 스타일
 * 
 * @exports
 * - DashboardManager: Dashboard 관리자 클래스
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 * - v1.0.1 (2026-02-03): CSS 클래스 상수화, Design Token 적용, 가이드라인 준수
 * - v1.0.2 (2026-02-04): Mock 모드에서 WebSocket 스킵
 *   - SiteSummaryService.options.useMock 확인
 *   - ⚠️ 호환성: 기존 기능 100% 유지
 * 
 * 위치: frontend/threejs_viewer/src/dashboard/components/DashboardManager.js
 */

import { SiteCard } from './SiteCard.js';
import { SummaryFooter } from './SummaryFooter.js';
import { GlobalAlertBanner } from './GlobalAlertBanner.js';
import { SiteSummaryService } from '../services/SiteSummaryService.js';
import { ModeTransition } from '../services/ModeTransition.js';
import { getDashboardState, StateEvents, SiteReadiness } from '../DashboardState.js';

/**
 * DashboardManager 클래스
 */
export class DashboardManager {
    // =========================================================
    // CSS Class Constants (가이드라인 준수)
    // =========================================================
    
    /** @type {Object} CSS 클래스 상수 */
    static CSS = {
        // Layout
        HIDDEN: 'hidden',
        
        // Connection Indicator
        CONNECTION_INDICATOR: 'connection-indicator',
        CONNECTION_DOT: 'connection-indicator__dot',
        CONNECTION_TEXT: 'connection-indicator__text',
        CONNECTION_DISCONNECTED: 'disconnected',
        
        // Toast
        TOAST: 'toast',
        TOAST_SUCCESS: 'toast--success',
        TOAST_ERROR: 'toast--error',
        TOAST_INFO: 'toast--info',
        TOAST_ICON: 'toast__icon',
        TOAST_MESSAGE: 'toast__message',
        
        // Error
        ERROR_CONTAINER: 'dashboard-error',
        ERROR_ICON: 'dashboard-error__icon',
        ERROR_TITLE: 'dashboard-error__title',
        ERROR_MESSAGE: 'dashboard-error__message',
        ERROR_BUTTON: 'dashboard-error__button'
    };
    
    // =========================================================
    // Constructor
    // =========================================================
    
    /**
     * @param {string} containerId - Site Cards 컨테이너 ID
     */
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        // 상태 관리
        this.state = getDashboardState();
        
        // 서비스
        this.summaryService = new SiteSummaryService();
        this.modeTransition = new ModeTransition();
        
        // 컴포넌트 인스턴스
        this.siteCards = new Map();  // site_id → SiteCard
        this.summaryFooter = null;
        this.alertBanner = null;
        
        // WebSocket 관련
        this.wsConnection = null;
        this.wsReconnectTimer = null;
        this.wsReconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        
        // Update 인터벌
        this.updateInterval = null;
        this.updateIntervalMs = 30000; // 30초
        
        // 초기화 상태
        this._initialized = false;
    }
    
    // =========================================================
    // Initialization
    // =========================================================
    
    /**
     * Dashboard 초기화
     */
    async init() {
        if (this._initialized) {
            console.warn('⚠️ Dashboard already initialized');
            return;
        }
        
        console.log('🏭 DashboardManager 초기화...');
        
        try {
            // 1. UI 컴포넌트 초기화
            this._initComponents();
            
            // 2. 상태 이벤트 구독
            this._subscribeStateEvents();
            
            // 3. 초기 데이터 로드
            await this._loadInitialData();
            
            // 4. WebSocket 연결 (Mock 모드가 아닐 때만)
            if (!this.summaryService.options.useMock) {
                await this._connectWebSocket();
            } else {
                console.log('🎭 [DashboardManager] Mock mode - skipping WebSocket');
                this.state.setWsConnected(true); // Mock 연결 상태로 표시
                this._updateConnectionIndicator(true);
            }
            
            // 5. 주기적 업데이트 시작
            this._startUpdateInterval();
            
            this._initialized = true;
            console.log('✅ DashboardManager 초기화 완료');
            
        } catch (error) {
            console.error('❌ DashboardManager 초기화 실패:', error);
            this._showError(error);
            throw error;
        }
    }
    
    /**
     * UI 컴포넌트 초기화
     */
    _initComponents() {
        // Summary Footer
        const footerContainer = document.getElementById('summary-footer');
        if (footerContainer) {
            this.summaryFooter = new SummaryFooter({
                container: footerContainer,
                state: this.state
            });
            this.summaryFooter.mount();
        }
        
        // Global Alert Banner
        const alertContainer = document.getElementById('global-alert-banner');
        if (alertContainer) {
            this.alertBanner = new GlobalAlertBanner({
                container: alertContainer
            });
            this.alertBanner.mount();
        }
    }
    
    /**
     * 상태 이벤트 구독
     */
    _subscribeStateEvents() {
        // Site 추가 시
        this.state.on(StateEvents.SITE_ADDED, ({ siteId, site }) => {
            this._addSiteCard(site);
        });
        
        // Site 제거 시
        this.state.on(StateEvents.SITE_REMOVED, ({ siteId }) => {
            this._removeSiteCard(siteId);
        });
        
        // Site 상태 변경 시
        this.state.on(StateEvents.SITE_STATUS_CHANGED, ({ siteId, site }) => {
            this._updateSiteCard(siteId, site);
        });
        
        // 연결 상태 변경 시
        this.state.on(StateEvents.CONNECTION_STATUS_CHANGED, ({ connected }) => {
            this._updateConnectionIndicator(connected);
        });
    }
    
    // =========================================================
    // Data Loading
    // =========================================================
    
    /**
     * 초기 데이터 로드
     */
    async _loadInitialData() {
        console.log('📥 초기 Site 데이터 로드...');
        
        try {
            // Loading 표시
            this._showLoading(true);
            
            // Site Summary 조회
            const sites = await this.summaryService.fetchSitesSummary();
            
            if (!sites || sites.length === 0) {
                this._showEmpty(true);
                return;
            }
            
            // 상태에 저장
            this.state.setSites(sites);
            
            // Site Cards 렌더링
            this._renderSiteCards(sites);
            
            // Loading 숨기기
            this._showLoading(false);
            
            console.log(`✅ ${sites.length}개 Site 로드 완료`);
            
        } catch (error) {
            console.error('❌ 초기 데이터 로드 실패:', error);
            this._showLoading(false);
            this._showError(error);
            throw error;
        }
    }
    
    /**
     * Site Cards 렌더링
     * @param {Array} sites
     */
    _renderSiteCards(sites) {
        if (!this.container) return;
        
        const CSS = DashboardManager.CSS;
        
        // 컨테이너 표시
        this.container.classList.remove(CSS.HIDDEN);
        this.container.innerHTML = '';
        
        // Site 카드 생성
        sites.forEach(site => {
            this._addSiteCard(site);
        });
    }
    
    /**
     * Site Card 추가
     * @param {Object} site
     */
    _addSiteCard(site) {
        if (!this.container || !site.site_id) return;
        
        const card = new SiteCard({
            siteData: site,
            onModeSelect: this._handleModeSelect.bind(this),
            onRetry: this._handleRetryConnection.bind(this)
        });
        
        const cardElement = card.render();
        this.container.appendChild(cardElement);
        this.siteCards.set(site.site_id, card);
    }
    
    /**
     * Site Card 제거
     * @param {string} siteId
     */
    _removeSiteCard(siteId) {
        const card = this.siteCards.get(siteId);
        if (card) {
            card.destroy();
            this.siteCards.delete(siteId);
        }
    }
    
    /**
     * Site Card 업데이트
     * @param {string} siteId
     * @param {Object} site
     */
    _updateSiteCard(siteId, site) {
        const card = this.siteCards.get(siteId);
        if (card) {
            card.update(site);
        }
    }
    
    // =========================================================
    // WebSocket Management
    // =========================================================
    
    /**
     * WebSocket 연결 (Summary Mode)
     */
    async _connectWebSocket() {
        // Mock 모드면 스킵
        if (this.summaryService.options.useMock) {
            console.log('🎭 [DashboardManager] Mock mode - WebSocket skipped');
            return;
        }
        
        try {
            const wsUrl = this.summaryService.getWebSocketUrl();
            console.log(`🔌 WebSocket 연결 시도: ${wsUrl}`);
            
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('✅ WebSocket 연결 성공');
                this.wsReconnectAttempts = 0;
                this.state.setWsConnected(true);
            };
            
            this.wsConnection.onmessage = (event) => {
                this._handleWebSocketMessage(event);
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('❌ WebSocket 에러:', error);
            };
            
            this.wsConnection.onclose = (event) => {
                console.log(`🔌 WebSocket 연결 종료 (code: ${event.code})`);
                this.state.setWsConnected(false);
                
                // 자동 재연결 (정상 종료 아닌 경우, Mock 모드 아닐 때)
                if (event.code !== 1000 && !this.summaryService.options.useMock) {
                    this._scheduleReconnect();
                }
            };
            
        } catch (error) {
            console.error('❌ WebSocket 연결 실패:', error);
            this.state.setWsConnected(false);
            
            // Mock 모드 아닐 때만 재연결
            if (!this.summaryService.options.useMock) {
                this._scheduleReconnect();
            }
        }
    }
    
    /**
     * WebSocket 메시지 처리
     * @param {MessageEvent} event
     */
    _handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📩 WebSocket 메시지:', message.type);
            
            switch (message.type) {
                case 'summary_update':
                    this._handleSummaryUpdate(message.data);
                    break;
                case 'site_status':
                    this._handleSiteStatus(message.data);
                    break;
                case 'alert':
                    this._handleAlert(message);
                    break;
                default:
                    console.log(`Unknown message type: ${message.type}`);
            }
            
        } catch (error) {
            console.error('WebSocket 메시지 파싱 실패:', error);
        }
    }
    
    /**
     * Summary 업데이트 처리
     * @param {Object} data
     */
    _handleSummaryUpdate(data) {
        if (!data || !data.site_id) return;
        
        const siteId = data.site_id;
        if (this.state.sitesMap.has(siteId)) {
            this.state.updateSiteStats(siteId, data.stats);
        }
    }
    
    /**
     * Site 상태 업데이트 처리
     * @param {Object} data
     */
    _handleSiteStatus(data) {
        if (!data || !data.site_id) return;
        
        const siteId = data.site_id;
        if (this.state.sitesMap.has(siteId)) {
            this.state.setSite({
                ...this.state.sitesMap.get(siteId),
                status: data.status
            });
        }
    }
    
    /**
     * Alert 처리
     * @param {Object} message
     */
    _handleAlert(message) {
        if (this.alertBanner) {
            this.alertBanner.show({
                type: message.severity || 'warning',
                message: message.message,
                siteId: message.site_id
            });
        }
    }
    
    /**
     * 재연결 스케줄링 (Exponential Backoff)
     */
    _scheduleReconnect() {
        // Mock 모드면 재연결 안함
        if (this.summaryService.options.useMock) {
            return;
        }
        
        if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ 최대 재연결 시도 횟수 초과');
            this.alertBanner?.show({
                type: 'error',
                message: 'WebSocket 연결 실패. 페이지를 새로고침해주세요.'
            });
            return;
        }
        
        const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
        console.log(`🔄 ${delay/1000}초 후 재연결 시도... (${this.wsReconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        
        this.wsReconnectTimer = setTimeout(() => {
            this.wsReconnectAttempts++;
            this._connectWebSocket();
        }, delay);
    }
    
    // =========================================================
    // Update Interval
    // =========================================================
    
    /**
     * 주기적 업데이트 시작
     */
    _startUpdateInterval() {
        this.updateInterval = setInterval(async () => {
            await this._refreshSites();
        }, this.updateIntervalMs);
    }
    
    /**
     * Site 데이터 새로고침
     */
    async _refreshSites() {
        try {
            const sites = await this.summaryService.fetchSitesSummary();
            
            if (sites && sites.length > 0) {
                sites.forEach(site => {
                    if (this.state.sitesMap.has(site.site_id)) {
                        this.state.setSite(site);
                    }
                });
            }
            
        } catch (error) {
            console.error('❌ Site 새로고침 실패:', error);
        }
    }
    
    // =========================================================
    // Event Handlers
    // =========================================================
    
    /**
     * Mode 선택 핸들러
     * @param {Object} params
     */
    async _handleModeSelect({ siteId, mode, action }) {
        console.log(`🎯 Mode 선택: ${siteId} → ${mode} (${action})`);
        
        try {
            await this.modeTransition.transitionTo(mode, siteId, action);
        } catch (error) {
            console.error('❌ Mode 전환 실패:', error);
            this._showToast({
                type: 'error',
                message: `Mode 전환 실패: ${error.message}`
            });
        }
    }
    
    /**
     * 재연결 시도 핸들러
     * @param {string} siteId
     */
    async _handleRetryConnection(siteId) {
        console.log(`🔄 재연결 시도: ${siteId}`);
        
        try {
            const result = await this.summaryService.reconnectSite(siteId);
            
            if (result.success) {
                this._showToast({
                    type: 'success',
                    message: `${siteId} 연결 성공`
                });
                
                // 데이터 새로고침
                await this._refreshSites();
            } else {
                this._showToast({
                    type: 'error',
                    message: result.message || '재연결 실패'
                });
            }
            
        } catch (error) {
            console.error('❌ 재연결 실패:', error);
            this._showToast({
                type: 'error',
                message: `재연결 실패: ${error.message}`
            });
        }
    }
    
    // =========================================================
    // UI Helpers
    // =========================================================
    
    /**
     * Loading 표시 토글
     * @param {boolean} show
     */
    _showLoading(show) {
        const CSS = DashboardManager.CSS;
        const loading = document.getElementById('dashboard-loading');
        const container = document.getElementById('site-cards-container');
        
        if (loading) {
            loading.classList.toggle(CSS.HIDDEN, !show);
        }
        if (container) {
            container.classList.toggle(CSS.HIDDEN, show);
        }
    }
    
    /**
     * Empty 상태 표시
     * @param {boolean} show
     */
    _showEmpty(show) {
        const CSS = DashboardManager.CSS;
        const empty = document.getElementById('dashboard-empty');
        const loading = document.getElementById('dashboard-loading');
        
        if (empty) {
            empty.classList.toggle(CSS.HIDDEN, !show);
        }
        if (loading) {
            loading.classList.add(CSS.HIDDEN);
        }
    }
    
    /**
     * 에러 표시 (Design Token 사용)
     * @param {Error} error
     */
    _showError(error) {
        const CSS = DashboardManager.CSS;
        const loading = document.getElementById('dashboard-loading');
        
        if (loading) {
            loading.innerHTML = `
                <div class="${CSS.ERROR_CONTAINER}">
                    <div class="${CSS.ERROR_ICON}">⚠️</div>
                    <h3 class="${CSS.ERROR_TITLE}">데이터 로드 실패</h3>
                    <p class="${CSS.ERROR_MESSAGE}">
                        ${error.message || '서버 연결을 확인해주세요.'}
                    </p>
                    <button class="${CSS.ERROR_BUTTON}" onclick="location.reload()">
                        🔄 새로고침
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * 연결 상태 인디케이터 업데이트
     * @param {boolean} connected
     */
    _updateConnectionIndicator(connected) {
        const CSS = DashboardManager.CSS;
        const indicator = document.getElementById('connection-indicator');
        if (!indicator) return;
        
        const dot = indicator.querySelector(`.${CSS.CONNECTION_DOT}`);
        const text = indicator.querySelector(`.${CSS.CONNECTION_TEXT}`);
        
        if (dot) {
            dot.classList.toggle(CSS.CONNECTION_DISCONNECTED, !connected);
        }
        if (text) {
            text.textContent = connected ? '실시간 연결됨' : '연결 끊김';
        }
    }
    
    /**
     * Toast 알림 표시 (Design Token 사용)
     * @param {Object} options
     */
    _showToast({ type, message, duration = 3000 }) {
        const CSS = DashboardManager.CSS;
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        // Toast 타입별 클래스
        const typeClass = {
            success: CSS.TOAST_SUCCESS,
            error: CSS.TOAST_ERROR,
            info: CSS.TOAST_INFO
        }[type] || CSS.TOAST_INFO;
        
        // Toast 아이콘
        const icon = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        }[type] || 'ℹ️';
        
        const toast = document.createElement('div');
        toast.className = `${CSS.TOAST} ${typeClass}`;
        toast.innerHTML = `
            <span class="${CSS.TOAST_ICON}">${icon}</span>
            <span class="${CSS.TOAST_MESSAGE}">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('toast--fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // =========================================================
    // Cleanup
    // =========================================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        // WebSocket 정리
        if (this.wsConnection) {
            this.wsConnection.close(1000);
            this.wsConnection = null;
        }
        
        // 타이머 정리
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // 컴포넌트 정리
        this.siteCards.forEach(card => card.destroy());
        this.siteCards.clear();
        
        if (this.summaryFooter) {
            this.summaryFooter.destroy();
        }
        if (this.alertBanner) {
            this.alertBanner.destroy();
        }
        
        // 상태 초기화
        this.state.reset();
        
        this._initialized = false;
        console.log('🧹 DashboardManager 정리 완료');
    }
}

export default DashboardManager;