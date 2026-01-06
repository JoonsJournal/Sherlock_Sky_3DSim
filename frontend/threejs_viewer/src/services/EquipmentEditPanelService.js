/**
 * EquipmentEditPanelService.js
 * Equipment Edit 모드 통계 패널 서비스
 * 
 * ⭐ v1.0.0: 신규 생성
 * - Equipment Edit 모드 진입 시 통계 패널 표시
 * - 전체/매핑/미매핑 설비 수 표시
 * - 실시간 업데이트 지원
 * - AppModeManager와 연동
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/EquipmentEditPanelService.js
 */

import { debugLog } from '../core/utils/Config.js';

export class EquipmentEditPanelService {
    /**
     * 생성자
     * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
     * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
     */
    constructor(equipmentEditState = null, equipmentLoader = null) {
        this.equipmentEditState = equipmentEditState;
        this.equipmentLoader = equipmentLoader;
        
        // 통계 패널 DOM 요소
        this.statusPanelElement = null;
        
        // 활성화 상태
        this.isActive = false;
        
        // 현재 통계
        this.currentStats = {
            total: 0,
            mapped: 0,
            unmapped: 0,
            rate: 0
        };
        
        // 이벤트 핸들러 바인딩
        this._boundHandleMappingChanged = this.handleMappingChanged.bind(this);
        this._boundHandleMappingRemoved = this.handleMappingRemoved.bind(this);
        
        debugLog('EquipmentEditPanelService initialized (v1.0.0)');
    }
    
    /**
     * 의존성 설정
     * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
     * @param {Object} equipmentLoader - EquipmentLoader 인스턴스
     */
    setDependencies(equipmentEditState, equipmentLoader) {
        this.equipmentEditState = equipmentEditState;
        this.equipmentLoader = equipmentLoader;
        debugLog('EquipmentEditPanelService dependencies set');
    }
    
    // ============================================
    // 패널 활성화/비활성화
    // ============================================
    
    /**
     * Equipment Edit 모드 시작 - 패널 표시
     */
    start() {
        if (this.isActive) {
            debugLog('⚠️ EquipmentEditPanelService already active');
            return;
        }
        
        debugLog('🟢 Starting Equipment Edit Panel...');
        this.isActive = true;
        
        // 1. 통계 패널 생성
        this.createStatusPanel();
        
        // 2. 이벤트 리스너 등록
        this.registerEventListeners();
        
        debugLog('✅ Equipment Edit Panel started');
    }
    
    /**
     * Equipment Edit 모드 종료 - 패널 제거
     */
    stop() {
        debugLog('🔴 Stopping Equipment Edit Panel...');
        this.isActive = false;
        
        // 1. 이벤트 리스너 해제
        this.unregisterEventListeners();
        
        // 2. 통계 패널 제거
        this.removeStatusPanel();
        
        debugLog('✅ Equipment Edit Panel stopped');
    }
    
    // ============================================
    // 이벤트 리스너
    // ============================================
    
    /**
     * 이벤트 리스너 등록
     */
    registerEventListeners() {
        // mapping-changed 이벤트 수신 (새 매핑 발생)
        window.addEventListener('mapping-changed', this._boundHandleMappingChanged);
        
        // mapping-removed 이벤트 수신 (매핑 삭제)
        window.addEventListener('mapping-removed', this._boundHandleMappingRemoved);
        
        debugLog('📡 EquipmentEditPanelService event listeners registered');
    }
    
    /**
     * 이벤트 리스너 해제
     */
    unregisterEventListeners() {
        window.removeEventListener('mapping-changed', this._boundHandleMappingChanged);
        window.removeEventListener('mapping-removed', this._boundHandleMappingRemoved);
        
        debugLog('📡 EquipmentEditPanelService event listeners unregistered');
    }
    
