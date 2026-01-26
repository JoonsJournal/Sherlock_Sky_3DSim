/**
 * main.js
 * =======
 * 
 * 메인 애플리케이션 진입점 (최소화 버전)
 * 
 * @version 9.0.0
 * @changelog
 * - v9.0.0: 🔧 Phase 11 - 최종 main.js 리팩토링 (2026-01-26)
 *           - 430줄 → 95줄 (77% 감소)
 *           - 모든 Import를 AppInitializer.js로 위임
 *           - main.js는 순수 진입점 역할만 담당
 *           - ⚠️ 호환성: 모든 기능 100% 유지
 * - v8.5.0: Phase 10 - AppInitializer 분리
 *           - init() 함수 → AppInitializer.js로 이동
 *           - 7단계 초기화 프로세스 모듈화
 * - v8.4.0: Phase 9 - 하위 호환 및 전역 노출 분리
 *           - 하위 호환 헬퍼 → compat/LegacyHelpers.js
 *           - 전역 노출 → compat/LegacyGlobals.js
 * - v8.3.0: Phase 8 - Mapping 및 AutoSave 분리
 *           - initMappingServices() → mapping/MappingInitializer.js
 *           - initEquipmentAutoSave() → autosave/EquipmentAutoSave.js
 * - v8.2.0: Phase 7 - UDS 및 Connection 이벤트 분리
 *           - setupConnectionEvents() → connection/ConnectionEventHandler.js
 *           - _initializeUDSAfterConnection() → uds/UDSInitializer.js
 * - v8.1.0: Phase 6 - 재연결 복구 분리
 *           - setupReconnectionHandler() → connection/ReconnectionHandler.js
 * - v8.0.0: Phase 4 - Scene 관리 분리
 *           - initThreeJSScene() → scene/SceneController.js
 * - v7.4.0: Phase 3 - 유틸리티 함수 분리
 *           - showToast, toggleTheme → app/AppUtils.js
 * - v7.3.0: Phase 2 - 전역 상태 관리 분리
 *           - services 객체 → app/AppState.js
 * - v7.2.0: Phase 1 - AppConfig 모듈 분리
 *           - SITE_ID, RECOVERY_STRATEGIES → app/AppConfig.js
 * - v7.1.2: StatusBar Stats 형식 수정
 * - v7.1.0: UDS (Unified Data Store) 통합
 * - v7.0.0: NavigationController 통합
 * - v6.4.0: View 전환 조율 로직 추가
 * - v6.3.0: Phase 4 - Legacy 전역 변수 마이그레이션
 * - v6.2.0: Phase 3 - Deprecation 경고 시스템
 * - v6.1.0: Phase 2 전역 함수 마이그레이션
 * - v6.0.0: AppNamespace 통합
 * - v5.7.0: ViewManager 패턴 도입
 * - v5.6.0: 매핑 로드 "API 우선" 전략 적용
 * - v5.5.0: EquipmentMappingService 통합
 * - v5.4.0: 재연결 복구 로직 추가
 * - v5.3.1: Monitoring 모드 서비스 타이밍 보정
 * - v5.0.0: Cleanroom Sidebar Theme 통합
 * 
 * @description
 * - 애플리케이션의 단일 진입점
 * - AppInitializer에 모든 초기화 로직 위임
 * - 페이지 정리(cleanup) 이벤트 핸들링
 * 
 * @dependencies
 * - ./app/index.js: AppInitializer 싱글톤
 * 
 * @exports 없음 (진입점 파일)
 * 
 * 📁 위치: frontend/threejs_viewer/src/main.js
 * 작성일: 2026-01-16
 * 수정일: 2026-01-26
 */


// ============================================
// 필수 Import (AppInitializer만 필요)
// ============================================

