/**
 * DurationTimer.js
 * ================
 * Duration 타이머 유틸리티 클래스 (타임존 지원)
 * 
 * @version 1.1.0
 * @description
 * - Lot Duration / Since Duration 실시간 업데이트
 * - 24시간 이상: "Xday HH:MM:SS" 형식
 * - 24시간 미만: "HH:MM:SS" 형식
 * - 콜백 패턴으로 DOM 독립성 확보
 * - ⭐ 사이트 타임존 보정 지원 (Multi-site 대응)
 * 
 * @changelog
 * - v1.1.0 (2026-01-15): 타임존 보정 로직 추가 (SITE_CONFIG 연동)
 * - v1.0.0: 초기 버전
 * 
 * @example
 * const timer = new DurationTimer();
 * timer.start('2026-01-09T10:00:00', (formatted) => {
 *     document.getElementById('duration').textContent = formatted;
 * });
 * // ... later
 * timer.stop();
 * 
 * // 정적 메서드 사용 (타임존 보정 포함)
 * DurationTimer.format('2026-01-09T10:00:00');  // SITE_CONFIG 사용
 * DurationTimer.format('2026-01-09T10:00:00', 9);  // 수동 오프셋 지정
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/utils/DurationTimer.js
 * 작성일: 2026-01-09
 * 수정일: 2026-01-15 (타임존 지원)
 */

import { debugLog } from '../../../core/utils/Config.js';
import { SITE_CONFIG } from '../../../core/utils/Config.js';

/**
 * Duration Timer 클래스
 * - 시작 시간부터 현재까지의 경과 시간을 1초마다 업데이트
 * - 사이트 타임존과 로컬 타임존 차이를 보정
 */
export class DurationTimer {
    constructor() {
        /**
         * setInterval ID
         * @type {number|null}
         */
        this.intervalId = null;
        
        /**
         * 기준 시간 (ISO 문자열 또는 Date)
         * @type {string|Date|null}
         */
        this.baseTime = null;
        
        /**
         * 업데이트 콜백 함수
         * @type {Function|null}
         */
        this.onUpdate = null;
        
        /**
         * 업데이트 간격 (ms)
         * @type {number}
         */
        this.updateInterval = 1000;
        
        /**
         * 사용할 타임존 오프셋 (null이면 SITE_CONFIG 사용)
         * @type {number|null}
         */
        this.siteTimezoneOffset = null;
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    /**
     * 타이머 시작
     * @param {string|Date} baseTime - 기준 시간 (ISO 문자열 또는 Date 객체)
     * @param {Function} onUpdate - 업데이트 콜백 (formatted: string) => void
     * @param {number} [siteTimezoneOffset] - 사이트 타임존 오프셋 (생략 시 SITE_CONFIG 사용)
     * @returns {boolean} 시작 성공 여부
     * 
     * @example
     * timer.start('2026-01-09T10:00:00', (formatted) => {
     *     element.textContent = formatted;
     * });
     * 
     * // 특정 타임존 오프셋 지정
     * timer.start('2026-01-09T10:00:00', callback, 9);  // UTC+9
     */
    start(baseTime, onUpdate, siteTimezoneOffset = null) {
        // 기존 타이머 정리
        this.stop();
        
        if (!baseTime) {
            debugLog('⚠️ DurationTimer: baseTime is required');
            return false;
        }
        
        if (typeof onUpdate !== 'function') {
            debugLog('⚠️ DurationTimer: onUpdate callback is required');
            return false;
        }
        
        this.baseTime = baseTime;
        this.onUpdate = onUpdate;
        this.siteTimezoneOffset = siteTimezoneOffset;
        
        // 즉시 첫 번째 업데이트 실행
        this._tick();
        
        // 1초마다 업데이트
        this.intervalId = setInterval(() => {
            this._tick();
        }, this.updateInterval);
        
        const effectiveOffset = siteTimezoneOffset ?? SITE_CONFIG?.timezoneOffset ?? 8;
        debugLog(`⏱️ DurationTimer started: ${baseTime} (Site UTC+${effectiveOffset})`);
        return true;
    }
    
    /**
     * 타이머 정지
     */
    stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            debugLog('⏱️ DurationTimer stopped');
        }
        
