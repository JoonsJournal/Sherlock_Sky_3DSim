/**
 * EquipmentCard.js
 * ================
 * Ranking View 설비 카드 컴포넌트
 * 
 * @version 1.0.0
 * @description
 * - 설비 상태 정보 카드 UI
 * - 실시간 지속 시간 업데이트 (2초 주기)
 * - 긴급도 시각 효과 (Pulse 애니메이션)
 * - 클릭 시 EventBus로 equipment:select 이벤트 발행
 * - Equipment Info Drawer와 연동
 * 
 * @changelog
 * - v1.0.0: Phase 2 초기 버전
 *   - 카드 DOM 구조 생성
 *   - 상태별 스타일 적용
 *   - 지속 시간 실시간 업데이트
 *   - EventBus 연결
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * - DurationCalculator (../utils/DurationCalculator.js) - Phase 3에서 구현
 * 
 * @exports
 * - EquipmentCard
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/components/EquipmentCard.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { eventBus } from '../../../core/managers/EventBus.js';

/**
 * 상태별 색상 매핑
 */
const STATUS_COLORS = {
    'RUN': 'success',
    'STOP': 'warning',
    'IDLE': 'muted',
    'SUDDENSTOP': 'danger',
    'REMOTE': 'danger',
    'WAIT': 'muted',
    'DISCONNECTED': 'muted'
};

/**
 * 긴급도 임계값 (분)
 */
const URGENCY_THRESHOLDS = {
    WARNING: 5,    // 5분 초과 → 노란색
    DANGER: 10,    // 10분 초과 → 주황색 + Pulse
    CRITICAL: 15   // 15분 초과 → 빨간색 + 강한 Pulse
};

export class EquipmentCard {
    /**
     * CSS 클래스 상수 정의
     */
    static CSS = {
        // Block
        BLOCK: 'equipment-card',
        
        // Elements
        HEADER: 'equipment-card__header',
        STATUS_INDICATOR: 'equipment-card__status-indicator',
        EQUIPMENT_ID: 'equipment-card__equipment-id',
        DURATION: 'equipment-card__duration',
        DURATION_ICON: 'equipment-card__duration-icon',
        DURATION_VALUE: 'equipment-card__duration-value',
        BODY: 'equipment-card__body',
        ALARM_INFO: 'equipment-card__alarm-info',
        ALARM_CODE: 'equipment-card__alarm-code',
        ALARM_MESSAGE: 'equipment-card__alarm-message',
        ALARM_REPEAT: 'equipment-card__alarm-repeat',
        PRODUCTION_INFO: 'equipment-card__production-info',
        PRODUCTION_LABEL: 'equipment-card__production-label',
        PRODUCTION_VALUE: 'equipment-card__production-value',
        PRODUCTION_BAR: 'equipment-card__production-bar',
        PRODUCTION_BAR_FILL: 'equipment-card__production-bar-fill',
        LOT_TIME: 'equipment-card__lot-time',
        LOT_TIME_ICON: 'equipment-card__lot-time-icon',
        LOT_TIME_VALUE: 'equipment-card__lot-time-value',
        
        // Status Modifiers
        STATUS_RUN: 'equipment-card--run',
        STATUS_STOP: 'equipment-card--stop',
        STATUS_IDLE: 'equipment-card--idle',
        STATUS_SUDDEN_STOP: 'equipment-card--sudden-stop',
        STATUS_REMOTE: 'equipment-card--remote',
        STATUS_WAIT: 'equipment-card--wait',
        STATUS_DISCONNECTED: 'equipment-card--disconnected',
        
        // Urgency Modifiers
        URGENCY_WARNING: 'equipment-card--urgency-warning',
        URGENCY_DANGER: 'equipment-card--urgency-danger',
        URGENCY_CRITICAL: 'equipment-card--urgency-critical',
        
        // State Modifiers
        SELECTED: 'equipment-card--selected',
        ANIMATING: 'equipment-card--animating',
        ENTERING: 'equipment-card--entering',
        LEAVING: 'equipment-card--leaving',
        
        // Legacy alias
        LEGACY_SELECTED: 'selected',
        LEGACY_ACTIVE: 'active'
    };
    