/**
 * AppInitializer - 모든 초기화 로직을 담당하는 오케스트레이터
 * 
 * AppInitializer가 내부에서 처리하는 모듈들:
 * ┌─────────────────────────────────────────────────┐
 * │ Bootstrap                                       │
 * │  ├─ CoreBootstrap (Core Managers)               │
 * │  ├─ UIBootstrap (UI Components)                 │
 * │  ├─ SceneBootstrap (Three.js Scene)             │
 * │  ├─ ViewBootstrap (ViewManager)                 │
 * │  └─ EventBootstrap (Event Listeners)            │
 * ├─────────────────────────────────────────────────┤
 * │ App                                             │
 * │  ├─ AppConfig (SITE_ID, 설정)                   │
 * │  ├─ AppState (services, sidebarState)           │
 * │  └─ AppUtils (showToast, toggleTheme)           │
 * ├─────────────────────────────────────────────────┤
 * │ Scene                                           │
 * │  └─ SceneController (Three.js 관리)             │
 * ├─────────────────────────────────────────────────┤
 * │ Modes                                           │
 * │  ├─ ModeIndicator (모드 표시)                   │
 * │  └─ ModeToggler (Edit/Monitoring 토글)          │
 * ├─────────────────────────────────────────────────┤
 * │ Connection                                      │
 * │  ├─ ConnectionEventHandler (연결 이벤트)        │
 * │  └─ ReconnectionHandler (재연결 복구)           │
 * ├─────────────────────────────────────────────────┤
 * │ UDS (Unified Data Store)                        │
 * │  ├─ UDSInitializer (초기화)                     │
 * │  └─ UDSEventHandlers (이벤트)                   │
 * ├─────────────────────────────────────────────────┤
 * │ Mapping                                         │
 * │  ├─ MappingInitializer (서비스 초기화)          │
 * │  └─ MappingLoader (데이터 로드)                 │
 * ├─────────────────────────────────────────────────┤
 * │ AutoSave                                        │
 * │  ├─ EquipmentAutoSave (자동 저장)               │
 * │  └─ RecoveryDialog (복구 다이얼로그)            │
 * ├─────────────────────────────────────────────────┤
 * │ Compat (하위 호환)                              │
 * │  ├─ LegacyGlobals (전역 객체 노출)              │
 * │  └─ LegacyHelpers (레거시 헬퍼)                 │
 * └─────────────────────────────────────────────────┘
 */
import { appInitializer } from './app/index.js';


// ============================================
// 정리 (Cleanup)
// ============================================

/**
 * 페이지 종료 시 정리 함수
 * 
 * AppInitializer의 cleanup() 메서드에 위임하여 다음을 정리:
 * - Connection 모듈 (WebSocket, 재연결 핸들러)
 * - ViewManager (모든 View 인스턴스)
 * - Equipment AutoSave (자동 저장 중지)
 * - EquipmentInfoPanel (리소스 해제)
 * - Animation Loop (렌더링 중지)
 * - Sidebar UI (이벤트 리스너 해제)
 * - Bootstrap cleanup (전체 정리)
 * 
 * @returns {void}
 */
function handleCleanup() {
    appInitializer.cleanup();
}

// beforeunload 이벤트 등록
// 페이지 새로고침, 탭 닫기, 브라우저 종료 시 실행됨
window.addEventListener('beforeunload', handleCleanup);


// ============================================
// 초기화 실행
// ============================================

/**
 * 애플리케이션 초기화 시작
 * 
 * AppInitializer가 7단계 초기화를 자동 수행:
 * 
 * ┌───────────────────────────────────────────────────────────┐
 * │ Phase 1: 네임스페이스 초기화                               │
 * │   - AppNamespace 초기화 (window.APP)                      │
 * │   - APP.config 등록 (SITE_ID, 설정)                       │
 * │   - APP.state ↔ sidebarState 동기화                       │
 * ├───────────────────────────────────────────────────────────┤
 * │ Phase 2: Core Managers 초기화                             │
 * │   - AppModeManager (모드 관리)                            │
 * │   - KeyboardManager (단축키)                              │
 * │   - DebugManager (디버그)                                 │
 * │   - EventBus (이벤트 버스)                                │
 * │   - Logger (로깅)                                         │
 * ├───────────────────────────────────────────────────────────┤
 * │ Phase 3: UI Components 초기화                             │
 * │   - ConnectionStatusService                               │
 * │   - ConnectionModal                                       │
 * │   - EquipmentInfoPanel                                    │
 * │   - EquipmentEditState/Modal/Button                       │
 * │   - ApiClient                                             │
 * ├───────────────────────────────────────────────────────────┤
 * │ Phase 4: Sidebar UI 초기화                                │
 * │   - Sidebar (메인 네비게이션)                             │
 * │   - StatusBar (상태 표시줄)                               │
 * │   - CoverScreen (커버 화면)                               │
 * │   - ModeToggler 참조 연결                                 │
 * ├───────────────────────────────────────────────────────────┤
 * │ Phase 5: SceneController 설정                             │
 * │   - screenManager 참조 설정                               │
 * │   - 토글 함수 전역 노출                                   │
 * │   - SceneController Bootstrap 사전 설정                   │
 * │   - Placeholder 함수 등록                                 │
 * ├───────────────────────────────────────────────────────────┤
 * │ Phase 6: 서비스 및 이벤트 설정                            │
 * │   - ViewManager 초기화                                    │
 * │   - EquipmentEditButton 연동                              │
 * │   - Equipment AutoSave 초기화                             │
 * │   - Connection 이벤트 설정                                │
 * │   - NavigationController 이벤트 설정                      │
 * │   - UI/Keyboard 이벤트 리스너 설정                        │
 * ├───────────────────────────────────────────────────────────┤
 * │ Phase 7: 전역 노출 및 완료                                │
 * │   - window.* 전역 객체 노출 (하위 호환)                   │
 * │   - Deprecation 래퍼 적용                                 │
 * │   - 초기화 완료 이벤트 발생                               │
 * │   - 디버그 패널 업데이트 인터벌                           │
 * └───────────────────────────────────────────────────────────┘
 * 
 * 초기화 완료 후 콘솔에 다음 메시지 표시:
 * - '✅ 모든 초기화 완료!'
 * - 키보드 단축키 안내
 * - Deprecation 경고 설정 안내
 */
