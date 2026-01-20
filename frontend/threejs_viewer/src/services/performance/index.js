/**
 * Performance Monitoring Module Index
 * ====================================
 * 성능 모니터링 관련 모듈 통합 export
 * 
 * @version 1.0.0
 * @description
 * - PerformanceMonitor: 렌더링 성능 모니터링 (FPS, Memory, Draw Calls)
 * - NetworkStatsMonitor: 네트워크 통계 모니터링 (Latency, Messages, Cache Hit Rate)
 * 
 * @example
 * // 개별 import
 * import { performanceMonitor, PerformanceMonitor } from './services/performance/PerformanceMonitor.js';
 * import { networkStatsMonitor, NetworkStatsMonitor } from './services/performance/NetworkStatsMonitor.js';
 * 
 * // 통합 import
 * import { 
 *     performanceMonitor, 
 *     networkStatsMonitor,
 *     PerformanceMonitor,
 *     NetworkStatsMonitor 
 * } from './services/performance/index.js';
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/performance/index.js
 * 작성일: 2026-01-21
 * 수정일: 2026-01-21
 */

// =========================================================================
// Classes Export
// =========================================================================

export { PerformanceMonitor } from './PerformanceMonitor.js';
export { NetworkStatsMonitor } from './NetworkStatsMonitor.js';

// =========================================================================
// Singleton Instances Export
// =========================================================================

export { performanceMonitor } from './PerformanceMonitor.js';
export { networkStatsMonitor } from './NetworkStatsMonitor.js';

// =========================================================================
// Convenience - Combined Stats
// =========================================================================

/**
 * 렌더링 + 네트워크 통합 성능 지표 반환
 * 
 * @returns {Object} 통합 성능 지표
 */
export function getCombinedStats() {
    const { performanceMonitor: perfMon } = require('./PerformanceMonitor.js');
    const { networkStatsMonitor: netMon } = require('./NetworkStatsMonitor.js');
    
    return {
        // 렌더링 지표
        fps: perfMon.getFPS(),
        memory: perfMon.getMemory(),
        drawCalls: perfMon.getDrawCalls(),
        performanceGrade: perfMon.getPerformanceGrade(),
        
        // 네트워크 지표
        latency: netMon.getLatency(),
        cacheHitRate: netMon.getCacheHitRate(),
        deltaCount: netMon.getDeltaCount(),
        networkGrade: netMon.getNetworkGrade(),
        connected: netMon.isConnected(),
        
        // 종합 등급
        overallGrade: _calculateOverallGrade(
            perfMon.getPerformanceGrade(),
            netMon.getNetworkGrade()
        ),
        
        timestamp: Date.now()
    };
}

/**
 * 종합 등급 계산 (내부용)
 * @private
 */
function _calculateOverallGrade(perfGrade, netGrade) {
    const grades = { good: 0, warning: 1, critical: 2, disconnected: 3 };
    const perfScore = grades[perfGrade] || 0;
    const netScore = grades[netGrade] || 0;
    
    const maxScore = Math.max(perfScore, netScore);
    
    const reverseGrades = ['good', 'warning', 'critical', 'disconnected'];
    return reverseGrades[maxScore];
}