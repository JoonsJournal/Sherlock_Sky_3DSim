/**
 * StatusBar.js
 * ============
 * Cleanroom Sidebar Theme - 하단 상태바 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 2.4.0
 * @created 2026-01-11
 * @updated 2026-01-21
 * 
 * @changelog
 * - v2.4.0: 🆕 StatusBarPerformanceCompact 통합 (2026-01-21)
 *           - 기존 FPS/MEM 표시 제거
 *           - StatusBarPerformanceCompact 컴포넌트로 대체
 *           - 실시간 Network, Cache 통계 표시
 * - v2.3.1: 🔧 장비 상태 수정 (2026-01-14)
 *           - UNKNOWN → DISCONNECTED로 변경
 *           - SUDDENSTOP 상태 추가 (깜빡임)
 *           - 상태 5개: RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED
 * - v2.3.0: 🔧 인라인 CSS 제거, 외부 CSS로 통합 (2026-01-14)
 *           - injectStatusBarStyles() 함수 삭제
 *           - _status-bar.css 사용 (v2.0.0)
 *           - createStatusBar() injectStyles 옵션 제거
 * - v2.2.0: 🆕 Monitoring Stats Panel 추가 (2026-01-12)
 * - v2.1.0: 🔧 UI 간소화 (2026-01-11)
 * - v2.0.0: 호환성 개선, CSS 변수 통일
 * 
 * @description
 * - NET, API, DB 연결 상태 표시
 * - 🆕 Monitoring Stats 패널 (조건부 표시)
 *   - 총 장비, 매핑 상태, 매핑률
 *   - 상태별 카운트: RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED
 * - 🆕 v2.4.0: StatusBarPerformanceCompact 통합
 *   - FPS, Memory, Draw Calls, Frame Time
 *   - Network Latency, Messages In/Out
 *   - Cache Hit Rate, Delta Updates
 * - Site/Country 정보 표시
 * 
 * 의존성:
 * - ConnectionStatusService (services)
 * - EventBus (core/managers)
 * - MonitoringService (선택, stats 연동용)
 * - EquipmentEditState (선택, 매핑 상태용)
 * - _status-bar.css (필수, 외부 CSS)
 * - 🆕 StatusBarPerformanceCompact (ui/statusbar)
 * - 🆕 _statusbar-performance.css (필수)
 * 
 * 사용법:
 *   import { StatusBar } from './StatusBar.js';
 *   const statusBar = new StatusBar({
 *       connectionStatusService: connectionService,
 *       eventBus: eventBus,
 *       countryCode: 'KR'
 *   });
 * 
 * 파일 위치: frontend/threejs_viewer/src/ui/sidebar/StatusBar.js
 */

import { StatusBarPerformanceCompact } from '../statusbar/StatusBarPerformanceCompact.js';

// ============================================
// Constants
// ============================================

const STATUS_UPDATE_INTERVAL = 2000; // 2초마다 업데이트

/** 🆕 v2.2.0: Monitoring Stats 표시 조건 */
const MONITORING_STATS_VISIBLE_SUBMODES = ['3d-view', 'ranking-view'];

// ============================================
// StatusBar Class
// ============================================

