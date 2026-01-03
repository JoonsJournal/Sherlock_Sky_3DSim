/**
 * EditorStateManager.js v1.0.1
 * =============================
 * 
 * ✨ v1.0.1 수정:
 * - ✅ clearSelection()에서 동적 생성된 HandleManager 지원
 * - ✅ this._managers.handle 대신 this.editor.handleManager 직접 참조
 * 
 * Layout Editor 통합 상태 관리자 (Facade 패턴)
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/state/EditorStateManager.js
 */

class EditorStateManager {
    constructor(options = {}) {
        this.editor = options.editor || null;
        
        // Manager 참조들 (lazy binding)
        this._managers = {
            selection: null,
            handle: null,
            renderer: null,
            smartGuide: null,
            snap: null,
            fence: null,
            alignment: null
        };
        
        this._initialized = false;
        
        console.log('[EditorStateManager] 생성 완료 v1.0.1');
    }
    
    setEditor(editor) {
        this.editor = editor;
        this._bindManagers();
        this._initialized = true;
        console.log('[EditorStateManager] Editor 바인딩 완료');
    }
    
    _bindManagers() {
        if (!this.editor) return;
        
        this._managers.selection = this.editor.selectionManager || null;
        this._managers.handle = this.editor.handleManager || null;
        this._managers.renderer = this.editor.selectionRenderer || null;
        this._managers.smartGuide = this.editor.smartGuideManager || null;
        this._managers.snap = this.editor.snapManager || null;
        this._managers.fence = this.editor.fenceSelection || null;
        this._managers.alignment = this.editor.alignmentGuide || null;
        
        const bound = Object.entries(this._managers)
            .filter(([k, v]) => v !== null)
            .map(([k]) => k);
        console.log('[EditorStateManager] 바인딩된 Manager:', bound.join(', ') || '없음');
    }
    
    rebindManagers() {
        this._bindManagers();
    }
    
    registerManager(name, manager) {
        this._managers[name] = manager;
        console.log(`[EditorStateManager] ${name} Manager 등록됨`);
    }
    
    // =====================================================
    // 🔥 핵심 수정: 동적 생성된 Manager 지원
    // =====================================================
    
    /**
     * ✨ v1.0.1: Handle Manager를 동적으로 가져옴
     * (HandleManager는 객체 선택 시 동적 생성되므로)
     */
    _getHandleManager() {
        // 캐시된 참조 먼저 확인, 없으면 editor에서 직접 가져옴
        return this._managers.handle || this.editor?.handleManager || null;
    }
    
    /**
     * ✨ v1.0.1: Selection Renderer를 동적으로 가져옴
     */
    _getSelectionRenderer() {
        return this._managers.renderer || this.editor?.selectionRenderer || null;
    }
    
    /**
     * ✨ v1.0.1: Selection Manager를 동적으로 가져옴
     */
    _getSelectionManager() {
        return this._managers.selection || this.editor?.selectionManager || null;
    }
    
    // =====================================================
    // 🔥 핵심 메서드: 통합 정리 API
    // =====================================================
    
    /**
     * ✨ 선택 관련 모든 것 정리
     * v1.0.1: 동적 생성된 HandleManager 지원
     */
    clearSelection() {
        console.log('[EditorStateManager] clearSelection() 호출');
        
        // ✨ v1.0.1: 동적으로 HandleManager 가져옴!
        const handleManager = this._getHandleManager();
        if (handleManager) {
            try {
                console.log('[EditorStateManager] HandleManager.detach() 호출');
                handleManager.detach?.();
                handleManager.clear?.();
            } catch (e) {
                console.warn('[EditorStateManager] HandleManager clear 실패:', e);
            }
        } else {
            console.log('[EditorStateManager] HandleManager 없음 (null)');
        }
        
        // ✨ v1.0.1: 동적으로 SelectionRenderer 가져옴!
        const selectionRenderer = this._getSelectionRenderer();
        if (selectionRenderer) {
            try {
                const selectionManager = this._getSelectionManager();
                const selectedObjects = selectionManager?.getSelectedObjects?.() || [];
                if (selectedObjects.length > 0) {
                    selectionRenderer.removeAllHighlights?.(selectedObjects);
                }
                selectionRenderer.destroyTransformer?.();
                selectionRenderer.hideCoordinates?.();
            } catch (e) {
                console.warn('[EditorStateManager] SelectionRenderer clear 실패:', e);
            }
        }
        
        // ✨ v1.0.1: 동적으로 SelectionManager 가져옴!
        const selectionManager = this._getSelectionManager();
        if (selectionManager) {
            try {
                selectionManager.deselectAll?.(false);
            } catch (e) {
                console.warn('[EditorStateManager] Selection2DManager clear 실패:', e);
            }
        }
        
        // FenceSelection
        const fenceSelection = this._managers.fence || this.editor?.fenceSelection;
        if (fenceSelection) {
            try {
                fenceSelection.clear?.();
            } catch (e) {
                console.warn('[EditorStateManager] FenceSelection clear 실패:', e);
            }
        }
        
        // Editor의 내부 배열 정리
        if (this.editor) {
            if (this.editor._selectedObjectsProxy) {
                this.editor._selectedObjectsProxy = [];
            }
            
            if (this.editor.transformer) {
                try {
                    this.editor.transformer.destroy();
                    this.editor.transformer = null;
                } catch (e) {}
            }
        }
        
        // UI Layer 갱신
        this._refreshUILayer();
        
        console.log('[EditorStateManager] ✅ Selection 정리 완료');
    }
    
