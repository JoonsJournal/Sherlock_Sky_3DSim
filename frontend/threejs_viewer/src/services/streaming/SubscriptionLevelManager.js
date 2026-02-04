/**
 * SubscriptionLevelManager.js
 * ============================
 * Context-Aware Streaming 구독 레벨 관리자
 * 
 * @version 1.0.0
 * @description
 * - UI Context에 따른 데이터 구독 레벨 관리
 * - Mode 전환 시 WebSocket 구독 레벨 자동 변경
 * - Panel 열림/닫힘에 따른 선택 설비 상세 데이터 구독
 * - 대역폭 90%+ 절감 효과 (Coding Guidelines 8.4)
 * 
 * @changelog
 * - v1.0.0 (2026-02-04): 최초 구현
 *          - DATA_SUBSCRIPTION_LEVEL 상수 정의
 *          - UI_CONTEXT_SUBSCRIPTION_MAP 테이블 정의
 *          - Mode 전환 / Panel 상태 / Selection 변경 처리
 *          - WebSocket 구독 변경 메시지 전송
 *          - EventBus 연동
 * 
 * @dependencies
 * - ../core/managers/EventBus.js (eventBus)
 * - ../connection/WebSocketPoolManager.js (AppMode - 참조용)
 * 
 * @exports
 * - DATA_SUBSCRIPTION_LEVEL (Object)
 * - UI_CONTEXT_SUBSCRIPTION_MAP (Object)
 * - SubscriptionLevelManager (Class)
 * - getSubscriptionLevelManager (Function - 싱글톤)
 * - resetSubscriptionLevelManager (Function)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/streaming/SubscriptionLevelManager.js
 * 작성일: 2026-02-04
 * 수정일: 2026-02-04
 */

import { eventBus } from '../../core/managers/EventBus.js';

// ============================================
// 데이터 구독 레벨 상수
// ============================================

/**
 * 데이터 구독 레벨 정의
 * @readonly
 * @enum {Object}
 * 
 * @description
 * - MINIMAL: Status만 (~20 bytes/equipment) - 3D View SignalTower용
 * - STANDARD: Status + 기본 메트릭 (~50 bytes/equipment) - Dashboard/Ranking용
 * - DETAILED: 전체 정보 (~500 bytes/equipment) - Panel 상세 정보용
 */
export const DATA_SUBSCRIPTION_LEVEL = Object.freeze({
    /**
     * Level 0: 최소 - Status만 (SignalTower용)
     */
    MINIMAL: Object.freeze({
        name: 'MINIMAL',
        level: 0,
        fields: Object.freeze(['frontend_id', 'status', 'status_changed_at']),
        estimatedSize: '~20 bytes/equipment',
        useCase: '3D View 기본 상태, Panel 닫힘'
    }),
    
    /**
     * Level 1: 표준 - Status + 기본 메트릭
     */
    STANDARD: Object.freeze({
        name: 'STANDARD',
        level: 1,
        fields: Object.freeze([
            'frontend_id', 
            'status', 
            'status_changed_at',
            'cpu_usage_percent', 
            'memory_usage_percent'
        ]),
        estimatedSize: '~50 bytes/equipment',
        useCase: 'Dashboard Summary, Ranking 계산'
    }),
    
    /**
     * Level 2: 상세 - 선택된 설비의 전체 정보
     */
    DETAILED: Object.freeze({
        name: 'DETAILED',
        level: 2,
        fields: Object.freeze(['*']),  // 모든 필드
        estimatedSize: '~500 bytes/equipment',
        useCase: 'Equipment Detail Info Panel'
    })
});

// ============================================
// UI Context별 구독 레벨 매핑
// ============================================

/**
 * UI Context → 구독 레벨 매핑 테이블
 * @readonly
 * 
 * @description
 * - all_equipments: 전체 설비에 적용할 구독 레벨 (null = 구독 안 함)
 * - selected_equipments: 선택된 설비에 적용할 구독 레벨 (null = 선택 없음)
 * - websocketState: WebSocket 상태 ('ACTIVE' | 'PAUSED')
 */