    /**
     * 업데이트 주기 (ms)
     */
    static UPDATE_INTERVAL = 2000; // 2초 (안정화 후 1초로 변경 예정)
    
    /**
     * @param {Object} data - 설비 데이터
     * @param {string} data.equipmentId - 설비 ID (DB)
     * @param {string} data.frontendId - Frontend ID
     * @param {string} data.equipmentName - 설비명
     * @param {string} data.status - 현재 상태
     * @param {string} data.occurredAt - 상태 발생 시간 (ISO string)
     * @param {number} [data.alarmCode] - 알람 코드
     * @param {string} [data.alarmMessage] - 알람 메시지
     * @param {number} [data.alarmRepeatCount] - 알람 반복 횟수
     * @param {number} [data.productionCount] - 생산 개수
     * @param {number} [data.targetCount] - 목표 개수
     * @param {string} [data.lotStartTime] - Lot 시작 시간
     * @param {string} [data.laneId] - 레인 ID
     * @param {Object} [options] - 추가 옵션
     */
    constructor(data, options = {}) {
        this._data = { ...data };
        this._options = options;
        
        // State
        this._isSelected = false;
        this._isAnimating = false;
        this._isDisposed = false;
        
        // DOM
        this.element = null;
        this._dom = {};
        
        // Timer
        this._durationTimer = null;
        this._currentDurationSeconds = 0;
        
        // Event handlers (for cleanup)
        this._boundHandlers = {};
        
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
        this._applyStatusStyle();
        this._setupEventListeners();
        this._startDurationTimer();
        this._updateUrgencyIndicator();
    }
    
    /**
     * DOM 구조 생성
     * @private
     */
    _createDOM() {
        // Main container
        this.element = document.createElement('div');
        this.element.classList.add(EquipmentCard.CSS.BLOCK);
        this.element.dataset.equipmentId = this._data.equipmentId || '';
        this.element.dataset.frontendId = this._data.frontendId || '';
        this.element.tabIndex = 0; // 키보드 포커스 가능
        
        // Header
        const header = this._createHeader();
        
        // Body
        const body = this._createBody();
        
        // Assemble
        this.element.appendChild(header);
        this.element.appendChild(body);
    }
    
    /**
     * 헤더 영역 생성
     * @private
     * @returns {HTMLElement}
     */
    _createHeader() {
        const header = document.createElement('div');
        header.classList.add(EquipmentCard.CSS.HEADER);
        
        // Status Indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.classList.add(EquipmentCard.CSS.STATUS_INDICATOR);
        statusIndicator.dataset.status = this._data.status || 'DISCONNECTED';
        this._dom.statusIndicator = statusIndicator;
        
        // Equipment ID
        const equipmentId = document.createElement('span');
        equipmentId.classList.add(EquipmentCard.CSS.EQUIPMENT_ID);
        equipmentId.textContent = this._data.frontendId || this._data.equipmentId || '-';
        this._dom.equipmentId = equipmentId;
        
        // Duration
        const duration = document.createElement('div');
        duration.classList.add(EquipmentCard.CSS.DURATION);
        
        const durationIcon = document.createElement('span');
        durationIcon.classList.add(EquipmentCard.CSS.DURATION_ICON);
        durationIcon.textContent = '⏱️';
        
        const durationValue = document.createElement('span');
        durationValue.classList.add(EquipmentCard.CSS.DURATION_VALUE);
        durationValue.textContent = this._formatDuration(this._calculateInitialDuration());
        this._dom.durationValue = durationValue;
        
        duration.appendChild(durationIcon);
        duration.appendChild(durationValue);
        
        header.appendChild(statusIndicator);
        header.appendChild(equipmentId);
        header.appendChild(duration);
        
        return header;
    }
    
