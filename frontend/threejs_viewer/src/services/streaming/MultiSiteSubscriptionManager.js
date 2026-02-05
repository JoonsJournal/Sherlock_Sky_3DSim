/**
 * MultiSiteSubscriptionManager.js
 * ================================
 * Multi-Site 개별 구독 관리 확장 모듈
 * 
 * @version 2.0.0
 * @description
 * - Site별로 다른 구독 레벨 적용
 * - 기존 SubscriptionLevelManager 확장
 * - 활성/비활성 Site 관리
 * - Site별 선택 설비 관리
 * 
 * @changelog
 * - v2.0.0 (2026-02-04): 초기 구현
 *           - SiteSubscription 클래스
 *           - MultiSiteSubscriptionManager 클래스
 *           - site_subscription_change 메시지 발행
 *           - Site별 필터링 지원
 * 
 * @dependencies
 * - SubscriptionLevelManager (기존 모듈)
 * - EventBus
 * - WebSocketPoolManager
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/streaming/MultiSiteSubscriptionManager.js
 * 작성일: 2026-02-04
 */

import { eventBus } from '../../core/managers/EventBus.js';

// =============================================================================
// 상수 정의
// =============================================================================

/**
 * 데이터 구독 레벨 (기존 SubscriptionLevelManager와 동일)
 */
const DATA_SUBSCRIPTION_LEVEL = Object.freeze({
    MINIMAL: 'MINIMAL',
    STANDARD: 'STANDARD',
    DETAILED: 'DETAILED'
});

/**
 * Site 구독 이벤트
 */
const SITE_SUBSCRIPTION_EVENTS = Object.freeze({
    SITE_ADDED: 'site:subscription:added',
    SITE_REMOVED: 'site:subscription:removed',
    SITE_ACTIVATED: 'site:subscription:activated',
    SITE_DEACTIVATED: 'site:subscription:deactivated',
    SITE_LEVEL_CHANGED: 'site:subscription:level-changed',
    ACTIVE_SITE_CHANGED: 'site:subscription:active-changed'
});

/**
 * WebSocket 메시지 타입
 */
const WS_MESSAGE_TYPES = Object.freeze({
    SITE_SUBSCRIPTION_CHANGE: 'site_subscription_change',
    BATCH_SITE_SUBSCRIPTION_CHANGE: 'batch_site_subscription_change'
});

// =============================================================================
// SiteSubscription 클래스
// =============================================================================

/**
 * 개별 Site의 구독 상태
 */
class SiteSubscription {
    /**
     * @param {string} siteId - Site 고유 ID (예: "korea_site1_line1")
     * @param {Object} options - 초기 설정
     */
    constructor(siteId, options = {}) {
        this.siteId = siteId;
        this.allLevel = options.allLevel || DATA_SUBSCRIPTION_LEVEL.MINIMAL;
        this.selectedLevel = options.selectedLevel || null;
        this.selectedIds = new Set(options.selectedIds || []);
        this.isActive = options.isActive !== false; // 기본값 true
        this.displayName = options.displayName || siteId;
        this.updatedAt = Date.now();
    }
    
    /**
     * 구독 상태 업데이트
     */
    update(options = {}) {
        if (options.allLevel !== undefined) {
            this.allLevel = options.allLevel;
        }
        if (options.selectedLevel !== undefined) {
            this.selectedLevel = options.selectedLevel;
        }
        if (options.selectedIds !== undefined) {
            this.selectedIds = new Set(options.selectedIds);
        }
        if (options.isActive !== undefined) {
            this.isActive = options.isActive;
        }
        this.updatedAt = Date.now();
    }
    
    /**
     * 설비 선택 추가
     */
    addSelectedId(frontendId) {
        this.selectedIds.add(frontendId);
        this.updatedAt = Date.now();
    }
    
    /**
     * 설비 선택 제거
     */
    removeSelectedId(frontendId) {
        this.selectedIds.delete(frontendId);
        this.updatedAt = Date.now();
    }
    
    /**
     * 모든 선택 해제
     */
    clearSelectedIds() {
        this.selectedIds.clear();
        this.updatedAt = Date.now();
    }
    
    /**
     * 특정 설비에 적용할 레벨 반환
     */
    getLevelForEquipment(frontendId) {
        if (this.selectedIds.has(frontendId) && this.selectedLevel) {
            return this.selectedLevel;
        }
        return this.allLevel;
    }
    
