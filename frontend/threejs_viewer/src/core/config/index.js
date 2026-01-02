/**
 * config/index.js
 * Config 모듈 통합 export
 * 
 * @version 1.0.0
 */

// Constants
export * from './constants.js';

// Theme (Colors)
export * from './theme.js';

// Shortcuts
export * from './shortcuts.js';

// Settings
export * from './settings.js';

// 기본 export 객체 (편의용)
export { SETTINGS as default } from './settings.js';