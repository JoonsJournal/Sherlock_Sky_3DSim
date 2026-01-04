/**
 * AutoSaveIndicator.js
 * 
 * AutoSave 상태를 시각적으로 표시하는 UI 컴포넌트
 * - 저장 상태 표시 (저장됨/저장중/미저장)
 * - 마지막 저장 시간 표시
 * - 수동 저장 버튼
 * - EventBus를 통한 AutoSave 이벤트 연동
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/ui/AutoSaveIndicator.js
 */

import { eventBus } from '../core/managers/EventBus.js';

/**
 * 저장 상태 정의
 */
const SaveState = {
    IDLE: 'idle',           // 대기 중 (변경 없음)
    DIRTY: 'dirty',         // 미저장 변경 있음
    SAVING: 'saving',       // 저장 중
    SAVED: 'saved',         // 저장 완료
    ERROR: 'error'          // 저장 오류
};

/**
 * 상태별 설정
 */
const STATUS_CONFIG = {
    [SaveState.IDLE]: {
        color: '#6b7280',        // 회색
        icon: '○',
        label: 'Idle',
        description: '변경 사항 없음'
    },
    [SaveState.DIRTY]: {
        color: '#f59e0b',        // 노란색/주황색
        icon: '●',
        label: 'Unsaved',
        description: '저장되지 않은 변경 있음'
    },
    [SaveState.SAVING]: {
        color: '#3b82f6',        // 파란색
        icon: '◐',
        label: 'Saving...',
        description: '저장 중'
    },
    [SaveState.SAVED]: {
        color: '#22c55e',        // 초록색
        icon: '●',
        label: 'Saved',
        description: '저장됨'
    },
    [SaveState.ERROR]: {
        color: '#ef4444',        // 빨간색
        icon: '●',
        label: 'Error',
        description: '저장 실패'
    }
};

/**
 * AutoSaveIndicator
 * 
 * AutoSave 상태를 표시하는 UI 컴포넌트
 */
class AutoSaveIndicator {
    /**
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement|string} options.container - 컨테이너 요소 또는 선택자
     * @param {string} options.position - 위치 ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'custom')
     * @param {boolean} options.showLabel - 라벨 텍스트 표시 여부
     * @param {boolean} options.showSaveButton - 수동 저장 버튼 표시 여부
     * @param {boolean} options.showTooltip - 툴팁 표시 여부
     * @param {boolean} options.animate - 애니메이션 효과 여부
     * @param {string} options.size - 크기 ('small', 'medium', 'large')
     * @param {number} options.zIndex - z-index 값
     * @param {string} options.namespace - 모니터링할 AutoSave namespace (default: 'all')
     * @param {Function} options.onManualSave - 수동 저장 버튼 클릭 콜백
     */
    constructor(options = {}) {
        this._options = {
            container: options.container || document.body,
            position: options.position || 'bottom-right',
            showLabel: options.showLabel ?? true,
            showSaveButton: options.showSaveButton ?? true,
            showTooltip: options.showTooltip ?? true,
            animate: options.animate ?? true,
            size: options.size || 'medium',
            zIndex: options.zIndex || 9998,
            offsetX: options.offsetX || 20,
            offsetY: options.offsetY || 60,  // Connection Indicator 아래
            namespace: options.namespace || 'all',
            onManualSave: options.onManualSave || null
        };

        // DOM 요소
        this._element = null;
        this._indicatorDot = null;
        this._labelElement = null;
        this._timeElement = null;
        this._tooltipElement = null;
        this._saveButton = null;

        // 상태
        this._state = SaveState.IDLE;
        this._lastSavedAt = null;
        this._changeCount = 0;
        this._errorMessage = null;
        this._activeNamespace = null;
        this._activeIdentifier = null;

        // 이벤트 구독 해제 함수들
        this._unsubscribers = [];

        // 시간 업데이트 인터벌
        this._timeUpdateInterval = null;

        // 저장 완료 후 상태 리셋 타이머
        this._savedStateTimer = null;

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
        this._injectStyles();
        this._createElement();
        this._bindEvents();
        this._updateDisplay();
    }

