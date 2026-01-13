/**
 * AnalysisDataLoader.js
 * =====================
 * 
 * Analysis 모드용 DataLoader (스켈레톤)
 * IDataLoader 인터페이스 구현
 * 
 * @version 1.0.0 (스켈레톤)
 * @module AnalysisDataLoader
 * @implements {IDataLoader}
 * 
 * @description
 * Analysis 모드에서 대용량 설비 데이터를 효율적으로 로드합니다.
 * - 대용량 쿼리 최적화 (Pagination, Streaming)
 * - 시계열 데이터 처리 (TimescaleDB)
 * - 캐싱 전략 (프론트엔드 필터링 지원)
 * - 날짜 범위 기반 쿼리
 * 
 * 위치: frontend/threejs_viewer/src/services/loaders/AnalysisDataLoader.js
 * 
 * @example
 * const loader = new AnalysisDataLoader({
 *     apiClient: apiClient,
 *     eventBus: eventBus,
 *     cacheManager: cacheManager
 * });
 * 
 * // 데이터 로드
 * await loader.load({
 *     dateRange: { start: '2025-01-01', end: '2025-01-31' },
 *     equipmentIds: ['EQ001', 'EQ002'],
 *     eventTypes: ['SUDDENSTOP', 'ALARM']
 * });
 */

import { IDataLoader, DataLoaderState, DataLoaderEvents } from './IDataLoader.js';
import { debugLog } from '../../core/utils/Config.js';

// ============================================
// 상수 정의
// ============================================

/**
 * Analysis 데이터 타입
 */
export const AnalysisDataType = Object.freeze({
    EQUIPMENT_EVENTS: 'equipment_events',       // 설비 이벤트 (SUDDENSTOP 등)
    STATUS_HISTORY: 'status_history',           // 상태 이력
    ALARM_LOGS: 'alarm_logs',                   // 알람 로그
    PRODUCTION_METRICS: 'production_metrics',   // 생산 지표
    SHIFT_ANALYSIS: 'shift_analysis',           // 근무조 분석
    DOWNTIME_SUMMARY: 'downtime_summary'        // 다운타임 요약
});

/**
 * 캐시 키 프리픽스
 */
const CACHE_PREFIX = 'analysis';

/**
 * 기본 설정
 */
const DEFAULT_CONFIG = {
    // 페이지네이션
    defaultPageSize: 1000,
    maxPageSize: 10000,
    
    // 스트리밍
    streamChunkSize: 500,
    enableStreaming: true,
    
    // 캐시
    enableCache: true,
    cacheTTL: 5 * 60 * 1000,        // 5분
    maxCacheSize: 50 * 1024 * 1024,  // 50MB
    
    // 타임아웃
    queryTimeout: 60000,             // 60초 (대용량 쿼리)
    connectionTimeout: 10000,
    
    // 재시도
    maxRetries: 2,
    retryDelay: 2000,
    
    // 최적화
    enableCompression: true,
    enableParallelQueries: true,
    maxParallelQueries: 3
};

// ============================================
// AnalysisDataLoader 클래스
// ============================================

/**
 * Analysis 모드용 DataLoader
 * 
 * @class AnalysisDataLoader
 * @implements {IDataLoader}
 * 
 * 【최적화 포인트】
 * 1. 대용량 데이터 처리
 *    - Pagination: 대량 데이터를 페이지 단위로 분할 로드
 *    - Streaming: 실시간 청크 단위 데이터 수신
 *    - Cursor-based: 커서 기반 페이지네이션 (성능 우수)
 * 
 * 2. 캐싱 전략
 *    - Query-level Cache: 동일 쿼리 결과 캐싱
 *    - Time-based Invalidation: TTL 기반 캐시 무효화
 *    - Memory Management: 메모리 사용량 제한
 * 
 * 3. 쿼리 최적화
 *    - Date Range Partitioning: 날짜 범위 분할 쿼리
 *    - Index Hint: 인덱스 힌트 활용
 *    - Parallel Queries: 병렬 쿼리 실행
 */
