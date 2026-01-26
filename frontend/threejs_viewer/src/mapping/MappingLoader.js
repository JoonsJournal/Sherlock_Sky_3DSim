/**
 * MappingLoader.js
 * =================
 * 매핑 데이터 로드 모듈
 * 
 * @version 1.0.0
 * @description
 * - Site 연결 후 매핑 데이터 로드 (API 우선 방식)
 * - 로컬 폴백 처리
 * - main.js에서 분리된 매핑 로드 함수들
 * 
 * @changelog
 * - v1.0.0: Phase 8 - main.js에서 분리 (2026-01-26)
 *           - _loadEquipmentMappingsAfterConnection() 이동
 *           - _fallbackToLocalMappings() 이동
 *           - ⚠️ 호환성: 기존 기능 100% 유지
 * 
 * @dependencies
 * - ../app/AppState.js (services 객체)
 * - ../core/managers/EventBus.js
 * - ./MappingInitializer.js
 * 
 * @exports
 * - loadEquipmentMappingsAfterConnection
 * - fallbackToLocalMappings
 * 
 * 📁 위치: frontend/threejs_viewer/src/mapping/MappingLoader.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { services } from '../app/AppState.js';
import { eventBus } from '../core/managers/EventBus.js';
import { initMappingServices } from './MappingInitializer.js';

/**
 * 🆕 v5.6.0: Site 연결 후 매핑 데이터 로드 (API 우선 방식)
 * 
 * ⭐ v5.6.0 변경: "항상 API 우선" 전략 적용
 * - 기존: 로컬 데이터 있으면 스킵 → Origin 격리 문제 발생
 * - 변경: 항상 API에서 로드 시도, 실패 시 로컬 폴백
 * 
 * @param {string} siteId - 연결된 Site ID
 */
export async function loadEquipmentMappingsAfterConnection(siteId) {
    const equipmentEditState = services.ui?.equipmentEditState;
    const apiClient = services.ui?.apiClient;
    
    // 의존성 확인
    if (!equipmentEditState) {
        console.warn('[Connection] EquipmentEditState not available - skipping mapping load');
        return;
    }
    
    if (!apiClient) {
        console.warn('[Connection] ApiClient not available - skipping mapping load');
        return;
    }
    
    // 🆕 v5.6.0: 로컬 상태 백업 (폴백용)
    const localStatus = equipmentEditState.getMappingsStatus?.() || { isEmpty: true, count: 0 };
    console.log(`[Connection] Local mappings: ${localStatus.count}개 (폴백용 백업)`);
    
    try {
        console.log(`📡 Loading equipment mappings for site: ${siteId} (API 우선)`);
        
        // EquipmentMappingService 초기화 (없으면)
        if (!services.mapping.equipmentMappingService) {
            await initMappingServices({
                apiClient,
                equipmentEditState,
                eventBus,
                siteId
            });
        }
        
        const mappingService = services.mapping.equipmentMappingService;
        
        // 🆕 v5.6.0: 항상 API에서 로드 시도 (forceRefresh: true)
        const result = await mappingService.loadMappingsForSite(siteId, {
            forceRefresh: true,       // 🔧 항상 서버에서 최신 데이터 로드
            applyToEditState: true    // 자동으로 EditState에 적용
        });
        
        if (result.connected && result.count > 0) {
            console.log(`✅ Equipment mappings loaded from API: ${result.count}개`);
            window.showToast?.(`${result.count}개 설비 매핑 로드됨 (서버)`, 'success');
            
            // MonitoringService에 매핑 갱신 알림 (활성 상태인 경우)
            if (services.monitoring?.monitoringService?.isActive) {
                console.log('[Connection] Notifying MonitoringService of mapping update');
                services.monitoring.monitoringService.refreshMappingState?.();
            }
            
            // 이벤트 발행
            eventBus.emit('mapping:loaded', {
                siteId,
                count: result.count,
                source: 'api',
                timestamp: new Date().toISOString()
            });
            
        } else if (result.connected && result.count === 0) {
            console.log('ℹ️ No equipment mappings on server');
            
            // 🆕 v5.6.0: 서버에 데이터 없으면 로컬 데이터 유지
            if (!localStatus.isEmpty) {
                console.log(`[Connection] 서버에 매핑 없음 - 로컬 데이터 유지 (${localStatus.count}개)`);
                window.showToast?.(`로컬 매핑 데이터 사용 (${localStatus.count}개)`, 'info');
            }
            
        } else {
            // 🆕 v5.6.0: API 연결 실패 시 로컬 폴백
            console.warn(`⚠️ API load failed: ${result.message || 'Unknown error'}`);
            fallbackToLocalMappings(localStatus, siteId);
        }
        
    } catch (error) {
        console.error('❌ Error loading equipment mappings:', error);
        
        // 🆕 v5.6.0: 예외 발생 시 로컬 폴백
        fallbackToLocalMappings(localStatus, siteId);
        
        // 이벤트 발행
        eventBus.emit('mapping:load-error', {
            siteId,
            error: error.message,
            fallbackUsed: !localStatus.isEmpty,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 🆕 v5.6.0: 로컬 매핑 데이터로 폴백
 * 
 * @param {Object} localStatus - 로컬 매핑 상태
 * @param {boolean} localStatus.isEmpty - 로컬 데이터 비어있는지 여부
 * @param {number} localStatus.count - 로컬 매핑 개수
 * @param {string} siteId - Site ID
 */
export function fallbackToLocalMappings(localStatus, siteId) {
    if (!localStatus.isEmpty && localStatus.count > 0) {
        console.log(`[Connection] 📂 로컬 폴백 사용: ${localStatus.count}개 매핑`);
        window.showToast?.(`로컬 매핑 데이터 사용 (${localStatus.count}개)`, 'warning');
        
        // 이벤트 발행
        eventBus.emit('mapping:loaded', {
            siteId,
            count: localStatus.count,
            source: 'local-fallback',
            timestamp: new Date().toISOString()
        });
    } else {
        console.warn('[Connection] ⚠️ 로컬 매핑 데이터도 없음 - 매핑 없이 진행');
        window.showToast?.('매핑 데이터를 찾을 수 없습니다', 'error');
        
        // 이벤트 발행
        eventBus.emit('mapping:not-found', {
            siteId,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 매핑 데이터 강제 새로고침
 * 
 * @param {string} siteId - Site ID
 * @returns {Promise<Object>} 로드 결과
 */
export async function forceRefreshMappings(siteId) {
    const mappingService = services.mapping?.equipmentMappingService;
    
    if (!mappingService) {
        console.warn('[Mapping] MappingService not initialized');
        return { success: false, message: 'Service not initialized' };
    }
    
    try {
        // 캐시 정리
        mappingService.clearMappingCache?.();
        
        // 강제 새로고침
        const result = await mappingService.loadMappingsForSite(siteId, {
            forceRefresh: true,
            applyToEditState: true
        });
        
        console.log(`✅ Mappings force refreshed: ${result.count}개`);
        
        return {
            success: true,
            count: result.count,
            source: 'api'
        };
        
    } catch (error) {
        console.error('❌ Force refresh failed:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * 매핑 로드 상태 확인
 * 
 * @returns {Object} 상태 정보
 */
export function getMappingLoadStatus() {
    const editState = services.ui?.equipmentEditState;
    const mappingService = services.mapping?.equipmentMappingService;
    
    return {
        hasEditState: !!editState,
        hasMappingService: !!mappingService,
        localMappings: editState?.getMappingsStatus?.() || { isEmpty: true, count: 0 },
        serviceStatus: mappingService?.getStatus?.() || null
    };
}