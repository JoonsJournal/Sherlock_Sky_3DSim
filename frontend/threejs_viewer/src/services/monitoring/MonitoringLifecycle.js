/**
 * MonitoringLifecycle.js
 * ======================
 * 모니터링 서비스 라이프사이클 관리 모듈
 * 
 * @version 1.0.0
 * @changelog
 * - v1.0.0: MonitoringService v5.1.0에서 분리 (2026-01-25)
 *           - start(), stop(), restart() 추출
 *           - ⚠️ 호환성: 기존 API 100% 유지
 * 
 * @exports MonitoringLifecycle, LifecycleState
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/MonitoringLifecycle.js
 */

import { debugLog } from '../../core/utils/Config.js';

export const LifecycleState = Object.freeze({
    IDLE: 'idle',
    STARTING: 'starting',
    RUNNING: 'running',
    STOPPING: 'stopping',
    RESTARTING: 'restarting',
    ERROR: 'error'
});

/**
 * 모니터링 라이프사이클 관리 클래스
 */
export class MonitoringLifecycle {
    constructor(context) {
        this.context = context;
        this.state = LifecycleState.IDLE;
        this._startPromise = null;
        this._stopPromise = null;
        debugLog('📡 MonitoringLifecycle v1.0.0 initialized');
    }
    
    // === 상태 확인 ===
    getState() { return this.state; }
    isRunning() { return this.state === LifecycleState.RUNNING; }
    isStarting() { return this.state === LifecycleState.STARTING; }
    isStopping() { return this.state === LifecycleState.STOPPING; }
    isRestarting() { return this.state === LifecycleState.RESTARTING; }
    
    // === 시작 ===
    async start(options = {}) {
        const ctx = this.context;
        const { useUDS = ctx.isUDSEnabled?.() || false, siteId = 1, lineId = 1 } = options;
        
        if (this.state === LifecycleState.STARTING) {
            debugLog('⚠️ Start already in progress');
            return this._startPromise || Promise.resolve(false);
        }
        if (this.state === LifecycleState.RUNNING) {
            debugLog('⚠️ Already running');
            return true;
        }
        
        this.state = LifecycleState.STARTING;
        ctx._isStarting = true;
        ctx._emitServiceEvent?.(ctx.constructor.Events?.START_BEGIN, { useUDS });
        
        debugLog(`🟢 Starting monitoring (UDS: ${useUDS})...`);
        
        this._startPromise = this._executeStart({ useUDS, siteId, lineId });
        try {
            return await this._startPromise;
        } finally {
            this._startPromise = null;
            ctx._isStarting = false;
        }
    }
    
    async _executeStart(options) {
        const ctx = this.context;
        const { useUDS, siteId, lineId } = options;
        const startTime = Date.now();
        
        try {
            // Step 1: SignalTower 초기화
            ctx.signalIntegration?.initializeAllLights?.();
            
            // Step 2: 미매핑 스타일 적용
            const applyResult = ctx.signalIntegration?.applyUnmappedStyle?.() || {};
            if (ctx.currentStats) {
                ctx.currentStats.mapped = applyResult.mapped || 0;
                ctx.currentStats.unmapped = applyResult.unmapped || 0;
                ctx.currentStats.total = applyResult.total || 0;
                ctx.currentStats.rate = applyResult.rate || 0;
            }
            
            // Step 3: 데이터 로드 (UDS vs Legacy)
            if (useUDS) {
                const udsSuccess = await ctx.initializeWithUDS?.({ siteId, lineId });
                if (!udsSuccess) {
                    debugLog('⚠️ UDS failed, falling back to legacy');
                    await this._legacyLoad();
                }
            } else {
                await this._legacyLoad();
            }
            
            // Step 4: 배치 처리 시작
            ctx.startBatchProcessing?.();
            
            // Step 5: 이벤트 리스너 등록
            ctx.registerEventListeners?.();
            
            // 완료
            this.state = LifecycleState.RUNNING;
            ctx.isActive = true;
            
            const elapsed = Date.now() - startTime;
            ctx._emitStatsUpdate?.();
            ctx._emitServiceEvent?.(ctx.constructor.Events?.START_COMPLETE, {
                elapsed,
                stats: ctx.getStats?.(),
                wsConnected: ctx.wsManager?.isConnected() || ctx._dataLoader?.isWsConnected?.(),
                udsEnabled: ctx._udsInitialized || false
            });
            
            debugLog(`✅ Monitoring started (${elapsed}ms)`);
            return true;
            
        } catch (error) {
            console.error('❌ Start failed:', error);
            ctx._emitServiceEvent?.(ctx.constructor.Events?.START_ERROR, { error: error.message });
            this._rollback();
            return false;
        }
    }
    
    async _legacyLoad() {
        const ctx = this.context;
        ctx._dataLoader?.setDependencies?.({
            equipmentEditState: ctx.equipmentEditState,
            signalTowerManager: ctx.signalTowerManager
        });
        await ctx._dataLoader?.initialize?.();
        
        try {
            const result = await ctx._dataLoader?.load?.({
                thresholdHours: ctx.staleThresholdHours,
                skipWebSocket: false
            });
            
            if (result?.initialData?.equipment) {
                result.initialData.equipment.forEach(item => {
                    const fid = ctx.equipmentEditState?.getFrontendIdByEquipmentId?.(item.equipment_id);
                    if (fid) {
                        const status = item.is_connected === false ? 'DISCONNECTED' : item.status;
                        ctx.statusCache?.set(fid, status);
                        ctx.signalIntegration?.updateStatus?.(fid, status);
                    }
                });
            }
            
            if (result?.stats && ctx.currentStats) {
                ctx.currentStats.connected = result.stats.connectedCount || 0;
                ctx.currentStats.disconnected = result.stats.disconnectedCount || 0;
            }
        } catch (error) {
            debugLog(`⚠️ DataLoader failed: ${error.message}`);
            try { await ctx.loadInitialStatus?.(); } catch (e) { /* ignore */ }
            try { await ctx.connectWebSocket?.(); } catch (e) { /* ignore */ }
        }
    }
    
