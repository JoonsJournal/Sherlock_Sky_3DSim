/**
 * AppState.js
 * ===========
 * 애플리케이션 전역 상태 관리 모듈
 * 
 * @version 1.1.0
 * @description
 * - main.js에서 분리된 전역 상태 관리 모듈
 * - services 객체: 모든 서비스 인스턴스 중앙 저장소
 * - sidebarState: UI 상태 관리 (연결/모드/dev mode)
 * - screenManager: 3D View / Cover Screen 전환 관리
 * - window.services 전역 노출
 * 
 * @changelog
 * - v1.1.0: Phase 4 - screenManager → SceneController 이관 (2026-01-25)
 *           - screenManager 객체 제거 (~130줄)
 *           - sceneController re-export (하위 호환)
 *           - window.screenManager = sceneController
 * - v1.0.0: main.js 리팩토링 Phase 2 - 전역 상태 분리 (2026-01-25)
 *           - services 객체 이동 (scene, ui, monitoring, mapping, views)
 *           - sidebarState 초기화 함수 이동
 *           - window.services 노출 로직 이동
 *           - screenManager 객체 이동 (3D View 전환 관리)
 *           - ⚠️ 호환성: main.js 기존 참조 100% 유지
 * 
 * @dependencies
 * - ./AppConfig.js (SITE_ID, RECOVERY_STRATEGIES)
 * - ../core/managers/index.js (appModeManager, eventBus)
 * - ../core/config/constants.js (APP_MODE)
 * - ../core/navigation/index.js (navigationController, NAV_MODE)
 * 
 * @exports
 * - services: 서비스 인스턴스 저장소
 * - sidebarState: UI 상태 객체 (window.sidebarState 참조)
 * - screenManager: 3D View 전환 관리자
 * - initSidebarState(): sidebarState 초기화 함수
 * - exposeServicesToWindow(): window.services 노출 함수
 * - getService(): 서비스 조회 헬퍼
 * - setService(): 서비스 설정 헬퍼
 * 
 * 📁 위치: frontend/threejs_viewer/src/app/AppState.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

// ============================================
// 의존성 Import
// ============================================
// 🔧 Note: 순환 참조 방지를 위해 동적 import 사용 가능

// Phase 4: SceneController import (screenManager 대체)
import { sceneController } from '../scene/index.js';

// ============================================
// 서비스 객체 저장소
// ============================================

/**
 * 애플리케이션 서비스 인스턴스 중앙 저장소
 * 
 * @constant {Object}
 * @description
 * 모든 핵심 서비스 인스턴스를 카테고리별로 관리
 * 
 * @property {Object|null} scene - 3D Scene 관련 서비스
 * @property {Object|null} ui - UI 컴포넌트 서비스
 * @property {Object|null} monitoring - 모니터링 서비스
 * @property {Object} mapping - 설비 매핑 서비스
 * @property {Object} views - View 관리 서비스
 * 
 * @example
 * import { services, setService, getService } from './app/AppState.js';
 * 
 * // 서비스 설정
 * setService('scene', sceneManager);
 * 
 * // 서비스 조회
 * const sceneManager = getService('scene');
 * 
 * // 직접 접근
 * services.monitoring?.monitoringService?.start();
 */