    /**
     * JSON 직렬화
     */
    toJSON() {
        return {
            site_id: this.siteId,
            all_level: this.allLevel,
            selected_level: this.selectedLevel,
            selected_ids: Array.from(this.selectedIds),
            is_active: this.isActive,
            display_name: this.displayName,
            updated_at: this.updatedAt
        };
    }
    
    /**
     * WebSocket 메시지용 객체
     */
    toMessage() {
        return {
            type: WS_MESSAGE_TYPES.SITE_SUBSCRIPTION_CHANGE,
            site_id: this.siteId,
            all_level: this.allLevel,
            selected_level: this.selectedLevel,
            selected_ids: Array.from(this.selectedIds),
            is_active: this.isActive
        };
    }
}

// =============================================================================
// MultiSiteSubscriptionManager 클래스
// =============================================================================

/**
 * Multi-Site 구독 관리자
 * 
 * @example
 * ```javascript
 * const manager = new MultiSiteSubscriptionManager();
 * 
 * // Site 추가
 * manager.addSite('korea_site1_line1', {
 *     allLevel: 'DETAILED',
 *     displayName: 'Korea Factory'
 * });
 * 
 * manager.addSite('vietnam_site1_line1', {
 *     allLevel: 'MINIMAL',
 *     displayName: 'Vietnam Factory'
 * });
 * 
 * // 활성 Site 변경
 * manager.setActiveSite('korea_site1_line1');
 * 
 * // Site별 레벨 변경
 * manager.setSiteLevel('vietnam_site1_line1', 'STANDARD');
 * ```
 */
class MultiSiteSubscriptionManager {
    constructor(options = {}) {
        /**
         * Site별 구독 상태
         * @type {Map<string, SiteSubscription>}
         */
        this._siteSubscriptions = new Map();
        
        /**
         * 현재 활성화된 Site ID
         * @type {string|null}
         */
        this._activeSiteId = null;
        
        /**
         * WebSocket 연결 참조
         * @type {WebSocket|null}
         */
        this._webSocket = null;
        
        /**
         * 메시지 전송 큐 (연결 전 메시지 버퍼)
         * @type {Array}
         */
        this._messageQueue = [];
        
        /**
         * 디버그 모드
         */
        this._debug = options.debug || false;
        
        // 이벤트 리스너 설정
        this._setupEventListeners();
        
        this._log('🌐 MultiSiteSubscriptionManager initialized (v2.0.0)');
    }
    
    // =========================================================================
    // Site 관리
    // =========================================================================
    
    /**
     * Site 추가
     * 
     * @param {string} siteId - Site ID
     * @param {Object} options - 구독 설정
     * @returns {SiteSubscription}
     */
    addSite(siteId, options = {}) {
        if (this._siteSubscriptions.has(siteId)) {
            this._log(`🔄 Site already exists: ${siteId}, updating...`);
            return this.updateSite(siteId, options);
        }
        
        const subscription = new SiteSubscription(siteId, options);
        this._siteSubscriptions.set(siteId, subscription);
        
        // 첫 번째 Site면 자동으로 활성화
        if (this._siteSubscriptions.size === 1 && subscription.isActive) {
            this._activeSiteId = siteId;
        }
        
        this._log(`➕ Site added: ${siteId} (${subscription.allLevel})`);
        
        // 이벤트 발행
        eventBus.emit(SITE_SUBSCRIPTION_EVENTS.SITE_ADDED, {
            siteId,
            subscription: subscription.toJSON()
        });
        
        // WebSocket 메시지 전송
        this._sendSiteSubscriptionChange(subscription);
        
        return subscription;
    }
    
    /**
     * Site 제거
     * 
     * @param {string} siteId - Site ID
     * @returns {boolean}
     */
    removeSite(siteId) {
        if (!this._siteSubscriptions.has(siteId)) {
            return false;
        }
        
        this._siteSubscriptions.delete(siteId);
        
        // 활성 Site가 제거되면 다른 Site 활성화
        if (this._activeSiteId === siteId) {
            const nextSite = this._getNextActiveSite();
            this._activeSiteId = nextSite;
        }
        
        this._log(`➖ Site removed: ${siteId}`);
        
        eventBus.emit(SITE_SUBSCRIPTION_EVENTS.SITE_REMOVED, { siteId });
        
        // 비활성 메시지 전송
        this._sendMessage({
            type: WS_MESSAGE_TYPES.SITE_SUBSCRIPTION_CHANGE,
            site_id: siteId,
            is_active: false
        });
        
        return true;
    }
    
