/**
 * MiniTimeline.js
 * ================
 * 최근 1시간 상태 히스토리 미니 타임라인 컴포넌트
 * 
 * @version 1.0.0
 * @description
 * - Canvas 기반 미니 차트로 설비 상태 변화 시각화
 * - 상태별 색상 표시 (RUN=녹색, STOP=빨간색, IDLE=노란색 등)
 * - 호버 시 상세 시간 정보 툴팁 표시
 * - 실시간 데이터 업데이트 지원
 * 
 * @changelog
 * - v1.0.0: 초기 버전
 *   - Canvas 기반 타임라인 렌더링
 *   - 상태별 색상 매핑
 *   - 툴팁 지원
 *   - 실시간 업데이트
 * 
 * @dependencies
 * - DurationCalculator (시간 계산)
 * 
 * @exports
 * - MiniTimeline
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/components/MiniTimeline.js
 * 작성일: 2026-01-19
 * 수정일: 2026-01-19
 */

import { DurationCalculator } from '../utils/DurationCalculator.js';

export class MiniTimeline {
    // =========================================================================
    // CSS 클래스 상수
    // =========================================================================
    static CSS = {
        // Block
        BLOCK: 'mini-timeline',
        
        // Elements
        CANVAS: 'mini-timeline__canvas',
        TOOLTIP: 'mini-timeline__tooltip',
        TOOLTIP_TIME: 'mini-timeline__tooltip-time',
        TOOLTIP_STATUS: 'mini-timeline__tooltip-status',
        TOOLTIP_DURATION: 'mini-timeline__tooltip-duration',
        NO_DATA: 'mini-timeline__no-data',
        
        // Modifiers
        HIDDEN: 'mini-timeline--hidden',
        LOADING: 'mini-timeline--loading',
        TOOLTIP_VISIBLE: 'mini-timeline__tooltip--visible'
    };
    
    // =========================================================================
    // 상태별 색상 매핑
    // =========================================================================
    static STATUS_COLORS = {
        'RUN': '#22c55e',           // Green - 정상 가동
        'SUDDENSTOP': '#ef4444',    // Red - 비상 정지
        'STOP': '#f97316',          // Orange - 정지
        'IDLE': '#eab308',          // Yellow - 유휴
        'WAIT': '#94a3b8',          // Gray - 대기
        'REMOTE': '#8b5cf6',        // Purple - 원격
        'UNKNOWN': '#64748b'        // Slate - 알 수 없음
    };
    
    // =========================================================================
    // 기본 설정
    // =========================================================================
    static CONFIG = {
        TIMELINE_HOURS: 1,          // 표시할 시간 범위 (1시간)
        CANVAS_HEIGHT: 12,          // 캔버스 높이 (픽셀)
        CANVAS_WIDTH: 100,          // 기본 캔버스 너비 (픽셀, 반응형으로 조정됨)
        MIN_SEGMENT_WIDTH: 2,       // 최소 세그먼트 너비
        BORDER_RADIUS: 3,           // 모서리 둥글기
        UPDATE_INTERVAL: 30000,     // 자동 업데이트 간격 (30초)
        TOOLTIP_OFFSET_X: 10,       // 툴팁 X 오프셋
        TOOLTIP_OFFSET_Y: -40       // 툴팁 Y 오프셋
    };
    
    // =========================================================================
    // 생성자
    // =========================================================================
    /**
     * MiniTimeline 생성자
     * @param {Object} options - 옵션
     * @param {Array} options.historyData - 상태 변경 히스토리 배열
     * @param {string} options.equipmentId - 설비 ID
     * @param {number} [options.width] - 캔버스 너비
     * @param {number} [options.height] - 캔버스 높이
     */
    constructor(options = {}) {
        this.historyData = options.historyData || [];
        this.equipmentId = options.equipmentId || 'unknown';
        this.width = options.width || MiniTimeline.CONFIG.CANVAS_WIDTH;
        this.height = options.height || MiniTimeline.CONFIG.CANVAS_HEIGHT;
        
        // DOM 요소
        this.element = null;
        this.canvas = null;
        this.ctx = null;
        this.tooltip = null;
        
        // 상태
        this._isDisposed = false;
        this._updateTimer = null;
        this._boundHandlers = {};
        
        // 초기화
        this._init();
    }
    
    // =========================================================================
    // 초기화
    // =========================================================================
    _init() {
        this._createDOM();
        this._setupCanvas();
        this._setupEventListeners();
        this._render();
        this._startAutoUpdate();
        
        console.log(`[MiniTimeline] ✅ Initialized for ${this.equipmentId}`);
    }
    