    /**
     * 바디 영역 생성
     * @private
     * @returns {HTMLElement}
     */
    _createBody() {
        const body = document.createElement('div');
        body.classList.add(EquipmentCard.CSS.BODY);
        
        // Alarm Info (조건부)
        if (this._data.alarmCode) {
            const alarmInfo = this._createAlarmInfo();
            body.appendChild(alarmInfo);
        }
        
        // Production Info
        const productionInfo = this._createProductionInfo();
        body.appendChild(productionInfo);
        
        // Lot Time
        if (this._data.lotStartTime) {
            const lotTime = this._createLotTime();
            body.appendChild(lotTime);
        }
        
        return body;
    }
    
    /**
     * 알람 정보 영역 생성
     * @private
     * @returns {HTMLElement}
     */
    _createAlarmInfo() {
        const alarmInfo = document.createElement('div');
        alarmInfo.classList.add(EquipmentCard.CSS.ALARM_INFO);
        
        // Alarm Code + Message
        const alarmCode = document.createElement('div');
        alarmCode.classList.add(EquipmentCard.CSS.ALARM_CODE);
        alarmCode.textContent = `⚠️ ${this._data.alarmCode}`;
        if (this._data.alarmMessage) {
            alarmCode.title = this._data.alarmMessage;
        }
        this._dom.alarmCode = alarmCode;
        
        // Repeat Count
        if (this._data.alarmRepeatCount && this._data.alarmRepeatCount > 1) {
            const alarmRepeat = document.createElement('span');
            alarmRepeat.classList.add(EquipmentCard.CSS.ALARM_REPEAT);
            alarmRepeat.textContent = `🔄 ${this._data.alarmRepeatCount}회`;
            this._dom.alarmRepeat = alarmRepeat;
            alarmCode.appendChild(alarmRepeat);
        }
        
        alarmInfo.appendChild(alarmCode);
        
        // Alarm Message (별도 줄)
        if (this._data.alarmMessage) {
            const alarmMsg = document.createElement('div');
            alarmMsg.classList.add(EquipmentCard.CSS.ALARM_MESSAGE);
            alarmMsg.textContent = this._truncateText(this._data.alarmMessage, 30);
            this._dom.alarmMessage = alarmMsg;
            alarmInfo.appendChild(alarmMsg);
        }
        
        return alarmInfo;
    }
    
    /**
     * 생산 정보 영역 생성
     * @private
     * @returns {HTMLElement}
     */
    _createProductionInfo() {
        const productionInfo = document.createElement('div');
        productionInfo.classList.add(EquipmentCard.CSS.PRODUCTION_INFO);
        
        // Production Label + Value
        const productionRow = document.createElement('div');
        productionRow.style.display = 'flex';
        productionRow.style.justifyContent = 'space-between';
        productionRow.style.alignItems = 'center';
        productionRow.style.marginBottom = 'var(--spacing-1)';
        
        const productionLabel = document.createElement('span');
        productionLabel.classList.add(EquipmentCard.CSS.PRODUCTION_LABEL);
        productionLabel.textContent = '📦 Production';
        
        const productionValue = document.createElement('span');
        productionValue.classList.add(EquipmentCard.CSS.PRODUCTION_VALUE);
        const count = this._data.productionCount ?? 0;
        const target = this._data.targetCount ?? 0;
        productionValue.textContent = target > 0 ? `${count} / ${target}` : `${count}`;
        this._dom.productionValue = productionValue;
        
        productionRow.appendChild(productionLabel);
        productionRow.appendChild(productionValue);
        
        // Progress Bar
        const progressBar = document.createElement('div');
        progressBar.classList.add(EquipmentCard.CSS.PRODUCTION_BAR);
        
        const progressFill = document.createElement('div');
        progressFill.classList.add(EquipmentCard.CSS.PRODUCTION_BAR_FILL);
        const percentage = target > 0 ? Math.min((count / target) * 100, 100) : 0;
        progressFill.style.width = `${percentage}%`;
        this._dom.productionBarFill = progressFill;
        
        progressBar.appendChild(progressFill);
        
        productionInfo.appendChild(productionRow);
        productionInfo.appendChild(progressBar);
        
        return productionInfo;
    }
    
