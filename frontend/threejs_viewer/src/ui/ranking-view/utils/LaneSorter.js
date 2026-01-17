/**
 * LaneSorter.js
 * =============
 * 레인별 설비 정렬 유틸리티
 * 
 * @version 1.0.0
 * @description
 * - 레인별 정렬 규칙 정의 및 적용
 * - 지속 시간 기반 정렬 (오래된 순)
 * - 생산 개수 기반 정렬 (많은 순)
 * - 다중 정렬 조건 지원
 * - 안정 정렬 보장 (같은 값일 때 순서 유지)
 * 
 * @changelog
 * - v1.0.0: 초기 구현
 *   - SORT_RULES: 레인별 정렬 규칙 정의
 *   - sort(): 레인별 정렬 실행
 *   - sortByDurationDesc(): 지속 시간 내림차순 정렬
 *   - sortByProductionDesc(): 생산 개수 내림차순 정렬
 *   - stableSort(): 안정 정렬 구현
 * 
 * @dependencies
 * - DurationCalculator (선택적 - 인라인 계산도 지원)
 * 
 * @exports
 * - LaneSorter
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/utils/LaneSorter.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

/**
 * 레인별 설비 정렬 유틸리티 클래스
 * 각 레인의 비즈니스 로직에 맞는 정렬 규칙을 적용
 */
export class LaneSorter {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * 정렬 규칙 타입
     */
    static SORT_TYPES = {
        DURATION_DESC: 'duration-desc',      // 지속 시간 내림차순 (오래된 순)
        DURATION_ASC: 'duration-asc',        // 지속 시간 오름차순 (최근 순)
        PRODUCTION_DESC: 'production-desc',  // 생산 개수 내림차순 (많은 순)
        PRODUCTION_ASC: 'production-asc',    // 생산 개수 오름차순 (적은 순)
        EQUIPMENT_ID: 'equipment-id',        // 설비 ID 오름차순
        ALARM_CODE: 'alarm-code'             // 알람 코드 우선
    };
    
    /**
     * 레인별 기본 정렬 규칙
     * 
     * Remote/Sudden Stop/Stop: 발생시간 오래된 순 → 빠른 대응 필요
     * Run: 생산개수 많은 순 → Lot 교체 임박 설비 우선
     * Idle: 발생시간 오래된 순 → 대기 시간 인지
     * Wait: 대기시간 오래된 순 → 비생산 대기 현황
     * Custom: 추후 확정
     */
    static SORT_RULES = {
        'remote': 'duration-desc',       // Remote 알람: 오래된 순 (긴급 대응)
        'sudden-stop': 'duration-desc',  // Sudden Stop: 오래된 순 (긴급 대응)
        'stop': 'duration-desc',         // Stop: 오래된 순 (대응 필요)
        'run': 'production-desc',        // Run: 생산 많은 순 (Lot 완료 임박)
        'idle': 'duration-desc',         // Idle: 오래된 순
        'wait': 'duration-desc',         // Wait: 대기 오래된 순
        'custom': 'duration-desc'        // Custom: 기본값 (추후 변경 가능)
    };
    
    /**
     * 레인별 정렬 컬럼 매핑
     * 어떤 필드를 기준으로 정렬할지 정의
     */
    static SORT_FIELDS = {
        'duration-desc': {
            primary: 'statusDuration',
            fallback: 'occurredAt',
            direction: 'desc'
        },
        'duration-asc': {
            primary: 'statusDuration',
            fallback: 'occurredAt',
            direction: 'asc'
        },
        'production-desc': {
            primary: 'productionCount',
            fallback: 'statusDuration',
            direction: 'desc'
        },
        'production-asc': {
            primary: 'productionCount',
            fallback: 'statusDuration',
            direction: 'asc'
        },
        'equipment-id': {
            primary: 'equipmentId',
            fallback: 'frontendId',
            direction: 'asc'
        },
        'alarm-code': {
            primary: 'alarmCode',
            fallback: 'statusDuration',
            direction: 'asc'
        }
    };
    
    // =========================================================================
    // Main Sort Methods
    // =========================================================================
    
