/**
 * DurationCalculator.js
 * =====================
 * 상태 지속 시간 및 대기 시간 계산 유틸리티
 * 
 * @version 1.2.0
 * @description
 * - 상태 지속 시간 계산 (현재 시간 - 상태 변경 시점)
 * - Wait 대기 시간 계산 (현재 시간 - Lot 완료 시점)
 * - Lot 진행 시간 계산
 * - 시간 포맷팅 (HH:MM:SS)
 * - 긴급도 레벨 판단
 * - 🆕 v1.2.0: ⭐ 사이트 타임존 보정 지원 (Multi-site 대응)
 * - v1.1.0: 임계값 초과 확인, 상대 시간 문자열
 * 
 * @changelog
 * - v1.2.0 (2026-01-27): ⭐ 타임존 보정 로직 추가 (DurationTimer.js 동기화)
 *   - 🆕 SITE_CONFIG 연동으로 사이트별 타임존 오프셋 적용
 *   - 🆕 DEFAULT_SITE_TIMEZONE_OFFSET 상수 추가 (기본값: 8 = 중국 UTC+8)
 *   - 🔧 calculateStatusDuration(): 타임존 보정 계산 적용
 *   - 🆕 _getTimezoneOffsetMs(): 타임존 오프셋 밀리초 계산 헬퍼
 *   - 🆕 getTimezoneInfo(): 현재 타임존 정보 반환 (디버깅용)
 *   - ⚠️ 호환성: v1.1.0의 모든 기능/메서드/필드 100% 유지
 * - v1.1.0 (2026-01-19): 가이드라인 준수 + 추가 기능 통합
 *   - 🆕 static UTIL 추가 (가이드라인 준수)
 *   - 🆕 exceedsThreshold() - 임계값 초과 확인
 *   - 🆕 getRelativeTime() - 상대 시간 문자열 ("방금 전", "5분 전" 등)
 *   - 🆕 formatDurationShort() - 간략 형식 (1h 23m, 5m 30s)
 *   - 🆕 getDuration() - 시작/종료 시간에서 밀리초 계산
 *   - ⚠️ 호환성: v1.0.0의 모든 기능/메서드/필드 100% 유지
 * - v1.0.0: 초기 구현
 *   - calculateStatusDuration(): 상태 지속 시간 계산
 *   - calculateWaitDuration(): 대기 시간 계산
 *   - calculateLotDuration(): Lot 진행 시간 계산
 *   - formatDuration(): 시간 포맷팅
 *   - getUrgencyLevel(): 긴급도 레벨 판단
 *   - getDurationMinutes(): 분 단위 변환
 * 
 * @dependencies
 * - SITE_CONFIG (optional): ../../../core/utils/Config.js
 * 
 * @exports
 * - DurationCalculator
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/utils/DurationCalculator.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-27
 */

// =============================================================================
// 🆕 v1.2.0: SITE_CONFIG Import (Optional)
// =============================================================================
// SITE_CONFIG가 없는 환경에서도 동작하도록 try-catch로 감싸기
let SITE_CONFIG = null;
try {
    // 동적 import 대신 전역 참조 시도 (번들러 환경에 따라 다름)
    if (typeof window !== 'undefined' && window.SITE_CONFIG) {
        SITE_CONFIG = window.SITE_CONFIG;
    }
} catch (e) {
    // SITE_CONFIG 없이도 동작 가능
    console.debug('[DurationCalculator] SITE_CONFIG not available, using defaults');
}

/**
 * 시간 계산 유틸리티 클래스
 * 상태 지속 시간, 대기 시간, Lot 진행 시간 등의 계산과 포맷팅을 담당
 * 
 * @description
 * ⭐ v1.2.0: 타임존 보정 지원
 * - 서버 데이터가 사이트 로컬 시간(예: 중국 UTC+8)으로 저장됨
 * - 브라우저가 다른 타임존(예: 한국 UTC+9)에서 실행될 수 있음
 * - 이로 인한 시간 차이를 자동 보정하여 정확한 Duration 계산
 */
export class DurationCalculator {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * 🆕 v1.2.0: 기본 사이트 타임존 오프셋 (시간 단위)
     * - 8 = 중국 (UTC+8, Asia/Shanghai)
     * - 9 = 한국 (UTC+9, Asia/Seoul)
     * - -5 = 미국 동부 (UTC-5, America/New_York)
     */
    static DEFAULT_SITE_TIMEZONE_OFFSET = 8;  // 중국 기본값
    
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
    