    /**
     * Lot 진행 시간 영역 생성
     * @private
     * @returns {HTMLElement}
     */
    _createLotTime() {
        const lotTime = document.createElement('div');
        lotTime.classList.add(EquipmentCard.CSS.LOT_TIME);
        
        const lotIcon = document.createElement('span');
        lotIcon.classList.add(EquipmentCard.CSS.LOT_TIME_ICON);
        lotIcon.textContent = '⏳';
        
        const lotLabel = document.createElement('span');
        lotLabel.textContent = 'Lot Time: ';
        
        const lotValue = document.createElement('span');
        lotValue.classList.add(EquipmentCard.CSS.LOT_TIME_VALUE);
        lotValue.textContent = this._calculateLotTime();
        this._dom.lotTimeValue = lotValue;
        
        lotTime.appendChild(lotIcon);
        lotTime.appendChild(lotLabel);
        lotTime.appendChild(lotValue);
        
        return lotTime;
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        this._boundHandlers.onClick = this._handleClick.bind(this);
        this._boundHandlers.onKeyDown = this._handleKeyDown.bind(this);
        
        this.element.addEventListener('click', this._boundHandlers.onClick);
        this.element.addEventListener('keydown', this._boundHandlers.onKeyDown);
    }
    
    // =========================================
    // Public Methods
    // =========================================
    
    /**
     * 데이터 업데이트
     * @param {Object} newData - 새 데이터
     */
    update(newData) {
        if (this._isDisposed) return;
        
        const oldStatus = this._data.status;
        this._data = { ...this._data, ...newData };
        
        // 상태 변경 시 스타일 업데이트
        if (newData.status && newData.status !== oldStatus) {
            this._applyStatusStyle();
        }
        
        // DOM 업데이트
        this._updateDOM();
        
        // 긴급도 업데이트
        this._updateUrgencyIndicator();
    }
    
    /**
     * 선택 상태 설정
     * @param {boolean} selected
     */
    setSelected(selected) {
        this._isSelected = selected;
        
        if (selected) {
            this.element.classList.add(EquipmentCard.CSS.SELECTED);
            this.element.classList.add(EquipmentCard.CSS.LEGACY_SELECTED);
        } else {
            this.element.classList.remove(EquipmentCard.CSS.SELECTED);
            this.element.classList.remove(EquipmentCard.CSS.LEGACY_SELECTED);
        }
    }
    
    /**
     * 선택 상태 반환
     * @returns {boolean}
     */
    get isSelected() {
        return this._isSelected;
    }
    
    /**
     * 데이터 반환
     * @returns {Object}
     */
    get data() {
        return { ...this._data };
    }
    
    /**
     * Equipment ID 반환
     * @returns {string}
     */
    get equipmentId() {
        return this._data.equipmentId;
    }
    
    /**
     * Frontend ID 반환
     * @returns {string}
     */
    get frontendId() {
        return this._data.frontendId;
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        if (this._isDisposed) return;
        
        // Timer 정리
        this._stopDurationTimer();
        
        // 이벤트 리스너 제거
        this.element?.removeEventListener('click', this._boundHandlers.onClick);
        this.element?.removeEventListener('keydown', this._boundHandlers.onKeyDown);
        
        // DOM 제거
        this.element?.remove();
        
        // 참조 해제
        this.element = null;
        this._dom = {};
        this._boundHandlers = {};
        this._isDisposed = true;
    }
    
    // =========================================
    // Event Handlers
    // =========================================
    
