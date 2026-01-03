/**
 * CommandManager.js
 * ===================
 * 
 * Command 히스토리 관리 및 Undo/Redo 시스템
 * 
 * @version 1.0.0 - Phase 1.5
 * @module CommandManager
 * 
 * 역할:
 * 1. Command 실행 및 히스토리 관리
 * 2. Undo/Redo 스택 관리
 * 3. 키보드 단축키 연동 (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
 * 4. 히스토리 제한 (메모리 관리)
 * 5. 트랜잭션 지원 (여러 Command 묶음)
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/commands/CommandManager.js
 */

class CommandManager {
    /**
     * @param {Object} options - 옵션
     */
    constructor(options = {}) {
        // 히스토리 스택
        this.undoStack = [];
        this.redoStack = [];
        
        // 설정
        this.config = {
            // 최대 히스토리 개수
            maxHistory: options.maxHistory || 50,
            
            // Command 병합 활성화
            mergeEnabled: options.mergeEnabled !== false,
            
            // 키보드 단축키 활성화
            keyboardShortcutsEnabled: options.keyboardShortcutsEnabled !== false,
            
            // 단축키 타겟 엘리먼트
            keyboardTarget: options.keyboardTarget || document
        };
        
        // 현재 트랜잭션
        this.currentTransaction = null;
        
        // 콜백
        this.callbacks = {
            onExecute: options.onExecute || null,
            onUndo: options.onUndo || null,
            onRedo: options.onRedo || null,
            onHistoryChange: options.onHistoryChange || null,
            onSavePoint: options.onSavePoint || null
        };
        
        // 저장 포인트 (현재 히스토리 위치 표시)
        this.savePointIndex = 0;
        
        // 실행 중 플래그 (중첩 방지)
        this.isExecuting = false;
        
        // 키보드 이벤트 핸들러
        this._keyboardHandler = null;
        
        // 키보드 단축키 설정
        if (this.config.keyboardShortcutsEnabled) {
            this._setupKeyboardShortcuts();
        }
        
        console.log('[CommandManager] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // Command 실행
    // =====================================================
    
    /**
     * Command 실행
     * @param {Command} command - 실행할 Command
     * @param {boolean} skipMerge - 병합 건너뛰기
     * @returns {boolean} 성공 여부
     */
    execute(command, skipMerge = false) {
        if (!command) {
            console.warn('[CommandManager] Command가 없습니다');
            return false;
        }
        
        // 트랜잭션 중이면 트랜잭션에 추가
        if (this.currentTransaction) {
            this.currentTransaction.add(command);
            return true;
        }
        
        // 중첩 실행 방지
        if (this.isExecuting) {
            console.warn('[CommandManager] 이미 Command 실행 중');
            return false;
        }
        
        this.isExecuting = true;
        
        try {
            // Command 병합 시도
            if (this.config.mergeEnabled && !skipMerge && this.undoStack.length > 0) {
                const lastCommand = this.undoStack[this.undoStack.length - 1];
                
                if (lastCommand.canMergeWith(command)) {
                    // 마지막 Command와 병합
                    const mergedCommand = lastCommand.mergeWith(command);
                    this.undoStack.pop();
                    command = mergedCommand;
                }
            }
            
            // Command 실행
            command.execute();
            
            // Undo 스택에 추가
            this.undoStack.push(command);
            
            // Redo 스택 클리어 (새 작업이므로)
            this.redoStack = [];
            
            // 히스토리 제한 적용
            this._trimHistory();
            
            // 콜백 호출
            this._triggerCallback('onExecute', command);
            this._triggerCallback('onHistoryChange', this._getHistoryState());
            
            console.log(`[CommandManager] 실행: ${command.description}`);
            
            return true;
            
        } catch (error) {
            console.error('[CommandManager] Command 실행 실패:', error);
            return false;
            
        } finally {
            this.isExecuting = false;
        }
    }
    
    /**
     * 여러 Command 한번에 실행
     * @param {Array<Command>} commands - Command 배열
     * @param {string} description - 그룹 설명
     * @returns {boolean}
     */
    executeGroup(commands, description = 'Group action') {
        if (!commands || commands.length === 0) return false;
        
        // GroupCommand import 필요
        const GroupCommand = window.GroupCommand;
        if (!GroupCommand) {
            console.error('[CommandManager] GroupCommand가 로드되지 않았습니다');
            return false;
        }
        
        const groupCommand = new GroupCommand(commands, description);
        return this.execute(groupCommand, true);
    }
    
    // =====================================================
    // Undo / Redo
    // =====================================================
    
    /**
     * Undo 실행
     * @returns {boolean} 성공 여부
     */
    undo() {
        if (!this.canUndo()) {
            console.log('[CommandManager] Undo할 항목이 없습니다');
            return false;
        }
        
        if (this.isExecuting) {
            console.warn('[CommandManager] Command 실행 중에는 Undo 불가');
            return false;
        }
        
        this.isExecuting = true;
        
        try {
            const command = this.undoStack.pop();
            command.undo();
            this.redoStack.push(command);
            
            this._triggerCallback('onUndo', command);
            this._triggerCallback('onHistoryChange', this._getHistoryState());
            
            console.log(`[CommandManager] Undo: ${command.description}`);
            
            return true;
            
        } catch (error) {
            console.error('[CommandManager] Undo 실패:', error);
            return false;
            
        } finally {
            this.isExecuting = false;
        }
    }
    
    /**
     * Redo 실행
     * @returns {boolean} 성공 여부
     */
    redo() {
        if (!this.canRedo()) {
            console.log('[CommandManager] Redo할 항목이 없습니다');
            return false;
        }
        
        if (this.isExecuting) {
            console.warn('[CommandManager] Command 실행 중에는 Redo 불가');
            return false;
        }
        
        this.isExecuting = true;
        
        try {
            const command = this.redoStack.pop();
            command.redo();
            this.undoStack.push(command);
            
            this._triggerCallback('onRedo', command);
            this._triggerCallback('onHistoryChange', this._getHistoryState());
            
            console.log(`[CommandManager] Redo: ${command.description}`);
            
            return true;
            
        } catch (error) {
            console.error('[CommandManager] Redo 실패:', error);
            return false;
            
        } finally {
            this.isExecuting = false;
        }
    }
    
    /**
     * Undo 가능 여부
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 0;
    }
    
    /**
     * Redo 가능 여부
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    /**
     * 여러 단계 Undo
     * @param {number} steps - 단계 수
     * @returns {number} 실제 Undo한 횟수
     */
    undoMultiple(steps) {
        let count = 0;
        for (let i = 0; i < steps && this.canUndo(); i++) {
            if (this.undo()) count++;
        }
        return count;
    }
    
    /**
     * 여러 단계 Redo
     * @param {number} steps - 단계 수
     * @returns {number} 실제 Redo한 횟수
     */
    redoMultiple(steps) {
        let count = 0;
        for (let i = 0; i < steps && this.canRedo(); i++) {
            if (this.redo()) count++;
        }
        return count;
    }
    
    // =====================================================
    // 트랜잭션 (여러 Command 묶음)
    // =====================================================
    
    /**
     * 트랜잭션 시작
     * @param {string} description - 트랜잭션 설명
     */
    beginTransaction(description = 'Transaction') {
        if (this.currentTransaction) {
            console.warn('[CommandManager] 이미 트랜잭션 진행 중');
            return;
        }
        
        const GroupCommand = window.GroupCommand;
        if (!GroupCommand) {
            console.error('[CommandManager] GroupCommand가 로드되지 않았습니다');
            return;
        }
        
        this.currentTransaction = new GroupCommand([], description);
        console.log(`[CommandManager] 트랜잭션 시작: ${description}`);
    }
    
    /**
     * 트랜잭션 커밋 (실행)
     * @returns {boolean} 성공 여부
     */
    commitTransaction() {
        if (!this.currentTransaction) {
            console.warn('[CommandManager] 진행 중인 트랜잭션이 없습니다');
            return false;
        }
        
        const transaction = this.currentTransaction;
        this.currentTransaction = null;
        
        if (transaction.isEmpty()) {
            console.log('[CommandManager] 빈 트랜잭션 (커밋 생략)');
            return true;
        }
        
        console.log(`[CommandManager] 트랜잭션 커밋: ${transaction.description} (${transaction.size()} commands)`);
        
        return this.execute(transaction, true);
    }
    
    /**
     * 트랜잭션 롤백 (취소)
     */
    rollbackTransaction() {
        if (!this.currentTransaction) {
            console.warn('[CommandManager] 진행 중인 트랜잭션이 없습니다');
            return;
        }
        
        const transaction = this.currentTransaction;
        this.currentTransaction = null;
        
        // 이미 실행된 Command들 Undo
        if (transaction.executed) {
            transaction.undo();
        }
        
        console.log(`[CommandManager] 트랜잭션 롤백: ${transaction.description}`);
    }
    
    /**
     * 트랜잭션 진행 중 여부
     * @returns {boolean}
     */
    isInTransaction() {
        return this.currentTransaction !== null;
    }
    
    // =====================================================
    // 저장 포인트
    // =====================================================
    
    /**
     * 현재 위치를 저장 포인트로 설정
     */
    setSavePoint() {
        this.savePointIndex = this.undoStack.length;
        this._triggerCallback('onSavePoint', this.savePointIndex);
        console.log(`[CommandManager] 저장 포인트 설정: ${this.savePointIndex}`);
    }
    
    /**
     * 저장 포인트 이후 변경 여부
     * @returns {boolean}
     */
    isDirty() {
        return this.undoStack.length !== this.savePointIndex;
    }
    
    /**
     * 저장 포인트로 되돌리기
     * @returns {boolean}
     */
    revertToSavePoint() {
        const steps = this.undoStack.length - this.savePointIndex;
        
        if (steps > 0) {
            return this.undoMultiple(steps) === steps;
        } else if (steps < 0) {
            return this.redoMultiple(-steps) === -steps;
        }
        
        return true;
    }
    
    // =====================================================
    // 히스토리 관리
    // =====================================================
    
    /**
     * 히스토리 초기화
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.savePointIndex = 0;
        this.currentTransaction = null;
        
        this._triggerCallback('onHistoryChange', this._getHistoryState());
        
        console.log('[CommandManager] 히스토리 초기화');
    }
    
    /**
     * 히스토리 제한 적용
     * @private
     */
    _trimHistory() {
        while (this.undoStack.length > this.config.maxHistory) {
            this.undoStack.shift();
            this.savePointIndex = Math.max(0, this.savePointIndex - 1);
        }
    }
    
    /**
     * 히스토리 상태 반환
     * @private
     */
    _getHistoryState() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            isDirty: this.isDirty(),
            lastCommand: this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null
        };
    }
    
