/**
 * EquipmentCard.js
 * ================
 * 설비 카드 UI 컴포넌트
 * 
 * @version 1.2.0
 * @description
 * - 설비 카드 DOM 생성 및 관리
 * - 상태 인디케이터, 알람 정보, 생산 정보 표시
 * - 실시간 지속 시간 업데이트 (타이머)
 * - 긴급도 시각 효과 (Pulse 애니메이션)
 * - 클릭 이벤트 → EventBus 발행
 * - MiniTimeline 컴포넌트 연동 (Phase 6)
 * 
 * @changelog
 * - v1.2.0 (2026-01-23): 🆕 Phase 2 - 레인 이동 시 UI 업데이트
 *   - updateStatus(): 상태 변경 시 전체 UI 업데이트
 *   - updateProductionCount(): 생산 개수 실시간 업데이트
 *   - _updateStatusIcon(): Status Indicator 아이콘 변경
 *   - _updateStatusCSSClass(): CSS 클래스 교체
 *   - _updateAlarmInfo(): 알람 정보 동적 표시/숨김
 *   - ⚠️ 호환성: v1.1.0의 모든 기능 100% 유지
 * - v1.1.0: 🆕 Phase 6 - 긴급도 표시 강화 + MiniTimeline 통합
 *   - getUrgencyLevel() 메서드 추가
 *   - MiniTimeline 컴포넌트 통합
 *   - 긴급도 테두리 색상 동적 업데이트
 *   - 필드명 호환성 유지 (alarmMessage/alarmName, occurredAt/statusStartTime 등)
 *   - ⚠️ 호환성: v1.0.0의 모든 기능 100% 유지
 * - v1.0.0: 초기 버전
 *   - 카드 DOM 생성
 *   - 상태별 스타일링
 *   - 클릭 이벤트 처리
 *   - 지속 시간 타이머
 * 
 * @dependencies
 * - EventBus (src/core/managers/EventBus.js)
 * - DurationCalculator (../utils/DurationCalculator.js)
 * - MiniTimeline (./MiniTimeline.js)
 * 
 * @exports
 * - EquipmentCard
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/components/EquipmentCard.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-23
 */

import { eventBus } from '../../../core/managers/EventBus.js';
import { DurationCalculator } from '../utils/DurationCalculator.js';
import { MiniTimeline } from './MiniTimeline.js';

/**
 * 긴급도 임계값 설정 (분 단위)
 */
const URGENCY_THRESHOLDS = {
    WARNING: 5,    // 5분 초과 → Yellow
    DANGER: 10,    // 10분 초과 → Orange + Pulse
    CRITICAL: 15   // 15분 초과 → Red + 강한 Pulse
};

/**
 * Remote Alarm Code 목록
 */