export const services = {
    /**
     * 3D Scene 관련 서비스
     * @type {Object|null}
     * @property {SceneManager} sceneManager - Three.js Scene 관리
     * @property {EquipmentLoader} equipmentLoader - 설비 모델 로더
     * @property {CameraControls} cameraControls - 카메라 컨트롤
     * @property {CameraNavigator} cameraNavigator - 카메라 네비게이션
     * @property {InteractionHandler} interactionHandler - 사용자 인터랙션
     * @property {DataOverlay} dataOverlay - 데이터 오버레이
     * @property {StatusVisualizer} statusVisualizer - 상태 시각화
     * @property {PerformanceMonitor} performanceMonitor - 성능 모니터링
     * @property {AdaptivePerformance} adaptivePerformance - 적응형 성능 관리
     */
    scene: null,
    
    /**
     * UI 컴포넌트 서비스
     * @type {Object|null}
     * @property {ConnectionModal} connectionModal - 연결 모달
     * @property {EquipmentEditState} equipmentEditState - 설비 편집 상태
     * @property {EquipmentEditModal} equipmentEditModal - 설비 편집 모달
     * @property {EquipmentEditButton} equipmentEditButton - 설비 편집 버튼
     * @property {ApiClient} apiClient - API 클라이언트
     * @property {EquipmentInfoPanel} equipmentInfoPanel - 설비 정보 패널
     * @property {ConnectionStatusService} connectionStatusService - 연결 상태 서비스
     * @property {ConnectionIndicator} connectionIndicator - 연결 인디케이터
     */
    ui: null,
    
    /**
     * 모니터링 서비스
     * @type {Object|null}
     * @property {MonitoringService} monitoringService - 설비 상태 모니터링
     * @property {SignalTowerManager} signalTowerManager - 신호등 관리
     */
    monitoring: null,
    
    /**
     * 설비 매핑 서비스
     * @type {Object}
     * @property {EquipmentMappingService|null} equipmentMappingService - 설비 매핑 관리
     */
    mapping: {
        equipmentMappingService: null
    },
    
    /**
     * View 관리 서비스
     * @type {Object}
     * @property {ViewManager|null} viewManager - ViewManager 인스턴스
     */
    views: {
        viewManager: null
    }
};

// ============================================
// Sidebar State (UI 상태)
// ============================================

/**
 * Sidebar 기본 상태 정의
 * 
 * @constant {Object}
 * @description
 * initSidebarState()에서 사용되는 기본값
 * window.sidebarState가 없을 때 이 값으로 초기화
 */
export const DEFAULT_SIDEBAR_STATE = {
    /** @type {string|null} 현재 모드 (monitoring, analysis 등) */
    currentMode: null,
    
    /** @type {string|null} 현재 서브모드 (3d-view, ranking-view 등) */
    currentSubMode: null,
    
    /** @type {boolean} Site 연결 여부 */
    isConnected: false,
    
    /** @type {boolean} Dev Mode 활성화 여부 */
    devModeEnabled: false,
    
    /** @type {boolean} Debug Panel 표시 여부 */
    debugPanelVisible: false
};

/**
 * Sidebar 상태 객체
 * 
 * @type {Object}
 * @description
 * initSidebarState() 호출 후 window.sidebarState와 동기화됨
 * 
 * 🔄 동기화 방식:
 * - Phase 6.1.0: APP.state와 window.sidebarState 양방향 동기화
 * - 이 참조는 window.sidebarState를 가리킴
 */
export let sidebarState = null;

/**
 * Sidebar 상태 초기화
 * 
 * @returns {Object} 초기화된 sidebarState 객체
 * 
 * @description
 * 1. window.sidebarState가 있으면 그대로 사용
 * 2. 없으면 DEFAULT_SIDEBAR_STATE로 새로 생성
 * 3. sidebarState 참조를 window.sidebarState에 연결
 * 
 * @example
 * import { initSidebarState, sidebarState } from './app/AppState.js';
 * 
 * // main.js 초기화 시 호출
 * initSidebarState();
 * 
 * // 이후 상태 접근
 * console.log(sidebarState.isConnected);
 * sidebarState.devModeEnabled = true;
 */
export function initSidebarState() {
    // 기존 window.sidebarState가 있으면 보존
    if (typeof window !== 'undefined') {
        window.sidebarState = window.sidebarState || { ...DEFAULT_SIDEBAR_STATE };
        sidebarState = window.sidebarState;
        
        console.log('✅ [AppState] sidebarState 초기화 완료:', {
            currentMode: sidebarState.currentMode,
            isConnected: sidebarState.isConnected,
            devModeEnabled: sidebarState.devModeEnabled
        });
    } else {
        // Node.js 환경 (테스트용)
        sidebarState = { ...DEFAULT_SIDEBAR_STATE };
    }
    
    return sidebarState;
}

