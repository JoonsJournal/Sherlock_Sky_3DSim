/**
 * GlobalDebugFunctions.js
 * =======================
 * 
 * 전역 디버그 함수 모음 (v2.3.0)
 * APP.fn 및 APP.debugFn 네임스페이스로 조직화
 * 
 * @version 2.3.0
 * @module GlobalDebugFunctions
 * 
 * @changelog
 * - v2.3.0: 🆕 Phase 4 - migrateGlobalToNamespace() 사용 (2026-01-18)
 *           - exposeGlobalObjects() 리팩토링
 *           - LEGACY_TO_NEW_PATH 확장
 *           - APP.getMigrationStatus() 연동
 * - v2.2.0: Phase 3 - Deprecation 경고 시스템 (2026-01-18)
 * - v2.1.1: CameraNavigator API 수정 (2026-01-18)
 * - v2.1.0: Placeholder 교체 패턴 적용 (2026-01-18)
 * - v2.0.0: Phase 2 APP 네임스페이스 마이그레이션 (2026-01-18)
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
    // AppNamespace에서 registerFn, registerDebugFn 가져오기
    // ═══════════════════════════════════════════════════════════════════
    const registerFn = window.APP?.registerFn || ((category, name, fn, alias) => {
        if (alias && typeof window !== 'undefined') {
            window[alias] = fn;
        }
        return true;
    });
    
    const registerDebugFn = window.APP?.registerDebugFn || ((name, fn, alias) => {
        if (alias && typeof window !== 'undefined') {
            window[alias] = fn;
        }
        return true;
    });
    
    // ════════════════════════════════════════════════════════════════
    // 디버그 함수 정의
    // ════════════════════════════════════════════════════════════════
    
    const debugHelp = () => {
        console.group('📖 Debug Commands (v2.3.0 - Phase 4)');
        
        console.log('=== APP 네임스페이스 (권장) ===');
        console.log('  APP.debug()                - 전체 네임스페이스 상태');
        console.log('  APP.getMigrationStatus()   - 🆕 마이그레이션 진행률');
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
        
        console.log('=== 🆕 Phase 4: Deprecation 관리 ===');
        console.log('  APP.setDeprecationConfig({ enabled: false }) - 경고 끄기');
        console.log('  APP.setDeprecationConfig({ warnLimit: 5 })   - 경고 횟수 변경');
        console.log('  APP.resetDeprecationWarnings()               - 경고 카운터 리셋');
        console.log('  APP.getDeprecationStatus()                   - 경고 상태 확인');
        console.log('');
        
        console.log('=== 하위 호환 (window.*) - ⚠️ Deprecated ===');
        console.log('  ⚠️ window.sceneManager    → APP.services.scene.sceneManager');
        console.log('  ⚠️ window.eventBus        → APP.utils.eventBus');
        console.log('  ⚠️ window.appModeManager  → APP.managers.mode');
        console.log('  ⚠️ window.showToast()     → APP.fn.ui.showToast()');
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
    
    const moveCameraTo = (x, y, z, lookX = 0, lookY = 0, lookZ = 0) => {
        if (cameraNavigator) {
            const targetPosition = new THREE.Vector3(x, y, z);
            const lookAtPosition = new THREE.Vector3(lookX, lookY, lookZ);
            cameraNavigator.animateCameraTo(targetPosition, lookAtPosition);
            console.log(`📷 카메라 이동: (${x}, ${y}, ${z}) → 바라보기: (${lookX}, ${lookY}, ${lookZ})`);
        } else {
            console.error('❌ CameraNavigator가 없습니다');
        }
    };
    
    const focusEquipment = (row, col) => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 없습니다');
            return;
        }
        if (!equipmentLoader) {
            console.error('❌ EquipmentLoader가 없습니다');
            return;
        }
        
        const equipments = equipmentLoader.getEquipmentArray();
        const equipment = equipments.find(eq => 
            eq.userData?.position?.row === row && 
            eq.userData?.position?.col === col
        );
        
        if (equipment) {
            const equipPos = equipment.position.clone();
            const cameraPos = new THREE.Vector3(
                equipPos.x + 10,
                equipPos.y + 15,
                equipPos.z + 10
            );
            cameraNavigator.animateCameraTo(cameraPos, equipPos);
            console.log(`🎯 설비 포커스: row=${row}, col=${col}, ID=${equipment.userData?.id}`);
        } else {
            console.warn(`⚠️ 설비를 찾을 수 없음: row=${row}, col=${col}`);
        }
    };
    
    const resetCamera = (viewMode = 'isometric') => {
        if (!cameraNavigator) {
            console.error('❌ CameraNavigator가 없습니다');
            return;
        }
        
        const validMode = (viewMode === 'top') ? 'top' : 'isometric';
        cameraNavigator.setViewMode(validMode);
        
        const defaultCameraPos = new THREE.Vector3(30, 40, 60);
        const defaultLookAt = new THREE.Vector3(0, 0, 0);
        cameraNavigator.animateCameraTo(defaultCameraPos, defaultLookAt);
        
        console.log(`📷 카메라 리셋 (${validMode.toUpperCase()} 모드)`);
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
    
    // ════════════════════════════════════════════════════════════════════
    // APP 네임스페이스에 등록 (Placeholder 덮어쓰기)
    // ════════════════════════════════════════════════════════════════════
    
    console.log('🔄 Placeholder → 실제 함수 교체 시작...');
    
    // 디버그 함수
    registerDebugFn('help', debugHelp, 'debugHelp');
    registerDebugFn('scene', debugScene, 'debugScene');
    registerDebugFn('listEquipments', listEquipments, 'listEquipments');
    console.log('   ✅ debugFn: help, scene, listEquipments 교체 완료');
    
    // 카메라 함수
    registerFn('camera', 'moveTo', moveCameraTo, 'moveCameraTo');
    registerFn('camera', 'focusEquipment', focusEquipment, 'focusEquipment');
    registerFn('camera', 'reset', resetCamera, 'resetCamera');
    console.log('   ✅ fn.camera: moveTo, focusEquipment, reset 교체 완료');
    
    // 모드 함수
    if (!window.APP?.fn?.mode?.toggleEditMode) {
        registerFn('mode', 'toggleEditMode', toggleEditMode, 'toggleEditMode');
        registerFn('mode', 'toggleMonitoringMode', toggleMonitoringMode, 'toggleMonitoringMode');
    }
    
    // 매핑 함수
    registerFn('mapping', 'getStatus', getMappingStatus, 'getMappingStatus');
    registerFn('mapping', 'clearAll', clearAllMappings, 'clearAllMappings');
    registerFn('mapping', 'export', exportMappings, 'exportMappings');
    console.log('   ✅ fn.mapping: getStatus, clearAll, export 교체 완료');
    
    // 레이아웃 함수
    registerFn('layout', 'applyTest', applyTestLayout, 'applyTestLayout');
    registerFn('layout', 'testRoomResize', testRoomResize, 'testRoomResize');
    console.log('   ✅ fn.layout: applyTest, testRoomResize 교체 완료');
    
    console.log('✅ 전역 디버그 함수 등록 완료 (v2.3.0 - Phase 4)');
}

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 v2.3.0: 레거시 → 새 경로 매핑 테이블 (Phase 4 확장)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 레거시 전역 변수 → APP 네임스페이스 경로 매핑
 * 
 * ⚠️ 이 테이블은 AppNamespace.js의 LEGACY_MIGRATION_MAP과 동기화 필요
 * exposeGlobalObjects()에서 useDeprecation: true 시 사용
 */
