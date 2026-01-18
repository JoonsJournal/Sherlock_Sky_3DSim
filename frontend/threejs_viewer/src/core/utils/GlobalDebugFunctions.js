/**
 * GlobalDebugFunctions.js
 * =======================
 * 
 * 전역 디버그 함수 모음 (v2.0.0 리팩토링)
 * APP.fn 및 APP.debugFn 네임스페이스로 조직화
 * 
 * @version 2.0.0
 * @module GlobalDebugFunctions
 * 
 * @changelog
 * - v2.0.0: Phase 2 APP 네임스페이스 마이그레이션 (2026-01-18)
 *           - registerFn, registerDebugFn 사용
 *           - APP.fn.camera, APP.fn.mapping, APP.fn.layout 등록
 *           - APP.debugFn.help, scene, listEquipments 등록
 *           - 하위 호환 window.* 별칭 유지
 * - v1.0.0: 초기 구현
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/utils/GlobalDebugFunctions.js
 * 작성일: 2026-01-xx
 * 수정일: 2026-01-18
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
    
    // ═══════════════════════════════════════════════════════════════════
    // 🆕 v2.0.0: AppNamespace에서 registerFn, registerDebugFn 가져오기
    // ═══════════════════════════════════════════════════════════════════
    const registerFn = window.APP?.registerFn || ((category, name, fn, alias) => {
        // 폴백: window에 직접 등록
        if (alias && typeof window !== 'undefined') {
            window[alias] = fn;
        }
        return true;
    });
    
    const registerDebugFn = window.APP?.registerDebugFn || ((name, fn, alias) => {
        // 폴백: window에 직접 등록
        if (alias && typeof window !== 'undefined') {
            window[alias] = fn;
        }
        return true;
    });
    
    // ════════════════════════════════════════════════════════════════
    // 디버그 함수 정의
    // ════════════════════════════════════════════════════════════════
    
    const debugHelp = () => {
        console.group('📖 Debug Commands (v2.0.0 - Phase 2)');
        
        console.log('=== APP 네임스페이스 (권장) ===');
        console.log('  APP.debug()                - 전체 네임스페이스 상태');
        console.log('  APP.debugFn.help()         - 이 도움말');
        console.log('  APP.debugFn.scene()        - 씬 정보');
        console.log('  APP.debugFn.listEquipments() - 설비 목록');
        console.log('');
        
        console.log('=== APP.fn 함수 (권장) ===');
        console.log('  APP.fn.ui.showToast(msg, type)');
        console.log('  APP.fn.ui.toggleTheme()');
        console.log('  APP.fn.ui.toggleConnectionModal()');
        console.log('  APP.fn.mode.toggleEditMode()');
        console.log('  APP.fn.mode.toggleMonitoringMode()');
        console.log('  APP.fn.camera.moveTo(x, y, z)');
        console.log('  APP.fn.camera.focusEquipment(row, col)');
        console.log('  APP.fn.camera.reset()');
        console.log('  APP.fn.mapping.getStatus()');
        console.log('  APP.fn.mapping.clearAll()');
        console.log('  APP.fn.mapping.export()');
        console.log('  APP.fn.layout.applyTest()');
        console.log('  APP.fn.layout.testRoomResize(w, d, h)');
        console.log('');
        
        console.log('=== 하위 호환 (window.*) ===');
        console.log('  debugHelp(), debugScene(), listEquipments()');
        console.log('  moveCameraTo(), focusEquipment(), resetCamera()');
        console.log('  toggleEditMode(), toggleMonitoringMode()');
        console.log('  getMappingStatus(), clearAllMappings(), exportMappings()');
        console.log('  applyTestLayout(), testRoomResize()');
        console.log('  showToast(), toggleTheme()');
        console.log('');
        
        console.log('=== 키보드 단축키 ===');
        console.log('  D: 디버그 패널 | P: 성능 모니터');
        console.log('  H: 헬퍼 토글 | G: 그리드 토글');
        console.log('  M: 모니터링 | E: 편집 모드');
        console.log('  Ctrl+K: 연결 모달');
        console.log('');
        
        console.log('=== 상태 확인 ===');
        console.log('  APP.state              - 앱 상태');
        console.log('  APP.state.isConnected  - 연결 상태');
        console.log('  APP.state.currentMode  - 현재 모드');
        
        console.groupEnd();
    };
    
    const debugScene = () => {
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
    
    const listEquipments = () => {
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
    
    // ════════════════════════════════════════════════════════════════
    // 카메라 함수 정의
    // ════════════════════════════════════════════════════════════════
    
    const moveCameraTo = (x, y, z) => {
        if (cameraNavigator) {
            cameraNavigator.moveTo(new THREE.Vector3(x, y, z));
            console.log(`📷 카메라 이동: (${x}, ${y}, ${z})`);
        } else {
            console.error('❌ CameraNavigator가 없습니다');
        }
    };
    
    const focusEquipment = (row, col) => {
        if (cameraNavigator && equipmentLoader) {
            const equipment = equipmentLoader.getEquipmentByPosition(row, col);
            if (equipment) {
                cameraNavigator.focusOn(equipment);
                console.log(`🎯 설비 포커스: row=${row}, col=${col}`);
            } else {
                console.warn(`⚠️ 설비를 찾을 수 없음: row=${row}, col=${col}`);
            }
        } else {
            console.error('❌ CameraNavigator 또는 EquipmentLoader가 없습니다');
        }
    };
    
    const resetCamera = () => {
        if (cameraNavigator) {
            cameraNavigator.reset();
            console.log('📷 카메라 리셋');
        } else {
            console.error('❌ CameraNavigator가 없습니다');
        }
    };
    
    // ════════════════════════════════════════════════════════════════
    // 매핑 함수 정의
    // ════════════════════════════════════════════════════════════════
    
    const getMappingStatus = () => {
        if (!equipmentEditState || !equipmentLoader) {
            console.error('❌ EquipmentEditState 또는 EquipmentLoader가 초기화되지 않았습니다');
            return null;
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
    
    const clearAllMappings = () => {
        if (equipmentEditState) {
            equipmentEditState.reset();
            console.log('🗑️ 모든 매핑 삭제됨');
        } else {
            console.error('❌ EquipmentEditState가 없습니다');
        }
    };
    
    const exportMappings = () => {
        if (equipmentEditState) {
            equipmentEditState.exportToFile();
            console.log('📁 매핑 데이터가 파일로 내보내졌습니다');
        } else {
            console.error('❌ EquipmentEditState가 없습니다');
        }
    };
    
    // ════════════════════════════════════════════════════════════════
    // 레이아웃 함수 정의
    // ════════════════════════════════════════════════════════════════
    
    const applyTestLayout = () => {
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
    
    const testRoomResize = (width, depth, height) => {
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
    
    // ════════════════════════════════════════════════════════════════
    // 🆕 v2.0.0: APP 네임스페이스에 등록
    // ════════════════════════════════════════════════════════════════
    
    // --- 디버그 함수 등록 ---
    registerDebugFn('help', debugHelp, 'debugHelp');
    registerDebugFn('scene', debugScene, 'debugScene');
    registerDebugFn('listEquipments', listEquipments, 'listEquipments');
    
    // --- 카메라 함수 등록 ---
    registerFn('camera', 'moveTo', moveCameraTo, 'moveCameraTo');
    registerFn('camera', 'focusEquipment', focusEquipment, 'focusEquipment');
    registerFn('camera', 'reset', resetCamera, 'resetCamera');
    
    // --- 모드 함수 등록 (main.js에서 이미 등록했으면 건너뜀) ---
    if (!window.APP?.fn?.mode?.toggleEditMode) {
        registerFn('mode', 'toggleEditMode', toggleEditMode, 'toggleEditMode');
        registerFn('mode', 'toggleMonitoringMode', toggleMonitoringMode, 'toggleMonitoringMode');
    }
    
    // --- 매핑 함수 등록 ---
    registerFn('mapping', 'getStatus', getMappingStatus, 'getMappingStatus');
    registerFn('mapping', 'clearAll', clearAllMappings, 'clearAllMappings');
    registerFn('mapping', 'export', exportMappings, 'exportMappings');
    
    // --- 레이아웃 함수 등록 ---
    registerFn('layout', 'applyTest', applyTestLayout, 'applyTestLayout');
    registerFn('layout', 'testRoomResize', testRoomResize, 'testRoomResize');
    
    console.log('✅ 전역 디버그 함수 등록 완료 (v2.0.0 - APP 네임스페이스)');
}

/**
 * 전역 객체 노출 (기존 유지)
 * @param {Object} objects - 노출할 객체들
 */
export function exposeGlobalObjects(objects) {
    Object.entries(objects).forEach(([key, value]) => {
        window[key] = value;
    });
    
    console.log('🌐 전역 객체 노출 완료');
    console.log('  💡 Tip: APP.debug()로 전체 네임스페이스 확인');
    console.log('  💡 Tip: APP.debugFn.help()로 명령어 도움말');
}
