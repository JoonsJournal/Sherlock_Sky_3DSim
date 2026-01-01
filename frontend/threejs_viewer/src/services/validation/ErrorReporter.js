/**
 * ErrorReporter.js
 * =================
 * 
 * 검증 에러를 수집하고 포맷팅하는 클래스
 * 
 * 주요 기능:
 * 1. 에러 수집 및 저장
 * 2. 심각도별 분류
 * 3. 메시지 포맷팅
 * 4. 자동 수정 제안
 * 
 * 위치: frontend/threejs_viewer/src/services/validation/ErrorReporter.js
 */

import { SEVERITY, getErrorMessage } from './ValidationRules.js';

export class ErrorReporter {
    constructor() {
        // 에러 저장소
        this.errors = [];
        
        // 통계
        this.stats = {
            errorCount: 0,
            warningCount: 0,
            infoCount: 0
        };
        
        console.log('[ErrorReporter] 초기화 완료');
    }
    
    /**
     * 에러 추가
     * @param {string} type - 에러 타입 (ERROR_TYPES 상수)
     * @param {Object} details - 추가 정보
     * @param {string} details.severity - 심각도 ('error' | 'warning' | 'info')
     * @param {string} details.equipmentId - 관련 설비 ID (선택)
     * @param {Object} details.position - 위치 정보 (선택) { x, y, z }
     * @param {string} details.location - 위치 설명 (선택)
     * @param {Object} details.params - 메시지 치환 파라미터 (선택)
     */
    addError(type, details = {}) {
        const severity = details.severity || SEVERITY.ERROR;
        const params = details.params || {};
        
        // 관련 ID들을 params에 추가
        if (details.equipmentId) {
            params.equipmentId = details.equipmentId;
        }
        if (details.equipmentId1) {
            params.equipmentId1 = details.equipmentId1;
        }
        if (details.equipmentId2) {
            params.equipmentId2 = details.equipmentId2;
        }
        if (details.wallId) {
            params.wallId = details.wallId;
        }
        if (details.location) {
            params.location = details.location;
        }
        if (details.width !== undefined) {
            params.width = details.width;
        }
        if (details.depth !== undefined) {
            params.depth = details.depth;
        }
        if (details.count !== undefined) {
            params.count = details.count;
        }
        if (details.current !== undefined) {
            params.current = details.current;
        }
        if (details.required !== undefined) {
            params.required = details.required;
        }
        
        // 메시지 생성
        const { message, fix } = getErrorMessage(type, params);
        
        const error = {
            id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            severity: severity,
            message: message,
            fix: fix,
            equipmentId: details.equipmentId || null,
            wallId: details.wallId || null,
            position: details.position || null,
            location: details.location || null,
            timestamp: new Date().toISOString()
        };
        
        this.errors.push(error);
        
        // 통계 업데이트
        this.updateStats(severity);
        
        console.log(`[ErrorReporter] 에러 추가: ${type}`, error);
        
        return error;
    }
    
    /**
     * 통계 업데이트
     * @param {string} severity - 심각도
     */
    updateStats(severity) {
        switch (severity) {
            case SEVERITY.ERROR:
                this.stats.errorCount++;
                break;
            case SEVERITY.WARNING:
                this.stats.warningCount++;
                break;
            case SEVERITY.INFO:
                this.stats.infoCount++;
                break;
        }
    }
    
    /**
     * 모든 에러 반환
     * @returns {Array} 에러 배열
     */
    getErrors() {
        return [...this.errors];
    }
    
    /**
     * 에러 존재 여부 확인
     * @returns {boolean}
     */
    hasErrors() {
        return this.stats.errorCount > 0;
    }
    
    /**
     * 경고 존재 여부 확인
     * @returns {boolean}
     */
    hasWarnings() {
        return this.stats.warningCount > 0;
    }
    
    /**
     * 에러 또는 경고 존재 여부
     * @returns {boolean}
     */
    hasIssues() {
        return this.errors.length > 0;
    }
    
    /**
     * 심각도별 에러 필터링
     * @param {string} severity - 심각도
     * @returns {Array} 필터링된 에러 배열
     */
    getBySeverity(severity) {
        return this.errors.filter(e => e.severity === severity);
    }
    
