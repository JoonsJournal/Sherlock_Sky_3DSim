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
 * @version 1.2.0
 * @module EventBootstrap
 * 
 * @changelog
 * - v1.2.0: 🔧 H/G 키 동적 SceneManager 조회 (클로저 캡처 문제 해결)
 * - v1.1.0: 'E' 키 처리를 EquipmentEditButton으로 이관 (EventBus 통해)
 * 
 * 위치: frontend/threejs_viewer/src/bootstrap/EventBootstrap.js
 */

import { appModeManager } from '../core/managers/AppModeManager.js';
import { APP_MODE } from '../core/config/constants.js';
import { debugLog } from '../core/utils/Config.js';
import { toast } from '../ui/common/Toast.js';
import { layout2DTo3DConverter } from '../services/converter/Layout2DTo3DConverter.js';
import { roomParamsAdapter } from '../services/converter/RoomParamsAdapter.js';
import { eventBus } from '../core/managers/EventBus.js';

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
    
    // 🔄 Edit Button - EquipmentEditButton이 관리하므로 여기서는 등록하지 않음
    // (EquipmentEditButton이 capture 모드로 먼저 처리하고, 온라인일 때만 이벤트 전파)
    // 대신 eventBus를 통해 연결
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        // EquipmentEditButton이 처리하지 않은 경우를 위한 폴백
        // (EquipmentEditButton이 초기화되지 않았을 때)
        editBtn.addEventListener('click', (e) => {
            // EquipmentEditButton이 이벤트를 중단하지 않았다면 실행
            if (!e.defaultPrevented) {
                toggleEditMode();
            }
        });
    }
    
    // 🆕 EventBus를 통한 Edit 토글 요청 처리
    eventBus.on('equipment:edit:toggle', () => {
        toggleEditMode();
    });
    
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
 * 🆕 v1.2.0: 동적으로 SceneManager 조회
 * 클로저 캡처 문제를 우회하여 실행 시점에 SceneManager를 찾음
 * 
 * @param {Object|null} handlerSceneManager - handlers에서 전달된 sceneManager
 * @returns {Object|null} SceneManager 인스턴스 또는 null
 */
function _getSceneManager(handlerSceneManager) {
    // 1. handlers에서 전달된 경우
    if (handlerSceneManager?.toggleHelpers) {
        return handlerSceneManager;
    }
    
    // 2. window.sceneManager (exposeGlobalObjects에서 설정)
    if (window.sceneManager?.toggleHelpers) {
        return window.sceneManager;
    }
    
    // 3. window.services.scene.sceneManager
    if (window.services?.scene?.sceneManager?.toggleHelpers) {
        return window.services.scene.sceneManager;
    }
    
    return null;
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
        toggleAdaptivePerformance,
        sceneManager,  // 🔴 주의: 초기화 시점에 null일 수 있음
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
                // 🔧 v1.2.0: 동적으로 SceneManager 조회
                const smH = _getSceneManager(sceneManager);
                if (smH) {
                    smH.toggleHelpers();
                    console.log('🔧 헬퍼 토글됨');
                } else {
                    console.warn('⚠️ SceneManager를 찾을 수 없습니다 (3D View 진입 필요)');
                }
                break;
            case 'g':
                e.stopPropagation();
                e.preventDefault();
                // 🔧 v1.2.0: 동적으로 SceneManager 조회
                const smG = _getSceneManager(sceneManager);
                if (smG) {
                    smG.toggleGrid();
                    console.log('🔧 그리드 토글됨');
                } else {
                    console.warn('⚠️ SceneManager를 찾을 수 없습니다 (3D View 진입 필요)');
                }
                break;
            case 'm':
                e.stopPropagation();
                e.preventDefault();
                toggleMonitoringMode();
                break;
            case 'e':
                // 🔄 v1.1.0: EventBus를 통해 EquipmentEditButton으로 전달
                e.stopPropagation();
                e.preventDefault();
                eventBus.emit('shortcut:equipmentEdit', { key: 'e' });
                break;
            case 'a':
                // 🆕 AdaptivePerformance 토글 (A 키)
                e.stopPropagation();
                e.preventDefault();
                if (toggleAdaptivePerformance) {
                    toggleAdaptivePerformance();
                }
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
    
    console.log('  ✅ 키보드 단축키 등록 완료 (capture mode, v1.2.0)');
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