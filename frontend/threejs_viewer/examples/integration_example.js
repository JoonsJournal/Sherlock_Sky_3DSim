/**
 * integration_example.js
 * 
 * LayoutEditorState를 실제 SHERLOCK_SKY_3DSIM 프로젝트에 통합하는 예제
 * 
 * 이 파일은 다음 컴포넌트들과의 통합을 보여줍니다:
 * - LayoutEditorMain
 * - Canvas2DEditor
 * - LayoutFileManager
 * - UI Components
 */

import layoutEditorState from './stores/LayoutEditorState.js';
import LayoutFileManager from './services/LayoutFileManager.js';

// ============================================================================
// 1. LayoutEditorMain 통합
// ============================================================================

class LayoutEditorMain {
    constructor() {
        this.canvas2DEditor = null;
        this.autoSaveManager = null;
        this.subscriptions = [];

        this.init();
    }

    init() {
        console.log('[LayoutEditorMain] Initializing...');

        // 상태 리스너 설정
        this.setupStateListeners();

        // UI 이벤트 바인딩
        this.setupUIEvents();

        // Auto-Save 매니저 초기화
        this.autoSaveManager = new AutoSaveManager();

        console.log('[LayoutEditorMain] Initialized successfully');
    }

    /**
     * 상태 변경 리스너 설정
     */
    setupStateListeners() {
        // 모드 변경 감시
        this.subscriptions.push(
            layoutEditorState.subscribe('mode', (mode) => {
                this.handleModeChange(mode);
            })
        );

        // Dirty 상태 감시
        this.subscriptions.push(
            layoutEditorState.subscribe('isDirty', (isDirty) => {
                this.handleDirtyChange(isDirty);
            })
        );

        // Layout 변경 감시
        this.subscriptions.push(
            layoutEditorState.subscribe('currentLayout', (layout) => {
                this.handleLayoutChange(layout);
            })
        );

        // 전역 변경 로깅
        this.subscriptions.push(
            layoutEditorState.subscribeGlobal((property, newValue, oldValue) => {
                this.logStateChange(property, newValue, oldValue);
            })
        );
    }