export class StatusBar {
    /**
     * @param {Object} options
     * @param {Object} options.connectionStatusService - ConnectionStatusService 인스턴스
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {string} options.siteId - 현재 사이트 ID
     * @param {string} options.countryCode - 국가 코드 (기본: KR)
     * @param {HTMLElement} options.container - 상태바를 추가할 컨테이너 (기본: document.body)
     * @param {number} options.totalEquipment - 🆕 총 장비 수 (기본: 117)
     */
    constructor(options = {}) {
        this.connectionStatusService = options.connectionStatusService || null;
        this.eventBus = options.eventBus || null;
        this.siteId = options.siteId || null;
        this.siteName = options.siteName || null;
        this.countryCode = options.countryCode || 'KR';
        this.container = options.container || document.body;
        
        // 🆕 v2.2.0: 외부 서비스 참조 (나중에 설정 가능)
        this.monitoringService = options.monitoringService || null;
        this.equipmentEditState = options.equipmentEditState || null;
        
        // 상태
        this.state = {
            isNetOnline: navigator.onLine,
            isApiConnected: false,
            isDbConnected: false
        };
        
        // 🔧 v2.3.1: Monitoring Stats 상태 (5개 상태)
        this.monitoringStats = {
            totalEquipment: options.totalEquipment || 117,
            mapped: 0,
            unmapped: options.totalEquipment || 117,
            mappingRate: 0,
            statusCounts: {
                run: 0,           // 녹색 (RUN)
                idle: 0,          // 노란색 (IDLE)
                stop: 0,          // 빨간색 (STOP)
                suddenstop: 0,    // 🆕 빨간색 깜빡임 (SUDDENSTOP)
                disconnected: 0   // 🔧 회색 (DISCONNECTED, 이전 unknown)
            }
        };
        
        // 🆕 v2.2.0: 현재 모드 추적
        this.currentMode = null;
        this.currentSubMode = null;
        
        // DOM 참조
        this.element = null;
        this.elements = {}; // DOM 요소 캐시
        
        // 🆕 v2.4.0: Performance 컴포넌트 참조
        this._perfCompact = null;
        
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
        this._initPerformanceSection();  // 🆕 v2.4.0
        
        console.log('[StatusBar] 초기화 완료 (v2.4.0 - Performance Compact 통합)');
    }

