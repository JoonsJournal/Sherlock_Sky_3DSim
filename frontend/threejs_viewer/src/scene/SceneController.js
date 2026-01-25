/**
 * SceneController.js
 * ==================
 * Three.js Scene 초기화 및 관리 (기존 screenManager 대체)
 * 
 * @version 1.0.0
 * @description
 * - main.js의 screenManager 로직 통합
 * - AppState.js의 screenManager 객체 대체
 * - Three.js 지연 초기화, 애니메이션 제어, View 전환
 * 
 * @changelog
 * - v1.0.0: Phase 4 - screenManager 리팩토링 (2026-01-25)
 *           - initThreeJSScene() 메서드 통합
 *           - 애니메이션 제어 SceneRenderer로 위임
 *           - EventBus 이벤트 핸들링
 *           - ⚠️ 호환성: window.screenManager, window.viewManager 100% 유지
 * 
 * @dependencies
 * - ./SceneRenderer.js (animate, startAnimationLoop, stopAnimationLoop)
 * - ./SceneServices.js (connectSceneServices, updateViewManagerServices)
 * - ../app/AppState.js (services, getService, setService, hasService)
 * 
 * @exports
 * - SceneController: 클래스
 * - sceneController: 싱글톤 인스턴스
 * - screenManager: 하위 호환 별칭
 * 
 * 📁 위치: frontend/threejs_viewer/src/scene/SceneController.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

import { 
    startAnimationLoop, 
    stopAnimationLoop, 
    isAnimationRunning,
    setPerformanceMonitorUI 
} from './SceneRenderer.js';

import { 
    connectSceneServices, 
    updateViewManagerServices,
    ensureMonitoringServiceStarted 
} from './SceneServices.js';

import { getService, setService, hasService } from '../app/AppState.js';

// ============================================
// SceneController 클래스
// ============================================

/**
 * SceneController
 * 
 * Three.js Scene 초기화 및 관리자
 * 기존 screenManager를 대체하는 클래스
 * 
 * @class
 * 
 * @example
 * import { sceneController } from './scene/SceneController.js';
 * 
 * // 3D View 표시
 * sceneController.show3DView();
 * 
 * // 초기화 상태 확인
 * if (sceneController.threejsInitialized) {
 *     console.log('Three.js 초기화됨');
 * }
 */
export class SceneController {
    
    // ========================================
    // 정적 속성
    // ========================================
    
    /** @type {string} 버전 */
    static VERSION = '1.0.0';
    
    /** @type {string} 모듈 이름 */
    static NAME = 'SceneController';
    
    // ========================================
    // 생성자
    // ========================================
    
    constructor() {
        /** @private @type {boolean} Three.js 초기화 여부 */
        this._threejsInitialized = false;
        
        /** @private @type {Object|null} Bootstrap 의존성 */
        this._bootstrap = null;
        
        /** @private @type {Object|null} EventBus 참조 */
        this._eventBus = null;
        
        /** @private @type {Object|null} AppModeManager 참조 */
        this._appModeManager = null;
        
        /** @private @type {Object|null} Sidebar UI 참조 */
        this._sidebarUI = null;
        
        /** @private @type {Function|null} 전역 객체 노출 함수 */
        this._exposeGlobalObjects = null;
        
        /** @private @type {Object|null} APP_MODE 상수 참조 */
        this._APP_MODE = null;
        
        console.log(`[${SceneController.NAME}] 인스턴스 생성 (v${SceneController.VERSION})`);
    }
    
    // ========================================
    // Getter/Setter
    // ========================================
    
    /**
     * Three.js 초기화 여부
     * @type {boolean}
     */
    get threejsInitialized() {
        return this._threejsInitialized;
    }
    
    set threejsInitialized(value) {
        this._threejsInitialized = value;
    }
    
    /**
     * 애니메이션 실행 여부 (SceneRenderer에서 조회)
     * @type {boolean}
     */
    get animationRunning() {
        return isAnimationRunning();
    }
    
    // ========================================
    // 설정 메서드
    // ========================================
    
