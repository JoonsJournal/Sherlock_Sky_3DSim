/**
 * constants.js
 * 애플리케이션 전역 상수 정의
 * 
 * @version 1.2.0
 * @description 모든 상수는 이 파일에서 중앙 관리
 * 
 * @changelog
 * - v1.2.0: 🆕 KEYBOARD_CONTEXT.RANKING_VIEW 추가 (2026-01-17) - Phase 5
 *           - Ranking View 전용 키보드 컨텍스트
 *           - ⚠️ 호환성: 기존 모든 상수 100% 유지
 * - v1.1.0: 🆕 APP_MODE에 ANALYTICS, PLAYBACK, SIMULATION, SETTINGS 추가 (2026-01-13)
 *           - Analysis 모드 활성화 지원
 */

// =====================================================
// 애플리케이션 모드
// =====================================================

export const APP_MODE = Object.freeze({
    MAIN_VIEWER: 'main_viewer',       // 기본 3D 뷰어 모드
    LAYOUT_EDIT_2D: 'layout_edit_2d', // 2D 레이아웃 편집 모드
    LAYOUT_EDIT_3D: 'layout_edit_3d', // 3D 레이아웃 편집 모드
    EQUIPMENT_EDIT: 'equipment_edit', // 장비 편집 모드
    MONITORING: 'monitoring',         // 실시간 모니터링 모드
    CONNECTION: 'connection',         // 연결 설정 (오버레이)
    // 🆕 v1.1.0: 추가된 모드
    ANALYTICS: 'analytics',           // 분석 모드
    PLAYBACK: 'playback',             // 재생 모드
    SIMULATION: 'simulation',         // 시뮬레이션 모드
    SETTINGS: 'settings',             // 설정 모드
    // 🆕 v1.2.0: Ranking View 모드 (Monitoring의 서브모드)
    RANKING_VIEW: 'ranking_view'      // Ranking View 모드
});

// =====================================================
// 객체 상태
// =====================================================

export const OBJECT_STATE = Object.freeze({
    NORMAL: 'normal',
    HOVER: 'hover',
    SELECTED: 'selected',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    LOCKED: 'locked',
    ERROR: 'error',
    CONSTRUCTION: 'construction'
});

// =====================================================
// 장비 상태 (모니터링용)
// =====================================================

export const EQUIPMENT_STATUS = Object.freeze({
    RUNNING: 'running',
    IDLE: 'idle',
    ALARM: 'alarm',
    MAINTENANCE: 'maintenance',
    OFFLINE: 'offline',
    UNKNOWN: 'unknown'
});

// =====================================================
// Signal Tower 상태
// =====================================================

export const SIGNAL_TOWER_STATUS = Object.freeze({
    RUN: 'RUN',
    IDLE: 'IDLE',
    STOP: 'STOP',
    OFF: 'OFF'
});

// =====================================================
// 2D Editor 도구
// =====================================================

export const EDITOR_TOOL = Object.freeze({
    SELECT: 'select',
    WALL: 'wall',
    PARTITION: 'partition',
    ROOM: 'room',
    OFFICE: 'office',
    EQUIPMENT_ARRAY: 'equipment-array',
    CLEAR: 'clear'
});

// =====================================================
// 선택 모드 (2D Editor)
// =====================================================

export const SELECTION_MODE = Object.freeze({
    SINGLE: 'single',
    MULTI: 'multi',
    WINDOW: 'window',   // 좌→우 드래그 (완전 포함)
    CROSSING: 'crossing' // 우→좌 드래그 (걸치면 선택)
});

// =====================================================
// 키보드 컨텍스트
// =====================================================

export const KEYBOARD_CONTEXT = Object.freeze({
    GLOBAL: 'global',
    VIEWER_3D: 'viewer_3d',
    EDITOR_2D: 'editor_2d',
    MODAL: 'modal',
    // 🆕 v1.2.0: Ranking View 컨텍스트 추가
    RANKING_VIEW: 'ranking_view'
});

// =====================================================
// 이벤트 이름
// =====================================================

export const EVENT_NAME = Object.freeze({
    // 모드 관련
    MODE_CHANGE: 'mode:change',
    MODE_BEFORE_CHANGE: 'mode:beforeChange',
    
    // 선택 관련
    SELECTION_CHANGE: 'selection:change',
    SELECTION_CLEAR: 'selection:clear',
    
    // 장비 관련
    EQUIPMENT_CLICK: 'equipment:click',
    EQUIPMENT_DBLCLICK: 'equipment:dblclick',
    EQUIPMENT_HOVER: 'equipment:hover',
    EQUIPMENT_STATUS_UPDATE: 'equipment:statusUpdate',
    
    // 레이아웃 관련
    LAYOUT_LOAD: 'layout:load',
    LAYOUT_SAVE: 'layout:save',
    LAYOUT_CHANGE: 'layout:change',
    
    // 연결 관련
    CONNECTION_STATUS: 'connection:status',
    CONNECTION_CHANGE: 'connection:change',
    
    // ⭐ 매핑 관련 (신규 추가)
    MAPPING_CHANGE: 'mapping:change',
    MAPPING_SAVED: 'mapping:saved',
    MAPPING_LOADED: 'mapping:loaded',
    MAPPING_VALIDATED: 'mapping:validated',
    
    // 🆕 v1.2.0: Ranking View 관련 이벤트
    RANKING_SHOW: 'ranking:show',
    RANKING_HIDE: 'ranking:hide',
    RANKING_LANE_FOCUS: 'ranking:lane:focus',
    RANKING_CARD_SELECT: 'ranking:card:select',
    RANKING_ESCAPE: 'ranking:escape',
    
    // UI 관련
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
    TOAST_SHOW: 'toast:show',
    
    // 에러 관련
    ERROR: 'error',
    WARNING: 'warning'
});

