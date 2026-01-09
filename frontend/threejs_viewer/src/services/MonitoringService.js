/**
 * MonitoringService.js - v4.0.1
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ v4.0.1: 선택된 설비만 EquipmentInfoPanel 업데이트 (버그 수정)
 * - notifyEquipmentInfoPanel()에서 선택된 설비 필터링 로직 단순화
 * - selectedFrontendIds 배열로 통일 (Single/Multi 모두)
 * - length === 0 체크 추가 (선택 없으면 무시)
 * - 불필요한 WebSocket 메시지 처리 방지
 * 
 * ⭐ v4.0.0: PC Info Tab 확장 - Memory, Disk 필드 추가
 * - WebSocket 메시지에 memory_total_gb, memory_used_gb 필드 추가
 * - WebSocket 메시지에 disk_c_*, disk_d_* 필드 추가
 * - EquipmentInfoPanel에 신규 필드 전달
 * - ⚠️ 호환성: 기존 모든 기능 100% 유지
 * 
 * ⭐ v3.4.0: Lot Active/Inactive 분기 지원
 * - WebSocket 메시지에 is_lot_active, since_time 필드 추가
 * - EquipmentInfoPanel에 신규 필드 전달
 * - 기존 기능 100% 호환성 유지
 * 
 * ⭐ v3.3.0: EquipmentInfoPanel 실시간 업데이트 연동 (Phase 4)
 * - WebSocket 메시지 수신 시 EquipmentInfoPanel.updateRealtime() 호출
 * - Single/Multi Selection 모두 지원
 * - Monitoring Mode + Panel 열림 + 선택된 설비만 업데이트
 * 
 * ⭐ v3.2.0: equipment_id 기반 매핑 조회로 변경
 * - Backend의 frontend_id 대신 equipment_id로 Frontend 매핑 조회
 * - Backend: CUT-066, EQ-UNKNOWN-X → Frontend: EQ-XX-XX 변환
 * - getFrontendIdByEquipmentId() 사용
 * 
 * ⭐ v3.1.0: 24시간 기준 초기 상태 로드 + DISCONNECTED 처리
 * - /api/monitoring/status/initial API 사용
 * - threshold_hours 설정 가능 (기본 24시간)
 * - is_connected 필드로 DISCONNECTED 상태 처리
 * - 통계 패널에 전체 설비 수, SUDDENSTOP, DISCONNECTED 추가
 * 
 * ⭐ v3.0.0: SignalTower 연동 강화
 * - 초기화 흐름 개선 (모든 램프 OFF → 미매핑 DISABLED → REST API로 상태 로드)
 * - 새 매핑 이벤트 처리 (mapping-changed)
 * - SignalTower 미매핑 설비 DISABLED 처리
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/MonitoringService.js
 */

import { debugLog } from '../core/utils/Config.js';

export class MonitoringService {
    constructor(signalTowerManager, equipmentLoader = null, equipmentEditState = null) {
        this.signalTowerManager = signalTowerManager;
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        
        this.apiBaseUrl = 'http://localhost:8000/api/monitoring';
        this.wsUrl = 'ws://localhost:8000/api/monitoring/stream';
        
        this.ws = null;
        this.isActive = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        this.statusCache = new Map();
        this.updateQueue = [];
        this.batchInterval = 1000;
        this.batchTimer = null;
        
        // ⭐ v3.1.0: DISCONNECTED 판별 기준 시간 (시간 단위)
        this.staleThresholdHours = 24;
        
        // 미연결 설비 색상 옵션
        this.disabledOptions = {
            grayColor: 0x444444  // 어두운 회색 (바닥과 구별)
        };
        
        this.statusPanelElement = null;
        
        // ⭐ v3.1.0: 확장된 통계 정보
        this.currentStats = {
            total: 0,           // 전체 설비 수
            mapped: 0,          // 매핑된 설비 수
            unmapped: 0,        // 미매핑 설비 수
            rate: 0,            // 매핑 완료율
            connected: 0,       // 연결된 설비 수 (24시간 내 데이터 있음)
            disconnected: 0     // 연결 끊긴 설비 수 (24시간 내 데이터 없음)
        };
        
        // ⭐ v3.0.0: EventBus 참조 (있으면 사용)
        this.eventBus = null;
        
        // ⭐ v3.3.0: EquipmentInfoPanel 참조
        this.equipmentInfoPanel = null;
        
        // ⭐ v3.0.0: 이벤트 핸들러 바인딩 (제거 시 필요)
        this._boundHandleMappingChanged = this.handleMappingChanged.bind(this);
        
        debugLog('MonitoringService initialized (v4.0.1)');
    }
    
    /**
     * 의존성 설정
     */
    setDependencies(equipmentLoader, equipmentEditState, eventBus = null) {
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        this.eventBus = eventBus;
        debugLog('MonitoringService dependencies set');
    }
    
    /**
     * ⭐ v3.3.0: EquipmentInfoPanel 설정
     * @param {EquipmentInfoPanel} equipmentInfoPanel - Equipment Info Panel 인스턴스
     */
    setEquipmentInfoPanel(equipmentInfoPanel) {
        this.equipmentInfoPanel = equipmentInfoPanel;
        debugLog('🔗 EquipmentInfoPanel connected to MonitoringService');
    }
    
