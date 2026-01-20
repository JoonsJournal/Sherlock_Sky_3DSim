/**
 * UnifiedDataStore.js
 * ====================
 * 통합 데이터 스토어 - 설비 데이터 중앙 관리
 * 
 * @version 1.0.0
 * @description
 * - 117개 설비 메모리 캐시 (Map 기반)
 * - 초기 로드 1회 → 이후 Delta Update만 수신
 * - 설비 선택 시 캐시 조회 (< 5ms 목표)
 * - EventBus를 통한 데이터 변경 알림
 * - 상태 통계 자동 관리
 * 
 * @changelog
 * - v1.0.0: 초기 버전 (2026-01-20)
 *   - 초기화: initialize() - 전체 설비 로드 + WebSocket 연결
 *   - 데이터 접근: getEquipment(), getAllEquipments(), getEquipmentsByStatus()
 *   - 통계: getStatusStats(), getCacheHitRate()
 *   - Delta Update 자동 처리 (WebSocket)
 * 
 * @dependencies
 * - api/UDSApiClient.js
 * - core/managers/EventBus.js
 * 
 * @exports
 * - UnifiedDataStore (class)
 * - unifiedDataStore (singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/uds/UnifiedDataStore.js
 * 작성일: 2026-01-20
 * 수정일: 2026-01-20
 */

import { udsApiClient } from '../../api/UDSApiClient.js';
import { eventBus } from '../../core/managers/EventBus.js';

export class UnifiedDataStore {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * EventBus 이벤트 상수
     * 다른 컴포넌트에서 구독 시 사용
     * 
     * @example
     * eventBus.on(UnifiedDataStore.EVENTS.INITIALIZED, (data) => { ... });
     */
    static EVENTS = {
        /** 초기화 완료: { equipments, stats, loadTime } */
        INITIALIZED: 'uds:initialized',
        
        /** 단일 설비 업데이트: { frontendId, changes, equipment } */
        EQUIPMENT_UPDATED: 'uds:equipment:updated',
        
        /** 배치 업데이트 완료: { count, timestamp } */
        BATCH_UPDATED: 'uds:batch:updated',
        
        /** 통계 변경: { stats } */
        STATS_UPDATED: 'uds:stats:updated',
        
        /** 에러 발생: { error } */
        ERROR: 'uds:error',
        
        /** WebSocket 연결됨 */
        CONNECTED: 'uds:connected',
        
        /** WebSocket 연결 해제됨 */
        DISCONNECTED: 'uds:disconnected'
    };
    
    /**
     * 설비 상태 상수
     */
    static STATUS = {
        RUN: 'RUN',
        IDLE: 'IDLE',
        STOP: 'STOP',
        SUDDENSTOP: 'SUDDENSTOP',
        DISCONNECTED: 'DISCONNECTED'
    };
    
    // =========================================================================
    // Constructor
    // =========================================================================
    
    constructor() {
        /**
         * 설비 캐시 (frontend_id → EquipmentData)
         * @type {Map<string, Object>}
         */
        this._equipmentCache = new Map();
        
        /**
         * 상태 통계
         * @type {Object}
         */
        this._statusStats = {
            RUN: 0,
            IDLE: 0,
            STOP: 0,
            SUDDENSTOP: 0,
            DISCONNECTED: 0,
            TOTAL: 0
        };
        
        /**
         * 초기화 완료 여부
         * @type {boolean}
         */
        this._initialized = false;
        
        /**
         * 초기화 중 여부 (중복 초기화 방지)
         * @type {boolean}
         */
        this._initializing = false;
        
        /**
         * 캐시 히트 카운트 (Performance Monitor용)
         * @type {number}
         */
        this._cacheHits = 0;
        
        /**
         * 캐시 미스 카운트
         * @type {number}
         */
        this._cacheMisses = 0;
        
        /**
         * Delta 업데이트 카운트
         * @type {number}
         */
        this._deltaCount = 0;
        
        /**
         * 초기 로드 시간 (ms)
         * @type {number}
         */
        this._loadTime = 0;
        
        /**
         * 초기화 파라미터 저장
         * @type {Object|null}
         */
        this._initParams = null;
        
        console.log('🚀 [UDS] UnifiedDataStore 생성됨');
    }
    
