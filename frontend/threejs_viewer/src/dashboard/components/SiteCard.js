/**
 * SiteCard.js - Site Card 컴포넌트
 * 
 * @version 1.0.2
 * @created 2026-02-03
 * @modified 2026-02-03
 * @phase Phase 2: Site Dashboard 구현
 * 
 * @description
 * Dashboard에 표시되는 개별 Site Card 컴포넌트
 * - Site 기본 정보 표시 (이름, 국가, Process)
 * - 실시간 설비 통계 표시 (RUN/IDLE/STOP/DISC)
 * - Critical Equipment 하이라이트 (FR-DASH-002)
 * - 시나리오별 액션 버튼 (S0~S3)
 * - 연결 상태 및 Readiness 표시
 * 
 * @dependencies
 * - DashboardState.js: SiteReadiness, SiteStatus 상수
 * - _dashboard.css: Site Card 스타일
 * 
 * @exports
 * - SiteCard: Site Card 컴포넌트 클래스
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 * - v1.0.1 (2026-02-03): CSS 클래스 상수화, 가이드라인 준수
 * - v1.0.2 (2026-02-03): Critical Equipment 하이라이트 기능 추가 (FR-DASH-002)
 * 
 * 위치: frontend/threejs_viewer/src/dashboard/components/SiteCard.js
 */

import { SiteReadiness, SiteStatus } from '../DashboardState.js';

// =========================================================
// Constants
// =========================================================

/**
 * 국가별 플래그 이모지
 */
const COUNTRY_FLAGS = {
    CN: '🇨🇳',
    KR: '🇰🇷',
    VN: '🇻🇳',
    US: '🇺🇸',
    JP: '🇯🇵',
    DEFAULT: '🌍'
};

/**
 * SiteCard 클래스
 */
export class SiteCard {
    // =========================================================
    // CSS Class Constants (가이드라인 준수)
    // =========================================================
    
    /** @type {Object} CSS 클래스 상수 */
    static CSS = {
        // Block
        BLOCK: 'site-card',
        
        // Elements
        HEADER: 'site-card__header',
        TITLE: 'site-card__title',
        FLAG: 'site-card__flag',
        NAME: 'site-card__name',
        PROCESS: 'site-card__process',
        STATUS: 'site-card__status',
        BADGE: 'site-card__badge',
        BODY: 'site-card__body',
        ACTIONS: 'site-card__actions',
        STATS: 'site-card__stats',
        STATS_COMPACT: 'site-card__stats--compact',
        PRODUCTION: 'site-card__production',
        SETUP_STATUS: 'site-card__setup-status',
        GUIDE: 'site-card__guide',
        DB_INFO: 'site-card__db-info',
        NOTICE: 'site-card__notice',
        ERROR: 'site-card__error',
        
        // Critical Equipment (v1.0.2 추가)
        CRITICAL: 'site-card__critical',
        CRITICAL_HEADER: 'site-card__critical-header',
        CRITICAL_ICON: 'site-card__critical-icon',
        CRITICAL_COUNT: 'site-card__critical-count',
        CRITICAL_LIST: 'site-card__critical-list',
        CRITICAL_ITEM: 'site-card__critical-item',
        CRITICAL_EQ_ID: 'site-card__critical-eq-id',
        CRITICAL_EQ_STATUS: 'site-card__critical-eq-status',
        CRITICAL_EQ_DURATION: 'site-card__critical-eq-duration',
        
        // Modifiers
        MOD_S0: 'site-card--s0',
        MOD_S1: 'site-card--s1',
        MOD_S2: 'site-card--s2',
        MOD_S3: 'site-card--s3',
        MOD_ERROR: 'site-card--error',
        MOD_HAS_CRITICAL: 'site-card--has-critical',
        
        // Badge Modifiers
        BADGE_SUCCESS: 'badge--success',
        BADGE_WARNING: 'badge--warning',
        BADGE_ERROR: 'badge--error',
        BADGE_PARTIAL: 'badge--partial',
        BADGE_INFO: 'badge--info',
        BADGE_CRITICAL: 'badge--critical',
        
        // Stats
        STATS_GRID: 'stats-grid',
        STAT_ITEM: 'stat-item',
        STAT_ICON: 'stat-icon',
        STAT_VALUE: 'stat-value',
        STAT_LABEL: 'stat-label',
        STAT_RUN: 'stat-item--run',
        STAT_IDLE: 'stat-item--idle',
        STAT_STOP: 'stat-item--stop',
        STAT_DISC: 'stat-item--disc',
        STAT_COMPACT: 'stat-compact',
        
        // Production
        PROD_ITEM: 'production-item',
        PROD_ICON: 'production-icon',
        PROD_VALUE: 'production-value',
        PROD_LABEL: 'production-label',
        PROD_ALERT: 'production-item--alert',
        
        // Setup
        SETUP_ITEM: 'setup-item',
        SETUP_OK: 'setup-item--ok',
        SETUP_MISSING: 'setup-item--missing',
        SETUP_ICON: 'setup-icon',
        SETUP_TEXT: 'setup-text',
        GUIDE_TITLE: 'guide-title',
        GUIDE_STEPS: 'guide-steps',
        
        // Error
        ERROR_ICON: 'error-icon',
        ERROR_MESSAGE: 'error-message',
        ERROR_HINT: 'error-hint',
        
        // Buttons
        BTN: 'btn',
        BTN_PRIMARY: 'btn--primary',
        BTN_SECONDARY: 'btn--secondary',
        BTN_ACCENT: 'btn--accent',
        BTN_TEXT: 'btn--text',
        BTN_FULL: 'btn--full',
        
        // Action Row
        ACTION_ROW: 'action-row',
        ACTION_PRIMARY: 'action-row--primary',
        ACTION_SECONDARY: 'action-row--secondary'
    };

