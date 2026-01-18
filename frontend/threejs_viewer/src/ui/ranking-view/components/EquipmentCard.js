/**
 * EquipmentCard.js
 * ================
 * 설비 카드 컴포넌트 (긴급도 표시 강화 버전)
 * 
 * @version 1.1.0
 * @description
 * - 설비 상태 카드 UI
 * - 실시간 지속 시간 업데이트
 * - 긴급도 시각 효과 (Pulse 애니메이션)
 * - 상태별 색상 표시
 * - 클릭 시 Equipment Info Drawer 연동
 * - MiniTimeline 통합
 * 
 * @changelog
 * - v1.1.0: 긴급도 표시 강화
 *   - 5분/10분/15분 초과 시 시각적 긴급도 표시
 *   - Pulse 애니메이션 적용
 *   - 긴급도 레벨별 테두리 색상
 *   - MiniTimeline 컴포넌트 통합
 *   - ⚠️ 호환성: 기존 모든 필드/로직 100% 유지
 * - v1.0.0: 초기 버전
 *   - 카드 DOM 생성
 *   - 상태 인디케이터
 *   - 지속 시간 타이머
 *   - 클릭 이벤트 처리
 * 
 * @dependencies
 * - EventBus (이벤트 발행)
 * - DurationCalculator (시간 계산)
 * - MiniTimeline (상태 히스토리)
 * 
 * @exports
 * - EquipmentCard
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/components/EquipmentCard.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-19
 */

import { EventBus } from '../../../core/managers/EventBus.js';
import { DurationCalculator } from '../utils/DurationCalculator.js';
import { MiniTimeline } from './MiniTimeline.js';

export class EquipmentCard {
    // =========================================================================
    // CSS 클래스 상수
    // =========================================================================
    static CSS = {
        // Block
        BLOCK: 'equipment-card',
        
        // Elements - Header
        HEADER: 'equipment-card__header',
        STATUS_INDICATOR: 'equipment-card__status-indicator',
        EQUIPMENT_ID: 'equipment-card__equipment-id',
        
        // Elements - Duration
        DURATION: 'equipment-card__duration',
        DURATION_VALUE: 'equipment-card__duration-value',
        DURATION_LABEL: 'equipment-card__duration-label',
        
        // Elements - Timeline
        TIMELINE: 'equipment-card__timeline',
        
        // Elements - Alarm Info
        ALARM_INFO: 'equipment-card__alarm-info',
        ALARM_CODE: 'equipment-card__alarm-code',
        ALARM_NAME: 'equipment-card__alarm-name',
        ALARM_REPEAT: 'equipment-card__alarm-repeat',
        
        // Elements - Production Info
        PRODUCTION_INFO: 'equipment-card__production-info',
        PRODUCTION_BAR: 'equipment-card__production-bar',
        PRODUCTION_BAR_FILL: 'equipment-card__production-bar-fill',
        PRODUCTION_COUNT: 'equipment-card__production-count',
        LOT_TIME: 'equipment-card__lot-time',
        
        // Status Modifiers
        STATUS_RUN: 'equipment-card--run',
        STATUS_STOP: 'equipment-card--stop',
        STATUS_IDLE: 'equipment-card--idle',
        STATUS_SUDDEN_STOP: 'equipment-card--sudden-stop',
        STATUS_REMOTE: 'equipment-card--remote',
        STATUS_WAIT: 'equipment-card--wait',
        
        // Urgency Modifiers (긴급도)
        URGENCY_WARNING: 'equipment-card--urgency-warning',     // 5분 초과 - 노란색
        URGENCY_DANGER: 'equipment-card--urgency-danger',       // 10분 초과 - 주황색
        URGENCY_CRITICAL: 'equipment-card--urgency-critical',   // 15분 초과 - 빨간색
        
        // Animation Modifiers
        ANIMATING: 'equipment-card--animating',
        SELECTED: 'equipment-card--selected',
        ENTERING: 'equipment-card--entering',
        LEAVING: 'equipment-card--leaving',
        
        // Legacy alias (하위 호환)
        LEGACY_SELECTED: 'selected',
        LEGACY_ACTIVE: 'active'
    };
    
