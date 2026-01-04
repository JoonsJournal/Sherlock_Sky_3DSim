/**
 * RecoveryDialog.js
 * 
 * AutoSave 복구 다이얼로그 UI 컴포넌트
 * - 페이지 로드 시 미저장 데이터 감지
 * - 복구/무시 선택 다이얼로그
 * - 데이터 미리보기
 * - 다중 namespace 복구 지원
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/ui/RecoveryDialog.js
 */

import { storageService } from '../core/storage/index.js';
import { eventBus } from '../core/managers/EventBus.js';
import { AUTOSAVE_KEYS, findKeysByPrefix, STORAGE_PREFIX } from '../core/storage/utils/StorageKeys.js';

/**
 * 네임스페이스별 설정
 */
const NAMESPACE_CONFIG = {
    layout: {
        icon: '📐',
        label: 'Layout Editor',
        description: '레이아웃 편집기 데이터',
        color: '#3b82f6'  // 파란색
    },
    equipment: {
        icon: '⚙️',
        label: 'Equipment Mapping',
        description: '설비 매핑 데이터',
        color: '#22c55e'  // 초록색
    },
    multisite: {
        icon: '🏭',
        label: 'Multi-site Config',
        description: '다중 사이트 설정',
        color: '#f59e0b'  // 주황색
    },
    simulation: {
        icon: '🎮',
        label: 'Simulation',
        description: '시뮬레이션 설정',
        color: '#8b5cf6'  // 보라색
    }
};

/**
 * RecoveryDialog
 * 
 * AutoSave 복구 데이터 처리 다이얼로그
 */
