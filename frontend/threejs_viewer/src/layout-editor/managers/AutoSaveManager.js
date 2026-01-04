/**
 * AutoSaveManager.js (Layout Editor용 래퍼)
 * 
 * 기존 layout-editor AutoSaveManager의 호환성 래퍼
 * 내부적으로 core/storage/AutoSaveManager 사용
 * 
 * @version 2.0.0
 * @phase 5.2
 * @description 기존 API 유지하면서 공통 모듈 사용
 */

import { storageService } from '../../core/storage/index.js';

/**
 * LayoutAutoSaveManager
 * 
 * 기존 AutoSaveManager와 동일한 API 제공
 * 내부적으로 StorageService.autoSave 사용
 */
class LayoutAutoSaveManager {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.commandManager - CommandManager 인스턴스
     * @param {Function} options.onAutoSave - 자동 저장 시 콜백 (선택)
     * @param {Function} options.getLayoutData - 레이아웃 데이터 가져오기 함수
     * @param {number} options.intervalMs - 자동 저장 간격 (기본: 300000ms = 5분)
     * @param {number} options.changeThreshold - 변경 횟수 임계값 (기본: 20)
     */
    constructor(options = {}) {
        this.commandManager = options.commandManager || null;
        this.onAutoSave = options.onAutoSave || null;
        this.getLayoutData = options.getLayoutData || null;
        
        // 설정값 (기존과 동일한 기본값)
        this.intervalMs = options.intervalMs || 300000; // 5분
        this.changeThreshold = options.changeThreshold || 20;
        
        // 내부 상태
        this._currentSiteId = null;
        this._instance = null;
        this._originalOnExecute = null;
        
        console.log('[LayoutAutoSaveManager] 인스턴스 생성됨 (v2.0 - 공통 모듈 사용)', {
            intervalMs: this.intervalMs,
            changeThreshold: this.changeThreshold
        });
    }
    
    /**
     * AutoSave 시작
     * @param {string} siteId - 사이트 ID
     */
    start(siteId) {
        if (this._instance) {
            console.warn('[LayoutAutoSaveManager] 이미 실행 중입니다.');
            return;
        }
        
        this._currentSiteId = siteId;
        
        // StorageService를 통해 AutoSave 등록
        this._instance = storageService.autoSave.register('layout', siteId, {
            getData: () => this._getDataWithMeta(),
            intervalMs: this.intervalMs,
            changeThreshold: this.changeThreshold,
            onSave: (data) => {
                if (this.onAutoSave) {
                    this.onAutoSave(data);
                }
            },
            onError: (error) => {
                console.error('[LayoutAutoSaveManager] 저장 실패:', error);
            }
        });
        
        // CommandManager 구독
        this._subscribeToCommandManager();
        
        // 시작
        this._instance.start();
        
        console.log(`[LayoutAutoSaveManager] 시작됨 - siteId: ${siteId}`);
    }
    
    /**
     * AutoSave 중지
     */
    stop() {
        if (!this._instance) {
            return;
        }
        
        // CommandManager 구독 해제
        this._unsubscribeFromCommandManager();
        
        // 중지 및 해제
        storageService.autoSave.unregister('layout', this._currentSiteId);
        this._instance = null;
        
        console.log('[LayoutAutoSaveManager] 중지됨');
    }
    
    /**
     * 현재 레이아웃 데이터를 저장 (기존 API 호환)
     * @returns {boolean} 저장 성공 여부
     */
    save() {
        if (!this._instance) {
            console.error('[LayoutAutoSaveManager] 인스턴스가 없습니다.');
            return false;
        }
        
        // 동기적으로 결과 반환을 위해 즉시 실행
        this._instance.saveNow('manual');
        return true;
    }
    
    /**
     * 복구 파일 존재 확인 (기존 API 호환)
     * @param {string} siteId - 사이트 ID
     * @returns {Object|null} 복구 데이터 또는 null
     */
    checkForRecovery(siteId) {
        const data = storageService.autoSave.checkRecovery('layout', siteId);
        
        if (data && data._autoSave) {
            const timestamp = new Date(data._autoSave.savedAt);
            const now = new Date();
            const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
            
            console.log('[LayoutAutoSaveManager] 복구 데이터 발견', {
                siteId: data._autoSave.identifier,
                timestamp: data._autoSave.savedAt,
                hoursAgo: hoursDiff.toFixed(2)
            });
            
            // 24시간 이내만 반환
            if (hoursDiff <= 24) {
                return data;
            } else {
                console.log('[LayoutAutoSaveManager] 24시간 초과 - 삭제');
                this.clearAutoSave(siteId);
                return null;
            }
        }
        
        return null;
    }
    