    // =========================================================================
    // 긴급도 임계값 (분 단위)
    // =========================================================================
    static URGENCY_THRESHOLDS = {
        WARNING: 5,     // 5분 초과 - 노란색 테두리
        DANGER: 10,     // 10분 초과 - 주황색 테두리 + Pulse
        CRITICAL: 15    // 15분 초과 - 빨간색 테두리 + 강한 Pulse
    };
    
    // =========================================================================
    // 상태별 색상
    // =========================================================================
    static STATUS_COLORS = {
        'RUN': 'var(--interactive-success, #22c55e)',
        'SUDDENSTOP': 'var(--interactive-danger-normal, #ef4444)',
        'STOP': 'var(--interactive-warning, #f97316)',
        'IDLE': 'var(--status-idle-color, #eab308)',
        'WAIT': 'var(--content-muted, #94a3b8)',
        'REMOTE': 'var(--interactive-primary-normal, #8b5cf6)'
    };
    
    // =========================================================================
    // 설정
    // =========================================================================
    static CONFIG = {
        DURATION_UPDATE_INTERVAL: 2000,     // 지속 시간 업데이트 간격 (2초)
        URGENCY_CHECK_INTERVAL: 5000        // 긴급도 체크 간격 (5초)
    };
    
    // =========================================================================
    // 생성자
    // =========================================================================
    /**
     * EquipmentCard 생성자
     * @param {Object} data - 설비 데이터
     * @param {string} data.equipmentId - 설비 ID
     * @param {string} data.frontendId - 프론트엔드 ID
     * @param {string} data.status - 현재 상태
     * @param {number} [data.alarmCode] - 알람 코드
     * @param {string} [data.alarmName] - 알람 이름
     * @param {number} [data.alarmRepeat] - 알람 반복 횟수
     * @param {number} [data.productionCount] - 생산 개수
     * @param {number} [data.productionTarget] - 생산 목표
     * @param {Date|string} data.statusStartTime - 상태 시작 시간
     * @param {Date|string} [data.lotStartTime] - Lot 시작 시간
     * @param {Array} [data.historyData] - 상태 히스토리
     * @param {Object} [options] - 옵션
     */
    constructor(data, options = {}) {
        this.data = data;
        this.options = {
            showTimeline: options.showTimeline !== false,
            showProduction: options.showProduction !== false,
            showAlarm: options.showAlarm !== false,
            ...options
        };
        
        // DOM 요소
        this.element = null;
        this.durationElement = null;
        this.productionBarFill = null;
        this.miniTimeline = null;
        
        // 상태
        this._isSelected = false;
        this._isDisposed = false;
        this._currentUrgencyLevel = null;
        
        // 타이머
        this._durationTimer = null;
        this._urgencyTimer = null;
        
        // 이벤트 핸들러
        this._boundHandlers = {};
        
        // 초기화
        this._init();
    }
    
    // =========================================================================
    // 초기화
    // =========================================================================
    _init() {
        this._createDOM();
        this._applyStatusStyle();
        this._setupEventListeners();
        this._startDurationTimer();
        this._startUrgencyTimer();
        this._updateUrgencyIndicator();
        
        console.log(`[EquipmentCard] ✅ Initialized: ${this.data.frontendId}`);
    }
    
    // =========================================================================
    // DOM 생성
    // =========================================================================
    _createDOM() {
        // 카드 컨테이너
        this.element = document.createElement('div');
        this.element.classList.add(EquipmentCard.CSS.BLOCK);
        this.element.dataset.equipmentId = this.data.equipmentId;
        this.element.dataset.frontendId = this.data.frontendId;
        
        // Header (상태 인디케이터 + 설비 ID)
        const header = this._createHeader();
        this.element.appendChild(header);
        
        // 지속 시간
        const duration = this._createDuration();
        this.element.appendChild(duration);
        
        // MiniTimeline (옵션)
        if (this.options.showTimeline) {
            const timeline = this._createTimeline();
            this.element.appendChild(timeline);
        }
        
        // 알람 정보 (옵션)
        if (this.options.showAlarm && this.data.alarmCode) {
            const alarmInfo = this._createAlarmInfo();
            this.element.appendChild(alarmInfo);
        }
        
        // 생산 정보 (옵션)
        if (this.options.showProduction) {
            const productionInfo = this._createProductionInfo();
            this.element.appendChild(productionInfo);
        }
    }
    
