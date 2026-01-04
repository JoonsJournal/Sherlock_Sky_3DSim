/**
 * MonitoringService.js - 수정 버전
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ 추가 기능: Monitoring Mode에서 DB 미연결 설비 비활성화 표시
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/MonitoringService.js
 */

import { debugLog } from '../core/utils/Config.js';

export class MonitoringService {
    constructor(signalTowerManager, equipmentLoader = null, equipmentEditState = null) {
        this.signalTowerManager = signalTowerManager;
        
        // ⭐ 새로 추가: EquipmentLoader & EditState 참조
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        
        // Backend API 엔드포인트
        this.apiBaseUrl = 'http://localhost:8000/api/monitoring';
        this.wsUrl = 'ws://localhost:8000/api/monitoring/stream';
        
        // WebSocket 연결
        this.ws = null;
        this.isActive = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3초
        
        // 상태 캐시 (중복 업데이트 방지)
        this.statusCache = new Map();
        
        // 업데이트 큐 (배치 처리)
        this.updateQueue = [];
        this.batchInterval = 1000; // 1초마다 배치 처리
        this.batchTimer = null;
        
        // ⭐ 비활성화 표시 옵션
        this.disabledOptions = {
            opacity: 0.25,       // 미연결 설비 투명도
            grayScale: true,     // 회색조 적용
            grayColor: 0x666666  // 회색 색상
        };
        
        debugLog('MonitoringService initialized (with disabled equipment support)');
    }
    
    /**
     * ⭐ 의존성 주입 (나중에 설정하는 경우)
     */
    setDependencies(equipmentLoader, equipmentEditState) {
        this.equipmentLoader = equipmentLoader;
        this.equipmentEditState = equipmentEditState;
        debugLog('MonitoringService dependencies set');
    }
    
