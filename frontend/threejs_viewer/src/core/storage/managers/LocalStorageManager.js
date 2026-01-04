/**
 * LocalStorageManager.js
 * 
 * LocalStorage 관리자
 * 안전한 저장/로드, 만료 시간 관리, 용량 체크
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/core/storage/managers/LocalStorageManager.js
 */

import { jsonSerializer } from '../serializers/JsonSerializer.js';
import { STORAGE_PREFIX, findKeysByPrefix } from '../utils/StorageKeys.js';

/**
 * 저장 결과
 * @typedef {Object} SaveResult
 * @property {boolean} success - 성공 여부
 * @property {string} key - 저장된 키
 * @property {Error|null} error - 에러 (실패 시)
 */

/**
 * 로드 결과
 * @typedef {Object} LoadResult
 * @property {boolean} success - 성공 여부
 * @property {Object|null} data - 로드된 데이터
 * @property {Object|null} metadata - 메타데이터
 * @property {Error|null} error - 에러 (실패 시)
 */

class LocalStorageManager {
    constructor() {
        this._isAvailable = this._checkAvailability();
        
        if (!this._isAvailable) {
            console.warn('[LocalStorageManager] LocalStorage를 사용할 수 없습니다.');
        }
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * 데이터 저장
     * @param {string} key - 스토리지 키
     * @param {Object} data - 저장할 데이터
     * @param {Object} options - 옵션
     * @param {number} options.expiresIn - 만료 시간 (ms, 선택)
     * @param {Object} options.metadata - 추가 메타데이터
     * @returns {SaveResult}
     */
    save(key, data, options = {}) {
        if (!this._isAvailable) {
            return { success: false, key, error: new Error('LocalStorage unavailable') };
        }

        try {
            const saveData = {
                data,
                _storage: {
                    savedAt: new Date().toISOString(),
                    expiresAt: options.expiresIn 
                        ? new Date(Date.now() + options.expiresIn).toISOString() 
                        : null,
                    ...options.metadata
                }
            };

            const serialized = jsonSerializer.serialize(saveData, { addMetadata: false });
            
            if (!serialized.success) {
                throw serialized.error;
            }

            // 용량 체크
            const size = new Blob([serialized.data]).size;
            if (size > 5 * 1024 * 1024) { // 5MB 제한
                throw new Error(`Data too large: ${(size / 1024 / 1024).toFixed(2)}MB`);
            }

            localStorage.setItem(key, serialized.data);

            console.log(`[LocalStorageManager] 저장 완료: ${key} (${(size / 1024).toFixed(2)}KB)`);

            return { success: true, key, error: null };

        } catch (error) {
            console.error(`[LocalStorageManager] 저장 실패: ${key}`, error);
            
            // QuotaExceededError 처리
            if (error.name === 'QuotaExceededError') {
                this._handleQuotaExceeded();
            }

            return { success: false, key, error };
        }
    }

    /**
     * 데이터 로드
     * @param {string} key - 스토리지 키
     * @param {Object} options - 옵션
     * @param {boolean} options.ignoreExpiry - 만료 무시 여부
     * @returns {LoadResult}
     */
    load(key, options = {}) {
        if (!this._isAvailable) {
            return { success: false, data: null, metadata: null, error: new Error('LocalStorage unavailable') };
        }

        try {
            const stored = localStorage.getItem(key);
            
            if (!stored) {
                return { success: false, data: null, metadata: null, error: new Error('Key not found') };
            }

            const deserialized = jsonSerializer.deserialize(stored);
            
            if (!deserialized.success) {
                throw deserialized.error;
            }

            const { data, _storage } = deserialized.data;

            // 만료 체크
            if (!options.ignoreExpiry && _storage?.expiresAt) {
                const expiresAt = new Date(_storage.expiresAt);
                if (expiresAt < new Date()) {
                    console.log(`[LocalStorageManager] 만료된 데이터 삭제: ${key}`);
                    this.remove(key);
                    return { success: false, data: null, metadata: null, error: new Error('Data expired') };
                }
            }

            return {
                success: true,
                data,
                metadata: _storage,
                error: null
            };

        } catch (error) {
            console.error(`[LocalStorageManager] 로드 실패: ${key}`, error);
            return { success: false, data: null, metadata: null, error };
        }
    }

    /**
     * 데이터 존재 여부 확인
     * @param {string} key - 스토리지 키
     * @returns {boolean}
     */
    exists(key) {
        if (!this._isAvailable) return false;
        return localStorage.getItem(key) !== null;
    }

    /**
     * 데이터 삭제
     * @param {string} key - 스토리지 키
     * @returns {boolean} 성공 여부
     */
    remove(key) {
        if (!this._isAvailable) return false;
        
        try {
            localStorage.removeItem(key);
            console.log(`[LocalStorageManager] 삭제 완료: ${key}`);
            return true;
        } catch (error) {
            console.error(`[LocalStorageManager] 삭제 실패: ${key}`, error);
            return false;
        }
    }

    /**
     * 특정 prefix를 가진 모든 데이터 삭제
     * @param {string} prefix - 키 prefix
     * @returns {number} 삭제된 항목 수
     */
    removeByPrefix(prefix) {
        const keys = findKeysByPrefix(prefix);
        let count = 0;
        
        for (const key of keys) {
            if (this.remove(key)) {
                count++;
            }
        }

        console.log(`[LocalStorageManager] ${count}개 항목 삭제 (prefix: ${prefix})`);
        return count;
    }

    /**
     * 모든 Sherlock 관련 데이터 삭제
     * @returns {number} 삭제된 항목 수
     */
    clearAll() {
        return this.removeByPrefix(STORAGE_PREFIX);
    }

    /**
     * 만료된 데이터 정리
     * @returns {number} 정리된 항목 수
     */
    cleanupExpired() {
        if (!this._isAvailable) return 0;

        const keys = findKeysByPrefix(STORAGE_PREFIX);
        let count = 0;

        for (const key of keys) {
            const result = this.load(key, { ignoreExpiry: false });
            if (!result.success && result.error?.message === 'Data expired') {
                count++;
            }
        }

        console.log(`[LocalStorageManager] ${count}개 만료 데이터 정리됨`);
        return count;
    }

    /**
     * 스토리지 사용량 정보
     * @returns {Object} 사용량 정보
     */
    getUsageInfo() {
        if (!this._isAvailable) {
            return { used: 0, total: 0, percent: 0, items: 0 };
        }

        let totalSize = 0;
        let sherlockSize = 0;
        let sherlockItems = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = new Blob([key + value]).size;
            totalSize += size;

            if (key.startsWith(STORAGE_PREFIX)) {
                sherlockSize += size;
                sherlockItems++;
            }
        }

        // 대략적인 총 용량 (브라우저마다 다름, 보통 5-10MB)
        const estimatedTotal = 5 * 1024 * 1024;

        return {
            used: sherlockSize,
            usedFormatted: this._formatBytes(sherlockSize),
            total: estimatedTotal,
            totalFormatted: this._formatBytes(estimatedTotal),
            percent: ((sherlockSize / estimatedTotal) * 100).toFixed(2),
            items: sherlockItems,
            totalItems: localStorage.length
        };
    }

