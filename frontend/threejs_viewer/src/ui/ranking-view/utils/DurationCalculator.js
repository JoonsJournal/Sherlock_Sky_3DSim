/**
 * DurationCalculator.js
 * =====================
 * 상태 지속 시간 및 대기 시간 계산 유틸리티
 * 
 * @version 1.0.0
 * @description
 * - 상태 지속 시간 계산 (현재 시간 - 상태 변경 시점)
 * - Wait 대기 시간 계산 (현재 시간 - Lot 완료 시점)
 * - Lot 진행 시간 계산
 * - 시간 포맷팅 (HH:MM:SS)
 * - 긴급도 레벨 판단
 * 
 * @changelog
 * - v1.0.0: 초기 구현
 *   - calculateStatusDuration(): 상태 지속 시간 계산
 *   - calculateWaitDuration(): 대기 시간 계산
 *   - calculateLotDuration(): Lot 진행 시간 계산
 *   - formatDuration(): 시간 포맷팅
 *   - getUrgencyLevel(): 긴급도 레벨 판단
 *   - getDurationMinutes(): 분 단위 변환
 * 
 * @dependencies
 * - 없음 (독립 유틸리티)
 * 
 * @exports
 * - DurationCalculator
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/utils/DurationCalculator.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

/**
 * 시간 계산 유틸리티 클래스
 * 상태 지속 시간, 대기 시간, Lot 진행 시간 등의 계산과 포맷팅을 담당
 */
export class DurationCalculator {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * 긴급도 레벨 임계값 (분 단위)
     */
    static URGENCY_THRESHOLDS = {
        WARNING: 5,      // 5분 초과 → 경고
        DANGER: 10,      // 10분 초과 → 위험
        CRITICAL: 15     // 15분 초과 → 긴급
    };
    
    /**
     * 긴급도 레벨 enum
     */
    static URGENCY_LEVELS = {
        NORMAL: 'normal',
        WARNING: 'warning',
        DANGER: 'danger',
        CRITICAL: 'critical'
    };
    
    /**
     * 밀리초 상수
     */
    static MS = {
        SECOND: 1000,
        MINUTE: 60 * 1000,
        HOUR: 60 * 60 * 1000,
        DAY: 24 * 60 * 60 * 1000
    };
    
    // =========================================================================
    // Duration Calculation Methods
    // =========================================================================
    
    /**
     * 상태 지속 시간 계산
     * 상태 변경 시점부터 현재까지의 시간을 밀리초로 반환
     * 
     * @param {string|Date|number} occurredAt - 상태 변경 시점 (ISO string, Date, timestamp)
     * @param {Date} [now=new Date()] - 현재 시간 (테스트용)
     * @returns {number} 지속 시간 (밀리초)
     * 
     * @example
     * // ISO 문자열 사용
     * const duration = DurationCalculator.calculateStatusDuration('2026-01-17T10:00:00Z');
     * 
     * // Date 객체 사용
     * const duration = DurationCalculator.calculateStatusDuration(new Date());
     */
    static calculateStatusDuration(occurredAt, now = new Date()) {
        if (!occurredAt) {
            console.warn('[DurationCalculator] ⚠️ occurredAt is null or undefined');
            return 0;
        }
        
        try {
            const startTime = this._parseDateTime(occurredAt);
            const currentTime = now instanceof Date ? now : new Date(now);
            
            const duration = currentTime.getTime() - startTime.getTime();
            
            // 음수 방지 (미래 시간이 들어온 경우)
            return Math.max(0, duration);
        } catch (error) {
            console.error('[DurationCalculator] ❌ Error calculating duration:', error);
            return 0;
        }
    }
    