    /**
     * UI 이벤트 설정
     */
    setupUIEvents() {
        // Site 선택 Dropdown
        document.getElementById('siteSelector')?.addEventListener('change', (e) => {
            this.onSiteSelected(e.target.value);
        });

        // Save 버튼
        document.getElementById('saveButton')?.addEventListener('click', () => {
            this.saveLayout();
        });

        // Mode 전환 버튼
        document.getElementById('editorModeBtn')?.addEventListener('click', () => {
            const siteId = layoutEditorState.state.currentSiteId;
            const layout = layoutEditorState.state.currentLayout;
            if (siteId && layout) {
                layoutEditorState.enterEditorMode(siteId, layout);
            }
        });

        document.getElementById('viewerModeBtn')?.addEventListener('click', () => {
            const siteId = layoutEditorState.state.currentSiteId;
            const layout = layoutEditorState.state.currentLayout;
            if (siteId && layout) {
                layoutEditorState.enterViewerMode(siteId, layout);
            }
        });

        // 키보드 단축키
        this.setupKeyboardShortcuts();
    }

    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S: 저장
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveLayout();
            }

            // Ctrl+Z: Undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.performUndo();
            }

            // Ctrl+Shift+Z 또는 Ctrl+Y: Redo
            if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
                e.preventDefault();
                this.performRedo();
            }

            // Escape: 선택 해제
            if (e.key === 'Escape') {
                layoutEditorState.clearSelection();
            }
        });
    }

    /**
     * Site 선택 시 처리
     */
    async onSiteSelected(siteId) {
        console.log(`[LayoutEditorMain] Site selected: ${siteId}`);

        // 저장되지 않은 변경사항 확인
        if (layoutEditorState.state.isDirty) {
            const confirm = await this.showConfirmDialog(
                '저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?'
            );
            if (!confirm) return;
        }

        // Layout 파일 존재 여부 확인
        const exists = await LayoutFileManager.checkLayout(siteId);

        if (exists) {
            // 기존 Layout 로드
            await this.loadExistingLayout(siteId);
        } else {
            // 새 Layout 생성
            await this.createNewLayout(siteId);
        }
    }

    /**
     * 기존 Layout 로드
     */
    async loadExistingLayout(siteId) {
        try {
            console.log(`[LayoutEditorMain] Loading layout for ${siteId}...`);

            const layout = await LayoutFileManager.loadLayout(siteId);

            if (layout) {
                // Viewer 모드로 전환
                layoutEditorState.enterViewerMode(siteId, layout);

                // 3D Viewer 렌더링
                this.render3DLayout(layout);

                this.showNotification('Layout이 로드되었습니다.', 'success');
            } else {
                throw new Error('Layout 파일을 읽을 수 없습니다.');
            }
        } catch (error) {
            console.error('[LayoutEditorMain] Load error:', error);
            
            // 복구 옵션 제공
            const recover = await this.showRecoveryDialog();
            if (recover === 'new') {
                await this.createNewLayout(siteId);
            }
        }
    }

    /**
     * 새 Layout 생성
     */
    async createNewLayout(siteId) {
        try {
            console.log(`[LayoutEditorMain] Creating new layout for ${siteId}...`);

            // Template 선택 UI 표시
            const templateName = await this.showTemplateSelectionDialog();

            if (!templateName) return;

            // Template 로드
            const template = await LayoutFileManager.loadTemplate(templateName);

            // Site ID 교체
            template.site_id = siteId;
            template.created_at = new Date().toISOString();

            // Editor 모드로 전환
            layoutEditorState.enterEditorMode(siteId, template);

            // 2D Editor 초기화
            if (!this.canvas2DEditor) {
                this.canvas2DEditor = new Canvas2DEditor('canvas2d-container');
            }

            // Template 로드
            this.canvas2DEditor.loadLayout(template);

            this.showNotification('새 Layout이 생성되었습니다.', 'success');
        } catch (error) {
            console.error('[LayoutEditorMain] Create error:', error);
            this.showNotification('Layout 생성에 실패했습니다.', 'error');
        }
    }

    /**
     * Layout 저장
     */
    async saveLayout() {
        try {
            const siteId = layoutEditorState.state.currentSiteId;
            const layout = layoutEditorState.state.currentLayout;

            if (!siteId || !layout) {
                throw new Error('저장할 Layout이 없습니다.');
            }

            console.log(`[LayoutEditorMain] Saving layout for ${siteId}...`);

            // 저장 전 검증
            const isValid = await this.validateLayout(layout);
            if (!isValid) {
                throw new Error('Layout 검증에 실패했습니다.');
            }

            // 파일 저장
            await LayoutFileManager.saveLayout(siteId, layout);

            // 저장 완료 표시
            layoutEditorState.markAsSaved();

            this.showNotification('Layout이 저장되었습니다.', 'success');
        } catch (error) {
            console.error('[LayoutEditorMain] Save error:', error);
            this.showNotification('저장에 실패했습니다: ' + error.message, 'error');
        }
    }

    /**
     * Undo 실행
     */
    performUndo() {
        const snapshot = layoutEditorState.undo();

        if (snapshot) {
            console.log('[LayoutEditorMain] Undo performed');
            
            // Canvas에 적용
            if (this.canvas2DEditor) {
                this.canvas2DEditor.applySnapshot(snapshot);
            }

            this.showNotification('되돌렸습니다.', 'info');
        } else {
            this.showNotification('되돌릴 내용이 없습니다.', 'warning');
        }
    }

    /**
     * Redo 실행
     */
    performRedo() {
        const snapshot = layoutEditorState.redo();

        if (snapshot) {
            console.log('[LayoutEditorMain] Redo performed');
            
            // Canvas에 적용
            if (this.canvas2DEditor) {
                this.canvas2DEditor.applySnapshot(snapshot);
            }

            this.showNotification('다시 실행했습니다.', 'info');
        } else {
            this.showNotification('다시 실행할 내용이 없습니다.', 'warning');
        }
    }

    /**
     * 모드 변경 핸들러
     */
    handleModeChange(mode) {
        console.log(`[LayoutEditorMain] Mode changed to: ${mode}`);

        if (mode === 'editor') {
            // Editor UI 표시
            this.showEditorUI();
        } else {
            // Viewer UI 표시
            this.showViewerUI();
        }
    }

    /**
     * Dirty 상태 변경 핸들러
     */
    handleDirtyChange(isDirty) {
        console.log(`[LayoutEditorMain] Dirty state: ${isDirty}`);

        const saveBtn = document.getElementById('saveButton');
        if (saveBtn) {
            saveBtn.disabled = !isDirty;
            saveBtn.textContent = isDirty ? '저장*' : '저장됨';
            saveBtn.className = isDirty ? 'btn-warning' : 'btn-success';
        }

        // 페이지 나가기 전 경고
        window.onbeforeunload = isDirty ? (e) => {
            e.preventDefault();
            return '저장하지 않은 변경사항이 있습니다.';
        } : null;
    }

    /**
     * Layout 변경 핸들러
     */
    handleLayoutChange(layout) {
        console.log('[LayoutEditorMain] Layout changed');

        // 필요한 경우 UI 업데이트
    }

    /**
     * 상태 변경 로깅
     */
    logStateChange(property, newValue, oldValue) {
        console.log(`[State] ${property}:`, {
            old: oldValue,
            new: newValue
        });
    }

    /**
     * Editor UI 표시
     */
    showEditorUI() {
        document.getElementById('editor-container')?.classList.remove('hidden');
        document.getElementById('viewer-container')?.classList.add('hidden');
        document.getElementById('toolbar')?.classList.remove('hidden');
        document.getElementById('property-panel')?.classList.remove('hidden');
    }

    /**
     * Viewer UI 표시
     */
    showViewerUI() {
        document.getElementById('editor-container')?.classList.add('hidden');
        document.getElementById('viewer-container')?.classList.remove('hidden');
        document.getElementById('toolbar')?.classList.add('hidden');
        document.getElementById('property-panel')?.classList.add('hidden');
    }

    /**
     * 3D Layout 렌더링
     */
    render3DLayout(layout) {
        // Three.js SceneManager 연동
        // window.sceneManager?.loadLayout(layout);
        console.log('[LayoutEditorMain] Rendering 3D layout...');
    }

    /**
     * Layout 검증
     */
    async validateLayout(layout) {
        // ValidationService 연동
        // return await ValidationService.validate(layout);
        return true;
    }

    /**
     * Template 선택 Dialog
     */
    async showTemplateSelectionDialog() {
        // 실제로는 Modal UI 사용
        const templates = ['standard_26x6', 'compact_13x4', 'default_template'];
        return prompt(`Template 선택:\n${templates.join('\n')}`, templates[0]);
    }

    /**
     * 확인 Dialog
     */
    async showConfirmDialog(message) {
        return confirm(message);
    }

    /**
     * 복구 Dialog
     */
    async showRecoveryDialog() {
        const choice = confirm('Layout 파일이 손상되었습니다.\n새로 생성하시겠습니까? (취소 = 백업 복구)');
        return choice ? 'new' : 'backup';
    }

    /**
     * 알림 표시
     */
    showNotification(message, type = 'info') {
        console.log(`[Notification ${type}] ${message}`);
        // 실제로는 Toast UI 사용
        // Toast.show(message, type);
    }

    /**
     * 정리 (컴포넌트 언마운트 시)
     */
    cleanup() {
        // 모든 구독 해제
        this.subscriptions.forEach(unsub => unsub());
        this.subscriptions = [];

        // Auto-Save 매니저 정리
        this.autoSaveManager?.cleanup();

        console.log('[LayoutEditorMain] Cleaned up');
    }
}