    // =========================================================
    // Constructor
    // =========================================================
    
    /**
     * @param {Object} options
     * @param {Object} options.siteData - Site 데이터
     * @param {Function} options.onModeSelect - Mode 선택 콜백
     * @param {Function} options.onRetry - 재연결 콜백
     */
    constructor({ siteData, onModeSelect, onRetry }) {
        this.siteData = siteData;
        this.onModeSelect = onModeSelect;
        this.onRetry = onRetry;
        
        this.element = null;
        this._eventListeners = [];
    }
    
    // =========================================================
    // Rendering
    // =========================================================
    
    /**
     * Card 렌더링
     * @returns {HTMLElement}
     */
    render() {
        const { site_id, display_name, flag_emoji, process, critical_equipments } = this.siteData;
        const CSS = SiteCard.CSS;
        
        // 시나리오 클래스 결정
        const scenarioClass = this._getScenarioClass();
        
        // Critical Equipment 존재 시 추가 클래스
        const hasCritical = critical_equipments && critical_equipments.length > 0;
        const criticalClass = hasCritical ? CSS.MOD_HAS_CRITICAL : '';
        
        // Element 생성
        this.element = document.createElement('div');
        this.element.className = `${CSS.BLOCK} ${scenarioClass} ${criticalClass}`.trim();
        this.element.dataset.siteId = site_id;
        
        this.element.innerHTML = `
            <div class="${CSS.HEADER}">
                <div class="${CSS.TITLE}">
                    <span class="${CSS.FLAG}">${flag_emoji || this._getFlag(site_id)}</span>
                    <span class="${CSS.NAME}">${display_name || site_id}</span>
                </div>
                <span class="${CSS.PROCESS}">${process || 'Unknown'}</span>
            </div>
            
            <div class="${CSS.STATUS}">
                ${this._renderStatusBadge()}
            </div>
            
            <div class="${CSS.BODY}">
                ${this._renderBodyContent()}
            </div>
            
            <div class="${CSS.ACTIONS}">
                ${this._renderActions()}
            </div>
        `;
        
        // 이벤트 바인딩
        this._bindEvents();
        
        return this.element;
    }
    
