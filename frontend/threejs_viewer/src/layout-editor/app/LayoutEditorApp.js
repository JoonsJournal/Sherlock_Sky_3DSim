/**
 * LayoutEditorApp.js
 * ==================
 * Phase 5.3: Bootstrap 분리 완료 - 최소 래퍼
 * 
 * ✅ Bootstrap 모듈 활용:
 *   - initLayoutServices.js (서비스 초기화)
 *   - initLayoutUI.js (UI 초기화)
 *   - setupLayoutEvents.js (이벤트 설정)
 *   - bootstrap/index.js (통합)
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/app/LayoutEditorApp.js
 */

class LayoutEditorApp {
    constructor(options = {}) {
        console.log('🚀 LayoutEditorApp 초기화 (Phase 5.3 - Bootstrap)');
        
        // Bootstrap 사용 가능 여부 확인
        if (typeof initLayoutEditor !== 'undefined') {
            // Bootstrap 모듈 사용
            this._initWithBootstrap(options);
        } else {
            // 폴백: 직접 초기화
            console.warn('⚠️ Bootstrap 미로드 - 직접 초기화');
            this._initDirect(options);
        }
    }
    
    /**
     * Bootstrap 모듈을 사용한 초기화
     */
    _initWithBootstrap(options) {
        const result = initLayoutEditor({
            containerId: options.containerId || 'canvas-container',
            onToolChanged: options.onToolChanged,
            onSave: options.onSave,
            onExportPNG: options.onExportPNG,
            onLoadSample: options.onLoadSample,
            handlers: options.handlers
        });
        
        // 결과 저장
        this.services = result.services;
        this.ui = result.ui;
        this.state = result.state;
        this._cleanup = result.cleanup;
        
        // 편의 참조
        this.canvas = result.services.canvas;
        this.commandManager = result.services.commandManager;
        
        console.log('✅ LayoutEditorApp 초기화 완료 (Bootstrap)');
    }
    
    /**
     * 직접 초기화 (Bootstrap 없을 때 폴백)
     */
    _initDirect(options) {
        // State
        this.state = window.layoutEditorState || this._createFallbackState();
        
        // Canvas
        if (typeof Canvas2DEditor === 'undefined') {
            throw new Error('Canvas2DEditor가 로드되지 않았습니다.');
        }
        
        const size = this._calculateCanvasSize();
        this.canvas = new Canvas2DEditor(options.containerId || 'canvas-container', {
            width: size.width,
            height: size.height,
            showGrid: true,
            snapToGrid: true,
            gridSize: 10
        });
        
        // CommandManager
        if (typeof CommandManager !== 'undefined') {
            this.commandManager = new CommandManager({ maxHistory: 50 });
            this.canvas.commandManager = this.commandManager;
        }
        
        // 서비스 저장
        this.services = { canvas: this.canvas, commandManager: this.commandManager };
        this.ui = { showToast: this._showToast.bind(this) };
        
        // 로딩 완료
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'none';
        
        this._showToast('Layout Editor 준비 완료!', 'success');
        console.log('✅ LayoutEditorApp 초기화 완료 (Direct)');
    }
    
    /**
     * Canvas 크기 계산
     */
    _calculateCanvasSize() {
        const dims = window.LayoutEditorConfig?.getLayoutDimensions?.() || {
            TOOLBAR_WIDTH: 60,
            TOOLBAR_EXPANDED_WIDTH: 270,
            PROPERTY_PANEL_WIDTH: 260,
            HEADER_HEIGHT: 48,
            STATUS_HEIGHT: 30
        };
        
        const toolbarWidth = this.state?.componentSubmenuVisible 
            ? dims.TOOLBAR_EXPANDED_WIDTH 
            : dims.TOOLBAR_WIDTH;
            
        return {
            width: window.innerWidth - toolbarWidth - dims.PROPERTY_PANEL_WIDTH,
            height: window.innerHeight - dims.HEADER_HEIGHT - dims.STATUS_HEIGHT
        };
    }
    
