/**
 * PerformanceMonitorUI.js
 * 성능 모니터링 UI 컴포넌트
 * 
 * @version 1.0.0
 * @description FPS, 메모리 등 성능 지표 표시
 */

import { BaseComponent } from '../../core/base/BaseComponent.js';

/**
 * PerformanceMonitorUI
 */
export class PerformanceMonitorUI extends BaseComponent {
    constructor(options = {}) {
        super({
            ...options,
            className: 'performance-monitor'
        });
        
        // 성능 데이터
        this._fps = 0;
        this._frameTime = 0;
        this._memory = null;
        
        // FPS 계산용
        this._frames = 0;
        this._lastTime = performance.now();
        this._updateInterval = null;
        
        // 위치
        this.position = options.position || 'top-left';
    }
    
    /**
     * 렌더링
     */
    render() {
        const positionStyles = this._getPositionStyles();
        
        return `
            <div class="performance-monitor" style="
                position: fixed;
                ${positionStyles}
                background: rgba(0, 0, 0, 0.8);
                color: #0f0;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 11px;
                padding: 6px 10px;
                border-radius: 4px;
                z-index: 9999;
                pointer-events: none;
                min-width: 100px;
            ">
                <div class="perf-row" style="display: flex; justify-content: space-between; gap: 16px;">
                    <span>FPS:</span>
                    <span id="perf-fps" style="color: #0f0;">--</span>
                </div>
                <div class="perf-row" style="display: flex; justify-content: space-between; gap: 16px;">
                    <span>Frame:</span>
                    <span id="perf-frame">-- ms</span>
                </div>
                <div class="perf-row" style="display: flex; justify-content: space-between; gap: 16px;">
                    <span>Memory:</span>
                    <span id="perf-memory">-- MB</span>
                </div>
                <div class="perf-row" style="display: flex; justify-content: space-between; gap: 16px;">
                    <span>Draw:</span>
                    <span id="perf-draw">--</span>
                </div>
            </div>
        `;
    }
    
    /**
     * 위치 스타일
     */
    _getPositionStyles() {
        const positions = {
            'top-left': 'top: 10px; left: 10px;',
            'top-right': 'top: 10px; right: 10px;',
            'bottom-left': 'bottom: 10px; left: 10px;',
            'bottom-right': 'bottom: 10px; right: 10px;'
        };
        return positions[this.position] || positions['top-left'];
    }
    
    /**
     * 마운트 후
     */
    onMount() {
        this._startMonitoring();
    }
    
    /**
     * 모니터링 시작
     */
    _startMonitoring() {
        // UI 업데이트 (500ms마다)
        this._updateInterval = setInterval(() => {
            this._updateUI();
        }, 500);
    }
    
    /**
     * 모니터링 중지
     */
    _stopMonitoring() {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
    }
    
    /**
     * 프레임 기록 (렌더 루프에서 호출)
     */
    recordFrame() {
        this._frames++;
        
        const now = performance.now();
        const elapsed = now - this._lastTime;
        
        if (elapsed >= 1000) {
            this._fps = Math.round((this._frames * 1000) / elapsed);
            this._frames = 0;
            this._lastTime = now;
        }
    }
    
    /**
     * 프레임 시간 설정
     */
    setFrameTime(ms) {
        this._frameTime = ms;
    }
    
    /**
     * 렌더 정보 설정 (Three.js renderer.info)
     */
    setRenderInfo(info) {
        this._renderInfo = info;
    }
    
    /**
     * UI 업데이트
     */
    _updateUI() {
        // FPS
        const fpsEl = this.$('#perf-fps');
        if (fpsEl) {
            fpsEl.textContent = this._fps;
            fpsEl.style.color = this._fps >= 50 ? '#0f0' : this._fps >= 30 ? '#ff0' : '#f00';
        }
        
        // Frame time
        const frameEl = this.$('#perf-frame');
        if (frameEl) {
            frameEl.textContent = `${this._frameTime.toFixed(1)} ms`;
        }
        
        // Memory
        const memoryEl = this.$('#perf-memory');
        if (memoryEl && performance.memory) {
            const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            memoryEl.textContent = `${used} MB`;
        }
        
        // Draw calls
        const drawEl = this.$('#perf-draw');
        if (drawEl && this._renderInfo) {
            const calls = this._renderInfo.render?.calls || 0;
            const triangles = this._renderInfo.render?.triangles || 0;
            drawEl.textContent = `${calls} / ${(triangles / 1000).toFixed(1)}k`;
        }
    }
    
    /**
     * 표시
     */
    show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
        this._startMonitoring();
    }
    
    /**
     * 숨기기
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
        this._stopMonitoring();
    }
    
    /**
     * 파괴
     */
    destroy() {
        this._stopMonitoring();
        super.destroy();
    }
}

export default PerformanceMonitorUI;