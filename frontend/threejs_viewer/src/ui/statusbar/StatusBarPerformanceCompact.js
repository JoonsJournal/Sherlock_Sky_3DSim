/**
 * StatusBarPerformanceCompact.js
 * ==============================
 * StatusBar Performance 섹션 컴포넌트
 * 
 * @version 1.0.0
 * @created 2026-01-21
 * @updated 2026-01-21
 * 
 * @description
 * - 컴팩트 아이콘 + 값 레이아웃
 * - 임계값 기반 색상 변경 (good/warning/critical)
 * - Hover 시 Tooltip 표시
 * - 4개 섹션: Performance, Network, Cache, Alerts
 * 
 * [BEM 클래스 구조]
 * .statusbar-perf              → Block (전체 컨테이너)
 * .statusbar-perf__section     → Section 그룹
 * .statusbar-perf__item        → 개별 항목 (Icon + Value)
 * .statusbar-perf__icon        → SVG 아이콘
 * .statusbar-perf__value       → 숫자 값
 * .statusbar-perf__value--warning   → Warning 상태
 * .statusbar-perf__value--critical  → Critical 상태
 * .statusbar-perf__divider     → 섹션 구분선
 * 
 * @dependencies
 * - services/performance/PerformanceMonitor.js
 * - services/performance/NetworkStatsMonitor.js
 * - ui/icons/performance-icons.js
 * - core/managers/EventBus.js
 * 
 * @exports
 * - StatusBarPerformanceCompact (class)
 * - createStatusBarPerformanceCompact (factory)
 * 
 * @usage
 * import { StatusBarPerformanceCompact } from './StatusBarPerformanceCompact.js';
 * 
 * const container = document.querySelector('.status-group-right');
 * const perf = new StatusBarPerformanceCompact(container, {
 *     performanceMonitor: performanceMonitor,  // optional
 *     networkStatsMonitor: networkStatsMonitor // optional
 * });
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/statusbar/StatusBarPerformanceCompact.js
 */

import { eventBus } from '../../core/managers/EventBus.js';
import { PerformanceMonitor, performanceMonitor } from '../../services/performance/PerformanceMonitor.js';
import { NetworkStatsMonitor, networkStatsMonitor } from '../../services/performance/NetworkStatsMonitor.js';
import { PERFORMANCE_ICONS } from '../icons/performance-icons.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * CSS 클래스 상수 (BEM 네이밍)
 */
const CSS = {
    BLOCK: 'statusbar-perf',
    SECTION: 'statusbar-perf__section',
    ITEM: 'statusbar-perf__item',
    ICON: 'statusbar-perf__icon',
    VALUE: 'statusbar-perf__value',
    VALUE_WARNING: 'statusbar-perf__value--warning',
    VALUE_CRITICAL: 'statusbar-perf__value--critical',
    DIVIDER: 'statusbar-perf__divider'
};

/**
 * 임계값 설정
 * - warning: 경고 레벨 (노란색)
 * - critical: 심각 레벨 (빨간색)
 * - inverse: true면 낮을수록 나쁨 (FPS, Cache Hit Rate)
 */
const THRESHOLDS = {
    fps: { warning: 50, critical: 30, inverse: true },       // FPS < 30 = critical
    memory: { warning: 200, critical: 400, inverse: false }, // MB > 400 = critical
    drawCalls: { warning: 300, critical: 500, inverse: false },
    frameTime: { warning: 20, critical: 33, inverse: false }, // ms > 33 = critical
    latency: { warning: 100, critical: 300, inverse: false }, // ms > 300 = critical
    cacheHitRate: { warning: 90, critical: 70, inverse: true } // % < 70 = critical
};

/**
 * 섹션별 항목 정의
 */
