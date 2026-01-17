/**
 * LaneHeader.js
 * =============
 * Ranking View 레인 헤더 컴포넌트
 * 
 * @version 1.0.0
 * @description
 * - 레인명 + 설비 수 표시
 * - 평균/최대 지속시간 또는 생산개수 표시
 * - 실시간 통계 업데이트
 * 
 * @changelog
 * - v1.0.0: Phase 2 초기 버전
 *   - 세로 레이아웃 헤더
 *   - 통계 표시 (Avg, Max)
 * 
 * @exports
 * - LaneHeader
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/components/LaneHeader.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

export class LaneHeader {
    /**
     * CSS 클래스 상수 정의
     */
    static CSS = {
        // Block
        BLOCK: 'lane-header',
        
        // Elements
        TITLE_ROW: 'lane-header__title-row',
        ICON: 'lane-header__icon',
        TITLE: 'lane-header__title',
        COUNT: 'lane-header__count',
        STATS: 'lane-header__stats',
        STAT: 'lane-header__stat',
        STAT_ICON: 'lane-header__stat-icon',
        STAT_LABEL: 'lane-header__stat-label',
        STAT_VALUE: 'lane-header__stat-value',
        
        // Modifiers
        HEADER_REMOTE: 'lane-header--remote',
        HEADER_SUDDEN_STOP: 'lane-header--sudden-stop',
        HEADER_STOP: 'lane-header--stop',
        HEADER_RUN: 'lane-header--run',
        HEADER_IDLE: 'lane-header--idle',
        HEADER_WAIT: 'lane-header--wait',
        STAT_AVG: 'lane-header__stat--avg',
        STAT_MAX: 'lane-header__stat--max'
    };
    
    /**
     * @param {Object} config - 헤더 설정
     * @param {string} config.id - 레인 ID
     * @param {string} config.name - 레인명
     * @param {string} config.icon - 레인 아이콘
     * @param {string} config.sortKey - 정렬 기준 (duration/production)
     */
    constructor(config) {
        this._config = { ...config };
        
        // DOM
        this.element = null;
        this._dom = {};
        
        // Initialize
        this._init();
    }
    
    // =========================================
    // Lifecycle Methods
    // =========================================
    
    /**
     * 초기화
     * @private
     */
    _init() {
        this._createDOM();
        this._applyHeaderStyle();
    }
    
    /**
     * DOM 구조 생성
     * @private
     */
    _createDOM() {
        // Main container
        this.element = document.createElement('div');
        this.element.classList.add(LaneHeader.CSS.BLOCK);
        
        // Title Row
        const titleRow = document.createElement('div');
        titleRow.classList.add(LaneHeader.CSS.TITLE_ROW);
        
        // Icon
        const icon = document.createElement('span');
        icon.classList.add(LaneHeader.CSS.ICON);
        icon.textContent = this._config.icon || '📊';
        
        // Title
        const title = document.createElement('span');
        title.classList.add(LaneHeader.CSS.TITLE);
        title.textContent = this._config.name || 'Lane';
        
        // Count
        const count = document.createElement('span');
        count.classList.add(LaneHeader.CSS.COUNT);
        count.textContent = '0';
        count.dataset.countElement = 'true';
        this._dom.count = count;
        
        titleRow.appendChild(icon);
        titleRow.appendChild(title);
        titleRow.appendChild(count);
        
        // Stats Container
        const stats = document.createElement('div');
        stats.classList.add(LaneHeader.CSS.STATS);
        
        // Avg Stat
        const avgStat = this._createStatElement(
            this._config.sortKey === 'production' ? '📦' : '⏱️',
            'Avg',
            this._config.sortKey === 'production' ? '0' : '00:00'
        );
        avgStat.classList.add(LaneHeader.CSS.STAT_AVG);
        this._dom.avgValue = avgStat.querySelector('[data-stat-value]');
        
        // Max Stat
        const maxStat = this._createStatElement(
            '📊',
            'Max',
            this._config.sortKey === 'production' ? '0' : '00:00'
        );
        maxStat.classList.add(LaneHeader.CSS.STAT_MAX);
        this._dom.maxValue = maxStat.querySelector('[data-stat-value]');
        
        stats.appendChild(avgStat);
        stats.appendChild(maxStat);
        
        // Assemble
        this.element.appendChild(titleRow);
        this.element.appendChild(stats);
    }
    
    /**
     * 통계 요소 생성
     * @private
     * @param {string} iconText - 아이콘 텍스트
     * @param {string} label - 라벨
     * @param {string} value - 초기값
     * @returns {HTMLElement}
     */
    _createStatElement(iconText, label, value) {
        const stat = document.createElement('div');
        stat.classList.add(LaneHeader.CSS.STAT);
        
        const icon = document.createElement('span');
        icon.classList.add(LaneHeader.CSS.STAT_ICON);
        icon.textContent = iconText;
        
        const labelEl = document.createElement('span');
        labelEl.classList.add(LaneHeader.CSS.STAT_LABEL);
        labelEl.textContent = `${label}:`;
        
        const valueEl = document.createElement('span');
        valueEl.classList.add(LaneHeader.CSS.STAT_VALUE);
        valueEl.textContent = value;
        valueEl.dataset.statValue = label.toLowerCase();
        
        stat.appendChild(icon);
        stat.appendChild(labelEl);
        stat.appendChild(valueEl);
        
        return stat;
    }
    
    /**
     * 헤더 스타일 적용
     * @private
     */
    _applyHeaderStyle() {
        const styleMap = {
            'remote': LaneHeader.CSS.HEADER_REMOTE,
            'sudden-stop': LaneHeader.CSS.HEADER_SUDDEN_STOP,
            'stop': LaneHeader.CSS.HEADER_STOP,
            'run': LaneHeader.CSS.HEADER_RUN,
            'idle': LaneHeader.CSS.HEADER_IDLE,
            'wait': LaneHeader.CSS.HEADER_WAIT
        };
        
        const styleClass = styleMap[this._config.id];
        if (styleClass) {
            this.element.classList.add(styleClass);
        }
    }
    
    // =========================================
    // Public Methods
    // =========================================
    
    /**
     * 통계 업데이트
     * @param {Object} stats
     * @param {number} stats.count - 설비 수
     * @param {number} [stats.avgDuration] - 평균 지속 시간 (초)
     * @param {number} [stats.maxDuration] - 최대 지속 시간 (초)
     * @param {number} [stats.avgProduction] - 평균 생산 개수
     * @param {number} [stats.maxProduction] - 최대 생산 개수
     */
    updateStats(stats) {
        // Count
        if (this._dom.count) {
            this._dom.count.textContent = stats.count.toString();
        }
        
        // Duration 기반 통계
        if (this._config.sortKey === 'duration') {
            if (this._dom.avgValue) {
                this._dom.avgValue.textContent = this._formatDuration(stats.avgDuration || 0);
            }
            if (this._dom.maxValue) {
                this._dom.maxValue.textContent = this._formatDuration(stats.maxDuration || 0);
            }
        }
        
        // Production 기반 통계
        if (this._config.sortKey === 'production') {
            if (this._dom.avgValue) {
                this._dom.avgValue.textContent = (stats.avgProduction || 0).toString();
            }
            if (this._dom.maxValue) {
                this._dom.maxValue.textContent = (stats.maxProduction || 0).toString();
            }
        }
    }
    
    /**
     * Count 업데이트
     * @param {number} count
     */
    updateCount(count) {
        if (this._dom.count) {
            this._dom.count.textContent = count.toString();
        }
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.element?.remove();
        this.element = null;
        this._dom = {};
    }
    
    // =========================================
    // Private Methods
    // =========================================
    
    /**
     * 지속 시간 포맷팅
     * @private
     * @param {number} seconds
     * @returns {string} HH:MM:SS 또는 MM:SS 형식
     */
    _formatDuration(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.LaneHeader = LaneHeader;
}