appInitializer.init();


// ============================================
// 디버그 정보 (개발 모드용)
// ============================================

/**
 * main.js 디버그 정보 출력
 * 
 * 콘솔에서 앱 상태를 빠르게 확인할 때 사용:
 * - appInitializer 인스턴스 참조
 * - 초기화 완료 여부
 * - 현재 초기화 단계
 * - SidebarUI 인스턴스
 * 
 * @example
 * // 브라우저 콘솔에서 실행
 * window.debugMainJS();
 * 
 * @example
 * // 출력 예시
 * // 📦 main.js v9.0.0 Debug
 * //   appInitializer: AppInitializer {...}
 * //   initialized: true
 * //   currentPhase: 'Phase7_GlobalExposeAndFinish'
 * //   sidebarUI: {...}
 */
window.debugMainJS = () => {
    console.group('📦 main.js v9.0.0 Debug');
    console.log('appInitializer:', appInitializer);
    console.log('initialized:', appInitializer.isInitialized());
    console.log('currentPhase:', appInitializer.getCurrentPhase());
    console.log('sidebarUI:', appInitializer.getSidebarUI());
    console.log('');
    console.log('💡 상세 정보 확인:');
    console.log('  APP.services.* - 등록된 서비스');
    console.log('  APP.managers.* - 매니저들');
    console.log('  APP.fn.* - 전역 함수');
    console.log('  APP.debug() - 전체 네임스페이스 덤프');
    console.log('');
    console.log('🔧 개별 모듈 디버그:');
    console.log('  debugAppConfig() - 설정 확인');
    console.log('  debugAppState() - 상태 확인');
    console.log('  debugAppUtils() - 유틸리티 확인');
    console.log('  debugAppInitializer() - 초기화 확인');
    console.groupEnd();
};


/**
 * 간단 상태 확인 함수
 * 
 * 앱의 핵심 상태를 한 줄로 빠르게 확인
 * 
 * @example
 * window.quickStatus();
 * // → "✅ main.js v9.0.0 | initialized: true | phase: Phase7_GlobalExposeAndFinish"
 */
window.quickStatus = () => {
    const status = appInitializer.isInitialized() ? '✅' : '❌';
    const phase = appInitializer.getCurrentPhase() || 'N/A';
    console.log(`${status} main.js v9.0.0 | initialized: ${appInitializer.isInitialized()} | phase: ${phase}`);
};


// ============================================
// 개발 모드 메시지
// ============================================

// 로컬 개발 환경에서만 로드 메시지 표시
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.log('💡 main.js v9.0.0 로드됨 (Phase 11 최적화)');
    console.log('   디버그: window.debugMainJS()');
    console.log('   상태: window.quickStatus()');
} else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('💡 main.js v9.0.0 로드됨 (Phase 11 최적화)');
    console.log('   디버그: window.debugMainJS()');
}