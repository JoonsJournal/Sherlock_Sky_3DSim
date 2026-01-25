/**
 * MonitoringEventEmitter.js
 * =========================
 * 모니터링 서비스 이벤트 발행 모듈
 * 
 * @version 1.0.0
 * @changelog
 * - v1.0.0: MonitoringService v5.1.0에서 분리 (2026-01-25)
 *           - ⚠️ 호환성: 기존 API 100% 유지
 * 
 * @exports MonitoringEventEmitter, MonitoringServiceEvents
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/MonitoringEventEmitter.js
 */

import { debugLog } from '../../core/utils/Config.js';

/** MonitoringService 이벤트 타입 */
export const MonitoringServiceEvents = Object.freeze({
    START_BEGIN: 'monitoring:start-begin',
    START_COMPLETE: 'monitoring:start-complete',
    START_ERROR: 'monitoring:start-error',
    STOP_BEGIN: 'monitoring:stop-begin',
    STOP_COMPLETE: 'monitoring:stop-complete',
    RESTART_BEGIN: 'monitoring:restart-begin',
    RESTART_COMPLETE: 'monitoring:restart-complete',
    STATUS_UPDATE: 'monitoring:status-update',
    STATS_UPDATE: 'monitoring:stats-update',
    UDS_INITIALIZED: 'monitoring:uds-initialized',
    UDS_FALLBACK: 'monitoring:uds-fallback'
});

/**
 * 모니터링 이벤트 발행 클래스
 */
export class MonitoringEventEmitter {
    constructor() {
        this._context = null;
    }
    
    setContext(context) { this._context = context; }
    getEventBus() { return this._context?.eventBus || null; }
    
    emit(eventName, data = {}) {
        const eventBus = this.getEventBus();
        if (!eventBus) return;
        eventBus.emit(eventName, { ...data, source: 'MonitoringService', timestamp: new Date().toISOString() });
    }
    
    // 시작/중지/재시작 이벤트
    emitStartBegin(data) { this.emit(MonitoringServiceEvents.START_BEGIN, data); }
    emitStartComplete(data) { this.emit(MonitoringServiceEvents.START_COMPLETE, data); }
    emitStartError(data) { this.emit(MonitoringServiceEvents.START_ERROR, data); }
    emitStopBegin(data) { this.emit(MonitoringServiceEvents.STOP_BEGIN, data); }
    emitStopComplete(data) { this.emit(MonitoringServiceEvents.STOP_COMPLETE, data); }
    emitRestartBegin(data) { this.emit(MonitoringServiceEvents.RESTART_BEGIN, data); }
    emitRestartComplete(data) { this.emit(MonitoringServiceEvents.RESTART_COMPLETE, data); }
    emitStatusUpdate(data) { this.emit(MonitoringServiceEvents.STATUS_UPDATE, data); }
    emitUDSInitialized(data) { this.emit(MonitoringServiceEvents.UDS_INITIALIZED, data); }
    emitUDSFallback(data) { this.emit(MonitoringServiceEvents.UDS_FALLBACK, data); }
    
    /** StatusBar용 통계 업데이트 이벤트 발행 */
    emitStatsUpdate() {
        const eventBus = this.getEventBus();
        const ctx = this._context;
        if (!eventBus || !ctx) return;
        
        let statusCounts;
        const udsInit = ctx.udsIntegration?.isInitialized?.() || ctx._udsInitialized || false;
        
        if (udsInit) {
            const udsStats = ctx.udsIntegration?.getStatusStats?.() || ctx.getUnifiedDataStore?.()?.getStatusStats?.() || {};
            statusCounts = {
                run: udsStats.RUN || 0,
                idle: udsStats.IDLE || 0,
                stop: udsStats.STOP || 0,
                suddenstop: udsStats.SUDDENSTOP || 0,
                disconnected: udsStats.DISCONNECTED || 0
            };
        } else {
            statusCounts = this._getSignalTowerStats();
        }
        
        const stats = ctx.currentStats || {};
        eventBus.emit(MonitoringServiceEvents.STATS_UPDATE, {
            statusCounts,
            total: stats.total || 0,
            mapped: stats.mapped || 0,
            unmapped: stats.unmapped || 0,
            mappingRate: stats.rate || 0,
            timestamp: new Date().toISOString(),
            udsEnabled: udsInit
        });
        
        debugLog(`📡 stats-update - RUN:${statusCounts.run}, IDLE:${statusCounts.idle}, STOP:${statusCounts.stop}, DISCONNECTED:${statusCounts.disconnected}`);
    }
    
    _getSignalTowerStats() {
        const counts = { run: 0, idle: 0, stop: 0, suddenstop: 0, disconnected: 0 };
        const stm = this._context?.signalTowerManager;
        
        if (stm?.getStatusStatistics) {
            const stats = stm.getStatusStatistics();
            counts.run = stats.RUN || 0;
            counts.idle = stats.IDLE || 0;
            counts.stop = stats.STOP || 0;
            counts.suddenstop = stats.SUDDENSTOP || 0;
            counts.disconnected = stats.DISCONNECTED || 0;
        }
        return counts;
    }
    
    getStatus() {
        return { hasContext: !!this._context, hasEventBus: !!this.getEventBus() };
    }
    
    dispose() { this._context = null; }
    
    static get VERSION() { return '1.0.0'; }
    static get Events() { return MonitoringServiceEvents; }
}

export default MonitoringEventEmitter;