/**
 * HeaderStatus.js
 * ===============
 * 헤더 상태 표시 컴포넌트
 * 
 * @version 1.0.0
 * @description
 * - 설비 상태 표시 (RUN, IDLE, STOP, SUDDENSTOP, DISCONNECTED)
 * - 상태 인디케이터 색상 + 텍스트
 * - 표시/숨김 제어
 * 
 * @example
 * const headerStatus = new HeaderStatus(panelEl);
 * headerStatus.update('RUN');
 * headerStatus.hide();  // Multi Selection 시
 * headerStatus.show();  // Single Selection 시
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/components/HeaderStatus.js
 * 작성일: 2026-01-09
 */

import { debugLog } from '../../../core/utils/Config.js';

/**
 * 상태별 설정
 * @type {Object.<string, {class: string, text: string, icon: string}>}
 */
const STATUS_CONFIG = {
    'RUN': { 
        class: 'status-running', 
        text: '가동 중 (RUN)',
        icon: '🟢'
    },
    'IDLE': { 
        class: 'status-idle', 
        text: '대기 (IDLE)',
        icon: '🟡'
    },
    'STOP': { 
        class: 'status-stop', 
        text: '정지 (STOP)',
        icon: '🔴'
    },
    'SUDDENSTOP': { 
        class: 'status-error', 
        text: '긴급 정지 (SUDDENSTOP)',
        icon: '⚠️'
    },
    'DISCONNECTED': { 
        class: 'status-disconnected', 
        text: '연결 끊김',
        icon: '⚫'
    }
};

/**
 * 기본 설정 (알 수 없는 상태용)
 */
const DEFAULT_STATUS = {
    class: '',
    text: '-',
    icon: '❓'
};

/**
 * 헤더 상태 표시 컴포넌트
 */
export class HeaderStatus {
    /**
     * @param {HTMLElement} container - 패널 컨테이너 요소
     * @param {Object} [options] - 옵션
     * @param {string} [options.statusElId='headerStatus'] - 상태 컨테이너 ID
     * @param {string} [options.indicatorId='headerStatusIndicator'] - 인디케이터 ID
     * @param {string} [options.textId='headerStatusText'] - 텍스트 ID
     */
    constructor(container, options = {}) {
        const {
            statusElId = 'headerStatus',
            indicatorId = 'headerStatusIndicator',
            textId = 'headerStatusText'
        } = options;
        
        /**
         * 상태 컨테이너 요소
         * @type {HTMLElement|null}
         */
        this.statusEl = container?.querySelector(`#${statusElId}`) || document.getElementById(statusElId);
        
        /**
         * 상태 인디케이터 요소
         * @type {HTMLElement|null}
         */
        this.indicator = container?.querySelector(`#${indicatorId}`) || document.getElementById(indicatorId);
        
        /**
         * 상태 텍스트 요소
         * @type {HTMLElement|null}
         */
        this.textEl = container?.querySelector(`#${textId}`) || document.getElementById(textId);
        
        /**
         * 현재 상태
         * @type {string|null}
         */
        this.currentStatus = null;
        
        /**
         * 표시 상태
         * @type {boolean}
         */
        this.isVisible = true;
        
        if (!this.statusEl) {
            console.warn('⚠️ HeaderStatus: Status container not found');
        }
        
        debugLog('🏷️ HeaderStatus initialized');
    }
    
    // =========================================================================
    // 공개 API
    // =========================================================================
    
    /**
     * 상태 업데이트
     * @param {string|null} status - 상태 코드 ('RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED')
     */
    update(status) {
        this.currentStatus = status;
        
        if (!this.indicator || !this.textEl) {
            return;
        }
        
        const config = this.getStatusConfig(status);
        
        // 인디케이터 클래스 업데이트
        this.indicator.className = `status-indicator ${config.class}`;
        
        // 텍스트 업데이트 (짧은 형태: 상태 코드만)
        this.textEl.textContent = status || '-';
        
        debugLog(`🏷️ HeaderStatus updated: ${status} -> ${config.class}`);
    }
    
    /**
     * 상태를 전체 텍스트로 업데이트 (긴 형태)
     * @param {string|null} status - 상태 코드
     */
    updateWithFullText(status) {
        this.currentStatus = status;
        
        if (!this.indicator || !this.textEl) {
            return;
        }
        
        const config = this.getStatusConfig(status);
        
        // 인디케이터 클래스 업데이트
        this.indicator.className = `status-indicator ${config.class}`;
        
        // 텍스트 업데이트 (긴 형태: 한글 + 영문)
        this.textEl.textContent = config.text;
    }
    