export const LEGACY_TO_NEW_PATH = {
    // Scene 서비스
    sceneManager: 'APP.services.scene.sceneManager',
    equipmentLoader: 'APP.services.scene.equipmentLoader',
    cameraControls: 'APP.services.scene.cameraControls',
    cameraNavigator: 'APP.services.scene.cameraNavigator',
    interactionHandler: 'APP.services.scene.interactionHandler',
    dataOverlay: 'APP.services.scene.dataOverlay',
    statusVisualizer: 'APP.services.scene.statusVisualizer',
    performanceMonitor: 'APP.services.scene.performanceMonitor',
    adaptivePerformance: 'APP.services.scene.adaptivePerformance',
    
    // Monitoring 서비스
    monitoringService: 'APP.services.monitoring.monitoringService',
    signalTowerManager: 'APP.services.monitoring.signalTowerManager',
    
    // Mapping 서비스
    equipmentMappingService: 'APP.services.mapping.equipmentMappingService',
    
    // Connection 서비스
    connectionStatusService: 'APP.services.connection.connectionStatusService',
    apiClient: 'APP.services.connection.apiClient',
    
    // 매니저
    appModeManager: 'APP.managers.mode',
    keyboardManager: 'APP.managers.keyboard',
    debugManager: 'APP.managers.debug',
    viewManager: 'APP.managers.view',
    screenManager: 'APP.managers.screen',
    bootstrapViewManager: 'APP.managers.view',
    
    // UI 컴포넌트
    connectionModal: 'APP.ui.connectionModal',
    toast: 'APP.ui.toast',
    equipmentInfoPanel: 'APP.ui.equipmentInfoPanel',
    equipmentEditState: 'APP.ui.equipmentEditState',
    equipmentEditModal: 'APP.ui.equipmentEditModal',
    equipmentEditButton: 'APP.ui.equipmentEditButton',
    sidebarUI: 'APP.ui.sidebar',
    
    // Utils
    eventBus: 'APP.utils.eventBus',
    logger: 'APP.utils.logger',
    storageService: 'APP.services.storage.storageService',
    
    // 함수
    showToast: 'APP.fn.ui.showToast',
    toggleTheme: 'APP.fn.ui.toggleTheme',
    closeConnectionModal: 'APP.fn.ui.closeConnectionModal',
    canAccessFeatures: 'APP.fn.ui.canAccessFeatures',
    toggleConnectionModal: 'APP.fn.ui.toggleConnectionModal',
    toggleDebugPanel: 'APP.fn.ui.toggleDebugPanel',
    toggleDevMode: 'APP.fn.ui.toggleDevMode',
    toggleEditMode: 'APP.fn.mode.toggleEditMode',
    toggleMonitoringMode: 'APP.fn.mode.toggleMonitoringMode',
    toggleFullscreen: 'APP.fn.mode.toggleFullscreen',
    toggleAdaptivePerformance: 'APP.fn.mode.toggleAdaptivePerformance',
    moveCameraTo: 'APP.fn.camera.moveTo',
    focusEquipment: 'APP.fn.camera.focusEquipment',
    resetCamera: 'APP.fn.camera.reset',
    
    // 디버그 함수
    debugHelp: 'APP.debugFn.help',
    debugScene: 'APP.debugFn.scene',
    listEquipments: 'APP.debugFn.listEquipments',
    debugStatus: 'APP.debugFn.status',
    
    // Registry
    VIEW_REGISTRY: 'APP.registry.VIEW_REGISTRY',
    
    // Facade 함수
    getView: 'APP.managers.view.get',
    showView: 'APP.managers.view.show',
    hideView: 'APP.managers.view.hide',
    toggleView: 'APP.managers.view.toggle',
    destroyView: 'APP.managers.view.destroy'
};