    /**
     * 클릭 이벤트 처리
     * @private
     */
    _handleClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log(`[EquipmentCard] 🖱️ 클릭: ${this._data.frontendId}`);
        
        // EventBus로 선택 이벤트 발행
        eventBus.emit('equipment:select', {
            equipmentId: this._data.equipmentId,
            frontendId: this._data.frontendId,
            source: 'ranking-view',
            cardData: this._data
        });
    }
    
    /**
     * 키보드 이벤트 처리
     * @private
     */
    _handleKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this._handleClick(event);
        }
    }
    
    // =========================================
    // Private Methods
    // =========================================
    
    /**
     * 상태별 스타일 적용
     * @private
     */
    _applyStatusStyle() {
        // 기존 상태 클래스 제거
        this.element.classList.remove(
            EquipmentCard.CSS.STATUS_RUN,
            EquipmentCard.CSS.STATUS_STOP,
            EquipmentCard.CSS.STATUS_IDLE,
            EquipmentCard.CSS.STATUS_SUDDEN_STOP,
            EquipmentCard.CSS.STATUS_REMOTE,
            EquipmentCard.CSS.STATUS_WAIT,
            EquipmentCard.CSS.STATUS_DISCONNECTED
        );
        
        // 새 상태 클래스 추가
        const status = this._data.status?.toUpperCase() || 'DISCONNECTED';
        const laneId = this._data.laneId || '';
        
        switch (status) {
            case 'RUN':
                this.element.classList.add(EquipmentCard.CSS.STATUS_RUN);
                break;
            case 'STOP':
                this.element.classList.add(EquipmentCard.CSS.STATUS_STOP);
                break;
            case 'IDLE':
                this.element.classList.add(EquipmentCard.CSS.STATUS_IDLE);
                break;
            case 'SUDDENSTOP':
                if (laneId === 'remote') {
                    this.element.classList.add(EquipmentCard.CSS.STATUS_REMOTE);
                } else {
                    this.element.classList.add(EquipmentCard.CSS.STATUS_SUDDEN_STOP);
                }
                break;
            case 'WAIT':
                this.element.classList.add(EquipmentCard.CSS.STATUS_WAIT);
                break;
            default:
                this.element.classList.add(EquipmentCard.CSS.STATUS_DISCONNECTED);
        }
        
        // Status indicator 업데이트
        if (this._dom.statusIndicator) {
            this._dom.statusIndicator.dataset.status = status;
        }
    }
    
    /**
     * 긴급도 인디케이터 업데이트
     * @private
     */
    _updateUrgencyIndicator() {
        const durationMinutes = this._currentDurationSeconds / 60;
        
        // 기존 긴급도 클래스 제거
        this.element.classList.remove(
            EquipmentCard.CSS.URGENCY_WARNING,
            EquipmentCard.CSS.URGENCY_DANGER,
            EquipmentCard.CSS.URGENCY_CRITICAL
        );
        
        // RUN 상태에서는 긴급도 표시하지 않음
        if (this._data.status === 'RUN') {
            return;
        }
        
        // 새 긴급도 적용
        if (durationMinutes > URGENCY_THRESHOLDS.CRITICAL) {
            this.element.classList.add(EquipmentCard.CSS.URGENCY_CRITICAL);
        } else if (durationMinutes > URGENCY_THRESHOLDS.DANGER) {
            this.element.classList.add(EquipmentCard.CSS.URGENCY_DANGER);
        } else if (durationMinutes > URGENCY_THRESHOLDS.WARNING) {
            this.element.classList.add(EquipmentCard.CSS.URGENCY_WARNING);
        }
    }
    
    /**
     * 지속 시간 타이머 시작
     * @private
     */
    _startDurationTimer() {
        this._currentDurationSeconds = this._calculateInitialDuration();
        
        this._durationTimer = setInterval(() => {
            if (this._isDisposed) {
                this._stopDurationTimer();
                return;
            }
            
            this._currentDurationSeconds += EquipmentCard.UPDATE_INTERVAL / 1000;
            
            if (this._dom.durationValue) {
                this._dom.durationValue.textContent = this._formatDuration(this._currentDurationSeconds);
            }
            
            // Lot Time 업데이트
            if (this._dom.lotTimeValue && this._data.lotStartTime) {
                this._dom.lotTimeValue.textContent = this._calculateLotTime();
            }
            
            // 긴급도 업데이트
            this._updateUrgencyIndicator();
            
        }, EquipmentCard.UPDATE_INTERVAL);
    }
    
    /**
     * 지속 시간 타이머 정지
     * @private
     */
    _stopDurationTimer() {
        if (this._durationTimer) {
            clearInterval(this._durationTimer);
            this._durationTimer = null;
        }
    }
    
    /**
     * 초기 지속 시간 계산 (초)
     * @private
     * @returns {number}
     */
    _calculateInitialDuration() {
        if (!this._data.occurredAt) {
            return 0;
        }
        
        const occurredAt = new Date(this._data.occurredAt);
        const now = new Date();
        return Math.max(0, Math.floor((now - occurredAt) / 1000));
    }
    
    /**
     * Lot 진행 시간 계산
     * @private
     * @returns {string}
     */
    _calculateLotTime() {
        if (!this._data.lotStartTime) {
            return '00:00:00';
        }
        
        const startTime = new Date(this._data.lotStartTime);
        const now = new Date();
        const seconds = Math.max(0, Math.floor((now - startTime) / 1000));
        
        return this._formatDuration(seconds);
    }
    
    /**
     * 지속 시간 포맷팅
     * @private
     * @param {number} seconds
     * @returns {string} HH:MM:SS 형식
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
    
    /**
     * 텍스트 자르기
     * @private
     * @param {string} text
     * @param {number} maxLength
     * @returns {string}
     */
    _truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    /**
     * DOM 업데이트
     * @private
     */
    _updateDOM() {
        // Equipment ID
        if (this._dom.equipmentId) {
            this._dom.equipmentId.textContent = this._data.frontendId || this._data.equipmentId || '-';
        }
        
        // Status Indicator
        if (this._dom.statusIndicator) {
            this._dom.statusIndicator.dataset.status = this._data.status || 'DISCONNECTED';
        }
        
        // Production Value
        if (this._dom.productionValue) {
            const count = this._data.productionCount ?? 0;
            const target = this._data.targetCount ?? 0;
            this._dom.productionValue.textContent = target > 0 ? `${count} / ${target}` : `${count}`;
        }
        
        // Production Bar
        if (this._dom.productionBarFill) {
            const count = this._data.productionCount ?? 0;
            const target = this._data.targetCount ?? 0;
            const percentage = target > 0 ? Math.min((count / target) * 100, 100) : 0;
            this._dom.productionBarFill.style.width = `${percentage}%`;
        }
        
        // Alarm Info
        if (this._dom.alarmCode && this._data.alarmCode) {
            this._dom.alarmCode.textContent = `⚠️ ${this._data.alarmCode}`;
        }
        
        // Alarm Message
        if (this._dom.alarmMessage && this._data.alarmMessage) {
            this._dom.alarmMessage.textContent = this._truncateText(this._data.alarmMessage, 30);
        }
        
        // Alarm Repeat
        if (this._dom.alarmRepeat && this._data.alarmRepeatCount) {
            this._dom.alarmRepeat.textContent = `🔄 ${this._data.alarmRepeatCount}회`;
        }
    }
    
    // =========================================
    // Debug Methods
    // =========================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group(`[EquipmentCard] ${this._data.frontendId}`);
        console.log('data:', this._data);
        console.log('isSelected:', this._isSelected);
        console.log('currentDuration:', this._formatDuration(this._currentDurationSeconds));
        console.groupEnd();
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.EquipmentCard = EquipmentCard;
}