/**
 * StatusBar.js
 * ============
 * Cleanroom Sidebar Theme - 하단 상태바 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 2.3.1
 * @created 2026-01-11
 * @updated 2026-01-14
 * 
 * @changelog
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
 * - FPS, Memory 성능 표시
 * - Site/Country 정보 표시
 * 
 * 의존성:
 * - ConnectionStatusService (services)
 * - PerformanceMonitor (core/utils)
 * - EventBus (core/managers)
 * - MonitoringService (선택, stats 연동용)
 * - EquipmentEditState (선택, 매핑 상태용)
 * - _status-bar.css (필수, 외부 CSS)
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

import { StatusBarPerformanceCompact } from '../statusbar/StatusBarPerformanceCompact.js';

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

/** 🆕 v2.2.0: Monitoring Stats 표시 조건 */
const MONITORING_STATS_VISIBLE_SUBMODES = ['3d-view', 'ranking-view'];

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
     * @param {number} options.totalEquipment - 🆕 총 장비 수 (기본: 117)
     */
    constructor(options = {}) {
        this.connectionStatusService = options.connectionStatusService || null;
        this.performanceMonitor = options.performanceMonitor || null;
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
            isDbConnected: false,
            fps: 60,
            memoryUsage: 128, // MB
            maxMemory: 512    // 가정: 최대 512MB
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
        this._initPerformanceSection();
        
        console.log('[StatusBar] 초기화 완료 (v2.3.1 - 5 Equipment States)');
    }

    _initPerformanceSection() {
        // 기존 성능 표시 영역 찾기 (또는 새 컨테이너 생성)
        const rightGroup = this.element.querySelector('.status-group-right');
        
        if (rightGroup) {
            // 기존 FPS, Memory 표시 제거 (선택사항)
            // rightGroup.innerHTML = '';
            
            // Performance 컴포넌트 추가
            this._perfCompact = new StatusBarPerformanceCompact(rightGroup, {
                showAlerts: true,
                compact: false
            });
        }
    }
    
    // ========================================
    // DOM Creation
    // ========================================
    
    /**
     * 🔧 v2.3.1: SUDDENSTOP, DISCONNECTED 추가
     * 🔧 v2.2.0: Monitoring Stats 섹션 추가
     * 🔧 "개" 제거 - 숫자만 표시
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
            
            // <!-- 오른쪽 그룹: 성능 지표 -->
            // <div class="status-group status-group-right">
            //     <!-- FPS -->
            //     <div class="status-item" id="status-fps-item">
            //         <span class="status-label">FPS</span>
            //         <span class="status-label status-perf-value" id="fps-value">60</span>
            //         <div class="perf-bar">
            //             <div class="perf-bar-fill good" id="fps-bar" style="width: 100%;"></div>
            //         </div>
            //     </div>
                
            //     <!-- Memory -->
            //     <div class="status-item" id="status-mem-item">
            //         <span class="status-label">MEM</span>
            //         <span class="status-label status-perf-value"><span id="memory-value">128</span>MB</span>
            //         <div class="perf-bar">
            //             <div class="perf-bar-fill good" id="memory-bar" style="width: 30%;"></div>
            //         </div>
            //     </div>
            // </div>
        `;
        
        this.container.appendChild(this.element);
    }
    
    /**
     * DOM 요소 캐싱 (성능 최적화)
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
            // // Performance
            // fpsValue: document.getElementById('fps-value'),
            // fpsBar: document.getElementById('fps-bar'),
            // memValue: document.getElementById('memory-value'),
            // memBar: document.getElementById('memory-bar'),
            
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
    
    ========================================
    Status Updates (Private)
    ========================================
    
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
    
    // /**
    //  * FPS 디스플레이 업데이트
    //  * @private
    //  */
    // _updateFpsDisplay() {
    //     const { fpsValue, fpsBar } = this.elements;
    //     const fps = this.state.fps;
        
    //     if (fpsValue) {
    //         fpsValue.textContent = fps;
    //     }
        
    //     if (fpsBar) {
    //         const percent = Math.min((fps / 60) * 100, 100);
    //         fpsBar.style.width = `${percent}%`;
            
    //         fpsBar.className = 'perf-bar-fill';
    //         if (fps >= PERFORMANCE_THRESHOLDS.fps.good) {
    //             fpsBar.classList.add('good');
    //         } else if (fps >= PERFORMANCE_THRESHOLDS.fps.warning) {
    //             fpsBar.classList.add('warning');
    //         } else {
    //             fpsBar.classList.add('critical');
    //         }
    //     }
    // }
    
    // /**
    //  * Memory 디스플레이 업데이트
    //  * @private
    //  */
    // _updateMemoryDisplay() {
    //     const { memValue, memBar } = this.elements;
    //     const memory = this.state.memoryUsage;
    //     const maxMemory = this.state.maxMemory;
        
    //     if (memValue) {
    //         memValue.textContent = memory;
    //     }
        
    //     if (memBar) {
    //         const percent = Math.min((memory / maxMemory) * 100, 100);
    //         memBar.style.width = `${percent}%`;
            
    //         memBar.className = 'perf-bar-fill';
    //         if (memory < PERFORMANCE_THRESHOLDS.memory.good) {
    //             memBar.classList.add('good');
    //         } else if (memory < PERFORMANCE_THRESHOLDS.memory.warning) {
    //             memBar.classList.add('warning');
    //         } else {
    //             memBar.classList.add('critical');
    //         }
    //     }
    // }
    
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
        this._updateMonitoringStatsDisplay();
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

                if (this._perfCompact) {
            this._perfCompact.dispose();
            this._perfCompact = null;
        }
        
        console.log('[StatusBar] 정리 완료');
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
 *     performanceMonitor: myMonitor,
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