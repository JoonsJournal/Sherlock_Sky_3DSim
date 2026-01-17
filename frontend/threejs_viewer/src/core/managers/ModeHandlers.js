/**
 * ModeHandlers.js
 * ===============
 * 
 * 모드별 진입/종료 핸들러 정의
 * - 중앙 집중식 모드 관리를 위한 핸들러 클래스들
 * - 각 모드의 책임을 명확히 분리
 * - Sub_mode 확장 지원 준비
 * 
 * @version 1.3.0
 * @description 상호 배타적 모드 전환 시 자동 정리 지원
 * 
 * @changelog
 * - v1.3.0: 🆕 RankingViewModeHandler 추가 (2026-01-17) - Phase 5
 *           - Ranking View 모드 진입/종료 핸들러
 *           - 3D View ↔ Ranking View 전환 지원
 *           - KeyboardManager 연동
 *           - LaneManager 연동
 *           - CameraNavigator 가시성 제어
 *           - ⚠️ 호환성: 기존 모든 핸들러/로직 100% 유지
 * - v1.2.0: 🆕 AnalyticsModeHandler 추가 (2026-01-13)
 *           - Analysis 모드 진입/종료 핸들러
 *           - Analysis 컨테이너 표시/숨김
 *           - 버튼 상태 동기화 (analysisBtn 추가)
 * - v1.1.0: MonitoringModeHandler.onExit()에서 turnOffAllLights 방어적 코딩 적용
 * - v1.0.0: 초기 버전 - 모드 핸들러 시스템 구현
 * 
 * 위치: frontend/threejs_viewer/src/core/managers/ModeHandlers.js
 */

import { APP_MODE, KEYBOARD_CONTEXT } from '../config/constants.js';
import { logger } from './Logger.js';
import { keyboardManager } from './KeyboardManager.js';

// ============================================
// 버튼 상태 동기화 유틸리티
// ============================================

/**
 * 모든 모드 버튼 상태를 동기화
 * @param {string} activeMode - 현재 활성화된 모드
 */
export function syncAllButtonStates(activeMode) {
    // 🔧 v1.3.0: rankingViewBtn 추가
    const buttonModeMap = {
        'editBtn': APP_MODE.EQUIPMENT_EDIT,
        'monitoringBtn': APP_MODE.MONITORING,
        'btn-monitoring': APP_MODE.MONITORING,
        'btn-analysis': APP_MODE.ANALYTICS,
        'btn-simulation': APP_MODE.SIMULATION,
        'sub-ranking-view': 'ranking_view'  // 🆕 v1.3.0
    };
    
    Object.entries(buttonModeMap).forEach(([btnId, mode]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            const isActive = (activeMode === mode);
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('selected', isActive);
        }
    });
    
    logger.debug(`버튼 상태 동기화: activeMode=${activeMode}`);
}

// ============================================
// 모드 핸들러 클래스 정의
// ============================================

/**
 * Main Viewer 모드 핸들러
 */
export class MainViewerModeHandler {
    constructor() {
        this.name = 'Main Viewer';
        this.keyboardContext = KEYBOARD_CONTEXT.VIEWER_3D;
    }
    
    onEnter(context = {}) {
        logger.info('Main Viewer 모드 진입');
        keyboardManager.setContext(KEYBOARD_CONTEXT.VIEWER_3D);
        document.body.classList.remove('edit-mode-active', 'monitoring-mode-active', 'analysis-mode-active', 'ranking-view-active');
        syncAllButtonStates(APP_MODE.MAIN_VIEWER);
        
        // Analysis 컨테이너 숨김
        const analysisContainer = document.getElementById('analysis-container');
        if (analysisContainer) {
            analysisContainer.classList.add('hidden');
        }
        
        // 🆕 v1.3.0: Ranking View 숨김
        const rankingView = document.querySelector('.ranking-view');
        if (rankingView) {
            rankingView.classList.add('ranking-view--hidden', 'hidden');
        }
    }
    
    onExit(context = {}) {
        logger.info('Main Viewer 모드 종료');
    }
    
    onUpdate(data) {
        // Main Viewer 모드에서의 업데이트 처리
    }
}

/**
 * Equipment Edit 모드 핸들러
 */
export class EquipmentEditModeHandler {
    constructor() {
        this.name = 'Equipment Edit';
        this.keyboardContext = KEYBOARD_CONTEXT.EDITOR_2D;
        
        // 서비스 참조 (나중에 설정)
        this._equipmentEditState = null;
        this._equipmentEditButton = null;
    }
    
