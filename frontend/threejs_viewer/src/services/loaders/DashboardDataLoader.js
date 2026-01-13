/**
 * DashboardDataLoader.js
 * ======================
 * 
 * Dashboard 모드용 DataLoader (스켈레톤)
 * IDataLoader 인터페이스 구현
 * 
 * @version 1.0.0 (스켈레톤)
 * @module DashboardDataLoader
 * @implements {IDataLoader}
 * 
 * @description
 * Dashboard 모드에서 위젯 데이터를 효율적으로 로드합니다.
 * - Redis 캐시 연동 (Pub/Sub 실시간 갱신)
 * - 위젯별 독립적 데이터 로드
 * - TTL 기반 캐시 전략
 * - 계층적 갱신 전략 (Critical/Normal/Low)
 * 
 * 위치: frontend/threejs_viewer/src/services/loaders/DashboardDataLoader.js
 * 
 * @example
 * const loader = new DashboardDataLoader({
 *     apiClient: apiClient,
 *     eventBus: eventBus,
 *     redisConfig: { host: 'localhost', port: 6379 }
 * });
 * 
 * // 위젯 데이터 로드
 * await loader.loadWidget('production-summary', { siteId: 'KR_FAB1' });
 * 
 * // 전체 대시보드 로드
 * await loader.load({ widgets: ['kpi', 'alerts', 'timeline'] });
 */

import { IDataLoader, DataLoaderState, DataLoaderEvents } from './IDataLoader.js';
import { debugLog } from '../../core/utils/Config.js';

// ============================================
// 상수 정의
// ============================================

/**
 * 위젯 타입
 */
export const WidgetType = Object.freeze({
    // KPI 위젯
    KPI_SUMMARY: 'kpi_summary',                 // KPI 요약
    PRODUCTION_STATUS: 'production_status',     // 생산 현황
    EQUIPMENT_STATUS: 'equipment_status',       // 설비 현황
    
    // 차트 위젯
    TREND_CHART: 'trend_chart',                 // 트렌드 차트
    PIE_CHART: 'pie_chart',                     // 파이 차트
    BAR_CHART: 'bar_chart',                     // 바 차트
    
    // 테이블 위젯
    ALERT_TABLE: 'alert_table',                 // 알람 테이블
    EVENT_LOG: 'event_log',                     // 이벤트 로그
    
    // 실시간 위젯
    REALTIME_COUNTER: 'realtime_counter',       // 실시간 카운터
    LIVE_STATUS: 'live_status',                 // 라이브 상태
    
    // 복합 위젯
    SITE_OVERVIEW: 'site_overview',             // 사이트 개요
    SHIFT_SUMMARY: 'shift_summary'              // 근무조 요약
});

/**
 * 캐시 우선순위 (갱신 주기 결정)
 */
export const CachePriority = Object.freeze({
    CRITICAL: 'critical',   // 실시간 (5초)
    HIGH: 'high',           // 고빈도 (30초)
    NORMAL: 'normal',       // 일반 (2분)
    LOW: 'low',             // 저빈도 (5분)
    STATIC: 'static'        // 정적 (30분)
});

/**
 * 갱신 전략
 */
export const RefreshStrategy = Object.freeze({
    REALTIME: 'realtime',       // 실시간 (WebSocket/SSE)
    POLLING: 'polling',         // 폴링
    ON_DEMAND: 'on_demand',     // 요청 시
    PUSH: 'push',               // 서버 푸시 (Redis Pub/Sub)
    HYBRID: 'hybrid'            // 혼합 (Push + Polling 폴백)
});

/**
 * Redis 채널
 */
export const RedisChannel = Object.freeze({
    DASHBOARD_UPDATE: 'dashboard:update',
    WIDGET_INVALIDATE: 'dashboard:widget:invalidate',
    KPI_UPDATE: 'dashboard:kpi:update',
    ALERT_NEW: 'dashboard:alert:new',
    STATUS_CHANGE: 'dashboard:status:change'
});

/**
 * 위젯별 기본 설정
 */