export const UI_CONTEXT_SUBSCRIPTION_MAP = Object.freeze({
    // ─────────────────────────────────────────────────────────────────
    // 3D Monitoring Mode
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * 3D View 기본 - SignalTower만 업데이트
     */
    'MONITORING_3D_VIEW': Object.freeze({
        all_equipments: 'MINIMAL',
        selected_equipments: null,
        description: '3D View 기본 - SignalTower만 업데이트',
        websocketState: 'ACTIVE'
    }),
    
    /**
     * 3D View + Panel 열림 - 선택 설비만 상세
     */
    'MONITORING_3D_VIEW_WITH_PANEL': Object.freeze({
        all_equipments: 'MINIMAL',
        selected_equipments: 'DETAILED',
        description: 'Panel 열림 - 선택 설비만 상세 업데이트',
        websocketState: 'ACTIVE'
    }),
    
    /**
     * 3D View + 다중 선택 - 집계 정보
     */
    'MONITORING_3D_VIEW_MULTI_SELECT': Object.freeze({
        all_equipments: 'MINIMAL',
        selected_equipments: 'STANDARD',
        description: '다중 선택 - 집계 정보 업데이트',
        websocketState: 'ACTIVE'
    }),
    
    // ─────────────────────────────────────────────────────────────────
    // Dashboard Mode
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Dashboard - Site 통계만
     */
    'DASHBOARD': Object.freeze({
        all_equipments: 'MINIMAL',
        selected_equipments: null,
        description: 'Dashboard - Site 통계만',
        websocketState: 'ACTIVE'
    }),
    
    // ─────────────────────────────────────────────────────────────────
    // Ranking Mode
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Ranking View - 순위 데이터만
     */
    'RANKING_VIEW': Object.freeze({
        all_equipments: 'STANDARD',
        selected_equipments: null,
        description: 'Ranking View (Panel 닫힘) - 순위 데이터만',
        websocketState: 'ACTIVE'
    }),
    
    /**
     * Ranking View + Panel - 순위 + 선택 설비 상세
     */
    'RANKING_VIEW_WITH_PANEL': Object.freeze({
        all_equipments: 'STANDARD',
        selected_equipments: 'DETAILED',
        description: 'Ranking View (Panel 열림) - 순위 + 선택 설비 상세',
        websocketState: 'ACTIVE'
    }),
    
    // ─────────────────────────────────────────────────────────────────
    // Analysis Mode (WebSocket 일시 중지)
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Analysis - REST API만 사용, WebSocket PAUSED
     */
    'ANALYSIS': Object.freeze({
        all_equipments: null,
        selected_equipments: null,
        description: 'Analysis - REST API만 사용, WebSocket PAUSED',
        websocketState: 'PAUSED'
    })
});

// ============================================
// Mode → Context 매핑
// ============================================

/**
 * Application Mode → 기본 UI Context 매핑
 * @private
 */
const MODE_TO_DEFAULT_CONTEXT = Object.freeze({
    'MONITORING': 'MONITORING_3D_VIEW',
    'DASHBOARD': 'DASHBOARD',
    'RANKING': 'RANKING_VIEW',
    'ANALYSIS': 'ANALYSIS'
});

// ============================================
// 설정 상수
// ============================================

const CONFIG = Object.freeze({
    /** 데이터 크기 추정 (bytes/equipment) */
    SIZE_ESTIMATION: Object.freeze({
        MINIMAL: 20,
        STANDARD: 50,
        DETAILED: 500
    }),
    
    /** 기본 설비 수 */
    DEFAULT_EQUIPMENT_COUNT: 117
});

// ============================================
// SubscriptionLevelManager 클래스
// ============================================

/**
 * 구독 레벨 관리자
 * 
 * @example
 * // 싱글톤 사용
 * const manager = getSubscriptionLevelManager();
 * 
 * // Mode 전환
 * manager.switchMode('MONITORING');
 * 
 * // Panel 열림
 * manager.onPanelOpen(['EQ-17-03']);
 * 
 * // Panel 닫힘
 * manager.onPanelClose();
 * 
 * // 선택 변경
 * manager.onSelectionChange(['EQ-17-03', 'EQ-18-03']);
 * 
 * // 상태 조회
 * console.log(manager.getStatus());
 */
export class SubscriptionLevelManager {
    // ============================================
    // 이벤트 상수
    // ============================================
    