/**
 * Sidebar 상태 업데이트
 * 
 * @param {Object} updates - 업데이트할 속성들
 * @returns {Object} 업데이트된 sidebarState
 * 
 * @example
 * updateSidebarState({ isConnected: true, currentMode: 'monitoring' });
 */
export function updateSidebarState(updates) {
    if (!sidebarState) {
        initSidebarState();
    }
    
    Object.assign(sidebarState, updates);
    
    // window.sidebarState도 동기화 (이미 같은 참조지만 안전장치)
    if (typeof window !== 'undefined' && window.sidebarState !== sidebarState) {
        Object.assign(window.sidebarState, updates);
    }
    
    return sidebarState;
}

/**
 * Sidebar 상태 조회
 * 
 * @param {string} [key] - 특정 속성 키 (없으면 전체 반환)
 * @returns {*} 속성 값 또는 전체 상태 객체
 * 
 * @example
 * const isConnected = getSidebarState('isConnected');
 * const allState = getSidebarState();
 */
export function getSidebarState(key) {
    if (!sidebarState) {
        initSidebarState();
    }
    
    return key ? sidebarState[key] : { ...sidebarState };
}

// ============================================
// window.services 노출
// ============================================

/**
 * services 객체를 window에 노출
 * 
 * @description
 * - H/G 키 동적 SceneManager 조회 지원
 * - 디버깅용 콘솔 접근 지원
 * - 레거시 코드 호환성 유지
 * 
 * @example
 * import { exposeServicesToWindow } from './app/AppState.js';
 * 
 * // main.js 초기화 시 호출
 * exposeServicesToWindow();
 * 
 * // 콘솔에서 접근 가능
 * window.services.scene.sceneManager.debug();
 */
export function exposeServicesToWindow() {
    if (typeof window !== 'undefined') {
        window.services = services;
        console.log('✅ [AppState] window.services 노출 완료');
    }
}

// ============================================
// 서비스 조회/설정 헬퍼
// ============================================

/**
 * 서비스 조회 (도트 표기법 지원)
 * 
 * @param {string} path - 서비스 경로 (예: 'scene.sceneManager', 'monitoring.monitoringService')
 * @returns {*} 서비스 인스턴스 또는 undefined
 * 
 * @example
 * const sceneManager = getService('scene.sceneManager');
 * const monitoringService = getService('monitoring.monitoringService');
 * const scene = getService('scene'); // 전체 scene 객체
 */
export function getService(path) {
    if (!path) return undefined;
    
    const parts = path.split('.');
    let current = services;
    
    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[part];
    }
    
    return current;
}

/**
 * 서비스 설정 (도트 표기법 지원)
 * 
 * @param {string} path - 서비스 경로 (예: 'scene', 'mapping.equipmentMappingService')
 * @param {*} value - 설정할 값
 * @returns {boolean} 성공 여부
 * 
 * @example
 * setService('scene', sceneManager);
 * setService('mapping.equipmentMappingService', mappingService);
 */
export function setService(path, value) {
    if (!path) return false;
    
    const parts = path.split('.');
    let current = services;
    
    // 마지막 키 전까지 순회
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        
        if (current[part] === null || current[part] === undefined) {
            current[part] = {};
        }
        
        current = current[part];
    }
    
    // 마지막 키에 값 설정
    const lastKey = parts[parts.length - 1];
    current[lastKey] = value;
    
    return true;
}

/**
 * 서비스 존재 여부 확인
 * 
 * @param {string} path - 서비스 경로
 * @returns {boolean}
 * 
 * @example
 * if (hasService('scene.sceneManager')) {
 *     // 3D Scene 사용 가능
 * }
 */
