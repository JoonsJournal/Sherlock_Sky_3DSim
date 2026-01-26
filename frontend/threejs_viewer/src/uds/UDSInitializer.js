/**
 * UDSInitializer.js
 * ==================
 * UDS (Unified Data Store) 초기화 로직
 * 
 * @version 1.0.0
 * @description
 * - Site 연결 후 UDS 초기화
 * - SignalTower 연동
 * - StatusBar Stats 업데이트
 * 
 * @changelog
 * - v1.0.0: main.js 리팩토링 Phase 7 - UDS 초기화 분리 (2026-01-26)
 *           - _initializeUDSAfterConnection() 이동
 *           - ⚠️ 호환성: 기존 UDS 초기화 동작 100% 유지
 * 
 * @dependencies
 * - services/uds/UnifiedDataStore.js
 * - uds/UDSEventHandlers.js
 * 
 * @exports
 * - initializeUDSAfterConnection
 * 
 * 📁 위치: frontend/threejs_viewer/src/uds/UDSInitializer.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { unifiedDataStore } from '../services/uds/index.js';
import { eventBus } from '../core/managers/EventBus.js';
import { services } from '../app/AppState.js';
import { convertUDSStatsToStatusBar } from './UDSEventHandlers.js';

// ============================================
// UDS 초기화
// ============================================

/**
 * Site 연결 후 UDS 초기화
 * 
 * 1. UDS 초기 데이터 로드 (117개 설비)
 * 2. WebSocket Delta 연결
 * 3. SignalTower 초기화
 * 4. StatusBar Stats 연동
 * 
 * @param {string} siteId - 연결된 Site ID
 * @returns {Promise<void>}
 * 
 * @example
 * await initializeUDSAfterConnection('korea_site1');
 */
export async function initializeUDSAfterConnection(siteId) {
    console.log('🚀 [UDS] Site 연결 후 UDS 초기화 시작...');
    
    try {
        // ─────────────────────────────────────────────────────────────────────────
        // Step 1: UDS 초기화 (초기 데이터 로드 + WebSocket 연결)
        // ─────────────────────────────────────────────────────────────────────────
        const equipments = await unifiedDataStore.initialize({
            siteId: 1,
            lineId: 1
        });
        
        console.log(`✅ [UDS] 초기 데이터 로드 완료: ${equipments.length}개 설비`);
        
        // ─────────────────────────────────────────────────────────────────────────
        // Step 2: SignalTower 초기화 (UDS 데이터로)
        // ─────────────────────────────────────────────────────────────────────────
        const signalTowerManager = services.monitoring?.signalTowerManager;
        
        if (signalTowerManager) {
            const result = signalTowerManager.initializeFromUDS(equipments);
            console.log(`✅ [UDS] SignalTower 초기화: ${result.updated}개 업데이트`);
        }
        
        // ─────────────────────────────────────────────────────────────────────────
        // Step 3: StatusBar Stats 초기 업데이트
        // ─────────────────────────────────────────────────────────────────────────
        const udsStats = unifiedDataStore.getStatusStats();
        const statusBarStats = convertUDSStatsToStatusBar(udsStats, equipments.length);
        eventBus.emit('monitoring:stats-update', statusBarStats);
        
        console.log(`✅ [UDS] StatusBar Stats 업데이트:`, statusBarStats);
        
        // Toast 알림
        window.showToast?.(`UDS 연동 완료 (${equipments.length}개 설비)`, 'success');
        
    } catch (error) {
        console.error('❌ [UDS] 초기화 실패:', error);
        window.showToast?.('UDS 초기화 실패 - Legacy 모드 사용', 'warning');
        
        // 실패해도 기존 Legacy 방식으로 동작 가능
    }
}