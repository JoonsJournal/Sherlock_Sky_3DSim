/**
 * EquipmentEditButton.js
 * 
 * Equipment Edit 버튼 컨트롤러
 * - ConnectionStatusService와 연동하여 온라인/오프라인 상태에 따른 버튼 활성화/비활성화
 * - 오프라인 시 Toast 메시지 표시
 * - EquipmentEditModal 열기 기능
 * - 기존 HTML 버튼 인계 지원 (createButton: false)
 * 
 * @version 1.1.0
 * @location frontend/threejs_viewer/src/ui/EquipmentEditButton.js
 */

import ConnectionStatusService, { ConnectionEvents } from '../services/ConnectionStatusService.js';
import { toast } from './common/Toast.js';
import { eventBus } from '../core/managers/EventBus.js';

/**
 * EquipmentEditButton
 * 
 * Backend 연결 상태에 따라 Equipment Edit 기능을 제어하는 버튼 컨트롤러
 */
class EquipmentEditButton {
    /**
     * @param {Object} options - 설정 옵션
     * @param {HTMLElement|string} options.container - 버튼을 추가할 컨테이너 (선택적)
     * @param {Object} options.equipmentEditModal - EquipmentEditModal 인스턴스
     * @param {Function} options.onEditRequest - Edit 요청 시 호출할 콜백 (Modal 대신 사용)
     * @param {string} options.position - 버튼 위치 ('left-panel', 'toolbar', 'custom')
     * @param {boolean} options.showTooltip - 툴팁 표시 여부
     * @param {boolean} options.createButton - 버튼 DOM 생성 여부 (false면 기존 버튼 사용)
     * @param {string} options.buttonId - 버튼 ID (기존 버튼 사용 시 해당 ID)
     */
    constructor(options = {}) {
        this._options = {
            container: options.container || null,
            equipmentEditModal: options.equipmentEditModal || null,
            onEditRequest: options.onEditRequest || null,
            position: options.position || 'left-panel',
            showTooltip: options.showTooltip ?? true,
            createButton: options.createButton ?? true,
            buttonId: options.buttonId || 'equipment-edit-btn',
            zIndex: options.zIndex || 1000
        };

        // DOM 요소
        this._element = null;
        this._statusIndicator = null;

        // 서비스 연결
        this._connectionService = ConnectionStatusService.getInstance();

        // 상태
        this._isEnabled = false;
        this._currentEquipment = null;
        this._isEditModeActive = false;

        // 이벤트 구독 해제 함수들
        this._unsubscribers = [];

        // 기존 클릭 핸들러 저장 (복원용)
        this._originalClickHandler = null;

        // 초기화
        this._init();
    }

    // =========================================================================
    // 초기화
    // =========================================================================

    /**
     * 컴포넌트 초기화
     * @private
     */
    _init() {
        this._injectStyles();
        
        if (this._options.createButton) {
            this._createElement();
        } else {
            // 기존 버튼 인계
            this._takeoverExistingButton();
        }

        this._bindEvents();
        this._updateButtonState();
    }

    /**
     * 스타일 주입
     * @private
     */
    _injectStyles() {
        const styleId = 'equipment-edit-button-styles';
        
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* ===== Equipment Edit Button Status Indicator ===== */
            .floating-btn .eeb-status-indicator {
                position: absolute;
                top: -4px;
                right: -4px;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                border: 2px solid #1a1a1a;
                transition: background-color 0.3s ease;
            }

            .floating-btn .eeb-status-indicator--online {
                background: #22c55e;
            }

            .floating-btn .eeb-status-indicator--offline {
                background: #ef4444;
            }

            .floating-btn .eeb-status-indicator--checking {
                background: #f59e0b;
            }

            /* Disabled State for existing floating-btn */
            .floating-btn.eeb-disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .floating-btn.eeb-disabled:hover {
                transform: none;
                box-shadow: none;
            }

            /* Pulse Animation for Offline Warning */
            @keyframes eeb-pulse-warning {
                0%, 100% {
                    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
                }
                50% {
                    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
                }
            }

            .floating-btn.eeb-offline-warning {
                animation: eeb-pulse-warning 2s ease-in-out infinite;
            }

            /* ===== Standalone Equipment Edit Button ===== */
            .equipment-edit-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 16px;
                min-width: 44px;
                min-height: 44px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                font-weight: 600;
                color: #ffffff;
                cursor: pointer;
                user-select: none;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                position: relative;
            }

