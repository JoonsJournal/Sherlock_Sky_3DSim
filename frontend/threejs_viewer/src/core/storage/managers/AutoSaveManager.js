/**
 * AutoSaveManager.js
 * 
 * 통합 자동 저장 관리자
 * 네임스페이스별 독립적인 AutoSave 인스턴스 관리
 * 
 * @version 2.0.0
 * @location frontend/threejs_viewer/src/core/storage/managers/AutoSaveManager.js
 * 
 * @description
 * - 시간 기반 트리거 (configurable interval)
 * - 변경 기반 트리거 (change count threshold)
 * - isDirty 상태 관리
 * - 저장 중 잠금 (mutex)
 * - EventBus 이벤트 발행
 * - 복구 기능 지원
 */

import { localStorageManager } from './LocalStorageManager.js';
import { getAutoSaveKey, AUTOSAVE_KEYS } from '../utils/StorageKeys.js';
import { eventBus } from '../../managers/EventBus.js';

/**
 * AutoSave 설정
 * @typedef {Object} AutoSaveConfig
 * @property {Function} getData - 저장할 데이터를 반환하는 함수
 * @property {number} intervalMs - 저장 간격 (ms, 기본: 60000)
 * @property {number} changeThreshold - 변경 횟수 임계값 (기본: 10)
 * @property {number} expiresIn - 만료 시간 (ms, 기본: 24시간)
 * @property {Function} onSave - 저장 완료 콜백
 * @property {Function} onError - 에러 콜백
 * @property {boolean} enabled - 활성화 여부 (기본: true)
 */

/**
 * AutoSave 인스턴스 상태
 */
class AutoSaveInstance {
    constructor(namespace, identifier, config) {
        this.namespace = namespace;
        this.identifier = identifier;
        this.config = {
            intervalMs: config.intervalMs || 60000,          // 1분
            changeThreshold: config.changeThreshold || 10,
            expiresIn: config.expiresIn || 24 * 60 * 60 * 1000, // 24시간
            enabled: config.enabled ?? true,
            getData: config.getData,
            onSave: config.onSave,
            onError: config.onError
        };

        // 상태
        this._isRunning = false;
        this._isDirty = false;
        this._isSaving = false;
        this._changeCount = 0;
        this._timerId = null;
        this._lastSavedAt = null;

        // 스토리지 키
        this._storageKey = getAutoSaveKey(namespace, identifier);
    }

    /**
     * AutoSave 시작
     */
    start() {
        if (this._isRunning) {
            console.warn(`[AutoSave:${this.namespace}] 이미 실행 중입니다.`);
            return;
        }

        if (!this.config.enabled) {
            console.log(`[AutoSave:${this.namespace}] 비활성화 상태입니다.`);
            return;
        }

        this._isRunning = true;
        this._startTimer();

        eventBus.emit('autosave:started', {
            namespace: this.namespace,
            identifier: this.identifier,
            timestamp: Date.now()
        });

        console.log(`[AutoSave:${this.namespace}] 시작됨 - ${this.config.intervalMs / 1000}초 간격`);
    }

    /**
     * AutoSave 중지
     */
    stop() {
        if (!this._isRunning) return;

        this._stopTimer();
        this._isRunning = false;

        eventBus.emit('autosave:stopped', {
            namespace: this.namespace,
            identifier: this.identifier,
            timestamp: Date.now()
        });

        console.log(`[AutoSave:${this.namespace}] 중지됨`);
    }

    /**
     * 변경 알림 (외부에서 호출)
     */
    markDirty() {
        this._isDirty = true;
        this._changeCount++;

        eventBus.emit('autosave:dirty', {
            namespace: this.namespace,
            identifier: this.identifier,
            isDirty: true,
            changeCount: this._changeCount
        });

        // 변경 임계값 도달 시 즉시 저장
        if (this._changeCount >= this.config.changeThreshold) {
            console.log(`[AutoSave:${this.namespace}] 변경 임계값 도달 - 즉시 저장`);
            this.saveNow('changeThreshold');
        }
    }

    /**
     * 깨끗한 상태로 표시
     */
    markClean() {
        this._isDirty = false;
        this._changeCount = 0;

        eventBus.emit('autosave:dirty', {
            namespace: this.namespace,
            identifier: this.identifier,
            isDirty: false,
            changeCount: 0
        });
    }

