/**
 * LayoutEditorState.js
 * 
 * Proxy 기반 반응형 상태 관리 시스템
 * Layout Editor의 전역 상태를 관리하고 상태 변경을 감시합니다.
 * 
 * @module LayoutEditorState
 * @version 1.0.0
 */

class LayoutEditorState {
    constructor() {
        // 초기 상태 정의
        this._state = {
            mode: 'viewer',              // 'viewer' | 'editor'
            currentSiteId: null,         // 현재 선택된 Site ID
            currentLayout: null,         // 현재 로드된 Layout 객체
            selectedObjects: [],         // 선택된 객체들의 배열
            editHistory: [],             // 편집 히스토리 스택
            historyIndex: -1,            // 현재 히스토리 인덱스
            isDirty: false,              // 저장되지 않은 변경사항 여부
            lastSaved: null,             // 마지막 저장 시각
            autoSaveEnabled: true,       // 자동 저장 활성화 여부
            showGrid: true,              // 그리드 표시 여부
            snapToGrid: true,            // Snap to Grid 활성화 여부
            gridSize: 10                 // 그리드 크기 (픽셀)
        };

        // 이벤트 리스너 맵: { key: Set([callback1, callback2, ...]) }
        this._listeners = new Map();

        // 전역 상태 변경 리스너
        this._globalListeners = new Set();

        // Proxy로 상태 감싸기 (상태 변경 감지)
        this.state = new Proxy(this._state, {
            set: (target, property, value) => {
                const oldValue = target[property];
                
                // 값이 실제로 변경된 경우에만 처리
                if (oldValue !== value) {
                    target[property] = value;
                    
                    // 디버깅 로그
                    console.log(`[LayoutEditorState] ${property} changed:`, {
                        old: oldValue,
                        new: value
                    });

                    // 특정 속성 변경 리스너 호출
                    this._notifyListeners(property, value, oldValue);

                    // 전역 리스너 호출
                    this._notifyGlobalListeners(property, value, oldValue);

                    // isDirty 자동 설정 (저장 관련 속성이 아닌 경우)
                    if (property !== 'isDirty' && 
                        property !== 'lastSaved' && 
                        property !== 'mode' &&
                        property !== 'selectedObjects') {
                        target.isDirty = true;
                    }
                }

                return true;
            },

            get: (target, property) => {
                return target[property];
            }
        });
    }

    /**
     * 특정 상태 속성의 변경을 감시합니다.
     * 
     * @param {string} key - 감시할 상태 속성 이름
     * @param {Function} callback - 변경 시 호출될 콜백 (newValue, oldValue) => void
     * @returns {Function} unsubscribe 함수
     * 
     * @example
     * const unsubscribe = layoutEditorState.subscribe('mode', (newVal, oldVal) => {
     *     console.log(`Mode changed from ${oldVal} to ${newVal}`);
     * });
     * 
     * // 나중에 구독 해제
     * unsubscribe();
     */
    subscribe(key, callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }

        this._listeners.get(key).add(callback);

        console.log(`[LayoutEditorState] Subscribed to '${key}'`);