    /**
     * 매핑 변경 이벤트 핸들러
     * @param {CustomEvent} event
     */
    handleMappingChanged(event) {
        if (!this.isActive) return;
        
        const data = event.detail || {};
        debugLog(`🔗 Mapping changed: ${data.frontendId} → ${data.equipmentId}`);
        
        // 통계 패널 업데이트
        this.updateStatusPanel();
    }
    
    /**
     * 매핑 삭제 이벤트 핸들러
     * @param {CustomEvent} event
     */
    handleMappingRemoved(event) {
        if (!this.isActive) return;
        
        const data = event.detail || {};
        debugLog(`🗑️ Mapping removed: ${data.frontendId}`);
        
        // 통계 패널 업데이트
        this.updateStatusPanel();
    }
    
    // ============================================
    // 통계 패널 관리
    // ============================================
    
    /**
     * 통계 패널 생성
     */
    createStatusPanel() {
        this.removeStatusPanel();
        
        const panel = document.createElement('div');
        panel.id = 'equipment-edit-status-panel';
        panel.className = 'status-panel status-panel--edit';
        
        this.updateStats();
        panel.innerHTML = this.getStatusPanelHTML();
        
        document.body.appendChild(panel);
        this.statusPanelElement = panel;
        
        debugLog('📊 Equipment Edit status panel created');
    }
    
    /**
     * 통계 패널 HTML 생성
     * @returns {string}
     */
    getStatusPanelHTML() {
        const { total, mapped, unmapped, rate } = this.currentStats;
        
        return `
            <div class="status-item">
                <span class="status-icon">✏️</span>
                <span class="status-label">Edit Mode</span>
            </div>
            <div class="status-divider">|</div>
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
        `;
    }
    
    /**
     * 통계 정보 업데이트
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
            total: totalEquipment,
            mapped: mappedCount,
            unmapped: unmappedCount,
            rate: rate
        };
    }
    
    /**
     * 통계 패널 업데이트
     */
    updateStatusPanel() {
        if (!this.statusPanelElement) return;
        
        this.updateStats();
        this.statusPanelElement.innerHTML = this.getStatusPanelHTML();
        
        debugLog(`📊 Equipment Edit panel updated: ${this.currentStats.mapped}/${this.currentStats.total}`);
    }
    
    /**
     * 통계 패널 제거
     */
    removeStatusPanel() {
        if (this.statusPanelElement) {
            this.statusPanelElement.remove();
            this.statusPanelElement = null;
            debugLog('📊 Equipment Edit status panel removed');
        }
        
        // 혹시 남아있는 패널 제거
        const existingPanel = document.getElementById('equipment-edit-status-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
    }
    
    /**
     * 현재 통계 반환
     * @returns {Object}
     */
    getStats() {
        this.updateStats();
        return { ...this.currentStats };
    }
    
    // ============================================
    // 디버그 및 유틸리티
    // ============================================
    
    /**
     * 디버그 정보 출력
     */
    debugPrintStatus() {
        console.group('🔧 EquipmentEditPanelService Debug Info');
        console.log('Version: 1.0.0');
        console.log('Is Active:', this.isActive);
        console.log('Current Stats:', this.currentStats);
        console.log('Panel Element:', this.statusPanelElement ? 'EXISTS' : 'NULL');
        console.log('Dependencies:', {
            equipmentEditState: this.equipmentEditState ? 'SET' : 'NULL',
            equipmentLoader: this.equipmentLoader ? 'SET' : 'NULL'
        });
        console.groupEnd();
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        debugLog('EquipmentEditPanelService 메모리 정리 시작...');
        
        this.stop();
        this.equipmentEditState = null;
        this.equipmentLoader = null;
        
        debugLog('✓ EquipmentEditPanelService 메모리 정리 완료');
    }
}

// 전역 디버그 명령어 등록 (개발 환경에서만)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.debugEquipmentEditPanel = () => {
        if (window.equipmentEditPanelService) {
            window.equipmentEditPanelService.debugPrintStatus();
        } else {
            console.warn('equipmentEditPanelService instance not found');
        }
    };
    
    console.log('💡 Debug command available: debugEquipmentEditPanel()');
}