    // =========================================================================
    // Header 생성
    // =========================================================================
    _createHeader() {
        const header = document.createElement('div');
        header.classList.add(EquipmentCard.CSS.HEADER);
        
        // 상태 인디케이터
        const indicator = document.createElement('div');
        indicator.classList.add(EquipmentCard.CSS.STATUS_INDICATOR);
        indicator.style.backgroundColor = EquipmentCard.STATUS_COLORS[this.data.status] || EquipmentCard.STATUS_COLORS.WAIT;
        header.appendChild(indicator);
        
        // 설비 ID
        const equipmentId = document.createElement('span');
        equipmentId.classList.add(EquipmentCard.CSS.EQUIPMENT_ID);
        equipmentId.textContent = this.data.frontendId || this.data.equipmentId;
        header.appendChild(equipmentId);
        
        return header;
    }
    
    // =========================================================================
    // 지속 시간 생성
    // =========================================================================
    _createDuration() {
        const duration = document.createElement('div');
        duration.classList.add(EquipmentCard.CSS.DURATION);
        
        const durationValue = document.createElement('span');
        durationValue.classList.add(EquipmentCard.CSS.DURATION_VALUE);
        durationValue.textContent = this._calculateDuration();
        this.durationElement = durationValue;
        duration.appendChild(durationValue);
        
        const durationLabel = document.createElement('span');
        durationLabel.classList.add(EquipmentCard.CSS.DURATION_LABEL);
        durationLabel.textContent = '경과';
        duration.appendChild(durationLabel);
        
        return duration;
    }
    
    // =========================================================================
    // MiniTimeline 생성
    // =========================================================================
    _createTimeline() {
        const timelineContainer = document.createElement('div');
        timelineContainer.classList.add(EquipmentCard.CSS.TIMELINE);
        
        // MiniTimeline 컴포넌트 생성
        this.miniTimeline = new MiniTimeline({
            historyData: this.data.historyData || [],
            equipmentId: this.data.frontendId || this.data.equipmentId,
            width: 120,
            height: 12
        });
        
        timelineContainer.appendChild(this.miniTimeline.getElement());
        
        return timelineContainer;
    }
    
    // =========================================================================
    // 알람 정보 생성
    // =========================================================================
    _createAlarmInfo() {
        const alarmInfo = document.createElement('div');
        alarmInfo.classList.add(EquipmentCard.CSS.ALARM_INFO);
        
        // 알람 코드
        const alarmCode = document.createElement('span');
        alarmCode.classList.add(EquipmentCard.CSS.ALARM_CODE);
        alarmCode.textContent = `#${this.data.alarmCode}`;
        alarmInfo.appendChild(alarmCode);
        
        // 알람 이름
        if (this.data.alarmName) {
            const alarmName = document.createElement('span');
            alarmName.classList.add(EquipmentCard.CSS.ALARM_NAME);
            alarmName.textContent = this.data.alarmName;
            alarmInfo.appendChild(alarmName);
        }
        
        // 알람 반복 횟수
        if (this.data.alarmRepeat && this.data.alarmRepeat > 1) {
            const alarmRepeat = document.createElement('span');
            alarmRepeat.classList.add(EquipmentCard.CSS.ALARM_REPEAT);
            alarmRepeat.textContent = `×${this.data.alarmRepeat}`;
            alarmInfo.appendChild(alarmRepeat);
        }
        
        return alarmInfo;
    }
    
    // =========================================================================
    // 생산 정보 생성
    // =========================================================================
    _createProductionInfo() {
        const productionInfo = document.createElement('div');
        productionInfo.classList.add(EquipmentCard.CSS.PRODUCTION_INFO);
        
        // 생산 진행 바
        const productionBar = document.createElement('div');
        productionBar.classList.add(EquipmentCard.CSS.PRODUCTION_BAR);
        
        const productionBarFill = document.createElement('div');
        productionBarFill.classList.add(EquipmentCard.CSS.PRODUCTION_BAR_FILL);
        const progress = this._calculateProductionProgress();
        productionBarFill.style.width = `${progress}%`;
        this.productionBarFill = productionBarFill;
        productionBar.appendChild(productionBarFill);
        
        productionInfo.appendChild(productionBar);
        
        // 생산 개수
        const productionCount = document.createElement('span');
        productionCount.classList.add(EquipmentCard.CSS.PRODUCTION_COUNT);
        productionCount.textContent = this._formatProductionCount();
        this.productionCountElement = productionCount;
        productionInfo.appendChild(productionCount);
        
        // Lot 시간 (옵션)
        if (this.data.lotStartTime) {
            const lotTime = document.createElement('span');
            lotTime.classList.add(EquipmentCard.CSS.LOT_TIME);
            lotTime.textContent = this._calculateLotTime();
            this.lotTimeElement = lotTime;
            productionInfo.appendChild(lotTime);
        }
        
        return productionInfo;
    }
    
