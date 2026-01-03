/**
 * KeyboardService.js
 * ===================
 * 키보드 단축키 처리 서비스
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/services/KeyboardService.js
 */

class KeyboardService {
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.commandManager = options.commandManager;
        this.state = options.state || window.layoutEditorState;
        
        // 액션 핸들러 맵
        this.actions = {};
        
        // 기본 단축키 설정
        this.shortcuts = window.LayoutEditorConfig?.KEYBOARD_SHORTCUTS || {
            ctrlCombinations: {
                'z': 'undo',
                'y': 'redo',
                'a': 'selectAll',
                's': 'save',
                'd': 'duplicate',
                'g': 'group'
            },
            single: {
                'v': 'selectTool',
                'w': 'wallTool',
                'c': 'toggleComponentSubmenu',
                'g': 'toggleGrid',
                's': 'toggleSnap',
                'm': 'toggleMICESnap',
                'h': 'toggleSmartGuides',
                'l': 'toggleAlignPopup',
                'r': 'rotateCW',
                'delete': 'deleteSelected',
                'backspace': 'deleteSelected',
                'a': 'showEquipmentArrayModal',
                'escape': 'escape',
                '?': 'toggleShortcutsHelp'
            }
        };
        
        console.log('✅ KeyboardService 초기화 완료');
    }
    
    /**
     * 액션 핸들러 등록
     */
    registerAction(name, handler) {
        this.actions[name] = handler;
    }
    
    /**
     * 여러 액션 핸들러 일괄 등록
     */
    registerActions(actionMap) {
        Object.assign(this.actions, actionMap);
    }
    
    /**
     * 키보드 이벤트 리스너 활성화
     */
    activate() {
        this._keydownHandler = (e) => this.handleKeyDown(e);
        document.addEventListener('keydown', this._keydownHandler);
    }
    
    /**
     * 키보드 이벤트 리스너 비활성화
     */
    deactivate() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }
    }
    
    /**
     * 키보드 이벤트 처리
     */
    handleKeyDown(e) {
        // Input/Textarea에서는 무시
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl/Cmd 조합
        if (e.ctrlKey || e.metaKey) {
            const action = this.getCtrlAction(e.key.toLowerCase(), e.shiftKey);
            if (action) {
                e.preventDefault();
                this.executeAction(action);
                return;
            }
        }
        
        // Arrow Keys
        const arrowKey = e.key.toLowerCase();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(arrowKey)) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            this.moveSelected(arrowKey, step);
            return;
        }
        
        // 줌 키
        if (['+', '=', '-', '_', '0'].includes(e.key)) {
            const zoomActions = {
                '+': 'zoomIn', '=': 'zoomIn',
                '-': 'zoomOut', '_': 'zoomOut',
                '0': 'resetZoom'
            };
            this.executeAction(zoomActions[e.key]);
            return;
        }
        
        // 레이어 순서 키
        if (e.key === '[' || e.key === ']') {
            const layerActions = {
                '[': e.shiftKey ? 'sendToBack' : 'sendBackward',
                ']': e.shiftKey ? 'bringToFront' : 'bringForward'
            };
            this.executeAction(layerActions[e.key]);
            return;
        }
        
        // 회전 키
        if (e.key.toLowerCase() === 'r') {
            e.preventDefault();
            this.executeAction(e.shiftKey ? 'rotateCCW' : 'rotateCW');
            return;
        }
        
        // 일반 단축키
        const action = this.getSingleAction(e.key.toLowerCase());
        if (action) {
            // 'a'는 Ctrl 없이도 특수 처리 (selectAll vs showEquipmentArrayModal)
            if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
                this.executeAction('showEquipmentArrayModal');
                return;
            }
            this.executeAction(action);
        }
    }
    
    /**
     * Ctrl 조합 액션 가져오기
     */
    getCtrlAction(key, shiftKey) {
        if (key === 'g' && shiftKey) return 'ungroup';
        return this.shortcuts.ctrlCombinations[key];
    }
    
    /**
     * 단일 키 액션 가져오기
     */
    getSingleAction(key) {
        return this.shortcuts.single[key];
    }
    
    /**
     * 액션 실행
     */
    executeAction(actionName) {
        if (!actionName) return;
        
        const handler = this.actions[actionName];
        if (handler) {
            handler();
        } else {
            console.warn(`[KeyboardService] 등록되지 않은 액션: ${actionName}`);
        }
    }
    
    /**
     * 선택된 객체 이동 (Arrow Keys)
     */
    moveSelected(direction, step) {
        if (!this.canvas) return;
        
        const selected = this.canvas.selectedObjects;
        if (!selected || selected.length === 0) return;
        
        let dx = 0, dy = 0;
        switch (direction) {
            case 'arrowleft':  dx = -step; break;
            case 'arrowright': dx = step; break;
            case 'arrowup':    dy = -step; break;
            case 'arrowdown':  dy = step; break;
        }
        
        if (this.commandManager && typeof MoveCommand !== 'undefined') {
            const moveCommand = new MoveCommand(selected, dx, dy);
            this.commandManager.execute(moveCommand);
            this.canvas.transformer?.forceUpdate();
        } else {
            selected.forEach(shape => {
                shape.x(shape.x() + dx);
                shape.y(shape.y() + dy);
            });
            this.canvas.stage.batchDraw();
            this.canvas.transformer?.forceUpdate();
        }
        
        // State 업데이트 이벤트
        if (this.state?.emit) {
            this.state.emit('objects:moved', { dx, dy, count: selected.length });
        }
    }
    
    /**
     * 단축키 추가/수정
     */
    setShortcut(key, action, isCtrlCombo = false) {
        if (isCtrlCombo) {
            this.shortcuts.ctrlCombinations[key] = action;
        } else {
            this.shortcuts.single[key] = action;
        }
    }
    
    /**
     * 모든 단축키 가져오기 (도움말용)
     */
    getAllShortcuts() {
        return {
            ctrl: { ...this.shortcuts.ctrlCombinations },
            single: { ...this.shortcuts.single },
            arrows: {
                'Arrow Keys': 'Move 1px',
                'Shift + Arrow Keys': 'Move 10px'
            }
        };
    }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.KeyboardService = KeyboardService;
}

console.log('✅ KeyboardService.js 로드 완료');