const WIDGET_DEFAULTS = {
    [WidgetType.KPI_SUMMARY]: {
        priority: CachePriority.HIGH,
        refreshStrategy: RefreshStrategy.PUSH,
        ttl: 30 * 1000,         // 30초
        autoRefresh: true
    },
    [WidgetType.PRODUCTION_STATUS]: {
        priority: CachePriority.HIGH,
        refreshStrategy: RefreshStrategy.HYBRID,
        ttl: 30 * 1000,
        autoRefresh: true
    },
    [WidgetType.EQUIPMENT_STATUS]: {
        priority: CachePriority.CRITICAL,
        refreshStrategy: RefreshStrategy.REALTIME,
        ttl: 5 * 1000,          // 5초
        autoRefresh: true
    },
    [WidgetType.TREND_CHART]: {
        priority: CachePriority.NORMAL,
        refreshStrategy: RefreshStrategy.POLLING,
        ttl: 2 * 60 * 1000,     // 2분
        autoRefresh: true
    },
    [WidgetType.ALERT_TABLE]: {
        priority: CachePriority.CRITICAL,
        refreshStrategy: RefreshStrategy.PUSH,
        ttl: 10 * 1000,         // 10초
        autoRefresh: true
    },
    [WidgetType.EVENT_LOG]: {
        priority: CachePriority.NORMAL,
        refreshStrategy: RefreshStrategy.ON_DEMAND,
        ttl: 2 * 60 * 1000,
        autoRefresh: false
    },
    [WidgetType.REALTIME_COUNTER]: {
        priority: CachePriority.CRITICAL,
        refreshStrategy: RefreshStrategy.REALTIME,
        ttl: 5 * 1000,
        autoRefresh: true
    },
    [WidgetType.SITE_OVERVIEW]: {
        priority: CachePriority.LOW,
        refreshStrategy: RefreshStrategy.POLLING,
        ttl: 5 * 60 * 1000,     // 5분
        autoRefresh: true
    },
    [WidgetType.SHIFT_SUMMARY]: {
        priority: CachePriority.LOW,
        refreshStrategy: RefreshStrategy.ON_DEMAND,
        ttl: 5 * 60 * 1000,
        autoRefresh: false
    }
};

/**
 * 기본 설정
 */
const DEFAULT_CONFIG = {
    // Redis
    enableRedis: true,
    redisReconnectInterval: 5000,
    redisReconnectMaxAttempts: 10,
    
    // 캐시 TTL (우선순위별)
    cacheTTL: {
        [CachePriority.CRITICAL]: 5 * 1000,      // 5초
        [CachePriority.HIGH]: 30 * 1000,          // 30초
        [CachePriority.NORMAL]: 2 * 60 * 1000,    // 2분
        [CachePriority.LOW]: 5 * 60 * 1000,       // 5분
        [CachePriority.STATIC]: 30 * 60 * 1000    // 30분
    },
    
    // 폴링 간격 (우선순위별)
    pollingInterval: {
        [CachePriority.CRITICAL]: 5 * 1000,
        [CachePriority.HIGH]: 30 * 1000,
        [CachePriority.NORMAL]: 60 * 1000,
        [CachePriority.LOW]: 5 * 60 * 1000,
        [CachePriority.STATIC]: null              // 폴링 안함
    },
    
    // 배치 로딩
    enableBatchLoading: true,
    batchSize: 5,
    batchDelay: 100,
    
    // 타임아웃
    requestTimeout: 10000,
    
    // 재시도
    maxRetries: 3,
    retryDelay: 1000,
    
    // 메모리 관리
    maxCacheSize: 20 * 1024 * 1024,  // 20MB
    
    // 디버그
    debug: false
};

// ============================================
// DashboardDataLoader 클래스
// ============================================

/**
 * Dashboard 모드용 DataLoader
 * 
 * @class DashboardDataLoader
 * @implements {IDataLoader}
 * 
 * 【Redis 연결 포인트】
 * 1. Pub/Sub 구독
 *    - dashboard:update → 전체 갱신
 *    - dashboard:widget:invalidate → 특정 위젯 무효화
 *    - dashboard:kpi:update → KPI 즉시 갱신
 *    - dashboard:alert:new → 알람 추가
 * 
 * 2. 캐시 레이어
 *    - Redis GET/SET → 서버 사이드 캐시
 *    - Local Map → 클라이언트 사이드 캐시
 *    - TTL 동기화 → Redis TTL과 로컬 TTL 일치
 * 
 * 【캐시 갱신 전략】
 * 1. Stale-while-revalidate
 *    - 만료된 데이터 즉시 반환
 *    - 백그라운드에서 새 데이터 로드
 *    - 새 데이터 도착 시 UI 갱신
 * 
 * 2. Cache-aside
 *    - 캐시 미스 시 API 호출
 *    - 결과를 캐시에 저장
 *    - 다음 요청에서 캐시 히트
 * 
 * 3. Write-through (Redis)
 *    - 데이터 변경 시 Redis에 즉시 반영
 *    - 모든 클라이언트가 동일 데이터 참조
 */
