/**
 * ui/common/index.js
 * ===================
 * 공통 UI 컴포넌트 Barrel Export
 * 
 * @version 1.1.0
 * @changelog
 * - v1.1.0: 🆕 BaseView 추상 클래스 추가
 *   - BaseView: View 공통 인터페이스
 *   - VIEW_STATE: View 상태 상수
 * - v1.0.0: 초기 버전
 *   - Toast, Button, Dropdown, Tooltip, ContextMenu
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/common/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-18
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 v1.1.0: BaseView 추상 클래스
// ═══════════════════════════════════════════════════════════════════════════

export { BaseView, VIEW_STATE } from './BaseView.js';

// ═══════════════════════════════════════════════════════════════════════════
// 기본 UI 컴포넌트
// ═══════════════════════════════════════════════════════════════════════════

// Toast
export { Toast, getToast, toast } from './Toast.js';

// Button
export { Button, createButton } from './Button.js';

// Dropdown
export { Dropdown } from './Dropdown.js';

// Tooltip
export { Tooltip, addTooltip } from './Tooltip.js';

// ContextMenu
export { ContextMenu, bindContextMenu } from './ContextMenu.js';