    /**
     * 즉시 저장
     * @param {string} trigger - 트리거 원인 ('timer', 'changeThreshold', 'manual')
     * @returns {Promise<boolean>}
     */
    async saveNow(trigger = 'manual') {
        // 이미 저장 중이면 스킵
        if (this._isSaving) {
            console.log(`[AutoSave:${this.namespace}] 저장 중 - 스킵`);
            return false;
        }

        // 변경 사항이 없으면 스킵 (manual 제외)
        if (!this._isDirty && trigger !== 'manual') {
            console.log(`[AutoSave:${this.namespace}] 변경 없음 - 스킵`);
            return false;
        }

        // getData 함수 확인
        if (typeof this.config.getData !== 'function') {
            console.error(`[AutoSave:${this.namespace}] getData 함수가 없습니다.`);
            return false;
        }

        this._isSaving = true;

        eventBus.emit('autosave:saving', {
            namespace: this.namespace,
            identifier: this.identifier,
            trigger
        });

        try {
            // 데이터 가져오기
            const data = this.config.getData();

            if (!data) {
                throw new Error('No data to save');
            }

            // 메타데이터 추가
            const saveData = {
                ...data,
                _autoSave: {
                    namespace: this.namespace,
                    identifier: this.identifier,
                    savedAt: new Date().toISOString(),
                    trigger,
                    changeCount: this._changeCount
                }
            };

            // LocalStorage에 저장
            const result = localStorageManager.save(this._storageKey, saveData, {
                expiresIn: this.config.expiresIn
            });

            if (!result.success) {
                throw result.error;
            }

            // 상태 업데이트
            this._lastSavedAt = new Date();
            this.markClean();

            // 이벤트 발행
            eventBus.emit('autosave:complete', {
                namespace: this.namespace,
                identifier: this.identifier,
                success: true,
                trigger,
                timestamp: this._lastSavedAt.toISOString()
            });

            // 콜백 호출
            if (this.config.onSave) {
                this.config.onSave(saveData);
            }

            console.log(`[AutoSave:${this.namespace}] 저장 완료 - trigger: ${trigger}`);
            return true;

        } catch (error) {
            console.error(`[AutoSave:${this.namespace}] 저장 실패:`, error);

            eventBus.emit('autosave:error', {
                namespace: this.namespace,
                identifier: this.identifier,
                error: error.message
            });

            if (this.config.onError) {
                this.config.onError(error);
            }

            return false;

        } finally {
            this._isSaving = false;
        }
    }

    /**
     * 복구 데이터 확인
     * @returns {Object|null}
     */
    checkRecovery() {
        const result = localStorageManager.load(this._storageKey);

        if (!result.success) {
            return null;
        }

        const data = result.data;

        // _autoSave 메타데이터 확인
        if (data?._autoSave) {
            eventBus.emit('autosave:recovery', {
                namespace: this.namespace,
                identifier: this.identifier,
                data,
                timestamp: data._autoSave.savedAt
            });

            console.log(`[AutoSave:${this.namespace}] 복구 데이터 발견`, {
                savedAt: data._autoSave.savedAt,
                trigger: data._autoSave.trigger
            });

            return data;
        }

        return null;
    }

    /**
     * 복구 데이터 삭제
     */
    clearRecovery() {
        localStorageManager.remove(this._storageKey);
        console.log(`[AutoSave:${this.namespace}] 복구 데이터 삭제됨`);
    }

    /**
     * 상태 정보
     */
    getStatus() {
        return {
            namespace: this.namespace,
            identifier: this.identifier,
            isRunning: this._isRunning,
            isDirty: this._isDirty,
            isSaving: this._isSaving,
            changeCount: this._changeCount,
            lastSavedAt: this._lastSavedAt?.toISOString() || null,
            config: {
                intervalMs: this.config.intervalMs,
                changeThreshold: this.config.changeThreshold,
                enabled: this.config.enabled
            }
        };
    }

    /**
     * 설정 업데이트
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        
        // 타이머 재시작 (interval 변경 시)
        if (this._isRunning && newConfig.intervalMs) {
            this._stopTimer();
            this._startTimer();
        }
    }

    /**
     * 리소스 정리
     */
    dispose() {
        this.stop();
        this.config.getData = null;
        this.config.onSave = null;
        this.config.onError = null;
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    _startTimer() {
        this._stopTimer();
        
        this._timerId = setInterval(() => {
            if (this._isDirty) {
                this.saveNow('timer');
            }
        }, this.config.intervalMs);
    }

    _stopTimer() {
        if (this._timerId) {
            clearInterval(this._timerId);
            this._timerId = null;
        }
    }
}


/**
 * AutoSaveManager - 네임스페이스별 AutoSave 인스턴스 관리
 */
class AutoSaveManager {
    constructor() {
        /** @type {Map<string, AutoSaveInstance>} */
        this._instances = new Map();
    }

