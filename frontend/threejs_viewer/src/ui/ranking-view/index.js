/**
 * ranking-view/index.js
 * =====================
 * Ranking View 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - 모든 Ranking View 관련 모듈 통합 Export
 * - 단일 진입점으로 import 간소화
 * 
 * @changelog
 * - v1.0.0: Phase 1 초기 버전
 *   - RankingView 메인 컨트롤러 export
 *   - Phase 2~6에서 추가 모듈 export 예정
 *   - ⚠️ 호환성: 신규 모듈
 * 
 * @usage
 * ```javascript
 * // 단일 import로 모든 모듈 사용 가능
 * import { RankingView } from '../ui/ranking-view/index.js';
 * 
 * // 또는
 * import { RankingView, RankingLane, EquipmentCard } from '../ui/ranking-view/index.js';
 * ```
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/index.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

// =============================================
// Main Controller
// =============================================
export { RankingView } from './RankingView.js';

// =============================================
// Components (Phase 2에서 추가 예정)
// =============================================
// export { RankingLane } from './components/RankingLane.js';
// export { EquipmentCard } from './components/EquipmentCard.js';
// export { LaneHeader } from './components/LaneHeader.js';
// export { MiniTimeline } from './components/MiniTimeline.js';

// =============================================
// Managers (Phase 3~4에서 추가 예정)
// =============================================
// export { LaneManager } from './managers/LaneManager.js';
// export { AnimationManager } from './managers/AnimationManager.js';
// export { RankingDataManager } from './managers/RankingDataManager.js';
// export { ScrollSyncManager } from './managers/ScrollSyncManager.js';

// =============================================
// Utils (Phase 3~4에서 추가 예정)
// =============================================
// export { LaneSorter } from './utils/LaneSorter.js';
// export { DurationCalculator } from './utils/DurationCalculator.js';
// export { PositionCalculator } from './utils/PositionCalculator.js';
// export { BatchAnimator } from './utils/BatchAnimator.js';

// =============================================
// Constants
// =============================================

/**
 * 레인 타입 상수
 */
export const LANE_TYPES = {
    REMOTE: 'remote',
    SUDDEN_STOP: 'sudden-stop',
    STOP: 'stop',
    RUN: 'run',
    IDLE: 'idle',
    WAIT: 'wait'
};

/**
 * Remote Alarm Code 목록
 * ref.RemoteAlarmList에 정의된 코드
 */
export const REMOTE_ALARM_CODES = new Set([
    61, 62, 86, 10047, 10048, 10051, 
    10052, 10055, 10056, 10057, 10058, 10077
]);

/**
 * 애니메이션 타이밍 상수
 */
export const ANIMATION_TIMING = {
    LANE_MOVE: 400,       // 레인 간 이동 (대각선)
    PUSH_DOWN: 300,       // 밀림 효과
    RANK_CHANGE: 300,     // 같은 레인 내 순위 변경
    ENTER: 300,           // 신규 진입
    LEAVE: 200            // 제거
};

/**
 * 긴급도 임계값 (분)
 */
export const URGENCY_THRESHOLDS = {
    WARNING: 5,           // 노란색 테두리
    DANGER: 10,           // 주황색 테두리 + Pulse
    CRITICAL: 15          // 빨간색 테두리 + 강한 Pulse
};

// =============================================
// Default Export
// =============================================
import { RankingView as DefaultRankingView } from './RankingView.js';
export default DefaultRankingView;