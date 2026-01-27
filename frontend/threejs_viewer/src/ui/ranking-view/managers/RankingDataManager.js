/**
 * RankingDataManager.js
 * =====================
 * Ranking View 데이터 가공 및 레인 할당 매니저
 * 
 * @version 2.3.0
 * @description
 * - 🆕 UDS (Unified Data Store) 연동 지원
 * - WebSocket 데이터 수신 및 가공
 * - 설비 상태에 따른 레인 결정
 * - Remote Alarm Code 필터링
 * - 생산중 여부 판단
 * - 레인별 설비 목록 관리
 * - 상태 변경 감지 및 이벤트 발행
 * - Custom Filter 지원 (Phase 6)
 * - 🆕 Production Ranking 지원 (Top 10)
 * - 🆕 Lane별 그룹화 및 정렬
 * - 🆕 v2.1.0: 3D View 동기화 강화
 * 
 * @changelog
 * - v2.3.0 (2026-01-27): 🔄 Lot 없는 설비도 Status 기반 레인 배치
 *   - determineLane()에서 isProducing 우선 조건 제거
 *   - Status가 있으면 해당 레인으로 배치 (생산량 0)
 *   - WAIT 레인은 Status가 없거나 UNKNOWN인 경우만
 * - v2.2.0 (2026-01-23): Phase 1 - 레인 이동 개선 (삽입 위치 계산)
 *   - 🆕 LANE_CONFIG 상수 추가 (sortBy, sortOrder 포함)
 *   - 🆕 calculateInsertIndex(): 단일 설비 삽입 위치 계산
 *   - 🆕 calculateBatchInsertIndices(): 복수 설비 일괄 계산
 *   - 🆕 _getLaneConfig(), _getSortValue(), _binarySearchInsertIndex()
 *   - ⚠️ 호환성: v2.1.0의 모든 기능/메서드/필드 100% 유지
 * - v2.1.0 (2026-01-21): Phase 3 Day 2 - Lane 정렬 및 UI 연동 강화
 *   - 🆕 getEquipmentsByLineName(): 실제 Line 이름 기준 그룹화
 *   - 🆕 getSortedByProductionCount(): 생산량 내림차순 정렬
 *   - 🆕 getSortedByDuration(): 지속시간 내림차순 정렬
 *   - 🆕 getTopProducers(): Top N 생산 설비 (전체 + Lane별)
 *   - 🆕 syncWith3DView(): 3D View 선택 동기화 메서드
 *   - 🆕 highlightEquipment(): 설비 하이라이트 이벤트 발행
 *   - 🆕 EVENTS.SELECTION_SYNC: 3D View 동기화 이벤트 추가
 *   - ⚠️ 호환성: v2.0.0의 모든 기능/메서드/필드 100% 유지
 * - v2.0.0 (2026-01-21): UDS 통합 연동
 *   - 🆕 initializeFromUDS(): UDS 데이터로 초기화
 *   - 🆕 _subscribeToUDSEvents(): UDS 이벤트 구독
 *   - 🆕 getProductionRankings(): 생산량 기준 Top 10 순위
 *   - 🆕 getEquipmentsByLane(): Lane별 설비 그룹화
 *   - 🆕 getTopByLane(): Lane별 Top N 설비
 *   - 🆕 _recalculateRankings(): 순위 재계산
 *   - 🆕 UDS Feature Flag 지원 (UDS_ENABLED)
 *   - ⚠️ 호환성: v1.1.0의 모든 기능/메서드/필드 100% 유지
 * - v1.1.0 (2026-01-19): 가이드라인 준수 + Custom Filter 통합
 * - v1.0.0: 초기 구현
 * 
 * @dependencies
 * - LaneSorter (../utils/LaneSorter.js)
 * - DurationCalculator (../utils/DurationCalculator.js)
 * - EventBus (../../../core/managers/EventBus.js)
 * - 🆕 UnifiedDataStore (../../../services/uds/UnifiedDataStore.js)
 * 
 * @exports
 * - RankingDataManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/RankingDataManager.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-23
 */

import { LaneSorter } from '../utils/LaneSorter.js';
import { DurationCalculator } from '../utils/DurationCalculator.js';
// 🆕 v2.0.0: UDS 연동
import { unifiedDataStore, UnifiedDataStore } from '../../../services/uds/UnifiedDataStore.js';

/**
 * Ranking View 데이터 매니저 클래스
 * 설비 데이터를 가공하고 적절한 레인에 배치하는 역할 담당
 */
export class RankingDataManager {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * Remote Alarm Code 목록
     * ref.RemoteAlarmList에 정의된 코드들
     * 이 알람 코드가 발생하면 Remote 레인으로 분류
     */
    // 🆕 v2.5.0: DB에서 동적 로드 (초기값은 빈 Set)
    static REMOTE_ALARM_CODES = new Set();

    // Fallback 값 (DB 로드 실패 시 사용)
    static DEFAULT_REMOTE_ALARM_CODES = new Set([
        61, 62, 86, 10047, 10048, 10051, 10052, 10055, 10056, 10057, 10058, 10077
    ]);
    
    /**
     * 레인 ID 상수
     */
    static LANE_IDS = {
        REMOTE: 'remote',
        SUDDEN_STOP: 'sudden-stop',
        STOP: 'stop',
        RUN: 'run',
        IDLE: 'idle',
        WAIT: 'wait',
        CUSTOM: 'custom'
    };
    
	 /**
     * 🆕 v2.2.0: 레인별 설정 (정렬 기준 포함)
     * - sortBy: 정렬 기준 필드 ('duration' | 'production')
     * - sortOrder: 정렬 방향 ('asc' | 'desc')
     * - status: 매핑되는 설비 상태
     */
    static LANE_CONFIG = {
        'remote': {
            status: 'REMOTE',
            sortBy: 'duration',
            sortOrder: 'desc',
            icon: '🔴',
            label: 'Remote'
        },
        'sudden-stop': {
            status: 'SUDDENSTOP',
            sortBy: 'duration',
            sortOrder: 'desc',
            icon: '⚠️',
            label: 'Sudden Stop'
        },
        'stop': {
            status: 'STOP',
            sortBy: 'duration',
            sortOrder: 'desc',
            icon: '🛑',
            label: 'Stop'
        },
        'run': {
            status: 'RUN',
            sortBy: 'production',
            sortOrder: 'desc',
            icon: '🟢',
            label: 'Run'
        },
        'idle': {
            status: 'IDLE',
            sortBy: 'duration',
            sortOrder: 'desc',
            icon: '🟡',
            label: 'Idle'
        },
        'wait': {
            status: 'WAIT',
            sortBy: 'duration',
            sortOrder: 'desc',
            icon: '⏸️',
            label: 'Wait'
        },
        'custom': {
            status: 'CUSTOM',
            sortBy: 'duration',
            sortOrder: 'desc',
            icon: '📊',
            label: 'Custom'
        }
    };
	
    /**
     * 설비 상태 상수
     */
    static STATUS = {
        RUN: 'RUN',
        STOP: 'STOP',
        IDLE: 'IDLE',
        SUDDENSTOP: 'SUDDENSTOP',
        ERROR: 'ERROR',
        UNKNOWN: 'UNKNOWN'
    };
    
    /**
     * 이벤트 타입
     */
    static EVENTS = {
        LANE_UPDATED: 'ranking:lane:updated',
        EQUIPMENT_MOVED: 'ranking:equipment:moved',
        DATA_REFRESHED: 'ranking:data:refreshed',
        STATS_UPDATED: 'ranking:stats:updated',
        CUSTOM_FILTER_UPDATED: 'ranking:custom-filter:updated',
        // 🆕 v2.0.0: UDS 관련 이벤트
        UDS_INITIALIZED: 'ranking:uds:initialized',
        RANKINGS_UPDATED: 'ranking:rankings:updated',
        // 🆕 v2.1.0: 3D View 동기화 이벤트
        SELECTION_SYNC: 'ranking:selection:sync',
        EQUIPMENT_HIGHLIGHT: 'ranking:equipment:highlight'
    };
    
    /**
     * 설정
     */
    static CONFIG = {
        DEBOUNCE_MS: 100,           // 상태 변경 디바운스 시간
        UPDATE_INTERVAL_MS: 2000,   // 지속 시간 업데이트 주기
        MAX_BATCH_SIZE: 50,         // 최대 일괄 처리 개수
        // 🆕 v2.0.0: UDS 설정
        UDS_RANKING_TOP_N: 10,      // Top N 순위 개수
        UDS_LANE_TOP_N: 5           // Lane별 Top N 개수
    };
    
    /**
     * Utility 클래스 상수 (가이드라인 준수)
     */
    static UTIL = {
        HIDDEN: 'u-hidden',
        FLEX: 'u-flex'
    };
    
    // =========================================================================
    // Constructor
    // =========================================================================
    