    /**
     * Site 구독 업데이트
     * 
     * @param {string} siteId - Site ID
     * @param {Object} options - 업데이트 옵션
     * @returns {SiteSubscription|null}
     */
    updateSite(siteId, options = {}) {
        const subscription = this._siteSubscriptions.get(siteId);
        if (!subscription) {
            this._log(`⚠️ Site not found: ${siteId}`);
            return null;
        }
        
        const previousLevel = subscription.allLevel;
        subscription.update(options);
        
        this._log(`🔄 Site updated: ${siteId} (${subscription.allLevel})`);
        
        // 레벨 변경 이벤트
        if (options.allLevel && options.allLevel !== previousLevel) {
            eventBus.emit(SITE_SUBSCRIPTION_EVENTS.SITE_LEVEL_CHANGED, {
                siteId,
                previousLevel,
                newLevel: subscription.allLevel
            });
        }
        
        // WebSocket 메시지 전송
        this._sendSiteSubscriptionChange(subscription);
        
        return subscription;
    }
    
    /**
     * Site 조회
     * 
     * @param {string} siteId - Site ID
     * @returns {SiteSubscription|null}
     */
    getSite(siteId) {
        return this._siteSubscriptions.get(siteId) || null;
    }
    
    /**
     * 모든 Site 목록
     * 
     * @returns {Array<SiteSubscription>}
     */
    getAllSites() {
        return Array.from(this._siteSubscriptions.values());
    }
    
    /**
     * 활성화된 Site 목록
     * 
     * @returns {Array<SiteSubscription>}
     */
    getActiveSites() {
        return this.getAllSites().filter(sub => sub.isActive);
    }
    
    // =========================================================================
    // 활성 Site 관리
    // =========================================================================
    
    /**
     * 활성 Site 변경
     * 
     * @param {string} siteId - Site ID
     * @returns {boolean}
     */
    setActiveSite(siteId) {
        const subscription = this._siteSubscriptions.get(siteId);
        if (!subscription) {
            this._log(`⚠️ Cannot set active site: ${siteId} not found`);
            return false;
        }
        
        if (!subscription.isActive) {
            // 비활성 Site를 활성화
            subscription.isActive = true;
            this._sendSiteSubscriptionChange(subscription);
        }
        
        const previousSiteId = this._activeSiteId;
        this._activeSiteId = siteId;
        
        this._log(`🎯 Active site changed: ${previousSiteId} → ${siteId}`);
        
        eventBus.emit(SITE_SUBSCRIPTION_EVENTS.ACTIVE_SITE_CHANGED, {
            previousSiteId,
            newSiteId: siteId,
            subscription: subscription.toJSON()
        });
        
        return true;
    }
    
    /**
     * 현재 활성 Site ID 반환
     * 
     * @returns {string|null}
     */
    getActiveSiteId() {
        return this._activeSiteId;
    }
    
    /**
     * 현재 활성 Site 구독 반환
     * 
     * @returns {SiteSubscription|null}
     */
    getActiveSubscription() {
        if (!this._activeSiteId) return null;
        return this._siteSubscriptions.get(this._activeSiteId);
    }
    
    // =========================================================================
    // Site 활성화/비활성화
    // =========================================================================
    
    /**
     * Site 활성화 (데이터 수신 시작)
     * 
     * @param {string} siteId - Site ID
     * @returns {boolean}
     */
    activateSite(siteId) {
        const subscription = this._siteSubscriptions.get(siteId);
        if (!subscription) return false;
        
        if (subscription.isActive) return true; // 이미 활성
        
        subscription.isActive = true;
        
        this._log(`▶️ Site activated: ${siteId}`);
        
        eventBus.emit(SITE_SUBSCRIPTION_EVENTS.SITE_ACTIVATED, {
            siteId,
            subscription: subscription.toJSON()
        });
        
        this._sendSiteSubscriptionChange(subscription);
        
        return true;
    }
    
    /**
     * Site 비활성화 (데이터 수신 중단)
     * 
     * @param {string} siteId - Site ID
     * @returns {boolean}
     */
    deactivateSite(siteId) {
        const subscription = this._siteSubscriptions.get(siteId);
        if (!subscription) return false;
        
        if (!subscription.isActive) return true; // 이미 비활성
        
        subscription.isActive = false;
        
        // 활성 Site가 비활성화되면 다른 Site 활성화
        if (this._activeSiteId === siteId) {
            const nextSite = this._getNextActiveSite();
            this._activeSiteId = nextSite;
            
            if (nextSite) {
                eventBus.emit(SITE_SUBSCRIPTION_EVENTS.ACTIVE_SITE_CHANGED, {
                    previousSiteId: siteId,
                    newSiteId: nextSite
                });
            }
        }
        
        this._log(`⏸️ Site deactivated: ${siteId}`);
        
        eventBus.emit(SITE_SUBSCRIPTION_EVENTS.SITE_DEACTIVATED, {
            siteId
        });
        
        this._sendSiteSubscriptionChange(subscription);
        
        return true;
    }
    