            .equipment-edit-btn:hover:not(:disabled) {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }

            .equipment-edit-btn:disabled {
                background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
                color: #9ca3af;
                cursor: not-allowed;
                box-shadow: none;
                opacity: 0.7;
            }

            .equipment-edit-btn__icon {
                font-size: 18px;
                line-height: 1;
            }

            .equipment-edit-btn__label {
                white-space: nowrap;
            }

            .equipment-edit-btn__shortcut {
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 700;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                margin-left: 4px;
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * 기존 HTML 버튼 인계
     * @private
     */
    _takeoverExistingButton() {
        this._element = document.getElementById(this._options.buttonId);
        
        if (!this._element) {
            console.warn(`[EquipmentEditButton] 기존 버튼을 찾을 수 없음: #${this._options.buttonId}`);
            return;
        }

        console.log(`[EquipmentEditButton] 기존 버튼 인계: #${this._options.buttonId}`);

        // 기존 클릭 이벤트 제거를 위해 클론 교체 (이벤트 리스너 제거)
        // 주의: 이 방식은 모든 이벤트를 제거하므로 필요한 경우만 사용
        // 대신, 새 클릭 핸들러에서 조건 체크 후 기존 동작 수행
        
        // 상태 인디케이터 추가
        this._addStatusIndicator();
        
        // 버튼에 position: relative 확인 (인디케이터 위치용)
        const computedStyle = window.getComputedStyle(this._element);
        if (computedStyle.position === 'static') {
            this._element.style.position = 'relative';
        }
    }

    /**
     * 새 버튼 DOM 요소 생성
     * @private
     */
    _createElement() {
        const container = this._getContainer();

        this._element = document.createElement('button');
        this._element.id = this._options.buttonId;
        this._element.className = 'equipment-edit-btn';
        this._element.type = 'button';

        this._element.innerHTML = `
            <span class="equipment-edit-btn__icon">🛠️</span>
            <span class="equipment-edit-btn__label">Edit</span>
            <span class="equipment-edit-btn__shortcut">E</span>
        `;

        this._addStatusIndicator();

        if (container) {
            container.appendChild(this._element);
        }
    }

    /**
     * 상태 인디케이터 추가
     * @private
     */
    _addStatusIndicator() {
        if (!this._element) return;

        // 기존 인디케이터 확인
        this._statusIndicator = this._element.querySelector('.eeb-status-indicator');
        
        if (!this._statusIndicator) {
            this._statusIndicator = document.createElement('span');
            this._statusIndicator.className = 'eeb-status-indicator';
            this._element.appendChild(this._statusIndicator);
        }
    }

    /**
     * 컨테이너 요소 가져오기
     * @private
     * @returns {HTMLElement|null}
     */
    _getContainer() {
        if (!this._options.container) return null;

        if (typeof this._options.container === 'string') {
            return document.querySelector(this._options.container);
        }

        return this._options.container;
    }

    // =========================================================================
    // 이벤트 바인딩
    // =========================================================================

    /**
     * 이벤트 바인딩
     * @private
     */
    _bindEvents() {
        // ConnectionStatusService 이벤트 구독
        const unsubOnline = this._connectionService.onOnline(() => {
            this._onConnectionOnline();
        });
        this._unsubscribers.push(unsubOnline);

        const unsubOffline = this._connectionService.onOffline(() => {
            this._onConnectionOffline();
        });
        this._unsubscribers.push(unsubOffline);

        const unsubStatusChanged = this._connectionService.onStatusChanged((data) => {
            this._updateButtonState();
        });
        this._unsubscribers.push(unsubStatusChanged);

        // 버튼 클릭 이벤트 (capture로 먼저 처리)
        if (this._element) {
            this._boundClickHandler = (e) => this._handleClick(e);
            this._element.addEventListener('click', this._boundClickHandler, true);
        }

        // 키보드 단축키 이벤트 (EventBus 통해)
        const shortcutHandler = () => this._handleShortcut();
        eventBus.on('shortcut:equipmentEdit', shortcutHandler);
        this._unsubscribers.push(() => eventBus.off('shortcut:equipmentEdit', shortcutHandler));
    }

    // =========================================================================
    // 이벤트 핸들러
    // =========================================================================

    /**
     * 온라인 상태 변경 시
     * @private
     */
    _onConnectionOnline() {
        console.log('[EquipmentEditButton] Backend 연결됨 - 버튼 활성화');
        this._setEnabled(true);
        
        // 복구 알림
        toast.success('Backend 연결됨 - Equipment Edit 사용 가능');
    }

    /**
     * 오프라인 상태 변경 시
     * @private
     */
    _onConnectionOffline() {
        console.log('[EquipmentEditButton] Backend 연결 끊김 - 버튼 비활성화');
        this._setEnabled(false);
        
        // Edit 모드 활성화 중이었다면 경고
        if (this._isEditModeActive) {
            toast.warning('⚠️ Backend 연결이 끊겼습니다. 변경사항이 저장되지 않을 수 있습니다.');
        }
    }

    /**
     * 버튼 클릭 핸들러
     * @private
     * @param {Event} e - 클릭 이벤트
     */
    _handleClick(e) {
        // 오프라인이면 이벤트 중단 및 메시지 표시
        if (!this._isEnabled) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this._showOfflineMessage();
            return;
        }

        // 온라인이면 이벤트를 계속 전파하여 기존 핸들러 실행
        // (EventBootstrap의 toggleEditMode가 실행됨)
        // 또는 onEditRequest 콜백 호출
        if (this._options.onEditRequest) {
            e.preventDefault();
            e.stopPropagation();
            this._options.onEditRequest(this._currentEquipment);
        }
        // 콜백이 없으면 이벤트 전파 허용 (기존 핸들러 실행)
    }