    /**
     * 표시
     */
    show() {
        if (this.statusEl) {
            this.statusEl.style.display = 'flex';
            this.isVisible = true;
            debugLog('🏷️ HeaderStatus shown');
        }
    }
    
    /**
     * 숨기기
     */
    hide() {
        if (this.statusEl) {
            this.statusEl.style.display = 'none';
            this.isVisible = false;
            debugLog('🏷️ HeaderStatus hidden');
        }
    }
    
    /**
     * 토글
     * @returns {boolean} 현재 표시 상태
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
        return this.isVisible;
    }
    
    /**
     * 현재 상태 반환
     * @returns {string|null}
     */
    getStatus() {
        return this.currentStatus;
    }
    
    /**
     * 표시 여부 반환
     * @returns {boolean}
     */
    getIsVisible() {
        return this.isVisible;
    }
    
    // =========================================================================
    // 상태 정보 조회
    // =========================================================================
    
    /**
     * 상태 설정 조회
     * @param {string|null} status - 상태 코드
     * @returns {{class: string, text: string, icon: string}}
     */
    getStatusConfig(status) {
        if (!status) {
            return { ...DEFAULT_STATUS };
        }
        
        return STATUS_CONFIG[status] || { 
            class: '', 
            text: status, 
            icon: '❓' 
        };
    }
    
    /**
     * 상태 CSS 클래스 반환
     * @param {string|null} status - 상태 코드
     * @returns {string}
     */
    getStatusClass(status) {
        return this.getStatusConfig(status).class;
    }
    
    /**
     * 상태 전체 텍스트 반환
     * @param {string|null} status - 상태 코드
     * @returns {string}
     */
    getStatusText(status) {
        return this.getStatusConfig(status).text;
    }
    
    /**
     * 상태 아이콘 반환
     * @param {string|null} status - 상태 코드
     * @returns {string}
     */
    getStatusIcon(status) {
        return this.getStatusConfig(status).icon;
    }
    
    // =========================================================================
    // 정적 메서드 (클래스 외부에서 사용)
    // =========================================================================
    
    /**
     * 상태 설정 조회 (정적)
     * @param {string|null} status - 상태 코드
     * @returns {{class: string, text: string, icon: string}}
     */
    static getConfig(status) {
        if (!status) {
            return { ...DEFAULT_STATUS };
        }
        return STATUS_CONFIG[status] || { class: '', text: status, icon: '❓' };
    }
    
    /**
     * 모든 상태 설정 반환 (정적)
     * @returns {Object.<string, {class: string, text: string, icon: string}>}
     */
    static getAllConfigs() {
        return { ...STATUS_CONFIG };
    }
    
    /**
     * 상태 목록 반환 (정적)
     * @returns {string[]}
     */
    static getStatusList() {
        return Object.keys(STATUS_CONFIG);
    }
    
    // =========================================================================
    // DOM 요소 재연결
    // =========================================================================
    
    /**
     * DOM 요소 재연결 (패널 재생성 후 호출)
     * @param {HTMLElement} container - 새 컨테이너
     * @param {Object} [options] - 옵션 (생성자와 동일)
     */
    reconnect(container, options = {}) {
        const {
            statusElId = 'headerStatus',
            indicatorId = 'headerStatusIndicator',
            textId = 'headerStatusText'
        } = options;
        
        this.statusEl = container?.querySelector(`#${statusElId}`) || document.getElementById(statusElId);
        this.indicator = container?.querySelector(`#${indicatorId}`) || document.getElementById(indicatorId);
        this.textEl = container?.querySelector(`#${textId}`) || document.getElementById(textId);
        
        // 현재 상태 다시 적용
        if (this.currentStatus) {
            this.update(this.currentStatus);
        }
        
        // 표시 상태 다시 적용
        if (!this.isVisible) {
            this.hide();
        }
        
        debugLog('🏷️ HeaderStatus reconnected');
    }
    
    // =========================================================================
    // 정리
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.statusEl = null;
        this.indicator = null;
        this.textEl = null;
        this.currentStatus = null;
        
        debugLog('🏷️ HeaderStatus disposed');
    }
}

// 기본 내보내기
export default HeaderStatus;

// 상수 내보내기 (외부 사용 가능)
export { STATUS_CONFIG, DEFAULT_STATUS };