// ============================================================================
// 2. Canvas2DEditor 통합
// ============================================================================

class Canvas2DEditor {
    constructor(containerId) {
        this.stage = new Konva.Stage({
            container: containerId,
            width: 1200,
            height: 800
        });

        this.subscriptions = [];
        this.snapEnabled = layoutEditorState.state.snapToGrid;

        this.setupLayers();
        this.setupStateListeners();
        this.setupEventHandlers();
    }

    setupLayers() {
        this.backgroundLayer = new Konva.Layer();
        this.roomLayer = new Konva.Layer();
        this.equipmentLayer = new Konva.Layer();
        this.uiLayer = new Konva.Layer();

        this.stage.add(this.backgroundLayer);
        this.stage.add(this.roomLayer);
        this.stage.add(this.equipmentLayer);
        this.stage.add(this.uiLayer);

        // 그리드 그리기
        this.drawGrid();
    }

    setupStateListeners() {
        // 그리드 표시 토글
        this.subscriptions.push(
            layoutEditorState.subscribe('showGrid', (show) => {
                this.backgroundLayer.visible(show);
                this.stage.batchDraw();
            })
        );

        // Snap to Grid 토글
        this.subscriptions.push(
            layoutEditorState.subscribe('snapToGrid', (enabled) => {
                this.snapEnabled = enabled;
                console.log(`[Canvas2DEditor] Snap to Grid: ${enabled}`);
            })
        );

        // 그리드 크기 변경
        this.subscriptions.push(
            layoutEditorState.subscribe('gridSize', (size) => {
                this.drawGrid(size);
            })
        );

        // 선택 객체 변경
        this.subscriptions.push(
            layoutEditorState.subscribe('selectedObjects', (selected) => {
                this.updateTransformers(selected);
            })
        );
    }

