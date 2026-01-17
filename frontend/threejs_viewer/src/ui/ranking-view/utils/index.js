/**
 * ranking-view/utils/index.js
 * ============================
 * Ranking View Utilities Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - 유틸리티 함수 통합 Export
 * - Phase 3~4에서 실제 유틸리티 추가 예정
 * 
 * @changelog
 * - v1.0.0: Phase 1 placeholder
 *   - ⚠️ 호환성: 신규 모듈
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/utils/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

// =============================================
// Phase 3에서 추가 예정
// =============================================

// export { LaneSorter } from './LaneSorter.js';
// export { DurationCalculator } from './DurationCalculator.js';

// =============================================
// Phase 4에서 추가 예정
// =============================================

// export { PositionCalculator } from './PositionCalculator.js';
// export { BatchAnimator } from './BatchAnimator.js';

// Placeholder export (Phase 1)
export const UTILS_VERSION = '1.0.0';
export const UTILS_STATUS = 'Phase 3 준비중';

// =============================================
// Helper Functions (Phase 1부터 사용 가능)
// =============================================

/**
 * 시간을 MM:SS 형식으로 포맷
 * @param {number} seconds - 초 단위 시간
 * @returns {string}
 */
export function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 시간을 HH:MM:SS 형식으로 포맷
 * @param {number} seconds - 초 단위 시간
 * @returns {string}
 */
export function formatDurationLong(seconds) {
    if (!seconds || seconds < 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * UTC 시간과 현재 시간의 차이 계산 (초 단위)
 * @param {string} utcTimeString - ISO 8601 형식 UTC 시간
 * @returns {number}
 */
export function calculateDurationFromUtc(utcTimeString) {
    if (!utcTimeString) return 0;
    
    const startTime = new Date(utcTimeString).getTime();
    const now = Date.now();
    
    return Math.floor((now - startTime) / 1000);
}

/**
 * 숫자를 천 단위 구분자 포함 문자열로 변환
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('ko-KR');
}