export class AnalysisDataLoader extends IDataLoader {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.apiClient - API 클라이언트
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     * @param {Object} [options.cacheManager] - 캐시 매니저
     * @param {Object} [options.config] - 추가 설정
     */
    constructor(options = {}) {
        super(options);
        
        // 의존성
        this.apiClient = options.apiClient || null;
        this.eventBus = options.eventBus || null;
        this.cacheManager = options.cacheManager || null;
        
        // 설정 병합
        this.config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
        
        // 상태
        this._state = DataLoaderState.IDLE;
        this._isLoading = false;
        this._lastLoadTime = null;
        this._lastError = null;
        
        // 데이터 저장소
        this._data = {
            events: [],
            statusHistory: [],
            alarmLogs: [],
            productionMetrics: [],
            summary: null
        };
        
        // 현재 쿼리 컨텍스트
        this._currentQuery = null;
        this._abortController = null;
        
        // 캐시 (인메모리)
        this._cache = new Map();
        this._cacheMetadata = new Map();
        
        // 스트리밍 상태
        this._streamingState = {
            isStreaming: false,
            receivedChunks: 0,
            totalChunks: null,
            progress: 0
        };
        
        // 페이지네이션 상태
        this._paginationState = {
            currentPage: 0,
            totalPages: null,
            totalRecords: null,
            hasMore: false,
            cursor: null
        };
        
        // 이벤트 리스너
        this._listeners = new Map();
        
        this._log('AnalysisDataLoader initialized (skeleton)');
    }
    
    // ===============================================
    // IDataLoader 구현 - 필수 메서드
    // ===============================================
    
