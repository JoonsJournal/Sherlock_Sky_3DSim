/**
 * DashboardState.js - Dashboard 상태 관리
 * 
 * @version 1.0.1
 * @created 2026-02-03
 * @modified 2026-02-03
 * @phase Phase 2: Site Dashboard 구현
 * 
 * @description
 * Dashboard의 전역 상태를 관리하는 Reactive State Container
 * - Site 목록 및 상태
 * - WebSocket 연결 상태
 * - 선택된 Site
 * - 마지막 업데이트 시간
 * 
 * @dependencies
 * - 없음 (독립적인 상태 관리 모듈)
 * 
 * @exports
 * - StateEvents: 상태 변경 이벤트 타입
 * - SiteReadiness: Site 준비 상태 (시나리오)
 * - SiteStatus: Site 연결 상태
 * - DashboardState: 상태 관리 클래스
 * - getDashboardState: 싱글톤 인스턴스 getter
 * 
 * @changelog
 * - v1.0.0 (2026-02-03): 최초 구현
 * - v1.0.1 (2026-02-03): 가이드라인 준수, 문서화 보완
 * 
 * 위치: frontend/threejs_viewer/src/dashboard/DashboardState.js
 */

// =========================================================
// Constants
// =========================================================

/**
 * 상태 변경 이벤트 타입
 * @readonly
 * @enum {string}
 */
export const StateEvents = {
    /** Site 목록 전체 업데이트 */
    SITES_UPDATED: 'sites:updated',
    /** Site 추가 */
    SITE_ADDED: 'site:added',
    /** Site 제거 */
    SITE_REMOVED: 'site:removed',
    /** Site 상태 변경 */
    SITE_STATUS_CHANGED: 'site:status:changed',
    /** 선택된 Site 변경 */
    SELECTED_SITE_CHANGED: 'selected:changed',
    /** 연결 상태 변경 */
    CONNECTION_STATUS_CHANGED: 'connection:changed',
    /** 에러 발생 */
    ERROR: 'error'
};

/**
 * Site 준비 상태 (시나리오)
 * @readonly
 * @enum {string}
 */
export const SiteReadiness = {
    /** S0: Layout ❌, Mapping ❌ */
    S0: 's0',
    /** S1: Layout ✅, Mapping ❌ */
    S1: 's1',
    /** S2: Layout ✅, Mapping ✅ (Ready) */
    S2: 's2',
    /** S3: Layout ❌, Mapping ✅ (Partial) */
    S3: 's3',
    /** ERROR: 연결 에러 */
    ERROR: 'error'
};

/**
 * Site 연결 상태
 * @readonly
 * @enum {string}
 */
export const SiteStatus = {
    /** 정상 연결 */
    HEALTHY: 'healthy',
    /** 연결 불안정 */
    UNHEALTHY: 'unhealthy',
    /** 연결 중 */
    CONNECTING: 'connecting',
    /** 연결 끊김 */
    DISCONNECTED: 'disconnected',
    /** 상태 불명 */
    UNKNOWN: 'unknown'
};

// =========================================================
// DashboardState Class
// =========================================================

/**
 * DashboardState 클래스
 * Dashboard의 전역 상태를 관리하는 Reactive State Container
 */
export class DashboardState {
    /**
     * DashboardState 생성자
     */
    constructor() {
        // 상태 저장소
        this._state = {
            sites: new Map(),           // site_id → SiteData
            selectedSiteId: null,
            wsConnected: false,
            lastUpdated: null,
            totalStats: {
                total: 0,
                run: 0,
                idle: 0,
                stop: 0,
                disc: 0,
                production: 0,
                alarms: 0
            }
        };
        
        // 이벤트 리스너
        this._listeners = new Map();
        
        // 상태 히스토리 (디버깅용)
        this._history = [];
        this._maxHistorySize = 50;
    }
    
    // =========================================================
    // Getters
    // =========================================================
    
    /**
     * 모든 Site 목록
     * @returns {Array<Object>}
     */
    get sites() {
        return Array.from(this._state.sites.values());
    }
    
    /**
     * Site Map 직접 접근
     * @returns {Map}
     */
    get sitesMap() {
        return this._state.sites;
    }
    
    /**
     * 선택된 Site ID
     * @returns {string|null}
     */
    get selectedSiteId() {
        return this._state.selectedSiteId;
    }
    
    /**
     * 선택된 Site 데이터
     * @returns {Object|null}
     */
    get selectedSite() {
        if (!this._state.selectedSiteId) return null;
        return this._state.sites.get(this._state.selectedSiteId) || null;
    }
    
