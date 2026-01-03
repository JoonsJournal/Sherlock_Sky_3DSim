/**
 * EditorStateManager.js v1.0.0
 * =============================
 * 
 * Layout Editor 통합 상태 관리자 (Facade 패턴)
 * 
 * ┌──────────────────────────────────────────────────────────────┐
 * │                    EditorStateManager                        │
 * │  ┌─────────────────────────────────────────────────────────┐ │
 * │  │ clearAll()         ← 모든 것 정리                        │ │
 * │  │ clearSelection()   ← 선택 관련만 정리                    │ │
 * │  │ clearGuides()      ← 가이드 관련만 정리                  │ │
 * │  │ reset()            ← 에디터 전체 리셋                    │ │
 * │  └─────────────────────────────────────────────────────────┘ │
 * │                           ↓                                  │
 * │  ┌─────────┬───────────┬───────────┬──────────┬───────────┐ │
 * │  │Selection│ Handle   │ Selection │ Smart   │ Snap      │ │
 * │  │2DManager│ Manager  │ Renderer  │ Guide   │ Manager   │ │
 * │  └─────────┴───────────┴───────────┴──────────┴───────────┘ │
 * └──────────────────────────────────────────────────────────────┘
 * 
 * 역할:
 * 1. 모든 Manager의 정리 작업을 단일 진입점으로 통합
 * 2. 선택, 핸들, 가이드라인 등 분산된 상태 관리를 일원화
 * 3. 새 Manager 추가 시 이 파일만 수정하면 됨
 * 
 * 사용 예시:
 * - 기존: editor.selectionManager.deselectAll(); 
 *         editor.handleManager.clear(); 
 *         editor.selectionRenderer.clear();
 * - 통합: editor.stateManager.clearSelection();
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/state/EditorStateManager.js
 */

class EditorStateManager {
    /**
     * @param {Object} options - 초기화 옵션
     * @param {Canvas2DEditor} options.editor - Canvas2DEditor 인스턴스
     */
    constructor(options = {}) {
        this.editor = options.editor || null;
        
        // Manager 참조들 (lazy binding)
        this._managers = {
            selection: null,      // Selection2DManager
            handle: null,         // HandleManager
            renderer: null,       // SelectionRenderer
            smartGuide: null,     // SmartGuideManager
            snap: null,           // SnapManager
            fence: null,          // FenceSelection
            alignment: null       // AlignmentGuide
        };
        
        // 상태 플래그
        this._initialized = false;
        
        console.log('[EditorStateManager] 생성 완료 v1.0.0');
    }
    
    // =====================================================
    // Manager 등록 (Lazy Binding)
    // =====================================================
    
    /**
     * Canvas2DEditor 설정 (모든 Manager 자동 바인딩)
     * @param {Canvas2DEditor} editor
     */
    setEditor(editor) {
        this.editor = editor;
        this._bindManagers();
        this._initialized = true;
        console.log('[EditorStateManager] Editor 바인딩 완료');
    }
    
    /**
     * Editor에서 Manager들 자동 바인딩
     * @private
     */
    _bindManagers() {
        if (!this.editor) return;
        
        // Canvas2DEditor의 속성명에 맞춰 바인딩
        this._managers.selection = this.editor.selectionManager || null;
        this._managers.handle = this.editor.handleManager || null;
        this._managers.renderer = this.editor.selectionRenderer || null;
        this._managers.smartGuide = this.editor.smartGuideManager || null;
        this._managers.snap = this.editor.snapManager || null;
        this._managers.fence = this.editor.fenceSelection || null;
        this._managers.alignment = this.editor.alignmentGuide || null;
        
        // 바인딩 결과 로그
        const bound = Object.entries(this._managers)
            .filter(([k, v]) => v !== null)
            .map(([k]) => k);
        console.log('[EditorStateManager] 바인딩된 Manager:', bound.join(', ') || '없음');
    }
    
    /**
     * Manager 재바인딩 (나중에 추가된 Manager 연결)
     */
    rebindManagers() {
        this._bindManagers();
    }
    
