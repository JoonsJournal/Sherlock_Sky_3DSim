/**
 * ui/index.js
 * UI 모듈 통합 export
 * 
 * @version 1.2.0
 * @changelog
 * - v1.2.0: AutoSaveIndicator export 추가
 * - v1.1.0: EquipmentEditButton, ConnectionIndicator export 추가
 */

// =========================================================
// Modals
// =========================================================
export { ConnectionModal } from './ConnectionModal.js';
export { EquipmentEditModal } from './EquipmentEditModal.js';

// =========================================================
// Buttons / Controllers
// =========================================================
export { EquipmentEditButton } from './EquipmentEditButton.js';

// =========================================================
// Indicators
// =========================================================
export { default as ConnectionIndicator } from './ConnectionIndicator.js';
export { default as AutoSaveIndicator, SaveState } from './AutoSaveIndicator.js';  // 🆕 추가

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
// Legacy (하위 호환성 - 추후 제거 예정)
// =========================================================
// ToastNotification은 Toast로 대체됨
// import { ToastNotification } from './ToastNotification.js';
// export { ToastNotification };