    // =========================================================================
    // DOM 생성
    // =========================================================================
    _createDOM() {
        // 컨테이너
        this.element = document.createElement('div');
        this.element.classList.add(MiniTimeline.CSS.BLOCK);
        
        // 캔버스
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add(MiniTimeline.CSS.CANVAS);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.element.appendChild(this.canvas);
        
        // 툴팁
        this.tooltip = document.createElement('div');
        this.tooltip.classList.add(MiniTimeline.CSS.TOOLTIP);
        this.tooltip.innerHTML = `
            <span class="${MiniTimeline.CSS.TOOLTIP_TIME}"></span>
            <span class="${MiniTimeline.CSS.TOOLTIP_STATUS}"></span>
            <span class="${MiniTimeline.CSS.TOOLTIP_DURATION}"></span>
        `;
        this.element.appendChild(this.tooltip);
        
        // 데이터 없음 표시
        this.noDataElement = document.createElement('div');
        this.noDataElement.classList.add(MiniTimeline.CSS.NO_DATA);
        this.noDataElement.textContent = '데이터 없음';
        this.element.appendChild(this.noDataElement);
    }
    
    // =========================================================================
    // 캔버스 설정
    // =========================================================================
    _setupCanvas() {
        this.ctx = this.canvas.getContext('2d');
        
        // HiDPI 지원
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.scale(dpr, dpr);
    }
    
    // =========================================================================
    // 이벤트 리스너 설정
    // =========================================================================
    _setupEventListeners() {
        // 마우스 이벤트 바인딩
        this._boundHandlers.onMouseMove = this._handleMouseMove.bind(this);
        this._boundHandlers.onMouseLeave = this._handleMouseLeave.bind(this);
        this._boundHandlers.onClick = this._handleClick.bind(this);
        
        this.canvas.addEventListener('mousemove', this._boundHandlers.onMouseMove);
        this.canvas.addEventListener('mouseleave', this._boundHandlers.onMouseLeave);
        this.canvas.addEventListener('click', this._boundHandlers.onClick);
    }
    
    // =========================================================================
    // 렌더링
    // =========================================================================
    _render() {
        if (this._isDisposed) return;
        
        // 캔버스 클리어
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 데이터 없음 처리
        if (!this.historyData || this.historyData.length === 0) {
            this._showNoData();
            return;
        }
        
        this._hideNoData();
        
        // 세그먼트 계산 및 렌더링
        const segments = this._calculateSegments();
        this._renderSegments(segments);
    }
    
    // =========================================================================
    // 세그먼트 계산
    // =========================================================================
    _calculateSegments() {
        const now = Date.now();
        const oneHourAgo = now - (MiniTimeline.CONFIG.TIMELINE_HOURS * 60 * 60 * 1000);
        const totalDuration = now - oneHourAgo;
        
        const segments = [];
        
        // 히스토리 데이터를 시간순으로 정렬
        const sortedHistory = [...this.historyData].sort((a, b) => {
            const timeA = new Date(a.startTime || a.occurredAt).getTime();
            const timeB = new Date(b.startTime || b.occurredAt).getTime();
            return timeA - timeB;
        });
        
        // 1시간 범위 내 데이터만 필터링
        const relevantHistory = sortedHistory.filter(item => {
            const itemTime = new Date(item.startTime || item.occurredAt).getTime();
            return itemTime >= oneHourAgo;
        });
        
        // 세그먼트 생성
        for (let i = 0; i < relevantHistory.length; i++) {
            const item = relevantHistory[i];
            const startTime = new Date(item.startTime || item.occurredAt).getTime();
            const endTime = relevantHistory[i + 1] 
                ? new Date(relevantHistory[i + 1].startTime || relevantHistory[i + 1].occurredAt).getTime()
                : now;
            
            const segmentStart = Math.max(startTime, oneHourAgo);
            const segmentEnd = Math.min(endTime, now);
            const duration = segmentEnd - segmentStart;
            
            // 비율 계산
            const startRatio = (segmentStart - oneHourAgo) / totalDuration;
            const endRatio = (segmentEnd - oneHourAgo) / totalDuration;
            
            segments.push({
                status: item.status || item.currentStatus || 'UNKNOWN',
                startTime: segmentStart,
                endTime: segmentEnd,
                duration: duration,
                x: startRatio * this.width,
                width: Math.max((endRatio - startRatio) * this.width, MiniTimeline.CONFIG.MIN_SEGMENT_WIDTH),
                originalData: item
            });
        }
        
        // 데이터가 1시간 전부터 시작하지 않는 경우 첫 번째 세그먼트 앞에 빈 영역 추가
        if (segments.length > 0 && segments[0].x > 0) {
            const firstStatus = sortedHistory.length > 0 ? (sortedHistory[0].previousStatus || 'UNKNOWN') : 'UNKNOWN';
            segments.unshift({
                status: firstStatus,
                startTime: oneHourAgo,
                endTime: segments[0].startTime,
                duration: segments[0].startTime - oneHourAgo,
                x: 0,
                width: segments[0].x,
                originalData: null
            });
        }
        
        return segments;
    }
    