    /**
     * Status Badge 렌더링
     * @returns {string}
     */
    _renderStatusBadge() {
        const { status, readiness, critical_equipments } = this.siteData;
        const CSS = SiteCard.CSS;
        
        // 연결 에러
        if (status === SiteStatus.UNHEALTHY || status === SiteStatus.DISCONNECTED) {
            return `<span class="${CSS.BADGE} ${CSS.BADGE_ERROR}">❌ Connection Failed</span>`;
        }
        
        // Critical Equipment 존재 시 Critical 배지 추가 표시
        const hasCritical = critical_equipments && critical_equipments.length > 0;
        let criticalBadge = '';
        if (hasCritical && readiness === SiteReadiness.S2) {
            criticalBadge = `<span class="${CSS.BADGE} ${CSS.BADGE_CRITICAL}">🚨 Critical ${critical_equipments.length}</span>`;
        }
        
        // 시나리오별 뱃지
        let statusBadge = '';
        switch (readiness) {
            case SiteReadiness.S2:
                statusBadge = `<span class="${CSS.BADGE} ${CSS.BADGE_SUCCESS}">✅ Ready</span>`;
                break;
            case SiteReadiness.S1:
                statusBadge = `<span class="${CSS.BADGE} ${CSS.BADGE_WARNING}">⚠️ Mapping Required</span>`;
                break;
            case SiteReadiness.S0:
                statusBadge = `<span class="${CSS.BADGE} ${CSS.BADGE_WARNING}">⚠️ Setup Required</span>`;
                break;
            case SiteReadiness.S3:
                statusBadge = `<span class="${CSS.BADGE} ${CSS.BADGE_PARTIAL}">🔶 Partial Setup</span>`;
                break;
            default:
                statusBadge = `<span class="${CSS.BADGE} ${CSS.BADGE_INFO}">❓ Unknown</span>`;
        }
        
        return criticalBadge ? `${criticalBadge} ${statusBadge}` : statusBadge;
    }
    
    /**
     * Body Content 렌더링 (시나리오별)
     * @returns {string}
     */
    _renderBodyContent() {
        const { readiness, status } = this.siteData;
        
        // 에러 상태
        if (status === SiteStatus.UNHEALTHY || status === SiteStatus.DISCONNECTED) {
            return this._renderErrorContent();
        }
        
        // 시나리오별 렌더링
        switch (readiness) {
            case SiteReadiness.S2:
                return this._renderS2Content();
            case SiteReadiness.S1:
                return this._renderS1Content();
            case SiteReadiness.S0:
                return this._renderS0Content();
            case SiteReadiness.S3:
                return this._renderS3Content();
            default:
                return this._renderS0Content();
        }
    }
    
    /**
     * S0 Content (Layout ❌, Mapping ❌)
     */
    _renderS0Content() {
        const CSS = SiteCard.CSS;
        
        return `
            <div class="${CSS.SETUP_STATUS}">
                <div class="${CSS.SETUP_ITEM} ${CSS.SETUP_MISSING}">
                    <span class="${CSS.SETUP_ICON}">❌</span>
                    <span class="${CSS.SETUP_TEXT}">Layout 파일 없음</span>
                </div>
                <div class="${CSS.SETUP_ITEM} ${CSS.SETUP_MISSING}">
                    <span class="${CSS.SETUP_ICON}">❌</span>
                    <span class="${CSS.SETUP_TEXT}">Mapping 파일 없음</span>
                </div>
            </div>
            <div class="${CSS.GUIDE}">
                <p class="${CSS.GUIDE_TITLE}">📝 Setup 순서:</p>
                <ol class="${CSS.GUIDE_STEPS}">
                    <li>Layout Editor → 설비 배치 생성</li>
                    <li>Mapping Tool → DB 설비 연결</li>
                </ol>
            </div>
        `;
    }
    