    /**
     * 서비스 설정 (main.js에서 호출)
     * @param {Object} services - { equipmentEditState, equipmentEditButton }
     */
    setServices(services) {
        this._equipmentEditState = services.equipmentEditState || null;
        this._equipmentEditButton = services.equipmentEditButton || null;
        logger.debug('EquipmentEditModeHandler 서비스 설정 완료');
    }
    
    onEnter(context = {}) {
        logger.info('Equipment Edit 모드 진입');
        
        // 1. EditState 활성화
        if (this._equipmentEditState) {
            this._equipmentEditState.enableEditMode();
        }
        
        // 2. EquipmentEditButton 상태 동기화
        if (this._equipmentEditButton) {
            this._equipmentEditButton.setEditModeActive(true);
        }
        
        // 3. CSS 클래스 추가
        document.body.classList.add('edit-mode-active');
        document.body.classList.remove('monitoring-mode-active', 'analysis-mode-active', 'ranking-view-active');
        
        // 4. 버튼 상태 동기화
        syncAllButtonStates(APP_MODE.EQUIPMENT_EDIT);
        
        // 5. Analysis 컨테이너 숨김
        const analysisContainer = document.getElementById('analysis-container');
        if (analysisContainer) {
            analysisContainer.classList.add('hidden');
        }
        
        // 🆕 v1.3.0: Ranking View 숨김
        const rankingView = document.querySelector('.ranking-view');
        if (rankingView) {
            rankingView.classList.add('ranking-view--hidden', 'hidden');
        }
    }
    
    onExit(context = {}) {
        logger.info('Equipment Edit 모드 종료');
        
        // 1. EditState 비활성화
        if (this._equipmentEditState) {
            this._equipmentEditState.disableEditMode();
        }
        
        // 2. EquipmentEditButton 상태 동기화
        if (this._equipmentEditButton) {
            this._equipmentEditButton.setEditModeActive(false);
        }
        
        // 3. CSS 클래스 제거
        document.body.classList.remove('edit-mode-active');
    }
    
    onUpdate(data) {
        // Equipment Edit 모드에서의 업데이트 처리
    }
}

/**
 * Monitoring 모드 핸들러
 */
export class MonitoringModeHandler {
    constructor() {
        this.name = 'Monitoring';
        this.keyboardContext = KEYBOARD_CONTEXT.VIEWER_3D;
        
        // 서비스 참조 (나중에 설정)
        this._monitoringService = null;
        this._signalTowerManager = null;
    }
    
    /**
     * 서비스 설정 (main.js에서 호출)
     * @param {Object} services - { monitoringService, signalTowerManager }
     */
    setServices(services) {
        this._monitoringService = services.monitoringService || null;
        this._signalTowerManager = services.signalTowerManager || null;
        logger.debug('MonitoringModeHandler 서비스 설정 완료');
    }
    
    onEnter(context = {}) {
        logger.info('Monitoring 모드 진입');
        
        // 1. MonitoringService 시작
        if (this._monitoringService && !this._monitoringService.isActive) {
            this._monitoringService.start();
        }
        
        // 2. CSS 클래스 추가
        document.body.classList.add('monitoring-mode-active');
        document.body.classList.remove('edit-mode-active', 'analysis-mode-active', 'ranking-view-active');
        
        // 3. 버튼 상태 동기화
        syncAllButtonStates(APP_MODE.MONITORING);
        
        // 4. Analysis 컨테이너 숨김
        const analysisContainer = document.getElementById('analysis-container');
        if (analysisContainer) {
            analysisContainer.classList.add('hidden');
        }
        
        // 🆕 v1.3.0: Ranking View 숨김 (3D View submode일 때)
        const rankingView = document.querySelector('.ranking-view');
        if (rankingView) {
            rankingView.classList.add('ranking-view--hidden', 'hidden');
        }
    }
    
    /**
     * 🔧 v1.1.0: 방어적 코딩 적용
     */
    onExit(context = {}) {
        logger.info('Monitoring 모드 종료');
        
        // 1. MonitoringService 중지 (내부에서 램프 정리 포함)
        if (this._monitoringService && this._monitoringService.isActive) {
            this._monitoringService.stop();
        }
        
        // 2. SignalTower 모든 램프 OFF (선택적 - 메서드 존재 시에만)
        if (this._signalTowerManager) {
            // 🔧 수정: 메서드 존재 여부 확인 후 호출
            if (typeof this._signalTowerManager.turnOffAllLights === 'function') {
                this._signalTowerManager.turnOffAllLights();
            } else if (typeof this._signalTowerManager.initializeAllLights === 'function') {
                // fallback: 모든 램프 초기화 (OFF 상태로)
                this._signalTowerManager.initializeAllLights();
            }
        }
        
        // 3. CSS 클래스 제거
        document.body.classList.remove('monitoring-mode-active');
    }
    