    // =========================================================================
    // 상태 스타일 적용
    // =========================================================================
    _applyStatusStyle() {
        // 기존 상태 클래스 제거
        Object.keys(EquipmentCard.CSS)
            .filter(key => key.startsWith('STATUS_'))
            .forEach(key => {
                this.element.classList.remove(EquipmentCard.CSS[key]);
            });
        
        // 새 상태 클래스 적용
        const statusClassMap = {
            'RUN': EquipmentCard.CSS.STATUS_RUN,
            'STOP': EquipmentCard.CSS.STATUS_STOP,
            'IDLE': EquipmentCard.CSS.STATUS_IDLE,
            'SUDDENSTOP': EquipmentCard.CSS.STATUS_SUDDEN_STOP,
            'REMOTE': EquipmentCard.CSS.STATUS_REMOTE,
            'WAIT': EquipmentCard.CSS.STATUS_WAIT
        };
        
        const statusClass = statusClassMap[this.data.status] || EquipmentCard.CSS.STATUS_WAIT;
        this.element.classList.add(statusClass);
    }
    
    // =========================================================================
    // 이벤트 리스너 설정
    // =========================================================================
    _setupEventListeners() {
        this._boundHandlers.onClick = this._handleClick.bind(this);
        this._boundHandlers.onKeyDown = this._handleKeyDown.bind(this);
        
        this.element.addEventListener('click', this._boundHandlers.onClick);
        this.element.addEventListener('keydown', this._boundHandlers.onKeyDown);
        
        // 포커스 가능하게 설정
        this.element.setAttribute('tabindex', '0');
        this.element.setAttribute('role', 'button');
        this.element.setAttribute('aria-label', `설비 ${this.data.frontendId} 상세 보기`);
    }
    
    // =========================================================================
    // 클릭 이벤트 핸들러
    // =========================================================================
    _handleClick(event) {
        event.stopPropagation();
        
        console.log(`[EquipmentCard] 📌 Clicked: ${this.data.frontendId}`);
        
        // EventBus로 선택 이벤트 발행
        EventBus.emit('equipment:select', {
            equipmentId: this.data.equipmentId,
            frontendId: this.data.frontendId,
            source: 'ranking-view',
            cardElement: this.element
        });
        
        // 선택 상태 업데이트
        this.setSelected(true);
    }
    