    // =========================================================================
    // Initialization
    // =========================================================================
    
    /**
     * UDS 초기화 - 전체 설비 데이터 로드 및 WebSocket 연결
     * 
     * @param {Object} [params={}] - 초기화 파라미터
     * @param {number} [params.siteId=1] - Site ID
     * @param {number} [params.lineId=1] - Line ID
     * @returns {Promise<Object[]>} 로드된 설비 배열
     * @throws {Error} 초기화 실패 시
     * 
     * @example
     * const equipments = await unifiedDataStore.initialize({ siteId: 1, lineId: 1 });
     * console.log(`${equipments.length}개 설비 로드됨`);
     */
    async initialize(params = {}) {
        // 중복 초기화 방지
        if (this._initializing) {
            console.warn('⚠️ [UDS] 이미 초기화 진행 중');
            return this.getAllEquipments();
        }
        
        // 이미 초기화된 경우 재초기화 (파라미터가 다를 때만)
        if (this._initialized) {
            const sameParams = 
                this._initParams?.siteId === params.siteId &&
                this._initParams?.lineId === params.lineId;
            
            if (sameParams) {
                console.log('📌 [UDS] 이미 초기화됨, 캐시 데이터 반환');
                return this.getAllEquipments();
            }
            
            // 다른 파라미터로 재초기화
            console.log('🔄 [UDS] 다른 파라미터로 재초기화');
            this._reset();
        }
        
        this._initializing = true;
        this._initParams = params;
        
        const startTime = performance.now();
        
        console.log('📡 [UDS] 초기화 시작...');
        console.log(`   └─ Site ID: ${params.siteId || 1}`);
        console.log(`   └─ Line ID: ${params.lineId || 1}`);
        
        try {
            // 1. 초기 데이터 로드
            const response = await udsApiClient.fetchInitialData(params);
            
            // 2. 캐시 구축
            this._buildCache(response.equipments);
            
            // 3. 통계 저장
            this._statusStats = { ...response.stats };
            
            // 4. WebSocket 연결
            this._connectWebSocket(params);
            
            // 5. 초기화 완료
            this._initialized = true;
            this._initializing = false;
            this._loadTime = performance.now() - startTime;
            
            console.log(`✅ [UDS] 초기화 완료`);
            console.log(`   └─ 설비 수: ${response.total_count}개`);
            console.log(`   └─ 캐시 크기: ${this._equipmentCache.size}개`);
            console.log(`   └─ 소요 시간: ${this._loadTime.toFixed(2)}ms`);
            console.log(`   └─ 상태 분포: RUN=${this._statusStats.RUN}, IDLE=${this._statusStats.IDLE}, STOP=${this._statusStats.STOP}`);
            
            // 6. 초기화 완료 이벤트 발행
            eventBus.emit(UnifiedDataStore.EVENTS.INITIALIZED, {
                equipments: response.equipments,
                stats: this._statusStats,
                loadTime: this._loadTime,
                totalCount: response.total_count
            });
            
            return response.equipments;
            
        } catch (error) {
            this._initializing = false;
            console.error('❌ [UDS] 초기화 실패:', error);
            
            eventBus.emit(UnifiedDataStore.EVENTS.ERROR, { 
                error,
                phase: 'initialization'
            });
            
            throw error;
        }
    }
    
    // =========================================================================
    // Data Access (Cache)
    // =========================================================================
    
