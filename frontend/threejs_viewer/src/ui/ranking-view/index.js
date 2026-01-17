/**
 * ranking-view/index.js
 * =====================
 * Ranking View 모듈 Barrel Export
 * 
 * @version 1.1.0
 * @description
 * - Phase 2: 모든 Ranking View 관련 모듈 통합 Export
 * - Components, Managers, Utils 포함
 * 
 * @changelog
 * - v1.1.0: Phase 2 - Components 추가
 * - v1.0.0: Phase 1 - 초기 구조
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

// Main Controller
export { RankingView } from './RankingView.js';

// Components (Phase 2)
export { EquipmentCard } from './components/EquipmentCard.js';
export { RankingLane } from './components/RankingLane.js';
export { LaneHeader } from './components/LaneHeader.js';

// Managers (Phase 3-4에서 추가 예정)
// export { LaneManager } from './managers/LaneManager.js';
// export { AnimationManager } from './managers/AnimationManager.js';
// export { RankingDataManager } from './managers/RankingDataManager.js';
// export { ScrollSyncManager } from './managers/ScrollSyncManager.js';

// Utils (Phase 3-4에서 추가 예정)
// export { LaneSorter } from './utils/LaneSorter.js';
// export { DurationCalculator } from './utils/DurationCalculator.js';
// export { PositionCalculator } from './utils/PositionCalculator.js';
// export { BatchAnimator } from './utils/BatchAnimator.js';

// Re-export all components for convenience
export * from './components/index.js';