    /**
     * WebSocket 연결 상태
     * @returns {boolean}
     */
    get wsConnected() {
        return this._state.wsConnected;
    }
    
    /**
     * 마지막 업데이트 시간
     * @returns {Date|null}
     */
    get lastUpdated() {
        return this._state.lastUpdated;
    }
    
    /**
     * 전체 통계
     * @returns {Object}
     */
    get totalStats() {
        return { ...this._state.totalStats };
    }
    
    /**
     * Ready 상태인 Site 목록
     * @returns {Array<Object>}
     */
    get readySites() {
        return this.sites.filter(site => site.readiness === SiteReadiness.S2);
    }
    
    /**
     * Setup 필요한 Site 목록
     * @returns {Array<Object>}
     */
    get setupRequiredSites() {
        return this.sites.filter(site => 
            site.readiness === SiteReadiness.S0 || 
            site.readiness === SiteReadiness.S1
        );
    }
    
    /**
     * 에러 상태인 Site 목록
     * @returns {Array<Object>}
     */
    get errorSites() {
        return this.sites.filter(site => 
            site.status === SiteStatus.UNHEALTHY || 
            site.status === SiteStatus.DISCONNECTED ||
            site.readiness === SiteReadiness.ERROR
        );
    }
    
    // =========================================================
    // Setters / Actions
    // =========================================================
    
    /**
     * Site 추가 또는 업데이트
     * @param {Object} siteData - Site 데이터
     */
    setSite(siteData) {
        if (!siteData || !siteData.site_id) {
            console.warn('⚠️ Invalid site data:', siteData);
            return;
        }
        
        const siteId = siteData.site_id;
        const existing = this._state.sites.get(siteId);
        const isNew = !existing;
        
        // Readiness 계산
        siteData.readiness = this._calculateReadiness(siteData);
        
        // 상태 업데이트
        this._state.sites.set(siteId, {
            ...existing,
            ...siteData,
            _lastUpdated: new Date()
        });
        
        this._recordHistory('setSite', { siteId, isNew });
        
        // 이벤트 발생
        if (isNew) {
            this._emit(StateEvents.SITE_ADDED, { siteId, site: siteData });
        } else {
            this._emit(StateEvents.SITE_STATUS_CHANGED, { siteId, site: siteData });
        }
        
        // 전체 통계 재계산
        this._recalculateTotalStats();
    }
    
    /**
     * 여러 Site 일괄 설정
     * @param {Array<Object>} sitesArray - Site 배열
     */
    setSites(sitesArray) {
        if (!Array.isArray(sitesArray)) {
            console.warn('⚠️ setSites expects an array:', sitesArray);
            return;
        }
        
        sitesArray.forEach(site => this.setSite(site));
        
        this._state.lastUpdated = new Date();
        this._emit(StateEvents.SITES_UPDATED, { sites: this.sites });
    }
    
    /**
     * Site 제거
     * @param {string} siteId - Site ID
     */
    removeSite(siteId) {
        if (this._state.sites.has(siteId)) {
            this._state.sites.delete(siteId);
            
            // 선택된 Site가 제거된 경우 선택 해제
            if (this._state.selectedSiteId === siteId) {
                this._state.selectedSiteId = null;
                this._emit(StateEvents.SELECTED_SITE_CHANGED, { siteId: null });
            }
            
            this._recordHistory('removeSite', { siteId });
            this._emit(StateEvents.SITE_REMOVED, { siteId });
            this._recalculateTotalStats();
        }
    }
    
    /**
     * Site 선택
     * @param {string|null} siteId - Site ID (null이면 선택 해제)
     */
    selectSite(siteId) {
        const previous = this._state.selectedSiteId;
        
        if (siteId && !this._state.sites.has(siteId)) {
            console.warn(`⚠️ Site not found: ${siteId}`);
            return;
        }
        
        this._state.selectedSiteId = siteId;
        
        if (previous !== siteId) {
            this._recordHistory('selectSite', { previous, current: siteId });
            this._emit(StateEvents.SELECTED_SITE_CHANGED, { 
                previous, 
                current: siteId,
                site: this.selectedSite
            });
        }
    }
    
    /**
     * Site Stats 업데이트 (Summary Update)
     * @param {string} siteId - Site ID
     * @param {Object} stats - Stats 데이터
     */
    updateSiteStats(siteId, stats) {
        const site = this._state.sites.get(siteId);
        if (!site) {
            console.warn(`⚠️ Site not found for stats update: ${siteId}`);
            return;
        }
        
        site.stats = { ...site.stats, ...stats };
        site._lastUpdated = new Date();
        
        this._emit(StateEvents.SITE_STATUS_CHANGED, { siteId, site, stats });
        this._recalculateTotalStats();
    }
    
