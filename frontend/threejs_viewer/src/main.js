/**
 * main.js
 * 메인 진입점 - 모든 모듈 통합 및 초기화
 */

import { SceneManager } from './scene/SceneManager.js';
import { Lighting } from './scene/Lighting.js';
import { FactoryEnvironment } from './scene/FactoryEnvironment.js';
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
    
    // 3. 조명 추가 (공장 스타일)
    Lighting.addLights(scene);
    
    // 4. 공장 환경 요소 추가 (벽, 기둥, 천장, 파이프 등)
    FactoryEnvironment.addAllElements(scene);
    
    // 5. 디버그 헬퍼 추가 (DEBUG_MODE일 때만)
    if (CONFIG.DEBUG_MODE) {
        Helpers.addDebugHelpers(scene);
    }
    
    // 6. 카메라 컨트롤 설정
    cameraControls = new CameraControls(camera, renderer);
    
    // 7. UI 오버레이 초기화
    dataOverlay = new DataOverlay();
    dataOverlay.exposeGlobalFunctions();
    
    // 8. 설비 로더 초기화 및 배열 생성
    equipmentLoader = new EquipmentLoader(scene);
    equipmentLoader.createEquipmentArray((msg, isError) => {
        dataOverlay.updateLoadingStatus(msg, isError);
    });
    
    const equipmentArray = equipmentLoader.getEquipmentArray();
    
    // 9. 상태 시각화 초기화
    statusVisualizer = new StatusVisualizer(equipmentArray);
    statusVisualizer.updateAllStatus();
    
    // 10. 상호작용 핸들러 초기화
    interactionHandler = new InteractionHandler(camera, scene, equipmentArray);
    interactionHandler.setOnEquipmentClick((equipmentData) => {
        dataOverlay.showEquipmentInfo(equipmentData);
    });
    
    // 11. 전역 디버깅 함수 노출
    exposeDebugFunctions();
    
    // 12. 애니메이션 시작
    animate();
    
    debugLog('✅ 애플리케이션 초기화 완료');
    
    // 초기 도움말 출력
    if (CONFIG.DEBUG_MODE) {
        console.log('');
        console.log('🏭 FACTORY SIMULATION 모드 활성화');
        console.log('🔧 디버그 모드 활성화');
        console.log('💡 도움말을 보려면 debugHelp()를 입력하세요');
        console.log('');
    }
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