const SECTION_ITEMS = {
    performance: [
        { key: 'fps', icon: 'monitor', label: 'FPS', unit: '' },
        { key: 'memory', icon: 'cpu', label: 'Memory', unit: 'MB' },
        { key: 'drawCalls', icon: 'layers', label: 'Draw Calls', unit: '' },
        { key: 'frameTime', icon: 'clock', label: 'Frame Time', unit: 'ms' }
    ],
    network: [
        { key: 'latency', icon: 'wifi', label: 'Latency', unit: 'ms' },
        { key: 'messagesIn', icon: 'arrowDown', label: 'Messages In', unit: '/s' },
        { key: 'messagesOut', icon: 'arrowUp', label: 'Messages Out', unit: '/s' }
    ],
    cache: [
        { key: 'cacheHitRate', icon: 'database', label: 'Cache Hit Rate', unit: '%' },
        { key: 'deltaUpdates', icon: 'refreshCw', label: 'Delta Updates', unit: '' }
    ],
    alerts: [
        { key: 'warnings', icon: 'alertTriangle', label: 'Warnings', unit: '' },
        { key: 'errors', icon: 'xCircle', label: 'Errors', unit: '' }
    ]
};

// =============================================================================
// StatusBarPerformanceCompact Class
// =============================================================================

export class StatusBarPerformanceCompact {
    /**
     * StatusBarPerformanceCompact 생성자
     * 
     * @param {HTMLElement} container - 컴포넌트를 추가할 부모 컨테이너
     * @param {Object} [options={}] - 옵션
     * @param {Object} [options.performanceMonitor] - PerformanceMonitor 인스턴스
     * @param {Object} [options.networkStatsMonitor] - NetworkStatsMonitor 인스턴스
     * @param {boolean} [options.showAlerts=true] - Alerts 섹션 표시 여부
     * @param {boolean} [options.compact=false] - 컴팩트 모드 (일부 항목 숨김)
     */
    constructor(container, options = {}) {
        /** @type {HTMLElement} 부모 컨테이너 */
        this._container = container;
        
        /** @type {Object} PerformanceMonitor 인스턴스 */
        this._performanceMonitor = options.performanceMonitor || performanceMonitor;
        
        /** @type {Object} NetworkStatsMonitor 인스턴스 */
        this._networkStatsMonitor = options.networkStatsMonitor || networkStatsMonitor;
        
        /** @type {boolean} Alerts 섹션 표시 여부 */
        this._showAlerts = options.showAlerts !== false;
        
        /** @type {boolean} 컴팩트 모드 */
        this._compact = options.compact || false;
        
        /** @type {HTMLElement|null} 루트 엘리먼트 */
        this._element = null;
        
        /** @type {Object<string, HTMLElement>} 값 엘리먼트 캐시 (key → value element) */
        this._itemElements = {};
        
        /** @type {Array<Function>} 이벤트 구독 해제 함수 배열 */
        this._eventUnsubscribers = [];
        
        /** @type {boolean} 초기화 완료 여부 */
        this._initialized = false;
        
        // 초기화
        this._init();
    }
    
    // =========================================================================
    // Initialization
    // =========================================================================
    
    /**
     * 컴포넌트 초기화
     * @private
     */
    _init() {
        this._createDOM();
        this._subscribeEvents();
        this._updateInitialValues();
        this._initialized = true;
        
        console.log('✅ [StatusBarPerformanceCompact] 초기화 완료');
    }
    