    onUpdate(data) {
        // Monitoring 모드에서의 업데이트 처리 (실시간 데이터 등)
    }
}

/**
 * 🆕 v1.2.0: Analytics 모드 핸들러
 */
export class AnalyticsModeHandler {
    constructor() {
        this.name = 'Analytics';
        this.keyboardContext = KEYBOARD_CONTEXT.VIEWER_3D;
        
        // 서비스 참조 (나중에 설정)
        this._analyticsService = null;
    }
    
    /**
     * 서비스 설정 (main.js에서 호출)
     * @param {Object} services - { analyticsService }
     */
    setServices(services) {
        this._analyticsService = services.analyticsService || null;
        logger.debug('AnalyticsModeHandler 서비스 설정 완료');
    }
    
    onEnter(context = {}) {
        logger.info('Analytics 모드 진입');
        
        // 1. CSS 클래스 추가
        document.body.classList.add('analysis-mode-active');
        document.body.classList.remove('edit-mode-active', 'monitoring-mode-active', 'ranking-view-active');
        
        // 2. 버튼 상태 동기화
        syncAllButtonStates(APP_MODE.ANALYTICS);
        
        // 3. Analysis 컨테이너 표시
        const analysisContainer = document.getElementById('analysis-container');
        if (analysisContainer) {
            analysisContainer.classList.remove('hidden');
        }
        
        // 4. Three.js 컨테이너 숨김 (Analysis는 별도 UI)
        const threejsContainer = document.getElementById('threejs-container');
        if (threejsContainer) {
            threejsContainer.classList.remove('active');
        }
        
        // 5. Cover Screen 숨김
        const coverScreen = document.getElementById('cover-screen');
        if (coverScreen) {
            coverScreen.classList.add('hidden');
        }
        
        // 6. Analytics 서비스 시작 (있는 경우)
        if (this._analyticsService && typeof this._analyticsService.start === 'function') {
            this._analyticsService.start();
        }
        
        // 🆕 v1.3.0: Ranking View 숨김
        const rankingView = document.querySelector('.ranking-view');
        if (rankingView) {
            rankingView.classList.add('ranking-view--hidden', 'hidden');
        }
    }
    
    onExit(context = {}) {
        logger.info('Analytics 모드 종료');
        
        // 1. CSS 클래스 제거
        document.body.classList.remove('analysis-mode-active');
        
        // 2. Analysis 컨테이너 숨김
        const analysisContainer = document.getElementById('analysis-container');
        if (analysisContainer) {
            analysisContainer.classList.add('hidden');
        }
        
        // 3. Analytics 서비스 중지 (있는 경우)
        if (this._analyticsService && typeof this._analyticsService.stop === 'function') {
            this._analyticsService.stop();
        }
    }
    
    onUpdate(data) {
        // Analytics 모드에서의 업데이트 처리 (차트 갱신 등)
    }
}

/**
 * 🆕 v1.3.0: Ranking View 모드 핸들러 (Phase 5)
 */
export class RankingViewModeHandler {
    constructor() {
        this.name = 'Ranking View';
        this.keyboardContext = KEYBOARD_CONTEXT.VIEWER_3D;
        
        // 서비스 참조 (나중에 설정)
        this._rankingView = null;
        this._laneManager = null;
        this._viewer3D = null;
        this._webSocketClient = null;
    }
    
    /**
     * 서비스 설정 (main.js에서 호출)
     * @param {Object} services - { rankingView, laneManager, viewer3D, webSocketClient }
     */
    setServices(services) {
        this._rankingView = services.rankingView || null;
        this._laneManager = services.laneManager || null;
        this._viewer3D = services.viewer3D || null;
        this._webSocketClient = services.webSocketClient || null;
        logger.debug('RankingViewModeHandler 서비스 설정 완료');
    }
    
