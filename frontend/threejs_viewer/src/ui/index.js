/**
 * ui/index.js
 * UI 모듈 통합 export
 * 
 * @version 1.4.0
 * @changelog
 * - v1.4.0: FileControls export 추가
 * - v1.3.0: RecoveryDialog export 추가
 * - v1.2.0: AutoSaveIndicator export 추가
 * - v1.1.0: EquipmentEditButton, ConnectionIndicator export 추가
 */

// =========================================================
// Modals
// =========================================================
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
export { default as FileControls } from './FileControls.js';  // 🆕 추가

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