    /**
     * AutoSave 데이터 삭제 (기존 API 호환)
     * @param {string} siteId - 사이트 ID
     */
    clearAutoSave(siteId) {
        storageService.autoSave.clearRecovery('layout', siteId);
        console.log(`[LayoutAutoSaveManager] 자동 저장 삭제됨 - siteId: ${siteId}`);
    }
    
    /**
     * 현재 상태 정보 반환 (기존 API 호환)
     * @returns {Object} 상태 정보
     */
    getStatus() {
        if (this._instance) {
            const status = this._instance.getStatus();
            return {
                isRunning: status.isRunning,
                siteId: this._currentSiteId,
                changeCount: status.changeCount,
                changeThreshold: this.changeThreshold,
                intervalMs: this.intervalMs
            };
        }
        
        return {
            isRunning: false,
            siteId: null,
            changeCount: 0,
            changeThreshold: this.changeThreshold,
            intervalMs: this.intervalMs
        };
    }
    
    // =========================================================================
    // Private Methods
    // =========================================================================
    
    /**
     * 레이아웃 데이터 + 메타데이터
     * @private
     */
    _getDataWithMeta() {
        if (!this.getLayoutData) {
            return null;
        }
        
        const layoutData = this.getLayoutData();
        
        if (!layoutData) {
            return null;
        }
        
        // 기존 형식의 메타데이터 추가 (호환성)
        return {
            ...layoutData,
            _autoSave: {
                timestamp: new Date().toISOString(),
                siteId: this._currentSiteId,
                changeCount: this._instance?.getStatus().changeCount || 0
            }
        };
    }
    
    /**
     * CommandManager 구독
     * @private
     */
    _subscribeToCommandManager() {
        if (!this.commandManager) {
            console.warn('[LayoutAutoSaveManager] CommandManager가 없어 구독하지 않습니다.');
            return;
        }
        
        // 기존 onExecute 콜백 저장
        this._originalOnExecute = this.commandManager.callbacks?.onExecute || null;
        
        // 새 콜백으로 교체 (체인 연결)
        if (this.commandManager.callbacks) {
            this.commandManager.callbacks.onExecute = (command) => {
                // 1. 기존 콜백 먼저 호출
                if (typeof this._originalOnExecute === 'function') {
                    try {
                        this._originalOnExecute(command);
                    } catch (e) {
                        console.error('[LayoutAutoSaveManager] 기존 onExecute 콜백 오류:', e);
                    }
                }
                // 2. AutoSave에 변경 알림
                if (this._instance) {
                    this._instance.markDirty();
                }
            };
        }
        
        console.log('[LayoutAutoSaveManager] CommandManager 구독 완료');
    }
    
    /**
     * CommandManager 구독 해제
     * @private
     */
    _unsubscribeFromCommandManager() {
        if (!this.commandManager) {
            return;
        }
        
        // 원래 콜백 복원
        if (this.commandManager.callbacks && this._originalOnExecute !== undefined) {
            this.commandManager.callbacks.onExecute = this._originalOnExecute;
            this._originalOnExecute = null;
        }
        
        console.log('[LayoutAutoSaveManager] CommandManager 구독 해제');
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.stop();
        this.commandManager = null;
        this.onAutoSave = null;
        this.getLayoutData = null;
        this._originalOnExecute = null;
        console.log('[LayoutAutoSaveManager] disposed');
    }
}

// 기존 이름으로 export (하위 호환성)
const AutoSaveManager = LayoutAutoSaveManager;

// 전역 등록 (기존과 동일)
if (typeof window !== 'undefined') {
    window.AutoSaveManager = AutoSaveManager;
}

export { AutoSaveManager, LayoutAutoSaveManager };
export default AutoSaveManager;

console.log('✅ LayoutAutoSaveManager.js v2.0.0 로드 완료 (공통 모듈 사용)');