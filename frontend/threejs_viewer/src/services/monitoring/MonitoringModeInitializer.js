/**
 * MonitoringModeInitializer.js
 * Monitoring Mode 진입 시 자동 초기화
 * 
 * Connection Manager 연동:
 * - 연결된 사이트 자동 감지
 * - 해당 사이트 매핑 자동 로드
 * - Signal Tower 초기화
 * 
 * @version 2.0.0
 */

import { MappingConfigService } from '../services/mapping/MappingConfigService.js';
import { debugLog } from '../core/utils/Config.js';

export class MonitoringModeInitializer {
    /**
     * @param {Object} options
     * @param {Object} options.app - 메인 Application 인스턴스
     * @param {Object} options.signalTowerManager - SignalTowerManager 인스턴스
     * @param {Object} options.monitoringService - MonitoringService 인스턴스
     * @param {Object} options.editState - EquipmentEditState 인스턴스
     * @param {string} options.siteId - 사이트 ID (선택, 없으면 자동 감지)
     */
    constructor(options = {}) {
        this.app = options.app;
        this.signalTowerManager = options.signalTowerManager;
        this.monitoringService = options.monitoringService;
        this.editState = options.editState;
        this.siteId = options.siteId || null;  // null이면 자동 감지
        
        this.mappingConfigService = null;
        
        this.isInitialized = false;
        this.initializationError = null;
        
        debugLog('🚀 MonitoringModeInitializer created');
    }
    
    /**
     * Monitoring Mode 초기화
     * 연결된 사이트의 매핑을 자동으로 로드
     * 
     * @returns {Promise<Object>} 초기화 결과
     */
    async initialize() {
        debugLog('🔄 Starting Monitoring Mode initialization...');
        
        const startTime = performance.now();
        const results = {
            success: false,
            siteId: null,
            siteName: null,
            mappingLoaded: false,
            mappingCount: 0,
            signalTowerReady: false,
            monitoringConnected: false,
            errors: [],
            warnings: []
        };
        
        try {
            // Step 1: 매핑 Config 서비스 초기화
            debugLog('📡 Step 1: Loading mapping config...');
            
            this.mappingConfigService = new MappingConfigService();
            
            let mappingSuccess = false;
            
            if (this.siteId) {
                // 명시적 siteId가 있으면 해당 사이트 로드
                mappingSuccess = await this.mappingConfigService.loadSiteMapping(this.siteId);
            } else {
                // 현재 연결된 사이트에서 자동 로드
                mappingSuccess = await this.mappingConfigService.initializeFromCurrentConnection();
            }
            
            if (mappingSuccess) {
                results.mappingLoaded = true;
                results.mappingCount = this.mappingConfigService.getMappingCount();
                results.siteId = this.mappingConfigService.siteId;
                
                const siteInfo = this.mappingConfigService.getSiteInfo();
                results.siteName = siteInfo.displayName;
                
                debugLog(`✅ Mapping loaded: ${results.mappingCount} equipments`);
                
                // EditState에 매핑 적용
                if (this.editState) {
                    this.mappingConfigService.applyToEditState(this.editState);
                }
            } else {
                results.warnings.push('No mapping config found. Using local mappings if available.');
                debugLog('⚠️ No mapping from server');
            }
            
            // Step 2: Signal Tower 초기화
            debugLog('🚦 Step 2: Initializing Signal Towers...');
            
            if (this.signalTowerManager) {
                try {
                    await this._initializeSignalTowers();
                    results.signalTowerReady = true;
                    debugLog('✅ Signal Towers initialized');
                } catch (error) {
                    results.warnings.push(`Signal Tower: ${error.message}`);
                }
            }
            
            // Step 3: Monitoring Service 연결
            debugLog('📊 Step 3: Connecting Monitoring Service...');
            
            if (this.monitoringService) {
                try {
                    await this._startMonitoringService();
                    results.monitoringConnected = true;
                    debugLog('✅ Monitoring Service connected');
                } catch (error) {
                    results.warnings.push(`Monitoring: ${error.message}`);
                }
            }
            
            this.isInitialized = true;
            results.success = true;
            
            const elapsed = (performance.now() - startTime).toFixed(2);
            debugLog(`✅ Monitoring Mode initialized in ${elapsed}ms`);
            
        } catch (error) {
            this.initializationError = error;
            results.errors.push(error.message);
            console.error('❌ Initialization failed:', error);
        }
        
        return results;
    }
    
