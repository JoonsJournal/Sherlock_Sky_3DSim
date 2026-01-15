/**
 * ConnectionIndicator.js
 * 
 * Backend 연결 상태를 시각적으로 표시하는 UI 컴포넌트
 * - 온라인/오프라인/체크중 상태 표시
 * - ConnectionStatusService와 자동 연동
 * - 호버 시 상세 정보 툴팁 표시
 * - Mock 모드 테스트 컨트롤 (개발 모드)
 * 
 * @version 3.0.0
 * @description
 *   - 🆕 v3.0.0: Phase 4 CSS Integration
 *     - static CSS 상수 정의
 *     - BEM 네이밍 규칙 적용
 *     - classList API 통일
 *     - Glow 효과 클래스 추가 (Dark Mode)
 *   - v2.0.0: _injectStyles() 제거, CSS 파일 분리 (_connection-indicator.css)
 *   - v1.0.0: 초기 버전
 * 
 * @location frontend/threejs_viewer/src/ui/ConnectionIndicator.js
 */

import ConnectionStatusService, { 
    ConnectionState, 
    ConnectionEvents 
} from '../services/ConnectionStatusService.js';

// ============================================
// CSS 클래스 상수 (Phase 4)
// ============================================

/**
 * ConnectionIndicator BEM 클래스명 상수
 * @static
 */
const CSS = {
    // Block
    BLOCK: 'connection-indicator',
    
    // Position Modifiers
    FIXED: 'connection-indicator--fixed',
    TOP_RIGHT: 'connection-indicator--top-right',
    TOP_LEFT: 'connection-indicator--top-left',
    BOTTOM_RIGHT: 'connection-indicator--bottom-right',
    BOTTOM_LEFT: 'connection-indicator--bottom-left',
    
    // Size Modifiers
    SMALL: 'connection-indicator--small',
    MEDIUM: 'connection-indicator--medium',
    LARGE: 'connection-indicator--large',
    
    // State Modifiers
    HIDDEN: 'connection-indicator--hidden',
    ANIMATE: 'connection-indicator--animate',
    
    // Glow Effect (Dark Mode)
    GLOW: 'connection-indicator--glow',
    GLOW_ONLINE: 'connection-indicator--glow-online',
    GLOW_OFFLINE: 'connection-indicator--glow-offline',
    
    // Elements - Dot
    DOT: 'connection-indicator__dot',
    DOT_ONLINE: 'connection-indicator__dot--online',
    DOT_OFFLINE: 'connection-indicator__dot--offline',
    DOT_CHECKING: 'connection-indicator__dot--checking',
    DOT_UNKNOWN: 'connection-indicator__dot--unknown',
    
    // Elements - Label
    LABEL: 'connection-indicator__label',
    LABEL_ONLINE: 'connection-indicator__label--online',
    LABEL_OFFLINE: 'connection-indicator__label--offline',
    LABEL_CHECKING: 'connection-indicator__label--checking',
    LABEL_UNKNOWN: 'connection-indicator__label--unknown',
    
    // Elements - Tooltip
    TOOLTIP: 'connection-indicator__tooltip',
    TOOLTIP_ROW: 'connection-indicator__tooltip-row',
    TOOLTIP_LABEL: 'connection-indicator__tooltip-label',
    TOOLTIP_VALUE: 'connection-indicator__tooltip-value',
    TOOLTIP_VALUE_SUCCESS: 'connection-indicator__tooltip-value--success',
    TOOLTIP_VALUE_ERROR: 'connection-indicator__tooltip-value--error',
    
    // Elements - Mock Controls
    MOCK_CONTROLS: 'connection-indicator__mock-controls',
    MOCK_BTN: 'connection-indicator__mock-btn',
    MOCK_BTN_ON: 'connection-indicator__mock-btn--on',
    MOCK_BTN_OFF: 'connection-indicator__mock-btn--off',
    MOCK_BTN_TOGGLE: 'connection-indicator__mock-btn--toggle',
    MOCK_BADGE: 'connection-indicator__mock-badge'
};

/**
 * 상태별 설정
 */
