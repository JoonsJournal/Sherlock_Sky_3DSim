/**
 * main.js
 * 메인 애플리케이션 진입점
 * SceneManager, EquipmentLoader, CameraControls, InteractionHandler, DataOverlay, StatusVisualizer, PerformanceMonitor 통합
 * ⭐ Phase 2 추가: ConnectionModal 통합
*/

// ⭐⭐⭐ 1. THREE import (가장 먼저!)
import * as THREE from 'three';

import { SceneManager } from './scene/SceneManager.js';
import { EquipmentLoader } from './scene/EquipmentLoader.js';
import { Lighting } from './scene/Lighting.js';
import { CameraControls } from './controls/CameraControls.js';
import { CameraNavigator } from './controls/CameraNavigator.js';
import { InteractionHandler } from './controls/InteractionHandler.js';
import { DataOverlay } from './visualization/DataOverlay.js';
import { StatusVisualizer } from './visualization/StatusVisualizer.js';
import { memoryManager } from './utils/MemoryManager.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
import { CONFIG, debugLog } from './utils/Config.js';

// ============================================
// ⭐ 새로 추가: ConnectionModal import
// ============================================
import { ConnectionModal } from './ui/ConnectionModal.js';

import { EquipmentEditState } from './services/EquipmentEditState.js';
import { EquipmentEditModal } from './ui/EquipmentEditModal.js';
import { ApiClient } from './api/ApiClient.js';

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
        // ⭐ 새로 추가: Connection Button 이벤트 리스너
        // ============================================
        const connectionBtn = document.getElementById('connectionBtn');
        if (connectionBtn) {
            connectionBtn.addEventListener('click', () => {
                console.log('🔌 Opening Connection Modal...');
                connectionModal.open();
            });
        }
        
        // ============================================
        // ⭐ 새로 추가: Ctrl+K 단축키 등록
        // ============================================
        document.addEventListener('keydown', (event) => {
            // Ctrl+K 또는 Cmd+K: Connection Modal 토글
            if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                event.preventDefault();
                connectionModal.toggle();
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


console.log('🌐 전역 객체 노출 완료 (window.connectionModal 추가)');