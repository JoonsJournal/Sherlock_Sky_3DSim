/**
 * EquipmentArrayDialog.js
 * 
 * Equipment Array 생성을 위한 설정 Dialog UI
 * 
 * @module EquipmentArrayDialog
 * @version 1.0.0
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/components/EquipmentArrayDialog.js
 */

class EquipmentArrayDialog {
    constructor() {
        this.dialog = null;
        this.onCreateCallback = null;
        this.onCancelCallback = null;
        this.excludedPositions = [];

        this.createDialog();
        
        console.log('[EquipmentArrayDialog] Initialized');
    }

    /**
     * Dialog HTML 생성
     */
    createDialog() {
        // Dialog 컨테이너
        const dialogHTML = `
            <div id="equipmentArrayDialog" class="equipment-array-dialog" style="display: none;">
                <div class="dialog-overlay"></div>
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>⚙️ Equipment Array 설정</h3>
                        <button class="dialog-close-btn" id="equipArrayDialogClose">&times;</button>
                    </div>
                    
                    <div class="dialog-body">
                        <!-- 배열 크기 -->
                        <div class="form-section">
                            <h4>배열 크기</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="equipArrayRows">Rows (행):</label>
                                    <input type="number" id="equipArrayRows" value="26" min="1" max="50">
                                </div>
                                <div class="form-group">
                                    <label for="equipArrayCols">Cols (열):</label>
                                    <input type="number" id="equipArrayCols" value="6" min="1" max="20">
                                </div>
                            </div>
                        </div>

                        <!-- 설비 크기 -->
                        <div class="form-section">
                            <h4>설비 크기 (m)</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="equipArrayWidth">Width:</label>
                                    <input type="number" id="equipArrayWidth" value="1.5" min="0.5" max="10" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label for="equipArrayDepth">Depth:</label>
                                    <input type="number" id="equipArrayDepth" value="3.0" min="0.5" max="10" step="0.1">
                                </div>
                            </div>
                        </div>

                        <!-- 간격 -->
                        <div class="form-section">
                            <h4>간격</h4>
                            <div class="form-group">
                                <label for="equipArraySpacing">Spacing (m):</label>
                                <input type="number" id="equipArraySpacing" value="0.5" min="0" max="5" step="0.1">
                            </div>
                        </div>

                        <!-- 복도 설정 (열) -->
                        <div class="form-section">
                            <h4>복도 설정 (열 방향)</h4>
                            <div class="form-group">
                                <label for="equipArrayCorridorCols">Corridor Cols (예: 2, 4):</label>
                                <input type="text" id="equipArrayCorridorCols" value="2, 4" 
                                       placeholder="쉼표로 구분">
                            </div>
                            <div class="form-group">
                                <label for="equipArrayCorridorColWidth">Corridor Width (Col, m):</label>
                                <input type="number" id="equipArrayCorridorColWidth" value="1.2" 
                                       min="0" max="10" step="0.1">
                            </div>
                        </div>

                        <!-- 복도 설정 (행) -->
                        <div class="form-section">
                            <h4>복도 설정 (행 방향)</h4>
                            <div class="form-group">
                                <label for="equipArrayCorridorRows">Corridor Rows (예: 13):</label>
                                <input type="text" id="equipArrayCorridorRows" value="13" 
                                       placeholder="쉼표로 구분">
                            </div>
                            <div class="form-group">
                                <label for="equipArrayCorridorRowWidth">Corridor Width (Row, m):</label>
                                <input type="number" id="equipArrayCorridorRowWidth" value="2.0" 
                                       min="0" max="10" step="0.1">
                            </div>
                        </div>

                        <!-- 제외 위치 -->
                        <div class="form-section">
                            <h4>제외 위치</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="equipArrayExcludeRow">Row:</label>
                                    <input type="number" id="equipArrayExcludeRow" min="0" placeholder="0-25">
                                </div>
                                <div class="form-group">
                                    <label for="equipArrayExcludeCol">Col:</label>
                                    <input type="number" id="equipArrayExcludeCol" min="0" placeholder="0-5">
                                </div>
                                <div class="form-group">
                                    <button type="button" id="equipArrayExcludeAdd" class="btn-secondary">
                                        Add
                                    </button>
                                </div>
                            </div>
                            <div id="equipArrayExcludedList" class="excluded-list">
                                <!-- 제외 위치 목록 -->
                            </div>
                        </div>
                    </div>

                    <div class="dialog-footer">
                        <button type="button" id="equipArrayCreate" class="btn-primary">
                            Create Array
                        </button>
                        <button type="button" id="equipArrayCancel" class="btn-secondary">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Body에 추가
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHTML;
        document.body.appendChild(tempDiv.firstElementChild);

        this.dialog = document.getElementById('equipmentArrayDialog');

        // 스타일 추가
        this.injectStyles();

        // 이벤트 리스너 설정
        this.setupEventListeners();
    }

    /**
     * CSS 스타일 주입
     */
    injectStyles() {
        const styleId = 'equipmentArrayDialogStyles';
        
        // 이미 존재하면 리턴
        if (document.getElementById(styleId)) {
            return;
        }

        const styles = `
            <style id="${styleId}">
                .equipment-array-dialog {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dialog-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                }

                .dialog-content {
                    position: relative;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    z-index: 1;
                }

                .dialog-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .dialog-header h3 {
                    margin: 0;
                    font-size: 20px;
                    color: #333;
                }

                .dialog-close-btn {
                    background: none;
                    border: none;
                    font-size: 28px;
                    color: #999;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dialog-close-btn:hover {
                    color: #333;
                }

                .dialog-body {
                    padding: 20px;
                }

                .form-section {
                    margin-bottom: 20px;
                }

                .form-section h4 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                    color: #555;
                    border-bottom: 1px solid #e0e0e0;
                    padding-bottom: 5px;
                }

