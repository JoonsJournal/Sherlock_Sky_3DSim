/**
 * Storage Module Index
 * 
 * 통합 Storage 모듈 export
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/core/storage/index.js
 */

// =========================================================================
// Main Service (Facade)
// =========================================================================
export { StorageService, storageService } from './StorageService.js';

// =========================================================================
// Managers
// =========================================================================
export { 
    AutoSaveManager, 
    AutoSaveInstance, 
    autoSaveManager 
} from './managers/AutoSaveManager.js';

export { 
    LocalStorageManager, 
    localStorageManager 
} from './managers/LocalStorageManager.js';

// =========================================================================
// Serializers
// =========================================================================
export { 
    JsonSerializer, 
    jsonSerializer 
} from './serializers/JsonSerializer.js';

// =========================================================================
// Utils
// =========================================================================
export {
    STORAGE_PREFIX,
    AUTOSAVE_KEYS,
    PREFERENCE_KEYS,
    CONNECTION_KEYS,
    CACHE_KEYS,
    getAutoSaveKey,
    isKeyOfType,
    findKeysByPrefix,
    findAllSherlockKeys
} from './utils/StorageKeys.js';

// =========================================================================
// Default Export
// =========================================================================
export { storageService as default } from './StorageService.js';

console.log('✅ Storage Module 로드 완료');