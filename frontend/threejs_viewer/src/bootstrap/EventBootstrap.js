/**
 * EventBootstrap.js
 * =================
 * 
 * 이벤트 리스너 설정 담당
 * - UI 버튼 이벤트
 * - 키보드 단축키
 * - Edit 모드 이벤트
 * - Layout 이벤트
 * 
 * @version 1.0.0
 * @module EventBootstrap
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/EventBootstrap.js
 */

import { appModeManager } from '../core/managers/AppModeManager.js';
import { APP_MODE } from '../core/config/constants.js';
import { debugLog } from '../core/utils/Config.js';
import { toast } from '../ui/common/Toast.js';
import { layout2DTo3DConverter } from '../services/converter/Layout2DTo3DConverter.js';
import { roomParamsAdapter } from '../services/converter/RoomParamsAdapter.js';

/**
 * UI 버튼 이벤트 리스너 설정
 * @param {Object} handlers - 이벤트 핸들러 객체
 */
export function setupUIEventListeners(handlers) {
    const {
        toggleEditMode,
        toggleMonitoringMode,
        toggleConnectionModal,
        toggleDebugPanel,
        togglePerformanceMonitor,
        sceneManager,
        connectionModal
    } = handlers;
    
    // Edit Button
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
    
    // Monitoring Button
    const monitoringBtn = document.getElementById('monitoringBtn');
    if (monitoringBtn) {
        monitoringBtn.addEventListener('click', toggleMonitoringMode);
    }
    
    // Connection Button
    const connectionBtn = document.getElementById('connectionBtn');
    if (connectionBtn) {
        connectionBtn.addEventListener('click', toggleConnectionModal);
    }
    
    console.log('  ✅ UI 버튼 이벤트 리스너 등록 완료');
}

/**
 * 키보드 단축키 설정
 * @param {Object} handlers - 이벤트 핸들러 객체
 */
export function setupKeyboardShortcuts(handlers) {
    const {
        toggleEditMode,
        toggleMonitoringMode,
        toggleConnectionModal,
        toggleDebugPanel,
        togglePerformanceMonitor,
        sceneManager,
        connectionModal,
        updateConnectionButtonState
    } = handlers;
    
    document.addEventListener('keydown', (e) => {
        // 입력 필드에서는 무시
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl+K: Connection Modal
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            e.stopPropagation();
            toggleConnectionModal();
            return;
        }
        
        // 단일 키 단축키
        const key = e.key.toLowerCase();
        
        switch (key) {
            case 'd':
                e.stopPropagation();
                e.preventDefault();
                toggleDebugPanel();
                break;
            case 'p':
                e.stopPropagation();
                e.preventDefault();
                togglePerformanceMonitor();
                break;
            case 'h':
                e.stopPropagation();
                e.preventDefault();
                if (sceneManager && sceneManager.toggleHelpers) {
                    sceneManager.toggleHelpers();
                    console.log('🔧 헬퍼 토글됨');
                }
                break;
            case 'g':
                e.stopPropagation();
                e.preventDefault();
                if (sceneManager && sceneManager.toggleGrid) {
                    sceneManager.toggleGrid();
                    console.log('🔧 그리드 토글됨');
                }
                break;
            case 'm':
                e.stopPropagation();
                e.preventDefault();
                toggleMonitoringMode();
                break;
            case 'e':
                e.stopPropagation();
                e.preventDefault();
                toggleEditMode();
                break;
            case 'escape':
                e.stopPropagation();
                e.preventDefault();
                if (connectionModal && connectionModal.isOpen) {
                    connectionModal.close();
                    if (updateConnectionButtonState) updateConnectionButtonState();
                }
                break;
        }
    }, true);  // capture: true
    
    console.log('  ✅ 키보드 단축키 등록 완료 (capture mode)');
}

/**
 * Edit 모드 관련 이벤트 리스너 설정
 * @param {Object} handlers - 이벤트 핸들러 객체
 */
export function setupEditModeEventListeners(handlers) {
    const { interactionHandler, equipmentLoader, equipmentEditState } = handlers;
    
    // Edit 모드 변경 시 시각 업데이트
    window.addEventListener('edit-mode-changed', (e) => {
        const { enabled } = e.detail;
        debugLog(`✏️ Edit Mode Changed: ${enabled}`);
        
        if (enabled && interactionHandler) {
            interactionHandler.clearAllSelections();
        }
    });
    
    // 매핑 변경 시 시각 업데이트
    window.addEventListener('mapping-changed', (e) => {
        const { frontendId } = e.detail;
        
        if (equipmentLoader) {
            equipmentLoader.highlightMappingStatus(frontendId, true);
        }
        
        debugLog(`✅ 매핑 완료: ${frontendId}`);
    });
    
    // 매핑 삭제 시 시각 업데이트
    window.addEventListener('mapping-removed', (e) => {
        const { frontendId } = e.detail;
        
        if (equipmentLoader) {
            equipmentLoader.highlightMappingStatus(frontendId, false);
        }
        
        debugLog(`🗑️ 매핑 제거: ${frontendId}`);
    });
    
    // 매핑 리셋 시 모든 강조 제거
    window.addEventListener('mappings-reset', () => {
        if (equipmentLoader) {
            equipmentLoader.updateAllMappingStatus({});
        }
        debugLog('🗑️ 모든 매핑 초기화됨');
    });
    
    // 서버에서 매핑 로드 시 시각 업데이트
    window.addEventListener('mappings-loaded', (e) => {
        if (equipmentLoader && equipmentEditState) {
            const mappings = equipmentEditState.getAllMappings();
            equipmentLoader.updateAllMappingStatus(mappings);
        }
        debugLog('📥 서버 매핑 데이터 로드됨');
    });
    
    console.log('  ✅ Edit 모드 이벤트 리스너 등록 완료');
}