                .form-row {
                    display: flex;
                    gap: 15px;
                    align-items: flex-end;
                }

                .form-group {
                    flex: 1;
                    margin-bottom: 10px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-size: 14px;
                    color: #666;
                }

                .form-group input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: #4a90e2;
                }

                .excluded-list {
                    margin-top: 10px;
                    max-height: 150px;
                    overflow-y: auto;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    padding: 10px;
                }

                .excluded-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 10px;
                    background: #f5f5f5;
                    border-radius: 4px;
                    margin-bottom: 5px;
                }

                .excluded-item span {
                    font-size: 14px;
                    color: #333;
                }

                .excluded-item button {
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 4px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .excluded-item button:hover {
                    background: #c0392b;
                }

                .dialog-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 20px;
                    border-top: 1px solid #e0e0e0;
                }

                .btn-primary {
                    background: #4a90e2;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                }

                .btn-primary:hover {
                    background: #357abd;
                }

                .btn-secondary {
                    background: #95a5a6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }

                .btn-secondary:hover {
                    background: #7f8c8d;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // Close 버튼
        document.getElementById('equipArrayDialogClose').addEventListener('click', () => {
            this.hide();
            if (this.onCancelCallback) {
                this.onCancelCallback();
            }
        });

        // Overlay 클릭으로 닫기
        this.dialog.querySelector('.dialog-overlay').addEventListener('click', () => {
            this.hide();
            if (this.onCancelCallback) {
                this.onCancelCallback();
            }
        });

        // Exclude Add 버튼
        document.getElementById('equipArrayExcludeAdd').addEventListener('click', () => {
            this.addExcludedPosition();
        });

        // Create 버튼
        document.getElementById('equipArrayCreate').addEventListener('click', () => {
            const config = this.getConfig();
            this.hide();
            
            if (this.onCreateCallback) {
                this.onCreateCallback(config);
            }
        });

        // Cancel 버튼
        document.getElementById('equipArrayCancel').addEventListener('click', () => {
            this.hide();
            
            if (this.onCancelCallback) {
                this.onCancelCallback();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dialog.style.display !== 'none') {
                this.hide();
                if (this.onCancelCallback) {
                    this.onCancelCallback();
                }
            }
        });
    }

    /**
     * 제외 위치 추가
     */
    addExcludedPosition() {
        const row = parseInt(document.getElementById('equipArrayExcludeRow').value);
        const col = parseInt(document.getElementById('equipArrayExcludeCol').value);

        if (isNaN(row) || isNaN(col)) {
            alert('유효한 Row와 Col 값을 입력하세요.');
            return;
        }

        // 중복 확인
        const exists = this.excludedPositions.some(pos => pos.row === row && pos.col === col);
        if (exists) {
            alert('이미 추가된 위치입니다.');
            return;
        }

        this.excludedPositions.push({ row, col });
        this.renderExcludedList();

        // 입력 필드 초기화
        document.getElementById('equipArrayExcludeRow').value = '';
        document.getElementById('equipArrayExcludeCol').value = '';

        console.log('[EquipmentArrayDialog] Added excluded position:', { row, col });
    }

    /**
     * 제외 위치 목록 렌더링
     */
    renderExcludedList() {
        const listContainer = document.getElementById('equipArrayExcludedList');
        
        if (this.excludedPositions.length === 0) {
            listContainer.innerHTML = '<p style="color: #999; font-size: 14px; margin: 0;">제외 위치 없음</p>';
            return;
        }

        listContainer.innerHTML = this.excludedPositions.map((pos, index) => `
            <div class="excluded-item">
                <span>• Row ${pos.row}, Col ${pos.col}</span>
                <button onclick="window.equipmentArrayDialog.removeExcludedPosition(${index})">
                    Delete
                </button>
            </div>
        `).join('');
    }

    /**
     * 제외 위치 제거
     * @param {number} index - 배열 인덱스
     */
    removeExcludedPosition(index) {
        this.excludedPositions.splice(index, 1);
        this.renderExcludedList();
        console.log('[EquipmentArrayDialog] Removed excluded position at index:', index);
    }

    /**
     * Dialog 표시
     * @param {Function} onCreateCallback - Create 버튼 클릭 시 콜백
     * @param {Function} onCancelCallback - Cancel 버튼 클릭 시 콜백
     */
    show(onCreateCallback, onCancelCallback) {
        this.onCreateCallback = onCreateCallback;
        this.onCancelCallback = onCancelCallback;

        // 초기화
        this.excludedPositions = [];
        this.renderExcludedList();

        this.dialog.style.display = 'flex';
        console.log('[EquipmentArrayDialog] Shown');
    }

    /**
     * Dialog 숨기기
     */
    hide() {
        this.dialog.style.display = 'none';
        console.log('[EquipmentArrayDialog] Hidden');
    }

    /**
     * 현재 설정 가져오기
     * @returns {Object} 배열 설정
     */
    getConfig() {
        const parseNumberArray = (str) => {
            return str.split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n));
        };

        const config = {
            rows: parseInt(document.getElementById('equipArrayRows').value),
            cols: parseInt(document.getElementById('equipArrayCols').value),
            equipmentSize: {
                width: parseFloat(document.getElementById('equipArrayWidth').value),
                depth: parseFloat(document.getElementById('equipArrayDepth').value)
            },
            spacing: parseFloat(document.getElementById('equipArraySpacing').value),
            corridorCols: parseNumberArray(document.getElementById('equipArrayCorridorCols').value),
            corridorColWidth: parseFloat(document.getElementById('equipArrayCorridorColWidth').value),
            corridorRows: parseNumberArray(document.getElementById('equipArrayCorridorRows').value),
            corridorRowWidth: parseFloat(document.getElementById('equipArrayCorridorRowWidth').value),
            excludedPositions: [...this.excludedPositions]
        };

        console.log('[EquipmentArrayDialog] Config retrieved:', config);
        return config;
    }

    /**
     * 설정 값 설정 (기존 설정 로드)
     * @param {Object} config - 배열 설정
     */
    setConfig(config) {
        document.getElementById('equipArrayRows').value = config.rows;
        document.getElementById('equipArrayCols').value = config.cols;
        document.getElementById('equipArrayWidth').value = config.equipmentSize.width;
        document.getElementById('equipArrayDepth').value = config.equipmentSize.depth;
        document.getElementById('equipArraySpacing').value = config.spacing;
        document.getElementById('equipArrayCorridorCols').value = config.corridorCols.join(', ');
        document.getElementById('equipArrayCorridorColWidth').value = config.corridorColWidth;
        document.getElementById('equipArrayCorridorRows').value = config.corridorRows.join(', ');
        document.getElementById('equipArrayCorridorRowWidth').value = config.corridorRowWidth;
        
        this.excludedPositions = [...config.excludedPositions];
        this.renderExcludedList();

        console.log('[EquipmentArrayDialog] Config set');
    }
}

// 전역 인스턴스 생성 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.equipmentArrayDialog = new EquipmentArrayDialog();
}

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EquipmentArrayDialog;
}