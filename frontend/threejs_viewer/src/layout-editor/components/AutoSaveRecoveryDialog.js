/**
 * AutoSaveRecoveryDialog.js
 * =========================
 * AutoSave 복구 확인 Dialog
 * 
 * BaseModal 패턴 적용 (전역 스크립트 방식)
 * 
 * @version 1.0.0
 * @phase 5.2
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/components/AutoSaveRecoveryDialog.js
 */

class AutoSaveRecoveryDialog {
    /**
     * @param {Object} options - 옵션
     * @param {string} options.timestamp - 저장 시간 문자열
     * @param {string} options.timeAgo - "N분 전" 형식 문자열
     * @param {number} options.changeCount - 변경 횟수
     * @param {Function} options.onRecover - 복구 버튼 클릭 시 콜백
     * @param {Function} options.onDiscard - 삭제 버튼 클릭 시 콜백
     */
    constructor(options = {}) {
        this.id = 'autosave-recovery-dialog';
        this.options = options;
        this.element = null;
        this.isOpen = false;
        
        this._boundEscHandler = this._handleEsc.bind(this);
    }
    
    /**
     * Dialog 열기
     */
    open() {
        if (this.isOpen) return this;
        
        // 기존 Dialog 제거
        this._removeExisting();
        
        // Dialog 생성
        this.element = this._createElement();
        document.body.appendChild(this.element);
        
        // 이벤트 등록
        this._attachEventListeners();
        
        // ESC 핸들러 등록
        document.addEventListener('keydown', this._boundEscHandler);
        
        // 스크롤 방지
        document.body.style.overflow = 'hidden';
        
        this.isOpen = true;
        console.log('[AutoSaveRecoveryDialog] 열림');
        
        return this;
    }
    
    /**
     * Dialog 닫기
     */
    close() {
        if (!this.isOpen) return this;
        
        // ESC 핸들러 제거
        document.removeEventListener('keydown', this._boundEscHandler);
        
        // 스크롤 복원
        document.body.style.overflow = '';
        
        // 요소 제거
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        this.isOpen = false;
        console.log('[AutoSaveRecoveryDialog] 닫힘');
        
        return this;
    }
    
    /**
     * 기존 Dialog 제거
     * @private
     */
    _removeExisting() {
        const existing = document.getElementById(this.id);
        if (existing) {
            existing.remove();
        }
    }
    
    /**
     * Dialog 요소 생성
     * @private
     */
    _createElement() {
        const { timestamp, timeAgo, changeCount } = this.options;
        
        const container = document.createElement('div');
        container.id = this.id;
        container.className = 'modal-overlay';
        container.innerHTML = `
            <style>
                #${this.id} {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.2s ease;
                }
                #${this.id} .dialog-content {
                    background: #2a2a2a;
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 420px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                    animation: slideUp 0.3s ease;
                    color: #fff;
                }
                #${this.id} .dialog-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                #${this.id} .dialog-icon {
                    font-size: 28px;
                }
                #${this.id} .dialog-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #fff;
                }
                #${this.id} .dialog-desc {
                    margin: 0 0 12px 0;
                    color: #aaa;
                    font-size: 14px;
                }
                #${this.id} .dialog-info {
                    background: #3a3a3a;
                    padding: 12px 16px;
                    border-radius: 6px;
                    margin-bottom: 16px;
                    font-size: 13px;
                    color: #ccc;
                }
                #${this.id} .dialog-info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                }
                #${this.id} .dialog-info-row span:last-child {
                    font-weight: 500;
                    color: #fff;
                }
                #${this.id} .dialog-question {
                    margin: 0 0 20px 0;
                    color: #ccc;
                    font-size: 14px;
                }
                #${this.id} .dialog-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }
                #${this.id} .btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                #${this.id} .btn-secondary {
                    background: #444;
                    border: 1px solid #555;
                    color: #fff;
                }
                #${this.id} .btn-secondary:hover {
                    background: #555;
                }
                #${this.id} .btn-primary {
                    background: #4CAF50;
                    border: none;
                    color: white;
                }
                #${this.id} .btn-primary:hover {
                    background: #45a049;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
            <div class="dialog-content">
                <div class="dialog-header">
                    <span class="dialog-icon">💾</span>
                    <h3 class="dialog-title">저장되지 않은 작업 발견</h3>
                </div>
                <p class="dialog-desc">이전에 저장되지 않은 작업이 있습니다.</p>
                <div class="dialog-info">
                    <div class="dialog-info-row">
                        <span>📅 저장 시간</span>
                        <span>${timestamp}</span>
                    </div>
                    <div class="dialog-info-row">
                        <span>⏱️ 경과</span>
                        <span>${timeAgo}</span>
                    </div>
                    <div class="dialog-info-row">
                        <span>📝 변경 횟수</span>
                        <span>${changeCount}회</span>
                    </div>
                </div>
                <p class="dialog-question">복구하시겠습니까?</p>
                <div class="dialog-buttons">
                    <button class="btn btn-secondary" data-action="discard">삭제</button>
                    <button class="btn btn-primary" data-action="recover">복구</button>
                </div>
            </div>
        `;
        
        return container;
    }
    
    /**
     * 이벤트 리스너 등록
     * @private
     */
    _attachEventListeners() {
        // 복구 버튼
        const recoverBtn = this.element.querySelector('[data-action="recover"]');
        if (recoverBtn) {
            recoverBtn.addEventListener('click', () => {
                this.close();
                if (this.options.onRecover) {
                    this.options.onRecover();
                }
            });
        }
        
        // 삭제 버튼
        const discardBtn = this.element.querySelector('[data-action="discard"]');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                this.close();
                if (this.options.onDiscard) {
                    this.options.onDiscard();
                }
            });
        }
        
        // 오버레이 클릭 시 닫기 (선택적)
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                // 오버레이 클릭 시 아무 동작 안 함 (강제 선택 필요)
            }
        });
    }
    
    /**
     * ESC 키 핸들러
     * @private
     */
    _handleEsc(event) {
        if (event.key === 'Escape' && this.isOpen) {
            // ESC 시 삭제로 처리
            this.close();
            if (this.options.onDiscard) {
                this.options.onDiscard();
            }
        }
    }
    
    /**
     * 정적 메서드: Dialog 표시
     * @param {Object} options
     * @returns {AutoSaveRecoveryDialog}
     */
    static show(options) {
        const dialog = new AutoSaveRecoveryDialog(options);
        return dialog.open();
    }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.AutoSaveRecoveryDialog = AutoSaveRecoveryDialog;
}

console.log('✅ AutoSaveRecoveryDialog.js 로드 완료');