// =====================================================
// API 엔드포인트
// =====================================================

export const API_ENDPOINTS = Object.freeze({
    // Health
    HEALTH: '/health',
    
    // Connection
    CONNECTION_PROFILES: '/connections/profiles',
    CONNECTION_SITE_PROFILES: '/connections/site-profiles',
    CONNECTION_STATUS: '/connections/status',
    CONNECTION_STATUS_LIST: '/connections/connection-status',
    CONNECTION_CONNECT: '/connections/connect',
    CONNECTION_DISCONNECT: '/connections/disconnect',
    CONNECTION_DATABASE_INFO: '/connections/database-info',
    
    // Equipment
    EQUIPMENT_LIST: '/equipment',
    EQUIPMENT_NAMES: '/equipment/names',
    EQUIPMENT_STATUS: '/equipment/status',
    
    // ⭐ Equipment Mapping (신규 추가)
    EQUIPMENT_MAPPING: '/equipment/mapping',
    EQUIPMENT_MAPPING_VALIDATE: '/equipment/mapping/validate',
    
    // Layout
    LAYOUT_GET: '/layout',
    LAYOUT_SAVE: '/layout/save',
    LAYOUT_TEMPLATES: '/layout/templates',
    
    // Monitoring
    MONITORING_REALTIME: '/monitoring/realtime',
    MONITORING_HISTORY: '/monitoring/history',
    
    // Analytics
    ANALYTICS_SUMMARY: '/analytics/summary',
    ANALYTICS_TREND: '/analytics/trend'
});

// =====================================================
// WebSocket 메시지 타입
// =====================================================

export const WS_MESSAGE_TYPE = Object.freeze({
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    STATUS_UPDATE: 'status_update',
    ALARM: 'alarm',
    HEARTBEAT: 'heartbeat'
});

// =====================================================
// 로컬 스토리지 키
// =====================================================

export const STORAGE_KEY = Object.freeze({
    LAST_CONNECTED_SITE: 'sherlock_lastConnectedSite',
    AUTO_CONNECT: 'sherlock_autoConnect',
    DEBUG_MODE: 'sherlock_debugMode',
    CAMERA_POSITION: 'sherlock_cameraPosition',
    UI_PREFERENCES: 'sherlock_uiPreferences',
    // ⭐ 매핑 관련 (신규 추가)
    EQUIPMENT_MAPPINGS: 'sherlock_equipment_mappings',
    // 🆕 v1.2.0: Ranking View 관련
    RANKING_VIEW_PREFERENCES: 'sherlock_ranking_view_preferences'
});

// =====================================================
// 기타 상수
// =====================================================

export const DEFAULTS = Object.freeze({
    ANIMATION_DURATION: 200,       // ms
    TOAST_DURATION: 3000,          // ms
    DEBOUNCE_DELAY: 150,           // ms
    HEALTH_CHECK_INTERVAL: 30000,  // ms
    MAX_RETRY_COUNT: 3,
    SNAP_THRESHOLD: 15,            // px
    // ⭐ 매핑 관련 (신규 추가)
    TOTAL_EQUIPMENTS: 117,         // 전체 설비 수
    MAPPING_CACHE_DURATION: 300000, // 5분 (ms)
    // 🆕 v1.2.0: Ranking View 관련
    RANKING_LANE_COUNT: 6,         // 레인 수
    RANKING_UPDATE_INTERVAL: 2000  // 카드 업데이트 주기 (ms)
});

// =====================================================
// 🆕 v1.2.0: Ranking View 레인 설정
// =====================================================

export const RANKING_LANE_CONFIG = Object.freeze({
    REMOTE: {
        id: 'remote',
        name: 'Remote',
        index: 0,
        key: '1'
    },
    SUDDEN_STOP: {
        id: 'sudden-stop',
        name: 'Sudden Stop',
        index: 1,
        key: '2'
    },
    STOP: {
        id: 'stop',
        name: 'Stop',
        index: 2,
        key: '3'
    },
    RUN: {
        id: 'run',
        name: 'Run',
        index: 3,
        key: '4'
    },
    IDLE: {
        id: 'idle',
        name: 'Idle',
        index: 4,
        key: '5'
    },
    WAIT: {
        id: 'wait',
        name: 'Wait',
        index: 5,
        key: '6'
    }
});