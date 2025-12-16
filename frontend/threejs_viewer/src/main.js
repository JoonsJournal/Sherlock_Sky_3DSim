/**
 * main.js
 * 메인 진입점 - 모든 모듈 통합 및 초기화 (다중 선택 지원)
 */

import { SceneManager } from './scene/SceneManager.js';
import { Lighting } from './scene/Lighting.js';
import { EquipmentLoader } from './scene/EquipmentLoader.js';
import { CameraControls } from './controls/CameraControls.js';
import { InteractionHandler } from './controls/InteractionHandler.js';
import { StatusVisualizer } from './visualization/StatusVisualizer.js';
import { DataOverlay } from './visualization/DataOverlay.js';
import * as Helpers from './utils/Helpers.js';
import { CONFIG, debugLog } from './utils/Config.js';

// ============================================
// 전역 변수
// ============================================

let sceneManager;
let cameraControls;
let equipmentLoader;
let interactionHandler;
let statusVisualizer;
let dataOverlay;

// ============================================
// 초기화
// ============================================

function init() {
    debugLog('🚀 애플리케이션 초기화 시작...');
    
    // 1. 씬 관리자 생성
    sceneManager = new SceneManager();
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    const renderer = sceneManager.getRenderer();
    
    // 2. 바닥 추가
    sceneManager.addFloor();
    
    // 3. 조명 추가
    Lighting.addLights(scene);
    
    // 4. 디버그 헬퍼 추가 (DEBUG_MODE일 때만)
    if (CONFIG.DEBUG_MODE) {
        Helpers.addDebugHelpers(scene);
    }
    
    // 5. 카메라 컨트롤 설정
    cameraControls = new CameraControls(camera, renderer);
    
    // 6. UI 오버레이 초기화
    dataOverlay = new DataOverlay();
    dataOverlay.exposeGlobalFunctions();
    
    // 7. 설비 로더 초기화 및 배열 생성
    equipmentLoader = new EquipmentLoader(scene);
    equipmentLoader.createEquipmentArray((msg, isError) => {
        dataOverlay.updateLoadingStatus(msg, isError);
    });
    
    const equipmentArray = equipmentLoader.getEquipmentArray();
    
    // 8. 상태 시각화 초기화
    statusVisualizer = new StatusVisualizer(equipmentArray);
    statusVisualizer.updateAllStatus();
    
    // 9. 상호작용 핸들러 초기화
    interactionHandler = new InteractionHandler(camera, scene, equipmentArray);
    
    // 설비 클릭 콜백 설정 - 이제 배열 형태로 데이터를 받음
    interactionHandler.setOnEquipmentClick((equipmentDataArray) => {
        // 배열 형태로 전달 (단일 선택이어도 배열)
        dataOverlay.showEquipmentInfo(equipmentDataArray);
    });
    
    // 10. 전역 디버깅 함수 노출
    exposeDebugFunctions();
    
    // 11. 애니메이션 시작
    animate();
    
    debugLog('✅ 애플리케이션 초기화 완료');
    
    // 초기 도움말 출력
    if (CONFIG.DEBUG_MODE) {
        console.log('');
        console.log('🔧 디버그 모드 활성화');
        console.log('💡 도움말을 보려면 debugHelp()를 입력하세요');
        console.log('');
    }
    
    // 다중 선택 안내 메시지
    console.log('');
    console.log('✨ 다중 선택 기능 활성화');
    console.log('   Ctrl+클릭: 설비를 여러 대 선택/해제');
    console.log('   평균값: 여러 설비 선택 시 자동 계산');
    console.log('');
}

// ============================================
// 애니메이션 루프
// ============================================

function animate() {
    requestAnimationFrame(animate);
    
    // 씬 렌더링
    sceneManager.render(cameraControls.getControls());
    
    // 에러 상태 애니메이션
    if (statusVisualizer) {
        statusVisualizer.animateErrorStatus();
    }
}

// ============================================
// 전역 디버깅 함수 노출
// ============================================

function exposeDebugFunctions() {
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    const renderer = sceneManager.getRenderer();
    const controls = cameraControls.getControls();
    const equipmentArray = equipmentLoader.getEquipmentArray();
    
    // 씬 정보
    window.debugScene = () => {
        Helpers.debugScene(scene, camera, controls, equipmentArray);
    };
    
    // 카메라 이동
    window.moveCameraTo = (x, y, z) => {
        Helpers.moveCameraTo(camera, controls, x, y, z);
    };
    
    // 설비 포커스
    window.focusEquipment = (row, col) => {
        Helpers.focusEquipment(camera, controls, equipmentArray, row, col);
    };
    
    // 헬퍼 토글
    window.toggleHelpers = () => {
        Helpers.toggleHelpers(scene);
    };
    
    // 렌더러 정보
    window.debugRenderer = () => {
        Helpers.debugRenderer(renderer);
    };
    
    // 성능 측정
    window.measurePerformance = (duration) => {
        Helpers.measurePerformance(duration);
    };
    
    // 도움말
    window.debugHelp = () => {
        Helpers.debugHelp();
    };
    
    // 다중 선택 디버깅
    window.getSelectedEquipments = () => {
        const selected = interactionHandler.getSelectedEquipments();
        console.log(`선택된 설비: ${selected.length}대`);
        selected.forEach(eq => {
            console.log(`  - ${eq.userData.id}: ${eq.userData.status}`);
        });
        return selected;
    };
    
    window.clearSelections = () => {
        interactionHandler.clearAllSelections();
        dataOverlay.hideEquipmentInfo();
        console.log('✅ 모든 선택 해제됨');
    };
}

// ============================================
// 애플리케이션 시작
// ============================================

// DOM 로드 완료 후 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}