    // =========================================================================
    // Site별 레벨 관리
    // =========================================================================
    
    /**
     * Site 기본 레벨 설정
     * 
     * @param {string} siteId - Site ID
     * @param {string} level - 구독 레벨
     * @returns {boolean}
     */
    setSiteLevel(siteId, level) {
        return !!this.updateSite(siteId, { allLevel: level });
    }
    
    /**
     * Site 선택 설비 레벨 설정
     * 
     * @param {string} siteId - Site ID
     * @param {string} level - 선택 설비 레벨
     * @param {Array<string>} selectedIds - 선택된 설비 ID 목록
     * @returns {boolean}
     */
    setSiteSelectedLevel(siteId, level, selectedIds = []) {
        return !!this.updateSite(siteId, {
            selectedLevel: level,
            selectedIds
        });
    }
    
    /**
     * Site에 선택 설비 추가
     * 
     * @param {string} siteId - Site ID
     * @param {string} frontendId - 설비 ID
     */
    addSiteSelectedEquipment(siteId, frontendId) {
        const subscription = this._siteSubscriptions.get(siteId);
        if (!subscription) return;
        
        subscription.addSelectedId(frontendId);
        this._sendSiteSubscriptionChange(subscription);
    }
    
    /**
     * Site에서 선택 설비 제거
     * 
     * @param {string} siteId - Site ID
     * @param {string} frontendId - 설비 ID
     */
    removeSiteSelectedEquipment(siteId, frontendId) {
        const subscription = this._siteSubscriptions.get(siteId);
        if (!subscription) return;
        
        subscription.removeSelectedId(frontendId);
        this._sendSiteSubscriptionChange(subscription);
    }
    
    // =========================================================================
    // 일괄 설정
    // =========================================================================
    
    /**
     * 여러 Site 일괄 설정
     * 
     * @param {Array<Object>} siteConfigs - Site 설정 배열
     * @example
     * manager.batchConfigureSites([
     *     { siteId: 'korea', allLevel: 'DETAILED', isActive: true },
     *     { siteId: 'vietnam', allLevel: 'MINIMAL', isActive: true },
     *     { siteId: 'usa', isActive: false }
     * ]);
     */
    batchConfigureSites(siteConfigs) {
        const messages = [];
        
        for (const config of siteConfigs) {
            const { siteId, ...options } = config;
            
            if (this._siteSubscriptions.has(siteId)) {
                this.updateSite(siteId, options);
            } else {
                this.addSite(siteId, options);
            }
            
            const subscription = this._siteSubscriptions.get(siteId);
            if (subscription) {
                messages.push(subscription.toMessage());
            }
        }
        
        // Batch 메시지로 한 번에 전송
        this._sendMessage({
            type: WS_MESSAGE_TYPES.BATCH_SITE_SUBSCRIPTION_CHANGE,
            sites: messages.map(m => ({
                site_id: m.site_id,
                all_level: m.all_level,
                selected_level: m.selected_level,
                selected_ids: m.selected_ids,
                is_active: m.is_active
            }))
        });
        
        this._log(`📦 Batch configured ${siteConfigs.length} sites`);
    }
    
    /**
     * 모든 Site를 동일한 레벨로 설정
     * 
     * @param {string} level - 구독 레벨
     */
    setAllSitesLevel(level) {
        for (const subscription of this._siteSubscriptions.values()) {
            subscription.update({ allLevel: level });
        }
        
        this._sendBatchSubscriptionChange();
        
        this._log(`📊 All sites set to level: ${level}`);
    }
    
    // =========================================================================
    // WebSocket 연동
    // =========================================================================
    
    /**
     * WebSocket 연결 설정
     * 
     * @param {WebSocket} webSocket - WebSocket 인스턴스
     */
    setWebSocket(webSocket) {
        this._webSocket = webSocket;
        
        // 큐에 쌓인 메시지 전송
        this._flushMessageQueue();
    }
    