    /**
     * Wait 대기 시간 계산
     * 이전 Lot 완료 시점부터 현재까지의 시간
     * 
     * @param {Object} lastLotInfo - 마지막 Lot 정보
     * @param {string|Date} lastLotInfo.occurredAtUtc - Lot 완료 시점
     * @param {number} lastLotInfo.isStart - 시작 여부 (0=종료)
     * @param {Date} [now=new Date()] - 현재 시간
     * @returns {number} 대기 시간 (밀리초)
     * 
     * @example
     * const waitTime = DurationCalculator.calculateWaitDuration({
     *     occurredAtUtc: '2026-01-17T09:30:00Z',
     *     isStart: 0  // Lot 종료
     * });
     */
    static calculateWaitDuration(lastLotInfo, now = new Date()) {
        if (!lastLotInfo) {
            console.warn('[DurationCalculator] ⚠️ lastLotInfo is null');
            return 0;
        }
        
        // isStart가 0인 경우만 Lot 완료로 간주
        if (lastLotInfo.isStart !== 0) {
            console.warn('[DurationCalculator] ⚠️ Last lot is not completed (isStart !== 0)');
            return 0;
        }
        
        const completedAt = lastLotInfo.occurredAtUtc || lastLotInfo.OccurredAtUtc;
        
        if (!completedAt) {
            console.warn('[DurationCalculator] ⚠️ Lot completion time not found');
            return 0;
        }
        
        return this.calculateStatusDuration(completedAt, now);
    }
    
    /**
     * Lot 진행 시간 계산
     * Lot 시작 시점부터 현재까지의 시간
     * 
     * @param {Object} lotInfo - Lot 정보
     * @param {string|Date} lotInfo.startedAtUtc - Lot 시작 시점
     * @param {number} lotInfo.isStart - 시작 여부 (1=시작)
     * @param {Date} [now=new Date()] - 현재 시간
     * @returns {number} 진행 시간 (밀리초)
     */
    static calculateLotDuration(lotInfo, now = new Date()) {
        if (!lotInfo) {
            return 0;
        }
        
        // isStart가 1인 경우만 진행 중인 Lot
        if (lotInfo.isStart !== 1) {
            return 0;
        }
        
        const startedAt = lotInfo.startedAtUtc || lotInfo.occurredAtUtc || 
                          lotInfo.StartedAtUtc || lotInfo.OccurredAtUtc;
        
        if (!startedAt) {
            return 0;
        }
        
        return this.calculateStatusDuration(startedAt, now);
    }
    
    // =========================================================================
    // Formatting Methods
    // =========================================================================
    
    /**
     * 밀리초를 HH:MM:SS 형식으로 포맷팅
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @param {Object} [options] - 포맷 옵션
     * @param {boolean} [options.showDays=false] - 일 단위 표시 여부
     * @param {boolean} [options.showMilliseconds=false] - 밀리초 표시 여부
     * @param {boolean} [options.compact=false] - 앞의 00: 제거 여부
     * @returns {string} 포맷된 시간 문자열
     * 
     * @example
     * DurationCalculator.formatDuration(3661000);  // "01:01:01"
     * DurationCalculator.formatDuration(3661000, { compact: true });  // "1:01:01"
     * DurationCalculator.formatDuration(90061000, { showDays: true }); // "1d 01:01:01"
     */
    static formatDuration(durationMs, options = {}) {
        const {
            showDays = false,
            showMilliseconds = false,
            compact = false
        } = options;
        
        if (durationMs < 0 || !isFinite(durationMs)) {
            return '00:00:00';
        }
        
        let remaining = Math.abs(durationMs);
        
        // 일 계산
        const days = Math.floor(remaining / this.MS.DAY);
        remaining %= this.MS.DAY;
        
        // 시간 계산
        const hours = Math.floor(remaining / this.MS.HOUR);
        remaining %= this.MS.HOUR;
        
        // 분 계산
        const minutes = Math.floor(remaining / this.MS.MINUTE);
        remaining %= this.MS.MINUTE;
        
        // 초 계산
        const seconds = Math.floor(remaining / this.MS.SECOND);
        remaining %= this.MS.SECOND;
        
        // 밀리초
        const milliseconds = remaining;
        
        // 포맷 조합
        let parts = [];
        
        if (showDays && days > 0) {
            parts.push(`${days}d`);
        }
        
        // 시간:분:초
        if (compact) {
            // Compact 모드: 앞의 0 제거
            if (days > 0 || hours > 0) {
                parts.push(hours.toString());
            }
            parts.push(
                (parts.length > 0 ? minutes.toString().padStart(2, '0') : minutes.toString()),
                seconds.toString().padStart(2, '0')
            );
        } else {
            // 표준 모드: HH:MM:SS
            parts.push(
                hours.toString().padStart(2, '0'),
                minutes.toString().padStart(2, '0'),
                seconds.toString().padStart(2, '0')
            );
        }
        
        let result = parts.join(':');
        
        if (showMilliseconds) {
            result += `.${milliseconds.toString().padStart(3, '0')}`;
        }
        
        return result;
    }
    
