/**
 * ReconnectionHandler.js
 * ======================
 * 재연결 복구 핸들러
 * 
 * @version 1.0.0
 * @description
 * - main.js에서 분리된 재연결 복구 로직
 * - connection:reconnected 이벤트 처리
 * - 모드별 복구 전략 실행
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 6 - 재연결 복구 분리 (2026-01-26)
 *           - setupReconnectionHandler() 이동
 *           - _executeRecoveryStrategy() 이동
 *           - ⚠️ 호환성: main.js 기존 동작 100% 유지
 * 
 * @dependencies
 * - ../app/AppConfig.js (RECOVERY_STRATEGIES)
 * - ../app/AppState.js (services)
 * - ../core/managers/EventBus.js (eventBus)
 * - ../bootstrap/index.js (startConnectionServiceForMode)
 * - ./RecoveryActions.js (executeRecoveryAction)
 * 
 * @exports
 * - setupReconnectionHandler
 * - executeRecoveryStrategy
 * 
 * 📁 위치: frontend/threejs_viewer/src/connection/ReconnectionHandler.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { RECOVERY_STRATEGIES } from '../app/AppConfig.js';
import { services } from '../app/AppState.js';
import { eventBus } from '../core/managers/EventBus.js';
import { startConnectionServiceForMode } from '../bootstrap/index.js';
import { ConnectionEvents } from '../services/ConnectionStatusService.js';
import { executeRecoveryAction } from './RecoveryActions.js';

// ============================================
// 유틸리티
// ============================================

/**
 * 딜레이 유틸리티
 * @private
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 */
function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 복구 전략 실행
// ============================================

/**
 * 복구 전략 실행
 * 
 * @param {string} mode - 현재 모드
 * @param {Object} strategy - 복구 전략 설정
 * @returns {Promise<void>}
 * 
 * @example
 * const strategy = RECOVERY_STRATEGIES[APP_MODE.MONITORING];
 * await executeRecoveryStrategy('MONITORING', strategy);
 */
export async function executeRecoveryStrategy(mode, strategy) {
    // 딜레이 적용
    if (strategy.restartDelay > 0) {
        await _delay(strategy.restartDelay);
    }
    
    // ConnectionStatusService 모드 변경
    const connectionStatusService = services.ui?.connectionStatusService;
    if (connectionStatusService && strategy.connectionMode) {
        startConnectionServiceForMode(connectionStatusService, strategy.connectionMode);
    }
    
    // 각 액션 실행
    for (const action of strategy.actions) {
        await executeRecoveryAction(action, mode);
    }
}

// ============================================
// 재연결 핸들러 설정
// ============================================

/**
 * 재연결 복구 핸들러 설정
 * 
 * connection:reconnected 이벤트를 수신하여
 * 현재 모드에 맞는 복구 전략을 실행
 * 
 * @param {Object} options - 옵션
 * @param {Object} options.appModeManager - AppModeManager 인스턴스
 * @returns {Function} 정리(cleanup) 함수
 * 
 * @example
 * // main.js에서 사용
 * const cleanup = setupReconnectionHandler({ appModeManager });
 * 
 * // 정리 시
 * cleanup();
 */
export function setupReconnectionHandler(options = {}) {
    const { appModeManager } = options;
    
    console.log('🔄 재연결 복구 핸들러 설정 시작...');
    
    const connectionStatusService = services.ui?.connectionStatusService;
    
    if (!connectionStatusService) {
        console.warn('  ⚠️ ConnectionStatusService 없음 - 재연결 핸들러 설정 건너뜀');
        return () => {};
    }
    
    // 연결 복구 이벤트 핸들러
    const handleReconnected = async (data) => {
        const recoveredAfter = data.recoveredAfter || 0;
        
        // 첫 연결은 무시 (복구만 처리)
        if (recoveredAfter === 0) {
            return;
        }
        
        console.log(`🔄 [Reconnection] 연결 복구 감지 (${recoveredAfter}회 실패 후)`);
        
        // 현재 모드 확인
        const currentMode = appModeManager?.getCurrentMode?.() || 'MAIN_VIEWER';
        const strategy = RECOVERY_STRATEGIES[currentMode];
        
        if (!strategy) {
            console.log(`  ℹ️ 모드 ${currentMode}에 대한 복구 전략 없음`);
            return;
        }
        
        console.log(`  📋 복구 전략: ${strategy.name}`);
        console.log(`  📋 실행할 액션: ${strategy.actions.join(', ') || '없음'}`);
        
        // Toast 표시
        if (strategy.showToast && strategy.toastMessage) {
            window.showToast?.(strategy.toastMessage, 'info');
        }
        
        // 복구 전략 실행
        try {
            await executeRecoveryStrategy(currentMode, strategy);
            
            console.log(`  ✅ ${strategy.name} 모드 복구 완료`);
            
            // 복구 완료 이벤트 발행
            eventBus.emit('recovery:complete', {
                mode: currentMode,
                strategy: strategy.name,
                recoveredAfter,
                timestamp: new Date().toISOString()
            });
            
            // 성공 Toast
            if (strategy.showToast) {
                window.showToast?.(`✅ ${strategy.name} 모드 복구 완료`, 'success');
            }
            
        } catch (error) {
            console.error(`  ❌ ${strategy.name} 모드 복구 실패:`, error);
            
            // 실패 이벤트 발행
            eventBus.emit('recovery:failed', {
                mode: currentMode,
                strategy: strategy.name,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            window.showToast?.(`❌ ${strategy.name} 복구 실패`, 'error');
        }
    };
    
    // 이벤트 구독
    connectionStatusService.onOnline(handleReconnected);
    
    // EventBus를 통한 추가 이벤트 구독 (커스텀 재연결 트리거 지원)
    eventBus.on('connection:manual-reconnect', handleReconnected);
    
    console.log('  ✅ 재연결 복구 핸들러 설정 완료');
    
    // 정리 함수 반환
    return () => {
        connectionStatusService.off(ConnectionEvents.ONLINE, handleReconnected);
        eventBus.off('connection:manual-reconnect', handleReconnected);
        console.log('  🗑️ 재연결 복구 핸들러 정리됨');
    };
}

// ============================================
// 전역 노출 (하위 호환)
// ============================================

// 디버깅용 전역 노출
if (typeof window !== 'undefined') {
    window._reconnectionHandler = {
        setupReconnectionHandler,
        executeRecoveryStrategy,
        RECOVERY_STRATEGIES
    };
}