    onEnter(context = {}) {
        logger.info('🔄 Ranking View 모드 진입');
        
        // 1. CSS 클래스 추가
        document.body.classList.add('ranking-view-active');
        document.body.classList.remove('edit-mode-active', 'analysis-mode-active');
        // monitoring-mode-active는 유지 (Ranking View는 Monitoring의 서브모드)
        
        // 2. 3D View 숨김 (dispose 하지 않음!)
        if (this._viewer3D) {
            if (typeof this._viewer3D.hide === 'function') {
                this._viewer3D.hide();
            }
        }
        
        // Three.js 컨테이너 비활성화
        const threejsContainer = document.getElementById('threejs-container');
        if (threejsContainer) {
            threejsContainer.classList.remove('active');
            threejsContainer.style.display = 'none';
        }
        
        // 3. CameraNavigator 숨김
        this._setCameraNavigatorVisible(false);
        
        // 4. Ranking View 표시
        if (this._rankingView) {
            this._rankingView.show();
        } else {
            // Ranking View 인스턴스가 없으면 DOM 직접 조작
            const rankingViewEl = document.querySelector('.ranking-view');
            if (rankingViewEl) {
                rankingViewEl.classList.remove('ranking-view--hidden', 'hidden');
                rankingViewEl.classList.add('ranking-view--active', 'active');
            }
        }
        
        // 5. LaneManager 활성화
        if (this._laneManager) {
            this._laneManager.activate();
        }
        
        // 6. KeyboardManager에 Ranking View 상태 알림
        keyboardManager.setRankingViewActive(true);
        if (this._laneManager) {
            keyboardManager.setLaneManager(this._laneManager);
        }
        
        // 7. 버튼 상태 동기화
        syncAllButtonStates('ranking_view');
        
        // 8. 서브메뉴 아이템 활성화
        const submenuItem = document.getElementById('sub-ranking-view');
        if (submenuItem) {
            submenuItem.classList.add('active', 'submenu__item--active');
        }
        
        logger.info('✅ Ranking View 모드 진입 완료');
    }
    
    onExit(context = {}) {
        logger.info('🔄 Ranking View 모드 종료');
        
        // 1. CSS 클래스 제거
        document.body.classList.remove('ranking-view-active');
        
        // 2. Ranking View 숨김
        if (this._rankingView) {
            this._rankingView.hide();
        } else {
            const rankingViewEl = document.querySelector('.ranking-view');
            if (rankingViewEl) {
                rankingViewEl.classList.add('ranking-view--hidden', 'hidden');
                rankingViewEl.classList.remove('ranking-view--active', 'active');
            }
        }
        
        // 3. LaneManager 비활성화
        if (this._laneManager) {
            this._laneManager.deactivate();
        }
        
        // 4. KeyboardManager 상태 업데이트
        keyboardManager.setRankingViewActive(false);
        
        // 5. 3D View 복원
        if (this._viewer3D) {
            if (typeof this._viewer3D.show === 'function') {
                this._viewer3D.show();
            }
        }
        
        // Three.js 컨테이너 활성화
        const threejsContainer = document.getElementById('threejs-container');
        if (threejsContainer) {
            threejsContainer.classList.add('active');
            threejsContainer.style.display = 'block';
        }
        
        // 6. CameraNavigator 표시
        this._setCameraNavigatorVisible(true);
        
        // 7. 서브메뉴 아이템 비활성화
        const submenuItem = document.getElementById('sub-ranking-view');
        if (submenuItem) {
            submenuItem.classList.remove('active', 'submenu__item--active');
        }
        
        logger.info('✅ Ranking View 모드 종료 완료');
    }
    
    onUpdate(data) {
        // Ranking View 모드에서의 업데이트 처리
        // WebSocket 데이터가 들어오면 카드 업데이트
        if (this._rankingView && data) {
            // Phase 5 이후 구현
        }
    }
    
    /**
     * CameraNavigator 가시성 설정
     * @private
     * @param {boolean} visible
     */
    _setCameraNavigatorVisible(visible) {
        // 방법 1: 전역 window.cameraNavigator 사용
        if (window.cameraNavigator?.setVisible) {
            window.cameraNavigator.setVisible(visible);
            return;
        }
        
        // 방법 2: window.services.scene.cameraNavigator 사용
        if (window.services?.scene?.cameraNavigator?.setVisible) {
            window.services.scene.cameraNavigator.setVisible(visible);
            return;
        }
        
        // 방법 3: DOM 직접 접근 (폴백)
        const navigatorEl = document.getElementById('camera-navigator');
        if (navigatorEl) {
            navigatorEl.style.display = visible ? 'block' : 'none';
        }
    }
}

// ============================================
// 모드 핸들러 레지스트리
// ============================================