    /**
     * EventBus 이벤트 이름
     * @static
     * @readonly
     */
    static EVENTS = Object.freeze({
        /** 구독 레벨 변경됨 */
        SUBSCRIPTION_CHANGED: 'subscription:changed',
        
        /** Context 변경됨 */
        CONTEXT_CHANGED: 'subscription:context-changed',
        
        /** Mode 변경됨 */
        MODE_CHANGED: 'subscription:mode-changed',
        
        /** WebSocket 상태 변경 요청 */
        WEBSOCKET_STATE_REQUEST: 'subscription:websocket-state-request'
    });
    
    // ============================================
    // Constructor
    // ============================================
    
    /**
     * @param {Object} [options={}] - 옵션
     * @param {Object} [options.webSocketClient=null] - WebSocket 클라이언트 인스턴스
     * @param {boolean} [options.autoConnect=true] - EventBus 자동 연결 여부
     */
    constructor(options = {}) {
        const { webSocketClient = null, autoConnect = true } = options;
        
        /** @type {Object|null} WebSocket 클라이언트 */
        this._ws = webSocketClient;
        
        /** @type {string} 현재 UI Context */
        this._currentContext = 'MONITORING_3D_VIEW';
        
        /** @type {string} 현재 Application Mode */
        this._currentMode = 'MONITORING';
        
        /** @type {Set<string>} 선택된 설비 ID 목록 */
        this._selectedEquipments = new Set();
        
        /** @type {boolean} Panel 열림 상태 */
        this._isPanelOpen = false;
        
        /** @type {Function[]} 이벤트 리스너 해제 함수 */
        this._unsubscribers = [];
        
        /** @type {boolean} 초기화 완료 여부 */
        this._initialized = false;
        
        // EventBus 자동 연결
        if (autoConnect) {
            this._setupEventListeners();
        }
        
        console.log('📊 [SubscriptionLevelManager] 생성됨', {
            currentMode: this._currentMode,
            currentContext: this._currentContext
        });
    }
    
    // ============================================
    // Getters
    // ============================================
    
    /**
     * 현재 UI Context
     * @type {string}
     */
    get currentContext() {
        return this._currentContext;
    }
    
    /**
     * 현재 Application Mode
     * @type {string}
     */
    get currentMode() {
        return this._currentMode;
    }
    
    /**
     * 선택된 설비 ID 목록
     * @type {string[]}
     */
    get selectedEquipments() {
        return Array.from(this._selectedEquipments);
    }
    
    /**
     * Panel 열림 상태
     * @type {boolean}
     */
    get isPanelOpen() {
        return this._isPanelOpen;
    }
    
    /**
     * 현재 구독 설정
     * @type {Object}
     */
    get currentSubscription() {
        const config = UI_CONTEXT_SUBSCRIPTION_MAP[this._currentContext];
        return {
            context: this._currentContext,
            mode: this._currentMode,
            allLevel: config?.all_equipments || null,
            selectedLevel: config?.selected_equipments || null,
            selectedIds: this.selectedEquipments,
            websocketState: config?.websocketState || 'ACTIVE'
        };
    }
    
    // ============================================
    // WebSocket 설정
    // ============================================
    
    /**
     * WebSocket 클라이언트 설정
     * @param {Object} wsClient - WebSocket 클라이언트
     */
    setWebSocketClient(wsClient) {
        this._ws = wsClient;
        console.log('🔗 [SubscriptionLevelManager] WebSocket 클라이언트 연결됨');
    }
    
    // ============================================
    // Mode 전환
    // ============================================
    
    /**
     * Application Mode 전환
     * @param {string} newMode - 새 Mode ('MONITORING', 'DASHBOARD', 'RANKING', 'ANALYSIS')
     */
    switchMode(newMode) {
        const prevMode = this._currentMode;
        const normalizedMode = newMode.toUpperCase();
        
        // 유효성 검사
        if (!MODE_TO_DEFAULT_CONTEXT[normalizedMode]) {
            console.warn(`⚠️ [SubscriptionLevelManager] Unknown mode: ${newMode}`);
            return;
        }
        
        this._currentMode = normalizedMode;
        
        // 기본 Context로 변경
        const defaultContext = MODE_TO_DEFAULT_CONTEXT[normalizedMode];
        
        // Mode 전환 시 Selection 초기화
        this._selectedEquipments.clear();
        this._isPanelOpen = false;
        
        this.updateContext(defaultContext, []);
        
        // EventBus 이벤트 발행
        eventBus.emit(SubscriptionLevelManager.EVENTS.MODE_CHANGED, {
            previousMode: prevMode,
            currentMode: normalizedMode,
            context: this._currentContext
        });
        
        console.log(`🔄 [SubscriptionLevelManager] Mode 전환: ${prevMode} → ${normalizedMode}`);
    }
    
