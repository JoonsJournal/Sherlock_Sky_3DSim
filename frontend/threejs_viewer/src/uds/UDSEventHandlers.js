/**
 * UDSEventHandlers.js
 * ====================
 * UDS 이벤트 핸들러 및 유틸리티
 * 
 * @version 1.0.0
 * @description
 * - UDS Delta Update → SignalTower 연동
 * - UDS Stats → StatusBar 형식 변환
 * - UDS 배치 업데이트 로깅
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 7 - UDS 이벤트 분리 (2026-01-26)
 *           - _setupUDSEventListeners() 이동
 *           - _convertUDSStatsToStatusBar() 이동
 *           - ⚠️ 호환성: 기존 UDS 이벤트 동작 100% 유지
 * 
 * @dependencies
 * - services/uds/UnifiedDataStore.js
 * - core/managers/EventBus.js
 * - app/AppState.js
 * 
 * @exports
 * - setupUDSEventListeners
 * - convertUDSStatsToStatusBar
 * 
 * 📁 위치: frontend/threejs_viewer/src/uds/UDSEventHandlers.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { UnifiedDataStore } from '../services/uds/index.js';
import { eventBus } from '../core/managers/EventBus.js';
import { services } from '../app/AppState.js';

// ============================================
// Stats 변환 유틸리티
// ============================================

/**
 * UDS Stats → StatusBar 형식 변환
 * 
 * @param {Object} udsStats - UDS 통계 { RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED, TOTAL }
 * @param {number} [totalCount] - 전체 설비 수 (없으면 udsStats.TOTAL 사용)
 * @returns {Object} StatusBar 형식 통계
 * 
 * @example
 * const statusBarStats = convertUDSStatsToStatusBar(udsStats, 117);
 */
export function convertUDSStatsToStatusBar(udsStats, totalCount = null) {
    const total = totalCount || udsStats.TOTAL || 0;
    const disconnected = udsStats.DISCONNECTED || 0;
    const connected = total - disconnected;
    
    return {
        // StatusBar 기본 필드
        total: total,
        mapped: total,           // UDS에서 로드된 설비는 모두 매핑됨
        unmapped: 0,             // 미매핑 없음
        rate: total > 0 ? 100 : 0,  // 매핑 완료율 100%
        connected: connected,
        disconnected: disconnected,
        
        // StatusBar가 기대하는 형식 (소문자 + statusCounts 객체)
        statusCounts: {
            run: udsStats.RUN || 0,
            idle: udsStats.IDLE || 0,
            stop: udsStats.STOP || 0,
            suddenstop: udsStats.SUDDENSTOP || 0,
            disconnected: disconnected
        }
    };
}

// ============================================
// UDS 이벤트 리스너 설정
// ============================================

/**
 * UDS Delta Update → SignalTower 연동
 * 
 * setupConnectionEvents()에서 호출됨
 * 
 * @returns {Function} cleanup 함수
 * 
 * @example
 * const cleanupUDS = setupUDSEventListeners();
 * // 정리 시
 * cleanupUDS();
 */
export function setupUDSEventListeners() {
    const handlers = [];
    
    // ─────────────────────────────────────────────────────────────────────────
    // UDS Delta 수신 시 SignalTower 업데이트
    // ─────────────────────────────────────────────────────────────────────────
    const equipmentUpdatedHandler = (event) => {
        const { frontendId, changes } = event;
        
        const signalTowerManager = services.monitoring?.signalTowerManager;
        if (signalTowerManager && changes.status) {
            signalTowerManager.updateFromUDSDelta(frontendId, changes);
        }
    };
    eventBus.on(UnifiedDataStore.EVENTS.EQUIPMENT_UPDATED, equipmentUpdatedHandler);
    handlers.push(() => eventBus.off(UnifiedDataStore.EVENTS.EQUIPMENT_UPDATED, equipmentUpdatedHandler));
    
    // ─────────────────────────────────────────────────────────────────────────
    // UDS 통계 변경 시 StatusBar 업데이트
    // ─────────────────────────────────────────────────────────────────────────
    const statsUpdatedHandler = (event) => {
        const statusBarStats = convertUDSStatsToStatusBar(event.stats);
        eventBus.emit('monitoring:stats-update', statusBarStats);
    };
    eventBus.on(UnifiedDataStore.EVENTS.STATS_UPDATED, statsUpdatedHandler);
    handlers.push(() => eventBus.off(UnifiedDataStore.EVENTS.STATS_UPDATED, statsUpdatedHandler));
    
    // ─────────────────────────────────────────────────────────────────────────
    // UDS 배치 업데이트 완료 시 로그
    // ─────────────────────────────────────────────────────────────────────────
    const batchUpdatedHandler = (event) => {
        console.log(`📦 [UDS] 배치 업데이트 완료: ${event.count}개`);
    };
    eventBus.on(UnifiedDataStore.EVENTS.BATCH_UPDATED, batchUpdatedHandler);
    handlers.push(() => eventBus.off(UnifiedDataStore.EVENTS.BATCH_UPDATED, batchUpdatedHandler));
    
    console.log('✅ [UDS] 이벤트 리스너 설정 완료');
    
    // cleanup 함수 반환
    return () => {
        handlers.forEach(cleanup => cleanup());
        console.log('🗑️ [UDS] 이벤트 리스너 정리 완료');
    };
}