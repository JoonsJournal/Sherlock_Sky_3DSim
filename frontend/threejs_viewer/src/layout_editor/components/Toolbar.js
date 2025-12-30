/**
 * Toolbar.js
 * 
 * Layout Editor 도구 모음 UI
 * 
 * @module Toolbar
 * @version 1.0.0
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/components/Toolbar.js
 */

class Toolbar {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }

        this.tools = [];
        this.activeTool = null;

        this.createToolbar();
        
        console.log('[Toolbar] Initialized');
    }

    /**
     * Toolbar HTML 생성
     */
    createToolbar() {
        const toolbarHTML = `
            <div class="layout-editor-toolbar">
                <div class="toolbar-section">
                    <h4>기본 도구</h4>
                    <button class="toolbar-btn" id="toolSelectMode" data-tool="select" title="Select Mode">
                        <span class="icon">🖱️</span>
                        <span class="label">Select</span>
                    </button>
                </div>

                <div class="toolbar-section">
                    <h4>Room & Walls</h4>
                    <button class="toolbar-btn" id="toolRoom" data-tool="room" title="Room Size">
                        <span class="icon">🏛️</span>
                        <span class="label">Room</span>
                    </button>
                    <button class="toolbar-btn" id="toolWall" data-tool="wall" title="Draw Wall">
                        <span class="icon">🧱</span>
                        <span class="label">Wall</span>
                    </button>
                    <button class="toolbar-btn" id="toolPartition" data-tool="partition" title="Draw Partition">
                        <span class="icon">🚪</span>
                        <span class="label">Partition</span>
                    </button>
                </div>

                <div class="toolbar-section">
                    <h4>Components</h4>
                    <button class="toolbar-btn" id="toolOffice" data-tool="office" title="Office Area">
                        <span class="icon">🪑</span>
                        <span class="label">Office</span>
                    </button>
                    <button class="toolbar-btn" id="toolEquipmentArray" data-tool="equipment-array" title="Equipment Array">
                        <span class="icon">⚙️</span>
                        <span class="label">Equipment Array</span>
                    </button>
                </div>

                <div class="toolbar-section">
                    <h4>Actions</h4>
                    <button class="toolbar-btn" id="toolClear" data-tool="clear" title="Clear Canvas">
                        <span class="icon">🗑️</span>
                        <span class="label">Clear</span>
                    </button>
                </div>
            </div>
        `;

        this.container.innerHTML = toolbarHTML;

        // 스타일 주입
        this.injectStyles();

        // 이벤트 리스너 설정
        this.setupEventListeners();
    }

    /**
     * CSS 스타일 주입
     */
    injectStyles() {
        const styleId = 'layoutEditorToolbarStyles';
        
        // 이미 존재하면 리턴
        if (document.getElementById(styleId)) {
            return;
        }

        const styles = `
            <style id="${styleId}">
                .layout-editor-toolbar {
                    background: #ffffff;
                    border-right: 1px solid #e0e0e0;
                    padding: 20px 15px;
                    overflow-y: auto;
                    height: 100%;
                }

                .toolbar-section {
                    margin-bottom: 25px;
                }

                .toolbar-section h4 {
                    margin: 0 0 10px 0;
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .toolbar-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    padding: 12px 15px;
                    margin-bottom: 8px;
                    background: #f8f9fa;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 14px;
                    color: #333;
                }

                .toolbar-btn:hover {
                    background: #e9ecef;
                    border-color: #4a90e2;
                    transform: translateY(-2px);
                    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.2);
                }

                .toolbar-btn:active {
                    transform: translateY(0);
                }

                .toolbar-btn.active {
                    background: #4a90e2;
                    border-color: #4a90e2;
                    color: white;
                }

                .toolbar-btn .icon {
                    font-size: 20px;
                    margin-right: 10px;
                }

                .toolbar-btn .label {
                    font-weight: 500;
                }

                .toolbar-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .toolbar-btn:disabled:hover {
                    transform: none;
                    background: #f8f9fa;
                    border-color: #e0e0e0;
                    box-shadow: none;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 모든 toolbar 버튼
        const toolButtons = this.container.querySelectorAll('.toolbar-btn');
        
        toolButtons.forEach(button => {
            button.addEventListener('click', () => {
                const toolName = button.dataset.tool;
                this.handleToolClick(toolName, button);
            });
        });
    }

    /**
     * 도구 클릭 처리
     * @param {string} toolName - 도구 이름
     * @param {HTMLElement} button - 클릭된 버튼
     */
    handleToolClick(toolName, button) {
        console.log('[Toolbar] Tool clicked:', toolName);

        // 이전 활성 도구 비활성화
        if (this.activeTool) {
            const prevButton = this.container.querySelector(`[data-tool="${this.activeTool}"]`);
            if (prevButton) {
                prevButton.classList.remove('active');
            }
        }

        // 새 도구 활성화
        if (toolName !== 'clear') {
            this.activeTool = toolName;
            button.classList.add('active');
        }

        // 도구별 이벤트 발생
        const event = new CustomEvent('toolSelected', {
            detail: { toolName }
        });
        
        this.container.dispatchEvent(event);
    }

    /**
     * 도구 선택 이벤트 리스너 등록
     * @param {Function} callback - (toolName) => void
     */
    onToolSelect(callback) {
        this.container.addEventListener('toolSelected', (e) => {
            callback(e.detail.toolName);
        });
    }

    /**
     * 활성 도구 비활성화
     */
    deactivateCurrentTool() {
        if (this.activeTool) {
            const button = this.container.querySelector(`[data-tool="${this.activeTool}"]`);
            if (button) {
                button.classList.remove('active');
            }
            
            this.activeTool = null;
            console.log('[Toolbar] Current tool deactivated');
        }
    }

    /**
     * 도구 활성화
     * @param {string} toolName - 도구 이름
     */
    activateTool(toolName) {
        const button = this.container.querySelector(`[data-tool="${toolName}"]`);
        if (button) {
            button.click();
        }
    }

    /**
     * 도구 활성화/비활성화
     * @param {string} toolName - 도구 이름
     * @param {boolean} enabled - 활성화 여부
     */
    setToolEnabled(toolName, enabled) {
        const button = this.container.querySelector(`[data-tool="${toolName}"]`);
        if (button) {
            button.disabled = !enabled;
        }
    }

    /**
     * 현재 활성 도구 가져오기
     * @returns {string|null}
     */
    getActiveTool() {
        return this.activeTool;
    }
}

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toolbar;
}

// 브라우저 환경
if (typeof window !== 'undefined') {
    window.Toolbar = Toolbar;
}