/**
 * 🆕 v2.3.0: 전역 객체 노출 (Phase 4 방식)
 * 
 * migrateGlobalToNamespace()의 래퍼 함수
 * 하위 호환을 위해 유지하지만 내부적으로 Phase 4 방식 사용
 * 
 * @param {Object} objects - { key: instance } 형태
 * @param {Object} [options] - 옵션
 * @param {boolean} [options.useDeprecation=false] - Deprecation 경고 사용
 * @param {Object} [options.pathMapping] - 새 경로 매핑
 */
export function exposeGlobalObjects(objects, options = {}) {
    const { 
        useDeprecation = false, 
        pathMapping = LEGACY_TO_NEW_PATH 
    } = options;
    
    // 🆕 Phase 4: APP.migrateGlobalToNamespace() 사용
    const migrateGlobalToNamespace = window.APP?.migrateGlobalToNamespace;
    
    if (migrateGlobalToNamespace) {
        // Phase 4 방식: migrateGlobalToNamespace() 사용
        const result = migrateGlobalToNamespace(objects, {
            useDeprecation,
            pathMapping: window.APP?.LEGACY_MIGRATION_MAP || {},
            silent: true
        });
        console.log(`[GlobalDebug] ✅ Phase 4 방식 적용: ${result.deprecated}개 deprecated, ${result.exposed}개 노출`);
        return result;
    }
    
    // 폴백: 기존 방식 (Phase 4 이전 호환)
    let createDeprecatedAlias = null;
    if (useDeprecation) {
        createDeprecatedAlias = window.APP?.createDeprecatedAlias;
        if (!createDeprecatedAlias) {
            console.warn('[GlobalDebug] ⚠️ useDeprecation=true 이지만 APP.createDeprecatedAlias 없음');
        }
    }
    
    let exposedCount = 0;
    let deprecatedCount = 0;
    
    Object.entries(objects).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return;
        }
        
        if (createDeprecatedAlias && pathMapping[key]) {
            window[key] = createDeprecatedAlias(value, key, pathMapping[key]);
            deprecatedCount++;
        } else {
            window[key] = value;
            exposedCount++;
        }
    });
    
    if (useDeprecation && deprecatedCount > 0) {
        console.log(`[GlobalDebug] ✅ ${exposedCount}개 직접 노출, ⚠️ ${deprecatedCount}개 Deprecation 래퍼 적용`);
    } else {
        console.log(`[GlobalDebug] ✅ ${exposedCount + deprecatedCount}개 전역 노출 완료`);
    }
    
    return { exposed: exposedCount, deprecated: deprecatedCount, skipped: 0 };
}