    /**
     * Site 구독 변경 메시지 전송
     * 
     * @private
     */
    _sendSiteSubscriptionChange(subscription) {
        this._sendMessage(subscription.toMessage());
    }
    
    /**
     * Batch 구독 변경 메시지 전송
     * 
     * @private
     */
    _sendBatchSubscriptionChange() {
        const sites = [];
        
        for (const subscription of this._siteSubscriptions.values()) {
            sites.push({
                site_id: subscription.siteId,
                all_level: subscription.allLevel,
                selected_level: subscription.selectedLevel,
                selected_ids: Array.from(subscription.selectedIds),
                is_active: subscription.isActive
            });
        }
        
        this._sendMessage({
            type: WS_MESSAGE_TYPES.BATCH_SITE_SUBSCRIPTION_CHANGE,
            sites
        });
    }
    
    /**
     * 메시지 전송 (큐잉 지원)
     * 
     * @private
     */
    _sendMessage(message) {
        if (this._webSocket && this._webSocket.readyState === WebSocket.OPEN) {
            this._webSocket.send(JSON.stringify(message));
            this._log(`📤 Sent: ${message.type}`);
        } else {
            // 연결 안 됐으면 큐에 저장
            this._messageQueue.push(message);
            this._log(`📥 Queued: ${message.type}`);
        }
    }
    
    /**
     * 큐 플러시
     * 
     * @private
     */
    _flushMessageQueue() {
        if (!this._webSocket || this._webSocket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        while (this._messageQueue.length > 0) {
            const message = this._messageQueue.shift();
            this._webSocket.send(JSON.stringify(message));
            this._log(`📤 Flushed: ${message.type}`);
        }
    }
    
    // =========================================================================
    // 이벤트 리스너
    // =========================================================================
    
    /**
     * @private
     */
    _setupEventListeners() {
        // WebSocket 연결 이벤트 수신
        eventBus.on('websocket:connected', (data) => {
            if (data.webSocket) {
                this.setWebSocket(data.webSocket);
            }
        });
        
        // Site 연결 이벤트 수신
        eventBus.on('site:connected', (data) => {
            const { siteId, siteName } = data;
            if (siteId && !this._siteSubscriptions.has(siteId)) {
                this.addSite(siteId, {
                    displayName: siteName || siteId,
                    allLevel: DATA_SUBSCRIPTION_LEVEL.MINIMAL
                });
            }
        });
        
        // Site 연결 해제 이벤트
        eventBus.on('site:disconnected', (data) => {
            const { siteId } = data;
            if (siteId) {
                this.deactivateSite(siteId);
            }
        });
    }
    
    // =========================================================================
    // 유틸리티
    // =========================================================================
    
    /**
     * 다음 활성 Site 찾기
     * 
     * @private
     */
    _getNextActiveSite() {
        for (const [siteId, sub] of this._siteSubscriptions) {
            if (sub.isActive) {
                return siteId;
            }
        }
        return null;
    }
    
    /**
     * 상태 정보
     * 
     * @returns {Object}
     */
    getStatus() {
        return {
            totalSites: this._siteSubscriptions.size,
            activeSites: this.getActiveSites().map(s => s.siteId),
            activeSiteId: this._activeSiteId,
            subscriptions: Object.fromEntries(
                Array.from(this._siteSubscriptions.entries())
                    .map(([id, sub]) => [id, sub.toJSON()])
            )
        };
    }
    
    /**
     * 로그 출력
     * 
     * @private
     */
    _log(...args) {
        if (this._debug) {
            console.log('[MultiSiteSubMgr]', ...args);
        }
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this._siteSubscriptions.clear();
        this._activeSiteId = null;
        this._webSocket = null;
        this._messageQueue = [];
        
        this._log('🗑️ MultiSiteSubscriptionManager disposed');
    }
}

// =============================================================================
// 싱글톤 인스턴스 및 Export
// =============================================================================

let _multiSiteSubscriptionManager = null;

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getMultiSiteSubscriptionManager() {
    if (!_multiSiteSubscriptionManager) {
        _multiSiteSubscriptionManager = new MultiSiteSubscriptionManager({
            debug: true
        });
    }
    return _multiSiteSubscriptionManager;
}

// Named exports
export {
    DATA_SUBSCRIPTION_LEVEL,
    SITE_SUBSCRIPTION_EVENTS,
    WS_MESSAGE_TYPES,
    SiteSubscription,
    MultiSiteSubscriptionManager
};

// Default export
export default MultiSiteSubscriptionManager;