    /**
     * 🆕 v1.1.0: Utility 클래스 상수 (가이드라인 준수)
     */
    static UTIL = {
        HIDDEN: 'u-hidden',
        FLEX: 'u-flex'
    };
    
    // =========================================================================
    // Duration Calculation Methods
    // =========================================================================
    
    /**
     * 상태 지속 시간 계산 (타임존 보정 포함)
     * 상태 변경 시점부터 현재까지의 시간을 밀리초로 반환
     * 
     * @param {string|Date|number} occurredAt - 상태 변경 시점 (ISO string, Date, timestamp)
     * @param {Date} [now=new Date()] - 현재 시간 (테스트용)
     * @param {number} [siteTimezoneOffset] - 사이트 타임존 오프셋 (기본값: SITE_CONFIG 또는 8)
     * @returns {number} 지속 시간 (밀리초)
     * 
     * @description
     * 🆕 v1.2.0: 타임존 보정 로직 추가
     * 
     * 타임존 보정이 필요한 이유:
     * 1. 서버 DB에 사이트 로컬 시간(예: 중국 UTC+8)으로 저장됨
     * 2. API 응답에 시간대 정보 없이 전송됨 ("2026-01-27T10:00:00")
     * 3. 브라우저의 new Date()가 로컬 타임존(예: 한국 UTC+9)으로 해석
     * 4. 결과적으로 1시간 오차 발생
     * 
     * 보정 공식:
     * 실제 경과 시간 = (현재 - 시작) - (로컬오프셋 - 사이트오프셋) × 1시간
     * 
     * @example
     * // 중국 서버 데이터를 한국에서 볼 때
     * // status_changed_at: '2026-01-27T10:00:00' (중국 시간)
     * // 한국 현재 시간: 11:00 KST (= 10:00 CST)
     * // 실제 경과 시간: 0시간 (동일 시점)
     * // 보정 전: 1시간 (오차!)
     * // 보정 후: 0시간 (정확!)
     * 
     * const duration = DurationCalculator.calculateStatusDuration('2026-01-27T10:00:00');
     */
    static calculateStatusDuration(occurredAt, now = new Date(), siteTimezoneOffset = null) {
        if (!occurredAt) {
            console.warn('[DurationCalculator] ⚠️ occurredAt is null or undefined');
            return 0;
        }
        
        try {
            const startTime = this._parseDateTime(occurredAt);
            const currentTime = now instanceof Date ? now : new Date(now);
            
            if (!startTime) {
                console.warn('[DurationCalculator] ⚠️ Failed to parse occurredAt:', occurredAt);
                return 0;
            }
            
            // =====================================================
            // 🆕 v1.2.0: 타임존 보정 계산
            // =====================================================
            const offsetDiffMs = this._getTimezoneOffsetMs(currentTime, siteTimezoneOffset);
            
            // 보정된 경과 시간 계산
            // (현재 - 시작) - 타임존 차이
            let duration = (currentTime.getTime() - startTime.getTime()) - offsetDiffMs;
            
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
    
    /**
     * 🆕 v1.1.0: 시작/종료 시간에서 지속 시간 계산
     * 
     * @param {string|Date} startTime - 시작 시간
     * @param {string|Date} [endTime=new Date()] - 종료 시간
     * @returns {number} 지속 시간 (밀리초)
     */
    static getDuration(startTime, endTime = new Date()) {
        const start = this._parseDateTime(startTime);
        const end = this._parseDateTime(endTime);
        
        if (!start || !end) {
            return 0;
        }
        
        return Math.max(0, end.getTime() - start.getTime());
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
        
        // 밀리초 (optional)
        const milliseconds = remaining;
        
        // 패딩 함수
        const pad = (n, len = 2) => n.toString().padStart(len, '0');
        
        // 결과 조합
        let result = '';
        
        if (showDays && days > 0) {
            result = `${days}d `;
        }
        
        if (compact && !showDays) {
            // 컴팩트 모드: 앞의 00: 제거
            if (days > 0) {
                result += `${days * 24 + hours}:${pad(minutes)}:${pad(seconds)}`;
            } else if (hours > 0) {
                result += `${hours}:${pad(minutes)}:${pad(seconds)}`;
            } else {
                result += `${minutes}:${pad(seconds)}`;
            }
        } else {
            result += `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        }
        
        if (showMilliseconds) {
            result += `.${pad(milliseconds, 3)}`;
        }
        
        return result;
    }
    
    /**
     * 🆕 v1.1.0: 간략 형식 포맷팅
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @returns {string} "1h 23m", "5m 30s" 등
     */
    static formatDurationShort(durationMs) {
        if (durationMs < 0 || !isFinite(durationMs)) {
            return '0s';
        }
        
        const hours = Math.floor(durationMs / this.MS.HOUR);
        const minutes = Math.floor((durationMs % this.MS.HOUR) / this.MS.MINUTE);
        const seconds = Math.floor((durationMs % this.MS.MINUTE) / this.MS.SECOND);
        
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        } else if (minutes > 0) {
            return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }
    
    // =========================================================================
    // Duration Unit Conversion Methods
    // =========================================================================
    
    /**
     * 밀리초를 분 단위로 변환
     * 
     * @param {number} durationMs - 지속 시간 (밀리초)
     * @returns {number} 분 단위 값
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
     * @returns {number} 초 단위 값
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
     * @returns {number} 시간 단위 값
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
    
    /**
     * 🆕 v1.1.0: 특정 시간이 임계값을 초과했는지 확인
     * 
     * @param {string|Date} startTime - 시작 시간
     * @param {number} thresholdMinutes - 임계값 (분)
     * @param {Date} [now=new Date()] - 현재 시간
     * @returns {boolean} 임계값 초과 여부
     */
    static exceedsThreshold(startTime, thresholdMinutes, now = new Date()) {
        const durationMs = this.calculateStatusDuration(startTime, now);
        const minutes = this.getDurationMinutes(durationMs);
        return minutes >= thresholdMinutes;
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
    // Relative Time Methods (🆕 v1.1.0)
    // =========================================================================
    
    /**
     * 🆕 v1.1.0: 현재 시간 기준 상대 시간 문자열 반환
     * 
     * @param {string|Date} time - 대상 시간
     * @param {Date} [now=new Date()] - 현재 시간
     * @returns {string} "방금 전", "5분 전", "1시간 전" 등
     */
    static getRelativeTime(time, now = new Date()) {
        const target = this._parseDateTime(time);
        
        if (!target) return '알 수 없음';
        
        const currentTime = now instanceof Date ? now : new Date(now);
        
        // 🆕 v1.2.0: 타임존 보정 적용
        const offsetDiffMs = this._getTimezoneOffsetMs(currentTime);
        const diffMs = (currentTime.getTime() - target.getTime()) - offsetDiffMs;
        
        const diffSeconds = Math.floor(Math.max(0, diffMs) / this.MS.SECOND);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) {
            return '방금 전';
        } else if (diffMinutes < 60) {
            return `${diffMinutes}분 전`;
        } else if (diffHours < 24) {
            return `${diffHours}시간 전`;
        } else {
            return `${diffDays}일 전`;
        }
    }
    
    /**
     * 🆕 v1.1.0: 영문 상대 시간 문자열 반환
     * 
     * @param {string|Date} time - 대상 시간
     * @param {Date} [now=new Date()] - 현재 시간
     * @returns {string} "just now", "5 min ago", "1 hour ago" 등
     */
    static getRelativeTimeEn(time, now = new Date()) {
        const target = this._parseDateTime(time);
        
        if (!target) return 'unknown';
        
        const currentTime = now instanceof Date ? now : new Date(now);
        
        // 🆕 v1.2.0: 타임존 보정 적용
        const offsetDiffMs = this._getTimezoneOffsetMs(currentTime);
        const diffMs = (currentTime.getTime() - target.getTime()) - offsetDiffMs;
        
        const diffSeconds = Math.floor(Math.max(0, diffMs) / this.MS.SECOND);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) {
            return 'just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} min ago`;
        } else if (diffHours < 24) {
            return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        } else {
            return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
        }
    }
    
    // =========================================================================
    // Timezone Methods (🆕 v1.2.0)
    // =========================================================================
    
    /**
     * 🆕 v1.2.0: 현재 적용 중인 타임존 정보 반환 (디버깅용)
     * 
     * @returns {{siteOffset: number, siteTimezone: string, localOffset: number, diffHours: number}}
     * 
     * @example
     * const info = DurationCalculator.getTimezoneInfo();
     * console.log(info);
     * // {
     * //   siteOffset: 8,               // 중국 UTC+8
     * //   siteTimezone: 'Asia/Shanghai',
     * //   localOffset: 9,              // 한국 UTC+9
     * //   diffHours: 1                 // 1시간 차이
     * // }
     */
    static getTimezoneInfo() {
        const now = new Date();
        const localOffsetMinutes = now.getTimezoneOffset();
        const localOffsetHours = -localOffsetMinutes / 60;  // 부호 반전
        const siteOffset = SITE_CONFIG?.timezoneOffset ?? this.DEFAULT_SITE_TIMEZONE_OFFSET;
        
        return {
            siteOffset: siteOffset,
            siteTimezone: SITE_CONFIG?.timezone ?? 'Asia/Shanghai',
            localOffset: localOffsetHours,
            diffHours: localOffsetHours - siteOffset
        };
    }
    
    /**
     * 🆕 v1.2.0: 사이트 타임존 오프셋 설정 (런타임 변경)
     * 
     * @param {number} offset - 타임존 오프셋 (시간 단위, 예: 8 = UTC+8)
     * 
     * @example
     * // 한국 사이트로 변경
     * DurationCalculator.setSiteTimezoneOffset(9);
     */
    static setSiteTimezoneOffset(offset) {
        if (typeof offset === 'number' && offset >= -12 && offset <= 14) {
            this.DEFAULT_SITE_TIMEZONE_OFFSET = offset;
            console.log(`[DurationCalculator] ⏰ Site timezone offset set to UTC+${offset}`);
        } else {
            console.warn(`[DurationCalculator] ⚠️ Invalid timezone offset: ${offset}`);
        }
    }
    
    // =========================================================================
    // Private Helper Methods
    // =========================================================================
    
    /**
     * 🆕 v1.2.0: 타임존 오프셋 밀리초 계산
     * 
     * @private
     * @param {Date} now - 현재 시간
     * @param {number} [siteTimezoneOffset] - 사이트 타임존 오프셋 (생략 시 SITE_CONFIG 또는 기본값)
     * @returns {number} 보정할 밀리초 값
     * 
     * @description
     * 타임존 보정 로직:
     * 1. 브라우저 로컬 타임존 오프셋 계산 (예: 한국 +9)
     * 2. 사이트 타임존 오프셋 결정 (예: 중국 +8)
     * 3. 차이 계산 (예: +9 - +8 = +1시간)
     * 4. 밀리초로 변환하여 반환
     */
    static _getTimezoneOffsetMs(now, siteTimezoneOffset = null) {
        // 사이트 타임존 오프셋 결정 (시간 단위)
        // 우선순위: 파라미터 > SITE_CONFIG > 기본값(8, 중국)
        const siteOffset = siteTimezoneOffset ?? SITE_CONFIG?.timezoneOffset ?? this.DEFAULT_SITE_TIMEZONE_OFFSET;
        
        // 브라우저 로컬 타임존 오프셋 (분 단위)
        // getTimezoneOffset()은 "UTC - 로컬" 값을 반환
        // 예: 한국(UTC+9)에서는 -540분 = -9시간
        const localOffsetMinutes = now.getTimezoneOffset();
        const localOffsetHours = -localOffsetMinutes / 60;  // 부호 반전하여 시간 단위로
        // 한국: +9, 중국: +8, 미국동부: -5
        
        // 사이트와 로컬의 시간 차이 (시간 단위)
        // 예: 중국(+8) 데이터를 한국(+9)에서 볼 때
        //     offsetDiffHours = 9 - 8 = +1시간
        const offsetDiffHours = localOffsetHours - siteOffset;
        const offsetDiffMs = offsetDiffHours * this.MS.HOUR;
        
        return offsetDiffMs;
    }
    
    /**
     * 다양한 형식의 날짜/시간 입력을 Date 객체로 변환
     * 
     * @private
     * @param {string|Date|number} input - 날짜/시간 입력
     * @returns {Date} Date 객체
     */
    static _parseDateTime(input) {
        if (!input) {
            return null;
        }
        
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
                console.warn(`[DurationCalculator] ⚠️ Invalid date string: ${input}`);
                return null;
            }
            
            return parsed;
        }
        
        console.warn(`[DurationCalculator] ⚠️ Unsupported date format: ${typeof input}`);
        return null;
    }
}

// =========================================================================
// Default Export
// =========================================================================
export default DurationCalculator;

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.DurationCalculator = DurationCalculator;
}