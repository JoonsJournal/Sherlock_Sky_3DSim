/**
 * MappingEventHandler.js - v1.0.0
 * 매핑 변경 이벤트 핸들러 모듈
 * 
 * Phase 7: MonitoringService에서 추출
 * - 이벤트 리스너 등록/해제 (EventBus + window CustomEvent)
 * - 매핑 변경 이벤트 처리 (mapping-changed, mapping-created)
 * - 새 매핑 시 연쇄 작업 실행:
 *   1. 설비 스타일 복원
 *   2. REST API로 최신 상태 조회
 *   3. SignalTower 램프 업데이트
 *   4. WebSocket 구독 추가
 *   5. 통계 패널 업데이트
 *   6. Toast 알림
 * 
 * @version 1.0.0
 * @since 2026-01-10
 * 
 * 의존성 (외부에서 주입):
 * - SignalTowerIntegration: restoreEquipmentFullStyle(), updateStatus()
 * - StatusAPIClient: fetchEquipmentLiveStatus()
 * - WebSocketManager: subscribeEquipment()
 * - EventBus (선택): on(), off()
 * - Callbacks: onUpdate, showToast, cacheStatus
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/MappingEventHandler.js
 */

import { debugLog } from '../../core/utils/Config.js';

/**
 * 지원하는 이벤트 타입
 */
export const MappingEventType = {
    MAPPING_CHANGED: 'mapping-changed',
    MAPPING_CREATED: 'mapping-created',
    MAPPING_DELETED: 'mapping-deleted'
};

/**
 * 매핑 변경 이벤트 핸들러 클래스
 */
export class MappingEventHandler {
    /**
     * @param {Object} dependencies - 의존성 객체
     * @param {Object} dependencies.signalIntegration - SignalTowerIntegration 인스턴스
     * @param {Object} dependencies.apiClient - StatusAPIClient 인스턴스
     * @param {Object} dependencies.wsManager - WebSocketManager 인스턴스
     * @param {Function} dependencies.onUpdate - 통계 패널 업데이트 콜백
     * @param {Function} dependencies.showToast - Toast 알림 콜백
     * @param {Function} dependencies.cacheStatus - 상태 캐시 업데이트 콜백
     * @param {Object} options - 옵션
     * @param {boolean} options.debug - 디버그 로그 출력 (기본: false)
     * @param {boolean} options.autoRegister - 자동 이벤트 등록 (기본: false)
     */
    constructor(dependencies = {}, options = {}) {
        // 의존성 저장
        this.signalIntegration = dependencies.signalIntegration || null;
        this.apiClient = dependencies.apiClient || null;
        this.wsManager = dependencies.wsManager || null;
        
        // 콜백 저장 (기본값은 빈 함수)
        this.onUpdate = dependencies.onUpdate || (() => {});
        this.showToast = dependencies.showToast || (() => {});
        this.cacheStatus = dependencies.cacheStatus || ((id, status) => {});
        
        // 옵션
        this.debug = options.debug || false;
        
        // EventBus 참조 (나중에 register()에서 설정)
        this.eventBus = null;
        
        // 바인딩된 핸들러 (이벤트 해제 시 필요)
        this._boundHandler = this._handleMappingEvent.bind(this);
        
        // 등록 상태
        this._isRegistered = false;
        
        // 처리 통계
        this._stats = {
            totalEvents: 0,
            successCount: 0,
            errorCount: 0,
            lastEventTime: null
        };
        
        this._log('🔧 MappingEventHandler 초기화');
        
        // 자동 등록
        if (options.autoRegister) {
            this.register();
        }
    }
    
    /**
     * 디버그 로그 출력
     * @private
     */
    _log(...args) {
        if (this.debug) {
            console.log('[MappingEventHandler]', ...args);
        }
        // debugLog도 호출 (Config.js 사용 시)
        if (typeof debugLog === 'function') {
            debugLog('[MappingEventHandler]', ...args);
        }
    }
    
    // ===============================================
    // 의존성 설정 (지연 주입)
    // ===============================================
    
    /**
     * SignalTowerIntegration 설정
     * @param {Object} signalIntegration - SignalTowerIntegration 인스턴스
     */
    setSignalIntegration(signalIntegration) {
        this.signalIntegration = signalIntegration;
        this._log('🔗 SignalTowerIntegration 연결됨');
    }
    
    /**
     * StatusAPIClient 설정
     * @param {Object} apiClient - StatusAPIClient 인스턴스
     */
    setApiClient(apiClient) {
        this.apiClient = apiClient;
        this._log('🔗 StatusAPIClient 연결됨');
    }
    
