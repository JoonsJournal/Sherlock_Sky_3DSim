/**
 * MonitoringStatsPanel.js - v1.0.0
 * 모니터링 통계 패널 UI 모듈
 * 
 * Phase 5: MonitoringService에서 추출
 * - 통계 패널 DOM 생성/제거
 * - HTML 템플릿 렌더링
 * - 통계 데이터 표시 및 집계
 * - SignalTower 통계 연동
 * 
 * @version 1.0.0
 * @since 2026-01-10
 * 
 * DOM 구조:
 * <div id="monitoring-status-panel" class="status-panel">
 *   <div class="status-item">전체</div>
 *   <div class="status-item">매핑</div>
 *   <div class="status-item">미매핑</div>
 *   <div class="status-item">RUN/IDLE/STOP/SUDDEN/DISC</div>
 * </div>
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/monitoring/MonitoringStatsPanel.js
 */

import { debugLog } from '../../core/utils/Config.js';

/**
 * 통계 데이터 기본값
 */
const DEFAULT_STATS = {
    total: 0,           // 전체 설비 수
    mapped: 0,          // 매핑된 설비 수
    unmapped: 0,        // 미매핑 설비 수
    rate: 0,            // 매핑 완료율 (%)
    connected: 0,       // 연결된 설비 수 (24시간 내 데이터 있음)
    disconnected: 0     // 연결 끊긴 설비 수 (24시간 내 데이터 없음)
};

/**
 * 모니터링 통계 패널 클래스
 */
export class MonitoringStatsPanel {
    /**
     * @param {Object} options - 옵션
     * @param {Object} options.signalTowerManager - SignalTowerManager 인스턴스 (선택)
     * @param {string} options.panelId - 패널 DOM ID (기본: 'monitoring-status-panel')
     * @param {string} options.panelClass - 패널 CSS 클래스 (기본: 'status-panel')
     * @param {boolean} options.debug - 디버그 로그 출력 (기본: false)
     */
    constructor(options = {}) {
        this.signalTowerManager = options.signalTowerManager || null;
        this.panelId = options.panelId || 'monitoring-status-panel';
        this.panelClass = options.panelClass || 'status-panel';
        this.debug = options.debug || false;
        
        // DOM 요소
        this.element = null;
        
        // 현재 통계
        this.currentStats = { ...DEFAULT_STATS };
        
        // 업데이트 타이머 (자동 갱신용)
        this.updateTimer = null;
        this.updateInterval = 0;  // 0이면 자동 갱신 비활성화
        
        this._log('📊 MonitoringStatsPanel 초기화');
    }
    
    /**
     * 디버그 로그 출력
     * @private
     */
    _log(...args) {
        if (this.debug) {
            console.log('[MonitoringStatsPanel]', ...args);
        }
        // debugLog도 호출 (Config.js 사용 시)
        if (typeof debugLog === 'function') {
            debugLog('[MonitoringStatsPanel]', ...args);
        }
    }
    
    // ===============================================
    // 의존성 설정
    // ===============================================
    
    /**
     * SignalTowerManager 설정 (지연 주입)
     * @param {Object} manager - SignalTowerManager 인스턴스
     */
    setSignalTowerManager(manager) {
        this.signalTowerManager = manager;
        this._log('🔗 SignalTowerManager 연결됨');
    }
    
    // ===============================================
    // 패널 생성/제거
    // ===============================================
    
    /**
     * 패널 생성
     * @param {Object} stats - 초기 통계 데이터 (선택)
     */
    create(stats = null) {
        // 기존 패널 제거
        this.remove();
        
        // 통계 업데이트
        if (stats) {
            this.currentStats = { ...DEFAULT_STATS, ...stats };
        }
        
        // DOM 생성
        const panel = document.createElement('div');
        panel.id = this.panelId;
        panel.className = this.panelClass;
        panel.innerHTML = this._generateHTML();
        
        document.body.appendChild(panel);
        this.element = panel;
        
        this._log('📊 Status panel created');
    }
    
