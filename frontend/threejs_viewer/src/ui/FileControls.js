/**
 * FileControls.js
 * 
 * 파일 저장/불러오기 UI 컴포넌트
 * - 저장 버튼 (JSON 다운로드)
 * - 불러오기 버튼 (파일 선택)
 * - 드래그앤드롭 영역
 * - 최근 파일 목록
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/ui/FileControls.js
 */

import { eventBus } from '../core/managers/EventBus.js';
import { mappingFileManager } from '../services/mapping/MappingFileManager.js';

/**
 * FileControls
 * 
 * 파일 관리 UI 컴포넌트
 */
class FileControls {
    /**
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement|string} options.container - 컨테이너 요소 또는 선택자
     * @param {Object} options.fileManager - MappingFileManager 인스턴스 (선택)
     * @param {boolean} options.showDropZone - 드래그앤드롭 영역 표시 (기본: true)
     * @param {boolean} options.showRecentFiles - 최근 파일 목록 표시 (기본: true)
     * @param {string} options.position - 위치 ('fixed', 'inline', 'custom')
     * @param {string} options.theme - 테마 ('dark', 'light')
     * @param {Function} options.onExport - 내보내기 콜백
     * @param {Function} options.onImport - 가져오기 콜백
     * @param {number} options.zIndex - z-index 값
     */
    constructor(options = {}) {
        this._options = {
            container: options.container || document.body,
            fileManager: options.fileManager || mappingFileManager,
            showDropZone: options.showDropZone ?? true,
            showRecentFiles: options.showRecentFiles ?? true,
            position: options.position || 'inline',
            theme: options.theme || 'dark',
            onExport: options.onExport || null,
            onImport: options.onImport || null,
            zIndex: options.zIndex || 1000,
            offsetX: options.offsetX || 20,
            offsetY: options.offsetY || 20
        };

        // DOM 요소
        this._element = null;
        this._dropZone = null;
        this._recentFilesPanel = null;
        this._fileInput = null;

        // 상태
        this._isExpanded = false;
        this._isDragging = false;
        this._dropZoneHandler = null;

        // 스타일 주입
        this._injectStyles();

        // 초기화
        this._createElement();
        this._bindEvents();

        console.log('✅ FileControls initialized');
    }

    // =========================================================================
    // 스타일 주입
    // =========================================================================

