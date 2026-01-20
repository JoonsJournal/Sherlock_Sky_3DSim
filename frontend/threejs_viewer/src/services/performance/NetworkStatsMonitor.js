/**
 * NetworkStatsMonitor.js
 * ======================
 * 네트워크 통계 모니터링 서비스
 * 
 * @version 1.0.0
 * @description
 * - WebSocket Latency 측정
 * - 메시지 수신/발신 카운트
 * - Delta Update 카운트
 * - Cache Hit Rate 추적
 * - 초당 메시지 수 계산
 * 
 * @changelog
 * - v1.0.0: 초기 버전 (2026-01-21)
 *   - Latency 추적 (UDS WebSocket Ping/Pong 기반)
 *   - 메시지 카운트 (In/Out)
 *   - Delta Update 카운트
 *   - Cache Hit Rate (UDS 연계)
 *   - 초당 메시지 계산
 * 
 * @dependencies
 * - services/uds/UnifiedDataStore.js
 * - core/managers/EventBus.js
 * 
 * @exports
 * - NetworkStatsMonitor (class)
 * - networkStatsMonitor (singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/performance/NetworkStatsMonitor.js
 * 작성일: 2026-01-21
 * 수정일: 2026-01-21
 */

import { eventBus } from '../../core/managers/EventBus.js';

export class NetworkStatsMonitor {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * EventBus 이벤트 상수
     * 
     * @example
     * eventBus.on(NetworkStatsMonitor.EVENTS.STATS_UPDATED, (data) => { ... });
     */
    static EVENTS = {
        /** 통계 갱신 (1초마다): { stats: { latency, messagesIn, ... } } */
        STATS_UPDATED: 'network:stats:updated',
        
        /** Latency 경고: { latency, threshold } */
        LATENCY_WARNING: 'network:latency:warning',
        
        /** 연결 상태 변경: { connected: boolean } */
        CONNECTION_CHANGED: 'network:connection:changed'
    };
    
    /**
     * 임계값 설정
     */
    static THRESHOLDS = {
        LATENCY: { 
            warning: 100,   // ms > 100: warning
            critical: 300   // ms > 300: critical
        },
        CACHE_HIT_RATE: { 
            warning: 90,    // % < 90: warning
            critical: 70    // % < 70: critical
        }
    };
    
    // =========================================================================
    // Constructor
    // =========================================================================
    
    constructor() {
        /**
         * 네트워크 통계
         * @type {Object}
         */
        this._stats = {
            /** WebSocket Latency (ms) */
            latency: 0,
            
            /** 수신 메시지 총 개수 */
            messagesIn: 0,
            
            /** 발신 메시지 총 개수 */
            messagesOut: 0,
            
            /** Delta Update 총 개수 */
            deltaUpdates: 0,
            
            /** 캐시 히트율 (%) */
            cacheHitRate: 100,
            
            /** WebSocket 연결 상태 */
            connected: false,
            
            /** 마지막 메시지 수신 시간 */
            lastMessageTime: null,
            
            /** 바이트 수신량 총계 */
            bytesReceived: 0,
            
            /** 바이트 발신량 총계 */
            bytesSent: 0
        };
        
        // 초당 메시지 카운트 계산용
        /** @type {number} 초당 수신 메시지 수 */
        this._messagesInPerSecond = 0;
        
        /** @type {number} 초당 발신 메시지 수 */
        this._messagesOutPerSecond = 0;
        
        /** @type {number} 이전 초의 수신 카운트 (비교용) */
        this._lastSecondIn = 0;
        
        /** @type {number} 이전 초의 발신 카운트 (비교용) */
        this._lastSecondOut = 0;
        
        // UnifiedDataStore 참조 (lazy initialization)
        /** @type {Object|null} UDS 참조 */
        this._unifiedDataStore = null;
        
        // 1초 간격 업데이트 인터벌
        /** @type {number|null} 인터벌 ID */
        this._intervalId = null;
        
        // 활성화 상태
        /** @type {boolean} */
        this._enabled = true;
        
        // 이벤트 구독 설정
        this._setupEventListeners();
        
        // 1초마다 per-second 통계 계산
        this._startPeriodicUpdate();
        
        console.log('🚀 [NetworkStatsMonitor] 생성됨');
    }
    
