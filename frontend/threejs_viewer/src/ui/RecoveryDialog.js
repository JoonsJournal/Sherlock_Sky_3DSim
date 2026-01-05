/**
 * RecoveryDialog.js
 * 
 * AutoSave 복구 다이얼로그 UI 컴포넌트
 * - 페이지 로드 시 미저장 데이터 감지
 * - 복구/무시 선택 다이얼로그
 * - 데이터 미리보기
 * - 다중 namespace 복구 지원
 * 
 * @version 2.0.0
 * @description 
 *   - v1.0.0: 초기 버전
 *   - v2.0.0: _injectStyles() 제거, CSS 파일 분리 (_recovery-dialog.css)
 * 
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
        color: '#3b82f6'
    },
    equipment: {
        icon: '⚙️',
        label: 'Equipment Mapping',
        description: '설비 매핑 데이터',
        color: '#22c55e'
    },
    multisite: {
        icon: '🏭',
        label: 'Multi-site Config',
        description: '다중 사이트 설정',
        color: '#f59e0b'
    },
    simulation: {
        icon: '🎮',
        label: 'Simulation',
        description: '시뮬레이션 설정',
        color: '#8b5cf6'
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
            zIndex: options.zIndex || 10001
        };

        // DOM 요소
        this._element = null;
        this._overlayElement = null;

        // 상태
        this._isOpen = false;
        this._recoveryItems = [];
        this._selectedItems = new Set();

        // 자동 확인
        if (this._options.autoCheck) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.checkAndShow());
            } else {
                setTimeout(() => this.checkAndShow(), 500);
            }
        }
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

        if (this._recoveryItems.length === 0) {
            console.log('[RecoveryDialog] 복구할 데이터가 없습니다.');
            return;
        }

        this._createElement();
        
        requestAnimationFrame(() => {
            this._overlayElement?.classList.add('recovery-dialog-overlay--visible');
        });

        this._isOpen = true;

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

        setTimeout(() => {
            this._removeElement();
        }, 300);

        this._isOpen = false;

        if (this._options.onClose) {
            this._options.onClose();
        }

        eventBus.emit('recovery:dialog-closed');
    }

    // =========================================================================
    // DOM 생성 - CSS 클래스 기반 (인라인 스타일 제거)
    // =========================================================================

    /**
     * DOM 요소 생성
     * @private
     */
    _createElement() {
        // 오버레이 생성
        this._overlayElement = document.createElement('div');
        this._overlayElement.className = 'recovery-dialog-overlay';

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
        
        const summary = this._extractSummary(namespace, data);
        const previewJson = this._options.showPreview 
            ? JSON.stringify(data, null, 2).slice(0, 2000) 
            : '';

        return `
            <div class="recovery-item recovery-item--selected" 
                 data-key="${item.key}">
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
            this._selectedItems.clear();
            this._element?.querySelectorAll('.recovery-item').forEach(el => {
                el.classList.remove('recovery-item--selected');
            });
        } else {
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

        eventBus.emit('recovery:recover-requested', {
            items: selectedItems.map(item => ({
                namespace: item.namespace,
                identifier: item.identifier,
                data: item.data
            }))
        });

        if (this._options.onRecover) {
            this._options.onRecover(selectedItems);
        }

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

        const confirmed = confirm(
            `${selectedItems.length}개의 저장되지 않은 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
        );

        if (!confirmed) return;

        console.log(`[RecoveryDialog] ${selectedItems.length}개 항목 삭제`);

        selectedItems.forEach(item => {
            try {
                localStorage.removeItem(item.key);
            } catch (e) {
                console.error(`[RecoveryDialog] 삭제 실패: ${item.key}`, e);
            }
        });

        eventBus.emit('recovery:discard-completed', {
            items: selectedItems.map(item => ({
                namespace: item.namespace,
                identifier: item.identifier
            }))
        });

        if (this._options.onDiscard) {
            this._options.onDiscard(selectedItems);
        }

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

    get isOpen() {
        return this._isOpen;
    }

    get recoveryItems() {
        return [...this._recoveryItems];
    }

    setRecoveryItems(items) {
        this._recoveryItems = items;
    }

    destroy() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        this._removeElement();

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

console.log('✅ RecoveryDialog.js v2.0.0 로드 완료');