    /**
     * Undo 스택 조회
     * @returns {Array<Object>}
     */
    getUndoHistory() {
        return this.undoStack.map(cmd => ({
            type: cmd.type,
            description: cmd.description,
            timestamp: cmd.timestamp
        }));
    }
    
    /**
     * Redo 스택 조회
     * @returns {Array<Object>}
     */
    getRedoHistory() {
        return this.redoStack.map(cmd => ({
            type: cmd.type,
            description: cmd.description,
            timestamp: cmd.timestamp
        }));
    }
    
    /**
     * 히스토리 크기 반환
     * @returns {Object} { undo, redo, total }
     */
    getHistorySize() {
        return {
            undo: this.undoStack.length,
            redo: this.redoStack.length,
            total: this.undoStack.length + this.redoStack.length
        };
    }
    
    // =====================================================
    // 키보드 단축키
    // =====================================================
    
    /**
     * 키보드 단축키 설정
     * @private
     */
    _setupKeyboardShortcuts() {
        this._keyboardHandler = (e) => {
            // Ctrl+Z (Undo)
            if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            // Ctrl+Y (Redo) 또는 Ctrl+Shift+Z
            else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                this.redo();
            }
        };
        
        this.config.keyboardTarget.addEventListener('keydown', this._keyboardHandler);
        console.log('[CommandManager] 키보드 단축키 활성화');
    }
    
    /**
     * 키보드 단축키 활성화
     */
    enableKeyboardShortcuts() {
        if (this._keyboardHandler) return;
        
        this.config.keyboardShortcutsEnabled = true;
        this._setupKeyboardShortcuts();
    }
    
    /**
     * 키보드 단축키 비활성화
     */
    disableKeyboardShortcuts() {
        if (this._keyboardHandler) {
            this.config.keyboardTarget.removeEventListener('keydown', this._keyboardHandler);
            this._keyboardHandler = null;
        }
        this.config.keyboardShortcutsEnabled = false;
        console.log('[CommandManager] 키보드 단축키 비활성화');
    }
    
    // =====================================================
    // 콜백
    // =====================================================
    
    /**
     * 콜백 실행
     * @private
     */
    _triggerCallback(name, data) {
        if (this.callbacks[name]) {
            try {
                this.callbacks[name](data);
            } catch (error) {
                console.error(`[CommandManager] 콜백 오류 (${name}):`, error);
            }
        }
    }
    
    /**
     * 콜백 설정
     * @param {string} name - 콜백 이름
     * @param {Function} callback - 콜백 함수
     */
    setCallback(name, callback) {
        if (this.callbacks.hasOwnProperty(name)) {
            this.callbacks[name] = callback;
        }
    }
    
    // =====================================================
    // 설정
    // =====================================================
    
    /**
     * 최대 히스토리 개수 설정
     * @param {number} max
     */
    setMaxHistory(max) {
        this.config.maxHistory = max;
        this._trimHistory();
    }
    
    /**
     * Command 병합 활성화/비활성화
     * @param {boolean} enabled
     */
    setMergeEnabled(enabled) {
        this.config.mergeEnabled = enabled;
    }
    
    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 파괴
     */
    destroy() {
        this.disableKeyboardShortcuts();
        this.clear();
        this.callbacks = {};
        console.log('[CommandManager] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined') {
    window.CommandManager = CommandManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommandManager;
}

export { CommandManager };