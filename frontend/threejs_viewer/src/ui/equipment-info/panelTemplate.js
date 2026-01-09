/**
 * panelTemplate.js
 * ================
 * Equipment Info Panel HTML 템플릿
 * 
 * @version 1.0.0
 * @description
 * - Panel 구조 HTML 템플릿
 * - DOM ID 상수 정의
 * - 플레이스홀더 컨텐츠
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/panelTemplate.js
 * 작성일: 2026-01-09
 */

/**
 * DOM 요소 ID 상수
 */
export const DOM_IDS = {
    PANEL: 'equipmentInfo',
    CLOSE_BTN: 'equipmentInfoClose',
    EQUIP_NAME: 'equipName',
    HEADER_STATUS: 'headerStatus',
    HEADER_STATUS_INDICATOR: 'headerStatusIndicator',
    HEADER_STATUS_TEXT: 'headerStatusText',
    TAB_GENERAL: 'tab-general',
    TAB_PCINFO: 'tab-pcinfo',
    GENERAL_TAB_CONTENT: 'generalTabContent',
    PCINFO_TAB_CONTENT: 'pcinfoTabContent'
};

/**
 * 탭 이름 상수
 */
export const TAB_NAMES = {
    GENERAL: 'general',
    PCINFO: 'pcinfo'
};

/**
 * Panel 기본 HTML 템플릿
 * @returns {string} HTML 문자열
 */
export function getPanelTemplate() {
    return `
        <button class="close-btn" id="${DOM_IDS.CLOSE_BTN}">×</button>
        
        <!-- Header (Name + Status) -->
        <div class="equipment-panel-header">
            <h2 id="${DOM_IDS.EQUIP_NAME}" class="equipment-panel-title">설비 정보</h2>
            <div class="header-status" id="${DOM_IDS.HEADER_STATUS}">
                <span class="status-indicator" id="${DOM_IDS.HEADER_STATUS_INDICATOR}"></span>
                <span class="status-text" id="${DOM_IDS.HEADER_STATUS_TEXT}">-</span>
            </div>
        </div>
        
        <!-- Tab Header -->
        <div class="equipment-panel-tabs">
            <button class="equipment-tab active" data-tab="${TAB_NAMES.GENERAL}">General</button>
            <button class="equipment-tab" data-tab="${TAB_NAMES.PCINFO}">PC Info.</button>
        </div>
        
        <!-- Tab Content -->
        <div class="equipment-panel-content">
            <!-- General Tab -->
            <div id="${DOM_IDS.TAB_GENERAL}" class="equipment-tab-content active">
                <div id="${DOM_IDS.GENERAL_TAB_CONTENT}">
                    ${getPlaceholderContent()}
                </div>
            </div>
            
            <!-- PC Info Tab -->
            <div id="${DOM_IDS.TAB_PCINFO}" class="equipment-tab-content">
                <div id="${DOM_IDS.PCINFO_TAB_CONTENT}">
                    ${getPlaceholderContent()}
                </div>
            </div>
        </div>
    `;
}

/**
 * 플레이스홀더 컨텐츠
 * @returns {string} HTML 문자열
 */
export function getPlaceholderContent() {
    return `
        <div class="info-row placeholder">
            <span class="info-label">설비를 선택해주세요</span>
        </div>
    `;
}

/**
 * DOM 요소 참조 객체 생성
 * @param {HTMLElement} panelEl - 패널 요소
 * @returns {Object} DOM 요소 참조 객체
 */
export function getDOMReferences(panelEl) {
    if (!panelEl) return null;
    
    return {
        panel: panelEl,
        closeBtn: document.getElementById(DOM_IDS.CLOSE_BTN),
        equipName: document.getElementById(DOM_IDS.EQUIP_NAME),
        headerStatus: document.getElementById(DOM_IDS.HEADER_STATUS),
        headerStatusIndicator: document.getElementById(DOM_IDS.HEADER_STATUS_INDICATOR),
        headerStatusText: document.getElementById(DOM_IDS.HEADER_STATUS_TEXT),
        tabGeneral: document.getElementById(DOM_IDS.TAB_GENERAL),
        tabPCInfo: document.getElementById(DOM_IDS.TAB_PCINFO),
        generalTabContent: document.getElementById(DOM_IDS.GENERAL_TAB_CONTENT),
        pcinfoTabContent: document.getElementById(DOM_IDS.PCINFO_TAB_CONTENT),
        tabButtons: panelEl.querySelectorAll('.equipment-tab'),
        tabContents: panelEl.querySelectorAll('.equipment-tab-content')
    };
}

// 기본 내보내기
export default {
    DOM_IDS,
    TAB_NAMES,
    getPanelTemplate,
    getPlaceholderContent,
    getDOMReferences
};