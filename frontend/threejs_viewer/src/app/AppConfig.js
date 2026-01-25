/**
 * AppConfig.js
 * =============
 * 애플리케이션 전역 설정 및 상수 관리
 * 
 * @version 1.0.0
 * @description
 * - main.js에서 분리된 독립적 설정 모듈
 * - 모드별 복구 전략 (RECOVERY_STRATEGIES)
 * - Deprecation 경고 설정 (USE_DEPRECATION_WARNINGS)
 * - Site ID 계산 로직 (getSiteId, SITE_ID)
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 1 - 설정/상수 분리 (2026-01-25)
 *           - RECOVERY_STRATEGIES 객체 이동
 *           - USE_DEPRECATION_WARNINGS 플래그 이동
 *           - SITE_ID 계산 로직 이동
 *           - ⚠️ 호환성: main.js 기존 참조 100% 유지
 * 
 * @dependencies
 * - ../core/config/constants.js (APP_MODE)
 * - ../services/ConnectionStatusService.js (ConnectionMode)
 * 
 * @exports
 * - RECOVERY_STRATEGIES: 모드별 재연결 복구 전략
 * - USE_DEPRECATION_WARNINGS: Deprecation 경고 활성화 플래그
 * - SITE_ID: 현재 Site ID (URL 파라미터 또는 기본값)
 * - getSiteId(): Site ID 동적 조회 함수
 * - DEFAULT_SITE_ID: 기본 Site ID 상수
 * 
 * 📁 위치: frontend/threejs_viewer/src/app/AppConfig.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// 의존성 Import
// ============================================
import { APP_MODE } from '../core/config/constants.js';
import { ConnectionMode } from '../services/ConnectionStatusService.js';

// ============================================
// Site ID 설정
// ============================================

/**
 * 기본 Site ID
 * URL 파라미터가 없을 때 사용
 */
export const DEFAULT_SITE_ID = 'default_site';

/**
 * URL 파라미터에서 Site ID 동적 조회
 * 
 * @returns {string} Site ID (URL 파라미터 또는 기본값)
 * 
 * @example
 * // URL: http://localhost:3000/?siteId=VN_FACTORY
 * const siteId = getSiteId(); // 'VN_FACTORY'
 * 
 * // URL: http://localhost:3000/
 * const siteId = getSiteId(); // 'default_site'
 */
