/**
 * managers/index.js
 * =================
 * Ranking View 매니저 모듈 Barrel Export
 * 
 * @version 1.2.0
 * @description Ranking View 관련 매니저들의 중앙 export 파일
 * 
 * @changelog
 * - v1.2.0 (2026-01-19): 가이드라인 준수 업데이트
 *   - 📝 @exports 문서화 추가
 *   - ⚠️ 호환성: v1.1.0의 모든 export 100% 유지
 * - v1.1.0 (2026-01-17): 🆕 LaneManager 추가 - Phase 5
 *   - 레인 포커스 및 카드 네비게이션 관리
 *   - ⚠️ 호환성: 기존 모든 export 100% 유지
 * - v1.0.0: 초기 버전
 *   - RankingDataManager export
 *   - AnimationManager export
 *   - ScrollSyncManager export
 * 
 * @exports
 * - RankingDataManager : 랭킹 데이터 관리 매니저
 * - AnimationManager   : 애니메이션 관리 매니저
 * - ScrollSyncManager  : 스크롤 동기화 매니저
 * - LaneManager        : 레인 관리 매니저 (v1.1.0+)
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/managers/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-19
 */

// =============================================
// Named Exports (기존 매니저들)
// =============================================
export { RankingDataManager } from './RankingDataManager.js';
export { AnimationManager } from './AnimationManager.js';
export { ScrollSyncManager } from './ScrollSyncManager.js';

// =============================================
// 🆕 v1.1.0: LaneManager 추가 (Phase 5)
// =============================================
export { LaneManager } from './LaneManager.js';

// =============================================
// Default Export (동적 import 지원)
// =============================================
export default {
    RankingDataManager: () => import('./RankingDataManager.js'),
    AnimationManager: () => import('./AnimationManager.js'),
    ScrollSyncManager: () => import('./ScrollSyncManager.js'),
    LaneManager: () => import('./LaneManager.js')
};