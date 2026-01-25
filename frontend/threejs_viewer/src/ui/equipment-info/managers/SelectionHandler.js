/**
 * SelectionHandler.js
 * ===================
 * 설비 선택 처리 모듈 (Single/Multi Selection)
 * 
 * @version 1.0.0
 * @description
 * - Single Selection API 호출 및 렌더링
 * - Multi Selection 집계 데이터 처리
 * - 캐시 연동 및 관리
 * - 실시간 업데이트 지원
 * 
 * @changelog
 * - v1.0.0: EquipmentInfoPanel.js에서 분리
 *           - _showSingle, _renderSingle, _renderSingleError 이동
 *           - _showMulti, _debounceRefreshMulti 이동
 *           - 상태 관리 및 캐시 연동
 *           - ⚠️ 호환성: 기존 선택 동작 100% 유지
 * 
 * @dependencies
 * - ../../../api/equipmentDetailApi.js
 * - ../utils/DataMerger.js
 * - ../../../core/utils/Config.js (debugLog)
 * 
 * @exports
 * - SelectionHandler
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/managers/SelectionHandler.js
 * 작성일: 2026-01-25
 * 수정일: 2026-01-25
 */

import { debugLog } from '../../../core/utils/Config.js';
import { equipmentDetailApi } from '../../../api/equipmentDetailApi.js';
import { mergeEquipmentData } from '../utils/DataMerger.js';

/**
 * 설비 선택 처리 핸들러
 * 
 * @example
 * const handler = new SelectionHandler();
 * handler.setDependencies({ cache, headerStatus, generalTab, pcInfoTab, equipmentEditState });
 * await handler.handleSingle(equipmentData);
 * await handler.handleMulti([eq1, eq2, eq3]);
 */
export class SelectionHandler {
    constructor() {
        /**
         * 의존성 컴포넌트
         * @type {Object}
         */
        this.deps = {
            cache: null,
            headerStatus: null,
            generalTab: null,
            pcInfoTab: null,
            equipmentEditState: null
        };
        
        /**
         * 선택 상태
         * @type {Object}
         */
        this.state = {
            currentFrontendId: null,
            currentEquipmentId: null,
            currentData: null,
            selectedCount: 0,
            selectedFrontendIds: [],
            selectedEquipmentIds: []
        };
        
        /**
         * Multi Selection 갱신 debounce 타임아웃
         * @type {number|null}
         */
        this._refreshTimeout = null;
        
        debugLog('📊 SelectionHandler initialized');
    }
    
    // =========================================================================
    // 의존성 주입
    // =========================================================================
    
    /**
     * 의존성 컴포넌트 설정
     * @param {Object} deps - 의존성 객체
     * @param {DataCache} deps.cache - 캐시 인스턴스
     * @param {HeaderStatus} deps.headerStatus - 헤더 상태 컴포넌트
     * @param {GeneralTab} deps.generalTab - General 탭 컴포넌트
     * @param {PCInfoTab} deps.pcInfoTab - PC Info 탭 컴포넌트
     * @param {Object} [deps.equipmentEditState] - Equipment Edit State 인스턴스
     */
    setDependencies(deps) {
        this.deps = { ...this.deps, ...deps };
        debugLog('🔗 SelectionHandler dependencies set');
    }
    
    /**
     * Equipment Edit State 설정
     * @param {Object} equipmentEditState - Equipment Edit State 인스턴스
     */
    setEquipmentEditState(equipmentEditState) {
        this.deps.equipmentEditState = equipmentEditState;
        debugLog('🔗 EquipmentEditState connected to SelectionHandler');
    }
    
    // =========================================================================
    // Single Selection
    // =========================================================================
    
