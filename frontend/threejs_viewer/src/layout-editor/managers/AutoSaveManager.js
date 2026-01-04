/**
 * AutoSaveManager.js
 * 
 * 작업 중 브라우저 크래시, 실수로 닫기 등에서 데이터 보호를 위한 자동 저장 관리자
 * 
 * 트리거 조건:
 * - 시간 기반: 5분(300초) 경과
 * - 변경 기반: 20개 Command 누적
 * 
 * @version 1.0.0
 * @phase 5.2
 */

class AutoSaveManager {
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
        
        // 설정값
        this.intervalMs = options.intervalMs || 300000; // 5분
        this.changeThreshold = options.changeThreshold || 20;
        
        // 내부 상태
        this._timerId = null;
        this._changeCount = 0;
        this._isRunning = false;
        this._currentSiteId = null;
        this._boundOnCommandExecute = this._onCommandExecute.bind(this);
        
        // localStorage key prefix
        this.STORAGE_KEY_PREFIX = 'layout_autosave_';
        
        console.log('[AutoSaveManager] 인스턴스 생성됨', {
            intervalMs: this.intervalMs,
            changeThreshold: this.changeThreshold
        });
    }
    
    /**
     * AutoSave 시작
     * @param {string} siteId - 사이트 ID
     */
    start(siteId) {
        if (this._isRunning) {
            console.warn('[AutoSaveManager] 이미 실행 중입니다.');
            return;
        }
        
        this._currentSiteId = siteId;
        this._isRunning = true;
        this._changeCount = 0;
        
        // 1. 시간 기반 타이머 시작
        this._startTimer();
        
        // 2. CommandManager 구독
        this._subscribeToCommandManager();
        
        console.log(`[AutoSaveManager] 시작됨 - siteId: ${siteId}`);
    }
    
    /**
     * AutoSave 중지
     */
    stop() {
        if (!this._isRunning) {
            return;
        }
        
        // 1. 타이머 중지
        this._stopTimer();
        
        // 2. CommandManager 구독 해제
        this._unsubscribeFromCommandManager();
        
        this._isRunning = false;
        this._changeCount = 0;
        
        console.log('[AutoSaveManager] 중지됨');
    }
    
    /**
     * 현재 레이아웃 데이터를 localStorage에 저장
     * @returns {boolean} 저장 성공 여부
     */
    save() {
        if (!this._currentSiteId) {
            console.error('[AutoSaveManager] siteId가 설정되지 않았습니다.');
            return false;
        }
        
        if (!this.getLayoutData) {
            console.error('[AutoSaveManager] getLayoutData 함수가 설정되지 않았습니다.');
            return false;
        }
        
        try {
            // 레이아웃 데이터 가져오기
            const layoutData = this.getLayoutData();
            
            if (!layoutData) {
                console.warn('[AutoSaveManager] 저장할 레이아웃 데이터가 없습니다.');
                return false;
            }
            
            // AutoSave 메타데이터 추가
            const saveData = {
                ...layoutData,
                _autoSave: {
                    timestamp: new Date().toISOString(),
                    siteId: this._currentSiteId,
                    changeCount: this._changeCount
                }
            };
            
            // localStorage에 저장
            const key = this._getStorageKey(this._currentSiteId);
            localStorage.setItem(key, JSON.stringify(saveData));
            
            console.log(`[AutoSaveManager] 자동 저장 완료 - key: ${key}, changeCount: ${this._changeCount}`);
            
            // 변경 카운트 초기화
            this._changeCount = 0;
            
            // 콜백 호출
            if (this.onAutoSave) {
                this.onAutoSave(saveData);
            }
            
            return true;
            
        } catch (error) {
            console.error('[AutoSaveManager] 저장 실패:', error);
            return false;
        }
    }
    
    /**
     * 복구 파일 존재 확인
     * @param {string} siteId - 사이트 ID
     * @returns {Object|null} 복구 데이터 또는 null
     */
    checkForRecovery(siteId) {
        try {
            const key = this._getStorageKey(siteId);
            const data = localStorage.getItem(key);
            
            if (!data) {
                console.log(`[AutoSaveManager] 복구 데이터 없음 - siteId: ${siteId}`);
                return null;
            }
            
            const parsed = JSON.parse(data);
            
            // 메타데이터 확인
            if (parsed._autoSave) {
                const timestamp = new Date(parsed._autoSave.timestamp);
                const now = new Date();
                const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
                
                console.log(`[AutoSaveManager] 복구 데이터 발견`, {
                    siteId: parsed._autoSave.siteId,
                    timestamp: parsed._autoSave.timestamp,
                    hoursAgo: hoursDiff.toFixed(2),
                    changeCount: parsed._autoSave.changeCount
                });
                
                // 24시간 이내의 데이터만 복구 대상
                if (hoursDiff <= 24) {
                    return parsed;
                } else {
                    console.log('[AutoSaveManager] 24시간 초과된 복구 데이터 - 삭제 대상');
                    this.clearAutoSave(siteId);
                    return null;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('[AutoSaveManager] 복구 확인 실패:', error);
            return null;
        }
    }
    
    /**
     * AutoSave 데이터 삭제
     * @param {string} siteId - 사이트 ID
     */
    clearAutoSave(siteId) {
        try {
            const key = this._getStorageKey(siteId);
            localStorage.removeItem(key);
            console.log(`[AutoSaveManager] 자동 저장 삭제됨 - key: ${key}`);
        } catch (error) {
            console.error('[AutoSaveManager] 삭제 실패:', error);
        }
    }
    
    /**
     * 현재 상태 정보 반환
     * @returns {Object} 상태 정보
     */
    getStatus() {
        return {
            isRunning: this._isRunning,
            siteId: this._currentSiteId,
            changeCount: this._changeCount,
            changeThreshold: this.changeThreshold,
            intervalMs: this.intervalMs
        };
    }
    
    // =========================================================================
    // Private Methods
    // =========================================================================
    
    /**
     * localStorage key 생성
     * @private
     */
    _getStorageKey(siteId) {
        return `${this.STORAGE_KEY_PREFIX}${siteId}`;
    }
    
    /**
     * 타이머 시작
     * @private
     */
    _startTimer() {
        this._stopTimer(); // 기존 타이머 정리
        
        this._timerId = setInterval(() => {
            console.log('[AutoSaveManager] 시간 기반 자동 저장 트리거');
            this.save();
        }, this.intervalMs);
        
        console.log(`[AutoSaveManager] 타이머 시작 - ${this.intervalMs / 1000}초 간격`);
    }
    
    /**
     * 타이머 중지
     * @private
     */
    _stopTimer() {
        if (this._timerId) {
            clearInterval(this._timerId);
            this._timerId = null;
        }
    }
    
    /**
     * CommandManager 구독
     * @private
     */
    _subscribeToCommandManager() {
        if (!this.commandManager) {
            console.warn('[AutoSaveManager] CommandManager가 없어 구독하지 않습니다.');
            return;
        }
        
        // CommandManager에 콜백 등록
        if (typeof this.commandManager.onExecute === 'function') {
            // onExecute가 함수인 경우 (setter 방식)
            this.commandManager.onExecute = this._boundOnCommandExecute;
        } else if (typeof this.commandManager.addExecuteListener === 'function') {
            // addExecuteListener 방식
            this.commandManager.addExecuteListener(this._boundOnCommandExecute);
        } else if (this.commandManager.callbacks) {
            // callbacks 배열 방식
            if (!this.commandManager.callbacks.onExecute) {
                this.commandManager.callbacks.onExecute = [];
            }
            this.commandManager.callbacks.onExecute.push(this._boundOnCommandExecute);
        } else {
            console.warn('[AutoSaveManager] CommandManager 구독 방식을 찾을 수 없습니다.');
        }
        
        console.log('[AutoSaveManager] CommandManager 구독 완료');
    }
    
    /**
     * CommandManager 구독 해제
     * @private
     */
    _unsubscribeFromCommandManager() {
        if (!this.commandManager) {
            return;
        }
        
        if (typeof this.commandManager.removeExecuteListener === 'function') {
            this.commandManager.removeExecuteListener(this._boundOnCommandExecute);
        } else if (this.commandManager.callbacks && this.commandManager.callbacks.onExecute) {
            const idx = this.commandManager.callbacks.onExecute.indexOf(this._boundOnCommandExecute);
            if (idx > -1) {
                this.commandManager.callbacks.onExecute.splice(idx, 1);
            }
        }
        
        console.log('[AutoSaveManager] CommandManager 구독 해제');
    }
    
    /**
     * Command 실행 콜백
     * @private
     */
    _onCommandExecute(command) {
        this._changeCount++;
        
        console.log(`[AutoSaveManager] Command 실행 감지 - count: ${this._changeCount}/${this.changeThreshold}`);
        
        // 변경 임계값 도달 시 저장
        if (this._changeCount >= this.changeThreshold) {
            console.log('[AutoSaveManager] 변경 기반 자동 저장 트리거');
            this.save();
        }
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.stop();
        this.commandManager = null;
        this.onAutoSave = null;
        this.getLayoutData = null;
        console.log('[AutoSaveManager] disposed');
    }
}

// 전역 등록 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.AutoSaveManager = AutoSaveManager;
}

// // ES6 Module export
// export { AutoSaveManager };
// export default AutoSaveManager;