/**
 * ConnectionIndicator.js
 * 
 * Backend 연결 상태를 시각적으로 표시하는 UI 컴포넌트
 * - 온라인/오프라인/체크중 상태 표시
 * - ConnectionStatusService와 자동 연동
 * - 호버 시 상세 정보 툴팁 표시
 * - Mock 모드 테스트 컨트롤 (개발 모드)
 * 
 * @version 2.0.0
 * @description
 *   - v1.0.0: 초기 버전
 *   - v2.0.0: _injectStyles() 제거, CSS 파일 분리 (_connection-indicator.css)
 * 
 * @location frontend/threejs_viewer/src/ui/ConnectionIndicator.js
 */

import ConnectionStatusService, { 
    ConnectionState, 
    ConnectionEvents 
} from '../services/ConnectionStatusService.js';

/**
 * 상태별 설정
 */
const STATUS_CONFIG = {
    [ConnectionState.ONLINE]: {
        color: '#22c55e',
        pulseColor: '#4ade80',
        icon: '●',
        label: 'Connected',
        description: 'Backend 서버에 연결됨'
    },
    [ConnectionState.OFFLINE]: {
        color: '#ef4444',
        pulseColor: '#f87171',
        icon: '●',
        label: 'Disconnected',
        description: 'Backend 서버에 연결할 수 없음'
    },
    [ConnectionState.CHECKING]: {
        color: '#f59e0b',
        pulseColor: '#fbbf24',
        icon: '◐',
        label: 'Checking...',
        description: '연결 상태 확인 중'
    },
    [ConnectionState.UNKNOWN]: {
        color: '#6b7280',
        pulseColor: '#9ca3af',
        icon: '○',
        label: 'Unknown',
        description: '연결 상태를 알 수 없음'
    }
};

/**
 * ConnectionIndicator
 * 
 * Backend 연결 상태를 표시하는 UI 컴포넌트
 */
class ConnectionIndicator {
    /**
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement|string} options.container - 컨테이너 요소 또는 선택자
     * @param {string} options.position - 위치 ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'custom')
     * @param {boolean} options.showLabel - 라벨 텍스트 표시 여부
     * @param {boolean} options.showTooltip - 툴팁 표시 여부
     * @param {boolean} options.showMockControls - Mock 컨트롤 표시 여부 (개발용)
     * @param {boolean} options.animate - 애니메이션 효과 여부
     * @param {string} options.size - 크기 ('small', 'medium', 'large')
     * @param {number} options.zIndex - z-index 값
     */
    constructor(options = {}) {
        this._options = {
            container: options.container || document.body,
            position: options.position || 'top-right',
            showLabel: options.showLabel ?? true,
            showTooltip: options.showTooltip ?? true,
            showMockControls: options.showMockControls ?? false,
            animate: options.animate ?? true,
            size: options.size || 'medium',
            zIndex: options.zIndex || 9999,
            offsetX: options.offsetX || 20,
            offsetY: options.offsetY || 20
        };

        // DOM 요소
        this._element = null;
        this._indicatorDot = null;
        this._labelElement = null;
        this._tooltipElement = null;
        this._mockControlsElement = null;

        // 서비스 연결
        this._connectionService = ConnectionStatusService.getInstance();
        
        // 이벤트 구독 해제 함수들
        this._unsubscribers = [];

        // 툴팁 업데이트 인터벌
        this._tooltipUpdateInterval = null;

        // 초기화
        this._init();
    }

    // =========================================================================
    // 초기화
    // =========================================================================

    /**
     * 컴포넌트 초기화
     * @private
     */
    _init() {
        // 스타일은 CSS 파일에서 로드됨 (_connection-indicator.css)
        this._createElement();
        this._bindEvents();
        this._updateDisplay();
    }

    /**
     * DOM 요소 생성
     * @private
     */
    _createElement() {
        // 컨테이너 확인
        const container = typeof this._options.container === 'string'
            ? document.querySelector(this._options.container)
            : this._options.container;

        if (!container) {
            console.error('[ConnectionIndicator] Container not found');
            return;
        }

        // 메인 요소 생성
        this._element = document.createElement('div');
        this._element.className = this._buildClassNames();
        this._element.style.setProperty('--ci-offset-x', `${this._options.offsetX}px`);
        this._element.style.setProperty('--ci-offset-y', `${this._options.offsetY}px`);
        this._element.style.zIndex = this._options.zIndex;

        // 내부 구조 생성
        this._element.innerHTML = this._buildInnerHTML();

        // 요소 참조 저장
        this._indicatorDot = this._element.querySelector('.connection-indicator__dot');
        this._labelElement = this._element.querySelector('.connection-indicator__label');
        this._tooltipElement = this._element.querySelector('.connection-indicator__tooltip');
        this._mockControlsElement = this._element.querySelector('.connection-indicator__mock-controls');

        // Mock 컨트롤 이벤트 바인딩
        if (this._options.showMockControls) {
            this._bindMockControlEvents();
        }

        // DOM에 추가
        container.appendChild(this._element);
    }