    setupEventHandlers() {
        // 빈 공간 클릭 시 선택 해제
        this.stage.on('click', (e) => {
            if (e.target === this.stage) {
                layoutEditorState.clearSelection();
            }
        });

        // 객체 드래그 종료 시
        this.equipmentLayer.on('dragend', (e) => {
            this.handleDragEnd(e.target);
        });
    }

    drawGrid(gridSize = layoutEditorState.state.gridSize) {
        this.backgroundLayer.destroyChildren();

        const width = this.stage.width();
        const height = this.stage.height();

        // 세밀한 그리드 (1m = 10px)
        for (let x = 0; x <= width; x += gridSize) {
            this.backgroundLayer.add(new Konva.Line({
                points: [x, 0, x, height],
                stroke: '#e0e0e0',
                strokeWidth: 1
            }));
        }

        for (let y = 0; y <= height; y += gridSize) {
            this.backgroundLayer.add(new Konva.Line({
                points: [0, y, width, y],
                stroke: '#e0e0e0',
                strokeWidth: 1
            }));
        }

        // 굵은 그리드 (10m = 100px)
        for (let x = 0; x <= width; x += gridSize * 10) {
            this.backgroundLayer.add(new Konva.Line({
                points: [x, 0, x, height],
                stroke: '#bdbdbd',
                strokeWidth: 2
            }));
        }

        for (let y = 0; y <= height; y += gridSize * 10) {
            this.backgroundLayer.add(new Konva.Line({
                points: [0, y, width, y],
                stroke: '#bdbdbd',
                strokeWidth: 2
            }));
        }

        this.backgroundLayer.batchDraw();
    }

    handleDragEnd(object) {
        if (this.snapEnabled) {
            const gridSize = layoutEditorState.state.gridSize;
            object.x(Math.round(object.x() / gridSize) * gridSize);
            object.y(Math.round(object.y() / gridSize) * gridSize);
        }

        // 히스토리에 추가
        layoutEditorState.addToHistory(this.captureState());

        this.stage.batchDraw();
    }

