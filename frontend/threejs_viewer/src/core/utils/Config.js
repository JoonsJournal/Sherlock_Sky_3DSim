/**
 * Config.js
 * 전역 설정 및 상수 관리
 * 
 * ⭐ Phase 1.4: core/config/settings.js로 마이그레이션
 * - 하위 호환성을 위해 기존 export 이름 유지
 * - 실제 구현은 core/config/settings.js에 있음
 * 
 * @version 2.1.0 - SITE_CONFIG 추가
 * @changelog
 * - v2.1.0 (2026-01-15): SITE_CONFIG, updateSiteConfig, getSiteTimezoneOffset 추가
 * - v2.0.0: Re-export 방식으로 변경
 * 
 * @deprecated 향후 직접 core/config/settings.js를 import하세요
 */

// =========================================================
// core/config/settings.js에서 가져와서 Re-export
// =========================================================

export {
    // 설정 객체 (이름 호환: SETTINGS → CONFIG)
    SETTINGS as CONFIG,
    
    // 원본 이름도 export (새 코드용)
    SETTINGS,
    
    // ⭐ 사이트 설정 (타임존 등) - 새로 추가
    SITE_CONFIG,
    
    // 유틸리티 함수들 (동일 이름)
    debugLog,
    isExcludedPosition,
    getExcludedStatistics,
    createExcludedRange,
    
    // 동적 업데이트 함수들 (이름 매핑)
    updateEquipmentSettings as updateEquipmentConfig,
    updateSceneSettings as updateSceneConfig,
    resetSettings as resetConfig,
    debugSettings as debugConfig,
    
    // 원본 이름도 export (새 코드용)
    updateEquipmentSettings,
    updateSceneSettings,
    resetSettings,
    debugSettings,
    
    // ⭐ 사이트 설정 함수들 - 새로 추가
    updateSiteConfig,
    getSiteTimezoneOffset
    
} from '../config/settings.js';


// =========================================================
// 전역 노출 (기존 호환성 유지)
// =========================================================

import {
    SETTINGS,
    SITE_CONFIG,
    updateEquipmentSettings,
    updateSceneSettings,
    updateSiteConfig,
    getSiteTimezoneOffset,
    resetSettings,
    debugSettings
} from '../config/settings.js';

// 브라우저 환경에서 전역 함수 노출
if (typeof window !== 'undefined') {
    // 기존 이름 (하위 호환)
    window.updateEquipmentConfig = updateEquipmentSettings;
    window.updateSceneConfig = updateSceneSettings;
    window.resetConfig = resetSettings;
    window.debugConfig = debugSettings;
    
    // 새 이름도 노출
    window.updateEquipmentSettings = updateEquipmentSettings;
    window.updateSceneSettings = updateSceneSettings;
    window.resetSettings = resetSettings;
    window.debugSettings = debugSettings;
    
    // CONFIG 객체 전역 노출
    window.CONFIG = SETTINGS;
    
    // ⭐ 사이트 설정 전역 노출 - 새로 추가
    window.SITE_CONFIG = SITE_CONFIG;
    window.updateSiteConfig = updateSiteConfig;
    window.getSiteTimezoneOffset = getSiteTimezoneOffset;
}