    // =========================================================================
    // 세그먼트 렌더링
    // =========================================================================
    _renderSegments(segments) {
        const ctx = this.ctx;
        const radius = MiniTimeline.CONFIG.BORDER_RADIUS;
        
        // 배경 (둥근 모서리)
        ctx.fillStyle = 'var(--surface-secondary, #1e293b)';
        this._roundedRect(0, 0, this.width, this.height, radius);
        ctx.fill();
        
        // 세그먼트 렌더링
        segments.forEach((segment, index) => {
            const color = MiniTimeline.STATUS_COLORS[segment.status] || MiniTimeline.STATUS_COLORS.UNKNOWN;
            ctx.fillStyle = color;
            
            // 첫 번째와 마지막 세그먼트는 둥근 모서리 처리
            const isFirst = index === 0;
            const isLast = index === segments.length - 1;
            
            if (isFirst && isLast) {
                this._roundedRect(segment.x, 0, segment.width, this.height, radius);
            } else if (isFirst) {
                this._roundedRectLeft(segment.x, 0, segment.width, this.height, radius);
            } else if (isLast) {
                this._roundedRectRight(segment.x, 0, segment.width, this.height, radius);
            } else {
                ctx.fillRect(segment.x, 0, segment.width, this.height);
            }
            ctx.fill();
        });
        
        // 세그먼트 참조 저장 (마우스 이벤트용)
        this._segments = segments;
    }
    