    updateTransformers(selectedObjects) {
        // Transformer 업데이트 로직
        console.log(`[Canvas2DEditor] Selected: ${selectedObjects.length} objects`);
    }

    loadLayout(layout) {
        console.log('[Canvas2DEditor] Loading layout...');
        // Layout 데이터를 Canvas에 렌더링
    }

    captureState() {
        // 현재 Canvas 상태 캡처
        return {
            objects: this.equipmentLayer.children.map(obj => ({
                id: obj.id(),
                x: obj.x(),
                y: obj.y(),
                width: obj.width(),
                height: obj.height()
            }))
        };
    }

    applySnapshot(snapshot) {
        // 스냅샷을 Canvas에 적용
        console.log('[Canvas2DEditor] Applying snapshot...');
    }

    cleanup() {
        this.subscriptions.forEach(unsub => unsub());
        this.subscriptions = [];
        this.stage.destroy();
    }
}


// ============================================================================
// 3. AutoSaveManager
// ============================================================================

class AutoSaveManager {
    constructor() {
        this.timer = null;
        this.interval = 5 * 60 * 1000; // 5분
        this.subscriptions = [];

        this.setupListeners();
    }

    setupListeners() {
        // Dirty 상태 감시
        this.subscriptions.push(
            layoutEditorState.subscribe('isDirty', (isDirty) => {
                if (isDirty && layoutEditorState.state.autoSaveEnabled) {
                    this.scheduleAutoSave();
                }
            })
        );

        // Auto-Save 활성화 토글
        this.subscriptions.push(
            layoutEditorState.subscribe('autoSaveEnabled', (enabled) => {
                if (!enabled) {
                    this.cancelAutoSave();
                } else if (layoutEditorState.state.isDirty) {
                    this.scheduleAutoSave();
                }
            })
        );
    }

    scheduleAutoSave() {
        this.cancelAutoSave();

        console.log('[AutoSave] Scheduled in 5 minutes');

        this.timer = setTimeout(() => {
            this.performAutoSave();
        }, this.interval);
    }

    async performAutoSave() {
        try {
            const layout = layoutEditorState.state.currentLayout;
            const siteId = layoutEditorState.state.currentSiteId;

            if (!siteId || !layout) return;

            console.log('[AutoSave] Saving...');

            // Auto-Save 파일 저장 (백업)
            await LayoutFileManager.saveLayout(siteId + '.autosave', layout);

            layoutEditorState.markAsSaved();

            console.log('[AutoSave] Success');
            this.showNotification('자동 저장 완료');
        } catch (error) {
            console.error('[AutoSave] Failed:', error);
            this.showNotification('자동 저장 실패', 'error');
        }
    }

    cancelAutoSave() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
            console.log('[AutoSave] Cancelled');
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[Notification ${type}] ${message}`);
    }

    cleanup() {
        this.cancelAutoSave();
        this.subscriptions.forEach(unsub => unsub());
        this.subscriptions = [];
    }
}


// ============================================================================
// 4. 초기화
// ============================================================================

// 전역 인스턴스 생성
let layoutEditorMain = null;

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Integration] Initializing SHERLOCK_SKY_3DSIM...');

    // LayoutEditorMain 인스턴스 생성
    layoutEditorMain = new LayoutEditorMain();

    // 전역 객체로 설정 (디버깅용)
    window.layoutEditorMain = layoutEditorMain;
    window.layoutEditorState = layoutEditorState;

    console.log('[Integration] Initialization complete');
    console.log('[Integration] Try: layoutEditorState.debug()');
});

// 페이지 언로드 전 정리
window.addEventListener('beforeunload', () => {
    if (layoutEditorMain) {
        layoutEditorMain.cleanup();
    }
});


// Export (ES Module)
export {
    LayoutEditorMain,
    Canvas2DEditor,
    AutoSaveManager
};