    /**
     * S1 Content (Layout ✅, Mapping ❌)
     */
    _renderS1Content() {
        const { equipment_count } = this.siteData;
        const CSS = SiteCard.CSS;
        
        return `
            <div class="${CSS.SETUP_STATUS}">
                <div class="${CSS.SETUP_ITEM} ${CSS.SETUP_OK}">
                    <span class="${CSS.SETUP_ICON}">✅</span>
                    <span class="${CSS.SETUP_TEXT}">Layout 파일 있음</span>
                </div>
                <div class="${CSS.SETUP_ITEM} ${CSS.SETUP_MISSING}">
                    <span class="${CSS.SETUP_ICON}">❌</span>
                    <span class="${CSS.SETUP_TEXT}">Mapping 파일 없음</span>
                </div>
            </div>
            ${equipment_count ? `
                <div class="${CSS.DB_INFO}">
                    <span class="db-icon">📊</span>
                    <span class="db-text">DB 설비: ${equipment_count}대 발견</span>
                </div>
            ` : ''}
            <div class="${CSS.NOTICE}">
                <p>⚠️ Mapping 완료 후 3D View 사용 가능</p>
            </div>
        `;
    }
    
    /**
     * S2 Content (Ready - Layout ✅, Mapping ✅)
     * @description FR-DASH-002 준수 - Critical Equipment 하이라이트 포함
     */
    _renderS2Content() {
        const { stats, production, alarms, critical_equipments } = this.siteData;
        const { total = 0, run = 0, idle = 0, stop = 0, disc = 0 } = stats || {};
        const CSS = SiteCard.CSS;
        
        // Stats Grid
        const statsHtml = `
            <div class="${CSS.STATS}">
                <div class="${CSS.STATS_GRID}">
                    <div class="${CSS.STAT_ITEM} ${CSS.STAT_RUN}">
                        <span class="${CSS.STAT_ICON}">🟢</span>
                        <span class="${CSS.STAT_VALUE}">${run}</span>
                        <span class="${CSS.STAT_LABEL}">RUN</span>
                    </div>
                    <div class="${CSS.STAT_ITEM} ${CSS.STAT_IDLE}">
                        <span class="${CSS.STAT_ICON}">🟡</span>
                        <span class="${CSS.STAT_VALUE}">${idle}</span>
                        <span class="${CSS.STAT_LABEL}">IDLE</span>
                    </div>
                    <div class="${CSS.STAT_ITEM} ${CSS.STAT_STOP}">
                        <span class="${CSS.STAT_ICON}">🔴</span>
                        <span class="${CSS.STAT_VALUE}">${stop}</span>
                        <span class="${CSS.STAT_LABEL}">STOP</span>
                    </div>
                    <div class="${CSS.STAT_ITEM} ${CSS.STAT_DISC}">
                        <span class="${CSS.STAT_ICON}">⚫</span>
                        <span class="${CSS.STAT_VALUE}">${disc}</span>
                        <span class="${CSS.STAT_LABEL}">DISC</span>
                    </div>
                </div>
            </div>
        `;
        
        // Production & Alarms
        const productionHtml = `
            <div class="${CSS.PRODUCTION}">
                <div class="${CSS.PROD_ITEM}">
                    <span class="${CSS.PROD_ICON}">📊</span>
                    <span class="${CSS.PROD_VALUE}">${(production || 0).toLocaleString()}</span>
                    <span class="${CSS.PROD_LABEL}">생산량</span>
                </div>
                ${alarms > 0 ? `
                    <div class="${CSS.PROD_ITEM} ${CSS.PROD_ALERT}">
                        <span class="${CSS.PROD_ICON}">⚠️</span>
                        <span class="${CSS.PROD_VALUE}">${alarms}</span>
                        <span class="${CSS.PROD_LABEL}">알람</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Critical Equipment 하이라이트 (FR-DASH-002)
        const criticalHtml = this._renderCriticalEquipments(critical_equipments);
        
        return statsHtml + productionHtml + criticalHtml;
    }
    
