/**
 * LayoutEditorState.js
 * 
 * Proxy 기반 반응형 상태 관리 시스템
 * Layout Editor의 전역 상태를 관리하고 상태 변경을 감시합니다.
 * 
 * @module LayoutEditorState
 * @version 1.2.0 - Phase 3.3: 버전 관리 및 Change Log 통합
 * 
 * ✨ v1.2.0 신규 기능:
 * - layoutVersion 상태 추가
 * - changeLog 상태 추가
 * - previousLayout 상태 추가 (백업용)
 * - markAsSaved() 확장 (버전 증가 옵션)
 * - incrementVersion() 메서드 추가
 * - addChangeLogEntry() 메서드 추가
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
            gridSize: 10,                // 그리드 크기 (픽셀)
            
            // v1.1.0: Equipment Array 설정
            equipmentArrayConfig: {
                rows: 26,
                cols: 6,
                equipmentSize: {
                    width: 1.5,          // m
                    depth: 3.0           // m
                },
                spacing: 0.5,            // m
                corridorCols: [2, 4],    // 복도 위치 (열)
                corridorColWidth: 1.2,   // 복도 폭 (열 방향)
                corridorRows: [13],      // 복도 위치 (행)
                corridorRowWidth: 2.0,   // 복도 폭 (행 방향)
                excludedPositions: []    // 제외 위치 [{row, col}, ...]
            },
            
            // ✨ v1.2.0: 버전 관리
            layoutVersion: 1,            // 현재 Layout 버전
            changeLog: [],               // 변경 이력 배열
            previousLayout: null,        // 이전 Layout (백업용)
            
            // ✨ v1.2.0: 저장 상태
            isSaving: false,             // 저장 진행 중 여부
            lastSaveResult: null         // 마지막 저장 결과
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
                    const nonDirtyProperties = [
                        'isDirty', 'lastSaved', 'mode', 'selectedObjects',
                        'isSaving', 'lastSaveResult', 'previousLayout'
                    ];
                    
                    if (!nonDirtyProperties.includes(property)) {
                        target.isDirty = true;
                    }
                }

                return true;
            },

            get: (target, property) => {
                return target[property];
            }
        });
        
        console.log('[LayoutEditorState] ✅ Initialized v1.2.0');
    }

    /**
     * 특정 상태 속성의 변경을 감시합니다.
     * 
     * @param {string} key - 감시할 상태 속성 이름
     * @param {Function} callback - 변경 시 호출될 콜백 (newValue, oldValue) => void
     * @returns {Function} unsubscribe 함수
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
     */
    unsubscribe(key, callback) {
        if (this._listeners.has(key)) {
            this._listeners.get(key).delete(callback);
            
            if (this._listeners.get(key).size === 0) {
                this._listeners.delete(key);
            }

            console.log(`[LayoutEditorState] Unsubscribed from '${key}'`);
        }
    }

    /**
     * 모든 상태 변경을 감시하는 전역 리스너를 등록합니다.
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
     */
    enterEditorMode(siteId, layoutData) {
        console.log('[LayoutEditorState] Entering Editor Mode', { siteId });

        // ✨ v1.2.0: 버전 정보 추출
        const version = layoutData?.layout_version || 1;
        const changeLog = layoutData?.change_log || [];

        this.state.mode = 'editor';
        this.state.currentSiteId = siteId;
        this.state.currentLayout = layoutData;
        this.state.selectedObjects = [];
        this.state.editHistory = [];
        this.state.historyIndex = -1;
        this.state.isDirty = false;
        
        // ✨ v1.2.0: 버전 상태 초기화
        this.state.layoutVersion = version;
        this.state.changeLog = changeLog;
        this.state.previousLayout = layoutData ? JSON.parse(JSON.stringify(layoutData)) : null;
    }

    /**
     * Viewer 모드로 전환합니다.
     * 
     * @param {string} siteId - Site ID
     * @param {Object} layoutData - Layout 데이터
     */
    enterViewerMode(siteId, layoutData) {
        console.log('[LayoutEditorState] Entering Viewer Mode', { siteId });

        // ✨ v1.2.0: 버전 정보 추출
        const version = layoutData?.layout_version || 1;
        const changeLog = layoutData?.change_log || [];

        this.state.mode = 'viewer';
        this.state.currentSiteId = siteId;
        this.state.currentLayout = layoutData;
        this.state.selectedObjects = [];
        this.state.isDirty = false;
        
        // ✨ v1.2.0: 버전 상태 초기화
        this.state.layoutVersion = version;
        this.state.changeLog = changeLog;
    }

    /**
     * ✨ v1.2.0: 저장 완료 상태로 표시 (확장)
     * 
     * @param {Object} options - 옵션
     * @param {boolean} options.incrementVersion - 버전 증가 여부 (기본: false)
     * @param {string} options.changeDescription - 변경 설명
     */
    markAsSaved(options = {}) {
        const {
            incrementVersion = false,
            changeDescription = null
        } = options;
        
        console.log('[LayoutEditorState] Marked as saved', options);

        // 기존 동작 유지
        this.state.isDirty = false;
        this.state.lastSaved = new Date();
        
        // ✨ v1.2.0: 버전 증가 (옵션)
        if (incrementVersion) {
            this.state.layoutVersion = (this.state.layoutVersion || 1) + 1;
            console.log(`[LayoutEditorState] Version incremented to: ${this.state.layoutVersion}`);
            
            // Change Log 추가
            if (changeDescription) {
                this.addChangeLogEntry(changeDescription);
            }
        }
        
        // 현재 Layout을 previousLayout으로 저장 (다음 백업용)
        if (this.state.currentLayout) {
            this.state.previousLayout = JSON.parse(JSON.stringify(this.state.currentLayout));
        }
    }

    /**
     * ✨ v1.2.0: 버전 증가
     * @returns {number} 새 버전 번호
     */
    incrementVersion() {
        this.state.layoutVersion = (this.state.layoutVersion || 1) + 1;
        console.log(`[LayoutEditorState] Version incremented to: ${this.state.layoutVersion}`);
        return this.state.layoutVersion;
    }

    /**
     * ✨ v1.2.0: Change Log 항목 추가
     * @param {string} description - 변경 설명
     */
    addChangeLogEntry(description) {
        const entry = {
            version: this.state.layoutVersion,
            timestamp: new Date().toISOString(),
            changes: description
        };
        
        // 배열 앞에 추가
        const newLog = [entry, ...this.state.changeLog];
        
        // 최대 20개 유지
        if (newLog.length > 20) {
            newLog.splice(20);
        }
        
        this.state.changeLog = newLog;
        
        console.log(`[LayoutEditorState] Change log entry added:`, entry);
    }

    /**
     * ✨ v1.2.0: 현재 버전 정보 가져오기
     * @returns {Object} 버전 정보
     */
    getVersionInfo() {
        return {
            version: this.state.layoutVersion,
            changeLog: [...this.state.changeLog],
            lastSaved: this.state.lastSaved,
            isDirty: this.state.isDirty
        };
    }

    /**
     * ✨ v1.2.0: 저장 시작 표시
     */
    startSaving() {
        this.state.isSaving = true;
        console.log('[LayoutEditorState] Save started');
    }

    /**
     * ✨ v1.2.0: 저장 완료 표시
     * @param {Object} result - 저장 결과
     */
    finishSaving(result) {
        this.state.isSaving = false;
        this.state.lastSaveResult = result;
        console.log('[LayoutEditorState] Save finished:', result);
    }

    /**
     * Dirty 상태로 표시합니다.
     */
    markAsDirty() {
        this.state.isDirty = true;
    }

    /**
     * 편집 히스토리에 새 항목을 추가합니다.
     */
    addToHistory(snapshot) {
        this.state.editHistory = this.state.editHistory.slice(0, this.state.historyIndex + 1);

        this.state.editHistory.push({
            timestamp: new Date(),
            data: JSON.parse(JSON.stringify(snapshot))
        });

        this.state.historyIndex = this.state.editHistory.length - 1;

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
     * Undo 기능
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
     * Redo 기능
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
     * 객체 선택 관련 메서드들
     */
    setSelectedObjects(objects) {
        this.state.selectedObjects = [...objects];
    }

    addSelectedObject(object) {
        if (!this.state.selectedObjects.includes(object)) {
            this.state.selectedObjects = [...this.state.selectedObjects, object];
        }
    }

    removeSelectedObject(object) {
        this.state.selectedObjects = this.state.selectedObjects.filter(obj => obj !== object);
    }

    clearSelection() {
        this.state.selectedObjects = [];
    }

    /**
     * Equipment Array 설정 메서드들
     */
    updateEquipmentArrayConfig(config) {
        this.state.equipmentArrayConfig = {
            ...this.state.equipmentArrayConfig,
            ...config
        };
        
        console.log('[LayoutEditorState] Equipment Array Config updated:', this.state.equipmentArrayConfig);
    }

    getEquipmentArrayConfig() {
        return { ...this.state.equipmentArrayConfig };
    }

    /**
     * 현재 상태를 JSON 형태로 내보냅니다.
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
            gridSize: this.state.gridSize,
            equipmentArrayConfig: this.state.equipmentArrayConfig,
            // ✨ v1.2.0: 버전 정보
            layoutVersion: this.state.layoutVersion,
            changeLog: this.state.changeLog
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
        
        // ✨ v1.2.0: 버전 정보 초기화
        this.state.layoutVersion = 1;
        this.state.changeLog = [];
        this.state.previousLayout = null;
        this.state.isSaving = false;
        this.state.lastSaveResult = null;
    }

    /**
     * 디버그 정보 출력
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
            gridSize: this.state.gridSize,
            equipmentArrayConfig: this.state.equipmentArrayConfig,
            // ✨ v1.2.0
            layoutVersion: this.state.layoutVersion,
            changeLogCount: this.state.changeLog.length,
            hasPreviousLayout: !!this.state.previousLayout,
            isSaving: this.state.isSaving
        });

        console.log('[LayoutEditorState] Active Listeners:', {
            specificListeners: Array.from(this._listeners.keys()),
            globalListeners: this._globalListeners.size
        });
        
        // ✨ v1.2.0: Change Log 출력
        if (this.state.changeLog.length > 0) {
            console.log('[LayoutEditorState] Change Log:');
            this.state.changeLog.forEach((entry, index) => {
                console.log(`  ${index + 1}. v${entry.version} (${entry.timestamp}): ${entry.changes}`);
            });
        }
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