        this.baseTime = null;
        this.onUpdate = null;
        this.siteTimezoneOffset = null;
    }
    
    /**
     * 타이머 활성 상태 확인
     * @returns {boolean}
     */
    isRunning() {
        return this.intervalId !== null;
    }
    
    /**
     * 현재 기준 시간 반환
     * @returns {string|Date|null}
     */
    getBaseTime() {
        return this.baseTime;
    }
    
    /**
     * Duration 포맷팅 (인스턴스 메서드)
     * @param {string|Date} startTime - 시작 시간
     * @returns {string} 포맷된 문자열 (예: "1day 02:30:45" 또는 "02:30:45")
     */
    formatDuration(startTime) {
        return DurationTimer.format(startTime, this.siteTimezoneOffset);
    }
    
    // =========================================================================
    // 정적 메서드
    // =========================================================================
    
    /**
     * Duration 포맷팅 (정적, 타임존 보정 포함)
     * 
     * @param {string|Date} startTime - 시작 시간 (사이트 로컬 시간)
     * @param {number} [siteTimezoneOffset] - 사이트 타임존 오프셋 (기본값: SITE_CONFIG.timezoneOffset)
     * @returns {string} 포맷된 문자열
     * 
     * @description
     * 타임존 보정 로직:
     * 1. 서버 데이터가 사이트 로컬 시간(예: 중국 UTC+8)으로 저장됨
     * 2. 브라우저가 다른 타임존(예: 한국 UTC+9)에서 실행됨
     * 3. new Date()로 파싱 시 브라우저가 로컬 시간으로 해석
     * 4. 이로 인해 시간 차이가 발생 (한국에서 중국 데이터 볼 때 +1시간 오차)
     * 5. 보정: 실제 경과 시간 = (now - start) - (로컬오프셋 - 사이트오프셋)
     * 
     * @example
     * // 중국 서버 데이터를 한국에서 볼 때
     * // lot_start_time: '2026-01-15T10:00:00' (중국 시간)
     * // 한국 현재 시간: 11:00 KST (= 10:00 CST)
     * // 실제 경과 시간: 1시간
     * // 보정 전: 2시간 (1시간 오차)
     * // 보정 후: 1시간 (정확)
     * 
     * DurationTimer.format('2026-01-15T10:00:00');  // "01:00:00"
     * DurationTimer.format('2026-01-15T10:00:00', 8);  // 중국 데이터 명시
     * DurationTimer.format('2026-01-15T10:00:00', 9);  // 한국 데이터
     */
    static format(startTime, siteTimezoneOffset = null) {
        if (!startTime) return '-';
        
        try {
            // 사이트 타임존 오프셋 결정 (시간 단위)
            // 우선순위: 파라미터 > SITE_CONFIG > 기본값(8, 중국)
            const siteOffset = siteTimezoneOffset ?? SITE_CONFIG?.timezoneOffset ?? 8;
            
            // 시작 시간 파싱
            const start = startTime instanceof Date ? startTime : new Date(startTime);
            
            // 유효하지 않은 날짜 체크
            if (isNaN(start.getTime())) {
                console.warn('DurationTimer.format: Invalid date:', startTime);
                return '-';
            }
            
            // 현재 시간
            const now = new Date();
            
            // ========================================
            // 타임존 보정 계산
            // ========================================
            // 
            // 브라우저 로컬 타임존 오프셋 (분 단위)
            // getTimezoneOffset()은 "UTC - 로컬" 값을 반환
            // 예: 한국(UTC+9)에서는 -540분 = -9시간
            // 
            const localOffsetMinutes = now.getTimezoneOffset();
            const localOffsetHours = -localOffsetMinutes / 60;  // 부호 반전하여 시간 단위로
            // 한국: +9, 중국: +8, 미국동부: -5
            
            // 사이트와 로컬의 시간 차이 (시간 단위)
            // 예: 중국(+8) 데이터를 한국(+9)에서 볼 때
            //     offsetDiffHours = 9 - 8 = +1시간
            // 
            // 이 값만큼 보정해야 실제 경과 시간이 됨
            const offsetDiffHours = localOffsetHours - siteOffset;
            const offsetDiffMs = offsetDiffHours * 60 * 60 * 1000;
            
            // 보정된 경과 시간 계산
            // 
            // start가 사이트 로컬 시간이라고 가정하면:
            // - 브라우저가 start를 파싱할 때 브라우저 로컬 타임존으로 해석
            // - 이로 인해 (now - start)에는 타임존 차이만큼 오차가 발생
            // - 실제 경과 시간 = (now - start) - offsetDiff
            //
            let diffMs = (now - start) - offsetDiffMs;
            
            // 음수면 (미래 시간이면) 0으로
            if (diffMs < 0) diffMs = 0;
            
            // 일, 시, 분, 초 계산
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            // 패딩 함수
            const pad = (n) => n.toString().padStart(2, '0');
            
            // 24시간 이상이면 "Xday HH:MM:SS" 형식
            if (days > 0) {
                return `${days}day ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            }
            
            // 24시간 미만: "HH:MM:SS" 형식
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            
        } catch (e) {
            console.error('DurationTimer.format error:', e);
            return '-';
        }
    }
    
    /**
     * 경과 시간을 밀리초로 반환 (정적, 타임존 보정 포함)
     * @param {string|Date} startTime - 시작 시간
     * @param {number} [siteTimezoneOffset] - 사이트 타임존 오프셋 (기본값: SITE_CONFIG.timezoneOffset)
     * @returns {number} 경과 밀리초 (음수면 0)
     */
    static getElapsedMs(startTime, siteTimezoneOffset = null) {
        if (!startTime) return 0;
        
        try {
            const siteOffset = siteTimezoneOffset ?? SITE_CONFIG?.timezoneOffset ?? 8;
            const start = startTime instanceof Date ? startTime : new Date(startTime);
            
            if (isNaN(start.getTime())) return 0;
            
            const now = new Date();
            
            // 타임존 보정
            const localOffsetMinutes = now.getTimezoneOffset();
            const localOffsetHours = -localOffsetMinutes / 60;
            const offsetDiffMs = (localOffsetHours - siteOffset) * 60 * 60 * 1000;
            
            const diff = (now - start) - offsetDiffMs;
            return diff < 0 ? 0 : diff;
        } catch (e) {
            console.error('DurationTimer.getElapsedMs error:', e);
            return 0;
        }
    }
    
    /**
     * 경과 시간을 객체로 반환 (정적, 타임존 보정 포함)
     * @param {string|Date} startTime - 시작 시간
     * @param {number} [siteTimezoneOffset] - 사이트 타임존 오프셋 (기본값: SITE_CONFIG.timezoneOffset)
     * @returns {{days: number, hours: number, minutes: number, seconds: number}}
     */
    static getElapsedParts(startTime, siteTimezoneOffset = null) {
        const diffMs = DurationTimer.getElapsedMs(startTime, siteTimezoneOffset);
        
        return {
            days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diffMs % (1000 * 60)) / 1000)
        };
    }
    
    /**
     * 현재 적용 중인 타임존 정보 반환 (디버깅용)
     * @returns {{siteOffset: number, localOffset: number, diffHours: number}}
     */
    static getTimezoneInfo() {
        const now = new Date();
        const localOffsetMinutes = now.getTimezoneOffset();
        const localOffsetHours = -localOffsetMinutes / 60;
        const siteOffset = SITE_CONFIG?.timezoneOffset ?? 8;
        
        return {
            siteOffset: siteOffset,
            siteTimezone: SITE_CONFIG?.timezone ?? 'Asia/Shanghai',
            localOffset: localOffsetHours,
            diffHours: localOffsetHours - siteOffset
        };
    }
    
    // =========================================================================
    // 내부 메서드
    // =========================================================================
    
    /**
     * 타이머 틱 (1초마다 호출)
     * @private
     */
    _tick() {
        if (!this.baseTime || !this.onUpdate) return;
        
        const formatted = DurationTimer.format(this.baseTime, this.siteTimezoneOffset);
        
        try {
            this.onUpdate(formatted);
        } catch (e) {
            console.error('DurationTimer onUpdate error:', e);
        }
    }
    
    // =========================================================================
    // 정리
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.stop();
    }
}

// 기본 내보내기
export default DurationTimer;