/**
 * LayoutEditorState.js
 * ====================
 * Layout Editor 상태 관리
 * 
 * main.js 통합 대비 - EventBus 패턴 적용
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/state/LayoutEditorState.js
 */

// =====================================================
// 간단한 EventEmitter (EventBus 통합 전 사용)
// =====================================================
class SimpleEventEmitter {
    constructor() {
        this._events = {};
    }
    
    on(event, callback) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(callback);
        return () => this.off(event, callback);
    }
    
    off(event, callback) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(cb => cb !== callback);
    }
    
    emit(event, data) {
        if (!this._events[event]) return;
        this._events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventEmitter] Error in "${event}" handler:`, error);
            }
        });
    }
    
    once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    }
}

// =====================================================
// LayoutEditorState 클래스
// =====================================================
class LayoutEditorState extends SimpleEventEmitter {
    constructor() {
        super();
        
        // =====================================================
        // UI 상태
        // =====================================================
        this._ui = {
            componentSubmenuVisible: false,
            alignPopupVisible: false,
            shortcutsHelpVisible: false,
            propertyPanelVisible: true
        };
        
        // =====================================================
        // 도구 상태
        // =====================================================
        this._currentTool = 'select';
        
        // =====================================================
        // 선택 상태
        // =====================================================
        this._selectedObjects = [];
        
        // =====================================================
        // 캔버스 상태
        // =====================================================
        this._canvas = {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            showGrid: true,
            snapToGrid: true,
            gridSize: 10
        };
        
        // =====================================================
        // 히스토리 상태
        // =====================================================
        this._history = {
            undoCount: 0,
            redoCount: 0,
            canUndo: false,
            canRedo: false
        };
        
        // =====================================================
        // 객체 통계
        // =====================================================
        this._stats = {
            totalObjects: 0,
            selectedCount: 0,
            groupCount: 0
        };
        
        // =====================================================
        // 기능 토글 상태
        // =====================================================
        this._features = {
            miceSnapEnabled: true,
            smartGuidesEnabled: true
        };
        
        console.log('✅ LayoutEditorState 초기화 완료');
    }
    
    // =====================================================
    // UI 상태 Getter/Setter
    // =====================================================
    get componentSubmenuVisible() {
        return this._ui.componentSubmenuVisible;
    }
    
    set componentSubmenuVisible(value) {
        const oldValue = this._ui.componentSubmenuVisible;
        this._ui.componentSubmenuVisible = value;
        if (oldValue !== value) {
            this.emit('ui:submenu:changed', { visible: value, type: 'component' });
        }
    }
    
    get alignPopupVisible() {
        return this._ui.alignPopupVisible;
    }
    
    set alignPopupVisible(value) {
        const oldValue = this._ui.alignPopupVisible;
        this._ui.alignPopupVisible = value;
        if (oldValue !== value) {
            this.emit('ui:popup:changed', { visible: value, type: 'align' });
        }
    }
    
    get shortcutsHelpVisible() {
        return this._ui.shortcutsHelpVisible;
    }
    
    set shortcutsHelpVisible(value) {
        const oldValue = this._ui.shortcutsHelpVisible;
        this._ui.shortcutsHelpVisible = value;
        if (oldValue !== value) {
            this.emit('ui:popup:changed', { visible: value, type: 'shortcuts' });
        }
    }
    
    // =====================================================
    // 도구 상태 Getter/Setter
    // =====================================================
    get currentTool() {
        return this._currentTool;
    }
    
    set currentTool(value) {
        const oldValue = this._currentTool;
        this._currentTool = value;
        if (oldValue !== value) {
            this.emit('tool:changed', { 
                previous: oldValue, 
                current: value 
            });
        }
    }
    
    // =====================================================
    // 선택 상태 Getter/Setter
    // =====================================================
    get selectedObjects() {
        return [...this._selectedObjects];
    }
    
    set selectedObjects(objects) {
        const oldCount = this._selectedObjects.length;
        this._selectedObjects = objects || [];
        this._stats.selectedCount = this._selectedObjects.length;
        
        this.emit('selection:changed', {
            objects: this._selectedObjects,
            count: this._selectedObjects.length,
            previousCount: oldCount
        });
    }
    
    get selectedCount() {
        return this._selectedObjects.length;
    }
    
    // =====================================================
    // 캔버스 상태 Getter/Setter
    // =====================================================
    get zoom() {
        return this._canvas.zoom;
    }
    
    set zoom(value) {
        const oldValue = this._canvas.zoom;
        this._canvas.zoom = value;
        if (oldValue !== value) {
            this.emit('canvas:zoom:changed', { 
                previous: oldValue, 
                current: value 
            });
        }
    }
    
    get showGrid() {
        return this._canvas.showGrid;
    }
    
    set showGrid(value) {
        const oldValue = this._canvas.showGrid;
        this._canvas.showGrid = value;
        if (oldValue !== value) {
            this.emit('canvas:grid:changed', { visible: value });
        }
    }
    
    get snapToGrid() {
        return this._canvas.snapToGrid;
    }
    
    set snapToGrid(value) {
        const oldValue = this._canvas.snapToGrid;
        this._canvas.snapToGrid = value;
        if (oldValue !== value) {
            this.emit('canvas:snap:changed', { enabled: value });
        }
    }
    
    // =====================================================
    // 히스토리 상태 Getter/Setter
    // =====================================================
    get history() {
        return { ...this._history };
    }
    
    updateHistory(state) {
        this._history = {
            undoCount: state.undoCount ?? this._history.undoCount,
            redoCount: state.redoCount ?? this._history.redoCount,
            canUndo: state.canUndo ?? this._history.canUndo,
            canRedo: state.canRedo ?? this._history.canRedo
        };
        this.emit('history:changed', this._history);
    }
    
    // =====================================================
    // 통계 Getter/Setter
    // =====================================================
    get stats() {
        return { ...this._stats };
    }
    
    updateStats(stats) {
        this._stats = {
            ...this._stats,
            ...stats
        };
        this.emit('stats:changed', this._stats);
    }
    
    set totalObjects(value) {
        this._stats.totalObjects = value;
        this.emit('stats:changed', this._stats);
    }
    
    get totalObjects() {
        return this._stats.totalObjects;
    }
    
    set groupCount(value) {
        this._stats.groupCount = value;
        this.emit('stats:changed', this._stats);
    }
    
    get groupCount() {
        return this._stats.groupCount;
    }
    
    // =====================================================
    // 기능 토글 Getter/Setter
    // =====================================================
    get miceSnapEnabled() {
        return this._features.miceSnapEnabled;
    }
    
    set miceSnapEnabled(value) {
        const oldValue = this._features.miceSnapEnabled;
        this._features.miceSnapEnabled = value;
        if (oldValue !== value) {
            this.emit('feature:miceSnap:changed', { enabled: value });
        }
    }
    
    get smartGuidesEnabled() {
        return this._features.smartGuidesEnabled;
    }
    
    set smartGuidesEnabled(value) {
        const oldValue = this._features.smartGuidesEnabled;
        this._features.smartGuidesEnabled = value;
        if (oldValue !== value) {
            this.emit('feature:smartGuides:changed', { enabled: value });
        }
    }
    
    // =====================================================
    // 편의 메서드
    // =====================================================
    
    /**
     * 모든 팝업/서브메뉴 닫기
     */
    closeAllPopups() {
        this.componentSubmenuVisible = false;
        this.alignPopupVisible = false;
        this.shortcutsHelpVisible = false;
    }
    
    /**
     * 선택 초기화
     */
    clearSelection() {
        this.selectedObjects = [];
    }
    
    /**
     * 객체 선택 추가
     */
    addToSelection(object) {
        if (!this._selectedObjects.includes(object)) {
            this._selectedObjects.push(object);
            this._stats.selectedCount = this._selectedObjects.length;
            this.emit('selection:changed', {
                objects: this._selectedObjects,
                count: this._selectedObjects.length,
                added: object
            });
        }
    }
    
    /**
     * 객체 선택 제거
     */
    removeFromSelection(object) {
        const index = this._selectedObjects.indexOf(object);
        if (index > -1) {
            this._selectedObjects.splice(index, 1);
            this._stats.selectedCount = this._selectedObjects.length;
            this.emit('selection:changed', {
                objects: this._selectedObjects,
                count: this._selectedObjects.length,
                removed: object
            });
        }
    }
    
    /**
     * 전체 상태 스냅샷 (디버깅용)
     */
    getSnapshot() {
        return {
            ui: { ...this._ui },
            currentTool: this._currentTool,
            selectedCount: this._selectedObjects.length,
            canvas: { ...this._canvas },
            history: { ...this._history },
            stats: { ...this._stats },
            features: { ...this._features }
        };
    }
    
    /**
     * 상태 리셋
     */
    reset() {
        this._ui = {
            componentSubmenuVisible: false,
            alignPopupVisible: false,
            shortcutsHelpVisible: false,
            propertyPanelVisible: true
        };
        this._currentTool = 'select';
        this._selectedObjects = [];
        this._canvas = {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            showGrid: true,
            snapToGrid: true,
            gridSize: 10
        };
        this._history = {
            undoCount: 0,
            redoCount: 0,
            canUndo: false,
            canRedo: false
        };
        this._stats = {
            totalObjects: 0,
            selectedCount: 0,
            groupCount: 0
        };
        this._features = {
            miceSnapEnabled: true,
            smartGuidesEnabled: true
        };
        
        this.emit('state:reset');
        console.log('🔄 LayoutEditorState 리셋 완료');
    }
}

// =====================================================
// 싱글톤 인스턴스
// =====================================================
const layoutEditorState = new LayoutEditorState();

// =====================================================
// Export (전역 + ES6 모듈 호환)
// =====================================================

// 전역 객체로 노출 (script 태그 로드 호환)
if (typeof window !== 'undefined') {
    window.LayoutEditorState = LayoutEditorState;
    window.layoutEditorState = layoutEditorState;
}

// ES6 모듈 export (번들러 사용 시)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LayoutEditorState,
        layoutEditorState
    };
}

console.log('✅ LayoutEditorState.js 로드 완료');