    /**
     * 클래스명 빌드
     * @private
     */
    _buildClassNames() {
        const classes = ['connection-indicator'];

        // 위치
        if (this._options.position !== 'custom') {
            classes.push('connection-indicator--fixed');
            classes.push(`connection-indicator--${this._options.position}`);
        }

        // 크기
        if (this._options.size !== 'medium') {
            classes.push(`connection-indicator--${this._options.size}`);
        }

        // 애니메이션
        if (this._options.animate) {
            classes.push('connection-indicator--animate');
        }

        return classes.join(' ');
    }

    /**
     * 내부 HTML 빌드
     * @private
     */
    _buildInnerHTML() {
        let html = `
            <div class="connection-indicator__dot"></div>
        `;

        // 라벨
        if (this._options.showLabel) {
            html += `<span class="connection-indicator__label">Unknown</span>`;
        }

        // Mock 컨트롤
        if (this._options.showMockControls) {
            html += `
                <div class="connection-indicator__mock-controls">
                    <button class="connection-indicator__mock-btn connection-indicator__mock-btn--on" 
                            data-action="mock-on" title="Set Online">ON</button>
                    <button class="connection-indicator__mock-btn connection-indicator__mock-btn--off" 
                            data-action="mock-off" title="Set Offline">OFF</button>
                    <button class="connection-indicator__mock-btn connection-indicator__mock-btn--toggle" 
                            data-action="mock-toggle" title="Toggle">⟳</button>
                </div>
            `;
        }

        // 툴팁
        if (this._options.showTooltip) {
            html += `
                <div class="connection-indicator__tooltip">
                    <div class="connection-indicator__tooltip-row">
                        <span class="connection-indicator__tooltip-label">상태</span>
                        <span class="connection-indicator__tooltip-value" data-field="status">-</span>
                    </div>
                    <div class="connection-indicator__tooltip-row">
                        <span class="connection-indicator__tooltip-label">마지막 체크</span>
                        <span class="connection-indicator__tooltip-value" data-field="lastCheck">-</span>
                    </div>
                    <div class="connection-indicator__tooltip-row">
                        <span class="connection-indicator__tooltip-label">성공률</span>
                        <span class="connection-indicator__tooltip-value" data-field="successRate">-</span>
                    </div>
                    <div class="connection-indicator__tooltip-row">
                        <span class="connection-indicator__tooltip-label">연속 실패</span>
                        <span class="connection-indicator__tooltip-value" data-field="failures">-</span>
                    </div>
                    <div class="connection-indicator__tooltip-row">
                        <span class="connection-indicator__tooltip-label">모드</span>
                        <span class="connection-indicator__tooltip-value" data-field="mode">-</span>
                    </div>
                </div>
            `;
        }

        return html;
    }

    // =========================================================================
    // 이벤트 바인딩
    // =========================================================================

    /**
     * 이벤트 바인딩
     * @private
     */
    _bindEvents() {
        // 상태 변경 이벤트 구독
        const unsubStatusChanged = this._connectionService.onStatusChanged((data) => {
            this._updateDisplay();
        });
        this._unsubscribers.push(unsubStatusChanged);

        // 체크 시작 이벤트
        const unsubCheckStarted = this._connectionService.on(
            ConnectionEvents.CHECK_STARTED, 
            () => this._onCheckStarted()
        );
        this._unsubscribers.push(unsubCheckStarted);

        // 체크 완료 이벤트
        const unsubCheckCompleted = this._connectionService.on(
            ConnectionEvents.CHECK_COMPLETED,
            () => this._onCheckCompleted()
        );
        this._unsubscribers.push(unsubCheckCompleted);

        // 툴팁 업데이트 인터벌 (마지막 체크 시간 갱신)
        if (this._options.showTooltip) {
            this._tooltipUpdateInterval = setInterval(() => {
                this._updateTooltipTime();
            }, 1000);
        }
    }