    // =========================================================================
    // 키보드 이벤트 핸들러
    // =========================================================================
    _handleKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this._handleClick(event);
        }
    }
    
    // =========================================================================
    // 지속 시간 타이머
    // =========================================================================
    _startDurationTimer() {
        this._durationTimer = setInterval(() => {
            this._updateDuration();
        }, EquipmentCard.CONFIG.DURATION_UPDATE_INTERVAL);
    }
    
    _stopDurationTimer() {
        if (this._durationTimer) {
            clearInterval(this._durationTimer);
            this._durationTimer = null;
        }
    }
    
    _updateDuration() {
        if (this.durationElement) {
            this.durationElement.textContent = this._calculateDuration();
        }
        
        if (this.lotTimeElement) {
            this.lotTimeElement.textContent = this._calculateLotTime();
        }
    }
    
    // =========================================================================
    // 긴급도 타이머
    // =========================================================================
    _startUrgencyTimer() {
        this._urgencyTimer = setInterval(() => {
            this._updateUrgencyIndicator();
        }, EquipmentCard.CONFIG.URGENCY_CHECK_INTERVAL);
    }
    
    _stopUrgencyTimer() {
        if (this._urgencyTimer) {
            clearInterval(this._urgencyTimer);
            this._urgencyTimer = null;
        }
    }
    
    // =========================================================================
    // 긴급도 표시 업데이트 (핵심 기능)
    // =========================================================================
    _updateUrgencyIndicator() {
        const durationMinutes = this._getDurationMinutes();
        
        // 기존 긴급도 클래스 제거
        this.element.classList.remove(
            EquipmentCard.CSS.URGENCY_WARNING,
            EquipmentCard.CSS.URGENCY_DANGER,
            EquipmentCard.CSS.URGENCY_CRITICAL
        );
        
        // 긴급도가 필요한 상태인지 확인 (SUDDENSTOP, STOP만 해당)
        const urgencyApplicableStatuses = ['SUDDENSTOP', 'STOP', 'REMOTE'];
        if (!urgencyApplicableStatuses.includes(this.data.status)) {
            this._currentUrgencyLevel = null;
            return;
        }
        
        // 새 긴급도 적용
        let newUrgencyLevel = null;
        
        if (durationMinutes > EquipmentCard.URGENCY_THRESHOLDS.CRITICAL) {
            // 15분 초과 → 빨간색 테두리 + 강한 Pulse
            this.element.classList.add(EquipmentCard.CSS.URGENCY_CRITICAL);
            newUrgencyLevel = 'CRITICAL';
        } else if (durationMinutes > EquipmentCard.URGENCY_THRESHOLDS.DANGER) {
            // 10분 초과 → 주황색 테두리 + Pulse
            this.element.classList.add(EquipmentCard.CSS.URGENCY_DANGER);
            newUrgencyLevel = 'DANGER';
        } else if (durationMinutes > EquipmentCard.URGENCY_THRESHOLDS.WARNING) {
            // 5분 초과 → 노란색 테두리
            this.element.classList.add(EquipmentCard.CSS.URGENCY_WARNING);
            newUrgencyLevel = 'WARNING';
        }
        
        // 긴급도 레벨 변경 시 로그
        if (this._currentUrgencyLevel !== newUrgencyLevel && newUrgencyLevel) {
            console.log(`[EquipmentCard] ⚠️ Urgency changed: ${this.data.frontendId} → ${newUrgencyLevel} (${durationMinutes.toFixed(1)}분)`);
        }
        
        this._currentUrgencyLevel = newUrgencyLevel;
    }
    
    // =========================================================================
    // 지속 시간 계산 (분)
    // =========================================================================
    _getDurationMinutes() {
        if (!this.data.statusStartTime) return 0;
        
        const startTime = new Date(this.data.statusStartTime).getTime();
        const now = Date.now();
        const durationMs = now - startTime;
        
        return durationMs / (1000 * 60); // 분 단위
    }
    
    // =========================================================================
    // 지속 시간 포맷
    // =========================================================================
    _calculateDuration() {
        if (!this.data.statusStartTime) return '--:--';
        
        const startTime = new Date(this.data.statusStartTime).getTime();
        const now = Date.now();
        const durationMs = now - startTime;
        
        return DurationCalculator.formatDuration(durationMs);
    }
    
    // =========================================================================
    // Lot 시간 계산
    // =========================================================================
    _calculateLotTime() {
        if (!this.data.lotStartTime) return '--:--';
        
        const startTime = new Date(this.data.lotStartTime).getTime();
        const now = Date.now();
        const durationMs = now - startTime;
        
        return DurationCalculator.formatDuration(durationMs);
    }
    
    // =========================================================================
    // 생산 진행률 계산
    // =========================================================================
    _calculateProductionProgress() {
        if (!this.data.productionTarget || this.data.productionTarget === 0) {
            return 0;
        }
        
        const progress = (this.data.productionCount || 0) / this.data.productionTarget * 100;
        return Math.min(progress, 100);
    }
    
    // =========================================================================
    // 생산 개수 포맷
    // =========================================================================
    _formatProductionCount() {
        const count = this.data.productionCount || 0;
        const target = this.data.productionTarget;
        
        if (target) {
            return `${count}/${target}`;
        }
        return `${count}`;
    }
    
    // =========================================================================
    // 공개 메서드
    // =========================================================================
    
    /**
     * 데이터 업데이트
     * @param {Object} newData - 새로운 데이터
     */
    update(newData) {
        if (this._isDisposed) return;
        
        const previousStatus = this.data.status;
        this.data = { ...this.data, ...newData };
        
        // 상태 변경 시
        if (previousStatus !== this.data.status) {
            this._applyStatusStyle();
            this._updateUrgencyIndicator();
            
            // 상태 인디케이터 색상 업데이트
            const indicator = this.element.querySelector(`.${EquipmentCard.CSS.STATUS_INDICATOR}`);
            if (indicator) {
                indicator.style.backgroundColor = EquipmentCard.STATUS_COLORS[this.data.status] || EquipmentCard.STATUS_COLORS.WAIT;
            }
        }
        
        // 지속 시간 업데이트
        this._updateDuration();
        
        // 생산 정보 업데이트
        if (this.productionBarFill) {
            const progress = this._calculateProductionProgress();
            this.productionBarFill.style.width = `${progress}%`;
        }
        
        if (this.productionCountElement) {
            this.productionCountElement.textContent = this._formatProductionCount();
        }
        
        // MiniTimeline 업데이트
        if (this.miniTimeline && newData.historyData) {
            this.miniTimeline.update(newData.historyData);
        }
        
        // 긴급도 재평가
        this._updateUrgencyIndicator();
        
        console.log(`[EquipmentCard] 🔄 Updated: ${this.data.frontendId}`);
    }
    
    /**
     * 상태 변경 이벤트 추가
     * @param {Object} statusEvent - 상태 변경 이벤트
     */
    addStatusEvent(statusEvent) {
        if (this.miniTimeline) {
            this.miniTimeline.addStatusEvent(statusEvent);
        }
    }
    
    /**
     * 선택 상태 설정
     * @param {boolean} selected - 선택 여부
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
    isSelected() {
        return this._isSelected;
    }
    
    /**
     * DOM 요소 반환
     * @returns {HTMLElement}
     */
    getElement() {
        return this.element;
    }
    
    /**
     * 설비 ID 반환
     * @returns {string}
     */
    getEquipmentId() {
        return this.data.equipmentId;
    }
    
    /**
     * 프론트엔드 ID 반환
     * @returns {string}
     */
    getFrontendId() {
        return this.data.frontendId;
    }
    
    /**
     * 현재 상태 반환
     * @returns {string}
     */
    getStatus() {
        return this.data.status;
    }
    
    /**
     * 현재 긴급도 레벨 반환
     * @returns {string|null}
     */
    getUrgencyLevel() {
        return this._currentUrgencyLevel;
    }
    
    /**
     * 지속 시간 (분) 반환
     * @returns {number}
     */
    getDurationMinutes() {
        return this._getDurationMinutes();
    }
    
    /**
     * 애니메이션 클래스 추가
     * @param {string} animationType - 애니메이션 타입 ('entering', 'leaving', 'animating')
     */
    setAnimating(animationType) {
        this.element.classList.remove(
            EquipmentCard.CSS.ANIMATING,
            EquipmentCard.CSS.ENTERING,
            EquipmentCard.CSS.LEAVING
        );
        
        switch (animationType) {
            case 'entering':
                this.element.classList.add(EquipmentCard.CSS.ENTERING);
                break;
            case 'leaving':
                this.element.classList.add(EquipmentCard.CSS.LEAVING);
                break;
            case 'animating':
                this.element.classList.add(EquipmentCard.CSS.ANIMATING);
                break;
        }
    }
    
    /**
     * 애니메이션 클래스 제거
     */
    clearAnimating() {
        this.element.classList.remove(
            EquipmentCard.CSS.ANIMATING,
            EquipmentCard.CSS.ENTERING,
            EquipmentCard.CSS.LEAVING
        );
    }
    
    /**
     * 포커스
     */
    focus() {
        this.element?.focus();
    }
    
    /**
     * 정리
     */
    dispose() {
        if (this._isDisposed) return;
        
        console.log(`[EquipmentCard] 🗑️ Disposing: ${this.data.frontendId}`);
        
        // 타이머 정리
        this._stopDurationTimer();
        this._stopUrgencyTimer();
        
        // 이벤트 리스너 제거
        if (this.element) {
            this.element.removeEventListener('click', this._boundHandlers.onClick);
            this.element.removeEventListener('keydown', this._boundHandlers.onKeyDown);
        }
        this._boundHandlers = {};
        
        // MiniTimeline 정리
        if (this.miniTimeline) {
            this.miniTimeline.dispose();
            this.miniTimeline = null;
        }
        
        // DOM 제거
        this.element?.remove();
        
        // 참조 해제
        this.element = null;
        this.durationElement = null;
        this.productionBarFill = null;
        this.productionCountElement = null;
        this.lotTimeElement = null;
        this.data = null;
        
        this._isDisposed = true;
    }
}