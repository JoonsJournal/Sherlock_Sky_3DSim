/**
 * DebugPanel.js
 * 디버그 정보 표시 패널
 * 
 * @version 1.0.0
 * @description 개발/디버깅용 정보 패널
 */

import { BasePanel } from '../../core/base/BasePanel.js';
import { debugManager } from '../../core/managers/DebugManager.js';
import { appModeManager } from '../../core/managers/AppModeManager.js';
import { keyboardManager } from '../../core/managers/KeyboardManager.js';
import { eventBus } from '../../core/managers/EventBus.js';

/**
 * DebugPanel
 */
export class DebugPanel extends BasePanel {
    constructor(options = {}) {
        super({
            ...options,
            title: '🐛 Debug Panel',
            collapsible: true,
            className: 'debug-panel'
        });
        
        this._updateInterval = null;
        this._commandHistory = [];
    }
    
    /**
     * 내용 렌더링
     */
    renderContent() {
        return `
            <div class="debug-panel-content" style="
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                color: #0f0;
                background: #1a1a1a;
                padding: 10px;
                max-height: 400px;
                overflow-y: auto;
            ">
                <!-- Status Section -->
                <div class="debug-section">
                    <div class="debug-section-title" style="color: #0ff; margin-bottom: 8px;">
                        📊 Application State
                    </div>
                    <div class="debug-state" id="debug-state">
                        Loading...
                    </div>
                </div>
                
                <!-- Performance Section -->
                <div class="debug-section" style="margin-top: 12px;">
                    <div class="debug-section-title" style="color: #0ff; margin-bottom: 8px;">
                        ⚡ Performance
                    </div>
                    <div class="debug-performance" id="debug-performance">
                        Loading...
                    </div>
                </div>
                
                <!-- Event Log Section -->
                <div class="debug-section" style="margin-top: 12px;">
                    <div class="debug-section-title" style="color: #0ff; margin-bottom: 8px;">
                        📝 Recent Events
                    </div>
                    <div class="debug-events" id="debug-events" style="
                        max-height: 100px;
                        overflow-y: auto;
                    ">
                        No events
                    </div>
                </div>
                
                <!-- Command Input -->
                <div class="debug-section" style="margin-top: 12px;">
                    <div class="debug-section-title" style="color: #0ff; margin-bottom: 8px;">
                        💻 Command Console
                    </div>
                    <div class="debug-command-input" style="display: flex; gap: 8px;">
                        <input type="text" 
                               id="debug-command-input"
                               placeholder="Enter command (type 'help' for list)"
                               style="
                                   flex: 1;
                                   background: #0a0a0a;
                                   border: 1px solid #333;
                                   color: #0f0;
                                   padding: 6px 8px;
                                   font-family: inherit;
                                   font-size: 12px;
                               ">
                        <button id="debug-run-btn" style="
                            background: #333;
                            border: 1px solid #555;
                            color: #0f0;
                            padding: 6px 12px;
                            cursor: pointer;
                        ">Run</button>
                    </div>
                    <div class="debug-output" id="debug-output" style="
                        margin-top: 8px;
                        padding: 8px;
                        background: #0a0a0a;
                        border: 1px solid #333;
                        min-height: 40px;
                        max-height: 100px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                    "></div>
                </div>
            </div>
        `;
    }
    
    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners() {
        const input = this.$('#debug-command-input');
        const runBtn = this.$('#debug-run-btn');
        
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this._executeCommand(input.value);
                    input.value = '';
                }
            });
        }
        
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                if (input) {
                    this._executeCommand(input.value);
                    input.value = '';
                }
            });
        }
    }
    
    /**
     * 표시될 때
     */
    onShow() {
        this._startUpdate();
        debugManager.enable();
    }
    
    /**
     * 숨겨질 때
     */
    onHide() {
        this._stopUpdate();
    }
    
    /**
     * 업데이트 시작
     */
    _startUpdate() {
        this._updateInterval = setInterval(() => {
            this._updateState();
            this._updatePerformance();
            this._updateEvents();
        }, 500);
        
        // 즉시 한 번 업데이트
        this._updateState();
        this._updatePerformance();
    }
    
    /**
     * 업데이트 중지
     */
    _stopUpdate() {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
    }
    
    /**
     * 상태 업데이트
     */
    _updateState() {
        const stateEl = this.$('#debug-state');
        if (!stateEl) return;
        
        const currentMode = appModeManager.getCurrentMode();
        const keyboardContext = keyboardManager.getContext();
        
        stateEl.innerHTML = `
            <div>Mode: <span style="color: #ff0;">${currentMode || 'N/A'}</span></div>
            <div>Keyboard: <span style="color: #ff0;">${keyboardContext || 'N/A'}</span></div>
            <div>Debug: <span style="color: ${debugManager.isEnabled() ? '#0f0' : '#f00'};">${debugManager.isEnabled() ? 'ON' : 'OFF'}</span></div>
        `;
    }
    
    /**
     * 성능 업데이트
     */
    _updatePerformance() {
        const perfEl = this.$('#debug-performance');
        if (!perfEl) return;
        
        const memory = performance.memory;
        const memoryInfo = memory ? {
            used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(1),
            total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(1)
        } : null;
        
        perfEl.innerHTML = `
            <div>Time: <span style="color: #ff0;">${new Date().toLocaleTimeString()}</span></div>
            ${memoryInfo ? `
                <div>Memory: <span style="color: #ff0;">${memoryInfo.used} / ${memoryInfo.total} MB</span></div>
            ` : ''}
        `;
    }
    
    /**
     * 이벤트 로그 업데이트
     */
    _updateEvents() {
        const eventsEl = this.$('#debug-events');
        if (!eventsEl) return;
        
        const history = eventBus.getHistory ? eventBus.getHistory() : [];
        const recentEvents = history.slice(-5);
        
        if (recentEvents.length === 0) {
            eventsEl.innerHTML = '<div style="color: #666;">No events</div>';
            return;
        }
        
        eventsEl.innerHTML = recentEvents.map(e => `
            <div style="color: #888; font-size: 11px;">
                <span style="color: #666;">${new Date(e.timestamp).toLocaleTimeString()}</span>
                <span style="color: #0ff;">${e.event}</span>
            </div>
        `).join('');
    }
    
    /**
     * 명령 실행
     */
    _executeCommand(command) {
        if (!command.trim()) return;
        
        const outputEl = this.$('#debug-output');
        if (!outputEl) return;
        
        this._commandHistory.push(command);
        
        try {
            let result;
            
            // 내장 명령어 처리
            if (command === 'help') {
                result = debugManager.listCommands()
                    .map(c => `${c.name}: ${c.description}`)
                    .join('\n');
            } else if (command === 'clear') {
                outputEl.innerHTML = '';
                return;
            } else {
                // debugManager 명령 실행
                const [cmd, ...args] = command.split(' ');
                result = debugManager.executeCommand(cmd, ...args);
            }
            
            outputEl.innerHTML = `<span style="color: #888;">&gt; ${command}</span>\n` +
                `<span style="color: #0f0;">${JSON.stringify(result, null, 2) || 'Done'}</span>`;
        } catch (error) {
            outputEl.innerHTML = `<span style="color: #888;">&gt; ${command}</span>\n` +
                `<span style="color: #f00;">Error: ${error.message}</span>`;
        }
        
        outputEl.scrollTop = outputEl.scrollHeight;
    }
    
    /**
     * 파괴
     */
    destroy() {
        this._stopUpdate();
        super.destroy();
    }
}

export default DebugPanel;