    /**
     * 패널 업데이트
     * @param {Object} stats - 새 통계 데이터 (선택)
     */
    update(stats = null) {
        if (stats) {
            this.currentStats = { ...this.currentStats, ...stats };
        }
        
        if (this.element) {
            this.element.innerHTML = this._generateHTML();
        }
    }
    
    /**
     * 패널 제거
     */
    remove() {
        // 타이머 정리
        this.stopAutoUpdate();
        
        // 현재 요소 제거
        if (this.element) {
            this.element.remove();
            this.element = null;
            this._log('📊 Status panel removed');
        }
        
        // 혹시 남아있는 패널 제거 (안전장치)
        const existing = document.getElementById(this.panelId);
        if (existing) {
            existing.remove();
        }
    }
    
    /**
     * 패널 표시 여부
     * @returns {boolean}
     */
    isVisible() {
        return this.element !== null && document.body.contains(this.element);
    }
    
    // ===============================================
    // 통계 계산
    // ===============================================
    
    /**
     * 통계 계산 (외부 의존성 필요)
     * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
     * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
     * @returns {Object} 계산된 통계
     */
    calculateStats(equipmentLoader, equipmentEditState) {
        if (!equipmentLoader || !equipmentEditState) {
            this._log('⚠️ Dependencies not available for stats calculation');
            return this.currentStats;
        }
        
        // 전체 설비 수
        const totalEquipment = equipmentLoader.equipmentArray?.length || 0;
        
        // 매핑 수
        const mappedCount = equipmentEditState.getMappingCount?.() || 0;
        const unmappedCount = totalEquipment - mappedCount;
        
        // 매핑 완료율
        const rate = totalEquipment > 0 
            ? Math.round((mappedCount / totalEquipment) * 100) 
            : 0;
        
        // SignalTower 통계에서 connected/disconnected 계산
        let connectedCount = 0;
        let disconnectedCount = 0;
        
        if (this.signalTowerManager) {
            const stats = this.signalTowerManager.getStatusStatistics?.() || {};
            disconnectedCount = stats.DISCONNECTED || 0;
            // Connected = 매핑됨 - DISCONNECTED
            connectedCount = Math.max(0, mappedCount - disconnectedCount);
        }
        
        this.currentStats = {
            total: totalEquipment,
            mapped: mappedCount,
            unmapped: unmappedCount,
            rate: rate,
            connected: connectedCount,
            disconnected: disconnectedCount
        };
        
        this._log('📊 Stats calculated:', this.currentStats);
        
        return { ...this.currentStats };
    }
    
    /**
     * 통계 업데이트 (계산 + 패널 갱신)
     * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
     * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
     */
    refresh(equipmentLoader, equipmentEditState) {
        this.calculateStats(equipmentLoader, equipmentEditState);
        this.update();
    }
    
    /**
     * 현재 통계 조회
     * @returns {Object} 현재 통계 복사본
     */
    getStats() {
        return { ...this.currentStats };
    }
    
    /**
     * 통계 직접 설정
     * @param {Object} stats - 통계 데이터
     */
    setStats(stats) {
        this.currentStats = { ...this.currentStats, ...stats };
    }
    
    // ===============================================
    // 자동 갱신
    // ===============================================
    
    /**
     * 자동 갱신 시작
     * @param {number} intervalMs - 갱신 간격 (ms)
     * @param {Function} refreshCallback - 갱신 시 호출할 콜백
     */
    startAutoUpdate(intervalMs, refreshCallback) {
        this.stopAutoUpdate();
        
        if (intervalMs <= 0) return;
        
        this.updateInterval = intervalMs;
        this.updateTimer = setInterval(() => {
            if (refreshCallback) {
                refreshCallback();
            }
            this.update();
        }, intervalMs);
        
        this._log(`⏱️ Auto update started (interval: ${intervalMs}ms)`);
    }
    