    /**
     * DOM 구조 생성
     * @private
     */
    _createDOM() {
        // 기존 요소가 있으면 제거
        if (this._element && this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        
        // 루트 엘리먼트 생성
        this._element = document.createElement('div');
        this._element.classList.add(CSS.BLOCK);
        
        if (this._compact) {
            this._element.classList.add(`${CSS.BLOCK}--compact`);
        }
        
        // Performance Section
        this._createSection('performance', SECTION_ITEMS.performance);
        
        // Divider
        this._createDivider();
        
        // Network Section
        this._createSection('network', SECTION_ITEMS.network);
        
        // Divider
        this._createDivider();
        
        // Cache Section
        this._createSection('cache', SECTION_ITEMS.cache);
        
        // Alerts Section (조건부)
        if (this._showAlerts) {
            this._createDivider();
            this._createSection('alerts', SECTION_ITEMS.alerts);
        }
        
        // 컨테이너에 추가
        this._container.appendChild(this._element);
    }
    
    /**
     * 섹션 생성
     * @private
     * @param {string} name - 섹션 이름
     * @param {Array<Object>} items - 항목 배열
     */
    _createSection(name, items) {
        const section = document.createElement('div');
        section.classList.add(CSS.SECTION);
        section.dataset.section = name;
        
        for (const item of items) {
            // 컴팩트 모드에서 일부 항목 숨김
            if (this._compact && this._shouldHideInCompact(item.key)) {
                continue;
            }
            
            const itemEl = this._createItem(item);
            section.appendChild(itemEl);
            
            // 값 엘리먼트 캐시
            const valueEl = itemEl.querySelector(`.${CSS.VALUE}`);
            if (valueEl) {
                this._itemElements[item.key] = valueEl;
            }
        }
        
        this._element.appendChild(section);
    }
    
    /**
     * 개별 항목 생성 (Icon + Value)
     * @private
     * @param {Object} item - { key, icon, label, unit }
     * @returns {HTMLElement}
     */
    _createItem({ key, icon, label, unit }) {
        const item = document.createElement('div');
        item.classList.add(CSS.ITEM);
        item.title = label;  // Native Tooltip
        item.dataset.key = key;
        
        // Icon
        const iconEl = document.createElement('span');
        iconEl.classList.add(CSS.ICON);
        iconEl.innerHTML = PERFORMANCE_ICONS[icon] || '';
        
        // Value
        const valueEl = document.createElement('span');
        valueEl.classList.add(CSS.VALUE);
        valueEl.textContent = '--';
        valueEl.dataset.key = key;
        valueEl.dataset.unit = unit;
        
        item.appendChild(iconEl);
        item.appendChild(valueEl);
        
        return item;
    }
    
    /**
     * 구분선 생성
     * @private
     */
    _createDivider() {
        const divider = document.createElement('div');
        divider.classList.add(CSS.DIVIDER);
        this._element.appendChild(divider);
    }
    
    /**
     * 컴팩트 모드에서 숨길 항목인지 확인
     * @private
     * @param {string} key - 항목 키
     * @returns {boolean}
     */
    _shouldHideInCompact(key) {
        // 컴팩트 모드에서 숨길 항목 목록
        const hideInCompact = ['drawCalls', 'frameTime', 'messagesOut', 'deltaUpdates'];
        return hideInCompact.includes(key);
    }
    
    // =========================================================================
    // Event Subscription
    // =========================================================================
    
    /**
     * 이벤트 구독 설정
     * @private
     */
    _subscribeEvents() {
        // Performance 이벤트 구독
        const unsubPerf = eventBus.on(
            PerformanceMonitor.EVENTS.METRICS_UPDATED, 
            (event) => this._handlePerformanceUpdate(event)
        );
        if (unsubPerf) {
            this._eventUnsubscribers.push(unsubPerf);
        }
        
        // Network 이벤트 구독
        const unsubNet = eventBus.on(
            NetworkStatsMonitor.EVENTS.STATS_UPDATED, 
            (event) => this._handleNetworkUpdate(event)
        );
        if (unsubNet) {
            this._eventUnsubscribers.push(unsubNet);
        }
        
        // Warning 이벤트 구독
        const unsubWarn = eventBus.on(
            PerformanceMonitor.EVENTS.WARNING,
            (event) => this._handleAlert('warning', event)
        );
        if (unsubWarn) {
            this._eventUnsubscribers.push(unsubWarn);
        }
        
        // Critical 이벤트 구독
        const unsubCrit = eventBus.on(
            PerformanceMonitor.EVENTS.CRITICAL,
            (event) => this._handleAlert('critical', event)
        );
        if (unsubCrit) {
            this._eventUnsubscribers.push(unsubCrit);
        }
        
        console.log('   └─ 이벤트 구독 완료');
    }
    
    /**
     * Performance 메트릭스 업데이트 핸들러
     * @private
     * @param {Object} event - { metrics: { fps, memory, drawCalls, ... }, timestamp }
     */
    _handlePerformanceUpdate(event) {
        if (!event || !event.metrics) return;
        
        const { metrics } = event;
        
        // Performance 값 업데이트
        this._updateItem('fps', metrics.fps, '');
        this._updateItem('memory', metrics.memory, 'MB');
        this._updateItem('drawCalls', metrics.drawCalls, '');
        this._updateItem('frameTime', metrics.frameTime, 'ms');
        
        // Alerts 업데이트
        if (this._showAlerts && this._performanceMonitor) {
            const warnings = this._performanceMonitor.getWarningCount?.() || 0;
            const errors = this._performanceMonitor.getErrorCount?.() || 0;
            
            this._updateItem('warnings', warnings, '', warnings > 0 ? 'warning' : null);
            this._updateItem('errors', errors, '', errors > 0 ? 'critical' : null);
        }
    }
    
    /**
     * Network 통계 업데이트 핸들러
     * @private
     * @param {Object} event - { stats: { latency, messagesInPerSec, ... }, timestamp }
     */
    _handleNetworkUpdate(event) {
        if (!event || !event.stats) return;
        
        const { stats } = event;
        
        // Network 값 업데이트
        this._updateItem('latency', stats.latency, 'ms');
        this._updateItem('messagesIn', stats.messagesInPerSec, '/s');
        this._updateItem('messagesOut', stats.messagesOutPerSec, '/s');
        
        // Cache 값 업데이트
        this._updateItem('cacheHitRate', stats.cacheHitRate, '%');
        this._updateItem('deltaUpdates', stats.deltaUpdates, '');
    }
    
    /**
     * 경고 이벤트 핸들러
     * @private
     * @param {string} level - 'warning' | 'critical'
     * @param {Object} event - { metric, value, threshold }
     */
    _handleAlert(level, event) {
        // Alert 발생 시 시각적 피드백 (선택사항)
        // console.log(`[StatusBarPerformanceCompact] ${level}:`, event);
    }
    
    // =========================================================================
    // Update Methods
    // =========================================================================
    
    /**
     * 초기값 설정
     * @private
     */
    _updateInitialValues() {
        // PerformanceMonitor에서 초기값 가져오기
        if (this._performanceMonitor) {
            const metrics = this._performanceMonitor.getMetrics?.() || {};
            this._handlePerformanceUpdate({ metrics });
        }
        
        // NetworkStatsMonitor에서 초기값 가져오기
        if (this._networkStatsMonitor) {
            const stats = this._networkStatsMonitor.getStats?.() || {};
            this._handleNetworkUpdate({ stats });
        }
    }
    
    /**
     * 개별 항목 값 업데이트
     * @private
     * @param {string} key - 항목 키
     * @param {number} value - 값
     * @param {string} unit - 단위
     * @param {string|null} [forceState=null] - 강제 상태 ('warning' | 'critical' | null)
     */
    _updateItem(key, value, unit, forceState = null) {
        const el = this._itemElements[key];
        if (!el) return;
        
        // 값이 undefined거나 NaN이면 '--' 표시
        if (value === undefined || value === null || Number.isNaN(value)) {
            el.textContent = '--';
            this._clearStateClasses(el);
            return;
        }
        
        // 값 포맷팅
        const formattedValue = this._formatValue(key, value);
        el.textContent = `${formattedValue}${unit}`;
        
        // 상태 클래스 업데이트
        this._clearStateClasses(el);
        
        if (forceState === 'warning') {
            el.classList.add(CSS.VALUE_WARNING);
        } else if (forceState === 'critical') {
            el.classList.add(CSS.VALUE_CRITICAL);
        } else {
            // 자동 임계값 체크
            this._applyThresholdState(key, value, el);
        }
    }
    
    /**
     * 값 포맷팅
     * @private
     * @param {string} key - 항목 키
     * @param {number} value - 값
     * @returns {string} 포맷팅된 값
     */
    _formatValue(key, value) {
        // 소수점 처리
        if (key === 'cacheHitRate') {
            return Math.round(value);
        }
        if (key === 'latency' || key === 'frameTime') {
            return value < 10 ? value.toFixed(1) : Math.round(value);
        }
        return Math.round(value);
    }
    
    /**
     * 상태 클래스 제거
     * @private
     * @param {HTMLElement} el
     */
    _clearStateClasses(el) {
        el.classList.remove(CSS.VALUE_WARNING, CSS.VALUE_CRITICAL);
    }
    
    /**
     * 임계값 기반 상태 적용
     * @private
     * @param {string} key - 항목 키
     * @param {number} value - 값
     * @param {HTMLElement} el - 엘리먼트
     */
    _applyThresholdState(key, value, el) {
        const config = THRESHOLDS[key];
        if (!config) return;
        
        if (config.inverse) {
            // 낮을수록 나쁨 (FPS, Cache Hit Rate)
            if (value < config.critical) {
                el.classList.add(CSS.VALUE_CRITICAL);
            } else if (value < config.warning) {
                el.classList.add(CSS.VALUE_WARNING);
            }
        } else {
            // 높을수록 나쁨 (Memory, Frame Time, Latency, Draw Calls)
            if (value > config.critical) {
                el.classList.add(CSS.VALUE_CRITICAL);
            } else if (value > config.warning) {
                el.classList.add(CSS.VALUE_WARNING);
            }
        }
    }
    
    // =========================================================================
    // Public API
    // =========================================================================
    
    /**
     * 컴포넌트 표시
     */
    show() {
        if (this._element) {
            this._element.style.display = 'flex';
        }
    }
    
    /**
     * 컴포넌트 숨기기
     */
    hide() {
        if (this._element) {
            this._element.style.display = 'none';
        }
    }
    
    /**
     * 표시 상태 토글
     * @returns {boolean} 새로운 표시 상태
     */
    toggle() {
        if (this._element) {
            const isVisible = this._element.style.display !== 'none';
            this._element.style.display = isVisible ? 'none' : 'flex';
            return !isVisible;
        }
        return false;
    }
    
    /**
     * 컴팩트 모드 설정
     * @param {boolean} compact
     */
    setCompact(compact) {
        this._compact = compact;
        if (this._element) {
            this._element.classList.toggle(`${CSS.BLOCK}--compact`, compact);
        }
    }
    
    /**
     * 임계값 업데이트
     * @param {string} key - 항목 키
     * @param {Object} thresholds - { warning: number, critical: number }
     */
    setThreshold(key, thresholds) {
        if (THRESHOLDS[key]) {
            THRESHOLDS[key] = { ...THRESHOLDS[key], ...thresholds };
            
            // 현재 값으로 상태 재적용
            const el = this._itemElements[key];
            if (el) {
                const currentValue = parseFloat(el.textContent);
                if (!isNaN(currentValue)) {
                    this._clearStateClasses(el);
                    this._applyThresholdState(key, currentValue, el);
                }
            }
        }
    }
    
    /**
     * 수동 값 업데이트
     * @param {string} key - 항목 키
     * @param {number} value - 값
     */
    updateValue(key, value) {
        const el = this._itemElements[key];
        if (!el) return;
        
        const unit = el.dataset.unit || '';
        this._updateItem(key, value, unit);
    }
    
    /**
     * 전체 값 새로고침
     */
    refresh() {
        this._updateInitialValues();
    }
    
    /**
     * 루트 엘리먼트 반환
     * @returns {HTMLElement|null}
     */
    getElement() {
        return this._element;
    }
    
    /**
     * 초기화 완료 여부
     * @returns {boolean}
     */
    isInitialized() {
        return this._initialized;
    }
    
    // =========================================================================
    // Cleanup
    // =========================================================================
    
    /**
     * 리소스 정리 (destroy)
     */
    dispose() {
        // 이벤트 구독 해제
        this._eventUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (e) {
                    // 이미 해제되었을 수 있음
                }
            }
        });
        this._eventUnsubscribers = [];
        
        // DOM 제거
        if (this._element && this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        this._element = null;
        
        // 참조 정리
        this._itemElements = {};
        this._performanceMonitor = null;
        this._networkStatsMonitor = null;
        this._initialized = false;
        
        console.log('🗑️ [StatusBarPerformanceCompact] 정리 완료');
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * StatusBarPerformanceCompact 인스턴스 생성 팩토리 함수
 * 
 * @param {HTMLElement} container - 컨테이너 엘리먼트
 * @param {Object} [options={}] - 옵션
 * @returns {StatusBarPerformanceCompact}
 * 
 * @example
 * import { createStatusBarPerformanceCompact } from './StatusBarPerformanceCompact.js';
 * 
 * const perf = createStatusBarPerformanceCompact(
 *     document.querySelector('.status-group-right'),
 *     { compact: true }
 * );
 */
export function createStatusBarPerformanceCompact(container, options = {}) {
    return new StatusBarPerformanceCompact(container, options);
}

// =============================================================================
// Default Export
// =============================================================================

export default StatusBarPerformanceCompact;