    // =========================================================================
    // Public Methods - Configuration
    // =========================================================================
    
    /**
     * UnifiedDataStore 참조 설정
     * UDS의 getCacheHitRate, getDeltaCount 메서드 사용을 위해 필요
     * 
     * @param {Object} uds - UnifiedDataStore 인스턴스
     */
    setUnifiedDataStore(uds) {
        this._unifiedDataStore = uds;
        console.log('✅ [NetworkStatsMonitor] UnifiedDataStore 연결됨');
    }
    
    /**
     * 모니터링 활성화/비활성화
     * 
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        
        if (enabled && !this._intervalId) {
            this._startPeriodicUpdate();
        } else if (!enabled && this._intervalId) {
            this._stopPeriodicUpdate();
        }
        
        console.log(`${enabled ? '✅' : '⏸️'} [NetworkStatsMonitor] 모니터링 ${enabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * 임계값 업데이트
     * 
     * @param {string} metric - 메트릭 이름 (LATENCY, CACHE_HIT_RATE)
     * @param {Object} thresholds - { warning: number, critical: number }
     */
    setThreshold(metric, thresholds) {
        const upperMetric = metric.toUpperCase();
        if (NetworkStatsMonitor.THRESHOLDS[upperMetric]) {
            NetworkStatsMonitor.THRESHOLDS[upperMetric] = {
                ...NetworkStatsMonitor.THRESHOLDS[upperMetric],
                ...thresholds
            };
            console.log(`📊 [NetworkStatsMonitor] ${metric} 임계값 업데이트:`, thresholds);
        } else {
            console.warn(`⚠️ [NetworkStatsMonitor] 알 수 없는 메트릭: ${metric}`);
        }
    }
    
    // =========================================================================
    // Public Methods - Stats Access
    // =========================================================================
    
    /**
     * 현재 통계 반환 (복사본)
     * 
     * @returns {Object} 전체 통계 객체
     */
    getStats() {
        return {
            ...this._stats,
            messagesInPerSec: this._messagesInPerSecond,
            messagesOutPerSec: this._messagesOutPerSecond
        };
    }
    
    /**
     * 현재 Latency 반환
     * 
     * @returns {number} ms
     */
    getLatency() {
        return this._stats.latency;
    }
    
    /**
     * Latency 상태 등급 반환
     * 
     * @returns {string} 'good' | 'warning' | 'critical'
     */
    getLatencyGrade() {
        const latency = this._stats.latency;
        
        if (latency > NetworkStatsMonitor.THRESHOLDS.LATENCY.critical) {
            return 'critical';
        }
        if (latency > NetworkStatsMonitor.THRESHOLDS.LATENCY.warning) {
            return 'warning';
        }
        return 'good';
    }
    
    /**
     * 캐시 히트율 반환
     * 
     * @returns {number} 0~100 (%)
     */
    getCacheHitRate() {
        // UDS에서 직접 가져오기 (우선)
        if (this._unifiedDataStore && typeof this._unifiedDataStore.getCacheHitRate === 'function') {
            return this._unifiedDataStore.getCacheHitRate();
        }
        return this._stats.cacheHitRate;
    }
    
    /**
     * Delta Update 총 개수 반환
     * 
     * @returns {number}
     */
    getDeltaCount() {
        // UDS에서 직접 가져오기 (우선)
        if (this._unifiedDataStore && typeof this._unifiedDataStore.getDeltaCount === 'function') {
            return this._unifiedDataStore.getDeltaCount();
        }
        return this._stats.deltaUpdates;
    }
    
    /**
     * 초당 Delta Update 수 반환
     * 
     * @returns {number}
     */
    getDeltaUpdatesPerSecond() {
        return this._messagesInPerSecond;
    }
    
    /**
     * WebSocket 연결 상태 반환
     * 
     * @returns {boolean}
     */
    isConnected() {
        return this._stats.connected;
    }
    
    /**
     * 총 수신 바이트 반환
     * 
     * @returns {number}
     */
    getTotalBytesReceived() {
        return this._stats.bytesReceived;
    }
    
