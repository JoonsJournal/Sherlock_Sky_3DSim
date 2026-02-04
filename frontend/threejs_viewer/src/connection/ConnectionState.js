/**
 * ConnectionState.js
 * ==================
 * WebSocket 연결 상태 FSM (Finite State Machine) 관리
 * 
 * @version 1.0.0
 * @description
 * - Site별 WebSocket 연결 상태 정의 및 관리
 * - 상태 전환 로직 (State Transition)
 * - 상태별 허용 액션 정의
 * 
 * @changelog
 * - v1.0.0: Phase 3 - WebSocket Pool Manager 구현 (2026-02-04)
 *           - ConnectionState Enum 정의
 *           - ConnectionStateMachine 클래스 구현
 *           - 상태 전환 유효성 검증
 * 
 * @dependencies
 * - ../core/managers/EventBus.js (eventBus)
 * 
 * @exports
 * - ConnectionState (Enum)
 * - ConnectionStateMachine (Class)
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/ConnectionState.js
 * 작성일: 2026-02-04
 * 수정일: 2026-02-04
 */

// ============================================
// 연결 상태 Enum
// ============================================

/**
 * WebSocket 연결 상태 정의
 * @readonly
 * @enum {string}
 */
export const ConnectionState = Object.freeze({
    /** 연결 없음 */
    DISCONNECTED: 'DISCONNECTED',
    
    /** 연결 시도 중 */
    CONNECTING: 'CONNECTING',
    
    /** Summary 데이터만 수신 (30초/60초 간격) */
    CONNECTED_SUMMARY: 'CONNECTED_SUMMARY',
    
    /** Full 데이터 수신 (10초 간격) */
    CONNECTED_FULL: 'CONNECTED_FULL',
    
    /** 연결 유지, 데이터 수신 중단 */
    PAUSED: 'PAUSED',
    
    /** 재연결 시도 중 (Exponential Backoff) */
    RECONNECTING: 'RECONNECTING',
    
    /** 에러 상태 */
    ERROR: 'ERROR'
});

// ============================================
// 상태 전환 정의
// ============================================

/**
 * 허용된 상태 전환 매트릭스
 * @type {Object.<string, string[]>}
 */
const ALLOWED_TRANSITIONS = Object.freeze({
    [ConnectionState.DISCONNECTED]: [
        ConnectionState.CONNECTING
    ],
    [ConnectionState.CONNECTING]: [
        ConnectionState.CONNECTED_SUMMARY,
        ConnectionState.CONNECTED_FULL,
        ConnectionState.ERROR,
        ConnectionState.DISCONNECTED
    ],
    [ConnectionState.CONNECTED_SUMMARY]: [
        ConnectionState.CONNECTED_FULL,
        ConnectionState.PAUSED,
        ConnectionState.RECONNECTING,
        ConnectionState.DISCONNECTED
    ],
    [ConnectionState.CONNECTED_FULL]: [
        ConnectionState.CONNECTED_SUMMARY,
        ConnectionState.PAUSED,
        ConnectionState.RECONNECTING,
        ConnectionState.DISCONNECTED
    ],
    [ConnectionState.PAUSED]: [
        ConnectionState.CONNECTED_SUMMARY,
        ConnectionState.CONNECTED_FULL,
        ConnectionState.DISCONNECTED
    ],
    [ConnectionState.RECONNECTING]: [
        ConnectionState.CONNECTING,
        ConnectionState.DISCONNECTED,
        ConnectionState.ERROR
    ],
    [ConnectionState.ERROR]: [
        ConnectionState.CONNECTING,
        ConnectionState.DISCONNECTED
    ]
});

// ============================================
// 상태 정보
// ============================================

/**
 * 상태별 메타데이터
 * @type {Object.<string, Object>}
 */