    /**
     * 타입별 에러 필터링
     * @param {string} type - 에러 타입
     * @returns {Array} 필터링된 에러 배열
     */
    getByType(type) {
        return this.errors.filter(e => e.type === type);
    }
    
    /**
     * 설비 ID로 에러 필터링
     * @param {string} equipmentId - 설비 ID
     * @returns {Array} 필터링된 에러 배열
     */
    getByEquipmentId(equipmentId) {
        return this.errors.filter(e => e.equipmentId === equipmentId);
    }
    
    /**
     * 에러만 반환 (severity: 'error')
     * @returns {Array}
     */
    getErrorsOnly() {
        return this.getBySeverity(SEVERITY.ERROR);
    }
    
    /**
     * 경고만 반환 (severity: 'warning')
     * @returns {Array}
     */
    getWarningsOnly() {
        return this.getBySeverity(SEVERITY.WARNING);
    }
    
    /**
     * 에러 초기화
     */
    clear() {
        this.errors = [];
        this.stats = {
            errorCount: 0,
            warningCount: 0,
            infoCount: 0
        };
        console.log('[ErrorReporter] 에러 초기화됨');
    }
    
    /**
     * 통계 반환
     * @returns {Object} 통계 정보
     */
    getStats() {
        return {
            ...this.stats,
            total: this.errors.length
        };
    }
    
    /**
     * UI 표시용 JSON 변환
     * @returns {Object} UI 전달용 데이터
     */
    toJSON() {
        return {
            valid: !this.hasErrors(),
            errors: this.errors,
            stats: this.getStats(),
            summary: this.getSummary()
        };
    }
    
    /**
     * 요약 메시지 생성
     * @returns {string} 요약 메시지
     */
    getSummary() {
        const { errorCount, warningCount, infoCount } = this.stats;
        
        if (errorCount === 0 && warningCount === 0) {
            return '✅ 모든 검증 통과';
        }
        
        const parts = [];
        if (errorCount > 0) {
            parts.push(`❌ ${errorCount}개 에러`);
        }
        if (warningCount > 0) {
            parts.push(`⚠️ ${warningCount}개 경고`);
        }
        if (infoCount > 0) {
            parts.push(`ℹ️ ${infoCount}개 정보`);
        }
        
        return parts.join(', ');
    }
    
    /**
     * 콘솔에 에러 출력 (디버깅용)
     */
    printErrors() {
        console.group('[ErrorReporter] 검증 결과');
        console.log('요약:', this.getSummary());
        console.log('통계:', this.getStats());
        
        if (this.errors.length > 0) {
            console.group('에러 목록');
            this.errors.forEach((error, index) => {
                const icon = error.severity === SEVERITY.ERROR ? '❌' :
                            error.severity === SEVERITY.WARNING ? '⚠️' : 'ℹ️';
                console.log(`${index + 1}. ${icon} [${error.type}] ${error.message}`);
                if (error.fix) {
                    console.log(`   💡 해결: ${error.fix}`);
                }
            });
            console.groupEnd();
        }
        
        console.groupEnd();
    }
    
    /**
     * 에러를 HTML 문자열로 변환 (PropertyPanel용)
     * @returns {string} HTML 문자열
     */
    toHTML() {
        if (this.errors.length === 0) {
            return '<div class="validation-success">✅ 모든 검증 통과</div>';
        }
        
        let html = '<div class="validation-errors-list">';
        
        this.errors.forEach((error, index) => {
            const iconClass = error.severity === SEVERITY.ERROR ? 'error-icon' :
                             error.severity === SEVERITY.WARNING ? 'warning-icon' : 'info-icon';
            const icon = error.severity === SEVERITY.ERROR ? '❌' :
                        error.severity === SEVERITY.WARNING ? '⚠️' : 'ℹ️';
            
            html += `
                <div class="validation-error-item ${error.severity}" 
                     data-error-id="${error.id}"
                     data-equipment-id="${error.equipmentId || ''}"
                     data-position='${JSON.stringify(error.position || {})}'>
                    <div class="error-header">
                        <span class="${iconClass}">${icon}</span>
                        <span class="error-type">${error.type}</span>
                    </div>
                    <div class="error-message">${error.message}</div>
                    <div class="error-fix">💡 ${error.fix}</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        return html;
    }
}

// Default export
export default ErrorReporter;