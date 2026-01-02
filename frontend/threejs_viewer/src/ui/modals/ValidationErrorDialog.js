/**
 * ValidationErrorDialog.js
 * 
 * Layout 검증 실패 시 에러를 표시하는 Dialog UI
 * 문제 위치 강조, 자동 수정 옵션 제공
 * 
 * @module ValidationErrorDialog
 * @version 1.0.0 - Phase 3.3: 저장 프로세스 통합
 * 
 * 위치: frontend/threejs_viewer/src/components/dialogs/ValidationErrorDialog.js
 * 
 * 기능:
 * 1. 에러 목록 표시
 * 2. "문제 위치 표시" 버튼 → Canvas에서 해당 위치 하이라이트
 * 3. "자동 수정" 버튼 → LayoutValidator.autoFix() 호출
 * 4. "모두 자동 수정" 버튼 → 모든 에러 자동 수정 시도
 */

class ValidationErrorDialog {
    constructor(options = {}) {
        this.containerId = options.containerId || 'validation-error-dialog';
        this.onFocusError = options.onFocusError || null;
        this.onAutoFix = options.onAutoFix || null;
        this.onAutoFixAll = options.onAutoFixAll || null;
        this.onClose = options.onClose || null;
        this.onRetry = options.onRetry || null;
        
        this.dialogElement = null;
        this.errors = [];
        this.isVisible = false;
        
        console.log('[ValidationErrorDialog] ✅ Initialized v1.0.0');
    }