    clearGuides() {
        console.log('[EditorStateManager] clearGuides() 호출');
        
        const smartGuide = this._managers.smartGuide || this.editor?.smartGuideManager;
        if (smartGuide) {
            try {
                smartGuide.clearGuides?.();
                smartGuide.clearReferenceObjects?.();
            } catch (e) {
                console.warn('[EditorStateManager] SmartGuideManager clear 실패:', e);
            }
        }
        
        const snapManager = this._managers.snap || this.editor?.snapManager;
        if (snapManager) {
            try {
                snapManager.clearGuides?.();
            } catch (e) {
                console.warn('[EditorStateManager] SnapManager clearGuides 실패:', e);
            }
        }
        
        const alignment = this._managers.alignment || this.editor?.alignmentGuide;
        if (alignment) {
            try {
                alignment.clearPreview?.();
                alignment.clear?.();
            } catch (e) {
                console.warn('[EditorStateManager] AlignmentGuide clear 실패:', e);
            }
        }
        
        this._refreshUILayer();
        console.log('[EditorStateManager] ✅ Guides 정리 완료');
    }
    
    clearUI() {
        console.log('[EditorStateManager] clearUI() 호출');
        
        const renderer = this._getSelectionRenderer();
        if (renderer) {
            try {
                renderer.hideCoordinates?.();
            } catch (e) {}
        }
        
        const fence = this._managers.fence || this.editor?.fenceSelection;
        if (fence) {
            try {
                fence.clear?.();
            } catch (e) {}
        }
        
        if (this.editor?.layers?.ui) {
            try {
                const tempElements = this.editor.layers.ui.find('.smart-guide-line, .distance-label, .fence-rect, .alignment-preview');
                tempElements.forEach(el => el.destroy());
            } catch (e) {}
        }
        
        this._refreshUILayer();
        console.log('[EditorStateManager] ✅ UI 정리 완료');
    }
    
    clearAll() {
        console.log('[EditorStateManager] clearAll() 호출');
        this.clearSelection();
        this.clearGuides();
        this.clearUI();
        console.log('[EditorStateManager] ✅ All 정리 완료');
    }
    
    reset() {
        console.log('[EditorStateManager] reset() 호출');
        this.clearAll();
        
        Object.values(this._managers).forEach(manager => {
            if (manager && typeof manager.clear === 'function') {
                try { manager.clear(); } catch (e) {}
            }
        });
        
        if (this.editor?.commandManager) {
            try { this.editor.commandManager.clear?.(); } catch (e) {}
        }
        
        console.log('[EditorStateManager] ✅ Reset 완료');
    }
    
    // =====================================================
    // 특수 상황 처리
    // =====================================================
    
    cleanupAfterHistoryChange() {
        console.log('[EditorStateManager] cleanupAfterHistoryChange() 호출');
        this.clearSelection();
        this.editor?.stage?.batchDraw();
    }
    
    cleanupOnToolChange() {
        console.log('[EditorStateManager] cleanupOnToolChange() 호출');
        this.clearGuides();
        this.clearUI();
    }
    
    prepareForDelete() {
        console.log('[EditorStateManager] prepareForDelete() 호출');
        
        // ✨ v1.0.1: 동적으로 가져옴
        const handleManager = this._getHandleManager();
        if (handleManager) {
            try { handleManager.detach?.(); } catch (e) {}
        }
        
        const renderer = this._getSelectionRenderer();
        if (renderer) {
            try { renderer.destroyTransformer?.(); } catch (e) {}
        }
    }
    
    cleanupAfterDelete() {
        console.log('[EditorStateManager] cleanupAfterDelete() 호출');
        this.clearSelection();
    }
    
    // =====================================================
    // 헬퍼 메서드
    // =====================================================
    
    _refreshUILayer() {
        try {
            if (this.editor?.layers?.ui) {
                this.editor.layers.ui.batchDraw();
            }
            if (this.editor?.stage) {
                this.editor.stage.batchDraw();
            }
        } catch (e) {
            console.warn('[EditorStateManager] UI 갱신 실패:', e);
        }
    }
    
    getManager(name) {
        return this._managers[name] || null;
    }
    
    isInitialized() {
        return this._initialized;
    }
    
    debugState() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[EditorStateManager] Debug State v1.0.1');
        console.log('  ├─ Initialized:', this._initialized);
        console.log('  ├─ Editor:', this.editor ? '✅' : '❌');
        console.log('  ├─ Editor.handleManager:', this.editor?.handleManager ? '✅ (동적 생성됨)' : '❌');
        console.log('  └─ Cached Managers:');
        Object.entries(this._managers).forEach(([name, manager]) => {
            console.log(`      ├─ ${name}: ${manager ? '✅' : '❌'}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    destroy() {
        this.clearAll();
        this._managers = {};
        this.editor = null;
        this._initialized = false;
        console.log('[EditorStateManager] 파괴 완료');
    }
}

// Exports
if (typeof window !== 'undefined') {
    window.EditorStateManager = EditorStateManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditorStateManager;
}

console.log('✅ EditorStateManager.js 로드 완료 v1.0.1');