/**
 * SelectionVisualizer.js
 * 선택/호버 시각 효과 관리
 * 
 * @version 1.5.0
 * @description Solid Edge 색상 표준 적용, Material Clone, emissiveIntensity 조절
 */

import { SOLID_EDGE_COLORS_HEX } from '../../core/config/theme.js';

export class SelectionVisualizer {
    constructor() {
        this.originalEmissiveMap = new WeakMap();
        this.originalIntensityMap = new WeakMap();  // 원본 intensity 저장
        this.clonedMaterials = new WeakSet();
        this.selectedObjects = new Set();
        
        this.colors = {
            selected: SOLID_EDGE_COLORS_HEX.SELECTED,    // 0xFF6600 (Orange)
            highlight: SOLID_EDGE_COLORS_HEX.HIGHLIGHT,  // 0x00BFFF (Cyan)
            deselected: 0x000000                          // Black
        };
        
        // ⭐ Intensity 설정 (가시성 조절)
        this.intensity = {
            selected: 3.0,    // 선택 시 강도
            highlight: 1.5,   // 호버 시 강도
            default: 1.0      // 기본 강도
        };
    }
    
    /**
     * 선택된 객체 목록 동기화
     */
    syncSelectedObjects(objects) {
        this.selectedObjects = new Set(objects);
    }
    
    /**
     * 객체가 현재 선택되어 있는지 확인
     */
    isSelected(object) {
        return this.selectedObjects.has(object);
    }
    
    /**
     * 선택 스타일 적용 (Orange)
     */
    applySelectionStyle(object) {
        if (!object) return;
        
        this.selectedObjects.add(object);
        this._setEmissiveColor(object, this.colors.selected, this.intensity.selected);
    }
    
    /**
     * 선택 스타일 제거
     */
    removeSelectionStyle(object) {
        if (!object) return;
        
        this.selectedObjects.delete(object);
        this._restoreOriginalColor(object);
    }
    
    /**
     * 호버 스타일 적용 (Cyan)
     */
    applyHoverStyle(object) {
        if (!object) return;
        
        // 선택된 객체는 호버 제외
        if (this.isSelected(object)) return;
        
        this._setEmissiveColor(object, this.colors.highlight, this.intensity.highlight);
    }
    
    /**
     * 호버 스타일 제거
     */
    removeHoverStyle(object) {
        if (!object) return;
        
        // 선택된 객체라면 선택 색상 유지
        if (this.isSelected(object)) {
            this._setEmissiveColor(object, this.colors.selected, this.intensity.selected);
            return;
        }
        
        this._restoreOriginalColor(object);
    }
    
    /**
     * emissive 색상 및 강도 설정
     * @private
     */
    _setEmissiveColor(object, color, intensity) {
        object.traverse((child) => {
            if (child.isMesh && child.material) {
                this._ensureMaterialCloned(child);
                
                if (child.material.emissive) {
                    // 원본 색상 저장 (최초 1회)
                    if (!this.originalEmissiveMap.has(child)) {
                        this.originalEmissiveMap.set(child, child.material.emissive.getHex());
                        this.originalIntensityMap.set(child, child.material.emissiveIntensity ?? 1.0);
                    }
                    
                    child.material.emissive.setHex(color);
                    child.material.emissiveIntensity = intensity;
                }
            }
        });
    }
    
    /**
     * Material Clone 보장
     * @private
     */
    _ensureMaterialCloned(mesh) {
        if (!mesh.material || this.clonedMaterials.has(mesh)) return;
        
        if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(mat => mat.clone());
        } else {
            mesh.material = mesh.material.clone();
        }
        
        this.clonedMaterials.add(mesh);
    }
    
    /**
     * 원본 색상 복원
     * @private
     */
    _restoreOriginalColor(object) {
        object.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
                const originalColor = this.originalEmissiveMap.get(child) ?? this.colors.deselected;
                const originalIntensity = this.originalIntensityMap.get(child) ?? this.intensity.default;
                
                child.material.emissive.setHex(originalColor);
                child.material.emissiveIntensity = originalIntensity;
            }
        });
    }
    
    /**
     * Intensity 설정 변경
     * @param {Object} settings - { selected, highlight, default }
     */
    setIntensity(settings) {
        if (settings.selected !== undefined) this.intensity.selected = settings.selected;
        if (settings.highlight !== undefined) this.intensity.highlight = settings.highlight;
        if (settings.default !== undefined) this.intensity.default = settings.default;
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this.selectedObjects.clear();
        this.originalEmissiveMap = new WeakMap();
        this.originalIntensityMap = new WeakMap();
        this.clonedMaterials = new WeakSet();
    }
}