    _rollback() {
        const ctx = this.context;
        this.state = LifecycleState.ERROR;
        ctx.isActive = false;
        ctx._udsInitialized = false;
        ctx.udsIntegration?.unsubscribeFromEvents?.();
        ctx._unsubscribeFromUDSEvents?.();
        
        if (ctx.batchTimer) {
            clearInterval(ctx.batchTimer);
            ctx.batchTimer = null;
        }
        try { ctx.unregisterEventListeners?.(); } catch (e) { /* ignore */ }
    }
    
    // === 중지 ===
    async stop() {
        const ctx = this.context;
        
        if (this.state === LifecycleState.STOPPING) {
            return this._stopPromise || Promise.resolve();
        }
        if (this.state === LifecycleState.IDLE) return;
        
        this.state = LifecycleState.STOPPING;
        ctx._isStopping = true;
        ctx._emitServiceEvent?.(ctx.constructor.Events?.STOP_BEGIN, {});
        
        debugLog('🔴 Stopping monitoring...');
        
        this._stopPromise = this._executeStop();
        try {
            await this._stopPromise;
        } finally {
            this._stopPromise = null;
            ctx._isStopping = false;
        }
    }
    
    async _executeStop() {
        const ctx = this.context;
        try {
            ctx.isActive = false;
            ctx.unregisterEventListeners?.();
            
            // UDS 정리
            ctx.udsIntegration?.unsubscribeFromEvents?.();
            ctx._unsubscribeFromUDSEvents?.();
            ctx._udsInitialized = false;
            
            // 스타일 리셋
            ctx.signalIntegration?.resetAllStyles?.();
            ctx.resetEquipmentStyle?.();
            
            // 연결 종료
            ctx.udsIntegration?.getStore?.()?.dispose?.();
            ctx._dataLoader?.disconnectWebSocket?.();
            ctx.wsManager?.disconnect?.();
            
            // 타이머 정리
            if (ctx.batchTimer) {
                clearInterval(ctx.batchTimer);
                ctx.batchTimer = null;
            }
            
            this.state = LifecycleState.IDLE;
            ctx._emitServiceEvent?.(ctx.constructor.Events?.STOP_COMPLETE, {});
            debugLog('✅ Monitoring stopped');
        } catch (error) {
            console.error('❌ Stop error:', error);
            this.state = LifecycleState.ERROR;
        }
    }
    
    // === 재시작 ===
    async restart(options = {}) {
        const { fullRestart = false, delay = 500 } = options;
        const ctx = this.context;
        
        debugLog(`🔄 Restarting (full: ${fullRestart})...`);
        this.state = LifecycleState.RESTARTING;
        ctx._emitServiceEvent?.(ctx.constructor.Events?.RESTART_BEGIN, { fullRestart });
        
        try {
            if (fullRestart) {
                await this.stop();
                if (delay > 0) await this._delay(delay);
                const result = await this.start();
                ctx._emitServiceEvent?.(ctx.constructor.Events?.RESTART_COMPLETE, { fullRestart: true, success: result });
                return result;
            } else {
                return await this._restartWebSocketOnly();
            }
        } catch (error) {
            console.error('❌ Restart failed:', error);
            this.state = LifecycleState.ERROR;
            return false;
        }
    }
    
    async _restartWebSocketOnly() {
        const ctx = this.context;
        
        // UDS WebSocket
        if (ctx._udsInitialized || ctx.udsIntegration?.isInitialized?.()) {
            debugLog('✅ UDS WebSocket managed internally');
            this.state = LifecycleState.RUNNING;
            ctx._emitServiceEvent?.(ctx.constructor.Events?.RESTART_COMPLETE, { fullRestart: false, success: true, method: 'uds' });
            return true;
        }
        
        // DataLoader WebSocket
        if (ctx._dataLoader) {
            try {
                const success = await ctx._dataLoader.reconnectWebSocket?.();
                if (success) {
                    this.state = LifecycleState.RUNNING;
                    ctx._emitServiceEvent?.(ctx.constructor.Events?.RESTART_COMPLETE, { fullRestart: false, success: true, method: 'dataLoader' });
                    return true;
                }
            } catch (e) { debugLog(`⚠️ DataLoader reconnect failed: ${e.message}`); }
        }
        
        // Legacy WebSocket
        if (ctx.wsManager) {
            try {
                ctx.wsManager.disconnect?.();
                await this._delay(300);
                await ctx.wsManager.connect?.();
                ctx.wsManager.subscribe?.();
                this.state = LifecycleState.RUNNING;
                ctx._emitServiceEvent?.(ctx.constructor.Events?.RESTART_COMPLETE, { fullRestart: false, success: true, method: 'wsManager' });
                return true;
            } catch (e) { debugLog(`❌ Legacy reconnect failed: ${e.message}`); }
        }
        
        this.state = LifecycleState.ERROR;
        return false;
    }
    
    _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
    
    getStatus() {
        return {
            state: this.state,
            isRunning: this.isRunning(),
            isStarting: this.isStarting(),
            isStopping: this.isStopping()
        };
    }
    
    dispose() {
        if (this.isRunning()) this.stop();
        this.state = LifecycleState.IDLE;
        this._startPromise = null;
        this._stopPromise = null;
        this.context = null;
    }
    
    static get VERSION() { return '1.0.0'; }
    static get States() { return LifecycleState; }
}

export default MonitoringLifecycle;