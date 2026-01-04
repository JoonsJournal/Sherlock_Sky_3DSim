/**
 * LayoutEditorApp.js
 * ==================
 * Phase 5.3: Bootstrap 분리 완료 - 최소 래퍼
 * Phase 5.2: AutoSaveManager 연동 추가
 * 
 * ✅ 리팩토링: 중복 코드 제거, 기존 모듈 재사용
 *   - handlers: bootstrap의 createDefaultHandlers() 활용
 *   - Toast: UIService.showToast() 활용
 *   - Dialog: AutoSaveRecoveryDialog 컴포넌트 활용
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/app/LayoutEditorApp.js
 */

class LayoutEditorApp {
    constructor(options = {}) {
        console.log('🚀 LayoutEditorApp 초기화 (Phase 5.3 - Bootstrap + AutoSave)');
        
        // 기본 siteId 설정
        this.siteId = options.siteId || 'default_site';
        
        // 참조 변수
        this.autoSaveManager = null;
        this.handlers = null;  // handlers 참조 저장
        
        // Bootstrap 사용 가능 여부 확인
        if (typeof initLayoutEditor !== 'undefined') {
            this._initWithBootstrap(options);
        } else {
            console.warn('⚠️ Bootstrap 미로드 - 직접 초기화');
            this._initDirect(options);
        }
        
        // AutoSave 초기화 (공통)
        this._initAutoSave(options);
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
        
        // handlers 생성 및 저장 (Bootstrap의 createDefaultHandlers 활용)
        if (typeof window.LayoutEditorBootstrap?.createDefaultHandlers === 'function') {
            this.handlers = window.LayoutEditorBootstrap.createDefaultHandlers(
                this.services, 
                this.ui, 
                options
            );
        }
        
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
        this.ui = { 
            showToast: this._fallbackToast.bind(this),
            uiService: { showToast: this._fallbackToast.bind(this), updateStatus: () => {} }
        };
        
        // 로딩 완료
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'none';
        
        this._showToast('Layout Editor 준비 완료!', 'success');
        console.log('✅ LayoutEditorApp 초기화 완료 (Direct)');
    }
    
    /**
     * AutoSaveManager 초기화
     * @private
     */
    _initAutoSave(options) {
        if (typeof AutoSaveManager === 'undefined') {
            console.warn('⚠️ AutoSaveManager가 로드되지 않았습니다. 자동 저장 비활성화.');
            return;
        }
        
        this.autoSaveManager = new AutoSaveManager({
            commandManager: this.commandManager,
            intervalMs: options.autoSaveIntervalMs || 300000,
            changeThreshold: options.autoSaveChangeThreshold || 20,
            
            getLayoutData: () => {
                if (this.canvas && typeof this.canvas.exportLayoutData === 'function') {
                    return this.canvas.exportLayoutData();
                }           
                return null;
            },
            
            onAutoSave: (data) => {
                this._showToast('💾 자동 저장됨', 'success');
                console.log('[AutoSave] 저장 완료:', data._autoSave);
            }
        });
        
        // 복구 데이터 확인
        this._checkAutoSaveRecovery();
        
        // AutoSave 시작
        this.autoSaveManager.start(this.siteId);
        
        console.log('✅ AutoSaveManager 초기화 완료 - siteId:', this.siteId);
    }
    