    /**
     * WebSocketManager 설정
     * @param {Object} wsManager - WebSocketManager 인스턴스
     */
    setWsManager(wsManager) {
        this.wsManager = wsManager;
        this._log('🔗 WebSocketManager 연결됨');
    }
    
    /**
     * 모든 의존성 일괄 설정
     * @param {Object} dependencies - 의존성 객체
     */
    setDependencies(dependencies) {
        if (dependencies.signalIntegration) {
            this.signalIntegration = dependencies.signalIntegration;
        }
        if (dependencies.apiClient) {
            this.apiClient = dependencies.apiClient;
        }
        if (dependencies.wsManager) {
            this.wsManager = dependencies.wsManager;
        }
        if (dependencies.onUpdate) {
            this.onUpdate = dependencies.onUpdate;
        }
        if (dependencies.showToast) {
            this.showToast = dependencies.showToast;
        }
        if (dependencies.cacheStatus) {
            this.cacheStatus = dependencies.cacheStatus;
        }
        
        this._log('🔗 Dependencies 업데이트됨');
    }
    
    /**
     * 콜백 설정
     * @param {Object} callbacks - 콜백 객체
     */
    setCallbacks(callbacks) {
        if (callbacks.onUpdate) this.onUpdate = callbacks.onUpdate;
        if (callbacks.showToast) this.showToast = callbacks.showToast;
        if (callbacks.cacheStatus) this.cacheStatus = callbacks.cacheStatus;
        
        this._log('🔗 Callbacks 업데이트됨');
    }
    
    // ===============================================
    // 이벤트 리스너 등록/해제
    // ===============================================
    
    /**
     * 이벤트 리스너 등록
     * @param {Object} eventBus - EventBus 인스턴스 (선택)
     * @returns {boolean} 등록 성공 여부
     */
    register(eventBus = null) {
        if (this._isRegistered) {
            this._log('⚠️ 이미 등록됨');
            return false;
        }
        
        this.eventBus = eventBus;
        
        // EventBus 사용 (있으면)
        if (this.eventBus) {
            this._registerEventBus();
        }
        
        // window CustomEvent도 지원 (fallback & 호환성)
        this._registerWindowEvents();
        
        this._isRegistered = true;
        this._log('✅ 이벤트 리스너 등록 완료');
        
        return true;
    }
    
