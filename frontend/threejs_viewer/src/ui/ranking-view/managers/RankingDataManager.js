/**
 * RankingDataManager.js
 * =====================
 * Ranking View 데이터 가공 및 레인 할당 매니저
 * 
 * @version 1.1.0
 * @description
 * - WebSocket 데이터 수신 및 가공
 * - 설비 상태에 따른 레인 결정
 * - Remote Alarm Code 필터링
 * - 생산중 여부 판단
 * - 레인별 설비 목록 관리
 * - 상태 변경 감지 및 이벤트 발행
 * - Custom Filter 지원 (Phase 6)
 * 
 * @changelog
 * - v1.1.0 (2026-01-19): 가이드라인 준수 + Custom Filter 통합
 *   - 🆕 Custom Filter 기능 추가 (addCustomFilter, removeCustomFilter, getFilteredData)
 *   - static UTIL 추가 (가이드라인 준수)
 *   - ⚠️ 호환성: v1.0.0의 모든 기능/메서드/필드 100% 유지
 * - v1.0.0: 초기 구현
 *   - REMOTE_ALARM_CODES: Remote 알람 코드 목록 정의
 *   - determineLane(): 레인 결정 로직
 *   - isProducing(): 생산중 판단 로직
 *   - processEquipmentData(): 설비 데이터 가공
 *   - handleStatusChange(): WebSocket 상태 변경 처리
 *   - getLaneEquipments(): 레인별 설비 목록 조회
 * 
 * @dependencies
 * - LaneSorter (../utils/LaneSorter.js)
 * - DurationCalculator (../utils/DurationCalculator.js)
 * - EventBus (../../../core/managers/EventBus.js)
 * 
 * @exports
 * - RankingDataManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/RankingDataManager.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-19
 */

import { LaneSorter } from '../utils/LaneSorter.js';
import { DurationCalculator } from '../utils/DurationCalculator.js';

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
    static REMOTE_ALARM_CODES = new Set([
        61,     // Remote Alarm 1
        62,     // Remote Alarm 2
        86,     // Remote Alarm 3
        10047,  // BLADE BROKEN
        10048,  // Remote Alarm 5
        10051,  // Remote Alarm 6
        10052,  // Remote Alarm 7
        10055,  // Remote Alarm 8
        10056,  // Remote Alarm 9
        10057,  // Remote Alarm 10
        10058,  // Remote Alarm 11
        10077   // Remote Alarm 12
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
        CUSTOM_FILTER_UPDATED: 'ranking:custom-filter:updated'  // 🆕 v1.1.0
    };
    
    /**
     * 설정
     */
    static CONFIG = {
        DEBOUNCE_MS: 100,           // 상태 변경 디바운스 시간
        UPDATE_INTERVAL_MS: 2000,   // 지속 시간 업데이트 주기
        MAX_BATCH_SIZE: 50          // 최대 일괄 처리 개수
    };
    
    /**
     * 🆕 v1.1.0: Utility 클래스 상수 (가이드라인 준수)
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
     */
    constructor(options = {}) {
        this._options = options;
        this._eventBus = options.eventBus || null;
        this._webSocketClient = options.webSocketClient || null;
        
        // 내부 데이터 저장소
        this._equipments = new Map();        // equipmentId → equipment data
        this._laneEquipments = new Map();    // laneId → Set<equipmentId>
        this._previousLanes = new Map();     // 이전 레인 할당 (변경 감지용)
        
        // 변경 대기열 (디바운스용)
        this._pendingChanges = [];
        this._debounceTimer = null;
        
        // 지속 시간 업데이트 타이머
        this._durationTimer = null;
        
        // 이벤트 구독 목록 (dispose 시 해제용)
        this._eventSubscriptions = [];
        
        // 통계 캐시
        this._statsCache = new Map();
        
        // 🆕 v1.1.0: Custom Filter (Phase 6)
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
        console.log('[RankingDataManager] 🚀 Initializing v1.1.0...');
        
        // 레인 Map 초기화
        this._initializeLanes();
        
        // 이벤트 구독 설정
        this._setupEventListeners();
        
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
        
        // WebSocket 이벤트 구독
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
    
    // =========================================================================
    // Data Loading
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
     * 우선순위:
     * 1. 비생산 상태 → WAIT
     * 2. SUDDENSTOP + Remote Alarm → REMOTE
     * 3. SUDDENSTOP + 일반 Alarm → SUDDEN_STOP
     * 4. 기타 상태 → 해당 상태 레인
     * 
     * @param {Object} equipment - 가공된 설비 데이터
     * @returns {string} 레인 ID
     */
    determineLane(equipment) {
        const { status, alarmCode, isProducing } = equipment;
        
        // 1. 비생산 상태 → WAIT 레인
        if (!isProducing) {
            return RankingDataManager.LANE_IDS.WAIT;
        }
        
        // 2. SUDDENSTOP 상태 처리
        if (status === RankingDataManager.STATUS.SUDDENSTOP) {
            // Remote Alarm Code 체크
            if (alarmCode && RankingDataManager.REMOTE_ALARM_CODES.has(alarmCode)) {
                return RankingDataManager.LANE_IDS.REMOTE;
            }
            
            return RankingDataManager.LANE_IDS.SUDDEN_STOP;
        }
        
        // 3. 기타 상태별 레인 결정
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
                
            default:
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
    // Status Change Handling
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
        
        for (const change of changes) {
            const result = this._applyChange(change);
            
            if (result && result.moved) {
                movedEquipments.push(result);
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
    // 🆕 v1.1.0: Custom Filter (Phase 6)
    // =========================================================================
    
    /**
     * 🆕 Custom 필터 추가
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
     * 🆕 Custom 필터 제거
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
     * 🆕 Custom 필터 적용 데이터 조회
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
     * 🆕 모든 Custom 필터 목록 조회
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
     * 🆕 Custom 필터 존재 여부 확인
     * 
     * @param {string} filterId - 필터 식별자
     * @returns {boolean} 존재 여부
     */
    hasCustomFilter(filterId) {
        return this._customFilters.has(filterId);
    }
    
    /**
     * 🆕 모든 Custom 필터 초기화
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
    
    /**
     * 데이터 수동 새로고침
     */
    refresh() {
        this._sortAllLanes();
        this._updateAllStats();
        
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
        
        // 🆕 v1.1.0: Custom 필터 정리
        this._customFilters.clear();
        
        // 참조 해제
        this._eventBus = null;
        this._webSocketClient = null;
        
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