/**
 * Layout 관련 이벤트 리스너 설정
 * @param {Object} handlers - 이벤트 핸들러 객체
 */
export function setupLayoutEventListeners(handlers) {
    const { 
        sceneManager, 
        equipmentLoader, 
        interactionHandler, 
        statusVisualizer,
        signalTowerManager 
    } = handlers;
    
    // Layout 적용 요청
    window.addEventListener('apply-layout-request', (e) => {
        const { layoutData, options } = e.detail || {};
        
        if (!layoutData) {
            console.error('[EventBootstrap] apply-layout-request: layoutData가 없습니다');
            return;
        }
        
        console.log('[EventBootstrap] Layout 적용 요청 수신...');
        
        try {
            if (sceneManager && typeof sceneManager.applyLayoutFull === 'function') {
                const success = sceneManager.applyLayoutFull(layoutData, options);
                
                if (success) {
                    console.log('[EventBootstrap] ✅ Layout 적용 완료 (applyLayoutFull)');
                    
                    window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                        detail: { layoutData, success: true }
                    }));
                    
                    toast.success('Layout 적용 완료');
                } else {
                    throw new Error('applyLayoutFull 실패');
                }
                return;
            }
            
            // Fallback: 기존 방식
            const convertedLayout = layout2DTo3DConverter.convert(layoutData);
            
            if (!convertedLayout) {
                throw new Error('Layout 변환 실패');
            }
            
            const adaptedParams = roomParamsAdapter.adapt(convertedLayout);
            const validation = roomParamsAdapter.validate(adaptedParams);
            
            if (!validation.valid) {
                console.error('[EventBootstrap] Layout params 검증 실패:', validation.errors);
                throw new Error(`Layout params 검증 실패: ${validation.errors.join(', ')}`);
            }
            
            const success = sceneManager.applyLayoutWithParams(adaptedParams, options);
            
            if (success) {
                console.log('[EventBootstrap] ✅ Layout 적용 완료');
                
                window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                    detail: { layoutData, adaptedParams, success: true }
                }));
                
                toast.success('Layout 적용 완료');
            } else {
                throw new Error('SceneManager.applyLayoutWithParams 실패');
            }
            
        } catch (error) {
            console.error('[EventBootstrap] Layout 적용 실패:', error);
            
            window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                detail: { layoutData, error: error.message, success: false }
            }));
            
            toast.error(`Layout 적용 실패: ${error.message}`);
        }
    });
    
    // Layout 적용 완료 후 재연결
    window.addEventListener('layout-full-applied', (e) => {
        console.log('[EventBootstrap] layout-full-applied 이벤트 수신:', e.detail);
        
        if (interactionHandler && equipmentLoader) {
            interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
            console.log('[EventBootstrap] InteractionHandler 설비 배열 재연결 완료');
        }
        
        if (statusVisualizer && equipmentLoader) {
            statusVisualizer.setEquipmentArray(equipmentLoader.getEquipmentArray());
            statusVisualizer.updateAllStatus();
            console.log('[EventBootstrap] StatusVisualizer 재연결 완료');
        }
        
        if (signalTowerManager) {
            signalTowerManager.initializeAllLights();
            console.log('[EventBootstrap] SignalTowerManager 재연결 완료');
        }
    });
    
    // Scene 재구축 이벤트
    window.addEventListener('scene-rebuilt', (e) => {
        console.log('[EventBootstrap] scene-rebuilt 이벤트 수신:', e.detail);
        
        if (interactionHandler && equipmentLoader) {
            interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
        }
    });
    
    console.log('  ✅ Layout 이벤트 리스너 등록 완료');
}

/**
 * LayoutEditorMain 연결 설정
 * @param {Object} sceneManager - SceneManager 인스턴스
 */
export function setupLayoutEditorMainConnection(sceneManager) {
    const connectLayoutEditorMain = () => {
        if (window.layoutEditorMain && sceneManager) {
            if (typeof window.layoutEditorMain.setSceneManager === 'function') {
                window.layoutEditorMain.setSceneManager(sceneManager);
                console.log('[EventBootstrap] LayoutEditorMain-SceneManager 연결 완료');
            }
        }
    };
    
    connectLayoutEditorMain();
    setTimeout(connectLayoutEditorMain, 100);
    setTimeout(connectLayoutEditorMain, 500);
    
    window.addEventListener('layout-editor-main-ready', () => {
        connectLayoutEditorMain();
    });
}

/**
 * PreviewGenerator 초기화
 * @returns {Object|null} PreviewGenerator 인스턴스
 */
export function initPreviewGenerator() {
    let previewGenerator = null;
    
    const connectPreviewGenerator = () => {
        if (window.PreviewGenerator && !previewGenerator) {
            try {
                const previewCanvas = document.getElementById('preview-canvas');
                
                if (previewCanvas) {
                    previewGenerator = new window.PreviewGenerator({
                        container: previewCanvas,
                        width: previewCanvas.clientWidth || 600,
                        height: previewCanvas.clientHeight || 400
                    });
                    
                    window.previewGenerator = previewGenerator;
                    console.log('[EventBootstrap] ✅ PreviewGenerator 초기화 완료');
                }
            } catch (error) {
                console.warn('[EventBootstrap] PreviewGenerator 초기화 실패:', error);
            }
        }
    };
    
    connectPreviewGenerator();
    setTimeout(connectPreviewGenerator, 500);
    setTimeout(connectPreviewGenerator, 1000);
    setTimeout(connectPreviewGenerator, 2000);
    
    window.addEventListener('preview-modal-opened', () => {
        connectPreviewGenerator();
    });
    
    return previewGenerator;
}