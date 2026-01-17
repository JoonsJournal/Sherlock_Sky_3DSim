/**
 * ranking-view/managers/index.js
 * ==============================
 * Ranking View 매니저 Barrel Export
 * 
 * @version 1.1.0
 * @description
 * - 모든 Ranking View 매니저 통합 Export
 * 
 * @changelog
 * - v1.1.0: Phase 3 매니저 추가
 *   - RankingDataManager: 데이터 가공 및 레인 할당
 * - v1.0.0: 초기 생성
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

// Phase 3: 데이터 매니저
export { RankingDataManager } from './RankingDataManager.js';

// Phase 4 예정: 애니메이션 매니저
// export { AnimationManager } from './AnimationManager.js';

// Phase 5 예정: 레인 매니저, 스크롤 매니저
// export { LaneManager } from './LaneManager.js';
// export { ScrollSyncManager } from './ScrollSyncManager.js';