    /**
     * 복구 데이터 확인 및 Dialog 표시
     * @private
     */
    _checkAutoSaveRecovery() {
        if (!this.autoSaveManager) return;
        
        const recoveryData = this.autoSaveManager.checkForRecovery(this.siteId);
        
        if (recoveryData) {
            const autoSaveMeta = recoveryData._autoSave;
            const timestamp = new Date(autoSaveMeta.timestamp);
            
            // AutoSaveRecoveryDialog 사용
            if (typeof AutoSaveRecoveryDialog !== 'undefined') {
                AutoSaveRecoveryDialog.show({
                    timestamp: timestamp.toLocaleString(),
                    timeAgo: this._getTimeAgo(timestamp),
                    changeCount: autoSaveMeta.changeCount,
                    onRecover: () => this._recoverLayout(recoveryData),
                    onDiscard: () => {
                        this.autoSaveManager.clearAutoSave(this.siteId);
                        this._showToast('자동 저장 데이터 삭제됨', 'info');
                    }
                });
            } else {
                // 폴백: confirm 사용
                const confirmed = confirm(
                    `저장되지 않은 작업이 있습니다.\n` +
                    `저장 시간: ${timestamp.toLocaleString()}\n` +
                    `변경 횟수: ${autoSaveMeta.changeCount}회\n\n` +
                    `복구하시겠습니까?`
                );
                
                if (confirmed) {
                    this._recoverLayout(recoveryData);
                } else {
                    this.autoSaveManager.clearAutoSave(this.siteId);
                }
            }
        }
    }
    
    /**
     * 레이아웃 복구 실행
     * @private
     */
    _recoverLayout(recoveryData) {
        try {
            const layoutData = { ...recoveryData };
            delete layoutData._autoSave;
            
            if (this.canvas && typeof this.canvas.loadLayout === 'function') {
                this.canvas.loadLayout(layoutData);
                
                this.services?.toolService?.getTool('selection')?.attachEventListeners?.();
                this.ui?.uiService?.updateStatus?.();
                
                this._showToast('✅ 레이아웃 복구 완료!', 'success');
                console.log('[AutoSave] 레이아웃 복구 완료');
            }
            
            this.autoSaveManager.clearAutoSave(this.siteId);
            
        } catch (error) {
            console.error('[AutoSave] 복구 실패:', error);
            this._showToast('❌ 복구 실패: ' + error.message, 'error');
        }
    }
    
    // =====================================================
    // 유틸리티 (최소화)
    // =====================================================
    
    /**
     * Toast 표시 (UIService 활용)
     * @private
     */
    _showToast(message, type = 'info') {
        // UIService의 showToast 우선 사용
        if (this.ui?.showToast) {
            this.ui.showToast(message, type);
        } else if (this.ui?.uiService?.showToast) {
            this.ui.uiService.showToast(message, type);
        } else {
            this._fallbackToast(message, type);
        }
    }
    