    /**
     * 레인별 정렬 규칙에 따라 설비 목록 정렬
     * 
     * @param {Array<Object>} equipments - 설비 목록
     * @param {string} laneId - 레인 ID ('remote'|'sudden-stop'|'stop'|'run'|'idle'|'wait'|'custom')
     * @param {Object} [options] - 정렬 옵션
     * @param {string} [options.customRule] - 커스텀 정렬 규칙 (SORT_RULES 덮어쓰기)
     * @param {boolean} [options.stable=true] - 안정 정렬 여부
     * @returns {Array<Object>} 정렬된 설비 목록 (새 배열)
     * 
     * @example
     * // 기본 사용
     * const sorted = LaneSorter.sort(equipments, 'remote');
     * 
     * // 커스텀 규칙 사용
     * const sorted = LaneSorter.sort(equipments, 'custom', {
     *     customRule: 'production-desc'
     * });
     */
    static sort(equipments, laneId, options = {}) {
        if (!Array.isArray(equipments) || equipments.length === 0) {
            return [];
        }
        
        const { customRule, stable = true } = options;
        
        // 정렬 규칙 결정
        const rule = customRule || this.SORT_RULES[laneId] || 'duration-desc';
        
        console.log(`[LaneSorter] 📊 Sorting ${equipments.length} items for lane "${laneId}" with rule "${rule}"`);
        
        // 정렬 필드 정보 가져오기
        const sortField = this.SORT_FIELDS[rule];
        
        if (!sortField) {
            console.warn(`[LaneSorter] ⚠️ Unknown sort rule: ${rule}, using duration-desc`);
            return this.sortByDurationDesc(equipments, stable);
        }
        
        // 정렬 실행
        switch (rule) {
            case 'duration-desc':
                return this.sortByDurationDesc(equipments, stable);
                
            case 'duration-asc':
                return this.sortByDurationAsc(equipments, stable);
                
            case 'production-desc':
                return this.sortByProductionDesc(equipments, stable);
                
            case 'production-asc':
                return this.sortByProductionAsc(equipments, stable);
                
            case 'equipment-id':
                return this.sortByEquipmentId(equipments, stable);
                
            case 'alarm-code':
                return this.sortByAlarmCode(equipments, stable);
                
            default:
                return this.sortByDurationDesc(equipments, stable);
        }
    }
    
    /**
     * 여러 레인의 설비를 동시에 정렬
     * 
     * @param {Map<string, Array<Object>>} laneEquipments - 레인별 설비 맵
     * @returns {Map<string, Array<Object>>} 정렬된 레인별 설비 맵
     */
    static sortAllLanes(laneEquipments) {
        const sortedLanes = new Map();
        
        for (const [laneId, equipments] of laneEquipments) {
            sortedLanes.set(laneId, this.sort(equipments, laneId));
        }
        
        return sortedLanes;
    }
    
    // =========================================================================
    // Specific Sort Methods
    // =========================================================================
    
    /**
     * 지속 시간 내림차순 정렬 (오래된 순)
     * Remote, Sudden Stop, Stop, Idle, Wait 레인에 사용
     * 
     * @param {Array<Object>} equipments - 설비 목록
     * @param {boolean} [stable=true] - 안정 정렬 여부
     * @returns {Array<Object>} 정렬된 목록
     */
    static sortByDurationDesc(equipments, stable = true) {
        const compareFn = (a, b) => {
            const durationA = this._getDuration(a);
            const durationB = this._getDuration(b);
            
            // 내림차순: B - A (오래된 것이 위로)
            return durationB - durationA;
        };
        
        return stable 
            ? this.stableSort(equipments, compareFn)
            : [...equipments].sort(compareFn);
    }
    
    /**
     * 지속 시간 오름차순 정렬 (최근 순)
     * 
     * @param {Array<Object>} equipments - 설비 목록
     * @param {boolean} [stable=true] - 안정 정렬 여부
     * @returns {Array<Object>} 정렬된 목록
     */
    static sortByDurationAsc(equipments, stable = true) {
        const compareFn = (a, b) => {
            const durationA = this._getDuration(a);
            const durationB = this._getDuration(b);
            
            // 오름차순: A - B (최근 것이 위로)
            return durationA - durationB;
        };
        
        return stable 
            ? this.stableSort(equipments, compareFn)
            : [...equipments].sort(compareFn);
    }
    
