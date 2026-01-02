/**
 * SaveSuccessDialog.js
 * 
 * Layout 저장 성공 시 표시하는 Dialog UI
 * 버전 정보, 백업 정보, 다음 액션 제안
 * 
 * @module SaveSuccessDialog
 * @version 1.0.0 - Phase 3.3: 저장 프로세스 통합
 * 
 * 위치: frontend/threejs_viewer/src/components/dialogs/SaveSuccessDialog.js
 */

class SaveSuccessDialog {
    constructor(options = {}) {
        this.containerId = options.containerId || 'save-success-dialog';
        this.onGoTo3DViewer = options.onGoTo3DViewer || null;
        this.onContinueEdit = options.onContinueEdit || null;
        this.onViewChanges = options.onViewChanges || null;
        this.onClose = options.onClose || null;
        
        this.dialogElement = null;
        this.isVisible = false;
        
        console.log('[SaveSuccessDialog] ✅ Initialized v1.0.0');
    }

    /**
     * Dialog HTML 생성
     * @returns {string} HTML 문자열
     */
    createDialogHTML() {
        return `
            <div id="${this.containerId}" class="save-dialog-overlay" style="display: none;">
                <div class="save-dialog">
                    <div class="save-dialog-header success">
                        <span class="save-dialog-icon">✅</span>
                        <h3>Layout 저장 완료</h3>
                        <button class="save-dialog-close" title="닫기">&times;</button>
                    </div>
                    
                    <div class="save-dialog-content">
                        <div class="save-info-section">
                            <div class="save-info-item">
                                <span class="save-info-label">파일:</span>
                                <span class="save-info-value" id="save-filename">-</span>
                            </div>
                            <div class="save-info-item">
                                <span class="save-info-label">버전:</span>
                                <span class="save-info-value" id="save-version">-</span>
                            </div>
                            <div class="save-info-item">
                                <span class="save-info-label">설비 개수:</span>
                                <span class="save-info-value" id="save-equipment-count">-</span>
                            </div>
                            <div class="save-info-item">
                                <span class="save-info-label">저장 시각:</span>
                                <span class="save-info-value" id="save-timestamp">-</span>
                            </div>
                        </div>
                        
                        <div class="save-backup-section" id="save-backup-section" style="display: none;">
                            <div class="save-backup-info">
                                <span class="save-backup-icon">📦</span>
                                <span>백업 생성됨: <strong id="save-backup-filename">-</strong></span>
                            </div>
                        </div>
                        
                        <div class="save-changelog-section" id="save-changelog-section" style="display: none;">
                            <h4>변경사항</h4>
                            <div class="save-changelog-content" id="save-changelog-content">
                                <!-- 변경 내역 -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="save-dialog-footer">
                        <button class="save-btn save-btn-primary" id="btn-goto-3d-viewer">
                            🎮 3D Viewer로 이동
                        </button>
                        <button class="save-btn save-btn-secondary" id="btn-continue-edit">
                            ✏️ 계속 편집
                        </button>
                        <button class="save-btn save-btn-outline" id="btn-close-save-dialog">
                            닫기
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
            <style id="save-dialog-styles">
                .save-dialog-overlay {
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
                
                .save-dialog {
                    background: #1e1e1e;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
                    max-width: 480px;
                    width: 90%;
                    border: 1px solid #333;
                    animation: saveDialogSlideIn 0.2s ease-out;
                }
                
                @keyframes saveDialogSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                
                .save-dialog-header {
                    display: flex;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #333;
                    border-radius: 12px 12px 0 0;
                }
                
                .save-dialog-header.success {
                    background: linear-gradient(135deg, #1a3a1a, #1e1e1e);
                }
                
                .save-dialog-icon {
                    font-size: 28px;
                    margin-right: 12px;
                }
                
                .save-dialog-header h3 {
                    margin: 0;
                    flex: 1;
                    font-size: 18px;
                    font-weight: 600;
                    color: #4caf50;
                }
                
                .save-dialog-close {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0 8px;
                    line-height: 1;
                    transition: color 0.2s;
                }
                
                .save-dialog-close:hover {
                    color: #fff;
                }
                
                .save-dialog-content {
                    padding: 20px;
                }
                
                .save-info-section {
                    background: #252525;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                
                .save-info-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #333;
                }
                
                .save-info-item:last-child {
                    border-bottom: none;
                }
                
                .save-info-label {
                    color: #888;
                    font-size: 14px;
                }
                
                .save-info-value {
                    color: #fff;
                    font-size: 14px;
                    font-weight: 500;
                }
                
                .save-backup-section {
                    background: #2a3a2a;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                    border: 1px solid #3a5a3a;
                }
                
                .save-backup-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #8bc34a;
                    font-size: 13px;
                }
                
                .save-backup-icon {
                    font-size: 16px;
                }
                
                .save-changelog-section {
                    margin-top: 16px;
                }
                
                .save-changelog-section h4 {
                    margin: 0 0 12px 0;
                    color: #ccc;
                    font-size: 14px;
                    font-weight: 500;
                }
                
                .save-changelog-content {
                    background: #252525;
                    border-radius: 8px;
                    padding: 12px 16px;
                    max-height: 150px;
                    overflow-y: auto;
                }
                
                .save-changelog-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 6px 0;
                    color: #aaa;
                    font-size: 13px;
                }
                
                .save-changelog-item::before {
                    content: '•';
                    color: #4caf50;
                }
                
                .save-dialog-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 20px;
                    border-top: 1px solid #333;
                    background: #252525;
                    border-radius: 0 0 12px 12px;
                }
                
                .save-btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                
                .save-btn-primary {
                    background: #4caf50;
                    color: #fff;
                }
                
                .save-btn-primary:hover {
                    background: #43a047;
                }
                
                .save-btn-secondary {
                    background: #444;
                    color: #fff;
                }
                
                .save-btn-secondary:hover {
                    background: #555;
                }
                
                .save-btn-outline {
                    background: transparent;
                    border: 1px solid #444;
                    color: #ccc;
                }
                
                .save-btn-outline:hover {
                    background: #333;
                    color: #fff;
                }
            </style>
        `;
    }

