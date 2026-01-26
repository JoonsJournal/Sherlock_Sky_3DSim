/**
 * EquipmentAutoSave.js
 * =====================
 * Equipment 자동 저장 관리 모듈
 * 
 * @version 1.0.0
 * @description
 * - Equipment 매핑 데이터 자동 저장 초기화
 * - AutoSave 이벤트 핸들링
 * - main.js에서 분리된 initEquipmentAutoSave() 함수
 * 
 * @changelog
 * - v1.0.0: Phase 8 - main.js에서 분리 (2026-01-26)
 *           - initEquipmentAutoSave() 함수 이동
 *           - AutoSave 이벤트 핸들러 이동
 *           - ⚠️ 호환성: 기존 기능 100% 유지
 * 
 * @dependencies
 * - ../core/storage/index.js (storageService)
 * - ../core/managers/EventBus.js
 * - ../app/AppConfig.js (SITE_ID)
 * - ./RecoveryDialog.js
 * 
 * @exports
 * - initEquipmentAutoSave
 * - stopEquipmentAutoSave
 * - getAutoSaveStatus
 * 
 * 📁 위치: frontend/threejs_viewer/src/autosave/EquipmentAutoSave.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

import { storageService } from '../core/storage/index.js';
import { eventBus } from '../core/managers/EventBus.js';
import { SITE_ID } from '../app/AppConfig.js';
import { showEquipmentRecoveryDialog } from './RecoveryDialog.js';

// ============================================
// 모듈 상태
// ============================================
let _autoSaveInitialized = false;
let _boundEventHandlers = {};

/**
 * Equipment AutoSave 초기화
 * 
 * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
 * @param {Object} [options] - 초기화 옵션
 * @param {string} [options.siteId] - Site ID (기본값: SITE_ID)
 * @param {Object} [options.storage] - Storage 서비스 (기본값: storageService)
 * @param {Object} [options.eventBus] - EventBus 인스턴스 (기본값: global eventBus)
 */
export function initEquipmentAutoSave(equipmentEditState, options = {}) {
    if (!equipmentEditState) {
        console.warn('[EquipmentAutoSave] EquipmentEditState가 없습니다. AutoSave 건너뜀.');
        return;
    }
    
    const {
        siteId = SITE_ID,
        storage = storageService,
        eventBus: eb = eventBus
    } = options;
    
    // ─────────────────────────────────────────────────────────────
    // 1. 이전 세션 AutoSave 데이터 확인 및 복구 다이얼로그 표시
    // ─────────────────────────────────────────────────────────────
    const recoveryData = equipmentEditState.checkAutoSaveRecovery(storage);
    
    if (recoveryData) {
        showEquipmentRecoveryDialog(recoveryData, {
            onApply: () => {
                equipmentEditState.applyAutoSaveRecovery(recoveryData);
                equipmentEditState.clearAutoSaveRecovery(storage);
                window.showToast?.('✅ Equipment 매핑 복구 완료!', 'success');
            },
            onDiscard: () => {
                equipmentEditState.clearAutoSaveRecovery(storage);
                window.showToast?.('AutoSave 데이터 삭제됨', 'info');
            }
        });
    }
    
    // ─────────────────────────────────────────────────────────────
    // 2. AutoSave 초기화
    // ─────────────────────────────────────────────────────────────
    equipmentEditState.initAutoSave(storage, siteId);
    
    // ─────────────────────────────────────────────────────────────
    // 3. AutoSave 이벤트 핸들러 등록
    // ─────────────────────────────────────────────────────────────
    _boundEventHandlers.onAutoSaveComplete = (data) => {
        if (data.namespace === 'equipment') {
            console.log('[Equipment AutoSave] 저장 완료:', data.timestamp);
        }
    };
    
    _boundEventHandlers.onAutoSaveError = (data) => {
        if (data.namespace === 'equipment') {
            console.error('[Equipment AutoSave] 저장 실패:', data.error);
            window.showToast?.('⚠️ Equipment AutoSave 실패', 'warning');
        }
    };
    
    eb.on('autosave:complete', _boundEventHandlers.onAutoSaveComplete);
    eb.on('autosave:error', _boundEventHandlers.onAutoSaveError);
    
    _autoSaveInitialized = true;
    console.log(`✅ Equipment AutoSave 초기화 완료 - siteId: ${siteId}`);
}

/**
 * Equipment AutoSave 중지
 * 
 * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
 */
export function stopEquipmentAutoSave(equipmentEditState) {
    if (!_autoSaveInitialized) {
        return;
    }
    
    // 이벤트 핸들러 제거
    if (_boundEventHandlers.onAutoSaveComplete) {
        eventBus.off('autosave:complete', _boundEventHandlers.onAutoSaveComplete);
    }
    if (_boundEventHandlers.onAutoSaveError) {
        eventBus.off('autosave:error', _boundEventHandlers.onAutoSaveError);
    }
    
    // AutoSave 중지
    if (equipmentEditState) {
        equipmentEditState.stopAutoSave?.();
    }
    
    _boundEventHandlers = {};
    _autoSaveInitialized = false;
    
    console.log('🗑️ Equipment AutoSave 중지됨');
}

/**
 * AutoSave 상태 확인
 * 
 * @returns {Object} 상태 정보
 */
export function getAutoSaveStatus() {
    return {
        initialized: _autoSaveInitialized,
        siteId: SITE_ID,
        hasEventHandlers: Object.keys(_boundEventHandlers).length > 0
    };
}

/**
 * AutoSave 수동 트리거
 * 
 * @param {Object} equipmentEditState - EquipmentEditState 인스턴스
 * @returns {boolean} 트리거 성공 여부
 */
export function triggerManualAutoSave(equipmentEditState) {
    if (!equipmentEditState) {
        console.warn('[EquipmentAutoSave] EquipmentEditState가 없습니다.');
        return false;
    }
    
    if (typeof equipmentEditState.triggerAutoSave === 'function') {
        equipmentEditState.triggerAutoSave();
        console.log('[Equipment AutoSave] 수동 트리거 완료');
        return true;
    }
    
    console.warn('[EquipmentAutoSave] triggerAutoSave 메서드를 찾을 수 없습니다.');
    return false;
}