    /**
     * Bootstrap 의존성 설정
     * 
     * @param {Object} bootstrap - Bootstrap 모듈 exports
     * @param {Function} bootstrap.initScene - Scene 초기화 함수
     * @param {Function} bootstrap.initMonitoringServices - Monitoring 초기화 함수
     * @param {Function} bootstrap.hideLoadingStatus - 로딩 숨김 함수
     * @param {Function} bootstrap.connectServicesToModeHandlers - 모드 핸들러 연결
     * @param {Function} bootstrap.setupEditModeEventListeners - Edit 모드 이벤트
     * @param {Function} bootstrap.setupLayoutEventListeners - Layout 이벤트
     * @param {Function} bootstrap.setupLayoutEditorMainConnection - LayoutEditor 연결
     * @param {Function} bootstrap.initPreviewGenerator - PreviewGenerator 초기화
     * @param {Function} bootstrap.setupGlobalDebugFunctions - 디버그 함수 설정
     * @param {Object} bootstrap.bootstrapViewManager - ViewManager 인스턴스
     */
    setBootstrap(bootstrap) {
        this._bootstrap = bootstrap;
        console.log('[SceneController] ✅ Bootstrap 의존성 설정 완료');
    }
    
    /**
     * EventBus 설정
     * @param {Object} eventBus
     */
    setEventBus(eventBus) {
        this._eventBus = eventBus;
    }
    
    /**
     * AppModeManager 설정
     * @param {Object} appModeManager
     */
    setAppModeManager(appModeManager) {
        this._appModeManager = appModeManager;
    }
    
    /**
     * APP_MODE 상수 설정
     * @param {Object} APP_MODE
     */
    setAppMode(APP_MODE) {
        this._APP_MODE = APP_MODE;
    }
    
    /**
     * SidebarUI 설정
     * @param {Object} sidebarUI
     */
    setSidebarUI(sidebarUI) {
        this._sidebarUI = sidebarUI;
    }
    
    /**
     * 전역 객체 노출 함수 설정
     * @param {Function} fn
     */
    setExposeGlobalObjects(fn) {
        this._exposeGlobalObjects = fn;
    }
    
    // ========================================
    // View 전환 메서드
    // ========================================
    
    /**
     * Cover Screen 표시 (기본 상태)
     * 
     * @deprecated navigationController.goHome() 사용 권장
     * 
     * @description
     * EventBus를 통해 NavigationController에 요청을 전달
     */
    showCoverScreen() {
        console.log('[SceneController] 📺 showCoverScreen()');
        console.warn('[SceneController] ⚠️ deprecated → navigationController.goHome() 사용 권장');
        
        if (this._eventBus) {
            this._eventBus.emit('navigation:go-home');
        } else if (typeof window !== 'undefined' && window.APP?.utils?.eventBus) {
            window.APP.utils.eventBus.emit('navigation:go-home');
        }
    }
    
    /**
     * 3D View 표시 + Three.js 초기화
     * 
     * @deprecated navigationController.navigate(NAV_MODE.MONITORING, '3d-view') 사용 권장
     */
    show3DView() {
        console.log('[SceneController] 🎮 show3DView()');
        console.warn('[SceneController] ⚠️ deprecated → navigationController.navigate() 사용 권장');
        
        if (this._eventBus) {
            this._eventBus.emit('navigation:goto-3d-view');
        } else if (typeof window !== 'undefined' && window.APP?.utils?.eventBus) {
            window.APP.utils.eventBus.emit('navigation:goto-3d-view');
        }
    }
    
    // ========================================
    // Three.js 초기화
    // ========================================
    
    /**
     * Three.js 초기화 요청 (이벤트 발행)
     * 
     * @fires threejs:init-requested
     */
    _initThreeJS() {
        console.log('[SceneController] ⚙️ _initThreeJS() 요청');
        
        const eventBus = this._eventBus || 
            (typeof window !== 'undefined' && window.APP?.utils?.eventBus);
        
        if (eventBus) {
            eventBus.emit('threejs:init-requested');
        }
    }
    
