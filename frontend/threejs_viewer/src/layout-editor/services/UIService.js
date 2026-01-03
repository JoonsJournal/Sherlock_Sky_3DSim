/**
 * UIService.js
 * =============
 * UI 관련 서비스 (모달, 토스트, 상태바, 팝업)
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/services/UIService.js
 */

class UIService {
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.state = options.state || window.layoutEditorState;
        this.toolService = options.toolService;
        this.componentService = options.componentService;
        
        // DOM IDs (Config에서 가져오기)
        this.domIds = window.LayoutEditorConfig?.DOM_IDS || {
            toolbarContainer: 'toolbar-container',
            alignPopup: 'align-popup',
            alignBtn: 'align-btn',
            shortcutsHelp: 'shortcuts-help',
            componentBtn: 'component-btn',
            roomSizeModal: 'room-size-modal',
            eqArrayModal: 'eq-array-modal',
            loadingIndicator: 'loading-indicator'
        };
        
        console.log('✅ UIService 초기화 완료');
    }
    
    // =====================================================
    // Toast
    // =====================================================
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    // =====================================================
    // Component Submenu
    // =====================================================
    
    setupComponentSubmenu() {
        document.querySelectorAll('.submenu-item').forEach(item => {
            const componentType = item.dataset.component;
            
            item.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', componentType);
                item.style.opacity = '0.5';
            });
            
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
            });
            
            item.addEventListener('click', () => {
                if (this.componentService) {
                    const shape = this.componentService.createComponentAtCenter(componentType);
                    if (shape) {
                        this.showToast(`${componentType} 생성됨`, 'success');
                    }
                }
            });
        });
    }
    
    toggleComponentSubmenu() {
        if (this.state) {
            this.state.componentSubmenuVisible = !this.state.componentSubmenuVisible;
            const isVisible = this.state.componentSubmenuVisible;
            
            document.getElementById(this.domIds.toolbarContainer)
                ?.classList.toggle('expanded', isVisible);
            document.getElementById(this.domIds.componentBtn)
                ?.classList.toggle('active', isVisible);
            
            if (isVisible && this.state.alignPopupVisible) {
                this.hideAlignPopup();
            }
            
            // Canvas 크기 업데이트 (지연)
            setTimeout(() => {
                this.updateCanvasSize?.();
            }, 350);
        }
    }
    
    // =====================================================
    // Align Popup
    // =====================================================
    
    toggleAlignPopup() {
        if (this.state) {
            this.state.alignPopupVisible = !this.state.alignPopupVisible;
            const isVisible = this.state.alignPopupVisible;
            
            const popup = document.getElementById(this.domIds.alignPopup);
            const btn = document.getElementById(this.domIds.alignBtn);
            
            if (isVisible && btn) {
                const btnRect = btn.getBoundingClientRect();
                popup.style.top = `${btnRect.top}px`;
                popup.style.left = `${btnRect.right + 5}px`;
                
                if (this.state.componentSubmenuVisible) {
                    this.toggleComponentSubmenu();
                }
            }
            
            popup?.classList.toggle('show', isVisible);
            btn?.classList.toggle('active', isVisible);
        }
    }
    
    hideAlignPopup() {
        if (this.state?.alignPopupVisible) {
            this.state.alignPopupVisible = false;
            document.getElementById(this.domIds.alignPopup)?.classList.remove('show');
            document.getElementById(this.domIds.alignBtn)?.classList.remove('active');
        }
    }
    
    // =====================================================
    // Shortcuts Help
    // =====================================================
    
    toggleShortcutsHelp() {
        if (this.state) {
            this.state.shortcutsHelpVisible = !this.state.shortcutsHelpVisible;
            document.getElementById(this.domIds.shortcutsHelp)
                ?.classList.toggle('show', this.state.shortcutsHelpVisible);
        }
    }
    
    // =====================================================
    // Room Size Modal
    // =====================================================
    
    showRoomSizeModal() {
        document.getElementById(this.domIds.roomSizeModal)?.classList.add('active');
    }
    
    closeRoomSizeModal() {
        document.getElementById(this.domIds.roomSizeModal)?.classList.remove('active');
    }
    
    applyRoomSize() {
        const width = parseFloat(document.getElementById('room-width')?.value);
        const depth = parseFloat(document.getElementById('room-depth')?.value);
        const height = parseFloat(document.getElementById('room-height')?.value);
        
        if (width < 10 || depth < 10) {
            this.showToast('최소 10m 이상', 'error');
            return false;
        }
        
        this.toolService?.tools?.roomSize?.updateRoomSize(width, depth, height);
        this.closeRoomSizeModal();
        this.showToast(`Room: ${width}m × ${depth}m`, 'success');
        return true;
    }
    
    // =====================================================
    // Equipment Array Modal
    // =====================================================
    
    showEquipmentArrayModal() {
        document.getElementById(this.domIds.eqArrayModal)?.classList.add('active');
    }
    
    closeEquipmentArrayModal() {
        document.getElementById(this.domIds.eqArrayModal)?.classList.remove('active');
    }
    
    applyEquipmentArray() {
        const rows = parseInt(document.getElementById('eq-rows')?.value) || 3;
        const cols = parseInt(document.getElementById('eq-cols')?.value) || 5;
        const spacingX = parseFloat(document.getElementById('eq-spacing-x')?.value) || 2.0;
        const spacingY = parseFloat(document.getElementById('eq-spacing-y')?.value) || 3.5;
        
        this.closeEquipmentArrayModal();
        
        const eqArrayTool = this.toolService?.tools?.equipmentArray;
        if (eqArrayTool) {
            eqArrayTool.startArrayPlacement({ rows, cols, spacingX, spacingY });
            this.showToast(`클릭하여 ${rows}×${cols} 배열 시작점 지정`, 'info');
            return true;
        } else {
            this.showToast('EquipmentArrayTool 로드 안됨', 'error');
            return false;
        }
    }
    
    // =====================================================
    // Status Bar 업데이트
    // =====================================================
    
    updateStatus() {
        this.updateObjectCount();
        this.updateZoomDisplay();
        this.updateGroupCount();
    }
    
    updateObjectCount() {
        if (!this.canvas) return;
        
        let count = 0;
        ['room', 'equipment'].forEach(layerName => {
            const layer = this.canvas.layers[layerName];
            if (layer) {
                layer.find('Group').forEach(group => {
                    if (group.name()?.includes('component') || group.getAttr('componentType')) {
                        count++;
                    }
                });
            }
        });
        
        document.getElementById('status-objects').textContent = count;
        document.getElementById('status-selected').textContent = 
            this.canvas.selectedObjects?.length || 0;
        
        if (this.state) {
            this.state.totalObjects = count;
        }
    }
    
    updateZoomDisplay() {
        const zoom = this.canvas?.stage?.scaleX() || 1;
        document.getElementById('status-zoom').textContent = Math.round(zoom * 100) + '%';
        
        if (this.state) {
            this.state.zoom = zoom;
        }
    }
    
    updateGroupCount() {
        if (!this.canvas) return;
        
        let groupCount = 0;
        ['room', 'equipment'].forEach(layerName => {
            const layer = this.canvas.layers[layerName];
            if (layer) {
                layer.find('Group').forEach(group => {
                    if (group.getAttr('isUserGroup')) groupCount++;
                });
            }
        });
        
        document.getElementById('status-groups').textContent = groupCount;
        
        if (this.state?.updateStats) {
            this.state.updateStats({ groupCount });
        }
    }
    
    // =====================================================
    // Loading
    // =====================================================
    
    hideLoading() {
        document.getElementById(this.domIds.loadingIndicator).style.display = 'none';
    }
    
    showLoading() {
        document.getElementById(this.domIds.loadingIndicator).style.display = 'block';
    }
    
    // =====================================================
    // 외부 클릭 처리 (팝업 자동 닫기)
    // =====================================================
    
    setupClickOutsideHandlers() {
        document.addEventListener('click', e => {
            const toolbarContainer = document.getElementById(this.domIds.toolbarContainer);
            const alignPopup = document.getElementById(this.domIds.alignPopup);
            const alignBtn = document.getElementById(this.domIds.alignBtn);
            
            // Component Submenu 닫기
            if (this.state?.componentSubmenuVisible && !toolbarContainer?.contains(e.target)) {
                this.toggleComponentSubmenu();
            }
            
            // Align Popup 닫기
            if (this.state?.alignPopupVisible && 
                !alignPopup?.contains(e.target) && 
                !alignBtn?.contains(e.target)) {
                this.hideAlignPopup();
            }
        });
    }
    
    // =====================================================
    // Escape 처리
    // =====================================================
    
    handleEscape() {
        // 선택 해제
        this.canvas?.deselectAll?.();
        this.canvas.selectedObjects = [];
        this.canvas.transformer?.nodes([]);
        this.canvas.stage?.batchDraw();
        
        // 팝업/메뉴 닫기
        if (this.state?.componentSubmenuVisible) {
            this.toggleComponentSubmenu();
        }
        if (this.state?.alignPopupVisible) {
            this.hideAlignPopup();
        }
        if (this.state?.shortcutsHelpVisible) {
            this.toggleShortcutsHelp();
        }
    }
    
    // =====================================================
    // Canvas 크기 업데이트 콜백 설정
    // =====================================================
    
    setCanvasSizeUpdater(updater) {
        this.updateCanvasSize = updater;
    }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.UIService = UIService;
}

console.log('✅ UIService.js 로드 완료');