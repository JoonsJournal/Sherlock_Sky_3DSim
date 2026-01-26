/**
 * autosave/index.js
 * ==================
 * AutoSave 모듈 Barrel Export
 * 
 * @version 1.0.0
 * @description
 * - autosave/ 디렉토리의 모든 모듈을 단일 진입점에서 export
 * - main.js 리팩토링 Phase 8
 * 
 * @changelog
 * - v1.0.0: Phase 8 - 초기 생성 (2026-01-26)
 *           - EquipmentAutoSave 모듈 export
 *           - RecoveryDialog 모듈 export
 *           - ⚠️ 호환성: main.js 기존 기능 100% 유지
 * 
 * @exports
 * - EquipmentAutoSave.js: AutoSave 초기화 및 관리
 * - RecoveryDialog.js: 복구 다이얼로그 UI
 * 
 * 📁 위치: frontend/threejs_viewer/src/autosave/index.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

// ============================================
// EquipmentAutoSave - 자동 저장 관리 (Phase 8.3)
// ============================================
export {
    initEquipmentAutoSave,
    stopEquipmentAutoSave,
    getAutoSaveStatus,
    triggerManualAutoSave
} from './EquipmentAutoSave.js';

// ============================================
// RecoveryDialog - 복구 다이얼로그 UI (Phase 8.4)
// ============================================
export {
    showEquipmentRecoveryDialog,
    closeEquipmentRecoveryDialog,
    isRecoveryDialogOpen
} from './RecoveryDialog.js';

// ============================================
// 통합 디버그 함수
// ============================================

import { getAutoSaveStatus } from './EquipmentAutoSave.js';
import { isRecoveryDialogOpen } from './RecoveryDialog.js';

/**
 * AutoSave 모듈 디버그 정보 출력
 * 
 * @example
 * import { debugAutoSaveModule } from './autosave/index.js';
 * debugAutoSaveModule();
 */
export function debugAutoSaveModule() {
    console.group('💾 AutoSave Module Debug (v1.0.0)');
    
    const status = getAutoSaveStatus();
    console.log('AutoSave Status:', status);
    console.log('Recovery Dialog Open:', isRecoveryDialogOpen());
    
    console.groupEnd();
}