    /**
     * Mock 컨트롤 이벤트 바인딩
     * @private
     */
    _bindMockControlEvents() {
        if (!this._mockControlsElement) return;

        this._mockControlsElement.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            
            // Mock 모드가 아니면 먼저 활성화
            if (!this._connectionService.isMockMode()) {
                this._connectionService.enableMockMode();
            }

            switch (action) {
                case 'mock-on':
                    this._connectionService.setMockOnline(true);
                    break;
                case 'mock-off':
                    this._connectionService.setMockOnline(false);
                    break;
                case 'mock-toggle':
                    this._connectionService.toggleMockOnline();
                    break;
            }
        });
    }

    // =========================================================================
    // 디스플레이 업데이트
    // =========================================================================

    /**
     * 전체 디스플레이 업데이트
     * @private
     */
    _updateDisplay() {
        if (!this._element) return;

        const state = this._connectionService.getState();
        const config = STATUS_CONFIG[state] || STATUS_CONFIG[ConnectionState.UNKNOWN];

        // CSS 변수 업데이트
        this._element.style.setProperty('--ci-color', config.color);
        this._element.style.setProperty('--ci-pulse-color', config.pulseColor);

        // Dot 클래스 업데이트
        if (this._indicatorDot) {
            this._indicatorDot.className = 'connection-indicator__dot';
            this._indicatorDot.classList.add(`connection-indicator__dot--${state}`);
        }

        // 라벨 업데이트
        if (this._labelElement) {
            this._labelElement.textContent = config.label;
            this._labelElement.className = 'connection-indicator__label';
            this._labelElement.classList.add(`connection-indicator__label--${state}`);
        }

        // Mock 뱃지 업데이트
        this._updateMockBadge();

        // 툴팁 업데이트
        this._updateTooltip();
    }

    /**
     * Mock 뱃지 업데이트
     * @private
     */
    _updateMockBadge() {
        // 기존 뱃지 제거
        const existingBadge = this._element.querySelector('.connection-indicator__mock-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Mock 모드일 때만 뱃지 추가
        if (this._connectionService.isMockMode()) {
            const badge = document.createElement('span');
            badge.className = 'connection-indicator__mock-badge';
            badge.textContent = 'MOCK';
            
            // 라벨 다음에 삽입
            if (this._labelElement) {
                this._labelElement.after(badge);
            } else if (this._indicatorDot) {
                this._indicatorDot.after(badge);
            }
        }
    }

    /**
     * 툴팁 업데이트
     * @private
     */
    _updateTooltip() {
        if (!this._tooltipElement) return;

        const status = this._connectionService.getStatus();
        const state = this._connectionService.getState();
        const config = STATUS_CONFIG[state] || STATUS_CONFIG[ConnectionState.UNKNOWN];

        // 상태
        const statusEl = this._tooltipElement.querySelector('[data-field="status"]');
        if (statusEl) {
            statusEl.textContent = config.description;
            statusEl.className = 'connection-indicator__tooltip-value';
            if (state === ConnectionState.ONLINE) {
                statusEl.classList.add('connection-indicator__tooltip-value--success');
            } else if (state === ConnectionState.OFFLINE) {
                statusEl.classList.add('connection-indicator__tooltip-value--error');
            }
        }

        // 마지막 체크 시간
        this._updateTooltipTime();

        // 성공률
        const successRateEl = this._tooltipElement.querySelector('[data-field="successRate"]');
        if (successRateEl) {
            successRateEl.textContent = `${status.successRate}%`;
        }

        // 연속 실패
        const failuresEl = this._tooltipElement.querySelector('[data-field="failures"]');
        if (failuresEl) {
            failuresEl.textContent = status.consecutiveFailures.toString();
            failuresEl.className = 'connection-indicator__tooltip-value';
            if (status.consecutiveFailures > 0) {
                failuresEl.classList.add('connection-indicator__tooltip-value--error');
            }
        }

        // 모드
        const modeEl = this._tooltipElement.querySelector('[data-field="mode"]');
        if (modeEl) {
            modeEl.textContent = status.isMockMode ? 'Mock' : 'Live';
        }
    }

    /**
     * 툴팁 시간 업데이트
     * @private
     */
    _updateTooltipTime() {
        if (!this._tooltipElement) return;

        const lastCheckEl = this._tooltipElement.querySelector('[data-field="lastCheck"]');
        if (lastCheckEl) {
            const seconds = this._connectionService.getSecondsSinceLastCheck();
            if (seconds === null) {
                lastCheckEl.textContent = '아직 없음';
            } else if (seconds < 5) {
                lastCheckEl.textContent = '방금 전';
            } else if (seconds < 60) {
                lastCheckEl.textContent = `${seconds}초 전`;
            } else {
                const minutes = Math.floor(seconds / 60);
                lastCheckEl.textContent = `${minutes}분 전`;
            }
        }
    }

    /**
     * 체크 시작 시 처리
     * @private
     */
    _onCheckStarted() {
        // ConnectionStatusService에서 이미 처리됨
    }

    /**
     * 체크 완료 시 처리
     * @private
     */
    _onCheckCompleted() {
        this._updateTooltip();
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * 컴포넌트 표시
     */
    show() {
        if (this._element) {
            this._element.classList.remove('connection-indicator--hidden');
        }
    }

    /**
     * 컴포넌트 숨김
     */
    hide() {
        if (this._element) {
            this._element.classList.add('connection-indicator--hidden');
        }
    }

    /**
     * 표시/숨김 토글
     */
    toggle() {
        if (this._element) {
            this._element.classList.toggle('connection-indicator--hidden');
        }
    }

    /**
     * 가시성 여부
     * @returns {boolean}
     */
    isVisible() {
        return this._element && !this._element.classList.contains('connection-indicator--hidden');
    }

    /**
     * 위치 변경
     * @param {string} position - 새 위치
     */
    setPosition(position) {
        if (!this._element) return;

        // 기존 위치 클래스 제거
        this._element.classList.remove(
            'connection-indicator--top-right',
            'connection-indicator--top-left',
            'connection-indicator--bottom-right',
            'connection-indicator--bottom-left'
        );

        this._options.position = position;

        if (position !== 'custom') {
            this._element.classList.add('connection-indicator--fixed');
            this._element.classList.add(`connection-indicator--${position}`);
        } else {
            this._element.classList.remove('connection-indicator--fixed');
        }
    }

    /**
     * 오프셋 변경
     * @param {number} x - X 오프셋
     * @param {number} y - Y 오프셋
     */
    setOffset(x, y) {
        if (!this._element) return;

        this._options.offsetX = x;
        this._options.offsetY = y;
        this._element.style.setProperty('--ci-offset-x', `${x}px`);
        this._element.style.setProperty('--ci-offset-y', `${y}px`);
    }

    /**
     * Mock 컨트롤 표시/숨김
     * @param {boolean} show - 표시 여부
     */
    showMockControls(show) {
        if (!this._element) return;

        if (show && !this._mockControlsElement) {
            // Mock 컨트롤 추가
            const controls = document.createElement('div');
            controls.className = 'connection-indicator__mock-controls';
            controls.innerHTML = `
                <button class="connection-indicator__mock-btn connection-indicator__mock-btn--on" 
                        data-action="mock-on" title="Set Online">ON</button>
                <button class="connection-indicator__mock-btn connection-indicator__mock-btn--off" 
                        data-action="mock-off" title="Set Offline">OFF</button>
                <button class="connection-indicator__mock-btn connection-indicator__mock-btn--toggle" 
                        data-action="mock-toggle" title="Toggle">⟳</button>
            `;
            this._element.appendChild(controls);
            this._mockControlsElement = controls;
            this._bindMockControlEvents();
        } else if (!show && this._mockControlsElement) {
            // Mock 컨트롤 제거
            this._mockControlsElement.remove();
            this._mockControlsElement = null;
        }

        this._options.showMockControls = show;
    }

    /**
     * DOM 요소 반환
     * @returns {HTMLElement|null}
     */
    getElement() {
        return this._element;
    }

    /**
     * 컴포넌트 파괴
     */
    destroy() {
        // 이벤트 구독 해제
        this._unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._unsubscribers = [];

        // 인터벌 정리
        if (this._tooltipUpdateInterval) {
            clearInterval(this._tooltipUpdateInterval);
            this._tooltipUpdateInterval = null;
        }

        // DOM 제거
        if (this._element && this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }

        this._element = null;
        this._indicatorDot = null;
        this._labelElement = null;
        this._tooltipElement = null;
        this._mockControlsElement = null;
    }

    /**
     * 수동 새로고침
     */
    refresh() {
        this._updateDisplay();
    }
}

// 기본 내보내기
export default ConnectionIndicator;

// Named export
export { ConnectionIndicator, STATUS_CONFIG };

console.log('✅ ConnectionIndicator.js v2.0.0 로드 완료');