    /**
     * 특정 prefix의 모든 데이터 조회
     * @param {string} prefix - 키 prefix
     * @returns {Object[]} 데이터 배열
     */
    getByPrefix(prefix) {
        const keys = findKeysByPrefix(prefix);
        const results = [];

        for (const key of keys) {
            const result = this.load(key);
            if (result.success) {
                results.push({
                    key,
                    data: result.data,
                    metadata: result.metadata
                });
            }
        }

        return results;
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * LocalStorage 사용 가능 여부 확인
     * @private
     */
    _checkAvailability() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 용량 초과 시 처리
     * @private
     */
    _handleQuotaExceeded() {
        console.warn('[LocalStorageManager] 용량 초과 - 만료 데이터 정리 시도');
        
        // 1. 만료된 데이터 정리
        this.cleanupExpired();
        
        // 2. 오래된 AutoSave 데이터 정리 (24시간 이상)
        const autoSaveKeys = findKeysByPrefix(`${STORAGE_PREFIX}autosave_`);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        for (const key of autoSaveKeys) {
            const result = this.load(key, { ignoreExpiry: true });
            if (result.success && result.metadata?.savedAt) {
                const savedAt = new Date(result.metadata.savedAt);
                if (savedAt < oneDayAgo) {
                    this.remove(key);
                }
            }
        }
    }

    /**
     * 바이트를 읽기 쉬운 형태로 변환
     * @private
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 싱글톤 인스턴스
const localStorageManager = new LocalStorageManager();

// Named exports
export { LocalStorageManager, localStorageManager };

// Default export
export default localStorageManager;

// 전역 등록
if (typeof window !== 'undefined') {
    window.LocalStorageManager = LocalStorageManager;
    window.localStorageManager = localStorageManager;
}

console.log('✅ LocalStorageManager.js v1.0.0 로드 완료');