    /**
     * 총 발신 바이트 반환
     * 
     * @returns {number}
     */
    getTotalBytesSent() {
        return this._stats.bytesSent;
    }
    
    /**
     * 네트워크 상태 등급 반환 (종합)
     * 
     * @returns {string} 'good' | 'warning' | 'critical' | 'disconnected'
     */
    getNetworkGrade() {
        if (!this._stats.connected) {
            return 'disconnected';
        }
        
        const latencyGrade = this.getLatencyGrade();
        const cacheHitRate = this.getCacheHitRate();
        
        if (latencyGrade === 'critical' || 
            cacheHitRate < NetworkStatsMonitor.THRESHOLDS.CACHE_HIT_RATE.critical) {
            return 'critical';
        }
        
        if (latencyGrade === 'warning' || 
            cacheHitRate < NetworkStatsMonitor.THRESHOLDS.CACHE_HIT_RATE.warning) {
            return 'warning';
        }
        
        return 'good';
    }
    
    // =========================================================================
    // Public Methods - Recording (외부 모듈에서 호출)
    // =========================================================================
    
    /**
     * WebSocket 메시지 수신 기록
     * 
     * @param {number} [size=0] - 메시지 바이트 크기
     */
    recordWsMessage(size = 0) {
        this._stats.messagesIn++;
        this._stats.bytesReceived += size;
        this._stats.lastMessageTime = Date.now();
    }
    
    /**
     * WebSocket 메시지 발신 기록
     * 
     * @param {number} [size=0] - 메시지 바이트 크기
     */
    recordWsSend(size = 0) {
        this._stats.messagesOut++;
        this._stats.bytesSent += size;
    }
    
    /**
     * Delta Update 기록
     */
    recordDeltaUpdate() {
        this._stats.deltaUpdates++;
    }
    
    /**
     * Latency 직접 기록
     * 
     * @param {number} latency - ms
     */
    recordLatency(latency) {
        this._stats.latency = latency;
        
        // Latency 경고 체크
        if (latency > NetworkStatsMonitor.THRESHOLDS.LATENCY.warning) {
            eventBus.emit(NetworkStatsMonitor.EVENTS.LATENCY_WARNING, {
                latency,
                threshold: latency > NetworkStatsMonitor.THRESHOLDS.LATENCY.critical 
                    ? NetworkStatsMonitor.THRESHOLDS.LATENCY.critical 
                    : NetworkStatsMonitor.THRESHOLDS.LATENCY.warning,
                level: latency > NetworkStatsMonitor.THRESHOLDS.LATENCY.critical ? 'critical' : 'warning'
            });
        }
    }
    
    /**
     * 연결 상태 업데이트
     * 
     * @param {boolean} connected
     */
    updateConnectionStatus(connected) {
        if (this._stats.connected !== connected) {
            this._stats.connected = connected;
            
            eventBus.emit(NetworkStatsMonitor.EVENTS.CONNECTION_CHANGED, {
                connected,
                timestamp: Date.now()
            });
            
            console.log(`${connected ? '🟢' : '🔴'} [NetworkStatsMonitor] 연결 상태: ${connected ? '연결됨' : '연결 해제'}`);
        }
    }
    
    /**
     * 캐시 히트율 직접 업데이트
     * 
     * @param {number} rate - 0~100 (%)
     */
    updateCacheHitRate(rate) {
        this._stats.cacheHitRate = rate;
    }
    
    // =========================================================================
    // Private Methods
    // =========================================================================
    
    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // UDS Latency 이벤트 구독
        eventBus.on('uds:latency', (event) => {
            if (event && typeof event.latency === 'number') {
                this.recordLatency(event.latency);
            }
        });
        
        // UDS 연결 이벤트 구독
        eventBus.on('uds:connected', () => {
            this.updateConnectionStatus(true);
        });
        
        // UDS 연결 해제 이벤트 구독
        eventBus.on('uds:disconnected', () => {
            this.updateConnectionStatus(false);
        });
        
        // UDS 에러 이벤트 구독
        eventBus.on('uds:error', () => {
            // 에러 발생 시 연결 상태 확인
            // 연결 해제는 uds:disconnected 이벤트에서 처리
        });
        