    /**
     * 밀리초를 사람이 읽기 쉬운 형식으로 포맷팅
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @returns {string} 예: "5분 32초", "1시간 23분", "2일 3시간"
     */
    static formatDurationHuman(durationMs) {
        if (durationMs < 0 || !isFinite(durationMs)) {
            return '0초';
        }
        
        const days = Math.floor(durationMs / this.MS.DAY);
        const hours = Math.floor((durationMs % this.MS.DAY) / this.MS.HOUR);
        const minutes = Math.floor((durationMs % this.MS.HOUR) / this.MS.MINUTE);
        const seconds = Math.floor((durationMs % this.MS.MINUTE) / this.MS.SECOND);
        
        if (days > 0) {
            return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
        }
        
        if (hours > 0) {
            return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
        }
        
        if (minutes > 0) {
            return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
        }
        
        return `${seconds}초`;
    }
    
    // =========================================================================
    // Conversion Methods
    // =========================================================================
    
    /**
     * 밀리초를 분 단위로 변환
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @returns {number} 분 (소수점 포함)
     */
    static getDurationMinutes(durationMs) {
        if (!isFinite(durationMs) || durationMs < 0) {
            return 0;
        }
        return durationMs / this.MS.MINUTE;
    }
    
    /**
     * 밀리초를 초 단위로 변환
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @returns {number} 초 (소수점 포함)
     */
    static getDurationSeconds(durationMs) {
        if (!isFinite(durationMs) || durationMs < 0) {
            return 0;
        }
        return durationMs / this.MS.SECOND;
    }
    
    /**
     * 밀리초를 시간 단위로 변환
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @returns {number} 시간 (소수점 포함)
     */
    static getDurationHours(durationMs) {
        if (!isFinite(durationMs) || durationMs < 0) {
            return 0;
        }
        return durationMs / this.MS.HOUR;
    }
    
    // =========================================================================
    // Urgency Level Methods
    // =========================================================================
    
    /**
     * 지속 시간에 따른 긴급도 레벨 판단
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @param {Object} [customThresholds] - 커스텀 임계값 (분 단위)
     * @returns {string} 긴급도 레벨 ('normal'|'warning'|'danger'|'critical')
     * 
     * @example
     * // 기본 임계값 사용
     * DurationCalculator.getUrgencyLevel(6 * 60 * 1000);  // 'warning' (6분)
     * DurationCalculator.getUrgencyLevel(12 * 60 * 1000); // 'danger' (12분)
     * DurationCalculator.getUrgencyLevel(20 * 60 * 1000); // 'critical' (20분)
     * 
     * // 커스텀 임계값 사용
     * DurationCalculator.getUrgencyLevel(8 * 60 * 1000, { WARNING: 3, DANGER: 7 });
     */
    static getUrgencyLevel(durationMs, customThresholds = null) {
        const thresholds = customThresholds || this.URGENCY_THRESHOLDS;
        const minutes = this.getDurationMinutes(durationMs);
        
        if (minutes > thresholds.CRITICAL) {
            return this.URGENCY_LEVELS.CRITICAL;
        }
        
        if (minutes > thresholds.DANGER) {
            return this.URGENCY_LEVELS.DANGER;
        }
        
        if (minutes > thresholds.WARNING) {
            return this.URGENCY_LEVELS.WARNING;
        }
        
        return this.URGENCY_LEVELS.NORMAL;
    }
    