    /**
     * 자동 갱신 중지
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            this._log('⏱️ Auto update stopped');
        }
    }
    
    // ===============================================
    // HTML 생성
    // ===============================================
    
    /**
     * HTML 생성 (내부)
     * @private
     * @returns {string} HTML 문자열
     */
    _generateHTML() {
        const { total, mapped, unmapped, rate } = this.currentStats;
        
        // SignalTower 통계 HTML
        const signalTowerStats = this._generateSignalTowerStatsHTML();
        
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
     * SignalTower 통계 HTML 생성
     * @private
     * @returns {string} HTML 문자열
     */
    _generateSignalTowerStatsHTML() {
        if (!this.signalTowerManager) {
            return '';
        }
        
        const stats = this.signalTowerManager.getStatusStatistics?.() || {
            RUN: 0,
            IDLE: 0,
            STOP: 0,
            SUDDENSTOP: 0,
            DISCONNECTED: 0
        };
        
        return `
            <div class="status-divider">|</div>
            <div class="status-item">
                <span class="status-icon" style="color: #00ff00;">●</span>
                <span class="status-label">RUN</span>
                <span class="status-value">${stats.RUN || 0}</span>
            </div>
            <div class="status-item">
                <span class="status-icon" style="color: #ffff00;">●</span>
                <span class="status-label">IDLE</span>
                <span class="status-value">${stats.IDLE || 0}</span>
            </div>
            <div class="status-item">
                <span class="status-icon" style="color: #ffff00;">●</span>
                <span class="status-label">STOP</span>
                <span class="status-value">${stats.STOP || 0}</span>
            </div>
            <div class="status-item">
                <span class="status-icon status-blink" style="color: #ff0000;">●</span>
                <span class="status-label">SUDDEN</span>
                <span class="status-value">${stats.SUDDENSTOP || 0}</span>
            </div>
            <div class="status-item">
                <span class="status-icon" style="color: #666666;">●</span>
                <span class="status-label">DISC</span>
                <span class="status-value">${stats.DISCONNECTED || 0}</span>
            </div>
        `;
    }
    
    // ===============================================
    // CSS 스타일 주입 (선택적)
    // ===============================================
    
    /**
     * 기본 CSS 스타일 주입
     * 이미 CSS 파일이 있는 경우 호출 불필요
     */
    injectStyles() {
        const styleId = 'monitoring-stats-panel-styles';
        
        // 이미 주입된 경우 스킵
        if (document.getElementById(styleId)) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .status-panel {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.85);
                color: #fff;
                padding: 12px 20px;
                border-radius: 25px;
                display: flex;
                align-items: center;
                gap: 15px;
                font-size: 13px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                z-index: 1000;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .status-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .status-icon {
                font-size: 14px;
            }
            
            .status-icon.connected {
                color: #00ff88;
            }
            
            .status-icon.disconnected {
                color: #ff6b6b;
            }
            
            .status-label {
                color: #aaa;
                font-size: 11px;
            }
            
            .status-value {
                font-weight: 600;
                color: #fff;
            }
            
            .status-divider {
                color: #444;
                font-weight: 300;
            }
            
            /* 깜빡임 애니메이션 (SUDDENSTOP) */
            .status-blink {
                animation: blink 0.5s infinite;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
        `;
        
        document.head.appendChild(style);
        this._log('💄 Default styles injected');
    }
    
    /**
     * 주입된 스타일 제거
     */
    removeStyles() {
        const style = document.getElementById('monitoring-stats-panel-styles');
        if (style) {
            style.remove();
            this._log('💄 Styles removed');
        }
    }
    
    // ===============================================
    // 리소스 정리
    // ===============================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.remove();
        this.signalTowerManager = null;
        this.currentStats = { ...DEFAULT_STATS };
        this._log('🗑️ MonitoringStatsPanel disposed');
    }
}

/**
 * 싱글톤 인스턴스 (기본값)
 * MonitoringService에서 직접 생성하므로 이 인스턴스는 테스트용
 */
export const monitoringStatsPanel = new MonitoringStatsPanel({ debug: true });

export default MonitoringStatsPanel;