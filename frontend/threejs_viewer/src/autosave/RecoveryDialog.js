/**
 * RecoveryDialog.js
 * ==================
 * Equipment AutoSave 복구 다이얼로그 모듈
 * 
 * @version 1.0.0
 * @description
 * - AutoSave 복구 다이얼로그 UI 생성 및 관리
 * - 복구/삭제 액션 처리
 * - main.js에서 분리된 showEquipmentRecoveryDialog() 함수
 * 
 * @changelog
 * - v1.0.0: Phase 8 - main.js에서 분리 (2026-01-26)
 *           - showEquipmentRecoveryDialog() 함수 이동
 *           - 콜백 기반 인터페이스로 변경
 *           - ⚠️ 호환성: 기존 기능 100% 유지
 * 
 * @dependencies
 * - 없음 (순수 DOM 조작)
 * 
 * @exports
 * - showEquipmentRecoveryDialog
 * - closeEquipmentRecoveryDialog
 * 
 * 📁 위치: frontend/threejs_viewer/src/autosave/RecoveryDialog.js
 * 작성일: 2026-01-26
 * 수정일: 2026-01-26
 */

// ============================================
// CSS 클래스 상수
// ============================================
const CSS = {
    DIALOG_ID: 'equipment-recovery-dialog',
    APPLY_BTN_ID: 'recovery-apply-btn',
    DISCARD_BTN_ID: 'recovery-discard-btn'
};

/**
 * Equipment AutoSave 복구 다이얼로그 표시
 * 
 * @param {Object} recoveryData - 복구 데이터
 * @param {Object} recoveryData._autoSave - AutoSave 메타데이터
 * @param {number} [recoveryData.mappingCount] - 매핑 개수
 * @param {Object} [recoveryData.mappings] - 매핑 데이터
 * @param {Object} callbacks - 콜백 함수
 * @param {Function} callbacks.onApply - 복구 버튼 클릭 시 콜백
 * @param {Function} callbacks.onDiscard - 삭제 버튼 클릭 시 콜백
 */
export function showEquipmentRecoveryDialog(recoveryData, callbacks = {}) {
    const { onApply, onDiscard } = callbacks;
    
    // ─────────────────────────────────────────────────────────────
    // 1. 복구 데이터 파싱
    // ─────────────────────────────────────────────────────────────
    const autoSaveMeta = recoveryData._autoSave;
    const savedAt = autoSaveMeta?.savedAt 
        ? new Date(autoSaveMeta.savedAt) 
        : new Date();
    const mappingCount = recoveryData.mappingCount 
        || Object.keys(recoveryData.mappings || {}).length;
    
    // ─────────────────────────────────────────────────────────────
    // 2. 경과 시간 계산
    // ─────────────────────────────────────────────────────────────
    const diffMs = Date.now() - savedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    let timeAgo = '방금 전';
    if (diffMins >= 60) {
        timeAgo = `${diffHours}시간 전`;
    } else if (diffMins >= 1) {
        timeAgo = `${diffMins}분 전`;
    }
    
    // ─────────────────────────────────────────────────────────────
    // 3. 다이얼로그 DOM 생성
    // ─────────────────────────────────────────────────────────────
    const dialog = document.createElement('div');
    dialog.id = CSS.DIALOG_ID;
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        ">
            <h3 style="margin: 0 0 16px 0; color: #2c3e50; font-size: 18px;">
                🔄 저장되지 않은 Equipment 매핑 발견
            </h3>
            
            <div style="
                background: #f8f9fa;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
            ">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #6c757d;">저장 시간:</span>
                    <span style="color: #2c3e50; font-weight: 500;">${savedAt.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #6c757d;">경과 시간:</span>
                    <span style="color: #e67e22; font-weight: 500;">${timeAgo}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6c757d;">매핑 수:</span>
                    <span style="color: #27ae60; font-weight: 500;">${mappingCount}개</span>
                </div>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; margin-bottom: 20px;">
                이전 세션에서 자동 저장된 Equipment 매핑 데이터가 있습니다.
                복구하시겠습니까?
            </p>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="${CSS.DISCARD_BTN_ID}" style="
                    padding: 10px 20px;
                    border: 1px solid #dee2e6;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #6c757d;
                    transition: background 0.2s;
                ">삭제</button>
                <button id="${CSS.APPLY_BTN_ID}" style="
                    padding: 10px 20px;
                    border: none;
                    background: #3498db;
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.2s;
                ">복구</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // ─────────────────────────────────────────────────────────────
    // 4. 버튼 이벤트 핸들러
    // ─────────────────────────────────────────────────────────────
    const applyBtn = document.getElementById(CSS.APPLY_BTN_ID);
    const discardBtn = document.getElementById(CSS.DISCARD_BTN_ID);
    
    // 복구 버튼
    if (applyBtn) {
        applyBtn.addEventListener('mouseover', () => {
            applyBtn.style.background = '#2980b9';
        });
        applyBtn.addEventListener('mouseout', () => {
            applyBtn.style.background = '#3498db';
        });
        applyBtn.onclick = () => {
            if (typeof onApply === 'function') {
                onApply();
            }
            dialog.remove();
        };
    }
    
    // 삭제 버튼
    if (discardBtn) {
        discardBtn.addEventListener('mouseover', () => {
            discardBtn.style.background = '#f8f9fa';
        });
        discardBtn.addEventListener('mouseout', () => {
            discardBtn.style.background = 'white';
        });
        discardBtn.onclick = () => {
            if (typeof onDiscard === 'function') {
                onDiscard();
            }
            dialog.remove();
        };
    }
    
    // ─────────────────────────────────────────────────────────────
    // 5. 배경 클릭으로 닫기 (옵션)
    // ─────────────────────────────────────────────────────────────
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            // 배경 클릭 시 닫지 않음 (명시적 선택 필요)
            // dialog.remove();
        }
    });
    
    // ESC 키로 닫기 방지 (명시적 선택 필요)
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    
    // 다이얼로그 제거 시 키보드 이벤트 정리
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.removedNodes.length > 0) {
                Array.from(mutation.removedNodes).forEach((node) => {
                    if (node === dialog || node.contains?.(dialog)) {
                        document.removeEventListener('keydown', handleKeydown);
                        observer.disconnect();
                    }
                });
            }
        });
    });
    observer.observe(document.body, { childList: true });
    
    console.log('[RecoveryDialog] 다이얼로그 표시됨');
    return dialog;
}

/**
 * Equipment 복구 다이얼로그 닫기
 */
export function closeEquipmentRecoveryDialog() {
    const dialog = document.getElementById(CSS.DIALOG_ID);
    if (dialog) {
        dialog.remove();
        console.log('[RecoveryDialog] 다이얼로그 닫힘');
    }
}

/**
 * 복구 다이얼로그 존재 여부 확인
 * 
 * @returns {boolean} 다이얼로그 표시 중인지 여부
 */
export function isRecoveryDialogOpen() {
    return !!document.getElementById(CSS.DIALOG_ID);
}