/**
 * RecoveryStrategyManager.js
 * ==========================
 * 
 * 모드별 재연결 복구 전략 관리
 * 
 * @version 1.0.0
 * @module RecoveryStrategyManager
 * 
 * @description
 * 연결 복구 시 각 모드에 맞는 복구 전략을 정의하고 실행합니다.
 * - Monitoring: WebSocket 재연결 + 상태 동기화
 * - Analysis: DB Connection 재확인 (미래 확장)
 * - Dashboard: Redis 재연결 (미래 확장)
 * - Edit: 로컬 캐시 유지 (변경사항 보존)
 * 
 * 위치: frontend/threejs_viewer/src/services/recovery/RecoveryStrategyManager.js
 */

import { debugLog } from '../../core/utils/Config.js';

// ============================================
// 복구 모드 상수
// ============================================

/**
 * 복구 모드 타입
 */
export const RecoveryMode = Object.freeze({
    MONITORING: 'monitoring',
    ANALYSIS: 'analysis',
    DASHBOARD: 'dashboard',
    EDIT: 'equipment_edit',
    MAIN_VIEWER: 'main_viewer',
    SIMULATION: 'simulation'
});

/**
 * 복구 액션 타입
 */
export const RecoveryAction = Object.freeze({
    // Monitoring 관련
    RESTART_MONITORING_SERVICE: 'restartMonitoringService',
    RESUBSCRIBE_WEBSOCKET: 'resubscribeWebSocket',
    REFRESH_STATUS: 'refreshStatus',
    RELOAD_INITIAL_DATA: 'reloadInitialData',
    
    // Analysis 관련
    RELOAD_ANALYSIS_DATA: 'reloadAnalysisData',
    RECONNECT_DATABASE: 'reconnectDatabase',
    REFRESH_CACHE: 'refreshCache',
    
    // Dashboard 관련
    REFRESH_DASHBOARD: 'refreshDashboard',
    RECONNECT_REDIS: 'reconnectRedis',
    RELOAD_WIDGETS: 'reloadWidgets',
    
    // Edit 관련
    PRESERVE_LOCAL_CHANGES: 'preserveLocalChanges',
    RECONNECT_MAPPING_API: 'reconnectMappingApi',
    VALIDATE_MAPPINGS: 'validateMappings',
    
    // 공통
    HEALTH_CHECK: 'healthCheck',
    EMIT_RECOVERY_EVENT: 'emitRecoveryEvent'
});

/**
 * 복구 우선순위
 */
export const RecoveryPriority = Object.freeze({
    CRITICAL: 1,    // 즉시 실행 필요
    HIGH: 2,        // 높은 우선순위
    NORMAL: 3,      // 일반
    LOW: 4,         // 낮은 우선순위
    DEFERRED: 5     // 지연 가능
});

/**
 * 복구 결과 상태
 */
export const RecoveryResult = Object.freeze({
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    TIMEOUT: 'timeout'
});

// ============================================
// 기본 복구 전략 정의
// ============================================

/**
 * 모드별 기본 복구 전략
 */