    // =========================================================================
    // 둥근 모서리 사각형 헬퍼
    // =========================================================================
    _roundedRect(x, y, width, height, radius) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    _roundedRectLeft(x, y, width, height, radius) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    _roundedRectRight(x, y, width, height, radius) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
    }
    
    // =========================================================================
    // 마우스 이벤트 핸들러
    // =========================================================================
    _handleMouseMove(event) {
        if (!this._segments || this._segments.length === 0) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        // 해당 위치의 세그먼트 찾기
        const segment = this._segments.find(seg => x >= seg.x && x < seg.x + seg.width);
        
        if (segment) {
            this._showTooltip(event, segment);
        } else {
            this._hideTooltip();
        }
    }
    
    _handleMouseLeave() {
        this._hideTooltip();
    }
    
    _handleClick(event) {
        // 클릭 시 상세 정보 표시 (필요 시 EventBus emit)
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        const segment = this._segments?.find(seg => x >= seg.x && x < seg.x + seg.width);
        
        if (segment) {
            console.log(`[MiniTimeline] 📌 Clicked segment:`, segment);
        }
    }
    
    // =========================================================================
    // 툴팁 표시/숨김
    // =========================================================================
    _showTooltip(event, segment) {
        const timeElement = this.tooltip.querySelector(`.${MiniTimeline.CSS.TOOLTIP_TIME}`);
        const statusElement = this.tooltip.querySelector(`.${MiniTimeline.CSS.TOOLTIP_STATUS}`);
        const durationElement = this.tooltip.querySelector(`.${MiniTimeline.CSS.TOOLTIP_DURATION}`);
        
        // 시간 포맷
        const startDate = new Date(segment.startTime);
        const timeStr = startDate.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // 상태 텍스트
        const statusText = this._getStatusText(segment.status);
        
        // 지속 시간
        const durationStr = DurationCalculator.formatDuration(segment.duration);
        
        // 툴팁 내용 업데이트
        timeElement.textContent = timeStr;
        statusElement.textContent = statusText;
        statusElement.style.color = MiniTimeline.STATUS_COLORS[segment.status] || MiniTimeline.STATUS_COLORS.UNKNOWN;
        durationElement.textContent = durationStr;
        
        // 위치 설정
        const rect = this.canvas.getBoundingClientRect();
        const tooltipX = event.clientX - rect.left + MiniTimeline.CONFIG.TOOLTIP_OFFSET_X;
        const tooltipY = MiniTimeline.CONFIG.TOOLTIP_OFFSET_Y;
        
        this.tooltip.style.left = `${tooltipX}px`;
        this.tooltip.style.top = `${tooltipY}px`;
        
        // 표시
        this.tooltip.classList.add(MiniTimeline.CSS.TOOLTIP_VISIBLE);
    }
    
    _hideTooltip() {
        this.tooltip.classList.remove(MiniTimeline.CSS.TOOLTIP_VISIBLE);
    }
    
    // =========================================================================
    // 상태 텍스트 변환
    // =========================================================================
    _getStatusText(status) {
        const statusTexts = {
            'RUN': '가동',
            'SUDDENSTOP': '비상정지',
            'STOP': '정지',
            'IDLE': '유휴',
            'WAIT': '대기',
            'REMOTE': '원격',
            'UNKNOWN': '알 수 없음'
        };
        return statusTexts[status] || status;
    }
    
    // =========================================================================
    // 데이터 없음 표시
    // =========================================================================
    _showNoData() {
        this.noDataElement.style.display = 'flex';
        this.canvas.style.opacity = '0.3';
    }
    
    _hideNoData() {
        this.noDataElement.style.display = 'none';
        this.canvas.style.opacity = '1';
    }
    
    // =========================================================================
    // 자동 업데이트
    // =========================================================================
    _startAutoUpdate() {
        this._updateTimer = setInterval(() => {
            this._render();
        }, MiniTimeline.CONFIG.UPDATE_INTERVAL);
    }
    
    _stopAutoUpdate() {
        if (this._updateTimer) {
            clearInterval(this._updateTimer);
            this._updateTimer = null;
        }
    }
    
    // =========================================================================
    // 공개 메서드
    // =========================================================================
    
    /**
     * 데이터 업데이트
     * @param {Array} newHistoryData - 새로운 히스토리 데이터
     */
    update(newHistoryData) {
        if (this._isDisposed) return;
        
        this.historyData = newHistoryData || [];
        this._render();
        
        console.log(`[MiniTimeline] 🔄 Updated for ${this.equipmentId}:`, this.historyData.length, 'records');
    }
    
    /**
     * 새 상태 이벤트 추가
     * @param {Object} statusEvent - 상태 변경 이벤트
     */
    addStatusEvent(statusEvent) {
        if (this._isDisposed) return;
        
        this.historyData.push(statusEvent);
        
        // 1시간 이전 데이터 제거
        const oneHourAgo = Date.now() - (MiniTimeline.CONFIG.TIMELINE_HOURS * 60 * 60 * 1000);
        this.historyData = this.historyData.filter(item => {
            const itemTime = new Date(item.startTime || item.occurredAt).getTime();
            return itemTime >= oneHourAgo;
        });
        
        this._render();
    }
    
    /**
     * 크기 조정
     * @param {number} width - 새 너비
     * @param {number} [height] - 새 높이
     */
    resize(width, height) {
        if (this._isDisposed) return;
        
        this.width = width;
        if (height) this.height = height;
        
        this._setupCanvas();
        this._render();
    }
    
    /**
     * DOM 요소 반환
     * @returns {HTMLElement}
     */
    getElement() {
        return this.element;
    }
    
    /**
     * 표시
     */
    show() {
        if (this.element) {
            this.element.classList.remove(MiniTimeline.CSS.HIDDEN);
        }
    }
    
    /**
     * 숨김
     */
    hide() {
        if (this.element) {
            this.element.classList.add(MiniTimeline.CSS.HIDDEN);
        }
    }
    
    /**
     * 정리
     */
    dispose() {
        if (this._isDisposed) return;
        
        console.log(`[MiniTimeline] 🗑️ Disposing for ${this.equipmentId}`);
        
        // 타이머 정리
        this._stopAutoUpdate();
        
        // 이벤트 리스너 제거
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
            this.canvas.removeEventListener('mouseleave', this._boundHandlers.onMouseLeave);
            this.canvas.removeEventListener('click', this._boundHandlers.onClick);
        }
        this._boundHandlers = {};
        
        // DOM 제거
        this.element?.remove();
        
        // 참조 해제
        this.element = null;
        this.canvas = null;
        this.ctx = null;
        this.tooltip = null;
        this.noDataElement = null;
        this.historyData = [];
        this._segments = null;
        
        this._isDisposed = true;
    }
}