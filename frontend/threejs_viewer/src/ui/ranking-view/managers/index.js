/**
 * ranking-view/managers/index.js
 * ==============================
 * Ranking View Managers Barrel Export
 * 
 * @version 1.1.0
 * @description
 * - 모든 Ranking View 매니저 모듈 통합 Export
 * 
 * @changelog
 * - v1.1.0: Phase 4 애니메이션 매니저 추가
 *   - AnimationManager export 추가
 *   - ScrollSyncManager export 추가
 *   - ⚠️ 호환성: 기존 export 100% 유지
 * - v1.0.0: 초기 버전
 *   - RankingDataManager export
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

// Data Manager
export { RankingDataManager } from './RankingDataManager.js';

// Animation Manager (Phase 4)
export { AnimationManager } from './AnimationManager.js';

// Scroll Sync Manager (Phase 4)
export { ScrollSyncManager } from './ScrollSyncManager.js';