const DEFAULT_STRATEGIES = {
    // =========================================
    // Monitoring 모드 복구 전략
    // WebSocket 재연결 + 상태 동기화
    // =========================================
    [RecoveryMode.MONITORING]: {
        name: 'Monitoring Recovery',
        description: 'WebSocket 재연결 및 실시간 상태 동기화',
        priority: RecoveryPriority.CRITICAL,
        
        // 타이밍 설정
        timing: {
            initialDelay: 300,          // 복구 시작 전 대기 (ms)
            actionInterval: 100,        // 액션 간 간격 (ms)
            timeout: 30000,             // 전체 타임아웃 (ms)
            retryCount: 3,              // 재시도 횟수
            retryDelay: 1000            // 재시도 간격 (ms)
        },
        
        // 실행할 액션 목록 (순서대로)
        actions: [
            {
                type: RecoveryAction.RESTART_MONITORING_SERVICE,
                priority: RecoveryPriority.CRITICAL,
                required: true,
                timeout: 10000,
                params: { fullRestart: false }
            },
            {
                type: RecoveryAction.RESUBSCRIBE_WEBSOCKET,
                priority: RecoveryPriority.HIGH,
                required: true,
                timeout: 5000,
                params: { resubscribeAll: true }
            },
            {
                type: RecoveryAction.REFRESH_STATUS,
                priority: RecoveryPriority.NORMAL,
                required: false,
                timeout: 5000,
                params: { forceRefresh: true }
            },
            {
                type: RecoveryAction.EMIT_RECOVERY_EVENT,
                priority: RecoveryPriority.LOW,
                required: false,
                timeout: 1000,
                params: { eventName: 'monitoring:recovered' }
            }
        ],
        
        // UI 알림 설정
        notification: {
            showToast: true,
            startMessage: '🔄 Monitoring 모드 복구 중...',
            successMessage: '✅ Monitoring 복구 완료',
            failMessage: '❌ Monitoring 복구 실패',
            partialMessage: '⚠️ Monitoring 부분 복구됨'
        },
        
        // 복구 실패 시 폴백
        fallback: {
            action: 'fullRestart',
            showPrompt: true,
            promptMessage: 'Monitoring 복구에 실패했습니다. 전체 재시작하시겠습니까?'
        }
    },
    
    // =========================================
    // Analysis 모드 복구 전략
    // DB Connection 재확인 (미래 확장)
    // =========================================
    [RecoveryMode.ANALYSIS]: {
        name: 'Analysis Recovery',
        description: 'DB 연결 재확인 및 분석 데이터 재로드',
        priority: RecoveryPriority.HIGH,
        
        timing: {
            initialDelay: 500,
            actionInterval: 200,
            timeout: 60000,             // 분석 데이터 로드에 시간 소요
            retryCount: 2,
            retryDelay: 2000
        },
        
        actions: [
            {
                type: RecoveryAction.HEALTH_CHECK,
                priority: RecoveryPriority.CRITICAL,
                required: true,
                timeout: 5000,
                params: { endpoint: 'analysis' }
            },
            {
                type: RecoveryAction.RECONNECT_DATABASE,
                priority: RecoveryPriority.HIGH,
                required: true,
                timeout: 10000,
                params: { 
                    databases: ['timescale', 'mssql'],
                    validateConnection: true 
                }
            },
            {
                type: RecoveryAction.REFRESH_CACHE,
                priority: RecoveryPriority.NORMAL,
                required: false,
                timeout: 5000,
                params: { clearStale: true }
            },
            {
                type: RecoveryAction.RELOAD_ANALYSIS_DATA,
                priority: RecoveryPriority.NORMAL,
                required: false,
                timeout: 30000,
                params: { 
                    preserveFilters: true,
                    preserveDateRange: true 
                }
            },
            {
                type: RecoveryAction.EMIT_RECOVERY_EVENT,
                priority: RecoveryPriority.LOW,
                required: false,
                timeout: 1000,
                params: { eventName: 'analysis:recovered' }
            }
        ],
        
        notification: {
            showToast: true,
            startMessage: '🔄 Analysis 데이터 재로드 중...',
            successMessage: '✅ Analysis 복구 완료',
            failMessage: '❌ Analysis 복구 실패',
            partialMessage: '⚠️ Analysis 부분 복구됨 (일부 데이터 누락 가능)'
        },
        
        fallback: {
            action: 'returnToMain',
            showPrompt: true,
            promptMessage: 'Analysis 복구에 실패했습니다. 메인 화면으로 돌아가시겠습니까?'
        }
    },
    
    // =========================================
    // Dashboard 모드 복구 전략
    // Redis 재연결 (미래 확장)
    // =========================================
    [RecoveryMode.DASHBOARD]: {
        name: 'Dashboard Recovery',
        description: 'Redis 캐시 재연결 및 대시보드 새로고침',
        priority: RecoveryPriority.HIGH,
        
        timing: {
            initialDelay: 300,
            actionInterval: 100,
            timeout: 30000,
            retryCount: 3,
            retryDelay: 1000
        },
        
        actions: [
            {
                type: RecoveryAction.HEALTH_CHECK,
                priority: RecoveryPriority.CRITICAL,
                required: true,
                timeout: 5000,
                params: { endpoint: 'dashboard' }
            },
            {
                type: RecoveryAction.RECONNECT_REDIS,
                priority: RecoveryPriority.HIGH,
                required: false,        // Redis 없어도 동작 가능
                timeout: 5000,
                params: { 
                    reconnectPubSub: true,
                    flushLocalCache: false 
                }
            },
            {
                type: RecoveryAction.RELOAD_WIDGETS,
                priority: RecoveryPriority.NORMAL,
                required: false,
                timeout: 10000,
                params: { 
                    preserveLayout: true,
                    reloadData: true 
                }
            },
            {
                type: RecoveryAction.REFRESH_DASHBOARD,
                priority: RecoveryPriority.NORMAL,
                required: false,
                timeout: 10000,
                params: { softRefresh: true }
            },
            {
                type: RecoveryAction.EMIT_RECOVERY_EVENT,
                priority: RecoveryPriority.LOW,
                required: false,
                timeout: 1000,
                params: { eventName: 'dashboard:recovered' }
            }
        ],
        
        notification: {
            showToast: true,
            startMessage: '🔄 Dashboard 새로고침 중...',
            successMessage: '✅ Dashboard 복구 완료',
            failMessage: '❌ Dashboard 복구 실패',
            partialMessage: '⚠️ Dashboard 부분 복구됨'
        },
        
        fallback: {
            action: 'reload',
            showPrompt: false,
            promptMessage: null
        }
    },
    
    // =========================================
    // Edit 모드 복구 전략
    // 로컬 캐시 유지 (변경사항 보존)
    // =========================================
    [RecoveryMode.EDIT]: {
        name: 'Edit Mode Recovery',
        description: '로컬 변경사항 보존 및 API 재연결',
        priority: RecoveryPriority.NORMAL,
        
        timing: {
            initialDelay: 100,
            actionInterval: 50,
            timeout: 15000,
            retryCount: 2,
            retryDelay: 500
        },
        
        actions: [
            {
                type: RecoveryAction.PRESERVE_LOCAL_CHANGES,
                priority: RecoveryPriority.CRITICAL,
                required: true,
                timeout: 2000,
                params: { 
                    triggerAutoSave: true,
                    backupToStorage: true 
                }
            },
            {
                type: RecoveryAction.RECONNECT_MAPPING_API,
                priority: RecoveryPriority.HIGH,
                required: false,
                timeout: 5000,
                params: { validateEndpoint: true }
            },
            {
                type: RecoveryAction.VALIDATE_MAPPINGS,
                priority: RecoveryPriority.LOW,
                required: false,
                timeout: 5000,
                params: { 
                    compareWithServer: false,   // 서버와 비교하지 않음 (로컬 우선)
                    markConflicts: true 
                }
            },
            {
                type: RecoveryAction.EMIT_RECOVERY_EVENT,
                priority: RecoveryPriority.LOW,
                required: false,
                timeout: 1000,
                params: { eventName: 'edit:recovered' }
            }
        ],
        
        notification: {
            showToast: false,           // Edit 모드는 조용히 복구
            startMessage: null,
            successMessage: null,
            failMessage: '⚠️ 연결이 복구되었습니다. 변경사항은 보존되었습니다.',
            partialMessage: null
        },
        
        fallback: {
            action: 'none',             // Edit 모드는 폴백 없음 (로컬 데이터 유지)
            showPrompt: false,
            promptMessage: null
        },
        
        // Edit 모드 특수 설정
        preserveState: {
            keepLocalChanges: true,     // 로컬 변경사항 항상 보존
            preventDataLoss: true,      // 데이터 손실 방지
            autoSaveOnRecovery: true    // 복구 시 자동 저장 트리거
        }
    },
    
    // =========================================
    // Main Viewer 모드 복구 전략
    // 최소 복구 (상태 확인만)
    // =========================================
    [RecoveryMode.MAIN_VIEWER]: {
        name: 'Main Viewer Recovery',
        description: '기본 연결 상태 확인',
        priority: RecoveryPriority.LOW,
        
        timing: {
            initialDelay: 0,
            actionInterval: 0,
            timeout: 5000,
            retryCount: 0,
            retryDelay: 0
        },
        
        actions: [
            {
                type: RecoveryAction.HEALTH_CHECK,
                priority: RecoveryPriority.NORMAL,
                required: false,
                timeout: 3000,
                params: { endpoint: 'default' }
            },
            {
                type: RecoveryAction.EMIT_RECOVERY_EVENT,
                priority: RecoveryPriority.LOW,
                required: false,
                timeout: 1000,
                params: { eventName: 'main:recovered' }
            }
        ],
        
        notification: {
            showToast: false,
            startMessage: null,
            successMessage: null,
            failMessage: null,
            partialMessage: null
        },
        
        fallback: {
            action: 'none',
            showPrompt: false,
            promptMessage: null
        }
    },
    
    // =========================================
    // Simulation 모드 복구 전략 (미래 확장)
    // =========================================
    [RecoveryMode.SIMULATION]: {
        name: 'Simulation Recovery',
        description: '시뮬레이션 상태 복구',
        priority: RecoveryPriority.NORMAL,
        
        timing: {
            initialDelay: 500,
            actionInterval: 100,
            timeout: 20000,
            retryCount: 2,
            retryDelay: 1000
        },
        
        actions: [
            {
                type: RecoveryAction.HEALTH_CHECK,
                priority: RecoveryPriority.HIGH,
                required: true,
                timeout: 5000,
                params: { endpoint: 'simulation' }
            },
            {
                type: RecoveryAction.EMIT_RECOVERY_EVENT,
                priority: RecoveryPriority.LOW,
                required: false,
                timeout: 1000,
                params: { eventName: 'simulation:recovered' }
            }
        ],
        
        notification: {
            showToast: true,
            startMessage: '🔄 Simulation 복구 중...',
            successMessage: '✅ Simulation 복구 완료',
            failMessage: '❌ Simulation 복구 실패',
            partialMessage: null
        },
        
        fallback: {
            action: 'returnToMain',
            showPrompt: true,
            promptMessage: 'Simulation 복구에 실패했습니다.'
        }
    }
};