    /**
     * AutoSave 인스턴스 생성/등록
     * @param {string} namespace - 네임스페이스 (layout, equipment, multisite 등)
     * @param {string} identifier - 식별자 (siteId, sessionId 등)
     * @param {AutoSaveConfig} config - 설정
     * @returns {AutoSaveInstance}
     */
    register(namespace, identifier, config) {
        const key = this._getInstanceKey(namespace, identifier);

        // 기존 인스턴스가 있으면 정리
        if (this._instances.has(key)) {
            this._instances.get(key).dispose();
        }

        const instance = new AutoSaveInstance(namespace, identifier, config);
        this._instances.set(key, instance);

        console.log(`[AutoSaveManager] 등록됨: ${key}`);
        return instance;
    }

    /**
     * AutoSave 인스턴스 가져오기
     * @param {string} namespace
     * @param {string} identifier
     * @returns {AutoSaveInstance|null}
     */
    get(namespace, identifier) {
        const key = this._getInstanceKey(namespace, identifier);
        return this._instances.get(key) || null;
    }

    /**
     * AutoSave 시작
     * @param {string} namespace
     * @param {string} identifier
     */
    start(namespace, identifier) {
        const instance = this.get(namespace, identifier);
        if (instance) {
            instance.start();
        } else {
            console.warn(`[AutoSaveManager] 인스턴스 없음: ${namespace}/${identifier}`);
        }
    }

    /**
     * AutoSave 중지
     * @param {string} namespace
     * @param {string} identifier
     */
    stop(namespace, identifier) {
        const instance = this.get(namespace, identifier);
        if (instance) {
            instance.stop();
        }
    }

    /**
     * 모든 AutoSave 중지
     */
    stopAll() {
        for (const instance of this._instances.values()) {
            instance.stop();
        }
    }

    /**
     * 변경 알림
     * @param {string} namespace
     * @param {string} identifier
     */
    markDirty(namespace, identifier) {
        const instance = this.get(namespace, identifier);
        if (instance) {
            instance.markDirty();
        }
    }

    /**
     * 즉시 저장
     * @param {string} namespace
     * @param {string} identifier
     * @param {string} trigger
     */
    async saveNow(namespace, identifier, trigger = 'manual') {
        const instance = this.get(namespace, identifier);
        if (instance) {
            return instance.saveNow(trigger);
        }
        return false;
    }

    /**
     * 복구 데이터 확인
     * @param {string} namespace
     * @param {string} identifier
     * @returns {Object|null}
     */
    checkRecovery(namespace, identifier) {
        const instance = this.get(namespace, identifier);
        if (instance) {
            return instance.checkRecovery();
        }
        
        // 인스턴스가 없어도 스토리지 직접 확인
        const storageKey = getAutoSaveKey(namespace, identifier);
        const result = localStorageManager.load(storageKey);
        return result.success ? result.data : null;
    }

    /**
     * 복구 데이터 삭제
     * @param {string} namespace
     * @param {string} identifier
     */
    clearRecovery(namespace, identifier) {
        const instance = this.get(namespace, identifier);
        if (instance) {
            instance.clearRecovery();
        } else {
            const storageKey = getAutoSaveKey(namespace, identifier);
            localStorageManager.remove(storageKey);
        }
    }

    /**
     * 인스턴스 해제
     * @param {string} namespace
     * @param {string} identifier
     */
    unregister(namespace, identifier) {
        const key = this._getInstanceKey(namespace, identifier);
        const instance = this._instances.get(key);
        
        if (instance) {
            instance.dispose();
            this._instances.delete(key);
            console.log(`[AutoSaveManager] 해제됨: ${key}`);
        }
    }

    /**
     * 모든 인스턴스 상태
     * @returns {Object[]}
     */
    getAllStatus() {
        const statuses = [];
        for (const instance of this._instances.values()) {
            statuses.push(instance.getStatus());
        }
        return statuses;
    }

    /**
     * 특정 네임스페이스의 모든 인스턴스
     * @param {string} namespace
     * @returns {AutoSaveInstance[]}
     */
    getByNamespace(namespace) {
        const instances = [];
        for (const [key, instance] of this._instances) {
            if (key.startsWith(`${namespace}/`)) {
                instances.push(instance);
            }
        }
        return instances;
    }

    /**
     * 리소스 정리
     */
    dispose() {
        this.stopAll();
        for (const instance of this._instances.values()) {
            instance.dispose();
        }
        this._instances.clear();
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    _getInstanceKey(namespace, identifier) {
        return `${namespace}/${identifier}`;
    }
}

// 싱글톤 인스턴스
const autoSaveManager = new AutoSaveManager();

// Named exports
export { AutoSaveManager, AutoSaveInstance, autoSaveManager };

// Default export
export default autoSaveManager;

// 전역 등록
if (typeof window !== 'undefined') {
    window.AutoSaveManager = AutoSaveManager;
    window.autoSaveManager = autoSaveManager;
}

console.log('✅ AutoSaveManager.js v2.0.0 로드 완료');