    /**
     * 폴백 Toast (UIService 없을 때)
     * @private
     */
    _fallbackToast(message, type = 'info') {
        const colors = { success: '#4CAF50', error: '#f44336', warning: '#ff9800', info: '#2196F3' };
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 12px 24px;
            border-radius: 4px; color: white; font-size: 14px; z-index: 10001;
            background: ${colors[type] || colors.info}; animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    /**
     * 시간 경과 문자열 생성
     * @private
     */
    _getTimeAgo(date) {
        const diffMs = Date.now() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        return `${Math.floor(diffHours / 24)}일 전`;
    }
    
    /**
     * Canvas 크기 계산 (폴백용)
     * @private
     */
    _calculateCanvasSize() {
        // Bootstrap 함수 사용 시도
        if (typeof window.calculateCanvasSize === 'function') {
            return window.calculateCanvasSize(this.state);
        }
        
        const dims = window.LayoutEditorConfig?.getLayoutDimensions?.() || {
            TOOLBAR_WIDTH: 60, TOOLBAR_EXPANDED_WIDTH: 270,
            PROPERTY_PANEL_WIDTH: 260, HEADER_HEIGHT: 48, STATUS_HEIGHT: 30
        };
        
        const toolbarWidth = this.state?.componentSubmenuVisible 
            ? dims.TOOLBAR_EXPANDED_WIDTH : dims.TOOLBAR_WIDTH;
            
        return {
            width: window.innerWidth - toolbarWidth - dims.PROPERTY_PANEL_WIDTH,
            height: window.innerHeight - dims.HEADER_HEIGHT - dims.STATUS_HEIGHT
        };
    }
    
    /**
     * Fallback State 생성 (폴백용)
     * @private
     */
    _createFallbackState() {
        // Bootstrap 함수 사용 시도
        if (typeof window.LayoutEditorBootstrap?.createFallbackState === 'function') {
            return window.LayoutEditorBootstrap.createFallbackState();
        }
        
        return {
            componentSubmenuVisible: false, alignPopupVisible: false,
            shortcutsHelpVisible: false, currentTool: 'select',
            on: () => {}, emit: () => {}
        };
    }
    
    // =====================================================
    // 공개 API - handlers 위임
    // =====================================================
    
    /**
     * Site ID 변경
     */
    setSiteId(siteId) {
        this.siteId = siteId;
        if (this.autoSaveManager) {
            this.autoSaveManager.stop();
            this.autoSaveManager.start(siteId);
        }
        console.log('[LayoutEditorApp] siteId 변경:', siteId);
    }
    
    /**
     * 수동 자동 저장 트리거
     */
    triggerAutoSave() {
        return this.autoSaveManager?.save() || false;
    }
    
    /**
     * AutoSave 상태 조회
     */
    getAutoSaveStatus() {
        return this.autoSaveManager?.getStatus() || null;
    }
    
    /**
     * Undo - handlers 활용
     */
    undo() {
        if (this.handlers?.undo) {
            this.handlers.undo();
        } else if (this.commandManager?.undo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.ui?.uiService?.updateStatus?.();
        }
    }
    
    /**
     * Redo - handlers 활용
     */
    redo() {
        if (this.handlers?.redo) {
            this.handlers.redo();
        } else if (this.commandManager?.redo()) {
            this.canvas.transformer?.forceUpdate();
            this.canvas.stage.batchDraw();
            this.ui?.uiService?.updateStatus?.();
        }
    }
    
    /**
     * 전체 선택 - handlers 활용
     */
    selectAll() {
        if (this.handlers?.selectAll) {
            this.handlers.selectAll();
        }
    }
    
    /**
     * 선택 해제 - handlers 활용
     */
    deselectAll() {
        if (this.handlers?.deselectAll) {
            this.handlers.deselectAll();
        }
    }
    
    /**
     * 레이아웃 저장 - handlers 활용 + AutoSave 정리
     */
    saveLayout() {
        if (this.handlers?.save) {
            this.handlers.save();
        }
        
        // 저장 성공 시 AutoSave 데이터 삭제
        if (this.autoSaveManager) {
            this.autoSaveManager.clearAutoSave(this.siteId);
        }
    }
    
    /**
     * PNG 내보내기 - handlers 활용
     */
    exportPNG() {
        if (this.handlers?.exportPNG) {
            this.handlers.exportPNG();
        }
    }
    
    /**
     * 샘플 레이아웃 로드 - handlers 활용
     */
    loadSampleLayout() {
        if (this.handlers?.loadSampleLayout) {
            this.handlers.loadSampleLayout();
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        if (this.autoSaveManager) {
            this.autoSaveManager.dispose();
            this.autoSaveManager = null;
        }
        
        if (this._cleanup) {
            this._cleanup();
        } else {
            this.canvas?.stage?.destroy();
        }
        
        this.handlers = null;
        console.log('🧹 LayoutEditorApp 정리 완료');
    }
    
    // =====================================================
    // Getters
    // =====================================================
    
    getCanvas() { return this.canvas; }
    getState() { return this.state; }
    getServices() { return this.services; }
    getCommandManager() { return this.commandManager; }
    getAutoSaveManager() { return this.autoSaveManager; }
    getHandlers() { return this.handlers; }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.LayoutEditorApp = LayoutEditorApp;
}

console.log('✅ LayoutEditorApp.js 로드 완료 (Phase 5.3 - Bootstrap + AutoSave)');