    /**
     * 개별 Manager 등록
     * @param {string} name - Manager 이름
     * @param {Object} manager - Manager 인스턴스
     */
    registerManager(name, manager) {
        if (this._managers.hasOwnProperty(name)) {
            this._managers[name] = manager;
            console.log(`[EditorStateManager] ${name} Manager 등록됨`);
        } else {
            // 새로운 Manager 타입 추가
            this._managers[name] = manager;
            console.log(`[EditorStateManager] 새 Manager 등록: ${name}`);
        }
    }
    
    // =====================================================
    // 🔥 핵심 메서드: 통합 정리 API
    // =====================================================
    
    /**
     * ✨ 선택 관련 모든 것 정리
     * - Selection2DManager: 선택 배열 초기화
     * - HandleManager: Transform 핸들 제거
     * - SelectionRenderer: 하이라이트/Transformer 제거
     * - FenceSelection: 범위 선택 사각형 제거
     */
    clearSelection() {
        console.log('[EditorStateManager] clearSelection() 호출');
        
        // 1. HandleManager 먼저! (시각적 핸들 제거) - 가장 중요!
        if (this._managers.handle) {
            try {
                this._managers.handle.detach?.();
                this._managers.handle.clear?.();
            } catch (e) {
                console.warn('[EditorStateManager] HandleManager clear 실패:', e);
            }
        }
        
        // 2. SelectionRenderer (하이라이트 제거)
        if (this._managers.renderer) {
            try {
                // 선택된 객체들의 하이라이트 먼저 제거
                const selectedObjects = this._managers.selection?.getSelectedObjects?.() || [];
                if (selectedObjects.length > 0) {
                    this._managers.renderer.removeAllHighlights?.(selectedObjects);
                }
                this._managers.renderer.destroyTransformer?.();
                this._managers.renderer.hideCoordinates?.();
            } catch (e) {
                console.warn('[EditorStateManager] SelectionRenderer clear 실패:', e);
            }
        }
        
        // 3. Selection2DManager (상태 초기화)
        if (this._managers.selection) {
            try {
                this._managers.selection.deselectAll?.(false);  // 이벤트 발행 안함
            } catch (e) {
                console.warn('[EditorStateManager] Selection2DManager clear 실패:', e);
            }
        }
        
        // 4. FenceSelection (범위 선택 박스)
        if (this._managers.fence) {
            try {
                this._managers.fence.clear?.();
            } catch (e) {
                console.warn('[EditorStateManager] FenceSelection clear 실패:', e);
            }
        }
        
        // 5. Editor의 내부 배열 정리 (폴백)
        if (this.editor) {
            if (this.editor._selectedObjectsProxy) {
                this.editor._selectedObjectsProxy = [];
            }
            
            // Transformer 직접 참조 정리
            if (this.editor.transformer) {
                try {
                    this.editor.transformer.destroy();
                    this.editor.transformer = null;
                } catch (e) {}
            }
        }
        
        // 6. UI Layer 갱신
        this._refreshUILayer();
        
        console.log('[EditorStateManager] ✅ Selection 정리 완료');
    }
    
    /**
     * ✨ 가이드라인 관련 모든 것 정리
     * - SmartGuideManager: 정렬 가이드라인 제거
     * - SnapManager: Snap 상태 초기화
     * - AlignmentGuide: 미리보기 제거
     */
    clearGuides() {
        console.log('[EditorStateManager] clearGuides() 호출');
        
        // 1. SmartGuideManager
        if (this._managers.smartGuide) {
            try {
                this._managers.smartGuide.clearGuides?.();
                this._managers.smartGuide.clearReferenceObjects?.();
            } catch (e) {
                console.warn('[EditorStateManager] SmartGuideManager clear 실패:', e);
            }
        }
        
        // 2. SnapManager (가이드라인만 제거, Snap 기능은 유지)
        if (this._managers.snap) {
            try {
                this._managers.snap.clearGuides?.();
            } catch (e) {
                console.warn('[EditorStateManager] SnapManager clearGuides 실패:', e);
            }
        }
        
        // 3. AlignmentGuide
        if (this._managers.alignment) {
            try {
                this._managers.alignment.clearPreview?.();
                this._managers.alignment.clear?.();
            } catch (e) {
                console.warn('[EditorStateManager] AlignmentGuide clear 실패:', e);
            }
        }
        
        // 4. UI Layer 갱신
        this._refreshUILayer();
        
        console.log('[EditorStateManager] ✅ Guides 정리 완료');
    }
    
