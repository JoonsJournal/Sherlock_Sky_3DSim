/**
 * DebugUtils.js
 * =============
 * Equipment Edit 디버깅 유틸리티
 * 
 * @version 1.0.0
 * @changelog
 * - v1.0.0: 빈 파일에서 기본 구조 추가 (2026-01-25)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/equipment-edit/utils/DebugUtils.js
 */

/**
 * 디버그 유틸리티 클래스
 */
export class DebugUtils {
    /**
     * 디버그 로그 출력
     * @param {string} message - 메시지
     * @param {*} data - 추가 데이터
     */
    static log(message, data = null) {
        console.log(`[EquipmentEdit] ${message}`, data || '');
    }
    
    /**
     * 경고 로그 출력
     * @param {string} message - 메시지
     * @param {*} data - 추가 데이터
     */
    static warn(message, data = null) {
        console.warn(`[EquipmentEdit] ⚠️ ${message}`, data || '');
    }
    
    /**
     * 에러 로그 출력
     * @param {string} message - 메시지
     * @param {*} error - 에러 객체
     */
    static error(message, error = null) {
        console.error(`[EquipmentEdit] ❌ ${message}`, error || '');
    }
}

/**
 * 전역 디버그 함수 등록
 * @param {Object} context - 컨텍스트 객체
 */
export function registerGlobalDebugFunctions(context = {}) {
    if (typeof window === 'undefined') return;
    
    window.debugEquipmentEdit = () => {
        console.group('🔧 Equipment Edit Debug Info');
        console.log('Context:', context);
        console.groupEnd();
    };
    
    DebugUtils.log('Global debug functions registered');
}
