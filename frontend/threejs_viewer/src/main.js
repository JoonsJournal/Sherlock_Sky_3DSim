/**
 * main.js
 * 메인 애플리케이션 진입점
 * SceneManager, EquipmentLoader, CameraControls, InteractionHandler, DataOverlay, StatusVisualizer, PerformanceMonitor 통합
 * ⭐ Phase 2 추가: ConnectionModal 통합
 * ⭐ Phase 4.2 추가: RoomParamsAdapter 및 Layout 적용 연동
 * ⭐ Phase 4.4 추가: SceneManager-EquipmentLoader 연결, LayoutEditorMain 연동
 * ⭐ Phase 4.5 추가: PreviewGenerator 통합
*/

// ⭐⭐⭐ 1. THREE import (가장 먼저!)
import * as THREE from 'three';

import { SceneManager } from './viewer3d/scene/SceneManager.js';
import { EquipmentLoader } from './viewer3d/scene/EquipmentLoader.js';
import { Lighting } from './viewer3d/scene/Lighting.js';
import { CameraControls } from './viewer3d/controls/CameraControls.js';
import { CameraNavigator } from './viewer3d/controls/CameraNavigator.js';
import { InteractionHandler } from './viewer3d/controls/InteractionHandler.js';
import { DataOverlay } from './viewer3d/visualization/DataOverlay.js';
import { StatusVisualizer } from './viewer3d/visualization/StatusVisualizer.js';
import { memoryManager } from './core/utils/MemoryManager.js';
import { PerformanceMonitor } from './core/utils/PerformanceMonitor.js';
import { CONFIG, debugLog } from './core/utils/Config.js';

// ============================================
// ⭐ 새로 추가: ConnectionModal import
// ============================================
import { ConnectionModal } from './ui/modals/ConnectionModal.js';

import { EquipmentEditState } from './services/EquipmentEditState.js';
import { EquipmentEditModal } from './ui/modals/EquipmentEditModal.js';
import { ApiClient } from './api/ApiClient.js';

// ============================================
// ⭐ Phase 2: Monitoring Service import
// ============================================
import { MonitoringService } from './services/MonitoringService.js';
import { SignalTowerManager } from './services/SignalTowerManager.js';

// ============================================
// ⭐ Phase 4.2: Layout 변환 및 적용 import
// ============================================
import { Layout2DTo3DConverter, layout2DTo3DConverter } from './services/converter/Layout2DTo3DConverter.js';
import { RoomParamsAdapter, roomParamsAdapter } from './services/converter/RoomParamsAdapter.js';

// ============================================
// ⭐ Phase 4.5: PreviewGenerator import (선택적)
// ============================================
// PreviewGenerator는 전역 스크립트로 로드되거나 동적으로 로드됨
// import { PreviewGenerator } from './layout_editor/services/PreviewGenerator.js';

// 전역 객체
let sceneManager;
let equipmentLoader;
let cameraControls;
let cameraNavigator;
let interactionHandler;
let dataOverlay;
let statusVisualizer;
let performanceMonitor;
let animationFrameId;

// ============================================
// ⭐ 새로 추가: ConnectionModal 전역 객체
// ============================================
let connectionModal;

let equipmentEditState;
let equipmentEditModal;
let apiClient;

// ============================================
// ⭐ Phase 2: Monitoring Service 전역 객체
// ============================================
let monitoringService;
let signalTowerManager;

// ============================================
// ⭐ Phase 4.5: PreviewGenerator 전역 객체
// ============================================
let previewGenerator;


/**
 * 초기화
 */