const STATE_INFO = Object.freeze({
    [ConnectionState.DISCONNECTED]: {
        label: '연결 끊김',
        icon: '⚫',
        color: '#6c757d',
        canReceiveData: false
    },
    [ConnectionState.CONNECTING]: {
        label: '연결 중...',
        icon: '🔄',
        color: '#ffc107',
        canReceiveData: false
    },
    [ConnectionState.CONNECTED_SUMMARY]: {
        label: 'Summary 연결',
        icon: '📊',
        color: '#17a2b8',
        canReceiveData: true
    },
    [ConnectionState.CONNECTED_FULL]: {
        label: 'Full 연결',
        icon: '🟢',
        color: '#28a745',
        canReceiveData: true
    },
    [ConnectionState.PAUSED]: {
        label: '일시 정지',
        icon: '⏸️',
        color: '#6c757d',
        canReceiveData: false
    },
    [ConnectionState.RECONNECTING]: {
        label: '재연결 중...',
        icon: '🔄',
        color: '#fd7e14',
        canReceiveData: false
    },
    [ConnectionState.ERROR]: {
        label: '에러',
        icon: '❌',
        color: '#dc3545',
        canReceiveData: false
    }
});

// ============================================
// ConnectionStateMachine 클래스
// ============================================

/**
 * WebSocket 연결 상태 머신
 * 
 * @example
 * const stateMachine = new ConnectionStateMachine('CN_AAAA');
 * stateMachine.onStateChange((oldState, newState) => {
 *     console.log(`State changed: ${oldState} → ${newState}`);
 * });
 * stateMachine.transitionTo(ConnectionState.CONNECTING);
 */
export class ConnectionStateMachine {
    /**
     * @param {string} siteId - Site ID
     * @param {ConnectionState} [initialState=ConnectionState.DISCONNECTED] - 초기 상태
     */
    constructor(siteId, initialState = ConnectionState.DISCONNECTED) {
        this._siteId = siteId;
        this._currentState = initialState;
        this._previousState = null;
        this._stateHistory = [];
        this._listeners = [];
        this._maxHistoryLength = 50;
        
        // 초기 상태 기록
        this._recordStateChange(null, initialState);
    }
    
    // ============================================
    // Getters
    // ============================================
    
    /**
     * Site ID
     * @type {string}
     */
    get siteId() {
        return this._siteId;
    }
    
    /**
     * 현재 상태
     * @type {ConnectionState}
     */
    get currentState() {
        return this._currentState;
    }
    
    /**
     * 이전 상태
     * @type {ConnectionState|null}
     */
    get previousState() {
        return this._previousState;
    }
    
    /**
     * 상태 히스토리
     * @type {Array<{state: ConnectionState, timestamp: Date}>}
     */
    get stateHistory() {
        return [...this._stateHistory];
    }
    
    /**
     * 현재 상태 정보 (label, icon, color 등)
     * @type {Object}
     */
    get stateInfo() {
        return STATE_INFO[this._currentState];
    }
    
    /**
     * 연결된 상태인지 확인
     * @type {boolean}
     */
    get isConnected() {
        return [
            ConnectionState.CONNECTED_SUMMARY,
            ConnectionState.CONNECTED_FULL,
            ConnectionState.PAUSED
        ].includes(this._currentState);
    }
    
    /**
     * 데이터 수신 가능한 상태인지 확인
     * @type {boolean}
     */
    get canReceiveData() {
        return STATE_INFO[this._currentState]?.canReceiveData ?? false;
    }
    
    // ============================================
    // 상태 전환
    // ============================================
    
