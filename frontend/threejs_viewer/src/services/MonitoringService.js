/**
 * MonitoringService.js - v2.0
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ 추가 기능: 
 * - Monitoring Mode에서 DB 미연결 설비 비활성화 표시
 * - 통계 패널 표시 (연결/미연결 개수, 완료율)
 * - 미연결 설비 클릭 시 안내 메시지
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
        
        // ⭐ 통계 패널 요소
        this.statusPanelElement = null;
        
        // ⭐ 현재 통계
        this.currentStats = {
            mapped: 0,
            unmapped: 0,
            total: 0,
            rate: 0
        };
        
        debugLog('MonitoringService initialized (with status panel & unmapped notification)');
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
            
            // ⭐ 2. 통계 패널 표시
            this.createStatusPanel();
            
            // 3. 초기 상태 로드 (REST API)
            await this.loadInitialStatus();
            
            // 4. WebSocket 연결
            this.connectWebSocket();
            
            // 5. 배치 처리 타이머 시작
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
        
        // ⭐ 2. 통계 패널 제거
        this.removeStatusPanel();
        
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
    // ⭐ 통계 패널 관리 (NEW)
    // ============================================
    
    /**
     * ⭐ 통계 패널 생성
     */
    createStatusPanel() {
        // 이미 존재하면 제거
        this.removeStatusPanel();
        
        const panel = document.createElement('div');
        panel.id = 'monitoring-status-panel';
        panel.className = 'status-panel';
        
        // 통계 계산
        this.updateStats();
        
        panel.innerHTML = this.getStatusPanelHTML();
        
        document.body.appendChild(panel);
        this.statusPanelElement = panel;
        
        debugLog('📊 Status panel created');
    }
    
    /**
     * ⭐ 통계 패널 HTML 생성
     */
    getStatusPanelHTML() {
        const { mapped, unmapped, rate } = this.currentStats;
        
        return `
            <div class="status-item">
                <span class="status-icon connected">✅</span>
                <span class="status-value">${mapped}개 연결</span>
            </div>
            <div class="status-divider">|</div>
            <div class="status-item">
                <span class="status-icon disconnected">⚠️</span>
                <span class="status-value">${unmapped}개 미연결</span>
            </div>
            <div class="status-divider">|</div>
            <div class="status-item">
                <span class="status-icon">📊</span>
                <span class="status-value">${rate}% 완료</span>
            </div>
        `;
    }
    
    /**
     * ⭐ 통계 업데이트
     */
    updateStats() {
        if (!this.equipmentLoader || !this.equipmentEditState) {
            return;
        }
        
        const totalEquipment = this.equipmentLoader.equipmentArray?.length || 0;
        const mappedCount = this.equipmentEditState.getMappingCount() || 0;
        const unmappedCount = totalEquipment - mappedCount;
        const rate = totalEquipment > 0 ? Math.round((mappedCount / totalEquipment) * 100) : 0;
        
        this.currentStats = {
            mapped: mappedCount,
            unmapped: unmappedCount,
            total: totalEquipment,
            rate: rate
        };
    }
    
    /**
     * ⭐ 통계 패널 업데이트
     */
    updateStatusPanel() {
        if (!this.statusPanelElement) return;
        
        this.updateStats();
        this.statusPanelElement.innerHTML = this.getStatusPanelHTML();
    }
    
    /**
     * ⭐ 통계 패널 제거
     */
    removeStatusPanel() {
        if (this.statusPanelElement) {
            this.statusPanelElement.remove();
            this.statusPanelElement = null;
            debugLog('📊 Status panel removed');
        }
        
        // ID로도 한번 더 확인해서 제거
        const existingPanel = document.getElementById('monitoring-status-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
    }
    
    /**
     * ⭐ 현재 통계 반환
     */
    getStats() {
        this.updateStats();
        return { ...this.currentStats };
    }
    
    // ============================================
    // ⭐ 미연결 설비 클릭 안내 (NEW)
    // ============================================
    
    /**
     * ⭐ 설비가 매핑되었는지 확인하고 안내 메시지 표시
     * @param {string} frontendId - 설비 ID
     * @returns {boolean} 매핑 여부
     */
    checkAndNotifyUnmapped(frontendId) {
        if (!this.isActive) return true; // Monitoring Mode가 아니면 패스
        
        const isMapped = this.isEquipmentMapped(frontendId);
        
        if (!isMapped) {
            this.showUnmappedNotification(frontendId);
            return false;
        }
        
        return true;
    }
    
    /**
     * ⭐ 미연결 설비 안내 표시
     */
    showUnmappedNotification(frontendId) {
        // Toast 메시지 표시
        this.showToast(
            `⚠️ "${frontendId}"는 DB에 연결되지 않았습니다.\nEdit Mode (E키)에서 매핑해주세요.`,
            'warning',
            5000
        );
        
        debugLog(`⚠️ Unmapped equipment clicked: ${frontendId}`);
    }
    
    // ============================================
    // ⭐ 미연결 설비 비활성화 표시
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
        
        // 통계 업데이트
        this.currentStats.mapped = result.mapped;
        this.currentStats.unmapped = result.unmapped;
        this.currentStats.total = result.mapped + result.unmapped;
        this.currentStats.rate = this.currentStats.total > 0 
            ? Math.round((result.mapped / this.currentStats.total) * 100) 
            : 0;
        
        debugLog(`🌫️ Unmapped equipment disabled: ${result.unmapped}개`);
        debugLog(`✅ Mapped equipment active: ${result.mapped}개`);
        
        // Toast 알림
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
            this.updateStatusPanel();
        }
    }
    
    /**
     * Toast 메시지 표시
     */
    showToast(message, type = 'info', duration = 5000) {
        // 기존 toast 시스템 사용 시도
        if (window.toast?.show) {
            window.toast.show(message.replace(/\n/g, ' '), type);
            return;
        }
        
        // Fallback: 직접 생성
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
    // 기존 메서드들
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
            mappedCount: this.equipmentEditState?.getMappingCount() || 0,
            stats: this.currentStats
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