function init() {
    console.log('🚀 Sherlock Sky 3DSim 초기화...');
    
    try {
        // 1. Scene Manager 생성 및 초기화
        sceneManager = new SceneManager();
        const initSuccess = sceneManager.init();
        
        if (!initSuccess) {
            throw new Error('SceneManager 초기화 실패');
        }
        
        if (!sceneManager.renderer || !sceneManager.renderer.domElement) {
            console.error('❌ Renderer 또는 domElement가 없습니다!');
            throw new Error('Renderer 초기화 실패');
        }
        
        console.log('✅ SceneManager 초기화 완료');
        
        // 2. 조명 추가
        Lighting.addLights(sceneManager.scene);
        console.log('✅ Lighting 초기화 완료');
        
        // 3. Equipment Loader
        equipmentLoader = new EquipmentLoader(sceneManager.scene);
        
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
        equipmentLoader.loadEquipmentArray(updateLoadingStatus);
        console.log('✅ EquipmentLoader 초기화 완료');
        
        // ============================================
        // ⭐ Phase 4.4: SceneManager-EquipmentLoader 연결
        // ============================================
        if (sceneManager.setEquipmentLoader) {
            sceneManager.setEquipmentLoader(equipmentLoader);
            console.log('✅ SceneManager-EquipmentLoader 연결 완료');
        }
        
        // 4. Camera Controls
        console.log('🎮 CameraControls 생성 중...');
        cameraControls = new CameraControls(
            sceneManager.camera,
            sceneManager.renderer.domElement
        );
        console.log('✅ CameraControls 초기화 완료');

        // ⭐ 4-1. Camera Navigator 추가
        cameraNavigator = new CameraNavigator(
            sceneManager.camera,
            cameraControls.controls,
            new THREE.Vector3(0, 0, 0)  // 클린룸 중심
        );
        console.log('✅ CameraNavigator 초기화 완료');

        
        // 5. DataOverlay 초기화
        dataOverlay = new DataOverlay();
        dataOverlay.exposeGlobalFunctions(); // 전역 함수 등록 (closeEquipmentInfo 등)
        console.log('✅ DataOverlay 초기화 완료');
        
        // 6. StatusVisualizer 초기화
        statusVisualizer = new StatusVisualizer(equipmentLoader.getEquipmentArray());
        statusVisualizer.updateAllStatus(); // 초기 상태 업데이트
        console.log('✅ StatusVisualizer 초기화 완료');
        
        // 7. PerformanceMonitor 초기화
        performanceMonitor = new PerformanceMonitor(sceneManager.renderer);
        console.log('✅ PerformanceMonitor 초기화 완료');
        console.log('💡 성능 모니터링 명령어:');
        console.log('   - startMonitoring() : 실시간 모니터링 시작 (1초마다 콘솔 출력)');
        console.log('   - stopMonitoring() : 모니터링 중지');
        console.log('   - getPerformanceReport() : 상세 분석 리포트 출력');
        
        // 8. Interaction Handler
        interactionHandler = new InteractionHandler(
            sceneManager.camera,
            sceneManager.scene,
            sceneManager.renderer.domElement,
            equipmentLoader.getEquipmentArray(),
            dataOverlay
        );
        console.log('✅ InteractionHandler 초기화 완료');
        
       // ============================================
        // ⭐ 새로 추가: ConnectionModal 초기화
        // ============================================
        connectionModal = new ConnectionModal();
        console.log('✅ ConnectionModal 초기화 완료');
        
        // ============================================
        // ⭐ Phase 3: Equipment Edit 시스템 초기화
        // ============================================
        
        // API Client 초기화
        apiClient = new ApiClient();
        console.log('✅ ApiClient 초기화 완료');
        
        // Equipment Edit State 초기화
        equipmentEditState = new EquipmentEditState();
        console.log('✅ EquipmentEditState 초기화 완료');
        
        // Equipment Edit Modal 초기화
        equipmentEditModal = new EquipmentEditModal(equipmentEditState, apiClient);
        console.log('✅ EquipmentEditModal 초기화 완료');
        
        // ============================================
        // ⭐ Phase 2: Monitoring Service 초기화
        // ============================================
        
        // Signal Tower Manager 초기화
        signalTowerManager = new SignalTowerManager(sceneManager.scene, equipmentLoader);
        
        // ⭐ 기존 equipment1.js의 경광등 램프들을 찾아서 초기화
        const lightCount = signalTowerManager.initializeAllLights();
        console.log(`✅ SignalTowerManager 초기화 완료: ${lightCount}개 설비의 경광등 연결`);
        
        // Monitoring Service 초기화
        monitoringService = new MonitoringService(signalTowerManager);
        console.log('✅ MonitoringService 초기화 완료');
        
        // 전역 객체로 노출 (테스트용)
        window.monitoringService = monitoringService;
        window.signalTowerManager = signalTowerManager;
        
        // ============================================
        // ⭐ Phase 4.2: Layout 적용 이벤트 리스너
        // ============================================
        setupLayoutEventListeners();
        console.log('✅ Layout 이벤트 리스너 설정 완료');
        
        // ============================================
        // ⭐ Phase 4.4: LayoutEditorMain 연결
        // ============================================
        setupLayoutEditorMainConnection();
        console.log('✅ LayoutEditorMain 연결 설정 완료');
        
        // ============================================
        // ⭐ Phase 4.5: PreviewGenerator 초기화
        // ============================================
        initPreviewGenerator();
        console.log('✅ PreviewGenerator 연결 설정 완료');
        
        // ============================================
        // ⭐ Edit Button 이벤트 리스너
        // ============================================
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const isActive = equipmentEditState.toggleEditMode();
                editBtn.classList.toggle('active', isActive);
                
                // Body에 편집 모드 클래스 추가/제거
                document.body.classList.toggle('edit-mode-active', isActive);
                
                console.log(isActive ? '✏️ Equipment Edit Mode: ON' : '✏️ Equipment Edit Mode: OFF');
            });
        }
        
        // ============================================
        // ⭐ Phase 2: Monitoring Button 이벤트 리스너
        // ============================================
        const monitoringBtn = document.getElementById('monitoringBtn');
        if (monitoringBtn) {
            monitoringBtn.addEventListener('click', () => {
                if (monitoringService.isActive) {
                    monitoringService.stop();
                    monitoringBtn.classList.remove('active');
                    console.log('🔴 Monitoring Mode: OFF');
                } else {
                    monitoringService.start();
                    monitoringBtn.classList.add('active');
                    console.log('🟢 Monitoring Mode: ON');
                }
            });
        }
        
        // 전역 토글 함수 (키보드 단축키용)
        window.toggleMonitoringMode = () => {
            if (monitoringBtn) {
                monitoringBtn.click();
            }
        };
        
        // ============================================
        // ⭐ Edit 모드 이벤트 리스너 등록
        // ============================================
        
        // Edit 모드 변경 시 시각 업데이트
        window.addEventListener('edit-mode-changed', (e) => {
            const { enabled } = e.detail;
            debugLog(`✏️ Edit Mode Changed: ${enabled}`);
            
            // 편집 모드에서는 기존 선택 해제
            if (enabled && interactionHandler) {
                interactionHandler.clearAllSelections();
            }
        });
        
        // 매핑 변경 시 시각 업데이트
        window.addEventListener('mapping-changed', (e) => {
            const { frontendId } = e.detail;
            
            if (equipmentLoader) {
                equipmentLoader.highlightMappingStatus(frontendId, true);
            }
            
            debugLog(`✅ 매핑 완료: ${frontendId}`);
        });
        
        // 매핑 삭제 시 시각 업데이트
        window.addEventListener('mapping-removed', (e) => {
            const { frontendId } = e.detail;
            
            if (equipmentLoader) {
                equipmentLoader.highlightMappingStatus(frontendId, false);
            }
            
            debugLog(`🗑️ 매핑 제거: ${frontendId}`);
        });
        
        // 매핑 리셋 시 모든 강조 제거
        window.addEventListener('mappings-reset', () => {
            if (equipmentLoader) {
                equipmentLoader.updateAllMappingStatus({});
            }
            debugLog('🗑️ 모든 매핑 초기화됨');
        });
        
        // 서버에서 매핑 로드 시 시각 업데이트
        window.addEventListener('mappings-loaded', (e) => {
            if (equipmentLoader && equipmentEditState) {
                const mappings = equipmentEditState.getAllMappings();
                equipmentLoader.updateAllMappingStatus(mappings);
            }
            debugLog('📥 서버 매핑 데이터 로드됨');
        });


        // ============================================
        // ⭐ Connection Button 이벤트 리스너 (활성화 상태 토글 추가)
        // ============================================
        const connectionBtn = document.getElementById('connectionBtn');
        if (connectionBtn) {
            connectionBtn.addEventListener('click', () => {
                console.log('🔌 Toggling Connection Modal...');
                
                // 모달이 열릴 때와 닫힐 때 버튼 상태 토글
                const wasOpen = connectionModal.isOpen;
                connectionModal.toggle();
                
                // 상태에 따라 active 클래스 토글
                setTimeout(() => {
                    connectionBtn.classList.toggle('active', !wasOpen);
                }, 50);
            });
        }
        
        // ============================================
        // ⭐ Ctrl+K 단축키 등록 (버튼 상태 동기화 추가)
        // ============================================
        document.addEventListener('keydown', (event) => {
            // Ctrl+K 또는 Cmd+K: Connection Modal 토글
            if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                event.preventDefault();
                
                const wasOpen = connectionModal.isOpen;
                connectionModal.toggle();
                
                // 버튼 상태 업데이트
                const connectionBtn = document.getElementById('connectionBtn');
                if (connectionBtn) {
                    setTimeout(() => {
                        connectionBtn.classList.toggle('active', !wasOpen);
                    }, 50);
                }
            }
        });

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
        
        // ⭐ InteractionHandler에 Edit 모드 연결
        interactionHandler.setEditMode(equipmentEditState);
        interactionHandler.setEditModal(equipmentEditModal);

        console.log('✅ InteractionHandler 초기화 완료');
        
        // 애니메이션 시작
        animate();
        
        // 전역 디버그 함수
        setupGlobalDebugFunctions();
        
        console.log('✅ 모든 초기화 완료!');
        console.log('💡 콘솔에서 debugHelp() 입력으로 사용 가능한 명령어 확인');
        
        // 초기 메모리 정보
        if (CONFIG.DEBUG_MODE) {
            setTimeout(() => {
                memoryManager.logMemoryInfo(sceneManager.renderer);
            }, 1000);
        }
        
        // 로딩 상태 숨김 (3초 후)
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
        
    } catch (error) {
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
}