class RecoveryDialog {
    /**
     * @param {Object} options - 설정 옵션
     * @param {boolean} options.autoCheck - 생성 시 자동으로 복구 데이터 확인
     * @param {boolean} options.showPreview - 데이터 미리보기 표시 여부
     * @param {string[]} options.namespaces - 확인할 namespace 목록 (기본: 전체)
     * @param {Function} options.onRecover - 복구 선택 시 콜백
     * @param {Function} options.onDiscard - 무시 선택 시 콜백
     * @param {Function} options.onClose - 다이얼로그 닫힐 때 콜백
     * @param {number} options.zIndex - z-index 값
     */
    constructor(options = {}) {
        this._options = {
            autoCheck: options.autoCheck ?? true,
            showPreview: options.showPreview ?? true,
            namespaces: options.namespaces || ['layout', 'equipment', 'multisite', 'simulation'],
            onRecover: options.onRecover || null,
            onDiscard: options.onDiscard || null,
            onClose: options.onClose || null,
            zIndex: options.zIndex || 10000
        };

        // DOM 요소
        this._element = null;
        this._overlayElement = null;

        // 상태
        this._isOpen = false;
        this._recoveryItems = [];
        this._selectedItems = new Set();

        // 스타일 주입
        this._injectStyles();

        // 자동 확인
        if (this._options.autoCheck) {
            // DOM 로드 후 확인
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.checkAndShow());
            } else {
                // 약간의 지연 후 표시 (다른 초기화가 완료되도록)
                setTimeout(() => this.checkAndShow(), 500);
            }
        }
    }

    // =========================================================================
    // 스타일 주입
    // =========================================================================

    /**
     * 스타일 주입
     * @private
     */
    _injectStyles() {
        const styleId = 'recovery-dialog-styles';
        
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* ===== Recovery Dialog Overlay ===== */
            .recovery-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: var(--rd-z-index, 10000);
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }

            .recovery-dialog-overlay--visible {
                opacity: 1;
                visibility: visible;
            }

            /* ===== Dialog Container ===== */
            .recovery-dialog {
                background: #1e1e1e;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                max-width: 560px;
                width: 90%;
                max-height: 85vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                transform: translateY(20px) scale(0.95);
                transition: all 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .recovery-dialog-overlay--visible .recovery-dialog {
                transform: translateY(0) scale(1);
            }

            /* ===== Header ===== */
            .recovery-dialog__header {
                padding: 24px 24px 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .recovery-dialog__title {
                display: flex;
                align-items: center;
                gap: 12px;
                margin: 0 0 8px 0;
                font-size: 20px;
                font-weight: 600;
                color: #ffffff;
            }

            .recovery-dialog__title-icon {
                font-size: 28px;
            }

            .recovery-dialog__subtitle {
                color: #9ca3af;
                font-size: 14px;
                line-height: 1.5;
            }

            /* ===== Body ===== */
            .recovery-dialog__body {
                padding: 16px 24px;
                max-height: 400px;
                overflow-y: auto;
            }

            .recovery-dialog__body::-webkit-scrollbar {
                width: 6px;
            }

            .recovery-dialog__body::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
            }

            .recovery-dialog__body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }

            /* ===== Recovery Item ===== */
            .recovery-item {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                margin-bottom: 12px;
                overflow: hidden;
                transition: all 0.2s ease;
            }

            .recovery-item:last-child {
                margin-bottom: 0;
            }

            .recovery-item:hover {
                border-color: rgba(255, 255, 255, 0.15);
                background: rgba(255, 255, 255, 0.05);
            }

            .recovery-item--selected {
                border-color: var(--ri-color, #3b82f6);
                background: rgba(59, 130, 246, 0.1);
            }

            .recovery-item__header {
                display: flex;
                align-items: center;
                padding: 14px 16px;
                cursor: pointer;
                gap: 12px;
            }

            .recovery-item__checkbox {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }

            .recovery-item--selected .recovery-item__checkbox {
                background: var(--ri-color, #3b82f6);
                border-color: var(--ri-color, #3b82f6);
            }

            .recovery-item__checkbox-icon {
                color: white;
                font-size: 12px;
                font-weight: bold;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .recovery-item--selected .recovery-item__checkbox-icon {
                opacity: 1;
            }

            .recovery-item__icon {
                font-size: 24px;
                flex-shrink: 0;
            }

            .recovery-item__info {
                flex: 1;
                min-width: 0;
            }

            .recovery-item__label {
                font-size: 15px;
                font-weight: 500;
                color: #ffffff;
                margin-bottom: 4px;
            }

            .recovery-item__meta {
                display: flex;
                gap: 16px;
                font-size: 12px;
                color: #9ca3af;
            }

            .recovery-item__meta-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .recovery-item__toggle {
                padding: 4px 8px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 4px;
                color: #9ca3af;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }

            .recovery-item__toggle:hover {
                background: rgba(255, 255, 255, 0.15);
                color: #ffffff;
            }

            .recovery-item__toggle--expanded {
                background: rgba(59, 130, 246, 0.2);
                color: #93c5fd;
            }

            /* ===== Preview ===== */
            .recovery-item__preview {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
                background: rgba(0, 0, 0, 0.2);
            }

            .recovery-item__preview--expanded {
                max-height: 300px;
            }

            .recovery-item__preview-content {
                padding: 12px 16px;
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 11px;
                color: #d4d4d4;
                white-space: pre-wrap;
                word-break: break-all;
                max-height: 250px;
                overflow-y: auto;
            }

            .recovery-item__preview-content::-webkit-scrollbar {
                width: 4px;
            }

            .recovery-item__preview-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
            }

            /* ===== Summary Row ===== */
            .recovery-item__summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 12px;
                padding: 12px 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                background: rgba(0, 0, 0, 0.1);
            }

            .recovery-item__summary-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .recovery-item__summary-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #6b7280;
            }

            .recovery-item__summary-value {
                font-size: 13px;
                font-weight: 500;
                color: #e5e5e5;
            }

            /* ===== Footer ===== */
            .recovery-dialog__footer {
                display: flex;
                gap: 12px;
                padding: 16px 24px 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }

            .recovery-dialog__btn {
                flex: 1;
                padding: 12px 20px;
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

            .recovery-dialog__btn--discard {
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                color: #fca5a5;
            }

            .recovery-dialog__btn--discard:hover {
                background: rgba(239, 68, 68, 0.25);
                border-color: rgba(239, 68, 68, 0.5);
            }

            .recovery-dialog__btn--recover {
                background: rgba(34, 197, 94, 0.2);
                border: 1px solid rgba(34, 197, 94, 0.4);
                color: #86efac;
            }

            .recovery-dialog__btn--recover:hover {
                background: rgba(34, 197, 94, 0.3);
                border-color: rgba(34, 197, 94, 0.6);
            }

            .recovery-dialog__btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            /* ===== Select All ===== */
            .recovery-dialog__select-all {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                margin-bottom: 8px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .recovery-dialog__select-all:hover {
                background: rgba(255, 255, 255, 0.06);
            }

            .recovery-dialog__select-all-checkbox {
                width: 18px;
                height: 18px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }

            .recovery-dialog__select-all--checked .recovery-dialog__select-all-checkbox {
                background: #3b82f6;
                border-color: #3b82f6;
            }

            .recovery-dialog__select-all-label {
                font-size: 13px;
                color: #d4d4d4;
            }

            /* ===== Empty State ===== */
            .recovery-dialog__empty {
                text-align: center;
                padding: 40px 20px;
                color: #6b7280;
            }

            .recovery-dialog__empty-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }

            .recovery-dialog__empty-text {
                font-size: 14px;
            }

            /* ===== Animation ===== */
            @keyframes rd-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            .recovery-item__meta-badge {
                display: inline-flex;
                align-items: center;
                padding: 2px 8px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                background: rgba(245, 158, 11, 0.2);
                color: #fcd34d;
                border-radius: 10px;
                animation: rd-pulse 2s ease-in-out infinite;
            }
        `;

        document.head.appendChild(styles);
    }

    // =========================================================================
    // 복구 데이터 확인
    // =========================================================================

    /**
     * 복구 데이터 확인 및 필요시 다이얼로그 표시
     * @returns {boolean} 복구 데이터 존재 여부
     */
    checkAndShow() {
        const items = this.findRecoveryItems();
        
        if (items.length > 0) {
            this._recoveryItems = items;
            this.show();
            return true;
        }
        
        return false;
    }

    /**
     * 복구 가능한 아이템 찾기
     * @returns {Array} 복구 아이템 목록
     */
    findRecoveryItems() {
        const items = [];

        for (const namespace of this._options.namespaces) {
            const prefix = AUTOSAVE_KEYS[namespace.toUpperCase()];
            if (!prefix) continue;

            const keys = findKeysByPrefix(prefix);
            
            for (const key of keys) {
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;

                    const data = JSON.parse(raw);
                    
                    // _autoSave 메타데이터가 있는 경우만 복구 대상
                    if (data?._autoSave) {
                        const identifier = key.replace(prefix, '');
                        const config = NAMESPACE_CONFIG[namespace] || {
                            icon: '📄',
                            label: namespace,
                            description: `${namespace} 데이터`,
                            color: '#6b7280'
                        };

                        items.push({
                            namespace,
                            identifier,
                            key,
                            data,
                            meta: data._autoSave,
                            config
                        });
                    }
                } catch (e) {
                    console.warn(`[RecoveryDialog] 파싱 실패: ${key}`, e);
                }
            }
        }

        // 시간 순으로 정렬 (최신 먼저)
        items.sort((a, b) => {
            const timeA = new Date(a.meta?.savedAt || 0).getTime();
            const timeB = new Date(b.meta?.savedAt || 0).getTime();
            return timeB - timeA;
        });

        console.log(`[RecoveryDialog] ${items.length}개의 복구 데이터 발견`);
        return items;
    }

    // =========================================================================
    // 다이얼로그 표시/숨김
    // =========================================================================

    /**
     * 다이얼로그 표시
     */
    show() {
        if (this._isOpen) return;

        // 복구 아이템이 없으면 표시하지 않음
        if (this._recoveryItems.length === 0) {
            console.log('[RecoveryDialog] 복구할 데이터가 없습니다.');
            return;
        }

        this._createElement();
        
        // 애니메이션을 위해 약간의 지연
        requestAnimationFrame(() => {
            this._overlayElement?.classList.add('recovery-dialog-overlay--visible');
        });

        this._isOpen = true;

        // 이벤트 발행
        eventBus.emit('recovery:dialog-opened', {
            itemCount: this._recoveryItems.length
        });
    }

    /**
     * 다이얼로그 숨김
     */
    hide() {
        if (!this._isOpen) return;

        this._overlayElement?.classList.remove('recovery-dialog-overlay--visible');

        // 애니메이션 후 DOM 제거
        setTimeout(() => {
            this._removeElement();
        }, 300);

        this._isOpen = false;

        // 콜백 호출
        if (this._options.onClose) {
            this._options.onClose();
        }

        // 이벤트 발행
        eventBus.emit('recovery:dialog-closed');
    }

    // =========================================================================
    // DOM 생성
    // =========================================================================

    /**
     * DOM 요소 생성
     * @private
     */
    _createElement() {
        // 오버레이 생성
        this._overlayElement = document.createElement('div');
        this._overlayElement.className = 'recovery-dialog-overlay';
        this._overlayElement.style.setProperty('--rd-z-index', this._options.zIndex);

        // 다이얼로그 본체 생성
        this._element = document.createElement('div');
        this._element.className = 'recovery-dialog';
        this._element.innerHTML = this._buildDialogHTML();

        this._overlayElement.appendChild(this._element);
        document.body.appendChild(this._overlayElement);

        // 이벤트 바인딩
        this._bindEvents();

        // 전체 선택 초기화
        this._selectedItems = new Set(this._recoveryItems.map(item => item.key));
        this._updateSelectAll();
    }

    /**
     * 다이얼로그 HTML 빌드
     * @private
     */
    _buildDialogHTML() {
        const itemsHTML = this._recoveryItems.map(item => this._buildItemHTML(item)).join('');
        const itemCount = this._recoveryItems.length;

        return `
            <div class="recovery-dialog__header">
                <h2 class="recovery-dialog__title">
                    <span class="recovery-dialog__title-icon">🔄</span>
                    저장되지 않은 작업 발견
                </h2>
                <p class="recovery-dialog__subtitle">
                    이전 세션에서 자동 저장된 데이터가 있습니다.<br>
                    복구할 항목을 선택하거나 삭제할 수 있습니다.
                </p>
            </div>

            <div class="recovery-dialog__body">
                ${itemCount > 1 ? `
                    <div class="recovery-dialog__select-all recovery-dialog__select-all--checked" data-action="select-all">
                        <div class="recovery-dialog__select-all-checkbox">
                            <span style="color: white; font-size: 11px;">✓</span>
                        </div>
                        <span class="recovery-dialog__select-all-label">전체 선택 (${itemCount}개)</span>
                    </div>
                ` : ''}
                
                ${itemsHTML || `
                    <div class="recovery-dialog__empty">
                        <div class="recovery-dialog__empty-icon">📭</div>
                        <div class="recovery-dialog__empty-text">복구할 데이터가 없습니다.</div>
                    </div>
                `}
            </div>

            <div class="recovery-dialog__footer">
                <button class="recovery-dialog__btn recovery-dialog__btn--discard" data-action="discard">
                    🗑️ 선택 삭제
                </button>
                <button class="recovery-dialog__btn recovery-dialog__btn--recover" data-action="recover">
                    ✅ 선택 복구
                </button>
            </div>
        `;
    }

    /**
     * 복구 아이템 HTML 빌드
     * @private
     */
    _buildItemHTML(item) {
        const { namespace, identifier, data, meta, config } = item;
        const savedAt = meta?.savedAt ? new Date(meta.savedAt) : null;
        const timeAgo = savedAt ? this._getTimeAgo(savedAt) : '알 수 없음';
        
        // 데이터 요약 정보 추출
        const summary = this._extractSummary(namespace, data);
        const previewJson = this._options.showPreview 
            ? JSON.stringify(data, null, 2).slice(0, 2000) 
            : '';

        return `
            <div class="recovery-item recovery-item--selected" 
                 data-key="${item.key}" 
                 style="--ri-color: ${config.color}">
                <div class="recovery-item__header" data-action="toggle-select">
                    <div class="recovery-item__checkbox">
                        <span class="recovery-item__checkbox-icon">✓</span>
                    </div>
                    <span class="recovery-item__icon">${config.icon}</span>
                    <div class="recovery-item__info">
                        <div class="recovery-item__label">${config.label}</div>
                        <div class="recovery-item__meta">
                            <span class="recovery-item__meta-item">
                                📍 ${identifier}
                            </span>
                            <span class="recovery-item__meta-item">
                                🕐 ${timeAgo}
                            </span>
                            <span class="recovery-item__meta-badge">미저장</span>
                        </div>
                    </div>
                    ${this._options.showPreview ? `
                        <button class="recovery-item__toggle" data-action="toggle-preview" title="미리보기">
                            👁️ 미리보기
                        </button>
                    ` : ''}
                </div>
                
                ${summary ? `
                    <div class="recovery-item__summary">
                        ${summary}
                    </div>
                ` : ''}
                
                ${this._options.showPreview ? `
                    <div class="recovery-item__preview" data-preview>
                        <div class="recovery-item__preview-content">${this._escapeHTML(previewJson)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 데이터 요약 정보 추출
     * @private
     */
    _extractSummary(namespace, data) {
        const items = [];

        switch (namespace) {
            case 'layout':
                if (data.roomConfig) {
                    items.push({ label: '룸 크기', value: `${data.roomConfig.width || 0}×${data.roomConfig.height || 0}` });
                }
                if (data.objects) {
                    items.push({ label: '객체 수', value: `${Array.isArray(data.objects) ? data.objects.length : 0}개` });
                }
                if (data.walls) {
                    items.push({ label: '벽 수', value: `${Array.isArray(data.walls) ? data.walls.length : 0}개` });
                }
                break;

            case 'equipment':
                if (data.mappings) {
                    const count = typeof data.mappings === 'object' ? Object.keys(data.mappings).length : 0;
                    items.push({ label: '매핑 수', value: `${count}개` });
                }
                if (data.mappingCount !== undefined) {
                    items.push({ label: '매핑 수', value: `${data.mappingCount}개` });
                }
                break;

            case 'multisite':
                if (data.sites) {
                    items.push({ label: '사이트 수', value: `${Array.isArray(data.sites) ? data.sites.length : 0}개` });
                }
                break;

            case 'simulation':
                if (data.settings) {
                    items.push({ label: '설정', value: '저장됨' });
                }
                break;
        }

        // 공통 정보
        if (data._autoSave?.trigger) {
            const triggerLabels = {
                timer: '타이머',
                changeThreshold: '변경 임계값',
                manual: '수동 저장',
                beforeunload: '페이지 종료'
            };
            items.push({ label: '저장 트리거', value: triggerLabels[data._autoSave.trigger] || data._autoSave.trigger });
        }

        if (items.length === 0) return '';

        return items.map(item => `
            <div class="recovery-item__summary-item">
                <span class="recovery-item__summary-label">${item.label}</span>
                <span class="recovery-item__summary-value">${item.value}</span>
            </div>
        `).join('');
    }

    /**
     * HTML 이스케이프
     * @private
     */
    _escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 시간 경과 텍스트
     * @private
     */
    _getTimeAgo(date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        
        if (seconds < 60) return '방금 전';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
        return `${Math.floor(seconds / 86400)}일 전`;
    }

    // =========================================================================
    // 이벤트 처리
    // =========================================================================

    /**
     * 이벤트 바인딩
     * @private
     */
    _bindEvents() {
        // 오버레이 클릭 (외부 클릭 시 닫기 - 선택사항)
        // this._overlayElement?.addEventListener('click', (e) => {
        //     if (e.target === this._overlayElement) {
        //         this.hide();
        //     }
        // });

        // 버튼 및 액션 클릭
        this._element?.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;

            switch (action) {
                case 'recover':
                    this._handleRecover();
                    break;
                case 'discard':
                    this._handleDiscard();
                    break;
                case 'toggle-select':
                    this._handleToggleSelect(target.closest('.recovery-item'));
                    break;
                case 'toggle-preview':
                    e.stopPropagation();
                    this._handleTogglePreview(target.closest('.recovery-item'));
                    break;
                case 'select-all':
                    this._handleSelectAll();
                    break;
            }
        });

        // ESC 키로 닫기
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this._isOpen) {
                this.hide();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    /**
     * 아이템 선택 토글
     * @private
     */
    _handleToggleSelect(itemElement) {
        if (!itemElement) return;

        const key = itemElement.dataset.key;
        const isSelected = this._selectedItems.has(key);

        if (isSelected) {
            this._selectedItems.delete(key);
            itemElement.classList.remove('recovery-item--selected');
        } else {
            this._selectedItems.add(key);
            itemElement.classList.add('recovery-item--selected');
        }

        this._updateSelectAll();
        this._updateButtons();
    }

    /**
     * 전체 선택 토글
     * @private
     */
    _handleSelectAll() {
        const allSelected = this._selectedItems.size === this._recoveryItems.length;

        if (allSelected) {
            // 전체 해제
            this._selectedItems.clear();
            this._element?.querySelectorAll('.recovery-item').forEach(el => {
                el.classList.remove('recovery-item--selected');
            });
        } else {
            // 전체 선택
            this._recoveryItems.forEach(item => {
                this._selectedItems.add(item.key);
            });
            this._element?.querySelectorAll('.recovery-item').forEach(el => {
                el.classList.add('recovery-item--selected');
            });
        }

        this._updateSelectAll();
        this._updateButtons();
    }

    /**
     * 전체 선택 UI 업데이트
     * @private
     */
    _updateSelectAll() {
        const selectAllEl = this._element?.querySelector('.recovery-dialog__select-all');
        if (!selectAllEl) return;

        const allSelected = this._selectedItems.size === this._recoveryItems.length;
        selectAllEl.classList.toggle('recovery-dialog__select-all--checked', allSelected);

        const checkbox = selectAllEl.querySelector('.recovery-dialog__select-all-checkbox');
        if (checkbox) {
            checkbox.innerHTML = allSelected ? '<span style="color: white; font-size: 11px;">✓</span>' : '';
        }
    }

    /**
     * 버튼 상태 업데이트
     * @private
     */
    _updateButtons() {
        const hasSelection = this._selectedItems.size > 0;
        
        const recoverBtn = this._element?.querySelector('[data-action="recover"]');
        const discardBtn = this._element?.querySelector('[data-action="discard"]');

        if (recoverBtn) recoverBtn.disabled = !hasSelection;
        if (discardBtn) discardBtn.disabled = !hasSelection;
    }

    /**
     * 미리보기 토글
     * @private
     */
    _handleTogglePreview(itemElement) {
        if (!itemElement) return;

        const preview = itemElement.querySelector('[data-preview]');
        const toggle = itemElement.querySelector('.recovery-item__toggle');

        if (preview) {
            preview.classList.toggle('recovery-item__preview--expanded');
        }
        if (toggle) {
            toggle.classList.toggle('recovery-item__toggle--expanded');
            toggle.textContent = toggle.classList.contains('recovery-item__toggle--expanded') 
                ? '🔽 접기' 
                : '👁️ 미리보기';
        }
    }

    /**
     * 복구 처리
     * @private
     */
    _handleRecover() {
        const selectedItems = this._recoveryItems.filter(item => 
            this._selectedItems.has(item.key)
        );

        if (selectedItems.length === 0) return;

        console.log(`[RecoveryDialog] ${selectedItems.length}개 항목 복구 시작`);

        // 이벤트 발행
        eventBus.emit('recovery:recover-requested', {
            items: selectedItems.map(item => ({
                namespace: item.namespace,
                identifier: item.identifier,
                data: item.data
            }))
        });

        // 콜백 호출
        if (this._options.onRecover) {
            this._options.onRecover(selectedItems);
        }

        // 다이얼로그 닫기
        this.hide();
    }

    /**
     * 삭제 처리
     * @private
     */
    _handleDiscard() {
        const selectedItems = this._recoveryItems.filter(item => 
            this._selectedItems.has(item.key)
        );

        if (selectedItems.length === 0) return;

        // 확인 다이얼로그
        const confirmed = confirm(
            `${selectedItems.length}개의 저장되지 않은 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
        );

        if (!confirmed) return;

        console.log(`[RecoveryDialog] ${selectedItems.length}개 항목 삭제`);

        // LocalStorage에서 삭제
        selectedItems.forEach(item => {
            try {
                localStorage.removeItem(item.key);
            } catch (e) {
                console.error(`[RecoveryDialog] 삭제 실패: ${item.key}`, e);
            }
        });

        // 이벤트 발행
        eventBus.emit('recovery:discard-completed', {
            items: selectedItems.map(item => ({
                namespace: item.namespace,
                identifier: item.identifier
            }))
        });

        // 콜백 호출
        if (this._options.onDiscard) {
            this._options.onDiscard(selectedItems);
        }

        // 다이얼로그 닫기
        this.hide();
    }

    // =========================================================================
    // DOM 제거
    // =========================================================================

    /**
     * DOM 요소 제거
     * @private
     */
    _removeElement() {
        if (this._overlayElement && this._overlayElement.parentNode) {
            this._overlayElement.parentNode.removeChild(this._overlayElement);
        }

        this._element = null;
        this._overlayElement = null;
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * 다이얼로그 열림 상태
     */
    get isOpen() {
        return this._isOpen;
    }

    /**
     * 복구 아이템 목록
     */
    get recoveryItems() {
        return [...this._recoveryItems];
    }

    /**
     * 수동으로 복구 아이템 설정
     * @param {Array} items - 복구 아이템 목록
     */
    setRecoveryItems(items) {
        this._recoveryItems = items;
    }

    /**
     * 리소스 정리
     */
    destroy() {
        // 키보드 이벤트 제거
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        // DOM 제거
        this._removeElement();

        // 상태 초기화
        this._recoveryItems = [];
        this._selectedItems.clear();
        this._isOpen = false;
    }
}

// 기본 내보내기
export default RecoveryDialog;

// Named export
export { RecoveryDialog, NAMESPACE_CONFIG };

// 전역 등록
if (typeof window !== 'undefined') {
    window.RecoveryDialog = RecoveryDialog;
}

console.log('✅ RecoveryDialog.js v1.0.0 로드 완료');