    /**
     * 생산 개수 내림차순 정렬 (많은 순)
     * Run 레인에 사용 - Lot 완료 임박 설비 우선
     * 
     * @param {Array<Object>} equipments - 설비 목록
     * @param {boolean} [stable=true] - 안정 정렬 여부
     * @returns {Array<Object>} 정렬된 목록
     */
    static sortByProductionDesc(equipments, stable = true) {
        const compareFn = (a, b) => {
            const countA = this._getProductionCount(a);
            const countB = this._getProductionCount(b);
            
            // 생산 개수가 같으면 지속 시간으로 2차 정렬
            if (countA === countB) {
                return this._getDuration(b) - this._getDuration(a);
            }
            
            // 내림차순: B - A (생산 많은 것이 위로)
            return countB - countA;
        };
        
        return stable 
            ? this.stableSort(equipments, compareFn)
            : [...equipments].sort(compareFn);
    }
    
    /**
     * 생산 개수 오름차순 정렬 (적은 순)
     * 
     * @param {Array<Object>} equipments - 설비 목록
     * @param {boolean} [stable=true] - 안정 정렬 여부
     * @returns {Array<Object>} 정렬된 목록
     */
    static sortByProductionAsc(equipments, stable = true) {
        const compareFn = (a, b) => {
            const countA = this._getProductionCount(a);
            const countB = this._getProductionCount(b);
            
            if (countA === countB) {
                return this._getDuration(a) - this._getDuration(b);
            }
            
            return countA - countB;
        };
        
        return stable 
            ? this.stableSort(equipments, compareFn)
            : [...equipments].sort(compareFn);
    }
    
    /**
     * 설비 ID 기준 정렬
     * 
     * @param {Array<Object>} equipments - 설비 목록
     * @param {boolean} [stable=true] - 안정 정렬 여부
     * @returns {Array<Object>} 정렬된 목록
     */
    static sortByEquipmentId(equipments, stable = true) {
        const compareFn = (a, b) => {
            const idA = a.frontendId || a.equipmentId || '';
            const idB = b.frontendId || b.equipmentId || '';
            
            return idA.localeCompare(idB, undefined, { numeric: true });
        };
        
        return stable 
            ? this.stableSort(equipments, compareFn)
            : [...equipments].sort(compareFn);
    }
    
    /**
     * 알람 코드 기준 정렬
     * 같은 알람 코드끼리 그룹화, 지속 시간으로 2차 정렬
     * 
     * @param {Array<Object>} equipments - 설비 목록
     * @param {boolean} [stable=true] - 안정 정렬 여부
     * @returns {Array<Object>} 정렬된 목록
     */
    static sortByAlarmCode(equipments, stable = true) {
        const compareFn = (a, b) => {
            const codeA = a.alarmCode || 0;
            const codeB = b.alarmCode || 0;
            
            // 알람 코드가 같으면 지속 시간으로 2차 정렬
            if (codeA === codeB) {
                return this._getDuration(b) - this._getDuration(a);
            }
            
            return codeA - codeB;
        };
        
        return stable 
            ? this.stableSort(equipments, compareFn)
            : [...equipments].sort(compareFn);
    }
    
    // =========================================================================
    // Utility Methods
    // =========================================================================
    
    /**
     * 안정 정렬 구현
     * JavaScript의 기본 sort는 대부분의 브라우저에서 안정 정렬이지만,
     * 명시적으로 안정성을 보장하기 위해 구현
     * 
     * @param {Array<Object>} array - 정렬할 배열
     * @param {Function} compareFn - 비교 함수
     * @returns {Array<Object>} 안정 정렬된 새 배열
     */
    static stableSort(array, compareFn) {
        // 원본 인덱스 저장
        const indexed = array.map((item, index) => ({ item, index }));
        
        // 정렬 (같은 값이면 원본 인덱스로 2차 정렬)
        indexed.sort((a, b) => {
            const result = compareFn(a.item, b.item);
            return result !== 0 ? result : a.index - b.index;
        });
        
        // 아이템만 추출
        return indexed.map(({ item }) => item);
    }
    