    /**
     * Dialog 초기화
     */
    init() {
        // 이미 존재하면 제거
        const existing = document.getElementById(this.containerId);
        if (existing) {
            existing.remove();
        }
        
        // 스타일 추가
        if (!document.getElementById('save-dialog-styles')) {
            document.head.insertAdjacentHTML('beforeend', this.createDialogStyles());
        }
        
        // Dialog HTML 추가
        document.body.insertAdjacentHTML('beforeend', this.createDialogHTML());
        
        this.dialogElement = document.getElementById(this.containerId);
        
        // 이벤트 바인딩
        this.bindEvents();
        
        console.log('[SaveSuccessDialog] Dialog initialized');
    }

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        if (!this.dialogElement) return;
        
        // 닫기 버튼
        const closeBtn = this.dialogElement.querySelector('.save-dialog-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // 3D Viewer로 이동
        const goto3DBtn = document.getElementById('btn-goto-3d-viewer');
        if (goto3DBtn) {
            goto3DBtn.addEventListener('click', () => {
                this.hide();
                if (this.onGoTo3DViewer) {
                    this.onGoTo3DViewer();
                }
            });
        }
        
        // 계속 편집
        const continueBtn = document.getElementById('btn-continue-edit');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.hide();
                if (this.onContinueEdit) {
                    this.onContinueEdit();
                }
            });
        }
        
        // 닫기
        const closeDialogBtn = document.getElementById('btn-close-save-dialog');
        if (closeDialogBtn) {
            closeDialogBtn.addEventListener('click', () => {
                this.hide();
                if (this.onClose) {
                    this.onClose();
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
     * Dialog 표시
     * @param {Object} saveInfo - 저장 정보
     */
    show(saveInfo = {}) {
        if (!this.dialogElement) {
            this.init();
        }
        
        // 정보 업데이트
        this.updateInfo(saveInfo);
        
        this.dialogElement.style.display = 'flex';
        this.isVisible = true;
        
        console.log('[SaveSuccessDialog] Showing save success');
    }

    /**
     * 저장 정보 업데이트
     * @param {Object} saveInfo - 저장 정보
     */
    updateInfo(saveInfo) {
        // 파일명
        const filenameEl = document.getElementById('save-filename');
        if (filenameEl) {
            filenameEl.textContent = saveInfo.filename || saveInfo.siteId + '.json' || '-';
        }
        
        // 버전
        const versionEl = document.getElementById('save-version');
        if (versionEl) {
            versionEl.textContent = `v${saveInfo.version || saveInfo.layoutVersion || 1}`;
        }
        
        // 설비 개수
        const countEl = document.getElementById('save-equipment-count');
        if (countEl) {
            countEl.textContent = `${saveInfo.equipmentCount || '-'}개`;
        }
        
        // 저장 시각
        const timestampEl = document.getElementById('save-timestamp');
        if (timestampEl) {
            const now = new Date();
            timestampEl.textContent = now.toLocaleString('ko-KR');
        }
        
        // 백업 정보
        const backupSection = document.getElementById('save-backup-section');
        const backupFilename = document.getElementById('save-backup-filename');
        if (backupSection && saveInfo.backupFilename) {
            backupSection.style.display = 'block';
            if (backupFilename) {
                backupFilename.textContent = saveInfo.backupFilename;
            }
        } else if (backupSection) {
            backupSection.style.display = 'none';
        }
        
        // 변경 내역
        const changelogSection = document.getElementById('save-changelog-section');
        const changelogContent = document.getElementById('save-changelog-content');
        if (changelogSection && saveInfo.changeLog && saveInfo.changeLog.length > 0) {
            changelogSection.style.display = 'block';
            if (changelogContent) {
                changelogContent.innerHTML = saveInfo.changeLog.map(change => 
                    `<div class="save-changelog-item">${change}</div>`
                ).join('');
            }
        } else if (changelogSection) {
            changelogSection.style.display = 'none';
        }
    }

    /**
     * Dialog 숨김
     */
    hide() {
        if (this.dialogElement) {
            this.dialogElement.style.display = 'none';
        }
        this.isVisible = false;
        
        console.log('[SaveSuccessDialog] Hidden');
    }

    /**
     * Dialog 제거
     */
    destroy() {
        if (this.dialogElement) {
            this.dialogElement.remove();
            this.dialogElement = null;
        }
        
        const styles = document.getElementById('save-dialog-styles');
        if (styles) {
            styles.remove();
        }
        
        console.log('[SaveSuccessDialog] Destroyed');
    }
}

// Singleton 인스턴스 생성
const saveSuccessDialog = new SaveSuccessDialog();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.saveSuccessDialog = saveSuccessDialog;
    window.SaveSuccessDialog = SaveSuccessDialog;
}

// ES Module export
export default saveSuccessDialog;
export { SaveSuccessDialog };