/**
 * 모든 모드 핸들러 인스턴스
 * 🔧 v1.3.0: RANKING_VIEW 추가
 */
export const modeHandlers = {
    [APP_MODE.MAIN_VIEWER]: new MainViewerModeHandler(),
    [APP_MODE.EQUIPMENT_EDIT]: new EquipmentEditModeHandler(),
    [APP_MODE.MONITORING]: new MonitoringModeHandler(),
    [APP_MODE.ANALYTICS]: new AnalyticsModeHandler(),
    // 🆕 v1.3.0: Ranking View 모드 핸들러 추가
    'ranking_view': new RankingViewModeHandler()
};

/**
 * 모드 핸들러에 서비스 연결
 * @param {Object} services - 모든 서비스 객체
 */
export function connectModeHandlerServices(services) {
    const {
        equipmentEditState,
        equipmentEditButton,
        monitoringService,
        signalTowerManager,
        analyticsService,
        // 🆕 v1.3.0
        rankingView,
        laneManager,
        viewer3D,
        webSocketClient
    } = services;
    
    // Equipment Edit 핸들러에 서비스 연결
    if (modeHandlers[APP_MODE.EQUIPMENT_EDIT]) {
        modeHandlers[APP_MODE.EQUIPMENT_EDIT].setServices({
            equipmentEditState,
            equipmentEditButton
        });
    }
    
    // Monitoring 핸들러에 서비스 연결
    if (modeHandlers[APP_MODE.MONITORING]) {
        modeHandlers[APP_MODE.MONITORING].setServices({
            monitoringService,
            signalTowerManager
        });
    }
    
    // 🆕 v1.2.0: Analytics 핸들러에 서비스 연결
    if (modeHandlers[APP_MODE.ANALYTICS]) {
        modeHandlers[APP_MODE.ANALYTICS].setServices({
            analyticsService
        });
    }
    
    // 🆕 v1.3.0: Ranking View 핸들러에 서비스 연결
    if (modeHandlers['ranking_view']) {
        modeHandlers['ranking_view'].setServices({
            rankingView,
            laneManager,
            viewer3D,
            webSocketClient
        });
    }
    
    logger.info('모드 핸들러 서비스 연결 완료');
}

/**
 * AppModeManager에 모든 핸들러 등록
 * @param {Object} appModeManager - AppModeManager 인스턴스
 */
export function registerAllModeHandlers(appModeManager) {
    Object.entries(modeHandlers).forEach(([mode, handler]) => {
        appModeManager.registerMode(mode, {
            name: handler.name,
            keyboardContext: handler.keyboardContext,
            onEnter: (ctx) => handler.onEnter(ctx),
            onExit: (ctx) => handler.onExit(ctx),
            onUpdate: (data) => handler.onUpdate(data)
        });
    });
    
    logger.info(`모드 핸들러 등록 완료: ${Object.keys(modeHandlers).length}개`);
}

/**
 * 특정 모드의 핸들러 가져오기
 * @param {string} mode - 모드 이름
 * @returns {Object|null} 모드 핸들러
 */
export function getModeHandler(mode) {
    return modeHandlers[mode] || null;
}

// ============================================
// 🆕 v1.3.0: Ranking View 전용 함수
// ============================================

/**
 * Ranking View 모드 활성화
 */
export function activateRankingViewMode() {
    const handler = modeHandlers['ranking_view'];
    if (handler) {
        handler.onEnter({});
    }
}

/**
 * Ranking View 모드 비활성화
 */
export function deactivateRankingViewMode() {
    const handler = modeHandlers['ranking_view'];
    if (handler) {
        handler.onExit({});
    }
}

// ============================================
// 디버깅 유틸리티
// ============================================

/**
 * 모드 핸들러 상태 출력
 */
export function debugModeHandlers() {
    console.group('🔧 Mode Handlers Debug');
    Object.entries(modeHandlers).forEach(([mode, handler]) => {
        console.log(`${mode}:`, {
            name: handler.name,
            keyboardContext: handler.keyboardContext,
            hasServices: !!(handler._equipmentEditState || handler._monitoringService || handler._analyticsService || handler._rankingView)
        });
    });
    console.groupEnd();
}

// 전역 디버그 함수 노출
if (typeof window !== 'undefined') {
    window.debugModeHandlers = debugModeHandlers;
    window.activateRankingViewMode = activateRankingViewMode;
    window.deactivateRankingViewMode = deactivateRankingViewMode;
}