    /**
     * 단축키 핸들러
     * @private
     */
    _handleShortcut() {
        if (!this._isEnabled) {
            this._showOfflineMessage();
            return;
        }

        // 온라인이면 Edit 요청
        if (this._options.onEditRequest) {
            this._options.onEditRequest(this._currentEquipment);
        } else {
            // 버튼 클릭 시뮬레이션 (기존 핸들러 트리거)
            // 주의: 이 경우 _handleClick이 다시 호출될 수 있으므로 플래그 사용
            this._triggerButtonClick();
        }
    }

    /**
     * 버튼 클릭 시뮬레이션
     * @private
     */
    _triggerButtonClick() {
        if (this._element) {
            // 직접 이벤트 발생보다는 eventBus 사용
            eventBus.emit('equipment:edit:toggle', {
                equipment: this._currentEquipment,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 오프라인 메시지 표시
     * @private
     */
    _showOfflineMessage() {
        toast.warning('🔌 Backend 서버에 연결되어 있지 않습니다.\nEquipment Edit 모드를 사용하려면 서버 연결이 필요합니다.', 4000);
        
        // 버튼에 잠시 강조 효과
        if (this._element) {
            this._element.classList.add('eeb-offline-warning');
            setTimeout(() => {
                this._element.classList.remove('eeb-offline-warning');
            }, 2000);
        }
    }

    // =========================================================================
    // 상태 관리
    // =========================================================================

    /**
     * 버튼 활성화 상태 설정
     * @private
     * @param {boolean} enabled - 활성화 여부
     */
    _setEnabled(enabled) {
        this._isEnabled = enabled;
        this._updateButtonState();
    }

    /**
     * 버튼 상태 업데이트
     * @private
     */
    _updateButtonState() {
        if (!this._element) return;

        const isOnline = this._connectionService.isOnline();
        this._isEnabled = isOnline;

        // CSS 클래스 업데이트
        this._element.classList.toggle('eeb-disabled', !isOnline);

        // 상태 인디케이터 업데이트
        if (this._statusIndicator) {
            this._statusIndicator.className = 'eeb-status-indicator';
            
            const state = this._connectionService.getState();
            if (state === 'checking') {
                this._statusIndicator.classList.add('eeb-status-indicator--checking');
            } else if (isOnline) {
                this._statusIndicator.classList.add('eeb-status-indicator--online');
            } else {
                this._statusIndicator.classList.add('eeb-status-indicator--offline');
            }
        }

        // title 속성 업데이트
        if (isOnline) {
            this._element.title = 'Equipment Edit Mode (E)';
        } else {
            this._element.title = '⚠️ Backend 연결 필요 - Equipment Edit Mode (E)';
        }
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * 현재 선택된 설비 설정
     * @param {THREE.Group|null} equipment - 설비 객체
     */
    setCurrentEquipment(equipment) {
        this._currentEquipment = equipment;
    }

    /**
     * Edit 모드 활성화 상태 설정
     * @param {boolean} active - 활성화 여부
     */
    setEditModeActive(active) {
        this._isEditModeActive = active;
        
        if (this._element) {
            this._element.classList.toggle('active', active);
        }
    }

    /**
     * EquipmentEditModal 인스턴스 설정
     * @param {Object} modal - EquipmentEditModal 인스턴스
     */
    setEditModal(modal) {
        this._options.equipmentEditModal = modal;
    }

    /**
     * Edit 요청 콜백 설정
     * @param {Function} callback - 콜백 함수
     */
    setOnEditRequest(callback) {
        this._options.onEditRequest = callback;
    }

    /**
     * 버튼 활성화 여부 확인
     * @returns {boolean}
     */
    isEnabled() {
        return this._isEnabled;
    }

    /**
     * Edit 모드 활성화 여부 확인
     * @returns {boolean}
     */
    isEditModeActive() {
        return this._isEditModeActive;
    }

    /**
     * 버튼 표시
     */
    show() {
        if (this._element) {
            this._element.style.display = '';
        }
    }

    /**
     * 버튼 숨김
     */
    hide() {
        if (this._element) {
            this._element.style.display = 'none';
        }
    }

    /**
     * DOM 요소 반환
     * @returns {HTMLElement|null}
     */
    getElement() {
        return this._element;
    }

    /**
     * Edit 요청 트리거 (외부에서 호출 가능)
     * @returns {boolean} 성공 여부
     */
    triggerEdit() {
        if (this._isEnabled) {
            if (this._options.onEditRequest) {
                this._options.onEditRequest(this._currentEquipment);
            } else {
                this._triggerButtonClick();
            }
            return true;
        } else {
            this._showOfflineMessage();
            return false;
        }
    }

    /**
     * 상태 새로고침
     */
    refresh() {
        this._updateButtonState();
    }

    /**
     * 컴포넌트 파괴
     */
    destroy() {
        // 이벤트 구독 해제
        this._unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._unsubscribers = [];

        // 클릭 핸들러 제거
        if (this._element && this._boundClickHandler) {
            this._element.removeEventListener('click', this._boundClickHandler, true);
        }

        // 상태 인디케이터 제거 (기존 버튼 사용 시)
        if (!this._options.createButton && this._statusIndicator) {
            this._statusIndicator.remove();
        }

        // CSS 클래스 정리
        if (this._element) {
            this._element.classList.remove('eeb-disabled', 'eeb-offline-warning');
        }

        // 새로 생성한 버튼인 경우만 DOM 제거
        if (this._options.createButton && this._element?.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }

        this._element = null;
        this._statusIndicator = null;
        this._currentEquipment = null;
    }
}

// 기본 내보내기
export default EquipmentEditButton;

// Named export
export { EquipmentEditButton };