        // unsubscribe 함수 반환
        return () => this.unsubscribe(key, callback);
    }

    /**
     * 특정 속성의 감시를 해제합니다.
     * 
     * @param {string} key - 속성 이름
     * @param {Function} callback - 제거할 콜백
     */
    unsubscribe(key, callback) {
        if (this._listeners.has(key)) {
            this._listeners.get(key).delete(callback);
            
            // 리스너가 없으면 키 제거
            if (this._listeners.get(key).size === 0) {
                this._listeners.delete(key);
            }

            console.log(`[LayoutEditorState] Unsubscribed from '${key}'`);
        }
    }

    /**
     * 모든 상태 변경을 감시하는 전역 리스너를 등록합니다.
     * 
     * @param {Function} callback - (property, newValue, oldValue) => void
     * @returns {Function} unsubscribe 함수
     */
    subscribeGlobal(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        this._globalListeners.add(callback);

        console.log('[LayoutEditorState] Global listener added');

        return () => {
            this._globalListeners.delete(callback);
            console.log('[LayoutEditorState] Global listener removed');
        };
    }

    /**
     * 특정 속성 변경 시 리스너들을 호출합니다.
     * 
     * @private
     */
    _notifyListeners(key, newValue, oldValue) {
        if (this._listeners.has(key)) {
            this._listeners.get(key).forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error(`[LayoutEditorState] Error in listener for '${key}':`, error);
                }
            });
        }
    }

    /**
     * 전역 리스너들을 호출합니다.
     * 
     * @private
     */
    _notifyGlobalListeners(property, newValue, oldValue) {
        this._globalListeners.forEach(callback => {
            try {
                callback(property, newValue, oldValue);
            } catch (error) {
                console.error('[LayoutEditorState] Error in global listener:', error);
            }
        });
    }

    /**
     * Editor 모드로 전환합니다.
     * 
     * @param {string} siteId - Site ID
     * @param {Object} layoutData - Layout 데이터
     * 
     * @example
     * layoutEditorState.enterEditorMode('korea_site1_line1', templateLayout);
     */
    enterEditorMode(siteId, layoutData) {
        console.log('[LayoutEditorState] Entering Editor Mode', { siteId });

        this.state.mode = 'editor';
        this.state.currentSiteId = siteId;
        this.state.currentLayout = layoutData;
        this.state.selectedObjects = [];
        this.state.editHistory = [];
        this.state.historyIndex = -1;
        this.state.isDirty = false;
    }

    /**
     * Viewer 모드로 전환합니다.
     * 
     * @param {string} siteId - Site ID
     * @param {Object} layoutData - Layout 데이터
     * 
     * @example
     * layoutEditorState.enterViewerMode('korea_site1_line1', existingLayout);
     */
    enterViewerMode(siteId, layoutData) {
        console.log('[LayoutEditorState] Entering Viewer Mode', { siteId });

        this.state.mode = 'viewer';
        this.state.currentSiteId = siteId;
        this.state.currentLayout = layoutData;
        this.state.selectedObjects = [];
        this.state.isDirty = false;
    }

    /**
     * 저장 완료 상태로 표시합니다.
     */
    markAsSaved() {
        console.log('[LayoutEditorState] Marked as saved');

        this.state.isDirty = false;
        this.state.lastSaved = new Date();
    }

    /**
     * Dirty 상태로 표시합니다 (변경사항 있음).
     */
    markAsDirty() {
        this.state.isDirty = true;
    }

    /**
     * 편집 히스토리에 새 항목을 추가합니다.
     * 
     * @param {Object} snapshot - 상태 스냅샷
     */
    addToHistory(snapshot) {
        // 현재 인덱스 이후의 히스토리 제거 (새로운 분기 시작)
        this.state.editHistory = this.state.editHistory.slice(0, this.state.historyIndex + 1);

        // 새 스냅샷 추가
        this.state.editHistory.push({
            timestamp: new Date(),
            data: JSON.parse(JSON.stringify(snapshot)) // Deep copy
        });

        this.state.historyIndex = this.state.editHistory.length - 1;

        // 히스토리 크기 제한 (100개)
        if (this.state.editHistory.length > 100) {
            this.state.editHistory.shift();
            this.state.historyIndex--;
        }

        console.log('[LayoutEditorState] Added to history', {
            index: this.state.historyIndex,
            total: this.state.editHistory.length
        });
    }

    /**
     * Undo 기능을 수행합니다.
     * 
     * @returns {Object|null} 이전 상태 스냅샷 또는 null
     */
    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            const snapshot = this.state.editHistory[this.state.historyIndex];
            
            console.log('[LayoutEditorState] Undo', {
                index: this.state.historyIndex,
                total: this.state.editHistory.length
            });

            return snapshot.data;
        }

        console.warn('[LayoutEditorState] Cannot undo: at beginning of history');
        return null;
    }

    /**
     * Redo 기능을 수행합니다.
     * 
     * @returns {Object|null} 다음 상태 스냅샷 또는 null
     */
    redo() {
        if (this.state.historyIndex < this.state.editHistory.length - 1) {
            this.state.historyIndex++;
            const snapshot = this.state.editHistory[this.state.historyIndex];
            
            console.log('[LayoutEditorState] Redo', {
                index: this.state.historyIndex,
                total: this.state.editHistory.length
            });

            return snapshot.data;
        }

        console.warn('[LayoutEditorState] Cannot redo: at end of history');
        return null;
    }

    /**
     * 객체 선택 상태를 업데이트합니다.
     * 
     * @param {Array} objects - 선택된 객체들
     */
    setSelectedObjects(objects) {
        this.state.selectedObjects = [...objects];
    }

    /**
     * 단일 객체를 선택 목록에 추가합니다.
     * 
     * @param {Object} object - 추가할 객체
     */
    addSelectedObject(object) {
        if (!this.state.selectedObjects.includes(object)) {
            this.state.selectedObjects = [...this.state.selectedObjects, object];
        }
    }

    /**
     * 객체를 선택 목록에서 제거합니다.
     * 
     * @param {Object} object - 제거할 객체
     */
    removeSelectedObject(object) {
        this.state.selectedObjects = this.state.selectedObjects.filter(obj => obj !== object);
    }

    /**
     * 모든 선택을 해제합니다.
     */
    clearSelection() {
        this.state.selectedObjects = [];
    }

    /**
     * 현재 상태를 JSON 형태로 내보냅니다.
     * 
     * @returns {Object} 상태 스냅샷
     */
    exportState() {
        return {
            mode: this.state.mode,
            currentSiteId: this.state.currentSiteId,
            currentLayout: this.state.currentLayout,
            isDirty: this.state.isDirty,
            lastSaved: this.state.lastSaved,
            autoSaveEnabled: this.state.autoSaveEnabled,
            showGrid: this.state.showGrid,
            snapToGrid: this.state.snapToGrid,
            gridSize: this.state.gridSize
        };
    }

    /**
     * 상태를 초기화합니다.
     */
    reset() {
        console.log('[LayoutEditorState] Resetting state');

        this.state.mode = 'viewer';
        this.state.currentSiteId = null;
        this.state.currentLayout = null;
        this.state.selectedObjects = [];
        this.state.editHistory = [];
        this.state.historyIndex = -1;
        this.state.isDirty = false;
        this.state.lastSaved = null;
    }

    /**
     * 현재 상태 정보를 로그로 출력합니다.
     */
    debug() {
        console.log('[LayoutEditorState] Current State:', {
            mode: this.state.mode,
            currentSiteId: this.state.currentSiteId,
            hasLayout: !!this.state.currentLayout,
            selectedCount: this.state.selectedObjects.length,
            historySize: this.state.editHistory.length,
            historyIndex: this.state.historyIndex,
            isDirty: this.state.isDirty,
            lastSaved: this.state.lastSaved,
            autoSaveEnabled: this.state.autoSaveEnabled,
            showGrid: this.state.showGrid,
            snapToGrid: this.state.snapToGrid,
            gridSize: this.state.gridSize
        });

        console.log('[LayoutEditorState] Active Listeners:', {
            specificListeners: Array.from(this._listeners.keys()),
            globalListeners: this._globalListeners.size
        });
    }
}

// Singleton 인스턴스 생성
const layoutEditorState = new LayoutEditorState();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.layoutEditorState = layoutEditorState;
}

// ES Module export
export default layoutEditorState;
export { LayoutEditorState };