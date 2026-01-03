/**
 * GlobalDebugFunctions.js
 * =======================
 * 
 * 전역 디버그 함수 모음
 * 콘솔에서 사용할 수 있는 디버그/테스트 함수들
 * 
 * @version 1.0.0
 * @module GlobalDebugFunctions
 * 
 * 위치: frontend/threejs_viewer/src/core/utils/GlobalDebugFunctions.js
 */

import * as THREE from 'three';

/**
 * 전역 디버그 함수 설정
 * @param {Object} services - 서비스 객체들
 */
export function setupGlobalDebugFunctions(services) {
    const {
        sceneManager,
        equipmentLoader,
        cameraNavigator,
        equipmentEditState,
        toggleEditMode,
        toggleMonitoringMode
    } = services;
    
    // ============================================
    // 도움말
    // ============================================
    window.debugHelp = () => {
        console.group('📖 Debug Commands');
        console.log('=== 기본 명령어 ===');
        console.log('  debugHelp()           - 이 도움말 표시');
        console.log('  debugScene()          - 씬 정보 출력');
        console.log('  listEquipments()      - 설비 목록');
        console.log('');
        console.log('=== 카메라 명령어 ===');
        console.log('  moveCameraTo(x,y,z)   - 카메라 이동');
        console.log('  focusEquipment(r,c)   - 설비 포커스');
        console.log('  resetCamera()         - 카메라 리셋');
        console.log('');
        console.log('=== 모드 제어 ===');
        console.log('  toggleEditMode()      - 편집 모드 토글');
        console.log('  toggleMonitoringMode()- 모니터링 모드 토글');
        console.log('');
        console.log('=== Phase 1.6 추가 ===');
        console.log('  debug.status()        - 전체 상태 출력');
        console.log('  debug.mode(mode)      - 모드 변경');
        console.log('  debug.events()        - 이벤트 히스토리');
        console.log('  debug.help()          - 디버그 명령어 목록');
        console.log('');
        console.log('=== 키보드 단축키 ===');
        console.log('  D: 디버그 패널');
        console.log('  P: 성능 모니터');
        console.log('  H: 헬퍼 토글');
        console.log('  G: 그리드 토글');
        console.log('  M: 모니터링 모드');
        console.log('  E: 편집 모드');
        console.log('  Ctrl+K: 연결 모달');
        console.groupEnd();
    };

    // ============================================
    // 씬 정보
    // ============================================
    window.debugScene = () => {
        if (!sceneManager) {
            console.error('❌ SceneManager가 없습니다');
            return;
        }
        
        console.group('🎬 Scene Info');
        console.log('Children:', sceneManager.scene.children.length);
        console.log('Camera Position:', sceneManager.camera.position);
        console.log('Renderer Size:', {
            width: sceneManager.renderer.domElement.width,
            height: sceneManager.renderer.domElement.height
        });
        
        if (sceneManager.renderer.info) {
            console.log('Render Info:', {
                calls: sceneManager.renderer.info.render.calls,
                triangles: sceneManager.renderer.info.render.triangles,
                geometries: sceneManager.renderer.info.memory.geometries,
                textures: sceneManager.renderer.info.memory.textures
            });
        }
        console.groupEnd();
    };

    // ============================================
    // 설비 목록
    // ============================================
    window.listEquipments = () => {
        if (!equipmentLoader) {
            console.error('❌ EquipmentLoader가 없습니다');
            return;
        }
        
        const equipments = equipmentLoader.getEquipmentArray();
        console.log(`📦 설비 목록 (총 ${equipments.length}개):`);
        console.table(equipments.slice(0, 10).map(eq => ({
            id: eq.userData.id,
            row: eq.userData.position.row,
            col: eq.userData.position.col
        })));
        
        if (equipments.length > 10) {
            console.log(`... 외 ${equipments.length - 10}개`);
        }
    };

    // ============================================
    // 카메라 명령어
    // ============================================
    window.moveCameraTo = (x, y, z) => {
        if (cameraNavigator) {
            cameraNavigator.moveTo(new THREE.Vector3(x, y, z));
            console.log(`📷 카메라 이동: (${x}, ${y}, ${z})`);
        }
    };

    window.focusEquipment = (row, col) => {
        if (cameraNavigator && equipmentLoader) {
            const equipment = equipmentLoader.getEquipmentByPosition(row, col);
            if (equipment) {
                cameraNavigator.focusOn(equipment);
                console.log(`🎯 설비 포커스: row=${row}, col=${col}`);
            } else {
                console.warn(`⚠️ 설비를 찾을 수 없음: row=${row}, col=${col}`);
            }
        }
    };

    window.resetCamera = () => {
        if (cameraNavigator) {
            cameraNavigator.reset();
            console.log('📷 카메라 리셋');
        }
    };

    // ============================================
    // 모드 제어
    // ============================================
    window.toggleEditMode = toggleEditMode;
    window.toggleMonitoringMode = toggleMonitoringMode;

    // ============================================
    // 매핑 관련
    // ============================================
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

    window.clearAllMappings = () => {
        if (equipmentEditState) {
            equipmentEditState.reset();
        }
    };

    window.exportMappings = () => {
        if (equipmentEditState) {
            equipmentEditState.exportToFile();
            console.log('📁 매핑 데이터가 파일로 내보내졌습니다');
        }
    };

    // ============================================
    // Layout 테스트
    // ============================================
    window.applyTestLayout = () => {
        console.log('[Test] 테스트 Layout 적용 시작...');
        
        const testLayoutData = {
            version: '1.0',
            site_id: 'test_site',
            template_name: 'test_layout',
            canvas: { width: 1200, height: 800, scale: 10 },
            room: { width: 50, depth: 70, wallHeight: 5, wallThickness: 0.25 },
            office: { x: 350, y: 100, width: 150, height: 250, hasEntrance: true, entranceWidth: 40 },
            equipmentArrays: [{ rows: 26, cols: 6 }]
        };
        
        window.dispatchEvent(new CustomEvent('apply-layout-request', {
            detail: { layoutData: testLayoutData, options: { updateFloor: true, rebuildRoom: true } }
        }));
        
        console.log('[Test] 테스트 Layout 이벤트 발생 완료');
    };

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
 * 전역 객체 노출
 * @param {Object} objects - 노출할 객체들
 */
export function exposeGlobalObjects(objects) {
    Object.entries(objects).forEach(([key, value]) => {
        window[key] = value;
    });
    
    console.log('🌐 전역 객체 노출 완료');
    console.log('  - Core: appModeManager, keyboardManager, debugManager, eventBus, logger');
    console.log('  - UI: connectionModal, equipmentEditModal, toast');
    console.log('  - Layout: layout2DTo3DConverter, roomParamsAdapter, previewGenerator');
}