    /**
     * 스타일 주입
     * @private
     */
    _injectStyles() {
        const styleId = 'autosave-indicator-styles';
        
        // 이미 주입된 경우 스킵
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* ===== AutoSave Indicator Base ===== */
            .autosave-indicator {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: rgba(30, 30, 30, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                color: #ffffff;
                cursor: default;
                user-select: none;
                backdrop-filter: blur(10px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
            }

            .autosave-indicator:hover {
                background: rgba(40, 40, 40, 0.98);
                border-color: rgba(255, 255, 255, 0.2);
            }

            /* ===== Position Variants ===== */
            .autosave-indicator--fixed {
                position: fixed;
            }

            .autosave-indicator--top-right {
                top: var(--asi-offset-y, 60px);
                right: var(--asi-offset-x, 20px);
            }

            .autosave-indicator--top-left {
                top: var(--asi-offset-y, 60px);
                left: var(--asi-offset-x, 20px);
            }

            .autosave-indicator--bottom-right {
                bottom: var(--asi-offset-y, 60px);
                right: var(--asi-offset-x, 20px);
            }

            .autosave-indicator--bottom-left {
                bottom: var(--asi-offset-y, 60px);
                left: var(--asi-offset-x, 20px);
            }

            /* ===== Size Variants ===== */
            .autosave-indicator--small {
                padding: 4px 8px;
                font-size: 11px;
                gap: 6px;
            }

            .autosave-indicator--small .autosave-indicator__dot {
                width: 8px;
                height: 8px;
            }

            .autosave-indicator--large {
                padding: 12px 16px;
                font-size: 15px;
                gap: 10px;
            }

            .autosave-indicator--large .autosave-indicator__dot {
                width: 14px;
                height: 14px;
            }

            /* ===== Indicator Dot ===== */
            .autosave-indicator__dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background-color: var(--asi-color, #6b7280);
                position: relative;
                flex-shrink: 0;
            }

            .autosave-indicator__dot::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background-color: var(--asi-color, #6b7280);
                opacity: 0;
                animation: none;
            }

            .autosave-indicator--animate .autosave-indicator__dot--dirty::before {
                animation: asi-pulse-warning 1.5s ease-in-out infinite;
            }

            .autosave-indicator--animate .autosave-indicator__dot--saving::before {
                animation: asi-pulse 0.8s ease-in-out infinite;
            }

            .autosave-indicator--animate .autosave-indicator__dot--saved::before {
                animation: asi-pulse-success 2s ease-in-out 1;
            }

            .autosave-indicator--animate .autosave-indicator__dot--error::before {
                animation: asi-pulse-error 1s ease-in-out infinite;
            }

            @keyframes asi-pulse {
                0%, 100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(1);
                }
                50% {
                    opacity: 0.5;
                    transform: translate(-50%, -50%) scale(2);
                }
            }

            @keyframes asi-pulse-warning {
                0%, 100% {
                    opacity: 0.3;
                    transform: translate(-50%, -50%) scale(1);
                }
                50% {
                    opacity: 0.6;
                    transform: translate(-50%, -50%) scale(1.8);
                }
            }

            @keyframes asi-pulse-success {
                0% {
                    opacity: 0.8;
                    transform: translate(-50%, -50%) scale(1);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(2.5);
                }
            }

            @keyframes asi-pulse-error {
                0%, 100% {
                    opacity: 0.4;
                    transform: translate(-50%, -50%) scale(1);
                }
                50% {
                    opacity: 0.8;
                    transform: translate(-50%, -50%) scale(2);
                }
            }

            /* ===== Label ===== */
            .autosave-indicator__label {
                color: #e5e5e5;
                white-space: nowrap;
                font-weight: 500;
            }

            .autosave-indicator__label--dirty {
                color: #fcd34d;
            }

            .autosave-indicator__label--saving {
                color: #93c5fd;
            }

            .autosave-indicator__label--saved {
                color: #86efac;
            }

            .autosave-indicator__label--error {
                color: #fca5a5;
            }

            /* ===== Time ===== */
            .autosave-indicator__time {
                color: #9ca3af;
                font-size: 11px;
                white-space: nowrap;
            }

            /* ===== Save Button ===== */
            .autosave-indicator__save-btn {
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(59, 130, 246, 0.3);
                color: #93c5fd;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-left: 4px;
            }

            .autosave-indicator__save-btn:hover {
                background: rgba(59, 130, 246, 0.5);
                border-color: rgba(255, 255, 255, 0.3);
            }

            .autosave-indicator__save-btn:active {
                transform: scale(0.95);
            }

            .autosave-indicator__save-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .autosave-indicator__save-btn--dirty {
                background: rgba(245, 158, 11, 0.4);
                color: #fcd34d;
                border-color: rgba(245, 158, 11, 0.5);
            }

            .autosave-indicator__save-btn--dirty:hover {
                background: rgba(245, 158, 11, 0.6);
            }

            /* ===== Tooltip ===== */
            .autosave-indicator__tooltip {
                position: absolute;
                bottom: calc(100% + 8px);
                right: 0;
                min-width: 200px;
                padding: 12px;
                background: rgba(20, 20, 20, 0.98);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                font-size: 12px;
                color: #d4d4d4;
                opacity: 0;
                visibility: hidden;
                transform: translateY(4px);
                transition: all 0.2s ease;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                z-index: 1;
            }

            .autosave-indicator:hover .autosave-indicator__tooltip {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            .autosave-indicator__tooltip-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .autosave-indicator__tooltip-row:last-child {
                border-bottom: none;
            }

            .autosave-indicator__tooltip-label {
                color: #9ca3af;
            }

            .autosave-indicator__tooltip-value {
                color: #ffffff;
                font-weight: 500;
            }

            .autosave-indicator__tooltip-value--success {
                color: #86efac;
            }

            .autosave-indicator__tooltip-value--warning {
                color: #fcd34d;
            }

            .autosave-indicator__tooltip-value--error {
                color: #fca5a5;
            }

            /* ===== Change Count Badge ===== */
            .autosave-indicator__badge {
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 700;
                background: rgba(245, 158, 11, 0.3);
                color: #fcd34d;
                border-radius: 10px;
                margin-left: 4px;
            }

            /* ===== Namespace Badge ===== */
            .autosave-indicator__namespace {
                padding: 2px 6px;
                font-size: 9px;
                font-weight: 600;
                text-transform: uppercase;
                background: rgba(99, 102, 241, 0.3);
                color: #a5b4fc;
                border-radius: 4px;
                margin-right: 4px;
            }

            /* ===== Hidden State ===== */
            .autosave-indicator--hidden {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
            }

            /* ===== Saving Animation ===== */
            .autosave-indicator__saving-spinner {
                width: 10px;
                height: 10px;
                border: 2px solid rgba(59, 130, 246, 0.3);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: asi-spin 0.8s linear infinite;
            }

            @keyframes asi-spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;

        document.head.appendChild(styles);
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
            console.error('[AutoSaveIndicator] Container not found');
            return;
        }

        // 메인 요소 생성
        this._element = document.createElement('div');
        this._element.className = this._buildClassNames();
        this._element.style.setProperty('--asi-offset-x', `${this._options.offsetX}px`);
        this._element.style.setProperty('--asi-offset-y', `${this._options.offsetY}px`);
        this._element.style.zIndex = this._options.zIndex;

        // 내부 구조 생성
        this._element.innerHTML = this._buildInnerHTML();

        // 요소 참조 저장
        this._indicatorDot = this._element.querySelector('.autosave-indicator__dot');
        this._labelElement = this._element.querySelector('.autosave-indicator__label');
        this._timeElement = this._element.querySelector('.autosave-indicator__time');
        this._tooltipElement = this._element.querySelector('.autosave-indicator__tooltip');
        this._saveButton = this._element.querySelector('.autosave-indicator__save-btn');

        // Save 버튼 이벤트 바인딩
        if (this._saveButton) {
            this._saveButton.addEventListener('click', () => this._onManualSaveClick());
        }

        // DOM에 추가
        container.appendChild(this._element);
    }

    /**
     * 클래스명 빌드
     * @private
     */
    _buildClassNames() {
        const classes = ['autosave-indicator'];

        // 위치
        if (this._options.position !== 'custom') {
            classes.push('autosave-indicator--fixed');
            classes.push(`autosave-indicator--${this._options.position}`);
        }

        // 크기
        if (this._options.size !== 'medium') {
            classes.push(`autosave-indicator--${this._options.size}`);
        }

        // 애니메이션
        if (this._options.animate) {
            classes.push('autosave-indicator--animate');
        }

        return classes.join(' ');
    }

    /**
     * 내부 HTML 빌드
     * @private
     */
    _buildInnerHTML() {
        let html = '';

        // Namespace 뱃지 (특정 namespace 모니터링 시)
        if (this._options.namespace !== 'all') {
            html += `<span class="autosave-indicator__namespace">${this._options.namespace}</span>`;
        }

        // Dot
        html += `<div class="autosave-indicator__dot"></div>`;

        // 라벨
        if (this._options.showLabel) {
            html += `<span class="autosave-indicator__label">Idle</span>`;
        }

        // 시간
        html += `<span class="autosave-indicator__time"></span>`;

        // Save 버튼
        if (this._options.showSaveButton) {
            html += `<button class="autosave-indicator__save-btn" title="수동 저장">💾 Save</button>`;
        }

        // 툴팁
        if (this._options.showTooltip) {
            html += `
                <div class="autosave-indicator__tooltip">
                    <div class="autosave-indicator__tooltip-row">
                        <span class="autosave-indicator__tooltip-label">상태</span>
                        <span class="autosave-indicator__tooltip-value" data-field="status">대기 중</span>
                    </div>
                    <div class="autosave-indicator__tooltip-row">
                        <span class="autosave-indicator__tooltip-label">마지막 저장</span>
                        <span class="autosave-indicator__tooltip-value" data-field="lastSaved">-</span>
                    </div>
                    <div class="autosave-indicator__tooltip-row">
                        <span class="autosave-indicator__tooltip-label">미저장 변경</span>
                        <span class="autosave-indicator__tooltip-value" data-field="changes">0</span>
                    </div>
                    <div class="autosave-indicator__tooltip-row">
                        <span class="autosave-indicator__tooltip-label">네임스페이스</span>
                        <span class="autosave-indicator__tooltip-value" data-field="namespace">-</span>
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
        // AutoSave 시작 이벤트
        const onStarted = (data) => {
            if (this._shouldHandle(data.namespace)) {
                this._activeNamespace = data.namespace;
                this._activeIdentifier = data.identifier;
                this._updateDisplay();
            }
        };
        eventBus.on('autosave:started', onStarted);
        this._unsubscribers.push(() => eventBus.off('autosave:started', onStarted));

        // AutoSave 중지 이벤트
        const onStopped = (data) => {
            if (this._shouldHandle(data.namespace)) {
                this._setState(SaveState.IDLE);
            }
        };
        eventBus.on('autosave:stopped', onStopped);
        this._unsubscribers.push(() => eventBus.off('autosave:stopped', onStopped));

        // Dirty 상태 변경 이벤트
        const onDirty = (data) => {
            if (this._shouldHandle(data.namespace)) {
                this._changeCount = data.changeCount;
                if (data.isDirty) {
                    this._setState(SaveState.DIRTY);
                } else {
                    this._setState(SaveState.IDLE);
                }
            }
        };
        eventBus.on('autosave:dirty', onDirty);
        this._unsubscribers.push(() => eventBus.off('autosave:dirty', onDirty));

        // 저장 중 이벤트
        const onSaving = (data) => {
            if (this._shouldHandle(data.namespace)) {
                this._setState(SaveState.SAVING);
            }
        };
        eventBus.on('autosave:saving', onSaving);
        this._unsubscribers.push(() => eventBus.off('autosave:saving', onSaving));

        // 저장 완료 이벤트
        const onComplete = (data) => {
            if (this._shouldHandle(data.namespace)) {
                this._lastSavedAt = new Date(data.timestamp);
                this._changeCount = 0;
                this._errorMessage = null;
                this._setState(SaveState.SAVED);
                
                // 3초 후 IDLE로 복귀
                this._scheduleSavedStateReset();
            }
        };
        eventBus.on('autosave:complete', onComplete);
        this._unsubscribers.push(() => eventBus.off('autosave:complete', onComplete));

        // 저장 오류 이벤트
        const onError = (data) => {
            if (this._shouldHandle(data.namespace)) {
                this._errorMessage = data.error;
                this._setState(SaveState.ERROR);
                
                // 5초 후 DIRTY로 복귀
                setTimeout(() => {
                    if (this._state === SaveState.ERROR) {
                        this._setState(this._changeCount > 0 ? SaveState.DIRTY : SaveState.IDLE);
                    }
                }, 5000);
            }
        };
        eventBus.on('autosave:error', onError);
        this._unsubscribers.push(() => eventBus.off('autosave:error', onError));

        // 시간 업데이트 인터벌
        this._timeUpdateInterval = setInterval(() => {
            this._updateTimeDisplay();
        }, 1000);
    }

    /**
     * 이벤트 처리 여부 확인
     * @private
     */
    _shouldHandle(namespace) {
        if (this._options.namespace === 'all') return true;
        return this._options.namespace === namespace;
    }

    // =========================================================================
    // 디스플레이 업데이트
    // =========================================================================

    /**
     * 상태 설정
     * @private
     */
    _setState(newState) {
        if (this._state === newState) return;
        
        this._state = newState;
        this._updateDisplay();
    }

    /**
     * 전체 디스플레이 업데이트
     * @private
     */
    _updateDisplay() {
        if (!this._element) return;

        const config = STATUS_CONFIG[this._state] || STATUS_CONFIG[SaveState.IDLE];

        // CSS 변수 업데이트
        this._element.style.setProperty('--asi-color', config.color);

        // Dot 클래스 업데이트
        if (this._indicatorDot) {
            this._indicatorDot.className = 'autosave-indicator__dot';
            this._indicatorDot.classList.add(`autosave-indicator__dot--${this._state}`);
            
            // Saving 상태일 때 스피너로 교체
            if (this._state === SaveState.SAVING) {
                this._indicatorDot.innerHTML = '<div class="autosave-indicator__saving-spinner"></div>';
            } else {
                this._indicatorDot.innerHTML = '';
            }
        }

        // 라벨 업데이트
        if (this._labelElement) {
            let labelText = config.label;
            
            // Dirty 상태일 때 변경 횟수 표시
            if (this._state === SaveState.DIRTY && this._changeCount > 0) {
                labelText = `Unsaved (${this._changeCount})`;
            }
            
            this._labelElement.textContent = labelText;
            this._labelElement.className = 'autosave-indicator__label';
            this._labelElement.classList.add(`autosave-indicator__label--${this._state}`);
        }

        // 시간 표시 업데이트
        this._updateTimeDisplay();

        // Save 버튼 상태 업데이트
        this._updateSaveButton();

        // 툴팁 업데이트
        this._updateTooltip();
    }

    /**
     * 시간 표시 업데이트
     * @private
     */
    _updateTimeDisplay() {
        if (!this._timeElement) return;

        if (!this._lastSavedAt) {
            this._timeElement.textContent = '';
            return;
        }

        const seconds = Math.floor((Date.now() - this._lastSavedAt.getTime()) / 1000);
        
        if (seconds < 5) {
            this._timeElement.textContent = '방금 저장됨';
        } else if (seconds < 60) {
            this._timeElement.textContent = `${seconds}초 전 저장`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            this._timeElement.textContent = `${minutes}분 전 저장`;
        } else {
            const hours = Math.floor(seconds / 3600);
            this._timeElement.textContent = `${hours}시간 전 저장`;
        }
    }

    /**
     * Save 버튼 상태 업데이트
     * @private
     */
    _updateSaveButton() {
        if (!this._saveButton) return;

        const isDirty = this._state === SaveState.DIRTY;
        const isSaving = this._state === SaveState.SAVING;

        this._saveButton.disabled = isSaving;
        this._saveButton.className = 'autosave-indicator__save-btn';
        
        if (isDirty) {
            this._saveButton.classList.add('autosave-indicator__save-btn--dirty');
            this._saveButton.textContent = '💾 Save Now';
        } else {
            this._saveButton.textContent = '💾 Save';
        }
    }

    /**
     * 툴팁 업데이트
     * @private
     */
    _updateTooltip() {
        if (!this._tooltipElement) return;

        const config = STATUS_CONFIG[this._state] || STATUS_CONFIG[SaveState.IDLE];

        // 상태
        const statusEl = this._tooltipElement.querySelector('[data-field="status"]');
        if (statusEl) {
            let statusText = config.description;
            if (this._state === SaveState.ERROR && this._errorMessage) {
                statusText = `오류: ${this._errorMessage}`;
            }
            statusEl.textContent = statusText;
            statusEl.className = 'autosave-indicator__tooltip-value';
            
            if (this._state === SaveState.SAVED) {
                statusEl.classList.add('autosave-indicator__tooltip-value--success');
            } else if (this._state === SaveState.ERROR) {
                statusEl.classList.add('autosave-indicator__tooltip-value--error');
            } else if (this._state === SaveState.DIRTY) {
                statusEl.classList.add('autosave-indicator__tooltip-value--warning');
            }
        }

        // 마지막 저장 시간
        const lastSavedEl = this._tooltipElement.querySelector('[data-field="lastSaved"]');
        if (lastSavedEl) {
            if (this._lastSavedAt) {
                lastSavedEl.textContent = this._lastSavedAt.toLocaleString();
            } else {
                lastSavedEl.textContent = '아직 저장되지 않음';
            }
        }

        // 미저장 변경 횟수
        const changesEl = this._tooltipElement.querySelector('[data-field="changes"]');
        if (changesEl) {
            changesEl.textContent = this._changeCount.toString();
            changesEl.className = 'autosave-indicator__tooltip-value';
            if (this._changeCount > 0) {
                changesEl.classList.add('autosave-indicator__tooltip-value--warning');
            }
        }

        // 네임스페이스
        const namespaceEl = this._tooltipElement.querySelector('[data-field="namespace"]');
        if (namespaceEl) {
            if (this._activeNamespace) {
                namespaceEl.textContent = `${this._activeNamespace}/${this._activeIdentifier || ''}`;
            } else {
                namespaceEl.textContent = this._options.namespace === 'all' ? '전체' : this._options.namespace;
            }
        }
    }

    /**
     * SAVED 상태 리셋 스케줄
     * @private
     */
    _scheduleSavedStateReset() {
        if (this._savedStateTimer) {
            clearTimeout(this._savedStateTimer);
        }
        
        this._savedStateTimer = setTimeout(() => {
            if (this._state === SaveState.SAVED) {
                this._setState(SaveState.IDLE);
            }
        }, 3000);
    }

    /**
     * 수동 저장 버튼 클릭 처리
     * @private
     */
    _onManualSaveClick() {
        if (this._state === SaveState.SAVING) return;

        if (this._options.onManualSave) {
            this._options.onManualSave();
        }

        // EventBus로 수동 저장 요청 이벤트 발행
        eventBus.emit('autosave:manual-save-requested', {
            namespace: this._activeNamespace || this._options.namespace,
            identifier: this._activeIdentifier,
            timestamp: Date.now()
        });
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * 컴포넌트 표시
     */
    show() {
        if (this._element) {
            this._element.classList.remove('autosave-indicator--hidden');
        }
    }

    /**
     * 컴포넌트 숨김
     */
    hide() {
        if (this._element) {
            this._element.classList.add('autosave-indicator--hidden');
        }
    }

    /**
     * 표시/숨김 토글
     */
    toggle() {
        if (this._element) {
            this._element.classList.toggle('autosave-indicator--hidden');
        }
    }

    /**
     * 가시성 여부
     * @returns {boolean}
     */
    isVisible() {
        return this._element && !this._element.classList.contains('autosave-indicator--hidden');
    }

    /**
     * 위치 변경
     * @param {string} position - 새 위치
     */
    setPosition(position) {
        if (!this._element) return;

        // 기존 위치 클래스 제거
        this._element.classList.remove(
            'autosave-indicator--top-right',
            'autosave-indicator--top-left',
            'autosave-indicator--bottom-right',
            'autosave-indicator--bottom-left'
        );

        this._options.position = position;

        if (position !== 'custom') {
            this._element.classList.add('autosave-indicator--fixed');
            this._element.classList.add(`autosave-indicator--${position}`);
        } else {
            this._element.classList.remove('autosave-indicator--fixed');
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
        this._element.style.setProperty('--asi-offset-x', `${x}px`);
        this._element.style.setProperty('--asi-offset-y', `${y}px`);
    }

    /**
     * 수동 저장 콜백 설정
     * @param {Function} callback - 콜백 함수
     */
    setOnManualSave(callback) {
        this._options.onManualSave = callback;
    }

    /**
     * 현재 상태 반환
     * @returns {Object}
     */
    getStatus() {
        return {
            state: this._state,
            lastSavedAt: this._lastSavedAt?.toISOString() || null,
            changeCount: this._changeCount,
            namespace: this._activeNamespace,
            identifier: this._activeIdentifier,
            errorMessage: this._errorMessage
        };
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
        if (this._timeUpdateInterval) {
            clearInterval(this._timeUpdateInterval);
            this._timeUpdateInterval = null;
        }

        // 타이머 정리
        if (this._savedStateTimer) {
            clearTimeout(this._savedStateTimer);
            this._savedStateTimer = null;
        }

        // DOM 제거
        if (this._element && this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }

        this._element = null;
        this._indicatorDot = null;
        this._labelElement = null;
        this._timeElement = null;
        this._tooltipElement = null;
        this._saveButton = null;
    }

    /**
     * 수동 새로고침
     */
    refresh() {
        this._updateDisplay();
    }
}

// 기본 내보내기
export default AutoSaveIndicator;

// Named export
export { AutoSaveIndicator, SaveState, STATUS_CONFIG };

// 전역 등록
if (typeof window !== 'undefined') {
    window.AutoSaveIndicator = AutoSaveIndicator;
}

console.log('✅ AutoSaveIndicator.js v1.0.0 로드 완료');