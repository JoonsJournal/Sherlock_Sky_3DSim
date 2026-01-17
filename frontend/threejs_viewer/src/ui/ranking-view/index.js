/**
 * ranking-view/index.js
 * =====================
 * Ranking View 모듈 Barrel Export
 * 
 * @version 1.2.0
 * @description
 * - 모든 Ranking View 관련 모듈 통합 Export
 * 
 * @changelog
 * - v1.2.0: Phase 3 모듈 추가
 *   - RankingDataManager: 데이터 가공/레인 할당
 *   - LaneSorter: 레인별 정렬 유틸
 *   - DurationCalculator: 시간 계산 유틸
 * - v1.1.0: Phase 2 컴포넌트 추가
 * - v1.0.0: 초기 생성
 * 
 * @exports
 * - RankingView (메인 컨트롤러)
 * - RankingLane, EquipmentCard, LaneHeader (컴포넌트)
 * - RankingDataManager (매니저)
 * - LaneSorter, DurationCalculator (유틸리티)
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

// =========================================================================
// Main Controller
// =========================================================================
export { RankingView } from './RankingView.js';

// =========================================================================
// Components (Phase 1-2)
// =========================================================================
export { RankingLane } from './components/RankingLane.js';
export { EquipmentCard } from './components/EquipmentCard.js';
export { LaneHeader } from './components/LaneHeader.js';
// export { MiniTimeline } from './components/MiniTimeline.js'; // Phase 6 예정

// =========================================================================
// Managers (Phase 3+)
// =========================================================================
export { RankingDataManager } from './managers/RankingDataManager.js';
// export { LaneManager } from './managers/LaneManager.js';           // Phase 5 예정
// export { AnimationManager } from './managers/AnimationManager.js'; // Phase 4 예정
// export { ScrollSyncManager } from './managers/ScrollSyncManager.js'; // Phase 5 예정

// =========================================================================
// Utils (Phase 3+)
// =========================================================================
export { LaneSorter } from './utils/LaneSorter.js';
export { DurationCalculator } from './utils/DurationCalculator.js';
// export { PositionCalculator } from './utils/PositionCalculator.js'; // Phase 4 예정
// export { BatchAnimator } from './utils/BatchAnimator.js';           // Phase 4 예정