    /**
     * 단일 설비 조회 (캐시)
     * 
     * @param {string} frontendId - Frontend ID (예: EQ-01-01)
     * @returns {Object|null} EquipmentData or null
     * 
     * @example
     * const equipment = unifiedDataStore.getEquipment('EQ-17-03');
     * if (equipment) {
     *     console.log(equipment.status);
     * }
     */
    getEquipment(frontendId) {
        if (!frontendId) {
            console.warn('⚠️ [UDS] getEquipment: frontendId가 없습니다');
            return null;
        }
        
        const equipment = this._equipmentCache.get(frontendId);
        
        if (equipment) {
            this._cacheHits++;
            return equipment;
        }
        
        this._cacheMisses++;
        console.warn(`⚠️ [UDS] 캐시 미스: ${frontendId}`);
        return null;
    }
    
    /**
     * 전체 설비 목록 반환
     * 
     * @returns {Object[]} 설비 배열
     */
    getAllEquipments() {
        return Array.from(this._equipmentCache.values());
    }
    
    /**
     * 상태별 설비 필터링
     * 
     * @param {string} status - 상태값 (RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED)
     * @returns {Object[]} 필터링된 설비 배열
     * 
     * @example
     * const runningEquipments = unifiedDataStore.getEquipmentsByStatus('RUN');
     */
    getEquipmentsByStatus(status) {
        return this.getAllEquipments().filter(eq => eq.status === status);
    }
    
    /**
     * Line별 설비 필터링
     * 
     * @param {string} lineName - Line 이름
     * @returns {Object[]} 필터링된 설비 배열
     */
    getEquipmentsByLine(lineName) {
        return this.getAllEquipments().filter(eq => eq.line_name === lineName);
    }
    
    /**
     * Grid 위치로 설비 조회
     * 
     * @param {number} row - Grid Row
     * @param {number} col - Grid Column
     * @returns {Object|null} 설비 데이터 or null
     */
    getEquipmentByGrid(row, col) {
        return this.getAllEquipments().find(
            eq => eq.grid_row === row && eq.grid_col === col
        ) || null;
    }
    
    /**
     * 설비 존재 여부 확인
     * 
     * @param {string} frontendId - Frontend ID
     * @returns {boolean}
     */
    hasEquipment(frontendId) {
        return this._equipmentCache.has(frontendId);
    }
    
    /**
     * 캐시 크기 반환
     * 
     * @returns {number}
     */
    getCacheSize() {
        return this._equipmentCache.size;
    }
    
    // =========================================================================
    // Statistics
    // =========================================================================
    
    /**
     * 상태 통계 반환
     * 
     * @returns {Object} { RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED, TOTAL }
     */
    getStatusStats() {
        return { ...this._statusStats };
    }
    
    /**
     * 캐시 히트율 반환 (Performance Monitor용)
     * 
     * @returns {number} 0~100 (%)
     */
    getCacheHitRate() {
        const total = this._cacheHits + this._cacheMisses;
        if (total === 0) return 100;
        return Math.round((this._cacheHits / total) * 100);
    }
    
    /**
     * 캐시 통계 반환
     * 
     * @returns {Object} { hits, misses, hitRate }
     */
    getCacheStats() {
        return {
            hits: this._cacheHits,
            misses: this._cacheMisses,
            hitRate: this.getCacheHitRate()
        };
    }
    
    /**
     * Delta 업데이트 카운트 반환
     * 
     * @returns {number}
     */
    getDeltaCount() {
        return this._deltaCount;
    }
    
    /**
     * 초기 로드 시간 반환
     * 
     * @returns {number} ms
     */
    getLoadTime() {
        return this._loadTime;
    }
    
    /**
     * 초기화 상태 확인
     * 
     * @returns {boolean}
     */
    isInitialized() {
        return this._initialized;
    }
    
    // =========================================================================
    // Private Methods - Cache
    // =========================================================================
    