export function hasService(path) {
    const service = getService(path);
    return service !== null && service !== undefined;
}

/**
 * 서비스 초기화 (null로 설정)
 * 
 * @param {string} path - 서비스 경로
 * @returns {boolean}
 * 
 * @example
 * clearService('scene'); // scene 전체 초기화
 * clearService('mapping.equipmentMappingService'); // 특정 서비스만 초기화
 */
export function clearService(path) {
    return setService(path, null);
}

// ============================================
// Screen Manager (SceneController로 대체)
// ============================================

/**
 * screenManager 별칭 (하위 호환)
 * 
 * @deprecated SceneController 사용 권장
 * @description
 * Phase 4에서 scene/SceneController.js로 이관됨
 * 기존 코드 호환을 위해 sceneController를 re-export
 * 
 * @example
 * // 권장 방식
 * import { sceneController } from '../scene/index.js';
 * 
 * // 하위 호환 (deprecated)
 * import { screenManager } from './AppState.js';
 */
export { sceneController as screenManager };

// ============================================
// 전역 노출 (하위 호환)
// ============================================

/**
 * 브라우저 환경에서 전역 접근 지원
 */
if (typeof window !== 'undefined') {
    // 즉시 실행: sidebarState 초기화
    initSidebarState();
    
    // 즉시 실행: window.services 노출
    exposeServicesToWindow();
    
    // viewManager, screenManager 전역 노출 (하위 호환)
    // ⚠️ Phase 4: sceneController 사용 (scene/index.js에서 import)
    window.viewManager = sceneController;   // 하위 호환
    window.screenManager = sceneController; // 새 이름
    
    // APP 네임스페이스에 등록
    window.APP = window.APP || {};
    window.APP.state = window.APP.state || sidebarState;
    window.APP.services = services;
    window.APP.screenManager = sceneController;
}

// ============================================
// 디버그 함수
// ============================================

/**
 * AppState 디버그 정보 출력
 * 
 * @example
 * import { debugAppState } from './app/AppState.js';
 * debugAppState();
 */
export function debugAppState() {
    console.group('🔧 AppState Debug (v1.1.0)');  // 버전 업데이트
    
    console.log('📦 services:');
    console.log('  scene:', hasService('scene') ? '✅ initialized' : '❌ null');
    console.log('  ui:', hasService('ui') ? '✅ initialized' : '❌ null');
    console.log('  monitoring:', hasService('monitoring') ? '✅ initialized' : '❌ null');
    console.log('  mapping.equipmentMappingService:', hasService('mapping.equipmentMappingService') ? '✅' : '❌');
    console.log('  views.viewManager:', hasService('views.viewManager') ? '✅' : '❌');
    
    console.log('\n📊 sidebarState:');
    console.log('  currentMode:', sidebarState?.currentMode || 'null');
    console.log('  currentSubMode:', sidebarState?.currentSubMode || 'null');
    console.log('  isConnected:', sidebarState?.isConnected);
    console.log('  devModeEnabled:', sidebarState?.devModeEnabled);
    console.log('  debugPanelVisible:', sidebarState?.debugPanelVisible);
    
    console.log('\n🖥️ sceneController (screenManager 대체):');
    console.log('  threejsInitialized:', sceneController.threejsInitialized);
    console.log('  animationRunning:', sceneController.animationRunning);
    
    console.log('\n🌐 window 노출:');
    console.log('  window.services:', typeof window !== 'undefined' && window.services === services);
    console.log('  window.sidebarState:', typeof window !== 'undefined' && window.sidebarState === sidebarState);
    console.log('  window.screenManager:', typeof window !== 'undefined' && window.screenManager === sceneController);
    console.log('  window.viewManager:', typeof window !== 'undefined' && window.viewManager === sceneController);
    
    console.groupEnd();
}