const STATUS_CONFIG = {
    [ConnectionState.ONLINE]: {
        color: '#22c55e',
        pulseColor: '#4ade80',
        icon: '●',
        label: 'Connected',
        description: 'Backend 서버에 연결됨',
        dotModifier: CSS.DOT_ONLINE,
        labelModifier: CSS.LABEL_ONLINE,
        glowModifier: CSS.GLOW_ONLINE
    },
    [ConnectionState.OFFLINE]: {
        color: '#ef4444',
        pulseColor: '#f87171',
        icon: '●',
        label: 'Disconnected',
        description: 'Backend 서버에 연결할 수 없음',
        dotModifier: CSS.DOT_OFFLINE,
        labelModifier: CSS.LABEL_OFFLINE,
        glowModifier: CSS.GLOW_OFFLINE
    },
    [ConnectionState.CHECKING]: {
        color: '#f59e0b',
        pulseColor: '#fbbf24',
        icon: '◐',
        label: 'Checking...',
        description: '연결 상태 확인 중',
        dotModifier: CSS.DOT_CHECKING,
        labelModifier: CSS.LABEL_CHECKING,
        glowModifier: null
    },
    [ConnectionState.UNKNOWN]: {
        color: '#6b7280',
        pulseColor: '#9ca3af',
        icon: '○',
        label: 'Unknown',
        description: '연결 상태를 알 수 없음',
        dotModifier: CSS.DOT_UNKNOWN,
        labelModifier: CSS.LABEL_UNKNOWN,
        glowModifier: null
    }
};

/**
 * ConnectionIndicator
 * 
 * Backend 연결 상태를 표시하는 UI 컴포넌트
 */
class ConnectionIndicator {
    // =========================================================================
    // Static CSS 상수 (외부 접근용)
    // =========================================================================
    
    static CSS = CSS;
    
    /**
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement|string} options.container - 컨테이너 요소 또는 선택자
     * @param {string} options.position - 위치 ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'custom')
     * @param {boolean} options.showLabel - 라벨 텍스트 표시 여부
     * @param {boolean} options.showTooltip - 툴팁 표시 여부
     * @param {boolean} options.showMockControls - Mock 컨트롤 표시 여부 (개발용)
     * @param {boolean} options.animate - 애니메이션 효과 여부
     * @param {boolean} options.enableGlow - Glow 효과 활성화 (Dark Mode)
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
            enableGlow: options.enableGlow ?? true,
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

        // 현재 상태 추적 (클래스 토글용)
        this._currentState = null;

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
        this._applyBaseClasses();
        this._element.style.setProperty('--ci-offset-x', `${this._options.offsetX}px`);
        this._element.style.setProperty('--ci-offset-y', `${this._options.offsetY}px`);
        this._element.style.zIndex = this._options.zIndex;

        // 내부 구조 생성
        this._element.innerHTML = this._buildInnerHTML();

        // 요소 참조 저장
        this._indicatorDot = this._element.querySelector(`.${CSS.DOT}`);
        this._labelElement = this._element.querySelector(`.${CSS.LABEL}`);
        this._tooltipElement = this._element.querySelector(`.${CSS.TOOLTIP}`);
        this._mockControlsElement = this._element.querySelector(`.${CSS.MOCK_CONTROLS}`);

        // Mock 컨트롤 이벤트 바인딩
        if (this._options.showMockControls) {
            this._bindMockControlEvents();
        }

        // DOM에 추가
        container.appendChild(this._element);
    }

    /**
     * 기본 클래스 적용
     * @private
     */
    _applyBaseClasses() {
        // Block 클래스
        this._element.classList.add(CSS.BLOCK);

        // 위치
        if (this._options.position !== 'custom') {
            this._element.classList.add(CSS.FIXED);
            this._element.classList.add(this._getPositionClass(this._options.position));
        }

        // 크기
        if (this._options.size !== 'medium') {
            this._element.classList.add(this._getSizeClass(this._options.size));
        }

        // 애니메이션
        if (this._options.animate) {
            this._element.classList.add(CSS.ANIMATE);
        }

        // Glow 효과
        if (this._options.enableGlow) {
            this._element.classList.add(CSS.GLOW);
        }
    }