    /**
     * Critical Equipment 하이라이트 렌더링
     * @param {Array} critical_equipments - Critical 설비 목록
     * @returns {string} HTML 문자열
     * @description FR-DASH-002 요구사항 충족
     */
    _renderCriticalEquipments(critical_equipments) {
        if (!critical_equipments || critical_equipments.length === 0) {
            return '';
        }
        
        const CSS = SiteCard.CSS;
        
        // 최대 3개까지만 표시 (나머지는 카운트로)
        const displayEquipments = critical_equipments.slice(0, 3);
        const remainingCount = critical_equipments.length - 3;
        
        const equipmentListHtml = displayEquipments.map(eq => {
            const duration = this._formatDuration(eq.duration_seconds);
            const statusIcon = this._getStatusIcon(eq.status);
            
            return `
                <div class="${CSS.CRITICAL_ITEM}">
                    <span class="${CSS.CRITICAL_EQ_ID}">${eq.frontend_id || eq.equipment_id}</span>
                    <span class="${CSS.CRITICAL_EQ_STATUS}">${statusIcon} ${eq.status}</span>
                    <span class="${CSS.CRITICAL_EQ_DURATION}">${duration}</span>
                </div>
            `;
        }).join('');
        
        const moreHtml = remainingCount > 0 
            ? `<div class="${CSS.CRITICAL_ITEM}">... 외 ${remainingCount}대</div>` 
            : '';
        
        return `
            <div class="${CSS.CRITICAL}">
                <div class="${CSS.CRITICAL_HEADER}">
                    <span class="${CSS.CRITICAL_ICON}">🚨</span>
                    <span class="${CSS.CRITICAL_COUNT}">Critical Equipment (${critical_equipments.length})</span>
                </div>
                <div class="${CSS.CRITICAL_LIST}">
                    ${equipmentListHtml}
                    ${moreHtml}
                </div>
            </div>
        `;
    }
    
    /**
     * Duration 포맷팅
     * @param {number} seconds - 초 단위 시간
     * @returns {string} 포맷된 문자열 (예: "2분 30초", "1시간 15분")
     */
    _formatDuration(seconds) {
        if (!seconds || seconds < 0) return '-';
        
        if (seconds < 60) {
            return `${seconds}초`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
        }
    }
    
    /**
     * Status별 아이콘 반환
     * @param {string} status - 설비 상태
     * @returns {string} 아이콘
     */
    _getStatusIcon(status) {
        const statusIcons = {
            'SUDDENSTOP': '🔴',
            'STOP': '🔴',
            'ALARM': '⚠️',
            'ERROR': '❌',
            'DISC': '⚫',
            'IDLE': '🟡'
        };
        return statusIcons[status] || '🔴';
    }
    
    /**
     * S3 Content (Partial - Layout ❌, Mapping ✅)
     */
    _renderS3Content() {
        const { stats, production, equipment_count } = this.siteData;
        const { run = 0, idle = 0, stop = 0 } = stats || {};
        const CSS = SiteCard.CSS;
        
        return `
            <div class="${CSS.SETUP_STATUS}">
                <div class="${CSS.SETUP_ITEM} ${CSS.SETUP_MISSING}">
                    <span class="${CSS.SETUP_ICON}">❌</span>
                    <span class="${CSS.SETUP_TEXT}">Layout 파일 없음</span>
                </div>
                <div class="${CSS.SETUP_ITEM} ${CSS.SETUP_OK}">
                    <span class="${CSS.SETUP_ICON}">✅</span>
                    <span class="${CSS.SETUP_TEXT}">Mapping 완료 (${equipment_count || 0}대)</span>
                </div>
            </div>
            <div class="${CSS.STATS_COMPACT}">
                <span class="${CSS.STAT_COMPACT}">🟢 ${run}</span>
                <span class="${CSS.STAT_COMPACT}">🟡 ${idle}</span>
                <span class="${CSS.STAT_COMPACT}">🔴 ${stop}</span>
            </div>
            <div class="${CSS.NOTICE}">
                <p>💡 Layout 생성 시 3D View 사용 가능</p>
            </div>
        `;
    }
    