    /**
     * 🆕 v2.4.0: Performance 섹션 초기화
     * StatusBarPerformanceCompact 컴포넌트 추가
     * @private
     */
    _initPerformanceSection() {
        // 오른쪽 그룹 컨테이너 찾기
        const rightGroup = this.element.querySelector('.status-group-right');
        
        if (rightGroup) {
            try {
                // Performance 컴포넌트 추가
                this._perfCompact = new StatusBarPerformanceCompact(rightGroup, {
                    showAlerts: true,
                    compact: false
                });
                
                console.log('[StatusBar] ✅ StatusBarPerformanceCompact 초기화 완료');
            } catch (e) {
                console.warn('[StatusBar] ⚠️ StatusBarPerformanceCompact 초기화 실패:', e.message);
            }
        }
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    /**
     * 🔧 v2.4.0: 기존 FPS/MEM HTML 제거
     * 🔧 v2.3.1: SUDDENSTOP, DISCONNECTED 추가
     * 🔧 v2.2.0: Monitoring Stats 섹션 추가
     */
    _createDOM() {
        // 기존 상태바가 있으면 제거
        const existing = document.querySelector('.status-bar');
        if (existing) existing.remove();
        
        this.element = document.createElement('footer');
        this.element.className = 'status-bar';
        this.element.innerHTML = `
            <!-- 왼쪽 그룹: 연결 상태 -->
            <div class="status-group status-group-left">
                <!-- Country Code -->
                <div class="status-item">
                    <span class="country-code" id="status-country">${this.countryCode}</span>
                </div>
                
                <!-- Network Status -->
                <div class="status-item" id="status-net-item">
                    <span class="status-dot connected" id="net-dot"></span>
                    <span class="status-label">NET</span>
                </div>
                
                <!-- API Status -->
                <div class="status-item" id="status-api-item">
                    <span class="status-dot disconnected" id="api-dot"></span>
                    <span class="status-label">API</span>
                </div>
                
                <!-- Database Status -->
                <div class="status-item" id="status-db-item">
                    <span class="status-dot disconnected" id="db-dot"></span>
                    <span class="status-label">DB</span>
                    <span class="status-value status-db-name" id="db-value"></span>
                </div>
            </div>
            
            <!-- 🆕 v2.2.0: 가운데 그룹 - Monitoring Stats (조건부 표시) -->
            <div class="status-group monitoring-stats-group" id="monitoring-stats-group" style="display: none;">
                <!-- 총 장비 수 -->
                <div class="status-item monitoring-stat-item">
                    <span class="monitoring-stat-icon">📊</span>
                    <span class="monitoring-stat-value" id="stats-total">${this.monitoringStats.totalEquipment}</span>
                </div>
                
                <!-- 매핑 완료 -->
                <div class="status-item monitoring-stat-item mapped">
                    <span class="monitoring-stat-icon">✅</span>
                    <span class="monitoring-stat-value" id="stats-mapped">${this.monitoringStats.mapped}</span>
                </div>
                
                <!-- 미매핑 (경고) -->
                <div class="status-item monitoring-stat-item unmapped">
                    <span class="monitoring-stat-icon">⚠️</span>
                    <span class="monitoring-stat-value" id="stats-unmapped">${this.monitoringStats.unmapped}</span>
                </div>
                
                <!-- 매핑률 -->
                <div class="status-item monitoring-stat-item rate">
                    <span class="monitoring-stat-icon">📈</span>
                    <span class="monitoring-stat-value" id="stats-rate">${this.monitoringStats.mappingRate}%</span>
                </div>
                
                <!-- 구분선 -->
                <div class="monitoring-stats-divider"></div>
                
                <!-- RUN 상태 (녹색) -->
                <div class="status-item monitoring-stat-item status-run">
                    <span class="status-indicator-dot run"></span>
                    <span class="monitoring-stat-value" id="stats-run">${this.monitoringStats.statusCounts.run}</span>
                </div>
                
                <!-- IDLE 상태 (노란색) -->
                <div class="status-item monitoring-stat-item status-idle">
                    <span class="status-indicator-dot idle"></span>
                    <span class="monitoring-stat-value" id="stats-idle">${this.monitoringStats.statusCounts.idle}</span>
                </div>
                
                <!-- STOP 상태 (빨간색) -->
                <div class="status-item monitoring-stat-item status-stop">
                    <span class="status-indicator-dot stop"></span>
                    <span class="monitoring-stat-value" id="stats-stop">${this.monitoringStats.statusCounts.stop}</span>
                </div>
                
                <!-- 🆕 v2.3.1: SUDDENSTOP 상태 (빨간색 깜빡임) -->
                <div class="status-item monitoring-stat-item status-suddenstop">
                    <span class="status-indicator-dot suddenstop"></span>
                    <span class="monitoring-stat-value" id="stats-suddenstop">${this.monitoringStats.statusCounts.suddenstop}</span>
                </div>
                
                <!-- 🔧 v2.3.1: DISCONNECTED 상태 (회색, 이전 unknown) -->
                <div class="status-item monitoring-stat-item status-disconnected">
                    <span class="status-indicator-dot disconnected"></span>
                    <span class="monitoring-stat-value" id="stats-disconnected">${this.monitoringStats.statusCounts.disconnected}</span>
                </div>
            </div>
            
            <!-- 🔧 v2.4.0: 오른쪽 그룹 - Performance 컴포넌트가 여기에 추가됨 -->
            <div class="status-group status-group-right">
                <!-- StatusBarPerformanceCompact가 _initPerformanceSection()에서 동적으로 추가됨 -->
            </div>
        `;
        
        this.container.appendChild(this.element);
    }
    
    /**
     * DOM 요소 캐싱 (성능 최적화)
     * 🔧 v2.4.0: FPS/Memory 관련 캐싱 제거
     * 🔧 v2.3.1: SUDDENSTOP, DISCONNECTED 요소 추가
     * @private
     */
    _cacheElements() {
        this.elements = {
            // Country
            country: document.getElementById('status-country'),
            // Network
            netDot: document.getElementById('net-dot'),
            // API
            apiDot: document.getElementById('api-dot'),
            // Database
            dbDot: document.getElementById('db-dot'),
            dbValue: document.getElementById('db-value'),
            
            // 🆕 v2.2.0: Monitoring Stats
            monitoringStatsGroup: document.getElementById('monitoring-stats-group'),
            statsTotal: document.getElementById('stats-total'),
            statsMapped: document.getElementById('stats-mapped'),
            statsUnmapped: document.getElementById('stats-unmapped'),
            statsRate: document.getElementById('stats-rate'),
            statsRun: document.getElementById('stats-run'),
            statsIdle: document.getElementById('stats-idle'),
            statsStop: document.getElementById('stats-stop'),
            statsSuddenstop: document.getElementById('stats-suddenstop'),        // 🆕 v2.3.1
            statsDisconnected: document.getElementById('stats-disconnected')    // 🔧 v2.3.1
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
        
        // EventBus 연동
        if (this.eventBus) {
            this._setupEventBusListeners();
        }
    }
    
    /**
     * 🆕 v2.2.0: EventBus 리스너 설정 (모드 변경 감지 포함)
     * @private
     */
    _setupEventBusListeners() {
        if (!this.eventBus) return;
        
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
            
            // API 상태 변경
            const unsubApiConnected = this.eventBus.on('api:connected', () => {
                this._updateApiStatus(true);
            });
            if (unsubApiConnected) this._eventUnsubscribers.push(unsubApiConnected);
            
            const unsubApiDisconnected = this.eventBus.on('api:disconnected', () => {
                this._updateApiStatus(false);
            });
            if (unsubApiDisconnected) this._eventUnsubscribers.push(unsubApiDisconnected);
            
            // 🆕 v2.2.0: 모드 변경 감지
            const unsubModeChange = this.eventBus.on('mode:change', (data) => {
                this.currentMode = this._extractModeKey(data?.to);
                this._updateMonitoringStatsVisibility();
            });
            if (unsubModeChange) this._eventUnsubscribers.push(unsubModeChange);
            
            // 🆕 v2.2.0: 서브모드 변경 감지
            const unsubSubModeChange = this.eventBus.on('submode:change', (data) => {
                this.currentSubMode = data?.submode || data?.to;
                this._updateMonitoringStatsVisibility();
            });
            if (unsubSubModeChange) this._eventUnsubscribers.push(unsubSubModeChange);
            
            // 🆕 v2.2.0: Monitoring Stats 업데이트 이벤트
            const unsubStatsUpdate = this.eventBus.on('monitoring:stats-update', (data) => {
                this.updateMonitoringStats(data);
            });
            if (unsubStatsUpdate) this._eventUnsubscribers.push(unsubStatsUpdate);
            
            // 🆕 v2.2.0: Equipment 매핑 상태 변경
            const unsubMappingUpdate = this.eventBus.on('equipment:mapping-changed', (data) => {
                if (data?.mapped !== undefined) {
                    this.updateMappingStats(data.mapped, data.total);
                }
            });
            if (unsubMappingUpdate) this._eventUnsubscribers.push(unsubMappingUpdate);
            
        } catch (e) {
            console.warn('[StatusBar] EventBus 연동 실패:', e.message);
        }
    }
    
    /**
     * 🆕 v2.2.0: 모드 키 추출 (APP_MODE 값에서 키로 변환)
     * @private
     */
    _extractModeKey(modeValue) {
        // 'monitoring' 또는 APP_MODE.MONITORING 값 처리
        if (!modeValue) return null;
        
        // 이미 키 형태면 그대로 반환
        if (typeof modeValue === 'string') {
            return modeValue.toLowerCase();
        }
        
        return null;
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
        
        // 🆕 v2.2.0: 초기 Monitoring Stats 숨김
        this._updateMonitoringStatsVisibility();
    }
    
    // ========================================
    // Update Loop
    // ========================================
    
    /**
     * 🔧 v2.4.0: 업데이트 루프 간소화
     * Performance 업데이트는 StatusBarPerformanceCompact가 EventBus로 처리
     */
    _startUpdateLoop() {
        this._updateInterval = setInterval(() => {
            // 🔧 v2.4.0: Monitoring Stats만 주기적으로 체크
            // Performance는 StatusBarPerformanceCompact가 자체 처리
        }, STATUS_UPDATE_INTERVAL);
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
        
        const { netDot } = this.elements;
        
        if (netDot) {
            netDot.className = `status-dot ${isOnline ? 'connected' : 'disconnected'}`;
        }
    }
    
    /**
     * API 연결 상태 업데이트
     * @private
     */
    _updateApiStatus(isConnected) {
        this.state.isApiConnected = isConnected;
        
        const { apiDot } = this.elements;
        
        if (apiDot) {
            apiDot.className = `status-dot ${isConnected ? 'connected' : 'disconnected'}`;
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
                const displayId = siteId.replace(/_/g, '-').toUpperCase();
                dbValue.textContent = displayId;
                dbValue.title = siteName || siteId;
            } else {
                dbValue.textContent = '';
                dbValue.title = '';
            }
        }
    }
    