    /**
     * 상태 전환
     * @param {ConnectionState} newState - 새 상태
     * @param {Object} [metadata={}] - 추가 메타데이터
     * @returns {boolean} 전환 성공 여부
     * @throws {Error} 유효하지 않은 상태 전환 시
     */
    transitionTo(newState, metadata = {}) {
        // 동일 상태로의 전환은 무시
        if (this._currentState === newState) {
            console.log(`🔄 [${this._siteId}] 동일 상태 유지: ${newState}`);
            return true;
        }
        
        // 전환 유효성 검증
        if (!this.canTransitionTo(newState)) {
            const errorMsg = `Invalid state transition: ${this._currentState} → ${newState}`;
            console.error(`❌ [${this._siteId}] ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        const oldState = this._currentState;
        this._previousState = oldState;
        this._currentState = newState;
        
        // 상태 기록
        this._recordStateChange(oldState, newState, metadata);
        
        // 리스너 호출
        this._notifyListeners(oldState, newState, metadata);
        
        console.log(`✅ [${this._siteId}] 상태 전환: ${oldState} → ${newState}`);
        
        return true;
    }
    
    /**
     * 상태 전환 가능 여부 확인
     * @param {ConnectionState} targetState - 대상 상태
     * @returns {boolean}
     */
    canTransitionTo(targetState) {
        const allowedStates = ALLOWED_TRANSITIONS[this._currentState];
        return allowedStates?.includes(targetState) ?? false;
    }
    
    /**
     * 허용된 다음 상태 목록 반환
     * @returns {ConnectionState[]}
     */
    getAllowedTransitions() {
        return [...(ALLOWED_TRANSITIONS[this._currentState] || [])];
    }
    
    // ============================================
    // 이벤트 리스너
    // ============================================
    
    /**
     * 상태 변경 리스너 등록
     * @param {Function} callback - (oldState, newState, metadata) => void
     * @returns {Function} 리스너 제거 함수
     */
    onStateChange(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        this._listeners.push(callback);
        
        // 제거 함수 반환
        return () => {
            const index = this._listeners.indexOf(callback);
            if (index > -1) {
                this._listeners.splice(index, 1);
            }
        };
    }
    
    /**
     * 모든 리스너 제거
     */
    removeAllListeners() {
        this._listeners = [];
    }
    
    // ============================================
    // 상태 초기화
    // ============================================
    
    /**
     * 상태 초기화 (DISCONNECTED로 리셋)
     */
    reset() {
        const oldState = this._currentState;
        this._currentState = ConnectionState.DISCONNECTED;
        this._previousState = oldState;
        
        this._recordStateChange(oldState, ConnectionState.DISCONNECTED, { reason: 'reset' });
        this._notifyListeners(oldState, ConnectionState.DISCONNECTED, { reason: 'reset' });
        
        console.log(`🔄 [${this._siteId}] 상태 초기화: ${oldState} → DISCONNECTED`);
    }
    
    // ============================================
    // Private Methods
    // ============================================
    
    /**
     * 상태 변경 기록
     * @private
     */
    _recordStateChange(oldState, newState, metadata = {}) {
        const record = {
            oldState,
            newState,
            timestamp: new Date(),
            metadata
        };
        
        this._stateHistory.push(record);
        
        // 히스토리 길이 제한
        if (this._stateHistory.length > this._maxHistoryLength) {
            this._stateHistory.shift();
        }
    }
    
    /**
     * 리스너 알림
     * @private
     */
    _notifyListeners(oldState, newState, metadata) {
        for (const listener of this._listeners) {
            try {
                listener(oldState, newState, metadata);
            } catch (error) {
                console.error(`❌ [${this._siteId}] 리스너 에러:`, error);
            }
        }
    }
    
    // ============================================
    // 유틸리티
    // ============================================
    
    /**
     * 디버그 정보 출력
     * @returns {Object}
     */
    toDebugInfo() {
        return {
            siteId: this._siteId,
            currentState: this._currentState,
            previousState: this._previousState,
            stateInfo: this.stateInfo,
            isConnected: this.isConnected,
            canReceiveData: this.canReceiveData,
            allowedTransitions: this.getAllowedTransitions(),
            historyLength: this._stateHistory.length,
            listenersCount: this._listeners.length
        };
    }
    
    /**
     * JSON 직렬화
     * @returns {Object}
     */
    toJSON() {
        return {
            siteId: this._siteId,
            currentState: this._currentState,
            previousState: this._previousState,
            stateInfo: this.stateInfo
        };
    }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 상태 정보 조회
 * @param {ConnectionState} state - 상태
 * @returns {Object} 상태 정보
 */
export function getStateInfo(state) {
    return STATE_INFO[state] || null;
}

/**
 * 연결 상태 여부 확인
 * @param {ConnectionState} state - 상태
 * @returns {boolean}
 */
export function isConnectedState(state) {
    return [
        ConnectionState.CONNECTED_SUMMARY,
        ConnectionState.CONNECTED_FULL,
        ConnectionState.PAUSED
    ].includes(state);
}

/**
 * 데이터 수신 가능 상태 여부 확인
 * @param {ConnectionState} state - 상태
 * @returns {boolean}
 */
export function canReceiveDataInState(state) {
    return STATE_INFO[state]?.canReceiveData ?? false;
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
    window._connectionState = {
        ConnectionState,
        ConnectionStateMachine,
        getStateInfo,
        isConnectedState,
        canReceiveDataInState,
        ALLOWED_TRANSITIONS,
        STATE_INFO
    };
}