    /**
     * Error Content
     */
    _renderErrorContent() {
        const CSS = SiteCard.CSS;
        
        return `
            <div class="${CSS.ERROR}">
                <span class="${CSS.ERROR_ICON}">🔌</span>
                <p class="${CSS.ERROR_MESSAGE}">서버 연결 실패</p>
                <p class="${CSS.ERROR_HINT}">DB 서버 상태를 확인해주세요.</p>
            </div>
        `;
    }
    
    /**
     * Actions 렌더링 (시나리오별)
     * @returns {string}
     */
    _renderActions() {
        const { readiness, status } = this.siteData;
        const CSS = SiteCard.CSS;
        
        // 에러 상태
        if (status === SiteStatus.UNHEALTHY || status === SiteStatus.DISCONNECTED) {
            return `
                <button class="${CSS.BTN} ${CSS.BTN_PRIMARY} ${CSS.BTN_FULL}" data-action="retry">
                    🔄 재연결 시도
                </button>
            `;
        }
        
        // 시나리오별 액션
        switch (readiness) {
            case SiteReadiness.S2:
                return this._renderS2Actions();
            case SiteReadiness.S1:
                return this._renderS1Actions();
            case SiteReadiness.S0:
                return this._renderS0Actions();
            case SiteReadiness.S3:
                return this._renderS3Actions();
            default:
                return this._renderS0Actions();
        }
    }
    
    /**
     * S0 Actions
     */
    _renderS0Actions() {
        const CSS = SiteCard.CSS;
        
        return `
            <button class="${CSS.BTN} ${CSS.BTN_PRIMARY} ${CSS.BTN_FULL}" data-action="layout-editor">
                📝 Layout Editor
            </button>
            <button class="${CSS.BTN} ${CSS.BTN_SECONDARY} ${CSS.BTN_FULL}" data-action="analysis">
                📈 Analysis Mode
            </button>
        `;
    }
    
    /**
     * S1 Actions
     */
    _renderS1Actions() {
        const CSS = SiteCard.CSS;
        
        return `
            <div class="${CSS.ACTION_ROW}">
                <button class="${CSS.BTN} ${CSS.BTN_PRIMARY}" data-action="mapping-tool">
                    🔗 Mapping Tool
                </button>
                <button class="${CSS.BTN} ${CSS.BTN_SECONDARY}" data-action="layout-editor">
                    📝 Edit Layout
                </button>
            </div>
            <div class="${CSS.ACTION_ROW} ${CSS.ACTION_SECONDARY}">
                <button class="${CSS.BTN} ${CSS.BTN_TEXT}" data-action="ranking">
                    📊 Ranking
                </button>
                <button class="${CSS.BTN} ${CSS.BTN_TEXT}" data-action="analysis">
                    📈 Analysis
                </button>
            </div>
        `;
    }
    
    /**
     * S2 Actions (Ready)
     */
    _renderS2Actions() {
        const CSS = SiteCard.CSS;
        
        return `
            <div class="${CSS.ACTION_ROW} ${CSS.ACTION_PRIMARY}">
                <button class="${CSS.BTN} ${CSS.BTN_PRIMARY}" data-action="3d">
                    🎮 3D View
                </button>
                <button class="${CSS.BTN} ${CSS.BTN_SECONDARY}" data-action="ranking">
                    📊 Ranking
                </button>
            </div>
            <button class="${CSS.BTN} ${CSS.BTN_ACCENT} ${CSS.BTN_FULL}" data-action="analysis">
                📈 Analysis Mode
            </button>
        `;
    }
    
    /**
     * S3 Actions (Partial)
     */
    _renderS3Actions() {
        const CSS = SiteCard.CSS;
        
        return `
            <div class="${CSS.ACTION_ROW}">
                <button class="${CSS.BTN} ${CSS.BTN_PRIMARY}" data-action="ranking">
                    📊 Ranking View
                </button>
                <button class="${CSS.BTN} ${CSS.BTN_SECONDARY}" data-action="analysis">
                    📈 Analysis
                </button>
            </div>
            <button class="${CSS.BTN} ${CSS.BTN_TEXT} ${CSS.BTN_FULL}" data-action="layout-editor">
                📝 Create Layout
            </button>
        `;
    }
    