    /**
     * Three.js 실제 초기화
     * 
     * @description
     * main.js의 initThreeJSScene() 로직 수행
     * Bootstrap 의존성이 설정되어 있어야 함
     * 
     * @returns {boolean} 초기화 성공 여부
     */
    initThreeJSScene() {
        if (!this._bootstrap) {
            console.error('[SceneController] ❌ Bootstrap 의존성 미설정');
            console.error('[SceneController] 💡 sceneController.setBootstrap({...}) 먼저 호출 필요');
            return false;
        }
        
        const {
            initScene,
            initMonitoringServices,
            hideLoadingStatus,
            connectServicesToModeHandlers,
            setupEditModeEventListeners,
            setupLayoutEventListeners,
            setupLayoutEditorMainConnection,
            initPreviewGenerator,
            setupGlobalDebugFunctions,
            bootstrapViewManager
        } = this._bootstrap;
        
        try {
            console.log('[SceneController] 🚀 Three.js 초기화 시작...');
            
            // ─────────────────────────────────────────────────────────────
            // Step 1: 3D 씬 초기화
            // ─────────────────────────────────────────────────────────────
            setService('scene', initScene());
            console.log('  ✅ 3D Scene 초기화 완료');
            
            // ─────────────────────────────────────────────────────────────
            // Step 2: Monitoring 서비스 초기화
            // ─────────────────────────────────────────────────────────────
            const sceneData = getService('scene');
            setService('monitoring', initMonitoringServices(
                sceneData.sceneManager.scene,
                sceneData.equipmentLoader,
                getService('ui.equipmentEditState'),
                getService('ui.connectionStatusService'),
                {
                    connectionStartTiming: 'after-monitoring',
                    connectionDelayMs: 500
                }
            ));
            console.log('  ✅ Monitoring Services 초기화 완료');
            
            // ─────────────────────────────────────────────────────────────
            // Step 3: Scene 서비스 연결 (SceneServices.js)
            // ─────────────────────────────────────────────────────────────
            connectSceneServices({
                appModeManager: this._appModeManager,
                eventBus: this._eventBus,
                connectServicesToModeHandlers
            });
            
            // ─────────────────────────────────────────────────────────────
            // Step 4: Edit Mode 이벤트 설정
            // ─────────────────────────────────────────────────────────────
            const interactionHandler = getService('scene.interactionHandler');
            const equipmentLoader = getService('scene.equipmentLoader');
            const equipmentEditState = getService('ui.equipmentEditState');
            
            if (setupEditModeEventListeners) {
                setupEditModeEventListeners({
                    interactionHandler,
                    equipmentLoader,
                    equipmentEditState
                });
                console.log('  ✅ Edit Mode 이벤트 설정 완료');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 5: Layout 이벤트 설정
            // ─────────────────────────────────────────────────────────────
            const sceneManager = getService('scene.sceneManager');
            
            if (setupLayoutEventListeners) {
                setupLayoutEventListeners({
                    sceneManager,
                    equipmentLoader,
                    interactionHandler,
                    statusVisualizer: getService('scene.statusVisualizer'),
                    signalTowerManager: getService('monitoring.signalTowerManager')
                });
                console.log('  ✅ Layout 이벤트 설정 완료');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 6: LayoutEditorMain 연결
            // ─────────────────────────────────────────────────────────────
            if (setupLayoutEditorMainConnection) {
                setupLayoutEditorMainConnection(sceneManager);
                console.log('  ✅ LayoutEditorMain 연결 완료');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 7: PreviewGenerator 초기화
            // ─────────────────────────────────────────────────────────────
            let previewGenerator = null;
            if (initPreviewGenerator) {
                previewGenerator = initPreviewGenerator();
                console.log('  ✅ PreviewGenerator 초기화 완료');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 8: 전역 디버그 함수 설정
            // ─────────────────────────────────────────────────────────────
            if (setupGlobalDebugFunctions) {
                setupGlobalDebugFunctions({
                    sceneManager,
                    equipmentLoader,
                    cameraNavigator: getService('scene.cameraNavigator'),
                    equipmentEditState
                });
                console.log('  ✅ 전역 디버그 함수 설정 완료');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 9: AdaptivePerformance 글로벌 명령어
            // ─────────────────────────────────────────────────────────────
            const adaptivePerformance = getService('scene.adaptivePerformance');
            if (adaptivePerformance?.setupGlobalCommands) {
                adaptivePerformance.setupGlobalCommands();
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 10: 전역 객체 노출
            // ─────────────────────────────────────────────────────────────
            if (this._exposeGlobalObjects) {
                this._exposeGlobalObjects();
                console.log('  ✅ 전역 객체 노출 완료');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 11: StatusBar에 PerformanceMonitor 연결
            // ─────────────────────────────────────────────────────────────
            const performanceMonitor = getService('scene.performanceMonitor');  // 🆕 추가!

            if (this._sidebarUI?.statusBar?.setPerformanceMonitor && performanceMonitor) {
                this._sidebarUI.statusBar.setPerformanceMonitor(performanceMonitor);
                console.log('  ✅ StatusBar PerformanceMonitor 연결 완료');
            } else {
                console.warn('[SceneController] statusBar.setPerformanceMonitor 메서드 없음 또는 performanceMonitor 미생성 - 스킵');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 12: ViewManager 서비스 업데이트
            // ─────────────────────────────────────────────────────────────
            if (bootstrapViewManager) {
                updateViewManagerServices(bootstrapViewManager);
                console.log('  ✅ ViewManager 서비스 업데이트 완료');
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 13: 로딩 상태 숨김
            // ─────────────────────────────────────────────────────────────
            if (hideLoadingStatus) {
                hideLoadingStatus(1000);
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 14: 타이밍 보정 - Monitoring 모드면 서비스 수동 시작
            // ─────────────────────────────────────────────────────────────
            if (this._appModeManager && this._APP_MODE) {
                const currentMode = this._appModeManager.getCurrentMode();
                ensureMonitoringServiceStarted(currentMode, this._APP_MODE.MONITORING);
            }
            
            // ─────────────────────────────────────────────────────────────
            // Step 15: 초기화 완료 표시
            // ─────────────────────────────────────────────────────────────
            this._threejsInitialized = true;
            
            console.log('[SceneController] ✅ Three.js 초기화 완료');
            
            return true;
            
        } catch (error) {
            console.error('[SceneController] ❌ Three.js 초기화 실패:', error);
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('3D View 초기화 실패', 'error');
            }
            
            return false;
        }
    }
    
    // ========================================
    // 애니메이션 제어 (SceneRenderer 위임)
    // ========================================
    
    /**
     * 애니메이션 시작
     */
    startAnimation() {
        if (startAnimationLoop()) {
            console.log('[SceneController] ▶️ 애니메이션 시작됨');
        }
    }
    
    /**
     * 애니메이션 중지
     */
    stopAnimation() {
        if (stopAnimationLoop()) {
            console.log('[SceneController] ⏹️ 애니메이션 중지됨');
        }
    }
    
    /**
     * PerformanceMonitorUI 설정
     * @param {Object} ui
     */
    setPerformanceMonitorUI(ui) {
        setPerformanceMonitorUI(ui);
    }
    
    // ========================================
    // 이벤트 핸들러 설정
    // ========================================
    
    /**
     * EventBus 이벤트 핸들러 등록
     * 
     * @description
     * main.js의 setupScreenManagerEvents() 로직 통합
     * 이 메서드 호출 전에 setEventBus() 필수
     */
    setupEventHandlers() {
        if (!this._eventBus) {
            console.warn('[SceneController] ⚠️ EventBus 미설정 - setupEventHandlers() 건너뜀');
            return;
        }
        
        const eventBus = this._eventBus;
        
        console.log('[SceneController] 🔗 이벤트 핸들러 설정 시작...');
        
        // Three.js 초기화 요청
        eventBus.on('threejs:init-requested', () => {
            console.log('[SceneController] 📣 Event: threejs:init-requested');
            if (!this._threejsInitialized) {
                this.initThreeJSScene();
            }
        });
        
        // Three.js 표시 요청 (애니메이션 시작)
        eventBus.on('threejs:show-requested', () => {
            console.log('[SceneController] 📣 Event: threejs:show-requested');
            if (!this._threejsInitialized) {
                this.initThreeJSScene();
            }
            this.startAnimation();
        });
        
        // Three.js 중지 요청
        eventBus.on('threejs:stop-requested', () => {
            console.log('[SceneController] 📣 Event: threejs:stop-requested');
            this.stopAnimation();
        });
        
        // 애니메이션만 중지 (Three.js 유지)
        eventBus.on('threejs:stop-animation-requested', () => {
            console.log('[SceneController] 📣 Event: threejs:stop-animation-requested');
            this.stopAnimation();
        });
        
        // 애니메이션 시작 (명시적)
        eventBus.on('threejs:animation-start', () => {
            console.log('[SceneController] 📣 Event: threejs:animation-start');
            this.startAnimation();
        });
        
        console.log('[SceneController] ✅ 이벤트 핸들러 설정 완료');
    }
    
    // ========================================
    // 유틸리티
    // ========================================
    
    /**
     * Monitoring 모드 서비스 시작 보정 (하위 호환)
     * 
     * @deprecated ensureMonitoringServiceStarted() 사용 권장
     */
    _ensureMonitoringServiceStarted() {
        const monitoringService = getService('monitoring.monitoringService');
        
        if (monitoringService && !monitoringService.isActive) {
            console.log('[SceneController] 🔧 MonitoringService 수동 시작');
            monitoringService.start();
        }
    }
    
    // ========================================
    // 디버그
    // ========================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group(`🖥️ ${SceneController.NAME} Debug (v${SceneController.VERSION})`);
        console.log('threejsInitialized:', this._threejsInitialized);
        console.log('animationRunning:', this.animationRunning);
        console.log('');
        console.log('📦 의존성:');
        console.log('  bootstrap:', this._bootstrap ? '✅ 설정됨' : '❌ 미설정');
        console.log('  eventBus:', this._eventBus ? '✅ 설정됨' : '❌ 미설정');
        console.log('  appModeManager:', this._appModeManager ? '✅ 설정됨' : '❌ 미설정');
        console.log('  APP_MODE:', this._APP_MODE ? '✅ 설정됨' : '❌ 미설정');
        console.log('  sidebarUI:', this._sidebarUI ? '✅ 설정됨' : '❌ 미설정');
        console.log('  exposeGlobalObjects:', this._exposeGlobalObjects ? '✅ 설정됨' : '❌ 미설정');
        console.log('');
        console.log('🔌 서비스 상태:');
        console.log('  scene:', hasService('scene') ? '✅' : '❌');
        console.log('  monitoring:', hasService('monitoring') ? '✅' : '❌');
        console.log('  scene.sceneManager:', hasService('scene.sceneManager') ? '✅' : '❌');
        console.groupEnd();
        
        return {
            threejsInitialized: this._threejsInitialized,
            animationRunning: this.animationRunning,
            hasBootstrap: !!this._bootstrap,
            hasEventBus: !!this._eventBus,
            hasAppModeManager: !!this._appModeManager,
            hasScene: hasService('scene')
        };
    }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

/** @type {SceneController} */
export const sceneController = new SceneController();

// ============================================
// 하위 호환 별칭
// ============================================

/**
 * screenManager 별칭 (하위 호환)
 * 
 * @deprecated sceneController 사용 권장
 * @type {SceneController}
 */
export const screenManager = sceneController;

// ============================================
// 전역 노출 (브라우저 환경)
// ============================================

if (typeof window !== 'undefined') {
    // SceneController 전역 노출
    window.sceneController = sceneController;
    
    // 하위 호환: screenManager, viewManager
    window.screenManager = sceneController;
    window.viewManager = sceneController;
    
    console.log('[SceneController] 🌐 window.screenManager, window.viewManager 전역 노출 완료');
}