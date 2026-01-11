/**
 * StatusBar.js
 * ============
 * Cleanroom Sidebar Theme - 하단 상태바 컴포넌트
 * 
 * Source: test_sidebar_standalone.html v2.10
 * 
 * @version 1.0.0
 * @created 2026-01-11
 * 
 * @description
 * - NET, API, DB 연결 상태 표시
 * - FPS, Memory 성능 표시
 * - Site/Country 정보 표시
 * 
 * 의존성:
 * - ConnectionStatusService (services)
 * - PerformanceMonitor (scene)
 */

// ============================================
// Constants
// ============================================

const STATUS_UPDATE_INTERVAL = 2000; // 2초마다 업데이트

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
     */
    constructor(options = {}) {
        this.connectionStatusService = options.connectionStatusService || null;
        this.performanceMonitor = options.performanceMonitor || null;
        this.eventBus = options.eventBus || null;
        this.siteId = options.siteId || null;
        this.countryCode = options.countryCode || 'KR';
        
        // 상태
        this.isNetOnline = navigator.onLine;
        this.isApiConnected = false;
        this.isDbConnected = false;
        this.fps = 60;
        this.memoryUsage = 128;
        
        // DOM 참조
        this.element = null;
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
        this._setupEventListeners();
        this._startUpdateLoop();
        
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
            <div class="status-group">
                <div class="status-item">
                    <span class="country-code" id="status-country">${this.countryCode}</span>
                </div>
                <div class="status-item">
                    <span class="status-dot connected" id="net-dot"></span>
                    <span class="status-label">NET</span>
                    <span class="status-value" id="net-value">Online</span>
                </div>
                <div class="status-item">
                    <span class="status-dot disconnected" id="api-dot"></span>
                    <span class="status-label">API</span>
                    <span class="status-value" id="api-value">Disconnected</span>
                </div>
                <div class="status-item">
                    <span class="status-dot disconnected" id="db-dot"></span>
                    <span class="status-label">DB</span>
                    <span class="status-value" id="db-value">None</span>
                </div>
            </div>
            <div class="status-group">
                <div class="status-item">
                    <span class="status-label">FPS</span>
                    <span class="status-value" id="fps-value">60</span>
                    <div class="perf-bar">
                        <div class="perf-bar-fill good" id="fps-bar" style="width: 100%;"></div>
                    </div>
                </div>
                <div class="status-item">
                    <span class="status-label">MEM</span>
                    <span class="status-value"><span id="memory-value">128</span>MB</span>
                    <div class="perf-bar">
                        <div class="perf-bar-fill good" id="memory-bar" style="width: 30%;"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.element);
    }
    
    // ========================================
    // Event Listeners
    // ========================================
    
    _setupEventListeners() {
        // 네트워크 상태 변경
        window.addEventListener('online', () => this._updateNetStatus(true));
        window.addEventListener('offline', () => this._updateNetStatus(false));
        
        // ConnectionStatusService 연동
        if (this.connectionStatusService) {
            const unsubOnline = this.connectionStatusService.onOnline(() => {
                this._updateApiStatus(true);
            });
            this._eventUnsubscribers.push(unsubOnline);
            
            const unsubOffline = this.connectionStatusService.onOffline(() => {
                this._updateApiStatus(false);
            });
            this._eventUnsubscribers.push(unsubOffline);
            
            // 초기 상태
            this._updateApiStatus(this.connectionStatusService.isOnline());
        }
        
        // EventBus 연동
        if (this.eventBus) {
            // 사이트 연결 이벤트
            const unsubSite = this.eventBus.on('site:connected', (data) => {
                this._updateDbStatus(true, data.siteId);
            });
            this._eventUnsubscribers.push(unsubSite);
            
            const unsubDisconnect = this.eventBus.on('site:disconnected', () => {
                this._updateDbStatus(false, null);
            });
            this._eventUnsubscribers.push(unsubDisconnect);
        }
    }
    
    // ========================================
    // Update Loop
    // ========================================
    
    _startUpdateLoop() {
        this._updateInterval = setInterval(() => {
            this._updatePerformanceStats();
        }, STATUS_UPDATE_INTERVAL);
    }
    
    _updatePerformanceStats() {
        // FPS 업데이트
        if (this.performanceMonitor) {
            this.fps = this.performanceMonitor.getFPS?.() || 60;
        } else {
            // 시뮬레이션
            this.fps = 58 + Math.floor(Math.random() * 5);
        }
        
        // Memory 업데이트
        if (performance.memory) {
            this.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        } else {
            // 시뮬레이션
            this.memoryUsage = 128 + Math.floor((Math.random() - 0.5) * 20);
        }
        
        // DOM 업데이트
        this._updateFpsDisplay();
        this._updateMemoryDisplay();
    }
    
    // ========================================
    // Status Updates
    // ========================================
    
    _updateNetStatus(isOnline) {
        this.isNetOnline = isOnline;
        
        const dot = document.getElementById('net-dot');
        const value = document.getElementById('net-value');
        
        if (dot) {
            dot.className = `status-dot ${isOnline ? 'connected' : 'disconnected'}`;
        }
        if (value) {
            value.textContent = isOnline ? 'Online' : 'Offline';
        }
    }
    
    _updateApiStatus(isConnected) {
        this.isApiConnected = isConnected;
        
        const dot = document.getElementById('api-dot');
        const value = document.getElementById('api-value');
        
        if (dot) {
            dot.className = `status-dot ${isConnected ? 'connected' : 'disconnected'}`;
        }
        if (value) {
            value.textContent = isConnected ? 'Connected' : 'Disconnected';
        }
    }
    
    _updateDbStatus(isConnected, siteId = null) {
        this.isDbConnected = isConnected;
        this.siteId = siteId;
        
        const dot = document.getElementById('db-dot');
        const value = document.getElementById('db-value');
        
        if (dot) {
            dot.className = `status-dot ${isConnected ? 'connected' : 'disconnected'}`;
        }
        if (value) {
            value.textContent = isConnected && siteId 
                ? siteId.replace(/_/g, '-').toUpperCase()
                : 'None';
        }
    }
    
    _updateFpsDisplay() {
        const fpsValue = document.getElementById('fps-value');
        const fpsBar = document.getElementById('fps-bar');
        
        if (fpsValue) {
            fpsValue.textContent = this.fps;
        }
        
        if (fpsBar) {
            const percent = Math.min((this.fps / 60) * 100, 100);
            fpsBar.style.width = `${percent}%`;
            
            // 색상 클래스
            fpsBar.className = 'perf-bar-fill';
            if (this.fps >= 50) {
                fpsBar.classList.add('good');
            } else if (this.fps >= 30) {
                fpsBar.classList.add('warning');
            } else {
                fpsBar.classList.add('critical');
            }
        }
    }
    
    _updateMemoryDisplay() {
        const memValue = document.getElementById('memory-value');
        const memBar = document.getElementById('memory-bar');
        
        if (memValue) {
            memValue.textContent = this.memoryUsage;
        }
        
        if (memBar) {
            // 가정: 최대 512MB
            const percent = Math.min((this.memoryUsage / 512) * 100, 100);
            memBar.style.width = `${percent}%`;
            
            // 색상 클래스
            memBar.className = 'perf-bar-fill';
            if (percent < 50) {
                memBar.classList.add('good');
            } else if (percent < 80) {
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
        const countryEl = document.getElementById('status-country');
        if (countryEl) {
            countryEl.textContent = code;
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
     * @param {string} siteId
     */
    setDbConnected(connected, siteId = null) {
        this._updateDbStatus(connected, siteId);
    }
    
    /**
     * PerformanceMonitor 설정
     * @param {Object} monitor
     */
    setPerformanceMonitor(monitor) {
        this.performanceMonitor = monitor;
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
     * Compact 모드 토글
     * @param {boolean} compact
     */
    setCompact(compact) {
        if (this.element) {
            this.element.classList.toggle('compact', compact);
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
                unsub();
            }
        });
        this._eventUnsubscribers = [];
        
        // DOM 제거
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        
        console.log('[StatusBar] 정리 완료');
    }
}

// 기본 내보내기
export default StatusBar;