    /**
     * 모니터링 시작
     */
    async start() {
        if (this.isActive) {
            debugLog('⚠️ Monitoring already active');
            return;
        }
        
        debugLog('🟢 Starting monitoring mode...');
        this.isActive = true;
        
        try {
            // ⭐ 1. 미연결 설비 비활성화 표시 적용
            this.applyUnmappedEquipmentStyle();
            
            // 2. 초기 상태 로드 (REST API)
            await this.loadInitialStatus();
            
            // 3. WebSocket 연결
            this.connectWebSocket();
            
            // 4. 배치 처리 타이머 시작
            this.startBatchProcessing();
            
            debugLog('✅ Monitoring mode started');
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error);
            this.isActive = false;
        }
    }
    
    /**
     * 모니터링 중지
     */
    stop() {
        debugLog('🔴 Stopping monitoring mode...');
        this.isActive = false;
        
        // ⭐ 1. 비활성화 표시 해제 (모든 설비 원래대로)
        this.resetEquipmentStyle();
        
        // WebSocket 연결 종료
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // 배치 처리 타이머 중지
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        
        debugLog('✅ Monitoring mode stopped');
    }
    
    // ============================================
    // ⭐ 미연결 설비 비활성화 표시 (NEW)
    // ============================================
    
    /**
     * ⭐ Monitoring Mode 시작 시: 미연결 설비 비활성화 스타일 적용
     */
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
        
        debugLog(`🌫️ Unmapped equipment disabled: ${result.unmapped}개`);
        debugLog(`✅ Mapped equipment active: ${result.mapped}개`);
        
        // Toast 알림 (옵션)
        if (result.unmapped > 0) {
            this.showToast(
                `⚠️ ${result.unmapped}개 설비가 DB에 연결되지 않음`, 
                'warning'
            );
        }
    }
    
    /**
     * ⭐ Monitoring Mode 종료 시: 모든 설비 원래 상태로 복원
     */
    resetEquipmentStyle() {
        if (!this.equipmentLoader) {
            debugLog('⚠️ EquipmentLoader not available');
            return;
        }
        
        this.equipmentLoader.resetAllEquipmentVisibility();
        debugLog('✅ All equipment styles reset');
    }
    
    /**
     * ⭐ 비활성화 옵션 설정
     * @param {Object} options - { opacity, grayScale, grayColor }
     */
    setDisabledOptions(options) {
        this.disabledOptions = { ...this.disabledOptions, ...options };
        
        // 활성 상태면 즉시 재적용
        if (this.isActive) {
            this.applyUnmappedEquipmentStyle();
        }
    }
    
    /**
     * Toast 메시지 표시 (선택적)
     */
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => toast.remove(), 5000);
    }
    
    // ============================================
    // 기존 메서드들 (수정 없음)
    // ============================================
    
    /**
     * 초기 설비 상태 로드 (REST API)
     */
    async loadInitialStatus() {
        debugLog('📡 Loading initial equipment status...');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/status`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.equipment || !Array.isArray(data.equipment)) {
                throw new Error('Invalid response format');
            }
            
            debugLog(`✅ Loaded ${data.equipment.length} equipment status`);
            
            // 각 설비 상태 업데이트 (매핑된 것만)
            data.equipment.forEach(item => {
                if (item.frontend_id && item.status) {
                    // ⭐ 매핑된 설비만 상태 업데이트
                    if (this.isEquipmentMapped(item.frontend_id)) {
                        this.updateEquipmentStatus(item.frontend_id, item.status);
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Failed to load initial status:', error);
            // 개발 환경에서는 더미 데이터 사용
            if (error.message.includes('Failed to fetch')) {
                debugLog('⚠️ Using dummy data for development');
                this.loadDummyStatus();
            }
        }
    }
    
    /**
     * ⭐ 설비가 매핑되었는지 확인
     */
    isEquipmentMapped(frontendId) {
        if (!this.equipmentEditState) return true; // fallback
        return this.equipmentEditState.isComplete(frontendId);
    }
    
    /**
     * WebSocket 연결
     */
    connectWebSocket() {
        debugLog(`📡 Connecting to WebSocket: ${this.wsUrl}`);
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                debugLog('✅ WebSocket connected');
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };
            
            this.ws.onclose = () => {
                debugLog('🔴 WebSocket closed');
                
                // 자동 재연결 (모니터링 활성화 상태일 때만)
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
     * WebSocket 메시지 처리
     */
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'equipment_status') {
                // ⭐ 매핑된 설비만 상태 변경
                if (this.isEquipmentMapped(data.frontend_id)) {
                    debugLog(`📊 Status update: ${data.frontend_id} -> ${data.status}`);
                    this.updateEquipmentStatus(data.frontend_id, data.status);
                } else {
                    debugLog(`⏭️ Skipping unmapped equipment: ${data.frontend_id}`);
                }
                
            } else if (data.type === 'heartbeat') {
                // 하트비트 (무시)
                
            } else {
                debugLog('⚠️ Unknown message type:', data.type);
            }
            
        } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
        }
    }
    
    /**
     * 설비 상태 업데이트
     */
    updateEquipmentStatus(frontendId, status) {
        // 캐시 확인 (중복 업데이트 방지)
        const cached = this.statusCache.get(frontendId);
        if (cached === status) {
            return; // 변경 없음
        }
        
        // 캐시 업데이트
        this.statusCache.set(frontendId, status);
        
        // 업데이트 큐에 추가
        this.updateQueue.push({
            frontendId: frontendId,
            status: status,
            timestamp: Date.now()
        });
    }
    
    /**
     * 배치 처리 시작
     */
    startBatchProcessing() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        
        this.batchTimer = setInterval(() => {
            this.flushUpdateQueue();
        }, this.batchInterval);
        
        debugLog('⏱️ Batch processing started');
    }
    
    /**
     * 업데이트 큐 플러시 (배치 처리)
     */
    flushUpdateQueue() {
        if (this.updateQueue.length === 0) {
            return;
        }
        
        debugLog(`🔄 Processing ${this.updateQueue.length} status updates...`);
        
        // SignalTowerManager를 통해 실제 3D 객체 업데이트
        this.updateQueue.forEach(update => {
            if (this.signalTowerManager) {
                this.signalTowerManager.updateStatus(
                    update.frontendId,
                    update.status
                );
            }
        });
        
        // 큐 초기화
        this.updateQueue = [];
    }
    
    /**
     * 테스트용 상태 변경
     * @param {string} frontendId - 설비 Frontend ID (예: 'EQ-01-01')
     * @param {string} status - 상태 ('RUN', 'IDLE', 'STOP')
     */
    testStatusChange(frontendId, status) {
        debugLog(`🧪 Test status change: ${frontendId} -> ${status}`);
        this.updateEquipmentStatus(frontendId, status);
        this.flushUpdateQueue(); // 즉시 적용
    }
    
    /**
     * 개발용 더미 데이터 로드 (매핑된 것만)
     */
    loadDummyStatus() {
        debugLog('🧪 Loading dummy status data...');
        
        // 매핑된 설비 목록 가져오기
        const mappings = this.equipmentEditState?.getAllMappings() || {};
        const mappedIds = Object.keys(mappings);
        
        if (mappedIds.length === 0) {
            debugLog('⚠️ No mapped equipment found');
            return;
        }
        
        // 매핑된 설비에만 랜덤 상태 적용
        const statuses = ['RUN', 'IDLE', 'STOP'];
        mappedIds.slice(0, 10).forEach(frontendId => { // 처음 10개만
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            this.updateEquipmentStatus(frontendId, randomStatus);
        });
        
        this.flushUpdateQueue();
        debugLog('✅ Dummy status loaded for mapped equipment');
    }
    
    /**
     * 현재 연결 상태 확인
     */
    getConnectionStatus() {
        return {
            isActive: this.isActive,
            wsConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
            reconnectAttempts: this.reconnectAttempts,
            cacheSize: this.statusCache.size,
            queueLength: this.updateQueue.length,
            // ⭐ 추가 정보
            mappedCount: this.equipmentEditState?.getMappingCount() || 0
        };
    }
    
    /**
     * 메모리 정리
     */
    dispose() {
        debugLog('MonitoringService 메모리 정리 시작...');
        
        this.stop();
        this.statusCache.clear();
        this.updateQueue = [];
        
        debugLog('✓ MonitoringService 메모리 정리 완료');
    }
}