/**
 * sidebar/index.js
 * ================
 * SHERLOCK SKY 3DSim - Cleanroom Sidebar 모듈 진입점
 * 
 * 사이드바 관련 모든 컴포넌트를 하나의 import로 사용
 * 
 * @version 1.0.0
 * @created 2026-01-10
 * 
 * 사용법:
 * import { Sidebar, SidebarButton, StatusBar } from './sidebar/index.js';
 * 
 * // 사이드바 생성
 * const sidebar = new Sidebar(document.body, {
 *     initialMode: 'connection'
 * });
 * 
 * // 모드 변경 이벤트
 * sidebar.on('modeChange', (mode, id) => {
 *     console.log(`Mode changed to: ${mode}`);
 * });
 * 
 * // 상태바 생성
 * const statusBar = new StatusBar(document.body, {
 *     username: 'Admin'
 * });
 */

export { Sidebar } from './Sidebar.js';
export { SidebarButton } from './SidebarButton.js';
export { StatusBar, STATUS_TYPES } from './StatusBar.js';

// 기본 export는 Sidebar
export { Sidebar as default } from './Sidebar.js';