    /**
     * 위치 클래스 반환
     * @private
     */
    _getPositionClass(position) {
        const positionMap = {
            'top-right': CSS.TOP_RIGHT,
            'top-left': CSS.TOP_LEFT,
            'bottom-right': CSS.BOTTOM_RIGHT,
            'bottom-left': CSS.BOTTOM_LEFT
        };
        return positionMap[position] || CSS.TOP_RIGHT;
    }

    /**
     * 크기 클래스 반환
     * @private
     */
    _getSizeClass(size) {
        const sizeMap = {
            'small': CSS.SMALL,
            'medium': CSS.MEDIUM,
            'large': CSS.LARGE
        };
        return sizeMap[size] || CSS.MEDIUM;
    }

    /**
     * 내부 HTML 빌드
     * @private
     */
    _buildInnerHTML() {
        let html = `<div class="${CSS.DOT}"></div>`;

        // 라벨
        if (this._options.showLabel) {
            html += `<span class="${CSS.LABEL}">Unknown</span>`;
        }

        // Mock 컨트롤
        if (this._options.showMockControls) {
            html += `
                <div class="${CSS.MOCK_CONTROLS}">
                    <button class="${CSS.MOCK_BTN} ${CSS.MOCK_BTN_ON}" 
                            data-action="mock-on" title="Set Online">ON</button>
                    <button class="${CSS.MOCK_BTN} ${CSS.MOCK_BTN_OFF}" 
                            data-action="mock-off" title="Set Offline">OFF</button>
                    <button class="${CSS.MOCK_BTN} ${CSS.MOCK_BTN_TOGGLE}" 
                            data-action="mock-toggle" title="Toggle">⟳</button>
                </div>
            `;
        }

        // 툴팁
        if (this._options.showTooltip) {
            html += `
                <div class="${CSS.TOOLTIP}">
                    <div class="${CSS.TOOLTIP_ROW}">
                        <span class="${CSS.TOOLTIP_LABEL}">상태</span>
                        <span class="${CSS.TOOLTIP_VALUE}" data-field="status">-</span>
                    </div>
                    <div class="${CSS.TOOLTIP_ROW}">
                        <span class="${CSS.TOOLTIP_LABEL}">마지막 체크</span>
                        <span class="${CSS.TOOLTIP_VALUE}" data-field="lastCheck">-</span>
                    </div>
                    <div class="${CSS.TOOLTIP_ROW}">
                        <span class="${CSS.TOOLTIP_LABEL}">성공률</span>
                        <span class="${CSS.TOOLTIP_VALUE}" data-field="successRate">-</span>
                    </div>
                    <div class="${CSS.TOOLTIP_ROW}">
                        <span class="${CSS.TOOLTIP_LABEL}">연속 실패</span>
                        <span class="${CSS.TOOLTIP_VALUE}" data-field="failures">-</span>
                    </div>
                    <div class="${CSS.TOOLTIP_ROW}">
                        <span class="${CSS.TOOLTIP_LABEL}">모드</span>
                        <span class="${CSS.TOOLTIP_VALUE}" data-field="mode">-</span>
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
        const prevState = this._currentState;

        // CSS 변수 업데이트
        this._element.style.setProperty('--ci-color', config.color);
        this._element.style.setProperty('--ci-pulse-color', config.pulseColor);

        // 이전 상태 클래스 제거
        if (prevState && STATUS_CONFIG[prevState]) {
            const prevConfig = STATUS_CONFIG[prevState];
            if (this._indicatorDot && prevConfig.dotModifier) {
                this._indicatorDot.classList.remove(prevConfig.dotModifier);
            }
            if (this._labelElement && prevConfig.labelModifier) {
                this._labelElement.classList.remove(prevConfig.labelModifier);
            }
            if (this._options.enableGlow && prevConfig.glowModifier) {
                this._element.classList.remove(prevConfig.glowModifier);
            }
        }

        // 새 상태 클래스 추가
        if (this._indicatorDot && config.dotModifier) {
            this._indicatorDot.classList.add(config.dotModifier);
        }
        if (this._labelElement) {
            this._labelElement.textContent = config.label;
            if (config.labelModifier) {
                this._labelElement.classList.add(config.labelModifier);
            }
        }
        if (this._options.enableGlow && config.glowModifier) {
            this._element.classList.add(config.glowModifier);
        }

        // 현재 상태 저장
        this._currentState = state;

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
        const existingBadge = this._element.querySelector(`.${CSS.MOCK_BADGE}`);
        if (existingBadge) {
            existingBadge.remove();
        }

        // Mock 모드일 때만 뱃지 추가
        if (this._connectionService.isMockMode()) {
            const badge = document.createElement('span');
            badge.classList.add(CSS.MOCK_BADGE);
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
            // 이전 상태 클래스 제거
            statusEl.classList.remove(CSS.TOOLTIP_VALUE_SUCCESS, CSS.TOOLTIP_VALUE_ERROR);
            // 새 상태 클래스 추가
            if (state === ConnectionState.ONLINE) {
                statusEl.classList.add(CSS.TOOLTIP_VALUE_SUCCESS);
            } else if (state === ConnectionState.OFFLINE) {
                statusEl.classList.add(CSS.TOOLTIP_VALUE_ERROR);
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
            // 이전 상태 클래스 제거 후 조건부 추가
            failuresEl.classList.remove(CSS.TOOLTIP_VALUE_ERROR);
            if (status.consecutiveFailures > 0) {
                failuresEl.classList.add(CSS.TOOLTIP_VALUE_ERROR);
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
            this._element.classList.remove(CSS.HIDDEN);
        }
    }

    /**
     * 컴포넌트 숨김
     */
    hide() {
        if (this._element) {
            this._element.classList.add(CSS.HIDDEN);
        }
    }

    /**
     * 표시/숨김 토글
     */
    toggle() {
        if (this._element) {
            this._element.classList.toggle(CSS.HIDDEN);
        }
    }

    /**
     * 가시성 여부
     * @returns {boolean}
     */
    isVisible() {
        return this._element && !this._element.classList.contains(CSS.HIDDEN);
    }

    /**
     * 위치 변경
     * @param {string} position - 새 위치
     */
    setPosition(position) {
        if (!this._element) return;

        // 기존 위치 클래스 제거
        this._element.classList.remove(
            CSS.TOP_RIGHT,
            CSS.TOP_LEFT,
            CSS.BOTTOM_RIGHT,
            CSS.BOTTOM_LEFT
        );

        this._options.position = position;

        if (position !== 'custom') {
            this._element.classList.add(CSS.FIXED);
            this._element.classList.add(this._getPositionClass(position));
        } else {
            this._element.classList.remove(CSS.FIXED);
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
     * Glow 효과 활성화/비활성화
     * @param {boolean} enabled - 활성화 여부
     */
    setGlowEnabled(enabled) {
        if (!this._element) return;

        this._options.enableGlow = enabled;
        this._element.classList.toggle(CSS.GLOW, enabled);
        
        // 현재 상태의 glow 클래스도 업데이트
        if (enabled && this._currentState) {
            const config = STATUS_CONFIG[this._currentState];
            if (config && config.glowModifier) {
                this._element.classList.add(config.glowModifier);
            }
        } else {
            // 모든 glow 상태 클래스 제거
            this._element.classList.remove(CSS.GLOW_ONLINE, CSS.GLOW_OFFLINE);
        }
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
            controls.classList.add(CSS.MOCK_CONTROLS);
            controls.innerHTML = `
                <button class="${CSS.MOCK_BTN} ${CSS.MOCK_BTN_ON}" 
                        data-action="mock-on" title="Set Online">ON</button>
                <button class="${CSS.MOCK_BTN} ${CSS.MOCK_BTN_OFF}" 
                        data-action="mock-off" title="Set Offline">OFF</button>
                <button class="${CSS.MOCK_BTN} ${CSS.MOCK_BTN_TOGGLE}" 
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
        this._currentState = null;
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
export { ConnectionIndicator, CSS as CONNECTION_INDICATOR_CSS, STATUS_CONFIG };

console.log('✅ ConnectionIndicator.js v3.0.0 로드 완료 (Phase 4 CSS Integration)');