    /**
     * 캐시 구축
     * @private
     * @param {Object[]} equipments - 설비 배열
     */
    _buildCache(equipments) {
        this._equipmentCache.clear();
        
        for (const equipment of equipments) {
            const frontendId = equipment.frontend_id;
            
            if (!frontendId) {
                console.warn('⚠️ [UDS] frontend_id 없는 설비 발견:', equipment);
                continue;
            }
            
            this._equipmentCache.set(frontendId, equipment);
        }
        
        console.log(`   └─ 캐시 구축 완료: ${this._equipmentCache.size}개`);
    }
    
    /**
     * 상태 초기화 (재초기화용)
     * @private
     */
    _reset() {
        // WebSocket 연결 해제
        udsApiClient.disconnectWebSocket();
        
        // 캐시 초기화
        this._equipmentCache.clear();
        
        // 통계 초기화
        this._statusStats = {
            RUN: 0,
            IDLE: 0,
            STOP: 0,
            SUDDENSTOP: 0,
            DISCONNECTED: 0,
            TOTAL: 0
        };
        
        // 상태 플래그 초기화
        this._initialized = false;
        this._cacheHits = 0;
        this._cacheMisses = 0;
        this._deltaCount = 0;
        this._loadTime = 0;
    }
    
    // =========================================================================
    // Private Methods - WebSocket
    // =========================================================================
    
    /**
     * WebSocket 연결
     * @private
     * @param {Object} params - { siteId, lineId }
     */
    _connectWebSocket(params) {
        udsApiClient.connectWebSocket(
            params,
            (message) => this._handleWebSocketMessage(message),
            (error) => this._handleWebSocketError(error)
        );
    }
    
    /**
     * WebSocket 메시지 처리
     * @private
     * @param {Object} message - Delta 메시지
     */
    _handleWebSocketMessage(message) {
        if (!message || !message.type) {
            console.warn('⚠️ [UDS] 알 수 없는 메시지:', message);
            return;
        }
        
        switch (message.type) {
            case 'delta':
                this._handleDeltaUpdate(message);
                break;
                
            case 'batch_delta':
                this._handleBatchDelta(message);
                break;
                
            default:
                console.log(`📩 [UDS] 기타 메시지: ${message.type}`);
        }
    }
    
    /**
     * 단일 Delta 처리
     * @private
     * @param {Object} delta - { frontend_id, changes, timestamp }
     */
    _handleDeltaUpdate(delta) {
        const { frontend_id, changes } = delta;
        
        if (!frontend_id || !changes) {
            console.warn('⚠️ [UDS] 잘못된 Delta 메시지:', delta);
            return;
        }
        
        const equipment = this._equipmentCache.get(frontend_id);
        
        if (!equipment) {
            console.warn(`⚠️ [UDS] Delta - 캐시에 없는 설비: ${frontend_id}`);
            return;
        }
        
        // 이전 상태 저장 (통계 갱신용)
        const prevStatus = equipment.status;
        
        // 캐시 업데이트
        Object.assign(equipment, changes);
        
        // 통계 갱신 (상태 변경 시)
        if (changes.status && changes.status !== prevStatus) {
            this._updateStatusStats(prevStatus, changes.status);
        }
        
        this._deltaCount++;
        
        // 이벤트 발행
        eventBus.emit(UnifiedDataStore.EVENTS.EQUIPMENT_UPDATED, {
            frontendId: frontend_id,
            changes,
            equipment,
            prevStatus
        });
        
        console.log(`🔄 [UDS] Delta 적용: ${frontend_id}`, changes);
    }
    
    /**
     * 배치 Delta 처리
     * @private
     * @param {Object} batch - { updates: [], timestamp }
     */
    _handleBatchDelta(batch) {
        if (!batch.updates || !Array.isArray(batch.updates)) {
            console.warn('⚠️ [UDS] 잘못된 배치 Delta:', batch);
            return;
        }
        
        console.log(`📦 [UDS] 배치 Delta 수신: ${batch.updates.length}개`);
        
        for (const delta of batch.updates) {
            this._handleDeltaUpdate(delta);
        }
        
        // 배치 완료 이벤트
        eventBus.emit(UnifiedDataStore.EVENTS.BATCH_UPDATED, {
            count: batch.updates.length,
            timestamp: batch.timestamp
        });
    }
    