    /**
     * 스타일 주입
     * @private
     */
    _injectStyles() {
        const styleId = 'file-controls-styles';
        
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* ===== File Controls Base ===== */
            .file-controls {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
            }

            .file-controls--dark {
                --fc-bg: rgba(30, 30, 30, 0.95);
                --fc-bg-hover: rgba(40, 40, 40, 0.98);
                --fc-border: rgba(255, 255, 255, 0.1);
                --fc-border-hover: rgba(255, 255, 255, 0.2);
                --fc-text: #e5e5e5;
                --fc-text-muted: #9ca3af;
                --fc-primary: #3b82f6;
                --fc-success: #22c55e;
                --fc-warning: #f59e0b;
                --fc-danger: #ef4444;
            }

            .file-controls--light {
                --fc-bg: rgba(255, 255, 255, 0.95);
                --fc-bg-hover: rgba(245, 245, 245, 0.98);
                --fc-border: rgba(0, 0, 0, 0.1);
                --fc-border-hover: rgba(0, 0, 0, 0.2);
                --fc-text: #1f2937;
                --fc-text-muted: #6b7280;
                --fc-primary: #2563eb;
                --fc-success: #16a34a;
                --fc-warning: #d97706;
                --fc-danger: #dc2626;
            }

            .file-controls--fixed {
                position: fixed;
                z-index: var(--fc-z-index, 1000);
            }

            /* ===== Main Panel ===== */
            .file-controls__panel {
                background: var(--fc-bg);
                border: 1px solid var(--fc-border);
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                min-width: 280px;
            }

            .file-controls__header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--fc-border);
            }

            .file-controls__title {
                font-size: 16px;
                font-weight: 600;
                color: var(--fc-text);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .file-controls__close {
                background: none;
                border: none;
                color: var(--fc-text-muted);
                cursor: pointer;
                padding: 4px;
                font-size: 18px;
                line-height: 1;
                transition: color 0.2s;
            }

            .file-controls__close:hover {
                color: var(--fc-text);
            }

            /* ===== Button Group ===== */
            .file-controls__buttons {
                display: flex;
                gap: 10px;
                margin-bottom: 16px;
            }

            .file-controls__btn {
                flex: 1;
                padding: 12px 16px;
                font-size: 14px;
                font-weight: 500;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .file-controls__btn--save {
                background: var(--fc-success);
                border: none;
                color: white;
            }

            .file-controls__btn--save:hover {
                background: #16a34a;
                transform: translateY(-1px);
            }

            .file-controls__btn--load {
                background: var(--fc-primary);
                border: none;
                color: white;
            }

            .file-controls__btn--load:hover {
                background: #2563eb;
                transform: translateY(-1px);
            }

            .file-controls__btn:active {
                transform: translateY(0);
            }

            .file-controls__btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }

            /* ===== Drop Zone ===== */
            .file-controls__drop-zone {
                border: 2px dashed var(--fc-border);
                border-radius: 10px;
                padding: 24px;
                text-align: center;
                transition: all 0.3s ease;
                margin-bottom: 16px;
                cursor: pointer;
            }

            .file-controls__drop-zone:hover {
                border-color: var(--fc-primary);
                background: rgba(59, 130, 246, 0.05);
            }

            .file-controls__drop-zone.drag-over {
                border-color: var(--fc-success);
                background: rgba(34, 197, 94, 0.1);
                border-style: solid;
            }

            .file-controls__drop-zone-icon {
                font-size: 36px;
                margin-bottom: 8px;
            }

            .file-controls__drop-zone-text {
                color: var(--fc-text-muted);
                font-size: 13px;
            }

            .file-controls__drop-zone-text strong {
                color: var(--fc-primary);
            }

            /* ===== Recent Files ===== */
            .file-controls__recent {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid var(--fc-border);
            }

            .file-controls__recent-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
            }

            .file-controls__recent-title {
                font-size: 12px;
                font-weight: 600;
                color: var(--fc-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .file-controls__recent-clear {
                font-size: 11px;
                color: var(--fc-text-muted);
                background: none;
                border: none;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .file-controls__recent-clear:hover {
                background: rgba(239, 68, 68, 0.1);
                color: var(--fc-danger);
            }

            .file-controls__recent-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 150px;
                overflow-y: auto;
            }

            .file-controls__recent-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 10px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s;
            }

            .file-controls__recent-item:hover {
                background: rgba(255, 255, 255, 0.08);
            }

            .file-controls__recent-icon {
                font-size: 16px;
                flex-shrink: 0;
            }

            .file-controls__recent-icon--export {
                color: var(--fc-success);
            }

            .file-controls__recent-icon--import {
                color: var(--fc-primary);
            }

            .file-controls__recent-info {
                flex: 1;
                min-width: 0;
            }

            .file-controls__recent-name {
                font-size: 12px;
                color: var(--fc-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .file-controls__recent-meta {
                font-size: 10px;
                color: var(--fc-text-muted);
            }

            .file-controls__recent-empty {
                text-align: center;
                padding: 20px;
                color: var(--fc-text-muted);
                font-size: 12px;
            }

            /* ===== Status Message ===== */
            .file-controls__status {
                padding: 10px;
                border-radius: 6px;
                font-size: 12px;
                margin-top: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .file-controls__status--success {
                background: rgba(34, 197, 94, 0.1);
                color: var(--fc-success);
            }

            .file-controls__status--error {
                background: rgba(239, 68, 68, 0.1);
                color: var(--fc-danger);
            }

            .file-controls__status--info {
                background: rgba(59, 130, 246, 0.1);
                color: var(--fc-primary);
            }

            /* ===== Toggle Button (for fixed position) ===== */
            .file-controls__toggle {
                position: fixed;
                padding: 12px 16px;
                background: var(--fc-bg);
                border: 1px solid var(--fc-border);
                border-radius: 8px;
                color: var(--fc-text);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                transition: all 0.2s;
                z-index: var(--fc-z-index, 1000);
            }

            .file-controls__toggle:hover {
                background: var(--fc-bg-hover);
                border-color: var(--fc-border-hover);
            }

            /* ===== Hidden File Input ===== */
            .file-controls__file-input {
                display: none;
            }

            /* ===== Animations ===== */
            @keyframes fc-slide-in {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .file-controls__panel {
                animation: fc-slide-in 0.3s ease;
            }

            /* ===== Import Preview ===== */
            .file-controls__preview {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 12px;
                margin-top: 12px;
            }

            .file-controls__preview-title {
                font-size: 12px;
                font-weight: 600;
                color: var(--fc-text-muted);
                margin-bottom: 8px;
            }

            .file-controls__preview-row {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                padding: 4px 0;
            }

            .file-controls__preview-label {
                color: var(--fc-text-muted);
            }

            .file-controls__preview-value {
                color: var(--fc-text);
                font-weight: 500;
            }

            .file-controls__preview-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }

            .file-controls__preview-btn {
                flex: 1;
                padding: 8px 12px;
                font-size: 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .file-controls__preview-btn--apply {
                background: var(--fc-success);
                border: none;
                color: white;
            }

            .file-controls__preview-btn--cancel {
                background: transparent;
                border: 1px solid var(--fc-border);
                color: var(--fc-text-muted);
            }
        `;

        document.head.appendChild(styles);
    }

    // =========================================================================
    // DOM 생성
    // =========================================================================

    /**
     * DOM 요소 생성
     * @private
     */
    _createElement() {
        const container = typeof this._options.container === 'string'
            ? document.querySelector(this._options.container)
            : this._options.container;

        if (!container) {
            console.error('[FileControls] Container not found');
            return;
        }

        // 메인 요소 생성
        this._element = document.createElement('div');
        this._element.className = `file-controls file-controls--${this._options.theme}`;
        
        if (this._options.position === 'fixed') {
            this._element.classList.add('file-controls--fixed');
            this._element.style.setProperty('--fc-z-index', this._options.zIndex);
        }

        // Hidden file input
        this._fileInput = document.createElement('input');
        this._fileInput.type = 'file';
        this._fileInput.accept = '.json,application/json';
        this._fileInput.className = 'file-controls__file-input';
        this._element.appendChild(this._fileInput);

        // 패널 생성
        this._element.innerHTML += this._buildPanelHTML();

        // 드롭존 참조
        this._dropZone = this._element.querySelector('.file-controls__drop-zone');
        this._recentFilesPanel = this._element.querySelector('.file-controls__recent-list');

        // DOM에 추가
        container.appendChild(this._element);

        // 최근 파일 목록 렌더링
        this._renderRecentFiles();

        // 드롭존 핸들러 설정
        if (this._options.showDropZone && this._dropZone) {
            this._dropZoneHandler = this._options.fileManager.setupDropZone(this._dropZone, {
                onDragEnter: () => this._isDragging = true,
                onDragLeave: () => this._isDragging = false,
                onDrop: (result, file) => this._handleDropResult(result, file),
                apply: false  // 먼저 미리보기 표시
            });
        }
    }

    /**
     * 패널 HTML 빌드
     * @private
     */
    _buildPanelHTML() {
        return `
            <div class="file-controls__panel">
                <div class="file-controls__header">
                    <span class="file-controls__title">
                        📁 파일 관리
                    </span>
                </div>

                <div class="file-controls__buttons">
                    <button class="file-controls__btn file-controls__btn--save" data-action="save">
                        💾 저장
                    </button>
                    <button class="file-controls__btn file-controls__btn--load" data-action="load">
                        📂 불러오기
                    </button>
                </div>

                ${this._options.showDropZone ? `
                    <div class="file-controls__drop-zone" data-action="drop-zone">
                        <div class="file-controls__drop-zone-icon">📄</div>
                        <div class="file-controls__drop-zone-text">
                            파일을 여기에 드래그하거나<br>
                            <strong>클릭하여 선택</strong>
                        </div>
                    </div>
                ` : ''}

                <div class="file-controls__status-container"></div>

                ${this._options.showRecentFiles ? `
                    <div class="file-controls__recent">
                        <div class="file-controls__recent-header">
                            <span class="file-controls__recent-title">최근 파일</span>
                            <button class="file-controls__recent-clear" data-action="clear-recent">
                                지우기
                            </button>
                        </div>
                        <div class="file-controls__recent-list"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // =========================================================================
    // 이벤트 바인딩
    // =========================================================================

    /**
     * 이벤트 바인딩
     * @private
     */
    _bindEvents() {
        // 버튼 클릭
        this._element.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;

            switch (action) {
                case 'save':
                    this._handleSave();
                    break;
                case 'load':
                    this._handleLoad();
                    break;
                case 'drop-zone':
                    this._fileInput.click();
                    break;
                case 'clear-recent':
                    this._handleClearRecent();
                    break;
                case 'apply-import':
                    this._handleApplyImport();
                    break;
                case 'cancel-import':
                    this._handleCancelImport();
                    break;
            }
        });

        // File input change
        this._fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this._handleFileSelected(file);
            }
            // Reset input
            this._fileInput.value = '';
        });

        // EventBus 이벤트 구독
        eventBus.on('mapping:file-exported', () => this._renderRecentFiles());
        eventBus.on('mapping:file-imported', () => this._renderRecentFiles());
    }

    // =========================================================================
    // 액션 핸들러
    // =========================================================================

    /**
     * 저장 처리
     * @private
     */
    _handleSave() {
        try {
            const result = this._options.fileManager.export({
                siteId: this._getSiteId(),
                siteName: this._getSiteName()
            });

            this._showStatus('success', `💾 저장 완료: ${result.filename}`);

            if (this._options.onExport) {
                this._options.onExport(result);
            }
        } catch (error) {
            this._showStatus('error', `❌ 저장 실패: ${error.message}`);
        }
    }

    /**
     * 불러오기 처리
     * @private
     */
    async _handleLoad() {
        try {
            const result = await this._options.fileManager.openFileDialog();
            
            if (result.success) {
                this._showImportPreview(result);
            } else {
                if (result.validation) {
                    this._showStatus('error', `❌ 검증 실패: ${result.validation.errors[0]}`);
                }
            }
        } catch (error) {
            this._showStatus('error', `❌ 불러오기 실패: ${error.message}`);
        }
    }

    /**
     * 파일 선택 처리
     * @private
     */
    async _handleFileSelected(file) {
        try {
            const result = await this._options.fileManager.importFromFile(file);
            
            if (result.success) {
                this._showImportPreview(result);
            } else {
                this._showStatus('error', `❌ 검증 실패: ${result.message}`);
            }
        } catch (error) {
            this._showStatus('error', `❌ 파일 처리 실패: ${error.message}`);
        }
    }

    /**
     * 드롭 결과 처리
     * @private
     */
    _handleDropResult(result, file) {
        this._isDragging = false;
        
        if (result.success) {
            this._showImportPreview(result);
        } else {
            this._showStatus('error', `❌ 파일 처리 실패: ${result.error || result.message}`);
        }
    }

    /**
     * Import 미리보기 표시
     * @private
     */
    _showImportPreview(result) {
        // 기존 미리보기 제거
        const existingPreview = this._element.querySelector('.file-controls__preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        // 임시 저장
        this._pendingImportData = result.data;

        const preview = this._options.fileManager.getFilePreview(result.data);
        const previewHTML = `
            <div class="file-controls__preview">
                <div class="file-controls__preview-title">📋 파일 미리보기</div>
                <div class="file-controls__preview-row">
                    <span class="file-controls__preview-label">사이트</span>
                    <span class="file-controls__preview-value">${preview.siteName || preview.siteId}</span>
                </div>
                <div class="file-controls__preview-row">
                    <span class="file-controls__preview-label">매핑 수</span>
                    <span class="file-controls__preview-value">${preview.mappingCount}개</span>
                </div>
                <div class="file-controls__preview-row">
                    <span class="file-controls__preview-label">완료율</span>
                    <span class="file-controls__preview-value">${preview.completionRate || 0}%</span>
                </div>
                ${preview.createdAt ? `
                    <div class="file-controls__preview-row">
                        <span class="file-controls__preview-label">생성일</span>
                        <span class="file-controls__preview-value">${new Date(preview.createdAt).toLocaleDateString()}</span>
                    </div>
                ` : ''}
                ${preview.warnings.length > 0 ? `
                    <div class="file-controls__status file-controls__status--info" style="margin-top: 8px;">
                        ⚠️ ${preview.warnings[0]}
                    </div>
                ` : ''}
                <div class="file-controls__preview-actions">
                    <button class="file-controls__preview-btn file-controls__preview-btn--cancel" data-action="cancel-import">
                        취소
                    </button>
                    <button class="file-controls__preview-btn file-controls__preview-btn--apply" data-action="apply-import">
                        적용
                    </button>
                </div>
            </div>
        `;

        const container = this._element.querySelector('.file-controls__status-container');
        container.innerHTML = previewHTML;
    }

    /**
     * Import 적용
     * @private
     */
    _handleApplyImport() {
        if (!this._pendingImportData) return;

        try {
            const result = this._options.fileManager.applyImportedData(this._pendingImportData, {
                mergeStrategy: 'replace'
            });

            this._showStatus('success', `✅ 적용 완료: ${result.afterCount}개 매핑`);

            if (this._options.onImport) {
                this._options.onImport(result);
            }
        } catch (error) {
            this._showStatus('error', `❌ 적용 실패: ${error.message}`);
        }

        this._pendingImportData = null;
    }

    /**
     * Import 취소
     * @private
     */
    _handleCancelImport() {
        this._pendingImportData = null;
        const container = this._element.querySelector('.file-controls__status-container');
        container.innerHTML = '';
    }

    /**
     * 최근 파일 지우기
     * @private
     */
    _handleClearRecent() {
        this._options.fileManager.clearRecentFiles();
        this._renderRecentFiles();
    }

    // =========================================================================
    // 최근 파일 렌더링
    // =========================================================================

    /**
     * 최근 파일 목록 렌더링
     * @private
     */
    _renderRecentFiles() {
        if (!this._recentFilesPanel) return;

        const recentFiles = this._options.fileManager.getRecentFiles();

        if (recentFiles.length === 0) {
            this._recentFilesPanel.innerHTML = `
                <div class="file-controls__recent-empty">
                    최근 파일 없음
                </div>
            `;
            return;
        }

        this._recentFilesPanel.innerHTML = recentFiles.map(file => `
            <div class="file-controls__recent-item" title="${file.filename}">
                <span class="file-controls__recent-icon file-controls__recent-icon--${file.action}">
                    ${file.action === 'export' ? '📤' : '📥'}
                </span>
                <div class="file-controls__recent-info">
                    <div class="file-controls__recent-name">${file.filename}</div>
                    <div class="file-controls__recent-meta">
                        ${file.mappingCount}개 · ${this._formatTimeAgo(file.timestamp)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // =========================================================================
    // 유틸리티
    // =========================================================================

    /**
     * 상태 메시지 표시
     * @private
     */
    _showStatus(type, message) {
        const container = this._element.querySelector('.file-controls__status-container');
        
        container.innerHTML = `
            <div class="file-controls__status file-controls__status--${type}">
                ${message}
            </div>
        `;

        // 3초 후 자동 제거
        setTimeout(() => {
            const status = container.querySelector('.file-controls__status');
            if (status && !status.classList.contains('file-controls__preview')) {
                status.remove();
            }
        }, 3000);
    }

    /**
     * 시간 경과 텍스트
     * @private
     */
    _formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        
        if (seconds < 60) return '방금 전';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
        return `${Math.floor(seconds / 86400)}일 전`;
    }

    /**
     * 사이트 ID 가져오기
     * @private
     */
    _getSiteId() {
        // URL 파라미터에서 가져오기
        const params = new URLSearchParams(window.location.search);
        return params.get('siteId') || 'default_site';
    }

    /**
     * 사이트 이름 가져오기
     * @private
     */
    _getSiteName() {
        return 'Korea Site 1';  // 실제로는 설정에서 가져오기
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * 컴포넌트 표시
     */
    show() {
        if (this._element) {
            this._element.style.display = 'block';
        }
    }

    /**
     * 컴포넌트 숨김
     */
    hide() {
        if (this._element) {
            this._element.style.display = 'none';
        }
    }

    /**
     * 표시/숨김 토글
     */
    toggle() {
        if (this._element) {
            const isVisible = this._element.style.display !== 'none';
            this._element.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * 프로그래매틱 저장
     * @param {Object} options - 저장 옵션
     */
    save(options = {}) {
        return this._options.fileManager.export(options);
    }

    /**
     * 프로그래매틱 불러오기
     */
    async load() {
        return this._handleLoad();
    }

    /**
     * FileManager 설정
     * @param {Object} fileManager - MappingFileManager 인스턴스
     */
    setFileManager(fileManager) {
        this._options.fileManager = fileManager;
    }

    /**
     * DOM 요소 반환
     */
    getElement() {
        return this._element;
    }

    /**
     * 리소스 정리
     */
    destroy() {
        // 드롭존 핸들러 해제
        if (this._dropZoneHandler) {
            this._dropZoneHandler.destroy();
        }

        // DOM 제거
        if (this._element && this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }

        this._element = null;
        this._dropZone = null;
        this._recentFilesPanel = null;
        this._fileInput = null;

        console.log('[FileControls] destroyed');
    }
}

// Default export
export default FileControls;

// Named export
export { FileControls };

// 전역 등록
if (typeof window !== 'undefined') {
    window.FileControls = FileControls;
}

console.log('✅ FileControls.js v1.0.0 로드 완료');