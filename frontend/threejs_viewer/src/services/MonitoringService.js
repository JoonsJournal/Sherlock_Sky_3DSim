/**
 * MonitoringService.js - v2.3.0
 * 실시간 설비 모니터링 서비스
 * 
 * ⭐ 최종 버전: 미연결 설비 비활성화 표시 + 통계 패널
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
        
        // ⭐ 미연결 설비 색상 옵션
        this.disabledOptions = {
            grayColor: 0x444444  // 어두운 회색 (바닥과 구별)
        };
        
        this.statusPanelElement = null;
        
        this.currentStats = {
            mapped: 0,
            unmapped: 0,
            total: 0,
            rate: 0
        };
        
        debugLog('MonitoringService initialized');
    }
    
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
            // 1. 미연결 설비 비활성화 표시 적용
            this.applyUnmappedEquipmentStyle();
            
            // 2. 통계 패널 표시
            this.createStatusPanel();
            
            // 3. 초기 상태 로드 (REST API) - 실패해도 계속 진행
            await this.loadInitialStatus().catch(err => {
                debugLog(`⚠️ loadInitialStatus failed: ${err.message}`);
            });
            
            // 4. WebSocket 연결 - 실패해도 계속 진행
            this.connectWebSocket();
            
            // 5. 배치 처리 타이머 시작
            this.startBatchProcessing();
            
            debugLog('✅ Monitoring mode started');
            
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
        
        // 1. 비활성화 표시 해제
        this.resetEquipmentStyle();
        
        // 2. 통계 패널 제거
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
    
    async loadInitialStatus() {
        debugLog('📡 Loading initial equipment status...');
        
        const response = await fetch(`${this.apiBaseUrl}/status`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.equipment || !Array.isArray(data.equipment)) {
            throw new Error('Invalid response format');
        }
        
        debugLog(`✅ Loaded ${data.equipment.length} equipment status`);
        
        data.equipment.forEach(item => {
            if (item.frontend_id && item.status) {
                if (this.isEquipmentMapped(item.frontend_id)) {
                    this.updateEquipmentStatus(item.frontend_id, item.status);
                }
            }
        });
    }
    
    isEquipmentMapped(frontendId) {
        if (!this.equipmentEditState) return true;
        return this.equipmentEditState.isComplete(frontendId);
    }
    
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
    
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'equipment_status') {
                if (this.isEquipmentMapped(data.frontend_id)) {
                    debugLog(`📊 Status update: ${data.frontend_id} -> ${data.status}`);
                    this.updateEquipmentStatus(data.frontend_id, data.status);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
        }
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
        
        this.updateQueue = [];
    }
    
    testStatusChange(frontendId, status) {
        debugLog(`🧪 Test status change: ${frontendId} -> ${status}`);
        this.updateEquipmentStatus(frontendId, status);
        this.flushUpdateQueue();
    }
    
    getConnectionStatus() {
        return {
            isActive: this.isActive,
            wsConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
            reconnectAttempts: this.reconnectAttempts,
            cacheSize: this.statusCache.size,
            queueLength: this.updateQueue.length,
            mappedCount: this.equipmentEditState?.getMappingCount() || 0,
            stats: this.currentStats
        };
    }
    
    dispose() {
        debugLog('MonitoringService 메모리 정리 시작...');
        
        this.stop();
        this.statusCache.clear();
        this.updateQueue = [];
        
        debugLog('✓ MonitoringService 메모리 정리 완료');
    }
}