    // =========================================================
    // Helpers
    // =========================================================
    
    /**
     * Site ID에서 국가 플래그 추출
     * @param {string} siteId
     * @returns {string}
     */
    _getFlag(siteId) {
        if (!siteId) return COUNTRY_FLAGS.DEFAULT;
        const countryCode = siteId.split('_')[0];
        return COUNTRY_FLAGS[countryCode] || COUNTRY_FLAGS.DEFAULT;
    }
    
    /**
     * 시나리오 클래스 결정
     * @returns {string}
     */
    _getScenarioClass() {
        const { readiness, status } = this.siteData;
        const CSS = SiteCard.CSS;
        
        if (status === SiteStatus.UNHEALTHY || status === SiteStatus.DISCONNECTED) {
            return CSS.MOD_ERROR;
        }
        
        switch (readiness) {
            case SiteReadiness.S0: return CSS.MOD_S0;
            case SiteReadiness.S1: return CSS.MOD_S1;
            case SiteReadiness.S2: return CSS.MOD_S2;
            case SiteReadiness.S3: return CSS.MOD_S3;
            default: return CSS.MOD_S0;
        }
    }
    
    // =========================================================
    // Events
    // =========================================================
    
    /**
     * 이벤트 바인딩
     */
    _bindEvents() {
        if (!this.element) return;
        
        // 버튼 클릭 이벤트 위임
        const handler = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            this._handleAction(action);
        };
        
        this.element.addEventListener('click', handler);
        this._eventListeners.push({ element: this.element, type: 'click', handler });
    }
    
    /**
     * 액션 처리
     * @param {string} action
     */
    _handleAction(action) {
        const siteId = this.siteData.site_id;
        
        // 액션 → 모드 매핑
        const modeMapping = {
            '3d': 'monitoring',
            'ranking': 'ranking',
            'analysis': 'analysis',
            'layout-editor': 'setup',
            'mapping-tool': 'setup',
            'retry': 'retry'
        };
        
        const mode = modeMapping[action];
        
        if (action === 'retry') {
            // 재연결 시도
            if (this.onRetry) {
                this.onRetry(siteId);
            }
        } else if (mode && this.onModeSelect) {
            // Mode 전환
            this.onModeSelect({ siteId, mode, action });
        }
    }
    
    // =========================================================
    // Update
    // =========================================================
    
    /**
     * Card 업데이트
     * @param {Object} newSiteData
     */
    update(newSiteData) {
        this.siteData = { ...this.siteData, ...newSiteData };
        
        if (!this.element) return;
        
        const CSS = SiteCard.CSS;
        const { critical_equipments } = this.siteData;
        
        // 시나리오 클래스 업데이트
        const scenarioClass = this._getScenarioClass();
        const hasCritical = critical_equipments && critical_equipments.length > 0;
        const criticalClass = hasCritical ? CSS.MOD_HAS_CRITICAL : '';
        this.element.className = `${CSS.BLOCK} ${scenarioClass} ${criticalClass}`.trim();
        
        // Status Badge 업데이트
        const statusEl = this.element.querySelector(`.${CSS.STATUS}`);
        if (statusEl) {
            statusEl.innerHTML = this._renderStatusBadge();
        }
        
        // Body 업데이트
        const bodyEl = this.element.querySelector(`.${CSS.BODY}`);
        if (bodyEl) {
            bodyEl.innerHTML = this._renderBodyContent();
        }
        
        // Actions 업데이트
        const actionsEl = this.element.querySelector(`.${CSS.ACTIONS}`);
        if (actionsEl) {
            actionsEl.innerHTML = this._renderActions();
        }
    }
    
    // =========================================================
    // Cleanup
    // =========================================================
    
    /**
     * 리소스 정리
     */
    destroy() {
        // 이벤트 리스너 제거
        this._eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this._eventListeners = [];
        
        // DOM 제거
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}

export default SiteCard;