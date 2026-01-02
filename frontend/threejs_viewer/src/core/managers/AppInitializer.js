/**
 * AppInitializer.js
 * 애플리케이션 초기화 로직
 * Phase 1.2: main.js에서 분리
 */

import * as THREE from 'three';

// Core imports
import { SceneManager } from '../../viewer3d/scene/SceneManager.js';
import { EquipmentLoader } from '../../viewer3d/scene/EquipmentLoader.js';
import { Lighting } from '../../viewer3d/scene/Lighting.js';
import { CameraControls } from '../../viewer3d/controls/CameraControls.js';
import { CameraNavigator } from '../../viewer3d/controls/CameraNavigator.js';
import { InteractionHandler } from '../../viewer3d/controls/InteractionHandler.js';
import { DataOverlay } from '../../viewer3d/visualization/DataOverlay.js';
import { StatusVisualizer } from '../../viewer3d/visualization/StatusVisualizer.js';
import { memoryManager } from '../utils/MemoryManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import { CONFIG, debugLog } from '../utils/Config.js';

// UI imports
import { ConnectionModal } from '../../ui/modals/ConnectionModal.js';
import { EquipmentEditState } from '../../services/EquipmentEditState.js';
import { EquipmentEditModal } from '../../ui/modals/EquipmentEditModal.js';
import { ApiClient } from '../../api/ApiClient.js';

// Services imports
import { MonitoringService } from '../../services/MonitoringService.js';
import { SignalTowerManager } from '../../services/SignalTowerManager.js';

// Layout imports
import { Layout2DTo3DConverter, layout2DTo3DConverter } from '../../services/converter/Layout2DTo3DConverter.js';
import { RoomParamsAdapter, roomParamsAdapter } from '../../services/converter/RoomParamsAdapter.js';

/**
 * AppInitializer 클래스
 * 애플리케이션의 모든 초기화 로직을 관리
 */
export class AppInitializer {
    constructor() {
        // 모든 인스턴스를 저장할 객체
        this.instances = {
            sceneManager: null,
            equipmentLoader: null,
            cameraControls: null,
            cameraNavigator: null,
            interactionHandler: null,
            dataOverlay: null,
            statusVisualizer: null,
            performanceMonitor: null,
            connectionModal: null,
            equipmentEditState: null,
            equipmentEditModal: null,
            apiClient: null,
            monitoringService: null,
            signalTowerManager: null,
            previewGenerator: null
        };
        
        this.animationFrameId = null;
    }
    
    /**
     * 메인 초기화 함수
     * @returns {Object} 초기화된 인스턴스들
     */
    init() {
        console.log('🚀 Sherlock Sky 3DSim 초기화...');
        
        try {
            // 1. Scene Manager 생성 및 초기화
            this.initSceneManager();
            
            // 2. 조명 추가
            this.initLighting();
            
            // 3. Equipment Loader
            this.initEquipmentLoader();
            
            // 4. Camera Controls
            this.initCameraControls();
            
            // 5. DataOverlay 초기화
            this.initDataOverlay();
            
            // 6. StatusVisualizer 초기화
            this.initStatusVisualizer();
            
            // 7. PerformanceMonitor 초기화
            this.initPerformanceMonitor();
            
            // 8. Interaction Handler
            this.initInteractionHandler();
            
            // 9. ConnectionModal 초기화
            this.initConnectionModal();
            
            // 10. Equipment Edit 시스템 초기화
            this.initEquipmentEditSystem();
            
            // 11. Monitoring Service 초기화
            this.initMonitoringService();
            
            // 12. InteractionHandler 연결 완료
            this.finalizeInteractionHandler();
            
            console.log('✅ 모든 초기화 완료!');
            console.log('💡 콘솔에서 debugHelp() 입력으로 사용 가능한 명령어 확인');
            
            // 초기 메모리 정보
            this.logInitialMemoryInfo();
            
            // 로딩 상태 숨김
            this.hideLoadingStatus();
            
            return this.instances;
            
        } catch (error) {
            this.handleInitError(error);
            throw error;
        }
    }
    
    /**
     * Scene Manager 초기화
     */
    initSceneManager() {
        this.instances.sceneManager = new SceneManager();
        const initSuccess = this.instances.sceneManager.init();
        
        if (!initSuccess) {
            throw new Error('SceneManager 초기화 실패');
        }
        
        if (!this.instances.sceneManager.renderer || !this.instances.sceneManager.renderer.domElement) {
            console.error('❌ Renderer 또는 domElement가 없습니다!');
            throw new Error('Renderer 초기화 실패');
        }
        
        console.log('✅ SceneManager 초기화 완료');
    }
    
    /**
     * 조명 초기화
     */
    initLighting() {
        Lighting.addLights(this.instances.sceneManager.scene);
        console.log('✅ Lighting 초기화 완료');
    }
    
