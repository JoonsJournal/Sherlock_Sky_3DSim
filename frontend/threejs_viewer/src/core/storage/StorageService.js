/**
 * StorageService.js
 * 
 * 통합 Storage Facade
 * 모든 저장 관련 기능의 단일 진입점
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/core/storage/StorageService.js
 * 
 * @example
 * import { storageService } from '@/core/storage';
 * 
 * // AutoSave
 * storageService.autoSave.register('layout', siteId, { getData: () => data });
 * storageService.autoSave.start('layout', siteId);
 * 
 * // LocalStorage
 * storageService.local.save('key', data);
 * storageService.local.load('key');
 * 
 * // JSON 직렬화
 * storageService.json.serialize(data);
 */

import { autoSaveManager } from './managers/AutoSaveManager.js';
import { localStorageManager } from './managers/LocalStorageManager.js';
import { jsonSerializer } from './serializers/JsonSerializer.js';
import * as StorageKeys from './utils/StorageKeys.js';
import { eventBus } from '../managers/EventBus.js';

/**
 * StorageService - 통합 Storage Facade
 */
class StorageService {
    constructor() {
        // 서브 매니저들
        this._autoSave = autoSaveManager;
        this._local = localStorageManager;
        this._json = jsonSerializer;
        this._keys = StorageKeys;

        // 초기화
        this._initialize();
    }

    // =========================================================================
    // Getters (서브 매니저 접근)
    // =========================================================================

    /**
     * AutoSaveManager 접근
     */
    get autoSave() {
        return this._autoSave;
    }

    /**
     * LocalStorageManager 접근
     */
    get local() {
        return this._local;
    }

    /**
     * JsonSerializer 접근
     */
    get json() {
        return this._json;
    }

    /**
     * StorageKeys 접근
     */
    get keys() {
        return this._keys;
    }

    // =========================================================================
    // 편의 메서드 (자주 사용하는 패턴)
    // =========================================================================

    /**
     * 간단한 데이터 저장 (AutoSave 없이)
     * @param {string} key - 스토리지 키
     * @param {Object} data - 데이터
     * @param {Object} options - 옵션
     */
    save(key, data, options = {}) {
        return this._local.save(key, data, options);
    }

    /**
     * 간단한 데이터 로드
     * @param {string} key - 스토리지 키
     * @param {Object} defaultValue - 기본값
     */
    load(key, defaultValue = null) {
        const result = this._local.load(key);
        return result.success ? result.data : defaultValue;
    }

    /**
     * AutoSave 빠른 설정
     * @param {string} namespace - 네임스페이스
     * @param {string} identifier - 식별자
     * @param {Function} getData - 데이터 getter
     * @param {Object} options - 추가 옵션
     */
    setupAutoSave(namespace, identifier, getData, options = {}) {
        const instance = this._autoSave.register(namespace, identifier, {
            getData,
            intervalMs: options.intervalMs || 60000,
            changeThreshold: options.changeThreshold || 10,
            onSave: options.onSave,
            onError: options.onError
        });

        if (options.autoStart !== false) {
            instance.start();
        }

        return instance;
    }

    /**
     * 복구 다이얼로그 표시 여부 확인
     * @param {string} namespace
     * @param {string} identifier
     * @returns {Object|null} 복구 데이터
     */
    checkRecoveryNeeded(namespace, identifier) {
        return this._autoSave.checkRecovery(namespace, identifier);
    }

    /**
     * 사용자 설정 저장
     * @param {string} settingKey - 설정 키
     * @param {Object} settings - 설정 데이터
     */
    saveSettings(settingKey, settings) {
        const key = this._keys.PREFERENCE_KEYS[settingKey] || 
                    `${this._keys.STORAGE_PREFIX}settings_${settingKey}`;
        return this._local.save(key, settings);
    }

    /**
     * 사용자 설정 로드
     * @param {string} settingKey - 설정 키
     * @param {Object} defaultSettings - 기본 설정
     */
    loadSettings(settingKey, defaultSettings = {}) {
        const key = this._keys.PREFERENCE_KEYS[settingKey] || 
                    `${this._keys.STORAGE_PREFIX}settings_${settingKey}`;
        const result = this._local.load(key);
        return result.success ? { ...defaultSettings, ...result.data } : defaultSettings;
    }

    // =========================================================================
    // 유틸리티
    // =========================================================================

    /**
     * 스토리지 사용량 정보
     */
    getUsageInfo() {
        return this._local.getUsageInfo();
    }

    /**
     * 만료된 데이터 정리
     */
    cleanup() {
        return this._local.cleanupExpired();
    }

    /**
     * 모든 Sherlock 데이터 삭제 (주의!)
     */
    clearAll() {
        this._autoSave.stopAll();
        return this._local.clearAll();
    }

    /**
     * 상태 리포트
     */
    getStatusReport() {
        return {
            autoSave: this._autoSave.getAllStatus(),
            storage: this._local.getUsageInfo(),
            timestamp: new Date().toISOString()
        };
    }

    // =========================================================================
    // 이벤트 구독 헬퍼
    // =========================================================================

    /**
     * AutoSave 이벤트 구독
     * @param {string} event - 이벤트 이름 (started, stopped, saving, complete, error, dirty, recovery)
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    onAutoSave(event, callback) {
        const eventName = `autosave:${event}`;
        eventBus.on(eventName, callback);
        return () => eventBus.off(eventName, callback);
    }

    // =========================================================================
    // Private
    // =========================================================================

    _initialize() {
        // 페이지 언로드 시 실행 중인 AutoSave 정리
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                // 저장 중인 작업이 있으면 완료 대기 (동기)
                const statuses = this._autoSave.getAllStatus();
                for (const status of statuses) {
                    if (status.isDirty) {
                        // 마지막 저장 시도 (동기적으로)
                        try {
                            const instance = this._autoSave.get(status.namespace, status.identifier);
                            if (instance) {
                                instance.saveNow('beforeunload');
                            }
                        } catch (e) {
                            console.error('[StorageService] beforeunload 저장 실패:', e);
                        }
                    }
                }
            });

            // 주기적인 만료 데이터 정리 (1시간마다)
            setInterval(() => {
                this._local.cleanupExpired();
            }, 60 * 60 * 1000);
        }

        console.log('[StorageService] 초기화 완료');
    }
}

// 싱글톤 인스턴스
const storageService = new StorageService();

// Named exports
export { StorageService, storageService };

// Default export
export default storageService;

// 전역 등록
if (typeof window !== 'undefined') {
    window.StorageService = StorageService;
    window.storageService = storageService;
}

console.log('✅ StorageService.js v1.0.0 로드 완료');