    /**
     * 데이터 로드
     * 
     * @override
     * @param {Object} [options] - 로드 옵션
     * @param {Object} [options.dateRange] - 날짜 범위 { start, end }
     * @param {string[]} [options.equipmentIds] - 설비 ID 목록
     * @param {string[]} [options.eventTypes] - 이벤트 타입 목록
     * @param {string} [options.dataType] - 데이터 타입 (AnalysisDataType)
     * @param {boolean} [options.useCache=true] - 캐시 사용 여부
     * @param {boolean} [options.forceRefresh=false] - 강제 새로고침
     * @returns {Promise<LoadResult>}
     * 
     * 【최적화 포인트】
     * - 날짜 범위가 넓으면 분할 쿼리 고려
     * - 캐시 히트 시 빠른 반환
     * - 대용량 데이터는 스트리밍/페이지네이션 사용
     */
    async load(options = {}) {
        // TODO: 구현 예정
        // 
        // 1. 캐시 체크
        //    const cacheKey = this._generateCacheKey(options);
        //    if (options.useCache !== false && !options.forceRefresh) {
        //        const cached = this._getFromCache(cacheKey);
        //        if (cached) return { success: true, data: cached, fromCache: true };
        //    }
        // 
        // 2. 쿼리 준비
        //    this._currentQuery = this._buildQuery(options);
        //    this._abortController = new AbortController();
        // 
        // 3. 데이터 로드 전략 결정
        //    - 예상 레코드 수 < 1000: 단일 쿼리
        //    - 예상 레코드 수 < 10000: 페이지네이션
        //    - 예상 레코드 수 >= 10000: 스트리밍
        // 
        // 4. API 호출
        //    const response = await this._executeQuery(options);
        // 
        // 5. 데이터 처리 및 캐싱
        //    this._processData(response);
        //    this._setToCache(cacheKey, this._data);
        // 
        // 6. 결과 반환
        
        this._log('load() called - skeleton implementation');
        this._setState(DataLoaderState.LOADING);
        this._isLoading = true;
        
        try {
            // 스켈레톤: 빈 데이터 반환
            await this._simulateDelay(100);
            
            this._setState(DataLoaderState.READY);
            this._lastLoadTime = Date.now();
            
            return {
                success: true,
                data: this._data,
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
     */
    async start() {
        // TODO: 구현 예정
        // - 초기 연결 확인
        // - 기본 데이터 로드
        // - 이벤트 구독 설정
        
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
        // - 진행 중인 쿼리 취소
        // - 스트리밍 중지
        // - 리소스 정리
        
        this._log('stop() called - skeleton implementation');
        
        // 진행 중인 요청 취소
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
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
        
        // 진행 중인 요청 취소
        this.stop();
        
        // 캐시 정리
        this.clearCache();
        
        // 이벤트 리스너 정리
        this._listeners.clear();
        
        // 데이터 정리
        this._data = null;
        this._currentQuery = null;
        
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
    // 페이지네이션 메서드 (Pagination)
    // ===============================================
    
    /**
     * 페이지네이션으로 데이터 로드
     * 
     * @param {Object} options - 쿼리 옵션
     * @param {number} [page=1] - 페이지 번호
     * @param {number} [pageSize] - 페이지 크기
     * @returns {Promise<PaginatedResult>}
     * 
     * 【최적화 포인트】
     * - Offset-based: 간단하지만 대용량에서 느림
     * - Cursor-based: 대용량에서 성능 우수 (권장)
     * - Keyset: 정렬 키 기반, 일관된 성능
     */
    async loadPage(options = {}, page = 1, pageSize = null) {
        // TODO: 구현 예정
        // 
        // 【Offset-based Pagination】
        // const offset = (page - 1) * pageSize;
        // const query = `
        //     SELECT * FROM equipment_events
        //     WHERE timestamp BETWEEN :start AND :end
        //     ORDER BY timestamp DESC
        //     LIMIT :pageSize OFFSET :offset
        // `;
        // 
        // 【Cursor-based Pagination (권장)】
        // const query = `
        //     SELECT * FROM equipment_events
        //     WHERE timestamp BETWEEN :start AND :end
        //       AND (timestamp, id) < (:cursorTime, :cursorId)
        //     ORDER BY timestamp DESC, id DESC
        //     LIMIT :pageSize
        // `;
        
        this._log(`loadPage() called - page: ${page}, pageSize: ${pageSize || this.config.defaultPageSize}`);
        
        // 스켈레톤 구현
        return {
            success: true,
            data: [],
            pagination: {
                currentPage: page,
                pageSize: pageSize || this.config.defaultPageSize,
                totalPages: 0,
                totalRecords: 0,
                hasNext: false,
                hasPrev: page > 1
            }
        };
    }
    
    /**
     * 다음 페이지 로드
     * @returns {Promise<PaginatedResult>}
     */
    async loadNextPage() {
        // TODO: 구현 예정
        
        if (!this._paginationState.hasMore) {
            return { success: false, error: 'No more pages' };
        }
        
        return this.loadPage(
            this._currentQuery,
            this._paginationState.currentPage + 1
        );
    }
    
    /**
     * 이전 페이지 로드
     * @returns {Promise<PaginatedResult>}
     */
    async loadPrevPage() {
        // TODO: 구현 예정
        
        if (this._paginationState.currentPage <= 1) {
            return { success: false, error: 'Already at first page' };
        }
        
        return this.loadPage(
            this._currentQuery,
            this._paginationState.currentPage - 1
        );
    }
    
    /**
     * 특정 페이지로 이동
     * @param {number} page - 페이지 번호
     * @returns {Promise<PaginatedResult>}
     */
    async goToPage(page) {
        return this.loadPage(this._currentQuery, page);
    }
    
    /**
     * 페이지네이션 상태 조회
     * @returns {Object}
     */
    getPaginationState() {
        return { ...this._paginationState };
    }
    
    // ===============================================
    // 스트리밍 메서드 (Streaming)
    // ===============================================
    
    /**
     * 스트리밍으로 데이터 로드
     * 
     * @param {Object} options - 쿼리 옵션
     * @param {Function} onChunk - 청크 수신 콜백
     * @param {Function} [onProgress] - 진행률 콜백
     * @returns {Promise<StreamResult>}
     * 
     * 【최적화 포인트】
     * - Server-Sent Events (SSE): 서버 → 클라이언트 단방향
     * - WebSocket Streaming: 양방향, 실시간
     * - Chunked Transfer: HTTP chunked encoding
     * - NDJSON Streaming: 줄바꿈 구분 JSON
     */
    async loadStream(options = {}, onChunk, onProgress = null) {
        // TODO: 구현 예정
        // 
        // 【SSE 기반 스트리밍】
        // const eventSource = new EventSource(`/api/analysis/stream?${queryParams}`);
        // eventSource.onmessage = (event) => {
        //     const chunk = JSON.parse(event.data);
        //     onChunk(chunk);
        //     this._updateStreamProgress(chunk);
        // };
        // 
        // 【Fetch + ReadableStream】
        // const response = await fetch(url, { signal: this._abortController.signal });
        // const reader = response.body.getReader();
        // while (true) {
        //     const { done, value } = await reader.read();
        //     if (done) break;
        //     const chunk = this._decodeChunk(value);
        //     onChunk(chunk);
        // }
        
        this._log('loadStream() called - skeleton implementation');
        
        this._streamingState = {
            isStreaming: true,
            receivedChunks: 0,
            totalChunks: null,
            progress: 0
        };
        
        // 스켈레톤: 빈 스트림 시뮬레이션
        await this._simulateDelay(100);
        
        this._streamingState.isStreaming = false;
        
        return {
            success: true,
            chunksReceived: 0,
            totalRecords: 0
        };
    }
    
    /**
     * 스트리밍 중지
     * @returns {void}
     */
    stopStream() {
        // TODO: 구현 예정
        
        this._log('stopStream() called');
        
        if (this._abortController) {
            this._abortController.abort();
        }
        
        this._streamingState.isStreaming = false;
        this._emitEvent(DataLoaderEvents.STREAM_STOPPED, {});
    }
    
    /**
     * 스트리밍 상태 조회
     * @returns {Object}
     */
    getStreamingState() {
        return { ...this._streamingState };
    }
    
    // ===============================================
    // 캐싱 메서드
    // ===============================================
    
    /**
     * 캐시에서 데이터 조회
     * 
     * @param {string} cacheKey - 캐시 키
     * @returns {Object|null}
     * 
     * 【캐싱 전략】
     * 1. Query-level Cache: 쿼리 파라미터 기반 키
     * 2. Time-based TTL: 시간 기반 만료
     * 3. Size-based Eviction: LRU 기반 용량 관리
     * 4. Stale-while-revalidate: 만료 데이터 반환 + 백그라운드 갱신
     */
    getFromCache(cacheKey) {
        // TODO: 구현 예정
        
        if (!this.config.enableCache) return null;
        
        const metadata = this._cacheMetadata.get(cacheKey);
        if (!metadata) return null;
        
        // TTL 체크
        if (Date.now() - metadata.timestamp > this.config.cacheTTL) {
            this._cache.delete(cacheKey);
            this._cacheMetadata.delete(cacheKey);
            return null;
        }
        
        return this._cache.get(cacheKey);
    }
    
    /**
     * 캐시에 데이터 저장
     * 
     * @param {string} cacheKey - 캐시 키
     * @param {Object} data - 저장할 데이터
     */
    setToCache(cacheKey, data) {
        // TODO: 구현 예정
        // - 용량 체크 및 LRU eviction
        
        if (!this.config.enableCache) return;
        
        this._cache.set(cacheKey, data);
        this._cacheMetadata.set(cacheKey, {
            timestamp: Date.now(),
            size: this._estimateSize(data)
        });
        
        // 캐시 용량 관리
        this._evictCacheIfNeeded();
    }
    
    /**
     * 캐시 키 생성
     * 
     * @param {Object} options - 쿼리 옵션
     * @returns {string}
     */
    generateCacheKey(options) {
        // TODO: 구현 예정
        
        const keyParts = [
            CACHE_PREFIX,
            options.dataType || 'default',
            options.dateRange?.start || '',
            options.dateRange?.end || '',
            (options.equipmentIds || []).sort().join(','),
            (options.eventTypes || []).sort().join(',')
        ];
        
        return keyParts.join(':');
    }
    
    /**
     * 캐시 클리어
     * @param {string} [pattern] - 삭제할 키 패턴 (없으면 전체)
     */
    clearCache(pattern = null) {
        if (pattern) {
            // 패턴 매칭 삭제
            for (const key of this._cache.keys()) {
                if (key.includes(pattern)) {
                    this._cache.delete(key);
                    this._cacheMetadata.delete(key);
                }
            }
        } else {
            // 전체 삭제
            this._cache.clear();
            this._cacheMetadata.clear();
        }
        
        this._log(`Cache cleared: ${pattern || 'all'}`);
    }
    
    /**
     * 캐시 통계
     * @returns {Object}
     */
    getCacheStats() {
        let totalSize = 0;
        for (const metadata of this._cacheMetadata.values()) {
            totalSize += metadata.size || 0;
        }
        
        return {
            entryCount: this._cache.size,
            totalSize,
            maxSize: this.config.maxCacheSize,
            utilizationPercent: Math.round((totalSize / this.config.maxCacheSize) * 100)
        };
    }
    
    // ===============================================
    // 쿼리 빌더 메서드
    // ===============================================
    
    /**
     * 날짜 범위 쿼리 빌드
     * 
     * @param {Object} dateRange - { start, end }
     * @param {Object} [options] - 추가 옵션
     * @returns {Object} 쿼리 객체
     * 
     * 【최적화 포인트】
     * - 날짜 범위가 넓으면 분할 쿼리 고려
     * - TimescaleDB hypertable 파티션 활용
     * - 인덱스 힌트 사용
     */
    buildDateRangeQuery(dateRange, options = {}) {
        // TODO: 구현 예정
        // 
        // 【분할 쿼리 전략】
        // - 7일 이하: 단일 쿼리
        // - 7-30일: 주 단위 분할
        // - 30일 이상: 월 단위 분할
        // 
        // 【TimescaleDB 최적화】
        // - time_bucket 함수 활용
        // - compress_chunk 고려
        // - continuous aggregate 활용
        
        return {
            type: 'date_range',
            start: dateRange.start,
            end: dateRange.end,
            ...options
        };
    }
    
    /**
     * 집계 쿼리 빌드
     * 
     * @param {string} aggregationType - 집계 타입
     * @param {Object} options - 옵션
     * @returns {Object} 쿼리 객체
     * 
     * 【집계 타입】
     * - hourly: 시간별 집계
     * - daily: 일별 집계
     * - weekly: 주별 집계
     * - monthly: 월별 집계
     * - by_equipment: 설비별 집계
     * - by_event_type: 이벤트 타입별 집계
     */
    buildAggregationQuery(aggregationType, options = {}) {
        // TODO: 구현 예정
        // 
        // 【TimescaleDB time_bucket 활용】
        // SELECT 
        //     time_bucket('1 hour', timestamp) AS bucket,
        //     equipment_id,
        //     COUNT(*) AS event_count,
        //     SUM(duration) AS total_duration
        // FROM equipment_events
        // WHERE timestamp BETWEEN :start AND :end
        // GROUP BY bucket, equipment_id
        // ORDER BY bucket DESC;
        
        return {
            type: 'aggregation',
            aggregationType,
            ...options
        };
    }
    
    // ===============================================
    // 데이터 변환 메서드
    // ===============================================
    
    /**
     * HeatMap 데이터 변환
     * 
     * @param {Array} rawData - 원본 데이터
     * @param {Object} options - 변환 옵션
     * @returns {Object} HeatMap 형식 데이터
     * 
     * 【출력 형식】
     * {
     *     xAxis: ['00:00', '01:00', ...],  // 시간
     *     yAxis: ['Mon', 'Tue', ...],      // 요일
     *     data: [[0, 0, 5], [0, 1, 3], ...] // [x, y, value]
     * }
     */
    transformToHeatMap(rawData, options = {}) {
        // TODO: 구현 예정
        
        this._log('transformToHeatMap() called - skeleton');
        
        return {
            xAxis: [],
            yAxis: [],
            data: []
        };
    }
    
    /**
     * 시계열 데이터 변환
     * 
     * @param {Array} rawData - 원본 데이터
     * @param {Object} options - 변환 옵션
     * @returns {Object} 시계열 형식 데이터
     * 
     * 【출력 형식 - ECharts 호환】
     * {
     *     timestamps: ['2025-01-01', '2025-01-02', ...],
     *     series: [
     *         { name: 'SUDDENSTOP', data: [5, 3, 8, ...] },
     *         { name: 'ALARM', data: [2, 1, 4, ...] }
     *     ]
     * }
     */
    transformToTimeSeries(rawData, options = {}) {
        // TODO: 구현 예정
        
        this._log('transformToTimeSeries() called - skeleton');
        
        return {
            timestamps: [],
            series: []
        };
    }
    
    /**
     * 요약 통계 계산
     * 
     * @param {Array} data - 데이터
     * @returns {Object} 요약 통계
     */
    calculateSummary(data) {
        // TODO: 구현 예정
        
        return {
            totalEvents: 0,
            uniqueEquipment: 0,
            eventsByType: {},
            averagePerDay: 0,
            peakHour: null,
            peakDay: null
        };
    }
    
    // ===============================================
    // 내부 메서드
    // ===============================================
    
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
                    console.error(`[AnalysisDataLoader] Event callback error:`, e);
                }
            });
        }
        
