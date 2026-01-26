/**
 * MappingInitializer.js
 * ======================
 * Mapping 서비스 초기화 모듈
 * 
 * @version 1.0.0
 * @description
 * - EquipmentMappingService 인스턴스 생성 및 초기화
 * - Site 연결 후 또는 Three.js 초기화 시 호출
 * - main.js에서 분리된 initMappingServices() 함수
 * 
 * @changelog
 * - v1.0.0: Phase 8 - main.js에서 분리 (2026-01-26)
 *           - initMappingServices() 함수 이동
 *           - ⚠️ 호환성: 기존 기능 100% 유지
 * 
 * @dependencies
 * - ../services/mapping/EquipmentMappingService.js
 * - ../app/AppState.js (services 객체)
 * - ../core/managers/EventBus.js
 * 
 * @exports
 * - initMappingServices
 * 
 * 📁 위치: frontend/threejs_viewer/src/mapping/MappingInitializer.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { services } from '../app/AppState.js';
import { eventBus } from '../core/managers/EventBus.js';

/**
 * 🆕 v5.5.0: Mapping 서비스 초기화
 * Site 연결 후 또는 Three.js 초기화 시 호출
 * 
 * @param {Object} options - 초기화 옵션
 * @param {Object} options.apiClient - ApiClient 인스턴스
 * @param {Object} options.equipmentEditState - EquipmentEditState 인스턴스
 * @param {Object} options.eventBus - EventBus 인스턴스
 * @param {string} [options.siteId] - 현재 사이트 ID
 * @returns {Promise<EquipmentMappingService>}
 */
export async function initMappingServices(options = {}) {
    const { 
        apiClient, 
        equipmentEditState, 
        eventBus: eb, 
        siteId 
    } = options;
    
    console.log('🔧 Mapping 서비스 초기화 시작...');
    
    try {
        // 동적 import
        const { EquipmentMappingService } = await import('../services/mapping/EquipmentMappingService.js');
        
        // EquipmentMappingService 인스턴스 생성
        services.mapping.equipmentMappingService = new EquipmentMappingService({
            apiClient: apiClient || services.ui?.apiClient,
            editState: equipmentEditState || services.ui?.equipmentEditState,
            eventBus: eb || eventBus,
            siteId: siteId || null,
            apiBaseUrl: null  // 자동 감지
        });
        
        console.log('  ✅ EquipmentMappingService 생성 완료');
        
        // 전역 노출
        window.equipmentMappingService = services.mapping.equipmentMappingService;
        
        return services.mapping.equipmentMappingService;
        
    } catch (error) {
        console.error('❌ Mapping 서비스 초기화 실패:', error);
        throw error;
    }
}

/**
 * Mapping 서비스 상태 확인
 * @returns {Object} 상태 정보
 */
export function getMappingServiceStatus() {
    const mappingService = services.mapping?.equipmentMappingService;
    
    return {
        initialized: !!mappingService,
        siteId: mappingService?.getCurrentSiteId?.() || null,
        mappingCount: mappingService?.getMappingCount?.() || 0,
        lastUpdated: mappingService?.getLastUpdateTime?.() || null
    };
}

/**
 * Mapping 서비스 정리
 */
export function cleanupMappingServices() {
    if (services.mapping?.equipmentMappingService) {
        try {
            services.mapping.equipmentMappingService.clearCache?.();
            services.mapping.equipmentMappingService = null;
            window.equipmentMappingService = undefined;
            console.log('  🗑️ Mapping 서비스 정리 완료');
        } catch (error) {
            console.warn('⚠️ Mapping 서비스 정리 중 오류:', error);
        }
    }
}