    /**
     * Equipment Loader 초기화
     */
    initEquipmentLoader() {
        this.instances.equipmentLoader = new EquipmentLoader(this.instances.sceneManager.scene);
        
        // 로딩 상태 콜백 함수
        const updateLoadingStatus = (message, isError) => {
            const statusDiv = document.getElementById('loadingStatus');
            if (statusDiv) {
                statusDiv.textContent = message;
                statusDiv.style.color = isError ? '#e74c3c' : '#2ecc71';
            }
            debugLog(isError ? '❌' : '✅', message);
        };
        
        // 설비 배열 로드
        this.instances.equipmentLoader.loadEquipmentArray(updateLoadingStatus);
        console.log('✅ EquipmentLoader 초기화 완료');
        
        // SceneManager-EquipmentLoader 연결
        if (this.instances.sceneManager.setEquipmentLoader) {
            this.instances.sceneManager.setEquipmentLoader(this.instances.equipmentLoader);
            console.log('✅ SceneManager-EquipmentLoader 연결 완료');
        }
    }
    
    /**
     * Camera Controls 초기화
     */
    initCameraControls() {
        console.log('🎮 CameraControls 생성 중...');
        this.instances.cameraControls = new CameraControls(
            this.instances.sceneManager.camera,
            this.instances.sceneManager.renderer.domElement
        );
        console.log('✅ CameraControls 초기화 완료');

        // Camera Navigator 추가
        this.instances.cameraNavigator = new CameraNavigator(
            this.instances.sceneManager.camera,
            this.instances.cameraControls.controls,
            new THREE.Vector3(0, 0, 0)  // 클린룸 중심
        );
        console.log('✅ CameraNavigator 초기화 완료');
    }
    
    /**
     * DataOverlay 초기화
     */
    initDataOverlay() {
        this.instances.dataOverlay = new DataOverlay();
        this.instances.dataOverlay.exposeGlobalFunctions();
        console.log('✅ DataOverlay 초기화 완료');
    }
    
    /**
     * StatusVisualizer 초기화
     */
    initStatusVisualizer() {
        this.instances.statusVisualizer = new StatusVisualizer(
            this.instances.equipmentLoader.getEquipmentArray()
        );
        this.instances.statusVisualizer.updateAllStatus();
        console.log('✅ StatusVisualizer 초기화 완료');
    }
    
    /**
     * PerformanceMonitor 초기화
     */
    initPerformanceMonitor() {
        this.instances.performanceMonitor = new PerformanceMonitor(
            this.instances.sceneManager.renderer
        );
        console.log('✅ PerformanceMonitor 초기화 완료');
        console.log('💡 성능 모니터링 명령어:');
        console.log('   - startMonitoring() : 실시간 모니터링 시작 (1초마다 콘솔 출력)');
        console.log('   - stopMonitoring() : 모니터링 중지');
        console.log('   - getPerformanceReport() : 상세 분석 리포트 출력');
    }
    
    /**
     * InteractionHandler 초기화
     */
    initInteractionHandler() {
        this.instances.interactionHandler = new InteractionHandler(
            this.instances.sceneManager.camera,
            this.instances.sceneManager.scene,
            this.instances.sceneManager.renderer.domElement,
            this.instances.equipmentLoader.getEquipmentArray(),
            this.instances.dataOverlay
        );
        console.log('✅ InteractionHandler 초기화 완료');
    }
    
    /**
     * ConnectionModal 초기화
     */
    initConnectionModal() {
        this.instances.connectionModal = new ConnectionModal();
        console.log('✅ ConnectionModal 초기화 완료');
    }
    
    /**
     * Equipment Edit 시스템 초기화
     */
    initEquipmentEditSystem() {
        // API Client 초기화
        this.instances.apiClient = new ApiClient();
        console.log('✅ ApiClient 초기화 완료');
        
        // Equipment Edit State 초기화
        this.instances.equipmentEditState = new EquipmentEditState();
        console.log('✅ EquipmentEditState 초기화 완료');
        
        // Equipment Edit Modal 초기화
        this.instances.equipmentEditModal = new EquipmentEditModal(
            this.instances.equipmentEditState,
            this.instances.apiClient
        );
        console.log('✅ EquipmentEditModal 초기화 완료');
    }
    
    /**
     * Monitoring Service 초기화
     */
    initMonitoringService() {
        // Signal Tower Manager 초기화
        this.instances.signalTowerManager = new SignalTowerManager(
            this.instances.sceneManager.scene,
            this.instances.equipmentLoader
        );
        
        // 기존 equipment1.js의 경광등 램프들을 찾아서 초기화
        const lightCount = this.instances.signalTowerManager.initializeAllLights();
        console.log(`✅ SignalTowerManager 초기화 완료: ${lightCount}개 설비의 경광등 연결`);
        
        // Monitoring Service 초기화
        this.instances.monitoringService = new MonitoringService(
            this.instances.signalTowerManager
        );
        console.log('✅ MonitoringService 초기화 완료');
        
        // 전역 객체로 노출 (테스트용)
        window.monitoringService = this.instances.monitoringService;
        window.signalTowerManager = this.instances.signalTowerManager;
    }
    