// ============================================
// RecoveryStrategyManager 클래스
// ============================================

/**
 * 복구 전략 관리자
 * 
 * @class RecoveryStrategyManager
 * 
 * @example
 * const manager = new RecoveryStrategyManager({
 *     services: { monitoringService, apiClient, ... },
 *     eventBus: eventBus,
 *     toast: toast
 * });
 * 
 * // 복구 실행
 * const result = await manager.executeRecovery('monitoring', {
 *     recoveredAfter: 3
 * });
 */
export class RecoveryStrategyManager {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.services - 서비스 객체들
     * @param {Object} options.eventBus - EventBus 인스턴스
     * @param {Object} options.toast - Toast 인스턴스
     * @param {Object} [options.customStrategies] - 커스텀 전략
     * @param {boolean} [options.debug=false] - 디버그 모드
     */
    constructor(options = {}) {
        this.services = options.services || {};
        this.eventBus = options.eventBus || null;
        this.toast = options.toast || null;
        this.debug = options.debug ?? false;
        
        // 전략 병합 (기본 + 커스텀)
        this.strategies = {
            ...DEFAULT_STRATEGIES,
            ...(options.customStrategies || {})
        };
        
        // 액션 핸들러 등록
        this._actionHandlers = new Map();
        this._registerDefaultActionHandlers();
        
        // 실행 상태
        this._isRecovering = false;
        this._currentRecovery = null;
        this._recoveryHistory = [];
        
        // 통계
        this._stats = {
            totalRecoveries: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
            partialRecoveries: 0,
            lastRecovery: null
        };
        
        this._log('RecoveryStrategyManager initialized');
    }
    