    /**
     * Signal Tower 초기화
     */
    async _initializeSignalTowers() {
        if (!this.signalTowerManager || !this.mappingConfigService) {
            return;
        }
        
        const mappings = this.mappingConfigService.getAllMappings();
        
        for (const [frontendId] of mappings) {
            this.signalTowerManager.updateEquipmentStatus(frontendId, 'IDLE');
        }
    }
    
    /**
     * Monitoring Service 시작
     */
    async _startMonitoringService() {
        if (!this.monitoringService) {
            return;
        }
        
        if (typeof this.monitoringService.start === 'function') {
            await this.monitoringService.start();
        } else if (typeof this.monitoringService.connect === 'function') {
            await this.monitoringService.connect();
        }
    }
    
    /**
     * 사이트 변경
     * @param {string} newSiteId - 예: 'korea_site1_line2'
     * @returns {Promise<Object>}
     */
    async changeSite(newSiteId) {
        debugLog(`🔄 Changing site to: ${newSiteId}`);
        
        this.siteId = newSiteId;
        this.isInitialized = false;
        
        if (this.mappingConfigService) {
            await this.mappingConfigService.changeSite(newSiteId);
            
            // EditState 갱신
            if (this.editState) {
                this.mappingConfigService.applyToEditState(this.editState);
            }
        }
        
        return await this.initialize();
    }
    
    /**
     * 매핑 정보 조회
     * @param {string} frontendId
     * @returns {Object|null}
     */
    getMapping(frontendId) {
        return this.mappingConfigService?.getMappingDetails(frontendId) || null;
    }
    
    /**
     * Equipment ID → Frontend ID
     * @param {number} equipmentId
     * @returns {string|null}
     */
    getFrontendId(equipmentId) {
        return this.mappingConfigService?.getFrontendId(equipmentId) || null;
    }
    
    /**
     * 상태 정보
     * @returns {Object}
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            siteId: this.mappingConfigService?.siteId || null,
            siteInfo: this.mappingConfigService?.getSiteInfo() || null,
            completion: this.mappingConfigService?.getCompletionStatus() || null,
            error: this.initializationError?.message || null
        };
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        if (this.mappingConfigService) {
            this.mappingConfigService.clearCache();
        }
        
        if (this.monitoringService?.stop) {
            this.monitoringService.stop();
        }
        
        this.isInitialized = false;
        debugLog('🔧 MonitoringModeInitializer disposed');
    }
    
    /**
     * 디버그 출력
     */
    debugPrint() {
        console.group('🚀 MonitoringModeInitializer');
        console.log('Status:', this.getStatus());
        this.mappingConfigService?.debugPrint();
        console.groupEnd();
    }
}

export default MonitoringModeInitializer;


// ============================================
// 사용 예시
// ============================================
/*

// 1. Connection Modal에서 사이트 연결 후
import { MonitoringModeInitializer } from './monitoring/MonitoringModeInitializer.js';

// 연결 후 자동 감지 방식
async function onConnectionSuccess(connectionResult) {
    // connectionResult = { site_id: 'korea_site1_line1', ... }
    
    const initializer = new MonitoringModeInitializer({
        app: app,
        signalTowerManager: app.signalTowerManager,
        monitoringService: app.monitoringService,
        editState: app.equipmentEditState
        // siteId 생략 → 현재 연결된 사이트 자동 감지
    });
    
    const result = await initializer.initialize();
    
    if (result.success) {
        console.log(`✅ ${result.siteName}: ${result.mappingCount}대 설비 연동`);
        app.showToast(`모니터링 모드 활성화 (${result.mappingCount}대)`, 'success');
    }
}

// 2. 특정 사이트 명시적 지정
async function enterMonitoringModeForSite(siteId) {
    const initializer = new MonitoringModeInitializer({
        siteId: 'korea_site1_line1',  // 명시적 지정
        editState: app.equipmentEditState
    });
    
    const result = await initializer.initialize();
}

*/