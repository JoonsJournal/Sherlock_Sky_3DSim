/**
 * Layout Editor Managers Index
 * 
 * @version 1.1.0
 * @location frontend/threejs_viewer/src/layout-editor/managers/index.js
 */

export { AutoSaveManager, LayoutAutoSaveManager } from './AutoSaveManager.js';
export { RoomSizeManager } from './RoomSizeManager.js';

// 공통 Storage 모듈도 re-export (편의성)
export { storageService } from '../../core/storage/index.js';