export class DashboardDataLoader extends IDataLoader {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.apiClient - API 클라이언트
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     * @param {Object} [options.redisConfig] - Redis 설정
     * @param {Object} [options.config] - 추가 설정
     */
    constructor(options = {}) {
        super(options);
        
        // 의존성
        this.apiClient = options.apiClient || null;
        this.eventBus = options.eventBus || null;
        this.redisConfig = options.redisConfig || null;
        
        // 설정 병합
        this.config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
        
        // 상태
        this._state = DataLoaderState.IDLE;
        this._isLoading = false;
        this._lastLoadTime = null;
        this._lastError = null;
        
        // 위젯 데이터 저장소
        this._widgetData = new Map();
        this._widgetMetadata = new Map();
        
        // 캐시 (인메모리)
        this._cache = new Map();
        this._cacheTimestamps = new Map();
        
        // Redis 연결 상태
        this._redisState = {
            isConnected: false,
            lastConnectedAt: null,
            reconnectAttempts: 0,
            subscribedChannels: new Set()
        };
        
        // 폴링 타이머
        this._pollingTimers = new Map();
        
        // 배치 로딩 큐
        this._batchQueue = [];
        this._batchTimer = null;
        
        // 이벤트 리스너
        this._listeners = new Map();
        
        // 위젯 설정
        this._widgetConfigs = new Map();
        
        this._log('DashboardDataLoader initialized (skeleton)');
    }
    
    // ===============================================
    // IDataLoader 구현 - 필수 메서드
    // ===============================================
    
    /**
     * 대시보드 데이터 로드
     * 
     * @override
     * @param {Object} [options] - 로드 옵션
     * @param {string[]} [options.widgets] - 로드할 위젯 목록
     * @param {string} [options.siteId] - 사이트 ID
     * @param {boolean} [options.forceRefresh=false] - 강제 새로고침
     * @param {boolean} [options.useCache=true] - 캐시 사용 여부
     * @returns {Promise<LoadResult>}
     * 
     * 【로드 전략】
     * 1. 요청된 위젯 목록 확인
     * 2. 캐시 히트 체크 (TTL 기반)
     * 3. 캐시 미스 위젯만 API 호출
     * 4. 배치 로딩으로 네트워크 최적화
     * 5. 결과 캐싱 및 반환
     */
    async load(options = {}) {
        // TODO: 구현 예정
        // 
        // 1. 위젯 목록 결정
        //    const widgets = options.widgets || this._getActiveWidgets();
        // 
        // 2. 캐시 체크 및 분류
        //    const { cached, needsLoad } = this._classifyWidgets(widgets, options);
        // 
        // 3. 배치 로딩
        //    if (needsLoad.length > 0) {
        //        await this._batchLoadWidgets(needsLoad, options);
        //    }
        // 
        // 4. 결과 조합
        //    const result = this._combineWidgetData(widgets);
        // 
        // 5. 폴링 시작 (자동 갱신)
        //    this._startPollingForWidgets(widgets);
        
        this._log('load() called - skeleton implementation');
        this._setState(DataLoaderState.LOADING);
        this._isLoading = true;
        
        try {
            // 스켈레톤: 빈 데이터 반환
            await this._simulateDelay(100);
            
            const widgets = options.widgets || Object.values(WidgetType);
            
            this._setState(DataLoaderState.READY);
            this._lastLoadTime = Date.now();
            
            return {
                success: true,
                widgets: widgets.map(w => ({ id: w, data: null })),
                message: 'Skeleton implementation - no actual data loaded'
            };
            
        } catch (error) {
            this._handleError(error);
            return { success: false, error: error.message };
            
        } finally {
            this._isLoading = false;
        }
    }
    