    /**
     * 긴급도 레벨이 특정 레벨 이상인지 확인
     * 
     * @param {string} level - 현재 긴급도 레벨
     * @param {string} threshold - 비교 대상 레벨
     * @returns {boolean} 현재 레벨이 threshold 이상인지
     */
    static isUrgencyAtLeast(level, threshold) {
        const levels = [
            this.URGENCY_LEVELS.NORMAL,
            this.URGENCY_LEVELS.WARNING,
            this.URGENCY_LEVELS.DANGER,
            this.URGENCY_LEVELS.CRITICAL
        ];
        
        const currentIndex = levels.indexOf(level);
        const thresholdIndex = levels.indexOf(threshold);
        
        return currentIndex >= thresholdIndex;
    }
    
    // =========================================================================
    // Statistics Methods
    // =========================================================================
    
    /**
     * 여러 지속 시간의 평균 계산
     * 
     * @param {number[]} durations - 지속 시간 배열 (밀리초)
     * @returns {number} 평균 지속 시간 (밀리초)
     */
    static calculateAverage(durations) {
        if (!Array.isArray(durations) || durations.length === 0) {
            return 0;
        }
        
        const validDurations = durations.filter(d => isFinite(d) && d >= 0);
        
        if (validDurations.length === 0) {
            return 0;
        }
        
        const sum = validDurations.reduce((acc, d) => acc + d, 0);
        return sum / validDurations.length;
    }
    
    /**
     * 여러 지속 시간 중 최대값 반환
     * 
     * @param {number[]} durations - 지속 시간 배열 (밀리초)
     * @returns {number} 최대 지속 시간 (밀리초)
     */
    static calculateMax(durations) {
        if (!Array.isArray(durations) || durations.length === 0) {
            return 0;
        }
        
        const validDurations = durations.filter(d => isFinite(d) && d >= 0);
        
        if (validDurations.length === 0) {
            return 0;
        }
        
        return Math.max(...validDurations);
    }
    
    /**
     * 여러 지속 시간 중 최소값 반환
     * 
     * @param {number[]} durations - 지속 시간 배열 (밀리초)
     * @returns {number} 최소 지속 시간 (밀리초)
     */
    static calculateMin(durations) {
        if (!Array.isArray(durations) || durations.length === 0) {
            return 0;
        }
        
        const validDurations = durations.filter(d => isFinite(d) && d >= 0);
        
        if (validDurations.length === 0) {
            return 0;
        }
        
        return Math.min(...validDurations);
    }
    
    // =========================================================================
    // Private Helper Methods
    // =========================================================================
    
    /**
     * 다양한 형식의 날짜/시간 입력을 Date 객체로 변환
     * 
     * @private
     * @param {string|Date|number} input - 날짜/시간 입력
     * @returns {Date} Date 객체
     */
    static _parseDateTime(input) {
        if (input instanceof Date) {
            return input;
        }
        
        if (typeof input === 'number') {
            return new Date(input);
        }
        
        if (typeof input === 'string') {
            // ISO 8601 형식 지원
            const parsed = new Date(input);
            
            if (isNaN(parsed.getTime())) {
                throw new Error(`Invalid date string: ${input}`);
            }
            
            return parsed;
        }
        
        throw new Error(`Unsupported date format: ${typeof input}`);
    }
}

// =========================================================================
// Default Export
// =========================================================================
export default DurationCalculator;