    // ============================================
    // Context 변경
    // ============================================
    
    /**
     * UI Context 변경
     * @param {string} newContext - 새 UI Context
     * @param {string[]} [selectedIds=[]] - 선택된 설비 ID 목록
     */
    updateContext(newContext, selectedIds = []) {
        const prevContext = this._currentContext;
        
        // 유효성 검사
        if (!UI_CONTEXT_SUBSCRIPTION_MAP[newContext]) {
            console.warn(`⚠️ [SubscriptionLevelManager] Unknown context: ${newContext}`);
            return;
        }
        
        this._currentContext = newContext;
        this._selectedEquipments = new Set(selectedIds);
        
        // WebSocket으로 구독 레벨 변경 요청
        this._sendSubscriptionChange(prevContext, newContext, selectedIds);
        
        // EventBus 이벤트 발행
        eventBus.emit(SubscriptionLevelManager.EVENTS.CONTEXT_CHANGED, {
            previousContext: prevContext,
            currentContext: newContext,
            selectedIds
        });
        
        console.log(
            `📊 [SubscriptionLevelManager] Context 변경: ${prevContext} → ${newContext}, ` +
            `selected: [${selectedIds.join(', ')}]`
        );
    }
    
    // ============================================
    // 3D Monitoring Mode Panel 처리
    // ============================================
    
    /**
     * 3D View에서 Equipment Detail Info Panel 열림
     * @param {string[]} selectedIds - 선택된 설비 ID 목록
     */
    onMonitoringPanelOpen(selectedIds) {
        this._currentMode = 'MONITORING';
        this._isPanelOpen = true;
        this.updateContext('MONITORING_3D_VIEW_WITH_PANEL', selectedIds);
    }
    
    /**
     * 3D View에서 Panel 닫힘
     */
    onMonitoringPanelClose() {
        this._currentMode = 'MONITORING';
        this._isPanelOpen = false;
        this.updateContext('MONITORING_3D_VIEW', []);
    }
    
    // ============================================
    // Ranking Mode Panel 처리
    // ============================================
    
    /**
     * Ranking View에서 Equipment Detail Info Panel 열림
     * @param {string[]} selectedIds - 선택된 설비 ID 목록
     */
    onRankingPanelOpen(selectedIds) {
        this._currentMode = 'RANKING';
        this._isPanelOpen = true;
        this.updateContext('RANKING_VIEW_WITH_PANEL', selectedIds);
    }
    
    /**
     * Ranking View에서 Panel 닫힘
     */
    onRankingPanelClose() {
        this._currentMode = 'RANKING';
        this._isPanelOpen = false;
        this.updateContext('RANKING_VIEW', []);
    }
    
    // ============================================
    // 공통 Panel 처리 (Mode 자동 감지)
    // ============================================
    
    /**
     * 현재 Mode에서 Panel 열림 (Mode 자동 감지)
     * @param {string[]} selectedIds - 선택된 설비 ID 목록
     */
    onPanelOpen(selectedIds) {
        if (!selectedIds || selectedIds.length === 0) {
            console.warn('⚠️ [SubscriptionLevelManager] onPanelOpen: selectedIds is empty');
            return;
        }
        
        this._isPanelOpen = true;
        
        if (this._currentMode === 'RANKING') {
            this.onRankingPanelOpen(selectedIds);
        } else {
            this.onMonitoringPanelOpen(selectedIds);
        }
    }
    
    /**
     * 현재 Mode에서 Panel 닫힘 (Mode 자동 감지)
     */
    onPanelClose() {
        this._isPanelOpen = false;
        
        if (this._currentMode === 'RANKING') {
            this.onRankingPanelClose();
        } else {
            this.onMonitoringPanelClose();
        }
    }
    
    // ============================================
    // Selection 변경 처리
    // ============================================
    