    // ===============================================
    // 공개 메서드
    // ===============================================
    
    /**
     * 복구 실행
     * 
     * @param {string} mode - 복구 모드 (RecoveryMode)
     * @param {Object} [context] - 복구 컨텍스트
     * @param {number} [context.recoveredAfter] - 실패 횟수
     * @param {Object} [context.previousState] - 이전 상태
     * @returns {Promise<RecoveryExecutionResult>}
     */
    async executeRecovery(mode, context = {}) {
        // 중복 실행 방지
        if (this._isRecovering) {
            this._log(`Already recovering, skipping ${mode}`);
            return {
                status: RecoveryResult.SKIPPED,
                mode,
                reason: 'Already recovering'
            };
        }
        
        const strategy = this.strategies[mode];
        
        if (!strategy) {
            console.warn(`[RecoveryStrategyManager] Unknown mode: ${mode}`);
            return {
                status: RecoveryResult.FAILED,
                mode,
                reason: `Unknown mode: ${mode}`
            };
        }
        
        this._isRecovering = true;
        this._currentRecovery = { mode, strategy, context, startTime: Date.now() };
        
        this._log(`Starting recovery for mode: ${mode}`);
        this._log(`Strategy: ${strategy.name}`);
        
        try {
            // 시작 알림
            this._showNotification(strategy.notification?.startMessage, 'info');
            
            // 초기 딜레이
            if (strategy.timing.initialDelay > 0) {
                await this._delay(strategy.timing.initialDelay);
            }
            
            // 액션 실행
            const result = await this._executeActions(strategy, context);
            
            // 결과 처리
            this._handleRecoveryResult(mode, strategy, result);
            
            // 통계 업데이트
            this._updateStats(result.status);
            
            // 히스토리 기록
            this._recordHistory(mode, result);
            
            return result;
            
        } catch (error) {
            console.error(`[RecoveryStrategyManager] Recovery failed:`, error);
            
            const failResult = {
                status: RecoveryResult.FAILED,
                mode,
                error: error.message,
                elapsed: Date.now() - this._currentRecovery.startTime
            };
            
            this._handleRecoveryResult(mode, strategy, failResult);
            this._updateStats(RecoveryResult.FAILED);
            this._recordHistory(mode, failResult);
            
            return failResult;
            
        } finally {
            this._isRecovering = false;
            this._currentRecovery = null;
        }
    }
    
