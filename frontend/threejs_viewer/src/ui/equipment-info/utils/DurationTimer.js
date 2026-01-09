/**
 * DurationTimer.js
 * ================
 * Duration 타이머 유틸리티 클래스
 * 
 * @version 1.0.0
 * @description
 * - Lot Duration / Since Duration 실시간 업데이트
 * - 24시간 이상: "Xday HH:MM:SS" 형식
 * - 24시간 미만: "HH:MM:SS" 형식
 * - 콜백 패턴으로 DOM 독립성 확보
 * 
 * @example
 * const timer = new DurationTimer();
 * timer.start('2026-01-09T10:00:00Z', (formatted) => {
 *     document.getElementById('duration').textContent = formatted;
 * });
 * // ... later
 * timer.stop();
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/utils/DurationTimer.js
 * 작성일: 2026-01-09
 */

import { debugLog } from '../../../core/utils/Config.js';

/**
 * Duration Timer 클래스
 * - 시작 시간부터 현재까지의 경과 시간을 1초마다 업데이트
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
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    /**
     * 타이머 시작
     * @param {string|Date} baseTime - 기준 시간 (ISO 문자열 또는 Date 객체)
     * @param {Function} onUpdate - 업데이트 콜백 (formatted: string) => void
     * @returns {boolean} 시작 성공 여부
     * 
     * @example
     * timer.start('2026-01-09T10:00:00Z', (formatted) => {
     *     element.textContent = formatted;
     * });
     */
    start(baseTime, onUpdate) {
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
        
        // 즉시 첫 번째 업데이트 실행
        this._tick();
        
        // 1초마다 업데이트
        this.intervalId = setInterval(() => {
            this._tick();
        }, this.updateInterval);
        
        debugLog(`⏱️ DurationTimer started: ${baseTime}`);
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
     * Duration 포맷팅 (정적 메서드로도 사용 가능)
     * @param {string|Date} startTime - 시작 시간
     * @returns {string} 포맷된 문자열 (예: "1day 02:30:45" 또는 "02:30:45")
     */
    formatDuration(startTime) {
        return DurationTimer.format(startTime);
    }
    
    // =========================================================================
    // 정적 메서드
    // =========================================================================
    
    /**
     * Duration 포맷팅 (정적)
     * @param {string|Date} startTime - 시작 시간
     * @returns {string} 포맷된 문자열
     * 
     * @example
     * DurationTimer.format('2026-01-09T10:00:00Z');
     * // => "02:30:45" (2시간 30분 45초 경과)
     * // => "1day 02:30:45" (1일 2시간 30분 45초 경과)
     */
    static format(startTime) {
        if (!startTime) return '-';
        
        try {
            const start = startTime instanceof Date ? startTime : new Date(startTime);
            const now = new Date();
            
            // 밀리초 차이 계산
            let diffMs = now - start;
            
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
     * 경과 시간을 밀리초로 반환 (정적)
     * @param {string|Date} startTime - 시작 시간
     * @returns {number} 경과 밀리초 (음수면 0)
     */
    static getElapsedMs(startTime) {
        if (!startTime) return 0;
        
        try {
            const start = startTime instanceof Date ? startTime : new Date(startTime);
            const now = new Date();
            const diff = now - start;
            return diff < 0 ? 0 : diff;
        } catch (e) {
            return 0;
        }
    }
    
    /**
     * 경과 시간을 객체로 반환 (정적)
     * @param {string|Date} startTime - 시작 시간
     * @returns {{days: number, hours: number, minutes: number, seconds: number}}
     */
    static getElapsedParts(startTime) {
        const diffMs = DurationTimer.getElapsedMs(startTime);
        
        return {
            days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diffMs % (1000 * 60)) / 1000)
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
        
        const formatted = DurationTimer.format(this.baseTime);
        
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