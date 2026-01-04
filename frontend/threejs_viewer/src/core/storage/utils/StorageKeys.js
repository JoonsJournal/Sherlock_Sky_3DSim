/**
 * StorageKeys.js
 * 
 * 스토리지 키 상수 정의
 * 모든 LocalStorage, SessionStorage 키를 중앙에서 관리
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/core/storage/utils/StorageKeys.js
 */

/**
 * 스토리지 키 Prefix
 */
export const STORAGE_PREFIX = 'sherlock_';

/**
 * AutoSave 관련 키
 */
export const AUTOSAVE_KEYS = Object.freeze({
    // Layout Editor
    LAYOUT: `${STORAGE_PREFIX}autosave_layout_`,
    
    // Equipment Edit
    EQUIPMENT: `${STORAGE_PREFIX}autosave_equipment_`,
    
    // Multi-site 설정
    MULTISITE: `${STORAGE_PREFIX}autosave_multisite_`,
    
    // Simulation
    SIMULATION: `${STORAGE_PREFIX}autosave_simulation_`,
});

/**
 * 사용자 설정 관련 키
 */
export const PREFERENCE_KEYS = Object.freeze({
    // 일반 설정
    USER_PREFERENCES: `${STORAGE_PREFIX}user_preferences`,
    
    // 3D Viewer 설정
    VIEWER_SETTINGS: `${STORAGE_PREFIX}viewer_settings`,
    
    // Layout Editor 설정
    LAYOUT_EDITOR_SETTINGS: `${STORAGE_PREFIX}layout_editor_settings`,
    
    // 최근 사용 항목
    RECENT_FILES: `${STORAGE_PREFIX}recent_files`,
    RECENT_CONNECTIONS: `${STORAGE_PREFIX}recent_connections`,
});

/**
 * 연결 정보 관련 키
 */
export const CONNECTION_KEYS = Object.freeze({
    // 데이터베이스 연결
    DB_CONNECTIONS: `${STORAGE_PREFIX}db_connections`,
    
    // 사이트 설정
    SITE_CONFIGS: `${STORAGE_PREFIX}site_configs`,
    
    // 마지막 연결
    LAST_CONNECTION: `${STORAGE_PREFIX}last_connection`,
});

/**
 * 캐시 관련 키
 */
export const CACHE_KEYS = Object.freeze({
    // API 응답 캐시
    API_CACHE: `${STORAGE_PREFIX}api_cache_`,
    
    // 템플릿 캐시
    TEMPLATE_CACHE: `${STORAGE_PREFIX}template_cache`,
});

/**
 * 네임스페이스별 AutoSave 키 생성
 * @param {string} namespace - 네임스페이스 (layout, equipment, multisite 등)
 * @param {string} identifier - 식별자 (siteId, sessionId 등)
 * @returns {string} 완전한 스토리지 키
 */
export function getAutoSaveKey(namespace, identifier) {
    const prefix = AUTOSAVE_KEYS[namespace.toUpperCase()] || `${STORAGE_PREFIX}autosave_${namespace}_`;
    return `${prefix}${identifier}`;
}

/**
 * 스토리지 키가 특정 prefix로 시작하는지 확인
 * @param {string} key - 확인할 키
 * @param {string} prefix - prefix
 * @returns {boolean}
 */
export function isKeyOfType(key, prefix) {
    return key.startsWith(prefix);
}

/**
 * 특정 prefix를 가진 모든 키 찾기
 * @param {string} prefix - prefix
 * @returns {string[]} 키 배열
 */
export function findKeysByPrefix(prefix) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            keys.push(key);
        }
    }
    return keys;
}

/**
 * 모든 Sherlock 관련 키 찾기
 * @returns {string[]} 키 배열
 */
export function findAllSherlockKeys() {
    return findKeysByPrefix(STORAGE_PREFIX);
}

// 전역 등록
if (typeof window !== 'undefined') {
    window.StorageKeys = {
        STORAGE_PREFIX,
        AUTOSAVE_KEYS,
        PREFERENCE_KEYS,
        CONNECTION_KEYS,
        CACHE_KEYS,
        getAutoSaveKey,
        isKeyOfType,
        findKeysByPrefix,
        findAllSherlockKeys
    };
}

console.log('✅ StorageKeys.js v1.0.0 로드 완료');