// ============================================
// ⭐ Phase 4.5: PreviewGenerator 초기화
// ============================================

/**
 * PreviewGenerator 초기화 (지연 로드)
 */
function initPreviewGenerator() {
    // PreviewGenerator가 전역으로 로드되어 있는지 확인
    const connectPreviewGenerator = () => {
        if (window.PreviewGenerator && !previewGenerator) {
            try {
                // Preview용 Canvas 요소 찾기
                const previewCanvas = document.getElementById('preview-canvas');
                
                if (previewCanvas) {
                    previewGenerator = new window.PreviewGenerator({
                        container: previewCanvas,
                        width: previewCanvas.clientWidth || 600,
                        height: previewCanvas.clientHeight || 400
                    });
                    
                    window.previewGenerator = previewGenerator;
                    console.log('[main.js] ✅ PreviewGenerator 초기화 완료');
                } else {
                    console.log('[main.js] Preview canvas not found yet, will try later');
                }
            } catch (error) {
                console.warn('[main.js] PreviewGenerator 초기화 실패:', error);
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

// ============================================
// ⭐ Phase 4.4: LayoutEditorMain 연결 설정
// ============================================

/**
 * LayoutEditorMain과 SceneManager 연결
 */
function setupLayoutEditorMainConnection() {
    // LayoutEditorMain이 로드된 후 연결
    const connectLayoutEditorMain = () => {
        if (window.layoutEditorMain && sceneManager) {
            // SceneManager 연결
            if (typeof window.layoutEditorMain.setSceneManager === 'function') {
                window.layoutEditorMain.setSceneManager(sceneManager);
                console.log('[main.js] LayoutEditorMain-SceneManager 연결 완료');
            }
        }
    };
    
    // 즉시 시도
    connectLayoutEditorMain();
    
    // 지연 시도 (LayoutEditorMain이 늦게 로드될 경우)
    setTimeout(connectLayoutEditorMain, 100);
    setTimeout(connectLayoutEditorMain, 500);
    
    // 이벤트 기반 연결 (LayoutEditorMain이 초기화 완료 이벤트를 발생시킬 경우)
    window.addEventListener('layout-editor-main-ready', () => {
        connectLayoutEditorMain();
    });
}

// ============================================
// ⭐ Phase 4.2: Layout 이벤트 리스너 설정
// ============================================

/**
 * Layout 관련 이벤트 리스너 설정
 */
function setupLayoutEventListeners() {
    // Layout Editor에서 Layout 적용 요청 시
    window.addEventListener('apply-layout-request', (e) => {
        const { layoutData, options } = e.detail || {};
        
        if (!layoutData) {
            console.error('[main.js] apply-layout-request: layoutData가 없습니다');
            return;
        }
        
        console.log('[main.js] Layout 적용 요청 수신...');
        
        try {
            // ✨ Phase 4.4: applyLayoutFull 사용 (있는 경우)
            if (sceneManager && typeof sceneManager.applyLayoutFull === 'function') {
                const success = sceneManager.applyLayoutFull(layoutData, options);
                
                if (success) {
                    console.log('[main.js] ✅ Layout 적용 완료 (applyLayoutFull)');
                    
                    // 적용 완료 이벤트 발생
                    window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                        detail: { 
                            layoutData, 
                            success: true 
                        }
                    }));
                } else {
                    throw new Error('applyLayoutFull 실패');
                }
                return;
            }
            
            // Fallback: 기존 방식
            // 1. Layout2DTo3DConverter로 변환
            const convertedLayout = layout2DTo3DConverter.convert(layoutData);
            
            if (!convertedLayout) {
                throw new Error('Layout 변환 실패');
            }
            
            // 2. RoomParamsAdapter로 params 변환
            const adaptedParams = roomParamsAdapter.adapt(convertedLayout);
            
            // 3. 검증
            const validation = roomParamsAdapter.validate(adaptedParams);
            if (!validation.valid) {
                console.error('[main.js] Layout params 검증 실패:', validation.errors);
                throw new Error(`Layout params 검증 실패: ${validation.errors.join(', ')}`);
            }
            
            if (validation.warnings.length > 0) {
                console.warn('[main.js] Layout params 경고:', validation.warnings);
            }
            
            // 4. SceneManager에 적용
            const success = sceneManager.applyLayoutWithParams(adaptedParams, options);
            
            if (success) {
                console.log('[main.js] ✅ Layout 적용 완료');
                
                // 적용 완료 이벤트 발생
                window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                    detail: { 
                        layoutData, 
                        adaptedParams,
                        success: true 
                    }
                }));
            } else {
                throw new Error('SceneManager.applyLayoutWithParams 실패');
            }
            
        } catch (error) {
            console.error('[main.js] Layout 적용 실패:', error);
            
            // 실패 이벤트 발생
            window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                detail: { 
                    layoutData, 
                    error: error.message,
                    success: false 
                }
            }));
        }
    });
    
    // Layout 적용 완료 이벤트 (SceneManager에서 발생)
    window.addEventListener('layout-applied', (e) => {
        console.log('[main.js] layout-applied 이벤트 수신:', e.detail);
    });
    
    window.addEventListener('layout-params-applied', (e) => {
        console.log('[main.js] layout-params-applied 이벤트 수신:', e.detail);
    });
    
    // ✨ Phase 4.4: 전체 Layout 적용 완료 이벤트
    window.addEventListener('layout-full-applied', (e) => {
        console.log('[main.js] layout-full-applied 이벤트 수신:', e.detail);
        
        // Equipment 재연결 (필요한 경우)
        if (interactionHandler && equipmentLoader) {
            interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
            console.log('[main.js] InteractionHandler 설비 배열 재연결 완료');
        }
        
        // StatusVisualizer 업데이트
        if (statusVisualizer && equipmentLoader) {
            statusVisualizer.setEquipmentArray(equipmentLoader.getEquipmentArray());
            statusVisualizer.updateAllStatus();
            console.log('[main.js] StatusVisualizer 재연결 완료');
        }
        
        // SignalTowerManager 재연결
        if (signalTowerManager) {
            signalTowerManager.initializeAllLights();
            console.log('[main.js] SignalTowerManager 재연결 완료');
        }
    });
    
    // Scene 재구축 완료 이벤트
    window.addEventListener('scene-rebuilt', (e) => {
        console.log('[main.js] scene-rebuilt 이벤트 수신:', e.detail);
        
        // Equipment 재연결
        if (interactionHandler && equipmentLoader) {
            interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
        }
    });
}

