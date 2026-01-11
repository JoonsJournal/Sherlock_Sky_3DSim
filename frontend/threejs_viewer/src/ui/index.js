/**
 * ui/index.js
 * UI 모듈 통합 export
 * 
 * @version 1.5.0
 * @changelog
 * - v1.5.0: 🔧 Sidebar 모듈 re-export 추가, ConnectionModal deprecated 표시
 * - v1.4.0: FileControls export 추가
 * - v1.3.0: RecoveryDialog export 추가
 * - v1.2.0: AutoSaveIndicator export 추가
 * - v1.1.0: EquipmentEditButton, ConnectionIndicator export 추가
 */

// =========================================================================
// 🆕 Phase 6: Equipment Info 관련 추가
// =========================================================================

// Equipment Info Panel (메인)
export { EquipmentInfoPanel } from './EquipmentInfoPanel.js';

// Equipment Info 서브 모듈 (선택적 re-export)
export {
    // Utils
    DurationTimer,
    DataFormatter,
    DataCache,
    mergeEquipmentData,
    
    // Components
    GaugeRenderer,
    HeaderStatus,
    
    // Tabs
    GeneralTab,
    PCInfoTab
} from './equipment-info/index.js';

// =========================================================
// Modals
// =========================================================

/**
 * @deprecated v2.1.0 - Use Sidebar.openConnectionModal() instead
 * ConnectionModal은 더 이상 사용되지 않습니다.
 * Sidebar.js의 ConnectionModalManager.js로 대체되었습니다.
 * 
 * 마이그레이션:
 * - import { Sidebar } from './ui/sidebar/index.js';
 * - sidebar.openConnectionModal();
 */
export { ConnectionModal } from './ConnectionModal.js';

export { EquipmentEditModal } from './EquipmentEditModal.js';

// =========================================================
// Dialogs
// =========================================================
export { default as RecoveryDialog } from './RecoveryDialog.js';

// =========================================================
// Buttons / Controllers
// =========================================================
export { EquipmentEditButton } from './EquipmentEditButton.js';

// =========================================================
// File Management
// =========================================================
export { default as FileControls } from './FileControls.js';

// =========================================================
// Indicators
// =========================================================
export { default as ConnectionIndicator } from './ConnectionIndicator.js';
export { default as AutoSaveIndicator, SaveState } from './AutoSaveIndicator.js';

// =========================================================
// Panels
// =========================================================
export { ConnectionStatusPanel } from './ConnectionStatusPanel.js';
export { DatabaseListPanel } from './DatabaseListPanel.js';
export { SiteSelectionPanel } from './SiteSelectionPanel.js';

// =========================================================
// Common Components
// =========================================================
export * from './common/index.js';

// =========================================================
// Debug Components
// =========================================================
export * from './debug/index.js';

// =========================================================
// 🆕 v1.5.0: Sidebar Module Re-export
// =========================================================

/**
 * Sidebar 모듈 전체 re-export
 * 
 * 포함 컴포넌트:
 * - Sidebar: 메인 사이드바
 * - StatusBar: 하단 상태바
 * - CoverScreen: 커버 스크린
 * - ConnectionModalManager: Connection Modal 관리자
 * - SidebarConfig: 설정/상수
 * - SidebarButtonFactory: 버튼 생성 유틸리티
 * - SidebarSubmenuFactory: 서브메뉴 생성 유틸리티
 * - IconRegistry: 아이콘 레지스트리
 * - createSidebarUI: 통합 생성 헬퍼
 */
export * from './sidebar/index.js';