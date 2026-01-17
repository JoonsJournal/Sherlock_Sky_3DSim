/**
 * managers/index.js
 * =================
 * Ranking View 매니저 모듈 Barrel Export
 * 
 * @version 1.1.0
 * @description Ranking View 관련 매니저들의 중앙 export 파일
 * 
 * @changelog
 * - v1.1.0: 🆕 LaneManager 추가 (2026-01-17) - Phase 5
 *   - 레인 포커스 및 카드 네비게이션 관리
 *   - ⚠️ 호환성: 기존 모든 export 100% 유지
 * - v1.0.0: 초기 버전
 *   - RankingDataManager export
 *   - AnimationManager export
 *   - ScrollSyncManager export
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

// 기존 매니저들
export { RankingDataManager } from './RankingDataManager.js';
export { AnimationManager } from './AnimationManager.js';
export { ScrollSyncManager } from './ScrollSyncManager.js';

// 🆕 v1.1.0: LaneManager 추가 (Phase 5)
export { LaneManager } from './LaneManager.js';

// Default export
export default {
    RankingDataManager: () => import('./RankingDataManager.js'),
    AnimationManager: () => import('./AnimationManager.js'),
    ScrollSyncManager: () => import('./ScrollSyncManager.js'),
    LaneManager: () => import('./LaneManager.js')  // 🆕 v1.1.0
};