        // EventBus로도 발행
        if (this.eventBus) {
            this.eventBus.emit(`analysis:${event}`, data);
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
        console.error('[AnalysisDataLoader] Error:', error);
    }
    
    /**
     * 캐시 용량 관리 (LRU eviction)
     * @private
     */
    _evictCacheIfNeeded() {
        // TODO: 구현 예정
        // LRU 기반 캐시 제거
        
        const stats = this.getCacheStats();
        if (stats.totalSize > this.config.maxCacheSize) {
            // 가장 오래된 항목 제거
            let oldestKey = null;
            let oldestTime = Infinity;
            
            for (const [key, metadata] of this._cacheMetadata) {
                if (metadata.timestamp < oldestTime) {
                    oldestTime = metadata.timestamp;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                this._cache.delete(oldestKey);
                this._cacheMetadata.delete(oldestKey);
                this._log(`Cache evicted: ${oldestKey}`);
                
                // 재귀적으로 확인
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
            return JSON.stringify(data).length * 2; // UTF-16 추정
        } catch {
            return 0;
        }
    }
    
    /**
     * 딜레이 시뮬레이션 (스켈레톤용)
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
        debugLog(`[AnalysisDataLoader] ${message}`);
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
     * 데이터 타입 목록
     * @returns {Object}
     */
    static getDataTypes() {
        return AnalysisDataType;
    }
}

// ============================================
// 기본 export
// ============================================

export default AnalysisDataLoader;