    /**
     * 정렬 순서 변경 감지
     * 이전 정렬과 현재 정렬을 비교하여 변경된 항목 파악
     * 
     * @param {Array<Object>} previous - 이전 정렬된 목록
     * @param {Array<Object>} current - 현재 정렬된 목록
     * @param {string} [idField='equipmentId'] - ID 필드명
     * @returns {Object} 변경 정보
     */
    static detectOrderChanges(previous, current, idField = 'equipmentId') {
        const changes = {
            moved: [],      // 위치가 변경된 항목
            added: [],      // 새로 추가된 항목
            removed: [],    // 제거된 항목
            unchanged: []   // 변경 없는 항목
        };
        
        const prevMap = new Map(previous.map((item, idx) => [item[idField], { item, index: idx }]));
        const currMap = new Map(current.map((item, idx) => [item[idField], { item, index: idx }]));
        
        // 추가/이동 감지
        for (const [id, { item, index }] of currMap) {
            if (!prevMap.has(id)) {
                changes.added.push({ item, newIndex: index });
            } else {
                const prevInfo = prevMap.get(id);
                if (prevInfo.index !== index) {
                    changes.moved.push({
                        item,
                        oldIndex: prevInfo.index,
                        newIndex: index
                    });
                } else {
                    changes.unchanged.push({ item, index });
                }
            }
        }
        
        // 제거 감지
        for (const [id, { item, index }] of prevMap) {
            if (!currMap.has(id)) {
                changes.removed.push({ item, oldIndex: index });
            }
        }
        
        return changes;
    }
    
    /**
     * 특정 레인의 정렬 규칙 변경
     * Custom 레인 등에서 동적으로 정렬 규칙 변경 시 사용
     * 
     * @param {string} laneId - 레인 ID
     * @param {string} newRule - 새 정렬 규칙
     */
    static setLaneSortRule(laneId, newRule) {
        if (!this.SORT_FIELDS[newRule]) {
            console.warn(`[LaneSorter] ⚠️ Unknown sort rule: ${newRule}`);
            return;
        }
        
        this.SORT_RULES[laneId] = newRule;
        console.log(`[LaneSorter] ✅ Lane "${laneId}" sort rule changed to "${newRule}"`);
    }
    
    /**
     * 레인의 현재 정렬 규칙 조회
     * 
     * @param {string} laneId - 레인 ID
     * @returns {string} 정렬 규칙
     */
    static getLaneSortRule(laneId) {
        return this.SORT_RULES[laneId] || 'duration-desc';
    }
    
    // =========================================================================
    // Private Helper Methods
    // =========================================================================
    
    /**
     * 설비의 지속 시간 추출
     * 다양한 필드명 지원
     * 
     * @private
     * @param {Object} equipment - 설비 객체
     * @returns {number} 지속 시간 (밀리초)
     */
    static _getDuration(equipment) {
        // statusDuration이 있으면 사용
        if (typeof equipment.statusDuration === 'number') {
            return equipment.statusDuration;
        }
        
        // occurredAt에서 계산
        const occurredAt = equipment.occurredAt || 
                          equipment.occurredAtUtc || 
                          equipment.OccurredAt || 
                          equipment.OccurredAtUtc;
        
        if (occurredAt) {
            try {
                const startTime = new Date(occurredAt);
                const now = new Date();
                return Math.max(0, now.getTime() - startTime.getTime());
            } catch (e) {
                console.warn('[LaneSorter] ⚠️ Failed to parse occurredAt:', occurredAt);
            }
        }
        
        // waitDuration 체크 (Wait 레인)
        if (typeof equipment.waitDuration === 'number') {
            return equipment.waitDuration;
        }
        
        return 0;
    }
    
    /**
     * 설비의 생산 개수 추출
     * 다양한 필드명 지원
     * 
     * @private
     * @param {Object} equipment - 설비 객체
     * @returns {number} 생산 개수
     */
    static _getProductionCount(equipment) {
        // 다양한 필드명 지원
        const count = equipment.productionCount ?? 
                     equipment.production_count ?? 
                     equipment.ProductionCount ??
                     equipment.currentCount ??
                     equipment.count ?? 0;
        
        return typeof count === 'number' ? count : parseInt(count, 10) || 0;
    }
}

// =========================================================================
// Default Export
// =========================================================================
export default LaneSorter;