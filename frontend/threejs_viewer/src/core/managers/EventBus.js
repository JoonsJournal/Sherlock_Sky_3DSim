/**
 * EventBus.js
 * 이벤트 중앙 관리 시스템
 * 
 * @version 1.0.0
 * @description 컴포넌트 간 느슨한 결합을 위한 Pub/Sub 패턴 구현
 */

class EventBusClass {
    constructor() {
        // 이벤트 리스너 저장소
        this._listeners = new Map();
        
        // 한 번만 실행되는 리스너
        this._onceListeners = new Map();
        
        // 이벤트 히스토리 (디버깅용)
        this._history = [];
        this._historyEnabled = false;
        this._maxHistorySize = 100;
        
        console.log('[EventBus] 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 등록
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @param {Object} context - 콜백 실행 컨텍스트 (this)
     * @returns {Function} 구독 해제 함수
     */
    on(event, callback, context = null) {
        if (typeof callback !== 'function') {
            console.error('[EventBus] on: callback must be a function');
            return () => {};
        }
        
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        
        const listener = { callback, context };
        this._listeners.get(event).push(listener);
        
        // 구독 해제 함수 반환
        return () => this.off(event, callback);
    }
    
    /**
     * 한 번만 실행되는 이벤트 리스너 등록
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @param {Object} context - 콜백 실행 컨텍스트
     * @returns {Function} 구독 해제 함수
     */
    once(event, callback, context = null) {
        if (typeof callback !== 'function') {
            console.error('[EventBus] once: callback must be a function');
            return () => {};
        }
        
        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, []);
        }
        
        const listener = { callback, context };
        this._onceListeners.get(event).push(listener);
        
        return () => this._removeOnceListener(event, callback);
    }
    
    /**
     * 이벤트 리스너 제거
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 제거할 콜백 함수 (없으면 해당 이벤트 전체 제거)
     */
    off(event, callback = null) {
        if (callback === null) {
            // 해당 이벤트의 모든 리스너 제거
            this._listeners.delete(event);
            this._onceListeners.delete(event);
            return;
        }
        
        // 특정 콜백만 제거
        if (this._listeners.has(event)) {
            const listeners = this._listeners.get(event);
            const index = listeners.findIndex(l => l.callback === callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
        
        this._removeOnceListener(event, callback);
    }
    
    /**
     * once 리스너 제거 (내부용)
     */
    _removeOnceListener(event, callback) {
        if (this._onceListeners.has(event)) {
            const listeners = this._onceListeners.get(event);
            const index = listeners.findIndex(l => l.callback === callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    /**
     * 이벤트 발생
     * @param {string} event - 이벤트 이름
     * @param {*} data - 전달할 데이터
     */
    emit(event, data = null) {
        // 히스토리 기록
        if (this._historyEnabled) {
            this._addToHistory(event, data);
        }
        
        // 일반 리스너 실행
        if (this._listeners.has(event)) {
            const listeners = this._listeners.get(event);
            listeners.forEach(({ callback, context }) => {
                try {
                    callback.call(context, data);
                } catch (error) {
                    console.error(`[EventBus] Error in listener for "${event}":`, error);
                }
            });
        }
        
        // once 리스너 실행 후 제거
        if (this._onceListeners.has(event)) {
            const listeners = this._onceListeners.get(event);
            listeners.forEach(({ callback, context }) => {
                try {
                    callback.call(context, data);
                } catch (error) {
                    console.error(`[EventBus] Error in once listener for "${event}":`, error);
                }
            });
            this._onceListeners.delete(event);
        }
    }
    
    /**
     * 이벤트 리스너 존재 여부 확인
     * @param {string} event - 이벤트 이름
     * @returns {boolean}
     */
    has(event) {
        const hasNormal = this._listeners.has(event) && this._listeners.get(event).length > 0;
        const hasOnce = this._onceListeners.has(event) && this._onceListeners.get(event).length > 0;
        return hasNormal || hasOnce;
    }
    
    /**
     * 특정 이벤트의 리스너 개수
     * @param {string} event - 이벤트 이름
     * @returns {number}
     */
    listenerCount(event) {
        let count = 0;
        if (this._listeners.has(event)) {
            count += this._listeners.get(event).length;
        }
        if (this._onceListeners.has(event)) {
            count += this._onceListeners.get(event).length;
        }
        return count;
    }
    
    /**
     * 모든 리스너 제거
     */
    clear() {
        this._listeners.clear();
        this._onceListeners.clear();
        console.log('[EventBus] 모든 리스너 제거됨');
    }
    
    /**
     * 히스토리에 이벤트 추가
     */
    _addToHistory(event, data) {
        this._history.push({
            event,
            data,
            timestamp: Date.now()
        });
        
        // 최대 크기 초과 시 오래된 것 제거
        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }
    }
    
    /**
     * 히스토리 활성화/비활성화
     * @param {boolean} enabled
     */
    enableHistory(enabled = true) {
        this._historyEnabled = enabled;
        if (!enabled) {
            this._history = [];
        }
        console.log(`[EventBus] 히스토리 ${enabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * 히스토리 조회
     * @param {string} event - 특정 이벤트만 필터링 (선택)
     * @returns {Array}
     */
    getHistory(event = null) {
        if (event) {
            return this._history.filter(h => h.event === event);
        }
        return [...this._history];
    }
    
    /**
     * 등록된 이벤트 목록 조회
     * @returns {Array<string>}
     */
    getEventNames() {
        const events = new Set([
            ...this._listeners.keys(),
            ...this._onceListeners.keys()
        ]);
        return Array.from(events);
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('[EventBus] Debug Info');
        console.log('등록된 이벤트:', this.getEventNames());
        this.getEventNames().forEach(event => {
            console.log(`  ${event}: ${this.listenerCount(event)} listeners`);
        });
        console.log('히스토리 활성화:', this._historyEnabled);
        console.log('히스토리 개수:', this._history.length);
        console.groupEnd();
    }
}

// 싱글톤 인스턴스
export const eventBus = new EventBusClass();

// 클래스도 export (테스트용)
export { EventBusClass };

// 전역 노출 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.eventBus = eventBus;
}