export function getSiteId() {
    if (typeof window === 'undefined') {
        return DEFAULT_SITE_ID;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('siteId') || DEFAULT_SITE_ID;
}

/**
 * 현재 Site ID (초기화 시점에 결정)
 * 
 * @constant {string}
 * @description
 * - URL 파라미터 `?siteId=xxx`에서 추출
 * - 파라미터 없으면 'default_site' 사용
 * - 페이지 로드 시 한 번 설정됨
 * 
 * @example
 * import { SITE_ID } from './app/AppConfig.js';
 * console.log(`현재 Site: ${SITE_ID}`);
 */
export const SITE_ID = getSiteId();

// ============================================
// Deprecation 경고 설정
// ============================================

/**
 * Deprecation 경고 활성화 플래그
 * 
 * @constant {boolean}
 * @description
 * true로 설정하면:
 * - window.sceneManager 접근 시 경고 출력
 * - "APP.services.scene.sceneManager 사용 권장" 안내
 * - 동일 변수당 최대 3회 경고 (setDeprecationConfig로 변경 가능)
 * 
 * 🔧 개발/테스트 중에는 false로 유지 후
 *    충분한 테스트 후 true로 전환 권장
 * 
 * @since v6.3.0 (main.js Phase 4 Legacy 마이그레이션)
 * 
 * @example
 * import { USE_DEPRECATION_WARNINGS } from './app/AppConfig.js';
 * 
 * migrateGlobalToNamespace(objects, {
 *     useDeprecation: USE_DEPRECATION_WARNINGS
 * });
 */
export const USE_DEPRECATION_WARNINGS = true;

// ============================================
// 모드별 복구 전략 설정
// ============================================

/**
 * 모드별 재연결 복구 전략 설정
 * 
 * @constant {Object}
 * @description
 * 각 앱 모드에서 Backend 재연결 시 어떤 복구 작업을 수행할지 정의
 * 
 * @property {string} name - 모드 이름 (로깅용)
 * @property {string} connectionMode - ConnectionMode 값
 * @property {number} restartDelay - 복구 전 딜레이 (ms)
 * @property {string[]} actions - 실행할 복구 액션 이름 배열
 * @property {boolean} showToast - Toast 알림 표시 여부
 * @property {string|null} toastMessage - Toast 메시지 (showToast가 true일 때)
 * 
 * @since v5.4.0 (main.js 재연결 복구 로직)
 * 
 * @example
 * import { RECOVERY_STRATEGIES } from './app/AppConfig.js';
 * 
 * const strategy = RECOVERY_STRATEGIES[APP_MODE.MONITORING];
 * console.log(strategy.actions); // ['restartMonitoringService', 'resubscribeWebSocket', 'refreshStatus']
 */
export const RECOVERY_STRATEGIES = {
    /**
     * Monitoring 모드 복구 전략
     * - 가장 빠른 복구 필요 (500ms 딜레이)
     * - WebSocket 재연결 + 상태 새로고침
     */
    [APP_MODE.MONITORING]: {
        name: 'Monitoring',
        connectionMode: ConnectionMode.MONITORING,
        restartDelay: 500,
        actions: ['restartMonitoringService', 'resubscribeWebSocket', 'refreshStatus'],
        showToast: true,
        toastMessage: '🔄 Monitoring 모드 복구 중...'
    },
    
    /**
     * Analysis 모드 복구 전략
     * - 느린 복구 허용 (1000ms 딜레이)
     * - 대용량 데이터 재로드 필요
     */
    [APP_MODE.ANALYSIS]: {
        name: 'Analysis',
        connectionMode: ConnectionMode.ANALYSIS,
        restartDelay: 1000,
        actions: ['reloadAnalysisData', 'reconnectDatabase'],
        showToast: true,
        toastMessage: '🔄 Analysis 데이터 재로드 중...'
    },
    
    /**
     * Dashboard 모드 복구 전략
     * - 중간 속도 복구 (500ms 딜레이)
     * - 캐시 재연결 필요
     */
    [APP_MODE.DASHBOARD]: {
        name: 'Dashboard',
        connectionMode: ConnectionMode.DASHBOARD,
        restartDelay: 500,
        actions: ['refreshDashboard', 'reconnectCache'],
        showToast: true,
        toastMessage: '🔄 Dashboard 새로고침 중...'
    },
    
    /**
     * Equipment Edit 모드 복구 전략
     * - 빠른 복구 (300ms 딜레이)
     * - Mapping API만 재연결
     */
    [APP_MODE.EQUIPMENT_EDIT]: {
        name: 'Edit',
        connectionMode: ConnectionMode.EDIT,
        restartDelay: 300,
        actions: ['reconnectMappingApi'],
        showToast: false,
        toastMessage: null
    },
    
    /**
     * Main Viewer 모드 복구 전략
     * - 복구 불필요 (딜레이 0)
     * - Backend 연결 없이 동작
     */
    [APP_MODE.MAIN_VIEWER]: {
        name: 'MainViewer',
        connectionMode: ConnectionMode.DEFAULT,
        restartDelay: 0,
        actions: [],
        showToast: false,
        toastMessage: null
    }
};

// ============================================
// 복구 액션 이름 상수 (타입 안전성)
// ============================================

/**
 * 복구 액션 이름 열거
 * 
 * @constant {Object}
 * @description
 * RECOVERY_STRATEGIES.actions에서 사용되는 액션 이름 상수
 * 오타 방지 및 자동완성 지원
 * 
 * @example
 * import { RECOVERY_ACTIONS } from './app/AppConfig.js';
 * 
 * if (action === RECOVERY_ACTIONS.RESTART_MONITORING_SERVICE) {
 *     await monitoringService.restart();
 * }
 */
export const RECOVERY_ACTIONS = {
    RESTART_MONITORING_SERVICE: 'restartMonitoringService',
    RESUBSCRIBE_WEBSOCKET: 'resubscribeWebSocket',
    REFRESH_STATUS: 'refreshStatus',
    RELOAD_ANALYSIS_DATA: 'reloadAnalysisData',
    RECONNECT_DATABASE: 'reconnectDatabase',
    REFRESH_DASHBOARD: 'refreshDashboard',
    RECONNECT_CACHE: 'reconnectCache',
    RECONNECT_MAPPING_API: 'reconnectMappingApi'
};

// ============================================
// 설정 조회 유틸리티 함수
// ============================================

/**
 * 특정 모드의 복구 전략 조회
 * 
 * @param {string} mode - APP_MODE 값
 * @returns {Object|null} 복구 전략 객체 또는 null
 * 
 * @example
 * import { getRecoveryStrategy, APP_MODE } from './app/AppConfig.js';
 * 
 * const strategy = getRecoveryStrategy(APP_MODE.MONITORING);
 * if (strategy) {
 *     console.log(strategy.actions);
 * }
 */
export function getRecoveryStrategy(mode) {
    return RECOVERY_STRATEGIES[mode] || null;
}

/**
 * 복구 전략이 있는 모드인지 확인
 * 
 * @param {string} mode - APP_MODE 값
 * @returns {boolean}
 * 
 * @example
 * if (hasRecoveryStrategy(currentMode)) {
 *     await executeRecovery(currentMode);
 * }
 */
export function hasRecoveryStrategy(mode) {
    const strategy = RECOVERY_STRATEGIES[mode];
    return strategy && strategy.actions && strategy.actions.length > 0;
}

// ============================================
// 전역 노출 (하위 호환)
// ============================================

// 브라우저 환경에서 전역 접근 지원
if (typeof window !== 'undefined') {
    // APP 네임스페이스가 없으면 생성
    window.APP = window.APP || {};
    window.APP.config = window.APP.config || {};
    
    // 설정 노출
    window.APP.config.SITE_ID = SITE_ID;
    window.APP.config.RECOVERY_STRATEGIES = RECOVERY_STRATEGIES;
    window.APP.config.USE_DEPRECATION_WARNINGS = USE_DEPRECATION_WARNINGS;
    window.APP.config.getSiteId = getSiteId;
}

// ============================================
// 디버그 정보 출력
// ============================================

/**
 * AppConfig 디버그 정보 출력
 * 
 * @example
 * import { debugAppConfig } from './app/AppConfig.js';
 * debugAppConfig(); // 콘솔에 설정 정보 출력
 */
export function debugAppConfig() {
    console.group('🔧 AppConfig Debug (v1.0.0)');
    console.log('SITE_ID:', SITE_ID);
    console.log('USE_DEPRECATION_WARNINGS:', USE_DEPRECATION_WARNINGS);
    console.log('RECOVERY_STRATEGIES:', Object.keys(RECOVERY_STRATEGIES));
    console.log('RECOVERY_ACTIONS:', RECOVERY_ACTIONS);
    console.groupEnd();
}