    // ========================================
    // 🆕 v2.2.0: Monitoring Stats Updates
    // ========================================
    
    /**
     * 🆕 v2.2.0: Monitoring Stats 표시/숨김 업데이트
     * Monitoring 모드 + 3d-view/ranking-view에서만 표시
     * @private
     */
    _updateMonitoringStatsVisibility() {
        const { monitoringStatsGroup } = this.elements;
        if (!monitoringStatsGroup) return;
        
        const shouldShow = (
            this.currentMode === 'monitoring' &&
            MONITORING_STATS_VISIBLE_SUBMODES.includes(this.currentSubMode)
        );
        
        monitoringStatsGroup.style.display = shouldShow ? 'flex' : 'none';
        
        // 디버그 로그
        if (shouldShow) {
            console.log(`[StatusBar] Monitoring Stats 표시 (mode: ${this.currentMode}, submode: ${this.currentSubMode})`);
        }
    }
    
    /**
     * 🔧 v2.3.1: Monitoring Stats DOM 업데이트 (SUDDENSTOP, DISCONNECTED 추가)
     * @private
     */
    _updateMonitoringStatsDisplay() {
        const {
            statsTotal,
            statsMapped,
            statsUnmapped,
            statsRate,
            statsRun,
            statsIdle,
            statsStop,
            statsSuddenstop,        // 🆕 v2.3.1
            statsDisconnected       // 🔧 v2.3.1
        } = this.elements;
        
        const stats = this.monitoringStats;
        
        if (statsTotal) statsTotal.textContent = stats.totalEquipment;
        if (statsMapped) statsMapped.textContent = stats.mapped;
        if (statsUnmapped) statsUnmapped.textContent = stats.unmapped;
        if (statsRate) statsRate.textContent = `${stats.mappingRate}%`;
        if (statsRun) statsRun.textContent = stats.statusCounts.run;
        if (statsIdle) statsIdle.textContent = stats.statusCounts.idle;
        if (statsStop) statsStop.textContent = stats.statusCounts.stop;
        if (statsSuddenstop) statsSuddenstop.textContent = stats.statusCounts.suddenstop;           // 🆕 v2.3.1
        if (statsDisconnected) statsDisconnected.textContent = stats.statusCounts.disconnected;     // 🔧 v2.3.1
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
     * ConnectionStatusService 설정/교체
     * @param {Object} service - ConnectionStatusService 인스턴스
     */
    setConnectionStatusService(service) {
        this.connectionStatusService = service;
    }
    
    /**
     * 🆕 v2.2.0: MonitoringService 설정
     * @param {Object} service - MonitoringService 인스턴스
     */
    setMonitoringService(service) {
        this.monitoringService = service;
    }
    
    /**
     * 🆕 v2.2.0: EquipmentEditState 설정
     * @param {Object} state - EquipmentEditState 인스턴스
     */
    setEquipmentEditState(state) {
        this.equipmentEditState = state;
    }
    
    /**
     * 🆕 v2.2.0: 현재 모드 설정 (외부에서 직접 호출 가능)
     * @param {string} mode - 모드 키 (예: 'monitoring', 'layout')
     * @param {string} submode - 서브모드 (예: '3d-view', 'ranking-view')
     */
    setCurrentMode(mode, submode = null) {
        this.currentMode = mode;
        if (submode !== null) {
            this.currentSubMode = submode;
        }
        this._updateMonitoringStatsVisibility();
    }
    
    /**
     * 🆕 v2.2.0: 서브모드만 설정
     * @param {string} submode - 서브모드
     */
    setCurrentSubMode(submode) {
        this.currentSubMode = submode;
        this._updateMonitoringStatsVisibility();
    }
    
    /**
     * 🆕 v2.2.0: Monitoring Stats 전체 업데이트
     * @param {Object} stats - 통계 객체
     * @param {number} stats.total - 총 장비 수
     * @param {number} stats.mapped - 매핑된 장비 수
     * @param {Object} stats.statusCounts - 상태별 카운트 {run, idle, stop, suddenstop, disconnected}
     */
    updateMonitoringStats(stats = {}) {
        if (stats.total !== undefined) {
            this.monitoringStats.totalEquipment = stats.total;
        }
        
        if (stats.mapped !== undefined) {
            this.monitoringStats.mapped = stats.mapped;
            this.monitoringStats.unmapped = this.monitoringStats.totalEquipment - stats.mapped;
            this.monitoringStats.mappingRate = this.monitoringStats.totalEquipment > 0
                ? Math.round((stats.mapped / this.monitoringStats.totalEquipment) * 100)
                : 0;
        }
        
        if (stats.statusCounts) {
            Object.assign(this.monitoringStats.statusCounts, stats.statusCounts);
        }
        
        this._updateMonitoringStatsDisplay();
    }
    
    /**
     * 🆕 v2.2.0: 매핑 통계만 업데이트
     * @param {number} mapped - 매핑된 장비 수
     * @param {number} total - 총 장비 수 (선택, 기본값 유지)
     */
    updateMappingStats(mapped, total = null) {
        if (total !== null) {
            this.monitoringStats.totalEquipment = total;
        }
        
        this.monitoringStats.mapped = mapped;
        this.monitoringStats.unmapped = this.monitoringStats.totalEquipment - mapped;
        this.monitoringStats.mappingRate = this.monitoringStats.totalEquipment > 0
            ? Math.round((mapped / this.monitoringStats.totalEquipment) * 100)
            : 0;
        
        this._updateMonitoringStatsDisplay();
    }
    
    /**
     * 🔧 v2.3.1: 상태별 카운트 업데이트 (SUDDENSTOP, DISCONNECTED 포함)
     * @param {Object} counts - {run, idle, stop, suddenstop, disconnected}
     */
    updateStatusCounts(counts) {
        Object.assign(this.monitoringStats.statusCounts, counts);
        this._updateMonitoringStatsDisplay();
    }
    
    /**
     * 🆕 v2.2.0: Monitoring Stats 강제 표시
     */
    showMonitoringStats() {
        const { monitoringStatsGroup } = this.elements;
        if (monitoringStatsGroup) {
            monitoringStatsGroup.style.display = 'flex';
        }
    }
    
    /**
     * 🆕 v2.2.0: Monitoring Stats 강제 숨김
     */
    hideMonitoringStats() {
        const { monitoringStatsGroup } = this.elements;
        if (monitoringStatsGroup) {
            monitoringStatsGroup.style.display = 'none';
        }
    }
    
    /**
     * 🆕 v2.2.0: Monitoring Stats 현재 값 가져오기
     * @returns {Object}
     */
    getMonitoringStats() {
        return { ...this.monitoringStats };
    }
    
    /**
     * 🆕 v2.4.0: Performance 컴포넌트 참조 반환
     * @returns {StatusBarPerformanceCompact|null}
     */
    getPerformanceCompact() {
        return this._perfCompact;
    }
    
    /**
     * 현재 상태 가져오기
     * @returns {Object} 현재 상태 객체
     */
    getState() {
        return { 
            ...this.state,
            monitoringStats: { ...this.monitoringStats },
            currentMode: this.currentMode,
            currentSubMode: this.currentSubMode
        };
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
        
        // 🆕 v2.4.0: Performance 컴포넌트도 컴팩트 모드 적용
        if (this._perfCompact) {
            this._perfCompact.setCompact(compact);
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
     * 즉시 상태 새로고침
     */
    refresh() {
        this._updateMonitoringStatsDisplay();
        
        // 🆕 v2.4.0: Performance 컴포넌트 새로고침
        if (this._perfCompact && typeof this._perfCompact.refresh === 'function') {
            this._perfCompact.refresh();
        }
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
        
        // 🆕 v2.4.0: Performance 컴포넌트 정리
        if (this._perfCompact) {
            this._perfCompact.dispose();
            this._perfCompact = null;
        }
        
        // DOM 제거
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        // 참조 정리
        this.elements = {};
        
        console.log('[StatusBar] 정리 완료');
    }
    /**
     * PerformanceMonitor 연결
     * @param {PerformanceMonitor} monitor 
     */
    setPerformanceMonitor(monitor) {
        this._performanceMonitor = monitor;
        console.log('[StatusBar] ✅ PerformanceMonitor 연결 완료');
    }

}

// ============================================
// Factory Function
// ============================================

/**
 * StatusBar 인스턴스 생성 팩토리 함수
 * 
 * @param {Object} options - StatusBar 옵션
 * @returns {StatusBar}
 * 
 * @example
 * import { createStatusBar } from './StatusBar.js';
 * const statusBar = createStatusBar({
 *     connectionStatusService: myService,
 *     eventBus: myEventBus
 * });
 */
export function createStatusBar(options = {}) {
    return new StatusBar(options);
    
}

// ============================================
// Default Export
// ============================================

export default StatusBar;