    /**
     * 로더 시작
     * 
     * @override
     * @returns {Promise<void>}
     * 
     * 【시작 절차】
     * 1. Redis 연결 (Pub/Sub)
     * 2. 초기 데이터 로드
     * 3. 폴링 타이머 시작
     * 4. 이벤트 구독 설정
     */
    async start() {
        // TODO: 구현 예정
        // 
        // 【Redis 연결】
        // await this._connectToRedis();
        // await this._subscribeToChannels([
        //     RedisChannel.DASHBOARD_UPDATE,
        //     RedisChannel.WIDGET_INVALIDATE,
        //     RedisChannel.KPI_UPDATE,
        //     RedisChannel.ALERT_NEW
        // ]);
        // 
        // 【초기 데이터 로드】
        // await this.load({ widgets: this._getCriticalWidgets() });
        // 
        // 【폴링 시작】
        // this._startAllPolling();
        
        this._log('start() called - skeleton implementation');
        this._setState(DataLoaderState.READY);
        this._emitEvent(DataLoaderEvents.STARTED, { timestamp: Date.now() });
    }
    
    /**
     * 로더 중지
     * 
     * @override
     * @returns {Promise<void>}
     */
    async stop() {
        // TODO: 구현 예정
        // 
        // 【정리 절차】
        // 1. 폴링 타이머 중지
        // 2. Redis 구독 해제
        // 3. Redis 연결 종료
        // 4. 배치 큐 비우기
        
        this._log('stop() called - skeleton implementation');
        
        // 폴링 중지
        this._stopAllPolling();
        
        // 배치 타이머 취소
        if (this._batchTimer) {
            clearTimeout(this._batchTimer);
            this._batchTimer = null;
        }
        
        this._setState(DataLoaderState.STOPPED);
        this._emitEvent(DataLoaderEvents.STOPPED, { timestamp: Date.now() });
    }
    
    /**
     * 리소스 정리
     * 
     * @override
     */
    dispose() {
        this._log('dispose() called');
        
        // 로더 중지
        this.stop();
        
        // 캐시 정리
        this.clearCache();
        
        // 위젯 데이터 정리
        this._widgetData.clear();
        this._widgetMetadata.clear();
        this._widgetConfigs.clear();
        
        // 이벤트 리스너 정리
        this._listeners.clear();
        
        this._setState(DataLoaderState.DISPOSED);
    }
    
    // ===============================================
    // IDataLoader 구현 - 상태 메서드
    // ===============================================
    
    /**
     * 현재 상태 반환
     * @override
     * @returns {string}
     */
    getState() {
        return this._state;
    }
    
    /**
     * 로딩 중 여부
     * @override
     * @returns {boolean}
     */
    isLoading() {
        return this._isLoading;
    }
    
    /**
     * 마지막 오류
     * @override
     * @returns {Error|null}
     */
    getLastError() {
        return this._lastError;
    }
    
    // ===============================================
    // IDataLoader 구현 - 이벤트 메서드
    // ===============================================
    