        console.log('   └─ 이벤트 리스너 설정 완료');
    }
    
    /**
     * 1초 주기 업데이트 시작
     * @private
     */
    _startPeriodicUpdate() {
        if (this._intervalId) {
            return; // 이미 실행 중
        }
        
        this._intervalId = setInterval(() => {
            if (!this._enabled) return;
            
            this._updatePerSecondStats();
            this._syncFromUDS();
            this._emitStatsUpdate();
            
        }, 1000);
        
        console.log('   └─ 1초 주기 업데이트 시작');
    }
    
    /**
     * 1초 주기 업데이트 중지
     * @private
     */
    _stopPeriodicUpdate() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
            console.log('   └─ 1초 주기 업데이트 중지');
        }
    }
    
    /**
     * 초당 메시지 통계 계산
     * @private
     */
    _updatePerSecondStats() {
        // 초당 수신 메시지
        this._messagesInPerSecond = this._stats.messagesIn - this._lastSecondIn;
        this._lastSecondIn = this._stats.messagesIn;
        
        // 초당 발신 메시지
        this._messagesOutPerSecond = this._stats.messagesOut - this._lastSecondOut;
        this._lastSecondOut = this._stats.messagesOut;
    }
    
    /**
     * UDS에서 통계 동기화
     * @private
     */
    _syncFromUDS() {
        if (!this._unifiedDataStore) return;
        
        // 캐시 히트율 동기화
        if (typeof this._unifiedDataStore.getCacheHitRate === 'function') {
            this._stats.cacheHitRate = this._unifiedDataStore.getCacheHitRate();
        }
        
        // Delta 카운트 동기화
        if (typeof this._unifiedDataStore.getDeltaCount === 'function') {
            this._stats.deltaUpdates = this._unifiedDataStore.getDeltaCount();
        }
    }
    
    /**
     * 통계 업데이트 이벤트 발행
     * @private
     */
    _emitStatsUpdate() {
        eventBus.emit(NetworkStatsMonitor.EVENTS.STATS_UPDATED, {
            stats: this.getStats(),
            timestamp: Date.now()
        });
    }
    
    // =========================================================================
    // Debug & Cleanup
    // =========================================================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('📊 [NetworkStatsMonitor] Debug Info');
        console.log('활성화 상태:', this._enabled);
        console.log('UDS 연결:', !!this._unifiedDataStore);
        console.log('현재 통계:', this.getStats());
        console.log('네트워크 등급:', this.getNetworkGrade());
        console.log('Latency 등급:', this.getLatencyGrade());
        console.log('초당 수신 메시지:', this._messagesInPerSecond);
        console.log('초당 발신 메시지:', this._messagesOutPerSecond);
        console.log('임계값 설정:', NetworkStatsMonitor.THRESHOLDS);
        console.groupEnd();
    }
    
    /**
     * 통계 리셋
     */
    reset() {
        this._stats = {
            latency: 0,
            messagesIn: 0,
            messagesOut: 0,
            deltaUpdates: 0,
            cacheHitRate: 100,
            connected: false,
            lastMessageTime: null,
            bytesReceived: 0,
            bytesSent: 0
        };
        
        this._messagesInPerSecond = 0;
        this._messagesOutPerSecond = 0;
        this._lastSecondIn = 0;
        this._lastSecondOut = 0;
        
        console.log('🔄 [NetworkStatsMonitor] 통계 리셋 완료');
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this._stopPeriodicUpdate();
        
        // 이벤트 리스너 제거
        eventBus.off('uds:latency');
        eventBus.off('uds:connected');
        eventBus.off('uds:disconnected');
        eventBus.off('uds:error');
        
        this._unifiedDataStore = null;
        
        console.log('🗑️ [NetworkStatsMonitor] 정리 완료');
    }
}

// =========================================================================
// Singleton Export
// =========================================================================

/** @type {NetworkStatsMonitor} 싱글톤 인스턴스 */
export const networkStatsMonitor = new NetworkStatsMonitor();

// 전역 접근 (디버깅용)
if (typeof window !== 'undefined') {
    window.networkStatsMonitor = networkStatsMonitor;
    
    // 디버그 명령어
    window.netDebug = () => networkStatsMonitor.debug();
}