/**
 * DataCache.js
 * ============
 * 설비 데이터 캐시 관리 유틸리티
 * 
 * @version 1.0.0
 * @description
 * - 설비 상세 데이터 캐시 관리
 * - TTL 기반 만료 처리
 * - Single/Multi Selection 캐시 지원
 * 
 * @example
 * const cache = new DataCache({ expiry: 30000 });
 * cache.set('EQ-01-01', data);
 * const cached = cache.get('EQ-01-01');
 * cache.clear();
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/utils/DataCache.js
 * 작성일: 2026-01-09
 */

import { debugLog } from '../../../core/utils/Config.js';

/**
 * 데이터 캐시 클래스
 */
export class DataCache {
    /**
     * @param {Object} options - 캐시 옵션
     * @param {number} [options.expiry=30000] - 캐시 만료 시간 (ms)
     * @param {number} [options.maxSize=100] - 최대 캐시 항목 수
     */
    constructor(options = {}) {
        /**
         * 캐시 만료 시간 (ms)
         * @type {number}
         */
        this.expiry = options.expiry ?? 30000;
        
        /**
         * 최대 캐시 항목 수
         * @type {number}
         */
        this.maxSize = options.maxSize ?? 100;
        
        /**
         * Single Selection 캐시
         * @type {Map<string, {data: Object, timestamp: number}>}
         */
        this.singleCache = new Map();
        
        /**
         * Multi Selection 캐시 (최근 1개만)
         * @type {Object|null}
         */
        this.multiCache = null;
        
        /**
         * Multi Selection 캐시 키 (frontend_ids 조합)
         * @type {string|null}
         */
        this.multiCacheKey = null;
        
        debugLog('🗄️ DataCache initialized');
    }
    
    // =========================================================================
    // Single Selection 캐시
    // =========================================================================
    
    /**
     * 캐시에서 데이터 조회
     * @param {string} frontendId - Frontend ID
     * @returns {Object|null} 캐시된 데이터 또는 null
     */
    get(frontendId) {
        const cached = this.singleCache.get(frontendId);
        
        if (!cached) {
            return null;
        }
        
        // 만료 확인
        if (Date.now() - cached.timestamp > this.expiry) {
            this.singleCache.delete(frontendId);
            debugLog(`🗄️ Cache expired: ${frontendId}`);
            return null;
        }
        
        debugLog(`🗄️ Cache hit: ${frontendId}`);
        return cached.data;
    }
    
    /**
     * 캐시에 데이터 저장
     * @param {string} frontendId - Frontend ID
     * @param {Object} data - 저장할 데이터
     */
    set(frontendId, data) {
        // 최대 크기 초과 시 가장 오래된 항목 제거
        if (this.singleCache.size >= this.maxSize) {
            const oldestKey = this.singleCache.keys().next().value;
            this.singleCache.delete(oldestKey);
            debugLog(`🗄️ Cache evicted: ${oldestKey}`);
        }
        
        this.singleCache.set(frontendId, {
            data,
            timestamp: Date.now()
        });
        
        debugLog(`🗄️ Cache set: ${frontendId}`);
    }
    
    /**
     * 캐시 항목 존재 여부 확인
     * @param {string} frontendId - Frontend ID
     * @returns {boolean}
     */
    has(frontendId) {
        return this.get(frontendId) !== null;
    }
    
    /**
     * 특정 항목 삭제
     * @param {string} frontendId - Frontend ID
     * @returns {boolean} 삭제 성공 여부
     */
    delete(frontendId) {
        return this.singleCache.delete(frontendId);
    }
    
    /**
     * 캐시 항목 업데이트 (병합)
     * @param {string} frontendId - Frontend ID
     * @param {Object} updateData - 업데이트할 데이터
     * @param {Function} [mergeFn] - 병합 함수 (current, update) => merged
     * @returns {Object|null} 업데이트된 데이터 또는 null
     */
    update(frontendId, updateData, mergeFn = null) {
        const cached = this.get(frontendId);
        
        if (!cached) {
            return null;
        }
        
        const merged = mergeFn 
            ? mergeFn(cached, updateData)
            : { ...cached, ...updateData };
        
        this.set(frontendId, merged);
        
        return merged;
    }
    
    // =========================================================================
    // Multi Selection 캐시
    // =========================================================================
    
    /**
     * Multi Selection 캐시 조회
     * @param {string[]} frontendIds - Frontend ID 배열
     * @returns {Object|null} 캐시된 집계 데이터 또는 null
     */
    getMulti(frontendIds) {
        if (!this.multiCache || !this.multiCacheKey) {
            return null;
        }
        
        // 키 비교 (정렬된 ID 조합)
        const key = this._makeMultiKey(frontendIds);
        
        if (key !== this.multiCacheKey) {
            return null;
        }
        
        debugLog(`🗄️ Multi cache hit: ${frontendIds.length} items`);
        return this.multiCache;
    }
    
    /**
     * Multi Selection 캐시 저장
     * @param {string[]} frontendIds - Frontend ID 배열
     * @param {Object} data - 집계 데이터
     */
    setMulti(frontendIds, data) {
        this.multiCacheKey = this._makeMultiKey(frontendIds);
        this.multiCache = data;
        
        debugLog(`🗄️ Multi cache set: ${frontendIds.length} items`);
    }
    
    /**
     * Multi Selection 캐시 삭제
     */
    clearMulti() {
        this.multiCache = null;
        this.multiCacheKey = null;
    }
    
    /**
     * Multi Selection 캐시 키 생성
     * @private
     * @param {string[]} frontendIds - Frontend ID 배열
     * @returns {string}
     */
    _makeMultiKey(frontendIds) {
        return [...frontendIds].sort().join(',');
    }
    
    // =========================================================================
    // 전체 관리
    // =========================================================================
    
    /**
     * 모든 캐시 삭제
     */
    clear() {
        this.singleCache.clear();
        this.multiCache = null;
        this.multiCacheKey = null;
        
        debugLog('🗄️ Cache cleared');
    }
    
    /**
     * 캐시 크기 반환
     * @returns {{single: number, hasMulti: boolean}}
     */
    size() {
        return {
            single: this.singleCache.size,
            hasMulti: this.multiCache !== null
        };
    }
    
    /**
     * 만료된 항목 정리
     * @returns {number} 정리된 항목 수
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, value] of this.singleCache.entries()) {
            if (now - value.timestamp > this.expiry) {
                this.singleCache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            debugLog(`🗄️ Cache cleanup: ${cleaned} items removed`);
        }
        
        return cleaned;
    }
    
    // =========================================================================
    // 정리
    // =========================================================================
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.clear();
        debugLog('🗄️ DataCache disposed');
    }
}

// 기본 내보내기
export default DataCache;