    /**
     * InteractionHandler 연결 완료
     */
    finalizeInteractionHandler() {
        const { interactionHandler, equipmentLoader, dataOverlay, 
                statusVisualizer, equipmentEditState, equipmentEditModal } = this.instances;
        
        // 설비 배열 설정
        interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
        
        // DataOverlay 연결
        interactionHandler.setDataOverlay(dataOverlay);
        
        // StatusVisualizer 연결
        interactionHandler.setStatusVisualizer(statusVisualizer);
        
        // 설비 클릭 콜백 설정
        interactionHandler.setOnEquipmentClick((selectedData) => {
            debugLog('📊 설비 선택됨:', selectedData.map(d => d.id));
        });
        
        // 설비 선택 해제 콜백 설정
        interactionHandler.setOnEquipmentDeselect(() => {
            debugLog('📊 설비 선택 해제됨');
        });
        
        // Edit 모드 연결
        interactionHandler.setEditMode(equipmentEditState);
        interactionHandler.setEditModal(equipmentEditModal);

        console.log('✅ InteractionHandler 초기화 완료');
    }
    
    /**
     * 초기 메모리 정보 로깅
     */
    logInitialMemoryInfo() {
        if (CONFIG.DEBUG_MODE) {
            setTimeout(() => {
                memoryManager.logMemoryInfo(this.instances.sceneManager.renderer);
            }, 1000);
        }
    }
    
    /**
     * 로딩 상태 숨김
     */
    hideLoadingStatus() {
        setTimeout(() => {
            const loadingStatus = document.getElementById('loadingStatus');
            if (loadingStatus) {
                loadingStatus.style.transition = 'opacity 0.5s';
                loadingStatus.style.opacity = '0';
                setTimeout(() => {
                    loadingStatus.style.display = 'none';
                }, 500);
            }
        }, 3000);
    }
    
    /**
     * 초기화 에러 처리
     * @param {Error} error 
     */
    handleInitError(error) {
        console.error('❌ 초기화 중 오류 발생:', error);
        console.error('스택:', error.stack);
        
        // 오류 정보 화면에 표시
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(231, 76, 60, 0.95);
            color: white;
            padding: 30px;
            border-radius: 10px;
            font-family: monospace;
            font-size: 14px;
            z-index: 10000;
            max-width: 80%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        errorDiv.innerHTML = `
            <h2 style="margin: 0 0 10px 0;">❌ 초기화 실패</h2>
            <p><strong>오류:</strong> ${error.message}</p>
            <p><strong>해결 방법:</strong></p>
            <ul>
                <li>브라우저 콘솔(F12)에서 자세한 오류 확인</li>
                <li>페이지 새로고침 (Ctrl+F5)</li>
                <li>브라우저 캐시 삭제</li>
            </ul>
        `;
        document.body.appendChild(errorDiv);
    }
    
    /**
     * PreviewGenerator 초기화 (지연 로드)
     */
    initPreviewGenerator() {
        const connectPreviewGenerator = () => {
            if (window.PreviewGenerator && !this.instances.previewGenerator) {
                try {
                    const previewCanvas = document.getElementById('preview-canvas');
                    
                    if (previewCanvas) {
                        this.instances.previewGenerator = new window.PreviewGenerator({
                            container: previewCanvas,
                            width: previewCanvas.clientWidth || 600,
                            height: previewCanvas.clientHeight || 400
                        });
                        
                        window.previewGenerator = this.instances.previewGenerator;
                        console.log('[AppInitializer] ✅ PreviewGenerator 초기화 완료');
                    } else {
                        console.log('[AppInitializer] Preview canvas not found yet, will try later');
                    }
                } catch (error) {
                    console.warn('[AppInitializer] PreviewGenerator 초기화 실패:', error);
                }
            }
        };
        
        // 즉시 시도
        connectPreviewGenerator();
        
        // 지연 시도 (DOM이 늦게 로드될 경우)
        setTimeout(connectPreviewGenerator, 500);
        setTimeout(connectPreviewGenerator, 1000);
        setTimeout(connectPreviewGenerator, 2000);
        
        // Preview Modal이 열릴 때 초기화
        window.addEventListener('preview-modal-opened', () => {
            connectPreviewGenerator();
        });
    }
    
    /**
     * LayoutEditorMain과 SceneManager 연결
     */
    setupLayoutEditorMainConnection() {
        const connectLayoutEditorMain = () => {
            if (window.layoutEditorMain && this.instances.sceneManager) {
                if (typeof window.layoutEditorMain.setSceneManager === 'function') {
                    window.layoutEditorMain.setSceneManager(this.instances.sceneManager);
                    console.log('[AppInitializer] LayoutEditorMain-SceneManager 연결 완료');
                }
            }
        };
        
        // 즉시 시도
        connectLayoutEditorMain();
        
        // 지연 시도
        setTimeout(connectLayoutEditorMain, 100);
        setTimeout(connectLayoutEditorMain, 500);
        
        // 이벤트 기반 연결
        window.addEventListener('layout-editor-main-ready', () => {
            connectLayoutEditorMain();
        });
    }
    
    /**
     * 인스턴스 getter
     */
    getInstances() {
        return this.instances;
    }
    
    /**
     * 특정 인스턴스 getter
     */
    getInstance(name) {
        return this.instances[name];
    }
}

// 싱글톤 인스턴스 export
export const appInitializer = new AppInitializer();