    /**
     * RankingDataManager 생성자
     * 
     * @param {Object} options - 옵션
     * @param {Object} [options.eventBus] - EventBus 인스턴스
     * @param {Object} [options.webSocketClient] - WebSocket 클라이언트
     * @param {boolean} [options.useUDS=true] - 🆕 UDS 사용 여부
     */
    constructor(options = {}) {
        this._options = options;
        this._eventBus = options.eventBus || null;
        this._webSocketClient = options.webSocketClient || null;
        
        // 🆕 v2.0.0: UDS 설정
        this._useUDS = options.useUDS ?? (window.ENV_CONFIG?.UDS_ENABLED ?? true);
        this._udsInitialized = false;
        
        // 내부 데이터 저장소
        this._equipments = new Map();        // equipmentId → equipment data
        this._laneEquipments = new Map();    // laneId → Set<equipmentId>
        this._previousLanes = new Map();     // 이전 레인 할당 (변경 감지용)
        
        // 🆕 v2.0.0: 순위 캐시
        this._rankings = [];                 // Top N 순위 배열
        this._laneGroups = new Map();        // lineName → [equipments]
        
        // 🆕 v2.1.0: 선택 상태
        this._selectedEquipmentId = null;
        this._highlightedEquipmentIds = new Set();
        
        // 변경 대기열 (디바운스용)
        this._pendingChanges = [];
        this._debounceTimer = null;
        
        // 지속 시간 업데이트 타이머
        this._durationTimer = null;
        
        // 이벤트 구독 목록 (dispose 시 해제용)
        this._eventSubscriptions = [];
        
        // 통계 캐시
        this._statsCache = new Map();
        
        // Custom Filter (Phase 6)
        this._customFilters = new Map();     // filterId → { filterFn, name, description }
        
        // 초기화
        this._init();
    }
    
    // =========================================================================
    // Initialization
    // =========================================================================
    
    /**
     * 초기화
     * @private
     */
    _init() {
        console.log('[RankingDataManager] 🚀 Initializing v2.5.0...');
        console.log(`   └─ UDS Mode: ${this._useUDS ? 'Enabled' : 'Disabled'}`);
        
        // 🆕 v2.5.0: Remote Alarm Codes DB에서 로드
        this._loadRemoteAlarmCodes();
        console.log(`   └─ UDS Mode: ${this._useUDS ? 'Enabled' : 'Disabled'}`);
        
        // 레인 Map 초기화
        this._initializeLanes();
        
        // 이벤트 구독 설정
        this._setupEventListeners();
        
        // 🆕 v2.0.0: UDS 이벤트 구독 (UDS 모드일 때)
        if (this._useUDS) {
            this._subscribeToUDSEvents();
        }
        
        // 🆕 v2.1.0: 3D View 동기화 이벤트 구독
        this._subscribe3DViewEvents();
        
        // 지속 시간 업데이트 타이머 시작
        this._startDurationTimer();
        
        console.log('[RankingDataManager] ✅ Initialized');
    }
    
    /**
     * 레인 Map 초기화
     * @private
     */
    _initializeLanes() {
        const laneIds = Object.values(RankingDataManager.LANE_IDS);
        
        for (const laneId of laneIds) {
            this._laneEquipments.set(laneId, new Set());
            this._previousLanes.set(laneId, new Set());
            this._statsCache.set(laneId, null);
        }
    }
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        if (!this._eventBus) {
            console.warn('[RankingDataManager] ⚠️ EventBus not provided');
            return;
        }
        