    /**
     * ✨ UI 요소 정리
     * - 툴팁, 라벨, 임시 도형 등
     */
    clearUI() {
        console.log('[EditorStateManager] clearUI() 호출');
        
        // 1. 좌표 라벨
        if (this._managers.renderer) {
            try {
                this._managers.renderer.hideCoordinates?.();
            } catch (e) {}
        }
        
        // 2. FenceSelection
        if (this._managers.fence) {
            try {
                this._managers.fence.clear?.();
            } catch (e) {}
        }
        
        // 3. UI Layer의 임시 요소들 제거
        if (this.editor?.layers?.ui) {
            try {
                const tempElements = this.editor.layers.ui.find('.smart-guide-line, .distance-label, .fence-rect, .alignment-preview');
                tempElements.forEach(el => el.destroy());
            } catch (e) {}
        }
        
        // 4. UI Layer 갱신
        this._refreshUILayer();
        
        console.log('[EditorStateManager] ✅ UI 정리 완료');
    }
    
    /**
     * ✨ 모든 것 정리 (Selection + Guides + UI)
     */
    clearAll() {
        console.log('[EditorStateManager] clearAll() 호출');
        
        this.clearSelection();
        this.clearGuides();
        this.clearUI();
        
        console.log('[EditorStateManager] ✅ All 정리 완료');
    }
    
    /**
     * ✨ 에디터 전체 리셋 (히스토리 포함)
     */
    reset() {
        console.log('[EditorStateManager] reset() 호출');
        
        // 1. 모든 것 정리
        this.clearAll();
        
        // 2. 각 Manager의 destroy/clear
        Object.values(this._managers).forEach(manager => {
            if (manager && typeof manager.clear === 'function') {
                try {
                    manager.clear();
                } catch (e) {}
            }
        });
        
        // 3. CommandManager 히스토리 클리어 (있다면)
        if (this.editor?.commandManager) {
            try {
                this.editor.commandManager.clear?.();
            } catch (e) {}
        }
        
        console.log('[EditorStateManager] ✅ Reset 완료');
    }
    
    // =====================================================
    // 특수 상황 처리 (편의 메서드)
    // =====================================================
    
    /**
     * Undo/Redo 후 정리
     * (기존 cleanupAfterUndoRedo 대체)
     */
    cleanupAfterHistoryChange() {
        console.log('[EditorStateManager] cleanupAfterHistoryChange() 호출');
        this.clearSelection();
        this.editor?.stage?.batchDraw();
    }
    
    /**
     * 도구 전환 시 정리
     */
    cleanupOnToolChange() {
        console.log('[EditorStateManager] cleanupOnToolChange() 호출');
        this.clearGuides();
        this.clearUI();
    }
    
    /**
     * 삭제 작업 전 정리 (핸들만)
     */
    prepareForDelete() {
        console.log('[EditorStateManager] prepareForDelete() 호출');
        
        if (this._managers.handle) {
            try {
                this._managers.handle.detach?.();
            } catch (e) {}
        }
        
        if (this._managers.renderer) {
            try {
                this._managers.renderer.destroyTransformer?.();
            } catch (e) {}
        }
    }
    
    /**
     * 삭제 작업 후 정리
     */
    cleanupAfterDelete() {
        console.log('[EditorStateManager] cleanupAfterDelete() 호출');
        this.clearSelection();
    }
    
    // =====================================================
    // 헬퍼 메서드
    // =====================================================
    
    /**
     * UI Layer 갱신
     * @private
     */
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
    
    /**
     * Manager 가져오기
     * @param {string} name - Manager 이름
     * @returns {Object|null}
     */
    getManager(name) {
        return this._managers[name] || null;
    }
    
    /**
     * 초기화 여부 확인
     * @returns {boolean}
     */
    isInitialized() {
        return this._initialized;
    }
    
    /**
     * 현재 상태 디버그 출력
     */
    debugState() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[EditorStateManager] Debug State');
        console.log('  ├─ Initialized:', this._initialized);
        console.log('  ├─ Editor:', this.editor ? '✅' : '❌');
        console.log('  └─ Managers:');
        Object.entries(this._managers).forEach(([name, manager]) => {
            console.log(`      ├─ ${name}: ${manager ? '✅' : '❌'}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    /**
     * 파괴
     */
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

console.log('✅ EditorStateManager.js 로드 완료 v1.0.0');