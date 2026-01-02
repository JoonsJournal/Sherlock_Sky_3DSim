/**
 * MonitoringService.js
 * 실시간 설비 모니터링 서비스
 * - Backend API 호출 (설비 상태 조회)
 * - WebSocket 연결 관리 (실시간 업데이트)
 * - Signal Tower 업데이트 트리거
 */

import { debugLog } from '../core/utils/Config.js';

export class MonitoringService {
    constructor(signalTowerManager) {
        this.signalTowerManager = signalTowerManager;
        
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
        
        debugLog('MonitoringService initialized');
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
            // 1. 초기 상태 로드 (REST API)
            await this.loadInitialStatus();
            
            // 2. WebSocket 연결
            this.connectWebSocket();
            
            // 3. 배치 처리 타이머 시작
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
            
            // 각 설비 상태 업데이트
            data.equipment.forEach(item => {
                if (item.frontend_id && item.status) {
                    this.updateEquipmentStatus(item.frontend_id, item.status);
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
                // 설비 상태 변경 이벤트
                debugLog(`📊 Status update: ${data.frontend_id} -> ${data.status}`);
                this.updateEquipmentStatus(data.frontend_id, data.status);
                
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
     * 개발용 더미 데이터 로드
     */
    loadDummyStatus() {
        debugLog('🧪 Loading dummy status data...');
        
        // 더미 데이터: 일부 설비를 RUN/IDLE/STOP으로 설정
        const dummyData = [
            { frontendId: 'EQ-01-01', status: 'RUN' },
            { frontendId: 'EQ-01-02', status: 'IDLE' },
            { frontendId: 'EQ-02-01', status: 'STOP' },
            { frontendId: 'EQ-03-01', status: 'RUN' },
            { frontendId: 'EQ-04-01', status: 'IDLE' },
        ];
        
        dummyData.forEach(item => {
            this.updateEquipmentStatus(item.frontendId, item.status);
        });
        
        this.flushUpdateQueue();
        debugLog('✅ Dummy status loaded');
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
            queueLength: this.updateQueue.length
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