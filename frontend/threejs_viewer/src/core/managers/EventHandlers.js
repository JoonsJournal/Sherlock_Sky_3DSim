/**
 * EventHandlers.js
 * 이벤트 리스너 관리
 * Phase 1.2: main.js에서 분리
 */

import { debugLog } from '../utils/Config.js';
import { layout2DTo3DConverter } from '../../services/converter/Layout2DTo3DConverter.js';
import { roomParamsAdapter } from '../../services/converter/RoomParamsAdapter.js';

/**
 * EventHandlers 클래스
 * 애플리케이션의 모든 이벤트 리스너를 관리
 */
export class EventHandlers {
    constructor(instances) {
        this.instances = instances;
    }
    
    /**
     * 모든 이벤트 리스너 설정
     */
    setupAll() {
        this.setupEditButtonListener();
        this.setupMonitoringButtonListener();
        this.setupEditModeEventListeners();
        this.setupConnectionButtonListener();
        this.setupKeyboardShortcuts();
        this.setupLayoutEventListeners();
        
        console.log('✅ 모든 이벤트 리스너 설정 완료');
    }
    
    /**
     * Edit 버튼 이벤트 리스너
     */
    setupEditButtonListener() {
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const isActive = this.instances.equipmentEditState.toggleEditMode();
                editBtn.classList.toggle('active', isActive);
                
                // Body에 편집 모드 클래스 추가/제거
                document.body.classList.toggle('edit-mode-active', isActive);
                
                console.log(isActive ? '✏️ Equipment Edit Mode: ON' : '✏️ Equipment Edit Mode: OFF');
            });
        }
    }
    
    /**
     * Monitoring 버튼 이벤트 리스너
     */
    setupMonitoringButtonListener() {
        const monitoringBtn = document.getElementById('monitoringBtn');
        if (monitoringBtn) {
            monitoringBtn.addEventListener('click', () => {
                if (this.instances.monitoringService.isActive) {
                    this.instances.monitoringService.stop();
                    monitoringBtn.classList.remove('active');
                    console.log('🔴 Monitoring Mode: OFF');
                } else {
                    this.instances.monitoringService.start();
                    monitoringBtn.classList.add('active');
                    console.log('🟢 Monitoring Mode: ON');
                }
            });
        }
        
        // 전역 토글 함수 (키보드 단축키용)
        window.toggleMonitoringMode = () => {
            if (monitoringBtn) {
                monitoringBtn.click();
            }
        };
    }
    
    /**
     * Edit 모드 관련 이벤트 리스너
     */
    setupEditModeEventListeners() {
        const { interactionHandler, equipmentLoader, equipmentEditState } = this.instances;
        
        // Edit 모드 변경 시 시각 업데이트
        window.addEventListener('edit-mode-changed', (e) => {
            const { enabled } = e.detail;
            debugLog(`✏️ Edit Mode Changed: ${enabled}`);
            
            // 편집 모드에서는 기존 선택 해제
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
    }
    
    /**
     * Connection 버튼 이벤트 리스너
     */
    setupConnectionButtonListener() {
        const connectionBtn = document.getElementById('connectionBtn');
        if (connectionBtn) {
            connectionBtn.addEventListener('click', () => {
                console.log('🔌 Toggling Connection Modal...');
                
                const wasOpen = this.instances.connectionModal.isOpen;
                this.instances.connectionModal.toggle();
                
                // 상태에 따라 active 클래스 토글
                setTimeout(() => {
                    connectionBtn.classList.toggle('active', !wasOpen);
                }, 50);
            });
        }
    }
    
    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl+K 또는 Cmd+K: Connection Modal 토글
            if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                event.preventDefault();
                
                const wasOpen = this.instances.connectionModal.isOpen;
                this.instances.connectionModal.toggle();
                
                // 버튼 상태 업데이트
                const connectionBtn = document.getElementById('connectionBtn');
                if (connectionBtn) {
                    setTimeout(() => {
                        connectionBtn.classList.toggle('active', !wasOpen);
                    }, 50);
                }
            }
        });
    }
    
    /**
     * Layout 관련 이벤트 리스너 설정
     */
    setupLayoutEventListeners() {
        const { sceneManager, interactionHandler, equipmentLoader, 
                statusVisualizer, signalTowerManager } = this.instances;
        
        // Layout Editor에서 Layout 적용 요청 시
        window.addEventListener('apply-layout-request', (e) => {
            const { layoutData, options } = e.detail || {};
            
            if (!layoutData) {
                console.error('[EventHandlers] apply-layout-request: layoutData가 없습니다');
                return;
            }
            
            console.log('[EventHandlers] Layout 적용 요청 수신...');
            
            try {
                // applyLayoutFull 사용 (있는 경우)
                if (sceneManager && typeof sceneManager.applyLayoutFull === 'function') {
                    const success = sceneManager.applyLayoutFull(layoutData, options);
                    
                    if (success) {
                        console.log('[EventHandlers] ✅ Layout 적용 완료 (applyLayoutFull)');
                        
                        window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                            detail: { layoutData, success: true }
                        }));
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
                    console.error('[EventHandlers] Layout params 검증 실패:', validation.errors);
                    throw new Error(`Layout params 검증 실패: ${validation.errors.join(', ')}`);
                }
                
                if (validation.warnings.length > 0) {
                    console.warn('[EventHandlers] Layout params 경고:', validation.warnings);
                }
                
                const success = sceneManager.applyLayoutWithParams(adaptedParams, options);
                
                if (success) {
                    console.log('[EventHandlers] ✅ Layout 적용 완료');
                    
                    window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                        detail: { layoutData, adaptedParams, success: true }
                    }));
                } else {
                    throw new Error('SceneManager.applyLayoutWithParams 실패');
                }
                
            } catch (error) {
                console.error('[EventHandlers] Layout 적용 실패:', error);
                
                window.dispatchEvent(new CustomEvent('layout-apply-complete', {
                    detail: { layoutData, error: error.message, success: false }
                }));
            }
        });
        
        // Layout 적용 완료 이벤트
        window.addEventListener('layout-applied', (e) => {
            console.log('[EventHandlers] layout-applied 이벤트 수신:', e.detail);
        });
        
        window.addEventListener('layout-params-applied', (e) => {
            console.log('[EventHandlers] layout-params-applied 이벤트 수신:', e.detail);
        });
        
        // 전체 Layout 적용 완료 이벤트
        window.addEventListener('layout-full-applied', (e) => {
            console.log('[EventHandlers] layout-full-applied 이벤트 수신:', e.detail);
            
            // Equipment 재연결
            if (interactionHandler && equipmentLoader) {
                interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
                console.log('[EventHandlers] InteractionHandler 설비 배열 재연결 완료');
            }
            
            // StatusVisualizer 업데이트
            if (statusVisualizer && equipmentLoader) {
                statusVisualizer.setEquipmentArray(equipmentLoader.getEquipmentArray());
                statusVisualizer.updateAllStatus();
                console.log('[EventHandlers] StatusVisualizer 재연결 완료');
            }
            
            // SignalTowerManager 재연결
            if (signalTowerManager) {
                signalTowerManager.initializeAllLights();
                console.log('[EventHandlers] SignalTowerManager 재연결 완료');
            }
        });
        
        // Scene 재구축 완료 이벤트
        window.addEventListener('scene-rebuilt', (e) => {
            console.log('[EventHandlers] scene-rebuilt 이벤트 수신:', e.detail);
            
            if (interactionHandler && equipmentLoader) {
                interactionHandler.setEquipmentArray(equipmentLoader.getEquipmentArray());
            }
        });
        
        console.log('✅ Layout 이벤트 리스너 설정 완료');
    }
}

// Factory 함수
export function createEventHandlers(instances) {
    return new EventHandlers(instances);
}