    /**
     * EventBus에 리스너 등록
     * @private
     */
    _registerEventBus() {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.on(MappingEventType.MAPPING_CHANGED, this._boundHandler);
            this.eventBus.on(MappingEventType.MAPPING_CREATED, this._boundHandler);
            this.eventBus.on(MappingEventType.MAPPING_DELETED, this._boundHandler);
            this._log('📡 EventBus 리스너 등록됨');
        } catch (error) {
            this._log('⚠️ EventBus 등록 실패:', error);
        }
    }
    
    /**
     * Window 이벤트 리스너 등록
     * @private
     */
    _registerWindowEvents() {
        window.addEventListener(MappingEventType.MAPPING_CHANGED, this._boundHandler);
        window.addEventListener(MappingEventType.MAPPING_CREATED, this._boundHandler);
        window.addEventListener(MappingEventType.MAPPING_DELETED, this._boundHandler);
        this._log('📡 Window 이벤트 리스너 등록됨');
    }
    
    /**
     * 이벤트 리스너 해제
     * @returns {boolean} 해제 성공 여부
     */
    unregister() {
        if (!this._isRegistered) {
            this._log('⚠️ 등록되지 않음');
            return false;
        }
        
        // EventBus 해제
        if (this.eventBus) {
            this._unregisterEventBus();
        }
        
        // Window 이벤트 해제
        this._unregisterWindowEvents();
        
        this._isRegistered = false;
        this._log('✅ 이벤트 리스너 해제 완료');
        
        return true;
    }
    
    /**
     * EventBus에서 리스너 해제
     * @private
     */
    _unregisterEventBus() {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.off(MappingEventType.MAPPING_CHANGED, this._boundHandler);
            this.eventBus.off(MappingEventType.MAPPING_CREATED, this._boundHandler);
            this.eventBus.off(MappingEventType.MAPPING_DELETED, this._boundHandler);
            this._log('📡 EventBus 리스너 해제됨');
        } catch (error) {
            this._log('⚠️ EventBus 해제 실패:', error);
        }
    }
    
    /**
     * Window 이벤트 리스너 해제
     * @private
     */
    _unregisterWindowEvents() {
        window.removeEventListener(MappingEventType.MAPPING_CHANGED, this._boundHandler);
        window.removeEventListener(MappingEventType.MAPPING_CREATED, this._boundHandler);
        window.removeEventListener(MappingEventType.MAPPING_DELETED, this._boundHandler);
        this._log('📡 Window 이벤트 리스너 해제됨');
    }
    
    // ===============================================
    // 이벤트 처리
    // ===============================================
    
    /**
     * 매핑 변경 이벤트 처리 (내부)
     * @private
     * @param {Event|Object} eventOrData - 이벤트 객체 또는 데이터
     */
    async _handleMappingEvent(eventOrData) {
        this._stats.totalEvents++;
        this._stats.lastEventTime = new Date().toISOString();
        
        // CustomEvent인 경우 detail에서 데이터 추출
        const data = eventOrData.detail || eventOrData;
        const eventType = eventOrData.type || MappingEventType.MAPPING_CHANGED;
        
        // 데이터 추출
        const { frontendId, equipmentId, equipment_id } = data;
        const eqId = equipmentId || equipment_id;
        
        // 유효성 검사
        if (!frontendId) {
            this._log('⚠️ Invalid event data (no frontendId):', data);
            this._stats.errorCount++;
            return;
        }
        
        this._log(`🆕 매핑 이벤트 감지: ${eventType} - ${frontendId} -> equipment_id: ${eqId}`);
        
        // 이벤트 타입별 처리
        if (eventType === MappingEventType.MAPPING_DELETED) {
            await this._handleMappingDeleted(frontendId, eqId, data);
        } else {
            // MAPPING_CHANGED, MAPPING_CREATED 모두 동일하게 처리
            await this._handleMappingChanged(frontendId, eqId, data);
        }
    }
    
    /**
     * 매핑 생성/변경 처리
     * @private
     * @param {string} frontendId - Frontend ID (예: 'EQ-01-01')
     * @param {number} equipmentId - Backend equipment_id
     * @param {Object} data - 원본 이벤트 데이터
     */
    async _handleMappingChanged(frontendId, equipmentId, data) {
        try {
            // 1️⃣ 설비 모델 + SignalTower 스타일 복원
            if (this.signalIntegration) {
                this.signalIntegration.restoreEquipmentFullStyle(frontendId);
                this._log(`✅ Step 1: ${frontendId} 스타일 복원`);
            }
            
            // 2️⃣ REST API로 해당 설비 최신 Status 조회
            let status = null;
            if (this.apiClient) {
                try {
                    status = await this.apiClient.fetchEquipmentLiveStatus(frontendId);
                    this._log(`✅ Step 2: ${frontendId} 상태 조회 완료 - ${status}`);
                } catch (apiError) {
                    this._log(`⚠️ Step 2: ${frontendId} 상태 조회 실패:`, apiError.message);
                }
            }
            
            // 3️⃣ 해당 Status에 맞는 램프 ON
            if (status && this.signalIntegration) {
                this.signalIntegration.updateStatus(frontendId, status);
                this._log(`✅ Step 3: ${frontendId} 램프 설정 → ${status}`);
            }
            
            // 4️⃣ 상태 캐시 업데이트
            if (status) {
                this.cacheStatus(frontendId, status);
                this._log(`✅ Step 4: ${frontendId} 캐시 업데이트`);
            }
            
            // 5️⃣ WebSocket Subscribe 목록에 추가
            if (equipmentId && this.wsManager) {
                this.wsManager.subscribeEquipment(equipmentId);
                this._log(`✅ Step 5: ${frontendId} WebSocket 구독 (equipment_id: ${equipmentId})`);
            }
            
            // 6️⃣ 통계 패널 업데이트
            this.onUpdate();
            this._log(`✅ Step 6: 통계 패널 업데이트`);
            
            // 7️⃣ Toast 알림
            this.showToast(`✅ ${frontendId} 연결됨 (Status: ${status || 'Unknown'})`, 'success');
            
            this._stats.successCount++;
            this._log(`✅ 매핑 처리 완료: ${frontendId}`);
            
        } catch (error) {
            this._stats.errorCount++;
            console.error(`❌ Failed to handle mapping for ${frontendId}:`, error);
            this.showToast(`⚠️ ${frontendId} 연결 처리 실패`, 'error');
        }
    }
    
    /**
     * 매핑 삭제 처리
     * @private
     * @param {string} frontendId - Frontend ID
     * @param {number} equipmentId - Backend equipment_id
     * @param {Object} data - 원본 이벤트 데이터
     */
    async _handleMappingDeleted(frontendId, equipmentId, data) {
        try {
            // 1️⃣ WebSocket 구독 해제
            if (equipmentId && this.wsManager) {
                this.wsManager.unsubscribeEquipment?.(equipmentId);
                this._log(`✅ Step 1: ${frontendId} WebSocket 구독 해제`);
            }
            
            // 2️⃣ 캐시에서 제거
            this.cacheStatus(frontendId, null);
            this._log(`✅ Step 2: ${frontendId} 캐시 제거`);
            
            // 3️⃣ 통계 패널 업데이트
            this.onUpdate();
            this._log(`✅ Step 3: 통계 패널 업데이트`);
            
            // 4️⃣ Toast 알림
            this.showToast(`🗑️ ${frontendId} 매핑 해제됨`, 'info');
            
            this._stats.successCount++;
            this._log(`✅ 매핑 삭제 처리 완료: ${frontendId}`);
            
        } catch (error) {
            this._stats.errorCount++;
            console.error(`❌ Failed to handle mapping deletion for ${frontendId}:`, error);
        }
    }
    
    // ===============================================
    // 수동 이벤트 발생 (테스트/외부 호출용)
    // ===============================================
    
    /**
     * 매핑 변경 이벤트 수동 발생 (외부 호출용)
     * @param {string} frontendId - Frontend ID
     * @param {number} equipmentId - Backend equipment_id
     * @param {string} eventType - 이벤트 타입 (기본: 'mapping-changed')
     */
    async triggerMappingEvent(frontendId, equipmentId, eventType = MappingEventType.MAPPING_CHANGED) {
        const eventData = {
            frontendId,
            equipmentId,
            equipment_id: equipmentId,
            timestamp: new Date().toISOString()
        };
        
        this._log(`📤 수동 이벤트 발생: ${eventType}`, eventData);
        
        // 직접 핸들러 호출
        await this._handleMappingEvent({
            type: eventType,
            detail: eventData
        });
    }
    
    /**
     * CustomEvent 발생 (다른 컴포넌트 알림용)
     * @param {string} frontendId - Frontend ID
     * @param {number} equipmentId - Backend equipment_id
     * @param {string} eventType - 이벤트 타입
     */
    dispatchMappingEvent(frontendId, equipmentId, eventType = MappingEventType.MAPPING_CHANGED) {
        const event = new CustomEvent(eventType, {
            detail: {
                frontendId,
                equipmentId,
                equipment_id: equipmentId,
                timestamp: new Date().toISOString()
            }
        });
        
        window.dispatchEvent(event);
        this._log(`📤 CustomEvent 발생: ${eventType}`, event.detail);
    }
    
    // ===============================================
    // 상태 조회
    // ===============================================
    
    /**
     * 등록 상태 확인
     * @returns {boolean}
     */
    isRegistered() {
        return this._isRegistered;
    }
    
    /**
     * 의존성 준비 상태 확인
     * @returns {boolean}
     */
    isReady() {
        return !!(this.signalIntegration && this.apiClient && this.wsManager);
    }
    
    /**
     * 처리 통계 조회
     * @returns {Object}
     */
    getStats() {
        return { ...this._stats };
    }
    
    /**
     * 전체 상태 조회
     * @returns {Object}
     */
    getStatus() {
        return {
            isRegistered: this._isRegistered,
            isReady: this.isReady(),
            hasEventBus: !!this.eventBus,
            hasSignalIntegration: !!this.signalIntegration,
            hasApiClient: !!this.apiClient,
            hasWsManager: !!this.wsManager,
            stats: this.getStats()
        };
    }
    
    // ===============================================
    // 리소스 정리
    // ===============================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        // 이벤트 리스너 해제
        this.unregister();
        
        // 참조 정리 (실제 객체는 외부 소유)
        this.signalIntegration = null;
        this.apiClient = null;
        this.wsManager = null;
        this.eventBus = null;
        this.onUpdate = () => {};
        this.showToast = () => {};
        this.cacheStatus = () => {};
        
        this._log('🗑️ MappingEventHandler disposed');
    }
}

/**
 * 싱글톤 인스턴스 (테스트용)
 * MonitoringService에서 직접 생성하므로 이 인스턴스는 테스트용
 */
export const mappingEventHandler = new MappingEventHandler({}, { debug: true });

export default MappingEventHandler;