    /**
     * 특정 액션만 실행
     * 
     * @param {string} actionType - 액션 타입
     * @param {Object} [params] - 액션 파라미터
     * @returns {Promise<ActionResult>}
     */
    async executeAction(actionType, params = {}) {
        const handler = this._actionHandlers.get(actionType);
        
        if (!handler) {
            console.warn(`[RecoveryStrategyManager] Unknown action: ${actionType}`);
            return { success: false, error: `Unknown action: ${actionType}` };
        }
        
        try {
            return await handler(params, this.services);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 전략 조회
     * 
     * @param {string} mode - 모드
     * @returns {Object|null}
     */
    getStrategy(mode) {
        return this.strategies[mode] || null;
    }
    
    /**
     * 전략 업데이트
     * 
     * @param {string} mode - 모드
     * @param {Object} strategyUpdate - 업데이트할 전략 (부분)
     */
    updateStrategy(mode, strategyUpdate) {
        if (this.strategies[mode]) {
            this.strategies[mode] = {
                ...this.strategies[mode],
                ...strategyUpdate
            };
            this._log(`Strategy updated for mode: ${mode}`);
        }
    }
    
    /**
     * 커스텀 액션 핸들러 등록
     * 
     * @param {string} actionType - 액션 타입
     * @param {Function} handler - 핸들러 함수
     */
    registerActionHandler(actionType, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        
        this._actionHandlers.set(actionType, handler);
        this._log(`Action handler registered: ${actionType}`);
    }
    
    /**
     * 서비스 업데이트
     * 
     * @param {Object} services - 서비스 객체들
     */
    setServices(services) {
        this.services = { ...this.services, ...services };
    }
    
    /**
     * 복구 상태 조회
     * 
     * @returns {Object}
     */
    getStatus() {
        return {
            isRecovering: this._isRecovering,
            currentRecovery: this._currentRecovery ? {
                mode: this._currentRecovery.mode,
                elapsed: Date.now() - this._currentRecovery.startTime
            } : null,
            stats: { ...this._stats },
            recentHistory: this._recoveryHistory.slice(-10)
        };
    }
    
    /**
     * 통계 초기화
     */
    resetStats() {
        this._stats = {
            totalRecoveries: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
            partialRecoveries: 0,
            lastRecovery: null
        };
        this._recoveryHistory = [];
    }
    
    // ===============================================
    // 내부 메서드 - 액션 실행
    // ===============================================
    
    /**
     * 액션 목록 실행
     * @private
     */
    async _executeActions(strategy, context) {
        const actions = strategy.actions || [];
        const results = [];
        
        let successCount = 0;
        let failCount = 0;
        let requiredFailed = false;
        
        for (const action of actions) {
            // 필수 액션 실패 시 중단
            if (requiredFailed) {
                results.push({
                    type: action.type,
                    status: 'skipped',
                    reason: 'Previous required action failed'
                });
                continue;
            }
            
            this._log(`Executing action: ${action.type}`);
            
            try {
                const result = await this._executeActionWithTimeout(action, context);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                    if (action.required) {
                        requiredFailed = true;
                    }
                }
                
            } catch (error) {
                const errorResult = {
                    type: action.type,
                    success: false,
                    error: error.message
                };
                results.push(errorResult);
                failCount++;
                
                if (action.required) {
                    requiredFailed = true;
                }
            }
            
            // 액션 간 간격
            if (strategy.timing.actionInterval > 0) {
                await this._delay(strategy.timing.actionInterval);
            }
        }
        
        // 결과 상태 결정
        let status;
        if (requiredFailed) {
            status = RecoveryResult.FAILED;
        } else if (failCount === 0) {
            status = RecoveryResult.SUCCESS;
        } else if (successCount > 0) {
            status = RecoveryResult.PARTIAL;
        } else {
            status = RecoveryResult.FAILED;
        }
        
        return {
            status,
            mode: strategy.name,
            actions: results,
            successCount,
            failCount,
            elapsed: Date.now() - this._currentRecovery.startTime
        };
    }
    
    /**
     * 타임아웃과 함께 액션 실행
     * @private
     */
    async _executeActionWithTimeout(action, context) {
        const handler = this._actionHandlers.get(action.type);
        
        if (!handler) {
            return {
                type: action.type,
                success: false,
                error: `No handler for action: ${action.type}`
            };
        }
        
        const timeout = action.timeout || 10000;
        
        try {
            const result = await Promise.race([
                handler({ ...action.params, context }, this.services),
                this._createTimeout(timeout)
            ]);
            
            return {
                type: action.type,
                success: result.success ?? true,
                ...result
            };
            
        } catch (error) {
            if (error.message === 'TIMEOUT') {
                return {
                    type: action.type,
                    success: false,
                    error: `Action timeout after ${timeout}ms`
                };
            }
            throw error;
        }
    }
    
    // ===============================================
    // 내부 메서드 - 기본 액션 핸들러
    // ===============================================
    
    /**
     * 기본 액션 핸들러 등록
     * @private
     */
    _registerDefaultActionHandlers() {
        // ===== Monitoring 관련 =====
        
        this._actionHandlers.set(RecoveryAction.RESTART_MONITORING_SERVICE, async (params, services) => {
            const monitoringService = services.monitoringService;
            
            if (!monitoringService) {
                return { success: false, error: 'MonitoringService not available' };
            }
            
            if (typeof monitoringService.restart === 'function') {
                await monitoringService.restart({ fullRestart: params.fullRestart ?? false });
                return { success: true };
            } else {
                // 폴백: stop + start
                if (monitoringService.isActive) {
                    await monitoringService.stop();
                    await this._delay(300);
                }
                await monitoringService.start();
                return { success: true };
            }
        });
        
        this._actionHandlers.set(RecoveryAction.RESUBSCRIBE_WEBSOCKET, async (params, services) => {
            const monitoringService = services.monitoringService;
            
            if (!monitoringService) {
                return { success: false, error: 'MonitoringService not available' };
            }
            
            // DataLoader 사용
            const dataLoader = monitoringService.getDataLoader?.();
            if (dataLoader) {
                await dataLoader.reconnectWebSocket();
                return { success: true, method: 'dataLoader' };
            }
            
            // 레거시 WebSocketManager 사용
            const wsManager = monitoringService.wsManager;
            if (wsManager) {
                if (!wsManager.isConnected()) {
                    await wsManager.connect();
                }
                wsManager.subscribe();
                return { success: true, method: 'wsManager' };
            }
            
            return { success: false, error: 'No WebSocket manager available' };
        });
        
        this._actionHandlers.set(RecoveryAction.REFRESH_STATUS, async (params, services) => {
            const monitoringService = services.monitoringService;
            
            if (!monitoringService) {
                return { success: false, error: 'MonitoringService not available' };
            }
            
            await monitoringService.loadInitialStatus?.();
            monitoringService.updateStatusPanel?.();
            
            return { success: true };
        });
        
        this._actionHandlers.set(RecoveryAction.RELOAD_INITIAL_DATA, async (params, services) => {
            const dataLoader = services.monitoringService?.getDataLoader?.();
            
            if (dataLoader) {
                await dataLoader.load({ skipWebSocket: true });
                return { success: true };
            }
            
            return { success: false, error: 'DataLoader not available' };
        });
        
        // ===== Analysis 관련 =====
        
        this._actionHandlers.set(RecoveryAction.RELOAD_ANALYSIS_DATA, async (params, services) => {
            // TODO: AnalysisDataLoader 구현 후 연동
            this._log('Analysis data reload - not implemented yet');
            
            if (this.eventBus) {
                this.eventBus.emit('analysis:reload-requested', {
                    preserveFilters: params.preserveFilters,
                    preserveDateRange: params.preserveDateRange
                });
            }
            
            return { success: true, pending: true };
        });
        
        this._actionHandlers.set(RecoveryAction.RECONNECT_DATABASE, async (params, services) => {
            // TODO: Database 재연결 로직 구현
            this._log('Database reconnect - delegating to backend');
            
            if (this.eventBus) {
                this.eventBus.emit('database:reconnect-requested', {
                    databases: params.databases
                });
            }
            
            return { success: true, pending: true };
        });
        
        this._actionHandlers.set(RecoveryAction.REFRESH_CACHE, async (params, services) => {
            // TODO: Cache 새로고침 로직 구현
            this._log('Cache refresh requested');
            
            if (this.eventBus) {
                this.eventBus.emit('cache:refresh-requested', {
                    clearStale: params.clearStale
                });
            }
            
            return { success: true, pending: true };
        });
        
        // ===== Dashboard 관련 =====
        
        this._actionHandlers.set(RecoveryAction.REFRESH_DASHBOARD, async (params, services) => {
            // TODO: DashboardDataLoader 구현 후 연동
            this._log('Dashboard refresh requested');
            
            if (this.eventBus) {
                this.eventBus.emit('dashboard:refresh-requested', {
                    softRefresh: params.softRefresh
                });
            }
            
            return { success: true, pending: true };
        });
        
        this._actionHandlers.set(RecoveryAction.RECONNECT_REDIS, async (params, services) => {
            // TODO: Redis 재연결 로직 구현
            this._log('Redis reconnect requested');
            
            if (this.eventBus) {
                this.eventBus.emit('redis:reconnect-requested', {
                    reconnectPubSub: params.reconnectPubSub
                });
            }
            
            return { success: true, pending: true };
        });
        
        this._actionHandlers.set(RecoveryAction.RELOAD_WIDGETS, async (params, services) => {
            // TODO: Widget 재로드 로직 구현
            this._log('Widget reload requested');
            
            if (this.eventBus) {
                this.eventBus.emit('widgets:reload-requested', {
                    preserveLayout: params.preserveLayout
                });
            }
            
            return { success: true, pending: true };
        });
        
        // ===== Edit 관련 =====
        
        this._actionHandlers.set(RecoveryAction.PRESERVE_LOCAL_CHANGES, async (params, services) => {
            const equipmentEditState = services.equipmentEditState;
            
            if (!equipmentEditState) {
                return { success: true, skipped: true, reason: 'No edit state' };
            }
            
            // AutoSave 트리거
            if (params.triggerAutoSave && equipmentEditState.triggerAutoSave) {
                equipmentEditState.triggerAutoSave();
            }
            
            // 스토리지 백업
            if (params.backupToStorage && services.storageService) {
                const data = equipmentEditState.exportData?.();
                if (data) {
                    services.storageService.set?.('equipment_recovery_backup', data);
                }
            }
            
            return { success: true, preserved: true };
        });
        
        this._actionHandlers.set(RecoveryAction.RECONNECT_MAPPING_API, async (params, services) => {
            const apiClient = services.apiClient;
            
            if (!apiClient) {
                return { success: false, error: 'ApiClient not available' };
            }
            
            // API 헬스체크
            try {
                if (apiClient.healthCheck) {
                    const isHealthy = await apiClient.healthCheck();
                    return { success: isHealthy, healthCheck: isHealthy };
                }
                return { success: true, skipped: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        this._actionHandlers.set(RecoveryAction.VALIDATE_MAPPINGS, async (params, services) => {
            const equipmentEditState = services.equipmentEditState;
            
            if (!equipmentEditState) {
                return { success: true, skipped: true };
            }
            
            // 매핑 유효성 검사 (로컬만)
            const mappingCount = equipmentEditState.getMappingCount?.() || 0;
            
            return { 
                success: true, 
                mappingCount,
                validated: true 
            };
        });
        
        // ===== 공통 =====
        
        this._actionHandlers.set(RecoveryAction.HEALTH_CHECK, async (params, services) => {
            const connectionStatusService = services.connectionStatusService;
            
            if (connectionStatusService?.checkNow) {
                const result = await connectionStatusService.checkNow();
                return { success: result.isOnline, ...result };
            }
            
            // 폴백: API 직접 체크
            const apiClient = services.apiClient;
            if (apiClient?.healthCheck) {
                const isHealthy = await apiClient.healthCheck();
                return { success: isHealthy };
            }
            
            return { success: true, skipped: true };
        });
        
        this._actionHandlers.set(RecoveryAction.EMIT_RECOVERY_EVENT, async (params, services) => {
            if (this.eventBus && params.eventName) {
                this.eventBus.emit(params.eventName, {
                    timestamp: new Date().toISOString(),
                    context: params.context
                });
            }
            return { success: true };
        });
    }
    
    // ===============================================
    // 내부 메서드 - 결과 처리
    // ===============================================
    
    /**
     * 복구 결과 처리
     * @private
     */
    _handleRecoveryResult(mode, strategy, result) {
        switch (result.status) {
            case RecoveryResult.SUCCESS:
                this._showNotification(strategy.notification?.successMessage, 'success');
                this._emitRecoveryEvent('recovery:complete', { mode, result });
                break;
                
            case RecoveryResult.PARTIAL:
                this._showNotification(strategy.notification?.partialMessage, 'warning');
                this._emitRecoveryEvent('recovery:partial', { mode, result });
                break;
                
            case RecoveryResult.FAILED:
                this._showNotification(strategy.notification?.failMessage, 'error');
                this._emitRecoveryEvent('recovery:failed', { mode, result });
                this._handleFallback(mode, strategy, result);
                break;
                
            case RecoveryResult.TIMEOUT:
                this._showNotification('복구 시간 초과', 'error');
                this._emitRecoveryEvent('recovery:timeout', { mode, result });
                break;
        }
    }
    
    /**
     * 폴백 처리
     * @private
     */
    _handleFallback(mode, strategy, result) {
        const fallback = strategy.fallback;
        
        if (!fallback || fallback.action === 'none') {
            return;
        }
        
        this._log(`Handling fallback: ${fallback.action}`);
        
        if (fallback.showPrompt && fallback.promptMessage) {
            // 사용자 확인 요청
            this._emitRecoveryEvent('recovery:fallback-prompt', {
                mode,
                action: fallback.action,
                message: fallback.promptMessage
            });
        } else {
            // 자동 폴백 실행
            this._executeFallback(fallback.action, mode);
        }
    }
    
    /**
     * 폴백 액션 실행
     * @private
     */
    _executeFallback(action, mode) {
        switch (action) {
            case 'fullRestart':
                this._emitRecoveryEvent('recovery:full-restart-requested', { mode });
                break;
                
            case 'returnToMain':
                this._emitRecoveryEvent('recovery:return-to-main-requested', { mode });
                break;
                
            case 'reload':
                window.location.reload();
                break;
        }
    }
    
    // ===============================================
    // 내부 메서드 - 유틸리티
    // ===============================================
    
    /**
     * 통계 업데이트
     * @private
     */
    _updateStats(status) {
        this._stats.totalRecoveries++;
        this._stats.lastRecovery = new Date().toISOString();
        
        switch (status) {
            case RecoveryResult.SUCCESS:
                this._stats.successfulRecoveries++;
                break;
            case RecoveryResult.PARTIAL:
                this._stats.partialRecoveries++;
                break;
            case RecoveryResult.FAILED:
            case RecoveryResult.TIMEOUT:
                this._stats.failedRecoveries++;
                break;
        }
    }
    
    /**
     * 히스토리 기록
     * @private
     */
    _recordHistory(mode, result) {
        this._recoveryHistory.push({
            mode,
            status: result.status,
            elapsed: result.elapsed,
            timestamp: new Date().toISOString()
        });
        
        // 최대 100개 유지
        if (this._recoveryHistory.length > 100) {
            this._recoveryHistory = this._recoveryHistory.slice(-100);
        }
    }
    
    /**
     * 알림 표시
     * @private
     */
    _showNotification(message, type) {
        if (!message) return;
        
        if (this.toast?.show) {
            this.toast.show(message, type);
        } else if (window.showToast) {
            window.showToast(message, type);
        }
    }
    
    /**
     * 이벤트 발행
     * @private
     */
    _emitRecoveryEvent(eventName, data) {
        if (this.eventBus) {
            this.eventBus.emit(eventName, {
                ...data,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * 딜레이
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 타임아웃 Promise 생성
     * @private
     */
    _createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), ms);
        });
    }
    
    /**
     * 로그 출력
     * @private
     */
    _log(message) {
        if (this.debug) {
            console.log(`[RecoveryStrategyManager] ${message}`);
        }
        debugLog(`[Recovery] ${message}`);
    }
    
    // ===============================================
    // 리소스 정리
    // ===============================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this._actionHandlers.clear();
        this._recoveryHistory = [];
        this.services = null;
        this.eventBus = null;
        this.toast = null;
        
        this._log('RecoveryStrategyManager disposed');
    }
}

// ============================================
// 싱글톤 인스턴스 (선택적 사용)
// ============================================

let _instance = null;

/**
 * 싱글톤 인스턴스 획득
 * @param {Object} [options] - 초기화 옵션 (최초 호출 시만 적용)
 * @returns {RecoveryStrategyManager}
 */
export function getRecoveryStrategyManager(options = null) {
    if (!_instance && options) {
        _instance = new RecoveryStrategyManager(options);
    }
    return _instance;
}

/**
 * 싱글톤 인스턴스 초기화
 * @param {Object} options - 초기화 옵션
 * @returns {RecoveryStrategyManager}
 */
export function initRecoveryStrategyManager(options) {
    if (_instance) {
        _instance.dispose();
    }
    _instance = new RecoveryStrategyManager(options);
    return _instance;
}

// ============================================
// 기본 export
// ============================================

export default RecoveryStrategyManager;