        // WebSocket 이벤트 구독 (Legacy 방식 - UDS 미사용 시)
        if (!this._useUDS) {
            const unsubStatus = this._eventBus.on(
                'websocket:equipment:status',
                this._handleStatusChange.bind(this)
            );
            
            const unsubProduction = this._eventBus.on(
                'websocket:equipment:production',
                this._handleProductionChange.bind(this)
            );
            
            const unsubLot = this._eventBus.on(
                'websocket:equipment:lot',
                this._handleLotChange.bind(this)
            );
            
            const unsubAlarm = this._eventBus.on(
                'websocket:equipment:alarm',
                this._handleAlarmChange.bind(this)
            );
            
            this._eventSubscriptions.push(unsubStatus, unsubProduction, unsubLot, unsubAlarm);
        }
    }
    
    // =========================================================================
    // 🆕 v2.1.0: 3D View 동기화
    // =========================================================================
    
    /**
     * 🆕 v2.1.0: 3D View 이벤트 구독
     * @private
     */
    _subscribe3DViewEvents() {
        if (!this._eventBus) return;
        
        // 3D View에서 설비 선택 시
        const unsubSelect = this._eventBus.on('equipment:select', (data) => {
            this._handle3DViewSelection(data);
        });
        
        // 3D View에서 설비 호버 시
        const unsubHover = this._eventBus.on('equipment:hover', (data) => {
            this._handle3DViewHover(data);
        });
        
        // Ranking View에서 설비 선택 시 → 3D View로 전파
        const unsubRankingSelect = this._eventBus.on('ranking:equipment:selected', (data) => {
            this._syncTo3DView(data);
        });
        
        this._eventSubscriptions.push(unsubSelect, unsubHover, unsubRankingSelect);
        
        console.log('[RankingDataManager] 🔗 3D View 이벤트 구독 완료');
    }
    
    /**
     * 🆕 v2.1.0: 3D View 선택 처리
     * @private
     * @param {Object} data - { equipmentId, frontendId, source }
     */
    _handle3DViewSelection(data) {
        const { equipmentId, frontendId, source } = data;
        
        // 3D View에서 온 이벤트만 처리
        if (source === 'ranking-view') return;
        
        const id = frontendId || equipmentId;
        if (!id) return;
        
        this._selectedEquipmentId = id;
        
        // Ranking View에 선택 동기화 이벤트 발행
        this._emitEvent(RankingDataManager.EVENTS.SELECTION_SYNC, {
            frontendId: id,
            source: '3d-view',
            equipment: this.getEquipmentByFrontendId(id)
        });
    }
    
    /**
     * 🆕 v2.1.0: 3D View 호버 처리
     * @private
     * @param {Object} data - { frontendId }
     */
    _handle3DViewHover(data) {
        const { frontendId } = data;
        
        if (frontendId) {
            this._highlightedEquipmentIds.add(frontendId);
        }
        
        this._emitEvent(RankingDataManager.EVENTS.EQUIPMENT_HIGHLIGHT, {
            frontendId,
            isHighlighted: Boolean(frontendId)
        });
    }
    
    /**
     * 🆕 v2.1.0: 3D View로 선택 동기화
     * @private
     * @param {Object} data - { frontendId }
     */
    _syncTo3DView(data) {
        const { frontendId } = data;
        
        if (!frontendId) return;
        
        // 3D View 카메라 이동 이벤트 발행
        this._emitEvent('camera:focus:equipment', {
            frontendId,
            source: 'ranking-view'
        });
        
        // 설비 선택 이벤트 발행 (3D View용)
        this._emitEvent('equipment:select', {
            frontendId,
            equipmentId: frontendId,
            source: 'ranking-view-3d-sync'
        });
    }
    
    /**
     * 🆕 v2.1.0: 3D View와 동기화 (외부 호출용)
     * @param {string} frontendId - Frontend ID
     */
    syncWith3DView(frontendId) {
        if (!frontendId) return;
        
        this._selectedEquipmentId = frontendId;
        this._syncTo3DView({ frontendId });
    }
    
    /**
     * 🆕 v2.1.0: 설비 하이라이트
     * @param {string} frontendId - Frontend ID
     * @param {boolean} [highlight=true] - 하이라이트 여부
     */
    highlightEquipment(frontendId, highlight = true) {
        if (highlight) {
            this._highlightedEquipmentIds.add(frontendId);
        } else {
            this._highlightedEquipmentIds.delete(frontendId);
        }
        
        this._emitEvent(RankingDataManager.EVENTS.EQUIPMENT_HIGHLIGHT, {
            frontendId,
            isHighlighted: highlight
        });
    }
    
    /**
     * 🆕 v2.1.0: 현재 선택된 설비 ID 반환
     * @returns {string|null}
     */
    getSelectedEquipmentId() {
        return this._selectedEquipmentId;
    }
    
    // =========================================================================
    // 🆕 v2.1.0: Lane별 정렬 강화
    // =========================================================================
    
    /**
     * 🆕 v2.1.0: 실제 Line 이름 기준 설비 그룹화
     * (기존 getEquipmentsByLane과 구분 - 실제 공장 라인명 기준)
     * 
     * @returns {Object} { lineName: [equipments], ... }
     */
    getEquipmentsByLineName() {
        const result = {};
        
        for (const equipment of this._equipments.values()) {
            const lineName = equipment.lineName || 'Unknown';
            
            if (!result[lineName]) {
                result[lineName] = [];
            }
            
            result[lineName].push(equipment);
        }
        
        // 각 라인 내에서 생산량 순 정렬
        for (const lineName of Object.keys(result)) {
            result[lineName].sort((a, b) => (b.productionCount || 0) - (a.productionCount || 0));
        }
        
        return result;
    }
    
    /**
     * 🆕 v2.1.0: 생산량 내림차순 정렬된 설비 목록
     * 
     * @param {string} [laneId] - 특정 레인만 (선택사항)
     * @returns {Object[]} 정렬된 설비 배열
     */
    getSortedByProductionCount(laneId = null) {
        let equipments;
        
        if (laneId) {
            equipments = this.getLaneEquipments(laneId);
        } else {
            equipments = Array.from(this._equipments.values());
        }
        
        return [...equipments].sort((a, b) => (b.productionCount || 0) - (a.productionCount || 0));
    }
    
    /**
     * 🆕 v2.1.0: 지속시간 내림차순 정렬된 설비 목록
     * 
     * @param {string} [laneId] - 특정 레인만 (선택사항)
     * @returns {Object[]} 정렬된 설비 배열
     */
    getSortedByDuration(laneId = null) {
        let equipments;
        
        if (laneId) {
            equipments = this.getLaneEquipments(laneId);
        } else {
            equipments = Array.from(this._equipments.values());
        }
        
        return [...equipments].sort((a, b) => (b.statusDuration || 0) - (a.statusDuration || 0));
    }
    
    /**
     * 🆕 v2.1.0: Top N 생산 설비 (전체 또는 Line별)
     * 
     * @param {number} [n=10] - Top N 개수
     * @param {Object} [options] - 옵션
     * @param {string} [options.lineName] - 특정 라인만
     * @param {string} [options.status] - 특정 상태만 (RUN, IDLE 등)
     * @returns {Object[]} Top N 설비 배열
     */
    getTopProducers(n = 10, options = {}) {
        let equipments = Array.from(this._equipments.values());
        
        // 라인 필터
        if (options.lineName) {
            equipments = equipments.filter(eq => eq.lineName === options.lineName);
        }
        
        // 상태 필터
        if (options.status) {
            equipments = equipments.filter(eq => eq.status === options.status);
        }
        
        // 생산량 순 정렬 후 Top N
        return equipments
            .sort((a, b) => (b.productionCount || 0) - (a.productionCount || 0))
            .slice(0, n)
            .map((eq, index) => ({
                rank: index + 1,
                ...eq
            }));
    }
    
    /**
     * 🆕 v2.1.0: 모든 라인별 Top N 설비
     * 
     * @param {number} [n=5] - 각 라인에서 가져올 개수
     * @returns {Object} { lineName: [top N with rank], ... }
     */
    getTopByLineName(n = 5) {
        const lineGroups = this.getEquipmentsByLineName();
        const result = {};
        
        for (const [lineName, equipments] of Object.entries(lineGroups)) {
            result[lineName] = equipments
                .slice(0, n)
                .map((eq, index) => ({
                    rank: index + 1,
                    ...eq
                }));
        }
        
        return result;
    }
    
    // =========================================================================
    // 🆕 v2.0.0: UDS 연동 (기존 코드 유지)
    // =========================================================================
    
    /**
     * 🆕 UDS 이벤트 구독
     * @private
     */
    _subscribeToUDSEvents() {
        console.log('[RankingDataManager] 📡 Subscribing to UDS events...');
        
        // UDS 초기화 완료 이벤트 (자동 초기화)
        const unsubInitialized = this._eventBus?.on?.(
            UnifiedDataStore.EVENTS.INITIALIZED,
            (event) => {
                console.log('[RankingDataManager] 📥 UDS INITIALIZED event received');
                this.initializeFromUDS(event.equipments);
            }
        );
        
        // 단일 설비 업데이트 이벤트
        const unsubEquipmentUpdated = this._eventBus?.on?.(
            UnifiedDataStore.EVENTS.EQUIPMENT_UPDATED,
            (event) => {
                this._handleUDSEquipmentUpdate(event);
            }
        );
        
        // 배치 업데이트 완료 이벤트
        const unsubBatchUpdated = this._eventBus?.on?.(
            UnifiedDataStore.EVENTS.BATCH_UPDATED,
            (event) => {
                this._handleUDSBatchUpdate(event);
            }
        );
        
        // 통계 변경 이벤트
        const unsubStatsUpdated = this._eventBus?.on?.(
            UnifiedDataStore.EVENTS.STATS_UPDATED,
            (event) => {
                this._handleUDSStatsUpdate(event);
            }
        );
        
        // 구독 해제 함수 저장
        if (unsubInitialized) this._eventSubscriptions.push(unsubInitialized);
        if (unsubEquipmentUpdated) this._eventSubscriptions.push(unsubEquipmentUpdated);
        if (unsubBatchUpdated) this._eventSubscriptions.push(unsubBatchUpdated);
        if (unsubStatsUpdated) this._eventSubscriptions.push(unsubStatsUpdated);
        
        console.log('[RankingDataManager] ✅ UDS events subscribed');
    }
    
    /**
     * 🆕 UDS 데이터로 초기화
     * UDS 초기 로드 데이터를 받아 RankingDataManager 초기화
     * 
     * @param {Object[]} equipmentsFromUDS - UDS에서 받은 설비 데이터 배열
     * @returns {Map<string, Array<Object>>} 레인별 정렬된 설비 목록
     */
    initializeFromUDS(equipmentsFromUDS) {
        console.log(`[RankingDataManager] 📊 Initializing from UDS with ${equipmentsFromUDS?.length || 0} equipments...`);
        
        if (!Array.isArray(equipmentsFromUDS) || equipmentsFromUDS.length === 0) {
            console.warn('[RankingDataManager] ⚠️ Empty or invalid UDS data');
            return this.getAllLanes();
        }
        
        // 기존 데이터 초기화
        this._clearAllData();
        
        // UDS 데이터를 RankingDataManager 형식으로 변환 및 로드
        for (const udsEquipment of equipmentsFromUDS) {
            const equipment = this._convertFromUDSFormat(udsEquipment);
            
            if (equipment) {
                this._equipments.set(equipment.equipmentId, equipment);
                
                // 레인 결정 및 할당
                const laneId = this.determineLane(equipment);
                equipment.laneId = laneId;
                
                this._laneEquipments.get(laneId).add(equipment.equipmentId);
            }
        }
        
        // 각 레인 정렬
        const sortedLanes = this._sortAllLanes();
        
        // 🆕 순위 계산
        this._rankings = this._calculateRankings(Array.from(this._equipments.values()));
        
        // 🆕 Lane 그룹 계산
        this._buildLaneGroups();
        
        // 통계 계산
        this._updateAllStats();
        
        this._udsInitialized = true;
        
        // 이벤트 발행
        this._emitEvent(RankingDataManager.EVENTS.UDS_INITIALIZED, {
            totalCount: this._equipments.size,
            laneStats: this.getAllStats(),
            rankings: this._rankings
        });
        
        this._emitEvent(RankingDataManager.EVENTS.DATA_REFRESHED, {
            totalCount: this._equipments.size,
            laneStats: this.getAllStats()
        });
        
        console.log(`[RankingDataManager] ✅ UDS initialization complete`);
        console.log(`   └─ Equipments: ${this._equipments.size}`);
        console.log(`   └─ Rankings (Top ${RankingDataManager.CONFIG.UDS_RANKING_TOP_N}): ${this._rankings.length}`);
        
        return sortedLanes;
    }
    
    /**
     * 🆕 UDS 형식 → RankingDataManager 형식 변환
     * @private
     * @param {Object} udsEquipment - UDS 설비 데이터
     * @returns {Object|null} 변환된 설비 데이터
     */
    _convertFromUDSFormat(udsEquipment) {
        if (!udsEquipment) {
            return null;
        }
        
        try {
            const frontendId = udsEquipment.frontend_id;
            const equipmentId = String(udsEquipment.equipment_id || frontendId);
            
            if (!frontendId && !equipmentId) {
                console.warn('[RankingDataManager] ⚠️ No ID found in UDS equipment:', udsEquipment);
                return null;
            }
            
            // UDS 상태값 변환
            const status = (udsEquipment.status || 'UNKNOWN').toUpperCase();
            
            // Lot 정보 구성
            const lotInfo = {
                lotId: udsEquipment.lot_id,
                lotQty: udsEquipment.production_count || 0,
                isStart: udsEquipment.lot_id ? 1 : 0,
                isEnd: 0,
                startedAtUtc: udsEquipment.lot_start_time
            };
            
            // 생산중 여부
            const isProducing = Boolean(udsEquipment.lot_id);
            
            // 지속 시간 계산
            const statusDuration = udsEquipment.status_changed_at
                ? DurationCalculator.calculateStatusDuration(udsEquipment.status_changed_at)
                : 0;
            
            return {
                // 식별자
                equipmentId: equipmentId,
                frontendId: frontendId,
                
                // 기본 정보
                equipmentName: udsEquipment.equipment_name || '',
                lineName: udsEquipment.line_name || '',
                
                // 상태 정보
                status,
                previousStatus: null,
				// 수정된 코드
				alarmCode: udsEquipment.alarm_code || null,
				alarmMessage: udsEquipment.alarm_message || '',
				alarmRepeatCount: udsEquipment.alarm_repeat_count || 0,
                
                // 시간 정보
                occurredAt: udsEquipment.status_changed_at,
                statusDuration,
                waitDuration: 0,
                
                // Lot 정보
                lotInfo,
                isProducing,
                
                // 🆕 생산 정보 (UDS 직접 매핑)
                productionCount: udsEquipment.production_count || 0,
                tactTime: udsEquipment.tact_time_seconds || 0,
                targetCount: udsEquipment.target_count || 0,
                lotProgress: 0,
                
                // PC 정보 (UDS 제공)
                cpuUsage: udsEquipment.cpu_usage_percent,
                memoryUsage: udsEquipment.memory_usage_percent,
                diskUsage: udsEquipment.disk_usage_percent,
                
                // Grid 정보
                gridRow: udsEquipment.grid_row,
                gridCol: udsEquipment.grid_col,
				
				// 🆕 MiniTimeline용 상태 히스토리
                stateHistory: udsEquipment.state_history || [],
                
                // 레인 정보 (나중에 할당)
                laneId: null,
                
                // 메타 정보
                lastUpdated: new Date().toISOString(),
                
                // 원본 데이터 참조
                _raw: udsEquipment
            };
            
        } catch (error) {
            console.error('[RankingDataManager] ❌ Error converting UDS data:', error, udsEquipment);
            return null;
        }
    }
    
    /**
     * 🆕 UDS 설비 업데이트 처리
     * @private
     * @param {Object} event - { frontendId, changes, equipment, prevStatus }
     */
    _handleUDSEquipmentUpdate(event) {
        const { frontendId, changes, equipment: udsEquipment } = event;
        
        if (!frontendId) return;
        
        // 기존 설비 찾기
        let equipment = null;
        for (const eq of this._equipments.values()) {
            if (eq.frontendId === frontendId) {
                equipment = eq;
                break;
            }
        }
        
        if (!equipment) {
            console.warn(`[RankingDataManager] ⚠️ UDS Update - Equipment not found: ${frontendId}`);
            return;
        }
        
        const previousLaneId = equipment.laneId;
        const prevStatus = equipment.status;
        
        // 변경사항 적용
        if (changes.status) {
            equipment.previousStatus = equipment.status;
            equipment.status = changes.status.toUpperCase();
            equipment.statusDuration = 0;
        }
        
        if (changes.production_count !== undefined) {
            equipment.productionCount = changes.production_count;
        }
        
        if (changes.tact_time_seconds !== undefined) {
            equipment.tactTime = changes.tact_time_seconds;
        }
        
        if (changes.lot_id !== undefined) {
            equipment.lotInfo = {
                ...equipment.lotInfo,
                lotId: changes.lot_id
            };
            equipment.isProducing = Boolean(changes.lot_id);
        }
        
        if (changes.status_changed_at) {
            equipment.occurredAt = changes.status_changed_at;
        }
        
        equipment.lastUpdated = new Date().toISOString();
        
        // 레인 재결정
        const newLaneId = this.determineLane(equipment);
        
        // 레인 이동 처리
        if (previousLaneId !== newLaneId) {
            equipment.laneId = newLaneId;
            
            if (previousLaneId) {
                this._laneEquipments.get(previousLaneId)?.delete(equipment.equipmentId);
            }
            this._laneEquipments.get(newLaneId).add(equipment.equipmentId);
            
            // 영향받는 레인 정렬
            if (previousLaneId) this._sortLane(previousLaneId);
            this._sortLane(newLaneId);
            
            // 이동 이벤트 발행
            this._emitEvent(RankingDataManager.EVENTS.EQUIPMENT_MOVED, {
                moved: [{
                    equipmentId: equipment.equipmentId,
                    fromLane: previousLaneId,
                    toLane: newLaneId,
                    equipment
                }],
                timestamp: Date.now()
            });
        }
        
        // 🆕 생산량 변경 시 순위 재계산
        if (changes.production_count !== undefined) {
            this._recalculateRankings();
        }
        
        // 레인 그룹 재구성
        this._buildLaneGroups();
    }
    
    /**
     * 🆕 UDS 배치 업데이트 처리
     * @private
     * @param {Object} event - { count, timestamp }
     */
    _handleUDSBatchUpdate(event) {
        console.log(`[RankingDataManager] 📦 UDS Batch Update: ${event.count} changes`);
        
        // 배치 업데이트 후 순위 재계산
        this._recalculateRankings();
        
        // 레인 그룹 재구성
        this._buildLaneGroups();
        
        // 통계 업데이트
        this._updateAllStats();
    }
    
    /**
     * 🆕 UDS 통계 업데이트 처리
     * @private
     * @param {Object} event - { stats, changed }
     */
    _handleUDSStatsUpdate(event) {
        // 통계 이벤트 전파
        this._emitEvent(RankingDataManager.EVENTS.STATS_UPDATED, {
            stats: this.getAllStats(),
            udsStats: event.stats
        });
    }
    
    /**
     * 🆕 순위 계산 (Top N - 생산량 기준)
     * @private
     * @param {Object[]} equipments - 설비 배열
     * @returns {Object[]} 순위 배열
     */
    _calculateRankings(equipments) {
        return [...equipments]
            .filter(eq => eq.status === RankingDataManager.STATUS.RUN)  // RUN 상태만
            .sort((a, b) => (b.productionCount || 0) - (a.productionCount || 0))  // 생산량 내림차순
            .slice(0, RankingDataManager.CONFIG.UDS_RANKING_TOP_N)
            .map((eq, index) => ({
                rank: index + 1,
                frontendId: eq.frontendId,
                equipmentId: eq.equipmentId,
                equipmentName: eq.equipmentName,
                lineName: eq.lineName,
                productionCount: eq.productionCount || 0,
                tactTime: eq.tactTime || 0,
                status: eq.status
            }));
    }
    
    /**
     * 🆕 순위 재계산
     * @private
     */
    _recalculateRankings() {
        const equipments = Array.from(this._equipments.values());
        this._rankings = this._calculateRankings(equipments);
        
        // 순위 변경 이벤트 발행
        this._emitEvent(RankingDataManager.EVENTS.RANKINGS_UPDATED, {
            rankings: this._rankings,
            timestamp: Date.now()
        });
    }
    
    /**
     * 🆕 Lane 그룹 구성
     * @private
     */
    _buildLaneGroups() {
        this._laneGroups.clear();
        
        for (const equipment of this._equipments.values()) {
            const lineName = equipment.lineName || 'Unknown';
            
            if (!this._laneGroups.has(lineName)) {
                this._laneGroups.set(lineName, []);
            }
            
            this._laneGroups.get(lineName).push(equipment);
        }
        
        // 각 그룹 내에서 생산량 순 정렬
        for (const [lineName, equipments] of this._laneGroups) {
            equipments.sort((a, b) => (b.productionCount || 0) - (a.productionCount || 0));
        }
    }
    
    /**
     * 🆕 생산량 기준 Top N 순위 조회
     * 
     * @returns {Object[]} 순위 배열
     */
    getProductionRankings() {
        return [...this._rankings];
    }
    
    /**
     * 🆕 Line별 설비 그룹화 (레인 타입 기준)
     * 
     * @returns {Object} { lineName: [equipments], ... }
     */
    getEquipmentsByLane() {
        const result = {};
        
        for (const [lineName, equipments] of this._laneGroups) {
            result[lineName] = [...equipments];
        }
        
        return result;
    }
    
    /**
     * 🆕 Line별 Top N 설비
     * 
     * @param {number} [n=5] - 각 Line에서 가져올 설비 수
     * @returns {Object} { lineName: [top N], ... }
     */
    getTopByLane(n = RankingDataManager.CONFIG.UDS_LANE_TOP_N) {
        const result = {};
        
        for (const [lineName, equipments] of this._laneGroups) {
            result[lineName] = equipments.slice(0, n);
        }
        
        return result;
    }
    
    /**
     * 🆕 UDS 초기화 상태 확인
     * 
     * @returns {boolean}
     */
    isUDSInitialized() {
        return this._udsInitialized;
    }
    
    /**
     * 🆕 UDS 모드 확인
     * 
     * @returns {boolean}
     */
    isUDSMode() {
        return this._useUDS;
    }
    
    // =========================================================================
    // Data Loading (Legacy - 기존 방식 유지)
    // =========================================================================
    
    /**
     * 전체 설비 데이터 로드 및 초기화
     * 
     * @param {Array<Object>} equipmentsData - 설비 데이터 배열
     * @returns {Map<string, Array<Object>>} 레인별 정렬된 설비 목록
     */
    loadEquipments(equipmentsData) {
        console.log(`[RankingDataManager] 📊 Loading ${equipmentsData?.length || 0} equipments...`);
        
        if (!Array.isArray(equipmentsData)) {
            console.warn('[RankingDataManager] ⚠️ Invalid equipments data');
            return this.getAllLanes();
        }
        
        // 기존 데이터 초기화
        this._clearAllData();
        
        // 설비 데이터 처리
        for (const rawData of equipmentsData) {
            const equipment = this.processEquipmentData(rawData);
            
            if (equipment) {
                this._equipments.set(equipment.equipmentId, equipment);
                
                // 레인 결정 및 할당
                const laneId = this.determineLane(equipment);
                equipment.laneId = laneId;
                
                this._laneEquipments.get(laneId).add(equipment.equipmentId);
            }
        }
        
        // 각 레인 정렬
        const sortedLanes = this._sortAllLanes();
        
        // 🆕 순위 계산
        this._rankings = this._calculateRankings(Array.from(this._equipments.values()));
        
        // 🆕 Lane 그룹 계산
        this._buildLaneGroups();
        
        // 통계 계산
        this._updateAllStats();
        
        // 이벤트 발행
        this._emitEvent(RankingDataManager.EVENTS.DATA_REFRESHED, {
            totalCount: this._equipments.size,
            laneStats: this.getAllStats()
        });
        
        console.log(`[RankingDataManager] ✅ Loaded ${this._equipments.size} equipments`);
        
        return sortedLanes;
    }
    
    /**
     * 설비 데이터 가공
     * 원본 데이터를 Ranking View에서 사용할 형식으로 변환
     * 
     * @param {Object} rawData - 원본 설비 데이터
     * @returns {Object|null} 가공된 설비 데이터
     */
    processEquipmentData(rawData) {
        if (!rawData) {
            return null;
        }
        
        try {
            // 기본 정보 추출
            const equipmentId = rawData.equipmentId || rawData.EquipmentId || rawData.equipment_id;
            const frontendId = rawData.frontendId || rawData.frontend_id || rawData.FrontendId;
            
            if (!equipmentId && !frontendId) {
                console.warn('[RankingDataManager] ⚠️ Equipment ID not found:', rawData);
                return null;
            }
            
            // 상태 정보
            const status = (rawData.status || rawData.Status || 'UNKNOWN').toUpperCase();
            const alarmCode = rawData.alarmCode || rawData.alarm_code || rawData.AlarmCode || null;
            const alarmMessage = rawData.alarmMessage || rawData.alarm_message || rawData.AlarmMessage || '';
            
            // 시간 정보
            const occurredAt = rawData.occurredAt || rawData.occurred_at || 
                              rawData.OccurredAt || rawData.OccurredAtUtc;
            
            // Lot 정보
            const lotInfo = this._extractLotInfo(rawData);
            
            // 생산 정보
            const productionCount = rawData.productionCount || rawData.production_count || 
                                   rawData.ProductionCount || rawData.currentCount || 0;
            const targetCount = rawData.targetCount || rawData.target_count || 
                               rawData.TargetCount || rawData.lotQty || lotInfo?.lotQty || 0;
            
            // 생산중 여부 판단
            const isProducing = this.isProducing({ lotInfo });
            
            // 지속 시간 계산
            const statusDuration = occurredAt 
                ? DurationCalculator.calculateStatusDuration(occurredAt)
                : 0;
            
            // 대기 시간 (Wait 레인용)
            const waitDuration = !isProducing && lotInfo?.lastLotEndTime
                ? DurationCalculator.calculateWaitDuration({
                    occurredAtUtc: lotInfo.lastLotEndTime,
                    isStart: 0
                  })
                : 0;
            
            // 가공된 데이터 반환
            return {
                // 식별자
                equipmentId: String(equipmentId),
                frontendId: frontendId || `EQ-${equipmentId}`,
                
                // 기본 정보
                equipmentName: rawData.equipmentName || rawData.equipment_name || '',
                lineName: rawData.lineName || rawData.line_name || '',
                
                // 상태 정보
                status,
                previousStatus: rawData.previousStatus || null,
                alarmCode: alarmCode ? parseInt(alarmCode, 10) : null,
                alarmMessage,
                alarmRepeatCount: rawData.alarmRepeatCount || 0,
                
                // 시간 정보
                occurredAt,
                statusDuration,
                waitDuration,
                
                // Lot 정보
                lotInfo,
                isProducing,
                
                // 생산 정보
                productionCount: parseInt(productionCount, 10) || 0,
                tactTime: rawData.tactTime || rawData.tact_time_seconds || 0,
                targetCount: parseInt(targetCount, 10) || 0,
                lotProgress: targetCount > 0 
                    ? Math.round((productionCount / targetCount) * 100) 
                    : 0,
                
                // 레인 정보 (나중에 할당)
                laneId: null,
                
                // 메타 정보
                lastUpdated: new Date().toISOString(),
                
                // 원본 데이터 참조 (디버깅용)
                _raw: rawData
            };
            
        } catch (error) {
            console.error('[RankingDataManager] ❌ Error processing equipment data:', error, rawData);
            return null;
        }
    }
    
    /**
     * Lot 정보 추출
     * @private
     * @param {Object} rawData - 원본 데이터
     * @returns {Object|null} Lot 정보
     */
    _extractLotInfo(rawData) {
        // lotInfo가 직접 있는 경우
        if (rawData.lotInfo) {
            return {
                lotId: rawData.lotInfo.lotId || rawData.lotInfo.LotId,
                lotQty: rawData.lotInfo.lotQty || rawData.lotInfo.LotQty || 0,
                isStart: rawData.lotInfo.isStart ?? rawData.lotInfo.IsStart ?? 0,
                isEnd: rawData.lotInfo.isEnd ?? rawData.lotInfo.IsEnd ?? 0,
                startedAtUtc: rawData.lotInfo.startedAtUtc || rawData.lotInfo.OccurredAtUtc,
                lastLotEndTime: rawData.lotInfo.lastLotEndTime
            };
        }
        
        // 플랫 구조에서 추출
        const lotId = rawData.lotId || rawData.lot_id || rawData.LotId;
        
        if (!lotId) {
            return null;
        }
        
        return {
            lotId,
            lotQty: rawData.lotQty || rawData.lot_qty || rawData.LotQty || 0,
            isStart: rawData.isStart ?? rawData.is_start ?? rawData.IsStart ?? 0,
            isEnd: rawData.isEnd ?? rawData.is_end ?? rawData.IsEnd ?? 0,
            startedAtUtc: rawData.lotStartedAt || rawData.lot_started_at,
            lastLotEndTime: rawData.lastLotEndTime || rawData.last_lot_end_time
        };
    }
    
    // =========================================================================
    // Lane Determination Logic
    // =========================================================================
    
    /**
     * 설비의 레인 결정
     * 설비 상태와 알람 코드에 따라 적절한 레인 할당
     * 
     * 🔄 v2.3.0 변경: Lot 없어도 Status 기반으로 레인 결정
     * 
     * 우선순위:
     * 1. SUDDENSTOP + Remote Alarm → REMOTE
     * 2. SUDDENSTOP + 일반 Alarm → SUDDEN_STOP
     * 3. 상태별 레인 (RUN/STOP/IDLE)
     * 4. 상태 없음 or UNKNOWN → WAIT
     * 
     * ⚠️ Lot이 없어도 Status가 있으면 해당 레인으로 배치 (생산량 0으로 표시)
     * 
     * @param {Object} equipment - 가공된 설비 데이터
     * @returns {string} 레인 ID
     */
    determineLane(equipment) {
        const { status, alarmCode } = equipment;
        
        // 🔄 v2.3.0: isProducing 체크 제거 - Status 기반으로만 판단
        
        // 1. SUDDENSTOP 상태 처리
        if (status === RankingDataManager.STATUS.SUDDENSTOP) {
            // Remote Alarm Code 체크
            if (alarmCode && RankingDataManager.REMOTE_ALARM_CODES.has(alarmCode)) {
                return RankingDataManager.LANE_IDS.REMOTE;
            }
            
            return RankingDataManager.LANE_IDS.SUDDEN_STOP;
        }
        
        // 2. 상태별 레인 결정 (Lot 유무와 무관!)
        switch (status) {
            case RankingDataManager.STATUS.RUN:
                return RankingDataManager.LANE_IDS.RUN;
                
            case RankingDataManager.STATUS.STOP:
                return RankingDataManager.LANE_IDS.STOP;
                
            case RankingDataManager.STATUS.IDLE:
                return RankingDataManager.LANE_IDS.IDLE;
                
            case RankingDataManager.STATUS.ERROR:
                // ERROR는 SUDDEN_STOP으로 처리
                return RankingDataManager.LANE_IDS.SUDDEN_STOP;
                
            // 3. 상태 없음, UNKNOWN, 명시적 WAIT → WAIT 레인
            default:
                // Status가 없거나 UNKNOWN인 경우만 WAIT
                if (!status || status === 'UNKNOWN' || status === 'WAIT') {
                    return RankingDataManager.LANE_IDS.WAIT;
                }
                console.warn(`[RankingDataManager] ⚠️ Unknown status: ${status}`);
                return RankingDataManager.LANE_IDS.WAIT;
        }
    }
    
    /**
     * 생산중 여부 판단
     * Lot이 시작되었고 아직 종료되지 않은 상태
     * 
     * @param {Object} equipment - 설비 데이터 (lotInfo 포함)
     * @returns {boolean} 생산중 여부
     */
    isProducing(equipment) {
        const { lotInfo } = equipment;
        
        // Lot 정보가 없으면 비생산
        if (!lotInfo) {
            return false;
        }
        
        // IsStart === 1 && IsEnd !== 1 이면 생산중
        const isStart = lotInfo.isStart ?? lotInfo.IsStart ?? 0;
        const isEnd = lotInfo.isEnd ?? lotInfo.IsEnd ?? 0;
        
        return isStart === 1 && isEnd !== 1;
    }
    
    /**
     * Remote Alarm 여부 확인
     * 
     * @param {number} alarmCode - 알람 코드
     * @returns {boolean} Remote Alarm 여부
     */
    isRemoteAlarm(alarmCode) {
        if (!alarmCode) return false;
        return RankingDataManager.REMOTE_ALARM_CODES.has(alarmCode);
    }
    
    // =========================================================================
    // Status Change Handling (Legacy)
    // =========================================================================
    
    /**
     * WebSocket 상태 변경 이벤트 처리
     * 
     * @param {Object} data - 상태 변경 데이터
     * @param {string} data.equipmentId - 설비 ID
     * @param {string} data.currentStatus - 현재 상태
     * @param {string} [data.previousStatus] - 이전 상태
     * @param {number} [data.alarmCode] - 알람 코드
     * @param {string} [data.occurredAt] - 발생 시간
     */
    _handleStatusChange(data) {
        if (!this._validateStatusData(data)) {
            console.warn('[RankingDataManager] ⚠️ Invalid status data:', data);
            return;
        }
        
        console.log(`[RankingDataManager] 📡 Status change: ${data.equipmentId} → ${data.currentStatus}`);
        
        // 변경 대기열에 추가 (디바운스)
        this._pendingChanges.push({
            type: 'status',
            data
        });
        
        this._scheduleProcessing();
    }
    
    /**
     * 생산량 변경 이벤트 처리
     * @param {Object} data - 생산량 데이터
     */
    _handleProductionChange(data) {
        if (!data.equipmentId) return;
        
        this._pendingChanges.push({
            type: 'production',
            data
        });
        
        this._scheduleProcessing();
    }
    
    /**
     * Lot 변경 이벤트 처리
     * @param {Object} data - Lot 데이터
     */
    _handleLotChange(data) {
        if (!data.equipmentId) return;
        
        this._pendingChanges.push({
            type: 'lot',
            data
        });
        
        this._scheduleProcessing();
    }
    
    /**
     * 알람 변경 이벤트 처리
     * @param {Object} data - 알람 데이터
     */
    _handleAlarmChange(data) {
        if (!data.equipmentId) return;
        
        this._pendingChanges.push({
            type: 'alarm',
            data
        });
        
        this._scheduleProcessing();
    }
    
    /**
     * 상태 데이터 유효성 검사
     * @private
     * @param {Object} data - 상태 데이터
     * @returns {boolean} 유효 여부
     */
    _validateStatusData(data) {
        return data 
            && typeof data.equipmentId === 'string'
            && (typeof data.currentStatus === 'string' || typeof data.status === 'string');
    }
    
    /**
     * 변경 처리 예약 (디바운스)
     * @private
     */
    _scheduleProcessing() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        
        this._debounceTimer = setTimeout(() => {
            this._processPendingChanges();
        }, RankingDataManager.CONFIG.DEBOUNCE_MS);
    }
    
    /**
     * 대기 중인 변경사항 일괄 처리
     * @private
     */
    _processPendingChanges() {
        if (this._pendingChanges.length === 0) {
            return;
        }
        
        console.log(`[RankingDataManager] 🔄 Processing ${this._pendingChanges.length} pending changes`);
        
        const changes = [...this._pendingChanges];
        this._pendingChanges = [];
        
        // 이전 레인 할당 저장
        this._savePreviousLanes();
        
        // 변경사항 적용
        const movedEquipments = [];
        let productionChanged = false;
        
        for (const change of changes) {
            const result = this._applyChange(change);
            
            if (result && result.moved) {
                movedEquipments.push(result);
            }
            
            if (change.type === 'production') {
                productionChanged = true;
            }
        }
        
        // 영향받는 레인 정렬
        const affectedLanes = new Set(movedEquipments.map(m => [m.fromLane, m.toLane]).flat());
        
        for (const laneId of affectedLanes) {
            if (laneId) {
                this._sortLane(laneId);
            }
        }
        
        // 통계 업데이트
        this._updateAllStats();
        
        // 🆕 생산량 변경 시 순위 재계산
        if (productionChanged) {
            this._recalculateRankings();
        }
        
        // 이벤트 발행
        if (movedEquipments.length > 0) {
            this._emitEvent(RankingDataManager.EVENTS.EQUIPMENT_MOVED, {
                moved: movedEquipments,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 개별 변경사항 적용
     * @private
     * @param {Object} change - 변경 정보
     * @returns {Object|null} 이동 정보
     */
    _applyChange(change) {
        const { type, data } = change;
        const equipmentId = data.equipmentId;
        
        // 기존 설비 데이터 가져오기
        let equipment = this._equipments.get(equipmentId);
        
        if (!equipment) {
            // 새 설비인 경우 생성
            equipment = this.processEquipmentData(data);
            if (!equipment) return null;
            
            this._equipments.set(equipmentId, equipment);
        }
        
        // 이전 레인 저장
        const previousLaneId = equipment.laneId;
        
        // 변경 타입별 처리
        switch (type) {
            case 'status':
                equipment.previousStatus = equipment.status;
                equipment.status = (data.currentStatus || data.status).toUpperCase();
                equipment.occurredAt = data.occurredAt || new Date().toISOString();
                equipment.statusDuration = 0; // 리셋
                
                if (data.alarmCode !== undefined) {
                    equipment.alarmCode = data.alarmCode ? parseInt(data.alarmCode, 10) : null;
                }
                break;
                
            case 'production':
                equipment.productionCount = parseInt(data.productionCount || data.count, 10) || 0;
                equipment.lotProgress = equipment.targetCount > 0
                    ? Math.round((equipment.productionCount / equipment.targetCount) * 100)
                    : 0;
                break;
                
            case 'lot':
                equipment.lotInfo = this._extractLotInfo(data);
                equipment.isProducing = this.isProducing(equipment);
                equipment.targetCount = equipment.lotInfo?.lotQty || equipment.targetCount;
                break;
                
            case 'alarm':
                equipment.alarmCode = data.alarmCode ? parseInt(data.alarmCode, 10) : null;
                equipment.alarmMessage = data.alarmMessage || '';
                equipment.alarmRepeatCount = data.repeatCount || (equipment.alarmRepeatCount + 1);
                break;
        }
        
        // 레인 재결정
        const newLaneId = this.determineLane(equipment);
        equipment.laneId = newLaneId;
        equipment.lastUpdated = new Date().toISOString();
        
        // 레인 이동 처리
        if (previousLaneId !== newLaneId) {
            // 이전 레인에서 제거
            if (previousLaneId) {
                this._laneEquipments.get(previousLaneId)?.delete(equipmentId);
            }
            
            // 새 레인에 추가
            this._laneEquipments.get(newLaneId).add(equipmentId);
            
            return {
                moved: true,
                equipmentId,
                fromLane: previousLaneId,
                toLane: newLaneId,
                equipment
            };
        }
        
        return null;
    }
    
    // =========================================================================
    // Duration Timer
    // =========================================================================
    
    /**
     * 지속 시간 업데이트 타이머 시작
     * @private
     */
    _startDurationTimer() {
        if (this._durationTimer) {
            clearInterval(this._durationTimer);
        }
        
        this._durationTimer = setInterval(() => {
            this._updateAllDurations();
        }, RankingDataManager.CONFIG.UPDATE_INTERVAL_MS);
    }
    
    /**
     * 모든 설비의 지속 시간 업데이트
     * @private
     */
    _updateAllDurations() {
        const now = new Date();
        
        for (const equipment of this._equipments.values()) {
            if (equipment.occurredAt) {
                equipment.statusDuration = DurationCalculator.calculateStatusDuration(
                    equipment.occurredAt,
                    now
                );
            }
            
            if (!equipment.isProducing && equipment.lotInfo?.lastLotEndTime) {
                equipment.waitDuration = DurationCalculator.calculateWaitDuration(
                    {
                        occurredAtUtc: equipment.lotInfo.lastLotEndTime,
                        isStart: 0
                    },
                    now
                );
            }
        }
    }
    
    // =========================================================================
    // Sorting & Statistics
    // =========================================================================
    
    /**
     * 특정 레인 정렬
     * @private
     * @param {string} laneId - 레인 ID
     */
    _sortLane(laneId) {
        const equipmentIds = this._laneEquipments.get(laneId);
        
        if (!equipmentIds || equipmentIds.size === 0) {
            return;
        }
        
        // 설비 데이터 배열로 변환
        const equipments = Array.from(equipmentIds)
            .map(id => this._equipments.get(id))
            .filter(Boolean);
        
        // 정렬
        const sorted = LaneSorter.sort(equipments, laneId);
        
        // 정렬된 순서로 Set 재구성
        this._laneEquipments.set(laneId, new Set(sorted.map(e => e.equipmentId)));
    }
    
    /**
     * 모든 레인 정렬
     * @private
     * @returns {Map<string, Array<Object>>} 정렬된 레인별 설비 목록
     */
    _sortAllLanes() {
        const result = new Map();
        
        for (const laneId of this._laneEquipments.keys()) {
            this._sortLane(laneId);
            result.set(laneId, this.getLaneEquipments(laneId));
        }
        
        return result;
    }
    
    /**
     * 레인 통계 계산
     * @private
     * @param {string} laneId - 레인 ID
     * @returns {Object} 통계 정보
     */
    _calculateLaneStats(laneId) {
        const equipmentIds = this._laneEquipments.get(laneId);
        
        if (!equipmentIds || equipmentIds.size === 0) {
            return {
                count: 0,
                avgDuration: 0,
                maxDuration: 0,
                avgProduction: 0,
                maxProduction: 0
            };
        }
        
        const equipments = Array.from(equipmentIds)
            .map(id => this._equipments.get(id))
            .filter(Boolean);
        
        const durations = equipments.map(e => e.statusDuration || e.waitDuration || 0);
        const productions = equipments.map(e => e.productionCount || 0);
        
        return {
            count: equipments.length,
            avgDuration: DurationCalculator.calculateAverage(durations),
            maxDuration: DurationCalculator.calculateMax(durations),
            avgProduction: productions.length > 0
                ? Math.round(productions.reduce((a, b) => a + b, 0) / productions.length)
                : 0,
            maxProduction: Math.max(...productions, 0)
        };
    }
    
    /**
     * 모든 레인 통계 업데이트
     * @private
     */
    _updateAllStats() {
        for (const laneId of this._laneEquipments.keys()) {
            this._statsCache.set(laneId, this._calculateLaneStats(laneId));
        }
        
        this._emitEvent(RankingDataManager.EVENTS.STATS_UPDATED, {
            stats: this.getAllStats()
        });
    }
	
	// =========================================================================
    // 🆕 v2.2.0: 삽입 위치 계산 (Lane 이동 개선)
    // =========================================================================
    
    /**
     * 🆕 v2.2.0: 레인 삽입 위치 계산
     * 정렬 기준에 맞는 올바른 위치를 이진 탐색으로 결정
     * 
     * @param {string} laneId - 목표 레인 ID
     * @param {Object} equipment - 삽입할 설비 데이터
     * @returns {number} targetIndex (0-based)
     */
    calculateInsertIndex(laneId, equipment) {
        const laneConfig = this._getLaneConfig(laneId);
        const { sortBy, sortOrder } = laneConfig;
        
        const existingEquipments = this.getLaneEquipments(laneId);
        
        if (existingEquipments.length === 0) {
            return 0;
        }
        
        const newValue = this._getSortValue(equipment, sortBy);
        
        return this._binarySearchInsertIndex(existingEquipments, newValue, sortBy, sortOrder);
    }
    
    /**
     * 🆕 v2.2.0: 복수 설비 삽입 위치 일괄 계산
     * 
     * @param {string} laneId - 목표 레인 ID
     * @param {Array<Object>} equipments - 삽입할 설비들
     * @returns {Array<{equipment: Object, targetIndex: number}>}
     */
    calculateBatchInsertIndices(laneId, equipments) {
        if (!equipments || equipments.length === 0) {
            return [];
        }
        
        const sortedEquipments = this._sortEquipmentsByLaneCriteria(laneId, equipments);
        const existingEquipments = this.getLaneEquipments(laneId);
        
        const results = [];
        let insertedCount = 0;
        
        for (const equipment of sortedEquipments) {
            const baseIndex = this._calculateInsertIndexWithOffset(
                laneId, 
                equipment, 
                existingEquipments,
                insertedCount
            );
            
            results.push({
                equipment,
                targetIndex: baseIndex
            });
            
            insertedCount++;
        }
        
        return results;
    }
    
    /**
     * 🆕 v2.2.0: 레인 설정 가져오기
     * @private
     * @param {string} laneId - 레인 ID
     * @returns {Object} 레인 설정
     */
    _getLaneConfig(laneId) {
        const config = RankingDataManager.LANE_CONFIG[laneId];
        
        if (!config) {
            console.warn(`[RankingDataManager] ⚠️ Unknown lane: ${laneId}, using default config`);
            return {
                status: 'UNKNOWN',
                sortBy: 'duration',
                sortOrder: 'desc',
                icon: '❓',
                label: laneId
            };
        }
        
        return config;
    }
    
    /**
     * 🆕 v2.2.0: 정렬 기준값 추출
     * @private
     * @param {Object} equipment - 설비 데이터
     * @param {string} sortBy - 정렬 기준 ('duration' | 'production')
     * @returns {number} 정렬 기준값
     */
    _getSortValue(equipment, sortBy) {
        if (sortBy === 'production') {
            return equipment.productionCount ?? 
                   equipment.production_count ?? 
                   equipment.currentCount ?? 0;
        }
        
        if (typeof equipment.statusDuration === 'number') {
            return equipment.statusDuration;
        }
        
        const occurredAt = equipment.occurredAt || 
                           equipment.occurredAtUtc || 
                           equipment.statusStartTime;
        
        if (occurredAt) {
            try {
                const startTime = new Date(occurredAt).getTime();
                const now = Date.now();
                return Math.max(0, now - startTime);
            } catch (e) {
                console.warn('[RankingDataManager] ⚠️ Failed to parse occurredAt:', occurredAt);
            }
        }
        
        if (typeof equipment.waitDuration === 'number') {
            return equipment.waitDuration;
        }
        
        return 0;
    }
    
    /**
     * 🆕 v2.2.0: 이진 탐색으로 삽입 위치 결정
     * @private
     */
    _binarySearchInsertIndex(existingEquipments, newValue, sortBy, sortOrder) {
        let left = 0;
        let right = existingEquipments.length;
        
        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            const midValue = this._getSortValue(existingEquipments[mid], sortBy);
            
            if (sortOrder === 'desc') {
                if (midValue > newValue) {
                    left = mid + 1;
                } else {
                    right = mid;
                }
            } else {
                if (midValue < newValue) {
                    left = mid + 1;
                } else {
                    right = mid;
                }
            }
        }
        
        return left;
    }
    
    /**
     * 🆕 v2.2.0: 설비 목록을 레인 기준에 맞게 정렬
     * @private
     */
    _sortEquipmentsByLaneCriteria(laneId, equipments) {
        const { sortBy, sortOrder } = this._getLaneConfig(laneId);
        
        return [...equipments].sort((a, b) => {
            const valueA = this._getSortValue(a, sortBy);
            const valueB = this._getSortValue(b, sortBy);
            
            return sortOrder === 'desc' 
                ? valueB - valueA 
                : valueA - valueB;
        });
    }
    
    /**
     * 🆕 v2.2.0: 오프셋을 고려한 삽입 위치 계산
     * @private
     */
    _calculateInsertIndexWithOffset(laneId, equipment, existingEquipments, offset) {
        const { sortBy, sortOrder } = this._getLaneConfig(laneId);
        const newValue = this._getSortValue(equipment, sortBy);
        
        const baseIndex = this._binarySearchInsertIndex(
            existingEquipments, 
            newValue, 
            sortBy, 
            sortOrder
        );
        
        return baseIndex + offset;
    }
    
    // =========================================================================
    // Public Getters
    // =========================================================================
    
    /**
     * 특정 레인의 설비 목록 조회 (정렬됨)
     * 
     * @param {string} laneId - 레인 ID
     * @returns {Array<Object>} 설비 목록
     */
    getLaneEquipments(laneId) {
        const equipmentIds = this._laneEquipments.get(laneId);
        
        if (!equipmentIds) {
            return [];
        }
        
        return Array.from(equipmentIds)
            .map(id => this._equipments.get(id))
            .filter(Boolean);
    }
    
    /**
     * 모든 레인의 설비 목록 조회
     * 
     * @returns {Map<string, Array<Object>>} 레인별 설비 목록
     */
    getAllLanes() {
        const result = new Map();
        
        for (const laneId of this._laneEquipments.keys()) {
            result.set(laneId, this.getLaneEquipments(laneId));
        }
        
        return result;
    }
    
    /**
     * 특정 설비 조회
     * 
     * @param {string} equipmentId - 설비 ID
     * @returns {Object|null} 설비 데이터
     */
    getEquipment(equipmentId) {
        return this._equipments.get(equipmentId) || null;
    }
    
    /**
     * 🆕 frontendId로 설비 조회
     * 
     * @param {string} frontendId - Frontend ID
     * @returns {Object|null} 설비 데이터
     */
    getEquipmentByFrontendId(frontendId) {
        for (const equipment of this._equipments.values()) {
            if (equipment.frontendId === frontendId) {
                return equipment;
            }
        }
        return null;
    }
    
    /**
     * 특정 레인의 통계 조회
     * 
     * @param {string} laneId - 레인 ID
     * @returns {Object} 통계 정보
     */
    getLaneStats(laneId) {
        return this._statsCache.get(laneId) || this._calculateLaneStats(laneId);
    }
    
    /**
     * 모든 레인 통계 조회
     * 
     * @returns {Map<string, Object>} 레인별 통계
     */
    getAllStats() {
        return new Map(this._statsCache);
    }
    
    /**
     * 전체 설비 수 조회
     * 
     * @returns {number} 설비 수
     */
    getTotalCount() {
        return this._equipments.size;
    }
    
    // =========================================================================
    // Custom Filter (Phase 6) - 기존 기능 유지
    // =========================================================================
    
    /**
     * Custom 필터 추가
     * 사용자 정의 필터 함수를 등록하여 특정 조건의 설비 필터링
     * 
     * @param {string} filterId - 필터 식별자
     * @param {Function} filterFn - 필터 함수 (equipment => boolean)
     * @param {Object} [options] - 추가 옵션
     * @param {string} [options.name] - 필터 표시명
     * @param {string} [options.description] - 필터 설명
     */
    addCustomFilter(filterId, filterFn, options = {}) {
        if (typeof filterFn !== 'function') {
            console.warn(`[RankingDataManager] ⚠️ Invalid filter function for: ${filterId}`);
            return;
        }
        
        this._customFilters.set(filterId, {
            filterFn,
            name: options.name || filterId,
            description: options.description || '',
            createdAt: Date.now()
        });
        
        console.log(`[RankingDataManager] ✅ Added custom filter: ${filterId}`);
        
        // 이벤트 발행
        this._emitEvent(RankingDataManager.EVENTS.CUSTOM_FILTER_UPDATED, {
            action: 'add',
            filterId,
            filterCount: this._customFilters.size
        });
    }
    
    /**
     * Custom 필터 제거
     * 
     * @param {string} filterId - 필터 식별자
     * @returns {boolean} 제거 성공 여부
     */
    removeCustomFilter(filterId) {
        const removed = this._customFilters.delete(filterId);
        
        if (removed) {
            console.log(`[RankingDataManager] 🗑️ Removed custom filter: ${filterId}`);
            
            // 이벤트 발행
            this._emitEvent(RankingDataManager.EVENTS.CUSTOM_FILTER_UPDATED, {
                action: 'remove',
                filterId,
                filterCount: this._customFilters.size
            });
        }
        
        return removed;
    }
    
    /**
     * Custom 필터 적용 데이터 조회
     * 
     * @param {string} filterId - 필터 식별자
     * @returns {Array<Object>} 필터링된 설비 목록
     */
    getFilteredData(filterId) {
        const filter = this._customFilters.get(filterId);
        
        if (!filter) {
            console.warn(`[RankingDataManager] ⚠️ Filter not found: ${filterId}`);
            return [];
        }
        
        return Array.from(this._equipments.values())
            .filter(filter.filterFn);
    }
    
    /**
     * 모든 Custom 필터 목록 조회
     * 
     * @returns {Map<string, Object>} 필터 목록 (filterId → filter info)
     */
    getAllCustomFilters() {
        const result = new Map();
        
        for (const [filterId, filter] of this._customFilters) {
            result.set(filterId, {
                name: filter.name,
                description: filter.description,
                createdAt: filter.createdAt
            });
        }
        
        return result;
    }
    
    /**
     * Custom 필터 존재 여부 확인
     * 
     * @param {string} filterId - 필터 식별자
     * @returns {boolean} 존재 여부
     */
    hasCustomFilter(filterId) {
        return this._customFilters.has(filterId);
    }
    
    /**
     * 모든 Custom 필터 초기화
     */
    clearAllCustomFilters() {
        this._customFilters.clear();
        
        console.log('[RankingDataManager] 🗑️ Cleared all custom filters');
        
        this._emitEvent(RankingDataManager.EVENTS.CUSTOM_FILTER_UPDATED, {
            action: 'clear',
            filterCount: 0
        });
    }
    
    // =========================================================================
    // Utility Methods
    // =========================================================================
    
    /**
     * 이전 레인 할당 저장
     * @private
     */
    _savePreviousLanes() {
        for (const [laneId, equipmentIds] of this._laneEquipments) {
            this._previousLanes.set(laneId, new Set(equipmentIds));
        }
    }
    
    /**
     * 모든 데이터 초기화
     * @private
     */
    _clearAllData() {
        this._equipments.clear();
        this._rankings = [];
        this._laneGroups.clear();
        this._selectedEquipmentId = null;
        this._highlightedEquipmentIds.clear();
        
        for (const laneId of this._laneEquipments.keys()) {
            this._laneEquipments.set(laneId, new Set());
            this._previousLanes.set(laneId, new Set());
            this._statsCache.set(laneId, null);
        }
    }
    
    /**
     * 이벤트 발행
     * @private
     * @param {string} eventName - 이벤트명
     * @param {Object} data - 이벤트 데이터
     */
    _emitEvent(eventName, data) {
        if (this._eventBus) {
            this._eventBus.emit(eventName, data);
        }
    }
    
    /**
     * Remote Alarm Code 추가
     * 동적으로 Remote Alarm Code를 추가할 때 사용
     * 
     * @param {number} code - 알람 코드
     */
    addRemoteAlarmCode(code) {
        RankingDataManager.REMOTE_ALARM_CODES.add(code);
        console.log(`[RankingDataManager] ✅ Added remote alarm code: ${code}`);
    }
    
    /**
     * Remote Alarm Code 제거
     * 
     * @param {number} code - 알람 코드
     */
    removeRemoteAlarmCode(code) {
        RankingDataManager.REMOTE_ALARM_CODES.delete(code);
        console.log(`[RankingDataManager] ✅ Removed remote alarm code: ${code}`);
    }
    
    // =========================================================================
    // 🆕 v2.5.0: Remote Alarm Codes 동적 로드
    // =========================================================================

    /**
     * 🆕 v2.5.0: Backend에서 Remote Alarm Codes 로드
     * @private
     */
    async _loadRemoteAlarmCodes() {
        console.log('[RankingDataManager] 📡 Loading Remote Alarm Codes from Backend...');
        
        try {
            const response = await fetch('/api/uds/remote-alarm-codes');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.codes && Array.isArray(data.codes)) {
                RankingDataManager.REMOTE_ALARM_CODES = new Set(data.codes);
                console.log(`[RankingDataManager] ✅ Loaded ${data.codes.length} Remote Alarm Codes:`, data.codes);
            }
            
        } catch (error) {
            console.warn('[RankingDataManager] ⚠️ Failed to load Remote Alarm Codes, using defaults:', error);
            // Fallback 사용
            RankingDataManager.REMOTE_ALARM_CODES = new Set(RankingDataManager.DEFAULT_REMOTE_ALARM_CODES);
        }
    }

    /**
     * 데이터 수동 새로고침
     */
    refresh() {
        this._sortAllLanes();
        this._updateAllStats();
        this._recalculateRankings();
        this._buildLaneGroups();
        
        this._emitEvent(RankingDataManager.EVENTS.DATA_REFRESHED, {
            totalCount: this._equipments.size,
            laneStats: this.getAllStats()
        });
    }
    
    // =========================================================================
    // Dispose
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('[RankingDataManager] 🗑️ Disposing...');
        
        // 타이머 정리
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        
        if (this._durationTimer) {
            clearInterval(this._durationTimer);
            this._durationTimer = null;
        }
        
        // 이벤트 구독 해제
        for (const unsubscribe of this._eventSubscriptions) {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        }
        this._eventSubscriptions = [];
        
        // 대기열 정리
        this._pendingChanges = [];
        
        // 데이터 정리
        this._clearAllData();
        
        // Custom 필터 정리
        this._customFilters.clear();
        
        // 참조 해제
        this._eventBus = null;
        this._webSocketClient = null;
        
        this._udsInitialized = false;
        
        console.log('[RankingDataManager] ✅ Disposed');
    }
}

// =========================================================================
// Default Export
// =========================================================================
export default RankingDataManager;

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.RankingDataManager = RankingDataManager;
}