/**
 * 애니메이션 루프
 */
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    // 카메라 컨트롤 업데이트
    if (cameraControls) {
        cameraControls.update();
    }
    
    // 상태 시각화 애니메이션 (에러 상태 깜빡임)
    if (statusVisualizer) {
        statusVisualizer.animateErrorStatus();
    }
    
    // ⭐ Phase 2: Signal Tower 애니메이션 (경광등 깜빡임)
    if (signalTowerManager) {
        const deltaTime = 0.016; // 약 60 FPS 기준
        signalTowerManager.animate(deltaTime);
    }
    
    // ⭐ 성능 모니터 업데이트 (프레임마다)
    if (performanceMonitor) {
        performanceMonitor.update();
    }
    
    // 렌더링
    if (sceneManager) {
        sceneManager.render();
    }
}

/**
 * 전역 디버그 함수
 */
function setupGlobalDebugFunctions() {
    // 도움말
    window.debugHelp = () => {
        console.group('🔧 사용 가능한 디버그 명령어');
        console.log('');
        console.log('📊 성능 모니터링:');
        console.log('  startMonitoring() - 실시간 모니터링 시작 (1초마다)');
        console.log('  stopMonitoring() - 모니터링 중지');
        console.log('  getPerformanceReport() - 상세 분석 리포트');
        console.log('');
        console.log('⚡ 기본 정보:');
        console.log('  getPerformanceStats() - 현재 성능 통계');
        console.log('  getMemoryInfo() - 메모리 정보');
        console.log('  getSystemInfo() - 시스템 및 하드웨어 정보');
        console.log('  getNetworkInfo() - 네트워크 상태');
        console.log('');
        console.log('🎨 씬 정보:');
        console.log('  debugScene() - 씬 정보 출력');
        console.log('  debugRenderer() - 렌더러 정보 출력');
        console.log('  debugLights() - 조명 정보 출력');
        console.log('');
        console.log('🏭 설비 관련:');
        console.log('  getEquipmentInfo(id) - 특정 설비 정보 조회');
        console.log('  updateEquipmentStatus(id, status) - 설비 상태 변경');
        console.log('  getSelectedEquipments() - 선택된 설비 목록');
        console.log('');
        console.log('📷 카메라:');
        console.log('  setCameraView(0~7) - 카메라 뷰 변경');
        console.log('  rotateCameraView() - 카메라 90도 회전');
        console.log('  getViewMode() - 현재 View 모드 확인');
        console.log('  setViewMode("top" | "isometric") - View 모드 변경');
        console.log('');
        console.log('✏️ Edit 모드:');
        console.log('  toggleEditMode() - Edit 모드 토글');
        console.log('  getMappingStatus() - 매핑 상태 확인');
        console.log('  clearAllMappings() - 모든 매핑 초기화');
        console.log('  exportMappings() - 매핑 파일 내보내기');
        console.log('');
        console.log('📡 Monitoring:');
        console.log('  toggleMonitoringMode() - Monitoring 모드 토글');
        console.log('  monitoringService.testStatusChange(id, status) - 상태 변경 테스트');
        console.log('  signalTowerManager.debug() - Signal Tower 상태 확인');
        console.log('');
        // ✨ Phase 4.2 추가
        console.log('🏗️ Layout (Phase 4.2):');
        console.log('  applyTestLayout() - 테스트 Layout 적용');
        console.log('  testRoomResize(w, d, h) - Room 크기 변경 테스트');
        console.log('  sceneManager.getRoomEnvironment().debug() - Room 정보');
        console.log('');
        // ✨ Phase 4.4 추가
        console.log('🔗 SceneManager (Phase 4.4):');
        console.log('  sceneManager.debug() - SceneManager 전체 정보');
        console.log('  sceneManager.clearScene() - Scene 정리');
        console.log('  sceneManager.rebuildScene(params) - Scene 재구축');
        console.log('');
        // ✨ Phase 4.5 추가
        console.log('🖼️ Preview (Phase 4.5):');
        console.log('  previewGenerator - PreviewGenerator 인스턴스');
        console.log('  showPreview3D() - 3D Preview 표시 (LayoutEditorMain)');
        console.log('');
        console.groupEnd();
    };
    
    // ⭐ 실시간 모니터링 시작
    window.startMonitoring = () => {
        if (!performanceMonitor) {
            console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
            return;
        }
        performanceMonitor.start();
        console.log('✅ 실시간 성능 모니터링 시작');
        console.log('💡 중지하려면 stopMonitoring() 입력');
    };
    
    // ⭐ 모니터링 중지
    window.stopMonitoring = () => {
        if (!performanceMonitor) {
            console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
            return;
        }
        performanceMonitor.stop();
    };
    
    // ⭐ 성능 리포트 생성
    window.getPerformanceReport = () => {
        if (!performanceMonitor) {
            console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
            return null;
        }
        return performanceMonitor.printReport();
    };
    
    // ⭐ 시스템 정보
    window.getSystemInfo = () => {
        if (!performanceMonitor) {
            console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
            return null;
        }
        
        const info = performanceMonitor.systemInfo;
        console.group('💻 시스템 정보');
        console.log('Platform:', info.platform);
        console.log('User Agent:', info.userAgent);
        console.log('CPU Cores:', info.hardwareConcurrency);
        console.log('Device Memory:', info.deviceMemory, 'GB');
        console.log('Screen:', `${info.screen.width}x${info.screen.height}`);
        console.log('Pixel Ratio:', info.screen.pixelRatio);
        console.log('Color Depth:', info.screen.colorDepth);
        
        if (info.gpu) {
            console.log('GPU Vendor:', info.gpu.vendor);
            console.log('GPU Renderer:', info.gpu.renderer);
        }
        
        if (info.webgl) {
            console.log('WebGL Version:', info.webgl.version);
            console.log('Max Texture Size:', info.webgl.maxTextureSize);
        }
        console.groupEnd();
        
        return info;
    };
    
    // ⭐ 네트워크 정보
    window.getNetworkInfo = () => {
        if (!performanceMonitor) {
            console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
            return null;
        }
        
        const network = performanceMonitor.networkStats;
        console.group('🌐 네트워크 정보');
        console.log('상태:', network.online ? '✅ 온라인' : '❌ 오프라인');
        console.log('타입:', network.effectiveType || 'Unknown');
        console.log('다운링크:', network.downlink ? `${network.downlink} Mbps` : 'N/A');
        console.log('RTT (레이턴시):', network.rtt ? `${network.rtt} ms` : 'N/A');
        console.groupEnd();
        
        return network;
    };
    
    // 성능 통계
    window.getPerformanceStats = () => {
        if (!sceneManager || !sceneManager.getStats) {
            console.error('❌ SceneManager가 초기화되지 않았습니다');
            return null;
        }
        
        const stats = sceneManager.getStats();
        console.group('📊 성능 통계');
        console.log('FPS:', stats.fps);
        console.log('Frame Time:', stats.frameTime.toFixed(2), 'ms');
        console.log('Draw Calls:', stats.drawCalls);
        console.log('Triangles:', stats.triangles.toLocaleString());
        console.log('Geometries:', stats.geometries);
        console.log('Textures:', stats.textures);
        console.groupEnd();
        return stats;
    };
    
    // 메모리 정보
    window.getMemoryInfo = () => {
        if (!sceneManager || !sceneManager.renderer) {
            console.error('❌ Renderer가 초기화되지 않았습니다');
            return;
        }
        memoryManager.logMemoryInfo(sceneManager.renderer);
    };
    
    // 씬 디버그 정보
    window.debugScene = () => {
        if (!sceneManager) {
            console.error('❌ SceneManager가 초기화되지 않았습니다');
            return;
        }
        
        console.group('🎬 Scene 정보');
        console.log('Children:', sceneManager.scene.children.length);
        console.log('Background:', sceneManager.scene.background);
        console.log('Camera Position:', sceneManager.camera.position);
        console.log('Camera Rotation:', sceneManager.camera.rotation);
        console.log('Total Equipment:', equipmentLoader ? equipmentLoader.getEquipmentArray().length : 0);
        console.log('EquipmentLoader Connected:', sceneManager.getEquipmentLoader ? !!sceneManager.getEquipmentLoader() : 'N/A');
        console.groupEnd();
    };
    
    // 렌더러 디버그 정보
    window.debugRenderer = () => {
        if (!sceneManager || !sceneManager.renderer) {
            console.error('❌ Renderer가 초기화되지 않았습니다');
            return;
        }
        
        const info = sceneManager.renderer.info;
        console.group('🎨 Renderer 정보');
        console.log('Renderer:', sceneManager.renderer);
        console.log('Size:', sceneManager.renderer.domElement.width, 'x', sceneManager.renderer.domElement.height);
        console.log('Pixel Ratio:', sceneManager.renderer.getPixelRatio());
        console.log('Memory:', info.memory);
        console.log('Render:', info.render);
        console.groupEnd();
    };
    
    // ⭐ 카메라 네비게이터 제어
    window.setCameraView = (direction) => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 초기화되지 않았습니다');
            return;
        }
        
        if (typeof direction === 'number') {
            cameraNavigator.moveToDirection(direction);
            console.log(`📷 카메라 뷰 변경: ${direction} (${direction * 45}도)`);
        } else {
            console.log('사용법: setCameraView(0~7)');
            console.log('  0: 북(0°), 1: 북동(45°), 2: 동(90°), 3: 남동(135°)');
            console.log('  4: 남(180°), 5: 남서(225°), 6: 서(270°), 7: 북서(315°)');
        }
    };

    window.rotateCameraView = () => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 초기화되지 않았습니다');
            return;
        }
        cameraNavigator.rotateClockwise90();
        console.log('🔄 카메라 90도 회전');
    };

    window.toggleCameraNavigator = (visible) => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 초기화되지 않았습니다');
            return;
        }
        
        if (visible === undefined) {
            const currentVisible = cameraNavigator.navContainer.style.display !== 'none';
            cameraNavigator.setVisible(!currentVisible);
        } else {
            cameraNavigator.setVisible(visible);
        }
    };


    // ⭐ 조명 디버그 정보 (새로 추가)
    window.debugLights = () => {
        if (!sceneManager) {
            console.error('❌ SceneManager가 초기화되지 않았습니다');
            return;
        }
        
        let totalLights = 0;
        let pointLights = 0;
        let directionalLights = 0;
        let ambientLights = 0;
        let hemisphereLights = 0;
        let spotLights = 0;
        
        sceneManager.scene.traverse((obj) => {
            if (obj.isLight) {
                totalLights++;
                
                if (obj.isPointLight) pointLights++;
                else if (obj.isDirectionalLight) directionalLights++;
                else if (obj.isAmbientLight) ambientLights++;
                else if (obj.isHemisphereLight) hemisphereLights++;
                else if (obj.isSpotLight) spotLights++;
            }
        });
        
        console.group('💡 조명 분석');
        console.log('총 조명 개수:', totalLights);
        console.log('  - PointLight:', pointLights, pointLights > 0 ? '⚠️' : '✅');
        console.log('  - DirectionalLight:', directionalLights);
        console.log('  - AmbientLight:', ambientLights);
        console.log('  - HemisphereLight:', hemisphereLights);
        console.log('  - SpotLight:', spotLights);
        console.groupEnd();
        
        // 최적화 상태 판단
        if (pointLights === 0 && totalLights <= 10) {
            console.log('✅ 조명 최적화 적용됨');
        } else if (pointLights > 50) {
            console.log('⚠️ PointLight가 많습니다! 조명 최적화 미적용');
        } else {
            console.log('⚡ 조명 최적화 부분 적용');
        }
        
        return {
            totalLights,
            pointLights,
            directionalLights,
            ambientLights,
            hemisphereLights,
            spotLights
        };
    };
    
    // 특정 설비 정보 조회
    window.getEquipmentInfo = (equipmentId) => {
        if (!equipmentLoader) {
            console.error('❌ EquipmentLoader가 초기화되지 않았습니다');
            return null;
        }
        
        const equipment = equipmentLoader.getEquipment(equipmentId);
        if (equipment) {
            console.group(`📦 설비 정보: ${equipmentId}`);
            console.log('Position:', equipment.position);
            console.log('Rotation:', equipment.rotation);
            console.log('UserData:', equipment.userData);
            console.groupEnd();
            return equipment.userData;
        } else {
            console.error(`❌ 설비를 찾을 수 없습니다: ${equipmentId}`);
            return null;
        }
    };
    
    // 설비 상태 변경
    window.updateEquipmentStatus = (equipmentId, status) => {
        if (!equipmentLoader) {
            console.error('❌ EquipmentLoader가 초기화되지 않았습니다');
            return;
        }
        
        if (!['running', 'idle', 'error'].includes(status)) {
            console.error('❌ 유효하지 않은 상태입니다. (running, idle, error 중 하나)');
            return;
        }
        
        equipmentLoader.updateEquipmentStatus(equipmentId, status);
        
        // StatusVisualizer 업데이트
        if (statusVisualizer) {
            const equipment = equipmentLoader.getEquipment(equipmentId);
            if (equipment) {
                statusVisualizer.updateEquipmentStatus(equipment);
                console.log(`✅ 설비 상태 업데이트: ${equipmentId} -> ${status}`);
            }
        }
    };
    
    // 선택된 설비 목록
    window.getSelectedEquipments = () => {
        if (!interactionHandler) {
            console.error('❌ InteractionHandler가 초기화되지 않았습니다');
            return [];
        }
        
        const selected = interactionHandler.getSelectedEquipments();
        console.group(`📋 선택된 설비: ${selected.length}개`);
        selected.forEach(eq => {
            console.log(`  - ${eq.userData.id}: ${eq.userData.status}`);
        });
        console.groupEnd();
        
        return selected.map(eq => eq.userData);
    };

    // ⭐ View 모드 확인
    window.getViewMode = () => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 초기화되지 않았습니다');
            return;
        }
        
        const mode = cameraNavigator.getViewMode();
        console.log(`🎯 현재 View 모드: ${mode.toUpperCase()}`);
        console.log('   - TOP: 수직 위에서 내려다보기');
        console.log('   - ISO: 경사진 각도에서 보기');
        return mode;
    };

    // ⭐ View 모드 설정
    window.setViewMode = (mode) => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 초기화되지 않았습니다');
            return;
        }
        
        if (mode !== 'top' && mode !== 'isometric') {
            console.error('❌ 사용법: setViewMode("top") 또는 setViewMode("isometric")');
            return;
        }
        
        cameraNavigator.setViewMode(mode);
    };

    // ⭐ Top View 높이 조정
    window.setTopViewHeight = (height) => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 초기화되지 않았습니다');
            return;
        }
        
        cameraNavigator.setTopViewHeight(height);
        console.log(`📐 Top View 높이 설정: ${height}m`);
    };
    
    // Top View 오프셋 조정
    window.setTopViewOffset = (offset) => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 초기화되지 않았습니다');
            return;
        }
        
        cameraNavigator.topViewOffset = offset;
        console.log(`🔧 Top View 오프셋: ${offset}`);
        console.log('💡 값이 클수록 방향성이 명확해지고, 작을수록 수직에 가까워집니다');
    };

        // ⭐ Equipment Edit 관련 전역 함수
    window.toggleEditMode = () => {
        if (!equipmentEditState) {
            console.error('❌ EquipmentEditState가 초기화되지 않았습니다');
            return;
        }
        
        const isActive = equipmentEditState.toggleEditMode();
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
            editBtn.classList.toggle('active', isActive);
        }
        document.body.classList.toggle('edit-mode-active', isActive);
        
        console.log(isActive ? '✏️ Edit Mode: ON' : '✏️ Edit Mode: OFF');
        return isActive;
    };
    
    window.getMappingStatus = () => {
        if (!equipmentEditState || !equipmentLoader) {
            console.error('❌ EquipmentEditState 또는 EquipmentLoader가 초기화되지 않았습니다');
            return;
        }
        
        const mappings = equipmentEditState.getAllMappings();
        const rate = equipmentLoader.getMappingCompletionRate(mappings);
        
        console.group('📊 Equipment Mapping Status');
        console.log(`완료율: ${rate}%`);
        console.log(`매핑 완료: ${Object.keys(mappings).length}개`);
        console.log(`전체 설비: ${equipmentLoader.getEquipmentArray().length}개`);
        console.table(Object.values(mappings).slice(0, 10)); // 처음 10개만 표시
        console.groupEnd();
        
        return { rate, mappings };
    };
    
    window.clearAllMappings = () => {
        if (!equipmentEditState) {
            console.error('❌ EquipmentEditState가 초기화되지 않았습니다');
            return;
        }
        
        equipmentEditState.reset();
    };
    
    window.exportMappings = () => {
        if (!equipmentEditState) {
            console.error('❌ EquipmentEditState가 초기화되지 않았습니다');
            return;
        }
        
        equipmentEditState.exportToFile();
        console.log('📁 매핑 데이터가 파일로 내보내졌습니다');
    };

    // ============================================
    // ⭐ Phase 4.2: Layout 테스트 함수
    // ============================================
    
    /**
     * 테스트용 Layout 적용
     */
    window.applyTestLayout = () => {
        console.log('[Test] 테스트 Layout 적용 시작...');
        
        // 테스트용 Layout 데이터
        const testLayoutData = {
            version: '1.0',
            site_id: 'test_site',
            template_name: 'test_layout',
            canvas: {
                width: 1200,
                height: 800,
                scale: 10
            },
            room: {
                width: 50,   // 기본 40 → 50으로 변경
                depth: 70,   // 기본 60 → 70으로 변경
                wallHeight: 5,  // 기본 4 → 5으로 변경
                wallThickness: 0.25
            },
            office: {
                x: 350,  // Canvas 좌표
                y: 100,
                width: 150,  // Canvas 크기
                height: 250,
                hasEntrance: true,
                entranceWidth: 40
            },
            equipmentArrays: [{
                rows: 26,
                cols: 6
            }]
        };
        
        // 이벤트 발생
        window.dispatchEvent(new CustomEvent('apply-layout-request', {
            detail: { 
                layoutData: testLayoutData,
                options: {
                    updateFloor: true,
                    rebuildRoom: true
                }
            }
        }));
        
        console.log('[Test] 테스트 Layout 이벤트 발생 완료');
    };
    
    /**
     * Room 치수 직접 변경 테스트
     */
    window.testRoomResize = (width, depth, height) => {
        if (!sceneManager || !sceneManager.getRoomEnvironment) {
            console.error('❌ SceneManager 또는 RoomEnvironment가 초기화되지 않았습니다');
            return;
        }
        
        const params = {
            roomWidth: width || 50,
            roomDepth: depth || 70,
            wallHeight: height || 5,
            wallThickness: 0.2,
            hasOffice: true,
            officeWidth: 15,
            officeDepth: 25,
            officeX: 18,
            officeZ: -25
        };
        
        console.log('[Test] Room 크기 변경 테스트:', params);
        sceneManager.applyLayoutWithParams(params);
    };

    console.log('✅ 전역 디버그 함수 등록 완료');
}