const REMOTE_ALARM_CODES = [
    61, 62, 86, 10047, 10048, 10051, 10052, 10055, 10056, 10057, 10058, 10077
];

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
        TIMELINE: 'equipment-card__timeline',
        ALARM_INFO: 'equipment-card__alarm-info',
        ALARM_CODE: 'equipment-card__alarm-code',
        ALARM_MESSAGE: 'equipment-card__alarm-message',
        ALARM_REPEAT: 'equipment-card__alarm-repeat',
        PRODUCTION_INFO: 'equipment-card__production-info',
        PRODUCTION_COUNT: 'equipment-card__production-count',
        PRODUCTION_BAR: 'equipment-card__production-bar',
        PRODUCTION_BAR_FILL: 'equipment-card__production-bar-fill',
        PRODUCTION_PERCENT: 'equipment-card__production-percent',
        LOT_TIME: 'equipment-card__lot-time',
        
        // Status Modifiers
        STATUS_RUN: 'equipment-card--run',
        STATUS_STOP: 'equipment-card--stop',
        STATUS_IDLE: 'equipment-card--idle',
        STATUS_SUDDEN_STOP: 'equipment-card--sudden-stop',
        STATUS_REMOTE: 'equipment-card--remote',
        STATUS_WAIT: 'equipment-card--wait',
        
        // Urgency Modifiers (🆕 v1.1.0)
        URGENCY_WARNING: 'equipment-card--urgency-warning',
        URGENCY_DANGER: 'equipment-card--urgency-danger',
        URGENCY_CRITICAL: 'equipment-card--urgency-critical',
        
        // State Modifiers
        SELECTED: 'equipment-card--selected',
        ANIMATING: 'equipment-card--animating',
        ENTERING: 'equipment-card--entering',
        LEAVING: 'equipment-card--leaving',
        
        // Legacy alias (하위 호환)
        LEGACY_SELECTED: 'selected',
        LEGACY_ACTIVE: 'active'
    };
    
    /**
     * Status Icon 매핑
     */
    static STATUS_ICONS = {
        RUN: '🟢',
        STOP: '🛑',
        IDLE: '🟡',
        SUDDENSTOP: '⚠️',
        REMOTE: '🔴',
        WAIT: '⏸️',
        DEFAULT: '⚪'
    };
    
    /**
     * @param {Object} data - 설비 데이터
     * @param {Object} [options] - 옵션
     * @param {boolean} [options.showTimeline] - MiniTimeline 표시 여부
     */
    constructor(data, options = {}) {
        // Data (필드명 호환성 처리)
        this._data = this._normalizeData(data);
        
        // Options
        this._showTimeline = options.showTimeline ?? true;
        
        // DOM References
        this.element = null;
        this._durationElement = null;
		this._statusIndicatorElement = null;
		this._alarmInfoElement = null;
        this._productionBarFill = null;
        this._productionCountElement = null;
        this._productionPercentElement = null;
        this._lotTimeElement = null;
        this._timelineContainer = null;
        
        // Components
        this._miniTimeline = null;
        
        // State
        this._isSelected = false;
        this._currentUrgencyLevel = null;
        
        // Timer
        this._durationTimer = null;
        this._lotTimeTimer = null;
        
        // Event Handlers
        this._boundHandlers = {};
        
        // Initialize
        this._createDOM();
        this._setupEventListeners();
        this._startTimers();
        this._updateUrgencyLevel();
    }
    
    // =========================================
    // Private Methods
    // =========================================
    
    /**
     * 데이터 필드명 정규화 (호환성)
     * @private
     * @param {Object} data
     * @returns {Object}
     */
    _normalizeData(data) {
        return {
            // 기본 정보
            equipmentId: data.equipmentId || data.equipment_id,
            frontendId: data.frontendId || data.frontend_id || data.equipmentId,
            equipmentName: data.equipmentName || data.equipment_name,
            
            // 상태 정보
            status: data.status || 'UNKNOWN',
            
            // 시간 정보 (호환성: occurredAt / statusStartTime)
            occurredAt: data.occurredAt || data.statusStartTime || data.occurred_at || new Date().toISOString(),
            statusStartTime: data.statusStartTime || data.occurredAt || data.status_start_time,
            
            // 알람 정보 (호환성: alarmMessage / alarmName)
            alarmCode: data.alarmCode || data.alarm_code,
            alarmMessage: data.alarmMessage || data.alarmName || data.alarm_message || data.alarm_name,
            alarmName: data.alarmName || data.alarmMessage,
            
            // 알람 반복 (호환성: alarmRepeatCount / alarmRepeat)
            alarmRepeatCount: data.alarmRepeatCount || data.alarmRepeat || data.alarm_repeat_count || 0,
            alarmRepeat: data.alarmRepeat || data.alarmRepeatCount,
            
            // 생산 정보 (호환성: targetCount / productionTarget)
            productionCount: data.productionCount || data.production_count || 0,
            targetCount: data.targetCount || data.productionTarget || data.target_count || 0,
            productionTarget: data.productionTarget || data.targetCount,
            
            // Lot 정보
            lotId: data.lotId || data.lot_id,
            lotStartTime: data.lotStartTime || data.lot_start_time,
            
            // 히스토리 (MiniTimeline용)
            stateHistory: data.stateHistory || data.state_history || []
        };
    }
    
    /**
     * DOM 생성
     * @private
     */
    _createDOM() {
        // Main container
        this.element = document.createElement('div');
        this.element.classList.add(EquipmentCard.CSS.BLOCK);
        this.element.dataset.equipmentId = this._data.frontendId;
        
        // Status modifier 추가
        this._addStatusModifier();
        
        // Header (Status + ID + Duration)
        const header = this._createHeader();
        this.element.appendChild(header);
        
        // 🆕 v1.1.0: Timeline (MiniTimeline)
        if (this._showTimeline) {
            this._timelineContainer = this._createTimeline();
            this.element.appendChild(this._timelineContainer);
        }
        
        // Alarm Info (알람이 있는 경우만) - 🆕 v1.2.0: 동적 표시/숨김 지원
        if (this._data.alarmCode) {
            this._createAlarmInfo();
            this.element.appendChild(this._alarmInfoElement);
        }
        
        // Production Info
        const productionInfo = this._createProductionInfo();
        this.element.appendChild(productionInfo);
        
        // Lot Time
        if (this._data.lotStartTime) {
            const lotTime = this._createLotTime();
            this.element.appendChild(lotTime);
        }
    }
    
    /**
     * Status Modifier 추가
     * @private
     */
    _addStatusModifier() {
        const status = this._data.status?.toUpperCase();
        const alarmCode = this._data.alarmCode;
        
        // Remote 알람 체크
        if (status === 'SUDDENSTOP' && REMOTE_ALARM_CODES.includes(alarmCode)) {
            this.element.classList.add(EquipmentCard.CSS.STATUS_REMOTE);
            return;
        }
        
        // 일반 상태
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
                this.element.classList.add(EquipmentCard.CSS.STATUS_SUDDEN_STOP);
                break;
            case 'WAIT':
                this.element.classList.add(EquipmentCard.CSS.STATUS_WAIT);
                break;
        }
    }
    
    /**
     * Header 생성
     * @private
     * @returns {HTMLElement}
     */
    _createHeader() {
        const header = document.createElement('div');
        header.classList.add(EquipmentCard.CSS.HEADER);
        
        // Status Indicator (🆕 v1.2.0: 참조 저장)
        this._statusIndicatorElement = document.createElement('span');
        this._statusIndicatorElement.classList.add(EquipmentCard.CSS.STATUS_INDICATOR);
        this._statusIndicatorElement.textContent = this._getStatusIcon();
        header.appendChild(this._statusIndicatorElement);
        
        const equipmentName = document.createElement('span');
        equipmentName.classList.add(EquipmentCard.CSS.EQUIPMENT_ID);  // CSS는 유지
        equipmentName.textContent = this._data.equipmentName || this._data.frontendId;  // ✅ "DRY-001"
        header.appendChild(equipmentName);
        
        // Duration
        this._durationElement = document.createElement('span');
        this._durationElement.classList.add(EquipmentCard.CSS.DURATION);
        this._durationElement.textContent = this._formatDuration(this._data.occurredAt);
        header.appendChild(this._durationElement);
        
        return header;
    }
    
    /**
     * 🆕 v1.1.0: Timeline 생성 (MiniTimeline 컴포넌트)
     * @private
     * @returns {HTMLElement}
     */
    _createTimeline() {
        const container = document.createElement('div');
        container.classList.add(EquipmentCard.CSS.TIMELINE);
        
        // MiniTimeline 컴포넌트 생성
        this._miniTimeline = new MiniTimeline({
            historyData: this._data.stateHistory,    // ✅ 'history' → 'historyData'
            equipmentId: this._data.frontendId,      // ✅ 추가 권장 (디버깅용)
            width: '100%',
            height: 20
        });
        
        container.appendChild(this._miniTimeline.element);
        
        return container;
    }
    
    /**
     * Alarm Info 생성
     * @private
     * @returns {HTMLElement}
     */
    _createAlarmInfo() {
        // 🆕 v1.2.0: 참조 저장 (동적 표시/숨김용)
        this._alarmInfoElement = document.createElement('div');
        this._alarmInfoElement.classList.add(EquipmentCard.CSS.ALARM_INFO);
        
        // Alarm Code + Message
        const alarmText = document.createElement('div');
        alarmText.classList.add(EquipmentCard.CSS.ALARM_CODE);
        alarmText.innerHTML = `⚠️ <strong>${this._data.alarmCode}</strong>: ${this._data.alarmMessage || 'Unknown'}`;
        this._alarmInfoElement.appendChild(alarmText);
        
        // Alarm Repeat Count
        if (this._data.alarmRepeatCount > 0) {
            const repeatCount = document.createElement('div');
            repeatCount.classList.add(EquipmentCard.CSS.ALARM_REPEAT);
            repeatCount.textContent = `🔄 반복: ${this._data.alarmRepeatCount}회`;
            this._alarmInfoElement.appendChild(repeatCount);
        }
        
        return this._alarmInfoElement;
    }
    
    /**
     * Production Info 생성
     * @private
     * @returns {HTMLElement}
     */
    _createProductionInfo() {
        const productionInfo = document.createElement('div');
        productionInfo.classList.add(EquipmentCard.CSS.PRODUCTION_INFO);
        
        // Production Count
        this._productionCountElement = document.createElement('div');
        this._productionCountElement.classList.add(EquipmentCard.CSS.PRODUCTION_COUNT);
        this._updateProductionCountText();
        productionInfo.appendChild(this._productionCountElement);
        
        // Progress Bar
        const progressBar = document.createElement('div');
        progressBar.classList.add(EquipmentCard.CSS.PRODUCTION_BAR);
        
        this._productionBarFill = document.createElement('div');
        this._productionBarFill.classList.add(EquipmentCard.CSS.PRODUCTION_BAR_FILL);
        this._updateProgressBar();
        progressBar.appendChild(this._productionBarFill);
        
        productionInfo.appendChild(progressBar);
        
        // Percentage
        this._productionPercentElement = document.createElement('span');
        this._productionPercentElement.classList.add(EquipmentCard.CSS.PRODUCTION_PERCENT);
        this._updatePercentageText();
        productionInfo.appendChild(this._productionPercentElement);
        
        return productionInfo;
    }
    
    /**
     * Lot Time 생성
     * @private
     * @returns {HTMLElement}
     */
    _createLotTime() {
        const lotTime = document.createElement('div');
        lotTime.classList.add(EquipmentCard.CSS.LOT_TIME);
        
        this._lotTimeElement = document.createElement('span');
        this._lotTimeElement.textContent = `⏳ Lot Time: ${this._formatDuration(this._data.lotStartTime)}`;
        lotTime.appendChild(this._lotTimeElement);
        
        return lotTime;
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // Click handler
        this._boundHandlers.onClick = this._handleClick.bind(this);
        this.element.addEventListener('click', this._boundHandlers.onClick);
        
        // Double click handler (예약: 3D View 전환)
        this._boundHandlers.onDoubleClick = this._handleDoubleClick.bind(this);
        this.element.addEventListener('dblclick', this._boundHandlers.onDoubleClick);
    }
    
    /**
     * 타이머 시작
     * @private
     */
    _startTimers() {
        // Duration 타이머 (2초 간격)
        this._durationTimer = setInterval(() => {
            this._updateDuration();
            this._updateUrgencyLevel();
        }, 2000);
        
        // Lot Time 타이머 (2초 간격)
        if (this._data.lotStartTime && this._lotTimeElement) {
            this._lotTimeTimer = setInterval(() => {
                this._updateLotTime();
            }, 2000);
        }
    }
    
    /**
     * 타이머 중지
     * @private
     */
    _stopTimers() {
        if (this._durationTimer) {
            clearInterval(this._durationTimer);
            this._durationTimer = null;
        }
        
        if (this._lotTimeTimer) {
            clearInterval(this._lotTimeTimer);
            this._lotTimeTimer = null;
        }
    }
    
    /**
     * Status Icon 가져오기
     * @private
     * @returns {string}
     */
    _getStatusIcon() {
        const status = this._data.status?.toUpperCase();
        const alarmCode = this._data.alarmCode;
        
        // Remote 알람
        if (status === 'SUDDENSTOP' && REMOTE_ALARM_CODES.includes(alarmCode)) {
            return EquipmentCard.STATUS_ICONS.REMOTE;
        }
        
        return EquipmentCard.STATUS_ICONS[status] || EquipmentCard.STATUS_ICONS.DEFAULT;
    }
    
    /**
     * Duration 포맷팅
     * @private
     * @param {string} startTime - ISO 시간 문자열
     * @returns {string}
     */
	_formatDuration(startTime) {
	    if (!startTime) return '00:00:00';
	    
	    // 1단계: 시작 시간 → 현재까지 경과 시간 (밀리초)
	    const durationMs = DurationCalculator.calculateStatusDuration(startTime);
	    
	    // 2단계: 밀리초 → "HH:MM:SS" 문자열
	    return DurationCalculator.formatDuration(durationMs);
	}
    
    /**
     * Duration 업데이트
     * @private
     */
    _updateDuration() {
        if (this._durationElement) {
            this._durationElement.textContent = this._formatDuration(this._data.occurredAt);
        }
    }
    
    /**
     * Lot Time 업데이트
     * @private
     */
    _updateLotTime() {
        if (this._lotTimeElement && this._data.lotStartTime) {
            this._lotTimeElement.textContent = `⏳ Lot Time: ${this._formatDuration(this._data.lotStartTime)}`;
        }
    }
    
    /**
     * Production Count 텍스트 업데이트
     * @private
     */
    _updateProductionCountText() {
        if (this._productionCountElement) {
            const count = this._data.productionCount || 0;
            const target = this._data.targetCount || 0;
            this._productionCountElement.innerHTML = `📦 <strong>${count}</strong> / ${target}`;
        }
    }
    
    /**
     * Progress Bar 업데이트
     * @private
     */
    _updateProgressBar() {
        if (this._productionBarFill) {
            const count = this._data.productionCount || 0;
            const target = this._data.targetCount || 1;
            const percent = Math.min(100, (count / target) * 100);
            this._productionBarFill.style.width = `${percent}%`;
        }
    }
    
    /**
     * Percentage 텍스트 업데이트
     * @private
     */
    _updatePercentageText() {
        if (this._productionPercentElement) {
            const count = this._data.productionCount || 0;
            const target = this._data.targetCount || 1;
            const percent = Math.min(100, Math.round((count / target) * 100));
            this._productionPercentElement.textContent = `${percent}%`;
        }
    }
    
    /**
     * 🆕 v1.1.0: 긴급도 레벨 업데이트
     * @private
     */
    _updateUrgencyLevel() {
        const level = this.getUrgencyLevel();
        
        // 이전 레벨과 동일하면 스킵
        if (level === this._currentUrgencyLevel) return;
        
        // 이전 긴급도 클래스 제거
        this.element.classList.remove(
            EquipmentCard.CSS.URGENCY_WARNING,
            EquipmentCard.CSS.URGENCY_DANGER,
            EquipmentCard.CSS.URGENCY_CRITICAL
        );
        
        // 새 긴급도 클래스 추가
        switch (level) {
            case 'warning':
                this.element.classList.add(EquipmentCard.CSS.URGENCY_WARNING);
                break;
            case 'danger':
                this.element.classList.add(EquipmentCard.CSS.URGENCY_DANGER);
                break;
            case 'critical':
                this.element.classList.add(EquipmentCard.CSS.URGENCY_CRITICAL);
                break;
        }
        
        this._currentUrgencyLevel = level;
    }
    
	 /**
     * 🆕 v1.2.0: Status Icon 업데이트
     * @private
     */
    _updateStatusIcon() {
        if (this._statusIndicatorElement) {
            this._statusIndicatorElement.textContent = this._getStatusIcon();
        }
    }
    
    /**
     * 🆕 v1.2.0: Status CSS 클래스 교체
     * @private
     * @param {string} oldStatus - 이전 상태
     * @param {string} newStatus - 새 상태
     */
    _updateStatusCSSClass(oldStatus, newStatus) {
        if (!this.element) return;
        
        // 모든 상태 클래스 제거
        this.element.classList.remove(
            EquipmentCard.CSS.STATUS_RUN,
            EquipmentCard.CSS.STATUS_STOP,
            EquipmentCard.CSS.STATUS_IDLE,
            EquipmentCard.CSS.STATUS_SUDDEN_STOP,
            EquipmentCard.CSS.STATUS_REMOTE,
            EquipmentCard.CSS.STATUS_WAIT
        );
        
        // 새 상태 클래스 추가
        const status = newStatus?.toUpperCase();
        const alarmCode = this._data.alarmCode;
        
        // Remote 알람 체크
        if (status === 'SUDDENSTOP' && REMOTE_ALARM_CODES.includes(alarmCode)) {
            this.element.classList.add(EquipmentCard.CSS.STATUS_REMOTE);
            return;
        }
        
        // 일반 상태
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
                this.element.classList.add(EquipmentCard.CSS.STATUS_SUDDEN_STOP);
                break;
            case 'WAIT':
                this.element.classList.add(EquipmentCard.CSS.STATUS_WAIT);
                break;
        }
    }
    
    /**
     * 🆕 v1.2.0: Alarm Info 동적 표시/숨김
     * @private
     */
    _updateAlarmInfo() {
        const hasAlarm = !!this._data.alarmCode;
        
        if (hasAlarm) {
            // 알람이 있는 경우
            if (!this._alarmInfoElement) {
                // Alarm Info 요소가 없으면 생성
                this._createAlarmInfo();
                
                // Timeline과 Production Info 사이에 삽입
                const productionInfo = this.element.querySelector(`.${EquipmentCard.CSS.PRODUCTION_INFO}`);
                if (productionInfo) {
                    this.element.insertBefore(this._alarmInfoElement, productionInfo);
                } else {
                    this.element.appendChild(this._alarmInfoElement);
                }
            } else {
                // 기존 Alarm Info 내용 업데이트
                const alarmCodeEl = this._alarmInfoElement.querySelector(`.${EquipmentCard.CSS.ALARM_CODE}`);
                if (alarmCodeEl) {
                    alarmCodeEl.innerHTML = `⚠️ <strong>${this._data.alarmCode}</strong>: ${this._data.alarmMessage || 'Unknown'}`;
                }
                
                // 반복 횟수 업데이트
                let repeatEl = this._alarmInfoElement.querySelector(`.${EquipmentCard.CSS.ALARM_REPEAT}`);
                if (this._data.alarmRepeatCount > 0) {
                    if (!repeatEl) {
                        repeatEl = document.createElement('div');
                        repeatEl.classList.add(EquipmentCard.CSS.ALARM_REPEAT);
                        this._alarmInfoElement.appendChild(repeatEl);
                    }
                    repeatEl.textContent = `🔄 반복: ${this._data.alarmRepeatCount}회`;
                } else if (repeatEl) {
                    repeatEl.remove();
                }
            }
        } else {
            // 알람이 없는 경우 - 요소 제거
            if (this._alarmInfoElement) {
                this._alarmInfoElement.remove();
                this._alarmInfoElement = null;
            }
        }
    }
	
    // =========================================
    // Event Handlers
    // =========================================
    
    /**
     * 클릭 이벤트 처리
     * @private
     * @param {MouseEvent} event
     */
    _handleClick(event) {
        event.stopPropagation();
        
        console.log(`[EquipmentCard] 🖱️ 클릭: ${this._data.frontendId}`);
        
        // EventBus 이벤트 발행
        eventBus.emit('equipment:select', {
            equipmentId: this._data.equipmentId,
            frontendId: this._data.frontendId,
            source: 'ranking-view',
            cardData: this._data
        });
        
        // 카드 클릭 이벤트 (LaneManager용)
        eventBus.emit('ranking:card:click', {
            equipmentId: this._data.equipmentId,
            frontendId: this._data.frontendId,
            element: this.element
        });
    }
    
    /**
     * 더블클릭 이벤트 처리 (예약)
     * @private
     * @param {MouseEvent} event
     */
    _handleDoubleClick(event) {
        event.stopPropagation();
        
        console.log(`[EquipmentCard] 🖱️🖱️ 더블클릭: ${this._data.frontendId}`);
        
        // 예약: 3D View 전환 후 해당 설비로 카메라 이동
        eventBus.emit('equipment:focus-3d', {
            equipmentId: this._data.equipmentId,
            frontendId: this._data.frontendId
        });
    }
    
    // =========================================
    // Public Methods
    // =========================================
    
    /**
     * 🆕 v1.1.0: 현재 긴급도 레벨 가져오기
     * @returns {string|null} 'warning' | 'danger' | 'critical' | null
     */
	getUrgencyLevel() {
	    const status = this._data.status?.toUpperCase();
	    if (status === 'RUN' || status === 'WAIT') {
	        return null;
	    }
	    
	    // 1단계: 시작 시간 → 현재까지 경과 시간 (밀리초)
	    const durationMs = DurationCalculator.calculateStatusDuration(this._data.occurredAt);
	    
	    // 2단계: 밀리초 → 분 단위로 변환
	    const durationMinutes = DurationCalculator.getDurationMinutes(durationMs);
	    
	    if (durationMinutes >= URGENCY_THRESHOLDS.CRITICAL) {
	        return 'critical';
	    } else if (durationMinutes >= URGENCY_THRESHOLDS.DANGER) {
	        return 'danger';
	    } else if (durationMinutes >= URGENCY_THRESHOLDS.WARNING) {
	        return 'warning';
	    }
	    
	    return null;
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
     * 선택 상태 확인
     * @returns {boolean}
     */
    get isSelected() {
        return this._isSelected;
    }
    
	 /**
     * 🆕 v1.2.0: 상태 변경 시 전체 UI 업데이트
     * 레인 이동 시 호출되어 Status Icon, CSS Class, Duration, Alarm 등을 업데이트
     * 
     * @param {Object} newData - 새 설비 데이터
     * @param {Object} [options={}] - 업데이트 옵션
     * @param {boolean} [options.resetDuration=true] - Duration 리셋 여부
     */
    updateStatus(newData, options = {}) {
        const { resetDuration = true } = options;
        
        // 1. 데이터 정규화 및 병합
        const normalized = this._normalizeData(newData);
        const oldStatus = this._data.status;
        const newStatus = normalized.status;
        
        console.log(`[EquipmentCard] 🔄 Status Update: ${this._data.frontendId} (${oldStatus} → ${newStatus})`);
        
        // 2. Duration 리셋 (상태 변경 시)
        if (resetDuration && oldStatus !== newStatus) {
            normalized.occurredAt = new Date().toISOString();
            normalized.statusStartTime = normalized.occurredAt;
        }
        
        // 3. 데이터 업데이트
        Object.assign(this._data, normalized);
        
        // 4. UI 업데이트
        this._updateStatusIcon();
        this._updateStatusCSSClass(oldStatus, newStatus);
        this._updateDuration();
        this._updateAlarmInfo();
        this._updateUrgencyLevel();
        
        // 5. Production 정보 업데이트
        this._updateProductionCountText();
        this._updateProgressBar();
        this._updatePercentageText();
        
        // 6. MiniTimeline 업데이트 (히스토리 추가)
        if (this._miniTimeline && newStatus !== oldStatus) {
            const historyEntry = {
                status: newStatus,
                timestamp: new Date().toISOString()
            };
            
            if (!this._data.stateHistory) {
                this._data.stateHistory = [];
            }
            this._data.stateHistory.push(historyEntry);
            
            this._miniTimeline.update(this._data.stateHistory);
        }
    }
    
    /**
     * 🆕 v1.2.0: 생산 개수 실시간 업데이트
     * WebSocket에서 생산 개수 변경 시 호출
     * 
     * @param {number} count - 새 생산 개수
     * @param {number} [target] - 새 목표 개수 (선택)
     */
    updateProductionCount(count, target) {
        this._data.productionCount = count;
        if (target !== undefined) {
            this._data.targetCount = target;
            this._data.productionTarget = target;
        }
        
        this._updateProductionCountText();
        this._updateProgressBar();
        this._updatePercentageText();
        
        console.log(`[EquipmentCard] 📦 Production Update: ${this._data.frontendId} = ${count}/${this._data.targetCount}`);
    }
	
	
    /**
     * 데이터 업데이트
     * @param {Object} newData
     */
    update(newData) {
        // 데이터 정규화 후 병합
        const normalized = this._normalizeData(newData);
        Object.assign(this._data, normalized);
        
        // UI 업데이트
        this._updateDuration();
        this._updateProductionCountText();
        this._updateProgressBar();
        this._updatePercentageText();
        this._updateUrgencyLevel();
        
        // MiniTimeline 업데이트
        if (this._miniTimeline && normalized.stateHistory) {
            this._miniTimeline.update(normalized.stateHistory);
        }
    }
    
    /**
     * 데이터 가져오기
     * @returns {Object}
     */
    getData() {
        return { ...this._data };
    }
    
    /**
     * Equipment ID 가져오기
     * @returns {string}
     */
    get id() {
        return this._data.frontendId || this._data.equipmentId;
    }
    
    /**
     * 카드 요소를 뷰포트로 스크롤
     */
    scrollIntoView() {
        this.element?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        // 타이머 중지
        this._stopTimers();
        
        // 이벤트 리스너 제거
        this.element?.removeEventListener('click', this._boundHandlers.onClick);
        this.element?.removeEventListener('dblclick', this._boundHandlers.onDoubleClick);
        
        // MiniTimeline 정리
        if (this._miniTimeline) {
            this._miniTimeline.dispose();
            this._miniTimeline = null;
        }
        
        // DOM 제거
        this.element?.remove();
        
        // 참조 해제
        this.element = null;
        this._durationElement = null;
        this._statusIndicatorElement = null;   // 🆕 v1.2.0
        this._alarmInfoElement = null;          // 🆕 v1.2.0
        this._productionBarFill = null;
        this._productionCountElement = null;
        this._productionPercentElement = null;
        this._lotTimeElement = null;
        this._timelineContainer = null;
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.EquipmentCard = EquipmentCard;
}