    /**
     * Single Selection 처리
     * @param {Object} equipmentData - 설비 데이터
     * @param {Object} callbacks - 콜백 함수들
     * @param {Function} callbacks.onUpdateHeader - 헤더 업데이트 콜백
     * @param {Function} callbacks.onShowLoading - 로딩 표시 콜백
     * @returns {Promise<Object|null>} 로드된 데이터 또는 null
     */
    async handleSingle(equipmentData, callbacks = {}) {
        const frontendId = equipmentData.id || equipmentData.frontendId;
        
        this._updateState({
            currentFrontendId: frontendId,
            selectedFrontendIds: [frontendId],
            selectedEquipmentIds: [],
            currentData: null,
            selectedCount: 1
        });
        
        // 타이머 정지
        this.deps.generalTab?.stopTimer();
        
        // 헤더 상태 표시
        this.deps.headerStatus?.show();
        
        // 헤더 업데이트 콜백
        callbacks.onUpdateHeader?.(frontendId);
        
        // 로딩 표시 콜백
        callbacks.onShowLoading?.();
        
        // Equipment ID 조회
        const equipmentId = this._getEquipmentId(frontendId);
        this.state.currentEquipmentId = equipmentId;
        
        if (equipmentId) {
            this.state.selectedEquipmentIds = [equipmentId];
        }
        
        // 매핑 안됨
        if (!equipmentId) {
            this._renderUnmapped(frontendId, equipmentData);
            return null;
        }
        
        // 캐시 확인
        const cached = this.deps.cache?.get(frontendId);
        if (cached) {
            this._renderSingle(cached, frontendId, callbacks);
            return cached;
        }
        
        // API 호출
        try {
            const data = await equipmentDetailApi.getDetail(frontendId, { equipmentId });
            
            if (data) {
                this.deps.cache?.set(frontendId, data);
                this._renderSingle(data, frontendId, callbacks);
                return data;
            } else {
                this._renderSingleError(frontendId, equipmentData);
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to load:', error);
            this.deps.generalTab?.showError(frontendId, error.message);
            this.deps.pcInfoTab?.showError();
            this.deps.headerStatus?.update('DISCONNECTED');
            return null;
        }
    }
    
    /**
     * Single Selection 렌더링
     * @private
     * @param {Object} data - 설비 상세 데이터
     * @param {string} frontendId - Frontend ID
     * @param {Object} callbacks - 콜백 함수들
     */
    _renderSingle(data, frontendId, callbacks = {}) {
        this.state.currentData = data;
        
        // 헤더 업데이트
        callbacks.onUpdateHeader?.(data.equipment_name || frontendId);
        
        // 컴포넌트 렌더링
        this.deps.headerStatus?.update(data.status);
        this.deps.generalTab?.render(data);
        this.deps.pcInfoTab?.render(data);
        
        debugLog(`✅ Single selection rendered: ${frontendId}`);
    }
    
    /**
     * Single Selection 에러 렌더링
     * @private
     * @param {string} frontendId - Frontend ID
     * @param {Object} equipmentData - 설비 기본 데이터
     */
    _renderSingleError(frontendId, equipmentData) {
        this.deps.generalTab?.showBasicInfo(frontendId, equipmentData);
        this.deps.pcInfoTab?.showError();
        this.deps.headerStatus?.update('DISCONNECTED');
        
        debugLog(`⚠️ Single selection error: ${frontendId}`);
    }
    
    /**
     * 매핑되지 않은 설비 렌더링
     * @private
     * @param {string} frontendId - Frontend ID
     * @param {Object} equipmentData - 설비 기본 데이터
     */
    _renderUnmapped(frontendId, equipmentData) {
        this.deps.generalTab?.showUnmapped(frontendId, equipmentData);
        this.deps.pcInfoTab?.showUnmapped();
        this.deps.headerStatus?.update('DISCONNECTED');
        
        debugLog(`⚠️ Unmapped equipment: ${frontendId}`);
    }
    
    // =========================================================================
    // Multi Selection
    // =========================================================================
    
    /**
     * Multi Selection 처리
     * @param {Array<Object>} dataArray - 설비 데이터 배열
     * @param {Object} callbacks - 콜백 함수들
     * @param {Function} callbacks.onUpdateHeader - 헤더 업데이트 콜백
     * @param {Function} callbacks.onShowLoading - 로딩 표시 콜백
     * @returns {Promise<Object|null>} 집계 데이터 또는 null
     */
    async handleMulti(dataArray, callbacks = {}) {
        const count = dataArray.length;
        const frontendIds = dataArray.map(item => item.id || item.frontendId);
        const equipmentIds = frontendIds
            .map(fid => this._getEquipmentId(fid))
            .filter(Boolean);
        
        this._updateState({
            selectedFrontendIds: frontendIds,
            selectedEquipmentIds: equipmentIds,
            selectedCount: count
        });
        
        // 헤더 업데이트
        callbacks.onUpdateHeader?.(`${count}개 설비 선택됨`, true);
        
        // 헤더 상태 숨기기
        this.deps.headerStatus?.hide();
        
        // 타이머 정지
        this.deps.generalTab?.stopTimer();
        
        // 로딩 표시
        callbacks.onShowLoading?.();
        
        // 매핑 안됨
        if (equipmentIds.length === 0) {
            this.deps.generalTab?.showMultiUnmapped(count);
            this.deps.pcInfoTab?.showMultiUnmapped(count);
            return null;
        }
        
        // API 호출
        try {
            const data = await equipmentDetailApi.getMultiDetail(frontendIds, { equipmentIds });
            
            if (data) {
                this.deps.cache?.setMulti(frontendIds, data);
                this.deps.generalTab?.renderMulti(data, count, equipmentIds.length);
                this.deps.pcInfoTab?.renderMulti(data, count);
                
                debugLog(`✅ Multi selection rendered: ${count} items`);
                return data;
            } else {
                this.deps.generalTab?.showMultiError(count);
                this.deps.pcInfoTab?.showMultiError(count);
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to load multi:', error);
            this.deps.generalTab?.showMultiError(count, error.message);
            this.deps.pcInfoTab?.showMultiError(count);
            return null;
        }
    }
    
    /**
     * Multi Selection 갱신 (Debounced)
     */
    debounceRefreshMulti() {
        clearTimeout(this._refreshTimeout);
        
        this._refreshTimeout = setTimeout(async () => {
            const { selectedCount, selectedFrontendIds, selectedEquipmentIds } = this.state;
            
            if (selectedCount > 1 && selectedEquipmentIds.length > 0) {
                try {
                    const data = await equipmentDetailApi.getMultiDetail(selectedFrontendIds, {
                        equipmentIds: selectedEquipmentIds
                    });
                    
                    if (data) {
                        this.deps.cache?.setMulti(selectedFrontendIds, data);
                        this.deps.generalTab?.renderMulti(data, selectedCount, selectedEquipmentIds.length);
                        this.deps.pcInfoTab?.renderMulti(data, selectedCount);
                        
                        debugLog('✅ Multi selection refreshed');
                    }
                } catch (error) {
                    console.error('❌ Refresh failed:', error);
                }
            }
        }, 500);
    }
    
    // =========================================================================
    // 실시간 업데이트
    // =========================================================================
    
    /**
     * 실시간 데이터 업데이트 처리
     * @param {Object} updateData - 업데이트 데이터
     * @returns {boolean} 업데이트 적용 여부
     */
    handleRealtimeUpdate(updateData) {
        const { frontend_id } = updateData;
        
        // Single Selection 업데이트
        if (this.state.selectedCount === 1 && frontend_id === this.state.currentFrontendId) {
            const merged = mergeEquipmentData(this.state.currentData, updateData);
            this.state.currentData = merged;
            
            this.deps.headerStatus?.update(merged.status);
            this.deps.generalTab?.render(merged);
            this.deps.pcInfoTab?.render(merged);
            
            this.deps.cache?.set(this.state.currentFrontendId, merged);
            
            debugLog(`📊 Realtime update applied: ${frontend_id}`);
            return true;
        }
        
        // Multi Selection 업데이트
        if (this.state.selectedCount > 1 && this.state.selectedFrontendIds.includes(frontend_id)) {
            this.debounceRefreshMulti();
            return true;
        }
        
        return false;
    }
    
    // =========================================================================
    // 상태 관리
    // =========================================================================
    
    /**
     * 현재 상태 반환
     * @returns {Object} 선택 상태
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * 현재 데이터 반환
     * @returns {Object|null}
     */
    getCurrentData() {
        return this.state.currentData;
    }
    
    /**
     * 선택된 설비 수 반환
     * @returns {number}
     */
    getSelectedCount() {
        return this.state.selectedCount;
    }
    
    /**
     * 상태 초기화
     */
    clearState() {
        this._updateState({
            currentFrontendId: null,
            currentEquipmentId: null,
            currentData: null,
            selectedCount: 0,
            selectedFrontendIds: [],
            selectedEquipmentIds: []
        });
        
        this.deps.cache?.clearMulti();
        
        debugLog('📊 SelectionHandler state cleared');
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        clearTimeout(this._refreshTimeout);
        this.clearState();
        this.deps = {
            cache: null,
            headerStatus: null,
            generalTab: null,
            pcInfoTab: null,
            equipmentEditState: null
        };
        
        debugLog('📊 SelectionHandler disposed');
    }
    
    // =========================================================================
    // 헬퍼 메서드
    // =========================================================================
    
    /**
     * Equipment ID 조회
     * @private
     * @param {string} frontendId - Frontend ID
     * @returns {string|null} Equipment ID 또는 null
     */
    _getEquipmentId(frontendId) {
        const mapping = this.deps.equipmentEditState?.getMapping(frontendId);
        return mapping?.equipmentId || mapping?.equipment_id || null;
    }
    
    /**
     * 상태 업데이트
     * @private
     * @param {Object} updates - 업데이트 내용
     */
    _updateState(updates) {
        Object.assign(this.state, updates);
    }
}

// 기본 내보내기
export default SelectionHandler;