    /**
     * 이벤트 리스너 등록
     * @override
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }
    
    /**
     * 이벤트 리스너 해제
     * @override
     */
    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }
    
    // ===============================================
    // 위젯 데이터 로드 메서드
    // ===============================================
    
    /**
     * 단일 위젯 데이터 로드
     * 
     * @param {string} widgetId - 위젯 ID
     * @param {Object} [options] - 옵션
     * @returns {Promise<WidgetResult>}
     * 
     * 【캐시 전략】
     * 1. 캐시 TTL 체크
     * 2. TTL 유효 → 캐시 반환
     * 3. TTL 만료 → API 호출 + 캐싱
     * 4. Stale-while-revalidate 지원
     */
    async loadWidget(widgetId, options = {}) {
        // TODO: 구현 예정
        // 
        // 【Cache-aside 패턴】
        // const cacheKey = this._generateWidgetCacheKey(widgetId, options);
        // 
        // // 캐시 체크
        // if (!options.forceRefresh) {
        //     const cached = this._getFromCache(cacheKey);
        //     if (cached && !this._isCacheExpired(cacheKey)) {
        //         return { success: true, data: cached, fromCache: true };
        //     }
        // }
        // 
        // // API 호출
        // const data = await this._fetchWidgetData(widgetId, options);
        // 
        // // 캐싱
        // this._setToCache(cacheKey, data, this._getWidgetTTL(widgetId));
        // 
        // return { success: true, data, fromCache: false };
        
        this._log(`loadWidget() called - widgetId: ${widgetId}`);
        
        // 스켈레톤 구현
        return {
            success: true,
            widgetId,
            data: null,
            fromCache: false,
            message: 'Skeleton implementation'
        };
    }
    
    /**
     * 다중 위젯 배치 로드
     * 
     * @param {string[]} widgetIds - 위젯 ID 목록
     * @param {Object} [options] - 옵션
     * @returns {Promise<BatchResult>}
     * 
     * 【배치 최적화】
     * 1. 위젯 그룹화 (동일 엔드포인트)
     * 2. 병렬 요청 (Promise.all)
     * 3. 실패 위젯 재시도
     */
    async loadWidgets(widgetIds, options = {}) {
        // TODO: 구현 예정
        // 
        // 【배치 로딩 전략】
        // const groups = this._groupWidgetsByEndpoint(widgetIds);
        // 
        // const results = await Promise.allSettled(
        //     groups.map(group => this._loadWidgetGroup(group, options))
        // );
        // 
        // return this._processBatchResults(results, widgetIds);
        
        this._log(`loadWidgets() called - ${widgetIds.length} widgets`);
        
        // 스켈레톤: 개별 로드
        const results = await Promise.all(
            widgetIds.map(id => this.loadWidget(id, options))
        );
        
        return {
            success: true,
            results,
            successCount: results.filter(r => r.success).length,
            failCount: results.filter(r => !r.success).length
        };
    }
    
    /**
     * 위젯 데이터 조회 (캐시 우선)
     * 
     * @param {string} widgetId - 위젯 ID
     * @returns {Object|null}
     */
    getWidgetData(widgetId) {
        return this._widgetData.get(widgetId) || null;
    }
    
    /**
     * 위젯 갱신
     * 
     * @param {string} widgetId - 위젯 ID
     * @param {Object} [options] - 옵션
     * @returns {Promise<WidgetResult>}
     */
    async refreshWidget(widgetId, options = {}) {
        return this.loadWidget(widgetId, { ...options, forceRefresh: true });
    }
    
    // ===============================================
    // Redis 연결 메서드 (스켈레톤)
    // ===============================================
    
    /**
     * Redis 연결
     * 
     * @returns {Promise<void>}
     * 
     * 【Redis 연결 포인트】
     * 
     * [옵션 1: 직접 연결 (브라우저 미지원)]
     * - Node.js 환경에서만 가능
     * - ioredis 또는 redis 패키지 사용
     * 
     * [옵션 2: WebSocket 브릿지 (권장)]
     * - Backend에서 Redis → WebSocket 변환
     * - 클라이언트는 WebSocket으로 수신
     * - 예: Socket.IO + redis adapter
     * 
     * [옵션 3: SSE (Server-Sent Events)]
     * - Backend에서 Redis 구독
     * - SSE로 클라이언트에 푸시
     * - 단방향, 간단한 구현
     * 
     * 【구현 예시 - WebSocket 브릿지】
     * ```javascript
     * const ws = new WebSocket('wss://api/dashboard/stream');
     * ws.onmessage = (event) => {
     *     const { channel, data } = JSON.parse(event.data);
     *     this._handleRedisMessage(channel, data);
     * };
     * ```
     */
    async connectToRedis() {
        // TODO: 구현 예정
        // 
        // 【WebSocket 브릿지 연결】
        // this._redisWs = new WebSocket(this._getRedisWsUrl());
        // 
        // this._redisWs.onopen = () => {
        //     this._redisState.isConnected = true;
        //     this._redisState.lastConnectedAt = Date.now();
        //     this._redisState.reconnectAttempts = 0;
        //     this._emitEvent('redis:connected');
        // };
        // 
        // this._redisWs.onmessage = (event) => {
        //     this._handleRedisMessage(event);
        // };
        // 
        // this._redisWs.onclose = () => {
        //     this._handleRedisDisconnect();
        // };
        // 
        // this._redisWs.onerror = (error) => {
        //     this._handleRedisError(error);
        // };
        
        this._log('connectToRedis() called - skeleton implementation');
        this._redisState.isConnected = false;
    }
    
    /**
     * Redis 채널 구독
     * 
     * @param {string[]} channels - 구독할 채널 목록
     * @returns {Promise<void>}
     * 
     * 【Redis Pub/Sub 채널】
     * - dashboard:update        → 전체 대시보드 갱신 신호
     * - dashboard:widget:{id}   → 특정 위젯 데이터 푸시
     * - dashboard:invalidate    → 캐시 무효화 신호
     * - dashboard:kpi:update    → KPI 실시간 업데이트
     * - dashboard:alert:new     → 새 알람 알림
     */
    async subscribeToChannels(channels) {
        // TODO: 구현 예정
        // 
        // 【WebSocket 구독 요청】
        // if (this._redisWs && this._redisWs.readyState === WebSocket.OPEN) {
        //     this._redisWs.send(JSON.stringify({
        //         action: 'subscribe',
        //         channels: channels
        //     }));
        //     channels.forEach(ch => this._redisState.subscribedChannels.add(ch));
        // }
        
        this._log(`subscribeToChannels() called - ${channels.join(', ')}`);
        channels.forEach(ch => this._redisState.subscribedChannels.add(ch));
    }
    
    /**
     * Redis 채널 구독 해제
     * 
     * @param {string[]} channels - 해제할 채널 목록
     * @returns {Promise<void>}
     */
    async unsubscribeFromChannels(channels) {
        // TODO: 구현 예정
        
        this._log(`unsubscribeFromChannels() called - ${channels.join(', ')}`);
        channels.forEach(ch => this._redisState.subscribedChannels.delete(ch));
    }
    
    /**
     * Redis 연결 상태 조회
     * @returns {Object}
     */
    getRedisState() {
        return { ...this._redisState };
    }
    
    // ===============================================
    // 캐시 관리 메서드
    // ===============================================
    
    /**
     * 캐시에서 조회
     * 
     * @param {string} key - 캐시 키
     * @returns {Object|null}
     * 
     * 【캐시 조회 로직】
     * 1. 캐시 존재 확인
     * 2. TTL 체크
     * 3. 만료 시 null 반환 (또는 stale 반환)
     */
    getFromCache(key) {
        if (!this._cache.has(key)) {
            return null;
        }
        
        const timestamp = this._cacheTimestamps.get(key);
        const ttl = this._getCacheTTL(key);
        
        // TTL 만료 체크
        if (timestamp && ttl && (Date.now() - timestamp > ttl)) {
            // 만료됨
            return null;
        }
        
        return this._cache.get(key);
    }
    
    /**
     * 캐시에 저장
     * 
     * @param {string} key - 캐시 키
     * @param {Object} data - 데이터
     * @param {number} [ttl] - TTL (ms)
     * 
     * 【TTL 전략】
     * - 위젯 타입별 기본 TTL 적용
     * - 우선순위가 높을수록 짧은 TTL
     * - 명시적 TTL 지정 가능
     */
    setToCache(key, data, ttl = null) {
        this._cache.set(key, data);
        this._cacheTimestamps.set(key, Date.now());
        
        // TTL 저장 (선택적)
        if (ttl) {
            // 메타데이터에 TTL 저장
        }
        
        // 메모리 관리
        this._evictCacheIfNeeded();
    }
    
    /**
     * 캐시 무효화
     * 
     * @param {string|string[]} keys - 무효화할 키 (또는 패턴)
     * 
     * 【무효화 전략】
     * 1. 단일 키 무효화
     * 2. 패턴 기반 무효화 (widget:* → 모든 위젯)
     * 3. 전체 무효화
     */
    invalidateCache(keys) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        
        keyList.forEach(key => {
            if (key.includes('*')) {
                // 패턴 매칭
                const pattern = new RegExp(key.replace(/\*/g, '.*'));
                for (const cacheKey of this._cache.keys()) {
                    if (pattern.test(cacheKey)) {
                        this._cache.delete(cacheKey);
                        this._cacheTimestamps.delete(cacheKey);
                    }
                }
            } else {
                this._cache.delete(key);
                this._cacheTimestamps.delete(key);
            }
        });
        
        this._log(`Cache invalidated: ${keyList.join(', ')}`);
    }
    
    /**
     * 전체 캐시 클리어
     */
    clearCache() {
        this._cache.clear();
        this._cacheTimestamps.clear();
        this._log('Cache cleared');
    }
    
    /**
     * 캐시 통계 조회
     * @returns {Object}
     */
    getCacheStats() {
        let totalSize = 0;
        let expiredCount = 0;
        const now = Date.now();
        
        for (const [key, timestamp] of this._cacheTimestamps) {
            const ttl = this._getCacheTTL(key);
            if (ttl && (now - timestamp > ttl)) {
                expiredCount++;
            }
            
            const data = this._cache.get(key);
            totalSize += this._estimateSize(data);
        }
        
        return {
            totalEntries: this._cache.size,
            expiredEntries: expiredCount,
            validEntries: this._cache.size - expiredCount,
            totalSize,
            maxSize: this.config.maxCacheSize,
            utilizationPercent: Math.round((totalSize / this.config.maxCacheSize) * 100)
        };
    }
    
    // ===============================================
    // 폴링 관리 메서드
    // ===============================================
    
    /**
     * 위젯 폴링 시작
     * 
     * @param {string} widgetId - 위젯 ID
     * @param {number} [interval] - 폴링 간격 (ms)
     * 
     * 【폴링 전략】
     * - 위젯 우선순위에 따른 간격 결정
     * - 페이지 비가시 시 폴링 일시 중지
     * - Redis 연결 시 폴링 → Push 전환
     */
    startPolling(widgetId, interval = null) {
        // TODO: 구현 예정
        // 
        // // 기존 타이머 정리
        // this.stopPolling(widgetId);
        // 
        // const pollInterval = interval || this._getPollingInterval(widgetId);
        // if (!pollInterval) return; // 폴링 안함
        // 
        // const timer = setInterval(async () => {
        //     if (document.hidden) return; // 페이지 비가시 시 스킵
        //     
        //     try {
        //         await this.refreshWidget(widgetId);
        //     } catch (error) {
        //         this._log(`Polling error for ${widgetId}: ${error.message}`);
        //     }
        // }, pollInterval);
        // 
        // this._pollingTimers.set(widgetId, timer);
        
        this._log(`startPolling() called - widgetId: ${widgetId}`);
    }
    
    /**
     * 위젯 폴링 중지
     * 
     * @param {string} widgetId - 위젯 ID
     */
    stopPolling(widgetId) {
        const timer = this._pollingTimers.get(widgetId);
        if (timer) {
            clearInterval(timer);
            this._pollingTimers.delete(widgetId);
            this._log(`Polling stopped for ${widgetId}`);
        }
    }
    
    /**
     * 모든 폴링 중지
     */
    _stopAllPolling() {
        for (const [widgetId, timer] of this._pollingTimers) {
            clearInterval(timer);
        }
        this._pollingTimers.clear();
        this._log('All polling stopped');
    }
    
    /**
     * 폴링 상태 조회
     * @returns {Object}
     */
    getPollingStatus() {
        const status = {};
        for (const widgetId of this._pollingTimers.keys()) {
            status[widgetId] = {
                active: true,
                interval: this._getPollingInterval(widgetId)
            };
        }
        return status;
    }
    
    // ===============================================
    // 위젯 설정 메서드
    // ===============================================
    
    /**
     * 위젯 설정 등록
     * 
     * @param {string} widgetId - 위젯 ID
     * @param {Object} config - 설정
     */
    registerWidget(widgetId, config = {}) {
        const defaultConfig = WIDGET_DEFAULTS[widgetId] || {
            priority: CachePriority.NORMAL,
            refreshStrategy: RefreshStrategy.ON_DEMAND,
            ttl: this.config.cacheTTL[CachePriority.NORMAL],
            autoRefresh: false
        };
        
        this._widgetConfigs.set(widgetId, {
            ...defaultConfig,
            ...config
        });
        
        this._log(`Widget registered: ${widgetId}`);
    }
    
    /**
     * 위젯 설정 조회
     * 
     * @param {string} widgetId - 위젯 ID
     * @returns {Object}
     */
    getWidgetConfig(widgetId) {
        return this._widgetConfigs.get(widgetId) || WIDGET_DEFAULTS[widgetId] || null;
    }
    
    /**
     * 위젯 설정 업데이트
     * 
     * @param {string} widgetId - 위젯 ID
     * @param {Object} updates - 업데이트 내용
     */
    updateWidgetConfig(widgetId, updates) {
        const current = this.getWidgetConfig(widgetId) || {};
        this._widgetConfigs.set(widgetId, { ...current, ...updates });
    }
    
    // ===============================================
    // 내부 메서드
    // ===============================================
    
    /**
     * 캐시 TTL 조회
     * @private
     */
    _getCacheTTL(key) {
        // 위젯 키에서 위젯 ID 추출
        const widgetId = key.split(':')[1]; // widget:{id}:...
        const config = this.getWidgetConfig(widgetId);
        
        if (config?.ttl) {
            return config.ttl;
        }
        
        // 우선순위 기반 기본 TTL
        const priority = config?.priority || CachePriority.NORMAL;
        return this.config.cacheTTL[priority];
    }
    
    /**
     * 폴링 간격 조회
     * @private
     */
    _getPollingInterval(widgetId) {
        const config = this.getWidgetConfig(widgetId);
        
        // 폴링 전략이 아니면 null 반환
        if (config?.refreshStrategy !== RefreshStrategy.POLLING &&
            config?.refreshStrategy !== RefreshStrategy.HYBRID) {
            return null;
        }
        
        const priority = config?.priority || CachePriority.NORMAL;
        return this.config.pollingInterval[priority];
    }
    
    /**
     * 캐시 키 생성
     * @private
     */
    _generateWidgetCacheKey(widgetId, options = {}) {
        const parts = ['widget', widgetId];
        
        if (options.siteId) parts.push(options.siteId);
        if (options.dateRange) {
            parts.push(options.dateRange.start);
            parts.push(options.dateRange.end);
        }
        
        return parts.join(':');
    }
    
    /**
     * 상태 변경
     * @private
     */
    _setState(state) {
        const prevState = this._state;
        this._state = state;
        
        this._emitEvent(DataLoaderEvents.STATE_CHANGED, {
            prevState,
            newState: state
        });
    }
    
    /**
     * 이벤트 발행
     * @private
     */
    _emitEvent(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[DashboardDataLoader] Event callback error:`, e);
                }
            });
        }
        
        // EventBus로도 발행
        if (this.eventBus) {
            this.eventBus.emit(`dashboard:${event}`, data);
        }
    }
    
    /**
     * 에러 처리
     * @private
     */
    _handleError(error) {
        this._lastError = error;
        this._setState(DataLoaderState.ERROR);
        this._emitEvent(DataLoaderEvents.ERROR, { error });
        console.error('[DashboardDataLoader] Error:', error);
    }
    
    /**
     * 캐시 용량 관리
     * @private
     */
    _evictCacheIfNeeded() {
        const stats = this.getCacheStats();
        
        if (stats.totalSize > this.config.maxCacheSize) {
            // LRU: 가장 오래된 항목 제거
            let oldestKey = null;
            let oldestTime = Infinity;
            
            for (const [key, timestamp] of this._cacheTimestamps) {
                if (timestamp < oldestTime) {
                    oldestTime = timestamp;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                this._cache.delete(oldestKey);
                this._cacheTimestamps.delete(oldestKey);
                this._log(`Cache evicted: ${oldestKey}`);
                
                // 재귀적 확인
                this._evictCacheIfNeeded();
            }
        }
    }
    
    /**
     * 데이터 크기 추정
     * @private
     */
    _estimateSize(data) {
        try {
            return JSON.stringify(data).length * 2;
        } catch {
            return 0;
        }
    }
    
    /**
     * 딜레이 시뮬레이션
     * @private
     */
    _simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 로그 출력
     * @private
     */
    _log(message) {
        if (this.config.debug) {
            console.log(`[DashboardDataLoader] ${message}`);
        }
        debugLog(`[DashboardDataLoader] ${message}`);
    }
    
    // ===============================================
    // 정적 메서드
    // ===============================================
    
    /**
     * 기본 설정 조회
     * @returns {Object}
     */
    static getDefaultConfig() {
        return { ...DEFAULT_CONFIG };
    }
    
    /**
     * 위젯 타입 목록
     * @returns {Object}
     */
    static getWidgetTypes() {
        return WidgetType;
    }
    
    /**
     * 캐시 우선순위 목록
     * @returns {Object}
     */
    static getCachePriorities() {
        return CachePriority;
    }
    
    /**
     * 갱신 전략 목록
     * @returns {Object}
     */
    static getRefreshStrategies() {
        return RefreshStrategy;
    }
    
    /**
     * Redis 채널 목록
     * @returns {Object}
     */
    static getRedisChannels() {
        return RedisChannel;
    }
}

// ============================================
// 기본 export
// ============================================

export default DashboardDataLoader;