    /**
     * WebSocket 연결 상태 설정
     * @param {boolean} connected
     */
    setWsConnected(connected) {
        const previous = this._state.wsConnected;
        this._state.wsConnected = connected;
        
        if (previous !== connected) {
            this._recordHistory('setWsConnected', { previous, current: connected });
            this._emit(StateEvents.CONNECTION_STATUS_CHANGED, { connected });
        }
    }
    
    /**
     * 상태 초기화
     */
    reset() {
        this._state.sites.clear();
        this._state.selectedSiteId = null;
        this._state.wsConnected = false;
        this._state.lastUpdated = null;
        this._state.totalStats = {
            total: 0, run: 0, idle: 0, stop: 0, disc: 0, production: 0, alarms: 0
        };
        
        this._recordHistory('reset', {});
        this._emit(StateEvents.SITES_UPDATED, { sites: [] });
    }
    
    // =========================================================
    // Event System
    // =========================================================
    
    /**
     * 이벤트 구독
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        
        // 구독 해제 함수 반환
        return () => this.off(event, callback);
    }
    
    /**
     * 이벤트 구독 해제
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    off(event, callback) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).delete(callback);
        }
    }
    
    /**
     * 이벤트 발생
     * @param {string} event - 이벤트 이름
     * @param {*} data - 이벤트 데이터
     * @private
     */
    _emit(event, data) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in event listener [${event}]:`, error);
                }
            });
        }
    }
    
    // =========================================================
    // Private Methods
    // =========================================================
    
    /**
     * Site Readiness 계산
     * @param {Object} siteData
     * @returns {string} SiteReadiness 값
     * @private
     */
    _calculateReadiness(siteData) {
        const { has_layout, has_mapping, status } = siteData;
        
        // 에러 상태 체크
        if (status === SiteStatus.UNHEALTHY || status === SiteStatus.DISCONNECTED) {
            return SiteReadiness.ERROR;
        }
        
        // 시나리오 판단
        if (has_layout && has_mapping) {
            return SiteReadiness.S2; // Ready
        } else if (has_layout && !has_mapping) {
            return SiteReadiness.S1; // Layout만 있음
        } else if (!has_layout && has_mapping) {
            return SiteReadiness.S3; // Mapping만 있음 (Partial)
        } else {
            return SiteReadiness.S0; // 둘 다 없음
        }
    }
    
    /**
     * 전체 통계 재계산
     * @private
     */
    _recalculateTotalStats() {
        const totals = {
            total: 0,
            run: 0,
            idle: 0,
            stop: 0,
            disc: 0,
            production: 0,
            alarms: 0
        };
        
        this._state.sites.forEach(site => {
            if (site.stats) {
                totals.total += site.stats.total || 0;
                totals.run += site.stats.run || 0;
                totals.idle += site.stats.idle || 0;
                totals.stop += site.stats.stop || 0;
                totals.disc += site.stats.disc || 0;
                totals.production += site.stats.production || site.production || 0;
                totals.alarms += site.stats.alarms || site.alarms || 0;
            }
        });
        
        this._state.totalStats = totals;
    }
    
    /**
     * 상태 히스토리 기록 (디버깅용)
     * @param {string} action - 액션 이름
     * @param {Object} data - 데이터
     * @private
     */
    _recordHistory(action, data) {
        this._history.push({
            timestamp: new Date().toISOString(),
            action,
            data
        });
        
        // 최대 크기 유지
        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }
    }
    
    // =========================================================
    // Debug / Export
    // =========================================================
    
    /**
     * 현재 상태 스냅샷
     * @returns {Object}
     */
    getSnapshot() {
        return {
            sites: this.sites,
            selectedSiteId: this._state.selectedSiteId,
            wsConnected: this._state.wsConnected,
            lastUpdated: this._state.lastUpdated,
            totalStats: this.totalStats
        };
    }
    
    /**
     * 상태 히스토리 조회
     * @returns {Array}
     */
    getHistory() {
        return [...this._history];
    }
    
    /**
     * JSON 직렬화
     * @returns {string}
     */
    toJSON() {
        return JSON.stringify(this.getSnapshot(), null, 2);
    }
}

// =========================================================
// Singleton Instance
// =========================================================

let instance = null;

/**
 * 싱글톤 인스턴스 가져오기
 * @returns {DashboardState}
 */
export function getDashboardState() {
    if (!instance) {
        instance = new DashboardState();
    }
    return instance;
}

export default DashboardState;