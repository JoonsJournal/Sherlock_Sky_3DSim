/**
 * DebugTools.js
 * 전역 디버그 함수
 * Phase 1.2: main.js에서 분리
 */

import { memoryManager } from './MemoryManager.js';

/**
 * DebugTools 클래스
 * 전역 디버그 함수들을 관리
 */
export class DebugTools {
    constructor(instances) {
        this.instances = instances;
    }
    
    /**
     * 모든 전역 디버그 함수 설정
     */
    setupAll() {
        this.setupHelpFunction();
        this.setupMonitoringFunctions();
        this.setupInfoFunctions();
        this.setupSceneFunctions();
        this.setupCameraFunctions();
        this.setupEquipmentFunctions();
        this.setupEditModeFunctions();
        this.setupLayoutTestFunctions();
        
        console.log('✅ 전역 디버그 함수 등록 완료');
    }
    
    /**
     * 도움말 함수 설정
     */
    setupHelpFunction() {
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
            console.log('🏗️ Layout:');
            console.log('  applyTestLayout() - 테스트 Layout 적용');
            console.log('  testRoomResize(w, d, h) - Room 크기 변경 테스트');
            console.log('  sceneManager.getRoomEnvironment().debug() - Room 정보');
            console.log('');
            console.log('🔗 SceneManager:');
            console.log('  sceneManager.debug() - SceneManager 전체 정보');
            console.log('  sceneManager.clearScene() - Scene 정리');
            console.log('  sceneManager.rebuildScene(params) - Scene 재구축');
            console.log('');
            console.log('🖼️ Preview:');
            console.log('  previewGenerator - PreviewGenerator 인스턴스');
            console.log('  showPreview3D() - 3D Preview 표시 (LayoutEditorMain)');
            console.log('');
            console.groupEnd();
        };
    }
    
    /**
     * 모니터링 함수 설정
     */
    setupMonitoringFunctions() {
        const { performanceMonitor } = this.instances;
        
        // 실시간 모니터링 시작
        window.startMonitoring = () => {
            if (!performanceMonitor) {
                console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
                return;
            }
            performanceMonitor.start();
            console.log('✅ 실시간 성능 모니터링 시작');
            console.log('💡 중지하려면 stopMonitoring() 입력');
        };
        
        // 모니터링 중지
        window.stopMonitoring = () => {
            if (!performanceMonitor) {
                console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
                return;
            }
            performanceMonitor.stop();
        };
        
        // 성능 리포트 생성
        window.getPerformanceReport = () => {
            if (!performanceMonitor) {
                console.error('❌ PerformanceMonitor가 초기화되지 않았습니다');
                return null;
            }
            return performanceMonitor.printReport();
        };
    }
    
    /**
     * 정보 함수 설정
     */
    setupInfoFunctions() {
        const { performanceMonitor, sceneManager } = this.instances;
        
        // 시스템 정보
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
        
        // 네트워크 정보
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
    }
    
    /**
     * 씬 관련 함수 설정
     */
    setupSceneFunctions() {
        const { sceneManager, equipmentLoader } = this.instances;
        
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
        
        // 조명 디버그 정보
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
            
            if (pointLights === 0 && totalLights <= 10) {
                console.log('✅ 조명 최적화 적용됨');
            } else if (pointLights > 50) {
                console.log('⚠️ PointLight가 많습니다! 조명 최적화 미적용');
            } else {
                console.log('⚡ 조명 최적화 부분 적용');
            }
            
            return { totalLights, pointLights, directionalLights, ambientLights, hemisphereLights, spotLights };
        };
    }
    
    /**
     * 카메라 관련 함수 설정
     */
    setupCameraFunctions() {
        const { cameraNavigator } = this.instances;
        
        // 카메라 뷰 설정
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

        // 카메라 90도 회전
        window.rotateCameraView = () => {
            if (!cameraNavigator) {
                console.error('❌ CameraNavigator가 초기화되지 않았습니다');
                return;
            }
            cameraNavigator.rotateClockwise90();
            console.log('🔄 카메라 90도 회전');
        };

        // 카메라 네비게이터 토글
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

        // View 모드 확인
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

        // View 모드 설정
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

        // Top View 높이 조정
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
    }
    
    /**
     * 설비 관련 함수 설정
     */
    setupEquipmentFunctions() {
        const { equipmentLoader, interactionHandler, statusVisualizer } = this.instances;
        
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
    }
    
    /**
     * Edit 모드 관련 함수 설정
     */
    setupEditModeFunctions() {
        const { equipmentEditState, equipmentLoader } = this.instances;
        
        // Edit 모드 토글
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
        
        // 매핑 상태 확인
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
            console.table(Object.values(mappings).slice(0, 10));
            console.groupEnd();
            
            return { rate, mappings };
        };
        
        // 모든 매핑 초기화
        window.clearAllMappings = () => {
            if (!equipmentEditState) {
                console.error('❌ EquipmentEditState가 초기화되지 않았습니다');
                return;
            }
            
            equipmentEditState.reset();
        };
        
        // 매핑 내보내기
        window.exportMappings = () => {
            if (!equipmentEditState) {
                console.error('❌ EquipmentEditState가 초기화되지 않았습니다');
                return;
            }
            
            equipmentEditState.exportToFile();
            console.log('📁 매핑 데이터가 파일로 내보내졌습니다');
        };
    }
    
    /**
     * Layout 테스트 함수 설정
     */
    setupLayoutTestFunctions() {
        const { sceneManager } = this.instances;
        
        // 테스트용 Layout 적용
        window.applyTestLayout = () => {
            console.log('[Test] 테스트 Layout 적용 시작...');
            
            const testLayoutData = {
                version: '1.0',
                site_id: 'test_site',
                template_name: 'test_layout',
                canvas: { width: 1200, height: 800, scale: 10 },
                room: { width: 50, depth: 70, wallHeight: 5, wallThickness: 0.25 },
                office: {
                    x: 350, y: 100,
                    width: 150, height: 250,
                    hasEntrance: true, entranceWidth: 40
                },
                equipmentArrays: [{ rows: 26, cols: 6 }]
            };
            
            window.dispatchEvent(new CustomEvent('apply-layout-request', {
                detail: { 
                    layoutData: testLayoutData,
                    options: { updateFloor: true, rebuildRoom: true }
                }
            }));
            
            console.log('[Test] 테스트 Layout 이벤트 발생 완료');
        };
        
        // Room 치수 직접 변경 테스트
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
    }
}

// Factory 함수
export function createDebugTools(instances) {
    const debugTools = new DebugTools(instances);
    debugTools.setupAll();
    return debugTools;
}