    /**
     * Fallback State 생성
     */
    _createFallbackState() {
        return {
            componentSubmenuVisible: false,
            alignPopupVisible: false,
            shortcutsHelpVisible: false,
            currentTool: 'select',
            on: () => {},
            emit: () => {}
        };
    }
    
    /**
     * Toast 표시 (폴백)
     */
    _showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    // =====================================================
    // 공개 API
    // =====================================================
    
    /**
     * Undo
     */
    undo() {
        if (this.commandManager?.undo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.ui?.uiService?.updateStatus();
        }
    }
    
    /**
     * Redo
     */
    redo() {
        if (this.commandManager?.redo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.ui?.uiService?.updateStatus();
        }
    }
    
    /**
     * 전체 선택
     */
    selectAll() {
        const allShapes = [];
        ['room', 'equipment'].forEach(layerName => {
            const layer = this.canvas.layers[layerName];
            if (layer) {
                layer.find('Group').forEach(group => {
                    if (group.name()?.includes('component') || group.getAttr('componentType')) {
                        allShapes.push(group);
                    }
                });
            }
        });
        if (allShapes.length > 0) {
            this.canvas.selectObjects(allShapes);
            (this.ui?.showToast || this._showToast)(`${allShapes.length}개 선택됨`, 'success');
        }
    }
    
    /**
     * 선택 해제
     */
    deselectAll() {
        this.canvas.deselectAll?.();
        this.canvas.selectedObjects = [];
        this.canvas.transformer?.nodes([]);
        this.canvas.stage.batchDraw();
    }
    
    /**
     * 레이아웃 저장
     */
    saveLayout() {
        const layout = this.canvas.getCurrentLayout();
        const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `layout_${Date.now()}.json`;
        link.click();
        (this.ui?.showToast || this._showToast)('저장 완료!', 'success');
    }
    
    /**
     * PNG 내보내기
     */
    exportPNG() {
        try {
            const dataURL = this.canvas.stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `layout_${Date.now()}.png`;
            link.click();
            (this.ui?.showToast || this._showToast)('🖼️ PNG 저장 완료!', 'success');
        } catch (error) {
            console.error('[Export PNG Error]', error);
            (this.ui?.showToast || this._showToast)('PNG 저장 실패: ' + error.message, 'error');
        }
    }
    
    /**
     * 샘플 레이아웃 로드
     */
    loadSampleLayout() {
        this.canvas.loadLayout({
            room: { width: 30, height: 20, walls: [], offices: [] },
            equipment: [
                { id: 'eq_1', x: 2, y: 5, width: 2, depth: 1.5, name: 'Equipment 1', rotation: 0 },
                { id: 'eq_2', x: 5, y: 5, width: 2, depth: 1.5, name: 'Equipment 2', rotation: 0 },
                { id: 'eq_3', x: 8, y: 5, width: 2, depth: 1.5, name: 'Equipment 3', rotation: 0 }
            ]
        });
        this.services?.toolService?.getTool('selection')?.attachEventListeners?.();
        this.ui?.uiService?.updateStatus();
        (this.ui?.showToast || this._showToast)('샘플 로드 완료!', 'success');
    }
    
    /**
     * 정리
     */
    destroy() {
        if (this._cleanup) {
            this._cleanup();
        } else {
            this.canvas?.stage?.destroy();
        }
        console.log('🧹 LayoutEditorApp 정리 완료');
    }
    
    // =====================================================
    // Getters
    // =====================================================
    
    getCanvas() { return this.canvas; }
    getState() { return this.state; }
    getServices() { return this.services; }
    getCommandManager() { return this.commandManager; }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.LayoutEditorApp = LayoutEditorApp;
}

console.log('✅ LayoutEditorApp.js 로드 완료 (Phase 5.3 - Bootstrap)');