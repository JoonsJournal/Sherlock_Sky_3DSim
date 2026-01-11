/**
 * StatusBar.js
 * ============
 * Cleanroom Sidebar Theme - 하단 상태바 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 2.0.0
 * @created 2026-01-11
 * @updated 2026-01-11 - 호환성 개선, CSS 변수 통일
 * 
 * @description
 * - NET, API, DB 연결 상태 표시
 * - FPS, Memory 성능 표시 (perf-bar 게이지)
 * - Site/Country 정보 표시
 * - ConnectionStatusService, PerformanceMonitor 연동
 * 
 * 의존성:
 * - ConnectionStatusService (services)
 * - PerformanceMonitor (core/utils)
 * - EventBus (core/managers)
 * 
 * 사용법:
 *   import { StatusBar } from './StatusBar.js';
 *   const statusBar = new StatusBar({
 *       connectionStatusService: connectionService,
 *       performanceMonitor: perfMonitor,
 *       eventBus: eventBus,
 *       countryCode: 'KR'
 *   });
 * 
 * 파일 위치: frontend/threejs_viewer/src/ui/sidebar/StatusBar.js
 */

// ============================================
// Constants
// ============================================

const STATUS_UPDATE_INTERVAL = 2000; // 2초마다 업데이트

/** 성능 임계값 */
const PERFORMANCE_THRESHOLDS = {
    fps: {
        good: 50,      // 50+ fps = green
        warning: 30,   // 30-49 fps = yellow
        critical: 15   // <30 fps = red
    },
    memory: {
        good: 256,     // <256MB = green
        warning: 512,  // 256-512MB = yellow
        critical: 1024 // >512MB = red
    }
};

// ============================================
// StatusBar Class
// ============================================

export class StatusBar {
    /**
     * @param {Object} options
     * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
     * @param {Object} options.performanceMonitor - PerformanceMonitor 인스턴스
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {string} options.siteId - 현재 사이트 ID
     * @param {string} options.countryCode - 국가 코드 (기본: KR)
     * @param {HTMLElement} options.container - 상태바를 추가할 컨테이너 (기본: document.body)
     */
    constructor(options = {}) {
        this.connectionStatusService = options.connectionStatusService || null;
        this.performanceMonitor = options.performanceMonitor || null;
        this.eventBus = options.eventBus || null;
        this.siteId = options.siteId || null;
        this.siteName = options.siteName || null;
        this.countryCode = options.countryCode || 'KR';
        this.container = options.container || document.body;
        
        // 상태
        this.state = {
            isNetOnline: navigator.onLine,
            isApiConnected: false,
            isDbConnected: false,
            fps: 60,
            memoryUsage: 128, // MB
            maxMemory: 512    // 가정: 최대 512MB
        };
        
        // DOM 참조
        this.element = null;
        this.elements = {}; // DOM 요소 캐시
        
        // 타이머
        this._updateInterval = null;
        this._eventUnsubscribers = [];
        
        // 초기화
        this._init();
    }
    
    // ========================================
    // Initialization
    // ========================================
    
