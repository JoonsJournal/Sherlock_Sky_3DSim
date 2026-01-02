/**
 * TemplateDialog.js
 * Template 저장을 위한 Modal Dialog UI
 * 
 * 파일 위치: frontend/threejs_viewer/src/layout_editor/components/TemplateDialog.js
 * 
 * @version 1.0.0 - Phase 3.4: Template Manager 구현
 * 
 * 주요 기능:
 * 1. show(layoutData) - Dialog 표시
 * 2. hide() - Dialog 숨김
 * 3. Template 이름/설명 입력 폼
 * 4. 실시간 유효성 검사
 * 5. 중복 경고 및 덮어쓰기 옵션
 * 
 * 콜백:
 * - onSave(templateName, description, options) - 저장 시 호출
 * - onCancel() - 취소 시 호출
 */

(function() {
    'use strict';

    class TemplateDialog {
        /**
         * @param {Object} options - 설정 옵션
         * @param {Function} options.onSave - 저장 콜백
         * @param {Function} options.onCancel - 취소 콜백
         * @param {string} options.containerId - Dialog 컨테이너 ID
         */
        constructor(options = {}) {
            this.options = {
                containerId: options.containerId || 'template-dialog-container',
                onSave: options.onSave || (() => {}),
                onCancel: options.onCancel || (() => {})
            };
            
            // 상태
            this.isVisible = false;
            this.currentLayoutData = null;
            this.validationTimer = null;
            
            // DOM 요소 참조
            this.elements = {
                overlay: null,
                dialog: null,
                nameInput: null,
                descInput: null,
                errorMessage: null,
                saveButton: null,
                cancelButton: null,
                overwriteCheckbox: null,
                previewSection: null
            };
            
            // TemplateManager 참조
            this.templateManager = window.templateManager || null;
            
            console.log('[TemplateDialog] ✅ Instance created v1.0.0');
        }

        /**
         * Dialog 초기화 (DOM 생성)
         */
        init() {
            this.createDialogDOM();
            this.bindEvents();
            console.log('[TemplateDialog] Initialized');
        }

        /**
         * Dialog DOM 생성
         * @private
         */
        createDialogDOM() {
            // 컨테이너 찾기 또는 생성
            let container = document.getElementById(this.options.containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = this.options.containerId;
                document.body.appendChild(container);
            }
            
            // Dialog HTML
            container.innerHTML = `
                <div id="template-dialog-overlay" class="template-dialog-overlay" style="display: none;">
                    <div id="template-dialog" class="template-dialog">
                        <!-- Header -->
                        <div class="template-dialog-header">
                            <h3>📋 Save as Template</h3>
                            <button id="template-dialog-close" class="dialog-close-btn" title="Close">×</button>
                        </div>
                        
                        <!-- Content -->
                        <div class="template-dialog-content">
                            <!-- Template Name -->
                            <div class="form-group">
                                <label for="template-name-input">
                                    Template Name <span class="required">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    id="template-name-input" 
                                    class="form-input"
                                    placeholder="Enter template name (e.g., My Custom Layout)"
                                    maxlength="50"
                                    autocomplete="off"
                                >
                                <div id="template-name-error" class="error-message"></div>
                                <div class="input-hint">2-50 characters, no special characters</div>
                            </div>
                            
                            <!-- Description -->
                            <div class="form-group">
                                <label for="template-desc-input">Description</label>
                                <textarea 
                                    id="template-desc-input" 
                                    class="form-textarea"
                                    placeholder="Optional: Describe this template..."
                                    rows="3"
                                    maxlength="200"
                                ></textarea>
                                <div class="input-hint char-count">
                                    <span id="desc-char-count">0</span>/200
                                </div>
                            </div>
                            
                            <!-- Overwrite Option -->
                            <div id="overwrite-section" class="form-group overwrite-section" style="display: none;">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="template-overwrite-checkbox">
                                    <span class="checkbox-text">Overwrite existing template</span>
                                </label>
                                <div class="warning-message">
                                    ⚠️ A template with this name already exists
                                </div>
                            </div>
                            
                            <!-- Preview -->
                            <div id="template-preview" class="template-preview">
                                <div class="preview-title">Preview</div>
                                <div class="preview-content">
                                    <div class="preview-item">
                                        <span class="preview-label">File name:</span>
                                        <span id="preview-filename" class="preview-value">-</span>
                                    </div>
                                    <div class="preview-item">
                                        <span class="preview-label">Equipment:</span>
                                        <span id="preview-equipment" class="preview-value">-</span>
                                    </div>
                                    <div class="preview-item">
                                        <span class="preview-label">Based on:</span>
                                        <span id="preview-based-on" class="preview-value">-</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Footer -->
                        <div class="template-dialog-footer">
                            <button id="template-cancel-btn" class="btn btn-secondary">
                                Cancel
                            </button>
                            <button id="template-save-btn" class="btn btn-primary" disabled>
                                💾 Save Template
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // 요소 참조 저장
            this.elements.overlay = document.getElementById('template-dialog-overlay');
            this.elements.dialog = document.getElementById('template-dialog');
            this.elements.nameInput = document.getElementById('template-name-input');
            this.elements.descInput = document.getElementById('template-desc-input');
            this.elements.errorMessage = document.getElementById('template-name-error');
            this.elements.saveButton = document.getElementById('template-save-btn');
            this.elements.cancelButton = document.getElementById('template-cancel-btn');
            this.elements.closeButton = document.getElementById('template-dialog-close');
            this.elements.overwriteCheckbox = document.getElementById('template-overwrite-checkbox');
            this.elements.overwriteSection = document.getElementById('overwrite-section');
            this.elements.previewFilename = document.getElementById('preview-filename');
            this.elements.previewEquipment = document.getElementById('preview-equipment');
            this.elements.previewBasedOn = document.getElementById('preview-based-on');
            this.elements.descCharCount = document.getElementById('desc-char-count');
            
            // 스타일 추가
            this.addStyles();
            
            console.log('[TemplateDialog] DOM created');
        }

        /**
         * 스타일 추가
         * @private
         */
        addStyles() {
            if (document.getElementById('template-dialog-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'template-dialog-styles';
            style.textContent = `
                /* Overlay */
                .template-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(2px);
                }
                
                /* Dialog */
                .template-dialog {
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    width: 450px;
                    max-width: 90vw;
                    max-height: 90vh;
                    overflow: hidden;
                    animation: dialogSlideIn 0.3s ease-out;
                }
                
                @keyframes dialogSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                /* Header */
                .template-dialog-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .template-dialog-header h3 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .dialog-close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                }
                
                .dialog-close-btn:hover {
                    opacity: 1;
                }
                
                /* Content */
                .template-dialog-content {
                    padding: 20px;
                }
                
                /* Form Group */
                .form-group {
                    margin-bottom: 16px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: #333;
                    font-size: 14px;
                }
                
                .required {
                    color: #e74c3c;
                }
                
                /* Input */
                .form-input,
                .form-textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-sizing: border-box;
                }
                
                .form-input:focus,
                .form-textarea:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                
                .form-input.error {
                    border-color: #e74c3c;
                }
                
                .form-input.valid {
                    border-color: #27ae60;
                }
                
                .form-textarea {
                    resize: vertical;
                    min-height: 60px;
                }
                
                /* Hints & Errors */
                .input-hint {
                    font-size: 12px;
                    color: #888;
                    margin-top: 4px;
                }
                
                .char-count {
                    text-align: right;
                }
                
                .error-message {
                    font-size: 12px;
                    color: #e74c3c;
                    margin-top: 4px;
                    min-height: 16px;
                }
                
                /* Overwrite Section */
                .overwrite-section {
                    background: #fff3cd;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #ffc107;
                }
                
                .checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }
                
                .checkbox-text {
                    font-size: 14px;
                    color: #333;
                }
                
                .warning-message {
                    font-size: 12px;
                    color: #856404;
                    margin-top: 8px;
                }
                
                /* Preview */
                .template-preview {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 12px;
                    margin-top: 16px;
                }
                
                .preview-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .preview-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                    font-size: 13px;
                }
                
                .preview-label {
                    color: #666;
                }
                
                .preview-value {
                    color: #333;
                    font-weight: 500;
                    font-family: 'Consolas', monospace;
                }
                
                /* Footer */
                .template-dialog-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px 20px;
                    background: #f8f9fa;
                    border-top: 1px solid #e0e0e0;
                }
                
                /* Buttons */
                .btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
                
                .btn-primary:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                
                .btn-secondary {
                    background: #e0e0e0;
                    color: #333;
                }
                
                .btn-secondary:hover {
                    background: #d0d0d0;
                }
            `;
            
            document.head.appendChild(style);
        }

        /**
         * 이벤트 바인딩
         * @private
         */
        bindEvents() {
            // 이름 입력 - 실시간 유효성 검사
            this.elements.nameInput.addEventListener('input', (e) => {
                this.onNameInput(e.target.value);
            });
            
            // 설명 입력 - 글자 수 카운트
            this.elements.descInput.addEventListener('input', (e) => {
                this.elements.descCharCount.textContent = e.target.value.length;
            });
            
            // 덮어쓰기 체크박스
            this.elements.overwriteCheckbox.addEventListener('change', (e) => {
                this.updateSaveButtonState();
            });
            
            // 저장 버튼
            this.elements.saveButton.addEventListener('click', () => {
                this.onSave();
            });
            
            // 취소 버튼
            this.elements.cancelButton.addEventListener('click', () => {
                this.hide();
                this.options.onCancel();
            });
            
            // 닫기 버튼
            this.elements.closeButton.addEventListener('click', () => {
                this.hide();
                this.options.onCancel();
            });
            
            // Overlay 클릭 시 닫기
            this.elements.overlay.addEventListener('click', (e) => {
                if (e.target === this.elements.overlay) {
                    this.hide();
                    this.options.onCancel();
                }
            });
            
            // ESC 키로 닫기
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.hide();
                    this.options.onCancel();
                }
            });
            
            // Enter 키로 저장
            this.elements.nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !this.elements.saveButton.disabled) {
                    this.onSave();
                }
            });
            
            console.log('[TemplateDialog] Events bound');
        }

        /**
         * 이름 입력 처리
         * @private
         */
        onNameInput(value) {
            // 디바운스
            clearTimeout(this.validationTimer);
            this.validationTimer = setTimeout(() => {
                this.validateAndUpdateUI(value);
            }, 300);
            
            // 즉시 프리뷰 업데이트
            this.updatePreview(value);
        }

        /**
         * 유효성 검사 및 UI 업데이트
         * @private
         */
        validateAndUpdateUI(name) {
            if (!this.templateManager) {
                console.warn('[TemplateDialog] TemplateManager not available');
                return;
            }
            
            // 빈 값 처리
            if (!name || name.trim() === '') {
                this.elements.nameInput.classList.remove('valid', 'error');
                this.elements.errorMessage.textContent = '';
                this.elements.overwriteSection.style.display = 'none';
                this.elements.saveButton.disabled = true;
                return;
            }
            
            // 유효성 검사
            const validation = this.templateManager.validateTemplateName(name);
            
            if (!validation.valid) {
                this.elements.nameInput.classList.remove('valid');
                this.elements.nameInput.classList.add('error');
                this.elements.errorMessage.textContent = validation.message;
                this.elements.overwriteSection.style.display = 'none';
                this.elements.saveButton.disabled = true;
                return;
            }
            
            // 중복 확인
            const exists = this.templateManager.checkTemplateExists(name);
            
            if (exists) {
                this.elements.nameInput.classList.remove('valid');
                this.elements.nameInput.classList.add('error');
                this.elements.errorMessage.textContent = '';
                this.elements.overwriteSection.style.display = 'block';
                this.elements.overwriteCheckbox.checked = false;
                this.elements.saveButton.disabled = true;
            } else {
                this.elements.nameInput.classList.remove('error');
                this.elements.nameInput.classList.add('valid');
                this.elements.errorMessage.textContent = '';
                this.elements.overwriteSection.style.display = 'none';
                this.elements.saveButton.disabled = false;
            }
        }

        /**
         * 저장 버튼 상태 업데이트
         * @private
         */
        updateSaveButtonState() {
            const name = this.elements.nameInput.value.trim();
            
            if (!name) {
                this.elements.saveButton.disabled = true;
                return;
            }
            
            if (this.elements.overwriteSection.style.display === 'block') {
                // 덮어쓰기 필요한 경우
                this.elements.saveButton.disabled = !this.elements.overwriteCheckbox.checked;
            }
        }

        /**
         * 프리뷰 업데이트
         * @private
         */
        updatePreview(name) {
            if (!name || name.trim() === '') {
                this.elements.previewFilename.textContent = '-';
                return;
            }
            
            // 파일명 생성
            const templateId = name
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '')
                .substring(0, 30);
            
            this.elements.previewFilename.textContent = `${templateId}.json`;
        }

        /**
         * 저장 처리
         * @private
         */
        onSave() {
            const name = this.elements.nameInput.value.trim();
            const description = this.elements.descInput.value.trim();
            const overwrite = this.elements.overwriteCheckbox.checked;
            
            console.log('[TemplateDialog] Save requested:', { name, description, overwrite });
            
            // 콜백 호출
            this.options.onSave(name, description, { overwrite });
            
            // Dialog 닫기
            this.hide();
        }

        /**
         * Dialog 표시
         * @param {Object} layoutData - 현재 Layout 데이터
         */
        show(layoutData) {
            this.currentLayoutData = layoutData;
            
            // 입력 필드 초기화
            this.elements.nameInput.value = '';
            this.elements.descInput.value = '';
            this.elements.nameInput.classList.remove('valid', 'error');
            this.elements.errorMessage.textContent = '';
            this.elements.overwriteSection.style.display = 'none';
            this.elements.overwriteCheckbox.checked = false;
            this.elements.saveButton.disabled = true;
            this.elements.descCharCount.textContent = '0';
            
            // 프리뷰 초기화
            this.elements.previewFilename.textContent = '-';
            
            // Equipment 수
            let equipmentCount = 0;
            if (layoutData.statistics?.totalEquipment) {
                equipmentCount = layoutData.statistics.totalEquipment;
            } else if (layoutData.equipmentArrays) {
                layoutData.equipmentArrays.forEach(array => {
                    const rows = array.rows || 26;
                    const cols = array.cols || 6;
                    const excluded = array.excludedPositions?.length || 0;
                    equipmentCount += (rows * cols) - excluded;
                });
            }
            this.elements.previewEquipment.textContent = `${equipmentCount} units`;
            
            // Based on
            const basedOn = layoutData.template_source || layoutData.site_id || 'custom';
            this.elements.previewBasedOn.textContent = basedOn;
            
            // Dialog 표시
            this.elements.overlay.style.display = 'flex';
            this.isVisible = true;
            
            // 이름 입력에 포커스
            setTimeout(() => {
                this.elements.nameInput.focus();
            }, 100);
            
            console.log('[TemplateDialog] Shown');
        }

        /**
         * Dialog 숨김
         */
        hide() {
            this.elements.overlay.style.display = 'none';
            this.isVisible = false;
            this.currentLayoutData = null;
            
            console.log('[TemplateDialog] Hidden');
        }

        /**
         * Dialog 제거
         */
        destroy() {
            const container = document.getElementById(this.options.containerId);
            if (container) {
                container.innerHTML = '';
            }
            
            const styles = document.getElementById('template-dialog-styles');
            if (styles) {
                styles.remove();
            }
            
            console.log('[TemplateDialog] Destroyed');
        }
    }

    // Export for modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TemplateDialog;
    }

    // Global export for browser
    if (typeof window !== 'undefined') {
        window.TemplateDialog = TemplateDialog;
        console.log('[TemplateDialog] ✅ Class loaded globally');
    }

})();