    /**
     * 상태 통계 갱신
     * @private
     * @param {string} prevStatus - 이전 상태
     * @param {string} newStatus - 새 상태
     */
    _updateStatusStats(prevStatus, newStatus) {
        // 이전 상태 카운트 감소
        if (prevStatus && this._statusStats[prevStatus] !== undefined) {
            this._statusStats[prevStatus] = Math.max(0, this._statusStats[prevStatus] - 1);
        }
        
        // 새 상태 카운트 증가
        if (newStatus && this._statusStats[newStatus] !== undefined) {
            this._statusStats[newStatus]++;
        }
        
        // 통계 변경 이벤트
        eventBus.emit(UnifiedDataStore.EVENTS.STATS_UPDATED, {
            stats: this.getStatusStats(),
            changed: { from: prevStatus, to: newStatus }
        });
    }
    
    /**
     * WebSocket 에러 처리
     * @private
     * @param {Error} error
     */
    _handleWebSocketError(error) {
        console.error('❌ [UDS] WebSocket 에러:', error);
        
        eventBus.emit(UnifiedDataStore.EVENTS.ERROR, { 
            error,
            phase: 'websocket'
        });
    }
    
    // =========================================================================
    // API Fallback (캐시 미스 시 사용)
    // =========================================================================
    
    /**
     * 설비 조회 (캐시 미스 시 API 호출)
     * 
     * @param {string} frontendId - Frontend ID
     * @returns {Promise<Object|null>} EquipmentData or null
     */
    async fetchEquipmentIfMissing(frontendId) {
        // 캐시 먼저 확인
        const cached = this.getEquipment(frontendId);
        if (cached) {
            return cached;
        }
        
        // API 호출
        try {
            const equipment = await udsApiClient.fetchEquipment(frontendId);
            
            if (equipment) {
                // 캐시에 추가
                this._equipmentCache.set(frontendId, equipment);
                console.log(`✅ [UDS] API로 설비 로드 → 캐시 추가: ${frontendId}`);
            }
            
            return equipment;
            
        } catch (error) {
            console.error(`❌ [UDS] 설비 API 조회 실패: ${frontendId}`, error);
            return null;
        }
    }
    
    // =========================================================================
    // Cleanup
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        udsApiClient.disconnectWebSocket();
        this._equipmentCache.clear();
        
        this._initialized = false;
        this._initializing = false;
        this._cacheHits = 0;
        this._cacheMisses = 0;
        this._deltaCount = 0;
        
        console.log('🗑️ [UDS] UnifiedDataStore 정리 완료');
    }
    
    // =========================================================================
    // Debug
    // =========================================================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('📊 [UDS] UnifiedDataStore Debug Info');
        console.log('초기화 상태:', this._initialized);
        console.log('캐시 크기:', this._equipmentCache.size);
        console.log('상태 통계:', this._statusStats);
        console.log('캐시 히트:', this._cacheHits);
        console.log('캐시 미스:', this._cacheMisses);
        console.log('캐시 히트율:', this.getCacheHitRate() + '%');
        console.log('Delta 카운트:', this._deltaCount);
        console.log('초기 로드 시간:', this._loadTime.toFixed(2) + 'ms');
        console.log('WebSocket 연결:', udsApiClient.isConnected());
        console.log('Latency:', udsApiClient.getLatency() + 'ms');
        console.groupEnd();
    }
}

// =========================================================================
// Singleton Export
// =========================================================================

/** @type {UnifiedDataStore} 싱글톤 인스턴스 */
export const unifiedDataStore = new UnifiedDataStore();

// 전역 접근 (디버깅용)
if (typeof window !== 'undefined') {
    window.unifiedDataStore = unifiedDataStore;
    
    // 디버그 명령어
    window.udsDebug = () => unifiedDataStore.debug();
}