    _init() {
        this._createDOM();
        this._cacheElements();
        this._setupEventListeners();
        this._startUpdateLoop();
        this._updateInitialState();
        
        console.log('[StatusBar] 초기화 완료');
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    _createDOM() {
        // 기존 상태바가 있으면 제거
        const existing = document.querySelector('.status-bar');
        if (existing) existing.remove();
        
        this.element = document.createElement('footer');
        this.element.className = 'status-bar';
        this.element.innerHTML = `
            <!-- 왼쪽 그룹: 연결 상태 -->
            <div class="status-group">
                <!-- Country Code -->
                <div class="status-item">
                    <span class="country-code" id="status-country">${this.countryCode}</span>
                </div>
                
                <!-- Network Status -->
                <div class="status-item" id="status-net-item">
                    <span class="status-dot connected" id="net-dot"></span>
                    <span class="status-label">NET</span>
                    <span class="status-value" id="net-value">Online</span>
                </div>
                
                <!-- API Status -->
                <div class="status-item" id="status-api-item">
                    <span class="status-dot disconnected" id="api-dot"></span>
                    <span class="status-label">API</span>
                    <span class="status-value" id="api-value">Disconnected</span>
                </div>
                
                <!-- Database Status -->
                <div class="status-item" id="status-db-item">
                    <span class="status-dot disconnected" id="db-dot"></span>
                    <span class="status-label">DB</span>
                    <span class="status-value" id="db-value">None</span>
                </div>
            </div>
            
            <!-- 오른쪽 그룹: 성능 지표 -->
            <div class="status-group">
                <!-- FPS -->
                <div class="status-item" id="status-fps-item">
                    <span class="status-label">FPS</span>
                    <span class="status-value" id="fps-value">60</span>
                    <div class="perf-bar">
                        <div class="perf-bar-fill good" id="fps-bar" style="width: 100%;"></div>
                    </div>
                </div>
                
                <!-- Memory -->
                <div class="status-item" id="status-mem-item">
                    <span class="status-label">MEM</span>
                    <span class="status-value"><span id="memory-value">128</span>MB</span>
                    <div class="perf-bar">
                        <div class="perf-bar-fill good" id="memory-bar" style="width: 30%;"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.appendChild(this.element);
    }
    
    /**
     * DOM 요소 캐싱 (성능 최적화)
     * @private
     */
    _cacheElements() {
        this.elements = {
            // Country
            country: document.getElementById('status-country'),
            // Network
            netDot: document.getElementById('net-dot'),
            netValue: document.getElementById('net-value'),
            // API
            apiDot: document.getElementById('api-dot'),
            apiValue: document.getElementById('api-value'),
            // Database
            dbDot: document.getElementById('db-dot'),
            dbValue: document.getElementById('db-value'),
            // Performance
            fpsValue: document.getElementById('fps-value'),
            fpsBar: document.getElementById('fps-bar'),
            memValue: document.getElementById('memory-value'),
            memBar: document.getElementById('memory-bar')
        };
    }
    
    // ========================================
    // Event Listeners
    // ========================================
    
    _setupEventListeners() {
        // 브라우저 네트워크 상태 변경
        const onlineHandler = () => this._updateNetStatus(true);
        const offlineHandler = () => this._updateNetStatus(false);
        
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);
        
        // 정리용 저장
        this._eventUnsubscribers.push(() => {
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);
        });
        
        // ConnectionStatusService 연동
        if (this.connectionStatusService) {
            try {
                const unsubOnline = this.connectionStatusService.onOnline(() => {
                    this._updateApiStatus(true);
                });
                if (unsubOnline) this._eventUnsubscribers.push(unsubOnline);
                
                const unsubOffline = this.connectionStatusService.onOffline(() => {
                    this._updateApiStatus(false);
                });
                if (unsubOffline) this._eventUnsubscribers.push(unsubOffline);
            } catch (e) {
                console.warn('[StatusBar] ConnectionStatusService 연동 실패:', e.message);
            }
        }
        
        // EventBus 연동 (사이트 연결 이벤트)
        if (this.eventBus) {
            try {
                // 사이트 연결됨
                const unsubSiteConnected = this.eventBus.on('site:connected', (data) => {
                    this._updateDbStatus(true, data?.siteId, data?.siteName);
                });
                if (unsubSiteConnected) this._eventUnsubscribers.push(unsubSiteConnected);
                
                // 사이트 연결 해제됨
                const unsubSiteDisconnected = this.eventBus.on('site:disconnected', () => {
                    this._updateDbStatus(false, null, null);
                });
                if (unsubSiteDisconnected) this._eventUnsubscribers.push(unsubSiteDisconnected);
                
                // API 상태 변경 (ConnectionModal에서 발생)
                const unsubApiConnected = this.eventBus.on('api:connected', () => {
                    this._updateApiStatus(true);
                });
                if (unsubApiConnected) this._eventUnsubscribers.push(unsubApiConnected);
                
                const unsubApiDisconnected = this.eventBus.on('api:disconnected', () => {
                    this._updateApiStatus(false);
                });
                if (unsubApiDisconnected) this._eventUnsubscribers.push(unsubApiDisconnected);
                
            } catch (e) {
                console.warn('[StatusBar] EventBus 연동 실패:', e.message);
            }
        }
    }
    
    /**
     * 초기 상태 업데이트
     * @private
     */
    _updateInitialState() {
        // 네트워크 상태
        this._updateNetStatus(navigator.onLine);
        
        // ConnectionStatusService에서 초기 상태 가져오기
        if (this.connectionStatusService) {
            try {
                const isOnline = this.connectionStatusService.isOnline?.() || false;
                this._updateApiStatus(isOnline);
            } catch (e) {
                // 서비스가 준비되지 않았을 수 있음
            }
        }
    }
    
    // ========================================
    // Update Loop
    // ========================================
    
    _startUpdateLoop() {
        this._updateInterval = setInterval(() => {
            this._updatePerformanceStats();
        }, STATUS_UPDATE_INTERVAL);
        
        // 즉시 첫 번째 업데이트
        this._updatePerformanceStats();
    }
    
    _updatePerformanceStats() {
        // FPS 업데이트
        if (this.performanceMonitor) {
            // PerformanceMonitor.metrics.fps 또는 getFPS() 메서드 사용
            if (typeof this.performanceMonitor.getFPS === 'function') {
                this.state.fps = this.performanceMonitor.getFPS();
            } else if (this.performanceMonitor.metrics?.fps !== undefined) {
                this.state.fps = this.performanceMonitor.metrics.fps;
            }
        } else {
            // 시뮬레이션 (PerformanceMonitor 없을 때)
            this.state.fps = 58 + Math.floor(Math.random() * 5);
        }
        
        // Memory 업데이트
        if (performance.memory) {
            this.state.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        } else {
            // 시뮬레이션 (memory API 지원 안 할 때)
            this.state.memoryUsage = 128 + Math.floor((Math.random() - 0.5) * 20);
        }
        
        // DOM 업데이트
        this._updateFpsDisplay();
        this._updateMemoryDisplay();
    }
    
    // ========================================
    // Status Updates (Private)
    // ========================================
    
    /**
     * 네트워크 상태 업데이트
     * @private
     */
    _updateNetStatus(isOnline) {
        this.state.isNetOnline = isOnline;
        
        const { netDot, netValue } = this.elements;
        
        if (netDot) {
            netDot.className = `status-dot ${isOnline ? 'connected' : 'disconnected'}`;
        }
        if (netValue) {
            netValue.textContent = isOnline ? 'Online' : 'Offline';
        }
    }
    
    /**
     * API 연결 상태 업데이트
     * @private
     */
    _updateApiStatus(isConnected) {
        this.state.isApiConnected = isConnected;
        
        const { apiDot, apiValue } = this.elements;
        
        if (apiDot) {
            apiDot.className = `status-dot ${isConnected ? 'connected' : 'disconnected'}`;
        }
        if (apiValue) {
            apiValue.textContent = isConnected ? 'Connected' : 'Disconnected';
        }
    }
    
    /**
     * DB 연결 상태 업데이트
     * @private
     */
    _updateDbStatus(isConnected, siteId = null, siteName = null) {
        this.state.isDbConnected = isConnected;
        this.siteId = siteId;
        this.siteName = siteName;
        
        const { dbDot, dbValue } = this.elements;
        
        if (dbDot) {
            dbDot.className = `status-dot ${isConnected ? 'connected' : 'disconnected'}`;
        }
        if (dbValue) {
            if (isConnected && siteId) {
                // siteId를 표시용으로 변환 (kr_b_01 → KR-B-01)
                const displayId = siteId.replace(/_/g, '-').toUpperCase();
                dbValue.textContent = displayId;
                dbValue.title = siteName || siteId; // 툴팁으로 전체 이름
            } else {
                dbValue.textContent = 'None';
                dbValue.title = '';
            }
        }
    }
    
    /**
     * FPS 디스플레이 업데이트
     * @private
     */
    _updateFpsDisplay() {
        const { fpsValue, fpsBar } = this.elements;
        const fps = this.state.fps;
        
        if (fpsValue) {
            fpsValue.textContent = fps;
        }
        
        if (fpsBar) {
            // 60fps 기준으로 퍼센트 계산
            const percent = Math.min((fps / 60) * 100, 100);
            fpsBar.style.width = `${percent}%`;
            
            // 색상 클래스 결정
            fpsBar.className = 'perf-bar-fill';
            if (fps >= PERFORMANCE_THRESHOLDS.fps.good) {
                fpsBar.classList.add('good');
            } else if (fps >= PERFORMANCE_THRESHOLDS.fps.warning) {
                fpsBar.classList.add('warning');
            } else {
                fpsBar.classList.add('critical');
            }
        }
    }
    
    /**
     * Memory 디스플레이 업데이트
     * @private
     */
    _updateMemoryDisplay() {
        const { memValue, memBar } = this.elements;
        const memory = this.state.memoryUsage;
        const maxMemory = this.state.maxMemory;
        
        if (memValue) {
            memValue.textContent = memory;
        }
        
        if (memBar) {
            const percent = Math.min((memory / maxMemory) * 100, 100);
            memBar.style.width = `${percent}%`;
            
            // 색상 클래스 결정
            memBar.className = 'perf-bar-fill';
            if (memory < PERFORMANCE_THRESHOLDS.memory.good) {
                memBar.classList.add('good');
            } else if (memory < PERFORMANCE_THRESHOLDS.memory.warning) {
                memBar.classList.add('warning');
            } else {
                memBar.classList.add('critical');
            }
        }
    }
    
    // ========================================
    // Public API
    // ========================================
    
    /**
     * Country Code 설정
     * @param {string} code - 국가 코드 (예: KR, VN, US)
     */
    setCountryCode(code) {
        this.countryCode = code;
        if (this.elements.country) {
            this.elements.country.textContent = code;
        }
    }
    
    /**
     * API 연결 상태 수동 설정
     * @param {boolean} connected
     */
    setApiConnected(connected) {
        this._updateApiStatus(connected);
    }
    
    /**
     * DB 연결 상태 수동 설정
     * @param {boolean} connected
     * @param {string} siteId - 사이트 ID
     * @param {string} siteName - 사이트 표시 이름
     */
    setDbConnected(connected, siteId = null, siteName = null) {
        this._updateDbStatus(connected, siteId, siteName);
    }
    
    /**
     * PerformanceMonitor 설정/교체
     * @param {Object} monitor - PerformanceMonitor 인스턴스
     */
    setPerformanceMonitor(monitor) {
        this.performanceMonitor = monitor;
    }
    
    /**
     * ConnectionStatusService 설정/교체
     * @param {Object} service - ConnectionStatusService 인스턴스
     */
    setConnectionStatusService(service) {
        this.connectionStatusService = service;
        // 이벤트 재연결이 필요하면 여기서 처리
    }
    
    /**
     * 현재 상태 가져오기
     * @returns {Object} 현재 상태 객체
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * 표시/숨김
     * @param {boolean} visible
     */
    setVisible(visible) {
        if (this.element) {
            this.element.style.display = visible ? 'flex' : 'none';
        }
    }
    
    /**
     * Compact 모드 토글 (좁은 화면용)
     * @param {boolean} compact
     */
    setCompact(compact) {
        if (this.element) {
            this.element.classList.toggle('compact', compact);
        }
    }
    
    /**
     * 연결 상태 일괄 업데이트
     * @param {Object} status - { api: boolean, db: boolean, siteId: string }
     */
    updateConnectionStatus(status = {}) {
        if (status.api !== undefined) {
            this._updateApiStatus(status.api);
        }
        if (status.db !== undefined) {
            this._updateDbStatus(status.db, status.siteId, status.siteName);
        }
    }
    
    /**
     * 성능 지표 수동 업데이트
     * @param {number} fps - FPS 값
     * @param {number} memory - 메모리 사용량 (MB)
     */
    updatePerformance(fps, memory) {
        if (fps !== undefined) {
            this.state.fps = fps;
            this._updateFpsDisplay();
        }
        if (memory !== undefined) {
            this.state.memoryUsage = memory;
            this._updateMemoryDisplay();
        }
    }
    
    /**
     * 즉시 상태 새로고침
     */
    refresh() {
        this._updatePerformanceStats();
    }
    
    // ========================================
    // Cleanup
    // ========================================
    
    /**
     * 정리 (destroy)
     */
    destroy() {
        // 업데이트 루프 정지
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
        
        // 이벤트 리스너 정리
        this._eventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (e) {
                    // 이미 정리되었을 수 있음
                }
            }
        });
        this._eventUnsubscribers = [];
        
        // DOM 제거
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        // 참조 정리
        this.elements = {};
        
        console.log('[StatusBar] 정리 완료');
    }
}

// ============================================
// CSS Styles (Inline for standalone usage)
// ============================================

/**
 * StatusBar에 필요한 CSS를 동적으로 주입
 * 이미 variables.css에 포함되어 있다면 호출하지 않아도 됨
 */
export function injectStatusBarStyles() {
    if (document.getElementById('statusbar-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'statusbar-styles';
    style.textContent = `
        /* =============================================
           StatusBar Styles (from test_sidebar_standalone.html v2.10)
           ============================================= */
        
        .status-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: var(--status-bar-height, 36px);
            background-color: var(--bg-sidebar, #0F172A);
            border-top: 1px solid var(--border-color, rgba(255,255,255,0.1));
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            z-index: 20;
        }
        
        .status-group {
            display: flex;
            gap: 16px;
            align-items: center;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: var(--bg-input, rgba(255,255,255,0.05));
            border-radius: 4px;
        }
        
        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        
        .status-dot.connected {
            background-color: var(--text-success, #4ADE80);
            box-shadow: 0 0 4px var(--text-success, #4ADE80);
        }
        
        .status-dot.disconnected {
            background-color: var(--text-alarm, #F87171);
            box-shadow: 0 0 4px var(--text-alarm, #F87171);
        }
        
        .status-label {
            color: var(--text-muted, #6B7280);
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status-value {
            color: var(--text-normal, #CBD5E1);
            font-weight: 500;
        }
        
        .perf-bar {
            width: 35px;
            height: 4px;
            background: var(--bg-input, rgba(255,255,255,0.05));
            border-radius: 2px;
            overflow: hidden;
        }
        
        .perf-bar-fill {
            height: 100%;
            border-radius: 2px;
            transition: width 0.3s ease, background-color 0.3s ease;
        }
        
        .perf-bar-fill.good {
            background: var(--text-success, #4ADE80);
        }
        
        .perf-bar-fill.warning {
            background: var(--text-warning, #FBBF24);
        }
        
        .perf-bar-fill.critical {
            background: var(--text-alarm, #F87171);
        }
        
        .country-code {
            font-weight: 700;
            font-size: 12px;
            color: var(--icon-selected, #06B6D4);
            letter-spacing: 1px;
        }
        
        /* Compact Mode (좁은 화면용) */
        .status-bar.compact {
            height: 28px;
            padding: 0 8px;
            font-size: 10px;
        }
        
        .status-bar.compact .status-group {
            gap: 8px;
        }
        
        .status-bar.compact .status-item {
            padding: 2px 6px;
            gap: 4px;
        }
        
        .status-bar.compact .status-label {
            display: none;
        }
        
        .status-bar.compact .perf-bar {
            width: 25px;
        }
        
        .status-bar.compact .country-code {
            font-size: 10px;
        }
        
        /* Hidden Mode */
        .status-bar.hidden {
            display: none !important;
        }
    `;
    
    document.head.appendChild(style);
}

// ============================================
// Factory Function
// ============================================

/**
 * StatusBar 인스턴스 생성 팩토리 함수
 * @param {Object} options - StatusBar 옵션
 * @returns {StatusBar}
 */
export function createStatusBar(options = {}) {
    // CSS 자동 주입 (필요 시)
    if (options.injectStyles !== false) {
        injectStatusBarStyles();
    }
    
    return new StatusBar(options);
}

// ============================================
// Default Export
// ============================================

export default StatusBar;