    /**
     * 선택 설비 변경 (Panel 열린 상태에서)
     * @param {string[]} selectedIds - 선택된 설비 ID 목록
     */
    onSelectionChange(selectedIds) {
        const ids = selectedIds || [];
        
        if (ids.length === 0) {
            // 선택 해제 → Panel 닫힘
            this.onPanelClose();
            return;
        }
        
        this._isPanelOpen = true;
        
        if (this._currentMode === 'RANKING') {
            // Ranking Mode
            this.updateContext('RANKING_VIEW_WITH_PANEL', ids);
        } else if (ids.length === 1) {
            // Monitoring Mode - 단일 선택
            this.updateContext('MONITORING_3D_VIEW_WITH_PANEL', ids);
        } else {
            // Monitoring Mode - 다중 선택
            this.updateContext('MONITORING_3D_VIEW_MULTI_SELECT', ids);
        }
    }
    
    // ============================================
    // WebSocket 구독 변경 전송
    // ============================================
    
    /**
     * WebSocket 구독 변경 메시지 전송
     * @private
     * @param {string} prevContext - 이전 Context
     * @param {string} newContext - 새 Context
     * @param {string[]} selectedIds - 선택된 설비 ID
     */
    _sendSubscriptionChange(prevContext, newContext, selectedIds) {
        const config = UI_CONTEXT_SUBSCRIPTION_MAP[newContext];
        if (!config) return;
        
        const payload = {
            type: 'subscription_change',
            payload: {
                context: newContext,
                previous_context: prevContext,
                all_level: config.all_equipments,
                selected_ids: selectedIds,
                selected_level: config.selected_equipments,
                websocket_state: config.websocketState
            }
        };
        
        // WebSocket 전송
        if (this._ws && typeof this._ws.send === 'function') {
            try {
                this._ws.send(JSON.stringify(payload));
                console.log('📤 [SubscriptionLevelManager] 구독 변경 전송:', payload.payload);
            } catch (error) {
                console.error('❌ [SubscriptionLevelManager] 구독 변경 전송 실패:', error);
            }
        }
        
        // EventBus 이벤트 발행 (WebSocket 없어도)
        eventBus.emit(SubscriptionLevelManager.EVENTS.SUBSCRIPTION_CHANGED, payload.payload);
        
        // WebSocket 상태 변경 요청 (PAUSED/ACTIVE)
        eventBus.emit(SubscriptionLevelManager.EVENTS.WEBSOCKET_STATE_REQUEST, {
            state: config.websocketState,
            context: newContext
        });
    }
    
    // ============================================
    // EventBus 연동
    // ============================================
    
    /**
     * EventBus 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // Panel 이벤트 구독 (PanelManager와 연동)
        const unsubPanelOpen = eventBus.on('panel:opened', (data) => {
            const { selectedIds } = data || {};
            if (selectedIds && selectedIds.length > 0) {
                this.onPanelOpen(selectedIds);
            }
        });
        this._unsubscribers.push(unsubPanelOpen);
        
        const unsubPanelClose = eventBus.on('panel:closed', () => {
            this.onPanelClose();
        });
        this._unsubscribers.push(unsubPanelClose);
        
        // Selection 이벤트 구독
        const unsubSelectionChange = eventBus.on('equipment:selection-changed', (data) => {
            const { selectedIds } = data || {};
            this.onSelectionChange(selectedIds || []);
        });
        this._unsubscribers.push(unsubSelectionChange);
        
        // Mode 전환 이벤트 구독 (NavigationController 등에서 발행)
        const unsubModeChange = eventBus.on('app:mode-changed', (data) => {
            const { mode } = data || {};
            if (mode) {
                this.switchMode(mode);
            }
        });
        this._unsubscribers.push(unsubModeChange);
        
        // WebSocket Mode 변경 이벤트 구독 (WebSocketPoolManager와 연동)
        const unsubWsMode = eventBus.on('websocket:mode-changed', (data) => {
            const { currentMode } = data || {};
            if (currentMode && currentMode !== this._currentMode) {
                // WebSocketPoolManager의 AppMode와 동기화
                const modeMap = {
                    'DASHBOARD': 'DASHBOARD',
                    'MONITORING': 'MONITORING',
                    'ANALYSIS': 'ANALYSIS'
                };
                const mode = modeMap[currentMode];
                if (mode) {
                    this.switchMode(mode);
                }
            }
        });
        this._unsubscribers.push(unsubWsMode);
        
        this._initialized = true;
        console.log('🔗 [SubscriptionLevelManager] EventBus 리스너 설정 완료');
    }
    
    // ============================================
    // 유틸리티 메서드
    // ============================================
    
    /**
     * 특정 레벨의 필드 목록 조회
     * @param {string} levelName - 레벨 이름 ('MINIMAL', 'STANDARD', 'DETAILED')
     * @returns {string[]} 필드 목록
     */
    getFieldsForLevel(levelName) {
        const level = DATA_SUBSCRIPTION_LEVEL[levelName];
        return level ? [...level.fields] : [];
    }
    