/**
 * 정리
 */
function cleanup() {
    console.log('🗑️ 정리 시작...');
    
    // 애니메이션 중지
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        console.log('  - 애니메이션 루프 중지');
    }
    
    // 성능 모니터 정리
    if (performanceMonitor) {
        performanceMonitor.dispose();
        console.log('  - PerformanceMonitor 정리');
    }
    
    // ✨ Phase 4.5: PreviewGenerator 정리
    if (previewGenerator && previewGenerator.dispose) {
        previewGenerator.dispose();
        console.log('  - PreviewGenerator 정리');
    }
    
    // 씬 정리
    if (sceneManager) {
        memoryManager.disposeScene(sceneManager.scene);
        sceneManager.dispose();
        console.log('  - SceneManager 정리');
    }
    
    // 설비 정리
    if (equipmentLoader) {
        equipmentLoader.dispose();
        console.log('  - EquipmentLoader 정리');
    }
    
    // 컨트롤 정리
    if (cameraControls) {
        cameraControls.dispose();
        console.log('  - CameraControls 정리');
    }
    
    // InteractionHandler 정리
    if (interactionHandler) {
        interactionHandler.dispose();
        console.log('  - InteractionHandler 정리');
    }
    
    // CameraNavigator 정리
    if (cameraNavigator) {
        cameraNavigator.dispose();
        console.log('  - CameraNavigator 정리');
    }

        // Equipment Edit 정리
    if (equipmentEditState) {
        equipmentEditState.destroy();
        console.log('  - EquipmentEditState 정리');
    }

    console.log('✅ 정리 완료');
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', cleanup);

// 초기화 실행
init();

// ============================================
// ⭐ 전역 객체 노출 (ConnectionModal 추가)
// ============================================
window.sceneManager = sceneManager;
window.equipmentLoader = equipmentLoader;
window.cameraControls = cameraControls;
window.cameraNavigator = cameraNavigator;
window.interactionHandler = interactionHandler;
window.dataOverlay = dataOverlay;
window.statusVisualizer = statusVisualizer;
window.performanceMonitor = performanceMonitor;
window.connectionModal = connectionModal;  // ⭐ 새로 추가
window.equipmentEditState = equipmentEditState;
window.equipmentEditModal = equipmentEditModal;
window.apiClient = apiClient;

// ============================================
// ⭐ Phase 4.2: Layout 관련 전역 객체 노출
// ============================================
window.layout2DTo3DConverter = layout2DTo3DConverter;
window.roomParamsAdapter = roomParamsAdapter;

// ============================================
// ⭐ Phase 4.5: Preview 관련 전역 객체 노출
// ============================================
window.previewGenerator = previewGenerator;


console.log('🌐 전역 객체 노출 완료 (window.connectionModal, layout2DTo3DConverter, roomParamsAdapter, previewGenerator 추가)');