    /**
     * ⭐ v3.1.0: DISCONNECTED 판별 기준 시간 설정
     * @param {number} hours - 시간 단위 (1~168)
     */
    setStaleThreshold(hours) {
        if (hours >= 1 && hours <= 168) {
            this.staleThresholdHours = hours;
            debugLog(`⏱️ Stale threshold set to ${hours} hours`);
        } else {
            console.warn(`⚠️ Invalid threshold: ${hours}. Must be 1-168 hours.`);
        }
    }
    
    /**
     * ⭐ v3.0.0: 모니터링 시작 (개선된 흐름)
     */
    async start() {
        if (this.isActive) {
            debugLog('⚠️ Monitoring already active');
            return;
        }
        
        debugLog('🟢 Starting monitoring mode (v4.0.1)...');
        this.isActive = true;
        
        try {
            // ============================================
            // 1️⃣ SignalTower 모든 램프 초기화 (OFF 상태)
            // ============================================
            if (this.signalTowerManager) {
                this.signalTowerManager.initializeAllLights();
                debugLog('🚨 Step 1: SignalTower lights initialized (all OFF)');
            }
            
            // ============================================
            // 2️⃣ 미매핑 설비 처리
            // ============================================
            // 2-1. 설비 모델 회색 처리
            this.applyUnmappedEquipmentStyle();
            debugLog('🌫️ Step 2-1: Unmapped equipment model grayed out');
            
            // 2-2. SignalTower 램프 DISABLED 처리
            this.applyUnmappedSignalTowerStyle();
            debugLog('🌫️ Step 2-2: Unmapped SignalTower lamps disabled');
            
            // ============================================
            // 3️⃣ 통계 패널 표시
            // ============================================
            this.createStatusPanel();
            debugLog('📊 Step 3: Status panel created');
            
            // ============================================
            // 4️⃣ REST API로 초기 상태 로드 (24시간 기준)
            // ⭐ v3.1.0: /status/initial API 사용
            // ============================================
            await this.loadInitialStatus().catch(err => {
                debugLog(`⚠️ Step 4: loadInitialStatus failed: ${err.message}`);
            });
            debugLog('📡 Step 4: Initial status loaded');
            
            // ============================================
            // 5️⃣ WebSocket 연결 + Subscribe
            // ============================================
            this.connectWebSocket();
            debugLog('🔌 Step 5: WebSocket connecting...');
            
            // ============================================
            // 6️⃣ 배치 처리 타이머 시작
            // ============================================
            this.startBatchProcessing();
            debugLog('⏱️ Step 6: Batch processing started');
            
            // ============================================
            // 7️⃣ 이벤트 리스너 등록 (새 매핑 감지)
            // ============================================
            this.registerEventListeners();
            debugLog('📡 Step 7: Event listeners registered');
            
            debugLog('✅ Monitoring mode started successfully (v4.0.1)');
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error);
            // 에러가 나도 isActive는 유지 (UI 표시를 위해)
        }
    }
    
    /**
     * 모니터링 중지
     */
    stop() {
        debugLog('🔴 Stopping monitoring mode...');
        this.isActive = false;
        
        // 1. 이벤트 리스너 해제
        this.unregisterEventListeners();
        
        // 2. 비활성화 표시 해제
        this.resetEquipmentStyle();
        
        // 3. 통계 패널 제거
        this.removeStatusPanel();
        
        // 4. WebSocket 연결 종료
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // 5. 배치 처리 타이머 중지
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        
        debugLog('✅ Monitoring mode stopped');
    }
    
    // ============================================
    // ⭐ v3.0.0: SignalTower 미매핑 설비 처리
    // ============================================
    
    /**
     * ⭐ v3.0.0: 미매핑 설비의 SignalTower 램프 DISABLED 처리
     */
    applyUnmappedSignalTowerStyle() {
        if (!this.signalTowerManager || !this.equipmentLoader || !this.equipmentEditState) {
            debugLog('⚠️ Dependencies not ready for SignalTower style');
            return;
        }
        
        const equipmentArray = this.equipmentLoader.getAllEquipment();
        const unmappedIds = [];
        const mappedIds = [];
        
        equipmentArray.forEach(equipment => {
            const frontendId = equipment.userData.id;
            const isMapped = this.equipmentEditState.isComplete(frontendId);
            
            if (isMapped) {
                mappedIds.push(frontendId);
            } else {
                unmappedIds.push(frontendId);
            }
        });
        
        // 미매핑 설비 램프 DISABLED
        if (unmappedIds.length > 0) {
            this.signalTowerManager.disableUnmappedEquipment(unmappedIds);
        }
        
        debugLog(`🚨 SignalTower: ${mappedIds.length} mapped, ${unmappedIds.length} disabled`);
    }
    
    // ============================================
    // ⭐ v3.0.0: 이벤트 리스너 (새 매핑 감지)
    // ============================================
    
    /**
     * ⭐ v3.0.0: 이벤트 리스너 등록
     */
    registerEventListeners() {
        // EventBus 사용 (있으면)
        if (this.eventBus) {
            this.eventBus.on('mapping-changed', this._boundHandleMappingChanged);
            this.eventBus.on('mapping-created', this._boundHandleMappingChanged);
            debugLog('📡 EventBus listeners registered');
        }
        
        // DOM CustomEvent도 지원 (fallback)
        window.addEventListener('mapping-changed', this._boundHandleMappingChanged);
        window.addEventListener('mapping-created', this._boundHandleMappingChanged);
        debugLog('📡 Window event listeners registered');
    }
    
    /**
     * ⭐ v3.0.0: 이벤트 리스너 해제
     */
    unregisterEventListeners() {
        if (this.eventBus) {
            this.eventBus.off('mapping-changed', this._boundHandleMappingChanged);
            this.eventBus.off('mapping-created', this._boundHandleMappingChanged);
        }
        
        window.removeEventListener('mapping-changed', this._boundHandleMappingChanged);
        window.removeEventListener('mapping-created', this._boundHandleMappingChanged);
        debugLog('📡 Event listeners unregistered');
    }
    
    /**
     * ⭐ v3.0.0: 새 매핑 발생 시 처리
     * @param {Object|CustomEvent} eventOrData - 이벤트 또는 데이터 객체
     */
    async handleMappingChanged(eventOrData) {
        // CustomEvent인 경우 detail에서 데이터 추출
        const data = eventOrData.detail || eventOrData;
        
        // EquipmentEditState에서 발행하는 이벤트 형식 (camelCase)
        const { frontendId, equipmentId, equipment_id } = data;
        
        // equipment_id 우선 사용 (두 가지 형식 지원: camelCase, snake_case)
        const eqId = equipmentId || equipment_id;
        
        if (!frontendId) {
            debugLog('⚠️ Invalid mapping-changed event data (no frontendId):', data);
            return;
        }
        
        debugLog(`🆕 New mapping detected: ${frontendId} -> equipment_id: ${eqId}`);
        
        try {
            // ============================================
            // 1️⃣ 설비 모델 회색 해제 (원래 색상 복원)
            // ============================================
            if (this.equipmentLoader) {
                this.equipmentLoader.restoreEquipmentStyle(frontendId);
                debugLog(`✅ ${frontendId} model style restored`);
            }
            
            // ============================================
            // 2️⃣ SignalTower 램프 DISABLED 해제 (OFF 상태로)
            // ============================================
            if (this.signalTowerManager) {
                this.signalTowerManager.clearDisabledState(frontendId);
                debugLog(`✅ ${frontendId} SignalTower enabled`);
            }
            
            // ============================================
            // 3️⃣ REST API로 해당 설비 최신 Status 조회
            // ⭐ v3.0.0: Frontend ID로 /equipment/{id}/live API 호출
            // ============================================
            const status = await this.fetchSingleEquipmentStatus(frontendId);
            
            if (status) {
                // ============================================
                // 4️⃣ 해당 Status에 맞는 램프 ON
                // ============================================
                if (this.signalTowerManager) {
                    this.signalTowerManager.updateStatus(frontendId, status);
                    debugLog(`✅ ${frontendId} lamp set to ${status}`);
                }
                
                // 캐시 업데이트
                this.statusCache.set(frontendId, status);
            }
            
            // ============================================
            // 5️⃣ WebSocket Subscribe 목록에 추가
            // ============================================
            if (eqId) {
                this.sendSubscribeForNewMapping(eqId);
                debugLog(`✅ ${frontendId} subscribed to WebSocket (equipment_id: ${eqId})`);
            }
            
            // ============================================
            // 6️⃣ 통계 패널 업데이트
            // ============================================
            this.updateStatusPanel();
            
            // Toast 알림
            this.showToast(`✅ ${frontendId} 연결됨 (Status: ${status || 'Unknown'})`, 'success');
            
        } catch (error) {
            console.error(`❌ Failed to handle new mapping for ${frontendId}:`, error);
            this.showToast(`⚠️ ${frontendId} 연결 처리 실패`, 'error');
        }
    }
    
    /**
     * ⭐ v3.0.0: 특정 설비의 최신 Status 조회
     * Backend API: GET /api/monitoring/equipment/{frontend_id}/live
     * 
     * @param {string} frontendId - Frontend ID (예: 'EQ-01-01')
     * @returns {Promise<string|null>} Status ('RUN', 'IDLE', 'STOP', 'SUDDENSTOP') 또는 null
     */
    async fetchSingleEquipmentStatus(frontendId) {
        try {
            // ⭐ v3.0.0: 올바른 API 엔드포인트 사용
            const response = await fetch(`${this.apiBaseUrl}/equipment/${frontendId}/live`);
            
            if (!response.ok) {
                debugLog(`⚠️ Failed to fetch status for: ${frontendId} (HTTP ${response.status})`);
                return null;
            }
            
            const data = await response.json();
            
            // Backend 응답 형식: { equipment_id, status: {...}, production: {...}, timestamp }
            // status 객체 내부에서 현재 상태 추출
            if (data.status) {
                // status가 객체인 경우 (예: { status: 'RUN', temperature: 25.5, ... })
                if (typeof data.status === 'object' && data.status.status) {
                    return data.status.status;
                }
                // status가 문자열인 경우
                if (typeof data.status === 'string') {
                    return data.status;
                }
            }
            
            debugLog(`⚠️ Could not extract status from response for: ${frontendId}`);
            return null;
            
        } catch (error) {
            console.error(`❌ Error fetching status for ${frontendId}:`, error);
            return null;
        }
    }
    
    /**
     * ⭐ v3.0.0: 새 매핑된 설비를 WebSocket Subscribe에 추가
     * @param {number} equipmentId - Equipment ID (DB ID)
     */
    sendSubscribeForNewMapping(equipmentId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            debugLog('⚠️ WebSocket not ready for subscribe');
            return;
        }
        
        const subscribeMessage = {
            action: 'subscribe',
            equipment_ids: [equipmentId]
        };
        
        this.ws.send(JSON.stringify(subscribeMessage));
        debugLog(`📡 Subscribed to new equipment_id: ${equipmentId}`);
    }
    
    // ============================================
    // 통계 패널 관리
    // ============================================
    
    createStatusPanel() {
        this.removeStatusPanel();
        
        const panel = document.createElement('div');
        panel.id = 'monitoring-status-panel';
        panel.className = 'status-panel';
        
        this.updateStats();
        panel.innerHTML = this.getStatusPanelHTML();
        
        document.body.appendChild(panel);
        this.statusPanelElement = panel;
        
        debugLog('📊 Status panel created');
    }
    
    /**
     * ⭐ v3.1.0: 개선된 통계 패널 HTML 생성
     * - 전체 설비 수 추가
     * - SUDDENSTOP, DISCONNECTED 카운트 추가
     */
    getStatusPanelHTML() {
        const { total, mapped, unmapped, rate, connected, disconnected } = this.currentStats;
        
        // ⭐ v3.1.0: SignalTower 통계 (확장)
        let signalTowerStats = '';
        if (this.signalTowerManager) {
            const stats = this.signalTowerManager.getStatusStatistics();
            signalTowerStats = `
                <div class="status-divider">|</div>
                <div class="status-item">
                    <span class="status-icon" style="color: #00ff00;">●</span>
                    <span class="status-label">RUN</span>
                    <span class="status-value">${stats.RUN}</span>
                </div>
                <div class="status-item">
                    <span class="status-icon" style="color: #ffff00;">●</span>
                    <span class="status-label">IDLE</span>
                    <span class="status-value">${stats.IDLE}</span>
                </div>
                <div class="status-item">
                    <span class="status-icon" style="color: #ffff00;">●</span>
                    <span class="status-label">STOP</span>
                    <span class="status-value">${stats.STOP}</span>
                </div>
                <div class="status-item">
                    <span class="status-icon status-blink" style="color: #ff0000;">●</span>
                    <span class="status-label">SUDDEN</span>
                    <span class="status-value">${stats.SUDDENSTOP}</span>
                </div>
                <div class="status-item">
                    <span class="status-icon" style="color: #666666;">●</span>
                    <span class="status-label">DISC</span>
                    <span class="status-value">${stats.DISCONNECTED}</span>
                </div>
            `;
        }
        
        return `
            <div class="status-item">
                <span class="status-icon">📊</span>
                <span class="status-label">전체</span>
                <span class="status-value">${total}개</span>
            </div>
            <div class="status-divider">|</div>
            <div class="status-item">
                <span class="status-icon connected">✅</span>
                <span class="status-label">매핑</span>
                <span class="status-value">${mapped}개</span>
            </div>
            <div class="status-item">
                <span class="status-icon disconnected">⚠️</span>
                <span class="status-label">미매핑</span>
                <span class="status-value">${unmapped}개</span>
            </div>
            <div class="status-divider">|</div>
            <div class="status-item">
                <span class="status-icon">📶</span>
                <span class="status-value">${rate}%</span>
            </div>
            ${signalTowerStats}
        `;
    }
    
    /**
     * ⭐ v3.1.0: 통계 정보 업데이트 (확장)
     */
    updateStats() {
        if (!this.equipmentLoader || !this.equipmentEditState) {
            return;
        }
        
        const totalEquipment = this.equipmentLoader.equipmentArray?.length || 0;
        const mappedCount = this.equipmentEditState.getMappingCount() || 0;
        const unmappedCount = totalEquipment - mappedCount;
        const rate = totalEquipment > 0 ? Math.round((mappedCount / totalEquipment) * 100) : 0;
        
        // ⭐ v3.1.0: SignalTower 통계에서 connected/disconnected 계산
        let connectedCount = 0;
        let disconnectedCount = 0;
        
        if (this.signalTowerManager) {
            const stats = this.signalTowerManager.getStatusStatistics();
            // DISCONNECTED 카운트
            disconnectedCount = stats.DISCONNECTED || 0;
            // Connected = 매핑됨 - DISCONNECTED - DISABLED
            connectedCount = mappedCount - disconnectedCount;
        }
        
        this.currentStats = {
            total: totalEquipment,
            mapped: mappedCount,
            unmapped: unmappedCount,
            rate: rate,
            connected: connectedCount,
            disconnected: disconnectedCount
        };
    }
    
    updateStatusPanel() {
        if (!this.statusPanelElement) return;
        
        this.updateStats();
        this.statusPanelElement.innerHTML = this.getStatusPanelHTML();
    }
    
    removeStatusPanel() {
        if (this.statusPanelElement) {
            this.statusPanelElement.remove();
            this.statusPanelElement = null;
            debugLog('📊 Status panel removed');
        }
        
        const existingPanel = document.getElementById('monitoring-status-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
    }
    
    getStats() {
        this.updateStats();
        return { ...this.currentStats };
    }
    
    // ============================================
    // 미연결 설비 클릭 안내
    // ============================================
    
    checkAndNotifyUnmapped(frontendId) {
        if (!this.isActive) return true;
        
        const isMapped = this.isEquipmentMapped(frontendId);
        
        if (!isMapped) {
            this.showUnmappedNotification(frontendId);
            return false;
        }
        
        return true;
    }
    
    showUnmappedNotification(frontendId) {
        this.showToast(
            `⚠️ "${frontendId}"는 DB에 연결되지 않았습니다. Edit Mode (E키)에서 매핑해주세요.`,
            'warning',
            5000
        );
        
        debugLog(`⚠️ Unmapped equipment clicked: ${frontendId}`);
    }
    
    // ============================================
    // 미연결 설비 비활성화 표시
    // ============================================
    
    applyUnmappedEquipmentStyle() {
        if (!this.equipmentLoader || !this.equipmentEditState) {
            debugLog('⚠️ EquipmentLoader or EditState not available');
            return;
        }
        
        const mappings = this.equipmentEditState.getAllMappings();
        const result = this.equipmentLoader.applyMonitoringModeVisibility(
            mappings, 
            this.disabledOptions
        );
        
        this.currentStats.mapped = result.mapped;
        this.currentStats.unmapped = result.unmapped;
        this.currentStats.total = result.mapped + result.unmapped;
        this.currentStats.rate = this.currentStats.total > 0 
            ? Math.round((result.mapped / this.currentStats.total) * 100) 
            : 0;
        
        debugLog(`🌫️ Unmapped equipment disabled: ${result.unmapped}개`);
        debugLog(`✅ Mapped equipment active: ${result.mapped}개`);
        
        // Toast 알림 (미연결이 있을 때만)
        if (result.unmapped > 0) {
            this.showToast(
                `⚠️ ${result.unmapped}개 설비가 DB에 연결되지 않음`, 
                'warning'
            );
        }
    }
    
    resetEquipmentStyle() {
        if (!this.equipmentLoader) {
            debugLog('⚠️ EquipmentLoader not available');
            return;
        }
        
        this.equipmentLoader.resetAllEquipmentVisibility();
        debugLog('✅ All equipment styles reset');
    }
    
    setDisabledOptions(options) {
        this.disabledOptions = { ...this.disabledOptions, ...options };
        
        if (this.isActive) {
            this.applyUnmappedEquipmentStyle();
            this.updateStatusPanel();
        }
    }
    
    showToast(message, type = 'info', duration = 5000) {
        if (window.toast?.show) {
            window.toast.show(message.replace(/\n/g, ' '), type);
            return;
        }
        
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = message.replace(/\n/g, '<br>');
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // ============================================
    // API 및 WebSocket
    // ============================================
    
    /**
     * ⭐ v3.2.0: 초기 상태 로드 (24시간 기준)
     * Backend API: GET /api/monitoring/status/initial?threshold_hours=24
     * 
     * 🔧 v3.2.0 수정: Backend의 frontend_id 대신 equipment_id로 Frontend 매핑 조회
     * - Backend에서 CUT-066, EQ-UNKNOWN-X 등의 frontend_id가 오지만
     * - Frontend의 equipmentEditState에서 equipment_id로 실제 frontend_id(EQ-XX-XX) 조회
     */
    async loadInitialStatus() {
        debugLog(`📡 Loading initial equipment status (threshold: ${this.staleThresholdHours}h)...`);
        
        // ⭐ v3.1.0: 새 API 엔드포인트 사용
        const url = `${this.apiBaseUrl}/status/initial?threshold_hours=${this.staleThresholdHours}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.equipment || !Array.isArray(data.equipment)) {
            throw new Error('Invalid response format');
        }
        
        debugLog(`✅ Loaded ${data.equipment.length} equipment status from /status/initial`);
        
        // ⭐ v3.1.0: Backend 응답의 summary 로깅
        if (data.summary) {
            debugLog(`📊 Summary: Total=${data.summary.total}, Connected=${data.summary.connected}, Disconnected=${data.summary.disconnected}`);
            debugLog(`📊 By Status:`, data.summary.by_status);
        }
        
        // ⭐ v3.2.0: is_connected 필드로 DISCONNECTED 처리
        let connectedCount = 0;
        let disconnectedCount = 0;
        let skippedCount = 0;
        
        data.equipment.forEach(item => {
            // ⭐ v3.2.0 수정: Backend의 frontend_id 대신 equipment_id로 Frontend 매핑 조회
            // Backend에서 CUT-066, EQ-UNKNOWN-X 형식이 오지만,
            // Frontend의 equipmentEditState에서 equipment_id로 실제 frontend_id(EQ-XX-XX) 조회
            const frontendId = this.equipmentEditState?.getFrontendIdByEquipmentId(item.equipment_id);
            
            if (!frontendId) {
                // equipment_id가 Frontend에 매핑되지 않음 (정상적인 스킵)
                skippedCount++;
                return;
            }
            
            // ⭐ v3.1.0: is_connected 필드로 DISCONNECTED 판별
            if (item.is_connected === false || item.status === null) {
                // DISCONNECTED 상태
                if (this.signalTowerManager) {
                    this.signalTowerManager.updateStatus(frontendId, 'DISCONNECTED');
                }
                this.statusCache.set(frontendId, 'DISCONNECTED');
                disconnectedCount++;
                debugLog(`🔌 ${frontendId} (eq_id:${item.equipment_id}) -> DISCONNECTED`);
            } else {
                // 정상 상태 (RUN, IDLE, STOP, SUDDENSTOP)
                if (this.signalTowerManager) {
                    this.signalTowerManager.updateStatus(frontendId, item.status);
                }
                this.statusCache.set(frontendId, item.status);
                connectedCount++;
            }
        });
        
        // 통계 업데이트
        this.currentStats.connected = connectedCount;
        this.currentStats.disconnected = disconnectedCount;
        
        debugLog(`✅ Initial status applied: ${connectedCount} connected, ${disconnectedCount} disconnected, ${skippedCount} skipped`);
        
        // 패널 업데이트
        this.updateStatusPanel();
    }
    
    isEquipmentMapped(frontendId) {
        if (!this.equipmentEditState) return true;
        return this.equipmentEditState.isComplete(frontendId);
    }
    
    /**
     * 매핑된 모든 equipment_id 목록 반환
     * @returns {number[]} Equipment ID 배열
     */
    getMappedEquipmentIds() {
        if (!this.equipmentEditState) {
            return [];
        }
        return this.equipmentEditState.getAllEquipmentIds();
    }
    
    connectWebSocket() {
        debugLog(`📡 Connecting to WebSocket: ${this.wsUrl}`);
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                debugLog('✅ WebSocket connected');
                this.reconnectAttempts = 0;
                
                // 연결 후 subscribe 메시지 전송
                this.sendSubscribeMessage();
            };
            
            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };
            
            this.ws.onclose = () => {
                debugLog('🔴 WebSocket closed');
                
                if (this.isActive && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    debugLog(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    setTimeout(() => {
                        this.connectWebSocket();
                    }, this.reconnectDelay);
                }
            };
            
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
        }
    }
    
    /**
     * WebSocket subscribe 메시지 전송
     * 매핑된 모든 equipment_id를 구독 요청
     */
    sendSubscribeMessage() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            debugLog('⚠️ WebSocket not ready for subscribe');
            return;
        }
        
        const equipmentIds = this.getMappedEquipmentIds();
        
        if (equipmentIds.length === 0) {
            debugLog('⚠️ No mapped equipment to subscribe');
            return;
        }
        
        const subscribeMessage = {
            action: 'subscribe',
            equipment_ids: equipmentIds
        };
        
        this.ws.send(JSON.stringify(subscribeMessage));
        debugLog(`📡 Subscribe message sent: ${equipmentIds.length} equipment IDs`);
    }
    
    /**
     * ⭐ v4.0.0: WebSocket 메시지 핸들러 (Memory, Disk 필드 추가)
     * - equipment_id → frontend_id 변환
     * - SignalTower 업데이트
     * - EquipmentInfoPanel 실시간 업데이트 (Memory, Disk 포함)
     */
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            // 연결 확인 메시지
            if (data.type === 'connected') {
                debugLog(`📡 WebSocket: ${data.message}`);
                return;
            }
            
            // 구독 확인 메시지
            if (data.type === 'subscribed') {
                debugLog(`📡 WebSocket subscribed: ${data.message}`);
                return;
            }
            
            // Pong 메시지 (heartbeat)
            if (data.type === 'pong') {
                return;
            }
            
            // equipment_status 처리 - equipment_id → frontend_id 변환
            if (data.type === 'equipment_status') {
                let frontendId = null;
                
                // 1. frontend_id가 있으면 직접 사용 (향후 Backend 개선 시)
                if (data.frontend_id) {
                    frontendId = data.frontend_id;
                }
                // 2. equipment_id로 frontend_id 조회 (현재 방식)
                else if (data.equipment_id && this.equipmentEditState) {
                    frontendId = this.equipmentEditState.getFrontendIdByEquipmentId(data.equipment_id);
                }
                
                if (!frontendId) {
                    debugLog(`⚠️ No frontend_id found for equipment_id: ${data.equipment_id}`);
                    return;
                }
                
                // 매핑된 설비만 처리
                if (this.isEquipmentMapped(frontendId)) {
                    debugLog(`📊 Status update: ${frontendId} (equipment_id: ${data.equipment_id}) -> ${data.status}`);
                    
                    // SignalTower 업데이트
                    this.updateEquipmentStatus(frontendId, data.status);
                    
                    // ⭐ v4.0.0: EquipmentInfoPanel 실시간 업데이트 (Memory, Disk 포함)
                    this.notifyEquipmentInfoPanel(frontendId, data);
                } else {
                    debugLog(`⚠️ Equipment not mapped: ${frontendId}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
        }
    }
    
    /**
     * ⭐ v4.0.1: EquipmentInfoPanel에 실시간 업데이트 전달 (Memory, Disk 필드 포함)
     * - 선택된 설비만 업데이트 (불필요한 호출 방지)
     * @param {string} frontendId - Frontend ID
     * @param {Object} data - WebSocket에서 받은 데이터
     */
    notifyEquipmentInfoPanel(frontendId, data) {
        // EquipmentInfoPanel이 연결되어 있고, 표시 중인 경우에만 전달
        if (!this.equipmentInfoPanel || !this.equipmentInfoPanel.isVisible) {
            return;
        }
        
        // 🆕 v4.0.1: 선택된 설비만 업데이트 (불필요한 호출 방지)
        const selectedFrontendIds = this.equipmentInfoPanel.selectedFrontendIds || [];
        
        // 선택된 설비가 없으면 무시
        if (selectedFrontendIds.length === 0) {
            return;
        }
        
        // 선택된 설비 목록에 포함되지 않으면 무시
        if (!selectedFrontendIds.includes(frontendId)) {
            debugLog(`⏭️ Skipping notify: ${frontendId} not in selected [${selectedFrontendIds.join(', ')}]`);
            return;
        }
        
        // ⭐ v4.0.0: 업데이트 데이터 구성 (Memory, Disk 필드 포함)
        const updateData = {
            frontend_id: frontendId,
            equipment_id: data.equipment_id,
            status: data.status,
            
            // Equipment Info (기존 필드)
            equipment_name: data.equipment_name || null,
            line_name: data.line_name || null,
            
            // Lot Info (기존 필드)
            product_model: data.product_model || null,
            lot_id: data.lot_id || null,
            lot_start_time: data.lot_start_time || null,
            
            // 🆕 v3.4.0: Lot Active/Inactive 분기 필드
            is_lot_active: data.is_lot_active,
            since_time: data.since_time || null,
            
            // PC Info - CPU (기존 필드)
            cpu_usage_percent: data.cpu_usage_percent,
            
            // 🆕 v4.0.0: PC Info - Memory
            memory_total_gb: data.memory_total_gb,
            memory_used_gb: data.memory_used_gb,
            
            // 🆕 v4.0.0: PC Info - Disk C
            disk_c_total_gb: data.disk_c_total_gb,
            disk_c_used_gb: data.disk_c_used_gb,
            
            // 🆕 v4.0.0: PC Info - Disk D (NULL 가능)
            disk_d_total_gb: data.disk_d_total_gb,
            disk_d_used_gb: data.disk_d_used_gb,
            
            // Timestamp
            last_updated: data.timestamp || new Date().toISOString()
        };
        
        // EquipmentInfoPanel.updateRealtime() 호출
        this.equipmentInfoPanel.updateRealtime(updateData);
        
        debugLog(`📊 EquipmentInfoPanel notified: ${frontendId} -> ${data.status}, is_lot_active=${data.is_lot_active}, mem=${data.memory_used_gb}GB`);
    }
    
    updateEquipmentStatus(frontendId, status) {
        const cached = this.statusCache.get(frontendId);
        if (cached === status) {
            return;
        }
        
        this.statusCache.set(frontendId, status);
        
        this.updateQueue.push({
            frontendId: frontendId,
            status: status,
            timestamp: Date.now()
        });
    }
    
    startBatchProcessing() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        
        this.batchTimer = setInterval(() => {
            this.flushUpdateQueue();
        }, this.batchInterval);
        
        debugLog('⏱️ Batch processing started');
    }
    
    flushUpdateQueue() {
        if (this.updateQueue.length === 0) {
            return;
        }
        
        debugLog(`🔄 Processing ${this.updateQueue.length} status updates...`);
        
        this.updateQueue.forEach(update => {
            if (this.signalTowerManager) {
                this.signalTowerManager.updateStatus(
                    update.frontendId,
                    update.status
                );
            }
        });
        
        // ⭐ v3.0.0: 배치 처리 후 패널 업데이트
        this.updateStatusPanel();
        
        this.updateQueue = [];
    }
    
    /**
     * ⭐ v4.0.0: 테스트용: 특정 설비 상태 변경 (Memory, Disk 포함)
     * @param {string} frontendId - Frontend ID (예: 'EQ-01-01')
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED')
     */
    testStatusChange(frontendId, status) {
        debugLog(`🧪 Test status change: ${frontendId} -> ${status}`);
        this.updateEquipmentStatus(frontendId, status);
        this.flushUpdateQueue();
        
        // ⭐ v4.0.0: EquipmentInfoPanel도 테스트 (Memory, Disk 포함)
        this.notifyEquipmentInfoPanel(frontendId, {
            equipment_id: this.equipmentEditState?.getMapping(frontendId)?.equipmentId,
            status: status,
            is_lot_active: true,  // 테스트용 기본값
            lot_start_time: new Date().toISOString(),
            since_time: null,
            // CPU
            cpu_usage_percent: 45.5,
            // 🆕 v4.0.0: Memory
            memory_total_gb: 16.0,
            memory_used_gb: 8.5,
            // 🆕 v4.0.0: Disk C
            disk_c_total_gb: 500,
            disk_c_used_gb: 250,
            // 🆕 v4.0.0: Disk D
            disk_d_total_gb: 1000,
            disk_d_used_gb: 400,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * ⭐ v4.0.0: 테스트용: equipment_id로 상태 변경 (Memory, Disk 포함)
     * @param {number} equipmentId - Equipment ID (예: 75)
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP', 'SUDDENSTOP', 'DISCONNECTED')
     */
    testStatusChangeByEquipmentId(equipmentId, status) {
        const frontendId = this.equipmentEditState?.getFrontendIdByEquipmentId(equipmentId);
        
        if (!frontendId) {
            console.warn(`⚠️ No mapping found for equipment_id: ${equipmentId}`);
            return;
        }
        
        debugLog(`🧪 Test status change by equipment_id: ${equipmentId} -> ${frontendId} -> ${status}`);
        this.updateEquipmentStatus(frontendId, status);
        this.flushUpdateQueue();
        
        // ⭐ v4.0.0: EquipmentInfoPanel도 테스트 (Memory, Disk 포함)
        this.notifyEquipmentInfoPanel(frontendId, {
            equipment_id: equipmentId,
            status: status,
            is_lot_active: false,  // 테스트용: Lot Inactive
            since_time: new Date().toISOString(),
            lot_start_time: null,
            // CPU
            cpu_usage_percent: 72.3,
            // 🆕 v4.0.0: Memory
            memory_total_gb: 32.0,
            memory_used_gb: 24.5,
            // 🆕 v4.0.0: Disk C
            disk_c_total_gb: 256,
            disk_c_used_gb: 180,
            // 🆕 v4.0.0: Disk D (NULL 테스트)
            disk_d_total_gb: null,
            disk_d_used_gb: null,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * ⭐ v3.0.0: 테스트용: 새 매핑 이벤트 시뮬레이션
     * @param {string} frontendId - Frontend ID
     * @param {number} equipmentId - Equipment ID
     */
    testNewMapping(frontendId, equipmentId) {
        debugLog(`🧪 Simulating new mapping: ${frontendId} -> ${equipmentId}`);
        
        this.handleMappingChanged({
            frontendId: frontendId,
            equipmentId: equipmentId
        });
    }
    
    getConnectionStatus() {
        return {
            isActive: this.isActive,
            wsConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
            reconnectAttempts: this.reconnectAttempts,
            cacheSize: this.statusCache.size,
            queueLength: this.updateQueue.length,
            mappedCount: this.equipmentEditState?.getMappingCount() || 0,
            subscribedEquipmentIds: this.getMappedEquipmentIds().length,
            staleThresholdHours: this.staleThresholdHours,
            stats: this.currentStats,
            signalTowerStats: this.signalTowerManager?.getStatusStatistics() || null,
            // ⭐ v3.3.0: EquipmentInfoPanel 연결 상태
            equipmentInfoPanelConnected: !!this.equipmentInfoPanel
        };
    }
    
    /**
     * 디버그 정보 출력
     */
    debugPrintStatus() {
        console.group('🔧 MonitoringService Debug Info');
        console.log('Version: 4.0.1');
        console.log('Stale Threshold:', this.staleThresholdHours, 'hours');
        console.log('EquipmentInfoPanel Connected:', !!this.equipmentInfoPanel);
        console.log('Connection Status:', this.getConnectionStatus());
        console.log('Status Cache:', Object.fromEntries(this.statusCache));
        console.log('Update Queue:', this.updateQueue);
        
        if (this.equipmentEditState) {
            console.log('Equipment ID Index (first 10):', 
                Object.fromEntries(
                    Object.entries(this.equipmentEditState.getEquipmentIdIndex()).slice(0, 10)
                )
            );
        }
        
        if (this.signalTowerManager) {
            this.signalTowerManager.debugPrintStatus();
        }
        
        console.groupEnd();
    }
    
    dispose() {
        debugLog('MonitoringService 메모리 정리 시작...');
        
        this.stop();
        this.statusCache.clear();
        this.updateQueue = [];
        this.equipmentInfoPanel = null;
        
        debugLog('✓ MonitoringService 메모리 정리 완료');
    }
}