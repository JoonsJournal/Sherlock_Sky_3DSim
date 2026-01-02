/**
 * SelectionVisualizer.js
 * 선택/호버 시각 효과 관리
 * 
 * @version 1.0.0
 * @description Solid Edge 색상 표준 적용
 * 
 * 색상 기준 (theme.js):
 * - Selected: Orange #FF6600
 * - Highlight (Hover): Cyan #00BFFF
 * - Deselected: Black #000000 (emissive 기본값)
 */

import { SOLID_EDGE_COLORS_HEX } from '../../core/config/theme.js';
import { debugLog } from '../../utils/Config.js';

export class SelectionVisualizer {
    constructor() {
        // 원본 emissive 색상 저장 (복원용)
        this.originalEmissiveMap = new WeakMap();
        
        // 호버 중인 객체
        this.hoveredObject = null;
        
        // 색상 설정 (theme.js 참조)
        this.colors = {
            selected: SOLID_EDGE_COLORS_HEX.SELECTED,    // 0xFF6600 (Orange)
            highlight: SOLID_EDGE_COLORS_HEX.HIGHLIGHT,  // 0x00BFFF (Cyan)
            deselected: 0x000000                          // Black (기본값)
        };
        
        debugLog('✅ SelectionVisualizer 초기화 완료');
        debugLog('   - Selected:', this.colors.selected.toString(16));
        debugLog('   - Highlight:', this.colors.highlight.toString(16));
    }
    
    /**
     * 선택 스타일 적용
     * @param {THREE.Object3D} object - 대상 객체
     */
    applySelectionStyle(object) {
        if (!object) return;
        
        this._traverseAndApply(object, (mesh) => {
            if (mesh.material && mesh.material.emissive) {
                // 원본 색상 저장 (최초 1회)
                if (!this.originalEmissiveMap.has(mesh)) {
                    this.originalEmissiveMap.set(mesh, mesh.material.emissive.getHex());
                }
                // 선택 색상 적용 (Orange)
                mesh.material.emissive.setHex(this.colors.selected);
            }
        });
        
        debugLog('🟠 선택 스타일 적용:', object.userData?.id);
    }
    
    /**
     * 선택 스타일 제거
     * @param {THREE.Object3D} object - 대상 객체
     */
    removeSelectionStyle(object) {
        if (!object) return;
        
        this._traverseAndApply(object, (mesh) => {
            if (mesh.material && mesh.material.emissive) {
                // 원본 색상으로 복원 또는 기본값
                const originalColor = this.originalEmissiveMap.get(mesh) ?? this.colors.deselected;
                mesh.material.emissive.setHex(originalColor);
            }
        });
        
        debugLog('⚫ 선택 스타일 제거:', object.userData?.id);
    }
    
    /**
     * 호버 스타일 적용
     * @param {THREE.Object3D} object - 대상 객체
     */
    applyHoverStyle(object) {
        if (!object) return;
        
        // 이전 호버 객체 스타일 제거
        if (this.hoveredObject && this.hoveredObject !== object) {
            this.removeHoverStyle(this.hoveredObject);
        }
        
        this._traverseAndApply(object, (mesh) => {
            if (mesh.material && mesh.material.emissive) {
                // 원본 색상 저장 (최초 1회)
                if (!this.originalEmissiveMap.has(mesh)) {
                    this.originalEmissiveMap.set(mesh, mesh.material.emissive.getHex());
                }
                // 호버 색상 적용 (Cyan)
                mesh.material.emissive.setHex(this.colors.highlight);
            }
        });
        
        this.hoveredObject = object;
        debugLog('🔵 호버 스타일 적용:', object.userData?.id);
    }
    
    /**
     * 호버 스타일 제거
     * @param {THREE.Object3D} object - 대상 객체 (null이면 현재 호버 객체)
     */
    removeHoverStyle(object = null) {
        const target = object || this.hoveredObject;
        if (!target) return;
        
        this._traverseAndApply(target, (mesh) => {
            if (mesh.material && mesh.material.emissive) {
                // 원본 색상으로 복원
                const originalColor = this.originalEmissiveMap.get(mesh) ?? this.colors.deselected;
                mesh.material.emissive.setHex(originalColor);
            }
        });
        
        if (target === this.hoveredObject) {
            this.hoveredObject = null;
        }
        
        debugLog('⚫ 호버 스타일 제거:', target.userData?.id);
    }
    
    /**
     * 현재 호버된 객체 반환
     * @returns {THREE.Object3D|null}
     */
    getHoveredObject() {
        return this.hoveredObject;
    }
    
    /**
     * 호버 상태 확인
     * @param {THREE.Object3D} object 
     * @returns {boolean}
     */
    isHovered(object) {
        return this.hoveredObject === object;
    }
    
    /**
     * 색상 설정 변경
     * @param {Object} colors - { selected, highlight, deselected }
     */
    setColors(colors) {
        if (colors.selected !== undefined) {
            this.colors.selected = colors.selected;
        }
        if (colors.highlight !== undefined) {
            this.colors.highlight = colors.highlight;
        }
        if (colors.deselected !== undefined) {
            this.colors.deselected = colors.deselected;
        }
        debugLog('🎨 색상 설정 변경됨');
    }
    
    /**
     * 내부: 객체 순회하며 함수 적용
     * @private
     */
    _traverseAndApply(object, fn) {
        object.traverse((child) => {
            if (child.isMesh) {
                fn(child);
            }
        });
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        if (this.hoveredObject) {
            this.removeHoverStyle();
        }
        this.originalEmissiveMap = new WeakMap();
        debugLog('🗑️ SelectionVisualizer 정리 완료');
    }
}