    /**
     * 현재 Context의 예상 데이터 크기 계산
     * @param {number} [equipmentCount=117] - 설비 수
     * @returns {Object} 예상 데이터 크기 정보
     */
    estimateDataSize(equipmentCount = CONFIG.DEFAULT_EQUIPMENT_COUNT) {
        const config = UI_CONTEXT_SUBSCRIPTION_MAP[this._currentContext];
        if (!config) return { total: 0, description: 'Unknown context' };
        
        let totalBytes = 0;
        const details = [];
        
        // 전체 설비 데이터 크기
        if (config.all_equipments) {
            const bytesPerEquipment = CONFIG.SIZE_ESTIMATION[config.all_equipments] || 0;
            const allBytes = equipmentCount * bytesPerEquipment;
            totalBytes += allBytes;
            details.push(`all(${config.all_equipments}): ${allBytes} bytes`);
        }
        
        // 선택 설비 데이터 크기
        if (config.selected_equipments && this._selectedEquipments.size > 0) {
            const bytesPerEquipment = CONFIG.SIZE_ESTIMATION[config.selected_equipments] || 0;
            const selectedBytes = this._selectedEquipments.size * bytesPerEquipment;
            totalBytes += selectedBytes;
            details.push(`selected(${config.selected_equipments}): ${selectedBytes} bytes`);
        }
        
        return {
            total: totalBytes,
            totalKB: (totalBytes / 1024).toFixed(2),
            details: details.join(', '),
            context: this._currentContext,
            equipmentCount,
            selectedCount: this._selectedEquipments.size
        };
    }
    
    /**
     * 상태 요약 정보 반환
     * @returns {Object}
     */
    getStatus() {
        const config = UI_CONTEXT_SUBSCRIPTION_MAP[this._currentContext];
        return {
            currentMode: this._currentMode,
            currentContext: this._currentContext,
            isPanelOpen: this._isPanelOpen,
            selectedEquipments: this.selectedEquipments,
            allLevel: config?.all_equipments || null,
            selectedLevel: config?.selected_equipments || null,
            websocketState: config?.websocketState || 'UNKNOWN',
            description: config?.description || '',
            estimatedSize: this.estimateDataSize()
        };
    }
    
    /**
     * JSON 직렬화
     * @returns {Object}
     */
    toJSON() {
        return this.getStatus();
    }
    
    // ============================================
    // 정리
    // ============================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        // EventBus 구독 해제
        this._unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._unsubscribers = [];
        
        this._ws = null;
        this._selectedEquipments.clear();
        this._initialized = false;
        
        console.log('🗑️ [SubscriptionLevelManager] 정리 완료');
    }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

/** @type {SubscriptionLevelManager|null} */
let _instance = null;

/**
 * SubscriptionLevelManager 싱글톤 생성/반환
 * @param {Object} [options={}] - 초기화 옵션 (최초 호출 시)
 * @returns {SubscriptionLevelManager}
 */
export function getSubscriptionLevelManager(options = {}) {
    if (!_instance) {
        _instance = new SubscriptionLevelManager(options);
    }
    return _instance;
}

/**
 * 싱글톤 인스턴스 초기화 (테스트용)
 */
export function resetSubscriptionLevelManager() {
    if (_instance) {
        _instance.dispose();
        _instance = null;
    }
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
    window._subscriptionLevelManager = {
        DATA_SUBSCRIPTION_LEVEL,
        UI_CONTEXT_SUBSCRIPTION_MAP,
        SubscriptionLevelManager,
        getSubscriptionLevelManager,
        resetSubscriptionLevelManager
    };
}

// ============================================
// Default Export
// ============================================

export default SubscriptionLevelManager;