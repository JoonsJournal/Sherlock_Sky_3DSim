/**
 * main.js
 * 메인 애플리케이션 진입점 (리팩토링 버전)
 * Phase 1.2: 모듈화된 Entry Point
 */

// Core managers
import { AppInitializer, appInitializer } from './core/managers/AppInitializer.js';
import { EventHandlers, createEventHandlers } from './core/managers/EventHandlers.js';
import { AnimationLoop, createAnimationLoop } from './core/managers/AnimationLoop.js';
import { createDebugTools } from './core/utils/DebugTools.js';

// Layout converters (전역 노출용)
import { layout2DTo3DConverter } from './services/converter/Layout2DTo3DConverter.js';
import { roomParamsAdapter } from './services/converter/RoomParamsAdapter.js';

// 전역 참조
let instances = null;
let eventHandlers = null;
let animationLoop = null;

/**
 * 애플리케이션 초기화
 */
function initApp() {
    try {
        // 1. Core 초기화
        instances = appInitializer.init();
        
        // 2. 이벤트 핸들러 설정
        eventHandlers = createEventHandlers(instances);
        eventHandlers.setupAll();
        
        // 3. Layout 관련 설정
        appInitializer.setupLayoutEditorMainConnection();
        console.log('✅ LayoutEditorMain 연결 설정 완료');
        
        appInitializer.initPreviewGenerator();
        console.log('✅ PreviewGenerator 연결 설정 완료');
        
        // 4. 디버그 도구 설정
        createDebugTools(instances);
        
        // 5. 애니메이션 루프 시작
        animationLoop = createAnimationLoop(instances);
        animationLoop.start();
        
        // 6. 전역 객체 노출
        exposeGlobalObjects();
        
    } catch (error) {
        console.error('❌ 애플리케이션 초기화 실패:', error);
    }
}

/**
 * 전역 객체 노출
 */
function exposeGlobalObjects() {
    // Core instances
    window.sceneManager = instances.sceneManager;
    window.equipmentLoader = instances.equipmentLoader;
    window.cameraControls = instances.cameraControls;
    window.cameraNavigator = instances.cameraNavigator;
    window.interactionHandler = instances.interactionHandler;
    window.dataOverlay = instances.dataOverlay;
    window.statusVisualizer = instances.statusVisualizer;
    window.performanceMonitor = instances.performanceMonitor;
    
    // UI instances
    window.connectionModal = instances.connectionModal;
    window.equipmentEditState = instances.equipmentEditState;
    window.equipmentEditModal = instances.equipmentEditModal;
    window.apiClient = instances.apiClient;
    
    // Layout converters
    window.layout2DTo3DConverter = layout2DTo3DConverter;
    window.roomParamsAdapter = roomParamsAdapter;
    
    // Preview
    window.previewGenerator = instances.previewGenerator;
    
    console.log('🌐 전역 객체 노출 완료');
}

/**
 * 애플리케이션 정리
 */
function cleanup() {
    if (animationLoop) {
        animationLoop.cleanup();
    }
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', cleanup);

// 애플리케이션 시작
initApp();