    /**
     * Dialog HTML 생성
     * @returns {string} HTML 문자열
     */
    createDialogHTML() {
        return `
            <div id="${this.containerId}" class="validation-dialog-overlay" style="display: none;">
                <div class="validation-dialog">
                    <div class="validation-dialog-header">
                        <span class="validation-dialog-icon">❌</span>
                        <h3>Layout 검증 실패</h3>
                        <button class="validation-dialog-close" title="닫기">&times;</button>
                    </div>
                    
                    <div class="validation-dialog-content">
                        <p class="validation-dialog-message">다음 오류를 수정하세요:</p>
                        
                        <div class="validation-error-list" id="validation-error-list">
                            <!-- 에러 항목들이 여기에 추가됨 -->
                        </div>
                    </div>
                    
                    <div class="validation-dialog-footer">
                        <button class="validation-btn validation-btn-primary" id="btn-auto-fix-all">
                            🔧 모두 자동 수정
                        </button>
                        <button class="validation-btn validation-btn-secondary" id="btn-manual-fix">
                            ✏️ 직접 수정
                        </button>
                        <button class="validation-btn validation-btn-outline" id="btn-cancel-validation">
                            취소
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Dialog 스타일 생성
     * @returns {string} CSS 문자열
     */
    createDialogStyles() {
        return `
            <style id="validation-dialog-styles">
                .validation-dialog-overlay {
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
                
                .validation-dialog {
                    background: #1e1e1e;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
                    max-width: 550px;
                    width: 90%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid #333;
                    animation: dialogSlideIn 0.2s ease-out;
                }
                
                @keyframes dialogSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .validation-dialog-header {
                    display: flex;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #333;
                    background: #252525;
                    border-radius: 12px 12px 0 0;
                }
                
                .validation-dialog-icon {
                    font-size: 24px;
                    margin-right: 12px;
                }
                
                .validation-dialog-header h3 {
                    margin: 0;
                    flex: 1;
                    font-size: 18px;
                    font-weight: 600;
                    color: #ff6b6b;
                }
                
                .validation-dialog-close {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0 8px;
                    line-height: 1;
                    transition: color 0.2s;
                }
                
                .validation-dialog-close:hover {
                    color: #fff;
                }
                
                .validation-dialog-content {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                }
                
                .validation-dialog-message {
                    margin: 0 0 16px 0;
                    color: #ccc;
                    font-size: 14px;
                }
                
                .validation-error-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .validation-error-item {
                    background: #2a2a2a;
                    border-radius: 8px;
                    padding: 12px 16px;
                    border-left: 4px solid #ff6b6b;
                }
                
                .validation-error-item.warning {
                    border-left-color: #ffc107;
                }
                
                .validation-error-item.info {
                    border-left-color: #17a2b8;
                }
                
                .validation-error-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                
                .validation-error-number {
                    background: #ff6b6b;
                    color: #fff;
                    font-size: 11px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 4px;
                    min-width: 20px;
                    text-align: center;
                }
                
                .validation-error-item.warning .validation-error-number {
                    background: #ffc107;
                    color: #000;
                }
                
                .validation-error-title {
                    flex: 1;
                    font-weight: 500;
                    color: #fff;
                    font-size: 14px;
                }
                
                .validation-error-details {
                    color: #aaa;
                    font-size: 13px;
                    margin-bottom: 10px;
                    padding-left: 28px;
                }
                
                .validation-error-location {
                    color: #888;
                    font-size: 12px;
                    font-family: monospace;
                    background: #1a1a1a;
                    padding: 4px 8px;
                    border-radius: 4px;
                    display: inline-block;
                    margin-bottom: 8px;
                    margin-left: 28px;
                }
                
                .validation-error-actions {
                    display: flex;
                    gap: 8px;
                    padding-left: 28px;
                }
                
                .validation-error-btn {
                    background: #333;
                    border: 1px solid #444;
                    color: #ccc;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .validation-error-btn:hover {
                    background: #444;
                    color: #fff;
                }
                
                .validation-error-btn.primary {
                    background: #4a9eff;
                    border-color: #4a9eff;
                    color: #fff;
                }
                
                .validation-error-btn.primary:hover {
                    background: #3a8eef;
                }
                
                .validation-dialog-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 20px;
                    border-top: 1px solid #333;
                    background: #252525;
                    border-radius: 0 0 12px 12px;
                }
                
                .validation-btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                
                .validation-btn-primary {
                    background: #4a9eff;
                    color: #fff;
                }
                
                .validation-btn-primary:hover {
                    background: #3a8eef;
                }
                
                .validation-btn-secondary {
                    background: #444;
                    color: #fff;
                }
                
                .validation-btn-secondary:hover {
                    background: #555;
                }
                
                .validation-btn-outline {
                    background: transparent;
                    border: 1px solid #444;
                    color: #ccc;
                }
                
                .validation-btn-outline:hover {
                    background: #333;
                    color: #fff;
                }
            </style>
        `;
    }

    /**
     * Dialog 초기화 (DOM에 추가)
     */
    init() {
        // 이미 존재하면 제거
        const existing = document.getElementById(this.containerId);
        if (existing) {
            existing.remove();
        }
        
        // 스타일 추가
        if (!document.getElementById('validation-dialog-styles')) {
            document.head.insertAdjacentHTML('beforeend', this.createDialogStyles());
        }
        
        // Dialog HTML 추가
        document.body.insertAdjacentHTML('beforeend', this.createDialogHTML());
        
        this.dialogElement = document.getElementById(this.containerId);
        
        // 이벤트 바인딩
        this.bindEvents();
        
        console.log('[ValidationErrorDialog] Dialog initialized');
    }

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        if (!this.dialogElement) return;
        
        // 닫기 버튼
        const closeBtn = this.dialogElement.querySelector('.validation-dialog-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // 모두 자동 수정 버튼
        const autoFixAllBtn = document.getElementById('btn-auto-fix-all');
        if (autoFixAllBtn) {
            autoFixAllBtn.addEventListener('click', () => {
                console.log('[ValidationErrorDialog] Auto fix all clicked');
                if (this.onAutoFixAll) {
                    this.onAutoFixAll(this.errors);
                }
            });
        }
        
        // 직접 수정 버튼
        const manualFixBtn = document.getElementById('btn-manual-fix');
        if (manualFixBtn) {
            manualFixBtn.addEventListener('click', () => {
                console.log('[ValidationErrorDialog] Manual fix clicked');
                this.hide();
                if (this.onClose) {
                    this.onClose('manual');
                }
            });
        }
        
        // 취소 버튼
        const cancelBtn = document.getElementById('btn-cancel-validation');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                console.log('[ValidationErrorDialog] Cancel clicked');
                this.hide();
                if (this.onClose) {
                    this.onClose('cancel');
                }
            });
        }
        
        // 오버레이 클릭으로 닫기
        this.dialogElement.addEventListener('click', (e) => {
            if (e.target === this.dialogElement) {
                this.hide();
            }
        });
        
        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * 에러 항목 HTML 생성
     * @param {Object} error - 에러 객체
     * @param {number} index - 에러 인덱스
     * @returns {string} HTML 문자열
     */
    createErrorItemHTML(error, index) {
        const severityClass = error.severity === 'warning' ? 'warning' : 
                             error.severity === 'info' ? 'info' : '';
        
        const locationText = error.location ? 
            `위치: (X: ${error.location.x?.toFixed(1) || '?'}, Z: ${error.location.z?.toFixed(1) || '?'})` : '';
        
        const detailsText = error.details || error.message || '';
        
        return `
            <div class="validation-error-item ${severityClass}" data-error-index="${index}">
                <div class="validation-error-header">
                    <span class="validation-error-number">${index + 1}</span>
                    <span class="validation-error-title">⚠️ ${error.rule || error.type || 'Error'}</span>
                </div>
                
                <div class="validation-error-details">${detailsText}</div>
                
                ${locationText ? `<div class="validation-error-location">${locationText}</div>` : ''}
                
                <div class="validation-error-actions">
                    <button class="validation-error-btn" data-action="focus" data-index="${index}">
                        📍 문제 위치 표시
                    </button>
                    ${error.autoFixable !== false ? `
                        <button class="validation-error-btn primary" data-action="autofix" data-index="${index}">
                            🔧 자동 수정
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * 에러 목록 렌더링
     * @param {Array} errors - 에러 배열
     */
    renderErrors(errors) {
        const listContainer = document.getElementById('validation-error-list');
        if (!listContainer) return;
        
        this.errors = errors;
        
        if (errors.length === 0) {
            listContainer.innerHTML = '<p style="color: #4caf50; text-align: center;">✅ 모든 검증을 통과했습니다!</p>';
            return;
        }
        
        const errorsHTML = errors.map((error, index) => 
            this.createErrorItemHTML(error, index)
        ).join('');
        
        listContainer.innerHTML = errorsHTML;
        
        // 개별 버튼 이벤트 바인딩
        listContainer.querySelectorAll('.validation-error-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const index = parseInt(e.target.dataset.index);
                const error = this.errors[index];
                
                if (action === 'focus' && this.onFocusError) {
                    console.log('[ValidationErrorDialog] Focus on error:', error);
                    this.onFocusError(error, index);
                } else if (action === 'autofix' && this.onAutoFix) {
                    console.log('[ValidationErrorDialog] Auto fix error:', error);
                    this.onAutoFix(error, index);
                }
            });
        });
    }

    /**
     * Dialog 표시
     * @param {Array} errors - 표시할 에러 배열
     */
    show(errors = []) {
        if (!this.dialogElement) {
            this.init();
        }
        
        this.renderErrors(errors);
        this.dialogElement.style.display = 'flex';
        this.isVisible = true;
        
        console.log(`[ValidationErrorDialog] Showing ${errors.length} errors`);
    }

    /**
     * Dialog 숨김
     */
    hide() {
        if (this.dialogElement) {
            this.dialogElement.style.display = 'none';
        }
        this.isVisible = false;
        
        console.log('[ValidationErrorDialog] Hidden');
    }

    /**
     * 특정 에러 항목 제거 (자동 수정 후)
     * @param {number} index - 에러 인덱스
     */
    removeError(index) {
        if (index >= 0 && index < this.errors.length) {
            this.errors.splice(index, 1);
            this.renderErrors(this.errors);
            
            // 모든 에러 수정 완료 시
            if (this.errors.length === 0) {
                setTimeout(() => {
                    this.hide();
                    if (this.onRetry) {
                        this.onRetry();
                    }
                }, 1000);
            }
        }
    }

    /**
     * 에러 항목 업데이트
     * @param {number} index - 에러 인덱스
     * @param {Object} updatedError - 업데이트된 에러 객체
     */
    updateError(index, updatedError) {
        if (index >= 0 && index < this.errors.length) {
            this.errors[index] = updatedError;
            this.renderErrors(this.errors);
        }
    }

    /**
     * Dialog 제거
     */
    destroy() {
        if (this.dialogElement) {
            this.dialogElement.remove();
            this.dialogElement = null;
        }
        
        const styles = document.getElementById('validation-dialog-styles');
        if (styles) {
            styles.remove();
        }
        
        console.log('[ValidationErrorDialog] Destroyed');
    }
}

// Singleton 인스턴스 생성
const validationErrorDialog = new ValidationErrorDialog();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.validationErrorDialog = validationErrorDialog;
    window.ValidationErrorDialog = ValidationErrorDialog;
}

// ES Module export
export default validationErrorDialog;
export { ValidationErrorDialog };